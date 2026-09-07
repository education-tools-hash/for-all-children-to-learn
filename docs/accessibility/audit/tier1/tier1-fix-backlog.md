# WCAG-JIS-AUDIT-1-TIER1: Fix Backlog

Severity・工数感・依存関係に基づく優先順位案。**本Auditでは一切実装しない**。

---

## 優先度1(小規模・正解確立済み・横展開のみ)

| Finding | 対象 | 推定工数 | 参照実装 |
|---|---|---|---|
| TIER1-F2(FT-1: A11yパネル例外欠如) | register-app(2箇所)・time-timer(3箇所)・janken-app(1箇所)・tokei-app(2箇所) | 各アプリ半日程度(POST-AUDIT-35-HARDEN-1/3の実績ベース) | okane-app/matching-app/gaze-keyboard(settingsModal) |
| TIER1-F1(tyushi H1到達不能) | tyushi | 半日程度(AUDIT-35-H1-IMPL-1と同水準) | register-app等のvisually-hidden静的h1パターン |

## 優先度2(中規模・構造判断を伴う)

| Finding | 対象 | 推定工数 | 備考 |
|---|---|---|---|
| TIER1-F3(FT-2: Focus Trap欠如) | mogura-tataki・scratch-app・nazorin-print・tyushi・gaze-keyboard(profileModal/hrModal) | 各アプリ1日程度、方式決定(TIER1-F6)が先行する方が望ましい | POST-AUDIT-35-HARDEN-3-RELEASE Option A/B比較と同種の判断が必要 |
| TIER1-F4(Contrast) | register-app・matching-app・time-timer・nazorin-print・schedule-appを中心に | デザイントークン単位の見直しが必要な場合、数日規模 | 個別ボタンの場当たり的な色変更ではなくデザインシステム側の対応を推奨 |

## Spec Decision(実装前に方針決定が必要)

| 項目 | 関連Finding | 決定事項 |
|---|---|---|
| フォーカス復帰の正式要件 | TIER1-F5(register-app pmOpenerEl) | `donomana-modal-accessibility-spec-v1_0.md` §21-1 |
| モーダル背景抑制方式の統一要否 | TIER1-F6、TIER1-F3 | 同 §21-6, §21-13 |

## Technical Debt(今回blockingとしない)

- schedule-app heading hierarchy(h2〜h6なし) — AUDIT-35-H1シリーズの既定路線を維持

## Manual Review完了後に確定するFix候補

`tier1-manual-review.md`のA〜H各カテゴリの結果次第で、追加のFix Backlog項目が発生する可能性がある(特にSR実機でのtyushi/register-appの体感、Contrast状態変化系)。

## Tier2横展開の推奨事項

1. `tools/main-heading-audit/audit.js`のruntime可視性判定への改修(TIER1-F1の根本原因、AUDIT-35監査ツール自体の限界)
2. FT-1/FT-2 Finding Familyのパターンマッチ(本Auditで確立した「Tab-key handler grep + A11yパネル近接ヒューリスティック + 目視確認」手法)をTier2/3全アプリへ適用
3. Contrast Gateの継続実行(既存tool、追加コストは小さい)
