// Phase T2-A — Tracing Engine PoC
//
// Deterministic, client-side-portable (no DOM dependency), pure-function
// shape-evaluation engine for なぞり (tracing) judgement. This is a PoC
// module only — NOT wired into hiragana-learn.html / katakana-app.html.
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
    };

    // Gross-location gate can be evaluated even without a valid count match,
    // per-user-stroke, to aid debugging.
    const grossLocationPerStroke = userFeatures.map((uf) =>
      pointInExpandedBBox(uf.centroid, charBBox, THRESHOLDS.GROSS_LOCATION_MARGIN)
    );
    hardGate.grossLocation = grossLocationPerStroke.every(Boolean);

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

    const hardGatePassed = hardGate.strokeCount && hardGate.minLength && hardGate.grossLocation;

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
        cost: costMatrix[i][j],
      };
    });

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

    const spatialWeight = userFeatures.length >= 2 ? THRESHOLDS.SPATIAL_WEIGHT : 0;
    let score = avgStrokeScore * (1 - spatialWeight) + spatialScore * spatialWeight - orderPenalty;
    score = clamp01(score);

    const pass = hardGatePassed && perStrokeFloorOk && score >= THRESHOLDS.PASS_THRESHOLD;

    let reason = 'ok';
    if (!hardGatePassed) reason = 'hard_gate_failed';
    else if (!perStrokeFloorOk) reason = 'stroke_quality_floor_failed';
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
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TracingEngine;
  } else if (typeof window !== 'undefined') {
    window.TracingEngine = TracingEngine;
  } else {
    root.TracingEngine = TracingEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
