#!/usr/bin/env node
// Exploratory (not wired into engine.js yet): test whether a coarse
// "turning/direction profile" can separate the 15 known cross-character
// false-positive pairs from legitimate motor-variation cases, BEFORE
// committing to wiring it into the Engine.
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

function smooth(points, windowRadius) {
  if (!windowRadius) return points;
  const n = points.length;
  return points.map((_, i) => {
    let sx = 0, sy = 0, count = 0;
    for (let k = -windowRadius; k <= windowRadius; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      sx += points[j].x; sy += points[j].y; count++;
    }
    return { x: sx / count, y: sy / count };
  });
}

function directionAngles(points, numSegments) {
  const n = points.length;
  const segLen = (n - 1) / numSegments;
  const angles = [];
  for (let s = 0; s < numSegments; s++) {
    const i0 = Math.round(s * segLen);
    const i1 = Math.round((s + 1) * segLen);
    const dx = points[i1].x - points[i0].x, dy = points[i1].y - points[i0].y;
    angles.push(Math.atan2(dy, dx));
  }
  return angles;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

function profileDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += angleDiff(a[i], b[i]);
  return sum / a.length;
}

function bidirectionalProfileDistance(userAngles, refAngles) {
  const forward = profileDistance(userAngles, refAngles);
  const reversedFlipped = profileDistance(
    [...userAngles].reverse().map((a) => a + Math.PI),
    refAngles
  );
  return Math.min(forward, reversedFlipped);
}

function strokeTurningDistance(userPtsAbs, refPtsAbs, numSegments, smoothRadius) {
  const u = directionAngles(smooth(intrinsicNormalize(userPtsAbs), smoothRadius), numSegments);
  const r = directionAngles(smooth(intrinsicNormalize(refPtsAbs), smoothRadius), numSegments);
  return bidirectionalProfileDistance(u, r);
}

const NUM_SEGMENTS = Number(process.argv[2] || 8);
const SMOOTH_RADIUS = Number(process.argv[3] || 0);
console.log(`(NUM_SEGMENTS=${NUM_SEGMENTS}, SMOOTH_RADIUS=${SMOOTH_RADIUS})`);

console.log('=== Turning-profile distance: 15 known false-positive pairs ===\n');
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
  if (result.reason === 'stroke_count_mismatch') { console.log(`${target} <- ${source}: SKIP (count mismatch)`); return; }
  // per matched stroke, compute turning distance
  const assignment = result.assignment;
  const refFeatures = refDefs.map((s) => {
    const { points } = Engine.sampleReferencePath(s.d, 64);
    return points;
  });
  const userStrokesAbs = sourceTrace.map((s) => Engine.resampleUserStroke(s, 64).points);
  let maxDist = 0;
  const dists = [];
  userStrokesAbs.forEach((uPts, i) => {
    const rPts = refFeatures[assignment[i]];
    const d = strokeTurningDistance(uPts, rPts, NUM_SEGMENTS, SMOOTH_RADIUS);
    dists.push(d);
    if (d > maxDist) maxDist = d;
  });
  const avgDist = dists.reduce((a,b)=>a+b,0)/dists.length;
  fpDistances.push(avgDist);
  console.log(`${target} <- ${source}: pass=${result.pass} score=${result.score.toFixed(3)}  turningDist(avg)=${avgDist.toFixed(3)} (max=${maxDist.toFixed(3)}) rad`);
});

console.log('\n=== Turning-profile distance: legitimate motor-variation GOOD cases (all 46 chars) ===\n');
const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['scale', (r) => Traces.slightScale(r, 1.1)],
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['reversed_direction', (r) => Traces.reversedDirection(r)],
  ['reversed_order', (r) => Traces.reversedOrder(r)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['dense', (r) => Traces.withDensity(Traces.ideal(r), 200)],
  ['sparse', (r) => Traces.withDensity(Traces.ideal(r), 10)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['scale_down', (r) => Traces.slightScale(r, 0.9)],
  ['offset_neg', (r) => Traces.slightOffset(r, -0.025, -0.03)],
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
      const d = strokeTurningDistance(uPts, rPts, NUM_SEGMENTS, SMOOTH_RADIUS);
      allGood.push({ ch, label, i, d });
      if (d > worstGoodDist) { worstGoodDist = d; worstGoodLabel = `${ch}/${label} stroke#${i}`; }
    });
  });
});
console.log(`Worst (highest) turning distance among ALL legitimate good cases: ${worstGoodDist.toFixed(3)} rad  (${worstGoodLabel})`);
allGood.sort((a,b)=>b.d-a.d);
console.log('Top 15 worst good cases:');
allGood.slice(0,15).forEach(e => console.log(`  ${e.ch}/${e.label} stroke#${e.i}: ${e.d.toFixed(3)}`));

console.log('\n=== Separation check ===');
const minFP = Math.min(...fpDistances);
console.log(`Min turning distance among false-positive pairs: ${minFP.toFixed(3)} rad`);
console.log(`Worst-case good: ${worstGoodDist.toFixed(3)} rad`);
if (minFP > worstGoodDist) {
  console.log(`>>> CLEAN SEPARATION. Candidate threshold in (${worstGoodDist.toFixed(3)}, ${minFP.toFixed(3)})`);
} else {
  console.log('>>> NO clean separation with this feature alone.');
}
