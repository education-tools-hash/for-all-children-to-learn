#!/usr/bin/env node
// Phase T9-C4 — Pilot Small App-Shell Precache contract tests.
//
// Loads the REAL service-worker.js source into a sandboxed VM context (same
// technique as cache-lifetime-tests.js) and asserts on the Pilot Offline
// Contract established in T9-C4: "Pilot pages are offline-ready as soon as
// Service Worker install succeeds, with no prior visit required." Covers:
//   1-3. exact precache URL membership (no dupes, no non-Pilot leakage)
//   4-6. install-time atomicity (required assets fail the whole install;
//        optional assets don't) and unvisited-offline navigation success
//   9-10. precache byte size stays well under the ~1MB target
//   11-14. no regression to Controlled Update / non-Pilot isolation /
//        runtime cache hardening / localStorage+IndexedDB non-interference
//
// Items 7-8 (survival across an actual browser/process close or force-quit)
// cannot be proven in a Node VM sandbox -- those are covered by the
// real-browser Playwright test (tools/pwa-poc/pwa-realbrowser-test.py).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SW_SRC = fs.readFileSync(path.join(REPO_ROOT, 'service-worker.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}

// Strips /* */ and // comments so structural source checks (item 11/14) test
// actual code, not prose in doc comments that legitimately mentions terms
// like "skipWaiting()" or "IndexedDB" while explaining they are NOT used.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const SW_CODE_ONLY = stripComments(SW_SRC);

// ────────────────────────────────────────────────────────────
// Extract REQUIRED_PRECACHE_URLS / OPTIONAL_PRECACHE_URLS from the real
// source by running it in a throwaway sandbox and reading the resulting
// self-scope variables (no fetch/caches needed just to read the arrays).
// ────────────────────────────────────────────────────────────
function extractPrecacheArrays() {
  const ctx = {
    console,
    addEventListener() {},
    skipWaiting() {},
    clients: { claim: () => Promise.resolve() },
    fetch: () => Promise.reject(new Error('not used')),
    caches: {},
    location: { origin: 'https://example.test' }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx, { filename: 'service-worker.js' });
  return { required: ctx.REQUIRED_PRECACHE_URLS, optional: ctx.OPTIONAL_PRECACHE_URLS };
}

function loadSW({ fetchImpl, cachesImpl }) {
  const listeners = {};
  const ctx = {
    console,
    URL,
    Response,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    skipWaiting() {},
    clients: { claim: () => Promise.resolve(), get: () => Promise.resolve(null) },
    fetch: fetchImpl,
    caches: cachesImpl,
    location: { origin: 'https://example.test' }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx, { filename: 'service-worker.js' });
  return listeners;
}

function makeInstallEvent() {
  const event = { waitUntilPromise: null, waitUntilSettled: false, waitUntilRejected: false, waitUntilError: undefined };
  event.waitUntil = function (p) {
    event.waitUntilPromise = Promise.resolve(p).then(
      () => { event.waitUntilSettled = true; },
      (e) => { event.waitUntilSettled = true; event.waitUntilRejected = true; event.waitUntilError = e; }
    );
  };
  return event;
}

function makeFetchEvent(req, clientId) {
  const event = {
    request: req, clientId: clientId || null, resultingClientId: null,
    respondWithCalled: false, respondWithSettled: false, respondWithValue: undefined, respondWithError: undefined,
    waitUntilCount: 0,
    respondWith(p) {
      event.respondWithCalled = true;
      Promise.resolve(p).then(
        (v) => { event.respondWithSettled = true; event.respondWithValue = v; },
        (e) => { event.respondWithSettled = true; event.respondWithError = e; }
      );
    },
    waitUntil(p) { event.waitUntilCount++; Promise.resolve(p).catch(() => {}); }
  };
  return event;
}

async function flush(ticks) {
  for (let i = 0; i < (ticks || 20); i++) await Promise.resolve();
}

