# Global Fix Roadmap(35アプリ累積、Phase分割案)

`global-fix-triage-1.md`・`contrast-finding-family-matrix.md`・`manual-review-strategy.md`の結論を統合したPhase順序案。**本ファイルは計画のみで、実装は行わない。**

---

## 1. Fix Priority分類

| Priority | 定義 | 該当Finding |
|---|---|---|
| Priority 1 | P1・high impact・複合構造課題 | TIER2-F3(ongaku-app分) |
| Priority 2 | P2・構造的Fix | TIER1-F2/F3・TIER2-F1/F2/F5・TIER1-F5・TIER3-F2 |
| Priority 3 | P3・意味論/視覚的Fix | TIER3-F1・TIER1-F4/TIER2-F4/TIER3-F3(Contrast) |
| Spec Decision | 実装前に方針確定が必要 | TIER1-F6(背景抑制)・TIER1-F5(Focus Restoration正式要件)・TIER3-F2(モバイル対応方針)・FAMILY-B実装方式 |

## 2. Fix Type分類

| Finding | Fix Type |
|---|---|
| TIER1-F2 / TIER2-F1(FAMILY-A) | QUICK FIX(既存パターン横展開、Spec Decision不要) |
| TIER1-F3 / TIER2-F2(FAMILY-B) | STRUCTURAL FIX(Spec Decision待ち) |
| TIER2-F3 ongaku-app分(FAMILY-C) | STRUCTURAL FIX + SPEC DECISION(FAMILY-A/B/C複合) |
| TIER1-F5(FAMILY-D) | SPEC DECISION FIRST |
| TIER1-F6(FAMILY-E) | SPEC DECISION FIRST |
| TIER1-F4/TIER2-F4/TIER3-F3(FAMILY-F) | FAMILY FIX(トークン単位) + MANUAL REVIEW FIRST(273件側) |
| TIER2-F5(FAMILY-G、drawing-app) | STRUCTURAL FIX(技術調査のみ、Spec Decision不要) |
| TIER3-F2(FAMILY-G、slideshow-sakusei) | SPEC DECISION FIRST |
| TIER3-F1(FAMILY-H) | QUICK FIX |
| Manual Review全般 | MANUAL REVIEW FIRST |

---

## 3. 推奨Phase順序

| # | Phase名(仮称) | Finding Family | 対象 | 種別 | 依存関係 |
|---|---|---|---|---|---|
| 1 | WCAG-JIS-MODAL-SPEC-DECISION-1 | FAMILY-B/D/E | Spec Decision全般 | SPEC DECISION | なし(最優先) |
| 2 | WCAG-JIS-FIX-FAMILY-A-1 | FAMILY-A(TIER1-F2・TIER2-F1) | register-app・time-timer・janken-app・tokei-app・shiritori2・bosai-app・ongaku-app(modal-help) | QUICK FIX | Spec Decision不要、#1と並行着手可 |
| 3 | WCAG-JIS-FIX-MODAL-ONGAKU-1 | FAMILY-A/B/C複合 | ongaku-app(modal-pin/export/share) | STRUCTURAL FIX | #1(Focus Trap実装方式)の決定後 |
| 4 | WCAG-JIS-FIX-FAMILY-B-1 | FAMILY-B(TIER1-F3・TIER2-F2残り) | mogura-tataki・scratch-app・nazorin-print・tyushi・gaze-keyboard・hiragana-learn・katakana-app・cup_game | STRUCTURAL FIX | #1の決定後 |
| 5 | WCAG-JIS-FIX-FOCUS-RESTORATION-1 | FAMILY-D | register-app | STRUCTURAL FIX | #1(Focus Restoration標準)の決定後 |
| 6 | WCAG-JIS-FIX-REFLOW-DRAWING-1 | FAMILY-G | drawing-app | STRUCTURAL FIX | なし、独立着手可 |
| 7 | WCAG-JIS-FIX-REFLOW-SLIDESHOW-1 | FAMILY-G | slideshow-sakusei | SPEC DECISION → STRUCTURAL/DESIGN FIX | モバイル対応方針決定後 |
| 8 | WCAG-JIS-FIX-HEADING-YOMIKAKI-1 | FAMILY-H | yomikaki-app | QUICK FIX | なし、独立着手可(最速で着手可能) |
| 9 | WCAG-JIS-FIX-CONTRAST-TOKEN-1 | FAMILY-F(共有トークン) | register-app・time-timer・sst-app | FAMILY FIX | なし |
| 10 | WCAG-JIS-FIX-CONTRAST-APP-1 | FAMILY-F(アプリ内トークン、上位4アプリ) | schedule-app・register-app・kimochi-board・yomikaki-app | FAMILY FIX | #9と一部並行可 |
| 11 | WCAG-JIS-FIX-CONTRAST-APP-2 | FAMILY-F(残り) | 残り12アプリ | FAMILY FIX | #10の後 |
| 12 | WCAG-JIS-MANUAL-SR-GATE-1 | Manual Review | 代表12〜13アプリ(NVDA/VoiceOver) | MANUAL REVIEW | #2〜#11のFix完了後(Fix対象アプリを優先確認) |
| 13 | WCAG-JIS-MANUAL-SWITCH-GAZE-GATE-1 | Manual Review | 代表アプリ(Blue2/Tobii) | MANUAL REVIEW | #12と並行可 |
| 14 | WCAG-JIS-MANUAL-CONTRAST-GATE-1 | Manual Review | Contrast代表(gradient/image/state) | MANUAL REVIEW | #9〜#11完了後 |
| 15 | WCAG-JIS-FINAL-RE-AUDIT-1 | 全Family | 35アプリ全数 | RE-AUDIT | #1〜#14完了後 |

