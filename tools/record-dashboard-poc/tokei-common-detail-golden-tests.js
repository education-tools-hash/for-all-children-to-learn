#!/usr/bin/env node
// Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1 — Golden Test Harness
// for tokei-app's Level 2 Detail Parity (difficulty + mode, the only two
// fields not already surfaced via the existing generic metrics passthrough)
// and Common CSV Parity.
//
// Usage: node tools/record-dashboard-poc/tokei-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps is covered by
// golden-tests.js / ui-golden-tests.js / the other per-app suites
// (re-run alongside this file, not duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const TokeiDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'tokei-record-detail.js'));
global.donomanaTokeiRecordDetail = TokeiDetail;
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const ui = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-ui.js'));
const { FakeStorage } = require('./fixtures.js');

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'tokei-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter registration (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('tokei-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'tokei-app' && meta.appName === 'とけい' && meta.category === '学習アプリ' && meta.storageKey === 'tokei_log');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — mode x difficulty combinations, legacy, malformed');
// ────────────────────────────────────────────────────────────
const FIXTURES = {
  read_easy: { timestamp: '2026-09-18T02:00:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'easy', mode: 'read', total: 10, correct: 8, retried: 1, avgTimeSec: 4.2, durationSec: 62.3 } },
  set_normal: { timestamp: '2026-09-18T02:05:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'normal', mode: 'set', total: 10, correct: 10, retried: 0, avgTimeSec: 3.1, durationSec: 40.0 } },
  both_hard: { timestamp: '2026-09-18T02:10:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'hard', mode: 'both', total: 10, correct: 6, retried: 4, avgTimeSec: 6.7, durationSec: 90.5 } },
  zero_correct: { timestamp: '2026-09-18T02:15:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'easy', mode: 'read', total: 10, correct: 0, retried: 10, avgTimeSec: 9.9, durationSec: 120.0 } },
  zero_retried: { timestamp: '2026-09-18T02:20:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'normal', mode: 'set', total: 5, correct: 5, retried: 0, avgTimeSec: 2.0, durationSec: 10.0 } },
  legacy_no_schema_version: { timestamp: '2026-09-18T02:25:00.000Z', activity: 'quiz', inputMethod: null, payload: { difficulty: 'easy', mode: 'read', total: 5, correct: 3 } }, // no retried/avgTimeSec/durationSec/schemaVersion
  missing_difficulty: { timestamp: '2026-09-18T02:30:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { mode: 'set', total: 5, correct: 5 } }, // difficulty field missing entirely
  unknown_mode_difficulty: { timestamp: '2026-09-18T02:35:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: { difficulty: 'nightmare', mode: 'speedrun', total: 5, correct: 2 } },
  malformed_payload_string: { timestamp: '2026-09-18T02:40:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1, payload: 'not-an-object' },
  malformed_payload_missing: { timestamp: '2026-09-18T02:45:00.000Z', activity: 'quiz', inputMethod: null, schemaVersion: 1 } // no payload field at all
};

const storage = new FakeStorage();
storage.setItem('tokei_log', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['tokei-app'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. getDetails() via the real public API — Level 2 (difficulty + mode only)');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('tokei-app', fixture); }
{
  const rows = detailsFor(FIXTURES.read_easy);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('read_easy: むずかしさ = やさしい', map['むずかしさ'] === 'やさしい', map);
  check('read_easy: もんだいのしゅるい = よむもんだい', map['もんだいのしゅるい'] === 'よむもんだい', map);
  check('read_easy: no 問題数/正解数 duplicate rows (already covered by generic metrics)', !('問題数' in map) && !('正解数' in map), map);
}
{
  const rows = detailsFor(FIXTURES.set_normal);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('set_normal: むずかしさ = ふつう', map['むずかしさ'] === 'ふつう', map);
  check('set_normal: もんだいのしゅるい = みつけるもんだい', map['もんだいのしゅるい'] === 'みつけるもんだい', map);
}
{
  const rows = detailsFor(FIXTURES.both_hard);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('both_hard: むずかしさ = むずかしい', map['むずかしさ'] === 'むずかしい', map);
  check('both_hard: もんだいのしゅるい = まぜまぜ (mode="both", correctly resolved via tokei\'s own dictionary, not janken\'s shared ACTIVITY_LABELS collision)', map['もんだいのしゅるい'] === 'まぜまぜ', map);
}
{
  const rows = detailsFor(FIXTURES.missing_difficulty);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('missing_difficulty: むずかしさ row absent (not fabricated)', !('むずかしさ' in map), map);
  check('missing_difficulty: もんだいのしゅるい still shows correctly', map['もんだいのしゅるい'] === 'みつけるもんだい', map);
}
{
  const rows = detailsFor(FIXTURES.unknown_mode_difficulty);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('unknown_mode_difficulty: unrecognized difficulty/mode -> rows absent, no crash, no raw code leaked', !('むずかしさ' in map) && !('もんだいのしゅるい' in map), map);
}
{
  const rows = detailsFor(FIXTURES.legacy_no_schema_version);
  const map = {}; rows.forEach(r => map[r.label] = r.value);
  check('legacy_no_schema_version: still resolves correctly despite missing schemaVersion/retried/avgTimeSec/durationSec', map['むずかしさ'] === 'やさしい' && map['もんだいのしゅるい'] === 'よむもんだい', map);
}
check('getRecordDetails never throws on malformed payload (string/missing)', (function () {
  try {
    dash.getRecordDetails('tokei-app', FIXTURES.malformed_payload_string);
    dash.getRecordDetails('tokei-app', FIXTURES.malformed_payload_missing);
    dash.getRecordDetails('tokei-app', null);
    dash.getRecordDetails('tokei-app', undefined);
    return true;
  } catch (e) { return false; }
})());

// ────────────────────────────────────────────────────────────
section('4. CSV Parity — getCsvActions(), exact 9-column shape (App-local CSV header)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('tokei-app');
  check('getCsvActions returns exactly 1 action', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 9 columns', rows[0].length === 9, rows[0]);
  check('CSV header matches App-local header exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', 'むずかしさ', 'もんだいのしゅるい', 'せいかい', 'もんだいすう', 'やりなおし', 'へいきんじかん(びょう)', 'かかった時間(びょう)']), rows[0]);
  check('CSV has 1 data row per fixture', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);

  const bothIdx = 1 + Object.keys(FIXTURES).indexOf('both_hard');
  check('both_hard CSV row: むずかしい,まぜまぜ,6,10,4,6.7,90.5', JSON.stringify(rows[bothIdx].slice(2)) === JSON.stringify(['むずかしい', 'まぜまぜ', 6, 10, 4, 6.7, 90.5]), rows[bothIdx]);

  const zeroCorrectIdx = 1 + Object.keys(FIXTURES).indexOf('zero_correct');
  check('zero_correct CSV row: correct=0 preserved (not treated as missing)', rows[zeroCorrectIdx][4] === 0, rows[zeroCorrectIdx]);
  const zeroRetriedIdx = 1 + Object.keys(FIXTURES).indexOf('zero_retried');
  check('zero_retried CSV row: retried=0 preserved (not treated as missing)', rows[zeroRetriedIdx][6] === 0, rows[zeroRetriedIdx]);

  const missingDiffIdx = 1 + Object.keys(FIXTURES).indexOf('missing_difficulty');
  check('missing_difficulty CSV row: むずかしさ column blank, not "undefined"', rows[missingDiffIdx][2] === '', rows[missingDiffIdx]);

  const malformedStrIdx = 1 + Object.keys(FIXTURES).indexOf('malformed_payload_string');
  check('malformed_payload_string CSV row: all payload columns blank, no crash', rows[malformedStrIdx].slice(2).every(v => v === ''), rows[malformedStrIdx]);
  const malformedMissingIdx = 1 + Object.keys(FIXTURES).indexOf('malformed_payload_missing');
  check('malformed_payload_missing CSV row: all payload columns blank, no crash', rows[malformedMissingIdx].slice(2).every(v => v === ''), rows[malformedMissingIdx]);

  check('action does not throw on malformed log entries (null/string/number/array/{})', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, [], {}]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('5. App-local / Common semantic parity (same record, same values, same function)');
// ────────────────────────────────────────────────────────────
{
  const direct = TokeiDetail.getDetailRows(FIXTURES.both_hard);
  const viaCommon = dash.getRecordDetails('tokei-app', FIXTURES.both_hard);
  check('Common getRecordDetails() output is byte-identical to direct TokeiDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });

  const directCsv = TokeiDetail.buildDetailCsvRows([FIXTURES.read_easy, FIXTURES.both_hard]);
  const viaCommonCsv = dash.getCsvActions('tokei-app')[0].buildRows([FIXTURES.read_easy, FIXTURES.both_hard]);
  check('Common CSV action output is byte-identical to direct TokeiDetail.buildDetailCsvRows()', JSON.stringify(directCsv) === JSON.stringify(viaCommonCsv), { directCsv, viaCommonCsv });
}

// ────────────────────────────────────────────────────────────
section('6. Semantic Summary Gate — Common list/badge/summary activity label (User-requested re-verification)');
// ────────────────────────────────────────────────────────────
// 旧実装は`activity`にp.modeの生値をそのまま渡していたため、Common一覧の
// activity badge / Detail modalの「活動」行 / CSVの「教材」列が全て同じ
// UI.activityLabel(record.activity)を参照する経路で、mode:'both'が
// janken-appの'both'('どちらもまぜる')と衝突し、'read'/'set'は
// UNMAPPED_FALLBACK('その他の活動')という無意味な表示になっていた
// (実機Playwrightで再現確認済み)。本節はUI.activityLabel()を直接呼び、
// 一覧badge/Detail/CSVが共通で参照する実際の表示文言を検証する。
{
  const readRecord = dash.collectRecords({ storage: (() => { const s = new FakeStorage(); s.setItem('tokei_log', JSON.stringify([FIXTURES.read_easy])); return s; })(), appIds: ['tokei-app'] }).records[0];
  const setRecord = dash.collectRecords({ storage: (() => { const s = new FakeStorage(); s.setItem('tokei_log', JSON.stringify([FIXTURES.set_normal])); return s; })(), appIds: ['tokei-app'] }).records[0];
  const bothRecord = dash.collectRecords({ storage: (() => { const s = new FakeStorage(); s.setItem('tokei_log', JSON.stringify([FIXTURES.both_hard])); return s; })(), appIds: ['tokei-app'] }).records[0];

  check("mode='read': Common activity label = よむもんだい (this is the exact text shown in the list badge, Detail modal, and CSV)", ui.activityLabel(readRecord.activity) === 'よむもんだい', { activity: readRecord.activity, label: ui.activityLabel(readRecord.activity) });
  check("mode='set': Common activity label = みつけるもんだい", ui.activityLabel(setRecord.activity) === 'みつけるもんだい', { activity: setRecord.activity, label: ui.activityLabel(setRecord.activity) });
  check("mode='both': Common activity label = まぜまぜ (tokei's own label, NOT janken's 'どちらもまぜる')", ui.activityLabel(bothRecord.activity) === 'まぜまぜ', { activity: bothRecord.activity, label: ui.activityLabel(bothRecord.activity) });
  check("mode='both': activity value itself is namespaced (not the bare 'both' that would collide with janken-app)", bothRecord.activity === 'tokei-both', bothRecord.activity);

  check('read/set/both never resolve to UNMAPPED_FALLBACK ("その他の活動")', [readRecord, setRecord, bothRecord].every(r => ui.activityLabel(r.activity) !== 'その他の活動'));
  check('read/set/both never resolve to the generic "活動" placeholder', [readRecord, setRecord, bothRecord].every(r => ui.activityLabel(r.activity) !== '活動'));

  // janken-app regression: its own 'both' key must be completely unaffected
  // (tokei's namespaced 'tokei-both' is a distinct key, no overwrite).
  const jankenBoth = dash.collectRecords({
    storage: (() => { const s = new FakeStorage(); s.setItem('janken_log', JSON.stringify([{ timestamp: '2026-09-18T00:00:00.000Z', inputMethod: null, schemaVersion: 1, payload: { mode: 'both', total: 5, correct: 4, mistakes: [] } }])); return s; })(),
    appIds: ['janken-app']
  }).records[0];
  check("janken-app mode='both' still resolves to its own どちらもまぜる (no regression)", jankenBoth.activity === 'both' && ui.activityLabel(jankenBoth.activity) === 'どちらもまぜる', { activity: jankenBoth.activity, label: ui.activityLabel(jankenBoth.activity) });

  // unknown/legacy mode values must still fall back safely (not fabricate a
  // tokei-specific label for something that was never one of the 3 known
  // modes).
  const unknownModeRecord = dash.collectRecords({ storage: (() => { const s = new FakeStorage(); s.setItem('tokei_log', JSON.stringify([FIXTURES.unknown_mode_difficulty])); return s; })(), appIds: ['tokei-app'] }).records[0];
  check('unrecognized mode value falls back to UNMAPPED_FALLBACK safely, no crash, no fabricated label', ui.activityLabel(unknownModeRecord.activity) === 'その他の活動', { activity: unknownModeRecord.activity, label: ui.activityLabel(unknownModeRecord.activity) });
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
