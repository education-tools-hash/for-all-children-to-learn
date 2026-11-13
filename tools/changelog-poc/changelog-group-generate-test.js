// Node test for the top-page changelog "same day, same app" grouping (Phase CHANGELOG-SAME-DAY-APP-GROUP-1;
// expectations made data-independent in Phase CHANGELOG-POC-DATA-INDEPENDENT-1).
//
// Usage (repository root, Node 20, no dependencies):
//   node tools/changelog-poc/changelog-group-generate-test.js
// Exits non-zero on any failure.
//
// It evaluates generate.js's changelog section (MANUAL_CHANGELOG .. updateChangelog) in isolation — the same
// "extract the real code from generate.js" approach as the Learning Record UI harness — so nothing is written to
// disk. No expected value is a hard-coded count or date list: every count, month total, group size and original
// text is derived from MANUAL_CHANGELOG itself, so adding a changelog entry does not break the test.
// What it proves, for the real data AND for every data variation in helpers.VARIANTS (a synthetic entry added at
// the head, one entry removed, ...; each on a private copy, the real data is never changed):
//   - history: the 2026-11-12 りんごポットン entries (2 or more) become ONE item first in that day, original texts
//     and types kept in source order, updateCount = their sum; every (date, app) with >= 2 entries is a group and
//     nothing else is;
//   - nothing else changes: dates without a group are identical to the output with every `app` field removed (= the
//     behaviour before grouping); on a group date the non-group items are exactly what the old path gives for the
//     remaining entries; every month's count (sum of updateCount) equals the old path's with each grouped entry
//     counted on its own;
//   - synthetic cases: two apps on one day never mix; a lone `app` entry and a no-app entry stay as before; an
//     automatic「公開しました」for the same app on the same day stays its own line; details survive inside a group;
//   - an unknown or non-string `app` stops the generation with an error.
// And once (real data only, it is about the committed file): index.html's CHANGELOG is exactly what generate.js
// writes for the current data.
const H = require('./changelog-test-helpers');
const { APPS, HISTORICAL, isGroup, monthTotals } = H;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (detail !== undefined ? ' :: ' + detail : '')); }
}
const TYPE_PRIORITY = ['new', 'update', 'design', 'fix'];   // the badge order documented in generate.js
const topType = (types) => TYPE_PRIORITY.find((t) => types.includes(t)) || types[0];
const J = (x) => JSON.stringify(x);

