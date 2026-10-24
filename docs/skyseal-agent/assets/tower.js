import { API, api, commercialTariffLabels, dateTime, escapeHtml, money, realtimeUrl, statusLabels, toast } from './common.js';

const views = ['dashboard', 'orders', 'capacity', 'detail'];
let shipments = [];
let socket;
let currentOrderId = null;
let realtimeRefreshTimer;
const commercialProducts = [
  { key: 'flex', title: 'Гибкая отправка', etaMin: 72, etaMax: 120, enabled: true },
  { key: 'standard', title: 'Оптимальный баланс', etaMin: 48, etaMax: 72, enabled: true },
  { key: 'priority', title: 'Приоритетная отправка', etaMin: 12, etaMax: 36, enabled: true },
  { key: 'charter', title: 'Отдельный чартер', etaMin: 12, etaMax: 72, enabled: false },
];

function activeBundle(order) {
  return order.quote_bundles?.find(item => item.id === order.quote_id) || order.quote_bundles?.[0];
}

function bundlePrice(bundle) {
  if (!bundle?.options?.length) return '—';
  const amounts = bundle.options.map(option => option.amount);
  const currency = bundle.options[0].currency;
  return amounts.length === 1 ? money(amounts[0], currency) : `${money(Math.min(...amounts), currency)} – ${money(Math.max(...amounts), currency)}`;
}

function showView(name) {
  views.forEach(view => document.querySelector(`#${view}View`).classList.toggle('hidden', view !== name));
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  document.querySelector('#viewTitle').textContent = ({ dashboard: 'Обзор операций', orders: 'Клиентские заявки', capacity: 'Подтверждённая ёмкость', detail: 'Карточка заявки' })[name];
  if (name !== 'detail') currentOrderId = null;
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { showView(button.dataset.view); if (button.dataset.view === 'capacity') loadCapacity(); }));
setInterval(() => document.querySelector('#clock').textContent = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), 1000);

document.querySelector('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const form = new FormData(event.target);
    await api('/operator/login', { method: 'POST', body: JSON.stringify({ email: form.get('email') || '', password: form.get('password') }) });
    await startTower();
  } catch (error) { toast(error.message, 'error'); }
});

document.querySelector('#logout').addEventListener('click', async () => { await api('/operator/logout', { method: 'POST' }); location.reload(); });

async function startTower() {
  document.querySelector('#loginScreen').classList.add('hidden');
  document.querySelector('#towerApp').classList.remove('hidden');
  await refresh();
  connectRealtime();
}

async function refresh() {
  const [dashboard, list] = await Promise.all([api('/operator/dashboard'), api('/operator/shipments')]);
  shipments = list;
  renderDashboard(dashboard);
  renderOrders();
}

function renderDashboard(data) {
  document.querySelector('#attentionBadge').textContent = data.attention || 0;
  document.querySelector('#dashboardView').innerHTML = `
    <div class="kpi-grid"><article><small>Все заявки</small><strong>${data.total || 0}</strong><span>единый реестр</span></article><article class="warning"><small>Требуют решения</small><strong>${data.attention || 0}</strong><span>приоритет диспетчера</span></article><article><small>Активные перевозки</small><strong>${data.active || 0}</strong><span>в исполнении</span></article><article><small>Открытые исключения</small><strong>${data.open_exceptions || 0}</strong><span>контрольные ворота</span></article></div>
    <div class="tower-grid"><article class="panel"><div class="panel-title"><div><p class="eyebrow">ОЧЕРЕДЬ РЕШЕНИЙ</p><h2>Что требует внимания</h2></div><button class="link-button" data-open-orders>Все заявки →</button></div>${shipments.filter(x => ['submitted','analyzing','needs_review','quote_draft'].includes(x.status)).slice(0,6).map(orderRow).join('') || '<div class="empty-state">Нет заявок, ожидающих решения.</div>'}</article>
    <article class="panel"><div class="panel-title"><div><p class="eyebrow">ПРИНЦИП ДОВЕРИЯ</p><h2>Уровни данных</h2></div></div><div class="confidence-legend"><p><i class="confidence estimate"></i><span><b>Расчётная оценка</b>Не показывается клиенту как финальная цена</span></p><p><i class="confidence verified"></i><span><b>Проверено оператором</b>Есть источник и срок действия</span></p><p><i class="confidence confirmed"></i><span><b>Подтверждено партнёром</b>Ставка или ёмкость получена от контрагента</span></p></div></article></div>`;
  document.querySelector('[data-open-orders]')?.addEventListener('click', () => showView('orders'));
  bindOrderLinks();
}

