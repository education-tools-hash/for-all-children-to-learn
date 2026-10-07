# Real-browser (Playwright/Chromium) regression test for Phase
# COMMON-A11Y-HIRAGANA-LEGACY-C-OPENER-FIX-1: confirms hiragana-learn.html's
# Legacy-C A11y panel focus function (traceSampleA11yPanelFocusables) no
# longer includes the opener (#donomanaA11yBtn) in its Tab/Shift+Tab cycle,
# fixing the comment/implementation mismatch identified and reproduced in
# COMMON-A11Y-HIRAGANA-LEGACY-C-OPENER-AUDIT-1 (Case A, same bug pattern as
# katakana-app.html's pre-Pilot state).
#
# This is Automated Verification only -- it is NOT a Real Device / User
# Browser Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8937 --bind 127.0.0.1
# then: python3 tools/a11y-hiragana-legacy-c-opener-fix-1/hiragana_opener_fix_test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8937/"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS" if ok else "FAIL") + " - " + name + ((" :: " + str(detail)) if detail else ""))


def known_cert_flake(errors):
    # Pre-existing sandbox artifact confirmed independent of this Phase's diff
    # (reproduces identically on apps this Phase never touched).
    return [e for e in errors if 'ERR_CERT_AUTHORITY_INVALID' not in e]


def panel_items_count(page):
    return page.evaluate(
        "document.querySelectorAll('#donomanaA11yPanel button,#donomanaA11yPanel input,"
        "#donomanaA11yPanel select,#donomanaA11yPanel textarea,#donomanaA11yPanel a[href],"
        "#donomanaA11yPanel [tabindex]').length"
    )


def active_in_panel(page):
    return page.evaluate(
        "(() => { var p = document.getElementById('donomanaA11yPanel'); "
        "return p.contains(document.activeElement); })()"
    )


def active_is_btn(page):
    return page.evaluate("document.activeElement === document.getElementById('donomanaA11yBtn')")


def panel_open(page):
    return page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display === 'block'")


def has_focus(page):
    return page.evaluate("document.hasFocus()")


