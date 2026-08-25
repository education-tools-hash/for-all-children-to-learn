#!/usr/bin/env python
"""Phase T2-A' — Visual Reference Validation capture script.

Opens tools/tracing-poc/visual-debugger.html in headless Chromium (via the
Playwright installation already used by tools/make-mockups.py — no new
browser dependency added), exercises it as a smoke test (character switch,
case switch, view toggles), captures View A/B/C screenshots for the 5 PoC
characters plus a dedicated "い" deep-dive (ideal / mild wobble / "ニ"), and
computes numeric guide-vs-reference metrics (bbox IoU, center displacement,
tolerance-corridor coverage of the ACTUAL rendered glyph ink) directly in
the browser using the real Noto Sans JP web font.

This script is a PoC/dev tool only. It does not touch Production app files.

Usage: python tools/tracing-poc/capture-visual-review.py
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
DEBUGGER_PATH = HERE / "visual-debugger.html"
OUT_DIR = HERE / "review-artifacts"
OUT_DIR.mkdir(exist_ok=True)

CHARS = ["い", "く", "こ", "あ", "ま"]
VIEWS = ["A", "B", "C"]

II_DEEP_DIVE_CASES = {
    "ideal": "理想(P1)",
    "wobbleMild": "軽い震え(P2, amp=0.012)",
    "twoHoriz": '横線2本("ニ"型)',
}

METRICS_JS = r"""
(ch) => {
  const REF = window.TRACING_POC_REFERENCE[ch];
  const Engine = window.TracingEngine;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const inkPts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Ghost glyph color is rgba(100,100,200,a) blended over white -> B > R.
      // Grid lines are neutral gray (R=G=B) so they are excluded by this test.
      if (b - r > 3) inkPts.push({ x: x / w, y: y / h });
    }
  }
  if (inkPts.length === 0) return { error: 'no ink pixels detected (guide not visible in current view)' };

  const refFeatures = REF.map((s) => {
    const { points, length } = Engine.sampleReferencePath(s.d, 64);
    return Engine.extractStrokeFeatures(points, length);
  });
  const refPts = [];
  const refRadii = [];
  const strokeOfGlobalIdx = [];
  refFeatures.forEach((rf, si) => {
    const radius = Engine.THRESHOLDS.SHAPE_TOLERANCE * Math.max(rf.bbox.width, rf.bbox.height, 1e-6);
    rf.absPoints.forEach((p, wi) => { refPts.push(p); refRadii.push(radius); strokeOfGlobalIdx.push({ strokeIdx: si, withinIdx: wi }); });
  });

  function nearest(pt) {
    let best = Infinity, bi = -1;
    for (let i = 0; i < refPts.length; i++) {
      const dx = pt.x - refPts[i].x, dy = pt.y - refPts[i].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) { best = d; bi = i; }
    }
    return { dist: best, idx: bi };
  }

  const stride = Math.max(1, Math.floor(inkPts.length / 3000));
  let inCorridor = 0, sampledCount = 0, sx = 0, sy = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const perStrokeInk = refFeatures.map(() => []);
  for (let i = 0; i < inkPts.length; i += stride) {
    const p = inkPts[i];
    sx += p.x; sy += p.y; sampledCount++;
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    const { dist, idx } = nearest(p);
    if (dist <= refRadii[idx]) inCorridor++;
    // Loosely assign ink to its nearest reference stroke (generous radius
    // multiplier) so we can reconstruct a plausible "if a child traced
    // exactly along the visible ink" synthetic stroke per reference stroke,
    // ordered by the matched reference point's arc-length position.
    if (dist <= refRadii[idx] * 3) {
      const { strokeIdx, withinIdx } = strokeOfGlobalIdx[idx];
      perStrokeInk[strokeIdx].push({ withinIdx, x: p.x, y: p.y });
    }
  }
  const centroid = { x: sx / sampledCount, y: sy / sampledCount };

  const simulatedUserStrokes = perStrokeInk.map((arr) => {
    arr.sort((a, b) => a.withinIdx - b.withinIdx);
    return arr.map((o) => ({ x: o.x, y: o.y }));
  });
  const simInvalidReason = simulatedUserStrokes.some((s) => s.length < 2) ? 'one_or_more_strokes_had_insufficient_assigned_ink' : null;
  const simulatedGuideTraceResult = simInvalidReason ? null : Engine.evaluateCharacter(simulatedUserStrokes, REF);

  const refBBox = Engine.computeBBox(refFeatures.flatMap((rf) => rf.absPoints));
  const refCentroid = { x: (refBBox.minX + refBBox.maxX) / 2, y: (refBBox.minY + refBBox.maxY) / 2 };

  const ox1 = Math.max(minX, refBBox.minX), oy1 = Math.max(minY, refBBox.minY);
  const ox2 = Math.min(maxX, refBBox.maxX), oy2 = Math.min(maxY, refBBox.maxY);
  const overlapArea = Math.max(0, ox2 - ox1) * Math.max(0, oy2 - oy1);
  const guideArea = (maxX - minX) * (maxY - minY);
  const unionArea = guideArea + refBBox.width * refBBox.height - overlapArea;
  const iou = unionArea > 0 ? overlapArea / unionArea : 0;

  return {
    inkPixelCountApprox: inkPts.length,
    sampledCount,
    corridorCoverageEstimate: inCorridor / sampledCount,
    centerDisplacement: Math.hypot(centroid.x - refCentroid.x, centroid.y - refCentroid.y),
    bboxIoU: iou,
    guideBBox: { minX, minY, maxX, maxY },
    refBBox: { minX: refBBox.minX, minY: refBBox.minY, maxX: refBBox.maxX, maxY: refBBox.maxY },
    simulatedGuideTrace: simInvalidReason
      ? { valid: false, reason: simInvalidReason }
      : { valid: true, pass: simulatedGuideTraceResult.pass, score: simulatedGuideTraceResult.score, reason: simulatedGuideTraceResult.reason, hardGate: simulatedGuideTraceResult.hardGate },
  };
}
"""


def main():
    console_messages = []
    page_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 900, "height": 760})
        page.on("console", lambda msg: console_messages.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        page.goto(DEBUGGER_PATH.as_uri())
        # Font-load race in the page is capped at 4000ms; give it margin.
        page.wait_for_timeout(4500)

        font_status_text = page.locator("#fontStatus").inner_text()
        font_loaded = page.eval_on_selector("#fontStatus", "el => el.dataset.fontLoaded")

        smoke = {"load": True, "char_switch": False, "case_switch": False, "toggles": False}

        per_char = {}
        for ch in CHARS:
            page.select_option("#charSelect", ch)
            smoke["char_switch"] = True
            page.wait_for_timeout(60)
            per_char[ch] = {"views": {}}
            for v in VIEWS:
                page.click(f"#view{v}")
                page.wait_for_timeout(80)
                shot = OUT_DIR / f"{ch}_view{v}.png"
                page.locator("#stage").screenshot(path=str(shot))
                metrics = page.evaluate(METRICS_JS, ch)
                per_char[ch]["views"][v] = {
                    "screenshot": shot.name,
                    "badge": page.locator("#resultBadge").inner_text(),
                    "scoreLine": page.locator("#scoreLine").inner_text(),
                    "metrics": metrics,
                }

        # explicit checkbox smoke-toggle (independent of the view buttons)
        for cb in ["showGuide", "showRef", "showCorridor", "showUser"]:
            page.click(f"#{cb}")
            page.wait_for_timeout(30)
            page.click(f"#{cb}")
            page.wait_for_timeout(30)
        smoke["toggles"] = True

        # "い" deep-dive across cases: Guide + Reference + Corridor + the
        # case's synthetic User trace, all overlaid, so ideal/wobble/"ニ"
        # are visibly distinguishable against the same reference (View C's
        # preset hides the user trace by design, so re-enable it here).
        page.select_option("#charSelect", "い")
        ii_results = {}
        for case_id, label in II_DEEP_DIVE_CASES.items():
            page.select_option("#caseSelect", case_id)
            smoke["case_switch"] = True
            page.click("#viewC")
            page.check("#showUser")
            page.wait_for_timeout(80)
            shot = OUT_DIR / f"ii_case_{case_id}.png"
            page.locator("#stage").screenshot(path=str(shot))
            ii_results[case_id] = {
                "label": label,
                "screenshot": shot.name,
                "badge": page.locator("#resultBadge").inner_text(),
                "scoreLine": page.locator("#scoreLine").inner_text(),
            }

        browser.close()

    console_errors = [m for m in console_messages if m["type"] == "error"]

    report = {
        "font_status_text": font_status_text,
        "font_loaded": font_loaded,
        "console_error_count": len(console_errors),
        "console_errors": console_errors,
        "console_message_count_total": len(console_messages),
        "page_error_count": len(page_errors),
        "page_errors": page_errors,
        "smoke": smoke,
        "per_char": per_char,
        "ii_deep_dive": ii_results,
    }
    report_path = OUT_DIR / "capture-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if (len(console_errors) == 0 and len(page_errors) == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
