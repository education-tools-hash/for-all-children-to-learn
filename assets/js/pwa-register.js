/*
 * どのまな Service Worker 登録 + Controlled Update UI + First-Launch
 * Offline Readiness UI (Phase T9-B、T9-C5)
 *
 * generate.jsの冪等注入(<!-- pwa-register: 自動挿入 (generate.js) -->)経由で
 * Top(index.html)＋Pilot 3ページ(learning-records.html/janken-app.html/
 * tokei-app.html)にのみ読み込まれる。他31アプリには読み込ませない
 * (§21、全35アプリへの個別script貼付は禁止)。
 *
 * 設計根拠: docs/design-system/donomana-pwa-architecture-v1_0.md
 *   - 登録失敗時も通常利用を壊さない(Progressive Enhancement、§22)。
 *   - 新versionのSWがwaitingになっても自動reloadしない。利用者が
 *     「更新する」ボタンを押した場合のみ更新を適用する(Controlled
 *     Update、§23-26)。
 *
 * First-Launch Offline Readiness Contract(T9-C5):
 *   「installが正常完了する前にforce-quitされたらoffline-readyになり得ない」
 *   というWeb Platform上の限界(T9-C4 Gate Aの実機失敗で確認)を、固定秒数の
 *   お願いではなく、実際のreadiness signal(navigator.serviceWorker.ready)
 *   に基づく状態表示で利用者へ正しく伝える。standalone初回起動時のみ、
 *   「準備中…」→「準備ができました」を非侵襲的に表示する(§4)。
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var refreshing = false;
  var READINESS_NOTICE_KEY = 'donomana-pwa-readiness-notice-shown';

  function isStandalone() {
    try {
      return (
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        navigator.standalone === true // 旧iOS Safari
      );
    } catch (e) {
      return false;
    }
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js').then(function (reg) {
      // 登録直後に既にwaitingなSWがいる場合(タブを開いたまま別タブで更新された等)
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdatePrompt(reg);
      }
      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          // controllerが既に存在する(=初回installではなく既存ページがある)
          // 場合のみ「更新」であり、通知する価値がある。初回installでは
          // 通知不要(新しく開いただけなので「更新」ではない)。
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdatePrompt(reg);
          }
        });
      });
      initReadinessUI();
    }).catch(function () {
      // 登録失敗は致命的にしない(Progressive Enhancement、§22)。
      // 通常のページ利用(localStorage保存等)には一切影響しない。
    });
  });

  // 利用者が「更新する」を押した時だけcontrollerchangeでreloadする。
  // 明示操作なしでは絶対にreloadしない(§23/§26)。
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  function showUpdatePrompt(reg) {
    if (document.getElementById('donomanaPwaUpdateBanner')) return; // 二重表示防止

    var banner = document.createElement('div');
    banner.id = 'donomanaPwaUpdateBanner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed', 'left:16px', 'right:16px', 'bottom:16px', 'z-index:9999',
      'max-width:420px', 'margin:0 auto',
      'background:#00857B', 'color:#fff', 'border-radius:16px',
      'padding:14px 16px', 'display:flex', 'align-items:center', 'gap:12px',
      'flex-wrap:wrap', 'font-family:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif',
      'font-size:14px', 'font-weight:700', 'box-shadow:0 6px 20px rgba(0,0,0,.25)'
    ].join(';');

    var text = document.createElement('span');
    text.textContent = '新しいバージョンがあります';
    text.style.flex = '1 1 auto';

    var updateBtn = document.createElement('button');
    updateBtn.type = 'button';
    updateBtn.textContent = '更新する';
    updateBtn.style.cssText = 'min-height:44px;min-width:44px;padding:8px 18px;border:none;border-radius:999px;background:#fff;color:#00857B;font:inherit;font-weight:900;cursor:pointer';
    updateBtn.addEventListener('click', function () {
      updateBtn.disabled = true;
      dismissBtn.disabled = true;
      text.textContent = '更新しています…';
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.textContent = '後で';
    dismissBtn.setAttribute('aria-label', '更新通知を閉じる');
    dismissBtn.style.cssText = 'min-height:44px;min-width:44px;padding:8px 14px;border:none;border-radius:999px;background:transparent;color:#fff;font:inherit;font-weight:700;cursor:pointer;text-decoration:underline';
    dismissBtn.addEventListener('click', function () {
      banner.remove();
    });

    banner.appendChild(text);
    banner.appendChild(updateBtn);
    banner.appendChild(dismissBtn);
    document.body.appendChild(banner);
  }

  // ────────────────────────────────────────────────────────────
  //  First-Launch Offline Readiness UI(T9-C5)
  //
  //  Source of Truthはnavigator.serviceWorker.ready(§3)。readyはこのSWの
  //  install handlerがREQUIRED_PRECACHE_URLS全件をatomicに(1件でも失敗した
  //  ら全体を失敗させて)cacheし終えるまで、新規registrationでは絶対に
  //  resolveしない(T9-C4のinstall atomicity)。resolve後、念のため
  //  CHECK_OFFLINE_READYメッセージでSW側の実データ(SHELL_CACHE)を直接確認
  //  してから「準備完了」を表示する(fixed timeoutは一切使わない。唯一の
  //  setTimeoutは、応答が万一返らない場合の保険と、表示済みtoastの自動非
  //  表示という演出上のcosmeticな用途のみで、readiness判定そのものには
  //  使わない)。
  // ────────────────────────────────────────────────────────────
  function checkOfflineReady(reg) {
    return new Promise(function (resolve) {
      if (!reg.active) { resolve(false); return; }
      var settled = false;
      var channel = new MessageChannel();
      channel.port1.onmessage = function (e) {
        if (settled) return;
        settled = true;
        resolve(!!(e.data && e.data.offlineReady));
      };
      try {
        reg.active.postMessage({ type: 'CHECK_OFFLINE_READY' }, [channel.port2]);
      } catch (e) {
        resolve(false);
        return;
      }
      // 応答が返らない万一の場合の保険(readinessの判定基準ではない、
      // 「確認できなかった」という否定的な結果へのfallbackのみ)。
      setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(false);
      }, 5000);
    });
  }

  function initReadinessUI() {
    if (!isStandalone()) return; // §4: standalone初回起動時のみ
    var alreadyShown = false;
    try { alreadyShown = window.localStorage.getItem(READINESS_NOTICE_KEY) === 'true'; } catch (e) {}
    if (alreadyShown) return; // §5: 2回目以降の通常起動では毎回表示しない

    var hideTimer = null;
    var maxWaitTimer = null;

    showReadinessBanner('準備中', 'オフラインでも使えるように準備しています…');

    // 演出上の上限(§4「長時間残さない」)。readiness判定そのものには使わない
    // -- readyが遅れて解決した場合は、この後の.then内で改めて正しく表示する。
    maxWaitTimer = setTimeout(function () {
      hideReadinessBanner();
    }, 20000);

    navigator.serviceWorker.ready
      .then(function (reg) { return checkOfflineReady(reg); })
      .then(function (offlineReady) {
        if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null; }
        if (offlineReady) {
          showReadinessBanner('準備完了', 'オフラインで使う準備ができました');
          try { window.localStorage.setItem(READINESS_NOTICE_KEY, 'true'); } catch (e) {}
          hideTimer = setTimeout(hideReadinessBanner, 5000);
        } else {
          hideReadinessBanner();
        }
      })
      .catch(function () {
        if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null; }
        hideReadinessBanner();
      });
  }

  function showReadinessBanner(title, message) {
    var banner = document.getElementById('donomanaPwaReadinessBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'donomanaPwaReadinessBanner';
      // role=statusは暗黙にaria-live=polite(§4)。modalにしない・focusを
      // 奪わない(tabindex/autofocus/.focus()を一切使わない)・音を鳴らさ
      // ない・教材操作をblockしない(pointer-events以外は通常のflow外の
      // 固定要素、教材本体のDOM/操作には一切干渉しない)。
      banner.setAttribute('role', 'status');
      banner.style.cssText = [
        'position:fixed', 'left:16px', 'right:16px', 'top:16px', 'z-index:9998',
        'max-width:420px', 'margin:0 auto',
        'background:#3B4A54', 'color:#fff', 'border-radius:16px',
        'padding:12px 16px', 'display:flex', 'align-items:center', 'gap:10px',
        'font-family:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif',
        'font-size:13px', 'font-weight:700', 'box-shadow:0 4px 16px rgba(0,0,0,.2)',
        // motionは控えめ(§4): transformの一瞬のfadeのみ、bounce/scale等はしない
        'opacity:0', 'transition:opacity .3s ease'
      ].join(';');
      var text = document.createElement('span');
      text.id = 'donomanaPwaReadinessText';
      banner.appendChild(text);
      document.body.appendChild(banner);
      // 初期opacity:0からのfade-in(reflow後に適用)。
      window.requestAnimationFrame(function () {
        banner.style.opacity = '1';
      });
    }
    // title自体はaria-label等の別経路にせず、可視textContentへそのまま含める
    // (role=statusのlive region注釈は変化したtext contentを基準に読み上げら
    // れるため、視覚表示と読み上げ内容を一致させ、二重読み上げ/不一致を防ぐ)。
    var textEl = document.getElementById('donomanaPwaReadinessText');
    if (textEl) textEl.textContent = title + ': ' + message;
    return banner;
  }

  function hideReadinessBanner() {
    var banner = document.getElementById('donomanaPwaReadinessBanner');
    if (!banner) return;
    banner.remove();
  }
})();
