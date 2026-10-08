# Real-browser (Playwright/Chromium) regression test for Phase
# COMMON-A11Y-MODAL-COEXISTENCE-FIX-1-WAVE-A: confirms the explicit
# Modal Coexistence Adapter guard (copied from okane-app.html's reference
# pattern) added to each of this Wave's 5 target apps' app-specific modal
# Tab Focus Traps -- shiritori2.html (record-modal-backdrop),
# janken-app.html (record-modal-backdrop), tokei-app.html (helpModal,
# recordModal), bosai-app.html (help-modal), ongaku-app.html (modal-help)
# -- correctly:
#   (A) does not regress the common A11y panel's own strict containment
#       when it is open alone (non-regression vs Pilot/Wave 2 pattern);
#   (B) does not regress each app modal's own Tab/Shift+Tab containment
#       when the modal is open alone (non-regression vs pre-Wave-A
#       behavior);
#   (C) correctly arbitrates focus when BOTH the app modal and the common
#       A11y panel are open at once (the coexistence state newly covered
#       by this Phase) -- panel keeps strict containment, the modal is
#       never force-focused back into ("yanked back"), neither escapes to
#       browser chrome, and Escape closes only the topmost (panel) layer
#       first;
#   (D) Guard effectiveness: proves, via a focus()-call spy on each
#       modal's own first/last focusable elements across a full real
#       keyboard Tab/Shift+Tab cycle while the coexistence state holds,
#       that the modal Trap's own body never calls .focus() on its own
#       elements -- i.e. explicit ownership, not a "last focus() wins"
#       registration-order race (the exact failure mode the
#       COMMON-A11Y-MODAL-COEXISTENCE-AUDIT-1 Phase found in
#       nazorin-print.html, which is explicitly out of scope / deferred
#       to a separate Wave B and never touched by this Phase).
#
# nazorin-print.html is NEVER referenced or loaded by this test file.
#
# This is Automated Verification only -- it is NOT a Real Device / User
# Browser Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8935 --bind 127.0.0.1
# then: python3 tools/a11y-modal-coexistence-wave-a/wave_a_modal_coexistence_test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
RESULTS = []

# Each app -> list of its target modal(s) touched by this Phase.
APPS = {
    "shiritori2": {
        "modals": [
            {
                "name": "record-modal-backdrop",
                "open_fn": "openShiritoriRecordModal",
                "close_fn": "closeShiritoriRecordModal",
                "modal_id": "record-modal-backdrop",
                "open_check": "classList",
                "first_id": "record-modal-title",
                "last_id": "record-modal-close-btn",
            }
        ],
    },
    "janken-app": {
        "modals": [
            {
                "name": "record-modal-backdrop",
                "open_fn": "openJankenRecordModal",
                "close_fn": "closeJankenRecordModal",
                "modal_id": "record-modal-backdrop",
                "open_check": "classList",
                "first_id": "record-modal-title",
                "last_id": "record-modal-close-btn",
            }
        ],
    },
    "tokei-app": {
        "modals": [
            {
                "name": "helpModal",
                "open_fn": "openHelp",
                "close_fn": "closeHelp",
                "modal_id": "helpModal",
                "open_check": "classList",
                "first_id": "helpModalTitle",
                "last_id": "helpCloseBtn",
            },
            {
                "name": "recordModal",
                "open_fn": "openRecordHistory",
                "close_fn": "closeRecordHistory",
                "modal_id": "recordModal",
                "open_check": "classList",
                "first_id": "recordModalTitle",
                "last_id": "recordCloseBtn",
            },
        ],
    },
    "bosai-app": {
        "modals": [
            {
                "name": "help-modal",
                "open_fn": "openHelp",
                "close_fn": "closeHelp",
                "modal_id": "help-modal",
                "open_check": "display",
                "first_id": "help-modal-title",
                "last_id": "help-close-btn",
            }
        ],
    },
    "ongaku-app": {
        "modals": [
            {
                "name": "modal-help",
                "open_fn": "openHelp",
                "close_fn": "closeHelp",
                "modal_id": "modal-help",
                "open_check": "active",
                "first_id": "help-modal-title",
                "last_id": "help-close-btn",
            }
        ],
    },
}


def record(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("PASS" if ok else "FAIL") + " - " + name + ((" :: " + str(detail)) if detail else ""))


def known_cert_flake(errors):
    return [e for e in errors if 'ERR_CERT_AUTHORITY_INVALID' not in e and 'ERR_TUNNEL_CONNECTION_FAILED' not in e]


def panel_open(page):
    return page.eval_on_selector("#donomanaA11yPanel", "el => el.style.display === 'block'")


