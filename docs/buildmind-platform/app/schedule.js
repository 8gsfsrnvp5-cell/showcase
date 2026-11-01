'use strict';

/*
  Кабинет: вкладка «Люди и сроки» — потребность в людях и технике под ГПР,
  загрузка по дням, рекомендации агента (перерывы, простои, ранний старт,
  отставание) и своя выработка компании. Расчёт — на сервере (server/schedule.js).

  Подключается после app.js и пользуется его общими функциями.
*/

const SCHED_STATUS = {
  ok: { label: 'Успевает', badge: 'ok' },
  'more-crews': { label: 'Нужно больше бригад', badge: 'warn' },
  unrealistic: { label: 'Срок нереален', badge: 'bad' },
  'no-dates': { label: 'Нет дат в ГПР', badge: 'muted' },
  'no-norm': { label: 'Нет выработки', badge: 'muted' },
};
const SCHED_SEVERITY = { bad: 'Важно', warn: 'Внимание', info: 'Можно улучшить' };
const SCHED_PROJECT_KEY = 'buildmind-sched-project';

let schedState = null;
let schedProjectId = '';

function schedRu(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}` : '—';
}

async function loadSchedule() {
  const res = await apiFetch(API + 'projects');
  const { projects } = await res.json();
  const select = el('schedProjectSelect');
  if (!projects.length) {
    el('schedEmpty').hidden = false;
    el('schedEmpty').textContent = 'Создайте проект и загрузите сводку с ГПР — расчёт строится по ней.';
    el('schedBody').hidden = true;
    select.innerHTML = '';
    return;
  }
  let saved = '';
  try { saved = localStorage.getItem(SCHED_PROJECT_KEY) || ''; } catch { /* без хранилища — первый проект */ }
  const current = schedProjectId || saved;
  select.innerHTML = projects.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  select.value = projects.some((p) => p.id === current) ? current : projects[0].id;
  schedProjectId = select.value;
  await refreshSchedule();
}

async function refreshSchedule() {
  const res = await apiFetch(`${API}projects/${schedProjectId}/schedule`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  schedState = data;
  renderSchedule();
}

function renderSchedule() {
  const s = schedState;
  const empty = !s.projectVersionId;
  el('schedEmpty').hidden = !empty;
  el('schedEmpty').textContent = 'В проекте ещё нет сводки — загрузите проект, ВОР и ГПР во вкладке «Сводка документов».';
  el('schedBody').hidden = empty;
  if (empty) return;

  el('schedHeadcount').value = s.settings.headcount || '';
  el('schedWorkDays').value = String(s.settings.workDaysPerWeek);
  el('schedShifts').value = String(s.settings.shiftsPerDay);
  el('schedSettings').querySelectorAll('input, select, button').forEach((x) => { x.disabled = !s.canEdit; });

  const stats = [
    [s.peak ? s.peak.people : '—', s.peak ? `чел. в пик (${schedRu(s.peak.date)})` : 'пик людей', s.settings.headcount && s.peak && s.peak.people > s.settings.headcount ? 'var(--bad)' : ''],
    [s.summary.needMoreCrews, 'работ требуют больше одной бригады', s.summary.needMoreCrews ? 'var(--warn)' : 'var(--ok)'],
    [s.summary.breakViolations, 'нарушений техперерывов', s.summary.breakViolations ? 'var(--bad)' : 'var(--ok)'],
    [s.summary.idlePeriods + s.summary.overloadPeriods, 'периодов простоя или нехватки', s.summary.idlePeriods + s.summary.overloadPeriods ? 'var(--warn)' : 'var(--ok)'],
    [s.summary.lagging, 'работ отстают по журналу', s.summary.lagging ? 'var(--bad)' : 'var(--ok)'],
  ];
  el('schedSummary').innerHTML = stats.map(([n, label, color]) => `<div class="stat"><div class="num"${color ? ` style="color:${color}"` : ''}>${escapeHtml(n)}</div><div class="label">${escapeHtml(label)}</div></div>`).join('');
  el('schedNoDates').hidden = s.hasDates;
  el('schedDisclaimer').textContent = '⚠️ ' + s.disclaimer;

  renderScheduleChart();
  el('schedRecommendations').innerHTML = s.recommendations.length
    ? s.recommendations.map((r) => `
      <div class="sched-rec sev-${escapeHtml(r.severity)}">
        <div class="title"><span class="badge ${r.severity === 'info' ? 'ok' : r.severity}">${escapeHtml(SCHED_SEVERITY[r.severity] || r.severity)}</span> ${escapeHtml(r.title)}</div>
        <div>${escapeHtml(r.text)}</div>
      </div>`).join('')
    : '<p class="hint">Замечаний нет: бригады успевают, перерывов и простоев не найдено.</p>';
  renderScheduleWorks();
}

// Загрузка по дням: столбик — сколько людей нужно, линия — сколько есть на объекте.
function renderScheduleChart() {
  const s = schedState;
  const wrap = el('schedChartWrap');
  wrap.hidden = !s.load.length;
  if (!s.load.length) return;
  const headcount = s.settings.headcount || 0;
  const max = Math.max(headcount, ...s.load.map((d) => d.people), 1);
  const w = 900;
  const h = 220;
  const pad = { l: 34, r: 8, t: 10, b: 28 };
  const bw = (w - pad.l - pad.r) / s.load.length;
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const bars = s.load.map((d, i) => {
    const cls = headcount && d.people > headcount ? 'over' : headcount && d.people < headcount * 0.5 ? 'idle' : 'ok';
    const x = pad.l + i * bw;
    return `<rect class="${cls}" x="${x.toFixed(1)}" y="${y(d.people).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${(h - pad.b - y(d.people)).toFixed(1)}"><title>${schedRu(d.date)}: ${d.people} чел.</title></rect>`;
  }).join('');
  const step = Math.max(1, Math.ceil(s.load.length / 10));
  const labels = s.load.map((d, i) => (i % step === 0 ? `<text x="${(pad.l + i * bw + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle">${schedRu(d.date)}</text>` : '')).join('');
  const ticks = [0, Math.round(max / 2), max].map((v) => `<text x="${pad.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text><line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" />`).join('');
  const line = headcount ? `<line class="headcount" x1="${pad.l}" x2="${w - pad.r}" y1="${y(headcount).toFixed(1)}" y2="${y(headcount).toFixed(1)}" />` : '';
  el('schedChart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Потребность в людях по дням">${ticks}${bars}${line}${labels}</svg>`;
}

