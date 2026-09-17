#!/usr/bin/env node
// Phase LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1 — Golden Test Harness
// for okane-app's Common CSV Parity (Level 2 Detail is trivially satisfied:
// Root Investigation confirmed okane-app.html stores no structured field
// beyond a pre-formatted natural-language `detail` sentence, so
// getDetailRows() intentionally returns [] rather than guessing meaning
// out of free text -- see assets/js/okane-record-detail.js header comment).
//
// Usage: node tools/record-dashboard-poc/okane-common-detail-golden-tests.js
//
// Existing-adapter regression for the other apps is covered by
// golden-tests.js / ui-golden-tests.js / the other per-app suites
// (re-run alongside this file, not duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const OkaneDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'okane-record-detail.js'));
global.donomanaOkaneRecordDetail = OkaneDetail;
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const { FakeStorage } = require('./fixtures.js');

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'okane-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter registration (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('okane-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'okane-app' && meta.appName === 'おかねのおべんきょう' && meta.category === '学習アプリ' && meta.storageKey === 'okane_activity_log');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — match/shop/mondai/mistake, legacy, malformed, HTML-like');
// ────────────────────────────────────────────────────────────
const FIXTURES = {
  shop_normal: { ts: '2026-09-18T01:00:00.000Z', type: 'shop', detail: '¥650のおかいもの（おつり ¥350）', schemaVersion: 1 },
  mondai_complete: { ts: '2026-09-18T01:05:00.000Z', type: 'mondai', detail: 'もんだい ぜんぶ かんりょう！（5/5もん せいかい）', schemaVersion: 1 },
  match_perfect: { ts: '2026-09-18T01:10:00.000Z', type: 'match', detail: 'ぜんもんせいかい！（4もん）', schemaVersion: 1 },
  mistake_shop: { ts: '2026-09-18T01:15:00.000Z', type: 'mistake', detail: '¥500のおかいものに¥300をいれてたりなかった（あと¥200）', schemaVersion: 1 },
  mistake_mondai: { ts: '2026-09-18T01:20:00.000Z', type: 'mistake', detail: 'もんだい「これはいくら？」で¥100とこたえたが、せいかいは¥50', schemaVersion: 1 },
  legacy_no_schema_version: { ts: '2026-09-18T01:25:00.000Z', type: 'shop', detail: '¥200のおかいもの（おつり ¥0）' }, // no schemaVersion field at all
  unknown_type: { ts: '2026-09-18T01:30:00.000Z', type: 'somethingnew', detail: 'よくわからない活動', schemaVersion: 1 },
  missing_detail: { ts: '2026-09-18T01:35:00.000Z', type: 'shop', schemaVersion: 1 }, // no detail field
  html_like_detail: { ts: '2026-09-18T01:40:00.000Z', type: 'shop', detail: '<img src=x onerror="window.__xss=true">の おかいもの', schemaVersion: 1 },
  long_detail: { ts: '2026-09-18T01:45:00.000Z', type: 'shop', detail: 'あ'.repeat(500), schemaVersion: 1 },
  formula_like_detail: { ts: '2026-09-18T01:50:00.000Z', type: 'shop', detail: '=SUM(A1:A9)のおかいもの', schemaVersion: 1 }
};

const storage = new FakeStorage();
storage.setItem('okane_activity_log', JSON.stringify(Object.keys(FIXTURES).map(k => FIXTURES[k])));
const collected = dash.collectRecords({ storage: storage, appIds: ['okane-app'], maxPerApp: 50 });
check('all fixtures normalize without crashing', collected.records.length === Object.keys(FIXTURES).length, collected.records.length);
check('0 read/normalize errors', collected.errors.length === 0, collected.errors);

// ────────────────────────────────────────────────────────────
section('3. getDetails() — intentionally empty (no structured field exists beyond detail/type)');
// ────────────────────────────────────────────────────────────
Object.keys(FIXTURES).forEach(key => {
  const rows = dash.getRecordDetails('okane-app', FIXTURES[key]);
  check(`${key}: getDetailRows returns [] (Level 1 summary/activity already covers everything stored)`, Array.isArray(rows) && rows.length === 0, rows);
});
check('getRecordDetails never throws on null/undefined/malformed entry', (function () {
  try {
    dash.getRecordDetails('okane-app', null);
    dash.getRecordDetails('okane-app', undefined);
    dash.getRecordDetails('okane-app', { type: 'shop' }); // missing detail entirely
    dash.getRecordDetails('okane-app', []); // array instead of object
    return true;
  } catch (e) { return false; }
})());

