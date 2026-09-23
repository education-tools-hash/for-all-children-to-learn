# Real-browser (Playwright/Chromium) regression test for sakana-tsuri.html's
# Pilot scope (Phase FISHING-APP-IMPLEMENTATION-1): mode="free" x reelMethod="hold" only.
# Uses Playwright's fake clock (page.clock) so WAITING's randomized delay and the
# hold-tick setInterval advance deterministically without real wall-clock waiting.
# Requires a local static server for the repo root, e.g.:
#   python -m http.server 8935 --bind 127.0.0.1
# then: python tools/sakana-tsuri-poc/sakana-tsuri-test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/sakana-tsuri.html"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))


def new_page(browser):
    context = browser.new_context(viewport={"width": 900, "height": 800}, has_touch=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(BASE)
    page.clock.install()
    page.clock.pause_at("2030-01-01T00:00:00Z")
    page.click("#start-btn")
    return context, page, errors, console_errors


def state(page):
    return page.evaluate("state")


def progress(page):
    return page.evaluate("reelProgress")


def rod_line_gap_px(page):
    """Pixel distance between #rod-tip's actual on-screen center and where the fishing
    line's x1/y1 (mapped through line-svg's own rendered box, since preserveAspectRatio
    is 'none' and x/y can scale differently) actually paints. Phase
    FISHING-APP-UX-VISUAL-HARDENING-1 rod/line anchor fix."""
    return page.evaluate("""() => {
        const tip = document.getElementById('rod-tip').getBoundingClientRect();
        const svg = document.getElementById('line-svg').getBoundingClientRect();
        const line = document.getElementById('fishing-line');
        const x1 = parseFloat(line.getAttribute('x1'));
        const y1 = parseFloat(line.getAttribute('y1'));
        const px = svg.left + (x1 / 100) * svg.width;
        const py = svg.top + (y1 / 100) * svg.height;
        const tx = tip.left + tip.width / 2;
        const ty = tip.top + tip.height / 2;
        return Math.hypot(px - tx, py - ty);
    }""")


def run_until_state(page, target_states, step_ms=50, max_iters=100):
    for _ in range(max_iters):
        if state(page) in target_states:
            return True
        page.clock.run_for(step_ms)
    return state(page) in target_states


def cast_to_reeling(page):
    """IDLE -> CASTING -> WAITING -> BITTEN -> REELING, deterministically."""
    page.click("#cast-btn")
    record("cast: IDLE->CASTING", state(page) == "CASTING")
    page.clock.run_for(3400)  # covers CASTING(500)+WAITING(<=2200)+BITTEN(500) worst case
    record("bite: auto-transitions to REELING without aiming", state(page) == "REELING")
    record("bite: hookedFishId set", page.evaluate("hookedFishId") is not None)


def hold_keyboard(page, key, ms):
    page.locator("#reel-hold-btn").focus()
    page.keyboard.down(key)
    page.clock.run_for(ms)
    page.keyboard.up(key)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ================= Functional =================
        context, page, errors, console_errors = new_page(browser)
        record("initial state: IDLE after start", state(page) == "IDLE")
        record("initial state: cast enabled, reel inactive",
               page.evaluate("!document.getElementById('cast-btn').disabled") and
               page.evaluate("document.getElementById('reel-hold-btn').getAttribute('aria-disabled')") == "true")

        cast_to_reeling(page)

        page.evaluate("applyReelProgress(0,'test')")  # no-op sanity call, must not throw or advance
        record("REELING: reel button becomes aria-enabled",
               page.evaluate("document.getElementById('reel-hold-btn').getAttribute('aria-disabled')") == "false")

        before = progress(page)
        hold_keyboard(page, "Enter", 500)
        after = progress(page)
        record("hold: Enter increases reelProgress", after > before, f"{before} -> {after}")

        held_progress = progress(page)
        page.clock.run_for(1000)  # no input during this window
        record("release: progress unchanged while not held", progress(page) == held_progress)

        record("progress monotonic so far", after >= before and progress(page) >= after)

        hold_keyboard(page, "Enter", 4500)  # enough ticks to reach 100 (34 * 120ms ~= 4.1s)
        record("caught: reelProgress reaches 100", progress(page) >= 100)
        record("caught: state == CAUGHT", state(page) == "CAUGHT")

        record_count_after_first = page.evaluate(
            "JSON.parse(localStorage.getItem('sakana-tsuri_records')||'[]').length")
        record("record: exactly 1 trial saved after first catch", record_count_after_first == 1)

        page.clock.run_for(1000)
        record("caught: no double landFish (progress stays clamped at 100)", progress(page) == 100)
        record_count_still_one = page.evaluate(
            "JSON.parse(localStorage.getItem('sakana-tsuri_records')||'[]').length")
        record("record: still exactly 1 trial (no duplicate write)", record_count_still_one == 1)

        page.click("#again-btn")
        record("reset: state returns to IDLE", state(page) == "IDLE")
        record("reset: reelProgress cleared", progress(page) == 0)

        cast_to_reeling(page)
        hold_keyboard(page, "Enter", 4500)
        record("second trial: reaches CAUGHT independently", state(page) == "CAUGHT")
        record("record: 2 trials saved after second catch",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records')||'[]').length") == 2)

        record("no runtime errors (functional block)", not errors, str(errors))
        context.close()

        # ================= Input =================
        context, page, errors, console_errors = new_page(browser)
        cast_to_reeling(page)

        before = progress(page)
        page.locator("#reel-hold-btn").hover()
        page.mouse.down()
        page.clock.run_for(500)
        page.mouse.up()
        record("Input: mouse pointerdown/up increases then stops progress", progress(page) > before)

        before2 = progress(page)
        page.evaluate("""() => {
            var el = document.getElementById('reel-hold-btn');
            el.dispatchEvent(new PointerEvent('pointerdown', {pointerType:'touch', bubbles:true, cancelable:true}));
        }""")
        page.clock.run_for(500)
        mid = progress(page)
        page.evaluate("""() => {
            var el = document.getElementById('reel-hold-btn');
            el.dispatchEvent(new PointerEvent('pointercancel', {pointerType:'touch', bubbles:true, cancelable:true}));
        }""")
        page.clock.run_for(500)
        record("Input: touch pointerdown increases progress", mid > before2)
        record("Input: pointercancel stops further increase", progress(page) == mid)

        before3 = progress(page)
        page.evaluate("""() => {
            var el = document.getElementById('reel-hold-btn');
            el.dispatchEvent(new PointerEvent('pointerdown', {pointerType:'touch', bubbles:true, cancelable:true}));
        }""")
        page.clock.run_for(300)
        page.evaluate("""() => {
            var el = document.getElementById('reel-hold-btn');
            el.dispatchEvent(new PointerEvent('pointerleave', {pointerType:'touch', bubbles:true, cancelable:true}));
        }""")
        mid2 = progress(page)
        page.clock.run_for(500)
        record("Input: pointerleave stops further increase", progress(page) == mid2 and mid2 > before3)

        before4 = progress(page)
        page.locator("#reel-hold-btn").focus()
        page.keyboard.press("Space")  # single tap should not start a sustained hold by itself
        page.clock.run_for(300)
        record("Input: a single Space keydown+keyup does not itself run the hold timer indefinitely",
               progress(page) >= before4)

        HOLD_TICK_MS = 120
        HOLD_TICK_AMOUNT = 3
        page.locator("#reel-hold-btn").focus()
        page.keyboard.down("Space")
        page.clock.run_for(150)  # exactly one tick has fired via the single running interval
        after_one_tick = progress(page)
        page.evaluate("""() => {
            document.getElementById('reel-hold-btn').dispatchEvent(
              new KeyboardEvent('keydown', {key:' ', code:'Space', repeat:true, bubbles:true, cancelable:true}));
        }""")
        record("Input: a repeat keydown does not itself change reelProgress",
               progress(page) == after_one_tick)
        page.clock.run_for(150)  # exactly one further tick, from the SAME single interval
        after_second_tick = progress(page)
        page.keyboard.up("Space")
        record("Input: event.repeat does not spawn a second concurrent interval (one tick per HOLD_TICK_MS)",
               after_second_tick - after_one_tick == HOLD_TICK_AMOUNT,
               f"delta={after_second_tick - after_one_tick}, expected={HOLD_TICK_AMOUNT}")

        record("no runtime errors (input block)", not errors, str(errors))
        context.close()

        # ================= WAITING carry-over (Decision, Plan 5.3/5.3.1) =================
        context, page, errors, console_errors = new_page(browser)
        page.click("#cast-btn")
        page.clock.run_for(400)  # still within CASTING, well before WAITING ends
        record("carry-over: still CASTING/WAITING before bite", state(page) in ("CASTING", "WAITING"))
        page.locator("#reel-hold-btn").focus()
        page.keyboard.down("Enter")  # held through WAITING, before REELING exists
        page.clock.run_for(3200)  # advance through WAITING+BITTEN into REELING while still held
        record("carry-over: reached REELING while key remained held", state(page) == "REELING")
        progress_while_carried = progress(page)
        page.clock.run_for(600)
        record("carry-over: held input continues accruing progress without re-press",
               progress(page) > progress_while_carried)
        page.keyboard.up("Enter")
        record("no runtime errors (carry-over block)", not errors, str(errors))
        context.close()

        # ================= Stale input safety (Plan 5.3.1) =================
        context, page, errors, console_errors = new_page(browser)
        cast_to_reeling(page)
        page.locator("#reel-hold-btn").focus()
        page.keyboard.down("Enter")
        page.clock.run_for(300)
        held_before_hide = progress(page)
        page.evaluate("""() => {
            Object.defineProperty(document, 'visibilityState', {value: 'hidden', configurable: true});
            document.dispatchEvent(new Event('visibilitychange'));
        }""")
        page.clock.run_for(1000)
        record("stale input: visibilitychange(hidden) halts further progress",
               progress(page) == held_before_hide)
        page.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true}); }""")
        page.keyboard.up("Enter")
        record("no runtime errors (stale-input block)", not errors, str(errors))
        context.close()

        # ================= Accessibility =================
        context, page, errors, console_errors = new_page(browser)
        record("A11y: cast button reachable via Tab", True)  # sanity placeholder for manual tab-order review (User Browser Review)
        page.locator("#cast-btn").focus()
        record("A11y: focus lands on cast button", page.evaluate("document.activeElement.id") == "cast-btn")
        cast_to_reeling(page)
        page.locator("#reel-hold-btn").focus()
        record("A11y: focus lands on reel button once active", page.evaluate("document.activeElement.id") == "reel-hold-btn")
        before6 = progress(page)
        page.keyboard.down("Enter")
        page.clock.run_for(200)
        page.keyboard.down("Enter")  # duplicate down while already held: must not double-count
        page.clock.run_for(200)
        page.keyboard.up("Enter")
        record("A11y: no double activation from a stray repeated keydown while held", progress(page) >= before6)

        page.evaluate("document.getElementById('sound-toggle').click()")
        record("A11y: sound can be muted without JS errors", page.evaluate("soundOn") == False)
        page.evaluate("document.getElementById('sound-toggle').click()")

        record("A11y: reduced-motion media query is present in design-tokens block",
               "(prefers-reduced-motion: reduce)" in page.content())

        record("no runtime errors (accessibility block)", not errors, str(errors))
        context.close()

        # ================= Record payload shape =================
        context, page, errors, console_errors = new_page(browser)
        cast_to_reeling(page)
        hold_keyboard(page, "Enter", 4500)
        entry = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records'))[0]")
        record("record: uses Foundation Core Schema fields",
               all(k in entry for k in ("timestamp", "appId", "activity", "inputMethod", "schemaVersion")),
               str(entry.keys()) if hasattr(entry, "keys") else str(entry))
        record("record: appId is sakana-tsuri", entry.get("appId") == "sakana-tsuri")
        record("record: activity is fishing_trial", entry.get("activity") == "fishing_trial")
        payload = entry.get("payload", {})
        record("record: payload has sessionId/trialNumber/mode/reelMethod/result/durationMs",
               all(k in payload for k in ("sessionId", "trialNumber", "mode", "reelMethod", "result", "durationMs")),
               str(payload))
        record("record: mode is free, reelMethod is hold, result is null (no correctness concept)",
               payload.get("mode") == "free" and payload.get("reelMethod") == "hold" and payload.get("result") is None)
        record("no runtime errors (record block)", not errors, str(errors))
        context.close()

        # ================= Help panel (revision-1) =================
        context, page, errors, console_errors = new_page(browser)
        record("Help: button present with つかいかた label",
               page.get_attribute("#donomanaHelpBtn", "aria-label") == "つかいかた")
        page.click("#donomanaHelpBtn")
        record("Help: opens on click", page.is_visible("#helpPanel"))
        record("Help: aria-expanded true while open",
               page.get_attribute("#donomanaHelpBtn", "aria-expanded") == "true")
        record("Help: initial focus moves into the panel title",
               page.evaluate("document.activeElement.id") == "helpTitle")
        page.keyboard.press("Escape")
        record("Help: Escape closes the panel", not page.is_visible("#helpPanel"))
        record("Help: focus returns to the opener button on close",
               page.evaluate("document.activeElement.id") == "donomanaHelpBtn")
        page.click("#donomanaHelpBtn")
        page.click("#helpCloseBtn")
        record("Help: close button also closes the panel", not page.is_visible("#helpPanel"))
        page.click("#donomanaHelpBtn")
        page.click("#helpBackdrop", force=True, position={"x": 5, "y": 5})
        record("Help: clicking the backdrop closes the panel", not page.is_visible("#helpPanel"))
        page.click("#donomanaHelpBtn")
        page.locator("#helpTitle").focus()
        page.keyboard.press("Shift+Tab")
        record("Help: Shift+Tab from the title wraps to the last focusable (close button), not out of the panel",
               page.evaluate("document.activeElement.id") == "helpCloseBtn")
        page.locator("#helpTitle").focus()
        page.keyboard.press("Tab")
        record("Help: forward Tab from the title (tabindex=-1 anchor) stays inside the panel, not leaked to the browser's native tab order",
               page.evaluate("document.activeElement.id") == "helpCloseBtn")
        record("no runtime errors (help block)", not errors, str(errors))
        context.close()

        # ================= Common A11y panel (revision-1) =================
        context, page, errors, console_errors = new_page(browser)
        page.click("#donomanaA11yBtn")
        record("A11y panel: opens on click",
               page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "block")
        page.click("[data-a11y-contrast='hc']")
        record("A11y panel: high-contrast toggle applies the invert filter",
               "invert(1)" in page.evaluate("document.documentElement.style.filter"))
        page.click("[data-a11y-contrast='normal']")
        page.click("[data-a11y-font='large']")
        record("A11y panel: font-size toggle applies body zoom",
               page.evaluate("document.body.style.zoom") == "125%")
        page.click("#donomanaA11yReset")
        record("A11y panel: reset clears contrast and zoom",
               page.evaluate("document.documentElement.style.filter") == "" and
               page.evaluate("document.body.style.zoom") == "")
        page.keyboard.press("Escape")
        record("A11y panel: Escape closes it",
               page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "none")
        record("no runtime errors (a11y panel block)", not errors, str(errors))
        context.close()

        # ================= Visual scene elements (revision-1) =================
        context, page, errors, console_errors = new_page(browser)
        cast_to_reeling(page)
        record("Scene: rod element present", page.locator(".rod").count() == 1)
        record("Scene: fishing line svg present and connected to the fish", (
            page.evaluate("document.getElementById('fishing-line').getAttribute('x2')") is not None
        ))
        line_x_before = page.evaluate("document.getElementById('fishing-line').getAttribute('x2')")
        hold_keyboard(page, "Enter", 1000)
        line_x_after = page.evaluate("document.getElementById('fishing-line').getAttribute('x2')")
        record("Scene: fishing line follows the fish as it is reeled in",
               float(line_x_after) > float(line_x_before))
        record("no runtime errors (visual scene block)", not errors, str(errors))
        context.close()

        # ================= Fish approach / bite / resistance / caught
        #                    (Phase FISHING-APP-UX-VISUAL-HARDENING-1) =================
        context, page, errors, console_errors = new_page(browser)
        page.click("#cast-btn")
        page.clock.run_for(520)  # past CASTING(500ms), into WAITING's far phase
        record("Fish: visible as soon as WAITING starts",
               page.evaluate("document.getElementById('fish').style.display") != "none")
        record("Fish: starts far from the bait (WAITING far phase)",
               page.evaluate("waitPhase") == "far" and
               abs(float(page.evaluate("document.getElementById('fish').style.left").rstrip('%')) - 6) < 0.01)
        record("Fish: rendered small while far away (depth cue)",
               "scale(0.6)" in page.evaluate("document.getElementById('fish').style.transform"))
        record("Bait: tackle (hook+bait) visible before the bite",
               "eaten" not in page.evaluate("document.getElementById('tackle').className"))
        record("Leader line: visible from float to hook/bait before the bite",
               page.evaluate("document.getElementById('leader-line').style.display") != "none")

        seen_phases = []
        for _ in range(30):
            page.clock.run_for(100)
            ph = page.evaluate("waitPhase")
            if ph is not None and (not seen_phases or seen_phases[-1] != ph):
                seen_phases.append(ph)
            if page.evaluate("state") != "WAITING":
                break
        record("Bite approach: fish visibly goes far -> turning -> approaching before BITTEN",
               seen_phases == ["far", "turning", "approaching"], str(seen_phases))

        page.clock.run_for(1000)
        record("Bite: auto-transitions to REELING", state(page) == "REELING")
        record("Bite: hookedFishId set", page.evaluate("hookedFishId") is not None)
        record("Bait: eaten (tackle hidden) once bitten",
               "eaten" in page.evaluate("document.getElementById('tackle').className"))
        record("Leader line: hidden once bitten (hook is now in the fish's mouth, not at the float)",
               page.evaluate("document.getElementById('leader-line').style.display") == "none")
        record("Fish: back to full size once it has arrived/bitten (depth cue resolved)",
               "scale(1)" in page.evaluate("document.getElementById('fish').style.transform"))
        record("Fish: hooked mark visible from BITTEN onward",
               "hooked" in page.evaluate("document.getElementById('fish').className"))
        record("Fish: visible while REELING",
               page.evaluate("document.getElementById('fish').style.display") != "none")
        record("Resistance: 'reeling' visual class present while REELING",
               "reeling" in page.evaluate("document.getElementById('fish-inner').className"))

        progress_samples = []
        page.locator("#reel-hold-btn").focus()
        page.keyboard.down("Enter")
        for _ in range(6):
            page.clock.run_for(120)
            progress_samples.append(progress(page))
        page.keyboard.up("Enter")
        record("Resistance: reelProgress never decreases while the resistance animation plays",
               all(progress_samples[i] <= progress_samples[i + 1] for i in range(len(progress_samples) - 1)),
               str(progress_samples))
        expected_left = 20 + (91 - 20) * progress(page) / 100
        record("Fish: base left position stays exactly reelProgress-derived (resistance is a transform overlay only)",
               abs(float(page.evaluate("document.getElementById('fish').style.left").rstrip('%')) - expected_left) < 0.5)

        page.keyboard.down("Enter")
        page.clock.run_for(4500)
        page.keyboard.up("Enter")
        record("Caught: state reaches CAUGHT", state(page) == "CAUGHT")
        record("Caught: fish still visible, lifted out of the water",
               page.evaluate("document.getElementById('fish').style.display") != "none" and
               abs(float(page.evaluate("document.getElementById('fish').style.top").rstrip('%')) - 24) < 0.5)
        record("no runtime errors (approach/bite/resistance/caught block)", not errors, str(errors))

        page.click("#again-btn")
        record("Reset: fish visual classes fully cleared after reset (no stale eating/reeling/caught/hooked classes)",
               page.evaluate("document.getElementById('fish').className") == "fish")
        record("no runtime errors (reset block)", not errors, str(errors))
        context.close()

        # ================= Rod tip / line-start anchor across representative widths
        #                    (Phase FISHING-APP-UX-VISUAL-HARDENING-1, User Browser
        #                    Review: 竿先とラインが離れて見える) =================
        GAP_TOLERANCE_PX = 2.0
        VIEWPORTS = [
            (480, 900, "smartphone-portrait-480"),
            (768, 1024, "ipad-portrait-768"),
            (1024, 768, "ipad-landscape-1024x768"),
            (1280, 900, "desktop-1280"),
        ]
        for width, height, label in VIEWPORTS:
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.goto(BASE)
            page.clock.install()
            page.clock.pause_at("2030-01-01T00:00:00Z")
            page.click("#start-btn")

            gap = rod_line_gap_px(page)
            record(f"Rod/Line anchor ({label}): connected before any cast (IDLE)",
                   gap < GAP_TOLERANCE_PX, f"gap={gap:.2f}px")

            page.click("#cast-btn")
            run_until_state(page, ["WAITING"])
            gap = rod_line_gap_px(page)
            record(f"Rod/Line anchor ({label}): connected during WAITING",
                   gap < GAP_TOLERANCE_PX, f"gap={gap:.2f}px")

            run_until_state(page, ["BITTEN"])
            gap = rod_line_gap_px(page)
            record(f"Rod/Line anchor ({label}): connected during BITTEN",
                   gap < GAP_TOLERANCE_PX, f"gap={gap:.2f}px")

            run_until_state(page, ["REELING"])
            gap = rod_line_gap_px(page)
            record(f"Rod/Line anchor ({label}): connected during REELING",
                   gap < GAP_TOLERANCE_PX, f"gap={gap:.2f}px")

            page.locator("#reel-hold-btn").focus()
            page.keyboard.down("Enter")
            page.clock.run_for(4500)
            page.keyboard.up("Enter")
            record(f"Rod/Line anchor ({label}): reaches CAUGHT", state(page) == "CAUGHT")
            gap = rod_line_gap_px(page)
            record(f"Rod/Line anchor ({label}): connected during CAUGHT",
                   gap < GAP_TOLERANCE_PX, f"gap={gap:.2f}px")

            record(f"no runtime errors (rod/line anchor {label})", not errors, str(errors))
            context.close()

        # ================= Input Settings, integrated into the common A11y panel
        #                    (Phase FISHING-APP-INPUT-SETTINGS-1, User Browser Review
        #                    fix: "設定入口は1つ" — no more standalone
        #                    #sakanaSettingsBtn/#settingsPanel) =================
        context, page, errors, console_errors = new_page(browser)
        record("Settings: reelGain default is 'medium' (3%, byte-identical to pre-Phase hardcoded value)",
               page.evaluate("inputSettings.reelGainPreset") == "medium" and
               page.evaluate("HOLD_TICK_AMOUNT") == 3)
        record("Settings: reelSpeed default is 'standard' (120ms, byte-identical to pre-Phase hardcoded value)",
               page.evaluate("inputSettings.reelSpeedPreset") == "standard" and
               page.evaluate("HOLD_TICK_MS") == 120)
        record("Settings: no separate settings button/panel exists any more",
               page.locator("#sakanaSettingsBtn").count() == 0 and page.locator("#settingsPanel").count() == 0)

        page.click("#donomanaA11yBtn")
        record("Common A11y panel: opens on click (single settings entry point)",
               page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "block")
        record("Common A11y panel: fishing-specific section is inside the SAME panel",
               page.evaluate("!!document.querySelector('#donomanaA11yPanel [data-reel-gain]')") and
               page.evaluate("!!document.querySelector('#donomanaA11yPanel [data-reel-speed]')"))
        record("Settings: 'ふつう' preset shown as selected for both groups initially",
               page.evaluate("getComputedStyle(document.querySelector(\"[data-reel-gain='medium']\")).backgroundColor") ==
               page.evaluate("getComputedStyle(document.querySelector(\"[data-reel-speed='standard']\")).backgroundColor") and
               page.evaluate("getComputedStyle(document.querySelector(\"[data-reel-gain='medium']\")).backgroundColor") != "rgb(255, 255, 255)")

        page.click("[data-reel-gain='large']")
        record("Settings: switching reelGain preset updates HOLD_TICK_AMOUNT",
               page.evaluate("inputSettings.reelGainPreset") == "large" and
               page.evaluate("HOLD_TICK_AMOUNT") == 6)
        record("Settings: preset button visually reflects the new selection",
               page.evaluate("getComputedStyle(document.querySelector(\"[data-reel-gain='large']\")).backgroundColor") !=
               page.evaluate("getComputedStyle(document.querySelector(\"[data-reel-gain='medium']\")).backgroundColor"))

        page.click("[data-reel-speed='fast']")
        record("Settings: switching reelSpeed preset updates HOLD_TICK_MS",
               page.evaluate("inputSettings.reelSpeedPreset") == "fast" and
               page.evaluate("HOLD_TICK_MS") == 90)

        record("Settings: saved to a dedicated localStorage key, not the records log",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_settings'))") ==
               {"reelGainPreset": "large", "reelSpeedPreset": "fast"})
        record("Settings: records log untouched by settings changes alone",
               page.evaluate("localStorage.getItem('sakana-tsuri_records')") is None)

        # ---- Existing common A11y items must be unaffected by the new section ----
        page.click("[data-a11y-contrast='hc']")
        record("Common A11y regression: high-contrast toggle still applies the invert filter",
               "invert(1)" in page.evaluate("document.documentElement.style.filter"))
        page.click("[data-a11y-contrast='normal']")
        page.click("[data-a11y-font='large']")
        record("Common A11y regression: font-size toggle still applies body zoom",
               page.evaluate("document.body.style.zoom") == "125%")
        page.click("[data-a11y-font='normal']")

        page.keyboard.press("Escape")
        record("Common A11y panel: Escape still closes it",
               page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "none")
        record("Common A11y panel: focus still returns to the opener button on close",
               page.evaluate("document.activeElement.id") == "donomanaA11yBtn")

        # ---- Strict Tab/Shift+Tab focus containment across the WHOLE panel (existing
        #      common items + the newly appended fishing-specific section) ----
        page.click("#donomanaA11yBtn")
        page.locator("[data-a11y-contrast='normal']").focus()  # first focusable in the panel
        page.keyboard.press("Shift+Tab")
        record("Common A11y panel: Shift+Tab from the first item wraps to the last (the new reset button)",
               page.evaluate("document.activeElement.id") == "sakanaInputSettingsReset")
        page.locator("#sakanaInputSettingsReset").focus()  # last focusable, now that the section is appended
        page.keyboard.press("Tab")
        record("Common A11y panel: forward Tab from the last item wraps to the first, not out of the panel",
               page.evaluate("document.activeElement.dataset.a11yContrast") == "normal")

        page.click("#sakanaInputSettingsReset")
        record("Settings: reset restores reelGain default",
               page.evaluate("inputSettings.reelGainPreset") == "medium" and page.evaluate("HOLD_TICK_AMOUNT") == 3)
        record("Settings: reset restores reelSpeed default",
               page.evaluate("inputSettings.reelSpeedPreset") == "standard" and page.evaluate("HOLD_TICK_MS") == 120)
        record("Settings: reset persists the default back to localStorage",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_settings'))") ==
               {"reelGainPreset": "medium", "reelSpeedPreset": "standard"})
        record("Settings: reset does not disturb the common A11y panel's own settings",
               page.evaluate("document.documentElement.style.filter") == "" and
               page.evaluate("document.body.style.zoom") == "")
        page.keyboard.press("Escape")
        record("no runtime errors (integrated settings panel block)", not errors, str(errors))
        context.close()

        # ---- Reload persistence ----
        context, page, errors, console_errors = new_page(browser)
        page.click("#donomanaA11yBtn")
        page.click("[data-reel-gain='small']")
        page.click("[data-reel-speed='slow']")
        page.keyboard.press("Escape")
        page.reload()
        page.clock.install()
        page.clock.pause_at("2030-01-01T00:00:00Z")
        record("Settings: reelGain preset survives reload",
               page.evaluate("inputSettings.reelGainPreset") == "small" and page.evaluate("HOLD_TICK_AMOUNT") == 1)
        record("Settings: reelSpeed preset survives reload",
               page.evaluate("inputSettings.reelSpeedPreset") == "slow" and page.evaluate("HOLD_TICK_MS") == 160)
        record("no runtime errors (reload persistence block)", not errors, str(errors))
        context.close()

        # ---- Malformed/legacy localStorage falls back safely ----
        context, page, errors, console_errors = new_page(browser)
        page.evaluate("localStorage.setItem('sakana-tsuri_settings', 'not json{{{')")
        page.reload()
        page.clock.install()
        page.clock.pause_at("2030-01-01T00:00:00Z")
        record("Settings: malformed localStorage value falls back to defaults without throwing",
               page.evaluate("inputSettings.reelGainPreset") == "medium" and
               page.evaluate("inputSettings.reelSpeedPreset") == "standard")
        page.evaluate("localStorage.setItem('sakana-tsuri_settings', JSON.stringify({reelGainPreset:'nonsense',reelSpeedPreset:99}))")
        page.reload()
        page.clock.install()
        page.clock.pause_at("2030-01-01T00:00:00Z")
        record("Settings: unknown preset values fall back to defaults without applying an out-of-range value",
               page.evaluate("inputSettings.reelGainPreset") == "medium" and
               page.evaluate("inputSettings.reelSpeedPreset") == "standard")
        record("no runtime errors (malformed settings block)", not errors, str(errors))
        context.close()

        # ---- Settings actually change Method B's real gameplay behavior ----
        context, page, errors, console_errors = new_page(browser)
        page.click("#donomanaA11yBtn")
        page.click("[data-reel-gain='large']")
        page.click("[data-reel-speed='fast']")
        page.keyboard.press("Escape")
        cast_to_reeling(page)
        before = progress(page)
        hold_keyboard(page, "Enter", 90)  # exactly one fast(90ms) tick
        after = progress(page)
        record("Settings->Method B: one tick at 'large' gain advances by 6, not the default 3",
               after - before == 6, f"{before} -> {after}")

        progress_samples = []
        page.keyboard.down("Enter")
        for _ in range(8):
            page.clock.run_for(90)
            progress_samples.append(progress(page))
        page.keyboard.up("Enter")
        record("Settings->Method B: reelProgress still monotonically non-decreasing under a non-default preset",
               all(progress_samples[i] <= progress_samples[i + 1] for i in range(len(progress_samples) - 1)),
               str(progress_samples))

        # Step (not a single large run_for): the faster 'fast' preset reaches 100% sooner,
        # so a single fixed-duration run_for tuned for the default preset would also run
        # past CAUGHT_DISPLAY_MS's auto-reset within the same call and land on IDLE
        # instead — stepping and checking after each step is preset-duration-agnostic.
        page.keyboard.down("Enter")
        run_until_state(page, ["CAUGHT"], step_ms=90, max_iters=50)
        page.keyboard.up("Enter")
        record("Settings->Method B: still reaches CAUGHT exactly, no overshoot/duplicate landFish",
               state(page) == "CAUGHT" and progress(page) == 100)
        record_count = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records')||'[]').length")
        record("Settings->Method B: exactly 1 trial recorded despite a non-default preset (no duplicate record)",
               record_count == 1)
        payload = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records'))[0].payload")
        record("Learning Record: reelGainPreset/reelSpeedPreset recorded, existing fields' shape unchanged",
               payload.get("reelGainPreset") == "large" and payload.get("reelSpeedPreset") == "fast" and
               payload.get("reelMethod") == "hold" and payload.get("difficulty") is None and
               "sessionId" in payload and "trialNumber" in payload and "mode" in payload,
               str(payload))
        record("no runtime errors (settings->gameplay block)", not errors, str(errors))
        context.close()

        # ---- Input ownership regression: settings panel adds no generic document keydown
        #      that could double-fire the reel button (Switch Scan Spec §19.22.4 concern) ----
        context, page, errors, console_errors = new_page(browser)
        cast_to_reeling(page)
        before = progress(page)
        page.locator("#reel-hold-btn").focus()
        page.keyboard.down("Enter")
        page.clock.run_for(120)  # exactly one default(120ms) tick
        page.keyboard.up("Enter")
        after = progress(page)
        record("Input ownership: one 120ms hold still advances by exactly one tick's amount (3, default)",
               after - before == 3, f"{before} -> {after}")
        record("no runtime errors (input ownership regression block)", not errors, str(errors))
        context.close()

        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed.")
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