function orderRow(order) {
  const exception = order.exceptions?.find(x => !x.resolved_at);
  return `<button class="decision-row" data-order-id="${order.id}"><span class="status-dot ${order.status}"></span><span class="decision-main"><b>${escapeHtml(order.reference)} · ${escapeHtml(order.cargo.name)}</b><small>${escapeHtml(order.origin.city)} → ${escapeHtml(order.destination.city)} · ${order.cargo.weight_kg} кг</small></span><span class="decision-status">${exception ? escapeHtml(exception.title) : statusLabels[order.status]}</span><b>→</b></button>`;
}

function renderOrders() {
  document.querySelector('#ordersTable').innerHTML = `<article class="panel"><div class="panel-title"><div><p class="eyebrow">ЕДИНЫЙ РЕЕСТР</p><h2>${shipments.length} заявок</h2></div></div><div class="table-wrap"><table><thead><tr><th>Номер</th><th>Клиент</th><th>Направление</th><th>Груз</th><th>Статус</th><th>Варианты цены</th><th></th></tr></thead><tbody>${shipments.map(order => `<tr><td><b>${escapeHtml(order.reference)}</b><small>${dateTime(order.created_at)}</small></td><td>${escapeHtml(order.client_name)}<small>${escapeHtml(order.client_phone)}</small></td><td>${escapeHtml(order.origin.city)} → ${escapeHtml(order.destination.city)}</td><td>${escapeHtml(order.cargo.name)}<small>${order.cargo.weight_kg} кг · ${order.cargo.pieces} мест</small></td><td><span class="status status-${order.status}">${statusLabels[order.status]}</span></td><td>${bundlePrice(activeBundle(order))}</td><td><button class="round-button" data-order-id="${order.id}">→</button></td></tr>`).join('')}</tbody></table></div></article>`;
  bindOrderLinks();
}

function bindOrderLinks() {
  document.querySelectorAll('[data-order-id]').forEach(button => button.addEventListener('click', () => openDetail(button.dataset.orderId)));
}

