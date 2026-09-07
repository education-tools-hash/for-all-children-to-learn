# WCAG-JIS-AUDIT-1-TIER3: Fix Backlog

Severity・工数感・依存関係に基づく優先順位案。**本Auditでは一切実装しない**。

---

## 優先度1(小規模・正解確立済み)

| Finding | 対象 | 推定工数 | 備考 |
|---|---|---|---|
| TIER3-F1(見出し階層スキップ) | yomikaki-app | 数分〜1時間程度 | 4箇所のタグ変更(h3→h2、またはH1直後にH2を追加)のみ。CSSクラスは変更不要な見込み |

## 優先度2(中規模・デザイン/構造判断を伴う)

| Finding | 対象 | 推定工数 | 備考 |
|---|---|---|---|
| TIER3-F3(Contrast) | yomikaki-appを中心に | yomikaki-appのブランドカラー系(rgb(45,125,210))はトークン単位の微調整で一括改善できる可能性あり、半日〜1日程度。他アプリは個別評価が必要 | TIER1-F4/TIER2-F4と合流してデザインシステム側の対応を推奨 |

## Spec Decision(実装前に方針決定が必要)

| 項目 | 関連Finding | 決定事項 |
|---|---|---|
| slideshow-sakuseiのモバイル対応方針 | TIER3-F2 | デスクトップ専用ツールとして`min-width:760px`を維持するか、モバイル対応のレスポンシブ再設計を行うかの製品方針決定が必要。決定後の実装工数は方針次第(維持なら0、再設計ならレイアウト再構成で数日規模) |

## Technical Debt(今回blockingとしない)

- なし(sugoroku-appのduplicate id誤検知は実害なしと確認済みのため、Technical Debtとしても計上しない)

## Manual Review完了後に確定するFix候補

`tier3-manual-review.md`のA〜I各カテゴリの結果次第で、追加のFix Backlog項目が発生する可能性がある。特に以下は優先度が高い:

- sugoroku-appのgradient背景によるContrast実機確認結果(TIER3-F3の範囲が自動判定分[16件]より拡大する可能性)
- slideshow-sakuseiのモバイル実機操作感(TIER3-F2のSpec Decisionに直結)

## Tier横断の推奨事項(Tier1+Tier2+Tier3共通)

1. TIER3-F1で確立した「heading hierarchyのタグ前後関係チェック」手法を、既に完了済みのTier1/Tier2アプリにも任意で再適用することを推奨(本Auditのstatic-audit.jsの`headingSequenceRaw`データはTier1/Tier2でも既に収集済みのため、追加監査コストは小さい)
2. Reflow Overflow(TIER2-F5・TIER3-F2)は、意図的なmin-width設計か否かをまず切り分けてから対応方針を決めることが重要(TIER3-F2で得た教訓)
