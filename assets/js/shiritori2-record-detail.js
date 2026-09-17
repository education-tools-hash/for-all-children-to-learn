/*
 * どのまな しりとりあそび — Record Detail / CSV Shared Logic
 * (Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1)
 *
 * shiritori2.html（App-local「きろく」モーダルのrenderShiritoriRecords()・
 * exportShiritoriRecordsCSV()）とlearning-records.html（共通「学習の記録」）
 * の両方から読み込み、Level 2行・CSV行の組み立てを**同一関数**として
 * 共有する（directions-record-detail.jsと同じ「App固有shared module」
 * パターン）。
 *
 * Root Investigation実測（shiritori2.html:1976-1993実測）: 1 record = 1
 * ゲームセッション完了。{timestamp, activity, inputMethod, schemaVersion,
 *  payload:{mode(number、もんすう設定値), total, correct, score,
 *  maxStreak, chainLength, outcome('completed'|'trap'), durationSec}}。
 * しりとりで実際につながった単語文字列自体は保存されない
 * （固定語彙からの選択式のため自由入力ではないが、列が増えすぎるのを避ける
 * 設計、shiritori2.html:1965-1974のコメントに明記）。chainLengthは
 * つながった語数のみを保持する。
 *
 * total/correct/score/maxStreak/chainLength/durationSecは既にrecord-
 * dashboard-foundation.jsのshiritori2 adapterがmetricsへ格納しており、
 * record-dashboard-ui.jsのMETRIC_LABELSで既にCommonへ表示済み（「隠れた
 * Level 1.5」、重複行を追加しない）。
 *
 * 不足しているのはmode（もんすうモード、number）とoutcome（けっか、終了
 * 理由）の2つ。現行adapterのnormalize()は`activity`に
 * `(typeof p.mode==='string')?p.mode:'unknown'`を使っているが、shiritori2の
 * modeは常にnumber（もんすう設定値）のため、この条件は常にfalseとなり
 * activityは常に'unknown'になる（既存の非本質的な型不一致、non-blocking
 * pre-existing issue、本Phaseでは既存normalize()自体を変更しない）。
 * getDetailRows()はraw payloadから直接number/outcomeを読み、shiritori2
 * 自身のoutcomeNames辞書（shiritori2.html:2003実測）でラベル化する。
 *
 * Runtime: ブラウザ(window.donomanaShiritori2RecordDetail)とNode.js
 * (require)の両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaShiritori2RecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // shiritori2.html:2003/2040と完全に同一(Source of Truth)。CSV側は
  // 「んでおわった」(スペース無し)、App-local表示側は「ん でおわった」
  // (スペースあり)——実測どおり別々の文字列であり、統一しない(pure
  // extraction、既存App-local表示を書き換えない)。
  var OUTCOME_LABELS_DISPLAY = { completed: 'クリア', trap: 'ん でおわった' };
  var OUTCOME_LABELS_CSV = { completed: 'クリア', trap: 'んでおわった' };

  function outcomeLabel(outcome) {
    return OUTCOME_LABELS_DISPLAY[outcome] || null;
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
    pushIf(rows, 'もんすうモード', (typeof p.mode === 'number') ? (p.mode + 'もん') : null);
    pushIf(rows, 'けっか', outcomeLabel(p.outcome));
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（shiritori2.html:2038-2055 exportShiritoriRecordsCSV()と完全に
  //  同一の9列・行内容）。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', 'もんすうモード', 'せいかい', 'もんだいすう', 'スコア', 'さいだいれんぞく', 'けっか', 'かかった時間(びょう)'];

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
        (typeof p.mode === 'number') ? p.mode : '',
        (typeof p.correct === 'number') ? p.correct : '',
        (typeof p.total === 'number') ? p.total : '',
        (typeof p.score === 'number') ? p.score : '',
        (typeof p.maxStreak === 'number') ? p.maxStreak : '',
        OUTCOME_LABELS_CSV[p.outcome] || '',
        (typeof p.durationSec === 'number') ? p.durationSec : ''
      ]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    OUTCOME_LABELS_DISPLAY: OUTCOME_LABELS_DISPLAY,
    OUTCOME_LABELS_CSV: OUTCOME_LABELS_CSV,
    outcomeLabel: outcomeLabel,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
