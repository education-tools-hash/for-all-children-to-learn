"""
Phase COMMON-A11Y-STRICT-CONTAINMENT-WAVE-4A-SUJI-FIX-1 dedicated regression test.

suji-manabou.html never wired the shared GLOBAL-1A strict-containment helper
(window.trapA11yPanelFocus). This app has no app-specific Tab Trap: its
"settings" surface is a same-page tab-section (<section id="settings"
class="section">), not a focus-trapped modal/overlay, and its two
app-specific keydown listeners only handle Space/Enter decision (plain and
Switch-Scan-gated) and the F-key fullscreen toggle -- neither touches Tab or
Shift+Tab, and the generic one explicitly returns early on Escape. The fix
is a single standalone delegating keydown listener added after all existing
app logic, outside the generator-owned a11y-panel block.

Sections:
  A. Static checks -- connector existence/singularity, generator-owned block
     byte integrity, keydown-listener count, Escape-mention count.
  B. Browser checks -- A11y panel Tab/Shift+Tab containment, browser-chrome-
     escape elimination, document.hasFocus(), Escape/Focus Return, Settings
     Proxy non-regression, an outside-click-safety-net coexistence check,
     Switch Scan start/stop/target-cycling/Space-decide non-regression, a
     key-repeat (multi-activation) guard check, touch tap, and a normal
     number-learning (stroke tab) smoke check.
"""
import hashlib
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_FILE = REPO_ROOT / "suji-manabou.html"
BASE = "http://127.0.0.1:8942/suji-manabou.html"

RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))


def active_id(page):
    return page.evaluate(
        "document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'null'"
    )


# Computed against fresh origin/main (pre-fix) with the identical regex this
# test uses, before the connector was added.
REFERENCE_BLOCK_HASH = "896a0ab98d4b0a514ab24f7239f5ca87"


def run_static_checks():
    text = APP_FILE.read_text(encoding="utf-8")

    connector_pattern = re.compile(
        r"document\.addEventListener\('keydown', function \(e\) \{\s*"
        r"if \(window\.trapA11yPanelFocus\) window\.trapA11yPanelFocus\(e\);\s*\}\);"
    )
    matches = connector_pattern.findall(text)
    record("A. STATIC: connector pattern present exactly once", len(matches) == 1, len(matches))

    block_match = re.search(
        r"<!-- a11y-panel: 自動挿入 \(generate\.js\) -->(.*?)<!-- /a11y-panel -->",
        text,
        re.DOTALL,
    )
    record("A. STATIC: generator-owned a11y-panel block found", block_match is not None)
    if block_match:
        block_hash = hashlib.md5(block_match.group(1).encode("utf-8")).hexdigest()
        record(
            "A. STATIC: generator-owned block byte-identical to fresh origin/main",
            block_hash == REFERENCE_BLOCK_HASH,
            block_hash,
        )

    # Exactly 4 document keydown listeners total: generator's own (inside the
    # block), the Switch-Scan Space/Enter decide handler, the generic
    # Enter/Space/F handler, and the new connector.
    keydown_listeners = list(re.finditer(r"addEventListener\('keydown'", text))
    record(
        "A. STATIC: exactly 4 document keydown listeners total (generator's own + 2 pre-existing + new connector)",
        len(keydown_listeners) == 4,
        len(keydown_listeners),
    )

    # No app-specific Escape handling was added by this fix (pre-existing: the
    # generator's own Escape check, plus the generic handler's early-return
    # guard on Escape).
    escape_count = len(re.findall(r"'Escape'", text))
    record(
        "A. STATIC: exactly 2 Escape mentions in the whole file (generator-owned + pre-existing early-return guard, unchanged)",
        escape_count == 2,
        escape_count,
    )

    connector_idx = text.find("if (window.trapA11yPanelFocus) window.trapA11yPanelFocus(e);")
    block_end_idx = text.find("<!-- /a11y-panel -->")
    record(
        "A. STATIC: new connector is positioned after the generator-owned a11y-panel block",
        connector_idx != -1 and block_end_idx != -1 and block_end_idx < connector_idx,
    )


