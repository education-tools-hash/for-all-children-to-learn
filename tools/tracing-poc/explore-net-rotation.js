#!/usr/bin/env node
// Exploratory: "net rotation" (signed cumulative turning angle over the
// whole stroke) as a coarse, GLOBAL shape descriptor. Unlike a per-segment
// turning profile, summing signed increments lets local noise (which is
// roughly zero-mean) cancel out, so it should be far more robust to
// uneven/backtrack/sparse motor-variation noise while still separating
// "big loop" characters from "simple curve" characters.
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

function wrapAngle(d) {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Net rotation via COARSE segment-to-segment direction changes (not raw
// adjacent-sample points, which are too close together at 64-point
// resolution — noise smaller than the segment length completely dominates
// the computed angle between two nearly-coincident points). Each segment
// spans a meaningful fraction of the stroke, so a single point's noise is
// diluted across many points before a direction is computed.
const NET_ROTATION_SEGMENTS = Number(process.argv[2] || 12);

function netRotation(points, numSegments) {
  numSegments = numSegments || NET_ROTATION_SEGMENTS;
  const n = points.length;
  const segLen = (n - 1) / numSegments;
  const angles = [];
  for (let s = 0; s < numSegments; s++) {
    const i0 = Math.round(s * segLen), i1 = Math.round((s + 1) * segLen);
    const dx = points[i1].x - points[i0].x, dy = points[i1].y - points[i0].y;
    angles.push(Math.atan2(dy, dx));
  }
  let total = 0;
  for (let i = 1; i < angles.length; i++) total += wrapAngle(angles[i] - angles[i-1]);
  return total;
}

function strokeNetRotationDistance(userPtsAbs, refPtsAbs) {
  const u = netRotation(intrinsicNormalize(userPtsAbs));
  const r = netRotation(intrinsicNormalize(refPtsAbs));
  // direction-agnostic (SOFT policy): compare magnitude difference, and
  // also allow a sign flip (reversed drawing direction reverses rotation sign)
  return Math.min(Math.abs(u - r), Math.abs(u + r));
}

console.log('=== Net rotation: reference values for problem clusters ===\n');
['そ','る','ろ','ぬ','め','ね','れ','わ','け','は','す','よ'].forEach(ch => {
  const strokes = REFERENCE[ch].map(s => Engine.sampleReferencePath(s.d, 64).points);
  const rot = strokes.map(pts => netRotation(intrinsicNormalize(pts)));
  console.log(`${ch}: ${rot.map(r=>r.toFixed(2)).join(', ')} rad`);
});

console.log('\n=== 15 known false-positive pairs ===\n');
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
    const d = strokeNetRotationDistance(uPts, rPts);
    dists.push(d);
    if (d > maxDist) maxDist = d;
  });
  fpDistances.push(maxDist);
  console.log(`${target} <- ${source}: rotDist(max)=${maxDist.toFixed(3)} rad  (per-stroke: ${dists.map(d=>d.toFixed(2)).join(',')})`);
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
      const d = strokeNetRotationDistance(uPts, rPts);
      allGood.push({ ch, label, i, d });
      if (d > worstGoodDist) { worstGoodDist = d; worstGoodLabel = `${ch}/${label} stroke#${i}`; }
    });
  });
});
console.log(`Worst (highest) rotation distance among ALL legitimate good cases: ${worstGoodDist.toFixed(3)} rad (${worstGoodLabel})`);
allGood.sort((a,b)=>b.d-a.d);
console.log('Top 15 worst good cases:');
allGood.slice(0,15).forEach(e => console.log(`  ${e.ch}/${e.label} stroke#${e.i}: ${e.d.toFixed(3)}`));

console.log('\n=== Separation check ===');
const minFP = Math.min(...fpDistances);
console.log(`Min rotation distance among false-positive pairs (using MAX per pair): ${minFP.toFixed(3)} rad`);
console.log(`Worst-case good: ${worstGoodDist.toFixed(3)} rad`);
if (minFP > worstGoodDist) {
  console.log(`>>> CLEAN SEPARATION. Candidate threshold in (${worstGoodDist.toFixed(3)}, ${minFP.toFixed(3)})`);
} else {
  console.log('>>> NO clean separation with this feature alone.');
}
