# どのまな なぞり判定レベル設計書（Version 1.0）

- 版: v1.0 Draft / RC相当（Phase T5-B''で改訂）
- 発行: 2026年8月（Phase T5-B'起草 → Phase T5-B''でeasy再設計）
- 位置づけ: `donomana-tracing-accuracy-design-v1.md`（T2/T3、Metrics Engineそのものの精度設計）を土台に、**同じMetrics Engineの上に3段階の判定許容度（Judgment Policy）を追加する**設計・較正記録。T2/T3で確立したMetrics Engineの計算式・Hard Safety Guardは変更しない。
- 対象: `hiragana-learn.html`・`katakana-app.html`・`tools/tracing-poc/engine.js`・`tools/tracing-poc/engine-katakana.js`
- 承認状態: **Draft / RC。全35アプリ中この2アプリのみ対象。Production Releaseは行っていない。**

> §1〜12はPhase T5-B'時点の記述（歴史的記録として保持）。**easyの数値・設計はPhase T5-B''で全面的に再設計されており、以下Addendumが最新かつ正式**。standard/preciseはT5-B'時点のまま変更していない。
>
> **easyの現行値・現行の仕組みは Addendum 4（Phase T6-A、§39〜）が最新。** §6の表・§17の値はその時点の記録であり、現行値ではない。easyの較正を再現する手段は `tools/tracing-poc/golden-tests-easy46.js`・`golden-tests-katakana-easy46.js`（§44）。

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

> **（Phase T6-Aで追記）上表の「Adjustableは4値」はT5-B'時点の記述。** 現在standard/preciseが上書きするのはこの4値のみだが、easyはT5-B''〜T6-Aで追加された値を含む計21項目を持つ（一覧は§40）。`ABS_POSITION_MAX`はT5-B''でAdjustableへ移っている（§14.3）。Hard Safetyの行のうち`ABS_POSITION_MAX`以外は現在も全Level共通。

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

> **（Phase T6-Aで追記）下表の`easy`の行は再設計前（T5-B'時点）の値で、現行値ではない。** `precise`・`standard`の行は現行値のまま。easyの現行値は§40の表を参照。

### ひらがな

| Level | PASS_THRESHOLD | STROKE_QUALITY_FLOOR | STROKE_POSITION_MAX | STROKE_COMPLETION_MIN_SPAN |
|---|---|---|---|---|
| precise | 0.60 | 0.80 | 0.26 | 0.50 |
| standard | 0.58 | 0.78 | 0.30 | 0.46 |
| easy（再設計前） | 0.50 | 0.78 | 0.34 | 0.46 |

### カタカナ

| Level | PASS_THRESHOLD | STROKE_QUALITY_FLOOR | STROKE_POSITION_MAX | STROKE_COMPLETION_MIN_SPAN |
|---|---|---|---|---|
| precise | 0.60 | 0.80 | 0.355 | 0.50 |
| standard | 0.58 | 0.78 | 0.40 | 0.46 |
| easy（再設計前） | 0.50 | 0.75 | 0.40 | 0.46 |

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

> **（Phase T6-Aで追記）`COARSE_RELATIVE_POSITION_MAX`の実装値は、ひらがな 0.10・カタカナ 0.15。** カタカナの0.15は本書に記載がなく、コード内コメントも「0.10を採用」のままだった（Phase 1調査で判明した記載漏れ。実装値そのものはT5-B'''から変わっていない）。

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

---

# Addendum 3（Phase T5-E-A''）: User-facing Disclosure + Help Standard Compliance

## 34. 背景

T5-B'〜B'''でapprovedされた3段階Judgment Policy（easy/standard/precise）は、`hiragana-learn.html`・`katakana-app.html`の`#settings`セクション（3ボタンUI）にのみ実装されており、`apps-data.json`（アプリ紹介ページ・SEO説明の元データ）には反映されていなかった。両アプリは`donomana-help-inventory-v1.md`上Group D（Helpなし）でもあった。本Phaseはこの2点のギャップを埋める。**Tracing Engine（`evaluateCharacter()`・`THRESHOLDS`・`TRACING_JUDGMENT_PROFILES`の数値・Hard Safety Guard）は一切変更していない。**

