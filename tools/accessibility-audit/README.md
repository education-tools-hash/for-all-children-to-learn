# accessibility-audit tools

Phase ACCESSIBILITY-AUDIT-PREP-1で作成。WCAG/JIS Accessibility Audit本体で使う監査専用tool群の置き場所。**Productionアプリコード(`package.json`等)への依存追加は行わない** — Python Playwrightは本セッション環境に既存導入済みのものをそのまま利用する。

## 構成

- `build-inventory.js` — `apps-data.json`/`generate.js`/`service-worker.js`/各アプリHTMLから35アプリの監査対象Inventoryを機械的に再構築するNode script(read-only)。
- `app-inventory.json` — 上記の生成結果(`donomana-wcag-jis-audit-plan-v1_0.md` §1の元データ)。

## Inventoryの再生成

```bash
node tools/accessibility-audit/build-inventory.js > tools/accessibility-audit/app-inventory.json
```

## ローカルHTTP Server標準(Playwright実ブラウザ検証用)

計画書 `docs/accessibility/donomana-wcag-jis-audit-plan-v1_0.md` §7を正本とする。要点のみ再掲:

```bash
# 通常アプリ監査用(リポジトリrootから配信)
python -m http.server <port> --bind 127.0.0.1 --directory <repo-root>
```

- port: worktree並行作業と衝突しないよう都度選択(固定しない)
- PWA Pilot対象(index.html / learning-records.html / janken-app.html / tokei-app.html)を監査する場合は、Service Worker登録の影響を隔離するため通常監査用serverとは別portを使うこと
- 検証後は`netstat`でLISTENING PIDを特定し停止すること(Windows: `taskkill //F //PID <pid>`)

## 既存の実ブラウザ監査tool(参考、本Phaseでは変更していない)

- `tools/matching-modal-focus-trap/`
- `tools/matching-modal-switch-scan/`
- `tools/pwa-poc/`
- `tools/theme-color-audit/`
- `tools/fullscreen-touch-target-audit/`
- `tools/settings-proxy-focus-audit/`
- `tools/main-heading-audit/`
- `tools/audit35-1/`(AUDIT-35-1原本監査、保全済み)

いずれも`from playwright.sync_api import sync_playwright`パターンで書かれており、上記ローカルserver標準と組み合わせてそのまま実行できる。
