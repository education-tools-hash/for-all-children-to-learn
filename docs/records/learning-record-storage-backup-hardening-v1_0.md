# Learning Record Storage — L3 Backup / Export Hardening v1.0

**Phase:** `LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1` — Audit + Design + Minimal Safe Implementation + Export/Backup Verification.
**Baseline:** `origin/main` = `ee7c0f13c7504cdd15429002227ae2ad640211c6` (re-verified, no drift). Worktree `for-all-children-to-learn-storage-backup-hardening-1`, branch `fix/learning-record-storage-backup-hardening-1`.
**Production impact: NONE yet.** All work is in this worktree only. Nothing committed, pushed, merged, or deployed.

---

## 1. Definitions used throughout this document (per the phase spec §6)

| Term | Meaning |
|---|---|
| **Summary Export** | Human-readable summary of what happened (date, learner activity, result, duration, mode). |
| **Detail Export** | The existing per-app CSV(s) — more granular than Summary, still human-readable, still a *view*, not a lossless copy. |
| **Full Backup** | The record **as persisted**, losing nothing, wrapped in a small versioned envelope. Not human-readable by design (it is a machine format). |
| **Restore-capable Backup** | A Full Backup whose format is provably parseable back into the original record shape (verified in this phase via Node round-trip tests) — **not** the same as having a Restore UI, which this phase does not build (see §9). |

**CSV is not a Full Backup.** This was the core misconception this phase exists to close (phase spec §9/§51).

---

## 2. Root Investigation — actual record schema per app (re-verified from current code, not assumed)

### Nazori (`nazori-app`, storageKey `nazori_records`)
Two independent entry shapes, confirmed from `nazori-app.html`'s `logDoneAction()`/`logSessionComplete()` and documented in `assets/js/nazori-record-detail.js`'s header comment:
- **`wide` mode** (1 click = 1 entry): `{id, sessionId, timestamp, mode:'wide', allChars, charCount, sessionDone, sessionTotal, image}` — `image` is a single `data:image/png;base64,...` Data URL of the merged guide+drawing canvas.
- **`single` mode, session-complete**: `{id, sessionId, timestamp, mode:'single', isComplete:true, allChars, charCount, sessionDone, sessionTotal, startTime, durationMin, charImages:[{char, image}, ...]}` — one Data URL **per character** practiced in that session.

