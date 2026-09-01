// Phase T8-B1 — Golden Fixtures for the Record Adapter Foundation.
//
// 21 Foundation apps分の「実Production schemaに基づく」fixtureのみ(架空schema
// 禁止)。フィールド名はassets/js/record-dashboard-foundation.jsのadapter定義
// および各app html(janken-app.html/register-app.html/tokei-app.html/
// matching-app.html/shiritori2.html/directions-app.html/hiragana-learn.html/
// katakana-app.html/suji-manabou.html/mitsukete-touch-app.html/
// junban-miyou-app.html/kurabeyou-app.html/katachi-awase-app.html/
// dotchiga-ii-app.html/miru-hirogaru-app.html/okane-app.html/sst-app.html/
// mogura-tataki.html/nazori-app.html/bosai-app.html/kyou-no-kiroku.html)から
// 直接確認したものを使用する。
'use strict';

// Nodeにlocalstorageは無いため、テスト専用の最小FakeStorage(get/setItem)を
// 用意する(donomanaRecordDashboardのcollectRecords()等はoptions.storageで
// 注入できる設計、実localStorageと同じinterfaceのみ利用)。
function FakeStorage(initial) {
  this._data = Object.assign({}, initial || {});
}
FakeStorage.prototype.getItem = function (key) {
  return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
};
FakeStorage.prototype.setItem = function (key, value) {
  this._data[key] = String(value);
};
FakeStorage.prototype.removeItem = function (key) {
  delete this._data[key];
};

