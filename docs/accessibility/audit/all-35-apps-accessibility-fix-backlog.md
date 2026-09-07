# WCAG-JIS-AUDIT-1: 全35アプリ Global Fix Backlog

Tier1・Tier2・Tier3の`*-fix-backlog.md`を統合し、Finding Family単位で優先順位を再整理したもの。**本ファイルでは一切実装しない。**

---

## 優先度1: 小規模・正解確立済み・横展開のみ

| Finding | 対象 | 推定工数 | 状態 |
|---|---|---|---|
| TIER3-F1(見出し階層スキップ) | yomikaki-app | 数分〜1時間 | Open |
| TIER1-F2(FT-1) | register-app・time-timer・janken-app・tokei-app | 各半日 | Open |
| TIER2-F1(FT-1) | shiritori2・bosai-app・ongaku-app(modal-help) | 各半日 | Open |
| TIER1-F1(heading) | tyushi | - | ✅ 解消済み(AUDIT-35-H1-IMPL-2-RELEASE) |
| TIER2-F6(broken ARIA) | katachi-awase-app | - | ✅ 解消済み(commit e32c45e、Severity P1→P2訂正) |
| TIER2-F3(Initial Focus、cup_game分) | cup_game | - | ✅ 解消済み(commit a53f307) |

## 優先度2: 中規模・構造判断を伴う

| Finding | 対象 | 推定工数 | 備考 |
|---|---|---|---|
| TIER1-F3(FT-2) | mogura-tataki・scratch-app・nazorin-print・tyushi・gaze-keyboard(profileModal/hrModal) | 各1日、方式決定(TIER1-F6)先行が望ましい | Open |
| TIER2-F2(FT-2) | hiragana-learn・katakana-app・cup_game | 各1日 | Open |
| TIER2-F2(FT-2拡張)+TIER2-F3(Initial Focus、ongaku-app分) | ongaku-app(modal-pin/export/share) | 実績: 半日 | ✅ **修正済み(commit `edd6299`、WCAG-JIS-FIX-MODAL-ONGAKU-1、`donomana-modal-accessibility-contract-v1_0.md`準拠)。Production未反映** |
| TIER2-F5(Reflow) | drawing-app | 半日〜1日 | ResizeObserver方式で調査 |
| TIER3-F2(Reflow) | slideshow-sakusei | Spec Decision次第(維持なら0、再設計なら数日) | モバイル対応方針決定が先行 |
| TIER1-F4/TIER2-F4/TIER3-F3(Contrast) | 全17アプリ(信頼できるfail合計77件) | デザイントークン単位の見直しが必要な場合、数日〜1週間規模 | yomikaki-appは単一トークン調整で一括改善の可能性 |

## Spec Decision(実装前に方針決定が必要)

| 項目 | 関連Finding | 決定事項 |
|---|---|---|
| フォーカス復帰の正式要件 | TIER1-F5(register-app) | `donomana-modal-accessibility-spec-v1_0.md` §21-1 |
| モーダル背景抑制方式の統一要否 | TIER1-F6・TIER1-F3・TIER2-F2(18アプリ横断で4系統に分裂) | 同 §21-6, §21-13 |
| slideshow-sakuseiのモバイル対応方針 | TIER3-F2 | デスクトップ専用維持 or レスポンシブ再設計 |

## Technical Debt(blockingとしない)

- schedule-app heading hierarchy(h2〜h6なし) — AUDIT-35-H1シリーズの既定路線を維持

## 誤検知として計上しないもの(参考記録)

- bosai-app `bag-max`・sugoroku-app `sce-prev-ic`(duplicate id誤検知、いずれもinnerHTML置換パターンによる静的regexの限界。実害なし確認済み)

---

## 推奨実装順序(Global)

1. **即時(工数小・リスク小)**: TIER3-F1 → TIER1-F2/TIER2-F1(FT-1横展開、参照実装確立済み)
2. **構造Fix(中規模)**: TIER1-F3/TIER2-F2(残り3アプリ、Focus Trap新規実装、TIER1-F6のSpec Decision確定後が望ましい)→ ongaku-app統合実装(✅WCAG-JIS-FIX-MODAL-ONGAKU-1で完了、Production未反映)→ TIER2-F5/TIER3-F2(Reflow、方針決定後)
3. **デザインシステム改修**: TIER1-F4/TIER2-F4/TIER3-F3(Contrast一括対応)
4. **Spec Decision**: TIER1-F5・TIER1-F6・TIER3-F2のモバイル対応方針を先に確定し、それに依存する構造Fixへ着手

## Manual Review完了後に確定するFix候補

35アプリ全体のManual Review backlog(`tier1/tier1-manual-review.md`・`tier2/tier2-manual-review.md`・`tier3/tier3-manual-review.md`)の結果次第で、追加のFix Backlog項目が発生する可能性がある。特にgradient背景アプリ群(Tier1:5、Tier2:10、Tier3:1)のContrast実機確認結果は、自動判定分(77件)より大幅に範囲が拡大する可能性が高い。
