#!/usr/bin/env node
// Phase LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1 — Golden Test
// Harness for katachi-awase-app's Level 2 Detail Parity (Batch B,
// docs/records/learning-record-detail-parity-audit-all-v1_0.md).
//
// Usage: node tools/record-dashboard-poc/katachi-awase-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps is covered by golden-tests.js /
// ui-golden-tests.js / sawatte-common-detail-golden-tests.js /
// sst-common-detail-golden-tests.js / directions-common-detail-golden-tests.js /
// kurabeyou-common-detail-golden-tests.js (re-run alongside this file, not
// duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const KatachiDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'katachi-awase-record-detail.js'));
const { FakeStorage } = require('./fixtures.js');

global.donomanaKatachiAwaseRecordDetail = KatachiDetail;

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'katachi-awase-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter unchanged (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('katachi-awase-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'katachi-awase-app' && meta.appName === 'かたちをあわせよう' && meta.category === '学習アプリ' && meta.storageKey === 'katachi_log');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — shape/size/puzzle concepts');
// ────────────────────────────────────────────────────────────
// katachi-awase-app.html実測shapeをそのまま使う(架空schema禁止)。
const FIXTURES = {
  shape_normal: { time: '2026-09-18T02:00:00.000Z', level: 1, concept: 'shape', questionIndex: 1, questionTotal: 3, shape: 'circle', expected: 'circle', selected: 'circle', correct: true, mistakes: 0, mistakeSelections: [], responseTimeMs: 800, inputMethod: 'touch', schemaVersion: 1 },
  shape_with_mistake: { time: '2026-09-18T02:05:00.000Z', level: 2, concept: 'shape', questionIndex: 2, questionTotal: 3, shape: 'triangle', expected: 'triangle', selected: 'triangle', correct: true, mistakes: 1, mistakeSelections: ['square'], responseTimeMs: 2500, inputMethod: 'touch', schemaVersion: 1 },
  size_normal: { time: '2026-09-18T02:10:00.000Z', level: 1, concept: 'size', questionIndex: 1, questionTotal: 2, shape: 'circle', expected: 'circle', selected: 'circle', correct: true, mistakes: 0, mistakeSelections: [], shapeSize: 'large', responseTimeMs: 1000, inputMethod: 'touch', schemaVersion: 1 },
  size_with_object_mistake: { time: '2026-09-18T02:15:00.000Z', level: 2, concept: 'size', questionIndex: 2, questionTotal: 2, shape: 'square', expected: 'square', selected: 'square', correct: true, mistakes: 1, mistakeSelections: [{ shapeType: 'circle', size: 'small' }], shapeSize: 'small', responseTimeMs: 1800, inputMethod: 'touch', schemaVersion: 1 },
  puzzle_complete: { time: '2026-09-18T02:20:00.000Z', level: 2, concept: 'puzzle', patternId: 'p1', patternName: 'ちょうちょ', pieceCount: 6, correct: true, durationMs: 45000, inputMethod: 'touch', schemaVersion: 1 }
};
FIXTURES.legacy_minimal = { time: '2026-09-18T02:25:00.000Z', level: 1, correct: true, schemaVersion: 1 }; // no concept field (pre-Phase26-I3)
FIXTURES.legacy_string_mistakes = { time: '2026-09-18T02:30:00.000Z', level: 1, concept: 'shape', questionIndex: 1, questionTotal: 1, shape: 'circle', expected: 'circle', selected: 'circle', correct: true, mistakes: 1, mistakeSelections: ['triangle'], responseTimeMs: 900, inputMethod: 'touch', schemaVersion: 1 }; // pre-I3.1 plain-string mistakeSelections
FIXTURES.unknown_mode = { time: '2026-09-18T02:35:00.000Z', level: 1, concept: 'somethingnew', questionIndex: 1, questionTotal: 1, shape: 'circle', expected: 'circle', selected: 'circle', correct: true, mistakes: 0, mistakeSelections: [], responseTimeMs: 700, inputMethod: 'touch', schemaVersion: 1 };
FIXTURES.html_like_pattern_name = { time: '2026-09-18T02:40:00.000Z', level: 1, concept: 'puzzle', patternId: 'p2', patternName: '<img src=x onerror="window.__xss=true">', pieceCount: 4, correct: true, durationMs: 20000, inputMethod: 'touch', schemaVersion: 1 };

