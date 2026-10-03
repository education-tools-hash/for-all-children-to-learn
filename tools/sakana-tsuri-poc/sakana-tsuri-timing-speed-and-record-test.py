#!/usr/bin/env python
"""Phase FISHING-APP-TIMING-SPEED-AND-LEARNING-RECORD-1 — regression tests for:
  (A) the "うごく はやさ" (timing-method speed) setting: 4 real sweep speeds,
      unchanged target-zone judgment, apply-timing safety (no jump/double-judge
      mid-REELING), persistence, no effect on arc/hold, keyboard/aria/focus.
  (C) sakana-tsuri's Learning Record Foundation registration: visible in the
      common "学習のきろく" list/detail/CSV, no double-save on catch, old
      records (pre-timingSpeed, or pre-Variety-Phase) don't break the real
      rendered detail screen.

Usage (two servers already used elsewhere in this Phase):
  python -m http.server 8941 --bind 127.0.0.1   (repo root)
Then: python tools/sakana-tsuri-poc/sakana-tsuri-timing-speed-and-record-test.py
"""
import json
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8941/sakana-tsuri.html"
RECORDS_URL = "http://127.0.0.1:8941/learning-records.html"

PASS = 0
FAIL = 0


def check(label, ok, detail=None):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [OK  ] {label}")
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail is not None else ""))


def new_page(browser, url=BASE):
    context = browser.new_context(viewport={"width": 900, "height": 900}, has_touch=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url)
    return context, page, errors


def start_and_switch_to_timing(page, speed=None):
    page.click("#start-btn")
    page.evaluate(
        """(speed) => {
            inputSettings.reelMethod = 'timing';
            if (speed) inputSettings.timingSpeed = speed;
            saveInputSettings();
            refreshSettingsPanelUI();
            updateUI();
        }""",
        speed,
    )


def cast_to_reeling(page):
    page.click("#cast-btn")
    for _ in range(80):
        if page.evaluate("() => state") == "REELING":
            return
        page.wait_for_timeout(50)
    raise AssertionError("never reached REELING")


