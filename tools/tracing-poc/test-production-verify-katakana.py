#!/usr/bin/env python
"""Phase T3-D2 Section 16 — Live Production verification for katakana-app.html.

Drives https://donomana.jp/katakana-app.html directly via Playwright to
confirm: normal traces pass, the mi/W3 exact former Release Blocker
fixture RETRYs, risk pairs / 25% scale / position shift RETRY, Mirror
RETRYs, and logging works correctly. Read-only interaction with the
live site.
"""
import json
import pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
GUIDE_MARGIN = 320 * 0.06
GUIDE_SCALE = (320 - GUIDE_MARGIN * 2) / 109


def canvas_px(p):
    return {"x": p["x"] * 109 * GUIDE_SCALE + GUIDE_MARGIN, "y": p["y"] * 109 * GUIDE_SCALE + GUIDE_MARGIN}


def norm_to_screen(box, pts):
    out = []
    for p in pts:
        c = canvas_px(p)
        out.append((box["x"] + c["x"] * (box["width"] / 320), box["y"] + c["y"] * (box["height"] / 320)))
    return out


def draw_stroke(page, box, pts):
    s = norm_to_screen(box, pts)
    page.mouse.move(*s[0])
    page.mouse.down()
    for (x, y) in s[1:]:
        page.mouse.move(x, y, steps=2)
    page.mouse.up()


def select(page, ch):
    page.click(f'.trace-kana-pick:text-is("{ch}")')
    page.wait_for_timeout(60)


def badge(page):
    if page.locator("#goodJob").evaluate("el => el.classList.contains('show')"):
        return "PASS"
    if page.locator("#retryJob").evaluate("el => el.classList.contains('show')"):
        return "RETRY"
    return "NONE"


def get_ref(page, ch, i, n=40):
    return page.evaluate("([ch,i,n]) => TracingEngine.sampleReferencePath(strokeData[ch][i].d, n).points", [ch, i, n])


def main():
    console_errors, page_errors = [], []
    results = {}
    mi_trace = json.loads((HERE / "_mi_w3_trace.json").read_text(encoding="utf-8"))

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page():
            pg = browser.new_page(viewport={"width": 1280, "height": 900})
            pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: page_errors.append(str(e)))
            pg.goto("https://donomana.jp/katakana-app.html?tracingDebug=1")
            pg.wait_for_timeout(400)
            pg.click('button[data-tab="trace"]')
            pg.wait_for_timeout(150)
            pg.locator("#traceCanvas").scroll_into_view_if_needed()
            pg.wait_for_timeout(50)
            return pg

        def draw_ideal(pg, ch):
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                draw_stroke(pg, box, get_ref(pg, ch, i, 40))

        # A. normal traces
        for ch in ["ア", "ウ", "ミ", "テ"]:
            pg = new_page()
            select(pg, ch)
            draw_ideal(pg, ch)
            pg.wait_for_timeout(100)
            results["A_normal_" + ch] = badge(pg)
            pg.close()

        # B. U known-failure seed11 equivalent (moderate wobble)
        pg = new_page()
        select(pg, "ウ")
        box = pg.locator("#traceCanvas").bounding_box()
        n = pg.evaluate("(ch) => strokeData[ch].length", "ウ")
        for i in range(n):
            pts = get_ref(pg, "ウ", i, 40)
            a = 11 + i
            wob = []
            for pt in pts:
                a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                r1 = (a % 1000) / 1000 - 0.5
                a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                r2 = (a % 1000) / 1000 - 0.5
                wob.append({"x": pt["x"] + r1 * 0.036, "y": pt["y"] + r2 * 0.036})
            draw_stroke(pg, box, wob)
        pg.wait_for_timeout(100)
        results["B_U_moderate_wobble"] = badge(pg)
        pg.close()

        # C. mi/W3 exact former blocker fixture
        pg = new_page()
        select(pg, "ミ")
        box = pg.locator("#traceCanvas").bounding_box()
        for stroke_pts in mi_trace:
            draw_stroke(pg, box, stroke_pts)
        pg.wait_for_timeout(100)
        dbg = json.loads(pg.locator("#tracingDebugPanel").inner_text())
        results["C_mi_W3_blocker"] = {"badge": badge(pg), "reason": dbg.get("reason")}
        pg.close()

        # D. risk pairs
        def cross(target, source):
            pg = new_page()
            select(pg, target)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", source)
            for i in range(n):
                draw_stroke(pg, box, get_ref(pg, source, i, 40))
            pg.wait_for_timeout(100)
            b = badge(pg)
            pg.close()
            return b

        for (t, s) in [("ヲ", "テ"), ("テ", "ヲ"), ("ス", "ヌ"), ("ヌ", "ス"), ("ユ", "コ"), ("コ", "ユ")]:
            results[f"D_risk_{t}_lt_{s}"] = cross(t, s)

        # E. 25% scale
        pg = new_page()
        select(pg, "ウ")
        box = pg.locator("#traceCanvas").bounding_box()
        n = pg.evaluate("(ch) => strokeData[ch].length", "ウ")
        for i in range(n):
            pts = get_ref(pg, "ウ", i, 40)
            shr = [{"x": 0.5 + (pt["x"] - 0.5) * 0.25, "y": 0.5 + (pt["y"] - 0.5) * 0.25} for pt in pts]
            draw_stroke(pg, box, shr)
        pg.wait_for_timeout(100)
        results["E_scale25"] = badge(pg)
        pg.close()

        # F. position shift
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
                dx, dy = bbox["width"] * 0.55, -bbox["height"] * 0.55
                pts = [{"x": max(0.03, min(0.97, pt["x"] + dx)), "y": max(0.03, min(0.97, pt["y"] + dy))} for pt in pts]
            draw_stroke(pg, box, pts)
        pg.wait_for_timeout(100)
        results["F_position_shift"] = badge(pg)
        pg.close()

        # G. Mirror
        def mirror_h(pts):
            xs = [p["x"] for p in pts]
            cx = (min(xs) + max(xs)) / 2
            return [{"x": 2 * cx - p["x"], "y": p["y"]} for p in pts]

        for ch in ["エ", "ニ"]:
            pg = new_page()
            select(pg, ch)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                draw_stroke(pg, box, mirror_h(get_ref(pg, ch, i, 40)))
            pg.wait_for_timeout(100)
            results[f"G_mirror_{ch}"] = badge(pg)
            pg.close()

        # H. logging
        pg = new_page()
        select(pg, "ア")
        log_before = pg.evaluate("() => learningLog.length")
        draw_ideal(pg, "ア")
        pg.wait_for_timeout(100)
        results["H_logging"] = {
            "badge": badge(pg),
            "log_grew": pg.evaluate("(b) => learningLog.length > b", log_before),
            "last_type": pg.evaluate("() => learningLog[learningLog.length-1].type"),
        }
        pg.close()

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "page_error_count": len(page_errors),
        "console_errors": console_errors,
        "page_errors": page_errors,
        "results": results,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
