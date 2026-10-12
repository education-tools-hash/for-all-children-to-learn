// DAQS Phase 3B: baseline diff-detection engine.
//
// Reads the output of the existing 7 static accessibility audit scripts
// (tools/audit35-1, tools/main-heading-audit, tools/accessibility-audit/tier{1,2,3},
// tools/settings-proxy-focus-audit -- none of which this file modifies) and
// compares the structured findings it can extract from them against
// tools/daqs/baseline.json (read-only). It never writes baseline.json itself;
// baseline updates are a separate, explicitly user-approved step outside this
// script.
//
// This script runs the 7 audit scripts itself (as child processes, exactly
// like a11y-audit.yml's own runScript helper does) rather than trusting
// whatever *-results.json files already happen to sit on disk. Three of the
// tier static-audit-results.json files are committed to the repository as
// historical snapshots, so a stale leftover file could otherwise be silently
// mistaken for this run's result; requiring every result file's mtime to be
// at or after this process's own start time closes that gap by construction.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SCHEMA_VERSION = 1;

// Structural list of the 7 target scripts (paths are not "problem IDs" or
// app names, so hardcoding this list is the same kind of structural
// reference a11y-audit.yml's own expectedFiles array already makes).
const EXPECTED_SCRIPTS = [
  'tools/audit35-1/audit.js',
  'tools/main-heading-audit/audit.js',
  'tools/main-heading-audit/body-structure.js',
  'tools/accessibility-audit/tier1/static-audit.js',
  'tools/accessibility-audit/tier2/static-audit.js',
  'tools/accessibility-audit/tier3/static-audit.js',
  'tools/settings-proxy-focus-audit/gap-fix-1-static-regression-test.js',
];

// Scripts that write a JSON result file this engine can extract identifiers
// from. body-structure.js (pure diagnostic dump) and the settings-proxy
// regression test (real exit-code PASS/FAIL, no JSON) intentionally have no
// entry here -- their outcome is judged from their own execution status only,
// exactly mirroring a11y-audit.yml's NOT COVERED / real-PASS treatment.
const RESULT_FILE_OF = {
  'tools/audit35-1/audit.js': 'tools/audit35-1/audit-results.json',
  'tools/main-heading-audit/audit.js': 'tools/main-heading-audit/audit-results.json',
  'tools/accessibility-audit/tier1/static-audit.js': 'tools/accessibility-audit/tier1/static-audit-results.json',
  'tools/accessibility-audit/tier2/static-audit.js': 'tools/accessibility-audit/tier2/static-audit-results.json',
  'tools/accessibility-audit/tier3/static-audit.js': 'tools/accessibility-audit/tier3/static-audit-results.json',
};

const TIER_SCRIPT_TO_NAME = {
  'tools/accessibility-audit/tier1/static-audit.js': 'tier1',
  'tools/accessibility-audit/tier2/static-audit.js': 'tier2',
  'tools/accessibility-audit/tier3/static-audit.js': 'tier3',
};

// Short "source" names as they appear in a finding's detectedBy[], keyed by
// the script path that produces them. Used to know, per baseline finding,
// whether every script that originally detected it actually ran healthily
// *this* run before ever concluding the finding is RESOLVED.
const SOURCE_NAME_OF = {
  'tools/audit35-1/audit.js': 'audit35-1',
  'tools/main-heading-audit/audit.js': 'main-heading-audit',
  'tools/accessibility-audit/tier1/static-audit.js': 'tier1',
  'tools/accessibility-audit/tier2/static-audit.js': 'tier2',
  'tools/accessibility-audit/tier3/static-audit.js': 'tier3',
};

// Scripts diff-check.js relies on when it does NOT run the audits itself
// (--no-run / integrated mode): exactly the 5 that produce a JSON result
// file. body-structure.js and the settings-proxy regression test are, in
// that mode, entirely the existing a11y-audit.yml step's responsibility --
// see the "--no-run" section of evaluate() below.
const JSON_BEARING_SCRIPTS = Object.keys(RESULT_FILE_OF);

