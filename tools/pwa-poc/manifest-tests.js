// Phase T9-B — Node-only static checks for the PWA minimal foundation.
// DOM/real-browser lifecycle checks (storage preservation, offline visit,
// update flow, kill switch) live in tools/pwa-poc/pwa-realbrowser-test.py.
// This file only validates static artifacts: site.webmanifest,
// service-worker.js source safety, and generate.js injection coverage.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');

// T9-C6: REQUIRED_PRECACHE_URLS/PILOT_NAVIGABLE_PATHS etc. are now computed
// (PILOT_PATHS.concat(...)) rather than hand-written literal arrays, so a
// naive `/NAME = \[([^\]]*)\]/` regex no longer captures their real content.
// Evaluate the real source in a throwaway sandbox and read the resulting
// values instead (same technique as tools/pwa-poc/precache-contract-tests.js).
function extractSwArrays(src) {
  const ctx = {
    console, addEventListener() {}, skipWaiting() {},
    clients: { claim: () => Promise.resolve() },
    fetch: () => Promise.reject(new Error('not used')),
    caches: {}, location: { origin: 'https://example.test' }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'service-worker.js' });
  return {
    pilotPaths: ctx.PILOT_PATHS,
    pilotDetailPaths: ctx.PILOT_DETAIL_PATHS,
    pilotNavigablePaths: ctx.PILOT_NAVIGABLE_PATHS,
    required: ctx.REQUIRED_PRECACHE_URLS,
    optional: ctx.OPTIONAL_PRECACHE_URLS
  };
}

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { pass++; console.log('  [OK  ]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}

console.log('=== 1. site.webmanifest ===');
(function () {
  const raw = fs.readFileSync(path.join(ROOT, 'site.webmanifest'), 'utf8');
  let manifest;
  try { manifest = JSON.parse(raw); } catch (e) { manifest = null; }
  check('valid JSON', manifest !== null);
  if (!manifest) return;
  check('name = どのまな', manifest.name === 'どのまな');
  check('short_name = どのまな', manifest.short_name === 'どのまな');
  check('start_url = /', manifest.start_url === '/');
  check('scope = /', manifest.scope === '/');
  check('display = standalone', manifest.display === 'standalone');
  check('theme_color set', typeof manifest.theme_color === 'string' && manifest.theme_color.length > 0);
  check('background_color set', typeof manifest.background_color === 'string' && manifest.background_color.length > 0);
  check('icons array has 192 and 512', Array.isArray(manifest.icons) &&
    manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'));
  check('start_url has no tracking query params', !/[?&]/.test(manifest.start_url));
  const iconFiles = (manifest.icons || []).map(i => i.src.replace(/^\//, ''));
  iconFiles.forEach(f => check('icon file exists: ' + f, fs.existsSync(path.join(ROOT, f))));
})();

console.log('\n=== 2. service-worker.js source safety ===');
(function () {
  const swPath = path.join(ROOT, 'service-worker.js');
  check('service-worker.js exists', fs.existsSync(swPath));
  if (!fs.existsSync(swPath)) return;
  const src = fs.readFileSync(swPath, 'utf8');
  // コメント(// と /* */)を取り除いた「実コードのみ」を安全チェックの対象にする。
  // 説明コメント内の「localStorageには触れない」等の言及を誤検知しないため。
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  check('no localStorage reference (§56/§17)', !/\blocalStorage\b/.test(code));
  check('no sessionStorage reference', !/\bsessionStorage\b/.test(code));
  check('no indexedDB.deleteDatabase reference', !/indexedDB\.deleteDatabase/.test(code));
  check('no unconditional self.skipWaiting() call in install handler (Controlled Update, §23/§24)', (function () {
    const installBlock = code.slice(code.indexOf("addEventListener('install'"), code.indexOf("addEventListener('activate'"));
    return !/self\.skipWaiting\(\)/.test(installBlock);
  })());
  check('skipWaiting() only reachable via a message handler (explicit user action)', /event\.data[\s\S]{0,40}SKIP_WAITING[\s\S]{0,80}self\.skipWaiting\(\)/.test(src));
  check('no eval(', !/\beval\(/.test(src));
  check('no Function(', !/new\s+Function\(/.test(src));
  check('no importScripts (no external CDN in SW, §44)', !/importScripts/.test(src));
  check('cache names are prefixed donomana- (§27/§28)', /donomana-shell-/.test(src) && /donomana-runtime-/.test(src));
  check('activate handler only deletes donomana- prefixed caches', (function () {
    const activateBlock = src.slice(src.indexOf("addEventListener('activate'"), src.indexOf("addEventListener('fetch'"));
    return /CACHE_PREFIX/.test(activateBlock) && !/caches\.delete\(\s*name\s*\)[\s\S]{0,20}\}\s*\)\s*\)\s*\)\s*;\s*\}\s*\)\s*;\s*\}\s*\)\s*;(?![\s\S]*filter)/.test(activateBlock);
  })());
  check('fetch handler ignores non-GET requests', /req\.method !== 'GET'/.test(src));
  check('fetch handler ignores cross-origin requests', /url\.origin !== self\.location\.origin/.test(src));
  // T9-C4: janken-app.html/tokei-app.html/learning-records.html, and (T9-C6)
  // the two Pilot detail pages, are now INTENTIONALLY precached (Pilot Small
  // App-Shell Precache + Offline Navigation Contract, docs §44/§46). The
  // guard this check exists for -- no Full Site Precache leaking a
  // genuinely non-Pilot app page or a non-Pilot app-details/*.html into any
  // precache list -- still applies.
  var swArrays = extractSwArrays(src);
  check('precache lists do not include non-Pilot app pages (no Full Site Precache, §11/docs §44)', (function () {
    var combined = swArrays.required.concat(swArrays.optional);
    var nonPilotSample = ['/matching-app.html', '/hiragana-learn.html', '/katakana-app.html', '/bosai-app.html', '/nazori-app.html', '/shiritori2.html'];
    return nonPilotSample.every(function (u) { return combined.indexOf(u) === -1; });
  })());
  check('precache lists do not include any NON-Pilot app-details/*.html (only the 2 required detail pages, §11/docs §46)', (function () {
    var combined = swArrays.required.concat(swArrays.optional);
    var detailUrls = combined.filter(function (u) { return u.indexOf('/app-details/') !== -1; });
    var allowed = ['/app-details/janken-app-detail.html', '/app-details/tokei-app-detail.html'];
    return detailUrls.every(function (u) { return allowed.indexOf(u) !== -1; });
  })());
  check('Pilot Small App-Shell Precache (T9-C4): all 4 Pilot pages ARE in REQUIRED_PRECACHE_URLS (Pilot Offline Contract, docs §44)', (function () {
    return ['/', '/learning-records.html', '/janken-app.html', '/tokei-app.html'].every(function (u) {
      return swArrays.required.indexOf(u) !== -1;
    });
  })());
  check('Offline Navigation Contract (T9-C6): both Pilot detail pages ARE in REQUIRED_PRECACHE_URLS (docs §46)', (function () {
    return ['/app-details/janken-app-detail.html', '/app-details/tokei-app-detail.html'].every(function (u) {
      return swArrays.required.indexOf(u) !== -1;
    });
  })());
  check('REQUIRED_PRECACHE_URLS has no duplicate entries', new Set(swArrays.required).size === swArrays.required.length, swArrays.required);
  check('PILOT_PATHS matches the T9-B allowlist exactly (unchanged by T9-C6 -- still means the 4 app pages themselves)', (function () {
    var expected = ['/', '/learning-records.html', '/janken-app.html', '/tokei-app.html'];
    return swArrays.pilotPaths.length === expected.length && expected.every(function (p) { return swArrays.pilotPaths.indexOf(p) !== -1; });
  })());
  check('PILOT_DETAIL_PATHS (T9-C6) matches exactly the 2 known Top->app-details hops', (function () {
    var expected = ['/app-details/janken-app-detail.html', '/app-details/tokei-app-detail.html'];
    return swArrays.pilotDetailPaths.length === expected.length && expected.every(function (p) { return swArrays.pilotDetailPaths.indexOf(p) !== -1; });
  })());
  check('PILOT_NAVIGABLE_PATHS (T9-C6 Source of Truth) is exactly PILOT_PATHS union PILOT_DETAIL_PATHS', (function () {
    var union = swArrays.pilotPaths.concat(swArrays.pilotDetailPaths);
    return swArrays.pilotNavigablePaths.length === union.length && union.every(function (p) { return swArrays.pilotNavigablePaths.indexOf(p) !== -1; });
  })());
  check('learning-records.html deliberately has NO detail-page hop (Top links it directly, docs §46.2)',
    swArrays.pilotDetailPaths.indexOf('/app-details/learning-records-detail.html') === -1);
  check('non-ok navigation responses are not cached as valid (§14)', /res\.ok/.test(src));
})();