## 35. apps-data.json Disclosure

両アプリの「なぞり」feature descriptionを「じょうず判定つき」から「指でなぞって書く練習。『やさしく・ひょうじゅん・ていねいに』の3段階から、学習段階に合わせて判定のやさしさを選べます。」へ更新した（実際のUI名称と完全一致）。「判定を甘くする機能」等の能力評価的な表現は用いていない。hiragana-learnの`lesson.tips`にあった旧説明（「じょうず判定は参考程度に」、3段階判定導入前の名残で内容が陳腐化していた）を、3段階の使い分け案内へ更新した。katakana-appの`lesson.tips`（カタカナ語連想の既存tip）はそのまま維持し、3段階判定の案内を追記した。

## 36. Help / Usage Guide Standard準拠

`donomana-help-usage-guide-standard-v1_0.md`（Reference Implementation: `dotchiga-ii-app.html`）に準拠し、両アプリへ「つかいかた」を新設した。

- **入口**: Common Chrome固定位置（`donomanaLockBtn`の隣、`top:64px`のクラスター）に`donomanaHelpBtn`を追加。generate.js所有の`lock-fs-btn`マーカーブロックの外側（DOM順で後ろ）に配置し、`div:has(> #donomanaLockBtn){right:64px!important}`でLockクラスターを押し出すことでLock→Help順を実現した（dotchiga-ii-app.htmlと同一手法）。generate.jsの共通テンプレート自体は変更していない。
- **表示方式**: 両アプリの既存tab切替UI（`.tab-btn`/`.section.active`）をそのまま再利用し、Helpを新しい`.section#help`として追加した。tab-btn自体は既存の`settings`タブと同型の「非表示tab-btn + 別ボタンから`.click()`」方式（display:none、Common Chromeボタンからのみ到達）とし、新しいoverlay機構やLegacy modalは作っていない。
- **内容構造**: h2（つかいかた）→h3（このアプリについて／学習のすすめ方／なぞり／操作方法／設定／記録）→h4（なぞりの3段階・操作方式ごと）。実装済みの活動・タブ名と一致させ、存在しない機能は書いていない。
- **入力方式**: 実コード監査により両アプリともGaze実装なしを確認（`INPUT_METHOD_LABEL`等の定数に`gaze`キーが存在するのみで、実際のGaze入力コードは存在しない）。HelpにはTouch・Switch・Keyboardのみ記載した。
- **Switch Scan Isolation**: 新しいisolation機構は作らず、既存の「`.section.active`のみをscan」という仕組みにそのまま乗せた。`donomanaHelpBtn`自体は`.section`外にあるため、`getScanTargets()`（hiragana-learn）・`buildScanItems()`（katakana-app）を最小限拡張し、常にscan候補の先頭へ含めた。Help表示中は`.section#help`のみがscan対象になり、背面の学習targetは自動的に除外される（実ブラウザで確認、§37参照）。Home/Lock等の既存Common Chromeボタンは元々この機構のscan対象外であり、本Phaseではそちらへ手を加えていない（既知の別課題として現状維持）。
- **Focus管理**: Help open時は`helpTitle`（h2、`tabindex="-1"`）へfocus、close時（とじるボタン／Escape）は`donomanaHelpBtn`へfocus returnする。

## 37. 検証結果

実CSV/実ブラウザ検証と同じ厳密さで、Playwright制御Chromiumにより両アプリで以下を確認した。

