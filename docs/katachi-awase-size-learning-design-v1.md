# かたちをあわせよう × おおきさ学習 設計案 v1.1（Phase26-I〜I2）

- 版: v1.1（v1.0の設計をユーザー承認、Phase26-I2で基盤実装。実際の「おおきさ」問題はまだ未実装）
- 起草: Phase26-I（設計）／Phase26-I2（concept row・複合shape ID基盤の実装）
- 位置づけ: `katachi-awase-app.html`への実装はPhase26-I2で開始したが、**「おおきさ」conceptはProduction上ではまだ非表示（`#conceptRow[hidden]`）**。ユーザーから見える新機能はまだ公開されていない。
- Release: Phase26-I2は既存「かたち」学習の動作・見た目を一切変えない内部基盤変更であり、Continuous Release対象として扱った（30章参照）。「おおきさ」concept自体の公開は引き続きRelease Approval Gate対象。

---

## 0. Phase26-I2 追記（ユーザー承認事項の反映）

Phase26-Iの設計案について、以下がユーザー承認事項として確定した。

- **Level構成**: 4章の「案4（concept分離型）」を採用。kurabeyou-appの`.concept-btn`パターンを踏襲し、「かたち」/「おおきさ」のconcept行を新設。
- **大/中/小**: 3章「案A」を採用。まず**大/小の2値のみ**を実装対象とする。「中」はPhase26では実装しない（実授業結果を見て将来判断）。
- **色**: 9章「案B」寄りの方針。おおきさ学習中は判断前の図形色を原則統一し、大きさと色を対応させない。具体色の最終実装はPhase26-I3で決定する。
- **Feedback**: 10章の基本案どおり、現行「ぴったり！」を維持。概念強化発話などの過剰な追加は行わない。
- **アプリ間導線**: 15章の提案は現時点で実装しない。

### Phase26-I2で判明した新規の知見（I3への申し送り）

concept-row（44px、`.level-row`と同型）を試験的に表示した場合の375×667への影響を実測したところ、**現状の`.level-row`等の余白のまま単純に1行追加すると、縦スクロールが発生する**ことが判明した（Phase26-Hで確保した375×667の無余白状態が壊れる）。「おおきさ」conceptを実際に公開するPhase（Phase26-I3以降）では、以下のいずれか（または組み合わせ）で375×667の無スクロールを再度成立させる必要がある。

- concept行と既存level-row間などの余白（`margin`）を詰める
- concept行自体をよりコンパクトな高さにする
- （最終手段として）Phase26-Hで拡大したshape/targetサイズを見直す — ただしPhase26-Hの成果を壊すため優先度は最も低い

本項目はPhase26-I2のClose条件には影響しない（「おおきさ」concept自体がまだProduction非表示のため）が、Phase26-I3着手時に必ず再検証すること。

---

## 1. 目的

`katachi-awase-app.html`（かたちをあわせよう）の「形を合わせる」学習に、**大・小（将来的に中を含む）** という大きさの概念を追加し、`kurabeyou-app.html`（おおきい？ちいさい？くらべよう）と学習内容がつながる設計を行う。単に大中小のUIを足すのではなく、2アプリの学習概念の役割分担を明確にすることを目的とする。

---

## 2. 現行2アプリの整理

### 2.1 katachi-awase-app（かたちをあわせよう）

