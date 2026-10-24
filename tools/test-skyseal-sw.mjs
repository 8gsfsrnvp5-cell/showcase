// Drives the SkySeal demo in headless Chrome: service-worker backend, client
// order with demo photos, and live update in a second tab (Control Tower).
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4600/showcase/skyseal-cargo/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
ctx.on('weberror', e => errors.push('weberror: ' + e.error().message));
ctx.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
const client = await ctx.newPage();
client.on('console', m => { if (m.type() === 'error' || m.text().includes('[demo]')) errors.push('client console: ' + m.text()); });
await client.goto(BASE);
await client.waitForSelector('text=Новая заявка', { timeout: 20000 });
const controlled = await client.evaluate(() => !!navigator.serviceWorker.controller);

const tower = await ctx.newPage();
tower.on('console', m => { if (m.type() === 'error') errors.push('tower console: ' + m.text()); });
await tower.goto(BASE + 'tower/orders');
await tower.waitForSelector('text=Заказы', { timeout: 20000 });
const ordersBefore = await tower.locator('table tbody tr').count();

const field = (label, n = 0) => client.locator('label', { hasText: label }).nth(n).locator('input, textarea').first();
await field('Название').fill('Оборудование для насосной станции');
await field('Вес, кг').fill('250');
await field('Длина, см').fill('120');
await field('Ширина').fill('100');
await field('Высота').fill('90');
await field('Ваше имя').fill('Партнёр');
await field('Телефон').fill('+992 90 000 00 00');
await client.click('text=Подставить демонстрационные фото');
await client.waitForSelector('text=Загружено: 1', { timeout: 15000 });
await client.click('text=Создать заявку');
await client.waitForSelector('text=Стоимость перевозки', { timeout: 40000 });
const ref = (await client.getByText(/SS-\d{8}-\d{4}/).first().textContent()).trim();

// Tower should see the new order without reload (realtime via service worker).
await tower.waitForFunction(n => document.querySelectorAll('table tbody tr').length > n, ordersBefore, { timeout: 20000 });
const towerRow = await tower.locator('table tbody tr', { hasText: ref }).first().innerText();
await tower.locator('table tbody tr', { hasText: ref }).first().locator('a').click();
await tower.waitForSelector('img', { timeout: 15000 });
await tower.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 15000 });
const imgs = await tower.locator('img').evaluateAll(els => els.map(e => ({ src: e.getAttribute('src'), ok: e.complete && e.naturalWidth > 0 })));
const imgProbe = await tower.evaluate(async (src) => {
  const r = await fetch(src); const b = await r.blob();
  const viaImg = await new Promise(res => { const i = new Image(); i.onload = () => res('load ' + i.naturalWidth); i.onerror = () => res('error'); i.src = src; });
  return { status: r.status, type: r.headers.get('content-type'), size: b.size, viaImg };
}, imgs[0]?.src);
console.log('imgProbe', JSON.stringify(imgProbe));
await tower.screenshot({ path: 'skyseal-tower-order.png', fullPage: false });
await client.screenshot({ path: 'skyseal-client.png' });

// Deep link reload of a tower route (served by the worker).
await tower.reload();
await tower.waitForSelector('text=' + ref, { timeout: 15000 });

console.log(JSON.stringify({ controlled, ref, towerRow, imgs, errors }, null, 2));
await browser.close();
