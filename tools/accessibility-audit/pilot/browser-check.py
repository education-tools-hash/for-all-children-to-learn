# ACCESSIBILITY-AUDIT-PILOT-1 automated browser check across 5 pilot apps.
# Read-only: does not modify any repo file.
#
# Usage (see docs/accessibility/pilot/accessibility-audit-pilot-1-browser-results.md
# and tools/accessibility-audit/README.md for the local server standard):
#   python -m http.server <port> --bind 127.0.0.1 --directory <repo-root>
#   python tools/accessibility-audit/pilot/browser-check.py <output.json> [port]
import json
import sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[2] if len(sys.argv) > 2 else "8940"
BASE = f"http://127.0.0.1:{PORT}/"
VIEWPORTS = [("375x667", 375, 667), ("390x844", 390, 844), ("768x1024", 768, 1024), ("1280x900", 1280, 900)]

APPS = ["matching-app", "okane-app", "gaze-keyboard", "tokei-app", "timetable-app"]

# app-specific modal open/close pairs reachable without gameplay setup.
# (open_js, close_js, modal_selector, label)
MODALS = {
    "matching-app": [
        ("document.getElementById('donomanaHelpBtn').click()", "closeHowOv()", "#how-ov", "how-ov"),
        ("document.getElementById('btn-settings').click()", "$('settings-ov').classList.remove('show');setModalBackgroundInert(false);", "#settings-ov", "settings-ov"),
        ("document.getElementById('record-open-btn').click()", "closeRecordOv()", "#record-ov", "record-ov"),
    ],
    "okane-app": [
        ("openHelpModal()", "closeHelpModal()", "#helpModalOverlay", "helpModalOverlay"),
        ("openSettingsModal()", "closeSettingsModal()", "#settingsModalOverlay", "settingsModalOverlay"),
        ("openRecordsModal()", "closeRecordsModal()", "#recordsModalOverlay", "recordsModalOverlay"),
        ("openCustomModal()", "closeCustomModal()", "#customModalOverlay", "customModalOverlay"),
    ],
    "gaze-keyboard": [
        ("document.getElementById('settingsBtn').click()", "document.getElementById('settingsClose').click()", "#settingsModal .settings-modal", "settingsModal"),
    ],
    "tokei-app": [
        ("openHelp()", "closeHelp()", "#helpModal", "helpModal"),
        ("openRecordHistory()", "closeRecordHistory()", "#recordModal", "recordModal"),
    ],
    "timetable-app": [],
}

report = {}

with sync_playwright() as p:
    browser = p.chromium.launch()
    for app in APPS:
        app_report = {"console_errors": [], "load_ok": False, "viewport_overflow": {}, "headings_rendered": [], "modals": {}, "a11y_panel": {}}
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        page.on("console", lambda msg: errs.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errs.append(str(exc)))
        try:
            page.goto(BASE + app + ".html", timeout=15000)
            page.wait_for_timeout(400)
            app_report["load_ok"] = True
        except Exception as e:
            app_report["load_ok"] = False
            app_report["load_error"] = str(e)
            report[app] = app_report
            page.close()
            continue

        # rendered heading sequence, i.e. what a heading-nav SR user would actually reach.
        # Pilot lesson (see methodology review): offsetParent!==null alone is NOT enough -
        # opacity:0+inert modals (tokei-app pattern) stay offsetParent-truthy, so an
        # aria-hidden/inert ancestor check must be combined with it. display:none-only
        # modals (okane-app/matching-app pattern) are excluded by offsetParent alone but
        # carry no aria-hidden/inert marker, so neither check alone is sufficient - both
        # together give the correct default-state (no modal open) AT-exposed order.
        app_report["headings_rendered"] = page.evaluate("""
            Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
              .filter(el => el.offsetParent !== null && !el.closest('[aria-hidden="true"]') && !el.closest('[inert]'))
              .map(el => ({tag: el.tagName, text: el.textContent.trim().slice(0,40)}))
        """)

        # A11y panel basic check
        try:
            page.evaluate("document.getElementById('donomanaA11yBtn').click()")
            page.wait_for_timeout(150)
            panel_open = page.evaluate("document.getElementById('donomanaA11yPanel').style.display === 'block'")
            page.evaluate("document.getElementById('donomanaA11yBtn').click()")
            page.wait_for_timeout(150)
            panel_closed = page.evaluate("document.getElementById('donomanaA11yPanel').style.display !== 'block'")
            app_report["a11y_panel"] = {"opens": panel_open, "closes": panel_closed}
        except Exception as e:
            app_report["a11y_panel"] = {"error": str(e)}

        # per-app modal checks
        for open_js, close_js, sel, label in MODALS.get(app, []):
            m = {}
            try:
                before_focus = page.evaluate("document.activeElement.id || document.activeElement.tagName")
                page.evaluate(open_js)
                page.wait_for_timeout(150)
                m["visible_after_open"] = page.eval_on_selector(sel, "el => !!(el.offsetParent !== null || getComputedStyle(el).display !== 'none')") if page.query_selector(sel) else False
                m["has_aria_labelledby_or_label"] = page.eval_on_selector(sel, "el => !!(el.getAttribute('aria-labelledby') || el.getAttribute('aria-label'))") if page.query_selector(sel) else False
                m["focus_inside_after_open"] = page.evaluate(f"""(() => {{
                    const m = document.querySelector('{sel}');
                    return m ? m.contains(document.activeElement) : false;
                }})()""")
                # Escape close
                page.keyboard.press("Escape")
                page.wait_for_timeout(150)
                m["closed_by_escape"] = not (page.eval_on_selector(sel, "el => el.offsetParent !== null") if page.query_selector(sel) else False)
                # reopen + explicit close call
                page.evaluate(open_js)
                page.wait_for_timeout(150)
                page.evaluate(close_js)
                page.wait_for_timeout(150)
                m["closed_by_close_fn"] = not (page.eval_on_selector(sel, "el => el.offsetParent !== null") if page.query_selector(sel) else False)
            except Exception as e:
                m["error"] = str(e)
            app_report["modals"][label] = m

        # responsive overflow check
        for vp_name, w, h in VIEWPORTS:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(150)
            overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
            app_report["viewport_overflow"][vp_name] = overflow
        page.set_viewport_size({"width": 1280, "height": 900})
        page.evaluate('document.body.style.zoom = "200%"')
        page.wait_for_timeout(150)
        app_report["viewport_overflow"]["1280x900_200pct_zoom"] = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
        page.evaluate('document.body.style.zoom = ""')

        app_report["console_errors"] = errs
        report[app] = app_report
        page.close()
    browser.close()

with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print("wrote", sys.argv[1])
