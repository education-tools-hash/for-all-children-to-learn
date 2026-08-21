# 「どっちがいい？」設計書 v1.1（Phase M12-A: Educational / UX Design、Phase M12-B: Level1 Local Prototype）

Multi-Input Program 4教材目（Pilot 3教材Close後の最初の新規教材）。設計方針は[multi-input-program-design-v1.md](./multi-input-program-design-v1.md)を継承し、視線入力仕様は[donomana-gaze-accessibility-standard-v1_0.md](../design-system/donomana-gaze-accessibility-standard-v1_0.md)のREQUIRED 8項目に最初から準拠する。本書はPhase M12-A（教育設計・UX設計のみ、アプリ本体は実装しない）の成果物として起草し、Phase M12-Bで最初のLocal Prototype（Level1「どっち？」のみ）を実装した。1〜31章はM12-A時点の原設計を保持し、Prototype実装で確定した内容・変更点は32章に**revisionとして追記する**（原設計は結果に合わせて書き換えない）。

- 位置づけ: 新規アプリ開発。初回Production公開は`docs/design-system/donomana-new-app-development-standard-v1_0.md`が定めるUser Approval Gate対象（48章 Release Policy）。Phase M12-Bまでの時点では未公開（`apps-data.json`未登録、`generate.js`未対象）。
- Source of Truth: Multi-Input Program設計書・Gaze Accessibility Standard v1.0・Pilot Reference Set 3教材（`miru-hirogaru-app.html`／`mitsukete-touch-app.html`／`junban-miyou-app.html`）・Group B Rollout 3教材（`kurabeyou-app.html`／`katachi-awase-app.html`／`kimochi-board.html`）。特に`kimochi-board.html`（コミュニケーションボード）は「正解・不正解を設けない選択・意思表出型教材」という点で本教材と教育的に最も近い既存教材であり、feedback設計・success-only哲学の参照元とする。

---

## 目次

1. 教育目標
2. 対象
3. Core Experience
4. 正誤設計
5. Level構造（3案比較・推奨）
6. Trial Flow
7. Choice Categories（5案評価・推奨）
8. World（3案比較・推奨）
9. Visual / Feedback設計
10. 非選択対象の扱い
11. Multi-Input設計（Touch/Gaze/Switch/Keyboard）
12. Activation Model
13. Duplicate Prevention
14. Target Layout / Randomization
15. Gaze Standard準拠設計
16. Shared Foundation利用方針
17. Switch Scan設計
18. Settings設計
19. Trial数（名称検討）
20. Record方針
21. Completion設計
22. Accessibility（Modal/Escape/focus）
23. Responsive
24. Reduced Motion
25. Sound / Speech
26. Assets候補
27. Naming（表示名・ファイル名候補）
28. Implementation Plan（Phase M12-B以降）
29. apps-data / navigation Inventory
30. Release Approval Gate
31. User Review Points

---

## 1. 教育目標

### 最上位コンセプト
本教材の中心は「正しいものを当てる」ことではない。子どもが**見る→気づく→比べる→どちらかを選ぶ→選んだ結果を受け取る**という経験を通して、「自分が選んだ」ことを感じられる教材にする。正解・不正解を設けない。

### Primary
**選択・意思表出**: 2つの選択肢の中から、自分の使える入力方法（Touch/Gaze/Switch/Keyboard）で1つを選ぶ。

### Secondary
- 視覚的に2対象へ気づく
- 対象間で視線・注意を動かす
- 自分の行動と結果の因果関係を経験する
- 選択した対象を見届ける
- 「もう一度選ぶ」経験を重ねる

---

## 2. 対象

主対象は重度・重複障害／肢体不自由／知的障害／発語がない・限定的／発達初期段階／視線入力利用者／Switch利用者だが、**特定障害専用にはしない**。Touch/Gaze/Switch/Keyboardいずれでも活動として成立させる（22.1章 Foundation A「Semantic Activation Architecture」の直接適用）。

---

## 3. Core Experience

1. 2つの選択肢が大きく、離れて表示される
2. 利用者が見る／触る／Switch／Keyboardで選ぶ
3. 選択されたものが明確になる（feedbackが即座に対象へ集中する）
4. 選んだ対象に応じた楽しい変化が起きる
5. 十分に見届ける時間がある
6. 次のtrialへ進む

この6ステップが全Levelを貫く不変のcore loopであり、Level間の違いはこのloopの「内容の豊かさ」の違いであって、loop構造そのものは変えない（Reference Setの「1つのactivation関数へ全入力方式を合流させる」原則と同じ発想を、trial構造にも適用する）。

---

## 4. 正誤設計

**原則: 正解・不正解なし。** どちらを選んでも成功。

禁止事項（Program設計書10章 Error Philosophyの直接適用）:
- ×表示
- 赤色エラー表現
- ブザー等の否定的sound
- 「ちがう」等の否定語
- retryを促す否定feedback

本教材はassessmentではなくchoice experienceである。既存のquiz型教材（かたちをあわせよう・おおきい？ちいさい？くらべよう等のcorrect/mistakeモデル）を機械的に持ち込まない。**success-only / errorless learning**として設計する（37章原則）。選択できたこと自体を成功として扱う。

---

## 5. Level構造（3案比較・推奨）

### 候補A: 経験→好み→因果（複雑さではなく目的で分ける3段階、ブリーフ第一候補）
- Level1「どっち？」: 大きな具体物2つ、distractorなし、明確なfeedback。二者択一そのものを経験する。
- Level2「すきなのはどっち？」: choice categoryを広げ、trialごとに組み合わせを変える。好みを表出する経験。
- Level3「どっちにする？」: 選択結果が次の遊び・feedbackの内容そのものを変える（例: たいこを選ぶ→たいこの音とanimation）。選択が結果を変えることをより明確に経験する。

### 候補B: 単一Level＋カテゴリー選択制（kurabeyouのconcept切替パターンを踏襲）
Level概念を廃止し、「くらべるテーマ」相当の設定でcategory（食べ物/動物/乗り物/音）を選ばせ、trial数のみを進行の単位とする。理由: 本教材は「難易度」が本質的に存在しない（正誤がないため難易度の概念自体が希薄）。kurabeyou-appの`comparisonMode`切替と同型のUIで実装できる。

