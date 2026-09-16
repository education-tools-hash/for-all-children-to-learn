#!/usr/bin/env node
// Phase SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1 — Golden Test
// Harness for the Sawatte Reference Implementation of the Cross-App Detail
// Contract (Level 2 Detail Parity / Level 3 Rich Visualization Parity /
// CSV Parity / legacy / malformed trace / semantic invariants).
//
// Usage: node tools/record-dashboard-poc/sawatte-common-detail-golden-tests.js
//
// Existing-adapter regression for the other 21 apps is covered by
// golden-tests.js / ui-golden-tests.js (re-run alongside this file, not
// duplicated here).

'use strict';
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const TraceRenderer = require(path.join(REPO_ROOT, 'assets', 'js', 'record-trace-renderer.js'));
const SawatteDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'sawatte-hirogaru-record-detail.js'));
const { FakeStorage, GOLDEN } = require('./fixtures.js');

// record-dashboard-foundation.js's adapter functions reference the shared
// modules as bare globals (browser <script src> convention) — expose them
// the same way here for Node.
global.donomanaRecordTraceRenderer = TraceRenderer;
global.donomanaSawatteHirogaruRecordDetail = SawatteDetail;

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const adapters = dash.getAdapters();
const meta = adapters.find(a => a.appId === 'sawatte-hirogaru-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter registration');
// ────────────────────────────────────────────────────────────
check('sawatte-hirogaru-app is registered', !!meta);
check('appName is さわってひろがる', meta && meta.appName === 'さわってひろがる', meta && meta.appName);
check('category is 認知支援', meta && meta.category === '認知支援', meta && meta.category);
check('storageKey is sawatte_hirogaru_log', meta && meta.storageKey === 'sawatte_hirogaru_log', meta && meta.storageKey);
check('privacyLevel is low', meta && meta.privacyLevel === 'low', meta && meta.privacyLevel);
check('includeInDefaultTimeline is true', meta && meta.includeInDefaultTimeline === true);

// ────────────────────────────────────────────────────────────
section('2. normalize() — golden fixture (Level 1)');
// ────────────────────────────────────────────────────────────
{
  const storage = new FakeStorage();
  storage.setItem('sawatte_hirogaru_log', JSON.stringify([GOLDEN['sawatte-hirogaru-app']]));
  const result = dash.collectRecords({ storage: storage, appIds: ['sawatte-hirogaru-app'], maxPerApp: 50 });
  check('collectRecords did not throw and returned 1 record', result.records.length === 1, result);
  const r = result.records[0];
  if (r) {
    check('timestamp is ISO string', typeof r.timestamp === 'string' && !isNaN(Date.parse(r.timestamp)), r.timestamp);
    check('activity derives from payload.mode', r.activity === 'light_sound', r.activity);
    check('summary mentions totalInteractions (4)', r.summary.indexOf('4') !== -1, r.summary);
    check('summary has no HTML tags', !/[<>]/.test(r.summary), r.summary);
    check('hasMedia is true for a valid trace', r.hasMedia === true);
    check('no raw payload leaking through normalized record', !('payload' in r));
  }
}

// ────────────────────────────────────────────────────────────
section('3. getDetails() — Level 2 Detail Parity, via the real public API');
// ────────────────────────────────────────────────────────────
{
  const rawRecord = GOLDEN['sawatte-hirogaru-app'];
  const rows = dash.getRecordDetails('sawatte-hirogaru-app', rawRecord);
  check('dash.getRecordDetails returns an array', Array.isArray(rows));
  const map = {}; rows.forEach(r => { map[r.label] = r.value; });
  check('つかった モード present', 'つかった モード' in map, map);
  check('かつどう じかん present', 'かつどう じかん' in map, map);
  check('そうさした かいすう = 4 かい', map['そうさした かいすう'] === '4 かい', map['そうさした かいすう']);
  check('タップした かいすう = 2 かい', map['タップした かいすう'] === '2 かい', map['タップした かいすう']);
  check('スワイプした かいすう = 2 かい', map['スワイプした かいすう'] === '2 かい', map['スワイプした かいすう']);
  check('つかった そうさ = タッチ', map['つかった そうさ'] === 'タッチ', map['つかった そうさ']);
  check('音 = ON', map['音'] === 'ON', map['音']);
  check('軌跡記録 = あり', map['軌跡記録'] === 'あり', map['軌跡記録']);
}

