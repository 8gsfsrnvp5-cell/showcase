// Assembles the showcase site in ./docs from each project's demo build.
// Builds themselves are produced in the project repos (see README.md);
// this script only copies them, adds the shared 404/landing pages and
// marks every page noindex.
//
//   node assemble.mjs            # all apps
//   node assemble.mjs yobanda    # only the named apps
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const repos = path.join(here, 'repos');
const docs = path.join(here, 'docs');

/**
 * slug    — folder under /showcase/
 * from    — directory to copy (relative to repos/)
 * files   — explicit [source, target] pairs instead of a whole directory
 * exclude — top-level names to skip when copying `from`
 * spa     — client-side routes beyond real folders: deep links are rescued by 404.html
 */
const APPS = [
  { slug: 'yobanda', from: 'yobanda/dist' },
  { slug: 'skyseal-cargo', from: 'skyseal-cargo/dist/pages', spa: true },
  { slug: 'kopilka', from: 'kopilka-gruppy-1/dist/pages' },
  {
    slug: 'kopilka-lite',
    files: [
      ['kopilka-gruppy/index.html', 'index.html'],
      ['kopilka-gruppy-1/dist/pages/demo-backend.js', 'demo-backend.js'],
      ['kopilka-gruppy-1/public/favicon.svg', 'favicon.svg'],
    ],
    // The lightweight page talks to the same API; in the demo it gets the
    // in-browser backend (amounts in rubles) and a favicon.
    patchHtml: (html) => html.replace(
      '</head>',
      '  <link rel="icon" href="favicon.svg" type="image/svg+xml" />\n' +
      '  <script src="demo-backend.js" data-storage-key="kopilka-lite-demo" data-unit="rubles"></script>\n</head>',
    ),
  },
  {
    slug: 'buildmind',
    from: 'buildmind-core',
    exclude: ['.git', '.github', 'tests', 'node_modules', '.claude'],
    excludeExt: ['.md'],
  },
  { slug: 'buildmind-platform', from: 'buildmind-platform/dist/pages' },
  { slug: 'aero-cargo', from: 'aero-cargo-ai/dist/static-demo', spa: true },
  { slug: 'skyseal-agent', from: 'skyseal-agent/dist/static-demo' },
  { slug: 'yoftam', from: 'YOFTAM/dist/static-demo' },
  { slug: 'buildmind-cursor', from: 'buildmind-cursor-mvp/dist', spa: true },
  { slug: 'procurement', from: 'buildmind-procurement-mvp2', exclude: ['.git', 'README.md'] },
  { slug: 'procurement-v1', from: '_unzipped/buildmind_mvp_github_starter', exclude: ['README.md'] },
];

// Restores a deep link that GitHub Pages sent through 404.html (see templates/404.html).
const RESTORE_SNIPPET = `<script>(function(){var q=new URLSearchParams(location.search),p=q.get('__path');if(p===null)return;q.delete('__path');var s=q.toString();history.replaceState(null,'',location.pathname.replace(/\\/$/,'')+p+(s?'?'+s:'')+location.hash)})();</script>`;
const NOINDEX = '<meta name="robots" content="noindex" />';

function copyDir(src, dst, app) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (app.exclude?.includes(entry.name)) continue;
    if (entry.isFile() && app.excludeExt?.some((ext) => entry.name.endsWith(ext))) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) fs.cpSync(from, to, { recursive: true });
    else fs.copyFileSync(from, to);
  }
}

function htmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Right after <meta charset> (it must stay first), else at the top of <head>.
function headInsert(html, snippet) {
  const charset = /<meta\s+charset[^>]*>/i;
  if (charset.test(html)) return html.replace(charset, (m) => `${m}\n  ${snippet}`);
  return html.replace(/<head([^>]*)>/i, (m) => `${m}\n  ${snippet}`);
}

const only = process.argv.slice(2);
for (const app of APPS) {
  if (only.length && !only.includes(app.slug)) continue;
  const dst = path.join(docs, app.slug);
  fs.rmSync(dst, { recursive: true, force: true });
  if (app.files) {
    fs.mkdirSync(dst, { recursive: true });
    for (const [src, target] of app.files) fs.copyFileSync(path.join(repos, src), path.join(dst, target));
  } else {
    const src = path.join(repos, app.from);
    if (!fs.existsSync(src)) throw new Error(`${app.slug}: build not found at ${src}`);
    copyDir(src, dst, app);
  }
  for (const file of htmlFiles(dst)) {
    let html = fs.readFileSync(file, 'utf8');
    if (app.patchHtml && path.dirname(file) === dst) html = app.patchHtml(html);
    if (!html.includes('name="robots"')) html = headInsert(html, NOINDEX);
    if (app.spa && !html.includes('__path')) html = headInsert(html, RESTORE_SNIPPET);
    fs.writeFileSync(file, html);
  }
  console.log(`✓ ${app.slug}`);
}

for (const page of ['index.html', '404.html']) {
  fs.copyFileSync(path.join(here, 'templates', page), path.join(docs, page));
}
fs.writeFileSync(path.join(docs, '.nojekyll'), '');
console.log('✓ index.html, 404.html');
