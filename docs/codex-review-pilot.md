# Codexレビュー連携 Pilot（検証専用・マージ禁止）

このファイルおよびこのPull Requestは、Claude Codeが作成したGitHub Draft PRをOpenAI Codex（`@codex review`）がレビューできるかどうかを安全に検証するための、**実証専用**の変更です。

## 目的

- Claude Code Cloud と Codex のPRレビュー連携が、既存のChatGPT Plus/Pro契約の範囲内で成立するかを確認する。
- Codexが投稿したレビュー結果をClaude Code Cloudが読み取れることを確認する。

## 重要な注意

- **このPRはProductionにマージしません。**
- アプリ本体・`generate.js`・`apps-data.json`・GitHub Actionsワークフロー（`generate.yml` / `quality-audit.yml` / `a11y-audit.yml`）など、既存のファイルは一切変更していません。
- 変更はこのMarkdownファイル1件のみです。
- 検証完了後、このPRはクローズされる想定です。

## 関連

DONOMANA-CODEX-PR-REVIEW-PILOT-PREPARATION-1（調査）/
DONOMANA-CODEX-PR-REVIEW-PILOT-IMPLEMENTATION-1（本実装）
