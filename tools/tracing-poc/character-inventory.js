#!/usr/bin/env node
// Phase T2-C — Section 6-7: Character Inventory & Structural Classification
//
// For all 46 gojuon characters, computes per-stroke: arc length, chord
// length (straight-line distance start->end), curvature ratio (arc/chord —
// 1.0 = perfectly straight, higher = more curved/looped), bbox, and a
// coarse structural group. Used to (a) understand the character set before
// generalizing the Per-Stroke Quality Floor, and (b) drive the
// character-aware wrong-trace generator (Section 14).
'use strict';
const Engine = require('./engine.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function analyzeStroke(d) {
  const { points, length } = Engine.sampleReferencePath(d, 64);
  const chord = dist(points[0], points[points.length - 1]);
  const curvature = chord > 1e-6 ? length / chord : Infinity;
  const bbox = Engine.computeBBox(points);
  return { length, chord, curvature, bbox };
}

function classifyStroke(s) {
  if (s.curvature < 1.08) return 'near-straight';
  if (s.curvature < 1.35) return 'gentle-curve';
  if (s.curvature < 2.0) return 'curved';
  return 'loop-or-sweep';
}

function classifyCharacter(strokeAnalyses) {
  const classes = strokeAnalyses.map(classifyStroke);
  const n = strokeAnalyses.length;
  const hasLoop = classes.includes('loop-or-sweep');
  const hasCurved = classes.includes('curved');
  const allStraight = classes.every((c) => c === 'near-straight');
  if (n >= 3 && hasLoop) return 'F: 複雑(3-4画+loop/sweep)';
  if (n >= 3) return 'E: 複数画(位置関係が重要)';
  if (hasLoop) return 'D: loop/large curve';
  if (hasCurved) return 'C: hook/turn';
  if (allStraight) return 'A: ほぼ直線中心';
  return 'B: 単純曲線';
}

const rows = [];
Object.entries(REFERENCE).forEach(([ch, strokes]) => {
  const analyses = strokes.map((s) => analyzeStroke(s.d));
  const group = classifyCharacter(analyses);
  rows.push({ ch, strokeCount: strokes.length, group, analyses });
});

console.log('=== Character Inventory (46 chars) ===\n');
const byGroup = {};
rows.forEach((r) => { (byGroup[r.group] = byGroup[r.group] || []).push(r.ch); });
Object.keys(byGroup).sort().forEach((g) => {
  console.log(`${g}: ${byGroup[g].join(' ')}  (${byGroup[g].length}文字)`);
});

console.log('\n=== Per-stroke curvature detail ===\n');
rows.forEach((r) => {
  const detail = r.analyses.map((a, i) => `s${i}:${a.curvature.toFixed(2)}`).join(' ');
  console.log(`${r.ch} (${r.strokeCount}画, ${r.group}): ${detail}`);
});

const fs = require('fs');
const path = require('path');
const outPath = path.join(__dirname, 'fixtures', 'character-inventory.generated.json');
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
console.log(`\nWrote ${path.relative(path.resolve(__dirname, '..', '..'), outPath)}`);
