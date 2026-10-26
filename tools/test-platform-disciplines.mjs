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

out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
