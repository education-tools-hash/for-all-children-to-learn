# WCAG-JIS-AUDIT-1-TIER3: Browser Gate / Structure Gate結果

- 対象: nazori-app・timetable-app・yomikaki-app・sugoroku-app・sst-app・slideshow-sakusei(6アプリ)
- 実行環境: Python Playwright(Chromium)、`python -m http.server`
- 生データ: `tools/accessibility-audit/tier3/static-audit-results.json`、`tools/accessibility-audit/tier3/browser-audit-results.json`

## 1. Structure Gate(静的、6アプリ全件)

| 項目 | 結果 |
|---|---|
| duplicate id | 5アプリで0件。**sugoroku-appで1件検出(`sce-prev-ic`)** — 直接コード確認の結果、静的マークアップ(sugoroku-app.html:1310)とJSテンプレート再描画(`updateScePreview()`が親要素`#sce-preview`ごと`innerHTML`で置換、sugoroku-app.html:2124)が異時点で同一idを使うのみで、実行時に同時存在する重複ではないと確認(Tier2のbosai-app`bag-max`と同型の誤検知。Findingとして計上しない) |
| broken aria-labelledby/describedby/controls/owns | 全6アプリで0件 |
| tabindex異常(-1/0以外) | 全6アプリで0件 |
| `<main>` | 全6アプリで存在 |
| h1数(静的grep) | 全6アプリで1件 |
| heading hierarchy | 5アプリで正常。**yomikaki-appでH1直後にH2を経由せずH3が4件連続する階層スキップを検出** → 正式Finding化(TIER3-F1) |

## 2. Browser Gate(Playwright、6アプリ全件)

| 項目 | 結果 |
|---|---|
| ページload | 全6アプリで成功 |
| console/page error | 全6アプリで0件 |
| responsive overflow(375×667/390×844/768×1024/1280×900) | 5アプリで0件。**slideshow-sakuseiで375×667・390×844の2条件を検出** → 正式Finding化(TIER3-F2) |
| responsive overflow(1280×900、200%zoom) | 5アプリで0件、**slideshow-sakuseiのみ検出**(TIER3-F2に含む) |
| 共通A11yパネル開閉 | 全6アプリで正常(opens/closes ともにtrue) |

## 3. 既定状態(既定非表示要素なし)heading構造 — Layer2 Accessibility Reachable判定

`tools/main-heading-audit/runtime-results.json`(全35アプリ対象)から6アプリ分を抽出。

| app | staticH1Count | accessibilityReachableCount | runtimeVisibleCount | 判定 |
|---|---|---|---|---|
| nazori-app | 1 | 1 | 1 | PASS |
| timetable-app | 1 | 1 | 1 | PASS |
| yomikaki-app | 1 | 1 | 1 | PASS |
| sugoroku-app | 1 | 1 | 1 | PASS |
| sst-app | 1 | 1 | 1 | PASS |
| slideshow-sakusei | 1 | 1 | 1 | PASS |

**6/6 PASS。TIER1-F1相当(既定状態でheading到達不能)の再発は0件。**

## 4. Modal / Focus Trap 静的パターン監査(6アプリ全件)

`role="dialog"`出現数は全6アプリで1件(共通A11yパネルのみ)。**app固有モーダルは6アプリ中0アプリ** — Audit plan自身の「Tier3=単純構造」という位置づけが実測データでも裏付けられた。

| app | role="dialog"(raw) | app固有モーダル | 破壊的操作の確認方式 |
|---|---|---|---|
| nazori-app | 1(共通のみ) | 0 | ネイティブ`confirm()`使用(コード確認) |
| timetable-app | 1(共通のみ) | 0 | ネイティブ`confirm()`使用 |
| yomikaki-app | 1(共通のみ) | 0 | ネイティブ`confirm()`使用 |
| sugoroku-app | 1(共通のみ) | 0 | ネイティブ`confirm()`使用 |
| sst-app | 1(共通のみ) | 0 | ネイティブ`confirm()`使用 |
| slideshow-sakusei | 1(共通のみ) | 0 | ネイティブ`confirm()`使用 |

**FF-A(A11yパネル互換性)・FF-B(Focus Trap欠如)・FF-D(Focus Restoration)・FF-E(背景抑制)・FF-F(Initial Focus)は6アプリ全件でN/A**(対象となるapp固有モーダル自体が存在しないため)。ネイティブ`confirm()`ダイアログはブラウザ標準実装のため、Focus Trap/初期focus/ARIA属性はブラウザ自身が保証しており、本Audit範囲の対象外とする(Audit plan §23の境界通り)。

## 5. TIER3-F1: yomikaki-appの見出し階層スキップ

yomikaki-app.html:683の`<h1>`直後、684〜691行の「つかいかた」ステップ4件が`<h2>`を経由せず`<h3>`(688-691行)として実装されている。695行目以降で初めて`<h2>`(「✨ できること」「🎮 スイッチスキャンについて」)が出現し、753行目以降の設定サブセクションは708行目の`<h2>`配下に正しく`<h3>`としてネストされている(こちらは正常)。

問題箇所は先頭の「H1→H3×4→H2→H2→(正常なH3群)」という順序で、H1の直後に本来あるべきH2を経由せずH3へ飛んでいる点。

## 6. TIER3-F2: slideshow-sakuseiのReflowオーバーフロー

375×667・390×844(通常のモバイル幅)および1280×900の200%zoomでhorizontal overflowを検出。

**根本原因**: `slideshow-sakusei.html:165`の`body{...overflow-x:auto;...min-width:760px;}`により、bodyに明示的な最小幅760pxが設定されている。`overflow-x:auto`が同時に指定されていることから、760px未満の画面幅では横スクロールへフォールバックする設計と見られ、Tier2のTIER2-F5(drawing-appのcanvas固定サイズ、意図しないバグ)とは性質が異なり、**意図的なデスクトップ最小幅設計の可能性がある**。ただしコード中に設計意図を示すコメントは見当たらず、モバイル幅(375px/390px)でも横スクロールが発生する点は、Tier2のTIER2-F5(200%zoom時のみ発生)より影響範囲が広い。