console.log('\n=== 3. offline.html ===');
(function () {
  const p = path.join(ROOT, 'offline.html');
  check('offline.html exists', fs.existsSync(p));
  if (!fs.existsSync(p)) return;
  const html = fs.readFileSync(p, 'utf8');
  check('has exactly one <h1>', (html.match(/<h1[\s>]/g) || []).length === 1);
  check('has <main>', /<main[\s>]/.test(html));
  check('has a Home link', /href="\/"/.test(html));
  check('has a reload/retry action', /retry-btn|location\.reload/.test(html));
  check('no forbidden technical jargon visible (Service Worker/cache/manifest as body text)', !/Service Worker|CacheStorage/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));
})();

console.log('\n=== 4. pwa-register.js ===');
(function () {
  const p = path.join(ROOT, 'assets', 'js', 'pwa-register.js');
  check('pwa-register.js exists', fs.existsSync(p));
  if (!fs.existsSync(p)) return;
  const src = fs.readFileSync(p, 'utf8');
  check('registration wrapped in try/catch equivalent (.catch on register promise, §22)', /\.register\(['"]\/service-worker\.js['"]\)[\s\S]*?\.catch\(/.test(src));
  check('does not call skipWaiting directly from the page', !/self\.skipWaiting/.test(src));
  check('reload only happens inside controllerchange handler, guarded by a flag', /controllerchange[\s\S]{0,300}refreshing/.test(src));
  check('update button labeled 更新する (Japanese, non-technical)', /更新する/.test(src));
})();

console.log('\n=== 5. generate.js PWA injection coverage ===');
(function () {
  const genPath = path.join(ROOT, 'generate.js');
  const src = fs.readFileSync(genPath, 'utf8');
  check('PWA_MANIFEST_TARGET_FILES defined', /PWA_MANIFEST_TARGET_FILES/.test(src));
  check('PWA_REGISTER_TARGET_FILES defined', /PWA_REGISTER_TARGET_FILES/.test(src));
  check('learning-records.html included in manifest target list', /PWA_MANIFEST_TARGET_FILES = \[[\s\S]{0,300}learning-records\.html/.test(src));

  const expectedManifestTargets = ['about.html', 'philosophy.html', 'terms.html', 'wizard.html', 'home-screen-guide.html', '404.html', 'learning-records.html'];
  const expectedRegisterTargets = ['index.html', 'learning-records.html', 'janken-app.html', 'tokei-app.html'];

  expectedManifestTargets.forEach(f => {
    const filePath = path.join(ROOT, f);
    const html = fs.readFileSync(filePath, 'utf8');
    const manifestCount = (html.match(/rel="manifest"/g) || []).length;
    check('exactly one manifest link: ' + f, manifestCount === 1, manifestCount);
    const themeCount = (html.match(/name="theme-color"/g) || []).length;
    check('exactly one theme-color: ' + f, themeCount === 1, themeCount);
  });

  expectedRegisterTargets.forEach(f => {
    const filePath = path.join(ROOT, f);
    const html = fs.readFileSync(filePath, 'utf8');
    const regCount = (html.match(/assets\/js\/pwa-register\.js/g) || []).length;
    check('exactly one SW registration script tag: ' + f, regCount === 1, regCount);
  });

  // 非Pilot・非登録対象ファイルにはpwa-register.jsが絶対に入っていないことを確認(§21)。
  const nonPilotSample = ['matching-app.html', 'shiritori2.html', 'bosai-app.html', 'nazori-app.html', 'hiragana-learn.html', 'katakana-app.html'];
  nonPilotSample.forEach(f => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    check('no SW registration script in non-pilot app: ' + f, !/assets\/js\/pwa-register\.js/.test(html));
  });
})();

console.log('\n=== 6. apps-data.json unaffected (§64: still 35, not registered as an app) ===');
(function () {
  const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-data.json'), 'utf8'));
  const list = Array.isArray(apps) ? apps : (apps.apps || Object.values(apps));
  check('apps-data.json still has 35 entries', list.length === 35, list.length);
  check('learning-records not registered as an app', !list.some(a => a.filename === 'learning-records'));
})();

console.log('\n=== 7. sitemap.xml unaffected (§66) ===');
(function () {
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  check('offline.html NOT in sitemap.xml', !/offline\.html/.test(sitemap));
  check('service-worker.js NOT in sitemap.xml', !/service-worker\.js/.test(sitemap));
  check('site.webmanifest NOT in sitemap.xml', !/site\.webmanifest/.test(sitemap));
})();

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed.');
if (fail === 0) {
  console.log('ALL PASS.');
  process.exit(0);
} else {
  console.log(fail + ' FAILURES.');
  process.exit(1);
}
