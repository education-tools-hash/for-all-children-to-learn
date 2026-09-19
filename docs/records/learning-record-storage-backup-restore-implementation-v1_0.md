# Full Backup Restore — Implementation v1.0

**Phase:** `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-IMPLEMENTATION-1`
**Status: `USER REVIEW READY`.** Not released. Nothing pushed, merged or deployed. No version bump, no changelog entry.
**Baseline:** `origin/main` = `e4c0ecb4f8bf5c74ce1f9df25b5ebb5111e15668` (no drift). Branch `feature/learning-record-backup-restore-1`, built on top of the approved E2E Hardening checkpoint (cherry-picked, since it is not yet on Production).
**Design source of truth:** `learning-record-storage-backup-restore-design-v1_0.md` (User Approved). This document records what was built and every place where implementation forced a decision.

---

## 1. Architecture

| Layer | Where | Responsibility |
|---|---|---|
| Size gate | `FOUNDATION.checkBackupFileSize(bytes)` | ok / warn (> 3 MB) / reject (> 10 MB), decided from `File.size` **before** the file is read or parsed |
| Planner (read-only) | `FOUNDATION.planBackupRestore(text, {storage})` | parse, envelope + record validation, duplicate/conflict analysis, retention cap, ordered merge built **in memory**. Never writes. |
| Writer (the only writer) | `FOUNDATION.executeBackupRestore(plan, {storage})` | re-read, stale gate, **one** `setItem`, read-back verification, rollback |
| UI | `learning-records.html` (inline script + markup) | page-level button, hidden file input, preview / confirm / result dialog. Thin glue only; every decision lives in the unit-tested Foundation functions. |

All code is `record-dashboard-foundation.js` + `learning-records.html`; no new JS file, no Service Worker change (see §7).

## 2. Design decisions fixed by the brief, and how they are implemented