### 候補C: 感覚モダリティ別2段階
Level1「みてえらぶ」（視覚のみの選択）、Level2「きいてえらぶ」（音を伴う選択、例: 2つの楽器音から選ぶ）。難易度ではなく感覚経路の違いでLevelを分ける。

### 比較

| 観点 | A | B | C |
|---|---|---|---|
| 家族内の既存慣習との整合（Level=段階的に豊かになる） | 高 | 低（Level概念自体がない） | 中 |
| 3Level以内（12章原則） | ○（3） | ○（実質1） | ○（2） |
| Level間の教育的意味の差 | 明確（経験→好み→因果） | Levelがないため差の議論自体が発生しない | 明確だが「音」を後回しにする理由が弱い |
| 実装コスト | 中 | 低 | 低〜中 |
| 「難易度」という誤解のリスク | Level名を「1/2/3」等の数値にすると誤解されやすい（要注意） | なし | なし |

### 推奨: 候補Aをベースに、Level名を数値ではなく機能名で表現する形へ調整して採用

理由: 候補Aの3段階は「経験する→好みを表す→選択が結果を変える」という**教育的に明確に異なる3つの目的**を持ち、12章の「学習内容がLevel間で明確に異ならない場合は2Levelでもよい」という条件に該当しない（3つとも明確に異なる）。一方で候補Bの魅力（category切替のシンプルさ）はLevel1・Level2の内部設計に取り込む（次trialでcategoryが変わる設計、7章参照）。候補Cの音重視という発想はLevel3（選択が結果を変える）の主要な表現手段として統合する。

**ただし「Level1/2/3」という数値表記は、正誤のない教材で「段階を上げるべきもの」という誤解を招きやすいため、UI上は数値ラベルを主要な手がかりにせず、機能名（「どっち？」「すきなのはどっち？」「どっちにする？」）を主表記とする。** これはUser Review Point（31章）とする。

---

## 6. Trial Flow

1. 2つの選択肢が画面に大きく、離れて表示される（Agency原則により視覚的な強さは同程度、38章）
2. 利用者が入力方式に応じて選ぶ（Gaze dwell完了／Touch tap／Switch Scan決定／Keyboard Enter・Space）
3. 選択が確定した瞬間、選ばれた対象へ明確なfeedbackが集中する（9章）
4. 選ばれなかった対象は穏やかにfocusが弱まる程度に留める（失敗表現にしない、10章）
5. motion/progression speed設定に応じた「見届け」時間を確保してから次trialへ（15章 motion speed 900ms系のfeedback pause、Reference Setの`FEEDBACK_MS`/`effMs()`パターンを踏襲）
6. 設定された回数（19章）に達したら穏やかなCompletion画面（21章）

---

## 7. Choice Categories（5案評価・推奨）

| カテゴリー | 認識しやすさ | 好みが出やすい | Gaze target区別しやすさ | feedback作りやすさ | 発達初期でも意味がわかりやすい | 総合 |
|---|---|---|---|---|---|---|
| A. 食べ物（りんご/バナナ、いちご/ぶどう） | 高 | 高 | 高（形・色が大きく異なる） | 高（「おいしそう」演出が作りやすい） | 高 | 採用 |
| B. 乗り物（くるま/でんしゃ、バス/ひこうき） | 高 | 中 | 高 | 中 | 中 | 次点（拡張候補） |
| C. 動物（いぬ/ねこ、うさぎ/くま） | 高 | 高 | 高 | 高（鳴き声・動きが作りやすい） | 高 | 採用 |
| D. 音（たいこ/ベル、ピアノ/木琴） | 中（聴覚に依存する分、視覚のみでは弱い） | 中 | 中（視覚差が小さい楽器同士は要注意） | 高（選択＝即座に音が鳴る、因果関係が最も明確） | 中 | Level3専用として採用 |
| E. 色や感覚（あか/あお、きらきら/ふわふわ） | 中〜低（「きらきら」「ふわふわ」は抽象度が高い） | 高（感覚的好みが出やすい） | 中 | 中 | 低（発達初期には抽象的すぎる可能性） | 見送り（将来拡張候補） |

### 推奨
MVPは**A（食べ物）・C（動物）をLevel1/Level2の主軸カテゴリーとし、D（音）をLevel3専用カテゴリー**とする。B（乗り物）は認識しやすさが高く次点の拡張候補として記録するが、MVPスコープには含めない。E（色や感覚）は10章「抽象刺激より具体物を優先」の原則に照らして発達初期の子どもには意味が伝わりにくいリスクが高く、MVPでは採用しない（将来、実際の利用データから刺激量調整のニーズが確認された場合の拡張候補として9章のSensory Load調整と合わせて検討する）。

Level1「どっち？」はA・Cのうち特に視覚差が大きい組み合わせ（りんご/バナナ、いぬ/ねこ等）に限定し、Level2「すきなのはどっち？」でA・C全体の組み合わせをtrialごとにランダムに提示して好みの幅を広げる。Level3「どっちにする？」はDのみを用い、選択→即座にその楽器音が鳴るという最も明確な因果構造を提供する。

---

## 8. World（3案比較・推奨）

### 候補A: おやつのテーブル
2つのおやつから選ぶ。食べ物カテゴリーとの親和性は非常に高いが、動物・楽器カテゴリーとは世界観が噛み合わない（テーブルの上に犬や太鼓を置く必然性がない）。

### 候補B: おもちゃのおへや
2つのおもちゃから選ぶ。食べ物も動物も楽器も「おもちゃ」として統一的に配置でき、カテゴリー展開への親和性が高い。「みるとひろがる」が既に「おもちゃのへや」という世界観を採用しているため、様式（配色・構図）を明確に変えないとブランド混同のリスクがある。

### 候補C: ふしぎな選択ボード
2つのキャラクター／ものを選ぶ。最もカテゴリー非依存（食べ物でも動物でも楽器でも、再テーマ化なしに提示できる）。target分離のコントロールが最も容易（「板の上の2区画」という構造そのものがlayout設計を兼ねる）。一方で「テーブル」「おへや」に比べて物語性・親しみやすさに欠け、子どもが「選びたい」と感じる情緒的な引力が弱い。

### 比較

