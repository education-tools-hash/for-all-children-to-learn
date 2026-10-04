/*
 * どのまな さかなつり — Record Detail / CSV Shared Logic
 * (Phase FISHING-APP-TIMING-SPEED-AND-LEARNING-RECORD-1)
 *
 * sakana-tsuri.html には現在、記録を一覧表示するApp-local画面は存在しない
 * （saveTrialRecord()が保存するのみ）。このfileはlearning-records.html（共通
 * 「学習のきろく」）向けのLevel 2詳細行・CSV行生成のみを提供する。将来
 * App-local側に記録ビューアを追加する場合は、重複実装せずこのfileの関数を
 * 共有すること（directions-record-detail.js/sawatte-hirogaru-record-detail.js
 * と同じApp固有shared moduleパターン）。
 *
 * Record Semantics（Audit全体Contract §19/Matrix Gap定義）: saveTrialRecord()
 * が実際に保存した事実（釣れた魚の見た目・大きさ、使用したまきとり方法と各種
 * 設定値、所要時間）をそのまま表示するのみ。保存されていない評価・推論語を
 * このfileで新たに生成しない。古い記録（本Phase以前に保存され、timingSpeed等の
 * キー自体が無い）でも欠落行を出すだけで、詳細画面・CSV双方とも壊れない
 * （各値はpushIf/三項演算子で欠落時は何も出さない設計）。
 *
 * Runtime: ブラウザ(window.donomanaSakanaTsuriRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー（既存record-dashboard-*.js/
 * directions-record-detail.jsと同じパターン）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaSakanaTsuriRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // sakana-tsuri.html:FISH_PALETTE/FISH_SIZES/REEL_GAIN_PRESETS/REEL_SPEED_PRESETSと
  // 同一の複製（§9 Shared Formatter方針、各fileが自分の分だけ持つ既存慣習）。
  // 注意: backgroundMode/fishTypeMode/sizeEffortはsaveTrialRecord()のpayloadに一切
  // 含まれない（本Phaseの調査で確認済み——指示: 「未保存の結果を推測して表示しない」
  // ため、このfileもbackground/sizeEffortの行・列を一切生成しない）。
  var FISH_TYPE_LABELS = { orange: 'オレンジの魚', 'red-white': '赤白の魚', spotted: 'まだら模様の魚' };
  var FISH_SIZE_LABELS = { small: 'ちいさい', medium: 'ふつう', large: 'おおきい' };
  var REEL_METHOD_LABELS = { arc: 'ぐるぐるまく', hold: '長押しでまく', timing: 'タイミングよく おす' };
  var REEL_GAIN_LABELS = { small: 'すくない', medium: 'ふつう', large: 'おおい' };
  var REEL_SPEED_LABELS = { slow: 'ゆっくり', standard: 'ふつう', fast: 'はやい' };
  var TIMING_SPEED_LABELS = { 'very-slow': 'とてもゆっくり', slow: 'ゆっくり', normal: 'ふつう', fast: 'はやい' };

  function fishTypeLabel(type) { return (typeof type === 'string' && FISH_TYPE_LABELS[type]) ? FISH_TYPE_LABELS[type] : ''; }
  function fishSizeLabel(size) { return (typeof size === 'string' && FISH_SIZE_LABELS[size]) ? FISH_SIZE_LABELS[size] : ''; }
  function reelMethodLabel(m) { return (typeof m === 'string' && REEL_METHOD_LABELS[m]) ? REEL_METHOD_LABELS[m] : ''; }
  function reelGainLabel(g) { return (typeof g === 'string' && REEL_GAIN_LABELS[g]) ? REEL_GAIN_LABELS[g] : ''; }
  function reelSpeedLabel(s) { return (typeof s === 'string' && REEL_SPEED_LABELS[s]) ? REEL_SPEED_LABELS[s] : ''; }
  function timingSpeedLabel(s) { return (typeof s === 'string' && TIMING_SPEED_LABELS[s]) ? TIMING_SPEED_LABELS[s] : ''; }

  // sakana-tsuri.html:landFish()のcatch message組み立てと同じ考え方（大きさ+種類）。
  // payload: donomanaRecordCreate()のpayload(=record.payload)。
  function summaryText(payload) {
    if (!payload || typeof payload !== 'object') return 'さかなつりに取り組みました';
    var desc = (fishSizeLabel(payload.caughtSize) + ' ' + fishTypeLabel(payload.caughtColor)).trim();
    return desc ? (desc + 'の さかなが つれました') : 'さかなが つれました';
  }

  function formatDuration(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '';
    var sec = Math.round(ms / 1000);
    return sec + '秒';
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows。存在しないfieldの行は出さない。
  // ────────────────────────────────────────────────────────────

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // entry: raw Foundation record（{timestamp, appId, activity, inputMethod,
  // schemaVersion, payload}）。payload側は sakana-tsuri.html:saveTrialRecord()参照。
  function getDetailRows(entry) {
    if (!entry || typeof entry !== 'object') return [];
    var payload = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
    var rows = [];
    pushIf(rows, '釣れた魚', fishTypeLabel(payload.caughtColor));
    pushIf(rows, '大きさ', fishSizeLabel(payload.caughtSize));
    pushIf(rows, 'まきとり方法', reelMethodLabel(payload.reelMethod));
    pushIf(rows, 'まきとる量', reelGainLabel(payload.reelGainPreset));
    pushIf(rows, 'まきとる速さ', reelSpeedLabel(payload.reelSpeedPreset));
    // timingSpeedは'タイミングよく おす'のときのみ意味を持つ値のため、その方式での
    // 記録のときだけ表示する(指示: 「未保存の結果を推測して表示しない」の精神を、
    // 「保存されてはいるが無関係な値を出さない」側にも適用)。
    if (payload.reelMethod === 'timing') pushIf(rows, 'うごく はやさ', timingSpeedLabel(payload.timingSpeed));
    pushIf(rows, '所要時間', formatDuration(payload.durationMs));
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', '釣れた魚', '大きさ', 'まきとり方法', 'まきとる量', 'まきとる速さ', 'うごく はやさ', '所要時間(秒)'];

  function formatCsvDateTime(timeValue) {
    if (timeValue === null || timeValue === undefined || timeValue === '') return { date: '', time: '' };
    var d = (timeValue instanceof Date) ? timeValue : new Date(timeValue);
    if (isNaN(d.getTime())) return { date: String(timeValue), time: '' };
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return {
      date: d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()),
      time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
    };
  }

  // log: rawRecords配列（Common呼び出し時はreadAppRecords('sakana-tsuri').rawRecordsを
  // そのまま渡す）。各entryはdonomanaRecordCreate()の正規Core Schema形そのもの。
  function buildDetailCsvRows(log) {
    var rows = [CSV_HEADER.slice()];
    (log || []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      var payload = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
      var dt = formatCsvDateTime(entry.timestamp);
      var durSec = (typeof payload.durationMs === 'number' && isFinite(payload.durationMs)) ? Math.round(payload.durationMs / 1000) : '';
      rows.push([
        dt.date,
        dt.time,
        fishTypeLabel(payload.caughtColor),
        fishSizeLabel(payload.caughtSize),
        reelMethodLabel(payload.reelMethod),
        reelGainLabel(payload.reelGainPreset),
        reelSpeedLabel(payload.reelSpeedPreset),
        (payload.reelMethod === 'timing') ? timingSpeedLabel(payload.timingSpeed) : '',
        durSec
      ]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    FISH_TYPE_LABELS: FISH_TYPE_LABELS,
    FISH_SIZE_LABELS: FISH_SIZE_LABELS,
    REEL_METHOD_LABELS: REEL_METHOD_LABELS,
    REEL_GAIN_LABELS: REEL_GAIN_LABELS,
    REEL_SPEED_LABELS: REEL_SPEED_LABELS,
    TIMING_SPEED_LABELS: TIMING_SPEED_LABELS,
    fishTypeLabel: fishTypeLabel,
    fishSizeLabel: fishSizeLabel,
    reelMethodLabel: reelMethodLabel,
    reelGainLabel: reelGainLabel,
    reelSpeedLabel: reelSpeedLabel,
    timingSpeedLabel: timingSpeedLabel,
    summaryText: summaryText,
    formatDuration: formatDuration,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
