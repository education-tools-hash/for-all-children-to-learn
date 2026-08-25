#!/usr/bin/env python
"""Phase T2-B — Real-browser regression test for the Hiragana Tracing Pilot.

Drives the ACTUAL hiragana-learn.html (Local Pilot, feature branch only) via
Playwright (the same Chromium install used by tools/make-mockups.py — no new
browser dependency), sending genuine mouse-driven Pointer Events at the real
#traceCanvas element so every case goes through the production
pointerdown/pointermove/pointerup listeners exactly as a user's input would.

This does not modify hiragana-learn.html; it only reads/interacts with it.

Usage: python tools/tracing-poc/test-hiragana-pilot.py
"""
import json
import math
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "pilot-review-artifacts"
OUT_DIR.mkdir(exist_ok=True)

PILOT_MARGIN = 320 * 0.06
PILOT_SCALE = (320 - PILOT_MARGIN * 2) / 109


def canvas_px(p):
    return {"x": p["x"] * 109 * PILOT_SCALE + PILOT_MARGIN, "y": p["y"] * 109 * PILOT_SCALE + PILOT_MARGIN}


def select_char(page, ch):
    page.click(f'.trace-kana-pick:text-is("{ch}")')
    page.wait_for_timeout(60)


def get_debug_result(page):
    page.wait_for_timeout(60)
    text = page.locator("#tracingDebugPanel").inner_text()
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}


def draw_stroke_screen_points(page, screen_points, pointer_type="mouse"):
    """Draw one stroke via genuine Playwright mouse actions (pointerType=mouse)."""
    x0, y0 = screen_points[0]
    page.mouse.move(x0, y0)
    page.mouse.down()
    for (x, y) in screen_points[1:]:
        page.mouse.move(x, y, steps=2)
    page.mouse.up()


def norm_points_to_screen(canvas_box, points_norm):
    out = []
    for p in points_norm:
        c = canvas_px(p)
        sx = canvas_box["x"] + c["x"] * (canvas_box["width"] / 320)
        sy = canvas_box["y"] + c["y"] * (canvas_box["height"] / 320)
        out.append((sx, sy))
    return out


def get_ref_points(page, ch, stroke_idx, n=40):
    return page.evaluate(
        "([ch, i, n]) => TracingEngine.sampleReferencePath(strokeData[ch][i].d, n).points",
        [ch, stroke_idx, n],
    )


def draw_reference_strokes(page, ch, transform=None, order=None, reverse_each=False, n=40):
    """Draw every reference stroke of `ch` as a real pointer drag.
    transform(list_of_points)->list_of_points can perturb/offset/scale.
    order: optional list of stroke indices controlling draw order (筆順).
    """
    canvas_box = page.locator("#traceCanvas").bounding_box()
    stroke_count = page.evaluate("(ch) => strokeData[ch].length", ch)
    indices = order if order is not None else list(range(stroke_count))
    for i in indices:
        pts = get_ref_points(page, ch, i, n)
        if reverse_each:
            pts = list(reversed(pts))
        if transform:
            pts = transform(pts)
        screen_pts = norm_points_to_screen(canvas_box, pts)
        draw_stroke_screen_points(page, screen_pts)


def draw_custom_strokes(page, strokes_norm):
    canvas_box = page.locator("#traceCanvas").bounding_box()
    for pts in strokes_norm:
        screen_pts = norm_points_to_screen(canvas_box, pts)
        draw_stroke_screen_points(page, screen_pts)


def line_points(x0, y0, x1, y1, n=20):
    return [{"x": x0 + (x1 - x0) * i / (n - 1), "y": y0 + (y1 - y0) * i / (n - 1)} for i in range(n)]


def wobble(points, amp=0.012, seed=1):
    out = []
    a = seed
    for p in points:
        a = (a * 1103515245 + 12345) & 0x7FFFFFFF
        r1 = (a % 1000) / 1000 - 0.5
        a = (a * 1103515245 + 12345) & 0x7FFFFFFF
        r2 = (a % 1000) / 1000 - 0.5
        out.append({"x": p["x"] + r1 * 2 * amp, "y": p["y"] + r2 * 2 * amp})
    return out


