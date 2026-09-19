#!/usr/bin/env python
"""Save Safety real-browser E2E (Phase LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1).

Repo-owned port of two scratchpad suites that gated the Save Safety Production
release: save_safety_e2e.py (34 failure-injection checks) and
save_safety_a11y_mobile_e2e.py (7 accessibility/mobile checks) = 41 checks.
The check logic is carried over unchanged, with these deliberate differences:
  * clock frozen / timezone + locale pinned (browser_test_helpers.py);
  * served from an in-process server on a free port (no fixed port 8899);
  * one fixture literal replaces an in-page wall-clock timestamp (nazori seed);
  * "Case I" of the a11y suite ended in "... or True" (always passed). It now
    asserts what its label says (activeElement is not a stray DIV);
  * uncaught exceptions / console.error on any page fail the run through a
    separate CONSOLE GATE line that is NOT part of the 41 counted checks.

Failure injection is done from the test only (Storage.prototype.setItem is
overridden inside the page and restored afterwards); no test hook exists in
Production code.

Usage:  python tools/record-dashboard-poc/save-safety-realbrowser-test.py [--clock noon|after-midnight]
"""
import argparse
import sys

from playwright.sync_api import sync_playwright

# Never write __pycache__ into the repo (no .gitignore here, and CI runs git add -A on main).
sys.dont_write_bytecode = True
import browser_test_helpers as H

INJECT_QUOTA = """
() => {
  window.__origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v) {
    throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
  };
}
"""
INJECT_SECURITY = """
() => {
  window.__origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v) {
    throw new DOMException('Synthetic security failure', 'SecurityError');
  };
}
"""
INJECT_UNKNOWN = """
() => {
  window.__origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v) {
    throw new DOMException('Synthetic unknown failure', 'InvalidStateError');
  };
}
"""
RESTORE = """
() => { if (window.__origSetItem) { Storage.prototype.setItem = window.__origSetItem; delete window.__origSetItem; } }
"""

R = H.Results()
CONSOLE = []
ENV_PROBLEMS = []
NOW = None  # set in main()


