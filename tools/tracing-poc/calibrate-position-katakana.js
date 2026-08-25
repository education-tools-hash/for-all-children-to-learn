#!/usr/bin/env node
// Phase T3-B Section 7 — Position Guard calibration for katakana.
// Measures the FULL positionMetric distribution for good-case (legitimate
// motor variation) vs bad-case (W2 large shift) inputs against katakana
// reference data, to determine whether a clean separation exists at
// STROKE_POSITION_MAX=0.26 (T2's unmodified value) or whether ANY single
// non-character-specific threshold could achieve clean separation.
// Does not modify engine.js or any production file.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function centroidOf(points) {
  let sx = 0, sy = 0;
  points.forEach((p) => { sx += p.x; sy += p.y; });
  return { x: sx / points.length, y: sy / points.length };
}
function positionMetric(userAbsPts, refAbsPts, charDiag) {
  const uC = centroidOf(userAbsPts), rC = centroidOf(refAbsPts);
  return dist(uC, rC) / charDiag;
}
function charBBoxOf(refDefs) {
  const all = refDefs.flatMap((s) => Engine.sampleReferencePath(s.d, 20).points);
  return IW.bboxOf(all);
}

const chars = Object.keys(KATAKANA);

console.log('=== GOOD case positionMetric distribution (all 46 katakana chars) ===\n');
const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['mild_wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['moderate_wobble', (r) => Traces.mildWobble(r, 0.018, 11)],
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
let worstGood = 0, worstGoodLabel = '';
const allGood = [];
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  const charDiag = Math.hypot(charBBoxOf(refDefs).width, charBBoxOf(refDefs).height);
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: KATAKANA, targetChar: ch });
    if (!result.assignment) return;
    trace.forEach((userStroke, i) => {
      const j = result.assignment[i];
      const refPts = Engine.sampleReferencePath(refDefs[j].d, 40).points;
      const userPts = Engine.resampleUserStroke(userStroke, 40).points;
      const m = positionMetric(userPts, refPts, charDiag);
      allGood.push({ ch, label, i, m });
      if (m > worstGood) { worstGood = m; worstGoodLabel = `${ch}/${label} stroke#${i}`; }
    });
  });
});
console.log(`Worst (highest) GOOD positionMetric: ${worstGood.toFixed(4)} (${worstGoodLabel})`);
allGood.sort((a, b) => b.m - a.m);
console.log('Top 25 highest-position-metric good cases:');
allGood.slice(0, 25).forEach((e) => console.log(`  ${e.ch}/${e.label} stroke#${e.i}: ${e.m.toFixed(4)}`));

console.log('\n=== Focus: U/shi/mi/yo (T3-A failing chars) good-case positionMetric ===\n');
['ウ', 'シ', 'ミ', 'ヨ'].forEach((ch) => {
  const rows = allGood.filter((e) => e.ch === ch).sort((a, b) => b.m - a.m);
  console.log(`  ${ch}: worst=${rows[0].m.toFixed(4)} (${rows[0].label} stroke#${rows[0].i})`);
  rows.slice(0, 4).forEach((r) => console.log(`      ${r.label} stroke#${r.i}: ${r.m.toFixed(4)}`));
});

console.log('\n=== BAD case (W2 large shift) positionMetric distribution ===\n');
let bestBad = Infinity, bestBadLabel = '';
const allBad = [];
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  const charBBox = charBBoxOf(refDefs);
  const charDiag = Math.hypot(charBBox.width, charBBox.height);
  refDefs.forEach((_, idx) => {
    const refPts = Engine.sampleReferencePath(refDefs[idx].d, 40).points;
    const shifted = IW.w2Shifted(refPts, charBBox, idx);
    const m = positionMetric(shifted, refPts, charDiag);
    allBad.push({ ch, idx, m });
    if (m < bestBad) { bestBad = m; bestBadLabel = `${ch} stroke#${idx}`; }
  });
});
console.log(`Best (lowest, hardest-to-catch) BAD positionMetric: ${bestBad.toFixed(4)} (${bestBadLabel})`);
allBad.sort((a, b) => a.m - b.m);
console.log('Bottom 15 lowest-position-metric bad cases:');
allBad.slice(0, 15).forEach((e) => console.log(`  ${e.ch} stroke#${e.idx}: ${e.m.toFixed(4)}`));

console.log('\n=== Separation ===');
console.log(`worstGood=${worstGood.toFixed(4)}  bestBad(W2)=${bestBad.toFixed(4)}`);
if (bestBad > worstGood) {
  console.log(`>>> CLEAN SEPARATION exists in (${worstGood.toFixed(4)}, ${bestBad.toFixed(4)})`);
  console.log(`>>> T2's unmodified STROKE_POSITION_MAX=0.26: ${bestBad > 0.26 && worstGood < 0.26 ? 'ALREADY inside the safe window (no change needed)' : (0.26 < worstGood ? 'TOO STRICT for katakana (causes false negatives)' : 'too loose (would miss bad cases)')}`);
} else {
  console.log('>>> NO clean separation. Position Metric design problem for katakana under W2 as currently defined.');
}
