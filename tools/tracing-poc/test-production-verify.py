#!/usr/bin/env python
"""Phase T2-E — Post-deploy Production verification.

Drives the LIVE Production URL (https://donomana.jp/hiragana-learn.html)
via Playwright to confirm the new tracing judgment is actually serving
in Production: normal traces (i/a) pass, cross-character confusions
(ru<-ro, nu<-me) correctly RETRY, 25% scale RETRY, wobble still PASS,
and console/page error counts are 0.

This is read-only interaction with the live site (no data submitted
anywhere, purely client-side canvas drawing simulation).
"""
import json
from playwright.sync_api import sync_playwright

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


def main():
    console_errors, page_errors = [], []
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page():
            pg = browser.new_page(viewport={"width": 1280, "height": 900})
            pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: page_errors.append(str(e)))
            pg.goto("https://donomana.jp/hiragana-learn.html?tracingDebug=1")
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

        def cross(target, source):
            pg = new_page()
            select(pg, target)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", source)
            for i in range(n):
                draw_stroke(pg, box, get_ref(pg, source, i, 40))
            pg.wait_for_timeout(120)
            b = badge(pg)
            pg.close()
            return b

        for ch in ["い", "あ"]:
            pg = new_page()
            select(pg, ch)
            draw_ideal(pg, ch)
            pg.wait_for_timeout(100)
            results["normal_" + ch] = badge(pg)
            pg.close()

        results["cross_target_ru_draw_ro"] = cross("る", "ろ")
        results["cross_target_nu_draw_me"] = cross("ぬ", "め")

        pg = new_page()
        select(pg, "あ")
        box = pg.locator("#traceCanvas").bounding_box()
        for i in range(3):
            pts = get_ref(pg, "あ", i, 40)
            shr = [{"x": 0.5 + (pt["x"] - 0.5) * 0.25, "y": 0.5 + (pt["y"] - 0.5) * 0.25} for pt in pts]
            draw_stroke(pg, box, shr)
        pg.wait_for_timeout(100)
        results["bad_scale_25pct"] = badge(pg)
        pg.close()

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

        results["wobble_i"] = wobble("い")
        results["wobble_a"] = wobble("あ")

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
