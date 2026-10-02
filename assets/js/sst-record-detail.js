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

  // ────────────────────────────────────────────────────────────
  //  「選択の履歴」比較用抽出ヘルパー（Phase
  //  SST-ANSWER-CHANGE-VISUALIZATION-IMPLEMENTATION-1、設計文書
  //  docs/design-system/donomana-sst-answer-change-visualization-design-v1_0.md
  //  §7/§8/§10を実装したもの）。
  //
  //  既存のgetDetailRows()/buildDetailCsvRows()/isValidDetail()とは完全に
  //  独立しており、それらの動作・出力には一切影響しない（既存exportは
  //  変更しない）。このセクションは「保存済みrecordから、型ごとに安全な
  //  比較キー・条件シグネチャを持つ回答イベントを抽出し、検証し、
  //  グループ化する」という新しい責務のみを持つ。record自体の書き換え・
  //  推測によるID補完・trim等による値の書き換えは一切行わない（設計文書
  //  §7.4・§8.1）。
  // ────────────────────────────────────────────────────────────

  // 比較対象type（設計文書§5の分類1・分類2のみ。branch/emotion/phrase等は含めない）。
  var COMPARISON_ELIGIBLE_TYPES = ['rp', 'wq', 'quiz', 'story'];

  // top-level type ↔ detail.type 対応表（設計文書§8.0、全文）。
  var TYPE_TO_DETAIL_TYPE = {
    rp: 'roleplay_choice',
    wq: 'word_quiz_session',
    quiz: 'sst_quiz_session',
    story: 'social_story_completion'
  };

  function isPlainObject(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x);
  }

  // 設計文書§7.4/§8.1: typeof==='string'・非空・空白のみは無効・trim補正をしない。
  function isValidComparisonText(x) {
    return typeof x === 'string' && x.length > 0 && !/^\s*$/.test(x);
  }

  // ID比較はlocale非依存・大文字小文字を区別する完全一致（設計文書§7.4）。
  function compareIdAsc(a, b) {
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  }

  // choices/selectedの検証（設計文書§8.1 ルール7-14/12b）。
  // 戻り値: {ok:false} または {ok:true, choicesSorted:[{id,text}](ID昇順、§7.2で比較に使う),
  //         choicesPresented:[{id,text}]}(①②③用。元の配列順=実際に提示された順、§9.2・§11.5)。
  function validateChoicesAndSelected(choices, selected) {
    if (!Array.isArray(choices) || choices.length === 0) return { ok: false };
    var seenIds = {};
    var presented = [];
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i];
      if (!isPlainObject(c)) return { ok: false };
      if (!isValidComparisonText(c.id) || !isValidComparisonText(c.text)) return { ok: false };
      if (Object.prototype.hasOwnProperty.call(seenIds, c.id)) return { ok: false }; // 重複id禁止
      seenIds[c.id] = c.text;
      presented.push({ id: c.id, text: c.text });
    }
    if (!isPlainObject(selected)) return { ok: false }; // selected自体の欠落/null/配列を検出
    if (!isValidComparisonText(selected.id) || !isValidComparisonText(selected.text)) return { ok: false };
    if (!Object.prototype.hasOwnProperty.call(seenIds, selected.id)) return { ok: false };
    if (seenIds[selected.id] !== selected.text) return { ok: false }; // selected.textが対応choiceのtextと不一致
    var sorted = choices.slice().sort(compareIdAsc).map(function (c) { return { id: c.id, text: c.text }; });
    return { ok: true, choicesSorted: sorted, choicesPresented: presented };
  }

  // 型ごとの実保存fieldを、名前を保ったまま構造化する（設計文書§7.1-7.2、
  // ||による1本化をしない。WQはsituation/promptの両方を常に保持する）。
  function buildContextFields(type, src) {
    if (type === 'rp') return { situation: src.situation };
    if (type === 'wq') return { situation: src.situation, prompt: src.prompt };
    if (type === 'quiz') return { text: src.text };
    if (type === 'story') return { prompt: src.text };
    return null;
  }

  function contextFieldsValid(fields) {
    if (!fields) return false;
    var keys = Object.keys(fields);
    for (var i = 0; i < keys.length; i++) {
      if (!isValidComparisonText(fields[keys[i]])) return false;
    }
    return true;
  }

  // 構造化比較キー・条件シグネチャ（設計文書§7.2）。
  function buildComparisonKey(type, sceneId, pageIndex) {
    return { type: type, sceneId: sceneId, pageIndex: (typeof pageIndex === 'number' ? pageIndex : null) };
  }

  function comparisonKeyToString(key) {
    return JSON.stringify({ type: key.type, sceneId: key.sceneId, pageIndex: key.pageIndex });
  }

  // selected/level/tierを含めない、key順を固定した構造化シグネチャ（設計文書§7.2）。
  function buildConditionSignature(contextFields, choicesSorted) {
    return JSON.stringify({ contextFields: contextFields, choices: choicesSorted });
  }

  // entry(Foundationの生record)1件から、比較対象の回答イベントを抽出する
  // (設計文書§8)。sourceIndexは元activityLog配列内での格納順(§10.3の
  // tie-break用、呼び出し側が渡す)。
  //
  // 戻り値のstatus:
  //   'ineligible'      : typeがCOMPARISON_ELIGIBLE_TYPESに含まれない
  //                       (比較対象外type。設計文書§12.2状態3の判定材料)
  //   'record-excluded' : record全体が検証不能/不正(reasonで理由を区別)。
  //                       このrecordが本来何件の回答イベントを含んでいたかは
  //                       確定できないため、どの比較グループの除外数にも
  //                       計上してはならない(設計文書§12.3)
  //   'ok'              : 0件以上の有効な回答イベントを抽出できた
  //                       (events)。events.length===0でも'ok'
  //                       (例: answersが有効な空配列)。excludedCountは
  //                       このrecord内で個別に無効だった回答イベント数
  //                       (denominatorが既知。ただしどの比較グループに
  //                       属するはずだったかは確定できないため、特定の
  //                       グループの除外数には計上しない。設計文書§12.3)
  function extractComparisonAnswerEvents(entry, sourceIndex) {
    if (!isPlainObject(entry)) return { status: 'ineligible' };
    var type = entry.type;
    if (COMPARISON_ELIGIBLE_TYPES.indexOf(type) === -1) return { status: 'ineligible' };

    var detail = entry.detail;
    if (!isValidDetail(detail)) return { status: 'record-excluded', reason: 'invalid-detail' };
    if (detail.type !== TYPE_TO_DETAIL_TYPE[type]) return { status: 'record-excluded', reason: 'type-mismatch' };

    if (type === 'rp') {
      if (detail.custom !== false) return { status: 'record-excluded', reason: 'rp-not-builtin' };
      var scenario = detail.scenario;
      if (!isPlainObject(scenario) || !isValidComparisonText(scenario.id)) {
        return { status: 'record-excluded', reason: 'missing-parent-id' };
      }
      var rpCv = validateChoicesAndSelected(detail.choices, detail.selected);
      if (!rpCv.ok) return { status: 'record-excluded', reason: 'invalid-choices-or-selected' };
      var rpCtx = buildContextFields('rp', scenario);
      if (!contextFieldsValid(rpCtx)) return { status: 'record-excluded', reason: 'invalid-context-fields' };
      var rpKey = buildComparisonKey('rp', scenario.id, null);
      return {
        status: 'ok',
        okRecordCount: 1,
        excludedCount: 0,
        events: [{
          ts: entry.ts,
          sourceIndex: sourceIndex,
          answerIndex: 0,
          type: 'rp',
          comparisonKey: rpKey,
          comparisonKeyString: comparisonKeyToString(rpKey),
          conditionSignature: buildConditionSignature(rpCtx, rpCv.choicesSorted),
          contextFields: rpCtx,
          choices: rpCv.choicesSorted,
          choicesPresented: rpCv.choicesPresented,
          selected: { id: detail.selected.id, text: detail.selected.text },
          // 表示用のみ(比較キー・シグネチャには含めない)。teacherEditsで編集不可のfieldだが、
          // 欠落していても検証には影響させない(§8.1の対象外)。
          displayTitle: isValidComparisonText(scenario.title) ? scenario.title : null
        }]
      };
    }

    // wq / quiz / story: session型。answers[]自体が配列でなければrecord全体を除外する
    // (設計文書§8.1ルール6・§8.2)。
    if (!Array.isArray(detail.answers)) return { status: 'record-excluded', reason: 'answers-not-array' };

    var story = null;
    if (type === 'story') {
      story = detail.story;
      if (!isPlainObject(story) || !isValidComparisonText(story.id)) {
        return { status: 'record-excluded', reason: 'missing-parent-id' };
      }
    }

    var events = [];
    var excludedCount = 0;
    var answers = detail.answers;
    for (var i = 0; i < answers.length; i++) {
      var a = answers[i];
      if (!isPlainObject(a)) { excludedCount++; continue; }

      var sceneId = null, pageIndex = null, ctxSrc = null;

      if (type === 'wq' || type === 'quiz') {
        var q = a.question;
        if (!isPlainObject(q) || !isValidComparisonText(q.id)) { excludedCount++; continue; }
        sceneId = q.id;
        ctxSrc = q;
      } else { // story
        if (typeof a.pageIndex !== 'number' || !isFinite(a.pageIndex) || Math.floor(a.pageIndex) !== a.pageIndex || a.pageIndex < 0) {
          excludedCount++; continue;
        }
        pageIndex = a.pageIndex;
        sceneId = story.id;
        var p = a.prompt;
        if (!isPlainObject(p)) { excludedCount++; continue; }
        ctxSrc = p;
      }

      var cv = validateChoicesAndSelected(a.choices, a.selected);
      if (!cv.ok) { excludedCount++; continue; }

      var ctx = buildContextFields(type, ctxSrc);
      if (!contextFieldsValid(ctx)) { excludedCount++; continue; }

      var key = buildComparisonKey(type, sceneId, pageIndex);
      events.push({
        ts: entry.ts,
        sourceIndex: sourceIndex,
        answerIndex: i,
        type: type,
        comparisonKey: key,
        comparisonKeyString: comparisonKeyToString(key),
        conditionSignature: buildConditionSignature(ctx, cv.choicesSorted),
        contextFields: ctx,
        choices: cv.choicesSorted,
        choicesPresented: cv.choicesPresented,
        selected: { id: a.selected.id, text: a.selected.text },
        // 表示用のみ(比較キー・シグネチャには含めない)。storyのみ、同じ物語の全ページで共通。
        displayTitle: (type === 'story' && isValidComparisonText(story.title)) ? story.title : null
      });
    }

    return { status: 'ok', okRecordCount: 1, events: events, excludedCount: excludedCount };
  }

  // 表示順3キーソート(設計文書§10.3): ts昇順→sourceIndex昇順(tie-break)→
  // answerIndex昇順(rpは常に0)。同一tsからの順序は真の時系列を断定しない。
  function sortComparisonAnswerEvents(events) {
    return events.slice().sort(function (a, b) {
      if (a.ts !== b.ts) return a.ts - b.ts;
      if (a.sourceIndex !== b.sourceIndex) return a.sourceIndex - b.sourceIndex;
      return a.answerIndex - b.answerIndex;
    });
  }

  // items: [{entry, sourceIndex}, ...]（表示期間内の有効recordのみ、呼び出し側が
  // 既存trendReadRaw()/trendClassify()相当で絞り込み済みのものを渡す）。
  //
  // 比較キー+条件シグネチャでグループ化する(設計文書§6原則4・§7.2)。
  //
  // 除外数の計上方針(設計文書§12.3、必須補正B): 個々の回答イベントの検証失敗
  // (excludedCount)は、その回答イベント自身の比較キー・条件シグネチャの
  // どちらか/両方が検証失敗の時点で確定できないため、特定グループの除外数に
  // 計上しない。record全体の除外(recordExcluded、denominator不明)とも
  // 別々に集計する。いずれも「全◯件中△件」という母数つき表示には使わない
  // (母数を推測で埋めない)。
  function groupComparisonAnswerEvents(items) {
    var groupsMap = {};
    var groupOrder = [];
    var ineligibleCount = 0;
    var recordExcluded = []; // [{sourceIndex, reason}]
    var okRecordCount = 0;
    var totalValidEvents = 0;
    var answerLevelExclusionCount = 0; // グループ特定不能な回答イベント単位の除外(集計のみ)

    (items || []).forEach(function (item) {
      var result = extractComparisonAnswerEvents(item.entry, item.sourceIndex);
      if (result.status === 'ineligible') { ineligibleCount++; return; }
      if (result.status === 'record-excluded') {
        recordExcluded.push({ sourceIndex: item.sourceIndex, reason: result.reason });
        return;
      }
      okRecordCount += result.okRecordCount || 0;
      answerLevelExclusionCount += result.excludedCount || 0;
      result.events.forEach(function (ev) {
        totalValidEvents++;
        var gk = ev.comparisonKeyString + '::' + ev.conditionSignature;
        if (!groupsMap[gk]) {
          groupsMap[gk] = { comparisonKey: ev.comparisonKey, conditionSignature: ev.conditionSignature, choices: ev.choices, events: [] };
          groupOrder.push(gk);
        }
        groupsMap[gk].events.push(ev);
      });
    });

    var groups = groupOrder.map(function (gk) {
      var g = groupsMap[gk];
      return { comparisonKey: g.comparisonKey, conditionSignature: g.conditionSignature, choices: g.choices, events: sortComparisonAnswerEvents(g.events) };
    });

    return {
      groups: groups,
      ineligibleCount: ineligibleCount,
      recordExcluded: recordExcluded,
      okRecordCount: okRecordCount,
      totalValidEvents: totalValidEvents,
      answerLevelExclusionCount: answerLevelExclusionCount
    };
  }

  // 設計文書§12.2の6状態のうち、読み込み失敗(状態1)・対象期間に記録なし(状態2)
  // を除く4区分(状態3-6)を、groupComparisonAnswerEvents()の結果から判定する。
  // 状態1・2は呼び出し側(sst-app.html)が既存trendReadRaw()/trendClassify()
  // 相当の結果から別途判定する(本関数はその後段のみを担当)。
  //
  // weekRecordCount: 表示期間内の有効record数(trendClassify相当の'week'バケット件数)。
  function classifyAnswerHistoryState(weekRecordCount, groupResult) {
    if (weekRecordCount === 0) return { state: 2 };
    var eligibleTypeRecordCount = groupResult.recordExcluded.length + groupResult.okRecordCount;
    if (eligibleTypeRecordCount === 0) return { state: 3 };
    if (groupResult.groups.length === 0) return { state: 4 };
    var hasUnattributedExclusion = groupResult.recordExcluded.length > 0 || groupResult.answerLevelExclusionCount > 0;
    return { state: hasUnattributedExclusion ? 6 : 5 };
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
    buildDetailCsvRows: buildDetailCsvRows,

    // 「選択の履歴」比較用（新規追加分、既存exportとは独立）
    COMPARISON_ELIGIBLE_TYPES: COMPARISON_ELIGIBLE_TYPES,
    TYPE_TO_DETAIL_TYPE: TYPE_TO_DETAIL_TYPE,
    isValidComparisonText: isValidComparisonText,
    buildContextFields: buildContextFields,
    buildConditionSignature: buildConditionSignature,
    buildComparisonKey: buildComparisonKey,
    comparisonKeyToString: comparisonKeyToString,
    extractComparisonAnswerEvents: extractComparisonAnswerEvents,
    sortComparisonAnswerEvents: sortComparisonAnswerEvents,
    groupComparisonAnswerEvents: groupComparisonAnswerEvents,
    classifyAnswerHistoryState: classifyAnswerHistoryState
  };
});
