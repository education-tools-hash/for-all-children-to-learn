#!/usr/bin/env node
// Exploratory: order-aware (DTW) distance as a Structural Discrimination
// feature, vs. the existing order-agnostic nearest-point shape/coverage
// metric. DTW should tolerate local speed/timing noise (uneven, backtrack,
// sparse sampling) well by design, while still penalizing a path that
// visits a similar point CLOUD in a genuinely different SEQUENCE (e.g. a
// spiral vs. an open sweep).
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

function intrinsicNormalize(points) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  points.forEach(p=>{ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const scale = 1/Math.max(maxX-minX, maxY-minY, 1e-6);
  return points.map(p=>({x:(p.x-cx)*scale, y:(p.y-cy)*scale}));
}

function dist(a, b) { return Math.hypot(a.x-b.x, a.y-b.y); }

// Classic DTW, normalized by path length (number of steps in the optimal
// warping path) so it's comparable across strokes with different point counts.
function dtwDistance(a, b) {
  const m = a.length, n = b.length;
  const D = Array.from({ length: m + 1 }, () => new Float64Array(n + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = dist(a[i-1], b[j-1]);
      D[i][j] = cost + Math.min(D[i-1][j], D[i][j-1], D[i-1][j-1]);
    }
  }
  return D[m][n] / (m + n); // normalize by path length
}

function bidirectionalDtw(userPts, refPts) {
  const forward = dtwDistance(userPts, refPts);
  const reversed = dtwDistance([...userPts].reverse(), refPts);
  return Math.min(forward, reversed);
}

function strokeDtwDistance(userPtsAbs, refPtsAbs) {
  return bidirectionalDtw(intrinsicNormalize(userPtsAbs), intrinsicNormalize(refPtsAbs));
}

console.log('=== DTW distance: 15 known false-positive pairs (using MAX per pair) ===\n');
const FP_PAIRS = [
  ['そ', 'る'], ['そ', 'ろ'], ['る', 'そ'], ['る', 'ろ'], ['ろ', 'そ'], ['ろ', 'る'],
  ['す', 'よ'], ['ぬ', 'め'], ['ね', 'れ'], ['ね', 'わ'], ['め', 'ぬ'], ['れ', 'ね'], ['わ', 'ね'], ['わ', 'れ'],
  ['け', 'は'],
];
const fpDistances = [];
FP_PAIRS.forEach(([target, source]) => {
  const refDefs = REFERENCE[target];
  const sourceTrace = Traces.ideal(REFERENCE[source]);
  const result = Engine.evaluateCharacter(sourceTrace, refDefs);
  if (!result.assignment) { console.log(`${target} <- ${source}: SKIP`); return; }
  const refFeatures = refDefs.map((s) => Engine.sampleReferencePath(s.d, 64).points);
  const userStrokesAbs = sourceTrace.map((s) => Engine.resampleUserStroke(s, 64).points);
  let maxDist = 0;
  const dists = [];
  userStrokesAbs.forEach((uPts, i) => {
    const rPts = refFeatures[result.assignment[i]];
    const d = strokeDtwDistance(uPts, rPts);
    dists.push(d);
    if (d > maxDist) maxDist = d;
  });
  fpDistances.push(maxDist);
  console.log(`${target} <- ${source}: dtw(max)=${maxDist.toFixed(4)}  (per-stroke: ${dists.map(d=>d.toFixed(4)).join(',')})`);
});

console.log('\n=== Legitimate motor-variation GOOD cases (all 46 chars) ===\n');
const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['scale', (r) => Traces.slightScale(r, 1.1)],
  ['scale_down', (r) => Traces.slightScale(r, 0.9)],
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['reversed_direction', (r) => Traces.reversedDirection(r)],
  ['reversed_order', (r) => Traces.reversedOrder(r)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['dense', (r) => Traces.withDensity(Traces.ideal(r), 200)],
  ['sparse', (r) => Traces.withDensity(Traces.ideal(r), 10)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
];
let worstGoodDist = 0, worstGoodLabel = '';
const allGood = [];
Object.keys(REFERENCE).forEach((ch) => {
  const refDefs = REFERENCE[ch];
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const result = Engine.evaluateCharacter(trace, refDefs);
    if (!result.assignment) return;
    const refFeatures = refDefs.map((s) => Engine.sampleReferencePath(s.d, 64).points);
    const userStrokesAbs = trace.map((s) => Engine.resampleUserStroke(s, 64).points);
    userStrokesAbs.forEach((uPts, i) => {
      const rPts = refFeatures[result.assignment[i]];
      const d = strokeDtwDistance(uPts, rPts);
      allGood.push({ ch, label, i, d });
      if (d > worstGoodDist) { worstGoodDist = d; worstGoodLabel = `${ch}/${label} stroke#${i}`; }
    });
  });
});
console.log(`Worst (highest) DTW distance among ALL legitimate good cases: ${worstGoodDist.toFixed(4)} (${worstGoodLabel})`);
allGood.sort((a,b)=>b.d-a.d);
console.log('Top 15 worst good cases:');
allGood.slice(0,15).forEach(e => console.log(`  ${e.ch}/${e.label} stroke#${e.i}: ${e.d.toFixed(4)}`));

console.log('\n=== Separation check ===');
const minFP = Math.min(...fpDistances);
console.log(`Min DTW distance among false-positive pairs (using MAX per pair): ${minFP.toFixed(4)}`);
console.log(`Worst-case good: ${worstGoodDist.toFixed(4)}`);
if (minFP > worstGoodDist) {
  console.log(`>>> CLEAN SEPARATION. Candidate threshold in (${worstGoodDist.toFixed(4)}, ${minFP.toFixed(4)})`);
} else {
  console.log('>>> NO clean separation with this feature alone.');
}
