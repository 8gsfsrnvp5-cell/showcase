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
    .map((m) => `<li>${m.name}${m.unit ? ' (' + m.unit + ')' : ''}</li>`)
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
        <strong>${row.workName}</strong>
        ${row.categoryName ? `<div style="color:var(--muted);font-size:11px">${row.categoryName}</div>` : ''}
        ${
          row.gprSourceNames && row.gprSourceNames.length
            ? `<div style="color:var(--muted);font-size:11px">ГПР: ${row.gprSourceNames.join('; ')}</div>`
            : ''
        }
        ${
          row.vorSourceNames && row.vorSourceNames.length
            ? `<div style="color:var(--muted);font-size:11px">ВОР: ${row.vorSourceNames.join('; ')}</div>`
            : ''
        }
      </td>
      <td><span class="badge ${statusInfo.badge}">${statusInfo.label}</span></td>
      <td>${row.gprQuantity ?? '—'}</td>
      <td>${row.vorQuantity ?? '—'}</td>
      <td>${confidenceLabel}</td>
      <td>${renderMaterials(row.requiredMaterials)}</td>
      <td style="max-width:220px">${row.note || ''}</td>
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

      const reportUrl = `api/projects/${projectId}/versions/${v.id}/report`;

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
  const res = await apiFetch('api/projects');
  const data = await res.json();

  const currentValue = selectAfterId || select.value;
  select.innerHTML = '<option value="">— без сохранения (разовая проверка) —</option>';

  data.projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (версий: ${p.versionsCount})`;
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
    renderHistory(null);
    return;
  }

  const res = await apiFetch(`api/projects/${projectId}`);
  const data = await res.json();
  hint.textContent = `Создан: ${new Date(data.createdAt).toLocaleDateString('ru-RU')}`;
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

    const endpoint = projectId ? `api/projects/${projectId}/versions` : 'api/crosscheck';
    const response = await apiFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gpr, vor }),
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

el('newProjectBtn').addEventListener('click', async () => {
  const name = prompt('Название нового проекта (например, «Дорога Р-256, участок 12»):');
  if (!name) return;

  const res = await apiFetch('api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const project = await res.json();
  await loadProjects(project.id);
});

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
      await apiFetch(`api/suppliers/${supplierId}`, { method: 'DELETE' });
      await loadSuppliers();
    });
  });
}

async function loadSuppliers() {
  const res = await apiFetch('api/suppliers');
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
    const res = await apiFetch(editId ? `api/suppliers/${editId}` : 'api/suppliers', {
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
            <strong>${escapeHtml(u.name)}</strong> (${escapeHtml(u.username)})
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
        const res = await apiFetch(`api/users/${userId}`, { method: 'DELETE' });
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
  const res = await apiFetch('api/users');
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
    const res = await apiFetch(editId ? `api/users/${editId}` : 'api/users', {
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

el('manageUsersBtn').addEventListener('click', async () => {
  const wrap = el('usersWrap');
  wrap.hidden = !wrap.hidden;
  if (!wrap.hidden) {
    populateRoleSelect();
    resetUserForm();
    await loadUsers();
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

/* ==================== Вход и первый запуск (RBAC) ==================== */

function applyPermissions() {
  el('newProjectBtn').hidden = !hasPerm('projects.manage');
  el('supplierFormBox').hidden = !hasPerm('suppliers.manage');
  el('manageUsersBtn').hidden = !hasPerm('users.manage');
  if (!hasPerm('users.manage')) {
    el('usersWrap').hidden = true;
  }
}

function renderUserBar() {
  const roleInfo = ROLES_LIST.find((r) => r.id === currentUser.role);
  const label = roleInfo ? roleInfo.name : currentUser.role;
  el('currentUserInfo').innerHTML = `${escapeHtml(currentUser.name)} <span class="role-badge">${escapeHtml(label)}</span>`;
}

async function initAppData() {
  resetSupplierForm();
  await loadSuppliers();
  await loadProjects();
}

async function checkAuthStatus() {
  let data;
  try {
    const res = await fetch('api/auth/status');
    data = await res.json();
  } catch (err) {
    el('authLoadingHint').textContent = 'Не удалось связаться с сервером: ' + err.message;
    return;
  }

  ROLES_LIST = data.roles || [];
  currentUser = data.user;

  el('authLoadingHint').hidden = true;

  if (currentUser) {
    el('authOverlay').style.display = 'none';
    el('appRoot').hidden = false;
    renderUserBar();
    applyPermissions();
    await initAppData();
    return;
  }

  el('appRoot').hidden = true;
  el('authOverlay').style.display = 'flex';

  if (!data.hasUsers) {
    el('bootstrapForm').hidden = false;
    el('loginForm').hidden = true;
  } else {
    el('bootstrapForm').hidden = true;
    el('loginForm').hidden = false;
  }
}

el('bootstrapSubmitBtn').addEventListener('click', async () => {
  const errEl = el('bootstrapError');
  errEl.textContent = '';

  const payload = {
    username: el('bootstrapUsername').value.trim(),
    password: el('bootstrapPassword').value,
    name: el('bootstrapName').value.trim(),
  };

  try {
    const res = await fetch('api/auth/bootstrap-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Не удалось создать администратора.';
      return;
    }
    await checkAuthStatus();
  } catch (err) {
    errEl.textContent = 'Ошибка: ' + err.message;
  }
});

el('loginSubmitBtn').addEventListener('click', async () => {
  const errEl = el('loginError');
  errEl.textContent = '';

  const payload = {
    username: el('loginUsername').value.trim(),
    password: el('loginPassword').value,
  };

  try {
    const res = await fetch('api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Не удалось войти.';
      return;
    }
    el('loginPassword').value = '';
    await checkAuthStatus();
  } catch (err) {
    errEl.textContent = 'Ошибка: ' + err.message;
  }
});

// Enter в полях пароля отправляет форму — привычнее, чем искать кнопку мышью
el('bootstrapPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el('bootstrapSubmitBtn').click();
});
el('loginPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el('loginSubmitBtn').click();
});

el('logoutBtn').addEventListener('click', async () => {
  await fetch('api/auth/logout', { method: 'POST' });
  currentUser = null;
  el('usersWrap').hidden = true;
  await checkAuthStatus();
});

checkAuthStatus();