// 1件の「正しい」golden fixture(生storage形状、Adapterのnormalizeへ渡す前の生データ)。
var GOLDEN = {
  'janken-app': {
    timestamp: '2026-09-01T10:00:00.000Z', appId: 'janken-app', activity: 'quiz',
    inputMethod: null, schemaVersion: 1,
    payload: { mode: 'win', total: 3, correct: 2, mistakes: [{ question: 'グーに かつのは どれ？', selected: 'チョキ', correct: 'パー' }] }
  },
  'register-app': {
    timestamp: '2026-09-01T11:00:00.000Z', appId: 'register-app', activity: 'checkout',
    inputMethod: null, schemaVersion: 1,
    payload: { itemCount: 3, totalAmount: 650, paymentReceived: 1000, change: 350, items: [{ name: 'クッキー', quantity: 3, unitPrice: 100, subtotal: 300 }] }
  },
  'tokei-app': {
    timestamp: '2026-09-01T09:00:00.000Z', appId: 'tokei-app', activity: 'quiz',
    inputMethod: null, schemaVersion: 1,
    payload: { difficulty: 'normal', mode: 'quiz', total: 5, correct: 4, retried: 1, avgTimeSec: 3.2, durationSec: 40 }
  },
  'matching-app': {
    timestamp: '2026-09-01T08:00:00.000Z', appId: 'matching-app', activity: 'match-solo',
    inputMethod: null, schemaVersion: 1,
    payload: { mode: 'match-solo', level: 2, pairs: 6, displayMode: 'grid', usedCustomSet: false, moves: 14, durationSec: 55 }
  },
  'shiritori2': {
    timestamp: '2026-09-01T07:00:00.000Z', appId: 'shiritori2', activity: 'quiz',
    inputMethod: null, schemaVersion: 1,
    payload: { mode: 'quiz', total: 8, correct: 7, score: 700, maxStreak: 5, chainLength: 8, outcome: 'complete', durationSec: 90 }
  },
  'directions-app': {
    ts: '2026-09-01T06:00:00.000Z', tsLocal: '2026/9/1 15:00:00',
    category: 'quiz', question: 'みぎに すすんで', userAnswer: 'みぎ', correctAnswer: 'みぎ', result: 'correct', schemaVersion: 1
  },
  'hiragana-learn': { time: '2026-09-01T05:00:00.000Z', type: 'trace', data: { kana: 'あ', tracingJudgmentLevel: 'standard', traceSample: null }, schemaVersion: 1 },
  'katakana-app': { time: '2026-09-01T05:10:00.000Z', type: 'quiz', data: { kana: 'ア', answer: 'ア', correct: true, correct_ans: 'ア' }, schemaVersion: 1 },
  'suji-manabou': { time: '2026-09-01T05:20:00.000Z', type: 'trace', data: { num: '3' }, schemaVersion: 1 },
  'mitsukete-touch-app': { time: '2026-09-01T04:00:00.000Z', level: 2, selectedPosition: 'left', itemRole: 'target', inputMethod: 'gaze', responseTime: 1200, dwellDuration: 800, trial: 1 },
  'junban-miyou-app': { time: '2026-09-01T03:00:00.000Z', level: 1, passenger: 'いぬ', sequenceIndex: 2, sequenceLength: 4, inputMethod: 'switch', responseTime: 900, dwellDuration: null, trialIndex: 1 },
  'kurabeyou-app': { time: '2026-09-01T02:00:00.000Z', concept: 'size', level: 3, prompt: 'more', firstSelected: 'a', selected: 'a', correct: true, mistakeSelections: [], responseTimeMs: 1500, inputMethod: null },
  'katachi-awase-app': { time: '2026-09-01T01:00:00.000Z', concept: 'shape', level: 1, questionIndex: 1, questionTotal: 5, shape: 'circle', expected: 'circle', selected: 'circle', correct: true, mistakes: 0, inputMethod: 'unknown' },
  'dotchiga-ii-app': { date: '2026-09-01', time: '2026-09-01T00:00:00.000Z', activity: 'preference', category: 'food', pair: 'apple-vs-banana', selectedChoice: 'apple', selectedLabel: 'りんご', inputMethod: 'gaze', trialIndex: 1, trialTotal: 5, dwellDuration: 700 },
  'miru-hirogaru-app': { time: '2026-08-31T23:00:00.000Z', level: 1, target: 'ひかる おもちゃ', inputMethod: 'switch', responseTime: 500, dwellDuration: 300, activationCount: 3 },
  'okane-app': { ts: '2026-08-31T22:00:00.000Z', type: 'shop', detail: '¥650のおかいもの（おつり ¥350）', schemaVersion: 1 },
  'sst-app': { ts: 1798000000000, type: 'rp', lv: 2, result: 'done', schemaVersion: 1 },
  'mogura-tataki': { date: '2026/8/31 21:00:00', score: 120, hits: 12, misses: 3, fumbles: 1, rate: 80, combo: 4, diff: 'normal', mode: 'timed', time: 60, goal: 15, holes: 9, schemaVersion: 1 },
  'nazori-app': { id: 'n1', timestamp: '2026-08-31T20:00:00.000Z', allChars: 'あいうえお', mode: 'wide', sessionDone: 4, sessionTotal: 5, durationMin: 3, isComplete: false, image: null },
  'bosai-app': { id: 'b1', kind: 'quiz', name: 'たろう', simType: 'earthquake', correct: 4, total: 5, score: 80, dateStr: '2026/8/31', timestamp: '2026-08-31T19:00:00.000Z', log: [] },
  'kyou-no-kiroku': {
    id: 'r1', childIndex: 0, childId: 'c1', childName: 'はなこ', date: '2026-08-31T18:00:00.000Z',
    kimochi: 'にこにこ', temp: 36.5, pulse: 80, spo2: 98, condition: 'よい', medication: '', toilet: '',
    water: 200, waterTime: '', seizure: false, seizureTime: '', seizureDuration: '', seizureTypes: [],
    seizureNote: '', memo: '', schemaVersion: 1
  }
};

// Corrupted storage matrix(§39)。各値をraw JSON文字列としてFakeStorageへ直接setItemする。
var CORRUPT_RAW_VALUES = {
  missing: undefined, // setItem自体しない(キー未設定)ことを表す特別値
  empty: '',
  malformed: '{not valid json',
  emptyObject: '{}',
  stringValue: '"hello"',
  numberValue: '123',
  booleanValue: 'true',
  nullValue: 'null',
  emptyArray: '[]'
};

// XSS fixture(§41)。個人名・自由入力fieldへ注入する。
var XSS_STRINGS = ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>'];

// Personal-data leakage marker(§43)。「この文字列がsummaryへ絶対に出てはならない」テスト用。
var LEAK_MARKER = '__PERSONAL_DATA_LEAK_MARKER__';

module.exports = { FakeStorage: FakeStorage, GOLDEN: GOLDEN, CORRUPT_RAW_VALUES: CORRUPT_RAW_VALUES, XSS_STRINGS: XSS_STRINGS, LEAK_MARKER: LEAK_MARKER };
