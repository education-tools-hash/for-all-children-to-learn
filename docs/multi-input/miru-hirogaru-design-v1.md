# 「みるとひろがる」個別設計 v1.2（Phase M1〜M8）

- 版: v1.2（v1.1にPhase M8 Engagement Redesign（Visual Asset Integration、30章）を追加。Phase M2〜M2.1の内容は変更なし）
- 位置づけ: `docs/multi-input/multi-input-program-design-v1.md`（Program共通設計、Phase M0）の下位文書。Program共通方針（Touch/Gaze/Switch/Keyboard対等設計、success-only可、canonical/transient分離等）を継承する。
- Production: `miru-hirogaru-app.html`はfeature/miru-hirogaru-mvp branch上に実装済みだが、mainへ未統合・Production未公開（Release Approval Gate、User Review待ち）。generate.js/apps-data.json/changelogはいずれも未変更。
- Pilot: Multi-Input Programの共通Input Adapterを最初にPilotするアプリ（M0 15章で決定）。`activateTarget(targetId, inputMethod)`としてアプリ内Pilot実装済み。

---

## 1. 学習目標（一文定義）

> 自分の働きかけによって画面に変化が起こることに気づき、見る・触れる・スイッチを押すなどの行動と結果のつながりを経験する。

M0で提示された候補をそのまま採用する。この一文は「正しく操作できること」ではなく「行動と結果のつながりに気づくこと」を目的として明記しており、success-only設計（24章）と直接対応する。

## 2. Semantic Goal

**子どもが対象へ働きかける → 世界が変化する。**

Gaze専用教材にはしない。Touch/Gaze/Switch/Keyboardいずれの入力でも同一のsemantic activationへ合流させる（Program共通のInput Adapter原則、M0 7章）。

---

## 3. Level構成（正式案）

| Level | 目的 | target数 | 配置 | 正誤モデル |
|---|---|---|---|---|
| Level1 | 反応: 見る/触れる/押すと変化が起こるという因果関係への気づき | 1 | 画面中央 | mistakeなし（success-only） |
| Level2 | 選択: 自分が注目したものへ働きかける選好の芽生え | 2 | 左右 | mistakeなし（success-only） |
| Level3 | 注意移動: 複数対象への働きかけ、注意の移動 | 3（静止） | 均等配置（例: 上/左下/右下、または横並び） | mistakeなし（success-only） |

「反応→選択→注意移動」の段階性を保ち、Program共通の学習発展系列（M0 3章）のミニチュア版として構成する。

### 3.1 正誤モデル（24章の判断）
**Level1〜3すべてでmistakeを設けない。** この教材全体を **success-only learning** として設計する。理由：
- M0承認事項によりLevel1はmistakeなし確定済み
- Level2は「どちらへ働きかけるか」という選好観察が目的であり、どちらを選んでも学習的に意味がある（選ばなかった方を「間違い」として扱う必然性がない）
- Level3も同様に「気づいて働きかけたtarget」を記録する設計であり、distractor概念を導入していない（「みつけてタッチ」で導入するdistractor/mistakeモデルとの役割分担をM0 3章の通り維持する）

### 3.2 Level3: 静止 vs 移動（21-22章の判断）
**静止3targetを先に実装する。** Moving targetはgaze hit test・Switch Scanのhighlight追従・reduced motion対応・motion sensitivity（55章）への影響が大きく、Pilotアプリの最初のスコープには含めない。M2の非対象として明記する（66章）。

---

## 4. Level1 刺激・feedback設計

### 4.1 刺激の比較（3案）

| 案 | 内容 | 評価 |
|---|---|---|
| A. Expansion | targetが大きく広がる | シンプルで実装しやすいが、アプリ名「ひろがる」との結びつきがやや弱い |
| B. Color spreading | targetから色が画面へ広がる | アプリ名と最も一致する。実装コストはA・Cよりやや高い（クリップパスやradial-gradientのtransition等） |
| C. Glow + soft sound | targetが光る＋やさしい音 | 単体では「ひろがる」感が弱い。Bとの組み合わせで補強要素として使える |

### 4.2 推奨（11-12章）
**B（color spreading）を主軸とし、Cの要素（soft sound）を組み合わせる。** targetを起点に、円形または柔らかい形状の色面がtargetの外側へ緩やかに広がる演出を教材の視覚的アイデンティティとする（12章の「広がる」の意味を単なる点滅と区別する要請に対応）。実装上は、target要素とは別に「広がる」ための背景レイヤー（例: 疑似要素やCSS `transform: scale()` + `opacity`フェード）を用意し、target自体の大きさは変えない（hit areaを変化させない、Phase26で確立した「hit areaは縮小・変化させない」原則を踏襲）。

### 4.3 Feedback duration（13章）
**900msを推奨初期値とする。** 600msは短すぎ「結果を見る時間」が不足するおそれがあり、1200〜1500msは次の操作までの待ち時間が長くなりすぎる。900msはdwell時間（900ms）と揃えることで実装・体感双方の一貫性も得られる。ただし最終値はRendered Validation（実際のanimation速度を見ながらの調整）で微調整可能とする。

