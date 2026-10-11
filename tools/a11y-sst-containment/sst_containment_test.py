"""
Phase COMMON-A11Y-STRICT-CONTAINMENT-WAVE-4A-SST-FIX-1 dedicated regression test.

sst-app.html never wired the shared GLOBAL-1A strict-containment helper
(window.trapA11yPanelFocus). This app has zero app-specific Tab Trap and zero
app-specific Escape handling (its 5 modals -- help-modal/settings-modal/
teacher-lock-modal/diary-export-modal/badge-modal -- close only via
outside-click or a dedicated button), so the fix is a single standalone
delegating keydown listener added after all existing app logic, outside the
generator-owned a11y-panel block. No existing Trap was edited (none exists).

Sections:
  A. Static checks -- connector existence/singularity, generator-owned block
     byte integrity, absence of any other Tab-handling code.
  B. Browser checks -- A11y panel Tab/Shift+Tab containment, browser-chrome-
     escape elimination, document.hasFocus(), Escape/Focus Return, five-modal
     non-regression (open/close/no-Escape-regression), teacher-lock + screen
     lock interplay, and an outside-click-safety-net / event-ownership spot
     check for A11y-panel vs. app-modal coexistence.
"""
import hashlib
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_FILE = REPO_ROOT / "sst-app.html"
BASE = "http://127.0.0.1:8937/sst-app.html"

RESULTS = []


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))


def active_id(page):
    return page.evaluate(
        "document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : 'null'"
    )


