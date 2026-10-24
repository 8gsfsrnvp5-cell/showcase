import { chromium } from 'playwright-core';
const BASE = 'http://localhost:4600/showcase/skyseal-agent/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
ctx.on('serviceworker', w => logs.push('sw: ' + w.url()));
await page.goto(BASE + (process.argv[2] ?? 'tower'));
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => ({ overlay: document.querySelector('.skyseal-demo-overlay .msg')?.textContent ?? null, title: document.querySelector('.skyseal-demo-overlay b')?.textContent ?? null, body: document.body.innerText.slice(0, 120) }));
  if (i % 4 === 0 || !s.overlay) console.log(i, JSON.stringify(s));
  if (!s.overlay) break;
}
await page.screenshot({ path: 'agent-debug.png' });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
