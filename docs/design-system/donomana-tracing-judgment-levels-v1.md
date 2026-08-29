# どのまな なぞり判定レベル設計書（Version 1.0）

- 版: v1.0 Draft / RC相当（Phase T5-B''で改訂）
- 発行: 2026年8月（Phase T5-B'起草 → Phase T5-B''でeasy再設計）
- 位置づけ: `donomana-tracing-accuracy-design-v1.md`（T2/T3、Metrics Engineそのものの精度設計）を土台に、**同じMetrics Engineの上に3段階の判定許容度（Judgment Policy）を追加する**設計・較正記録。T2/T3で確立したMetrics Engineの計算式・Hard Safety Guardは変更しない。
- 対象: `hiragana-learn.html`・`katakana-app.html`・`tools/tracing-poc/engine.js`・`tools/tracing-poc/engine-katakana.js`
- 承認状態: **Draft / RC。全35アプリ中この2アプリのみ対象。Production Releaseは行っていない。**

> §1〜12はPhase T5-B'時点の記述（歴史的記録として保持）。**easyの数値・設計はPhase T5-B''で全面的に再設計されており、以下Addendumが最新かつ正式**。standard/preciseはT5-B'時点のまま変更していない。

---

## 0. 背景

Phase T5-B User Browser Review中に、hiragana-learnのなぞり判定について「成人が通常になぞっても複数回RETRYになることがあり、障害のある子どもや、なぞりを始めたばかりの子どもには成功体験を損なうほど厳しい可能性がある」という教育的UX課題が報告された。同じ課題はkatakana-appにも当てはまる。

原因はT5-B Learning Record Foundationによる回帰ではなく、T2/T3で確立したTracing Engineの**Acceptance Policyが全利用者に一律**であることにある。本Phaseは、T2/T3の高精度Engineを壊さず、利用者・教師・支援者が「やさしく／ひょうじゅん／ていねいに」の3段階から判定の許容度を選べる設計を追加する。

---

## 1. Fundamental Architecture Principle: Metrics Engine / Judgment Policy分離

`evaluateCharacter(userStrokes, referenceStrokeDefs, opts)`内で、

- **Metrics Engine**（変更なし）: shape/coverage/offPath/startEnd/direction・DTW・per-stroke position/completion・Relative Character Discrimination・（katakana）Multi-Hypothesis Assignment/Self-Reflection Discriminationの**計算式そのもの**
- **Judgment Policy**（新規）: 計算済みmetricをどの閾値と比較して合否を決めるか

を分離した。実装は、関数冒頭で`opts.judgmentProfile`から4つのAdjustable値のみを解決した`T`オブジェクトを作り、判定式内の該当4箇所だけ`THRESHOLDS.X`から`T.X`へ置き換える、という最小差分で行った。`opts.judgmentProfile`省略時は`T`が完全に`THRESHOLDS`と一致するため、**既存呼び出し元（golden test・アプリ本体のデフォルト経路）の挙動は一切変わらない**。

```js
const jp = opts.judgmentProfile || {};
const T = {
  PASS_THRESHOLD: jp.PASS_THRESHOLD != null ? jp.PASS_THRESHOLD : THRESHOLDS.PASS_THRESHOLD,
  STROKE_QUALITY_FLOOR: jp.STROKE_QUALITY_FLOOR != null ? jp.STROKE_QUALITY_FLOOR : THRESHOLDS.STROKE_QUALITY_FLOOR,
  STROKE_POSITION_MAX: jp.STROKE_POSITION_MAX != null ? jp.STROKE_POSITION_MAX : THRESHOLDS.STROKE_POSITION_MAX,
  STROKE_COMPLETION_MIN_SPAN: jp.STROKE_COMPLETION_MIN_SPAN != null ? jp.STROKE_COMPLETION_MIN_SPAN : THRESHOLDS.STROKE_COMPLETION_MIN_SPAN,
};
```

同一の最小差分を`hiragana-learn.html`・`katakana-app.html`・`tools/tracing-poc/engine.js`・`tools/tracing-poc/engine-katakana.js`の4ファイルへ適用した（アプリ本体とPoC参照実装を同一内容に保つという、T2/T3から続く既存の運用パターンを踏襲）。

---

## 2. Hard Safety Guard / Adjustable Guard 分類（実装・較正結果から確定）

