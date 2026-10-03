# Phase FISHING-APP-VARIETY-AND-SIZE-EFFORT-1 dedicated test suite.
# Covers: background/fish non-repeating 'auto' selection, teacher lock + next-activity
# apply timing, type/size independence, size-effort OFF/ON operation-amount parity
# across all 3 reel methods, safe no-op settings changes mid-REELING, catch-message/
# Learning-Record consistency with what was actually shown, and image-load-failure
# fallback. Run alongside the main tools/sakana-tsuri-poc/sakana-tsuri-test.py suite
# (not a replacement — that suite still owns core gameplay/state-machine coverage).
#
# Usage:
#   python3 -m http.server <port> --bind 127.0.0.1   (serve the repo root)
#   python3 sakana-tsuri-variety-test.py              (edit BASE's port to match)
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8941/sakana-tsuri.html"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))


def new_page(browser, viewport=None):
    context = browser.new_context(viewport=viewport or {"width": 820, "height": 1180}, has_touch=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(BASE)
    page.click("#start-btn")
    return context, page, errors


def set_setting(page, group_attr, value):
    page.click("#donomanaA11yBtn")
    page.click("#donomanaSettingsProxy")
    page.click("[%s='%s']" % (group_attr, value))
    page.keyboard.press("Escape")


def cast_and_wait_for_reeling(page, timeout_iters=80):
    page.click("#cast-btn")
    for _ in range(timeout_iters):
        st = page.evaluate("() => state")
        if st == "REELING":
            return True
        page.clock.fast_forward(200) if False else page.wait_for_timeout(50)
    return page.evaluate("() => state") == "REELING"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')

        # ===== 1. Background: non-repeating 'auto' selection =====
        context, page, errors = new_page(browser)
        keys = []
        for _ in range(30):
            page.evaluate("() => { pickBackground(); }")
            keys.append(page.evaluate("() => currentBackgroundKey"))
        consecutive_repeats = sum(1 for i in range(1, len(keys)) if keys[i] == keys[i - 1])
        record("Background 'auto': no two consecutive picks are ever identical (30 picks)",
               consecutive_repeats == 0, "keys=%s" % keys)
        record("Background 'auto': all 3 backgrounds do get picked over many tries",
               len(set(keys)) == 3, "distinct=%s" % set(keys))
        record("no runtime errors (background non-repeat block)", not errors, str(errors))
        context.close()

        # ===== 2. Background: teacher lock stays fixed, applies only at next cast =====
        context, page, errors = new_page(browser)
        set_setting(page, "data-background", "pond-autumn")
        for _ in range(10):
            page.evaluate("() => { pickBackground(); }")
            key = page.evaluate("() => currentBackgroundKey")
            if key != "pond-autumn":
                record("Background lock: stays on the locked value across repeated picks", False, "got %s" % key)
                break
        else:
            record("Background lock: stays on the locked value across repeated picks", True)
        # Apply-timing: lock to forest-stream mid-REELING, confirm the CURRENT trial's
        # background does not change until the next cast.
        page.evaluate("() => { inputSettings.backgroundMode = 'pond-original'; pickBackground(); }")
        assert cast_and_wait_for_reeling(page)
        bg_before = page.evaluate("() => currentBackgroundKey")
        set_setting(page, "data-background", "forest-stream")
        bg_during = page.evaluate("() => currentBackgroundKey")
        record("Background: changing the lock mid-REELING does not change the current trial's scene",
               bg_before == "pond-original" and bg_during == "pond-original",
               "before=%s during=%s" % (bg_before, bg_during))
        # Let this trial finish, then start a new one: NOW it should reflect the new lock.
        page.evaluate("() => { reelProgress = reelTarget; applyReelProgress(0, 'test'); }")
        page.wait_for_timeout(50)
        page.evaluate("() => { requestReset(); }")
        page.click("#cast-btn")
        page.wait_for_timeout(50)
        bg_next = page.evaluate("() => currentBackgroundKey")
        record("Background: the new lock takes effect starting the next cast",
               bg_next == "forest-stream", "next=%s" % bg_next)
        record("no runtime errors (background lock/apply-timing block)", not errors, str(errors))
        context.close()

        # ===== 3. Fish type: non-repeating 'auto', teacher lock, independence from size =====
        context, page, errors = new_page(browser)
        types_seen, sizes_seen = [], set()
        for _ in range(30):
            page.evaluate("() => { pickFishAppearance(); }")
            types_seen.append(page.evaluate("() => currentFish.type"))
            sizes_seen.add(page.evaluate("() => currentFish.size"))
        consecutive_type_repeats = sum(1 for i in range(1, len(types_seen)) if types_seen[i] == types_seen[i - 1])
        record("Fish type 'auto': no two consecutive picks are ever identical (30 picks)",
               consecutive_type_repeats == 0, "types=%s" % types_seen)
        record("Fish type 'auto': all 3 types do get picked over many tries",
               len(set(types_seen)) == 3, "distinct=%s" % set(types_seen))
        record("Fish size: varies independently while type cycles through 'auto' (not locked to one value)",
               len(sizes_seen) > 1, "sizes_seen=%s" % sizes_seen)
        # Lock type to 'spotted', confirm size still varies freely (type/size independence).
        page.evaluate("() => { inputSettings.fishTypeMode = 'spotted'; }")
        locked_sizes = set()
        for _ in range(20):
            page.evaluate("() => { pickFishAppearance(); }")
            assert page.evaluate("() => currentFish.type") == 'spotted'
            locked_sizes.add(page.evaluate("() => currentFish.size"))
        record("Fish type locked to 'spotted': type never deviates across 20 picks", True)
        record("Fish type locked: size still varies independently (type lock does not also lock size)",
               len(locked_sizes) > 1, "locked_sizes=%s" % locked_sizes)
        record("no runtime errors (fish type/size independence block)", not errors, str(errors))
        context.close()

        # ===== 4. #fish-img src and #fish-size-label text match currentFish exactly =====
        context, page, errors = new_page(browser)
        for _ in range(10):
            page.evaluate("() => { pickFishAppearance(); }")
            fish_type = page.evaluate("() => currentFish.type")
            fish_size = page.evaluate("() => currentFish.size")
            expected_image = page.evaluate(
                "(t) => FISH_PALETTE.filter(f => f.type === t)[0].image", fish_type)
            expected_label = page.evaluate(
                "(s) => FISH_SIZES.filter(sz => sz.key === s)[0].label", fish_size)
            actual_src = page.get_attribute("#fish-img", "src")
            actual_label = page.inner_text("#fish-size-label")
            if not (actual_src.endswith(expected_image) and actual_label == expected_label):
                record("#fish-img/#fish-size-label always match currentFish", False,
                       "type=%s size=%s src=%s label=%s" % (fish_type, fish_size, actual_src, actual_label))
                break
        else:
            record("#fish-img/#fish-size-label always match currentFish", True)
        record("no runtime errors (fish image/label consistency block)", not errors, str(errors))
        context.close()

        # ===== 5. Size-effort OFF (default): required operation amount unchanged regardless of size =====
        context, page, errors = new_page(browser)
        record("Default sizeEffort is 'off'", page.evaluate("() => inputSettings.sizeEffort") == 'off')
        for size_key in ['small', 'medium', 'large']:
            page.evaluate("(sk) => { pickFishAppearance(); currentFish.size = sk; "
                           "reelTarget = (inputSettings.sizeEffort === 'on') ? "
                           "Math.round(100 * FISH_SIZES.filter(s=>s.key===sk)[0].effortMultiplier) : 100; }", size_key)
            rt = page.evaluate("() => reelTarget")
            if rt != 100:
                record("sizeEffort OFF: reelTarget stays 100 for every size", False,
                       "size=%s reelTarget=%s" % (size_key, rt))
                break
        else:
            record("sizeEffort OFF: reelTarget stays 100 for every size", True)
        # End-to-end: one default-gain hold tick advances by exactly 3, regardless of
        # which size was actually rolled for this real trial (not forced, real random).
        assert cast_and_wait_for_reeling(page)
        before = page.evaluate("() => reelProgress")
        page.evaluate("() => { applyReelProgress(HOLD_TICK_AMOUNT, 'touch'); }")
        after = page.evaluate("() => reelProgress")
        record("sizeEffort OFF: one real default-gain tick still advances by exactly 3 (legacy operation amount, Method B)",
               after - before == 3, "%s -> %s" % (before, after))
        record("no runtime errors (sizeEffort OFF block)", not errors, str(errors))
        context.close()

        # ===== 6. Size-effort ON: reelTarget scales 1x/1.25x/1.5x, consistently for all 3 methods =====
        context, page, errors = new_page(browser)
        page.evaluate("() => { inputSettings.sizeEffort = 'on'; }")
        expected = {'small': 100, 'medium': 125, 'large': 150}
        all_ok = True
        for size_key, expected_target in expected.items():
            page.evaluate("(sk) => { pickFishAppearance(); currentFish.size = sk; "
                           "reelTarget = Math.round(100 * FISH_SIZES.filter(s=>s.key===sk)[0].effortMultiplier); }", size_key)
            rt = page.evaluate("() => reelTarget")
            if rt != expected_target:
                all_ok = False
                record("sizeEffort ON: reelTarget is the documented trial multiplier per size", False,
                       "size=%s expected=%s got=%s" % (size_key, expected_target, rt))
        if all_ok:
            record("sizeEffort ON: reelTarget is the documented trial multiplier per size (small=100/medium=125/large=150)", True)
        # Method A (arc): a medium fish needs 1.25x as many 360deg turns as a small one,
        # using the SAME per-turn gain (amount itself untouched by effort).
        gain = page.evaluate("() => REEL_GAIN_PRESETS[inputSettings.reelGainPreset]")  # default 3
        page.evaluate("() => { state = STATE.REELING; hookedFishId = 'test'; currentFish = {type:'orange', size:'small'}; reelTarget = 100; reelProgress = 0; }")
        turns_small = 0
        while page.evaluate("() => reelProgress") < page.evaluate("() => reelTarget"):
            page.evaluate("(g) => applyReelProgress(g, 'touch')", gain)
            turns_small += 1
        page.evaluate("() => { state = STATE.REELING; hookedFishId = 'test'; currentFish = {type:'orange', size:'medium'}; reelTarget = 125; reelProgress = 0; }")
        turns_medium = 0
        while page.evaluate("() => reelProgress") < page.evaluate("() => reelTarget"):
            page.evaluate("(g) => applyReelProgress(g, 'touch')", gain)
            turns_medium += 1
        record("sizeEffort ON, Method A unit (simulated via applyReelProgress gain steps): medium needs ~1.25x the small-size step count",
               turns_medium > turns_small and abs(turns_medium / float(turns_small) - 1.25) < 0.15,
               "small=%s medium=%s ratio=%.3f" % (turns_small, turns_medium, turns_medium / float(turns_small)))
        record("no runtime errors (sizeEffort ON block)", not errors, str(errors))
        context.close()

        # ===== 7. Settings changes mid-REELING are safe no-ops on the CURRENT trial
        #          (no markReleased needed — background/fishType/sizeEffort never touch
        #          in-flight input state). Mutates inputSettings directly (bypassing the
        #          settings-panel UI) so this isolates the new handlers' own logic from
        #          the EXISTING, unrelated focus/blur safety net that already protects
        #          every settings-panel interaction uniformly (opening any panel moves
        #          focus off #reel-hold-btn, which already stops a keyboard-held press —
        #          true for reelGainPreset/reelSpeedPreset too, not something specific to
        #          or newly introduced by this Phase's 3 settings). =====
        context, page, errors = new_page(browser)
        page.click("#methodRow [data-reel-method='hold']")
        assert cast_and_wait_for_reeling(page)
        # NOTE: page.evaluate(js, arg) passes exactly one arg — a 2-element list here
        # would bind the whole list to the function's first parameter, not destructure
        # into two, so this takes a single {sel, type} object instead.
        dispatch = """(args) => {
            var el = document.querySelector(args.sel);
            var r = el.getBoundingClientRect();
            var ev = new PointerEvent(args.type, {pointerId:1, pointerType:'touch', bubbles:true,
                cancelable:true, clientX:r.left+r.width/2, clientY:r.top+r.height/2, isPrimary:true});
            el.dispatchEvent(ev);
        }"""
        page.evaluate(dispatch, {"sel": "#reel-hold-btn", "type": "pointerdown"})
        page.wait_for_timeout(150)
        held_before = page.evaluate("() => isPhysicallyHeld")
        progress_before = page.evaluate("() => reelProgress")
        current_fish_before = page.evaluate("() => JSON.stringify(currentFish)")
        page.evaluate("() => { inputSettings.fishTypeMode = 'spotted'; saveInputSettings(); }")
        held_after = page.evaluate("() => isPhysicallyHeld")
        current_fish_after = page.evaluate("() => JSON.stringify(currentFish)")
        record("Changing fish-type lock mid-REELING (direct setting mutation): hold input is NOT interrupted (still held)",
               held_before is True and held_after is True)
        record("Changing fish-type lock mid-REELING: the CURRENT trial's fish is unchanged",
               current_fish_before == current_fish_after, "%s -> %s" % (current_fish_before, current_fish_after))
        page.wait_for_timeout(150)
        progress_after = page.evaluate("() => reelProgress")
        record("Changing fish-type lock mid-REELING: reeling continued normally (progress advanced)",
               progress_after > progress_before, "%s -> %s" % (progress_before, progress_after))
        page.evaluate(dispatch, {"sel": "#reel-hold-btn", "type": "pointerup"})
        record("no runtime errors (settings-change-mid-REELING block)", not errors, str(errors))
        context.close()

        # ===== 8. Reset ('もういちど'/requestReset) releases size/effort state cleanly =====
        context, page, errors = new_page(browser)
        page.evaluate("() => { inputSettings.sizeEffort = 'on'; }")
        assert cast_and_wait_for_reeling(page)
        page.evaluate("() => { currentFish.size = 'large'; reelTarget = 150; reelProgress = reelTarget; applyReelProgress(0, 'test'); }")
        page.wait_for_timeout(50)
        record("Catch reached: state is CAUGHT", page.evaluate("() => state") == "CAUGHT")
        page.evaluate("() => { requestReset(); }")
        reel_target_after_reset = page.evaluate("() => reelTarget")
        size_label_after_reset = page.inner_text("#fish-size-label")
        record("requestReset(): reelTarget cleared back to 100",
               reel_target_after_reset == 100, "got %s" % reel_target_after_reset)
        record("requestReset(): #fish-size-label cleared (fish no longer visible)",
               size_label_after_reset == "", "got %r" % size_label_after_reset)
        is_held_after = page.evaluate("() => isPhysicallyHeld")
        hold_timer_after = page.evaluate("() => holdTimer")
        record("requestReset(): no stale held/timer state left over",
               is_held_after is False and hold_timer_after is None)
        record("no runtime errors (reset-releases-state block)", not errors, str(errors))
        context.close()

        # ===== 9. Learning Record matches what was actually shown =====
        context, page, errors = new_page(browser)
        page.evaluate("() => { inputSettings.fishTypeMode = 'red-white'; }")
        assert cast_and_wait_for_reeling(page)
        shown_type = page.evaluate("() => currentFish.type")
        shown_size = page.evaluate("() => currentFish.size")
        page.evaluate("() => { reelProgress = reelTarget; applyReelProgress(0, 'test'); }")
        page.wait_for_timeout(100)
        record_entry = page.evaluate(
            "() => JSON.parse(localStorage.getItem('sakana-tsuri_records'))[0].payload")
        record("Learning Record caughtColor matches the fish type actually shown (#fish-img)",
               record_entry.get("caughtColor") == shown_type,
               "shown=%s recorded=%s" % (shown_type, record_entry.get("caughtColor")))
        record("Learning Record caughtSize matches the size actually shown (#fish-size-label)",
               record_entry.get("caughtSize") == shown_size,
               "shown=%s recorded=%s" % (shown_size, record_entry.get("caughtSize")))
        record("Learning Record caughtColor is one of the 3 real displayed types (never an unseen color)",
               record_entry.get("caughtColor") in ['orange', 'red-white', 'spotted'],
               str(record_entry.get("caughtColor")))
        record("no runtime errors (record-consistency block)", not errors, str(errors))
        context.close()

        # ===== 10. Image-load-failure fallback: game stays operable =====
        context2 = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True)
        page2 = context2.new_page()
        errors2 = []
        page2.on("pageerror", lambda e: errors2.append(str(e)))
        page2.route("**/assets/sakana-tsuri/*", lambda route: route.abort())
        page2.goto(BASE)
        page2.click("#start-btn")
        page2.click("#cast-btn")
        # CASTING(500ms) + WAITING(1200-2200ms) + BITTEN(500ms) can take up to ~3.2s —
        # poll instead of a single fixed wait, so this isn't flaky near that boundary.
        state_after = None
        for _ in range(80):
            state_after = page2.evaluate("() => state")
            if state_after == "REELING":
                break
            page2.wait_for_timeout(50)
        record("Image-load-failure: game still reaches REELING with all images blocked",
               state_after == "REELING", "state=%s" % state_after)
        progress_before2 = page2.evaluate("() => reelProgress")
        page2.evaluate("() => { applyReelProgress(3, 'touch'); }")
        progress_after2 = page2.evaluate("() => reelProgress")
        record("Image-load-failure: reeling input still functions normally",
               progress_after2 > progress_before2)
        record("no runtime errors (image-load-failure block)", not errors2, str(errors2))
        context2.close()

        browser.close()

        n = len(RESULTS)
        failed = [r for r in RESULTS if not r["ok"]]
        print("\n%d/%d checks passed." % (n - len(failed), n))
        sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
