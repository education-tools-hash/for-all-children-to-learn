# Real-browser (Playwright/Chromium) regression test for Phase
# COMMON-A11Y-STRICT-CONTAINMENT-PILOT-WAVE-1: confirms the common A11y panel's
# Tab/Shift+Tab strict containment and focus-return now work for the 4 Pilot
# apps (timetable-app, directions-app, okane-app, katakana-app), per
# docs/design-system/donomana-common-a11y-widget-design-v1_0.md.
#
# This is Automated Verification only -- it is NOT a Real Device / User
# Browser Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8935 --bind 127.0.0.1
# then: python3 tools/a11y-strict-containment-pilot-1/strict_containment_pilot_test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
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


def run_app(page, appname, extra_checks=None):
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(BASE + appname + ".html", timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1000)

    # 1. Open the panel via the launcher
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    record(appname + ": panel opens", panel_open(page))

    n = panel_items_count(page)
    record(appname + ": panel has focusable items", n > 0, "n=%d" % n)

    # 2. Focus first item, Shift+Tab once -> must wrap to last item, never escape
    page.evaluate(
        "document.querySelector('#donomanaA11yPanel button,#donomanaA11yPanel [tabindex]').focus()"
    )
    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    record(
        appname + ": Shift+Tab from first control stays in panel (known P1 check)",
        active_in_panel(page) and has_focus(page),
        {"active_in_panel": active_in_panel(page), "document.hasFocus": has_focus(page)},
    )

    # 3. From here (now on last item), Tab once -> must wrap back to first item
    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    record(appname + ": Tab from last control wraps to first (stays in panel)", active_in_panel(page))

    # 4. Full forward Tab cycle (n+1 presses) never leaves the panel
    escaped = False
    for _ in range(n + 1):
        page.keyboard.press('Tab')
        page.wait_for_timeout(20)
        if not active_in_panel(page):
            escaped = True
            break
    record(appname + ": full forward Tab cycle never escapes panel", not escaped)

    # 5. Full backward Shift+Tab cycle never leaves the panel
    escaped = False
    for _ in range(n + 1):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(20)
        if not active_in_panel(page):
            escaped = True
            break
    record(appname + ": full backward Shift+Tab cycle never escapes panel", not escaped)

    # 6. Escape closes the panel and returns focus to the launcher
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(appname + ": Escape closes panel", not panel_open(page))
    record(appname + ": focus returns to launcher after Escape", active_is_btn(page))

    # 7. Settings Proxy still works after containment is wired
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(100)
    page.click("#donomanaSettingsProxy")
    page.wait_for_timeout(250)
    record(appname + ": panel closes after Settings Proxy click", not panel_open(page))
    if extra_checks:
        extra_checks(page)

    real_errors = known_cert_flake(errors)
    record(appname + ": no JS errors beyond known sandbox cert flake", len(real_errors) == 0, real_errors)


def timetable_extra(page):
    opened = page.evaluate("document.getElementById('sec-settings').classList.contains('active')")
    record("timetable-app: settings tab opens via proxy", opened)


def directions_extra(page):
    # directions-app's settings proxy calls nav('settings'); just confirm no crash
    # and the common panel genuinely closed (already asserted above).
    pass


def okane_extra(page):
    opened = page.evaluate(
        "document.getElementById('settingsModalOverlay').classList.contains('active')"
    )
    record("okane-app: settings modal opens via proxy", opened)
    page.evaluate("closeSettingsModal()")
    page.wait_for_timeout(100)

    # Modal Coexistence: open the help modal, THEN open the A11y panel on top of
    # it, and confirm the A11y panel's own containment (not the modal's) owns
    # Tab while it's open, with no JS error / no escape either way.
    page.evaluate("openHelpModal()")
    page.wait_for_timeout(100)
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(100)
    record("okane-app: A11y panel opens on top of an already-open app modal", panel_open(page))
    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    record(
        "okane-app: Tab while modal+panel both open stays inside the A11y panel",
        active_in_panel(page),
    )
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record("okane-app: Escape with modal still open only closes the A11y panel", not panel_open(page))
    help_still_open = page.evaluate(
        "document.getElementById('helpModalOverlay').classList.contains('active')"
    )
    record("okane-app: app modal (help) remains open after A11y panel Escape", help_still_open)
    # Now confirm the app modal's OWN Focus Trap still works once the A11y
    # panel is closed again (regression guard for the pre-existing Trap).
    active_before = page.evaluate("document.activeElement && document.activeElement.id")
    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    in_modal = page.evaluate(
        "(() => { var m = document.getElementById('helpModalOverlay'); "
        "return m.contains(document.activeElement); })()"
    )
    record("okane-app: app modal's own Focus Trap still contains Tab after panel closes", in_modal)
    page.evaluate("closeHelpModal()")


def katakana_extra(page):
    opened = page.evaluate(
        "document.querySelector('.section.active') && "
        "document.querySelector('.section.active').id === 'settings'"
    )
    record("katakana-app: settings tab opens via proxy", opened)


with sync_playwright() as p:
    browser = p.chromium.launch()

    page1 = browser.new_page()
    run_app(page1, "timetable-app", timetable_extra)

    page2 = browser.new_page()
    run_app(page2, "directions-app", directions_extra)

    page3 = browser.new_page()
    run_app(page3, "okane-app", okane_extra)

    page4 = browser.new_page()
    run_app(page4, "katakana-app", katakana_extra)

    browser.close()

total = len(RESULTS)
passed = sum(1 for _, ok, _ in RESULTS if ok)
print("\n%d/%d checks passed." % (passed, total))
sys.exit(0 if passed == total else 1)
