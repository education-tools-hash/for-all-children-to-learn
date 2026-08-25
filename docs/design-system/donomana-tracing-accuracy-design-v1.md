# どのまな なぞり判定精度改善 設計文書 v1.0

対象: `hiragana-learn.html` / `katakana-app.html` の「なぞり」機能における
じょうず判定(success judgement)アルゴリズム。

本文書は Phase T1(調査・設計、READ-ONLY)と Phase T2-A(Tracing Engine PoC、
Production未統合)の確定事項を記録する。将来のPhaseで改訂を追加していく。

---

## 0. 現状ステータス

- **Phase T1: 完了**(READ-ONLY調査・設計)。Production変更なし。
- **Phase T2-A: 完了 — POC READY, NOT PRODUCTION INTEGRATED**。
  `tools/tracing-poc/` に独立したPoC Engineを実装。`hiragana-learn.html` /
  `katakana-app.html` は無変更。
- 次Phase候補: **T2-B — Local Hiragana Integration Pilot**(User Review後に着手)。

---

## 1. Current Algorithm(現状アルゴリズム)

対象コード: `hiragana-learn.html:2436-2450`(`endTrace()`)、
`katakana-app.html:1644-1652`(同名関数、ほぼ同一実装のcopy-paste)。

判定は以下の1行のみ:

```js
const strokeCount = (strokeData[currentTraceKana] || []).length || 3; // katakanaは||2
if (traceStrokeCount >= strokeCount) { /* じょうず！ */ }
```

- ユーザーのpointer座標は**描画にのみ使用され、判定用には一切保存されない**
  (`tracePCtx.lineTo()`で即座に描画・破棄。`traceLastX/Y`は次セグメントの
  アンカーとしての一時変数に過ぎない)。
- `traceStrokeCount`は「pointerup/touchendの回数」を数えるだけのカウンタ。
- 座標・形状・位置・方向・順序・線長・coverageは**判定に一切関与しない**。
- 成功のみの実装であり、**失敗・リトライのフィードバックはコード上に存在しない**
  (常に「いつか成功する」設計のため)。

## 2. Root Cause

「い」に対し「ニ」(横線2本)・縦線2本・極短2本・離れた2本・順序逆、いずれも
成功する理由は、**画数(`strokeData[文字].length`)が一致してさえいれば
無条件で成功するため**。実行可能な再現スクリプトで全6ケース
(正解含む)が同一に`success=true`になることを確認済み(Phase T1)。

## 3. Reference Data(既存資産)

- `strokeData[文字]` = `[{d: "<SVG path d>", label: "<日本語説明>"}, ...]`
- SVGパスは**KanjiVG由来、viewBox `0 0 109 109`固定**。
- パスコマンドは**`M`(絶対moveto、1組の座標のみ)と`c`(相対cubic bezier、
  6数値の繰り返しグループ)のみ**(hiragana-learn.html全104パスを走査し確認済み)。
- 既存の`getPathSamples()`(`hiragana-learn.html:2118-2135`)がKanjiVGパスを
  一時DOM上のSVG要素経由で等間隔リサンプリングする関数として実装済みだが、
  **ひつじゅんアニメーション専用**でなぞり判定には未使用。
- なぞりのガイド字形は**SVGパスではなく`fillText()`によるフォント描画**
  (`drawGuide()`)。SVG referenceとガイド表示は別経路(→ Section 5参照)。
- 対象は五十音**46文字のみ**(濁音・半濁音・拗音等はなぞり対象外)。

## 4. Educational Requirements(教育要件、T1確定)

防ぎたい: 全く違う形・画数だけ一致・逆方向・文字から離れた位置・極端に短い線・別文字での合格。
許容したい: 手の震え・小さな蛇行・少しのはみ出し・始点終点の多少のずれ・線の長さの多少の違い・運動機能による軌跡の不安定さ。

## 5. Motor Accessibility(運動アクセシビリティ要件、T1確定)

tremor / low motor control / slow movement / interrupted movement /
coarse movement / touch sampling差を、文字理解の失敗と混同しない。
Stroke Order・Directionは**SOFT**(即失敗にしない)方針をT1で確定、
T2-Aで実装・検証済み(Section「Golden Tests」参照)。

## 6. Proposed Architecture(T1提案 → T2-Aで実装)