| 観点 | A おやつのテーブル | B おもちゃのおへや | C ふしぎな選択ボード |
|---|---|---|---|
| 認識しやすさ | 高（ただし食べ物限定） | 高 | 中 |
| 視覚刺激量 | 中 | 中 | 低（意図的にニュートラル） |
| target分離のしやすさ | 中 | 中 | 高 |
| asset再利用性（カテゴリー横断） | 低 | 高 | 最高 |
| 今後のcategory展開 | 弱い（食べ物以外が不自然） | 強い | 最強 |
| 子どもが「選びたい」と感じるか | 高（食べ物のみ） | 高 | 中〜低 |

### 推奨: 候補B「おもちゃのおへや」

25章の原則（「Gazeで使いやすいから」だけでなく「子どもが楽しそうだから選びたくなる」ことを優先する）に照らし、Bを推奨する。Cは設計上もっとも安全だが情緒的な訴求力に欠け、Aはカテゴリー展開（動物・楽器）と両立しない。Bはカテゴリー横断性と情緒的訴求力を両立できる唯一の候補である。

**miru-hirogaru-appとの様式混同を避けるための差別化方針**（実装Phaseで確定）:
- miru-hirogaru: 単一の「見て働きかける」おもちゃショーケース、暖色・光の演出中心
- どっちがいい？: 「2つを比べて選ぶ」ための左右（または上下）2区画構図、寒色寄りの落ち着いた背景に、比較しやすい明快なコントラストの2オブジェクトを配置する構図とし、世界観のラベルも「おもちゃのおへや」ではなく固有の呼称（例:「えらべる おもちゃばこ」）を用いて名称レベルでも区別する

この差別化方針自体もUser Review Pointとする（31章）。

---

## 9. Visual / Feedback設計

選択後、選んだことが明確に伝わるfeedbackを以下から組み合わせて設計する（過剰にしない）:
- 選択対象がわずかに拡大する（visual expansion、Program設計書9章）
- 柔らかく光る（gentle glow）
- 軽く跳ねる（gentle bounce、`tapPulse`的な短い演出、kurabeyou-app実績パターン）
- sparkle（控えめな量に留める、junban-miyou boarding演出の抑制版）
- 対応する短いsound（Level3では選択対象そのものの音）
- 短いanimation
- 音声ラベル読み上げ（TTS、25章）

刺激過多を避けるため、上記全てを同時に使わない。Level1では「拡大＋glow＋sound」の3点に絞り、Level2で「＋sparkle」を追加、Level3では音そのものが主feedbackとなるため視覚演出は控えめにする（音と視覚演出の主従を明確にし、Program設計書9章「音の役割はreinforcement/cue/completionのいずれかを明確化し混在させない」に従う）。

Guided Attentionパターン（21章知見: gentle scale＋soft glow＋inner ring）は「唯一操作可能な対象への気づきやすさ向上」のための演出であり、複数候補から一方を選ばせる強調表示ではない。**本教材では2つの選択肢に対してGuided Attention相当の演出を使わない**（38章 Agency原則に直結する制約であり、設計上最も重要な禁止事項の1つ）。

---

## 10. 非選択対象の扱い

選ばれなかった側を、暗くする・×を付ける・消す等の「失敗表現」にしない（14章）。必要であれば、選択された側にfeedbackが集中する結果として相対的にfocusが弱まる程度（例: 選択された側がわずかに拡大・発光する一方、非選択側は変化しない＝相対的に目立たなくなるだけ）に留める。非選択対象へ能動的な減光・グレーアウト・取り消し線等は使わない。

---

## 11. Multi-Input設計（Touch/Gaze/Switch/Keyboard）

### Touch
最低44pxではなく、選択肢自体を大きくする（19章、Large Target Principle、Program設計書12章）。目安として1辺160px以上（Reference Setのkurabeyou-app `.stimulus-shape`が180px基準であることを踏まえる）。

### Gaze
15章参照。8 REQUIRED項目に最初から準拠。

### Switch
17章参照。

### Keyboard
20章参照。Reference Setの「native `<button>` + tabindexによる独立したTab/Enter/Space」方式を採用し、kimochi-boardのようなSwitch Scan状態に依存するkeydown方式は採用しない（新規教材のため、Reference Setのより疎結合な設計をそのまま踏襲できる）。

---

## 12. Activation Model

Reference Setの`activateItem`/`onShapeActivate`パターンを踏襲し、以下の単一関数へ全入力方式を合流させる:

```js
function activateChoice(choiceId, inputMethod) {
  // 1. 二重発火・不正なタイミングでの呼び出しをガード（13章）
  // 2. currentInputMethod = inputMethod を記録（record用、20章）
  // 3. 選択されたchoiceへfeedbackを適用（9章）
  // 4. 選択されなかったchoiceは何もしない（10章）
  // 5. 記録があれば1 trial = 1 recordとして追記（20章）
  // 6. motion speed（effMs()）を考慮した見届け時間の後、次trialへ
}
```

Touch（`click`）／Gaze（dwell完了）／Switch（scan決定）／Keyboard（Enter/Space on focused button）のいずれも、最終的に`activateChoice(choiceId, inputMethod)`のみを呼ぶ。教材固有の入力方式別ロジックを重複実装しない（22.1章 Semantic Activation Architecture）。

---

## 13. Duplicate Prevention

1利用者意図 = 1activation。具体的な防止策（Reference Set・Group B Rolloutで実証済みのパターンをそのまま採用）:
- `isShowingResult`/`phase`相当のstateガードにより、feedback表示中の新規activationを無視する
- Gaze dwell完了直後の合成click（`suppressNextClick`相当）による二重発火を防止する
- Gaze dwell完了後は同一choiceへのleave-and-reenter再トリガーゲート（Gaze Standard §10.2方式A）を適用する

---

## 14. Target Layout / Randomization

### Layout
2択なので、大きく・離れた2 targetを基本とする（17章）。隣接誤選択が起こりにくいlayoutを最初から設計し、Gaze target拡大・spacing設定を「後から間隔を補う」ための保険として位置づける（本質的な間隔不足をspacing設定だけに頼らない）。Wide viewportでは左右配置、375px幅等の狭いviewportでは上下配置へ切り替える（23章 Responsive参照）。

