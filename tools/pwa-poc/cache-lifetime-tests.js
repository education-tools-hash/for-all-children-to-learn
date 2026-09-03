#!/usr/bin/env node
// Phase T9-C'' — Service Worker navigation cache-write lifetime tests.
//
// Loads the REAL service-worker.js source into a sandboxed VM context with
// mocked fetch/caches/event, and asserts on Promise SETTLEMENT ORDER itself
// (via explicit settlement flags flushed across microtask ticks), not on a
// fixed wall-clock wait_for_timeout(). This directly tests the structural
// defect fixed in T9-C'': the old code's cache.put() was a fire-and-forget
// chain not registered with event.waitUntil(), so nothing guaranteed it
// would finish before the browser could terminate the worker. These tests
// prove the NEW code (a) still delivers the navigation response without
// waiting for the cache write, and (b) genuinely registers the cache write
// with event.waitUntil() so its completion is part of the FetchEvent's
// extended lifetime, and (c) isolates cache-write failures from the
// navigation response and from unhandled promise rejections.
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

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush(ticks) {
  for (let i = 0; i < (ticks || 15); i++) await Promise.resolve();
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

function makeFetchEvent(req) {
  const event = {
    request: req,
    clientId: null,
    resultingClientId: null,
    respondWithCalled: false,
    respondWithSettled: false,
    respondWithValue: undefined,
    respondWithError: undefined,
    waitUntilCount: 0,
    waitUntilSettled: [],
    waitUntilRejected: [],
    respondWith(p) {
      event.respondWithCalled = true;
      Promise.resolve(p).then(
        (v) => { event.respondWithSettled = true; event.respondWithValue = v; },
        (e) => { event.respondWithSettled = true; event.respondWithError = e; }
      );
    },
    waitUntil(p) {
      const idx = event.waitUntilCount++;
      event.waitUntilSettled[idx] = false;
      event.waitUntilRejected[idx] = false;
      Promise.resolve(p).then(
        () => { event.waitUntilSettled[idx] = true; },
        () => { event.waitUntilSettled[idx] = true; event.waitUntilRejected[idx] = true; }
      );
    }
  };
  return event;
}

function pilotNavigateReq(pathOverride) {
  return { method: 'GET', url: 'https://example.test' + (pathOverride || '/tokei-app.html'), mode: 'navigate' };
}

async function unhandledRejectionGuard(fn) {
  let caught = null;
  const handler = (err) => { caught = err; };
  process.on('unhandledRejection', handler);
  try {
    await fn();
  } finally {
    process.off('unhandledRejection', handler);
  }
  return caught;
}

(async function () {
  console.log('=== A/B. cache write is registered with event.waitUntil(), response is NOT delayed by it ===');
  await unhandledRejectionGuard(async () => {
    const net = deferred();
    const put = deferred();
    let putCalled = false, cacheOpenCalled = false, fetchCallCount = 0;

    const fakeCache = { put: (req, res) => { putCalled = true; return put.promise; } };
    const listeners = loadSW({
      fetchImpl: (req) => { fetchCallCount++; return net.promise; },
      cachesImpl: {
        open: (name) => { cacheOpenCalled = true; return Promise.resolve(fakeCache); },
        match: () => Promise.resolve(undefined)
      }
    });

    const event = makeFetchEvent(pilotNavigateReq());
    listeners.fetch[0](event);

    check('respondWith called synchronously during fetch event dispatch', event.respondWithCalled === true);
    check('waitUntil called synchronously during fetch event dispatch (cache write registered)', event.waitUntilCount >= 1, { waitUntilCount: event.waitUntilCount });

    const okRes = new Response('<html>tokei</html>', { status: 200, statusText: 'OK' });
    net.resolve(okRes);
    await flush();

    check('B: navigation response settles WITHOUT waiting for cache.put to finish', event.respondWithSettled === true && !event.respondWithError);
    check('B: response value is the real network response (not delayed/replaced)', event.respondWithValue === okRes);
    check('A: waitUntil-registered cache-write promise is still PENDING while cache.put has not resolved (genuinely tracked, not already "done")', event.waitUntilSettled[0] === false);
    check('cache.put was actually invoked', putCalled === true);
    check('caches.open(RUNTIME_CACHE) was invoked', cacheOpenCalled === true);

    put.resolve();
    await flush();
    check('A: waitUntil-registered promise settles once cache.put genuinely completes (FetchEvent lifetime correctly extended)', event.waitUntilSettled[0] === true && event.waitUntilRejected[0] === false);

    check('F: fetch() was called exactly once for this navigation (no duplicate network fetch)', fetchCallCount === 1, { fetchCallCount });
  });

  console.log('\n=== C. cache.put() failure does not break the navigation response and produces no unhandled rejection ===');
  const unhandled1 = await unhandledRejectionGuard(async () => {
    const net = deferred();
    const fakeCache = { put: () => Promise.reject(new Error('QuotaExceededError (simulated)')) };
    const listeners = loadSW({
      fetchImpl: () => net.promise,
      cachesImpl: { open: () => Promise.resolve(fakeCache), match: () => Promise.resolve(undefined) }
    });
    const event = makeFetchEvent(pilotNavigateReq());
    listeners.fetch[0](event);
    const okRes = new Response('<html>ok</html>', { status: 200 });
    net.resolve(okRes);
    await flush();
    check('C: navigation response still succeeds despite cache.put() rejecting', event.respondWithSettled === true && event.respondWithValue === okRes && !event.respondWithError);
    check('C: cache-write failure is isolated (waitUntil promise settles, does not propagate as a rejection to the caller)', event.waitUntilSettled[0] === true && event.waitUntilRejected[0] === false);
    await flush(30); // extra margin for any stray unhandled rejection to surface
  });
  check('C: no unhandledRejection was ever emitted', unhandled1 === null, { unhandled1: String(unhandled1) });

  console.log('\n=== D. network failure falls back to existing runtime/shell cache (offline fallback preserved) ===');
  await unhandledRejectionGuard(async () => {
    const fallbackRes = new Response('<html>cached tokei (runtime)</html>', { status: 200 });
    const listeners = loadSW({
      fetchImpl: () => Promise.reject(new Error('network down (simulated offline)')),
      cachesImpl: {
        open: () => Promise.resolve({ put: () => Promise.resolve() }),
        match: (req, opts) => {
          if (opts && opts.cacheName === 'donomana-runtime-v1') return Promise.resolve(fallbackRes);
          return Promise.resolve(undefined);
        }
      }
    });
    const event = makeFetchEvent(pilotNavigateReq());
    listeners.fetch[0](event);
    await flush();
    check('D: offline navigation resolves with the cached runtime-cache page (not a network error)', event.respondWithSettled === true && event.respondWithValue === fallbackRes);
  });

  console.log('\n=== E. non-ok network response (e.g. 404/500) is never written to the cache ===');
  await unhandledRejectionGuard(async () => {
    let putCalled = false;
    const listeners = loadSW({
      fetchImpl: () => Promise.resolve(new Response('not found', { status: 404, statusText: 'Not Found' })),
      cachesImpl: {
        open: () => Promise.resolve({ put: () => { putCalled = true; return Promise.resolve(); } }),
        match: () => Promise.resolve(undefined)
      }
    });
    const event = makeFetchEvent(pilotNavigateReq());
    listeners.fetch[0](event);
    await flush();
    check('E: 404 response is still delivered to the page (Network First passes it through)', event.respondWithSettled === true && event.respondWithValue.status === 404);
    check('E: cache.put() is never called for a non-ok response', putCalled === false);
  });

  console.log('\n=== G. non-Pilot navigation is completely untouched (No-op principle preserved) ===');
  await unhandledRejectionGuard(async () => {
    let fetchCalled = false;
    const listeners = loadSW({
      fetchImpl: () => { fetchCalled = true; return Promise.resolve(new Response('x')); },
      cachesImpl: { open: () => Promise.resolve({ put: () => Promise.resolve() }), match: () => Promise.resolve(undefined) }
    });
    const event = makeFetchEvent(pilotNavigateReq('/matching-app.html'));
    listeners.fetch[0](event);
    await flush();
    check('G: respondWith is NEVER called for a non-Pilot navigation', event.respondWithCalled === false);
    check('G: waitUntil is NEVER called for a non-Pilot navigation', event.waitUntilCount === 0);
    check('G: the Service Worker never even calls fetch() itself for a non-Pilot navigation (native browser handling only)', fetchCalled === false);
  });

  console.log(`\n${pass}/${pass + fail} checks passed.`);
  if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
  console.log('ALL PASS.');
})();
