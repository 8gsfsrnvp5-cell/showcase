'use strict';

/*
  Кабинет: вкладка «Чертежи» — склейка листов проекта и раскраска участков
  по ходу работ (server/drawings.js).

  Поле — SVG в координатах склейки: листы — картинки со сдвигом, поворотом
  и масштабом, участки — многоугольники. Колесо мыши — масштаб, перетаскивание
  пустого места — сдвиг поля. Режимы: просмотр (клик по участку — карточка),
  склейка (перетаскивание листа, прозрачность, поворот, масштаб) и обводка
  участка (клики по точкам, двойной клик или «Замкнуть» — готово).

  PDF переводится в картинки в браузере (pdf.js из рабочего места), на
  сервер уходят только картинки листов. Подключается после app.js.
*/

const DRW_STATUS = {
  done: { label: 'Выполнено', color: '#16a34a' },
  progress: { label: 'В работе', color: '#86efac' },
  next: { label: 'Следующий этап', color: '#facc15' },
  critical: { label: 'Критично', color: '#dc2626' },
  planned: { label: 'Позже по графику', color: '#94a3b8' },
};
const DRW_MAX_PDF_PAGES = 20;
const DRW_SHEET_MAX_SIDE = 2400;
const DRW_PROJECT_KEY = 'buildmind-drw-project';
const SVG_NS = 'http://www.w3.org/2000/svg';

const drw = {
  projectId: '',
  data: null,
  mode: 'view',
  view: null, // { x, y, w, h } — viewBox поля
  selected: null, // { type: 'sheet' | 'zone', id }
  points: [],
  pendingZone: null,
  saveTimer: null,
};

// Картинки листов, загруженные через fetch: в демо без сервис-воркера
// запрос картинки из SVG идёт мимо встроенного сервера и не находится.
const drwImageCache = new Map();

function sheetImageUrl(id) {
  return drwImageCache.get(id) || drwApi(`/sheets/${encodeURIComponent(id)}/image`);
}

async function loadSheetViaFetch(img) {
  const id = img.dataset.sheetImage;
  if (!drwImageCache.has(id)) {
    const res = await fetch(drwApi(`/sheets/${encodeURIComponent(id)}/image`)).catch(() => null);
    if (!res || !res.ok) return;
    drwImageCache.set(id, URL.createObjectURL(await res.blob()));
  }
  img.setAttribute('href', drwImageCache.get(id));
}

function drwApi(path) {
  return `${API}projects/${drw.projectId}/drawings${path || ''}`;
}

