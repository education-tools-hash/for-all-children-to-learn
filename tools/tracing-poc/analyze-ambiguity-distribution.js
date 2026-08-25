#!/usr/bin/env node
// Phase T3-C' Section 12 — Ambiguity Distribution across all 46 katakana
// characters. Measures best vs second-best total assignment (shape-cost)
// permutation cost, to see how anomalous U's 0.0007 gap really is, and to
// find other characters with near-tie permutations (Section 11 inventory).
// Investigation only, does not modify engine-katakana.js.
'use strict';
const Engine = require('./engine-katakana.js');
const Traces = require('./golden-traces.js');
const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  arr.forEach((item, i) => {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    permutations(rest).forEach((p) => result.push([item].concat(p)));
  });
  return result;
}

const chars = Object.keys(KATAKANA);
const rows = [];

chars.forEach((ch) => {
  const refDefs = KATAKANA[ch];
  const n = refDefs.length;
  if (n < 2) return; // no permutation ambiguity possible with 1 stroke

  ['ideal', 'mild_wobble', 'moderate_wobble', 'uneven'].forEach((label) => {
    const trace = label === 'ideal' ? Traces.ideal(refDefs)
      : label === 'mild_wobble' ? Traces.mildWobble(refDefs, 0.012, 10)
      : label === 'moderate_wobble' ? Traces.mildWobble(refDefs, 0.018, 11)
      : Traces.mildlyUneven(refDefs, 20);

    const userFeatures = trace.map((s) => Engine.extractStrokeFeatures(Engine.resampleUserStroke(s, 64).points, 0));
    const refFeatures = refDefs.map((s) => {
      const { points, length } = Engine.sampleReferencePath(s.d, 64);
      return Engine.extractStrokeFeatures(points, length);
    });
    const { costMatrix } = Engine.matchStrokes(userFeatures, refFeatures);
    const idx = refFeatures.map((_, i) => i);
    const costs = permutations(idx).map((perm) => {
      let cost = 0;
      for (let i = 0; i < n; i++) cost += costMatrix[i][perm[i]];
      return { perm, cost };
    });
    costs.sort((a, b) => a.cost - b.cost);
    const best = costs[0].cost;
    const secondBest = costs.length > 1 ? costs[1].cost : Infinity;
    const gap = secondBest - best;
    const ratio = best > 1e-9 ? secondBest / best : Infinity;
    rows.push({ ch, n, label, best, secondBest, gap, ratio, bestPerm: costs[0].perm, secondPerm: costs[1] ? costs[1].perm : null });
  });
});

rows.sort((a, b) => a.gap - b.gap);
console.log('=== Bottom 30 smallest best/second-best gaps (most ambiguous) ===\n');
rows.slice(0, 30).forEach((r) => {
  console.log(`  ${r.ch}(${r.n}kaku)/${r.label}: best=${r.best.toFixed(4)} 2nd=${r.secondBest.toFixed(4)} gap=${r.gap.toFixed(4)} ratio=${r.ratio.toFixed(3)} bestPerm=${JSON.stringify(r.bestPerm)} 2ndPerm=${JSON.stringify(r.secondPerm)}`);
});

console.log('\n=== Distribution summary (gap) ===');
const gaps = rows.map((r) => r.gap).sort((a, b) => a - b);
function pct(p) { return gaps[Math.floor(gaps.length * p)]; }
console.log(`  count=${gaps.length}  min=${gaps[0].toFixed(4)}  p5=${pct(0.05).toFixed(4)}  p10=${pct(0.10).toFixed(4)}  p25=${pct(0.25).toFixed(4)}  median=${pct(0.5).toFixed(4)}  max=${gaps[gaps.length - 1].toFixed(4)}`);

const uRows = rows.filter((r) => r.ch === 'ウ');
const miRows = rows.filter((r) => r.ch === 'ミ');
console.log('\n=== U rows ===');
uRows.forEach((r) => console.log(`  ${r.label}: gap=${r.gap.toFixed(4)} (rank ${rows.indexOf(r) + 1}/${rows.length})`));
console.log('=== mi rows ===');
miRows.forEach((r) => console.log(`  ${r.label}: gap=${r.gap.toFixed(4)} (rank ${rows.indexOf(r) + 1}/${rows.length})`));

// Characters with gap below a candidate ambiguity threshold at ANY transform
const THRESH_CANDIDATES = [0.002, 0.005, 0.01, 0.02];
console.log('\n=== Characters falling under candidate ambiguity thresholds (any transform) ===');
THRESH_CANDIDATES.forEach((t) => {
  const affected = [...new Set(rows.filter((r) => r.gap < t).map((r) => r.ch))];
  console.log(`  threshold=${t}: ${affected.length} chars: ${affected.join(',')}`);
});
