#!/usr/bin/env node
// Phase LEARNING-RECORD-DETAIL-PARITY-KURABEYOU-KATACHI-1 — Golden Test
// Harness for kurabeyou-app's Level 2 Detail Parity (Batch B,
// docs/records/learning-record-detail-parity-audit-all-v1_0.md).
//
// Usage: node tools/record-dashboard-poc/kurabeyou-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps (incl. Sawatte/SST/directions)
// is covered by golden-tests.js / ui-golden-tests.js /
// sawatte-common-detail-golden-tests.js / sst-common-detail-golden-tests.js /
// directions-common-detail-golden-tests.js (re-run alongside this file, not
// duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const KurabeyouDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'kurabeyou-record-detail.js'));
const { FakeStorage } = require('./fixtures.js');

global.donomanaKurabeyouRecordDetail = KurabeyouDetail;

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'kurabeyou-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter unchanged (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('kurabeyou-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'kurabeyou-app' && meta.appName === 'おおきい？ちいさい？くらべよう' && meta.category === '学習アプリ' && meta.storageKey === 'kurabeyou_log');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — levels 1-4, both concepts');
// ────────────────────────────────────────────────────────────
// kurabeyou-app.html実測shapeをそのまま使う(架空schema禁止)。
const FIXTURES = {
  level1: { time: '2026-09-18T01:00:00.000Z', concept: 'size', level: 1, inputMethod: 'touch', schemaVersion: 1 },
  level2: { time: '2026-09-18T01:05:00.000Z', concept: 'length', level: 2, selected: 'long', inputMethod: 'touch', schemaVersion: 1 },
  level3_no_mistake: { time: '2026-09-18T01:10:00.000Z', concept: 'size', level: 3, prompt: 'big', selected: 'big', correct: true, firstSelected: 'big', mistakeSelections: [], mistakes: 0, responseTimeMs: 1200, questionIndex: 1, questionTotal: 5, inputMethod: 'touch', schemaVersion: 1 },
  level3_with_mistake: { time: '2026-09-18T01:15:00.000Z', concept: 'size', level: 3, prompt: 'small', selected: 'small', correct: true, firstSelected: 'big', mistakeSelections: ['big'], mistakes: 1, responseTimeMs: 3400, questionIndex: 2, questionTotal: 5, inputMethod: 'touch', schemaVersion: 1 },
  level4_no_mistake: { time: '2026-09-18T01:20:00.000Z', concept: 'length', level: 4, order: 'desc', items: [{ id: 'item0', value: 140 }, { id: 'item1', value: 100 }, { id: 'item2', value: 190 }], correctOrder: ['item2', 'item0', 'item1'], selectedOrder: ['item2', 'item0', 'item1'], mistakeDetails: [], mistakes: 0, responseTimeMs: 5000, questionIndex: 1, questionTotal: 3, inputMethod: 'touch', schemaVersion: 1 },
  level4_with_mistake: { time: '2026-09-18T01:25:00.000Z', concept: 'length', level: 4, order: 'asc', items: [{ id: 'item0', value: 140 }, { id: 'item1', value: 100 }, { id: 'item2', value: 190 }], correctOrder: ['item1', 'item0', 'item2'], selectedOrder: ['item0', 'item1', 'item2'], mistakeDetails: [{ step: 1, selectedId: 'item0', expectedId: 'item1' }], mistakes: 1, responseTimeMs: 6100, questionIndex: 2, questionTotal: 3, inputMethod: 'touch', schemaVersion: 1 }
};
FIXTURES.legacy_minimal = { time: '2026-09-18T01:30:00.000Z', concept: 'size', level: 3, correct: true, schemaVersion: 1 };
FIXTURES.unknown_extra_field = { time: '2026-09-18T01:35:00.000Z', concept: 'length', level: 2, selected: 'short', inputMethod: 'touch', schemaVersion: 1, futureField: { nested: true } };
FIXTURES.html_like_selected = { time: '2026-09-18T01:40:00.000Z', concept: 'size', level: 2, selected: '<script>window.__xss=true</script>', inputMethod: 'touch', schemaVersion: 1 };