(async function () {
  const { required, optional } = extractPrecacheArrays();

  console.log('=== 1-3. Precache URL membership (static) ===');
  const PILOT_HTML = ['/', '/learning-records.html', '/janken-app.html', '/tokei-app.html'];
  const REQUIRED_JS = ['/assets/js/pwa-register.js', '/assets/js/record-dashboard-foundation.js', '/assets/js/record-dashboard-ui.js'];

  for (const url of PILOT_HTML) {
    const count = required.filter((u) => u === url).length;
    check(`1. ${url} appears exactly once in REQUIRED_PRECACHE_URLS`, count === 1, { count });
  }
  for (const url of REQUIRED_JS) {
    const count = required.filter((u) => u === url).length;
    check(`2. ${url} appears exactly once in REQUIRED_PRECACHE_URLS`, count === 1, { count });
  }
  check('required list has no accidental duplicates at all', new Set(required).size === required.length, { required });
  check('optional list has no accidental duplicates at all', new Set(optional).size === optional.length, { optional });
  check('no overlap between required and optional lists', required.every((u) => optional.indexOf(u) === -1), { required, optional });

  const NON_PILOT_SAMPLE = ['/matching-app.html', '/hiragana-learn.html', '/katakana-app.html', '/bosai-app.html', '/nazori-app.html', '/shiritori2.html'];
  for (const url of NON_PILOT_SAMPLE) {
    check(`3. non-Pilot ${url} is NOT in REQUIRED_PRECACHE_URLS`, required.indexOf(url) === -1);
    check(`3. non-Pilot ${url} is NOT in OPTIONAL_PRECACHE_URLS`, optional.indexOf(url) === -1);
  }
  // T9-C6 (Offline Navigation Contract): the 2 Pilot detail pages (the
  // Top -> app-details/{app}-detail.html -> {app}.html hop) are now
  // INTENTIONALLY required-precached -- but no OTHER app-details/*.html
  // (the 33 non-Pilot ones) may ever appear (Full Site Precache guard).
  const allPrecache = required.concat(optional);
  const ALLOWED_DETAIL_PAGES = ['/app-details/janken-app-detail.html', '/app-details/tokei-app-detail.html'];
  check('3. only the 2 known Pilot detail pages appear in any precache list, never a non-Pilot app-details/*.html',
    allPrecache.filter((u) => u.indexOf('/app-details/') !== -1).every((u) => ALLOWED_DETAIL_PAGES.includes(u)));
  check('3. both Pilot detail pages ARE present in REQUIRED_PRECACHE_URLS (T9-C6 Offline Navigation Contract)',
    ALLOWED_DETAIL_PAGES.every((u) => required.includes(u)));
  check('3. no assets/icons|mockups path in any precache list (image precache stays out of scope)', !allPrecache.some((u) => /assets\/(icons|mockups)\//.test(u)));

  console.log('\n=== 4. Install atomicity: ALL required + optional succeed -> install succeeds, every URL cached ===');
  {
    const added = [];
    const listeners = loadSW({
      fetchImpl: () => Promise.reject(new Error('unused')),
      cachesImpl: {
        open: () => Promise.resolve({
          add: (url) => { added.push(String(url)); return Promise.resolve(); }
        }),
        keys: () => Promise.resolve([])
      }
    });
    const event = makeInstallEvent();
    listeners.install[0](event);
    await flush();
    check('4. install waitUntil settles', event.waitUntilSettled === true);
    check('4. install does NOT reject when everything succeeds', event.waitUntilRejected === false);
    for (const url of required.concat(optional)) {
      check(`4. cache.add called for ${url}`, added.indexOf(url) !== -1);
    }
    check('4. no unexpected extra URLs cached beyond required+optional', added.length === required.length + optional.length, { added });
  }

  console.log('\n=== 4b. Install atomicity: ONE required asset fails -> whole install FAILS (Pilot Offline Contract) ===');
  {
    const listeners = loadSW({
      fetchImpl: () => Promise.reject(new Error('unused')),
      cachesImpl: {
        open: () => Promise.resolve({
          add: (url) => {
            if (String(url) === '/janken-app.html') return Promise.reject(new Error('simulated fetch failure'));
            return Promise.resolve();
          }
        }),
        keys: () => Promise.resolve([])
      }
    });
    const event = makeInstallEvent();
    listeners.install[0](event);
    await flush();
    check('4b. install waitUntil settles', event.waitUntilSettled === true);
    check('4b. install REJECTS when a required Pilot asset fails to cache (no silent false success)', event.waitUntilRejected === true);
  }

  console.log('\n=== 4c. Install atomicity: ONE optional asset fails -> install still SUCCEEDS (best-effort preserved, §45) ===');
  {
    const listeners = loadSW({
      fetchImpl: () => Promise.reject(new Error('unused')),
      cachesImpl: {
        open: () => Promise.resolve({
          add: (url) => {
            if (String(url) === '/site.webmanifest') return Promise.reject(new Error('simulated fetch failure'));
            return Promise.resolve();
          }
        }),
        keys: () => Promise.resolve([])
      }
    });
    const event = makeInstallEvent();
    listeners.install[0](event);
    await flush();
    check('4c. install waitUntil settles', event.waitUntilSettled === true);
    check('4c. install still SUCCEEDS when only an optional (non-Pilot-critical) asset fails', event.waitUntilRejected === false);
  }

  console.log('\n=== 6. Never-visited Pilot page navigates successfully OFFLINE (RUNTIME_CACHE empty, only SHELL_CACHE precache exists) ===');
  for (const path_ of ['/janken-app.html', '/tokei-app.html', '/learning-records.html']) {
    const shellStore = {};
    shellStore[path_] = new Response('<html>precached ' + path_ + '</html>', { status: 200 });
    const listeners = loadSW({
      fetchImpl: () => Promise.reject(new Error('offline (never visited before)')),
      cachesImpl: {
        open: () => Promise.resolve({ add: () => Promise.resolve() }),
        match: (req, opts) => {
          const p = new URL(typeof req === 'string' ? req : req.url, 'https://example.test').pathname;
          if (opts && opts.cacheName === 'donomana-shell-v1' && shellStore[p]) return Promise.resolve(shellStore[p]);
          return Promise.resolve(undefined); // RUNTIME_CACHE always empty: never visited
        }
      }
    });
    const event = makeFetchEvent({ method: 'GET', url: 'https://example.test' + path_, mode: 'navigate' });
    listeners.fetch[0](event);
    await flush();
    check(`6. ${path_}: offline navigation with ZERO prior visits still succeeds`, event.respondWithSettled === true && !event.respondWithError);
    check(`6. ${path_}: response comes from the SHELL_CACHE precache (not the generic offline.html fallback)`,
      event.respondWithValue instanceof Response && event.respondWithValue === shellStore[path_]);
  }

  console.log('\n=== 5/6b. Never-visited Pilot page: its required sub-resource JS also resolves OFFLINE from SHELL_CACHE ===');
  {
    const shellJsUrl = 'https://example.test/assets/js/record-dashboard-foundation.js';
    const jsResponse = new Response('/* precached js */', { status: 200 });
    const ctx = {
      console, URL, Response,
      addEventListener(type, fn) { (ctx.__listeners[type] = ctx.__listeners[type] || []).push(fn); },
      __listeners: {},
      skipWaiting() {},
      clients: { claim: () => Promise.resolve(), get: () => Promise.resolve({ url: 'https://example.test/learning-records.html' }) },
      fetch: () => Promise.reject(new Error('offline')),
      caches: {
        open: () => Promise.resolve({ add: () => Promise.resolve(), put: () => Promise.resolve() }),
        match: (req, opts) => {
          const url = typeof req === 'string' ? req : req.url;
          if (opts && opts.cacheName === 'donomana-shell-v1' && url === shellJsUrl) return Promise.resolve(jsResponse);
          return Promise.resolve(undefined);
        }
      },
      location: { origin: 'https://example.test' }
    };
    ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(SW_SRC, ctx, { filename: 'service-worker.js' });

    const event = makeFetchEvent({ method: 'GET', url: shellJsUrl, mode: 'script' }, 'client-1');
    ctx.__listeners.fetch[0](event);
    await flush();
    check('5. learning-records.html\'s required JS (record-dashboard-foundation.js) resolves offline from SHELL_CACHE with zero prior visits',
      event.respondWithSettled === true && event.respondWithValue === jsResponse);
  }

  console.log('\n=== 9-10. Precache byte-size stays well under the ~1MB Pilot-scope target ===');
  {
    const fsSizes = {
      '/': 'index.html',
      '/learning-records.html': 'learning-records.html',
      '/janken-app.html': 'janken-app.html',
      '/tokei-app.html': 'tokei-app.html',
      '/assets/js/pwa-register.js': 'assets/js/pwa-register.js',
      '/assets/js/record-dashboard-foundation.js': 'assets/js/record-dashboard-foundation.js',
      '/assets/js/record-dashboard-ui.js': 'assets/js/record-dashboard-ui.js',
      '/app-details/janken-app-detail.html': 'app-details/janken-app-detail.html',
      '/app-details/tokei-app-detail.html': 'app-details/tokei-app-detail.html',
      '/offline.html': 'offline.html',
      '/site.webmanifest': 'site.webmanifest'
    };
    let total = 0;
    for (const url of required.concat(optional)) {
      const rel = fsSizes[url];
      check(`9. know the on-disk file for precache URL ${url}`, !!rel, { url });
      if (rel) total += fs.statSync(path.join(REPO_ROOT, rel)).size;
    }
    console.log(`  total precache byte size: ${total} bytes (${(total / 1024).toFixed(1)} KB)`);
    check('10. total Pilot precache size is under 1MB (not a Full Site Precache)', total < 1024 * 1024, { total });
  }

  console.log('\n=== 11. Controlled Update: skipWaiting() still never called unconditionally ===');
  const installCodeOnly = stripComments(SW_SRC.split("self.addEventListener('activate'")[0]);
  check('11. install handler code (comments stripped) does not call self.skipWaiting()', !/skipWaiting\(\)/.test(installCodeOnly));
  check('11. skipWaiting() call appears exactly once in actual code (inside the message handler, explicit user action only)', (SW_CODE_ONLY.match(/skipWaiting\(\)/g) || []).length === 1);

  console.log('\n=== 12. Non-Pilot isolation: fetch listener still no-ops non-Pilot navigations ===');
  {
    let fetchCalled = false;
    const listeners = loadSW({
      fetchImpl: () => { fetchCalled = true; return Promise.resolve(new Response('x')); },
      cachesImpl: { open: () => Promise.resolve({ add: () => Promise.resolve(), put: () => Promise.resolve() }), match: () => Promise.resolve(undefined) }
    });
    const event = makeFetchEvent({ method: 'GET', url: 'https://example.test/matching-app.html', mode: 'navigate' });
    listeners.fetch[0](event);
    await flush();
    check('12. non-Pilot navigation: respondWith never called', event.respondWithCalled === false);
    check('12. non-Pilot navigation: SW never calls fetch() itself', fetchCalled === false);
  }

  console.log('\n=== 13. Runtime cache hardening (T9-C\'\') preserved: navigation cache-write still uses event.waitUntil ===');
  check('13. networkFirstNavigate still registers a waitUntil-protected cache write', /function networkFirstNavigate\(event, req\)[\s\S]*?event\.waitUntil\(/.test(SW_SRC));
  check('13. networkFirstNavigate still clones the response before dual-use (no double-read)', /resForCache: cacheable \? res\.clone\(\) : null/.test(SW_SRC));

  console.log('\n=== 14. localStorage / IndexedDB non-interference (Critical Constraint, unchanged) ===');
  // Comments legitimately mention these terms while documenting they are NOT
  // touched (§17); check actual code (comments stripped) for zero usage.
  check('14. service-worker.js code never references localStorage', !/localStorage/.test(SW_CODE_ONLY));
  check('14. service-worker.js code never references indexedDB', !/indexedDB/i.test(SW_CODE_ONLY));

  console.log(`\n${pass}/${pass + fail} checks passed.`);
  if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
  console.log('ALL PASS.');
})();
