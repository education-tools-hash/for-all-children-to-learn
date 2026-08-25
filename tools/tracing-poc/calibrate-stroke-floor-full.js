#!/usr/bin/env node
// Phase T2-B'' — data-driven STROKE_QUALITY_FLOOR calibration.
// GOOD side: minimum per-stroke score across every existing motor-variation
//            golden case, for all 5 characters (must stay ABOVE the floor).
// BAD side: straight-line substitute for EVERY stroke position (not just the
//           last), for all 5 characters (must fall BELOW the floor).
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const REFERENCE = require('./fixtures/reference-data.generated.js');

const CHARS = ['い', 'く', 'こ', 'あ', 'ま'];

function minPerStrokeScore(result) {
  return Math.min(...result.strokes.map((s) => s.perStrokeScore));
}

// Candidate alternate metric: shape/coverage only (excludes startEnd/direction,
// which a straight-line or blob substitute can satisfy trivially just by
// sharing the real stroke's start & end point).
function minShapeCoverage(result) {
  return Math.min(...result.strokes.map((s) => Math.min(s.shape, s.coverage)));
}

function straightLineSubstitute(refDefs, idx) {
  const ideal = Traces.ideal(refDefs);
  const target = ideal[idx];
  const p0 = target[0], p1 = target[target.length - 1];
  const n = 20;
  const line = Array.from({ length: n }, (_, i) => ({
    x: p0.x + (p1.x - p0.x) * (i / (n - 1)),
    y: p0.y + (p1.y - p0.y) * (i / (n - 1)),
  }));
  return ideal.map((s, i) => (i === idx ? line : s));
}

const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble 0.012', (r) => Traces.mildWobble(r, 0.012, 10)],
  ['wobble 0.018', (r) => Traces.mildWobble(r, 0.018, 11)],
  ['offset +', (r) => Traces.slightOffset(r, 0.03, 0.02)],
  ['offset -', (r) => Traces.slightOffset(r, -0.025, -0.03)],
  ['scale 1.12', (r) => Traces.slightScale(r, 1.12)],
  ['scale 0.9', (r) => Traces.slightScale(r, 0.9)],
  ['uneven', (r) => Traces.mildlyUneven(r, 20)],
  ['reversed direction', (r) => Traces.reversedDirection(r)],
  ['reversed order', (r) => Traces.reversedOrder(r)],
  ['dense 200', (r) => Traces.withDensity(Traces.ideal(r), 200)],
  ['sparse 10', (r) => Traces.withDensity(Traces.ideal(r), 10)],
  ['irregular', (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40)],
  ['tremor', (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50)],
  ['pause', (r) => Traces.withBriefPause(Traces.ideal(r))],
  ['backtrack', (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60)],
];

function analyze(metricFn, metricName) {
  console.log(`\n########## Metric: ${metricName} ##########`);

  console.log('\n-- GOOD side (motor-variation cases) --');
  let worstGood = Infinity, worstGoodLabel = '';
  CHARS.forEach((ch) => {
    const refDefs = REFERENCE[ch];
    GOOD_CASES.forEach(([label, fn]) => {
      const strokes = fn(refDefs);
      if (strokes.length !== refDefs.length) return;
      const result = Engine.evaluateCharacter(strokes, refDefs);
      const m = metricFn(result);
      if (m < worstGood) { worstGood = m; worstGoodLabel = `${ch} / ${label}`; }
    });
  });
  console.log(`Worst (lowest) min-metric among ALL good cases: ${worstGood.toFixed(3)}  (${worstGoodLabel})`);

  console.log('\n-- BAD side (straight-line substitute, every stroke position) --');
  let bestBad = -Infinity, bestBadLabel = '';
  CHARS.forEach((ch) => {
    const refDefs = REFERENCE[ch];
    refDefs.forEach((_, idx) => {
      const strokes = straightLineSubstitute(refDefs, idx);
      const result = Engine.evaluateCharacter(strokes, refDefs);
      const s = result.strokes[idx];
      const m = metricFn({ strokes: [s] }); // metric only cares about this one stroke
      console.log(`${ch} stroke#${idx}: shape=${s.shape.toFixed(3)} coverage=${s.coverage.toFixed(3)} metric=${m.toFixed(3)}`);
      if (m > bestBad) { bestBad = m; bestBadLabel = `${ch} stroke#${idx}`; }
    });
  });
  console.log(`Best (highest) metric among straight-line substitutes: ${bestBad.toFixed(3)}  (${bestBadLabel})`);

  if (worstGood > bestBad) {
    console.log(`>>> Clean separation: any floor in (${bestBad.toFixed(3)}, ${worstGood.toFixed(3)}) works. Suggested = ${((worstGood + bestBad) / 2).toFixed(2)}`);
  } else {
    console.log(`>>> NO clean separation (worstGood=${worstGood.toFixed(3)} <= bestBad=${bestBad.toFixed(3)}).`);
  }
}

analyze(minPerStrokeScore, 'perStrokeScore (current composite)');
analyze(minShapeCoverage, 'min(shape, coverage)');
