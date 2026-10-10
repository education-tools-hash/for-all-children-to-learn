# Real-browser (Playwright/Chromium) + static regression test for Phase
# COMMON-A11Y-MATCHING-APP-STRICT-CONTAINMENT-FIX-1: confirms the new
# document-level keydown connector added to matching-app.html --
#   document.addEventListener('keydown', function (e) {
#     if (window.trapA11yPanelFocus) window.trapA11yPanelFocus(e);
#   });
# -- wires the shared GLOBAL-1A strict-containment helper
# (window.trapA11yPanelFocus) for the first time (MATCHING-APP-COMMON-A11Y-
# CONTAINMENT-AUDIT-1 confirmed it was previously defined but never called),
# eliminates the Forward-Tab background-UI escape and the Reverse-Shift+Tab
# browser-chrome escape (document.hasFocus() === false) reproduced in that
# Audit, and does not alter or duplicate the pre-existing 6-modal Tab Focus
# Trap (how-ov/settings-ov/edit-ov/record-ov/vs-result-ov/clear-ov) or its
# own A11y-panel ownership guard.
#
# [STATIC] exactly one new connector; generator-owned a11y-panel block
#          byte-identical to fresh origin/main; existing 6-modal Trap
#          byte-identical to fresh origin/main (including its ownership
#          guard line).
# [A] A11y panel Tab/Shift+Tab containment: open/initial focus/forward
#     cycle/reverse cycle/no background-UI escape/no browser chrome escape/
#     document.hasFocus() maintained throughout/Escape/focus return.
# [B] Coexistence ownership spy: with a modal (how-ov) force-opened via JS
#     while the A11y panel is ALSO open via a real click (an artificial
#     state beyond what Audit found reachable through normal interaction,
#     tested anyway per the Wave A/B precedent of defensive verification),
#     confirm that Tab/Shift+Tab presses call .focus() only on the A11y
#     panel's own elements, never on the modal's first/last focusable --
#     i.e. the connector and the existing Trap's ownership guard agree, no
#     double-processing.
# [C] Spot-check re-confirmation that the pre-existing 6-modal Trap and
#     Switch Scan behavior are unaffected (full coverage lives in
#     tools/matching-modal-focus-trap/focus_trap_test.py (62/62) and
#     tools/matching-modal-switch-scan/switch_scan_test.py (56/56), both
#     re-run unchanged against this exact checkpoint as part of this
#     Phase's validation -- not reimplemented here to avoid duplication).
# [D] Settings Proxy non-regression smoke check (full coverage in the
#     focus_trap_test.py SETTINGS_PROXY section above).
#
# This is Automated Verification only -- it is NOT a Real Device / User
# Browser Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8935 --bind 127.0.0.1
# then: python3 tools/a11y-matching-containment/matching_containment_test.py
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_FILE = REPO_ROOT / "matching-app.html"
BASE = "http://127.0.0.1:8935/matching-app.html"
RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append({"name": name, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL") + " - " + name + ((" :: " + str(detail)) if detail else ""))


def active_id(page):
    return page.evaluate("document.activeElement && document.activeElement.id")


def in_panel_or_launcher(page):
    return page.evaluate(
        """() => {
            const panel = document.getElementById('donomanaA11yPanel');
            const btn = document.getElementById('donomanaA11yBtn');
            const active = document.activeElement;
            return panel.contains(active) || active === btn;
        }"""
    )


# ---------------------------------------------------------------- STATIC ---
def run_static_checks():
    text = APP_FILE.read_text(encoding="utf-8")

    connector_pattern = re.compile(
        r"document\.addEventListener\(\s*'keydown'\s*,\s*function\s*\(e\)\s*\{\s*"
        r"if\s*\(\s*window\.trapA11yPanelFocus\s*\)\s*window\.trapA11yPanelFocus\(e\)\s*;?\s*\}\s*\)\s*;"
    )
    matches = connector_pattern.findall(text)
    record("STATIC: exactly one new connector listener present", len(matches) == 1, f"found={len(matches)}")

    # generator-owned a11y-panel block (between the literal HTML comment
    # markers) must be byte-identical to fresh origin/main.
    block_match = re.search(
        r"<!-- a11y-panel: 自動挿入 \(generate\.js\) -->(.*?)<!-- /a11y-panel -->",
        text,
        re.S,
    )
    record("STATIC: generator-owned a11y-panel block markers found", block_match is not None)
    if block_match:
        import hashlib

        current_hash = hashlib.md5(block_match.group(1).encode("utf-8")).hexdigest()
        # Reference hash computed from fresh origin/main at Phase start
        # (COMMON-A11Y-MATCHING-APP-STRICT-CONTAINMENT-FIX-1), confirmed via
        # `git show origin/main:matching-app.html | sed -n '683,947p' | md5sum`
        # against the exact same marker-delimited span.
        REFERENCE_HASH = "dbf4612271afb82d4a03ffe6a77d9238"
        record(
            "STATIC: generator-owned a11y-panel block byte-identical to origin/main",
            current_hash == REFERENCE_HASH,
            f"hash={current_hash}",
        )

    # existing 6-modal Tab Trap + its ownership guard line must be unchanged.
    trap_match = re.search(
        r"document\.addEventListener\('keydown',e=>\{\n  if\(e\.key!=='Tab'\)return;\n  if\(scanMode\)return;"
        r".*?if\(e\.shiftKey\)\{last\.focus\(\);\}else\{first\.focus\(\);\}\n\}\);",
        text,
        re.S,
    )
    record("STATIC: existing 6-modal Tab Trap found intact", trap_match is not None)
    if trap_match:
        import hashlib

        trap_hash = hashlib.md5(trap_match.group(0).encode("utf-8")).hexdigest()
        REFERENCE_TRAP_HASH = "99f5fc1c60a9c7eee87cc8ab766a4306"
        record(
            "STATIC: existing 6-modal Tab Trap byte-identical to origin/main",
            trap_hash == REFERENCE_TRAP_HASH,
            f"hash={trap_hash}",
        )
    record(
        "STATIC: existing ownership guard line present unchanged",
        "a11yPanel.style.display==='block'&&(active===a11yBtn||a11yPanel.contains(active))" in text,
    )
    trap_end_idx = text.find("if(e.shiftKey){last.focus();}else{first.focus();}\n});")
    connector_idx = text.find("if (window.trapA11yPanelFocus) window.trapA11yPanelFocus(e);")
    a11y_block_end_idx = text.find("<!-- /a11y-panel -->")
    record(
        "STATIC: new connector is positioned after the existing 6-modal Trap and outside the generator-owned a11y-panel block",
        trap_end_idx != -1 and connector_idx != -1 and a11y_block_end_idx != -1
        and a11y_block_end_idx < trap_end_idx < connector_idx,
    )


# --------------------------------------------------------------- BROWSER ---
def run_browser_checks():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless=True
        )
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(BASE)
        page.wait_for_timeout(300)

        # === A. A11y panel Tab / Shift+Tab containment (the actual fix) ===
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        record("A. panel opens on click", page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display") == "block")
        record("A. initial focus on launcher", active_id(page) == "donomanaA11yBtn")

        hf_ever_false = False
        escaped_fwd = False
        for i in range(20):
            page.keyboard.press("Tab")
            page.wait_for_timeout(25)
            if not page.evaluate("document.hasFocus()"):
                hf_ever_false = True
            if not in_panel_or_launcher(page):
                escaped_fwd = True
        record("A. Forward Tab x20 never escapes panel/launcher (AFTER FIX)", not escaped_fwd)
        record("A. document.hasFocus() stayed true throughout forward cycle", not hf_ever_false)

        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        record("A. Escape closes panel", page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display") == "none")
        record("A. focus returns to launcher after Escape", active_id(page) == "donomanaA11yBtn")

        # Reverse direction: this is where the Audit reproduced BODY + hasFocus()===false.
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        hf_ever_false_rev = False
        escaped_rev = False
        body_hit = False
        for i in range(20):
            page.keyboard.press("Shift+Tab")
            page.wait_for_timeout(25)
            hf = page.evaluate("document.hasFocus()")
            if not hf:
                hf_ever_false_rev = True
            tag = page.evaluate("document.activeElement ? document.activeElement.tagName : 'null'")
            if tag == "BODY":
                body_hit = True
            if not in_panel_or_launcher(page):
                escaped_rev = True
        record("A. Reverse Shift+Tab x20 never escapes panel/launcher (AFTER FIX)", not escaped_rev)
        record("A. Reverse Shift+Tab never lands on BODY (AFTER FIX, Audit reproduced this pre-fix)", not body_hit)
        record("A. document.hasFocus() stayed true throughout reverse cycle (AFTER FIX, browser chrome escape eliminated)", not hf_ever_false_rev)

        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        record("A. Escape closes panel (reverse-cycle variant)", page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display") == "none")
        record("A. focus returns to launcher after Escape (reverse-cycle variant)", active_id(page) == "donomanaA11yBtn")

        # Boundary checks: first + Shift+Tab -> last ; last + Tab -> first (within panel items incl. opener/reset etc.)
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        panel_items = page.evaluate(
            """() => {
                const panel = document.getElementById('donomanaA11yPanel');
                const items = Array.from(panel.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
                    .filter(el => !el.disabled && !el.hasAttribute('hidden') && el.getClientRects().length > 0);
                return items.map(x => x.id || x.tagName);
            }"""
        )
        record("A. panel has focusable items", len(panel_items) > 0, panel_items)
        # Launcher itself is intentionally excluded from the panel's own Tab cycle
        # (the historical "opener inclusion" bug elsewhere was exactly the opposite
        # of this). Shift+Tab from the launcher must wrap to the panel's LAST own
        # item, not treat the launcher as part of that cycle.
        first_panel_item = panel_items[0] if panel_items else None
        last_panel_item = panel_items[-1] if panel_items else None
        page.keyboard.press("Shift+Tab")  # from launcher backward -> should wrap to panel's last item
        page.wait_for_timeout(50)
        last_active = active_id(page)
        record(
            "A. launcher+Shift+Tab wraps to panel's own last item (launcher excluded from cycle)",
            last_active == last_panel_item,
            last_active,
        )
        page.keyboard.press("Tab")  # from panel's last item forward -> should wrap to panel's first item
        page.wait_for_timeout(50)
        record(
            "A. panel's last item+Tab wraps to panel's own first item",
            active_id(page) == first_panel_item,
            active_id(page),
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # === B. Coexistence ownership spy (artificial simultaneous-open) ===
        # Install a focus() spy on how-ov's own first/last focusables BEFORE
        # opening it, then force-open how-ov directly via JS (bypassing the
        # normal click path, to construct the coexistence state the Audit
        # found unreachable through real interaction) while the A11y panel
        # is ALSO open via a real click.
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        page.evaluate(
            """() => {
                window.__howFocusCalls = { first: 0, last: 0 };
                const modal = document.getElementById('how-ov');
                document.getElementById('hdr').inert = true;
                document.getElementById('main').inert = true;
                modal.classList.add('show');
                const items = Array.from(modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
                    .filter(el => el.offsetParent !== null && !el.disabled);
                const first = items[0], last = items[items.length - 1];
                const origFirst = first.focus.bind(first);
                const origLast = last.focus.bind(last);
                first.focus = function(){ window.__howFocusCalls.first++; return origFirst(); };
                last.focus = function(){ window.__howFocusCalls.last++; return origLast(); };
            }"""
        )
        panel_still_open = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display") == "block"
        record("B. artificial coexistence constructed: panel still open after JS force-open of how-ov", panel_still_open)
        for _ in range(8):
            page.keyboard.press("Tab")
            page.wait_for_timeout(25)
        for _ in range(8):
            page.keyboard.press("Shift+Tab")
            page.wait_for_timeout(25)
        calls = page.evaluate("window.__howFocusCalls")
        record(
            "B. GUARD: how-ov's own first/last .focus() never called while A11y panel owns focus (16 Tab/Shift+Tab presses)",
            calls["first"] == 0 and calls["last"] == 0,
            calls,
        )
        record("B. active element stayed within panel/launcher throughout coexistence cycling", in_panel_or_launcher(page))
        # cleanup: close both via direct state reset (do not rely on Escape semantics here, this is an artificial state)
        page.evaluate(
            """() => {
                document.getElementById('how-ov').classList.remove('show');
                document.getElementById('donomanaA11yPanel').style.display = 'none';
                document.getElementById('donomanaA11yBtn').setAttribute('aria-expanded', 'false');
                document.getElementById('hdr').inert = false;
                document.getElementById('main').inert = false;
            }"""
        )
        page.wait_for_timeout(100)

        # === C. Spot-check: pre-existing 6-modal Trap still functions (full coverage elsewhere) ===
        page.click("#donomanaHelpBtn")
        page.wait_for_timeout(150)
        record("C. how-ov opens normally (spot-check, full suite: focus_trap_test.py)", page.eval_on_selector("#how-ov", "el => el.classList.contains('show')"))
        page.keyboard.press("Shift+Tab")
        page.wait_for_timeout(50)
        in_modal = page.evaluate("document.getElementById('how-ov').contains(document.activeElement)")
        record("C. how-ov Shift+Tab stays within modal (spot-check)", in_modal)
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        record("C. how-ov closes via Escape, focus returns to donomanaHelpBtn (spot-check)", active_id(page) == "donomanaHelpBtn")

        # === D. Settings Proxy smoke check (full coverage elsewhere) ===
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        proxy_exists = page.evaluate("!!document.getElementById('donomanaSettingsProxy')")
        record("D. Settings Proxy button exists inside panel (spot-check)", proxy_exists)
        if proxy_exists:
            page.click("#donomanaSettingsProxy")
            page.wait_for_timeout(150)
            settings_open = page.eval_on_selector("#settings-ov", "el => el.classList.contains('show')")
            record("D. Settings Proxy opens settings-ov end-to-end (spot-check)", settings_open)
            page.keyboard.press("Escape")
            page.wait_for_timeout(150)
            record("D. settings-ov Escape returns focus to donomanaA11yBtn (FIX-1E, spot-check)", active_id(page) == "donomanaA11yBtn")

        record("RUNTIME: no page errors", len(errors) == 0, errors)
        browser.close()


def main():
    run_static_checks()
    run_browser_checks()
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["ok"])
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