- Level構成（`generateTask(lvl)`）: Level1=1個、Level2=2個、Level3=3個。`n = (lvl===1) ? 1 : lvl`。
- 図形: `SHAPE_TYPES = ['circle','triangle','square']`（○△□の3種固定）。
- **重要な既存制約**: `shapes: shapeOrder.map(t => ({ id: t, shapeType: t, ... }))` — **`shape.id` は `shapeType` の文字列そのもの**。1問の中で同じ形が2つ以上登場することは現状ありえない（`shuffleArray(SHAPE_TYPES).slice(0,n)` で重複なしに取り出すため）。正誤判定も `targetId === shape.shapeType` で行っている。
- 色（`PALETTE`）はpresentation-onlyで毎問シャッフルされ、正誤判定には一切使われない（コード内コメントで明記）。
- 記録（`addLog`）: `time, level, questionIndex, questionTotal, shape, expected, selected, correct, mistakes, mistakeSelections, responseTimeMs, inputMethod`。CSV列: `日時,レベル,問題番号,問題数,形,正しい場所,選択した場所,正誤,再試行回数,間違えた内容,反応時間ms`。
- Switch Scan／gaze: 候補は `.shape-btn`／`.target-btn` という**ボタン要素そのもの**（`buildScanItems()`/`getGazeTargets()`）。視覚的な図形（`.shape-visual`）はボタン内の子要素であり、ボタン自体のサイズ・フォーカスリング・dwell-ringはボタンサイズに紐づく。
- Drag（Phase26-D7/D8/G）: Pointer Events、`dragState`はtransient、`phase`ガード済み、`finishDragVisuals()`で一元cleanup。triangleのtarget outlineはPhase26-D8のcalc()（`50% calc(4% + 11.18px), calc(4% + 8.09px) calc(96% - 5px), calc(96% - 8.09px) calc(96% - 5px)`）で、**box sizeに依存しない固定px値**として設計されている（Phase26-Hで88→100/96→112/96→128pxへ拡大しても無改修で正しく機能することを確認済み）。
- Phase26-Hでのサイズ確定値: `.shape-btn,.target-btn` は mobile(≤480px)100px／tablet(481–1023px)112px／desktop(≥1024px)128px。`padding:6px`のため`.shape-visual`自体は各々88/100/116px相当。

### 2.2 kurabeyou-app（おおきい？ちいさい？くらべよう）

- Level構成: Level1「みてたのしむ」（見るだけ）／Level2「みくらべる」（2つを見比べる）／Level3「どっちかな？」（大小どちらかを選ぶ判定課題）／Level4「じゅんばん」（3つを大きい順・小さい順に並べる）。
- **concept**という上位軸を持つ: `comparisonMode`（`size`=おおきい・ちいさい、`length`=ながい・みじかい）。UI上部に`.concept-btn`の行があり、Level行とは別に独立している。
- **大きさ比率は既に確立済みの数値がある**: `SIZE_PAIRS = [[210,130],[195,120],[180,110]]`（比率はすべて1.6倍以上、コード内コメントに「Phase26-C6.1でこの1.6倍フロアを確立した」旨明記）。Level4の3段階順序（`level4Patterns`、例 `[100,140,190]`）は**隣接比率1.35倍以上**を条件にしている。
- **「中」という言葉は一度も使われていない**。Level4で3つを並べる課題はあるが、TTS/UI上「ちゅうくらい」という語彙は存在しない（`おおきい じゅんに ならべよう`／`ちいさい じゅんに ならべよう`のみ）。
- 色（`KURABEYOU_PALETTE`）もpresentation-onlyで、correctEl/correctOrderは常に値（サイズ）から導出。katachi-awaseと同じ設計哲学。
- 記録: `RECORDS_CONCEPT_NAME`, `RECORDS_SELECTED_TEXT`等でconcept別に文言を切替える設計がすでに存在する。

### 2.3 2アプリの役割差（現状）

kurabeyouは「**大きさそのものを直接比較・判定する**」教材（2つのうちどちらが大きいか、3つを順に並べる）。katachi-awaseは「**形を認識して対応する場所へ配置する**」教材（マッチング）。両者は概念としては重なるが、**操作の型が異なる**（比較判定 vs マッチング配置）。

---

## 3. 大／中／小を入れるか（設計判断が必要な論点1）

### 案A — 大／小のみから開始、上位Levelで大／中／小（推奨）

**根拠**: kurabeyou自身が、3つを並べるLevel4を持ちながら「中」という言葉を一切使っていない。これは開発時点でのユーザー実績（Phase26-C6.1）に基づく判断であり、**「3値同時弁別は認知負荷が高い」という既に確認済みの知見**と解釈できる。katachi-awaseは対象年齢・発達段階がkurabeyouと重なるため、同じ理由で2値から始めるのが整合的。

