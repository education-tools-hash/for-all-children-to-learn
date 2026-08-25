#!/usr/bin/env node
// Phase T3-A — Katakana Tracing Baseline / Portability Audit.
// Investigation only: does NOT modify katakana-app.html, engine.js, or
// hiragana-learn.html. Reuses the existing, unmodified T2 engine.js and
// its existing geometry-agnostic test generators (golden-traces.js,
// independent-wrong-trace.js) against katakana reference data extracted
// by extract-reference-katakana.js.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
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
function toIntrinsicStrokes(trace) {
  return trace.map((s) => Engine.intrinsicNormalize(Engine.resampleUserStroke(s, 64).points));
}

const chars = Object.keys(KATAKANA);
console.log(`=== Section 4: Character Inventory (${chars.length} characters) ===\n`);
const byStrokeCount = {};
chars.forEach((ch) => { const n = KATAKANA[ch].length; (byStrokeCount[n] = byStrokeCount[n] || []).push(ch); });
Object.keys(byStrokeCount).sort().forEach((n) => console.log(`  ${n}画: ${byStrokeCount[n].length}文字 (${byStrokeCount[n].join('')})`));

console.log('\n=== Section 4b: Geometry sanity (degenerate/tiny strokes, extreme aspect ratio) ===\n');
let minLenSeen = Infinity, minLenLabel = '';
let maxAspect = 0, maxAspectLabel = '';
chars.forEach((ch) => {
  const strokes = KATAKANA[ch].map((s) => Engine.sampleReferencePath(s.d, 64));
  strokes.forEach((s, i) => {
    if (s.length < minLenSeen) { minLenSeen = s.length; minLenLabel = `${ch}#${i}`; }
  });
  const allPts = strokes.flatMap((s) => s.points);
  const bbox = Engine.computeBBox(allPts);
  const aspect = Math.max(bbox.width, bbox.height) / Math.max(1e-6, Math.min(bbox.width, bbox.height));
  if (aspect > maxAspect) { maxAspect = aspect; maxAspectLabel = ch; }
});
console.log(`  Shortest reference stroke arc-length: ${minLenSeen.toFixed(2)} (${minLenLabel})`);
console.log(`  Most extreme character bbox aspect ratio: ${maxAspect.toFixed(2)} (${maxAspectLabel})`);

console.log('\n=== Section 6: T2 thresholds applied AS-IS — ideal traces ===\n');
let idealPass = 0, idealFail = 0;
const idealFails = [];
chars.forEach((ch) => {
  const trace = Traces.ideal(KATAKANA[ch]);
  const result = Engine.evaluateCharacter(trace, KATAKANA[ch], { allCharacters: KATAKANA, targetChar: ch });
  if (result.pass) idealPass++; else { idealFail++; idealFails.push({ ch, reason: result.reason, score: result.score }); }
});
console.log(`  ideal: pass=${idealPass}/${chars.length} fail=${idealFail}`);
if (idealFails.length) console.log('  FAILURES:', idealFails);

console.log('\n=== Section 6b: T2 thresholds AS-IS — Motor Accessibility (good-case transforms) ===\n');
const GOOD_CASES = [
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['wobble_018', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['offset_neg', (r) => Traces.slightOffset(r, -0.025, -0.03)],
  ['scale_up', (r) => Traces.slightScale(r, 1.1)],
  ['scale_down', (r) => Traces.slightScale(r, 0.9)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
];
let motorTotal = 0, motorFail = 0;
const motorFails = [];
chars.forEach((ch) => {
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(KATAKANA[ch]);
    if (trace.length !== KATAKANA[ch].length) return;
    motorTotal++;
    const result = Engine.evaluateCharacter(trace, KATAKANA[ch], { allCharacters: KATAKANA, targetChar: ch });
    if (!result.pass) { motorFail++; motorFails.push({ ch, label, reason: result.reason, score: result.score }); }
  });
});
console.log(`  total=${motorTotal} unexpected_fail=${motorFail}`);
if (motorFails.length) { console.log('  FAILURES (first 20):'); motorFails.slice(0, 20).forEach((f) => console.log(`    ${f.ch}/${f.label}: reason=${f.reason} score=${f.score.toFixed(3)}`)); }

