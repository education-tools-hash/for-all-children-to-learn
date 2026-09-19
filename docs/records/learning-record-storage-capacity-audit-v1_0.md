# Learning Record Storage Capacity Audit v1.0

**Phase:** `LEARNING-RECORD-STORAGE-CAPACITY-AUDIT-1` — AUDIT / MEASUREMENT / DESIGN ONLY.
**Baseline:** `origin/main` = `5231673e83e2aaaa1367d891462a0a1c28e6e0f7` (release: add L2 record parity for okane/tokei/shiritori2). No drift detected at Start Gate.
**Worktree:** `for-all-children-to-learn-storage-capacity-audit-1`, branch `audit/learning-record-storage-capacity-1`.
**Production impact:** **NONE.** No Production file was modified. No commit, push, merge, or deploy occurred. Nothing in this phase used real Production or real user data; all measurements were taken either as pure Node.js arithmetic over synthetic fixtures, or in a real browser against a disposable `http://127.0.0.1:8971` origin that is unrelated to `donomana.jp` and cannot share storage with it.

---

## 1. Executive Summary

The site currently has **zero storage-capacity safety net**. Every one of the 22 Record Foundation apps saves through a byte-for-byte identical helper duplicated in 22 separate HTML files:

```js
function donomanaRecordWriteLog(storageKey, log) {
  try { localStorage.setItem(storageKey, JSON.stringify(log)); } catch (e) {}
}
```

If `setItem` throws — for any reason, most importantly `QuotaExceededError` — the error is swallowed, the just-completed activity record is silently discarded, and the user sees a normal "activity finished" screen with no indication anything was lost. There is no cap on any app's log array, no warning threshold, no backup/export-everything feature, and no way to recover a raster image (Nazori) or stroke trace (Hiragana/Katakana) once it is gone, because neither has any export path at all.

The good news, established by a real-browser measurement in this phase: current desktop Chromium does not appear to enforce the classic "5–10MB per origin" localStorage limit any more — it ties localStorage to the same disk-relative Storage Standard bucket as `navigator.storage.estimate()`, observed here at **3GB**, and a single-key write up to ~100MB never threw. That headroom makes exhaustion unlikely in the modeled usage scenarios on that browser family. The bad news is that this could not be verified for Safari/iOS — the browser family most likely to be in play on shared iPad classroom devices, historically the browser with the smallest and most volatile localStorage limits — so the actual risk profile for this site's real deployment context is **not fully known** and is flagged below as requiring real-device verification (Decision Gate C).

