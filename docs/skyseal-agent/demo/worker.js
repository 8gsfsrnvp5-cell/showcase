// SkySeal OS static demo: the unchanged FastAPI app (skyseal/) runs here in
// Pyodide. Started as a SharedWorker so every tab (client phone, Control Tower)
// talks to one server; falls back to a dedicated Worker where SharedWorker is
// missing. Pages talk to it through demo/page.js. Runs as a module worker
// (Pyodide ships as an ES module).

const BASE = new URL('..', self.location.href); // app root (…/skyseal-agent/)
const PYODIDE_URL = new URL('pyodide/', BASE).href;
const DATA_DIRS = ['/app/data', '/app/uploads'];
const COOKIE_FILE = '/app/data/.demo-cookies.json';

const ports = new Set();
let pyodide = null;
let bridge = null;
let ready = null;
let lastProgress = 'Запускаем сервер…';

function broadcast(message) {
  for (const port of ports) port.postMessage(message);
}

function progress(text) {
  lastProgress = text;
  broadcast({ type: 'progress', text });
}

// --- persistence -----------------------------------------------------------------
let syncTimer = null;
let syncing = Promise.resolve();

function syncFs(populate) {
  syncing = syncing.then(() => new Promise((resolve) => {
    pyodide.FS.syncfs(populate, () => resolve());
  }));
  return syncing;
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncFs(false), 400);
}

// --- cookies (the session cookie of the operator login) ----------------------------
function readJar() {
  try {
    return JSON.parse(pyodide.FS.readFile(COOKIE_FILE, { encoding: 'utf8' }));
  } catch {
    return {};
  }
}

function rememberCookies(headers) {
  const values = headers.filter(([k]) => k.toLowerCase() === 'set-cookie').map(([, v]) => v);
  if (!values.length) return;
  const jar = readJar();
  for (const value of values) {
    const [pair, ...attrs] = value.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const val = pair.slice(eq + 1).replace(/^"|"$/g, '');
    const expired = !val || attrs.some((a) => /^max-age=0$/i.test(a) || (/^expires=/i.test(a) && Date.parse(a.slice(8)) < Date.now()));
    if (expired) delete jar[name];
    else jar[name] = pair.slice(eq + 1);
  }
  pyodide.FS.writeFile(COOKIE_FILE, JSON.stringify(jar));
}

function withCookies(headers) {
  const jar = readJar();
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  return cookie ? [...headers.filter(([k]) => k.toLowerCase() !== 'cookie'), ['cookie', cookie]] : headers;
}

// --- startup -----------------------------------------------------------------------
async function boot() {
  progress('Загружаем Python (Pyodide)…');
  const { loadPyodide } = await import(PYODIDE_URL + 'pyodide.mjs');
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  progress('Загружаем FastAPI и Pydantic…');
  await pyodide.loadPackage(['fastapi', 'pydantic', 'httpx'], { messageCallback: () => {}, errorCallback: () => {} });

  progress('Разворачиваем SkySeal OS…');
  // Modules arrive as bytecode (.pyc) or, from a non-3.14 build, as source.
  const modules = await (await fetch(new URL('demo/skyseal-src.json', BASE))).json();
  for (const [file, content] of Object.entries(modules)) {
    pyodide.FS.mkdirTree(file.slice(0, file.lastIndexOf('/')));
    const data = content.base64 ? Uint8Array.from(atob(content.base64), (c) => c.charCodeAt(0)) : content.text;
    pyodide.FS.writeFile(file, data);
  }
  pyodide.FS.mkdirTree('/app/public');
  for (const dir of DATA_DIRS) {
    pyodide.FS.mkdirTree(dir);
    pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, {}, dir);
  }
  await syncFs(true);

  pyodide.runPython(`
import os, sys
sys.path.insert(0, '/app')
os.environ['SKYSEAL_DEMO_MODE'] = '1'
os.environ['SKYSEAL_RUNTIME_PROFILE'] = 'local'
`);
  bridge = pyodide.pyimport('skyseal_demo_bridge');
  progress('Готовим базу данных…');
  await bridge.start();
  await syncFs(false);
  progress('Готово');
}

// --- requests ----------------------------------------------------------------------
async function handleHttp(message) {
  const headers = withCookies(message.headers);
  const body = new Uint8Array(message.body || new ArrayBuffer(0));
  const proxy = await bridge.http(message.method, message.path, message.query, pyodide.toPy(headers), body);
  const res = proxy.toJs({ dict_converter: Object.fromEntries });
  proxy.destroy();
  rememberCookies(res.headers);
  if (message.method !== 'GET') scheduleSync();
  const bytes = res.body instanceof Uint8Array ? res.body : new Uint8Array(res.body);
  return { status: res.status, headers: res.headers, body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

const socketOwners = new Map();

function emitSocket(connId, kind, data) {
  const port = socketOwners.get(connId);
  if (kind === 'close') socketOwners.delete(connId);
  // Agent runs write to the database as they go; persist after each event burst.
  scheduleSync();
  port?.postMessage({ type: 'ws', connId, kind, data: data == null ? null : String(data) });
}

function setupPort(port) {
  ports.add(port);
  port.onmessage = async (event) => {
    const message = event.data;
    try {
      await ready;
    } catch (error) {
      port.postMessage({ type: 'failed', error: String(error) });
      return;
    }
    if (message.type === 'hello') {
      port.postMessage({ type: 'ready' });
    } else if (message.type === 'http') {
      try {
        port.postMessage({ type: 'http', id: message.id, response: await handleHttp(message) });
      } catch (error) {
        port.postMessage({ type: 'http', id: message.id, error: String(error) });
      }
    } else if (message.type === 'ws-open') {
      socketOwners.set(message.connId, port);
      bridge.ws_open(message.connId, message.path, message.query, pyodide.toPy(withCookies(message.headers || [])), emitSocket);
    } else if (message.type === 'ws-send') {
      bridge.ws_send(message.connId, message.data);
    } else if (message.type === 'ws-close') {
      bridge.ws_close(message.connId);
    } else if (message.type === 'bye') {
      ports.delete(port);
      for (const [connId, owner] of socketOwners) {
        if (owner === port) bridge.ws_close(connId);
      }
    }
  };
  port.postMessage({ type: 'progress', text: lastProgress });
  port.start?.();
}

ready = boot();
ready.catch((error) => broadcast({ type: 'failed', error: String(error && error.message || error) }));

if (typeof SharedWorkerGlobalScope !== 'undefined' && self instanceof SharedWorkerGlobalScope) {
  self.onconnect = (event) => setupPort(event.ports[0]);
} else {
  setupPort(self);
}
