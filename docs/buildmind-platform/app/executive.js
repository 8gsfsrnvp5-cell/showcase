'use strict';

/*
  Кабинет: вкладка «Исполнительная» — журнал работ, документы о качестве,
  запросы недостающих документов, АОСР и печатные формы. Данные — с сервера
  (server/executive.js), сюда приходит готовая картина по проекту:
  что записано, что загружено, чего не хватает по каждой работе.

  Подключается после app.js и пользуется его общими функциями (el, apiFetch,
  escapeHtml, arrayBufferToBase64, TAB_LOADERS).
*/

const EXEC_STATUS = {
  ready: { label: 'Можно формировать АОСР', badge: 'ok' },
  assembled: { label: 'АОСР сформирован', badge: 'ok' },
  missing: { label: 'Не хватает документов', badge: 'warn' },
  'no-hidden-works': { label: 'АОСР не требуется', badge: 'muted' },
};
const EXEC_ROLE_LABELS = { procurement: 'Снабжение', engineer: 'Инженер ПТО' };
const PARTY_FIELDS = [
  ['developer', 'Застройщик (технический заказчик)'],
  ['contractor', 'Лицо, осуществляющее строительство'],
  ['designer', 'Лицо, осуществляющее подготовку проектной документации'],
];
const REPRESENTATIVE_FIELDS = [
  ['developerControl', 'Представитель застройщика по строительному контролю', { nrs: true }],
  ['contractor', 'Представитель лица, осуществляющего строительство', {}],
  ['contractorControl', 'Представитель подрядчика по строительному контролю', { nrs: true }],
  ['designer', 'Представитель проектировщика (при привлечении)', {}],
  ['performer', 'Представитель лица, выполнившего работы (если это другая организация)', { organization: true }],
];
const EXEC_PROJECT_KEY = 'buildmind-exec-project';

let execState = null;
let execProjectId = '';

function execApi(path) {
  return `${API}projects/${execProjectId}/executive${path || ''}`;
}

function ruDateShort(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '—';
}