```
TracingReference → StrokeNormalizer → StrokeFeatureExtractor
  → StrokeMatcher → CharacterEvaluator → TracingFeedback
```

T2-Aでの実装名(`tools/tracing-poc/engine.js`):
`sampleReferencePath()` / `normalizeStroke()`(Absolute+Intrinsic)/
`extractStrokeFeatures()` / `matchStrokes()` / `evaluateCharacter()`。
DOM非依存の純粋関数群(Node/ブラウザ両対応)。

## 7. Golden Tests / PoC Scope

Phase T2-Aで実装・全て記録。次章以降に詳細。

---

# Revision 2 — Phase T2-A 結果(Tracing Engine PoC)

## T2-A.1 Algorithm

**Hard Gate + Soft Score** 方式を採用(T1で候補として提示した方式)。

```
入力: userStrokes (0..1正規化済み点列の配列), referenceStrokeDefs (strokeDataエントリ)
  ↓
各strokeを arc-length で64点にresample (reference: SVGパスから直接 / user: 生点列から)
  ↓
Hard Gate A: ストローク数の厳密一致 (actual === expected、現行の `>=` を廃止)
  ↓ (一致した場合のみ)
Stroke Assignment: user⇔reference の総当たりpermutation(最大4!=24通り)で
  Intrinsic形状コストが最小になる対応付けを算出(順序に依存しない)
  ↓
Hard Gate B: 対応付けられたペアごとに userLength/refLength >= 0.22
Hard Gate C: 各userStrokeの重心が、文字全体bboxを45%外側に広げた領域内
  ↓ (Hard Gate全通過時のみ Soft Score を合否に反映)
Soft Score (stroke毎): shape(bidirectional nearest-distance) / coverage /
  off-path / start-end / direction(絶対値、方向非依存)
Soft Score (文字全体): spatial relationship 一致度、stroke order penalty(小さめ)
  ↓
Composite Score (重み付け合算、0..1) → score >= 0.60 かつ Hard Gate通過 で PASS
```

## T2-A.2 Formulas / Threshold Candidates

`tools/tracing-poc/engine.js` 内 `THRESHOLDS` 定数(**全てPoC仮値、T2-Bで実データにより再調整対象**):

| 定数 | 値 | 意味 |
|---|---|---|
| `SAMPLE_POINTS_PER_STROKE` | 64 | resample点数 |
| `MIN_LENGTH_RATIO` | 0.22 | Hard Gate B(参照stroke長に対する最低比) |
| `GROSS_LOCATION_MARGIN` | 0.45 | Hard Gate C(文字bboxの外側拡張率) |
| `SHAPE_TOLERANCE` | 0.16 | Intrinsic空間でのcoverage/off-path判定半径 |
| `SHAPE_NORM` | 0.34 | Intrinsic距離→shape類似度への正規化係数 |
| `STARTEND_RADIUS` | 0.24 | 絶対空間での始点終点許容半径(Soft) |
| `ORDER_PENALTY_WEIGHT` | 0.12 | 筆順違いの最大減点(Soft) |
| `WEIGHTS.shape/coverage/offPath/startEnd/direction` | 0.40/0.28/0.14/0.10/0.08 | Composite Score重み |
| `SPATIAL_WEIGHT` | 0.10 | 空間的位置関係の重み(2画以上の場合) |
| `PASS_THRESHOLD` | 0.60 | 合否閾値 |

主要アルゴリズム:
- **Shape similarity**: Intrinsic表現(stroke毎にbbox中心を原点、
  `1/max(width,height)`で等方スケール — 平行移動・拡大縮小を吸収するが
  向き・形状差は保持)における**bidirectional(Chamfer-style)最近傍距離**
  (user→reference平均 と reference→user平均 の相加平均)。
- **Coverage**: reference sample点のうち、Intrinsic空間でuser点群から
  `SHAPE_TOLERANCE`以内にある割合。
- **Off-path**: user sample点のうち、reference点群から`SHAPE_TOLERANCE`
  を超えて離れている割合。
- **Direction**: user/referenceのstroke start→endベクトルのcos類似度の
  **絶対値**を採用(逆方向でも同等に高スコアになるようSection 17の方針を実装)。
