#!/usr/bin/env node
// Phase T2-C' — Independent Negative Validation (Section 3-6, 8).
//
// Every negative trace here is built from reference geometry ONLY —
// independent-wrong-trace.js never calls Engine.evaluateCharacter while
// constructing a candidate. Engine.evaluateCharacter is called exactly
// once per case, at the very end, purely to READ the result — never to
// choose or adjust the candidate. This is the key difference from
// tools/tracing-poc/wrong-trace-generator.js (Phase T2-C), which is a
// calibration tool, not a validation oracle.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

const CHARS = Object.keys(REFERENCE);
const PASS_THRESHOLD = Engine.THRESHOLDS.PASS_THRESHOLD; // reading a static config value, not an evaluation
const AMBIGUOUS_BAND = 0.45; // reporting-only cutoff, does not affect the Engine

function refSamplePoints(strokeDef, n) {
  return Engine.sampleReferencePath(strokeDef.d, n || 40).points;
}

function charBBoxOf(refDefs) {
  const all = refDefs.flatMap((s) => refSamplePoints(s, 20));
  return IW.bboxOf(all);
}

// ---------------------------------------------------------------------
// Section 4: Single-Bad-Stroke (W1-W4), every stroke position, every
// multi-stroke character. No Engine query during generation.
// ---------------------------------------------------------------------
let singleBadTotal = 0, singleBadUnexpectedPass = 0;
const singleBadAmbiguous = [];
const singleBadFalsePositive = [];

const W_METHODS = [
  ['W1_perpendicular', (pts) => IW.w1Perpendicular(pts, 20)],
  ['W2_shifted', null], // needs charBBox + index, handled specially below
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
      const result = Engine.evaluateCharacter(trace, refDefs);
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
// Section 5-6: Cross-Character Confusion — for every same-stroke-count
// pair (A = target reference, B's ideal trace fed in as the "attempt"),
// check whether writing character B is incorrectly accepted as A.
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

Object.entries(byStrokeCount).forEach(([n, group]) => {
  group.forEach((target) => {
    group.forEach((source) => {
      if (target === source) return;
      crossTotal++;
      const sourceTrace = Traces.ideal(REFERENCE[source]);
      const result = Engine.evaluateCharacter(sourceTrace, REFERENCE[target]);
      const entry = { target, source, strokeCount: Number(n), score: result.score, pass: result.pass };
      if (result.pass) crossFalsePositive.push(entry);
      else if (result.score >= AMBIGUOUS_BAND) crossAmbiguous.push(entry);
      else crossClearFail.push(entry);
    });
  });
});

// ---------------------------------------------------------------------
// Section 3: whole-character W5 (mirror) / W6 (wrong scale) / W7 (wrong
// stroke count) — independent, no Engine query during generation.
// ---------------------------------------------------------------------
let wholeCharTotal = 0;
const wholeCharUnexpectedPass = [];

CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const ideal = Traces.ideal(refDefs);

  const mirrorH = ideal.map((s) => IW.w5MirrorHorizontal(s));
  const mirrorV = ideal.map((s) => IW.w5MirrorVertical(s));
  const wrongScale = ideal.map((s) => IW.w6WrongScale(s, 0.25));
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
    const result = Engine.evaluateCharacter(trace, refDefs);
    if (result.pass) wholeCharUnexpectedPass.push({ ch, method: label, score: result.score });
  });
});

// ---------------------------------------------------------------------
// Section 8: Motor Accessibility regression re-check (existing Positive
// cases, all 46 characters) — must remain 0 False Negatives.
// ---------------------------------------------------------------------
let positiveTotal = 0, positiveFailed = 0;
const positiveFailures = [];
const POSITIVE_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['offset', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['scale', (r) => Traces.slightScale(r, 1.1)],
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
];
CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  POSITIVE_CASES.forEach(([label, fn]) => {
    positiveTotal++;
    const result = Engine.evaluateCharacter(fn(refDefs), refDefs);
    if (!result.pass) { positiveFailed++; positiveFailures.push({ ch, label, score: result.score }); }
  });
});