| 分類 | 対象 | 根拠 |
|---|---|---|
| **Hard Safety**（全Level共通、変更しない） | strokeCount一致・GROSS_LOCATION_MARGIN・ABS_SCALE_MIN/MAX・ABS_POSITION_MAX（Absolute Geometry Guard）・MIN_LENGTH_RATIO・RELATIVE_DISCRIMINATION_MARGIN（Relative Character Discrimination＝cross-character判別）・SELF_REFLECTION_MARGIN（Self-Reflection Discrimination、katakana）・ASSIGNMENT_AMBIGUITY_WINDOW/MONOTONIC_REGRESSION_TOLERANCE（Multi-Hypothesis Assignment Safety Guard、katakana） | 別文字判別・鏡像判別・exploit防止に直接関わる。較正実験で、これらに手を加えずに3 Levelの安全な分離が実現できることを確認済み |
| **Adjustable**（Level間で変動） | `PASS_THRESHOLD`・`STROKE_QUALITY_FLOOR`・`STROKE_POSITION_MAX`・`STROKE_COMPLETION_MIN_SPAN` | 同一文字内での運動面の揺れ・ずれに対する寛容度に直接対応する4値。較正実験で、この4値のみの調整で意味のある差を生み出せることを確認 |

`STROKE_QUALITY_FLOOR`が最も支配的なレバーであること、`PASS_THRESHOLD`は本較正データセットでは単独では効果が小さいこと、`STROKE_POSITION_MAX`・`STROKE_COMPLETION_MIN_SPAN`はいずれも緩和しすぎると特定の攻撃パターン（W4ジグザグ・W3打ち切り）が漏れ始める非線形な閾値を持つことを、Node較正ハーネスの実測で確認した（§5参照）。

---

## 3. User-facing Levels

| 表示 | 内部名 | 想定 |
|---|---|---|
| やさしく | `easy` | なぞりを始めたばかり・運動の揺れが大きい・成功体験を重視する段階 |
| ひょうじゅん | `standard` | 多くの学習者。多少の揺れやずれを許容しながら文字らしい形を確認する |
| ていねいに | `precise` | 文字形をより正確に練習する。**現行Production判定と完全に一致**（内部threshold値は現行`THRESHOLDS`と同一） |

「かんたん／むずかしい」等、学習者の能力評価に受け取られやすい名称は不採用とした。

---

## 4. Current Production Baseline（実測、変更なし）

| 定数 | ひらがな（T2 final） | カタカナ（T3 final） |
|---|---|---|
| PASS_THRESHOLD | 0.60 | 0.60 |
| STROKE_QUALITY_FLOOR | 0.80 | 0.80 |
| STROKE_POSITION_MAX | 0.26 | 0.355（katakana-calibrated、T3-B） |
| STROKE_COMPLETION_MIN_SPAN | 0.50 | 0.50 |
| その他Hard Safety定数 | GROSS_LOCATION_MARGIN=0.45 / ABS_SCALE_MIN=0.50 / ABS_SCALE_MAX=1.70 / ABS_POSITION_MAX=0.50 / MIN_LENGTH_RATIO=0.22 / RELATIVE_DISCRIMINATION_MARGIN=0.008 | 左に加え SELF_REFLECTION_MARGIN=0.008 / ASSIGNMENT_AMBIGUITY_WINDOW=0.005 / MONOTONIC_REGRESSION_TOLERANCE=0.02 |

**`precise` = 上記の値そのもの。** 「現行Productionはpreciseに相当する」という仮説を、そのまま`precise` Levelの定義として採用した（推測ではなく、値を完全一致させることで保証）。

---

## 5. 較正方法・根拠

### 5.1 較正ハーネス

`tools/tracing-poc/engine.js`/`engine-katakana.js`をNodeから直接requireし、**エクスポートされた`THRESHOLDS`オブジェクト（内部クロージャと同一参照）を候補Profileの値に一時的に書き換えて`evaluateCharacter()`を再実行→結果を確認→復元**、という方式で較正した。これは本Phaseで実装したランタイムの`opts.judgmentProfile`上書き機構と等価な検証であり、コード自体は一切変更していない（読み取り専用の較正スクリプトのみ、リポジトリには含めていない）。

### 5.2 データセット

**Positive/Motor（46文字×各種variation、計1058ケース/文字体系）**:
- 既存`golden-traces.js`のideal・mildWobble（既存amplitude 0.012含む）・slightOffset・slightScale・mildlyUneven
- **新規追加**: mildWobbleのamplitude 0.02〜0.05（既存の最大4倍相当）、および低周波の滑らかなノイズ+per-stroke微小回転を組み合わせた「humanlike wobble」（実際の手・マウスのぶれにより近い変動として、単純な点ごとの独立ノイズだけに頼らないよう追加）、partial completion 88%/90%
- 既存datasetだけでeasy/standardを決定しない、という方針に沿い、既存より広いvariationを追加した

**Negative（W1-W6単一悪筆画・全文字・全stroke位置＋cross-character全ペア＋Mirror、計1112〜1376ケース/文字体系）**:
- `independent-wrong-trace.js`のW1（垂直方向ずらし）・W2（平行移動）・W3（45%打ち切り）・W4（ジグザグ）・W5（鏡像）・W6（25%スケール）
- Cross-character: 画数が一致する全文字ペア

### 5.3 較正プロセス