| Gate | Implementation |
|---|---|
| A PREVIEW + MERGE | Preview dialog → explicit 「復元する」 → merge. Nothing is written until confirm (tested: storage and `setItem` spy untouched while the preview is open). |
| B exact duplicates only | Canonical (sorted-key) JSON per record; a 53-bit non-crypto hash + length only **narrows candidates**; the decision is full canonical-string equality. No fingerprint is stored on any record. |
| C any invalid record rejects everything | `invalid-records`, with the count shown; no valid-only mode exists. |
| D wrong app | `wrong-app` / `wrong-key`, whole file rejected. |
| E unsupported version | Exactly `1` is accepted; `>1` → "newer version" message; anything else → generic. |
| F learner boundary | Not enforceable. Preview says "この端末で使っている記録のバックアップかどうか、ご確認ください" and that the learner "は判定できません" (no false claim of a match). |
| G quota | One `setItem`. Failure ⇒ nothing written, no success text, `role=alert`. |
| H page-level, empty state | Restore section sits **outside** `#dashboard-body`; visible on an empty device (E2E R22). |
| I retention | Nazori 60 / Sawatte 200 (mirrors of the apps' own caps, guarded by a drift test that reads the app HTML). Never evicts; fills only free slots, newest backup records first; remainder reported. Kana apps have no cap (verified in code), so none is applied. |
| J optional pre-restore backup | "先に今の記録をバックアップする" button in the preview; reuses the existing Full Backup export; never automatic; hidden when the device has no records. |

Allowlist: only adapters with `supportsFullBackup === true` **and** a record validator can be restored; a Node test asserts the restorable set equals the exportable set across all 22 adapters. The write target always comes from the adapter, **never** from the file's `storageKey` (which must merely equal it).

## 3. Decisions the implementation forced (please review)

1. **Conflicts do not block the restore; they are skipped and reported.** The brief is ambiguous: §22 says follow the approved Design if it is settled (Design §6.3/§7.1: a CONFLICT is "not written, reported", other records still restored), while §38 assumes conflicts "stop before execution". I followed the approved Design. Effect: a file with 1 conflict + 3 new records adds the 3, leaves the conflicting existing record untouched, and says so in the preview **and** the result. If you prefer "any conflict blocks the whole restore" it is a one-line change in the planner (`if (conflictCount > 0) return reject`) plus the tests.
2. **The Foundation's "read-only" test was narrowed, not removed.** `golden-tests.js` §16 used to require that the Foundation source contain no `.setItem(`/`.removeItem(` at all. Restore is the first write this module makes, so the rule is now: those APIs may appear **only inside `executeBackupRestore()`**; `.clear()` stays forbidden everywhere; and `backup-restore-golden-tests.js` proves dynamically that planning performs zero writes for every app. The public-API-surface assertion was updated 9 → 12 functions (`+ checkBackupFileSize, planBackupRestore, executeBackupRestore`). This is a deliberate change to a documented safety contract and is called out here for approval.
3. **Restored records are shown immediately.** The dashboard's default period is 7 days and restored records are usually older, so a successful restore would look like a failure. After a successful restore the period/app/category/activity filters are reset to "すべて" and the result says so.
4. **Existing records are re-serialised.** The merged array is produced with `JSON.stringify` of the parsed existing records, so their *contents* are preserved exactly (tested with deep equality, including odd/invalid-looking existing records) but whitespace/key order of the stored text is normalised, and integers like `1.0` become `1`.

## 4. Validation contract (fail closed)

- **Envelope:** root is a plain object; safe-JSON walk (depth ≤ 16, JSON-only types, **no `__proto__` / `constructor` / `prototype` key anywhere**); `backupFormatVersion === 1`; `appId` allowed (own-property lookup, so `"constructor"` etc. cannot resolve to inherited members); `storageKey === adapter.storageKey`; `records` is an array (≤ 20 000); `recordCount === records.length` (truncation guard); `exportedAt` parseable. `appName` is display-only.
- **Nazori:** timestamp parseable; `id`/`sessionId` typed; `schemaVersion` absent or 1; `image` and every `charImages[].image` must be `data:image/png;base64,` + base64 charset only + length % 4 = 0 + PNG magic (`iVBORw0KGg`) + ≤ 8 M chars. SVG / JPEG / `javascript:` / http URLs rejected.
- **Hiragana / Katakana:** `time` parseable, `type` string, `data` plain object; if `traceSample` is present it must satisfy the app's own rules (`version 1`, `normalized-1000`, non-empty even-length strokes, finite 0..1000) plus bounds (≤ 100 strokes, ≤ 2000 numbers each). `traceSample: null` is invalid (the app never writes null; legacy records simply lack the field).
- **Sawatte:** record `appId`, `activity`, `payload`; if `payload.trace` is present: `traceSchemaVersion 1`, `pointLimit` 1..10000, boolean `trimmed`, `taps`/`swipes` flat x,y,t triples (x,y in 0..1000, t ≥ 0) with count bounds.
- Every accepted record type is also accepted by the dashboard's own display validators, so a restored record renders (tested).
- Existing storage that is malformed or not an array **blocks** the restore; it is never overwritten.

## 5. Atomicity and failure handling

Planner reads once; writer: `getItem` → compare with the raw value captured at preview (**stale gate**) → single `setItem(adapterKey, mergedJson)` → `getItem` read-back must equal the written string → success. On read-back mismatch it restores the previous raw value (or `removeItem` if the key was absent) and reports `verify-failed`; if even that fails it reports `critical`. No permanent safety-backup key. Quota / Security / unknown write errors all leave storage byte-identical and show the standard message. A plan cannot be applied twice (second call sees changed storage → `stale`). Repeated import is idempotent: 2nd and 3rd import find only duplicates and do not write.

## 6. UX / accessibility

Button 「📥 バックアップから復元」 (44 px, real `<button>`); hidden `<input type=file accept=".json,application/json">` (not a tab stop). Content, not extension/MIME, decides (a `.txt` with valid JSON is accepted; a `.json` with garbage is rejected). Dialog: `role=dialog`, `aria-modal`, `aria-labelledby`, focus moves to the title on every state change, Tab/Shift+Tab contained (the existing detail-modal trap was generalised to serve both dialogs and re-verified), Escape / × / backdrop / 「やめる」 close without restoring and return focus to the Restore button. Result is `role=status`, errors `role=alert`, plus a page-level `aria-live=polite` line. The preview never shows record contents, images or the file name. Errors use the approved non-technical wording.

## 7. Offline / Service Worker

`/learning-records.html` is a **Pilot offline page**; the Service Worker precaches `record-dashboard-foundation.js` and `record-dashboard-ui.js` as required assets. To avoid touching that contract (and a Service Worker version bump), no new JS file was added: the logic lives in the already-precached Foundation and the page's inline script. If a stale cached Foundation without the new API ever meets the new page, `setupRestore()` detects it and **hides** the Restore section rather than half-working.

## 8. Generator gate

`learning-records.html` is hand-authored but appears in `generate.js`'s manifest / pwa-register injection lists. `node generate.js` run twice produced **zero** diff (both runs byte-identical to the pre-run working tree), the injected marker blocks are untouched, and `assets/js/record-dashboard-foundation.js` is not generator-owned.

## 9. Schema gate

Storage keys changed: **no**. Record schema changed: **no** (records are restored as-is, no field added). Duplicate storage: **no**. No app HTML was modified. Caps are mirrored, not changed.

## 10. Tests

| Suite | Result |
|---|---|
| Node: existing 12 suites | 1407 (1406 + 1 new "audited writer exists" check in `golden-tests.js`) |
| Node: Backup | 43 |
| Node: **Restore (new)** `backup-restore-golden-tests.js` | **291/291** |
| Browser: Backup (2 clocks) | 72/72 |
| Browser: Save Safety | 41/41 |
| Browser: load-smoke | 44/44 |
| Browser: dashboard-realbrowser (pre-existing) | 49/49 (also 49/49 on the unmodified baseline) |
| Browser: **Restore (new)** `restore-realbrowser-test.py` | **147/147**, identical on 3 runs (noon x2, after-midnight) |

Node total 1741. The Restore E2E covers R1–R26 of the brief (R23 accessibility incl. keyboard/Escape/focus/aria; R24 file picker incl. real chooser, keyboard Enter, wrong extension; R25 3 MB warn; R26 10 MB reject), plus Gate F/J, the Tab-trap regression of the detail modal, three viewports (390 px phone, iPad portrait/landscape), and a **real round trip**: files exported by the real Full Backup UI on "device A" restored on an empty "device B", all four apps byte-for-byte equal.

**Mutation check** (throw-away, not committed): 14 single-fault mutations of the Foundation code (no stale gate, no read-back, no rollback, cap ignored, conflicts as new, file-supplied `storageKey`, invalid records skipped, duplicates undetected, unreadable existing overwritten, error swallowed, no size limit, `__proto__` allowed, existing records dropped, wrong-app check removed). **13 caught** by the Node suite. The 14th (removing the `supportsFullBackup` re-check) is an *equivalent mutant* today: the validator table is itself limited to the four opted-in apps, so the re-check is defence in depth; the exportable-equals-restorable test guards future drift. The stale-gate mutation was also confirmed to fail the browser E2E (exit 1).

## 11. Known limitations

- Learner boundary cannot be enforced (no learner id exists); procedural warning only.
- Other tabs/screens holding a stale in-memory log (Hiragana/Katakana `learningLog`, Nazori delete/clear) can overwrite a restore on their next save. The preview warns; a real fix needs app-side `storage` listeners (separate phase).
- No checksum: corruption is detected only structurally (PNG magic, base64 charset, trace ranges).
- Real iPad/Safari behaviour is unverified: file picker and `accept` handling, PWA (separate storage container from Safari), actual `localStorage` quota and `setItem` atomicity on failure, memory with ~10 MB files. The 3 MB / 10 MB limits are provisional and must be re-evaluated by the device gate.
- Cross-device / cross-version restore beyond format version 1 is untested. Conflicts are reported, never resolved. No REPLACE mode, no App-local restore, no learner id, no IndexedDB, no auto-cleanup (all out of scope by design).
- Chromium-only automated coverage.

## 12. Next phase

`LEARNING-RECORD-STORAGE-BACKUP-RESTORE-SAFARI-IPAD-GATE-1` (real device: Safari, Home Screen/PWA, Files picker, VoiceOver, portrait/landscape, large JSON, quota failure). Then the Production release phase.
