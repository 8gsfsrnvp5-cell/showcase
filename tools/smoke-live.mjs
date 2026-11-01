// Opens every showcase link in headless Chrome and checks it renders its key
// text without page errors. Usage: node smoke-live.mjs [baseUrl] [--mobile]
import { chromium } from 'playwright-core';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'https://8gsfsrnvp5-cell.github.io/showcase/').replace(/\/?$/, '/');
const mobile = process.argv.includes('--mobile');

const CHECKS = [
  ['', 'Живые демо-версии'],
  ['yobanda/', 'Ёбанда'],
  ['yobanda/show/', 'живой контур'],
  ['yobanda/c/', 'Посчитать'],
  ['yobanda/k/', 'Войти как'],
  ['yobanda/d/', 'диспетчер'],
  ['skyseal-cargo/', 'Новая заявка'],
  ['skyseal-cargo/tower/', 'Панель управления'],
  ['skyseal-cargo/tower/finance', 'Финансы'],
  ['kopilka/', 'Группа «Солнышко»'],
  ['kopilka-lite/', 'Вход в копилку'],
  ['buildmind/', 'BuildMind'],
  ['procurement/', 'BuildMind'],
  ['procurement-v1/', 'BuildMind'],
  ['buildmind-platform/', 'BuildMind'],
  ['buildmind-platform/app/', 'Демо-вход'],
  ['aero-cargo/', 'Войти в командный центр'],
  ['skyseal-agent/', 'Создать заявку'],
  ['skyseal-agent/tower', 'Вход диспетчера'],
  ['yoftam/', 'YOFTAM'],
  ['yoftam/ru/avatar/', 'Аватар'],
  ['yoftam/tg/', 'YOFTAM'],
  ['buildmind-cursor/', 'BuildMind'],
  ['buildmind-cursor/works', 'Работы'],
  ['does-not-exist/', 'Такой страницы нет'],
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1366, height: 860 } });
const results = [];
for (const [path, text] of CHECKS) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Ответ 404 проверяется по статусу страницы ниже; Pages по HTTP/2 пишет «404 ()» без текста статуса.
  page.on('console', m => { if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errors.push(m.text()); });
  const t0 = Date.now();
  let ok = false, status = 0;
  try {
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = res?.status() ?? 0;
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 20000 });
    ok = true;
  } catch (e) { errors.push('wait: ' + e.message.split('\n')[0]); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => null);
  // Несуществующий адрес должен отдавать страницу 404, остальные — 200.
  const expected = path.startsWith('does-not-exist') ? 404 : 200;
  if (status !== expected) errors.push(`status ${status}, expected ${expected}`);
  results.push({ path: path || '/', status, ok, ms: Date.now() - t0, hScroll: overflow, errors: errors.slice(0, 3) });
  await page.close();
}
await browser.close();
for (const r of results) console.log(`${r.ok && !r.errors.length ? 'PASS' : 'FAIL'} ${String(r.status).padEnd(3)} ${String(r.ms).padStart(5)}ms ${r.hScroll ? 'H-SCROLL ' : ''}${r.path}${r.errors.length ? '  ' + JSON.stringify(r.errors) : ''}`);
