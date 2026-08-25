#!/usr/bin/env python
"""Phase T3-C' Section 15/22 — Real-browser reproduction of the U
stroke-assignment swap using a known-failing seed's EXACT noisy point
sequence (computed in Node via golden-traces.js, then physically drawn
in the browser via genuine Playwright mouse events). This proves the
Known Limitation is reproducible through real input, not just a Node
unit-test artifact.
"""
import json
import pathlib
import subprocess

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "katakana-app.html"

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


def get_noisy_trace(seed):
    script = f"""
const Traces = require('./tools/tracing-poc/golden-traces.js');
const KATAKANA = require('./tools/tracing-poc/fixtures/reference-data-katakana.generated.js');
const trace = Traces.mildWobble(KATAKANA['ウ'], 0.018, {seed});
console.log(JSON.stringify(trace));
"""
    result = subprocess.run(["node", "-e", script], cwd=str(HERE.parent.parent), capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def select(page, ch):
    page.click(f'.trace-kana-pick:text-is("{ch}")')
    page.wait_for_timeout(60)


def badge(page):
    if page.locator("#goodJob").evaluate("el => el.classList.contains('show')"):
        return "PASS"
    if page.locator("#retryJob").evaluate("el => el.classList.contains('show')"):
        return "RETRY"
    return "NONE"


def main():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for seed in [4, 6, 11, 16]:
            trace = get_noisy_trace(seed)
            pg = browser.new_page(viewport={"width": 1280, "height": 900})
            pg.goto(APP_PATH.as_uri() + "?tracingDebug=1")
            pg.wait_for_timeout(300)
            pg.click('button[data-tab="trace"]')
            pg.wait_for_timeout(120)
            pg.locator("#traceCanvas").scroll_into_view_if_needed()
            pg.wait_for_timeout(50)
            select(pg, "ウ")
            box = pg.locator("#traceCanvas").bounding_box()
            for stroke_pts in trace:
                draw_stroke(pg, box, stroke_pts)
            pg.wait_for_timeout(100)
            try:
                dbg = json.loads(pg.locator("#tracingDebugPanel").inner_text())
            except Exception:
                dbg = None
            results[f"seed_{seed}"] = {"badge": badge(pg), "reason": dbg.get("reason") if dbg else None,
                                         "assignment": [s.get("matched") for s in dbg["strokes"]] if dbg and "strokes" in dbg else None}
            pg.close()
        browser.close()
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
