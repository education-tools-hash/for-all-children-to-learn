/*
 * どのまな Service Worker 登録 + Controlled Update UI (Phase T9-B)
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
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var refreshing = false;

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
})();