async function openDetail(id) {
  currentOrderId = id;
  const order = await api(`/operator/shipments/${id}`);
  showView('detail');
  const passport = order.cargo_passport?.cargo;
  const confidence = order.agent_runs.find(x => x.agent === 'confidence_agent')?.output;
  const quoteBundle = activeBundle(order);
  document.querySelector('#detailView').innerHTML = `
    <button class="back-button" id="backOrders">← К заявкам</button>
    <div class="detail-header"><div><p class="eyebrow">${escapeHtml(order.reference)}</p><h2>${escapeHtml(order.origin.city)} → ${escapeHtml(order.destination.city)}</h2><span class="status status-${order.status}">${statusLabels[order.status]}</span></div><div class="detail-actions"><button id="reanalyze" class="secondary">Запустить агентов повторно</button>${['needs_review','quote_draft','quote_sent'].includes(order.status) ? '<button id="openQuote" class="primary">Утвердить варианты</button>' : ''}</div></div>
    <div class="detail-grid"><article class="panel"><p class="eyebrow">КЛИЕНТ И ГРУЗ</p><h3>${escapeHtml(order.client_name)}</h3><p>${escapeHtml(order.client_phone)} · ${escapeHtml(order.client_email || 'email не указан')}</p><hr><h3>${escapeHtml(order.cargo.name)}</h3><p>${escapeHtml(order.cargo.description)}</p><div class="mini-metrics"><span>Вес<b>${order.cargo.weight_kg} кг</b></span><span>Объём<b>${passport?.volume_m3 ?? '—'} м³</b></span><span>Расчётный вес<b>${passport?.chargeable_weight_kg ?? '—'} кг</b></span><span>Мест<b>${order.cargo.pieces}</b></span></div><div class="photo-strip">${[...order.product_photo_ids, ...order.packaging_photo_ids].map(id => `<img src="${API}/operator/files/${id}" alt="Фото груза">`).join('')}</div></article>
    <article class="panel confidence-card"><p class="eyebrow">ДОСТОВЕРНОСТЬ РЕШЕНИЯ</p><div class="confidence-score"><strong>${confidence?.score ?? 0}</strong><span>/100</span></div><p>${confidence?.level === 'ready_for_operator_approval' ? 'Готово к операторскому подтверждению' : 'Требуются подтверждения и исходные данные'}</p><ul>${(confidence?.missing_confirmations || []).map(x => `<li>${escapeHtml(x.replaceAll('_',' '))}</li>`).join('')}</ul></article></div>
    <article class="panel"><div class="panel-title"><div><p class="eyebrow">DIRECTOR WORKFLOW</p><h2>Журнал новых агентов</h2></div><span>${order.agent_runs.length} запусков</span></div><div class="agent-grid">${order.agent_runs.map(run => `<details class="agent-run ${run.status}"><summary><span class="agent-icon">${run.status === 'completed' ? '✓' : run.status === 'failed' ? '×' : '!'}</span><span><b>${escapeHtml(run.agent)}</b><small>${escapeHtml(run.task)}</small></span><em>${run.duration_ms ?? 0} мс</em></summary><pre>${escapeHtml(JSON.stringify(run.output, null, 2))}</pre>${run.warnings.map(x => `<p class="agent-warning">${escapeHtml(x)}</p>`).join('')}</details>`).join('')}</div></article>
    <div class="detail-grid"><article class="panel"><p class="eyebrow">МАРШРУТЫ</p><h2>Варианты</h2>${order.routes.map(route => `<div class="route-option"><span>${route.nodes.join(' → ')}</span><b>${route.distance_km} км · ≈ ${route.estimated_hours} ч</b><small>${escapeHtml(route.operational_warning)}</small></div>`).join('') || '<div class="empty-state">Нет построенных маршрутов</div>'}</article><article class="panel"><p class="eyebrow">ИСКЛЮЧЕНИЯ</p><h2>Контрольные ворота</h2>${order.exceptions.map(x => `<div class="exception ${x.severity}"><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.detail)}</p></div>`).join('') || '<div class="empty-state">Открытых исключений нет</div>'}</article></div>
    ${quoteBundle ? renderOperatorQuoteBundle(quoteBundle) : ''}
    ${order.status === 'accepted' || ['awaiting_cargo','warehouse_received','customs_processing','ready_for_departure','handed_to_carrier','departed','arrived','last_mile'].includes(order.status) ? `<article class="panel"><p class="eyebrow">ИСПОЛНЕНИЕ</p><h2>Следующий подтверждаемый этап</h2><div id="statusActions" class="status-actions"></div></article>` : ''}
    ${renderQuoteDialog(order)}`;
  document.querySelector('#backOrders').addEventListener('click', () => showView('orders'));
  document.querySelector('#reanalyze').addEventListener('click', async () => { await api(`/operator/shipments/${id}/reanalyze`, { method: 'POST' }); toast('Агенты запущены', 'success'); setTimeout(() => openDetail(id), 800); });
  document.querySelector('#openQuote')?.addEventListener('click', () => document.querySelector('#quoteDialog').showModal());
  document.querySelector('#closeQuote')?.addEventListener('click', () => document.querySelector('#quoteDialog').close());
  document.querySelector('#quoteForm')?.addEventListener('submit', async event => {
    event.preventDefault(); const data = new FormData(event.target);
    try {
      const enabled = commercialProducts.filter(product => data.get(`${product.key}_enabled`));
      if (enabled.length < 2) throw new Error('Выберите минимум два варианта');
      const recommended = data.get('recommended');
      if (!enabled.some(product => product.key === recommended)) throw new Error('Рекомендуемый вариант должен быть включён');
      const currency = data.get('currency');
      const options = enabled.map(product => {
        const amount = Number(data.get(`${product.key}_amount`));
        const etaMin = Number(data.get(`${product.key}_eta_min`));
        const etaMax = Number(data.get(`${product.key}_eta_max`));
        const routeSummary = data.get(`${product.key}_route`).trim();
        const sourceReference = data.get(`${product.key}_source`).trim();
        if (!amount || !etaMin || !etaMax || !routeSummary || sourceReference.length < 3) throw new Error(`Заполните цену, срок, маршрут и источник для ${commercialTariffLabels[product.key]}`);
        return { tariff: product.key, title: product.title, amount, currency, eta_min_hours: etaMin, eta_max_hours: etaMax, route_summary: routeSummary, conditions: data.get(`${product.key}_conditions`).trim(), source_reference: sourceReference, source_confidence: data.get(`${product.key}_confidence`), recommended: recommended === product.key };
      });
      await api(`/operator/shipments/${id}/quote-bundle`, { method: 'POST', body: JSON.stringify({ options, expires_at: new Date(data.get('expires_at')).toISOString(), note: data.get('note') }) });
      document.querySelector('#quoteDialog').close(); toast(`${options.length} варианта отправлены клиенту`, 'success'); await refresh(); await openDetail(id);
    } catch (error) { toast(error.message, 'error'); }
  });
  renderStatusActions(order);
}

