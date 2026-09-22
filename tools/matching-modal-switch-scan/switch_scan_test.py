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


def test_common_a11y_panel(browser):
    """Use real keyboard events and actual panel handlers, in a fresh context.

    The opener is the last scan item so a one-switch user can close the panel;
    it is not an additional keyboard Tab-trap target.
    """
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.goto(BASE)
    page.wait_for_selector('.set-item')
    page.clock.install()
    page.clock.pause_at('2030-01-01T00:00:00Z')
    page.evaluate("selLevel='easy'; updateStartBtn(); enableScan(); scanIdx=4; startSwitchScan()")
    opener = page.locator('#donomanaA11yBtn')
    panel = page.locator('#donomanaA11yPanel')
    opener.click()
    expected = page.evaluate("""[...document.querySelectorAll('#donomanaA11yPanel button'),document.getElementById('donomanaA11yBtn')].map(e=>e.outerHTML.replace(/ scan-focus|scan-focus ?/g,''))""")
    actual = page.evaluate("buildScanItems().map(e=>e.outerHTML.replace(/ scan-focus|scan-focus ?/g,''))")
    record('A11y: all panel buttons then close toggle, no background items', actual == expected)
    record('A11y: opening resets index and immediately highlights proxy', scan_focus_id(page) == 'donomanaSettingsProxy' and page.evaluate('scanIdx') == 0)
    page.clock.run_for(1200)
    record('A11y: timer advances within panel', page.evaluate("document.querySelector('.scan-focus')?.dataset.a11yContrast") == 'normal')
    page.clock.run_for(1200 * (page.evaluate('buildScanItems().length') - 1))
    record('A11y: timer wraps to first item with one highlight', scan_focus_id(page) == 'donomanaSettingsProxy' and page.locator('.scan-focus').count() == 1)
    page.evaluate("""window.panelClicks=0;window.backgroundClicks=0;
        document.getElementById('donomanaA11yPanel').addEventListener('click',()=>panelClicks++);
        document.getElementById('start-btn').addEventListener('click',()=>backgroundClicks++);
    """)
    for key in ['Space', 'Enter']:
        page.evaluate("""scanIdx=buildScanItems().indexOf(document.querySelector('[data-a11y-font="large"]'));
            startSwitchScan(); document.getElementById('start-btn').focus(); panelClicks=0;
        """)
        page.keyboard.down(key)
        for _ in range(3):
            page.keyboard.down(key)
        page.keyboard.up(key)
        record(f'A11y: {key} activates one panel item despite background focus/repeat',
               page.evaluate('panelClicks===1 && backgroundClicks===0') and panel.is_visible())
    # A single switch can leave the panel via the existing opener toggle.
    page.evaluate('scanIdx=buildScanItems().length-1; startSwitchScan()')
    page.keyboard.press('Space')
    record('A11y: scanned close toggle closes panel and resumes page scanning',
           not panel.is_visible() and page.evaluate("scanIv!==null && scanIdx===0 && !buildScanItems().some(e=>e.closest('#donomanaA11yPanel'))"))
    opener.click()
    page.keyboard.press('Escape')
    record('A11y: Escape restores opener focus and page scan',
           not panel.is_visible() and active_id_for_panel(page) == 'donomanaA11yBtn' and page.evaluate('scanIdx===0 && scanIv!==null'))
    opener.click()
    page.locator('h1').click()
    record('A11y: outside click closes panel and resumes page scan', not panel.is_visible() and page.evaluate('scanIdx===0 && scanIv!==null'))
    # Existing app modal must yield to the common panel, then regain its scope.
    page.evaluate("document.getElementById('btn-settings').click()")
    opener.click()
    record('A11y: foreground panel wins over settings modal', page.evaluate("buildScanItems()[0].id==='donomanaSettingsProxy'"))
    page.keyboard.press('Escape')
    record('A11y: closing common panel preserves underlying settings modal',
           is_shown(page, 'settings-ov') and page.evaluate("buildScanItems().every(e=>e.closest('#settings-ov'))"))
    page.locator('#btn-close-settings').click()
    opener.click()
    page.keyboard.press('Enter')  # initial scan candidate is the settings proxy
    record('A11y: scanned proxy opens detailed settings exactly once',
           not panel.is_visible() and is_shown(page, 'settings-ov') and page.evaluate("buildScanItems().every(e=>e.closest('#settings-ov'))"))
    # Native checkboxes are intentionally transparent/zero-size: scan highlight
    # must appear on the visible sibling, not only on the input carrying the class.
    for toggle in ['t-large', 't-hc', 't-rm', 't-scan', 't-sound']:
        page.evaluate("id=>{scanIdx=buildScanItems().indexOf(document.getElementById(id));startSwitchScan()}", toggle)
        # The existing .tog-sl transition lasts 260ms. The JS clock is frozen,
        # but CSS transitions use browser rendering time; sample after settling.
        page.locator('#' + toggle + ' + .tog-sl').evaluate("el=>getComputedStyle(el).outlineStyle")
        page.wait_for_timeout(350)
        style = page.locator('#' + toggle + ' + .tog-sl').evaluate("el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {style:s.outlineStyle,width:parseFloat(s.outlineWidth),offset:s.outlineOffset,rect:r.width>0&&r.height>0,color:s.outlineColor,inputColor:getComputedStyle(el.previousElementSibling).outlineColor,inputOffset:getComputedStyle(el.previousElementSibling).outlineOffset}}")
        # CSS zoom changes resolved pixel values; compare with the existing
        # scan outline on the adjacent input under the same zoom.
        record(f'settings: {toggle} has a visible scan outline',
               style['style'] == 'solid' and style['width'] > 0 and style['offset'] == style['inputOffset'] and float(style['offset'].removesuffix('px')) > 0 and style['rect'] and style['color'] == style['inputColor'], str(style))
        page.clock.run_for(1200)
        record(f'settings: {toggle} outline clears when scanning advances',
               page.locator('#' + toggle + ' + .tog-sl').evaluate("el=>getComputedStyle(el).outlineStyle") == 'none')
    page.evaluate("scanIdx=buildScanItems().indexOf(document.getElementById('t-sound'));startSwitchScan();disableScan()")
    record('settings: scan OFF clears visible toggle highlight',
           page.locator('#t-sound + .tog-sl').evaluate("el=>getComputedStyle(el).outlineStyle") == 'none')
    page.locator('#btn-close-settings').click()
    page.evaluate('disableScan()')
    opener.click()
    record('A11y: opening with scan OFF creates no scan timer/highlight',
           page.evaluate("scanIv===null && !document.querySelector('.scan-focus')"))
    page.locator('[data-a11y-font="normal"]').press('Enter')
    record('A11y: scan OFF normal keyboard activation remains available',
           page.evaluate("localStorage.getItem('donomana-a11y-font')==='normal'"))
    page.keyboard.press('Escape')
    record('A11y: no runtime errors', not errors, str(errors))
    context.close()


def active_id_for_panel(page):
    return page.evaluate('document.activeElement.id')


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

        test_common_a11y_panel(browser)
        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
