'use strict';

const STATUS_LABELS = {
  ok: { label: 'Совпадает', badge: 'ok' },
  'volume-mismatch': { label: 'Расхождение объёма', badge: 'warn' },
  'volume-unknown': { label: 'Объём не распознан', badge: 'warn' },
  'missing-in-gpr': { label: 'Нет в ГПР', badge: 'warn' },
  'missing-in-vor': { label: 'Нет в ВОР', badge: 'warn' },
  unmatched: { label: 'Не сопоставлено', badge: 'bad' },
};

const DEMO_GPR = `Наименование работ,Объем,Ед.изм
Разработка траншеи под кабель,120,м3
Прокладка подземной кабельной канализации,300,м
Устройство дорожного знака 5.19.1,4,шт
Монтаж дорожной камеры на опоре,2,шт`;

const DEMO_VOR = `Наименование работ,Объем,Ед.изм
Разработка траншеи,120,м3
Прокладка кабельной канализации подземного исполнения,260,м
Установка дорожного знака,4,шт
Нанесение дорожной разметки термопластиком,150,м2`;

// Кабинет открыт по адресу …/app/, API — рядом: …/api/
const API = new URL('../api/', location.href).pathname;

function el(id) {
  return document.getElementById(id);
}

let currentUser = null;
let ROLES_LIST = [];

function hasPerm(permission) {
  return !!(currentUser && Array.isArray(currentUser.permissions) && currentUser.permissions.includes(permission));
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Обёртка над fetch: если сессия истекла или недействительна прямо
// посреди работы (сервер вернул 401), не показываем это как обычную
// ошибку в статусной строке, а честно возвращаем на экран входа.
async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    await checkAuthStatus();
    throw new Error('Сессия истекла — войдите заново.');
  }
  return res;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // избегаем переполнения стека на больших файлах
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Возвращает либо строку (CSV-текст — для отправки как есть), либо
// { format: 'xlsx', base64 } — для бинарного файла. Textarea всегда
// считается CSV-текстом.
async function readDocumentInput(inputEl, textareaEl) {
  const file = inputEl.files && inputEl.files[0];

  if (file) {
    const isXlsx = /\.xlsx$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';

    if (isXlsx) {
      const buffer = await file.arrayBuffer();
      return { format: 'xlsx', base64: arrayBufferToBase64(buffer) };
    }

    if (isPdf) {
      const buffer = await file.arrayBuffer();
      return { format: 'pdf', base64: arrayBufferToBase64(buffer) };
    }

    return await file.text();
  }

  return textareaEl.value || '';
}

function renderSummary(summary) {
  const wrap = el('summary');
  wrap.hidden = false;
  wrap.innerHTML = `
    <div class="stat"><div class="num">${summary.total}</div><div class="label">строк сопоставлено</div></div>
    <div class="stat"><div class="num" style="color:var(--ok)">${summary.ok}</div><div class="label">совпадений без замечаний</div></div>
    <div class="stat"><div class="num" style="color:var(--bad)">${summary.issues}</div><div class="label">требуют внимания</div></div>
  `;
}

function renderMaterials(materials) {
  if (!materials || materials.length === 0) {
    return '<span style="color:var(--muted)">—</span>';
  }
  const items = materials
    .map((m) => `<li>${escapeHtml(m.name)}${m.unit ? ' (' + escapeHtml(m.unit) + ')' : ''}</li>`)
    .join('');
  return `<ul class="materials-list">${items}</ul>`;
}

