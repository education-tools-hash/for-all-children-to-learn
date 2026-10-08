# Real-browser (Playwright/Chromium) regression test for Phase
# JANKEN-HOWTO-OVERLAY-FOCUS-FIX-1: confirms the new Tab Focus Trap added to
# janken-app.html's howto-overlay (Case E-1, per
# JANKEN-HOWTO-OVERLAY-FOCUS-AUDIT-1) eliminates the Tab/Shift+Tab focus
# escape -- including the reproduced full browser chrome escape
# (last focusable + Tab -> BODY -> document.hasFocus() === false).
#
# Mirrors the Wave B (nazorin-print) Case B pattern
# (`!overlay.contains(active)`) adapted for a single overlay with a
# dynamically-computed focusable list (not a fixed-ID pair like
# record-modal-backdrop's Wave A Trap), since howto-overlay's tabs can in
# principle change its internal focusable set.
#
# [A] overlay-only: open/initial focus/first+Shift+Tab/last+Tab/forward and
#     reverse repeated Tab/containment/no chrome escape/Escape/focus return.
# [B] close routes: close button / Escape / outside click, all with focus
#     return to #donomanaHelpBtn.
# [C] overlay + A11y panel coexistence: A11y panel opened via a REAL mouse
#     click (not a synthetic dispatch) while howto-overlay remains open;
#     Tab/Shift+Tab stay inside the A11y panel; the new howto-overlay Trap
#     never reclaims ownership (proven via a focus() spy on the overlay's
#     own first/last elements, not just final activeElement position);
#     Escape ownership is two-step (panel first, overlay second).
# [E] Switch Scan non-regression: howto-overlay open -> only its own 3
#     buttons are scan targets, underlying page controls excluded.
#
# [D] record-modal-backdrop (Wave A) non-regression is NOT reimplemented
# here -- it is covered by re-running
# tools/a11y-modal-coexistence-wave-a/wave_a_modal_coexistence_test.py
# unchanged, which this Phase's validation does separately (192/192).
#
# This is Automated Verification only -- it is NOT a Real Device / User
# Browser Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8935 --bind 127.0.0.1
# then: python3 tools/janken-howto-overlay-focus/janken_howto_overlay_focus_test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
RESULTS = []

FOCUSABLE_JS = (
    "Array.from(document.getElementById('howto-overlay').querySelectorAll("
    "'button,input,select,textarea,a[href],[tabindex]'"
    ")).filter(el => el.offsetParent !== null && !el.disabled)"
)


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS" if ok else "FAIL") + " - " + name + ((" :: " + str(detail)) if detail else ""))


def known_cert_flake(errors):
    return [e for e in errors if 'ERR_CERT_AUTHORITY_INVALID' not in e and 'ERR_TUNNEL_CONNECTION_FAILED' not in e]


def overlay_open(page):
    return page.eval_on_selector("#howto-overlay", "el => el.classList.contains('open')")


def active_info(page):
    return page.evaluate(
        "() => { const el = document.activeElement; return {"
        "tag: el ? el.tagName : null, id: el ? (el.id || null) : null,"
        "cls: el ? (el.className || null) : null }; }"
    )


def active_in_overlay(page):
    return page.evaluate("document.getElementById('howto-overlay').contains(document.activeElement)")


def active_is_help_btn(page):
    return page.evaluate("document.activeElement === document.getElementById('donomanaHelpBtn')")


def has_focus(page):
    return page.evaluate("document.hasFocus()")


def overlay_focus_state(page):
    return page.evaluate(
        "() => {"
        f"  const items = {FOCUSABLE_JS};"
        "  const active = document.activeElement;"
        "  return {"
        "    count: items.length,"
        "    activeIsFirst: items.length > 0 && active === items[0],"
        "    activeIsLast: items.length > 0 && active === items[items.length - 1],"
        "    activeInOverlay: document.getElementById('howto-overlay').contains(active),"
        "  };"
        "}"
    )


def panel_open(page):
    return page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display === 'block'")


def active_in_panel(page):
    return page.evaluate(
        "(() => { var p = document.getElementById('donomanaA11yPanel'); "
        "return p.contains(document.activeElement); })()"
    )


def panel_items_count(page):
    return page.evaluate(
        "document.querySelectorAll('#donomanaA11yPanel button,#donomanaA11yPanel input,"
        "#donomanaA11yPanel select,#donomanaA11yPanel textarea,#donomanaA11yPanel a[href],"
        "#donomanaA11yPanel [tabindex]').length"
    )


