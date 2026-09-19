# Full Backup Restore — Design v1.0 (+ Backup E2E Test Hardening Preflight)

**Phase:** `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-DESIGN-1`
**Status: `USER REVIEW READY`.** Design only. **No Restore code, no Production code change, no commit, no push.** This document plus one throw-away probe (§3.3, scratchpad only, not in the repo) are the only artifacts.
**Baseline:** `origin/main` = `e4c0ecb4f8bf5c74ce1f9df25b5ebb5111e15668` (no drift at start). Worktree `for-all-children-to-learn-backup-restore-design-1`, branch `design/learning-record-backup-restore-1`.

Evidence labels used below: **CODE** = read directly from the code at the baseline; **MEASURED** = produced by running real code in this phase; **DOC** = general platform knowledge not re-verified on a live iPad in this phase (must be confirmed by the real-device gate); **DECISION** = a design choice awaiting user sign-off.

---

## 0. Executive summary

Export made data *portable*. Restore makes it *writable*, so the risk profile flips: the failure to fear is no longer "a file is missing something" but "we silently damaged or lost the records a child already has."

Code investigation changed several assumptions in the phase brief. The ones that shape the design most:

1. **The Full Backup button cannot host Restore.** It lives in a *record's* detail modal, so it only exists when a record exists. The most important Restore case, a new/empty device, has no record and no modal. Restore must be a **page-level** control on `learning-records.html`, reachable from the empty state (§10).
2. **Retention caps make a naive merge silently destructive.** Nazori trims to 60 records and Sawatte to 200 on the next save. A merge that exceeds the cap would have the *app itself* delete records right after Restore reports success (§7.3). This directly collides with "never auto-delete existing records" and needs a user decision (Gate I).
3. **Other tabs can silently undo a Restore.** Hiragana/Katakana keep the whole log in memory and rewrite it in full on the next save (§8.4). A Restore performed while such a tab is open can be overwritten. The dashboard cannot detect this.
4. **There is no learner identifier anywhere** in records or in the backup envelope. Wrong-learner restore cannot be detected by code. That is a product-model fact (device-level storage), not a Restore bug, but it needs explicit privacy sign-off (§11, Gate F).
5. **Two of the four apps have no record ID at all** (Hiragana/Katakana), and their `time` is a minute-resolution locale string. Duplicate detection has to be by full-content equality, and "same time, different content" is *normal* for them, not a conflict (§6).
6. **The envelope's `storageKey` is untrusted input.** If Restore wrote to whatever key the file names, a crafted file could overwrite any localStorage key on the origin. The write target must come from a code allowlist (§5.1).

Recommended initial Restore: **PREVIEW → VALIDATE → SUMMARY → USER CONFIRM → MERGE**, fail-closed, additive only, one storage key per file, one `setItem` per Restore (§12).

---

## 1. Goals / Non-goals

**Goals**
- Restore records from a Production Full Backup file back into the same four apps' existing storage keys.
- Never lose or alter any record that already exists on the device.
- Fail closed: anything unknown, malformed, oversized, wrong-app or future-version writes nothing.
- Never report success unless the write verifiably happened.
- Work on iPad Safari and Home Screen/PWA, with keyboard and VoiceOver.

**Non-goals (this phase and the first Restore implementation)**
- Any Restore code or UI in this phase.
- REPLACE / "wipe and restore" mode.
- Editing or "resolving" conflicts (we only report them).
- Cross-app or multi-app-in-one-file restore.
- New export fields, checksums, encryption, cloud sync, IndexedDB migration, auto-cleanup.
- Restoring the 18 other Foundation apps (they have no Full Backup, hence no backup file to restore from).

---

## 2. Current Backup contract (CODE, `assets/js/record-dashboard-foundation.js` ~L1495–1535)

```
{
  backupFormatVersion: 1,            // constant BACKUP_FORMAT_VERSION
  exportedAt: "<ISO 8601 UTC>",
  appId:      adapter.appId,
  appName:    adapter.appName,
  storageKey: adapter.storageKey,
  recordCount: records.length,
  records:    [ ...raw records exactly as persisted... ]
}
```

| appId | storageKey | shape | record identity | retention cap | schemaVersion |
|---|---|---|---|---|---|
| `nazori-app` | `nazori_records` | flat array | `id` = `Date.now()_rand6`, plus `sessionId`, ISO `timestamp` | **60** (trimmed on next successful add) | absent (legacy = v1) |
| `hiragana-learn` | `hiragana_log` | flat array | **none**; `time` = `toLocaleDateString('ja-JP') + ' HH:MM'` | none | 1 |
| `katakana-app` | `katakana_log` | flat array | **none**; same `time` format | none | 1 |
| `sawatte-hirogaru-app` | `sawatte_hirogaru_log` | flat array | ISO `timestamp` (ms), `appId`, `activity` | **200** (trimmed on next save) | 1 |

