#!/usr/bin/env node
// Phase LEARNING-RECORD-TRACE-VISUALIZATION-PARITY-HIRAGANA-KATAKANA-1 —
// Golden Test Harness for hiragana-learn / katakana-app's Level 2 Detail
// Parity + Level 3 Canvas Trace Visualization Parity ("Canvas Stroke
// Reference", distinct from Sawatte's Interactive Trace Reference and
// nazori-app's Raster Image Reference).
//
// hiragana-learn.html and katakana-app.html were confirmed (real code
// read) to save byte-identical traceSample schema and identical
// isValidTraceSample()/rendering logic (only the stroke color differs:
// hiragana #4A6FA5, katakana #7b68d4), so both apps share the same
// kana-record-trace-renderer.js / kana-record-detail.js modules and are
// covered together in this one suite rather than duplicating near-
// identical test code across two files.
//
// Usage: node tools/record-dashboard-poc/hiragana-katakana-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps is covered by
// golden-tests.js / ui-golden-tests.js / sawatte-common-detail-golden-tests.js
// / sst-common-detail-golden-tests.js / directions-common-detail-golden-tests.js
// / kurabeyou-common-detail-golden-tests.js / katachi-awase-common-detail-golden-tests.js
// / nazori-common-detail-golden-tests.js (re-run alongside this file, not
// duplicated here). suji-manabou is unaffected (still registered via the
// unmodified makeTraceQuizAdapter() factory, out of scope for this phase).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const KanaRenderer = require(path.join(REPO_ROOT, 'assets', 'js', 'kana-record-trace-renderer.js'));
const KanaDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'kana-record-detail.js'));
// record-dashboard-foundation.js's hiragana-learn/katakana-app adapters
// reference the shared modules as bare globals (browser <script src>
// convention) -- expose them the same way here for Node.
global.donomanaKanaRecordTraceRenderer = KanaRenderer;
global.donomanaKanaRecordDetail = KanaDetail;
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const { FakeStorage } = require('./fixtures.js');

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

// captureCanvas()相当: 実App(hiragana-learn.html/katakana-app.html)の
// buildTraceSample()が実際に返す形式(version:1, coordinateSpace:
// 'normalized-1000', 24点/stroke flat[x,y,...]配列)に揃えたfake値。
function fakeStroke(seed) {
  var flat = [];
  for (var i = 0; i < 24; i++) { flat.push((seed + i * 3) % 1001, (seed + i * 5) % 1001); }
  return flat;
}
function fakeSample(strokeCount) {
  var strokes = [];
  for (var i = 0; i < (strokeCount || 1); i++) strokes.push(fakeStroke(i * 37 + 10));
  return { version: 1, coordinateSpace: 'normalized-1000', strokes: strokes };
}

