// Phase T2-A — Synthetic Golden Trace Generator
//
// Produces deterministic (seeded) synthetic user-stroke traces derived
// from the PoC reference paths, for the Golden Test Matrix (Section 23-27).
// Depends on engine.js (sampleReferencePath) and reference-data.generated.js.
// No DOM dependency; runs identically in Node and browser.

(function (root) {
  'use strict';

  const Engine = (typeof module !== 'undefined' && module.exports)
    ? require('./engine.js')
    : root.TracingEngine;

  // Deterministic PRNG (mulberry32) so golden traces are 100% reproducible.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function referencePointsFor(refDefs, samplePoints) {
    return refDefs.map((s) => Engine.sampleReferencePath(s.d, samplePoints || 40).points);
  }

  function charBBoxOf(refDefs) {
    const allPts = referencePointsFor(refDefs, 20).flat();
    return Engine.computeBBox(allPts);
  }

  // --- PASS-side transforms (should still be judged PASS) ---

  function ideal(refDefs) {
    return referencePointsFor(refDefs, 40).map((pts) => pts.map((p) => ({ x: p.x, y: p.y })));
  }

  function mildWobble(refDefs, amplitude, seed) {
    const rng = makeRng(seed || 1);
    return referencePointsFor(refDefs, 60).map((pts) =>
      pts.map((p) => ({
        x: p.x + (rng() - 0.5) * 2 * amplitude,
        y: p.y + (rng() - 0.5) * 2 * amplitude,
      }))
    );
  }

  function slightOffset(refDefs, dx, dy) {
    return referencePointsFor(refDefs, 40).map((pts) => pts.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  }

  function slightScale(refDefs, factor) {
    const bbox = charBBoxOf(refDefs);
    const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2;
    return referencePointsFor(refDefs, 40).map((pts) =>
      pts.map((p) => ({ x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor }))
    );
  }

  function mildlyUneven(refDefs, seed) {
    // Local wobble concentrated in the middle third of each stroke only.
    const rng = makeRng(seed || 2);
    return referencePointsFor(refDefs, 60).map((pts) =>
      pts.map((p, i) => {
        const frac = i / (pts.length - 1);
        const inMiddle = frac > 0.33 && frac < 0.66;
        const amp = inMiddle ? 0.02 : 0.003;
        return { x: p.x + (rng() - 0.5) * 2 * amp, y: p.y + (rng() - 0.5) * 2 * amp };
      })
    );
  }

  function reversedDirection(refDefs) {
    return referencePointsFor(refDefs, 40).map((pts) => pts.slice().reverse());
  }

  function reversedOrder(refDefs) {
    return referencePointsFor(refDefs, 40).slice().reverse();
  }

  // --- FAIL-side transforms ---

  function tinyStrokes(refDefs, fraction) {
    // Keep only the first `fraction` of each stroke's sampled points,
    // simulating a barely-started stroke.
    return referencePointsFor(refDefs, 40).map((pts) => {
      const cut = Math.max(2, Math.round(pts.length * fraction));
      return pts.slice(0, cut);
    });
  }

  function offPosition(refDefs) {
    // Shift far into a corner, well outside the expanded character bbox.
    return referencePointsFor(refDefs, 40).map((pts) => pts.map((p) => ({ x: p.x * 0.15 + 0.02, y: p.y * 0.15 + 0.02 })));
  }

  function incompleteStrokeCount(refDefs) {
    // Drop the last stroke entirely (wrong stroke count -> Hard Gate A).
    return referencePointsFor(refDefs, 40).slice(0, -1);
  }

  function unrelatedShape(refDefs, seed) {
    // A generic zigzag scribble, independent of the reference shape,
    // but with the SAME stroke count and roughly within the char bbox.
    const bbox = charBBoxOf(refDefs);
    const rng = makeRng(seed || 3);
    return refDefs.map(() => {
      const pts = [];
      let x = bbox.minX + rng() * bbox.width, y = bbox.minY + rng() * bbox.height;
      for (let i = 0; i < 12; i++) {
        x += (rng() - 0.5) * bbox.width * 0.6;
        y += (rng() - 0.5) * bbox.height * 0.6;
        pts.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
      }
      return pts;
    });
  }

  // Special regression fixture: two roughly-horizontal strokes ("ニ"-like)
  // sized to plausibly fit within any 2-stroke character's bbox.
  function twoHorizontalLines(refDefs) {
    const bbox = charBBoxOf(refDefs);
    const y1 = bbox.minY + bbox.height * 0.28;
    const y2 = bbox.minY + bbox.height * 0.72;
    const x0 = bbox.minX + bbox.width * 0.15;
    const x1 = bbox.minX + bbox.width * 0.85;
    const line = (y) => {
      const pts = [];
      for (let i = 0; i <= 20; i++) pts.push({ x: x0 + (x1 - x0) * (i / 20), y });
      return pts;
    };
    return [line(y1), line(y2)];
  }

  function twoVerticalLines(refDefs) {
    const bbox = charBBoxOf(refDefs);
    const x1 = bbox.minX + bbox.width * 0.3;
    const x2 = bbox.minX + bbox.width * 0.7;
    const y0 = bbox.minY + bbox.height * 0.1;
    const y1 = bbox.minY + bbox.height * 0.9;
    const line = (x) => {
      const pts = [];
      for (let i = 0; i <= 20; i++) pts.push({ x, y: y0 + (y1 - y0) * (i / 20) });
      return pts;
    };
    return [line(x1), line(x2)];
  }

  // --- Motor accessibility / device sampling variants (Section 26-27) ---

  function withDensity(strokes, targetCount) {
    // Re-derive each stroke at a different raw point density by resampling
    // through the engine's own arc-length resampler, simulating a
    // slower/coarser or denser input device.
    return strokes.map((pts) => Engine.resampleUserStroke(pts, targetCount).points);
  }

  function withIrregularSpacing(strokes, seed) {
    const rng = makeRng(seed || 4);
    return strokes.map((pts) => {
      // Randomly drop ~40% of points to create uneven arc-length gaps.
      return pts.filter((_, i) => i === 0 || i === pts.length - 1 || rng() > 0.4);
    });
  }

  function withTremor(strokes, amplitude, freq, seed) {
    const rng = makeRng(seed || 5);
    return strokes.map((pts) =>
      pts.map((p, i) => ({
        x: p.x + Math.sin(i * freq + rng() * 6.28) * amplitude,
        y: p.y + Math.cos(i * freq + rng() * 6.28) * amplitude,
      }))
    );
  }

  function withBriefPause(strokes) {
    // Insert a cluster of near-duplicate points mid-stroke (simulating a
    // momentary pause) without otherwise altering the path.
    return strokes.map((pts) => {
      const mid = Math.floor(pts.length / 2);
      const pausePt = pts[mid];
      const pause = Array.from({ length: 6 }, () => ({ x: pausePt.x, y: pausePt.y }));
      return pts.slice(0, mid).concat(pause, pts.slice(mid));
    });
  }

  function withSmallBacktrack(strokes, seed) {
    const rng = makeRng(seed || 6);
    return strokes.map((pts) => {
      const mid = Math.floor(pts.length / 2);
      const back = pts.slice(Math.max(0, mid - 4), mid).slice().reverse();
      return pts.slice(0, mid).concat(back, pts.slice(mid));
    });
  }

  const GoldenTraces = {
    makeRng,
    referencePointsFor,
    charBBoxOf,
    ideal,
    mildWobble,
    slightOffset,
    slightScale,
    mildlyUneven,
    reversedDirection,
    reversedOrder,
    tinyStrokes,
    offPosition,
    incompleteStrokeCount,
    unrelatedShape,
    twoHorizontalLines,
    twoVerticalLines,
    withDensity,
    withIrregularSpacing,
    withTremor,
    withBriefPause,
    withSmallBacktrack,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoldenTraces;
  } else if (typeof window !== 'undefined') {
    window.GoldenTraces = GoldenTraces;
  } else {
    root.GoldenTraces = GoldenTraces;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
