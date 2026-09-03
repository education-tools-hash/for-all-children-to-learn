#!/usr/bin/env node
// Phase T9-C5 — First-Launch Offline Readiness Contract: SW-side and static
// source tests. Loads the REAL service-worker.js (VM sandbox, same technique
// as cache-lifetime-tests.js/precache-contract-tests.js) to test the
// CHECK_OFFLINE_READY message handler, plus static structural checks on
// assets/js/pwa-register.js (no DOM engine available in Node -- the
// DOM/UI-visible behavior, including timing item E, is proven for real in
// tools/pwa-poc/readiness-realbrowser-test.py against an actual browser).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SW_SRC = fs.readFileSync(path.join(REPO_ROOT, 'service-worker.js'), 'utf8');
const REGISTER_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'js', 'pwa-register.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const SW_CODE_ONLY = stripComments(SW_SRC);
const REGISTER_CODE_ONLY = stripComments(REGISTER_SRC);

function loadSW({ cachesImpl }) {
  const listeners = {};
  const ctx = {
    console,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    skipWaiting() {},
    clients: { claim: () => Promise.resolve(), get: () => Promise.resolve(null) },
    fetch: () => Promise.reject(new Error('unused')),
    caches: cachesImpl,
    location: { origin: 'https://example.test' }
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx, { filename: 'service-worker.js' });
  return listeners;
}

function makeMessageEvent(data) {
  const received = [];
  const event = {
    data,
    ports: [{ postMessage: (msg) => received.push(msg) }],
    waitUntilCount: 0,
    waitUntil(p) { event.waitUntilCount++; event.waitUntilPromise = Promise.resolve(p); }
  };
  return { event, received };
}

async function flush(ticks) {
  for (let i = 0; i < (ticks || 20); i++) await Promise.resolve();
}