function suite(variant) {
  const P = '[' + variant.name + '] ';
  const NOW = H.loadVariant(variant);
  const manual = NOW.MANUAL_CHANGELOG;
  const after = NOW.generateChangelog(APPS);
  const titleOf = (id) => APPS.find((a) => a.id === id).title;
  const exp = H.expectedGroups(manual);

  /* ---------- G1 history: the 2026-11-12 りんごポットン group ---------- */
  const members = manual.filter((e) => e.date === HISTORICAL.date && e.app === HISTORICAL.app);
  ok(P + 'G1 MANUAL_CHANGELOG still has 2+ entries for ' + HISTORICAL.date + ' ' + HISTORICAL.app + ' (found ' + members.length + ')', members.length >= 2, String(members.length));
  const day = after.filter((i) => i.date === HISTORICAL.date);
  const hg = day.filter((i) => isGroup(i) && i.text === HISTORICAL.head);
  ok(P + 'G1 ' + HISTORICAL.date + ' has exactly ONE「' + HISTORICAL.head + '」group and it is the first item of that day', hg.length === 1 && day[0] === hg[0], J(day.map((i) => i.text)));
  const g = hg[0] || {};
  const wantN = members.reduce((s, e) => s + H.entryCount(e), 0);
  ok(P + 'G1 badge = top-priority member type (' + topType(members.map((e) => e.type)) + '), updateCount = sum of members (' + wantN + ')', g.type === topType(members.map((e) => e.type)) && g.updateCount === wantN, J({ type: g.type, n: g.updateCount }));
  ok(P + 'G1 entries = the ' + members.length + ' original texts, unchanged, in MANUAL_CHANGELOG order, each with its type', Array.isArray(g.entries) && g.entries.length === members.length && g.entries.every((e, k) => e.text === members[k].text && e.type === members[k].type && e.updateCount === H.entryCount(members[k])), J(g.entries));

  /* ---------- G1b every (date, app) with 2+ entries is a group, and nothing else is ---------- */
  const got = after.filter(isGroup);
  ok(P + 'G1b the output has exactly the ' + exp.length + ' expected group(s), in order, each with its members', got.length === exp.length && exp.every((x, k) => got[k].date === x.date && got[k].text === '「' + titleOf(x.app) + '」を更新しました' && got[k].entries.map((e) => e.text).join('|') === x.members.map((e) => e.text).join('|')), J(got.map((i) => [i.date, i.text, i.entries.length])) + ' vs ' + J(exp.map((x) => [x.date, x.app, x.members.length])));

  /* ---------- G2 nothing else changes ---------- */
  const groupDates = new Set(exp.map((x) => x.date));
  const memberSet = new Set(exp.flatMap((x) => x.members));
  // (a) the behaviour before grouping: every `app` removed
  const BEFORE = H.loadVariant(variant); BEFORE.MANUAL_CHANGELOG.forEach((e) => { delete e.app; });
  const before = BEFORE.generateChangelog(APPS);
  // (b) the old path for what is left once the grouped entries are taken out
  const REST = H.loadVariant(variant);
  const restIdx = REST.MANUAL_CHANGELOG.map((e, i) => i).filter((i) => !memberSet.has(manual[i]));
  REST.MANUAL_CHANGELOG.splice(0, REST.MANUAL_CHANGELOG.length, ...restIdx.map((i) => REST.MANUAL_CHANGELOG[i]));
  REST.MANUAL_CHANGELOG.forEach((e) => { delete e.app; });
  const rest = REST.generateChangelog(APPS);
  // (c) the old path with each grouped entry shown on its own (verbatim) = the month count to keep
  const SOLO = H.loadVariant(variant);
  SOLO.MANUAL_CHANGELOG.forEach((e, i) => { if (memberSet.has(manual[i])) e.verbatim = true; delete e.app; });
  const solo = SOLO.generateChangelog(APPS);

  const outside = (items) => items.filter((i) => !groupDates.has(i.date)).map(J);
  const ob = outside(before), oa = outside(after);
  ok(P + 'G2 every item on a date without a group is identical to the no-app output (' + ob.length + ' items)', ob.length === oa.length && ob.every((x, k) => x === oa[k]), ob.length + ' vs ' + oa.length);
  const onDates = (items) => items.filter((i) => groupDates.has(i.date));
  const wantOnDates = [...groupDates].sort((a, b) => b.localeCompare(a)).flatMap((d) => [...got.filter((i) => i.date === d), ...rest.filter((i) => i.date === d)]).map(J);
  const gotOnDates = onDates(after).map(J);
  ok(P + 'G2 on each group date: the group(s) first, then exactly the old-path items for the other entries', wantOnDates.length === gotOnDates.length && wantOnDates.every((x, k) => x === gotOnDates[k]), J(gotOnDates.map((x) => JSON.parse(x).text)));
  const wantTotal = before.length - before.filter((i) => groupDates.has(i.date)).length + wantOnDates.length;
  ok(P + 'G2 total items = ' + wantTotal + ' (no-app output ' + before.length + ', with each group date recomputed)', after.length === wantTotal, after.length + ' vs ' + wantTotal);
  const ms = monthTotals(solo), ma = monthTotals(after);
  ok(P + 'G2 every month count (sum of updateCount) is unchanged vs the old path (' + Object.keys(ma).length + ' months, ' + (Object.keys(ma)[0] || '-') + ' = ' + ma[Object.keys(ma)[0]] + ')', Object.keys(ms).length === Object.keys(ma).length && Object.keys(ms).every((k) => ms[k] === ma[k]), J({ solo: ms, after: ma }));
  ok(P + 'G2 dates stay in descending order', after.every((i, k) => k === 0 || after[k - 1].date >= i.date));

  /* ---------- G3 synthetic: two apps on one day, singles, release, details ---------- */
  {
    const X = H.loadVariant(variant);
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
    const apps2 = APPS.map((a) => a.id === A ? Object.assign({}, a, { releaseDate: D }) : a);   // A is also "released" that day
    const out = X.generateChangelog(apps2).filter((i) => i.date === D);
    const groups = out.filter(isGroup);
    const ga = groups.find((i) => i.text === '「とけい」を更新しました'), gb = groups.find((i) => i.text === '「じゃんけん まなぼう！」を更新しました');
    ok(P + 'G3 same day, two apps with 2 entries each -> two separate groups', groups.length === 2 && !!ga && !!gb, J(out.map((i) => i.text)));
    ok(P + 'G3 app A group holds only A entries (A1, A2) and app B group only B (B1, B2)', ga && ga.entries.map((e) => e.text).join('|') === '「とけい」A1|「とけい」A2' && gb && gb.entries.map((e) => e.text).join('|') === '「じゃんけん まなぼう！」B1|「じゃんけん まなぼう！」B2');
    ok(P + 'G3 badge = highest-priority type of the members (A: update over fix; B: update over design)', ga && ga.type === 'update' && gb && gb.type === 'update');
    ok(P + 'G3 a member with details keeps them, and the group count is the sum (A: 1 + 2 = 3)', ga && ga.entries[1].details.join('|') === 'A2 内訳1|A2 内訳2' && ga.entries[1].updateCount === 2 && ga.updateCount === 3, J(ga));
    ok(P + 'G3 the groups come first in the day, before the other items', out.length >= 2 && isGroup(out[0]) && isGroup(out[1]));
    const others = out.filter((i) => !isGroup(i));
    ok(P + 'G3 the lone app-C entry and the no-app entry stay as their own items, unchanged', others.some((i) => i.text === '「おかねのおべんきょう」C1 ひとつだけ' && i.updateCount === 1 && !i.entries) && others.some((i) => i.text === 'サイト全体の小さな改善'), J(others.map((i) => i.text)));
    ok(P + 'G3 the automatic「「とけい」を公開しました」is NOT inside the group (stays its own line)', ga && !ga.entries.some((e) => /公開しました/.test(e.text)) && others.some((i) => /「とけい」を公開しました/.test(i.text) || (Array.isArray(i.details) && i.details.some((d) => /「とけい」を公開しました/.test(d)))), J(others));
  }

  /* ---------- G4 an unknown or non-string app stops the generation ---------- */
  for (const bad of ['no-such-app', 123, '']) {
    const X = H.loadVariant(variant);
    X.MANUAL_CHANGELOG.unshift({ date: '2030-02-01', type: 'update', app: bad, text: '「なにか」を更新しました' });
    let err = null;
    try { X.generateChangelog(APPS); } catch (e) { err = e; }
    ok(P + 'G4 app ' + J(bad) + ' -> error that names the bad value', !!err && /apps-data\.json に存在しません/.test(err.message) && err.message.indexOf(J(bad)) !== -1, err ? err.message : 'no error');
  }
}

H.VARIANTS.forEach(suite);

/* ---------- G5 the committed index.html matches the current data (real data only) ---------- */
{
  const R = H.load();
  const out = R.generateChangelog(APPS);
  const arr = H.changelogFromHtml(H.INDEX_HTML);
  const same = arr.length === out.length && out.every((i, k) => {
    const a = arr[k];
    return a.date === R.formatDateJP(i.date) && a.type === i.type && a.text === i.text && a.updateCount === i.updateCount &&
      J(a.details || null) === J(i.details || null) &&
      J((a.entries || []).map((e) => [e.type, e.text, e.updateCount])) === J((i.entries || []).map((e) => [e.type, e.text, e.updateCount]));
  });
  ok('G5 index.html CHANGELOG = generateChangelog output for the current data (' + out.length + ' items, ' + out.filter(isGroup).length + ' group(s); regenerated, not hand-edited)', same, arr.length + ' vs ' + out.length);
  ok('G5 regenerating the CHANGELOG in memory reproduces index.html byte for byte', R.buildIndexHtml(APPS) === H.INDEX_HTML);
}

console.log('\nvariants: ' + H.VARIANTS.map((v) => v.name).join(' / '));
console.log('result: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