// ────────────────────────────────────────────────────────────
section('1. Adapter registration (Level 1 metadata, backward compat, both apps independent)');
// ────────────────────────────────────────────────────────────
const hiraMeta = dash.getAdapters().find(a => a.appId === 'hiragana-learn');
const kataMeta = dash.getAdapters().find(a => a.appId === 'katakana-app');
const sujiMeta = dash.getAdapters().find(a => a.appId === 'suji-manabou');
check('hiragana-learn still registered', !!hiraMeta);
check('katakana-app still registered', !!kataMeta);
check('hiragana-learn appName/category/storageKey unchanged', hiraMeta && hiraMeta.appName === 'ひらがな まなぼう！' && hiraMeta.category === '学習アプリ' && hiraMeta.storageKey === 'hiragana_log');
check('katakana-app appName/category/storageKey unchanged', kataMeta && kataMeta.appName === 'カタカナ まなぼう！' && kataMeta.category === '学習アプリ' && kataMeta.storageKey === 'katakana_log');
check('suji-manabou still registered and untouched (out of scope, still via makeTraceQuizAdapter)', !!sujiMeta && sujiMeta.storageKey === 'suji_log');
check('suji-manabou has NO getDetails/richVisualization/getCsvActions (scope boundary respected)', !sujiMeta.getDetails && !sujiMeta.richVisualization && !sujiMeta.getCsvActions);

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — trace / quiz / match, both apps');
// ────────────────────────────────────────────────────────────
const HIRA_FIXTURES = {
  trace_normal: { time: '2026-09-18T01:00:00.000Z', type: 'trace', data: { kana: 'あ', tracingJudgmentLevel: 'standard', traceSample: fakeSample(1) }, schemaVersion: 1 },
  trace_multi_stroke: { time: '2026-09-18T01:05:00.000Z', type: 'trace', data: { kana: 'か', tracingJudgmentLevel: 'precise', traceSample: fakeSample(3) }, schemaVersion: 1 },
  trace_no_sample: { time: '2026-09-18T01:10:00.000Z', type: 'trace', data: { kana: 'さ', tracingJudgmentLevel: 'easy', traceSample: null }, schemaVersion: 1 },
  trace_malformed_point: { time: '2026-09-18T01:15:00.000Z', type: 'trace', data: { kana: 'た', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [[NaN, 0, 'x', 0, Infinity, 0, -1, 0]] } }, schemaVersion: 1 },
  trace_malformed_stroke: { time: '2026-09-18T01:20:00.000Z', type: 'trace', data: { kana: 'な', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [null, [], 'not-an-array', [1, 2, 3]] } }, schemaVersion: 1 },
  trace_negative_coords: { time: '2026-09-18T01:25:00.000Z', type: 'trace', data: { kana: 'は', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [[-50, -50, 100, 100]] } }, schemaVersion: 1 },
  trace_extreme_coords: { time: '2026-09-18T01:30:00.000Z', type: 'trace', data: { kana: 'ま', traceSample: { version: 1, coordinateSpace: 'normalized-1000', strokes: [[1e9, 1e9, Infinity, -Infinity]] } }, schemaVersion: 1 },
  trace_unknown_schema: { time: '2026-09-18T01:35:00.000Z', type: 'trace', data: { kana: 'や', traceSample: { version: 99, coordinateSpace: 'normalized-1000', strokes: [[0, 0, 500, 500]] } }, schemaVersion: 1 },
  trace_legacy_no_field: { time: '2026-09-18T01:40:00.000Z', type: 'trace', data: { kana: 'ら' }, schemaVersion: 1 }, // pre-T5-E-A''' record: no traceSample field at all
  trace_long: { time: '2026-09-18T01:45:00.000Z', type: 'trace', data: { kana: 'わ', tracingJudgmentLevel: 'standard', traceSample: fakeSample(12) }, schemaVersion: 1 },
  quiz_correct: { time: '2026-09-18T01:50:00.000Z', type: 'quiz', data: { kana: 'き', answer: 'き', correct: true, correct_ans: 'き' }, schemaVersion: 1 },
  quiz_wrong: { time: '2026-09-18T01:55:00.000Z', type: 'quiz', data: { kana: 'く', answer: 'つ', correct: false, correct_ans: 'く' }, schemaVersion: 1 },
  match_entry: { time: '2026-09-18T02:00:00.000Z', type: 'match', data: {}, schemaVersion: 1 },
  html_like_kana: { time: '2026-09-18T02:05:00.000Z', type: 'quiz', data: { kana: '<img src=x onerror="window.__xss=true">', answer: '<script>window.__xss=true</script>', correct: false, correct_ans: '"&<>' }, schemaVersion: 1 },
  unknown_type: { time: '2026-09-18T02:10:00.000Z', type: 'somethingnew', data: { foo: 'bar' }, schemaVersion: 1 }
};

const storageH = new FakeStorage();
storageH.setItem('hiragana_log', JSON.stringify(Object.keys(HIRA_FIXTURES).map(k => HIRA_FIXTURES[k])));
const collectedH = dash.collectRecords({ storage: storageH, appIds: ['hiragana-learn'], maxPerApp: 50 });
check('hiragana-learn: all fixtures normalize without crashing', collectedH.records.length === Object.keys(HIRA_FIXTURES).length, collectedH.records.length);
check('hiragana-learn: 0 read/normalize errors', collectedH.errors.length === 0, collectedH.errors);

