#!/usr/bin/env node
// Phase T3-B — Katakana Independent Negative Validation.
// Same methodology as golden-tests-independent46.js (Phase T2-C'), ported
// to katakana: uses engine-katakana.js (the ONLY diff from engine.js is
// STROKE_POSITION_MAX=0.355, katakana-calibrated — see
// calibrate-position-katakana.js) and reference-data-katakana.generated.js.
//
// Every negative trace here is built from reference geometry ONLY —
// independent-wrong-trace.js never calls Engine.evaluateCharacter while
// constructing a candidate.
'use strict';
const Engine = require('./engine-katakana.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const REFERENCE = require('./fixtures/reference-data-katakana.generated.js');

const CHARS = Object.keys(REFERENCE);
const AMBIGUOUS_BAND = 0.45;

function refSamplePoints(strokeDef, n) {
  return Engine.sampleReferencePath(strokeDef.d, n || 40).points;
}
function charBBoxOf(refDefs) {
  const all = refDefs.flatMap((s) => refSamplePoints(s, 20));
  return IW.bboxOf(all);
}

// ---------------------------------------------------------------------
// Single-Bad-Stroke (W1-W4), every stroke position, every multi-stroke
// character. No Engine query during generation.
// ---------------------------------------------------------------------
let singleBadTotal = 0, singleBadUnexpectedPass = 0;
const singleBadAmbiguous = [];
const singleBadFalsePositive = [];

const W_METHODS = [
  ['W1_perpendicular', (pts) => IW.w1Perpendicular(pts, 20)],
  ['W2_shifted', null],
  ['W3_truncated', (pts) => IW.w3Truncated(pts)],
  ['W4_zigzag', (pts) => IW.w4Zigzag(pts, 20)],
];

CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const n = refDefs.length;
  if (n < 2) return;
  const idealTrace = Traces.ideal(refDefs);
  const charBBox = charBBoxOf(refDefs);

  for (let idx = 0; idx < n; idx++) {
    const refPts = refSamplePoints(refDefs[idx], 40);
    W_METHODS.forEach(([label, fn]) => {
      const wrong = label === 'W2_shifted' ? IW.w2Shifted(refPts, charBBox, idx) : fn(refPts);
      const trace = idealTrace.map((s, i) => (i === idx ? wrong : s));
      const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: REFERENCE, targetChar: ch });
      singleBadTotal++;
      if (result.pass) {
        singleBadUnexpectedPass++;
        const entry = { ch, stroke: idx, method: label, score: result.score };
        if (result.score >= AMBIGUOUS_BAND) singleBadAmbiguous.push(entry);
        else singleBadFalsePositive.push(entry);
      }
    });
  }
});

// ---------------------------------------------------------------------
// Cross-Character Confusion — every same-stroke-count pair.
// ---------------------------------------------------------------------
const byStrokeCount = {};
CHARS.forEach((ch) => {
  const n = REFERENCE[ch].length;
  (byStrokeCount[n] = byStrokeCount[n] || []).push(ch);
});

let crossTotal = 0;
const crossClearFail = [];
const crossAmbiguous = [];
const crossFalsePositive = [];
const crossByPair = {};

Object.entries(byStrokeCount).forEach(([n, group]) => {
  group.forEach((target) => {
    group.forEach((source) => {
      if (target === source) return;
      crossTotal++;
      const sourceTrace = Traces.ideal(REFERENCE[source]);
      const result = Engine.evaluateCharacter(sourceTrace, REFERENCE[target], { allCharacters: REFERENCE, targetChar: target });
      const entry = { target, source, strokeCount: Number(n), score: result.score, pass: result.pass };
      crossByPair[`${target}<-${source}`] = entry;
      if (result.pass) crossFalsePositive.push(entry);
      else if (result.score >= AMBIGUOUS_BAND) crossAmbiguous.push(entry);
      else crossClearFail.push(entry);
    });
  });
});

// ---------------------------------------------------------------------
// Whole-character W5 (mirror) / W6 (wrong scale) / W7 (wrong stroke
// count).
// ---------------------------------------------------------------------
let wholeCharTotal = 0;
const wholeCharUnexpectedPass = [];

CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const ideal = Traces.ideal(refDefs);

  const mirrorH = ideal.map((s) => IW.w5MirrorHorizontal(s));
  const mirrorV = ideal.map((s) => IW.w5MirrorVertical(s));
  const wrongScale = IW.w6WrongScaleWholeCharacter(ideal, 0.25, charBBoxOf(refDefs));
  const wrongCountExtra = ideal.concat([ideal[ideal.length - 1]]);
  const wrongCountMissing = Traces.incompleteStrokeCount(refDefs);

  [
    ['W5_mirror_horizontal', mirrorH],
    ['W5_mirror_vertical', mirrorV],
    ['W6_wrong_scale', wrongScale],
    ['W7_extra_stroke', wrongCountExtra],
    ['W7_missing_stroke', wrongCountMissing],
  ].forEach(([label, trace]) => {
    wholeCharTotal++;
    const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: REFERENCE, targetChar: ch });
    if (result.pass) wholeCharUnexpectedPass.push({ ch, method: label, score: result.score });
  });
});