async function drwJson(url, options) {
  const res = await apiFetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function drwSend(method, path, body) {
  return drwJson(drwApi(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function drwRu(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

function drwStatus(textValue) {
  el('drwStatus').textContent = textValue || '';
}

/* --------------------------------- загрузка --------------------------------- */

async function loadDrawings() {
  const { projects } = await drwJson(API + 'projects');
  const select = el('drwProjectSelect');
  if (!el('drwDate').value) el('drwDate').value = new Date().toISOString().slice(0, 10);
  if (!projects.length) {
    select.innerHTML = '';
    drw.data = null;
    el('drwEmpty').hidden = false;
    el('drwEmpty').textContent = 'Создайте проект во вкладке «Проекты».';
    el('drwSvg').innerHTML = '';
    return;
  }
  let saved = '';
  try { saved = localStorage.getItem(DRW_PROJECT_KEY) || ''; } catch { /* без хранилища — первый проект */ }
  const current = drw.projectId || saved;
  select.innerHTML = projects.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  select.value = projects.some((p) => p.id === current) ? current : projects[0].id;
  drw.projectId = select.value;
  await refreshDrawings({ fit: true });
}

async function refreshDrawings({ fit = false } = {}) {
  drw.data = await drwJson(drwApi(`?date=${encodeURIComponent(el('drwDate').value)}`));
  drw.statuses = new Map(drw.data.statuses.map((s) => [s.zoneId, s]));
  el('drwFileLabel').hidden = !drw.data.canEdit;
  document.querySelectorAll('.drw-modes button[data-mode="move"], .drw-modes button[data-mode="draw"]').forEach((b) => { b.hidden = !drw.data.canEdit; });
  if (!drw.data.canEdit && drw.mode !== 'view') setDrwMode('view');
  if (fit || !drw.view) fitDrawings();
  renderDrawings();
}

/* ---------------------------------- поле ---------------------------------- */

function sheetBounds(s) {
  const w = s.width * s.scale;
  const h = s.height * s.scale;
  if (s.rotation % 180 === 0) return { x: s.x, y: s.y, w, h };
  return { x: s.x + (w - h) / 2, y: s.y + (h - w) / 2, w: h, h: w };
}

function fitDrawings() {
  const board = drw.data ? drw.data.board : { sheets: [], zones: [] };
  const boxes = board.sheets.map(sheetBounds);
  board.zones.forEach((z) => z.points.forEach(([x, y]) => boxes.push({ x, y, w: 0, h: 0 })));
  if (!boxes.length) {
    drw.view = { x: 0, y: 0, w: 1600, h: 1000 };
    return;
  }
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.04 + 20;
  drw.view = { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function applyView() {
  const v = drw.view;
  el('drwSvg').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
}

function centroid(points) {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

function renderDrawings() {
  const svg = el('drwSvg');
  const board = drw.data ? drw.data.board : { sheets: [], zones: [] };
  el('drwEmpty').hidden = board.sheets.length > 0;
  el('drwEmpty').textContent = drw.data && drw.data.canEdit
    ? 'Листов пока нет. Добавьте листы плана из PDF проекта — кнопка «+ Листы».'
    : 'Листов пока нет — их добавляет инженер ПТО или РП.';
  applyView();
  const unit = drw.view.w / Math.max(300, el('drwBoard').clientWidth || 900); // ширина 1 экранного пикселя в координатах поля

  const sheets = board.sheets.map((s) => {
    const selected = drw.selected && drw.selected.type === 'sheet' && drw.selected.id === s.id;
    const transform = `translate(${s.x} ${s.y}) scale(${s.scale}) rotate(${s.rotation} ${s.width / 2} ${s.height / 2})`;
    return `<g class="drw-sheet${selected ? ' selected' : ''}" data-sheet="${escapeHtml(s.id)}" transform="${transform}" opacity="${s.opacity}">
      <image href="${sheetImageUrl(s.id)}" data-sheet-image="${escapeHtml(s.id)}" width="${s.width}" height="${s.height}" preserveAspectRatio="none" />
      <rect class="drw-sheet-frame" width="${s.width}" height="${s.height}" vector-effect="non-scaling-stroke" />
    </g>`;
  }).join('');

  const zones = board.zones.map((z) => {
    const st = drw.statuses.get(z.id) || { status: 'planned' };
    const color = (DRW_STATUS[st.status] || DRW_STATUS.planned).color;
    const selected = drw.selected && drw.selected.type === 'zone' && drw.selected.id === z.id;
    const [cx, cy] = centroid(z.points);
    const label = z.label || z.workName;
    return `<g class="drw-zone${selected ? ' selected' : ''}" data-zone="${escapeHtml(z.id)}">
      <polygon points="${z.points.map((p) => p.join(',')).join(' ')}" fill="${color}" fill-opacity="0.45" stroke="${color}" stroke-width="${(selected ? 4 : 2) * unit}" />
      <text x="${cx}" y="${cy}" font-size="${13 * unit}" text-anchor="middle" dominant-baseline="middle" stroke-width="${3 * unit}">${escapeHtml(label.length > 40 ? label.slice(0, 38) + '…' : label)}</text>
    </g>`;
  }).join('');

  const draft = drw.points.length
    ? `<polyline class="drw-draft" points="${drw.points.map((p) => p.join(',')).join(' ')}" stroke-width="${2 * unit}" />` +
      drw.points.map(([x, y]) => `<circle class="drw-draft-point" cx="${x}" cy="${y}" r="${4 * unit}" />`).join('')
    : '';

  svg.innerHTML = `<g>${sheets}</g><g>${zones}</g><g>${draft}</g>`;
  svg.querySelectorAll('image[data-sheet-image]').forEach((img) => img.addEventListener('error', () => loadSheetViaFetch(img), { once: true }));
  svg.dataset.mode = drw.mode;
  renderDrawingsPanel();
}

/* ------------------------------ боковая панель ------------------------------ */

function renderDrawingsPanel() {
  const panel = el('drwPanel');
  const data = drw.data;
  if (!data) { panel.innerHTML = ''; return; }
  const board = data.board;

  if (drw.mode === 'draw') {
    if (drw.pendingZone) {
      const works = data.works;
      panel.innerHTML = `
        <h3>Новый участок</h3>
        <label class="drw-field">Работа
          <select id="drwZoneWork">${works.map((w) => `<option value="${escapeHtml(w.workId)}">${escapeHtml(w.workName)}</option>`).join('')}<option value="">— другая (ввести название) —</option></select>
        </label>
        <label class="drw-field" id="drwZoneWorkNameWrap" ${works.length ? 'hidden' : ''}>Название работы<input type="text" id="drwZoneWorkName" /></label>
        <label class="drw-field">Подпись участка (как в журнале: «Участок 1», «оси 1–4»)<input type="text" id="drwZoneLabel" /></label>
        <label class="drw-field">Объём участка<span class="drw-inline"><input type="number" step="any" id="drwZoneQty" /><input type="text" id="drwZoneUnit" class="unit" placeholder="ед." value="${escapeHtml(works[0] ? works[0].unit : '')}" /></span></label>
        <div class="actions compact">
          <button type="button" class="small" id="drwZoneSave">Сохранить участок</button>
          <button type="button" class="link-btn" id="drwZoneCancel">отмена</button>
        </div>
        <p class="hint">Подпись связывает участок с записями журнала: запись «Участок 1, оси 1–4» окрасит участок с подписью «Участок 1».</p>`;
      el('drwZoneWork').addEventListener('change', () => {
        const w = works.find((x) => x.workId === el('drwZoneWork').value);
        el('drwZoneWorkNameWrap').hidden = Boolean(w);
        if (w) el('drwZoneUnit').value = w.unit || '';
      });
      el('drwZoneSave').addEventListener('click', saveDrawingZone);
      el('drwZoneCancel').addEventListener('click', () => { drw.pendingZone = null; drw.points = []; renderDrawings(); });
      return;
    }
    panel.innerHTML = `
      <h3>Обводка участка</h3>
      <p class="hint">Кликайте по углам участка на плане. Двойной клик или «Замкнуть» — контур готов. Backspace — убрать последнюю точку, Esc — сбросить.</p>
      <p>Точек: <strong>${drw.points.length}</strong></p>
      <div class="actions compact">
        <button type="button" class="small" id="drwClose" ${drw.points.length < 3 ? 'disabled' : ''}>Замкнуть</button>
        <button type="button" class="link-btn" id="drwUndo" ${drw.points.length ? '' : 'disabled'}>убрать точку</button>
      </div>`;
    el('drwClose').addEventListener('click', finishDrawingZone);
    el('drwUndo').addEventListener('click', () => { drw.points.pop(); renderDrawings(); });
    return;
  }

  const sel = drw.selected;
  if (sel && sel.type === 'sheet') {
    const s = board.sheets.find((x) => x.id === sel.id);
    if (s) {
      panel.innerHTML = `
        <h3>${escapeHtml(s.name)}</h3>
        <p class="hint">Перетащите лист, чтобы совместить его с соседним по линии сшивки. Стрелки клавиатуры — точный сдвиг.</p>
        <label class="drw-field">Прозрачность<input type="range" min="0.1" max="1" step="0.05" value="${s.opacity}" id="drwOpacity" /></label>
        <div class="drw-buttons">
          <button type="button" class="secondary small" data-sheet-act="rotate">Повернуть 90°</button>
          <button type="button" class="secondary small" data-sheet-act="smaller">Мельче</button>
          <button type="button" class="secondary small" data-sheet-act="bigger">Крупнее</button>
          <button type="button" class="secondary small" data-sheet-act="back">Под другие</button>
        </div>
        <p class="hint">Масштаб: ${Math.round(s.scale * 100)} %. Если листы одного масштаба, оставьте 100 %.</p>
        <button type="button" class="link-btn" data-sheet-act="delete">удалить лист</button>`;
      el('drwOpacity').addEventListener('input', (e) => { s.opacity = Number(e.target.value); renderDrawingsSheetsOnly(); scheduleLayoutSave(); });
      panel.querySelectorAll('[data-sheet-act]').forEach((b) => b.addEventListener('click', () => sheetAction(s, b.dataset.sheetAct)));
      return;
    }
  }

  if (sel && sel.type === 'zone') {
    const z = board.zones.find((x) => x.id === sel.id);
    if (z) {
      const st = drw.statuses.get(z.id) || { status: 'planned', reason: '' };
      const info = DRW_STATUS[st.status] || DRW_STATUS.planned;
      panel.innerHTML = `
        <h3><i class="drw-dot" style="background:${info.color}"></i>${escapeHtml(z.label || z.workName)}</h3>
        <p><strong>${escapeHtml(info.label)}</strong> — ${escapeHtml(st.reason || '')}</p>
        <p class="hint">Работа: ${escapeHtml(z.workName)}${z.quantity ? ` · объём участка ${escapeHtml(z.quantity)} ${escapeHtml(z.unit)}` : ''}${st.start ? ` · по ГПР ${escapeHtml(drwRu(st.start))} — ${escapeHtml(drwRu(st.end))}` : ''}</p>
        ${data.canEdit ? `<div class="actions compact">
          <button type="button" class="small" id="drwZoneDone">${z.manualStatus === 'done' ? 'Снять отметку «выполнено»' : 'Отметить выполненным'}</button>
          <button type="button" class="link-btn" id="drwZoneDelete">удалить участок</button>
        </div>` : ''}`;
      if (data.canEdit) {
        el('drwZoneDone').addEventListener('click', async () => {
          await drwSend('PUT', `/zones/${z.id}`, { manualStatus: z.manualStatus === 'done' ? null : 'done' }).catch((err) => alert(err.message));
          await refreshDrawings();
        });
        el('drwZoneDelete').addEventListener('click', async () => {
          if (!confirm('Удалить участок?')) return;
          await drwSend('DELETE', `/zones/${z.id}`).catch((err) => alert(err.message));
          drw.selected = null;
          await refreshDrawings();
        });
      }
      return;
    }
  }

  const counts = {};
  data.statuses.forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1; });
  panel.innerHTML = board.zones.length
    ? `<h3>Участки (${board.zones.length})</h3>
       <p class="hint">${Object.entries(counts).map(([k, n]) => `${DRW_STATUS[k].label.toLowerCase()}: ${n}`).join(' · ')}</p>
       <ul class="drw-zone-list">${board.zones.map((z) => {
        const st = drw.statuses.get(z.id) || { status: 'planned' };
        return `<li data-pick-zone="${escapeHtml(z.id)}"><i class="drw-dot" style="background:${DRW_STATUS[st.status].color}"></i>${escapeHtml(z.label || z.workName)}<span class="hint"> — ${escapeHtml(z.workName)}</span></li>`;
      }).join('')}</ul>`
    : `<h3>Участков пока нет</h3><p class="hint">${data.canEdit ? 'Выберите режим «Обвести участок» и кликами обведите участок на плане.' : 'Участки размечает инженер ПТО или РП.'}</p>`;
  panel.querySelectorAll('[data-pick-zone]').forEach((li) => li.addEventListener('click', () => {
    drw.selected = { type: 'zone', id: li.dataset.pickZone };
    const z = board.zones.find((x) => x.id === li.dataset.pickZone);
    const [cx, cy] = centroid(z.points);
    drw.view = { ...drw.view, x: cx - drw.view.w / 2, y: cy - drw.view.h / 2 };
    renderDrawings();
  }));
}

// Перерисовать только листы (прозрачность, перетаскивание) — без панели.
function renderDrawingsSheetsOnly() {
  drw.data.board.sheets.forEach((s) => {
    const g = el('drwSvg').querySelector(`[data-sheet="${CSS.escape(s.id)}"]`);
    if (!g) return;
    g.setAttribute('transform', `translate(${s.x} ${s.y}) scale(${s.scale}) rotate(${s.rotation} ${s.width / 2} ${s.height / 2})`);
    g.setAttribute('opacity', s.opacity);
  });
}

function scheduleLayoutSave() {
  clearTimeout(drw.saveTimer);
  drw.saveTimer = setTimeout(async () => {
    try {
      await drwSend('PUT', '/layout', {
        sheets: drw.data.board.sheets.map(({ id, x, y, scale, rotation, opacity }) => ({ id, x, y, scale, rotation, opacity })),
        order: drw.data.board.sheets.map((s) => s.id),
      });
      drwStatus('Склейка сохранена.');
    } catch (err) {
      drwStatus('Не удалось сохранить склейку: ' + err.message);
    }
  }, 500);
}

async function sheetAction(s, action) {
  if (action === 'delete') {
    if (!confirm(`Удалить лист «${s.name}»?`)) return;
    await drwSend('DELETE', `/sheets/${s.id}`).catch((err) => alert(err.message));
    drw.selected = null;
    await refreshDrawings();
    return;
  }
  if (action === 'rotate') s.rotation = (s.rotation + 90) % 360;
  if (action === 'smaller' || action === 'bigger') {
    const cx = s.x + (s.width * s.scale) / 2;
    const cy = s.y + (s.height * s.scale) / 2;
    s.scale = Math.round(s.scale * (action === 'bigger' ? 1.02 : 1 / 1.02) * 10000) / 10000;
    s.x = cx - (s.width * s.scale) / 2;
    s.y = cy - (s.height * s.scale) / 2;
  }
  if (action === 'back') {
    drw.data.board.sheets = [s, ...drw.data.board.sheets.filter((x) => x !== s)];
  }
  renderDrawings();
  scheduleLayoutSave();
}

/* ----------------------------------- участки ----------------------------------- */

function finishDrawingZone() {
  // Двойной клик добавляет лишние точки в одном месте — убираем их.
  const pts = [];
  drw.points.forEach((p) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > drw.view.w / 400) pts.push(p);
  });
  if (pts.length < 3) {
    drwStatus('Нужно минимум три точки.');
    return;
  }
  drw.points = pts;
  drw.pendingZone = { points: pts };
  renderDrawings();
}

async function saveDrawingZone() {
  const workId = el('drwZoneWork').value;
  try {
    await drwSend('POST', '/zones', {
      workId: workId || undefined,
      workName: workId ? undefined : el('drwZoneWorkName').value,
      label: el('drwZoneLabel').value,
      quantity: el('drwZoneQty').value,
      unit: el('drwZoneUnit').value,
      points: drw.pendingZone.points,
    });
    drw.pendingZone = null;
    drw.points = [];
    drwStatus('Участок сохранён.');
    await refreshDrawings();
  } catch (err) {
    drwStatus('Ошибка: ' + err.message);
  }
}

/* ------------------------------- загрузка листов ------------------------------- */

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(new URL('../workspace/vendor/pdfjs/pdf.min.mjs', location.href).href).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('../workspace/vendor/pdfjs/pdf.worker.min.mjs', location.href).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

function canvasToJpeg(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

async function uploadSheetCanvas(canvas, name) {
  const blob = await canvasToJpeg(canvas);
  await drwSend('POST', '/sheets', {
    name,
    width: canvas.width,
    height: canvas.height,
    image: { contentType: 'image/jpeg', base64: arrayBufferToBase64(await blob.arrayBuffer()) },
  });
}

function whiteCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

async function addDrawingFiles(files) {
  let added = 0;
  try {
    for (const file of files) {
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        drwStatus(`Открываю ${file.name}…`);
        const pdfjs = await loadPdfjs();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
        const pages = Math.min(doc.numPages, DRW_MAX_PDF_PAGES);
        for (let i = 1; i <= pages; i += 1) {
          drwStatus(`${file.name}: лист ${i} из ${pages}…`);
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: DRW_SHEET_MAX_SIDE / Math.max(base.width, base.height) });
          const { canvas, ctx } = whiteCanvas(viewport.width, viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          await uploadSheetCanvas(canvas, `${file.name.replace(/\.pdf$/i, '')} — лист ${i}`);
          added += 1;
        }
        if (doc.numPages > DRW_MAX_PDF_PAGES) drwStatus(`Загружены первые ${DRW_MAX_PDF_PAGES} листов из ${doc.numPages}.`);
      } else if (/^image\/(png|jpeg)$/.test(file.type)) {
        drwStatus(`Загружаю ${file.name}…`);
        const url = URL.createObjectURL(file);
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`не удалось открыть ${file.name}`));
          image.src = url;
        });
        const k = Math.min(1, DRW_SHEET_MAX_SIDE * 1.5 / Math.max(img.naturalWidth, img.naturalHeight));
        const { canvas, ctx } = whiteCanvas(img.naturalWidth * k, img.naturalHeight * k);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        await uploadSheetCanvas(canvas, file.name.replace(/\.(png|jpe?g)$/i, ''));
        added += 1;
      }
    }
    drwStatus(added ? `Добавлено листов: ${added}. Совместите их в режиме «Склейка листов».` : 'Подходят PDF, JPG и PNG.');
  } catch (err) {
    drwStatus('Ошибка: ' + err.message);
  }
  await refreshDrawings({ fit: true });
}

