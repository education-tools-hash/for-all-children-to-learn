// Phase T2-C — Section 14: Character-Aware Wrong Trace Generator
//
// Generates a deliberately WRONG rendition of a single reference stroke.
//
// History of this file's approach (kept for record — see design doc
// Revision 7 for the full writeup):
//   1st attempt: branch on arc-length/chord-length ratio ("curvature").
//      Failed to generalize: strokes with curvature 1.13-2.15 (き/け/さ/す/
//      た/に/は/ほ/も/り) still scored shape=0.82-0.90 as a straight chord —
//      comfortably above the 0.80 floor — because an elongated stroke can
//      have a high length/chord ratio while bulging only slightly RELATIVE
//      TO ITS OWN SIZE, which is what intrinsic-normalized shape/coverage
//      actually measure.
//   2nd attempt: max perpendicular deviation from the chord, in intrinsic
//      (bbox-normalized) space. Better (10 failures -> 3), but a curve that
//      bulges sharply over only a short stretch has a small AVERAGE
//      deviation despite a locally large MAX — and shape's bidirectional
//      stats are a MEAN over sampled points, not a worst-case max.
//   3rd attempt: average perpendicular deviation. Closer, but still an
//      approximation of the Engine's actual nearest-point bidirectional
//      distance (not identical to distance-to-the-infinite-chord-line),
//      so it under- and over-shot the true 0.80 boundary for a handful of
//      strokes.
//
// Adopted approach: stop approximating. Directly ask the Engine whether a
// straight-chord substitute for this stroke would itself clear the quality
// floor (with every other stroke drawn ideally) — if it would, that chord
// is a fair/faithful rendition of this particular stroke (same lesson as
// あ/ま's near-straight 1st-2nd strokes), so fall back to a perpendicular
// zigzag instead, which is verified the same way. This guarantees the
// generated "wrong" stroke is genuinely wrong by the same yardstick
// Production uses, without hand-tuning a geometric proxy per stroke shape.
'use strict';

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function chordEndpoints(points) {
  return { p0: points[0], p1: points[points.length - 1] };
}

function strokeCurvature(points, length) {
  const { p0, p1 } = chordEndpoints(points);
  const chord = dist(p0, p1);
  return chord > 1e-6 ? length / chord : Infinity;
}

function straightChord(points, n) {
  n = n || 20;
  const { p0, p1 } = chordEndpoints(points);
  return Array.from({ length: n }, (_, i) => ({
    x: p0.x + (p1.x - p0.x) * (i / (n - 1)),
    y: p0.y + (p1.y - p0.y) * (i / (n - 1)),
  }));
}

function perpendicularZigzag(points, amp, n) {
  n = n || 20;
  const { p0, p1 } = chordEndpoints(points);
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / len, ny = dx / len;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const bx = p0.x + dx * t, by = p0.y + dy * t;
    const side = (i % 2 === 0 ? 1 : -1) * amp;
    return { x: bx + nx * side, y: by + ny * side };
  });
}

// Evaluates a single-stroke substitution (all other strokes ideal) and
// returns that stroke's own min(shape, coverage) — the same quantity the
// Per-Stroke Quality Floor checks.
function substituteStrokeQuality(Engine, refDefs, idealTrace, idx, candidatePoints) {
  const trace = idealTrace.map((s, i) => (i === idx ? candidatePoints : s));
  const result = Engine.evaluateCharacter(trace, refDefs);
  const s = result.strokes[idx];
  return Math.min(s.shape, s.coverage);
}

// Engine: the loaded TracingEngine module. refDefs: strokeData[ch] (full
// character, needed so other strokes can stay ideal while this one is
// substituted). idx: which stroke to make wrong. idealTrace: Traces.ideal(refDefs),
// passed in by the caller since it's already computed once per character.
function characterAwareWrongStroke(Engine, refDefs, idx, idealTrace, floor) {
  floor = floor != null ? floor : Engine.THRESHOLDS.STROKE_QUALITY_FLOOR;
  const strokeDef = refDefs[idx];
  const { points, length } = Engine.sampleReferencePath(strokeDef.d, 40);
  const curvature = strokeCurvature(points, length);

  const chord = straightChord(points, 20);
  const chordQuality = substituteStrokeQuality(Engine, refDefs, idealTrace, idx, chord);

  if (chordQuality < floor) {
    return { wrong: chord, curvature, quality: chordQuality, method: 'straight_chord' };
  }

  // Chord is a fair (too-good) rendition for this stroke — same lesson as
  // near-straight reference strokes. Use a zigzag scaled to the stroke's
  // own chord length instead, and verify it too.
  const { p0, p1 } = chordEndpoints(points);
  const chordLen = dist(p0, p1);
  const zigzag = perpendicularZigzag(points, Math.max(chordLen * 0.35, 0.035), 20);
  const zigzagQuality = substituteStrokeQuality(Engine, refDefs, idealTrace, idx, zigzag);
  return { wrong: zigzag, curvature, quality: zigzagQuality, method: 'perpendicular_zigzag', chordQuality };
}

module.exports = {
  strokeCurvature, straightChord, perpendicularZigzag, substituteStrokeQuality, characterAwareWrongStroke,
};
