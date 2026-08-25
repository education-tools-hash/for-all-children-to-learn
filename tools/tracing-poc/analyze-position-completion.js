#!/usr/bin/env node
// Phase T2-C''' Section 8-13: calibrate Per-Stroke Position Guard and
// Completion/Progress Guard using Good (legitimate motor variation) vs
// Bad (W2 large shift / partial completion) distributions.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function centroidOf(points) {
  let sx = 0, sy = 0;
  points.forEach((p) => { sx += p.x; sy += p.y; });
  return { x: sx / points.length, y: sy / points.length };
}

function charBBoxOf(refDefs) {
  const all = refDefs.flatMap((s) => Engine.sampleReferencePath(s.d, 20).points);
  return Engine.computeBBox(all);
}

// --- Position metric: per-stroke centroid distance / character diagonal ---
function positionMetric(userAbsPts, refAbsPts, charDiag) {
  const uC = centroidOf(userAbsPts), rC = centroidOf(refAbsPts);
  return dist(uC, rC) / charDiag;
}

console.log('=== Per-Stroke Position metric: GOOD cases ===\n');
const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['wobble_018', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['offset_neg', (r) => Traces.slightOffset(r, -0.025, -0.03)],
  ['scale_up', (r) => Traces.slightScale(r, 1.1)],
  ['scale_down', (r) => Traces.slightScale(r, 0.9)],
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['dense', (r) => Traces.withDensity(Traces.ideal(r), 200)],
  ['sparse', (r) => Traces.withDensity(Traces.ideal(r), 10)],
];
let worstGoodPos = 0, worstGoodPosLabel = '';
const allPos = [];
Object.keys(REFERENCE).forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const charDiag = Math.hypot(charBBoxOf(refDefs).width, charBBoxOf(refDefs).height);
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const result = Engine.evaluateCharacter(trace, refDefs);
    if (!result.assignment) return;
    trace.forEach((userStroke, i) => {
      const j = result.assignment[i];
      const refPts = Engine.sampleReferencePath(refDefs[j].d, 40).points;
      const userPts = Engine.resampleUserStroke(userStroke, 40).points;
      const m = positionMetric(userPts, refPts, charDiag);
      allPos.push({ ch, label, i, m });
      if (m > worstGoodPos) { worstGoodPos = m; worstGoodPosLabel = `${ch}/${label} stroke#${i}`; }
    });
  });
});
console.log(`Worst (highest) position-metric among GOOD cases: ${worstGoodPos.toFixed(4)}  (${worstGoodPosLabel})`);
allPos.sort((a,b)=>b.m-a.m);
console.log('Top 15 highest-position-metric good cases:');
allPos.slice(0,15).forEach(e => console.log(`  ${e.ch}/${e.label} stroke#${e.i}: ${e.m.toFixed(4)}`));

console.log('\n=== Per-Stroke Position metric: W2 (large shift) BAD cases ===\n');
let bestBadPos = Infinity, bestBadPosLabel = '';
Object.keys(REFERENCE).forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const charBBox = charBBoxOf(refDefs);
  const charDiag = Math.hypot(charBBox.width, charBBox.height);
  const ideal = Traces.ideal(refDefs);
  refDefs.forEach((_, idx) => {
    const refPts = Engine.sampleReferencePath(refDefs[idx].d, 40).points;
    const shifted = IW.w2Shifted(refPts, charBBox, idx);
    const m = positionMetric(shifted, refPts, charDiag);
    if (m < bestBadPos) { bestBadPos = m; bestBadPosLabel = `${ch} stroke#${idx}`; }
  });
});
console.log(`Best (lowest, i.e. hardest to catch) position-metric among W2 shifted cases: ${bestBadPos.toFixed(4)}  (${bestBadPosLabel})`);

console.log('\n=== Separation ===');
console.log(`worstGood=${worstGoodPos.toFixed(4)}  bestBad(W2)=${bestBadPos.toFixed(4)}`);
if (bestBadPos > worstGoodPos) console.log(`>>> CLEAN SEPARATION possible in (${worstGoodPos.toFixed(4)}, ${bestBadPos.toFixed(4)})`);
else console.log('>>> NO clean separation with this metric alone.');

// ============================================================
// Completion / Progress Span metric
// ============================================================
console.log('\n\n=== Completion (progress span) metric ===\n');

