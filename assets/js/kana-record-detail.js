/*
 * どのまな ひらがな/カタカナ まなぼう！ — Record Detail / CSV Formatter
 * (Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1)
 *
 * hiragana-learn.html / katakana-app.html（App-local「くわしいきろく」表示・
 * CSVダウンロード）とlearning-records.html（共通「学習の記録」）の両方から
 * 読み込み、Level 2行・CSV行の組み立てを**同一関数**として共有する。
 * Canvas描画・trace検証はassets/js/kana-record-trace-renderer.jsの責務
 * (formatter/rendererの責務分離、Sawatteのsawatte-hirogaru-record-detail.js
 * / record-trace-renderer.jsと同じ構成)。
 *
 * 保存schema実測(hiragana-learn.html/katakana-app.html、両App完全同一):
 * 1 log entry = {time, type('trace'|'quiz'|'match'), data, schemaVersion}。
 *   - type:'trace'  → data:{kana, tracingJudgmentLevel, traceSample}
 *   - type:'quiz'   → data:{kana, answer, correct, correct_ans}
 *   - type:'match'  → data:{}（hiragana-learnのみ。katakana-appはmatch自体を
 *                      記録しない。保存fieldが無いためgetDetailRows()は空配列
 *                      を返す＝App-localの「くわしいきろく」もmatchには
 *                      文字種以外の追加情報を表示していない実装と一致）
 *
 * Level 2 Detail rowsの選定は、App-local「くわしいきろく」
 * (updateRecordView()内のentry別detail組み立て)が実際に表示している項目を
 * Source of Truthとする:
 *   - trace: 文字(kana)、なぞり方(tracingJudgmentLevel、
 *     donomanaRecordFormatTracingLevel()と同じ変換)、なぞりの記録(有無)
 *   - quiz : 文字(kana)、こたえ(answer)、せいかいのこたえ(correct_ans)
 *     ※正誤(○/×)自体は既存の汎用metrics経路(record-dashboard-ui.jsの
 *     METRIC_LABELS.correct)で既にCommonへ表示済みのため、重複行を増やさない
 *     (nazori-appのgetDetailRows()と同じ「既存経路でカバーされないfieldのみ
 *     追加」方針)。
 *
 * hasMedia修正: 旧Adapterは`!!data.traceSample`(存在チェックのみ)だったが、
 * これは壊れた/legacyなtraceSampleでもtrue誤判定する(nazori-appのhasMedia
 * バグと同種の問題)。本moduleのhasAnyValidTrace()はisValidTraceSample()による
 * 実在性+妥当性チェックを行う。
 *
 * Runtime: ブラウザ(window.donomanaKanaRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaKanaRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  function getRenderer() {
    return (typeof donomanaKanaRecordTraceRenderer !== 'undefined') ? donomanaKanaRecordTraceRenderer : null;
  }

  function hasAnyValidTrace(entry) {
    var R = getRenderer();
    if (!R || !entry || entry.type !== 'trace') return false;
    return R.isValidTraceSample(entry.data && entry.data.traceSample);
  }

  function supportsRichVisualization(entry) {
    return hasAnyValidTrace(entry);
  }

  // hiragana-learn.html/katakana-app.htmlのdonomanaRecordFormatTracingLevel()
  // と完全に同一のmap(Source of Truth、両App実コードから移植)。
  var TRACING_LEVEL_LABELS = { easy: 'やさしく', standard: 'ひょうじゅん', precise: 'ていねいに' };
  function formatTracingLevel(level) {
    return TRACING_LEVEL_LABELS[level] || null;
  }

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows
  // ────────────────────────────────────────────────────────────

  function getDetailRows(entry) {
    var rows = [];
    if (!entry || typeof entry !== 'object') return rows;
    var type = entry.type;
    var data = (entry.data && typeof entry.data === 'object') ? entry.data : {};

    if (type === 'trace') {
      pushIf(rows, '文字', (typeof data.kana === 'string') ? data.kana : null);
      pushIf(rows, 'なぞり方', formatTracingLevel(data.tracingJudgmentLevel));
      pushIf(rows, 'なぞりの記録', hasAnyValidTrace(entry) ? 'あり' : 'なし');
    } else if (type === 'quiz') {
      pushIf(rows, '文字', (typeof data.kana === 'string') ? data.kana : null);
      pushIf(rows, 'こたえ', (typeof data.answer === 'string') ? data.answer : null);
      pushIf(rows, 'せいかいのこたえ', (typeof data.correct_ans === 'string') ? data.correct_ans : null);
    }
    // type === 'match': App-localの「くわしいきろく」も文字種以外の追加情報を
    // 持たない(data:{})。getDetailRowsは空配列(Empty field rule §43)。
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（hiragana-learn.html/katakana-app.htmlのdownloadCSV()と完全に同一の
  //  7列・行内容。両App実測で確認済み、byte-identical。traceデータは含めない
  //  (App-local既存CSVも含まない)。CSV Formula Injection対策(csvSafeCell)は
  //  未実装だが、もじ/こたえ/せいかいのこたえは全て固定の五十音セットからの
  //  選択値であり自由入力ではないため、App-local既存実装に合わせ追加しない
  //  (Historical stability、新たな安全策を独自に追加しない)。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', '種類', 'もじ', 'こたえ', 'せいかい', 'せいかいのこたえ'];

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
      var dt = formatCsvDateTime(entry.time);
      var data = (entry.data && typeof entry.data === 'object') ? entry.data : {};
      if (entry.type === 'quiz') {
        rows.push([dt.date, dt.time, 'クイズ', data.kana, data.answer, data.correct ? '○' : '×', data.correct_ans]);
      } else if (entry.type === 'trace') {
        rows.push([dt.date, dt.time, 'なぞり', data.kana, '', '○', '']);
      } else if (entry.type === 'match') {
        rows.push([dt.date, dt.time, 'マッチング', '', '', '○', '']);
      }
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    hasAnyValidTrace: hasAnyValidTrace,
    supportsRichVisualization: supportsRichVisualization,
    formatTracingLevel: formatTracingLevel,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