def run(browser, BASE):
    # ENV GATE (not one of the 41 counted checks): the page must see the pinned clock/tz/locale.
    _c = H.new_context(browser, NOW)
    _p = _c.new_page()
    _p.goto(BASE + "/okane-app.html")
    _prob = H.pinned_env_problem(_p, NOW)
    if _prob:
        ENV_PROBLEMS.append(_prob)
    _c.close()
    # ---------------- failure-injection suite (34 checks) ----------------

    # ============================================================
    # okane-app: simple flat record, background save (no explicit success UI)
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/okane-app.html")
    page.evaluate("() => { try { localStorage.removeItem('okane_activity_log'); } catch(e){} }")

    # Case A: normal save succeeds (using the REAL app function, logActivity())
    r = page.evaluate("""() => {
        logActivity('shop', 'test-A');
        return { saveResult: donomanaRecordLastSaveResult(), inMemoryLen: activityLog.length };
    }""")
    R.check("okane Case A: normal save ok=true", r['saveResult'].get('ok') is True)
    stored = page.evaluate("() => JSON.parse(localStorage.getItem('okane_activity_log')||'[]').length")
    R.check("okane Case A: record actually persisted (len=1)", stored == 1)

    # Case B: QuotaExceededError -> failure detected, banner shown, existing record protected
    page.evaluate(INJECT_QUOTA)
    r = page.evaluate("""() => {
        logActivity('shop', 'test-B-should-not-persist');
        return { saveResult: donomanaRecordLastSaveResult(), inMemoryLen: activityLog.length };
    }""")
    R.check("okane Case B: quota failure detected ok=false reason=quota", r['saveResult'].get('ok') is False and r['saveResult'].get('reason') == 'quota')
    R.check("okane Case B/Atomicity: in-memory activityLog reverted, no phantom entry (len still 1)", r['inMemoryLen'] == 1)
    banner_text = page.evaluate("() => { var el = document.getElementById('donomanaRecordSaveFailureBanner'); return el ? el.textContent : null; }")
    R.check("okane Case B: visible error banner shown", bool(banner_text) and '保存できませんでした' in banner_text)
    stored_after_fail = page.evaluate("() => JSON.parse(localStorage.getItem('okane_activity_log')||'[]').length")
    R.check("okane Case E: existing record(s) preserved, not corrupted (still len=1)", stored_after_fail == 1)
    page.evaluate(RESTORE)

    # Case F: recovery after storage normalizes
    r = page.evaluate("""() => {
        logActivity('shop', 'test-F-recovery');
        return donomanaRecordLastSaveResult();
    }""")
    R.check("okane Case F: subsequent save succeeds after recovery", r.get('ok') is True)
    stored2 = page.evaluate("() => JSON.parse(localStorage.getItem('okane_activity_log')||'[]').length")
    R.check("okane Case F: persisted length now 2 (test-A + recovery, phantom test-B entry correctly excluded)", stored2 == 2)

    page.evaluate("() => { try { localStorage.removeItem('okane_activity_log'); } catch(e){} }")
    ctx.close()

    # ============================================================
    # tokei-app: simple record with app-level cap-trim behavior
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/tokei-app.html")
    page.evaluate("() => { try { localStorage.removeItem('tokei_log'); } catch(e){} }")

    page.evaluate(INJECT_SECURITY)
    r = page.evaluate("""() => {
        var entry = donomanaRecordCreate('tokei-app', 'quiz', null, { difficulty:'easy', mode:'read', total:8, correct:6, retried:1, avgTimeSec:3, durationSec:30 });
        var log = donomanaRecordAddLog('tokei_log', entry);
        var res = donomanaRecordLastSaveResult();
        if (log.length > 200) donomanaRecordWriteLog('tokei_log', log.slice(log.length - 200));
        return res;
    }""")
    R.check("tokei Case C: SecurityError detected ok=false reason=security", r.get('ok') is False and r.get('reason') == 'security')
    stored = page.evaluate("() => JSON.parse(localStorage.getItem('tokei_log')||'[]').length")
    R.check("tokei Case C: no phantom record persisted (len=0)", stored == 0)
    page.evaluate(RESTORE)
    ctx.close()

    # ============================================================
    # shiritori2: simple record family
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/shiritori2.html")
    page.evaluate("() => { try { localStorage.removeItem('shiritori2_log'); } catch(e){} }")
    page.evaluate(INJECT_UNKNOWN)
    r = page.evaluate("""() => {
        var entry = donomanaRecordCreate('shiritori2', 'quiz', null, { mode:10, total:10, correct:8, score:90, maxStreak:6, chainLength:8, outcome:'completed', durationSec:45 });
        var log = donomanaRecordAddLog('shiritori2_log', entry);
        return donomanaRecordLastSaveResult();
    }""")
    R.check("shiritori2 Case D: unknown DOMException -> ok=false reason=unknown", r.get('ok') is False and r.get('reason') == 'unknown')
    banner_text = page.evaluate("() => { var el = document.getElementById('donomanaRecordSaveFailureBanner'); return el ? el.textContent : null; }")
    R.check("shiritori2 Case D: generic failure notification shown", bool(banner_text) and '保存できませんでした' in banner_text)
    page.evaluate(RESTORE)
    ctx.close()

    # ============================================================
    # nazori-app: L3 raster image, tests atomicity fix (records var must not include phantom entry)
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/nazori-app.html")
    page.evaluate("() => { try { localStorage.removeItem('nazori_records'); } catch(e){} }")

    # seed one real record directly, then reload records into memory the way the app does
    page.evaluate("""() => {
        records = donomanaRecordAddLog(RECORDS_KEY, { id:'seed1', sessionId:'s1', timestamp:'2026-03-14T00:00:00.000Z', mode:'wide', allChars:'あ', charCount:1, sessionDone:1, sessionTotal:1, image:'data:image/png;base64,AAAA' });
    }""")
    before_len = page.evaluate("() => records.length")
    R.check("nazori Case A: seed record saved (in-memory records len=1)", before_len == 1)

    page.evaluate(INJECT_QUOTA)
    r = page.evaluate("""() => {
        sessionDoneCount = 1; sessionTotalCount = 1; sessionId = 's2'; S.chars = ['い'];
        return logDoneAction('い', 0, 'wide').then(() => ({ok: donomanaRecordLastSaveResult().ok, recordsLen: records.length}));
    }""")
    R.check("nazori Case B: quota failure detected during logDoneAction", r.get('ok') is False)
    R.check("nazori Case E/Atomicity: in-memory records reverted, no phantom entry (len still 1)", r.get('recordsLen') == 1)
    stored_len = page.evaluate("() => JSON.parse(localStorage.getItem('nazori_records')||'[]').length")
    R.check("nazori Case E: persisted storage still has exactly 1 record (seed only)", stored_len == 1)
    page.evaluate(RESTORE)
    ctx.close()

    # ============================================================
    # sawatte-hirogaru-app: L3 timed trace
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/sawatte-hirogaru-app.html")
    page.evaluate("() => { try { localStorage.removeItem('sawatte_hirogaru_log'); } catch(e){} }")
    # startSession/finalizeSession are private to this file's IIFE; drive via real UI clicks.
    page.click("#startBtn")
    page.wait_for_timeout(150)
    page.click("#activitySurface")
    page.wait_for_timeout(150)

    page.evaluate(INJECT_QUOTA)
    page.click("#endBtn")
    page.wait_for_timeout(150)
    r = page.evaluate("() => donomanaRecordLastSaveResult()")
    R.check("sawatte Case B: quota failure detected", r.get('ok') is False and r.get('reason') == 'quota')
    stored = page.evaluate("() => JSON.parse(localStorage.getItem('sawatte_hirogaru_log')||'[]').length")
    R.check("sawatte Case E: no record persisted on failure (len=0)", stored == 0)
    banner_text = page.evaluate("() => { var el = document.getElementById('donomanaRecordSaveFailureBanner'); return el ? el.textContent : null; }")
    R.check("sawatte Case B: visible error banner shown", bool(banner_text) and '保存できませんでした' in banner_text)
    page.evaluate(RESTORE)

    # Case F: recovery (reload to get back to a clean start screen after the summary shown post-endBtn)
    page.reload()
    page.wait_for_timeout(300)
    page.click("#startBtn")
    page.wait_for_timeout(150)
    page.click("#activitySurface")
    page.wait_for_timeout(150)
    page.click("#endBtn")
    page.wait_for_timeout(150)
    r2 = page.evaluate("() => donomanaRecordLastSaveResult()")
    R.check("sawatte Case F: recovery save succeeds", r2.get('ok') is True)
    stored2 = page.evaluate("() => JSON.parse(localStorage.getItem('sawatte_hirogaru_log')||'[]').length")
    R.check("sawatte Case F: exactly 1 record persisted after recovery", stored2 == 1)
    ctx.close()

    # ============================================================
    # hiragana-learn: L3 canvas stroke trace
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/hiragana-learn.html")
    page.evaluate("() => { try { localStorage.removeItem('hiragana_log'); } catch(e){} }")
    # Case A: normal save via the real addLog()
    rA = page.evaluate("""() => {
        var sample = buildTraceSample([[{x:0.1,y:0.1},{x:0.5,y:0.5}]]);
        addLog('trace', { kana: 'あ', tracingJudgmentLevel: 'easy', traceSample: sample });
        return { learningLogLen: learningLog.length };
    }""")
    R.check("hiragana Case A: normal save reflected in-memory (learningLog len=1)", rA['learningLogLen'] == 1)

    page.evaluate(INJECT_QUOTA)
    r = page.evaluate("""() => {
        var sample = buildTraceSample([[{x:0.1,y:0.1},{x:0.5,y:0.5}]]);
        addLog('trace', { kana: 'い', tracingJudgmentLevel: 'easy', traceSample: sample });
        return { saveResult: donomanaRecordLastSaveResult(), learningLogLen: learningLog.length };
    }""")
    R.check("hiragana Case B: quota failure detected", r['saveResult'].get('ok') is False and r['saveResult'].get('reason') == 'quota')
    R.check("hiragana Case B/Atomicity: learningLog reverted, no phantom entry (len still 1)", r['learningLogLen'] == 1)
    stored = page.evaluate("() => JSON.parse(localStorage.getItem('hiragana_log')||'[]').length")
    R.check("hiragana Case E: only the Case-A record persisted (len=1)", stored == 1)
    page.evaluate(RESTORE)
    # Case F recovery
    r2 = page.evaluate("""() => {
        var sample = buildTraceSample([[{x:0.1,y:0.1},{x:0.5,y:0.5}]]);
        addLog('trace', { kana: 'う', tracingJudgmentLevel: 'easy', traceSample: sample });
        return { saveResult: donomanaRecordLastSaveResult(), learningLogLen: learningLog.length };
    }""")
    R.check("hiragana Case F: recovery save succeeds", r2['saveResult'].get('ok') is True)
    R.check("hiragana Case F: learningLog now len=2 (Case-A + recovery)", r2['learningLogLen'] == 2)
    ctx.close()

    # ============================================================
    # kyou-no-kiroku: bespoke nested-object save, highest severity (R4), celebration UI gate
    # ============================================================
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/kyou-no-kiroku.html")
    page.evaluate("() => { try { localStorage.removeItem('kyounokiroku'); } catch(e){} }")
    # minimal state seed: one child, selected
    page.evaluate("""() => {
        state.children = [{ id: 'c1', name: 'テスト太郎' }];
        state.selectedChild = 0;
        state.records = [];
        saveState();
    }""")

    # Case A: normal save succeeds, celebration modal shows
    r = page.evaluate("""() => {
        document.getElementById('inputTemp').value = '36.5';
        saveRecord();
        var modalOpen = !document.getElementById('modalCelebration').hasAttribute('hidden') || document.getElementById('modalCelebration').classList.contains('open');
        return { recordsLen: state.records.length, modalOpen: modalOpen, msg: document.getElementById('celebrationMsg').textContent };
    }""")
    R.check("kyou-no-kiroku Case A: record saved (state.records len=1)", r.get('recordsLen') == 1)
    R.check("kyou-no-kiroku Case A: celebration message shown on success", '保存しました' in (r.get('msg') or ''))
    # close modal if a close mechanism exists, best-effort
    page.evaluate("() => { try { document.getElementById('modalCelebration').classList.remove('open'); document.getElementById('modalCelebration').setAttribute('hidden',''); } catch(e){} }")

    page.evaluate("() => { document.getElementById('celebrationMsg').textContent = ''; }")
    page.evaluate(INJECT_QUOTA)
    r2 = page.evaluate("""() => {
        document.getElementById('inputTemp').value = '37.0';
        saveRecord();
        return { recordsLen: state.records.length, msg: document.getElementById('celebrationMsg').textContent };
    }""")
    R.check("kyou-no-kiroku Case B: save failure detected, no phantom entry (records len still 1)", r2.get('recordsLen') == 1)
    R.check("kyou-no-kiroku Case B/False-success Gate: celebration message NOT shown on failure", r2.get('msg') == '')
    banner_text = page.evaluate("() => { var el = document.getElementById('donomanaRecordSaveFailureBanner'); return el ? el.textContent : null; }")
    R.check("kyou-no-kiroku Case B: visible failure banner shown", bool(banner_text) and '保存できませんでした' in banner_text)
    persisted = page.evaluate("() => { var raw = localStorage.getItem('kyounokiroku'); var obj = raw ? JSON.parse(raw) : null; return obj && obj.records ? obj.records.length : -1; }")
    R.check("kyou-no-kiroku Case E: persisted storage still has exactly 1 record (untouched)", persisted == 1)
    page.evaluate(RESTORE)

    # Case F: recovery
    r3 = page.evaluate("""() => {
        document.getElementById('inputTemp').value = '36.8';
        saveRecord();
        return { recordsLen: state.records.length };
    }""")
    R.check("kyou-no-kiroku Case F: recovery save succeeds (records len=2)", r3.get('recordsLen') == 2)
    page.evaluate("() => { try { localStorage.removeItem('kyounokiroku'); } catch(e){} }")
    ctx.close()


    # ---------------- accessibility / mobile suite (7 checks) ----------------
    ctx = H.new_context(browser, NOW)
    page = ctx.new_page()
    H.attach_console_gate(page, CONSOLE)
    page.goto(f"{BASE}/okane-app.html")
    page.evaluate("() => { try { localStorage.removeItem('okane_activity_log'); } catch(e){} }")

    # Case J: screen reader semantics -- role=alert / aria-live=assertive on the banner,
    # AND the shared donomanaAnnounce assertive region text is updated too.
    page.evaluate("() => { document.getElementById('product-name-input'); }")  # noop touch
    page.evaluate(INJECT_QUOTA)
    page.evaluate("() => { logActivity('shop', 'a11y-test'); }")
    page.wait_for_timeout(150)  # donomanaAnnounce() clears then re-sets text via a 50ms setTimeout

    role = page.evaluate("() => { var el = document.getElementById('donomanaRecordSaveFailureBanner'); return el ? el.getAttribute('role') : null; }")
    R.check("Case J: banner has role=alert", role == 'alert')
    live = page.evaluate("() => { var el = document.getElementById('donomanaRecordSaveFailureBanner'); return el ? el.getAttribute('aria-live') : null; }")
    R.check("Case J: banner has aria-live=assertive", live == 'assertive')
    announce_text = page.evaluate("() => { var el = document.getElementById('donomanaAnnounceAssertive'); return el ? el.textContent : null; }")
    R.check("Case J: shared donomanaAnnounce assertive region also updated", bool(announce_text) and '保存できませんでした' in announce_text)

    # Case I: keyboard flow not broken -- focus was not stolen by the failure banner
    active_tag = page.evaluate("() => document.activeElement ? document.activeElement.tagName : null")
    R.check("Case I: focus not stolen (activeElement is not the failure banner)", active_tag != 'DIV')
    banner_has_focus = page.evaluate("() => document.activeElement && document.activeElement.id === 'donomanaRecordSaveFailureBanner'")
    R.check("Case I: failure banner did not steal focus", banner_has_focus is False)

    page.evaluate(RESTORE)

    # Case H: mobile viewport -- banner does not cause horizontal overflow, remains visible within viewport
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(150)
    page.evaluate(INJECT_QUOTA)
    page.evaluate("() => { logActivity('shop', 'mobile-test'); }")
    page.wait_for_timeout(150)
    overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 2")
    R.check("Case H: no horizontal overflow at 390px width with banner visible", overflow is False)
    banner_visible = page.evaluate("""() => {
        var el = document.getElementById('donomanaRecordSaveFailureBanner');
        if (!el) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth + 2;
    }""")
    R.check("Case H: banner fully within mobile viewport bounds (not cut off)", banner_visible)
    page.evaluate(RESTORE)

    page.evaluate("() => { try { localStorage.removeItem('okane_activity_log'); } catch(e){} }")
    ctx.close()


def main():
    global NOW
    H.utf8_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--clock", choices=sorted(H.CLOCKS), default="noon")
    args = ap.parse_args()
    NOW = H.CLOCKS[args.clock]
    with H.serve_repo() as base, sync_playwright() as p:
        browser = p.chromium.launch()
        H.print_header("Save Safety real-browser E2E", browser, base + "/<app>.html", {args.clock: NOW})
        run(browser, base)
        browser.close()
    gate = None
    if CONSOLE:
        gate = "CONSOLE GATE: %d uncaught exception(s)/console.error(s): %s" % (len(CONSOLE), CONSOLE[:3])
    if ENV_PROBLEMS:
        gate = (gate + " | " if gate else "") + "ENV GATE: " + ENV_PROBLEMS[0]
    print("CONSOLE GATE: %s | ENV GATE: %s" % ("clean" if not CONSOLE else "FAILED", "pinned (tz/locale/clock as expected)" if not ENV_PROBLEMS else "FAILED"))
    return H.finish("Save Safety browser E2E", R, gate)


if __name__ == "__main__":
    sys.exit(main())
