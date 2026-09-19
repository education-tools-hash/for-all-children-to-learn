# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"どのまな" (donomana.jp) is a static site platform providing free ICT educational apps for special needs education. It is deployed on GitHub Pages.

## Governance: read this before doing anything

This repository is **public** and `main` is **Production** (GitHub Pages, `donomana.jp`): every push to `main` is deployed. These rules apply to every session, local or Cloud. Details live in [`donomana-dev-rules-v1.0-revised.md`](donomana-dev-rules-v1.0-revised.md) (§13 Git operations, §14 instructions for Claude Code, §15 checklists); this section only adds what that document does not say.

### 1. Source of truth

| What | Where |
|---|---|
| Production | GitHub **remote `main`** (`origin/main` as verified with `git ls-remote origin refs/heads/main`), not a local `main` |
| Active development | one dedicated branch **and** git worktree per Phase, created from the latest remote `main` |
| Local-only state | Not visible to Cloud or other machines. Never leave important work only in an uncommitted file, an unpushed branch, a temp directory, or `~/.claude` memory. |

Approved-but-unreleased work may exist only on remote non-`main` branches (`git ls-remote --heads origin`). Do not assume something is on `main`; check.

**Before starting on a new machine or in Cloud:** confirm the remote `main` hash, the list of remote branches, and the current `HEAD` of the branch you will work on. Use `git ls-remote` (read-only) before any `git fetch`.

### 2. Production safety and the Drift Gate

- Never work directly on `main`; never edit files in another Phase's worktree.
- **Drift Gate** at the start of a Phase and again immediately before any push to `main`: compare `git ls-remote origin refs/heads/main` with the hash the Phase was based on. If it changed, stop and report what changed and whether it can conflict. Do not reset, rebase, or merge on your own.
- Never merge or deploy something the user has not approved. Never force-push, rewrite history, delete branches/worktrees, or create tags without explicit instruction (dev rules §13.2).
- `main` currently has **no** branch protection or ruleset (checked via the unauthenticated public GitHub API on 2026-09-19; admin-only settings could not be read); nothing technical stops a push to it. The rules in this file are the only guard.

### 3. One Phase = one branch / worktree

Create `git worktree add -b <type>/<name> <path> origin/main` (types used here: `feature/`, `fix/`, `hotfix/`, `docs/`, `test/`, `design/`, `audit/`, `release/`, `chore/`). Check branch, `HEAD` and `git status` right after creating it. Keep the Phase's changes inside the Phase's stated scope; do not mix in cleanups, refactors, or another Phase's assets. Old worktrees and branches are cleaned up only when asked (delete a branch with `git branch -d` only after confirming it is an ancestor of `main`).

### 4. Approval model and Phase prompts

The Phase prompt defines what is allowed. Read its gates literally and do not generalise. When a prompt says nothing, stay inside the Phase worktree with local edits and ask before commit, push, or merge.

| Prompt says | You may | You may not |
|---|---|---|
| investigation only / read-only | read, run read-only commands, report | change files, commit, push, create branches or worktrees unless told |
| no commit before approval | edit, test, report the diff and wait | commit |
| checkpoint allowed | local commit **on the Phase branch** | push, merge |
| push allowed (branch) | push the Phase branch after checking workflow triggers (`.github/workflows/generate.yml` runs only on pushes to `main`) | push `main` |
| merge / Production release allowed | after Drift Gate, a **fast-forward** `git push origin <branch>:main` of the approved commit, then verify CI (`generate`, `pages build and deployment`) | rebase, merge commit, force-push, or release anything other than the approved commit |

If `main` moved after approval: stop, report, and (only if told) recreate the work from the latest `main` in a new worktree (cherry-pick the approved commits), re-run the tests, and release that.

**Approval is the user's, never yours.** Do not write or report "Approved", "User Approved", "Phase Closed", "Real Device Verified", "Safari/iPad Verified", "Blue2 Verified", or "Tobii Verified" unless the user said so in their own words about that exact Phase or mode. A similar-sounding message about something else is not approval; when in doubt record "not approved" and ask. Only automated results may be reported as automated results ("tests passed"), and status lines must say what was actually done.

### 5. Real-device boundary (Cloud cannot replace it)

These need the user's own device and eyes: iPad Safari, VoiceOver, Blue2 (Bluetooth switch) and other Bluetooth switches, Tobii Eye Tracker 5 and other gaze input, real touch / multi-touch, device-specific audio (speech synthesis voices, autoplay, BGM), and PWA / offline / Home Screen behavior (the Home Screen app can use a separate `localStorage` from Safari). Headless Chromium passing is **not** a real-device pass. Where a Phase requires a User Browser Review or a Real Device Gate, prepare it, present it, and stop; the user performs and declares it. If a device gate finds a defect in already-approved code, stop and propose a separate fix Phase.

### 6. Tests and validation (only what exists here)

