/*
 * どのまな さわってひろがる — Record Detail / CSV Shared Logic
 * (Phase SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1)
 *
 * sawatte-hirogaru-app.html（App-local）と learning-records.html（共通
 * 「学習の記録」）の両方から読み込み、ラベル変換・Level 2 detail行の組み立て・
 * Summary CSV/Trace CSVの行生成を**同一関数**として共有する（Cross-App Detail
 * Contract §9 Shared Formatter方針・§11/§34 CSV Parity「同じCSV row builderを
 * できる限り共有」）。App固有のsemanticsの Source of Truth は
 * docs/design-system/donomana-sawatte-hirogaru-trace-record-contract-v1_0.md
 * および SAWATTE-HIROGARU-TRACE-RECORD-USER-REVIEW-1-RETRY で確定した意味
 * （totalInteractions/tapCount/swipeCountの定義）をそのまま踏襲する（§7
 * App-owned Semantics）。
 *
 * Over-abstraction禁止（Cross-App Contract §15）: 他アプリ用の汎用formatterに
 * しない。さわってひろがる専用のfile。
 *
 * trace schemaの検証・canvas描画はここでは扱わない
 * （assets/js/record-trace-renderer.js の責務、§23/§24の分離を踏襲）。
 *
 * Runtime: ブラウザ(window.donomanaSawatteHirogaruRecordDetail)とNode.js
 * (require)の両方で動作するUMD風の最小ラッパー（既存record-dashboard-*.jsと
 * 同じパターン）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaSawatteHirogaruRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ────────────────────────────────────────────────────────────
  //  Label maps（sawatte-hirogaru-app.htmlのMODES/INTENSITIES/EFFECT_WIDTHS/
  //  EFFECT_SOUNDS配列と同じicon+labelのデータを独立に持つ。App-localのこれら
  //  配列はTeacher Settings UI構築など表示以外の用途にも使われ続けるため
  //  そちらは変更しない。既存の「各ファイルが自分の分を持つ」慣習を踏襲
  //  （record-dashboard-ui.js冒頭コメント参照）。
  // ────────────────────────────────────────────────────────────

  var MODE_LABEL = {
    light: '✨ ひかり',
    sound: '🔔 おと',
    light_sound: '🌟 ひかり＋おと',
    swipe: '🌊 スワイプ'
  };
  var INTENSITY_LABEL = {
    gentle: '🌙 やさしい',
    standard: '🌤️ ふつう',
    strong: '☀️ はっきり'
  };
  var EFFECT_WIDTH_LABEL = {
    'very-thin': '⚬ 極細',
    'thin': '○ 細い',
    'normal': '◎ ふつう',
    'thick': '◉ 太い',
    'very-thick': '⬤ 極太'
  };
  var EFFECT_SOUND_LABEL = {
    soft: '💠 やわらかい電子音',
    sparkle: '✨ キラキラ',
    pop: '🫧 ポン',
    drop: '💧 水滴',
    bell: '🔔 ベル',
    xylophone: '🎼 木琴'
  };

  // sawatte-hirogaru-app.htmlのdonomanaRecordFormatInputMethodと同一のMAP
  // （あちらはgenerate.js自動挿入のFoundation共通block内にあり編集対象外の
  // ため、このfileは独立した同一内容のコピーを持つ）。
  function formatInputMethod(inputMethod) {
    var MAP = { touch: 'タッチ', gaze: '視線', switch: 'スイッチ', keyboard: 'キーボード', click: 'クリック' };
    if (inputMethod === null || inputMethod === undefined) return null;
    return MAP[inputMethod] || null;
  }

  // sawatte-hirogaru-app.htmlのformatDurationと同一。
  function formatDuration(ms) {
    var totalSec = Math.round((ms || 0) / 1000);
    var m = Math.floor(totalSec / 60), s = totalSec % 60;
    return m > 0 ? (m + 'ふん' + s + 'びょう') : (s + 'びょう');
  }

  // sawatte-hirogaru-app.htmlのcsvDateTimeParts（Excel互換のdot区切り日付、
  // donomanaRecordFormatCsvDateTimeと同型）と同一。
  function formatCsvDateTime(timestamp) {
    if (!timestamp) return { date: '', time: '' };
    var d = new Date(timestamp);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return {
      date: d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()),
      time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
    };
  }

  // ────────────────────────────────────────────────────────────
  //  Trace validity（trace schemaの検証責務自体はrecord-trace-renderer.js
  //  にあるが、このfileはそれを実行時依存にしない設計（既存UMD moduleどうしが
  //  互いをrequireしない既存パターンを踏襲、record-dashboard-foundation.js/
  //  record-dashboard-ui.jsの構成と同型）。呼び出し側が両方を読み込んだ上で
  //  donomanaRecordTraceRenderer.isValidTrace()を直接使うことを推奨するが、
  //  trace引数を渡さずpayloadのみでCSV行を組み立てたい場合のため、この
  //  file単体でも動く最小限の同一ロジックを保持する（record-trace-renderer.js
  //  のisValidTraceと仕様を同期させること）。
  // ────────────────────────────────────────────────────────────

  function validFlatArray(arr) {
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (typeof v !== 'number' || !isFinite(v)) return false;
      if (i % 3 !== 2 && (v < 0 || v > 1000)) return false;
      if (i % 3 === 2 && v < 0) return false;
    }
    return true;
  }
  function isValidTrace(trace) {
    if (!trace || typeof trace !== 'object') return false;
    if (trace.traceSchemaVersion !== 1) return false;
    if (!Array.isArray(trace.taps) || !Array.isArray(trace.swipes)) return false;
    if (trace.taps.length % 3 !== 0) return false;
    if (!validFlatArray(trace.taps)) return false;
    for (var s = 0; s < trace.swipes.length; s++) {
      var stroke = trace.swipes[s];
      if (!Array.isArray(stroke) || stroke.length === 0 || stroke.length % 3 !== 0) return false;
      if (!validFlatArray(stroke)) return false;
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows（Cross-App Contract §19の必須fieldのうち、
  //  日時/教材はCommon Detail modal側が既に表示するため、ここでは残りを
  //  返す。順序・文言はApp-local showSummary()/CSVと揃える）。
  //  legacy record（optional field欠落）でも壊れないよう、fieldが無い場合は
  //  行自体を省略する（存在しない値を推測で埋めない、§6/§15 Fallback）。
  // ────────────────────────────────────────────────────────────

  function getDetailRows(payload) {
    payload = payload || {};
    var rows = [];
    if (MODE_LABEL[payload.mode]) rows.push({ label: 'つかった モード', value: MODE_LABEL[payload.mode] });
    if (typeof payload.durationMs === 'number') rows.push({ label: 'かつどう じかん', value: formatDuration(payload.durationMs) });
    if (typeof payload.totalInteractions === 'number') rows.push({ label: 'そうさした かいすう', value: payload.totalInteractions + ' かい' });
    if (typeof payload.tapCount === 'number') rows.push({ label: 'タップした かいすう', value: payload.tapCount + ' かい' });
    if (typeof payload.swipeCount === 'number') rows.push({ label: 'スワイプした かいすう', value: payload.swipeCount + ' かい' });
    if (Array.isArray(payload.inputMethods)) {
      var methodLabels = payload.inputMethods.map(function (m) { return formatInputMethod(m) || m; }).join('・');
      rows.push({ label: 'つかった そうさ', value: methodLabels || '（なし）' });
    }
    if (typeof payload.soundEnabled === 'boolean') rows.push({ label: '音', value: payload.soundEnabled ? 'ON' : 'OFF' });
    if (INTENSITY_LABEL[payload.intensity]) rows.push({ label: 'しげきの つよさ', value: INTENSITY_LABEL[payload.intensity] });
    if (EFFECT_WIDTH_LABEL[payload.effectWidth]) rows.push({ label: 'エフェクトの太さ', value: EFFECT_WIDTH_LABEL[payload.effectWidth] });
    if (EFFECT_SOUND_LABEL[payload.effectSound]) rows.push({ label: 'エフェクト音', value: EFFECT_SOUND_LABEL[payload.effectSound] });
    rows.push({ label: '軌跡記録', value: isValidTrace(payload.trace) ? 'あり' : 'なし' });
    return rows;
  }

  // Common Timeline一覧の1行summary（Level 1）。個人情報・自由入力を含まない
  // （record-dashboard-foundation.js冒頭方針と同一原則）。
  function summaryText(payload) {
    payload = payload || {};
    var n = (typeof payload.totalInteractions === 'number') ? payload.totalInteractions : null;
    if (n === null) return 'さわってひろがるに取り組みました';
    return 'さわってひろがるで' + n + 'かい操作しました';
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（sawatte-hirogaru-app.htmlのCSV_HEADER_SUMMARY/CSV_HEADER_TRACE/
  //  buildSummaryCsvRows/buildTraceCsvRowsと完全に同一の列構成・行内容。
  //  App-local側はこのfileの関数を薄いwrapper経由で直接呼ぶ（重複実装禁止、
  //  Cross-App Contract §34/§35）。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER_SUMMARY = ['日付', '時刻', '教材', 'モード', '活動時間（秒）', '操作回数', 'タップ回数', 'スワイプ回数', '操作方法', '音', '刺激の強さ', 'エフェクトの太さ', '効果音', '軌跡記録'];
  var CSV_HEADER_TRACE = ['日付', '時刻', 'セッションID', '操作番号', '種類', '点番号', 'X座標（相対位置）', 'Y座標（相対位置）', '経過ミリ秒'];

  function buildSummaryCsvRows(log) {
    var rows = [CSV_HEADER_SUMMARY.slice()];
    (log || []).forEach(function (entry) {
      // Malformed individual entry (null/string/number/array) — skip rather
      // than throw. App-local's own log is always self-written so this never
      // triggered there, but the Common Detail CSV button (§11/§31) reads via
      // readAppRecords(), which — unlike normalizeOneEntry() — does not
      // pre-filter non-object entries, so this guard is required here.
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      var payload = (entry && entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
      var dt = formatCsvDateTime(entry.timestamp);
      var methodLabels = Array.isArray(payload.inputMethods) ? payload.inputMethods.map(function (m) { return formatInputMethod(m) || m; }).join('・') : '';
      rows.push([
        dt.date, dt.time, 'さわってひろがる',
        MODE_LABEL[payload.mode] || payload.mode || '',
        (typeof payload.durationMs === 'number') ? Math.round(payload.durationMs / 1000) : '',
        (typeof payload.totalInteractions === 'number') ? payload.totalInteractions : '',
        (typeof payload.tapCount === 'number') ? payload.tapCount : '',
        (typeof payload.swipeCount === 'number') ? payload.swipeCount : '',
        methodLabels,
        (typeof payload.soundEnabled === 'boolean') ? (payload.soundEnabled ? 'ON' : 'OFF') : '',
        INTENSITY_LABEL[payload.intensity] || payload.intensity || '',
        EFFECT_WIDTH_LABEL[payload.effectWidth] || payload.effectWidth || '',
        EFFECT_SOUND_LABEL[payload.effectSound] || payload.effectSound || '',
        isValidTrace(payload.trace) ? 'あり' : 'なし'
      ]);
    });
    return rows;
  }

  function buildTraceCsvRows(log) {
    var rows = [CSV_HEADER_TRACE.slice()];
    (log || []).forEach(function (entry, entryIdx) {
      // See buildSummaryCsvRows above for why this guard is needed here.
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      var payload = (entry && entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
      if (!isValidTrace(payload.trace)) return;
      var dt = formatCsvDateTime(entry.timestamp);
      var sessionId = (entry.timestamp || ('session' + entryIdx)) + '_' + entryIdx;
      var trace = payload.trace;
      var interactionIndex = 0;
      for (var i = 0; i < trace.taps.length; i += 3) {
        interactionIndex++;
        rows.push([dt.date, dt.time, sessionId, interactionIndex, 'タップ', 1, (trace.taps[i] / 1000).toFixed(3), (trace.taps[i + 1] / 1000).toFixed(3), trace.taps[i + 2]]);
      }
      trace.swipes.forEach(function (stroke) {
        interactionIndex++;
        var pointIndex = 0;
        for (var j = 0; j < stroke.length; j += 3) {
          pointIndex++;
          rows.push([dt.date, dt.time, sessionId, interactionIndex, 'スワイプ', pointIndex, (stroke[j] / 1000).toFixed(3), (stroke[j + 1] / 1000).toFixed(3), stroke[j + 2]]);
        }
      });
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    MODE_LABEL: MODE_LABEL,
    INTENSITY_LABEL: INTENSITY_LABEL,
    EFFECT_WIDTH_LABEL: EFFECT_WIDTH_LABEL,
    EFFECT_SOUND_LABEL: EFFECT_SOUND_LABEL,
    formatInputMethod: formatInputMethod,
    formatDuration: formatDuration,
    formatCsvDateTime: formatCsvDateTime,
    isValidTrace: isValidTrace,
    getDetailRows: getDetailRows,
    summaryText: summaryText,
    CSV_HEADER_SUMMARY: CSV_HEADER_SUMMARY,
    CSV_HEADER_TRACE: CSV_HEADER_TRACE,
    buildSummaryCsvRows: buildSummaryCsvRows,
    buildTraceCsvRows: buildTraceCsvRows
  };
});