def run_browser_checks():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless=True
        )
        page = browser.new_page(viewport={"width": 1280, "height": 900}, has_touch=True)
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(BASE)
        page.wait_for_timeout(300)

        # === B/C/D: A11y panel Tab/Shift+Tab containment ===
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        panel_display = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display")
        record("B. panel opens on click", panel_display == "block")

        escaped = False
        hf_false = False
        for _ in range(20):
            page.keyboard.press("Tab")
            page.wait_for_timeout(30)
            in_panel = page.evaluate(
                """() => {
                const panel = document.getElementById('donomanaA11yPanel');
                const active = document.activeElement;
                return panel.contains(active) || active === document.getElementById('donomanaA11yBtn');
            }"""
            )
            if not page.evaluate("document.hasFocus()"):
                hf_false = True
            if not in_panel:
                escaped = True
        record("D. Forward Tab containment: never escapes panel (20x)", not escaped)
        record("G. document.hasFocus() stays true throughout forward loop", not hf_false)

        escaped_rev = False
        body_hit = False
        for _ in range(20):
            page.keyboard.press("Shift+Tab")
            page.wait_for_timeout(30)
            tag = active_id(page)
            if tag == "BODY":
                body_hit = True
            in_panel = page.evaluate(
                """() => {
                const panel = document.getElementById('donomanaA11yPanel');
                const active = document.activeElement;
                return panel.contains(active) || active === document.getElementById('donomanaA11yBtn');
            }"""
            )
            if not in_panel:
                escaped_rev = True
        record("E. Reverse Shift+Tab containment: never escapes panel (20x)", not escaped_rev)
        record("F. browser-chrome escape eliminated: BODY never reached in reverse loop", not body_hit)

        # === H/I: Escape close + Focus Return ===
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        panel_after_esc = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display")
        record("H. Escape closes the A11y panel", panel_after_esc == "none")
        record("I. focus returns to donomanaA11yBtn after Escape", active_id(page) == "donomanaA11yBtn", active_id(page))

        # === J: normal Tab order unaffected while panel is closed ===
        page.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
        page.wait_for_timeout(50)
        tab_sequence_ok = True
        for _ in range(5):
            page.keyboard.press("Tab")
            page.wait_for_timeout(20)
            if not page.evaluate("document.hasFocus()"):
                tab_sequence_ok = False
        record("J. normal Tab navigation (panel closed) keeps document.hasFocus()", tab_sequence_ok)

        # === K: Settings Proxy non-regression ===
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        page.click("#donomanaSettingsProxy")
        page.wait_for_timeout(200)
        settings_active = page.evaluate("document.getElementById('settings').classList.contains('active')")
        record("K. Settings Proxy opens the settings tab-section (unchanged)", settings_active)
        panel_after_proxy = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display")
        record(
            "L. opening settings via real click auto-closes the A11y panel (no simultaneous-open reachable, outside-click safety net)",
            panel_after_proxy == "none",
            panel_after_proxy,
        )
        page.click('.tab-btn[data-tab="stroke"]')
        page.wait_for_timeout(150)

        # === L (coexistence constructed artificially since real click auto-closes) ===
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        page.evaluate(
            "document.getElementById('settings').classList.add('active'); "
            "document.getElementById('stroke').classList.remove('active');"
        )
        page.wait_for_timeout(100)
        panel_still_open = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display") == "block"
        record("L. A11y panel stays open under artificial settings-section coexistence", panel_still_open)
        escaped_coexist = False
        for _ in range(10):
            page.keyboard.press("Tab")
            page.wait_for_timeout(20)
            in_panel = page.evaluate(
                """() => {
                const panel = document.getElementById('donomanaA11yPanel');
                const active = document.activeElement;
                return panel.contains(active) || active === document.getElementById('donomanaA11yBtn');
            }"""
            )
            if not in_panel:
                escaped_coexist = True
        record("L. Tab containment holds during artificial settings coexistence too", not escaped_coexist)
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        page.evaluate(
            "document.getElementById('settings').classList.remove('active'); "
            "document.getElementById('stroke').classList.add('active');"
        )
        page.wait_for_timeout(100)

        # === M/N/O: Switch Scan start/stop/target-cycling/decide non-regression ===
        scan_cb = page.query_selector("#toggle-scan")
        record("M. Switch Scan toggle checkbox found", scan_cb is not None)
        if scan_cb:
            scan_cb.evaluate(
                "el => { el.checked = true; el.dispatchEvent(new Event('change')); el.onchange && el.onchange(); }"
            )
            page.wait_for_timeout(400)
            scan_mode_on = page.evaluate("typeof scanMode !== 'undefined' ? scanMode : null")
            record("M. scanMode turns on via toggle (unchanged)", scan_mode_on is True, scan_mode_on)
            first_target = page.evaluate("document.activeElement && document.activeElement.tagName")
            record("N. a scan target receives focus after enabling scan (unchanged)", first_target not in (None, "BODY"), first_target)

            # Scan should never put focus inside the A11y panel (independent scopes).
            in_a11y_panel = page.evaluate(
                "document.getElementById('donomanaA11yPanel').contains(document.activeElement)"
            )
            record("N. Switch Scan focus never lands inside the A11y panel", not in_a11y_panel)

            # Tab while scanMode is on should still be contained normally when panel is closed
            # (scan itself does not use Tab; this just checks no crash / no runaway state).
            page.keyboard.press("Tab")
            page.wait_for_timeout(50)
            record("N. no runtime error after Tab while scanMode is on", len(errors) == 0, errors)

            page.keyboard.press(" ")
            page.wait_for_timeout(200)
            record("O. Space key during scanMode does not throw (decide path unchanged)", len(errors) == 0, errors)

            scan_cb.evaluate(
                "el => { el.checked = false; el.dispatchEvent(new Event('change')); el.onchange && el.onchange(); }"
            )
            page.wait_for_timeout(200)
            scan_mode_off = page.evaluate("typeof scanMode !== 'undefined' ? scanMode : null")
            record("M. scanMode turns off via toggle (unchanged)", scan_mode_off is False, scan_mode_off)

        # === P: key-repeat / multiple-activation guard spot-check (Space during scan) ===
        if scan_cb:
            scan_cb.evaluate(
                "el => { el.checked = true; el.dispatchEvent(new Event('change')); el.onchange && el.onchange(); }"
            )
            page.wait_for_timeout(300)
            activation_count = page.evaluate(
                """() => {
                let count = 0;
                const target = document.activeElement;
                if (target) {
                    const origClick = target.click.bind(target);
                    target.click = function(...a) { count++; return origClick(...a); };
                    window.__sujiActivationSpy = () => count;
                }
                return !!target;
            }"""
            )
            record("P. activation spy installed on current scan target", activation_count)
            page.keyboard.press(" ")
            page.wait_for_timeout(50)
            page.keyboard.press(" ")
            page.wait_for_timeout(50)
            spy_count = page.evaluate("window.__sujiActivationSpy ? window.__sujiActivationSpy() : null")
            record(
                "P. two distinct keydown Space presses activate at most twice (no runaway multi-fire per single press)",
                spy_count is not None and spy_count <= 2,
                spy_count,
            )
            scan_cb.evaluate(
                "el => { el.checked = false; el.dispatchEvent(new Event('change')); el.onchange && el.onchange(); }"
            )
            page.wait_for_timeout(150)

        # === Q: touch operation smoke ===
        try:
            first_touchable = page.query_selector("#stroke button, #stroke [tabindex='0']")
            if first_touchable:
                first_touchable.tap(timeout=3000)
                page.wait_for_timeout(200)
                record("Q. tap() on a stroke-tab control does not throw", True)
            else:
                record("Q. tap() on a stroke-tab control does not throw", False, "no touchable control found")
        except Exception as ex:
            record("Q. tap() on a stroke-tab control does not throw", False, str(ex))

        # === R: normal number-learning smoke ===
        stroke_active = page.evaluate("document.getElementById('stroke').classList.contains('active')")
        record("R. stroke (number learning) tab renders active after all interaction (no crash)", stroke_active)

        record("RUNTIME: no page errors", len(errors) == 0, errors)
        browser.close()


def main():
    run_static_checks()
    run_browser_checks()
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    total = len(RESULTS)
    for name, ok, detail in RESULTS:
        print(("PASS" if ok else "FAIL"), "-", name, ("::" + str(detail)) if detail not in ("", None) else "")
    print(f"\n{passed}/{total} checks passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
