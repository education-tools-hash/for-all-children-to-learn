#!/usr/bin/env node
// Phase LEARNING-RECORD-DETAIL-PARITY-DIRECTIONS-1 — Golden Test Harness for
// directions-app's Level 2 Detail Parity (Batch B pilot,
// docs/records/learning-record-detail-parity-audit-all-v1_0.md).
//
// Usage: node tools/record-dashboard-poc/directions-common-detail-golden-tests.js
//
// Existing-adapter regression for the other 21 apps (incl. Sawatte/SST) is
// covered by golden-tests.js / ui-golden-tests.js /
// sawatte-common-detail-golden-tests.js / sst-common-detail-golden-tests.js
// (re-run alongside this file, not duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const ui = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-ui.js'));
const DirectionsDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'directions-record-detail.js'));
const { FakeStorage } = require('./fixtures.js');

global.donomanaDirectionsRecordDetail = DirectionsDetail;

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'directions-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter unchanged (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('directions-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'directions-app' && meta.appName === 'ほうこうとばしょをまなぼう' && meta.category === '学習アプリ' && meta.storageKey === 'appLogs');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — 4 categories, correct/wrong');
// ────────────────────────────────────────────────────────────
// directions-app.html:2181-2192実測のshapeをそのまま使う(架空schema禁止)。
const FIXTURES = {
  quiz_correct: { ts: '2026-09-17T01:00:00.000Z', tsLocal: '2026/09/17 10:00:00', category: 'quiz', question: 'みぎから3ばんめは どれ？', userAnswer: 'りんご', correctAnswer: 'りんご', result: 'correct', schemaVersion: 1 },
  dir_wrong: { ts: '2026-09-17T01:05:00.000Z', tsLocal: '2026/09/17 10:05:00', category: 'dir', question: 'みぎは どっち？', userAnswer: 'ひだり', correctAnswer: 'みぎ', result: 'wrong', schemaVersion: 1 },
  compass_correct: { ts: '2026-09-17T01:10:00.000Z', tsLocal: '2026/09/17 10:10:00', category: 'compass', question: 'きたは どっち？', userAnswer: 'きた', correctAnswer: 'きた', result: 'correct', schemaVersion: 1 },
  practice_wrong: { ts: '2026-09-17T01:15:00.000Z', tsLocal: '2026/09/17 10:15:00', category: 'practice', question: 'つくえの うえに あるのは？', userAnswer: 'ほん', correctAnswer: 'えんぴつ', result: 'wrong', schemaVersion: 1 }
};
FIXTURES.legacy_minimal = { ts: '2026-09-17T01:20:00.000Z', tsLocal: '2026/09/17 10:20:00', category: 'quiz', question: '', userAnswer: '', correctAnswer: '', result: 'correct', schemaVersion: 1 };
FIXTURES.unknown_extra_field = { ts: '2026-09-17T01:25:00.000Z', tsLocal: '2026/09/17 10:25:00', category: 'dir', question: 'ひだりは どっち？', userAnswer: 'ひだり', correctAnswer: 'ひだり', result: 'correct', schemaVersion: 1, futureField: { nested: true } };
FIXTURES.long_text = { ts: '2026-09-17T01:30:00.000Z', tsLocal: '2026/09/17 10:30:00', category: 'practice', question: 'あ'.repeat(300), userAnswer: 'い'.repeat(300), correctAnswer: 'う'.repeat(300), result: 'wrong', schemaVersion: 1 };
FIXTURES.html_like_text = { ts: '2026-09-17T01:35:00.000Z', tsLocal: '2026/09/17 10:35:00', category: 'quiz', question: '<img src=x onerror="window.__xss=true">', userAnswer: '<b>b</b>', correctAnswer: '<script>1</script>', result: 'wrong', schemaVersion: 1 };