### 4.4 Re-trigger / Cooldown（14-15章）
Level1は**繰り返しactivation可能**を第一候補とする（因果関係形成には反復体験が重要なため）。連続activation時の重複feedbackを避けるため、feedback再生中（900ms間）は新たなactivationを受け付けない**cooldown = feedback durationと同一（900ms）**とする。これはGazeのre-trigger方式（34章）とも整合させる。

---

## 5. Level2 設計

### 5.1 配置（17章）
**左右配置を第一候補とする。** 理由: 375×667の縦長画面では上下配置よりも左右配置の方がtarget間の距離を確保しやすく、Gaze hit testの誤認識（隣接targetへの意図しないdwell移行）を避けやすい。Switch Scanでも左右2択は最も単純な提示順序（左→右）を取れる。

### 5.2 視覚差（18章）
**色・形の両方を異ならせる。** 目的は「正しく選ぶ」ことではなく「自分が注目したものに働きかける」ことなので、正誤に紐づく手がかり設計（Phase26のkatachi-awase-appにおける「色と学習ロジックを対応させない」原則）は本教材には適用されない——むしろ両方を変えることで、視覚的に区別しやすく、どちらへの反応かを観察・記録しやすくする。

### 5.3 Records（19章）
選んだ方を「正解」ではなく **target choice**（観察値）として記録する。CSVやRecords UI上でも「せいかい/まちがい」のような正誤ラベルは使わず、「どのtargetへ反応したか」を中立的に記録する（後述9章）。

---

## 6. Level3 設計

3targetを均等配置し、静止状態で提示する。目的は複数対象への気づきと注意の移動であり、シーケンス（順序）は要求しない——「じゅんばんにみよう」との役割分離（M0 3章）を維持するため、提示順や正解順は設定しない。3つのうちどれに反応したか、複数に反応したかを観察値として記録する。

---

## 7. Semantic Activation API（Pilot具体設計）

```js
function activateTarget(targetId, inputMethod) {
  // 1. target存在確認: targetId が現在のcanonical state上に存在し、かつ未completed（Level1は
  //    completed概念を持たない＝常にactivation可能。Level2/3も「1回選んだら終わり」にはしない
  //    ——success-onlyでは「やり直し」を制限する理由がないため）
  // 2. active判定: 現在 activationLock 中でないか、直前のfeedbackが再生中でないかを確認
  // 3. activationLock 開始（8章参照、推奨300ms）
  // 4. feedback開始（900ms color-spreading + sound）
  // 5. record（9章の最小仕様に従い1件記録）
  // 6. next state: Level1/2/3とも「次のtargetへ進む」概念を持たない（自由反応型、53章参照）。
  //    feedback終了後はcooldownを解除し、再びactivation可能な状態へ戻る。
}
```

Program共通のAPI形状（`activateTarget(targetId, inputMethod)`）をそのまま採用し、教材固有ロジック（feedback内容、record内容）はこの関数の内側にカプセル化する。

---

## 8. Activation Lock（推奨値）

**300msを推奨初期値とする。** 500msでは連続操作を試したい子どもにとってやや長く感じられる可能性があり、300msは「同一物理入力の重複検知（例: touchstartとtouchendが近接して2イベント発火する等）」を防ぐのに十分な短さである。activationLock終了後もfeedback自体（900ms）は継続しているため、実質的な「次のactivationまでの間隔」はactivationLock(300ms)ではなくcooldown(4.4章、feedback durationと同一の900ms)によって決まる——activationLockは「同時多発的な複数入力の重複」対策、cooldownは「feedback表示中の意図的な連続操作」対策、という役割分担にする。

---

## 9. Records 最小仕様

### 9.1 記録項目（45章）
- timestamp
- level
- target（Level2/3のみ意味を持つ。Level1は常に単一targetなので固定値または省略）
- inputMethod
- responseTime
- dwellDuration（Gaze activation時のみ）
- activationCount（session内の累積回数）

sessionIdは必要に応じて追加可能とするが、M1の最小実装では見送る（過剰な記録項目を避けるM0方針、11.4章）。

### 9.2 responseTime定義（46章）
trial（=対象が新たに提示された、またはfeedbackが終わり再度activation可能になった）時点から、semantic activationが発生した時点までの時間とする。Level1は繰り返しactivation可能なため、trial境界は「直前のcooldown解除時点」とする。

### 9.3 dwellDuration（47章）
Gaze activation時のみ保存する。900ms固定値であっても、jitter許容やtransition guardの影響で実測値が変動しうるため、**実測値を保存する価値がある**と判断し、実測値をそのまま記録する。Touch/Switch/Keyboardでは空欄。

### 9.4 activationCount（48章）
session全体の累積回数を基本とする。Level2/3ではtarget別の内訳も取得可能な設計にしておくが、アプリ自体はこれを「好み」として解釈・表示しない（観察データの提供に留める、M0 11.1章の原則）。

### 9.5 target choice（49章）
Level2/3で、どのtargetがactivationされたかを単なる観察値として記録する（5.3章参照）。

### 9.6 Session Summary（50章）
Records UI最小表示案：
- Level
- 活動時間（session開始〜終了の実時間）
- 反応回数（activationCount）
- 主な入力方法（session内で最も使われたinputMethod）

「理解度」「達成度」等の評価的表現は一切出さない。