### Randomization
左右（または上下）の位置がtrialごとに固定されると、内容ではなく位置だけを選ぶ可能性がある（39章）。**既定でtrialごとに位置をランダムに入れ替える**設定とし、Agency原則（38章）を優先する。ただしSwitch Scan利用者・一部のGaze利用者にとって位置の予測可能性が操作の安定性に寄与する場合があるため、「ひだり・みぎを いれかえる」設定トグル（既定ON）で無効化できるようにする。

---

## 15. Gaze Standard準拠設計

最初からGaze Accessibility Standard v1.0のREQUIRED 8項目へ準拠する（後付けしない、16章）:

1. Gaze ON/OFF
2. dwell time（既定900ms、300–3000ms/100ms刻み）
3. dwell progress（既定ON）
4. cooldown（既定900ms、leave-and-reenter方式）
5. entry delay（既定0ms、0–500ms/50ms刻み）
6. target enlargement（hit area拡張のみ、視覚サイズ不変）
7. target spacing（hit-region erosion方式を優先）
8. motion/progression speed（既定normal、feedback pacingにのみ適用）

Settings UIは4グループ構成（視線入力／選択／見やすさ・操作しやすさ／動き）でReference Setと情報設計を一致させる（18章）。

---

## 16. Shared Foundation利用方針

新規教材のため、実装時から`GAZE_SHARED_FOUNDATION_APPS`へ登録し、以下をgenerate.js注入で最初から利用する（後からの移行コストを発生させない）:
- 定数（`DWELL_MIN_MS`等）・`clamp()`・`effMs()`・`formatSecondsLabel()`・`wireStepper()`・`hitTestGazeTargets()`・base stepper CSS

KEEP LOCALとする範囲（Reference Set・Group Bの実績パターンに準拠）:
- gaze/選択のstate machine、target collection（`getGazeTargets()`）、activation（`activateChoice`）、trial/level lifecycle、feedback、record integration、persistence配線

---

## 17. Switch Scan設計

最初からCommon Chrome injectorおよびhelper6パターン（`buildScanItems`/`startAutoScan`/`stopAutoScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`）へ準拠する。2 targetのscan順序は左→右（縦積みレイアウト時は上→下）の予測しやすい順序に固定する（18章）。教材target（2 choice）とcommon chrome（home/lock/fullscreen/a11y）は22.1章 Foundation Aの原則どおり明確に分離し、混在させない——kimochi-boardのような「教材targetと共通chromeを同一scan対象に含める」設計は、新規教材である本教材では採用しない。

---

## 18. Settings設計

設定過多にしない（31章原則）。最小限の候補:
- 音 ON/OFF
- 音声ラベル ON/OFF（25章）
- Level選択
- えらぶかいすう（19章）
- アニメーション ON/OFF
- ひだり・みぎを いれかえる（既定ON、14章）
- Gaze Standard設定（15章の8項目）
- Switch Scan設定（既存共通パターン、スキャン間隔等）

---

## 19. Trial数（名称検討）

正解問題ではないため、「問題数」という名称は本教材の性質と合わない（32章）。候補比較:

| 候補 | 評価 |
|---|---|
| かいすう | 汎用的だが「何の回数か」が単体では伝わりにくい |
| えらぶかいすう | 「選ぶ」という行為そのものを回数の主語にしており、本教材の核心（選択・意思表出）と直接一致する |
| ためすかいすう | 「試す」はassessment的なニュアンスを帯びやすく、正誤なし方針と微妙に矛盾する |

### 推奨: 「えらぶかいすう」

---

## 20. Record方針

正答率を記録する教材ではない（29章）。記録候補（Program設計書11章 Records Philosophyに準拠、列を大量に増やさない）:

- date（timestamp）
- level
- choicePair（2つの選択肢の識別、例: `"apple_banana"`）
- selectedChoice
- inputMethod
- dwellDuration（gaze選択時のみ）
- trialIndex / trialTotal

**result/correct列は設けない。** 教員にとっての意味（30章）は「どちらを選んだか」「同じ対象を繰り返し選ぶか」「どの入力方式で選んだか」の把握に限定し、「好み」を診断的に断定する機能（例: 「食べ物への興味が高い」等の自動解釈ラベル）は持たせない（Program設計書11.1章「診断的解釈は自動記録しない」原則）。

---

## 21. Completion設計

全trial終了時、「○問正解」等の評価的表示はしない（33章）。候補:
- 「いっぱい えらべたね」等の肯定的な完了メッセージ
- 選んだものの穏やかな振り返り表示（診断的解釈を含まない、単なる一覧）
- 落ち着いたcompletion animation

評価的になりすぎない完了体験とする。

---

## 22. Accessibility（Modal/Escape/focus）

最初から設計する（34章、Group B Rolloutで後付け修正が必要になった反省を踏まえる）:
- Escapeで設定パネルが閉じること
- 閉じた後、常時表示の`#donomanaA11yBtn`等、可視な要素へフォーカスが返ること
- 設定パネル開時は背景（教材本体）のGaze/Switch Scan/Keyboard操作から分離されること（`getGazeTargets()`が空配列を返す等）
- screen reader向けaccessible name・role・ariaラベルを初期実装から用意する
- Switch Scan・Keyboardの両方でsettings到達・操作・脱出が可能なこと

---

## 23. Responsive

最初から、mobile portrait（375×667を最重要viewportとする）・tablet（768×1024）・desktop（1280×900）で2 targetが十分離れるレイアウトを設計する（35章、Program設計書12章）。375px幅でも2 targetが重ならず、隣接誤選択が起きない間隔を確保することを前提とする（14章 Layout参照）。

---

## 24. Reduced Motion

motionは補助であり、本質的な情報伝達手段にしない（36章）。`prefers-reduced-motion: reduce`時も、選択結果が色変化・static highlight・音声のいずれかで認識可能なように設計する（Program設計書13章の一般原則を継承）。

---

## 25. Sound / Speech

### Sound
刺激過多を避け、音量・ON/OFF設定を用意する。reduced-motionとは別概念として扱う（27章）。Level3では選択肢そのものが音（楽器音）であるため、選択と同時に音が鳴ることが教材の核心的feedbackとなる——この場合の音は「reinforcement」ではなく選択結果の本体であることを明確にする（Program設計書9章「音の役割を混在させない」原則）。

