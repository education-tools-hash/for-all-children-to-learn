#!/usr/bin/env node
// Phase T2-D — Mirror Self-Confusion investigation (exploration only, NOT
// wired into engine.js). Hypothesis: a per-stroke "signed curvature /
// chirality" feature, compared against the reference using whichever
// forward/reversed alignment the existing bidirectional DTW already judges
// as the better match, might catch W5 mirror cases without a
// character-specific hack and without breaking the explicitly-supported
// "reversed direction" / "reversed stroke order" behavior.
//
// This script only measures and reports separation. It does NOT modify
// engine.js and is not wired into evaluateCharacter.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const IW = require('./independent-wrong-trace.js');
const REFERENCE = require('./fixtures/reference-data-full.generated.js');

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

// Coarse resample to reduce point-to-point noise sensitivity (same
// rationale as T2-C''s rejected turning-angle profile, but here we only
// need the NET signed sum, not a full profile-distance comparison).
function coarseResample(points, n) {
  n = n || 12;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (points.length - 1);
    const i0 = Math.floor(t), i1 = Math.min(points.length - 1, i0 + 1);
    const f = t - i0;
    out.push({ x: points[i0].x + (points[i1].x - points[i0].x) * f, y: points[i0].y + (points[i1].y - points[i0].y) * f });
  }
  return out;
}

// Signed "area swept from centroid" — a coarse chirality/handedness
// fingerprint. Near-zero for near-straight strokes (no reliable chirality).
function signedCurvatureSum(points) {
  const c = points.reduce((acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }), { x: 0, y: 0 });
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    sum += (p0.x - c.x) * (p1.y - c.y) - (p1.x - c.x) * (p0.y - c.y);
  }
  return sum / 2;
}

const DEADZONE = 0.0015; // |signed curvature| below this: unreliable, skip check

function chiralityMismatch(userIntrinsic, refIntrinsic) {
  const fwd = dtwDistance(userIntrinsic, refIntrinsic);
  const rev = dtwDistance([...userIntrinsic].reverse(), refIntrinsic);
  const reversedAlignmentWins = rev < fwd;

  const uCurv = signedCurvatureSum(coarseResample(userIntrinsic, 12));
  const rCurv = signedCurvatureSum(coarseResample(refIntrinsic, 12));

  if (Math.abs(uCurv) < DEADZONE || Math.abs(rCurv) < DEADZONE) {
    return { applicable: false, mismatch: false, uCurv, rCurv, reversedAlignmentWins };
  }
  const expectedSign = reversedAlignmentWins ? -Math.sign(rCurv) : Math.sign(rCurv);
  const mismatch = Math.sign(uCurv) !== expectedSign;
  return { applicable: true, mismatch, uCurv, rCurv, reversedAlignmentWins };
}

function toIntrinsic(strokePts) { return Engine.intrinsicNormalize(strokePts); }

// ---------------------------------------------------------------------
// A. Known W5 mirror false-positive cases — MUST be flagged (mismatch=true)
// ---------------------------------------------------------------------
console.log('=== A. W5 mirror cases (target: mismatch=true for at least the offending stroke) ===\n');
const KNOWN_MIRRORS = [
  ['あ', 'W5_mirror_horizontal', IW.w5MirrorHorizontal],
  ['く', 'W5_mirror_vertical', IW.w5MirrorVertical],
  ['こ', 'W5_mirror_horizontal', IW.w5MirrorHorizontal],
  ['す', 'W5_mirror_horizontal', IW.w5MirrorHorizontal],
  ['す', 'W5_mirror_vertical', IW.w5MirrorVertical],
  ['の', 'W5_mirror_horizontal', IW.w5MirrorHorizontal],
  ['り', 'W5_mirror_vertical', IW.w5MirrorVertical],
];
let mirrorsCaught = 0;
KNOWN_MIRRORS.forEach(([ch, label, fn]) => {
  const refDefs = REFERENCE[ch];
  const ideal = Traces.ideal(refDefs);
  const mirrored = ideal.map((s) => fn(s));
  const result = Engine.evaluateCharacter(mirrored, refDefs, { allCharacters: REFERENCE, targetChar: ch });
  const userFeatures = mirrored.map((s) => Engine.resampleUserStroke(s, 64).points);
  const refFeatures = refDefs.map((s) => Engine.sampleReferencePath(s.d, 64).points);
  let anyMismatch = false;
  const perStroke = [];
  (result.assignment || userFeatures.map((_, i) => i)).forEach((j, i) => {
    const uIntr = toIntrinsic(userFeatures[i]);
    const rIntr = toIntrinsic(refFeatures[j]);
    const c = chiralityMismatch(uIntr, rIntr);
    perStroke.push(c);
    if (c.applicable && c.mismatch) anyMismatch = true;
  });
  if (anyMismatch) mirrorsCaught++;
  console.log(`  [${ch}] ${label}: engine_pass=${result.pass} score=${result.score.toFixed(3)} chirality_flags_it=${anyMismatch}`);
  perStroke.forEach((c, i) => console.log(`      stroke#${i}: applicable=${c.applicable} mismatch=${c.mismatch} uCurv=${c.uCurv.toFixed(5)} rCurv=${c.rCurv.toFixed(5)} revWins=${c.reversedAlignmentWins}`));
});
console.log(`\n  Mirror cases caught by chirality check: ${mirrorsCaught}/${KNOWN_MIRRORS.length}`);