Independent of quota size, two structural facts do not depend on any particular browser's limit and are true today, in Production, right now:
1. **A single shared-device / multi-child usage pattern (the "High-Shared-Device" scenario, plausible for this site's target special-needs/classroom audience) is the fastest-growing case by roughly two orders of magnitude over "Light" usage**, driven almost entirely by Nazori's raster images (15–72KB each) and, to a lesser extent, Hiragana/Katakana stroke traces.
2. **Media (Nazori images, Hiragana/Katakana stroke traces) has no backup or export path of any kind.** A `localStorage.clear()`, a "free up space" browser prompt, a device reset, or (once it exists) any future auto-cleanup feature is the only way this data is lost — and today, once lost, it cannot be recovered, exported, or even warned about beforehand.

This report is a design/measurement artifact only. It proposes an opt-in (default-OFF) retention/auto-cleanup design and an IndexedDB migration feasibility assessment for future phases; it implements neither.

---

## 2. Methodology & Evidence Classification

Every factual claim in this report is tagged with one of:

| Tag | Meaning |
|---|---|
| **CODE-VERIFIED** | Read directly from the current repository source at the baseline commit; file:line cited. |
| **MEASURED** | Computed by running real code (Node.js arithmetic on synthetic fixtures matching the CODE-VERIFIED shape, or a real headless-Chromium browser session) in this phase. Raw numbers in `docs/records/data/learning-record-storage-capacity-measurements-v1_0.json`. |
| **BROWSER-MEASURED** | Subset of MEASURED specifically requiring a real browser engine (image encoding, `navigator.storage.estimate()`, actual `QuotaExceededError` behavior) rather than pure Node arithmetic. |
| **DOCUMENTATION-BASED** | General knowledge about browser storage behavior (e.g. published Safari/WebKit quota history) not independently re-verified against a live copy of that browser in this phase. |
| **USER REAL-DEVICE REVIEW REQUIRED** | A claim this audit could not verify in the available environment (no Safari/iOS/Firefox/older-Chrome instance available) and that materially affects risk sizing. |
| **MODELED / ESTIMATED** | A projection built by layering disclosed, stated usage-frequency assumptions on top of CODE-VERIFIED/MEASURED per-record byte sizes. Not a measurement of real users. |

Byte-size methodology: **UTF-8** = `Buffer.byteLength(JSON.stringify(record), 'utf8')` — the actual bytes counted against the browser's storage quota. **UTF-16 approx** = `JSON.stringify(record).length * 2` — an upper-bound approximation of the in-memory JS string representation, reported alongside but not used for capacity math (quota is UTF-8/byte based).

All measurement code lives under `tools/storage-capacity-audit/` (this phase's only new files, alongside this report and its JSON data file):
- `measure-record-sizes.js` — pure Node.js, no browser, no localStorage, computes per-record JSON byte sizes from synthetic fixtures.
- `quota-and-image-size-test.py` — Playwright/Chromium, navigates **only** to `http://127.0.0.1:8971/blank.html` (asserted in-script; the script aborts if the resolved origin is not exactly that address or contains "donomana"), draws synthetic canvas strokes to measure realistic Nazori PNG sizes, and runs a bounded (≤100MB, ≤400 steps) `localStorage` growth probe using the exact Production catch pattern. It clears all keys it wrote before exiting.
- `blank.html` — the static page served to that disposable origin; contains nothing but an empty canvas element.

None of these three files are referenced by any Production page, `generate.js`, or the service worker precache list.

---

## 3. Storage Inventory (all mechanisms, whole repository)

### 3.1 Record Foundation `localStorage` keys (22 apps)

Re-enumerated directly from `assets/js/record-dashboard-foundation.js`'s `RECORD_ADAPTERS` at the baseline commit (not assumed from prior phase docs). 19 are registered as literal adapter objects; `suji-manabou`, `hiragana-learn`, and `katakana-app` are registered via two shared factory functions (`makeTraceQuizAdapter`, `makeKanaAdapter`). Total: **22**, matching the count established across the prior Detail-Parity phases.

| appId | storageKey | privacyLevel | includeInDefaultTimeline | L3 kind |
|---|---|---|---|---|
| janken-app | `janken_log` | low | true | — |
| register-app | `register_log` | medium | true | — |
| tokei-app | `tokei_log` | low | true | — |
| matching-app | `matching_log` | low | true | — |
| shiritori2 | `shiritori2_log` | low | true | — |
| directions-app | `appLogs` | low | true | — |
| mitsukete-touch-app | `mitsukete_touch_log` | low | true | — |
| junban-miyou-app | `junban_miyou_log` | low | true | — |
| kurabeyou-app | `kurabeyou_log` | low | true | — |
| katachi-awase-app | `katachi_log` | low | true | — |
| dotchiga-ii-app | `dotchiga_ii_log` | low | true | — |
| miru-hirogaru-app | `miru_hirogaru_log` | low | true | — |
| okane-app | `okane_activity_log` | low | true | — |
| sst-app | `sst_activity_log_v1` | low | true | — |
| mogura-tataki | `mogura_v3` | low | true | — |
| **nazori-app** | `nazori_records` | medium | true | **raster-image** |
| bosai-app | `bosai_log` | **high** | true | — |
| **sawatte-hirogaru-app** | `sawatte_hirogaru_log` | low | true | **timed-interaction-trace** |
| **kyou-no-kiroku** | `kyounokiroku` | **high** | **false** | — (nested, see §3.1.1) |
| suji-manabou | `suji_log` | low | true | — |
| **hiragana-learn** | `hiragana_log` | low | true | **canvas-stroke-trace** |
| **katakana-app** | `katakana_log` | low | true | **canvas-stroke-trace** |

Evidence: CODE-VERIFIED (`assets/js/record-dashboard-foundation.js`, adapter definitions at the line ranges grepped in this phase).

Notable naming/structure outliers found while re-deriving this table (not previously documented in this form):
- `directions-app`'s storage key is the generic literal string `appLogs` (not `directions_log`) — CODE-VERIFIED, worth a documentation note so a future engineer doesn't assume a naming convention that doesn't hold here.
- A comment inside `record-dashboard-foundation.js` (near the `kyou-no-kiroku` registration) still says "21 Foundation apps" — CODE-VERIFIED stale, since re-enumeration here gives 22. INFORMATIONAL, not fixed in this audit-only phase.

#### 3.1.1 `kyou-no-kiroku` — structurally different from the other 21

CODE-VERIFIED (`kyou-no-kiroku.html:2168-2173`, `record-dashboard-foundation.js:1270-1292`): this app does **not** use the flat `donomanaRecordAddLog(key, entry)` append pattern. It stores one single nested object under the `kyounokiroku` key:

```js
localStorage.setItem('kyounokiroku', JSON.stringify({
  children: state.children,
  records: state.records,
  kimochiOptions: state.kimochiOptions,
  // ...
}));
```

Every save rewrites the **entire** object, including the full history array, not just one new entry. The adapter's own code comment states it holds child name, temperature, pulse, and seizure-memo free text ("児童名・体温・脈拍・発作メモ等"), which is why `privacyLevel: 'high'` and `includeInDefaultTimeline: false` are both set — this app is deliberately excluded from the shared dashboard's default view. Because entries here are **free-text**, not fixed-schema, per-record size is unbounded in principle (a long daily care note) in a way none of the other 21 apps' records are.

### 3.2 Non-Record-Foundation `localStorage` usage

The repository has far more than 22 interactive apps (~50 root-level HTML files). A repo-wide key-literal sweep (`localStorage.setItem/getItem('...')`) found the following storage **outside** the Record Foundation adapter registry. This confirms the phase's "do not assume only 22 apps matter" premise.

| Key(s) | File(s) | Kind | Growth pattern | Notes |
|---|---|---|---|---|
| `a11y-contrast`, `a11y-font`, `a11y-sr`, `donomana-a11y-font` | shared across nearly every page (index.html, about.html, philosophy.html, and every app page's a11y panel) | UI preference (string/bool) | fixed, overwritten in place | Tiny (bytes), effectively free. |
| `kimochi_v2` | `kimochi-board.html` | app-local state, NOT a Record Foundation log | unknown cap, not audited in depth | kimochi-board is not one of the 22 adapters; out of this phase's deep-dive scope. |
| `match-prefs3` | `matching-app.html` | settings, separate from its own `matching_log` Foundation key | fixed | — |
| `ongaku-settings`, **`ongaku-compositions`** | `ongaku-app.html` | settings + **user-created music compositions** | `ongaku-compositions` reads/writes as a growing collection, not capped | Not a Record Foundation app. A composition could plausibly be as large as, or larger than, a Hiragana trace record. **Flagged for a future-phase follow-up investigation**, out of scope to fully measure here. |
| `register_settings`, `register_products`, **`register_img_<id>`** | `register-app.html` | settings + **per-custom-product base64 images** | one key per saved image, unbounded key count | A second, entirely separate raster-image storage vector outside the L3 Rich Visualization contract and outside Record Foundation. **Flagged for follow-up**; not measured in this phase. |
| `okane_settings`, `okane_records`, `okane_custom_items` | `okane-app.html` | settings/local state, separate from the Foundation-registered `okane_activity_log` | unknown | okane-app has storage beyond its Record Foundation key; not audited in depth here. |
| `gaze_pred_freq`, `gaze_profiles`, `gaze_current_profile`, `gaze_prof_settings_*`, `gaze_custom_colors`, `gaze_stats_*`, `gaze_panel_vis` | `gaze-keyboard.html` | multi-profile settings/stats | multiple keys, profile-count-bounded | Not a Record Foundation app; not measured in depth. |
| `scr_thresh`, `scr_rangeMode` | `scratch-app.html` | settings | fixed | — |
| `sst_ai_generated_v1`, `sst_cfg` | `sst-app.html` | settings/generated content, separate from the Foundation-registered `sst_activity_log_v1` | unknown | — |
| `suji_matchIllust` | `suji-manabou.html` | local state | unknown | — |
| `tokei-sound` | `tokei-app.html` | settings | fixed | — |
| `tt_cards`, `tt_pin`, `tt_sound`, `tt_showTaskCard`, **`tt_recordings`** | `time-timer.html` | settings + possible audio/voice data (`tt_recordings`) | unknown | time-timer.html is not a Record Foundation app at all. `tt_recordings` (plural) is a name suggestive of stored audio; **flagged for follow-up**, not measured in this phase. |
| `teacherPwd` | `directions-app.html` | a teacher password stored in plaintext in `localStorage` | fixed | Out of this audit's capacity scope, but noted as an INFORMATIONAL security observation surfaced incidentally by the grep sweep — not investigated further here. |

**Scope decision:** the three bolded follow-up items (`ongaku-compositions`, `register_img_<id>`, `tt_recordings`) are plausible additional media-scale storage vectors outside the Record Foundation / L3 contract this site has built parity tooling around. A full byte-level audit of each would meaningfully expand this phase; per the phase's synthetic/measurement scope, they are logged here as **candidate scope for a follow-up phase** rather than measured, so as not to silently under-deliver on the 22-app / L3 core scope this phase was chartered for.

### 3.3 Cache API / Service Worker (a separate but quota-sharing mechanism)

CODE-VERIFIED (`service-worker.js`): the service worker maintains two `CacheStorage` caches — `SHELL_CACHE` (precached app-shell assets on install) and `RUNTIME_CACHE` (runtime-fetched resources cached opportunistically). This is a **different Web Storage mechanism** than `localStorage` (Cache API vs. Web Storage API), but on Chromium both are accounted inside the same per-origin quota bucket that `navigator.storage.estimate()` reports. This matters for capacity math: the origin's real "usage" figure a browser would show is Record-Foundation-localStorage-plus-everything-in-§3.2-plus-this-cache, not localStorage alone. This phase did not measure the Cache API's actual byte size (out of scope: it is asset caching, not learning records), but flags it as a non-zero baseline contributor to the same quota.

### 3.4 IndexedDB / `sessionStorage`

CODE-VERIFIED: no `indexedDB`, `IDBDatabase`, or `sessionStorage` usage was found anywhere in the current repository. All persistent app/record state on this site goes through `localStorage` or the service worker's Cache API. This is directly relevant to §11 (IndexedDB Migration Feasibility) — there is no existing IndexedDB code to build on or migrate away from; a migration would be a from-scratch implementation.

### 3.5 Origin sharing

CODE-VERIFIED: no evidence of any subdomain, path-prefix-based storage partitioning, or alternate deployment origin was found. All apps are static pages under the single `donomana.jp` origin (per `CLAUDE.md` and repo structure), so **every one of the ~50 apps, all 22 Record Foundation logs, and the service worker's caches share exactly one storage quota bucket.** A capacity or quota problem in one app is, in principle, a capacity problem for the whole site.

---

## 4. Save-Path & Failure-Safety Findings (Root Investigation C)

### 4.1 The write path is silent-fail, verbatim, in all 22 apps

CODE-VERIFIED. Every one of the 22 Record Foundation HTML files defines its own copy of:

```js
function donomanaRecordReadLog(storageKey) {
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}
function donomanaRecordWriteLog(storageKey, log) {
  try { localStorage.setItem(storageKey, JSON.stringify(log)); } catch (e) {}
}
function donomanaRecordAddLog(storageKey, entry) {
  var log = donomanaRecordReadLog(storageKey);
  log.push(entry);
  donomanaRecordWriteLog(storageKey, log);
  return log;
}
```

(Confirmed byte-identical via a full-repo grep of `donomanaRecordWriteLog`'s body across all 22 files — sampled full-context in `nazori-app.html:1749-1759`, `hiragana-learn.html:1709-1712`, and matched line-for-line in the other 20.)

**Read-path** is defensively safe: a missing key, unparseable JSON, or a parsed-but-non-array value all degrade to `[]` rather than throwing — this was itself a previously-fixed bug (per an in-code comment in `hiragana-learn.html`) and the fix generalized. The cost is that a corrupted or evicted key is indistinguishable from "no records yet" — there is no user-visible signal that history existed and is now gone.

**Write-path** has no such handling. On `setItem` throwing (most realistically `QuotaExceededError`, but also possible for other reasons, e.g. a strict Private Browsing mode that disables `localStorage` entirely), `donomanaRecordAddLog` still returns the in-memory `log` array with the new entry appended — the caller has no way to know the persisted copy does not actually contain it, because the function's return value looks identical on success and on failure. **No app checks this return value differently in either case** (spot-checked: `nazori-app.html:3040`, `okane-app.html`, `tokei-app.html` all call `donomanaRecordAddLog(...)` and discard/ignore anomalies the same way). There is no retry, no user-facing error banner, no console warning even, and no telemetry.

### 4.2 What this means concretely, per app

- **Simple flat-record apps** (19 of 22): worst case on failure is losing one small (~150–250 byte) record — the day's quiz score, for example. Annoying, invisible, but low absolute value lost per incident.
- **Sawatte (timed trace)**: losing one session record loses up to `TRACE_HARD_CAP` = 1000 points (~12.4KB) of interaction trace, i.e. a whole session's worth of a therapeutic/sensory activity, plus the session summary stats around it.
- **Nazori (raster image)**: losing one record loses **the actual scanned/traced artwork** (15–72KB depending on single-cell vs. multi-cell mode) — a piece of a child's handwriting practice that, per §7, has no other backup anywhere.
- **Hiragana/Katakana (stroke trace)**: losing one record loses one character-tracing attempt's stroke data (~650–1050 bytes) and its pass/fail judgment.
- **kyou-no-kiroku**: because this app rewrites the **entire** nested object on every save (not just one appended entry), a failed write here risks the appearance of losing the **whole care-log history**, not just the newest entry, if the in-memory `state.records` the app is working from was already out of sync with what's actually persisted (a failed prior save). This is the single highest-severity instance of this pattern given the sensitivity of the data (§3.1.1) and is called out separately in the Risk Register.

### 4.3 No existing cap on any log array

CODE-VERIFIED: `donomanaRecordAddLog` unconditionally `.push()`es and never trims. No app-local override of `donomanaRecordAddLog` adds a cap either (spot-checked the same three apps as above). The only existing per-record size bound found anywhere is **internal to a single record**, not the log array: Sawatte's `TRACE_HARD_CAP = 1000` total trace points per session (`sawatte-hirogaru-app.html:1909`), and Hiragana/Katakana's fixed 24-points-per-stroke sampling (`hiragana-learn.html:3572`). Neither limits how many *records* accumulate over the app's lifetime — that axis is completely unbounded today, on all 22 apps.

---

## 5. Per-Record / Per-L3-Type Size Measurements

All numbers below are also machine-readable in `docs/records/data/learning-record-storage-capacity-measurements-v1_0.json`.

| Record type | Evidence | UTF-8 bytes | UTF-16 approx bytes |
|---|---|---:|---:|
| Simple flat record (janken/okane/tokei/shiritori2 family, avg of 4 samples) | MEASURED | ~120–220 (≈200 avg) | ~194–440 |
| Sawatte typical session (150 trace points) | CODE-VERIFIED shape + MEASURED | 2,035 | 4,070 |
| Sawatte worst case (`TRACE_HARD_CAP`=1000 points) | CODE-VERIFIED shape + MEASURED | 12,405 | 24,810 |
| Hiragana/Katakana, 2-stroke character | CODE-VERIFIED shape + MEASURED | 636 | 1,268 |
| Hiragana/Katakana, 4-stroke character | CODE-VERIFIED shape + MEASURED | 1,017 | 2,030 |
| Nazori wrapper (metadata only, excl. image) | MEASURED | 119 | 234 |
| Nazori image, single-cell (default 300×300, 3-stroke synthetic character) | BROWSER-MEASURED | 15,456 (base64) | — |
| Nazori image, 5-cell "continuous writing" mode (1500×300) | BROWSER-MEASURED | 72,416 (base64) | — |
| Nazori image, near-blank canvas (best case) | BROWSER-MEASURED | 4,062 (base64) | — |

**Nazori is, by a wide margin, the single largest per-record storage cost on the site** — a typical single-character record (~15.6KB total) is roughly **70× the size of a simple flat record** and **~18× a Hiragana/Katakana stroke record**. This one app is the dominant term in every capacity projection below.

---

## 6. Controlled Quota-Exhaustion Test

Run via `tools/storage-capacity-audit/quota-and-image-size-test.py` against the disposable origin `http://127.0.0.1:8971` (asserted in-script to never be `donomana.jp`).

| Metric | Result |
|---|---|
| Browser | Playwright-bundled Chromium |
| `navigator.storage.estimate()` before test | `quota: 3,221,225,472 bytes (3GB)`, `usage: 0` |
| Growth probe | single key, 256KB steps, using the exact Production `donomanaRecordWriteLog` try/catch pattern, bounded at 400 steps (~100MB) as a safety ceiling |
| Result | **No `QuotaExceededError` thrown** at any point up to ~100MB in a single key |
| `navigator.storage.estimate()` after test | unchanged (`3,221,225,472 / 0`), confirming the probe key was fully cleaned up |
| Recovery check | An immediate small write after the probe's cleanup succeeded — the origin was never left in a "wedged" state by the (non-)failure |

**Interpretation (BROWSER-MEASURED for this Chromium build; DOCUMENTATION-BASED + USER REAL-DEVICE REVIEW REQUIRED beyond it):** Modern Chromium implements the Storage Standard's "best-effort" storage model, where `localStorage` shares the same disk-relative quota bucket as everything else on the origin (Cache API, IndexedDB), rather than enforcing the older WebKit-originated fixed 5–10MB-per-origin cap that is still widely assumed in web-development folklore (and that this site's entire error-handling posture appears to have been implicitly written for, given the reflexive but never-actually-exercised `try/catch`). At 3GB of headroom, none of the three modeled usage scenarios in §8 comes remotely close to exhausting Chromium's quota, even over 12 months.

This does **not** mean the risk is zero:
- **Safari/iOS** has a documented history (DOCUMENTATION-BASED, not independently re-verified here) of smaller and more volatile `localStorage` limits, especially in Private Browsing and under iOS's system-wide low-storage eviction, which can clear an origin's site data entirely without a `QuotaExceededError` ever firing — a **different but equally silent failure mode** the current code has no defense against either. This is directly relevant because iPad Safari is a plausible, common device in the special-needs/classroom setting this site targets.
- **Firefox and older Chrome** were not available to test in this environment.
- A **shared classroom device already carrying other sites' data** could have much less of that 3GB bucket actually available in practice than a freshly-provisioned disposable origin did here.

**Decision Gate C (§16) exists specifically because of this gap.**

---

## 7. Capacity Projections (3 scenarios × 4 time horizons)

**MODELED / ESTIMATED.** Built from the MEASURED per-record byte sizes in §5, layered with disclosed, stated usage-frequency assumptions — not a measurement of real users. Scenario definitions:

| Scenario | Records/day | Mix assumption |
|---|---:|---|
| **Light** | 3 | Occasional home use; mostly simple apps, rare L3 use |
| **Typical School** | 30 | One shared classroom device, daily structured curriculum use across ~8 apps including tracing apps |
| **High-Shared-Device** | 150 | Many children rotating on one shared device all day; heavy Nazori/Hiragana-Katakana visual-tracing usage |

| Scenario | 1 month | 3 months | 6 months | 12 months |
|---|---:|---:|---:|---:|
| Light | 189 KB | 573 KB | 1.15 MB | 2.30 MB |
| Typical School | 2.89 MB | 8.78 MB | 17.5 MB | 35.2 MB |
| High-Shared-Device | 26.6 MB | 80.7 MB | 161 MB | 324 MB |

Full per-scenario byte figures and the exact mix weights used are in the JSON data file's `capacityProjections` block.

**Reading these against the two quota realities in play:**
- Against the **3GB Chromium-observed quota** (§6): even High-Shared-Device at 12 months (~324MB) uses roughly a tenth of it. On this browser family, storage exhaustion from Record Foundation data alone is not a realistic 12-month risk.
- Against the **historical ~5–10MB Safari-style cap** (DOCUMENTATION-BASED, unverified here): **Typical School crosses that threshold within roughly 2–4 months, and High-Shared-Device crosses it within days.** Because that cap could not be independently confirmed or ruled out for this site's actual Safari/iOS deployment target, this is the single most consequential open question this audit surfaces — see Decision Gate C.

Either way, the structural finding from §4 stands regardless of which quota number turns out to be correct: **when the limit is hit, on any browser, the failure is currently silent.**

---

## 8. Risk Register

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R1 | **CRITICAL** | Every save path on all 22 Record Foundation apps silently discards data on any `localStorage.setItem` failure (quota exceeded, Private Browsing restrictions, or otherwise), with zero user-visible signal, zero retry, zero telemetry. | CODE-VERIFIED, §4.1 |
| R2 | **CRITICAL** | Media (Nazori raster images, Hiragana/Katakana stroke traces) has **no export or backup path of any kind**. Once evicted/cleared/lost to R1, it is permanently gone. | CODE-VERIFIED, §9 |
| R3 | **HIGH** | The real localStorage quota behavior on Safari/iOS — the likely primary device family for this site's classroom audience — is unverified. Both R1's likelihood and this audit's own capacity-safety conclusion are conditional on that unknown. | USER REAL-DEVICE REVIEW REQUIRED, §6 |
| R4 | **HIGH** | `kyou-no-kiroku` rewrites its entire nested object (including full history) on every save, holds highly sensitive free-text medical/care notes, and shares R1's silent-catch write path — the highest-consequence single instance of R1 given the data's sensitivity and the whole-object rewrite pattern. | CODE-VERIFIED, §3.1.1, §4.2 |
| R5 | **MEDIUM** | No log array (any of the 22) has a size or count cap. Growth is unconditional for the life of the device/browser profile. | CODE-VERIFIED, §4.3 |
| R6 | **MEDIUM** | A corrupted or evicted key degrades silently to "no records" on read, indistinguishable from a child who has never used the app — no signal to a teacher/parent that history existed and is gone. | CODE-VERIFIED, §4.1 |
| R7 | **MEDIUM** | Nazori's per-record cost (15–72KB) is 18–70× other record types and is the dominant term in every capacity projection; multi-cell "continuous writing" mode alone can produce 72KB single records. | BROWSER-MEASURED, §5 |
| R8 | **MEDIUM** | At least three storage vectors outside the audited 22-app/L3 scope (`ongaku-compositions`, `register_img_<id>`, `tt_recordings`) appear structurally capable of holding non-trivial or media-scale data and were not measured in this phase. | CODE-VERIFIED (existence only), §3.2 |
| R9 | **LOW** | All ~50 apps, all 22 Foundation logs, and the service worker's Cache API share one origin-wide quota bucket; a capacity problem anywhere is, in principle, a capacity problem everywhere. | CODE-VERIFIED, §3.5 |
| R10 | **INFORMATIONAL** | `directions-app.html` stores a teacher password in `localStorage` in plaintext. Unrelated to storage *capacity* but surfaced incidentally by this phase's inventory sweep. | CODE-VERIFIED, §3.2 |
| R11 | **INFORMATIONAL** | A stale code comment in `record-dashboard-foundation.js` still says "21 Foundation apps"; current count is 22. | CODE-VERIFIED, §3.1 |

---

## 9. Backup / Export Coverage Audit

CODE-VERIFIED (grep across `learning-records.html` and `record-dashboard-foundation.js`): there is **no whole-site "export all" or "backup all records" feature anywhere in the codebase.** The only export mechanism is `FOUNDATION.getCsvActions(appId)`, surfaced per-record from the Detail modal in the Common "学習の記録" (`learning-records.html`) dashboard, producing structured-field CSV only.

| Data type | Exportable today? |
|---|---|
| Simple flat-field records (19 apps) | Yes, via per-app CSV export |
| Sawatte session stats (tap/swipe counts, duration) | Yes, via CSV |
| Sawatte raw trace points | **No** — CSV export covers summary stats only, not the point-array itself |
| Hiragana/Katakana pass/fail, score, kana | Yes, via CSV |
| Hiragana/Katakana raw stroke trace | **No** |
| Nazori metadata (kana, session counts) | Yes, via CSV (metadata rows only) |
| **Nazori image itself** | **No — the single largest and most emotionally significant artifact type on the site has zero backup path.** |
| kyou-no-kiroku care notes | Not checked for CSV support in this phase (excluded from default timeline, `getCsvActions` not traced for this adapter) |

**This is the single clearest actionable gap this audit surfaces independent of the quota-size question in §6**: even on a browser with a huge quota, ordinary browser data-clearing UI, "Clear browsing data," a device factory reset, or (in the future) any auto-cleanup feature can permanently destroy Nazori/trace media today, with no way for a user to have protected against it first.

---

## 10. Selective Media Cleanup Feasibility (per L3 type)

The question: could a *future* feature strip only the heavy media portion of an L3 record while retaining its lightweight summary (so history/CSV stays intact but bulk storage is reclaimed)?

| L3 type | Feasibility | Reasoning |
|---|---|---|
| **Nazori (raster image)** | **High** — structurally the easiest of the three | The `image` field is a single, clearly-delimited value on the record (`entry.image`). Deleting it (replacing with `null` or omitting it) leaves `kana`, `sessionDone`, `sessionTotal`, `timestamp` fully intact for the summary/CSV/dashboard list to keep working unmodified — those fields never read `image` except the Rich Visualization renderer, which already has to handle "no valid image" as a state (`hasAnyValidImage()` / `isValidImage()` exist today for other reasons per the prior phase's implementation). This is also the highest-value target, since Nazori is the dominant byte cost (§5, §7). |
| **Sawatte (timed trace)** | **Medium** | `payload.trace` is a self-contained sub-object (`{taps, swipes, totalPoints, trimmed}`) separable from the surrounding session-summary fields (`tapCount`, `swipeCount`, `durationSec`, etc.) the same way Nazori's `image` is. Slightly more work than Nazori because the renderer (`record-trace-renderer.js`) would need an explicit "trace stripped, summary-only" display state, which does not exist today (today it always expects a valid trace or nothing). Byte savings per record are smaller than Nazori's (2–12KB vs. 15–72KB), so the value-per-implementation-effort ratio is lower. |
| **Hiragana/Katakana (canvas stroke trace)** | **Medium** | `payload.traceSample` is similarly separable from `kana`/`level`/`pass`/`score`. Same caveat as Sawatte: `kana-record-trace-renderer.js` would need a "no sample" display state. Byte savings per record are the smallest of the three (650–1050 bytes) — lowest priority target of the three L3 types for a cleanup feature, even though it's structurally just as easy as Sawatte. |

**Common feasibility note for all three:** none of this requires a schema change beyond adding a documented "this field may be absent, meaning stripped-not-missing" convention (distinguishable from "media was never captured," which today already exists as a `null`/absent-field state for all three types per the parity work in prior phases) — i.e., a cleanup feature is additive, not a breaking change to the existing normalize()/getDetails()/richVisualization contracts. It is, however, a real feature (rendering states, a UI to trigger it, and almost certainly a "media stripped on <date>" marker so the summary honestly reflects that something was removed rather than silently rendering as if nothing was ever captured) — **not something to bundle into a future phase's IndexedDB or retention work by assumption; it would need its own scoped phase spec.**

---

## 11. Retention / Auto-Cleanup Design Proposal (proposal only — NOT implemented, default OFF)

This is a design proposal for a possible future phase. Nothing here is implemented in this phase.

**Non-negotiable ground rules (proposed):**
1. **Default OFF.** No existing or new user is ever auto-enrolled. An explicit, visible opt-in action is required (per-device, in an accessibility/settings panel already established elsewhere on the site) before any auto-cleanup logic runs at all.
2. **Never delete silently.** Any cleanup action — manual or (if opted in) automatic — must leave a visible, dated marker in the record it touched (e.g., a Nazori record whose image was cleaned up still shows in the list/CSV with a "画像は削除されました（YYYY-MM-DD）" state, not a record that simply vanishes or silently renders as "no image ever saved").
3. **Cleanup order should prefer stripping media over deleting whole records**, and should prefer the highest-byte-cost, lowest-emotional-value data first — informed directly by §5/§10's measurements:
   - Priority 1: Nazori images beyond a configurable age/count threshold (highest byte cost, and §10 shows it's the structurally easiest and least risky to strip safely).
   - Priority 2: Sawatte raw trace points beyond a threshold (summary stats retained).
   - Priority 3: Hiragana/Katakana raw stroke samples beyond a threshold (pass/fail/score retained).
   - Priority 4 (last resort, and arguably out of scope for an "auto" feature at all — proposed as manual-only): whole-record deletion of the oldest simple flat-field records.
4. **Required user controls if this is ever built:** a visible current-usage indicator (using `navigator.storage.estimate()`, itself only reliable per the caveats in §6), a warning threshold notification *before* any auto-action fires, a way to review exactly what would be affected before confirming, and a way to turn the feature back off (reverting to today's unbounded-growth-with-silent-failure behavior, which — per §6 — is not obviously worse on a huge-quota browser, so opting out must remain a legitimate, respected choice, not something the UI nags about).
5. **This proposal deliberately does not specify exact thresholds/ages.** Setting real numbers requires real usage data this audit does not have (§7's projections are modeled, not measured), and should be revisited once real-device Safari/iOS quota behavior (Decision Gate C) is known — a threshold tuned for a 3GB Chromium quota would be catastrophically wrong for a hypothetical 5–10MB Safari one.

---

## 12. IndexedDB Migration Feasibility

| Dimension | Assessment |
|---|---|
| Existing IndexedDB usage in the repo | **None** (§3.4) — this would be a from-scratch build, not a migration of existing code. |
| Quota ceiling | IndexedDB shares the *same* Storage Standard quota bucket as `localStorage` on Chromium (§6) — migrating does **not** by itself increase the available space on a browser where `localStorage` already has huge headroom. Its main advantage over `localStorage` is not size but API shape (async, structured storage of binary data (`Blob`/`ArrayBuffer`) instead of base64-in-JSON-string). |
| Concrete benefit for this site | Storing Nazori images as `Blob`s instead of base64-in-a-JSON-string would save the ~33% base64 inflation overhead on the single largest byte-cost item on the site (§5, §7) — a real, quantifiable win independent of the quota-ceiling question. |
| Cost | A synchronous, single-file-per-app architecture (no bundler, hand-authored self-contained HTML pages per `CLAUDE.md`) would need every one of the 22 apps' save/read functions rewritten from the current synchronous `localStorage.getItem/setItem` calls to asynchronous IndexedDB transactions — a substantially larger, higher-risk change than anything undertaken in the prior Detail-Parity phases, touching the actual data-persistence layer of every app rather than an additive display layer on top of it. |
| Migration-of-existing-data cost | Any IndexedDB adoption would also need a one-time migration path reading each app's existing `localStorage` key and importing it into the new store, run once per browser profile, itself needing the same failure-safety rigor this audit found missing today (§4) so the migration itself doesn't become a new data-loss vector. |
| Recommendation | **Not justified by the storage-capacity problem alone** given the §6 finding that Chromium's real quota is already very large. It *would* be justified specifically for the base64-inflation savings on Nazori images, and as a prerequisite if the site ever wants binary (non-base64) media storage for other reasons — but that is a distinct, larger architectural decision than "fix the capacity risk," and should not be scoped as if it were the same project. See Decision Gate D. |

---

## 13. Privacy / Educational-Record Considerations

- **No per-child storage isolation exists anywhere in the Record Foundation.** With the sole exception of `kyou-no-kiroku` (which has its own internal `children[]` array), all 21 other apps store one undifferentiated log per browser/device. On a shared classroom device, records from multiple children accumulate interleaved in the same key with no boundary between them. This is a pre-existing architectural fact (not introduced or changed by this audit) but is directly relevant to the High-Shared-Device capacity scenario (§7) — more children on one device means more records/day into the same keys — and is worth flagging explicitly for future privacy-focused phases, separate from the capacity question this phase was chartered to investigate.
- `kyou-no-kiroku`'s `privacyLevel: 'high'` / `includeInDefaultTimeline: false` combination is the only place in the Record Foundation that treats data as sensitive enough to exclude from the shared dashboard by default — and it is also (§3.1.1, §4.2/R4) the one place where a save failure risks losing the most sensitive data on the site (child name, medical notes). Any future retention/cleanup design (§11) should treat this app's data with at least as much care as its own code already does, not less.
- Nazori and Hiragana/Katakana capture a child's actual handwriting/tracing work — arguably the most personally identifiable and emotionally significant artifact type this site produces (more so than a quiz score), and per §9 is exactly the type with zero backup coverage today.

---

## 14. Browser / Device Matrix

Honesty requirement: an environment not actually exercised in this phase is marked **NOT TESTED**, never PASS.

| Browser / Device | localStorage quota behavior | Real image/quota measurement | Status |
|---|---|---|---|
| Desktop Chromium (Playwright-bundled, this phase's test environment) | ~3GB, disk-relative Storage Standard bucket; no `QuotaExceededError` up to ~100MB single-key write | Yes (§5, §6) | **MEASURED** |
| Desktop/Android Chrome (real, non-Playwright build) | Assumed similar to above (same engine family) | Not independently re-run | **DOCUMENTATION-BASED**, not directly measured this phase |
| Safari / iOS Safari (incl. Private Browsing, home-screen "Add to Home Screen" PWA mode) | Historically smaller, more volatile limits; documented iOS low-storage eviction can clear site data without any JS-visible error | No environment available in this phase | **USER REAL-DEVICE REVIEW REQUIRED** — highest-priority gap, given likely classroom iPad usage |
| Firefox (desktop or Android) | Unknown for this site | No environment available | **NOT TESTED** |
| Older Chrome (pre-Storage-Standard-quota-model versions) | Likely the older, smaller fixed cap | No environment available | **NOT TESTED** |

---

## 15. Audit Tool Safety Notes

- All new files added by this phase live strictly under `tools/storage-capacity-audit/` (plus the two `docs/records/` deliverables) — no Production HTML/JS file was touched, and nothing under `tools/storage-capacity-audit/` is referenced by `generate.js`, the service worker's precache list, or any app page.
- `quota-and-image-size-test.py` asserts its resolved origin is exactly `http://127.0.0.1:8971` and contains no substring "donomana" before doing anything with `localStorage`; it aborts otherwise.
- The script only ever touches keys it created itself (`audit_quota_probe`, `audit_recovery_probe`) and calls `localStorage.clear()` on the disposable origin as a final step — verified in the run output (§6) to leave zero residual keys.
- No file, real or synthetic, was ever uploaded, transmitted, or written to any non-localhost destination.

---

## 16. Decision Gates

| Gate | Question | Required answer vocabulary | This audit's finding |
|---|---|---|---|
| **A** | Is the current silent-catch write-failure behavior (R1) acceptable to leave as-is until a future phase fixes it? | `ACCEPT-AS-IS` / `FIX-REQUIRED` / `FIX-REQUIRED-URGENT` | Recommend `FIX-REQUIRED` — not urgent given §6's Chromium headroom, but a CRITICAL finding that should not sit indefinitely, especially given R3/R4. |
| **B** | Should a Nazori-image-specific backup/export feature (§9, §10) be scoped as the first concrete follow-up phase? | `YES-NEXT-PHASE` / `YES-LATER` / `NO` | Recommend `YES-NEXT-PHASE` — highest ratio of user-value to implementation risk of everything this audit found (§9's "zero backup path" gap, §10's "High feasibility" assessment, §5/§7's "dominant byte cost" finding all point the same direction). |
| **C** | Should real-device Safari/iOS quota/eviction behavior be verified before any capacity-driven feature (retention design, IndexedDB) is scoped? | `REQUIRED-BEFORE-NEXT-PHASE` / `CAN-PROCEED-WITHOUT` | Recommend `REQUIRED-BEFORE-NEXT-PHASE` — §6/§7/§14 all show this is the single largest unresolved unknown; both this audit's own confidence and any future retention thresholds (§11.5) depend on it. |
| **D** | Should an IndexedDB migration (§11 for the "why", §12 for feasibility) be scoped as its own future phase? | `SCOPE-AS-OWN-PHASE` / `BUNDLE-WITH-RETENTION` / `NOT-NOW` | Recommend `NOT-NOW` (or `SCOPE-AS-OWN-PHASE` later if binary-media storage becomes a goal for reasons beyond capacity) — §12 found it is not justified by the capacity problem alone on the browser family this audit could measure. |
| **E** | Should the retention/auto-cleanup design in §11 be built as a real, default-OFF feature? | `BUILD-NEXT-PHASE` / `BUILD-LATER` / `DO-NOT-BUILD` | Recommend `BUILD-LATER`, gated behind Gate C — building real thresholds now would mean guessing at a number (§11.5) that Gate C's answer could invalidate. |
| **F** | Should the three out-of-scope storage vectors found incidentally (§3.2: `ongaku-compositions`, `register_img_<id>`, `tt_recordings`) be investigated in a dedicated follow-up audit? | `YES-DEDICATED-AUDIT` / `FOLD-INTO-NEXT-CAPACITY-PHASE` / `NO` | Recommend `FOLD-INTO-NEXT-CAPACITY-PHASE` — each is plausibly media-scale and outside the Record Foundation contract this site has otherwise standardized around; worth closing the gap, but doesn't warrant its own standalone phase given the likely small scope (3 apps) once someone looks. |

---

## 17. Selected Audit Questions Answered

(A representative subset of the full audit-question set this phase worked through; every claim below is cited to its section above.)

1. **How many apps actually participate in the Record Foundation today?** 22, re-derived from live code, not assumed (§3.1).
2. **Is the 22-app figure still accurate, or has it drifted?** Accurate; a stale "21" appears in one code comment only (R11).
3. **Does every save path handle a full quota gracefully?** No — all 22 share one silent-catch pattern (§4.1, R1).
4. **Does a failed write corrupt already-saved data, or only lose the new entry?** Only the new entry in 21 of 22 apps (append-only); `kyou-no-kiroku`'s whole-object rewrite makes this worse in principle (§3.1.1, §4.2, R4).
5. **Is there any existing cap on log growth?** No, at the array level, for any app (§4.3, R5). Yes, internally, for Sawatte's trace-point count and Hiragana/Katakana's points-per-stroke (§4.3).
6. **What is the single largest per-record storage cost on the site, and by how much?** Nazori images, 15–72KB, ~18–70× other record types (§5).
7. **Can real quota exhaustion be reproduced safely?** Not within a safe, bounded (~100MB) test on this Chromium build (§6) — itself an important finding, not a test failure.
8. **What does `navigator.storage.estimate()` report on this browser, and does it match the old "5–10MB" assumption?** 3GB; does not match the old assumption (§6).
9. **Is that 3GB figure representative of the site's actual deployment targets (school iPads etc.)?** Unknown — Safari/iOS untested (§6, §14, Gate C).
10. **Under modeled usage, does any scenario approach exhaustion within 12 months on the measured browser?** No, all three scenarios stay well under 3GB (§7).
11. **Under the same modeled usage, would any scenario approach a hypothetical Safari-style 5–10MB cap?** Yes — Typical School within ~2–4 months, High-Shared-Device within days (§7).
12. **Is there a whole-site backup/export feature?** No (§9).
13. **Is per-record CSV export complete for all data types?** No — raw Sawatte/Hiragana/Katakana trace data and the Nazori image itself are never included, only summary/metadata fields (§9).
14. **Could media be selectively cleaned up while keeping summaries?** Yes for all three L3 types, with Nazori being both the easiest and highest-value target (§10).
15. **Should any retention/cleanup feature default to ON?** No — proposed default OFF, explicit opt-in only (§11).
16. **Does the codebase already use IndexedDB anywhere?** No (§3.4, §12).
17. **Would migrating to IndexedDB solve the capacity problem?** Not by itself — same quota bucket on Chromium; its real benefit is avoiding base64 inflation for Nazori images specifically (§12).
18. **Are there storage vectors on the site outside the 22 audited apps that could also matter?** Yes — at least three identified, not deep-measured (`ongaku-compositions`, `register_img_<id>`, `tt_recordings`), flagged for follow-up (§3.2, R8, Gate F).
19. **Does every app/record type share one quota bucket, or are any isolated?** All share one origin-wide bucket, including the service worker's Cache API (§3.3, §3.5, R9).
20. **What is the single highest-priority next action this audit recommends?** Real-device Safari/iOS verification (Decision Gate C) — because it is the input every other capacity-related decision in this report (thresholds, urgency of R1, retention design) is conditional on.

---

## 18. Implementation Roadmap (candidate future phases, none scoped or started by this audit)

| Candidate phase | Depends on | Priority (this audit's view) |
|---|---|---|
| Real-device Safari/iOS storage-quota verification | — | Do first (Decision Gate C) |
| Nazori image backup/export feature | Nothing (can start independently) | High — best value/risk ratio found (Gate B) |
| Fix R1 (silent write-failure handling, all 22 apps) | Ideally after Gate C, so the fix's UX (e.g. a warning threshold) is tuned to the real quota picture, but could also be scoped narrowly (just "don't lose data silently," no threshold UI) without waiting | High, not urgent |
| Follow-up audit of `ongaku-compositions` / `register_img_<id>` / `tt_recordings` | — | Medium (Gate F) |
| Retention/auto-cleanup feature (§11) | Gate C's answer (for threshold tuning) | Medium, gated |
| IndexedDB migration | A separate decision to want binary media storage, not the capacity problem alone | Low / not currently justified (Gate D) |

---

## 19. Validation

- `node generate.js` was **not** run in this worktree — this phase made no changes to `apps-data.json`, any app HTML, or `generate.js` itself, so there is nothing to regenerate. Production's generated output is unaffected.
- `git status` in this worktree at the time of writing shows only the new files this phase added (`tools/storage-capacity-audit/*`, `docs/records/learning-record-storage-capacity-audit-v1_0.md`, `docs/records/data/learning-record-storage-capacity-measurements-v1_0.json`) — no existing file was modified.
- The 1406/1406 golden-test baseline from the prior `LEARNING-RECORD-DETAIL-PARITY-SIMPLE-BATCH-1` phase is unaffected: no file it exercises was touched.
- No commit was made in this worktree.

---

## 20. Final Report

**Status: `USER REVIEW READY`.**

Summary: this phase performed a code-verified and measurement-based audit of storage capacity, save-failure safety, backup/export completeness, media-cleanup feasibility, and IndexedDB migration feasibility across all 22 Record Foundation apps and the three L3 Rich Visualization types, plus a repo-wide inventory sweep that surfaced additional out-of-scope storage vectors for future follow-up. It found one universal CRITICAL defect (silent save-failure handling, identical in all 22 apps) and one universal CRITICAL gap (no media backup/export path), assessed their real-world likelihood as currently unknown pending real-device Safari/iOS verification, and produced a non-implemented retention-design proposal and IndexedDB feasibility assessment for future phases to draw on. No Production code was changed. Nothing was committed, pushed, merged, or deployed.

Stopping here for User Review. Awaiting explicit User Approval before any further action (including, per this phase's own recommendation in Decision Gate B/C, before scoping any follow-up implementation phase).