const storage = new FakeStorage();
storage.setItem('kurabeyou_log', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['kurabeyou-app'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. getDetails() via the real public API — per level');
// ────────────────────────────────────────────────────────────
function detailsFor(fixture) { return dash.getRecordDetails('kurabeyou-app', fixture); }

check('level1: no detail rows (Level 1 summary suffices)', detailsFor(FIXTURES.level1).length === 0, detailsFor(FIXTURES.level1));

{
  const rows = detailsFor(FIXTURES.level2);
  const sel = rows.find(r => r.label === '選んだほう');
  check('level2: 選んだほう = ながいほう', sel && sel.value === 'ながいほう', sel);
}
{
  const rows = detailsFor(FIXTURES.level3_no_mistake);
  const labels = rows.map(r => r.label);
  check('level3 (no mistake): 問題/正解/最終選択/正誤/再試行回数 present', ['問題', '正解', '最終選択', '正誤', '再試行回数'].every(l => labels.includes(l)), labels);
  check('level3 (no mistake): 最初の選択 NOT shown (same as final, no retry)', !labels.includes('最初の選択'), labels);
  check('level3 (no mistake): 間違えた内容 NOT shown (empty)', !labels.includes('間違えた内容'), labels);
  const retry = rows.find(r => r.label === '再試行回数');
  check('level3 (no mistake): 再試行回数 = 0回 (meaningful zero, not suppressed)', retry && retry.value === '0回', retry);
  const seikai = rows.find(r => r.label === '正解');
  check('level3: 正解 = おおきいほう (prompt label)', seikai && seikai.value === 'おおきいほう', seikai);
}
{
  const rows = detailsFor(FIXTURES.level3_with_mistake);
  const labels = rows.map(r => r.label);
  check('level3 (with mistake): 最初の選択 IS shown (differs from final)', labels.includes('最初の選択'), labels);
  const first = rows.find(r => r.label === '最初の選択');
  check('level3 (with mistake): 最初の選択 = おおきいほう', first && first.value === 'おおきいほう', first);
  const finalSel = rows.find(r => r.label === '最終選択');
  check('level3 (with mistake): 最終選択 = ちいさいほう', finalSel && finalSel.value === 'ちいさいほう', finalSel);
  const mistakeContent = rows.find(r => r.label === '間違えた内容');
  check('level3 (with mistake): 間違えた内容 = おおきいほう', mistakeContent && mistakeContent.value === 'おおきいほう', mistakeContent);
}
{
  const rows = detailsFor(FIXTURES.level4_no_mistake);
  const labels = rows.map(r => r.label);
  check('level4 (no mistake): 並べる方向/正しい順序/実際の選択順序/再試行回数 present', ['並べる方向', '正しい順序', '実際の選択順序', '再試行回数'].every(l => labels.includes(l)), labels);
  check('level4 (no mistake): 間違えた内容 NOT shown', !labels.includes('間違えた内容'), labels);
  const order = rows.find(r => r.label === '正しい順序');
  check('level4: 正しい順序 = 190→140→100', order && order.value === '190→140→100', order);
}
{
  const rows = detailsFor(FIXTURES.level4_with_mistake);
  const mistakeContent = rows.find(r => r.label === '間違えた内容');
  check('level4 (with mistake): 間違えた内容 uses rank labels (いちばん/中くらい)', mistakeContent && /いちばん|中くらい/.test(mistakeContent.value), mistakeContent);
}
{
  const rows = detailsFor(FIXTURES.legacy_minimal);
  const labels = rows.map(r => r.label);
  check('legacy_minimal: only 正誤 shown, no crash on missing prompt/selected/mistakeSelections', labels.length === 1 && labels[0] === '正誤', labels);
}
{
  const rows = detailsFor(FIXTURES.unknown_extra_field);
  const labels = rows.map(r => r.label);
  check('unknown_extra_field: known field (選んだほう) unaffected by unrecognized extra field', labels.includes('選んだほう'), labels);
}
{
  const rows = detailsFor(FIXTURES.html_like_selected);
  const sel = rows.find(r => r.label === '選んだほう');
  check('html_like_selected: raw markup preserved as plain string data (unmapped label falls back to raw value, rendering layer is caller\'s responsibility via textContent)', sel && sel.value === '<script>window.__xss=true</script>', sel);
}
check('getRecordDetails never throws on null/undefined entry', (function () { try { dash.getRecordDetails('kurabeyou-app', null); dash.getRecordDetails('kurabeyou-app', undefined); return true; } catch (e) { return false; } })());

// ────────────────────────────────────────────────────────────
section('4. Rich Visualization — NOT APPLICABLE (Matrix: kurabeyou-app saves no media)');
// ────────────────────────────────────────────────────────────
check('supportsRichVisualization is false for every fixture', Object.keys(FIXTURES).every(k => dash.supportsRichVisualization('kurabeyou-app', FIXTURES[k]) === false));

// ────────────────────────────────────────────────────────────
section('5. CSV Parity — getCsvActions(), exact 17-column shape (App-local CSV_HEADERS)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('kurabeyou-app');
  check('getCsvActions returns exactly 1 action (detail CSV)', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 17 columns', rows[0].length === 17, rows[0]);
  check('CSV header matches App-local CSV_HEADERS exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', 'テーマ', 'レベル', '問題番号', '問題数', '問題文', '正解', '最初の選択', '最終選択', '正誤', '再試行回数', '間違えた内容', '反応時間ms', '並べる方向', '正しい順序', '実際の選択順序']), rows[0]);
  check('CSV has 9 data rows (one per fixture)', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);
  check('action does not throw on malformed log entries (null/string/number)', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, []]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('6. App-local / Common semantic parity (same record, same values)');
// ────────────────────────────────────────────────────────────
{
  const direct = KurabeyouDetail.getDetailRows(FIXTURES.level3_with_mistake);
  const viaCommon = dash.getRecordDetails('kurabeyou-app', FIXTURES.level3_with_mistake);
  check('Common getRecordDetails() output is byte-identical to direct KurabeyouDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