// katakana-app: same fixtures minus 'match' (katakana never logs it), plus
// the same edge cases, to confirm the shared normalize() handles a 'match'
// entry safely on katakana too even though App-local never produces one.
const KATA_FIXTURES = Object.assign({}, HIRA_FIXTURES);
const storageK = new FakeStorage();
storageK.setItem('katakana_log', JSON.stringify(Object.keys(KATA_FIXTURES).map(k => KATA_FIXTURES[k])));
const collectedK = dash.collectRecords({ storage: storageK, appIds: ['katakana-app'], maxPerApp: 50 });
check('katakana-app: all fixtures normalize without crashing', collectedK.records.length === Object.keys(KATA_FIXTURES).length, collectedK.records.length);
check('katakana-app: 0 read/normalize errors', collectedK.errors.length === 0, collectedK.errors);

// ────────────────────────────────────────────────────────────
section('3. hasMedia bug fix regression (must validate, not just check presence)');
// ────────────────────────────────────────────────────────────
function hasMediaSingle(appId, storageKey, fixture) {
  const s = new FakeStorage();
  s.setItem(storageKey, JSON.stringify([fixture]));
  const res = dash.collectRecords({ storage: s, appIds: [appId], maxPerApp: 5 });
  return res.records[0] && res.records[0].hasMedia;
}
['hiragana-learn', 'katakana-app'].forEach(appId => {
  const key = appId === 'hiragana-learn' ? 'hiragana_log' : 'katakana_log';
  check(`${appId}: trace_normal -> hasMedia true`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_normal) === true);
  check(`${appId}: trace_multi_stroke -> hasMedia true`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_multi_stroke) === true);
  check(`${appId}: trace_no_sample -> hasMedia false`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_no_sample) === false);
  check(`${appId}: trace_malformed_point -> hasMedia false (this was the pre-existing bug: old code only checked !!traceSample presence)`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_malformed_point) === false);
  check(`${appId}: trace_malformed_stroke -> hasMedia false`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_malformed_stroke) === false);
  check(`${appId}: trace_unknown_schema -> hasMedia false`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_unknown_schema) === false);
  check(`${appId}: trace_legacy_no_field -> hasMedia false, no crash`, hasMediaSingle(appId, key, HIRA_FIXTURES.trace_legacy_no_field) === false);
  check(`${appId}: quiz_correct -> hasMedia false (quiz never has media)`, hasMediaSingle(appId, key, HIRA_FIXTURES.quiz_correct) === false);
  check(`${appId}: match_entry -> hasMedia false, no crash`, hasMediaSingle(appId, key, HIRA_FIXTURES.match_entry) === false);
  check(`${appId}: unknown_type -> hasMedia false, no crash`, hasMediaSingle(appId, key, HIRA_FIXTURES.unknown_type) === false);
});