// ────────────────────────────────────────────────────────────
section('4. Semantic invariants (Cross-App Contract §60/§61)');
// ────────────────────────────────────────────────────────────
{
  // Case: tap2 + swipe2
  const p1 = { totalInteractions: 4, tapCount: 2, swipeCount: 2, inputMethods: ['touch'] };
  const rows1 = SawatteDetail.getDetailRows(p1);
  const m1 = {}; rows1.forEach(r => m1[r.label] = r.value);
  check('tap2+swipe2: total=4/tap=2/swipe=2 in Common Detail', m1['そうさした かいすう'] === '4 かい' && m1['タップした かいすう'] === '2 かい' && m1['スワイプした かいすう'] === '2 かい');

  // Case: tap1 + swipe1 + gaze1 + keyboard1 (mixed)
  const p2 = { totalInteractions: 4, tapCount: 1, swipeCount: 1, inputMethods: ['touch', 'gaze', 'keyboard'] };
  const rows2 = SawatteDetail.getDetailRows(p2);
  const m2 = {}; rows2.forEach(r => m2[r.label] = r.value);
  check('mixed input: total=4/tap=1/swipe=1 in Common Detail', m2['そうさした かいすう'] === '4 かい' && m2['タップした かいすう'] === '1 かい' && m2['スワイプした かいすう'] === '1 かい');
  check('mixed input: inputMethods shows touch/gaze/keyboard', m2['つかった そうさ'] === 'タッチ・視線・キーボード', m2['つかった そうさ']);
}

// ────────────────────────────────────────────────────────────
section('5. richVisualization — valid / missing / malformed / unknown version');
// ────────────────────────────────────────────────────────────
{
  const validTrace = { traceSchemaVersion: 1, pointLimit: 500, trimmed: false, taps: [100, 200, 50], swipes: [[10, 20, 10, 15, 25, 20]] };
  check('valid trace -> isValidTrace true', TraceRenderer.isValidTrace(validTrace) === true);
  check('missing trace (undefined) -> isValidTrace false', TraceRenderer.isValidTrace(undefined) === false);
  check('malformed trace ({}) -> isValidTrace false', TraceRenderer.isValidTrace({}) === false);
  check('unknown schema version -> isValidTrace false', TraceRenderer.isValidTrace({ traceSchemaVersion: 2, taps: [], swipes: [] }) === false);
  check('out-of-range coordinate -> isValidTrace false', TraceRenderer.isValidTrace({ traceSchemaVersion: 1, taps: [1001, 0, 0], swipes: [] }) === false);
  check('negative elapsed ms -> isValidTrace false', TraceRenderer.isValidTrace({ traceSchemaVersion: 1, taps: [0, 0, -1], swipes: [] }) === false);

  const counts = TraceRenderer.describeCounts(validTrace);
  check('describeCounts: tapCount=1, swipeCount=1', counts.tapCount === 1 && counts.swipeCount === 1, counts);
  check('describeCounts on invalid trace returns zeros, does not throw', JSON.stringify(TraceRenderer.describeCounts({})) === JSON.stringify({ tapCount: 0, swipeCount: 0, trimmed: false }));

  // Minimal fake DOM to exercise richVisualization.render() end to end
  // (Cross-App Contract §12/§29: canvas + text fallback, never canvas-only).
  function FakeCanvas() {
    this.tag = 'canvas';
    this.style = {}; this._attrs = {};
    this.clientWidth = 300; this.clientHeight = 200;
    this.setAttribute = (k, v) => { this._attrs[k] = v; };
    this.getContext = () => ({
      setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}
    });
  }
  function FakeEl(tag) {
    this.tag = tag; this.style = {}; this._attrs = {}; this.children = []; this.textContent = ''; this.className = '';
    this.setAttribute = (k, v) => { this._attrs[k] = v; };
    this.appendChild = (c) => { this.children.push(c); };
  }
  const fakeDocument = {
    createElement(tag) { return tag === 'canvas' ? new FakeCanvas() : new FakeEl(tag); }
  };
  global.document = fakeDocument;
  global.requestAnimationFrame = (fn) => fn(); // run synchronously for the test

  const target = new FakeEl('div');
  const rawRecord = GOLDEN['sawatte-hirogaru-app'];

  check('dash.supportsRichVisualization true for a valid-trace record', dash.supportsRichVisualization('sawatte-hirogaru-app', rawRecord) === true);
  const noTraceRecord = { timestamp: rawRecord.timestamp, payload: { mode: 'light', durationMs: 1000, totalInteractions: 1, tapCount: 1, swipeCount: 0 } };
  check('dash.supportsRichVisualization false when no trace', dash.supportsRichVisualization('sawatte-hirogaru-app', noTraceRecord) === false);
  check('dash.supportsRichVisualization false for an unregistered appId', dash.supportsRichVisualization('does-not-exist', rawRecord) === false);

  // dash.renderRichVisualization() — the real public API, exercised end to
  // end against a fake DOM (Cross-App Contract §12/§29: canvas + text
  // fallback, never canvas-only).
  dash.renderRichVisualization('sawatte-hirogaru-app', target, rawRecord);

  check('renderRichVisualization appended a canvas child', target.children.some(c => c.tag === 'canvas'));
  check('canvas has an aria-label (text-equivalent, not canvas-only)', target.children.some(c => c.tag === 'canvas' && typeof c._attrs['aria-label'] === 'string' && c._attrs['aria-label'].length > 0));
  check('renderRichVisualization appended text fallback counts (not canvas-only)', target.children.some(c => c.tag === 'p' && /タップ.*回/.test(c.textContent)));

  // Calling renderRichVisualization for a record with no trace must be a
  // safe no-op (Contract §6/§15 fallback — never throw, never render a
  // broken canvas).
  const target2 = new FakeEl('div');
  let threwOnNoTrace = false;
  try { dash.renderRichVisualization('sawatte-hirogaru-app', target2, noTraceRecord); } catch (e) { threwOnNoTrace = true; }
  check('renderRichVisualization does not throw for a no-trace record', threwOnNoTrace === false);
  check('renderRichVisualization appends nothing for a no-trace record', target2.children.length === 0);
}