async function execJson(url, options) {
  const res = await apiFetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function execSend(method, path, body) {
  return execJson(execApi(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/* ------------------------------ загрузка вкладки ------------------------------ */

async function loadExecutive() {
  const select = el('execProjectSelect');
  const { projects } = await execJson(API + 'projects');
  el('execEmpty').hidden = projects.length > 0;
  el('execBody').hidden = projects.length === 0;
  if (!projects.length) {
    select.innerHTML = '';
    el('execPrintLinks').innerHTML = '';
    return;
  }
  let saved = '';
  try { saved = localStorage.getItem(EXEC_PROJECT_KEY) || ''; } catch { /* без хранилища — первый проект */ }
  const current = execProjectId || saved;
  select.innerHTML = projects.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  select.value = projects.some((p) => p.id === current) ? current : projects[0].id;
  execProjectId = select.value;
  await refreshExecutive();
}

async function refreshExecutive() {
  execState = await execJson(execApi());
  renderExecutive();
  refreshExecutiveBadge();
}

function renderExecutive() {
  const s = execState;
  el('execPrintLinks').innerHTML = `
    <a href="${execApi('/journal/print')}" target="_blank" rel="noopener">Общий журнал работ (1026/пр)</a> ·
    <a href="${execApi('/registry/print')}" target="_blank" rel="noopener">Реестр ИД</a>`;
  el('execSummary').innerHTML = [
    [s.summary.entries, 'записей в журнале', ''],
    [s.summary.documents, 'документов загружено', ''],
    [s.summary.openRequests, 'открытых запросов', s.summary.openRequests ? 'var(--warn)' : 'var(--ok)'],
    [s.summary.readyWorks, 'работ готово к АОСР', s.summary.readyWorks ? 'var(--ok)' : ''],
    [s.summary.acts, 'АОСР сформировано', ''],
  ].map(([n, label, color]) => `<div class="stat"><div class="num"${color ? ` style="color:${color}"` : ''}>${n}</div><div class="label">${label}</div></div>`).join('');

  const readOnly = el('execReadOnly');
  readOnly.hidden = s.canEdit && s.canUpload;
  readOnly.textContent = !s.canEdit && !s.canUpload
    ? 'Только просмотр: ваша роль не ведёт журнал и не загружает документы (или подписка закончилась).'
    : !s.canEdit ? 'Вы можете загружать документы о качестве; журнал и акты ведёт ПТО.' : '';
  el('journalForm').hidden = !s.canEdit;
  el('objectForm').querySelectorAll('input, button').forEach((x) => { x.disabled = !s.canEdit; });
  el('docForm').hidden = !s.canUpload;

  const count = el('execRequestsCount');
  count.hidden = !s.summary.openRequests;
  count.textContent = s.summary.openRequests;

  el('execWorksList').innerHTML = s.journalWorks.map((w) => `<option value="${escapeHtml(w.workName)}"></option>`).join('');
  const materialNames = new Set();
  s.journalWorks.forEach((w) => w.materials.forEach((m) => materialNames.add(m.name)));
  s.journal.forEach((e) => e.materials.forEach((m) => materialNames.add(m.name)));
  el('execMaterialsList').innerHTML = Array.from(materialNames).map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');

  if (!el('docType').options.length) {
    el('docType').innerHTML = Object.entries(s.documentTypes).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join('');
  }

  renderExecWorks();
  renderExecActs();
  renderJournal();
  renderDocuments();
  renderRequests();
  renderObjectForm();
}

/* ------------------------------- ИД по работам ------------------------------- */

function docLabel(id) {
  const d = execState.documents.find((x) => x.id === id);
  if (!d) return '';
  return [execState.documentTypes[d.type], d.number ? `№ ${d.number}` : '', d.date ? `от ${ruDateShort(d.date)}` : ''].filter(Boolean).join(' ');
}

function renderExecWorks() {
  const works = execState.works;
  if (!works.length) {
    el('execWorks').innerHTML = '<p class="hint">Пока нет записей в журнале работ. Запишите выполненные работы — BuildMind соберёт по ним ИД.</p>';
    return;
  }
  el('execWorks').innerHTML = works.map((w) => {
    const info = EXEC_STATUS[w.status] || { label: w.status, badge: 'warn' };
    const materials = w.materials.length
      ? `<ul class="materials-list">${w.materials.map((m) => `<li class="${m.ok ? 'ok-line' : 'bad-line'}">${m.ok ? '✓' : '✗'} ${escapeHtml(m.name)}${m.quantity ? ` — ${escapeHtml(m.quantity)} ${escapeHtml(m.unit || '')}` : ''}${m.ok ? ` <span class="hint">(${escapeHtml(m.documents.map(docLabel).join('; '))})</span>` : ''}</li>`).join('')}</ul>`
      : '<span class="hint">материалы не указаны</span>';
    const schemes = w.hiddenWorksActs.length
      ? (w.schemes.length ? `<span class="ok-line">✓ ${escapeHtml(w.schemes.map(docLabel).join('; '))}</span>` : '<span class="bad-line">✗ нет исполнительной схемы</span>')
      : '<span class="hint">—</span>';
    const action = w.status === 'ready' && execState.canEdit
      ? `<button type="button" class="small" data-act="${escapeHtml(w.workKey)}">Сформировать АОСР</button>`
      : '';
    return `
      <div class="exec-work status-${escapeHtml(w.status)}">
        <div class="exec-work-head">
          <div>
            <strong>${escapeHtml(w.workName)}</strong>
            <div class="hint">${escapeHtml(ruDateShort(w.dateStart))} — ${escapeHtml(ruDateShort(w.dateEnd))} · ${escapeHtml(w.volume || '—')} ${escapeHtml(w.unit)} · записей: ${w.entries.length}${w.agentName ? ` · ${escapeHtml(w.agentName)}` : ''}</div>
          </div>
          <div><span class="badge ${info.badge}">${escapeHtml(info.label)}</span> ${action}</div>
        </div>
        <div class="exec-work-grid">
          <div><div class="hint">Акт</div>${w.hiddenWorksActs.length ? escapeHtml(w.hiddenWorksActs.join('; ')) : '<span class="hint">скрытых работ нет</span>'}</div>
          <div><div class="hint">Материалы и документы о качестве</div>${materials}</div>
          <div><div class="hint">Исполнительная схема</div>${schemes}</div>
        </div>
        ${w.missing.length && w.status !== 'no-hidden-works' ? `<div class="exec-missing">Не хватает: ${escapeHtml(w.missing.map((m) => m.note).join(' '))}</div>` : ''}
      </div>`;
  }).join('');

  el('execWorks').querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const act = await execSend('POST', '/acts', { workKey: btn.dataset.act });
      await refreshExecutive();
      // Через ссылку, а не window.open: так акт открывается и в демо без сервис-воркера.
      const link = Object.assign(document.createElement('a'), { href: execApi(`/acts/${act.id}/print`), target: '_blank', rel: 'noopener' });
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Не удалось сформировать АОСР: ' + err.message);
      btn.disabled = false;
    }
  }));
}

