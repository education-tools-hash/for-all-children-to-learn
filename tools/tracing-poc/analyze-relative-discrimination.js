#!/usr/bin/env node
// Phase T2-C''' Section 15-19: Relative Character Discrimination.
// Instead of an absolute DTW hard gate, compare "how close is the user's
// trace to the TARGET character" vs "how close is it to the best-matching
// OTHER character with the same stroke count" — only flag when another
// character is CLEARLY closer (a margin), not merely closer.
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
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function dtwDistance(a, b) {
  const m=a.length,n=b.length;
  let prev=new Float64Array(n+1).fill(Infinity); prev[0]=0;
  for(let i=1;i<=m;i++){ const cur=new Float64Array(n+1).fill(Infinity);
    for(let j=1;j<=n;j++){ const cost=dist(a[i-1],b[j-1]); cur[j]=cost+Math.min(prev[j],cur[j-1],prev[j-1]); }
    prev=cur; }
  return prev[n]/(m+n);
}
function structuralDistance(u,r){ return Math.min(dtwDistance(u,r), dtwDistance([...u].reverse(),r)); }

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  arr.forEach((item, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    permutations(rest).forEach((p) => result.push([item].concat(p)));
  });
  return result;
}

// Average DTW distance between userFeatures (already resampled+intrinsic)
// and a candidate character's reference, using the best (min-cost)
// permutation assignment (shape-cost based, reusing Engine's own strokeCost
// via a lightweight local re-implementation to avoid depending on
// non-exported internals).
function avgDtwToCandidate(userIntrinsicStrokes, candidateRefDefs) {
  const n = userIntrinsicStrokes.length;
  if (candidateRefDefs.length !== n) return Infinity;
  const candFeatures = candidateRefDefs.map((s) => intrinsicNormalize(Engine.sampleReferencePath(s.d, 64).points));
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

const byStrokeCount = {};
Object.keys(REFERENCE).forEach((ch) => {
  const n = REFERENCE[ch].length;
  (byStrokeCount[n] = byStrokeCount[n] || []).push(ch);
});

function bestOther(userIntrinsicStrokes, target) {
  const n = userIntrinsicStrokes.length;
  const group = byStrokeCount[n];
  let bestChar = null, bestAvg = Infinity;
  group.forEach((cand) => {
    if (cand === target) return;
    const avg = avgDtwToCandidate(userIntrinsicStrokes, REFERENCE[cand]);
    if (avg < bestAvg) { bestAvg = avg; bestChar = cand; }
  });
  return { bestChar, bestAvg };
}

function toIntrinsicStrokes(trace) {
  return trace.map((s) => intrinsicNormalize(Engine.resampleUserStroke(s, 64).points));
}

console.log('=== Known cross-character WRONG inputs: target margin ===\n');
const FP_PAIRS = [
  ['そ','る'],['そ','ろ'],['る','そ'],['る','ろ'],['ろ','そ'],['ろ','る'],
  ['ぬ','め'],['め','ぬ'],['ね','れ'],['ね','わ'],['れ','ね'],['わ','ね'],['わ','れ'],
  ['け','は'],['す','よ'],
];
const wrongMargins = [];
FP_PAIRS.forEach(([target, source]) => {
  const trace = Traces.ideal(REFERENCE[source]);
  const userStrokes = toIntrinsicStrokes(trace);
  const targetAvg = avgDtwToCandidate(userStrokes, REFERENCE[target]);
  const { bestChar, bestAvg } = bestOther(userStrokes, target);
  const margin = targetAvg - bestAvg; // positive: some other char is closer than target
  wrongMargins.push(margin);
  console.log(`target=${target} input=${source}: targetAvg=${targetAvg.toFixed(4)} bestOther=${bestChar}(${bestAvg.toFixed(4)}) margin=${margin.toFixed(4)}`);
});

console.log('\n=== GOOD cases: target margin (should be <= 0, target should usually be its own best match) ===\n');
const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['wobble_018', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['offset_neg', (r) => Traces.slightOffset(r, -0.025, -0.03)],
  ['scale_up', (r) => Traces.slightScale(r, 1.1)],
  ['scale_down', (r) => Traces.slightScale(r, 0.9)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
];
let worstGoodMargin = -Infinity, worstGoodLabel = '';
const goodMargins = [];
// Limit to a representative subset of characters for runtime (permutation
// search across up to 19 candidates x up to 24 perms x good cases is
// expensive if run for all 46 - sample broadly across stroke-count groups).
const SAMPLE_CHARS = ['い','く','こ','あ','ま','そ','る','ろ','ぬ','め','ね','れ','わ','け','は','う','き','た','も','の'];
SAMPLE_CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const userStrokes = toIntrinsicStrokes(trace);
    const targetAvg = avgDtwToCandidate(userStrokes, refDefs);
    const { bestChar, bestAvg } = bestOther(userStrokes, ch);
    const margin = targetAvg - bestAvg;
    goodMargins.push({ ch, label, margin, bestChar });
    if (margin > worstGoodMargin) { worstGoodMargin = margin; worstGoodLabel = `${ch}/${label} (bestOther=${bestChar})`; }
  });
});
console.log(`Worst (highest, i.e. most "other-character-like") margin among GOOD cases: ${worstGoodMargin.toFixed(4)}  (${worstGoodLabel})`);
goodMargins.sort((a,b)=>b.margin-a.margin);
console.log('Top 10 highest-margin good cases:');
goodMargins.slice(0,10).forEach(e => console.log(`  ${e.ch}/${e.label}: margin=${e.margin.toFixed(4)} bestOther=${e.bestChar}`));

console.log('\n=== Separation ===');
const minWrongMargin = Math.min(...wrongMargins);
console.log(`Min margin among known-wrong cross-character inputs: ${minWrongMargin.toFixed(4)}`);
console.log(`Worst-case good margin: ${worstGoodMargin.toFixed(4)}`);
if (minWrongMargin > worstGoodMargin) console.log(`>>> CLEAN SEPARATION possible. Candidate margin threshold in (${worstGoodMargin.toFixed(4)}, ${minWrongMargin.toFixed(4)})`);
else console.log('>>> NO clean separation with plain margin>0 gate.');
