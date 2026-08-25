#!/usr/bin/env node
// Phase T3-C Section 3 — Stroke Assignment Root Cause Reproduction (U).
// Investigation only, does not modify engine-katakana.js.
'use strict';
const Engine = require('./engine-katakana.js');
const Traces = require('./golden-traces.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

const ch = 'ウ';
const refDefs = KATAKANA[ch];

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function centroidOf(points) {
  let sx = 0, sy = 0;
  points.forEach((p) => { sx += p.x; sy += p.y; });
  return { x: sx / points.length, y: sy / points.length };
}

['moderate_wobble', 'uneven', 'mild_wobble (control, does NOT swap)'].forEach((label) => {
  const trace = label.startsWith('moderate') ? Traces.mildWobble(refDefs, 0.018, 11)
    : label.startsWith('uneven') ? Traces.mildlyUneven(refDefs, 20)
    : Traces.mildWobble(refDefs, 0.012, 10);

  console.log(`\n=== ${label} ===`);
  const userFeatures = trace.map((s) => Engine.extractStrokeFeatures(Engine.resampleUserStroke(s, 64).points, 0));
  const refFeatures = refDefs.map((s) => {
    const { points, length } = Engine.sampleReferencePath(s.d, 64);
    return Object.assign(Engine.extractStrokeFeatures(points, length), { label: s.label });
  });

  const { assignment, costMatrix } = Engine.matchStrokes(userFeatures, refFeatures);
  console.log('  selected assignment:', assignment, '(identity = [0,1,2])');
  console.log('  shape-cost matrix (user_i -> ref_j):');
  costMatrix.forEach((row, i) => console.log(`    user#${i}: [${row.map((v) => v.toFixed(4)).join(', ')}]`));
  const identityCost = costMatrix[0][0] + costMatrix[1][1] + costMatrix[2][2];
  const swapCost = costMatrix[0][1] + costMatrix[1][0] + costMatrix[2][2];
  console.log(`  identity[0,1,2] total cost: ${identityCost.toFixed(4)}`);
  console.log(`  swap[1,0,2] total cost:     ${swapCost.toFixed(4)}`);
  console.log(`  cost difference (swap - identity): ${(swapCost - identityCost).toFixed(4)} (negative = swap wins)`);

  console.log('  --- position/endpoint relationships (absolute space) ---');
  for (let i = 0; i < 2; i++) {
    const uf = userFeatures[i];
    console.log(`    user stroke#${i}: centroid=(${uf.centroid.x.toFixed(3)},${uf.centroid.y.toFixed(3)}) start=(${uf.start.x.toFixed(3)},${uf.start.y.toFixed(3)}) end=(${uf.end.x.toFixed(3)},${uf.end.y.toFixed(3)}) length=${uf.length.toFixed(3)}`);
  }
  for (let j = 0; j < 2; j++) {
    const rf = refFeatures[j];
    console.log(`    ref stroke#${j} (${rf.label}): centroid=(${rf.centroid.x.toFixed(3)},${rf.centroid.y.toFixed(3)}) start=(${rf.start.x.toFixed(3)},${rf.start.y.toFixed(3)}) end=(${rf.end.x.toFixed(3)},${rf.end.y.toFixed(3)}) length=${rf.length.toFixed(3)}`);
  }
  // Position-cost candidate: centroid distance in absolute space for each user-ref pairing
  console.log('  --- candidate B: centroid-distance cost matrix (absolute space, user_i -> ref_j) ---');
  for (let i = 0; i < 2; i++) {
    const row = [];
    for (let j = 0; j < 2; j++) row.push(dist(userFeatures[i].centroid, refFeatures[j].centroid).toFixed(4));
    console.log(`    user#${i}: [${row.join(', ')}]`);
  }
  const posIdentity = dist(userFeatures[0].centroid, refFeatures[0].centroid) + dist(userFeatures[1].centroid, refFeatures[1].centroid);
  const posSwap = dist(userFeatures[0].centroid, refFeatures[1].centroid) + dist(userFeatures[1].centroid, refFeatures[0].centroid);
  console.log(`  centroid-cost identity=${posIdentity.toFixed(4)} swap=${posSwap.toFixed(4)} (swap-identity=${(posSwap - posIdentity).toFixed(4)}, positive=identity wins)`);

  // Result under current (shape-only) engine
  const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: KATAKANA, targetChar: ch });
  console.log(`  ENGINE RESULT: pass=${result.pass} reason=${result.reason}`);
  result.strokes.slice(0, 2).forEach((s, i) => console.log(`    stroke#${i}: matched=${s.matchedReferenceStroke} completion=${s.completion.toFixed(3)} positionMetric=${s.positionMetric.toFixed(4)}`));
});
