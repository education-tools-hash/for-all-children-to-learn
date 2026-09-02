/*
 * どのまな Supporter Record Dashboard — UI Pure Logic (Phase T8-B2)
 *
 * 「学習のきろく」ページのDOM操作を含まない純粋関数群。record-dashboard-
 * foundation.js(Phase T8-B1)が返すNormalized Recordを受け取り、filter/group/
 * summary/CSV/表示ラベルへ変換する。DOM構築(textContent代入等)はlearning-
 * records.html側の薄いglueコードが担当し、このモジュールはNode.js単体
 * テスト(tools/record-dashboard-poc/ui-golden-tests.js)で検証する。
 *
 * 設計根拠: docs/design-system/donomana-supporter-record-dashboard-design-v1_0.md
 *   §26(T8-B1 Implementation Notes)を踏襲し、Foundation本体には手を入れない
 *   (B1の責務を壊さない、§5)。CSV/日付整形はregister-app.html等の既存
 *   donomanaRecordBuildCsv/registerCsvSafeCell/donomanaRecordFormatCsvDateTime
 *   と同じ方式を、Dashboard専用ファイルとして独立に持つ(21アプリ側の共通
 *   helperを変更・共有化しない、既存の「各ファイルが自分の分を持つ」慣習を踏襲)。
 *
 * Runtime: ブラウザ(window.donomanaLearningRecordsUI)とNode.js(require)の
 * 両方で動作するUMD風の最小ラッパー。新規external dependencyなし。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.donomanaLearningRecordsUI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ────────────────────────────────────────────────────────────
  //  Activity label mapping(§16: 内部値をそのまま日本語UIへ出さない)
  //
  //  21 Adapterの実装(assets/js/record-dashboard-foundation.js)から確認できる
  //  activityコードのみを対象にする。未知のコードはactivityLabel()内で
  //  「レベルN」パターン変換 → 該当なしならコードそのものを表示(教師にとって
  //  意味不明な内部値を無理に翻訳せず、フォールバックとして許容する。第一候補)。
  // ────────────────────────────────────────────────────────────

  var ACTIVITY_LABELS = {
    'checkout': 'おかいもの',
    'trace': 'なぞり',
    'quiz': 'クイズ',
    'match': 'マッチング',
    'match-solo': 'マッチング（ひとり）',
    'match-vs': 'マッチング（たいせん）',
    'puzzle': 'パズル',
    'shape': 'かたち',
    'care-log': 'きろく',
    'taiken': '体験活動',
    'preference': '好みの選択',
    // janken-app: payload.mode(janken-app.html自身のmodeNames辞書と同じ日本語表記に揃える、§16)
    'win': 'かちのは どれ？',
    'lose': 'まけるのは どれ？',
    'both': 'どちらもまぜる',
    // okane-app: e.type(adapter定義コメントで確認済みの4値のうちmatch以外、§16)
    'shop': 'おかいもの',
    'mondai': 'もんだい',
    'mistake': 'まちがいさがし',
    // sst-app: e.type(sst-app.html実コードでrecordActivity('rp',...)を確認済み)
    'rp': 'ロールプレイ',
    // kurabeyou-app: e.concept(kurabeyou-app.html実コードでcomparisonMode='size'|'length'を確認済み)
    'size': 'おおきさ くらべ',
    'length': 'ながさ くらべ',
    // mogura-tataki: e.mode(mogura-tataki.html実コードでG.mode==='time'|'count'を確認済み)
    'time': 'じかんモード',
    'count': 'かいすうモード',
    // nazori-app: e.mode(nazori-app.html実コードでdata-pmode="single"|"wide"のボタン表記と対応)
    'single': '一文字ずつ',
    'wide': '続けて書く',
    'unknown': '活動'
  };

  // マッピングにない内部コードは、教師にプログラム変数名をそのまま見せないため
  // 生コードでフォールバックせず「その他の活動」を返す(§16)。level-Nパターンは
  // 数値部分のみ流用するため除外(既存の意味あるフォールバック)。
  var UNMAPPED_FALLBACK = 'その他の活動';

  function activityLabel(code) {
    if (typeof code !== 'string' || !code) return ACTIVITY_LABELS.unknown;
    if (Object.prototype.hasOwnProperty.call(ACTIVITY_LABELS, code)) return ACTIVITY_LABELS[code];
    var m = /^level-(.+)$/.exec(code);
    if (m) return 'レベル' + m[1];
    return UNMAPPED_FALLBACK;
  }

  // ────────────────────────────────────────────────────────────
  //  Metric label mapping(§22: 存在するmetricのみ、0を捏造しない)
  // ────────────────────────────────────────────────────────────

  var METRIC_LABELS = {
    total: '問題数',
    correct: '正解数',
    mistakeCount: 'まちがえた数',
    mistakes: 'まちがえた数',
    itemCount: '商品点数',
    totalAmount: '合計金額（円）',
    paymentReceived: 'おあずかり（円）',
    change: 'おつり（円）',
    retried: 'やり直し回数',
    avgTimeSec: '平均時間（秒）',
    durationSec: '時間（秒）',
    durationMin: '時間（分）',
    pairs: 'ペア数',
    moves: '手数',
    score: 'スコア',
    maxStreak: '最大連続正解',
    chainLength: 'つながった数',
    responseTime: '反応時間（ミリ秒）',
    responseTimeMs: '反応時間（ミリ秒）',
    dwellDuration: '注視時間（ミリ秒）',
    sequenceIndex: '順番の位置',
    sequenceLength: '順番の長さ',
    trialIndex: '試行回数',
    trialTotal: '試行の総数',
    activationCount: '反応した回数',
    level: 'レベル',
    hits: '成功回数',
    misses: '失敗回数',
    rate: '正解率（%）',
    sessionDone: '完了数',
    sessionTotal: '全体数'
  };

  // metricsオブジェクトを画面表示用の{key,label,value}配列へ変換する。
  // 順序はmetricsオブジェクトのkey順(adapter側で意図した順)をそのまま使う。
  // 未知のkeyは、教師に生のプログラム変数名を見せないため既定では表示しない
  // (安全側フォールバック。ラベル未定義のmetricは今回スコープ外、§22)。
  function formatMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') return [];
    var out = [];
    Object.keys(metrics).forEach(function (key) {
      var label = METRIC_LABELS[key];
      if (!label) return;
      var value = metrics[key];
      var display;
      if (typeof value === 'boolean') {
        display = value ? '正解' : '不正解';
      } else {
        display = value;
      }
      out.push({ key: key, label: label, value: display });
    });
    return out;
  }

  // ────────────────────────────────────────────────────────────
  //  Period filter(§13)
  // ────────────────────────────────────────────────────────────

  var PERIODS = ['today', '7d', '30d', 'all'];

  function isWithinPeriod(record, period, now) {
    if (period === 'all') return true;
    if (!record || !record.timestamp) return false;
    var t = Date.parse(record.timestamp);
    if (isNaN(t)) return false;
    var nowMs = now.getTime();
    if (period === 'today') {
      var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return t >= startOfToday && t <= nowMs;
    }
    if (period === '7d') {
      var diff7 = nowMs - t;
      return diff7 >= 0 && diff7 <= 7 * 86400000;
    }
    if (period === '30d') {
      var diff30 = nowMs - t;
      return diff30 >= 0 && diff30 <= 30 * 86400000;
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────
  //  Filtering(§45: 期間→app→category→activityの結果を単一datasetから算出)
  // ────────────────────────────────────────────────────────────

  function filterRecords(records, filters, now) {
    filters = filters || {};
    var period = filters.period || 'all';
    var appId = filters.appId || 'all';
    var category = filters.category || 'all';
    var activity = filters.activity || 'all';
    now = now || new Date();
    return (records || []).filter(function (r) {
      if (!isWithinPeriod(r, period, now)) return false;
      if (appId !== 'all' && r.appId !== appId) return false;
      if (category !== 'all' && r.category !== category) return false;
      if (activity !== 'all' && r.activity !== activity) return false;
      return true;
    });
  }

  // ────────────────────────────────────────────────────────────
  //  Filter option lists(§14/§15/§16: 実際に存在する値のみ列挙)
  // ────────────────────────────────────────────────────────────

  function distinctApps(records) {
    var seen = {};
    var out = [];
    (records || []).forEach(function (r) {
      if (!seen[r.appId]) { seen[r.appId] = true; out.push({ appId: r.appId, appName: r.appName }); }
    });
    out.sort(function (a, b) { return a.appName.localeCompare(b.appName, 'ja'); });
    return out;
  }

  function distinctCategories(records) {
    var seen = {};
    var out = [];
    (records || []).forEach(function (r) {
      if (!seen[r.category]) { seen[r.category] = true; out.push(r.category); }
    });
    out.sort(function (a, b) { return a.localeCompare(b, 'ja'); });
    return out;
  }

  function distinctActivities(records) {
    var seen = {};
    var out = [];
    (records || []).forEach(function (r) {
      if (!seen[r.activity]) { seen[r.activity] = true; out.push({ value: r.activity, label: activityLabel(r.activity) }); }
    });
    out.sort(function (a, b) { return a.label.localeCompare(b.label, 'ja'); });
    return out;
  }

  // ────────────────────────────────────────────────────────────
  //  Timeline grouping(§18: 日付グループ＋Record Card、既にcollectRecords()が
  //  降順ソート済みのため、ここでは再ソートせずグルーピングのみ行う、§44)
  // ────────────────────────────────────────────────────────────

  function groupByDate(records) {
    var groups = [];
    var indexByKey = {};
    (records || []).forEach(function (r) {
      var key, label;
      if (r.timestamp) {
        var d = new Date(r.timestamp);
        if (isNaN(d.getTime())) { key = 'unknown'; label = '日付不明'; }
        else { key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); label = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
      } else {
        key = 'unknown'; label = '日付不明';
      }
      if (!Object.prototype.hasOwnProperty.call(indexByKey, key)) {
        indexByKey[key] = groups.length;
        groups.push({ key: key, label: label, records: [] });
      }
      groups[indexByKey[key]].records.push(r);
    });
    return groups;
  }

  // 表示用の日付・時刻(§43: YYYY年M月D日 / HH:mm、Invalid Dateは「日付不明」)
  function formatDisplayDateTime(timestamp) {
    if (!timestamp) return { date: '日付不明', time: '' };
    var d = new Date(timestamp);
    if (isNaN(d.getTime())) return { date: '日付不明', time: '' };
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return { date: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日', time: p(d.getHours()) + ':' + p(d.getMinutes()) };
  }

  // ────────────────────────────────────────────────────────────
  //  Summary cards(§11: 平均点/ランキング/達成率を置かない)
  // ────────────────────────────────────────────────────────────

  function buildSummary(filteredRecords, now) {
    now = now || new Date();
    var todayCount = 0;
    var appSet = {};
    (filteredRecords || []).forEach(function (r) {
      if (isWithinPeriod(r, 'today', now)) todayCount++;
      appSet[r.appId] = true;
    });
    return {
      todayCount: todayCount,
      appCount: Object.keys(appSet).length,
      totalCount: (filteredRecords || []).length
    };
  }

  // ────────────────────────────────────────────────────────────
  //  CSV(§30-33: 共通列のみ、Formula Injection guard、Excel-safe date/time、UTF-8 BOM)
  // ────────────────────────────────────────────────────────────

  var CSV_HEADER = ['日付', '時刻', '教材', 'カテゴリ', '活動', '概要', '入力方法'];

  // register-app.html の registerCsvSafeCell と同じ方式(§31)。
  function csvSafeCell(value) {
    var s = (value === null || value === undefined) ? '' : String(value);
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  // Excel実測に基づく日付/時刻分離(register-app.html donomanaRecordFormatCsvDateTime
  // と同じdot区切り方式、§43既存教訓の踏襲)。
  function formatCsvDateTime(timestamp) {
    if (!timestamp) return { date: '', time: '' };
    var d = new Date(timestamp);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return {
      date: d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()),
      time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
    };
  }

  function buildCsvRows(records) {
    var rows = [CSV_HEADER.slice()];
    (records || []).forEach(function (r) {
      var dt = formatCsvDateTime(r.timestamp);
      rows.push([
        dt.date,
        dt.time,
        csvSafeCell(r.appName),
        csvSafeCell(r.category),
        csvSafeCell(activityLabel(r.activity)),
        csvSafeCell(r.summary),
        csvSafeCell(r.inputMethod || '')
      ]);
    });
    return rows;
  }

  // donomanaRecordBuildCsv(register-app.html等)と同じcomma/quote/newline escape。
  function buildCsv(rows) {
    function escQuote(v) {
      var s = (v === null || v === undefined) ? '' : String(v);
      return /["\,\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var body = (rows || []).map(function (r) { return r.map(escQuote).join(','); }).join('\r\n');
    return '﻿' + body;
  }

  return {
    VERSION: VERSION,
    PERIODS: PERIODS,
    activityLabel: activityLabel,
    formatMetrics: formatMetrics,
    isWithinPeriod: isWithinPeriod,
    filterRecords: filterRecords,
    distinctApps: distinctApps,
    distinctCategories: distinctCategories,
    distinctActivities: distinctActivities,
    groupByDate: groupByDate,
    formatDisplayDateTime: formatDisplayDateTime,
    buildSummary: buildSummary,
    csvSafeCell: csvSafeCell,
    formatCsvDateTime: formatCsvDateTime,
    buildCsvRows: buildCsvRows,
    buildCsv: buildCsv
  };
});
