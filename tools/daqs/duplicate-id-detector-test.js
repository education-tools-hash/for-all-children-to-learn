// DAQS-DUPLICATE-ID-DETECTION-HARDENING-1: automated tests for
// tools/daqs/duplicate-id-detector.js, written before that module was wired
// into tools/audit35-1/audit.js and tools/accessibility-audit/tier{1,2,3}/
// static-audit.js (see those files' own diffs). Read-only: synthetic
// fixtures are in-memory strings; the only disk reads are of the real,
// already-committed bosai-app.html / sugoroku-app.html, and this script
// never writes to them.
//
// Run: node tools/daqs/duplicate-id-detector-test.js
'use strict';

const fs = require('fs');
const path = require('path');
const { findDuplicateIds } = require('./duplicate-id-detector.js');

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

// ---- 1. 静的HTMLで同一IDが2回 -> duplicate-idを検出する ----
check(
  '1. static duplicate id in real markup is detected',
  JSON.stringify(findDuplicateIds('<div id="foo">a</div><span id="foo">b</span>')) === JSON.stringify(['foo'])
);

// ---- 2. 静的HTMLで異なるID -> duplicate-idなし ----
check(
  '2. distinct ids produce no duplicate-id finding',
  findDuplicateIds('<div id="foo">a</div><span id="bar">b</span>').length === 0
);

// ---- 3. script内のテンプレート文字列 -> 静的HTMLの重複として誤検出しない ----
check(
  '3. one real markup id + the same id only inside a <script> template literal is NOT a duplicate',
  findDuplicateIds(
    '<div id="count">0</div><script>el.innerHTML = `<span id="count">${n}</span>`;</script>'
  ).length === 0
);

// ---- 4. コメント内のid文字列 -> 誤検出しない ----
check(
  '4. one real markup id + the same id text only inside an HTML comment is NOT a duplicate',
  findDuplicateIds('<!-- was id="foo" before a rename --><div id="foo">a</div>').length === 0
);

// ---- 5. style内のid文字列 -> 誤検出しない ----
// A CSS attribute selector (div[id="foo"]) is literal text matching the
// same `\sid="..."` pattern -- a realistic false-positive source distinct
// from script/comment, so it gets its own dedicated case.
check(
  '5. one real markup id + a CSS attribute selector for the same id inside <style> is NOT a duplicate',
  findDuplicateIds('<style>div[id="foo"] { color: red; }</style><div id="foo">a</div>').length === 0
);

// ---- 6. HTML属性の正当な表記ゆれ -> 適切に解析する ----
check(
  '6a. id attribute amid other attributes in any order is still parsed correctly',
  JSON.stringify(findDuplicateIds('<div class="x" id="foo" data-y="1">a</div><span id="foo">b</span>')) === JSON.stringify(['foo'])
);
check(
  '6b. a single occurrence (no real duplicate) amid other attributes stays unflagged',
  findDuplicateIds('<div class="x" id="foo" data-y="1">a</div><span id="bar">b</span>').length === 0
);

// ---- 9. 実際の静的重複ID -> 引き続き検出する (mixed with unrelated script/style/comment noise) ----
check(
  '9. a genuine static duplicate is still detected even alongside script/style/comment noise',
  JSON.stringify(
    findDuplicateIds(
      '<!-- unrelated comment --><style>.x{color:red}</style>' +
      '<div id="dup">a</div><script>var k = 1;</script><span id="dup">b</span>'
    )
  ) === JSON.stringify(['dup'])
);

// Combined realistic case: both a genuine duplicate AND a script-only false
// positive in the same document -- the real one must still surface, the
// fake one must not.
check(
  '9b. a genuine duplicate is detected while a separate script-only false positive in the same doc is not',
  (() => {
    const html =
      '<div id="real-dup">a</div><span id="real-dup">b</span>' +
      '<div id="bag-count">0 / <span id="bag-max">5</span></div>' +
      '<script>count.innerHTML = `${n} / <span id="bag-max">${cap}</span>`;</script>';
    const dups = findDuplicateIds(html);
    return JSON.stringify(dups) === JSON.stringify(['real-dup']);
  })()
);

// ---- 7. 防災のbag-maxパターン -> 誤検出しない (real file) ----
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const bosaiPath = path.join(REPO_ROOT, 'bosai-app.html');
if (fs.existsSync(bosaiPath)) {
  const bosaiHtml = fs.readFileSync(bosaiPath, 'utf-8');
  const bosaiDups = findDuplicateIds(bosaiHtml);
  check('7. bosai-app.html: bag-max is no longer reported as a duplicate id', !bosaiDups.includes('bag-max'), bosaiDups);
} else {
  check('7. bosai-app.html found for real-file check', false, bosaiPath);
}

// ---- 8. すごろくのsce-prev-icパターン -> 誤検出しない (real file) ----
const sugorokuPath = path.join(REPO_ROOT, 'sugoroku-app.html');
if (fs.existsSync(sugorokuPath)) {
  const sugorokuHtml = fs.readFileSync(sugorokuPath, 'utf-8');
  const sugorokuDups = findDuplicateIds(sugorokuHtml);
  check('8. sugoroku-app.html: sce-prev-ic is no longer reported as a duplicate id', !sugorokuDups.includes('sce-prev-ic'), sugorokuDups);
} else {
  check('8. sugoroku-app.html found for real-file check', false, sugorokuPath);
}

// ---- 10. Finding ID形式 / output contract -> 既存契約を維持する ----
// The detector's own output contract (a plain array of duplicated id
// strings, same as the pre-hardening inline implementations) is what
// tools/daqs/diff-check.js's extractDuplicateIdFindings()-equivalent logic
// builds `duplicate-id:${app}:${id}` from; this is unchanged by this Phase,
// verified separately end-to-end in Step 8 by re-running diff-check.js
// itself. Here we only confirm the array shape/type contract holds.
check(
  '10. output is always a plain array of strings (never objects/Sets), preserving the existing Finding-ID-building contract',
  (() => {
    const r = findDuplicateIds('<div id="a">x</div><div id="a">y</div>');
    return Array.isArray(r) && r.every(x => typeof x === 'string');
  })()
);

// ---- 11. 監査coverage -> 縮小しない ----
// Coverage (which apps/tiers get scanned at all) is a property of the
// EXPECTED_SCRIPTS/TIER arrays in the 4 calling scripts and of
// tools/daqs/diff-check.js's own coverage computation, none of which this
// module touches or could affect -- it only changes what counts as a
// duplicate *within* an app that is already scanned. Verified end-to-end
// in Step 8 (coverage fields byte-identical before/after this Phase's
// change). No per-module test applies here.

console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) {
  console.log('FAILURES PRESENT.');
  process.exit(1);
}
console.log('ALL PASS.');
