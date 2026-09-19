#!/usr/bin/env python
"""Dress rehearsal of the Restore Safari/iPad Gate on the PC (Chromium), BEFORE the real device.

Runs the same steps the person will do on the iPad, against the RUNNING gate server
(serve.py), using the exact same download links and files. It cannot replace the device
(Safari, Files picker, PWA, VoiceOver, layout are exactly what the device gate is for), but it
proves that the test files, the hub page and the server behave as the instructions claim.

Usage:  (server running)  python tools/storage-backup-restore-safari-ipad-gate/rehearse-gate.py [http://127.0.0.1:8980]
Nothing is written into the repo. Uses a fresh isolated browser context (synthetic data only).
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

sys.dont_write_bytecode = True
HERE = pathlib.Path(__file__).parent.resolve()
sys.path.insert(0, str(HERE.parent / "record-dashboard-poc"))
import browser_test_helpers as H          # noqa: E402
from playwright.sync_api import sync_playwright   # noqa: E402

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8980").rstrip("/")
HUB = BASE + "/tools/storage-backup-restore-safari-ipad-gate/index.html"
RECORDS = BASE + "/learning-records.html"
R = H.Results()
CONSOLE = []


def http_get(path, method="GET"):
    req = urllib.request.Request(BASE + path, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, dict(r.headers), r.read(200 if method == "GET" else 0)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), b""


def main():
    H.utf8_stdout()
    print("=" * 72 + "\nRestore Gate dress rehearsal (Chromium, PC)  target=%s" % BASE + "\n" + "=" * 72)

    # ---- server safety (allow-list) ----
    for path, want in [("/", 200), ("/tools/storage-backup-restore-safari-ipad-gate/index.html", 200), ("/learning-records.html", 200),
                       ("/assets/js/record-dashboard-foundation.js", 200), ("/gate-files/manifest.json", 200),
                       ("/.git", 404), ("/.git/config", 404), ("/docs/records/learning-record-storage-backup-restore-design-v1_0.md", 404),
                       ("/generate.js", 404), ("/CLAUDE.md", 404), ("/tools/record-dashboard-poc/browser_test_helpers.py", 404),
                       ("/tools/storage-backup-restore-safari-ipad-gate/serve.py", 404), ("/tools/storage-backup-restore-safari-ipad-gate/build-test-backups.js", 404), ("/tools/storage-backup-restore-safari-ipad-gate/rehearse-gate.py", 404),
                       ("/assets/", 404), ("/gate-files/", 404), ("/gate-files/../generate.js", 404), ("/gate-files/x.json", 404),
                       ("/%2e%2e/generate.js", 404), ("/assets/../generate.js", 404), ("/apps-data.json", 404)]:
        status = http_get(path)[0]
        R.check("server: GET %s -> %d" % (path, want), status in (want,) or (want == 404 and status in (403, 404)), status)
    st, hdr, _ = http_get("/gate-files/01-nazori-valid.json")
    R.check("server: test files are served as DOWNLOADS (Content-Disposition: attachment)", st == 200 and "attachment" in hdr.get("Content-Disposition", ""), hdr.get("Content-Disposition"))
    R.check("server: Cache-Control no-store (Safari cannot show a stale copy)", hdr.get("Cache-Control") == "no-store")
    R.check("server: POST is refused", http_get("/", "POST")[0] in (501, 405))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 820, "height": 1180}, has_touch=True, accept_downloads=True)
        page = ctx.new_page()
        H.attach_console_gate(page, CONSOLE)
        page.goto(HUB, wait_until="networkidle")
        R.check("hub: loads, guard not shown, not blocked", page.locator("#guard").is_hidden() and page.locator("#main").is_visible())
        rows = page.locator("#files tr")
        R.check("hub: lists all 11 test files with sizes and expectations", rows.count() == 11 and "10.00 MB" in page.locator("#files").inner_text() and "3.46 MB" in page.locator("#files").inner_text())
        R.check("hub: shows 'gate_injected_key' as NOT written (normal)", "書き込まれていません" in page.locator("#injected").inner_text())

        def fetch_file(name):
            with page.expect_download() as dl:
                page.locator("#files a", has_text=name).click()
            return dl.value.path()

        # ---- A: empty state on the records page ----
        rp = ctx.new_page(); H.attach_console_gate(rp, CONSOLE)
        rp.goto(RECORDS, wait_until="networkidle")
        R.check("A: empty state shown AND 「バックアップから復元」 visible", rp.locator("#empty-state").is_visible() and rp.locator("#restore-btn").is_visible())

        def pick(path):
            rp.set_input_files("#restore-file-input", files=[path])
            rp.locator("#restore-modal").wait_for(state="visible")
        def dlg():
            return rp.locator("#restore-modal").inner_text()
        def close():
            rp.locator("#restore-modal-close").click(); rp.locator("#restore-modal").wait_for(state="hidden")
        def confirm():
            rp.locator("#restore-modal-actions button", has_text="復元する").click()
            rp.locator("#restore-modal-title", has_text="復元しました").wait_for()
        def keys():
            return page.evaluate("Object.fromEntries(['nazori_records','hiragana_log','katakana_log','sawatte_hirogaru_log','gate_injected_key'].map(k => [k, localStorage.getItem(k)]))")
        def counts():
            k = keys(); return {a: (len(json.loads(v)) if v else 0) for a, v in k.items() if a != "gate_injected_key"}

        # ---- S + C: existing record, then Nazori restore (records are 40 days old: Case T) ----
        page.locator("#seedExisting").click()
        R.check("S: 'existing record' seeded (1 Nazori)", counts()["nazori_records"] == 1)
        existing = json.loads(keys()["nazori_records"])
        rp.reload(wait_until="networkidle")
        R.check("S: the existing record shows on the records page", rp.locator(".record-card").count() == 1)
        # Case H when its prerequisite is NOT met (only the seeded record on the device): 06 is "2 new, 0 conflict".
        # That is the CORRECT behaviour (there is no gate-nz-1 to compare with) and is what the iPad showed first.
        page.locator("#refresh").click()
        R.check("prereq panel: with only the seeded record, it says 01 is missing and explains '新規2件' is normal", "✗ 01 の記録が" in page.locator("#prereq").inner_text() and "新規2件・競合0件" in page.locator("#prereq").inner_text())
        pick(fetch_file("06-nazori-conflict.json"))
        R.check("H without prerequisite: preview = 2 new, 0 conflict, final 3 (same numbers the iPad reported; correct for that state)", "2件の記録を追加します" in dlg() and "復元しません" not in dlg() and "復元後の記録の数" in dlg())
        close()
        pick(fetch_file("01-nazori-valid.json"))
        t = dlg()
        R.check("C: preview shows app, 2 new records, date range, size, learner warning", "なぞり書き練習ツール" in t and "2件の記録を追加します" in t and "ファイル内の記録の期間" in t and "復元後の保存サイズの目安" in t and "どのお子さまのものかは判定できません" in t)
        confirm()
        R.check("C: result summary shown; 3 Nazori records total", "2件の記録を復元しました" in dlg() and counts()["nazori_records"] == 3)
        R.check("C: existing record still present, unchanged", existing[0] in json.loads(keys()["nazori_records"]))
        page.locator("#refresh").click()
        R.check("prereq panel: after restoring 01 it turns to ✓ and lists gate-nz-1 / gate-nz-2 / gate-existing-1", "✓ 01 の記録" in page.locator("#prereq").inner_text() and all(i in page.locator("#prereq").inner_text() for i in ("gate-nz-1", "gate-nz-2", "gate-existing-1")))
        close()
        R.check("T: filter switched to 'すべて' and the 40-day-old restored records are visible (3 cards)", rp.locator("#filter-period").input_value() == "all" and rp.locator(".record-card").count() == 3)
        page.locator("#detailBtn").click()
        R.check("C: restored PNGs are intact (2 thumbnails + existing)", page.locator("#detail img.thumb").count() == 3)

        # ---- D E F ----
        for name, key, needle in [("02-hiragana-valid.json", "hiragana_log", "1件の記録を追加します"), ("03-katakana-valid.json", "katakana_log", "1件の記録を追加します"), ("04-sawatte-valid.json", "sawatte_hirogaru_log", "1件の記録を追加します")]:
            pick(fetch_file(name)); ok = needle in dlg(); confirm(); close()
            R.check("%s: preview -> restore -> stored (%s has 1 record)" % (name, key), ok and counts()[key] == 1)
        page.locator("#detailBtn").click(); d = page.locator("#detail").inner_text()
        R.check("D/E: Hiragana/Katakana traceSample preserved (v1, normalized-1000, strokes 2 / 3)", "traceSample v1 normalized-1000 strokes=2本" in d and "strokes=3本" in d)
        R.check("F: Sawatte trace fields preserved (traceSchemaVersion=1 pointLimit=1000 trimmed=false taps/swipes)", "traceSchemaVersion=1 pointLimit=1000 trimmed=false taps=3点 swipes=2本" in d)

        # ---- G duplicate ----
        before = keys()["nazori_records"]
        pick(fetch_file("01-nazori-valid.json"))
        R.check("G: same backup again -> 'nothing to add', 2 duplicates, no 復元する button", "追加できる記録はありませんでした" in dlg() and "すでにある記録（重複・追加しません）" in dlg()
                and rp.locator("#restore-modal-actions button", has_text="復元する").count() == 0)
        close()
        R.check("G: storage byte-identical after the duplicate attempt", keys()["nazori_records"] == before)

        # ---- H conflict ----
        pick(fetch_file("06-nazori-conflict.json"))
        R.check("H: preview: 1 conflict (not restored) + 1 new", "今の記録と内容が異なる同じ記録（復元しません）" in dlg() and "1件の記録を追加します" in dlg())
        gate1 = [r for r in json.loads(before) if r["id"] == "gate-nz-1"][0]
        confirm(); close()
        after = json.loads(keys()["nazori_records"])
        R.check("H: the conflicting existing record is NOT overwritten; only the green-image record was added (4 records)",
                [r for r in after if r["id"] == "gate-nz-1"][0] == gate1 and any(r["id"] == "gate-nz-3" for r in after) and len(after) == 4)

        # ---- I J K L rejects ----
        snap = keys()
        for name, expect in [("07-wrong-app.json", "対応している教材のバックアップではありません"), ("08-wrong-key.json", "対応している教材のバックアップではありません"),
                             ("09-unsupported-version.json", "新しいバージョンで作成されています"), ("10-malformed.json", "バックアップを読み込めませんでした")]:
            pick(fetch_file(name))
            R.check("%s: rejected with the non-technical message (role=alert, no 復元する)" % name, expect in dlg() and rp.locator("#restore-modal [role=alert]").count() == 1 and rp.locator("#restore-modal-actions button", has_text="復元する").count() == 0)
            close()
        R.check("I/J/K/L: after four rejected files storage is byte-identical, and gate_injected_key was never written", keys() == snap and snap["gate_injected_key"] is None)

        # ---- N 10MB reject (before any parse) ----
        pick(fetch_file("12-reject-10mb.json"))
        R.check("N: >10MB -> 'ファイルが大きすぎる' (rejected before parsing), no preview", "ファイルが大きすぎるため、復元できません" in dlg() and title_is(rp, "復元できませんでした"))
        close()
        R.check("N: storage unchanged", keys() == snap)

        # ---- M 3MB warning ----
        import time
        t0 = time.time()
        pick(fetch_file("11-warn-3mb.json"))
        prep = time.time() - t0
        R.check("M: 3.46MB -> preview WITH the 'ファイルが大きい' warning, 40 records offered (%.1fs on the PC)" % prep, "ファイルが大きいため、処理に時間がかかることがあります" in dlg() and "40件の記録を追加します" in dlg())
        t1 = time.time(); confirm(); wtime = time.time() - t1
        R.check("M: restoring the 3.46MB file succeeds (Nazori total 44; %.1fs on the PC)" % wtime, counts()["nazori_records"] == 44)
        close()

        # ---- Q stale preview across two tabs ----
        # (the hub page plays the role of "another tab" writing to the same origin's storage)
        page.evaluate("localStorage.removeItem('hiragana_log')")
        rp.reload(wait_until="networkidle")
        pick(fetch_file("02-hiragana-valid.json"))
        R.check("Q: preview open in tab 1 (Hiragana, 1 new)", "1件の記録を追加します" in dlg())
        page.evaluate("localStorage.setItem('hiragana_log', JSON.stringify([{time:'2026/1/1 00:00',type:'trace',data:{kana:'x'},schemaVersion:1}]))")   # 'another tab' changes storage
        rp.locator("#restore-modal-actions button", has_text="復元する").click()
        rp.locator("#restore-modal-title", has_text="復元できませんでした").wait_for()
        R.check("Q: confirm after the storage changed -> aborted with 'もう一度' message; nothing written", "記録が変更されたため、復元を中止しました" in dlg() and counts()["hiragana_log"] == 1)
        close()

        # ---- reset (4 keys only) ----
        page.once("dialog", lambda d: d.accept())
        page.locator("#resetKeys").click()
        R.check("reset: the 4 gate keys are removed one by one (all 0), nothing else touched", all(v == 0 for v in counts().values()))

        R.check("console gate: zero uncaught exceptions / console.error on hub and records pages", len(CONSOLE) == 0, CONSOLE[:3])
        browser.close()
    return H.finish("Restore Gate dress rehearsal", R)


def title_is(pg, text):
    return pg.locator("#restore-modal-title").inner_text() == text


if __name__ == "__main__":
    sys.exit(main())