1. **One-at-a-time sensitivity sweep**: 4値それぞれを単独で変化させ、positive改善量とnegative漏れの発生点を特定
2. **Combined候補の直接検証**: 単独では安全でも、複数値を同時に緩和すると相互作用でnegative漏れが生じるケースを実際に発見（例: ひらがな`STROKE_QUALITY_FLOOR=0.77`単独では新規漏れ3件、`STROKE_POSITION_MAX`と`STROKE_COMPLETION_MIN_SPAN`を同時に緩和した組み合わせでも別の漏れが発生）。**最終的に採用した3 Levelの値は、実際に組み合わせた状態でnegative漏れゼロを確認したもののみ**

### 5.4 発見した重要な非線形性

- `STROKE_QUALITY_FLOOR`は0.78までは安全（漏れ0）だが、0.75以下から鏡像・ジグザグ攻撃の漏れが急激に増加する、狭い安全域を持つ
- `STROKE_COMPLETION_MIN_SPAN`は0.44までは安全だが、0.42以下でW3（45%打ち切り）攻撃が大量に漏れ始める、明確な崖がある
- `STROKE_POSITION_MAX`はひらがなでは実測データ中に効果がほぼ見られなかった（緩和しても漏れなし・改善もなし）が、カタカナでは1.30倍(0.461)から漏れが生じ始める、**文字体系によって感度が大きく異なる**
- 個別に安全な値の組み合わせが、組み合わせた際には安全でなくなることがある（相互作用効果）。**必ず最終候補を組み合わせた状態で再検証する必要がある**、という較正上の教訓を得た

---

## 6. 最終Profile（3 Levels、Negative漏れゼロを確認済み）

### ひらがな

| Level | PASS_THRESHOLD | STROKE_QUALITY_FLOOR | STROKE_POSITION_MAX | STROKE_COMPLETION_MIN_SPAN |
|---|---|---|---|---|
| precise | 0.60 | 0.80 | 0.26 | 0.50 |
| standard | 0.58 | 0.78 | 0.30 | 0.46 |
| easy | 0.50 | 0.78 | 0.34 | 0.46 |

### カタカナ

| Level | PASS_THRESHOLD | STROKE_QUALITY_FLOOR | STROKE_POSITION_MAX | STROKE_COMPLETION_MIN_SPAN |
|---|---|---|---|---|
| precise | 0.60 | 0.80 | 0.355 | 0.50 |
| standard | 0.58 | 0.78 | 0.40 | 0.46 |
| easy | 0.50 | 0.75 | 0.40 | 0.46 |

**注記（正直な限界の記載）**: ひらがなの`easy`は`STROKE_QUALITY_FLOOR`が`standard`と同値（0.78）である。これは0.78が確認できた安全域の実質的な下限であり、それ以上緩和すると鏡像・ジグザグ攻撃が漏れ始めるため。したがって本較正データセット上、ひらがなの`easy`と`standard`の positive pass rateは同じ（97.4%）になった。差はPASS_THRESHOLD（0.58→0.50）とSTROKE_POSITION_MAX（0.30→0.34）にあり、本データセットで測定された範囲外の実際の人の入力（position寄りの変動が大きいケース等）では差が出る可能性がある。カタカナは`STROKE_QUALITY_FLOOR`をさらに0.75まで安全に下げられたため、easy/standardの差がより明確に出た（97.7%→98.3%）。

---

## 7. Semantic Consistency

3 Levelの意味（利用者から見た「厳しさの相対関係」）はひらがな・カタカナで統一した（`precise` > `standard` ≧ `easy`、常にこの順）。内部threshold数値はスクリプトごとに個別較正した（`STROKE_QUALITY_FLOOR`のeasy値がひらがな0.78・カタカナ0.75など）。character-specific（文字ごとの個別閾値）は採用していない。

---

## 8. Default Level

**本Phaseでは`precise`（現行Production相当）をコード上のdefaultのまま変更していない。** 較正実測に基づく推奨は以下（最終決定はUser Approval後）:

> **`standard`を推奨候補とする。** 理由: ひらがな・カタカナとも`precise`から`standard`への変更だけでpositive pass rateが明確に改善し（ひらがな+1.9pt、カタカナ+3.0pt）、かつnegative漏れは実測でゼロ。`easy`はさらなる改善余地があるが、ひらがなでは`standard`との実測差が小さく、また「やさしく」という名称が持つ心理的ハードルの低さ（「甘い判定にした」という印象を教員が持つ可能性）を踏まえると、まず`standard`をdefault候補として提案し、`easy`は個別ニーズのある学習者向けの追加選択肢として位置づけるのが妥当と考える。

---

## 9. Settings UI / Persistence

`hiragana-learn.html`・`katakana-app.html`双方の`#settings`セクション（既存の設定パネル、共通A11yパネルの「アプリ設定」proxyボタン経由で到達）へ、3ボタン形式のLevel選択UIを追加した。選択中Levelの説明文を表示し、リセットリンクを併設する。

- storage key: `hiragana_tracing_level` / `katakana_tracing_level`（`localStorage`、既存の単純キー方式を踏襲）
- reload後保持・リセット可能・外部送信なし・Analytics送信なしを実機検証済み

