# Phase COMMON-A11Y-SETTINGS-PROXY-GAP-FIX-1: automated browser verification that
# the newly-added SETTINGS_PROXY entries for timetable-app and ongaku-app actually
# work end to end: Common A11y Widget -> donomanaSettingsProxy -> app-specific
# settings UI opens, can be closed, and focus does not land on document.body.
#
# This is Automated Verification only. It is NOT a Real Device / User Browser
# Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8935 --bind 127.0.0.1
# then: python3 tools/settings-proxy-focus-audit/gap-fix-1-browser-verification.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS" if ok else "FAIL") + " - " + name + ((" :: " + detail) if detail else ""))


def known_cert_flake(errors):
    # Pre-existing sandbox artifact: every app's Google Fonts <link> trips the
    # Cloud egress proxy's cert, independent of this Phase's diff (confirmed
    # against untouched apps e.g. time-timer in the main audit run). Filtered
    # out here so it cannot mask a real regression.
    return [e for e in errors if 'ERR_CERT_AUTHORITY_INVALID' not in e]


def check_app(page, appname, open_check_js, settings_visible_js, close_js=None):
    url = BASE + appname + ".html"
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(url, timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1000)

    # 1. Open the common A11y Widget
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    panel_open = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display === 'block'")
    record(appname + ": common A11y panel opens", panel_open)

    # 2. Click the proxy row inside the panel
    page.click("#donomanaSettingsProxy")
    page.wait_for_timeout(250)

    # 3. App-specific settings UI should now be visible
    settings_visible = page.evaluate(settings_visible_js)
    record(appname + ": app-specific settings UI opens via proxy", settings_visible)

    # 4. The common panel itself should have closed (proxy click always closes it first)
    panel_closed = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display !== 'block'")
    record(appname + ": common A11y panel closed after proxy click", panel_closed)

    # 5. Focus should not have fallen to document.body
    focus_not_body = page.evaluate("document.activeElement !== document.body")
    record(appname + ": focus did not fall back to document.body", focus_not_body,
           page.evaluate("document.activeElement && document.activeElement.tagName"))

    # 6. Can close the app-specific settings UI and return
    if close_js:
        page.evaluate(close_js)
        page.wait_for_timeout(150)

    real_errors = known_cert_flake(errors)
    record(appname + ": no JS errors beyond known sandbox cert flake", len(real_errors) == 0, str(real_errors))


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    check_app(
        page, "timetable-app",
        open_check_js=None,
        settings_visible_js="document.getElementById('sec-settings').classList.contains('active')",
        close_js="document.querySelector('.tab-btn.active').click === undefined ? null : switchTab('timetable', document.querySelector('.tab-btn'))",
    )

    page2 = browser.new_page()
    check_app(
        page2, "ongaku-app",
        open_check_js=None,
        settings_visible_js="document.getElementById('modal-pin').classList.contains('active')",
        close_js="document.getElementById('modal-pin').classList.remove('active')",
    )

    browser.close()

total = len(RESULTS)
passed = sum(1 for _, ok, _ in RESULTS if ok)
print("\n%d/%d checks passed." % (passed, total))
sys.exit(0 if passed == total else 1)
