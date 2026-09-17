/*
 * どのまな おおきい？ちいさい？くらべよう — Record Detail / CSV Shared Logic
 * (Phase LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1)
 *
 * kurabeyou-app.html（App-local「きろく」の`appendRecordDetailToggle()`/CSV＝
 * `buildRecordsCsvRows()`）とlearning-records.html（共通「学習の記録」）の
 * 両方から読み込み、Level 2行・CSV行の組み立てを**同一関数**として共有する
 * （Cross-App Detail Contract §9/§11、SST/Sawatte/directions-appと同じ
 * 「App固有shared module」パターン）。
 *
 * 重要: App-localの「きろく」画面はraw log entryをセッション単位（同じ
 * level+conceptが連続する範囲）へ集約して表示するが（`groupLogIntoSessions()`、
 * kurabeyou-app.html実測）、Level3/4は「1つの完了した問題 = 1 raw entry」
 * （途中の誤答はmistakeSelections/mistakeDetailsへ集約され、別entryにならない
 * ——addLog()呼び出し箇所コメント「one entry per completed question (not per
 * attempt)」で確認済み）。CSVも`readLog().forEach()`でraw entry単位に出力して
 * いる（セッション単位ではない）。したがって、Common Detail（1 raw entry =
 * 1 Common record card、既存の全App共通アーキテクチャ）は「1つの完了した
 * 問題の詳細」を示せば足り、App-localのセッション集約UIを再現する必要はない
 * （個々のentryが持つ情報量はセッション表示と矛盾しない、粒度が異なるだけ）。
 *
 * Level 1（自由あそび）はfield自体がほぼ無いため、getDetailRows()は空配列を
 * 返す（Level 1 summary相当のみで十分、Matrix Gap定義どおり）。
 *
 * Runtime: ブラウザ(window.donomanaKurabeyouRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaKurabeyouRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // kurabeyou-app.html:2327/2248/2246のRECORDS_SELECTED_TEXT/RECORDS_ORDER_NAME/
  // RECORDS_LEVEL_NAME/RECORDS_CONCEPT_NAMEと同一の複製（§9 Shared Formatter方針）。
  var SELECTED_TEXT = { big: 'おおきいほう', small: 'ちいさいほう', long: 'ながいほう', short: 'みじかいほう' };
  var ORDER_NAME = {
    size: { desc: 'おおきい じゅん', asc: 'ちいさい じゅん' },
    length: { desc: 'ながい じゅん', asc: 'みじかい じゅん' }
  };
  // 「問題文」再構成に必要な最小限のprompt文言のみを複製する（COMPARISON全体は
  // 複製しない——level1Stimuli/level2Combos/level4Patterns等の出題ロジックは
  // Common側が知る必要のないApp内部実装のため、§9「必要な分だけ複製」）。
  var PROMPT_TEXT = {
    size: { moreLabel: 'big', lessLabel: 'small', promptMore: 'おおきい ほうは どっち？', promptLess: 'ちいさい ほうは どっち？' },
    length: { moreLabel: 'long', lessLabel: 'short', promptMore: 'ながい ほうは どっち？', promptLess: 'みじかい ほうは どっち？' }
  };

  function selectedText(label) {
    return SELECTED_TEXT[label] || label || '';
  }

  function orderLabel(concept, order) {
    return (ORDER_NAME[concept] && ORDER_NAME[concept][order]) || '';
  }

  // kurabeyou-app.html:2332-2340のlevel4RankLabel()と同一ロジック(items[]から
  // 実際の値でソートし、そのidが何位かをラベル化する)。
  function rankLabel(items, itemId, concept) {
    if (!items) return '';
    var sorted = items.slice().sort(function (a, b) { return b.value - a.value; });
    var idx = -1;
    for (var i = 0; i < sorted.length; i++) { if (sorted[i].id === itemId) { idx = i; break; } }
    var labels = concept === 'length'
      ? ['いちばん長い', '中くらいの長さ', 'いちばん短い']
      : ['いちばん大きい', '中くらいの大きさ', 'いちばん小さい'];
    return labels[idx] || '';
  }

  function orderValuesText(items, orderIds) {
    if (!items || !orderIds) return '';
    return orderIds.map(function (id) {
      var it = null;
      for (var i = 0; i < items.length; i++) { if (items[i].id === id) { it = items[i]; break; } }
      return it ? it.value : '';
    }).join('→');
  }

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows(1 raw entry = 1完了した問題／選択、上記コメント参照)。
  //  日付/時刻/教材(活動ラベル)はCommon Detail modalが既に表示するため含めない。
  // ────────────────────────────────────────────────────────────

  function getDetailRows(entry) {
    if (!entry || typeof entry !== 'object') return [];
    var rows = [];
    var concept = entry.concept;

    if (entry.level === 2) {
      pushIf(rows, '選んだほう', selectedText(entry.selected));
    } else if (entry.level === 3) {
      // entry.promptが無いlegacy recordで、存在しない問題文を推測生成しない
      // (Matrix Gap定義「保存済み事実のみ」、CSVの同名ロジックはpure extraction
      // 対象のため元のternaryのまま無変更だが、新規のgetDetailRows()側はここで
      // 正しくguardする)。
      var cfg = PROMPT_TEXT[concept];
      var hasPrompt = typeof entry.prompt === 'string' && entry.prompt;
      var questionText = (cfg && hasPrompt) ? (entry.prompt === cfg.moreLabel ? cfg.promptMore : cfg.promptLess) : '';
      pushIf(rows, '問題', questionText);
      pushIf(rows, '正解', selectedText(entry.prompt));
      var finalText = selectedText(entry.selected);
      var firstText = selectedText(entry.firstSelected);
      if (firstText && firstText !== finalText) pushIf(rows, '最初の選択', firstText);
      pushIf(rows, '最終選択', finalText);
      if (typeof entry.correct === 'boolean') pushIf(rows, '正誤', entry.correct ? 'せいかい' : 'まちがい');
      var retryCount3 = (entry.mistakeSelections && entry.mistakeSelections.length) ? entry.mistakeSelections.length : entry.mistakes;
      if (typeof retryCount3 === 'number') pushIf(rows, '再試行回数', retryCount3 + '回');
      if (entry.mistakeSelections && entry.mistakeSelections.length) {
        pushIf(rows, '間違えた内容', entry.mistakeSelections.map(selectedText).join('、'));
      }
      if (typeof entry.responseTimeMs === 'number') pushIf(rows, '反応時間', entry.responseTimeMs + 'ミリ秒');
    } else if (entry.level === 4) {
      pushIf(rows, '並べる方向', orderLabel(concept, entry.order));
      pushIf(rows, '正しい順序', orderValuesText(entry.items, entry.correctOrder));
      pushIf(rows, '実際の選択順序', orderValuesText(entry.items, entry.selectedOrder));
      if (typeof entry.mistakes === 'number') pushIf(rows, '再試行回数', entry.mistakes + '回');
      if (entry.mistakeDetails && entry.mistakeDetails.length && entry.items) {
        var parts = entry.mistakeDetails.map(function (m) {
          var sel = rankLabel(entry.items, m.selectedId, concept) || 'ちがうもの';
          var exp = rankLabel(entry.items, m.expectedId, concept) || '別のもの';
          return m.step + '番目：' + sel + 'を選択。本来は' + exp;
        });
        pushIf(rows, '間違えた内容', parts.join('／'));
      }
      if (typeof entry.responseTimeMs === 'number') pushIf(rows, '反応時間', entry.responseTimeMs + 'ミリ秒');
    }
    // level 1（自由あそび）はfieldがほぼ無いため空配列のまま(既存Level 1 summaryで充足)。

    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（kurabeyou-app.html:2472 CSV_HEADERSと完全に同一の17列・行内容）。
  //  App-local側はこのfileの関数を薄いwrapper経由で直接呼ぶ(重複実装禁止)。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', 'テーマ', 'レベル', '問題番号', '問題数', '問題文', '正解', '最初の選択', '最終選択', '正誤', '再試行回数', '間違えた内容', '反応時間ms', '並べる方向', '正しい順序', '実際の選択順序'];
  var CONCEPT_NAME = { size: 'おおきい・ちいさい', length: 'ながい・みじかい' };
  var LEVEL_NAME = { 1: 'みてたのしむ', 2: 'みくらべる', 3: 'どっちかな？', 4: 'じゅんばん' };

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
      var row = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
      var dt = formatCsvDateTime(e.time);
      row[0] = dt.date;
      row[1] = dt.time;
      row[2] = CONCEPT_NAME[e.concept] || e.concept || '';
      row[3] = LEVEL_NAME[e.level] || ('レベル' + e.level);
      row[4] = (typeof e.questionIndex === 'number') ? e.questionIndex : '';
      row[5] = (typeof e.questionTotal === 'number') ? e.questionTotal : '';

      if (e.level === 3) {
        var cfg = PROMPT_TEXT[e.concept];
        row[6] = cfg ? (e.prompt === cfg.moreLabel ? cfg.promptMore : cfg.promptLess) : '';
        row[7] = selectedText(e.prompt);
        row[8] = selectedText(e.firstSelected) || selectedText(e.selected);
        row[9] = selectedText(e.selected);
        row[10] = (e.correct === true) ? 'せいかい' : (e.correct === false ? 'まちがい' : '');
        row[11] = (e.mistakeSelections && e.mistakeSelections.length) ? e.mistakeSelections.length : (typeof e.mistakes === 'number' ? e.mistakes : '');
        row[12] = (e.mistakeSelections && e.mistakeSelections.length) ? e.mistakeSelections.map(selectedText).join('、') : '';
        row[13] = (typeof e.responseTimeMs === 'number') ? e.responseTimeMs : '';
      } else if (e.level === 4) {
        row[11] = (typeof e.mistakes === 'number') ? e.mistakes : '';
        row[12] = (e.mistakeDetails && e.mistakeDetails.length && e.items) ? e.mistakeDetails.map(function (m) {
          var selIt = null, expIt = null;
          for (var i = 0; i < e.items.length; i++) {
            if (e.items[i].id === m.selectedId) selIt = e.items[i];
            if (e.items[i].id === m.expectedId) expIt = e.items[i];
          }
          return m.step + '番目:' + (selIt ? selIt.value : '?') + '→本来' + (expIt ? expIt.value : '?');
        }).join('／') : '';
        row[13] = (typeof e.responseTimeMs === 'number') ? e.responseTimeMs : '';
        row[14] = orderLabel(e.concept, e.order);
        row[15] = orderValuesText(e.items, e.correctOrder);
        row[16] = orderValuesText(e.items, e.selectedOrder);
      } else if (e.level === 2) {
        row[9] = selectedText(e.selected);
      }

      rows.push(row);
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