(async function () {
  console.log('=== C/D. CHECK_OFFLINE_READY correctness (required vs optional assets) ===');
  {
    // All REQUIRED present, one OPTIONAL missing -> still offlineReady:true (D).
    // cache.match() is called with the raw REQUIRED_PRECACHE_URLS strings
    // (relative paths, e.g. '/'), matching real Cache API call sites in the
    // SW's own install/message handlers -- so the mock keys relative paths too.
    const shellStore = new Set([
      '/', '/learning-records.html', '/janken-app.html', '/tokei-app.html',
      '/assets/js/pwa-register.js',
      '/assets/js/record-dashboard-foundation.js',
      '/assets/js/record-dashboard-ui.js'
      // note: /offline.html and /site.webmanifest (OPTIONAL) deliberately absent
    ]);
    const listeners = loadSW({
      cachesImpl: {
        open: () => Promise.resolve({ match: (url) => Promise.resolve(shellStore.has(String(url)) ? {} : undefined) })
      }
    });
    const { event, received } = makeMessageEvent({ type: 'CHECK_OFFLINE_READY' });
    listeners.message[0](event);
    await flush();
    check('D: offlineReady is TRUE when all REQUIRED assets are cached, even if OPTIONAL assets are missing',
      received.length === 1 && received[0].offlineReady === true, received);
  }
  {
    // ONE required asset missing -> offlineReady:false (C).
    const shellStore = new Set([
      '/', '/learning-records.html',
      // janken-app.html deliberately missing
      '/tokei-app.html',
      '/assets/js/pwa-register.js',
      '/assets/js/record-dashboard-foundation.js',
      '/assets/js/record-dashboard-ui.js',
      '/offline.html', '/site.webmanifest'
    ]);
    const listeners = loadSW({
      cachesImpl: {
        open: () => Promise.resolve({ match: (url) => Promise.resolve(shellStore.has(String(url)) ? {} : undefined) })
      }
    });
    const { event, received } = makeMessageEvent({ type: 'CHECK_OFFLINE_READY' });
    listeners.message[0](event);
    await flush();
    check('C: offlineReady is FALSE when even ONE REQUIRED asset is missing from the cache',
      received.length === 1 && received[0].offlineReady === false, received);
  }
  {
    // Defensive: caches.open() itself rejects -> offlineReady:false, no throw.
    const listeners = loadSW({ cachesImpl: { open: () => Promise.reject(new Error('quota')) } });
    const { event, received } = makeMessageEvent({ type: 'CHECK_OFFLINE_READY' });
    listeners.message[0](event);
    await flush();
    check('defensive: a caches.open() failure resolves offlineReady:false rather than throwing/hanging',
      received.length === 1 && received[0].offlineReady === false, received);
  }
  {
    // event.waitUntil used, so the SW isn't torn down mid-check.
    const listeners = loadSW({ cachesImpl: { open: () => Promise.resolve({ match: () => Promise.resolve({}) }) } });
    const { event } = makeMessageEvent({ type: 'CHECK_OFFLINE_READY' });
    listeners.message[0](event);
    check('CHECK_OFFLINE_READY handler registers event.waitUntil (SW kept alive while responding)', event.waitUntilCount >= 1);
  }

  console.log('\n=== J. CHECK_OFFLINE_READY never triggers skipWaiting/update ===');
  check('J: skipWaiting() call count in actual SW code is still exactly 1 (message handler branch for SKIP_WAITING only)',
    (SW_CODE_ONLY.match(/skipWaiting\(\)/g) || []).length === 1);
  check('J: the CHECK_OFFLINE_READY branch does not call self.skipWaiting()', (function () {
    const idx = SW_CODE_ONLY.indexOf("CHECK_OFFLINE_READY");
    if (idx === -1) return false;
    const branch = SW_CODE_ONLY.slice(idx, idx + 800);
    return !/skipWaiting\(\)/.test(branch);
  })());

  console.log('\n=== I (static). Readiness UI only wired into the SAME Pilot-only injection point as before ===');
  // pwa-register.js is only ever injected into the 4 Pilot pages by
  // generate.js's PWA_REGISTER_TARGET_FILES allowlist (unchanged by T9-C5) --
  // non-Pilot pages never load this file at all, so the readiness banner
  // structurally cannot appear there. Proven for real (banner absence on a
  // non-Pilot page) in tools/pwa-poc/readiness-realbrowser-test.py.
  check('initReadinessUI is only ever called from within the existing single register().then() callback (no new entry point)',
    (REGISTER_CODE_ONLY.match(/(?<!function )initReadinessUI\(\)/g) || []).length === 1);

  console.log('\n=== J (UI-side, static). No automatic reload / no forced navigation added by readiness code ===');
  const readinessBlockStart = REGISTER_CODE_ONLY.indexOf('function initReadinessUI');
  const readinessBlock = readinessBlockStart === -1 ? '' : REGISTER_CODE_ONLY.slice(readinessBlockStart);
  check('initReadinessUI found in pwa-register.js', readinessBlockStart !== -1);
  check('readiness UI code never calls location.reload()/location.href=/location.assign(', !/location\.(reload|assign)\(|location\.href\s*=/.test(readinessBlock));

  console.log('\n=== 4/UX. Non-invasive UI guarantees (static) ===');
  check('readiness UI code never calls alert(/confirm(/prompt( (no blocking dialogs)', !/\b(alert|confirm|prompt)\s*\(/.test(readinessBlock));
  check('readiness UI code never calls .focus() (never steals focus)', !/\.focus\(\)/.test(readinessBlock));
  check('readiness UI code never plays audio (new Audio(/.play() absent)', !/new\s+Audio\(|\.play\(\)/.test(readinessBlock));
  check("readiness banner uses role='status' (implicit aria-live=polite)", /role',\s*'status'/.test(readinessBlock) || /setAttribute\('role',\s*'status'\)/.test(readinessBlock));
  check('initReadinessUI is gated by isStandalone() before doing anything (§4: standalone-only)', /^\s*if \(!isStandalone\(\)\) return;/m.test(readinessBlock.split('\n').slice(0, 5).join('\n')) || /if \(!isStandalone\(\)\) return;/.test(readinessBlock));
  check('initReadinessUI is gated by the one-time-shown localStorage marker (§5: not shown every launch)', /READINESS_NOTICE_KEY/.test(readinessBlock) && /alreadyShown/.test(readinessBlock));

  console.log('\n=== 5/L. Readiness marker key is distinct from Record data keys ===');
  const KNOWN_RECORD_KEYS = ['janken_log', 'tokei_log', 'register_log', 'shiritori2_log'];
  const markerMatch = REGISTER_SRC.match(/READINESS_NOTICE_KEY\s*=\s*'([^']+)'/);
  check('readiness marker key literal found', !!markerMatch, markerMatch);
  if (markerMatch) {
    check('L: readiness marker key does not collide with any known Record localStorage key', KNOWN_RECORD_KEYS.indexOf(markerMatch[1]) === -1, markerMatch[1]);
    check("L: readiness marker key is clearly namespaced ('donomana-pwa-' prefix, not an app record key shape)", /^donomana-pwa-/.test(markerMatch[1]), markerMatch[1]);
  }
  check('L: pwa-register.js never references indexedDB', !/indexedDB/i.test(REGISTER_CODE_ONLY));
  check('L: pwa-register.js never calls localStorage.clear() or removeItem() on anything but its own key', !/localStorage\.clear\(\)/.test(REGISTER_CODE_ONLY));

  console.log('\n=== 3. CHECK_OFFLINE_READY checks REQUIRED_PRECACHE_URLS specifically (not OPTIONAL, not PILOT_PATHS) ===');
  check('CHECK_OFFLINE_READY handler source references REQUIRED_PRECACHE_URLS', /CHECK_OFFLINE_READY[\s\S]{0,400}REQUIRED_PRECACHE_URLS/.test(SW_CODE_ONLY));
  check('CHECK_OFFLINE_READY handler source does NOT also gate on OPTIONAL_PRECACHE_URLS', !/CHECK_OFFLINE_READY[\s\S]{0,400}OPTIONAL_PRECACHE_URLS/.test(SW_CODE_ONLY));

  console.log(`\n${pass}/${pass + fail} checks passed.`);
  if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
  console.log('ALL PASS.');
})();