Facts that matter for Restore:
- The envelope carries **no** app version, device label, learner label, or checksum. `recordCount` only detects truncation, not corruption.
- `records` are raw and lossless. Restore can be exact.
- Support is opt-in per adapter via `supportsFullBackup === true`. Restore should reuse that same flag as its allowlist so export and restore cannot drift apart.

---

## 3. Preflight — Backup E2E test hardening

### 3.1 Current issue (root cause, MEASURED)
The Backup browser E2E was written as a session scratch script. It seeds the Hiragana record with `toLocaleDateString('ja-JP') + ' 10:00'`, i.e. "today 10:00". The dashboard's default period is **7 days** (`<option value="7d" selected>`), and `isWithinPeriod` requires `0 <= now - t` (CODE, `record-dashboard-ui.js`). Run before 10:00 and the fixture is in the future, so the card is filtered out. The E2E then fails at "Hiragana card found", which looks like a Backup regression but is a fixture defect.

Reproduced in this phase against the real page (§3.3, case A): at 07:42 JST the fixture yields **0 cards**.

Related latent problems in the same scripts:
- Midnight crossing: "now − N minutes" fixtures land on the previous day and disappear from the "today" filter.
- The scripts live in a **per-session temp scratchpad** (`AppData\Local\Temp\claude\...`). They are not in the repo, not reviewed, and can be deleted with the temp directory. This applies equally to the Save Safety E2E (41), load-smoke (44) and Backup E2E (21) that the Production release gate relied on.
- They use `wait_for_timeout(...)` sleeps instead of auto-waiting.
- They depend on an ad-hoc `http.server` on a fixed port (8899), which can collide with other worktrees.

### 3.2 Recommended fix (DECISION, small, test-only)

Compared options:

| Option | Idea | Verdict |
|---|---|---|
| A | fixtures = `now − 1h` | Fixes the future-time case; still breaks at midnight (fixture on the previous day for "today"), still time-of-day flaky |
| B | fixed ISO dates + drive UI filter to `all` | Stable, but stops testing the *default* view users actually see |
| **C** | **freeze the browser clock + pin timezone + locale** | **Chosen.** Deterministic, exercises the default 7-day view, immune to host timezone/DST/midnight |