console.log('\n=== Section 6c: T2 thresholds AS-IS — bad-case generators (W2/W3/W5/W6, character/geometry-agnostic) ===\n');
function charBBoxOf(refDefs) {
  const all = refDefs.flatMap((s) => Engine.sampleReferencePath(s.d, 20).points);
  return IW.bboxOf(all);
}
let badTotal = 0, badUnexpectedPass = 0;
const badPasses = [];
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  const ideal = Traces.ideal(refDefs);
  const charBBox = charBBoxOf(refDefs);
  refDefs.forEach((_, idx) => {
    const refPts = Engine.sampleReferencePath(refDefs[idx].d, 40).points;
    // W2 shift + W3 truncate on a single stroke, rest ideal
    [
      ['W2_shift', IW.w2Shifted(refPts, charBBox, idx)],
      ['W3_truncated', IW.w3Truncated(refPts)],
    ].forEach(([label, badStroke]) => {
      const trace = ideal.map((s, i) => (i === idx ? badStroke : Engine.resampleUserStroke(s, 40).points));
      badTotal++;
      try {
        const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: KATAKANA, targetChar: ch });
        if (result.pass) { badUnexpectedPass++; badPasses.push({ ch, idx, label, score: result.score }); }
      } catch (e) { console.log(`  CRASH at ${ch}#${idx} ${label}: ${e.message}`); }
    });
  });
  // W5 mirror (whole character) + W6 scale (whole character)
  const mirrorH = ideal.map((s) => IW.w5MirrorHorizontal(s));
  const mirrorV = ideal.map((s) => IW.w5MirrorVertical(s));
  const wrongScale = IW.w6WrongScaleWholeCharacter(ideal, 0.25, charBBox);
  [['W5_mirror_h', mirrorH], ['W5_mirror_v', mirrorV], ['W6_scale25', wrongScale]].forEach(([label, trace]) => {
    badTotal++;
    try {
      const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: KATAKANA, targetChar: ch });
      if (result.pass) { badUnexpectedPass++; badPasses.push({ ch, idx: 'whole', label, score: result.score }); }
    } catch (e) { console.log(`  CRASH at ${ch}#whole ${label}: ${e.message}`); }
  });
});
console.log(`  total=${badTotal} unexpected_pass=${badUnexpectedPass}`);
if (badPasses.length) { console.log('  UNEXPECTED PASSES:'); badPasses.forEach((f) => console.log(`    ${f.ch}#${f.idx} ${f.label}: score=${f.score.toFixed(3)}`)); }

console.log('\n=== Section 5: Cross-character risk — automatic DTW-margin extraction (all same-stroke-count pairs, ideal traces) ===\n');
const results = [];
Object.keys(byStrokeCount).forEach((n) => {
  const group = byStrokeCount[n];
  if (group.length < 2) return;
  group.forEach((target) => {
    const targetIdealAsIntrinsic = toIntrinsicStrokes(Traces.ideal(KATAKANA[target]));
    group.forEach((source) => {
      if (source === target) return;
      // Feed source's ideal trace, ask: how close is it to target vs to itself(source)?
      const sourceTrace = toIntrinsicStrokes(Traces.ideal(KATAKANA[source]));
      const targetAvg = avgDtwToCandidate(sourceTrace, KATAKANA[target]);
      const selfAvg = avgDtwToCandidate(sourceTrace, KATAKANA[source]);
      const margin = targetAvg - selfAvg; // small margin = source could pass as target
      results.push({ target, source, n, targetAvg, selfAvg, margin });
    });
  });
});
results.sort((a, b) => a.margin - b.margin);
console.log(`Total ordered pairs evaluated: ${results.length}`);
console.log('Top 20 highest-risk pairs (lowest margin = source most likely to be confused with target):');
results.slice(0, 20).forEach((r) => console.log(`  target=${r.target} source=${r.source} (${r.n}画) targetAvg=${r.targetAvg.toFixed(4)} selfAvg=${r.selfAvg.toFixed(4)} margin=${r.margin.toFixed(4)}`));

console.log('\n=== Section 10: Performance — same-stroke-count candidate pool sizes (katakana vs hiragana) ===\n');
console.log('Katakana:', Object.fromEntries(Object.entries(byStrokeCount).map(([n, g]) => [n, g.length])));
try {
  const HIRAGANA = require('./fixtures/reference-data-full.generated.js');
  const hCounts = {};
  Object.values(HIRAGANA).forEach((v) => { hCounts[v.length] = (hCounts[v.length] || 0) + 1; });
  console.log('Hiragana (T2 baseline):', hCounts);
} catch (e) { console.log('(hiragana reference fixture not found for comparison)'); }
