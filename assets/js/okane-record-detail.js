/*
 * どのまな おかねのおべんきょう — Record Detail / CSV Shared Logic
 * (Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1)
 *
 * okane-app.html（App-local「きろく」モーダルの「かつどうログ」表示・
 * exportRecordsCSV()の「# かつどうログ」section）とlearning-records.html
 * （共通「学習の記録」）の両方から読み込み、CSV行の組み立てを**同一関数**
 * として共有する（directions-record-detail.jsと同じ「App固有shared
 * module」パターン）。
 *
 * Root Investigation実測（okane-app.html:1796-1799実測）: 1 log entry =
 * {ts(ISO), type('match'|'shop'|'mondai'|'mistake'), detail(既にApp自身が
 * 生成した教師向け自然文), schemaVersion}。detail以外に金額・回答・正解を
 * 個別に保持するfieldは一切存在しない（App-local自身の「かつどうログ」
 * CSV(1987-1992行目)も日付/時刻/しゅるい/ないようの4列のみで、それ以上の
 * 構造化fieldを出力していない）。
 *
 * したがってgetDetailRows()は意図的に空配列を返す——detail文字列から
 * 金額や正誤を推測・逆算しない（Phase §5.4 No Invented Semantics）。
 * summary（=detail）とactivity（=type、既存ACTIVITY_LABELSで学習アプリ側と
 * 共有のshop/mondai/mistake/matchラベルが定義済み）は既にLevel 1として
 * Common側へ表示済みのため、Level 2として追加できる保存済みfieldが
 * そもそも存在しない。今回の実質的な追加はCSV parityのみ。
 *
 * 「# サマリー」section（learningRecords、matchPlayed等の生涯累積統計）は
 * 別のnon-Foundation storageのため対象外（既存adapterコメントと同じ判断）。
 *
 * Runtime: ブラウザ(window.donomanaOkaneRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaOkaneRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // okane-app.html:1989のtypeLabel分岐と完全に同一(Source of Truth)。
  var TYPE_LABELS = { match: 'マッチング', shop: 'おかいもの', mondai: 'もんだい', mistake: 'まちがい' };
  function typeLabel(type) {
    return TYPE_LABELS[type] || 'その他';
  }

  // Level 2 Detail rows: 保存済みの追加structured fieldが存在しないため、
  // 常に空配列(§5.4、上記コメント参照)。呼び出し側(record-dashboard-
  // foundation.js)はこれをそのままgetDetails()の戻り値として使う。
  function getDetailRows(entry) {
    return [];
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（okane-app.html:1986-1992「# かつどうログ」sectionと同一の4列・
  //  行内容。「# サマリー」sectionは非Foundation storageのため対象外）。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', 'しゅるい', 'ないよう'];

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
      var dt = formatCsvDateTime(entry.ts);
      rows.push([
        dt.date,
        dt.time,
        typeLabel(entry.type),
        (typeof entry.detail === 'string') ? entry.detail : ''
      ]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    TYPE_LABELS: TYPE_LABELS,
    typeLabel: typeLabel,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
