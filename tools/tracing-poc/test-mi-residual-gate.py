#!/usr/bin/env python
"""Phase T3-D Section 5 — Special Residual Gate: mi W3_truncated.

Reproduces the EXACT fixture point sequence from
golden-tests-katakana-independent46.js's single-bad-stroke suite
(mi, stroke#1, W3_truncated at 45%) via genuine Playwright mouse-driven
Pointer Events against katakana-app.html, and captures a screenshot for
visual assessment.
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "katakana-app.html"
OUT_DIR = HERE / "t3d-residual-gate-artifacts"
OUT_DIR.mkdir(exist_ok=True)

GUIDE_MARGIN = 320 * 0.06
GUIDE_SCALE = (320 - GUIDE_MARGIN * 2) / 109


def canvas_px(p):
    return {"x": p["x"] * 109 * GUIDE_SCALE + GUIDE_MARGIN, "y": p["y"] * 109 * GUIDE_SCALE + GUIDE_MARGIN}


def norm_to_screen(box, pts):
    out = []
    for p in pts:
        c = canvas_px(p)
        sx = box["x"] + c["x"] * (box["width"] / 320)
        sy = box["y"] + c["y"] * (box["height"] / 320)
        out.append((sx, sy))
    return out


def draw_stroke(page, box, pts):
    s = norm_to_screen(box, pts)
    page.mouse.move(*s[0])
    page.mouse.down()
    for (x, y) in s[1:]:
        page.mouse.move(x, y, steps=2)
    page.mouse.up()


def badge(page):
    if page.locator("#goodJob").evaluate("el => el.classList.contains('show')"):
        return "PASS"
    if page.locator("#retryJob").evaluate("el => el.classList.contains('show')"):
        return "RETRY"
    return "NONE"


def main():
    trace = json.loads((HERE / "_mi_w3_trace.json").read_text(encoding="utf-8"))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        pg = browser.new_page(viewport={"width": 1280, "height": 900})
        console_errors, page_errors = [], []
        pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: page_errors.append(str(e)))
        pg.goto(APP_PATH.as_uri() + "?tracingDebug=1")
        pg.wait_for_timeout(300)
        pg.click('button[data-tab="trace"]')
        pg.wait_for_timeout(120)
        pg.locator("#traceCanvas").scroll_into_view_if_needed()
        pg.wait_for_timeout(50)
        pg.click('.trace-kana-pick:text-is("ミ")')
        pg.wait_for_timeout(60)
        box = pg.locator("#traceCanvas").bounding_box()
        for stroke_pts in trace:
            draw_stroke(pg, box, stroke_pts)
        pg.wait_for_timeout(100)
        b = badge(pg)
        dbg = json.loads(pg.locator("#tracingDebugPanel").inner_text())
        shot = OUT_DIR / "mi_w3_truncated_residual.png"
        pg.locator("#traceStage, .trace-canvas-wrap").first.screenshot(path=str(shot))
        report = {
            "badge": b,
            "score": dbg["score"],
            "reason": dbg["reason"],
            "assignment": dbg["hardGate"].get("strokePosition"),
            "strokes": dbg["strokes"],
            "console_error_count": len(console_errors),
            "page_error_count": len(page_errors),
            "screenshot": shot.name,
        }
        (OUT_DIR / "mi-residual-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