- Help button常時表示、44×44px、`aria-label`/`title`="つかいかた"、`aria-expanded`が開閉に応じてtrue/false
- クリック・Enterキー双方でHelp open、Escape・とじるボタンでclose、focus移動・focus returnとも正常
- 見出し階層（h2→h3→h4、レベル飛ばしなし）を実測で確認（h3×6、h4×6）
- Switch Scan: `scanMode`有効時、Help表示中は候補が`[donomanaHelpBtn, helpCloseBtn]`のみ（背面の学習target除外）、close後は元のタブの全候補＋`donomanaHelpBtn`へ復帰することを実測で確認
- Responsive: 375×667・375×812・390×844・768×1024・1280×900の全5viewportでHome/Lock/Help/A11yボタンの衝突なし（44px維持）
- Tracing Regression: 公式Golden Test 4種（`golden-tests.js`・`golden-tests-full46.js`・`golden-tests-independent46.js`・`golden-tests-katakana-independent46.js`）全件ALL CLEAN / ALL STRICT CHECKS PASSED、Engine差分ゼロ
- Learning Record / CSV Regression: trace record追加・Viewer表示・CSV出力（T5-E-A'のExcel互換フォーマット=日付`YYYY.MM.DD`+時刻`HH:mm:ss`、BOM維持）・削除確認ダイアログ・reload永続化を実ブラウザで再確認、全て回帰なし
- console/page error: 両アプリとも0/0
- `node generate.js`の2回連続実行でファイルhashが完全一致（idempotent）を確認

## 38. 改訂履歴（Addendum 3）

| 版 | 日付 | 内容 |
|---|---|---|
| Addendum 3 | 2026-08-30 | Phase T5-E-A''。apps-data.jsonへ3段階Judgment Policyの利用者向け説明を追記。hiragana-learn/katakana-appへDonomana Help / Usage Guide Standard v1.0準拠の「つかいかた」を新設（Group D→Group A）。Tracing Engine・Learning Record・CSV Excel互換への回帰ゼロを確認。RC、User Browser Review待ち |

---

# Addendum 4（Phase T6-A）: Smooth Path（なめらか経路）＋ 到達の逆転解消

## 39. 背景

公開後、利用者から「『やさしく』に設定しても、なかなか判定が厳しい」という声が届いた。2026-11-28 に Phase 1（READ-ONLY 調査）→ Phase 2（設計・メモリ上の較正）→ Phase 3（実装、本Addendum）の順で対応した。**standard/precise の値と挙動、既存の Hard Safety（画数の一致・別の文字との区別・カタカナの既存の鏡像判定・最低長さ・大きさ等）は一切変更していない。**

Phase 1 の実測で分かったこと（46文字 × 約76条件の合成なぞり、両アプリ）:

- easy で落ちる原因の約9割は per-stroke Quality Floor（形の合格ライン 0.78）。短い線も、到達（completion）ではなく形の点数が先に下がって落ちていた。
- Beginner Coarse Pass が合格へ戻せていたのは、通常判定で不合格になった試行の 5.5%（ひらがな）／4.5%（カタカナ）で、ほぼ全体の位置ずれ・大きさ違いだけだった。Coarse Pass でも「到達が十分ある画」の形の下限は 0.78 のままのため。
- 既存の値（floor・completion・相対位置・許容本数・合格ライン）をどう組み合わせても、新規漏れゼロで得られる改善は +0.3〜1.0 ポイントにとどまった。floor を下げると、ひらがなは 0.76 から、カタカナは 0.70〜0.72 から、ジグザグと鏡像が漏れ始める（§5.4・§16.3 の再確認）。
- easy の completion（0.60／0.52）が standard（0.46）より厳しく、「standard では通るのに easy では落ちる」逆転が起きていた（ひらがな 6件、カタカナ 30件）。

## 40. 現行の easy Profile（Phase T6-A 時点。§6・§17 の easy の値を置き換える）

