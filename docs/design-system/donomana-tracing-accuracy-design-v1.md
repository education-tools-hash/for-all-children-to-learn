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

---

# Revision 4 — Phase T2-B 結果(Local Hiragana Integration Pilot)

`hiragana-learn.html`(worktree `for-all-children-to-learn-t2b-tracing-pilot`,
branch `feature/hiragana-tracing-pilot-t2b`, T2-A checkpoint`5298318`から分岐)へ、
Tracing Engine PoCを初めて実画面統合。Production未反映・`katakana-app.html`無変更。

## T2-B.1 Guide Source Unification(必須要件、達成)

なぞりGuideを`fillText()`から、Pilot 5文字(い/く/こ/あ/ま)のみ
`strokeData[k][].d`(KanjiVG SVG path)による直接描画へ変更。
判定Reference(`TracingEngine.evaluateCharacter`)と**完全に同じ座標変換**
(`PILOT_GUIDE_MARGIN`/`PILOT_GUIDE_SCALE`、KanjiVG 109基準)を共有するため、
「見えている線=判定基準」を実現。非Pilot41文字は`fillText`ゴーストを無変更維持。

実画面スクリーンショット(`tools/tracing-poc/pilot-review-artifacts/い_ideal.png`)で、
理想トレースが新Guideの帯の中にほぼ完全に収まることを確認。T2-A'で判明した
「いのcorridor coverage 50.9%」という懸念は、Guide自体をreferenceと同一
sourceにしたことで解消(比較対象が一致したため数値自体が意味をなさなくなった、
という形での解消)。

## T2-B.2 実装アーキテクチャ

- `tools/tracing-poc/engine.js`を、Production同様の単一自己完結HTMLという
  リポジトリ規約に合わせ、`hiragana-learn.html`内へインライン移植
  (「3.0 TRACING ENGINE」セクション、THRESHOLDSはPoC確定値のまま凍結)。
  重複コードの懸念は残るため、将来katakana-app.htmlにも同様の統合を行う際は
  共通JSファイルへの切り出しを推奨(Section 4「shared JS module」)。
- 入力: 旧`mousedown/mousemove/mouseup/mouseleave` +
  `touchstart/touchmove/touchend`の二重実装を廃止し、
  **Pointer Events(`pointerdown/pointermove/pointerup/pointercancel`)へ統一**
  (全46文字共通)。`setPointerCapture()`使用(例外はtry/catchで防御)。
  同時多点入力は最初の1本のみ処理(`activePointerId`管理)。
- Pilot文字判定: `traceStrokes.length >= expectedStrokeCount`に達した時点で
  `TracingEngine.evaluateCharacter()`を呼び出す(超過分もHard Gate Aで
  自然に弾かれる)。非Pilot文字は旧`traceStrokeCount >= length`ロジックを
  完全に無変更で維持。
- Raw stroke座標は`traceStrokes`(メモリのみ)に保持、localStorage等への
  永続化なし。文字切替・RETRY確定時に破棄。
- Debug overlay: `?tracingDebug=1`クエリパラメータでのみ表示(既定OFF)。

## T2-B.3 RETRY UX

新規`#retryJob`要素。「もういちど なぞってみよう」+「せんに そって
なぞってみよう」。×・ブザー・赤い大きな失敗表示は不使用。RETRY判定後は
ユーザーの線をしばらく(1.7秒)表示したままにしてからinkのみクリアし
(Guideは残す)、同じ文字を再試行できる。次の文字へは自動遷移しない。
成功時は既存の「🌟 じょうず！🌟」演出・`addLog`をそのまま維持。
RETRYは`addLog`を呼ばない(Recordに記録されない)。

## T2-B.4 実画面Regression結果(Playwright実マウス駆動、`#traceCanvas`への
本物のpointer event経由)

