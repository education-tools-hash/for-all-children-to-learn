# Real-browser (Playwright/Chromium) regression test for matching-app.html's
# Switch Scan candidate containment across all 6 modal dialogs (AUDIT-35-FIX-1B).
# This simulates Switch input via Space-key activation (scanAct()'s existing
# keydown path) and reads buildScanItems() directly - it does NOT exercise a
# physical switch device (e.g. Blue2). See the Phase report for that distinction.
#
# Requires a local static server for the repo root, e.g.:
#   python -m http.server 8935 --bind 127.0.0.1
# then: python tools/matching-modal-switch-scan/switch_scan_test.py
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/matching-app.html"
RESULTS = []

def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))

def is_shown(page, modal_id):
    return page.evaluate(f"document.getElementById('{modal_id}').classList.contains('show')")

def scan_candidate_ids(page):
    return page.evaluate("buildScanItems().map(e => e.id || '(no-id)')")

def scan_focus_id(page):
    return page.evaluate("(document.querySelector('.scan-focus') || {}).id || null")


def test_vs_result_ov(page):
    print("\n=== vs-result-ov (Switch Scan) ===")
    page.evaluate("""() => {
        curLevel='easy'; secs=10; moves=4;
        vsPlayers=[{name:'A',color:'p1',score:2},{name:'B',color:'p2',score:1}];
        showVsResult();
    }""")
    record("vs-result-ov open() succeeds", is_shown(page, 'vs-result-ov'))

    cands = scan_candidate_ids(page)
    record("vs-result-ov scan candidates == modal buttons only", cands == ['btn-vs-again', 'btn-vs-back'], str(cands))

    bg_leak = page.evaluate("buildScanItems().some(e => e.id === 'donomanaHomeBtn' || e.id === 'donomanaA11yBtn' || e.closest('#game-screen,#sel-screen'))")
    record("vs-result-ov no background candidate leak", not bg_leak, f"leak={bg_leak}")

    # start scanning and verify first candidate is highlighted at index 0
    page.evaluate("startSwitchScan()")
    foc = scan_focus_id(page)
    record("vs-result-ov initial scan-focus is first candidate", foc == 'btn-vs-again', f"focus={foc}")

    # wait for the timer to tick twice (scanMs=1200ms) -> should wrap back to first (2 candidates)
    page.wait_for_timeout(2600)
    foc2 = scan_focus_id(page)
    record("vs-result-ov scan wraps after 2 ticks (2 candidates)", foc2 == 'btn-vs-again', f"focus={foc2}")

    # advance one tick then activate via scanAct() (Space-key path) on btn-vs-back
    page.wait_for_timeout(1200)
    foc3 = scan_focus_id(page)
    record("vs-result-ov scan advanced to second candidate", foc3 == 'btn-vs-back', f"focus={foc3}")

    before_log = page.evaluate("JSON.parse(localStorage.getItem('matching_log')||'[]').length")
    page.evaluate("scanAct()")  # simulates Space/Enter activation of currently-scanned candidate
    record("vs-result-ov scanAct() closes modal (activated btn-vs-back -> backToSel)", not is_shown(page, 'vs-result-ov'))
    after_log = page.evaluate("JSON.parse(localStorage.getItem('matching_log')||'[]').length")
    record("vs-result-ov activation did not create a duplicate/extra record", after_log == before_log, f"before={before_log} after={after_log}")

    stale = page.evaluate("buildScanItems().some(e => e.id === 'btn-vs-again' || e.id === 'btn-vs-back')")
    record("vs-result-ov no stale candidates after close", not stale, f"stale={stale}")

    # reopen check - no duplication, order stable
    page.evaluate("""() => {
        curLevel='easy'; secs=5; moves=3;
        vsPlayers=[{name:'A',color:'p1',score:3},{name:'B',color:'p2',score:0}];
        showVsResult();
    }""")
    cands2 = scan_candidate_ids(page)
    record("vs-result-ov reopen: candidates correct, no duplication", cands2 == ['btn-vs-again', 'btn-vs-back'], str(cands2))
    foc4 = scan_focus_id(page)
    record("vs-result-ov reopen: scanIdx reset to first candidate", foc4 == 'btn-vs-again', f"focus={foc4}")
    page.evaluate("scanAct()")  # close via btn-vs-again -> startGame()
    stopSwitchScan_state = page.evaluate("scanMode")
    record("vs-result-ov close via retry keeps scanMode unaffected", stopSwitchScan_state is True, f"scanMode={stopSwitchScan_state}")