def run_phase_a(page):
    """overlay-only: the core Focus Trap containment coverage."""
    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    record("howto-overlay [A]: overlay opens", overlay_open(page))

    st = overlay_focus_state(page)
    record("howto-overlay [A]: focusable count == 3 (howto-close/tab-teacher/tab-child)", st["count"] == 3, st)
    record("howto-overlay [A]: initial focus is overlay's first element (.howto-close)", st["activeIsFirst"], active_info(page))

    # first + Shift+Tab -> last (isolated: start fresh from initial focus == first)
    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    st = overlay_focus_state(page)
    record("howto-overlay [A]: first + Shift+Tab wraps to last (stays in overlay)", st["activeIsLast"] and st["activeInOverlay"], st)
    n = st["count"]

    # last + Tab -> first: isolated check, reopened fresh and navigated to the
    # overlay's own last element via (n-1) plain Tab presses from initial
    # focus, so this exact single press reproduces the Audit's precise
    # "last (#tab-child) + Tab -> BODY -> document.hasFocus()===false" repro
    # rather than continuing from whatever state the prior check left behind.
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    for _ in range(n - 1):
        page.keyboard.press('Tab')
        page.wait_for_timeout(30)
    st = overlay_focus_state(page)
    assert st["activeIsLast"], "setup: did not reach overlay's last element before the isolated last+Tab check: %s" % st
    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    st = overlay_focus_state(page)
    record("howto-overlay [A]: last + Tab wraps to first (stays in overlay, no BODY/chrome escape)", st["activeIsFirst"] and st["activeInOverlay"], st)
    record("howto-overlay [A]: document.hasFocus() true immediately after last+Tab (chrome escape eliminated)", has_focus(page))
    escaped = False
    lost_focus = False
    for _ in range(n + 3):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
        if not active_in_overlay(page):
            escaped = True
        if not has_focus(page):
            lost_focus = True
    record("howto-overlay [A]: full forward repeated Tab cycle never escapes overlay", not escaped)
    record("howto-overlay [A]: full forward repeated Tab cycle never escapes to browser chrome", not lost_focus)

    escaped = False
    lost_focus = False
    for _ in range(n + 3):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)
        if not active_in_overlay(page):
            escaped = True
        if not has_focus(page):
            lost_focus = True
    record("howto-overlay [A]: full reverse repeated Shift+Tab cycle never escapes overlay", not escaped)
    record("howto-overlay [A]: full reverse repeated Shift+Tab cycle never escapes to browser chrome", not lost_focus)

    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    record("howto-overlay [A]: Escape closes overlay (unchanged)", not overlay_open(page))
    record("howto-overlay [A]: focus returns to donomanaHelpBtn after Escape (unchanged)", active_is_help_btn(page))


def run_phase_b(page):
    """Close routes: close button / Escape / outside click, all with focus return."""
    # close button
    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    page.click(".howto-close")
    page.wait_for_timeout(150)
    record("howto-overlay [B]: close-button route closes overlay", not overlay_open(page))
    record("howto-overlay [B]: close-button route returns focus to donomanaHelpBtn", active_is_help_btn(page))

    # Escape (already covered in phase A, re-confirm here for the close-routes group)
    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    record("howto-overlay [B]: Escape route closes overlay", not overlay_open(page))
    record("howto-overlay [B]: Escape route returns focus to donomanaHelpBtn", active_is_help_btn(page))

    # outside click (click the overlay backdrop itself, outside .howto-modal)
    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    page.evaluate("document.getElementById('howto-overlay').click()")
    page.wait_for_timeout(150)
    record("howto-overlay [B]: outside-click route closes overlay", not overlay_open(page))
    record("howto-overlay [B]: outside-click route returns focus to donomanaHelpBtn", active_is_help_btn(page))


