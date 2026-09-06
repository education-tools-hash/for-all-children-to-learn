# Real-browser (Playwright/Chromium) regression test for matching-app.html's
# 6 modal dialogs' Focus Trap contract (AUDIT-35-FIX-1), the settings-ov/edit-ov
# Focus Return contract (AUDIT-35-FIX-1C), and the SETTINGS_PROXY hidden-original
# hardening (AUDIT-35-FIX-1E, generator-level - see tools/settings-proxy-focus-audit/
# for the cross-app 31-app regression). Requires a local static server for the
# repo root, e.g.:
#   python -m http.server 8935 --bind 127.0.0.1
# then: python tools/matching-modal-focus-trap/focus_trap_test.py
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/matching-app.html"
RESULTS = []

def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))

def active_id(page):
    return page.evaluate("document.activeElement && document.activeElement.id")

def inert_state(page):
    return page.evaluate("({hdr: document.getElementById('hdr').inert, main: document.getElementById('main').inert})")

def is_shown(page, modal_id):
    return page.evaluate(f"document.getElementById('{modal_id}').classList.contains('show')")

def run_tab_cycle_check(page, modal_id, focusables):
    n = len(focusables)
    # Forward Tab n times should end up back at focusables[0] wrapped, verifying no escape.
    seen = []
    for _ in range(n + 2):
        seen.append(active_id(page))
        page.keyboard.press('Tab')
    seen.append(active_id(page))
    escaped = any(x not in focusables for x in seen)
    return (not escaped), seen

def run_shift_tab_cycle_check(page, modal_id, focusables):
    n = len(focusables)
    seen = []
    for _ in range(n + 2):
        seen.append(active_id(page))
        page.keyboard.press('Shift+Tab')
    seen.append(active_id(page))
    escaped = any(x not in focusables for x in seen)
    return (not escaped), seen

def test_vs_result_ov(page):
    print("\n=== vs-result-ov ===")
    page.evaluate("""() => {
        curLevel = 'easy';
        secs = 12; moves = 4;
        vsPlayers = [
          {name:'A',color:'p1',score:2},
          {name:'B',color:'p2',score:1}
        ];
        showVsResult();
    }""")
    record("vs-result-ov open() succeeds", is_shown(page, 'vs-result-ov'))
    aid = active_id(page)
    record("vs-result-ov initial focus", aid == 'btn-vs-again', f"active={aid}")
    inert = inert_state(page)
    record("vs-result-ov sets background inert", inert['hdr'] and inert['main'], str(inert))

    focusables = ['btn-vs-again', 'btn-vs-back']
    ok, seen = run_tab_cycle_check(page, 'vs-result-ov', focusables)
    record("vs-result-ov Tab stays inside + wraps", ok, str(seen))

    # re-focus first for shift-tab check
    page.evaluate("document.getElementById('btn-vs-again').focus()")
    ok, seen = run_shift_tab_cycle_check(page, 'vs-result-ov', focusables)
    record("vs-result-ov Shift+Tab stays inside + wraps", ok, str(seen))

    # close via btn-vs-back -> backToSel()
    page.evaluate("document.getElementById('btn-vs-again').focus()")
    page.click('#btn-vs-back')
    record("vs-result-ov closes on btn-vs-back", not is_shown(page, 'vs-result-ov'))
    inert = inert_state(page)
    record("vs-result-ov close restores background inert=false", not inert['hdr'] and not inert['main'], str(inert))

    # reopen check (no listener duplication -> Tab cycle should still be length-consistent)
    page.evaluate("""() => {
        curLevel='easy'; secs=5; moves=3;
        vsPlayers=[{name:'A',color:'p1',score:3},{name:'B',color:'p2',score:0}];
        showVsResult();
    }""")
    ok, seen = run_tab_cycle_check(page, 'vs-result-ov', focusables)
    record("vs-result-ov reopen: Tab cycle still correct (no listener dup)", ok, str(seen))
    page.click('#btn-vs-again')  # close via retry path
    record("vs-result-ov closes on btn-vs-again", not is_shown(page, 'vs-result-ov'))