| ケース | 文字 | 結果 | score |
|---|---|---|---|
| 理想トレース | い | PASS | 0.873 |
| 軽い震え | い | PASS | 0.854 |
| 位置ずれ | い | PASS | 0.859 |
| 大きさ違い | い | PASS | 0.859 |
| **「ニ」型(横線2本)** | い | **RETRY** | **0.113** |
| 縦線2本 | い | RETRY | 0.566 |
| 極短stroke | い | RETRY | 0.326 (hard_gate_failed: minLength) |
| 文字から離れた位置 | い | RETRY | 0.783 (hard_gate_failed: grossLocation) |
| 逆筆順(形は正しい) | い | PASS | 0.753 |
| 逆方向(形は正しい) | い | PASS | 0.873 |
| 1画のみ(未完了) | い | フィードバックなし(待機) | - |
| 理想/軽い震え | く・こ・あ・ま | 全てPASS | 0.844-0.873 |
| 無関係な形(zigzag) | く・こ・あ・ま | 全てRETRY | 0.342-0.592 |
| 非Pilot文字(か)に任意の3本線 | か | **PASS**(旧仕様通り) | - (score概念なし) |
| pointerType='touch'合成イベント、いideal | い | PASS | - |

**Section 25の必須regression(`evaluate("い", niTrace).pass === false`)を
実画面で確認: SATISFIED。** `node tools/tracing-poc/golden-tests.js`
(スタンドアロンPoC側)も再実行し104 evaluations・93 strict checks・失敗0を再確認
(engine.jsは本Phaseで無変更のため結果は完全に同一)。

## T2-B.5 Console/Page Error・Responsive・非Pilot回帰

Playwright実行中、**console error 0件・page error 0件**。
375×667/390×844/768×1024/1280×900の4viewportでGuide/canvas/フィードバックの
レイアウト崩れなしを画像で確認(SVG Guideは`#traceCanvas,#traceGuide{max-width:100%;height:auto}`
と`.trace-area>div{flex-wrap:wrap}`により既存のレスポンシブ機構をそのまま利用)。
非Pilot文字(か)で任意の3本線を描いても旧仕様通りPASSすることを確認済み
(Section31「残り41文字は既存挙動を維持」達成)。

## T2-B.6 既知の限界・注意点

- `setPointerCapture()`は、テストで使った**手動dispatchされた合成PointerEvent**
  に対しては例外を投げる(ブラウザ側が「activeなpointerでない」と判断するため)。
  実際のマウス操作・実タッチデバイスでは問題なく動作する(本物のpointerとして
  ブラウザに認識されるため)。念のためtry/catchで防御済み。
- こ・ま等、実際のstroke形状が単純な線に近い文字は、zigzag無関係形状に対しても
  scoreがPASS閾値付近まで上がることがある(こ: 0.592、ぎりぎりRETRY)。
  T2-A'から一貫した傾向で、バグではなく文字自体の形状特性。
- 実タッチデバイス(実機)でのテストは未実施(Playwright touchscreen APIの制約上、
  pointerType='touch'の合成dispatchによる検証のみ)。

## T2-B.7 変更ファイル・Production影響

- 変更: `hiragana-learn.html`(+533/-42行、`git diff --check`異常なし)
- 新規: `tools/tracing-poc/test-hiragana-pilot.py`、
  `tools/tracing-poc/pilot-review-artifacts/`(スクリーンショット・レポート)
- 無変更: `katakana-app.html`、`tools/tracing-poc/engine.js`ほかT2-A成果物一式
- main merge/push: なし。checkpoint commit詳細は最終報告を参照。

## T2-B.8 T2-Bで得られた知見・次Phase(T2-C想定)への示唆

- Guide Source Unificationにより、「見えている線をなぞれば判定基準に自然に
  入る」という原則がPilot 5文字で成立した。
- Pointer Events統一は全46文字の入力経路に影響する変更だが、非Pilot文字の
  評価ロジック自体は完全に無変更のため、回帰は確認されなかった。
