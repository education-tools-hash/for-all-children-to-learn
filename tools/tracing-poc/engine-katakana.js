// Phase T3-B — Katakana Tracing Engine (Node test/calibration reference)
//
// This is a physical copy of tools/tracing-poc/engine.js (the hiragana
// Node reference), created because katakana's own Position Guard
// calibration (calibrate-position-katakana.js) requires a different
// STROKE_POSITION_MAX than hiragana — and engine.js itself must not be
// changed just for katakana (it stays the exact hiragana reference/test
// baseline). This file is the ONLY diff from engine.js:
// STROKE_POSITION_MAX 0.26 -> 0.355 (see docs/design-system/
// donomana-tracing-accuracy-design-v1.md Revision 14 for the full
// calibration evidence: katakana worst-good=0.3482, best-bad(W2)=0.3598).
// All other thresholds are unchanged from T2 (ABS_SCALE_MIN/MAX,
// ABS_POSITION_MAX, STROKE_QUALITY_FLOOR, STROKE_COMPLETION_MIN_SPAN,
// RELATIVE_DISCRIMINATION_MARGIN, PASS_THRESHOLD).
//
// Deterministic, client-side-portable (no DOM dependency), pure-function
// shape-evaluation engine for なぞり (tracing) judgement. This is a PoC
// module only — NOT wired into hiragana-learn.html. Katakana-app.html's
// production copy mirrors this file's logic (see hiragana-learn.html's
// own inline copy, which is the established precedent for this
// keep-two-copies-in-sync pattern).
//
// Pipeline (see docs/design-system/donomana-tracing-accuracy-design-v1.md):
//   sampleReferencePath()   — KanjiVG SVG path (M/c only) -> arc-length-even points
//   normalizeStroke()       — user stroke -> Absolute (0..1) and Intrinsic (bbox-normalized) reps
//   extractStrokeFeatures() — per-stroke length / bbox / centroid / start / end
//   matchStrokes()          — best user<->reference stroke assignment (order-agnostic)
//   evaluateCharacter()     — Hard Gate + Soft Score -> {pass, score, ...debug}
//
// All thresholds below are PoC candidates, tuned against the Golden Test
// matrix (tools/tracing-poc/golden-tests.js). They are intentionally named
// constants rather than inlined magic numbers so T2-B tuning has one place
// to look. None of them are final production values.

