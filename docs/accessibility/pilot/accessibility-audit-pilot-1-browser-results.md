# Accessibility Audit Pilot-1: Browser Gate結果

- Phase: ACCESSIBILITY-AUDIT-PILOT-1
- 実行環境: Python Playwright(Chromium 151.0.7922.34)、`python -m http.server`によるローカル配信
- 対象: matching-app / okane-app / gaze-keyboard / tokei-app / timetable-app
- 生データ: `tools/accessibility-audit/pilot/browser-results.json`(本ファイル執筆時点の実行結果)、再現用script: `tools/accessibility-audit/pilot/browser-check.py`

## 1. Console / Page Error

全5アプリでload時のconsole error・page error **0件**。

## 2. Responsive / Zoom overflow

375×667 / 390×844 / 768×1024 / 1280×900 / 1280×900+200%zoom の全組み合わせで、5アプリすべて横スクロールoverflowなし(`scrollWidth <= clientWidth`)。

## 3. 既定状態(モーダル非表示)のheading構造

**重要な方法論上の発見**: 当初`offsetParent !== null`のみでフィルタしたところ、tokei-appで`opacity:0`+`inert`+`aria-hidden="true"`というCSS transition対応のモーダル隠蔽方式が"visible"と誤判定され、モーダル内h2〜h4が既定状態でも検出される偽陽性が発生した。逆に`aria-hidden`/`inert`祖先の除外のみでフィルタすると、今度は`display:none`方式(okane-app/matching-app)のモーダルが偽陽性で拾われた。**`offsetParent !== null` かつ `aria-hidden`/`inert`祖先なし の両方を満たす場合のみ「実際にAT到達可能」と判定する必要がある**と判明。

この修正後の正しい判定では、**5アプリすべてで既定状態はH1のみ**(モーダル内コンテンツはいずれの隠蔽方式でも正しくAT到達不可)であることを確認した。

| app | 修正前(offsetParentのみ) | 修正前(aria-hidden/inertのみ) | 修正後(両方) |
|---|---|---|---|
| matching-app | H1のみ | H1→H2→H3×6(コメント文字列誤検出、後述) | **H1のみ** |
| okane-app | H3×9→H1(誤検出) | H3×9→H1(誤検出) | **H1のみ** |
| gaze-keyboard | H1のみ | H1のみ | **H1のみ** |
| tokei-app | H1→H2→H3×2→H4×4→H3→H4×2→H3×2→H2(誤検出) | H1→H3→H4×4(誤検出) | **H1のみ** |
| timetable-app | H1のみ | H1のみ | **H1のみ** |

(matching-appの「修正前・aria-hidden/inertのみ」列は別途、静的正規表現スキャンがCSSコメント文中の`<h2>`という**文字列**を実タグと誤検出したことによる二重の偽陽性であり、Playwright実行時DOM評価では発生しない。静的grepベースの見出し検査には別途この種の偽陽性リスクがあることも合わせて記録する。)

## 4. モーダルAudit(既知の開閉トリガーで到達可能なもの)

| app | modal | visible after open | aria-labelledby/label | 初期focusがモーダル内 | Escapeで閉じる | close関数で閉じる |
|---|---|---|---|---|---|---|
| matching-app | how-ov | ✅ | ✅ | ✅ | ✅ | ✅ |
| matching-app | settings-ov | ✅ | ✅ | ✅ | ✅ | ✅ |
| matching-app | record-ov | ✅ | ✅ | ✅ | ✅ | ✅ |
| okane-app | helpModalOverlay | ✅ | ✅ | ✅ | ✅ | ✅ |
| okane-app | settingsModalOverlay | ✅ | ✅ | ✅ | ✅ | ✅ |
| okane-app | recordsModalOverlay | ✅ | ✅ | ✅ | ✅ | ✅ |
| okane-app | customModalOverlay | ✅ | ✅ | ✅ | ✅ | ✅ |
| **gaze-keyboard** | **settingsModal** | ✅ | ✅ | **❌(Finding PILOT-F1参照)** | ✅ | ✅ |
| tokei-app | helpModal | ✅ | ✅ | ✅ | ✅ | ✅ |
| tokei-app | recordModal | ✅ | ✅ | ✅ | ✅ | ✅ |
| timetable-app | (対象モーダルなし) | - | - | - | - | - |

matching-appのvs-result-ov/clear-ov(対戦結果・クリア画面)は実プレイを進めないと到達できないため、本Pilotの自動監査からは除外し**Needs Manual Review**とした(§Finding Register参照)。

## 5. A11yパネル

全5アプリで共通A11yパネルの開閉(⚙️ボタンクリック)が正常に機能することを確認。

## 未実施(Manual Only)

Contrast計算、実SR(NVDA/VoiceOver)、実Switchデバイス、実Gazeデバイス、実指Touch操作 — いずれも本Browser Gateの対象外。`accessibility-audit-pilot-1-manual-review.md`を参照。
