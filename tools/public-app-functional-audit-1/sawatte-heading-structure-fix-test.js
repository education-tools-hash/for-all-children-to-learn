// Phase DAQS-SAWATTE-HEADING-STRUCTURE-FIX-1: static verification of the
// heading-structure fix (resolves DAQS's last KNOWN finding,
// h1-excess:sawatte-hirogaru-app). Read-only: parses the real, unmodified
// sawatte-hirogaru-app.html as text; writes nothing back to it. Runtime
// behavior (inert isolation, focus management, Tab trap, learning record
// and trace-record functionality) is covered by the existing
// sawatte-overlay-isolation-fix-test.js and
// sawatte-record-trace-viewer-isolation-fix-test.js (both re-run and still
// 23/23 and 26/26 PASS against this same fix, confirming nothing here
// regressed those behaviors) -- this file covers only what those two did
// not: the static heading markup itself.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, 'sawatte-hirogaru-app.html');
const html = fs.readFileSync(FILE, 'utf-8');

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass++;
    console.log('PASS - ' + label);
  } else {
    fail++;
    console.log('FAIL - ' + label + (detail !== undefined ? ' -- ' + JSON.stringify(detail) : ''));
  }
}

// Same technique as tools/main-heading-audit/audit.js's own
// stripCommentsAndScripts(): excludes <script>/<style>/comment text so a
// heading tag that exists only inside a JS string is never miscounted as
// real markup.
function stripCommentsAndScripts(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}
const clean = stripCommentsAndScripts(html);

// ---- 1. 静的HTML上のh1が1個 ----
const h1Matches = [...clean.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
check('1. exactly one static <h1> remains', h1Matches.length === 1, h1Matches.map(m => m[0].slice(0, 60)));

// ---- 2. アプリの主題h1が存在 (the one h1 is the app's own theme title, on startScreen) ----
if (h1Matches.length === 1) {
  const h1Html = h1Matches[0][0];
  const h1Text = h1Matches[0][1].trim();
  check('2a. the remaining h1 has class="app-title"', /class="app-title"/.test(h1Html), h1Html);
  check('2b. the remaining h1 is the app theme title text', h1Text === 'さわってひろがる', h1Text);
  const startScreenMatch = clean.match(/<section id="startScreen"[^>]*>([\s\S]*?)<\/section>/i);
  check('2c. the remaining h1 is inside <section id="startScreen">', !!(startScreenMatch && startScreenMatch[1].includes(h1Html)));
} else {
  check('2a. the remaining h1 has class="app-title"', false, 'h1 count was not 1');
  check('2b. the remaining h1 is the app theme title text', false, 'h1 count was not 1');
  check('2c. the remaining h1 is inside <section id="startScreen">', false, 'h1 count was not 1');
}

// ---- 3. 見出し階層が妥当 (no skipped heading level within any single screen/overlay region) ----
const REGIONS = [
  ['startScreen', /<section id="startScreen"[^>]*>([\s\S]*?)<\/section>/i],
  ['summaryScreen', /<section id="summaryScreen"[^>]*>([\s\S]*?)<\/section>/i],
  ['teacherModal', /<div id="teacherModal"[^>]*>([\s\S]*?)\n  <\/div>\n<\/div>/i],
  ['helpOverlay', /<div id="helpOverlay"[^>]*>([\s\S]*?)<\/section>\s*<\/div>/i],
  ['recordViewerModal', /<div id="recordViewerModal"[^>]*>([\s\S]*?)<\/div>\n<\/div>/i],
  ['traceViewerPanel', /<div id="traceViewerPanel"[^>]*>([\s\S]*?)<\/div>\n<\/div>/i],
];
for (const [name, re] of REGIONS) {
  const m = clean.match(re);
  check(`3-presence. region "${name}" found in file`, !!m, name);
  if (!m) continue;
  const levels = [...m[1].matchAll(/<h([1-6])[^>]*>/gi)].map(x => Number(x[1]));
  let lastLevel = null;
  let skip = null;
  for (const lvl of levels) {
    if (lastLevel !== null && lvl > lastLevel + 1) { skip = { from: lastLevel, to: lvl }; break; }
    lastLevel = lvl;
  }
  check(`3. region "${name}" heading sequence has no skipped level (${levels.join('>') || 'none'})`, skip === null, skip);
}

// ---- 4/5. aria-labelledby参照先が存在し、一意である ----
const labelledByRefs = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(m => m[1]);
check('4/5-presence. at least the 4 known overlay titles are referenced via aria-labelledby', labelledByRefs.length >= 4, labelledByRefs);
for (const ref of labelledByRefs) {
  const idMatches = [...html.matchAll(new RegExp('\\sid="' + ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g'))];
  check(`4. aria-labelledby="${ref}" target id exists`, idMatches.length >= 1, idMatches.length);
  check(`5. aria-labelledby="${ref}" target id is unique (not duplicated)`, idMatches.length === 1, idMatches.length);
}

// ---- 6. 既存CSSクラスが維持 (the .app-title / .overlay-title CSS rules and the 6 class attributes are all still present) ----
check('6a. .app-title CSS rule still defined', /\.app-title\s*\{/.test(html));
check('6b. .overlay-title CSS rule still defined', /\.overlay-title\s*\{/.test(html));
const appTitleClassCount = (html.match(/class="app-title"/g) || []).length;
const overlayTitleClassCount = (html.match(/class="overlay-title"/g) || []).length;
check('6c. exactly 2 elements still carry class="app-title" (startScreen + summaryScreen titles)', appTitleClassCount === 2, appTitleClassCount);
check('6d. exactly 4 elements still carry class="overlay-title" (the 4 overlay titles)', overlayTitleClassCount === 4, overlayTitleClassCount);

// ---- 7. 既存idが維持 ----
for (const id of ['teacherModalTitle', 'helpTitle', 'recordViewerTitle', 'traceViewerTitle']) {
  const count = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  check(`7. id="${id}" still present exactly once`, count === 1, count);
}

// ---- Confirms the summaryScreen title (no id) is still present with its original text and tag level ----
const h2AppTitleMatch = clean.match(/<h2 class="app-title"[^>]*>([\s\S]*?)<\/h2>/i);
check('summaryScreen title is now <h2 class="app-title"> with its original text', !!(h2AppTitleMatch && h2AppTitleMatch[1].trim() === 'きろく'), h2AppTitleMatch && h2AppTitleMatch[1]);

console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
if (fail > 0) {
  console.log('FAILURES PRESENT.');
  process.exit(1);
}
console.log('ALL PASS.');