// ────────────────────────────────────────────────────────────
section('4. typeLabel() — direct module validation');
// ────────────────────────────────────────────────────────────
check("typeLabel('shop') = おかいもの", OkaneDetail.typeLabel('shop') === 'おかいもの');
check("typeLabel('mondai') = もんだい", OkaneDetail.typeLabel('mondai') === 'もんだい');
check("typeLabel('match') = マッチング", OkaneDetail.typeLabel('match') === 'マッチング');
check("typeLabel('mistake') = まちがい", OkaneDetail.typeLabel('mistake') === 'まちがい');
check("typeLabel('unknown-value') = その他 (safe fallback)", OkaneDetail.typeLabel('unknown-value') === 'その他');
check("typeLabel(undefined) = その他, no crash", OkaneDetail.typeLabel(undefined) === 'その他');

// ────────────────────────────────────────────────────────────
section('5. CSV Parity — getCsvActions(), exact 4-column shape (App-local「かつどうログ」CSV_HEADER)');
// ────────────────────────────────────────────────────────────
{
  const actions = dash.getCsvActions('okane-app');
  check('getCsvActions returns exactly 1 action', actions.length === 1, actions.length);
  const rawAll = Object.keys(FIXTURES).map(k => FIXTURES[k]);
  const rows = actions[0].buildRows(rawAll);
  check('CSV header has exactly 4 columns', rows[0].length === 4, rows[0]);
  check('CSV header matches App-local header exactly', JSON.stringify(rows[0]) === JSON.stringify(['日付', '時刻', 'しゅるい', 'ないよう']), rows[0]);
  check('CSV has 1 data row per fixture', rows.length - 1 === Object.keys(FIXTURES).length, rows.length - 1);

  const shopRowIdx = 1 + Object.keys(FIXTURES).indexOf('shop_normal');
  check('shop_normal CSV row: しゅるい=おかいもの、ないよう=detail text verbatim', rows[shopRowIdx][2] === 'おかいもの' && rows[shopRowIdx][3] === '¥650のおかいもの（おつり ¥350）', rows[shopRowIdx]);
  const unknownRowIdx = 1 + Object.keys(FIXTURES).indexOf('unknown_type');
  check('unknown_type CSV row: しゅるい=その他 (safe fallback, no crash)', rows[unknownRowIdx][2] === 'その他', rows[unknownRowIdx]);
  const missingRowIdx = 1 + Object.keys(FIXTURES).indexOf('missing_detail');
  check('missing_detail CSV row: ないよう is empty string, not "undefined"', rows[missingRowIdx][3] === '', rows[missingRowIdx]);
  const htmlRowIdx = 1 + Object.keys(FIXTURES).indexOf('html_like_detail');
  check('html_like_detail CSV row: raw markup preserved as plain string data (rendering layer handles safety, not this builder)', rows[htmlRowIdx][3].indexOf('<img') === 0 || rows[htmlRowIdx][3].indexOf('<img') > -1, rows[htmlRowIdx]);
  const longRowIdx = 1 + Object.keys(FIXTURES).indexOf('long_detail');
  check('long_detail CSV row: full 500-char value preserved (no silent truncation)', rows[longRowIdx][3].length === 500, rows[longRowIdx][3].length);
  const formulaRowIdx = 1 + Object.keys(FIXTURES).indexOf('formula_like_detail');
  check('formula_like_detail CSV row: value preserved verbatim (App-local csvEscape only quotes on comma/quote/newline, matches App-local exactly, not a new safety concern introduced here)', rows[formulaRowIdx][3] === '=SUM(A1:A9)のおかいもの', rows[formulaRowIdx]);

  check('action does not throw on malformed log entries (null/string/number/array/{})', (function () { try { actions[0].buildRows([null, 'x', 42, undefined, [], {}]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('6. App-local / Common semantic parity (same record, same values, same function)');
// ────────────────────────────────────────────────────────────
{
  const direct = OkaneDetail.buildDetailCsvRows([FIXTURES.shop_normal, FIXTURES.mistake_shop]);
  const viaCommon = dash.getCsvActions('okane-app')[0].buildRows([FIXTURES.shop_normal, FIXTURES.mistake_shop]);
  check('Common CSV action output is byte-identical to direct OkaneDetail.buildDetailCsvRows()', JSON.stringify(direct) === JSON.stringify(viaCommon), { direct, viaCommon });
}

console.log('\n' + (pass + fail) + '/' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
