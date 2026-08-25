#!/usr/bin/env python
"""Phase T2-C' — Real-browser confirmation of Independent Validation findings.

Confirms, in the ACTUAL hiragana-learn.html (not just engine.js in Node),
that the two headline findings from golden-tests-independent46.js are real
in the live app:
  1. Cross-character false positive: drawing る's correct shape while the
     selected character is そ still succeeds.
  2. Wrong-scale false positive: drawing あ at ~25% of its expected size
     (but in the right place) still succeeds.
Also re-confirms the required representative set (い/あ/き/た/も/う/の):
ideal -> PASS, one clearly-wrong independent stroke (W1 perpendicular,
which had 0 false positives in the Node suite) -> RETRY.

Usage: python tools/tracing-poc/test-independent-realbrowser.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "independent-validation-artifacts"
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

        # ---- Finding 1: cross-character false positive (target そ, draw る) ----
        page = new_page()
        select_char(page, "そ")  # target character
        box = page.locator("#traceCanvas").bounding_box()
        ru_points = get_ref_points(page, "る", 0, 40)  # る's OWN reference, drawn while そ is selected
        draw_stroke(page, box, ru_points)
        page.wait_for_timeout(100)
        shot = OUT_DIR / "cross_character_ru_as_so.png"
        page.locator("#traceStage").screenshot(path=str(shot))
        results["cross_character_finding"] = {"target": "そ", "drew": "る's reference shape", "badge": badge(page), "screenshot": shot.name}
        page.close()

        # sanity: そ ideal still passes normally
        page = new_page()
        select_char(page, "そ")
        box = page.locator("#traceCanvas").bounding_box()
        draw_stroke(page, box, get_ref_points(page, "そ", 0, 40))
        page.wait_for_timeout(100)
        results["cross_character_finding_sanity_ideal_so"] = {"badge": badge(page)}
        page.close()

        # ---- Finding 2: wrong-scale false positive (あ at 25% size) ----
        page = new_page()
        select_char(page, "あ")
        box = page.locator("#traceCanvas").bounding_box()
        for i in range(3):
            pts = get_ref_points(page, "あ", i, 40)
            cx = sum(p["x"] for p in pts) / len(pts)
            cy = sum(p["y"] for p in pts) / len(pts)
            # overall character center (approx via this stroke's own bbox is fine for
            # a qualitative confirmation; shrink about a shared point for all strokes)
        # use character-wide center (0.5,0.5 in KanjiVG-normalized space is close enough
        # since あ's overall bbox is roughly centered)
        shrunk_strokes = []
        for i in range(3):
            pts = get_ref_points(page, "あ", i, 40)
            shrunk_strokes.append([{"x": 0.5 + (pt["x"] - 0.5) * 0.25, "y": 0.5 + (pt["y"] - 0.5) * 0.25} for pt in pts])
        for s in shrunk_strokes:
            draw_stroke(page, box, s)
        page.wait_for_timeout(100)
        shot = OUT_DIR / "wrong_scale_a_25percent.png"
        page.locator("#traceStage").screenshot(path=str(shot))
        results["wrong_scale_finding"] = {"char": "あ", "scale": 0.25, "badge": badge(page), "screenshot": shot.name}
        page.close()

        # ---- Representative set: い/あ/き/た/も/う/の — ideal PASS + W1 perpendicular RETRY ----
        rep_chars = ["い", "あ", "き", "た", "も", "う", "の"]
        rep_results = {}
        for ch in rep_chars:
            page = new_page()
            select_char(page, ch)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                draw_stroke(page, box, get_ref_points(page, ch, i, 40))
            page.wait_for_timeout(80)
            ideal_badge = badge(page)
            page.close()

            page = new_page()
            select_char(page, ch)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            bad_idx = 0
            for i in range(n):
                pts = get_ref_points(page, ch, i, 40)
                if i == bad_idx:
                    # W1 perpendicular, computed client-side identically to independent-wrong-trace.js
                    perp = page.evaluate(
                        """
                        (pts) => {
                          const p0 = pts[0], p1 = pts[pts.length-1];
                          const dx = p1.x-p0.x, dy = p1.y-p0.y;
                          const len = Math.hypot(dx,dy) || 1e-6;
                          const ux = -dy/len, uy = dx/len;
                          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
                          pts.forEach(p=>{ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
                          const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
                          const half = len/2;
                          const start = {x: cx-ux*half, y: cy-uy*half};
                          const end = {x: cx+ux*half, y: cy+uy*half};
                          const n=20, out=[];
                          for (let i=0;i<n;i++) out.push({x: start.x+(end.x-start.x)*i/(n-1), y: start.y+(end.y-start.y)*i/(n-1)});
                          return out;
                        }
                        """,
                        pts,
                    )
                    draw_stroke(page, box, perp)
                else:
                    draw_stroke(page, box, pts)
            page.wait_for_timeout(80)
            bad_badge = badge(page)
            shot = OUT_DIR / f"rep_{ch}_bad.png"
            page.locator("#traceStage").screenshot(path=str(shot))
            page.close()

            rep_results[ch] = {"ideal_badge": ideal_badge, "bad_stroke_badge": bad_badge, "screenshot": shot.name}
        results["representative"] = rep_results

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "page_error_count": len(page_errors),
        "results": results,
    }
    (OUT_DIR / "independent-realbrowser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