Re-run the real tests every time; an earlier pass, a byte-identical file, or a clean `diff` is supporting evidence, never a substitute for executing the code. Do not invent commands.

- Build/regeneration: `node --check generate.js`, `node generate.js` (run it twice; the second run must change nothing), then `git diff` to look for unexpected or whitespace-only changes.
- Static: `git diff --check`.
- Node golden tests for the Learning Record dashboard: `for f in tools/record-dashboard-poc/*golden-tests.js; do node "$f"; done` (each prints its own pass count and exits non-zero on failure).
- Browser: `python tools/record-dashboard-poc/dashboard-realbrowser-test.py` (Python + Playwright + Chromium; loads `file://`).
- Other audits (accessibility, focus trap, touch targets, headings, tracing) are under `tools/<name>/`; read that folder's own README/script header before use.
- Deterministic browser suites for Backup / Save Safety / load-smoke / Restore (frozen clock, pinned timezone and locale) exist only on remote branches at the time of writing, not on `main`. Check `git ls-remote --heads origin` and do not assume they are here.
- Layout-sensitive checks depend on fonts: a Linux Cloud environment needs a Japanese font, and even then a Chromium result does not equal iPad Safari.

### 7. Generated files

- `index.html`'s `CHANGELOG` array and `app-details/*-detail.html` are generated; edit `generate.js` (`MANUAL_CHANGELOG`) or `apps-data.json` instead (details below).
- App pages (e.g. `hiragana-learn.html`) are hand-authored, but they contain **generator-injected blocks** marked `<!-- ...: 自動挿入 (generate.js) -->` ... `<!-- /... -->` (Learning Record Foundation, PWA/manifest links, favicon). Change the block's source in `generate.js`, not the block itself, or the next run overwrites it.
- `generate.js` calls `git log` to set `sitemap.xml` `lastmod` from each file's last commit date, so it needs **full git history**. On a shallow clone every file's "last commit" is the shallow boundary commit (and without `git` it falls back to file mtime), so `sitemap.xml` gets rewritten with wrong dates. CI uses `fetch-depth: 0`; do the same.
- The `generate` workflow runs `git add -A` and pushes to `main`. A stray file left in the working tree of a `main` push is committed to Production, so keep the tree clean and check `git status` before pushing.

### 8. Secrets and personal data (public repository)

Never commit: GitHub PATs, API keys, credential files, `.env`, session cookies, browser profiles, private keys, or any personal authentication material. Do not read or copy credentials (`~/.claude`, the OS credential store) into a repository or into Cloud. `app-register.html` contains a token-shaped input placeholder (`ghp_` followed by a run of `x` characters), which is not a credential and must not be "fixed" or flagged as a leak; that page accepts a token typed by a user at runtime, so do not use it in Cloud sessions. Use synthetic data in tests and device gates: no learner names, school names, or real records; do not record local usernames or machine names in committed documents.

### 9. Windows / Cloud portability

Development so far was on Windows (PowerShell and Git Bash); Cloud is likely Linux. Use `python3` if `python` is missing. Do not bring Windows-only hooks (PowerShell notification hooks), the Windows Credential Manager, or absolute Windows paths into the repository or into Cloud. CI runs on `ubuntu-latest` with Node 20 and has no `package.json`, lockfile, or install step.

### 10. Reporting

Report in Japanese (dev rules §14.7 format), state what was and was not verified, and include any generation run and its diff summary. If a notification tool is available, notify the user when a substantial Phase finishes.

### 11. Multi-Agent operation (Claude Code, Codex, and any future agent)

Every rule above binds every agent that works in this repository, not just Claude Code. This section adds what changes when more than one agent (Claude Code, ChatGPT/Codex, or others) may work on it, in the same session or across sessions.

- **Source of truth is still `origin/main`** (§1) regardless of which agent is asking — always verify it fresh with `git ls-remote`/`git fetch`, never trust a hash another agent reported earlier in the conversation or in a doc.
- **1 Phase = 1 dedicated branch/worktree (§3), and one agent at a time per branch.** Claude Code and Codex (or any two agents) must never edit the same branch concurrently. Before starting work on an existing branch, check whether another agent's handoff note (below) or an open Phase says it is still in use; if so, create a new Phase branch from `origin/main` instead of reusing it.
- **Do not implicitly continue another agent's unfinished branch.** A branch left mid-Phase by a different agent is that agent's in-progress work, not a shared queue. Resume it only when the user explicitly hands it to you (naming the branch and Phase), and only after reading its own handoff note and re-running the Drift Gate.
- **Handoff note required on every agent switch.** Before ending a Phase that another agent (or a later session) may continue, leave a short handoff — as the Phase's final report and, if the Phase is not finished, also as a checkpoint commit message or a note in the Phase branch — with at least:
  - Phase name
  - `origin/main` SHA the Phase was based on
  - branch name
  - worktree path
  - latest checkpoint SHA
  - what is done
  - what is not done
  - tests actually executed (and their results)
  - User Review status (reviewed / not yet reviewed — never inferred)
  - Real Device Gate status (PENDING / user-reported result — never claimed as performed by the agent)
  - scope / non-goals of the Phase