function renderScheduleWorks() {
  const s = schedState;
  el('schedWorks').innerHTML = s.works.map((w) => {
    const info = SCHED_STATUS[w.status] || { label: w.status, badge: 'warn' };
    const own = w.outputSource === 'company';
    const outputCell = s.canEdit
      ? `<span class="sched-norm"><input type="number" step="any" min="0" value="${escapeHtml(w.output ?? '')}" data-norm="${escapeHtml(w.workId)}" data-unit="${escapeHtml(w.unit)}" /> ${escapeHtml(w.unit)}</span>
         <div class="hint">${own ? 'своя норма компании' : w.output ? 'ориентир BuildMind' : 'задайте выработку'}</div>`
      : `${escapeHtml(w.output ?? '—')} ${escapeHtml(w.unit)}<div class="hint">${own ? 'своя норма' : 'ориентир'}</div>`;
    const progress = w.done ? `<div class="hint">по журналу: ${escapeHtml(w.done)} ${escapeHtml(w.unit)}${w.forecastEnd ? `, прогноз окончания ${schedRu(w.forecastEnd)}` : ''}</div>` : '';
    return `
      <tr class="sched-${escapeHtml(w.status)}">
        <td><strong>${escapeHtml(w.workName)}</strong>${w.disciplineName ? `<div class="hint">${escapeHtml(w.disciplineName)}</div>` : ''}</td>
        <td class="qty">${escapeHtml(w.quantity ?? '—')} ${escapeHtml(w.unit)}<div class="hint">${escapeHtml(w.quantitySource)}</div>${progress}</td>
        <td>${outputCell}</td>
        <td>${escapeHtml(w.crewSize)} чел.<div class="hint">${escapeHtml(w.crewRoles.join(', '))}</div></td>
        <td class="qty">${escapeHtml(w.crewsNeeded ?? '—')} / ${escapeHtml(w.people ?? '—')}</td>
        <td>${w.equipment.length ? `<ul class="materials-list">${w.equipment.map((e) => `<li>${escapeHtml(e.name)} ×${escapeHtml(e.count)}</li>`).join('')}</ul>` : '<span class="hint">—</span>'}</td>
        <td class="qty">${w.start ? `${schedRu(w.start)}–${schedRu(w.end)}<div class="hint">${escapeHtml(w.gprDays)} раб. дн.</div>` : '—'}${w.breakDays ? `<div class="hint">перерыв ${escapeHtml(w.breakDays)} сут</div>` : ''}</td>
        <td><span class="badge ${info.badge}">${escapeHtml(info.label)}</span><div class="small-note">${escapeHtml(w.note)}</div></td>
      </tr>`;
  }).join('') || '<tr><td colspan="8" class="hint">В сводке нет распознанных работ.</td></tr>';

  el('schedWorks').querySelectorAll('[data-norm]').forEach((input) => input.addEventListener('change', async () => {
    el('schedStatus').textContent = 'Сохраняю норму…';
    try {
      const res = await apiFetch(`${API}norms/${encodeURIComponent(input.dataset.norm)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: input.value, unit: input.dataset.unit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      await refreshSchedule();
      el('schedStatus').textContent = input.value ? 'Норма компании сохранена — пересчитано.' : 'Возвращён ориентир BuildMind.';
    } catch (err) {
      el('schedStatus').textContent = 'Ошибка: ' + err.message;
    }
  }));
}

async function submitScheduleSettings(event) {
  event.preventDefault();
  el('schedStatus').textContent = 'Пересчитываю…';
  try {
    const res = await apiFetch(`${API}projects/${schedProjectId}/schedule/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headcount: el('schedHeadcount').value, workDaysPerWeek: el('schedWorkDays').value, shiftsPerDay: el('schedShifts').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    await refreshSchedule();
    el('schedStatus').textContent = 'Пересчитано.';
  } catch (err) {
    el('schedStatus').textContent = 'Ошибка: ' + err.message;
  }
}

el('schedSettings').addEventListener('submit', submitScheduleSettings);
el('schedProjectSelect').addEventListener('change', async () => {
  schedProjectId = el('schedProjectSelect').value;
  try { localStorage.setItem(SCHED_PROJECT_KEY, schedProjectId); } catch { /* не запоминаем */ }
  await refreshSchedule();
});

TAB_LOADERS.schedule = () => loadSchedule();