const storage = new FakeStorage();
storage.setItem('appLogs', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['directions-app'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. getDetails() via the real public API — per record');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('directions-app', fixture); }

{
  const rows = detailsFor(FIXTURES.quiz_correct);
  const labels = rows.map(r => r.label);
  check('quiz_correct: 問題/回答/正解/結果 all present', ['問題', '回答', '正解', '結果'].every(l => labels.includes(l)), labels);
  const resultRow = rows.find(r => r.label === '結果');
  check('quiz_correct: 結果 is ○', resultRow && resultRow.value === '○', resultRow);
}
{
  const rows = detailsFor(FIXTURES.dir_wrong);
  const resultRow = rows.find(r => r.label === '結果');
  check('dir_wrong: 結果 is ×', resultRow && resultRow.value === '×', resultRow);
  const q = rows.find(r => r.label === '問題');
  check('dir_wrong: 問題 matches saved question verbatim', q && q.value === 'みぎは どっち？', q);
}
{
  const rows = detailsFor(FIXTURES.legacy_minimal);
  const labels = rows.map(r => r.label);
  check('legacy_minimal: empty question/userAnswer/correctAnswer are NOT shown as rows (§16 display rule)', !labels.includes('問題') && !labels.includes('回答') && !labels.includes('正解'), labels);
  check('legacy_minimal: 結果 row still shown (has a real value)', labels.includes('結果'), labels);
}
{
  const rows = detailsFor(FIXTURES.unknown_extra_field);
  const labels = rows.map(r => r.label);
  check('unknown_extra_field: known fields unaffected by unrecognized extra field', ['問題', '回答', '正解', '結果'].every(l => labels.includes(l)), labels);
}
{
  const rows = detailsFor(FIXTURES.long_text);
  const q = rows.find(r => r.label === '問題');
  check('long_text: 300-char question preserved verbatim (no truncation invented)', q && q.value.length === 300, q && q.value.length);
}
{
  const rows = detailsFor(FIXTURES.html_like_text);
  const q = rows.find(r => r.label === '問題');
  check('html_like_text: raw markup preserved as plain string data (not executed — rendering layer is caller\'s responsibility via textContent)', q && q.value === '<img src=x onerror="window.__xss=true">', q);
}
check('getRecordDetails never throws on null/undefined entry', (function () { try { dash.getRecordDetails('directions-app', null); dash.getRecordDetails('directions-app', undefined); return true; } catch (e) { return false; } })());

// ────────────────────────────────────────────────────────────
section('4. Activity label — dir/compass/practice (previously fell back to "その他の活動")');
// ────────────────────────────────────────────────────────────
check('quiz -> クイズ (shared generic label, unchanged)', ui.activityLabel('quiz') === 'クイズ', ui.activityLabel('quiz'));
check('dir -> どっちかな (matches directions-app.html CATEGORY_LABELS)', ui.activityLabel('dir') === 'どっちかな', ui.activityLabel('dir'));
check('compass -> ほうがく', ui.activityLabel('compass') === 'ほうがく', ui.activityLabel('compass'));
check('practice -> はいち', ui.activityLabel('practice') === 'はいち', ui.activityLabel('practice'));

// ────────────────────────────────────────────────────────────
section('5. Rich Visualization — NOT APPLICABLE (Matrix: directions-app saves no media)');
// ────────────────────────────────────────────────────────────
check('supportsRichVisualization is false for every fixture', Object.keys(FIXTURES).every(k => dash.supportsRichVisualization('directions-app', FIXTURES[k]) === false));

// ────────────────────────────────────────────────────────────
section('6. CSV Parity — getCsvActions(), exact 7-column shape (App-local exportLogCSV() header)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('directions-app');
  check('getCsvActions returns exactly 1 action (detail CSV)', actions.length === 1, actions.length);
  check('getCsvActions returns [] for an unregistered appId', dash.getCsvActions('not-a-real-app').length === 0);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 7 columns', rows[0].length === 7, rows[0]);
  check('CSV header matches App-local exportLogCSV() exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', 'カテゴリ', '問題', '回答', '正解', '結果']), rows[0]);
  check('CSV has 8 data rows (one per fixture)', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);
  const quizRow = rows[1];
  check('first data row: date/time split correctly (dot-separated, Excel-safe)', /^\d{4}\.\d{2}\.\d{2}$/.test(quizRow[0]) && /^\d{2}:\d{2}:\d{2}$/.test(quizRow[1]), quizRow);
  check('action does not throw on malformed log entries (null/string/number)', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, []]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('7. App-local / Common semantic parity (same record, same values)');
// ────────────────────────────────────────────────────────────
{
  const direct = DirectionsDetail.getDetailRows(FIXTURES.compass_correct);
  const viaCommon = dash.getRecordDetails('directions-app', FIXTURES.compass_correct);
  check('Common getRecordDetails() output is byte-identical to direct DirectionsDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
