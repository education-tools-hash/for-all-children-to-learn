/*
 * どのまな SST — Record Detail / CSV Shared Logic
 * (Phase SST-COMMON-RECORD-DETAIL-INTEGRATION-1)
 *
 * sst-app.html（App-local「今週のレポート」の「くわしいきろく」＝
 * buildDetailRecordList()、および詳細CSV＝buildReportCsvContent()）と
 * learning-records.html（共通「学習の記録」）の両方から読み込み、
 * detail.typeごとのLevel 2行の組み立て・CSV行生成を**同一関数**として
 * 共有する（Cross-App Detail Contract §9/§11・
 * docs/records/sst-common-record-detail-parity-audit-v1_0.md §11 Shared
 * Formatter方針）。
 *
 * 対象8 detail.type（Audit §2で実測確定、推測ではない）:
 *   roleplay_choice / branch_ending / emotion_selection / phrase_action /
 *   breathing_activity / word_quiz_session / sst_quiz_session /
 *   social_story_completion
 *
 * 各typeのfield取り出しロジックはsst-app.htmlの既存
 * buildDetailRecordList()/buildReportCsvContent()の分岐を、HTML/CSV文字列
 * 生成からplain data生成へ移植したもの（新しい分岐ロジックを発明しない、
 * Audit §10）。
 *
 * Record Semantics（Audit §25、Contract §19）: 保存済み事実（問題・選択肢・
 * 選んだ回答・教材内区分）をそのまま表示するのみ。正解/不正解・心理状態・
 * 動機・能力評価等をこのfileで新たに生成・推論しない。
 *
 * Runtime: ブラウザ(window.donomanaSstRecordDetail)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー（既存record-dashboard-*.js／
 * sawatte-hirogaru-record-detail.jsと同じパターン）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaSstRecordDetail = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SUPPORTED_DETAIL_SCHEMA_VERSION = 1;

  // 選択肢・道順の番号マーク（sst-app.htmlのmarks配列と同一、Audit §9/§12実測）。
  var MARKS = ['①', '②', '③', '④', '⑤', '⑥'];
  function mark(i) { return MARKS[i] || (i + 1) + '.'; }

  // フレーズ集カテゴリ名（sst-app.html PHRASES定義の名称のみを複製、絵文字を
  // 除いたplain名。フレーズ本文・カテゴリ一覧の他要素は複製しない——CSVも
  // Detailもカテゴリ名としてこの1語しか使わないため、§9/§50の「各fileが自分の
  // 分だけ持つ」慣習の最小限の適用）。
  var PHRASE_CATEGORY_LABEL = {
    help: '助けを求める',
    feel: '気持ちを伝える',
    no: '断る',
    sorry: '謝る',
    ask: '聞く・確認する',
    greet: 'あいさつ・お願い',
    calm: '落ち着きたいとき'
  };

  // ────────────────────────────────────────────────────────────
  //  Detail Validation（Audit §14/Contract §12.2: detailSchemaVersionが
  //  読み取れない/不正な場合はdetailごと無視し、Level 1のみへfallback）
  // ────────────────────────────────────────────────────────────

  function isValidDetail(detail) {
    return !!(detail && typeof detail === 'object' && detail.detailSchemaVersion === SUPPORTED_DETAIL_SCHEMA_VERSION && typeof detail.type === 'string' && detail.type);
  }

  var KNOWN_TYPES = ['roleplay_choice', 'branch_ending', 'emotion_selection', 'phrase_action', 'breathing_activity', 'word_quiz_session', 'sst_quiz_session', 'social_story_completion'];

  // ────────────────────────────────────────────────────────────
  //  Level 2 Detail rows（Audit §9のマッピングを実装。日時/教材はCommon
  //  Detail modal側が既に表示するため含めない。存在しないfieldの行は
  //  出さない——Contract §13/Audit §18の「意味の違うfieldを無理に共通
  //  ラベルへ押し込まない」を実装レベルで守る）。
  // ────────────────────────────────────────────────────────────

  function pushIf(rows, label, value) {
    if (value !== null && value !== undefined && value !== '') rows.push({ label: label, value: value });
  }

  function choicesLine(choices) {
    if (!Array.isArray(choices) || choices.length === 0) return '';
    return choices.map(function (c, i) { return mark(i) + (c && c.text ? c.text : ''); }).join('｜');
  }

  // ことばクイズ/SSTクイズ/ソーシャルストーリーのanswers[]を「問題ごとの記録」
  // として1問=1行に展開する（sst-app.htmlのbuildQuizSessionSummaryAndBody相当、
  // Audit §9「問題ごとの記録（Q1〜QN）」）。answersが空でも例外を出さない。
  function questionRows(rows, answers, getQuestionText) {
    (Array.isArray(answers) ? answers : []).forEach(function (a, i) {
      var qText = getQuestionText(a) || '';
      var selText = (a && a.selected && a.selected.text) || '';
      var selLevel = (a && a.selected && a.selected.level) || '';
      var value = qText ? ('Q: ' + qText) : '';
      if (selText) value += (value ? '／' : '') + '選んだ回答: ' + selText;
      if (selLevel) value += '（教材内区分：' + selLevel + '）';
      pushIf(rows, '問題' + (i + 1), value);
    });
  }

  function tierSummary(answers) {
    var counts = {};
    (Array.isArray(answers) ? answers : []).forEach(function (a) {
      var lv = (a && a.selected && a.selected.level) || '';
      if (lv) counts[lv] = (counts[lv] || 0) + 1;
    });
    return Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join('／');
  }

  // entry: raw Foundation record（{ts, type, lv, result, schemaVersion, detail}）。
  // detail欠落・不正なdetailSchemaVersionはLevel 1へのfallback(空配列)。
  function getDetailRows(entry) {
    var detail = entry && entry.detail;
    if (!isValidDetail(detail)) return [];
    var d = detail;
    var rows = [];

    if (d.type === 'roleplay_choice') {
      pushIf(rows, '場面', d.scenario && d.scenario.title);
      pushIf(rows, '問題文', d.scenario && d.scenario.situation);
      pushIf(rows, '提示された選択肢', choicesLine(d.choices));
      pushIf(rows, '選んだ回答', d.selected && d.selected.text);
      pushIf(rows, '教材内区分', d.selected && d.selected.level);
    } else if (d.type === 'branch_ending') {
      pushIf(rows, '場面', d.scenario && d.scenario.title);
      pushIf(rows, 'たどりついたエンディング', d.ending && d.ending.title);
      var route = Array.isArray(d.route) ? d.route : [];
      pushIf(rows, 'たどった道', route.length ? route.map(function (step, i) { return mark(i) + step; }).join('｜') : '');
      pushIf(rows, '教材内区分', d.ending && d.ending.level);
    } else if (d.type === 'emotion_selection') {
      var sel = d.selected || {};
      pushIf(rows, '選んだカード', (sel.face ? sel.face + ' ' : '') + (sel.label || ''));
    } else if (d.type === 'phrase_action') {
      pushIf(rows, 'カテゴリ', PHRASE_CATEGORY_LABEL[d.category] || d.category || '');
      pushIf(rows, '選んだフレーズ', d.phrase);
      pushIf(rows, '実行した操作', d.action === 'copied' ? 'コピーしました' : (d.action === 'spoken' ? '読み上げました' : d.action));
    } else if (d.type === 'breathing_activity') {
      pushIf(rows, '状態', d.completionStatus === 'done' ? '完了' : d.completionStatus);
    } else if (d.type === 'word_quiz_session' || d.type === 'sst_quiz_session') {
      var qAnswers = Array.isArray(d.answers) ? d.answers : [];
      pushIf(rows, '全体の記録', '全' + qAnswers.length + '問');
      var qSummary = tierSummary(qAnswers);
      pushIf(rows, '全体の教材内区分', qSummary);
      questionRows(rows, qAnswers, function (a) { return (a.question && (a.question.prompt || a.question.text)) || ''; });
    } else if (d.type === 'social_story_completion') {
      pushIf(rows, '場面', d.story && d.story.title);
      var sAnswers = Array.isArray(d.answers) ? d.answers : [];
      if (sAnswers.length) {
        pushIf(rows, '全体の記録', '全' + sAnswers.length + '問');
        questionRows(rows, sAnswers, function (a) { return (a.prompt && a.prompt.text) || ''; });
      }
    } else {
      // 未知type(KNOWN_TYPESに無い場合)への安全なフォールバック。sst-app.html
      // 自身のbuildDetailRecordList()のelse分岐(roleplay_choice相当の汎用表示)
      // と同じロジックをそのまま使う(Audit §14、独自の新規fallbackを発明しない)。
      pushIf(rows, '場面', d.scenario && d.scenario.title);
      pushIf(rows, '提示された選択肢', choicesLine(d.choices));
      pushIf(rows, '選んだ回答', d.selected && d.selected.text);
      pushIf(rows, '教材内区分', d.selected && d.selected.level);
    }
    return rows;
  }

  // ────────────────────────────────────────────────────────────
  //  CSV（sst-app.htmlのbuildReportCsvContent()と完全に同一の列構成・
  //  per-type mapping(Audit §12/§31、既存8列がSource of Truth)。
  //  App-local側はこのfileの関数を薄いwrapper経由で直接呼ぶ(重複実装禁止、
  //  Contract §34/§35)。App-localは週次(weekLog)を渡し、CommonはAdapter
  //  経由で全期間(storage retentionの範囲内)を渡す——rows生成ロジック自体は
  //  完全に同一(Audit §36 Historical stability)。
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日時', '教材', 'モード', '場面', '問題文', '提示された選択肢', '選んだ回答', '教材内区分'];

  // sst-app.htmlのdonomanaRecordFormatCsvDateTimeと同一(Excel互換dot区切り)。
  function formatCsvDateTime(ts) {
    if (!ts) return { date: '', time: '' };
    var d = (ts instanceof Date) ? ts : new Date(ts);
    if (isNaN(d.getTime())) return { date: String(ts), time: '' };
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return { date: d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()), time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) };
  }

  // 複数問を「Q1: ...｜Q2: ...」形式で1セルへ集約する(sst-app.htmlの
  // buildQAggregatedCellと同一、§17.14 CSV Final Decision)。
  function buildQAggregatedCell(answers, extractFn) {
    return (Array.isArray(answers) ? answers : []).map(function (a, i) { return 'Q' + (i + 1) + ': ' + extractFn(a); }).join('｜');
  }

  // actLabel: appId->{ico,name}相当のmap(呼び出し側が渡す。sst-app.html自身の
  // ACT_LABELとCommon側の独立コピーのどちらでも使えるよう引数化する)。
  function buildDetailCsvRows(log, actLabel) {
    actLabel = actLabel || {};
    var rows = [CSV_HEADER.slice()];
    (log || []).forEach(function (entry) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      var info = actLabel[entry.type] || { name: entry.type };
      var dt = formatCsvDateTime(entry.ts);
      var d = entry.detail;
      var scene = '', question = '', choicesStr = '', selectedText = '', tier = '';

      if (d && d.type === 'branch_ending') {
        scene = (d.scenario && d.scenario.title) || '';
        selectedText = (d.ending && d.ending.title) || '';
        tier = (d.ending && d.ending.level) || '';
      } else if (d && d.type === 'emotion_selection') {
        selectedText = (d.selected && d.selected.label) || '';
      } else if (d && d.type === 'phrase_action') {
        scene = PHRASE_CATEGORY_LABEL[d.category] || d.category || '';
        selectedText = d.phrase || '';
      } else if (d && d.type === 'breathing_activity') {
        tier = d.completionStatus || '';
      } else if (d && (d.type === 'word_quiz_session' || d.type === 'sst_quiz_session')) {
        var qa = Array.isArray(d.answers) ? d.answers : [];
        scene = 'Lv' + entry.lv + ' 全' + qa.length + '問';
        question = buildQAggregatedCell(qa, function (x) { return (x.question && (x.question.prompt || x.question.text)) || ''; });
        choicesStr = buildQAggregatedCell(qa, function (x) { return Array.isArray(x.choices) ? x.choices.map(function (c, ci) { return mark(ci) + c.text; }).join('・') : ''; });
        selectedText = buildQAggregatedCell(qa, function (x) { return (x.selected && x.selected.text) || ''; });
        tier = buildQAggregatedCell(qa, function (x) { return (x.selected && x.selected.level) || ''; });
      } else if (d && d.type === 'social_story_completion') {
        scene = (d.story && d.story.title) || '';
        var sa = Array.isArray(d.answers) ? d.answers : [];
        if (sa.length) {
          question = buildQAggregatedCell(sa, function (x) { return (x.prompt && x.prompt.text) || ''; });
          choicesStr = buildQAggregatedCell(sa, function (x) { return Array.isArray(x.choices) ? x.choices.map(function (c, ci) { return mark(ci) + c.text; }).join('・') : ''; });
          selectedText = buildQAggregatedCell(sa, function (x) { return (x.selected && x.selected.text) || ''; });
          tier = buildQAggregatedCell(sa, function (x) { return (x.selected && x.selected.level) || ''; });
        }
      } else {
        scene = (d && d.scenario && d.scenario.title) || '';
        question = (d && d.scenario && d.scenario.situation) || '';
        choicesStr = (d && Array.isArray(d.choices)) ? d.choices.map(function (c, i) { return mark(i) + c.text; }).join('｜') : '';
        selectedText = (d && d.selected && d.selected.text) || '';
        tier = (d && d.selected && d.selected.level) || '';
      }
      rows.push([dt.date + ' ' + dt.time, info.name, entry.type, scene, question, choicesStr, selectedText, tier]);
    });
    return rows;
  }

  return {
    VERSION: VERSION,
    SUPPORTED_DETAIL_SCHEMA_VERSION: SUPPORTED_DETAIL_SCHEMA_VERSION,
    KNOWN_TYPES: KNOWN_TYPES,
    PHRASE_CATEGORY_LABEL: PHRASE_CATEGORY_LABEL,
    isValidDetail: isValidDetail,
    getDetailRows: getDetailRows,
    CSV_HEADER: CSV_HEADER,
    formatCsvDateTime: formatCsvDateTime,
    buildDetailCsvRows: buildDetailCsvRows
  };
});
