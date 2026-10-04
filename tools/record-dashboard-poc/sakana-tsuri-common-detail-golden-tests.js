#!/usr/bin/env node
// Phase FISHING-APP-TIMING-SPEED-AND-LEARNING-RECORD-1 — Golden Test Harness for
// sakana-tsuri's Learning Record Foundation registration (Level 1 normalize /
// Level 2 Detail Parity / CSV Parity / legacy-record compatibility).
//
// Usage: node tools/record-dashboard-poc/sakana-tsuri-common-detail-golden-tests.js
//
// sakana-tsuri is, like sawatte-hirogaru-app, one of the adapters that uses
// donomanaRecordCreate()'s canonical Core Schema directly ({timestamp, appId,
// activity, inputMethod, schemaVersion, payload}) rather than the historical
// flat/short-key shape most other adapters read (confirmed against
// saveTrialRecord() in sakana-tsuri.html itself). Fixtures below are built in
// that exact shape, not an invented one.
//
// Existing-adapter regression for the other 21+1 apps is covered by
// golden-tests.js / ui-golden-tests.js / sawatte-common-detail-golden-tests.js
// / directions-common-detail-golden-tests.js (re-run alongside this file, not
// duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const SakanaDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'sakana-tsuri-record-detail.js'));
const { FakeStorage } = require('./fixtures.js');

global.donomanaSakanaTsuriRecordDetail = SakanaDetail;

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'sakana-tsuri');

// ────────────────────────────────────────────────────────────
section('1. Adapter registration');
// ────────────────────────────────────────────────────────────
check('sakana-tsuri is registered', !!meta);
check('appName is さかなつり', meta && meta.appName === 'さかなつり', meta && meta.appName);
check('category is 自立活動', meta && meta.category === '自立活動', meta && meta.category);
check('storageKey is sakana-tsuri_records (NOT the settings key)', meta && meta.storageKey === 'sakana-tsuri_records', meta && meta.storageKey);
check('privacyLevel is low', meta && meta.privacyLevel === 'low', meta && meta.privacyLevel);
check('includeInDefaultTimeline is true', meta && meta.includeInDefaultTimeline === true);

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures, incl. a pre-Phase legacy record');
// ────────────────────────────────────────────────────────────
// donomanaRecordCreate()'s own shape — saveTrialRecord() in sakana-tsuri.html:
// timestamp/appId/activity/inputMethod/schemaVersion/payload.
const FIXTURES = {
  timing_catch: {
    timestamp: '2026-10-03T01:00:00.000Z', appId: 'sakana-tsuri', activity: 'fishing_trial',
    inputMethod: 'click', schemaVersion: 1,
    payload: {
      sessionId: 's1', trialNumber: 3, mode: 'free', difficulty: null,
      reelMethod: 'timing', reelGainPreset: 'medium', reelSpeedPreset: 'standard',
      timingSpeed: 'fast', targetColor: null, targetCount: null,
      caughtColor: 'red-white', caughtSize: 'large', result: null, durationMs: 5400
    }
  },
  hold_catch: {
    timestamp: '2026-10-03T01:05:00.000Z', appId: 'sakana-tsuri', activity: 'fishing_trial',
    inputMethod: 'touch', schemaVersion: 1,
    payload: {
      sessionId: 's1', trialNumber: 4, mode: 'free', difficulty: null,
      reelMethod: 'hold', reelGainPreset: 'small', reelSpeedPreset: 'slow',
      timingSpeed: 'normal', targetColor: null, targetCount: null,
      caughtColor: 'orange', caughtSize: 'small', result: null, durationMs: 8200
    }
  },
  // Phase FISHING-APP-VARIETY-AND-SIZE-EFFORT-1 record — predates this Phase's
  // timingSpeed field entirely (key absent, not merely null).
  pre_phase_legacy_no_timing_speed: {
    timestamp: '2026-10-02T12:00:00.000Z', appId: 'sakana-tsuri', activity: 'fishing_trial',
    inputMethod: 'keyboard', schemaVersion: 1,
    payload: {
      sessionId: 's0', trialNumber: 1, mode: 'free', difficulty: null,
      reelMethod: 'arc', reelGainPreset: 'medium', reelSpeedPreset: 'standard',
      targetColor: null, targetCount: null,
      caughtColor: 'spotted', caughtSize: 'medium', result: null, durationMs: 3100
    }
  },
  // Pre-FISHING-APP-VARIETY-AND-SIZE-EFFORT-1 record — caughtSize was still the
  // old bare 1-3 integer, caughtColor still red/blue/yellow vocabulary.
  very_old_legacy: {
    timestamp: '2026-09-01T12:00:00.000Z', appId: 'sakana-tsuri', activity: 'fishing_trial',
    inputMethod: 'touch', schemaVersion: 1,
    payload: {
      sessionId: 's-1', trialNumber: 1, mode: 'free', difficulty: null,
      reelMethod: 'hold', reelGainPreset: 'medium', reelSpeedPreset: 'standard',
      targetColor: null, targetCount: null,
      caughtColor: 'blue', caughtSize: 2, result: null, durationMs: 4000
    }
  }
};

