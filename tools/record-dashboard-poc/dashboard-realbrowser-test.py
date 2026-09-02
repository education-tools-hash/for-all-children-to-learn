#!/usr/bin/env python
"""Phase T8-B2 — Real-browser regression test for learning-records.html
("学習のきろく").

Drives the ACTUAL learning-records.html (Local RC, feature branch only) via
Playwright (the same Chromium install used by tools/make-mockups.py and
tools/tracing-poc/test-*-realbrowser.py — no new browser dependency). This
covers everything that a Node-only test cannot: real DOM rendering, XSS
non-execution, personal-data absence in rendered text, corrupted-storage
isolation, read-only proof (localStorage before/after), keyboard focus trap,
responsive viewport overflow, and console/page error counts.

This does not modify learning-records.html or the 21 app files; it only
reads/interacts with them via a real browser.

Usage: python tools/record-dashboard-poc/dashboard-realbrowser-test.py
"""
import json
import pathlib
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = HERE.parent.parent
PAGE_PATH = REPO_ROOT / "learning-records.html"
PAGE_URL = PAGE_PATH.as_uri()
CSV_OUT_DIR = HERE / "dashboard-realbrowser-artifacts"
CSV_OUT_DIR.mkdir(exist_ok=True)

PASS = 0
FAIL = 0


def check(label, condition, detail=None):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [OK  ] {label}" + (f" — {detail}" if detail is not None else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail is not None else ""))


# 21 Foundation apps: storageKey + structure, copied from the Adapter Registry
# in assets/js/record-dashboard-foundation.js (source of truth). Kept as a
# local mirror here (test-only) rather than exported from the Foundation
# module's public API, per the design doc's "minimal API surface" principle.
STORAGE_MAP = {
    'janken-app': ('janken_log', 'flat'),
    'register-app': ('register_log', 'flat'),
    'tokei-app': ('tokei_log', 'flat'),
    'matching-app': ('matching_log', 'flat'),
    'shiritori2': ('shiritori2_log', 'flat'),
    'directions-app': ('appLogs', 'flat'),
    'hiragana-learn': ('hiragana_log', 'flat'),
    'katakana-app': ('katakana_log', 'flat'),
    'suji-manabou': ('suji_log', 'flat'),
    'mitsukete-touch-app': ('mitsukete_touch_log', 'flat'),
    'junban-miyou-app': ('junban_miyou_log', 'flat'),
    'kurabeyou-app': ('kurabeyou_log', 'flat'),
    'katachi-awase-app': ('katachi_log', 'flat'),
    'dotchiga-ii-app': ('dotchiga_ii_log', 'flat'),
    'miru-hirogaru-app': ('miru_hirogaru_log', 'flat'),
    'okane-app': ('okane_activity_log', 'flat'),
    'sst-app': ('sst_activity_log_v1', 'flat'),
    'mogura-tataki': ('mogura_v3', 'flat'),
    'nazori-app': ('nazori_records', 'flat'),
    'bosai-app': ('bosai_log', 'flat'),
    'kyou-no-kiroku': ('kyounokiroku', 'nested'),
}

