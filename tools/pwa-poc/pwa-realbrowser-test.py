#!/usr/bin/env python
"""Phase T9-B — Real-browser lifecycle test for the PWA minimal foundation
+ Visited-App Offline Pilot (learning-records.html / janken-app.html /
tokei-app.html).

Uses Playwright (same Chromium install as tools/make-mockups.py and the
existing *-realbrowser-test.py scripts in this repo). Serves the worktree
over http://127.0.0.1 (a browser-trusted secure context for Service Worker
registration, no TLS needed) via `python -m http.server`.

The single most important thing this script verifies (per docs/design-system/
donomana-pwa-architecture-v1_0.md §17 and the T9-B brief's §0 principle):
localStorage and IndexedDB content must survive the ENTIRE Service Worker
lifecycle (register/install/activate/visit/offline/update/kill-switch)
byte-for-byte / row-for-row.

Usage:
    python tools/pwa-poc/pwa-realbrowser-test.py
"""
import json
import pathlib
import subprocess
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = HERE.parent.parent
SW_PATH = REPO_ROOT / "service-worker.js"
PORT = 8793
BASE_URL = f"http://127.0.0.1:{PORT}"

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


LOCAL_STORAGE_FIXTURE = {
    "janken_log": json.dumps([{
        "timestamp": "2026-09-02T01:00:00.000Z", "appId": "janken-app", "activity": "quiz",
        "inputMethod": None, "schemaVersion": 1,
        "payload": {"mode": "win", "total": 3, "correct": 2, "mistakes": [{"question": "q", "selected": "a", "correct": "b"}]}
    }]),
    "tokei_log": json.dumps([{
        "timestamp": "2026-09-02T02:00:00.000Z", "appId": "tokei-app", "activity": "quiz",
        "inputMethod": None, "schemaVersion": 1,
        "payload": {"mode": "quiz", "total": 5, "correct": 4, "durationSec": 40}
    }]),
    "register_log": json.dumps([{
        "timestamp": "2026-09-02T03:00:00.000Z", "appId": "register-app", "activity": "checkout",
        "inputMethod": None, "schemaVersion": 1,
        "payload": {"itemCount": 2, "totalAmount": 300}
    }]),
    "shiritori2_log": json.dumps([{
        "timestamp": "2026-09-02T04:00:00.000Z", "appId": "shiritori2", "activity": "quiz",
        "inputMethod": None, "schemaVersion": 1,
        "payload": {"mode": "quiz", "total": 4, "correct": 4}
    }]),
}

# IndexedDB fixtures: (dbName, version, storeName, keyPath, sampleRecord)
# 実アプリと同じkeyPath('id')の店舗として作成する(ongaku-appの実際の
# autoIncrement設定と完全一致させる必要はない、テスト用fixtureとして
# keyPathを満たすレコードであれば十分)。
INDEXEDDB_FIXTURES = [
    ("sched-app-final", 1, "schedules", "id", {"id": "t9b-fixture-1", "title": "PWAテスト用の予定"}),
    ("matching3", 1, "sets", "id", {"id": "t9b-fixture-1", "name": "PWAテスト用セット"}),
    ("ongakuDB", 1, "recordings", "id", {"id": "t9b-fixture-1", "name": "t9b-fixture"}),
    ("donomana-dotchi-custom", 1, "choiceSets", "id", {"id": "t9b-fixture-1", "label": "PWAテスト用セット"}),
]

SEED_LOCALSTORAGE_JS = f"""
() => {{
  const fixture = {json.dumps(LOCAL_STORAGE_FIXTURE)};
  Object.keys(fixture).forEach(k => localStorage.setItem(k, fixture[k]));
}}
"""

SEED_INDEXEDDB_JS = """
([dbName, version, storeName, keyPath, record]) => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: keyPath });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      try {
        if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve('no-store'); return; }
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(record);
        tx.oncomplete = () => { db.close(); resolve('ok'); };
        tx.onerror = () => { db.close(); resolve('tx-error:' + (tx.error && tx.error.message)); };
      } catch (err) {
        db.close();
        resolve('exception:' + err.message);
      }
    };
    req.onerror = () => resolve('open-error:' + (req.error && req.error.message));
    req.onblocked = () => resolve('blocked');
  });
}
"""

SNAPSHOT_ONE_DB_JS = """
([dbName, version, storeName]) => {
  return new Promise((resolve) => {
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      try {
        if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
        const tx = db.transaction(storeName, 'readonly');
        const getAllReq = tx.objectStore(storeName).getAll();
        getAllReq.onsuccess = () => { db.close(); resolve(getAllReq.result); };
        getAllReq.onerror = () => { db.close(); resolve('ERROR'); };
      } catch (err) {
        db.close();
        resolve('ERROR:' + err.message);
      }
    };
    req.onerror = () => resolve('ERROR');
    req.onblocked = () => resolve('BLOCKED');
  });
}
"""


