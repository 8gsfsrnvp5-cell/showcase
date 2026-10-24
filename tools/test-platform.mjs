// BuildMind Platform demo: login, seeded project history, crosscheck, report.
import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:4600/showcase/buildmind-platform/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE);
await page.waitForSelector('#loginUsername, #loginForm input', { timeout: 20000 });
const inputs = await page.$$eval('input', els => els.filter(e => e.offsetParent).map(e => e.id));
await page.fill('#loginUsername', 'admin');
await page.fill('#loginPassword', 'demo2026');
const t0 = Date.now();
await page.click('#loginSubmitBtn');
await page.waitForSelector('#projectSelect', { state: 'visible', timeout: 20000 });
const loginMs = Date.now() - t0;
await page.waitForFunction(() => document.querySelectorAll('#projectSelect option').length > 1, null, { timeout: 10000 });
const projects = await page.$$eval('#projectSelect option', os => os.map(o => o.textContent));
await page.selectOption('#projectSelect', { index: 1 });
await page.waitForTimeout(800);
const history = await page.locator('#history, #historyList, .history').first().innerText().catch(() => '');
await page.click('#demoBtn');
await page.selectOption('#projectSelect', { index: 0 });
await page.click('#runBtn');
await page.waitForTimeout(1500);
const status = await page.locator('#status').innerText();
const resultsText = await page.locator('#resultsTable').first().innerText().catch(() => '');
// report link opens through the service worker
await page.selectOption('#projectSelect', { index: 1 });
await page.waitForTimeout(800);
const reportHref = await page.locator('a', { hasText: 'отчёт' }).first().getAttribute('href').catch(() => null);
let reportTitle = null;
if (reportHref) {
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('a', { hasText: 'отчёт' }).first().click()]);
  await popup.waitForLoadState();
  reportTitle = await popup.title();
}
// session survives a reload
await page.reload();
await page.waitForSelector('#projectSelect', { state: 'visible', timeout: 20000 });
await page.screenshot({ path: 'platform.png' });
console.log(JSON.stringify({ sw: await page.evaluate(() => !!navigator.serviceWorker.controller), inputs, loginMs, projects, history: history.slice(0, 300), status, results: resultsText.slice(0, 300), reportHref, reportTitle, errors }, null, 2));
await browser.close();