def test_clear_ov(page):
    print("\n=== clear-ov ===")
    # go back to sel screen state first (btn-vs-again triggered startGame(); reset to a clean baseline)
    page.evaluate("""() => {
        curLevel = 'easy';
        secs = 20; moves = 6;
        showClear();
    }""")
    record("clear-ov open() succeeds", is_shown(page, 'clear-ov'))
    aid = active_id(page)
    record("clear-ov initial focus", aid == 'btn-again', f"active={aid}")
    inert = inert_state(page)
    record("clear-ov sets background inert", inert['hdr'] and inert['main'], str(inert))

    focusables = ['btn-again', 'btn-clear-back']
    ok, seen = run_tab_cycle_check(page, 'clear-ov', focusables)
    record("clear-ov Tab stays inside + wraps", ok, str(seen))

    page.evaluate("document.getElementById('btn-again').focus()")
    ok, seen = run_shift_tab_cycle_check(page, 'clear-ov', focusables)
    record("clear-ov Shift+Tab stays inside + wraps", ok, str(seen))

    page.evaluate("document.getElementById('btn-again').focus()")
    page.click('#btn-clear-back')
    record("clear-ov closes on btn-clear-back", not is_shown(page, 'clear-ov'))
    inert = inert_state(page)
    record("clear-ov close restores background inert=false", not inert['hdr'] and not inert['main'], str(inert))

    # reopen check
    page.evaluate("""() => { curLevel='easy'; secs=8; moves=4; showClear(); }""")
    ok, seen = run_tab_cycle_check(page, 'clear-ov', focusables)
    record("clear-ov reopen: Tab cycle still correct (no listener dup)", ok, str(seen))
    page.click('#btn-again')
    record("clear-ov closes on btn-again", not is_shown(page, 'clear-ov'))


def test_existing_four(page):
    print("\n=== regression: how-ov / settings-ov / record-ov / edit-ov ===")
    # reset to a clean sel-screen baseline (prior tests may have left game-screen active,
    # which shifts header button layout and intercepts pointer events on #btn-settings)
    page.evaluate("backToSel()")
    # how-ov
    page.click('#donomanaHelpBtn')
    record("how-ov opens via help button", is_shown(page, 'how-ov'))
    aid = active_id(page)
    record("how-ov initial focus unchanged", aid == 'how-title', f"active={aid}")
    page.keyboard.press('Escape')
    record("how-ov closes via Escape", not is_shown(page, 'how-ov'))
    aid = active_id(page)
    record("how-ov focus return to trigger unchanged", aid == 'donomanaHelpBtn', f"active={aid}")

    # settings-ov
    # #btn-settings is the SETTINGS_PROXY-hidden original (opacity:0, pointer-events:none,
    # and since AUDIT-35-FIX-1E also tabindex=-1/aria-hidden) - it is never a real pointer
    # or Tab target, only reachable via donomanaA11yBtn -> donomanaSettingsProxy -> .click(),
    # or directly via JS as done here to exercise the modal logic itself.
    page.evaluate("document.getElementById('btn-settings').click()")
    record("settings-ov opens", is_shown(page, 'settings-ov'))
    aid = active_id(page)
    record("settings-ov initial focus unchanged", aid == 'settings-title', f"active={aid}")
    page.evaluate("document.getElementById('btn-close-settings').click()")
    record("settings-ov closes via close button", not is_shown(page, 'settings-ov'))

    # record-ov
    page.click('#record-open-btn')
    record("record-ov opens", is_shown(page, 'record-ov'))
    aid = active_id(page)
    record("record-ov initial focus unchanged", aid == 'record-title', f"active={aid}")
    page.click('#btn-close-record')
    record("record-ov closes via close button", not is_shown(page, 'record-ov'))
    aid = active_id(page)
    record("record-ov focus return to trigger unchanged", aid == 'record-open-btn', f"active={aid}")

    # edit-ov: focusable set is dynamic (varies with card count), so fetch it live
    # instead of hardcoding, using the same selector the production Tab-trap uses.
    page.click('#btn-add-set')
    record("edit-ov opens", is_shown(page, 'edit-ov'))
    aid = active_id(page)
    record("edit-ov initial focus unchanged", aid == 'edit-name', f"active={aid}")
    inert = inert_state(page)
    record("edit-ov sets background inert (unchanged)", inert['hdr'] and inert['main'], str(inert))
    focusables = page.evaluate("""
        Array.from(document.getElementById('edit-ov').querySelectorAll(
          'button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'
        )).filter(el => el.offsetParent !== null && !el.disabled).map(el => el.id || '')
    """)
    ok, seen = run_tab_cycle_check(page, 'edit-ov', focusables)
    record("edit-ov Tab stays inside + wraps (unchanged)", ok, f"focusables={focusables} seen={seen}")
    page.keyboard.press('Escape')
    record("edit-ov closes via Escape", not is_shown(page, 'edit-ov'))
    inert = inert_state(page)
    record("edit-ov close restores background inert=false", not inert['hdr'] and not inert['main'], str(inert))


