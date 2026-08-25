#!/usr/bin/env python
"""Phase T2-C — Real-browser verification of the 46-character Full Rollout.

Drives the ACTUAL hiragana-learn.html via Playwright (real mouse-driven
Pointer Events at #traceCanvas) to confirm, in the live app (not just the
standalone engine.js suite):

  1. The SVG Guide renders for a representative 13-character set spanning
     all stroke counts (1-4) and structural groups from character-inventory.js.
  2. Ideal traces PASS for that same set.
  3. い and あ Pilot Regression Lock (Section 11) — the exact case list the
     User already approved on a real device — still holds.
  4. A former "non-Pilot" character (か) that used to succeed on ANY
     arbitrary shape now correctly RETRYs on one (proving the legacy
     strokeCount-only branch was actually removed from the live app, not
     just deleted in source with old behavior lingering via a stale path).
  5. Multi-touch guard / pointer-capture boundary / clearTrace reset /
     privacy (localStorage) still hold post-rollout.
  6. Responsive layout at the 5 required viewports for a 4-stroke character.

Usage: python tools/tracing-poc/test-full-rollout-realbrowser.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "full-rollout-artifacts"
OUT_DIR.mkdir(exist_ok=True)

GUIDE_MARGIN = 320 * 0.06
GUIDE_SCALE = (320 - GUIDE_MARGIN * 2) / 109

# Representative 13-character set (Section 28): Pilot 5 (already real-device
# approved) + 8 more spanning stroke count 1-4 and every structural group,
# including the 3 characters whose calibration required the improved
# wrong-trace generator (き/た/も).
CORE = ["い", "く", "こ", "あ", "ま"]
EXTENDED = ["う", "き", "さ", "た", "な", "の", "ふ", "も"]
REPRESENTATIVE = CORE + EXTENDED


def canvas_px(p):
    return {"x": p["x"] * 109 * GUIDE_SCALE + GUIDE_MARGIN, "y": p["y"] * 109 * GUIDE_SCALE + GUIDE_MARGIN}


def norm_points_to_screen(canvas_box, points_norm):
    out = []
    for p in points_norm:
        c = canvas_px(p)
        sx = canvas_box["x"] + c["x"] * (canvas_box["width"] / 320)
        sy = canvas_box["y"] + c["y"] * (canvas_box["height"] / 320)
        out.append((sx, sy))
    return out


def draw_stroke(page, canvas_box, points_norm):
    screen_pts = norm_points_to_screen(canvas_box, points_norm)
    x0, y0 = screen_pts[0]
    page.mouse.move(x0, y0)
    page.mouse.down()
    for (x, y) in screen_pts[1:]:
        page.mouse.move(x, y, steps=2)
    page.mouse.up()


def get_ref_points(page, ch, stroke_idx, n=40):
    return page.evaluate(
        "([ch, i, n]) => TracingEngine.sampleReferencePath(strokeData[ch][i].d, n).points",
        [ch, stroke_idx, n],
    )


def draw_ideal(page, ch):
    box = page.locator("#traceCanvas").bounding_box()
    n = page.evaluate("(ch) => strokeData[ch].length", ch)
    for i in range(n):
        draw_stroke(page, box, get_ref_points(page, ch, i, 40))


def select_char(page, ch):
    page.click(f'.trace-kana-pick:text-is("{ch}")')
    page.wait_for_timeout(60)


def badge(page):
    if page.locator("#goodJob").evaluate("el => el.classList.contains('show')"):
        return "PASS"
    if page.locator("#retryJob").evaluate("el => el.classList.contains('show')"):
        return "RETRY"
    return "NONE"


def main():
    console_errors = []
    page_errors = []
    results = {"guide_and_ideal": {}, "pilot_regression_lock": {}, "legacy_removed_check": {}, "misc": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(viewport=None):
            page = browser.new_page(viewport=viewport or {"width": 1280, "height": 900})
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            page.goto(APP_PATH.as_uri() + "?tracingDebug=1")
            page.wait_for_timeout(250)
            page.click('button[data-tab="trace"]')
            page.wait_for_timeout(100)
            page.locator("#traceCanvas").scroll_into_view_if_needed()
            page.wait_for_timeout(50)
            return page

        # ---- 1-2. Guide render + ideal PASS for representative 13 chars ----
        for ch in REPRESENTATIVE:
            page = new_page()
            select_char(page, ch)
            shot = OUT_DIR / f"guide_{ch}.png"
            page.locator("#traceWrap").screenshot(path=str(shot))
            draw_ideal(page, ch)
            page.wait_for_timeout(100)
            results["guide_and_ideal"][ch] = {"badge": badge(page), "screenshot": shot.name}
            page.close()

        # ---- 3. い / あ Pilot Regression Lock (Section 11, real browser) ----
        def wobble(pts, amp, seed):
            a = seed
            out = []
            for p in pts:
                a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                r1 = (a % 1000) / 1000 - 0.5
                a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                r2 = (a % 1000) / 1000 - 0.5
                out.append({"x": p["x"] + r1 * 2 * amp, "y": p["y"] + r2 * 2 * amp})
            return out

        def offset(pts, dx, dy):
            return [{"x": p["x"] + dx, "y": p["y"] + dy} for p in pts]

        def scale(pts, factor, cx=0.5, cy=0.5):
            return [{"x": cx + (p["x"] - cx) * factor, "y": cy + (p["y"] - cy) * factor} for p in pts]

        def run_lock(ch, name, action_fn, expected_badge):
            page = new_page()
            select_char(page, ch)
            action_fn(page)
            page.wait_for_timeout(100)
            b = badge(page)
            results["pilot_regression_lock"][f"{ch}_{name}"] = {"badge": b, "expected": expected_badge, "ok": b == expected_badge}
            page.close()

        # い required: ideal/wobble/offset/scale PASS; ニ/vertical/tiny/off-position RETRY
        run_lock("い", "ideal", lambda pg: draw_ideal(pg, "い"), "PASS")
        run_lock("い", "wobble", lambda pg: [draw_stroke(pg, pg.locator("#traceCanvas").bounding_box(), wobble(get_ref_points(pg, "い", i, 40), 0.012, 10 + i)) for i in range(2)], "PASS")
        run_lock("い", "offset", lambda pg: [draw_stroke(pg, pg.locator("#traceCanvas").bounding_box(), offset(get_ref_points(pg, "い", i, 40), 0.03, 0.02)) for i in range(2)], "PASS")
        run_lock("い", "scale", lambda pg: [draw_stroke(pg, pg.locator("#traceCanvas").bounding_box(), scale(get_ref_points(pg, "い", i, 40), 1.1)) for i in range(2)], "PASS")

        def ni_shape(pg):
            box = pg.locator("#traceCanvas").bounding_box()
            bb = pg.evaluate("() => { const pts = strokeData['い'].flatMap(s => TracingEngine.sampleReferencePath(s.d,20).points); return {minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))}; }")
            y1 = bb["minY"] + (bb["maxY"] - bb["minY"]) * 0.28
            y2 = bb["minY"] + (bb["maxY"] - bb["minY"]) * 0.72
            x0 = bb["minX"] + (bb["maxX"] - bb["minX"]) * 0.15
            x1 = bb["minX"] + (bb["maxX"] - bb["minX"]) * 0.85
            line = lambda y: [{"x": x0 + (x1 - x0) * i / 19, "y": y} for i in range(20)]
            draw_stroke(pg, box, line(y1))
            draw_stroke(pg, box, line(y2))

        run_lock("い", "ni", ni_shape, "RETRY")

        def vertical_lines(pg):
            box = pg.locator("#traceCanvas").bounding_box()
            bb = pg.evaluate("() => { const pts = strokeData['い'].flatMap(s => TracingEngine.sampleReferencePath(s.d,20).points); return {minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))}; }")
            x1 = bb["minX"] + (bb["maxX"] - bb["minX"]) * 0.3
            x2 = bb["minX"] + (bb["maxX"] - bb["minX"]) * 0.7
            line = lambda x: [{"x": x, "y": bb["minY"] + (bb["maxY"] - bb["minY"]) * i / 19} for i in range(20)]
            draw_stroke(pg, box, line(x1))
            draw_stroke(pg, box, line(x2))

        run_lock("い", "vertical", vertical_lines, "RETRY")
        run_lock("い", "tiny", lambda pg: [draw_stroke(pg, pg.locator("#traceCanvas").bounding_box(), get_ref_points(pg, "い", i, 40)[:6]) for i in range(2)], "RETRY")
        run_lock("い", "offposition", lambda pg: [draw_stroke(pg, pg.locator("#traceCanvas").bounding_box(), [{"x": p["x"] * 0.15 + 0.02, "y": p["y"] * 0.15 + 0.02} for p in get_ref_points(pg, "い", i, 40)]) for i in range(2)], "RETRY")

        # あ required: ideal/wobble PASS; sloppy/partial/straight/zigzag 3rd stroke RETRY
        run_lock("あ", "ideal", lambda pg: draw_ideal(pg, "あ"), "PASS")
        run_lock("あ", "wobble", lambda pg: [draw_stroke(pg, pg.locator("#traceCanvas").bounding_box(), wobble(get_ref_points(pg, "あ", i, 40), 0.012, 20 + i)) for i in range(3)], "PASS")

        def a_bad_third(pg, transform):
            box = pg.locator("#traceCanvas").bounding_box()
            for i in range(2):
                draw_stroke(pg, box, get_ref_points(pg, "あ", i, 40))
            draw_stroke(pg, box, transform(get_ref_points(pg, "あ", 2, 40)))

        run_lock("あ", "partial_third", lambda pg: a_bad_third(pg, lambda pts: pts[: max(2, round(len(pts) * 0.5))]), "RETRY")

        def straight(pts):
            p0, p1 = pts[0], pts[-1]
            return [{"x": p0["x"] + (p1["x"] - p0["x"]) * i / 19, "y": p0["y"] + (p1["y"] - p0["y"]) * i / 19} for i in range(20)]

        run_lock("あ", "straight_third", lambda pg: a_bad_third(pg, straight), "RETRY")

        def zigzag(pts):
            p0, p1 = pts[0], pts[-1]
            out = []
            for i in range(16):
                t = i / 15
                side = 0.05 if i % 2 == 0 else -0.05
                out.append({"x": p0["x"] + (p1["x"] - p0["x"]) * t + side, "y": p0["y"] + (p1["y"] - p0["y"]) * t})
            return out

        run_lock("あ", "zigzag_third", lambda pg: a_bad_third(pg, zigzag), "RETRY")

        # ---- 4. Legacy-removal check: か with arbitrary shape must now RETRY ----
        page = new_page()
        select_char(page, "か")
        n = page.evaluate("(ch) => strokeData[ch].length", "か")
        box = page.locator("#traceCanvas").bounding_box()
        for i in range(n):
            draw_stroke(page, box, [{"x": 0.1 + i * 0.05, "y": 0.1}, {"x": 0.9 - i * 0.05, "y": 0.9}])
        page.wait_for_timeout(100)
        results["legacy_removed_check"]["か_arbitrary_shape"] = {"badge": badge(page), "expected": "RETRY"}
        page.close()

        page = new_page()
        select_char(page, "か")
        draw_ideal(page, "か")
        page.wait_for_timeout(100)
        results["legacy_removed_check"]["か_ideal"] = {"badge": badge(page), "expected": "PASS"}
        page.close()

        # ---- 5. Multi-touch / pointer-capture / clearTrace / privacy spot-check ----
        page = new_page()
        select_char(page, "た")
        multitouch = page.evaluate(
            """
            () => {
              const canvas = document.getElementById('traceCanvas');
              const rect = canvas.getBoundingClientRect();
              canvas.dispatchEvent(new PointerEvent('pointerdown', {pointerId:701, pointerType:'touch', clientX:rect.left+40, clientY:rect.top+40, bubbles:true, cancelable:true}));
              canvas.dispatchEvent(new PointerEvent('pointerdown', {pointerId:702, pointerType:'touch', clientX:rect.left+200, clientY:rect.top+200, bubbles:true, cancelable:true}));
              const afterSecond = { activePointerId, traceDrawing };
              canvas.dispatchEvent(new PointerEvent('pointerup', {pointerId:701, pointerType:'touch', clientX:rect.left+60, clientY:rect.top+100, bubbles:true, cancelable:true}));
              return { afterSecond, traceStrokesAfter: traceStrokes.length };
            }
            """
        )
        box = page.locator("#traceCanvas").bounding_box()
        draw_stroke(page, box, [{"x": 0.3, "y": 0.3}, {"x": 0.5, "y": 0.5}])
        strokes_before_clear = page.evaluate("() => traceStrokes.length")
        page.click('button:has-text("けす")')
        page.wait_for_timeout(60)
        strokes_after_clear = page.evaluate("() => traceStrokes.length")
        results["misc"]["multi_touch_guard"] = multitouch
        results["misc"]["clear_reset"] = {"before": strokes_before_clear, "after": strokes_after_clear}
        storage_dump = page.evaluate("() => { const o={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); o[k]=localStorage.getItem(k);} return o; }")
        results["misc"]["privacy_localStorage_keys"] = list(storage_dump.keys())
        results["misc"]["privacy_has_xy_data"] = any(('"x"' in (v or "") and '"y"' in (v or "")) for v in storage_dump.values())
        page.close()

        # ---- 6. Responsive (5 viewports, 4-stroke character な) ----
        responsive = {}
        for name, vp in {
            "375x667": {"width": 375, "height": 667},
            "390x844": {"width": 390, "height": 844},
            "768x1024": {"width": 768, "height": 1024},
            "1024x768": {"width": 1024, "height": 768},
            "1280x900": {"width": 1280, "height": 900},
        }.items():
            page = new_page(viewport=vp)
            select_char(page, "な")
            shot = OUT_DIR / f"responsive_{name}.png"
            page.screenshot(path=str(shot))
            responsive[name] = shot.name
            page.close()
        results["misc"]["responsive_shots"] = responsive

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "console_errors": console_errors,
        "page_error_count": len(page_errors),
        "page_errors": page_errors,
        "results": results,
    }
    (OUT_DIR / "full-rollout-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, ensure_ascii=False, indent=2))
    print("\n--- guide_and_ideal ---")
    for ch, r in results["guide_and_ideal"].items():
        print(f"  {ch}: {r['badge']}")
    print("\n--- pilot_regression_lock ---")
    for k, r in results["pilot_regression_lock"].items():
        print(f"  {k}: badge={r['badge']} expected={r['expected']} ok={r['ok']}")
    print("\n--- legacy_removed_check ---")
    for k, r in results["legacy_removed_check"].items():
        print(f"  {k}: badge={r['badge']} expected={r['expected']}")
    print("\n--- misc ---")
    print(json.dumps(results["misc"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