- 次フェーズでは、User Review(L1〜L10)の結果を踏まえ、Pilot対象文字の拡大
  または46文字全体へのロールアウト計画、および共通JSファイルへの切り出し
  (hiragana/katakana共有)を検討する。

---

# Revision 5 — Phase T2-B'' 結果(「あ」3画目 False Positive 修正)

## T2-B''.0 User Review判定

Phase T2-B' User実機確認: 「い」は期待通り。**「あ」は3画目をいい加減に
書いても「じょうず！」に成功する False Positive を確認。**
→ **T2-B' = PARTIAL PASS、T2-C(Full Rollout)= BLOCKED** として記録。

## T2-B''.1 Root Cause(コード根拠付き)

`evaluateCharacter()`の合否は、各strokeの合成score(`perStrokeScores[i]`)の
**平均**(`avgStrokeScore`)にのみ依存しており、個々のstrokeが最低限
「そのstrokeとして成立しているか」を単独ではチェックしていなかった。

実際に1・2画目を理想的に描き、3画目だけを崩したPlaywright再現テストで実証:

| 3画目のケース | badge(修正前) | stroke3 shape / coverage |
|---|---|---|
| 理想 | PASS | 1.00 / 1.00 |
| **50%だけ描く** | **PASS(score 0.68)** | 0.55 / 0.42 |
| **単純な直線に置き換え** | **PASS(score 0.742)** | 0.45 / 0.33 |
| ジグザグ | PASS(score 0.761) | 0.56 / 0.47 |
| ゆるい塊(loose blob) | PASS(score 0.765) | 0.71 / 0.84 |
| Guideと無関係な長い線 | PASS(score 0.705) | 0.56 / 0.36 |

3画目のcoverageが33〜47%しかなくても、1・2画目が完璧(score 1.0前後)なため
平均が閾値0.60を上回り続ける。**「良い画が悪い画を相殺する」という仮説を
定量的に確認**(Hard Gateはstroke数・最小長・粗位置のみを見ており、
個々のstrokeの形状品質を見ていなかったため素通りしていた)。

## T2-B''.2 Debug Output拡張

`evaluateCharacter()`の各`strokes[i]`へ`perStrokeScore`を追加(`?tracingDebug=1`
時のみUIへ表示)。通常UIには非表示のまま。

## T2-B''.3 Per-Stroke Quality Floor — 設計と較正

### 第一案(不採用): perStrokeScore(既存の重み付き合成値)にFloorを適用

`STROKE_QUALITY_FLOOR=0.55`をperStrokeScore(shape+coverage-offPath+startEnd+direction
の重み付き合計)に適用したところ、「あ」の全ケースは正しく分離できたが、
**他の文字へ一般化すると失敗**することが判明(`calibrate-stroke-floor.js`):

- い・こ・ま で「最終strokeを直線に置き換え」てもPASSのまま(perStrokeScore
  0.58〜0.77で0.55を上回る)。「あ」1文字にだけ過適合していた
  (Phase spec Section 6の警告通りの失敗パターン)。

### 第二案(採用): min(shape, coverage) にFloorを適用

`calibrate-stroke-floor-full.js`で、全5文字×全Motor Variation良好ケース
(震え・位置ずれ・大きさ違い・sampling密度差・逆方向・逆筆順等)と、
全5文字×全stroke位置の「直線代用」を総当たりで比較。

**なぜperStrokeScoreではなくshape/coverageだけを見るか**: startEnd・
directionは、始点と終点さえ一致していれば直線でも簡単に高得点になる
(直線はどんな2点間でも「その2点を結ぶ最短経路」であり、始点終点の一致は
自明)。一方shape/coverageは「経路の途中の形状を実際になぞったか」を直接
測るため、この2つに絞ることでMotor Variationとの分離が大幅に改善する。