function renderOperatorQuoteBundle(bundle) {
  return `<article class="panel commercial-panel"><div class="panel-title"><div><p class="eyebrow">КОММЕРЧЕСКИЙ ПАКЕТ · V${bundle.version}</p><h2>${bundle.options.length} варианта · ${bundlePrice(bundle)}</h2></div><span class="status">${bundle.status === 'accepted' ? 'выбран клиентом' : bundle.status === 'superseded' ? 'заменён' : `до ${dateTime(bundle.expires_at)}`}</span></div><div class="operator-quote-grid">${bundle.options.map(option => `<div class="operator-quote ${option.recommended ? 'recommended' : ''} ${bundle.selected_option_id === option.id ? 'selected' : ''}"><b>${commercialTariffLabels[option.tariff]}</b><strong>${money(option.amount, option.currency)}</strong><span>${option.eta_min_hours}–${option.eta_max_hours} ч · ${escapeHtml(option.route_summary)}</span><small>${escapeHtml(option.source_reference)}</small></div>`).join('')}</div></article>`;
}

function renderQuoteDialog(order) {
  const route = `${order.origin.city} → ${order.destination.city}`;
  const editors = commercialProducts.map(product => `<fieldset class="quote-editor">
    <legend><label><input type="checkbox" name="${product.key}_enabled" ${product.enabled ? 'checked' : ''}> <b>${commercialTariffLabels[product.key]}</b> · ${product.title}</label><label class="recommend-choice"><input type="radio" name="recommended" value="${product.key}" ${product.key === 'standard' ? 'checked' : ''}> рекомендовать</label></legend>
    <div class="field-grid quote-fields"><label>Цена<input name="${product.key}_amount" type="number" min="1"></label><label>Срок от, ч<input name="${product.key}_eta_min" type="number" min="1" value="${product.etaMin}"></label><label>Срок до, ч<input name="${product.key}_eta_max" type="number" min="1" value="${product.etaMax}"></label><label>Достоверность<select name="${product.key}_confidence"><option value="operator_verified">Проверено оператором</option><option value="partner_confirmed">Подтверждено партнёром</option></select></label></div>
    <label>Маршрут<input name="${product.key}_route" value="${escapeHtml(route)}"></label><label>Источник ставки / RFQ<input name="${product.key}_source" placeholder="Номер письма, договора или оффера"></label><label>Условия<textarea name="${product.key}_conditions" rows="2" placeholder="Что включено, cut-off, ограничения"></textarea></label>
  </fieldset>`).join('');
  return `<dialog id="quoteDialog" class="quote-dialog"><form id="quoteForm"><div class="dialog-head"><div><p class="eyebrow">КОММЕРЧЕСКИЙ ПАКЕТ</p><h2>Отправить 2–4 варианта</h2></div><button id="closeQuote" type="button" class="round-button">×</button></div><div class="field-grid two"><label>Единая валюта<select name="currency"><option>RUB</option><option>USD</option><option>EUR</option><option>CNY</option><option>TJS</option><option>KGS</option><option>KZT</option><option>UZS</option></select></label><label>Действует до<input name="expires_at" type="datetime-local" required></label></div><div class="quote-editor-list">${editors}</div><label>Общий комментарий<textarea name="note" rows="3"></textarea></label><button class="primary big" type="submit">Отправить варианты клиенту</button></form></dialog>`;
}