function renderExecActs() {
  const acts = execState.acts;
  el('execActs').innerHTML = acts.length
    ? `<table class="exec-table"><thead><tr><th>№</th><th>Акт</th><th>Работа</th><th>Дата</th><th></th></tr></thead><tbody>${acts.map((a) => `
      <tr>
        <td>${escapeHtml(a.number)}</td>
        <td><a href="${execApi(`/acts/${a.id}/print`)}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a></td>
        <td>${escapeHtml(a.workName)}</td>
        <td>${escapeHtml(ruDateShort(a.date))}</td>
        <td>${execState.canEdit ? `<button type="button" class="link-btn" data-del-act="${escapeHtml(a.id)}">удалить</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="hint">Актов пока нет.</p>';
  el('execActs').querySelectorAll('[data-del-act]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Удалить акт? Записи журнала и документы останутся.')) return;
    await execSend('DELETE', `/acts/${btn.dataset.delAct}`).catch((err) => alert(err.message));
    await refreshExecutive();
  }));
}

/* ----------------------------------- журнал ----------------------------------- */

function addMaterialRow(material) {
  const row = document.createElement('div');
  row.className = 'exec-material-row';
  row.innerHTML = `
    <input type="text" class="m-name" list="execMaterialsList" placeholder="Материал, изделие" value="${escapeHtml(material ? material.name : '')}" />
    <input type="number" step="any" class="m-qty" placeholder="кол-во" value="${material && material.quantity !== undefined && material.quantity !== null ? escapeHtml(material.quantity) : ''}" />
    <input type="text" class="m-unit" placeholder="ед." value="${escapeHtml(material ? material.unit || '' : '')}" />
    <button type="button" class="link-btn" title="Убрать">✕</button>`;
  row.querySelector('button').addEventListener('click', () => row.remove());
  el('jeMaterials').appendChild(row);
}

function resetJournalForm() {
  el('journalForm').reset();
  el('jeDate').value = new Date().toISOString().slice(0, 10);
  el('jeMaterials').innerHTML = '';
  addMaterialRow();
}

// Выбрали работу из сводки — подставляем единицу и материалы проекта.
function onJournalWorkChange() {
  const work = execState && execState.journalWorks.find((w) => w.workName === el('jeWork').value);
  if (!work) return;
  if (!el('jeUnit').value) el('jeUnit').value = work.unit || '';
  const rows = Array.from(el('jeMaterials').querySelectorAll('.exec-material-row'));
  const empty = rows.every((r) => !r.querySelector('.m-name').value.trim());
  if (empty && work.materials.length) {
    el('jeMaterials').innerHTML = '';
    work.materials.forEach((m) => addMaterialRow({ name: m.name, unit: m.unit }));
  }
}

function renderJournal() {
  const entries = execState.journal.slice().sort((a, b) => b.number - a.number);
  el('journalBody').innerHTML = entries.length
    ? entries.map((e) => `
      <tr>
        <td>${e.number}</td>
        <td>${escapeHtml(ruDateShort(e.date))}</td>
        <td><strong>${escapeHtml(e.workName)}</strong>${e.location ? `<div class="hint">${escapeHtml(e.location)}</div>` : ''}${e.description ? `<div class="hint">${escapeHtml(e.description)}</div>` : ''}</td>
        <td>${escapeHtml(e.volume ?? '—')} ${escapeHtml(e.unit)}</td>
        <td>${e.materials.length ? `<ul class="materials-list">${e.materials.map((m) => `<li>${escapeHtml(m.name)}${m.quantity ? ` — ${escapeHtml(m.quantity)} ${escapeHtml(m.unit)}` : ''}</li>`).join('')}</ul>` : '<span class="hint">—</span>'}</td>
        <td>${escapeHtml(e.conditions)}${e.performer ? `<div class="hint">${escapeHtml(e.performer)}</div>` : ''}</td>
        <td>${execState.canEdit ? `<button type="button" class="link-btn" data-del-entry="${escapeHtml(e.id)}">удалить</button>` : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="hint">Записей пока нет.</td></tr>';
  el('journalBody').querySelectorAll('[data-del-entry]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Удалить запись журнала?')) return;
    try {
      await execSend('DELETE', `/journal/${btn.dataset.delEntry}`);
      await refreshExecutive();
    } catch (err) {
      alert(err.message);
    }
  }));
}

