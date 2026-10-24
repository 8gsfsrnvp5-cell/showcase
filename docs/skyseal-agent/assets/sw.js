const CACHE = 'skyseal-v1';
const ASSETS = ['./', 'tower', 'assets/styles.css', 'assets/common.js', 'assets/client.js', 'assets/tower.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => { if (event.request.url.includes('/api/') || event.request.url.includes('/ws/')) return; event.respondWith(fetch(event.request).catch(() => caches.match(event.request))); });
