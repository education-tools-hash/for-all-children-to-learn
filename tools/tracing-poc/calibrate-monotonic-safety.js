#!/usr/bin/env node
// Phase T3-D1 — Candidate B (improvement consistency) calibration.
//
// Hypothesis: a LEGITIMATE Multi-Hypothesis correction (e.g. U) improves
// every affected stroke's completion/position when switching away from
// the best-shape-cost assignment (the original assignment was simply
// wrong for all its strokes). An EXPLOIT (e.g. mi/W3) instead trades one
// stroke's improvement for another stroke's regression (reassigning to a
// different reference stroke that fits the good stroke better while
// making the bad stroke look artificially more complete than it truly
// is relative to its real target). Safety check: only accept an
// alternative assignment if NO stroke's completion or position gets
// WORSE than under the best-shape-cost assignment (allowing a small
// TOLERANCE for measurement noise, calibrated below — not decided
// arbitrarily).
'use strict';
const Engine = require('./engine-katakana.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  arr.forEach((item, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    permutations(rest).forEach((p) => result.push([item].concat(p)));
  });
  return result;
}

// Returns null if no true Multi-Hypothesis rescue happened (bestPerm
// already satisfies assignment-dependent guards, or bestPerm === chosen).
// Otherwise returns the worst per-stroke regression (completion or
// position getting WORSE under chosen vs bestPerm), or null regression
// if none regressed.
function analyzeRescue(trace, refDefs, targetChar) {
  const refFeatures = refDefs.map((s) => {
    const { points, length } = Engine.sampleReferencePath(s.d, 64);
    return Object.assign(Engine.extractStrokeFeatures(points, length), { label: s.label });
  });
  const userFeatures = trace.map((s) => {
    const { points, length } = Engine.resampleUserStroke(s, 64);
    return Engine.extractStrokeFeatures(points, length);
  });
  const charBBox = { width: Math.max(...refFeatures.flatMap(f=>[f.bbox.maxX])) , height: 0 };
  const allRefPts = refFeatures.flatMap((f) => f.absPoints);
  const cbbox = Engine.computeBBox(allRefPts);
  const charDiag = Math.hypot(cbbox.width, cbbox.height);
  const { assignment: bestPerm, costMatrix } = Engine.matchStrokes(userFeatures, refFeatures);
  const n = userFeatures.length;
  if (n < 2) return null;

  const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: KATAKANA, targetChar });
  if (!result.assignment) return null;
  const sameAsBest = bestPerm.every((j, i) => j === result.assignment[i]);
  if (sameAsBest) return null; // no rescue happened, nothing to check

  function metricsFor(perm) {
    return perm.map((j, i) => {
      const uf = userFeatures[i], rf = refFeatures[j];
      return {
        completion: Engine.progressSpan(uf.absPoints, rf.absPoints),
        position: Engine.strokePositionMetric(uf.absPoints, rf.absPoints, charDiag),
      };
    });
  }
  const bestMetrics = metricsFor(bestPerm);
  const chosenMetrics = metricsFor(result.assignment);
  const completionDeltas = bestMetrics.map((b, i) => chosenMetrics[i].completion - b.completion);
  const positionDeltas = bestMetrics.map((b, i) => b.position - chosenMetrics[i].position); // positive = improved (lower is better for position)
  const worstCompletionRegression = Math.min(...completionDeltas); // most negative = worst regression
  const worstPositionRegression = Math.min(...positionDeltas);
  return {
    bestPerm, chosenPerm: result.assignment, pass: result.pass,
    completionDeltas, positionDeltas, worstCompletionRegression, worstPositionRegression,
    isMonotonicImprovement: worstCompletionRegression >= -1e-9 && worstPositionRegression >= -1e-9,
  };
}

const chars = Object.keys(KATAKANA);