def test_settings_focus_return(page):
    print("\n=== settings-ov Focus Return (AUDIT-35-FIX-1C, revised in FIX-1E) ===")
    page.evaluate("backToSel()")
    # AUDIT-35-FIX-1E: the real-world opener is donomanaA11yBtn (donomanaSettingsProxy ->
    # #btn-settings.click()), not #btn-settings itself - #btn-settings is a SETTINGS_PROXY-
    # hidden internal target (opacity:0/pointer-events:none, and now tabindex=-1/aria-hidden
    # too) that a real user never focuses. FIX-1C originally returned focus to #btn-settings;
    # that target is no longer appropriate once it is aria-hidden (see report), so all 3
    # close paths below now return to donomanaA11yBtn instead.

    # close via close button -> returns to donomanaA11yBtn
    page.evaluate("document.getElementById('btn-settings').click()")
    record("settings-ov opens (opener capture path)", is_shown(page, 'settings-ov'))
    page.evaluate("document.getElementById('btn-close-settings').click()")
    aid = active_id(page)
    record("settings-ov close-button: focus returns to donomanaA11yBtn", aid == 'donomanaA11yBtn', f"active={aid}")

    # reopen, close via overlay click -> returns to donomanaA11yBtn
    page.evaluate("document.getElementById('btn-settings').click()")
    page.evaluate("document.getElementById('settings-ov').click()")  # click the overlay itself (target === settings-ov)
    aid = active_id(page)
    record("settings-ov overlay-click: focus returns to donomanaA11yBtn", aid == 'donomanaA11yBtn', f"active={aid}")

    # reopen, close via Escape -> returns to donomanaA11yBtn
    page.evaluate("document.getElementById('btn-settings').click()")
    page.keyboard.press('Escape')
    aid = active_id(page)
    record("settings-ov Escape: focus returns to donomanaA11yBtn", aid == 'donomanaA11yBtn', f"active={aid}")

    # reopen once more (stale-opener / repeat-open sanity check)
    page.evaluate("document.getElementById('btn-settings').click()")
    record("settings-ov reopens correctly after repeated open/close", is_shown(page, 'settings-ov'))
    page.evaluate("document.getElementById('btn-close-settings').click()")
    aid = active_id(page)
    record("settings-ov focus-return still correct after repeated cycles", aid == 'donomanaA11yBtn', f"active={aid}")


def test_edit_focus_return(page):
    print("\n=== edit-ov Focus Return (AUDIT-35-FIX-1C) ===")
    page.evaluate("backToSel()")

    # NOTE: these use real Playwright pointer clicks (page.click), not page.evaluate(...click()).
    # openEdit()'s opener capture reads document.activeElement at call time; a real click focuses
    # the element first (like an actual user), but a JS-synthesized .click() does not - using the
    # synthetic form here would test an interaction pattern real users never produce.

    # 1) #btn-add-set trigger, cancel via overlay click -> returns to #btn-add-set
    page.click('#btn-add-set')
    record("edit-ov opens from #btn-add-set", is_shown(page, 'edit-ov'))
    page.evaluate("document.getElementById('edit-ov').click()")  # overlay click (target === edit-ov) - closing doesn't need real-focus semantics
    aid = active_id(page)
    record("edit-ov overlay-cancel from #btn-add-set: focus returns to #btn-add-set", aid == 'btn-add-set', f"active={aid}")

    # 2) #btn-add-set trigger, cancel via Escape -> returns to #btn-add-set
    page.click('#btn-add-set')
    page.keyboard.press('Escape')
    aid = active_id(page)
    record("edit-ov Escape from #btn-add-set: focus returns to #btn-add-set", aid == 'btn-add-set', f"active={aid}")

    # 3) seed a real custom set via the same dbPut()/loadSets() path the app itself uses,
    #    so a real per-item [data-edit] trigger exists in the DOM (not simulated/guessed).
    page.evaluate("""async () => {
        await dbPut({id:'fixture-set-1', uuid:'fixture-uuid-1', name:'テストセット', displayMode:'img-text',
          cards:[{label:'A',label2:'',imgDataUrl:null,emoji:'🍎'},{label:'B',label2:'',imgDataUrl:null,emoji:'🍌'}]});
        await loadSets();
    }""")
    has_trigger = page.evaluate("!!document.querySelector('[data-edit=\"fixture-set-1\"]')")
    record("fixture: [data-edit] trigger exists for seeded custom set", has_trigger)

    # 4) open edit-ov FROM the dynamic [data-edit] button, cancel via Escape -> returns to
    #    that SAME per-item button (not #btn-add-set) - this is the core FIX-1C contract:
    #    dynamic opener capture, not a hardcoded fixed element.
    page.click('[data-edit="fixture-set-1"]')
    record("edit-ov opens from per-item [data-edit] button", is_shown(page, 'edit-ov'))
    aid_name = active_id(page)
    record("edit-ov initial focus unchanged (edit trigger path)", aid_name == 'edit-name', f"active={aid_name}")
    page.keyboard.press('Escape')
    aid = active_id(page)
    record("edit-ov Escape from [data-edit]: focus returns to that same per-item button (not #btn-add-set)",
           aid == 'fixture-set-1' or page.evaluate("document.activeElement.dataset.edit") == 'fixture-set-1',
           f"active={aid} dataset={page.evaluate('document.activeElement.dataset.edit')}")

    # 5) open FROM [data-edit], SAVE (triggers loadSets() re-render, destroying the original
    #    node) -> focus must land on the NEWLY rendered [data-edit] node for the same set id,
    #    not error out on the stale reference. This is the "invalid opener fallback" case.
    page.click('[data-edit="fixture-set-1"]')
    page.click('#btn-save-set')
    page.wait_for_timeout(150)  # async dbPut()/loadSets() inside the save handler
    aid = active_id(page)
    dataset_edit = page.evaluate("document.activeElement && document.activeElement.dataset && document.activeElement.dataset.edit")
    record("edit-ov save (existing set): focus returns to the re-rendered [data-edit] node, no error",
           dataset_edit == 'fixture-set-1', f"active={aid} dataset-edit={dataset_edit}")
    record("edit-ov save closed the modal", not is_shown(page, 'edit-ov'))

    # 6) reopen sanity after the re-render churn above (stale opener must not linger)
    page.click('#btn-add-set')
    record("edit-ov reopens correctly after prior save/re-render cycle", is_shown(page, 'edit-ov'))
    page.evaluate("document.getElementById('edit-ov').click()")
    aid = active_id(page)
    record("edit-ov opener correctly updated to #btn-add-set on next open (no stale opener)", aid == 'btn-add-set', f"active={aid}")

    # cleanup the fixture set so it doesn't leak into other tests/manual review
    page.evaluate("async () => { await dbDel('fixture-set-1'); await loadSets(); }")


