import { api, commercialTariffLabels, dateTime, escapeHtml, money, realtimeUrl, statusLabels, toast } from './common.js';

const form = document.querySelector('#shipmentForm');
const tabs = document.querySelectorAll('[data-client-tab]');
let clientSocket;

function savedOrders() {
  try { return JSON.parse(localStorage.getItem('skyseal_orders') || '[]'); } catch { return []; }
}

function saveOrder(item) {
  const next = [item, ...savedOrders().filter(x => x.reference !== item.reference)].slice(0, 20);
  localStorage.setItem('skyseal_orders', JSON.stringify(next));
  renderSaved();
}

function switchTab(name) {
  tabs.forEach(button => button.classList.toggle('active', button.dataset.clientTab === name));
  document.querySelector('#newTab').classList.toggle('hidden', name !== 'new');
  document.querySelector('#trackTab').classList.toggle('hidden', name !== 'track');
}

tabs.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.clientTab)));

for (const [id, counter] of [['productPhotos', 'productCount'], ['packagingPhotos', 'packagingCount']]) {
  document.querySelector(`#${id}`).addEventListener('change', event => {
    document.querySelector(`#${counter}`).textContent = event.target.files.length ? `Выбрано: ${event.target.files.length}` : 'Не выбрано';
  });
}

function fileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, mime_type: file.type, data_base64: reader.result.split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFiles(input) {
  const ids = [];
  for (const file of [...input.files]) {
    const payload = await fileData(file);
    const saved = await api('/client/uploads', { method: 'POST', body: JSON.stringify(payload) });
    ids.push(saved.id);
  }
  return ids;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#submitButton');
  button.disabled = true;
  button.innerHTML = 'Загрузка фотографий и создание заявки…';
  try {
    const data = new FormData(form);
    const [productIds, packagingIds] = await Promise.all([
      uploadFiles(document.querySelector('#productPhotos')),
      uploadFiles(document.querySelector('#packagingPhotos')),
    ]);
    const payload = {
      delivery_mode: data.get('delivery_mode'), tariff: data.get('tariff'),
      origin: { country: data.get('origin_country'), city: data.get('origin_city'), address: data.get('origin_address') },
      destination: { country: data.get('destination_country'), city: data.get('destination_city'), address: data.get('destination_address') },
      cargo: {
        name: data.get('cargo_name'), description: data.get('description'), pieces: Number(data.get('pieces')),
        weight_kg: Number(data.get('weight_kg')), length_cm: Number(data.get('length_cm')),
        width_cm: Number(data.get('width_cm')), height_cm: Number(data.get('height_cm')),
        declared_value: Number(data.get('declared_value')), declared_currency: data.get('declared_currency'),
        features: data.get('features') || '',
      },
      client_name: data.get('client_name'), client_phone: data.get('client_phone'), client_email: data.get('client_email') || '',
      product_photo_ids: productIds, packaging_photo_ids: packagingIds,
    };
    const created = await api('/client/shipments', { method: 'POST', body: JSON.stringify(payload) });
    saveOrder({ reference: created.shipment.reference, token: created.tracking_token, created_at: created.shipment.created_at });
    form.reset();
    toast(`Заявка ${created.shipment.reference} создана`, 'success');
    switchTab('track');
    await openOrder(created.shipment.reference, created.tracking_token);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = 'Создать заявку <span>→</span>';
  }
});

function renderSaved() {
  const orders = savedOrders();
  document.querySelector('#savedCount').textContent = orders.length;
  document.querySelector('#ordersList').innerHTML = orders.length ? orders.map(order => `
    <button class="saved-order" data-ref="${escapeHtml(order.reference)}" data-token="${escapeHtml(order.token)}">
      <span><strong>${escapeHtml(order.reference)}</strong><small>${dateTime(order.created_at)}</small></span><b>Открыть →</b>
    </button>`).join('') : '<div class="empty-state">На этом устройстве пока нет сохранённых заявок.</div>';
  document.querySelectorAll('.saved-order').forEach(node => node.addEventListener('click', () => openOrder(node.dataset.ref, node.dataset.token)));
}

document.querySelector('#manualTrack').addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.target);
  await openOrder(data.get('reference').trim().toUpperCase(), data.get('token').trim());
});

async function openOrder(reference, token) {
  try {
    const shipment = await api(`/client/shipments/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`);
    saveOrder({ reference, token, created_at: shipment.created_at });
    renderTracking(shipment, token);
    connectClientRealtime(reference, token);
  } catch (error) { toast(error.message, 'error'); }
}