### 9.7 CSV最小列案（51章）
`date, level, target, inputMethod, responseTime, dwellDuration, activationCount`（+ 必要に応じて `sessionId`）。既存教材（かたちをあわせよう12列、くらべよう16列）と比べても十分に少なく、過剰増加を避けるM0方針と整合する。

---

## 10. Completion / Session設計

### 10.1 従来の問題数モデルとの違い（52-53章）
「3問/5問/10問」を機械的に持ち込まない。Level1〜3はいずれも自由反応型（正解に到達したら次の問題、という進行を持たない）であるため、**回数または時間で活動を区切る**方式を採用する。

### 10.2 推奨終了方式（52章）
第一候補: **支援者が任意のタイミングで終了できる（明示的な終了操作）** ことを必須とし、加えて **10回activationで自然終了を提案する** ソフトな区切りを補助的に用意する。「5回」は短すぎ因果関係形成の反復体験が不足するおそれがあり、「10回」を推奨初期値とする。ただし固定回数での強制終了はせず、あくまで「そろそろ終わりにしますか」という提案に留める（重度児の活動ペースは個人差が大きいため）。

### 10.3 想定セッション長（54章）
1〜3分程度を想定する前提で画面設計・feedback速度を検討する（重度児向けの短時間利用を想定するというM0方針に基づく）。ただし時間による強制終了は設けない（10.2章と同様の理由）。

---

## 11. Target Visual / Size / Background / Color

### 11.1 Target Shape（25章）
circle（単純な円）を第一候補とする。star・simple blobは視覚的に複雑になりやすく、初回実装ではcircleに統一し、将来的なバリエーション追加の余地を残す。

### 11.2 Target Size（26章、実装時Rendered Validation必須）
- Level1: 160〜220px相当（375×667で画面中央に大きく配置できる範囲）
- Level2: 120〜160px × 2
- Level3: 90〜130px × 3

これらは初期値の目安であり、実装時に375×667を含む5viewportでのRendered Validation（overflow・overlap確認）を経て確定する。

### 11.3 Background（27章）
soft neutral（既存Design Systemの`--dm-color-bg`相当、Phase26-Hで使用した#FAF7F2系）を第一候補とする。feedback（色が広がる演出）とのコントラストを確保しやすく、既存Design Systemとの整合も高い。

### 11.4 Color（28章）
targetおよびfeedback色は強い原色のみで構成せず、Design Systemの既存パステル/プライマリカラーから選定する。背景との十分なコントラストは高コントラストモード（59章）を含めて別途確認する。

---

## 12. Sound / TTS

### 12.1 Sound（29章）
activation時に**短く・やさしい音**を標準候補とする。音がなくても学習が成立することを必須要件とし、ミュート設定（既存Design Systemの共通設定）との整合を確認する。

### 12.2 TTS（30章）
Level1で毎回「みたね」等を読み上げる必要はない。過剰な言語刺激を避け、必要であればtarget label程度（例: Level2/3でtargetを区別する必要が生じた場合のみ）に留める。M1のMVPではTTSなしを基本とし、必要性が実装後に確認された場合に追加を検討する。

---

## 13. Gaze設計

### 13.1 Dwell UI（31章）
900ms dwell中の進行表示として **radial progress（円形の進行リング）** を推奨する。既存2教材にはgaze dwell UIの前例が薄いため、シンプルで視認性の高いradial progressをPhase26のdesign tokenを流用して実装する。

### 13.2 Jitter許容（32章）
視線がtarget bounding box内で数pxぶれる場合は即resetしない。bounding box内での揺れはdwell継続として扱う。

### 13.3 Transition Guard（33章）
target AからBへ移動した場合、Bでは新規に900msのdwellを必須とする。古いdwell進捗は持ち越さない。

### 13.4 Gaze Re-trigger（34章）
**activation → feedback → 視線がtargetを離れる → 再度targetに入る → 新規dwell開始**、という方式を推奨する。視線を外さずに見続けているだけでfeedbackが連続自動発火し続けることは避ける——これはLevel1の「繰り返し可能」（14章）と矛盾しない。「繰り返し可能」は"何度でも再activationできる"という意味であり、"見続けるだけで無限に自動発火する"という意味ではない。視線を一度外して戻す、というひと呼吸の動作を挟むことで、意図的な反復と偶発的な凝視を区別する。

---

## 14. Touch設計（35章）

tapで即activation。touchstart時点での軽いpreview feedback（例: targetがわずかに縮む/明るくなる程度）を推奨する——押した実感を即座に返すことで、重度児にとって「押せた」ことの手がかりになる。誤スワイプ対策として、touchstart座標からtouchend座標までの移動量が一定閾値（例: 既存教材のDRAG_THRESHOLD_PXと同様の8px程度）を超えた場合はactivationとして扱わない。dragは不要。

---

## 15. Switch Scan設計

### 15.1 Level1（36章）
**Direct Activation方式を推奨する。** target1個の場面でAuto Scanを回す意味は薄く、switch press = 即activationとする方がシンプルで、子どもにとっても「押せば起きる」という直接的な因果関係が伝わりやすい。

### 15.2 Level2/3（36章）
Auto Scanを使用する。

### 15.3 Scan Interval（37章）
**1500msを推奨初期値とする。** 1200msは重度児にとってやや速く、2000msは1回のscan一周にかかる時間が長くなりすぎる（Level3で3target×2000ms=6秒/周）おそれがある。1500msを中間値として初期採用し、実装後の検証で調整可能とする。