---

## 10. Learning Record Integration

T5-B Standard v1.0のCore Schemaは変更していない。`tracingJudgmentLevel`を`addLog('trace', {kana, tracingJudgmentLevel})`のApp-specific payloadフィールドとして追加した（`hiragana-learn.html`はT5-B Shared Foundation経由、`katakana-app.html`は独自のlearningLog経由）。field欠落時（旧record）はlegacyとして扱われ、読み込み側は影響を受けない。T5-B checkpoint（`ed6cce8`）のFoundation API・marker injection・legacy compatibility・重複防止機構への変更はない。

---

## 11. 検証結果サマリ

- 既存4種の公式Golden Test Suite（`golden-tests.js`・`golden-tests-full46.js`・`golden-tests-independent46.js`・`golden-tests-katakana-independent46.js`）をデフォルト呼び出し（`opts.judgmentProfile`省略）で実行し、**全件、変更前と同一の結果（ALL CLEAN / ALL STRICT CHECKS PASSED）**を確認
- 3 Level × 2文字体系の最終Profileで、negative（攻撃）漏れが既存の既知残存（ひらがな9件、カタカナ0件——いずれもMirror自己混同等、`precise`から変化なしの既知の限界）を**一切超えないこと**をNode較正ハーネスで確認
- 実ブラウザ（Playwright）で、Level切替UI・永続化・リセット・Judgment Policy適用・T5-B Learning Record Foundationとの共存（重複記録なし）・console/page error 0/0 を確認

詳細な数値・実行ログはPhase T5-B' Final Reportを参照。

---

## 12. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft/RC | 2026-08-29 | Phase T5-B'。ひらがな・カタカナ2アプリへJudgment Policy分離を実装、3 Level較正、実機検証完了。全35アプリ対応・default決定・Production ReleaseはUser Review後の別Step |
| v1.0 Draft/RC（改訂） | 2026-08-29 | Phase T5-B''。easyをBeginner-Friendly Policyとして全面再設計。standard/preciseは無変更。Addendum（§13〜）参照 |

---

# Addendum（Phase T5-B''）: Beginner-Friendly Easy Tracing Policy

## 13. 背景・User Feedback

T5-B' User Browser Reviewで、standard/preciseの3段階設計自体は支持されたが、**easyが「初めて文字を書く子ども」「運動面に困難さのある子ども」の成功体験を支えるには厳しすぎる**と判断された。T5-B'時点のeasy（ひらがな: 0.78/0.34/0.46/0.50、カタカナ: 0.75/0.40/0.46/0.50）は、単純にstandardの閾値をさらに緩めただけで、**拡張beginner向けデータセットで再測定するとeasy/standardのpositive acceptanceがほぼ同率（差が実質ゼロ）**という設計未完成の状態だった。

本Addendumは、「正確に下字をなぞれたか」ではなく「大まかな文字動作に参加できたか」を評価するeasy専用Policyへ再設計した記録である。**standard/preciseはT5-B'時点のまま一切変更していない。**

## 14. Fundamental Redesign: Beginner Forgiveness機構

単純な閾値緩和ではなく、**Metrics Engineの計算結果に新しいJudgment Policy層を追加**した。既存tolerantGuard（catastrophic==good、tolerance=0で.every()と数学的に同一）はstandard/preciseのまま維持し、easyにのみ以下3点の新機構を追加した。

### 14.1 STROKE_FAIL_TOLERANCE（1画までの"good"未達を許容）

n画中、最大`STROKE_FAIL_TOLERANCE`画までは"good"基準（既存のSTROKE_QUALITY_FLOOR等）を下回っても即failにしない。ただし"catastrophic"基準（より緩い下限）は1画たりとも超えてはならない。単一画の文字（比較対象がない）は常にtolerance=0。easyは`STROKE_FAIL_TOLERANCE=1`を採用（「1画だけ崩れたために、他画が十分書けている試行までRETRYになる」ことを防ぐ、User要望§8に対応）。

### 14.2 Completion連動のFloor Catastrophic（最重要の発見）

較正実験で、**「shape/coverageが崩れている」原因は少なくとも2種類あり、floor値の分布だけでは安全に分離できない**ことを実測で発見した。

- (a) W4ジグザグ等の**攻撃**: completionはほぼ1.0のまま（最後まで描いている）で、floorだけが崩れる（実測max: ひらがな0.775／カタカナ0.740）
- (b) **素朴にstrokeを短く/雑に描いた初心者**: floorとcompletionが同時に下がる（70%shortenedの実測floor: 0.677〜0.761、completion: 0.667〜0.714）