**Chosen policy (C, with B's determinism for the fixture data):**
- `context = browser.new_context(timezone_id="Asia/Tokyo", locale="ja-JP")` — pins the timezone and the `ja-JP` date format the apps use. Asia/Tokyo has no DST.
- `page.clock.set_fixed_time("2026-03-15T03:00:00Z")` (= 12:00 JST, mid-day, far from midnight). Timers keep running; `Date`/`new Date()` are constant.
- All fixture timestamps are **literals derived from that one constant** in Python (ISO strings for Nazori/Sawatte, `"2026/3/15 09:00"`-style strings for Hiragana/Katakana; JST is a fixed +09:00 so no `tzdata` dependency). **No `Date.now()` in fixture generation, in Python or in-page.**
- Because the clock is frozen, the downloaded filename is deterministic (`nazori-app-full-backup-20260315_1200.json`), so the privacy assertion can be an **exact** match instead of a prefix/suffix check.
- Add a **precondition assertion**: after seeding, visible card count must equal seeded count; otherwise fail with "fixture excluded by period filter (test bug)". This separates fixture failure from product regression permanently.
- Replace `wait_for_timeout` with locator auto-waiting / `expect`.

### 3.3 Verification of the strategy (MEASURED, throw-away probe, not committed)

Real page `learning-records.html` under Chromium via Playwright 1.62 (`Page.clock` available), default filter (7d):

| Case | Frozen "now" | Hiragana fixture time | Cards |
|---|---|---|---|
| A. old style, run at 07:42 JST | 2026-09-19 07:42 JST | `2026/9/19 10:00` (future) | **0 (failure reproduced)** |
| B. frozen mid-day | 2026-03-15 12:00 JST | `2026/3/15 09:00` | **1** |
| C. frozen just after midnight | 2026-03-15 00:05 JST | `2026/3/14 22:00` | **1** |

B and C were identical when the whole process was launched with `TZ=America/New_York`, confirming host-timezone independence. `new Date().toLocaleDateString('ja-JP')` returned `2026/3/15` under the freeze, matching what the apps write.

### 3.4 Repo destination (follow the existing architecture, no new system)

The repo already has real-browser Playwright tests in `tools/record-dashboard-poc/` (`dashboard-realbrowser-test.py`, run manually, `file://` URL, `check()` helper). Follow that:

- `tools/record-dashboard-poc/backup-hardening-realbrowser-test.py` (mirrors `*-realbrowser-test.py` naming; Node golden tests stay `*-golden-tests.js`).
- Load the page via `PAGE_PATH.as_uri()` (`file://`), like the existing test. No server, no port. Confirm downloads work from `file://` when porting (the existing test already writes CSV downloads, so this is expected to work).
- **Write downloads/artifacts to `tempfile.TemporaryDirectory()`, not into the repo.** The existing test writes `dashboard-realbrowser-artifacts/` inside `tools/`; the repo has **no `.gitignore`** and the `generate` workflow runs `git add -A` on `main`, so any stray artifact directory is one accidental commit from being auto-committed to Production.
- Port, in this order: Backup E2E (21), then Save Safety E2E (34+7), then load-smoke (44). Audit each for time-of-day dependence while porting.
- CI does not currently run any tests (`generate.yml` only runs `node generate.js`). Adding a test workflow is a separate decision and is **out of scope**; the tests just have to be runnable headless anywhere.

### 3.5 Decision: mandatory before Restore implementation
Restore E2E will add dozens of clock-sensitive scenarios (recent timestamps, repeat imports). Mixing them with a known false-failure source makes root-causing impossible. **Mandatory** as its own small phase, `LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1` (§18).

Scope judgement for *this* phase: test-only, safe, no Production impact, but it is a repo change plus a port of three suites. Kept out of scope here to honor "design only, no commit before approval"; the recommendation above is complete enough to implement directly.

---

## 4. Restore mode analysis (Gate A)

| Mode | Behavior | Data-loss risk | Duplicate risk | Verdict |
|---|---|---|---|---|
| APPEND | add every backup record | none | **high** (repeat import doubles data) | rejected |
| REPLACE | overwrite storage with backup | **destroys everything not in the file** | none | rejected for initial release; possible future "advanced" mode with much stronger confirmation |
| MERGE | add records not already present | none | low with good dedupe | needed |
| PREVIEW-then-apply | show what would happen first | none | n/a | needed |

**Decision A (recommended): PREVIEW + MERGE.** Feasible in the current code: reading, validating and diffing are pure; only the final write touches storage, and it is one `setItem` on one key (§8).

---

## 5. Validation contract (fail closed)

### 5.1 Envelope validation (any failure ⇒ reject, nothing written)
1. File size ≤ hard limit **before** reading (§9.3).
2. `JSON.parse` succeeds; root is a plain object (not array/null/primitive).
3. `backupFormatVersion` is an integer and **exactly a supported version** (currently `{1}`). Higher ⇒ "newer" message; lower/absent/non-integer ⇒ reject.
4. `appId` is a string present in the **Restore allowlist** = adapters with `supportsFullBackup === true` (single source of truth shared with export).
5. `storageKey` **must equal** `adapter.storageKey`. The **write target is always taken from the adapter, never from the file.** This closes the arbitrary-localStorage-key overwrite vector.
6. `records` is an array; `recordCount` is an integer equal to `records.length` (truncation guard).
7. `exportedAt` parses as a date (informational only; used in the preview, never for logic).
8. `appName` is treated as display text only, rendered via `textContent`, ignored for logic.

### 5.2 Record validation (per app; unknown extra fields are preserved, unknown *required* shape is rejected)
All records: must be a plain object (not array/primitive/null). Own property `__proto__` from `JSON.parse` is inert data; Restore must never `Object.assign`/deep-merge it into another object (records are stored as-is, never merged field by field).

| App | Required | Checks |
|---|---|---|
| Nazori | `timestamp` parseable; `id` string if present | `image` (if present) must be a string starting `data:image/png;base64,`, base64 charset only (linear scan, no backtracking regex), PNG magic after decode of the first bytes (`iVBORw0KGgo`), length ≤ per-image limit; `charImages` (if present) array of the same. Reject `image/svg+xml` and any other MIME. |
| Hiragana/Katakana | `time` non-empty string; `type` string; `data` plain object; `schemaVersion` absent or 1 | if `data.traceSample` present: `version===1`, `coordinateSpace==='normalized-1000'`, `strokes` array of arrays of finite numbers within a sane range (0..1000 ± tolerance), point-count bounds. Align with `donomanaKanaRecordDetail.hasAnyValidTrace` so a restored record is one the dashboard can actually render. |
| Sawatte | `timestamp` ISO parseable; `appId==='sawatte-hirogaru-app'`; `activity` string; `schemaVersion` 1; `payload` plain object | if `payload.trace` present: `traceSchemaVersion===1`, `pointLimit` finite ≤ 1000, `trimmed` boolean, `taps`/`swipes` flat arrays of finite numbers (taps in x,y,t triples) with length ≤ `pointLimit`-derived bound. Align with `isValidTrace`. |

Record `schemaVersion` is **independent** of `backupFormatVersion`. Absent = legacy v1 (Nazori entries have none). A value the app does not know (e.g. 2) ⇒ that record is invalid (fail closed).

### 5.3 Wrong-app / version / key behavior (Gates D, E)
- **Gate D — wrong app:** `appId` not in allowlist, or `storageKey !== adapter.storageKey` ⇒ **REJECT**, whole file, message names nothing technical. There is no "restore into the app I am looking at" flow, so a mismatch cannot even be confused into a write: the target is derived from the file's own (validated) `appId`.
- **Gate E — unsupported version:** future or unknown ⇒ **REJECT** ("このバックアップは新しいバージョンで作成されています"). Never best-effort.
- Older→newer: version 1 must remain readable forever; future migrations are added as an ordered `version → version+1` transform chain, each unit-tested with a frozen v1 fixture. Not needed until a v2 exists.

### 5.4 Invalid-record behavior (Gate C)
**Recommended:** default **all-or-nothing** (any invalid record blocks the restore and the preview shows the count). Provide an explicit, unchecked-by-default option **"問題のない N 件だけを復元する"** that switches to valid-only. Rationale: files produced by the app should be entirely valid, so invalid records signal corruption or tampering and deserve a stop; but forcing the loss of 59 good drawings because one is bad is unkind, so the user can opt in knowingly. Never silent.

---

## 6. Duplicate and conflict strategy (Gate B)

### 6.1 Constraints from the code
- Hiragana/Katakana: no ID, `time` is minute-resolution local-time text. Two genuinely different traces in the same minute are **normal**.
- Nazori: `id` is `Date.now()_random`, effectively unique. Timestamp is ISO.
- Sawatte: ISO-millisecond `timestamp`.
- Timestamp-only matching is therefore wrong for Kana and unnecessary for the others.

### 6.2 Fingerprint
**Ephemeral, in-memory only; no field added to any stored record.**
- Canonical form: JSON serialization with **recursively sorted object keys**, arrays in order, no whitespace. Immune to key-order differences between devices.
- Hash: a small **non-cryptographic** 53-bit hash (e.g. cyrb53) computed over the canonical string, **plus length**. `crypto.subtle` is *not* used: it is only exposed in secure contexts, and the LAN gate served the site over plain `http://`, where it is undefined (DOC). Being non-cryptographic is acceptable because a hash match is **confirmed by full canonical-string equality** before being treated as a duplicate, so a collision can never wrongly drop a record.
- Memory: keep only `(hash,length)` for existing records; re-canonicalize on a hash hit to verify.

### 6.3 Classification of each valid backup record
| Class | Rule | Action |
|---|---|---|
| **DUPLICATE** (exact) | canonical content equals an existing record (or an earlier record in the same file) | skip, count |
| **CONFLICT** | *strong identity* equal but content differs. Strong identity: Nazori `id`; Sawatte (`appId`+ISO `timestamp`). **Kana has none.** | **do not write**, do not overwrite, count and list |
| **NEW** | neither | add |
| (info) same-minute Kana, different content | not a conflict | add; shown as informational count only |

`same timestamp / different content` (R15): Nazori/Sawatte ⇒ CONFLICT (skipped, reported); Kana ⇒ NEW. `same sessionId / different payload` (case E): Nazori `sessionId` groups several records of one session by design, so it is **not** an identity; it is ignored for dedupe.

### 6.4 Learner-mixed backups (case F)
Not detectable: no learner field exists (§11). A backup mixing learners is indistinguishable from one learner. Covered by preview + confirmation wording, not by logic.

---

## 7. Merge policy

### 7.1 Cases
| Case | Result |
|---|---|
| A: existing 0, backup 10 | add 10 |
| B: existing 10, backup 10 identical | add 0, skipped 10 |
| C: existing 10, backup 5 new | add 5 |
| D: same timestamp, different content | Nazori/Sawatte CONFLICT (not written); Kana NEW |
| E: same sessionId, different payload | not an identity; judged by content only |
| F: mixed learners | undetectable, see §11 |
| G: existing storage unreadable | **BLOCK**, never overwrite (see §8.1) |

### 7.2 Ordering
Existing records keep their exact relative order and are **never re-sorted**. New records are **inserted** by timestamp into that sequence (an ordered two-list merge, ties keep the existing record first). Apps trim by *array position* (oldest-first), so a chronologically consistent array is what makes the apps' own retention behave sensibly. Kana `time` strings are parsed with the same `Date` parsing the dashboard already uses; unparseable time ⇒ record invalid.

### 7.3 Retention caps (Gate I — new decision, not in the brief)
CODE: Nazori `NAZORI_MAX_RECORDS = 60` and Sawatte `RECORD_LOG_CAP = 200` are enforced on the **next write by the app**, by dropping the oldest entries. If Restore produces more than the cap, the app will delete records on its next save, which contradicts "never delete existing records" and would also throw away just-restored data with no message.

Options:
1. Restore writes an over-cap array and lets the app trim later. **Rejected** (silent deletion, possibly of pre-existing records).
2. **Never evict.** Compute `free = max(0, cap − existing.length)`; restore only that many NEW records (**newest first**); report the rest as "保存できる件数の上限のため復元しませんでした: N件". **Recommended.**
3. Refuse the restore if it would exceed the cap. Safe but blunt.

Cap constants live inside app HTML. Restore must mirror them in the adapter and a golden test must read the app HTML and assert the mirrored numbers still match (drift guard).
This also needs the product owner's confirmation that treating the app cap as a hard limit is intended (Open Question 1).

---

## 8. Atomicity, write safety, rollback

### 8.1 Sequence (one storage key per Restore ⇒ one `setItem`)
1. Read the file; parse; validate (§5). **No storage access yet.**
2. `existingRaw = getItem(key)`. `null`/`''` ⇒ `[]`. Malformed JSON or non-array ⇒ **BLOCK** ("既存の記録を読み取れないため復元できません"): a corrupted-but-possibly-recoverable value is never overwritten automatically.
3. Existing records are kept **as parsed objects, unvalidated and unmodified**, even if they would fail validation. Restore never drops an existing record for being odd.
4. Classify, apply the cap rule, build the merged array **in memory**, serialize **once**.
5. Show the preview. Nothing written.
6. On confirm: re-read `getItem(key)`; if it differs from `existingRaw` (another tab wrote meanwhile) ⇒ **abort and re-preview**, never merge over a stale plan.
7. Single `setItem(key, serialized)` inside `try/catch`.
8. **Verify** by reading back (`length` equality, plus record count when small enough).
9. Report success only after step 8 passes. Release all large references.

### 8.2 Partial restore prevention
One key, one write. A per-record loop is forbidden. Web Storage `setItem` is all-or-nothing: on quota failure it throws and leaves the previous value intact (DOC; verify on the real device in the Safari gate, R13).

### 8.3 Rollback
Hold `previousRaw` in memory for the duration of the transaction only. If step 7 throws: nothing changed, report failure. If step 8 fails: attempt `setItem(key, previousRaw)` and report failure either way. **No permanent safety-backup key** and no second copy in storage.
Optional UX (recommended, non-blocking): before applying, offer "先に今の記録をバックアップしますか？" linking to the existing Full Backup. It is user-driven and stores nothing.

### 8.4 Cross-tab stale state (new hazard, CODE)
- Hiragana/Katakana: `learningLog` is read once at load, and `saveLog()` rewrites the **whole** array (`hiragana-learn.html` L4157–4171). An app tab that was open before the Restore will overwrite the restored data on its next save.
- Nazori: `addLog` re-reads storage (safe), but `saveRecords()` (used for single-record delete and clear-all, `nazori-app.html` L3235/L3263) writes the in-memory array.
- Sawatte: re-reads before each write (safe).
- No `storage` event listeners exist in any of these pages.
The dashboard cannot see other tabs. Mitigations: (a) prominent pre-confirm text "ひらがな・カタカナ・なぞり書きなど、教材のページを開いている場合は閉じてから復元してください"; (b) after success, tell the user to reload/reopen the apps; (c) recommend a separate app-side hardening phase (a `storage` listener that reloads the in-memory log) because it changes Production app pages (§18, optional). Documented as a Known Gap (§17).

### 8.5 Save Safety reuse (§29)
`donomanaRecordWriteLog` is duplicated inline into the app pages by `generate.js`; it is **not** available to `learning-records.html`, and its append-oriented siblings (`AddLog`) are the wrong shape. Reuse the **contract**, not the code: a small `writeRawSafely(storage, key, serialized) → {ok, reason}` in the dashboard Foundation, with the same `quota / security / unknown` classification as `donomanaRecordClassifySaveError`, and **no banner** (Restore renders its own `role="alert"` result). Unit-testable with an injected storage stub, like the existing golden tests.

### 8.6 False-success prohibition
Success is reachable only through step 8. Validation failure, BLOCK, abort-on-change, quota, security, unknown, or read-back mismatch each end in a failure message with **no** "復元しました".

---

## 9. Quota and memory

### 9.1 Quota (Gate G)
`navigator.storage.estimate()` is **not** a localStorage capacity oracle and is not used. There is no safe dry-run (a probe write could itself consume the last bytes or leave junk). Strategy:
1. Advisory only: show serialized size and a warning above a heuristic threshold (e.g. > 3 MB).
2. **Authoritative check = the single `setItem`.** It either succeeds or throws with storage unchanged.
3. On `quota`: "記録を復元できませんでした。端末の保存容量やブラウザの設定をご確認ください。" Nothing written, no success.
Measured record sizes from the earlier capacity audit: Nazori ~15–72 KB/record (60 cap ⇒ ≲ 4.3 MB), Sawatte ~12.4 KB/record (200 cap ⇒ ≈ 2.5 MB), Kana ~0.7–1 KB. Real Safari/iPad quota is **DOC / needs the real-device gate** (the audit itself marks it USER REAL-DEVICE REVIEW REQUIRED).
Note: that audit document lives on `for-all-children-to-learn-storage-capacity-audit-1` and is **not on `main`**, although Production app pages cite it by name. Recommend merging it (docs only) so the reference resolves.

### 9.2 Memory
Peak ≈ file text (UTF-16) + parsed object + canonical strings + merged object + serialized string, i.e. several times the file size. With a multi-MB Nazori file that is tens of MB on an iPad, which is acceptable but must be measured (R17). Mitigations: release `text` right after parse; canonicalize sequentially and keep only `(hash,length)`; serialize once.

### 9.3 Size limits (DECISION, tunable)
Hard reject > 10 MB **before** reading (larger cannot fit localStorage anyway); warn > 3 MB. Final numbers to be set from the Safari gate.

---

## 10. Restore UX

### 10.1 Location (Gate H)
**Page-level** control on `learning-records.html`, in a small "バックアップ" area, **also shown in the empty state** ("まだ学習のきろくはありません"), because empty-device restore is the primary use case and the record detail modal does not exist there. The existing Full Backup button (in the detail modal) is unchanged. The page is already framed as supporter-facing. App-local Restore is **not** proposed (Export is Common-UI-only too).

### 10.2 Flow
`「📥 バックアップから復元」` → real `<button>` that triggers a hidden `<input type="file" accept=".json,application/json">` → read/validate → **Preview dialog** → user confirms → write → **Result** in the dialog (role="status"/"alert").
`accept` only guides the picker (iOS may still show other files); **content parse + schema validation is the real gate**, the extension is never trusted.

### 10.3 Preview contents
App name; backup `exportedAt`; format version; record count in file; record time range; **new / duplicate / conflict / invalid / over-retention counts**; estimated size; warnings (cap, size, "another child's records?", "close app pages"); "既存の記録は削除されません".
Deliberately **not shown**: Nazori `allChars` (may be a child's name, the Foundation already withholds it), image thumbnails, raw record contents.

### 10.4 Confirmation copy
"○件の記録を追加します。今ある記録は削除されません。" with a secondary line "別のお子さまの記録ではないか、ご確認ください。" Primary button "復元する", secondary "やめる". No destructive/REPLACE wording exists because REPLACE does not exist.

### 10.5 Result summary and errors
Success: `added / skipped duplicate / conflict (not overwritten) / invalid / over-limit`. Errors are non-technical (quoted from the brief):
- unreadable/invalid: 「バックアップを読み込めませんでした。ファイルの内容をご確認ください。」
- quota/security: 「記録を復元できませんでした。端末の保存容量やブラウザの設定をご確認ください。」
- unreadable existing data: 「既存の記録を読み取れないため、復元できません。」
- changed during preview: 「記録が更新されました。もう一度お試しください。」
No error class names, stack traces, or file contents in the UI or console.

### 10.6 Restore is not a learning record (§42)
Restore writes nothing but the merged app array. No audit entry in any learning log. A separate audit log, if ever wanted, is its own design.

---

## 11. Privacy and learner boundary

**CODE:** the Foundation states "Device-level first". No record or envelope field identifies a learner; Kana/Nazori/Sawatte records have no learner, class or device fields. Therefore:
- **Gate F — learner boundary: NOT ENFORCEABLE BY CODE.** Wrong-child, wrong-class and wrong-device restore are all undetectable. Mitigations are procedural: preview (date range, counts, `exportedAt`), explicit confirmation copy, and a "back up current data first" prompt. **Recommend explicit privacy sign-off** on this residual risk before implementation.
- Optional future (not now): an *additive, user-entered, optional* label in envelope v2 (e.g. "Aさんのバックアップ") shown at restore time. Trade-off: it puts a name into a file. Design separately.
- The backup file contains handwriting images, stroke traces, timestamps and possibly Nazori `allChars`. It is **unencrypted** at rest in Files/iCloud. Not a Restore change, but the UX must not imply otherwise.
- Restore is **local-only**: no network, no upload, no analytics, no retention of the chosen file, no console logging of contents.
- **Same-origin only:** localStorage is per origin. On iOS the Home Screen app and Safari use separate storage containers (DOC, verify in gate), so Restore fills the container of the context it is run in.
- Filename handling: filename is never displayed as identity and never parsed for meaning.

---

## 12. Threat and failure model

| # | Threat / failure | Impact | Mitigation | Test |
|---|---|---|---|---|
| T1 | wrong app backup | data in wrong app | allowlist + `storageKey` equality; target from adapter | R7 |
| T2 | wrong / injected `storageKey` (e.g. `donomana_settings`) | overwrite arbitrary key | write target never from file (§5.1) | R8, R23 |
| T3 | unsupported/future `backupFormatVersion` | mis-parse | exact-version allowlist, reject | R9 |
| T4 | malformed JSON / empty / array root | crash or bad write | parse in `try`, root must be object | R6 |
| T5 | missing fields / `records` not array / bad `recordCount` | partial write | envelope validation, count equality | R6 |
| T6 | corrupted PNG Data URL / wrong MIME (svg) | broken or unsafe render | prefix, charset, PNG magic, size cap | R10 |
| T7 | malformed traceSample / Sawatte trace | render error | align with existing `isValidTrace`/`hasAnyValidTrace` | R11, R12 |
| T8 | duplicate records | doubled data | canonical fingerprint + equality confirm | R3, R4, R16 |
| T9 | conflicting records | silent overwrite | never overwrite; report | R5, R15 |
| T10 | huge backup | OOM/freeze, mid-write failure | size cap, sequential canonicalization | R17, R26 |
| T11 | quota exceeded during write | partial/corrupt state | single `setItem`, atomic, no success on failure | R13 |
| T12 | partial restore | inconsistent data | one key, one write | R13, R14 |
| T13 | browser crash mid-restore | corrupt data | single atomic write; nothing written before | (manual) |
| T14 | repeated import | duplicates | idempotent merge (second run adds 0) | R16 |
| T15 | shared-device privacy | disclosure | no display of names/images; local-only; confirm copy | R20 |
| T16 | crafted JSON (`__proto__`, deep nesting, huge strings) | prototype pollution/DoS | no object merging, store as-is, depth/size limits | R24 |
| T17 | retention cap trims after restore | silent loss | cap-aware "never evict" rule | R22 |
| T18 | stale app tab overwrites restore | restore lost | warn; recommend app-side hardening | R21 |
| T19 | storage changed between preview and confirm | merge over stale plan | re-read and compare, abort | R25 |
| T20 | existing storage corrupt/non-array | data destruction | BLOCK | R27 |
| T21 | double-tap Confirm | double write | disable during write; merge is idempotent anyway | R16 |

---

## 13. Accessibility (design requirements)
- Trigger and file input operable by keyboard; the hidden `<input>` is not a tab stop, the visible `<button>` is.
- Preview is a real dialog (`role="dialog"`, `aria-modal`, `aria-labelledby`), reusing the dashboard's existing detail-modal focus trap; focus moves in on open, **returns to the trigger** on close; Escape closes without writing.
- Progress/result via `role="status"` (`aria-live="polite"`); errors via `role="alert"`. Never rely on color alone.
- Counts are in text and readable in order; tap targets ≥ 44 px, matching the site's existing rule.
- Confirm button disabled while writing; the state change is announced.
- VoiceOver check is a Gate item (R20).

---

## 14. iPad / Safari (required future Gate)
Safari Normal; Home Screen/PWA (file picker behavior and the separate storage container, DOC); Files picker (including a `.json` from Files/iCloud and one with a renamed extension); VoiceOver; portrait/landscape; large JSON; low-storage; and a **quota-failure** scenario on device (R13). The Backup Gate precedent (seed page + real UI) should be reused; Restore additionally needs a *malformed-file* fixture set delivered to the device.

---

## 15. Cross-device and cross-version
- **Cross-device (school iPad A → B):** supported in principle: the envelope is self-describing and the merge is content-based. Kana `time` is written in fixed `ja-JP` format in the writer's local time, so restore does not reinterpret it; ordering across time zones may differ slightly, which does not affect correctness. Unverified on real devices (R18/R19).
- **Cross-version:** version 1 stays readable. Any future format change ships with an ordered migration chain plus a frozen v1 fixture test. Record-level `schemaVersion` migrations are per-app adapters, added only when a record schema actually changes.
- **Cross-container (Safari ↔ PWA):** files move fine; storage does not. Restore targets the current container.

---

## 16. Test matrix (for the future implementation)

Layers: **N** = Node golden (pure validator/merge, injected storage stub), **B** = real-browser E2E (Playwright, fixed clock per §3), **D** = real device.

| ID | Scenario | Expected | Layers |
|---|---|---|---|
| R1 | valid file, empty target | all added, count matches | N B |
| R2 | valid file, existing target | existing untouched and in order; new inserted | N B |
| R3 | exact duplicate file | 0 added, N skipped | N B |
| R4 | partial duplicate | only new added | N B |
| R5 | conflict (Nazori id / Sawatte ts, different content) | not written, reported, existing intact | N B |
| R6 | malformed JSON, empty, array root, missing fields, `records` null | reject, storage byte-identical | N B |
| R7 | wrong app | reject | N B |
| R8 | wrong `storageKey` | reject | N B |
| R9 | unsupported/future version | reject | N B |
| R10 | malformed PNG (bad prefix/charset/magic/svg) | invalid | N B |
| R11 | malformed Kana trace | invalid | N B |
| R12 | malformed Sawatte trace | invalid | N B |
| R13 | quota failure (stub throws / real device) | nothing written, failure shown, no success | N D |
| R14 | recovery after failure | retry succeeds after freeing space | N D |
| R15 | same timestamp, different content | Nazori/Sawatte conflict; Kana added | N B |
| R16 | repeated import | second run adds 0 | N B |
| R17 | large backup | completes; memory/time recorded | B D |
| R18 | Safari Normal | pass | D |
| R19 | Home Screen/PWA | pass | D |
| R20 | VoiceOver | pass | D |
| R21 | app tab open with stale in-memory log | documented behavior; warning shown | B (demonstrates gap) |
| R22 | merged size exceeds Nazori 60 / Sawatte 200 | never evicts; remainder reported | N B |
| R23 | envelope `storageKey` pointing at an unrelated key | rejected; that key untouched | N B |
| R24 | `__proto__` / deep nesting / huge string | no pollution; rejected or safely stored | N |
| R25 | storage changed between preview and confirm | abort, re-preview | N B |
| R26 | file > hard limit | rejected before reading | N B |
| R27 | existing storage corrupt / non-array | BLOCK, unchanged | N B |
| R28 | existing records with odd shape | preserved byte-for-byte in merged output | N |
| R29 | cap constants drift vs app HTML | golden test fails | N |

Existing Backup and Save Safety suites must stay green throughout (regression guard), and the E2E policy in §3 applies to every new browser test.

---

## 17. Known gaps (explicit, not hidden)
1. **No learner identity** in data or envelope; wrong-learner restore is procedural only (privacy sign-off recommended).
2. **Stale app tabs** can overwrite a Restore (Hiragana/Katakana whole-array rewrite; no `storage` listeners). Warned, not prevented, unless the optional app-side phase is done.
3. **No checksum**; corruption is detected only by structure/PNG-magic checks.
4. **Real iPad/Safari** quota, `setItem` failure atomicity, file-picker behavior and PWA storage separation are DOC-level until the device gate.
5. **Retention-cap policy** (Gate I) needs a product decision.
6. Conflicts are reported, never resolved.
7. No REPLACE mode, by design.
8. The capacity-audit document is not on `main`.

---

## 18. Decision gates (final)

| Gate | Decision | Recommended |
|---|---|---|
| A | Initial Restore mode | **PREVIEW + MERGE**, existing never deleted |
| B | Duplicate strategy | **Ephemeral canonical fingerprint (sorted-key JSON, non-crypto 53-bit hash + length, confirmed by full equality)**; exact ⇒ skip; strong-identity collision ⇒ conflict (not written); Kana same-minute ⇒ new |
| C | Invalid records | **All-or-nothing by default**, explicit opt-in "valid only" |
| D | Wrong app | **REJECT** (allowlist + key equality, target from code) |
| E | Unsupported version | **REJECT** (exact-version allowlist) |
| F | Learner boundary | **Not enforceable**; procedural mitigation; **needs your privacy sign-off** |
| G | Quota failure | **One atomic `setItem`; NO WRITE / NO SUCCESS on failure**; advisory size only |
| H | UI location | **Page-level on `learning-records.html`, incl. empty state**; not in the detail modal |
| **I** (new) | Retention caps | **Never evict; restore up to free capacity, newest first, report the rest** — needs product confirmation |
| **J** (new) | Pre-restore safety | **Non-blocking "back up current data first" prompt**; no stored safety copy |

### Stop-condition review (per the brief §56)
- Current backup format insufficient for Restore: **no** (sufficient; identity gaps handled by content fingerprint).
- Duplicate strategy seriously ambiguous: **no** (defined, with Kana caveat).
- App schema variation too large: **no** (4 apps, 3 shapes).
- Atomic merge hard: **no** (one key, one write).
- Quota safety insufficient: **partially**: no reliable pre-check exists; safety comes from the atomic write, not a prediction.
- **Learner boundary unresolvable / privacy sign-off needed: yes, borderline.** Not a design blocker under the device-level model, but it is the residual risk that most needs your explicit acceptance.
- Destructive behavior required: **no**, provided Gate I is accepted as "never evict".

---

## 19. Next phases

| Phase | Priority | Notes |
|---|---|---|
| `LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1` | **Mandatory** before implementation | §3: port Backup (then Save Safety, load-smoke) into `tools/record-dashboard-poc/`, fixed clock + pinned TZ/locale, temp artifacts, precondition assertion |
| `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-IMPLEMENTATION-1` | After the above and Gates F/I sign-off | validators + merge (Node-first), then UI |
| App-side stale-state hardening (working name `LEARNING-RECORD-APP-STORAGE-EVENT-SYNC-1`) | **Recommended / optional** | `storage` listener in Hiragana/Katakana/Nazori; touches Production app pages, so its own review |
| `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-SAFARI-IPAD-GATE-1` | Required before release | §14 |
| `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-PRODUCTION-RELEASE-1` | Last | |
| Merge capacity-audit doc to `main` | Optional, docs-only | resolves a dangling reference |

---

## 20. Open questions for the product owner
1. Is the app retention cap (Nazori 60 / Sawatte 200) a hard product limit that Restore must respect (Gate I option 2), or may a Restore raise it?
2. Do you accept that wrong-learner restore is only procedurally mitigated (Gate F)?
3. Is "valid-only" partial restore (Gate C opt-in) wanted at all, or should any invalid record simply block?
4. Should a future envelope carry an optional, user-entered backup label to reduce wrong-learner risk, given it places a name in the file?
5. Is the optional app-side `storage`-listener phase worth doing before Restore ships, or is the warning text enough?
6. Hard file-size limit (proposed 10 MB) and warning threshold (3 MB): confirm or adjust after the device gate.

---

## 21. Explicit stop statement

`LEARNING-RECORD-STORAGE-BACKUP-RESTORE-DESIGN-1` = **USER REVIEW READY**.
No Production code was changed. Nothing was committed, pushed, merged, deployed, version-bumped, or added to the Production changelog. The only file created in the repo is this document; the clock probe (§3.3) lives in the session scratchpad only.