- **Stroke Order**: assignment(reference index順列)のKendall-tau型転倒数を
  0..1へ正規化し、小さな重み(0.12)でCompositeから減点するのみ(即FAILにしない)。

## T2-A.3 Golden Test結果

`node tools/tracing-poc/golden-tests.js` で5文字(い・く・こ・あ・ま)×
20ケース前後 = 104評価を実行。**strict checks 93件、失敗0件**。

主要結果(全文字共通):

| ケース | 期待 | 結果 |
|---|---|---|
| 理想形 | PASS | ✅ 全文字PASS(score 0.86前後) |
| 軽い震え(amp 0.012/0.018) | PASS | ✅ |
| 位置ずれ(±0.03程度) | PASS | ✅ |
| 大きさ違い(0.9x/1.12x) | PASS | ✅ |
| 局所的な揺れ | PASS | ✅ |
| 極短stroke(15%) | FAIL | ✅ Hard Gate B(min length)で検知 |
| 文字から離れた位置 | FAIL | ✅ Hard Gate C(gross location)で検知 |
| 画数不足 | FAIL | ✅ Hard Gate A(stroke count)で検知 |
| 無関係な形(scribble) | FAIL | ✅ shape/coverageスコア低下で検知 |
| 密なサンプリング(200点)/まばら(10点)/不均一間隔 | PASS(score変動小) | ✅ resamplingにより吸収 |
| 手の震え風oscillation/一時停止/軽い書き戻し | PASS | ✅ |
| 逆方向(shapeは正しい) | BORDERLINE→実質PASS(score 0.75〜0.87) | ✅ direction非依存の設計通り |
| 逆筆順(shapeは正しい) | BORDERLINE→実質PASS(score 0.75〜0.86) | ✅ order soft-penaltyのみ |

**必須Regression Test(Section 25)**:
`evaluate("い", 横線2本トレース).pass === false` → **SATISFIED**
(score=0.113、明確にFAIL側)。「い」の参照形状(縦棒的な1画目+右カーブの
2画目)と横線2本は、Intrinsic空間で形状が大きく異なるため。

**注記**: 同じ「横線2本」トレースを「こ」に適用すると`score=0.647`で
**PASS**になる。これはバグではなく、「こ」の実際のreference形状自体が
「1画目:よこに はらう」「2画目:よこに はらう」という**構造的に横線2本に
近い文字**であるため、妥当な挙動。golden-tests.jsではこのケースを
「い」専用の厳格アサーションから除外し、文字ごとの実形状に即した
informational扱いとした。

## T2-A.4 Guide vs Reference discrepancy

現状: なぞりのガイド字形は`fillText()`(フォント字形)、判定基準は
KanjiVG SVGパス(reference centerline)という**別経路**(Section3参照)。

`tools/tracing-poc/visual-debugger.html` にて両者を重ね描画するdebug
visualizationを実装(ガイド字形・reference centerline・tolerance corridor・
user traceをトグル表示)。

**数値的なsanity check**(5文字全てのreference bbox、0..1正規化空間):

| 文字 | 中心 | サイズ(w×h) |
|---|---|---|
| い | (0.518, 0.511) | 0.641 × 0.477 |
| く | (0.460, 0.499) | 0.223 × 0.722 |
| こ | (0.498, 0.508) | 0.446 × 0.545 |
| あ | (0.518, 0.513) | 0.586 × 0.702 |
| ま | (0.502, 0.488) | 0.489 × 0.719 |

全文字とも中心が(0.5, 0.5)近傍(誤差0.02以内)、サイズも
`fillText`の`font-size: 0.72×canvas`が占める領域と矛盾しない範囲に収まっており、
**大きな位置ズレ・スケールズレの兆候はない**。

ただし、**これはbbox単位の粗い整合性チェックであり、フォント字形の
実際の輪郭とSVG centerlineのピクセル単位の重なりを検証したものではない**。
このセッションではブラウザでの実描画確認(Claude in Chrome)が利用できず、
`visual-debugger.html`を実ブラウザで開いての目視確認は**未実施**。
5文字とも壊滅的なズレの兆候は数値上ないため方針変更(Guide自体をSVG reference
へ統一する等)を今回提案するには至らないが、**T2-B着手前にユーザー自身が
このツールを開いて目視確認することを推奨**する(Section「Stop Conditions」
に該当する重大なズレがあれば、その時点でSTOPして再検討)。

