// Node test for the top-page changelog "same day, same app" grouping (Phase CHANGELOG-SAME-DAY-APP-GROUP-1).
//
// Usage (repository root, Node 20, no dependencies):
//   node tools/changelog-poc/changelog-group-generate-test.js
// Exits non-zero on any failure.
//
// It evaluates generate.js's changelog section (MANUAL_CHANGELOG .. generateChangelog) in isolation — the same
// "extract the real code from generate.js" approach as the Learning Record UI harness — so nothing is written to
// disk. What it proves:
//   - the real data: the four 2026-11-12 りんごポットン entries become ONE item first in that day, original texts
//     and types kept in source order, updateCount = their sum;
//   - nothing else changes: the output with every `app` field removed (= the behaviour before this Phase, since
//     entries without `app` take the old path untouched) equals the new output on every other item, and every
//     month's count (sum of updateCount) is the same;
//   - synthetic cases: two apps on one day never mix; a lone `app` entry and a no-app entry stay as before; an
//     automatic「公開しました」for the same app on the same day stays its own line; details survive inside a group;
//   - an unknown or non-string `app` stops the generation with an error.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'generate.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-data.json'), 'utf8'));
const APPS = Array.isArray(DATA) ? DATA : DATA.apps;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (detail !== undefined ? ' :: ' + detail : '')); }
}

function section(start, end) {
  const s = SRC.indexOf(start); const e = SRC.indexOf(end, s);
  if (s === -1 || e === -1) throw new Error('generate.js section not found: ' + start);
  return SRC.slice(s, e);
}
const CODE = [
  section('const MANUAL_CHANGELOG = [', 'function formatDateJP'),
  section('const APP_NAME_ALIASES', 'function updateChangelog')
].join('\n') + '\nmodule.exports = { MANUAL_CHANGELOG, generateChangelog };';
// a fresh copy of the changelog module each time (MANUAL_CHANGELOG is mutated by some cases)
function load() { const m = {}; new Function('module', CODE)(m); return m.exports; }
const monthTotals = (items) => items.reduce((acc, i) => { const k = i.date.slice(0, 7); acc[k] = (acc[k] || 0) + i.updateCount; return acc; }, {});

/* ---------- G1 real data: 2026-11-12 ---------- */
const NOW = load();
const after = NOW.generateChangelog(APPS);
const ringoEntries = NOW.MANUAL_CHANGELOG.filter(e => e.date === '2026-11-12' && e.app === 'ringo-potton-app');
ok('G1 exactly the four 2026-11-12 りんごポットン entries carry app: "ringo-potton-app"', ringoEntries.length === 4 && NOW.MANUAL_CHANGELOG.filter(e => e.app !== undefined).length === 4, String(ringoEntries.length));
const day = after.filter(i => i.date === '2026-11-12');
ok('G1 2026-11-12 renders as ONE item', day.length === 1, String(day.length));
const g = day[0] || {};
ok('G1 heading「「りんごポットン」を更新しました」, badge update, updateCount 4', g.text === '「りんごポットン」を更新しました' && g.type === 'update' && g.updateCount === 4, JSON.stringify({ text: g.text, type: g.type, n: g.updateCount }));
ok('G1 entries = the 4 original texts, unchanged, in MANUAL_CHANGELOG order, each with its type', Array.isArray(g.entries) && g.entries.length === 4 && g.entries.every((e, k) => e.text === ringoEntries[k].text && e.type === ringoEntries[k].type && e.updateCount === 1), JSON.stringify(g.entries));
ok('G1 the group is the first item of the whole changelog (newest date, first in its day)', after[0] === g);

/* ---------- G2 nothing else changes ---------- */
const BEFORE = load();
BEFORE.MANUAL_CHANGELOG.forEach(e => { delete e.app; });
const before = BEFORE.generateChangelog(APPS);
const rest = (items) => items.filter(i => i.date !== '2026-11-12').map(i => JSON.stringify(i));
const rb = rest(before), ra = rest(after);
ok('G2 every item outside 2026-11-12 is identical to the no-app output (' + rb.length + ' items)', rb.length === 72 && ra.length === 72 && rb.every((x, k) => x === ra[k]), rb.length + ' vs ' + ra.length);
ok('G2 total items 76 -> 73 (the four 11-12 rows become one)', before.length === 76 && after.length === 73, before.length + ' -> ' + after.length);
const mb = monthTotals(before), ma = monthTotals(after);
ok('G2 every month count (sum of updateCount) is unchanged, incl. 2026-11 = 8', Object.keys(mb).length === Object.keys(ma).length && Object.keys(mb).every(k => mb[k] === ma[k]) && ma['2026-11'] === 8, JSON.stringify({ before: mb['2026-11'], after: ma['2026-11'] }));
ok('G2 dates stay in descending order', after.every((i, k) => k === 0 || after[k - 1].date >= i.date));

