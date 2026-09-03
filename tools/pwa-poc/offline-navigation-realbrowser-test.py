#!/usr/bin/env python
"""Phase T9-C6 — Offline Navigation Contract: real click-through regression.

This is the test that would have caught the iPad Gate A failure that
motivated T9-C6: readiness showed "準備完了" (offline ready), yet clicking
into janken/tokei from Top failed offline because their real navigation
path (Top -> /app-details/{app}-detail.html -> /{app}.html) has a middle
hop that earlier tests never exercised.

tools/pwa-poc/readiness-realbrowser-test.py's G/H tests (T9-C5) only proved
that page.goto() straight to each of the 4 Pilot URLs succeeds offline --
that is NOT the same claim as "a user can get there by clicking through the
site's actual UI," and silently assumed they were equivalent. This file
tests the real click path instead: from Top, click the actual <a> elements
a user would click (the app card, then the detail page's launch button),
never using page.goto() to jump directly to janken-app.html/tokei-app.html
themselves.

Scenario (mirrors the T9-C6 brief's revised Gate A):
  1. clean origin, fresh persistent profile
  2. visit ONLY Top
  3. wait for the readiness banner's real "準備完了" signal (no fixed wait)
  4. close the browser/context (app-close equivalent)
  5. relaunch the SAME profile, network offline
  6. cold navigate to Top
  7. click through Top's real UI to each Pilot destination:
       Top -> app card -> detail page -> "アプリをひらく" launch button -> app
     (learning-records.html is linked directly from Top, no detail hop)
  8. every hop must succeed (no browser-native "not connected" error, no
     donomana offline.html fallback)

Usage:
    python tools/pwa-poc/offline-navigation-realbrowser-test.py
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
PORT = 8798
BASE_URL = f"http://127.0.0.1:{PORT}"
PROFILE_DIR = pathlib.Path(tempfile.gettempdir()) / "donomana_t9c6_navigation_profile"

PASS = 0
FAIL = 0

# Same standalone-mode shim as readiness-realbrowser-test.py -- required so
# pwa-register.js's isStandalone() gate (and thus the readiness banner) is
# actually exercised in a Playwright-controlled Chromium window, which is
# never itself display-mode:standalone.
STANDALONE_INIT_SCRIPT = """
    const origMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = function(query) {
      if (query.indexOf('display-mode') !== -1 && query.indexOf('standalone') !== -1) {
        return { matches: true, media: query, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} };
      }
      return origMatchMedia(query);
    };
"""


def check(label, condition, detail=None):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [OK  ] {label}" + (f" — {detail}" if detail is not None else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {label}" + (f" — {detail}" if detail is not None else ""))


def assert_real_page(page, label):
    """A successful, real donomana page load: not the browser's own native
    connection-error interstitial (chrome-error://chromewebdata/ -- this is
    exactly what a click-through navigation lands on when the SW never
    intercepts it at all, e.g. the original T9-C6 bug: Chromium shows its
    OWN offline page, not our donomana offline.html, and body text is near-
    empty so a text-only check silently passes it) and not our own
    donomana offline.html fallback."""
    is_browser_native_error = page.url.startswith("chrome-error:")
    body = page.locator("body").inner_text() if not is_browser_native_error else ""
    is_offline_fallback = "インターネットに接続できません" in body
    ok = not is_browser_native_error and not is_offline_fallback
    check(f"{label}: navigation succeeded (not a browser network error, not offline.html fallback)",
          ok, {"url": page.url, "browser_native_error": is_browser_native_error, "offline_fallback": is_offline_fallback})
    return ok


def main():
    if PROFILE_DIR.exists():
        shutil.rmtree(PROFILE_DIR, ignore_errors=True)

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1.0)

    try:
        print("=== Phase 1: fresh install, visit ONLY Top, wait for real readiness signal, close ===")
        with sync_playwright() as p:
            ctx1 = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=True)
            ctx1.add_init_script(STANDALONE_INIT_SCRIPT)
            page1 = ctx1.pages[0] if ctx1.pages else ctx1.new_page()
            page1.goto(f"{BASE_URL}/")
            page1.wait_for_function(
                "() => { const el = document.getElementById('donomanaPwaReadinessBanner'); return el && el.innerText.includes('準備完了'); }",
                timeout=15000
            )
            check("readiness banner reached '準備完了' having visited ONLY Top (no detail/app pages ever visited)", True)
            ctx1.close()

        print("\n=== Phase 2: relaunch SAME profile, OFFLINE, click through Top's real UI to every Pilot destination ===")
        with sync_playwright() as p:
            ctx2 = p.chromium.launch_persistent_context(str(PROFILE_DIR), headless=True)
            page2 = ctx2.pages[0] if ctx2.pages else ctx2.new_page()
            ctx2.set_offline(True)

            page2.goto(f"{BASE_URL}/")
            top_ok = assert_real_page(page2, "Top (cold offline start)")

            if top_ok:
                # ── learning-records: direct link from Top, no detail hop ──
                link = page2.locator('a[href="learning-records.html"]').first
                check("Top has a direct learning-records.html link", link.count() >= 1)
                if link.count() >= 1:
                    link.click()
                    page2.wait_for_load_state("load")
                    assert_real_page(page2, "learning-records.html (clicked from Top)")
                    page2.go_back()
                    page2.wait_for_load_state("load")

                # ── janken: Top -> app card -> detail page -> launch button -> app ──
                for app_id, detail_href, app_href, label in [
                    ("janken", "app-details/janken-app-detail.html", "../janken-app.html", "janken"),
                    ("tokei", "app-details/tokei-app-detail.html", "../tokei-app.html", "tokei"),
                ]:
                    card = page2.locator(f'a.app-card[href="{detail_href}"]').first
                    check(f"Top has the {label} app card linking to its detail page", card.count() >= 1)
                    if card.count() == 0:
                        continue
                    card.click()
                    page2.wait_for_load_state("load")
                    detail_ok = assert_real_page(page2, f"{label} detail page (clicked from Top's app card)")

                    if detail_ok:
                        launch_btn = page2.locator("a.launch-btn").first
                        check(f"{label} detail page has a launch button to the app itself", launch_btn.count() >= 1)
                        if launch_btn.count() >= 1:
                            launch_btn.click()
                            page2.wait_for_load_state("load")
                            assert_real_page(page2, f"{label}-app.html (clicked from its detail page's launch button)")
                    page2.goto(f"{BASE_URL}/")  # back to Top for the next app
                    page2.wait_for_load_state("load")

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
