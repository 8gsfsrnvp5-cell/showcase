// Prototype: run skyseal-agent (FastAPI) inside Pyodide under Node via demo/bridge.py.
import { loadPyodide } from 'pyodide';
import fs from 'node:fs';
import path from 'node:path';

const repo = 'C:/BuildMind/showcase/repos/skyseal-agent';
const t0 = Date.now();
const py = await loadPyodide();
await py.loadPackage(['fastapi', 'pydantic', 'httpx'], { messageCallback: (m) => console.log('  pkg:', m) });
console.log('loaded in', Date.now() - t0, 'ms');
const copy = (src, dst) => {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = dst + '/' + e.name;
    if (e.isDirectory()) { if (e.name === '__pycache__') continue; py.FS.mkdirTree(d); copy(s, d); }
    else if (e.name.endsWith('.py')) py.FS.writeFile(d, fs.readFileSync(s));
  }
};
py.FS.mkdirTree('/app/skyseal'); py.FS.mkdirTree('/app/public');
copy(path.join(repo, 'skyseal'), '/app/skyseal');
py.FS.writeFile('/app/skyseal_demo_bridge.py', fs.readFileSync(path.join(repo, 'demo/bridge.py')));
py.runPython(`import os, sys; sys.path.insert(0, '/app'); os.environ['SKYSEAL_DEMO_MODE']='1'`);
const bridge = py.pyimport('skyseal_demo_bridge');
await bridge.start();
console.log('started');
const call = async (method, p, body, headers = [['content-type', 'application/json']]) => {
  const [pathOnly, query = ''] = p.split('?');
  const r = (await bridge.http(method, pathOnly, query, headers, new TextEncoder().encode(body ? JSON.stringify(body) : ''))).toJs({ dict_converter: Object.fromEntries });
  return { status: r.status, headers: r.headers, body: new TextDecoder().decode(r.body) };
};
console.log((await call('GET', '/api/health')).body);
const login = await call('POST', '/api/operator/login', { email: 'operator@skyseal.local', password: 'skyseal-demo-2026' });
console.log('login', login.status, login.body.slice(0, 200), login.headers.filter(h => h[0] === 'set-cookie').map(h => h[1].slice(0, 60)));
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2uWQAAAAASUVORK5CYII=";
const up = async (n) => JSON.parse((await call('POST', '/api/client/uploads', { filename: n, mime_type: 'image/png', data_base64: PNG })).body).id;
const product = await up('product.png'), pack = await up('package.png');
// operator websocket
const events = [];
const emit = (id, kind, data) => events.push([kind, typeof data === 'string' ? data.slice(0, 80) : data]);
const cookie = login.headers.find(h => h[0] === 'set-cookie')[1].split(';')[0];
bridge.ws_open('op1', '/ws/operator', '', [['cookie', cookie]], emit);
await new Promise(r => setTimeout(r, 100));
const t1 = Date.now();
const created = await call('POST', '/api/client/shipments', {
  delivery_mode: 'door_to_door', tariff: 'standard',
  origin: { country: 'RU', city: 'Москва', address: 'Склад' }, destination: { country: 'TJ', city: 'Душанбе', address: 'Аэропорт' },
  cargo: { name: 'Запчасти', description: 'Обычный сухой груз', pieces: 1, weight_kg: 120, length_cm: 80, width_cm: 60, height_cm: 50, declared_value: 100000, declared_currency: 'RUB', features: '' },
  client_name: 'Тестовый клиент', client_phone: '+79990000000', client_email: '', product_photo_ids: [product], packaging_photo_ids: [pack],
});
console.log('create', created.status, Date.now() - t1, 'ms');
const { shipment, tracking_token } = JSON.parse(created.body);
await new Promise(r => setTimeout(r, 1500));
const own = JSON.parse((await call('GET', `/api/client/shipments/${shipment.reference}?token=${tracking_token}`)).body);
console.log('status', own.status, 'agents', own.agent_runs.length);
const detail = await call('GET', `/api/operator/shipments/${shipment.id}`, null, [['cookie', cookie]]);
console.log('detail', detail.status, detail.body.length);
const photo = await call('GET', `/api/operator/files/${product}`, null, [['cookie', cookie]]);
console.log('photo', photo.status, photo.headers.find(h => h[0] === 'content-type'));
console.log('ws events', events.length, events.slice(0, 4));
console.log('dash', (await call('GET', '/api/operator/dashboard', null, [['cookie', cookie]])).body);
// quote → accept: does the operator socket get the update?
const before = events.length;
const optionBase = { currency: 'RUB', route_summary: 'Москва → Душанбе', source_reference: 'RFQ-1', source_confidence: 'operator_verified', conditions: '' };
const q = await call('POST', `/api/operator/shipments/${shipment.id}/quote-bundle`, { expires_at: '2099-01-01T00:00:00+00:00', note: '', options: [
  { ...optionBase, tariff: 'flex', title: 'Гибкая', amount: 1000, eta_min_hours: 72, eta_max_hours: 120, recommended: false },
  { ...optionBase, tariff: 'standard', title: 'Стандарт', amount: 2000, eta_min_hours: 48, eta_max_hours: 72, recommended: true } ] }, [['content-type','application/json'], ['cookie', cookie]]);
console.log('quote', q.status, events.length - before, 'events');
const bundle = JSON.parse(q.body).quote_bundles[0];
const optId = bundle.options.find(o => o.recommended).id;
const mid = events.length;
const acc = await call('POST', `/api/client/shipments/${shipment.reference}/accept?token=${tracking_token}`, { option_id: optId });
await new Promise(r => setTimeout(r, 300));
console.log('accept', acc.status, events.length - mid, 'events', events.slice(mid));