// ────────────────────────────────────────────────────────────
section('4. isValidTraceSample() / describeCounts() — direct renderer module validation');
// ────────────────────────────────────────────────────────────
check('isValidTraceSample: normal 1-stroke -> true', KanaRenderer.isValidTraceSample(fakeSample(1)) === true);
check('isValidTraceSample: multi-stroke -> true', KanaRenderer.isValidTraceSample(fakeSample(5)) === true);
check('isValidTraceSample: null -> false', KanaRenderer.isValidTraceSample(null) === false);
check('isValidTraceSample: undefined -> false', KanaRenderer.isValidTraceSample(undefined) === false);
check('isValidTraceSample: wrong version -> false', KanaRenderer.isValidTraceSample({ version: 2, coordinateSpace: 'normalized-1000', strokes: [[0, 0]] }) === false);
check('isValidTraceSample: wrong coordinateSpace -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'other', strokes: [[0, 0]] }) === false);
check('isValidTraceSample: empty strokes array -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [] }) === false);
check('isValidTraceSample: odd-length stroke (unpaired x) -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[0, 0, 500]] }) === false);
check('isValidTraceSample: NaN coordinate -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[NaN, 0]] }) === false);
check('isValidTraceSample: Infinity coordinate -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[Infinity, 0]] }) === false);
check('isValidTraceSample: negative coordinate -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[-1, 0]] }) === false);
check('isValidTraceSample: out-of-range coordinate (>1000) -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [[1001, 0]] }) === false);
check('isValidTraceSample: string coordinate -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [['0', 0]] }) === false);
check('isValidTraceSample: null stroke among valid strokes -> false (entire sample invalid, matches App-local exact semantics)', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: [null, [0, 0]] }) === false);
check('isValidTraceSample: non-array stroke -> false', KanaRenderer.isValidTraceSample({ version: 1, coordinateSpace: 'normalized-1000', strokes: ['not-an-array'] }) === false);

check('describeCounts: 1-stroke sample -> strokeCount 1', KanaRenderer.describeCounts(fakeSample(1)).strokeCount === 1);
check('describeCounts: 5-stroke sample -> strokeCount 5', KanaRenderer.describeCounts(fakeSample(5)).strokeCount === 5);
check('describeCounts: invalid sample -> strokeCount 0, no throw', JSON.stringify(KanaRenderer.describeCounts(null)) === JSON.stringify({ strokeCount: 0 }));

// ────────────────────────────────────────────────────────────
section('5. getDetails() via the real public API — Level 2 Detail Parity');
// ────────────────────────────────────────────────────────────
function detailsFor(appId, fixture) { return dash.getRecordDetails(appId, fixture); }
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.trace_normal);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('trace_normal: 文字 = あ', map['文字'] === 'あ', map);
  check('trace_normal: なぞり方 = ひょうじゅん (standard)', map['なぞり方'] === 'ひょうじゅん', map);
  check('trace_normal: なぞりの記録 = あり', map['なぞりの記録'] === 'あり', map);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.trace_no_sample);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('trace_no_sample: なぞり方 = やさしく (easy)', map['なぞり方'] === 'やさしく', map);
  check('trace_no_sample: なぞりの記録 = なし', map['なぞりの記録'] === 'なし', map);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.trace_legacy_no_field);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('trace_legacy_no_field: なぞり方 row absent (no tracingJudgmentLevel, not fabricated)', !('なぞり方' in map), map);
  check('trace_legacy_no_field: なぞりの記録 = なし, no crash', map['なぞりの記録'] === 'なし', map);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.quiz_correct);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('quiz_correct: 文字 = き', map['文字'] === 'き', map);
  check('quiz_correct: こたえ = き', map['こたえ'] === 'き', map);
  check('quiz_correct: せいかいのこたえ = き', map['せいかいのこたえ'] === 'き', map);
  check('quiz_correct: 正解数 row NOT duplicated here (already covered by existing generic metrics.correct passthrough)', !('正解数' in map), map);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.quiz_wrong);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('quiz_wrong: こたえ = つ (what the child actually answered)', map['こたえ'] === 'つ', map);
  check('quiz_wrong: せいかいのこたえ = く (the correct answer)', map['せいかいのこたえ'] === 'く', map);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.match_entry);
  check('match_entry: getDetailRows returns [] (App-local also shows no extra fields for match)', Array.isArray(rows) && rows.length === 0, rows);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.unknown_type);
  check('unknown_type: getDetailRows returns [], no crash', Array.isArray(rows) && rows.length === 0, rows);
}
{
  const rows = detailsFor('hiragana-learn', HIRA_FIXTURES.html_like_kana);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('html_like_kana: raw markup preserved as plain string data (rendering layer handles safety via textContent, not this data layer)', map['文字'] === '<img src=x onerror="window.__xss=true">', map);
}
check('getRecordDetails never throws on null/undefined entry (hiragana-learn)', (function () { try { dash.getRecordDetails('hiragana-learn', null); dash.getRecordDetails('hiragana-learn', undefined); return true; } catch (e) { return false; } })());
check('getRecordDetails never throws on null/undefined entry (katakana-app)', (function () { try { dash.getRecordDetails('katakana-app', null); dash.getRecordDetails('katakana-app', undefined); return true; } catch (e) { return false; } })());

