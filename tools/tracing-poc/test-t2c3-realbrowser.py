#!/usr/bin/env python
"""Phase T2-C''' — Real-browser confirmation of the Balance Calibration:
Per-Stroke Position Guard + Completion Guard + Relative Character
Discrimination, wired into the actual production hiragana-learn.html via
evaluateTraceAttempt()'s new {allCharacters: strokeData, targetChar: k} opts.

Confirms live in hiragana-learn.html:
  A. Target あ, drawn at 25% scale -> still RETRY (Absolute Geometry Guard,
     unaffected by this phase)
  B. Cross-character confusions that were previously UNRESOLVED residuals
     (る/ろ, ぬ/め) are now RETRY, alongside the already-fixed pairs
     (そ<-る, ね<-れ, け<-は)
  C. Single-bad-stroke attacks (W2 large shift, W3 truncation) applied to
     one stroke of a multi-stroke character while the other stroke(s) are
     drawn ideally -> now RETRY (previously a false PASS since whole-
     character averaging hid the one bad stroke)
  D. Strictness check (Section 39): mild wobble/offset across many
     characters, and a stroke drawn to ~85-90% completion, must NOT
     over-trigger RETRY -> still PASS
  E. Normal ideal traces for representative characters, and the い/あ
     Motor Accessibility / Pilot Regression Lock (wobble) -> still PASS

Usage: python tools/tracing-poc/test-t2c3-realbrowser.py
"""
import json
import pathlib

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "t2c3-realbrowser-artifacts"
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
            dbg = debug_json(page)
            page.close()
            return {"target": target, "source": source, "badge": b,
                     "reason": dbg.get("reason") if dbg else None,
                     "screenshot": shot.name}

        # --- A: Absolute Geometry Guard regression (unaffected by this phase) ---
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

        # --- B: Cross-character confusions, now ALL resolved via Relative
        # Character Discrimination (previously る/ろ, ぬ/め were residual PASS) ---
        results["B_target_so_draw_ru"] = cross_char_case("B_target_so_draw_ru", "そ", "る")
        results["B_target_ru_draw_ro_FORMERLY_RESIDUAL"] = cross_char_case("B_target_ru_draw_ro", "る", "ろ")
        results["B_target_ro_draw_ru_FORMERLY_RESIDUAL"] = cross_char_case("B_target_ro_draw_ru", "ろ", "る")
        results["B_target_nu_draw_me_FORMERLY_RESIDUAL"] = cross_char_case("B_target_nu_draw_me", "ぬ", "め")
        results["B_target_me_draw_nu_FORMERLY_RESIDUAL"] = cross_char_case("B_target_me_draw_nu", "め", "ぬ")
        results["B_target_ne_draw_re"] = cross_char_case("B_target_ne_draw_re", "ね", "れ")
        results["B_target_ke_draw_ha"] = cross_char_case("B_target_ke_draw_ha", "け", "は")

        # --- C: single-bad-stroke attacks (W2 shift / W3 truncation) on ONE
        # stroke of a 2-stroke character, other stroke drawn ideally ---
        def single_bad_stroke_case(name, ch, bad_idx, transform):
            page = new_page()
            select_char(page, ch)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            char_bbox = page.evaluate(
                "(ch) => { const all = strokeData[ch].flatMap(s => TracingEngine.sampleReferencePath(s.d, 20).points);"
                " return TracingEngine.computeBBox(all); }", ch)
            for i in range(n):
                pts = get_ref_points(page, ch, i, 40)
                if i == bad_idx:
                    pts = transform(pts, char_bbox, i)
                draw_stroke(page, box, pts)
            page.wait_for_timeout(100)
            shot = OUT_DIR / f"{name}.png"
            page.locator("#traceStage").screenshot(path=str(shot))
            b = badge(page)
            dbg = debug_json(page)
            page.close()
            return {"char": ch, "bad_stroke": bad_idx, "badge": b,
                     "reason": dbg.get("reason") if dbg else None,
                     "screenshot": shot.name}

        def w2_shift(pts, char_bbox, idx):
            dir_x = 1 if idx % 2 == 0 else -1
            dir_y = -1 if idx % 3 == 0 else 1
            shift_x = dir_x * char_bbox["width"] * 0.55
            shift_y = dir_y * char_bbox["height"] * 0.55
            return [{"x": max(0.03, min(0.97, pt["x"] + shift_x)),
                      "y": max(0.03, min(0.97, pt["y"] + shift_y))} for pt in pts]

        def w3_truncate(pts, char_bbox, idx):
            cut = max(2, round(len(pts) * 0.45))
            return pts[:cut]

        results["C_w2_shift_single_stroke_i"] = single_bad_stroke_case("C_w2_shift_i", "い", 1, w2_shift)
        results["C_w3_truncate_single_stroke_i"] = single_bad_stroke_case("C_w3_truncate_i", "い", 1, w3_truncate)
        results["C_w2_shift_single_stroke_ta"] = single_bad_stroke_case("C_w2_shift_ta", "た", 2, w2_shift)
        results["C_w3_truncate_single_stroke_ta"] = single_bad_stroke_case("C_w3_truncate_ta", "た", 2, w3_truncate)

        # --- D: strictness check — must NOT over-trigger RETRY ---
        def partial_completion_case(name, ch, idx, frac):
            page = new_page()
            select_char(page, ch)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                pts = get_ref_points(page, ch, i, 40)
                if i == idx:
                    cut = max(2, round(len(pts) * frac))
                    pts = pts[:cut]
                draw_stroke(page, box, pts)
            page.wait_for_timeout(100)
            shot = OUT_DIR / f"{name}.png"
            page.locator("#traceStage").screenshot(path=str(shot))
            b = badge(page)
            dbg = debug_json(page)
            page.close()
            return {"char": ch, "stroke": idx, "frac": frac, "badge": b,
                     "reason": dbg.get("reason") if dbg else None,
                     "screenshot": shot.name}

        results["D_partial_88pct_i"] = partial_completion_case("D_partial_88pct_i", "い", 1, 0.88)
        results["D_partial_90pct_ta"] = partial_completion_case("D_partial_90pct_ta", "た", 2, 0.90)

        def wobble_offset_case(name, ch):
            page = new_page()
            select_char(page, ch)
            box = page.locator("#traceCanvas").bounding_box()
            n = page.evaluate("(ch) => strokeData[ch].length", ch)
            for i in range(n):
                pts = get_ref_points(page, ch, i, 40)
                a = 10 + i
                wob = []
                for pt in pts:
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r1 = (a % 1000) / 1000 - 0.5
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r2 = (a % 1000) / 1000 - 0.5
                    wob.append({"x": pt["x"] + r1 * 0.02 + 0.015, "y": pt["y"] + r2 * 0.02 + 0.01})
                draw_stroke(page, box, wob)
            page.wait_for_timeout(80)
            b = badge(page)
            dbg = debug_json(page)
            page.close()
            return {"char": ch, "badge": b, "reason": dbg.get("reason") if dbg else None}

        strictness_chars = ["い", "あ", "き", "た", "も", "そ", "る", "ろ", "ぬ", "め", "の", "う"]
        results["D_wobble_offset_strictness"] = {ch: wobble_offset_case(f"D_wobble_{ch}", ch) for ch in strictness_chars}

        # --- E: normal ideal traces still PASS ---
        normal_chars = ["い", "あ", "き", "た", "も", "そ", "る", "ろ", "ぬ", "め", "ね", "れ", "わ", "け", "は"]
        normal_results = {}
        for ch in normal_chars:
            page = new_page()
            select_char(page, ch)
            draw_ideal(page, ch)
            page.wait_for_timeout(80)
            normal_results[ch] = badge(page)
            page.close()
        results["E_normal_ideal_all_pass"] = normal_results

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
                for pt in pts:
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r1 = (a % 1000) / 1000 - 0.5
                    a = (a * 1103515245 + 12345) & 0x7FFFFFFF
                    r2 = (a % 1000) / 1000 - 0.5
                    wob.append({"x": pt["x"] + r1 * 0.024, "y": pt["y"] + r2 * 0.024})
                draw_stroke(page, box, wob)
            page.wait_for_timeout(80)
            b = badge(page)
            page.close()
            return b

        results["E_wobble_i"] = wobble_check("い")
        results["E_wobble_a"] = wobble_check("あ")

        browser.close()

    report = {
        "console_error_count": len(console_errors),
        "page_error_count": len(page_errors),
        "console_errors": console_errors,
        "page_errors": page_errors,
        "results": results,
    }
    (OUT_DIR / "t2c3-realbrowser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
