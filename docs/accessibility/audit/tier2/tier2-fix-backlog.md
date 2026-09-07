# WCAG-JIS-AUDIT-1-TIER2: Fix Backlog

Severity・工数感・依存関係に基づく優先順位案。**本Auditでは一切実装しない**。

---

## 優先度1(小規模・正解確立済み・横展開のみ)

| Finding | 対象 | 推定工数 | 参照実装 | 状態 |
|---|---|---|---|---|
| TIER2-F6(broken aria-labelledby参照、Severity P1→**P2**訂正済み) | katachi-awase-app | 数分(不要属性の削除のみ) | なし(削除のみで解消) | **✅ 修正済み(RC commit e32c45e、branch `fix/katachi-awase-broken-aria-labelledby`)。main未反映** |
| TIER2-F3(初期focus欠如、cup_game分) | cup_game(helpModal) | 実績: 半日 | PILOT-F1/NEW-KNOWN-1の修正パターン | **✅ 修正済み(commit `a53f307`、branch `fix/cup-game-help-modal-initial-focus`)。Production反映済み** |
| TIER2-F3(初期focus欠如、ongaku-app分) | ongaku-app(modal-pin/export/share) | 実績: 半日(共通実装のためTIER2-F2拡張分と合算) | `donomana-modal-accessibility-contract-v1_0.md`準拠でTIER2-F2拡張分と統合実装 | **✅ 修正済み・Production反映済み(commit `edd6299`、main HEAD `373b3d3`、WCAG-JIS-FIX-MODAL-ONGAKU-1-RELEASE)** |
| TIER2-F1(FT-1: A11yパネル例外欠如) | shiritori2・bosai-app・ongaku-app(modal-help) | 各アプリ半日程度(POST-AUDIT-35-HARDEN-1/3の実績ベース) | okane-app/matching-app/gaze-keyboard(settingsModal) |

## 優先度2(中規模・構造判断を伴う)

| Finding | 対象 | 推定工数 | 備考 |
|---|---|---|---|
| TIER2-F2(FT-2: Focus Trap欠如) | hiragana-learn・katakana-app・cup_game | 各アプリ1日程度、方式決定(TIER1-F6)が先行する方が望ましい | hiragana-learn/katakana-appは共通実装のため同時対応可能 |
| TIER2-F2(FT-2拡張: ongaku-app modal-pin/export/share) | ongaku-app | 実績: 半日 | ✅ **修正済み・Production反映済み(commit `edd6299`、main HEAD `373b3d3`、WCAG-JIS-FIX-MODAL-ONGAKU-1-RELEASE)** |
| TIER2-F5(Reflow/200%zoom overflow) | drawing-app | 半日〜1日程度 | `ResizeObserver`を`canvas-wrap`へ付与しCSS zoom変更でも`resize()`が再実行されるようにする方向で調査 |
| TIER2-F4(Contrast) | kimochi-boardを中心に | デザイントークン単位の見直しが必要な場合、数日規模 | TIER1-F4と合流してデザインシステム側の対応を推奨 |

## Spec Decision(実装前に方針決定が必要)

| 項目 | 関連Finding | 決定事項 |
|---|---|---|
| モーダル背景抑制方式の統一要否 | TIER1-F6(Tier2データで拡張: shiritori2=系统B、hiragana-learn/katakana-app/bosai-app/cup_game/ongaku-app=系统D) | `donomana-modal-accessibility-spec-v1_0.md` §21-6, §21-13 |

## Technical Debt(今回blockingとしない)

- なし(bosai-appのduplicate id誤検知は実害なしと確認済みのため、Technical Debtとしても計上しない)

## Manual Review完了後に確定するFix候補

`tier2-manual-review.md`のA〜I各カテゴリの結果次第で、追加のFix Backlog項目が発生する可能性がある。特に以下は優先度が高い:

- katachi-awase-appのスイッチスキャン設定トグルのNVDA/VoiceOver実機読み上げ結果(TIER2-F6はChromium実機Evidenceで既にSeverity P2へ訂正・修正済みだが、他AT実装での差異有無はManual Validation Pendingのまま)
- gradient背景10アプリのContrast実機確認結果(TIER2-F4の範囲が自動判定分[15件]より大幅に拡大する可能性)

## Tier3横展開の推奨事項

1. FT-1/FT-2/Initial Focus Missing/Broken ARIA Reference の4パターンについて、本Audit(Tier1+Tier2)で確立した「Tab-key handler grep + A11yパネル近接ヒューリスティック + aria参照先id突合 + 目視確認」手法をTier3全アプリへ適用
2. Reflow/200%zoom Overflow(TIER2-F5)は特にcanvas/SVGベースの描画系アプリで優先確認
3. ページ全体gradient背景を採用するアプリが多い場合、Contrast Gateの自動カバレッジ低下を見込んでManual Review工数を多めに確保する
