#!/usr/bin/env python
"""Full Backup real-browser E2E (Phase LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1).

Repo-owned, deterministic replacement for the former scratchpad script
(`backup_hardening_e2e.py`, 21 checks). Drives the ACTUAL learning-records.html:
seed synthetic records -> open a record's detail modal -> press the real
"完全バックアップを書き出す" button -> inspect the downloaded file.

Determinism (see browser_test_helpers.py and docs/records/
learning-record-storage-backup-e2e-hardening-v1_0.md):
  * browser clock frozen, timezone pinned (Asia/Tokyo), locale pinned (ja-JP);
  * every fixture is a literal derived from the frozen instant: no wall clock,
    no Math.random, no "today 10:00";
  * the suite runs once per frozen clock: 12:00 JST and 00:05 JST (just after
    midnight, where "N minutes ago" falls on the previous local day);
  * a card-count precondition separates "fixture not visible" (a test bug)
    from "backup misbehaves" (a product bug).

Check accounting: the 21 checks recovered from the scratchpad suite are kept
verbatim (labels prefixed "[orig]"); checks added by this phase are prefixed
"[add]". Both counts are printed per clock.

Usage:  python tools/record-dashboard-poc/backup-hardening-realbrowser-test.py [--clock noon|after-midnight|all]
Needs:  Python 3, `pip install playwright` + `playwright install chromium`.
Nothing is written into the repo; downloads stay in Playwright's temp area.
"""
import argparse
import json
import sys
from datetime import timedelta

from playwright.sync_api import sync_playwright

# Never write __pycache__ into the repo (no .gitignore here, and CI runs git add -A on main).
sys.dont_write_bytecode = True
import browser_test_helpers as H

# A real, valid 1x1 PNG (deterministic, and a genuine PNG for future Restore validators).
PNG_1X1 = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")

STORAGE_KEYS = ["nazori_records", "hiragana_log", "katakana_log", "sawatte_hirogaru_log", "janken_log", "tokei_log"]


def build_fixtures(now):
    """All fixtures are literals derived from the frozen instant `now`."""
    m = lambda minutes: now - timedelta(minutes=minutes)
    return {
        "nazori_records": [
            {"id": "e2e-nazori-1", "sessionId": "e2e-s1", "timestamp": H.utc_iso(m(60)), "mode": "wide",
             "allChars": "あ", "charCount": 1, "sessionDone": 1, "sessionTotal": 1, "image": PNG_1X1}
        ],
        "hiragana_log": [
            {"time": H.ja_kana_time(m(40)), "type": "trace",
             "data": {"kana": "あ", "tracingJudgmentLevel": "easy",
                      "traceSample": {"version": 1, "coordinateSpace": "normalized-1000", "strokes": [[1, 2, 3, 4, 5, 6]]}},
             "schemaVersion": 1}
        ],
        "katakana_log": [
            {"time": H.ja_kana_time(m(35)), "type": "trace",
             "data": {"kana": "ア", "tracingJudgmentLevel": "standard",
                      "traceSample": {"version": 1, "coordinateSpace": "normalized-1000",
                                      "strokes": [[10, 20, 30, 40], [50, 60, 70, 80]]}},
             "schemaVersion": 1}
        ],
        "sawatte_hirogaru_log": [
            {"timestamp": H.utc_iso(m(30)), "appId": "sawatte-hirogaru-app", "activity": "reaction",
             "inputMethod": "touch", "schemaVersion": 1,
             "payload": {"startTime": 1, "durationMs": 5000, "totalInteractions": 3, "tapCount": 3, "swipeCount": 0,
                         "inputMethods": ["touch"],
                         "trace": {"traceSchemaVersion": 1, "pointLimit": 1000, "trimmed": False,
                                   "taps": [1, 2, 3, 4, 5, 6], "swipes": []}}}
        ],
        "janken_log": [
            {"timestamp": H.utc_iso(m(20)), "inputMethod": None, "schemaVersion": 1,
             "payload": {"mode": "both", "total": 5, "correct": 4, "mistakes": []}}
        ],
        "tokei_log": [
            {"timestamp": H.utc_iso(m(15)), "activity": "quiz", "inputMethod": None, "schemaVersion": 1,
             "payload": {"difficulty": "easy", "mode": "read", "total": 8, "correct": 6, "retried": 1,
                         "avgTimeSec": 3, "durationSec": 30}}
        ],
    }


