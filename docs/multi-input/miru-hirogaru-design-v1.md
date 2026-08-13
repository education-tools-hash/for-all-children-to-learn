# 「みるとひろがる」個別設計 v1.0（Phase M1）

- 版: v1.0（設計のみ、実装未着手）
- 位置づけ: `docs/multi-input/multi-input-program-design-v1.md`（Program共通設計、Phase M0）の下位文書。Program共通方針（Touch/Gaze/Switch/Keyboard対等設計、success-only可、canonical/transient分離等）を継承する。
- Production: 本Phaseでは一切のアプリコード・generate.js・apps-data.json・changelogを変更しない。設計文書のみ。
- Pilot: Multi-Input Programの共通Input Adapterを最初にPilotするアプリ（M0 15章で決定）。

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

## 28. 残存論点・ユーザー判断事項

1. **Level1 feedback方式**: color spreading + soft soundの組み合わせ（4.2章）でよいか。
2. **feedback duration**: 900ms（4.3章）でよいか。
3. **Level2左右/上下**: 左右配置（5.1章）でよいか。
4. **Level3静止/移動**: 静止3target（3.2章）でM1スコープとしてよいか（moving targetは将来）。
5. **success-onlyを全Level維持するか**: Level1〜3すべてでmistakeなし（3.1章）でよいか。
6. **activation lock**: 300ms（8章）でよいか。
7. **Switch interval**: 1500ms（15.3章）でよいか。
8. **Level1 direct switch**: Level1のみDirect Activation、Level2/3はAuto Scan（15.1-15.2章）でよいか。
9. **session終了方式**: 支援者による明示的終了＋10回activationのソフト提案（10.2章）でよいか。
10. **sound/TTS**: soundあり（ミュート可）・TTSなしでMVP開始（12章）でよいか。
11. **records最小項目**: 9.1章の7項目でよいか、削減または追加が必要か。
12. **M2 MVP範囲**: 25章のスコープ（実装するもの/しないもの）でよいか。

---

## 29. 引用・参照

- `docs/multi-input/multi-input-program-design-v1.md`（Phase M0、v1.1）: Program共通方針全般。
- `docs/design-system/donomana-new-app-development-standard-v1_0.md`（v1.1）: Design System・Switch Scan・gaze/dwell・Release Policy等。
- `katachi-awase-app.html`: hit area不変の原則、composite id設計、Switch Scan/gaze D6非対称仕様の参照実装。