def test_settings_proxy_hidden_focus(page):
    print("\n=== SETTINGS_PROXY hidden #btn-settings hardening (AUDIT-35-FIX-1E) ===")
    page.evaluate("backToSel()")

    state = page.evaluate("""() => {
        const el = document.getElementById('btn-settings');
        const cs = getComputedStyle(el);
        return {opacity: cs.opacity, pointerEvents: cs.pointerEvents, tabIndex: el.tabIndex, ariaHidden: el.getAttribute('aria-hidden')};
    }""")
    record("#btn-settings stays invisible/unclickable (unchanged)", state['opacity'] == '0' and state['pointerEvents'] == 'none', str(state))
    record("#btn-settings is excluded from native Tab order (tabIndex=-1)", state['tabIndex'] == -1, str(state))
    record("#btn-settings is hidden from the accessibility tree (aria-hidden=true)", state['ariaHidden'] == 'true', str(state))

    # Tab across the whole page a generous number of times; #btn-settings must never
    # be the active element (it used to be, before this Phase).
    page.evaluate("document.body.focus()")
    hit_hidden = False
    for _ in range(40):
        page.keyboard.press('Tab')
        if active_id(page) == 'btn-settings':
            hit_hidden = True
            break
    record("Tab never lands on hidden #btn-settings across 40 presses", not hit_hidden)

    # End-to-end programmatic proxy contract: donomanaA11yBtn -> donomanaSettingsProxy
    # -> #btn-settings.click() must still open settings-ov correctly.
    page.evaluate("document.getElementById('donomanaA11yBtn').click()")
    panel_open = page.evaluate("document.getElementById('donomanaA11yPanel').style.display === 'block'")
    record("donomanaA11yBtn opens the common a11y panel", panel_open)
    proxy_exists = page.evaluate("!!document.getElementById('donomanaSettingsProxy')")
    record("donomanaSettingsProxy exists inside the panel", proxy_exists)
    page.evaluate("document.getElementById('donomanaSettingsProxy').click()")
    record("proxy click opens settings-ov end-to-end", is_shown(page, 'settings-ov'))
    aid = active_id(page)
    record("proxy-opened settings-ov still gets correct initial focus", aid == 'settings-title', f"active={aid}")
    page.evaluate("document.getElementById('btn-close-settings').click()")
    aid = active_id(page)
    record("closing proxy-opened settings-ov returns focus to donomanaA11yBtn", aid == 'donomanaA11yBtn', f"active={aid}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.goto(BASE)
        page.wait_for_load_state("networkidle")

        test_vs_result_ov(page)
        test_clear_ov(page)
        test_existing_four(page)
        test_settings_focus_return(page)
        test_edit_focus_return(page)
        test_settings_proxy_hidden_focus(page)

        print("\n=== console/runtime ===")
        record("console error count == 0", len(console_errors) == 0, str(console_errors[:5]))

        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed")
    with open("tools/matching-modal-focus-trap/focus_trap_results.json", "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