// ---------------------------------------------------------------------
// Section 7: Pilot Regression Lock (い/あ) — re-affirm explicitly.
// ---------------------------------------------------------------------
const lockChecks = [];
function lockCheck(label, expected, result) {
  lockChecks.push({ label, expected, actual: result.pass, score: result.score, ok: result.pass === expected });
}
{
  const ii = REFERENCE['い'];
  lockCheck('い ideal', true, Engine.evaluateCharacter(Traces.ideal(ii), ii));
  lockCheck('い wobble', true, Engine.evaluateCharacter(Traces.mildWobble(ii, 0.012, 10), ii));
  const bbox = charBBoxOf(ii);
  const y1 = bbox.minY + (bbox.maxY - bbox.minY) * 0.28, y2 = bbox.minY + (bbox.maxY - bbox.minY) * 0.72;
  const x0 = bbox.minX + (bbox.maxX - bbox.minX) * 0.15, x1 = bbox.minX + (bbox.maxX - bbox.minX) * 0.85;
  const line = (y) => Array.from({ length: 20 }, (_, i) => ({ x: x0 + (x1 - x0) * i / 19, y }));
  lockCheck('い ニ横線', false, Engine.evaluateCharacter([line(y1), line(y2)], ii));
  const vline = (x) => Array.from({ length: 20 }, (_, i) => ({ x, y: bbox.minY + (bbox.maxY - bbox.minY) * i / 19 }));
  lockCheck('い 縦線2本', false, Engine.evaluateCharacter([vline(bbox.minX + (bbox.maxX - bbox.minX) * 0.3), vline(bbox.minX + (bbox.maxX - bbox.minX) * 0.7)], ii));
  lockCheck('い tiny', false, Engine.evaluateCharacter(Traces.tinyStrokes(ii, 0.15), ii));

  const aa = REFERENCE['あ'];
  lockCheck('あ ideal', true, Engine.evaluateCharacter(Traces.ideal(aa), aa));
  lockCheck('あ wobble', true, Engine.evaluateCharacter(Traces.mildWobble(aa, 0.012, 10), aa));
  const idealA = Traces.ideal(aa);
  const partial3rd = idealA.map((s, i) => (i === 2 ? s.slice(0, Math.round(s.length * 0.5)) : s));
  lockCheck('あ partial 3rd', false, Engine.evaluateCharacter(partial3rd, aa));
  const p0 = idealA[2][0], p1 = idealA[2][idealA[2].length - 1];
  const straight3rd = idealA.map((s, i) => (i === 2 ? Array.from({ length: 20 }, (_, j) => ({ x: p0.x + (p1.x - p0.x) * j / 19, y: p0.y + (p1.y - p0.y) * j / 19 })) : s));
  lockCheck('あ straight 3rd', false, Engine.evaluateCharacter(straight3rd, aa));
  const zigzag3rd = idealA.map((s, i) => (i === 2 ? IW.w4Zigzag(refSamplePoints(aa[2], 40), 20) : s));
  lockCheck('あ zigzag 3rd', false, Engine.evaluateCharacter(zigzag3rd, aa));
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------
console.log('=== Phase T2-C\' Independent Negative Validation ===\n');

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
if (crossAmbiguous.length) {
  console.log(`  AMBIGUOUS pairs (score>=${AMBIGUOUS_BAND}, still correctly RETRY):`);
  crossAmbiguous.sort((a, b) => b.score - a.score).forEach((e) => console.log(`    ${e.target} <- ${e.source}  score=${e.score.toFixed(3)}  (${e.strokeCount}画)`));
}

console.log('\n--- Motor Accessibility regression (Positive cases, all 46 chars) ---');
console.log(`total=${positiveTotal}  failed=${positiveFailed}`);
positiveFailures.forEach((e) => console.log(`    [${e.ch}] ${e.label} score=${e.score.toFixed(3)}`));

console.log('\n--- Pilot Regression Lock (い/あ) ---');
lockChecks.forEach((c) => console.log(`  [${c.ok ? 'OK  ' : 'FAIL'}] ${c.label}: expected=${c.expected} actual=${c.actual} score=${c.score.toFixed(3)}`));

const lockFailed = lockChecks.filter((c) => !c.ok).length;
const overallProblem = singleBadFalsePositive.length > 0 || crossFalsePositive.length > 0 || positiveFailed > 0 || lockFailed > 0;

console.log('\n=== Result ===');
console.log(`Single-bad-stroke false positives: ${singleBadFalsePositive.length}`);
console.log(`Cross-character false positives: ${crossFalsePositive.length}`);
console.log(`Motor-accessibility false negatives: ${positiveFailed}`);
console.log(`Pilot regression lock failures: ${lockFailed}`);
console.log(overallProblem ? 'PROBLEMS FOUND — see above' : 'ALL INDEPENDENT CHECKS CLEAN');
process.exitCode = overallProblem ? 1 : 0;