function renderResults(data) {
  renderSummary(data.summary);

  const tbody = el('resultsBody');
  tbody.innerHTML = '';
  el('resultsWrap').hidden = false;

  data.results.forEach((row) => {
    const statusInfo = STATUS_LABELS[row.status] || { label: row.status, badge: 'warn' };
    const tr = document.createElement('tr');
    tr.className = 'status-' + row.status;

    const confidenceLabel = row.confidence ? row.confidence.label : '—';

    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(row.workName)}</strong>
        ${row.disciplineName ? `<div class="discipline-line">${escapeHtml(row.disciplineName)}</div>` : ''}
        ${row.categoryName ? `<div style="color:var(--muted);font-size:11px">${escapeHtml(row.categoryName)}</div>` : ''}
        ${
          row.gprSourceNames && row.gprSourceNames.length
            ? `<div style="color:var(--muted);font-size:11px">ГПР: ${escapeHtml(row.gprSourceNames.join('; '))}</div>`
            : ''
        }
        ${
          row.vorSourceNames && row.vorSourceNames.length
            ? `<div style="color:var(--muted);font-size:11px">ВОР: ${escapeHtml(row.vorSourceNames.join('; '))}</div>`
            : ''
        }
      </td>
      <td><span class="badge ${statusInfo.badge}">${escapeHtml(statusInfo.label)}</span></td>
      <td>${escapeHtml(row.gprQuantity ?? '—')}</td>
      <td>${escapeHtml(row.vorQuantity ?? '—')}</td>
      <td>${escapeHtml(confidenceLabel)}</td>
      <td>${renderMaterials(row.requiredMaterials)}</td>
      <td style="max-width:220px">${escapeHtml(row.note || '')}</td>
    `;
    tbody.appendChild(tr);
  });
}

const RESOURCE_TYPE_LABELS = {
  labor: 'Люди',
  equipment: 'Техника',
  material: 'Материалы',
};

function renderSequencing(sequencing) {
  const wrap = el('sequencingWrap');
  if (!sequencing) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  const basisNote =
    sequencing.basis === 'dates'
      ? 'Проверено по датам начала/окончания из ГПР.'
      : 'В ГПР не найдены колонки с датами — проверено по порядку строк в документе (менее надёжно, чем по датам).';
  el('sequencingDisclaimer').textContent = '⚠️ ' + basisNote + ' ' + sequencing.disclaimer;

  const list = el('sequencingList');
  if (sequencing.violations.length === 0) {
    list.innerHTML = '<div class="sequencing-ok">Нарушений последовательности не найдено (по проверенным правилам).</div>';
    return;
  }

  list.innerHTML = sequencing.violations
    .map(
      (v) => `
        <div class="sequencing-item">
          <div class="title">⚠️ «${v.afterWorkName}» указана раньше, чем «${v.beforeWorkName}»</div>
          <div class="reason">${v.reason}</div>
          <div class="basis">${v.basis}</div>
        </div>
      `
    )
    .join('');
}

function renderSupplierMatchesCell(r) {
  if (r.resourceType !== 'material') {
    return '<span style="color:var(--muted)">—</span>';
  }
  const matches = r.supplierMatches;
  if (!matches || matches.length === 0) {
    return '<span style="color:var(--muted);font-size:12px">нет в справочнике поставщиков</span>';
  }
  return (
    '<ul class="materials-list">' +
    matches
      .slice(0, 3)
      .map(
        (m) =>
          `<li>${escapeHtml(m.supplierName)}` +
          (m.price !== null && m.price !== undefined
            ? ` — ${escapeHtml(m.price)} ₽${m.unit ? '/' + escapeHtml(m.unit) : ''}`
            : '') +
          ` <span class="supplier-match-confidence">(${escapeHtml(m.confidence.label)} уверенность)</span></li>`
      )
      .join('') +
    '</ul>'
  );
}

function renderResources(resourceEstimate) {
  const wrap = el('resourcesWrap');
  if (!resourceEstimate || resourceEstimate.summary.length === 0) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  el('resourcesDisclaimer').textContent = '⚠️ ' + resourceEstimate.disclaimer;

  const tbody = el('resourcesBody');
  tbody.innerHTML = resourceEstimate.summary
    .map(
      (r) => `
        <tr>
          <td><span class="resource-type-tag">${RESOURCE_TYPE_LABELS[r.resourceType] || r.resourceType}</span></td>
          <td>${r.resourceName}</td>
          <td>${r.totalQuantity}</td>
          <td>${r.outputUnit}</td>
          <td>${r.confidence}</td>
          <td style="color:var(--muted);font-size:12px">${r.contributingWorks.map((w) => w.workName).join('; ')}</td>
          <td>${renderSupplierMatchesCell(r)}</td>
        </tr>
      `
    )
    .join('');

  const uncoveredEl = el('resourcesUncovered');
  if (resourceEstimate.uncovered.length > 0) {
    uncoveredEl.innerHTML =
      'Без оценки (нет норм в демо-базе или не распознан объём): ' +
      resourceEstimate.uncovered.map((u) => u.workName).join(', ');
  } else {
    uncoveredEl.innerHTML = '';
  }
}

function renderDiffList(items, cls, formatFn) {
  if (!items || items.length === 0) return '';
  return `<ul class="${cls}">${items.map((i) => `<li>${formatFn(i)}</li>`).join('')}</ul>`;
}

function renderHistory(versions, projectId) {
  const wrap = el('historyWrap');
  const list = el('historyList');

  if (!versions || versions.length === 0) {
    wrap.hidden = true;
    list.innerHTML = '';
    return;
  }

  wrap.hidden = false;
  list.innerHTML = versions
    .slice()
    .reverse()
    .map((v, idx) => {
      const versionNumber = versions.length - idx;
      const date = new Date(v.createdAt).toLocaleString('ru-RU');
      const diff = v.diff;

      let diffHtml = '<span style="color:var(--muted)">первая версия — сравнивать не с чем</span>';
      if (diff && !diff.isFirstVersion) {
        const parts = [];
        if (diff.added.length) {
          parts.push(
            'Появилось: ' +
              renderDiffList(diff.added, 'added', (i) => i.workName)
          );
        }
        if (diff.removed.length) {
          parts.push(
            'Пропало: ' +
              renderDiffList(diff.removed, 'removed', (i) => i.workName)
          );
        }
        if (diff.changed.length) {
          parts.push(
            'Изменился объём: ' +
              renderDiffList(
                diff.changed,
                'changed',
                (i) =>
                  `${i.workName} — ГПР: ${i.gprQuantity.before ?? '—'} → ${i.gprQuantity.after ?? '—'}, ВОР: ${i.vorQuantity.before ?? '—'} → ${i.vorQuantity.after ?? '—'}`
              )
          );
        }
        diffHtml = parts.length
          ? parts.join('')
          : '<span style="color:var(--muted)">без изменений по составу и объёмам</span>';
      }

      const reportUrl = `${API}projects/${projectId}/versions/${v.id}/report`;

      return `
        <div class="history-item">
          <div class="history-head">
            <span>Версия ${versionNumber} · ${date}</span>
            <span>
              ОК: ${v.summary.ok} / требуют внимания: ${v.summary.issues}
              · <a href="${reportUrl}" target="_blank" rel="noopener">отчёт (исполнительная документация)</a>
            </span>
          </div>
          ${diffHtml}
        </div>
      `;
    })
    .join('');
}

async function loadProjects(selectAfterId) {
  const select = el('projectSelect');
  const res = await apiFetch(API + 'projects');
  const data = await res.json();

  const currentValue = selectAfterId || select.value;
  select.innerHTML = '<option value="">— не сохранять (разовая проверка) —</option>';

  data.projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.versionsCount ? `${p.name} (сверок: ${p.versionsCount})` : p.name;
    select.appendChild(opt);
  });

  select.value = currentValue || '';
  await onProjectChange();
}

async function onProjectChange() {
  const projectId = el('projectSelect').value;
  const hint = el('projectHint');

  if (!projectId) {
    hint.textContent = 'Результат не сохраняется — разовая проверка.';
    crosscheckProjectDisciplines = null;
    await renderCrosscheckDisciplines();
    renderHistory(null);
    return;
  }

  const res = await apiFetch(`${API}projects/${projectId}`);
  const data = await res.json();
  hint.textContent = `Создан: ${new Date(data.createdAt).toLocaleDateString('ru-RU')}`;
  crosscheckProjectDisciplines = data.disciplines && data.disciplines.length ? data.disciplines : ['road'];
  await renderCrosscheckDisciplines();
  renderHistory(data.versions, projectId);
}

async function runCrosscheck() {
  const statusEl = el('status');
  const projectId = el('projectSelect').value;

  if (projectId && !hasPerm('projects.manage')) {
    statusEl.textContent =
      'Ваша роль не позволяет сохранять версии в проект — выберите «без сохранения (разовая проверка)».';
    return;
  }

  statusEl.textContent = 'Обработка...';

  try {
    const gpr = await readDocumentInput(el('gprFile'), el('gprText'));
    const vor = await readDocumentInput(el('vorFile'), el('vorText'));

    const endpoint = projectId ? `${API}projects/${projectId}/versions` : API + 'crosscheck';
    const response = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectId ? { gpr, vor } : { gpr, vor, disciplines: crosscheckSelection }),
    });

    const data = await response.json();

    if (!response.ok) {
      statusEl.textContent = 'Ошибка: ' + (data.error || response.statusText);
      return;
    }

    const result = projectId ? data.result : data;
    renderResults(result);
    renderSequencing(result.sequencing);
    renderResources(result.resourceEstimate);
    renderAgents(result.agents);
    statusEl.textContent = `Готово (база знаний: ${result.knowledgeBaseVersion})`;

    if (projectId) {
      await loadProjects(projectId);
    }
  } catch (err) {
    statusEl.textContent = 'Ошибка: ' + err.message;
  }
}

el('runBtn').addEventListener('click', runCrosscheck);

el('demoBtn').addEventListener('click', () => {
  el('gprText').value = DEMO_GPR;
  el('vorText').value = DEMO_VOR;
  el('gprFile').value = '';
  el('vorFile').value = '';
});

el('projectSelect').addEventListener('change', onProjectChange);

/* ==================== Поставщики материалов ==================== */

function addSupplierMaterialRow(material) {
  const row = document.createElement('div');
  row.className = 'supplier-material-row';
  row.innerHTML = `
    <input type="text" class="mat-name" placeholder="Название материала (например, Труба гофрированная ПНД 110)" value="${escapeHtml(material ? material.name : '')}" />
    <input type="text" class="mat-unit" placeholder="ед. (м, шт, м2...)" value="${escapeHtml(material ? material.unit : '')}" />
    <input type="number" step="0.01" class="mat-price" placeholder="цена, ₽" value="${material && material.price !== null && material.price !== undefined ? escapeHtml(material.price) : ''}" />
    <input type="text" class="mat-date" placeholder="дата цены (ГГГГ-ММ-ДД)" value="${escapeHtml(material ? material.priceDate : '')}" />
    <button type="button" class="remove-mat-row">✕</button>
  `;
  row.querySelector('.remove-mat-row').addEventListener('click', () => row.remove());
  el('supplierMaterialsRows').appendChild(row);
}

function collectSupplierMaterials() {
  return Array.from(el('supplierMaterialsRows').querySelectorAll('.supplier-material-row')).map((row) => ({
    name: row.querySelector('.mat-name').value.trim(),
    unit: row.querySelector('.mat-unit').value.trim(),
    price: row.querySelector('.mat-price').value.trim(),
    priceDate: row.querySelector('.mat-date').value.trim(),
  }));
}

function resetSupplierForm() {
  el('supplierEditId').value = '';
  el('supplierFormTitle').textContent = 'Добавить поставщика';
  el('supplierName').value = '';
  el('supplierContact').value = '';
  el('supplierPhone').value = '';
  el('supplierEmail').value = '';
  el('supplierRegion').value = '';
  el('supplierNotes').value = '';
  el('supplierMaterialsRows').innerHTML = '';
  addSupplierMaterialRow();
  el('cancelSupplierEditBtn').hidden = true;
  el('supplierFormStatus').textContent = '';
}

function startEditSupplier(supplier) {
  el('supplierEditId').value = supplier.id;
  el('supplierFormTitle').textContent = 'Редактировать поставщика: ' + supplier.name;
  el('supplierName').value = supplier.name || '';
  el('supplierContact').value = supplier.contactPerson || '';
  el('supplierPhone').value = supplier.phone || '';
  el('supplierEmail').value = supplier.email || '';
  el('supplierRegion').value = supplier.region || '';
  el('supplierNotes').value = supplier.notes || '';
  el('supplierMaterialsRows').innerHTML = '';
  (supplier.materials && supplier.materials.length ? supplier.materials : [null]).forEach(addSupplierMaterialRow);
  el('cancelSupplierEditBtn').hidden = false;
  el('supplierFormStatus').textContent = '';
  el('supplierFormBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSuppliersList(suppliers) {
  const list = el('suppliersList');
  if (!suppliers || suppliers.length === 0) {
    list.innerHTML =
      '<span class="hint">Поставщиков пока нет — справочник специально начинается пустым, добавьте первого выше.</span>';
    return;
  }

  list.innerHTML = suppliers
    .map((s) => {
      const contacts = [s.contactPerson, s.phone, s.email, s.region].filter(Boolean).map(escapeHtml).join(' · ');
      const materialsHtml =
        s.materials && s.materials.length
          ? '<ul>' +
            s.materials
              .map(
                (m) =>
                  `<li>${escapeHtml(m.name)}${m.unit ? ' (' + escapeHtml(m.unit) + ')' : ''}${
                    m.price !== null && m.price !== undefined ? ' — ' + escapeHtml(m.price) + ' ₽' : ''
                  }${m.priceDate ? ', цена на ' + escapeHtml(m.priceDate) : ''}</li>`
              )
              .join('') +
            '</ul>'
          : '<span class="hint">материалы не указаны</span>';

      const canManage = hasPerm('suppliers.manage');

      return `
        <div class="supplier-card" data-supplier-id="${escapeHtml(s.id)}">
          <div class="supplier-head">
            <strong>${escapeHtml(s.name)}</strong>
            ${
              canManage
                ? `<div class="supplier-actions">
                    <button type="button" class="secondary edit-supplier-btn">Редактировать</button>
                    <button type="button" class="danger delete-supplier-btn">Удалить</button>
                  </div>`
                : ''
            }
          </div>
          ${contacts ? `<div class="supplier-contacts">${contacts}</div>` : ''}
          ${s.notes ? `<div class="supplier-contacts">${escapeHtml(s.notes)}</div>` : ''}
          <div class="supplier-materials">${materialsHtml}</div>
        </div>
      `;
    })
    .join('');

  if (!hasPerm('suppliers.manage')) return;

  list.querySelectorAll('.supplier-card').forEach((card) => {
    const supplierId = card.getAttribute('data-supplier-id');
    const supplier = suppliers.find((s) => s.id === supplierId);

    card.querySelector('.edit-supplier-btn').addEventListener('click', () => startEditSupplier(supplier));
    card.querySelector('.delete-supplier-btn').addEventListener('click', async () => {
      if (!confirm(`Удалить поставщика «${supplier.name}»? Это нельзя отменить.`)) return;
      await apiFetch(`${API}suppliers/${supplierId}`, { method: 'DELETE' });
      await loadSuppliers();
    });
  });
}

async function loadSuppliers() {
  const res = await apiFetch(API + 'suppliers');
  const data = await res.json();
  renderSuppliersList(data.suppliers);
  return data.suppliers;
}

async function saveSupplier() {
  const statusEl = el('supplierFormStatus');
  const name = el('supplierName').value.trim();
  if (!name) {
    statusEl.textContent = 'Укажите название поставщика.';
    return;
  }

  const payload = {
    name,
    contactPerson: el('supplierContact').value.trim(),
    phone: el('supplierPhone').value.trim(),
    email: el('supplierEmail').value.trim(),
    region: el('supplierRegion').value.trim(),
    notes: el('supplierNotes').value.trim(),
    materials: collectSupplierMaterials().filter((m) => m.name),
  };

  const editId = el('supplierEditId').value;
  statusEl.textContent = 'Сохранение...';

  try {
    const res = await apiFetch(editId ? `${API}suppliers/${editId}` : API + 'suppliers', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = 'Ошибка: ' + (data.error || res.statusText);
      return;
    }

    resetSupplierForm();
    await loadSuppliers();
  } catch (err) {
    statusEl.textContent = 'Ошибка: ' + err.message;
  }
}

el('addSupplierMaterialBtn').addEventListener('click', () => addSupplierMaterialRow());
el('saveSupplierBtn').addEventListener('click', saveSupplier);
el('cancelSupplierEditBtn').addEventListener('click', resetSupplierForm);

/* ==================== Пользователи и роли (RBAC) ==================== */

function populateRoleSelect() {
  const select = el('userRole');
  select.innerHTML = ROLES_LIST.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');
}

function roleName(roleId) {
  const role = ROLES_LIST.find((r) => r.id === roleId);
  return role ? role.name : roleId;
}

function resetUserForm() {
  el('userEditId').value = '';
  el('userFormTitle').textContent = 'Добавить пользователя';
  el('userUsername').value = '';
  el('userUsername').disabled = false;
  el('userName').value = '';
  el('userEmail').value = '';
  el('userPassword').value = '';
  el('userPassword').placeholder = '';
  if (ROLES_LIST.length) el('userRole').value = ROLES_LIST[ROLES_LIST.length - 1].id;
  el('cancelUserEditBtn').hidden = true;
  el('userFormStatus').textContent = '';
}

function startEditUser(user) {
  el('userEditId').value = user.id;
  el('userFormTitle').textContent = 'Редактировать пользователя: ' + user.username;
  el('userUsername').value = user.username;
  el('userUsername').disabled = true; // логин не меняем при редактировании — проще и без риска путаницы
  el('userName').value = user.name || '';
  el('userEmail').value = user.email || '';
  el('userPassword').value = '';
  el('userPassword').placeholder = 'оставьте пустым, чтобы не менять пароль';
  el('userRole').value = user.role;
  el('cancelUserEditBtn').hidden = false;
  el('userFormStatus').textContent = '';
}

function renderUsersList(users) {
  const list = el('usersList');
  if (!users || users.length === 0) {
    list.innerHTML = '<span class="hint">Пользователей нет.</span>';
    return;
  }

  list.innerHTML = users
    .map(
      (u) => `
        <div class="user-card" data-user-id="${escapeHtml(u.id)}">
          <span>
            <strong>${escapeHtml(u.name)}</strong> (${escapeHtml(u.username)}${u.email ? ', ' + escapeHtml(u.email) : ''})
            <span class="role-badge">${escapeHtml(roleName(u.role))}</span>
          </span>
          <span class="user-actions">
            <button type="button" class="secondary edit-user-btn">Редактировать</button>
            <button type="button" class="danger delete-user-btn" ${u.id === currentUser.id ? 'disabled title="Нельзя удалить себя, пока вы вошли под этой учётной записью"' : ''}>Удалить</button>
          </span>
        </div>
      `
    )
    .join('');

  list.querySelectorAll('.user-card').forEach((card) => {
    const userId = card.getAttribute('data-user-id');
    const user = users.find((u) => u.id === userId);

    card.querySelector('.edit-user-btn').addEventListener('click', () => startEditUser(user));
    const deleteBtn = card.querySelector('.delete-user-btn');
    if (!deleteBtn.disabled) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Удалить пользователя «${user.username}»? Это нельзя отменить.`)) return;
        const res = await apiFetch(`${API}users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
          alert('Ошибка: ' + (data.error || res.statusText));
          return;
        }
        await loadUsers();
      });
    }
  });
}

async function loadUsers() {
  const res = await apiFetch(API + 'users');
  const data = await res.json();
  renderUsersList(data.users);
}

async function saveUser() {
  const statusEl = el('userFormStatus');
  const username = el('userUsername').value.trim();
  const editId = el('userEditId').value;

  if (!editId && !username) {
    statusEl.textContent = 'Укажите логин.';
    return;
  }

  const payload = {
    name: el('userName').value.trim(),
    email: el('userEmail').value.trim(),
    role: el('userRole').value,
  };
  const password = el('userPassword').value;

  if (!editId) {
    payload.username = username;
    payload.password = password;
  } else if (password) {
    payload.password = password;
  }

  statusEl.textContent = 'Сохранение...';

  try {
    const res = await apiFetch(editId ? `${API}users/${editId}` : API + 'users', {
      method: editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = 'Ошибка: ' + (data.error || res.statusText);
      return;
    }

    resetUserForm();
    await loadUsers();
  } catch (err) {
    statusEl.textContent = 'Ошибка: ' + err.message;
  }
}

el('saveUserBtn').addEventListener('click', saveUser);
el('cancelUserEditBtn').addEventListener('click', resetUserForm);


/* ==================== Общие помощники кабинета ==================== */

let authState = null; // ответ /api/auth/status

async function apiJson(url, options = {}) {
  const res = await apiFetch(url, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || res.statusText);
    error.status = res.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('ru-RU') : '—';
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function formatMoney(value) {
  return value == null ? 'по договору' : new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

const SUBSCRIPTION_LABELS = {
  trial: 'Пробный период',
  active: 'Подписка активна',
  grace: 'Оплата просрочена',
  expired: 'Подписка закончилась',
};

/* ==================== Разделы ==================== */

function tabAllowed(link) {
  if (!authState || !authState.user) return false;
  if (link.hasAttribute('data-platform-admin')) return authState.user.platformAdmin;
  if (link.hasAttribute('data-company') && !authState.user.companyId) return false;
  const perm = link.getAttribute('data-perm');
  return !perm || hasPerm(perm);
}

function availableTabs() {
  return Array.from(document.querySelectorAll('#tabs a')).filter(tabAllowed).map((a) => a.dataset.tab);
}

const TAB_LOADERS = {
  projects: () => loadProjectCards(),
  crosscheck: () => loadProjects(),
  suppliers: () => { resetSupplierForm(); return loadSuppliers(); },
  team: () => { populateRoleSelect(); renderRolesList(); resetUserForm(); return loadUsers(); },
  billing: () => loadBilling(),
  platform: () => loadPlatform(),
};

async function showTab() {
  const tabs = availableTabs();
  let tab = location.hash.replace('#', '');
  if (!tabs.includes(tab)) tab = tabs[0];
  if (!tab) return;
  document.querySelectorAll('#tabs a').forEach((a) => {
    a.hidden = !tabAllowed(a);
    a.classList.toggle('active', a.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== `tab-${tab}`;
  });
  try {
    await TAB_LOADERS[tab]();
  } catch (err) {
    const panel = el(`tab-${tab}`);
    const note = document.createElement('p');
    note.className = 'auth-error';
    note.textContent = 'Не удалось загрузить раздел: ' + err.message;
    panel.appendChild(note);
  }
}

window.addEventListener('hashchange', showTab);

/* ==================== Шапка и подписка ==================== */

function renderHeader() {
  const user = authState.user;
  const roleInfo = ROLES_LIST.find((r) => r.id === user.role);
  const label = user.platformAdmin ? 'Администратор сервиса' : roleInfo ? roleInfo.name : user.role;
  el('currentUserInfo').innerHTML = `${escapeHtml(user.name)} <span class="role-badge">${escapeHtml(label)}</span>`;
  el('companyName').textContent = authState.company ? authState.company.name : '';

  const sub = authState.subscription;
  const chip = el('subscriptionChip');
  const banner = el('subscriptionBanner');
  if (!sub) {
    chip.hidden = true;
    banner.hidden = true;
    return;
  }
  chip.hidden = false;
  chip.className = `sub-chip sub-${sub.status}`;
  chip.textContent = sub.status === 'expired'
    ? SUBSCRIPTION_LABELS.expired
    : `${sub.status === 'trial' ? 'Пробный период' : sub.plan.name}: ${sub.daysLeft} ${plural(sub.daysLeft, 'день', 'дня', 'дней')}`;

  const billingLink = hasPerm('billing.view') ? ' <a href="#billing">Перейти к оплате</a>' : ' Обратитесь к администратору компании.';
  if (sub.status === 'expired') {
    banner.hidden = false;
    banner.className = 'banner banner-bad';
    banner.innerHTML = 'Подписка закончилась: все данные сохранены и доступны для просмотра и выгрузки, но изменения недоступны.' + billingLink;
  } else if (sub.status === 'grace' || sub.daysLeft <= 3) {
    banner.hidden = false;
    banner.className = 'banner banner-warn';
    banner.innerHTML = (sub.status === 'grace'
      ? `Оплата просрочена — доступ сохранится ещё ${sub.daysLeft} ${plural(sub.daysLeft, 'день', 'дня', 'дней')}.`
      : `${sub.status === 'trial' ? 'Пробный период' : 'Оплаченный период'} заканчивается через ${sub.daysLeft} ${plural(sub.daysLeft, 'день', 'дня', 'дней')}.`) + billingLink;
  } else {
    banner.hidden = true;
  }
}

function applyPermissions() {
  el('newProjectBtn').hidden = !hasPerm('projects.manage');
  el('supplierFormBox').hidden = !hasPerm('suppliers.manage');
}

/* ==================== Проекты ==================== */

async function loadProjectCards() {
  const list = el('projectsList');
  const [data] = await Promise.all([apiJson(API + 'projects'), loadDisciplines()]);
  if (!data.projects.length) {
    list.innerHTML = hasPerm('projects.manage')
      ? '<div class="empty">Проектов пока нет. Создайте первый — например, «Дорога Р-256, участок 12» — и загрузите в рабочее место документы проекта.</div>'
      : '<div class="empty">Проектов пока нет. Их создаёт руководитель проекта или инженер ПТО.</div>';
    return;
  }
  const canManage = hasPerm('projects.manage');
  const canDelete = authState.user.role === 'admin' || authState.user.role === 'director';
  list.innerHTML = data.projects.map((p) => `
    <article class="card project-card" data-id="${escapeHtml(p.id)}">
      <h3>${escapeHtml(p.name)}</h3>
      <p class="hint">Создан ${formatDate(p.createdAt)} · изменён ${formatDateTime(p.lastUpdatedAt)}${p.versionsCount ? ` · сверок ГПР/ВОР: ${p.versionsCount}` : ''}</p>
      <div class="discipline-chips">${disciplineChipsHtml(p.disciplines)}</div>
      <div class="actions">
        <a class="button" href="../workspace/?project=${encodeURIComponent(p.id)}">Открыть рабочее место</a>
        <button type="button" class="secondary small" data-action="history">История изменений</button>
        ${canManage ? '<button type="button" class="secondary small" data-action="disciplines">Виды работ</button>' : ''}
        ${canManage ? '<button type="button" class="secondary small" data-action="rename">Переименовать</button>' : ''}
        ${canDelete ? '<button type="button" class="danger small" data-action="delete">Удалить</button>' : ''}
      </div>
      <div class="project-history" hidden></div>
    </article>`).join('');

  list.querySelectorAll('.project-card').forEach((card) => {
    const project = data.projects.find((p) => p.id === card.dataset.id);
    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => projectAction(btn.dataset.action, project, card).catch((err) => alert(err.message)));
    });
  });
}

async function projectAction(action, project, card) {
  if (action === 'disciplines') {
    const chosen = await openDisciplineDialog({
      title: `Виды работ: ${project.name}`,
      selected: project.disciplines && project.disciplines.length ? project.disciplines : ['road'],
      saveLabel: 'Сохранить',
    });
    if (!chosen) return;
    await apiJson(`${API}projects/${project.id}`, { method: 'PUT', body: JSON.stringify({ disciplines: chosen.disciplines }) });
    await loadProjectCards();
  } else if (action === 'rename') {
    const name = prompt('Новое название проекта:', project.name);
    if (!name) return;
    await apiJson(`${API}projects/${project.id}`, { method: 'PUT', body: JSON.stringify({ name }) });
    await loadProjectCards();
  } else if (action === 'delete') {
    if (!confirm(`Удалить проект «${project.name}» со всеми документами, сверками и историей? Это нельзя отменить.`)) return;
    await apiJson(`${API}projects/${project.id}`, { method: 'DELETE' });
    await loadProjectCards();
  } else if (action === 'history') {
    const box = card.querySelector('.project-history');
    if (!box.hidden) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.textContent = 'Загрузка…';
    const data = await apiJson(`${API}projects/${project.id}/workspace/history`);
    if (!data.history.length) {
      box.innerHTML = '<p class="hint">Сохранённых предыдущих состояний рабочего места пока нет.</p>';
      return;
    }
    const canRestore = hasPerm('workspace.edit') && authState.subscription && authState.subscription.writable;
    box.innerHTML = '<p class="hint">Рабочее место сохраняется при каждом изменении; последние состояния можно восстановить.</p>' +
      data.history.map((h) => `
        <div class="history-row">
          <span>Версия ${h.version} · ${formatDateTime(h.updatedAt)}${h.updatedBy ? ' · ' + escapeHtml(h.updatedBy) : ''}</span>
          ${canRestore ? `<button type="button" class="secondary small" data-version="${h.version}">Восстановить</button>` : ''}
        </div>`).join('');
    box.querySelectorAll('[data-version]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Восстановить состояние версии ${btn.dataset.version}? Текущее состояние тоже останется в истории.`)) return;
        await apiJson(`${API}projects/${project.id}/workspace/restore`, { method: 'POST', body: JSON.stringify({ version: Number(btn.dataset.version) }) });
        box.hidden = true;
        alert('Состояние восстановлено. Откройте рабочее место, чтобы продолжить.');
        await loadProjectCards();
      });
    });
  }
}