### 15.4 Scan Pause（38章）
activation後、feedback中（900ms）はscanを停止する。feedback終了後、**scanは最初のtargetから再開する**（「activationした次から」再開すると、次にscanされるtargetが子どもにとって予測しづらくなるため、常に同じ開始点に戻る方が一貫性がある）。

### 15.5 Scan Highlight（39章）
色だけに依存せず、outline + scaleの併用を推奨する（高コントラストモードでも判別できるようにするため、Phase26のSwitch Scan実装パターンを踏襲）。

### 15.6 One/Two-Switch（40章）
M1初回実装は**one-switch中心**とする。two-switchは設計上（scan制御ロジックの抽象化）拡張可能にしておくが、実装対象には含めない。

---

## 16. Keyboard設計

Tab→Enter/Spaceでactivation。開発・検証・支援者操作用として維持する（Program共通方針、M0 8.4章）。

---

## 17. Input Conflict（41章）

feedback phase中（activation直後の900ms）は、いかなる入力方式からの新規activationも無視する。これはactivationLock（300ms、8章）より長い区間をカバーするため、実質的にfeedback phase中の判定がconflict防止の主たる仕組みとなる。activationLockは主に「同一瞬間に複数入力が同時到達した場合」の重複防止、feedback phase中の無視は「feedback表示中の入力全般」の防止、という二段構えにする。

---

## 18. Phase / State設計

### 18.1 Phase State（42章）
`ready`（activation可能）→ `feedback`（activation直後、900ms）→ `ready`に戻る、のシンプルな2相構造とする。`dwelling`（Gaze dwell進行中）と`cooldown`はtransient stateとして扱い、canonical phaseには含めない（cooldownはfeedback phaseと期間が一致するため実質的に統合される、4.4章参照）。

### 18.2 Canonical State（43章）

```js
{
  level,              // 1 | 2 | 3
  phase,              // 'ready' | 'feedback'
  activeTargetId,      // feedback中のみ値を持つ。ready中はnull
  activationCount,     // session内累積
  trialIndex,          // 本教材では「反応の連番」程度の意味（従来の問題番号とは異なる）
  sessionStart
}
```

### 18.3 Transient State（44章）

```js
{
  gazeTargetId,       // 現在dwell中のtargetId
  gazeStartedAt,       // dwell開始時刻
  dwellProgress,       // 0-1
  scanIndex,           // Auto Scan中のハイライト位置
  scanTimer,           // scanのタイマーハンドル
  inputLock,           // activationLock中かどうか（8章）
  feedbackTimer        // feedback phase終了タイマー
}
```

---

## 19. Reduced Motion / High Contrast / Visual Safety

### 19.1 Reduced Motion（58章）
通常時は「広がる」animation（4.1-4.2章のcolor spreading）。reduced-motion設定時は、瞬時のcolor change（fadeなしの即時切り替え、または200ms程度の短いfade）へ代替する。「何も起きない」状態には絶対にしない——本教材の学習目標そのものが「行動と結果のつながり」であるため、reduced-motionでも結果が視認できることは必須要件とする。

### 19.2 High Contrast（59章）
targetとbackgroundの区別を維持し、feedbackが色変化だけに依存しないようにする（形状変化やoutlineの併用、15.5章のscan highlightと同様の考え方）。

### 19.3 Visual Feedback Safety（57章）
高速flash・強い点滅・突然の大音量・激しい画面揺れを禁止する。4.2章のcolor spreadingは緩やかな遷移（900msかけたゆるやかな変化）であり、この禁止事項に抵触しない設計とする。

---

## 20. 375×667 Layout構造案

```
┌─────────────────────────┐
│ 🏠 🔒 ⛶      みるとひろがる │ ← common chrome + title
├─────────────────────────┤
│  Level: [1] [2] [3]      │ ← level selector（既存教材の.level-rowパターンを流用）
├─────────────────────────┤
│                          │
│                          │
│      [ target(s) ]       │ ← target area。Level1は画面中央に最大化、
│                          │    Level2/3は左右/均等配置
│                          │
│                          │
├─────────────────────────┤
│      ⚙ (settings)        │ ← common chrome（既存パターン踏襲）
└─────────────────────────┘
```

Level1ではlevel selector以外の要素を最小化し、target areaを最大限確保する（Large Target Principle、M0 12章）。既存教材のconcept-row/level-row/count-rowパターンのうち、本教材はLevel selectorのみを持ち、count-row（問題数選択）は持たない（10.1章の通り、回数・時間ベースの区切りを採用するため）。

---

## 21. Common Chrome（61章）

home/settings/fullscreen/accessibilityは既存教材と同じ共通chromeパターンをそのまま踏襲し、target areaを圧迫しない配置とする（既存標準8章準拠）。

---

## 22. App Description（62章）

支援者向け一文説明（app-intro/app-details用案）：

> 見る・触れる・スイッチを押すと画面が広がって変化する、初期的な因果関係を楽しむ教材です。

M0の候補文をそのまま採用する。

---

## 23. Naming / Filename（63章）

正式名: **みるとひろがる**
filename: **`miru-hirogaru-app.html`**（M0で提案した候補をそのまま確定候補とする。既存命名規則`{ローマ字}-app.html`と一致）