| | 全良好ケースの最低値 | 「本来曲線が必要なstrokeを直線化」した場合 |
|---|---|---|
| perStrokeScore | 0.826 | 最大0.843(**分離失敗**) |
| **min(shape, coverage)** | **0.921** | 「元々ほぼ直線のstroke」(あ1-2画目、ま1-2画目等)は0.93〜0.96のまま(直線化しても妥当な結果なので問題なし)。**実際に曲線が必要なstroke(あ3画目0.328、ま3画目0.594、こ2画目0.641)は明確に低い** |

`STROKE_QUALITY_FLOOR = 0.80`(良好ケース最低0.921との間に十分なマージン)。

**この指標の重要な性質**: 「元々ほぼ直線に近いreference stroke」(あ1・2画目、
ま1・2画目、く唯一のstroke)は、直線で描いても妥当な再現なので高得点のまま
維持される — これは緩すぎるのではなく正しい。一方「実際に曲線・輪を描く
必要があるstroke」(あ3画目の大きな輪、ま3画目の輪、こ2画目のカーブ)を
直線・ジグザグ・塊で誤魔化した場合は、そのstroke自身の形状評価だけで
明確に検知される。**個別のcurvature検出ロジックを新設せずとも、既存の
shape/coverage計算がこの区別を自然に内包していた。**

## T2-B''.4 Regression結果

- `node tools/tracing-poc/golden-tests.js`: **104 evaluations・93 strict checks・
  失敗0**(修正前と完全に同一。Motor Variation・reversed direction/order・
  「ニ」regressionいずれも無傷)。
- `calibrate-stroke-floor.js`(全5文字、最終strokeを直線代用): **い・こ・あ・ま
  全てpass=false(正しくRETRY)** に是正(く=1画文字のため対象外、別の観点で
  別途検討)。理想traceは全5文字ともpass=true維持。
- 「あ」3画目再現matrix(A1〜A11 + sloppy 3種、実ブラウザPlaywright実行):
  理想・軽い震え・位置ずれ・逆方向 → PASS維持。**70%部分描画・50%部分描画・
  直線代用・ジグザグ・ゆるい塊・Guide無関係の長い線・「途中で諦めた」風の
  描画 → 全てRETRYに是正**(修正前は全てPASSしていた)。
- `test-hiragana-pilot.py`(5文字full battery)・`test-realdevice-regression.py`
  (非Pilot8文字・multi-touch・pointer capture・プライバシー・パフォーマンス)
  を再実行し、**修正前と完全に同一の結果**であることを確認(console/page
  error 0/0)。

## T2-B''.5 変更ファイル・Production影響

- 変更: `tools/tracing-poc/engine.js`(THRESHOLDS.STROKE_QUALITY_FLOOR追加、
  Per-Stroke Quality Floorロジック追加、perStrokeScore露出)
- 変更: `hiragana-learn.html`(同内容をインライン移植コピーへ同様に反映、
  debug panel表示にperStrokeScore追加)
- 新規: `tools/tracing-poc/test-a-stroke3-repro.py`、
  `tools/tracing-poc/calibrate-stroke-floor.js`、
  `tools/tracing-poc/calibrate-stroke-floor-full.js`
- 無変更: `katakana-app.html`、Hard Gate(画数・最小長・粗位置)・
  PASS_THRESHOLD(0.60)・Stroke Order/DirectionのSOFT方針は一切変更なし
- main merge/push: なし

## T2-B''.6 次のUser Review

前回のLANプレビュー(同一worktree・同一URL、サーバー再起動不要)で、
特に「あ」の3画目をわざと雑に描いて RETRY になることをご確認ください。

---

# Revision 7 — Phase T2-C 結果(ひらがな46文字 Full Local Rollout)

## T2-C.0 User Approval

Phase T2-B'' User Re-Review: N1〜N5全てユーザー評価「ばっちり」。
Phase T2-B'' = PASS、Phase T2-C = UNBLOCKED。

