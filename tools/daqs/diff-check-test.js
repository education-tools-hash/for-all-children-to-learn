// DAQS Phase 3B / 3B-Integration-Hardening: automated tests for
// tools/daqs/diff-check.js.
//
// All fixture "repos" used here are synthetic and disposable: they are built
// fresh under the OS temp directory (never inside this repository, never
// reusing real app HTML or real audit-script source) and deleted again at
// the end of the run. No production app file is ever touched.
//
// Tests 1-18 (plus the summary-rendering check) cover the standalone engine
// from Phase 3B. Tests 19+ cover the Integration Hardening additions:
// --no-run / --not-before (read-only mode, for a11y-audit.yml to call after
// it has already run the 7 scripts itself) and the RESOLVED-safety fix (an
// unrelated script's ERROR must never make a different finding look
// resolved, and must never make a healthy tier look like it shrank).
//
// Run: node tools/daqs/diff-check-test.js
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const DC = require('./diff-check.js');

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass++;
    console.log('PASS - ' + label);
  } else {
    fail++;
    console.log('FAIL - ' + label + (detail ? ' -- ' + detail : ''));
  }
}

function tryCheck(label, fn) {
  try {
    fn();
    check(label, true);
  } catch (e) {
    check(label, false, e.message);
  }
}

// ---------------------------------------------------------------------------
// Fixture repo builder: writes tiny synthetic stand-in scripts (not copies of
// the real audit scripts) at the exact relative paths diff-check.js expects,
// each driven by a sibling "<script>.config.json" file so test cases can
// control exactly what each one does without any shared mutable state.
// ---------------------------------------------------------------------------

function fakeScriptSource() {
  return [
    "const fs = require('fs');",
    "const cfg = JSON.parse(fs.readFileSync(__filename + '.config.json', 'utf-8'));",
    "if (cfg.behavior === 'crash') { console.error('simulated crash'); process.exit(1); }",
    "if (cfg.behavior === 'noop') { process.exit(0); }",
    "if (cfg.resultRelPath) { fs.writeFileSync(require('path').join(process.cwd(), cfg.resultRelPath), JSON.stringify(cfg.data, null, 2)); }",
    "process.exit(0);",
    '',
  ].join('\n');
}

function defaultScriptConfig(scriptRel) {
  const resultRelPath = DC.RESULT_FILE_OF[scriptRel] || null;
  let data = null;
  if (resultRelPath) {
    data = resultRelPath.includes('tier') ? {} : [];
  }
  return { behavior: 'normal', resultRelPath, data };
}

function buildFixtureRepo(appsFilenames, scriptConfigOverrides) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'daqs-diffcheck-test-'));
  fs.writeFileSync(
    path.join(tmpRoot, 'apps-data.json'),
    JSON.stringify(appsFilenames.map((f) => ({ filename: f })), null, 2)
  );
  for (const rel of DC.EXPECTED_SCRIPTS) {
    const abs = path.join(tmpRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, fakeScriptSource());
    const cfg = Object.assign(defaultScriptConfig(rel), (scriptConfigOverrides || {})[rel] || {});
    fs.writeFileSync(abs + '.config.json', JSON.stringify(cfg));
  }
  return tmpRoot;
}