async function submitJournal(event) {
  event.preventDefault();
  const status = el('journalStatus');
  const materials = Array.from(el('jeMaterials').querySelectorAll('.exec-material-row')).map((r) => ({
    name: r.querySelector('.m-name').value.trim(),
    quantity: r.querySelector('.m-qty').value,
    unit: r.querySelector('.m-unit').value.trim(),
  })).filter((m) => m.name);
  const button = el('journalForm').querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Сохраняю…';
  try {
    const result = await execSend('POST', '/journal', {
      date: el('jeDate').value,
      conditions: el('jeConditions').value,
      workName: el('jeWork').value,
      location: el('jeLocation').value,
      volume: el('jeVolume').value,
      unit: el('jeUnit').value,
      performer: el('jePerformer').value,
      description: el('jeDescription').value,
      materials,
    });
    const performer = el('jePerformer').value;
    resetJournalForm();
    el('jePerformer').value = performer;
    status.textContent = `Запись № ${result.entry.number} добавлена.` +
      (result.check.opened ? ` Агент открыл запросов на документы: ${result.check.opened}.` : '');
    await refreshExecutive();
  } catch (err) {
    status.textContent = 'Ошибка: ' + err.message;
  } finally {
    button.disabled = false;
  }
}

/* ------------------------------ документы о качестве ------------------------------ */

function onDocTypeChange() {
  const forWork = ['scheme', 'protocol'].includes(el('docType').value);
  document.querySelector('#docForm .doc-material').hidden = forWork;
  document.querySelector('#docForm .doc-work').hidden = !forWork;
}

