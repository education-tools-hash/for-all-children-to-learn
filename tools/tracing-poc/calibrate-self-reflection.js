#!/usr/bin/env node
// Phase T3-C'' Section 12 — Self-Reflection Discrimination calibration.
// Measures margin distribution for GOOD cases (legitimate motor
// variation, including reverse-direction strokes) vs actual W5
// whole-character mirror attacks, across all 46 katakana characters,
// to determine whether clean separation exists.
'use strict';
const Engine = require('./engine-katakana-candidate-selfreflect.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

function toIntrinsicStrokes(trace) {
  return trace.map((s) => Engine.intrinsicNormalize(Engine.resampleUserStroke(s, 64).points));
}

const chars = Object.keys(KATAKANA);

console.log('=== GOOD case margin (should be well below threshold) ===\n');
const GOOD_TRANSFORMS = [
  ['ideal', (r) => Traces.ideal(r)],
  ['mild_wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['moderate_wobble', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['reversed_direction', (r) => Traces.ideal(r).map((s) => [...s].reverse())],
];
let worstGood = -Infinity, worstGoodLabel = '';
const allGood = [];
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  GOOD_TRANSFORMS.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const userStrokes = toIntrinsicStrokes(trace);
    const r = Engine.selfReflectionDiscrimination(userStrokes, refDefs);
    if (!r) return;
    allGood.push({ ch, label, margin: r.margin });
    if (r.margin > worstGood) { worstGood = r.margin; worstGoodLabel = `${ch}/${label}`; }
  });
});
console.log(`Worst (highest, most "mirror-like") GOOD margin: ${worstGood.toFixed(4)} (${worstGoodLabel})`);
allGood.sort((a, b) => b.margin - a.margin);
console.log('Top 15 highest-margin good cases:');
allGood.slice(0, 15).forEach((e) => console.log(`  ${e.ch}/${e.label}: margin=${e.margin.toFixed(4)}`));

console.log('\n=== W5 mirror attack margin (should be well above threshold) ===\n');
let bestMirror = Infinity, bestMirrorLabel = '';
const allMirror = [];
chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  const ideal = Traces.ideal(refDefs);
  const mirrorH = ideal.map((s) => IW.w5MirrorHorizontal(s));
  const mirrorV = ideal.map((s) => IW.w5MirrorVertical(s));
  [['H', mirrorH], ['V', mirrorV]].forEach(([label, trace]) => {
    const userStrokes = toIntrinsicStrokes(trace);
    const r = Engine.selfReflectionDiscrimination(userStrokes, refDefs);
    if (!r) return;
    allMirror.push({ ch, label, margin: r.margin });
    if (r.margin < bestMirror) { bestMirror = r.margin; bestMirrorLabel = `${ch}${label}`; }
  });
});
console.log(`Best (lowest, hardest-to-catch) MIRROR margin: ${bestMirror.toFixed(4)} (${bestMirrorLabel})`);
allMirror.sort((a, b) => a.margin - b.margin);
console.log('Bottom 15 lowest-margin mirror cases:');
allMirror.slice(0, 15).forEach((e) => console.log(`  ${e.ch}${e.label}: margin=${e.margin.toFixed(4)}`));

console.log('\n=== Separation ===');
console.log(`worstGood=${worstGood.toFixed(4)}  bestMirror=${bestMirror.toFixed(4)}`);
if (bestMirror > worstGood) {
  console.log(`>>> CLEAN SEPARATION exists in (${worstGood.toFixed(4)}, ${bestMirror.toFixed(4)})`);
} else {
  console.log('>>> NO clean separation — good and mirror distributions overlap.');
}
