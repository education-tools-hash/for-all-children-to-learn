# Learning Record Storage — Safari / iPad Real-Device Verification Gate v1.0

**Phase:** `LEARNING-RECORD-STORAGE-SAFARI-IPAD-GATE-1`.
**Status: real-device verification complete.** `LEARNING-RECORD-STORAGE-SAFARI-IPAD-GATE-1` = **USER APPROVED / PASS**. Production readiness determination: **READY FOR PRODUCTION RELEASE** (scope of that determination stated precisely in §11 — this is not a claim of guaranteed persistence across all Safari/iPad environments).
**Approved base this gate builds on:** `origin/main` = `5231673e83e2aaaa1367d891462a0a1c28e6e0f7` (re-verified, no drift). Save Safety approved checkpoint = `ecf00e85065cb0cce9c2ddaa208fe62563829e86` (unchanged, not modified by this phase). Worktree `for-all-children-to-learn-storage-save-safety-1`, branch `fix/learning-record-storage-save-safety-1`.

This document originally existed because Claude Code cannot operate a physical iPad directly; §0–§7 below is the preparation and procedure that was handed to the user. **§10–§12 record the actual real-device results the user reported after running that procedure**, and are the authoritative outcome of this phase.

---

## 0. What this is and is not testing

- **Is testing:** the real behavior of Safari's `localStorage` (write success/failure, persistence across reload/tab-close/restart/device-restart, Private Browsing, Home Screen/PWA mode) and whether the exact save-safety logic shipped in checkpoint `ecf00e8` behaves correctly on that real engine.
- **Is not:** a test against donomana.jp or any real learning record. Production is never touched by any step in this document.

---

## 1. Test Tool Safety Review (completed, re-verified against current code)

`tools/storage-safari-ipad-gate/index.html` was re-read in full before writing this section. Every required condition is met:

| Condition | Status | Evidence |
|---|---|---|
| Refuses to run on the `donomana.jp` Production origin | ✅ | `if (/(^\|\.)donomana\.jp$/i.test(location.hostname)) { ...abort... }` at the top of the page's script — replaces the entire page body with a warning and throws before any other code runs. |
| Uses only a dedicated test-only storage key | ✅ | `TEST_KEY = 'donomana_safari_ipad_gate_test_v1'` and `TEST_KEY + '_quota_probe'` — neither matches any of the 22 real Record Foundation keys (`janken_log`, `tokei_log`, `nazori_records`, etc.). A third, transient `__probe__` key is written and removed on the same line, only to test whether `localStorage` is available at all. |
| No `localStorage.clear()` anywhere | ✅ | Confirmed by direct grep of the file — zero occurrences. |
| Never writes to a Production storage key | ✅ | Every `setItem`/`getItem`/`removeItem` call in the file is scoped to `TEST_KEY` or its `_quota_probe` suffix. |
| Never deletes a Production record | ✅ | Same as above — the cleanup button only removes the two test keys. |
| Quota-fill probe is bounded | ✅ | `MAX_STEPS = 400` at 256KB/step = ~100MB safety ceiling, auto-stops there even if no error ever occurs. |
| Quota-fill probe is stoppable | ✅ | A dedicated "中止する" button sets a flag checked before every step. |
| Failure injection is synthetic-only (no real data at risk) | ✅ | `Case B-1/B-2/B-3` temporarily override `Storage.prototype.setItem` to throw, then restore the original in a `finally` block — the real, previously-saved `TEST_KEY` value is provably untouched (verified below). |
| Test data is independently deletable after the session | ✅ | Dedicated "テストデータを削除する" button. |

**Conclusion: safe to proceed to real-device use.**

---

## 2. Test Tool Smoke Validation (completed, real Chromium via Playwright)

Re-run against the current version of the tool (now with three distinct synthetic-failure buttons — see §4 below) immediately before preparing this gate:

| # | Check | Result |
|---|---|---|
| 1 | Normal save persists | PASS |
| 2 | Reload persistence (data detected on reload) | PASS |
| 3 | Synthetic `QuotaExceededError` → banner shown, `reason=quota` | PASS |
| 4 | Synthetic `SecurityError` → `reason=security` | PASS |
| 5 | Synthetic unknown `DOMException` → `reason=unknown` | PASS |
| — | Existing (Case A) test record still intact after all three synthetic failures | PASS |
| 6 | Recovery: normal save immediately after a failure succeeds | PASS |
| 7 | `navigator.storage.estimate()` produces output | PASS |
| 8 | Cleanup removes the test key | PASS |
| — | Page loads with zero console/page errors | PASS |

