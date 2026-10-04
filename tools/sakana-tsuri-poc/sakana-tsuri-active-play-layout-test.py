# Phase FISHING-APP-ACTIVE-PLAY-LAYOUT-CORRECTION-1 dedicated test suite.
# Covers what is genuinely NEW in this Phase: state-driven show/hide of the method
# picker / cast button / per-method operate controls (zero footprint, not just
# visually dimmed), simultaneous visibility of the pond+fish+operate-control during
# REELING across all 3 methods and several viewports, the one-time (not per-press)
# scroll-into-view on cast, focus handling when #cast-btn/#again-btn hide, and that
# hidden elements are excluded from Tab order and from the common Switch Scan
# isVisibleEnabled() style check (display:none, not opacity). Core gameplay mechanics
# (hold press-handoff, pointer release/reset, timing live-speed-change, record saving,
# background/fish/size-effort persistence) are already covered by the existing
# sakana-tsuri-test.py / sakana-tsuri-variety-test.py / sakana-tsuri-timing-speed-and-
# record-test.py / sakana-tsuri-learning-record-integration-test.py suites, already
# updated for this Phase's new visibility model — not re-duplicated here.
#
# Usage:
#   python3 -m http.server 8941 --bind 127.0.0.1   (serve the repo root)
#   python3 sakana-tsuri-active-play-layout-test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8941/sakana-tsuri.html"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + str(detail) if detail else ""))


