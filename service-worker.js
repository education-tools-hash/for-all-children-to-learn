/*
 * どのまな Service Worker — Minimal Foundation + Visited-App Offline Pilot (Phase T9-B)
 *
 * 設計根拠: docs/design-system/donomana-pwa-architecture-v1_0.md
 *   - Offline Level B(Visited-app offline)。Full Precache禁止(§9/§11)。
 *   - Architecture B(App Shell + Runtime Cache)。
 *   - HTML: Network First + offline fallback(§8/§13)。
 *   - Controlled Update: skipWaiting()を無条件実行しない(§14/§23-26)。
 *   - localStorage/IndexedDBには一切触れない(§17、Critical Constraint)。
 *
 * Pilot allowlist(この3ページ+トップのみ、他ページの挙動は変えない、§9/§10):
 *   /            (App Shell、既存トップページ)
 *   /learning-records.html
 *   /janken-app.html
 *   /tokei-app.html
 *
 * 非Pilotページ(matching-app.html等)は、このService Workerが登録されていても
 * fetchをそのままネットワークへ素通しするだけで、cacheへの書込み・応答の
 * 差し替えを一切行わない(No-op原則、§10)。
 */
'use strict';

var VERSION = 'v1';
var SHELL_CACHE = 'donomana-shell-' + VERSION;
var RUNTIME_CACHE = 'donomana-runtime-' + VERSION;
var CACHE_PREFIX = 'donomana-';

// install時にprecacheする最小限のApp Shell(§11)。
// 個別アプリ・app-details・画像等は一切含めない。
var PRECACHE_URLS = ['/', '/offline.html', '/site.webmanifest'];

// Network First + runtime cache対象のnavigation先(§9のPilot allowlist)。
var PILOT_PATHS = ['/', '/learning-records.html', '/janken-app.html', '/tokei-app.html'];

function isPilotPath(pathname) {
  return PILOT_PATHS.indexOf(pathname) !== -1;
}

// ────────────────────────────────────────────────────────────
//  install: 最小Shellのみprecache。1件の失敗でinstall全体を
//  失敗させないよう、addAllではなく個別catchで進める(§45)。
// ────────────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () {
            // 1資産の取得失敗でinstall全体を失敗させない(§45)
          });
        })
      );
    })
  );
  // 注意: ここで self.skipWaiting() を呼ばない(Controlled Update、§23/§24)。
  // 新しいSWはwaiting状態のまま留まり、利用者が更新操作をするまで
  // 既存ページを制御し続ける現在のSWを置き換えない。
});

// ────────────────────────────────────────────────────────────
//  activate: このSWが作成したdonomana-*cacheのうち、現行版と異なる
//  ものだけを削除する。他originや無関係cacheには触れない(§28/§30)。
//  clients.claim()もここでは呼ばない(既存の開いているページの制御は
//  次回navigationまで変えない、予期しない挙動変化を避ける)。
// ────────────────────────────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) {
            return name.indexOf(CACHE_PREFIX) === 0 && name !== SHELL_CACHE && name !== RUNTIME_CACHE;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
});

// ────────────────────────────────────────────────────────────
//  fetch: GET・same-origin以外は一切介入しない(§41/§42)。
//  navigation(HTML)とsub-resourceで扱いを分ける。
// ────────────────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return; // POST等はcacheしない(§41)

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return; // cross-originはnative挙動へ任せる(§42)

  if (req.mode === 'navigate') {
    if (isPilotPath(url.pathname)) {
      event.respondWith(networkFirstNavigate(req));
    }
    // Pilot対象外のnavigationには一切介入しない(§9/§10 No-op原則)。
    return;
  }

  // sub-resource(JS/CSS/画像/フォント等): 要求元のページがPilotページの
  // 場合のみruntime cacheへ載せる。Pilot外のページから読み込まれた
  // アセットはcacheに触れずそのままfetchする(§9のPilot allowlist厳守)。
  event.respondWith(handleSubResource(event, req));
});

// HTML navigation: Network First。成功したらruntime cacheを更新。
// offline/network失敗時はruntime cache→Shell cache→offline.htmlの順で
// fallbackする(§13)。404/500等の非okレスポンスは正常教材としてcacheしない
// (§14)。
function networkFirstNavigate(req) {
  return fetch(req)
    .then(function (res) {
      if (res && res.ok) {
        var resClone = res.clone();
        caches.open(RUNTIME_CACHE).then(function (cache) {
          cache.put(req, resClone);
        });
      }
      return res;
    })
    .catch(function () {
      return caches
        .match(req, { cacheName: RUNTIME_CACHE })
        .then(function (cached) {
          if (cached) return cached;
          return caches.match(req, { cacheName: SHELL_CACHE });
        })
        .then(function (cached) {
          if (cached) return cached;
          return caches.match('/offline.html', { cacheName: SHELL_CACHE });
        })
        .then(function (offlinePage) {
          return offlinePage || new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    });
}

// sub-resource: 要求元client(ページ)のURLがPilot allowlistに含まれる
// 場合のみNetwork First的にruntime cacheへ保存する。それ以外は素通し
// (fetchの結果をそのまま返すのみ、cacheへは一切書き込まない)。
function handleSubResource(event, req) {
  return resolveClientUrl(event)
    .then(function (clientUrl) {
      var fromPilotPage = false;
      if (clientUrl) {
        try {
          var clientPath = new URL(clientUrl).pathname;
          fromPilotPage = isPilotPath(clientPath);
        } catch (e) {
          fromPilotPage = false;
        }
      }
      if (!fromPilotPage) {
        return fetch(req); // 非Pilotページ由来: 素通し、cache操作なし(§10)
      }
      return fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var resClone = res.clone();
            caches.open(RUNTIME_CACHE).then(function (cache) {
              cache.put(req, resClone);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req, { cacheName: RUNTIME_CACHE }).then(function (cached) {
            if (cached) return cached;
            return fetch(req); // cacheにもなければ通常どおり失敗させる(偽装レスポンスを作らない)
          });
        });
    });
}

function resolveClientUrl(event) {
  if (!event.clientId) return Promise.resolve(null);
  return self.clients
    .get(event.clientId)
    .then(function (client) {
      return client ? client.url : null;
    })
    .catch(function () {
      return null;
    });
}

// ────────────────────────────────────────────────────────────
//  message: 利用者が明示的に更新を選んだ場合のみskipWaiting()を実行する
//  (Controlled Update、§23-26)。自動では絶対に呼ばない。
// ────────────────────────────────────────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
