// Phase AUDIT-35-1: 全35アプリ統合監査 read-only audit script.
// Static/grep-based analysis only. Does not modify any file under repo root.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
process.chdir(ROOT);

const apps = require(path.join(ROOT, 'apps-data.json'));
const genSrc = fs.readFileSync(path.join(ROOT, 'generate.js'), 'utf-8');

function extractSet(varName) {
  const re = new RegExp(varName + '\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)');
  const m = genSrc.match(re);
  if (!m) return null;
  const body = m[1];
  const items = [...body.matchAll(/'([^']+)'/g)].map(x => x[1]);
  return new Set(items);
}

const FS_SKIP_APPS = extractSet('FS_SKIP_APPS');
const LOCK_SKIP_APPS = extractSet('LOCK_SKIP_APPS');
const SR_SKIP_APPS = extractSet('SR_SKIP_APPS');
const RECORD_APPS = extractSet('LEARNING_RECORD_FOUNDATION_APPS');

console.log('=== Source of Truth sets extracted from generate.js ===');
console.log('FS_SKIP_APPS:', [...FS_SKIP_APPS].join(', '));
console.log('LOCK_SKIP_APPS:', [...LOCK_SKIP_APPS].join(', '));
console.log('SR_SKIP_APPS:', [...SR_SKIP_APPS].join(', '));
console.log('LEARNING_RECORD_FOUNDATION_APPS (' + RECORD_APPS.size + '):', [...RECORD_APPS].join(', '));

const results = [];

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

function findDuplicateIds(html) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Map();
  const dups = new Set();
  for (const id of ids) {
    seen.set(id, (seen.get(id) || 0) + 1);
    if (seen.get(id) > 1) dups.add(id);
  }
  return [...dups];
}

function findThemeColors(html) {
  return [...html.matchAll(/<meta name="theme-color"[^>]*content="([^"]*)"[^>]*>/g)].map(m => m[1]);
}

function findExternalDeps(html) {
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  const links = [...html.matchAll(/<link[^>]*\shref="(https?:\/\/[^"]+)"[^>]*>/g)].map(m => m[1]);
  return { scripts, links };
}

function findLocalStorageKeys(html) {
  const literalKeys = new Set([...html.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
  const usesPrefixVar = /localStorage\.(?:getItem|setItem|removeItem)\(\s*P\s*\+/.test(html);
  return { literalKeys: [...literalKeys], usesPrefixVar };
}

for (const app of apps) {
  const fname = `${app.filename}.html`;
  const detailFname = path.join('app-details', `${app.filename}-detail.html`);
  const html = readIfExists(fname);
  const detailHtml = readIfExists(detailFname);

  const entry = {
    filename: app.filename,
    title: app.title,
    category: app.category,
    declaredInput: app.input || [],
    appFileExists: !!html,
    detailFileExists: !!detailHtml,
  };

  if (html) {
    entry.hasHomeBtn = html.includes('id="donomanaHomeBtn"');
    entry.hasA11yBtn = html.includes('id="donomanaA11yBtn"');
    entry.hasLockBtn = html.includes('id="donomanaLockBtn"');
    entry.hasFsBtn = html.includes('id="donomanaFsBtn"');
    entry.hasRecordNavBtn = html.includes('id="donomanaRecordNavBtn"');
    entry.expectLock = !LOCK_SKIP_APPS.has(app.filename);
    entry.expectFs = !FS_SKIP_APPS.has(app.filename);
    entry.expectRecordNav = RECORD_APPS.has(app.filename);
    entry.expectSR = !SR_SKIP_APPS.has(app.filename);

    entry.lockMismatch = entry.hasLockBtn !== entry.expectLock;
    entry.fsMismatch = entry.hasFsBtn !== entry.expectFs;
    entry.recordNavMismatch = entry.hasRecordNavBtn !== entry.expectRecordNav;

    entry.duplicateIds = findDuplicateIds(html);
    entry.themeColors = findThemeColors(html);
    entry.themeColorDuplicate = entry.themeColors.length > 1;
    entry.externalDeps = findExternalDeps(html);
    entry.localStorage = findLocalStorageKeys(html);

    entry.dataScanCount = (html.match(/data-scan="/g) || []).length;
    entry.scannableClassCount = (html.match(/class="[^"]*\bscannable\b/g) || []).length;
    entry.hasSwitchScanImpl = /startSwitchScan|switchScanItems|data-scan=/.test(html);
    entry.declaresSwitchInput = (app.input || []).includes('switch');
    entry.switchMismatch = entry.declaresSwitchInput && !entry.hasSwitchScanImpl;

    entry.hasGazeImpl = /gaze|Gaze|dwell|視線/.test(html);
    entry.declaresGazeInput = (app.input || []).includes('gaze');
    entry.gazeMismatch = entry.declaresGazeInput && !entry.hasGazeImpl;

    entry.hasKeyboardHandling = /addEventListener\(['"]keydown['"]/.test(html);
    entry.declaresKeyboardInput = (app.input || []).includes('keyboard');

    entry.supporterOnlyCount = (html.match(/data-supporter-only="true"/g) || []).length;
    // check supporter-only nodes are NOT also scannable/data-scan (should be excluded from scan)
    const supporterOnlyBlocks = [...html.matchAll(/<[^>]*data-supporter-only="true"[^>]*>/g)].map(m => m[0]);
    entry.supporterOnlyLeaksIntoScan = supporterOnlyBlocks.some(b => /data-scan=|class="[^"]*\bscannable\b/.test(b));

    entry.hasAudio = /<audio|new Audio\(|AudioContext/.test(html);
    entry.hasManifestLink = /<link rel="manifest"/.test(html);
    entry.hasSwRegister = /serviceWorker\.register/.test(html);

    entry.hasMain = /<main[\s>]/.test(html);
    entry.headingLevels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
  }

  if (detailHtml) {
    entry.detailLinksToApp = detailHtml.includes(`${app.filename}.html`);
    entry.detailLinksToTop = /href="\.\.\/(index\.html|app-intro\.html)?"/.test(detailHtml) || detailHtml.includes('app-intro.html') || detailHtml.includes('../index.html');
    entry.detailHasRecordNav = detailHtml.includes('donomanaRecordNavBtn') || detailHtml.includes('学習のきろく');
  }

  results.push(entry);
}

fs.writeFileSync(path.join(__dirname, 'audit-results.json'), JSON.stringify(results, null, 2), 'utf-8');
console.log('\n=== wrote audit-results.json (' + results.length + ' apps) ===');
