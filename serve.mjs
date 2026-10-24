// Local stand-in for GitHub Pages: serves ./docs under /showcase/ with the same
// rules (directory -> index.html, redirect to trailing slash, no SPA fallback).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, 'docs');
const prefix = '/showcase';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (path === '/' ) { res.writeHead(302, { location: prefix + '/' }); return res.end(); }
  if (!path.startsWith(prefix + '/') && path !== prefix) { res.writeHead(404); return res.end('not found'); }
  let file = normalize(join(root, path.slice(prefix.length)));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    let s = await stat(file);
    if (s.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { location: path + '/' + url.search }); return res.end(); }
      file = join(file, 'index.html');
      s = await stat(file);
    }
    res.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    try { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(join(root, '404.html'))); }
    catch { res.end('404'); }
  }
}).listen(4600, () => console.log('showcase preview http://localhost:4600/showcase/'));
