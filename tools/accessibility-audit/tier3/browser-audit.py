# WCAG-JIS-AUDIT-1-TIER3: Browser Gate (load, console/page error, responsive overflow, A11y panel basic)
# across all 6 Tier3 apps. Read-only.
import json
import sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[2] if len(sys.argv) > 2 else "8951"
BASE = f"http://127.0.0.1:{PORT}/"
APPS = ['nazori-app','timetable-app','yomikaki-app','sugoroku-app','sst-app','slideshow-sakusei']
VIEWPORTS = [("375x667", 375, 667), ("390x844", 390, 844), ("768x1024", 768, 1024), ("1280x900", 1280, 900)]

report = {}
with sync_playwright() as p:
    browser = p.chromium.launch()
    for app in APPS:
        r = {"load_ok": False, "console_errors": [], "viewport_overflow": {}, "a11y_panel": {}, "headings_default_state": []}
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errs = []
        page.on("console", lambda msg: errs.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errs.append(str(exc)))
        try:
            page.goto(BASE + app + ".html", timeout=15000)
            page.wait_for_timeout(400)
            r["load_ok"] = True
        except Exception as e:
            r["load_ok"] = False
            r["load_error"] = str(e)
            report[app] = r
            page.close()
            continue

        r["headings_default_state"] = page.evaluate("""
            Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
              .filter(el => el.offsetParent !== null && !el.closest('[aria-hidden="true"]') && !el.closest('[inert]'))
              .map(el => el.tagName)
        """)

        try:
            page.evaluate("document.getElementById('donomanaA11yBtn').click()")
            page.wait_for_timeout(150)
            opens = page.evaluate("document.getElementById('donomanaA11yPanel').style.display === 'block'")
            page.evaluate("document.getElementById('donomanaA11yBtn').click()")
            page.wait_for_timeout(150)
            closes = page.evaluate("document.getElementById('donomanaA11yPanel').style.display !== 'block'")
            r["a11y_panel"] = {"opens": opens, "closes": closes}
        except Exception as e:
            r["a11y_panel"] = {"error": str(e)}

        for vp_name, w, h in VIEWPORTS:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(150)
            r["viewport_overflow"][vp_name] = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
        page.set_viewport_size({"width": 1280, "height": 900})
        page.evaluate('document.body.style.zoom = "200%"')
        page.wait_for_timeout(150)
        r["viewport_overflow"]["1280x900_200pct_zoom"] = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
        page.evaluate('document.body.style.zoom = ""')

        r["console_errors"] = errs
        report[app] = r
        page.close()
    browser.close()

with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
for app, r in report.items():
    ov = sum(1 for v in r.get("viewport_overflow", {}).values() if v)
    print(f"{app}: load={r['load_ok']} errors={len(r.get('console_errors',[]))} overflow_hits={ov} headings={r.get('headings_default_state')} a11y={r.get('a11y_panel')}")
