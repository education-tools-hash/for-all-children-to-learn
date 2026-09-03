/*
 * どのまな Service Worker — Minimal Foundation + Pilot Small App-Shell Precache
 * + First-Launch Offline Readiness Contract
 * (Phase T9-B、T9-C''のevent.waitUntil hardening、T9-C4のPilot Offline
 * Contract、T9-C5のFirst-Launch Offline Readiness Contract)
 *
 * 設計根拠: docs/design-system/donomana-pwa-architecture-v1_0.md
 *   - Offline Level B(Visited-app offline)。Full Site Precache禁止(§9/§11)。
 *     ※Pilotのみ例外としてinstall時precacheへ昇格(T9-C4、Pilot Small App
 *       Shell)。35アプリ全体のFull Precacheとは規模・方針が異なる。
 *   - Architecture B(App Shell + Runtime Cache)。非Pilotは引き続きRuntime
 *     Cache中心(訪問時にのみcache)、変更なし。
 *   - HTML: Network First + offline fallback(§8/§13)。
 *   - Controlled Update: skipWaiting()を無条件実行しない(§14/§23-26)。
 *   - localStorage/IndexedDBには一切触れない(§17、Critical Constraint)。
 *
 * Pilot Offline Contract(T9-C4):
 *   Pilotページは、Service Worker installが正常完了した時点でoffline-ready
 *   である。利用者が各Pilotページを事前訪問したことをoffline利用の前提と
 *   しない(T9-C''のiPad実機再検証で判明した、「訪問直後にHome Screen appを
 *   force-quitするとruntime cache書込みが完了しきらないことがある」という
 *   実機知見への対応。event.waitUntilによる保護だけでは、ページ訪問から
 *   force-quitまでの時間差が十分でない場合のraceを解消できないため)。
 *
 * First-Launch Offline Readiness Contract(T9-C5):
 *   「install途中でprocessが強制終了されてもoffline-ready」はWeb Platform上
 *   保証不能(T9-C4 Gate Aの実機失敗で確認済み)。T9-C5はこれを認め、代わりに
 *   「installが正常完了する前にforce-quitされた場合は、その旨を利用者(支援者
 *   /教員)へ明確に伝え、待ってから持ち出してもらう」という製品契約へ転換
 *   した。SW側はCHECK_OFFLINE_READYメッセージでREQUIRED_PRECACHE_URLSの
 *   実際のcache完全性を返すのみで、ready/UI状態管理はpwa-register.js側の
 *   責務(このファイルはfixed timeoutの概念を一切持たない)。
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

// Pilot Offline Contract(T9-C4)の対象asset。install完了時点でこの全件が
// cacheされていなければ、install自体を失敗させる(下記install handler参照)。
// Pilot 4ページ(トップ含む)+その専用JSのみ。他31アプリ・app-details・画像は
// 一切含めない(Full Site Precacheではない、非Pilot isolationを維持)。
var REQUIRED_PRECACHE_URLS = [
  '/',
  '/learning-records.html',
  '/janken-app.html',
  '/tokei-app.html',
  '/assets/js/pwa-register.js',
  '/assets/js/record-dashboard-foundation.js',
  '/assets/js/record-dashboard-ui.js'
];

// offline.html/site.webmanifestはPilot Offline Contractの必須条件ではない
// 付随asset(offline.htmlはPilotページ自体がSHELL_CACHEにprecacheされている
// 限り実際には参照されない最終fallback、site.webmanifestはinstall/表示用)。
// 従来どおり1件の失敗でinstall全体を失敗させないbest-effort(§45を維持)。
var OPTIONAL_PRECACHE_URLS = ['/offline.html', '/site.webmanifest'];

// Network First + runtime cache対象のnavigation先(§9のPilot allowlist)。
var PILOT_PATHS = ['/', '/learning-records.html', '/janken-app.html', '/tokei-app.html'];

function isPilotPath(pathname) {
  return PILOT_PATHS.indexOf(pathname) !== -1;
}

// ────────────────────────────────────────────────────────────
//  install: Pilot Offline Contract対象(REQUIRED)はatomicに全件成功させる
//  (1件でも失敗したらinstall全体を失敗させ、ブラウザに新SWを破棄させる。
//  失敗したinstallは次回のnavigator.serviceWorker.register()呼び出しで
//  自動的に再試行されるため、追加のretryロジックは不要)。これにより
//  「installは成功したのにPilotがoffline-readyでない」状態を防ぐ。
//  OPTIONAL(offline.html/site.webmanifest)は従来どおり個別catchで
//  best-effort(§45を維持、1件の失敗でinstall全体を失敗させない)。
// ────────────────────────────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      var required = Promise.all(
        REQUIRED_PRECACHE_URLS.map(function (url) {
          return cache.add(url); // 意図的にcatchしない(Pilot Offline Contract)
        })
      );
      var optional = Promise.all(
        OPTIONAL_PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () {
            // 1資産の取得失敗でinstall全体を失敗させない(§45)
          });
        })
      );
      return Promise.all([required, optional]);
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
      networkFirstNavigate(event, req);
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
//
// T9-C''(cache lifetime micro-fix): navigation fetchは1回だけ実行し、その
// 結果を2つの独立したExtendableEvent拡張へ橋渡しする。
//   - event.respondWith(...): ページへのresponse配信(既存Network First
//     +offline fallbackの挙動を完全維持。cache書込みの完了を待たない)。
//   - event.waitUntil(...): runtime cacheへの書込み。ここへ登録することで、
//     Service Worker仕様上「このFetchEventにはまだ保留中の作業がある」と
//     正式に扱われ、response配信後もbrowserがcache書込み完了前にworkerを
//     終了させない(以前の版は無保護のfire-and-forgetだったため、write未完了
//     のままworkerが終了され得た)。
// response bodyは一度しか読めないため、fetch結果が届いた直後に一度だけ
// res.clone()し、以降は元responseをrespondWith側、cloneをcache書込み側へ
// それぞれ渡す(二重fetch・二重読み込みを避ける)。
function networkFirstNavigate(event, req) {
  var networkFetch = fetch(req).then(function (res) {
    var cacheable = !!(res && res.ok);
    return { res: res, resForCache: cacheable ? res.clone() : null, cacheable: cacheable };
  });

  event.respondWith(
    networkFetch
      .then(function (result) {
        return result.res;
      })
      .catch(function () {
        return offlineFallbackForNavigate(req);
      })
  );

  event.waitUntil(
    networkFetch
      .then(function (result) {
        if (!result.cacheable) return; // non-okは従来どおりcacheしない(§14)
        return caches.open(RUNTIME_CACHE).then(function (cache) {
          return cache.put(req, result.resForCache);
        });
      })
      .catch(function () {
        // ネットワーク失敗時はcacheする対象がないため何もしない(既存fallback
        // はrespondWith側で別途処理済み)。cache書込み自体の失敗(quota超過等)
        // もここで吸収し、navigation responseには一切影響させない(§6)。
      })
  );
}

function offlineFallbackForNavigate(req) {
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
            // T9-C4: pwa-register.js/record-dashboard-*.jsはPilot Offline
            // Contract対象としてSHELL_CACHEへprecacheされている。一度も
            // オンラインで読み込まれずRUNTIME_CACHEに無い場合でも(未訪問
            // offline初回起動)、ここでSHELL_CACHEを確認してから諦める。
            return caches.match(req, { cacheName: SHELL_CACHE }).then(function (shellCached) {
              if (shellCached) return shellCached;
              return fetch(req); // どちらにも無ければ通常どおり失敗させる(偽装レスポンスを作らない)
            });
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
//
//  T9-C5(First-Launch Offline Readiness Contract): CHECK_OFFLINE_READY は
//  ページ側(pwa-register.js)がnavigator.serviceWorker.readyの解決後に
//  念のため送る、REQUIRED_PRECACHE_URLS完全性の内部的な再確認クエリ。
//  atomic install contract(T9-C4)により本来readyの時点で必ず全件揃って
//  いるはずだが、readiness UIというユーザー可視の機能である以上、SW側の
//  実データ(SHELL_CACHE)を直接確認してから「準備完了」を表示する
//  (推測や別経路の状態に依存しない、Source of Truthを一つに保つ)。
// ────────────────────────────────────────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'CHECK_OFFLINE_READY') {
    var respond = function (result) {
      if (event.ports && event.ports[0]) event.ports[0].postMessage(result);
    };
    var check = caches
      .open(SHELL_CACHE)
      .then(function (cache) {
        return Promise.all(
          REQUIRED_PRECACHE_URLS.map(function (url) {
            return cache.match(url).then(function (m) { return !!m; });
          })
        );
      })
      .then(function (results) {
        respond({ offlineReady: results.every(function (r) { return r; }) });
      })
      .catch(function () {
        respond({ offlineReady: false });
      });
    if (event.waitUntil) event.waitUntil(check);
  }
});
