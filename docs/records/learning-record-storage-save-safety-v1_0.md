# Learning Record Storage Save Safety v1.0

**Phase:** `LEARNING-RECORD-STORAGE-SAVE-SAFETY-1` — Investigation + Design + Minimal Safe Implementation + Regression Verification.
**Baseline:** `origin/main` = `5231673e83e2aaaa1367d891462a0a1c28e6e0f7`, unchanged (verified, no drift, at Start Gate).
**Worktree:** `for-all-children-to-learn-storage-save-safety-1`, branch `fix/learning-record-storage-save-safety-1`.
**Prior audit referenced as Source of Truth, re-verified against current code (not trusted blindly):** `docs/records/learning-record-storage-capacity-audit-v1_0.md`, `docs/records/data/learning-record-storage-capacity-measurements-v1_0.json`.

---

## 1. Root Cause

All 22 Record Foundation apps duplicate an identical helper:

```js
function donomanaRecordWriteLog(storageKey, log) {
  try { localStorage.setItem(storageKey, JSON.stringify(log)); } catch (e) {}
}
```

`catch (e) {}` discards the exception with no return value, no re-throw, no logging. Any caller — including the ~10 apps that go through `donomanaRecordAddLog` and the ~12 that call `donomanaRecordWriteLog` directly — has historically had no way to distinguish a successful write from a failed one. Because `localStorage.setItem` is spec-guaranteed atomic per key (a failed call never partially overwrites the previous value), **existing persisted data was never at risk of corruption** — the risk was entirely that a *new* record silently failed to persist while the app behaved as if it had.

A second, related gap found during Root Investigation (not identical to the first, but in the same failure class): several apps push a new entry onto a **persistent, module-level in-memory array** (`activityLog`, `records`, `allRecords`, `learningLog`, `state.logs`, `state.records`) and keep that in-memory copy regardless of whether the subsequent write actually succeeded. Even after fixing the silent catch, an app that did this would still show a phantom, unsaved entry in any same-session count/list/celebration UI that reads that in-memory variable instead of re-reading storage. This is the specific "false success" mechanism called out in the phase's atomicity concern (§17 of the phase spec).

---

## 2. Root Investigation Findings (re-verified from current code, not assumed)

- **22 Record Foundation apps confirmed** (re-enumerated from `assets/js/record-dashboard-foundation.js`, matching the prior audit).
- The `try { setItem } catch (e) {}` body is **byte-for-byte identical in all 22 app HTML files** (confirmed via direct grep + read of the full block in every file, not sampled).
- **The actual "real save" call site is NOT the same shape across apps.** Three distinct patterns exist:
  1. **Direct `donomanaRecordAddLog(key, entry)` call**, return value discarded or used only for a local, function-scoped cap-check (janken, register, matching, shiritori2, tokei — safe by construction, no persistent-variable risk).
  2. **Direct `donomanaRecordAddLog(key, entry)` call, return value reassigned to a persistent module-level variable** used for live count/list/celebration display (nazori — 2 call sites, bosai — 1 call site). **Atomicity risk: real.**
  3. **App-local `push()` onto a persistent array, then a direct `donomanaRecordWriteLog(key, arr)` call** bypassing `donomanaRecordAddLog` entirely (okane, sst-app, hiragana-learn, katakana-app, suji-manabou, directions-app — all confirmed to push onto a persistent variable). **Atomicity risk: real**, confirmed and fixed in this phase for all six.
  4. **App-local `push()` onto a locally-scoped, freshly-read array, discarded after the function returns** (dotchiga-ii-app, kurabeyou-app, katachi-awase-app, sawatte-hirogaru-app, mogura-tataki — safe by construction).
  5. **kyou-no-kiroku**: does not use the shared helpers for its actual record save at all. It has its own bespoke nested-object read/write pair (`donomanaRecordReadNestedCollection`/`donomanaRecordWriteNestedCollection`) plus a separate whole-object `saveState()`, both with their own independent (and, before this phase, equally silent) `try {...} catch (e) {}`. Its `saveRecord()` also showed an unconditional "保存しました" (saved) celebration modal regardless of the write's actual outcome — the one genuine, concrete false-success UI instance found anywhere in the 22 apps.