// ---------------------------------------------------------------------
// Motor Accessibility regression (Positive cases, all 46 katakana chars).
// ---------------------------------------------------------------------
let positiveTotal = 0, positiveFailed = 0;
const positiveFailures = [];
const POSITIVE_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['moderate_wobble', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['scale', (r) => Traces.slightScale(r, 1.1)],
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
];
CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  POSITIVE_CASES.forEach(([label, fn]) => {
    positiveTotal++;
    const result = Engine.evaluateCharacter(fn(refDefs), refDefs, { allCharacters: REFERENCE, targetChar: ch });
    if (!result.pass) { positiveFailed++; positiveFailures.push({ ch, label, reason: result.reason, score: result.score }); }
  });
});

// ---------------------------------------------------------------------
// Risk Pair spot-check (T3-A auto-extracted candidates), pulled from the
// cross-character results computed above.
// ---------------------------------------------------------------------
const RISK_PAIRS = [['ヲ', 'テ'], ['ス', 'ヌ'], ['ユ', 'コ'], ['エ', 'キ'], ['ソ', 'ハ'], ['メ', 'ハ'], ['ヒ', 'セ']];
const riskResults = [];
RISK_PAIRS.forEach(([a, b]) => {
  riskResults.push(crossByPair[`${a}<-${b}`]);
  riskResults.push(crossByPair[`${b}<-${a}`]);
});

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------
console.log('=== Phase T3-B Katakana Independent Negative Validation ===\n');

console.log('--- Single-Bad-Stroke (W1-W4, no Engine query during generation) ---');
console.log(`total=${singleBadTotal}  unexpected_pass=${singleBadUnexpectedPass}  (ambiguous=${singleBadAmbiguous.length}  false_positive=${singleBadFalsePositive.length})`);
if (singleBadAmbiguous.length) {
  console.log('  AMBIGUOUS:');
  singleBadAmbiguous.forEach((e) => console.log(`    [${e.ch}] stroke#${e.stroke} ${e.method} score=${e.score.toFixed(3)}`));
}
if (singleBadFalsePositive.length) {
  console.log('  FALSE POSITIVE:');
  singleBadFalsePositive.forEach((e) => console.log(`    [${e.ch}] stroke#${e.stroke} ${e.method} score=${e.score.toFixed(3)}`));
}

console.log('\n--- Whole-Character W5(mirror)/W6(scale)/W7(count) ---');
console.log(`total=${wholeCharTotal}  unexpected_pass=${wholeCharUnexpectedPass.length}`);
wholeCharUnexpectedPass.forEach((e) => console.log(`    [${e.ch}] ${e.method} score=${e.score.toFixed(3)}`));

console.log('\n--- Cross-Character Confusion (same stroke-count pairs) ---');
console.log(`total pairs=${crossTotal}  clear_fail=${crossClearFail.length}  ambiguous=${crossAmbiguous.length}  FALSE_POSITIVE=${crossFalsePositive.length}`);
Object.keys(byStrokeCount).sort().forEach((n) => {
  const g = byStrokeCount[n];
  console.log(`  ${n}画: ${g.length}文字 -> ${g.length * (g.length - 1)} pairs`);
});
if (crossFalsePositive.length) {
  console.log('  FALSE POSITIVE pairs (target <- source):');
  crossFalsePositive.forEach((e) => console.log(`    ${e.target} <- ${e.source}  score=${e.score.toFixed(3)}  (${e.strokeCount}画)`));
}

console.log('\n--- Risk Pair spot-check (T3-A auto-extracted candidates) ---');
riskResults.forEach((e) => console.log(`  ${e.target} <- ${e.source}: pass=${e.pass} score=${e.score.toFixed(3)}`));

console.log('\n--- Motor Accessibility regression (Positive cases, all 46 chars) ---');
console.log(`total=${positiveTotal}  failed=${positiveFailed}`);
positiveFailures.forEach((e) => console.log(`    [${e.ch}] ${e.label} reason=${e.reason} score=${e.score.toFixed(3)}`));

const overallProblem = singleBadFalsePositive.length > 0 || crossFalsePositive.length > 0 || positiveFailed > 0;

console.log('\n=== Result ===');
console.log(`Single-bad-stroke false positives: ${singleBadFalsePositive.length}`);
console.log(`Cross-character false positives: ${crossFalsePositive.length}`);
console.log(`Motor-accessibility false negatives: ${positiveFailed}`);
console.log(overallProblem ? 'PROBLEMS FOUND — see above' : 'ALL INDEPENDENT CHECKS CLEAN');
