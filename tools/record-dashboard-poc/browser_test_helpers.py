"""Shared helpers for the repo-owned real-browser tests in this directory
(backup-hardening-realbrowser-test.py, save-safety-realbrowser-test.py,
load-smoke-realbrowser-test.py).

Phase LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1.

Why this exists: these suites used to live only in a per-session temp
scratchpad, seeded fixtures from the wall clock ("today 10:00"), depended on an
ad-hoc http.server on a fixed port, and wrote nothing reusable. This module
gives them one deterministic environment:

  * the browser clock is FROZEN (Playwright Clock API) and the browser
    timezone/locale are PINNED, so results do not depend on when, where, or on
    which host timezone/locale the test is run;
  * the site is served by an in-process static server on an OS-assigned free
    port (no fixed port to collide with, no separate process to forget);
  * a run header prints the fixed time/timezone/locale/browser version/target;
  * results are counted in one place and the process exits non-zero on failure.

Not a test framework: only what the three suites actually share. The module
name uses an underscore (not a hyphen like the *-realbrowser-test.py scripts)
because the scripts import it and Python cannot `import` a hyphenated name.
"""
import contextlib
import functools
import http.server
import importlib.metadata
import io
import pathlib
import sys
import threading
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = HERE.parent.parent

# ---- Determinism policy (see docs/records/learning-record-storage-backup-e2e-hardening-v1_0.md) ----
FIXED_TZ = "Asia/Tokyo"      # UTC+09:00, no DST, so JST local time is a fixed offset from UTC
FIXED_LOCALE = "ja-JP"       # the apps write dates via toLocaleDateString('ja-JP')
JST = timezone(timedelta(hours=9))

# Two frozen instants. NOON is far from any day boundary; AFTER_MIDNIGHT is 5
# minutes past a local midnight, so "N minutes ago" fixtures land on the
# previous local day, the boundary that breaks naive date-based fixtures.
CLOCKS = {
    "noon": datetime(2026, 3, 15, 12, 0, tzinfo=JST),
    "after-midnight": datetime(2026, 3, 15, 0, 5, tzinfo=JST),
}


def utc_iso(dt):
    """ISO 8601 UTC with milliseconds, the format `new Date().toISOString()` produces."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)


def ja_kana_time(dt):
    """The `time` string hiragana-learn/katakana-app write: `now()` =
    toLocaleDateString('ja-JP') ('2026/3/15': no zero padding) + ' HH:MM' (padded)."""
    d = dt.astimezone(JST)
    return "%d/%d/%d %02d:%02d" % (d.year, d.month, d.day, d.hour, d.minute)


def backup_filename_stamp(dt):
    """The `YYYYMMDD_HHmm` suffix learning-records.html puts on downloads (local time)."""
    d = dt.astimezone(JST)
    return "%04d%02d%02d_%02d%02d" % (d.year, d.month, d.day, d.hour, d.minute)


# ---- Result counting ----
class Results:
    def __init__(self):
        self.items = []

    def check(self, label, condition, detail=None):
        ok = bool(condition)
        self.items.append((label, ok))
        line = ("[OK  ] " if ok else "[FAIL] ") + label
        if detail is not None and not ok:
            line += " -- " + str(detail)
        print(line)
        return ok

    @property
    def total(self):
        return len(self.items)

    @property
    def passed(self):
        return sum(1 for _, ok in self.items if ok)

    def failures(self):
        return [label for label, ok in self.items if not ok]


def utf8_stdout():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


# ---- In-process static server on a free port ----
class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # keep test output readable
        pass


@contextlib.contextmanager
def serve_repo():
    """Serve REPO_ROOT on 127.0.0.1 at an OS-assigned free port; yield the base URL.

    The app pages use root-relative URLs ('/service-worker.js', '/learning-records.html')
    and register a Service Worker, so they need a real http origin (file:// breaks both).
    127.0.0.1 is a secure context, so the Service Worker registers exactly as in Production."""
    handler = functools.partial(_QuietHandler, directory=str(REPO_ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield "http://127.0.0.1:%d" % server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def new_context(browser, clock_dt, **kwargs):
    """A fresh, isolated context with pinned timezone/locale and a frozen clock.

    set_fixed_time: Date/new Date() return the fixed instant at all times while
    timers keep running (Playwright Clock API; verified on the pinned version below)."""
    ctx = browser.new_context(timezone_id=FIXED_TZ, locale=FIXED_LOCALE, **kwargs)
    ctx.clock.set_fixed_time(clock_dt)
    return ctx


def pinned_env_problem(page, clock_dt):
    """Ask the PAGE (not Python) what timezone/locale/clock it actually sees.
    Returns None when they are exactly the pinned values, else a description.
    This is the direct proof that results cannot depend on the host's timezone/locale."""
    seen = page.evaluate("""() => ({
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        now: new Date().toISOString(),
        offset: new Date(2026, 2, 15, 12, 0).getTimezoneOffset()
    })""")
    want = {"tz": FIXED_TZ, "locale": FIXED_LOCALE, "now": utc_iso(clock_dt), "offset": -540}
    return None if seen == want else "page sees %s, expected %s" % (seen, want)


def attach_console_gate(page, sink):
    """Collect uncaught exceptions and console.error output (ReferenceError/SyntaxError
    surface through one of these). No allowlist: none is needed today."""
    page.on("pageerror", lambda e: sink.append("pageerror: %s" % e))
    page.on("console", lambda m: sink.append("console.error: %s" % m.text) if m.type == "error" else None)


def print_header(title, browser, target, clocks):
    try:
        pw_version = importlib.metadata.version("playwright")
    except Exception:
        pw_version = "unknown"
    print("=" * 72)
    print(title)
    print("  target        : %s" % target)
    print("  fixed clock(s): %s" % "; ".join("%s = %s (%s)" % (k, v.isoformat(), utc_iso(v)) for k, v in clocks.items()))
    print("  timezone      : %s (pinned; host timezone is not used)" % FIXED_TZ)
    print("  locale        : %s (pinned; host locale is not used)" % FIXED_LOCALE)
    print("  browser       : %s %s | playwright %s" % (browser.browser_type.name, browser.version, pw_version))
    print("  python        : %s" % sys.version.split()[0])
    print("=" * 72)


def finish(title, results, extra_failure=None):
    """Print a copy-pasteable summary line and return the process exit code."""
    print()
    status = "PASS" if results.passed == results.total and not extra_failure else "FAIL"
    print("%s: %d/%d %s" % (title, results.passed, results.total, status))
    for label in results.failures():
        print("  - FAILED: " + label)
    if extra_failure:
        print("  - " + extra_failure)
    return 0 if status == "PASS" else 1
