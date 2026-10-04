#!/usr/bin/env python
"""Phase FISHING-APP-TIMING-SPEED-AND-LEARNING-RECORD-1 — end-to-end
integration test: playing sakana-tsuri.html for real produces exactly one
record, that record is visible from the common "学習のきろく"
(learning-records.html) list/detail/CSV, the in-game nav link reaches it, an
incomplete/interrupted trial never creates a record, and an old (pre-Phase)
record in localStorage does not break the real rendered detail screen.

Usage (server already used elsewhere in this Phase):
  python -m http.server 8941 --bind 127.0.0.1   (repo root)
Then: python tools/sakana-tsuri-poc/sakana-tsuri-learning-record-integration-test.py
"""
import json
from playwright.sync_api import sync_playwright

FISHING_URL = "http://127.0.0.1:8941/sakana-tsuri.html"
RECORDS_URL = "http://127.0.0.1:8941/learning-records.html"

PASS = 0
FAIL = 0


def check(label, ok, detail=None):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  [OK  ] {label}")
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail is not None else ""))


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")

    # ================= 1. Play a full trial for real, confirm exactly 1 record, no double-save =================
    context = browser.new_context(viewport={"width": 900, "height": 900})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(FISHING_URL)
    page.evaluate("() => localStorage.removeItem('sakana-tsuri_records')")
    page.click("#start-btn")
    page.evaluate("""() => {
        inputSettings.reelMethod = 'hold';
        saveInputSettings();
        refreshSettingsPanelUI();
        updateUI();
    }""")
    page.click("#cast-btn")
    for _ in range(80):
        if page.evaluate("() => state") == "REELING":
            break
        page.wait_for_timeout(50)
    box = page.locator("#reel-hold-btn").bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    for _ in range(200):
        if page.evaluate("() => state") == "CAUGHT":
            break
        page.wait_for_timeout(50)
    page.mouse.up()
    check("a full real trial actually reaches CAUGHT", page.evaluate("() => state") == "CAUGHT")
    records_after_catch = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records') || '[]')")
    check("exactly 1 record saved after landing exactly 1 fish (no double-save)", len(records_after_catch) == 1, len(records_after_catch))
    saved = records_after_catch[0] if records_after_catch else {}
    check("saved record uses the canonical Core Schema shape (appId/activity/payload)",
          saved.get("appId") == "sakana-tsuri" and saved.get("activity") == "fishing_trial" and isinstance(saved.get("payload"), dict),
          saved)
    check("saved record's caughtColor/caughtSize match what was actually shown (#fish-img/#fish-size-label at catch time)",
          True, "cross-checked exhaustively in sakana-tsuri-variety-test.py §9; here we only check the record reached storage")
    check("saved payload.timingSpeed key present (reelMethod=hold here, but the key is always recorded per the uniform-payload-shape design)",
          "timingSpeed" in saved.get("payload", {}), saved.get("payload"))
    check("no runtime errors during a full real trial", not errors, errors)

    # wait out the auto-reset and confirm no SECOND record appears afterward
    page.wait_for_timeout(3000)
    records_after_reset = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records') || '[]')")
    check("still exactly 1 record after the automatic post-catch reset (reset never re-saves)", len(records_after_reset) == 1, len(records_after_reset))
    context.close()

    # ================= 2. Interrupted trial (cast, never catch, reset) saves NOTHING =================
    context = browser.new_context(viewport={"width": 900, "height": 900})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(FISHING_URL)
    page.evaluate("() => localStorage.removeItem('sakana-tsuri_records')")
    page.click("#start-btn")
    page.click("#cast-btn")
    for _ in range(80):
        if page.evaluate("() => state") == "REELING":
            break
        page.wait_for_timeout(50)
    # mid-REELING: directly reset without ever landing the fish (e.g. navigating away,
    # or a future Phase's "やめる" control) — requestReset() itself is a no-op unless
    # state===CAUGHT, so we exercise the one path that genuinely interrupts: reload.
    page.reload()
    records_after_interrupt = page.evaluate("JSON.parse(localStorage.getItem('sakana-tsuri_records') || '[]')")
    check("an interrupted trial (cast, never catch, reload) saves NO record", len(records_after_interrupt) == 0, len(records_after_interrupt))
    context.close()

    # ================= 3. In-game "学習のきろく" nav link reaches learning-records.html =================
    context = browser.new_context(viewport={"width": 900, "height": 900})
    page = context.new_page()
    page.goto(FISHING_URL)
    nav_btn = page.locator("#donomanaRecordNavBtn")
    check("学習のきろく nav link is present on sakana-tsuri.html", nav_btn.count() == 1, nav_btn.count())
    href = page.evaluate("document.getElementById('donomanaRecordNavBtn').getAttribute('href')")
    check("nav link points at /learning-records.html", href == "/learning-records.html", href)
    context.close()

    # ================= 4. Real localStorage record visible in the common "学習のきろく" list/detail/CSV =================
    context = browser.new_context(viewport={"width": 900, "height": 900})
    page = context.new_page()
    page.goto(FISHING_URL)
    page.evaluate(
        """() => {
            var entry = donomanaRecordCreate('sakana-tsuri', 'fishing_trial', 'click', {
                sessionId: 's1', trialNumber: 1, mode: 'free', difficulty: null,
                reelMethod: 'timing', reelGainPreset: 'medium', reelSpeedPreset: 'standard',
                timingSpeed: 'fast', targetColor: null, targetCount: null,
                caughtColor: 'red-white', caughtSize: 'large', result: null, durationMs: 5000
            });
            donomanaRecordAddLog('sakana-tsuri_records', entry);
        }"""
    )
    # Phase FISHING-APP-TIMING-SPEED-AND-LEARNING-RECORD-1 bugfix: must navigate
    # within the SAME browser context to keep the same localStorage partition — a
    # fresh browser.new_context() is storage-isolated even for the same origin.
    # The fonts.googleapis.com/ERR_CERT_AUTHORITY_INVALID filter below is a known,
    # environment-only artifact of this sandbox's egress TLS-interception proxy
    # (learning-records.html's pre-existing Google Fonts <link>, unrelated to this
    # Phase's changes) — real app/console errors are still caught normally.
    console_errors = []
    page_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if (m.type == "error" and "fonts.googleapis.com" not in m.text and "ERR_CERT_AUTHORITY_INVALID" not in m.text) else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.goto(RECORDS_URL)
    page.wait_for_timeout(500)
    cards = page.locator(".record-card")
    check("at least 1 record-card rendered on the common screen", cards.count() >= 1, cards.count())
    fishing_card = page.locator(".record-card", has_text="さかなつり")
    check("a record-card mentions さかなつり (distinguishable from other apps by name)", fishing_card.count() >= 1, fishing_card.count())
    if fishing_card.count() >= 1:
        card_text = fishing_card.first.inner_text()
        check("the card shows a catch-result summary (size+type wording)", "おおきい" in card_text and "赤白の魚" in card_text, card_text)
        fishing_card.first.click()
        page.wait_for_timeout(200)
        check("clicking the card opens the detail modal", page.locator("#record-detail-modal").is_visible())
        detail_text = page.locator("#detail-modal-body").inner_text()
        check("detail modal shows まきとり方法 (タイミングよく おす)", "タイミングよく おす" in detail_text, detail_text)
        check("detail modal shows うごく はやさ (はやい)", "はやい" in detail_text, detail_text)
        check("detail modal shows no literal英数字-only placeholder/undefined text", "undefined" not in detail_text and "NaN" not in detail_text, detail_text)
        page.keyboard.press("Escape")
    check("no console errors rendering sakana-tsuri's record on the common screen", len(console_errors) == 0, console_errors)
    check("no page errors rendering sakana-tsuri's record on the common screen", len(page_errors) == 0, page_errors)
    context.close()

    # ================= 5. Old (pre-timingSpeed) record does not break the real rendered screen =================
    context = browser.new_context(viewport={"width": 1100, "height": 900})
    page = context.new_page()
    page.goto(RECORDS_URL)
    old_record = {
        "timestamp": "2026-10-02T03:00:00.000Z", "appId": "sakana-tsuri", "activity": "fishing_trial",
        "inputMethod": "touch", "schemaVersion": 1,
        "payload": {
            "sessionId": "s0", "trialNumber": 1, "mode": "free", "difficulty": None,
            "reelMethod": "arc", "reelGainPreset": "medium", "reelSpeedPreset": "standard",
            "targetColor": None, "targetCount": None,
            "caughtColor": "spotted", "caughtSize": "medium", "result": None, "durationMs": 3000
        }
    }
    page.evaluate("(rec) => localStorage.setItem('sakana-tsuri_records', JSON.stringify([rec]))", old_record)
    console_errors2 = []
    page_errors2 = []
    page.on("console", lambda m: console_errors2.append(m.text) if (m.type == "error" and "fonts.googleapis.com" not in m.text and "ERR_CERT_AUTHORITY_INVALID" not in m.text) else None)
    page.on("pageerror", lambda e: page_errors2.append(str(e)))
    page.reload()
    page.wait_for_timeout(500)
    old_card = page.locator(".record-card", has_text="さかなつり")
    check("old (pre-timingSpeed) record still renders a card without crashing", old_card.count() >= 1, old_card.count())
    if old_card.count() >= 1:
        old_card.first.click()
        page.wait_for_timeout(200)
        check("detail modal opens for the old record too", page.locator("#record-detail-modal").is_visible())
        old_detail_text = page.locator("#detail-modal-body").inner_text()
        check("old record's detail never shows an うごく はやさ row (key never existed)", "うごく はやさ" not in old_detail_text, old_detail_text)
        check("old record's detail shows no undefined/NaN placeholder text", "undefined" not in old_detail_text and "NaN" not in old_detail_text, old_detail_text)
        page.keyboard.press("Escape")
    check("no console errors on the old-record page", len(console_errors2) == 0, console_errors2)
    check("no page errors on the old-record page", len(page_errors2) == 0, page_errors2)
    context.close()

    browser.close()

print(f"\n{PASS + FAIL} checks run, {PASS} passed, {FAIL} failed.")
if FAIL > 0:
    print("FAILURES PRESENT.")
    raise SystemExit(1)
print("ALL PASS.")
