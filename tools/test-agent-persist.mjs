import { chromium } from 'playwright-core';
const BASE = process.argv[2] || 'http://localhost:4600/showcase/skyseal-agent/';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
// 1) persistence across a full browser-context restart (same storage)
const dir = 'C:/BuildMind/showcase/tools/.profile-agent';
const out = {};
for (const round of [1, 2]) {
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await ctx.newPage();
  await page.goto(BASE + 'tower');
  await page.waitForSelector('.skyseal-demo-overlay', { state: 'detached', timeout: 120000 });
  if (round === 1) {
    await page.click('text=Войти в диспетчерскую');
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2uWQAAAAASUVORK5CYII=';
      const base = location.pathname.replace(/tower\/?$/, '');
      const up = async (n) => (await (await fetch(base + 'api/client/uploads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: n, mime_type: 'image/png', data_base64: PNG }) })).json()).id;
      const p = await up('a.png'), q = await up('b.png');
      await fetch(base + 'api/client/shipments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ delivery_mode: 'door_to_door', tariff: 'standard', origin: { country: 'RU', city: 'Москва', address: 'Склад' }, destination: { country: 'TJ', city: 'Душанбе', address: 'Аэропорт' }, cargo: { name: 'Тест', description: 'Сухой', pieces: 1, weight_kg: 50, length_cm: 50, width_cm: 40, height_cm: 30, declared_value: 1000, declared_currency: 'RUB', features: '' }, client_name: 'Тест Тест', client_phone: '+79990000000', client_email: '', product_photo_ids: [p], packaging_photo_ids: [q] }) });
    });
    await page.waitForTimeout(2500); // agents + IndexedDB sync
  }
  out['round' + round] = await page.evaluate(async () => {
    const base = location.pathname.replace(/tower\/?$/, '');
    const r = await fetch(base + 'api/operator/shipments');
    return { status: r.status, count: r.ok ? (await r.json()).length : null };
  });
  await ctx.close();
}
// 2) dedicated Worker fallback (no SharedWorker, like Chrome on Android)
const ctx = await browser.newContext();
await ctx.addInitScript(() => { delete window.SharedWorker; });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(BASE);
await page.waitForSelector('.skyseal-demo-overlay', { state: 'detached', timeout: 120000 });
out.fallbackBootMs = Date.now() - t0;
out.fallbackHealth = await page.evaluate(async () => (await fetch(location.pathname + 'api/health')).status);
await browser.close();
console.log(JSON.stringify(out, null, 2));
