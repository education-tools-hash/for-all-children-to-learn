// Phase T8-B2 — Golden tests for the "学習のきろく" UI pure logic module
// (assets/js/record-dashboard-ui.js) + Adapter Registry / apps-data.json
// metadata drift check.
//
// DOM操作・Playwright相当の実ブラウザ検証はここでは行わない
// (tools/record-dashboard-poc/dashboard-realbrowser-test.py が担当)。
// このファイルはNode.js単体で完結する純粋関数のみを検証する
// (tools/record-dashboard-poc/golden-tests.jsと同じ慣習)。
'use strict';

const path = require('path');
const fs = require('fs');
const ui = require(path.join(__dirname, '..', '..', 'assets', 'js', 'record-dashboard-ui.js'));
const foundation = require(path.join(__dirname, '..', '..', 'assets', 'js', 'record-dashboard-foundation.js'));

let pass = 0, fail = 0;
function check(label, condition, detail) {
  if (condition) { pass++; console.log('  [OK  ]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}

console.log('=== 1. Metadata Drift: apps-data.json <-> Adapter Registry(21本) ===');
(function () {
  const appsDataPath = path.join(__dirname, '..', '..', 'apps-data.json');
  const appsData = JSON.parse(fs.readFileSync(appsDataPath, 'utf8'));
  const appsList = Array.isArray(appsData) ? appsData : (appsData.apps || Object.values(appsData));
  // Foundation/Adapter RegistryのappIdは各appのHTML filename(=record自身が
  // 書き込むappId値)と一致する契約。apps-data.jsonの`id`は原則filenameと
  // 同値だが、dotchiga-ii(id="dotchiga-ii", filename="dotchiga-ii-app")のみ
  // 例外的に異なるため、joinキーはfilenameを正とする(既存の既知の表記ゆれ、
  // T8-B2で新たに発生した問題ではない)。
  const byId = {};
  appsList.forEach(function (a) { byId[a.filename] = a; });

  const adapters = foundation.getAdapters();
  check('Adapter Registry has 21 entries', adapters.length === 21, adapters.length);

  let nameDrift = [];
  let categoryDrift = [];
  let missingInAppsData = [];
  adapters.forEach(function (a) {
    const appData = byId[a.appId];
    if (!appData) { missingInAppsData.push(a.appId); return; }
    if (appData.title !== a.appName) nameDrift.push({ appId: a.appId, appsData: appData.title, registry: a.appName });
    if (appData.category !== a.category) categoryDrift.push({ appId: a.appId, appsData: appData.category, registry: a.category });
  });
  check('every Foundation appId exists in apps-data.json', missingInAppsData.length === 0, missingInAppsData);
  check('appName matches apps-data.json title for all 21', nameDrift.length === 0, nameDrift);
  check('category matches apps-data.json category for all 21', categoryDrift.length === 0, categoryDrift);
})();

console.log('\n=== 2. activityLabel() ===');
(function () {
  check('known code mapped', ui.activityLabel('checkout') === 'おかいもの');
  check('level-N pattern mapped', ui.activityLabel('level-3') === 'レベル3');
  check('unmapped code falls back to a generic Japanese label, never the raw internal code', ui.activityLabel('totally-unmapped-xyz') === 'その他の活動');
  check('janken mode codes mapped to modeNames-equivalent Japanese labels', ui.activityLabel('win') === 'かちのは どれ？' && ui.activityLabel('lose') === 'まけるのは どれ？' && ui.activityLabel('both') === 'どちらもまぜる');
  check('nazori mode codes mapped to Japanese labels (not raw "wide"/"single")', ui.activityLabel('wide') === '続けて書く' && ui.activityLabel('single') === '一文字ずつ');
  check('unknown/empty/non-string falls back to 活動', ui.activityLabel('unknown') === '活動' && ui.activityLabel('') === '活動' && ui.activityLabel(null) === '活動' && ui.activityLabel(undefined) === '活動');
})();

console.log('\n=== 3. formatMetrics() ===');
(function () {
  const m = ui.formatMetrics({ total: 5, correct: true, mistakeCount: 0 });
  check('numeric metric kept as number', m.find(x => x.key === 'total').value === 5);
  check('boolean metric mapped to 正解/不正解', m.find(x => x.key === 'correct').value === '正解');
  check('zero value metric NOT dropped (0 is a real value, not fabricated)', m.find(x => x.key === 'mistakeCount').value === 0);
  check('unknown metric key omitted (no raw variable names shown)', ui.formatMetrics({ totallyUnknownField: 1 }).length === 0);
  check('non-object/undefined metrics -> empty array', ui.formatMetrics(undefined).length === 0 && ui.formatMetrics(null).length === 0);
})();

console.log('\n=== 4. Period filter (isWithinPeriod / filterRecords) ===');
(function () {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const recToday = { timestamp: '2026-09-02T01:00:00.000Z' };      // same UTC calendar day
  const rec6d = { timestamp: '2026-08-27T12:00:00.000Z' };          // 6 days ago
  const rec8d = { timestamp: '2026-08-25T12:00:00.000Z' };          // 8 days ago
  const rec29d = { timestamp: '2026-08-04T12:00:00.000Z' };         // 29 days ago
  const rec31d = { timestamp: '2026-08-02T12:00:00.000Z' };         // 31 days ago
  const recFuture = { timestamp: '2026-09-05T00:00:00.000Z' };      // future timestamp
  const recNull = { timestamp: null };
  const recInvalid = { timestamp: 'not-a-date' };

  check('today: includes same-day record', ui.isWithinPeriod(recToday, 'today', now) === true);
  check('today: excludes 6-days-ago record', ui.isWithinPeriod(rec6d, 'today', now) === false);
  check('today: excludes future timestamp', ui.isWithinPeriod(recFuture, 'today', now) === false);
  check('7d: includes 6-days-ago', ui.isWithinPeriod(rec6d, '7d', now) === true);
  check('7d: excludes 8-days-ago', ui.isWithinPeriod(rec8d, '7d', now) === false);
  check('30d: includes 29-days-ago', ui.isWithinPeriod(rec29d, '30d', now) === true);
  check('30d: excludes 31-days-ago', ui.isWithinPeriod(rec31d, '30d', now) === false);
  check('all: includes everything including null/invalid timestamp', ui.isWithinPeriod(recNull, 'all', now) === true && ui.isWithinPeriod(recInvalid, 'all', now) === true);
  check('today/7d/30d: excludes null timestamp (cannot confirm recency)', ui.isWithinPeriod(recNull, 'today', now) === false && ui.isWithinPeriod(recNull, '7d', now) === false && ui.isWithinPeriod(recNull, '30d', now) === false);
  check('today/7d/30d: excludes unparseable timestamp', ui.isWithinPeriod(recInvalid, '7d', now) === false);

  const mixed = [
    { appId: 'a', appName: 'A', category: '学習アプリ', activity: 'quiz', timestamp: recToday.timestamp },
    { appId: 'b', appName: 'B', category: '認知支援', activity: 'trace', timestamp: rec8d.timestamp },
    { appId: 'a', appName: 'A', category: '学習アプリ', activity: 'checkout', timestamp: rec31d.timestamp }
  ];
  check('filterRecords: period=today isolates 1 record', ui.filterRecords(mixed, { period: 'today' }, now).length === 1);
  check('filterRecords: appId filter', ui.filterRecords(mixed, { period: 'all', appId: 'a' }, now).length === 2);
  check('filterRecords: category filter', ui.filterRecords(mixed, { period: 'all', category: '認知支援' }, now).length === 1);
  check('filterRecords: activity filter', ui.filterRecords(mixed, { period: 'all', activity: 'checkout' }, now).length === 1);
  check('filterRecords: combined filters narrow correctly', ui.filterRecords(mixed, { period: 'all', appId: 'a', activity: 'quiz' }, now).length === 1);
})();

console.log('\n=== 5. distinctApps / distinctCategories / distinctActivities ===');
(function () {
  const recs = [
    { appId: 'z-app', appName: 'ぞうさん', category: '学習アプリ', activity: 'quiz' },
    { appId: 'a-app', appName: 'あひる', category: '認知支援', activity: 'trace' },
    { appId: 'a-app', appName: 'あひる', category: '認知支援', activity: 'trace' } // duplicate
  ];
  check('distinctApps de-duplicates by appId', ui.distinctApps(recs).length === 2);
  check('distinctCategories de-duplicates', ui.distinctCategories(recs).length === 2);
  check('distinctActivities de-duplicates and carries label', ui.distinctActivities(recs).some(a => a.value === 'trace' && a.label === 'なぞり'));
  check('distinctApps: empty input -> empty array (no crash)', ui.distinctApps([]).length === 0 && ui.distinctApps(undefined).length === 0);
})();

console.log('\n=== 6. groupByDate ===');
(function () {
  const recs = [
    { timestamp: '2026-09-02T01:00:00.000Z' },
    { timestamp: '2026-09-02T05:00:00.000Z' },
    { timestamp: '2026-08-31T01:00:00.000Z' },
    { timestamp: null },
    { timestamp: 'garbage' }
  ];
  const groups = ui.groupByDate(recs);
  check('groups by calendar date, preserving input order', groups.length === 3);
  check('same-date records land in the same group', groups[0].records.length === 2);
  check('invalid + null timestamps share the same 日付不明 group (no crash)', groups[groups.length - 1].label === '日付不明' && groups[groups.length - 1].records.length === 2);
})();

console.log('\n=== 7. formatDisplayDateTime ===');
(function () {
  const r = ui.formatDisplayDateTime('2026-09-02T01:05:00.000Z');
  check('formats date as YYYY年M月D日', /^\d{4}年\d{1,2}月\d{1,2}日$/.test(r.date));
  check('formats time as HH:mm', /^\d{2}:\d{2}$/.test(r.time));
  check('null timestamp -> 日付不明, no Invalid Date string', ui.formatDisplayDateTime(null).date === '日付不明');
  check('unparseable timestamp -> 日付不明, no Invalid Date string', ui.formatDisplayDateTime('not-a-date').date === '日付不明');
})();

console.log('\n=== 8. buildSummary (no ranking/average/achievement-rate fields) ===');
(function () {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const recs = [
    { appId: 'a', timestamp: '2026-09-02T01:00:00.000Z' },
    { appId: 'b', timestamp: '2026-08-01T01:00:00.000Z' }
  ];
  const s = ui.buildSummary(recs, now);
  check('todayCount / appCount / totalCount present', typeof s.todayCount === 'number' && typeof s.appCount === 'number' && typeof s.totalCount === 'number');
  check('no forbidden ranking/score-average fields on the summary object', !('averageScore' in s) && !('achievementRate' in s) && !('ranking' in s));
  check('appCount de-duplicates by appId', s.appCount === 2);
})();

console.log('\n=== 9. CSV: Formula Injection guard, quoting, BOM ===');
(function () {
  check('csvSafeCell prefixes =, +, -, @ with a quote', ['=cmd', '+cmd', '-cmd', '@cmd'].every(v => ui.csvSafeCell(v)[0] === "'"));
  check('csvSafeCell prefixes tab/CR-leading values', ui.csvSafeCell('\tcmd')[0] === "'" && ui.csvSafeCell('\rcmd')[0] === "'");
  check('csvSafeCell leaves normal text untouched', ui.csvSafeCell('じゃんけん まなぼう！') === 'じゃんけん まなぼう！');
  check('csvSafeCell handles null/undefined without throwing', ui.csvSafeCell(null) === '' && ui.csvSafeCell(undefined) === '');

  const rows = ui.buildCsvRows([
    { timestamp: '2026-09-02T01:00:00.000Z', appName: '=SUM(A1)', category: '学習アプリ', activity: 'checkout', summary: '3点購入。合計650円', inputMethod: null },
    { timestamp: null, appName: '通常アプリ', category: '認知支援', activity: 'trace', summary: 'カンマ,や"引用符"を含む概要\n改行あり', inputMethod: 'gaze' }
  ]);
  check('header row matches the 7 common columns', rows[0].join(',') === ['日付', '時刻', '教材', 'カテゴリ', '活動', '概要', '入力方法'].join(','));
  check('appId/category/adapter-internal fields NOT present as extra columns', rows[0].length === 7);
  check('Formula Injection guard applied to appName column', rows[1][2][0] === "'");
  check('null timestamp -> empty date/time cells, not "Invalid Date"', rows[2][0] === '' && rows[2][1] === '');
  check('inputMethod null -> empty cell, not the string "null"', rows[1][6] === '');
  check('inputMethod present -> shown', rows[2][6] === 'gaze');

  const csv = ui.buildCsv(rows);
  check('CSV begins with UTF-8 BOM (U+FEFF)', csv.charCodeAt(0) === 0xFEFF);
  check('comma-containing cell is quoted', csv.indexOf('"カンマ,や""引用符""を含む概要') !== -1);
  check('embedded double-quotes are doubled per RFC 4180', csv.indexOf('""引用符""') !== -1);
})();

console.log('\n=== 10. Sorting is NOT re-implemented (records passed through as-is) ===');
(function () {
  // Foundation(collectRecords)がすでに新しい順にソート済みという契約(§45)を
  // UI層が信頼し、filterRecordsが順序を変えないことだけを確認する。
  const ordered = [
    { appId: 'a', timestamp: '2026-09-02T03:00:00.000Z' },
    { appId: 'b', timestamp: '2026-09-02T02:00:00.000Z' },
    { appId: 'c', timestamp: '2026-09-02T01:00:00.000Z' }
  ];
  const filtered = ui.filterRecords(ordered, { period: 'all' }, new Date('2026-09-02T12:00:00.000Z'));
  check('filterRecords preserves input order (no independent re-sort)', filtered.map(r => r.appId).join(',') === 'a,b,c');
})();

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed.');
if (fail === 0) {
  console.log('ALL PASS.');
  process.exit(0);
} else {
  console.log(fail + ' FAILURES.');
  process.exit(1);
}
