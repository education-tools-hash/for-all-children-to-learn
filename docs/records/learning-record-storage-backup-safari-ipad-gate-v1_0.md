# Full Backup Export — Safari / iPad Real-Device Verification Gate v1.0

**Phase:** `LEARNING-RECORD-STORAGE-BACKUP-SAFARI-IPAD-GATE-1`.
**Status: `USER APPROVED / PASS`.** iPad real-device User Device Review is complete: Environment A (Safari Normal) data completeness for all 4 target apps, VoiceOver, Portrait, Landscape, and Home Screen/PWA are all reported PASS by the user (§5). Private Browsing was not tested (optional reference only). Results are the user's on-device report, recorded as given; the exact test date and iPad model / iPadOS / Safari versions were not supplied and are left blank rather than guessed.
**Approved base:** `origin/main` = `ee7c0f13c7504cdd15429002227ae2ad640211c6` (re-verified, no drift). Backup Hardening approved diff (`assets/js/record-dashboard-foundation.js`, `learning-records.html`, `tools/record-dashboard-poc/golden-tests.js`, `tools/record-dashboard-poc/backup-hardening-golden-tests.js`, `docs/records/learning-record-storage-backup-hardening-v1_0.md`) is **unmodified** by this phase — confirmed by re-diffing against the previously-approved state before starting (§3 below).

This gate exists because Claude Code cannot operate a physical iPad directly. It hands you a real, end-to-end procedure against the **actual, unmodified, approved implementation** (not a reimplementation) — you seed synthetic fixtures with one helper page, then operate the real "学習の記録" screen exactly as a user would.

---

## 0. What this tests, and why it's the real implementation, not a mock

The only new file this phase adds is `tools/storage-backup-safari-ipad-gate/seed.html` — a fixture-seeder with **no backup logic of its own**. It writes one synthetic record each into `nazori_records`/`hiragana_log`/`katakana_log`/`sawatte_hirogaru_log` (the actual storage keys, but with synthetic content — no real learner data), then links you to the real `learning-records.html` in this same worktree. Every button you press after that point — "完全バックアップを書き出す", the CSV buttons, everything — is the exact code pending your approval for Production release. This was verified in this environment first (§2) before being handed to you.

---

## 1. Safety rules

- **Never open either page on `donomana.jp`.** Both `seed.html` and this worktree's `learning-records.html` refuse to run there (checked in `seed.html`'s own code; `learning-records.html` itself has no such guard since it's the real Production file, but you are opening it from this worktree's LAN server, not from the real site — do not navigate to the real donomana.jp during this test).
- Only 4 storage keys are ever touched by the seeder: `nazori_records`, `hiragana_log`, `katakana_log`, `sawatte_hirogaru_log`. `localStorage.clear()` is never called anywhere in the seeder.
- No restore, no auto-cleanup, no IndexedDB — none of that exists in this worktree; nothing to accidentally trigger.
- If anything feels risky or unclear, stop and ask.

---

## 2. Local re-verification (completed in this environment before handing off to you)

- Backup Hardening approved diff: **unchanged** (re-diffed against the prior approval — identical).
- Existing regression: **1406/1406 PASS**. Save Safety: **41/41 PASS**. Load-smoke: **44/44 PASS**. Backup Node tests: **43/43 PASS**. Backup browser E2E: **21/21 PASS**.
- New seed-page + real-UI smoke test (Chromium, via the actual `seed.html` → real `learning-records.html` → real download flow): **18/18 PASS**, including a real canvas-drawn PNG (not a placeholder string) round-tripping correctly into a downloaded backup file, and Sawatte's `trimmed`/`pointLimit`/`traceSchemaVersion` fields (dropped by the existing Trace CSV) confirmed present in the downloaded JSON.

---

## 3. LAN test environment (already running)

```
python -m http.server 8971 --bind 0.0.0.0
```
run from the root of this worktree (`for-all-children-to-learn-storage-backup-hardening-1`).

**This machine's current LAN IP is `192.168.0.7`**, confirmed reachable just now (`HTTP 200`). On your iPad, connected to the same Wi-Fi, open Safari and go to:

```
http://192.168.0.7:8971/tools/storage-backup-safari-ipad-gate/seed.html
```

If this stops working, the IP may have changed — re-check with `ipconfig` (Windows) and substitute it. Keep the terminal running the server open for the whole session.

---

## 4. Procedure

### Device info (record once)
`Device model / iPadOS version / Safari version / test date / network` — from Settings and the page itself.

### Environment A — Safari Normal Browsing