# ── Static guard: Switch Scan code must be untouched by this Phase's diff ──
# (checked against the source file on disk, independent of the browser run).
def check_switch_scan_unchanged():
    with open("hiragana-learn.html", encoding="utf-8") as f:
        src = f.read()
    ok = True
    detail = []
    if "function getScanTargets()" not in src:
        ok = False
        detail.append("getScanTargets() missing")
    if "function buildScanItems()" not in src or "return getScanTargets();" not in src:
        ok = False
        detail.append("buildScanItems() alias missing/changed")
    if ".section.active" not in src:
        ok = False
        detail.append(".section.active scan scope missing")
    if "donomanaHelpBtn" not in src:
        ok = False
        detail.append("donomanaHelpBtn scan inclusion missing")
    record("hiragana-learn: Switch Scan code (getScanTargets/.section.active/donomanaHelpBtn) unchanged", ok, detail)


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(BASE + "hiragana-learn.html", timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1000)

    # 1. Static check: the function actually driving the keydown listener no
    #    longer returns the opener in its list (the fixed-vs-buggy condition).
    includes_opener = page.evaluate(
        "(() => { var panel = document.getElementById('donomanaA11yPanel'); "
        "var list = traceSampleA11yPanelFocusables(panel); "
        "var btn = document.getElementById('donomanaA11yBtn'); "
        "return list.indexOf(btn) !== -1; })()"
    )
    record("hiragana-learn: focusables list does NOT include #donomanaA11yBtn (opener)", not includes_opener)

    # 2. Open the panel via the launcher
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    record("hiragana-learn: panel opens", panel_open(page))

    n = panel_items_count(page)
    record("hiragana-learn: panel has focusable items", n > 0, "n=%d" % n)

    # 3. Focus first item, Shift+Tab once -> must wrap to the PANEL's own last
    #    item (not the opener -- this is the exact bug repro from the Audit,
    #    now expected to no longer reproduce).
    page.evaluate(
        "document.querySelector('#donomanaA11yPanel button,#donomanaA11yPanel [tabindex]').focus()"
    )
    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    record(
        "hiragana-learn: Shift+Tab from first control wraps to panel's own last control (not opener)",
        active_in_panel(page) and not active_is_btn(page) and has_focus(page),
        {"active_in_panel": active_in_panel(page), "active_is_opener": active_is_btn(page), "hasFocus": has_focus(page)},
    )

    # 4. From here (now on last item per the fix), Tab once -> must wrap back
    #    to the panel's own first item (not the opener -- symmetric repro).
    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    record(
        "hiragana-learn: Tab from last control wraps to panel's own first control (not opener)",
        active_in_panel(page) and not active_is_btn(page),
        {"active_in_panel": active_in_panel(page), "active_is_opener": active_is_btn(page)},
    )

    # 5. Full forward Tab cycle (n+1 presses) never leaves the panel and never
    #    lands on the opener.
    escaped = False
    landed_on_opener = False
    for _ in range(n + 1):
        page.keyboard.press('Tab')
        page.wait_for_timeout(20)
        if not active_in_panel(page):
            escaped = True
        if active_is_btn(page):
            landed_on_opener = True
    record("hiragana-learn: full forward Tab cycle never escapes panel", not escaped)
    record("hiragana-learn: full forward Tab cycle never lands on opener", not landed_on_opener)

    # 6. Full backward Shift+Tab cycle never leaves the panel and never lands
    #    on the opener.
    escaped = False
    landed_on_opener = False
    for _ in range(n + 1):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(20)
        if not active_in_panel(page):
            escaped = True
        if active_is_btn(page):
            landed_on_opener = True
    record("hiragana-learn: full backward Shift+Tab cycle never escapes panel", not escaped)
    record("hiragana-learn: full backward Shift+Tab cycle never lands on opener", not landed_on_opener)

    # 7. Escape closes the panel and returns focus to the launcher
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record("hiragana-learn: Escape closes panel", not panel_open(page))
    record("hiragana-learn: focus returns to launcher after Escape", active_is_btn(page))

    # 8. Settings Proxy still works (independent of the opener-inclusion fix)
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(100)
    page.click("#donomanaSettingsProxy")
    page.wait_for_timeout(250)
    record("hiragana-learn: panel closes after Settings Proxy click", not panel_open(page))
    opened_settings = page.evaluate(
        "document.querySelector('.section.active') && document.querySelector('.section.active').id === 'settings'"
    )
    record("hiragana-learn: settings tab opens via proxy", opened_settings)

    # 9. traceSampleViewer's own keyboard branch (the OTHER branch of the same
    #    shared keydown listener) must remain unbroken. Inject a minimal valid
    #    trace record directly (no real localStorage needed) and open the
    #    Viewer through its own real function, then confirm its own Tab trap
    #    and Escape close still work exactly as before this Phase's diff.
    page.evaluate(
        """
        (() => {
          function fakeStroke(seed) {
            var flat = [];
            for (var i = 0; i < 24; i++) { flat.push((seed + i * 3) % 1001, (seed + i * 5) % 1001); }
            return flat;
          }
          var sample = { version: 1, coordinateSpace: 'normalized-1000', strokes: [fakeStroke(10)] };
          learningLog.unshift({ time: new Date().toISOString(), type: 'trace',
            data: { kana: 'あ', tracingJudgmentLevel: 'standard', traceSample: sample }, schemaVersion: 1 });
          openTraceSampleViewer(0);
        })()
        """
    )
    page.wait_for_timeout(150)
    viewer_open = page.evaluate("traceSampleViewerIsOpen()")
    record("hiragana-learn: traceSampleViewer opens via its own real function", viewer_open)
    if viewer_open:
        vn = page.evaluate(
            "document.querySelectorAll('#traceSampleViewer button,#traceSampleViewer input,"
            "#traceSampleViewer select,#traceSampleViewer textarea,#traceSampleViewer a[href],"
            "#traceSampleViewer [tabindex]').length"
        )
        page.evaluate(
            "(() => { var items = document.querySelectorAll('#traceSampleViewer button,"
            "#traceSampleViewer [tabindex]'); for (var i=0;i<items.length;i++){"
            " if (items[i].offsetParent !== null && !items[i].disabled && items[i].tabIndex !== -1)"
            " { items[i].focus(); return; } } })()"
        )
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(50)
        viewer_contains_active = page.evaluate(
            "document.getElementById('traceSampleViewer').contains(document.activeElement)"
        )
        record(
            "hiragana-learn: traceSampleViewer's own Tab trap still contains focus (non-regression)",
            viewer_contains_active,
            {"vn": vn},
        )
        page.keyboard.press('Escape')
        page.wait_for_timeout(100)
        record(
            "hiragana-learn: traceSampleViewer closes via Escape (non-regression)",
            not page.evaluate("traceSampleViewerIsOpen()"),
        )

    real_errors = known_cert_flake(errors)
    record("hiragana-learn: no JS errors beyond known sandbox cert flake", len(real_errors) == 0, real_errors)

    browser.close()

check_switch_scan_unchanged()

total = len(RESULTS)
passed = sum(1 for _, ok, _ in RESULTS if ok)
print("\n%d/%d checks passed." % (passed, total))
sys.exit(0 if passed == total else 1)
