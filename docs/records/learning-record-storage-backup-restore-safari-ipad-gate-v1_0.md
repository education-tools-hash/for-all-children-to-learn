# Full Backup Restore — Safari / iPad Real-Device Gate v1.0

**Phase:** `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-SAFARI-IPAD-GATE-1`
**Status: `PENDING USER DEVICE REVIEW`.** Preparation is complete and rehearsed on a PC; **no real-device result has been recorded yet.** Nothing below marked PENDING is a pass. Nothing has been committed for this phase, pushed, merged or deployed; Production code is unchanged.

## 1. Baseline

| Item | Value |
|---|---|
| Production `origin/main` | `e4c0ecb4f8bf5c74ce1f9df25b5ebb5111e15668` (no drift at start) |
| Restore Implementation checkpoint | `e89d3b6` (impl worktree) → `c3a0fbf` (cherry-picked into the Gate worktree) |
| E2E Hardening checkpoint (prerequisite) | `bf1237d` → `e9f2c98` (cherry-picked) |
| Gate worktree | `for-all-children-to-learn-backup-restore-safari-ipad-gate-1` |
| Gate branch | `test/learning-record-backup-restore-safari-ipad-gate-1` |
| Gate worktree tree vs. approved checkpoint | identical (`git diff e89d3b6 HEAD` is empty) — the iPad exercises exactly the approved implementation |

Pre-checkpoint formal rerun (all as expected): Node 1741 (existing 1407 + Backup 43 + Restore 291), Backup browser 72/72, Save Safety 41/41, load-smoke 44/44, dashboard-realbrowser 49/49, Restore browser 147/147. `generate.js` run twice: no change, second run identical. Foundation contract re-verified: `.setItem(`/`.removeItem(` only inside `executeBackupRestore()`, no `.clear()`, public API = 12 functions.

## 2. Device and environment (to be filled from the user's report; nothing is guessed)

| Item | Value |
|---|---|
| iPad model | NOT RECORDED |
| iPadOS version | NOT RECORDED |
| Safari version | NOT RECORDED |
| Test date | NOT RECORDED |
| Network / origin | LAN `http://<PC-IP>:8980` (plain http). Synthetic data only. |

Note: over plain `http://` on a LAN IP the Service Worker does not register (insecure context), so **offline behaviour is not part of this gate**; only Restore is.

## 3. Gate tooling (repo-local, not Production; not committed until you approve)

`tools/storage-backup-restore-safari-ipad-gate/`

