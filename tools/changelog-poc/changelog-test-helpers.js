// Shared helpers for the tools/changelog-poc tests (Phase CHANGELOG-POC-DATA-INDEPENDENT-1).
//
// Purpose: let the two changelog tests derive every expected value (item counts, month counts, the「最新3件」order,
// group sizes and their original texts) from the CURRENT MANUAL_CHANGELOG / generateChangelog output instead of
// hard-coding the numbers of one particular day. Adding a changelog entry must not break the tests; a real
// regression in generate.js / index.html must still fail them.
//
// Nothing here writes to disk. The changelog code is evaluated straight out of generate.js (the real code, not a
// copy), on a fresh MANUAL_CHANGELOG each time, so a test can mutate its own copy without touching the real data.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'generate.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-data.json'), 'utf8'));
const APPS = Array.isArray(DATA) ? DATA : DATA.apps;
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// The historical fact the tests keep checking: several 2026-11-12 りんごポットン entries render as one group.
const HISTORICAL = { date: '2026-11-12', app: 'ringo-potton-app', head: '「りんごポットン」を更新しました' };

function section(start, end) {
  const s = SRC.indexOf(start); const e = SRC.indexOf(end, s);
  if (s === -1 || e === -1) throw new Error('generate.js section not found: ' + start);
  return SRC.slice(s, e);
}
// MANUAL_CHANGELOG .. updateChangelog (inclusive): MANUAL_CHANGELOG, formatDateJP, APP_NAME_ALIASES,
// extractLeadingAppNames, generateChangelog, updateChangelog.
const UPDATE_START = SRC.indexOf('function updateChangelog');
const UPDATE_END = SRC.indexOf('\n}\n', UPDATE_START);
if (UPDATE_START === -1 || UPDATE_END === -1) throw new Error('generate.js updateChangelog not found');
const CODE = [
  section('const MANUAL_CHANGELOG = [', 'function updateChangelog'),
  SRC.slice(UPDATE_START, UPDATE_END + 3)
].join('\n') + '\nmodule.exports = { MANUAL_CHANGELOG, generateChangelog, formatDateJP, updateChangelog };';

// A fresh copy of the changelog module. updateChangelog runs against an in-memory fs (index.html in, html out) and
// an identity injectFavicon (the committed index.html already carries the favicon block; only CHANGELOG changes).
function load() {
  const io = { html: INDEX_HTML, written: null };
  const fakeFs = {
    existsSync: () => true,
    readFileSync: () => io.html,
    writeFileSync: (p, s) => { io.written = s; }
  };
  const fakeConsole = { log: () => {} };
  const m = {};
  new Function('module', 'fs', 'injectFavicon', 'console', CODE)(m, fakeFs, (h) => ({ html: h }), fakeConsole);
  const mod = m.exports;
  // index.html text as generate.js would write it for this module's (possibly mutated) MANUAL_CHANGELOG
  mod.buildIndexHtml = (apps) => { io.written = null; mod.updateChangelog(apps); return io.written; };
  return mod;
}

// Parse the `const CHANGELOG = [...]` array out of an index.html text.
function changelogFromHtml(html) {
  const s = html.indexOf('const CHANGELOG = ['); const e = html.indexOf('];', s);
  if (s === -1 || e === -1) throw new Error('index.html CHANGELOG not found');
  return new Function('return ' + html.slice(s + 'const CHANGELOG = '.length, e + 1))();
}

const isGroup = (i) => Array.isArray(i.entries) && i.entries.length > 0;
const monthTotals = (items) => items.reduce((acc, i) => { const k = i.date.slice(0, 7); acc[k] = (acc[k] || 0) + i.updateCount; return acc; }, {});

// Same-day same-app groups expected from the data alone: (date, app) with >= 2 manual entries, in output order
// (newest date first; within a day, first appearance in MANUAL_CHANGELOG order, as the data is stable-sorted).
function expectedGroups(manual) {
  const byKey = new Map();
  manual.forEach((e) => {
    if (e.app === undefined) return;
    const k = e.date + '\u0000' + e.app;
    if (!byKey.has(k)) byKey.set(k, { date: e.date, app: e.app, members: [] });
    byKey.get(k).members.push(e);
  });
  const groups = [...byKey.values()].filter((g) => g.members.length >= 2);
  const dates = [...new Set(groups.map((g) => g.date))].sort((a, b) => b.localeCompare(a));
  return dates.flatMap((d) => groups.filter((g) => g.date === d));
}
// updateCount a single manual entry contributes (details lines, else 1)
const entryCount = (e) => {
  const d = Array.isArray(e.details) ? e.details.map((x) => String(x).trim()).filter(Boolean) : [];
  return d.length > 0 ? d.length : 1;
};

// Data variations the tests must survive (each gets a copy of MANUAL_CHANGELOG; the real array is never touched).
// Synthetic additions are `verbatim: true`, as every recent real entry is.
const VARIANTS = [
  { name: 'real data', delta: 0, mutate: () => {} },
  { name: '+1 synthetic entry at the head (no app, newest date)', delta: 1,
    mutate: (m) => { m.unshift({ date: '2099-12-31', type: 'update', text: '（合成）サイトの小さな改善', verbatim: true }); } },
  { name: '+1 synthetic entry at the head (same day/app as the 2026-11-12 group)', delta: 1,
    mutate: (m) => { m.unshift({ date: HISTORICAL.date, type: 'fix', app: HISTORICAL.app, text: '「りんごポットン」（合成）の小さな修正', verbatim: true }); } },
  { name: '-1 entry (the newest MANUAL_CHANGELOG entry removed)', delta: -1,
    mutate: (m) => { m.shift(); } },
  { name: '-1 entry (the last 2026-11-12 group member removed)', delta: -1,
    mutate: (m) => {
      let k = -1; m.forEach((e, i) => { if (e.date === HISTORICAL.date && e.app === HISTORICAL.app) k = i; });
      if (k === -1) throw new Error('no 2026-11-12 group member to remove'); m.splice(k, 1);
    } },
  { name: '+2 synthetic entries at the head forming a new group (newest date)', delta: 2,
    mutate: (m) => {
      m.unshift({ date: '2099-12-30', type: 'update', app: 'tokei-app', text: '「とけい」（合成）その1', verbatim: true },
                { date: '2099-12-30', type: 'design', app: 'tokei-app', text: '「とけい」（合成）その2', verbatim: true });
    } }
];

// Load a fresh module with the variant applied. Returns the module plus the real (unmutated) length for sanity.
function loadVariant(variant) {
  const mod = load();
  const realLen = mod.MANUAL_CHANGELOG.length;
  variant.mutate(mod.MANUAL_CHANGELOG);
  if (mod.MANUAL_CHANGELOG.length !== realLen + variant.delta) throw new Error('variant did not apply: ' + variant.name);
  return mod;
}

module.exports = { ROOT, APPS, INDEX_HTML, HISTORICAL, load, loadVariant, changelogFromHtml, isGroup, monthTotals, expectedGroups, entryCount, VARIANTS };
