#!/usr/bin/env node
// Phase T2-A — Golden Test Harness
//
// Runs the deterministic Tracing Engine PoC against a synthetic Golden
// Test Matrix for 5 characters (い/く/こ/あ/ま) and reports PASS/FAIL vs
// expectation, including the mandatory「い」/「ニ」regression test
// (Section 25) and basic performance / motor-accessibility checks.
//
// Usage: node tools/tracing-poc/golden-tests.js

'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const REFERENCE = require('./fixtures/reference-data.generated.js');

const CHARS = ['い', 'く', 'こ', 'あ', 'ま'];

let totalChecks = 0;
let failedChecks = 0;
const borderlineNotes = [];
let mandatoryRegressionOk = null;
const perfSamples = [];

function timedEvaluate(userStrokes, refDefs) {
  const t0 = process.hrtime.bigint();
  const result = Engine.evaluateCharacter(userStrokes, refDefs);
  const t1 = process.hrtime.bigint();
  perfSamples.push(Number(t1 - t0) / 1e6);
  return result;
}

function check(label, expected, result) {
  totalChecks++;
  const ok = result.pass === expected;
  if (!ok) failedChecks++;
  const mark = ok ? 'OK  ' : 'FAIL';
  console.log(
    `  [${mark}] ${label.padEnd(34)} expected=${String(expected).padEnd(5)} actual=${String(result.pass).padEnd(5)} score=${result.score.toFixed(3)} reason=${result.reason}`
  );
  return ok;
}

function checkBorderline(label, result) {
  totalChecks++;
  console.log(
    `  [BDL ] ${label.padEnd(34)} actual=${String(result.pass).padEnd(5)} score=${result.score.toFixed(3)} reason=${result.reason}`
  );
  borderlineNotes.push({ label, pass: result.pass, score: result.score });
}

console.log('=== Phase T2-A Golden Test Matrix ===\n');

CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  console.log(`--- 文字「${ch}」 (${refDefs.length}画) ---`);

  check('ideal', true, timedEvaluate(Traces.ideal(refDefs), refDefs));
  check('mild wobble (amp=0.012)', true, timedEvaluate(Traces.mildWobble(refDefs, 0.012, 10), refDefs));
  check('mild wobble (amp=0.018)', true, timedEvaluate(Traces.mildWobble(refDefs, 0.018, 11), refDefs));
  check('slight offset (+0.03,+0.02)', true, timedEvaluate(Traces.slightOffset(refDefs, 0.03, 0.02), refDefs));
  check('slight offset (-0.025,-0.03)', true, timedEvaluate(Traces.slightOffset(refDefs, -0.025, -0.03), refDefs));
  check('slight scale (1.12x)', true, timedEvaluate(Traces.slightScale(refDefs, 1.12), refDefs));
  check('slight scale (0.9x)', true, timedEvaluate(Traces.slightScale(refDefs, 0.9), refDefs));
  check('mildly uneven', true, timedEvaluate(Traces.mildlyUneven(refDefs, 20), refDefs));

  checkBorderline('reversed direction (correct shape)', timedEvaluate(Traces.reversedDirection(refDefs), refDefs));
  checkBorderline('reversed stroke order', timedEvaluate(Traces.reversedOrder(refDefs), refDefs));

  check('tiny strokes (15%)', false, timedEvaluate(Traces.tinyStrokes(refDefs, 0.15), refDefs));
  check('off-position (corner)', false, timedEvaluate(Traces.offPosition(refDefs), refDefs));
  check('incomplete (missing stroke)', false, timedEvaluate(Traces.incompleteStrokeCount(refDefs), refDefs));
  check('unrelated scribble shape', false, timedEvaluate(Traces.unrelatedShape(refDefs, 30), refDefs));

  if (refDefs.length === 2) {
    const niResult = timedEvaluate(Traces.twoHorizontalLines(refDefs), refDefs);
    if (ch === 'い') {
      // Mandatory regression (Section 25): drawing a "ニ"-shaped pair of
      // horizontal strokes while the target is "い" must FAIL. い's own
      // reference shape (down-stroke + curved down-stroke) is structurally
      // unlike two horizontal lines, so this is a strict assertion.
      mandatoryRegressionOk = check('2 horizontal lines ("ニ"-style) [MANDATORY]', false, niResult);
    } else {
      // NOTE: こ's actual reference shape (1画目「よこに はらう」/
      // 2画目「よこに はらう」) IS two roughly-horizontal strokes, so a
      // clean two-horizontal-line trace legitimately resembling こ is not
      // the false-positive bug under test here — treat as informational.
      checkBorderline('2 horizontal lines (informational for this char)', niResult);
    }
    check('2 vertical lines', false, timedEvaluate(Traces.twoVerticalLines(refDefs), refDefs));
  }

  // Motor accessibility / device sampling — should NOT disproportionately fail
  const idealStrokes = Traces.ideal(refDefs);
  check('dense sampling (200pt)', true, timedEvaluate(Traces.withDensity(idealStrokes, 200), refDefs));
  check('sparse sampling (10pt)', true, timedEvaluate(Traces.withDensity(idealStrokes, 10), refDefs));
  check('irregular spacing', true, timedEvaluate(Traces.withIrregularSpacing(idealStrokes, 40), refDefs));
  check('tremor-like oscillation', true, timedEvaluate(Traces.withTremor(idealStrokes, 0.01, 1.2, 50), refDefs));
  check('brief pause mid-stroke', true, timedEvaluate(Traces.withBriefPause(idealStrokes), refDefs));
  check('small backtrack mid-stroke', true, timedEvaluate(Traces.withSmallBacktrack(idealStrokes, 60), refDefs));

  console.log('');
});

console.log('=== Performance ===');
const avg = perfSamples.reduce((a, b) => a + b, 0) / perfSamples.length;
const max = Math.max(...perfSamples);
console.log(`  evaluations: ${perfSamples.length}  avg=${avg.toFixed(3)}ms  max=${max.toFixed(3)}ms\n`);

console.log('=== Mandatory「い」/「ニ」Regression (Section 25) ===');
console.log(`  evaluate("い", niTrace).pass === false : ${mandatoryRegressionOk === true ? 'SATISFIED' : 'NOT SATISFIED'}\n`);

console.log('=== Borderline cases (informational, not strictly asserted) ===');
borderlineNotes.forEach((b) => console.log(`  ${b.label}: pass=${b.pass} score=${b.score.toFixed(3)}`));

console.log('\n=== Summary ===');
console.log(`  total strict checks: ${totalChecks - borderlineNotes.length}`);
console.log(`  failed strict checks: ${failedChecks}`);
console.log(`  mandatory ニ regression: ${mandatoryRegressionOk === true ? 'PASS' : 'FAIL'}`);

if (failedChecks > 0 || mandatoryRegressionOk !== true) {
  console.log('\nRESULT: GOLDEN TEST MATRIX — FAILURES PRESENT');
  process.exitCode = 1;
} else {
  console.log('\nRESULT: GOLDEN TEST MATRIX — ALL STRICT CHECKS PASSED');
}
