# WCAG-JIS-AUDIT-1-TIER1: Browser Gate / Structure Gate結果

- 対象: register-app・matching-app・time-timer・mogura-tataki・okane-app・scratch-app・nazorin-print・schedule-app・janken-app・tokei-app・tyushi・gaze-keyboard(12アプリ)
- 実行環境: Python Playwright(Chromium)、`python -m http.server`
- 生データ: `tools/accessibility-audit/tier1/static-audit-results.json`、`tools/accessibility-audit/tier1/browser-audit-results.json`

## 1. Structure Gate(静的、12アプリ全件)

| 項目 | 結果 |
|---|---|
| duplicate id | 全12アプリで0件 |
| broken aria-labelledby/describedby/controls/owns | 全12アプリで0件 |
| tabindex異常(-1/0以外) | 全12アプリで0件 |
| `<main>` | 全12アプリで存在 |
| h1数(静的grep) | 全12アプリで1件 |

Structure Gateは全12アプリでクリーン。

## 2. Browser Gate(Playwright、12アプリ全件)

| 項目 | 結果 |
|---|---|
| ページload | 全12アプリで成功 |
| console/page error | 全12アプリで0件 |
| responsive overflow(375×667/390×844/768×1024/1280×900/200%zoom) | 全12アプリ・全条件で0件 |
| 共通A11yパネル開閉 | 全12アプリで正常 |

## 3. 既定状態(モーダル非表示)heading構造 — Audit plan v1.1のruntime判定条件を適用

判定条件: `offsetParent!==null && !closest('[aria-hidden="true"]') && !closest('[inert]')`

| app | 既定状態で到達可能な見出し |
|---|---|
| register-app | H1, H2(`#products-heading`) |
| matching-app | H1 |
| time-timer | H1 |
| mogura-tataki | H1 |
| okane-app | H1 |
| scratch-app | H1 |
| nazorin-print | H1 |
| schedule-app | H1 |
| janken-app | H1 |
| tokei-app | H1 |
| **tyushi** | **(なし、0件)** |
| gaze-keyboard | H1 |

### 重大な発見: TIER1-F1(tyushiのH1が既定状態で到達不能)

tyushi.htmlの唯一の`<h1>`要素は、既定で非表示の`#help-overlay`(ヘルプモーダル)内の`#help-box`に存在する(`<h1><span class="app-icon">✨</span>ひかるボタン　使い方</h1>`)。ページ本体(`<main>`内)には見出し要素が一切ない。

**根本原因**: `tools/main-heading-audit/audit.js`(AUDIT-35で使用)は`<h1>`タグの**静的出現数**のみを数えており、実行時の可視性(モーダル内かどうか)を判定していない。そのためtyushiは「h1=1、条件を満たす」と判定されてきたが、実際にはページの通常状態(モーダルを開く前)でheading-navigationを行うスクリーンリーダー利用者は**見出しを1件も発見できない**。

これはAUDIT-35自体の監査ツールの盲点であり、他のTier2/3アプリにも同型の問題が存在する可能性がある(横展開調査は本Phaseでは未実施、Fix Backlogへ記録)。

## 4. Modal / Focus Trap 静的パターン監査(12アプリ全件)

`role="dialog"`出現数、Tab keydown handler数、`donomanaA11yPanel`参照の近接有無(ヒューリスティック)、`inert`使用有無を機械的に収集し、疑わしいケースは直接コードを読んで確認した。

| app | dialogs | Tab handler数 | A11yパネル例外(コード確認済み) | inert使用 |
|---|---|---|---|---|
| register-app | 9 | 2(record-modal, product-modal) | ❌ なし(直接確認) | あり |
| matching-app | 7 | 1(共有) | ✅ あり(AUDIT-35 F2で実証済み) | あり |
| time-timer | 6 | 4(finishOverlay/PINモーダル群/helpModal/switch-scan用Tab流用×1) | ❌ なし(3件のmodal trapを直接確認) | あり |
| mogura-tataki | 6 | 0 | Focus Trap自体が存在しない | なし |
| okane-app | 5 | 1(共有) | ✅ あり(POST-AUDIT-35-HARDEN-1で実装) | あり |
| scratch-app | 5 | 0 | Focus Trap自体が存在しない | なし |
| nazorin-print | 4 | 0 | Focus Trap自体が存在しない | なし |
| schedule-app | 4 | 1(共有、+switch用Tab流用×1) | ✅ あり(端点循環型、直接確認) | なし(端点循環型は背景inertを前提としない設計) |
| janken-app | 3 | 1(record-modal-backdrop) | ❌ なし(直接確認) | あり |
| tokei-app | 3 | 2(helpModal, recordModal) | ❌ なし(直接確認、両方) | あり |
| tyushi | 3 | 0 | Focus Trap自体が存在しない | なし |
| gaze-keyboard | 2 | 1(settingsModal、POST-AUDIT-35-HARDEN-3で対応済み) | ✅ あり(settingsModalのみ) | あり |

詳細はFinding Register(`tier1-findings.md`)のFocus Trap Finding Family(FT-1/FT-2)を参照。