def seed(page, fixtures):
    page.evaluate("(f) => { for (const k of Object.keys(f)) localStorage.setItem(k, JSON.stringify(f[k])); }", fixtures)


def snapshot(page):
    return page.evaluate("(keys) => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]))", STORAGE_KEYS)


def run_scenario(browser, base, clock_name, now):
    R = H.Results()
    errs = []
    fx = build_fixtures(now)
    stamp = H.backup_filename_stamp(now)
    print("\n--- Backup E2E @ clock=%s (%s) ---" % (clock_name, now.isoformat()))

    ctx = H.new_context(browser, now)
    page = ctx.new_page()
    H.attach_console_gate(page, errs)

    page.goto(base + "/learning-records.html", wait_until="networkidle")
    R.check("[orig] learning-records.html loads with zero console/page errors", len(errs) == 0)
    problem = H.pinned_env_problem(page, now)
    R.check("[add] page sees the pinned clock, timezone (Asia/Tokyo) and locale (ja-JP), independent of the host", problem is None, problem)

    seed(page, fx)
    page.reload(wait_until="networkidle")
    cards = page.locator(".record-card")
    cards.first.wait_for(state="visible")
    seeded = len(fx)
    R.check("[add] precondition: UI card count == seeded record count (%d) -- else the fixture is not visible (test bug, not a Backup bug)"
            % seeded, cards.count() == seeded, "cards=%d" % cards.count())
    if cards.count() != seeded:
        # Fixture-visibility problem: every later step would be meaningless (and would just time out).
        print("ABORT scenario: fixtures are not all visible -- fix the fixture/clock policy, do not blame Backup.")
        ctx.close()
        return R
    before = snapshot(page)

    def open_card(app_name):
        # Match the card's .record-app label EXACTLY. (A substring match on the whole card
        # text is ambiguous: the Katakana card's text also contains "なぞり".)
        for i in range(cards.count()):
            if cards.nth(i).locator(".record-app").inner_text().strip() == app_name:
                cards.nth(i).click()
                page.locator("#detail-modal-body").wait_for(state="visible")
                return True
        return False

    def close_modal():
        page.click("#detail-modal-close")
        page.locator("#detail-modal-body").wait_for(state="hidden")

    def full_backup(app_name):
        opened = open_card(app_name)
        btn = page.locator("#detail-modal-body button", has_text="完全バックアップ")
        return opened, btn

    def download_json(btn):
        with page.expect_download() as dl:
            btn.first.click()
        with open(dl.value.path(), "rb") as f:
            return dl.value.suggested_filename, json.loads(f.read().decode("utf-8"))

    # ---- Nazori ----
    opened, btn = full_backup("なぞり書き練習ツール")
    R.check("[orig] Nazori card found and opened", opened)
    R.check("[orig] Nazori: Full Backup button present", btn.count() > 0)
    R.check("[orig] Nazori: CSV-does-not-include-media hint text present",
            page.locator("#detail-modal-body", has_text="CSVには画像").count() > 0)
    R.check("[add] Nazori: existing CSV button still present next to Full Backup",
            page.locator("#detail-modal-body button", has_text="CSV").count() > 0)
    name, obj = download_json(btn)
    R.check("[orig] Nazori backup: valid JSON downloaded", isinstance(obj, dict))
    R.check("[orig] Nazori backup: backupFormatVersion == 1", obj.get("backupFormatVersion") == 1)
    R.check("[orig] Nazori backup: appId == nazori-app", obj.get("appId") == "nazori-app")
    R.check("[orig] Nazori backup: image Data URL present in downloaded file", "data:image/png;base64," in json.dumps(obj))
    R.check("[orig] Nazori backup: filename has no learner-identifying info, just app id + timestamp",
            "nazori-app-full-backup" in name)
    R.check("[add] Nazori backup: filename is exactly nazori-app-full-backup-%s.json (frozen clock)" % stamp,
            name == "nazori-app-full-backup-%s.json" % stamp, name)
    R.check("[add] Nazori backup: storageKey/recordCount/exportedAt exact",
            obj.get("storageKey") == "nazori_records" and obj.get("recordCount") == 1 and obj.get("exportedAt") == H.utc_iso(now),
            {k: obj.get(k) for k in ("storageKey", "recordCount", "exportedAt")})
    R.check("[add] Nazori backup: records deep-equal the seeded fixture (PNG Data URL byte-identical)",
            obj.get("records") == fx["nazori_records"])
    close_modal()

    # ---- Sawatte ----
    opened, btn = full_backup("さわってひろがる")
    R.check("[orig] Sawatte card found and opened", opened)
    R.check("[orig] Sawatte: Full Backup button present", btn.count() > 0)
    name, obj = download_json(btn)
    R.check("[orig] Sawatte backup: trace taps present in downloaded file",
            obj["records"][0]["payload"]["trace"]["taps"] == [1, 2, 3, 4, 5, 6])
    R.check("[add] Sawatte backup: records deep-equal the fixture; storageKey/recordCount/filename exact",
            obj.get("records") == fx["sawatte_hirogaru_log"] and obj.get("storageKey") == "sawatte_hirogaru_log"
            and obj.get("recordCount") == 1 and name == "sawatte-hirogaru-app-full-backup-%s.json" % stamp, name)
    tr = obj["records"][0]["payload"]["trace"]
    R.check("[add] Sawatte backup: trimmed/pointLimit/traceSchemaVersion preserved (the fields the Trace CSV drops)",
            tr.get("trimmed") is False and tr.get("pointLimit") == 1000 and tr.get("traceSchemaVersion") == 1, tr)
    close_modal()

    # ---- Hiragana ----
    opened, btn = full_backup("ひらがな まなぼう！")
    R.check("[orig] Hiragana card found and opened", opened)
    R.check("[orig] Hiragana: Full Backup button present", btn.count() > 0)
    name, obj = download_json(btn)
    R.check("[orig] Hiragana backup: traceSample strokes present in downloaded file",
            obj["records"][0]["data"]["traceSample"]["strokes"] == [[1, 2, 3, 4, 5, 6]])
    R.check("[add] Hiragana backup: records deep-equal the fixture; storageKey/recordCount/filename exact",
            obj.get("records") == fx["hiragana_log"] and obj.get("storageKey") == "hiragana_log"
            and obj.get("recordCount") == 1 and obj.get("appId") == "hiragana-learn"
            and name == "hiragana-learn-full-backup-%s.json" % stamp, name)
    close_modal()

    # ---- Katakana (not covered by the scratchpad suite) ----
    opened, btn = full_backup("カタカナ まなぼう！")
    R.check("[add] Katakana card found and opened; Full Backup button present", opened and btn.count() > 0)
    name, obj = download_json(btn)
    R.check("[add] Katakana backup: records deep-equal the fixture (2 strokes); storageKey/recordCount/filename exact",
            obj.get("records") == fx["katakana_log"] and obj.get("storageKey") == "katakana_log"
            and obj.get("recordCount") == 1 and obj.get("appId") == "katakana-app"
            and name == "katakana-app-full-backup-%s.json" % stamp, name)
    close_modal()

    # ---- Non-opt-in apps ----
    opened, btn = full_backup("じゃんけん まなぼう！")
    R.check("[orig] Janken card found and opened", opened)
    R.check("[orig] Janken: no Full Backup button (out of scope this phase, correctly absent)", btn.count() == 0)
    close_modal()

    opened, btn = full_backup("とけい")
    R.check("[orig] Tokei card found and opened", opened)
    csv_btn = page.locator("#detail-modal-body button", has_text="CSV")
    R.check("[orig] Tokei: existing CSV button still present (backward compatible)", csv_btn.count() > 0)
    R.check("[orig] Tokei: no Full Backup button (out of scope this phase, correctly absent)", btn.count() == 0)
    with page.expect_download() as dl:
        csv_btn.first.click()
    with open(dl.value.path(), "rb") as f:
        csv_bytes = f.read()
    R.check("[add] Tokei: CSV download still works (UTF-8 BOM, .csv, non-empty) -- CSV backward compatibility",
            dl.value.suggested_filename.endswith(".csv") and csv_bytes.startswith(b"\xef\xbb\xbf") and len(csv_bytes) > 3,
            dl.value.suggested_filename)
    close_modal()

    R.check("[add] Full Backup and CSV export are read-only: all 6 storage values byte-identical before/after",
            snapshot(page) == before)
    R.check("[orig] zero console/page errors after full interaction sequence", len(errs) == 0, errs[:3])
    ctx.close()

    # ---- Empty storage ----
    errs2 = []
    ctx = H.new_context(browser, now)
    page = ctx.new_page()
    H.attach_console_gate(page, errs2)
    page.goto(base + "/learning-records.html", wait_until="networkidle")
    R.check("[add] empty storage: empty state shown, no cards, no Full Backup button, zero errors",
            page.locator("#empty-state").is_visible() and page.locator(".record-card").count() == 0
            and page.locator("button", has_text="完全バックアップ").count() == 0 and len(errs2) == 0, errs2[:3])
    ctx.close()

    # ---- Malformed storage (must degrade safely and never be modified) ----
    errs3 = []
    ctx = H.new_context(browser, now)
    page = ctx.new_page()
    H.attach_console_gate(page, errs3)
    page.goto(base + "/learning-records.html", wait_until="networkidle")
    bad = {"nazori_records": "{not json", "hiragana_log": '{"a":1}', "katakana_log": '"str"', "sawatte_hirogaru_log": "null"}
    page.evaluate("(b) => { for (const k of Object.keys(b)) localStorage.setItem(k, b[k]); }", bad)
    page.reload(wait_until="networkidle")
    after_bad = page.evaluate("(keys) => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]))", list(bad.keys()))
    R.check("[add] malformed storage: page loads with zero errors, shows no cards, and leaves the malformed values untouched",
            len(errs3) == 0 and page.locator(".record-card").count() == 0 and after_bad == bad, errs3[:3])
    ctx.close()

    print("[%s] %d/%d checks (orig=%d, add=%d)" % (
        clock_name, R.passed, R.total,
        sum(1 for l, _ in R.items if l.startswith("[orig]")), sum(1 for l, _ in R.items if l.startswith("[add]"))))
    return R


def main():
    H.utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--clock", choices=["noon", "after-midnight", "all"], default="all")
    args = ap.parse_args()
    clocks = H.CLOCKS if args.clock == "all" else {args.clock: H.CLOCKS[args.clock]}

    total = H.Results()
    with H.serve_repo() as base, sync_playwright() as p:
        browser = p.chromium.launch()
        H.print_header("Backup Hardening real-browser E2E", browser, base + "/learning-records.html", clocks)
        for name, now in clocks.items():
            try:
                r = run_scenario(browser, base, name, now)
                total.items.extend(("%s @ %s" % (l, name), ok) for l, ok in r.items)
            except Exception as e:  # tidy failure instead of a raw traceback; still exits non-zero
                total.items.append(("scenario aborted by exception @ %s: %s" % (name, str(e).splitlines()[0][:160]), False))
        browser.close()
    return H.finish("Backup browser E2E (%s)" % ", ".join(clocks), total)


if __name__ == "__main__":
    sys.exit(main())