## T2-A.5 Performance

`node tools/tracing-poc/golden-tests.js` 実測(104回の`evaluateCharacter`呼び出し):
平均 約0.77ms、最大 約5.8ms(初回JIT未warmup時は最大18ms程度)。

文字完了時(stroke数一致タイミング)に一度だけ呼び出す設計であり、
pointer移動中には評価しない(Section「Performance」要件通り)。低スペック
端末でも体感遅延が出るレベルではないと判断できるが、実端末計測は未実施。

## T2-A.6 Limitations(制約・未検証事項)

1. Guide(fillText) vs Reference(SVG)のピクセル単位の実ブラウザ確認は未実施(上記T2-A.4)。
2. `PASS_THRESHOLD=0.60`付近の境界ケース(例:「い」の縦線2本 score=0.575)は
   閾値のわずかな変更で結果が反転しうる。T2-Bでは実データ(実際の子どもの
   なぞり軌跡)による再チューニングが必須。
3. Intrinsic正規化は**回転**を吸収しない(平行移動・等方スケールのみ)。
   なぞりで文字が大きく傾いて書かれるケースは今回のGolden Testに含めておらず未検証。
4. Spatial relationship agreementは2画以上の文字にのみ適用(1画文字「く」では重み0)。
5. 46文字全体・濁音等を含む拡張時の挙動はPoC範囲外(5文字のみ検証)。
6. 実際のPointer Events API移行(mouse/touch統一)はT2-Aでは未実装(設計提案のみ、Section T1参照)。

## T2-A.7 T2-B Recommendation(初期版。実ブラウザ検証後の更新版は Revision 3 参照)

- `PASS_THRESHOLD`および各`THRESHOLDS`定数は、実際の子ども(または模擬)の
  なぞり軌跡サンプルを収集した上で再調整すべき。
- T2-Bでは、まず**hiragana-learn.htmlのみ**(katakana-app.htmlは対象外)に
  限定してpointer stroke収集・engine接続・retry feedbackを統合するローカル
  Pilotとし、Production差分を最小化する。
- `visual-debugger.html`の実ブラウザ目視確認をT2-B着手前に実施することを推奨。
- 46文字全体・濁音等への拡大はT2-Bの範囲外、以降のPhaseで検討。

---

# Revision 3 — Phase T2-A' 結果(Visual Reference Validation)

T2-Aで唯一未実施だった「実ブラウザでのGuide/Reference目視確認」を実施。
Playwright(Python版、`tools/make-mockups.py`が既に使用している既存環境。
新規browser依存追加なし)のheadless Chromiumで`visual-debugger.html`を
実際に開き、5文字×View A(Guideのみ)/View B(Referenceのみ)/View C(Overlay)を
スクリーンショット取得、コンソールエラー・ページエラー0件を確認。

## T2-A'.1 Font忠実性の修正

`visual-debugger.html`が独自の適当なフォントで代用しないよう、
production([hiragana-learn.html]の`drawGuide()`)と完全に同じ条件へ修正:

- Google Fonts `@import`(`Noto+Sans+JP:wght@400;700;900`)を追加(production同一)
- canvas サイズを 420→**320×320**(production の`traceGuide`/`traceCanvas`と同一)
- `fillStyle`アルファを 0.18→**0.12**(production と同一値)
- `document.fonts.load()`+`document.fonts.ready`で実フォント読み込み完了を待ってから
  初回描画(canvas `fillText`は既定でweb fontを待たないため、これを怠ると
  フォールバックフォントで「一致した」と誤判定するリスクがあった)
- 実行時に`font_loaded: true`(`bold 230.4px "Noto Sans JP"`)を確認、
  フォールバックフォントでの誤判定リスクを排除。

## T2-A'.2 数値検証(実際にレンダリングされたガイド字形のピクセルから算出)

各文字View Aのcanvas画素を走査し、ガイド字形インク(青みがかった色)を
抽出、reference centerlineとの関係を計測(`tools/tracing-poc/capture-visual-review.py`
の`METRICS_JS`)。

