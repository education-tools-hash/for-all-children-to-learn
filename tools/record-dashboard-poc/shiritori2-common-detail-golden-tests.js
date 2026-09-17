#!/usr/bin/env node
// Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1 — Golden Test Harness
// for shiritori2's Level 2 Detail Parity (question-count mode + outcome,
// the only two fields not already surfaced via the existing generic
// metrics passthrough) and Common CSV Parity.
//
// Usage: node tools/record-dashboard-poc/shiritori2-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps is covered by
// golden-tests.js / ui-golden-tests.js / the other per-app suites
// (re-run alongside this file, not duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const Shiritori2Detail = require(path.join(REPO_ROOT, 'assets', 'js', 'shiritori2-record-detail.js'));
global.donomanaShiritori2RecordDetail = Shiritori2Detail;
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const ui = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-ui.js'));
const { FakeStorage } = require('./fixtures.js');

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'shiritori2');

// ────────────────────────────────────────────────────────────
section('1. Adapter registration (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('shiritori2 still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'shiritori2' && meta.appName === 'しりとりあそび' && meta.category === '学習アプリ' && meta.storageKey === 'shiritori2_log');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — completed/trap outcomes, legacy, malformed');
// ────────────────────────────────────────────────────────────
const FIXTURES = {
  completed_10: { timestamp: '2026-09-18T03:00:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 10, total: 10, correct: 9, score: 90, maxStreak: 7, chainLength: 12, outcome: 'completed', durationSec: 45.0 } },
  trap_5: { timestamp: '2026-09-18T03:05:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 5, total: 3, correct: 3, score: 30, maxStreak: 3, chainLength: 3, outcome: 'trap', durationSec: 12.5 } },
  zero_streak: { timestamp: '2026-09-18T03:10:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 10, total: 10, correct: 0, score: 0, maxStreak: 0, chainLength: 0, outcome: 'trap', durationSec: 5.0 } },
  legacy_no_schema_version: { timestamp: '2026-09-18T03:15:00.000Z', activity: 'quiz', inputMethod: null, payload: { mode: 5, total: 5, correct: 5, outcome: 'completed' } }, // no score/maxStreak/chainLength/durationSec/schemaVersion
  missing_outcome: { timestamp: '2026-09-18T03:20:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 10, total: 4, correct: 4, score: 40 } }, // outcome field missing entirely
  unknown_outcome: { timestamp: '2026-09-18T03:25:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 10, total: 4, correct: 2, outcome: 'somethingnew' } },
  mode_as_string_legacy_like: { timestamp: '2026-09-18T03:30:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: '10', total: 4, correct: 4, outcome: 'completed' } }, // mode is a string, not the expected number
  malformed_payload_array: { timestamp: '2026-09-18T03:35:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: [1, 2, 3] },
  malformed_payload_missing: { timestamp: '2026-09-18T03:40:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1 } // no payload field at all
};

const storage = new FakeStorage();
storage.setItem('shiritori2_log', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['shiritori2'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. getDetails() via the real public API — Level 2 (mode + outcome only)');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('shiritori2', fixture); }
{
  const rows = detailsFor(FIXTURES.completed_10);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('completed_10: もんすうモード = 10もん', map['もんすうモード'] === '10もん', map);
  check('completed_10: けっか = クリア', map['けっか'] === 'クリア', map);
  check('completed_10: no スコア/最大連続正解/つながった数 duplicate rows (already covered by generic metrics)', !('スコア' in map) && !('最大連続正解' in map) && !('つながった数' in map), map);
}
{
  const rows = detailsFor(FIXTURES.trap_5);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('trap_5: もんすうモード = 5もん', map['もんすうモード'] === '5もん', map);
  check('trap_5: けっか = ん でおわった', map['けっか'] === 'ん でおわった', map);
}
{
  const rows = detailsFor(FIXTURES.missing_outcome);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('missing_outcome: けっか row absent (not fabricated)', !('けっか' in map), map);
  check('missing_outcome: もんすうモード still shows correctly', map['もんすうモード'] === '10もん', map);
}
{
  const rows = detailsFor(FIXTURES.unknown_outcome);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('unknown_outcome: unrecognized outcome -> row absent, no crash, no raw code leaked', !('けっか' in map), map);
}
{
  const rows = detailsFor(FIXTURES.mode_as_string_legacy_like);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('mode_as_string_legacy_like: mode is a string not a number -> もんすうモード row absent (strict typeof check, not fabricated via coercion)', !('もんすうモード' in map), map);
  check('mode_as_string_legacy_like: けっか still shows correctly', map['けっか'] === 'クリア', map);
}
{
  const rows = detailsFor(FIXTURES.legacy_no_schema_version);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('legacy_no_schema_version: still resolves correctly despite missing schemaVersion/score/maxStreak/chainLength/durationSec', map['もんすうモード'] === '5もん' && map['けっか'] === 'クリア', map);
}
check('getRecordDetails never throws on malformed payload (array/missing)', (function () {
  try {
    dash.getRecordDetails('shiritori2', FIXTURES.malformed_payload_array);
    dash.getRecordDetails('shiritori2', FIXTURES.malformed_payload_missing);
    dash.getRecordDetails('shiritori2', null);
    dash.getRecordDetails('shiritori2', undefined);
    return true;
  } catch (e) { return false; }
})());

// ────────────────────────────────────────────────────────────
section('4. CSV Parity — getCsvActions(), exact 9-column shape (App-local CSV header)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('shiritori2');
  check('getCsvActions returns exactly 1 action', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 9 columns', rows[0].length === 9, rows[0]);
  check('CSV header matches App-local header exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', 'もんすうモード', 'せいかい', 'もんだいすう', 'スコア', 'さいだいれんぞく', 'けっか', 'かかった時間(びょう)']), rows[0]);
  check('CSV has 1 data row per fixture', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);

  const completedIdx = 1 + Object.keys(FIXTURES).indexOf('completed_10');
  check('completed_10 CSV row: 10,9,10,90,7,クリア,45', JSON.stringify(rows[completedIdx].slice(2)) === JSON.stringify([10, 9, 10, 90, 7, 'クリア', 45]), rows[completedIdx]);
  const trapIdx = 1 + Object.keys(FIXTURES).indexOf('trap_5');
  check('trap_5 CSV row: けっか = んでおわった (no space, matches App-local CSV exactly, distinct from display label)', rows[trapIdx][7] === 'んでおわった', rows[trapIdx]);

  const zeroStreakIdx = 1 + Object.keys(FIXTURES).indexOf('zero_streak');
  check('zero_streak CSV row: correct=0, score=0, maxStreak=0, chainLength=0 all preserved (not treated as missing)', rows[zeroStreakIdx][3] === 0 && rows[zeroStreakIdx][5] === 0 && rows[zeroStreakIdx][6] === 0, rows[zeroStreakIdx]);

  const missingOutcomeIdx = 1 + Object.keys(FIXTURES).indexOf('missing_outcome');
  check('missing_outcome CSV row: けっか column blank, not "undefined"', rows[missingOutcomeIdx][7] === '', rows[missingOutcomeIdx]);

  const stringModeIdx = 1 + Object.keys(FIXTURES).indexOf('mode_as_string_legacy_like');
  check('mode_as_string_legacy_like CSV row: もんすうモード column blank (strict typeof number check)', rows[stringModeIdx][2] === '', rows[stringModeIdx]);

  const malformedArrIdx = 1 + Object.keys(FIXTURES).indexOf('malformed_payload_array');
  check('malformed_payload_array CSV row: all payload columns blank, no crash', rows[malformedArrIdx].slice(2).every(v => v === ''), rows[malformedArrIdx]);
  const malformedMissingIdx = 1 + Object.keys(FIXTURES).indexOf('malformed_payload_missing');
  check('malformed_payload_missing CSV row: all payload columns blank, no crash', rows[malformedMissingIdx].slice(2).every(v => v === ''), rows[malformedMissingIdx]);

  check('action does not throw on malformed log entries (null/string/number/array/{})', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, [], {}]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('5. App-local / Common semantic parity (same record, same values, same function)');
// ────────────────────────────────────────────────────────────
{
  const direct = Shiritori2Detail.getDetailRows(FIXTURES.completed_10);
  const viaCommon = dash.getRecordDetails('shiritori2', FIXTURES.completed_10);
  check('Common getRecordDetails() output is byte-identical to direct Shiritori2Detail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });

  const directCsv = Shiritori2Detail.buildDetailCsvRows([FIXTURES.completed_10, FIXTURES.trap_5]);
  const viaCommonCsv = dash.getCsvActions('shiritori2')[0].buildRows([FIXTURES.completed_10, FIXTURES.trap_5]);
  check('Common CSV action output is byte-identical to direct Shiritori2Detail.buildDetailCsvRows()', JSON.stringify(directCsv) === JSON.stringify(viaCommonCsv), { directCsv, viaCommonCsv });
}

// ────────────────────────────────────────────────────────────
section('6. Semantic Summary Gate — Common list/badge/summary activity label (User-requested re-verification)');
// ────────────────────────────────────────────────────────────
// 旧実装は`typeof p.mode==='string'`を前提としていたが、shiritori2の
// payload.modeは常にnumber(もんすう設定値)のため、この条件は常にfalseと
// なり、activityは常に'unknown'固定だった。ACTIVITY_LABELS.unknown='活動'
// (汎用語)が一覧badge/Detail/CSVのどこにも問題数を反映せず表示されていた
// (実機Playwrightで再現確認済み)。本節はUI.activityLabel()を直接呼び、
// 一覧badge/Detail/CSVが共通で参照する実際の表示文言を検証する。
{
  function recordFor(fixture) {
    const s = new FakeStorage();
    s.setItem('shiritori2_log', JSON.stringify([fixture]));
    return dash.collectRecords({ storage: s, appIds: ['shiritori2'] }).records[0];
  }
  const mode10 = recordFor(FIXTURES.completed_10);
  const mode5 = recordFor(FIXTURES.trap_5);
  const mode20 = recordFor(Object.assign({}, FIXTURES.completed_10, { payload: Object.assign({}, FIXTURES.completed_10.payload, { mode: 20 }) }));
  const mode30 = recordFor(Object.assign({}, FIXTURES.completed_10, { payload: Object.assign({}, FIXTURES.completed_10.payload, { mode: 30 }) }));

  check('mode=10: Common activity label = 10問モード (this is the exact text shown in the list badge, Detail modal, and CSV)', ui.activityLabel(mode10.activity) === '10問モード', { activity: mode10.activity, label: ui.activityLabel(mode10.activity) });
  check('mode=5: Common activity label = 5問モード', ui.activityLabel(mode5.activity) === '5問モード', { activity: mode5.activity, label: ui.activityLabel(mode5.activity) });
  check('mode=20: Common activity label = 20問モード (not hardcoded to only 10/30, regex-based fallback generalizes)', ui.activityLabel(mode20.activity) === '20問モード', { activity: mode20.activity, label: ui.activityLabel(mode20.activity) });
  check('mode=30: Common activity label = 30問モード', ui.activityLabel(mode30.activity) === '30問モード', { activity: mode30.activity, label: ui.activityLabel(mode30.activity) });

  check('mode=10/20/30/5 never resolve to the generic "活動" placeholder', [mode10, mode20, mode30, mode5].every(r => ui.activityLabel(r.activity) !== '活動'));
  check('mode=10/20/30/5 never resolve to literal "unknown"', [mode10, mode20, mode30, mode5].every(r => ui.activityLabel(r.activity) !== 'unknown'));
  check('mode=10/20/30/5 never resolve to "不明"', [mode10, mode20, mode30, mode5].every(r => ui.activityLabel(r.activity) !== '不明'));
  check('mode=10/20/30/5 never resolve to an empty string', [mode10, mode20, mode30, mode5].every(r => ui.activityLabel(r.activity) !== ''));

  // malformed/unknown mode must still fall back safely.
  const malformedRecord = recordFor(FIXTURES.malformed_payload_array);
  const missingRecord = recordFor(FIXTURES.malformed_payload_missing);
  const stringModeRecord = recordFor(FIXTURES.mode_as_string_legacy_like);
  check('malformed payload (array) -> activity label falls back safely, no crash', typeof ui.activityLabel(malformedRecord.activity) === 'string');
  check('missing payload -> activity label falls back safely, no crash', typeof ui.activityLabel(missingRecord.activity) === 'string');
  check("mode as string ('10', not number 10) -> does not fabricate a shiritori2-Nmon label, falls back safely", ui.activityLabel(stringModeRecord.activity) !== '10問モード');
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