console.log('=== Legitimate rescues: worst per-stroke regression when switching assignment ===\n');
let worstRegression = 0, worstLabel = '';
let rescueCount = 0, monotonicCount = 0;
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  for (let seed = 1; seed <= 20; seed++) {
    [
      ['mild', Traces.mildWobble(refDefs, 0.012, seed)],
      ['moderate', Traces.mildWobble(refDefs, 0.018, seed)],
      ['uneven', Traces.mildlyUneven(refDefs, seed)],
    ].forEach(([label, trace]) => {
      if (trace.length !== refDefs.length) return;
      const info = analyzeRescue(trace, refDefs, ch);
      if (!info || !info.pass) return;
      rescueCount++;
      if (info.isMonotonicImprovement) monotonicCount++;
      if (info.worstCompletionRegression < worstRegression) { worstRegression = info.worstCompletionRegression; worstLabel = `${ch}/${label}/seed${seed} (completion)`; }
      if (info.worstPositionRegression < worstRegression) { worstRegression = info.worstPositionRegression; worstLabel = `${ch}/${label}/seed${seed} (position)`; }
    });
  }
});
console.log(`Total legitimate rescue-and-pass cases: ${rescueCount}, monotonic (no regression): ${monotonicCount}`);
console.log(`Worst (most negative) regression seen among LEGITIMATE rescues: ${worstRegression.toFixed(4)} (${worstLabel})`);

console.log('\n=== mi/W3 exploit ===\n');
const refDefsMi = KATAKANA['ミ'];
const idealMi = Traces.ideal(refDefsMi);
const refPtsMi = Engine.sampleReferencePath(refDefsMi[1].d, 40).points;
const wrongMi = IW.w3Truncated(refPtsMi);
const traceMi = idealMi.map((s, i) => (i === 1 ? wrongMi : s));
const miInfo = analyzeRescue(traceMi, refDefsMi, 'ミ');
console.log(`mi/W3_truncated: pass=${miInfo.pass} worstCompletionRegression=${miInfo.worstCompletionRegression.toFixed(4)} worstPositionRegression=${miInfo.worstPositionRegression.toFixed(4)} isMonotonicImprovement=${miInfo.isMonotonicImprovement}`);

console.log('\n=== Independent exploit search (W1-W4, all 46 chars/strokes) — checking monotonicity ===\n');
function charBBoxOf(refDefs) {
  const all = refDefs.flatMap((s) => Engine.sampleReferencePath(s.d, 20).points);
  return IW.bboxOf(all);
}
const W_METHODS = [
  ['W1_perpendicular', (pts) => IW.w1Perpendicular(pts, 20)],
  ['W2_shifted', null],
  ['W3_truncated', (pts) => IW.w3Truncated(pts)],
  ['W4_zigzag', (pts) => IW.w4Zigzag(pts, 20)],
];
let exploitsFoundNonMonotonic = 0, exploitsFoundMonotonic = 0;
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  const n = refDefs.length;
  if (n < 2) return;
  const idealTrace = Traces.ideal(refDefs);
  const charBBox = charBBoxOf(refDefs);
  for (let idx = 0; idx < n; idx++) {
    const refPts = Engine.sampleReferencePath(refDefs[idx].d, 40).points;
    W_METHODS.forEach(([label, fn]) => {
      const wrong = label === 'W2_shifted' ? IW.w2Shifted(refPts, charBBox, idx) : fn(refPts);
      const trace = idealTrace.map((s, i) => (i === idx ? wrong : s));
      const info = analyzeRescue(trace, refDefs, ch);
      if (!info || !info.pass) return;
      if (info.isMonotonicImprovement) { exploitsFoundMonotonic++; console.log(`  MONOTONIC unexpected pass: [${ch}] stroke#${idx} ${label}`); }
      else { exploitsFoundNonMonotonic++; console.log(`  NON-MONOTONIC (would be blocked): [${ch}] stroke#${idx} ${label} worstRegression=${info.worstCompletionRegression.toFixed(4)}/${info.worstPositionRegression.toFixed(4)}`); }
    });
  }
});
console.log(`\nExploits that WOULD be blocked by monotonicity check: ${exploitsFoundNonMonotonic}`);
console.log(`Exploits that would SURVIVE (monotonic improvement, real correction): ${exploitsFoundMonotonic}`);