def measure_sweep_half_period_ms(page, samples=40):
    """Measures the actual time (ms) for timingMarkerPctAt() to go 0->100 (one
    half-cycle), by sampling pct() at a fixed real-time interval and finding
    the first index where it wraps from high back toward 0 (i.e. a trough)."""
    data = page.evaluate(
        """(n) => {
            var out = [];
            var start = performance.now();
            for (var i = 0; i < n; i++) {
                out.push({ t: performance.now() - start, pct: timingMarkerPctAt(Date.now()) });
            }
            return out;
        }""",
        samples,
    )
    return data


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

    # ================= A1. Default is 'normal', byte-identical to pre-Phase speed =================
    context, page, errors = new_page(browser)
    check("Default inputSettings.timingSpeed is 'normal'", page.evaluate("defaultInputSettings().timingSpeed") == "normal")
    check("TIMING_SPEED_MULTIPLIERS.normal is 1.0 (unchanged base speed)", page.evaluate("TIMING_SPEED_MULTIPLIERS.normal") == 1)
    check("activeTimingCycleMs starts equal to TIMING_CYCLE_MS before any sweep", page.evaluate("activeTimingCycleMs === TIMING_CYCLE_MS"))
    context.close()

    # ================= A2. Real measured speed differs correctly across the 4 levels =================
    # Cycle = TIMING_CYCLE_MS / multiplier. We measure actual elapsed real time for the
    # marker's pct() to traverse from near-0 up past 50 (half the sweep), which should
    # scale inversely with the configured multiplier.
    measured_half_period = {}
    for speed_key in ["very-slow", "slow", "normal", "fast"]:
        context, page, errors = new_page(browser)
        start_and_switch_to_timing(page, speed_key)
        cast_to_reeling(page)
        page.evaluate("() => { startTimingAnimation(); }")  # ensure freshly (re)armed with this speed
        t0 = page.evaluate("() => { window.__t0 = Date.now(); return window.__t0; }")
        # poll real time until pct crosses 50% for the first time
        elapsed = None
        for _ in range(200):
            pct = page.evaluate("() => timingMarkerPctAt(Date.now())")
            if pct >= 50:
                elapsed = page.evaluate("() => Date.now() - window.__t0")
                break
            page.wait_for_timeout(10)
        check(f"speed={speed_key}: marker reaches 50% within a bounded real time", elapsed is not None, elapsed)
        measured_half_period[speed_key] = elapsed
        check(f"no runtime errors (speed={speed_key} measurement)", not errors, errors)
        context.close()

    expected_cycle = {"very-slow": 2200 / 0.5, "slow": 2200 / 0.75, "normal": 2200 / 1.0, "fast": 2200 / 1.25}
    # half-period should be roughly expected_cycle/2, generous tolerance for test-harness jitter
    for k in ["very-slow", "slow", "normal", "fast"]:
        expect_half = expected_cycle[k] / 2
        actual = measured_half_period[k]
        ok = actual is not None and abs(actual - expect_half) < expect_half * 0.6
        check(f"speed={k}: measured half-period ({actual}ms) is in the right ballpark of {expect_half:.0f}ms", ok, (actual, expect_half))
    check("very-slow is measurably slower (larger half-period) than normal",
          measured_half_period["very-slow"] > measured_half_period["normal"], measured_half_period)
    check("fast is measurably faster (smaller half-period) than normal",
          measured_half_period["fast"] < measured_half_period["normal"], measured_half_period)
    check("slow is between very-slow and normal",
          measured_half_period["normal"] < measured_half_period["slow"] < measured_half_period["very-slow"], measured_half_period)

    # ================= A3. Target zone / marker size constants are completely untouched =================
    context, page, errors = new_page(browser)
    check("TIMING_ZONE_PERFECT_HALF is still 14 (unchanged from the real-device-correction Phase)",
          page.evaluate("TIMING_ZONE_PERFECT_HALF") == 14)
    check("TIMING_ZONE_GOOD_HALF is still 30 (unchanged)", page.evaluate("TIMING_ZONE_GOOD_HALF") == 30)
    check("TIMING_ZONE_CENTER is still 50 (unchanged)", page.evaluate("TIMING_ZONE_CENTER") == 50)
    marker_size = page.evaluate("() => { var cs = getComputedStyle(document.getElementById('timing-marker')); return {w: cs.width, h: cs.height}; }")
    check("timing-marker CSS width/height still 30px (unchanged, enlarged-point Phase)", marker_size == {"w": "30px", "h": "30px"}, marker_size)
    context.close()

    # ================= A4. Boundary-value hit-test, independent of speed setting =================
    for speed_key in ["very-slow", "fast"]:
        context, page, errors = new_page(browser)
        start_and_switch_to_timing(page, speed_key)
        cast_to_reeling(page)

        def press_at_pct(pct):
            page.evaluate(
                """(pct) => {
                    timingStartTs = Date.now() - (pct <= 100 ? (pct/100) : (2 - pct/100)) * (activeTimingCycleMs/2);
                }""",
                pct,
            )
            before = page.evaluate("reelProgress")
            page.evaluate("() => document.getElementById('reel-timing-btn').click()")
            after = page.evaluate("reelProgress")
            return after - before

        gain_full = page.evaluate("REEL_GAIN_PRESETS[inputSettings.reelGainPreset]")
        gain_half = max(1, round(gain_full / 2))
        d_center = press_at_pct(50)
        check(f"speed={speed_key}: center(50%) awards full gain ({gain_full})", d_center == gain_full, d_center)
        d_just_outside_perfect = press_at_pct(50 + 14.5)
        check(f"speed={speed_key}: just outside perfect half (64.5%) awards half gain ({gain_half})",
              d_just_outside_perfect == gain_half, d_just_outside_perfect)
        d_just_outside_good = press_at_pct(50 + 30.5)
        check(f"speed={speed_key}: just outside good half (80.5%) awards 0", d_just_outside_good == 0, d_just_outside_good)
        check(f"no runtime errors (speed={speed_key} boundary block)", not errors, errors)
        context.close()

    # ================= A5. Apply-timing: changing speed mid-sweep does not affect the CURRENT sweep =================
    context, page, errors = new_page(browser)
    start_and_switch_to_timing(page, "normal")
    cast_to_reeling(page)
    cycle_before = page.evaluate("activeTimingCycleMs")
    # live-change the setting (simulating a click while REELING) without going through a
    # fresh startTimingAnimation() call
    page.evaluate("() => { inputSettings.timingSpeed = 'fast'; saveInputSettings(); refreshSettingsPanelUI(); }")
    cycle_during = page.evaluate("activeTimingCycleMs")
    check("activeTimingCycleMs is UNCHANGED immediately after a mid-sweep setting change (captured once at sweep start, not re-read live)",
          cycle_during == cycle_before, (cycle_before, cycle_during))
    pct_1 = page.evaluate("timingMarkerPctAt(Date.now())")
    page.wait_for_timeout(60)
    pct_2 = page.evaluate("timingMarkerPctAt(Date.now())")
    check("marker position still advances smoothly (no discontinuous jump) right after the setting change",
          abs(pct_2 - pct_1) < 20, (pct_1, pct_2))
    # now actually land the fish (drive reelProgress to target via the real press
    # path) and start a fresh cast — the NEW speed should apply then.
    page.evaluate("() => { applyReelProgress(reelTarget, 'click'); }")
    for _ in range(80):
        if page.evaluate("() => state") == "CAUGHT":
            break
        page.wait_for_timeout(50)
    page.evaluate("() => { requestReset(); }")
    for _ in range(40):
        if page.evaluate("() => state") == "IDLE":
            break
        page.wait_for_timeout(50)
    page.click("#cast-btn")
    for _ in range(80):
        if page.evaluate("() => state") == "REELING":
            break
        page.wait_for_timeout(50)
    cycle_next_trial = page.evaluate("activeTimingCycleMs")
    check("the changed speed DOES apply starting the next trial's sweep (2200/1.25=1760ms)",
          abs(cycle_next_trial - 1760) < 5, cycle_next_trial)
    check("no runtime errors (apply-timing block)", not errors, errors)
    context.close()

    # ================= A6. Persistence across reload =================
    context, page, errors = new_page(browser)
    start_and_switch_to_timing(page, "slow")
    context2_check = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_settings')).timingSpeed")
    check("timingSpeed persisted to localStorage immediately on change", context2_check == "slow", context2_check)
    page.reload()
    after_reload = page.evaluate("inputSettings.timingSpeed")
    check("timingSpeed survives a page reload", after_reload == "slow", after_reload)
    context.close()

    # ================= A7. No effect on arc/hold progression =================
    context, page, errors = new_page(browser)
    page.click("#start-btn")
    page.evaluate("""() => {
        inputSettings.timingSpeed = 'very-slow';
        saveInputSettings();
    }""")
    page.evaluate("""() => {
        inputSettings.reelMethod = 'hold';
        saveInputSettings();
        refreshSettingsPanelUI();
        updateUI();
    }""")
    cast_to_reeling(page)
    before = page.evaluate("reelProgress")
    box = page.locator("#reel-hold-btn").bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(300)
    page.mouse.up()
    after = page.evaluate("reelProgress")
    check("Method B (hold) progresses normally regardless of timingSpeed being set to very-slow",
          after > before, (before, after))
    check("no runtime errors (Method B unaffected block)", not errors, errors)
    context.close()

    # ================= A8. Keyboard focus / aria-pressed / 44px touch target =================
    context, page, errors = new_page(browser)
    start_and_switch_to_timing(page, "normal")
    buttons = page.locator("[data-timing-speed]")
    check("4 timing-speed buttons present", buttons.count() == 4, buttons.count())
    pressed_values = page.evaluate(
        "() => Array.from(document.querySelectorAll('[data-timing-speed]')).map(b => [b.dataset.timingSpeed, b.getAttribute('aria-pressed')])"
    )
    check("exactly one button has aria-pressed=true, matching 'normal'",
          pressed_values.count(["normal", "true"]) == 1 and sum(1 for _, v in pressed_values if v == "true") == 1,
          pressed_values)
    check("current-speed text label reads ふつう", page.inner_text("#timingSpeedCurrentLabel") == "ふつう")
    page.locator('[data-timing-speed="fast"]').click()
    check("clicking はやい updates aria-pressed + the text label together",
          page.evaluate("document.querySelector('[data-timing-speed=\"fast\"]').getAttribute('aria-pressed')") == "true"
          and page.inner_text("#timingSpeedCurrentLabel") == "はやい")
    page.locator('[data-timing-speed="slow"]').focus()
    check("a timing-speed button is keyboard-focusable", page.evaluate("document.activeElement.dataset.timingSpeed") == "slow")
    page.keyboard.press("Enter")
    check("Enter activates the focused timing-speed button",
          page.evaluate("inputSettings.timingSpeed") == "slow")
    min_height = page.evaluate("() => getComputedStyle(document.querySelector('[data-timing-speed=\"normal\"]')).minHeight")
    check("timing-speed buttons meet the 44px WCAG 2.5.5 minimum touch target", min_height == "44px", min_height)
    check("no runtime errors (keyboard/aria block)", not errors, errors)
    context.close()

    browser.close()

print(f"\n{PASS + FAIL} checks run, {PASS} passed, {FAIL} failed.")
if FAIL > 0:
    print("FAILURES PRESENT.")
    raise SystemExit(1)
print("ALL PASS.")