両者はfloor単体の分布が重なり合うため、単一のcatastrophic値では「W4を防ぎながら初心者のshortenedを救う」ことが両立できないことを確認した。そこで、**そのstrokeのcompletionも同時に閾値未満（`STROKE_QUALITY_LENIENT_GATE`）の場合に限り、より緩いcatastrophic値（`STROKE_QUALITY_CATASTROPHIC_LENIENT`）を適用する**設計へ変更した。W1（垂直方向ずらし）についても同様の追加分析を行い、「completion<gate」条件下でのW1のfloor最大値（ひらがな0.641／カタカナ0.716）を安全マージンとしてLENIENT値を決定した（詳細は§16参照）。

```js
const catastrophic = (stroke.completion < LENIENT_GATE) ? CATASTROPHIC_LENIENT : CATASTROPHIC;
```

省略時（`STROKE_QUALITY_LENIENT_GATE`未指定=0）はこの分岐が発火せず、standard/preciseの挙動に一切影響しない。

### 14.3 ABS_POSITION_MAX（Absolute Position Guard）のAdjustable化

T5-B'では全Level共通のHard Safetyとして固定していた`ABS_POSITION_MAX`（文字全体のcentroid位置ずれ）を、T5-B''でAdjustable化した。実測により、単一stroke攻撃（W1〜W4）の文字全体位置比率は最大0.355（katakana W2）にとどまり、Hard値0.50に対し大きな安全マージンがあることを確認済み。easyでは0.65へ緩和（User要望「下字から外れても判定OKにしてほしい」§6に対応）。ただしこの緩和自体は今回のcalibrationでは決定的な効果を示さなかった（有無で結果が変わらないケースが大半）ため、実質的な効果より「位置ずれを理由にRETRYしない」という設計方針の明文化としての意味が大きい。

## 15. Hard Safety（変更なし）

Multi-Hypothesis Assignment Safety Guard・Self-Reflection Discrimination・Relative Character Discrimination（cross-character判別）・ABS_SCALE_MIN/MAX（極端なscale攻撃）・MIN_LENGTH_RATIO・GROSS_LOCATION_MARGINは、easyを含む**全Level共通で完全に不変**。cross-character discriminationの厳格さもeasyで緩めていない（い/ニ regressionはeasyでも実測でpass=falseを確認、§18参照）。

## 16. 較正データセット・プロセス

### 16.1 Beginner-oriented Positive Dataset（拡張）

既存golden-traces.jsに加え、以下を新規追加した:

- **より大きいwobble**: amplitude 0.02〜0.07（既存の0.012の約1.7〜5.8倍）
- **humanlike wobble**: 低周波の滑らかなノイズ+per-stroke微小回転（T5-B'から継続）
- **全体回転**: ±0.02〜0.12ラジアン
- **不均一な間隔**: strokeごとにドリフトが蓄積する平行移動
- **1画のみ短縮**（`shortened1_*`）: 46文字×3シードで、ランダムな1画のみを70/75/80/85/90%に短縮、他画はideal（「疲れ/油断で1画だけ短い」という現実的なシナリオ）
- **全画短縮**（`shortenedAll_*`）: 全画を一律に短縮したより厳しいシナリオ（別カテゴリとして区別）
- **mixed variation**: offset+wobble+rotation+1画短縮を同時に組み合わせ

### 16.2 Negative Dataset（既存W1〜W6・cross-character・Mirrorを維持）

T5-B'と同じNegative Dataset（single-bad-stroke×4種×全stroke位置×全文字、cross-character全ペア、Mirror）に加え、near-empty・極端scaleを追加。**全candidateについて、precise baseline（既知の残存9件/0件）を差し引いた「新規漏れ」がゼロであることを必須条件とした。**

### 16.3 較正プロセスで判明した重要な知見

1. **PASS_THRESHOLDは本データセットでは単独ではほぼ無効**（0.60→0.45まで動かしても positive rateが変化しないケースが大半）。per-stroke gate（floor/position/completion）が先に効くため。
2. **STROKE_QUALITY_FLOORが最も支配的だが、安全域が非常に狭い**（0.78は安全、0.75で早くも新規漏れ発生）。単純な一律緩和では「shortened stroke」と「W4攻撃」を分離できないことがv2〜v6の反復検証で判明（§14.2の発見に繋がった）。
3. **STROKE_POSITION_MAXの安全域はW2（平行移動攻撃）の実測値に強く制約される**（ひらがな・カタカナともW2攻撃の位置比率max ≈0.55。catastrophicはこれより十分低く保つ必要がある）。
4. **STROKE_COMPLETION_MIN_SPANの安全域はW3（45%打ち切り）の実測値に制約される**（W3のcompletionは全文字で厳密に0.429固定という高い再現性を確認。catastrophicはこれより十分高く保つ必要がある）。
5. **個別に安全な値の組み合わせが、組み合わせると安全でなくなることがある**（相互作用効果）。T5-B'でも確認した教訓だが、T5-B''ではより顕著に再確認した（Mirror攻撃がfloorのcompletion-gated分岐に意図せず該当し、gate値を0.85→0.75へ再調整する反復が必要だった）。

## 17. 最終Easy Policy（Negative漏れゼロを確認済み）