(function (root) {
  'use strict';

  // ---------------------------------------------------------------------
  // Tunable thresholds (PoC candidates — see Section 22 "Threshold")
  // ---------------------------------------------------------------------
  const THRESHOLDS = {
    SAMPLE_POINTS_PER_STROKE: 64,       // Section 4
    MIN_LENGTH_RATIO: 0.22,             // Hard Gate B — Section 10
    GROSS_LOCATION_MARGIN: 0.45,        // Hard Gate C — fraction of char bbox size to expand by
    SHAPE_TOLERANCE: 0.16,              // intrinsic-space distance treated as "on the line" (coverage/off-path)
    SHAPE_NORM: 0.34,                   // intrinsic-space distance treated as "fully different shape"
    STARTEND_RADIUS: 0.24,              // absolute-space normalized radius for soft start/end scoring
    OFFPATH_FAIL_RATIO: 0.55,           // if more than this fraction of user points are off-path, offPath score -> 0
    ORDER_PENALTY_WEIGHT: 0.12,
    WEIGHTS: {
      shape: 0.40,
      coverage: 0.28,
      offPath: 0.14,   // subtracted
      startEnd: 0.10,
      direction: 0.08,
    },
    SPATIAL_WEIGHT: 0.10,
    PASS_THRESHOLD: 0.60,
    // Phase T2-B'': 各strokeのmin(shape, coverage)がこれを下回ったら、文字全体の
    // scoreがどれだけ高くても不合格にする。実データ較正(calibrate-stroke-floor-full.js):
    // 全motor-variation良好ケースの最低値=0.921、直線代用等の「本来曲線が必要な
    // strokeの誤魔化し」=0.33〜0.70程度。0.80は両者の間に十分なマージンを持つ。
    STROKE_QUALITY_FLOOR: 0.80,

    // --- Phase T2-C'' additions (Root Cause A/B from T2-C' Independent
    // Validation). Both are NEW, independent Hard Gates — no existing
    // threshold above was changed to make room for these.

    // Absolute Geometry Guard (Root Cause A): a uniform-scale copy of a
    // character is indistinguishable from the ideal in intrinsic
    // (self-normalized) shape/coverage terms, and MIN_LENGTH_RATIO alone
    // doesn't catch it (a 0.25x shrink still has length ratio 0.25 > 0.22).
    // These compare the CHARACTER's overall absolute (pre-intrinsic-
    // normalization) size/position against the reference's, independent of
    // per-stroke assignment. Calibrated deterministically (uniform scaling
    // has no noise): 25% must fail with a large margin; the 80-120%
    // "ordinary variation" range from the T2-C'' spec, and even the
    // documented 65-140% borderline range, must comfortably pass so Motor
    // Accessibility is not tightened.
    ABS_SCALE_MIN: 0.50,
    ABS_SCALE_MAX: 1.70,
    // Character-level centroid displacement, normalized by the reference's
    // own bbox diagonal. Independent of (and looser than) the existing
    // per-stroke Hard Gate C (GROSS_LOCATION_MARGIN), which only checks
    // each stroke's own centroid against an expanded box and didn't
    // reliably catch a whole-character large positional shift (W2).
    ABS_POSITION_MAX: 0.50,

    // --- Phase T2-C''' additions ---
    // T2-C'' used STRUCTURAL_MAX_DISTANCE as an ABSOLUTE DTW hard gate.
    // Root-caused as a real source of User-perceived over-strictness:
    // analyze-dtw-distribution.js found 2 legitimate wobble(0.018) cases
    // (お, や) that ALREADY exceed 0.038 on their own — an absolute cutoff
    // this tight has essentially no safety margin. DTW distance itself is
    // kept (still computed per stroke, still useful), but is no longer a
    // standalone pass/fail gate. It is repurposed below as a RELATIVE
    // Character Discrimination signal instead (Section 15-24): "is the
    // trace clearly closer to a DIFFERENT character" rather than
    // "is the trace far from the target in absolute terms" — the former
    // is what actually answers the pedagogical question and, per
    // analyze-relative-discrimination.js, cleanly separates ALL 15 known
    // cross-character false positives (min margin 0.0171) from the worst
    // legitimate motor-variation case (margin -0.0131), including る/ろ
    // and ぬ/め which the old absolute gate could never fully resolve.
    RELATIVE_DISCRIMINATION_MARGIN: 0.008,

    // Per-Stroke Position Guard (replaces relying on whole-character
    // centroid alone for catching a single badly-placed stroke): matched
    // stroke centroid distance / character bbox diagonal. Calibrated via
    // analyze-position-completion.js: worst case among offset/wobble/scale
    // = 0.0557, but golden-traces.js's `tremor` (independent random phase
    // added per-point — not smooth oscillation) produces a real centroid
    // bias up to 0.237 for two short strokes (き/ほ) — an existing,
    // unmodified Motor Accessibility test, not a new one added for this
    // guard. Rather than "fix" that test to make this guard look better,
    // the threshold is set safely above it (0.26), leaving a thinner but
    // still positive margin to the hardest-to-catch large-shift (W2) case
    // (0.2913) — see design doc Revision 10 for the full margin discussion.
    STROKE_POSITION_MAX: 0.355, // Phase T3-B: katakana-calibrated (T2 hiragana value was 0.26)

    // Per-Stroke Completion / Progress Guard (catches W3 — stopping partway
    // through a stroke — independent of raw path length, which noise can
    // inflate). Measures how much of the reference's 0..1 arc-length
    // progression the user's points collectively touch (direction-
    // agnostic), both point sets mapped into the REFERENCE stroke's own
    // coordinate frame (a truncated user fragment must not get to
    // re-center/re-scale itself to look more "spread out" than it is).
    // Calibrated via analyze-position-completion.js: exact 45% truncation
    // -> span 0.444; worst legitimate motor-variation case (a complex
    // stroke in ふ under a small offset) -> span 0.571. Set between the two
    // with margin on both sides; per spec Section 13, 85% is NOT used as a
    // hard requirement — this is deliberately a wide floor.
    STROKE_COMPLETION_MIN_SPAN: 0.50,
  };

  // ---------------------------------------------------------------------
  // SVG path parsing (M + c only — confirmed to be the only commands used
  // across the production strokeData set; see T1/T2-A audit).
  // ---------------------------------------------------------------------
  function tokenizeNumbers(str) {
    const re = /-?\d*\.\d+(?:e-?\d+)?|-?\d+(?:e-?\d+)?/gi;
    return (str.match(re) || []).map(Number);
  }

  // Returns an array of cubic bezier segments in absolute coordinates:
  // [{p0:{x,y}, p1:{x,y}, p2:{x,y}, p3:{x,y}}, ...]
  function parseCubicPath(d) {
    const commandRe = /([Mc])([^Mc]*)/g;
    let match;
    let cur = { x: 0, y: 0 };
    const segments = [];
    let sawMove = false;

    while ((match = commandRe.exec(d)) !== null) {
      const cmd = match[1];
      const nums = tokenizeNumbers(match[2]);

      if (cmd === 'M') {
        if (nums.length < 2) throw new Error(`Malformed M command in path: ${d}`);
        cur = { x: nums[0], y: nums[1] };
        sawMove = true;
        // KanjiVG paths in this dataset use a single M pair; ignore any
        // extra implicit-lineto pairs after the first (none observed).
      } else if (cmd === 'c') {
        if (!sawMove) throw new Error(`"c" command before any "M" in path: ${d}`);
        if (nums.length % 6 !== 0) {
          throw new Error(`"c" command coordinate count not a multiple of 6 in path: ${d}`);
        }
        for (let i = 0; i < nums.length; i += 6) {
          const p0 = cur;
          const p1 = { x: p0.x + nums[i], y: p0.y + nums[i + 1] };
          const p2 = { x: p0.x + nums[i + 2], y: p0.y + nums[i + 3] };
          const p3 = { x: p0.x + nums[i + 4], y: p0.y + nums[i + 5] };
          segments.push({ p0, p1, p2, p3 });
          cur = p3;
        }
      }
    }
    if (!segments.length) throw new Error(`No cubic segments parsed from path: ${d}`);
    return segments;
  }

  function cubicPoint(seg, t) {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, e = t * t * t;
    return {
      x: a * seg.p0.x + b * seg.p1.x + c * seg.p2.x + e * seg.p3.x,
      y: a * seg.p0.y + b * seg.p1.y + c * seg.p2.y + e * seg.p3.y,
    };
  }

  function dist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Flattens bezier segments into a fine polyline with cumulative arc length.
  function flattenToPolyline(segments, stepsPerSegment) {
    const pts = [];
    const cum = [0];
    let prev = null;
    segments.forEach((seg) => {
      for (let s = 0; s <= stepsPerSegment; s++) {
        if (s === 0 && prev !== null) continue; // avoid duplicate join point
        const t = s / stepsPerSegment;
        const p = cubicPoint(seg, t);
        if (prev !== null) cum.push(cum[cum.length - 1] + dist(prev, p));
        pts.push(p);
        prev = p;
      }
    });
    return { pts, cum, total: cum[cum.length - 1] };
  }

  // Resample an arbitrary polyline (with cumulative arc length) at
  // `numPoints` evenly spaced arc-length positions (0..total inclusive).
  function resamplePolylineByArcLength(pts, cum, numPoints) {
    const total = cum[cum.length - 1];
    const out = [];
    if (total <= 0) {
      // Degenerate (all points coincide) — repeat the single point.
      for (let i = 0; i < numPoints; i++) out.push({ x: pts[0].x, y: pts[0].y });
      return out;
    }
    let seg = 0;
    for (let i = 0; i < numPoints; i++) {
      const target = (total * i) / (numPoints - 1);
      while (seg < cum.length - 2 && cum[seg + 1] < target) seg++;
      const segStart = cum[seg], segEnd = cum[seg + 1];
      const segLen = segEnd - segStart;
      const localT = segLen > 0 ? (target - segStart) / segLen : 0;
      const a = pts[seg], b = pts[Math.min(seg + 1, pts.length - 1)];
      out.push({ x: a.x + (b.x - a.x) * localT, y: a.y + (b.y - a.y) * localT });
    }
    return out;
  }

  // KanjiVG viewBox is 0 0 109 109 (see hiragana-learn.html). Normalizing
  // by this constant maps reference paths into the same 0..1 space the
  // User Stroke Model uses (Section 6).
  const KANJIVG_VIEWBOX = 109;

  function sampleReferencePath(d, numPoints) {
    numPoints = numPoints || THRESHOLDS.SAMPLE_POINTS_PER_STROKE;
    const segments = parseCubicPath(d);
    const { pts, cum, total } = flattenToPolyline(segments, 24);
    const sampled = resamplePolylineByArcLength(pts, cum, numPoints);
    const norm = sampled.map((p) => ({ x: p.x / KANJIVG_VIEWBOX, y: p.y / KANJIVG_VIEWBOX }));
    return { points: norm, length: total / KANJIVG_VIEWBOX };
  }

  // Resample a raw user stroke (array of {x,y}, already 0..1 normalized)
  // to `numPoints` evenly-spaced-by-arc-length points. Per Section 7,
  // this must NOT be an index-wise resample.
  function resampleUserStroke(points, numPoints) {
    numPoints = numPoints || THRESHOLDS.SAMPLE_POINTS_PER_STROKE;
    if (points.length < 2) return { points: [points[0], points[0]], length: 0 };
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
    const sampled = resamplePolylineByArcLength(points, cum, numPoints);
    return { points: sampled, length: cum[cum.length - 1] };
  }

  // Convert raw pixel-space strokes to the 0..1 normalized User Stroke Model.
  function normalizeUserStrokesFromPixels(strokesPx, canvasWidth, canvasHeight) {
    const size = Math.max(canvasWidth, canvasHeight);
    return strokesPx.map((stroke) => stroke.map((p) => ({ x: p.x / size, y: p.y / size })));
  }

  function computeBBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function centroidOf(points) {
    const n = points.length;
    let sx = 0, sy = 0;
    points.forEach((p) => { sx += p.x; sy += p.y; });
    return { x: sx / n, y: sy / n };
  }

  // "Intrinsic" representation (Section 9): recenter on the stroke's own
  // bbox center and scale uniformly (aspect-ratio preserved) so shape
  // comparison ignores translation/scale — but NOT rotation, and NOT
  // draw-direction (nearest-distance is inherently direction-agnostic).
  function intrinsicNormalize(points) {
    const bbox = computeBBox(points);
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const scale = 1 / Math.max(bbox.width, bbox.height, 1e-6);
    return points.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }));
  }

  function extractStrokeFeatures(absolutePoints, arcLength) {
    const bbox = computeBBox(absolutePoints);
    return {
      absPoints: absolutePoints,
      intrinsicPoints: intrinsicNormalize(absolutePoints),
      length: arcLength,
      bbox,
      centroid: centroidOf(absolutePoints),
      start: absolutePoints[0],
      end: absolutePoints[absolutePoints.length - 1],
    };
  }

  // Bidirectional (Chamfer-style) nearest-distance stats between two
  // point sets. Section 12.
  function nearestDistanceTo(pt, others) {
    let best = Infinity;
    for (let i = 0; i < others.length; i++) {
      const d = dist(pt, others[i]);
      if (d < best) best = d;
    }
    return best;
  }

  function bidirectionalStats(userPts, refPts) {
    const userToRef = userPts.map((p) => nearestDistanceTo(p, refPts));
    const refToUser = refPts.map((p) => nearestDistanceTo(p, userPts));
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      userToRefDistances: userToRef,
      refToUserDistances: refToUser,
      meanUserToRef: mean(userToRef),
      meanRefToUser: mean(refToUser),
    };
  }

  function coverageRatio(refPts, userPts, tolerance) {
    let covered = 0;
    refPts.forEach((p) => { if (nearestDistanceTo(p, userPts) <= tolerance) covered++; });
    return covered / refPts.length;
  }

  function offPathRatio(userPts, refPts, tolerance) {
    let off = 0;
    userPts.forEach((p) => { if (nearestDistanceTo(p, refPts) > tolerance) off++; });
    return off / userPts.length;
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // ---------------------------------------------------------------------
  // Stroke assignment (Section 18) — order-agnostic pairwise matching.
  // With at most ~4 strokes per character, brute-force permutation search
  // is trivially cheap (<=24 permutations).
  // ---------------------------------------------------------------------
  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    arr.forEach((item, i) => {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      permutations(rest).forEach((p) => result.push([item].concat(p)));
    });
    return result;
  }

  function shapeCost(userFeat, refFeat) {
    const stats = bidirectionalStats(userFeat.intrinsicPoints, refFeat.intrinsicPoints);
    return (stats.meanUserToRef + stats.meanRefToUser) / 2;
  }

  // Returns { assignment: [refIndexForUser0, refIndexForUser1, ...], totalCost, costMatrix }
  function matchStrokes(userFeatures, refFeatures) {
    const n = userFeatures.length;
    const costMatrix = userFeatures.map((uf) => refFeatures.map((rf) => shapeCost(uf, rf)));
    if (n !== refFeatures.length) {
      return { assignment: null, totalCost: Infinity, costMatrix };
    }
    const indices = refFeatures.map((_, i) => i);
    let best = null, bestCost = Infinity;
    permutations(indices).forEach((perm) => {
      let cost = 0;
      for (let i = 0; i < n; i++) cost += costMatrix[i][perm[i]];
      if (cost < bestCost) { bestCost = cost; best = perm; }
    });
    return { assignment: best, totalCost: bestCost, costMatrix };
  }

  // Kendall-tau-style inversion count normalized to 0..1 (0 = identity order).
  function orderPenaltyFor(assignment) {
    const n = assignment.length;
    if (n < 2) return 0;
    let inversions = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (assignment[i] > assignment[j]) inversions++;
      }
    }
    const maxInversions = (n * (n - 1)) / 2;
    return inversions / maxInversions; // 0..1
  }

  // Spatial relationship agreement (Section 19): for each pair of strokes,
  // do the user-assigned left/right & upper/lower relationships match the
  // reference's? Uses absolute-space centroids (position matters here).
  function spatialAgreement(userFeatures, refFeatures, assignment) {
    const n = userFeatures.length;
    if (n < 2) return 1;
    let agree = 0, total = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const uI = userFeatures[i].centroid, uJ = userFeatures[j].centroid;
        const rI = refFeatures[assignment[i]].centroid, rJ = refFeatures[assignment[j]].centroid;
        const userDx = Math.sign(uJ.x - uI.x), refDx = Math.sign(rJ.x - rI.x);
        const userDy = Math.sign(uJ.y - uI.y), refDy = Math.sign(rJ.y - rI.y);
        total += 2;
        if (userDx === refDx || Math.abs(uJ.x - uI.x) < 0.02) agree++;
        if (userDy === refDy || Math.abs(uJ.y - uI.y) < 0.02) agree++;
      }
    }
    return agree / total;
  }

  function unionBBox(features) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    features.forEach((f) => {
      minX = Math.min(minX, f.bbox.minX);
      minY = Math.min(minY, f.bbox.minY);
      maxX = Math.max(maxX, f.bbox.maxX);
      maxY = Math.max(maxY, f.bbox.maxY);
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function pointInExpandedBBox(pt, bbox, marginRatio) {
    const mx = bbox.width * marginRatio, my = bbox.height * marginRatio;
    return pt.x >= bbox.minX - mx && pt.x <= bbox.maxX + mx &&
           pt.y >= bbox.minY - my && pt.y <= bbox.maxY + my;
  }

  function directionComponent(userFeat, refFeat) {
    const uv = { x: userFeat.end.x - userFeat.start.x, y: userFeat.end.y - userFeat.start.y };
    const rv = { x: refFeat.end.x - refFeat.start.x, y: refFeat.end.y - refFeat.start.y };
    const uLen = Math.hypot(uv.x, uv.y), rLen = Math.hypot(rv.x, rv.y);
    if (uLen < 1e-6 || rLen < 1e-6) return { cos: 0, label: 'ambiguous', component: 0.5 };
    const cos = (uv.x * rv.x + uv.y * rv.y) / (uLen * rLen);
    const label = cos >= 0.3 ? 'forward' : cos <= -0.3 ? 'reversed' : 'ambiguous';
    // Soft & direction-agnostic for pass/fail: strong alignment in EITHER
    // direction scores well (Section 17). Only a perpendicular / random
    // direction is penalized.
    return { cos, label, component: Math.abs(cos) };
  }

  function startEndComponent(userFeat, refFeat) {
    const R = THRESHOLDS.STARTEND_RADIUS;
    const forward = dist(userFeat.start, refFeat.start) + dist(userFeat.end, refFeat.end);
    const reversed = dist(userFeat.start, refFeat.end) + dist(userFeat.end, refFeat.start);
    const best = Math.min(forward, reversed) / 2;
    return clamp01(1 - best / R);
  }

  // ---------------------------------------------------------------------
  // Absolute Geometry Guard (Phase T2-C'' — Root Cause A)
  // ---------------------------------------------------------------------
  function absoluteGeometryCheck(userFeatures, refFeatures, charBBox) {
    const refDiag = Math.hypot(charBBox.width, charBBox.height) || 1e-6;
    const userAllPts = userFeatures.flatMap((f) => f.absPoints);
    const userBBox = computeBBox(userAllPts);
    const userDiag = Math.hypot(userBBox.width, userBBox.height);
    const scaleRatio = userDiag / refDiag;

    const refTotalLength = refFeatures.reduce((a, f) => a + f.length, 0) || 1e-6;
    const userTotalLength = userFeatures.reduce((a, f) => a + f.length, 0);
    const pathLengthRatio = userTotalLength / refTotalLength;

    const refCentroid = { x: (charBBox.minX + charBBox.maxX) / 2, y: (charBBox.minY + charBBox.maxY) / 2 };
    const userCentroid = centroidOf(userAllPts);
    const positionRatio = dist(userCentroid, refCentroid) / refDiag;

    const scaleOk = scaleRatio >= THRESHOLDS.ABS_SCALE_MIN && scaleRatio <= THRESHOLDS.ABS_SCALE_MAX;
    // NOTE: total arc-length ratio is NOT used as a gate here despite being
    // listed as a candidate metric in the T2-C'' spec. Found empirically:
    // per-point tremor/wobble noise (independent random jitter on every
    // sampled point) inflates raw arc length substantially — a jagged path
    // between two nearby points is much longer than a smooth one, even at
    // small amplitude — while bbox diagonal stays stable (noise doesn't
    // systematically expand the overall extent). mildWobble(0.012) already
    // pushed pathLengthRatio to 1.74, which would have failed here and
    // broken a User-approved Motor Accessibility case. Kept as a debug-only
    // reported value, not gated on.
    const positionOk = positionRatio <= THRESHOLDS.ABS_POSITION_MAX;

    return {
      pass: scaleOk && positionOk,
      scaleRatio, pathLengthRatio, positionRatio, scaleOk, positionOk,
    };
  }

  // ---------------------------------------------------------------------
  // Structural Discrimination Guard (Phase T2-C'' — Root Cause B)
  // Order-aware (DTW) distance — see THRESHOLDS.STRUCTURAL_MAX_DISTANCE
  // comment for why this was chosen over turning-angle/net-rotation.
  // ---------------------------------------------------------------------
  function dtwDistance(a, b) {
    const m = a.length, n = b.length;
    let prev = new Float64Array(n + 1).fill(Infinity);
    prev[0] = 0;
    for (let i = 1; i <= m; i++) {
      const cur = new Float64Array(n + 1).fill(Infinity);
      for (let j = 1; j <= n; j++) {
        const cost = dist(a[i - 1], b[j - 1]);
        cur[j] = cost + Math.min(prev[j], cur[j - 1], prev[j - 1]);
      }
      prev = cur;
    }
    return prev[n] / (m + n); // normalized by path length so point-count-independent
  }

  function structuralDistance(userIntrinsicPts, refIntrinsicPts) {
    const forward = dtwDistance(userIntrinsicPts, refIntrinsicPts);
    const reversed = dtwDistance([...userIntrinsicPts].reverse(), refIntrinsicPts);
    return Math.min(forward, reversed);
  }

  // ---------------------------------------------------------------------
  // Per-Stroke Position Guard (Phase T2-C''')
  // ---------------------------------------------------------------------
  function strokePositionMetric(userAbsPts, refAbsPts, charDiag) {
    const uC = centroidOf(userAbsPts), rC = centroidOf(refAbsPts);
    return charDiag > 1e-6 ? dist(uC, rC) / charDiag : 0;
  }

  // ---------------------------------------------------------------------
  // Per-Stroke Completion / Progress Guard (Phase T2-C''')
  // Both point sets are mapped into the REFERENCE stroke's own transform
  // (see design doc Revision 10) so a truncated/incomplete user fragment
  // cannot re-center-and-rescale itself to look more complete than it is.
  // ---------------------------------------------------------------------
  function bboxTransformParams(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach((p) => {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    });
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const scale = 1 / Math.max(maxX - minX, maxY - minY, 1e-6);
    return { cx, cy, scale };
  }
  function applyTransform(points, t) {
    return points.map((p) => ({ x: (p.x - t.cx) * t.scale, y: (p.y - t.cy) * t.scale }));
  }

  function progressSpan(userAbsPts, refAbsPts) {
    const t = bboxTransformParams(refAbsPts);
    const userPts = applyTransform(userAbsPts, t);
    const refPts = applyTransform(refAbsPts, t);
    const N = refPts.length;
    const progresses = userPts.map((up) => {
      let best = Infinity, bestIdx = 0;
      for (let i = 0; i < N; i++) {
        const d = dist(up, refPts[i]);
        if (d < best) { best = d; bestIdx = i; }
      }
      return bestIdx / (N - 1);
    });
    const forwardSpan = Math.max(...progresses) - Math.min(...progresses);
    const reversedProgresses = progresses.map((p) => 1 - p);
    const reversedSpan = Math.max(...reversedProgresses) - Math.min(...reversedProgresses);
    return Math.max(forwardSpan, reversedSpan);
  }

  // ---------------------------------------------------------------------
  // Relative Character Discrimination (Phase T2-C''' — replaces the T2-C''
  // absolute DTW hard gate). Compares the user's trace against the TARGET
  // character's reference vs. the best-matching OTHER character sharing
  // the same stroke count, and only flags a problem when another character
  // is CLEARLY closer (RELATIVE_DISCRIMINATION_MARGIN), not merely closer.
  // Sibling reference paths are cached per-character (keyed by the `d`
  // strings, which uniquely identify a stroke set) so repeated evaluations
  // in the same session don't re-parse/re-sample SVG paths every time.
  // ---------------------------------------------------------------------
  const siblingFeatureCache = new Map();
  function cachedIntrinsicStrokes(strokeDefs) {
    const key = strokeDefs.map((s) => s.d).join('|');
    let cached = siblingFeatureCache.get(key);
    if (!cached) {
      cached = strokeDefs.map((s) => intrinsicNormalize(sampleReferencePath(s.d, 64).points));
      siblingFeatureCache.set(key, cached);
    }
    return cached;
  }

  function avgDtwToCandidate(userIntrinsicStrokes, candidateStrokeDefs) {
    const n = userIntrinsicStrokes.length;
    if (candidateStrokeDefs.length !== n) return Infinity;
    const candFeatures = cachedIntrinsicStrokes(candidateStrokeDefs);
    const costMatrix = userIntrinsicStrokes.map((u) => candFeatures.map((c) => structuralDistance(u, c)));
    const idx = candFeatures.map((_, i) => i);
    let best = Infinity;
    permutations(idx).forEach((perm) => {
      let cost = 0;
      for (let i = 0; i < n; i++) cost += costMatrix[i][perm[i]];
      if (cost < best) best = cost;
    });
    return best / n;
  }

  // allCharacters: { [charKey]: strokeDefs } — full reference set (e.g.
  // production `strokeData`). targetChar: the character being traced.
  // Returns null (skip the guard) if either is not provided, or if there
  // are no other same-stroke-count candidates to compare against.
  function relativeCharacterDiscrimination(userIntrinsicStrokes, allCharacters, targetChar) {
    if (!allCharacters || !targetChar || !allCharacters[targetChar]) return null;
    const n = userIntrinsicStrokes.length;
    const targetAvg = avgDtwToCandidate(userIntrinsicStrokes, allCharacters[targetChar]);
    let bestOtherChar = null, bestOtherAvg = Infinity;
    Object.keys(allCharacters).forEach((cand) => {
      if (cand === targetChar) return;
      if (allCharacters[cand].length !== n) return;
      const avg = avgDtwToCandidate(userIntrinsicStrokes, allCharacters[cand]);
      if (avg < bestOtherAvg) { bestOtherAvg = avg; bestOtherChar = cand; }
    });
    if (bestOtherChar === null) return null; // no same-stroke-count siblings to compare against
    const margin = targetAvg - bestOtherAvg; // positive: some other character is closer than target
    return {
      pass: margin < THRESHOLDS.RELATIVE_DISCRIMINATION_MARGIN,
      targetAvg, bestOtherChar, bestOtherAvg, margin,
    };
  }

  // ---------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------
  // userStrokes: array of strokes, each an array of {x,y} in 0..1 space.
  // referenceStrokeDefs: strokeData[char] entries ({d,label}) as found in
  //   the production strokeData object (via fixtures/reference-data.generated.js).
  function evaluateCharacter(userStrokes, referenceStrokeDefs, opts) {
    opts = opts || {};
    const N = opts.samplePoints || THRESHOLDS.SAMPLE_POINTS_PER_STROKE;

    const refFeatures = referenceStrokeDefs.map((s) => {
      const { points, length } = sampleReferencePath(s.d, N);
      return Object.assign(extractStrokeFeatures(points, length), { label: s.label });
    });

    const userFeatures = userStrokes.map((stroke) => {
      const { points, length } = resampleUserStroke(stroke, N);
      return extractStrokeFeatures(points, length);
    });

    const charBBox = unionBBox(refFeatures);

    const hardGate = {
      strokeCount: userFeatures.length === refFeatures.length,
      expectedStrokeCount: refFeatures.length,
      actualStrokeCount: userFeatures.length,
      minLength: null, // filled below once assignment is known
      grossLocation: null,
      absoluteGeometry: null, // filled below — Phase T2-C''
    };

    // Gross-location gate can be evaluated even without a valid count match,
    // per-user-stroke, to aid debugging.
    const grossLocationPerStroke = userFeatures.map((uf) =>
      pointInExpandedBBox(uf.centroid, charBBox, THRESHOLDS.GROSS_LOCATION_MARGIN)
    );
    hardGate.grossLocation = grossLocationPerStroke.every(Boolean);

    // Absolute Geometry Guard (Phase T2-C''): character-level, independent
    // of per-stroke assignment, so it can run even before stroke matching.
    const absGeom = absoluteGeometryCheck(userFeatures, refFeatures, charBBox);
    hardGate.absoluteGeometry = absGeom.pass;
    hardGate.absoluteGeometryDetail = absGeom;

    if (!hardGate.strokeCount) {
      return {
        pass: false,
        score: 0,
        reason: 'stroke_count_mismatch',
        hardGate,
        strokes: [],
        orderPenalty: null,
        spatialScore: null,
      };
    }

    const { assignment, costMatrix } = matchStrokes(userFeatures, refFeatures);

    const minLengthOk = userFeatures.every((uf, i) => {
      const rf = refFeatures[assignment[i]];
      return rf.length > 0 ? uf.length / rf.length >= THRESHOLDS.MIN_LENGTH_RATIO : true;
    });
    hardGate.minLength = minLengthOk;

    const hardGatePassed = hardGate.strokeCount && hardGate.minLength && hardGate.grossLocation && hardGate.absoluteGeometry;

    const strokeResults = userFeatures.map((uf, i) => {
      const j = assignment[i];
      const rf = refFeatures[j];
      const stats = bidirectionalStats(uf.intrinsicPoints, rf.intrinsicPoints);
      const shapeScore = clamp01(1 - ((stats.meanUserToRef + stats.meanRefToUser) / 2) / THRESHOLDS.SHAPE_NORM);
      const coverage = coverageRatio(rf.intrinsicPoints, uf.intrinsicPoints, THRESHOLDS.SHAPE_TOLERANCE);
      const offPath = offPathRatio(uf.intrinsicPoints, rf.intrinsicPoints, THRESHOLDS.SHAPE_TOLERANCE);
      const startEnd = startEndComponent(uf, rf);
      const dir = directionComponent(uf, rf);
      const lengthRatio = rf.length > 0 ? uf.length / rf.length : 1;
      const structural = structuralDistance(uf.intrinsicPoints, rf.intrinsicPoints);
      const positionMetric = strokePositionMetric(uf.absPoints, rf.absPoints, Math.hypot(charBBox.width, charBBox.height));
      const completion = progressSpan(uf.absPoints, rf.absPoints);
      return {
        matchedReferenceStroke: j,
        referenceLabel: rf.label,
        shape: shapeScore,
        coverage,
        offPath,
        startEnd,
        direction: dir.component,
        directionLabel: dir.label,
        lengthRatio,
        structuralDistance: structural,
        positionMetric,
        completion,
        cost: costMatrix[i][j],
      };
    });

    // Per-Stroke Position Guard (Phase T2-C'''): catches a single stroke
    // drawn far from where it belongs even when other strokes are correct
    // (whole-character centroid alone averages this out in multi-stroke
    // characters). Per-stroke, not absolute-pixel: normalized by the
    // character's own bbox diagonal.
    const positionGuardOk = strokeResults.every((r) => r.positionMetric <= THRESHOLDS.STROKE_POSITION_MAX);

    // Per-Stroke Completion Guard (Phase T2-C'''): catches a stroke that
    // stops partway through (independent of raw path length, which
    // meandering/noise can inflate without actually finishing the stroke).
    const completionGuardOk = strokeResults.every((r) => r.completion >= THRESHOLDS.STROKE_COMPLETION_MIN_SPAN);

    // Relative Character Discrimination (Phase T2-C'''): replaces the
    // T2-C'' absolute DTW hard gate. Opt-in via opts.allCharacters +
    // opts.targetChar (e.g. hiragana-learn.html passes the full strokeData
    // object and the currently-selected kana). Skipped (treated as passing)
    // if not provided, so existing callers/tests without sibling data are
    // unaffected.
    const relativeDiscrimination = relativeCharacterDiscrimination(
      userFeatures.map((f) => f.intrinsicPoints),
      opts.allCharacters,
      opts.targetChar
    );
    const characterDiscriminationOk = relativeDiscrimination ? relativeDiscrimination.pass : true;

    const orderPenalty = THRESHOLDS.ORDER_PENALTY_WEIGHT * orderPenaltyFor(assignment);
    const spatialScore = spatialAgreement(userFeatures, refFeatures, assignment);

    const w = THRESHOLDS.WEIGHTS;
    const perStrokeScores = strokeResults.map((r) => {
      const offPathPenalty = r.offPath > THRESHOLDS.OFFPATH_FAIL_RATIO ? 1 : r.offPath;
      return clamp01(
        w.shape * r.shape +
        w.coverage * r.coverage -
        w.offPath * offPathPenalty +
        w.startEnd * r.startEnd +
        w.direction * r.direction
      );
    });
    // 各strokeへ合成scoreを付与(debug表示・Per-Stroke Quality Floor判定の両方で使う)
    strokeResults.forEach((r, i) => { r.perStrokeScore = perStrokeScores[i]; });
    const avgStrokeScore = perStrokeScores.reduce((a, b) => a + b, 0) / perStrokeScores.length;

    // --- Per-Stroke Quality Floor (Phase T2-B'' — Root Cause対応) ---
    // 「良い1・2画目が悪い3画目を相殺する」問題への対処。文字全体の平均scoreとは
    // 独立に、各strokeが最低限「そのstrokeとして成立しているか」を見る。
    //
    // 指標はperStrokeScore(startEnd/direction込みの合成値)ではなく
    // min(shape, coverage)を使う。理由(calibrate-stroke-floor-full.jsで実データ検証済み):
    // startEndやdirectionは、直線・単純な代用でも実際のstrokeの始点・終点さえ
    // 一致すれば簡単に高得点になってしまい(例:あ3画目の大きな輪をただの直線に
    // 置き換えてもstartEnd=1になる)、perStrokeScoreだけではMotor Variation
    // (震え等)の最低scoreと「直線などの雑な代用」の最高scoreが逆転し分離できない
    // (worstGood=0.826 <= bestBad=0.843)。shape/coverageに絞ると、
    // 「元々ほぼ直線のstroke」(あ1・2画目、ま1・2画目等)は直線で描いても
    // 自然に高得点のまま(これは代用ではなく正しい再現なので妥当)、
    // 一方「実際に曲線・輪を描く必要があるstroke」(あ3画目など)を直線や
    // ぐちゃっとした形で誤魔化した場合は明確に低くなるため、
    // Motor Variationとの分離が大幅に改善する(worstGood=0.921 vs
    // 「誤魔化すべきでないbad case」の大半が0.77以下)。
    const perStrokeFloorOk = strokeResults.every((r) => Math.min(r.shape, r.coverage) >= THRESHOLDS.STROKE_QUALITY_FLOOR);
    hardGate.strokeQualityFloor = perStrokeFloorOk;
    hardGate.strokePosition = positionGuardOk;
    hardGate.strokeCompletion = completionGuardOk;
    hardGate.characterDiscrimination = characterDiscriminationOk;
    hardGate.characterDiscriminationDetail = relativeDiscrimination;

    const spatialWeight = userFeatures.length >= 2 ? THRESHOLDS.SPATIAL_WEIGHT : 0;
    let score = avgStrokeScore * (1 - spatialWeight) + spatialScore * spatialWeight - orderPenalty;
    score = clamp01(score);

    const pass = hardGatePassed && perStrokeFloorOk && positionGuardOk && completionGuardOk
      && characterDiscriminationOk && score >= THRESHOLDS.PASS_THRESHOLD;

    let reason = 'ok';
    if (!hardGatePassed) reason = 'hard_gate_failed';
    else if (!perStrokeFloorOk) reason = 'stroke_quality_floor_failed';
    else if (!positionGuardOk) reason = 'stroke_position_failed';
    else if (!completionGuardOk) reason = 'stroke_completion_failed';
    else if (!characterDiscriminationOk) reason = 'character_discrimination_failed';
    else if (score < THRESHOLDS.PASS_THRESHOLD) reason = 'low_score';

    return {
      pass,
      score,
      reason,
      hardGate,
      assignment,
      strokes: strokeResults,
      orderPenalty,
      spatialScore,
    };
  }

  const TracingEngine = {
    THRESHOLDS,
    parseCubicPath,
    sampleReferencePath,
    resampleUserStroke,
    normalizeUserStrokesFromPixels,
    intrinsicNormalize,
    extractStrokeFeatures,
    bidirectionalStats,
    coverageRatio,
    offPathRatio,
    matchStrokes,
    evaluateCharacter,
    // exposed for the visual debugger / tests
    computeBBox,
    centroidOf,
    structuralDistance,
    strokePositionMetric,
    progressSpan,
    relativeCharacterDiscrimination,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TracingEngine;
  } else if (typeof window !== 'undefined') {
    window.TracingEngine = TracingEngine;
  } else {
    root.TracingEngine = TracingEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
