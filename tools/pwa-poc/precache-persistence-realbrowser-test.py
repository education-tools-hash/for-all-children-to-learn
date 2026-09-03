#!/usr/bin/env python
"""Phase T9-C4 — Precache survival across browser close / force-quit-equivalent.

Covers dedicated-test items 7-8 from the T9-C4 brief, which cannot be proven
in a Node VM sandbox (tools/pwa-poc/precache-contract-tests.js covers 1-6 and
9-14 there):

  7. precache asset survives a browser/context close immediately after install
  8. precache asset survives relaunching the SAME on-disk profile afterwards
     (the closest Playwright equivalent to "force-quit the Home Screen app,
     then reopen it")

Uses a REAL on-disk Chromium profile (launch_persistent_context), not an
in-memory context, because CacheStorage/SW registration must survive a full
browser-process close to prove anything about "app relaunch" -- an in-memory
context is destroyed entirely on close and proves nothing.

This directly reuses the technique validated during the T9-C''' root-cause
investigation (tools/pwa-poc's sibling scratchpad race-reproduction script),
where the SAME technique demonstrated that a zero-settle-time hard-close
COULD lose an in-flight runtime cache.put(). The test here checks the
opposite and more relevant claim for T9-C4: once navigator.serviceWorker.ready
resolves (which cannot happen until the install handler's atomic
Promise.all() over REQUIRED_PRECACHE_URLS has already settled -- activate
cannot begin otherwise), the precached data is already durably committed to
CacheStorage (a disk-backed store), so even an IMMEDIATE close right after
`ready` cannot lose it -- unlike a runtime navigation cache-write, which is
still in flight at the moment of an interruption.

Honesty note: context.close() in Playwright is a graceful browser-process
shutdown, not a literal SIGKILL/force-quit. It is the closest thing available
without reaching into OS-level process control from Python, and is used with
ZERO settle time after the install signal specifically to remove any grace
period that might paper over a real gap. Combined with the reasoning above
(CacheStorage writes from a settled install are already durably committed,
not in-flight), this is treated as sufficient evidence for item 8, but is
flagged here as a limitation rather than an unqualified proof of iOS-style
force-quit resilience specifically.

Usage:
    python tools/pwa-poc/precache-persistence-realbrowser-test.py
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = HERE.parent.parent
PORT = 8794
BASE_URL = f"http://127.0.0.1:{PORT}"
# Deliberately OUTSIDE the repo (a real Chrome profile directory, not
# something that belongs in version control even transiently).
PROFILE_DIR = pathlib.Path(tempfile.gettempdir()) / "donomana_t9c4_persistence_profile"

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


def main():
    if PROFILE_DIR.exists():
        shutil.rmtree(PROFILE_DIR, ignore_errors=True)

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1.0)

    try:
        print("=== 7/8. Install once, close immediately (zero settle), relaunch same profile, verify offline ===")
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=True)
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto(f"{BASE_URL}/")
            # Deterministic: resolves only once the SW has reached 'activated',
            # which requires install's atomic required-precache Promise.all to
            # have already settled. No fixed sleep, no extra grace period.
            page.evaluate("async () => { await navigator.serviceWorker.ready; }")
            check("install completed (navigator.serviceWorker.ready resolved)", True)
            ctx.close()  # immediate close, zero settle time beyond the 'ready' signal itself
            check("7. context closed immediately after install signal (no extra settle time)", True)

        # Fresh process, same on-disk profile: models relaunching the Home
        # Screen app after it was fully closed.
        with sync_playwright() as p:
            ctx2 = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=True)
            page2 = ctx2.pages[0] if ctx2.pages else ctx2.new_page()
            ctx2.set_offline(True)

            for path in ["/", "/learning-records.html", "/janken-app.html", "/tokei-app.html"]:
                try:
                    resp = page2.goto(f"{BASE_URL}{path}", timeout=10000)
                    status = resp.status if resp else None
                except Exception as e:
                    status = f"EXC: {e}"
                body = page2.locator("body").inner_text() if status == 200 else ""
                ok = status == 200 and "インターネットに接続できません" not in body
                check(f"8. {path}: precached asset survived close+relaunch, opens offline with ZERO prior visits to this page", ok, status)

            js_statuses = page2.evaluate(
                """() => Promise.all([
                     fetch('/assets/js/pwa-register.js').then(r => r.status).catch(() => 'NETWORK_ERROR'),
                     fetch('/assets/js/record-dashboard-foundation.js').then(r => r.status).catch(() => 'NETWORK_ERROR'),
                     fetch('/assets/js/record-dashboard-ui.js').then(r => r.status).catch(() => 'NETWORK_ERROR')
                   ])"""
            )
            check("8. required JS (pwa-register + both dashboard files) survived close+relaunch, resolve offline",
                  js_statuses == [200, 200, 200], js_statuses)

            cache_dump = page2.evaluate(
                """async () => {
                     const names = await caches.keys();
                     const out = {};
                     for (const n of names) { const c = await caches.open(n); out[n] = (await c.keys()).map(r => r.url); }
                     return out;
                   }"""
            )
            shell_entries = cache_dump.get("donomana-shell-v1", [])
            check("8. all 9 Pilot precache URLs present in donomana-shell-v1 after close+relaunch",
                  len(shell_entries) == 9, {"count": len(shell_entries), "entries": shell_entries})

            ctx2.set_offline(False)
            ctx2.close()
    finally:
        server.terminate()
        server.wait(timeout=5)
        if PROFILE_DIR.exists():
            shutil.rmtree(PROFILE_DIR, ignore_errors=True)

    print(f"\n{PASS}/{PASS + FAIL} checks passed.")
    if FAIL > 0:
        print("FAILURES PRESENT.")
        sys.exit(1)
    print("ALL PASS.")


if __name__ == "__main__":
    main()
