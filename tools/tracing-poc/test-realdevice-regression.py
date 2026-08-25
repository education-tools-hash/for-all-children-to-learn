#!/usr/bin/env python
"""Phase T2-B' — Automated regression supplement to test-hiragana-pilot.py.

Covers what CAN be verified without a physical touch device: touch-action
CSS, multi-touch guard, pointer-capture boundary excursion, non-Pilot
character regression (8 representative chars), mouse regression, basic
in-page performance timing, and a privacy check (no raw stroke persistence).

Physical finger/stylus feel, RETRY-timing "does it feel right", and the
M1-M12 subjective UX questions are OUT OF SCOPE here — those require the
User's own hands on a real device (see the LAN preview instructions).

Usage: python tools/tracing-poc/test-realdevice-regression.py
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
APP_PATH = HERE.parent.parent / "hiragana-learn.html"
OUT_DIR = HERE / "realdevice-review-artifacts"
OUT_DIR.mkdir(exist_ok=True)

NON_PILOT_CHARS = ["か", "し", "た", "の", "ふ", "め", "や", "ん"]


def open_trace_page(browser, viewport=None):
    page = browser.new_page(viewport=viewport or {"width": 1280, "height": 900})
    console_errors = []
    page_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: page_errors.append(str(exc)))
    page.goto(APP_PATH.as_uri())
    page.wait_for_timeout(250)
    page.click('button[data-tab="trace"]')
    page.wait_for_timeout(100)
    page.locator("#traceCanvas").scroll_into_view_if_needed()
    page.wait_for_timeout(50)
    return page, console_errors, page_errors


def select_char(page, ch):
    page.click(f'.trace-kana-pick:text-is("{ch}")')
    page.wait_for_timeout(60)


def main():
    all_console_errors = []
    all_page_errors = []
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---- 1. touch-action CSS ----
        page, ce, pe = open_trace_page(browser)
        touch_action = page.evaluate("() => getComputedStyle(document.getElementById('traceCanvas')).touchAction")
        results["touch_action_css"] = touch_action
        all_console_errors += ce; all_page_errors += pe
        page.close()

        # ---- 2. multi-touch guard ----
        page, ce, pe = open_trace_page(browser)
        select_char(page, "い")
        multitouch = page.evaluate(
            """
            () => {
              const canvas = document.getElementById('traceCanvas');
              const rect = canvas.getBoundingClientRect();
              const errors = [];
              try {
                // Pointer A starts (id 501) and stays down
                canvas.dispatchEvent(new PointerEvent('pointerdown', {pointerId:501, pointerType:'touch', clientX:rect.left+40, clientY:rect.top+40, bubbles:true, cancelable:true}));
                // Pointer B starts while A is still active (simulated second finger)
                canvas.dispatchEvent(new PointerEvent('pointerdown', {pointerId:502, pointerType:'touch', clientX:rect.left+200, clientY:rect.top+200, bubbles:true, cancelable:true}));
                const afterSecondDown = { activePointerId: activePointerId, traceDrawing: traceDrawing };
                // Move both; only A's movement should be drawn/collected
                canvas.dispatchEvent(new PointerEvent('pointermove', {pointerId:501, pointerType:'touch', clientX:rect.left+60, clientY:rect.top+100, bubbles:true, cancelable:true}));
                canvas.dispatchEvent(new PointerEvent('pointermove', {pointerId:502, pointerType:'touch', clientX:rect.left+220, clientY:rect.top+260, bubbles:true, cancelable:true}));
                canvas.dispatchEvent(new PointerEvent('pointerup', {pointerId:502, pointerType:'touch', clientX:rect.left+220, clientY:rect.top+260, bubbles:true, cancelable:true}));
                canvas.dispatchEvent(new PointerEvent('pointerup', {pointerId:501, pointerType:'touch', clientX:rect.left+60, clientY:rect.top+100, bubbles:true, cancelable:true}));
                return { ok: true, afterSecondDown, traceStrokesAfter: traceStrokes.length, error: null };
              } catch (e) {
                return { ok: false, error: String(e) };
              }
            }
            """
        )
        results["multi_touch_guard"] = multitouch
        all_console_errors += ce; all_page_errors += pe
        page.close()

        # ---- 3. pointer capture boundary excursion (real mouse drag) ----
        page, ce, pe = open_trace_page(browser)
        select_char(page, "く")  # 1-stroke char, simplest to check a single continuous stroke
        box = page.locator("#traceCanvas").bounding_box()
        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(cx - 60, cy - 100)
        page.mouse.down()
        page.mouse.move(cx - 20, cy - 40, steps=3)
        page.mouse.move(box["x"] - 40, cy, steps=3)  # goes outside the canvas horizontally
        page.mouse.move(box["x"] - 40, cy + 40, steps=3)
        page.mouse.move(cx, cy + 60, steps=3)  # back inside
        page.mouse.move(cx + 40, cy + 120, steps=3)
        page.mouse.up()
        page.wait_for_timeout(80)
        stroke_count_after = page.evaluate("() => traceStrokes.length")
        stroke_point_count = page.evaluate("() => traceStrokes.length ? traceStrokes[0].length : 0")
        results["pointer_capture_boundary_excursion"] = {
            "strokes_recorded": stroke_count_after,
            "points_in_stroke": stroke_point_count,
            "expected_strokes": 1,
        }
        all_console_errors += ce; all_page_errors += pe
        page.close()

        # ---- 4. non-Pilot regression (8 representative chars) ----
        non_pilot_results = {}
        for ch in NON_PILOT_CHARS:
            page, ce, pe = open_trace_page(browser)
            select_char(page, ch)
            n = page.evaluate("(ch) => (strokeData[ch]||[]).length || 3", ch)
            box = page.locator("#traceCanvas").bounding_box()
            for i in range(n):
                page.mouse.move(box["x"] + 20 + i * 15, box["y"] + 20)
                page.mouse.down()
                page.mouse.move(box["x"] + 280 - i * 15, box["y"] + 280, steps=4)
                page.mouse.up()
            page.wait_for_timeout(80)
            passed = page.locator("#goodJob").evaluate("el => el.classList.contains('show')")
            non_pilot_results[ch] = {"expected_strokes": n, "passed_with_arbitrary_shape": passed}
            all_console_errors += ce; all_page_errors += pe
            page.close()
        results["non_pilot_regression"] = non_pilot_results

        # ---- 5. mouse full-cycle regression (draw / reset / next char) ----
        page, ce, pe = open_trace_page(browser)
        select_char(page, "い")
        box = page.locator("#traceCanvas").bounding_box()
        page.mouse.move(box["x"] + 50, box["y"] + 50)
        page.mouse.down()
        page.mouse.move(box["x"] + 150, box["y"] + 150, steps=3)
        page.mouse.up()
        strokes_before_clear = page.evaluate("() => traceStrokes.length")
        page.click('button:has-text("けす")')
        page.wait_for_timeout(60)
        strokes_after_clear = page.evaluate("() => traceStrokes.length")
        page.click("#traceNextBtn")
        page.wait_for_timeout(80)
        kana_after_next = page.evaluate("() => currentTraceKana")
        results["mouse_full_cycle"] = {
            "strokes_before_clear": strokes_before_clear,
            "strokes_after_clear": strokes_after_clear,
            "kana_after_next_click": kana_after_next,
        }
        all_console_errors += ce; all_page_errors += pe
        page.close()

        # ---- 6. in-page performance timing ----
        page, ce, pe = open_trace_page(browser)
        perf = {}
        for ch in ["い", "あ", "ま"]:
            select_char(page, ch)
            t = page.evaluate(
                """
                (ch) => {
                  const strokes = strokeData[ch].map(s => TracingEngine.sampleReferencePath(s.d, 64).points);
                  const t0 = performance.now();
                  TracingEngine.evaluateCharacter(strokes, strokeData[ch]);
                  return performance.now() - t0;
                }
                """,
                ch,
            )
            perf[ch] = t
        results["evaluate_performance_ms"] = perf
        all_console_errors += ce; all_page_errors += pe
        page.close()

        # ---- 7. privacy: no raw stroke persistence ----
        page, ce, pe = open_trace_page(browser)
        select_char(page, "い")
        box = page.locator("#traceCanvas").bounding_box()
        # draw a full correct "い" to trigger a PASS + addLog
        for stroke_pts in [
            [(box["x"] + 60, box["y"] + 40), (box["x"] + 55, box["y"] + 120), (box["x"] + 60, box["y"] + 180)],
            [(box["x"] + 230, box["y"] + 70), (box["x"] + 250, box["y"] + 140), (box["x"] + 210, box["y"] + 200)],
        ]:
            page.mouse.move(*stroke_pts[0])
            page.mouse.down()
            for pt in stroke_pts[1:]:
                page.mouse.move(*pt, steps=4)
            page.mouse.up()
        page.wait_for_timeout(100)
        storage_dump = page.evaluate(
            """
            () => {
              const out = {};
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                out[k] = localStorage.getItem(k);
              }
              return out;
            }
            """
        )
        contains_raw_points = any(
            ('"x"' in (v or "") and '"y"' in (v or "")) for v in storage_dump.values()
        )
        results["privacy_check"] = {
            "localStorage_keys": list(storage_dump.keys()),
            "any_key_contains_xy_point_data": contains_raw_points,
        }
        all_console_errors += ce; all_page_errors += pe
        page.close()

        # ---- 8. extra responsive (tablet landscape) ----
        for name, vp in {"1024x768_tablet_landscape": {"width": 1024, "height": 768}}.items():
            page, ce, pe = open_trace_page(browser, viewport=vp)
            select_char(page, "い")
            shot = OUT_DIR / f"responsive_{name}.png"
            page.locator("#traceStage").screenshot(path=str(shot))
            all_console_errors += ce; all_page_errors += pe
            page.close()

        browser.close()

    report = {
        "console_error_count": len(all_console_errors),
        "console_errors": all_console_errors,
        "page_error_count": len(all_page_errors),
        "page_errors": all_page_errors,
        "results": results,
    }
    (OUT_DIR / "realdevice-regression-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if (len(all_console_errors) == 0 and len(all_page_errors) == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
