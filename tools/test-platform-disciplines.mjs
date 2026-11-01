// BuildMind Platform demo: виды работ и профильные агенты — с сервис-воркером
// и без него (режим встроенных браузеров).
//   node tools/test-platform-disciplines.mjs [base] [sw|nosw]
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4600/showcase/buildmind-platform/';
const MODE = process.argv[3] || 'sw';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: MODE === 'sw' ? 'allow' : 'block' });
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
const out = { mode: MODE };

// Лендинг: виды работ подгружаются из API встроенного сервера.
await page.goto(BASE);
await page.waitForFunction(() => document.querySelectorAll('#disciplineTiles .disc').length > 0, null, { timeout: 30000 });
out.landingTiles = await page.$$eval('#disciplineTiles .disc', (els) => els.length);

// Кабинет: вход и проекты с видами работ.
await page.goto(BASE + 'app/');
await page.waitForSelector('#loginUsername', { state: 'visible', timeout: 30000 });
await page.fill('#loginUsername', 'admin');
await page.fill('#loginPassword', 'demo2026');
await page.click('#loginSubmitBtn');
await page.waitForSelector('.project-card', { timeout: 20000 });
out.projects = await page.$$eval('.project-card', (cards) => cards.map((c) => ({
  name: c.querySelector('h3').textContent,
  chips: [...c.querySelectorAll('.discipline-chip')].map((x) => x.textContent.trim()),
})));

// Рабочее место проекта с несколькими видами работ.
const house = page.locator('.project-card', { hasText: 'Жилой дом' });
await house.locator('a', { hasText: 'Открыть рабочее место' }).click();
await page.waitForFunction(() => window.BuildMindDisciplineWorkspace && document.querySelector('.bm-sync-bar'), null, { timeout: 60000 });
out.workspace = await page.evaluate(() => ({
  url: location.pathname + location.search,
  selected: window.BuildMindDisciplineWorkspace.selected,
  works: window.BuildMindRoadKnowledge.works.length,
  match: window.BuildMindWorkMatcher.find('Армирование стен').matchedWork?.id || null,
  bar: document.querySelector('.bm-sync-bar').innerText.replace(/\s+/g, ' ').slice(0, 160),
  agents: window.BuildMindAgentOrchestrator.list().filter((a) => a.id.startsWith('discipline')).length,
}));
await page.click('.bm-disc-btn');
await page.waitForSelector('.bm-disc-tile');
out.panelTiles = await page.$$eval('.bm-disc-tile[aria-pressed="true"] b', (els) => els.map((e) => e.textContent));
await page.screenshot({ path: `platform-disciplines-${MODE}.png` });
await page.keyboard.press('Escape');

// Сохранение рабочего места доходит до встроенного сервера.
await page.evaluate(() => localStorage.setItem('buildmind-demo-probe-v1', 'ok'));
await page.waitForFunction(() => /Сохранено|сохранены/.test(document.querySelector('.bm-sync-status').textContent), null, { timeout: 15000 });
out.saved = await page.evaluate(async () => {
  const r = await fetch(new URL('../api/projects/' + window.BUILDMIND_WORKSPACE.project.id + '/workspace', location.href));
  const data = await r.json();
  return { version: data.version, probe: data.keys['buildmind-demo-probe-v1'] || null };
});

// Отчёт по сверке проекта: агенты и нормативы.
await page.goto(BASE + 'app/#crosscheck');
await page.waitForFunction(() => document.querySelectorAll('#projectSelect option').length > 2, null, { timeout: 20000 });
const houseOption = await page.$eval('#projectSelect', (s) => [...s.options].find((o) => o.textContent.includes('Жилой дом')).value);
await page.selectOption('#projectSelect', houseOption);
await page.waitForTimeout(800);
out.crosscheckChips = await page.$$eval('#crosscheckDisciplines .discipline-toggle[aria-pressed="true"]', (els) => els.map((e) => e.textContent.trim()));
const reportLink = page.locator('a', { hasText: 'отчёт' }).first();
const [popup] = await Promise.all([page.waitForEvent('popup'), reportLink.click()]);
await popup.waitForLoadState();
await popup.waitForTimeout(500);
const reportText = await popup.evaluate(() => document.body.innerText);
out.report = {
  agents: ['Агент «Монолит»', 'Агент «Земляные работы»', 'Агент «Кладка»'].filter((a) => reportText.includes(a)),
  hasNormative: reportText.includes('СП 70.13330.2012'),
  hasFinding: /Нет ухода за бетоном|вывоза излишков грунта/.test(reportText),
};

