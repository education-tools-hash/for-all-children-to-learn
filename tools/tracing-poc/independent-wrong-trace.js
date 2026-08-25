// Phase T2-C' — Section 3: Independent Wrong Trace Families
//
// STRICT RULE: none of these functions may call Engine.evaluateCharacter,
// read a score, a pass/fail flag, or any component score. They operate ONLY
// on the reference stroke's own sampled geometry (points/bbox/endpoints),
// which is reading the reference definition, not evaluating a candidate
// against it. This is what makes the resulting negative traces an
// independent test oracle rather than a calibration tool (contrast with
// tools/tracing-poc/wrong-trace-generator.js from Phase T2-C, which
// deliberately DOES query the Engine and remains in the repo as a
// calibration tool, not a validation oracle).
//
// Every transform is a fixed, deterministic rule applied identically to
// any stroke's geometry — no per-character branching, no character name
// ever appears in this file.
'use strict';

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function chordEndpoints(points) { return { p0: points[0], p1: points[points.length - 1] }; }

function bboxOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach((p) => {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// W1 Perpendicular — replace the stroke with a straight line through its own
// centroid, rotated 90 degrees from its own chord direction, same length as
// the chord.
function w1Perpendicular(points, n) {
  n = n || 20;
  const { p0, p1 } = chordEndpoints(points);
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  const perpX = -uy, perpY = ux;
  const bbox = bboxOf(points);
  const half = len / 2;
  const start = { x: bbox.cx - perpX * half, y: bbox.cy - perpY * half };
  const end = { x: bbox.cx + perpX * half, y: bbox.cy + perpY * half };
  return Array.from({ length: n }, (_, i) => ({
    x: start.x + (end.x - start.x) * (i / (n - 1)),
    y: start.y + (end.y - start.y) * (i / (n - 1)),
  }));
}

// W2 Shifted — same shape, translated by a fixed rule: half the CHARACTER's
// own bbox width/height, in a direction chosen deterministically by stroke
// index parity (not by any Engine feedback), then clamped into 0..1.
function w2Shifted(points, charBBox, strokeIndex) {
  const dirX = strokeIndex % 2 === 0 ? 1 : -1;
  const dirY = strokeIndex % 3 === 0 ? -1 : 1;
  const shiftX = dirX * charBBox.width * 0.55;
  const shiftY = dirY * charBBox.height * 0.55;
  return points.map((p) => ({
    x: Math.max(0.03, Math.min(0.97, p.x + shiftX)),
    y: Math.max(0.03, Math.min(0.97, p.y + shiftY)),
  }));
}

// W3 Truncated — first 45% of the reference stroke's own sampled points
// (fixed fraction, never tuned per character).
function w3Truncated(points) {
  const cut = Math.max(2, Math.round(points.length * 0.45));
  return points.slice(0, cut);
}

// W4 Zigzag — fixed-rule zigzag inside the stroke's own bbox: amplitude is
// always 30% of the bbox diagonal, always 10 oscillations, regardless of
// the actual reference shape.
function w4Zigzag(points, n) {
  n = n || 20;
  const { p0, p1 } = chordEndpoints(points);
  const bbox = bboxOf(points);
  const diag = Math.hypot(bbox.width, bbox.height) || 1e-6;
  const amp = diag * 0.3;
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

// W5 Mirror — flip the stroke horizontally about its OWN bbox center.
function w5MirrorHorizontal(points) {
  const bbox = bboxOf(points);
  return points.map((p) => ({ x: bbox.cx - (p.x - bbox.cx), y: p.y }));
}
function w5MirrorVertical(points) {
  const bbox = bboxOf(points);
  return points.map((p) => ({ x: p.x, y: bbox.cy - (p.y - bbox.cy) }));
}

// W6 Wrong scale — shrink to 25% about the stroke's own center.
function w6WrongScale(points, factor) {
  factor = factor || 0.25;
  const bbox = bboxOf(points);
  return points.map((p) => ({ x: bbox.cx + (p.x - bbox.cx) * factor, y: bbox.cy + (p.y - bbox.cy) * factor }));
}

module.exports = {
  bboxOf, chordEndpoints,
  w1Perpendicular, w2Shifted, w3Truncated, w4Zigzag, w5MirrorHorizontal, w5MirrorVertical, w6WrongScale,
};