### Hiragana / Katakana (`hiragana-learn`/`katakana-app`, storageKey `hiragana_log`/`katakana_log`, byte-identical schema in both apps)
`{time, type:'trace'|'quiz'|'match', data, schemaVersion}`. Only `type:'trace'` carries stroke data: `data:{kana, tracingJudgmentLevel, traceSample:{version:1, coordinateSpace:'normalized-1000', strokes:[[48 quantized ints per stroke],...]}}` (confirmed against `hiragana-learn.html`'s `buildTraceSample()`).

### Sawatte Hirogaru (`sawatte-hirogaru-app`, storageKey `sawatte_hirogaru_log`)
`{timestamp, appId, activity, inputMethod, schemaVersion, payload}` where `payload.trace` (present only if trace capture was enabled and produced ≥1 point) = `{traceSchemaVersion:1, pointLimit:1000, trimmed:boolean, taps:[x,y,t,...], swipes:[[x,y,t,...],...]}` (confirmed against `sawatte-hirogaru-app.html`'s `finalizeSession()`).

---

## 3. Current Export Completeness Matrix (verified from `assets/js/*-record-detail.js` and `record-dashboard-foundation.js`)

| Field | Summary CSV | Detail CSV | Trace CSV | Image export | Full Backup (this phase) | Restore |
|---|---|---|---|---|---|---|
| **Nazori** — metadata (date, chars practiced, mode, session progress, duration) | — | ✅ (7 cols, `buildDetailCsvRows`) | n/a | n/a | ✅ | via JSON parse (no UI) |
| **Nazori** — `image` / `charImages` (PNG Data URL) | — | ❌ **never included** | n/a | ❌ **no export path exists at all** — only ever rendered inline via `<img>` | ✅ **now included, verbatim** | via JSON parse (no UI) |
| **Hiragana/Katakana** — metadata (kana, level, quiz answer) | — | ✅ (7 cols, `buildDetailCsvRows`) | n/a | n/a | ✅ | via JSON parse (no UI) |
| **Hiragana/Katakana** — `traceSample` (stroke points) | — | ❌ **never included** | n/a | n/a (canvas-only, not a raster asset) | ✅ **now included, verbatim** | via JSON parse (no UI) |
| **Sawatte** — summary metadata (mode, duration, tap/swipe counts, settings) | ✅ (14 cols, `buildSummaryCsvRows`) | n/a | ✅ (flag column only: "軌跡記録あり/なし") | n/a | ✅ | via JSON parse (no UI) |
| **Sawatte** — `trace.taps`/`trace.swipes` (point coordinates + elapsed ms) | — | n/a | ✅ **already exists**, `buildTraceCsvRows`, one row per point, X/Y/elapsedMs at full precision | n/a | ✅ **now also included** | via JSON parse (no UI); Trace CSV itself is not restore-capable without a bespoke parser |
| **Sawatte** — `trace.trimmed` / `trace.pointLimit` / `trace.traceSchemaVersion` | — | n/a | ❌ **not encoded in the existing Trace CSV** (genuine gap found by this audit) | n/a | ✅ **now included** | via JSON parse (no UI) |

**Critical gaps this phase closes:** Nazori images and Hiragana/Katakana stroke traces had **zero** export path of any kind before this phase — not "incomplete," **absent**. Sawatte's existing Trace CSV is unusually good (point-level, full precision) but silently drops 3 session-level trace metadata fields.

---

## 4. UI wording audit (phase spec §9/§18)

Existing button text, read directly from the HTML (not paraphrased):
- `nazori-app.html`: "📥 CSVで書き出し"
- `hiragana-learn.html` / `katakana-app.html`: "⬇️ CSVダウンロード"
- `sawatte-hirogaru-app.html`: "📄 きろくをCSVで保存" / "🖊 軌跡CSVを保存"
- `learning-records.html` (Common, per-app CSV actions): labels sourced from each adapter's `getCsvActions()`, e.g. "📄 なぞり書き記録をCSVで保存"

**None of these mention that images/traces are excluded.** No existing "バックアップ" (backup) terminology exists anywhere in the codebase — a clean slate, no naming collision risk. This phase adds, in the Common Detail modal only (see §7 for why App-local pages were not touched), a new button "💾 完全バックアップを書き出す（画像・軌跡を含む）" directly below the existing CSV button(s), plus one line of hint text: "CSVには画像・なぞった線・軌跡データは含まれません。それらも保存したい場合は完全バックアップをご利用ください。" — chosen to inform without alarming (phase spec §18: "不要に不安を煽らない").

---

## 5. Chosen Backup Architecture

- **Format: JSON.** Confirmed appropriate for this codebase (not decided by default): every record here is already a plain JSON-serializable object in `localStorage`; no binary data exists outside Data URLs, which are themselves just strings. JSON requires no new dependency, preserves nesting exactly, and is the format every other `docs/records/data/*.json` artifact in this repo already uses.
- **Media handling (Nazori PNG):** **Option A — embed the Data URL string as-is inside the JSON.** Evaluated against B (separate image files + metadata JSON) and C (ZIP container): both add real implementation complexity (multi-file download coordination or a new ZIP dependency) for a benefit (smaller download, "native" image files) that does not materially change safety or correctness. Per the phase's explicit instruction ("今回いきなりZIP等を導入しない"), Option A is the minimal-safe choice. iPad Safari download/share behavior for a single `.json` file (vs. a `.zip`) is also simpler to reason about and matches the existing CSV download mechanism's proven pattern (`Blob` + `URL.createObjectURL` + a synthetic `<a download>` click).
- **Trace handling (Hiragana/Katakana strokes, Sawatte taps/swipes):** kept in their exact original nested shape — no flattening, no re-encoding. This is what makes losslessness trivial to prove (§8).
- **Versioning:** `backupFormatVersion: 1` at the top level (not per-record — records already carry their own `schemaVersion`). This is the field a future restore/migration path would branch on.

### Envelope shape (implemented exactly as follows)

```json
{
  "backupFormatVersion": 1,
  "exportedAt": "2026-09-18T12:34:56.789Z",
  "appId": "nazori-app",
  "appName": "なぞり書き練習ツール",
  "storageKey": "nazori_records",
  "recordCount": 3,
  "records": [ /* the exact raw record array, unmodified */ ]
}
```

No checksum, no per-record media-included flags, no source-app version string — evaluated and deliberately left out per the phase's explicit "ただし複雑化しすぎない" (§11) instruction; `recordCount` already gives a cheap integrity signal (does it match `records.length` after parsing), and a checksum adds a verification step with no corresponding action anyone would take differently based on its result at this phase's scope.

---

## 6. Implementation — Changed Files

| File | Change |
|---|---|
| `assets/js/record-dashboard-foundation.js` | Added `getBackupAction(appId)` (public API, opt-in passthrough — mirrors the existing `getCsvActions(appId)` pattern exactly). Added `supportsFullBackup: true` to exactly 4 adapters: `nazori-app`, `sawatte-hirogaru-app`, and inside `makeKanaAdapter()` (covers both `hiragana-learn` and `katakana-app`). All other 18 adapters unchanged — `getBackupAction()` returns `null` for them. |
| `learning-records.html` | Added `downloadCommonAppBackup()` (JSON `Blob` download, parallel to the existing `downloadCommonAppCsv()`). Extended `openDetailModal()` to render one backup button + hint text, only when `FOUNDATION.getBackupAction(record.appId)` is non-null. |
| `tools/record-dashboard-poc/golden-tests.js` | Updated the pre-existing "public API surface is exactly N documented functions" assertion from 8 to 9 (a real, deliberate API addition, not a regression — see §8). |
| `tools/record-dashboard-poc/backup-hardening-golden-tests.js` (new) | 43 Node-only tests: opt-in scoping, envelope shape, round-trip losslessness (×3 apps), malformed/empty-storage safety, high-case performance. |
| `docs/records/learning-record-storage-backup-hardening-v1_0.md` (this file) | New. |

**Not changed:** any of the 22 App-local HTML pages' own CSV buttons/handlers, any storage key, any record schema, `generate.js` (confirmed uninvolved — see §7), any CSV builder function (`buildDetailCsvRows`/`buildSummaryCsvRows`/`buildTraceCsvRows` are all byte-identical to before).

**Scope decision — Common UI only, not App-local:** `record-dashboard-foundation.js` is loaded exclusively by `learning-records.html` (confirmed: `grep -l "record-dashboard-foundation.js" *.html` returns exactly one file). The 22 App-local pages have their own independent CSV logic via their `*-record-detail.js` shared modules and do not load the Foundation file at all. Adding App-local backup buttons would require either a second implementation path or restructuring which files each app loads — both larger changes than this phase's "minimal safe implementation" scope calls for. The Common "学習の記録" screen was the explicit example given in the phase spec (§35), and is where this feature now lives. Adding matching App-local buttons is a clean, low-risk candidate for a fast-follow (see §12).

---

## 7. Generator/Template Gate (mandatory per the prior phase's established rule)

- **Files touched, checked against `generate.js`:** neither `assets/js/record-dashboard-foundation.js` nor `learning-records.html` is referenced anywhere in `generate.js` (`grep -n "record-dashboard-foundation" generate.js` → 0 matches; `learning-records.html` is not in `LEARNING_RECORD_FOUNDATION_APPS`, the only Set that gates the auto-injection mechanism found last phase). **Source of Truth for these two files is the files themselves.**
- `node generate.js` was run twice after all edits: **zero diff beyond the files this phase intentionally changed**, and the second run produced **zero additional changes** (idempotent). No reversion risk, unlike the Save Safety phase's discovery.

---

## 8. Backup Completeness / Round-trip Verification

All 43 checks in `tools/record-dashboard-poc/backup-hardening-golden-tests.js` pass (Node-only, no browser needed — this is where the actual lossless-ness claim is proven, not just asserted):
- Nazori: 1-image, multi-image (`charImages`), no-image (`image:null`), and large-image fixtures all survive `buildBackup()` → `JSON.stringify()` → `JSON.parse()` with `assert.deepStrictEqual` against the original fixture.
- Hiragana/Katakana: 1-stroke, 4-stroke, and 6-stroke `traceSample`s, plus a non-trace (`quiz`) record with no `traceSample` field at all, all round-trip exactly, including stroke order.
- Sawatte: short trace (taps only), long trace (taps+swipes near the 1000-point hard cap), and a record with **no** `trace` field at all (trace capture disabled) all round-trip exactly — critically, `trimmed`/`pointLimit`/`traceSchemaVersion` (the 3 fields the existing Trace CSV silently drops) are confirmed present and correct after round-trip.
- Malformed entries (`null`, a string, a number, an unrelated object) mixed into a records array do not crash `buildBackup()` — Full Backup is a raw passthrough, not a validator; validity is deliberately left as a restore-time concern (§9), consistent with "don't complicate this phase with validation logic that has no restore path to feed yet."
- Empty storage (`[]` or `null`) produces a well-formed, valid, zero-record envelope, not an error.
- `buildBackup()` never calls `setItem`/`removeItem`/`clear` — confirmed both by the existing golden-tests.js source-scan checks (§16 of that suite, which already scans the whole file) and by a dedicated before/after storage-untouched check in the new suite.

Real-browser confirmation (Playwright, 21/21 pass): the button appears only for the 4 target apps (confirmed absent for `janken-app` and `tokei-app`, with `tokei-app`'s pre-existing CSV button confirmed still present/unaffected), a real file download occurs with the correct suggested filename (`nazori-app-full-backup-YYYYMMDD_HHMM.json` — no learner name, matching §20 of the phase spec), and the downloaded file's JSON content contains the actual image Data URL / stroke points / trace taps, not a placeholder.

---

## 9. Restore — explicit classification (phase spec §43)

**RESTORE IMPLEMENTATION: DEFER.**

Reasoning: this phase verified the Full Backup format is *restore-capable* in the narrow, provable sense the phase spec asks for — the JSON round-trips losslessly through `JSON.parse()`, which is the entire technical precondition for a restore path to exist at all. It did **not** build a Restore UI, because doing so immediately requires deciding, none of which this phase's scope covers and all of which the phase spec's own §16 flags as requiring a separate phase:
- **Overwrite vs. merge policy** — does restoring replace the current `nazori_records` entirely, or merge with what's already there?
- **Duplicate detection** — if the same backup is restored twice, or a backup is restored onto a device that already has some overlapping records, how are duplicates identified (no record has a globally-unique ID today — `id`/`sessionId` are locally generated and not guaranteed unique across devices)?
- **Malformed/corrupted backup recovery** — what happens with a backup file edited by hand, from a future format version, or truncated mid-download?
- **Privacy on shared devices** — restoring a backup onto a *different* child's session/device is a real risk specific to this site's shared-classroom-device context (audit `learning-record-storage-capacity-audit-v1_0.md` §13).

None of these are "implementation details" — each is a genuine design decision with real data-loss or privacy consequences if gotten wrong, which is exactly the bar the phase spec's own Stop Conditions (§16/§46) set for spinning out a dedicated phase. Recommended next phase name (if pursued): `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-DESIGN-1`.

---

## 10. Privacy (phase spec §19-20)

- **Filename:** `<appId>-full-backup-<timestamp>.json` — no learner name, no free-text content, matching the existing CSV download filenames' convention (`nazori-gakushu-kiroku-...`, no name either).
- **File content:** for the 4 apps in this phase's scope, none of Nazori/Hiragana/Katakana/Sawatte's schemas store a learner name field (re-confirmed in §2) — `allChars` (Nazori) is free-text-capable (could contain a name if a child types one) but this is an existing, unchanged privacy characteristic already governing the CSV export today, not something Full Backup introduces or worsens. `kyou-no-kiroku` (which *does* store child names/medical notes) is explicitly **not** in this phase's `supportsFullBackup` scope.
- **Shared-device consideration:** unchanged from the existing CSV behavior — anyone with access to the device's browser can already export CSVs for any child whose records are on that device; Full Backup does not change who can access what, only how completely. This is a pre-existing site characteristic (no per-child storage isolation, per the capacity audit) that Backup Hardening neither fixes nor worsens.

---

## 11. Tests — final numbers

| Suite | Result |
|---|---|
| Existing regression (12 suites) | **1406/1406 PASS** (golden-tests.js's public-API-surface assertion updated from 8→9 functions, a deliberate, documented change — see §6) |
| Save Safety E2E + accessibility/mobile | **41/41 PASS** |
| Static load-smoke (22 apps) | **44/44 PASS** |
| Backup Hardening golden tests (new, Node) | **43/43 PASS** |
| Backup Hardening E2E (new, real Chromium) | **21/21 PASS** |
| Generator idempotency | 2 runs, 0 diff beyond intended changes, 2nd run = 0 additional changes |
| `git diff --check` | clean |

High-case measurement (§40 of the phase spec): 60 synthetic Nazori records with 300×300 synthetic images → backup generation + `JSON.stringify` completed in 43ms, producing a ~6.9MB file (this uses an uncompressed synthetic fixture generator, not a real PNG encoder, so it is a conservative/larger-than-realistic estimate — the prior audit's real-browser measurement was ~15.6KB for a single realistic single-cell image, meaning 60 realistic records would be closer to ~1MB, not 6.9MB).

---

## 12. Known Limitations

- **App-local backup buttons not added** (§6 scope decision) — only the Common "学習の記録" screen offers Full Backup this phase.
- **Restore UI not built** (§9) — deferred to a future, separately-scoped phase.
- **iPad/Safari real-device Gate not run for this feature** — per the phase spec §33, required *before* Production release of this feature, not before reaching `USER REVIEW READY`. Not yet performed.
- **`ongaku-compositions`, `register_img_<id>`, `tt_recordings`** (flagged in the original capacity audit as out-of-Record-Foundation storage vectors) remain untouched and out of scope.
- **No checksum/integrity field** in the backup envelope (deliberate, §5).
- Sawatte's existing Trace CSV gap (missing `trimmed`/`pointLimit`/`traceSchemaVersion`) is **not** fixed in the CSV itself — Full Backup is additive, not a CSV bugfix; fixing the CSV was out of this phase's scope (§34: "既存CSVは壊さない" was read as "and not modified" absent an explicit instruction to add columns).

---

## 13. Future IndexedDB / Retention considerations (phase spec §44-45)

- The backup envelope's `records` field is just "whatever the adapter's raw storage array currently contains" — it has no `localStorage`-specific structure baked in (no key-length assumptions, no string-only assumption beyond what JSON itself requires). A future IndexedDB migration would not need to change this envelope shape, only how `rawRecords` is obtained before being passed to `buildBackup()`.
- A future Retention/auto-cleanup phase (LEARNING-RECORD-STORAGE-RETENTION-SAFETY-1, not started) could reasonably require "has this record been backed up" as a precondition for cleanup eligibility — this phase's envelope does not currently track that (no per-record backup timestamp), which would need to be added deliberately if that design direction is chosen. Recorded here as a forward-compatibility note, not implemented.
