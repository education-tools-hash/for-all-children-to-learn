# Real-browser (Playwright/Chromium) regression test for Phase
# COMMON-A11Y-MODAL-COEXISTENCE-FIX-1-WAVE-B: confirms the explicit Modal
# Coexistence Adapter guard added to nazorin-print.html's single shared
# helpModal/batchModal/libModal Tab Focus Trap eliminates the Case B
# registration-order race identified by COMMON-A11Y-MODAL-COEXISTENCE-AUDIT-1.
#
# Unlike Wave A's Case A apps (exact-match Traps that never fired while
# focus was genuinely in the common A11y panel), nazorin-print's shared Trap
# uses `!modal.contains(activeElement)` -- a condition that IS true whenever
# focus is in the panel (the panel is not inside any of the 3 modals), so
# the unguarded Trap genuinely re-captures focus into the modal on every Tab
# press. The Audit's own reproduction showed this only "looked safe" because
# a later-registered connecting listener's own focus() call happened to run
# after the modal Trap's -- a "last focus() wins" race, not real ownership.
#
# This test proves the fix two ways for each of the 3 modals:
#   (A) panel-only: non-regression of the common A11y panel itself
#       (previously unconnected in this app -- the connector is also new).
#   (B) modal-only: non-regression of the pre-existing per-modal Trap
#       behavior (Tab/Shift+Tab loop, Escape, focus return).
#   (C) simultaneous modal+panel open: the panel keeps strict containment,
#       the modal Trap never yanks focus back, Escape closes the panel
#       first and the modal second (non-regression of the Audit's confirmed
#       Escape ownership), document.hasFocus() never drops to false.
#   (GUARD) explicit ownership proof: spies on the modal's own computed
#       first/last focusable elements' .focus() method across a full real
#       keyboard Tab/Shift+Tab cycle during coexistence and asserts it is
#       never called -- i.e. the guarded Trap's body never executes its
#       focus-moving branches, not merely that a later listener overwrote
#       the result.
#
# This is Automated Verification only -- it is NOT a Real Device / User
# Browser Review and must never be reported as either.
#
# Requires a local static server for the repo root, e.g.:
#   python3 -m http.server 8935 --bind 127.0.0.1
# then: python3 tools/a11y-modal-coexistence-wave-b-nazorin/wave_b_nazorin_test.py
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8935/"
RESULTS = []

MODALS = [
    {"name": "helpModal", "modal_id": "helpModal", "open_btn": "#btnHelp", "close_btn": "#btnHelpClose"},
    {"name": "batchModal", "modal_id": "batchModal", "open_btn": "#btnBatch", "close_btn": "#btnBatchClose"},
    {"name": "libModal", "modal_id": "libModal", "open_btn": "#btnLibrary", "close_btn": "#btnLibClose"},
]

FOCUSABLE_JS = (
    "Array.from(modal.querySelectorAll("
    "'button,input,select,textarea,a[href],[tabindex]'"
    ")).filter(el => el.offsetParent !== null && !el.disabled)"
)


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


def modal_is_open(page, modal_id):
    return page.eval_on_selector("#" + modal_id, "el => el.hidden === false")


def modal_focus_state(page, modal_id):
    return page.evaluate(
        "(id) => {"
        "  const modal = document.getElementById(id);"
        f"  const items = {FOCUSABLE_JS};"
        "  const active = document.activeElement;"
        "  return {"
        "    count: items.length,"
        "    activeIsFirst: items.length > 0 && active === items[0],"
        "    activeIsLast: items.length > 0 && active === items[items.length - 1],"
        "    activeInModal: modal.contains(active),"
        "  };"
        "}",
        modal_id,
    )


