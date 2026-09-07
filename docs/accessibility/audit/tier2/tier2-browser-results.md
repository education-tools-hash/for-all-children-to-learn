# WCAG-JIS-AUDIT-1-TIER2: Browser Gate / Structure Gate結果

- 対象: hiragana-learn・katakana-app・shiritori2・bosai-app・cup_game・ongaku-app・kimochi-board・drawing-app・directions-app・suji-manabou・kyou-no-kiroku・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app(17アプリ)
- 実行環境: Python Playwright(Chromium)、`python -m http.server`
- 生データ: `tools/accessibility-audit/tier2/static-audit-results.json`、`tools/accessibility-audit/tier2/browser-audit-results.json`

## 1. Structure Gate(静的、17アプリ全件)

| 項目 | 結果 |
|---|---|
| duplicate id | 16アプリで0件。**bosai-appで1件検出(`bag-max`)** — 直接コード確認の結果、静的マークアップとJSテンプレート再描画(`innerHTML`で親要素ごと置換)が同一idを異時点で使うのみで、実行時に同時存在する重複ではないと確認(ヒューリスティックの誤検知。Findingとしては計上しない) |
| broken aria-labelledby/describedby/controls/owns | 16アプリで0件。**katachi-awase-appで1件検出** → 直接コード確認で実害を確認、正式Finding化(TIER2-F6) |
| tabindex異常(-1/0以外) | 全17アプリで0件 |
| `<main>` | 全17アプリで存在 |
| h1数(静的grep) | 全17アプリで1件 |

## 2. Browser Gate(Playwright、17アプリ全件)

| 項目 | 結果 |
|---|---|
| ページload | 全17アプリで成功 |
| console/page error | 全17アプリで0件 |
| responsive overflow(375×667/390×844/768×1024/1280×900) | 全17アプリ・全4条件で0件 |
| responsive overflow(1280×900、200%zoom) | **16アプリで0件、drawing-appのみ検出** → 正式Finding化(TIER2-F5) |
| 共通A11yパネル開閉 | 全17アプリで正常(opens/closes ともにtrue) |

## 3. 既定状態(モーダル非表示)heading構造 — Audit plan v1.1 runtime判定条件 + Layer2 Accessibility Reachable判定

`tools/main-heading-audit/runtime-results.json`(全35アプリ対象、TOOL-HARDEN-1で確立)から17アプリ分を抽出。判定条件はAccessibility Reachable(`hidden`/`aria-hidden="true"`/`inert`/`display:none`/`visibility:hidden`のいずれでも祖先含め排除されない)。

| app | staticH1Count | accessibilityReachableCount | runtimeVisibleCount | 判定 |
|---|---|---|---|---|
| hiragana-learn | 1 | 1 | 1 | PASS |
| katakana-app | 1 | 1 | 1 | PASS |
| shiritori2 | 1 | 1 | 1 | PASS |
| bosai-app | 1 | 1 | 1 | PASS |
| cup_game | 1 | 1 | 1 | PASS |
| ongaku-app | 1 | 1 | 1 | PASS |
| kimochi-board | 1 | 1 | 1 | PASS |
| drawing-app | 1 | 1 | 1 | PASS |
| directions-app | 1 | 1 | 1 | PASS |
| suji-manabou | 1 | 1 | 1 | PASS |
| kyou-no-kiroku | 1 | 1 | 1 | PASS |
| kurabeyou-app | 1 | 1 | 1 | PASS |
| katachi-awase-app | 1 | 1 | 1 | PASS |
| miru-hirogaru-app | 1 | 1 | 1 | PASS |
| mitsukete-touch-app | 1 | 1 | 1 | PASS |
| junban-miyou-app | 1 | 1 | 1 | PASS |
| dotchiga-ii-app | 1 | 1 | 1 | PASS |

**17/17 PASS。TIER1-F1相当(既定状態でheading到達不能)の再発は0件**(AUDIT-35-H1-IMPL-2でのtyushi修正・全35アプリ再監査が既にTier2アプリもカバー済みであったため)。

## 4. Modal / Focus Trap 静的パターン監査(17アプリ全件)

`role="dialog"`出現数、Tab keydown handler数、`donomanaA11yPanel`参照の近接有無(ヒューリスティック)、`inert`使用有無を機械的に収集し、疑わしいケースは直接コードを読んで確認した。app固有モーダルを持つのは17アプリ中6アプリ(残り11アプリはmodal数0でGate対象外)。

| app | app固有モーダル | dialogs(raw) | Tab handler | A11yパネル例外(コード確認済み) | inert使用 | 備考 |
|---|---|---|---|---|---|---|
| hiragana-learn | traceSampleViewer(1) | 2 | 0 | Focus Trap自体が存在しない | なし | role="dialog"あり、Escape・初期focus・focus復帰は実装済み |
| katakana-app | traceSampleViewer(1) | 2 | 0 | Focus Trap自体が存在しない | なし | hiragana-learnと同一パターン(共通実装) |
| shiritori2 | record-modal-backdrop(1) | 2 | 1 | ❌ なし(直接確認) | あり(モーダル自身に静的`inert`属性+動的トグル) | |
| bosai-app | help-modal(1) | 2 | 1 | ❌ なし(直接確認) | なし | |
| cup_game | helpModal(1) | 2 | 0 | Focus Trap自体が存在しない | なし | **初期focusも未実装**(TIER2-F3) |
| ongaku-app | modal-help(1)・modal-pin/modal-export/modal-share(3、role="dialog"すら未付与) | 3 | 1(modal-helpのみ) | modal-help: ❌ なし(直接確認)。他3件: 該当機構自体が不在 | なし | modal-pin/export/shareはrole/aria-modal/Escape/Focus Trap/初期focus/focus復帰のいずれも未実装(コード中コメントで意図的な既存挙動維持と明記) |

詳細はFinding Register(`tier2-findings.md`)を参照。