// katakana-app: same field semantics via the same shared module.
{
  const rows = detailsFor('katakana-app', HIRA_FIXTURES.trace_multi_stroke);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('katakana-app trace_multi_stroke: 文字 = か', map['文字'] === 'か', map);
  check('katakana-app trace_multi_stroke: なぞり方 = ていねいに (precise)', map['なぞり方'] === 'ていねいに', map);
}

// ────────────────────────────────────────────────────────────
section('6. Rich Visualization — Level 3, Canvas Stroke-based (valid / missing / malformed / extreme / unknown schema / multi-stroke)');
// ────────────────────────────────────────────────────────────
{
  ['hiragana-learn', 'katakana-app'].forEach(appId => {
    check(`${appId} supports true: trace_normal`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_normal) === true);
    check(`${appId} supports true: trace_multi_stroke`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_multi_stroke) === true);
    check(`${appId} supports true: trace_negative_coords is actually invalid (negative rejected) -> false`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_negative_coords) === false);
    check(`${appId} supports false: trace_no_sample`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_no_sample) === false);
    check(`${appId} supports false: trace_malformed_point`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_malformed_point) === false);
    check(`${appId} supports false: trace_malformed_stroke`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_malformed_stroke) === false);
    check(`${appId} supports false: trace_extreme_coords`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_extreme_coords) === false);
    check(`${appId} supports false: trace_unknown_schema`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_unknown_schema) === false);
    check(`${appId} supports false: trace_legacy_no_field`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_legacy_no_field) === false);
    check(`${appId} supports false: quiz_correct (not a trace type)`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.quiz_correct) === false);
    check(`${appId} supports false: match_entry`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.match_entry) === false);
    check(`${appId} supports true: trace_long (12 strokes)`, dash.supportsRichVisualization(appId, HIRA_FIXTURES.trace_long) === true);
  });
  check('supports false for an unregistered appId', dash.supportsRichVisualization('does-not-exist', HIRA_FIXTURES.trace_normal) === false);

  // Minimal fake DOM + fake 2D context (Cross-App Contract §12/§25: canvas +
  // text fallback, never canvas-only; strokeStyle captured to verify each
  // app keeps its own established color, not a generic shared one).
  function FakeCtx() {
    this._strokeStyles = []; this.lineWidth = 0; this.lineCap = ''; this.lineJoin = '';
    this.save = () => {}; this.restore = () => {}; this.beginPath = () => {}; this.moveTo = () => {}; this.lineTo = () => {}; this.stroke = () => { this._strokeStyles.push(this.strokeStyle); }; this.clearRect = () => {};
  }
  function FakeCanvas() {
    this.tag = 'canvas'; this.style = {}; this._attrs = {}; this.width = 0; this.height = 0;
    this._ctx = new FakeCtx();
    this.setAttribute = (k, v) => { this._attrs[k] = v; };
    this.getContext = () => this._ctx;
  }
  function FakeEl(tag) {
    this.tag = tag; this.style = {}; this._attrs = {}; this.children = []; this.textContent = ''; this.className = '';
    this.setAttribute = (k, v) => { this._attrs[k] = v; };
    this.appendChild = (c) => { this.children.push(c); };
  }
  const fakeDocument = { createElement(tag) { return tag === 'canvas' ? new FakeCanvas() : new FakeEl(tag); } };
  global.document = fakeDocument;

  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('hiragana-learn', target, HIRA_FIXTURES.trace_normal);
    const canvases = target.children.filter(c => c.tag === 'canvas');
    check('hiragana-learn render: 1 canvas appended', canvases.length === 1, canvases.length);
    check('hiragana-learn render: canvas has aria-label (text-equivalent, not canvas-only)', canvases[0] && typeof canvases[0]._attrs['aria-label'] === 'string' && canvases[0]._attrs['aria-label'].length > 0, canvases[0] && canvases[0]._attrs['aria-label']);
    check('hiragana-learn render: uses hiragana stroke color #4A6FA5', canvases[0] && canvases[0]._ctx._strokeStyles.every(c => c === '#4A6FA5'), canvases[0] && canvases[0]._ctx._strokeStyles);
    check('hiragana-learn render: text fallback (stroke count) also appended, not canvas-only', target.children.some(c => c.tag === 'p' && /画/.test(c.textContent)));
  }
  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('katakana-app', target, HIRA_FIXTURES.trace_normal);
    const canvases = target.children.filter(c => c.tag === 'canvas');
    check('katakana-app render: uses katakana stroke color #7b68d4 (distinct app identity preserved)', canvases[0] && canvases[0]._ctx._strokeStyles.every(c => c === '#7b68d4'), canvases[0] && canvases[0]._ctx._strokeStyles);
  }
  {
    const target = new FakeEl('div');
    dash.renderRichVisualization('hiragana-learn', target, HIRA_FIXTURES.trace_multi_stroke);
    const canvases = target.children.filter(c => c.tag === 'canvas');
    check('trace_multi_stroke render: 1 canvas, strokes drawn as 3 separate beginPath/stroke calls (stroke separation preserved, not connected into one line)', canvases[0] && canvases[0]._ctx._strokeStyles.length === 3, canvases[0] && canvases[0]._ctx._strokeStyles.length);
  }
  {
    // no-op safety: supports() already false for these, but even a direct
    // render() call must never throw or append a broken canvas.
    ['trace_no_sample', 'trace_malformed_point', 'trace_malformed_stroke', 'trace_extreme_coords', 'trace_unknown_schema', 'trace_legacy_no_field', 'quiz_correct', 'match_entry'].forEach(key => {
      const target = new FakeEl('div');
      let threw = false;
      try { dash.renderRichVisualization('hiragana-learn', target, HIRA_FIXTURES[key]); } catch (e) { threw = true; }
      check(`${key} render: does not throw`, threw === false);
      check(`${key} render: appends nothing (safe no-op)`, target.children.length === 0, target.children.length);
    });
  }
  {
    // html_like_kana's malicious kana/answer strings must never reach the
    // canvas rendering path at all (no trace data on this fixture -> no-op).
    const target = new FakeEl('div');
    dash.renderRichVisualization('hiragana-learn', target, HIRA_FIXTURES.html_like_kana);
    check('html_like_kana render: no canvas appended (no trace data), no injected content anywhere', target.children.length === 0);
  }

  delete global.document;
}