### Speech
選択後に対象名（例:「りんご」）を短く読み上げる案を検討する（28章）。必須にはしない、TTS ON/OFF設定と連動させる。Gaze教材のため、dwell進行中に長い音声を挟まない（Program設計書9章）。

---

## 26. Assets候補

新規asset要否を調査した結果、以下を推奨する:

**Pilot 3教材（miru-hirogaru/mitsukete-touch/junban-miyou）のような custom PNGキャラクター資産は本教材では新規作成しない。** 理由: (a) 他教材キャラクターの無秩序な流用を避ける原則（26章）、(b) MVPとして早期に検証したい段階でasset制作コストを最小化したい、(c) kurabeyou-app・katachi-awase-appはCSS図形／絵文字ベースの軽量asset方針で十分な学習体験を実現している実績がある。

**推奨方針**: 絵文字またはシンプルなCSS/SVGフラットアイコンによる選択肢表現（kurabeyou-appの`.stimulus-shape`・kimochi-boardの絵文字カードと同系統）。「おもちゃのおへや」世界観に合わせ、パステル調の背景と、丸みを帯びた形状の選択肢表示とする。

必要なasset候補一覧（MVP、Level1/2用の食べ物・動物カテゴリー、Level3用の楽器カテゴリー）:
- 食べ物: りんご・バナナ・いちご・ぶどう（絵文字またはSVGアイコン4種）
- 動物: いぬ・ねこ・うさぎ・くま（絵文字またはSVGアイコン4種）
- 楽器: たいこ・ベル・ピアノ・木琴（絵文字またはSVGアイコン4種、対応する短い効果音4種）
- 背景: 「おもちゃのおへや」パステル背景1種（miru-hirogaru-appとの様式差別化を施したもの、8章参照）

将来拡張候補（本Phaseでは着手しない）: 乗り物カテゴリー、custom illustrationへの置き換え。

---

## 27. Naming（表示名・ファイル名候補）

### 表示名
第一候補: **「どっちがいい？」**（ブリーフ指定、既存教材の命名慣習「おおきい？ちいさい？くらべよう」「どこかな？みーつけた！」等の疑問形パターンと整合する）。

代替候補: 「どっちがすき？」——Primary教育目標（選択・意思表出＝好みの表出）をより直接的に反映する表現。「いい」は一般的な良し悪しの評価に読める余地があるのに対し、「すき」は好み表出という教育目標に語義レベルでより一致する。**正式名称の変更は行わず、User Review Pointとして提示する**（6章の指示どおり）。

### filename候補
`dotchiga-ii-app.html`（既存命名規則`{ローマ字}-app.html`に準拠）。app id候補: `dotchiga-ii`。「どっちがすき？」を採用する場合は`dotchi-ga-suki-app.html`等への変更を検討する。

---

## 28. Implementation Plan（Phase M12-B以降）

1. Phase M12-B: Local Prototype実装（Level1のみ、食べ物・動物カテゴリー、Gaze Shared Foundation・Common Chrome injector・helper6パターンを最初から使用）
2. Phase M12-C: Level2/Level3実装、Settings UI完成、record/CSV実装
3. Phase M12-D: 実機検証（自動検証＋可能であればTobii等実機検証）、Pre-Production Checklist通過
4. Phase M12-E: Release Candidate作成→**User Approval Gate**→承認後、apps-data.json登録・generate.js実行・Production公開

各Phaseの区切りはPilot 3教材のPhase構成（Program設計書16章）を踏襲し、1 Phaseで大きく作り込みすぎない。

---

## 29. apps-data / navigation Inventory

Production公開時に必要になる項目（本Phaseでは実施しない、Inventoryのみ）:
- `apps-data.json`への新規entry追加（id/filename/icon/iconColor/title/category/tags_display/summary/features/steps/lesson/a11y/badges/SEO fields）
- カテゴリー分類の決定（`学習アプリ`／`認知支援`／`自立活動`／`創作表現`のいずれか——本教材は「選択・意思表出」という自立活動的性格が強く、`自立活動`が第一候補。ただしkimochi-boardが同カテゴリーであるため、UI上の並びで両者が近接することも考慮する）
- `app-details/`配下の詳細ページ自動生成（`node generate.js`）
- `sitemap.xml`への自動反映（generate.js実行時に自動）
- `MANUAL_CHANGELOG`への新規公開エントリ追加（Release時のみ、45章）
- index.htmlのアプリカードグリッドへの反映（generate.js管掌）

---

## 30. Release Approval Gate

新規アプリの初回Production公開は必ずUser Approval Gateを通す（43章、New App Standard 48章 Release Policy）。設計Phaseである本Phaseでは公開しない。後続Phaseでも、実装が一定まで進んだ段階でRelease Candidateを作成し、User確認・承認を得てからProductionへ出す（Continuous Releaseの対象外——既存アプリ改善ではなく新規公開のため）。

---

## 31. User Review Points

実装着手前にユーザーへ判断を求めたい項目:

1. **Level構造**: 5章で提案した「経験→好み→因果」の3段階（機能名表記、数値ラベルを主表記にしない）で進めてよいか
2. **Choice Categories**: MVPを食べ物・動物（Level1/2）＋楽器（Level3）とし、乗り物を次点拡張候補、色・感覚を将来検討として保留する方針でよいか
3. **World**: 「おもちゃのおへや」（候補B）を採用し、miru-hirogaru-appとの様式差別化（8章）を行う方針でよいか。あるいは候補C「ふしぎな選択ボード」の方が安全と考えるか
4. **表示名**: 「どっちがいい？」を正式採用するか、代替候補「どっちがすき？」を検討するか
5. **Asset方針**: custom illustrationではなく絵文字/CSS・SVGフラットアイコンによる軽量方針でよいか
6. **Randomization既定値**: 左右入れ替えを既定ONとする方針でよいか、それとも既定OFF（位置固定）が望ましいか
7. **カテゴリー展開の順序**: 本書の推奨（食べ物・動物→楽器）でよいか、それとも異なる優先順位を希望するか

実装後の大きな方向転換を避けるため、上記7点についてはPhase M12-B着手前にユーザー確認を得ることを推奨する。

---

## 32. Phase M12-B: Level1 Local Prototype 実装結果

