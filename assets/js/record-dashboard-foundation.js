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
        // Semantic Summary Gate修正(Phase LEARNING-RECORD-DETAIL-PARITY-
        // SIMPLE-BATCH-1): 旧実装は`p.mode`の生値をそのままactivityへ渡して
        // いた。record-dashboard-ui.jsのACTIVITY_LABELSは全App共有のflatな
        // key空間のため、mode:'both'がjanken-appの'both'('どちらもまぜる')
        // と衝突し、一覧badge/Detail/CSVの「活動」列に誤ったlabelが実表示
        // されていた(実機で再現確認済み)。'read'/'set'は未定義のため
        // UNMAPPED_FALLBACK('その他の活動')となり、意味を伝えられていな
        // かった。App IDで一意な名前空間(`tokei-`prefix)を付与し、
        // ACTIVITY_LABELSへ対応entryを追加(既存key上書きなし、janken等の
        // 既存表示は無影響)。未知のmode文字列は従来どおり生値のまま渡し、
        // UNMAPPED_FALLBACKによる安全側表示を維持する。
        activity: (function () {
          var m = p.mode;
          if (typeof m === 'string' && m) {
            return (m === 'read' || m === 'set' || m === 'both') ? ('tokei-' + m) : m;
          }
          return (typeof p.difficulty === 'string') ? p.difficulty : 'unknown';
        })(),
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    },
    // Level 2: Detail Parity(Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-
    // BATCH-1)。total/correct/retried/avgTimeSec/durationSecは既に上記
    // metrics経由でCommonへ表示済みのため、ここではその経路でカバーされ
    // ない「むずかしさ」「もんだいのしゅるい」のみを追加する(重複行を
    // 増やさない、nazori-app等と同じ最小差分方針)。実体は
    // assets/js/tokei-record-detail.js(App-localの「きろく」表示と共有、
    // 重複実装禁止)。
    getDetails: function (e) {
      return (typeof donomanaTokeiRecordDetail !== 'undefined') ? donomanaTokeiRecordDetail.getDetailRows(e) : [];
    },
    // CSV Parity。App-localの「CSVでダウンロード」と同じ9列・同じrow
    // builderで生成する(実測byte-identical)。
    getCsvActions: function () {
      if (typeof donomanaTokeiRecordDetail === 'undefined') return [];
      var D = donomanaTokeiRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 とけいのきろくをCSVで保存',
          filenamePrefix: 'tokei-gakushu-kiroku',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
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
        // Semantic Summary Gate修正(Phase LEARNING-RECORD-DETAIL-PARITY-
        // SIMPLE-BATCH-1): 旧実装は`typeof p.mode==='string'`を前提として
        // いたが、shiritori2.htmlの実際のpayload.modeは常にnumber
        // (もんすう設定値、shiritori2.html:1981実測)のため、この条件は
        // 常にfalseとなり、activityは常に'unknown'固定だった。
        // ACTIVITY_LABELS.unknown='活動'(汎用語)が表示され、実際に何問
        // モードで取り組んだかが一覧badge/Detail/CSVのどこにも一切
        // 反映されていなかった(実機で再現確認済み)。App IDで一意な名前
        // 空間(`shiritori2-Nmon`)を付与し、activityLabel()側に既存の
        // 'level-N'パターンと同型の正規表現fallbackを追加した(Nは任意の
        // 問題数に対応、10/20/30固定ではなく将来のUI変更にも耐える)。
        activity: (typeof p.mode === 'number' && isFinite(p.mode) && p.mode > 0) ? ('shiritori2-' + p.mode + 'mon') : ((typeof p.mode === 'string' && p.mode) ? p.mode : 'unknown'),
        summary: summary,
        metrics: metrics,
        inputMethod: (typeof r.inputMethod === 'string') ? r.inputMethod : null,
        hasMedia: false
      };
    },
    // Level 2: Detail Parity(Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-
    // BATCH-1)。total/correct/score/maxStreak/chainLength/durationSecは
    // 既に上記metrics経由でCommonへ表示済みのため、ここではその経路で
    // カバーされない「もんすうモード」「けっか」のみを追加する(重複行を
    // 増やさない)。実体はassets/js/shiritori2-record-detail.js
    // (App-localの「きろく」表示と共有、重複実装禁止)。
    getDetails: function (e) {
      return (typeof donomanaShiritori2RecordDetail !== 'undefined') ? donomanaShiritori2RecordDetail.getDetailRows(e) : [];
    },
    // CSV Parity。App-localの「CSVでダウンロード」と同じ9列・同じrow
    // builderで生成する(実測byte-identical)。
    getCsvActions: function () {
      if (typeof donomanaShiritori2RecordDetail === 'undefined') return [];
      var D = donomanaShiritori2RecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 しりとりのきろくをCSVで保存',
          filenamePrefix: 'shiritori2-gakushu-kiroku',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
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
    },
    // Level 2: Detail Parity(LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1、
    // Cross-App Detail Contract §8.1)。実体はassets/js/directions-record-
    // detail.js(App-localの「学習ログ」テーブル・CSVと共有、重複実装禁止)。
    getDetails: function (e) {
      return (typeof donomanaDirectionsRecordDetail !== 'undefined') ? donomanaDirectionsRecordDetail.getDetailRows(e) : [];
    },
    // richVisualizationは実装しない(Audit全体Matrix、NOT APPLICABLE——
    // directions-appは画像・軌跡等の可視化データを一切保存しない)。
    //
    // CSV Parity。App-localの「CSVでダウンロード」(exportLogCSV、全期間)と
    // 同じ7列・同じrow builderで生成する。
    getCsvActions: function () {
      if (typeof donomanaDirectionsRecordDetail === 'undefined') return [];
      var D = donomanaDirectionsRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 学習ログをCSVで保存',
          filenamePrefix: 'directions-gakushu-log',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
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
  // hiragana-learn / katakana-appはLevel 2 Detail + Level 3 Canvas Trace
  // Visualization(Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-
  // HIRAGANA-KATAKANA-1)実装のため、makeTraceQuizAdapter()の呼び出しから
  // 独立したregisterAdapter()へ切り出す(normalize()のロジックは無変更の
  // pure extraction)。suji-manabouはtraceSampleを保存しない
  // (NOT_APPLICABLE、Matrix既存判定どおり)ため、makeTraceQuizAdapter()の
  // 呼び出しのまま一切変更しない(スコープ外App、§5)。
  function makeKanaAdapter(appId, appName, storageKey, label) {
    return {
      appId: appId,
      appName: appName,
      category: '学習アプリ',
      storageKey: storageKey,
      structure: 'flat',
      // Phase LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1: 既存CSV
      // (getCsvActions参照)はtraceSample(なぞった線のstroke座標)を含まない。
      // Full Backupはrecordをそのまま保持するためstroke pointsも失わない。
      supportsFullBackup: true,
      privacyLevel: 'low',
      includeInDefaultTimeline: true,
      normalize: function (e) {
        var type = e.type;
        var data = e.data || {};
        var summary, metrics = {};
        if (type === 'trace') {
          var target = data.kana || data.num || '';
          summary = target ? ('「' + target + '」をなぞる練習をしました') : (label + 'のなぞり練習をしました');
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
        // hasMedia修正(Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-
        // HIRAGANA-KATAKANA-1で発見): 旧実装は`!!data.traceSample`のみを見て
        // おり、壊れた/legacyなtraceSampleでもhasMedia:trueと誤判定していた
        // (nazori-appのhasMediaバグと同種)。donomanaKanaRecordDetail.
        // hasAnyValidTrace()は実在性+妥当性チェックを行う。
        var D = (typeof donomanaKanaRecordDetail !== 'undefined') ? donomanaKanaRecordDetail : null;
        return {
          timestamp: toIsoTimestamp(e.time),
          activity: (typeof type === 'string') ? type : 'unknown',
          summary: summary,
          metrics: metrics,
          inputMethod: null,
          hasMedia: !!(D && D.hasAnyValidTrace(e))
        };
      },
      // Level 2: Detail Parity。実体はassets/js/kana-record-detail.js
      // (App-localの「くわしいきろく」と共有、重複実装禁止)。
      getDetails: function (e) {
        return (typeof donomanaKanaRecordDetail !== 'undefined') ? donomanaKanaRecordDetail.getDetailRows(e) : [];
      },
      // Level 3: Rich Visualization Parity。hiragana-learn/katakana-appは
      // untimed handwriting stroke trace(0..1000正規化・24点/stroke)を保存
      // しており、さわってひろがるのtimed tap/swipe trace(record-trace-
      // renderer.js)とはschemaも意味も異なるため転用しない。専用の
      // assets/js/kana-record-trace-renderer.jsで描画する(Canvas Trace
      // Level 3 Reference候補)。お手本ガイド線はKanjiVG stroke path master
      // data + TracingEngine依存のためCommon側では描画しない(Root
      // Investigationで確認・報告済みの技術判断、保存済みstrokeの形状・
      // 本数・相対位置は保持される)。
      richVisualization: {
        supports: function (e) {
          return (typeof donomanaKanaRecordDetail !== 'undefined') && donomanaKanaRecordDetail.supportsRichVisualization(e);
        },
        render: function (target, e) {
          if (typeof donomanaKanaRecordTraceRenderer === 'undefined' || typeof donomanaKanaRecordDetail === 'undefined') return;
          if (!donomanaKanaRecordDetail.hasAnyValidTrace(e)) return;
          var sample = e.data.traceSample;
          var counts = donomanaKanaRecordTraceRenderer.describeCounts(sample);
          var canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 320;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.aspectRatio = '1';
          canvas.style.display = 'block';
          canvas.style.borderRadius = '12px';
          canvas.style.background = '#FAFAFA';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', (e.data.kana ? '「' + e.data.kana + '」の' : '') + 'なぞった線。' + counts.strokeCount + '画分の記録');
          target.appendChild(canvas);
          donomanaKanaRecordTraceRenderer.render(canvas, sample, { strokeColor: appId === 'katakana-app' ? '#7b68d4' : '#4A6FA5' });

          var countText = document.createElement('p');
          countText.className = 'rich-viz-hint';
          countText.textContent = counts.strokeCount + '画のなぞり記録';
          target.appendChild(countText);
        }
      },
      // CSV Parity。App-localの「CSVでダウンロード」と同じ7列・同じrow
      // builderで生成する(実測byte-identical)。traceデータはCSVに含めない
      // (App-local既存CSVも含まない)。
      getCsvActions: function () {
        if (typeof donomanaKanaRecordDetail === 'undefined') return [];
        var D = donomanaKanaRecordDetail;
        return [
          {
            id: 'detail',
            label: '📄 ' + label + 'のきろくをCSVで保存',
            filenamePrefix: appId + '-gakushu-kiroku',
            buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
          }
        ];
      }
    };
  }
  registerAdapter(makeKanaAdapter('hiragana-learn', 'ひらがな まなぼう！', 'hiragana_log', 'ひらがな'));
  registerAdapter(makeKanaAdapter('katakana-app', 'カタカナ まなぼう！', 'katakana_log', 'カタカナ'));
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
    },
    // Level 2: Detail Parity(LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1、
    // Cross-App Detail Contract §8.1)。実体はassets/js/kurabeyou-record-detail.js
    // (App-localの「きろく」詳細展開・CSVと共有、重複実装禁止)。
    getDetails: function (e) {
      return (typeof donomanaKurabeyouRecordDetail !== 'undefined') ? donomanaKurabeyouRecordDetail.getDetailRows(e) : [];
    },
    // richVisualizationは実装しない(Matrix、NOT APPLICABLE——kurabeyou-appは
    // 画像・軌跡等の可視化データを一切保存しない)。
    getCsvActions: function () {
      if (typeof donomanaKurabeyouRecordDetail === 'undefined') return [];
      var D = donomanaKurabeyouRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 きろくをCSVで保存',
          filenamePrefix: 'kurabeyou-kiroku',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
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
    },
    // Level 2: Detail Parity(LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1、
    // Cross-App Detail Contract §8.1)。実体はassets/js/katachi-awase-record-
    // detail.js(App-localの「きろく」詳細展開・CSVと共有、重複実装禁止)。
    getDetails: function (e) {
      return (typeof donomanaKatachiAwaseRecordDetail !== 'undefined') ? donomanaKatachiAwaseRecordDetail.getDetailRows(e) : [];
    },
    // richVisualizationは実装しない(Matrix、NOT APPLICABLE——katachi-awase-app
    // は画像・軌跡等の可視化データを一切保存しない)。
    getCsvActions: function () {
      if (typeof donomanaKatachiAwaseRecordDetail === 'undefined') return [];
      var D = donomanaKatachiAwaseRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 きろくをCSVで保存',
          filenamePrefix: 'katachi-awase-kiroku',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
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
    },
    // Level 2: Detail Parity(Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-
    // BATCH-1)。Root Investigationで確認した結果、detail以外に金額・回答・
    // 正解を個別保持するfieldがそもそも存在しない(okane-app.html:1796-1799、
    // App-local自身の「かつどうログ」CSVも日付/時刻/しゅるい/ないようの
    // 4列のみ)。detail文字列から推測・逆算しないため(§5.4 No Invented
    // Semantics)、getDetails()は意図的に空配列を返す(既にsummary/activity
    // としてLevel 1で表示済みのため、Detail欄への追加行は不要)。実体は
    // assets/js/okane-record-detail.js。
    getDetails: function (e) {
      return (typeof donomanaOkaneRecordDetail !== 'undefined') ? donomanaOkaneRecordDetail.getDetailRows(e) : [];
    },
    // CSV Parity。App-localの「かつどうログ」exportと同じ4列・同じrow
    // builderで生成する(実測byte-identical)。「# サマリー」sectionは
    // 非Foundation storageのため対象外(既存コメントと同じ判断)。
    getCsvActions: function () {
      if (typeof donomanaOkaneRecordDetail === 'undefined') return [];
      var D = donomanaOkaneRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 おかねのきろくをCSVで保存',
          filenamePrefix: 'okane-gakushu-kiroku',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
    }
  });

  // SST_ACT_NAME: CSV「教材」列・summary補完用の教材名のみの複製
  // (SST-COMMON-RECORD-DETAIL-INTEGRATION-1)。sst-app.html自身のACT_LABEL
  // (アイコン付き)とは独立に、Common側はnameのみを持つ(Contract §9 Shared
  // Formatter方針、各fileが自分の分を持つ既存慣習)。
  var SST_ACT_LABEL = {
    rp: { name: 'ロールプレイ' }, wq: { name: 'ことばクイズ' }, story: { name: 'ソーシャルストーリー' },
    branch: { name: '分岐ストーリー' }, diary: { name: 'きもち日記' }, quiz: { name: 'SSTクイズ' },
    thermo: { name: 'きもち温度計' }, breath: { name: 'きもちを落ち着ける' }, photo: { name: '写真SST' },
    emotion: { name: 'きもちカード' }, phrase: { name: 'フレーズ集' }
  };

  registerAdapter({
    appId: 'sst-app',
    appName: 'SST ソーシャルスキルトレーニング',
    category: '自立活動',
    storageKey: 'sst_activity_log_v1', // sst_diary_entries_v1は絶対に参照しない(§22)
    structure: 'flat',
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    // {ts(epoch ms), type, lv, result, schemaVersion, detail?}。detailは
    // 8種類のdetail.typeを持つ任意field(SST-COMMON-RECORD-DETAIL-
    // PARITY-AUDIT-1で実測確認済み)。resultの内容種別が未確認のため、
    // 既定summaryには含めない(user-entered strings safe、§16/§43)。
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
    },
    // Level 2: Detail Parity(SST-COMMON-RECORD-DETAIL-INTEGRATION-1、
    // Cross-App Detail Contract §8.1)。実体はassets/js/sst-record-detail.js
    // (App-localの「くわしいきろく」と共有、重複実装禁止)。
    getDetails: function (e) {
      return (typeof donomanaSstRecordDetail !== 'undefined') ? donomanaSstRecordDetail.getDetailRows(e) : [];
    },
    // richVisualizationは実装しない(Audit §15、NOT APPLICABLE——SSTは画像・
    // 軌跡等の可視化データを一切保存しない)。
    //
    // CSV Parity(Audit §12/§31-35)。App-localの「今週のきろくをCSVで書き出す」
    // (週スコープ)と同じ8列・同じrow builderで、Common側は全期間(storage
    // retentionの範囲内)を対象にする(Sawatteと同じscopeの非対称性、
    // Audit §7と同型の理由——Foundation recordへのより忠実なアクセス)。
    getCsvActions: function () {
      if (typeof donomanaSstRecordDetail === 'undefined') return [];
      var D = donomanaSstRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 くわしいきろくをCSVで保存',
          filenamePrefix: 'sst-kiroku-kuwashii',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords, SST_ACT_LABEL); },
          disabled: function (rawRecords) {
            return !(rawRecords || []).some(function (r) { return D.isValidDetail(r && r.detail); });
          }
        }
      ];
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
    // Phase LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1: CSVは画像を含まない
    // (getCsvActions参照)。PNG画像がrecord中で最もサイズが大きく失われやすい
    // dataのため、Full Backup対象の第一優先(監査 §2)。
    supportsFullBackup: true,
    // charInput(→allChars)は「自由入力・名前/漢字OK」と実装コメントで明記されて
    // いるため、既定summaryには練習文字そのものを含めない(§16/§43)。
    privacyLevel: 'medium',
    includeInDefaultTimeline: true,
    // legacy shape: {id, timestamp(ISO), allChars, mode, sessionDone,
    //  sessionTotal, durationMin, isComplete, image(canvas dataURL|null),
    //  charImages([{char,image}]|undefined)}
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
      // hasMedia修正(Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-
      // NAZORI-1で発見): 旧実装は`!!e.image`のみを見ており、'single'モードの
      // セッション完了entry(画像はcharImages[]のみに入り、トップレベル
      // `image`を持たない)を常にhasMedia:falseと誤判定していた。
      // donomanaNazoriRecordDetail.hasAnyValidImage()は両shapeを検証込みで
      // 判定する(SawatteのD.isValidTrace()と同型の「実在性+妥当性」チェック)。
      var D = (typeof donomanaNazoriRecordDetail !== 'undefined') ? donomanaNazoriRecordDetail : null;
      return {
        timestamp: toIsoTimestamp(e.timestamp),
        activity: (typeof e.mode === 'string' && e.mode) ? e.mode : 'trace',
        summary: summary,
        metrics: metrics,
        inputMethod: null,
        hasMedia: !!(D && D.hasAnyValidImage(e))
      };
    },
    // Level 2: Detail Parity。'mode'/'sessionDone'/'sessionTotal'/
    // 'durationMin'は既にactivity/metrics経由でCommon Detailへ表示済みのため
    // (record-dashboard-ui.jsのACTIVITY_LABELS/METRIC_LABELS)、ここでは
    // 既存経路でカバーされない「画像記録の有無・枚数」のみを追加する
    // (Matrix Gap定義の最小差分方針、重複行を増やさない)。
    getDetails: function (e) {
      return (typeof donomanaNazoriRecordDetail !== 'undefined') ? donomanaNazoriRecordDetail.getDetailRows(e) : [];
    },
    // Level 3: Rich Visualization Parity。nazori-appはraster image(PNG
    // dataURL)保存のみで、座標/軌跡データを持たない。したがってSawatteの
    // record-trace-renderer.js(座標→canvas描画)は転用せず、保存済み画像を
    // そのまま<img>表示する「Raster Image Reference」実装とする(Sawatte=
    // Interactive Trace Referenceとは別系統、将来のhiragana/katakana
    // Polyline Canvas Referenceとも別系統——3系統は意図的に統合しない)。
    richVisualization: {
      supports: function (e) {
        return (typeof donomanaNazoriRecordDetail !== 'undefined') && donomanaNazoriRecordDetail.supportsRichVisualization(e);
      },
      render: function (target, e) {
        if (typeof donomanaNazoriRecordDetail === 'undefined') return;
        donomanaNazoriRecordDetail.renderRichVisualization(target, e);
      }
    },
    // CSV Parity。App-localの「CSVでダウンロード」(exportRecordsBtn)と同じ
    // 7列・同じrow builderで生成する。画像データはCSVに含めない(App-local
    // 既存CSVも画像を含まない——画像の閲覧はRich Visualization actionの
    // 責務として分離済み)。
    getCsvActions: function () {
      if (typeof donomanaNazoriRecordDetail === 'undefined') return [];
      var D = donomanaNazoriRecordDetail;
      return [
        {
          id: 'detail',
          label: '📄 なぞり書き記録をCSVで保存',
          filenamePrefix: 'nazori-gakushu-kiroku',
          buildRows: function (rawRecords) { return D.buildDetailCsvRows(rawRecords); }
        }
      ];
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

  // SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1(Cross-App Detail
  // Contract Reference Implementation): さわってひろがるは
  // donomanaRecordCreate()の正規Core Schema({timestamp, appId, activity,
  // inputMethod, schemaVersion, payload})をそのまま使う唯一のadapter
  // (finalizeSession()実コード確認済み。他20 adapterは歴史的経緯で ts/type
  // 等の短縮key形式を個別に読む、§35既存コメント参照)。normalize()はこの
  // 正規shapeに沿ってe.timestamp/e.payloadを直接読む。
  //
  // getDetails/richVisualization/getCsvActionsはCross-App Detail Contract
  // §8.1で確定したAdapter拡張(既存normalize()は無変更、任意fieldとして追加)。
  // ラベル変換・CSV行生成の実体はassets/js/sawatte-hirogaru-record-detail.js
  // (App-localと共有、重複実装禁止・Contract §9/§34)、trace検証・canvas
  // 描画の実体はassets/js/record-trace-renderer.js(同じくApp-localと共有、
  // Contract §10)。このFoundation moduleは元々DOM操作を持たない設計
  // (ファイル冒頭コメント)だが、richVisualization.renderのみ、Contract §8.1
  // で確定した「App-local Viewerと共有するDOM描画関数」という例外的責務を
  // 持つ(Common Detail側のUI骨格はlearning-records.html側が組み立て、この
  // 関数はその中の1要素としてcanvasを追加するだけに留める)。
  registerAdapter({
    appId: 'sawatte-hirogaru-app',
    appName: 'さわってひろがる',
    category: '認知支援',
    storageKey: 'sawatte_hirogaru_log',
    structure: 'flat',
    // Phase LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1: 既存の軌跡CSV
    // (getCsvActions参照)はtap/swipeの全座標点を含むほぼ完全な情報だが、
    // trimmed/pointLimit/traceSchemaVersionの3 fieldはCSV化されず失われる
    // (監査 §14)。Full Backupはrecordをそのまま保持するためこれらも失わない。
    supportsFullBackup: true,
    privacyLevel: 'low',
    includeInDefaultTimeline: true,
    normalize: function (e) {
      var payload = (e && e.payload && typeof e.payload === 'object') ? e.payload : {};
      var D = (typeof donomanaSawatteHirogaruRecordDetail !== 'undefined') ? donomanaSawatteHirogaruRecordDetail : null;
      return {
        timestamp: toIsoTimestamp(e && e.timestamp),
        activity: (typeof payload.mode === 'string' && payload.mode) ? payload.mode : 'unknown',
        summary: D ? D.summaryText(payload) : 'さわってひろがるに取り組みました',
        metrics: {},
        inputMethod: null,
        hasMedia: !!(D && D.isValidTrace(payload.trace))
      };
    },
    // Level 2: Detail Parity(Cross-App Detail Contract §19の必須field)。
    getDetails: function (e) {
      var payload = (e && e.payload && typeof e.payload === 'object') ? e.payload : {};
      return (typeof donomanaSawatteHirogaruRecordDetail !== 'undefined') ? donomanaSawatteHirogaruRecordDetail.getDetailRows(payload) : [];
    },
    // Level 3: Rich Visualization Parity(Contract §5/§10/§20-30)。
    richVisualization: {
      supports: function (e) {
        var payload = (e && e.payload && typeof e.payload === 'object') ? e.payload : {};
        return (typeof donomanaSawatteHirogaruRecordDetail !== 'undefined') && donomanaSawatteHirogaruRecordDetail.isValidTrace(payload.trace);
      },
      // target: 呼び出し側(learning-records.html)が用意したcontainer要素。
      // canvasを1つ追加し、App-localと同じdonomanaRecordTraceRenderer.render()
      // で描画する(Contract §10: 別描画ロジックを作らない)。凡例・カウント
      // text・trimmed注記はtext fallbackとして必ず併設する(Contract §12/§29、
      // canvas-only表示の禁止)。
      render: function (target, e) {
        if (!target || typeof document === 'undefined') return;
        var payload = (e && e.payload && typeof e.payload === 'object') ? e.payload : {};
        var trace = payload.trace;
        var D = donomanaSawatteHirogaruRecordDetail;
        var R = donomanaRecordTraceRenderer;
        if (!R || !R.isValidTrace(trace)) return;
        var counts = R.describeCounts(trace);

        var canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '220px';
        canvas.style.display = 'block';
        canvas.style.borderRadius = '12px';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', '操作の軌跡。タップ' + counts.tapCount + '回、スワイプ' + counts.swipeCount + '回の位置を示す図');
        target.appendChild(canvas);

        // rich-viz-hint: Common Detail側(learning-records.html)で定義するCSS
        // class名。App-localの`.hint`クラスとは独立(このrender()自体はまだ
        // App-local Trace Viewerからは呼ばれていない。App-local側は既存の
        // 静的markup(#traceViewerCounts等)を使い続ける、§26 Safety rule)。
        var legend = document.createElement('p');
        legend.className = 'rich-viz-hint';
        legend.textContent = '● タップ　― スワイプ';
        target.appendChild(legend);

        var countsText = document.createElement('p');
        countsText.className = 'rich-viz-hint';
        countsText.textContent = 'タップ ' + counts.tapCount + '回／スワイプ ' + counts.swipeCount + '回／操作 ' + (payload.totalInteractions || 0) + '回／活動時間 ' + (D ? D.formatDuration(payload.durationMs || 0) : '');
        target.appendChild(countsText);

        if (counts.trimmed) {
          var trimmedNote = document.createElement('p');
          trimmedNote.className = 'rich-viz-hint';
          trimmedNote.textContent = '操作が多かったため、軌跡は一部を間引いて表示しています。';
          target.appendChild(trimmedNote);
        }

        // canvas.clientWidth/Heightが確定するのはlayout後のため、App-local
        // Trace Viewerと同じくrequestAnimationFrameで描画を1フレーム遅らせる。
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () { R.render(canvas, trace); });
        } else {
          R.render(canvas, trace);
        }
      }
    },
    // CSV Parity(Contract §11/§31-35)。Common Detailから、App-localの
    // 「📄 きろくをCSVで保存」「🖊 軌跡CSVを保存」と同じ意味・同じ列構成の
    // CSVを、同じrow builder関数で生成する(重複実装禁止)。rawRecordsは
    // 呼び出し側がreadAppRecords('sawatte-hirogaru-app')で渡す(このapp全体の
    // ログ。App-local側もセッション単体ではなくログ全体をCSV化するのと同じ
    // scope、§12 semantics一致)。
    getCsvActions: function () {
      var D = donomanaSawatteHirogaruRecordDetail;
      if (!D) return [];
      return [
        {
          id: 'summary',
          label: '📄 きろくをCSVで保存',
          filenamePrefix: 'sawatte-hirogaru-kiroku',
          buildRows: function (rawRecords) { return D.buildSummaryCsvRows(rawRecords); }
        },
        {
          id: 'trace',
          label: '🖊 軌跡CSVを保存',
          filenamePrefix: 'sawatte-hirogaru-kiseki',
          buildRows: function (rawRecords) { return D.buildTraceCsvRows(rawRecords); },
          disabled: function (rawRecords) {
            return !(rawRecords || []).some(function (r) { return D.isValidTrace(r && r.payload && r.payload.trace); });
          }
        }
      ];
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
      // rawIndex修正(Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-
      // HIRAGANA-KATAKANA-1で発見): learning-records.htmlのfindRawRecord()は
      // 「同じtimestamp文字列を持つ最初のraw recordを返す」実装だった。
      // hiragana-learn/katakana-appのentry.timeは秒を持たない分単位の文字列
      // (`toLocaleDateString + HH:MM`)のため、同じ分内に複数練習すると
      // timestampが衝突し、Common DetailとRich Visualizationが誤った
      // recordのデータを表示してしまう(実機E2Eで再現確認)。normalizedへ
      // readResult.rawRecords(sliceする前の全件配列)内でのabsolute index
      // を持たせることで、findRawRecord()がtimestamp一致ではなくO(1)の
      // index参照で正しいraw recordを一意に特定できるようにする(既存の
      // normalize()契約({timestamp,activity,summary,metrics,inputMethod,
      // hasMedia})は無変更、追加fieldのみでbackward compatible)。
      var rawIndexOffset = readResult.rawRecords.length - raw.length;
      raw.forEach(function (rawRecord, rawIdx) {
        var normalized = normalizeOneEntry(adapter, rawRecord);
        if (normalized) {
          normalized.rawIndex = rawIndexOffset + rawIdx;
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

  // ────────────────────────────────────────────────────────────
  //  Level 2/3 passthrough(SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1、
  //  Cross-App Detail Contract §8.1)。上記4関数はdataのみを返す設計を維持する
  //  (ファイル冒頭方針)が、以下の3関数のみ、adapter定義に含まれる任意の
  //  getDetails/richVisualization/getCsvActionsをそのまま呼び出す薄い
  //  passthroughとして例外的に追加する。adapter未定義・未対応の場合は常に
  //  安全な既定値(空配列/false/no-op)を返し、呼び出し側(learning-records.html)
  //  はfeature-detectする必要がない。renderRichVisualizationのみDOMへ書き込む
  //  (Contract §8.1で確定したApp-local Viewerとの共有描画関数のための、この
  //  module唯一のDOM例外)。個々のadapter実装がthrowしてもcollectRecords()と
  //  同様に隔離し、呼び出し元全体を落とさない。
  // ────────────────────────────────────────────────────────────

  function getRecordDetails(appId, rawRecord) {
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter || typeof adapter.getDetails !== 'function') return [];
    try {
      var rows = adapter.getDetails(rawRecord);
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }

  function supportsRichVisualization(appId, rawRecord) {
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter || !adapter.richVisualization || typeof adapter.richVisualization.supports !== 'function') return false;
    try { return adapter.richVisualization.supports(rawRecord) === true; } catch (e) { return false; }
  }

  function renderRichVisualization(appId, target, rawRecord) {
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter || !adapter.richVisualization || typeof adapter.richVisualization.render !== 'function') return;
    try { adapter.richVisualization.render(target, rawRecord); } catch (e) {}
  }

  function getCsvActions(appId) {
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter || typeof adapter.getCsvActions !== 'function') return [];
    try {
      var actions = adapter.getCsvActions();
      return Array.isArray(actions) ? actions : [];
    } catch (e) { return []; }
  }

  // Phase LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1: CSV export (above) is
  // deliberately a human-readable Summary/Detail/Trace view and, for Nazori
  // (raster image)/Hiragana-Katakana (canvas stroke trace)/Sawatte (timed
  // interaction trace), never included the media/trace data itself — this is
  // a genuine, audited gap (docs/records/learning-record-storage-backup-
  // hardening-v1_0.md), not a bug in the CSV builders, which intentionally
  // stay human-readable. "Full Backup" is a *separate, additive* export kind:
  // the exact raw record array as persisted (already 100% lossless by
  // construction, since it is not re-derived/re-formatted at all), wrapped in
  // a small versioned envelope so a future restore path has a stable,
  // parseable format to target. Opt-in per adapter via `supportsFullBackup:
  // true` (only the 4 apps this phase's audit covers) rather than silently
  // enabled for all 22 — read-only operation (§27 of the phase spec): this
  // never writes, deletes, or mutates storage.
  var BACKUP_FORMAT_VERSION = 1;

  function getBackupAction(appId) {
    var adapter = RECORD_ADAPTERS[appId];
    if (!adapter || adapter.supportsFullBackup !== true) return null;
    return {
      id: 'full-backup',
      label: '💾 完全バックアップを書き出す（画像・軌跡を含む）',
      filenamePrefix: appId + '-full-backup',
      buildBackup: function (rawRecords) {
        var records = Array.isArray(rawRecords) ? rawRecords : [];
        return {
          backupFormatVersion: BACKUP_FORMAT_VERSION,
          exportedAt: new Date().toISOString(),
          appId: adapter.appId,
          appName: adapter.appName,
          storageKey: adapter.storageKey,
          recordCount: records.length,
          records: records
        };
      }
    };
  }

  // ───────────────────────────────────────────────────────────────────
  //  Phase LEARNING-RECORD-STORAGE-BACKUP-RESTORE-IMPLEMENTATION-1
  //  Restore from a Full Backup file (Design: docs/records/
  //  learning-record-storage-backup-restore-design-v1_0.md).
  //
  //  Three pure-ish steps, all fail-closed:
  //    checkBackupFileSize(bytes)        size gate, BEFORE the file is read/parsed
  //    planBackupRestore(text, options)  parse + validate + analyse + build the
  //                                      merged result IN MEMORY. Never writes.
  //    executeBackupRestore(plan, ...)   the only step that writes: re-reads the
  //                                      key, aborts if it changed since the
  //                                      preview, ONE setItem, read-back verify,
  //                                      rollback on verify failure.
  //  Nothing here trusts the file: the write target comes from the adapter
  //  registry (never from the file's storageKey), only opted-in apps can be
  //  restored, and records are stored exactly as validated (never field-merged).
  // ───────────────────────────────────────────────────────────────────

  // Provisional limits; to be re-evaluated by the Safari/iPad gate.
  var RESTORE_FILE_WARN_BYTES = 3 * 1024 * 1024;
  var RESTORE_FILE_MAX_BYTES = 10 * 1024 * 1024;
  var RESTORE_MAX_RECORDS = 20000;
  var RESTORE_MAX_DEPTH = 16;
  var RESTORE_MAX_IMAGE_CHARS = 8 * 1024 * 1024;
  var RESTORE_MAX_STROKES = 100;
  var RESTORE_MAX_STROKE_NUMBERS = 2000;
  var RESTORE_MAX_TRACE_NUMBERS = 6000;
  var RESTORE_MAX_SWIPES = 2000;
  var RESTORE_SUPPORTED_BACKUP_VERSION = 1;
  // Mirrors of the apps' own retention caps (enforced by the apps on their next
  // save by dropping the OLDEST records). A golden test reads the app HTML and
  // fails if these drift. Kana apps have no cap, so they are deliberately absent.
  var RESTORE_RETENTION_CAPS = { 'nazori-app': 60, 'sawatte-hirogaru-app': 200 };

  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function isPlainObject(v) { return v !== null && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]'; }
  function isForbiddenKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function isParseableDate(s) { return typeof s === 'string' && s.length > 0 && s.length <= 64 && !isNaN(Date.parse(s)); }

  // Untrusted-JSON guard: bounded depth, JSON-only value types, and no
  // __proto__/constructor/prototype keys anywhere (records are stored as-is and
  // never merged field by field, so this is defence in depth).
  function isSafeJson(value, depth) {
    if (depth > RESTORE_MAX_DEPTH) return false;
    if (value === null) return true;
    var t = typeof value;
    if (t === 'string' || t === 'boolean') return true;
    if (t === 'number') return isFinite(value);
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) { if (!isSafeJson(value[i], depth + 1)) return false; }
      return true;
    }
    if (isPlainObject(value)) {
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        if (isForbiddenKey(keys[k])) return false;
        if (!isSafeJson(value[keys[k]], depth + 1)) return false;
      }
      return true;
    }
    return false;
  }

  // Stable normalization: object keys sorted, array order preserved. Two plain
  // JSON values are deeply equal iff their canonical strings are equal.
  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      var parts = [];
      for (var i = 0; i < value.length; i++) parts.push(canonicalJson(value[i]));
      return '[' + parts.join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    var out = [];
    for (var k = 0; k < keys.length; k++) out.push(JSON.stringify(keys[k]) + ':' + canonicalJson(value[keys[k]]));
    return '{' + out.join(',') + '}';
  }

  // Non-cryptographic 53-bit hash (cyrb53). Only NARROWS candidates; a match is
  // always confirmed by full canonical-string equality. crypto.subtle is not
  // used: it is undefined on insecure (plain-http) origins.
  function hash53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function fingerprintKey(canon) { return hash53(canon) + ':' + canon.length; }

  var PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
  // Base64 of the PNG signature (89 50 4E 47 0D 0A 1A 0A): first 10 chars are fixed.
  var PNG_BASE64_MAGIC = 'iVBORw0KGg';
  function isValidRestorePngDataUrl(v) {
    if (typeof v !== 'string' || v.indexOf(PNG_DATA_URL_PREFIX) !== 0) return false;
    var b64 = v.slice(PNG_DATA_URL_PREFIX.length);
    if (b64.length === 0 || b64.length > RESTORE_MAX_IMAGE_CHARS || b64.length % 4 !== 0) return false;
    if (b64.indexOf(PNG_BASE64_MAGIC) !== 0) return false;
    return /^[A-Za-z0-9+\/]*={0,2}$/.test(b64);
  }

  function numbersInRange(arr, max, lo, hi) {
    if (arr.length > max) return false;
    for (var i = 0; i < arr.length; i++) {
      var n = arr[i];
      if (typeof n !== 'number' || !isFinite(n) || n < lo || n > hi) return false;
    }
    return true;
  }

  // Each validator returns null when the record is acceptable, else a reason code.
  function validateNazoriRestoreRecord(r) {
    if (!isPlainObject(r)) return 'not-object';
    if (!isParseableDate(r.timestamp)) return 'bad-timestamp';
    if (r.id !== undefined && (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 200)) return 'bad-id';
    if (r.sessionId !== undefined && typeof r.sessionId !== 'string') return 'bad-session';
    if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return 'bad-schema-version';
    if (r.image !== undefined && !isValidRestorePngDataUrl(r.image)) return 'bad-image';
    if (r.charImages !== undefined) {
      if (!Array.isArray(r.charImages) || r.charImages.length > 500) return 'bad-char-images';
      for (var i = 0; i < r.charImages.length; i++) {
        var ci = r.charImages[i];
        if (!isPlainObject(ci) || !isValidRestorePngDataUrl(ci.image)) return 'bad-char-images';
        if (ci.char !== undefined && typeof ci.char !== 'string') return 'bad-char-images';
      }
    }
    return null;
  }

  function validateKanaRestoreRecord(r) {
    if (!isPlainObject(r)) return 'not-object';
    if (!isParseableDate(r.time)) return 'bad-time';
    if (typeof r.type !== 'string' || r.type.length === 0) return 'bad-type';
    if (!isPlainObject(r.data)) return 'bad-data';
    if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return 'bad-schema-version';
    var ts = r.data.traceSample;
    if (ts !== undefined) {
      // Same rules as kana-record-trace-renderer.isValidTraceSample(), plus upper bounds.
      if (!isPlainObject(ts) || ts.version !== 1 || ts.coordinateSpace !== 'normalized-1000') return 'bad-trace';
      if (!Array.isArray(ts.strokes) || ts.strokes.length === 0 || ts.strokes.length > RESTORE_MAX_STROKES) return 'bad-trace';
      for (var i = 0; i < ts.strokes.length; i++) {
        var s = ts.strokes[i];
        if (!Array.isArray(s) || s.length === 0 || s.length % 2 !== 0) return 'bad-trace';
        if (!numbersInRange(s, RESTORE_MAX_STROKE_NUMBERS, 0, 1000)) return 'bad-trace';
      }
    }
    return null;
  }

  // x,y in 0..1000, t (every 3rd value) >= 0: same as record-trace-renderer.validFlatArray().
  function validSawatteFlat(arr, max) {
    if (!Array.isArray(arr) || arr.length > max || arr.length % 3 !== 0) return false;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (typeof v !== 'number' || !isFinite(v)) return false;
      if (i % 3 === 2) { if (v < 0) return false; } else if (v < 0 || v > 1000) return false;
    }
    return true;
  }

  function validateSawatteRestoreRecord(r) {
    if (!isPlainObject(r)) return 'not-object';
    if (!isParseableDate(r.timestamp)) return 'bad-timestamp';
    if (r.appId !== 'sawatte-hirogaru-app') return 'bad-app-id';
    if (typeof r.activity !== 'string' || r.activity.length === 0) return 'bad-activity';
    if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return 'bad-schema-version';
    if (!isPlainObject(r.payload)) return 'bad-payload';
    var t = r.payload.trace;
    if (t !== undefined) {
      if (!isPlainObject(t) || t.traceSchemaVersion !== 1) return 'bad-trace';
      if (typeof t.pointLimit !== 'number' || !isFinite(t.pointLimit) || t.pointLimit < 1 || t.pointLimit > 10000) return 'bad-trace';
      if (typeof t.trimmed !== 'boolean') return 'bad-trace';
      if (!validSawatteFlat(t.taps, RESTORE_MAX_TRACE_NUMBERS)) return 'bad-trace';
      if (!Array.isArray(t.swipes) || t.swipes.length > RESTORE_MAX_SWIPES) return 'bad-trace';
      for (var i = 0; i < t.swipes.length; i++) {
        if (!Array.isArray(t.swipes[i]) || t.swipes[i].length === 0 || !validSawatteFlat(t.swipes[i], RESTORE_MAX_TRACE_NUMBERS)) return 'bad-trace';
      }
    }
    return null;
  }

  var RESTORE_VALIDATORS = {
    'nazori-app': validateNazoriRestoreRecord,
    'hiragana-learn': validateKanaRestoreRecord,
    'katakana-app': validateKanaRestoreRecord,
    'sawatte-hirogaru-app': validateSawatteRestoreRecord
  };

  // Timestamp used for ordering and the preview date range.
  function restoreRecordMs(appId, r) {
    var v = (appId === 'hiragana-learn' || appId === 'katakana-app') ? r.time : r.timestamp;
    return (typeof v === 'string') ? Date.parse(v) : NaN;
  }

  // Strong identity, only where the app really has one. Kana has none (its
  // `time` has minute resolution, so "same time, different content" is normal).
  function restoreIdentity(appId, r) {
    if (appId === 'nazori-app' && typeof r.id === 'string') return 'id:' + r.id;
    if (appId === 'sawatte-hirogaru-app') return 'ts:' + r.timestamp;
    return null;
  }

  function checkBackupFileSize(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0 || bytes > RESTORE_FILE_MAX_BYTES) {
      return { level: 'reject', warnBytes: RESTORE_FILE_WARN_BYTES, maxBytes: RESTORE_FILE_MAX_BYTES };
    }
    return { level: bytes > RESTORE_FILE_WARN_BYTES ? 'warn' : 'ok', warnBytes: RESTORE_FILE_WARN_BYTES, maxBytes: RESTORE_FILE_MAX_BYTES };
  }

  function classifyRestoreWriteError(e) {
    var name = e && e.name;
    var code = (e && typeof e.code === 'number') ? e.code : null;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) return 'quota';
    if (name === 'SecurityError') return 'security';
    return 'unknown';
  }

  function rejectRestore(code, extra) {
    var r = { ok: false, code: code };
    if (extra) { for (var k in extra) { if (hasOwn(extra, k)) r[k] = extra[k]; } }
    return r;
  }

  // Parse + validate + analyse. NEVER writes storage. Result:
  //   { ok:false, code, ... }  (nothing may be restored), or
  //   { ok:true, plan:{ ...counts..., serialized, existingRaw, storageKey } }
  function planBackupRestore(text, options) {
    options = options || {};
    var storage = options.storage || getDefaultStorage();

    if (typeof text !== 'string') return rejectRestore('not-json');
    if (text.length > RESTORE_FILE_MAX_BYTES) return rejectRestore('file-too-large');
    var root;
    try { root = JSON.parse(text); } catch (e) { return rejectRestore('not-json'); }
    if (!isPlainObject(root)) return rejectRestore('bad-envelope');
    if (!isSafeJson(root, 0)) return rejectRestore('bad-envelope');

    var v = root.backupFormatVersion;
    if (typeof v !== 'number' || v % 1 !== 0 || v < 1) return rejectRestore('unsupported-version');
    if (v > RESTORE_SUPPORTED_BACKUP_VERSION) return rejectRestore('unsupported-version', { future: true });
    if (v !== RESTORE_SUPPORTED_BACKUP_VERSION) return rejectRestore('unsupported-version');

    // appId comes from the FILE: treat as untrusted (hasOwn guards inherited names
    // like "constructor"). Only adapters opted in to Full Backup that also have a
    // record validator can be restored.
    var appId = root.appId;
    if (typeof appId !== 'string' || !hasOwn(RECORD_ADAPTERS, appId) || !hasOwn(RESTORE_VALIDATORS, appId)) return rejectRestore('wrong-app');
    var adapter = RECORD_ADAPTERS[appId];
    if (adapter.supportsFullBackup !== true) return rejectRestore('wrong-app');
    // The file's storageKey is never a write target; it must merely agree with the adapter's.
    if (root.storageKey !== adapter.storageKey) return rejectRestore('wrong-key');
    var storageKey = adapter.storageKey;

    var records = root.records;
    if (!Array.isArray(records) || records.length > RESTORE_MAX_RECORDS) return rejectRestore('bad-envelope');
    if (typeof root.recordCount !== 'number' || root.recordCount % 1 !== 0 || root.recordCount !== records.length) return rejectRestore('bad-envelope');
    if (!isParseableDate(root.exportedAt)) return rejectRestore('bad-envelope');

    var validate = RESTORE_VALIDATORS[appId];
    var invalidCount = 0;
    for (var i = 0; i < records.length; i++) { if (validate(records[i]) !== null) invalidCount++; }
    if (invalidCount > 0) return rejectRestore('invalid-records', { invalidCount: invalidCount });

    // Existing data: never overwritten if it cannot be read as an array.
    var existingRaw, existing;
    try { existingRaw = storage.getItem(storageKey); } catch (e2) { return rejectRestore('storage-unavailable'); }
    if (existingRaw === null || existingRaw === undefined || existingRaw === '') {
      existing = [];
      existingRaw = (existingRaw === '') ? '' : null;
    } else {
      try { existing = JSON.parse(existingRaw); } catch (e3) { return rejectRestore('existing-unreadable'); }
      if (!Array.isArray(existing)) return rejectRestore('existing-unreadable');
    }

    var exFp = {};
    var exIdentity = {};
    try {
      for (var x = 0; x < existing.length; x++) {
        var ek = fingerprintKey(canonicalJson(existing[x]));
        (exFp[ek] = exFp[ek] || []).push(x);
        if (isPlainObject(existing[x])) {
          var eid = restoreIdentity(appId, existing[x]);
          if (eid !== null) exIdentity[eid] = true;
        }
      }
    } catch (e4) { return rejectRestore('existing-unreadable'); }

    // Classify every backup record: duplicate / conflict / new.
    var newFp = {};
    var newIdentity = {};
    var newItems = [];
    var duplicateCount = 0, conflictCount = 0;
    var earliest = Infinity, latest = -Infinity;
    for (var b = 0; b < records.length; b++) {
      var rec = records[b];
      var ms = restoreRecordMs(appId, rec);
      if (ms < earliest) earliest = ms;
      if (ms > latest) latest = ms;
      var canon = canonicalJson(rec);
      var fk = fingerprintKey(canon);
      var isDup = false;
      var cands = exFp[fk];
      if (cands) {
        for (var c = 0; c < cands.length; c++) { if (canonicalJson(existing[cands[c]]) === canon) { isDup = true; break; } }
      }
      if (!isDup && newFp[fk]) {
        for (var d = 0; d < newFp[fk].length; d++) { if (newFp[fk][d] === canon) { isDup = true; break; } }
      }
      if (isDup) { duplicateCount++; continue; }
      var ident = restoreIdentity(appId, rec);
      if (ident !== null && (exIdentity[ident] || newIdentity[ident])) { conflictCount++; continue; }
      (newFp[fk] = newFp[fk] || []).push(canon);
      if (ident !== null) newIdentity[ident] = true;
      newItems.push({ rec: rec, ms: ms, idx: b });
    }

    // Retention: the app itself drops its OLDEST records past the cap on its next
    // save, so Restore never exceeds it and never evicts. Fill only the free
    // slots, newest backup records first; report the rest.
    var newCount = newItems.length;
    var cap = hasOwn(RESTORE_RETENTION_CAPS, appId) ? RESTORE_RETENTION_CAPS[appId] : null;
    var toAdd = newItems;
    var overLimitCount = 0;
    if (cap !== null) {
      var available = Math.max(0, cap - existing.length);
      if (newItems.length > available) {
        var byNewest = newItems.slice().sort(function (p, q) { return (q.ms - p.ms) || (q.idx - p.idx); });
        toAdd = byNewest.slice(0, available);
        overLimitCount = newItems.length - toAdd.length;
      }
    }

    var plan = {
      appId: appId,
      appName: adapter.appName,
      storageKey: storageKey,
      backupFormatVersion: v,
      exportedAt: root.exportedAt,
      total: records.length,
      newCount: newCount,
      duplicateCount: duplicateCount,
      conflictCount: conflictCount,
      invalidCount: 0,
      overLimitCount: overLimitCount,
      addCount: toAdd.length,
      existingCount: existing.length,
      retentionCap: cap,
      earliestMs: records.length ? earliest : null,
      latestMs: records.length ? latest : null,
      existingRaw: existingRaw,
      serialized: null,
      estimatedChars: existingRaw ? existingRaw.length : 0,
      finalCount: existing.length
    };

    if (toAdd.length > 0) {
      // Ordered merge: existing records keep their exact relative order (never
      // re-sorted, never dropped); new ones are inserted by timestamp, ties
      // after the existing record.
      var addSorted = toAdd.slice().sort(function (p, q) { return (p.ms - q.ms) || (p.idx - q.idx); });
      var merged = [];
      var ei = 0, ai = 0;
      while (ei < existing.length && ai < addSorted.length) {
        var et = isPlainObject(existing[ei]) ? restoreRecordMs(appId, existing[ei]) : NaN;
        if (addSorted[ai].ms < et) merged.push(addSorted[ai++].rec);
        else merged.push(existing[ei++]);
      }
      while (ei < existing.length) merged.push(existing[ei++]);
      while (ai < addSorted.length) merged.push(addSorted[ai++].rec);
      plan.serialized = JSON.stringify(merged);
      plan.estimatedChars = plan.serialized.length;
      plan.finalCount = merged.length;
    }
    return { ok: true, plan: plan };
  }

  // The only step that writes. ONE setItem for the ONE key the plan names.
  // Success is reported only after a read-back proves the exact value is stored.
  function executeBackupRestore(plan, options) {
    options = options || {};
    var storage = options.storage || getDefaultStorage();
    if (!plan || typeof plan.storageKey !== 'string' || plan.storageKey.length === 0) return { ok: false, code: 'bad-plan' };
    if (typeof plan.serialized !== 'string') return { ok: true, added: 0, noWrite: true };

    var current;
    try { current = storage.getItem(plan.storageKey); } catch (e) { return { ok: false, code: 'security' }; }
    if (current === undefined) current = null;
    if (current !== plan.existingRaw) return { ok: false, code: 'stale' };

    try {
      storage.setItem(plan.storageKey, plan.serialized);
    } catch (e2) {
      return { ok: false, code: classifyRestoreWriteError(e2) };
    }

    var readBack;
    try { readBack = storage.getItem(plan.storageKey); } catch (e3) { readBack = undefined; }
    if (readBack === plan.serialized) {
      return { ok: true, added: plan.addCount, duplicates: plan.duplicateCount, conflicts: plan.conflictCount,
               overLimit: plan.overLimitCount, finalCount: plan.finalCount };
    }

    // Written value does not read back exactly: do NOT report success. Try to put
    // the previous value back (held in memory only; no permanent safety key).
    var rolledBack = false;
    try {
      if (plan.existingRaw === null) storage.removeItem(plan.storageKey);
      else storage.setItem(plan.storageKey, plan.existingRaw);
      var after = storage.getItem(plan.storageKey);
      rolledBack = (plan.existingRaw === null) ? (after === null || after === undefined) : (after === plan.existingRaw);
    } catch (e4) { rolledBack = false; }
    return { ok: false, code: rolledBack ? 'verify-failed' : 'critical', rolledBack: rolledBack };
  }

  return {
    VERSION: VERSION,
    planBackupRestore: planBackupRestore,
    executeBackupRestore: executeBackupRestore,
    checkBackupFileSize: checkBackupFileSize,
    getAdapters: getAdapters,
    readAppRecords: readAppRecords,
    collectRecords: collectRecords,
    normalizeRecord: normalizeRecord,
    getRecordDetails: getRecordDetails,
    supportsRichVisualization: supportsRichVisualization,
    renderRichVisualization: renderRichVisualization,
    getCsvActions: getCsvActions,
    getBackupAction: getBackupAction
  };
});