### 案B — 最初から大／中／小

3語彙・3視覚差を同時に導入するため、Progressive complexity（v1.1標準 原則6）に反する。TTSも「ちゅうくらいの」が他の2語より長く複雑（音韻的負荷差）。

### 案C — 設定で2段階／3段階を切替

柔軟だが、設定項目が増える（Phase26-Hで整理した視認性を再び複雑化させるリスク）。またLevel構成と設定の組み合わせが増え、記録・CSV設計も複雑化する。

**結論**: 案Aを推奨。大／中／小は将来Level（例：おおきさ-Level3の上、あるいは新規Level4相当）として**構造上は準備しつつ、本Phaseの実装スコープには含めない**。

---

## 4. Level構成案（最低3案の比較）

### 案1 — 現行Level維持＋追加モード

```
[ひとつ] [ふたつ] [みっつ] [おおきさ]
```

既存Level1〜3のロジックは一切変更しない。「おおきさ」は4つ目のLevelボタンとして追加し、内部で独自の大小マッチング問題を生成する。

- 長所: 最も安全。既存3 Levelの意味・動作・記録が変わらない。
- 短所: 「かたち」の学習と「おおきさ」の学習が地続きに見えない（急に別モードへ飛ぶ）。Levelボタンが3→4個になる（後述のUI検討で許容範囲か要確認）。

### 案2 — 学習系列型（Level再定義）

```
Level1：形のみ
Level2：形＋大/小
Level3：形＋大/中/小
```

task本文の例そのもの。**重大な懸念**: これは現行Level2（ふたつ＝形のみ2個）・Level3（みっつ＝形のみ3個）の**意味を書き換える**ことになる。既存ユーザーが慣れ親しんだ「Level2=2個」「Level3=3個」という理解と、記録上の過去データの解釈（`level`列は数値のみで、その数値が指す内容が変わってしまう）に影響する。

- 長所: 段階性が最も直感的（1つの数直線上でだんだん複雑になる）。
- 短所: **第23項「既存Levelへの影響」の「従来モードが消える設計は避ける」に抵触するリスクが高い**。既存の「純粋に形だけを合わせる」学習機会（Level2・Level3）が実質的に失われる。**この案は非推奨**とし、あくまで比較対象として記載する。

### 案3 — 設定分離型

Levelボタン（ひとつ／ふたつ／みっつ）は完全に既存のまま。詳細設定パネル内に「おおきさ：なし／大・小／大・中・小」の切替を追加し、既存Levelと直交させる。

- 長所: 既存Level行のUIが一切変わらない（視覚的には現状維持）。組み合わせの自由度が高い。
- 短所: 設定パネルの奥にあるため発見可能性が低い（何ができるか気づきにくい）。Level×おおきさ設定の組み合わせ数が増え、記録・CSV上「今のセッションが何の学習か」の表現がやや複雑になる。

### 案4（推奨） — concept分離型（kurabeyou-appのUIパターンを踏襲）

```
[かたち] [おおきさ]     ← 新規concept行（kurabeyouの.concept-btnと同じ配置・同じ役割）
[ひとつ] [ふたつ] [みっつ]   ← concept=かたち のとき（現行そのまま、無変更）
```
```
[かたち] [おおきさ]
[レベル1] [レベル2] [レベル3]  ← concept=おおきさ のとき（新規、内部は下記5章）
```

kurabeyou-appは既に「concept（上位の学習種別）→Level（その中の段階）」という2階層UIを採用し、実績がある。katachi-awaseに**同じUIパターンをそのまま輸入**することで、
1. 既存Level1〜3は`concept==='shape'`（デフォルト）のときだけレンダリングされ、**コード上も見た目上も完全に無変更**。
2. 「おおきさ」を選んだときだけ、新しいLevel群（5章）が表示される。
3. ユーザーは2アプリを使う中で「conceptを切り替える」という同じ操作パターンに再度出会うため、cross-app learningの土台にもなる（21章）。
4. 新規UI行は1行のみの追加（Levelボタンが2段3段になるのではなく、既存Level行の**上**にconcept行が1行増えるだけ）。