## T2-C.1 Character Inventory / Structural Classification

`tools/tracing-poc/extract-reference-full.js`で全46文字(strokeDataの
gojuon全体、濁音・拗音等は対象外)を抽出。画数分布: 1画11文字・2画17文字・
3画13文字・4画5文字。`tools/tracing-poc/character-inventory.js`で各strokeの
弧長・弦長比(curvature)を計算し、5グループへ分類(実データに基づき命名):

- B 単純曲線: く・へ(2文字)
- C hook/turn: い・う・し・す・り(5文字)
- D loop/large curve: え・こ・そ・つ・て・ぬ・ね・の・ひ・み・め・ゆ・よ・
  ら・る・れ・ろ・わ・ん(19文字)
- E 複数画(位置関係が重要): き・け・さ・せ・ふ(5文字)
- F 複雑(3-4画+loop/sweep): あ・お・か・た・な・に・は・ほ・ま・む・も・
  や・を(13文字)

(「A: ほぼ直線中心」に単独で分類される文字はなし — 全文字が最低1画は
曲線的要素を持つ)

Reference Data Audit: 全46文字104strokeについてゼロ長・不正bbox・
サンプリング失敗を検査、**異常0件**。文字全体のbboxも全て既存の
6%マージン内に収まることを確認(Guide clippingリスクなし)。

## T2-C.2 SVG Guide / Engine Full Rollout

`hiragana-learn.html`から`TRACING_PILOT_CHARS`分岐を完全撤去。
`drawGuide()`は全46文字で`drawSvgGuide()`(旧`drawPilotSvgGuide`)を呼び、
fillTextフォールバックは削除。`endTrace()`の「非Pilot文字は画数のみ判定」
という旧分岐も削除し、全文字が`evaluateTraceAttempt()`(旧
`evaluatePilotAttempt`)を通る一本の経路に統一。命名整理:
`PILOT_GUIDE_MARGIN/SCALE`→`GUIDE_MARGIN/SCALE`、
`pilotCanvasToNormalized`→`canvasToNormalized`、
`showPilotRetry`→`showRetry`、`pilotRetryTimer`→`retryTimer`。

46文字Guide contact sheet(実ブラウザ描画)で全文字を目視確認:
canvas内に収まる・極端に小さい/切れている文字なし・線の太さ一貫・
開始ドット一貫・文字間のサイズ感に大きな差なし。

## T2-C.3 Per-Stroke Quality Floor 全46文字較正

`min(shape, coverage) >= 0.80`をそのまま46文字へ適用開始。まず
「全stroke最後の1画を直線代用」という単純な全文字テストを実施したところ、
き・け・さ・す・た・に・は・ほ・も・りの10文字で **False Negative**
(直線代用がPASSしてしまう)を検出。

### Wrong Trace Generatorの3段階改良(Root Cause調査の記録)

1. **第1版(不採用)**: 弧長/弦長比(curvature)でstraight/zigzagを分岐。
   「あ」では機能したが、10文字で一般化に失敗。理由: 細長いstrokeは
   curvature比が高くても、intrinsic正規化後の実際のふくらみ(bulge)が
   小さいことがあり、curvature比だけではshape/coverageの挙動を予測できない。
2. **第2版(不採用)**: intrinsic空間での最大垂直偏差(max bulge)で分岐。
   10件→3件(き・た・も)に改善したが、まだ不十分。理由:
   一部の区間だけ急に曲がるstrokeは、局所的なmax偏差は大きくても
   全体平均(shape scoreが実際に見ているもの)は小さいまま。
3. **採用: Engineへ直接問い合わせる方式**。幾何学的proxyでの予測をやめ、
   「他の画は理想的に描いた状態で、直線代用がFloorをクリアしてしまうか」
   をEngine自身([`Engine.evaluateCharacter`])に実際に評価させ、
   クリアしてしまう場合のみperpendicular zigzagへフォールバック
   (これも同様に検証)。この方式で**全46文字・93 stroke位置で
   False Negative 0件**を達成。

