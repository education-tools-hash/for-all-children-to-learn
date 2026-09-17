/*
 * どのまな とけい — Record Detail / CSV Shared Logic
 * (Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1)
 *
 * tokei-app.html（App-local「きろく」モーダルのrenderRecordHistory()・
 * exportRecordHistoryCSV()）とlearning-records.html（共通「学習の記録」）の
 * 両方から読み込み、Level 2行・CSV行の組み立てを**同一関数**として共有する
 * （directions-record-detail.jsと同じ「App固有shared module」パターン）。
 *
 * Root Investigation実測（tokei-app.html:1881-1896実測）: 1 record = 1問題
 * セット完了（セッション単位、途中終了は保存されない）。
 * {timestamp, activity, inputMethod, schemaVersion,
 *  payload:{difficulty, mode, total, correct, retried, avgTimeSec,
 *  durationSec}}。
 *
 * total/correct/retried/avgTimeSec/durationSecは既にrecord-dashboard-
 * foundation.jsのtokei-app adapterがmetricsへ格納しており、record-
 * dashboard-ui.jsのMETRIC_LABELS（問題数/正解数/やり直し回数/平均時間・
 * 時間）で既にCommonへ表示済み（「隠れたLevel 1.5」、重複行を追加しない）。
 *
 * 本当に不足しているのはdifficulty（むずかしさ）とmode（もんだいのしゅるい）
 * の2つのみ。現行adapterのnormalize()は`activity`にmode文字列をそのまま
 * 使っており、record-dashboard-ui.jsのACTIVITY_LABELSに'read'/'set'の
 * 定義が無く、'both'はjanken-appの「どちらもまぜる」と衝突する（既存の
 * 非本質的なlabel共有問題、Contract §16と同型のnon-blocking pre-existing
 * issue、本Phaseでは既存ACTIVITY_LABELS自体を変更しない）。そのため
 * getDetailRows()はtokei-app自身のmodeNames/diffNames辞書
 * （tokei-app.html:1906-1907実測）を使い、raw payloadから直接正しい
 * ラベルを組み立てる。
 *
 * Runtime: ブラウザ(window.donomanaTokeiRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaTokeiRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // tokei-app.html:1906-1907と完全に同一(Source of Truth)。
  var MODE_LABELS = { read: 'よむもんだい', set: 'みつけるもんだい', both: 'まぜまぜ' };
  var DIFFICULTY_LABELS = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };

  function modeLabel(mode) {
    return MODE_LABELS[mode] || null;
  }
  function difficultyLabel(difficulty) {
    return DIFFICULTY_LABELS[difficulty] || null;
  }

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // entry: raw Foundation record({timestamp, activity, inputMethod,
  // schemaVersion, payload})。
  function getDetailRows(entry) {
    if (!entry || typeof entry !== 'object') return [];
    var p = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
    var rows = [];
    pushIf(rows, 'むずかしさ', difficultyLabel(p.difficulty));
    pushIf(rows, 'もんだいのしゅるい', modeLabel(p.mode));
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（tokei-app.html:1943-1961 exportRecordHistoryCSV()と完全に同一の
  //  9列・行内容）。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', 'むずかしさ', 'もんだいのしゅるい', 'せいかい', 'もんだいすう', 'やりなおし', 'へいきんじかん(びょう)', 'かかった時間(びょう)'];

  function formatCsvDateTime(timeValue) {
    try {
      if (timeValue === null || timeValue === undefined || timeValue === '') return { date: '', time: '' };
      var d = (timeValue instanceof Date) ? timeValue : new Date(timeValue);
      if (isNaN(d.getTime())) return { date: String(timeValue), time: '' };
      var p = function (n) { return n < 10 ? '0' + n : String(n); };
      return {
        date: d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()),
        time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
      };
    } catch (e) {
      return { date: (timeValue === null || timeValue === undefined) ? '' : String(timeValue), time: '' };
    }
  }

  function buildDetailCsvRows(log) {
    var rows = [CSV_HEADER.slice()];
    (log || []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      var p = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
      var dt = formatCsvDateTime(entry.timestamp);
      rows.push([
        dt.date,
        dt.time,
        DIFFICULTY_LABELS[p.difficulty] || '',
        MODE_LABELS[p.mode] || '',
        (typeof p.correct === 'number') ? p.correct : '',
        (typeof p.total === 'number') ? p.total : '',
        (typeof p.retried === 'number') ? p.retried : '',
        (typeof p.avgTimeSec === 'number') ? p.avgTimeSec : '',
        (typeof p.durationSec === 'number') ? p.durationSec : ''
      ]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    MODE_LABELS: MODE_LABELS,
    DIFFICULTY_LABELS: DIFFICULTY_LABELS,
    modeLabel: modeLabel,
    difficultyLabel: difficultyLabel,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