// ────────────────────────────────────────────────────────────
section('7. CSV Parity — getCsvActions(), exact 7-column shape (App-local CSV_HEADER)');
// ────────────────────────────────────────────────────────────
{
  ['hiragana-learn', 'katakana-app'].forEach(appId => {
    const label = appId === 'hiragana-learn' ? 'ひらがな' : 'カタカナ';
    const actions = dash.getCsvActions(appId);
    check(`${appId}: getCsvActions returns exactly 1 action`, actions.length === 1, actions.length);
    check(`${appId}: action label mentions ${label}`, actions[0].label.indexOf(label) !== -1, actions[0].label);
    const rawAll = Object.keys(HIRA_FIXTURES).map(k => HIRA_FIXTURES[k]);
    const rows = actions[0].buildRows(rawAll);
    check(`${appId}: CSV header has exactly 7 columns`, rows[0].length === 7, rows[0]);
    check(`${appId}: CSV header matches App-local header exactly`, JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', '種類', 'もじ', 'こたえ', 'せいかい', 'せいかいのこたえ']), rows[0]);
    // trace/quiz/match all produce a row; unknown_type is silently skipped
    // (App-local's downloadCSV() also has no branch for unknown types).
    check(`${appId}: CSV row count = fixtures minus the 1 unknown_type (App-local silently skips unrecognized types)`, rows.length - 1 === Object.keys(HIRA_FIXTURES).length - 1, rows.length - 1);
    check(`${appId}: CSV does NOT contain any trace data (no base64/coordinate payload embedded)`, !rows.some(row => row.some(cell => typeof cell === 'string' && (cell.indexOf('coordinateSpace') !== -1 || cell.indexOf('strokes') !== -1))));

    const traceRowIdx = 1 + Object.keys(HIRA_FIXTURES).indexOf('trace_normal');
    check(`${appId}: trace CSV row = date,time,なぞり,kana,'',○,''`, rows[traceRowIdx][2] === 'なぞり' && rows[traceRowIdx][3] === 'あ' && rows[traceRowIdx][4] === '' && rows[traceRowIdx][5] === '○' && rows[traceRowIdx][6] === '', rows[traceRowIdx]);
    const quizWrongIdx = 1 + Object.keys(HIRA_FIXTURES).indexOf('quiz_wrong');
    check(`${appId}: quiz_wrong CSV row = date,time,クイズ,く,つ,×,く`, JSON.stringify(rows[quizWrongIdx].slice(2)) === JSON.stringify(['クイズ', 'く', 'つ', '×', 'く']), rows[quizWrongIdx]);
    const matchIdx = 1 + Object.keys(HIRA_FIXTURES).indexOf('match_entry');
    check(`${appId}: match CSV row = date,time,マッチング,'','',○,''`, JSON.stringify(rows[matchIdx].slice(2)) === JSON.stringify(['マッチング', '', '', '○', '']), rows[matchIdx]);
    const htmlIdx = 1 + Object.keys(HIRA_FIXTURES).indexOf('html_like_kana');
    check(`${appId}: html_like_kana CSV row preserves raw markup as plain string data`, rows[htmlIdx][3] === '<img src=x onerror="window.__xss=true">', rows[htmlIdx]);

    check(`${appId}: action does not throw on malformed log entries (null/string/number/array)`, (function () { try { actions[0].buildRows([null, 'x', 42, undefined, []]); return true; } catch (e) { return false; } })());
  });
}

// ────────────────────────────────────────────────────────────
section('8. App-local / Common semantic parity (same record, same values, same function)');
// ────────────────────────────────────────────────────────────
{
  const direct = KanaDetail.getDetailRows(HIRA_FIXTURES.trace_multi_stroke);
  const viaHiragana = dash.getRecordDetails('hiragana-learn', HIRA_FIXTURES.trace_multi_stroke);
  const viaKatakana = dash.getRecordDetails('katakana-app', HIRA_FIXTURES.trace_multi_stroke);
  check('Common getRecordDetails() (hiragana-learn) output is byte-identical to direct KanaDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaHiragana), { direct, viaHiragana });
  check('Common getRecordDetails() (katakana-app) output is byte-identical to direct KanaDetail.getDetailRows() (same shared module)', JSON.stringify(direct) === JSON.stringify(viaKatakana), { direct, viaKatakana });

  const directCsv = KanaDetail.buildDetailCsvRows([HIRA_FIXTURES.trace_normal, HIRA_FIXTURES.quiz_wrong]);
  const viaCommonCsv = dash.getCsvActions('hiragana-learn')[0].buildRows([HIRA_FIXTURES.trace_normal, HIRA_FIXTURES.quiz_wrong]);
  check('Common CSV action output is byte-identical to direct KanaDetail.buildDetailCsvRows()', JSON.stringify(directCsv) === JSON.stringify(viaCommonCsv), { directCsv, viaCommonCsv });
}

// ────────────────────────────────────────────────────────────
section('9. rawIndex disambiguation — same-timestamp records (findRawRecord() bug fix regression)');
// ────────────────────────────────────────────────────────────
// hiragana-learn/katakana-appのentry.timeは分単位の文字列(秒を持たない、
// `toLocaleDateString + HH:MM`)のため、同じ分内に2回練習すると2つのraw
// recordが同一のtimestamp文字列を持つ(実機E2Eで実際に再現した事象)。
// learning-records.htmlのfindRawRecord()は旧実装だとtimestamp一致検索で
// 常に最初のrecordを返してしまい、2件目のCommon Detail/Rich Visualization
// が1件目のkana/traceSampleを誤って表示していた。この節はrawIndexが
// collectRecords()側で正しく・一意に割り当てられることを検証する
// (findRawRecord()自体はlearning-records.html内のDOM非依存の単純な配列
// indexアクセスのため、Node golden testの対象はrawIndex割り当ての正しさ、
// 実際のCommon Detail描画への反映はPlaywright実ブラウザE2Eで確認済み)。
{
  const sameTime = '2026/9/18 10:30'; // hiragana-learn.html's now() format, no seconds
  const collidingFixtures = [
    { time: sameTime, type: 'trace', data: { kana: 'く', tracingJudgmentLevel: 'easy', traceSample: fakeSample(1) }, schemaVersion: 1 },
    { time: sameTime, type: 'trace', data: { kana: 'あ', tracingJudgmentLevel: 'easy', traceSample: fakeSample(3) }, schemaVersion: 1 }
  ];
  const s = new FakeStorage();
  s.setItem('hiragana_log', JSON.stringify(collidingFixtures));
  const collected = dash.collectRecords({ storage: s, appIds: ['hiragana-learn'], maxPerApp: 50 });
  check('2 same-timestamp records both normalize (no dedup/collision drop)', collected.records.length === 2, collected.records.length);
  check('both records report the SAME normalized timestamp (confirms this scenario really collides)', collected.records[0].timestamp === collected.records[1].timestamp, collected.records.map(r => r.timestamp));
  const rawIndexes = collected.records.map(r => r.rawIndex).sort();
  check('the 2 records get 2 DISTINCT rawIndex values (0 and 1)', JSON.stringify(rawIndexes) === JSON.stringify([0, 1]), rawIndexes);

  // Simulate findRawRecord()'s fixed lookup path directly (index-based, not
  // timestamp-based) to confirm each normalized record resolves back to
  // its OWN distinct raw record, not always the first one.
  const rawRecords = collidingFixtures;
  const resolved = collected.records.map(r => rawRecords[r.rawIndex]);
  const resolvedKana = resolved.map(r => r.data.kana);
  check('index-based lookup resolves each record to its own distinct raw entry (く and あ, not both く)', JSON.stringify(resolvedKana.sort()) === JSON.stringify(['あ', 'く']), resolvedKana);
}
{
  // maxPerApp slicing must not corrupt rawIndex: with more raw records than
  // maxPerApp, the returned rawIndex must still point at the correct
  // position in the FULL (unsliced) rawRecords array, not the sliced view.
  const many = [];
  for (let i = 0; i < 5; i++) many.push({ time: `2026-09-18T0${i}:00:00.000Z`, type: 'quiz', data: { kana: String(i), answer: String(i), correct: true, correct_ans: String(i) }, schemaVersion: 1 });
  const s2 = new FakeStorage();
  s2.setItem('hiragana_log', JSON.stringify(many));
  const collected2 = dash.collectRecords({ storage: s2, appIds: ['hiragana-learn'], maxPerApp: 2 });
  check('maxPerApp=2 returns only the last 2 records', collected2.records.length === 2, collected2.records.length);
  const idxs = collected2.records.map(r => r.rawIndex).sort();
  check('rawIndex still points into the FULL unsliced array (indexes 3,4, not 0,1)', JSON.stringify(idxs) === JSON.stringify([3, 4]), idxs);
  const resolvedFull = collected2.records.map(r => many[r.rawIndex].data.kana).sort();
  check('resolving via rawIndex against the full array gives the correct last-2 entries', JSON.stringify(resolvedFull) === JSON.stringify(['3', '4']), resolvedFull);
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