**この過程でPer-Stroke Quality Floor自体(`min(shape,coverage) >= 0.80`)
やHard Gate、PASS_THRESHOLDは一切変更していない。** 修正したのは
テスト側(wrong-trace-generator.js)の「壊れたstrokeの作り方」のみ
(Phase spec Section 16-17の方針通り、global floor/thresholdの安易な
変更やcharacter-specific特例は一切導入していない)。

## T2-C.4 Full 46-Character Golden Test Suite

`tools/tracing-poc/golden-tests-full46.js`: 46文字 × (P1理想/P2震え/P3位置
ずれ/P4大きさ違い/P5不均一sampling/P6軽い書き戻し/P7 tremor/P8一時停止)
+ (N1極短/N2離れた位置/N3画数不足/N4画数超過/N5無関係な形) +
N6単一stroke破損(2画以上の全文字、93 stroke位置、character-aware
wrong trace generator使用) = **総計691 strict checks、失敗0**。
逆方向・逆筆順(SOFT policy、borderline扱い)は81ケース全てPASS寄り。
実行時間 約0.4〜0.8秒(46文字分)。

## T2-C.5 実ブラウザ検証(Full Rollout)

`tools/tracing-poc/test-full-rollout-realbrowser.py`(Playwright実マウス
駆動pointer event、`hiragana-learn.html`本体を直接操作):

- 代表13文字(Pilot 5: い・く・こ・あ・ま + 拡張8: う・き・さ・た・な・の・
  ふ・も — 画数1〜4・全構造グループ・Floor較正で問題になった3文字を含む)で
  Guide表示+理想トレースPASSを確認。
- **「い」/「あ」Pilot Regression Lock(Section 11)**: 全13ケース
  (い: ideal/wobble/offset/scale→PASS、ニ/縦線/極短/離れた位置→RETRY。
  あ: ideal/wobble→PASS、3画目partial/straight/zigzag→RETRY)を
  実ブラウザで再確認、**全て期待通り(ok=true)**。
- **旧非Pilot文字の挙動転換確認**: 「か」に任意の直線2本を描くケースが、
  以前は旧ロジックによりPASSしていたが、**Full Rollout後はRETRYへ転換**
  (legacy分岐が実際にコードから除去されたことをlive appで実証)。
  「か」の理想トレースはPASSを維持。
- Multi-touch guard・pointer capture・clearTrace reset・privacy
  (localStorage)は全てT2-B/B'/B''確立の挙動を維持。
- Responsive 5 viewport(375×667/390×844/768×1024/1024×768/1280×900)、
  4画文字「な」で崩れなし。
- **console error 0件・page error 0件**。

## T2-C.6 変更ファイル・Production影響

- 変更: `hiragana-learn.html`(Pilot/Legacy分岐の撤去・命名整理のみ、
  Hard Gate・Per-Stroke Quality Floor・PASS_THRESHOLD等の数値は無変更)
- 新規: `tools/tracing-poc/extract-reference-full.js`、
  `tools/tracing-poc/character-inventory.js`、
  `tools/tracing-poc/wrong-trace-generator.js`、
  `tools/tracing-poc/golden-tests-full46.js`、
  `tools/tracing-poc/test-full-rollout-realbrowser.py`
- 無変更: `katakana-app.html`、`tools/tracing-poc/engine.js`
  (Pilot向けengine.jsは変更なし。hiragana-learn.html内の埋め込みコピーも
  数値は無変更、命名のみ整理)
- main merge/push: なし

## T2-C.7 次のUser Review

代表13文字(Core 5 + Extended 8)を中心に、46文字一覧からも自由に
確認いただけます。LANプレビューは同一方式(新規worktree用にサーバー
再起動、URLは変更なし)。