---

## 24. Icon Direction（64章、画像生成なし）

候補: 中心から小さな光が外側へ大きく広がるモチーフ、または同心円が段階的に広がる様子。教材の中心feedback（color spreading）と視覚的に一致させる。

---

## 25. M2 実装スコープ（65章）

### 25.1 M2で実装するもの（MVP）
- Level1〜3（静止target、success-only）
- Touch / Gaze(dwell 900ms固定) / Switch(Auto Scan, one-switch) / Keyboardの4入力
- Semantic Activation API（`activateTarget`）のアプリ内Pilot実装
- Color spreading feedback + soft sound（ミュート可）
- Records最小仕様（9章）+ CSV最小列（9.7章）
- 375×667を含む5viewport対応
- Reduced motion / High contrast対応
- 支援者による明示的終了 + 10回activationのソフト終了提案

### 25.2 M2で実装しないもの（66章）
- Moving target（Level3は静止のみ）
- Sensory 3段階設定（しずか/ふつう/にぎやか）
- Manual Scan / Two-switch
- Custom dwell時間設定（600/1200ms等の切り替えUI）
- Advanced preference analytics（target選好の分析・可視化機能）
- TTS（必要性確認まで見送り）

---

## 26. Common Input Adapter Pilot方針（67章）

**アプリ内Pilot（M0推奨方針を踏襲）。** `activateTarget()`をこの1本の中に実装し、shared JSとしての切り出しはM4（みつけてタッチ）着手時に再検証する（M0 15章のPhase構成方針と一致）。

---

## 27. Release Gate（68章）

新規アプリにつき、Implementation → Validation → User Review → Explicit Approval → Releaseを必須とする。M1では設計のみでありProduction変更は一切行わない。

---

## 28. M2実装確定事項（Phase M2/M2.1、ユーザー承認済み）

M1時点の12件の残存論点は、Phase M2実装・Phase M2.1のUser Reviewを経て以下の通りすべて確定した（`miru-hirogaru-app.html`実装済み）。

1. **Level1 feedback方式**: color spreading（`.mh-spread`、900ms ease-outスケール＋フェード）＋soft sound（Web Audio API、660→880Hz、約180ms）の組み合わせで確定。
2. **feedback duration**: 900msで確定。
3. **Level2左右/上下**: 左右配置で確定。teal circle（左・ひだり）／orange square（右・みぎ）の色形両方の差別化で実装。
4. **Level3静止/移動**: 静止3target（circle/square/triangle、横並び）でM2スコープ確定。moving targetはM2非対象のまま。
5. **success-onlyを全Level維持するか**: Level1〜3すべてmistake概念なしで確定・実装（`activateTarget()`にfailure分岐は存在しない）。
6. **activation lock**: 300msで確定。
7. **Switch interval**: 1500ms固定（設定UIなし）で確定。
8. **Level1 direct switch**: Level1のみDirect Activation（scan cycle無し、switch press即activation）、Level2/3はAuto Scanで確定・実装。
9. **session終了方式**: 支援者による明示的終了（既存共通home/lockボタン）＋10回activationごとのソフト完了メッセージ（「たくさんできたね！つづけてあそべます」、4秒で自動消去、強制終了なし）で確定。
10. **sound/TTS**: soundあり（ミュート可、既定ON）・TTSなしでMVP確定。
11. **records最小項目**: 9.1章の7項目（timestamp/level/target/inputMethod/responseTime/dwellDuration/activationCount）のまま確定、CSV列も同一。
12. **M2 MVP範囲**: 25章のスコープ通り実装完了（moving target/sensory3段階/manual scan/two-switch/custom dwell設定/preference analytics/TTSは非対象のまま）。

### 実測確定値（Rendered Validation済み）
- Target size: Level1 168px（375px以下）/200px、Level2 128px/140px×2、Level3 96px/110px×3
- Colors: circle=`#00A99D`（primary）、square=`#F5A623`（accent）、triangle=`#4A8FD9`（info）——いずれも既存Design System色
- Background: `#FAF7F2`

### Phase M2.1: Gaze × Switch Scan 視覚的共存の確認・修正
Gaze dwell ring（`.mh-target-ring`、inset:-8px）とSwitch Scan highlight（`.mh-target.scan-focus`、当初outline-offset:6px）が同時ONの状態で、両者の描画帯がほぼ同じ半径に重なり視覚的に区別しにくいことが実機検証で判明した。**Switch Scan outlineのoutline-offsetを6px→14pxへ変更**し、target本体→gaze進行リング（内側）→Switch Scanハイライト（外側、明確な間隔あり）の3層が同心円として明確に分離されることを確認（375×667を含む5viewport、high contrast、reduced motionいずれも確認済み）。Level1はDirect Activationのため、両方ON時でもLevel1のtarget自体にはSwitch Scanのoutlineは表示されない（scan cycleが存在しないため）ことも確認した。

---

## 30. Phase M8: Engagement Redesign（Visual Asset Integration）