def new_page(browser, viewport=None):
    context = browser.new_context(viewport=viewport or {"width": 820, "height": 1180}, has_touch=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(BASE)
    page.click("#start-btn")
    return context, page, errors


def switch_method(page, method):
    page.evaluate(
        """(m) => { inputSettings.reelMethod = m; saveInputSettings(); refreshSettingsPanelUI(); updateUI(); }""",
        method,
    )


def wait_for_state(page, target, timeout_iters=100):
    for _ in range(timeout_iters):
        if page.evaluate("() => state") == target:
            return True
        page.wait_for_timeout(30)
    return page.evaluate("() => state") == target


def is_zero_footprint(page, sel):
    """hidden AND no box AND excluded from the accessibility-tree-ish checks the shared
    a11y/Switch-Scan code actually uses (display:none), not merely dimmed/opacity'd."""
    return page.evaluate(
        """(sel) => {
            var el = document.querySelector(sel);
            if (!el) return null;
            var cs = getComputedStyle(el);
            return {
                hiddenAttr: el.hasAttribute('hidden'),
                display: cs.display,
                rects: el.getClientRects().length,
                tabIndexReachable: el.tabIndex >= 0 && el.offsetParent !== null,
            };
        }""",
        sel,
    )


def bbox_fully_in_viewport(page, sel, w, h):
    box = page.locator(sel).first.bounding_box()
    if box is None:
        return False, None
    ok = (box["x"] >= 0 and box["y"] >= 0 and box["x"] + box["width"] <= w and box["y"] + box["height"] <= h)
    return ok, box


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')

        # ===== 1. Per-method full lifecycle: visibility at every state =====
        for method in ["hold", "arc", "timing"]:
            context, page, errors = new_page(browser)
            switch_method(page, method)
            op_sel = {"hold": "#reel-hold-btn", "arc": "#reel-arc", "timing": "#reel-timing"}[method]

            # ---- IDLE (pre-cast): method row + cast button shown, operate controls hidden ----
            record(f"[{method}] IDLE: #methodRowWrap visible", page.evaluate("document.getElementById('methodRowWrap').hidden") is False)
            record(f"[{method}] IDLE: #cast-btn visible", page.evaluate("document.getElementById('cast-btn').hidden") is False)
            for other_sel in ["#reel-hold-btn", "#reel-arc", "#reel-timing"]:
                fp = is_zero_footprint(page, other_sel)
                record(f"[{method}] IDLE: {other_sel} is zero-footprint (display:none, no rects, not Tab-reachable)",
                       fp["display"] == "none" and fp["rects"] == 0 and not fp["tabIndexReachable"], fp)

            # ---- CASTING ----
            page.click("#cast-btn")
            record(f"[{method}] CASTING: #methodRowWrap hidden", page.evaluate("document.getElementById('methodRowWrap').hidden") is True)
            record(f"[{method}] CASTING: #cast-btn hidden", page.evaluate("document.getElementById('cast-btn').hidden") is True)
            fp_method = is_zero_footprint(page, "#methodRowWrap")
            record(f"[{method}] CASTING: #methodRowWrap is zero-footprint",
                   fp_method["display"] == "none" and fp_method["rects"] == 0, fp_method)

            if method == "hold":
                record(f"[{method}] CASTING: #reel-hold-btn already mounted/visible (early-press handoff support)",
                       page.evaluate("document.getElementById('reel-hold-btn').hidden") is False)
            else:
                other = "#reel-arc" if method == "arc" else "#reel-timing"
                fp_other = is_zero_footprint(page, other)
                record(f"[{method}] CASTING: {other} still zero-footprint (no early-engagement feature, stays hidden until REELING)",
                       fp_other["display"] == "none" and fp_other["rects"] == 0, fp_other)

            # ---- WAITING / BITTEN ----
            wait_for_state(page, "WAITING")
            if method == "hold":
                record(f"[{method}] WAITING: #reel-hold-btn still mounted (continuity for the press handoff)",
                       page.evaluate("document.getElementById('reel-hold-btn').hidden") is False)
            else:
                fp = is_zero_footprint(page, op_sel)
                record(f"[{method}] WAITING: {op_sel} still zero-footprint",
                       fp["display"] == "none" and fp["rects"] == 0, fp)

            # ---- REELING: the active method's control appears, others stay hidden ----
            wait_for_state(page, "REELING")
            record(f"[{method}] REELING: {op_sel} is visible", page.evaluate(f"document.querySelector('{op_sel}').hidden") is False)
            for other_sel in ["#reel-hold-btn", "#reel-arc", "#reel-timing"]:
                if other_sel == op_sel:
                    continue
                fp = is_zero_footprint(page, other_sel)
                record(f"[{method}] REELING: the non-selected {other_sel} stays zero-footprint",
                       fp["display"] == "none" and fp["rects"] == 0, fp)
            record(f"[{method}] REELING: #methodRowWrap and #cast-btn still hidden",
                   page.evaluate("document.getElementById('methodRowWrap').hidden") is True and
                   page.evaluate("document.getElementById('cast-btn').hidden") is True)

            record(f"[{method}] no runtime errors through full IDLE->REELING lifecycle", not errors, errors)
            context.close()

        # ===== 2. Simultaneous visibility: pond + fish + operate control, 4 viewports x 3 methods =====
        VIEWPORTS = [("iphone", 390, 844), ("ipad_portrait", 810, 1080), ("windows", 1366, 768), ("windows_short", 1366, 600)]
        for vname, w, h in VIEWPORTS:
            for method in ["hold", "arc", "timing"]:
                context, page, errors = new_page(browser, viewport={"width": w, "height": h})
                switch_method(page, method)
                page.click("#cast-btn")
                wait_for_state(page, "REELING")
                op_sel = {"hold": "#reel-hold-btn", "arc": "#reel-arc", "timing": "#reel-timing-btn"}[method]
                pond_ok, pond_box = bbox_fully_in_viewport(page, "#pond", w, h)
                fish_ok, _ = bbox_fully_in_viewport(page, "#fish", w, h)
                op_ok, op_box = bbox_fully_in_viewport(page, op_sel, w, h)
                record(f"[{vname} {w}x{h}, {method}] pond+fish+operate-control all simultaneously fully in viewport (no scroll needed)",
                       pond_ok and fish_ok and op_ok, {"pond": pond_box, "operate": op_box})
                context.close()

        # ===== 3. One-time scroll-into-view on cast, not per subsequent press/tick =====
        context, page, errors = new_page(browser, viewport={"width": 1366, "height": 600})
        switch_method(page, "hold")
        page.evaluate("() => document.getElementById('cast-btn').scrollIntoView({block:'end'})")
        scroll_before_cast = page.evaluate("() => window.scrollY")
        page.click("#cast-btn")
        wait_for_state(page, "REELING")
        scroll_after_cast = page.evaluate("() => window.scrollY")
        # Simulate several more presses/update ticks and confirm scroll position is left alone
        page.locator("#reel-hold-btn").click()
        page.wait_for_timeout(50)
        page.locator("#reel-hold-btn").click()
        scroll_after_presses = page.evaluate("() => window.scrollY")
        record("Scroll: casting performs a one-time alignment (scroll position changes once, at cast)",
               scroll_before_cast != scroll_after_cast or scroll_before_cast == 0,
               {"before": scroll_before_cast, "after_cast": scroll_after_cast})
        record("Scroll: subsequent presses/update ticks do NOT scroll again (position stays put)",
               scroll_after_cast == scroll_after_presses,
               {"after_cast": scroll_after_cast, "after_presses": scroll_after_presses})
        record("no runtime errors (scroll block)", not errors, errors)
        context.close()

        # ===== 4. Focus management when #cast-btn / #again-btn hide =====
        context, page, errors = new_page(browser)
        switch_method(page, "hold")
        page.locator("#cast-btn").focus()
        record("Focus: #cast-btn focused before casting", page.evaluate("document.activeElement.id") == "cast-btn")
        page.keyboard.press("Enter")
        wait_for_state(page, "CASTING", timeout_iters=20) or True  # CASTING is brief; don't hard-fail if already past it
        record("Focus: after casting (while focused), focus moved to the now-visible #reel-hold-btn, not lost to <body>",
               page.evaluate("document.activeElement.id") == "reel-hold-btn")
        record("no runtime errors (cast focus-management block)", not errors, errors)
        context.close()

        context, page, errors = new_page(browser)
        switch_method(page, "arc")  # Method A has no visible control at CASTING -- fallback target
        page.locator("#cast-btn").focus()
        page.keyboard.press("Enter")
        record("Focus: casting with Method A (no operate control visible yet) parks focus on #fishing-screen, not lost to <body>",
               page.evaluate("document.activeElement.id") == "fishing-screen")
        record("no runtime errors (cast focus-management, Method A block)", not errors, errors)
        context.close()

        context, page, errors = new_page(browser)
        switch_method(page, "hold")
        page.click("#cast-btn")
        wait_for_state(page, "REELING")
        page.evaluate("() => { applyReelProgress(reelTarget, 'click'); }")
        wait_for_state(page, "CAUGHT")
        page.locator("#again-btn").focus()
        record("Focus: #again-btn focused before reset", page.evaluate("document.activeElement.id") == "again-btn")
        page.keyboard.press("Enter")
        record("Focus: after requestReset() (while focused on #again-btn), focus moved to the now-visible #cast-btn",
               page.evaluate("document.activeElement.id") == "cast-btn")
        record("no runtime errors (reset focus-management block)", not errors, errors)
        context.close()

        # ===== 5. Tab order: hidden operate controls/method row are skipped entirely =====
        context, page, errors = new_page(browser)
        switch_method(page, "timing")
        page.click("#cast-btn")
        wait_for_state(page, "REELING")
        # From the sound checkbox, Tab forward must never land on the hidden #methodRow
        # buttons or #cast-btn -- it should reach #reel-timing-btn (or the speed toggle)
        # instead, since those are the only genuinely visible, reachable controls here.
        reachable_ids = page.evaluate("""() => {
            function visible(el) {
                if (!el) return false;
                if (el.hasAttribute('hidden') || el.closest('[hidden]')) return false;
                var cs = getComputedStyle(el);
                return cs.display !== 'none' && el.getClientRects().length > 0;
            }
            var all = Array.from(document.querySelectorAll('button,[tabindex]'));
            return all.filter(visible).map(el => el.id || el.dataset.reelMethod || el.dataset.timingSpeed || '(unlabeled)');
        }""")
        record("Tab-order candidates while REELING (Method C) never include cast-btn or the 3-way method buttons",
               "cast-btn" not in reachable_ids and "arc" not in reachable_ids and "hold" not in reachable_ids,
               reachable_ids)
        record("Tab-order candidates while REELING (Method C) include the active #reel-timing-btn",
               "reel-timing-btn" in reachable_ids, reachable_ids)
        record("no runtime errors (tab-order block)", not errors, errors)
        context.close()

        # ===== 6. Timing speed live-change still works from this new layout (smoke check;
        #          full coverage lives in sakana-tsuri-timing-speed-and-record-test.py) =====
        context, page, errors = new_page(browser)
        switch_method(page, "timing")
        page.click("#cast-btn")
        wait_for_state(page, "REELING")
        cycle_before = page.evaluate("() => activeTimingCycleMs")
        page.click("#timingSpeedToggleBtn")
        page.click('[data-timing-speed="fast"]')
        cycle_after = page.evaluate("() => activeTimingCycleMs")
        record("Timing speed: a live mid-REELING change still applies immediately from the new disclosure UI",
               abs(cycle_after - 1760) < 1, (cycle_before, cycle_after))
        record("no runtime errors (timing-speed smoke block)", not errors, errors)
        context.close()

        total = len(RESULTS)
        passed = sum(1 for r in RESULTS if r["ok"])
        print(f"\n{passed}/{total} checks passed.")
        if passed != total:
            sys.exit(1)


if __name__ == "__main__":
    main()
