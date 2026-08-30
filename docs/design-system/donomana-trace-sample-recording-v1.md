# どのまな Trace Sample Recording 設計書（Version 1.0 Draft / Pilot RC）

- 版: v1.0 Draft（Phase T5-E-A'''）
- 位置づけ: `donomana-learning-record-standard-v1_0.md`（Core Schema・Storage）を土台に、trace（なぞり）recordのApp-specific payloadへ **optionalなtrace sample拡張**を追加するPilot設計書。Core Schema自体は変更しない。
- 対象: `hiragana-learn.html`・`katakana-app.html`のみ（Pilot、他アプリへの横展開は本Phase対象外）
- 承認状態: Draft / Pilot RC。User Browser Review待ち。Production Releaseは行っていない。

---

## 0. 背景・目的

教員・支援者から、「そのとき子どもが実際にどのような字を書いたのか」を後から見返したいという教育的要望があった。既存Learning Recordは「いつ・何の文字に・成功したか・判定レベル」は記録できるが、実際の書字そのものは記録していない。

`nazori-app.html`には「ガイド＋描画canvasを画像として保存しRecord Viewerで確認する」実装実績があるが、PNG/base64を毎回localStorageへ保存する方式であり、hiragana/katakanaのように継続的に多数のrecordが蓄積するアプリへそのままコピーすると容量面のリスクが大きい（§1参照）。本Pilotは、画像ではなく軽量な正規化座標データとして「実際に書いたstroke」を記録し、Viewer側でcanvas再描画する方式を採用する。

---

## 1. Storage方式比較（実測により正式採用）

| 方式 | 内容 | 判定 |
|---|---|---|
| A. PNG/base64 screenshot | canvasをそのまま画像化して保存（nazori-app方式） | 不採用。1件あたり数KB〜数十KB相当になりやすく、hiragana/katakanaのような高頻度record蓄積アプリでは容量増大・再描画不可（拡大するとぼける）・お手本重ね描き不可という制約がある |
| B. raw pointer coordinate全保存 | pointermoveで取得した全点をそのまま保存 | 不採用。1画あたり数十〜百点規模になり得て容量面で非効率。resamplingで十分な視覚的忠実度が得られることを§4で実測確認済み |
| **C. resampled + normalized + quantized stroke data** | 弧長ベースでresampling→0〜1000正規化整数へ量子化 | **採用**。PNGより軽量、拡大再描画可能、お手本overlay可能、stroke順序保持、将来のanimation replayにも発展可能、外部画像fileも不要 |

---

## 2. 座標空間の設計（最重要の設計判断）

`hiragana-learn.html`・`katakana-app.html`の既存なぞりフロー（§3参照）では、pointer入力(canvas px) → `canvasToNormalized(px, py)` により **0..1（KanjiVG 109基準）の正規化空間** へ変換されてから`TracingEngine.evaluateCharacter()`へ渡される。この`canvasToNormalized()`はstrokeごとの独立正規化ではなく、文字全体に対して単一のaffine変換（`GUIDE_MARGIN`/`GUIDE_SCALE`固定）を適用する **絶対位置を保持する正規化** である。

一方、Guide（お手本）の描画（`drawSvgGuide()`）も`TracingEngine.sampleReferencePath(stroke.d, 48)`が返す **同じ0..1(KanjiVG 109基準)空間** の点を使っている。

**この2つが同じ座標空間を共有している**ため、`evaluateCharacter()`直前の`normalizedStrokes`（intrinsic正規化前、絶対位置保持）をそのままtraceSampleの元データとして採用すれば、

- 教師が「右へずれている」「全体が小さい」等を確認できる絶対位置情報を保持できる（§21の要件）
- Viewerでのお手本重ね描みは、`TracingEngine.sampleReferencePath()`を再度呼ぶだけで、位置・scaleの手動補正が一切不要になる（§20の要件）

という2つの要件を同時に満たせる。**判定Engine内部でさらに行われるstroke単位のintrinsic正規化（形状比較用）は使わない**——それを使うと絶対位置情報が失われ、上記の目的を果たせなくなるため。

---

## 3. Current Trace Data Flow（実装確認）

`hiragana-learn.html`・`katakana-app.html`とも同一のflow（変数名まで一致）:

1. `pointerdown` → `activePointerId`を記録、`currentStrokePoints = [p]`（`p`はcanvas px座標、`getPos(e)`）
2. `pointermove` → `currentStrokePoints`へ点を追加、同時に見た目のink線を描画
3. `pointerup`/`pointercancel` → `endTrace()`: `traceStrokes.push(currentStrokePoints)`（1画=1配列、canvas px）、`currentStrokePoints = []`、`evaluateTraceAttempt(currentTraceKana)`を呼ぶ
4. `evaluateTraceAttempt(k)`: `traceStrokes.length < expected`（期待画数未満）ならreturn、達したら`normalizedStrokes = traceStrokes.map(stroke => stroke.map(p => canvasToNormalized(p.x, p.y)))`を計算
5. `TracingEngine.evaluateCharacter(normalizedStrokes, strokeData[k], {..., judgmentProfile})` → `result`
6. `result.pass`が true の場合: 成功演出 → **`traceStrokeCount = 0; traceStrokes = [];`（ここでリセット）** → `addLog('trace', {kana, tracingJudgmentLevel})`
7. `result.pass`が false の場合: `showRetry()`（1700ms後にink/traceStrokesをクリア、Guideは残す）

**重要**: `traceStrokes`は`addLog()`呼び出し**前**にリセットされる。そのため、traceSampleは`normalizedStrokes`（手順4で計算済み、リセットされない独立したローカル変数）から手順6のリセット行の直前で構築する。Tracing判定そのもの（`evaluateCharacter`・`THRESHOLDS`・Hard Safety・Beginner Coarse Pass等）には一切触れていない——判定結果(`result.pass`)を読むだけ。

---

## 4. Resampling — 実測比較（16 / 24 / 32点）

生のpointer点をそのまま保存せず、弧長（arc-length）ベースの等間隔resamplingを行う。点数の妥当性を、`golden-traces.js`の`ideal`/`mildWobble`/`withTremor`（低速手ぶれ相当）を使い、以下の代表文字で実測比較した。

- ひらがな1画(へ)・曲線(あ・い)・3〜4画(き)・直線寄り(し)
- カタカナ1画(ノ)・多画(ア・ミ・ホ)

再構成誤差（resampleした折れ線と、元の密な点列との最大乖離）を0〜1000正規化単位で計測:

| 点数 | ideal(理想trace)時のworst-case誤差 | mildWobble/tremor時のworst-case誤差 |
|---|---|---|
| 16 | 最大22.5単位（あ、曲線strokeで目に見える角張りが出る） | 25〜36単位 |
| **24** | **最大14.8単位（大半は5〜11単位）** | **17〜30単位（wobble自体のノイズを吸収するため、この程度の差は許容範囲）** |
| 32 | 最大9.1単位（24点比で改善は小さい） | 14〜27単位（24点比でわずかな改善） |

**24点/strokeを採用した。** 16点では曲線ストローク（あ・い等）で目に見える角張りが生じる一方、32点は24点と比べて誤差改善が小さく、容量だけが増える（後述§6のサイズ実測でも24点で目標を十分満たす）。wobble/tremor系での誤差は「resamplingが手ぶれノイズそのものを吸収している」結果であり、文字の大まかな形状特徴は失われていない（§9で改めて確認）。

---

## 5. Trace Sample Schema

```js
traceSample: {
  version: 1,
  coordinateSpace: "normalized-1000",
  strokes: [
    [x0, y0, x1, y1, ...], // 1画 = flatな整数配列(24点 = 48要素)、§2の座標空間を0..1000へ量子化
    ...
  ]
}
```

- `version`: schema変更時にインクリメントする（現在1のみ）
- `coordinateSpace`: `"normalized-1000"`固定。将来別の正規化方式を追加する場合の判別用
- `strokes`: stroke順序・point順序を保持したflat配列。オブジェクト配列（`{x,y}`）ではなくflat配列を採用し、JSON容量をキー名の繰り返しコストなく最小化した
- 既存Learning Record Core Schema（`donomana-learning-record-standard-v1_0.md`）は無変更。`traceSample`はtrace recordのApp-specific payload内のoptional fieldとして追加する

## 6. Quantization / Normalization

- `canvasToNormalized()`が返す値（理論上0..1、canvas外にはみ出した入力は範囲外になりうる）を`Math.max(0, Math.min(1, v))`でclampしてから`Math.round(v * 1000)`。
- 0〜1000の整数のみ。小数を持たない（JSON容量削減、float文字列膨張回避）。
- clampにより、下書きから大きくはみ出した入力も「canvas端」として安全に保存される（値が壊れることはない）。

## 7. Trace Sample Size Gate（実測）

24点/stroke・0〜1000整数flat配列で実測（ランダム値による近似、実際の座標も同じ桁数分布になるため妥当な見積り）:

| 文字 | stroke数 | sample bytes(JSON) |
|---|---|---|
| し (hiragana) | 1 | 255 |
| い (hiragana) | 2 | 435 |
| あ (hiragana) | 3 | 629 |
| き (hiragana) | 4 | 810 |
| ノ (katakana) | 1 | 248 |
| ア (katakana) | 2 | 437 |
| ミ (katakana) | 3 | 634 |
| ホ (katakana) | 4 | 813 |

- 平均sample bytes: 約533 bytes
- worst-case(4画文字) full record bytes（time/type/data/schemaVersion込み）: 約1005 bytes
- **100 records: 平均約71KB、worst-case約98KB**
- **500 records: 平均約354KB、worst-case約491KB**
- **1000 records: 平均約708KB、worst-case約981KB**

目標（traceSample追加分 概ね2KB/record以下、1000recordで概ね2MB以下）を大幅に下回った。追加のquantization（例: 0〜255への削減）は不要と判断し、要件どおり0〜1000を採用した。

---

## 8. Successful Attempt Only — MVP方針

PASSした最終strokeのみ保存する。RETRYになった試行のsample保存は行わない。理由:

- storage増大防止（RETRYは複数回発生しうるため）
- Viewer複雑化防止（「どの試行を表示するか」という追加UIが不要になる）
- 失敗sample大量蓄積の防止
- Pilot scopeの制御

「途中のなぞりも保存する」設定は将来候補として§14 Future Candidateへ記録し、本Phaseでは実装しない。

## 9. PASS / RETRY Integration

- PASS: `result.pass === true`の分岐内、`traceStrokes`リセット前に`buildTraceSample(normalizedStrokes)`を呼び、`addLog('trace', {kana, tracingJudgmentLevel, traceSample})`へ渡す。parallel loggerは追加していない（1成功=1record、既存`addLog`呼び出し1箇所のまま）。
- RETRY: `showRetry()`は無変更。traceSample recordは作られない。既存のフィードバック文言（「もういちど なぞってみよう」）も無変更。

easy/standard/preciseいずれのLevelでPASSしても同じ経路でtraceSampleを保存する。Beginner Coarse Pass（`acceptancePath: "beginner_coarse"`）経由のPASSも同様（`result.pass`が真になった時点で分岐は共通のため、easy専用の特別扱いは不要）。`acceptancePath`等の内部debug情報はrecordへ追加していない（既存方針どおり）。

---

## 10. Legacy Record Compatibility（絶対条件）

- 既存record（`traceSample`フィールドが存在しない）は、Viewerで従来どおり表示される。過去recordへのmigrationは行わない。空のsampleを後付けもしない。
- `isValidTraceSample(sample)`が偽を返すrecord（フィールド欠落・malformed）では、「書いた字を見る」ボタン自体を表示しない。record本体（日時・種類・もじ・判定レベル等）の表示は妨げない。

## 11. Malformed Sample Handling（実装・検証済み）

`isValidTraceSample()`は以下をすべて拒否する: `version`不一致、`coordinateSpace`不一致、`strokes`が配列でない/空、各strokeが偶数長でない、各値が`number`でない・`isFinite`でない・0〜1000範囲外。実ブラウザで、文字列値・負の極端値・オーバーサイズ値・stroke欠落・空strokes配列・未知version・奇数長strokeの計7パターンをlocalStorageへ直接注入し、いずれも「書いた字を見る」ボタンが表示されず、record一覧自体は正常表示・console/page error 0であることを確認した（NaN/Infinityは仕様上JSONへ直列化できないため到達不能だが、`isValidTraceSample()`はJSでの直接呼び出しでも正しく拒否することを別途確認済み）。`traceSample`の座標データをinnerHTMLへ直接文字列展開することはしていない（record indexのみをdata属性へ埋め込み、実際の描画は`canvas` APIへ数値として渡す）。

---

## 12. Viewer UX

### 12.1 一覧表示（Thumbnail方式の決定）

比較した方式:

| 方式 | 判定 |
|---|---|
| A. 全recordへ常時SVG thumbnail | 不採用。record件数が多い場合、常時描画がperformance負担になりうる |
| B. Canvas thumbnail(常時) | 不採用。同上 |
| **C. 「書いた字を見る」buttonを押したときだけrender** | **採用**。既存Viewer（record一覧）のDOM構造・paginationを変更せず、renderコストは実際に開いたrecordだけに限定される |
| D. visible recordのみlazy render | 不採用（Pilot段階では過剰。Cで1000件規模でも問題ないことを§16で実測確認） |

一覧の各trace record行には、`traceSample`が有効な場合のみ小さな「✏️ みる」ボタンを追加する（アプリごとの既存detail-log構築ループへの最小追記、newタブ切替・新規Viewer全体の再設計はしていない）。

### 12.2 拡大表示（Expanded View）

既存Help panel（`donomana-help-usage-guide-standard-v1_0.md`のReference Implementation由来）と同じ「非modal・固定position・Escape/close button/focus return」パターンを再利用した専用overlay（`#traceSampleViewer`）。新しいmodal基盤は作っていない。表示内容: 対象文字・日時・判定レベル・canvas描画・「お手本を重ねる」トグル・とじるボタン。

---

## 13. Guide Overlay

- default: **OFF**（採用）。ONにすると`strokeData[kana]`から`TracingEngine.sampleReferencePath(stroke.d, 48)`でGuide点を都度再生成し、traceSampleと同じ0..1(KanjiVG 109基準)空間のまま重ね描きする。
- guide自体はrecordへ保存しない（§2の設計により、kanaさえあればいつでも同一空間で再生成できるため、保存の必要がない）。
- 位置・scaleの自動補正は一切行っていない。§2の座標空間設計により、traceSampleとGuideは最初から同じ空間を共有しているため、補正コード自体が不要（存在しない）。

---

## 14. CSV Boundary（絶対条件）

`downloadCSV()`は既存どおり、`entry.data`から個々のfield（kana・tracingJudgmentLevelから導出した判定表示等）を明示的に選んでrowを構築しており、`traceSample`を一切参照していない。CSVへ座標配列やbase64が出力されることはない。T5-E-A'で確立した日付`YYYY.MM.DD`・時刻`HH:mm:ss`・BOM形式は無変更のまま維持している。

---

## 15. Privacy

`traceSample`は既存Learning Record Foundation（`donomanaRecordReadLog`/`WriteLog`、localStorage）にrecordの一部としてそのまま格納され、以下は本Pilotでも一切追加していない: GA送信・fetch/XHR送信・外部endpoint・cloud同期。端末内保存のみ。Helpの「記録」sectionへ、「なぞりで書いた字は、成功したときの記録と一緒に保存されます。記録画面から、実際に書いた字を後から見返すことができます。お手本を重ねて確認することもできます。書いた字の記録はこの端末のブラウザ内に保存されます。」を追記した（`localStorage`・`JSON`・`base64`等の技術語は使っていない）。

---

## 16. Shared vs App-local Helper Decision

| 選択肢 | 内容 | 判定 |
|---|---|---|
| A. hiragana/katakanaへ同じhelperを個別実装 | 各アプリのscript内へ直接記述 | **採用** |
| B. Learning Record UI Foundationへgeneric trace-sample helperを追加 | `generate.js`の共通注入blockへ追加 | 不採用（本Phaseでは） |
| C. 専用Trace Sample Foundationを作る | 新規共通基盤 | 不採用 |

Tracing Engine自体（`evaluateCharacter`等）がhiragana/katakanaそれぞれのファイルへ個別実装される既存パターン（T2/T3以来の運用）を踏襲し、Pilot段階では最小・安全・保守しやすいAを採用した。将来、書字系アプリ（漢字学習等）へ展開する可能性はあるが、「いつか使うかもしれない」だけで`generate.js`の共通Foundation（29+アプリへ影響しうる）を今つくることはしない。展開が具体化した時点で、`buildTraceSample`/`isValidTraceSample`/`traceSampleResample`等の純粋関数（DOM非依存）をFoundationへ引き上げる判断は容易（実装がほぼそのまま移植できる形になっている）。

---

## 17. Tracing Engine Isolation（重要、再確認）

T2/T3/T5-B'''で承認したMetrics Engine・Thresholds・Hard Safety Guard・Beginner Coarse Pass・Multi-Hypothesis Assignment・Self-Reflection Discrimination・Monotonic Safety Guardは、本Phaseで1行も変更していない。`git diff`で`evaluateCharacter`・`THRESHOLDS`・`TRACING_JUDGMENT_PROFILES`関連の差分がゼロであることを確認済み。Trace Sample保存は`result.pass`という既存の判定結果を読み取るだけで、判定計算そのものには一切関与しない。

---

## 18. Future Candidate（本Phaseでは未実装）

- 書字の時系列比較（同じ文字を並べて変化を見る）
- 同じ文字の横並び比較
- stroke animation replay（point順序・stroke順序は既にdata構造上保持済みのため、将来対応しやすい設計）
- PNG export（「書いた字を画像として保存」ボタン）
- 学期ごとの変化表示
- learner profileとの紐付け
- 数字・漢字等、他の書字アプリへの展開（§16のFoundation引き上げ判断とセット）
- RETRY試行もSettingsで選択的に保存する機能

---

## 19. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 Draft | 2026-08-30 | Phase T5-E-A'''。hiragana-learn/katakana-appへTrace Sample Recording Pilotを実装。resampling24点/stroke・0〜1000正規化量子化を実測に基づき採用。Guide overlayとtraceSampleが同一座標空間を共有する設計により位置・scale補正コード自体を不要化。Successful-attempt-only MVP。Tracing Engineへの変更ゼロ、公式Golden Test全件PASS。User Browser Review待ち |