function renderDocuments() {
  const docs = execState.documents.slice().reverse();
  el('docsBody').innerHTML = docs.length
    ? docs.map((d) => `
      <tr>
        <td>${escapeHtml(execState.documentTypes[d.type])}</td>
        <td>${escapeHtml(d.materialName || d.workName)}</td>
        <td>${escapeHtml([d.number ? `№ ${d.number}` : '', d.date ? `от ${ruDateShort(d.date)}` : '', d.batch ? `партия ${d.batch}` : '', d.manufacturer].filter(Boolean).join(', ') || '—')}
          ${d.recognized && d.recognized.length ? '<div class="hint">распознано из PDF</div>' : ''}</td>
        <td>${d.file ? `<a href="${execApi(`/files/${d.file.id}`)}" target="_blank" rel="noopener">${escapeHtml(d.file.name)}</a>` : '<span class="hint">без файла</span>'}</td>
        <td class="hint">${escapeHtml(d.uploadedBy ? d.uploadedBy.name : '')}<div>${escapeHtml(ruDateShort(d.createdAt))}</div></td>
        <td>${execState.canUpload ? `<button type="button" class="link-btn" data-del-doc="${escapeHtml(d.id)}">удалить</button>` : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="hint">Документов пока нет.</td></tr>';
  el('docsBody').querySelectorAll('[data-del-doc]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Удалить документ и его файл?')) return;
    try {
      await execSend('DELETE', `/documents/${btn.dataset.delDoc}`);
      await refreshExecutive();
    } catch (err) {
      alert(err.message);
    }
  }));
}

async function submitDocument(event) {
  event.preventDefault();
  const status = el('docStatus');
  const type = el('docType').value;
  const forWork = ['scheme', 'protocol'].includes(type);
  const body = {
    type,
    materialName: forWork ? '' : el('docMaterial').value,
    workName: forWork ? el('docWork').value : '',
    number: el('docNumber').value,
    date: el('docDate').value,
    batch: el('docBatch').value,
    manufacturer: el('docManufacturer').value,
  };
  const file = el('docFile').files[0];
  const button = el('docForm').querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = file ? 'Загружаю файл…' : 'Сохраняю…';
  try {
    if (file) {
      if (file.size > 20 * 1024 * 1024) throw new Error('файл больше 20 МБ.');
      body.file = { name: file.name, contentType: file.type, base64: arrayBufferToBase64(await file.arrayBuffer()) };
    }
    const result = await execSend('POST', '/documents', body);
    el('docForm').reset();
    onDocTypeChange();
    const recognized = result.document.recognized.length ? ' Из PDF распознаны: ' + result.document.recognized.map((k) => ({ number: 'номер', date: 'дата', batch: 'партия' })[k]).join(', ') + '.' : '';
    status.textContent = 'Документ загружен.' + recognized + (result.check.closed ? ` Закрыто запросов: ${result.check.closed}.` : '');
    await refreshExecutive();
  } catch (err) {
    status.textContent = 'Ошибка: ' + err.message;
  } finally {
    button.disabled = false;
  }
}

/* ----------------------------------- запросы ----------------------------------- */

function renderRequests() {
  const requests = execState.requests.slice().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  if (!requests.length) {
    el('execRequests').innerHTML = '<p class="hint">Запросов нет.</p>';
    return;
  }
  el('execRequests').innerHTML = requests.map((r) => `
    <div class="exec-request status-${escapeHtml(r.status)}">
      <div class="exec-work-head">
        <div><strong>${escapeHtml(r.title)}</strong><div class="hint">${escapeHtml(r.reason)}</div></div>
        <div>
          <span class="badge ${r.status === 'open' ? 'warn' : r.status === 'done' ? 'ok' : 'muted'}">${r.status === 'open' ? 'Открыт' : r.status === 'done' ? 'Закрыт документом' : 'Отменён'}</span>
          <span class="role-badge">${escapeHtml(EXEC_ROLE_LABELS[r.assigneeRole] || r.assigneeRole)}</span>
        </div>
      </div>
      <div class="hint">Создан ${escapeHtml(ruDateShort(r.createdAt))}${r.resolvedDocId ? ` · ${escapeHtml(docLabel(r.resolvedDocId))}` : ''}</div>
      ${r.status === 'open' ? `<div class="actions compact">
        ${execState.canUpload ? `<button type="button" class="small" data-upload="${escapeHtml(r.id)}">Загрузить документ</button>` : ''}
        ${execState.canEdit ? `<button type="button" class="link-btn" data-cancel="${escapeHtml(r.id)}">отменить</button>` : ''}
      </div>` : ''}
    </div>`).join('');

  el('execRequests').querySelectorAll('[data-upload]').forEach((btn) => btn.addEventListener('click', () => {
    const r = execState.requests.find((x) => x.id === btn.dataset.upload);
    showExecSub('documents');
    el('docType').value = r.kind === 'material' ? 'passport' : 'scheme';
    onDocTypeChange();
    if (r.kind === 'material') el('docMaterial').value = r.materialName;
    else el('docWork').value = r.workNames[0] || '';
    el('docFile').focus();
  }));
  el('execRequests').querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', async () => {
    await execSend('POST', `/requests/${btn.dataset.cancel}/cancel`).catch((err) => alert(err.message));
    await refreshExecutive();
  }));
}

// Число открытых запросов на вкладке — снабжение видит свои задачи сразу после входа.
async function refreshExecutiveBadge() {
  const link = document.querySelector('#tabs a[data-tab="executive"]');
  if (!link || !hasPerm('projects.view')) return;
  try {
    const { requests } = await execJson(API + 'executive/requests');
    let badge = link.querySelector('.count-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'count-badge';
      link.appendChild(badge);
    }
    badge.textContent = requests.length;
    badge.hidden = requests.length === 0;
    badge.title = 'Открытые запросы документов';
  } catch {
    // счётчик — подсказка, без него вкладка работает
  }
}

/* -------------------------------- данные объекта -------------------------------- */

function renderObjectForm() {
  const o = execState.object;
  el('objName').value = o.objectName || '';
  el('objAddress').value = o.objectAddress || '';
  el('objProjectCode').value = o.projectCode || '';
  el('objParties').innerHTML = PARTY_FIELDS.map(([key, label]) => {
    const p = (o.parties || {})[key] || {};
    return `<fieldset class="exec-fieldset"><legend>${escapeHtml(label)}</legend><div class="exec-grid">
      <label>Наименование<input type="text" data-party="${key}" data-field="name" value="${escapeHtml(p.name || '')}" /></label>
      <label>ОГРН, ИНН, адрес, телефон, СРО<input type="text" data-party="${key}" data-field="details" value="${escapeHtml(p.details || '')}" /></label>
    </div></fieldset>`;
  }).join('');
  el('objReps').innerHTML = REPRESENTATIVE_FIELDS.map(([key, label, extra]) => {
    const r = (o.representatives || {})[key] || {};
    return `<fieldset class="exec-fieldset"><legend>${escapeHtml(label)}</legend><div class="exec-grid">
      <label>Должность<input type="text" data-rep="${key}" data-field="position" value="${escapeHtml(r.position || '')}" /></label>
      <label>Фамилия, инициалы<input type="text" data-rep="${key}" data-field="name" value="${escapeHtml(r.name || '')}" /></label>
      <label>Документ о представительстве<input type="text" data-rep="${key}" data-field="order" placeholder="приказ № … от …" value="${escapeHtml(r.order || '')}" /></label>
      ${extra.nrs ? `<label>Номер в НРС<input type="text" data-rep="${key}" data-field="nrs" value="${escapeHtml(r.nrs || '')}" /></label>` : ''}
      ${extra.organization ? `<label>Организация<input type="text" data-rep="${key}" data-field="organization" value="${escapeHtml(r.organization || '')}" /></label>` : ''}
    </div></fieldset>`;
  }).join('');
  el('objectForm').querySelectorAll('input').forEach((x) => { x.disabled = !execState.canEdit; });
}

async function submitObject(event) {
  event.preventDefault();
  const parties = {};
  const representatives = {};
  el('objectForm').querySelectorAll('[data-party]').forEach((input) => {
    parties[input.dataset.party] = parties[input.dataset.party] || {};
    parties[input.dataset.party][input.dataset.field] = input.value;
  });
  el('objectForm').querySelectorAll('[data-rep]').forEach((input) => {
    representatives[input.dataset.rep] = representatives[input.dataset.rep] || {};
    representatives[input.dataset.rep][input.dataset.field] = input.value;
  });
  try {
    await execSend('PUT', '/object', {
      objectName: el('objName').value,
      objectAddress: el('objAddress').value,
      projectCode: el('objProjectCode').value,
      parties,
      representatives,
    });
    el('objectStatus').textContent = 'Сохранено — данные попадут в новые АОСР.';
    await refreshExecutive();
  } catch (err) {
    el('objectStatus').textContent = 'Ошибка: ' + err.message;
  }
}

/* ----------------------------------- подвкладки ----------------------------------- */

function showExecSub(name) {
  document.querySelectorAll('#execSubtabs button').forEach((b) => b.classList.toggle('active', b.dataset.sub === name));
  document.querySelectorAll('#tab-executive .exec-panel').forEach((p) => { p.hidden = p.dataset.sub !== name; });
}

document.querySelectorAll('#execSubtabs button').forEach((b) => b.addEventListener('click', () => showExecSub(b.dataset.sub)));
el('execProjectSelect').addEventListener('change', async () => {
  execProjectId = el('execProjectSelect').value;
  try { localStorage.setItem(EXEC_PROJECT_KEY, execProjectId); } catch { /* не запоминаем */ }
  await refreshExecutive();
});
el('journalForm').addEventListener('submit', submitJournal);
el('jeWork').addEventListener('change', onJournalWorkChange);
el('jeAddMaterial').addEventListener('click', () => addMaterialRow());
el('docForm').addEventListener('submit', submitDocument);
el('docType').addEventListener('change', onDocTypeChange);
el('objectForm').addEventListener('submit', submitObject);
resetJournalForm();

TAB_LOADERS.executive = () => loadExecutive();
