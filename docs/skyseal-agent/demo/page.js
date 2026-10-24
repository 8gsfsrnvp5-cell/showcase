// SkySeal OS static demo — loaded before the app's own scripts. Connects to the
// in-browser server (demo/worker.js, Python in Pyodide) and routes the app's
// /api requests, /ws sockets and API images to it. The app code is unchanged.
(function () {
  'use strict';

  const script = document.currentScript;
  const BASE = new URL('..', script.src); // app root
  const API_PREFIX = new URL('api/', BASE).pathname;
  const WS_PREFIX = new URL('ws/', BASE).pathname;
  const workerUrl = new URL('demo/worker.js', BASE).href;

  // --- connection to the server worker --------------------------------------------
  let port;
  try {
    const shared = new SharedWorker(workerUrl, { name: 'skyseal-os-demo', type: 'module' });
    port = shared.port;
  } catch (_) {
    port = new Worker(workerUrl, { type: 'module' });
  }

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const pending = new Map();
  const sockets = new Map();
  let seq = 0;
  const TAB_ID = Math.random().toString(36).slice(2, 10);

  port.onmessage = (event) => {
    const m = event.data;
    if (m.type === 'progress') overlay.update(m.text);
    else if (m.type === 'ready') { overlay.hide(); resolveReady(); }
    else if (m.type === 'failed') { overlay.fail(m.error); rejectReady(new Error(m.error)); }
    else if (m.type === 'http') {
      const entry = pending.get(m.id);
      pending.delete(m.id);
      if (!entry) return;
      if (m.error) entry.reject(new TypeError(m.error));
      else entry.resolve(new Response(m.response.status === 204 ? null : m.response.body, { status: m.response.status, headers: m.response.headers }));
    } else if (m.type === 'ws') {
      sockets.get(m.connId)?._event(m.kind, m.data);
    }
  };
  port.start?.();
  port.postMessage({ type: 'hello' });
  window.addEventListener('pagehide', () => port.postMessage({ type: 'bye' }));

  // --- fetch ------------------------------------------------------------------------
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith(API_PREFIX)) return nativeFetch(input, init);
    await ready;
    const headers = [];
    request.headers.forEach((value, key) => headers.push([key, value]));
    const body = request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer();
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      port.postMessage({
        type: 'http', id, method: request.method, path: '/api/' + url.pathname.slice(API_PREFIX.length),
        query: url.search.slice(1), headers, body,
      }, body ? [body] : []);
    });
  };

  // --- WebSocket --------------------------------------------------------------------
  const NativeWebSocket = window.WebSocket;
  class DemoWebSocket extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 0;
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      this._id = TAB_ID + '-ws-' + (++seq); // unique across tabs: the server is shared
      sockets.set(this._id, this);
      const u = new URL(this.url);
      ready.then(() => port.postMessage({
        type: 'ws-open', connId: this._id, path: '/ws/' + u.pathname.slice(WS_PREFIX.length), query: u.search.slice(1),
      }), () => this._event('close', 1006));
    }
    _event(kind, data) {
      if (kind === 'open') {
        this.readyState = 1;
        this._dispatch(new Event('open'));
      } else if (kind === 'message') {
        this._dispatch(new MessageEvent('message', { data }));
      } else if (kind === 'close') {
        if (this.readyState === 3) return;
        this.readyState = 3;
        sockets.delete(this._id);
        this._dispatch(new CloseEvent('close', { code: Number(data) || 1000 }));
      }
    }
    _dispatch(event) {
      const handler = this['on' + event.type];
      if (typeof handler === 'function') handler.call(this, event);
      this.dispatchEvent(event);
    }
    send(data) { if (this.readyState === 1) port.postMessage({ type: 'ws-send', connId: this._id, data: String(data) }); }
    close() {
      if (this.readyState >= 2) return;
      this.readyState = 2;
      port.postMessage({ type: 'ws-close', connId: this._id });
    }
  }
  DemoWebSocket.CONNECTING = 0; DemoWebSocket.OPEN = 1; DemoWebSocket.CLOSING = 2; DemoWebSocket.CLOSED = 3;
  window.WebSocket = function (url, protocols) {
    const u = new URL(url, location.href);
    if (u.host === location.host && u.pathname.startsWith(WS_PREFIX)) return new DemoWebSocket(u.href);
    return new NativeWebSocket(url, protocols);
  };
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

  // --- images and links that point at the API ---------------------------------------
  const blobUrls = new Map();
  async function blobFor(href) {
    if (!blobUrls.has(href)) {
      blobUrls.set(href, window.fetch(href).then((r) => r.blob()).then((b) => URL.createObjectURL(b)));
    }
    return blobUrls.get(href);
  }
  function isApi(value) {
    if (!value) return false;
    const u = new URL(value, location.href);
    return u.origin === location.origin && u.pathname.startsWith(API_PREFIX);
  }
  function fixImages(root) {
    for (const img of root.querySelectorAll ? root.querySelectorAll('img[src]') : []) {
      const src = img.getAttribute('src');
      if (isApi(src)) {
        img.removeAttribute('src');
        blobFor(new URL(src, location.href).href).then((url) => { img.src = url; });
      }
    }
  }
  new MutationObserver((records) => {
    for (const r of records) for (const node of r.addedNodes) if (node.nodeType === 1) {
      if (node.tagName === 'IMG') fixImages(node.parentNode || node);
      else fixImages(node);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link || !isApi(link.getAttribute('href'))) return;
    event.preventDefault();
    const tab = window.open('', '_blank');
    blobFor(link.href).then((url) => { if (tab) tab.location.href = url; else location.href = url; });
  }, true);

  // --- loading overlay and demo hints -----------------------------------------------
  const overlay = (function () {
    const el = document.createElement('div');
    el.className = 'skyseal-demo-overlay';
    el.innerHTML = `
      <style>
        .skyseal-demo-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(7,26,45,.92);
          color:#e8f1f8;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;text-align:center}
        .skyseal-demo-overlay .box{max-width:380px}
        .skyseal-demo-overlay .spin{width:38px;height:38px;margin:0 auto 18px;border-radius:50%;border:3px solid rgba(255,255,255,.2);
          border-top-color:#5cc8ff;animation:skyseal-spin .9s linear infinite}
        .skyseal-demo-overlay b{display:block;font-size:17px;margin-bottom:6px}
        .skyseal-demo-overlay small{display:block;margin-top:12px;color:#9fb6c8}
        @keyframes skyseal-spin{to{transform:rotate(360deg)}}
      </style>
      <div class="box"><div class="spin"></div><b>Запускаем сервер SkySeal в браузере</b><span class="msg">Подготовка…</span>
      <small>Настоящий Python-сервер (FastAPI, 9 агентов, SQLite) работает прямо на этом устройстве. Первый запуск — до минуты, дальше быстрее.</small></div>`;
    // The server may already be up (another tab started it) before <body> exists.
    let hidden = false;
    const show = () => { if (!hidden) document.body.append(el); };
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
    return {
      update(text) { el.querySelector('.msg').textContent = text; },
      hide() { hidden = true; el.remove(); },
      fail(error) {
        el.querySelector('.spin').remove();
        el.querySelector('b').textContent = 'Не удалось запустить демо';
        el.querySelector('.msg').textContent = 'Откройте ссылку в Chrome, Safari или Edge последней версии. (' + error + ')';
      },
    };
  })();

  // Control Tower quote dialog: one click fills sample prices (clearly marked
  // as demo) so the whole offer → client choice loop can be tried quickly.
  const SAMPLE_QUOTE = { flex: 182000, standard: 214000, priority: 296000, charter: 940000 };
  function addSampleQuoteButton(form) {
    if (form.querySelector('[data-demo-fill]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.demoFill = '1';
    button.className = 'secondary';
    button.textContent = 'Заполнить примером (демо-цены)';
    button.style.cssText = 'margin:0 0 12px';
    button.addEventListener('click', () => {
      const expires = form.querySelector('[name="expires_at"]');
      if (expires && !expires.value) {
        const d = new Date(Date.now() + 3 * 24 * 3600 * 1000 - new Date().getTimezoneOffset() * 60000);
        expires.value = d.toISOString().slice(0, 16);
      }
      for (const [key, amount] of Object.entries(SAMPLE_QUOTE)) {
        const enabled = form.querySelector(`[name="${key}_enabled"]`);
        if (!enabled?.checked) continue;
        form.querySelector(`[name="${key}_amount"]`).value = amount;
        form.querySelector(`[name="${key}_source"]`).value = 'RFQ-DEMO-001 (демо)';
        const conditions = form.querySelector(`[name="${key}_conditions"]`);
        if (conditions && !conditions.value) conditions.value = 'Демо-предложение: ставка условная';
      }
    });
    form.prepend(button);
  }
  new MutationObserver(() => {
    const form = document.getElementById('quoteForm');
    if (form) addSampleQuoteButton(form);
  }).observe(document.documentElement, { childList: true, subtree: true });

  function demoHints() {
    if (location.pathname.replace(/\/$/, '').endsWith('/tower')) {
      const pw = document.querySelector('input[name="password"]');
      if (pw && !pw.value) pw.value = 'skyseal-demo-2026';
      const hint = document.createElement('p');
      hint.style.cssText = 'margin:10px 0 0;font-size:13px;opacity:.8';
      hint.textContent = 'Демо: пароль диспетчера уже подставлен — skyseal-demo-2026.';
      pw?.closest('form')?.append(hint);
      return;
    }
    const target = document.getElementById('packagingPhotos')?.closest('.upload-zone')?.parentElement;
    if (!target || typeof DataTransfer !== 'function') return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = 'Подставить демонстрационные фото';
    button.style.cssText = 'margin-top:10px;width:100%';
    button.addEventListener('click', async () => {
      const make = (label, color) => new Promise((resolve) => {
        const c = document.createElement('canvas');
        c.width = 640; c.height = 480;
        const g = c.getContext('2d');
        g.fillStyle = '#eef3f7'; g.fillRect(0, 0, 640, 480);
        g.fillStyle = color; g.fillRect(170, 110, 300, 220);
        g.fillStyle = '#071a2d'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText(label, 320, 400);
        c.toBlob((blob) => resolve(new File([blob], label.replace(/\W+/g, '-') + '.png', { type: 'image/png' })), 'image/png');
      });
      const set = (id, file) => {
        const input = document.getElementById(id);
        const t = new DataTransfer();
        t.items.add(file);
        input.files = t.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('productPhotos', await make('Товар (демо)', '#5b8aa8'));
      set('packagingPhotos', await make('Упаковка (демо)', '#c79a52'));
      button.textContent = 'Демо-фото приложены';
      button.disabled = true;
    });
    target.append(button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demoHints);
  else demoHints();
})();