### 32.1 User承認済み決定事項（31章User Review Pointsへの回答）

- App名: 「どっちがいい？」を正式採用（27章の代替候補「どっちがすき？」は不採用）
- Level構造: 将来的に3構成を維持するが、**本Phaseでは「どっち？」のみ実装**
- Category: 食べ物・動物のみ（音・楽器はM12-C以降）
- World: 5章で推奨した「おもちゃのおへや」（候補B）は**不採用**。miru-hirogaru-appと世界観が近すぎるという判断により、明るくシンプルな「えらべるひろば」（空・草原の床・雲や星の控えめな装飾）を新規採用
- Assets: 絵文字のみの方針は不採用。具体的でシンプルな専用イラスト（本Phaseでは4対象: りんご・バナナ・いぬ・ねこ）を採用する方向へ変更
- Randomization: 左右入れ替えdefault ON、設定からOFF可能——原設計どおり

### 32.2 Asset Inventory調査結果

既存asset（`assets/`配下）を調査した結果、`assets/junban-miyou/passengers/dog.png`・`cat.png`、`assets/mitsukete-touch/dog.png`・`cat.png`、`assets/scratch/dog.png`・`cat.png`が見つかったが、いずれも**再利用しなかった**。理由:
- `mitsukete-touch`のdog/catは「かくれんぼで覗く」構図（下半分のみ描画）で、選択UIの文脈と合わない
- `junban-miyou`のdog/catは緑のバンダナ・青いリュックサック等、「列車に乗る」という別教材固有の物語的装飾を伴っており、そのまま流用すると他教材のキャラクター（と、その世界観）を無秩序に持ち込むことになる（M12-A設計書26章が禁止する事態そのもの）
- りんご・バナナに相当する既存assetは`assets/`配下に一切存在しなかった

適切な既存assetがなかったため、**Phase M12-B独自のplaceholder SVG（りんご・バナナ・いぬ・ねこ、計4種）をインラインで新規作成した**。丸みを帯びた単純な形状・はっきりした輪郭・淡いパステル配色とし、25章のasset visual rulesに沿わせた。ただし**これはPrototype用の暫定illustrationであり、Production最終品質のassetではない**（`dotchiga-ii-app.html`内にもコメントで明記）。将来のPhaseでより作り込んだillustrationへ置き換える余地を残す。

### 32.3 World実装

「えらべるひろば」として、空グラデーション背景・下部の草原（curved top-edge）・控えめな雲2つ・星2つを実装した。miru-hirogaru-appとの差別化のため、配色を暖色（miru）ではなく寒色寄り（青空）とし、世界観の主役はあくまで2つのchoiceとなるよう装飾要素は`pointer-events:none`・低opacity・小サイズに抑えた（17章 Visual hierarchy原則）。

### 32.4 Input Method Tagging: 'switch'は独立した値として扱わない（重要な発見）

実装当初、Switch Scanでの選択を`inputMethod:'switch'`として記録する設計で実装したところ、Keyboard用とSwitch Scan用に**別々のkeydownリスナー**を持つ構成となり、あるchoiceボタンに実DOM focusが残ったままSwitch Scanが有効化されると、同一の物理的なEnterキー押下が両方のリスナーを発火させてしまう不具合を自己発見した（`activateChoice()`自体のisShowingResultガードにより実際の二重ログ・二重feedbackは防がれていたが、`inputMethod`の記録値が不定になっていた）。

原因を`kurabeyou-app.html`の実装で確認したところ、Reference Set / Group B rolloutの確立された規約では、**Switch Scanでの選択もKeyboardでの選択も`inputMethod:'keyboard'`として記録し、'switch'という独立した値は使わない**ことが分かった。これは外部スイッチデバイスがハードウェア的にキーボードEnter/Spaceイベントとして送出される（＝コードレベルでは区別できない、区別する意味がない）ためであり、意図的な設計判断だった。

この規約に合わせ、`activateCurrentScanItem()`を`document.activeElement.click()`という単一実装へ統一し、Switch Scanのcycling自体が実DOM focusを移動させる（`target.focus({preventScroll:true})`）よう変更し、Keyboard用・Switch Scan用のkeydownリスナーを1本へ統合した。この設計変更後、二重発火の問題は解消し、Playwrightで実証確認した。**本節はM12-A原設計（12章 activation model、20章 Keyboard設計）の記述を否定するものではなく、それらを実装レベルで正確化する追記である**——`activateChoice(choiceId, inputMethod)`という単一活性化関数へ全入力方式を合流させるという原則自体は変更していない。29章「record方針」のinputMethod候補も、'switch'を独立枠として扱わず'keyboard'に統合する。

### 32.5 検証結果概要

Playwrightによる自動検証（3本のテストスイート、console/page error 0件）で以下を確認した:
- Touch/Keyboard/Switch Scan/Gaze、いずれの入力方式でも`activateChoice()`を経由し、同一のfeedback・記録経路に到達すること
- Gaze ON かつ Switch Scan ON の同時状態が保持可能（Decision A）で、単一のクリックが1回のみ記録されること（duplicate prevention）
- Gaze dwell完了・entry delay・cooldownが期待どおり機能すること
- randomization ON時に左右順序が変化し、OFF時に固定されること
- 全trial終了後、正答数等の評価的表示なしに完了画面が表示され、「もういちど」で正しくリセットされること
- 設定パネルopen中は`getGazeTargets().length===0`（Gaze isolation）、Escapeで閉じる、閉じた後のフォーカスが可視要素へ復帰すること
- `prefers-reduced-motion:reduce`下でもselected状態（static highlight相当）が適用され続けること
- 375×667〜1280×900の5 viewportすべてで、target enlargement（150%）＋target spacing（wide）を同時に有効化してもhorizontal overflowが発生しないこと（2 choice間のgapは狭いviewportで24px、広いviewportで48px）

### 32.6 Production公開状態

`dotchiga-ii-app.html`は`apps-data.json`に未登録、`generate.js`の処理対象外（`GAZE_SHARED_FOUNDATION_APPS`にも未登録）。sitemap・changelog・app-details・index.htmlのいずれにも反映されていない。Local Prototypeとしてのみ存在し、Production未公開の状態を維持している。

---