**推奨理由**（24章で詳述）: 4案の中で唯一、①既存Levelを一切変更しない、②UI追加が最小（1行のみ）、③kurabeyou-appと同じ操作パターンで学習の転移を促す、の3条件を同時に満たす。

---

## 5. 「おおきさ」concept内のLevel構成（案4を採用した場合）

```
Level1（おおきさ・ひとつ）: 大 or 小のどちらか1個。対応する大きさのtargetへ。
Level2（おおきさ・ふたつ）: 同一shape・異サイズ2個（例: 大○/小○）。形の弁別が不要な分、純粋に大きさだけで判断する回。
Level3（おおきさ・みっつ）: 異shape・異サイズを含む2〜3個（例: 大○/小△、または3shape×2size）。形と大きさを同時に弁別する回。
```

13章の「同一shape・異サイズ」「異shape・異サイズ」パターンを、既存の「ひとつ／ふたつ／みっつ」という個数の粒度にそのまま対応させている（ユーザーにとって既に知っているLevel名の付け方を踏襲）。大／中／小への拡張（3章 案A）は、ここに将来Level4を追加する形で行う。

---

## 6. 比率・サイズ設計

### 6.1 視覚サイズ比率

kurabeyouの既存フロア値をそのまま踏襲する（新しい閾値を独自に作らない）。

- 2値（大／小）: 比率 **1.6倍以上**（kurabeyou `SIZE_PAIRS` と同じ根拠）。候補: Large=100%、Small=60%（比率1.67）。
- 3値（将来、大／中／小）: 隣接比率 **1.35倍以上**（kurabeyou `level4Patterns` と同じ根拠）。候補: Large=100%、Medium=74%、Small=55%（100/74=1.35、74/55=1.35）。

いずれも「%」は`.shape-visual`（ボタン内の描画要素）に対するスケールであり、ボタン自体のサイズではない（6.2参照）。

### 6.2 視覚サイズと操作領域（hit area）の分離

`.shape-btn`/`.target-btn`はPhase26-Hで確定した100/112/128pxのサイズを**大／小を問わず維持**する。`.shape-visual`のみを`width`/`height`（％指定、`transform:scale()`ではない — 理由は6.3）で縮小し、親の`display:flex;align-items:center;justify-content:center`により自動的に中央寄せされる。

- touch/drag: ヒットエリアは常にPhase26-H基準の100/112/128px。小さい図形でも押しやすさ・つかみやすさは変わらない。
- Switch Scan: ハイライト対象は`.shape-btn`/`.target-btn`要素そのもの（1章参照）。視覚が小さくてもハイライト枠は常にボタンサイズで表示される。
- gaze: dwell-ringは`.shape-btn`/`.target-btn`基準の`position:absolute; inset:-6px`。ボタンサイズ不変のため、dwell-ringの大きさ・押しやすさも不変。

### 6.3 なぜ`transform:scale()`ではなく`width`/`height`か（triangle対応・12章の核心）

Phase26-D8のtriangle target outlineは、`.shape-visual`自身の座標系に対する**固定px値**（`calc(4% + 11.18px)`等）でオフセットを計算しており、この設計により**ボタンサイズが変わっても常に絶対5px幅のstrokeを保つ**ことをPhase26-Hで実証済み（88→128pxの4段階で斜辺・底辺とも4〜5pxを維持）。

もし`.shape-visual`を`transform:scale(0.6)`のような**描画後の変形**で縮小すると、clip-pathの計算結果ごと0.6倍に縮小されてしまい、実効ストローク幅が5px→3pxのように**縮んでしまう**（D8が固定px値を採用した意図と正反対の結果になる）。

一方、`.shape-visual`の`width`/`height`自体を（layout上）60%や55%に変更する方式なら、D8のcalc()は**その新しいボックスサイズに対して再計算**され、Phase26-Hで実証済みの「ボックスサイズ非依存」特性がそのまま適用される。**したがって実装時は必ずlayoutサイズ変更（width/height）を用い、transformベースの縮小は使わない**ことを設計上の必須条件とする。