/* ---------- G3 synthetic: two apps on one day, singles, release, details ---------- */
{
  const X = load();
  const A = 'tokei-app', B = 'janken-app', C = 'okane-app';
  const D = '2030-01-15';
  const synth = [
    { date: D, type: 'update', app: A, text: '「とけい」A1', verbatim: true },
    { date: D, type: 'update', app: B, text: '「じゃんけん まなぼう！」B1' },
    { date: D, type: 'fix', app: A, text: '「とけい」A2', details: ['A2 内訳1', 'A2 内訳2'] },
    { date: D, type: 'design', app: B, text: '「じゃんけん まなぼう！」B2', verbatim: true },
    { date: D, type: 'update', app: C, text: '「おかねのおべんきょう」C1 ひとつだけ', verbatim: true },
    { date: D, type: 'update', text: 'サイト全体の小さな改善', verbatim: true }
  ];
  X.MANUAL_CHANGELOG.unshift(...synth);
  const apps2 = APPS.map(a => a.id === A ? Object.assign({}, a, { releaseDate: D }) : a);   // A is also "released" that day
  const out = X.generateChangelog(apps2).filter(i => i.date === D);
  const groups = out.filter(i => Array.isArray(i.entries));
  const ga = groups.find(i => i.text === '「とけい」を更新しました'), gb = groups.find(i => i.text === '「じゃんけん まなぼう！」を更新しました');
  ok('G3 same day, two apps with 2 entries each -> two separate groups', groups.length === 2 && !!ga && !!gb, JSON.stringify(out.map(i => i.text)));
  ok('G3 app A group holds only A entries (A1, A2) and app B group only B (B1, B2)', ga && ga.entries.map(e => e.text).join('|') === '「とけい」A1|「とけい」A2' && gb && gb.entries.map(e => e.text).join('|') === '「じゃんけん まなぼう！」B1|「じゃんけん まなぼう！」B2');
  ok('G3 badge = highest-priority type of the members (A: update over fix; B: update over design)', ga && ga.type === 'update' && gb && gb.type === 'update');
  ok('G3 a member with details keeps them, and the group count is the sum (A: 1 + 2 = 3)', ga && ga.entries[1].details.join('|') === 'A2 内訳1|A2 内訳2' && ga.entries[1].updateCount === 2 && ga.updateCount === 3, JSON.stringify(ga));
  ok('G3 the groups come first in the day, before the other items', out.length >= 2 && Array.isArray(out[0].entries) && Array.isArray(out[1].entries));
  const others = out.filter(i => !Array.isArray(i.entries));
  ok('G3 the lone app-C entry and the no-app entry stay as their own items, unchanged', others.some(i => i.text === '「おかねのおべんきょう」C1 ひとつだけ' && i.updateCount === 1 && !i.entries) && others.some(i => i.text === 'サイト全体の小さな改善'), JSON.stringify(others.map(i => i.text)));
  ok('G3 the automatic「「とけい」を公開しました」is NOT inside the group (stays its own line)', ga && !ga.entries.some(e => /公開しました/.test(e.text)) && others.some(i => /「とけい」を公開しました/.test(i.text) || (Array.isArray(i.details) && i.details.some(d => /「とけい」を公開しました/.test(d)))), JSON.stringify(others));
}

/* ---------- G4 an unknown or non-string app stops the generation ---------- */
for (const bad of ['no-such-app', 123, '']) {
  const X = load();
  X.MANUAL_CHANGELOG.unshift({ date: '2030-02-01', type: 'update', app: bad, text: '「なにか」を更新しました' });
  let err = null;
  try { X.generateChangelog(APPS); } catch (e) { err = e; }
  ok('G4 app ' + JSON.stringify(bad) + ' -> error that names the bad value', !!err && /apps-data\.json に存在しません/.test(err.message) && err.message.indexOf(JSON.stringify(bad)) !== -1, err ? err.message : 'no error');
}

/* ---------- G5 the generated index.html matches this output ---------- */
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const s = html.indexOf('const CHANGELOG = ['); const e = html.indexOf('];', s);
  const arr = new Function('return ' + html.slice(s + 'const CHANGELOG = '.length, e + 1))();
  ok('G5 index.html CHANGELOG has 73 items and its first item carries the 4 entries (regenerated, not hand-edited)', arr.length === 73 && Array.isArray(arr[0].entries) && arr[0].entries.length === 4 && arr[0].text === '「りんごポットン」を更新しました' && arr[0].updateCount === 4, arr.length + ' ' + JSON.stringify(arr[0]).slice(0, 120));
  ok('G5 no other index.html item carries entries', arr.slice(1).every(i => !i.entries));
}

console.log('\nresult: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