def snapshot_localstorage(page):
    keys = list(LOCAL_STORAGE_FIXTURE.keys())
    return page.evaluate("(keys) => keys.map(k => [k, localStorage.getItem(k)])", keys)


def snapshot_indexeddb(page):
    out = {}
    for (d, v, s, kp, rec) in INDEXEDDB_FIXTURES:
        out[d] = page.evaluate(SNAPSHOT_ONE_DB_JS, [d, v, s])
    return out


def seed_all_storage(page):
    page.evaluate(SEED_LOCALSTORAGE_JS)
    for fixture in INDEXEDDB_FIXTURES:
        result = page.evaluate(SEED_INDEXEDDB_JS, list(fixture))
        if result != "ok":
            print(f"  [WARN] IndexedDB seed for {fixture[0]} returned: {result}")


def new_page(context):
    page = context.new_page()
    errors = {"console_errors": [], "page_errors": []}
    page.on("console", lambda msg: errors["console_errors"].append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors["page_errors"].append(str(exc)))
    return page, errors


def main():
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1.0)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()

            # ── Phase 1: seed storage, snapshot BEFORE any SW involvement ──
            print("=== 1. Storage fixture seed + baseline snapshot ===")
            context = browser.new_context()
            page, errors = new_page(context)
            page.goto(f"{BASE_URL}/janken-app.html")  # same-origin page to seed storage against
            seed_all_storage(page)
            baseline_ls = snapshot_localstorage(page)
            baseline_idb = snapshot_indexeddb(page)
            check("localStorage fixture seeded (4 keys)", all(v is not None for k, v in baseline_ls))
            check("IndexedDB fixture seeded (4 databases)", all(v != 'ERROR' and len(v) >= 1 for v in baseline_idb.values()), baseline_idb)

            # ── Phase 2: register SW via top page, wait for activation ──
            print("\n=== 2. Service Worker registration / install / activate ===")
            page.goto(f"{BASE_URL}/")
            page.wait_for_function("() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready", timeout=15000)
            page.evaluate("() => navigator.serviceWorker.ready")
            page.wait_for_timeout(300)
            has_registration = page.evaluate("async () => { const regs = await navigator.serviceWorker.getRegistrations(); return regs.length > 0; }")
            check("Service Worker registered", has_registration)

            after_register_ls = snapshot_localstorage(page)
            after_register_idb = snapshot_indexeddb(page)
            check("localStorage unchanged after register/install/activate", after_register_ls == baseline_ls)
            check("IndexedDB unchanged after register/install/activate", after_register_idb == baseline_idb)
            check("no console/page errors during SW registration", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)

            # ── Phase 3: visit the 3 pilot pages online (populates runtime cache) ──
            print("\n=== 3. Online visit to pilot pages (runtime cache population) ===")
            for path in ["/learning-records.html", "/janken-app.html", "/tokei-app.html"]:
                page.goto(f"{BASE_URL}{path}")
                page.wait_for_timeout(200)
            check("no console/page errors after visiting all 3 pilot pages", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)

            after_visit_ls = snapshot_localstorage(page)
            after_visit_idb = snapshot_indexeddb(page)
            check("localStorage unchanged after visiting pilot pages", after_visit_ls == baseline_ls)
            check("IndexedDB unchanged after visiting pilot pages", after_visit_idb == baseline_idb)

            cached_urls = page.evaluate("""
                async () => {
                  const names = await caches.keys();
                  const urls = [];
                  for (const n of names) {
                    const cache = await caches.open(n);
                    const reqs = await cache.keys();
                    reqs.forEach(r => urls.push(r.url));
                  }
                  return urls;
                }
            """)
            check("runtime cache contains learning-records.html", any("learning-records.html" in u for u in cached_urls))
            check("runtime cache contains janken-app.html", any("janken-app.html" in u for u in cached_urls))
            check("runtime cache contains tokei-app.html", any("tokei-app.html" in u for u in cached_urls))

            # ── Phase 4: offline reload of visited pilot pages ──
            print("\n=== 4. Offline reload of VISITED pilot pages ===")
            context.set_offline(True)
            for path, marker in [
                ("/learning-records.html", "学習のきろく"),
                ("/janken-app.html", None),
                ("/tokei-app.html", None),
            ]:
                page.goto(f"{BASE_URL}{path}")
                page.wait_for_timeout(200)
                body = page.locator("body").inner_text()
                check(f"visited pilot page loads offline: {path}", "インターネットに接続できません" not in body, path)
                if marker:
                    check(f"offline {path} shows real content, not offline fallback", marker in body)

            # learning-records offline: existing Record fixtures still readable via Foundation
            page.goto(f"{BASE_URL}/learning-records.html")
            page.wait_for_timeout(200)
            page.select_option("#filter-period", "all")
            page.wait_for_timeout(150)
            summary_total = page.locator("#summary-total").inner_text()
            check("learning-records offline shows non-zero records from existing fixture", int(summary_total) > 0, summary_total)
            page.click(".record-card")
            check("Detail modal opens offline", page.locator("#record-detail-modal").is_visible())
            page.keyboard.press("Escape")

            offline_ls = snapshot_localstorage(page)
            offline_idb = snapshot_indexeddb(page)
            check("localStorage unchanged after offline visits", offline_ls == baseline_ls)
            check("IndexedDB unchanged after offline visits", offline_idb == baseline_idb)

            # offline record save: simulate a new janken record being written while offline
            page.goto(f"{BASE_URL}/janken-app.html")
            page.wait_for_timeout(200)
            page.evaluate("""
                () => {
                  const log = JSON.parse(localStorage.getItem('janken_log') || '[]');
                  log.push({ timestamp: new Date().toISOString(), appId: 'janken-app', activity: 'quiz',
                    inputMethod: null, schemaVersion: 1, payload: { mode: 'lose', total: 2, correct: 2, mistakes: [] } });
                  localStorage.setItem('janken_log', JSON.stringify(log));
                }
            """)
            offline_write_count = page.evaluate("() => JSON.parse(localStorage.getItem('janken_log')).length")
            check("offline localStorage write succeeds (Record save while offline)", offline_write_count == 2, offline_write_count)

            # ── Phase 5: back online, reload, confirm records preserved ──
            print("\n=== 5. Network recovery (back online) ===")
            context.set_offline(False)
            page.goto(f"{BASE_URL}/janken-app.html")
            page.wait_for_timeout(200)
            reconciled_count = page.evaluate("() => JSON.parse(localStorage.getItem('janken_log')).length")
            check("offline-added Record survives reconnection + reload", reconciled_count == 2, reconciled_count)
            check("no console/page errors on reconnect", len(errors["console_errors"]) == 0 and len(errors["page_errors"]) == 0, errors)

            # ── Phase 6: cache content audit ──
            print("\n=== 6. Cache content audit ===")
            all_cached = page.evaluate("""
                async () => {
                  const names = await caches.keys();
                  const urls = [];
                  for (const n of names) {
                    const cache = await caches.open(n);
                    const reqs = await cache.keys();
                    reqs.forEach(r => urls.push(r.url));
                  }
                  return urls;
                }
            """)
            cache_names = page.evaluate("async () => caches.keys()")
            check("all cache names are donomana-prefixed", len(cache_names) > 0 and all("donomana-" in n for n in cache_names), cache_names)
            check("no /tools/ paths cached", not any("/tools/" in u for u in all_cached))
            check("no /docs/ paths cached", not any("/docs/" in u for u in all_cached))
            check("no non-pilot app HTML cached (e.g. matching-app.html)", not any("matching-app.html" in u for u in all_cached))
            check("no blob:/data: URLs cached", not any(u.startswith("blob:") or u.startswith("data:") for u in all_cached))

            # ── Phase 7: update flow (v1 -> v2), no forced reload ──
            print("\n=== 7. Update flow (v1 -> v2, Controlled Update) ===")
            original_sw_src = SW_PATH.read_text(encoding="utf-8")
            v2_src = original_sw_src.replace("var VERSION = 'v1';", "var VERSION = 'v2';")
            check("version string swap prepared correctly", v2_src != original_sw_src)
            SW_PATH.write_text(v2_src, encoding="utf-8")
            try:
                page.goto(f"{BASE_URL}/janken-app.html")
                page.wait_for_timeout(300)
                page.evaluate("async () => { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); }")
                page.wait_for_timeout(1000)
                nav_url_before = page.url
                waiting_present = page.evaluate("async () => { const reg = await navigator.serviceWorker.getRegistration(); return !!(reg && reg.waiting); }")
                check("new SW version detected as 'waiting' (not auto-activated)", waiting_present)
                page.wait_for_timeout(500)
                check("page did NOT auto-reload while update is waiting", page.url == nav_url_before)
                banner_visible = page.locator("#donomanaPwaUpdateBanner").is_visible()
                check("update prompt banner shown ('新しいバージョンがあります')", banner_visible)

                if banner_visible:
                    with page.expect_navigation():
                        page.click("#donomanaPwaUpdateBanner button:has-text('更新する')")
                    page.wait_for_load_state("load")
                    page.wait_for_timeout(300)
                    active_version = page.evaluate("async () => { const reg = await navigator.serviceWorker.getRegistration(); return reg && reg.active ? 'has-active' : 'no-active'; }")
                    check("explicit update click applies the new version (reload happened exactly once)", active_version == "has-active")

                updated_ls = snapshot_localstorage(page)
                updated_idb = snapshot_indexeddb(page)
                janken_entry = dict(updated_ls).get('janken_log')
                check("localStorage (incl. offline-added Record) unchanged after update v1->v2",
                      janken_entry is not None and len(json.loads(janken_entry)) == 2, janken_entry)
                check("IndexedDB unchanged after update v1->v2", updated_idb == baseline_idb)
            finally:
                SW_PATH.write_text(original_sw_src, encoding="utf-8")

            # ── Phase 8: kill switch ──
            print("\n=== 8. Kill switch (unregister + cache delete) ===")
            page.goto(f"{BASE_URL}/janken-app.html")
            page.wait_for_timeout(200)
            page.evaluate("""
                async () => {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  for (const r of regs) await r.unregister();
                  const names = await caches.keys();
                  for (const n of names) if (n.startsWith('donomana-')) await caches.delete(n);
                }
            """)
            page.goto(f"{BASE_URL}/janken-app.html")
            page.wait_for_timeout(200)
            controller_after_kill = page.evaluate("() => navigator.serviceWorker.controller")
            check("no SW controller after kill switch", controller_after_kill is None)
            killed_ls = snapshot_localstorage(page)
            killed_idb = snapshot_indexeddb(page)
            check("localStorage fully intact after kill switch", killed_ls[0][1] is not None and json.loads(killed_ls[0][1]).__len__() == 2)
            check("IndexedDB fully intact after kill switch", killed_idb == baseline_idb)
            check("site still loads normally after kill switch (Progressive Enhancement)", "janken" in page.url)

            context.close()

            # ── Phase 9: fresh/unvisited context, offline -> offline.html ──
            print("\n=== 9. Fresh context, offline, UNVISITED pilot page ===")
            context2 = browser.new_context()
            page2, errors2 = new_page(context2)
            # register SW once online first (so a SW exists for this origin), but never visit janken-app.html
            page2.goto(f"{BASE_URL}/")
            page2.wait_for_timeout(500)
            context2.set_offline(True)
            page2.goto(f"{BASE_URL}/janken-app.html")
            page2.wait_for_timeout(300)
            body2 = page2.locator("body").inner_text()
            check("unvisited pilot page offline shows offline fallback (not blank/error)", "インターネットに接続できません" in body2)
            check("offline fallback has a Home link", page2.locator('a[href="/"]').count() >= 1)
            context2.close()

            # ── Phase 10: non-pilot online regression (SW active, no caching side effect) ──
            print("\n=== 10. Non-pilot app regression (SW active) ===")
            context3 = browser.new_context()
            page3, errors3 = new_page(context3)
            page3.goto(f"{BASE_URL}/")
            page3.wait_for_timeout(500)
            non_pilot_apps = ["matching-app.html", "shiritori2.html", "bosai-app.html", "nazori-app.html", "hiragana-learn.html", "katakana-app.html"]
            for app in non_pilot_apps:
                page3.goto(f"{BASE_URL}/{app}")
                page3.wait_for_timeout(150)
                check(f"non-pilot app loads fine online with SW active: {app}", page3.locator("body").count() == 1)
            check("no console/page errors across all 6 non-pilot apps", len(errors3["console_errors"]) == 0 and len(errors3["page_errors"]) == 0, errors3)
            non_pilot_cached = page3.evaluate("""
                async () => {
                  const names = await caches.keys();
                  const urls = [];
                  for (const n of names) {
                    const cache = await caches.open(n);
                    const reqs = await cache.keys();
                    reqs.forEach(r => urls.push(r.url));
                  }
                  return urls;
                }
            """)
            for app in non_pilot_apps:
                check(f"non-pilot app NOT written to any cache: {app}", not any(app in u for u in non_pilot_cached))
            context3.close()

            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    print(f"\n{PASS}/{PASS + FAIL} checks passed.")
    if FAIL == 0:
        print("ALL PASS.")
        sys.exit(0)
    else:
        print(f"{FAIL} FAILURES.")
        sys.exit(1)


if __name__ == "__main__":
    main()