// Result-file mtimes are compared against a "not before" reference instead
// of being trusted on their own (see readResultFile). Filesystems with
// coarse mtime resolution (some report only whole seconds) could otherwise
// make a genuinely fresh file look stale by a few hundred milliseconds, so a
// small grace window is subtracted from the reference before comparing.
const FRESHNESS_TOLERANCE_MS = 1000;

function mkError(errorType, message, extra) {
  return Object.assign({ ok: false, errorType, message }, extra || {});
}

function mkFinding(category, app, detail, sourceScript) {
  const id = detail !== null && detail !== undefined ? `${category}:${app}:${detail}` : `${category}:${app}`;
  return { id, category, app, detail: detail === undefined ? null : detail, detectedBy: [sourceScript] };
}

// ---------------------------------------------------------------------------
// baseline.json loading (read-only, strict validation)
// ---------------------------------------------------------------------------

function loadBaseline(baselinePath) {
  if (!fs.existsSync(baselinePath)) {
    return mkError('BASELINE_MISSING', `baseline file not found: ${baselinePath}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(baselinePath, 'utf-8');
  } catch (e) {
    return mkError('BASELINE_READ_FAILED', e.message);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return mkError('BASELINE_INVALID_JSON', e.message);
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return mkError('BASELINE_MALFORMED', 'baseline.json must be a JSON object');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    return mkError(
      'BASELINE_SCHEMA_MISMATCH',
      `baseline.json schemaVersion=${JSON.stringify(data.schemaVersion)}, expected ${SCHEMA_VERSION}`
    );
  }
  if (!Array.isArray(data.appsAtBaseline) || !data.appsAtBaseline.every((x) => typeof x === 'string')) {
    return mkError('BASELINE_MALFORMED', 'appsAtBaseline must be an array of strings');
  }
  const tc = data.tierCoverageAtBaseline;
  if (
    typeof tc !== 'object' || tc === null ||
    !Array.isArray(tc.tier1) || !Array.isArray(tc.tier2) || !Array.isArray(tc.tier3)
  ) {
    return mkError('BASELINE_MALFORMED', 'tierCoverageAtBaseline.{tier1,tier2,tier3} must be arrays');
  }
  if (!Array.isArray(data.knownFindings)) {
    return mkError('BASELINE_MALFORMED', 'knownFindings must be an array');
  }
  for (const f of data.knownFindings) {
    if (
      typeof f !== 'object' || f === null ||
      typeof f.id !== 'string' || typeof f.category !== 'string' || typeof f.app !== 'string' ||
      !Array.isArray(f.detectedBy)
    ) {
      return mkError('BASELINE_MALFORMED', `knownFindings entry malformed: ${JSON.stringify(f)}`);
    }
  }
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// apps-data.json loading
// ---------------------------------------------------------------------------

function loadAppsData(repoRoot) {
  const p = path.join(repoRoot, 'apps-data.json');
  if (!fs.existsSync(p)) return mkError('APPS_DATA_MISSING', `apps-data.json not found: ${p}`);
  let raw, data;
  try {
    raw = fs.readFileSync(p, 'utf-8');
  } catch (e) {
    return mkError('APPS_DATA_READ_FAILED', e.message);
  }
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return mkError('APPS_DATA_INVALID_JSON', e.message);
  }
  if (!Array.isArray(data) || data.length === 0) {
    return mkError('APPS_DATA_MALFORMED', 'apps-data.json must be a non-empty array');
  }
  for (const a of data) {
    if (typeof a !== 'object' || a === null || typeof a.filename !== 'string' || a.filename === '') {
      return mkError('APPS_DATA_MALFORMED', `apps-data.json entry missing a valid filename: ${JSON.stringify(a)}`);
    }
  }
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Running the 7 scripts and reading their result files
// ---------------------------------------------------------------------------

function runAudits(repoRoot) {
  const runStartedAtMs = Date.now();
  const scriptResults = [];
  for (const rel of EXPECTED_SCRIPTS) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      scriptResults.push({ script: rel, ok: false, errorType: 'SCRIPT_MISSING' });
      continue;
    }
    try {
      const stdout = execFileSync('node', [abs], {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      scriptResults.push({ script: rel, ok: true, status: 0, stdout });
    } catch (e) {
      scriptResults.push({
        script: rel,
        ok: false,
        errorType: 'SCRIPT_CRASHED',
        status: typeof e.status === 'number' ? e.status : null,
        message: e.message,
      });
    }
  }
  return { runStartedAtMs, scriptResults };
}

function readResultFile(absPath, notBeforeMs) {
  if (!fs.existsSync(absPath)) return mkError('RESULT_FILE_MISSING', `result file not found: ${absPath}`);
  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch (e) {
    return mkError('RESULT_FILE_STAT_FAILED', e.message);
  }
  if (stat.mtimeMs < notBeforeMs - FRESHNESS_TOLERANCE_MS) {
    return mkError(
      'RESULT_FILE_STALE',
      `result file predates this run (mtime=${new Date(stat.mtimeMs).toISOString()}, not-before=${new Date(notBeforeMs).toISOString()}) -- was not regenerated`
    );
  }
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf-8');
  } catch (e) {
    return mkError('RESULT_FILE_READ_FAILED', e.message);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return mkError('RESULT_FILE_INVALID_JSON', e.message);
  }
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Per-script finding extractors. Each returns { ok:true, findings:[...] , ...}
// or { ok:false, errorType, message }. None hardcode app names or problem
// IDs -- they walk whatever the result data actually contains.
// ---------------------------------------------------------------------------

const AUDIT35_BOOLEAN_FIELDS = [
  ['lockMismatch', 'lock-mismatch'],
  ['fsMismatch', 'fs-mismatch'],
  ['recordNavMismatch', 'record-nav-mismatch'],
  ['themeColorDuplicate', 'theme-color-duplicate'],
  ['switchMismatch', 'switch-mismatch'],
  ['gazeMismatch', 'gaze-mismatch'],
  ['supporterOnlyLeaksIntoScan', 'supporter-only-leak'],
];

function extractFromAudit35(data) {
  if (!Array.isArray(data)) return mkError('UNEXPECTED_SHAPE', 'audit35-1 result must be an array');
  const findings = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null || typeof entry.filename !== 'string') {
      return mkError('MISSING_FIELD', 'audit35-1 entry missing filename');
    }
    const app = entry.filename;
    if (entry.appFileExists === false) {
      findings.push(mkFinding('app-file-missing', app, null, 'audit35-1'));
      continue; // other fields are not populated when the html file is absent
    }
    if ('duplicateIds' in entry) {
      if (!Array.isArray(entry.duplicateIds)) {
        return mkError('WRONG_TYPE', `audit35-1:${app}.duplicateIds must be an array`);
      }
      for (const dup of entry.duplicateIds) findings.push(mkFinding('duplicate-id', app, String(dup), 'audit35-1'));
    }
    for (const [field, category] of AUDIT35_BOOLEAN_FIELDS) {
      if (!(field in entry)) continue;
      if (typeof entry[field] !== 'boolean') {
        return mkError('WRONG_TYPE', `audit35-1:${app}.${field} must be a boolean`);
      }
      if (entry[field]) findings.push(mkFinding(category, app, null, 'audit35-1'));
    }
  }
  return { ok: true, findings };
}

function extractFromMainHeadingAudit(data) {
  if (!Array.isArray(data)) return mkError('UNEXPECTED_SHAPE', 'main-heading-audit result must be an array');
  const findings = [];
  const notFoundApps = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null || typeof entry.filename !== 'string') {
      return mkError('MISSING_FIELD', 'main-heading-audit entry missing filename');
    }
    const app = entry.filename;
    if (entry.error) {
      notFoundApps.push(app);
      continue; // e.g. "file not found" -- an integrity ERROR, not a baseline finding
    }
    if (typeof entry.mainCount !== 'number' || typeof entry.h1Count !== 'number') {
      return mkError('MISSING_FIELD', `main-heading-audit:${app} missing mainCount/h1Count (or wrong type)`);
    }
    if (entry.mainCount === 0) findings.push(mkFinding('main-missing', app, null, 'main-heading-audit'));
    if (entry.h1Count === 0) findings.push(mkFinding('h1-missing', app, null, 'main-heading-audit'));
    if (entry.h1Count > 1) findings.push(mkFinding('h1-excess', app, null, 'main-heading-audit'));
  }
  return { ok: true, findings, notFoundApps };
}

const TIER_ARRAY_FIELDS = [
  ['duplicateIds', 'duplicate-id'],
  ['brokenAriaRefs', 'broken-aria-ref'],
  ['tabindexAnomalies', 'tabindex-anomaly'],
];

function extractFromTier(data, tierName) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return mkError('UNEXPECTED_SHAPE', `${tierName} result must be an object keyed by app filename`);
  }
  const findings = [];
  const apps = Object.keys(data);
  for (const app of apps) {
    const entry = data[app];
    if (typeof entry !== 'object' || entry === null) {
      return mkError('UNEXPECTED_SHAPE', `${tierName}:${app} entry must be an object`);
    }
    for (const [field, category] of TIER_ARRAY_FIELDS) {
      if (!(field in entry)) return mkError('MISSING_FIELD', `${tierName}:${app}.${field} missing`);
      if (!Array.isArray(entry[field])) return mkError('WRONG_TYPE', `${tierName}:${app}.${field} must be an array`);
      for (const v of entry[field]) findings.push(mkFinding(category, app, String(v), tierName));
    }
  }
  return { ok: true, findings, apps };
}

// ---------------------------------------------------------------------------
// Merge (dedup) -- order-independent, detectedBy accumulated and sorted so
// output never depends on JSON key order, script execution order, or array
// element order.
// ---------------------------------------------------------------------------

function mergeFindings(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const f of list) {
      if (map.has(f.id)) {
        const existing = map.get(f.id);
        for (const s of f.detectedBy) if (!existing.detectedBy.includes(s)) existing.detectedBy.push(s);
      } else {
        map.set(f.id, { id: f.id, category: f.category, app: f.app, detail: f.detail, detectedBy: [...f.detectedBy] });
      }
    }
  }
  return [...map.values()]
    .map((f) => ({ ...f, detectedBy: [...f.detectedBy].sort() }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Diffing against baseline
// ---------------------------------------------------------------------------

// healthySources: a Set of short source names (see SOURCE_NAME_OF) whose
// script ran AND whose result was read/parsed/extracted successfully this
// run. A baseline finding is only ever concluded RESOLVED when every script
// that originally detected it (its own detectedBy[]) is in this set --
// otherwise we simply have no reliable current data for it, so it stays
// KNOWN (flagged unconfirmed) rather than being reported as an improvement
// that may not have happened. This is what keeps an unrelated script's
// ERROR from making a *different*, unrelated finding look resolved.
function diffFindings(currentFindings, baselineKnownFindings, healthySources) {
  const healthy = healthySources || new Set();
  const currentIds = new Set(currentFindings.map((f) => f.id));
  const baselineIds = new Set(baselineKnownFindings.map((f) => f.id));
  const NEW = currentFindings.filter((f) => !baselineIds.has(f.id));
  const KNOWN = currentFindings.filter((f) => baselineIds.has(f.id));
  const RESOLVED = [];
  for (const bf of baselineKnownFindings) {
    if (currentIds.has(bf.id)) continue; // still present -> already in KNOWN above
    const allSourcesHealthy = bf.detectedBy.every((s) => healthy.has(s));
    if (allSourcesHealthy) {
      RESOLVED.push(bf);
    } else {
      // Can't confirm it's gone -- the only script(s) that could have
      // re-detected it did not run healthily this run. Keep it as KNOWN
      // (unresolved), not RESOLVED.
      KNOWN.push(Object.assign({}, bf, { unconfirmed: true }));
    }
  }
  return { NEW, KNOWN, RESOLVED };
}

// tierHealth: { tier1: bool, tier2: bool, tier3: bool } -- whether each
// tier's script ran and its result was read successfully this run. A tier
// that is not healthy contributes an empty (not "zero apps") set: its
// coverage comparison is reported as unavailable rather than as a (possibly
// entirely false) mass removal of every app that tier used to cover.
function computeCoverage(appsData, tierAppsByName, tierHealth) {
  const health = tierHealth || { tier1: true, tier2: true, tier3: true };
  const allApps = appsData.map((a) => a.filename).slice().sort();
  const tier1 = health.tier1 ? (tierAppsByName.tier1 || []).slice().sort() : [];
  const tier2 = health.tier2 ? (tierAppsByName.tier2 || []).slice().sort() : [];
  const tier3 = health.tier3 ? (tierAppsByName.tier3 || []).slice().sort() : [];
  const allTiersAvailable = !!(health.tier1 && health.tier2 && health.tier3);
  const union = new Set([...tier1, ...tier2, ...tier3]);
  const notCoveredByAnyTier = allTiersAvailable ? allApps.filter((a) => !union.has(a)) : null;
  return { allApps, tier1, tier2, tier3, tierAvailable: health, allTiersAvailable, notCoveredByAnyTier };
}

function setDiff(a, b) {
  const bSet = new Set(b);
  return a.filter((x) => !bSet.has(x)).slice().sort();
}

function diffCoverage(current, baseline) {
  function tierDiff(tierName, currentApps) {
    if (!current.tierAvailable[tierName]) {
      return { added: [], removed: [], unavailable: true };
    }
    return {
      added: setDiff(currentApps, baseline.tierCoverageAtBaseline[tierName]),
      removed: setDiff(baseline.tierCoverageAtBaseline[tierName], currentApps),
      unavailable: false,
    };
  }
  const t1 = tierDiff('tier1', current.tier1);
  const t2 = tierDiff('tier2', current.tier2);
  const t3 = tierDiff('tier3', current.tier3);
  return {
    appsAdded: setDiff(current.allApps, baseline.appsAtBaseline),
    appsRemoved: setDiff(baseline.appsAtBaseline, current.allApps),
    tier1Added: t1.added,
    tier1Removed: t1.removed,
    tier1Unavailable: t1.unavailable,
    tier2Added: t2.added,
    tier2Removed: t2.removed,
    tier2Unavailable: t2.unavailable,
    tier3Added: t3.added,
    tier3Removed: t3.removed,
    tier3Unavailable: t3.unavailable,
    notCoveredByAnyTier: current.notCoveredByAnyTier, // null when any tier is unavailable this run
  };
}

// ---------------------------------------------------------------------------
// Main evaluation pipeline
// ---------------------------------------------------------------------------

// Builds the list of { script, ok } entries evaluate() walks, without
// executing anything, for --no-run / integrated mode: the existing
// a11y-audit.yml step is solely responsible for having run all 7 scripts
// (including the 2 that produce no JSON) and for ERROR-ing out if any of
// them crashed or were missing; this engine only concerns itself with the
// 5 that produce a JSON result file it can read.
function noRunScriptResults() {
  return JSON_BEARING_SCRIPTS.map((script) => ({ script, ok: true }));
}

function evaluate({ repoRoot, baselinePath, noRun, notBeforeMs }) {
  const scriptErrors = [];
  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    baselinePath,
    mode: noRun ? 'no-run' : 'standalone',
  };

  const baselineResult = loadBaseline(baselinePath);
  if (!baselineResult.ok) {
    return {
      report: Object.assign(report, {
        fatal: { errorType: baselineResult.errorType, message: baselineResult.message },
      }),
      exitCode: 1,
    };
  }
  const baseline = baselineResult.data;
  report.baselineSchemaVersion = baseline.schemaVersion;
  report.baselineCommit = baseline.baselineCommit || null;

  if (noRun && !(Number.isFinite(Number(notBeforeMs)) && Number(notBeforeMs) > 0)) {
    // Never guess a freshness reference: without one, a stale leftover
    // result file could pass silently. Fail loudly instead. Deliberately
    // stricter than "is it a number": undefined/null/empty-string/0/negative
    // are all rejected here too, since Number('') and Number(undefined) do
    // NOT both throw (Number('') is 0, not NaN) and a 0-or-negative "not
    // before" would make the freshness check below accept literally any
    // file, silently defeating it instead of refusing to guess.
    return {
      report: Object.assign(report, {
        fatal: {
          errorType: 'NOT_BEFORE_MS_MISSING',
          message: '--no-run requires --not-before (or DAQS_NOT_BEFORE_MS) to judge result-file freshness; refusing to guess.',
        },
      }),
      exitCode: 1,
    };
  }

  const appsDataResult = loadAppsData(repoRoot);
  if (!appsDataResult.ok) {
    scriptErrors.push({ source: 'apps-data.json', errorType: appsDataResult.errorType, message: appsDataResult.message });
  }

  let runStartedAtMs, scriptResults;
  if (noRun) {
    runStartedAtMs = Number(notBeforeMs);
    scriptResults = noRunScriptResults();
  } else {
    const ra = runAudits(repoRoot);
    runStartedAtMs = ra.runStartedAtMs;
    scriptResults = ra.scriptResults;
  }

  report.commitSha = (function () {
    try {
      return execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch (e) {
      return null; // repoRoot is not a git checkout (e.g. a git-archive / fixture copy) -- not fatal
    }
  })();

  const findingLists = [];
  const tierAppsByName = {};
  const healthySources = new Set();
  const tierHealth = { tier1: false, tier2: false, tier3: false };
  let notFoundApps = [];

  for (const sr of scriptResults) {
    if (!sr.ok) {
      scriptErrors.push({ source: sr.script, errorType: sr.errorType, message: sr.message || null, status: sr.status });
      continue;
    }
    const resultFileRel = RESULT_FILE_OF[sr.script];
    if (!resultFileRel) continue; // body-structure.js / settings-proxy: execution-status only, no JSON

    const absResultPath = path.join(repoRoot, resultFileRel);
    const rf = readResultFile(absResultPath, runStartedAtMs);
    if (!rf.ok) {
      scriptErrors.push({ source: resultFileRel, errorType: rf.errorType, message: rf.message });
      continue;
    }

    let extracted;
    if (sr.script === 'tools/audit35-1/audit.js') {
      extracted = extractFromAudit35(rf.data);
    } else if (sr.script === 'tools/main-heading-audit/audit.js') {
      extracted = extractFromMainHeadingAudit(rf.data);
      if (extracted.ok) notFoundApps = extracted.notFoundApps;
    } else if (TIER_SCRIPT_TO_NAME[sr.script]) {
      const tierName = TIER_SCRIPT_TO_NAME[sr.script];
      extracted = extractFromTier(rf.data, tierName);
      if (extracted.ok) tierAppsByName[tierName] = extracted.apps;
    } else {
      continue;
    }

    if (!extracted.ok) {
      scriptErrors.push({ source: resultFileRel, errorType: extracted.errorType, message: extracted.message });
      continue;
    }
    findingLists.push(extracted.findings);
    healthySources.add(SOURCE_NAME_OF[sr.script]);
    if (TIER_SCRIPT_TO_NAME[sr.script]) tierHealth[TIER_SCRIPT_TO_NAME[sr.script]] = true;
  }

  if (notFoundApps.length > 0) {
    scriptErrors.push({
      source: 'tools/main-heading-audit/audit.js',
      errorType: 'APP_FILE_NOT_FOUND',
      message: `${notFoundApps.length} app(s) reported as file-not-found: ${notFoundApps.join(', ')}`,
    });
  }

  const currentFindings = mergeFindings(findingLists);
  const findingsDiff = diffFindings(currentFindings, baseline.knownFindings, healthySources);

  let coverageDiff = null;
  if (appsDataResult.ok) {
    const currentCoverage = computeCoverage(appsDataResult.data, tierAppsByName, tierHealth);
    coverageDiff = diffCoverage(currentCoverage, baseline);
    report.currentCoverage = currentCoverage;
  }

  const hasError = scriptErrors.length > 0;
  const hasNew = findingsDiff.NEW.length > 0;
  const hasCoverageShrink =
    !!coverageDiff &&
    (coverageDiff.appsRemoved.length > 0 ||
      (!coverageDiff.tier1Unavailable && coverageDiff.tier1Removed.length > 0) ||
      (!coverageDiff.tier2Unavailable && coverageDiff.tier2Removed.length > 0) ||
      (!coverageDiff.tier3Unavailable && coverageDiff.tier3Removed.length > 0));

  const exitCode = hasError || hasNew || hasCoverageShrink ? 1 : 0;

  report.scriptErrors = scriptErrors;
  report.findings = { current: currentFindings, NEW: findingsDiff.NEW, KNOWN: findingsDiff.KNOWN, RESOLVED: findingsDiff.RESOLVED };
  report.coverageDiff = coverageDiff;
  report.classification = { hasError, hasNew, hasCoverageShrink, exitCode };

  return { report, exitCode };
}

// ---------------------------------------------------------------------------
// Output rendering
// ---------------------------------------------------------------------------

function renderReasons(classification, report) {
  const reasons = [];
  if (classification.hasError) reasons.push(`ERROR ${report.scriptErrors.length}件`);
  if (classification.hasNew) reasons.push(`NEW ${report.findings.NEW.length}件`);
  if (classification.hasCoverageShrink) reasons.push('監査カバレッジの縮小（アプリ削除またはTier対象脱落）');
  return reasons.length > 0 ? reasons.join(' / ') : 'なし（既知のFINDINGSのみ、または完全にクリーン）';
}

function renderMarkdownSummary(report) {
  const lines = [];
  lines.push('## Donomana Quality Audit — Baseline Diff Check (DAQS Phase 3B)');
  lines.push('');
  if (report.fatal) {
    lines.push(`- ❌ **致命的エラー**: baseline.json を読み込めませんでした（${report.fatal.errorType}）`);
    lines.push(`- 詳細: \`${report.fatal.message}\``);
    lines.push('');
    lines.push('> ⚠️ baseline との比較は実施できませんでした。NEW/KNOWN/RESOLVED の判定は不能です。');
    return lines.join('\n');
  }

  lines.push(`- 実行日時 (UTC): \`${report.generatedAt}\``);
  lines.push(`- 対象コミット SHA: \`${report.commitSha || '(取得不可)'}\``);
  lines.push(`- baseline schemaVersion: \`${report.baselineSchemaVersion}\` / baseline対象コミット: \`${report.baselineCommit || '(不明)'}\``);
  lines.push('');
  lines.push(
    '> ⚠️ **このチェックがSUCCESS（exit 0）で終了しても、アクセシビリティ上の問題が存在しないことを意味しません。** ' +
      'KNOWN（既知）として記録されている問題は未解決のまま残っています。'
  );
  lines.push('');

  const { NEW, KNOWN, RESOLVED } = report.findings;
  const confirmedKnown = KNOWN.filter((f) => !f.unconfirmed);
  const unconfirmedKnown = KNOWN.filter((f) => f.unconfirmed);
  lines.push(`### 判定結果: 通知対象理由 = ${renderReasons(report.classification, report)}`);
  lines.push('');
  lines.push(`- 🆕 NEW（新規）: ${NEW.length}件`);
  for (const f of NEW) lines.push(`  - \`${f.id}\`（検出元: ${f.detectedBy.join(', ')}）`);
  lines.push(`- 📋 KNOWN（既知、baseline登録済み）: ${KNOWN.length}件`);
  for (const f of confirmedKnown) lines.push(`  - \`${f.id}\`（検出元: ${f.detectedBy.join(', ')}）`);
  for (const f of unconfirmedKnown) {
    lines.push(`  - \`${f.id}\` — ⚠️ 今回は確認できず（検出元スクリプトがERROR）。解消とは判定していません。`);
  }
  lines.push(`- ✅ RESOLVED（解消、確認済み）: ${RESOLVED.length}件`);
  for (const f of RESOLVED) lines.push(`  - \`${f.id}\``);
  lines.push(`- ❌ ERROR: ${report.scriptErrors.length}件`);
  for (const e of report.scriptErrors) lines.push(`  - \`${e.source}\`: ${e.errorType}${e.message ? ' — ' + e.message : ''}`);
  lines.push('');

  if (report.coverageDiff) {
    const cd = report.coverageDiff;
    lines.push('### カバレッジ変化');
    lines.push(`- 新規追加アプリ（情報、通知対象外）: ${cd.appsAdded.length > 0 ? cd.appsAdded.join(', ') : '該当なし'}`);
    lines.push(`- 削除されたアプリ（通知対象）: ${cd.appsRemoved.length > 0 ? cd.appsRemoved.join(', ') : '該当なし'}`);
    for (const t of ['tier1', 'tier2', 'tier3']) {
      if (cd[`${t}Unavailable`]) {
        lines.push(`- ${t}: 今回は比較不能（検出元スクリプトがERROR。誤ってカバレッジ縮小扱いにはしていません）`);
      } else {
        lines.push(`- ${t} 追加: ${cd[`${t}Added`].length > 0 ? cd[`${t}Added`].join(', ') : '該当なし'} / ${t} 脱落（通知対象）: ${cd[`${t}Removed`].length > 0 ? cd[`${t}Removed`].join(', ') : '該当なし'}`);
      }
    }
    lines.push(
      `- Tier監査対象外アプリ（現在。固定文字列ではなく動的算出）: ${
        cd.notCoveredByAnyTier === null ? '今回は比較不能（いずれかのTierがERRORのため）' : cd.notCoveredByAnyTier.length > 0 ? cd.notCoveredByAnyTier.join(', ') : '該当なし'
      }`
    );
    lines.push('');
  } else {
    lines.push('### カバレッジ変化');
    lines.push('- apps-data.json を読み取れなかったため、カバレッジ比較は実施できませんでした（ERROR参照）。');
    lines.push('');
  }

  lines.push('**注記**: NEW/KNOWN/RESOLVEDの判定は、既存7監査スクリプトが生成した結果のうち、構造化できるフィールド（重複id・main/h1欠落・ARIA参照欠落・tabindex異常など）のみを対象とします。body-structure.js（診断専用）と settings-proxy-focus-audit（実行成功/失敗のみ）はこの識別子diffの対象外で、実行エラーのみERRORとして扱われます。');

  return lines.join('\n');
}

