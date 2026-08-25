#!/usr/bin/env node
// Phase T2-C''' Section 4: quantify how tight the current DTW hard-gate
// margin actually is across the full Motor Accessibility suite.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble_012', (r) => Traces.mildWobble(r, 0.012, 10)],
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
  ['reversed_direction', (r) => Traces.reversedDirection(r)],
  ['reversed_order', (r) => Traces.reversedOrder(r)],
];

const dtwValues = [];
Object.keys(REFERENCE).forEach((ch) => {
  const refDefs = REFERENCE[ch];
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const result = Engine.evaluateCharacter(trace, refDefs);
    if (!result.assignment) return;
    result.strokes.forEach((s) => dtwValues.push({ ch, label, d: s.structuralDistance }));
  });
});

dtwValues.sort((a, b) => a.d - b.d);
function percentile(p) {
  const idx = Math.floor((dtwValues.length - 1) * p);
  return dtwValues[idx];
}

console.log(`Total samples: ${dtwValues.length}`);
console.log(`min:  ${dtwValues[0].d.toFixed(4)}  (${dtwValues[0].ch}/${dtwValues[0].label})`);
console.log(`p50:  ${percentile(0.50).d.toFixed(4)}`);
console.log(`p90:  ${percentile(0.90).d.toFixed(4)}`);
console.log(`p95:  ${percentile(0.95).d.toFixed(4)}`);
console.log(`p99:  ${percentile(0.99).d.toFixed(4)}  (${percentile(0.99).ch}/${percentile(0.99).label})`);
console.log(`max:  ${dtwValues[dtwValues.length - 1].d.toFixed(4)}  (${dtwValues[dtwValues.length - 1].ch}/${dtwValues[dtwValues.length - 1].label})`);
console.log(`\ncurrent STRUCTURAL_MAX_DISTANCE = ${Engine.THRESHOLDS.STRUCTURAL_MAX_DISTANCE}`);
const nearThreshold = dtwValues.filter((v) => v.d > Engine.THRESHOLDS.STRUCTURAL_MAX_DISTANCE * 0.85);
console.log(`\nsamples within 15% of the threshold (i.e. closest calls): ${nearThreshold.length}`);
nearThreshold.slice(-15).forEach((v) => console.log(`  ${v.ch}/${v.label}: ${v.d.toFixed(4)}`));
const exceeding = dtwValues.filter((v) => v.d > Engine.THRESHOLDS.STRUCTURAL_MAX_DISTANCE);
console.log(`\nGOOD samples that ALREADY EXCEED the current threshold (would be false negatives if this ran alone as a hard gate): ${exceeding.length}`);
exceeding.forEach((v) => console.log(`  ${v.ch}/${v.label}: ${v.d.toFixed(4)}`));