**#2(FAMILY-A)・#6(drawing-app)・#8(yomikaki-app)はSpec Decision不要のため即時並行着手可能。** #1(Spec Decision)の結果次第で#3・#4・#5の実装方式が確定する。

---

## 4. User Review負荷最適化

35アプリを1つずつUser Reviewする方式は避け、以下を提案する:

- **同一Finding Family・同一実装パターンのアプリはまとめて1回のUser Reviewサイクルで確認**(例: FAMILY-Aの7アプリは、パターンが完全に同一[確立済みの条件式をそのまま横展開]のため、コードレビュー+代表1〜2アプリの動作確認で足り、7アプリ全てを個別にUser Reviewする必要性は低い)
- **high-riskアプリ(ongaku-app等、構造変更を伴うもの)は個別User Review必須**
- Contrastのトークン修正は、修正箇所(CSS変数定義)が少数でも影響範囲が広いため、**影響を受ける全アプリのスクリーンショット比較をUser Reviewに含める**
- これはProduction初回公開のルール(独立したUser Review Gate)とは別物であり、**「同一パターンの横展開Fix」に限定した効率化**である。新規実装(ongaku-app等)は引き続き個別のUser Review Gateを経る

---

## 5. Regression Suite設計(Family単位で自動化)

| Gate | 既存ツール | Family単位再利用性 |
|---|---|---|
| Heading static/runtime | `tools/main-heading-audit/audit.js`・`runtime-audit.py` | 全Family共通、既に35アプリ対応済み |
| Broken ARIA | 各Tierの`static-audit.js`の`brokenAriaRefs`ロジック | 全Family共通 |
| Modal semantics(role/aria-modal/labelledby) | 同上の`roleDialogCount`等 + 個別Playwrightスクリプト | FAMILY-A/B/C/D/E共通化可能 |
| Initial Focus | Playwright、`document.activeElement`比較(PILOT-F1/TIER2-F3[cup_game]で確立) | FAMILY-Cおよびongaku-app Fix時に再利用 |
| Focus Trap | Playwright、Tab/Shift+Tab連続押下+境界確認 | FAMILY-B全般で再利用可能なテンプレート化を推奨 |
| Escape | Playwright、keydown実装確認 | 同上 |
| Focus Restoration | Playwright、close後のactiveElement確認 | FAMILY-D、および全モーダルFix共通 |
| A11yパネル共存 | Playwright、`donomanaA11yPanel`表示状態確認(既に全Tier共通で実施済み) | 全Family共通 |
| console/page error | Playwright、`page.on('console'/'pageerror')` | 全Fix共通 |
| Responsive | Playwright、5viewport+200%zoom(既に全Tier共通で実施済み) | 全Fix共通 |
| Contrast | `tools/accessibility-audit/contrast-check.py` | FAMILY-F、Fix前後比較に直接再利用可能 |
| Switch candidate parity | Playwright、`buildScanItems()`等呼び出し(Tier2 FIX-P1-Bで確立) | 全Fix共通(候補数・順序の差分0確認) |
| Gaze path | 未確立(個別アプリのdwell/target確認ロジックを都度実装している状態) | Family単位の共通化は今後の課題 |
| Record | role/構造確認のみ自動化済み、実操作はManual | 部分的 |

**Heading/Broken ARIA/console error/Responsive/A11yパネル共存の5 Gateは既に全Tierで確立・再利用済みであり、追加コストなしで今後のFix Phaseにもそのまま適用できる。** Modal semantics・Initial Focus・Focus Trap・Escape・Focus Restoration・Switch candidate parityはTier2のFIX-P1-A/Bで個別実証済みだが、まだ「Family単位の汎用テストスクリプト」としては未整備。Phase 2以降で共通化することを推奨する。

---

## 6. Final Re-Audit設計