const nextStatus = { accepted: 'awaiting_cargo', awaiting_cargo: 'warehouse_received', warehouse_received: 'customs_processing', customs_processing: 'ready_for_departure', ready_for_departure: 'handed_to_carrier', handed_to_carrier: 'departed', departed: 'arrived', arrived: 'last_mile', last_mile: 'delivered' };
function renderStatusActions(order) {
  const target = nextStatus[order.status]; const container = document.querySelector('#statusActions'); if (!container || !target) return;
  container.innerHTML = `<button class="primary" id="nextStatus">Подтвердить: ${statusLabels[target]}</button><p>Переход сохранится в неизменяемом журнале действий.</p>`;
  document.querySelector('#nextStatus').addEventListener('click', async () => { try { await api(`/operator/shipments/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: target, note: `Оператор подтвердил этап: ${statusLabels[target]}` }) }); await refresh(); await openDetail(order.id); } catch (error) { toast(error.message, 'error'); } });
}

async function loadCapacity() {
  const offers = await api('/operator/capacity');
  document.querySelector('#capacityView').innerHTML = `<div class="detail-grid"><article class="panel"><p class="eyebrow">НОВЫЙ ОФФЕР</p><h2>Внести подтверждённую ёмкость</h2><form id="capacityForm" class="stack-form dense"><div class="field-grid two"><label>Перевозчик<input name="carrier" required></label><label>Рейс<input name="flight" required></label><label>Откуда, ICAO<input name="departure" placeholder="UUEE" required></label><label>Куда, ICAO<input name="destination" placeholder="UTDD" required></label><label>Вылет<input name="departure_at" type="datetime-local" required></label><label>Cut-off (крайний срок)<input name="cutoff_at" type="datetime-local" required></label><label>Доступно, кг<input name="available_kg" type="number" min="1" required></label><label>Доступно, м³<input name="available_m3" type="number" min="0.01" step="0.01" required></label><label>Ставка за кг<input name="rate_per_kg" type="number" min="0.01" step="0.01" required></label><label>Минимальный сбор<input name="minimum_charge" type="number" min="0" value="0" required></label><label>Валюта<select name="currency"><option>USD</option><option>RUB</option><option>CNY</option><option>EUR</option></select></label><label>Действует до<input name="valid_until" type="datetime-local" required></label></div><label>Источник / номер письма или договора<input name="source_reference" required></label><label>Достоверность<select name="confidence"><option value="operator_verified">Проверено оператором</option><option value="partner_confirmed">Подтверждено партнёром</option></select></label><button class="primary">Сохранить оффер</button></form></article><article class="panel"><p class="eyebrow">ПРОВЕРЯЕМЫЕ ДАННЫЕ</p><h2>${offers.length} офферов</h2>${offers.map(x => `<div class="capacity-item"><b>${escapeHtml(x.carrier)} · ${escapeHtml(x.flight)}</b><span>${x.departure} → ${x.destination}</span><small>${x.available_kg} кг · ${x.available_m3} м³ · до ${dateTime(x.valid_until)}</small></div>`).join('') || '<div class="empty-state">Офферов ещё нет. Система не будет придумывать тариф.</div>'}</article></div>`;
  document.querySelector('#capacityForm').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); for (const key of ['available_kg','available_m3','rate_per_kg','minimum_charge']) data[key] = Number(data[key]); for (const key of ['departure_at','cutoff_at','valid_until']) data[key] = new Date(data[key]).toISOString(); data.allowed_categories = ['general_cargo']; data.restrictions = []; try { await api('/operator/capacity', { method: 'POST', body: JSON.stringify(data) }); toast('Оффер сохранён', 'success'); loadCapacity(); } catch (error) { toast(error.message, 'error'); } });
}

function connectRealtime() {
  socket?.close(); socket = new WebSocket(realtimeUrl('/ws/operator'));
  socket.addEventListener('open', () => { document.querySelector('#connectionDot').classList.add('online'); document.querySelector('#connectionText').textContent = 'в эфире'; socket.send('ready'); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.event === 'shipment.created') toast(`Новая заявка ${message.payload.reference}`, 'success');
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = setTimeout(async () => {
      await refresh();
      if (currentOrderId) await openDetail(currentOrderId);
    }, 120);
  });
  socket.addEventListener('close', () => { document.querySelector('#connectionDot').classList.remove('online'); document.querySelector('#connectionText').textContent = 'переподключение…'; setTimeout(connectRealtime, 2000); });
}

api('/operator/session').then(startTower).catch(() => {});
