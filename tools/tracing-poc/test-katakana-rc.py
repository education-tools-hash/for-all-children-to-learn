#!/usr/bin/env python
"""Phase T3-B — Real-browser RC validation for katakana-app.html.

Drives the ACTUAL katakana-app.html (feature branch only) via Playwright,
sending genuine Pointer Events at #traceCanvas, exactly as the ported
hiragana T2 test scripts do.

Covers Section 15's minimum set:
  A. normal traces (multiple characters)
  B. risk pairs (wo<-te, te<-wo, su<-nu, nu<-su, yu<-ko, ko<-yu)
  C. 25% scale
  D. single position shift
  E. truncated stroke
  F. wobble (especially U/shi/mi/yo)
Plus Section 16: non-tracing smoke test (character selection, guide
display, clear/reset, navigation, logging).

Usage: python tools/tracing-poc/test-katakana-rc.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "katakana-app.html"
OUT_DIR = HERE / "t3b-katakana-rc-artifacts"
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


def get_ref(page, ch, i, n=40):
    return page.evaluate("([ch,i,n]) => TracingEngine.sampleReferencePath(strokeData[ch][i].d, n).points", [ch, i, n])


def select(page, ch):
    page.click(f'.trace-kana-pick:text-is("{ch}")')
    page.wait_for_timeout(60)


def badge(page):
    if page.locator("#goodJob").evaluate("el => el.classList.contains('show')"):
        return "PASS"
    if page.locator("#retryJob").evaluate("el => el.classList.contains('show')"):
        return "RETRY"
    return "NONE"


def debug_json(page):
    page.wait_for_timeout(40)
    try:
        return json.loads(page.locator("#tracingDebugPanel").inner_text())
    except Exception:
        return None


def main():
    console_errors, page_errors = [], []
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(debug=True):
            pg = browser.new_page(viewport={"width": 1280, "height": 900})
            pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: page_errors.append(str(e)))
            url = APP_PATH.as_uri() + ("?tracingDebug=1" if debug else "")
            pg.goto(url)
            pg.wait_for_timeout(300)
            pg.click('button[data-tab="trace"]')
            pg.wait_for_timeout(120)
            pg.locator("#traceCanvas").scroll_into_view_if_needed()
            pg.wait_for_timeout(50)
            return pg

        def draw_ideal(pg, ch):
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                draw_stroke(pg, box, get_ref(pg, ch, i, 40))

        # --- A. normal traces, multiple characters ---
        normal_chars = ["ア", "イ", "ウ", "シ", "ミ", "ヨ", "ヲ", "テ", "ス", "ヌ", "ユ", "コ", "ソ", "ハ", "メ", "ヒ", "セ"]
        normal_results = {}
        for ch in normal_chars:
            pg = new_page()
            select(pg, ch)
            draw_ideal(pg, ch)
            pg.wait_for_timeout(100)
            normal_results[ch] = badge(pg)
            pg.close()
        results["A_normal_ideal"] = normal_results

        # --- B. risk pairs ---
        def cross(target, source):
            pg = new_page()
            select(pg, target)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", source)
            for i in range(n):
                draw_stroke(pg, box, get_ref(pg, source, i, 40))
            pg.wait_for_timeout(120)
            b = badge(pg)
            dbg = debug_json(pg)
            pg.close()
            return {"badge": b, "reason": dbg.get("reason") if dbg else None}

        risk_pairs = [("ヲ", "テ"), ("テ", "ヲ"), ("ス", "ヌ"), ("ヌ", "ス"), ("ユ", "コ"), ("コ", "ユ")]
        results["B_risk_pairs"] = {f"{t}<-{s}": cross(t, s) for (t, s) in risk_pairs}

        # --- C. 25% scale ---
        pg = new_page()
        select(pg, "ウ")
        box = pg.locator("#traceCanvas").bounding_box()
        n = pg.evaluate("(ch) => strokeData[ch].length", "ウ")
        for i in range(n):
            pts = get_ref(pg, "ウ", i, 40)
            shr = [{"x": 0.5 + (pt["x"] - 0.5) * 0.25, "y": 0.5 + (pt["y"] - 0.5) * 0.25} for pt in pts]
            draw_stroke(pg, box, shr)
        pg.wait_for_timeout(100)
        results["C_scale25_U"] = badge(pg)
        pg.close()

        # --- D. single position shift (W2-style) ---
        def w2_shift(pts, bbox, idx):
            dir_x = 1 if idx % 2 == 0 else -1
            dir_y = -1 if idx % 3 == 0 else 1
            sx = dir_x * bbox["width"] * 0.55
            sy = dir_y * bbox["height"] * 0.55
            return [{"x": max(0.03, min(0.97, pt["x"] + sx)), "y": max(0.03, min(0.97, pt["y"] + sy))} for pt in pts]

        pg = new_page()
        select(pg, "ヒ")
        box = pg.locator("#traceCanvas").bounding_box()
        bbox = pg.evaluate(
            "(ch) => { const all = strokeData[ch].flatMap(s => TracingEngine.sampleReferencePath(s.d, 20).points);"
            " return TracingEngine.computeBBox(all); }", "ヒ")
        n = pg.evaluate("(ch) => strokeData[ch].length", "ヒ")
        for i in range(n):
            pts = get_ref(pg, "ヒ", i, 40)
            if i == 0:
                pts = w2_shift(pts, bbox, i)
            draw_stroke(pg, box, pts)
        pg.wait_for_timeout(100)
        dbg = debug_json(pg)
        results["D_position_shift_hi"] = {"badge": badge(pg), "reason": dbg.get("reason") if dbg else None}
        pg.close()

        # --- E. truncated stroke ---
        pg = new_page()
        select(pg, "ミ")
        box = pg.locator("#traceCanvas").bounding_box()
        n = pg.evaluate("(ch) => strokeData[ch].length", "ミ")
        for i in range(n):
            pts = get_ref(pg, "ミ", i, 40)
            if i == 0:
                pts = pts[: max(2, round(len(pts) * 0.45))]
            draw_stroke(pg, box, pts)
        pg.wait_for_timeout(100)
        dbg = debug_json(pg)
        results["E_truncated_mi"] = {"badge": badge(pg), "reason": dbg.get("reason") if dbg else None}
        pg.close()

        # --- F. wobble, especially U/shi/mi/yo ---
        def wobble(ch):
            pg = new_page()
            select(pg, ch)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                pts = get_ref(pg, ch, i, 40)
                a = 10 + i
                wob = []
                for pt in pts:
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r1 = (a % 1000) / 1000 - 0.5
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r2 = (a % 1000) / 1000 - 0.5
                    wob.append({"x": pt["x"] + r1 * 0.024, "y": pt["y"] + r2 * 0.024})
                draw_stroke(pg, box, wob)
            pg.wait_for_timeout(100)
            b = badge(pg)
            pg.close()
            return b

        results["F_wobble"] = {ch: wobble(ch) for ch in ["ウ", "シ", "ミ", "ヨ"]}

        # --- Section 16: non-tracing smoke test ---
        smoke = {}
        pg = new_page(debug=False)
        # character selection via nav arrows
        select(pg, "カ")
        smoke["select_ka"] = pg.evaluate("() => currentTraceKana")
        pg.click('button[onclick="traceMove(1)"]')
        pg.wait_for_timeout(80)
        smoke["nav_next_from_ka"] = pg.evaluate("() => currentTraceKana")
        # guide display: canvas should have non-trivial pixel content
        smoke["guide_has_content"] = pg.evaluate(
            "() => { const c = document.getElementById('traceGuide'); const ctx = c.getContext('2d');"
            " const d = ctx.getImageData(0,0,c.width,c.height).data; for (let i=3;i<d.length;i+=4) if (d[i]>0) return true; return false; }")
        # draw something then check clear works via setTraceKana (re-select same char acts as reset in this app)
        box = pg.locator("#traceCanvas").bounding_box()
        draw_stroke(pg, box, [{"x": 0.3, "y": 0.3}, {"x": 0.4, "y": 0.4}])
        pg.wait_for_timeout(60)
        smoke["ink_present_before_clear"] = pg.evaluate(
            "() => { const c = document.getElementById('traceCanvas'); const ctx = c.getContext('2d');"
            " const d = ctx.getImageData(0,0,c.width,c.height).data; for (let i=3;i<d.length;i+=4) if (d[i]>0) return true; return false; }")
        select(pg, "カ")  # re-select = reset in this app's existing UX
        pg.wait_for_timeout(60)
        smoke["ink_cleared_after_reselect"] = not pg.evaluate(
            "() => { const c = document.getElementById('traceCanvas'); const ctx = c.getContext('2d');"
            " const d = ctx.getImageData(0,0,c.width,c.height).data; for (let i=3;i<d.length;i+=4) if (d[i]>0) return true; return false; }")
        # logging: complete an ideal trace and check learningLog grows,
        # and that it recorded a 'trace' entry only on PASS.
        log_before = pg.evaluate("() => learningLog.length")
        draw_ideal(pg, "カ")
        pg.wait_for_timeout(100)
        smoke["pass_after_ideal"] = badge(pg)
        smoke["log_grew_on_pass"] = pg.evaluate("(before) => learningLog.length > before", log_before)
        smoke["last_log_entry_type"] = pg.evaluate("() => learningLog[learningLog.length-1].type")
        pg.close()
        results["smoke_test"] = smoke

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "page_error_count": len(page_errors),
        "console_errors": console_errors,
        "page_errors": page_errors,
        "results": results,
    }
    (OUT_DIR / "t3b-katakana-rc-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