- **No app has a hard cap at the `donomanaRecordAddLog`/`donomanaRecordWriteLog` layer itself.** Several apps (janken 200, register `REGISTER_RECORD_MAX`, tokei 200, shiritori2 `RECORD_MAX`, matching `RECORD_MAX`, bosai `BOSAI_MAX_RECORDS`, nazori 60, sawatte-hirogaru `RECORD_LOG_CAP`=200, kurabeyou/katachi-awase/dotchiga-ii `LOG_MAX`, directions-app 500, sst-app 30-day time-based) already implement their **own** independent app-level cap/retention on top of the uncapped shared helper — a detail the prior audit's array-growth discussion did not fully capture and is corrected here.
- **`learning-records.html` and `assets/js/record-dashboard-foundation.js` were read but not modified.** They only ever read from `localStorage` via `donomanaRecordReadLog`/adapter `normalize()`, and have no write path — confirmed unaffected by this phase (also re-confirmed by the unchanged 816/816 golden-test result for that module).

---

## 3. Architecture: Before vs. After

**Before:** `setItem` throws → exception silently discarded → caller has no signal → any UI, counter, or in-memory list built from the (successfully-pushed-in-memory-but-not-persisted) return value is wrong → no notification of any kind.

**After:**
- `donomanaRecordWriteLog(storageKey, log)` now returns `{ ok: boolean, reason: 'quota' | 'security' | 'unknown' | null }` instead of `undefined`. On failure it also **automatically** calls a new `donomanaRecordNotifySaveFailure()` — so every write failure through this function, from every call site, in every one of the 22 apps, is surfaced to the user without requiring each of the ~35 individual call sites to remember to check anything.
- A companion `donomanaRecordLastSaveResult()` exposes the same result for callers (like the 10 apps going through `donomanaRecordAddLog`) where the return value itself stays the pre-existing array shape for backward compatibility.
- `donomanaRecordAddLog(storageKey, entry)`'s return value is **unchanged** (still the plain array) — zero risk to any of the ~10 existing callers that already consume it as an array.
- New `donomanaRecordClassifySaveError(e)` maps `e.name`/`e.code` to one of `quota` / `security` / `unknown`, checking both the modern `DOMException.name === 'QuotaExceededError'` and the legacy `code === 22` / `code === 1014` / Firefox's `NS_ERROR_DOM_QUOTA_REACHED`, without assuming any single browser's exact error shape.
- New `donomanaRecordNotifySaveFailure()` shows a small, fixed-position, `role="alert" aria-live="assertive"` visible banner with a generic, non-alarming, non-cause-asserting Japanese message, auto-hiding after 6 seconds, and **also** calls the site's existing, already-injected (`generate.js` "announce-helper", present on every page) `window.donomanaAnnounce(msg, {priority:'assertive'})` for screen readers. No new notification framework was introduced — this reuses the one shared mechanism that already exists site-wide, and is itself duplicated across the 22 files exactly the way `donomanaRecordReadLog`/`WriteLog`/`AddLog` already were, matching this subsystem's existing (not-DRY-by-design, self-contained-per-app) architecture rather than introducing a new centralization the phase spec explicitly discouraged if it would ripple into unrelated files.
- **Persistent in-memory atomicity fix: 8 apps / 8 files / 9 call sites.** The 8 apps found to push a new entry onto a persistent, live-displayed in-memory variable before knowing whether the subsequent write succeeded were: okane-app (`logActivity()`, 1 call site), nazori-app (`logDoneAction()` + `logSessionComplete()`, 2 call sites — the only file with more than one), bosai-app (`addBosaiRecord()`, 1), sst-app (`recordActivity()`, 1), hiragana-learn (`addLog()`, 1), katakana-app (`addLog()`, 1), suji-manabou (`addLog()`, 1), directions-app (`addLog()`, 1) — **8 apps, 8 files, 9 call sites in total** (nazori-app.html is the one file with 2). At each, the caller now checks the save result and, on failure, removes exactly the entry that failed to persist from the in-memory copy before returning — so any immediately-following render call sees a state that matches what is actually in `localStorage`.
- **Plus: kyou-no-kiroku bespoke save-safety fix (1 additional app, counted separately since it does not use the shared `donomanaRecordAddLog`/`WriteLog` helpers at all).** Its `saveState()` and `donomanaRecordWriteNestedCollection()` were individually hardened (same classify+notify pattern, adapted to their nested-object shape), and `saveRecord()`'s celebration modal is now shown **only** when the save actually succeeded; on failure the pushed record is popped back off `state.records` and the function returns early, leaving the form's inputs intact so the caregiver can simply retry.
- **Total across both categories: 9 of the 22 apps received an atomicity/false-success-specific fix beyond the universal core change** (8 via the shared-helper pattern above, plus kyou-no-kiroku's bespoke fix). The remaining 13 apps were verified to use a locally-scoped, discard-after-use pattern with no persistent variable at risk (§2 above), so no additional per-call-site change was needed for them beyond the universal core change described at the top of this section.

**Message shown to the user on any failure** (identical everywhere, chosen to avoid asserting an unconfirmed cause per the phase's explicit instruction):

> 学習の記録を保存できませんでした。端末の保存容量やブラウザの設定をご確認ください。

---

## 4. Success / Failure Contract

- **Success** = `localStorage.setItem(key, json)` returned without throwing. This phase did **not** add a read-back verification step (per §8 of the phase spec, evaluated and consciously not adopted — see §8 below).
- **Failure** = `setItem` threw for any reason. The thrown error is classified (`quota`/`security`/`unknown`) for future diagnostics but the user-facing message is identical regardless of classification, per the phase's explicit "don't assert a cause" instruction.
- A caller can now always determine which happened: either via `donomanaRecordWriteLog`'s own return value, or via `donomanaRecordLastSaveResult()` immediately after any of `donomanaRecordWriteLog`/`donomanaRecordAddLog`/(kyou-no-kiroku's) `saveState`/`donomanaRecordWriteNestedCollection`.

---

## 5. Why no read-back verification was added (§8 of the phase spec)

Evaluated and rejected for this phase:
- `localStorage.setItem` throwing an exception is already a synchronous, reliable failure signal for the dominant real-world failure mode (quota exhaustion) — a successful call that silently didn't persist is not a documented behavior of any current browser engine, only a theoretical one.
- A read-back (`getItem` immediately after every `setItem`) would double the JSON parsing cost on every single save across all 22 apps, for a case with no known real-world trigger, in a codebase whose stated hygiene concern in this exact area (see §5 of `learning-record-storage-capacity-audit-v1_0.md`, Nazori images) is byte size, not read frequency.
- It would not change the user-facing contract at all (the exception path already catches the one real failure mode); it would only add defense against a currently-hypothetical second failure mode.
- Conclusion: **not adopted**. If a future real-world report surfaces a silent-non-throwing-failure case on some browser, that would be a concrete, evidence-driven reason to revisit this decision — speculative hardening against it now was judged not to meet the phase's own "minimal safe diff" principle.

---

## 6. Accessibility

- Visible text: the failure banner (`role="alert"`, red background, white bold text, fixed position, auto-hides after 6s) — verified in a real browser at both desktop and 390px mobile width, confirmed not to cause horizontal overflow and to render fully within the viewport.
- Screen reader: `window.donomanaAnnounce(msg, {priority:'assertive'})` — the site's pre-existing shared mechanism (`aria-live="assertive"`, `role="alert"`), confirmed in a real browser to receive the same message text.
- Focus: confirmed in a real browser that showing the banner does not move `document.activeElement` — no `.focus()` call anywhere in `donomanaRecordNotifySaveFailure()`.
- No app's keyboard/switch-scan flow was touched by this phase; the failure banner is not a scan target and does not intercept any existing keyboard handler.

---

## 7. Schema / Storage Gate

| Item | Result |
|---|---|
| Storage key change | **NO** — no `storageKey` string was added, removed, or renamed in any of the 22 apps or in `record-dashboard-foundation.js` (untouched). |
| Record schema change | **NO** — no field was added, removed, or renamed on any persisted record. `donomanaRecordAddLog`'s return shape is unchanged (still the plain array). |
| Duplicate storage | **NO** — no second key, backup key, or shadow copy was introduced anywhere. |
| CSV / Common Detail compatibility | Unaffected — `assets/js/record-dashboard-foundation.js`, `learning-records.html`, and every `*-record-detail.js` module were read but not modified; the full 816/816 + 590/590 (sum of the 11 per-app/common-detail suites) golden-test baseline is unchanged. |

---

## 8. Test Matrix

### 8.1 Static / regression (Node, no browser)
- `tools/record-dashboard-poc/golden-tests.js` and all 11 per-app/common-detail suites: **1406/1406 PASS, 0 FAIL** (identical to the pre-phase baseline — these suites exercise `assets/js/*`, which this phase never touched).
- Load-smoke test (real Chromium, all 22 edited app pages): **44/44 PASS** — every page loads with zero console/page errors, and `donomanaRecordWriteLog`/`AddLog`/`ReadLog`/`ClearLog`/`LastSaveResult`/`NotifySaveFailure`/`ClassifySaveError` are all present as functions with no duplicate-definition or syntax issues.
- `git diff --stat`: exactly the 22 Record Foundation app files changed (1079 insertions / 68 deletions total), zero unrelated files, zero generated-file drift.

### 8.2 Failure-injection E2E (real Chromium via Playwright, disposable `http://127.0.0.1:8899` origin serving this worktree only — never Production)

Representative apps covering L1 (okane, tokei, shiritori2), the three L3 types (nazori raster image, sawatte-hirogaru timed trace, hiragana-learn canvas stroke trace), and the structurally-distinct kyou-no-kiroku: **34/34 PASS**, covering:

| Case | Apps exercised | Result |
|---|---|---|
| A — normal save | okane, nazori, hiragana-learn, kyou-no-kiroku | Record saved, in-memory state and persisted storage agree |
| B — QuotaExceededError (synthetic, via `Storage.prototype.setItem` override in the test harness only, never in Production code) | okane, nazori, sawatte-hirogaru, hiragana-learn, kyou-no-kiroku | Failure detected (`ok:false, reason:'quota'`), visible banner shown, no phantom in-memory entry |
| C — SecurityError | tokei | Failure detected (`reason:'security'`), no phantom record persisted |
| D — unknown DOMException | shiritori2 | Failure detected (`reason:'unknown'`), generic banner shown |
| E — existing records protected | okane, tokei, nazori, sawatte-hirogaru, hiragana-learn, kyou-no-kiroku | Pre-existing persisted record count unchanged after a failed save |
| F — recovery after storage normalizes | okane, sawatte-hirogaru, hiragana-learn, kyou-no-kiroku | Subsequent save succeeds; not permanently wedged |

Accessibility/mobile E2E (okane as representative): **7/7 PASS** — banner `role="alert"`/`aria-live="assertive"`, shared `donomanaAnnounce` region text updated, focus not stolen, no mobile-width horizontal overflow, banner fully within the 390px viewport.

**Total: 41/41 phase-specific E2E checks PASS, 0 FAIL.**

### 8.3 Known gaps in this phase's own test coverage
- Real UI click-path (button → form → save) was exercised for sawatte-hirogaru (via `#startBtn`/`#activitySurface`/`#endBtn`) and kyou-no-kiroku (via `saveRecord()` called with real form field values); the other 5 representative apps were exercised by calling their real save function directly with representative arguments rather than simulating every click, to keep the suite's runtime and complexity bounded. All of the underlying save functions called are the exact functions real UI event handlers call (verified by reading each caller site), so this is considered equivalent coverage of the save-safety logic itself, though not a full end-to-end UI walkthrough for all 7 apps.
- The remaining **13 apps** (22 total − 8 atomicity-fixed − kyou-no-kiroku) use the "safe by construction" local-scope pattern: janken-app, register-app, matching-app, dotchiga-ii-app, kurabeyou-app, katachi-awase-app, sawatte-hirogaru-app (its own cap-trim path — separate from the dedicated Sawatte E2E case in §8.2, which exercises the primary `finalizeSession()` save), mogura-tataki, junban-miyou-app, miru-hirogaru-app, mitsukete-touch-app, tokei-app, shiritori2. Of these 13, **tokei-app and shiritori2 additionally received a dedicated failure-injection E2E case each** (Cases C and D in §8.2); the other 11 were verified via static code reading only (confirmed no persistent module-level variable retains a phantom entry) plus the load-smoke test (confirms no syntax/runtime error from the universal core change), without a dedicated failure-injection E2E case, since their risk profile is materially lower (nothing in-memory can go stale) and doing so for all 11 was judged to exceed this phase's time-boxed scope without adding proportionate assurance.

---

## 9. Known Limitations

- **Safari / iOS storage behavior remains unverified** (carried over from the prior audit, Decision Gate C — unaffected in status by this phase). This phase's fix is browser-behavior-agnostic (it reacts to whatever `setItem` throws, rather than assuming a specific quota size or error shape), so it should function correctly regardless of that open question, but it has only been exercised against Chromium in this environment.
- The legacy `console.warn`-based read-back heuristic that already existed in hiragana-learn.html/katakana-app.html for `traceSample`-bearing records (added in a prior phase, `Phase T5-E-A'''`) is now redundant — this phase's mechanism detects and notifies on the same failure more directly and for every record type, not just `traceSample`-bearing ones — and was removed from those two files' `addLog()` as part of the same edit that added the new gate, since leaving a dead, misleading comment referencing a now-superseded rationale in place would be worse than removing it; no other behavior in either file was changed.
- Three storage vectors flagged as out-of-scope in the prior audit (`ongaku-compositions`, `register_img_<id>`, `tt_recordings`) are unrelated to the Record Foundation and were not touched or investigated further in this phase, per its explicit scope boundary.
- This phase intentionally did not add: backup/export, a usage indicator, auto-cleanup, retention, or IndexedDB migration — all explicitly out of scope per the phase spec (§25–§28).

---

## 10. Rollback

Every change in this phase is additive and localized to the 22 app HTML files' inline `<script>` blocks. Reverting is a plain `git checkout <baseline> -- <file>` per file (or the whole worktree) with no data-migration concerns, since no storage key or schema changed.