| File | Purpose |
|---|---|
| `serve.py` | Builds the test files, then serves this worktree read-only on the LAN (`0.0.0.0`, first free port from 8980). Allow-list only (assets the page needs, the hub page, the generated files); no directory listing, no dotfiles/`.git`, no `docs/`, no other tools, GET/HEAD only. Test files are served as downloads. |
| `build-test-backups.js` | Produces the 11 synthetic backups with the **real Production export code** (`getBackupAction().buildBackup()`, serialised like the page's own download). Self-checks every file against the real `planBackupRestore()`. Output is written to a temp directory, never into the repo. |
| `index.html` | The hub page opened on the iPad: shows the state of the 4 keys (read-only), lists the download links, and offers three preparation buttons (below). Refuses to run on `donomana.jp`. Contains no Restore logic. |
| `rehearse-gate.py` | PC dress rehearsal of the whole procedure (Chromium): 57/57 PASS. Not a substitute for the device. |

Hub preparation buttons — **no `localStorage.clear()`**: (1) put one synthetic *existing* Nazori record (only if empty); (2) append one Nazori record (for the stale test; adds only); (3) remove the four Gate keys one by one, with a confirmation (reset). Only `nazori_records`, `hiragana_log`, `katakana_log`, `sawatte_hirogaru_log` are ever touched; `gate_injected_key` is only *read* to prove nothing wrote to it.

## 4. Test files (synthetic: no names, no school, no personal data)

Records in the valid files are dated **40 days ago** so they fall outside the dashboard's default 7-day window (Case T).

| File | Bytes | Expected on the iPad |
|---|---|---|
| `01-nazori-valid.json` | 2,053 | Adds 2 records (red image, blue image) |
| `02-hiragana-valid.json` | 1,134 | Adds 1 record (「あ」, 2 strokes) |
| `03-katakana-valid.json` | 1,084 | Adds 1 record (「ア」, 3 strokes) |
| `04-sawatte-valid.json` | 1,432 | Adds 1 record (trace: v1, pointLimit 1000, trimmed false, 3 taps, 2 swipes) |
| *(05 intentionally absent)* | | Duplicate test = restore **01** a second time |
| `06-nazori-conflict.json` | 1,806 | After 01: 1 conflict (not restored) + 1 new (green image) |
| `07-wrong-app.json` | 445 | Rejected (janken-app) |
| `08-wrong-key.json` | 2,056 | Rejected (storageKey `gate_injected_key`); nothing written to that key |
| `09-unsupported-version.json` | 2,053 | Rejected, "新しいバージョンで作成" |
| `10-malformed.json` | 1,238 | Rejected (truncated JSON) |
| `11-warn-3mb.json` | 3,624,740 (3.46 MB) | "ファイルが大きい" warning, preview reachable; 40 Nazori records |
| `12-reject-10mb.json` | 10,489,961 (10.0 MB) | Rejected on size alone, before any parsing |

## 5. Device cases (all PENDING)

Sequence used with the person, 1–3 actions at a time. Result column is filled only from the user's report.

| # | Case | Expected | Result |
|---|---|---|---|
| A | Safari Normal, empty state | "まだ学習のきろくはありません" AND 「バックアップから復元」 visible | PENDING |
| B | Files picker | Button opens Files; `.json` selectable; Cancel changes nothing | PENDING |
| S | Existing record protection | 1 existing record before Restore is unchanged after | PENDING |
| C | Nazori restore | Preview (app, count, date range, size, learner warning) → confirm → summary; PNGs intact | PENDING |
| D | Hiragana restore | strokes intact, no duplicate | PENDING |
| E | Katakana restore | same | PENDING |
| F | Sawatte restore | traceSchemaVersion, pointLimit, trimmed, taps, swipes intact | PENDING |
| G | Duplicate (01 again) | "追加できる記録はありません", counts unchanged | PENDING |
| H | Conflict (06) | 1 conflict not written; the other record restored; existing not overwritten | **FUNCTIONAL CONFLICT DETECTION APPEARS CORRECT / CONFLICT COUNT UI MISSING / INVESTIGATION REQUIRED.** First report (2 new / 0 conflict / final 3) was an unmet prerequisite (§12). Re-check: the conflict row appeared but its count was not visible (§13). 「復元する」 not pressed. Implementation UI defect; Fix phase proposed. |
| I | Wrong app (07) | Rejected, storage unchanged | PENDING |
| J | Wrong storageKey (08) | Rejected; `gate_injected_key` stays unwritten | PENDING |
| K | Unsupported version (09) | Rejected, non-technical message | PENDING |
| L | Malformed (10) | Rejected, no crash | PENDING |
| M | 3 MB warning (11) | Warning shown; preview reachable; observe freeze/crash | PENDING |
| N | 10 MB reject (12) | Rejected before parsing; no preview; no crash | PENDING |
| T | Filter visibility | Period switches to 「すべて」; 40-day-old records visible | PENDING |
| Q | Stale preview (2 tabs) | Confirm after the other tab changed storage → aborted | PENDING (optional on device) |
| U | VoiceOver | Labels, focus order, dialog entry, status/alert, focus return | PENDING |
| V | External keyboard | Tab / Shift+Tab / Enter / Escape | PENDING (only if a keyboard is available) |
| W | Portrait | Dialog fits, confirm reachable, scrolls, no overflow | PENDING |
| X | Landscape | same | PENDING |
| Y | Home Screen / PWA | Restore button, Files picker, restore, result, records visible, duplicate | PENDING |
| — | Private Browsing | OPTIONAL REFERENCE | NOT TESTED |

PWA note: on iOS the Home Screen app can have a **separate `localStorage` container** from Safari. Records present in Safari but missing in the PWA are **not** a Restore failure; the PWA case is seeded, restored and verified entirely inside the PWA.

## 6. Cases covered by automated evidence instead of the device (by design; no risky device tests)

| Case | Why not on the device | Evidence |
|---|---|---|
| Quota / Security / unknown write failure, false-success | No Production quota filling; no filling of the iPad's storage. | Node (291) + browser E2E R13–R16: standard error shown, storage byte-identical, no success text, recovery works; rollback and `critical` paths in Node |
| Retention: Nazori 60, Sawatte 200 | Would need dozens/hundreds of records on the iPad | Node (drift guard reads the app HTML) + browser E2E R19/R20: never evicts, newest fill free slots, remainder reported |
| Stale preview | Optional two-tab check on the device; otherwise | Node + browser E2E R21: aborted, nothing written |
| Focus trap / Escape / aria roles / 44 px targets | Needs a keyboard; VoiceOver covers the rest | Browser E2E R23 |
| Console errors | Safari console not required | Chromium console gate: 0 errors in every suite |

## 7. PC dress rehearsal (Chromium, same server, same files)

57/57 PASS: server allow-list (20 path checks incl. `.git`, `docs/`, `generate.js`, traversal), downloads served as attachments, hub, A, S, C (PNG thumbnails), D/E/F (trace fields), G, H (conflict not overwritten, existing intact), I–L, M (3.46 MB: warn → 40 records, 0.3 s), N (10.0 MB rejected), T, Q (two tabs), reset (4 keys only), and a console gate of 0 errors. **This is a PC result, not a device result.**

## 8. Observations to record from the device (no benchmark needed)

Freeze / long blocking / tab reload / crash on: a small file, the 3.46 MB file, the 10.0 MB reject. Whether the Files picker greys out `.json` files (the input uses `accept=".json,application/json"`). Whether a file saved by Safari from this server appears under Downloads and is selectable. Whether the 3 MB warning / 10 MB limit should change.

## 9. Known limitations

Learner boundary is not enforceable (no learner id); a stale app tab can overwrite a Restore; no checksum; cross-device / cross-version untested; automated coverage is Chromium-only; plain-http LAN origin (no Service Worker, no offline test); the 3 MB / 10 MB limits are provisional pending this gate.

## 12. Case H investigation (user report: preview showed no conflict)

**Report (device, 「復元する」 NOT pressed):** 教材 なぞり書き; ファイル内 2件; 新規 2件; 重複 0件; 復元後 3件; no conflict shown. Expected: 1 conflict + 1 new, final 2.

**Findings (Production code unchanged; no bug asserted):**

| Question | Finding |
|---|---|
| Record ids in 01 (first Nazori backup) | `gate-nz-1`, `gate-nz-2` (strings) |
| Record ids in 06 (conflict file) | `gate-nz-1` (the conflicting one), `gate-nz-3` |
| Are the two `gate-nz-1` ids identical? | **Yes**, exactly equal (both `typeof string`) |
| Does 06 reuse 01's id by construction? | Yes: `build-test-backups.js` builds both from the same `nazori(1, OLD, pictureA)`; 06 only overrides `allChars` |
| Fields that differ between 01[0] and 06[0] | `allChars` only (image sha1 and length identical) |
| Is 06's other record new? | Yes: `gate-nz-3` does not exist in 01 |
| What does the planner compare? | `restoreIdentity('nazori-app', r)` = `'id:' + r.id` (string id only). A conflict = same identity already in the **existing** array and different canonical content (identical content would be a duplicate instead) |
| PC rehearsal vs. iPad fixtures | Same files (same server, same build). The PC run restored 01 first, so `gate-nz-1` was on the device; that is why it showed 1 conflict |

**Reproduction with the real `planBackupRestore()`** of 06 against each possible device state:

| Device state | total | new | dup | conflict | existing → final |
|---|---|---|---|---|---|
| only the seeded record (01 absent) | 2 | 2 | 0 | 0 | 1 → 3 |
| 01 only | 2 | 1 | 0 | 1 | 2 → 3 |
| seeded + 01 | 2 | 1 | 0 | 1 | 3 → 4 |
| empty | 2 | 2 | 0 | 0 | 0 → 2 |

The reported numbers match the **first row exactly** (existing = 3 − 2 = 1 record, and it is not `gate-nz-1`). So the iPad most likely held one unrelated record and **no `gate-nz-1`** when the preview was opened; in that state "2 new, 0 conflict" is the *correct* result.

**Not yet proven:** why `gate-nz-1` was absent on the device (01 not restored yet / a reset in between / a different origin such as the Home Screen app vs. Safari / the restore of 01 not performed). The iPad's actual storage at that moment was not observable, and the server had logged nothing usable (see below). **If** the device's hub page shows `gate-nz-1` present and 06 still yields "new 2, conflict 0", that is a Restore implementation defect and the Gate STOPS (no fix inside this Gate).

**Gate-tooling weaknesses found and fixed (Gate tools only; Production code untouched):**

1. The server's request log was block-buffered when redirected to a file, so no per-request evidence existed. Every request is now logged immediately (time, client IP, request, status) to the console and `%TEMP%\donomana-restore-gate-server.log`.
2. File contents depended on the server start time ("40 days before now"), so a restart would change a restored record's timestamp and could turn a later "duplicate" check into a "conflict". The anchor is now fixed to the value the first build used; the rebuilt files were verified record-for-record identical to the previously served files (only the envelope `exportedAt` differs).
3. The hub now shows a prerequisite panel for G/H: whether `gate-nz-1` and `gate-nz-2` are on the device (✓/✗), the list of Nazori record ids, and, when ✗, an explicit note that "新規2件・競合0件" is the correct result for that state.
4. The dress rehearsal was extended (60/60 PASS): it includes the exact iPad-reported situation (06 without 01 → 2 new, 0 conflict) and the panel's ✗ → ✓ transition after 01 is restored.

**Re-check (Case H only):** the hub panel must show ✓ (01 restored: `gate-nz-1` and `gate-nz-2` present) → then choose 06 → expect 1 conflict, 1 new, final = existing + 1.

## 13. Case H re-check: conflict row visible, its count is not (implementation UI defect)

**Report (device, 「復元する」 NOT pressed):** ファイル内 2件 / 新規 1件 / 重複 0件 / the row 「今の記録と内容が異なる同じ記録（復元しません）」 is shown **without a count** / 復元後 3件. Functionally this is exactly the expected conflict result (1 conflict, 1 new, 2 + 1 = 3).

**Internal decision vs. what the user sees (separated):**

| Question | Finding |
|---|---|
| Does `planBackupRestore()` report the conflict? | Yes: for a device holding 01 it returns `conflictCount: 1, addCount: 1, duplicateCount: 0, finalCount: 3` (a number field; there is no `conflicts[]` array). These equal the iPad's numbers. |
| Is it passed to the preview? | Yes: `showRestorePreview` uses `plan.conflictCount` (the row is only rendered when it is > 0, which is why the row appeared at all). |
| Does a value element exist? | Yes. `detailRow(label, plan.conflictCount + '件')` creates `<span class="dl">` and `<span class="dv">1件</span>`; the DOM contains 「1件」. |
| Is it hidden by CSS (display / visibility / opacity)? | No (measured `hiddenCss=false`). |
| Is only the label drawn? | No; the value is drawn but **laid out outside the visible box**. |
| **Root cause** | `.detail-row .dl{flex:none}` (shared, from the record detail modal) forbids the label from shrinking. The conflict label is the longest in the dialog (24 full-width characters, 331 px measured). When the dialog is narrower than label + gap + value, the value is pushed past the box edge (and squeezed to 14 px). The box has `overflow-x:auto`, so it becomes an invisible horizontal scroll instead of a visible error. |
| Reproduced? | In Chromium: **visible at 820 / 1180 / 507 px, NOT visible at 390 px (value right edge 404 > box 370) and 320 px** (also the 「すでにある記録」 row at 320 px). The exact iPad width is not known: Safari's real fonts (M PLUS Rounded / Hiragino) are wider than the Chromium fallback used here and/or the window is narrower (Split View / Slide Over), so it clipped earlier on the device. The mechanism is proven; the exact breakpoint on the device is not. |
| Other affected rows | Same class of defect: 「保存できる上限を超えるため追加できない記録」 (over-limit count, preview) and the result-summary rows 「内容が異なるため復元しなかった記録」 / 「保存できる上限のため追加できなかった記録」. All are approved Design items (conflicts, over-limit counts must be displayed). |

**Why the 147 automated checks missed it**

1. R5 asserts only that the **label text** is in `inner_text()`. `inner_text()` also returns text that is clipped or pushed out of the box, so it cannot tell "visible" from "present". No check ever asserted the count value (「1件」) or its visibility.
2. The layout checks (390 / 820 / 1180) only measured the dialog box and the 復元する button, and they did so on a **plain preview with no conflict / over-limit rows**, i.e. only short labels. The longest labels were never rendered at a narrow width.
3. The default Chromium fonts are narrower than on iPad, so even at 820 px the defect would not have shown.

**Proposed minimal fix (NOT applied here; see "Process decision")** — `learning-records.html`, CSS only, scoped to the restore dialog so the record detail modal is unchanged:

```css
#restore-modal .detail-row .dl{flex:1 1 0; min-width:0; overflow-wrap:anywhere}
#restore-modal .detail-row .dv{flex:none; white-space:nowrap}
```

**Regression tests proposed** (`restore-realbrowser-test.py`, +16 checks): for viewports 390 / 820 / 507 / 320, assert **geometrically** that every `.dv` lies inside the dialog and after its label, that the dialog has no horizontal overflow, and that the expected counts are shown: conflict preview (「1件」), over-limit preview (「2件」), over-limit result summary (「2件」), conflict result summary (「1件」).

**Demonstrated in a throwaway worktree (deleted; the Gate worktree still equals the approved checkpoint):**

| Run | Restore browser E2E |
|---|---|
| New regression tests on the UNFIXED code | **157/163, 6 FAIL** (390 px and 320 px: conflict and over-limit counts not visible, preview and result) |
| Same tests with the 5-line CSS fix | **163/163 PASS** |
| Fixed prototype, other suites | Node Restore 291/291, golden 817/817, dashboard-realbrowser 49/49, Backup browser 72/72 |

The patch is saved as `tools/storage-backup-restore-safari-ipad-gate/proposed-ui-fix.patch` (73 lines: 5 CSS lines + the tests). Not applied.

**Process decision:** this is a defect in an **approved, checkpointed Production file** (`learning-records.html`). The Gate rules say not to fix Production code inside the Gate, so it should go to a **Separate Fix Phase** (proposed name: `LEARNING-RECORD-STORAGE-BACKUP-RESTORE-UI-FIX-1`): apply the patch on top of the approved checkpoint, re-run the full regression, create a new checkpoint, then re-serve the fixed build and re-verify on the device at least H (conflict / over-limit rows), W and X (portrait / landscape), M (preview rows), and one full restore. The functional Restore results already observed are unaffected by a CSS-only change; the layout-dependent cases (VoiceOver reading order of the rows, W, X, PWA layout) should be run on the fixed build rather than the current one.

## 10. Production code changes

**None.** The Gate adds only this document and the tools directory above. If a real-device run reveals a Production-code defect, the Gate stops and the defect goes to a separate Fix phase.

## 11. Release readiness

**NOT READY — awaiting the real-device results above.**