def active_in_panel(page):
    return page.evaluate(
        "(() => { var p = document.getElementById('donomanaA11yPanel'); "
        "return p.contains(document.activeElement); })()"
    )


def active_is_a11y_btn(page):
    return page.evaluate("document.activeElement === document.getElementById('donomanaA11yBtn')")


def has_focus(page):
    return page.evaluate("document.hasFocus()")


def panel_items_count(page):
    return page.evaluate(
        "document.querySelectorAll('#donomanaA11yPanel button,#donomanaA11yPanel input,"
        "#donomanaA11yPanel select,#donomanaA11yPanel textarea,#donomanaA11yPanel a[href],"
        "#donomanaA11yPanel [tabindex]').length"
    )


def modal_is_open(page, modal):
    if modal["open_check"] == "classList":
        return page.eval_on_selector("#" + modal["modal_id"], "el => el.classList.contains('open')")
    if modal["open_check"] == "display":
        return page.eval_on_selector("#" + modal["modal_id"], "el => el.style.display !== 'none'")
    if modal["open_check"] == "active":
        return page.eval_on_selector("#" + modal["modal_id"], "el => el.classList.contains('active')")
    raise ValueError(modal["open_check"])


def active_id(page):
    return page.evaluate("document.activeElement && document.activeElement.id")


def run_phase_a(page, appname):
    """A11y-panel-only open state: non-regression vs Pilot/Wave 2 pattern."""
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    record(appname + " [A]: panel opens", panel_open(page))
    n = panel_items_count(page)
    record(appname + " [A]: panel has focusable items", n > 0, "n=%d" % n)
    record(appname + " [A]: initial focus is the launcher button", active_is_a11y_btn(page))

    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    record(
        appname + " [A]: Shift+Tab from launcher wraps into panel (last control)",
        active_in_panel(page) and not active_is_a11y_btn(page) and has_focus(page),
    )

    escaped = False
    lost_focus = False
    for _ in range(n + 2):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped = True
        if not has_focus(page):
            lost_focus = True
    record(appname + " [A]: full forward Tab cycle never escapes panel", not escaped)
    record(appname + " [A]: full forward Tab cycle never escapes to browser chrome", not lost_focus)

    escaped = False
    lost_focus = False
    for _ in range(n + 2):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped = True
        if not has_focus(page):
            lost_focus = True
    record(appname + " [A]: full backward Shift+Tab cycle never escapes panel", not escaped)
    record(appname + " [A]: full backward Shift+Tab cycle never escapes to browser chrome", not lost_focus)

    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(appname + " [A]: Escape closes panel", not panel_open(page))
    record(appname + " [A]: focus returns to launcher after Escape", active_is_a11y_btn(page))
    record(appname + " [A]: document.hasFocus() maintained after Escape", has_focus(page))


def run_phase_b(page, appname, modal):
    """App-modal-only open state: non-regression of the pre-existing Trap."""
    label = "%s/%s" % (appname, modal["name"])
    page.evaluate(modal["open_fn"] + "()")
    page.wait_for_timeout(100)
    record(label + " [B]: modal opens", modal_is_open(page, modal))
    record(label + " [B]: initial focus is modal's first element", active_id(page) == modal["first_id"])

    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    record(label + " [B]: Shift+Tab from first wraps to last (stays in modal)", active_id(page) == modal["last_id"])

    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    record(label + " [B]: Tab from last wraps to first (stays in modal)", active_id(page) == modal["first_id"])

    record(label + " [B]: document.hasFocus() maintained during modal-only Tab cycling", has_focus(page))

    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [B]: Escape closes modal (modal-only, non-regression)", not modal_is_open(page, modal))