Phase M2/M2.1で確定した「circle/square/triangleの図形target」を、**Technical PASSはできてもEngagement（かわいい・触りたい・また遊びたい）が成立していない**という課題意識から、イラストのおもちゃアセットへ全面刷新した。学習目標（1章）・Semantic Activation APIの外形（7章）・Records哲学（9章）は変更しない。作業はworktree `for-all-children-to-learn-m8` / branch `feature/miru-hirogaru-engagement-refresh`（`main`から分岐、`aacf4cf`）上で行い、**本Phaseの終了時点でmain統合・push・Production公開は一切行わない**（Local RCまで、27章のRelease Gateに従いUser Review待ちで停止）。

### 30.1 世界観
「おとのなる ふしぎなおもちゃのへや」。明るいパステル調のおもちゃ部屋を背景とし、通常時は静か（背景・おもちゃとも無音・無動作）。子どもの働きかけ（Touch/Gaze/Switch/Keyboard）に対し、おもちゃが動き、表情が変わり、短い音とキラキラ・音符エフェクトで応答する。Semantic Goal（2章）「子どもが対象へ働きかける → 世界が変化する」をより具体的な情動体験へ翻訳したものであり、Semantic Goal自体は変更していない。

### 30.2 6種のおもちゃ（Visual Source of Truth）
ユーザー提供の参照画像（6列×2行、ready/active各状態）から抽出: たいこ(drum) / ミニピアノ(piano) / ベル(bell) / びっくり箱(jackbox) / くまのぬいぐるみ(bear) / きしゃ(train)。いずれもパステル・丸み・グロス感・大きな瞳・白ハイライト・頬の赤みという「みつけてタッチ」と共通のVisual Family（M6.2の資産分離原則を継承）で統一されている。Active状態は「同じおもちゃが応答している」と読み取れることを維持しつつ、動き（例: たいこがはねる、ピアノの鍵盤が押される、ベルが揺れる、びっくり箱からぬいぐるみが飛び出す、くまが手を振る、きしゃが前後に動く）・表情変化・キラキラ/音符を新たに追加した状態として作られている。

### 30.3 アセット方式（資産/意味分離、M6.2原則の踏襲）
PNG（12枚、`assets/miru-hirogaru/{drum,piano,bell,jackbox,bear,train}-{ready,active}.png`）。ready/active状態は`<img src>`の差し替えで切り替える（レイヤー合成ではない）。外部CDNなし、リポジトリ内格納。各トイのready/active bboxのunion+marginを共通crop boxとして両状態へ同一適用することで、状態切り替え時に絵の位置が動かないことを保証した。抽出時にpiano→bellのセル境界にじみ（隣接セルの色が混入）を発見・`MIN_LEFT_OVERRIDE`で除去、また連結成分解析による小さな浮遊スペックの除去を全12枚に適用済み——低品質なまま採用していない。

### 30.4 Level再設計
既存のLevel1/2/3の目的（3章: 反応/選択/注意移動）は変更せず、静止3章・success-only（3.1章）もそのまま維持。target実装を図形からTOYSベースへ全面差し替えた。

- **Level1「ならしてみよう！」**: 6種からランダムに1体を中央・大サイズで提示（直前と同じおもちゃの連続提示は回避）。目的は選択課題ではなく「働きかけたら楽しいことが起きた」という単一体験。
- **Level2「どっちを ならす？」**: 6種から重複なしで2体を左右提示。「どちらも正解」を維持（5.3章のtarget choice記録方針は変更なし）。
- **Level3「おへやを にぎやかにしよう！」**: 6種から重複なしで3体を提示。**このLevelのみ、activateItemがcanonicalに`item.activated`を持続させる**（Level1/2はfeedback後に必ずreadyへ戻る一過性のtransient挙動のまま）。1体を鳴らしても他の2体はそのまま操作可能で、全3体がactivated状態になった時点で「わあ！おへやが にぎやかになった！」というソフトな完了メッセージ（4秒で自動消去、強制終了なし——28章9番の既存パターンを踏襲）を表示し、`ROOM_COMPLETE_PAUSE_MS`（1400ms）後に新しい3体の部屋を開始する。Level3はアプリ名「みるとひろがる」（見ると部屋がひろがる＝にぎやかになる）を最も象徴するLevelとして設計した。

### 30.5 Level3レイアウト（375×667優先、2+1段組）
3体を横一列に収めると窮屈になるため、「上段2体＋下段中央1体」の段組を採用。実装は当初CSS Flexboxの`flex-basis:100%`で3体目を折り返す方式を試みたが、`flex-basis`がbutton要素自身の`width`指定を上書きしてしまい3体目の画像が画面幅いっぱいに巨大化する不具合が発生した。**CSS Gridへ変更**（`display:grid; grid-template-columns:repeat(2,max-content); justify-content:center`、3体目のみ`grid-column:1/3; justify-self:center`）することで、折り返した要素が自身の`width`を保ったまま2カラム分の中央に配置される構成へ修正し、375×667を含む5viewportで問題なく描画されることを確認した（30.9章）。

### 30.6 SFX設計（BGMなし）
1トイあたり0.2〜0.8秒の短いWeb Audio合成音（`tone()`=オシレータ+指数減衰エンベロープ、`noiseBurst()`=フィルタ済みノイズバースト）を1〜3イベント組み合わせ、6種それぞれに異なる音色を割り当てた（例: たいこ=低く柔らかいsine+ノイズバースト、ピアノ=2音の軽いアルペジオ、ベル=高いsine2本の弱い刺激音、びっくり箱=短いピッチグライド、くま=2音の柔らかいsine、きしゃ=ノイズバースト+低いsine2発の汽笛風）。音量は突発的な大音量にならないよう抑え、Sound OFF時は`playToySfx()`冒頭で完全に処理を打ち切る（Web Audioノードが一切生成されないことをPlaywrightで確認済み、30.9章）。