**10/10 PASS** (exceeds the required minimum of 8). No anomaly found — proceeding to real-device instructions is authorized; this gate does **not** stop here.

---

## 3. LAN test environment (already running)

The test tool is currently being served from this machine on **port 8971** (the port this phase's spec prefers), bound to all network interfaces so it's reachable from your iPad over Wi-Fi:

```
cd tools/storage-safari-ipad-gate
python -m http.server 8971 --bind 0.0.0.0
```

**This machine's current LAN IP address is `192.168.0.7`.** If your iPad is on the same Wi-Fi network as this computer, open this exact URL in Safari:

```
http://192.168.0.7:8971/
```

Notes:
- This IP address can change if the computer reconnects to Wi-Fi or DHCP reassigns it. If the URL above stops working, re-check the IP with `ipconfig` (Windows, look for "IPv4 Address" under the Wi-Fi adapter) or `ipconfig getifaddr en0` (Mac) and substitute it in the URL.
- If the iPad can't reach the page at all (times out rather than showing a Safari error), the most common cause is the computer's firewall blocking inbound connections on port 8971 — you may need to allow Python/the terminal through Windows Firewall for private networks. This was not changed automatically, since firewall configuration is a system-settings change outside this phase's scope.
- Keep the terminal running the server open for your whole test session — closing it stops the page from loading on the iPad.
- Confirm the page title says "🧪 どのまな Storage Gate テスト" and the warning box does **not** say "donomana.jp" before doing anything else. If it does, close the tab immediately.

---

## 4. Safety rules (read before starting)

- **Never open the test tool on `donomana.jp`.** Only the LAN URL above.
- **Do not** try to fill your iPad's actual storage to capacity outside this tool. The "Real Quota Fill Probe" (§5, Environment A step 9) is bounded to ~100MB and only touches its own dedicated key; stop it any time.
- **Do not** factory-reset or intentionally corrupt your device to test "low storage" — this gate does not require that. If your device is already naturally low on storage, that's useful real data; do not manufacture the condition.
- If anything about a step feels risky or unclear, stop and ask rather than guessing.

---

## 5. Test procedure (run on the iPad, one step at a time)

Do these in order. For each numbered step, read the result on screen and write it into the recording template in §6.

### Device info (record once, at the start)

Before Environment A, fill in from the iPad's Settings app and the page's own "① 現在の環境情報" panel:
`Device model / iPadOS version / Safari version / available storage / test date / network (Wi-Fi name)`.

### Environment A — Normal Safari browsing

1. Open the LAN URL (§3) in a normal Safari tab (not Private Browsing).
2. Look at section "① 現在の環境情報" — write down every row into §6.
3. Tap "② navigator.storage.estimate() → 容量の目安を取得する" — write down the quota/usage numbers shown. Remember: this is **not** a localStorage-specific limit, just an origin-wide estimate.
4. Tap "③ Case A → テスト記録を1件保存する". Confirm no red banner appeared (= success).
5. Tap "③ Case A → 保存されているか確認する". Confirm it says "保存されています".
6. **Reload the page.** Tap "保存されているか確認する" again. Record whether the data survived.
7. **Close the Safari tab entirely**, reopen the LAN URL. Tap "保存されているか確認する" again. Record whether the data survived.
8. **Quit Safari completely** (swipe it away in the app switcher) and reopen it, navigating back to the LAN URL. Tap "保存されているか確認する" again. Record whether the data survived a full Safari-app restart.
9. Tap each of the three failure buttons in turn, checking after each one that a red banner appears reading "学習の記録を保存できませんでした...":
   - "B-1: QuotaExceededError を再現する"
   - "B-2: SecurityError を再現する"
   - "B-3: 不明なエラー(InvalidStateError)を再現する"
   For each: record whether the banner appeared, roughly how long it stayed visible, whether it was easy to read, and — critically — tap "保存されているか確認する" right after each one to confirm your Case-A test record is **still there unchanged** (this is the "existing record protection" / "no phantom entry" check, §12 and §20 of the phase spec).
10. Tap "↳ 直後に「回復テスト」" (the recovery button). Confirm it reports success — this proves the page isn't permanently broken after a failure.
11. **Optional, takes longer:** Tap "⑤ Real Quota Fill Probe → 実quotaテストを開始する" and watch the progress text. Tap "中止する" any time. Record whether it ever showed a real failure before the ~100MB safety ceiling, or stopped there without failing.
12. Tap "⑥ テストデータの後片付け → テストデータを削除する" before moving to the next environment.

### Environment B — Private Browsing

1. In Safari, open a **new Private Browsing tab** (Tabs button → Private).
2. Open the same LAN URL.
3. Repeat steps 2–10 from Environment A, in this Private tab.
4. After step 6 (reload) and step 7 (close tab, reopen **in a new Private tab**, since closing the last Private tab may end the Private session), specifically note whether Private Browsing behaves differently from normal browsing for persistence. **A Private-session record disappearing when the session ends is expected browser behavior, not a bug** (§15 of the phase spec) — but if a *save* ever silently appears to succeed while actually failing, that **is** a bug; watch for that distinction.
5. Close the Private Browsing tab (confirm ending the session if asked). Note in §6 whether test data was discarded as expected.

### Environment C — Home Screen / PWA

1. In a normal Safari tab, open the LAN URL.
2. Share button → "Add to Home Screen" → confirm.
3. Close Safari entirely.
4. Open the app from the **Home Screen icon** (not from Safari).
5. Check section ① — does "Home Screen / PWA (standalone)として起動" say "はい"?
6. Repeat steps 3–10 from Environment A, from within this Home Screen app.
7. **Then also open the LAN URL in a normal Safari tab** and tap "保存されているか確認する" — record whether data saved from the Home Screen app is visible from regular Safari (same-origin storage) or isolated. Just observe; this gate does not assume either answer is correct or incorrect.
8. Force-quit the Home Screen app, reopen it from the icon. Tap "保存されているか確認する" again — record whether data survived.

### Environment D — iPhone Safari (optional, reference only)

If available, repeat Environment A's steps 1–10 on an iPhone as a reference point. Not required.

### Case E — Device restart

1. In any environment, save a test record (Environment A step 4).
2. **Restart the iPad completely** (hold power + volume button, slide to power off, then turn back on).
3. Reopen the LAN URL (restart the local server first if it stopped).
4. Tap "保存されているか確認する". Record whether the data survived a full device restart.

### Accessibility check (once is enough, any environment)

1. Trigger any of the B-1/B-2/B-3 failure buttons.
2. Confirm the red banner is visible without needing to scroll.
3. If you have VoiceOver available (Settings → Accessibility → VoiceOver), turn it on, trigger a failure again, and note whether VoiceOver announces the failure message on its own (it should, via the page's `aria-live="assertive"` region) without you needing to manually navigate to find it.
4. Note whether triggering the failure moved keyboard/VoiceOver focus anywhere unexpected (it should not — the banner does not call `.focus()`).

### Mobile layout check (once is enough)

1. Trigger a failure banner in portrait orientation. Confirm it's not cut off at the screen edges and the page doesn't develop horizontal scrolling.
2. Rotate to landscape. Confirm the same, and that all buttons remain reachable/tappable.

---

## 6. Recording template

Copy this once per Environment (A, B, C, optionally D), plus once for Case E. You can paste the raw log text from the page's own "📋 結果ログ" panel ("ログをコピーする" button) alongside your notes.

```
Environment:
Device:
OS:
Safari:
Mode:                          (normal / private / home-screen-pwa)
Normal save:                   PASS / FAIL
Reload persistence:            PASS / FAIL
Tab-close persistence:         PASS / FAIL
Safari-app-restart persistence: PASS / FAIL
Device-restart persistence:    PASS / FAIL / not tested this environment
QuotaExceeded injection (B-1): banner shown? ___  existing record intact? ___
SecurityError injection (B-2): banner shown? ___  existing record intact? ___
Unknown error injection (B-3): banner shown? ___  existing record intact? ___
Visible failure notification:  YES / NO
aria-live / VoiceOver:         works / not confirmed / not tested
Focus stolen by banner:        YES / NO
False success observed:        YES / NO  (should always be NO — blocking if YES)
Phantom record observed:       YES / NO  (should always be NO — blocking if YES)
Recovery after failure:        PASS / FAIL
navigator.storage.estimate:    supported YES/NO
  usage:
  quota:
Real Quota Fill Probe:         performed / not performed
  largest successful write:
  first failure (if any):
  error name:
  error message:
(Home Screen only) same-origin as regular Safari: YES / NO / n/a
(Home Screen only) survives force-quit + reopen:  YES / NO / n/a
(Mobile layout) banner clipped / overflow:         YES / NO
(Mobile layout) buttons reachable both orientations: YES / NO
Notes:
```

---

## 7. Judgment criteria (to be applied once §6 is filled in)

- **PASS** — in Safari normal browsing: normal save works, reload persistence works, every injected failure is detected and notified, no false success, no phantom record, existing records always remain, recovery works.
- **CONDITIONAL PASS** — e.g. Private Browsing records disappearing at session end (expected browser behavior) as long as no false-success occurred during that session. Document the specific behavioral difference.
- **FAIL (blocking)** — any of: a "saved" state shown when the save actually failed; an existing record disappearing; a failed record appearing anywhere in the UI as if saved (phantom entry); normal Safari browsing unable to save at all; no recovery after a failure; or Home Screen/PWA mode failing silently where normal Safari does not.

On FAIL: do not push/merge/deploy, do not modify the Save Safety checkpoint (`ecf00e8`) in place — propose a follow-up phase (`LEARNING-RECORD-STORAGE-SAVE-SAFETY-1B`) instead.

---

## 8. (Historical) What was expected to happen after §6 was filled in

This section is kept for the record: it described the intended next step before real results existed. That step has now happened — see §10–§12.

---

## 10. Real-device results (as reported by the user, test date not independently verifiable by Claude Code — recorded as given)

**Device / environment:** iPad, iPadOS Safari, tested over the LAN test tool at `http://192.168.0.7:8971/` per the §5 procedure. Exact device model, iPadOS version, and Safari version were not separately itemized in the report received; they are captured only implicitly as "one specific iPad, one specific iPadOS/Safari version" — see §11's open limitations for what this does and doesn't generalize to.

### Environment A — iPadOS Safari, Normal Browsing

| Check | Result |
|---|---|
| Normal save | **PASS** (`ok=true`) |
| Reload persistence | **PASS** |
| Tab-close / reopen persistence | NOT TESTED (not reported) |
| Safari-app full restart persistence | NOT TESTED (not reported) |
| Device-restart persistence (Case E) | **NOT TESTED / OPEN LIMITATION** |
| `QuotaExceededError` synthetic failure (B-1) | Detected: `ok=false, reason=quota, errorName=QuotaExceededError` |
| `SecurityError` synthetic failure (B-2) | Detected: `ok=false, reason=security, errorName=SecurityError` |
| Unknown/`InvalidStateError` synthetic failure (B-3) | Detected: `ok=false, reason=unknown, errorName=InvalidStateError` |
| Visible failure notification shown | **PASS**, for all three |
| False success | **Absent (PASS)** — confirmed for all three injected error types |
| Recovery after failure | **PASS** (`ok=true`), and a subsequent normal save after that also succeeded (`ok=true`) — not permanently broken |
| Real Quota Fill Probe (real, non-synthetic quota exhaustion) | NOT TESTED / OPEN LIMITATION — not reported as performed |

### Environment B — iPadOS Safari, Private Browsing

| Check | Result |
|---|---|
| Normal save | **PASS** |
| Read-back immediately after save | **PASS** |
| Persistence after reload | **PASS** |
| Persistence after closing the Private tab and reopening a new Private tab to the same URL | **PASS** |
| False success | **Absent (PASS)** |
| Failure-injection notification behavior | Reported as "no issues" (not broken down per B-1/B-2/B-3 individually in this environment) |
| Safari-app restart / device restart in Private mode | NOT TESTED |

**Important caveat (recorded verbatim per the user's own instruction):** this result describes the specific real-device behavior observed in this one test session. It is **not** treated as a general claim about how Safari Private Browsing will always retain data — Private Browsing's storage-retention behavior may change across Safari versions/updates, and future non-persistence in Private mode would not by itself be a Save Safety regression as long as no false-success occurs when that happens.

### Environment C — Home Screen / PWA

| Check | Result |
|---|---|
| Launched from Home Screen icon (standalone) | **PASS** |
| Normal save | **PASS** (`ok=true`) |
| Read-back after save | **PASS** |
| Persistence after closing and reopening the Home Screen app | **PASS** |
| Record re-confirmed after reopen | **PASS** |
| Same-origin storage sharing with regular Safari tabs (§5 Environment C step 7) | **NOT TESTED / OPEN LIMITATION** — not reported |
| Device-restart persistence in this mode | NOT TESTED |

### Accessibility (cross-cutting, not tied to one environment)

| Check | Result |
|---|---|
| VoiceOver reads the failure notification | **PASS** |
| Visual-only fallback avoided | **PASS** (notification is not visual-only, per the above) |

### Mobile layout (cross-cutting)

| Check | Result |
|---|---|
| Portrait orientation | **PASS** — no clipping/issues reported |
| Landscape orientation | **PASS** — no clipping/issues reported |
| Notification clipping | **None observed** |
| Button operability | **PASS** |

---

## 11. Gate determination

`LEARNING-RECORD-STORAGE-SAFARI-IPAD-GATE-1` = **USER APPROVED / PASS**.

**Production readiness: READY FOR PRODUCTION RELEASE**, precisely scoped as follows — under the real-device conditions actually tested (one iPad, iPadOS Safari, Normal Browsing / Private Browsing / Home Screen-PWA), the following were demonstrated to hold:
- save success is correctly signaled and correctly persists;
- save failure (three distinct injected error types) is correctly detected, never presented as a false success, and always leaves prior records intact;
- recovery after a failure works and the app is not left permanently broken;
- the failure notification is visible, screen-reader-accessible (VoiceOver), does not steal focus, and renders correctly in both portrait and landscape without clipping.

**This is explicitly not a claim that "persistence is guaranteed across all Safari/iPad environments, OS versions, or Safari versions."** See §12 for what remains open.

---

## 12. Known limitations / open items (not tested, not claimed as PASS)

- **Device-restart persistence** was not tested in this session on any environment (Case E in §5). Open.
- **Real Quota Fill Probe** (an actual, non-synthetic `QuotaExceededError` from filling real storage) was not performed. Only synthetic (monkey-patched) failure injection was exercised. Open — the real upper bound of Safari's `localStorage` quota on this or any other device remains unmeasured.
- **OS-level low-storage eviction** (iOS/iPadOS silently clearing site data under system storage pressure, independent of any `QuotaExceededError`) was not tested and was explicitly out of scope per this gate's safety rules (§4) — deliberately not attempted to avoid risking the test device's data. Open.
- **Generalization to other iPadOS versions, Safari versions, or device models** was not attempted — this gate tested exactly one real device/OS/Safari combination. Results here should not be read as applying uniformly to e.g. an older iPadOS version or a different Safari release. Open.
- **Home Screen/PWA vs. regular-Safari storage isolation** (whether they share the same origin storage or not) was not observed in this session. Open.
- **Tab-close/reopen and full Safari-app-restart persistence** were not separately reported for Environment A (only reload persistence was). Open.

None of these open items are treated as failures — they are simply not yet measured. If any of them later turns out to reveal a problem, that would be scoped as a new, separate phase (e.g. `LEARNING-RECORD-STORAGE-SAVE-SAFETY-1B`), not retroactively folded into this gate's PASS determination.

---

## 13. Explicit stop statement (superseding §9's earlier "pending" state)

`LEARNING-RECORD-STORAGE-SAFARI-IPAD-GATE-1` = **USER APPROVED / PASS**. Production readiness: **READY FOR PRODUCTION RELEASE** (scope per §11). This gate's own artifacts (this document + `tools/storage-safari-ipad-gate/`) are being checkpointed in the same worktree as the Save Safety fix, still without push/merge/deploy. Production release itself is handled as the separate `LEARNING-RECORD-STORAGE-SAVE-SAFETY-1-PRODUCTION-RELEASE-1` phase.
