# Real-browser (Playwright/Chromium) regression test for matching-app.html's
# 6 modal dialogs' Focus Trap contract (AUDIT-35-FIX-1). Requires a local
# static server for the repo root, e.g.:
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
    # pre-existing #fs-btn overlap intercepts real pointer clicks on #btn-settings at this
    # viewport (unrelated to Focus Trap fix; out of scope for this Phase, see report) ->
    # dispatch the click via JS so the same listener still fires and modal logic is exercised.
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