### 6.4 Small tritriangleの安全マージン（机上検証）

D8オフセット式から、三角形が退化しない最小box高さは理論上 **約17.6px**（`0.04H+11.18 < 0.96H-5` を解くと `H > 17.6`）。6.1の最小候補（Small=55%、Phase26-Hの最小box=88px基準で約48px）は、この理論下限を大きく上回るため崩壊リスクは低いと推定されるが、**実装時に必ずPhase26-D8と同じ手法（実描画のpixel解析）でRendered Validationを行うこと**（本Phaseでは未検証・未実装のため確定情報ではない）。ストローク幅が小さい図形に対して相対的に太く見える可能性（4.3%→10%程度に増加）についても、実装時に目視確認し、必要であれば小サイズ専用に4px等へ調整する余地を残す。

---

## 7. Target側の表現

「ばしょ」も大きさを持たせる（大きい○の場所／小さい○の場所）。実装は6.2/6.3と同じ方式（`.target-btn`は既存サイズ据え置き、`.shape-visual`のみをサイズtierに応じて縮小）を、shapeとtarget両方に共通のCSSクラス（例: `.size-large`/`.size-small`）で適用することで、○△□3種・shape/target双方に対して同一の仕組みで一貫性を保つ。

---

## 8. 問題生成パターン（13章の整理）

| パターン | 例 | 弁別軸 |
|---|---|---|
| 同一shape・異サイズ | 大○ / 小○ | 大きさのみ |
| 異shape・異サイズ | 大○ / 小△ | 形＋大きさ |
| 同shape 3サイズ（将来） | 大○ / 中○ / 小○ | 大きさのみ（3値） |
| 3shape×3size（将来） | 大△ / 中○ / 小□ | 形＋大きさ（3値） |

5章のLevel構成に対応させると、Level2は「同一shape・異サイズ」、Level3は「異shape・異サイズ」を主軸とする。3shape×3sizeの組み合わせ数は3×3=9通りのshape-sizeペアから2〜3個を選ぶ形になり、既存の「重複shapeを禁止する」設計（`shuffleArray(SHAPE_TYPES).slice(0,n)`と同型のロジック）を「shape-sizeペア」単位に置き換えることでそのまま流用できる。

---

## 9. 認知負荷と色の扱い（14〜15章）

現行の色（`PALETTE`/`KURABEYOU_PALETTE`）はpresentation-onlyだが、**「おおきさ」conceptでは色を大きさの手がかりに使われてしまうと学習の意味が崩れる**（大きさで選ぶべきところを色で選んでしまう）。

| 案 | 内容 | 評価 |
|---|---|---|
| 案A | 同じshapeは同色にする（例: 大○も小○も同じオレンジ） | 「同じ形」であることが色でも強調され、大きさ以外の変数を減らせる。ただし色が同じだと「同じ図形の大小違いバージョン」という関係性を暗示してしまい、かえって手がかりになる可能性もある（意図的に使うなら良い） |
| 案B | 全shape同色にする（学習中は単色固定） | 色という変数を完全に排除できるが、視覚的に単調になり、他のconcept（かたち）との統一感が薄れる |
| 案C | 現行どおりランダム色を維持 | 実装が最も簡単（変更不要）。ただしkurabeyouのcomparisonのように「大きさだけを見て判断してほしい」課題では、色のばらつきが余計なノイズになりうる |

**推奨**: 案B（学習中は全shape同色、またはグレースケール寄りの単色）を基本としつつ、正解後のfeedback表示（配置後の塗りつぶし色）は現行どおり個別色を残す。**大きさを弁別させたい局面（判断前）は色を統一し、結果表示（判断後）では色の楽しさを残す**という切り分け。ただし色に関するUXの好みが強く関わる論点のため、**ユーザー確認を推奨する意思決定ポイント**として明記する（39章）。

---

## 10. TTS・feedback文言案（16〜17章）

### TTS

