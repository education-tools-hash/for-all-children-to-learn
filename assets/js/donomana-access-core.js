// Donomana Access（開発版）— 入力・反応の純粋ロジック
// DOM操作を直接は行わず、どのまな本体の既存共通基盤には一切変更を加えない
// (Switch Scan仕様書・Learning Record Foundation等、既存ファイルは不変のまま、
// Access側で同等のロジックを新規に実装する)。
// ブラウザの<script>タグからも、Node.jsのrequire()からも読み込める
// (assets/js/record-dashboard-foundation.jsと同じ慣習)。
'use strict';
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DonomanaAccessCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var VALID_INPUT_METHODS = ['touch', 'switch', 'keyboard'];
  var VALID_TYPES = ['activate', 'move', 'release', 'cancel'];

  // makeEvent(): 共通入力イベントschema（Design Approval文書3章）に準拠したオブジェクトを
  // 生成する。観測できない値はnullのまま保持し、推定・補完しない。入力方式間で無意味な
  // 数値比較をしないという設計原則により、durationは記録するが評価には使わない。
  function makeEvent(opts) {
    opts = opts || {};
    if (VALID_TYPES.indexOf(opts.type) === -1) {
      throw new Error('DonomanaAccessCore.makeEvent: invalid type "' + opts.type + '"');
    }
    if (VALID_INPUT_METHODS.indexOf(opts.inputMethod) === -1) {
      throw new Error('DonomanaAccessCore.makeEvent: invalid inputMethod "' + opts.inputMethod + '"');
    }
    var hasPos = opts.position && typeof opts.position.x === 'number' && typeof opts.position.y === 'number';
    var hasMove = opts.movement && typeof opts.movement.dx === 'number' && typeof opts.movement.dy === 'number';
    return {
      type: opts.type,
      inputMethod: opts.inputMethod,
      timestamp: typeof opts.timestamp === 'number' ? opts.timestamp : null,
      duration: typeof opts.duration === 'number' ? opts.duration : null,
      position: hasPos ? { x: opts.position.x, y: opts.position.y } : null,
      movement: hasMove ? { dx: opts.movement.dx, dy: opts.movement.dy } : null
    };
  }

  // computeDuration(): 開始・終了のタイムスタンプから持続時間を求める。片方でも欠けていれば
  // nullを返す（存在しない値を0等で代用しない）。
  function computeDuration(startTs, endTs) {
    if (typeof startTs !== 'number' || typeof endTs !== 'number') return null;
    return Math.max(0, endTs - startTs);
  }

  // createRepeatGuard(): OSのキーリピート（キー/スイッチを押し続けた場合に発生する
  // 連続keydown）による重複activate発火を防ぐ最小の状態機械。
  // 本Phaseで新たに確認した既存のギャップ（directions-app.html等、既存21アプリの
  // Switch Scan決定操作にはe.repeatチェックが存在しない、Design Approval文書4.2節）
  // への対応であり、既存アプリ側のコードは変更しない。
  function createRepeatGuard() {
    var pressed = Object.create(null);
    return {
      // onKeyDown(): trueを返した場合のみactivateを発火してよい。
      // isRepeatはキーボード/スイッチのe.repeatをそのまま渡す。
      onKeyDown: function (key, isRepeat) {
        if (isRepeat) return false;
        if (pressed[key]) return false; // keyupを取り逃した場合の保険（二重押下開始の防止）
        pressed[key] = true;
        return true;
      },
      // onKeyUp(): trueを返した場合のみreleaseを発火してよい（押されていた場合のみ）。
      onKeyUp: function (key) {
        if (!pressed[key]) return false;
        delete pressed[key];
        return true;
      },
      // releaseAll(): blur・画面離脱・入力方式切替時に、押されたままの状態をすべて解除する。
      // 解除されたキー一覧を返す（呼び出し側がrelease相当のイベントを発火する場合に使える）。
      releaseAll: function () {
        var keys = Object.keys(pressed);
        pressed = Object.create(null);
        return keys;
      },
      isPressed: function (key) { return !!pressed[key]; }
    };
  }

  // buildScanItems(): Switch Scan共通パターンの一般化（directions-app.html
  // buildScanItems、Strategy A: [data-scan],.scannableの明示marker方式を踏襲）。
  // 既存アプリのコードそのものではなく、Access側で同等の挙動を新規実装したもの。
  function buildScanItems(rootEl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return [];
    var all = Array.prototype.slice.call(rootEl.querySelectorAll('[data-scan],.scannable'));
    return all.filter(function (el) {
      if (el.disabled || el.hasAttribute('hidden')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
      return true;
    });
  }

  return {
    VALID_INPUT_METHODS: VALID_INPUT_METHODS,
    VALID_TYPES: VALID_TYPES,
    makeEvent: makeEvent,
    computeDuration: computeDuration,
    createRepeatGuard: createRepeatGuard,
    buildScanItems: buildScanItems
  };
});