### ひらがな easy

```js
{
  PASS_THRESHOLD: 0.45,
  STROKE_QUALITY_FLOOR: 0.78, STROKE_QUALITY_CATASTROPHIC: 0.78,
  STROKE_QUALITY_CATASTROPHIC_LENIENT: 0.65, STROKE_QUALITY_LENIENT_GATE: 0.75,
  STROKE_POSITION_MAX: 0.32, STROKE_POSITION_CATASTROPHIC: 0.35,
  STROKE_COMPLETION_MIN_SPAN: 0.60, STROKE_COMPLETION_CATASTROPHIC: 0.52,
  ABS_POSITION_MAX: 0.65, STROKE_FAIL_TOLERANCE: 1,
}
```

### カタカナ easy

```js
{
  PASS_THRESHOLD: 0.45,
  STROKE_QUALITY_FLOOR: 0.78, STROKE_QUALITY_CATASTROPHIC: 0.78,
  STROKE_QUALITY_CATASTROPHIC_LENIENT: 0.73, STROKE_QUALITY_LENIENT_GATE: 0.85,
  STROKE_POSITION_MAX: 0.42, STROKE_POSITION_CATASTROPHIC: 0.44,
  STROKE_COMPLETION_MIN_SPAN: 0.60, STROKE_COMPLETION_CATASTROPHIC: 0.52,
  ABS_POSITION_MAX: 0.65, STROKE_FAIL_TOLERANCE: 1,
}
```

standard/preciseは§8（本文）の値のまま完全に不変。

## 18. 較正結果（拡張beginnerデータセット、engine.js/engine-katakana.js公式実装で実測）

| Level | ひらがな positive | カタカナ positive | 新規negative漏れ |
|---|---|---|---|
| precise | 2306/2760 (83.55%) | 2336/2760 (84.64%) | 0（既知残存のみ） |
| standard | 2386/2760 (86.45%) | 2410/2760 (87.32%) | 0 |
| **easy** | **2430/2760 (88.04%)** | **2430/2760 (88.04%)** | **0** |

easy > standard > precise の順序を両文字体系で確認（ひらがな+1.6pt、カタカナ+0.7pt、easy vs standard）。**「99%前後」という当初目標は達成していない**（§19で理由を明記）。目標文字（い・あ・き・た・も／ア・ウ・ミ・テ・シ）はwobble 0.02〜0.04で全て確実にPASSすることを確認。い/ニの必須regressionはeasyでもpass=falseを維持。

## 19. 目標未達の正直な報告（99% → 実測88%）

較正の過程で、**「W4ジグザグ攻撃」と「70%程度まで正直に描いた初心者のstroke」は、shape/coverage（floor）指標の分布が本質的に重なり合う**ことを実測で確認した（§14.2）。この重なりは今回追加したcompletion連動の分岐でも完全には解消できず（W4はcompletionを保ったまま、初心者の短縮strokeはcompletionも一緒に下がる、という相関を使って多くのケースは分離できたが、shortened1_0.7〜0.8のうち一定割合は依然RETRYになる）。

これは実装の詰めが甘いのではなく、**現在のshape類似度メトリクス（DTWベースのshape/coverage）が、「意図的な形状破壊」と「未熟なstroke」を70%完成度あたりで確実に区別できるだけの解像度を持たない**という、測定手法自体の限界である。80%以上の完成度では両者はより明確に分離できる（shortened_0.8以上はより高い確率でPASSする）。

「明確なNegativeを通してはならない」という安全最優先の要件を厳守した結果として、この88%という数値を正直に報告する。3 Levelの安全な分離自体は成立している（§18で実証済み）ため、「無理にLevelを3段階作らない」（原方針）へのSTOP判断には該当しないと判断した。

## 20. Default / Reset（RC確定）

**defaultを`precise`から`standard`へ変更した**（T5-B'時点は「User Approvalなしに変更しない」としていたが、T5-B''で「defaultはstandardを維持する方向」と明示的に指示されたため、RC完成時点の変更として実施）。`resetTracingJudgmentLevel()`のリセット先も`precise`から`standard`へ変更した。**これは現行Productionの挙動そのものを変える意思決定であり、Production Release前にUser自身の最終承認を必須とする。**

## 21. UI文言

easyの説明文を「はじめてのなぞりにおすすめです。線が下書きから少し外れたり、形がくずれたりしても、大まかに書けていれば成功になります。」に変更（教員・支援者向けの目的明確化）。standard/preciseの文言は変更なし。

## 22. Learning Record / Foundation / Engine Isolation

`tracingJudgmentLevel`のApp-specific payload記録は変更なし。T5-B Learning Record Foundation（`donomanaRecordReadLog`等4関数）は完全に維持、実機で1操作=1件（重複記録なし）を再確認。公式Golden Test 4種（`golden-tests.js`・`golden-tests-full46.js`・`golden-tests-independent46.js`・`golden-tests-katakana-independent46.js`）はfloorGuard機構の変更後も全件再実行し、ALL CLEAN / ALL STRICT CHECKS PASSEDを維持（standard/precise・Metrics Engineへの回帰ゼロ）。