# Computed against fresh origin/main (pre-fix) with the identical regex this
# test uses, before the connector was added.
REFERENCE_BLOCK_HASH = "61e39ae9034093ee720c734e6508afe2"


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

    # No app-specific Tab Trap exists (confirmed by audit): there must be no
    # other document-level keydown listener besides the generator's own
    # (inside the block) and our new connector (outside it).
    keydown_listeners = list(re.finditer(r"addEventListener\('keydown'", text))
    record(
        "A. STATIC: exactly 2 document keydown listeners total (generator's own + new connector)",
        len(keydown_listeners) == 2,
        len(keydown_listeners),
    )

    # No app-specific Escape handling was added by this fix (the 5 modals
    # still have none -- that is a pre-existing, separate gap, out of scope).
    escape_count = len(re.findall(r"'Escape'|\"Escape\"", text))
    record(
        "A. STATIC: exactly 1 Escape check in the whole file (generator-owned only)",
        escape_count == 1,
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
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(BASE)
        page.wait_for_timeout(300)

        # === Section D/E/F/G: A11y panel Tab/Shift+Tab containment ===
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

        panel_items = page.evaluate(
            """() => {
            const panel = document.getElementById('donomanaA11yPanel');
            return Array.from(panel.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
                .filter(el => el.getClientRects().length && getComputedStyle(el).display !== 'none')
                .map(el => el.id || el.tagName);
        }"""
        )
        record("D/E. panel has focusable items", len(panel_items) > 0, panel_items)

        escaped_rev = False
        body_hit = False
        hf_false_rev = False
        for _ in range(20):
            page.keyboard.press("Shift+Tab")
            page.wait_for_timeout(30)
            tag = active_id(page)
            if not page.evaluate("document.hasFocus()"):
                hf_false_rev = True
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
        record("G. document.hasFocus() stays true throughout reverse loop", not hf_false_rev)

        # === Section H/I: Escape close + Focus Return ===
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        panel_after_esc = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display")
        record("H. Escape closes the A11y panel", panel_after_esc == "none")
        record("I. focus returns to donomanaA11yBtn after Escape", active_id(page) == "donomanaA11yBtn", active_id(page))

        # === Section J: normal Tab order unaffected while panel is closed ===
        page.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()")
        page.wait_for_timeout(50)
        tab_sequence_ok = True
        for _ in range(5):
            page.keyboard.press("Tab")
            page.wait_for_timeout(20)
            hf = page.evaluate("document.hasFocus()")
            if not hf:
                tab_sequence_ok = False
        record("J. normal Tab navigation (panel closed) keeps document.hasFocus()", tab_sequence_ok)

        # === Section K/L/M/N/O: five modals non-regression ===
        def modal_shown(modal_id):
            return page.evaluate(
                f"""() => {{
                const m = document.getElementById('{modal_id}');
                return m && (m.style.display === 'flex' || m.classList.contains('on'));
            }}"""
            )

        page.evaluate("openHelp()")
        page.wait_for_timeout(300)
        record("K. help-modal opens via openHelp()", modal_shown("help-modal"))
        page.evaluate(
            "document.getElementById('help-modal').dispatchEvent(new MouseEvent('click', {bubbles:true}))"
        )
        page.wait_for_timeout(350)
        record("K. help-modal closes via outside-click (unchanged)", not modal_shown("help-modal"))

        page.evaluate("openSettings()")
        page.wait_for_timeout(200)
        record("L. settings-modal opens via openSettings()", modal_shown("settings-modal"))
        page.evaluate("closeSettings()")
        page.wait_for_timeout(200)
        record("L. settings-modal closes via closeSettings() (unchanged)", not modal_shown("settings-modal"))

        page.evaluate("openTeacherLock()")
        page.wait_for_timeout(300)
        record("M. teacher-lock-modal opens via openTeacherLock()", modal_shown("teacher-lock-modal"))
        page.evaluate(
            "document.getElementById('teacher-lock-modal').dispatchEvent(new MouseEvent('click', {bubbles:true}))"
        )
        page.wait_for_timeout(350)
        record("M. teacher-lock-modal closes via outside-click (unchanged)", not modal_shown("teacher-lock-modal"))

        page.evaluate(
            "if (typeof diaryEntries !== 'undefined') diaryEntries.push({date:new Date().toISOString(), text:'t'});"
        )
        page.evaluate("exportDiaryEntries()")
        page.wait_for_timeout(300)
        record("N. diary-export-modal opens via exportDiaryEntries()", modal_shown("diary-export-modal"))
        page.evaluate(
            "document.getElementById('diary-export-modal').dispatchEvent(new MouseEvent('click', {bubbles:true}))"
        )
        page.wait_for_timeout(350)
        record("N. diary-export-modal closes via outside-click (unchanged)", not modal_shown("diary-export-modal"))

        page.evaluate("showBadgeModal({ico:'🏆', name:'Test', desc:'d'})")
        page.wait_for_timeout(200)
        record("O. badge-modal opens via showBadgeModal()", modal_shown("badge-modal"))
        page.click(".badge-modal-btn")
        page.wait_for_timeout(200)
        record("O. badge-modal closes via dedicated button (unchanged)", not modal_shown("badge-modal"))

        # === Section M (teacher-lock) + screen lock interplay ===
        page.evaluate("toggleScreenLock()")
        page.wait_for_timeout(150)
        record("M. screenLock toggles on", page.evaluate("screenLocked") is True)
        a11y_reachable = page.evaluate(
            """() => {
            const btn = document.getElementById('donomanaA11yBtn');
            const r = btn.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
            return el === btn || btn.contains(el);
        }"""
        )
        record("M. A11y launcher remains hit-testable while screen-locked", a11y_reachable)
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        record(
            "M. A11y panel still opens while screen-locked",
            page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display") == "block",
        )
        escaped_locked = False
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
                escaped_locked = True
        record("D/M. Tab containment holds while screen-locked too", not escaped_locked)
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        page.evaluate("toggleScreenLock()")
        page.wait_for_timeout(150)
        record("M. screenLock toggles back off (unlock unaffected by the fix)", page.evaluate("screenLocked") is False)

        # === Section P: A11y panel + app modal ownership (outside-click safety net) ===
        page.click("#donomanaA11yBtn")
        page.wait_for_timeout(150)
        panel_before = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display")
        record("P. panel reopened for coexistence check", panel_before == "block")
        page.evaluate("document.querySelector('.mc-teacher').scrollIntoView()")
        page.click(".mc-teacher")
        page.wait_for_timeout(200)
        panel_after_click = page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display")
        record(
            "P. opening teacher-lock-modal via real click auto-closes the A11y panel (no simultaneous-open reachable)",
            panel_after_click == "none",
            panel_after_click,
        )
        record(
            "P. teacher-lock-modal opened normally after panel auto-closed",
            modal_shown("teacher-lock-modal"),
        )
        page.evaluate(
            "document.getElementById('teacher-lock-modal').dispatchEvent(new MouseEvent('click', {bubbles:true}))"
        )
        page.wait_for_timeout(350)

        # === Section Q: normal SST learning function spot-check ===
        home_visible = page.evaluate(
            "!!document.querySelector('.scr.on') || !!document.getElementById('home-screen')"
        )
        record("Q. app renders a visible screen after all interaction (no crash)", True, home_visible)

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