| 項目 | ひらがな | カタカナ |
|---|---|---|
| PASS_THRESHOLD | 0.45 | 0.45 |
| STROKE_QUALITY_FLOOR ／ STROKE_QUALITY_CATASTROPHIC | 0.78 ／ 0.78 | 0.78 ／ 0.78 |
| STROKE_QUALITY_CATASTROPHIC_LENIENT ／ STROKE_QUALITY_LENIENT_GATE | 0.65 ／ 0.75 | 0.73 ／ 0.85 |
| STROKE_POSITION_MAX ／ STROKE_POSITION_CATASTROPHIC | 0.32 ／ 0.35 | 0.42 ／ 0.44 |
| STROKE_COMPLETION_MIN_SPAN ／ STROKE_COMPLETION_CATASTROPHIC | **0.50 ／ 0.50**（T6-Aで変更、旧 0.60 ／ 0.52） | **0.50 ／ 0.50**（同左） |
| ABS_POSITION_MAX ／ STROKE_FAIL_TOLERANCE | 0.65 ／ 1 | 0.65 ／ 1 |
| BEGINNER_COARSE ／ COARSE_FAIL_TOLERANCE_RATIO | true ／ 0.5 | true ／ 0.5 |
| COARSE_PASS_THRESHOLD ／ COARSE_TOTAL_LENGTH_MIN | 0.38 ／ 0.35 | 0.38 ／ 0.35 |
| COARSE_RELATIVE_POSITION_MAX | 0.10 | 0.15 |
| **SMOOTH_PATH**（T6-Aで追加） | true | true |
| **SMOOTH_QUALITY_FLOOR**（同） | 0.62 | 0.62 |
| **SMOOTH_MAX_EXTRA_REVERSALS**（同） | 3 | 3 |
| **SMOOTH_MAX_LENGTH_RATIO**（同） | 2.5 | 2.5 |
| **SMOOTH_MIRROR_MARGIN**（同） | 0.01 | 0.01 |

standard・precise は §6 の値のまま（上書きするのは `PASS_THRESHOLD`・`STROKE_QUALITY_FLOOR`・`STROKE_POSITION_MAX`・`STROKE_COMPLETION_MIN_SPAN` の4値のみ）。SMOOTH 系の値は両アプリで別々に較正し、結果として同じ値が両方で妥当だった（§42 の floor sweep 参照）。

## 41. Smooth Path の仕組み

`evaluateCharacter()` 内で、**通常の easy 判定・Beginner Coarse Pass の両方が RETRY の場合のみ**発火する3つ目の経路。

```
A. 通常easy判定でPASS            → PASS（path="normal"）
B. Beginner Coarse PassでPASS    → PASS（path="beginner_coarse"）
C. A・BともRETRY、かつSmooth Pathの条件を満たす → PASS（path="smooth"、reason="ok_smooth"）
D. いずれも満たさない            → RETRY（path="none"）
```

C の条件:

1. per-stroke Quality Floor（FLOOR・CATASTROPHIC・CATASTROPHIC_LENIENT）だけを `SMOOTH_QUALITY_FLOOR` へ下げた profile で、同じ判定（通常→Coarse）をやり直して PASS する。strokeCount・minLength・ABS_SCALE・Relative Character Discrimination・（カタカナ）Self-Reflection Discrimination／Multi-Hypothesis Assignment Safety Guard、および position／completion の各 Guard は、やり直しの中でそのまま働く。
2. そのうえで、形（`min(shape, coverage)`）が通常の `STROKE_QUALITY_FLOOR`（0.78）未満だった画の**1本ごと**に、次の3つをすべて満たす。
   - **余分な向きの切り返し** ≦ `SMOOTH_MAX_EXTRA_REVERSALS`: その画を32点に等間隔 resample した折れ線で、隣り合う線分のなす角が90度を超える箇所を数え、お手本（同じ数え方）の数を引いた値。
   - **線の長さの膨らみ**（`lengthRatio` = 描いた線の長さ ÷ お手本の長さ）≦ `SMOOTH_MAX_LENGTH_RATIO`。
   - **鏡像に近くない**: その画（64点、intrinsic正規化）と、お手本の画との DTW 距離から、お手本の画をその画自身の bbox 中心で左右／上下に反転した形との DTW 距離（小さいほう）を引いた差 ≦ `SMOOTH_MIRROR_MARGIN`。

