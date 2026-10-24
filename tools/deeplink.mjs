import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto('https://8gsfsrnvp5-cell.github.io/showcase/skyseal-cargo/tower/finance?x=1#h');
await page.getByText('Финансы').first().waitFor({ timeout: 20000 });
console.log(JSON.stringify({ url: page.url(), h2: await page.locator('h2').first().textContent(), sw: await page.evaluate(() => !!navigator.serviceWorker.controller) }));
await browser.close();
