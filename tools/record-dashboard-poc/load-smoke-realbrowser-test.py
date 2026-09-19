#!/usr/bin/env python
"""Static/load smoke across the 22 Record Foundation apps (Phase
LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1).

Repo-owned port of the scratchpad `save_safety_smoke_all22.py`. The count 44
is 22 apps x 2 checks, unchanged from the Save Safety release gate:
  1. the page loads with zero uncaught exceptions / console.error;
  2. all 7 Save Safety helper functions exist as globals
     (donomanaRecordWriteLog / AddLog / ReadLog / ClearLog / LastSaveResult /
      NotifySaveFailure / ClassifySaveError).

Deterministic environment: frozen clock, pinned timezone/locale, in-process
server on a free port (see browser_test_helpers.py).

Usage:  python tools/record-dashboard-poc/load-smoke-realbrowser-test.py [--clock noon|after-midnight]
"""
import argparse
import sys

from playwright.sync_api import sync_playwright

# Never write __pycache__ into the repo (no .gitignore here, and CI runs git add -A on main).
sys.dont_write_bytecode = True
import browser_test_helpers as H

APPS = [
    "janken-app.html", "register-app.html", "tokei-app.html", "matching-app.html", "shiritori2.html",
    "directions-app.html", "mitsukete-touch-app.html", "junban-miyou-app.html", "kurabeyou-app.html",
    "katachi-awase-app.html", "dotchiga-ii-app.html", "miru-hirogaru-app.html", "okane-app.html",
    "sst-app.html", "mogura-tataki.html", "nazori-app.html", "bosai-app.html", "sawatte-hirogaru-app.html",
    "kyou-no-kiroku.html", "suji-manabou.html", "hiragana-learn.html", "katakana-app.html",
]

HELPERS_PRESENT = """() => (
    typeof donomanaRecordWriteLog === 'function' &&
    typeof donomanaRecordAddLog === 'function' &&
    typeof donomanaRecordReadLog === 'function' &&
    typeof donomanaRecordClearLog === 'function' &&
    typeof donomanaRecordLastSaveResult === 'function' &&
    typeof donomanaRecordNotifySaveFailure === 'function' &&
    typeof donomanaRecordClassifySaveError === 'function'
)"""


def main():
    H.utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--clock", choices=sorted(H.CLOCKS), default="noon")
    args = ap.parse_args()
    now = H.CLOCKS[args.clock]
    R = H.Results()
    env_problem = None
    with H.serve_repo() as base, sync_playwright() as p:
        browser = p.chromium.launch()
        H.print_header("Load smoke (22 Record Foundation apps)", browser, base + "/<app>.html", {args.clock: now})
        for app in APPS:
            ctx = H.new_context(browser, now)
            page = ctx.new_page()
            errs = []
            H.attach_console_gate(page, errs)
            page.goto("%s/%s" % (base, app), wait_until="networkidle")
            funcs_ok = page.evaluate(HELPERS_PRESENT)
            if env_problem is None:
                env_problem = H.pinned_env_problem(page, now)  # ENV GATE (not one of the 44 counted checks)
            R.check("%s: loads with zero console/page errors" % app, len(errs) == 0, errs[:3])
            R.check("%s: all save-safety helper functions present" % app, funcs_ok)
            ctx.close()
        browser.close()
    print("ENV GATE: %s" % ("pinned (tz/locale/clock as expected)" if not env_problem else "FAILED"))
    return H.finish("Load-smoke browser E2E (22 apps)", R, ("ENV GATE: " + env_problem) if env_problem else None)


if __name__ == "__main__":
    sys.exit(main())