/* -------------------------------- мышь и клавиши -------------------------------- */

function boardPoint(event) {
  const svg = el('drwSvg');
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, p.y];
}

function zoomDrawings(factor, center) {
  const v = drw.view;
  const [cx, cy] = center || [v.x + v.w / 2, v.y + v.h / 2];
  drw.view = { x: cx - (cx - v.x) * factor, y: cy - (cy - v.y) * factor, w: v.w * factor, h: v.h * factor };
  applyView();
  // Толщину линий и подписи пересчитываем, когда колесо остановилось.
  clearTimeout(drw.zoomTimer);
  drw.zoomTimer = setTimeout(renderDrawings, 150);
}

function setDrwMode(mode) {
  drw.mode = mode;
  drw.points = [];
  drw.pendingZone = null;
  if (mode !== 'move' && drw.selected && drw.selected.type === 'sheet') drw.selected = null;
  document.querySelectorAll('.drw-modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  if (drw.data) renderDrawings();
}

(function bindDrawingsBoard() {
  const svg = el('drwSvg');
  let gesture = null;

  svg.addEventListener('pointerdown', (e) => {
    if (!drw.data || e.button > 0) return;
    const sheetEl = e.target.closest('[data-sheet]');
    gesture = {
      target: e.target, // после setPointerCapture события приходят на само поле
      start: [e.clientX, e.clientY],
      startPoint: boardPoint(e),
      view: { ...drw.view },
      sheet: drw.mode === 'move' && drw.data.canEdit && sheetEl ? drw.data.board.sheets.find((s) => s.id === sheetEl.dataset.sheet) : null,
      dragging: false,
    };
    if (gesture.sheet) gesture.origin = { x: gesture.sheet.x, y: gesture.sheet.y };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!gesture) return;
    if (!gesture.dragging && Math.hypot(e.clientX - gesture.start[0], e.clientY - gesture.start[1]) < 4) return;
    gesture.dragging = true;
    if (gesture.sheet) {
      const p = boardPoint(e);
      gesture.sheet.x = gesture.origin.x + (p[0] - gesture.startPoint[0]);
      gesture.sheet.y = gesture.origin.y + (p[1] - gesture.startPoint[1]);
      renderDrawingsSheetsOnly();
    } else {
      // Сдвиг поля: смещение в пикселях переводим в координаты поля.
      const k = gesture.view.w / svg.clientWidth;
      drw.view = { ...gesture.view, x: gesture.view.x - (e.clientX - gesture.start[0]) * k, y: gesture.view.y - (e.clientY - gesture.start[1]) * k };
      applyView();
    }
  });

  svg.addEventListener('pointerup', (e) => {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.dragging) {
      if (g.sheet) {
        drw.selected = { type: 'sheet', id: g.sheet.id };
        renderDrawings();
        scheduleLayoutSave();
      } else {
        renderDrawings();
      }
      return;
    }
    // Клик без перетаскивания.
    if (drw.mode === 'draw') {
      if (drw.pendingZone) return;
      drw.points.push(boardPoint(e).map((v) => Math.round(v * 10) / 10));
      renderDrawings();
      return;
    }
    const zoneEl = g.target.closest('[data-zone]');
    const sheetEl = g.target.closest('[data-sheet]');
    if (drw.mode === 'move' && sheetEl) drw.selected = { type: 'sheet', id: sheetEl.dataset.sheet };
    else if (drw.mode === 'view' && zoneEl) drw.selected = { type: 'zone', id: zoneEl.dataset.zone };
    else drw.selected = null;
    renderDrawings();
  });

  svg.addEventListener('dblclick', (e) => {
    if (drw.mode === 'draw' && !drw.pendingZone) {
      e.preventDefault();
      finishDrawingZone();
    }
  });

  svg.addEventListener('wheel', (e) => {
    if (!drw.data) return;
    e.preventDefault();
    zoomDrawings(e.deltaY > 0 ? 1.15 : 1 / 1.15, boardPoint(e));
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (el('tab-drawings').hidden || !drw.data || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (drw.mode === 'draw' && !drw.pendingZone) {
      if (e.key === 'Escape') { drw.points = []; renderDrawings(); }
      if (e.key === 'Backspace') { e.preventDefault(); drw.points.pop(); renderDrawings(); }
      if (e.key === 'Enter') finishDrawingZone();
    }
    if (drw.mode === 'move' && drw.selected && drw.selected.type === 'sheet') {
      const s = drw.data.board.sheets.find((x) => x.id === drw.selected.id);
      const step = (e.shiftKey ? 10 : 1) * drw.view.w / 1000;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (s && moves[e.key]) {
        e.preventDefault();
        s.x += moves[e.key][0];
        s.y += moves[e.key][1];
        renderDrawingsSheetsOnly();
        scheduleLayoutSave();
      }
    }
  });
})();

document.querySelectorAll('.drw-modes button').forEach((b) => b.addEventListener('click', () => setDrwMode(b.dataset.mode)));
el('drwZoomIn').addEventListener('click', () => drw.data && zoomDrawings(1 / 1.3));
el('drwZoomOut').addEventListener('click', () => drw.data && zoomDrawings(1.3));
el('drwFit').addEventListener('click', () => { if (drw.data) { fitDrawings(); renderDrawings(); } });
el('drwFile').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (files.length) await addDrawingFiles(files);
});
el('drwDate').addEventListener('change', () => refreshDrawings());
el('drwProjectSelect').addEventListener('change', async () => {
  drw.projectId = el('drwProjectSelect').value;
  drw.selected = null;
  try { localStorage.setItem(DRW_PROJECT_KEY, drw.projectId); } catch { /* не запоминаем */ }
  await refreshDrawings({ fit: true });
});

TAB_LOADERS.drawings = () => loadDrawings();