- 2値: 「おおきい まる」「ちいさい まる」（形+大きさを1フレーズで読み上げ、kurabeyouの「おおきいかたち」パターンを踏襲しつつ形の名前まで具体化）
- 3値（将来）: 「おおきい まる」「ちゅうくらいの まる」「ちいさい まる」（「ちゅうくらいの」は音韻的に長く、3章の案Aで2値優先とした根拠の一つ）

### Feedback

正解時、現行の「ぴったり！」をそのまま維持することを基本案とする。「おおきい まる、ぴったり！」のような概念強化フィードバックは、テンポを落とすリスクがあるため、**Level1（おおきさ・ひとつ）等の導入段階でのみ試験的に使う案**を提示するに留め、確定はユーザー判断に委ねる（39章）。

---

## 11. Records / CSV設計（18〜19章）

### Records（`addLog`）

既存フィールドは**変更しない**（後方互換性優先）。`shape`フィールドは引き続き`shapeType`のみを格納する。新規フィールド`shapeSize`（値: `'large'`/`'small'`/`'medium'`/未指定）を**追加**する。「かたち」concept（既存Level1〜3）ではこのフィールドを送出しない（=既存ログと完全に同一形状のまま）。「おおきさ」conceptのときのみ値が入る。`readLog()`側は`entry.shapeSize`の有無を問わず動作するため、過去ログとの混在を許容できる。

### CSV

`CSV_HEADERS`の**末尾に**新規列「おおきさ」を追加する（既存列の途中に挿入しない）。既存の位置ベースでCSVを読んでいる利用者がいた場合でも、先頭から10列目までは変化しない。「かたち」conceptの行は該当列を空欄にする。

---

## 12. 入力方式別の設計（20章）

| 入力方式 | 設計 |
|---|---|
| touch/tap | 影響なし。ヒットエリア不変（6.2）。 |
| drag | ヒットエリア不変のため、Phase26-D7/G のPointer Events実装（`dragState`、`phase`ガード、`finishDragVisuals()`、`lostpointercapture`）は無改修で機能する想定。**本Phaseではこれらのロジックに一切触れない**。 |
| keyboard | Tab移動対象は`.shape-btn`/`.target-btn`のまま。フォーカスリング(`:focus-visible`)もボタン基準で不変。 |
| Switch Scan | ハイライト枠はボタン基準（6.2）。小さい視覚でもハイライトは常にボタンサイズで表示され、視認性が下がらない。 |
| gaze | dwell-ringはボタン基準（6.2）。視覚が小さくてもgaze対象領域は縮小しない。 |

---

## 13. mobile UI・375×667成立性（8章）

案4（concept分離型）採用時、375×667で追加されるのは**concept行1行のみ**（kurabeyouの実装で既に375px幅での成立が実証済みのパターンを踏襲）。「おおきさ」Level群は既存Level行と同じ`.level-btn`スタイル・同じ個数（最大3個）を使うため、Level行自体の高さ・折り返し挙動は現行と同一と見込める。

ただし、Phase26-Hで確定した375×667の余白（実測112px）はconcept行の追加により消費される。**実装時に必ず実測し、375×667でのスクロール有無を確認する必要がある**（本Phaseでは未実装のため未検証）。

---

## 14. kurabeyou-appとの役割分担（21章）

| | kurabeyou-app | katachi-awase-app（おおきさconcept） |
|---|---|---|
| 学習の型 | 比較・判定（どちらが大きいか、順番に並べる） | マッチング・分類（大きさに合う場所へ配置する） |
| 出力 | 「どちらか」を選ぶ、または「順序」を作る | 「対応関係」を完成させる |
| 前提知識 | 大小の概念そのものを学ぶ入口 | 大小の概念を**使って**分類する応用 |

kurabeyouで「大きい・小さい」を認識できるようになった後、katachi-awaseでその概念を**別の操作文脈（マッチング）に転移できるか**を確認する教材、という段階的な関係を想定する。単なる重複ではなく、**学習の型が異なる**ことを設計の軸とする。

---

## 15. App間導線（22章、本Phaseでは未実装）