Fix完了後、35アプリ全件について以下を再実行する:

**Automated(必須)**:
- Static structure(全35、既存tool再利用)
- Runtime heading(全35)
- Browser Gate(全35、console/page error/responsive)
- Broken ARIA Gate(全35)
- Modal semantics再確認(18アプリ、Fix対象は詳細確認・非対象は差分なし確認)
- Contrast Gate再実行(全35、Fix前後の件数比較)

**Manual(Fix対象・high-riskのみ)**:
- SR(NVDA/VoiceOver): Fix対象アプリ全て+high-risk代表
- Blue2/Tobii: Fix対象アプリ全て(Focus Trap新規実装アプリは特に重要)
- Touch: Fix対象アプリ

**Manual(全体、代表方式のまま)**:
- Manual Review Strategyで設計した代表アプリセットは、Fix完了の有無に関わらず一度は実施する

---

## 7. 工数見積(Phase別)

| # | Phase | 調査 | 実装 | 自動テスト | User Review | Release | 合計目安 |
|---|---|---|---|---|---|---|---|
| 1 | Modal Spec Decision | - | - | - | 決定会議相当 | - | 数時間〜半日 |
| 2 | FAMILY-A Fix | 完了済み | 各半日×7アプリ | 各1〜2時間 | 代表確認+コードレビュー | 各半日 | 合計4〜5日 |
| 3 | ongaku-app構造Fix | 半日 | 2〜3日 | 1日 | 個別必須、半日 | 半日 | 4〜5日 |
| 4 | FAMILY-B Fix(残り8アプリ) | 完了済み | 各1日 | 各半日 | 代表+個別high-risk | 各半日 | 合計8〜10日 |
| 5 | Focus Restoration Fix | 決定待ち | 半日〜1日 | 半日 | 必須 | 半日 | 2〜3日(決定後) |
| 6 | Reflow(drawing-app) | 完了済み | 半日〜1日 | 半日 | 必須 | 半日 | 2〜3日 |
| 7 | Reflow(slideshow-sakusei) | 決定待ち | 0〜数日(方針次第) | 半日 | 必須 | 半日 | 決定後1〜5日 |
| 8 | Heading(yomikaki-app) | 完了済み | 数分〜1時間 | 半日 | 簡易 | 半日 | 半日〜1日 |
| 9 | Contrastトークン(共有) | 半日 | 半日 | 半日 | 影響範囲確認込みで1日 | 半日 | 2〜3日 |
| 10-11 | Contrastアプリ別 | 個別 | 各半日〜1日 | 各半日 | 各半日 | 各半日 | 合計1〜2週間 |
| 12-14 | Manual Review Gate群 | - | - | - | - | - | 2〜3週間(実機調達含む) |
| 15 | Final Re-Audit | - | - | 1〜2日 | - | - | 1〜2日 |

**Global Fix全体の推定所要期間: 実装系Phase(1〜11)で約4〜6週間、Manual Review Gate(12〜14)で追加2〜3週間、Final Re-Audit込みで総計約7〜10週間(User Review・実機調達のリードタイムを含む)。**

---

## 8. 推奨ロードマップ(1枚表)

| Phase順 | Finding Family | 対象アプリ数 | Severity | 推定時間 | User Review | Manual依存 |
|---|---|---|---|---|---|---|
| 1 | Spec Decision(B/D/E) | - | - | 数時間〜半日 | 決定承認 | なし |
| 2 | FAMILY-A | 7 | P2 | 4〜5日 | 代表+コードレビュー | なし |
| 3 | ongaku-app構造Fix | 1(3モーダル) | **P1** | 4〜5日 | 個別必須 | Fix後SR/Switch確認 |
| 4 | FAMILY-B残り | 8 | P2 | 8〜10日 | 代表+high-risk個別 | Fix後SR/Switch確認 |
| 5 | Focus Restoration | 1 | P2 | 2〜3日(決定後) | 必須 | なし |
| 6 | Reflow(drawing-app) | 1 | P2 | 2〜3日 | 必須 | Touch/Gaze確認 |
| 7 | Reflow(slideshow-sakusei) | 1 | P2 | 1〜5日(決定後) | 必須 | Touch確認 |
| 8 | Heading(yomikaki-app) | 1 | P3 | 半日〜1日 | 簡易 | SR確認 |
| 9-11 | Contrast全般 | 17 | P3中心 | 2〜3週間 | 影響範囲込み | 273件のManual Review代表確認 |
| 12-14 | Manual Review Gate | 代表12〜20 | - | 2〜3週間 | - | NVDA/VoiceOver/Blue2/Tobii/Touch |
| 15 | Final Re-Audit | 35 | - | 1〜2日 | - | - |

**総計目安: 約7〜10週間。**
