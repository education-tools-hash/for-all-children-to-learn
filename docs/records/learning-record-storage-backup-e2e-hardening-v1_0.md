# Backup / Save Safety Browser E2E Hardening v1.0

**Phase:** `LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1`
**Status: `USER REVIEW READY`.** Test infrastructure only. **No Production code changed.** Nothing committed, pushed, merged or deployed.
**Baseline:** `origin/main` = `e4c0ecb4f8bf5c74ce1f9df25b5ebb5111e15668` (no drift). Branch `test/learning-record-backup-e2e-hardening-1`.

---

## 1. The problem

The browser suites that gated the Save Safety and Full Backup Production releases were **not in the repository**. They existed only as scripts in a per-session temp scratchpad (`AppData\Local\Temp\claude\...\scratchpad\`), which is outside version control, unreviewed, and deleted with the temp directory:

| Former scratchpad script | Checks | Role |
|---|---|---|
| `backup_hardening_e2e.py` | 21 | Full Backup real-browser E2E |
| `save_safety_e2e.py` | 34 | Save Safety failure injection |
| `save_safety_a11y_mobile_e2e.py` | 7 | Save Safety accessibility / mobile |
| `save_safety_smoke_all22.py` | 44 | load-smoke, 22 apps x 2 |

Save Safety = 34 + 7 = **41**. These are the 21 / 41 / 44 figures quoted in the Production release reports.

Other defects in those scripts: they served the site with an ad-hoc `http.server` on a **fixed port (8899)**, used `wait_for_timeout` sleeps, and one check ("Case I") ended in `... or True`, so it could never fail.

## 2. Root cause of the false failure (time dependence)

The Backup E2E seeded the Hiragana record with `toLocaleDateString('ja-JP') + ' 10:00'`, i.e. "today 10:00".

1. `learning-records.html` defaults to the **7-day** period (`<option value="7d" selected>`).
2. `isWithinPeriod()` (`assets/js/record-dashboard-ui.js`) requires `0 <= now - t`. A record dated after "now" is excluded from every period except "all".
3. Run before 10:00, the fixture is in the future, the card is filtered out, and the script fails at "Hiragana card found and opened", which looks exactly like a Backup regression.

**Reproduced** against the real page at 07:42 JST: 0 cards. It is a fixture defect, not a Production bug. A second latent form of the same defect: "N minutes ago" fixtures fall on the previous local day just after midnight.

## 3. Determinism policy

| Concern | Policy | Where |
|---|---|---|
| Clock | Frozen with Playwright's Clock API (`context.clock.set_fixed_time`). `Date`/`new Date()` are constant; timers still run. | `browser_test_helpers.new_context` |
| Timezone | Pinned to `Asia/Tokyo` (UTC+09:00, no DST) via the context's `timezone_id`. | same |
| Locale | Pinned to `ja-JP` via the context's `locale` (the apps write dates with `toLocaleDateString('ja-JP')`). | same |
| Fixtures | Literals derived from the frozen instant in **Python**: ISO strings for Nazori/Sawatte/etc., `2026/3/15 09:00`-style strings for Hiragana/Katakana. No `Date.now()`, no `Math.random()`, no "today 10:00". Fixed ids. | `build_fixtures` |
| Two frozen instants | `noon` = 2026-03-15 12:00 JST; `after-midnight` = 2026-03-15 00:05 JST (5 min past a local midnight). The Backup suite runs under **both** in every run. | `H.CLOCKS` |
| Filenames | Because the clock is frozen, download names are deterministic and asserted **exactly**: `<appId>-full-backup-YYYYMMDD_HHmm.json` (local time), e.g. `nazori-app-full-backup-20260315_1200.json`. | Backup suite |
| Precondition | Right after seeding, UI card count must equal the seeded count; otherwise the scenario **aborts immediately** and reports a fixture (test) bug, not a Backup bug. | Backup suite |
| Serving | An in-process static server on an **OS-assigned free port** (`127.0.0.1`, port 0). App pages use root-relative URLs and register a Service Worker, so they need an http origin; `file://` would break both. No fixed port, no separate process. | `H.serve_repo` |
| Console gate | Uncaught exceptions and `console.error` (which is how `ReferenceError`/`SyntaxError` surface) fail the run. No allowlist is needed today. | `H.attach_console_gate` |
| Environment gate | The **page itself** is asked for its timezone, locale, clock and UTC offset; they must equal the pinned values. | `H.pinned_env_problem` |
| Artifacts | Nothing is written into the repo. Downloads stay in Playwright's temp area. `sys.dont_write_bytecode = True` prevents `__pycache__` (the repo has no `.gitignore` and the `generate` workflow runs `git add -A` on `main`, so a stray file could be auto-committed to Production). | scripts |
| Run header | Every run prints target, fixed clock(s), timezone, locale, browser + version, Playwright version, Python version. | `H.print_header` |

## 4. Repo layout (existing architecture, no new framework)

`tools/record-dashboard-poc/` already holds the Node golden tests (`*-golden-tests.js`) and a Playwright real-browser test (`dashboard-realbrowser-test.py`). The new files follow that naming:

| File | Purpose |
|---|---|
| `backup-hardening-realbrowser-test.py` | Full Backup E2E |
| `save-safety-realbrowser-test.py` | Save Safety E2E (34 + 7) |
| `load-smoke-realbrowser-test.py` | load-smoke, 22 apps x 2 |
| `browser_test_helpers.py` | the shared environment above (underscore, not hyphen, because the scripts `import` it) |

The helper is deliberately small: only what all three genuinely share.

**Deviation from `dashboard-realbrowser-test.py`:** that older test loads `file://`. The app pages cannot (root-relative URLs, Service Worker), so these suites use the free-port http server instead. The scratchpad suites were also http-served, so the tested behavior is unchanged.

## 5. How to run

Prerequisites: Python 3, `pip install playwright`, `playwright install chromium`. Run from anywhere (verified from a different working directory):

```
python tools/record-dashboard-poc/backup-hardening-realbrowser-test.py            # both clocks
python tools/record-dashboard-poc/backup-hardening-realbrowser-test.py --clock noon
python tools/record-dashboard-poc/save-safety-realbrowser-test.py [--clock noon|after-midnight]
python tools/record-dashboard-poc/load-smoke-realbrowser-test.py  [--clock noon|after-midnight]
```

Each prints a copy-pasteable summary line and exits **non-zero** on any failure (or if the console/environment gate fails). Full existing Node regression is unchanged: `for f in tools/record-dashboard-poc/*golden-tests.js; do node "$f"; done`.

## 6. Expected results and check accounting

| Suite | Expected | Notes |
|---|---|---|
| Backup browser E2E | **72/72** = 2 clocks x 36 | 36 per clock = **21 recovered ("[orig]") + 15 added ("[add]")** |
| Save Safety browser E2E | **41/41** | 34 + 7, plus a non-counted console/environment gate |
| load-smoke | **44/44** | 22 apps x 2 |
| Node golden (existing) | **1406/1406** (+ Backup Node **43/43** = 1449) | unchanged |

**The "21" is preserved, not redefined.** All 21 original Backup checks are kept with their original meaning (labelled `[orig]`). The Backup suite additionally covers what the phase requires and the scratchpad version did not: Katakana; exact `storageKey`/`recordCount`/`exportedAt`; exact filenames; deep equality of the full downloaded `records` against the seeded fixtures (PNG Data URL, stroke arrays, trace arrays, `trimmed`/`pointLimit`/`traceSchemaVersion`); CSV backward compatibility (a real Tokei CSV download: UTF-8 BOM, `.csv`, non-empty); read-only proof (all six storage values byte-identical before/after every export); empty storage; malformed storage; and the card-count and environment preconditions.

### Deliberate differences from the recovered logic (everything else is carried over verbatim)
1. Fixtures/clock/timezone/locale/serving as in §3.
2. Backup card lookup now matches the card's `.record-app` label **exactly**. The scratchpad substring match on the whole card text was only correct because Katakana was not seeded; once it is, the Katakana card's text also contains "なぞり" and Nazori resolved to the wrong card.
3. Save Safety: the Nazori seed used an in-page wall-clock timestamp; it is now a fixed literal.
4. Save Safety "Case I" (`active_tag != 'DIV' or True`, which could never fail) now asserts what its label says. It passes.
5. Console errors are gated in Save Safety too, as a separate non-counted gate, so the 41 stays 41.

## 7. Verification performed

| Check | Result |
|---|---|
| Backup, 12:00 JST and 00:05 JST clocks | 72/72 PASS (36 + 36) |
| Save Safety, both clocks | 41/41 PASS each |
| load-smoke | 44/44 PASS |
| Repeated runs (Backup x2 within the matrix, Save Safety x2, load-smoke x2) | identical |
| Fresh clean worktree from `origin/main` + the 4 files, run from a different working directory | all three PASS, exit 0, worktree still clean, ~55 s total |
| Negative test: re-inject the original bug (a Hiragana record 2 h in the future) | precondition fails with a "test bug, not a Backup bug" message, scenario aborts at once, **exit 1** |
| Existing Node regression | 1406/1406 (+ Backup Node 43/43) |
| Production code diff | **none** (only 4 new files under `tools/`, plus this document) |

### Host timezone / locale independence: what is and is not proven
- **Proven by construction and by direct probes:** the browser's timezone/locale/clock are set by Playwright emulation and the page is asked to confirm them each run (environment gate). Probes showed pinned values override the host for arbitrary zones/locales (`America/New_York`/`en-US`, `UTC`/`de-DE`, `Asia/Kolkata`/`fr-FR`). Python-side fixture code uses only fixed +09:00 offsets and UTC, never the host's timezone.
- **Not exercised at OS level:** this machine is set to `Tokyo Standard Time`, and on Windows the Chromium process **ignores the `TZ` environment variable** (confirmed: an unpinned browser reported `Asia/Tokyo` under `TZ=UTC` and `TZ=America/New_York`). Earlier runs that set `TZ`/`LANG` therefore did not change the host, and are **not** counted as evidence. Changing the Windows system timezone was not done (system-wide, intrusive). A real cross-host run is best obtained from a CI runner (UTC) or another developer's machine.

## 8. Known limitations
- Chromium only. Safari/WebKit behavior remains the job of the real-device gates.
- Requires Python + Playwright; not runnable with Node alone. Playwright **1.62.0** / Chromium 151 were used; the Clock API needs a Playwright version that provides `context.clock` (present since 1.45). Other versions are untested.
- No automated cross-OS-host verification yet (see §7).
- A single Chromium process per suite; the suites are sequential (about 55 s total).
- Downloads are read via Playwright's temp path; no file-picker (Restore) coverage yet. Restore E2E will be added by the Restore implementation phase using this same environment.

## 9. CI recommendation: **recommended, defer to its own phase**
`.github/workflows/generate.yml` only runs `node generate.js` and auto-commits; **no test runs in CI today**. Adding these would need a Playwright + Chromium install (~1 min, ~150 MB) and ~1 minute of runtime per push. That is small, but it changes the push-to-`main` pipeline that also auto-commits generated files, so it deserves its own review: a separate `pull_request`/`workflow_dispatch` workflow (not the `generate` job), `runs-on: ubuntu-latest` (a genuinely different host timezone, which would also close the gap in §7), and no `git add -A` step. Not mandatory before Restore implementation; **recommended** soon after.

## 10. Stop statement
`LEARNING-RECORD-STORAGE-BACKUP-E2E-HARDENING-1` = **USER REVIEW READY**. No commit, push, merge, deploy, changelog or version change. The recovered scratchpad scripts remain untouched in the old session directory and are **no longer the source of truth**; the files in §4 are.