将来的に、kurabeyou-appのセッション完了画面や、index.htmlのおすすめ導線から、katachi-awaseの「おおきさ」conceptへ直接遷移できるリンクを設けることは検討価値がある（例: kurabeyouでの「おおきい・ちいさい」学習後に「かたちをあわせようで ためしてみよう」という案内）。ただし、これは共通UIパターン・複数アプリへの影響を伴う可能性があるため、**Phase26-Iでは設計提案のみに留め、実装しない**。

---

## 16. 簡易DOM構成案（25章、ASCIIモックアップ）

```
<header class="app-header">…</header>

<!-- NEW: concept row (kurabeyou-appの.concept-btn行と同じ役割) -->
<div class="concept-row" role="group" aria-label="がくしゅうの しゅるい">
  <button class="concept-btn active" data-concept="shape">かたち</button>
  <button class="concept-btn" data-concept="size">おおきさ</button>
</div>

<div class="level-row">…</div>  <!-- concept=shape: 既存そのまま / concept=size: 新Level群 -->
<div class="count-row" hidden>…</div>
<div id="progressArea">…</div>
<div id="feedbackText">…</div>

<div id="playArea">
  <div class="tray-label">ばしょ</div>
  <div class="tray" id="targetsTray">
    <!-- concept=size のとき、各target-btnに data-size="large|small" を追加 -->
    <!-- .shape-visual に .size-large / .size-small を付与し、width/heightのみ変更 -->
  </div>
  <div class="tray-label">かたち</div>
  <div class="tray" id="shapesTray">…</div>
</div>
```

---

## 17. 実装影響ファイル候補（35章）

- `katachi-awase-app.html`（唯一の実装対象と想定。JS: `generateTask`, `renderTask`, `onTargetActivate`, `addLog`, `buildRecordsCsvRows`, CSS: `.concept-row`/`.concept-btn`/`.shape-visual.size-*`）
- `generate.js`: `MANUAL_CHANGELOG`（実装Phaseで初回公開または機能追加のchangelog判断が必要になった場合のみ）。本Phaseでは変更なし。
- `apps-data.json`: 機能追加のfeatures/lesson記述を更新する場合は対象になりうるが、本Phaseでは変更なし。
- 新規Design Systemルールは不要と判断（36章）。concept-row / size-scalingはkurabeyou-appに既存する実装パターンの再利用であり、Design System本体（`donomana-design-system-v2_0.html`）やv1.1標準文書に新しい原則を追加する必要はない。

---

## 18. 残存論点・ユーザー確認が必要な判断事項（37・39章）

1. **色の扱い（9章）**: 案A/B/Cのどれを採用するか。学習効果とUXの好みに関わるため、ユーザー判断を推奨。
2. **feedbackの概念強化発話（10章）**: 「おおきい まる、ぴったり！」のような追加発話を入れるか、現行の「ぴったり！」のみに留めるか。
3. **Level構成の最終確定（4〜5章）**: 案4（concept分離型）を推奨するが、案1（現行Level維持＋追加モード）を選好する可能性も残る。UIの好み次第で分かれる。
4. **大／中／小の導入時期（3章）**: 案Aで合意できるか、最初から3段階を望むか。
5. **App間導線（15章）**: 将来実装するか、しないか。

---

## 19. 推奨実装Phase構成案（38章）

1. **Phase26-I2**: 案4（concept分離型）でのUI土台実装（concept-row追加、既存Level1〜3が完全に無変更で動くことの回帰確認）。「おおきさ」conceptは未接続のプレースホルダーでも可。
2. **Phase26-I3**: 「おおきさ」Level1〜3の問題生成・正誤判定・TTS・記録・CSV実装（大／小の2値のみ）。
3. **Phase26-I4**: Rendered Validation（5 viewport、D8同等のtriangle stroke検証、Switch Scan/gaze/keyboard/drag回帰）。
4. **Phase26-I5（将来）**: 大／中／小への3値拡張。ユーザーが2値の定着を確認してから着手。

各PhaseはRelease Approval Gate対象（学習内容拡張のため）とし、都度ユーザー確認を挟む。