# Mirrors tools/record-dashboard-poc/fixtures.js GOLDEN (one real-shape entry
# per app). Kept in sync manually; both files draw from the same production
# schemas documented in the design doc §3.
GOLDEN = {
    'janken-app': {"timestamp": "2026-09-01T10:00:00.000Z", "appId": "janken-app", "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
                   "payload": {"mode": "win", "total": 3, "correct": 2, "mistakes": [{"question": "グーに かつのは どれ？", "selected": "チョキ", "correct": "パー"}]}},
    'register-app': {"timestamp": "2026-09-01T11:00:00.000Z", "appId": "register-app", "activity": "checkout", "inputMethod": None, "schemaVersion": 1,
                      "payload": {"itemCount": 3, "totalAmount": 650, "paymentReceived": 1000, "change": 350, "items": [{"name": "クッキー", "quantity": 3, "unitPrice": 100, "subtotal": 300}]}},
    'tokei-app': {"timestamp": "2026-09-01T09:00:00.000Z", "appId": "tokei-app", "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
                  "payload": {"difficulty": "normal", "mode": "quiz", "total": 5, "correct": 4, "retried": 1, "avgTimeSec": 3.2, "durationSec": 40}},
    'matching-app': {"timestamp": "2026-09-01T08:00:00.000Z", "appId": "matching-app", "activity": "match-solo", "inputMethod": None, "schemaVersion": 1,
                      "payload": {"mode": "match-solo", "level": 2, "pairs": 6, "moves": 14, "durationSec": 55}},
    'shiritori2': {"timestamp": "2026-09-01T07:00:00.000Z", "appId": "shiritori2", "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
                    "payload": {"mode": "quiz", "total": 8, "correct": 7, "score": 700, "maxStreak": 5, "chainLength": 8, "durationSec": 90}},
    'directions-app': {"ts": "2026-09-01T06:00:00.000Z", "category": "quiz", "question": "みぎに すすんで", "userAnswer": "みぎ", "correctAnswer": "みぎ", "result": "correct", "schemaVersion": 1},
    'hiragana-learn': {"time": "2026-09-01T05:00:00.000Z", "type": "trace", "data": {"kana": "あ", "traceSample": None}, "schemaVersion": 1},
    'katakana-app': {"time": "2026-09-01T05:10:00.000Z", "type": "quiz", "data": {"kana": "ア", "correct": True}, "schemaVersion": 1},
    'suji-manabou': {"time": "2026-09-01T05:20:00.000Z", "type": "trace", "data": {"num": "3"}, "schemaVersion": 1},
    'mitsukete-touch-app': {"time": "2026-09-01T04:00:00.000Z", "level": 2, "selectedPosition": "left", "itemRole": "target", "inputMethod": "gaze", "responseTime": 1200, "dwellDuration": 800, "trial": 1},
    'junban-miyou-app': {"time": "2026-09-01T03:00:00.000Z", "level": 1, "passenger": "いぬ", "sequenceIndex": 2, "sequenceLength": 4, "inputMethod": "switch", "responseTime": 900, "trialIndex": 1},
    'kurabeyou-app': {"time": "2026-09-01T02:00:00.000Z", "concept": "size", "level": 3, "correct": True, "mistakeSelections": [], "responseTimeMs": 1500, "inputMethod": None},
    'katachi-awase-app': {"time": "2026-09-01T01:00:00.000Z", "concept": "shape", "level": 1, "shape": "circle", "correct": True, "mistakes": 0, "inputMethod": "unknown"},
    'dotchiga-ii-app': {"date": "2026-09-01", "time": "2026-09-01T00:00:00.000Z", "activity": "preference", "category": "food", "pair": "apple-vs-banana", "selectedChoice": "apple", "selectedLabel": "りんご", "inputMethod": "gaze", "trialIndex": 1, "trialTotal": 5, "dwellDuration": 700},
    'miru-hirogaru-app': {"time": "2026-08-31T23:00:00.000Z", "level": 1, "target": "ひかる おもちゃ", "inputMethod": "switch", "responseTime": 500, "dwellDuration": 300, "activationCount": 3},
    'okane-app': {"ts": "2026-08-31T22:00:00.000Z", "type": "shop", "detail": "￥650のおかいもの（おつり ￥350）", "schemaVersion": 1},
    'sst-app': {"ts": 1798000000000, "type": "rp", "lv": 2, "result": "done", "schemaVersion": 1},
    'mogura-tataki': {"date": "2026/8/31 21:00:00", "score": 120, "hits": 12, "misses": 3, "rate": 80, "combo": 4, "diff": "normal", "mode": "time", "schemaVersion": 1},
    'nazori-app': {"id": "n1", "timestamp": "2026-08-31T20:00:00.000Z", "allChars": "あいうえお", "mode": "wide", "sessionDone": 4, "sessionTotal": 5, "durationMin": 3, "isComplete": False, "image": None},
    'bosai-app': {"id": "b1", "kind": "quiz", "name": "たろう", "simType": "earthquake", "correct": 4, "total": 5, "score": 80, "timestamp": "2026-08-31T19:00:00.000Z", "log": []},
    'kyou-no-kiroku': {"id": "r1", "childIndex": 0, "childName": "はなこ", "date": "2026-08-31T18:00:00.000Z", "memo": "", "schemaVersion": 1},
}

PERSONAL_DATA_MARKERS = ["たろう", "クッキー", "あいうえお", "はなこ"]  # たろう/クッキー/あいうえお/はなこ


