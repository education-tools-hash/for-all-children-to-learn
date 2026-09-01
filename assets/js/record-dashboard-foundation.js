/*
 * どのまな Supporter Record Dashboard — Adapter Foundation (Phase T8-B1)
 *
 * 「21種類のRecordを、安全な共通Recordへ変換できる層」を提供する。
 * Dashboard UI・Timeline UI・横断CSV UIはこのモジュールに含まない(T8-B2以降)。
 *
 * 設計根拠: docs/design-system/donomana-supporter-record-dashboard-design-v1_0.md
 *   - Foundation Persistent = 21 apps。うちStandard Core Schema実利用は5本のみ、
 *     残り16本は独自entry shape(§2)。→ Adapter Registry方式を採用(§9.4)。
 *   - Existing storage keysをread-only aggregation(Global Indexは不採用、§9.2)。
 *   - Device-level first。kyou-no-kirokuはchildName等を含む別domainのため
 *     既定Timelineから除外(includeInDefaultTimeline:false、§7/§20)。
 *   - gaze-keyboardはCommunication History Standardの別系統のため、このAdapter
 *     Registry(21本)には含めない(§21、既存donomana-communication-history-
 *     standard-v1_0.md §3の決定を踏襲)。
 *   - sst-appはFoundation正式storage(sst_activity_log_v1)のみ読む。日記storage
 *     (sst_diary_entries_v1)は絶対に参照しない(§22)。
 *   - nazori-appの画像(canvas dataURL)はnormalized objectへコピーしない。
 *     hasMedia:trueのみを返す(§23)。
 *   - Timeline summaryでは個人名・自由入力を既定では表示しない(§16/§43)。
 *     bosai-appの氏名、nazori-appのallChars(名前受容と明記済み)、register-app
 *     の商品名はいずれもsummaryへ含めず、件数・金額等の非個人情報のみで組み立てる。
 *
 * Runtime: ブラウザ(window.donomanaRecordDashboard)とNode.js(require)の両方で
 * 動作するUMD風の最小ラッパー。新規external dependencyなし(§50)。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaRecordDashboard = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ────────────────────────────────────────────────────────────
  //  Internal helpers (not part of the public API)
  // ────────────────────────────────────────────────────────────

  function getDefaultStorage() {
    try {
      return (typeof localStorage !== 'undefined') ? localStorage : null;
    } catch (e) {
      // 一部環境(プライベートモード等)ではlocalStorageアクセス自体がthrowしうる。
      return null;
    }
  }

  // 各appのtimestamp/date/time相当のfieldを受け取り、ISO 8601文字列へ正規化する。
  // Date/ISO文字列/epoch ms/ja-JPロケール文字列を受け付け、解析できない場合は
  // nullを返す(Dashboard全体をInvalid Dateでthrowさせない、§11/§29)。
  function toIsoTimestamp(value) {
    if (value === null || value === undefined || value === '') return null;
    var d;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'number') {
      d = new Date(value);
    } else if (typeof value === 'string') {
      d = new Date(value);
    } else {
      return null;
    }
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Foundation I/Oプリミティブ(donomanaRecordReadLog)と同じcontractのsafe reader。
  // missing key/empty/malformed JSON/valid non-arrayは全て安全にitems:[]。
  // 1app分の破損が他appの収集を妨げない(§24)。書き込みは一切行わない(§25)。
  // anomalyは診断用(§55): キー未設定/空("そのアプリを一度も使っていない"という
  // 正常な状態)はnull、実際の破損(malformed JSON/valid non-array等)のみ理由文字列
  // を返す。呼び出し側はitems([]を含む)をそのまま処理継続してよい。
  function safeReadArray(storage, key) {
    if (!storage || typeof key !== 'string') return { items: [], anomaly: null };
    var raw;
    try {
      raw = storage.getItem(key);
    } catch (e) {
      return { items: [], anomaly: 'read-exception' };
    }
    if (!raw) return { items: [], anomaly: null };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { items: [], anomaly: 'malformed-json' };
    }
    if (Array.isArray(parsed)) return { items: parsed, anomaly: null };
    return { items: [], anomaly: 'non-array' };
  }

  // kyou-no-kiroku等、storageKeyの値がrecord配列そのものではなく複合object
  // ({children:[...], records:[...]}等)の場合のsafe reader(donomanaRecord
  // ReadNestedCollectionと同じcontract)。anomalyの考え方はsafeReadArrayと同じ。
  function safeReadNested(storage, key, field) {
    if (!storage || typeof key !== 'string') return { items: [], anomaly: null };
    var raw;
    try {
      raw = storage.getItem(key);
    } catch (e) {
      return { items: [], anomaly: 'read-exception' };
    }
    if (!raw) return { items: [], anomaly: null };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { items: [], anomaly: 'malformed-json' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { items: [], anomaly: 'non-object' };
    var arr = parsed[field];
    return Array.isArray(arr) ? { items: arr, anomaly: null } : { items: [], anomaly: 'non-array-field' };
  }

  // ────────────────────────────────────────────────────────────
  //  Normalized Record Contract
  //
  //  {
  //    timestamp:    ISO 8601 string または null(解析不能/欠落時)
  //    appId:        string  — 常にAdapter Registry側のcanonical値(raw recordの
  //                  自称appIdは信用しない。§12: 別appへの偽装を防ぐ)
  //    appName:      string  — Adapter Registryから(§9決定A、apps-data.json複製せず)
  //    category:     string  — 同上
  //    activity:     string  — 判別できない場合は 'unknown'(§13)
  //    summary:      string  — plain text のみ。HTML fragment禁止(§14)。教師が読む
  //                  短い日本語1〜2文。score等の生値だけの機械的な文字列にしない。
  //                  自動評価語(苦手/成長した/できるようになった等)を含めない(§15)。
  //    metrics:      object  — 存在するfieldだけを持つ。存在しないmetricを0として
  //                  捏造しない(§17)。
  //    inputMethod:  string または null — 実値がある場合のみ(推測禁止、§18)。
  //    privacyLevel: 'low' | 'medium' | 'high'(§19、表示上の警告ではなく内部制御用)
  //    hasMedia:     boolean — 画像等バイナリ的データを元recordが持つ場合true。
  //                  実体(base64等)はここに複製しない(§23/§34)。
  //  }
  // ────────────────────────────────────────────────────────────

  function buildNormalized(adapter, partial) {
    return {
      timestamp: (typeof partial.timestamp === 'string') ? partial.timestamp : null,
      appId: adapter.appId,
      appName: adapter.appName,
      category: adapter.category,
      activity: (typeof partial.activity === 'string' && partial.activity) ? partial.activity : 'unknown',
      summary: (typeof partial.summary === 'string' && partial.summary) ? partial.summary : '（この記録の概要を生成できませんでした）',
      metrics: (partial.metrics && typeof partial.metrics === 'object' && !Array.isArray(partial.metrics)) ? partial.metrics : {},
      inputMethod: (typeof partial.inputMethod === 'string' && partial.inputMethod) ? partial.inputMethod : null,
      privacyLevel: adapter.privacyLevel,
      hasMedia: partial.hasMedia === true
    };
  }

  // adapter.normalize()を1件ずつtry/catchで隔離する。adapterがthrowしても
  // collectRecords()全体をthrowさせない(§26)。storage全体はvalid arrayでも
  // 個々のentryがnull/文字列/配列等の場合は安全にskipする(§30)。
  function normalizeOneEntry(adapter, rawRecord) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) return null;
    var partial;
    try {
      partial = adapter.normalize(rawRecord);
    } catch (e) {
      return null;
    }
    if (!partial || typeof partial !== 'object') return null;
    return buildNormalized(adapter, partial);
  }

  // ────────────────────────────────────────────────────────────
  //  Adapter Registry(21 Foundation apps)
  //
  //  各adapterの normalize(raw) は raw storage 1entryを受け取り、
  //  { timestamp, activity, summary, metrics, inputMethod, hasMedia } の
  //  部分objectを返す(appId/appName/category/privacyLevelはbuildNormalized側で
  //  adapter定義から補完するためadapter.normalize()は返さない)。
  //
  //  フィールド名は実コード(各app html)から確認したものを使用。架空schemaを
  //  想定しない(§35)。未確認・不確実な部分は安全側(null/'unknown'/フィールド
  //  省略)へフォールバックする。
  // ────────────────────────────────────────────────────────────

  var RECORD_ADAPTERS = {};

  function registerAdapter(def) {
    RECORD_ADAPTERS[def.appId] = def;
  }

  // ---- Standard Core Schema実利用 5本 ----
  // donomanaRecordCreate()の { timestamp, appId, activity, inputMethod,
  // schemaVersion, payload } を実際に使うアプリ。ただし共通schemaでも
  // payload構造はアプリごとに異なるため、共通adapterで雑にsummaryまで
  // 処理しない(§37)。

  registerAdapter({
    appId: 'janken-app',
    appName: 'じゃんけん まなぼう！',
    category: '認知支援',
    storageKey: 'janken_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    normalize: function (r) {
      var p = r.payload || {};
      var total = (typeof p.total === 'number') ? p.total : null;
      var correct = (typeof p.correct === 'number') ? p.correct : null;
      var mistakes = Array.isArray(p.mistakes) ? p.mistakes : [];
      var summary;
      if (total !== null && correct !== null) {
        summary = total + '問中' + correct + '問正解';
        if (mistakes.length > 0) summary += '。' + mistakes.length + '問で間違いがありました';
      } else {
        summary = 'じゃんけんクイズに取り組みました';
      }
      var metrics = {};
      if (total !== null) metrics.total = total;
      if (correct !== null) metrics.correct = correct;
      metrics.mistakeCount = mistakes.length;
      return {
        timestamp: toIsoTimestamp(r.timestamp),
        activity: (typeof p.mode === 'string') ? p.mode : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'register-app',
    appName: 'はんばいかい レジ',
    category: '学習アプリ',
    storageKey: 'register_log',
    structure: 'flat',
    // items[].name は教師の自由入力(T7-J)。Timeline既定summaryには含めない(§43)。
    privacyLevel: 'medium',
    includeInDefaultTimeline: true,
    normalize: function (r) {
      var p = r.payload || {};
      var itemCount = (typeof p.itemCount === 'number') ? p.itemCount : null;
      var totalAmount = (typeof p.totalAmount === 'number') ? p.totalAmount : null;
      var summary;
      if (itemCount !== null && totalAmount !== null) {
        summary = itemCount + '点購入。合計' + totalAmount + '円';
      } else {
        summary = 'お買い物ごっこに取り組みました';
      }
      var metrics = {};
      if (itemCount !== null) metrics.itemCount = itemCount;
      if (totalAmount !== null) metrics.totalAmount = totalAmount;
      if (typeof p.paymentReceived === 'number') metrics.paymentReceived = p.paymentReceived;
      if (typeof p.change === 'number') metrics.change = p.change;
      return {
        timestamp: toIsoTimestamp(r.timestamp),
        activity: 'checkout',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'tokei-app',
    appName: 'とけい',
    category: '学習アプリ',
    storageKey: 'tokei_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    normalize: function (r) {
      var p = r.payload || {};
      var total = (typeof p.total === 'number') ? p.total : null;
      var correct = (typeof p.correct === 'number') ? p.correct : null;
      var summary = (total !== null && correct !== null) ? (total + '問中' + correct + '問正解') : 'とけいクイズに取り組みました';
      var metrics = {};
      if (total !== null) metrics.total = total;
      if (correct !== null) metrics.correct = correct;
      if (typeof p.retried === 'number') metrics.retried = p.retried;
      if (typeof p.avgTimeSec === 'number') metrics.avgTimeSec = p.avgTimeSec;
      if (typeof p.durationSec === 'number') metrics.durationSec = p.durationSec;
      return {
        timestamp: toIsoTimestamp(r.timestamp),
        activity: (typeof p.mode === 'string') ? p.mode : ((typeof p.difficulty === 'string') ? p.difficulty : 'unknown'),
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'matching-app',
    appName: 'マッチング',
    category: '認知支援',
    storageKey: 'matching_log',
    structure: 'flat',
    privacyLevel: 'low', // たいせんモードはplayerCountのみ、氏名は設計上保存しない(確認済み)
    includeInDefaultTimeline: true,
    normalize: function (r) {
      var p = r.payload || {};
      var pairs = (typeof p.pairs === 'number') ? p.pairs : null;
      var moves = (typeof p.moves === 'number') ? p.moves : null;
      var summary;
      if (pairs !== null && moves !== null) {
        summary = pairs + 'ペアを' + moves + '手で完成';
      } else {
        summary = 'マッチングに取り組みました';
      }
      if (p.mode === 'match-vs' && typeof p.playerCount === 'number') {
        summary += '（' + p.playerCount + '人でたいせん）';
      }
      var metrics = {};
      if (pairs !== null) metrics.pairs = pairs;
      if (moves !== null) metrics.moves = moves;
      if (typeof p.durationSec === 'number') metrics.durationSec = p.durationSec;
      return {
        timestamp: toIsoTimestamp(r.timestamp),
        activity: (typeof p.mode === 'string') ? p.mode : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'shiritori2',
    appName: 'しりとりあそび',
    category: '学習アプリ',
    storageKey: 'shiritori2_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    normalize: function (r) {
      var p = r.payload || {};
      var total = (typeof p.total === 'number') ? p.total : null;
      var correct = (typeof p.correct === 'number') ? p.correct : null;
      var summary = (total !== null && correct !== null) ? (total + '問中' + correct + '問正解') : 'しりとりあそびに取り組みました';
      if (typeof p.chainLength === 'number') summary += '。' + p.chainLength + '語つながりました';
      var metrics = {};
      if (total !== null) metrics.total = total;
      if (correct !== null) metrics.correct = correct;
      if (typeof p.score === 'number') metrics.score = p.score;
      if (typeof p.maxStreak === 'number') metrics.maxStreak = p.maxStreak;
      if (typeof p.chainLength === 'number') metrics.chainLength = p.chainLength;
      if (typeof p.durationSec === 'number') metrics.durationSec = p.durationSec;
      return {
        timestamp: toIsoTimestamp(r.timestamp),
        activity: (typeof p.mode === 'string') ? p.mode : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    }
  });

  // ---- 独自entry shape 16本 ----

  registerAdapter({
    appId: 'directions-app',
    appName: 'ほうこうとばしょをまなぼう',
    category: '学習アプリ',
    storageKey: 'appLogs',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // 1entry = 1問(セッション単位ではない)。{ts, tsLocal, category, question,
    // userAnswer, correctAnswer, result, schemaVersion}
    normalize: function (e) {
      var isCorrect = e.result === 'correct';
      var summary = (typeof e.question === 'string' && e.question)
        ? ('「' + e.question + '」に' + (isCorrect ? '正解' : '不正解'))
        : (isCorrect ? '問題に正解しました' : '問題に不正解でした');
      return {
        timestamp: toIsoTimestamp(e.ts),
        activity: (typeof e.category === 'string') ? e.category : 'unknown',
        summary: summary,
        metrics: { correct: isCorrect },
        inputMethod: null,
        hasMedia: false
      };
    }
  });

  // hiragana-learn / katakana-app / suji-manabou は同じ {time,type,data} 形式。
  function makeTraceQuizAdapter(appId, appName, storageKey, label) {
    return {
      appId: appId,
      appName: appName,
      category: '学習アプリ',
      storageKey: storageKey,
      structure: 'flat',
      privacyLevel: 'low',
      includeInDefaultTimeline: true,
      normalize: function (e) {
        var type = e.type;
        var data = e.data || {};
        var summary, metrics = {}, hasMedia = false;
        if (type === 'trace') {
          var target = data.kana || data.num || '';
          summary = target ? ('「' + target + '」をなぞる練習をしました') : (label + 'のなぞり練習をしました');
          hasMedia = !!data.traceSample;
        } else if (type === 'quiz') {
          var isCorrect = data.correct === true;
          summary = data.kana ? ('「' + data.kana + '」の問題に' + (isCorrect ? '正解' : '不正解')) : ((isCorrect ? '問題に正解しました' : '問題に不正解でした'));
          metrics.correct = isCorrect;
        } else if (type === 'match') {
          summary = label + 'のマッチング練習をしました';
          if (typeof data.difficulty === 'string') summary += '（' + data.difficulty + '）';
        } else {
          summary = label + 'の学習に取り組みました';
        }
        return {
          timestamp: toIsoTimestamp(e.time),
          activity: (typeof type === 'string') ? type : 'unknown',
          summary: summary,
          metrics: metrics,
          inputMethod: null,
          hasMedia: hasMedia
        };
      }
    };
  }
  registerAdapter(makeTraceQuizAdapter('hiragana-learn', 'ひらがな まなぼう！', 'hiragana_log', 'ひらがな'));
  registerAdapter(makeTraceQuizAdapter('katakana-app', 'カタカナ まなぼう！', 'katakana_log', 'カタカナ'));
  registerAdapter(makeTraceQuizAdapter('suji-manabou', 'すうじ まなぼう！', 'suji_log', 'すうじ'));

  registerAdapter({
    appId: 'mitsukete-touch-app',
    appName: 'どこかな？みーつけた！',
    category: '認知支援',
    storageKey: 'mitsukete_touch_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {time, level, selectedPosition, itemRole('target'|'other'), inputMethod,
    //  responseTime, dwellDuration, ...}
    normalize: function (e) {
      var summary = (e.itemRole === 'target') ? 'めあての場所をみつけました' : 'べつの場所をタッチしました';
      var metrics = {};
      if (typeof e.responseTime === 'number') metrics.responseTime = e.responseTime;
      if (typeof e.dwellDuration === 'number') metrics.dwellDuration = e.dwellDuration;
      return {
        timestamp: toIsoTimestamp(e.time),
        activity: (typeof e.level !== 'undefined') ? ('level-' + e.level) : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof e.inputMethod === 'string') ? e.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'junban-miyou-app',
    appName: 'じゅんばんにみよう',
    category: '認知支援',
    storageKey: 'junban_miyou_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {time, level, passenger, sequenceIndex, sequenceLength, inputMethod,
    //  responseTime, dwellDuration, trialIndex}
    normalize: function (e) {
      var summary = (typeof e.sequenceIndex === 'number' && typeof e.sequenceLength === 'number')
        ? ('じゅんばんの活動に取り組みました（' + e.sequenceIndex + '/' + e.sequenceLength + '）')
        : 'じゅんばんの活動に取り組みました';
      var metrics = {};
      if (typeof e.sequenceIndex === 'number') metrics.sequenceIndex = e.sequenceIndex;
      if (typeof e.sequenceLength === 'number') metrics.sequenceLength = e.sequenceLength;
      if (typeof e.responseTime === 'number') metrics.responseTime = e.responseTime;
      if (typeof e.dwellDuration === 'number') metrics.dwellDuration = e.dwellDuration;
      return {
        timestamp: toIsoTimestamp(e.time),
        activity: (typeof e.level !== 'undefined') ? ('level-' + e.level) : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof e.inputMethod === 'string') ? e.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'kurabeyou-app',
    appName: 'おおきい？ちいさい？くらべよう',
    category: '学習アプリ',
    storageKey: 'kurabeyou_log',
    structure: 'flat',
    privacyLevel: 'low', // 「間違えた内容」は固定問題文由来、自由入力なし
    includeInDefaultTimeline: true,
    // level 2/3/4で持つfieldが異なる(shape詳細はT8-B2で精緻化候補)。
    // {time, concept, level, correct?, mistakes?, mistakeSelections?,
    //  mistakeDetails?, responseTimeMs?, inputMethod?}
    normalize: function (e) {
      var parts = [];
      if (typeof e.correct === 'boolean') parts.push(e.correct ? '正解' : '不正解');
      if (e.level === 4 && typeof e.mistakes === 'number' && e.mistakes > 0) parts.push(e.mistakes + '回まちがえました');
      var summary = parts.length ? parts.join('。') : '「くらべよう」に取り組みました';
      var metrics = {};
      if (typeof e.mistakes === 'number') metrics.mistakes = e.mistakes;
      if (typeof e.correct === 'boolean') metrics.correct = e.correct;
      if (typeof e.responseTimeMs === 'number') metrics.responseTimeMs = e.responseTimeMs;
      var im = (typeof e.inputMethod === 'string' && e.inputMethod) ? e.inputMethod : null;
      return {
        timestamp: toIsoTimestamp(e.time),
        activity: (typeof e.concept === 'string') ? e.concept : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: im,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'katachi-awase-app',
    appName: 'かたちをあわせよう',
    category: '学習アプリ',
    storageKey: 'katachi_log',
    structure: 'flat',
    privacyLevel: 'low', // パズル名は固定カタログ(20種)由来、自由入力ではない
    includeInDefaultTimeline: true,
    // concept==='puzzle': {time, concept, level, correct, patternName/patternId, durationMs}
    // それ以外(shape系): {time, concept, level, correct, mistakes, inputMethod('unknown'あり)}
    normalize: function (e) {
      var concept = e.concept || 'shape';
      if (concept === 'puzzle') {
        var name = e.patternName || e.patternId || '';
        var summary = name
          ? ('「' + name + '」のパズルを' + (e.correct ? '完成しました' : '試みました'))
          : (e.correct ? 'パズルを完成しました' : 'パズルに取り組みました');
        var metrics = {};
        if (typeof e.durationMs === 'number') metrics.durationSec = Math.round(e.durationMs / 1000);
        return {
          timestamp: toIsoTimestamp(e.time),
          activity: 'puzzle',
          summary: summary,
          metrics: metrics,
          inputMethod: null,
          hasMedia: false
        };
      }
      var parts = [];
      if (typeof e.correct === 'boolean') parts.push(e.correct ? '正解' : '不正解');
      if (typeof e.mistakes === 'number' && e.mistakes > 0) parts.push(e.mistakes + '回まちがえました');
      var summary2 = parts.length ? parts.join('。') : 'かたちあわせに取り組みました';
      var metrics2 = {};
      if (typeof e.mistakes === 'number') metrics2.mistakes = e.mistakes;
      if (typeof e.correct === 'boolean') metrics2.correct = e.correct;
      // このappはinputMethod不明時に文字列'unknown'を使う独自慣習があるため、
      // 実値(touch/gaze/switch等)のみ採用しnullへ正規化する(推測禁止、§18)。
      var im = (typeof e.inputMethod === 'string' && e.inputMethod && e.inputMethod !== 'unknown') ? e.inputMethod : null;
      return {
        timestamp: toIsoTimestamp(e.time),
        activity: concept,
        summary: summary2,
        metrics: metrics2,
        inputMethod: im,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'dotchiga-ii-app',
    appName: 'どっちがいい？',
    category: '認知支援',
    storageKey: 'dotchiga_ii_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {date, time, activity, category, pair, selectedChoice, selectedLabel,
    //  inputMethod, trialIndex, trialTotal, dwellDuration}
    normalize: function (e) {
      var label = e.selectedLabel || e.selectedChoice || '';
      var summary = label ? ('「' + label + '」を選びました') : '「どっちがいい？」に取り組みました';
      var metrics = {};
      if (typeof e.trialIndex === 'number') metrics.trialIndex = e.trialIndex;
      if (typeof e.trialTotal === 'number') metrics.trialTotal = e.trialTotal;
      if (typeof e.dwellDuration === 'number') metrics.dwellDuration = e.dwellDuration;
      return {
        timestamp: toIsoTimestamp(e.time),
        activity: (typeof e.activity === 'string' && e.activity) ? e.activity : ((typeof e.category === 'string') ? e.category : 'unknown'),
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof e.inputMethod === 'string') ? e.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'miru-hirogaru-app',
    appName: 'みるとひろがる',
    category: '認知支援',
    storageKey: 'miru_hirogaru_log',
    structure: 'flat',
    privacyLevel: 'low', // targetはapp-authoredの固定semantic label(実装コメントで確認済み)
    includeInDefaultTimeline: true,
    // {time, level, target, inputMethod, responseTime, dwellDuration, activationCount}
    normalize: function (e) {
      var summary = (typeof e.target === 'string' && e.target) ? ('「' + e.target + '」に取り組みました') : 'あそびに取り組みました';
      var metrics = {};
      if (typeof e.responseTime === 'number') metrics.responseTime = e.responseTime;
      if (typeof e.dwellDuration === 'number') metrics.dwellDuration = e.dwellDuration;
      if (typeof e.activationCount === 'number') metrics.activationCount = e.activationCount;
      return {
        timestamp: toIsoTimestamp(e.time),
        activity: (typeof e.level !== 'undefined') ? ('level-' + e.level) : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof e.inputMethod === 'string') ? e.inputMethod : null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'okane-app',
    appName: 'おかねのおべんきょう',
    category: '学習アプリ',
    storageKey: 'okane_activity_log',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {ts(ISO), type('match'|'shop'|'mondai'|'mistake'), detail(既にアプリ側が
    //  生成した教師向け自然文), schemaVersion}。okane_records(非Foundation集計)
    //  は対象外。
    normalize: function (e) {
      var summary = (typeof e.detail === 'string' && e.detail) ? e.detail : 'おかねの活動に取り組みました';
      return {
        timestamp: toIsoTimestamp(e.ts),
        activity: (typeof e.type === 'string') ? e.type : 'unknown',
        summary: summary,
        metrics: {},
        inputMethod: null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'sst-app',
    appName: 'SST ソーシャルスキルトレーニング',
    category: '自立活動',
    storageKey: 'sst_activity_log_v1', // sst_diary_entries_v1は絶対に参照しない(§22)
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {ts(epoch ms), type, lv, result, schemaVersion}。resultの内容種別が未確認
    // のため、既定summaryには含めない(user-entered strings safe、§16/§43)。
    normalize: function (e) {
      var summary = 'SSTの活動に取り組みました';
      if (typeof e.type === 'string' && e.type) summary += '（' + e.type + '）';
      var metrics = {};
      if (typeof e.lv === 'number') metrics.level = e.lv;
      return {
        timestamp: toIsoTimestamp(e.ts),
        activity: (typeof e.type === 'string') ? e.type : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'mogura-tataki',
    appName: 'もぐらたたき',
    category: '自立活動',
    storageKey: 'mogura_v3',
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {date(ja-JPロケール文字列), score, hits, misses, rate, combo, diff, mode, ...}
    normalize: function (e) {
      var summary;
      if (typeof e.score === 'number') {
        summary = 'スコア' + e.score + '点';
        if (typeof e.rate === 'number') summary += '（正解率' + e.rate + '%）';
      } else {
        summary = 'もぐらたたきに取り組みました';
      }
      var metrics = {};
      if (typeof e.score === 'number') metrics.score = e.score;
      if (typeof e.hits === 'number') metrics.hits = e.hits;
      if (typeof e.misses === 'number') metrics.misses = e.misses;
      if (typeof e.rate === 'number') metrics.rate = e.rate;
      return {
        timestamp: toIsoTimestamp(e.date),
        activity: (typeof e.mode === 'string') ? e.mode : ((typeof e.diff === 'string') ? e.diff : 'unknown'),
        summary: summary,
        metrics: metrics,
        inputMethod: null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'nazori-app',
    appName: 'なぞり書き練習ツール',
    category: '学習アプリ',
    storageKey: 'nazori_records',
    structure: 'flat',
    // charInput(→allChars)は「自由入力・名前/漢字OK」と実装コメントで明記されて
    // いるため、既定summaryには練習文字そのものを含めない(§16/§43)。
    privacyLevel: 'medium',
    includeInDefaultTimeline: true,
    // legacy shape: {id, timestamp(ISO), allChars, mode, sessionDone,
    //  sessionTotal, durationMin, isComplete, image(canvas dataURL|null)}
    normalize: function (e) {
      var summary;
      if (typeof e.sessionDone === 'number' && typeof e.sessionTotal === 'number') {
        summary = 'なぞり書きに取り組みました（' + e.sessionDone + '/' + e.sessionTotal + '文字）';
      } else {
        summary = 'なぞり書きに取り組みました';
      }
      var metrics = {};
      if (typeof e.sessionDone === 'number') metrics.sessionDone = e.sessionDone;
      if (typeof e.sessionTotal === 'number') metrics.sessionTotal = e.sessionTotal;
      if (typeof e.durationMin === 'number') metrics.durationMin = e.durationMin;
      return {
        timestamp: toIsoTimestamp(e.timestamp),
        activity: (typeof e.mode === 'string' && e.mode) ? e.mode : 'trace',
        summary: summary,
        metrics: metrics,
        inputMethod: null,
        hasMedia: !!e.image
      };
    }
  });

  registerAdapter({
    appId: 'bosai-app',
    appName: 'ぼうさいたんけんたい',
    category: '学習アプリ',
    storageKey: 'bosai_log',
    structure: 'flat',
    // nameは児童名の専用自由入力フィールドで毎レコードに保存される(T8-A時点の
    // Medium判定から、専用フィールドである実態を踏まえてhighへ確定、§13/Final Report)。
    privacyLevel: 'high',
    includeInDefaultTimeline: true,
    // {id, kind('taiken'|'quiz'), name, simType, correct, total, score,
    //  dateStr, timestamp(ISO), log:[...]}。nameは既定summaryに含めない。
    normalize: function (e) {
      var summary;
      if (e.kind === 'quiz' && typeof e.correct === 'number' && typeof e.total === 'number') {
        summary = 'ぼうさいクイズに取り組みました（' + e.correct + '/' + e.total + '問正解）';
      } else if (e.kind === 'taiken') {
        summary = 'ぼうさい体験活動に取り組みました';
      } else {
        summary = 'ぼうさいたんけんたいの活動に取り組みました';
      }
      var metrics = {};
      if (typeof e.correct === 'number') metrics.correct = e.correct;
      if (typeof e.total === 'number') metrics.total = e.total;
      if (typeof e.score === 'number') metrics.score = e.score;
      return {
        // dateStrは表示用の整形済み文字列で解析が不安定なため、ISOのtimestamp
        // fieldを優先する。
        timestamp: toIsoTimestamp(e.timestamp) || toIsoTimestamp(e.dateStr),
        activity: (typeof e.kind === 'string') ? e.kind : 'unknown',
        summary: summary,
        metrics: metrics,
        inputMethod: null,
        hasMedia: false
      };
    }
  });

  registerAdapter({
    appId: 'kyou-no-kiroku',
    appName: 'きょうのきろく',
    category: '自立活動',
    storageKey: 'kyounokiroku',
    structure: 'nested',
    nestedField: 'records',
    // childName・医療情報・自由記述memo/seizureNoteを含むケア記録。学習活動
    // metricのどのカテゴリにも当てはまらない独立domain(design doc §5)。
    privacyLevel: 'high',
    // 既定Timelineには含めない(design doc §7 Decision A、§20)。将来T8-B2で
    // 「別の記録」導線を検討する。
    includeInDefaultTimeline: false,
    normalize: function (e) {
      // 児童名・体温・脈拍・発作メモ等は一切summary/metricsへ含めない。
      return {
        timestamp: toIsoTimestamp(e.date),
        activity: 'care-log',
        summary: 'きょうのきろくが記録されました',
        metrics: {},
        inputMethod: null,
        hasMedia: false
      };
    }
  });

  // ────────────────────────────────────────────────────────────
  //  Public API(最小限、§7)
  // ────────────────────────────────────────────────────────────

  // 21 Foundation appsのAdapter一覧を返す(読み取り専用の浅いコピー、内部の
  // normalize関数実体は含めない安全な公開metadataのみ)。
  function getAdapters() {
    return Object.keys(RECORD_ADAPTERS).map(function (appId) {
      var a = RECORD_ADAPTERS[appId];
      return {
        appId: a.appId,
        appName: a.appName,
        category: a.category,
        storageKey: a.storageKey,
        privacyLevel: a.privacyLevel,
        includeInDefaultTimeline: a.includeInDefaultTimeline !== false
      };
    });
  }

  // 1アプリ分のstorageを安全に読む(未normalize、生のentry配列)。
  // 戻り値は必ずok/rawRecordsを持ち、失敗時もthrowしない。errorTypeは
  // ok:trueのままでも入りうる(malformed-json等、致命的ではないが診断すべき
  // 異常。§55)。未使用アプリ(key未設定)はerrorType:nullの正常系として扱う。
  function readAppRecords(appId, options) {
    options = options || {};
    var storage = options.storage || getDefaultStorage();
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter) return { appId: appId, ok: false, errorType: 'unknown-app', rawRecords: [] };
    try {
      var result = (adapter.structure === 'nested')
        ? safeReadNested(storage, adapter.storageKey, adapter.nestedField || 'records')
        : safeReadArray(storage, adapter.storageKey);
      return { appId: appId, ok: true, errorType: result.anomaly, rawRecords: result.items };
    } catch (e) {
      return { appId: appId, ok: false, errorType: 'read-exception', rawRecords: [] };
    }
  }

  // 1件のrawRecordをNormalized Record Contractへ変換する。appIdはAdapter
  // Registry側のcanonical値のみ使用し、raw record自身が自称するappIdは信用
  // しない(なりすまし対策、§12)。失敗時はnullを返す(throwしない)。
  function normalizeRecord(appId, record) {
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter) return null;
    return normalizeOneEntry(adapter, record);
  }

  // 複数appのRecordを収集・正規化・ソートして返す。
  // options:
  //   storage               読み込み元(既定: 実localStorage。テスト用に注入可)
  //   appIds                対象appId配列(既定: 全21)
  //   includeSeparateDomains kyou-no-kiroku等 includeInDefaultTimeline=false の
  //                          adapterも含めるか(既定false)
  //   maxPerApp              app毎に直近何件まで読むか(既定50、§32)
  //   limit                  全体の最終件数上限(既定なし、§33はUI側で決定)
  function collectRecords(options) {
    options = options || {};
    var storage = options.storage || getDefaultStorage();
    var maxPerApp = (typeof options.maxPerApp === 'number' && options.maxPerApp >= 0) ? options.maxPerApp : 50;
    var includeSeparateDomains = options.includeSeparateDomains === true;
    var appIds = Array.isArray(options.appIds) ? options.appIds : Object.keys(RECORD_ADAPTERS);

    var records = [];
    var errors = [];

    appIds.forEach(function (appId) {
      var adapter = RECORD_ADAPTERS[appId];
      if (!adapter) {
        errors.push({ appId: appId, errorType: 'unknown-app' });
        return;
      }
      if (!includeSeparateDomains && adapter.includeInDefaultTimeline === false) return;

      var readResult;
      try {
        readResult = readAppRecords(appId, { storage: storage });
      } catch (e) {
        errors.push({ appId: appId, errorType: 'read-exception' });
        return;
      }
      if (!readResult.ok) {
        errors.push({ appId: appId, errorType: readResult.errorType });
        return;
      }
      // ok:trueでもmalformed-json等の非致命的異常は診断用に記録する(§55)。
      // rawRecordsは既に安全な[]なので処理は継続する。
      if (readResult.errorType) {
        errors.push({ appId: appId, errorType: readResult.errorType });
      }

      // storageは古い順にpushされている前提(全21appでlog.push(entry)方式を確認済み)。
      // 末尾N件が直近N件になる。
      var raw = (maxPerApp > 0) ? readResult.rawRecords.slice(-maxPerApp) : readResult.rawRecords;
      raw.forEach(function (rawRecord) {
        var normalized = normalizeOneEntry(adapter, rawRecord);
        if (normalized) {
          records.push(normalized);
        } else {
          errors.push({ appId: appId, errorType: 'invalid-entry' });
        }
      });
    });

    records.sort(function (a, b) {
      var ta = a.timestamp ? Date.parse(a.timestamp) : -Infinity;
      var tb = b.timestamp ? Date.parse(b.timestamp) : -Infinity;
      return tb - ta; // 降順(新しい順)。invalid timestampは末尾へ。
    });

    var totalBeforeLimit = records.length;
    var limited = (typeof options.limit === 'number' && options.limit >= 0) ? records.slice(0, options.limit) : records;

    return {
      records: limited,
      errors: errors,
      meta: {
        totalBeforeLimit: totalBeforeLimit,
        appCount: appIds.length
      }
    };
  }

  return {
    VERSION: VERSION,
    getAdapters: getAdapters,
    readAppRecords: readAppRecords,
    collectRecords: collectRecords,
    normalizeRecord: normalizeRecord
  };
});
