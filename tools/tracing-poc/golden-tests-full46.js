#!/usr/bin/env node
// Phase T2-C — Section 12-27: Full 46-character Golden Test Suite.
//
// Runs Positive (P1-P6) and Negative (N1-N6) cases against ALL 46 gojuon
// characters using the same engine.js used by hiragana-learn.html's Full
// Rollout. Reuses golden-traces.js primitives generically (they already
// accept arbitrary refDefs — no per-character code there). N6 uses the
// character-aware wrong-trace generator (Section 14) so "wrong" is always
// relative to that stroke's own curvature, never a blanket straight-line
// substitute.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const WrongTrace = require('./wrong-trace-generator.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

const CHARS = Object.keys(REFERENCE);

let total = 0, failed = 0;
const failures = [];
const byCategory = {};

function record(category) {
  byCategory[category] = byCategory[category] || { total: 0, failed: 0 };
  byCategory[category].total++;
}

function check(category, ch, label, expected, result) {
  total++;
  record(category);
  const ok = result.pass === expected;
  if (!ok) {
    failed++;
    byCategory[category].failed++;
    failures.push({ ch, label, expected, actual: result.pass, score: result.score, reason: result.reason });
  }
  return ok;
}

// Borderline (soft-policy) cases: recorded separately, not asserted strictly.
const borderline = [];
function checkBorderline(ch, label, result) {
  borderline.push({ ch, label, pass: result.pass, score: result.score });
}

const t0 = Date.now();

CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const n = refDefs.length;

  // ---- Positive P1-P6 ----
  check('P1_ideal', ch, 'ideal', true, Engine.evaluateCharacter(Traces.ideal(refDefs), refDefs));
  check('P2_wobble', ch, 'mild wobble', true, Engine.evaluateCharacter(Traces.mildWobble(refDefs, 0.012, 10), refDefs));
  check('P3_offset', ch, 'slight offset', true, Engine.evaluateCharacter(Traces.slightOffset(refDefs, 0.03, 0.02), refDefs));
  check('P4_scale', ch, 'slight scale', true, Engine.evaluateCharacter(Traces.slightScale(refDefs, 1.1), refDefs));
  check('P5_irregular', ch, 'irregular sampling', true, Engine.evaluateCharacter(Traces.withIrregularSpacing(Traces.ideal(refDefs), 40), refDefs));
  check('P6_backtrack', ch, 'mild backtrack', true, Engine.evaluateCharacter(Traces.withSmallBacktrack(Traces.ideal(refDefs), 60), refDefs));
  check('P7_tremor', ch, 'tremor', true, Engine.evaluateCharacter(Traces.withTremor(Traces.ideal(refDefs), 0.01, 1.2, 50), refDefs));
  check('P8_pause', ch, 'brief pause', true, Engine.evaluateCharacter(Traces.withBriefPause(Traces.ideal(refDefs)), refDefs));

  // ---- Negative N1-N5 ----
  check('N1_tiny', ch, 'tiny stroke(s)', false, Engine.evaluateCharacter(Traces.tinyStrokes(refDefs, 0.15), refDefs));
  check('N2_offposition', ch, 'off-position', false, Engine.evaluateCharacter(Traces.offPosition(refDefs), refDefs));
  check('N3_incomplete', ch, 'incomplete (missing stroke)', false, Engine.evaluateCharacter(Traces.incompleteStrokeCount(refDefs), refDefs));
  check('N5_unrelated', ch, 'unrelated scribble', false, Engine.evaluateCharacter(Traces.unrelatedShape(refDefs, 30), refDefs));

  // N4 wrong stroke count (extra stroke): duplicate the last ideal stroke
  const idealTrace = Traces.ideal(refDefs);
  const extraStrokeTrace = idealTrace.concat([idealTrace[idealTrace.length - 1]]);
  check('N4_wrongcount_extra', ch, 'extra stroke', false, Engine.evaluateCharacter(extraStrokeTrace, refDefs));

  // ---- N6 single-bad-stroke (only for n >= 2) ----
  if (n >= 2) {
    for (let badIdx = 0; badIdx < n; badIdx++) {
      const { wrong, curvature, quality, method } = WrongTrace.characterAwareWrongStroke(Engine, refDefs, badIdx, idealTrace);
      const strokes = idealTrace.map((s, i) => (i === badIdx ? wrong : s));
      const result = Engine.evaluateCharacter(strokes, refDefs);
      check('N6_single_bad_stroke', ch, `stroke#${badIdx} bad (${method}, curvature=${curvature.toFixed(2)}, quality=${quality.toFixed(3)})`, false, result);
    }
  }

  // ---- Borderline: reversed order / reversed direction (SOFT policy) ----
  if (n >= 2) {
    checkBorderline(ch, 'reversed stroke order', Engine.evaluateCharacter(Traces.reversedOrder(refDefs), refDefs));
  }
  checkBorderline(ch, 'reversed direction (all strokes)', Engine.evaluateCharacter(Traces.reversedDirection(refDefs), refDefs));
});

const elapsed = Date.now() - t0;

console.log('=== Phase T2-C Full 46-Character Golden Test Suite ===\n');
console.log(`Characters: ${CHARS.length}`);
console.log(`Total strict checks: ${total}   Failed: ${failed}`);
console.log(`Elapsed: ${elapsed}ms\n`);

console.log('=== By category ===');
Object.keys(byCategory).sort().forEach((cat) => {
  const c = byCategory[cat];
  console.log(`  ${cat.padEnd(28)} total=${c.total.toString().padEnd(4)} failed=${c.failed}`);
});

console.log('\n=== Stroke-count breakdown ===');
const byStrokeCount = {};
CHARS.forEach((ch) => {
  const n = REFERENCE[ch].length;
  byStrokeCount[n] = (byStrokeCount[n] || 0) + 1;
});
Object.keys(byStrokeCount).sort().forEach((n) => console.log(`  ${n}画: ${byStrokeCount[n]}文字`));

if (failures.length) {
  console.log('\n=== FAILURES ===');
  failures.forEach((f) => {
    console.log(`  [${f.ch}] ${f.label}: expected=${f.expected} actual=${f.actual} score=${f.score.toFixed(3)} reason=${f.reason}`);
  });
}

console.log('\n=== Borderline (informational only, not strictly asserted) ===');
const borderlinePassCount = borderline.filter((b) => b.pass).length;
console.log(`  ${borderlinePassCount}/${borderline.length} scored PASS-leaning (expected per SOFT policy)`);
const borderlineFails = borderline.filter((b) => !b.pass);
if (borderlineFails.length) {
  console.log(`  ${borderlineFails.length} came back RETRY (still informational, but listed for review):`);
  borderlineFails.forEach((b) => console.log(`    [${b.ch}] ${b.label}: score=${b.score.toFixed(3)}`));
}

console.log('\n=== Result ===');
if (failed === 0) {
  console.log('ALL STRICT CHECKS PASSED');
  process.exitCode = 0;
} else {
  console.log(`${failed} FAILURES PRESENT`);
  process.exitCode = 1;
}