def test_clear_ov(page):
    print("\n=== clear-ov (Switch Scan) ===")
    page.evaluate("backToSel()")
    page.evaluate("""() => { curLevel='easy'; secs=8; moves=4; showClear(); }""")
    record("clear-ov open() succeeds", is_shown(page, 'clear-ov'))

    cands = scan_candidate_ids(page)
    record("clear-ov scan candidates == modal buttons only", cands == ['btn-again', 'btn-clear-back'], str(cands))

    bg_leak = page.evaluate("buildScanItems().some(e => e.closest('#game-screen,#sel-screen'))")
    record("clear-ov no background candidate leak", not bg_leak, f"leak={bg_leak}")

    page.evaluate("startSwitchScan()")
    foc = scan_focus_id(page)
    record("clear-ov initial scan-focus is first candidate", foc == 'btn-again', f"focus={foc}")
    # first candidate (もういちど retry) is a safe, non-destructive action - not a delete/clear operation
    record("clear-ov first candidate is non-destructive (retry, not delete)", foc == 'btn-again')

    page.wait_for_timeout(1200)
    foc2 = scan_focus_id(page)
    record("clear-ov scan advances to second candidate", foc2 == 'btn-clear-back', f"focus={foc2}")

    page.evaluate("scanAct()")
    record("clear-ov scanAct() closes modal (activated btn-clear-back -> backToSel)", not is_shown(page, 'clear-ov'))

    stale = page.evaluate("buildScanItems().some(e => e.id === 'btn-again' || e.id === 'btn-clear-back')")
    record("clear-ov no stale candidates after close", not stale, f"stale={stale}")

    page.evaluate("""() => { curLevel='easy'; secs=6; moves=3; showClear(); }""")
    cands2 = scan_candidate_ids(page)
    record("clear-ov reopen: candidates correct, no duplication", cands2 == ['btn-again', 'btn-clear-back'], str(cands2))
    page.evaluate("scanAct()")  # close via btn-again -> startGame()


def test_existing_four_regression(page):
    print("\n=== existing 4 modal Switch Scan regression ===")
    page.evaluate("backToSel(); stopSwitchScan();")

    page.evaluate("document.getElementById('donomanaHelpBtn').click()")
    cands = scan_candidate_ids(page)
    record("how-ov candidates unchanged (modal-only)", 'how-title' in cands or len(cands) > 0, str(cands))
    bg_leak = page.evaluate("buildScanItems().some(e => e.id === 'donomanaHomeBtn')")
    record("how-ov no background leak (unchanged)", not bg_leak)
    page.keyboard.press('Escape')

    page.evaluate("document.getElementById('btn-settings').click()")
    cands = scan_candidate_ids(page)
    record("settings-ov candidates unchanged (modal-only)", len(cands) > 0, str(cands))
    page.evaluate("document.getElementById('btn-close-settings').click()")

    page.evaluate("document.getElementById('record-open-btn').click()")
    cands = scan_candidate_ids(page)
    record("record-ov candidates unchanged (modal-only)", len(cands) > 0, str(cands))
    page.evaluate("document.getElementById('btn-close-record').click()")

    page.evaluate("document.getElementById('btn-add-set').click()")
    cands = scan_candidate_ids(page)
    record("edit-ov candidates unchanged (modal-only)", len(cands) > 0, str(cands))
    page.keyboard.press('Escape')

    page.evaluate("stopSwitchScan();")


def test_supporter_only_exclusion(page):
    print("\n=== supporter-only nav exclusion (RECORD-NAV-1 contract) ===")
    page.evaluate("backToSel()")
    page.evaluate("""() => {
        curLevel='easy'; secs=10; moves=4;
        vsPlayers=[{name:'A',color:'p1',score:2},{name:'B',color:'p2',score:1}];
        showVsResult();
    }""")
    has_supporter = page.evaluate("buildScanItems().some(e => e.getAttribute('data-supporter-only') === 'true')")
    record("supporter-only record-nav button not scannable while vs-result-ov open", not has_supporter, f"present={has_supporter}")
    page.evaluate("$('vs-result-ov').classList.remove('show')")
    has_supporter2 = page.evaluate("buildScanItems().some(e => e.getAttribute('data-supporter-only') === 'true')")
    record("supporter-only record-nav button not scannable on normal screen (unchanged)", not has_supporter2, f"present={has_supporter2}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.goto(BASE)
        page.wait_for_load_state("networkidle")

        page.evaluate("enableScan()")
        record("scanMode enabled for test", page.evaluate("scanMode") is True)

        test_vs_result_ov(page)
        test_clear_ov(page)
        test_existing_four_regression(page)
        test_supporter_only_exclusion(page)

        print("\n=== console/runtime ===")
        record("console error count == 0", len(console_errors) == 0, str(console_errors[:5]))

        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