## 33. Phase M12-B': Asset / Visual Polish 実装結果

### 33.1 placeholder asset終了

Phase M12-Bで暫定実装したインラインplaceholder SVG 4種（りんご・バナナ・いぬ・ねこ、`ICONS`オブジェクト、`.choice-card svg`ルール）を全て削除した。`.choice-card`内は`<span class="choice-icon">`（innerHTMLへSVG文字列を注入）から`<img class="choice-icon">`（`src`属性へPNGパスを設定）へ置き換えた。教材ロジック（`activateChoice()`・Touch/Gaze/Switch Scan/Keyboard・duplicate prevention・randomization・record・completion・trial flow・settings・hit area・responsive breakpoint・result timing）は一切変更していない。

### 33.2 approved asset方針

User承認済みの高品質PNGイラスト4種（りんご・バナナ・いぬ・ねこ）を採用した。他教材（`junban-miyou`/`mitsukete-touch`/`scratch`のdog/cat）からの流用はPhase M12-B時点で調査済み・不採用と結論済み（32.2節）であり、本Phaseでは新規に用意されたdotchiga-ii専用assetのみを使用した。

### 33.3 asset path

`assets/dotchiga-ii/`配下に新規配置（英数字lowercase命名、既存asset命名規則に準拠、既存assetへの上書きなし）:
- `assets/dotchiga-ii/apple.png`
- `assets/dotchiga-ii/banana.png`
- `assets/dotchiga-ii/dog.png`
- `assets/dotchiga-ii/cat.png`

4ファイルとも1254×1254px、PNG/RGBA。

### 33.4 透過確認

「RGBAだから透過」と推測せず、白・黒・グレー・市松模様・本アプリの空色World背景・赤の6背景へ実際に合成表示して確認した（Playwrightスクリーンショット）。4素材とも市松模様の焼き付き・黒背景の焼き付き・不要な白背景のいずれも検出されず、実透過を確認した。

### 33.5 visual review status

Playwright自動検証（既存の3テストスイートに加え、本Phase用に新規のtransparency合成確認・pair表示確認・regression確認を実施、console/page error 0件）で以下を確認した:
- Touch/Keyboard/Switch Scan/Gaze全入力方式で`activateChoice()`を経由した選択が引き続き機能すること（回帰なし）
- Switch Scan対象は引き続き2件（`choiceA`/`choiceB`のbuttonのみ）で、`img`要素はscan対象・Tab stopのいずれにも追加されていないこと
- Gaze hit-testingは`hitTestGazeTargets()`による`choice-card`のbounding rect基準のままで、画像の可視領域・透過領域に依存していないこと
- randomization ON/OFF、record（`inputMethod`/`pair`等、result/correct列なし）、completion（非評価的表示・restart）、設定パネルのGaze isolation・Escape・フォーカス復帰、`prefers-reduced-motion:reduce`下のselected状態、いずれも既存どおり機能すること
- 375×667／375×812／390×844／768×1024／1280×900の5 viewport、および りんご/バナナ・バナナ/りんご・いぬ/ねこ・ねこ/いぬの4 pair×順序すべてで、耳・バナナ両端・りんごの葉のクリッピングなし、choice-card 2枚のサイズ・shadow・border・brightness・animation状態が選択前は完全に同一であること（Agency維持）
- `.choice-card .choice-icon { object-fit: contain }`により、正方形canvas（1254×1254）内のイラストがカードからはみ出さず、りんご・バナナ・いぬ・ねこ間で極端な visual weight の不均衡は生じないこと（category単位の追加CSSクラスは不要と判断）

文字ラベル（りんご/バナナ/いぬ/ねこ）は、Phase M12-B時点の実装に存在しなかったため、本Phaseでも追加していない。31章の設計方針同様、追加要否はUser Review Pointとして残す。

### 33.6 Production公開状態

`apps-data.json`未登録・`app-intro`未登録・`app-details`未作成・sitemap未登録・changelog追加なし。Phase M12-B'完了時点でもLocal Prototypeのまま、Production非公開を維持している。

---

## 34. Phase M12-C: Level2 / Level3・Settings・Record Expansion 実装結果

### 34.1 3活動の実装

「どっち？」（Level1、既存維持）・「すきなのはどっち？」（Level2、新規）・「どっちにする？」（Level3、新規）の3活動を実装した。UI上の主表記は機能名のみで、「Level」「レベルアップ」等の数値・段階表現は一切使用していない（内部stateの`currentActivity`値（`level1`/`level2`/`level3`）としてのみ残る）。App headerの`<h1>`直下に現在の活動名を表示する`.activity-label`を新設した。

### 34.2 Data-driven Choice / Activity定義

`CHOICES`（choice id → category/label/asset/prototypePlaceholder/sound）と`ACTIVITIES`（activity id → label/categories）のdata定義を新設し、`pairsForCategories()`が同一カテゴリー内の組み合わせのみを機械的に生成する（§23 Pair Rules — 食べ物×動物のような異カテゴリーpairは構造上発生しない）。Level1/Level2は同じcategories（食べ物・動物）を参照するため、pair pool（りんご/バナナ・いぬ/ねこ）は完全に同一——両者の違いはfeedback言語のみに限定されている（34.4節）。

### 34.3 Level3（楽器カテゴリー）とAsset状態

Level3のcategoryは`instrument`（たいこ・ベル）のみ。**たいこ・ベルの正式illustrationは本Phase開始時点で未提供**のため、`CHOICES.drum`/`CHOICES.bell`に`prototypePlaceholder:true`を設定し、`renderChoiceIcon()`が`<img>`へ`src`を設定せず、代わりに`.choice-placeholder`（破線ボーダー・斜線パターン・絵文字🥁/🔔・「プロトタイプ」タグ）を表示する。broken image・空白表示のいずれも発生しない。ピアノ・木琴は本Phaseで未実装（`CHOICES`未定義）——`assets/dotchiga-ii/piano.png`/`xylophone.png`のpath自体もまだ予約していない（drum/bellの2choiceのみが§18の「最低」要件を満たす）。

**→ User Asset Review Required**（§17）: たいこ・ベルの正式illustrationが提供され次第、`CHOICES.drum`/`CHOICES.bell`から`prototypePlaceholder`/`placeholderGlyph`を削除し`asset`パスを追加するだけで済むよう、data-driven構造にしてある。