**BGMは本Phaseで意図的に追加していない。** これは「どこかな？みーつけた！」のPhase M7.1〜M7.1eで得た教訓——BGMの技術的再生成功（実機で鳴ること）と、音として心地よく感じられる品質は別問題であり、後者は反復調整でも満足のいく水準に達しなかった——を踏まえた判断であり、User側の最終決定（M7.1e）を本Phaseにもそのまま適用した。ビジュアル＋短いSFXのみで「行動→変化」の因果関係とEngagementの両立を図る。

### 30.7 アニメーション・Reduced Motion・Flash Safety
動きはactivation後にのみ発生し（アイドル時・常時アニメーションは行わない）、`.mh-toy.pop-in`のpopスケールアニメーション（約650ms）として実装。`prefers-reduced-motion: reduce`環境では全体トークン（既存の`animation-duration:0.01ms !important`ブロック）によりこのpopアニメーションもほぼ瞬時になるが、**ready→active画像の差し替え自体はアニメーションと独立した状態変化であるため、reduced-motionでも変化そのものは必ず視認できる**ことを確認済み（19.1章の「何も起きない状態は禁止」を継承）。キラキラ/音符演出はopacityの単発フェード（Level3の部屋装飾のみ）で、点滅の反復は行わないためFlash Safety（19.3章）に抵触しない。

### 30.8 Multi-Input Equity / Gaze×Switch
既存のsemantic activation API（`activateItem(itemId, inputMethod)`、旧`activateTarget`から改称し全アプリ共通命名へ統一）はTouch/Gaze/Switch/Keyboardの4入力を等しく1つの関数へ合流させる構造を変更していない。Level3の「activated済みトイは再activationしない」制約は、`activateItem`自身のガードに加え、Gaze対象抽出（`getGazeTargets`）・Switch Scan候補抽出（`buildScanItems`）双方で`.is-activated`要素を候補から除外することで、**入力方式に関わらず同一の除外挙動**を保証している（Input Equity）。Gaze dwell ring（内側、conic-gradient進行表示）とSwitch Scan focus outline（外側、14pxオフセットの破線、28章Phase M2.1で確定した分離幅を踏襲）は、同一トイ・別トイいずれの組み合わせでも視覚的に重ならず判別可能であることを確認済み。

また、Switch Scanの`keydown`ハンドラにおいて、per-buttonのSpaceキー処理とdocument-levelのAuto Scan Spaceハンドラが競合し得る構造（`activateItem()`の同期的`renderItems()`が再フォーカスを発生させ、同一Spaceキー押下が二重activationを起こしうる——「どこかな？みーつけた！」M6.2/M7.1aで実際に発生した不具合と同型のアーキテクチャ）に対し、本Phaseでは該当バグが未発生の段階で予防的に対処した。per-buttonのkeydownハンドラに`if (scanMode && (e.key===' '||e.key==='Spacebar')) return;`を追加し、scanMode中のSpace処理をdocument-levelハンドラへ一本化している。

### 30.9 Rendered Validation / Engagement Validation 結果概要
- 5viewport（375×667 / 375×812 / 390×844 / 768×1024 / 1280×900）× Level1/2/3の全組み合わせで、水平overflow・`.mh-toy`要素のviewport外はみ出し・console/pageerrorともに0件。
- ランダム抽選ロジックをアプリ内関数（`buildTrialItems`/`buildRoomItems`）へ直接2000試行×3Level実行し、無効トイID・同一試行内重複・直前トイ即時再選出（Level1/2）・直前部屋との完全一致（Level3）いずれも0件、6トイの出現頻度もほぼ均等であることを確認。
- Level3の持続化ロジック（1体activateしても他2体はready維持、3体揃うとroom-complete）をTouch/Gaze/Switch/Keyboard全入力で個別に実行し、いずれも同一のcanonical挙動（`.is-activated`除外含む）となることを確認。
- Reduced Motion環境（`prefers-reduced-motion: reduce`）でready→active画像差し替えが即座に反映されることを確認（アニメーション自体は0.01msへ短縮されるが、状態変化そのものは維持）。
- 60〜80件規模のTouch/Keyboard/Gaze/Switch混在activationを複数回実行し、record重複0件・stale dwell 0件・scan focus残留0件・`scanInterval`ハンドル残留0件・console/pageerror 0件を確認（27章2. Activation Lock/17章Input Conflictの既存ガードが新TOYSモデルでも正しく機能）。
- Engagement Validation（主観評価）: 6トイのready/active比較シート（`final_six_ready_comparison.png`/`final_six_active_comparison.png`相当）で、ready状態のみから全6種が即座に識別可能であり、active状態でも同一トイと分かる表情・演出の一貫性を確認。Production（円/正方形/三角形のみのUI）とのbefore/after比較でも、視覚的な訴求力の差は明確。

### 30.10 変更ファイル
`miru-hirogaru-app.html`、`assets/miru-hirogaru/*`（新規12ファイル）、本設計doc。`apps-data.json`/`generate.js`/MANUAL_CHANGELOG/sitemap等、Release/公開に関わるファイルは一切変更していない。

