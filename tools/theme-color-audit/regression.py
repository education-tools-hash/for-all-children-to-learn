# Real-browser regression test (AUDIT-35-FIX-2): confirms theme-color
# duplicate resolution across all 35 apps - exactly one <meta name="theme-color">
# per app, the hand-authored value preserved for the 3 previously-affected
# apps, the generator default preserved for the rest, page loads with 0
# console errors, and representative responsive checks show no layout
# regression (this Phase is head-metadata-only, so no visual change is
# expected).
#
# Requires a local static server for the repo root, e.g.:
#   python -m http.server 8935 --bind 127.0.0.1
# then: python tools/theme-color-audit/regression.py
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
EXPECTED_HAND_AUTHORED = {
    "kyou-no-kiroku": "#4A4270",
    "mogura-tataki": "#4A4270",
    "ongaku-app": "#0f0e17",
}
VIEWPORTS = [(375, 667), (390, 844), (768, 1024), (1280, 900)]
RESULTS = []

def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))

def main():
    with open("apps-data.json", encoding="utf-8") as f:
        apps = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for app in apps:
            appname = app["filename"]
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            console_errors = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.goto(BASE + appname + ".html", timeout=20000)
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                page.wait_for_timeout(1000)

            colors = page.evaluate("Array.from(document.querySelectorAll('meta[name=\"theme-color\"]')).map(m => m.getAttribute('content'))")
            record(f"{appname}: exactly 1 theme-color meta", len(colors) == 1, str(colors))

            if appname in EXPECTED_HAND_AUTHORED:
                expected = EXPECTED_HAND_AUTHORED[appname]
                record(f"{appname}: hand-authored value preserved ({expected})", colors == [expected], str(colors))
            elif len(colors) == 1:
                record(f"{appname}: generator default preserved (#00A99D)", colors == ["#00A99D"], str(colors))

            record(f"{appname}: console error count == 0", len(console_errors) == 0, str(console_errors[:3]))
            page.close()

        # responsive spot-check on the 3 previously-affected apps only (head-only change, no visual impact expected)
        for appname in EXPECTED_HAND_AUTHORED:
            for w, h in VIEWPORTS:
                page = browser.new_page(viewport={"width": w, "height": h})
                page.goto(BASE + appname + ".html", timeout=20000)
                try:
                    page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:
                    page.wait_for_timeout(1000)
                scroll_w = page.evaluate("document.documentElement.scrollWidth")
                client_w = page.evaluate("document.documentElement.clientWidth")
                record(f"{appname} @ {w}x{h}: no horizontal scroll", scroll_w <= client_w + 1, f"scrollWidth={scroll_w} clientWidth={client_w}")
                page.close()

        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed across {len(apps)} apps")
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