def set_fixture_storage(page, app_ids, overrides=None):
    """Sets localStorage for the given app_ids using GOLDEN (optionally
    overridden per-app), matching each adapter's actual storageKey/structure."""
    overrides = overrides or {}
    for app_id in app_ids:
        storage_key, structure = STORAGE_MAP[app_id]
        entry = dict(GOLDEN[app_id])
        entry.update(overrides.get(app_id, {}))
        if structure == 'nested':
            value = json.dumps({"children": [], "records": [entry]})
        else:
            value = json.dumps([entry])
        page.evaluate("([k, v]) => localStorage.setItem(k, v)", [storage_key, value])


def clear_all_storage(page):
    page.evaluate("() => localStorage.clear()")


def snapshot_storage(page):
    keys = [v[0] for v in STORAGE_MAP.values()]
    return page.evaluate("(keys) => keys.map(k => [k, localStorage.getItem(k)])", keys)


# Phase T9-B: learning-records.html now carries root-absolute PWA resource
# links (<link rel="manifest" href="/site.webmanifest">,
# <script src="/assets/js/pwa-register.js">) injected by generate.js. Under
# this script's file:// loading (PAGE_URL = PAGE_PATH.as_uri()), an
# absolute "/" path resolves to the filesystem root, not the repo root, so
# both requests fail with a generic "Failed to load resource:
# net::ERR_FILE_NOT_FOUND" console message that carries no URL. This is a
# file://-testing artifact only — on real HTTP serving (donomana.jp, and
# the T9-B tools/pwa-poc/pwa-realbrowser-test.py suite which serves over
# http://127.0.0.1) both resources resolve correctly and that suite's own
# PWA lifecycle tests show zero console errors. We identify the exact
# known-benign failed requests via the `requestfailed` event (which does
# carry the URL) and only then discount one matching generic console
# message per such failure — any other ERR_FILE_NOT_FOUND (a real missing
# asset) still counts as a failure.
_FILE_PROTOCOL_KNOWN_PATHS = ("/site.webmanifest", "/assets/js/pwa-register.js")
_GENERIC_RESOURCE_ERROR_TEXT = "Failed to load resource: net::ERR_FILE_NOT_FOUND"


def new_page(context):
    page = context.new_page()
    errors = {"console_errors": [], "page_errors": []}
    state = {"known_benign_failures": 0}

    def on_request_failed(request):
        if request.url.startswith("file://") and request.url.endswith(_FILE_PROTOCOL_KNOWN_PATHS):
            state["known_benign_failures"] += 1

    def on_console(msg):
        if msg.type != "error":
            return
        if msg.text == _GENERIC_RESOURCE_ERROR_TEXT and state["known_benign_failures"] > 0:
            state["known_benign_failures"] -= 1
            return
        errors["console_errors"].append(msg.text)

    page.on("requestfailed", on_request_failed)
    page.on("console", on_console)
    page.on("pageerror", lambda exc: errors["page_errors"].append(str(exc)))
    return page, errors


