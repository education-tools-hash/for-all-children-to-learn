# Learning Record Detail Parity Matrix

- 根拠Contract: `docs/design-system/donomana-learning-record-cross-app-detail-contract-v1_0.md`
- Baseline checkpoint: `fc2fb0a`
- 実測日: Phase `LEARNING-RECORD-CROSS-APP-DETAIL-CONTRACT-1`
- 本文書は**生きた文書**。実装（§20〜22のRollout）が進むたびに該当行を更新する。

## 凡例

**Parity Status**: `CONFORMANT`（Level 2、Rich Visualization保有ならLevel 3も充足） / `PARTIAL`（Level 2の一部のみ、またはLevel 3未対応） / `SUMMARY ONLY`（Level 1のみ） / `NOT INTEGRATED`（Foundation対応だがCommon Adapter未登録） / `NOT APPLICABLE`

**列の実測方法**:
- Record Foundation / Common Summary / Common Detail / Common Visualization / CSV共通列: `assets/js/record-dashboard-foundation.js`・`record-dashboard-ui.js`・`learning-records.html`のコードを本Phaseで直接確認（確定情報）。
- App-local Detail / App-local Rich Visualization: 本Phaseで個別に確認できたApp（さわってひろがる・SST・hiragana-learn/katakana-app/suji-manabou/nazori-app・kurabeyou-app）のみ確定情報。**残りのAppは未監査**（§Notesに明記、`LEARNING-RECORD-DETAIL-PARITY-AUDIT-ALL-1`で確認予定）。

---

## Record Foundation対応 22アプリ

| appId | Record Foundation | App-local Detail | App-local Rich Viz | Common Adapter | Common Detail | Common Viz | CSV(共通7列) | Parity Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| sawatte-hirogaru-app | ✅ | ✅ あり（操作回数/タップ/スワイプ内訳・モード・しげき設定等、本Phaseの直接検証対象） | ✅ あり（Trace Viewer、traceSchemaVersion:1） | ❌ 未登録 | — | — | — | **NOT INTEGRATED** | `SAWATTE-HIROGARU-COMMON-RECORD-DETAIL-INTEGRATION-1`のReference Implementation対象（Contract §20） |
| sst-app | ✅ | ✅ あり（`donomana-sst-record-detail-contract-v1_0.md`: 場面/選択肢/選んだ回答/教材内区分） | — (該当なし) | ✅ | ❌ Summary相当のみ（`e.type`+`metrics.level`のみ、場面/選択肢は未読込） | N/A | ✅ | **SUMMARY ONLY**（App-local Detailは既にあるがCommon未反映） | `SST-COMMON-RECORD-DETAIL-PARITY-AUDIT-1`対象（Contract §21）。Category E「Common Detail不足」の実例 |
| hiragana-learn | ✅ | 未監査 | ✅ あり（`data.traceSample`、Adapterのhas Media判定で確認） | ✅ | ❌ Summary相当のみ | ❌「このMVPでは表示していません」固定文言でブロック | ✅ | **PARTIAL** | Trace/Drawing系App、Rollout順位3（Contract §22） |
| katakana-app | ✅ | 未監査 | ✅ あり（同上） | ✅ | ❌ | ❌ 同上 | ✅ | **PARTIAL** | 同上 |
| suji-manabou | ✅ | 未監査 | ✅ あり（同上） | ✅ | ❌ | ❌ 同上 | ✅ | **PARTIAL** | 同上 |
| nazori-app | ✅ | 未監査 | ✅ あり（`e.image`、Adapterで確認） | ✅ | ❌ | ❌ 同上 | ✅ | **PARTIAL** | 同上 |
| kurabeyou-app | ✅ | ✅ あり（`appendRecordDetailToggle()`、New App Standard §24 Reference Implementation） | — (該当なし、hasMedia:false) | ✅ | ❌ Summary相当のみ | N/A | ✅ | **SUMMARY ONLY** | App-local Detail UIの参照実装だが、Common側には未反映 |
| katachi-awase-app | ✅ | 未監査（detail関連コード多数、要個別確認） | — (該当なし、hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | Global Audit対象 |
| janken-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | Global Audit対象 |
| register-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| tokei-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| matching-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| shiritori2 | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| directions-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| mitsukete-touch-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| junban-miyou-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| dotchiga-ii-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| miru-hirogaru-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | Pilot A（`donomana-learning-record-standard-v1_0.md`）だが本Contractの意味でのLevel 2は未対応 |
| okane-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| mogura-tataki | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| bosai-app | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | 同上 |
| kyou-no-kiroku | ✅ | 未監査 | — (hasMedia:false) | ✅ | ❌ | N/A | ✅ | **SUMMARY ONLY** | Pilot D（read-onlyでFoundation統合せずと`donomana-learning-record-standard-v1_0.md` §30.2に記載）。Adapter自体は存在（固定summaryのみ） |

---

## 集計

- Record Foundation対応: **22アプリ**
- Common Adapter登録済み: **21アプリ**（sawatte-hirogaru-appのみ未登録 = NOT INTEGRATED）
- Common Detail（Level 2）を満たすアプリ: **0アプリ**
- Common Visualization（Level 3）を満たすアプリ: **0アプリ**
- Parity Status内訳: NOT INTEGRATED ×1 / SUMMARY ONLY ×17 / PARTIAL ×4（hasMedia:trueを返しうるがCommon側で未表示） / CONFORMANT ×0

## Non-blocking: 未監査アプリの扱い

17アプリ（App-local Detail列が「未監査」のもの）は、本Phaseでは個別のApp-localコードを読み込んでいない。Common側の事実（Adapter定義・hasMedia判定）のみ確定情報として記載した。個別App-local UIの詳細監査は、Contract §22 Global Rollout Planのステップ4/5（`LEARNING-RECORD-DETAIL-PARITY-AUDIT-ALL-1`）で実施する。これは本Contractの意図的なスコープ限定であり、抜け漏れではない（Contract §35 Priorityの段階的ロールアウト方針どおり）。
