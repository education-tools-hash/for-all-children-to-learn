#!/usr/bin/env python
"""Phase T2-C'' — Real-browser confirmation of the Absolute Geometry Guard
and Structural Discrimination Guard fixes.

Confirms live in hiragana-learn.html:
  A. Target あ, drawn at 25% scale -> now RETRY (was PASS in T2-C')
  B. Target そ, draw る's correct shape -> now RETRY (was PASS in T2-C')
  D. Target ね, draw れ's correct shape -> now RETRY (was PASS in T2-C')
  E. Target け, draw は's correct shape -> now RETRY (was PASS in T2-C')
  C. Target ぬ, draw め's correct shape -> STILL PASS (known residual,
     reported not silently fixed with a character-specific hack)
Plus: normal (ideal) traces for あ/そ/る/ろ/ぬ/め/ね/れ/わ/け/は all still
PASS, and い/あ wobble still PASS (Motor Accessibility / Pilot Regression
Lock, real browser).

Usage: python tools/tracing-poc/test-t2c2-realbrowser.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "t2c2-realbrowser-artifacts"
OUT_DIR.mkdir(exist_ok=True)

GUIDE_MARGIN = 320 * 0.06
GUIDE_SCALE = (320 - GUIDE_MARGIN * 2) / 109


def canvas_px(p):
    return {"x": p["x"] * 109 * GUIDE_SCALE + GUIDE_MARGIN, "y": p["y"] * 109 * GUIDE_SCALE + GUIDE_MARGIN}


def norm_to_screen(canvas_box, points_norm):
    out = []
    for p in points_norm:
        c = canvas_px(p)
        sx = canvas_box["x"] + c["x"] * (canvas_box["width"] / 320)
        sy = canvas_box["y"] + c["y"] * (canvas_box["height"] / 320)
        out.append((sx, sy))
    return out


def draw_stroke(page, canvas_box, points_norm):
    pts = norm_to_screen(canvas_box, points_norm)
    page.mouse.move(*pts[0])
    page.mouse.down()
    for (x, y) in pts[1:]:
        page.mouse.move(x, y, steps=2)
    page.mouse.up()


def get_ref_points(page, ch, idx, n=40):
    return page.evaluate("([ch,i,n]) => TracingEngine.sampleReferencePath(strokeData[ch][i].d, n).points", [ch, idx, n])


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
    console_errors, page_errors = [], []
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page():
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            page.goto(APP_PATH.as_uri() + "?tracingDebug=1")
            page.wait_for_timeout(250)
            page.click('button[data-tab="trace"]')
            page.wait_for_timeout(100)
            page.locator("#traceCanvas").scroll_into_view_if_needed()
            page.wait_for_timeout(50)
            return page

        def draw_ideal(page, ch):
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                draw_stroke(page, box, get_ref_points(page, ch, i, 40))

        def cross_char_case(name, target, source):
            page = new_page()
            select_char(page, target)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", source)
            for i in range(n):
                draw_stroke(page, box, get_ref_points(page, source, i, 40))
            page.wait_for_timeout(100)
            shot = OUT_DIR / f"{name}.png"
            page.locator("#traceStage").screenshot(path=str(shot))
            b = badge(page)
            page.close()
            return {"target": target, "source": source, "badge": b, "screenshot": shot.name}

        results["A_25percent_scale"] = None
        page = new_page()
        select_char(page, "あ")
        box = page.locator("#traceCanvas").bounding_box()
        for i in range(3):
            pts = get_ref_points(page, "あ", i, 40)
            shrunk = [{"x": 0.5 + (pt["x"] - 0.5) * 0.25, "y": 0.5 + (pt["y"] - 0.5) * 0.25} for pt in pts]
            draw_stroke(page, box, shrunk)
        page.wait_for_timeout(100)
        shot = OUT_DIR / "A_25percent_scale.png"
        page.locator("#traceStage").screenshot(path=str(shot))
        results["A_25percent_scale"] = {"badge": badge(page), "screenshot": shot.name}
        page.close()

        results["B_target_so_draw_ru"] = cross_char_case("B_target_so_draw_ru", "そ", "る")
        results["D_target_ne_draw_re"] = cross_char_case("D_target_ne_draw_re", "ね", "れ")
        results["E_target_ke_draw_ha"] = cross_char_case("E_target_ke_draw_ha", "け", "は")
        results["C_target_nu_draw_me_KNOWN_RESIDUAL"] = cross_char_case("C_target_nu_draw_me", "ぬ", "め")

        # Sanity: normal ideal traces still PASS
        normal_chars = ["あ", "そ", "る", "ろ", "ぬ", "め", "ね", "れ", "わ", "け", "は"]
        normal_results = {}
        for ch in normal_chars:
            page = new_page()
            select_char(page, ch)
            draw_ideal(page, ch)
            page.wait_for_timeout(80)
            normal_results[ch] = badge(page)
            page.close()
        results["normal_ideal_all_pass"] = normal_results

        # Motor Accessibility / Pilot Regression Lock: い/あ wobble
        def wobble_check(ch):
            page = new_page()
            select_char(page, ch)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                pts = get_ref_points(page, ch, i, 40)
                a = 10 + i
                wob = []
                for p in pts:
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r1 = (a % 1000) / 1000 - 0.5
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r2 = (a % 1000) / 1000 - 0.5
                    wob.append({"x": p["x"] + r1 * 0.024, "y": p["y"] + r2 * 0.024})
                draw_stroke(page, box, wob)
            page.wait_for_timeout(80)
            b = badge(page)
            page.close()
            return b

        results["wobble_i"] = wobble_check("い")
        results["wobble_a"] = wobble_check("あ")

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "page_error_count": len(page_errors),
        "results": results,
    }
    (OUT_DIR / "t2c2-realbrowser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