## 23. 改訂履歴（Addendum）

| 版 | 日付 | 内容 |
|---|---|---|
| Addendum | 2026-08-29 | Phase T5-B''。easyをBeginner Forgiveness Policyとして再設計（STROKE_FAIL_TOLERANCE・completion連動floor catastrophic・ABS_POSITION_MAX adjustable化）。default/resetをstandardへ変更（RC確定、User最終承認待ち）。99%目標は未達（実測88%）だが、根拠を明記した上でeasy>standard>precise の安全な分離を実証 |
| Addendum 2 | 2026-08-29 | Phase T5-B'''。easyを「standardの閾値緩和版」から「Beginner Coarse Pass」(通常easy判定→フォールバック→RETRY)へ再設計。standard/preciseは完全Freeze(無変更)。§24〜以降参照 |

---

# Addendum 2（Phase T5-B'''）: Beginner Coarse Pass

## 24. 背景・User Review判定

Phase T5-B'' User Review結果: standard・precise・default=standard・Reset=standardはAPPROVED。**easyのみNOT YET APPROVED**（standard比+0.7〜1.6ptでは「明確な差」として不十分と判断）。目的は、easyを「standardの閾値緩和版」から「対象文字を書こうとして十分な描画活動に参加できたか」を見る**Beginner Coarse Pass**へ再設計すること。standard/preciseは本Phaseで完全にFreeze（1行も変更していない）。

## 25. Beginner Coarse Passアーキテクチャ

`evaluateCharacter()`内で、通常のeasy判定（§17の値、無変更）が**RETRYになった場合のみ**、以下のフォールバック判定を追加した。

```
A. 通常easy判定でPASS → PASS（path="normal"）
B. 通常easy判定はRETRY。ただしCoarse Hard Safetyを通過し、
   Beginner Coarse条件（character-levelのtolerance拡張・Position除外）を満たす → PASS（path="beginner_coarse"）
C. Bも満たさない → RETRY（path="none"）
```

`opts.judgmentProfile.BEGINNER_COARSE`が`true`の場合のみ発火（easyのみ設定）。standard/preciseはこのブロックへ一切到達しない。`reason`に`ok_beginner_coarse`という専用値を追加し、通常合格と区別できるようにした。

## 26. Hard Safety（Coarse Passでも維持）

```
hardGate.strokeCount && hardGate.minLength && absGeom.scaleOk
  && characterDiscriminationOk && (katakana: selfReflectionOk)
  && totalLengthRatio >= COARSE_TOTAL_LENGTH_MIN
  && relativePositionOk
```

`hardGate.grossLocation`と`absGeom.positionOk`（絶対位置）は**意図的に除外**した（§27参照）。Multi-Hypothesis Assignment Safety Guard・Self-Reflection Discrimination・Relative Character Discrimination（cross-character）・ABS_SCALE（極端scale攻撃防止）は無変更のまま維持。

## 27. easyで無視/Soft化したGuard

| Guard | 通常easy | Coarse Pass |
|---|---|---|
| Absolute Position（文字全体位置） | ABS_POSITION_MAX=0.65 | **評価しない**（後述の相対位置チェックのみ） |
| Per-Stroke Position | STROKE_POSITION_MAX/CATASTROPHIC | **評価しない** |
| Per-Stroke Quality Floor | tolerance=1（固定1画） | tolerance=floor(n×0.5)（stroke数に比例） |
| Per-Stroke Completion | tolerance=1（固定1画） | tolerance=floor(n×0.5)（stroke数に比例） |
| PASS_THRESHOLD | 0.45（score=avgStrokeScore×spatialWeight込み） | COARSE_PASS_THRESHOLD=0.38（avgStrokeScoreのみ、spatialWeight除外） |

## 28. Coarse Metrics（実装した2種、smoothingは不要と判断）

1. **totalLengthRatio**（character-level総描画長比）: near-empty検出用。`COARSE_TOTAL_LENGTH_MIN=0.35`
2. **relativePositionMetric**（新規実装、最重要）: 「文字全体を平行移動しても値が変わらない、他strokeとの相対位置」。各strokeのcentroidから文字全体重心を引いた値をreferenceと比較する。

較正で§9「Strong Smoothing」を独自の平滑化パイプラインとして実装することは見送った。理由: 位置を除外した状態でのW2（1画だけ他画と無関係な位置へずらす攻撃）対策として、上記の相対位置指標だけで十分な安全マージン（後述）が実測できたため、追加の平滑化ロジックはリスク対効果で見送り、既存shape/coverage計算（bidirectional nearest-point距離、stroke内正規化=intrinsic座標）をそのまま再利用する設計とした。

### 28.1 重大な発見: 単画文字での相対位置チェックの無効化