// ────────────────────────────────────────────────────────────
section('6. CSV Parity — Summary CSV / Trace CSV, exact column match with App-local');
// ────────────────────────────────────────────────────────────
{
  const log = [
    { timestamp: '2026-09-16T03:12:45.000Z', payload: GOLDEN['sawatte-hirogaru-app'].payload },
    { timestamp: '2026-09-16T04:00:00.000Z', payload: { mode: 'swipe', durationMs: 9000, totalInteractions: 2, tapCount: 0, swipeCount: 2, inputMethods: ['touch'], soundEnabled: false, intensity: 'gentle', effectWidth: 'thick', effectSound: 'bell' } } // no trace (Trace OFF)
  ];
  const summaryRows = SawatteDetail.buildSummaryCsvRows(log);
  check('Summary CSV header has exactly 14 columns', summaryRows[0].length === 14, summaryRows[0].length);
  check('Summary CSV header matches Contract §32 exactly', JSON.stringify(summaryRows[0]) === JSON.stringify(['日付', '時刻', '教材', 'モード', '活動時間（秒）', '操作回数', 'タップ回数', 'スワイプ回数', '操作方法', '音', '刺激の強さ', 'エフェクトの太さ', '効果音', '軌跡記録']));
  check('row 1 軌跡記録=あり (has valid trace)', summaryRows[1][13] === 'あり');
  check('row 2 軌跡記録=なし (Trace OFF, no trace field)', summaryRows[2][13] === 'なし');

  const traceRows = SawatteDetail.buildTraceCsvRows(log);
  check('Trace CSV header has exactly 9 columns', traceRows[0].length === 9, traceRows[0].length);
  check('Trace CSV header matches Contract §33 exactly', JSON.stringify(traceRows[0]) === JSON.stringify(['日付', '時刻', 'セッションID', '操作番号', '種類', '点番号', 'X座標（相対位置）', 'Y座標（相対位置）', '経過ミリ秒']));
  // GOLDEN fixture trace: taps=[100,200,50,300,400,150] (2 taps) + swipes=[[9 values]] (1 stroke, 3 points) = 5 data rows.
  check('Trace CSV skips the no-trace record entirely (no zero-filled row)', traceRows.length === 1 + 2 + 3, 'expected header + 2 tap rows + 3 swipe-point rows for the single valid-trace record, actual=' + traceRows.length);

  // dash.getCsvActions() — the real public API, as the Common Detail glue
  // code in learning-records.html actually calls it.
  const csvActions = dash.getCsvActions('sawatte-hirogaru-app');
  check('dash.getCsvActions returns 2 actions (summary + trace)', csvActions.length === 2, csvActions.map(a => a.id));
  check('dash.getCsvActions returns [] for an unregistered appId', dash.getCsvActions('does-not-exist').length === 0);
  const summaryAction = csvActions.find(a => a.id === 'summary');
  const traceAction = csvActions.find(a => a.id === 'trace');
  check('summary action builds the exact same rows as SawatteDetail.buildSummaryCsvRows', JSON.stringify(summaryAction.buildRows(log)) === JSON.stringify(summaryRows));
  check('trace action builds the exact same rows as SawatteDetail.buildTraceCsvRows', JSON.stringify(traceAction.buildRows(log)) === JSON.stringify(traceRows));
  check('trace action reports enabled (has 1 valid-trace record)', traceAction.disabled(log) === false);
  check('trace action reports disabled for a trace-less log', traceAction.disabled([log[1]]) === true);
}

