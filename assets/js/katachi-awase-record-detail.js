/*
 * どのまな かたちをあわせよう — Record Detail / CSV Shared Logic
 * (Phase LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1)
 *
 * katachi-awase-app.html（App-local「きろく」の`appendRecordDetailToggle()`/
 * CSV＝`buildRecordsCsvRows()`）とlearning-records.html（共通「学習の記録」）
 * の両方から読み込み、Level 2行・CSV行の組み立てを**同一関数**として共有する
 * （Cross-App Detail Contract §9/§11、SST/Sawatte/directions-app/kurabeyou-app
 * と同じ「App固有shared module」パターン）。
 *
 * 3つのconcept（App-local実測、katachi-awase-app.html:1340-1344/1326-1333）:
 *   - 'shape'（かたち、既定）/ 'size'（おおきさ）: 1 raw entry = 1つ配置した
 *     shape（1問の中で複数shapeを置く問題もあるため、1問 ≠ 1 entry。CSVも
 *     `readLog().forEach()`でこのentry単位に出力しており、Common Detail
 *     （1 raw entry = 1 Common record card）はこれと同じ粒度で自然に対応する）。
 *   - 'puzzle'（かたちでつくろう、KAP-1）: 1 raw entry = 1つ完成したパズル
 *     全体（onPuzzleComplete()、1ピースごとには記録しない）。
 *
 * mistakeSelectionsは新旧2形式が混在しうる（Phase26-I3.1以降は
 * {shapeType,size}オブジェクト、それ以前は素のshapeType文字列）——App-local
 * 実装のtypeof分岐をそのまま踏襲する。
 *
 * Runtime: ブラウザ(window.donomanaKatachiAwaseRecordDetail)とNode.js(require)
 * の両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaKatachiAwaseRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // katachi-awase-app.html:1229/1260/1326-1333のSHAPE_LABEL/SIZE_LABEL/
  // LEVEL_LABELSと同一の複製（§9 Shared Formatter方針）。
  var SHAPE_LABEL = { circle: 'まる', triangle: 'さんかく', square: 'しかく' };
  var SIZE_LABEL = { large: 'おおきい', small: 'ちいさい' };
  var LEVEL_LABELS = {
    shape: { 1: 'ひとつ', 2: 'ふたつ', 3: 'みっつ' },
    size: { 1: 'おなじ', 2: 'ちがう', 3: 'みっつ' },
    puzzle: { 1: 'やさしい', 2: 'ふつう', 3: 'チャレンジ' }
  };

  function shapeLabel(shapeType) {
    return SHAPE_LABEL[shapeType] || shapeType || '';
  }

  // katachi-awase-app.html:1273-1276のshapeSpokenLabel()と同一(sizeがあれば
  // 「おおきい まる」のように前置する)。
  function shapeSpokenLabel(shapeOrTarget) {
    var base = shapeLabel(shapeOrTarget.shapeType);
    return shapeOrTarget.size ? (SIZE_LABEL[shapeOrTarget.size] + ' ' + base) : base;
  }

  function levelLabel(concept, level) {
    return (LEVEL_LABELS[concept] && LEVEL_LABELS[concept][level]) || ('レベル' + level);
  }

  // mistakeSelections 1件を文字列化する。新形式({shapeType,size})/旧形式(文字列)
  // 両方を扱う(katachi-awase-app.html:3160-3162と同一分岐)。
  function mistakeItemText(m) {
    return (typeof m === 'string') ? shapeLabel(m) : shapeSpokenLabel(m);
  }

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows(1 raw entry = 1つ配置したshape、またはpuzzleは
  //  1つ完成したパズル全体)。日付/時刻/教材(活動ラベル)はCommon Detail modal
  //  が既に表示するため含めない。
  // ────────────────────────────────────────────────────────────

  function getDetailRows(entry) {
    if (!entry || typeof entry !== 'object') return [];
    var rows = [];
    var concept = entry.concept || 'shape';

    if (concept === 'puzzle') {
      pushIf(rows, 'むずかしさ', levelLabel('puzzle', entry.level));
      pushIf(rows, 'パズル名', entry.patternName || entry.patternId || '');
      if (typeof entry.correct === 'boolean') pushIf(rows, '正誤', entry.correct ? 'せいかい' : 'まちがい');
      if (typeof entry.durationMs === 'number') pushIf(rows, 'かかった時間', Math.round(entry.durationMs / 1000) + '秒');
      return rows;
    }

    pushIf(rows, 'レベル', levelLabel(concept, entry.level));
    if (typeof entry.questionIndex === 'number') pushIf(rows, '問題番号', entry.questionIndex);
    if (typeof entry.questionTotal === 'number') pushIf(rows, '問題数', entry.questionTotal);
    pushIf(rows, '形', shapeLabel(entry.shape));
    pushIf(rows, '正しい場所', shapeLabel(entry.expected));
    pushIf(rows, '選択した場所', shapeLabel(entry.selected));
    if (typeof entry.correct === 'boolean') pushIf(rows, '正誤', entry.correct ? 'せいかい' : 'まちがい');
    if (typeof entry.mistakes === 'number') pushIf(rows, '再試行回数', entry.mistakes + '回');
    if (entry.mistakeSelections && entry.mistakeSelections.length) {
      pushIf(rows, '間違えた内容', entry.mistakeSelections.map(mistakeItemText).join('、'));
    }
    if (typeof entry.responseTimeMs === 'number') pushIf(rows, '反応時間', entry.responseTimeMs + 'ミリ秒');
    if (concept === 'size' && entry.shapeSize) pushIf(rows, 'おおきさ', SIZE_LABEL[entry.shapeSize] || entry.shapeSize);

    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（katachi-awase-app.html:3117 CSV_HEADERSと完全に同一の15列・行内容）。
  //  App-local側はこのfileの関数を薄いwrapper経由で直接呼ぶ(重複実装禁止)。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', 'レベル', '問題番号', '問題数', '形', '正しい場所', '選択した場所', '正誤', '再試行回数', '間違えた内容', '反応時間ms', 'おおきさ', 'パズル名', 'かかった時間(秒)'];

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

  function buildDetailCsvRows(log) {
    var rows = [CSV_HEADER.slice()];
    (log || []).forEach(function (e) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) return;
      var concept = e.concept || 'shape';
      var dt = formatCsvDateTime(e.time);

      if (concept === 'puzzle') {
        rows.push([
          dt.date, dt.time, levelLabel('puzzle', e.level),
          '', '', '', '', '',
          (e.correct === true) ? 'せいかい' : (e.correct === false ? 'まちがい' : ''),
          '', '', '', '',
          e.patternName || e.patternId || '',
          (typeof e.durationMs === 'number') ? Math.round(e.durationMs / 1000) : ''
        ]);
        return;
      }

      rows.push([
        dt.date,
        dt.time,
        levelLabel(concept, e.level),
        (typeof e.questionIndex === 'number') ? e.questionIndex : '',
        (typeof e.questionTotal === 'number') ? e.questionTotal : '',
        shapeLabel(e.shape),
        shapeLabel(e.expected),
        shapeLabel(e.selected),
        (e.correct === true) ? 'せいかい' : (e.correct === false ? 'まちがい' : ''),
        (typeof e.mistakes === 'number') ? e.mistakes : '',
        (e.mistakeSelections || []).map(mistakeItemText).join('、'),
        (typeof e.responseTimeMs === 'number') ? e.responseTimeMs : '',
        e.shapeSize ? (SIZE_LABEL[e.shapeSize] || e.shapeSize) : '',
        '', ''
      ]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
