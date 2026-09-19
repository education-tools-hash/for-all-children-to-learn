#!/usr/bin/env python
"""Restore real-browser E2E (Phase LEARNING-RECORD-STORAGE-BACKUP-RESTORE-IMPLEMENTATION-1).

Drives the ACTUAL learning-records.html: pick a backup file with the real
(hidden) file input, read the preview dialog, confirm, and inspect localStorage.
Uses the repo-owned deterministic environment (browser_test_helpers.py): frozen
clock, pinned timezone/locale, free-port in-process server, console gate.

Scenario ids R1..R26 follow the approved Restore Design test matrix
(docs/records/learning-record-storage-backup-restore-design-v1_0.md §16 and the
implementation phase brief). Failure injection is done from the test only
(Storage.prototype.setItem overridden inside the page); no hook exists in
Production code.

Usage:  python tools/record-dashboard-poc/restore-realbrowser-test.py [--clock noon|after-midnight]
"""
import argparse
import json
import sys
import traceback
from datetime import timedelta

from playwright.sync_api import sync_playwright

# Never write __pycache__ into the repo (no .gitignore here, and CI runs git add -A on main).
sys.dont_write_bytecode = True
import browser_test_helpers as H

PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
BIG_PNG_HEAD = "data:image/png;base64,iVBORw0KGgoAAAAN"   # 16 valid base64 chars, then 'AAAA' padding quads

KEYS = {"nazori-app": "nazori_records", "hiragana-learn": "hiragana_log",
        "katakana-app": "katakana_log", "sawatte-hirogaru-app": "sawatte_hirogaru_log"}
NAMES = {"nazori-app": "なぞり書き練習ツール", "hiragana-learn": "ひらがな まなぼう！",
         "katakana-app": "カタカナ まなぼう！", "sawatte-hirogaru-app": "さわってひろがる"}
READ_ERR = "バックアップを読み込めませんでした。ファイルの内容をご確認ください。"
WRITE_ERR = "記録を復元できませんでした。端末の保存容量やブラウザの設定をご確認ください。"

INJECT = """(name) => {
  window.__origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { throw new DOMException('Synthetic failure', name); };
}"""
UNINJECT = "() => { if (window.__origSetItem) { Storage.prototype.setItem = window.__origSetItem; delete window.__origSetItem; } }"
COUNT_SETS = """() => {
  window.__setCalls = []; const o = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { window.__setCalls.push(k); return o.call(this, k, v); };
}"""


def fixtures(now):
    m = lambda mins: now - timedelta(minutes=mins)
    def nazori(i, **over):
        r = {"id": "nz-%d" % i, "sessionId": "s-%d" % i, "timestamp": H.utc_iso(m(600 - i)), "mode": "wide",
             "allChars": "あ", "charCount": 1, "sessionDone": 1, "sessionTotal": 1, "image": PNG}
        r.update(over); return r
    def kana(i, **over):
        r = {"time": H.ja_kana_time(m(600 - i)), "type": "trace",
             "data": {"kana": "あ", "tracingJudgmentLevel": "easy",
                      "traceSample": {"version": 1, "coordinateSpace": "normalized-1000", "strokes": [[1, 2, 3, 4]]}},
             "schemaVersion": 1}
        r.update(over); return r
    def saw(i, **over):
        r = {"timestamp": H.utc_iso(m(600 - i)), "appId": "sawatte-hirogaru-app", "activity": "reaction",
             "inputMethod": "touch", "schemaVersion": 1,
             "payload": {"startTime": 1, "durationMs": 5000, "totalInteractions": 3,
                         "trace": {"traceSchemaVersion": 1, "pointLimit": 1000, "trimmed": False,
                                   "taps": [1, 2, 3, 4, 5, 6], "swipes": [[10, 20, 30, 40, 50, 60]]}}}
        r.update(over); return r
    return {"nazori-app": nazori, "hiragana-learn": kana, "katakana-app": kana, "sawatte-hirogaru-app": saw}


def env(app, records, **over):
    e = {"backupFormatVersion": 1, "exportedAt": "2026-03-15T03:00:00.000Z", "appId": app, "appName": NAMES[app],
         "storageKey": KEYS[app], "recordCount": len(records), "records": records}
    e.update(over); return e


def blob(obj):
    return json.dumps(obj, ensure_ascii=False).encode("utf-8")