def offset(points, dx=0.03, dy=0.02):
    return [{"x": p["x"] + dx, "y": p["y"] + dy} for p in points]


def scale_about_center(points, factor=1.12, cx=0.5, cy=0.5):
    return [{"x": cx + (p["x"] - cx) * factor, "y": cy + (p["y"] - cy) * factor} for p in points]


def zigzag_scribble(n_points=12, seed=1, cx=0.5, cy=0.5, spread=0.35):
    a = seed
    x, y = cx, cy
    pts = []
    for _ in range(n_points):
        a = (a * 1103515245 + 12345) & 0x7FFFFFFF
        r1 = (a % 1000) / 1000 - 0.5
        a = (a * 1103515245 + 12345) & 0x7FFFFFFF
        r2 = (a % 1000) / 1000 - 0.5
        x = max(0.05, min(0.95, x + r1 * spread))
        y = max(0.05, min(0.95, y + r2 * spread))
        pts.append({"x": x, "y": y})
    return pts


def shrink_to_fraction(points, frac=0.15):
    cut = max(2, round(len(points) * frac))
    return points[:cut]


def main():
    console_messages = []
    page_errors = []
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(viewport=None):
            page = browser.new_page(viewport=viewport or {"width": 1280, "height": 900})
            page.on("console", lambda msg: console_messages.append({"type": msg.type, "text": msg.text}))
            page.on("pageerror", lambda exc: page_errors.append(str(exc)))
            page.goto(APP_PATH.as_uri() + "?tracingDebug=1")
            page.wait_for_timeout(300)
            page.click('button[data-tab="trace"]')
            page.wait_for_timeout(150)
            # NOTE: #traceCanvas sits below the fold at default scroll position;
            # bounding_box() does not auto-scroll (unlike click()), so
            # page.mouse coordinates computed from it would land outside the
            # actual viewport without this. (Root-caused via a debug session
            # that found window.__dbgEvents empty until this was added.)
            page.locator("#traceCanvas").scroll_into_view_if_needed()
            page.wait_for_timeout(50)
            return page

        # ---- 1. い full matrix ----
        cases = {}

        def run_case(name, ch, action):
            pg = new_page()
            select_char(pg, ch)
            action(pg)
            r = get_debug_result(pg)
            shot = OUT_DIR / f"{ch}_{name}.png"
            pg.wait_for_timeout(150)  # let RETRY/PASS feedback render before the shot
            pg.locator("#traceStage").screenshot(path=str(shot))
            badge = "PASS" if pg.locator("#goodJob").evaluate("el => el.classList.contains('show')") else (
                "RETRY" if pg.locator("#retryJob").evaluate("el => el.classList.contains('show')") else "NONE"
            )
            pg.close()
            return {"debug": r, "badge": badge, "screenshot": shot.name}

        cases["い_ideal"] = run_case("ideal", "い", lambda pg: draw_reference_strokes(pg, "い"))
        cases["い_wobble"] = run_case("wobble", "い", lambda pg: draw_reference_strokes(pg, "い", transform=lambda pts: wobble(pts, 0.012, 11)))
        cases["い_offset"] = run_case("offset", "い", lambda pg: draw_reference_strokes(pg, "い", transform=lambda pts: offset(pts, 0.03, 0.02)))
        cases["い_scale"] = run_case("scale", "い", lambda pg: draw_reference_strokes(pg, "い", transform=lambda pts: scale_about_center(pts, 1.12)))

        def ni_shape(pg):
            box_bbox = pg.evaluate(
                "() => { const pts = strokeData['い'].flatMap(s => TracingEngine.sampleReferencePath(s.d,20).points); "
                "return { minX: Math.min(...pts.map(p=>p.x)), maxX: Math.max(...pts.map(p=>p.x)), "
                "minY: Math.min(...pts.map(p=>p.y)), maxY: Math.max(...pts.map(p=>p.y)) }; }"
            )
            y1 = box_bbox["minY"] + (box_bbox["maxY"] - box_bbox["minY"]) * 0.28
            y2 = box_bbox["minY"] + (box_bbox["maxY"] - box_bbox["minY"]) * 0.72
            x0 = box_bbox["minX"] + (box_bbox["maxX"] - box_bbox["minX"]) * 0.15
            x1 = box_bbox["minX"] + (box_bbox["maxX"] - box_bbox["minX"]) * 0.85
            draw_custom_strokes(pg, [line_points(x0, y1, x1, y1), line_points(x0, y2, x1, y2)])

        cases["い_ni"] = run_case("ni_regression", "い", ni_shape)

        def vertical_lines(pg):
            box_bbox = pg.evaluate(
                "() => { const pts = strokeData['い'].flatMap(s => TracingEngine.sampleReferencePath(s.d,20).points); "
                "return { minX: Math.min(...pts.map(p=>p.x)), maxX: Math.max(...pts.map(p=>p.x)), "
                "minY: Math.min(...pts.map(p=>p.y)), maxY: Math.max(...pts.map(p=>p.y)) }; }"
            )
            x1 = box_bbox["minX"] + (box_bbox["maxX"] - box_bbox["minX"]) * 0.3
            x2 = box_bbox["minX"] + (box_bbox["maxX"] - box_bbox["minX"]) * 0.7
            y0 = box_bbox["minY"]
            y1 = box_bbox["maxY"]
            draw_custom_strokes(pg, [line_points(x1, y0, x1, y1), line_points(x2, y0, x2, y1)])

        cases["い_vertical"] = run_case("vertical_lines", "い", vertical_lines)
        cases["い_tiny"] = run_case("tiny", "い", lambda pg: draw_reference_strokes(pg, "い", transform=lambda pts: shrink_to_fraction(pts, 0.15)))
        cases["い_offposition"] = run_case(
            "offposition", "い",
            lambda pg: draw_reference_strokes(
                pg, "い",
                transform=lambda pts: [{"x": p["x"] * 0.15 + 0.02, "y": p["y"] * 0.15 + 0.02} for p in pts],
            ),
        )
        cases["い_reversedorder"] = run_case("reversed_order", "い", lambda pg: draw_reference_strokes(pg, "い", order=[1, 0]))
        cases["い_reverseddir"] = run_case("reversed_direction", "い", lambda pg: draw_reference_strokes(pg, "い", reverse_each=True))

        # incomplete: draw only stroke 0, confirm NO feedback appears (waits silently)
        pg = new_page()
        select_char(pg, "い")
        draw_reference_strokes(pg, "い", order=[0])
        r = get_debug_result(pg)
        badge = "PASS" if pg.locator("#goodJob").evaluate("el => el.classList.contains('show')") else (
            "RETRY" if pg.locator("#retryJob").evaluate("el => el.classList.contains('show')") else "NONE"
        )
        cases["い_incomplete"] = {"debug": r, "badge": badge}
        pg.close()

        # ---- other 4 pilot chars: ideal / wobble / unrelated ----
        for ch in ["く", "こ", "あ", "ま"]:
            cases[f"{ch}_ideal"] = run_case("ideal", ch, lambda pg, ch=ch: draw_reference_strokes(pg, ch))
            cases[f"{ch}_wobble"] = run_case("wobble", ch, lambda pg, ch=ch: draw_reference_strokes(pg, ch, transform=lambda pts: wobble(pts, 0.012, 21)))

            def unrelated(pg, ch=ch):
                n = pg.evaluate("(ch) => strokeData[ch].length", ch)
                strokes = [zigzag_scribble(seed=10 + i) for i in range(n)]
                draw_custom_strokes(pg, strokes)

            cases[f"{ch}_unrelated"] = run_case("unrelated", ch, unrelated)

        # ---- non-pilot legacy behavior check ----
        pg = new_page()
        select_char(pg, "か")  # か is NOT a pilot char
        n_expected = pg.evaluate("() => (strokeData['か']||[]).length || 3")
        canvas_box = pg.locator("#traceCanvas").bounding_box()
        for i in range(n_expected):
            draw_stroke_screen_points(pg, norm_points_to_screen(canvas_box, [
                {"x": 0.1 + i * 0.05, "y": 0.1}, {"x": 0.9 - i * 0.05, "y": 0.9},
            ]))
        legacy_badge = "PASS" if pg.locator("#goodJob").evaluate("el => el.classList.contains('show')") else "NONE"
        legacy_debug_visible = pg.locator("#tracingDebugPanel").evaluate("el => el.style.display")
        results["non_pilot_legacy"] = {"expected_strokes": n_expected, "badge_after_arbitrary_strokes": legacy_badge, "debug_panel_display": legacy_debug_visible}
        pg.close()

        # ---- touch pointerType simulation (synthetic PointerEvent dispatch) ----
        pg = new_page()
        select_char(pg, "い")
        touch_result = pg.evaluate(
            """
            (strokesNorm) => {
              const canvas = document.getElementById('traceCanvas');
              const rect = canvas.getBoundingClientRect();
              function toScreen(p) {
                const margin = 320*0.06, scale=(320-margin*2)/109;
                const cx = p.x*109*scale+margin, cy = p.y*109*scale+margin;
                return { clientX: rect.left + cx*(rect.width/320), clientY: rect.top + cy*(rect.height/320) };
              }
              let pid = 2001;
              strokesNorm.forEach(stroke => {
                pid++;
                stroke.forEach((p, i) => {
                  const s = toScreen(p);
                  const type = i===0 ? 'pointerdown' : 'pointermove';
                  canvas.dispatchEvent(new PointerEvent(type, { pointerId: pid, pointerType: 'touch', clientX: s.clientX, clientY: s.clientY, bubbles:true, cancelable:true }));
                });
                const last = toScreen(stroke[stroke.length-1]);
                canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: pid, pointerType: 'touch', clientX: last.clientX, clientY: last.clientY, bubbles:true, cancelable:true }));
              });
              return true;
            }
            """,
            [get_ref_points(pg, "い", 0, 30), get_ref_points(pg, "い", 1, 30)],
        )
        touch_badge = "PASS" if pg.locator("#goodJob").evaluate("el => el.classList.contains('show')") else (
            "RETRY" if pg.locator("#retryJob").evaluate("el => el.classList.contains('show')") else "NONE"
        )
        results["touch_pointertype_ideal_ii"] = {"dispatched": touch_result, "badge": touch_badge}
        pg.close()

        # ---- responsive screenshots ----
        responsive_shots = {}
        for name, vp in {
            "375x667": {"width": 375, "height": 667},
            "390x844": {"width": 390, "height": 844},
            "768x1024": {"width": 768, "height": 1024},
            "1280x900": {"width": 1280, "height": 900},
        }.items():
            pg = new_page(viewport=vp)
            select_char(pg, "い")
            shot = OUT_DIR / f"responsive_{name}.png"
            pg.screenshot(path=str(shot))
            responsive_shots[name] = shot.name
            pg.close()

        browser.close()

    console_errors = [m for m in console_messages if m["type"] == "error"]
    report = {
        "console_error_count": len(console_errors),
        "console_errors": console_errors,
        "console_message_count_total": len(console_messages),
        "page_error_count": len(page_errors),
        "page_errors": page_errors,
        "cases": cases,
        "misc": results,
        "responsive_shots": responsive_shots,
    }
    (OUT_DIR / "pilot-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k not in ("cases",)}, ensure_ascii=False, indent=2))
    print("\n--- cases summary ---")
    for name, c in cases.items():
        badge = c.get("badge")
        score = c.get("debug", {}).get("score")
        print(f"{name}: badge={badge} score={score}")
    return 0 if (len(console_errors) == 0 and len(page_errors) == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
