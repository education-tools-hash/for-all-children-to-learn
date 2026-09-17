/*
 * どのまな ほうこうとばしょをまなぼう — Record Detail / CSV Shared Logic
 * (Phase LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1)
 *
 * directions-app.html（App-local「学習ログ」テーブル＝renderLogs()、CSV＝
 * exportLogCSV()）とlearning-records.html（共通「学習の記録」）の両方から
 * 読み込み、Level 2行の組み立て・CSV行生成を**同一関数**として共有する
 * （Cross-App Detail Contract §9/§11、SST/Sawatte Reference Implementation
 * と同じ「App固有shared module」パターン）。
 *
 * directions-appは1 entry = 1問のフラットな記録（セッション集約なし）で、
 * 8 detail typeを持つSSTのような分岐は不要。フィールドは
 * {ts, tsLocal, category, question, userAnswer, correctAnswer, result,
 * schemaVersion}のみ（directions-app.html:2181-2192実測）。
 *
 * Record Semantics（Audit全体Contract §19/Matrix Gap定義）: 保存済み事実
 * （カテゴリ・問題文・回答・正解・結果）をそのまま表示するのみ。App-local
 * が保存していない評価・推論語をこのfileで新たに生成しない。
 *
 * Runtime: ブラウザ(window.donomanaDirectionsRecordDetail)とNode.js
 * (require)の両方で動作するUMD風の最小ラッパー（既存record-dashboard-*.js
 * /sst-record-detail.js/sawatte-hirogaru-record-detail.jsと同じパターン）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaDirectionsRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // directions-app.html:2847-2852のCATEGORY_LABELSと同一の複製（§9 Shared
  // Formatter方針、各fileが自分の分だけ持つ既存慣習）。
  var CATEGORY_LABELS = {
    quiz: 'なんばんめ',
    dir: 'どっちかな',
    compass: 'ほうがく',
    practice: 'はいち'
  };

  function categoryLabel(category) {
    if (typeof category !== 'string' || !category) return '';
    return CATEGORY_LABELS[category] || category;
  }

  // directions-app.html:2908の表示（○/×）と同一の記号。'correct'/'wrong'
  // 以外（未知値・欠落）はfalsyを返し、呼び出し側は行自体を出さない。
  function resultSymbol(result) {
    if (result === 'correct') return '○';
    if (result === 'wrong') return '×';
    return '';
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows（App-local「学習ログ」テーブルと同じ4項目。
  //  存在しないfieldの行は出さない——Matrix §Gap定義「App-localで見える
  //  保存済み事実のみ」を実装レベルで守る）。
  // ────────────────────────────────────────────────────────────

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // entry: raw Foundation record（{ts, tsLocal, category, question,
  // userAnswer, correctAnswer, result, schemaVersion}）。
  function getDetailRows(entry) {
    if (!entry || typeof entry !== 'object') return [];
    var rows = [];
    pushIf(rows, '問題', (typeof entry.question === 'string') ? entry.question : '');
    pushIf(rows, '回答', (typeof entry.userAnswer === 'string') ? entry.userAnswer : '');
    pushIf(rows, '正解', (typeof entry.correctAnswer === 'string') ? entry.correctAnswer : '');
    pushIf(rows, '結果', resultSymbol(entry.result));
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（directions-app.html:2929-2977 exportLogCSV()と完全に同一の
  //  7列・行内容。App-local側はこのfileの関数を薄いwrapper経由で直接呼ぶ
  //  （重複実装禁止、Contract §34/§35）。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', 'カテゴリ', '問題', '回答', '正解', '結果'];

  // directions-app.html:2043 donomanaRecordFormatCsvDateTimeと同一
  // （Excel互換dot区切り）。
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

  // log: rawRecords配列（App-local呼び出し時はstate.logs、Common呼び出し時は
  // readAppRecords('directions-app').rawRecordsをそのまま渡す——scope・件数の
  // 非対称はSSTと同型（Audit全体§36 Historical stability、App-localは既存の
  // MAX_LOGS保持件数、Commonはstorage retentionの範囲内で全件）。
  function buildDetailCsvRows(log) {
    var rows = [CSV_HEADER.slice()];
    (log || []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      var dt = formatCsvDateTime(entry.tsLocal || entry.ts);
      rows.push([
        dt.date,
        dt.time,
        categoryLabel(entry.category),
        (typeof entry.question === 'string') ? entry.question : '',
        (typeof entry.userAnswer === 'string') ? entry.userAnswer : '',
        (typeof entry.correctAnswer === 'string') ? entry.correctAnswer : '',
        resultSymbol(entry.result)
      ]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    CATEGORY_LABELS: CATEGORY_LABELS,
    categoryLabel: categoryLabel,
    resultSymbol: resultSymbol,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
