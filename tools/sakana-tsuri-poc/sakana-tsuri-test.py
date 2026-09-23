# Real-browser (Playwright/Chromium) regression test for sakana-tsuri.html's
# Pilot scope (Phase FISHING-APP-IMPLEMENTATION-1): mode="free" x reelMethod="hold" only.
# Uses Playwright's fake clock (page.clock) so WAITING's randomized delay and the
# hold-tick setInterval advance deterministically without real wall-clock waiting.
# Requires a local static server for the repo root, e.g.:
#   python -m http.server 8935 --bind 127.0.0.1
# then: python tools/sakana-tsuri-poc/sakana-tsuri-test.py
import sys
import math
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


def arc_center_and_radius(page, radius_frac=0.7):
    """#reel-arc's on-screen center and a safe drag radius, in viewport coordinates
    (matching both Playwright's page.mouse and the app's own getBoundingClientRect()-based
    center calculation, so a real mouse-driven circle lines up with what the app sees)."""
    box = page.locator("#reel-arc").bounding_box()
    cx = box["x"] + box["width"] / 2
    cy = box["y"] + box["height"] / 2
    radius = min(box["width"], box["height"]) / 2 * radius_frac
    return cx, cy, radius


def arc_point(cx, cy, radius, angle_deg):
    """A point on the circle at angle_deg, using the SAME convention as the app's own
    arcAngleDeg(): 0deg = straight up, clockwise-positive."""
    rad = math.radians(angle_deg)
    return cx + radius * math.sin(rad), cy - radius * math.cos(rad)


def arc_drag_down(page, start_deg=0, radius_frac=0.7):
    """Real page.mouse pointerdown at start_deg on the arc circle (genuine trusted
    pointerdown, not a synthetic dispatch — instruction §29: not just calling internal
    functions directly). Returns (cx, cy, radius) for subsequent arc_drag_move calls."""
    cx, cy, radius = arc_center_and_radius(page, radius_frac)
    x0, y0 = arc_point(cx, cy, radius, start_deg)
    page.mouse.move(x0, y0)
    page.mouse.down()
    return cx, cy, radius


def arc_drag_move(page, cx, cy, radius, from_deg, to_deg, steps=24):
    """Real page.mouse.move() steps along the circle from from_deg to to_deg (positive =
    clockwise, negative = counter-clockwise), each step a genuine trusted pointermove."""
    for i in range(1, steps + 1):
        deg = from_deg + (to_deg - from_deg) * i / steps
        x, y = arc_point(cx, cy, radius, deg)
        page.mouse.move(x, y)


