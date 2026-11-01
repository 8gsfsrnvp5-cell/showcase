import { chromium } from 'playwright-core';
const L = process.argv[2] || 'https://8gsfsrnvp5-cell.github.io/showcase/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const out = {};
for (const [slug, code] of [['kopilka-lite/', '111111'], ['kopilka/', '222222']]) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(L + slug);
  await page.waitForSelector('input', { timeout: 15000 });
  await page.locator('input').first().fill(code);
  await page.locator('button[type="submit"], button:has-text("Войти")').first().click();
  await page.waitForTimeout(2500);
  out[slug] = { text: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300), errors };
  await page.screenshot({ path: slug.replace('/', '') + '.png' });
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
