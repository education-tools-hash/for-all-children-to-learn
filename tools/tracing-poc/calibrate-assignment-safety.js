#!/usr/bin/env node
// Phase T3-D1 Section 10 — Assignment Acceptance Safety Guard calibration.
//
// T3-C''s Multi-Hypothesis Assignment picks whichever near-tie
// permutation satisfies the assignment-dependent guards. T3-D found this
// unsafe in one case: mi/stroke#1/W3_truncated gets rescued by
// reassigning to a shorter reference stroke (ref#0 instead of ref#1),
// hiding the truncation.
//
// This script measures "character-relative stroke extent consistency"
// (bbox-diagonal ratio mismatch between the user stroke and whichever
// reference stroke it got assigned to, normalized by each side's own
// character bbox diagonal) as a candidate ACCEPTANCE safety check (not
// an assignment-ranking cost, per Section 9) for whenever the
// Multi-Hypothesis mechanism swaps away from the best-shape-cost
// assignment.
//
// Positive: every character where Multi-Hypothesis activates AND
// changes the outcome from fail to pass (legitimate rescues, e.g. U).
// Negative: the known mi/W3 exploit, plus any other exploit found via
// independent search (see explore-assignment-exploits.js).
'use strict';
const Engine = require('./engine-katakana.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

function strokeDiag(bbox) { return Math.hypot(bbox.width, bbox.height); }

function extentMismatches(trace, refDefs, targetChar) {
  const refFeatures = refDefs.map((s) => {
    const { points, length } = Engine.sampleReferencePath(s.d, 64);
    return Engine.extractStrokeFeatures(points, length);
  });
  const userFeatures = trace.map((s) => {
    const { points, length } = Engine.resampleUserStroke(s, 64);
    return Engine.extractStrokeFeatures(points, length);
  });
  const userDiag = strokeDiag(Engine.computeBBox(userFeatures.flatMap((f) => f.absPoints)));
  const refDiag = strokeDiag(Engine.computeBBox(refFeatures.flatMap((f) => f.absPoints)));
  const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: KATAKANA, targetChar });
  if (!result.assignment) return null;
  const mismatches = result.assignment.map((j, i) => {
    const uf = userFeatures[i], rf = refFeatures[j];
    const uRatio = strokeDiag(uf.bbox) / userDiag;
    const rRatio = strokeDiag(rf.bbox) / refDiag;
    return Math.abs(uRatio - rRatio);
  });
  return { assignment: result.assignment, mismatches, maxMismatch: Math.max(...mismatches), pass: result.pass };
}

const chars = Object.keys(KATAKANA);

console.log('=== Positive: legitimate Multi-Hypothesis rescues (assignment != identity, ends up PASS) ===\n');
const GOOD_TRANSFORMS = [
  ['ideal', (r) => Traces.ideal(r)],
  ['mild_wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['moderate_wobble', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
];
let worstGoodMismatch = 0, worstGoodLabel = '';
const rescueCases = [];
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  GOOD_TRANSFORMS.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const idxAll = refDefs.map((_, i) => i);
    const identity = idxAll; // shape-cost-only identity check via direct evaluation is complex; use assignment != [0..n-1] as a heuristic marker of "swap happened"
    const info = extentMismatches(trace, refDefs, ch);
    if (!info || !info.pass) return;
    const isSwap = info.assignment.some((j, i) => j !== i);
    if (isSwap) {
      rescueCases.push({ ch, label, maxMismatch: info.maxMismatch, assignment: info.assignment });
      if (info.maxMismatch > worstGoodMismatch) { worstGoodMismatch = info.maxMismatch; worstGoodLabel = `${ch}/${label}`; }
    }
  });
});
console.log(`Legitimate swap-and-pass cases found: ${rescueCases.length}`);
rescueCases.forEach((c) => console.log(`  ${c.ch}/${c.label}: assignment=${JSON.stringify(c.assignment)} maxMismatch=${c.maxMismatch.toFixed(4)}`));
console.log(`\nWorst (highest) legitimate mismatch: ${worstGoodMismatch.toFixed(4)} (${worstGoodLabel})`);

console.log('\n=== Negative: known mi/W3 exploit ===\n');
const refDefsMi = KATAKANA['ミ'];
const idealMi = Traces.ideal(refDefsMi);
const refPtsMi = Engine.sampleReferencePath(refDefsMi[1].d, 40).points;
const wrongMi = IW.w3Truncated(refPtsMi);
const traceMi = idealMi.map((s, i) => (i === 1 ? wrongMi : s));
const miInfo = extentMismatches(traceMi, refDefsMi, 'ミ');
console.log(`mi/W3_truncated: assignment=${JSON.stringify(miInfo.assignment)} maxMismatch=${miInfo.maxMismatch.toFixed(4)} pass=${miInfo.pass}`);

console.log('\n=== Separation ===');
console.log(`worstGood=${worstGoodMismatch.toFixed(4)}  exploit(mi)=${miInfo.maxMismatch.toFixed(4)}`);
if (miInfo.maxMismatch > worstGoodMismatch) {
  console.log(`>>> CLEAN SEPARATION exists in (${worstGoodMismatch.toFixed(4)}, ${miInfo.maxMismatch.toFixed(4)})`);
} else {
  console.log('>>> NO clean separation.');
}