- **Audit-only Phases never change Production code**, for any agent: read, compare, report findings: no edits, no commits, unless the prompt explicitly upgrades the Phase to a fix Phase.
- **No agent represents User Approval.** §4's rule ("Approval is the user's, never yours") applies identically to Codex and any other agent: never write or report "Approved", "User Approved", "Phase Closed", or similar on the user's behalf.
- **No agent claims a physical Real Device Gate it did not perform.** §5's boundary (iPad Safari, VoiceOver, Blue2, Tobii, real touch, device-specific audio, PWA/Home Screen storage) applies to every agent equally: prepare the gate, present it, stop; only the user's own report of running it counts as a result.
- **Drift Gate (§2) is mandatory before any Production release**, and doubly so in multi-agent use: another agent may have moved `origin/main` since this Phase started. Re-verify immediately before the release push, not just at Phase start.
- **Conflict resolution order when agents disagree** on how to interpret a requirement: this `CLAUDE.md`, then any design/contract document it points to (e.g. `donomana-dev-rules-v1.0-revised.md`, `docs/design-system/`), then the most recent **User Approved** checkpoint for that feature. An agent's own prior output (from this or another agent) is not a tiebreaker.
- **Do not guess past an unclear point.** If a Phase prompt, a handoff note, or the repository state leaves a real ambiguity (which branch is authoritative, what "approved" refers to, conflicting instructions between agents), stop and report the ambiguity instead of picking an interpretation and continuing.

## Build Commands

```bash
# Regenerate all app detail pages from apps-data.json
node generate.js

# Generate app mockup images and icons (requires Python + Playwright)
python tools/make-mockups.py
```

There is no `package.json`. `generate.js` runs with plain Node.js (v20). The GitHub Actions workflow (`.github/workflows/generate.yml`) runs `node generate.js` automatically on every push to `main` and auto-commits the generated files.

## Architecture

### Data-Driven Static Site

All app metadata lives in `apps-data.json` (the master source of truth). `generate.js` reads this file and generates individual HTML detail pages in `app-details/`.

The older `apps.json` is a simpler legacy format and is not the source for page generation.

### Two Distinct Types of HTML Files

1. **Generated detail pages** (`app-details/*-detail.html`): Auto-generated by `generate.js` from `apps-data.json`. Never edit these by hand—they will be overwritten.

2. **Interactive app pages** (root-level files like `hiragana-learn.html`, `tokei-app.html`, etc.): Standalone self-contained web applications. These are hand-authored and not generated.

3. **`index.html`**: The main landing/listing page. Hand-authored with a static app card grid and filter UI.

### apps-data.json Schema

Each app entry defines: `id`, `filename`, `icon`, `iconColor`, `title`, `category`, `tags_display`, `summary`, `features[]`, `steps[]`, `lesson{}`, `a11y[]`, `badges[]`, SEO fields (`seoTitle`, `seoDescription`, `seoKeywords`, `sitemapPriority`), and flags (`isRecommend`, `isNew`).

Adding a new app requires: adding an entry to `apps-data.json`, creating the interactive app HTML file, then running `node generate.js` to produce its detail page.

### Changelog (index.html "更新履歴")

The `const CHANGELOG = [...]` array embedded in `index.html` is a **generated artifact, not the source of truth**. It is overwritten on every `node generate.js` run from `generate.js`'s `MANUAL_CHANGELOG` array (combined with auto-generated entries derived from each app's `releaseDate` in `apps-data.json`). **Never edit the `CHANGELOG` array in `index.html` directly** — those edits will be silently discarded the next time `generate.js` runs (e.g. via the CI workflow on every push to `main`). To add or change a changelog entry, edit `MANUAL_CHANGELOG` in `generate.js` (dates use `"YYYY-MM-DD"` format) and run `node generate.js` to regenerate `index.html`.

### Category System

`generate.js` enforces a canonical category mapping (`CATEGORY_TRUTH` object). The four valid categories are:
- `学習アプリ` (Learning Apps)
- `認知支援` (Cognitive Support)
- `自立活動` (Self-directed Activity)
- `創作表現` (Creative Expression)

### Asset Generation

`tools/make-mockups.py` uses Playwright (headless Chromium) to:
- Capture desktop (1280×800) and mobile (390×780) screenshots of each app
- Composite them into 1200×630 OGP mockup images saved to `assets/mockups/`
- Generate 512×512 app icons with pastel gradients to `assets/icons/`

The color palette in `make-mockups.py` must match the HSL-based pastel color logic in `generate.js`.

### Accessibility

Apps are categorized by accessibility support markers in `apps-data.json`'s `a11y` field:
- `スイッチスキャン` — single-switch scanning navigation
- `視線入力` — gaze tracking input

These flags affect how apps are presented in detail pages and filtering.
