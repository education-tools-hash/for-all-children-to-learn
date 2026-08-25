#!/usr/bin/env python
"""Phase T2-B'' — Reproduce the「あ」3rd-stroke false-positive reported by
the User on a real device (strokes 1-2 ideal, stroke 3 sloppy, still PASS).

Draws strokes 1 & 2 of "あ" ideally (from the real page's own
TracingEngine.sampleReferencePath, via real Playwright mouse-driven pointer
events) and stroke 3 in several deliberately sloppy variants, reading the
full per-stroke debug JSON (?tracingDebug=1) after each attempt.

Usage: python tools/tracing-poc/test-a-stroke3-repro.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "stroke3-repro-artifacts"
OUT_DIR.mkdir(exist_ok=True)

PILOT_MARGIN = 320 * 0.06
PILOT_SCALE = (320 - PILOT_MARGIN * 2) / 109


def canvas_px(p):
    return {"x": p["x"] * 109 * PILOT_SCALE + PILOT_MARGIN, "y": p["y"] * 109 * PILOT_SCALE + PILOT_MARGIN}


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


def straight_line(p0, p1, n=20):
    return [{"x": p0["x"] + (p1["x"] - p0["x"]) * i / (n - 1), "y": p0["y"] + (p1["y"] - p0["y"]) * i / (n - 1)} for i in range(n)]


def partial(points, frac):
    cut = max(2, round(len(points) * frac))
    return points[:cut]


def loose_blob(cx, cy, r, n=24, seed=1):
    import math
    a = seed
    pts = []
    for i in range(n):
        a = (a * 1103515245 + 12345) & 0x7FFFFFFF
        jitter = ((a % 1000) / 1000 - 0.5) * r * 0.6
        ang = 2 * math.pi * i / (n - 1)
        pts.append({"x": cx + (r + jitter) * math.cos(ang), "y": cy + (r + jitter) * math.sin(ang)})
    return pts


def zigzag(p0, p1, n=16, amp=0.05, seed=2):
    a = seed
    pts = []
    for i in range(n):
        t = i / (n - 1)
        a = (a * 1103515245 + 12345) & 0x7FFFFFFF
        side = amp if (i % 2 == 0) else -amp
        bx = p0["x"] + (p1["x"] - p0["x"]) * t
        by = p0["y"] + (p1["y"] - p0["y"]) * t
        # perpendicular-ish offset
        pts.append({"x": bx + side, "y": by})
    return pts


def main():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_attempt():
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(APP_PATH.as_uri() + "?tracingDebug=1")
            page.wait_for_timeout(250)
            page.click('button[data-tab="trace"]')
            page.wait_for_timeout(100)
            page.locator("#traceCanvas").scroll_into_view_if_needed()
            page.wait_for_timeout(50)
            page.click('.trace-kana-pick:text-is("あ")')
            page.wait_for_timeout(60)
            return page

        def run(name, stroke3_fn):
            page = new_attempt()
            box = page.locator("#traceCanvas").bounding_box()
            s1 = get_ref_points(page, "あ", 0, 40)
            s2 = get_ref_points(page, "あ", 1, 40)
            draw_stroke(page, box, s1)
            draw_stroke(page, box, s2)
            s3 = stroke3_fn(page)
            draw_stroke(page, box, s3)
            page.wait_for_timeout(100)
            debug_text = page.locator("#tracingDebugPanel").inner_text()
            try:
                debug = json.loads(debug_text)
            except Exception:
                debug = {"raw": debug_text}
            badge = "PASS" if page.locator("#goodJob").evaluate("el => el.classList.contains('show')") else (
                "RETRY" if page.locator("#retryJob").evaluate("el => el.classList.contains('show')") else "NONE"
            )
            shot = OUT_DIR / f"a_{name}.png"
            page.locator("#traceStage").screenshot(path=str(shot))
            page.close()
            return {"badge": badge, "debug": debug, "screenshot": shot.name}

        ref3 = None

        def get_ref3(page):
            nonlocal ref3
            if ref3 is None:
                ref3 = get_ref_points(page, "あ", 2, 40)
            return ref3

        results["A1_ideal"] = run("A1_ideal", lambda pg: get_ref_points(pg, "あ", 2, 40))
        results["A2_mild_wobble"] = run("A2_mild_wobble", lambda pg: [
            {"x": p["x"] + (((i * 97 + 13) % 21) / 20 - 0.5) * 0.02, "y": p["y"] + (((i * 53 + 7) % 21) / 20 - 0.5) * 0.02}
            for i, p in enumerate(get_ref_points(pg, "あ", 2, 40))
        ])
        results["A3_slight_offset"] = run("A3_slight_offset", lambda pg: [
            {"x": p["x"] + 0.03, "y": p["y"] + 0.02} for p in get_ref_points(pg, "あ", 2, 40)
        ])
        results["A4_partial70"] = run("A4_partial70", lambda pg: partial(get_ref_points(pg, "あ", 2, 60), 0.70))
        results["A5_partial50"] = run("A5_partial50", lambda pg: partial(get_ref_points(pg, "あ", 2, 60), 0.50))
        results["A6_tiny"] = run("A6_tiny", lambda pg: partial(get_ref_points(pg, "あ", 2, 60), 0.10))

        def a7(pg):
            pts = get_ref_points(pg, "あ", 2, 40)
            return straight_line(pts[0], pts[-1], 20)
        results["A7_straight_line"] = run("A7_straight_line", a7)

        def a8(pg):
            pts = get_ref_points(pg, "あ", 2, 40)
            return zigzag(pts[0], pts[-1], 16, 0.05, 2)
        results["A8_zigzag"] = run("A8_zigzag", a8)

        def a9(pg):
            pts = get_ref_points(pg, "あ", 2, 40)
            bbox_cx = sum(p["x"] for p in pts) / len(pts)
            bbox_cy = sum(p["y"] for p in pts) / len(pts)
            return loose_blob(bbox_cx, bbox_cy, 0.18, 24, 3)
        results["A9_loose_blob"] = run("A9_loose_blob", a9)

        def a10(pg):
            pts = get_ref_points(pg, "あ", 2, 40)
            bbox_cx = sum(p["x"] for p in pts) / len(pts)
            bbox_cy = sum(p["y"] for p in pts) / len(pts)
            length = 0.5
            return straight_line({"x": bbox_cx - length / 2, "y": bbox_cy + 0.25}, {"x": bbox_cx + length / 2, "y": bbox_cy + 0.25}, 20)
        results["A10_long_offpath"] = run("A10_long_offpath", a10)

        results["A11_reversed_direction"] = run("A11_reversed_direction", lambda pg: list(reversed(get_ref_points(pg, "あ", 2, 40))))

        # --- User-report-style "sloppy stroke 3" variants (>=3 distinct kinds) ---
        def sloppy1(pg):
            # Fast, under-curved sweep: like A7 but with a slight bow (not a hard straight line)
            pts = get_ref_points(pg, "あ", 2, 30)
            p0, p1 = pts[0], pts[-1]
            out = []
            for i, t in enumerate([i / 29 for i in range(30)]):
                bx = p0["x"] + (p1["x"] - p0["x"]) * t
                by = p0["y"] + (p1["y"] - p0["y"]) * t
                bow = 0.05 * (4 * t * (1 - t))
                out.append({"x": bx, "y": by + bow})
            return out
        results["sloppy_shallow_bow"] = run("sloppy_shallow_bow", sloppy1)

        def sloppy2(pg):
            # Right half only, roughly (child gives up partway but with a flourish)
            pts = get_ref_points(pg, "あ", 2, 60)
            return partial(pts, 0.55)
        results["sloppy_gave_up_halfway"] = run("sloppy_gave_up_halfway", sloppy2)

        def sloppy3(pg):
            # Small tight loose scribble near the stroke's start region only
            pts = get_ref_points(pg, "あ", 2, 40)
            return loose_blob(pts[0]["x"], pts[0]["y"], 0.10, 16, 9)
        results["sloppy_small_scribble_near_start"] = run("sloppy_small_scribble_near_start", sloppy3)

        browser.close()

    (OUT_DIR / "stroke3-repro-report.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n--- summary ---")
    for name, r in results.items():
        d = r["debug"]
        s3 = None
        if isinstance(d, dict) and "strokes" in d and len(d["strokes"]) >= 3:
            s3 = d["strokes"][2]
        print(f"{name}: badge={r['badge']} score={d.get('score')} stroke3={s3}")


if __name__ == "__main__":
    main()