def run_phase_c(page, appname, modal):
    """Simultaneous modal + panel open: the new Wave A coexistence coverage."""
    label = "%s/%s" % (appname, modal["name"])

    page.evaluate(modal["open_fn"] + "()")
    page.wait_for_timeout(100)
    assert modal_is_open(page, modal), "setup: modal failed to open for Phase C"

    # The common A11y launcher sits at z-index:99998, always above any app
    # modal backdrop (Audit-confirmed finding), so it stays mouse/touch
    # reachable even while the modal is open.
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    record(label + " [C]: A11y panel opens while modal is still open (click reaches launcher)", panel_open(page))
    record(label + " [C]: modal remains open after panel opens", modal_is_open(page, modal))
    record(label + " [C]: focus moved to the launcher/panel, not left in modal",
           active_is_a11y_btn(page) or active_in_panel(page))

    n = panel_items_count(page)
    escaped_to_modal = False
    escaped_chrome = False
    yanked_to_modal_first_last = False
    for _ in range(n + 2):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
        aid = active_id(page)
        if aid in (modal["first_id"], modal["last_id"]):
            yanked_to_modal_first_last = True
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped_to_modal = True
        if not has_focus(page):
            escaped_chrome = True
    record(label + " [C]: forward Tab cycle (panel+modal open) stays in panel, never enters modal", not escaped_to_modal)
    record(label + " [C]: forward Tab cycle never yanks focus to modal's own first/last control", not yanked_to_modal_first_last)
    record(label + " [C]: forward Tab cycle never escapes to browser chrome", not escaped_chrome)
    record(label + " [C]: modal still open after forward Tab cycle (no accidental close)", modal_is_open(page, modal))

    escaped_to_modal = False
    escaped_chrome = False
    yanked_to_modal_first_last = False
    for _ in range(n + 2):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)
        aid = active_id(page)
        if aid in (modal["first_id"], modal["last_id"]):
            yanked_to_modal_first_last = True
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped_to_modal = True
        if not has_focus(page):
            escaped_chrome = True
    record(label + " [C]: backward Shift+Tab cycle (panel+modal open) stays in panel, never enters modal", not escaped_to_modal)
    record(label + " [C]: backward Shift+Tab cycle never yanks focus to modal's own first/last control", not yanked_to_modal_first_last)
    record(label + " [C]: backward Shift+Tab cycle never escapes to browser chrome", not escaped_chrome)
    record(label + " [C]: modal still open after backward Shift+Tab cycle", modal_is_open(page, modal))

    # Escape closes the topmost (panel) layer first; the modal underneath
    # must remain open and reachable.
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [C]: Escape (panel+modal open) closes the panel only", not panel_open(page))
    record(label + " [C]: modal remains open after panel-level Escape", modal_is_open(page, modal))
    record(label + " [C]: focus returns to the A11y launcher after panel-level Escape", active_is_a11y_btn(page))

    # A second Escape now closes the modal (panel is no longer intercepting).
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [C]: second Escape then closes the modal itself", not modal_is_open(page, modal))


def run_guard_effectiveness(page, appname, modal):
    """
    Proves genuine ownership (not a 'last focus() wins' registration-order
    race, per the Audit's nazorin-print finding): while the coexistence
    state holds (panel open, focus inside panel/on launcher, modal also
    open), spy on the modal's OWN first/last elements' .focus() method
    across a full real keyboard Tab/Shift+Tab cycle and assert it is never
    called -- i.e. the modal Trap's own guarded body never executes its
    focus-moving branches, not merely that some later listener overwrote
    the result.
    """
    label = "%s/%s" % (appname, modal["name"])

    page.evaluate(modal["open_fn"] + "()")
    page.wait_for_timeout(80)
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(120)
    assert panel_open(page) and modal_is_open(page, modal), "setup: coexistence state not reached"

    page.evaluate(
        """(ids) => {
            window.__waveASpy = { first: 0, last: 0 };
            var f = document.getElementById(ids[0]);
            var l = document.getElementById(ids[1]);
            var of = f.focus.bind(f), ol = l.focus.bind(l);
            f.focus = function(){ window.__waveASpy.first++; return of(); };
            l.focus = function(){ window.__waveASpy.last++; return ol(); };
        }""",
        [modal["first_id"], modal["last_id"]],
    )

    n = panel_items_count(page)
    for _ in range(n + 2):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
    for _ in range(n + 2):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)

    spy = page.evaluate("window.__waveASpy")
    record(
        label + " [GUARD]: modal's own first/last .focus() never called during coexistence Tab cycling (genuine ownership, not a race)",
        spy["first"] == 0 and spy["last"] == 0,
        spy,
    )


for appname, cfg in APPS.items():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(BASE + appname + ".html", timeout=20000)
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            page.wait_for_timeout(1200)

        run_phase_a(page, appname)

        for modal in cfg["modals"]:
            page.reload()
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                page.wait_for_timeout(1200)
            run_phase_b(page, appname, modal)

            page.reload()
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                page.wait_for_timeout(1200)
            run_phase_c(page, appname, modal)

            page.reload()
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                page.wait_for_timeout(1200)
            run_guard_effectiveness(page, appname, modal)

        real_errors = known_cert_flake(errors)
        record(appname + ": no JS errors beyond known sandbox cert/tunnel flake", len(real_errors) == 0, real_errors)

        browser.close()

total = len(RESULTS)
passed = sum(1 for _, ok, _ in RESULTS if ok)
print("\n%d/%d checks passed." % (passed, total))
sys.exit(0 if passed == total else 1)