el('newProjectBtn').addEventListener('click', async () => {
  const chosen = await openDisciplineDialog({ title: 'Новый проект', name: '', selected: [], saveLabel: 'Создать' });
  if (!chosen) return;
  try {
    const project = await apiJson(API + 'projects', { method: 'POST', body: JSON.stringify(chosen) });
    location.href = `../workspace/?project=${encodeURIComponent(project.id)}`;
  } catch (err) {
    alert(err.message);
  }
});

/* ==================== Роли (подсказка в «Команде») ==================== */

const PERMISSION_LABELS = {
  'projects.manage': 'создаёт проекты и сверки',
  'workspace.edit': 'работает в рабочем месте',
  'suppliers.manage': 'ведёт поставщиков',
  'users.manage': 'управляет командой',
  'billing.manage': 'оплачивает подписку',
};

function renderRolesList() {
  el('rolesList').innerHTML = ROLES_LIST.map((r) => {
    const can = (r.permissions || []).map((p) => PERMISSION_LABELS[p]).filter(Boolean);
    return `<div class="role-item"><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(can.length ? can.join(', ') : 'только просмотр')}</span></div>`;
  }).join('');
}

/* ==================== Тариф и оплата ==================== */

let billingState = null;

async function loadBilling() {
  const params = new URLSearchParams(location.search);
  const paidInvoice = params.get('paid');
  if (paidInvoice) {
    history.replaceState(null, '', location.pathname + location.hash);
    billingState = await apiJson(`${API}billing/invoices/${encodeURIComponent(paidInvoice)}/check-payment`, { method: 'POST', body: '{}' });
    await refreshAuth();
    renderHeader();
  } else {
    billingState = await apiJson(API + 'billing');
  }
  renderBilling();
}