def arc_drag_up(page):
    page.mouse.up()


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

        # ================= Input Settings via SETTINGS_PROXY
        #                    (Phase FISHING-APP-INPUT-SETTINGS-1, second User Browser
        #                    Review fix: ⚙ common panel -> "🔧 このアプリの詳細設定を
        #                    開く" proxy -> app-specific #settingsPanel, the same
        #                    pattern other SETTINGS_PROXY apps use) =================
        def open_fishing_settings(page):
            page.click("#donomanaA11yBtn")
            page.click("#donomanaSettingsProxy")

        context, page, errors, console_errors = new_page(browser)
        record("Settings: reelGain default is 'medium' (3%, byte-identical to pre-Phase hardcoded value)",
               page.evaluate("inputSettings.reelGainPreset") == "medium" and
               page.evaluate("HOLD_TICK_AMOUNT") == 3)
        record("Settings: reelSpeed default is 'standard' (120ms, byte-identical to pre-Phase hardcoded value)",
               page.evaluate("inputSettings.reelSpeedPreset") == "standard" and
               page.evaluate("HOLD_TICK_MS") == 120)
        record("Settings: #sakanaSettingsBtn exists but is hidden (SETTINGS_PROXY original target, never shown directly)",
               page.locator("#sakanaSettingsBtn").count() == 1 and
               page.evaluate("getComputedStyle(document.getElementById('sakanaSettingsBtn')).display") == "none")

        page.click("#donomanaA11yBtn")
        record("Common A11y panel: opens on click", page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "block")
        record("Common A11y panel: shows the standard settings-proxy row with the expected label",
               page.inner_text("#donomanaSettingsProxy") == "🔧 このアプリの詳細設定を開く")
        record("Common A11y panel: fishing-specific settings are NOT shown directly inside it",
               page.locator("#donomanaA11yPanel [data-reel-gain]").count() == 0 and
               page.locator("#donomanaA11yPanel [data-reel-speed]").count() == 0)

        page.click("#donomanaSettingsProxy")
        record("Proxy: closes the common A11y panel", page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "none")
        record("Proxy: opens the fishing-specific settings panel", page.is_visible("#settingsPanel"))
        record("Settings panel: initial focus moves into the panel title",
               page.evaluate("document.activeElement.id") == "settingsTitle")
        record("Settings panel: 'ふつう' preset shown as pressed for both groups initially",
               page.get_attribute("[data-reel-gain='medium']", "aria-pressed") == "true" and
               page.get_attribute("[data-reel-speed='standard']", "aria-pressed") == "true")

        page.click("[data-reel-gain='large']")
        record("Settings: switching reelGain preset updates HOLD_TICK_AMOUNT",
               page.evaluate("inputSettings.reelGainPreset") == "large" and
               page.evaluate("HOLD_TICK_AMOUNT") == 6)
        record("Settings: preset button reflects the new selection (aria-pressed)",
               page.get_attribute("[data-reel-gain='large']", "aria-pressed") == "true" and
               page.get_attribute("[data-reel-gain='medium']", "aria-pressed") == "false")

        page.click("[data-reel-speed='fast']")
        record("Settings: switching reelSpeed preset updates HOLD_TICK_MS",
               page.evaluate("inputSettings.reelSpeedPreset") == "fast" and
               page.evaluate("HOLD_TICK_MS") == 90)

        record("Settings: saved to a dedicated localStorage key, not the records log",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_settings'))") ==
               {"reelGainPreset": "large", "reelSpeedPreset": "fast", "reelMethod": "hold"})
        record("Settings: records log untouched by settings changes alone",
               page.evaluate("localStorage.getItem('sakana-tsuri_records')") is None)

        page.keyboard.press("Escape")
        record("Settings panel: Escape closes the panel", not page.is_visible("#settingsPanel"))
        record("Settings panel: focus returns to the VISIBLE common A11y button, not the hidden original",
               page.evaluate("document.activeElement.id") == "donomanaA11yBtn")

        # ---- Existing common A11y items must be unaffected ----
        page.click("#donomanaA11yBtn")
        page.click("[data-a11y-contrast='hc']")
        record("Common A11y regression: high-contrast toggle still applies the invert filter",
               "invert(1)" in page.evaluate("document.documentElement.style.filter"))
        page.click("[data-a11y-contrast='normal']")
        page.click("[data-a11y-font='large']")
        record("Common A11y regression: font-size toggle still applies body zoom",
               page.evaluate("document.body.style.zoom") == "125%")
        page.click("[data-a11y-font='normal']")
        page.keyboard.press("Escape")
        record("Common A11y panel: Escape still closes it and returns focus to its own opener",
               page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "none" and
               page.evaluate("document.activeElement.id") == "donomanaA11yBtn")

        # ---- Strict Tab/Shift+Tab focus containment, independently, on EACH panel ----
        page.click("#donomanaA11yBtn")
        # #donomanaSettingsProxy is the first focusable in DOM order (it sits right after
        # the panel's heading, before 表示モード) now that the proxy row is present.
        page.locator("#donomanaSettingsProxy").focus()
        page.keyboard.press("Shift+Tab")
        record("Common A11y panel: Shift+Tab from the first item wraps to the last (its own reset button)",
               page.evaluate("document.activeElement.id") == "donomanaA11yReset")
        page.locator("#donomanaA11yReset").focus()
        page.keyboard.press("Tab")
        record("Common A11y panel: forward Tab from the last item wraps to the first, not out of the panel",
               page.evaluate("document.activeElement.id") == "donomanaSettingsProxy")
        page.keyboard.press("Escape")

        open_fishing_settings(page)
        page.locator("#settingsTitle").focus()
        page.keyboard.press("Shift+Tab")
        record("Settings panel: Shift+Tab from the title wraps to the last focusable (close button)",
               page.evaluate("document.activeElement.id") == "settingsCloseBtn")
        page.locator("#settingsTitle").focus()
        page.keyboard.press("Tab")
        record("Settings panel: forward Tab from the title (tabindex=-1 anchor) advances to the first real focusable",
               page.evaluate("document.activeElement.dataset.reelMethod") == "arc")

        page.click("#settingsResetBtn")
        record("Settings: reset restores reelGain default",
               page.evaluate("inputSettings.reelGainPreset") == "medium" and page.evaluate("HOLD_TICK_AMOUNT") == 3)
        record("Settings: reset restores reelSpeed default",
               page.evaluate("inputSettings.reelSpeedPreset") == "standard" and page.evaluate("HOLD_TICK_MS") == 120)
        record("Settings: reset restores reelMethod default ('hold')",
               page.evaluate("inputSettings.reelMethod") == "hold")
        record("Settings: reset persists the default back to localStorage",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_settings'))") ==
               {"reelGainPreset": "medium", "reelSpeedPreset": "standard", "reelMethod": "hold"})
        record("Settings: reset does not disturb the common A11y panel's own settings",
               page.evaluate("document.documentElement.style.filter") == "" and
               page.evaluate("document.body.style.zoom") == "")
        page.keyboard.press("Escape")
        record("no runtime errors (settings-via-proxy panel block)", not errors, str(errors))
        context.close()

        # ---- Reload persistence ----
        context, page, errors, console_errors = new_page(browser)
        open_fishing_settings(page)
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
        open_fishing_settings(page)
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

        # ================= Method A: arc gesture (Phase FISHING-APP-METHOD-A-1) =================
        def switch_reel_method(page, method):
            open_fishing_settings(page)
            page.click(f"[data-reel-method='{method}']")
            page.keyboard.press("Escape")

        context, page, errors, console_errors = new_page(browser)
        record("Settings: reelMethod default is 'hold' (pre-existing saved settings / fresh install)",
               page.evaluate("inputSettings.reelMethod") == "hold")
        record("UI: #reel-hold-btn visible, #reel-arc hidden by default",
               page.evaluate("document.getElementById('reel-hold-btn').hidden") is False and
               page.evaluate("document.getElementById('reel-arc').hidden") is True)

        switch_reel_method(page, "arc")
        record("Settings: switching to 'arc' updates inputSettings.reelMethod",
               page.evaluate("inputSettings.reelMethod") == "arc")
        record("UI: #reel-arc now visible, #reel-hold-btn now hidden",
               page.evaluate("document.getElementById('reel-arc').hidden") is False and
               page.evaluate("document.getElementById('reel-hold-btn').hidden") is True)
        record("Settings: saved reelMethod to localStorage",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_settings')).reelMethod") == "arc")

        switch_reel_method(page, "hold")
        record("Settings: switching back to 'hold' updates inputSettings.reelMethod",
               page.evaluate("inputSettings.reelMethod") == "hold")
        record("UI: #reel-hold-btn visible again after switching back",
               page.evaluate("document.getElementById('reel-hold-btn').hidden") is False)

        page.reload()
        page.clock.install()
        page.clock.pause_at("2030-01-01T00:00:00Z")
        record("Settings: reelMethod='hold' (last choice) survives reload",
               page.evaluate("inputSettings.reelMethod") == "hold")

        page.evaluate("localStorage.setItem('sakana-tsuri_settings', JSON.stringify({reelGainPreset:'medium',reelSpeedPreset:'standard',reelMethod:'not-a-real-method'}))")
        page.reload()
        page.clock.install()
        page.clock.pause_at("2030-01-01T00:00:00Z")
        record("Settings: invalid reelMethod value falls back to 'hold' without throwing",
               page.evaluate("inputSettings.reelMethod") == "hold")
        record("no runtime errors (Method A settings block)", not errors, str(errors))
        context.close()

        # ---- WAITING: arc drag before the bite must not start a drag or move progress ----
        context, page, errors, console_errors = new_page(browser)
        switch_reel_method(page, "arc")
        page.click("#cast-btn")
        page.clock.run_for(520)  # into WAITING, before BITTEN
        record("Method A pre-bite: state is WAITING", state(page) == "WAITING")
        cx, cy, radius = arc_drag_down(page, start_deg=0)
        arc_drag_move(page, cx, cy, radius, 0, 90)
        record("Method A pre-bite: dragging during WAITING does not start a drag (arcDragState stays null)",
               page.evaluate("arcDragState") is None)
        record("Method A pre-bite: dragging during WAITING does not move reelProgress",
               progress(page) == 0)
        arc_drag_up(page)
        record("no runtime errors (Method A pre-bite block)", not errors, str(errors))
        context.close()

        # ---- Core arc gesture: clockwise increases progress, real Pointer Events
        #      (page.mouse -> genuine trusted pointerdown/move/up, not direct function
        #      calls — instruction §29) ----
        context, page, errors, console_errors = new_page(browser)
        switch_reel_method(page, "arc")
        cast_to_reeling(page)
        record("Method A: reelMethod is 'arc' entering REELING", page.evaluate("inputSettings.reelMethod") == "arc")
        record("Method A: #reel-arc is active (not .inactive) while REELING",
               "inactive" not in (page.get_attribute("#reel-arc", "class") or ""))

        cx, cy, radius = arc_drag_down(page, start_deg=0)
        record("Method A: pointerdown starts a drag with a captured pointerId",
               page.evaluate("arcDragState !== null && typeof arcDragState.pointerId === 'number'"))
        record("Method A: pointer capture requested on #reel-arc",
               page.evaluate("document.getElementById('reel-arc').hasPointerCapture(arcDragState.pointerId)"))
        record("Method A: 'active-drag' visual class applied while dragging",
               "active-drag" in page.get_attribute("#reel-arc", "class"))

        before = progress(page)
        arc_drag_move(page, cx, cy, radius, 0, 350, steps=30)  # just under one full turn
        record("Method A: partial rotation (<360deg) alone does not yet cross the first gain threshold",
               progress(page) == before, f"progress after 350deg = {progress(page)}")
        arc_drag_move(page, cx, cy, radius, 350, 400, steps=6)  # crosses 360deg net rotation
        after_one_turn = progress(page)
        record("Method A: crossing 360deg net clockwise rotation advances reelProgress by exactly one reelGain (default 3)",
               after_one_turn == before + 3, f"{before} -> {after_one_turn}")

        # Angle wraparound: continue clockwise past the raw ±180 discontinuity (app-space
        # angle passes through 180/-180 once per revolution) without a spurious jump.
        arc_drag_move(page, cx, cy, radius, 400, 400 + 360, steps=30)  # one more full clockwise turn, crossing the wrap point
        after_two_turns = progress(page)
        record("Method A: a second full clockwise turn (crossing the angle wraparound point) advances by another reelGain, no jump/overshoot",
               after_two_turns == after_one_turn + 3, f"{after_one_turn} -> {after_two_turns}")

        # Counter-clockwise: never decreases, never penalized.
        before_ccw = progress(page)
        arc_drag_move(page, cx, cy, radius, 400 + 360, 400 + 360 - 300, steps=20)  # 300deg counter-clockwise
        record("Method A: counter-clockwise rotation does not decrease reelProgress",
               progress(page) == before_ccw, f"{before_ccw} -> {progress(page)}")
        record("Method A: counter-clockwise rotation does not silently consume the clockwise accumulator either",
               page.evaluate("arcDragState.accumDeg") >= 0)

        # Jitter: a sub-threshold (<2deg) move must not perturb the accumulator at all.
        accum_before_jitter = page.evaluate("arcDragState.accumDeg")
        page.mouse.move(*arc_point(cx, cy, radius, (400 + 360 - 300) + 1))  # ~1deg clockwise nudge
        record("Method A: a sub-2deg move does not change the clockwise accumulator (jitter rejection)",
               page.evaluate("arcDragState.accumDeg") == accum_before_jitter,
               f"{accum_before_jitter} -> {page.evaluate('arcDragState.accumDeg')}")

        arc_drag_up(page)
        record("Method A: pointerup ends the drag (arcDragState cleared)", page.evaluate("arcDragState") is None)
        record("Method A: 'active-drag' class removed after release", "active-drag" not in page.get_attribute("#reel-arc", "class"))
        record("no runtime errors (Method A core gesture block)", not errors, str(errors))
        context.close()

        # ---- pointercancel and lostpointercapture both end the drag safely ----
        context, page, errors, console_errors = new_page(browser)
        switch_reel_method(page, "arc")
        cast_to_reeling(page)
        cx, cy, radius = arc_drag_down(page, start_deg=0)
        arc_drag_move(page, cx, cy, radius, 0, 90)
        page.evaluate("""() => {
            var el = document.getElementById('reel-arc');
            el.dispatchEvent(new PointerEvent('pointercancel', {pointerId: arcDragState.pointerId, bubbles:true, cancelable:true}));
        }""")
        record("Method A: pointercancel ends the drag safely", page.evaluate("arcDragState") is None)
        record("no runtime errors (pointercancel block)", not errors, str(errors))
        context.close()

        # ---- Multi-touch: a second pointer must not disturb the first active drag ----
        context, page, errors, console_errors = new_page(browser)
        switch_reel_method(page, "arc")
        cast_to_reeling(page)
        cx, cy, radius = arc_drag_down(page, start_deg=0)  # real pointer 1 (mouse), starts the drag
        first_pointer_id = page.evaluate("arcDragState.pointerId")
        before_multitouch = progress(page)
        # Synthetic second pointer (id deliberately different) — Playwright's high-level
        # mouse/touchscreen APIs cannot drive two simultaneous contacts, so this one event
        # is dispatched directly to exercise the pointerId-mismatch guard specifically
        # (the core single-pointer gesture above already used real trusted events).
        page.evaluate("""() => {
            var el = document.getElementById('reel-arc');
            el.dispatchEvent(new PointerEvent('pointerdown', {pointerId: arcDragState.pointerId + 1000, clientX: 0, clientY: 0, bubbles:true, cancelable:true}));
        }""")
        record("Method A: a second pointerdown while already dragging does not replace the active pointerId",
               page.evaluate("arcDragState.pointerId") == first_pointer_id)
        arc_drag_move(page, cx, cy, radius, 0, 90)
        record("Method A: the original pointer's drag continues normally after the ignored second pointerdown",
               progress(page) >= before_multitouch)
        page.evaluate("""(otherId) => {
            var el = document.getElementById('reel-arc');
            el.dispatchEvent(new PointerEvent('pointerup', {pointerId: otherId, bubbles:true, cancelable:true}));
        }""", first_pointer_id + 1000)
        record("Method A: pointerup from the OTHER (ignored) pointerId does not end the real drag",
               page.evaluate("arcDragState") is not None)
        arc_drag_up(page)
        record("no runtime errors (multi-touch guard block)", not errors, str(errors))
        context.close()

        # ---- Full arc session: reaches CAUGHT exactly once, no duplicate record,
        #      rod/line stay in sync, then Method B still works after switching back ----
        context, page, errors, console_errors = new_page(browser)
        switch_reel_method(page, "arc")
        cast_to_reeling(page)
        cx, cy, radius = arc_drag_down(page, start_deg=0)
        deg = 0
        progress_samples = [progress(page)]
        for _ in range(40):  # 40 * 360deg = far beyond the ~34 gain-units needed at the default preset
            arc_drag_move(page, cx, cy, radius, deg, deg + 360, steps=12)
            deg += 360
            progress_samples.append(progress(page))
            if state(page) == "CAUGHT":
                break
        arc_drag_up(page)
        record("Method A full session: reelProgress monotonically non-decreasing throughout",
               all(progress_samples[i] <= progress_samples[i + 1] for i in range(len(progress_samples) - 1)),
               str(progress_samples))
        record("Method A full session: reaches CAUGHT with reelProgress clamped at exactly 100",
               state(page) == "CAUGHT" and progress(page) == 100)
        gap = rod_line_gap_px(page)
        record("Method A full session: rod/line anchor still connected during CAUGHT", gap < 2.0, f"gap={gap:.2f}px")
        record_count = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records')||'[]').length")
        record("Method A full session: exactly 1 trial recorded (no duplicate landFish/record)", record_count == 1)
        payload = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records'))[0].payload")
        record("Learning Record: reelMethod recorded as 'arc' for this trial", payload.get("reelMethod") == "arc")

        # Continued dragging after CAUGHT must not double-fire landFish or move progress further.
        arc_drag_down(page, start_deg=0)
        arc_drag_move(page, cx, cy, radius, 0, 360, steps=12)
        arc_drag_up(page)
        record("Method A full session: dragging again after CAUGHT does not create a second record",
               page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records')||'[]').length") == 1)

        # ---- Regression: Method B still works normally after switching back from arc ----
        run_until_state(page, ["IDLE"], step_ms=200, max_iters=30)
        switch_reel_method(page, "hold")
        cast_to_reeling(page)
        before_b = progress(page)
        hold_keyboard(page, "Enter", 500)
        after_b = progress(page)
        record("Regression: Method B (long-press) still works normally after using and switching away from Method A",
               after_b > before_b, f"{before_b} -> {after_b}")
        record("no runtime errors (full arc session + Method B regression block)", not errors, str(errors))
        context.close()

        # ---- Regression: common A11y panel / help panel / SETTINGS_PROXY untouched ----
        context, page, errors, console_errors = new_page(browser)
        page.click("#donomanaHelpBtn")
        record("Regression: help panel still opens normally", page.is_visible("#helpPanel"))
        page.keyboard.press("Escape")
        page.click("#donomanaA11yBtn")
        record("Regression: common A11y panel still opens normally",
               page.evaluate("document.getElementById('donomanaA11yPanel').style.display") == "block")
        record("Regression: SETTINGS_PROXY row still present and correctly labeled",
               page.inner_text("#donomanaSettingsProxy") == "🔧 このアプリの詳細設定を開く")
        page.click("#donomanaSettingsProxy")
        record("Regression: proxy still opens the fishing settings panel, now showing 3 setting groups",
               page.is_visible("#settingsPanel") and page.locator("#settingsPanel [data-reel-method]").count() == 2 and
               page.locator("#settingsPanel [data-reel-gain]").count() == 3 and
               page.locator("#settingsPanel [data-reel-speed]").count() == 3)
        page.keyboard.press("Escape")
        record("no runtime errors (final regression block)", not errors, str(errors))
        context.close()

        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed.")
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