function removeFixtureRepo(tmpRoot) {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function baselineFixture(overrides) {
  const base = {
    schemaVersion: DC.SCHEMA_VERSION,
    createdAt: '2026-10-12T00:00:00Z',
    baselineCommit: 'TEST-FIXTURE',
    createdBy: 'diff-check-test.js fixture',
    appsAtBaseline: ['app-a', 'app-b', 'app-c'],
    tierCoverageAtBaseline: { tier1: ['app-a'], tier2: ['app-b'], tier3: ['app-c'] },
    knownFindings: [
      { id: 'duplicate-id:app-a:dup-1', category: 'duplicate-id', app: 'app-a', detail: 'dup-1', detectedBy: ['audit35-1'] },
    ],
  };
  return Object.assign({}, base, overrides || {});
}

function writeBaseline(tmpRoot, baselineObj) {
  const daqsDir = path.join(tmpRoot, 'tools', 'daqs');
  fs.mkdirSync(daqsDir, { recursive: true });
  const p = path.join(daqsDir, 'baseline.json');
  fs.writeFileSync(p, JSON.stringify(baselineObj, null, 2));
  return p;
}

// Audit35-style per-app entry.
function a35Entry(filename, fields) {
  return Object.assign({ filename, appFileExists: true, duplicateIds: [] }, fields || {});
}

// Tier-style result object keyed by app filename.
function tierEntry(fields) {
  return Object.assign({ duplicateIds: [], brokenAriaRefs: [], tabindexAnomalies: [] }, fields || {});
}

// Main-heading-audit style per-app entry.
function mhEntry(filename, fields) {
  return Object.assign({ filename, mainCount: 1, h1Count: 1 }, fields || {});
}

// ---------------------------------------------------------------------------
// 1. 既知5件相当のみ → exit 0
// ---------------------------------------------------------------------------
(function test1() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')] },
    'tools/main-heading-audit/audit.js': { data: [mhEntry('app-a'), mhEntry('app-b'), mhEntry('app-c')] },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-b': tierEntry() } },
    'tools/accessibility-audit/tier3/static-audit.js': { data: { 'app-c': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('1. 既知のみ: exitCode===0', exitCode === 0, 'got ' + exitCode);
    check('1. 既知のみ: NEW is empty', report.findings.NEW.length === 0);
    check('1. 既知のみ: KNOWN has the 1 fixture finding', report.findings.KNOWN.length === 1);
    check('1. 既知のみ: ERROR is empty', report.scriptErrors.length === 0, JSON.stringify(report.scriptErrors));
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 2. 新規FINDINGを1件追加 → exit 1
// ---------------------------------------------------------------------------
(function test2() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': {
      data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b', { duplicateIds: ['dup-new'] }), a35Entry('app-c')],
    },
    'tools/main-heading-audit/audit.js': { data: [mhEntry('app-a'), mhEntry('app-b'), mhEntry('app-c')] },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('2. 新規1件: exitCode===1', exitCode === 1, 'got ' + exitCode);
    check('2. 新規1件: NEW contains duplicate-id:app-b:dup-new', report.findings.NEW.some((f) => f.id === 'duplicate-id:app-b:dup-new'));
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 3. 既存FINDINGを1件解消 → exit 0、RESOLVED記録
// ---------------------------------------------------------------------------
(function test3() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a'), a35Entry('app-b'), a35Entry('app-c')] }, // dup-1 gone
    'tools/main-heading-audit/audit.js': { data: [mhEntry('app-a'), mhEntry('app-b'), mhEntry('app-c')] },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-b': tierEntry() } },
    'tools/accessibility-audit/tier3/static-audit.js': { data: { 'app-c': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('3. 解消1件: exitCode===0', exitCode === 0, 'got ' + exitCode);
    check('3. 解消1件: RESOLVED contains duplicate-id:app-a:dup-1', report.findings.RESOLVED.some((f) => f.id === 'duplicate-id:app-a:dup-1'));
    check('3. 解消1件: NEW is empty', report.findings.NEW.length === 0);
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 4. 複数スクリプトによる同一問題 → 重複排除
// ---------------------------------------------------------------------------
(function test4() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')] },
    'tools/main-heading-audit/audit.js': { data: [mhEntry('app-a'), mhEntry('app-b'), mhEntry('app-c')] },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry({ duplicateIds: ['dup-1'] }) } }, // same id, same app, different script
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    const matches = report.findings.current.filter((f) => f.id === 'duplicate-id:app-a:dup-1');
    check('4. 重複排除: 1エントリに統合される', matches.length === 1, 'got ' + matches.length);
    check(
      '4. 重複排除: detectedByに両スクリプトが記録される',
      matches.length === 1 && matches[0].detectedBy.includes('audit35-1') && matches[0].detectedBy.includes('tier1'),
      matches[0] && JSON.stringify(matches[0].detectedBy)
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 5. 監査スクリプト異常終了 → ERROR
// ---------------------------------------------------------------------------
(function test5() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { behavior: 'crash' },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('5. スクリプト異常終了: exitCode===1', exitCode === 1);
    check(
      '5. スクリプト異常終了: ERRORにSCRIPT_CRASHEDが記録される',
      report.scriptErrors.some((e) => e.source === 'tools/audit35-1/audit.js' && e.errorType === 'SCRIPT_CRASHED')
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 6. JSON欠落（結果ファイルを書かない） → ERROR
// ---------------------------------------------------------------------------
(function test6() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { behavior: 'noop' }, // exits 0 but never writes the result file
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('6. 結果ファイル欠落: exitCode===1', exitCode === 1);
    check(
      '6. 結果ファイル欠落: RESULT_FILE_MISSINGが記録される',
      report.scriptErrors.some((e) => e.errorType === 'RESULT_FILE_MISSING')
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 7. 必須フィールド欠落 → ERROR
// ---------------------------------------------------------------------------
(function test7() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    // main-heading-audit entries missing h1Count entirely
    'tools/main-heading-audit/audit.js': { data: [{ filename: 'app-a', mainCount: 1 }, mhEntry('app-b'), mhEntry('app-c')] },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('7. 必須フィールド欠落: exitCode===1', exitCode === 1);
    check(
      '7. 必須フィールド欠落: MISSING_FIELDが記録される',
      report.scriptErrors.some((e) => e.errorType === 'MISSING_FIELD')
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 8. 不正なフィールド型 → ERROR
// ---------------------------------------------------------------------------
(function test8() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [{ filename: 'app-a', appFileExists: true, duplicateIds: 'not-an-array' }, a35Entry('app-b'), a35Entry('app-c')] },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('8. 不正な型: exitCode===1', exitCode === 1);
    check('8. 不正な型: WRONG_TYPEが記録される', report.scriptErrors.some((e) => e.errorType === 'WRONG_TYPE'));
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 9. 結果ファイルの古い残存データ → 検出（ERRORとして拒否）
// ---------------------------------------------------------------------------
(function test9() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/accessibility-audit/tier1/static-audit.js': { behavior: 'noop' }, // will not touch the pre-existing stale file below
  });
  try {
    // Pre-seed a stale committed-looking result file before the run, exactly
    // mirroring tier1-3's real static-audit-results.json being checked into
    // the repository as a historical snapshot.
    const staleResultPath = path.join(tmpRoot, DC.RESULT_FILE_OF['tools/accessibility-audit/tier1/static-audit.js']);
    fs.mkdirSync(path.dirname(staleResultPath), { recursive: true });
    fs.writeFileSync(staleResultPath, JSON.stringify({ 'app-a': tierEntry({ duplicateIds: ['stale-leftover'] }) }));
    // Make sure its mtime is unambiguously in the past relative to the run.
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(staleResultPath, past, past);

    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('9. 古い残存データ: exitCode===1', exitCode === 1);
    check(
      '9. 古い残存データ: RESULT_FILE_STALEとして拒否される',
      report.scriptErrors.some((e) => e.errorType === 'RESULT_FILE_STALE')
    );
    check(
      '9. 古い残存データ: 古いdup-idが現在のFINDINGSに混入しない',
      !report.findings.current.some((f) => f.id.includes('stale-leftover'))
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 10. 新規アプリ追加 → INFO（exit 0側、appsAddedに記録）
// ---------------------------------------------------------------------------
(function test10() {
  const apps = ['app-a', 'app-b', 'app-c', 'app-d'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c'), a35Entry('app-d')] },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-b': tierEntry() } },
    'tools/accessibility-audit/tier3/static-audit.js': { data: { 'app-c': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('10. 新規アプリ追加: exitCode===0', exitCode === 0, 'got ' + exitCode);
    check('10. 新規アプリ追加: appsAddedにapp-dが記録される', report.coverageDiff.appsAdded.includes('app-d'));
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 11. アプリ削除 → 通知対象（exit 1）
// ---------------------------------------------------------------------------
(function test11() {
  const apps = ['app-a', 'app-b']; // app-c removed from apps-data.json
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b')] },
    'tools/main-heading-audit/audit.js': { data: [mhEntry('app-a'), mhEntry('app-b')] },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-b': tierEntry() } },
    'tools/accessibility-audit/tier3/static-audit.js': { data: {} }, // app-c was tier3's only member and is gone
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('11. アプリ削除: exitCode===1', exitCode === 1);
    check('11. アプリ削除: appsRemovedにapp-cが記録される', report.coverageDiff.appsRemoved.includes('app-c'));
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 12. Tier監査対象減少（アプリ自体は存在） → 通知対象
// ---------------------------------------------------------------------------
(function test12() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')] },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    'tools/accessibility-audit/tier2/static-audit.js': { data: {} }, // app-b dropped out of tier2, no replacement
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('12. Tier対象減少: exitCode===1', exitCode === 1);
    check('12. Tier対象減少: tier2Removedにapp-bが記録される', report.coverageDiff.tier2Removed.includes('app-b'));
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 13. Tier対象の入れ替わり（件数同一） → 正しく検出
// ---------------------------------------------------------------------------
(function test13() {
  const apps = ['app-a', 'app-b', 'app-c', 'app-d'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: apps.map((a) => a35Entry(a, a === 'app-a' ? { duplicateIds: ['dup-1'] } : {})) },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    // baseline tier2 = ['app-b']; now app-b is gone from tier2 but app-d joined tier2 -- same headcount (1), different member.
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-d': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('13. Tier入れ替わり: tier2Removedにapp-bが記録される', report.coverageDiff.tier2Removed.includes('app-b'));
    check('13. Tier入れ替わり: tier2Addedにapp-dが記録される', report.coverageDiff.tier2Added.includes('app-d'));
    check('13. Tier入れ替わり: 件数同一でも通知対象(exit 1)になる', exitCode === 1);
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 14. baseline.json破損 → ERROR
// ---------------------------------------------------------------------------
(function test14() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {});
  try {
    const daqsDir = path.join(tmpRoot, 'tools', 'daqs');
    fs.mkdirSync(daqsDir, { recursive: true });
    const baselinePath = path.join(daqsDir, 'baseline.json');
    fs.writeFileSync(baselinePath, '{ this is not valid JSON');
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('14. baseline破損: exitCode===1', exitCode === 1);
    check('14. baseline破損: fatal.errorType===BASELINE_INVALID_JSON', report.fatal && report.fatal.errorType === 'BASELINE_INVALID_JSON');
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 15. baseline schemaVersion不一致 → ERROR
// ---------------------------------------------------------------------------
(function test15() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {});
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture({ schemaVersion: 999 }));
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('15. schemaVersion不一致: exitCode===1', exitCode === 1);
    check(
      '15. schemaVersion不一致: fatal.errorType===BASELINE_SCHEMA_MISMATCH',
      report.fatal && report.fatal.errorType === 'BASELINE_SCHEMA_MISMATCH'
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 16. 順序変更のみ → NEW誤検出なし
// ---------------------------------------------------------------------------
(function test16() {
  const appsA = ['app-a', 'app-b', 'app-c'];
  const appsB = ['app-c', 'app-a', 'app-b']; // same set, different order
  function run(appsOrder, dupOrder) {
    const tmpRoot = buildFixtureRepo(appsOrder, {
      'tools/audit35-1/audit.js': {
        data: appsOrder.map((a) => (a === 'app-a' ? a35Entry('app-a', { duplicateIds: dupOrder }) : a35Entry(a))),
      },
      'tools/main-heading-audit/audit.js': { data: appsOrder.map((a) => mhEntry(a)) },
    });
    try {
      const baselinePath = writeBaseline(tmpRoot, baselineFixture());
      return DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    } finally {
      removeFixtureRepo(tmpRoot);
    }
  }
  const r1 = run(appsA, ['dup-1', 'dup-2']);
  const r2 = run(appsB, ['dup-2', 'dup-1']);
  const ids1 = r1.report.findings.current.map((f) => f.id).sort();
  const ids2 = r2.report.findings.current.map((f) => f.id).sort();
  check('16. 順序変更: 同一のFINDINGS集合になる', JSON.stringify(ids1) === JSON.stringify(ids2), ids1 + ' vs ' + ids2);
  check('16. 順序変更: NEWは両方とも dup-2 のみ', r1.report.findings.NEW.length === 1 && r2.report.findings.NEW.length === 1);
})();

// ---------------------------------------------------------------------------
// 17. 問題IDの重複（audit35-1とtier双方から） → 正規化 (test4の別アングル: app違い+カテゴリ違いを混在)
// ---------------------------------------------------------------------------
(function test17() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': {
      data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b', { duplicateIds: ['dup-x'] }), a35Entry('app-c')],
    },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-b': tierEntry({ duplicateIds: ['dup-x'] }) } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    const dupX = report.findings.current.filter((f) => f.id === 'duplicate-id:app-b:dup-x');
    check('17. ID重複正規化: 1件に統合', dupX.length === 1);
    check('17. ID重複正規化: detectedByにaudit35-1とtier2が両方入る', dupX[0] && dupX[0].detectedBy.join(',') === 'audit35-1,tier2');
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 18. NEW・ERROR・カバレッジ縮小の複合発生 → exit 1
// ---------------------------------------------------------------------------
(function test18() {
  const apps = ['app-a', 'app-b']; // app-c removed (coverage shrink)
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': {
      data: [a35Entry('app-a', { duplicateIds: ['dup-1', 'dup-new'] }), a35Entry('app-b')], // dup-new is NEW
    },
    'tools/main-heading-audit/audit.js': { behavior: 'crash' }, // ERROR
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('18. 複合発生: exitCode===1', exitCode === 1);
    check('18. 複合発生: hasNew===true', report.classification.hasNew === true);
    check('18. 複合発生: hasError===true', report.classification.hasError === true);
    check('18. 複合発生: hasCoverageShrink===true', report.classification.hasCoverageShrink === true);
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// Helper for --no-run tests: builds a fixture repo that has ONLY
// apps-data.json and the 5 JSON result files already sitting on disk --
// deliberately no .js script files at all (not even fake ones). If
// evaluate({ noRun: true, ... }) ever tried to execute anything, this
// fixture would make it crash immediately (ENOENT), so these tests also
// double as proof that no-run mode genuinely never spawns the 7 scripts.
// ---------------------------------------------------------------------------

function buildNoRunFixtureRepo(appsFilenames, resultFiles) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'daqs-diffcheck-norun-test-'));
  fs.writeFileSync(
    path.join(tmpRoot, 'apps-data.json'),
    JSON.stringify(appsFilenames.map((f) => ({ filename: f })), null, 2)
  );
  for (const [scriptRel, data] of Object.entries(resultFiles || {})) {
    const resultRel = DC.RESULT_FILE_OF[scriptRel];
    const abs = path.join(tmpRoot, resultRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data, null, 2));
  }
  return tmpRoot;
}

// ---------------------------------------------------------------------------
// 19. --no-run モード: 既存ステップが書いたJSONを読むだけで正しく判定する
//     (スクリプトファイルが一切存在しないfixtureなので、実行を試みれば即クラッシュする --
//      例外なくPASSすること自体が「二重実行が発生していない」ことの証明になる)
// ---------------------------------------------------------------------------
(function test19() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const notBeforeMs = Date.now() - 5000; // the result files below are written "after" this
  const tmpRoot = buildNoRunFixtureRepo(apps, {
    'tools/audit35-1/audit.js': [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')],
    'tools/main-heading-audit/audit.js': apps.map((a) => mhEntry(a)),
    'tools/accessibility-audit/tier1/static-audit.js': { 'app-a': tierEntry() },
    'tools/accessibility-audit/tier2/static-audit.js': { 'app-b': tierEntry() },
    'tools/accessibility-audit/tier3/static-audit.js': { 'app-c': tierEntry() },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath, noRun: true, notBeforeMs });
    check('19. --no-run 正常系: exitCode===0', exitCode === 0, 'got ' + exitCode + ' ' + JSON.stringify(report.scriptErrors));
    check('19. --no-run 正常系: mode===no-run', report.mode === 'no-run');
    check('19. --no-run 正常系: KNOWNの1件を検出', report.findings.KNOWN.length === 1);
    check('19. --no-run 正常系: 7スクリプトのファイルは存在せず、クラッシュせずに完了', true);
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 20. --no-run モード: --not-before が無い場合は推測せずERROR
// ---------------------------------------------------------------------------
(function test20() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildNoRunFixtureRepo(apps, {});
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath, noRun: true });
    check('20. --no-run かつ not-before無し: exitCode===1', exitCode === 1);
    check(
      '20. --no-run かつ not-before無し: fatal.errorType===NOT_BEFORE_MS_MISSING',
      report.fatal && report.fatal.errorType === 'NOT_BEFORE_MS_MISSING'
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 21. --no-run モード: 事前削除が効いておらず古いファイルが残っている場合はERROR
//     (pre-delete ステップが何らかの理由で効かなかったケースのシミュレーション)
// ---------------------------------------------------------------------------
(function test21() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildNoRunFixtureRepo(apps, {
    'tools/main-heading-audit/audit.js': apps.map((a) => mhEntry(a)),
    'tools/accessibility-audit/tier1/static-audit.js': { 'app-a': tierEntry() },
    'tools/accessibility-audit/tier2/static-audit.js': { 'app-b': tierEntry() },
    'tools/accessibility-audit/tier3/static-audit.js': { 'app-c': tierEntry() },
  });
  try {
    // audit35-1's result file is written, but deliberately BEFORE the
    // not-before marker -- i.e. it looks like the pre-delete step failed to
    // remove it and the existing audit step never got to regenerate it.
    const staleResultPath = path.join(tmpRoot, DC.RESULT_FILE_OF['tools/audit35-1/audit.js']);
    fs.mkdirSync(path.dirname(staleResultPath), { recursive: true });
    fs.writeFileSync(staleResultPath, JSON.stringify([a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')]));
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(staleResultPath, past, past);

    const notBeforeMs = Date.now();
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath, noRun: true, notBeforeMs });
    check('21. 事前削除が効いていない場合: exitCode===1', exitCode === 1);
    check(
      '21. 事前削除が効いていない場合: RESULT_FILE_STALEとして拒否される',
      report.scriptErrors.some((e) => e.errorType === 'RESULT_FILE_STALE')
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 20b. --no-run モード: notBeforeMs が 0 や空文字列(数値変換で0になる、
//      Number('')===0)であってもERRORにする。0や負の値は "fresh" を無条件
//      に認めてしまう値であり、未指定と同じ危険を持つため、欠落と同じ扱いに
//      しなければならない(実際に --not-before "" を渡すとこの不具合が
//      再現することを本Phase中に確認し、修正した)。
// ---------------------------------------------------------------------------
(function test20b() {
  const apps = ['app-a', 'app-b', 'app-c'];
  for (const badValue of [0, '0', -5]) {
    const tmpRoot = buildNoRunFixtureRepo(apps, {});
    try {
      const baselinePath = writeBaseline(tmpRoot, baselineFixture());
      const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath, noRun: true, notBeforeMs: badValue });
      check(`20b. --no-run notBeforeMs=${JSON.stringify(badValue)}: exitCode===1`, exitCode === 1);
      check(
        `20b. --no-run notBeforeMs=${JSON.stringify(badValue)}: fatal.errorType===NOT_BEFORE_MS_MISSING`,
        report.fatal && report.fatal.errorType === 'NOT_BEFORE_MS_MISSING'
      );
    } finally {
      removeFixtureRepo(tmpRoot);
    }
  }
})();

// ---------------------------------------------------------------------------
// 22. 監査不完全時にRESOLVEDを誤判定しないこと（最重要の安全性修正）
//     baselineのfinding "duplicate-id:app-b:dup-old" はdetectedBy=['tier2']のみ。
//     tier2が今回クラッシュして一切確認できない場合、audit35-1側は元々その問題を
//     検出していないため、何もしなければ「解消した」と誤判定されてしまう。
// ---------------------------------------------------------------------------
(function test22() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a'), a35Entry('app-b'), a35Entry('app-c')] }, // never knew about dup-old
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { behavior: 'crash' }, // the ONLY source for dup-old
    'tools/accessibility-audit/tier3/static-audit.js': { data: { 'app-c': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(
      tmpRoot,
      baselineFixture({
        knownFindings: [
          { id: 'duplicate-id:app-b:dup-old', category: 'duplicate-id', app: 'app-b', detail: 'dup-old', detectedBy: ['tier2'] },
        ],
      })
    );
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('22. 監査不完全: exitCode===1 (tier2のERRORにより)', exitCode === 1);
    check(
      '22. 監査不完全: dup-oldがRESOLVEDに入らない',
      !report.findings.RESOLVED.some((f) => f.id === 'duplicate-id:app-b:dup-old')
    );
    check(
      '22. 監査不完全: dup-oldはunconfirmed=trueでKNOWNに残る',
      report.findings.KNOWN.some((f) => f.id === 'duplicate-id:app-b:dup-old' && f.unconfirmed === true)
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 23. 監査不完全時にTierカバレッジ縮小を誤判定しないこと
//     tier2がクラッシュした場合、baselineのtier2メンバーが「全員脱落した」ように
//     見えてしまってはならない。tier2Unavailable=trueとして区別し、
//     notCoveredByAnyTierも「比較不能(null)」にする。
// ---------------------------------------------------------------------------
(function test23() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: apps.map((a) => a35Entry(a)) },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { behavior: 'crash' },
    'tools/accessibility-audit/tier3/static-audit.js': { data: { 'app-c': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('23. Tier不完全: tier2Unavailable===true', report.coverageDiff.tier2Unavailable === true);
    check('23. Tier不完全: tier2Removedは空（誤った全脱落にしない）', report.coverageDiff.tier2Removed.length === 0);
    check('23. Tier不完全: notCoveredByAnyTierはnull（比較不能を明示）', report.coverageDiff.notCoveredByAnyTier === null);
    check(
      '23. Tier不完全: hasCoverageShrinkはtier2由来ではfalseのまま（ERROR自体でexit1は別途保証）',
      report.classification.hasCoverageShrink === false
    );
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// 24. 正常系との対比: 全Tier健全なら、件数が全く同じ状況でもNEWやエラーがなければ
//     exit 0 を維持する（23番の対照群、回帰確認用）
// ---------------------------------------------------------------------------
(function test24() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')] },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
    'tools/accessibility-audit/tier1/static-audit.js': { data: { 'app-a': tierEntry() } },
    'tools/accessibility-audit/tier2/static-audit.js': { data: { 'app-b': tierEntry() } },
    'tools/accessibility-audit/tier3/static-audit.js': { data: { 'app-c': tierEntry() } },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report, exitCode } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    check('24. 全Tier健全対照群: exitCode===0', exitCode === 0, 'got ' + exitCode);
    check('24. 全Tier健全対照群: tier2Unavailable===false', report.coverageDiff.tier2Unavailable === false);
    check('24. 全Tier健全対照群: notCoveredByAnyTierはnullでない', report.coverageDiff.notCoveredByAnyTier !== null);
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

// ---------------------------------------------------------------------------
// Extra: Markdown/JSON summary renderers don't throw, and contain the key
// sections the Phase spec requires.
// ---------------------------------------------------------------------------
(function testSummaryRendering() {
  const apps = ['app-a', 'app-b', 'app-c'];
  const tmpRoot = buildFixtureRepo(apps, {
    'tools/audit35-1/audit.js': { data: [a35Entry('app-a', { duplicateIds: ['dup-1'] }), a35Entry('app-b'), a35Entry('app-c')] },
    'tools/main-heading-audit/audit.js': { data: apps.map((a) => mhEntry(a)) },
  });
  try {
    const baselinePath = writeBaseline(tmpRoot, baselineFixture());
    const { report } = DC.evaluate({ repoRoot: tmpRoot, baselinePath });
    tryCheck('Summary: renderMarkdownSummary does not throw', () => {
      const md = DC.renderMarkdownSummary(report);
      assert.ok(md.includes('NEW'));
      assert.ok(md.includes('KNOWN'));
      assert.ok(md.includes('RESOLVED'));
      assert.ok(md.includes('SUCCESS'));
    });
    tryCheck('Summary: renderJsonSummary produces parseable JSON', () => {
      const parsed = JSON.parse(DC.renderJsonSummary(report));
      assert.strictEqual(typeof parsed.generatedAt, 'string');
    });
  } finally {
    removeFixtureRepo(tmpRoot);
  }
})();

console.log(`\n${pass}/${pass + fail} checks passed.`);
if (fail > 0) {
  console.log('FAILURES PRESENT.');
  process.exit(1);
}
console.log('ALL PASS.');