実装は、`SMOOTH_PATH` を false にした緩和 profile で `evaluateCharacter()` 自身をもう1回だけ呼ぶ形とした（再帰は1回限り）。既存の2経路のコードは変更しておらず、`SMOOTH_PATH` 省略時（standard／precise／profile なしの既存呼び出し）はこのブロックに到達しない。したがって「今 PASS する試行は必ず PASS のまま」（足すだけ）であり、公式 Golden Test 4種の結果は変更前と同一である（§44）。通常・Coarse の両方で失敗した easy の試行に限り評価が2回走る。実測（headless Chromium、46文字に幅0.08の揺れを与えた条件）で1回の判定は平均 22〜42ms・最大 83ms だった。

同一の変更を `hiragana-learn.html`・`katakana-app.html`・`tools/tracing-poc/engine.js`・`tools/tracing-poc/engine-katakana.js` の4ファイルへ適用した（アプリ本体とPoC参照実装を同一内容に保つ既存パターン）。

### 41.1 指標の選定根拠（Phase 2 の実測）

形が 0.50〜0.78 の画について、救いたい側と止めたい側の分布を比較した（ひらがな。カタカナも同傾向）。

| 画の種類 | lengthRatio（中央値／90%点） | 余分な切り返し（中央値／90%点） |
|---|---|---|
| 救いたい：短い線 | 0.70／0.79 | 0／0 |
| 救いたい：はみ出し | 1.29／1.30 | 0／1 |
| 救いたい：揺れ＋細かい震え | 2.04／2.95 | 3／7 |
| 止めたい：ジグザグ（振幅30%・10往復） | 9.54／11.35 | 18／18 |
| 止めたい：ジグザグ（振幅30%・4往復） | 3.48／4.28 | 6／6 |
| 止めたい：鏡像 | 1.00／1.00 | 0／0 |

- 切り返しを主、長さを控えとした。floor 0.62・鏡像チェックありで比べると、ひらがなでは「切り返し3回以下」が +275件／本命漏れ5件、「長さ2倍以下」が +288件／本命漏れ14件（ジグザグ10件を含む）。
- 「線をならした後との長さ比」「曲がりの総量」は、同じ漏れ数で合格増が少ないため不採用。
- 鏡像は長さでも切り返しでも見分けられない（上表）。鏡像チェックなしで floor を 0.62 に下げると鏡像が ひらがな 40件・カタカナ 9件 新たに通り、チェックありで両方 0 件になった。カタカナ既存の Self-Reflection Discrimination は文字全体の平均で見るため「1画だけ鏡像」を拾えない。既存判定は残したまま、Smooth Path 内の確認として画ごとの方式を足した。

### 41.2 救う対象の線引き

目的は合格率の最大化ではない。救う対象は「揺れ・短い・はみ出し等の、書こうとした跡が見えるなぞり」に限る。2026-11-28 に User が承認した線引き:

1. 1画がお手本の約半分で止まった線は、easy では合格側に倒す（completion 0.50／0.50 の帰結として、50%打ち切りの一部が通ることを含む）。
2. 1画だけ中くらいずれた線がカタカナで2件通ることを許容する（T6-A 以前から同種は通っている）。
3. 曲がった画をまっすぐな線で書いたものが新たに通ることを許容する（T6-A 以前の延長の範囲）。
4. ゆるいジグザグ（1〜3往復）は、切り返し上限3回のまま許容する。お手本に沿った細かいジグザグ（6往復以上）は T6-A 以前から easy で 81〜100% 通っており、その扱いは変えていない。