| 文字 | corridor coverage (guide ink) | center displacement | bbox IoU | **simulated guide-trace** |
|---|---|---|---|---|
| い | 0.509 | 0.083 | 0.744 | **PASS** (score 0.746) |
| く | 0.962 | 0.063 | 0.481 | **PASS** (score 0.777) |
| こ | 0.664 | 0.098 | 0.702 | **PASS** (score 0.784) |
| あ | 0.956 | 0.063 | 0.841 | **PASS** (score 0.808) |
| ま | 0.891 | 0.078 | 0.793 | **PASS** (score 0.762) |

**simulated guide-trace**は、実際にレンダリングされたガイド字形のインク画素を
最寄りreference stroke・arc-length順に再構成し、そのまま`evaluateCharacter()`へ
投入した結果(「もし子どもが見えているガイドの上をピクセル単位で完璧になぞったら
どう判定されるか」を直接シミュレート)。View B(Reference自身)のcorridor
coverageは全文字1.0で計測パイプラインの健全性を確認済み。

## T2-A'.3 文字別Verdict(Section 8基準)

- **い: CAUTION** — 5文字中もっともcorridor coverageが低く(0.509)、
  実画像目視でも「フォントglyphのhook(左画の下部カーブ)がreference
  centerlineより下側・外側に位置する」ことを確認(`guideBBox.minY=0.306`
  vs `refBBox.minY=0.272`、`guideBBox.maxY=0.838`vs`refBBox.maxY=0.752`)。
  ただし**simulated guide-trace自体はPASS**(score 0.746、閾値0.60に対し
  マージン0.146で5文字中最小)。誤FAILには至っていないが、5文字中もっとも
  余裕が小さく、ユーザー報告文字でもあるため要継続監視。
- **く: PASS** — corridor coverage最高(0.962)、目視でも高い一致。
- **こ: PASS** — corridor coverageは中程度(0.664)だが目視で良好な重なりを確認、
  simulated scoreのマージンも健全(0.184)。
- **あ: PASS** — corridor coverage高(0.956)、目視でもほぼ完全に一致。
- **ま: PASS** — corridor coverage高(0.891)、目視でも良好な一致。

**FAILは0文字。** Section 8の完了条件(FAILが1文字でもあればT2-Bへ進まない)を満たす。

## T2-A'.4 Threshold変更 / Guide統一

本Phaseでは方針通り、Visual比較のみを理由にした閾値変更は**行っていない**
(`engine.js`のTHRESHOLDSは無変更)。「い」のCAUTIONは実在する構造的な
ズレ(フォントglyphとKanjiVGパスの形状差)であり、閾値を緩めて隠すのではなく、
**長期的にはOption A(Guideを SVG referenceから描画する)への統一が望ましい**
と記録する。現時点ではsimulated guide-traceがPASSしており緊急対応は不要なため、
T2-Bをブロックする理由にはしないが、T2-B(またはそれ以降)で「い」を優先的に
実データ検証し、Option A/B/Cの再検討を推奨する。

## T2-A'.5 Debugger Smoke Test

Playwrightで実施: ページload、5文字切替、テストケース切替、View A/B/C切替、
4種チェックボックスの独立トグル、component score表示、を全て実行し、
**console error 0件・page error 0件**を確認。`golden-tests.js`も再実行し
104評価・strict checks 93件・失敗0件・「い」/「ニ」regression PASSを再確認
(engine.jsは本Phaseで無変更のため結果は完全に同一)。

## T2-A'.6 Checkpoint Commit

T2-A成果物(docs + tools/tracing-poc一式、本Phaseでの`visual-debugger.html`
忠実性修正・`capture-visual-review.py`・`review-artifacts/`を含む)を
feature branch `feature/tracing-engine-poc-t2a` へcheckpoint commit
(詳細は最終報告参照)。Production app(`hiragana-learn.html`/
`katakana-app.html`)・main は無変更。

## T2-A'.7 T2-B Recommendation(更新版)

- 「い」のCAUTIONを踏まえ、T2-Bでは実データ収集時に**「い」を最優先の検証対象**とする。
- Guide統一(Option A)は今回は見送るが、T2-B以降で実データ上「い」のPASS率が
  低い・境界ケースが多い場合は再検討する。
- それ以外の推奨事項(hiragana-learn.htmlのみ対象、46文字拡大は対象外等)は
  Revision 2から変更なし。