function renderJsonSummary(report) {
  return JSON.stringify(report, null, 2);
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function main() {
  const repoRoot = process.argv.includes('--repo-root')
    ? process.argv[process.argv.indexOf('--repo-root') + 1]
    : path.resolve(__dirname, '..', '..');
  const baselinePath = process.argv.includes('--baseline')
    ? process.argv[process.argv.indexOf('--baseline') + 1]
    : path.join(repoRoot, 'tools', 'daqs', 'baseline.json');
  const noRun = process.argv.includes('--no-run');
  const notBeforeArg = process.argv.includes('--not-before') ? process.argv[process.argv.indexOf('--not-before') + 1] : '';
  const notBeforeMs = notBeforeArg ? Number(notBeforeArg) : process.env.DAQS_NOT_BEFORE_MS ? Number(process.env.DAQS_NOT_BEFORE_MS) : undefined;

  const { report, exitCode } = evaluate({ repoRoot, baselinePath, noRun, notBeforeMs });

  const jsonOutPath = process.argv.includes('--json-out')
    ? process.argv[process.argv.indexOf('--json-out') + 1]
    : null;
  if (jsonOutPath) {
    fs.writeFileSync(jsonOutPath, renderJsonSummary(report), 'utf-8');
  } else {
    console.log(renderJsonSummary(report));
  }

  const markdown = renderMarkdownSummary(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  } else {
    console.log('\n' + markdown);
  }

  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  SCHEMA_VERSION,
  EXPECTED_SCRIPTS,
  RESULT_FILE_OF,
  JSON_BEARING_SCRIPTS,
  SOURCE_NAME_OF,
  FRESHNESS_TOLERANCE_MS,
  loadBaseline,
  loadAppsData,
  runAudits,
  readResultFile,
  extractFromAudit35,
  extractFromMainHeadingAudit,
  extractFromTier,
  mergeFindings,
  diffFindings,
  computeCoverage,
  diffCoverage,
  evaluate,
  renderMarkdownSummary,
  renderJsonSummary,
};