function renderBilling() {
  const b = billingState;
  const sub = b.subscription;
  const canManage = hasPerm('billing.manage');
  const usersMax = sub.plan.maxUsers == null ? '∞' : sub.plan.maxUsers;
  const projectsMax = sub.plan.maxProjects == null ? '∞' : sub.plan.maxProjects;

  const statusHtml = `
    <div class="card billing-card">
      <div class="billing-line"><span>Тариф</span><strong>${escapeHtml(sub.plan.name)}</strong></div>
      <div class="billing-line"><span>Состояние</span><strong class="sub-${sub.status}-text">${SUBSCRIPTION_LABELS[sub.status]}</strong></div>
      <div class="billing-line"><span>${sub.status === 'trial' ? 'Пробный период до' : 'Оплачено до'}</span><strong>${formatDate(sub.status === 'trial' ? sub.trialEndsAt : sub.paidUntil)}</strong></div>
      <div class="billing-line"><span>Сотрудники</span><strong>${b.usage.users} из ${usersMax}</strong></div>
      <div class="billing-line"><span>Проекты</span><strong>${b.usage.projects} из ${projectsMax}</strong></div>
    </div>`;

  const periodOptions = b.periods.map((p) => `<option value="${p.months}">${p.months} ${plural(p.months, 'месяц', 'месяца', 'месяцев')}${p.discountPercent ? ` (скидка ${p.discountPercent}%)` : ''}</option>`).join('');
  const plansHtml = `
    <h3>Тарифы</h3>
    <div class="plan-grid">
      ${b.plans.filter((p) => p.id !== 'trial').map((p) => `
        <div class="card plan-card${p.id === sub.plan.id ? ' current' : ''}">
          <h4>${escapeHtml(p.name)}${p.id === sub.plan.id ? ' <span class="badge ok">ваш тариф</span>' : ''}</h4>
          <p class="plan-price">${p.monthlyPrice ? formatMoney(p.monthlyPrice) + ' <small>в месяц</small>' : 'по договору'}</p>
          <p class="hint">${escapeHtml(p.description)}</p>
          <p class="hint">Сотрудников: ${p.maxUsers == null ? 'без ограничений' : 'до ' + p.maxUsers} · проектов: ${p.maxProjects == null ? 'без ограничений' : 'до ' + p.maxProjects}</p>
          ${p.selfService && canManage
            ? `<div class="plan-buy"><select data-period-for="${p.id}">${periodOptions}</select>
                <span class="plan-total" data-total-for="${p.id}"></span>
                <button type="button" data-invoice-for="${p.id}">Выставить счёт</button></div>`
            : !p.selfService ? `<p class="hint">Напишите нам${b.contact.email ? `: <a href="mailto:${escapeHtml(b.contact.email)}">${escapeHtml(b.contact.email)}</a>` : ''}</p>` : ''}
        </div>`).join('')}
    </div>
    ${!b.invoicingReady ? '<p class="disclaimer">Выставление счетов на этом сервере ещё не настроено — пока счёт пришлёт менеджер BuildMind.</p>' : ''}`;

  const r = b.requisites || {};
  const reqHtml = canManage ? `
    <h3>Реквизиты для счёта</h3>
    <div class="upload-box">
      <div class="supplier-field-row">
        <div class="supplier-field"><label>Наименование организации</label><input id="reqLegalName" value="${escapeHtml(r.legalName)}" placeholder="ООО «Дорстрой»"></div>
        <div class="supplier-field"><label>ИНН</label><input id="reqInn" value="${escapeHtml(r.inn)}" inputmode="numeric"></div>
      </div>
      <div class="supplier-field-row">
        <div class="supplier-field"><label>КПП</label><input id="reqKpp" value="${escapeHtml(r.kpp)}" inputmode="numeric"></div>
        <div class="supplier-field"><label>ОГРН / ОГРНИП</label><input id="reqOgrn" value="${escapeHtml(r.ogrn)}" inputmode="numeric"></div>
      </div>
      <div class="supplier-field"><label>Юридический адрес</label><input id="reqAddress" value="${escapeHtml(r.address)}"></div>
      <div class="supplier-field-row">
        <div class="supplier-field"><label>Email для счетов и чеков</label><input id="reqEmail" value="${escapeHtml(r.email)}" type="email"></div>
        <div class="supplier-field"><label>Контактное лицо и телефон</label><input id="reqContact" value="${escapeHtml(r.contactName)}"></div>
      </div>
      <div class="actions"><button type="button" id="saveRequisitesBtn">Сохранить реквизиты</button><span id="requisitesStatus" class="hint"></span></div>
    </div>` : '';

  const invoicesHtml = `
    <h3>Счета</h3>
    ${b.invoices.length ? `<table class="simple-table"><thead><tr><th>№</th><th>Дата</th><th>Тариф</th><th>Сумма</th><th>Статус</th><th></th></tr></thead><tbody>
      ${b.invoices.map((inv) => `<tr>
        <td>${escapeHtml(inv.number)}</td>
        <td>${formatDate(inv.createdAt)}</td>
        <td>${escapeHtml((b.plans.find((p) => p.id === inv.planId) || {}).name || inv.planId)}, ${inv.months} мес.</td>
        <td>${formatMoney(inv.amount)}</td>
        <td>${inv.status === 'paid' ? `<span class="badge ok">оплачен ${formatDate(inv.paidAt)}</span>` : inv.status === 'cancelled' ? '<span class="badge">отменён</span>' : '<span class="badge warn">ожидает оплаты</span>'}</td>
        <td class="row-actions">
          <a href="${API}billing/invoices/${inv.id}/print" target="_blank" rel="noopener">Счёт</a>
          ${inv.status === 'issued' && b.cardPaymentsEnabled && canManage ? `<button type="button" class="small" data-pay="${inv.id}">Оплатить картой</button>` : ''}
        </td></tr>`).join('')}
    </tbody></table>` : '<p class="hint">Счетов пока нет.</p>'}
    <p class="hint">Оплата по счёту поступает в течение 1–3 рабочих дней; после поступления подписка продлевается автоматически.</p>`;

  el('billingContent').innerHTML = statusHtml + plansHtml + reqHtml + invoicesHtml;

  document.querySelectorAll('[data-period-for]').forEach((select) => {
    const planId = select.dataset.periodFor;
    const update = () => {
      const period = b.periods.find((p) => p.months === Number(select.value));
      el('billingContent').querySelector(`[data-total-for="${planId}"]`).textContent = `итого ${formatMoney(period.prices[planId])}`;
    };
    select.addEventListener('change', update);
    update();
  });
  document.querySelectorAll('[data-invoice-for]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.invoiceFor;
      const months = Number(document.querySelector(`[data-period-for="${planId}"]`).value);
      try {
        const invoice = await apiJson(API + 'billing/invoices', { method: 'POST', body: JSON.stringify({ planId, months }) });
        window.open(`${API}billing/invoices/${invoice.id}/print`, '_blank', 'noopener');
        await loadBilling();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll('[data-pay]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const payment = await apiJson(`${API}billing/invoices/${btn.dataset.pay}/pay-card`, { method: 'POST', body: '{}' });
        location.href = payment.confirmationUrl;
      } catch (err) {
        btn.disabled = false;
        alert(err.message);
      }
    });
  });
  const saveReq = el('saveRequisitesBtn');
  if (saveReq) {
    saveReq.addEventListener('click', async () => {
      const payload = {
        legalName: el('reqLegalName').value, inn: el('reqInn').value.trim(), kpp: el('reqKpp').value.trim(),
        ogrn: el('reqOgrn').value.trim(), address: el('reqAddress').value, email: el('reqEmail').value.trim(),
        contactName: el('reqContact').value,
      };
      try {
        billingState = await apiJson(API + 'billing/requisites', { method: 'PUT', body: JSON.stringify(payload) });
        renderBilling();
        el('requisitesStatus').textContent = 'Сохранено.';
      } catch (err) {
        el('requisitesStatus').textContent = 'Ошибка: ' + err.message;
      }
    });
  }
}