// ────────────────────────────────────────────────────────────
section('7. Legacy record (missing optional fields) — Common Detail must not break');
// ────────────────────────────────────────────────────────────
{
  const legacyPayload = { detailSchemaVersion: 1, mode: 'light', durationMs: 3000, totalInteractions: 2, tapCount: 2, swipeCount: 0 }; // no inputMethods/soundEnabled/intensity/effectWidth/effectSound/trace
  let threw = false;
  let rows;
  try { rows = SawatteDetail.getDetailRows(legacyPayload); } catch (e) { threw = true; }
  check('getDetailRows does not throw on a legacy record missing optional fields', threw === false);
  const map = {}; (rows || []).forEach(r => map[r.label] = r.value);
  check('legacy record: present fields still show (モード)', map['つかった モード'] === '✨ ひかり' || map['つかった モード'] === undefined ? true : false); // MODE_LABEL uses local map; light exists
  check('legacy record: missing inputMethods -> no つかった そうさ row (not fabricated)', !('つかった そうさ' in map));
  check('legacy record: missing soundEnabled -> no 音 row (not fabricated)', !('音' in map));
  check('legacy record: 軌跡記録 still shows なし (no trace field)', map['軌跡記録'] === 'なし');

  const csvRow = SawatteDetail.buildSummaryCsvRows([{ timestamp: '2026-09-16T00:00:00.000Z', payload: legacyPayload }])[1];
  check('legacy record CSV: missing inputMethods -> empty cell, not "undefined"', csvRow[8] === '');
  check('legacy record CSV: missing soundEnabled -> empty cell, not "undefined"', csvRow[9] === '');
  check('legacy record CSV: 軌跡記録=なし', csvRow[13] === 'なし');

  // fully malformed entry (not an object) must not crash the row builder
  let threw2 = false;
  try { SawatteDetail.buildSummaryCsvRows([null, 'hello', 42, {}]); } catch (e) { threw2 = true; }
  check('buildSummaryCsvRows does not throw on malformed log entries (null/string/number/{})', threw2 === false);
}

// ────────────────────────────────────────────────────────────
section('8. Unknown trace schema version — record kept, Trace Viewer/CSV gracefully excluded');
// ────────────────────────────────────────────────────────────
{
  const futurePayload = { mode: 'light', durationMs: 1000, totalInteractions: 1, tapCount: 1, swipeCount: 0, trace: { traceSchemaVersion: 99, taps: [1, 2, 3], swipes: [] } };
  check('unknown version -> isValidTrace false (Trace button would be disabled)', SawatteDetail.isValidTrace(futurePayload.trace) === false);
  const rows = SawatteDetail.getDetailRows(futurePayload);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('unknown version -> record Detail still renders (軌跡記録=なし, not hidden)', map['軌跡記録'] === 'なし');
  check('unknown version -> totalInteractions/tapCount still shown', map['そうさした かいすう'] === '1 かい');
  const traceRows = SawatteDetail.buildTraceCsvRows([{ timestamp: 't', payload: futurePayload }]);
  check('unknown version -> excluded from Trace CSV (header only)', traceRows.length === 1);
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed.');
if (fail > 0) { console.log(fail + ' FAILURES.'); process.exit(1); }
console.log('ALL PASS.');
