import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:4600/showcase/yoftam/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE);
await page.waitForURL(/\/ru\/$/);
const out = { home: (await page.locator('main').innerText()).slice(0, 150) };
const navs = await page.locator('header nav a').allInnerTexts();
out.nav = navs;
for (const label of navs.slice(1)) {
  await page.click(`header nav a:text-is("${label}")`);
  await page.waitForLoadState('networkidle');
  out[label] = { url: page.url().replace(BASE, ''), h1: await page.locator('h1').first().innerText().catch(() => '') };
}
await page.goto(BASE + 'ru/avatar/');
await page.screenshot({ path: 'yoftam-avatar.png', fullPage: true });
await page.goto(BASE + 'tg/');
out.tg = (await page.locator('main').innerText()).slice(0, 100);
out.errors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