### 34.4 Level1/2/3のfeedback差分

`activateChoice()`自体は単一のまま（§26 Semantic Activation Architecture、Foundation A）で、結果処理のみ`RESULT_HANDLERS`（`handleLevel1Result`/`handleLevel2Result`/`handleLevel3Result`）へ分離した（§27）。
- Level1: 既存どおり`beep(660,180)` + `speak(label)`
- Level2: 同じ`beep(660,180)`を維持しつつ、`speak(label + ' を えらんだね')`——「好きなんだね」等の断定表現は不使用（§13）
- Level3: `beep()`を鳴らさず、選択されたinstrumentの`sound`（Web Audio、drumは130Hz triangle、bellは1180Hz sine、いずれも220–260ms・gain 0.22）を選択結果そのものとして再生し、220ms後に`speak(label)`を呼ぶ（§18/§21、音とTTSの重なり回避）。ブラウザVUで生成したtoneであり、楽器の実音を装ってはいない。

### 34.5 Activity切替とcleanup

`switchActivity(newId)`を新設し、trialIndex reset・`pendingTrialTimeout`のclearTimeout（新規追加した変数——**旧実装は次trialへの`setTimeout`をどこにも保持しておらず、フィードバック表示中に活動を切り替えると、切替後に旧活動のpairで`startTrial()`が呼ばれてしまう実バグが存在した**。本Phaseで発見し修正）・selected classの除去・`clearGazeCandidateState()`（dwell state + leave-and-reenter gate）のリセット・`updateActivityLabel()`・`startTrial()`・（scanMode時）`startSwitchScan()`再起動を行う。Playwrightで「選択直後（isShowingResult中）に活動切替」を明示的に再現し、旧activityのtrialが紛れ込まないことを確認した（34.9節）。

### 34.6 Activity Selector UI

設定パネル内「あそび」グループの先頭に、3つの活動を切り替えるボタン群（`.activity-btn`、`aria-pressed`で選択状態を表現、`.count-btn`と同じ視覚言語のpillボタン）を配置した。支援者・教員が開いて選ぶ想定のため、子ども向けの巨大な選択画面は作らず、既存の非modal設定パネルへ統合した。

### 34.7 Settings グループ化

既存の視線入力サブグループ構造（Gaze Standard §15.2の4群: 視線入力／選択／見やすさ・操作しやすさ／動き）はそのまま維持し、その外側にトップレベルの4グループ「あそび」（活動＋えらぶかいすう）／「おと・ひょうじ」（おと・こえ・うごき・ひだりみぎ）／「しせん」（Gaze、既存構造を包含）／「スイッチ」（Switch Scan）／「きろく」（記録UI、34.8節）を`.setting-group-title`で追加した。既存のGaze/Switch Scan設定項目・値・挙動は一切変更していない。

### 34.8 Record拡張

**記録フィールド**: `activity`・`category`を新規追加。`dwellDuration`は元設計（§20）に定義されていたが実装時に欠落していたことが判明したため、本Phaseで追加した（gaze選択時のみ実測値、他入力方式は`null`）。`result`/`correct`列は引き続き設けていない。

**記録UI**: 既存アプリ（`kurabeyou-app.html`）の設定パネル内蔵型record UIパターンを踏襲し、新規UIを発明しなかった（§38）。設定パネル「きろく」グループに、新しい順の一覧（`もっと みる`でページング）・CSV出力・全削除を実装。削除は`kurabeyou-app.html`と同じ「2段階のインラインconfirm」方式（ネイティブ`confirm()`は不使用、キャンセルで元に戻る）。CSVはUTF-8 BOM付き、`buildRecordsCsvRows()`が保存済みlogのみから構築（DOM由来ではない、New App Development Standard §26準拠）、ファイル名は`dotchiga-ii-kiroku-YYYY-MM-DD.csv`（`kurabeyou-records-YYYY-MM-DD.csv`と同型）。一覧に表示するのは日時・活動・えらんだもの・入力方式の4列のみ（§39、好み度・診断ラベルは一切表示しない）。

design doc §38が求めた「既存patternを探す」調査の結果、New App Development Standard §24（record detail UIの1:1 binding要件）は該当なし——本UIは1行1レコードのシンプルな一覧のみで、展開式detail toggleを持たないため、closure bugリスクの生じる構造そのものを採用していない。

### 34.9 検証結果概要

Playwright自動検証（新規テストスイート、console/page error 0件）で以下を確認した:
- Level1: 既存M12-B/B' regression全項目（Touch/Keyboard/Switch Scan/Gaze/duplicate prevention/randomization/settings isolation/reduced-motion/responsive）に回帰なし
- Level2: pair poolがLevel1と完全一致、feedback文言が「を えらんだね」（断定なし）、record に`activity:'level2'`
- Level3: instrument pairが選択可能、`prototypePlaceholder`のchoiceが`<img>`をhidden化し`.choice-placeholder`を表示、選択時に`beep()`ではなくinstrument toneが再生され220ms後にTTS、record に`activity:'level3'`/`category:'instrument'`
- Activity切替（実際のbutton clickおよび直接呼び出し双方）: `aria-pressed`同期、placeholderと実assetの往復表示切替、フィードバック表示中の切替でも古いtrialが紛れ込まないこと（34.5節のバグ修正の実証）
- Cross-Level入力方式: Level3でのGaze dwell選択・Level2でのSwitch Scan選択、いずれも`activateChoice()`経由・同一のduplicate prevention・inputMethod正記録を確認
- Record UI: 一覧表示・CSVダウンロード（実際の`download`イベント発火・ファイル名確認）・削除の2段階confirm（キャンセルでデータ保持／確定で削除）
- 設定パネルopen中の`getGazeTargets().length===0`/`buildScanItems().length===0`はrecord UI追加後も維持（record UIを別panelにせず既存settings-panel内へ統合したため、既存isolationロジックがそのまま適用される）
- 375×667〜1280×900でLevel3のcard・placeholderにクリッピングなし（§46）

### 34.10 Production公開状態

`apps-data.json`未登録・`generate.js`対象外・sitemap/changelog未追加。Phase M12-C完了時点でもLocal Prototypeのまま、Production非公開を維持している。