較正中、単画文字（例: カタカナ「レ」）でW2攻撃が相対位置チェックをすり抜けるバグを発見した。原因: 単画文字では「他のstrokeとの相対位置」という概念自体が成立せず（比較対象となる他画がなく、文字全体重心＝その1画自身の重心となるため、差分が常に0になる）。対策として、**単画文字（n=1）ではabsolute position（既存easy通常判定で較正済みのSTROKE_POSITION_CATASTROPHIC）へ安全にフォールバックする**設計へ修正した。この結果、単画文字はCoarse Passでも通常easyと同程度のposition厳格さが残る（Beginner Forgivenessの恩恵が他のtolerance機構同様、単画文字では限定的になる、既知の制約として記録する）。

### 28.2 重大な発見: completionも絶対座標に依存

Position除外後もなお大きなoffsetがcompletion不足で誤ってRETRYになるバグを発見した。原因: completion（progressSpan）は絶対座標（absPoints）基準で計算されており、文字全体のoffsetの影響を受ける（shape/coverageはstroke内正規化=intrinsic座標のため無関係）。対策: Coarse Pass専用に、文字全体の重心をreferenceへ揃えてから（=offset分を打ち消してから）completionを再計算する処理を追加した。この修正により、大きなoffsetのテストケースがすべて解消した（§29参照）。

## 29. 較正結果（拡張beginnerデータセット、公式engine.js/engine-katakana.js実装で実測）

| Level | ひらがな positive | カタカナ positive | 新規negative漏れ |
|---|---|---|---|
| precise | 2463/2990 (82.37%) | 2513/2990 (84.05%) | 0（既知残存のみ） |
| standard | 2558/2990 (85.55%) | 2595/2990 (86.79%) | 0 |
| **easy** | **2676/2990 (89.50%)** | **2665/2990 (89.13%)** | **0** |

**easy vs standard差**: ひらがな+3.95pt、カタカナ+2.34pt（T5-B''の+1.6pt/+0.7ptから大幅に拡大）。負例漏れは全Level・両文字体系で新規ゼロを維持。

## 30. Manual Priority Set結果

ひらがな（い・あ・き・た・も）: largeOffset(0.18,0.08)・wobble(0.05)・rotate(0.10rad)・shortStroke(75%)の全20ケース中**20/20 (100%)** PASS。

カタカナ（ア・ウ・ミ・テ・シ）: 同条件で**18/20 (90%)** PASS。残り2件のうち:
- ア(shortStroke75%): `stroke_quality_floor_failed`ではなく実際は**Relative Character Discrimination**が原因（該当strokeを75%短縮した結果、実測でナ寄りに近づいたための正当な拒否。安全機構が意図通り機能した結果であり、較正の不備ではない）
- シ(wobble0.05): 3画中2画がfloor閾値(0.78)をわずかに下回った（0.777・0.769）ケース。tolerance比率を0.5〜0.7まで振っても改善せず（floor/completion連動catastrophicの「completion高い＝厳格側」分岐が即時reject するため、tolerance回数の増加が効かない構造的な限界と判明）。既知の制約として記録し、安全性を優先してこれ以上の緩和は行っていない（W4ジグザグ攻撃対策のcatastrophic=goodという安全策を崩すリスクがあるため）

## 31. Negative Safety確認

- near-empty（あ、3点のみ）: RETRY（hard_gate_failed）
- 明らかな無関係scribble（あ）: RETRY（stroke_quality_floor_failed）
- 極端scale攻撃（25%、あ）: RETRY（hard_gate_failed）
- い/ニ regression: easyでもRETRY（stroke_quality_floor_failed、score=0.113）を維持
- 公式Golden Test 4種は全件ALL CLEAN / ALL STRICT CHECKS PASSEDを維持（standard/precise・Metrics Engineへの回帰ゼロ）

## 32. UI / Persistence / Reset / Record

UI文言をUser指定の文言（「はじめてのなぞりにおすすめです。線が下書きから外れたり、形が少しくずれたりしても、大まかに書けていれば成功になります。」）へ更新。standard/preciseの文言・default=standard・Reset=standardは無変更。`tracingJudgmentLevel`記録も無変更。`acceptancePath`（"normal"|"beginner_coarse"|"none"）は`evaluateCharacter()`の戻り値・デバッグパネル用に実装したが、利用者向けLearning Recordのpayloadには追加していない（Task指示通り、不要な技術情報を無条件追加しない方針）。

## 33. 改訂履歴（Addendum 2）

| 版 | 日付 | 内容 |
|---|---|---|
| Addendum 2 | 2026-08-29 | Phase T5-B'''。Beginner Coarse Pass実装（character-level tolerance拡張・Position除外・相対位置安全網）。easy vs standard差を+3.95pt/+2.34ptへ拡大（T5-B''の+1.6pt/+0.7ptから）。単画文字のposition fallback・completion位置合わせ再計算という2件の重大バグを較正中に発見・修正。新規negative漏れゼロを維持 |