## 42. 較正結果（`golden-tests-easy46.js`／`golden-tests-katakana-easy46.js` の実測）

救いたい側（＋指が離れる条件）の合格率:

| | 変更前の easy | 現行の easy |
|---|---|---|
| ひらがな | 77.4% | **85.2%** |
| カタカナ | 77.5% | **84.7%** |

条件別（変更前 → 現行）:

| 条件 | ひらがな | カタカナ |
|---|---|---|
| ゆっくりした揺れ＋画の傾き | 72.8 → 83.5% | 60.5 → 79.2% |
| 全画が短い | 54.3 → 70.1% | 66.3 → 71.2% |
| 1画だけ短い | 66.7 → 74.9% | 79.7 → 84.3% |
| 書き始めが遅い | 71.0 → 89.9% | 82.6 → 90.6% |
| はみ出し | 66.7 → 88.4% | 82.6 → 93.5% |
| 複合（軽） | 79.0 → 96.4% | 72.5 → 92.0% |
| 複合（中） | 31.9 → 61.6% | 30.4 → 46.4% |
| 複合（重） | 12.3 → 24.6% | 3.6 → 12.3% |
| 滑らかな揺れだけ（参考枠。上の合格率には含めない） | 61.9 → 88.4% | 51.4 → 80.7% |

- 変更前に合格していて不合格に変わった試行: 両アプリとも **0件**。
- 逆転（standard で合格・easy で不合格）: ひらがな 6件 → **1件**（`も:J2:mixMod#3`、承認済みの例外）、カタカナ 30件 → **0件**。
- 複合（重）が低いままなのは、主に Relative Character Discrimination（別の文字に近い）で止まるため。ここは緩めていない。

止めたい側で新たに合格になったもの:

| | ひらがな | カタカナ |
|---|---|---|
| 本命 | 5件（1画の文字で形がもともと0.77台だった線4件: 「く」を縦線1本、「の」を丸、「く」「へ」のなぐり書き各1。「そ」の4往復ジグザグ1件） | 4件（「ミ」を横線3本、「リ」を縦線2本、completion 変更による「1画を中くらいずらす」2件） |
| 境界枠 | 28件（1画または全画をまっすぐな線に 18件、50%／55%打ち切り 10件） | 23件（まっすぐな線 22件、55%打ち切り 1件） |

別の文字・全体鏡像・1画だけ鏡像・振幅30%10往復のジグザグ・45%打ち切り・極端な縮小・1画を別の場所に書く、は両アプリとも新規合格 0件。件数の母数（定義データから導いた評価件数）はテストの出力を正とする。

floor の下げ幅による違い（Phase 2 の実測。合格率／本命漏れ／境界枠）:

| SMOOTH_QUALITY_FLOOR | ひらがな | カタカナ |
|---|---|---|
| 0.74 | 80.7%／5／13 | 80.5%／2／14 |
| 0.70 | 83.4%／5／17 | 82.3%／2／21 |
| 0.66 | 84.2%／5／18 | 83.8%／3／23 |
| **0.62** | **85.2%／5／28** | **84.7%／4／23** |
| 0.58 | 86.0%／7／29 | 85.1%／5／26 |
| 0.54 | 86.3%／9／41 | 85.5%／7／27 |

## 43. 既知の制約・未確認事項

- **実機未確認**: 切り返しの数え方は、実機の入力の癖（指を止めたときの細かなぶれ）の影響を受けうる。合成データでは問題が出ていない（途中で止まる条件は100%合格）が、iPad 実機での確認は User Review の領域であり、本Addendum 時点で行われていない。
- **1画の文字**: 形が 0.78 すれすれだった無関係な線が、ひらがなで4件新たに通る（§42）。今回は1画の文字だけ別扱いにしていない。実機・利用実績で問題が見えたら別途検討する。
- **途中で指が離れて画が2つに割れる問題**: アプリは期待画数に達した瞬間に判定するため、割れるとほぼ不合格になる（「最初の画が割れる」条件は easy でも ひらがな 0%・カタカナ 2%）。進行の仕組みの問題であり、T6-A の範囲外（別Phase）。Phase 2 の計測: お手本の筆順データで「前の画の終点→次の画の始点」が近く（0.10以内）かつ向きが揃う（45度以内）組は、ひらがな58組・カタカナ62組のいずれにも0組。
- **合成データの限界**: 「子どもらしいなぞり」は合成であり、実際の子どもの記録ではない。合格率の絶対値より、変更前後の差と、新たに通ったものの中身を根拠とすること。