const storage = new FakeStorage();
storage.setItem('sakana-tsuri_records', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['sakana-tsuri'], maxPerApp: 50 });
check('all fixtures normalize without crashing, incl. legacy ones', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. normalize() — activity/summary derive from real saved fields only');
// ────────────────────────────────────────────────────────────
{
  const r = collected.records.find(x => x.timestamp === '2026-10-03T01:00:00.000Z');
  check('activity derives from payload.reelMethod (timing)', r && r.activity === 'timing', r && r.activity);
  check('summary mentions size+type ("おおきい"+"赤白の魚")', r && r.summary.indexOf('おおきい') !== -1 && r.summary.indexOf('赤白の魚') !== -1, r && r.summary);
  check('summary has no HTML tags', r && !/[<>]/.test(r.summary));
  check('hasMedia is false (no image/trace data saved)', r && r.hasMedia === false);
  check('inputMethod passed through from the record, not the payload', r && r.inputMethod === 'click', r && r.inputMethod);
}
{
  const r = collected.records.find(x => x.timestamp === '2026-09-01T12:00:00.000Z');
  check('very old legacy record (bad caughtSize=2, caughtColor="blue") still normalizes to a safe fallback summary, never a crash or a fabricated label', r && typeof r.summary === 'string' && r.summary.length > 0 && !/[<>]/.test(r.summary), r && r.summary);
  check('unrecognized caughtColor("blue")/caughtSize(2) never silently rendered as a real type/size label in the summary', r && r.summary.indexOf('blue') === -1 && !/^\d/.test(r.summary));
}

// ────────────────────────────────────────────────────────────
section('4. getDetails() — Level 2 Detail Parity, via the real public API');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('sakana-tsuri', fixture); }

{
  const rows = detailsFor(FIXTURES.timing_catch);
  const labels = rows.map(r => r.label);
  check('timing_catch: 釣れた魚/大きさ/まきとり方法/まきとる量/まきとる速さ/うごく はやさ/所要時間 all present', ['釣れた魚', '大きさ', 'まきとり方法', 'まきとる量', 'まきとる速さ', 'うごく はやさ', '所要時間'].every(l => labels.includes(l)), labels);
  const speedRow = rows.find(r => r.label === 'うごく はやさ');
  check('timing_catch: うごく はやさ is はやい (timingSpeed="fast")', speedRow && speedRow.value === 'はやい', speedRow);
}
{
  const rows = detailsFor(FIXTURES.hold_catch);
  const labels = rows.map(r => r.label);
  check('hold_catch (reelMethod=hold): うごく はやさ row is OMITTED (irrelevant to this method, even though timingSpeed has a saved value)', !labels.includes('うごく はやさ'), labels);
  const methodRow = rows.find(r => r.label === 'まきとり方法');
  check('hold_catch: まきとり方法 is 長押しでまく', methodRow && methodRow.value === '長押しでまく', methodRow);
}
{
  const rows = detailsFor(FIXTURES.pre_phase_legacy_no_timing_speed);
  const labels = rows.map(r => r.label);
  check('pre-Phase legacy record (no timingSpeed key at all, reelMethod=arc): detail screen does not break, うごく はやさ simply absent', !labels.includes('うごく はやさ') && labels.includes('釣れた魚'), labels);
}
{
  const rows = detailsFor(FIXTURES.very_old_legacy);
  const labels = rows.map(r => r.label);
  const fishRow = rows.find(r => r.label === '釣れた魚');
  const sizeRow = rows.find(r => r.label === '大きさ');
  check('very old legacy record: unrecognized caughtColor("blue") produces NO 釣れた魚 row (never guessed/fabricated)', !fishRow, fishRow);
  check('very old legacy record: unrecognized caughtSize(2, old integer) produces NO 大きさ row (never guessed/fabricated)', !sizeRow, sizeRow);
  check('very old legacy record: detail screen still renders other real fields without crashing', labels.includes('まきとり方法') && labels.includes('所要時間'), labels);
}
check('getRecordDetails never throws on null/undefined entry', (function () { try { dash.getRecordDetails('sakana-tsuri', null); dash.getRecordDetails('sakana-tsuri', undefined); return true; } catch (e) { return false; } })());

// ────────────────────────────────────────────────────────────
section('5. Rich Visualization — NOT APPLICABLE (sakana-tsuri saves no image/trace data)');
// ────────────────────────────────────────────────────────────
check('supportsRichVisualization is false for every fixture', Object.keys(FIXTURES).every(k => dash.supportsRichVisualization('sakana-tsuri', FIXTURES[k]) === false));

// ────────────────────────────────────────────────────────────
section('6. CSV Parity — getCsvActions()');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('sakana-tsuri');
  check('getCsvActions returns exactly 1 action', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 9 columns', rows[0].length === 9, rows[0]);
  check('CSV has 4 data rows (one per fixture, incl. both legacy ones)', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);
  const timingRow = rows[1];
  check('first data row: date/time split correctly (dot-separated, Excel-safe)', /^\d{4}\.\d{2}\.\d{2}$/.test(timingRow[0]) && /^\d{2}:\d{2}:\d{2}$/.test(timingRow[1]), timingRow);
  const holdRowCsv = rows[2];
  check('hold-method row: うごく はやさ column is blank (not the irrelevant saved value)', holdRowCsv[7] === '', holdRowCsv);
  check('action does not throw on malformed log entries (null/string/number)', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, []]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('7. App-local / Common semantic parity (same record, same values)');
// ────────────────────────────────────────────────────────────
{
  const direct = SakanaDetail.getDetailRows(FIXTURES.timing_catch);
  const viaCommon = dash.getRecordDetails('sakana-tsuri', FIXTURES.timing_catch);
  check('Common getRecordDetails() output is byte-identical to direct SakanaDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });
}

console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
