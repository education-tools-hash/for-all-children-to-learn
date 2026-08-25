#!/usr/bin/env node
// Phase T3-B Section 9 — Relative Character Risk Calibration for
// katakana. Focuses on the risk pairs identified in T3-A
// (ヲ/テ, ス/ヌ, ユ/コ, エ/キ, ソ/ハ, メ/ハ, ヒ/セ), measuring BOTH:
//   (a) wrong-character margin: feed the SIBLING's ideal trace as an
//       attempt at the TARGET -> margin should be comfortably positive
//       (target is clearly worse than the true match).
//   (b) good-case margin: feed the TARGET's own trace WITH legitimate
//       motor variation (wobble/moderate wobble/offset/uneven) -> its
//       margin against the risk-pair sibling should stay comfortably
//       negative/low (i.e. NOT drift toward "sibling looks closer").
// Does not modify engine.js. Uses engine.js unmodified (Relative
// Character Discrimination itself is not katakana-recalibrated — only
// Position Guard needed a katakana-specific value, per T3-B Section 8).
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function dtwDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = new Float64Array(n + 1).fill(Infinity); prev[0] = 0;
  for (let i = 1; i <= m; i++) {
    const cur = new Float64Array(n + 1).fill(Infinity);
    for (let j = 1; j <= n; j++) {
      const cost = dist(a[i - 1], b[j - 1]);
      cur[j] = cost + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    prev = cur;
  }
  return prev[n] / (m + n);
}
function structuralDistance(u, r) { return Math.min(dtwDistance(u, r), dtwDistance([...u].reverse(), r)); }
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  arr.forEach((item, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    permutations(rest).forEach((p) => result.push([item].concat(p)));
  });
  return result;
}
function avgDtwToCandidate(userIntrinsicStrokes, candidateRefDefs) {
  const n = userIntrinsicStrokes.length;
  if (candidateRefDefs.length !== n) return Infinity;
  const candFeatures = candidateRefDefs.map((s) => Engine.intrinsicNormalize(Engine.sampleReferencePath(s.d, 64).points));
  const costMatrix = userIntrinsicStrokes.map((u) => candFeatures.map((c) => structuralDistance(u, c)));
  const idx = candFeatures.map((_, i) => i);
  let best = Infinity;
  permutations(idx).forEach((perm) => {
    let cost = 0;
    for (let i = 0; i < n; i++) cost += costMatrix[i][perm[i]];
    if (cost < best) best = cost;
  });
  return best / n;
}
function toIntrinsicStrokes(trace) { return trace.map((s) => Engine.intrinsicNormalize(Engine.resampleUserStroke(s, 64).points)); }

const RISK_PAIRS = [['ヲ', 'テ'], ['ス', 'ヌ'], ['ユ', 'コ'], ['エ', 'キ'], ['ソ', 'ハ'], ['メ', 'ハ'], ['ヒ', 'セ']];

console.log('=== A. Wrong-character margin (sibling ideal fed as target attempt) ===\n');
const wrongMargins = [];
RISK_PAIRS.forEach(([a, b]) => {
  [[a, b], [b, a]].forEach(([target, source]) => {
    const sourceTrace = toIntrinsicStrokes(Traces.ideal(KATAKANA[source]));
    const targetAvg = avgDtwToCandidate(sourceTrace, KATAKANA[target]);
    const selfAvg = avgDtwToCandidate(sourceTrace, KATAKANA[source]);
    const margin = targetAvg - selfAvg;
    wrongMargins.push({ target, source, margin });
    console.log(`  target=${target} source=${source}: targetAvg=${targetAvg.toFixed(4)} selfAvg=${selfAvg.toFixed(4)} margin=${margin.toFixed(4)}`);
  });
});
const minWrongMargin = Math.min(...wrongMargins.map((m) => m.margin));
console.log(`\nMin wrong-character margin across risk pairs: ${minWrongMargin.toFixed(4)}`);

console.log('\n=== B. Good-case margin under motor variation (target w/ noise vs risk-pair sibling) ===\n');
const GOOD_TRANSFORMS = [
  ['ideal', (r) => Traces.ideal(r)],
  ['mild_wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['moderate_wobble', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['offset_neg', (r) => Traces.slightOffset(r, -0.025, -0.03)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
];
let worstGoodMargin = -Infinity, worstGoodLabel = '';
const goodMargins = [];
RISK_PAIRS.forEach(([a, b]) => {
  [[a, b], [b, a]].forEach(([target, sibling]) => {
    GOOD_TRANSFORMS.forEach(([label, fn]) => {
      const trace = fn(KATAKANA[target]);
      if (trace.length !== KATAKANA[target].length) return;
      const userStrokes = toIntrinsicStrokes(trace);
      const targetAvg = avgDtwToCandidate(userStrokes, KATAKANA[target]);
      const siblingAvg = avgDtwToCandidate(userStrokes, KATAKANA[sibling]);
      const margin = targetAvg - siblingAvg; // should stay well below 0 (target closer to itself than sibling)
      goodMargins.push({ target, sibling, label, margin });
      if (margin > worstGoodMargin) { worstGoodMargin = margin; worstGoodLabel = `${target}/${label} (vs sibling ${sibling})`; }
    });
  });
});
console.log(`Worst (highest, most "sibling-like") good-case margin: ${worstGoodMargin.toFixed(4)} (${worstGoodLabel})`);
goodMargins.sort((a, b) => b.margin - a.margin);
console.log('Top 10 highest-margin good cases (closest calls):');
goodMargins.slice(0, 10).forEach((e) => console.log(`  ${e.target}/${e.label} vs ${e.sibling}: margin=${e.margin.toFixed(4)}`));

console.log('\n=== Separation ===');
console.log(`Min wrong-character margin: ${minWrongMargin.toFixed(4)}`);
console.log(`Worst good-case margin: ${worstGoodMargin.toFixed(4)}`);
console.log(`Current RELATIVE_DISCRIMINATION_MARGIN threshold: ${Engine.THRESHOLDS.RELATIVE_DISCRIMINATION_MARGIN}`);
if (minWrongMargin > worstGoodMargin) {
  console.log(`>>> CLEAN SEPARATION exists in (${worstGoodMargin.toFixed(4)}, ${minWrongMargin.toFixed(4)})`);
  const t = Engine.THRESHOLDS.RELATIVE_DISCRIMINATION_MARGIN;
  console.log(`>>> Unmodified threshold ${t} is ${(t > worstGoodMargin && t < minWrongMargin) ? 'SAFELY inside the window (no change needed)' : 'OUTSIDE the safe window — needs review'}`);
} else {
  console.log('>>> NO clean separation — motor variation and wrong-character distributions overlap for these risk pairs.');
}

console.log('\n=== ヲ/テ detailed focus ===\n');
['ヲ', 'テ'].forEach((target) => {
  const sibling = target === 'ヲ' ? 'テ' : 'ヲ';
  GOOD_TRANSFORMS.forEach(([label, fn]) => {
    const trace = fn(KATAKANA[target]);
    if (trace.length !== KATAKANA[target].length) return;
    const userStrokes = toIntrinsicStrokes(trace);
    const targetAvg = avgDtwToCandidate(userStrokes, KATAKANA[target]);
    const siblingAvg = avgDtwToCandidate(userStrokes, KATAKANA[sibling]);
    console.log(`  ${target}/${label}: targetAvg=${targetAvg.toFixed(4)} siblingAvg(${sibling})=${siblingAvg.toFixed(4)} margin=${(targetAvg - siblingAvg).toFixed(4)}`);
  });
});