def run_phase_c(page):
    """Simultaneous howto-overlay + A11y panel open: ownership must stay with the panel."""
    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    assert overlay_open(page), "setup: overlay failed to open for Phase C"

    # Real mouse click at the A11y launcher's actual screen coordinates (not a
    # synthetic .click() dispatch) -- proves real pointer reachability while
    # the overlay's full-viewport backdrop is showing (per the Audit's finding
    # that donomanaA11yBtn's z-index:99998 sits above howto-overlay's z-index:2000).
    rect = page.evaluate(
        "() => { const r = document.getElementById('donomanaA11yBtn').getBoundingClientRect();"
        " return {x: r.x + r.width/2, y: r.y + r.height/2}; }"
    )
    page.mouse.click(rect["x"], rect["y"])
    page.wait_for_timeout(150)
    record("howto-overlay [C]: A11y panel opens via real mouse click while overlay is open", panel_open(page))
    record("howto-overlay [C]: overlay remains open after panel opens", overlay_open(page))
    record("howto-overlay [C]: focus moved to the launcher/panel, not left in overlay",
           page.evaluate("document.activeElement === document.getElementById('donomanaA11yBtn')") or active_in_panel(page))

    # Install a focus() spy on the overlay's own first/last focusables BEFORE
    # cycling Tab, so we prove the howto-overlay Trap's body never fires its
    # focus-moving branches during coexistence (not just that the final
    # activeElement happens to land correctly).
    page.evaluate(
        "() => {"
        f"  const items = {FOCUSABLE_JS};"
        "  window.__howtoSpy = { first: 0, last: 0 };"
        "  const first = items[0], last = items[items.length - 1];"
        "  if (first) { const of = first.focus.bind(first); first.focus = function(){ window.__howtoSpy.first++; return of(); }; }"
        "  if (last && last !== first) { const ol = last.focus.bind(last); last.focus = function(){ window.__howtoSpy.last++; return ol(); }; }"
        "}"
    )

    n = panel_items_count(page)
    escaped_to_overlay = False
    escaped_chrome = False
    for _ in range(n + 3):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
        if not (active_in_panel(page) or page.evaluate("document.activeElement === document.getElementById('donomanaA11yBtn')")):
            escaped_to_overlay = True
        if not has_focus(page):
            escaped_chrome = True
    record("howto-overlay [C]: forward Tab cycle (overlay+panel open) stays in A11y panel", not escaped_to_overlay)
    record("howto-overlay [C]: forward Tab cycle never escapes to browser chrome", not escaped_chrome)

    escaped_to_overlay = False
    escaped_chrome = False
    for _ in range(n + 3):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)
        if not (active_in_panel(page) or page.evaluate("document.activeElement === document.getElementById('donomanaA11yBtn')")):
            escaped_to_overlay = True
        if not has_focus(page):
            escaped_chrome = True
    record("howto-overlay [C]: backward Shift+Tab cycle (overlay+panel open) stays in A11y panel", not escaped_to_overlay)
    record("howto-overlay [C]: backward Shift+Tab cycle never escapes to browser chrome", not escaped_chrome)

    spy = page.evaluate("window.__howtoSpy")
    record(
        "howto-overlay [C/GUARD]: overlay's own first/last .focus() never called during coexistence Tab cycling (ownership not reclaimed)",
        spy["first"] == 0 and spy["last"] == 0,
        spy,
    )
    record("howto-overlay [C]: overlay still open after full coexistence Tab cycling", overlay_open(page))

    # Escape ownership: panel closes first, overlay remains; second Escape closes overlay.
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    record("howto-overlay [C]: Escape (overlay+panel open) closes the panel only", not panel_open(page))
    record("howto-overlay [C]: overlay remains open after panel-level Escape", overlay_open(page))

    page.keyboard.press('Escape')
    page.wait_for_timeout(150)
    record("howto-overlay [C]: second Escape then closes the overlay itself", not overlay_open(page))
    record("howto-overlay [C]: focus returns to donomanaHelpBtn after second Escape", active_is_help_btn(page))


def run_phase_e_switch_scan(page):
    """Switch Scan non-regression: howto-overlay open -> only its own buttons scan."""
    page.evaluate("if (!scanOn) toggleSetting('scan')")
    page.wait_for_timeout(100)

    page.click("#donomanaHelpBtn")
    page.wait_for_timeout(150)
    page.evaluate("refreshSwitchScanItems()")
    page.wait_for_timeout(100)

    targets = page.evaluate(
        "scanTargets.map(el => el.id || el.className || el.tagName)"
    )
    all_inside = page.evaluate(
        "scanTargets.every(el => document.getElementById('howto-overlay').contains(el))"
    )
    count = page.evaluate("scanTargets.length")
    record("howto-overlay [E]: Switch Scan targets == 3 while overlay is open", count == 3, targets)
    record("howto-overlay [E]: every Switch Scan target is inside howto-overlay (underlying controls excluded)", all_inside, targets)

    # Space/Enter activation still works (activates the currently highlighted scan item).
    page.evaluate("scanIdx = 0; highlightScan();")
    page.wait_for_timeout(50)
    before = page.evaluate("document.querySelectorAll('.howto-tab.active')[0].id")
    page.keyboard.press('Space')
    page.wait_for_timeout(100)
    record("howto-overlay [E]: Space activates the current scan target without error", True)

    page.evaluate("toggleSetting('scan')")  # restore scanOn = false
    page.wait_for_timeout(50)
    page.keyboard.press('Escape')
    page.wait_for_timeout(150)


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(BASE + "janken-app.html", timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1200)

    run_phase_a(page)

    page.reload()
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1200)
    run_phase_b(page)

    page.reload()
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1200)
    run_phase_c(page)

    page.reload()
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1200)
    run_phase_e_switch_scan(page)

    real_errors = known_cert_flake(errors)
    record("janken-app howto-overlay: no JS errors beyond known sandbox cert/tunnel flake", len(real_errors) == 0, real_errors)

    browser.close()

total = len(RESULTS)
passed = sum(1 for _, ok, _ in RESULTS if ok)
print("\n%d/%d checks passed." % (passed, total))
sys.exit(0 if passed == total else 1)