### 30.11 Release Gate
27章のRelease Gateに従い、本PhaseはImplementation・Validationまでを完了した状態で停止する。**main統合・push・Production公開はいずれも未実施であり、Visual User Reviewでの承認を経るまで実施しない。**

---

## 31. 引用・参照

- `docs/multi-input/multi-input-program-design-v1.md`（Phase M0、v1.1）: Program共通方針全般。
- `docs/design-system/donomana-new-app-development-standard-v1_0.md`（v1.1）: Design System・Switch Scan・gaze/dwell・Release Policy等。
- `katachi-awase-app.html`: hit area不変の原則、composite id設計、Switch Scan/gaze D6非対称仕様の参照実装。
- `mitsukete-touch-app.html`（Phase M6.2/M7）: 資産/意味分離原則、Switch-Space二重発火の予防的修正パターンの参照実装元。

---

## 32. Phase M10-I: SFX Volume Fix（Piano Visual Fixは新asset待ちで未実施）

Production公開後、UserからSFXが全体的に小さいこと、特に「びっくり箱」「太鼓」が小さいことの報告を受けた。

### 32.1 実測（推測で修正しない）
`OfflineAudioContext`で全6音を実際にレンダリングし、peak振幅・RMS・実測継続時間を計測した（Puppeteer経由でアプリ実コードの`TOY_SFX`をそのまま実行）。

修正前の実測（peakDb / rmsActiveDb / 継続時間）:

| トイ | peakDb | rmsActiveDb | 継続時間 |
|---|---|---|---|
| たいこ | -15.0 | -28.8 | 0.20s |
| ピアノ | -17.4 | -32.9 | 0.28s |
| ベル | -18.0 | -33.3 | 0.35s |
| びっくり箱 | -15.8 | -30.1 | 0.16s |
| くま | -18.4 | -32.6 | 0.35s |
| きしゃ | -17.3 | -33.6 | 0.32s |

**重要な発見**: たいこ・びっくり箱は振幅(peak/RMS)だけを見ると6音中で最も大きい部類であり、「音量不足」ではなかった。実際の原因は、(a) 継続時間が6音中最短（たいこ0.20s・びっくり箱0.16s、他は0.28〜0.35s）であること、(b) たいこは低域中心（150→65Hz）で小型スピーカーで減衰しやすい周波数帯であること、の2点であると判明した。「小さい」という主観報告は音量そのものではなく知覚的な「弱さ・短さ」に起因していた。

### 32.2 修正方法
音源ファイルは存在しない（全音Web Audio合成）ため、asset加工は不要。`tone()`/`noiseBurst()`共通の`SFX_GAIN`定数（1.6倍）を新設し全音を底上げしつつ、たいこ・びっくり箱のみ追加で継続時間延長・peakGain増量・（たいこのみ）低域下限の引き上げを行った。

- 全音共通: `SFX_GAIN = 1.6`
- たいこ: `tone(170, 85, 0.27s, peakGain 0.28)` + `noiseBurst(0.09s, peakGain 0.08)`（旧: `tone(150,65,0.20s,0.20)` + `noiseBurst(0.06s,0.05)`）
- びっくり箱: `tone(300, 720, 0.24s, peakGain 0.26)`（旧: `tone(300,720,0.16s,0.17)`）

修正後の実測:

| トイ | peakDb | rmsActiveDb | 継続時間 |
|---|---|---|---|
| たいこ | -7.4 | -22.2 | 0.27s |
| ピアノ | -13.4 | -29.1 | 0.28s |
| ベル | -13.9 | -29.6 | 0.35s |
| びっくり箱 | -7.8 | -22.8 | 0.24s |
| くま | -14.3 | -28.8 | 0.35s |
| きしゃ | -13.3 | -29.8 | 0.32s |

たいこ・びっくり箱は他4音より意図的に大きく（+約6dB）補正し、短さ・低域減衰による知覚的弱さを相殺した。最大peak値は0.42（たいこ）で、クリッピング閾値1.0に対し十分な余裕がある。

### 32.3 Piano Visual Fix（未実施・新asset待ち）
`piano-ready.png`/`piano-active.png`の右側clippingを実ブラウザで調査した結果、CSS/レイアウト起因ではなく、**元PNGアセット自体の右側コンテンツ欠損**（左端には透明マージンと完全な曲線があるのに対し、右端は本体フレームがマージンなしでキャンバス端に直接切れている）と判明した。Phase M8設計doc（30.3章）記載の「piano→bellのセル境界にじみをMIN_LEFT_OVERRIDEで除去」した際、隣接bellセルとの境界調整でpiano自身の右側コンテンツも一緒に削られた可能性が高い。CSS側のscale/object-fit/paddingでは元から存在しないピクセルを復元できないため、User確認の結果、**高解像度の新しいpiano asset（ready/active）が用意されるまでPiano Visual Fixは保留**とし、本Phaseでは実施しない。asset・CSSともに変更していない。

### 32.4 変更ファイル
`miru-hirogaru-app.html`のみ（`TOY_SFX`/`tone()`/`noiseBurst()`のパラメータ変更）。piano assetおよびpiano関連CSSは変更していない。