function bboxTransformParams(points) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  points.forEach(p=>{ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const scale = 1/Math.max(maxX-minX, maxY-minY, 1e-6);
  return { cx, cy, scale };
}
function applyTransform(points, t) {
  return points.map(p=>({x:(p.x-t.cx)*t.scale, y:(p.y-t.cy)*t.scale}));
}

function progressSpan(userPtsAbs, refPtsAbs) {
  // Both point sets are normalized using the REFERENCE stroke's OWN
  // transform (not each deriving its own bbox independently). A truncated
  // or incomplete user stroke must NOT get to "re-center and re-scale
  // itself to fill the unit box" — that would make a small fragment look
  // artificially well-spread. The reference's transform defines what
  // "full progression" means; the user's points are mapped into that same
  // frame so a genuinely incomplete stroke reads as incomplete.
  const t = bboxTransformParams(refPtsAbs);
  const userPts = applyTransform(userPtsAbs, t);
  const refPts = applyTransform(refPtsAbs, t);
  const N = refPts.length;
  const progresses = userPts.map((up) => {
    let best = Infinity, bestIdx = 0;
    refPts.forEach((rp, i) => {
      const d = dist(up, rp);
      if (d < best) { best = d; bestIdx = i; }
    });
    return bestIdx / (N - 1);
  });
  const forwardSpan = Math.max(...progresses) - Math.min(...progresses);
  // direction-agnostic: also try treating reference as reversed (1 - progress)
  const reversedProgresses = progresses.map((p) => 1 - p);
  const reversedSpan = Math.max(...reversedProgresses) - Math.min(...reversedProgresses);
  return Math.max(forwardSpan, reversedSpan);
}

function truncated(points, frac) {
  const cut = Math.max(2, Math.round(points.length * frac));
  return points.slice(0, cut);
}

console.log('Completion sweep (25/45/60/75/85/100%), averaged over all 46 chars/strokes:');
[0.25, 0.45, 0.60, 0.75, 0.85, 1.0].forEach((frac) => {
  let sum = 0, count = 0, min = Infinity;
  Object.keys(REFERENCE).forEach((ch) => {
    REFERENCE[ch].forEach((s) => {
      const refPts = Engine.sampleReferencePath(s.d, 64).points;
      const userPts = truncated(refPts, frac); // truncate the ideal ref itself, as a stand-in for "user only got this far"
      const span = progressSpan(userPts, refPts);
      sum += span; count++;
      if (span < min) min = span;
    });
  });
  console.log(`  ${(frac*100).toFixed(0)}%: avg span=${(sum/count).toFixed(3)}  min span=${min.toFixed(3)}`);
});

console.log('\nGOOD case progress span (should be near 1.0 always):');
const GOOD_CASES_FULL = GOOD_CASES.concat([
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['dense', (r) => Traces.withDensity(Traces.ideal(r), 200)],
  ['sparse', (r) => Traces.withDensity(Traces.ideal(r), 10)],
]);
let worstGoodSpan = Infinity, worstGoodSpanLabel = '';
const allSpans = [];
Object.keys(REFERENCE).forEach((ch) => {
  const refDefs = REFERENCE[ch];
  GOOD_CASES_FULL.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const result = Engine.evaluateCharacter(trace, refDefs);
    if (!result.assignment) return;
    trace.forEach((userStroke, i) => {
      const j = result.assignment[i];
      const refPts = Engine.sampleReferencePath(refDefs[j].d, 64).points;
      const userPts = Engine.resampleUserStroke(userStroke, 64).points;
      const span = progressSpan(userPts, refPts);
      allSpans.push({ ch, label, i, span });
      if (span < worstGoodSpan) { worstGoodSpan = span; worstGoodSpanLabel = `${ch}/${label} stroke#${i}`; }
    });
  });
});
console.log(`Worst (lowest) progress span among GOOD cases: ${worstGoodSpan.toFixed(3)}  (${worstGoodSpanLabel})`);
allSpans.sort((a,b)=>a.span-b.span);
console.log('Bottom 15 lowest-span good cases:');
allSpans.slice(0,15).forEach(e => console.log(`  ${e.ch}/${e.label} stroke#${e.i}: ${e.span.toFixed(3)}`));