/* ==================== Администрирование сервиса ==================== */

let platformState = null;

async function loadPlatform() {
  platformState = await apiJson(API + 'admin/overview');
  renderPlatform();
}

function renderPlatform() {
  const d = platformState;
  const planOptions = (selected) => d.plans.map((p) => `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
  const toDateInput = (iso) => (iso ? iso.slice(0, 10) : '');
  const settings = `<p class="hint">Счета: ${d.invoicingReady ? 'настроены' : '<b>не настроены</b> (задайте BUILDMIND_SELLER_* в .env)'} · оплата картой: ${d.cardPaymentsEnabled ? 'подключена' : 'не подключена'}</p>`;

  const companiesHtml = `<h3>Компании (${d.companies.length})</h3>
    <div class="table-scroll"><table class="simple-table"><thead><tr><th>Компания</th><th>Создана</th><th>Состояние</th><th>Сотр. / проекты</th><th>Тариф</th><th>Пробный до</th><th>Оплачено до</th><th></th></tr></thead><tbody>
    ${d.companies.map((c) => `<tr data-company="${c.id}">
      <td><strong>${escapeHtml(c.name)}</strong>${c.requisites.inn ? `<br><small>ИНН ${escapeHtml(c.requisites.inn)}</small>` : ''}</td>
      <td>${formatDate(c.createdAt)}</td>
      <td><span class="badge ${c.subscription.status === 'expired' ? 'bad' : c.subscription.status === 'grace' ? 'warn' : 'ok'}">${SUBSCRIPTION_LABELS[c.subscription.status]}</span></td>
      <td>${c.usage.users} / ${c.usage.projects}</td>
      <td><select data-field="plan">${planOptions(c.subscription.plan.id)}</select></td>
      <td><input type="date" data-field="trialEndsAt" value="${toDateInput(c.subscription.trialEndsAt)}"></td>
      <td><input type="date" data-field="paidUntil" value="${toDateInput(c.subscription.paidUntil)}"></td>
      <td><button type="button" class="small" data-save-company>Сохранить</button></td>
    </tr>`).join('')}</tbody></table></div>`;

  const companyName = (id) => (d.companies.find((c) => c.id === id) || {}).name || id;
  const invoicesHtml = `<h3>Счета</h3>${d.invoices.length ? `<div class="table-scroll"><table class="simple-table"><thead><tr><th>№</th><th>Компания</th><th>Сумма</th><th>Статус</th><th></th></tr></thead><tbody>
    ${d.invoices.map((inv) => `<tr>
      <td>${escapeHtml(inv.number)}<br><small>${formatDate(inv.createdAt)}</small></td>
      <td>${escapeHtml(companyName(inv.companyId))}</td>
      <td>${formatMoney(inv.amount)}, ${inv.months} мес.</td>
      <td>${inv.status === 'paid' ? `<span class="badge ok">оплачен ${formatDate(inv.paidAt)}${inv.paidVia === 'card' ? ' картой' : ''}</span>` : inv.status === 'cancelled' ? '<span class="badge">отменён</span>' : '<span class="badge warn">ожидает</span>'}</td>
      <td class="row-actions"><a href="${API}admin/invoices/${inv.id}/print" target="_blank" rel="noopener">Счёт</a>
        ${inv.status === 'issued' ? `<button type="button" class="small" data-mark-paid="${inv.id}">Оплата получена</button>
        <button type="button" class="secondary small" data-cancel="${inv.id}">Отменить</button>` : ''}</td>
    </tr>`).join('')}</tbody></table></div>` : '<p class="hint">Счетов нет.</p>'}`;

  const leadsHtml = `<h3>Заявки с сайта (${d.leads.length})</h3>${d.leads.length ? d.leads.map((l) => `
    <div class="card lead-card"><strong>${escapeHtml(l.name)}</strong>${l.company ? ' · ' + escapeHtml(l.company) : ''} · ${escapeHtml(l.contact)}
      <span class="hint"> · ${formatDateTime(l.createdAt)}</span>${l.message ? `<p>${escapeHtml(l.message)}</p>` : ''}</div>`).join('') : '<p class="hint">Заявок нет.</p>'}`;

  el('platformContent').innerHTML = settings + companiesHtml + invoicesHtml + leadsHtml;

  el('platformContent').querySelectorAll('[data-save-company]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const value = (f) => row.querySelector(`[data-field="${f}"]`).value;
      try {
        await apiJson(`${API}admin/companies/${row.dataset.company}/subscription`, {
          method: 'PUT',
          body: JSON.stringify({ plan: value('plan'), trialEndsAt: value('trialEndsAt') || null, paidUntil: value('paidUntil') ? value('paidUntil') + 'T23:59:59' : null }),
        });
        await loadPlatform();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  el('platformContent').querySelectorAll('[data-mark-paid]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Деньги по этому счёту поступили на расчётный счёт? Подписка компании будет продлена.')) return;
      await apiJson(`${API}admin/invoices/${btn.dataset.markPaid}/mark-paid`, { method: 'POST', body: '{}' }).catch((err) => alert(err.message));
      await loadPlatform();
    });
  });
  el('platformContent').querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Отменить счёт?')) return;
      await apiJson(`${API}admin/invoices/${btn.dataset.cancel}/cancel`, { method: 'POST', body: '{}' }).catch((err) => alert(err.message));
      await loadPlatform();
    });
  });
}

/* ==================== Вход, регистрация, выход ==================== */

function nextAfterLogin() {
  const next = new URLSearchParams(location.search).get('next');
  // Возвращаем только на рабочее место этого же сервиса.
  return next && /^\.\.\/workspace\/\?project=[a-z0-9-]+$/.test(next) ? next : null;
}

async function refreshAuth() {
  const res = await fetch(API + 'auth/status');
  authState = await res.json();
  ROLES_LIST = authState.roles || [];
  currentUser = authState.user;
  return authState;
}

function showAuth(mode) {
  el('loginForm').hidden = mode !== 'login';
  el('signupForm').hidden = mode !== 'signup';
}

async function checkAuthStatus() {
  try {
    await refreshAuth();
  } catch (err) {
    el('authLoadingHint').textContent = 'Не удалось связаться с сервером: ' + err.message;
    return;
  }
  el('authLoadingHint').hidden = true;

  if (currentUser) {
    const next = nextAfterLogin();
    if (next) {
      location.href = next;
      return;
    }
    el('authOverlay').style.display = 'none';
    el('appRoot').hidden = false;
    renderHeader();
    applyPermissions();
    await showTab();
    return;
  }

  el('appRoot').hidden = true;
  el('authOverlay').style.display = 'flex';
  el('toSignupWrap').hidden = !authState.allowSignup;
  showAuth(location.hash === '#signup' && authState.allowSignup ? 'signup' : 'login');
}

async function submitAuth(url, payload, errorEl) {
  errorEl.textContent = '';
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Не получилось.';
      return false;
    }
    if (location.hash === '#signup') history.replaceState(null, '', location.pathname + location.search + '#projects');
    await checkAuthStatus();
    return true;
  } catch (err) {
    errorEl.textContent = 'Ошибка: ' + err.message;
    return false;
  }
}

el('loginSubmitBtn').addEventListener('click', async () => {
  const ok = await submitAuth(API + 'auth/login', { username: el('loginUsername').value.trim(), password: el('loginPassword').value }, el('loginError'));
  if (ok) el('loginPassword').value = '';
});

el('signupSubmitBtn').addEventListener('click', () => submitAuth(API + 'auth/signup', {
  companyName: el('signupCompany').value.trim(),
  name: el('signupName').value.trim(),
  email: el('signupEmail').value.trim(),
  username: el('signupUsername').value.trim(),
  password: el('signupPassword').value,
  consent: el('signupConsent').checked,
}, el('signupError')));

el('toSignup').addEventListener('click', (e) => { e.preventDefault(); showAuth('signup'); });
el('toLogin').addEventListener('click', (e) => { e.preventDefault(); showAuth('login'); });
el('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('loginSubmitBtn').click(); });
el('signupPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('signupSubmitBtn').click(); });

el('logoutBtn').addEventListener('click', async () => {
  await fetch(API + 'auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  currentUser = null;
  await checkAuthStatus();
});

el('changePasswordBtn').addEventListener('click', () => {
  el('currentPassword').value = '';
  el('newPassword').value = '';
  el('passwordError').textContent = '';
  el('passwordDialog').showModal();
});

el('savePasswordBtn').addEventListener('click', async () => {
  try {
    await apiJson(API + 'auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: el('currentPassword').value, newPassword: el('newPassword').value }) });
    el('passwordDialog').close();
    alert('Пароль изменён. Другие устройства выйдут из кабинета.');
  } catch (err) {
    el('passwordError').textContent = err.message;
  }
});

checkAuthStatus();

/* ==================== Виды работ ==================== */

// var, а не let: состояние читают функции, которые могут вызваться до этой строки.
var DISCIPLINES = null;
var crosscheckSelection = ['road'];
var crosscheckProjectDisciplines = null;

async function loadDisciplines() {
  if (!DISCIPLINES) DISCIPLINES = (await apiJson(API + 'disciplines')).disciplines;
  return DISCIPLINES;
}

function disciplineById(id) {
  return (DISCIPLINES || []).find((d) => d.id === id) || null;
}

function disciplineChipsHtml(ids) {
  const list = (ids && ids.length ? ids : ['road']).map(disciplineById).filter(Boolean);
  return list
    .map((d) => `<span class="discipline-chip"><span class="mono" style="background:${escapeHtml(d.color)}">${escapeHtml(d.monogram)}</span>${escapeHtml(d.shortName)}</span>`)
    .join('');
}

function disciplineTileHtml(d, pressed) {
  return `<button type="button" class="discipline-tile" data-id="${escapeHtml(d.id)}" aria-pressed="${pressed}">
      <span class="mono" style="background:${escapeHtml(d.color)}">${escapeHtml(d.monogram)}</span>
      <span class="text"><b>${escapeHtml(d.name)}</b><small>${escapeHtml(d.description)}</small></span>
    </button>`;
}

// Диалог выбора видов работ: name === undefined — без поля названия.
async function openDisciplineDialog({ title, name, selected, saveLabel }) {
  const all = await loadDisciplines();
  const dialog = el('disciplineDialog');
  const draft = new Set(selected || []);
  const withName = name !== undefined;
  el('disciplineDialogTitle').textContent = title;
  el('disciplineNameField').hidden = !withName;
  el('disciplineProjectName').value = name || '';
  el('disciplineError').textContent = '';
  el('disciplineSaveBtn').textContent = saveLabel || 'Сохранить';
  const tiles = el('disciplineTiles');
  tiles.innerHTML = all.map((d) => disciplineTileHtml(d, draft.has(d.id))).join('');
  tiles.querySelectorAll('.discipline-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.id;
      if (draft.has(id)) draft.delete(id);
      else draft.add(id);
      tile.setAttribute('aria-pressed', String(draft.has(id)));
    });
  });
  return new Promise((resolve) => {
    const save = el('disciplineSaveBtn');
    const onSave = () => {
      const projectName = el('disciplineProjectName').value.trim();
      if (withName && !projectName) {
        el('disciplineError').textContent = 'Укажите название проекта.';
        return;
      }
      if (!draft.size) {
        el('disciplineError').textContent = 'Выберите хотя бы один вид работ.';
        return;
      }
      const ordered = all.map((d) => d.id).filter((id) => draft.has(id));
      cleanup();
      dialog.close();
      resolve(withName ? { name: projectName, disciplines: ordered } : { disciplines: ordered });
    };
    const onClose = () => {
      cleanup();
      resolve(null);
    };
    function cleanup() {
      save.removeEventListener('click', onSave);
      dialog.removeEventListener('close', onClose);
    }
    save.addEventListener('click', onSave);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    if (withName) el('disciplineProjectName').focus();
  });
}

// Виды работ в быстрой сверке: у проекта — его собственные, без проекта — выбор пользователя.
async function renderCrosscheckDisciplines() {
  const all = await loadDisciplines();
  const box = el('crosscheckDisciplines');
  const fromProject = Array.isArray(crosscheckProjectDisciplines);
  el('crosscheckDisciplinesHint').textContent = fromProject
    ? 'Виды работ проекта (меняются в карточке проекта):'
    : 'Виды работ для распознавания — отметьте нужные:';
  const active = fromProject ? crosscheckProjectDisciplines : crosscheckSelection;
  box.innerHTML = all
    .map((d) => `<button type="button" class="discipline-toggle" data-id="${escapeHtml(d.id)}" aria-pressed="${active.includes(d.id)}" ${fromProject ? 'disabled' : ''}>
        <span class="mono" style="background:${escapeHtml(d.color)}">${escapeHtml(d.monogram)}</span>${escapeHtml(d.shortName)}</button>`)
    .join('');
  if (fromProject) return;
  box.querySelectorAll('.discipline-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.id;
      const next = crosscheckSelection.includes(id) ? crosscheckSelection.filter((x) => x !== id) : [...crosscheckSelection, id];
      if (!next.length) return;
      crosscheckSelection = next;
      button.setAttribute('aria-pressed', String(next.includes(id)));
    });
  });
}

function renderAgents(agents) {
  const wrap = el('agentsWrap');
  const list = el('agentsList');
  if (!agents || !agents.length) {
    wrap.hidden = true;
    list.innerHTML = '';
    return;
  }
  wrap.hidden = false;
  const items = (values, format) => (values && values.length
    ? `<ul>${values.map((v) => `<li>${format(v)}</li>`).join('')}</ul>`
    : '<p class="hint">—</p>');
  list.innerHTML = agents.map((a) => `
    <article class="agent-card">
      <h3>${escapeHtml(a.agentName)}</h3>
      <p class="hint">${escapeHtml(a.agentRole)}${a.outsideSelection ? ' · вид работ не выбран в проекте' : ''}</p>
      ${a.findings.length
        ? a.findings.map((f) => `<div class="agent-finding">${escapeHtml(f.message)}</div>`).join('')
        : '<p class="agent-ok">Замечаний по комплектности нет.</p>'}
      <details>
        <summary>Акты скрытых работ (${a.hiddenWorksActs.length}) и исполнительная документация</summary>
        ${items(a.hiddenWorksActs, (x) => `${escapeHtml(x.act)} <span class="hint">— ${escapeHtml(x.workName)}</span>`)}
        <b>Исполнительная документация</b>
        ${items(a.executiveDocs, (x) => escapeHtml(x))}
      </details>
      <details>
        <summary>Нормативная база (${a.normatives.length})</summary>
        ${items(a.normatives, (n) => `${escapeHtml(n.code)} «${escapeHtml(n.title)}»`)}
      </details>
    </article>`).join('');
}