def run_phase_a(page, label):
    """A11y-panel-only open state: non-regression / first-time-wired check."""
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    record(label + " [A]: panel opens", panel_open(page))
    n = panel_items_count(page)
    record(label + " [A]: panel has focusable items", n > 0, "n=%d" % n)
    record(label + " [A]: initial focus is the launcher button", active_is_a11y_btn(page))

    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    record(
        label + " [A]: Shift+Tab from launcher wraps into panel (last control)",
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
    record(label + " [A]: full forward Tab cycle never escapes panel", not escaped)
    record(label + " [A]: full forward Tab cycle never escapes to browser chrome", not lost_focus)

    escaped = False
    lost_focus = False
    for _ in range(n + 2):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped = True
        if not has_focus(page):
            lost_focus = True
    record(label + " [A]: full backward Shift+Tab cycle never escapes panel", not escaped)
    record(label + " [A]: full backward Shift+Tab cycle never escapes to browser chrome", not lost_focus)

    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [A]: Escape closes panel", not panel_open(page))
    record(label + " [A]: focus returns to launcher after Escape", active_is_a11y_btn(page))
    record(label + " [A]: document.hasFocus() maintained after Escape", has_focus(page))


def run_phase_b(page, modal):
    """App-modal-only open state: non-regression of the pre-existing Trap."""
    label = "nazorin-print/" + modal["name"]
    page.click(modal["open_btn"])
    page.wait_for_timeout(100)
    record(label + " [B]: modal opens", modal_is_open(page, modal["modal_id"]))

    st = modal_focus_state(page, modal["modal_id"])
    record(label + " [B]: initial focus is modal's first element", st["activeIsFirst"], st)

    page.keyboard.press('Shift+Tab')
    page.wait_for_timeout(50)
    st = modal_focus_state(page, modal["modal_id"])
    record(label + " [B]: Shift+Tab from first wraps to last (stays in modal)", st["activeIsLast"], st)

    page.keyboard.press('Tab')
    page.wait_for_timeout(50)
    st = modal_focus_state(page, modal["modal_id"])
    record(label + " [B]: Tab from last wraps to first (stays in modal)", st["activeIsFirst"], st)

    record(label + " [B]: document.hasFocus() maintained during modal-only Tab cycling", has_focus(page))

    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [B]: Escape closes modal (modal-only, non-regression)", not modal_is_open(page, modal["modal_id"]))


def run_phase_c(page, modal):
    """Simultaneous modal + panel open: the Wave B race-elimination coverage."""
    label = "nazorin-print/" + modal["name"]

    page.click(modal["open_btn"])
    page.wait_for_timeout(100)
    assert modal_is_open(page, modal["modal_id"]), "setup: modal failed to open for Phase C"

    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(150)
    record(label + " [C]: A11y panel opens while modal is still open (click reaches launcher)", panel_open(page))
    record(label + " [C]: modal remains open after panel opens", modal_is_open(page, modal["modal_id"]))
    record(label + " [C]: focus moved to the launcher/panel, not left in modal",
           active_is_a11y_btn(page) or active_in_panel(page))

    n = panel_items_count(page)
    escaped_to_modal = False
    escaped_chrome = False
    yanked_to_modal_first_last = False
    for _ in range(n + 2):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
        st = modal_focus_state(page, modal["modal_id"])
        if st["activeIsFirst"] or st["activeIsLast"]:
            yanked_to_modal_first_last = True
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped_to_modal = True
        if not has_focus(page):
            escaped_chrome = True
    record(label + " [C]: forward Tab cycle (panel+modal open) stays in panel, never enters modal", not escaped_to_modal)
    record(label + " [C]: forward Tab cycle never yanks focus to modal's own first/last control", not yanked_to_modal_first_last)
    record(label + " [C]: forward Tab cycle never escapes to browser chrome", not escaped_chrome)
    record(label + " [C]: modal still open after forward Tab cycle (no accidental close)", modal_is_open(page, modal["modal_id"]))

    escaped_to_modal = False
    escaped_chrome = False
    yanked_to_modal_first_last = False
    for _ in range(n + 2):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)
        st = modal_focus_state(page, modal["modal_id"])
        if st["activeIsFirst"] or st["activeIsLast"]:
            yanked_to_modal_first_last = True
        if not (active_in_panel(page) or active_is_a11y_btn(page)):
            escaped_to_modal = True
        if not has_focus(page):
            escaped_chrome = True
    record(label + " [C]: backward Shift+Tab cycle (panel+modal open) stays in panel, never enters modal", not escaped_to_modal)
    record(label + " [C]: backward Shift+Tab cycle never yanks focus to modal's own first/last control", not yanked_to_modal_first_last)
    record(label + " [C]: backward Shift+Tab cycle never escapes to browser chrome", not escaped_chrome)
    record(label + " [C]: modal still open after backward Shift+Tab cycle", modal_is_open(page, modal["modal_id"]))

    # Escape ownership: panel closes first, modal remains; second Escape closes the modal.
    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [C]: Escape (panel+modal open) closes the panel only", not panel_open(page))
    record(label + " [C]: modal remains open after panel-level Escape", modal_is_open(page, modal["modal_id"]))
    record(label + " [C]: focus returns to the A11y launcher after panel-level Escape", active_is_a11y_btn(page))

    page.keyboard.press('Escape')
    page.wait_for_timeout(100)
    record(label + " [C]: second Escape then closes the modal itself", not modal_is_open(page, modal["modal_id"]))


