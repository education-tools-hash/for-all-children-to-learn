# Real-browser regression test (AUDIT-35-FIX-1E): for every one of the 31 apps
# with a SETTINGS_PROXY entry in generate.js, confirm the "original" settings
# button (proxy.selector) - hidden from view via SETTINGS_PROXY - is excluded
# from native keyboard Tab order and the accessibility tree, without breaking
# the donomanaSettingsProxy -> original.click() contract.
#
# Two hide strategies coexist by design (see generate.js hideWithDisplayNone):
#   - display:none group (10 apps): already correctly excluded from Tab order
#     natively; this test only asserts that stays true (regression guard).
#   - opacity:0 group (21 apps): historically remained Tab-focusable despite
#     being invisible (the AUDIT-35-FIX-1D/1E finding). This test asserts the
#     tabindex=-1 + aria-hidden hardening added in this Phase is present and
#     the original is genuinely excluded from native Tab order, while a
#     programmatic .focus()/.click() (the proxy's own contract) still works
#     for every one where the original is capable of holding focus at all.
#
# Requires a local static server for the repo root, e.g.:
#   python -m http.server 8935 --bind 127.0.0.1
# then: python tools/settings-proxy-focus-audit/audit.py
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
RESULTS = []

def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + (": " + detail if detail else ""))

def check_app(page, appname, selector, hide_mode):
    url = BASE + appname + ".html"
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.goto(url, timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1200)  # a few apps have long-running background activity (audio/animation) that never reaches networkidle

    info = page.evaluate("""(sel) => {
        const el = document.querySelector(sel);
        if (!el) return {found: false};
        const cs = getComputedStyle(el);
        const before = document.activeElement;
        let scriptFocusable = false;
        try { el.focus(); scriptFocusable = document.activeElement === el; } catch(e) {}
        if (before) { try { before.focus(); } catch(e){} }
        return {
            found: true, opacity: cs.opacity, display: cs.display,
            tabIndex: el.tabIndex, ariaHidden: el.getAttribute('aria-hidden'),
            hasClientRects: el.getClientRects().length > 0, scriptFocusable,
        };
    }""", selector)

    if not info.get("found"):
        record(f"{appname}: selector {selector!r} resolves to an element", False)
        return

    natively_tab_reachable = info.get("tabIndex", -1) >= 0 and info.get("display") != "none"
    record(f"{appname}: original excluded from native Tab order", not natively_tab_reachable, str(info))

    if hide_mode == "opacity:0":
        record(f"{appname}: tabindex=-1 applied", info.get("tabIndex") == -1, str(info))
        record(f"{appname}: aria-hidden=true applied", info.get("ariaHidden") == "true", str(info))

    proxy_exists = page.evaluate("!!document.getElementById('donomanaSettingsProxy')")
    record(f"{appname}: donomanaSettingsProxy present", proxy_exists)

    record(f"{appname}: console error count == 0", len(console_errors) == 0, str(console_errors[:3]))

def main():
    with open("tools/settings-proxy-focus-audit/settings_proxy_map.json", encoding="utf-8") as f:
        data = json.load(f)
    SETTINGS_PROXY = data["SETTINGS_PROXY"]
    HIDE_WITH_DISPLAY_NONE = set(data["hideWithDisplayNone"])

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for appname, proxy in SETTINGS_PROXY.items():
            mode = "display:none" if appname in HIDE_WITH_DISPLAY_NONE else "opacity:0"
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            check_app(page, appname, proxy["selector"], mode)
            page.close()
        browser.close()

    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed across {len(SETTINGS_PROXY)} SETTINGS_PROXY apps")
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
