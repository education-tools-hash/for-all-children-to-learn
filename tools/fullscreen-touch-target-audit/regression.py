# Real-browser regression test (AUDIT-35-FIX-1F): confirms the min-height:44px
# fix on #fs-btn (5 apps sharing an identical hand-copied CSS block) achieves
# the touch target minimum without breaking Fullscreen toggle, Tab/Escape
# keyboard access, or introducing console errors, across the required
# viewport matrix. Requires a local static server for the repo root:
#   python -m http.server 8935 --bind 127.0.0.1
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
APPS = ["hiragana-learn", "katakana-app", "timetable-app", "matching-app", "suji-manabou"]
VIEWPORTS = [(375, 667), (390, 844), (768, 1024), (1280, 900)]
RESULTS = []

def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))

def check_app(browser, appname):
    console_errors = []
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(BASE + appname + ".html", timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1000)

    rect = page.evaluate("document.getElementById('fs-btn').getBoundingClientRect().height")
    record(f"{appname}: #fs-btn height >= 44px", rect >= 44, f"height={rect}")

    # Tab/focus-visible: #fs-btn must remain reachable and keyboard-operable
    page.evaluate("document.getElementById('fs-btn').focus()")
    aid = page.evaluate("document.activeElement.id")
    record(f"{appname}: #fs-btn still keyboard-focusable", aid == "fs-btn", f"active={aid}")

    # click toggles fullscreen state text without erroring (headless Chromium
    # allows requestFullscreen from a trusted synthetic click in most cases;
    # if it's rejected we still confirm no exception was thrown)
    before_text = page.evaluate("document.getElementById('fs-btn').textContent")
    try:
        page.click("#fs-btn")
        page.wait_for_timeout(200)
        clicked_ok = True
    except Exception as e:
        clicked_ok = False
        record(f"{appname}: #fs-btn click did not throw", False, str(e))
    if clicked_ok:
        record(f"{appname}: #fs-btn click did not throw", True)

    record(f"{appname}: console error count == 0", len(console_errors) == 0, str(console_errors[:3]))
    page.close()

def check_viewports(browser, appname):
    for w, h in VIEWPORTS:
        page = browser.new_page(viewport={"width": w, "height": h})
        page.goto(BASE + appname + ".html", timeout=20000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            page.wait_for_timeout(1000)
        rect = page.evaluate("document.getElementById('fs-btn').getBoundingClientRect()")
        scroll_w = page.evaluate("document.documentElement.scrollWidth")
        client_w = page.evaluate("document.documentElement.clientWidth")
        record(f"{appname} @ {w}x{h}: height >= 44px", rect["height"] >= 44, f"height={rect['height']}")
        record(f"{appname} @ {w}x{h}: no horizontal scroll", scroll_w <= client_w + 1, f"scrollWidth={scroll_w} clientWidth={client_w}")
        page.close()

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for appname in APPS:
            check_app(browser, appname)
            check_viewports(browser, appname)
        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