def run_guard_effectiveness(page, modal):
    """
    Proves genuine ownership (not a 'last focus() wins' registration-order
    race, per the Audit's nazorin-print finding): while the coexistence
    state holds, spy on the modal's OWN computed first/last elements'
    .focus() method across a full real keyboard Tab/Shift+Tab cycle and
    assert it is never called.
    """
    label = "nazorin-print/" + modal["name"]

    page.click(modal["open_btn"])
    page.wait_for_timeout(80)
    page.click("#donomanaA11yBtn")
    page.wait_for_timeout(120)
    assert panel_open(page) and modal_is_open(page, modal["modal_id"]), "setup: coexistence state not reached"

    page.evaluate(
        "(id) => {"
        "  const modal = document.getElementById(id);"
        f"  const items = {FOCUSABLE_JS};"
        "  window.__waveBSpy = { first: 0, last: 0 };"
        "  const first = items[0], last = items[items.length - 1];"
        "  if (first) { const of = first.focus.bind(first); first.focus = function(){ window.__waveBSpy.first++; return of(); }; }"
        "  if (last && last !== first) { const ol = last.focus.bind(last); last.focus = function(){ window.__waveBSpy.last++; return ol(); }; }"
        "}",
        modal["modal_id"],
    )

    n = panel_items_count(page)
    for _ in range(n + 2):
        page.keyboard.press('Tab')
        page.wait_for_timeout(15)
    for _ in range(n + 2):
        page.keyboard.press('Shift+Tab')
        page.wait_for_timeout(15)

    spy = page.evaluate("window.__waveBSpy")
    record(
        label + " [GUARD]: modal's own first/last .focus() never called during coexistence Tab cycling (genuine ownership, not a race)",
        spy["first"] == 0 and spy["last"] == 0,
        spy,
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(BASE + "nazorin-print.html", timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        page.wait_for_timeout(1200)

    run_phase_a(page, "nazorin-print")

    for modal in MODALS:
        page.reload()
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            page.wait_for_timeout(1200)
        run_phase_b(page, modal)

        page.reload()
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            page.wait_for_timeout(1200)
        run_phase_c(page, modal)

        page.reload()
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            page.wait_for_timeout(1200)
        run_guard_effectiveness(page, modal)

    real_errors = known_cert_flake(errors)
    record("nazorin-print: no JS errors beyond known sandbox cert/tunnel flake", len(real_errors) == 0, real_errors)

    browser.close()

total = len(RESULTS)
passed = sum(1 for _, ok, _ in RESULTS if ok)
print("\n%d/%d checks passed." % (passed, total))
sys.exit(0 if passed == total else 1)