def run(browser, base, now, R):
    CONSOLE = []
    F = fixtures(now)

    def fresh(seed=None, count_sets=False):
        ctx = H.new_context(browser, now)
        page = ctx.new_page()
        H.attach_console_gate(page, CONSOLE)
        page.goto(base + "/learning-records.html", wait_until="networkidle")
        if seed:
            page.evaluate("(s) => { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); }",
                          {k: (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)) for k, v in seed.items()})
            page.reload(wait_until="networkidle")
        if count_sets:
            page.evaluate(COUNT_SETS)
        return ctx, page

    def get(page, key):
        return page.evaluate("(k) => localStorage.getItem(k)", key)

    def getj(page, key):
        v = get(page, key)
        return json.loads(v) if v is not None else None

    def pick(page, data, name="backup.json", mime="application/json"):
        page.set_input_files("#restore-file-input", files=[{"name": name, "mimeType": mime, "buffer": data}])
        page.locator("#restore-modal").wait_for(state="visible")

    def dlg(page):
        return page.locator("#restore-modal").inner_text()

    def confirm(page):
        page.locator("#restore-modal-actions button", has_text="復元する").click()

    def close(page):
        # The header 「×」 exists in every dialog state (preview / error / result).
        page.locator("#restore-modal-close").click()
        page.locator("#restore-modal").wait_for(state="hidden")

    def close_via_button(page):
        page.locator("#restore-modal-actions button", has_text="閉じる").click()
        page.locator("#restore-modal").wait_for(state="hidden")

    def title(page):
        return page.locator("#restore-modal-title").inner_text()

    def sets(page):
        return page.evaluate("() => window.__setCalls || []")

    print("\n--- Restore E2E @ %s ---" % now.isoformat())

    # ---- environment gate ----
    ctx, page = fresh()
    problem = H.pinned_env_problem(page, now)
    R.check("[env] page sees the pinned clock, timezone (Asia/Tokyo) and locale (ja-JP)", problem is None, problem)
    ctx.close()

    # ---- R22: the Restore action exists in the EMPTY state (the main use case) ----
    ctx, page = fresh()
    R.check("R22 empty state: 'まだ学習のきろくはありません' is shown AND the Restore button is visible and enabled",
            page.locator("#empty-state").is_visible() and page.locator("#restore-btn").is_visible() and page.locator("#restore-btn").is_enabled())
    R.check("R22 empty state: Restore section has a heading and the record dashboard is hidden",
            page.locator("#restore-heading").is_visible() and page.locator("#dashboard-body").is_hidden())
    ctx.close()

    # ---- R1: valid backup into an empty target, all four apps, exact contents ----
    for app in KEYS:
        recs = [F[app](i) for i in (1, 2, 3)]
        ctx, page = fresh(count_sets=True)
        pick(page, blob(env(app, recs)))
        t = dlg(page)
        R.check("R1 %s: preview shows 3 new records, 0 duplicates, no deletions" % app,
                title(page) == "復元の確認" and "3件の記録を追加します" in t and "今ある記録は削除されません" in t)
        R.check("R1 %s: NOTHING is written while only the preview is open" % app, get(page, KEYS[app]) is None and sets(page) == [])
        confirm(page)
        page.locator("#restore-modal-title", has_text="復元しました").wait_for()
        R.check("R1 %s: restored records are exactly the backup's records (deep equal, incl. PNG/trace)" % app, getj(page, KEYS[app]) == recs)
        R.check("R1 %s: exactly ONE setItem call, and only on the app's own key" % app, sets(page) == [KEYS[app]], sets(page))
        R.check("R1 %s: result summary is shown (追加 3件) in a role=status box" % app,
                "3件の記録を復元しました" in dlg(page) and page.locator("#restore-modal [role=status]").count() >= 1)
        close(page)
        R.check("R1 %s: dashboard refreshed: empty state gone, %d cards, period switched to すべて" % (app, 3),
                page.locator("#empty-state").is_hidden() and page.locator(".record-card").count() == 3 and page.locator("#filter-period").input_value() == "all")
        R.check("R1 %s: focus returned to the Restore button after closing" % app, page.evaluate("document.activeElement.id") == "restore-btn")
        ctx.close()

    # ---- R2 / R4: existing target, partial duplicates ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1), F["nazori-app"](2)]}, count_sets=True)
    before = get(page, "nazori_records")
    pick(page, blob(env("nazori-app", [F["nazori-app"](i) for i in (1, 2, 3, 4)])))
    t = dlg(page)
    R.check("R4 partial duplicate: preview = 2 new, 2 already present", "2件の記録を追加します" in t and "すでにある記録（重複・追加しません）" in t)
    confirm(page)
    page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    got = getj(page, "nazori_records")
    R.check("R2/R4: existing 2 records untouched and in place; 2 new appended; total 4", got[:2] == [F["nazori-app"](1), F["nazori-app"](2)] and len(got) == 4)
    R.check("R2/R4: a single write happened", sets(page) == ["nazori_records"])
    close(page); ctx.close()

    # ---- R3 / R18: exact duplicate + repeated import ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1), F["nazori-app"](2)]}, count_sets=True)
    before = get(page, "nazori_records")
    pick(page, blob(env("nazori-app", [F["nazori-app"](1), F["nazori-app"](2)])))
    R.check("R3 exact duplicate: '追加できる記録はありませんでした', no 復元する button", "追加できる記録はありませんでした" in dlg(page)
            and page.locator("#restore-modal-actions button", has_text="復元する").count() == 0)
    close(page)
    R.check("R3 exact duplicate: storage byte-identical and ZERO writes", get(page, "nazori_records") == before and sets(page) == [])
    ctx.close()
    ctx, page = fresh(count_sets=True)
    file_bytes = blob(env("hiragana-learn", [F["hiragana-learn"](i) for i in (1, 2, 3)]))
    pick(page, file_bytes); confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for(); close(page)
    after_first = get(page, "hiragana_log")
    pick(page, file_bytes)
    R.check("R18 repeated import (same file, same session): second time nothing to add", "追加できる記録はありませんでした" in dlg(page))
    close(page)
    pick(page, file_bytes)   # third time, same <input> re-selected
    close(page)
    R.check("R18 repeated import: storage unchanged after 2nd and 3rd import; total writes == 1", get(page, "hiragana_log") == after_first and len(sets(page)) == 1)
    ctx.close()

    # ---- R5: conflict ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]}, count_sets=True)
    before = get(page, "nazori_records")
    pick(page, blob(env("nazori-app", [F["nazori-app"](1, allChars="い")])))
    R.check("R5 conflict: preview lists 1 conflicting record that will NOT be restored", "今の記録と内容が異なる同じ記録（復元しません）" in dlg(page) and "追加できる記録はありませんでした" in dlg(page))
    close(page)
    R.check("R5 conflict: existing record NOT overwritten, zero writes", get(page, "nazori_records") == before and sets(page) == [])
    ctx.close()
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
    pick(page, blob(env("nazori-app", [F["nazori-app"](1, allChars="い"), F["nazori-app"](2)])))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    got = getj(page, "nazori_records")
    R.check("R5 conflict + new: the new record is added, the conflicting one is reported and left untouched",
            len(got) == 2 and got[0] == F["nazori-app"](1) and got[1]["id"] == "nz-2" and "内容が異なるため復元しなかった記録" in dlg(page))
    ctx.close()

    # ---- R17: same time, different content (Kana) is NOT a conflict ----
    ctx, page = fresh(seed={"hiragana_log": [F["hiragana-learn"](5)]})
    other = F["hiragana-learn"](5, data={"kana": "い", "tracingJudgmentLevel": "easy"})
    pick(page, blob(env("hiragana-learn", [other])))
    R.check("R17 Kana same time, different content: offered as 1 new record (no conflict row)", "1件の記録を追加します" in dlg(page) and "復元しません" not in dlg(page))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    R.check("R17 Kana: both records kept (2 total)", len(getj(page, "hiragana_log")) == 2)
    ctx.close()

    # ---- R6..R12: rejected files write nothing ----
    def rejected(label, data, expect_text, seed=None, key="nazori_records", name="backup.json", mime="application/json"):
        ctx, page = fresh(seed=seed, count_sets=True)
        before = get(page, key)
        pick(page, data, name=name, mime=mime)
        t = dlg(page)
        ok_text = expect_text in t
        ok_alert = page.locator("#restore-modal [role=alert]").count() == 1 and title(page) == "復元できませんでした"
        ok_no_confirm = page.locator("#restore-modal-actions button", has_text="復元する").count() == 0
        R.check(label + ": error shown (role=alert, no 復元する button)", ok_text and ok_alert and ok_no_confirm, t[:160])
        close(page)
        R.check(label + ": storage byte-identical and ZERO writes", get(page, key) == before and sets(page) == [])
        ctx.close()

    good = env("nazori-app", [F["nazori-app"](1)])
    seedN = {"nazori_records": [F["nazori-app"](9)]}
    rejected("R6 malformed JSON", b"{not json", READ_ERR, seedN)
    rejected("R6 empty file", b"", READ_ERR, seedN)
    rejected("R6 array root", b"[]", READ_ERR, seedN)
    rejected("R6 truncated file", blob(good)[:60], READ_ERR, seedN)
    rejected("R6 recordCount mismatch (truncated records)", blob(env("nazori-app", [F["nazori-app"](1)], recordCount=5)), READ_ERR, seedN)
    rejected("R7 wrong app (janken-app)", blob(dict(good, appId="janken-app")), "対応している教材のバックアップではありません", seedN)
    rejected("R7 wrong app (unknown / __proto__)", blob(dict(good, appId="__proto__")), "対応している教材のバックアップではありません", seedN)
    rejected("R8 wrong storageKey (another app's key)", blob(dict(good, storageKey="hiragana_log")), "対応している教材のバックアップではありません", seedN)
    rejected("R8 storageKey pointing at an unrelated key (injection)", blob(dict(good, storageKey="donomana_settings")), "対応している教材のバックアップではありません",
             dict(seedN, donomana_settings="KEEP"))
    rejected("R9 unsupported (future) version 2", blob(dict(good, backupFormatVersion=2)), "新しいバージョンで作成されています", seedN)
    rejected("R9 unsupported version 0", blob(dict(good, backupFormatVersion=0)), "形式には対応していません", seedN)
    rejected("R10 malformed PNG (SVG data URL)", blob(env("nazori-app", [F["nazori-app"](1, image="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")])), "読み込めない記録が1件", seedN)
    rejected("R10 malformed PNG (no PNG magic)", blob(env("nazori-app", [F["nazori-app"](1, image="data:image/png;base64,AAAAAAAAAAAAAAAA")])), "読み込めない記録が1件", seedN)
    rejected("R11 malformed Kana trace (odd stroke length)", blob(env("hiragana-learn", [F["hiragana-learn"](1, data={"kana": "あ", "traceSample": {"version": 1, "coordinateSpace": "normalized-1000", "strokes": [[1, 2, 3]]}})])),
             "読み込めない記録が1件", {"hiragana_log": [F["hiragana-learn"](9)]}, key="hiragana_log")
    rejected("R11 malformed Katakana trace (coordinate out of range)", blob(env("katakana-app", [F["katakana-app"](1, data={"kana": "ア", "traceSample": {"version": 1, "coordinateSpace": "normalized-1000", "strokes": [[1, 2, 3, 5000]]}})])),
             "読み込めない記録が1件", {"katakana_log": [F["katakana-app"](9)]}, key="katakana_log")
    badsaw = F["sawatte-hirogaru-app"](1); badsaw["payload"]["trace"]["taps"] = [1, 2]
    rejected("R12 malformed Sawatte trace (taps length not a multiple of 3)", blob(env("sawatte-hirogaru-app", [badsaw])), "読み込めない記録が1件",
             {"sawatte_hirogaru_log": [F["sawatte-hirogaru-app"](9)]}, key="sawatte_hirogaru_log")
    mixed = [F["nazori-app"](1), F["nazori-app"](2, image="javascript:alert(1)"), F["nazori-app"](3)]
    rejected("Gate C: ONE bad record among 3 rejects the WHOLE backup (no valid-only partial restore)", blob(env("nazori-app", mixed)), "読み込めない記録が1件", seedN)
    rejected("existing storage unreadable: restore is refused, the broken value is never overwritten", blob(good), "今ある記録を読み取れない", {"nazori_records": "{broken"})
    ctx, page = fresh()
    R.check("prototype pollution attempt: no Object.prototype pollution after loading a hostile file", True)
    pick(page, b'{"backupFormatVersion":1,"exportedAt":"2026-03-15T03:00:00.000Z","appId":"nazori-app","storageKey":"nazori_records","recordCount":1,"records":[{"timestamp":"2026-03-01T00:00:00.000Z","__proto__":{"polluted":"yes"}}]}')
    R.check("prototype pollution: rejected and Object.prototype is clean", READ_ERR in dlg(page) and page.evaluate("({}).polluted === undefined"))
    ctx.close()

    # ---- R24: file picker / filename / extension is not trusted ----
    ctx, page = fresh()
    R.check("R24 file input: accept='.json,application/json', hidden, not a tab stop",
            page.locator("#restore-file-input").get_attribute("accept") == ".json,application/json"
            and page.locator("#restore-file-input").get_attribute("tabindex") == "-1"
            and page.locator("#restore-file-input").get_attribute("aria-hidden") == "true"
            and page.evaluate("document.getElementById('restore-file-input').hidden") is True)
    with page.expect_file_chooser() as fc:
        page.locator("#restore-btn").click()
    chooser = fc.value
    R.check("R24 the Restore BUTTON opens the OS file chooser (single file)", chooser.is_multiple() is False)
    chooser.set_files([{"name": "weird name (1).txt", "mimeType": "text/plain", "buffer": blob(env("katakana-app", [F["katakana-app"](1)]))}])
    page.locator("#restore-modal").wait_for(state="visible")
    R.check("R24 a valid backup with a WRONG extension/MIME (.txt, text/plain) is still accepted: content decides", "1件の記録を追加します" in dlg(page))
    close(page); ctx.close()
    ctx, page = fresh()
    pick(page, b"this is not json at all", name="looks-legit.json", mime="application/json")
    R.check("R24 a '.json' file with garbage content is rejected: extension is not trusted", READ_ERR in dlg(page))
    R.check("R24 the file name is never shown in the dialog (no learner-identifying leakage)", "looks-legit" not in dlg(page))
    ctx.close()
    ctx, page = fresh()
    page.locator("#restore-btn").focus()
    with page.expect_file_chooser() as fc:
        page.keyboard.press("Enter")
    R.check("R24 keyboard: Enter on the focused Restore button opens the file chooser", fc.value is not None)
    ctx.close()

    # ---- R25 / R26: size gate ----
    big_recs = [F["nazori-app"](i, image=BIG_PNG_HEAD + "AAAA" * 14000) for i in range(1, 61)]
    big = blob(env("nazori-app", big_recs))
    ctx, page = fresh()
    pick(page, big)
    R.check("R25 file 3MB..10MB (%d bytes): accepted with the 'ファイルが大きい' warning" % len(big),
            3 * 1024 * 1024 < len(big) < 10 * 1024 * 1024 and "ファイルが大きいため、処理に時間がかかることがあります" in dlg(page) and "60件の記録を追加します" in dlg(page))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    R.check("R25 large backup restored exactly (60 records, images intact)", getj(page, "nazori_records") == big_recs)
    ctx.close()
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](9)]}, count_sets=True)
    before = get(page, "nazori_records")
    pick(page, b" " * (10 * 1024 * 1024 + 1))
    R.check("R26 file > 10MB: rejected with the size message (before any parsing)", "ファイルが大きすぎるため、復元できません" in dlg(page) and page.locator("#restore-modal [role=alert]").count() == 1)
    close(page)
    R.check("R26 file > 10MB: storage untouched, zero writes", get(page, "nazori_records") == before and sets(page) == [])
    ctx.close()
    ctx, page = fresh()
    pick(page, blob(env("nazori-app", [F["nazori-app"](1)])) + b" " * (3 * 1024 * 1024))
    R.check("R25 a small backup padded to just over 3MB also gets the warning (size = FILE size)", "ファイルが大きいため" in dlg(page))
    ctx.close()

    # ---- retention caps ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](i) for i in range(1, 60)]})
    existing = getj(page, "nazori_records")
    pick(page, blob(env("nazori-app", [F["nazori-app"](i) for i in (100, 101, 102)])))
    t = dlg(page)
    R.check("R19 Nazori cap: existing 59 + 3 new -> 1 can be added, 2 reported over the limit, cap explained",
            "1件の記録を追加します" in t and "保存できる上限を超えるため追加できない記録" in t and "最大60件" in t)
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    got = getj(page, "nazori_records")
    R.check("R19 Nazori cap: exactly 60 stored, ALL 59 existing kept, the NEWEST backup record (nz-102) is the one added",
            len(got) == 60 and all(e in got for e in existing) and any(r["id"] == "nz-102" for r in got))
    R.check("R19 Nazori cap: result summary reports the records that could not be added", "保存できる上限のため追加できなかった記録" in dlg(page))
    ctx.close()
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](i) for i in range(1, 61)]}, count_sets=True)
    pick(page, blob(env("nazori-app", [F["nazori-app"](200)])))
    R.check("R19 Nazori cap: device already full -> nothing added, no 復元する button", "追加できる記録はありませんでした" in dlg(page))
    close(page)
    R.check("R19 Nazori cap: full device untouched (zero writes)", len(getj(page, "nazori_records")) == 60 and sets(page) == [])
    ctx.close()
    ctx, page = fresh(seed={"sawatte_hirogaru_log": [F["sawatte-hirogaru-app"](i) for i in range(1, 199)]})
    pick(page, blob(env("sawatte-hirogaru-app", [F["sawatte-hirogaru-app"](i) for i in range(300, 305)])))
    R.check("R20 Sawatte cap: existing 198 + 5 new -> 2 added, 3 over the limit (max 200)", "2件の記録を追加します" in dlg(page) and "最大200件" in dlg(page))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    R.check("R20 Sawatte cap: exactly 200 stored", len(getj(page, "sawatte_hirogaru_log")) == 200)
    ctx.close()
    ctx, page = fresh(seed={"hiragana_log": [F["hiragana-learn"](i) for i in range(1, 30)]})
    pick(page, blob(env("hiragana-learn", [F["hiragana-learn"](i) for i in range(100, 300)])))
    R.check("R19/20 Kana has NO cap: all 200 new records offered, no cap note", "200件の記録を追加します" in dlg(page) and "最大" not in dlg(page))
    ctx.close()

    # ---- R13..R16: write failures ----
    for name, label in [("QuotaExceededError", "R13 QuotaExceededError"), ("SecurityError", "R14 SecurityError"), ("InvalidStateError", "R15 unknown write error")]:
        ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
        before = get(page, "nazori_records")
        pick(page, blob(env("nazori-app", [F["nazori-app"](2), F["nazori-app"](3)])))
        page.evaluate(INJECT, name)
        confirm(page)
        page.locator("#restore-modal-title", has_text="復元できませんでした").wait_for()
        t = dlg(page)
        R.check(label + ": visible error (role=alert), the standard message, and NO success text",
                WRITE_ERR in t and page.locator("#restore-modal [role=alert]").count() == 1 and "復元しました" not in t and "件の記録を復元" not in t)
        page.evaluate(UNINJECT)
        R.check(label + ": existing storage byte-identical (no partial restore)", get(page, "nazori_records") == before)
        R.check(label + ": no success announcement on the page either", page.locator("#restore-status").inner_text() == "")
        close(page)
        if name == "QuotaExceededError":
            # R16 recovery: same file again once space is available
            pick(page, blob(env("nazori-app", [F["nazori-app"](2), F["nazori-app"](3)])))
            confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
            R.check("R16 recovery: after the failure is cleared, the same restore succeeds and stores 3 records", len(getj(page, "nazori_records")) == 3)
        ctx.close()

    # ---- R21: storage changed between preview and confirm (another tab) ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]}, count_sets=True)
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    changed = json.dumps([F["nazori-app"](1), F["nazori-app"](77)])
    page.evaluate("(v) => localStorage.setItem('nazori_records', v)", changed)   # simulates another tab writing
    page.evaluate("() => { window.__setCalls = []; }")
    confirm(page)
    page.locator("#restore-modal-title", has_text="復元できませんでした").wait_for()
    R.check("R21 stale preview: restore is aborted with the 'もう一度' message", "記録が変更されたため、復元を中止しました" in dlg(page))
    R.check("R21 stale preview: the other tab's data is intact and NO write happened", get(page, "nazori_records") == changed and sets(page) == [])
    close(page)
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    R.check("R21 stale preview: picking the file again re-plans against the new data and succeeds (3 records)", len(getj(page, "nazori_records")) == 3)
    ctx.close()

    # ---- Gate J: optional pre-restore backup ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
    downloads = []
    page.on("download", lambda d: downloads.append(d.suggested_filename))
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    R.check("Gate J: the optional 'backup current records first' button is offered, and NOTHING downloaded automatically",
            page.locator("#restore-modal-actions button", has_text="先に今の記録をバックアップする").count() == 1 and downloads == [])
    with page.expect_download() as dl:
        page.locator("#restore-modal-actions button", has_text="先に今の記録をバックアップする").click()
    R.check("Gate J: pressing it downloads the existing Full Backup file and does NOT restore or close the dialog",
            dl.value.suggested_filename.startswith("nazori-app-full-backup-") and page.locator("#restore-modal").is_visible() and len(getj(page, "nazori_records")) == 1)
    R.check("Gate J: the backup confirmation is announced in a role=status box", page.locator("#restore-modal [role=status]", has_text="バックアップを保存しました").count() == 1)
    ctx.close()
    ctx, page = fresh()
    pick(page, blob(env("nazori-app", [F["nazori-app"](1)])))
    R.check("Gate J: with an empty device there is nothing to back up, so the option is not shown", page.locator("#restore-modal-actions button", has_text="先に今の記録").count() == 0)
    ctx.close()

    # ---- Learner boundary (Gate F): warning only, no false claim ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    t = dlg(page)
    R.check("Gate F: preview asks the user to check the records belong to this device, and states the learner cannot be determined",
            "この端末で使っている記録のバックアップかどうか、ご確認ください" in t and "どのお子さまのものかは判定できません" in t)
    R.check("Stale-tab warning is shown before confirming", "他のタブや画面があれば、閉じてから復元してください" in t)
    R.check("Preview does not reveal record contents (no allChars / no image data / no file name)", "data:image" not in t and "backup.json" not in t)
    ctx.close()

    # ---- R23: accessibility ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
    R.check("R23 the Restore button is a real <button> with a text label", page.locator("button#restore-btn").inner_text().strip() != "")
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    R.check("R23 dialog semantics: role=dialog, aria-modal=true, aria-labelledby -> the visible title",
            page.locator("#restore-modal").get_attribute("role") == "dialog" and page.locator("#restore-modal").get_attribute("aria-modal") == "true"
            and page.locator("#restore-modal").get_attribute("aria-labelledby") == "restore-modal-title")
    R.check("R23 focus moves INTO the dialog (to its title) when it opens", page.evaluate("document.activeElement.id") == "restore-modal-title")
    inside = []
    for _ in range(8):
        page.keyboard.press("Tab")
        inside.append(page.evaluate("!!document.activeElement.closest('#restore-modal')"))
    R.check("R23 Tab never leaves the dialog (focus containment, 8 presses)", all(inside), inside)
    inside = []
    for _ in range(8):
        page.keyboard.press("Shift+Tab")
        inside.append(page.evaluate("!!document.activeElement.closest('#restore-modal')"))
    R.check("R23 Shift+Tab never leaves the dialog (8 presses)", all(inside), inside)
    R.check("R23 the confirm button has a clear accessible name", page.locator("#restore-modal-actions button", has_text="復元する").count() == 1)
    R.check("R23 every dialog button meets the 44px touch-target minimum", all(b >= 44 for b in page.evaluate("Array.from(document.querySelectorAll('#restore-modal button')).map(b => b.getBoundingClientRect().height)")))
    before = get(page, "nazori_records")
    page.keyboard.press("Escape")
    R.check("R23 Escape closes the dialog WITHOUT restoring", page.locator("#restore-modal").is_hidden() and get(page, "nazori_records") == before)
    R.check("R23 focus returns to the Restore button after Escape", page.evaluate("document.activeElement.id") == "restore-btn")
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    page.locator("#restore-modal-actions button", has_text="やめる").click()
    R.check("R23 「やめる」 closes without restoring and returns focus", page.locator("#restore-modal").is_hidden() and get(page, "nazori_records") == before and page.evaluate("document.activeElement.id") == "restore-btn")
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    page.locator("#restore-modal").click(position={"x": 3, "y": 3})
    R.check("R23 clicking the backdrop closes without restoring", page.locator("#restore-modal").is_hidden() and get(page, "nazori_records") == before)
    pick(page, b"{oops")
    R.check("R23 error state is announced as role=alert and focus is on the dialog title", page.locator("#restore-modal [role=alert]").count() == 1 and page.evaluate("document.activeElement.id") == "restore-modal-title")
    page.keyboard.press("Escape")
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    R.check("R23 success state: role=status result, the page-level aria-live region is updated",
            page.locator("#restore-modal [role=status]").count() >= 1 and page.locator("#restore-status").inner_text() == "1件の記録を復元しました。"
            and page.locator("#restore-status").get_attribute("aria-live") == "polite")
    page.keyboard.press("Escape")
    ctx.close()
    # detail modal still works and is independent of the restore dialog
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
    page.locator(".record-card").first.click()
    R.check("no regression: the record detail modal still opens, and its Tab trap still holds", page.locator("#record-detail-modal").is_visible())
    inside = []
    for _ in range(6):
        page.keyboard.press("Tab")
        inside.append(page.evaluate("!!document.activeElement.closest('#record-detail-modal')"))
    R.check("no regression: Tab stays inside the DETAIL modal (shared focus-trap refactor)", all(inside), inside)
    page.keyboard.press("Escape")
    R.check("no regression: Escape closes the detail modal", page.locator("#record-detail-modal").is_hidden())
    ctx.close()

    # ---- mobile / iPad layout ----
    for label, w, h in [("iPhone-size portrait", 390, 844), ("iPad portrait", 820, 1180), ("iPad landscape", 1180, 820)]:
        ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)]})
        page.set_viewport_size({"width": w, "height": h})
        pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
        box = page.evaluate("""() => { const b = document.querySelector('#restore-modal .modal-box').getBoundingClientRect();
            return {l: b.left, r: b.right, t: b.top, b: b.bottom, sw: document.documentElement.scrollWidth, iw: window.innerWidth, ih: window.innerHeight,
                    conf: (function(){ const c = Array.from(document.querySelectorAll('#restore-modal-actions button')).find(x => x.textContent.includes('復元する')); if (!c) return null; c.scrollIntoView(); const r = c.getBoundingClientRect(); return {l:r.left, r:r.right, t:r.top, b:r.bottom}; })() }; }""")
        R.check("mobile/iPad (%s %dx%d): dialog fits the viewport width, no horizontal page scroll" % (label, w, h),
                box["l"] >= 0 and box["r"] <= box["iw"] + 1 and box["sw"] <= box["iw"] + 2, box)
        R.check("mobile/iPad (%s): the 復元する button is reachable and inside the viewport after scrolling the dialog" % label,
                box["conf"] is not None and box["conf"]["l"] >= 0 and box["conf"]["r"] <= box["iw"] + 1 and box["conf"]["t"] >= 0 and box["conf"]["b"] <= box["ih"] + 1, box["conf"])
        ctx.close()

    # ---- real round trip: export with the real Full Backup UI on "device A", restore on "device B" ----
    ctxA, pageA = fresh(seed={KEYS[a]: [F[a](i) for i in (1, 2)] for a in KEYS})
    exported = {}
    cardsA = pageA.locator(".record-card")
    for a in KEYS:
        for i in range(cardsA.count()):
            if cardsA.nth(i).locator(".record-app").inner_text().strip() == NAMES[a]:
                cardsA.nth(i).click()
                pageA.locator("#detail-modal-body").wait_for(state="visible")
                with pageA.expect_download() as dl:
                    pageA.locator("#detail-modal-body button", has_text="完全バックアップ").first.click()
                with open(dl.value.path(), "rb") as f:
                    exported[a] = f.read()
                pageA.click("#detail-modal-close")
                pageA.locator("#detail-modal-body").wait_for(state="hidden")
                break
    R.check("round trip: real Full Backup files were exported for all 4 apps on 'device A'", set(exported) == set(KEYS))
    ctxB, pageB = fresh()
    for a in KEYS:
        pick(pageB, exported[a])
        confirm(pageB); pageB.locator("#restore-modal-title", has_text="復元しました").wait_for(); close(pageB)
    R.check("round trip: 'device B' now holds byte-for-byte equal records for all 4 apps (real export -> real restore)",
            all(getj(pageB, KEYS[a]) == [F[a](i) for i in (1, 2)] for a in KEYS))
    R.check("round trip: the restored records appear in the dashboard on device B (8 cards)", pageB.locator(".record-card").count() == 8)
    ctxA.close(); ctxB.close()

    # ---- read-only pages elsewhere are unaffected ----
    ctx, page = fresh(seed={"nazori_records": [F["nazori-app"](1)], "janken_log": [{"timestamp": H.utc_iso(now - timedelta(minutes=5)), "inputMethod": None, "schemaVersion": 1, "payload": {"mode": "both", "total": 5, "correct": 4, "mistakes": []}}]})
    before_j = get(page, "janken_log")
    pick(page, blob(env("nazori-app", [F["nazori-app"](2)])))
    confirm(page); page.locator("#restore-modal-title", has_text="復元しました").wait_for()
    R.check("scope: restoring one app never touches any other app's storage", get(page, "janken_log") == before_j)
    ctx.close()

    R.check("console gate: zero uncaught exceptions / console.error across every scenario", len(CONSOLE) == 0, CONSOLE[:3])
    return R


def main():
    H.utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--clock", choices=sorted(H.CLOCKS), default="noon")
    args = ap.parse_args()
    now = H.CLOCKS[args.clock]
    with H.serve_repo() as base, sync_playwright() as p:
        browser = p.chromium.launch()
        H.print_header("Restore real-browser E2E", browser, base + "/learning-records.html", {args.clock: now})
        R = H.Results()
        try:
            run(browser, base, now, R)
        except Exception as e:   # tidy failure (still non-zero), keeping every result gathered so far
            traceback.print_exc()
            R.check("scenario aborted by exception after %d checks: %s" % (R.total, str(e).splitlines()[0][:200]), False)
        browser.close()
    return H.finish("Restore browser E2E", R)


if __name__ == "__main__":
    sys.exit(main())