// ---------------------------------------------------------------------
// B. Safety check: legitimate "reversed direction" / "reversed stroke
// order" cases (existing golden-tests.js borderline cases) must NOT
// mismatch.
// ---------------------------------------------------------------------
console.log('\n=== B. Legitimate reversed-direction / reversed-order safety check ===\n');
let reversalFalseFlags = 0, reversalChecked = 0;
['あ', 'い', 'く', 'こ', 'ま'].forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const ideal = Traces.ideal(refDefs);
  // reversed direction: each stroke's point array reversed (same physical
  // path, opposite recorded order) — mirrors golden-tests.js's own case.
  const reversedDir = ideal.map((s) => [...s].reverse());
  const result = Engine.evaluateCharacter(reversedDir, refDefs, { allCharacters: REFERENCE, targetChar: ch });
  const userFeatures = reversedDir.map((s) => Engine.resampleUserStroke(s, 64).points);
  const refFeatures = refDefs.map((s) => Engine.sampleReferencePath(s.d, 64).points);
  (result.assignment || userFeatures.map((_, i) => i)).forEach((j, i) => {
    reversalChecked++;
    const c = chiralityMismatch(toIntrinsic(userFeatures[i]), toIntrinsic(refFeatures[j]));
    if (c.applicable && c.mismatch) {
      reversalFalseFlags++;
      console.log(`  FALSE FLAG: [${ch}] reversed_direction stroke#${i} uCurv=${c.uCurv.toFixed(5)} rCurv=${c.rCurv.toFixed(5)} revWins=${c.reversedAlignmentWins}`);
    }
  });
});
console.log(`  Checked ${reversalChecked} strokes across 5 chars x reversed-direction: false flags=${reversalFalseFlags}`);

// ---------------------------------------------------------------------
// C. Motor Accessibility regression safety check (all 46 chars x good
// case transforms, all strokes) — must not mismatch (or only extremely
// rarely, with clear separation from group A).
// ---------------------------------------------------------------------
console.log('\n=== C. Motor Accessibility safety check (46 chars x good-case transforms) ===\n');
const GOOD_CASES = [
  ['ideal', (r) => Traces.ideal(r)],
  ['wobble', (r) => Traces.mildWobble(r, 0.012, 10)],
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
];
let motorChecked = 0, motorFalseFlags = 0;
const falseFlagDetail = [];
Object.keys(REFERENCE).forEach((ch) => {
  const refDefs = REFERENCE[ch];
  GOOD_CASES.forEach(([label, fn]) => {
    const trace = fn(refDefs);
    if (trace.length !== refDefs.length) return;
    const result = Engine.evaluateCharacter(trace, refDefs, { allCharacters: REFERENCE, targetChar: ch });
    if (!result.assignment) return;
    const userFeatures = trace.map((s) => Engine.resampleUserStroke(s, 64).points);
    const refFeatures = refDefs.map((s) => Engine.sampleReferencePath(s.d, 64).points);
    result.assignment.forEach((j, i) => {
      motorChecked++;
      const c = chiralityMismatch(toIntrinsic(userFeatures[i]), toIntrinsic(refFeatures[j]));
      if (c.applicable && c.mismatch) {
        motorFalseFlags++;
        falseFlagDetail.push({ ch, label, i, uCurv: c.uCurv, rCurv: c.rCurv });
      }
    });
  });
});
console.log(`  Checked ${motorChecked} strokes: false flags=${motorFalseFlags}`);
if (falseFlagDetail.length) {
  console.log('  False-flag detail (first 20):');
  falseFlagDetail.slice(0, 20).forEach((f) => console.log(`    ${f.ch}/${f.label} stroke#${f.i}: uCurv=${f.uCurv.toFixed(5)} rCurv=${f.rCurv.toFixed(5)}`));
}

console.log('\n=== Summary ===');
console.log(`Mirror cases caught: ${mirrorsCaught}/${KNOWN_MIRRORS.length}`);
console.log(`Reversed-direction false flags: ${reversalFalseFlags}/${reversalChecked}`);
console.log(`Motor Accessibility false flags: ${motorFalseFlags}/${motorChecked}`);