const storage = new FakeStorage();
storage.setItem('katachi_log', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['katachi-awase-app'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. getDetails() via the real public API — per concept');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('katachi-awase-app', fixture); }

{
  const rows = detailsFor(FIXTURES.shape_normal);
  const labels = rows.map(r => r.label);
  check('shape_normal: レベル/形/正しい場所/選択した場所/正誤/再試行回数 present', ['レベル', '形', '正しい場所', '選択した場所', '正誤', '再試行回数'].every(l => labels.includes(l)), labels);
  check('shape_normal: おおきさ NOT shown (shape concept, no shapeSize)', !labels.includes('おおきさ'), labels);
  const retry = rows.find(r => r.label === '再試行回数');
  check('shape_normal: 再試行回数 = 0回 (meaningful zero, not suppressed)', retry && retry.value === '0回', retry);
  const level = rows.find(r => r.label === 'レベル');
  check('shape_normal: レベル = ひとつ', level && level.value === 'ひとつ', level);
}
{
  const rows = detailsFor(FIXTURES.shape_with_mistake);
  const mistakeContent = rows.find(r => r.label === '間違えた内容');
  check('shape_with_mistake: 間違えた内容 = しかく', mistakeContent && mistakeContent.value === 'しかく', mistakeContent);
}
{
  const rows = detailsFor(FIXTURES.size_normal);
  const labels = rows.map(r => r.label);
  check('size_normal: おおきさ IS shown (size concept, shapeSize present)', labels.includes('おおきさ'), labels);
  const size = rows.find(r => r.label === 'おおきさ');
  check('size_normal: おおきさ = おおきい', size && size.value === 'おおきい', size);
  const level = rows.find(r => r.label === 'レベル');
  check('size_normal: レベル = おなじ (size concept level labels)', level && level.value === 'おなじ', level);
}
{
  const rows = detailsFor(FIXTURES.size_with_object_mistake);
  const mistakeContent = rows.find(r => r.label === '間違えた内容');
  check('size_with_object_mistake: new-format {shapeType,size} object rendered as "ちいさい まる"', mistakeContent && mistakeContent.value === 'ちいさい まる', mistakeContent);
}
{
  const rows = detailsFor(FIXTURES.puzzle_complete);
  const labels = rows.map(r => r.label);
  check('puzzle_complete: むずかしさ/パズル名/正誤/かかった時間 present', ['むずかしさ', 'パズル名', '正誤', 'かかった時間'].every(l => labels.includes(l)), labels);
  check('puzzle_complete: no shape/size-only fields (形/選択した場所/再試行回数) leak in', !labels.some(l => ['形', '選択した場所', '再試行回数'].includes(l)), labels);
  const dur = rows.find(r => r.label === 'かかった時間');
  check('puzzle_complete: かかった時間 = 45秒', dur && dur.value === '45秒', dur);
  const diff = rows.find(r => r.label === 'むずかしさ');
  check('puzzle_complete: むずかしさ = ふつう (puzzle level labels)', diff && diff.value === 'ふつう', diff);
}
{
  const rows = detailsFor(FIXTURES.legacy_minimal);
  const labels = rows.map(r => r.label);
  check('legacy_minimal (no concept field): treated as shape concept, no crash, only fields that exist shown', labels.includes('レベル') && labels.includes('正誤') && !labels.includes('形'), labels);
}
{
  const rows = detailsFor(FIXTURES.legacy_string_mistakes);
  const mistakeContent = rows.find(r => r.label === '間違えた内容');
  check('legacy_string_mistakes: old plain-string mistakeSelections rendered correctly (さんかく)', mistakeContent && mistakeContent.value === 'さんかく', mistakeContent);
}
{
  const rows = detailsFor(FIXTURES.unknown_mode);
  const labels = rows.map(r => r.label);
  const level = rows.find(r => r.label === 'レベル');
  check('unknown_mode: unrecognized concept falls back to "レベルN" safely, no crash', level && level.value === 'レベル1', level);
  check('unknown_mode: known fields (形 etc) still shown', labels.includes('形'), labels);
}
{
  const rows = detailsFor(FIXTURES.html_like_pattern_name);
  const name = rows.find(r => r.label === 'パズル名');
  check('html_like_pattern_name: raw markup preserved as plain string data (rendering layer handles safety via textContent)', name && name.value === '<img src=x onerror="window.__xss=true">', name);
}
check('getRecordDetails never throws on null/undefined entry', (function () { try { dash.getRecordDetails('katachi-awase-app', null); dash.getRecordDetails('katachi-awase-app', undefined); return true; } catch (e) { return false; } })());

// ────────────────────────────────────────────────────────────
section('4. Rich Visualization — NOT APPLICABLE (Matrix: katachi-awase-app saves no media)');
// ────────────────────────────────────────────────────────────
check('supportsRichVisualization is false for every fixture', Object.keys(FIXTURES).every(k => dash.supportsRichVisualization('katachi-awase-app', FIXTURES[k]) === false));

// ────────────────────────────────────────────────────────────
section('5. CSV Parity — getCsvActions(), exact 15-column shape (App-local CSV_HEADERS)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('katachi-awase-app');
  check('getCsvActions returns exactly 1 action (detail CSV)', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 15 columns', rows[0].length === 15, rows[0]);
  check('CSV header matches App-local CSV_HEADERS exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', 'レベル', '問題番号', '問題数', '形', '正しい場所', '選択した場所', '正誤', '再試行回数', '間違えた内容', '反応時間ms', 'おおきさ', 'パズル名', 'かかった時間(秒)']), rows[0]);
  check('CSV has 9 data rows (one per fixture)', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);
  const puzzleRowIdx = 1 + Object.keys(FIXTURES).indexOf('puzzle_complete');
  check('puzzle row: shape-only columns blank', rows[puzzleRowIdx][3] === '' && rows[puzzleRowIdx][5] === '', rows[puzzleRowIdx]);
  check('action does not throw on malformed log entries (null/string/number)', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, []]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('6. App-local / Common semantic parity (same record, same values)');
// ────────────────────────────────────────────────────────────
{
  const direct = KatachiDetail.getDetailRows(FIXTURES.size_with_object_mistake);
  const viaCommon = dash.getRecordDetails('katachi-awase-app', FIXTURES.size_with_object_mistake);
  check('Common getRecordDetails() output is byte-identical to direct KatachiDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