## 44. 検証・較正の再現手段

T5-B' から T5-B''' までの easy 較正スクリプトはリポジトリに残っておらず、公式 Golden Test 4種も profile なし（precise 相当）しか実行しないため、T6-A 以前は easy と Coarse Pass を検証する自動テストが存在しなかった。T6-A で次を追加し、**以後 easy の較正の再現手段はこのテストとする。**

- `tools/tracing-poc/easy-calibration-cases.js`: 条件の定義データ（救いたい側・参考枠・指が離れる条件・止めたい側・境界枠）。件数は定義 × 文字 × 画の位置 × 同画数の他文字 から実行時に導く。
- `tools/tracing-poc/golden-tests-easy46.js`（ひらがな）・`golden-tests-katakana-easy46.js`（カタカナ）: 判定の設定値は写さず、本番HTMLの `TRACING_JUDGMENT_PROFILES` をそのまま読む。確認項目は ①件数（導いた件数＝評価した件数）②本番エンジンと参照実装の全件一致 ③合格→不合格に変わった試行が0件 ④止めたい側（本命）の新規合格が承認済みの一覧と一致 ⑤境界枠の新規合格の内訳が承認済みと一致 ⑥逆転が承認済みの例外を除き0件 ⑦救いたい側の合格率が承認時の較正値以上。

Phase T6-A での実行結果:

- 新規テスト2種: いずれも ALL EASY CALIBRATION CHECKS PASSED（本番エンジンと参照実装の不一致 0件）。
- 公式 Golden Test 4種（`golden-tests.js`・`golden-tests-full46.js`・`golden-tests-independent46.js`・`golden-tests-katakana-independent46.js`）: 変更前と同一結果（出力の差は実行時間の行のみ）。
- headless Chromium で両アプリを `file://` で開き、page error／console error 0件、easy で Smooth Path 経由の合格が実際の判定フロー（`evaluateTraceAttempt`）で「じょうず」表示になること、同じなぞりが standard では RETRY になること、記録の `tracingJudgmentLevel` が従来どおり `easy` で保存されることを確認。**これは実機確認ではない。**

## 45. UI / Persistence / Record

設定画面の文言・3ボタンUI・保存キー（`hiragana_tracing_level`／`katakana_tracing_level`）・default／Reset（standard）は無変更。Learning Record の形式も無変更（`tracingJudgmentLevel` は従来どおり `easy`／`standard`／`precise`）。`acceptancePath` の新しい値 `"smooth"` と `smoothDetail` は `evaluateCharacter()` の戻り値・デバッグ表示用で、利用者向けの記録には追加していない（§32 と同じ方針）。なお、T6-A の前後で記録上の `easy` は区別できない。

## 46. 改訂履歴（Addendum 4）

| 版 | 日付 | 内容 |
|---|---|---|
| Addendum 4 | 2026-11-28 | Phase T6-A。easy に Smooth Path（floor 0.62 での再判定＋画ごとの切り返し・長さ・鏡像の確認）を追加し、completion を 0.60／0.52 → 0.50／0.50 へ変更。standard／precise・Hard Safety は無変更。easy を検証する自動テスト2種と条件定義データを追加。§2・§6・§28 へ現行値への注記を追記。checkpoint 時点で Production Release・Fixed Preview・実機確認は未実施 |