1. Open the seeder URL (§3). Confirm the warning box does **not** say "donomana.jp".
2. Tap "④つのsynthetic fixtureを作成する". Confirm the log shows all 4 keys created.
3. Tap "学習の記録を開く →". You should now be on the real `learning-records.html`, on this worktree's server — confirm the URL bar still shows `192.168.0.7:8971`, not donomana.jp.
4. Find the Nazori card ("なぞり書き練習ツール") and open it.
5. Confirm you see **both** the existing CSV button and the new "💾 完全バックアップを書き出す（画像・軌跡を含む）" button, plus the hint text about CSV not including images/traces.
6. Tap the Full Backup button. Observe what Safari does — a direct download, or a Share Sheet ("ファイルに保存" etc.). Either is acceptable (§38 of the phase spec — Safari's own UX choice here is not a bug).
7. Save the file (to Files app, iCloud Drive, or wherever Safari offers). Note the filename.
8. Open the saved file (Files app → tap it, or Share → an app that can show JSON/text). Confirm it's readable text, not garbled binary, and looks like valid JSON.
9. Repeat steps 4-8 for **Katakana** ("カタカナ まなぼう！") and **ひらがな** ("ひらがな まなぼう！") — check both individually, even though they share the same underlying code. Confirm each downloaded file's `records[0].data.traceSample.strokes` looks like nested arrays of numbers (2 stroke arrays each, per the seeded fixture).
10. Repeat for **さわってひろがる**. Confirm the downloaded file's `records[0].payload.trace` object contains `trimmed`, `pointLimit`, and `traceSchemaVersion` fields (these are the fields the existing 🖊 軌跡CSV does **not** include — this is the specific gap this feature closes).
11. Go back to the record list (or reopen any card) and confirm all 4 records are still there, unchanged, after all 4 backups were downloaded (Full Backup must be read-only).

### Environment B — Home Screen / PWA

1. From a normal Safari tab on the seeder URL, Share → "Add to Home Screen".
2. Launch from the Home Screen icon (not Safari).
3. Repeat step 2 of Environment A (seed fixtures) from within this standalone app.
4. Navigate to "学習の記録を開く" from within the standalone app and repeat steps 4-11 of Environment A.
5. Note anything different about the download/share behavior compared to normal Safari.

### Environment C — Private Browsing (reference only, per phase spec §25)

1. Open a new Private Browsing tab, go to the seeder URL, seed fixtures, open "学習の記録", and try one Full Backup (e.g. Nazori).
2. Record whether the action works and produces a valid file. Storage persistence in Private mode is **not** the focus here — only whether the export mechanism itself functions.

### Accessibility check

1. Turn on VoiceOver (Settings → Accessibility → VoiceOver).
2. Navigate to a record's Detail view. Swipe through the CSV button and the Full Backup button.
3. Confirm VoiceOver announces something that distinguishes the two (e.g. reads the actual button label including "完全バックアップ", not just "ボタン"), and that the hint text (if VoiceOver reaches it) is readable.
4. Confirm focus doesn't jump anywhere unexpected after tapping the Full Backup button.

### Mobile layout check

1. In portrait, open a Detail modal with the Full Backup button. Confirm the button and hint text aren't cut off, and the modal doesn't need horizontal scrolling.
2. Rotate to landscape. Confirm the same, and that the button remains tappable.

### High-case check (optional but recommended)

The seeder only creates 1 record per app. If you want to test a larger backup on the real device, you can repeat "④つのsynthetic fixtureを作成する" multiple times before navigating away — each click **appends** a new record with a fresh real canvas-drawn image rather than replacing the existing one... actually note: as shipped, each seed click **overwrites** with exactly 1 fresh record per app (simplest, safest default for this gate). If you want to manually test a larger backup, you can use Safari's own address bar to run `javascript:` is disabled by default and not recommended — simplest is to just note the single-record backup file size you observe, which is still meaningful real-device evidence (§29-30 of the phase spec are about not freezing/crashing on larger data, and the single-record case already exercises the exact same code path).

---

## 5. Real-device results (as reported by the user; recorded exactly as given, nothing upgraded to PASS without a report)

### Environment A — iPadOS Safari, Normal Browsing — **data completeness: CONFIRMED**

| Check | Nazori | Hiragana | Katakana | Sawatte Hirogaru |
|---|---|---|---|---|
| JSON file generated | PASS | PASS | PASS | PASS |
| File opens (Files app etc.) | PASS | not separately reported | not separately reported | not separately reported |
| `backupFormatVersion` | 1 | 1 | 1 | 1 |
| `appId` | `nazori-app` | `hiragana-learn` | `katakana-app` | `sawatte-hirogaru-app` |
| `storageKey` | `nazori_records` | `hiragana_log` | `katakana_log` | `sawatte_hirogaru_log` |
| `recordCount` | 1 | 1 | 1 | 1 |
| L3 payload present in file | PNG Data URL (`data:image/png;base64,...`) confirmed in the actual downloaded file | `data.traceSample` present, `version:1`, `coordinateSpace:'normalized-1000'`, multiple strokes, point arrays intact | same as Hiragana (shared code, independently confirmed) | `payload.trace` present, `taps` and `swipes` both present |
| Fields the existing CSV drops, confirmed present in Full Backup | n/a (Nazori CSV never had trace fields to compare against) | n/a | n/a | **`traceSchemaVersion:1`, `pointLimit:1000`, `trimmed:false`** — confirmed present in the real file, closing exactly the gap this feature was built for |
| Filename privacy | confirmed no learner-identifying info | not separately reported | not separately reported | not separately reported |
| JSON parses / file size non-zero | PASS | PASS | PASS | PASS |

**Judgment: NAZORI / HIRAGANA / KATAKANA / SAWATTE FULL BACKUP = PASS** (Environment A, data-completeness dimension only — this is the core, highest-risk claim this whole phase exists to prove, and it now has real-device evidence, not just Node/Chromium evidence).

### Additional per-app detail reported for the final review

- **Nazori:** file opened from Files (PASS); file size non-zero; filename has no learner-identifying info; record metadata preserved; JSON parses.
- **Hiragana / Katakana:** `data.traceSample` preserved with `version:1`, `coordinateSpace:'normalized-1000'`, multiple strokes, point arrays, and `schemaVersion` intact.
- **Sawatte Hirogaru:** `payload.trace` preserved with `traceSchemaVersion:1`, `pointLimit:1000`, `trimmed:false`, plus `taps` and `swipes`. These three fields are lost by the existing Trace CSV and are retained by Full Backup, confirmed in the real downloaded JSON.

### Accessibility / layout / PWA — all PASS

| Check | Result |
|---|---|
| VoiceOver | **PASS** — no problems reported |
| Portrait layout | **PASS** — no problems reported |
| Landscape layout | **PASS** — no problems reported |
| Home Screen / PWA | **PASS** — Full Backup executed from the PWA; JSON saved and opened |
| Private Browsing (optional reference) | **NOT TESTED / OPTIONAL REFERENCE** — not required for PASS |

Backup file size(s) observed: non-zero for all four (exact byte sizes not reported).
Test date / iPad model / iPadOS version / Safari version: not reported.

### 5.1 Open limitations (not verified; NOT marked PASS)

- Other iPad models, other iPadOS versions, other Safari versions (no generalization from the single device tested)
- Extremely large (multi-MB) backups
- OS low-storage condition
- Long-term retention of saved files in Files
- Restore, malformed-backup import, cross-device restore (none of these exist in this release)
- Checksum verification (no checksum is emitted)
- Private Browsing
- Hiragana / Katakana / Sawatte "open from Files" was not reported as a separate step (Nazori and the PWA run were)

---

## 6. Judgment criteria (for the next turn, once §5 is filled in)

- **PASS**: Safari Normal — Full Backup runs, produces a valid, readable JSON file with the correct app's media/trace data present for all 4 apps, filename has no learner-identifying info, existing records unchanged, VoiceOver and portrait/landscape both fine.
- **CONDITIONAL PASS**: Safari-specific UX differences (Share Sheet instead of direct download, simpler file preview, Private Browsing quirks) as long as data completeness and file integrity hold.
- **FAIL (blocking)**: no file produced, a 0-byte file, unparseable JSON, missing PNG/trace data, `recordCount` mismatch, a learner name in the filename, records disappearing after export, a "success" appearance with no actual file, PWA-only export failure, VoiceOver making the button's purpose unclear, or severe mobile clipping.

---

## 7. Final judgment

`LEARNING-RECORD-STORAGE-BACKUP-SAFARI-IPAD-GATE-1` = **USER APPROVED / PASS**.

Production readiness: **READY FOR `LEARNING-RECORD-STORAGE-BACKUP-HARDENING-1-PRODUCTION-RELEASE-1`.**

The approved Backup Hardening diff was not modified by this gate; the only additions are this document and the non-Production fixture seeder `tools/storage-backup-safari-ipad-gate/seed.html`. The seeder is not part of the Production release scope.
