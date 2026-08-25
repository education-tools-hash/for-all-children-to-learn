#!/usr/bin/env python
"""Phase T3-C Section 10 — Real Browser Stress Validation.

Drives katakana-app.html (unmodified from T3-B) via Playwright, testing
U across explicit noise levels (normal/mild/moderate/uneven) to confirm
whether the Known Limitation (stroke-assignment swap under
moderate-or-greater noise) is reproducible in the actual browser via
genuine mouse-driven Pointer Events, plus shi/mi/yo, risk pairs, and
negative cases.

Usage: python tools/tracing-poc/test-katakana-stress.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "katakana-app.html"
OUT_DIR = HERE / "t3c-stress-artifacts"
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


def get_ref(page, ch, i, n=60):
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


def lcg(seed):
    state = {"a": seed}

    def rng():
        state["a"] = (state["a"] * 1103515245 + 12345) & 0x7FFFFFFF
        return (state["a"] % 1000) / 1000 - 0.5
    return rng


def apply_noise(pts, amplitude, seed):
    rng = lcg(seed)
    return [{"x": p["x"] + rng() * 2 * amplitude, "y": p["y"] + rng() * 2 * amplitude} for p in pts]


def apply_uneven(pts, seed):
    rng = lcg(seed)
    n = len(pts)
    out = []
    for i, p in enumerate(pts):
        frac = i / (n - 1)
        in_middle = 0.33 < frac < 0.66
        amp = 0.02 if in_middle else 0.003
        out.append({"x": p["x"] + rng() * 2 * amp, "y": p["y"] + rng() * 2 * amp})
    return out


def main():
    console_errors, page_errors = [], []
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page():
            pg = browser.new_page(viewport={"width": 1280, "height": 900})
            pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: page_errors.append(str(e)))
            pg.goto(APP_PATH.as_uri() + "?tracingDebug=1")
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
                draw_stroke(pg, box, get_ref(pg, ch, i, 60))

        def noisy_case(ch, mode, seed=11):
            pg = new_page()
            select(pg, ch)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                pts = get_ref(pg, ch, i, 60)
                if mode == "normal":
                    pass
                elif mode == "mild":
                    pts = apply_noise(pts, 0.012, seed + i)
                elif mode == "moderate":
                    pts = apply_noise(pts, 0.018, seed + i)
                elif mode == "uneven":
                    pts = apply_uneven(pts, seed + i)
                draw_stroke(pg, box, pts)
            pg.wait_for_timeout(100)
            dbg = debug_json(pg)
            b = badge(pg)
            assignment = None
            if dbg and "strokes" in dbg:
                assignment = [s.get("matched") for s in dbg["strokes"]]
            pg.close()
            return {"badge": b, "reason": dbg.get("reason") if dbg else None, "assignment": assignment}

        # --- U across explicit noise levels ---
        results["U_normal"] = noisy_case("ウ", "normal")
        results["U_mild"] = noisy_case("ウ", "mild")
        results["U_moderate"] = noisy_case("ウ", "moderate")
        results["U_uneven"] = noisy_case("ウ", "uneven")

        # --- shi/mi/yo ---
        for ch, label in [("シ", "shi"), ("ミ", "mi"), ("ヨ", "yo")]:
            results[f"{label}_normal"] = noisy_case(ch, "normal")
            results[f"{label}_mild"] = noisy_case(ch, "mild")

        # --- risk pairs ---
        def cross(target, source):
            pg = new_page()
            select(pg, target)
            box = pg.locator("#traceCanvas").bounding_box()
            n = pg.evaluate("(ch) => strokeData[ch].length", source)
            for i in range(n):
                draw_stroke(pg, box, get_ref(pg, source, i, 60))
            pg.wait_for_timeout(100)
            dbg = debug_json(pg)
            b = badge(pg)
            pg.close()
            return {"badge": b, "reason": dbg.get("reason") if dbg else None}

        for (t, s) in [("ヲ", "テ"), ("テ", "ヲ"), ("ス", "ヌ"), ("ヌ", "ス"), ("ユ", "コ"), ("コ", "ユ")]:
            results[f"risk_{t}_lt_{s}"] = cross(t, s)

        # --- negatives ---
        pg = new_page()
        select(pg, "ウ")
        box = pg.locator("#traceCanvas").bounding_box()
        n = pg.evaluate("(ch) => strokeData[ch].length", "ウ")
        for i in range(n):
            pts = get_ref(pg, "ウ", i, 60)
            shr = [{"x": 0.5 + (pt["x"] - 0.5) * 0.25, "y": 0.5 + (pt["y"] - 0.5) * 0.25} for pt in pts]
            draw_stroke(pg, box, shr)
        pg.wait_for_timeout(100)
        results["neg_scale25_U"] = badge(pg)
        pg.close()

        pg = new_page()
        select(pg, "ヒ")
        box = pg.locator("#traceCanvas").bounding_box()
        bbox = pg.evaluate(
            "(ch) => { const all = strokeData[ch].flatMap(s => TracingEngine.sampleReferencePath(s.d, 20).points);"
            " return TracingEngine.computeBBox(all); }", "ヒ")
        n = pg.evaluate("(ch) => strokeData[ch].length", "ヒ")
        for i in range(n):
            pts = get_ref(pg, "ヒ", i, 60)
            if i == 0:
                dx = bbox["width"] * 0.55
                dy = -bbox["height"] * 0.55
                pts = [{"x": max(0.03, min(0.97, pt["x"] + dx)), "y": max(0.03, min(0.97, pt["y"] + dy))} for pt in pts]
            draw_stroke(pg, box, pts)
        pg.wait_for_timeout(100)
        dbg = debug_json(pg)
        results["neg_position_shift_hi"] = {"badge": badge(pg), "reason": dbg.get("reason") if dbg else None}
        pg.close()

        pg = new_page()
        select(pg, "ミ")
        box = pg.locator("#traceCanvas").bounding_box()
        n = pg.evaluate("(ch) => strokeData[ch].length", "ミ")
        for i in range(n):
            pts = get_ref(pg, "ミ", i, 60)
            if i == 0:
                pts = pts[: max(2, round(len(pts) * 0.45))]
            draw_stroke(pg, box, pts)
        pg.wait_for_timeout(100)
        dbg = debug_json(pg)
        results["neg_truncated_mi"] = {"badge": badge(pg), "reason": dbg.get("reason") if dbg else None}
        pg.close()

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "page_error_count": len(page_errors),
        "console_errors": console_errors,
        "page_errors": page_errors,
        "results": results,
    }
    (OUT_DIR / "t3c-stress-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