def goto_fresh(page):
    page.goto(PAGE_URL)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ── Test A: Empty state ──────────────────────────────────────
        print("=== A. Empty state (no localStorage records) ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        page.reload()
        check("empty-state visible", page.locator("#empty-state").is_visible())
        check("dashboard-body hidden", not page.locator("#dashboard-body").is_visible())
        check("no console/page errors on empty state", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test B: Mixed 21-app fixture ─────────────────────────────
        print("\n=== B. Mixed 21-app fixture ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")

        check("dashboard-body visible", page.locator("#dashboard-body").is_visible())
        check("empty-state hidden", not page.locator("#empty-state").is_visible())
        card_count = page.locator(".record-card").count()
        check("20 records rendered by default (21 Foundation minus kyou-no-kiroku)", card_count == 20, card_count)

        body_text = page.locator("body").inner_text()
        check("kyou-no-kiroku childName not present anywhere on page", "はなこ" not in body_text)
        check("register item name not present anywhere on page", "クッキー" not in body_text)
        check("nazori allChars not present anywhere on page", "あいうえお" not in body_text)
        check("bosai child name not present in Timeline (card list)", "たろう" not in page.locator("#timeline").inner_text())

        # Open the bosai record's detail and confirm the name still never appears.
        bosai_card = page.locator(".record-card", has_text="ぼうさいたんけんたい")
        if bosai_card.count() > 0:
            bosai_card.first.click()
            check("bosai name absent from Detail modal too", "たろう" not in page.locator("#detail-modal-body").inner_text())
            page.keyboard.press("Escape")
            check("focus returns to the record card after Escape", page.evaluate("() => document.activeElement.classList.contains('record-card')"))
        else:
            check("bosai card found for detail-leakage check", False)

        summary_apps = page.locator("#summary-apps").inner_text()
        check("summary shows 20 distinct apps used", summary_apps == "20", summary_apps)
        check("no raw internal activity code (e.g. \"wide\") visible on the page", "wide" not in body_text)
        check("nazori activity shows the mapped Japanese label instead", "続けて書く" in body_text)
        check("no forbidden ranking/average/achievement-rate text on page", not any(w in body_text for w in ["ランキング", "平均点", "達成率", "苦手"]))
        check("no console/page errors on mixed fixture", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)

        # CSV export -> real download, inspect file.
        with page.expect_download() as dl_info:
            page.click("#csv-export-btn")
        download = dl_info.value
        csv_path = CSV_OUT_DIR / "mixed-fixture.csv"
        download.save_as(str(csv_path))
        csv_bytes = csv_path.read_bytes()
        check("CSV file begins with UTF-8 BOM", csv_bytes[:3] == b"\xef\xbb\xbf")
        csv_text = csv_bytes.decode("utf-8-sig")
        csv_line_count = len([l for l in csv_text.splitlines() if l.strip()])
        check("CSV has header + 20 data rows", csv_line_count == 21, csv_line_count)
        check("CSV does not contain any personal-data marker", not any(m in csv_text for m in PERSONAL_DATA_MARKERS))

        context.close()

        # ── Test C: XSS non-execution ────────────────────────────────
        print("\n=== C. XSS fixture (okane detail / directions question) ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        xss_payload_img = "<img src=x onerror=window.__xssFired=1>"
        xss_payload_script = "<script>window.__xssFired=1</script>"
        set_fixture_storage(page, list(STORAGE_MAP.keys()), overrides={
            'okane-app': {"detail": xss_payload_img},
            'directions-app': {"question": xss_payload_script},
        })
        page.reload()
        page.select_option("#filter-period", "all")
        page.wait_for_timeout(150)
        xss_fired = page.evaluate("() => window.__xssFired === 1")
        check("XSS payload did NOT execute", not xss_fired)
        timeline_html = page.locator("#timeline").inner_html()
        check("no live <img> element rendered anywhere on the page", page.locator("img").count() == 0)
        check("no extra <script> element injected into the timeline", "<script" not in timeline_html.lower())
        timeline_text = page.locator("#timeline").inner_text()
        check("payload rendered as literal visible text (not silently dropped)", xss_payload_img in timeline_text or xss_payload_script in timeline_text)
        check("no console/page errors from XSS fixture (script never ran)", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test D: Corrupted storage isolation ──────────────────────
        print("\n=== D. Corrupted storage isolation ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.evaluate("() => localStorage.setItem('janken_log', '{not valid json')")
        page.reload()
        page.select_option("#filter-period", "all")
        check("storage-warning shown", page.locator("#storage-warning").is_visible())
        remaining = page.locator(".record-card").count()
        check("other 19 apps still render despite 1 corrupted app", remaining == 19, remaining)
        check("no console/page errors despite malformed JSON in one app", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test E: Read-only proof ───────────────────────────────────
        print("\n=== E. Read-only proof (storage snapshot before/after interaction) ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        before = snapshot_storage(page)
        page.select_option("#filter-period", "all")
        page.select_option("#filter-period", "7d")
        page.select_option("#filter-period", "all")
        first_card = page.locator(".record-card").first
        first_card.click()
        page.keyboard.press("Escape")
        with page.expect_download() as dl_info:
            page.click("#csv-export-btn")
        dl_info.value.save_as(str(CSV_OUT_DIR / "readonly-check.csv"))
        after = snapshot_storage(page)
        check("all 21 storage keys byte-for-byte unchanged after full interaction", before == after)
        context.close()

        # ── Test F: Responsive (no horizontal overflow) ───────────────
        print("\n=== F. Responsive viewports ===")
        for w, h in [(375, 667), (390, 844), (768, 1024), (1280, 900)]:
            context = browser.new_context(viewport={"width": w, "height": h})
            page, errors = new_page(context)
            goto_fresh(page)
            clear_all_storage(page)
            set_fixture_storage(page, list(STORAGE_MAP.keys()))
            page.reload()
            page.select_option("#filter-period", "all")
            scroll_w = page.evaluate("() => document.documentElement.scrollWidth")
            check(f"no horizontal overflow at {w}x{h}", scroll_w <= w, scroll_w)
            context.close()

        # ── Test G: 200% zoom (Chromium CSS zoom emulation) ───────────
        print("\n=== G. 200% zoom ===")
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")
        page.evaluate("() => { document.documentElement.style.zoom = '2'; }")
        page.wait_for_timeout(100)
        scroll_w_zoom = page.evaluate("() => document.documentElement.scrollWidth")
        client_w_zoom = page.evaluate("() => document.documentElement.clientWidth")
        check("no horizontal overflow at 200% zoom (375px viewport)", scroll_w_zoom <= client_w_zoom + 2, (scroll_w_zoom, client_w_zoom))
        context.close()

        # ── Test H: Keyboard operation (native button/select, focus trap) ──
        print("\n=== H. Keyboard operation ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")
        first_card = page.locator(".record-card").first
        first_card.focus()
        check("record card is a native <button> (keyboard-operable by default)", page.evaluate("() => document.activeElement.tagName") == "BUTTON")
        page.keyboard.press("Enter")
        check("Enter key opens the detail modal", page.locator("#record-detail-modal").is_visible())
        check("focus moved into the modal (close button)", page.evaluate("() => document.activeElement.id") == "detail-modal-close")
        page.keyboard.press("Tab")
        page.keyboard.press("Tab")
        check("Tab does not escape the modal while it is open (focus trap)", page.evaluate("() => document.getElementById('record-detail-modal').contains(document.activeElement)"))
        page.keyboard.press("Escape")
        check("Escape closes modal and returns focus to the triggering card", (not page.locator("#record-detail-modal").is_visible()) and page.evaluate("() => document.activeElement.classList.contains('record-card')"))
        check("no console/page errors during keyboard interaction", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        # ── Test I: Accessibility semantics (landmarks, headings, dialog, live region) ──
        print("\n=== I. Accessibility semantics ===")
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page, errors = new_page(context)
        goto_fresh(page)
        clear_all_storage(page)
        set_fixture_storage(page, list(STORAGE_MAP.keys()))
        page.reload()
        page.select_option("#filter-period", "all")
        check("exactly one <h1>", page.locator("h1").count() == 1)
        check("<main> landmark present", page.locator("main").count() == 1)
        check("date groups use <h3> headings", page.locator("h3.date-heading").count() >= 1)
        check("filters are native <select> elements (keyboard/screen-reader native)", page.locator("select").count() == 4)
        check("record card is a native <button> with descriptive text as its accessible name", page.locator(".record-card").first.evaluate("n => n.tagName") == "BUTTON" and len(page.locator(".record-card").first.inner_text()) > 0)
        page.click(".record-card >> nth=0")
        dialog_attrs = page.evaluate(
            "() => { const m = document.getElementById('record-detail-modal'); "
            "return {role: m.getAttribute('role'), ariaModal: m.getAttribute('aria-modal'), "
            "labelledby: m.getAttribute('aria-labelledby'), hasLabel: !!document.getElementById(m.getAttribute('aria-labelledby'))}; }"
        )
        check("detail modal has role=dialog + aria-modal=true + valid aria-labelledby", dialog_attrs == {"role": "dialog", "ariaModal": "true", "labelledby": "detail-modal-title", "hasLabel": True}, dialog_attrs)
        page.keyboard.press("Escape")
        live_attr = page.evaluate("() => document.getElementById('filter-live-region').getAttribute('aria-live')")
        check("filter result live region is aria-live=polite", live_attr == "polite")
        live_text = page.evaluate("() => document.getElementById('filter-live-region').textContent")
        check("live region announces a result count (not empty, not raw code)", "件の記録を表示しています" in live_text, live_text)
        check("no console/page errors during accessibility checks", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)
        context.close()

        browser.close()

    print(f"\n{PASS}/{PASS + FAIL} checks passed.")
    if FAIL == 0:
        print("ALL PASS.")
        sys.exit(0)
    else:
        print(f"{FAIL} FAILURES.")
        sys.exit(1)


if __name__ == "__main__":
    main()