// Сводка «проект — ВОР — ГПР»: сводка для заказчика и материалы.
const summaryLink = page.locator('#historyList a', { hasText: 'сводка для заказчика' }).first();
const [summaryPopup] = await Promise.all([page.waitForEvent('popup'), summaryLink.click()]);
await summaryPopup.waitForLoadState();
await summaryPopup.waitForTimeout(500);
const summaryText = await summaryPopup.evaluate(() => document.body.innerText);
out.customerSummary = {
  title: summaryText.includes('Сводка по документам объекта'),
  missingMaterials: (summaryText.match(/Материалы, не учтённые в проекте \((\d+)\)/) || [])[1] || null,
  reinforcementMissingInVor: /Армирование монолитных конструкций[\s\S]{0,120}Нет в ВОР/.test(summaryText),
};
await page.click('#demoBtn');
await page.selectOption('#projectSelect', '');
await page.click('#runBtn');
await page.waitForSelector('#materialsWrap:not([hidden])', { timeout: 20000 });
out.demoSummary = {
  stats: (await page.innerText('#summary')).replace(/\s+/g, ' '),
  missingMaterials: await page.$$eval('#materialsMissing .material-alert', (els) => els.length),
  projectColumn: await page.$$eval('#resultsBody tr', (trs) => trs.filter((tr) => tr.children[2].textContent.trim() !== '—').length),
};

// Исправления аудита: полная выгрузка проекта и большая ведомость во встроенном сервере.
out.export = await page.evaluate(async () => {
  const api = new URL('../api/', location.href);
  const { projects } = await (await fetch(new URL('projects', api))).json();
  const house = projects.find((p) => p.name.includes('Жилой дом'));
  const data = await (await fetch(new URL(`projects/${house.id}/export`, api))).json();
  return { format: data.format, versions: data.versions.length, hasWorkspace: !!data.workspace };
});
out.bigCrosscheck = await page.evaluate(async () => {
  const names = ['Армирование стен', 'Бетонирование стен', 'Устройство опалубки стен', 'Разработка грунта в котловане'];
  const lines = ['Наименование работ,Объем,Ед.изм'];
  for (let i = 0; i < 5000; i++) lines.push(`${names[(i + 1) % names.length]} участок ${Math.floor(i / names.length)},${10 + (i % 50)},м3`);
  const t0 = performance.now();
  const r = await fetch(new URL('../api/crosscheck', location.href), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gpr: lines.join('\n'), vor: lines.join('\n'), disciplines: ['earthworks', 'monolith'] }),
  });
  const data = await r.json();
  return { status: r.status, ms: Math.round(performance.now() - t0), results: data.results && data.results.length, violations: data.sequencing && data.sequencing.violations.length };
});

// Этапы 2–4 на объекте «Жилой дом»: исполнительная, люди и сроки, чертежи.
const pickHouse = async (selectId) => {
  await page.waitForFunction((id) => document.querySelectorAll(`#${id} option`).length > 1, selectId, { timeout: 20000 });
  const value = await page.$eval(`#${selectId}`, (s) => [...s.options].find((o) => o.textContent.includes('Жилой дом')).value);
  await page.selectOption(`#${selectId}`, value);
  await page.waitForTimeout(1500);
};
await page.goto(BASE + 'app/#executive');
await pickHouse('execProjectSelect');
out.executive = {
  summary: (await page.innerText('#execSummary')).replace(/\s+/g, ' '),
  acts: await page.$$eval('#execActs a', (a) => a.map((x) => x.textContent)),
  works: await page.$$eval('#execWorks .exec-work', (w) => w.length),
};
await page.goto(BASE + 'app/#schedule');
await pickHouse('schedProjectSelect');
out.schedule = {
  summary: (await page.innerText('#schedSummary')).replace(/\s+/g, ' '),
  bars: await page.$$eval('#schedChart rect', (r) => r.length),
  recommendations: await page.$$eval('.sched-rec', (r) => r.length),
};
await page.goto(BASE + 'app/#drawings');
await pickHouse('drwProjectSelect');
out.drawings = {
  sheets: await page.$$eval('#drwSvg [data-sheet]', (g) => g.length),
  fills: await page.$$eval('#drwSvg [data-zone] polygon', (p) => p.map((x) => x.getAttribute('fill'))),
  images: await page.$$eval('#drwSvg image', (imgs) => Promise.all(imgs.map((i) => fetch(i.getAttribute('href')).then((r) => `${r.status} ${r.headers.get('content-type')}`)))),
};
await page.screenshot({ path: `platform-drawings-${MODE}.png` });

out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
