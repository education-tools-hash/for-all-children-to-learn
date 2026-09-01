#!/usr/bin/env node
// Phase T8-B1 — Record Adapter Foundation Golden Test Harness
//
// Usage: node tools/record-dashboard-poc/golden-tests.js
//
// donomanaRecordDashboard(assets/js/record-dashboard-foundation.js)の
// 21 Adapterを、実Production schemaに基づくgolden fixture・破損storage
// matrix・cross-app failure isolation・XSS・personal-data leakage・
// performanceの各観点で検証する。新規external dependencyなし(Node標準機能のみ)。

'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const { FakeStorage, GOLDEN, CORRUPT_RAW_VALUES, XSS_STRINGS, LEAK_MARKER } = require('./fixtures.js');

let totalChecks = 0;
let failedChecks = 0;

function check(label, ok, detail) {
  totalChecks++;
  if (!ok) failedChecks++;
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  return ok;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// storageKeyの生値へfixtureを書き込むヘルパー。structureが'nested'のadapter
// (kyou-no-kiroku)はrecordsフィールドへ配列として包む。
function seedApp(storage, appId, entries) {
  const adapters = dash.getAdapters();
  const meta = adapters.find(a => a.appId === appId);
  const rawAdapter = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
  const structure = (appId === 'kyou-no-kiroku') ? 'nested' : 'flat';
  const key = meta.storageKey;
  if (structure === 'nested') {
    storage.setItem(key, JSON.stringify({ children: [], records: entries }));
  } else {
    storage.setItem(key, JSON.stringify(entries));
  }
}

function buildFullStorage() {
  const storage = new FakeStorage();
  Object.keys(GOLDEN).forEach(appId => seedApp(storage, appId, [GOLDEN[appId]]));
  return storage;
}

// ────────────────────────────────────────────────────────────
section('1. Registry coverage: Foundation Set 21 == Adapter Registry 21');
// ────────────────────────────────────────────────────────────
{
  const generateJs = fs.readFileSync(path.join(REPO_ROOT, 'generate.js'), 'utf8');
  const m = generateJs.match(/LEARNING_RECORD_FOUNDATION_APPS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  check('LEARNING_RECORD_FOUNDATION_APPS found in generate.js', !!m);
  const foundationIds = m ? eval('[' + m[1] + ']') : [];
  check('Foundation Set size is 21', foundationIds.length === 21, 'actual=' + foundationIds.length);

  const adapterIds = dash.getAdapters().map(a => a.appId);
  check('Adapter Registry size is 21', adapterIds.length === 21, 'actual=' + adapterIds.length);

  const missingFromAdapters = foundationIds.filter(id => !adapterIds.includes(id));
  const extraInAdapters = adapterIds.filter(id => !foundationIds.includes(id));
  check('every Foundation app has an adapter', missingFromAdapters.length === 0, JSON.stringify(missingFromAdapters));
  check('no adapter exists outside the Foundation Set', extraInAdapters.length === 0, JSON.stringify(extraInAdapters));
  check('gaze-keyboard is NOT in the Adapter Registry', !adapterIds.includes('gaze-keyboard'));
}

// ────────────────────────────────────────────────────────────
section('2. storageKey cross-check against real app source files');
// ────────────────────────────────────────────────────────────
{
  const FILE_MAP = {
    'janken-app': 'janken-app.html', 'register-app': 'register-app.html', 'tokei-app': 'tokei-app.html',
    'matching-app': 'matching-app.html', 'shiritori2': 'shiritori2.html', 'directions-app': 'directions-app.html',
    'hiragana-learn': 'hiragana-learn.html', 'katakana-app': 'katakana-app.html', 'suji-manabou': 'suji-manabou.html',
    'mitsukete-touch-app': 'mitsukete-touch-app.html', 'junban-miyou-app': 'junban-miyou-app.html',
    'kurabeyou-app': 'kurabeyou-app.html', 'katachi-awase-app': 'katachi-awase-app.html',
    'dotchiga-ii-app': 'dotchiga-ii-app.html', 'miru-hirogaru-app': 'miru-hirogaru-app.html',
    'okane-app': 'okane-app.html', 'sst-app': 'sst-app.html', 'mogura-tataki': 'mogura-tataki.html',
    'nazori-app': 'nazori-app.html', 'bosai-app': 'bosai-app.html', 'kyou-no-kiroku': 'kyou-no-kiroku.html'
  };
  dash.getAdapters().forEach(a => {
    const filePath = path.join(REPO_ROOT, FILE_MAP[a.appId]);
    let src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (e) { /* checked below */ }
    check(`${a.appId}: source file exists`, src.length > 0, filePath);
    check(`${a.appId}: storageKey "${a.storageKey}" referenced in source`, src.indexOf("'" + a.storageKey + "'") !== -1 || src.indexOf('"' + a.storageKey + '"') !== -1);
  });
  // sst-appは日記storage(sst_diary_entries_v1)をAdapterが絶対に参照しないことを確認(§22)。
  const sstMeta = dash.getAdapters().find(a => a.appId === 'sst-app');
  check('sst-app adapter storageKey is NOT the diary key', sstMeta.storageKey !== 'sst_diary_entries_v1', sstMeta.storageKey);
  // 全21 adapterのstorageKeyのうち、日記storageと一致するものが無いことを確認する
  // (モジュール内のコメントで説明目的に文言が出るのは許容、実際にgetItem対象と
  // なるstorageKey値に含まれないことが本質的な安全性)。
  check('no adapter storageKey anywhere equals the sst diary key', dash.getAdapters().every(a => a.storageKey !== 'sst_diary_entries_v1'));
}

// ────────────────────────────────────────────────────────────
section('3. All 21 golden fixtures normalize without crashing (contract check)');
// ────────────────────────────────────────────────────────────
{
  const storage = buildFullStorage();
  const result = dash.collectRecords({ storage: storage, includeSeparateDomains: true, maxPerApp: 50 });
  check('collectRecords() did not throw and returned records/errors/meta', !!(result && result.records && result.errors && result.meta));
  check('21 golden fixtures -> 21 normalized records (includeSeparateDomains:true)', result.records.length === 21, 'actual=' + result.records.length);
  check('0 read/normalize errors on clean golden fixtures', result.errors.length === 0, JSON.stringify(result.errors));

  const seenAppIds = new Set();
  result.records.forEach(r => {
    seenAppIds.add(r.appId);
    const label = r.appId;
    check(`${label}: appId is a non-empty string`, typeof r.appId === 'string' && r.appId.length > 0);
    check(`${label}: appName is a non-empty string`, typeof r.appName === 'string' && r.appName.length > 0);
    check(`${label}: category is a non-empty string`, typeof r.category === 'string' && r.category.length > 0);
    check(`${label}: activity is a non-empty string`, typeof r.activity === 'string' && r.activity.length > 0);
    check(`${label}: summary is a non-empty plain string`, typeof r.summary === 'string' && r.summary.length > 0);
    check(`${label}: summary contains no HTML tags`, !/[<>]/.test(r.summary), r.summary);
    check(`${label}: summary has no undefined/NaN/Invalid Date`, !/undefined|NaN|Invalid Date/.test(r.summary), r.summary);
    check(`${label}: metrics is a plain object`, r.metrics && typeof r.metrics === 'object' && !Array.isArray(r.metrics));
    check(`${label}: privacyLevel is low/medium/high`, ['low', 'medium', 'high'].includes(r.privacyLevel), r.privacyLevel);
    check(`${label}: hasMedia is boolean`, typeof r.hasMedia === 'boolean');
    check(`${label}: inputMethod is string or null`, r.inputMethod === null || typeof r.inputMethod === 'string');
    check(`${label}: timestamp is ISO string or null`, r.timestamp === null || (typeof r.timestamp === 'string' && !isNaN(Date.parse(r.timestamp))));
    check(`${label}: normalized object has no raw payload/data/log leaking through`, !('payload' in r) && !('data' in r) && !('log' in r));
  });
  check('all 21 appIds present in output', seenAppIds.size === 21, [...seenAppIds].sort().join(','));
}

// ────────────────────────────────────────────────────────────
section('4. kyou-no-kiroku default exclusion');
// ────────────────────────────────────────────────────────────
{
  const storage = buildFullStorage();
  const withoutSeparate = dash.collectRecords({ storage: storage, maxPerApp: 50 });
  check('default collectRecords() excludes kyou-no-kiroku', !withoutSeparate.records.some(r => r.appId === 'kyou-no-kiroku'));
  check('default collectRecords() still returns the other 20', withoutSeparate.records.length === 20, 'actual=' + withoutSeparate.records.length);

  const withSeparate = dash.collectRecords({ storage: storage, includeSeparateDomains: true, maxPerApp: 50 });
  check('includeSeparateDomains:true includes kyou-no-kiroku', withSeparate.records.some(r => r.appId === 'kyou-no-kiroku'));

  const kyouRecord = withSeparate.records.find(r => r.appId === 'kyou-no-kiroku');
  check('kyou-no-kiroku summary contains no child name/medical data', kyouRecord && !/はなこ|にこにこ|36\.5|80/.test(kyouRecord.summary), kyouRecord && kyouRecord.summary);
  check('kyou-no-kiroku metrics is empty (no care-log data leaked)', kyouRecord && Object.keys(kyouRecord.metrics).length === 0);
  check('kyou-no-kiroku privacyLevel is high', kyouRecord && kyouRecord.privacyLevel === 'high');
}

// ────────────────────────────────────────────────────────────
section('5. Standard Core Schema 5 apps: same envelope, different payload adapters');
// ────────────────────────────────────────────────────────────
{
  const storage = buildFullStorage();
  const result = dash.collectRecords({ storage: storage, includeSeparateDomains: true, maxPerApp: 50 });
  const jk = result.records.find(r => r.appId === 'janken-app');
  const rg = result.records.find(r => r.appId === 'register-app');
  check('janken-app summary reflects total/correct from payload', jk && jk.summary.indexOf('3問中2問正解') !== -1, jk && jk.summary);
  check('janken-app metrics.mistakeCount === 1', jk && jk.metrics.mistakeCount === 1);
  check('register-app summary reflects itemCount/totalAmount', rg && rg.summary.indexOf('3点購入') !== -1 && rg.summary.indexOf('650円') !== -1, rg && rg.summary);
  check('register-app summary does NOT contain the product name (personal-data caution)', rg && rg.summary.indexOf('クッキー') === -1, rg && rg.summary);
}

// ────────────────────────────────────────────────────────────
section('6. Corrupted storage matrix (missing/empty/malformed/non-array/scalar) per app');
// ────────────────────────────────────────────────────────────
{
  const appIds = dash.getAdapters().map(a => a.appId);
  appIds.forEach(appId => {
    Object.keys(CORRUPT_RAW_VALUES).forEach(caseName => {
      const storage = new FakeStorage();
      const meta = dash.getAdapters().find(a => a.appId === appId);
      const raw = CORRUPT_RAW_VALUES[caseName];
      if (raw !== undefined) storage.setItem(meta.storageKey, raw);
      let threw = false, res;
      try { res = dash.readAppRecords(appId, { storage: storage }); } catch (e) { threw = true; }
      check(`${appId} / ${caseName}: readAppRecords does not throw`, !threw);
      check(`${appId} / ${caseName}: rawRecords is []`, !threw && Array.isArray(res.rawRecords) && res.rawRecords.length === 0);
    });
  });
}

// ────────────────────────────────────────────────────────────
section('7. Corrupt entry inside an otherwise-valid array (per-entry isolation)');
// ────────────────────────────────────────────────────────────
{
  const storage = new FakeStorage();
  const good = GOLDEN['janken-app'];
  // {} は typeof 'object' の正当なentry形状なので、adapterはfallback summaryで
  // 安全に処理する(degenerateだがcrashしない、§28/§29)。null/'hello'/42/[] は
  // entry形状として不正なのでskipされる(§30)。
  seedApp(storage, 'janken-app', [good, null, 'hello', 42, {}, [], good]);
  const result = dash.collectRecords({ storage: storage, appIds: ['janken-app'], maxPerApp: 50 });
  check('3 valid entries collected out of 7 raw entries (good, good, and degenerate {})', result.records.length === 3, 'actual=' + result.records.length);
  check('4 invalid-entry errors reported (null/"hello"/42/[])', result.errors.filter(e => e.errorType === 'invalid-entry').length === 4, JSON.stringify(result.errors));
}

// ────────────────────────────────────────────────────────────
section('8. Cross-app failure isolation (1 app malformed, 1 non-array, rest valid)');
// ────────────────────────────────────────────────────────────
{
  const storage = buildFullStorage(); // all 21 valid
  // janken-appを破壊
  const jkMeta = dash.getAdapters().find(a => a.appId === 'janken-app');
  storage.setItem(jkMeta.storageKey, '{not valid json');
  // register-appをvalid non-arrayに破壊
  const rgMeta = dash.getAdapters().find(a => a.appId === 'register-app');
  storage.setItem(rgMeta.storageKey, '{}');

  const result = dash.collectRecords({ storage: storage, includeSeparateDomains: true, maxPerApp: 50 });
  check('collectRecords does not throw when 2/21 apps are corrupted', !!result);
  check('19 of 21 apps still collected (1 record each)', result.records.length === 19, 'actual=' + result.records.length);
  check('janken-app and register-app are absent from records', !result.records.some(r => r.appId === 'janken-app' || r.appId === 'register-app'));
  check('errors array reports both corrupted apps', result.errors.some(e => e.appId === 'janken-app') && result.errors.some(e => e.appId === 'register-app'), JSON.stringify(result.errors));
  check('NOT "1app破損でDashboard全体0件" (records.length > 0)', result.records.length > 0);
}

// ────────────────────────────────────────────────────────────
section('9. Legacy / missing-fields fixtures (no undefined/NaN/Invalid Date, no crash)');
// ────────────────────────────────────────────────────────────
{
  const legacyCases = [
    { appId: 'janken-app', entry: { timestamp: '2026-09-01T00:00:00.000Z', payload: { mode: 'win' } } }, // no total/correct/mistakes
    { appId: 'nazori-app', entry: { id: 'legacy1', timestamp: '2026-09-01T00:00:00.000Z' } }, // no allChars/sessionDone/image/schemaVersion at all
    { appId: 'bosai-app', entry: { id: 'legacy2', kind: 'quiz', timestamp: '2026-09-01T00:00:00.000Z' } }, // no correct/total/name
    { appId: 'kurabeyou-app', entry: { time: '2026-09-01T00:00:00.000Z' } }, // no concept/level/correct at all
    { appId: 'mogura-tataki', entry: { date: 'not-a-real-date-string!!' } }, // unparseable date
    { appId: 'directions-app', entry: {} } // completely empty
  ];
  legacyCases.forEach(c => {
    const storage = new FakeStorage();
    seedApp(storage, c.appId, [c.entry]);
    let threw = false, result;
    try { result = dash.collectRecords({ storage: storage, appIds: [c.appId], maxPerApp: 50 }); } catch (e) { threw = true; }
    check(`${c.appId} legacy/missing-fields: no throw`, !threw);
    if (!threw && result.records.length > 0) {
      const r = result.records[0];
      check(`${c.appId} legacy: summary has no undefined/NaN/Invalid Date`, !/undefined|NaN|Invalid Date/.test(r.summary), r.summary);
      check(`${c.appId} legacy: timestamp is null or valid ISO (unparseable date -> null, not throw)`, r.timestamp === null || !isNaN(Date.parse(r.timestamp)));
    } else if (!threw) {
      check(`${c.appId} legacy: entry was safely skipped rather than crashing`, true);
    }
  });
}

// ────────────────────────────────────────────────────────────
section('10. XSS fixtures (plain-text summary, no HTML construction)');
// ────────────────────────────────────────────────────────────
{
  XSS_STRINGS.forEach(xss => {
    const storage = new FakeStorage();
    seedApp(storage, 'katachi-awase-app', [{ time: '2026-09-01T00:00:00.000Z', concept: 'puzzle', level: 1, correct: true, patternName: xss, durationMs: 5000 }]);
    seedApp(storage, 'dotchiga-ii-app', [{ time: '2026-09-01T00:00:00.000Z', activity: 'preference', selectedChoice: 'x', selectedLabel: xss, trialIndex: 1, trialTotal: 1 }]);
    seedApp(storage, 'miru-hirogaru-app', [{ time: '2026-09-01T00:00:00.000Z', level: 1, target: xss }]);
    const result = dash.collectRecords({ storage: storage, appIds: ['katachi-awase-app', 'dotchiga-ii-app', 'miru-hirogaru-app'], maxPerApp: 5 });
    check(`3 records collected for XSS fixture ${JSON.stringify(xss)}`, result.records.length === 3);
    result.records.forEach(r => {
      check(`${r.appId}: summary is typeof string even with XSS fixture`, typeof r.summary === 'string');
      check(`${r.appId}: XSS fixture round-trips as plain literal text (module builds no HTML)`, r.summary.indexOf(xss) !== -1, r.summary);
    });
  });
  // 静的チェック: モジュール自体がeval/Function/innerHTMLを一切使わない(§52)。
  const src = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'), 'utf8');
  check('module source contains no eval(', src.indexOf('eval(') === -1);
  check('module source contains no new Function', src.indexOf('new Function') === -1);
  check('module source contains no innerHTML', src.indexOf('innerHTML') === -1);
}

// ────────────────────────────────────────────────────────────
section('11. Personal-data leakage (bosai name / register product name / nazori allChars)');
// ────────────────────────────────────────────────────────────
{
  const storage = new FakeStorage();
  seedApp(storage, 'bosai-app', [{ id: 'b', kind: 'quiz', name: LEAK_MARKER, correct: 3, total: 5, score: 60, timestamp: '2026-09-01T00:00:00.000Z' }]);
  seedApp(storage, 'register-app', [{ timestamp: '2026-09-01T00:00:00.000Z', payload: { itemCount: 1, totalAmount: 100, items: [{ name: LEAK_MARKER, quantity: 1, unitPrice: 100, subtotal: 100 }] } }]);
  seedApp(storage, 'nazori-app', [{ id: 'n', timestamp: '2026-09-01T00:00:00.000Z', allChars: LEAK_MARKER, mode: 'wide', sessionDone: 1, sessionTotal: 1 }]);
  const result = dash.collectRecords({ storage: storage, appIds: ['bosai-app', 'register-app', 'nazori-app'], maxPerApp: 5 });
  check('3 records collected', result.records.length === 3);
  result.records.forEach(r => {
    check(`${r.appId}: summary does NOT contain the personal-data leak marker`, r.summary.indexOf(LEAK_MARKER) === -1, r.summary);
  });
  const bosai = result.records.find(r => r.appId === 'bosai-app');
  check('bosai-app privacyLevel is high', bosai && bosai.privacyLevel === 'high');
  const register = result.records.find(r => r.appId === 'register-app');
  check('register-app privacyLevel is medium', register && register.privacyLevel === 'medium');
  const nazori = result.records.find(r => r.appId === 'nazori-app');
  check('nazori-app privacyLevel is medium', nazori && nazori.privacyLevel === 'medium');
}

// ────────────────────────────────────────────────────────────
section('12. nazori large image is not copied into the normalized output');
// ────────────────────────────────────────────────────────────
{
  const bigDataUrl = 'data:image/png;base64,' + 'A'.repeat(200 * 1024); // ~200KB fake dataURL
  const storage = new FakeStorage();
  seedApp(storage, 'nazori-app', [{ id: 'n', timestamp: '2026-09-01T00:00:00.000Z', allChars: 'あ', mode: 'wide', sessionDone: 1, sessionTotal: 1, image: bigDataUrl }]);
  const result = dash.collectRecords({ storage: storage, appIds: ['nazori-app'], maxPerApp: 5 });
  const r = result.records[0];
  check('nazori-app hasMedia is true', r && r.hasMedia === true);
  const serialized = JSON.stringify(r);
  check('normalized record JSON size stays small (image not embedded)', serialized.length < 2000, 'actual=' + serialized.length);
  check('normalized record does not literally contain the image dataURL', serialized.indexOf('base64,AAAA') === -1);
}

// ────────────────────────────────────────────────────────────
section('13. Sorting (descending timestamp, invalid timestamps sink to the end)');
// ────────────────────────────────────────────────────────────
{
  const storage = new FakeStorage();
  seedApp(storage, 'janken-app', [
    { timestamp: '2026-09-01T08:00:00.000Z', payload: { mode: 'win', total: 3, correct: 3, mistakes: [] } },
    { timestamp: 'not-a-real-timestamp', payload: { mode: 'win', total: 3, correct: 3, mistakes: [] } },
    { timestamp: '2026-09-01T10:00:00.000Z', payload: { mode: 'win', total: 3, correct: 3, mistakes: [] } },
    { timestamp: '2026-09-01T09:00:00.000Z', payload: { mode: 'win', total: 3, correct: 3, mistakes: [] } }
  ]);
  const result = dash.collectRecords({ storage: storage, appIds: ['janken-app'], maxPerApp: 50 });
  const timestamps = result.records.map(r => r.timestamp);
  check('4 records collected (invalid timestamp normalizes to null, not dropped)', result.records.length === 4, JSON.stringify(timestamps));
  check('order is 10:00 -> 09:00 -> 08:00 -> null(invalid, sunk to end)',
    timestamps[0] === '2026-09-01T10:00:00.000Z' && timestamps[1] === '2026-09-01T09:00:00.000Z' && timestamps[2] === '2026-09-01T08:00:00.000Z' && timestamps[3] === null,
    JSON.stringify(timestamps));
}

// ────────────────────────────────────────────────────────────
section('14. maxPerApp and global limit');
// ────────────────────────────────────────────────────────────
{
  const storage = new FakeStorage();
  const entries = [];
  for (let i = 0; i < 100; i++) {
    entries.push({ timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), payload: { mode: 'win', total: 3, correct: i % 4, mistakes: [] } });
  }
  seedApp(storage, 'janken-app', entries);
  const capped = dash.collectRecords({ storage: storage, appIds: ['janken-app'], maxPerApp: 10 });
  check('maxPerApp=10 returns exactly 10 of 100 raw entries', capped.records.length === 10, 'actual=' + capped.records.length);
  check('maxPerApp keeps the most recent (correct===3, i=99 -> 99%4=3)', capped.records[0].metrics.correct === 3, capped.records[0].metrics.correct);

  const uncapped = dash.collectRecords({ storage: storage, appIds: ['janken-app'], maxPerApp: 0 });
  check('maxPerApp=0 means "no per-app cap" (all 100 returned)', uncapped.records.length === 100, 'actual=' + uncapped.records.length);

  const globalLimited = dash.collectRecords({ storage: storage, appIds: ['janken-app'], maxPerApp: 0, limit: 5 });
  check('global limit=5 truncates to 5 records', globalLimited.records.length === 5, 'actual=' + globalLimited.records.length);
  check('meta.totalBeforeLimit reflects pre-limit count', globalLimited.meta.totalBeforeLimit === 100, globalLimited.meta.totalBeforeLimit);
}

// ────────────────────────────────────────────────────────────
section('15. appId spoofing protection (raw record appId is ignored)');
// ────────────────────────────────────────────────────────────
{
  const storage = new FakeStorage();
  seedApp(storage, 'janken-app', [{ timestamp: '2026-09-01T00:00:00.000Z', appId: 'register-app', payload: { mode: 'win', total: 3, correct: 3, mistakes: [] } }]);
  const result = dash.collectRecords({ storage: storage, appIds: ['janken-app'], maxPerApp: 5 });
  check('normalized appId is the canonical adapter appId, not the spoofed raw value', result.records[0] && result.records[0].appId === 'janken-app', result.records[0] && result.records[0].appId);
  check('normalized appName is the janken-app name, not register-app', result.records[0] && result.records[0].appName === 'じゃんけん まなぼう！');
}

// ────────────────────────────────────────────────────────────
section('16. Read-only guarantee (no write APIs, storage untouched)');
// ────────────────────────────────────────────────────────────
{
  const src = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'), 'utf8');
  check('module source contains no .setItem( call', src.indexOf('.setItem(') === -1);
  check('module source contains no .removeItem( call', src.indexOf('.removeItem(') === -1);
  check('module source contains no .clear() call', /\.clear\(\)/.test(src) === false);
  check('public API surface is exactly the 4 documented functions + VERSION', Object.keys(dash).sort().join(',') === 'VERSION,collectRecords,getAdapters,normalizeRecord,readAppRecords');
}

// ────────────────────────────────────────────────────────────
section('17. Performance (synthetic large datasets, no pathological blowup)');
// ────────────────────────────────────────────────────────────
{
  function synthStorage(perAppCount) {
    const storage = new FakeStorage();
    dash.getAdapters().forEach(a => {
      const g = GOLDEN[a.appId];
      const entries = [];
      for (let i = 0; i < perAppCount; i++) entries.push(g);
      seedApp(storage, a.appId, entries);
    });
    return storage;
  }
  const small = synthStorage(200); // 200 x 21 apps = 4200 raw records (rolling-cap representative)
  const t0 = Date.now();
  const r1 = dash.collectRecords({ storage: small, includeSeparateDomains: true, maxPerApp: 200 });
  const t1 = Date.now();
  check('200/app (4200 raw) processed without throwing', !!r1);
  console.log(`    200/app: ${t1 - t0}ms, ${r1.records.length} normalized records`);

  const large = synthStorage(2000); // stand-in for the 7 uncapped apps' worst-case growth
  const t2 = Date.now();
  const r2 = dash.collectRecords({ storage: large, includeSeparateDomains: true, maxPerApp: 2000 });
  const t3 = Date.now();
  check('2000/app (42000 raw) processed without throwing', !!r2);
  console.log(`    2000/app: ${t3 - t2}ms, ${r2.records.length} normalized records`);

  const ratio = (t3 - t2 + 1) / (t1 - t0 + 1);
  check('10x input does not cost >30x time (rough O(n) sanity, not O(n^2))', ratio < 30, 'ratio=' + ratio.toFixed(2));
}

// ────────────────────────────────────────────────────────────
console.log(`\n${totalChecks - failedChecks}/${totalChecks} checks passed.`);
if (failedChecks > 0) {
  console.log(`${failedChecks} FAILED.`);
  process.exit(1);
} else {
  console.log('ALL PASS.');
  process.exit(0);
}