function renderTracking(shipment, token) {
  const card = document.querySelector('#trackingCard');
  const bundle = shipment.quote_bundles?.find(item => item.id === shipment.quote_id) || shipment.quote_bundles?.[0];
  const cargo = shipment.cargo_passport?.cargo;
  const complete = ['submitted','analyzing','quote_sent','accepted','warehouse_received','departed','arrived','delivered'];
  const currentIndex = complete.indexOf(shipment.status);
  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="tracking-head"><div><p class="eyebrow">ЗАЯВКА</p><h2>${escapeHtml(shipment.reference)}</h2></div><span class="status status-${shipment.status}">${statusLabels[shipment.status] || shipment.status}</span></div>
    <div class="route-line"><strong>${escapeHtml(shipment.origin.city)}</strong><span>✈</span><strong>${escapeHtml(shipment.destination.city)}</strong></div>
    ${bundle ? renderQuoteBundle(bundle, shipment.status) : '<div class="pending-box">Проверенные варианты цены ещё не отправлены. Диспетчер сравнивает ёмкость, сроки, полную стоимость и ограничения.</div>'}
    <div class="timeline">${complete.map((status, index) => `<div class="timeline-item ${index <= Math.max(currentIndex, 1) ? 'done' : ''}"><i></i><span>${statusLabels[status]}</span></div>`).join('')}</div>
    ${cargo ? `<div class="passport-summary"><h3>Цифровой паспорт груза</h3><div><span>Фактический вес<b>${cargo.actual_weight_kg} кг</b></span><span>Объём<b>${cargo.volume_m3} м³</b></span><span>Оплачиваемый вес<b>${cargo.chargeable_weight_kg} кг</b></span><span>Фотоанализ<b>ручная проверка</b></span></div></div>` : ''}
    <details><summary>История событий</summary><div class="event-list">${shipment.events.map(event => `<p><time>${dateTime(event.created_at)}</time><b>${statusLabels[event.to_status] || event.to_status}</b><span>${escapeHtml(event.note)}</span></p>`).join('')}</div></details>`;
  document.querySelectorAll('[data-accept-option]').forEach(button => button.addEventListener('click', async () => {
    try {
      button.disabled = true;
      await api(`/client/shipments/${encodeURIComponent(shipment.reference)}/accept?token=${encodeURIComponent(token)}`, {
        method: 'POST', body: JSON.stringify({ option_id: button.dataset.acceptOption }),
      });
      toast('Выбранный вариант подтверждён', 'success');
      await openOrder(shipment.reference, token);
    } catch (error) { button.disabled = false; toast(error.message, 'error'); }
  }));
}

function renderQuoteBundle(bundle, shipmentStatus) {
  const expired = new Date(bundle.expires_at) <= new Date();
  const canAccept = shipmentStatus === 'quote_sent' && !expired;
  return `<section class="quote-package">
    <div class="quote-package-head"><div><p class="eyebrow">ВАРИАНТЫ ПЕРЕВОЗКИ</p><h3>${expired ? 'Срок предложения истёк' : 'Выберите цену и срок'}</h3></div><small>Действуют до ${dateTime(bundle.expires_at)}</small></div>
    <div class="quote-options">${bundle.options.map(option => {
      const selected = bundle.selected_option_id === option.id;
      return `<article class="quote-option ${option.recommended ? 'recommended' : ''} ${selected ? 'selected' : ''}">
        <div class="quote-option-top"><b>${commercialTariffLabels[option.tariff] || escapeHtml(option.title)}</b>${option.recommended ? '<span>Рекомендуем</span>' : ''}${selected ? '<span class="selected-badge">Выбрано</span>' : ''}</div>
        <strong>${money(option.amount, option.currency)}</strong>
        <p>${escapeHtml(option.title)}</p>
        <dl><div><dt>Срок</dt><dd>${option.eta_min_hours}–${option.eta_max_hours} ч</dd></div><div><dt>Маршрут</dt><dd>${escapeHtml(option.route_summary)}</dd></div><div><dt>Данные</dt><dd>${option.confidence === 'partner_confirmed' ? 'подтверждено партнёром' : 'проверено оператором'}</dd></div></dl>
        ${option.conditions ? `<small>${escapeHtml(option.conditions)}</small>` : ''}
        ${canAccept ? `<button class="${option.recommended ? 'primary' : 'secondary'}" data-accept-option="${option.id}">Выбрать ${commercialTariffLabels[option.tariff]}</button>` : ''}
      </article>`;
    }).join('')}</div>
    ${bundle.note ? `<p class="quote-package-note">${escapeHtml(bundle.note)}</p>` : ''}
  </section>`;
}

function connectClientRealtime(reference, token) {
  clientSocket?.close();
  const socket = new WebSocket(realtimeUrl(`/ws/client/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`));
  clientSocket = socket;
  socket.addEventListener('open', () => socket.send('ready'));
  socket.addEventListener('message', async () => {
    try {
      const shipment = await api(`/client/shipments/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`);
      renderTracking(shipment, token);
    } catch (error) { toast(error.message, 'error'); }
  });
  socket.addEventListener('close', () => {
    if (clientSocket === socket) setTimeout(() => {
      if (clientSocket === socket) connectClientRealtime(reference, token);
    }, 2500);
  });
}

renderSaved();
const params = new URLSearchParams(location.search);
if (params.get('ref') && params.get('token')) { switchTab('track'); openOrder(params.get('ref'), params.get('token')); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
