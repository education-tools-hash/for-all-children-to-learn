# どのまな 新規教材「さわってひろがる」Design Contract v1.0（DRAFT）

- 版: v1.0（DRAFT、起草）
- 起草日: 2026-09-13（Phase `SAWATTE-HIROGARU-DESIGN-1`）
- 状態: **DRAFT / User Design Review待ち。実装は未着手。**
- 位置づけ: `docs/design-system/donomana-new-app-development-standard-v1_0.md`（v1.7、以下「New App Standard」）の下位文書。New App Standardの各章（REQUIRED/CONDITIONAL項目）と矛盾する場合は常にNew App Standardを優先し、本書側を見直す。`docs/multi-input/multi-input-program-design-v1.md`（v1.3、以下「Multi-Input Program」）の設計哲学（Semantic Activation API・Error Philosophy・Records Philosophy等）を可能な限り継承する。
- Product code変更: 0件（本Phaseはdesign docsのみ）。

---

## 目次

1. Purpose
2. Target Users
3. Educational Goals
4. Existing App Duplicate Check（Standard §3 Stage 0）
5. Naming
6. Interaction Model / Core Interaction Principle
7. Input Matrix
8. Touch / Tap
9. Swipe
10. Long Press
11. Multi-Touch
12. Pointer Events 実装方針
13. Visual Feedback
14. Audio Feedback
15. Haptics（Vibration API）
16. Reaction Modes
17. Reaction Cooldown / Cause-and-Effect Latency
18. Screen Lock / Fullscreen
19. Accessibility（common A11y Panel）
20. Gaze
21. Switch Scan
22. Keyboard
23. Settings UI / Teacher Setup / Simple Mode
24. Record Foundation
25. Privacy
26. Educational Record Meaning
27. Session Start / End
28. PWA
29. Performance / Reduced Motion
30. Responsive / Browser Support
31. App Detail Page / Category / Metadata
32. Design Mock Structure
33. Test Matrix
34. Real Device Gate（後続Phase）
35. User Browser Review観点（後続Phase）
36. MVP Scope
37. Deferred（Future Expansion）
38. 「さかなつり」との共通基盤
39. Release Gates

---

## 1. Purpose

「触れた」→「変化が起きた」→「もう一度やってみたい」という**因果関係への気づき**を支援する教材を提供する。「正しく押す」ことを目的にしない。画面のどこに触れても、触れたこと自体に意味を持たせる。

本書はNew App Standard §4（教育的要件定義）・Multi-Input Program §1（Programの最上位目的）の要請に従い、実装着手前に教育的ねらい・入力方式・A11y・記録・Privacyを言語化するDesign Contractである。

---

## 2. Target Users

New App Standard §4「『対象』の書き方: 障害名・発達段階だけで対象を限定しない。**何を学びたい人に向く教材か**を中心に記述する」に従い、以下を対象記述の第一候補とする。

> 自分の体の動きや接触と、画面上の変化との因果関係に気づく学習に取り組む子ども。発語がない、意図的な細かいタップが難しい、画面の広い範囲への接触や、指を動かす・触れるといった動作は可能、といった特性を持つ子どもにも活用できます。視覚刺激・聴覚刺激への気づきを、「自分が操作すると何かが起こる」という経験につなげる段階の学習に向いています。

この記述は`miru-hirogaru-app`の`apps-data.json` `lesson.target`（「重度・重複障害のある子どもなど、意図的な手指操作が難しかったり、視線入力や1〜2個のスイッチが主な入力手段となる子ども。因果関係の理解が形成される段階の学習にも活用できます。」）と同一の記述スタイル（障害名を主語にせず学習内容・支援特性を主語にする）に意図的に揃えている。

---

## 3. Educational Goals

### 主目標

自分の身体の動き・接触と、画面上の変化との因果関係に気づく。

### 副目標候補

- 自発的な働きかけを増やす
- 再操作（もう一度やってみたい）を促す
- 視覚的追視
- 聴覚的注意
- 手指・上肢運動、スワイプ動作
- 選択ではなく能動的操作
- 期待感・操作結果の予測

診断的・心理的評価表現（「集中している」「理解した」等）は使わない（26章・Multi-Input Program §11.1参照）。

New App Standard §4の必須項目（学習目標／Level構成／最小操作単位／正誤の有無／観察可能な行動／支援量／記録・TTS・animation必要性／gaze適否／Switch適否）を以下の章で個別に確定する。

- 最小操作単位: 画面への1回の接触（tap）または1回のswipe軌跡
- 正誤の有無: **なし**（9章・Multi-Input Program §10「Error Philosophy」を参照。働きかけたこと自体を肯定的feedbackにつなげる）
- 観察可能な行動: 操作回数・入力方式・モード選択・セッション継続時間（26章）

---

## 4. Existing App Duplicate Check（Standard §3 Stage 0・REQUIRED）

New App Standard §3 Stage 0「既存アプリ重複調査」に従い、`apps-data.json`上で最も近い既存アプリを確認した。

**`miru-hirogaru-app.html`**（category: 認知支援）が最も近い。`lesson.target`「重度・重複障害のある子どもなど…因果関係の理解が形成される段階の学習にも活用できます」、`summary`「見る・触れる・スイッチを押すと、おもちゃが動いたり音が鳴ったりして応えてくれる…正解・不正解はなく、働きかけたこと自体が成功として扱われます」は、本教材の核心理念（6章）とほぼ同一の哲学を共有する。

**差別化点（実コード確認済み）**:

| 観点 | miru-hirogaru-app（既存） | さわってひろがる（本教材） |
|---|---|---|
| 操作対象 | 離散的な「おもちゃ」button群（`renderItems()`が`.mh-toy-btn`を複数生成、各buttonへ`pointerdown/pointerup/pointermove/click/keydown`を個別addEventListener） | 画面の**大部分をInteractive Surfaceとする単一の広い領域**。個々のbuttonへ正確に到達する必要がない |
| Level構成 | Level 1/2/3の段階的進行あり | Levelという概念を持たない（Reaction Modeの切替のみ、16章） |
| Swipe | 未実装（`pointermove`は8px閾値超過でclickをsuppressするためだけに使用、drag/swipe自体の視覚効果はない） | Swipeの軌跡に沿った視覚・聴覚効果を主要な入力として設計する（9章） |
| 既存Gaze/Switch実装 | `gazeTick()`・Switch Scan helper6実装済み（Multi-Input Pilot 3教材の1本） | 新規実装（20・21章でMulti-Input Program/Gaze Accessibility Standard/Switch Scan仕様書へ準拠する方針のみ確定） |

**結論**: 教育的哲学（正誤なし、因果関係への気づき）は共通するが、**「離散的ターゲットへの正確な到達」対「画面全体のどこに触れても反応する」という操作モデルそのものが異なる**ため、重複ではなく既存教材の学習発展系列に隣接する新規教材として扱う（Multi-Input Program §3の学習発展系列と同様の位置づけを本書25章で提案する）。

---

## 5. Naming

正式名称候補（ユーザー第一候補「さわってひろがる」を含む）。

| 候補 | 評価 |
|---|---|
| **さわってひろがる**（第一候補） | 「さわる」（能動的な接触行為）と「ひろがる」（画面上の視覚的変化、`miru-hirogaru-app`の「ひろがる」と語感を共有し既存教材群との親和性がある）を組み合わせ、教育的意図（触れる→変化が広がる）が名称から直感的に伝わる |
| さわるとひろがる | 「〜と」で因果関係をより明示するが、「さわってひろがる」に比べてやや説明的で語呂が硬い |
| さわってキラリ | 視覚効果（きらめき）を想起させるが、Reaction Modeが「ひかり」以外（おと・スワイプ等）も含む本教材の全体像を名称が限定してしまう |

**採用**: 「さわってひろがる」（ユーザー第一候補どおり、教育的意味・既存教材との親和性の両観点で最も適切と判断）。

### ファイル名

既存の直近命名慣行（`kurabeyou-app.html`・`katachi-awase-app.html`・`dotchiga-ii-app.html`・`miru-hirogaru-app.html`・`mitsukete-touch-app.html`・`junban-miyou-app.html`、いずれも「ローマ字+`-app.html`」）に合わせ、以下を提案する。

**`sawatte-hirogaru-app.html`**

---

## 6. Interaction Model / Core Interaction Principle

**最重要原則**: この教材では「どこを触ったか」よりも「触ったこと自体」に意味を持たせる。画面の大部分をInteractive Surfaceとし、Tap / Touch / Swipeのいずれでも反応する。小さいbuttonを正確に押すことを要求しない。

New App Standard 原則5「One physical input = one activation」・原則11「Physical diversity, semantic unity」・Multi-Input Program §7.1「Semantic Activation API」の思想を継承し、以下の単一の意味的処理へ全入力方式を合流させる。

```
Touch tap / touch-hold / swipe
Gaze dwell completion（OPTION、20章）
Switch scan → activation（21章）
Keyboard Space/Enter（22章）
        ↓
   semantic action:  triggerReaction(x, y, inputMethod, kind)
                      kind: 'tap' | 'swipe'
```

教材のロジック（何が起きるか＝どのReaction Modeがどう反応するか）は`triggerReaction()`一箇所に集約し、入力方式ごとにロジックを複製しない（49.2章 Existing Semantic Logic Reuse）。

---

## 7. Input Matrix

CoreはTouch/Swipeだが、どのまな共通方針との整合を以下のように整理する（すべてを無理に同じ操作へ揃える必要はない、Multi-Input Program §8参照）。

| Input | 採用 | 備考 |
|---|---|---|
| Touch | **REQUIRED（Core）** | 8章参照 |
| Mouse | **REQUIRED（Core、Touchと同一扱い）** | Pointer Events統一（12章） |
| Swipe | **REQUIRED（Core）** | 9章参照 |
| Keyboard | REQUIRED（開発・支援者操作・アクセシビリティ入力として維持、対象児童の主入力としては想定しない。Multi-Input Program §8.4と同じ位置づけ） | 22章参照 |
| Switch | CONDITIONAL（採用、MVPに含める） | 21章参照、1 press = 1 reaction |
| Gaze | CONDITIONAL（採用、MVPではOPTION/OFF既定を検討、20章） | dwellで光が広がる、Touch/Swipeの主目的を壊さない設計とする |

---

## 8. Touch / Tap

画面上の広い範囲を触ると、即時に以下のうち1つ以上が変化する。

- 光・色・形・動き（13章 Visual Feedback）
- 音（14章 Audio Feedback）

Input→Response間の遅延を最小化する（17章 Cause-and-Effect Latency）。

---

## 9. Swipe

Swipe時は、単なるTapと異なる反応を検討する。候補: 指の軌跡に沿って光が広がる／星が流れる／色の帯が伸びる／音程が連続変化する／泡が広がる／花が咲く／波紋が広がる（16章 Reaction Modeごとに具体化）。

**重要**: Swipeが途中で途切れても失敗扱いしない（9.4章「Error Philosophy」相当、6章の核心理念と同じ）。

### 実装参照（既存コードのSwipe/描画パターン）

`drawing-app.html`のフリーハンド描画実装（`startDraw`/`moveDraw`/`endDraw`、`drawCanvas`への`pointerdown`/`pointermove`/`pointerup`/`pointercancel`/`pointerleave`、`{passive:false}`で`e.preventDefault()`しスクロールを防止）を、画面全体をキャンバスとする本教材のReference Implementation候補とする。ただしdrawing-appは「マウスは視線ドウェルエンジンが担当し、キャンバスへの直接pointerdownは無視する」という同教材固有の分岐（`isTouchOrPen(e)`）を持つため、本教材ではこの分岐をそのまま流用せず、Mouse/TouchともにCore入力として扱う設計に置き換える（7章）。

---

## 10. Long Press

長押し中、光や音が持続・変化する挙動を検討する（Reaction Modeごとに定義、16章）。OS context menu等との競合を考慮し、`preventDefault()`の適用範囲を必要最小限（Interactive Surface内のみ）に限定する（18章の画面ロック限界とも関係する）。

---

## 11. Multi-Touch

重度・重複障害では意図せず複数点接触する可能性があるため、以下を設計方針とする。

- **既定は複数touchを許可し、各touch pointごとに独立したReactionを出す**（1本指=1反応、2本指以上でも「触れたこと」自体を否定しない設計。miru-hirogaru-app等の離散button方式とは異なり、本教材は面全体が反応対象であるため、複数点同時接触自体は自然な操作として扱う）
- ただし`drawing-app.html`の「2本指以上はピンチ操作とみなして描画キャンセル」（`touchstart`で`e.touches.length >= 2`ならendDraw）のような、**意図しないpalm contact・多点接触による過剰な同時Reaction発生**を抑制する仕組みは、Reaction Cooldown（17章）とあわせて検討する
- accidental drag（誤って画面をなぞってしまう動き）は、Swipe自体が本教材の正規入力であるため「誤操作」として区別しない（9章）

---

## 12. Pointer Events 実装方針

New App Standard §49.1「Pointer Events Drag Pattern」に準拠し、Pointer Eventsを第一候補とする。

- `pointerdown`: Transient Interaction State（swipe軌跡の開始点等）のみ初期化。canonical stateは変更しない（17.1章相当）
- `pointermove`: 軌跡に沿ったVisual/Audio Reactionを継続的に発生させる（9章）
- `pointerup`/`pointercancel`: 現在のReactionを終了させる。**未完了のswipeを失敗扱いしない**（9章）

### 二重発火防止

既存3アプリ（miru-hirogaru-app/mitsukete-touch-app/junban-miyou-app）が共通して使う`suppressNextClick`パターン（`pointerdown`→`pointermove`が8px閾値を超えたら`suppressNextClick=true`にして直後の`click`を無視する）、および`drawing-app.html`の`isTouchOrPen(e)`＋`touchstart`側の`e.sourceCapabilities.firesTouchEvents`ガード（Pointer Eventsで処理済みの場合にTouch Events側の重複処理を防ぐ）を、本教材でも同種の二重発火防止として採用する。ただし本教材はbuttonクリックではなく面全体のReactionであるため、`click`イベント自体は使わず、`pointerdown`/`pointermove`/`pointerup`のみで完結させる設計を基本とする（`click`合成イベントとの二重発火リスクそのものを構造的に排除する）。

---

## 13. Visual Feedback

刺激は派手ならよいわけではない。以下を設計対象とする。

- Brightness / intensity
- Color count
- animation speed / duration
- **高速点滅は禁止**（Multi-Input Program §9「強すぎる刺激を避ける：点滅・高速flashは禁止」と同一方針。光過敏等を考慮）
- transitionの滑らかさ
- background dark/light
- object size / particle density

---

## 14. Audio Feedback

音は即時・短い・明確・不快になりにくいことを基本とする。設定候補: 音あり/なし、音量、音の種類、音程変化、背景音ON/OFF。**音がなくても学習が成立すること**を必須要件とする（Multi-Input Program §9と同一原則、New App Standard §14「TTS OFFでも学習活動が成立することを原則とする」の音全般への拡張）。

### 音カテゴリ候補

やわらかいベル／木琴／水滴／キラキラ／太鼓／ポン／低刺激tone。幼児向けすぎるチープな音に固定せず、学校現場で長時間使える音質を重視する。

### 既存実装の確認結果

`generate.js`内の`speak(text)`（875行目付近）は**TTS専用**（`window.speechSynthesis`ベース、`srEnabled`/`SR_SKIP_APPS`で制御）であり、効果音（chime等）の共通再生helperではない。効果音の共通Web Audio APIヘルパーは現時点でリポジトリ内に存在しない（`generate.js`内を検索した限り確認できなかった）。**本教材の効果音実装は既存共通層の流用ではなく新規実装**になる（Multi-Input Program §9の「音の役割はreinforcement/cue/completionのいずれかを明確化」方針に従う）。

### Audio Overlap Policy

連打時に音が破綻しないこと。既存`speak()`が「呼び出し毎に`speechSynthesis.cancel()`してから発話する」多重発話防止パターンを持つのと同様、効果音側も同時再生数の上限またはvoice stealing（新しい音が古い音を打ち切る）方式を検討する（17章 Reaction Cooldownと連動）。

### iOS Safari Audio Autoplay制約

最初のUser Gesture後にAudioContextをunlockする設計が必要（一般的なWeb Audio APIの既知制約。リポジトリ内に既存の参照実装は見つからなかったため、本教材が初めての実装例になる）。

---

## 15. Haptics（Vibration API）

### 現状調査結果

`navigator.vibrate`の使用箇所はリポジトリ内に2件のみ確認した。

- `schedule-app.html`（2030行目）: 長押しプレビュー時に`if(navigator.vibrate)navigator.vibrate(40);`（40ms、feature-detection付き）
- `slideshow-sakusei.html`

Multi-Input Program §9「振動は『可』だが必須にはしない（デバイス依存が大きいため）」という既存方針とも一致する。

### 分類

| 環境 | 分類 |
|---|---|
| Android Chrome | REQUIRED級ではないがOPTIONAL・実用可（`navigator.vibrate`が存在） |
| Windows（Edge/Chrome） | UNSUPPORTED（Vibration APIはデスクトップブラウザで概ね未実装） |
| iPad / iOS Safari | UNSUPPORTED（Vibration API自体が実装されていない、既知の長期的なWebKitの立場） |

**結論**: 振動はCore featureにはしない。既存2アプリと同じ`if(navigator.vibrate)`によるfeature-detection＋OPTIONALな追加演出として位置づける（37章 Future Expansion）。

---

## 16. Reaction Modes

| Mode | 内容 |
|---|---|
| A — ひかり | 触れると色・光・波紋が広がる |
| B — おと | 触れる場所・動きに応じて音が鳴る |
| C — ひかり + おと | 視覚+聴覚を同時に返す |
| D — スワイプ | 指の動きに沿って光・粒子・音が広がる |
| E — ゆっくり | 刺激を弱く・長く提示（`prefers-reduced-motion`との関係は29章） |

名称は上記のまま採用可能（ひらがな表記は既存教材群の「みるとひろがる」「みつけてタッチ」等と表記トーンが一致する）。MVPスコープは36章で確定する。

---

## 17. Reaction Cooldown / Cause-and-Effect Latency

### Cooldown

連続入力時、以下を目的にReaction発生を制御する。

- excessive audio overlap防止（14章）
- animation overload防止
- rapid accidental contact対応（11章のMulti-Touch policyと連動）

Multi-Input Program §8.6「Multi-Input Conflict対策」のactivation lock（300〜500ms）を参考にしつつ、本教材は「反応そのものが目的」であるため、**反応が遅く感じるほどcooldownしない**ことを優先原則とする（quiz型教材のactivation lockより短い値を検討する）。

### Latency

入力→反応までのlatencyは「即時体感レベル」を品質要件とする。固定ms値の要否は実装時に体感確認しながら決定する（後続Implementation Phaseで確定、本書では数値を先取りしない）。

---

## 18. Screen Lock / Fullscreen

### 既存Screen Lock実装の確認結果

`generate.js`の`setLock(on)`（1210行目付近）が実際にブロックするのは以下のみ。

- ブラウザの「戻る」操作（`history.pushState({donomanaLocked:true},'')`を2回積み、`popstate`発火時に再度push——実質的な戻る操作の無効化）
- `beforeunload`時の確認ダイアログ表示（`e.preventDefault(); e.returnValue=''`）
- `donomanaHomeBtn`クリックのブロック（ロック中はクリックしてもtoast表示のみで遷移しない）

**明記すべき限界**: `setLock()`は上記3点のみを対象とし、以下はブロックしていない（Web標準APIの制約上、JS側で完全に禁止できない）。

- ブラウザUIそのものへの誤操作（アドレスバー・タブ切替等）
- OSレベルのedge swipe（画面端からのスワイプでアプリ切替が起きる等）
- pull-to-refresh（一部モバイルブラウザの既定挙動）
- text selection・context menu・double tap zoom・overscroll

これらはCSS（`touch-action`, `overscroll-behavior`, `user-select:none`等）による**緩和**は可能だが、OSジェスチャーの完全な無効化はWeb側の権限を超える。本教材のInteractive Surfaceでは、CSSレベルの緩和（`touch-action: none`でpull-to-refresh/pinch-zoomの一部を抑制、`user-select:none`でtext selection抑制）を実装時に検討するが、**限界がある旨をHelp/Usage Guide（8.1章相当）に明記する**方針とする。

### Fullscreen

`generate.js`の`donomanaFsBtn`（1241〜1254行目）は`document.documentElement.requestFullscreen()`（+`webkitRequestFullscreen`/`mozRequestFullScreen`フォールバック）を呼び出す共通実装であり、新規アプリは`generate.js`注入のみで自動的に利用できる（New App Standard §8 common chrome）。iPad Safari特有の既知制約に関する既存docsの明示的な記述は本調査の範囲では見つからなかったため、断定を避け、**後続の実機検証（34章 Real Device Gate）で確認すべき事項**として保留する。

Fullscreenの活用目的: 教材Surface最大化、accidental browser UI操作低減、集中しやすさ。

---

## 19. Accessibility（common A11y Panel）

New App Standard §7「設定入口一本化」・§8「common chrome」に従い、新規アプリ独自の設定入口を追加しない。共通A11yパネル（`donomanaA11yBtn`/`donomanaA11yPanel`、`generate.js`の`buildA11yPanelHTML()`が全35アプリへ自動注入）をそのまま使う。教材固有設定が必要な場合は`SETTINGS_PROXY`方式（`generate.js`の`SETTINGS_PROXY`テーブル登録）で共通パネルへ統合する（25章）。

A11yパネル自体のkeyboard containment（`window.trapA11yPanelFocus(e)`等）は`generate.js`側の共通実装をそのまま利用し、独自実装を作らない（`donomana-a11y-panel-keyboard-contract-v1_0.md`参照、GLOBAL-1Aで5 Pilotアプリへ導入済み。本教材をPilot対象に含めるかは別途判断、Deferred扱い・37章）。

最低限確認する項目（New App Standard §37）: font scale／high contrast／focus visible／aria／keyboard／touch／Switch／gaze（採用時）／reduced motion。

---

## 20. Gaze

`docs/design-system/donomana-gaze-accessibility-standard-v1_0.md`（v1.0 改訂5、確定）を正式参照する。同文書はMulti-Input Pilot 3教材を根拠にdwell時間調整・dwell進捗表示・再選択防止・entry delay等のREQUIRED項目を定める。

視線入力では「注視すると反応（dwellで光が広がる）」をOPTIONとして検討する。ただしTouch/Swipe教材の主目的を壊さないよう、ON/OFF可能にする（Gaze Accessibility Standard §0 Decision B「視線入力ON/OFFはREQUIREDのまま維持する」に準拠）。

### 採用する場合の必須項目（Gaze Accessibility Standard §6/§8/dwell safety checklist準拠）

- 大きなtarget・target間隔（本教材は面全体がtargetのため、この制約自体は緩和される可能性が高い。実装時に個別確認）
- dwell progress・dwell cancel・minimum dwell
- feedback中の停止
- gaze OFF時のcleanup、pending activationなし
- dwell progressionは`requestAnimationFrame`方式（`kurabeyou-app.html`の`gazeTick()`、`DWELL_MS=900`を実装参照とする）

### Switch Scanとの関係

Gaze Accessibility Standard §0 Decision A「GazeとSwitch Scanは相互排他にしない」に従い、共通activation gate（6章の`triggerReaction()`）で二重発火を防止する設計とする。

**本書段階での判断**: Gazeを採用するか、MVPではOFF固定にするかは、Touch/Swipe面全体反応というCore Interactionとの適合性を実装後に検証してから最終決定する（36章 MVP Scopeで暫定判断、後続Design Finalize Phaseで確定）。

---

## 21. Switch Scan

`docs/design-system/donomana-switch-scan-spec-v1_0.md`（v1.8、21アプリRollout完了）を正式参照する。

Switchでは「1 press = 1 reaction」というCause & Effectモードを検討する。Blue2等で利用可能にする価値は高い（本教材の対象児童像そのものがSwitch入力の主要ユーザー層と重なるため）。**SwipeそのものをSwitchへ無理に模倣しない**（Switchは離散的な1押下=1反応の入力方式であり、連続的なSwipe軌跡表現とは性質が異なる。Switch入力時はReaction Mode A/B/C相当の単発反応に限定する設計を基本とする）。

新規アプリはhelper6（`buildScanItems()`/`refreshSwitchScanItems()`/`startSwitchScan()`/`stopSwitchScan()`/`activateCurrentScanItem()`/`clearScanHighlight()`）を最初から採用する（New App Standard §12）。Interactive Surface自体をSwitch Scan候補に含めるか、専用の「1回押すと反応する」ボタンを別途設けるかは、後続Implementation Phaseで実機検証しながら決定する（本書では両案を残し確定しない）。

新規アプリ向けの完全なチェックリストは、Switch Scan仕様書v1.8 §19.22.14をそのまま使う（本書での複製はしない）。

---

## 22. Keyboard

Space/Enter等で1 reactionを発生させる代替入力を検討する。New App Standard §11・Multi-Input Program §8.4と同じ位置づけ（開発・支援者操作・アクセシビリティ入力として維持、対象児童の主入力としては想定しない）。native interactive element（focus可能な単一のInteractive Surface要素、または明示的な「ためしにおす」ボタン）を用意し、同一操作へ複数`keydown` handlerを追加しない。

---

## 23. Settings UI / Teacher Setup / Simple Mode

### Settings UI

A11yパネルとは別に教材固有設定が必要か整理する。候補: Reaction mode／Sound ON-OFF／Background／Reaction speed／Reaction intensity／object density。設定項目を増やしすぎない（New App Standard 原則7「User-facing simplicity」）。

### Simple Mode

重度・重複向けのため、設定UIを隠して即Activity Surfaceへ入れる「はじめる」ボタンのみのSimple Startを検討する。

### Teacher Setup

教師・支援者向け設定と児童生徒用Activity Surfaceを明確に分離する。Settings操作をActivity中に誤って触れにくくする（New App Standard §6「条件付きUI」——非表示時は`hidden`属性を使い、layout領域を持たず、keyboard/Switch/gaze targetにもならないようにする）。

---

## 24. Record Foundation

### 既存基盤の確認結果

`generate.js`の`buildLearningRecordFoundationJSHTML()`（1650行目付近）は、`donomanaRecordReadLog(storageKey)`/`donomanaRecordWriteLog(storageKey, log)`/`donomanaRecordAddLog()`/`donomanaRecordClearLog()`/`donomanaRecordNormalizeLegacy()`/`donomanaRecordCreate(appId, activity, inputMethod, payload)`/`donomanaRecordBuildCsv(rows)`という**localStorageベースの汎用read/write/normalize/CSV helper**を提供する。各アプリは自分のstorage keyとrecord shapeを持ち、このFoundationはread/write/normalize/CSV機構のみを共有する（app固有payload fieldは共有しない）。

対象アプリは`generate.js`内`LEARNING_RECORD_FOUNDATION_APPS`という明示的なSetへの登録が必要（現在21アプリ登録済み、「さわってひろがる」は実装時に追加登録が必要）。

`donomanaRecordCreate()`が返す標準形は`{timestamp, appId, activity, inputMethod, schemaVersion:1, payload}`。

### 記録粒度

Phase §30の指示どおり、**個々のtouch座標は保存しない**。1 session = 1 recordを基本とする（New App Standard §22.1 Record Session Grouping「1操作 = 1 sessionとは限らない。教材として意味のある学習単位でsessionをgroupingする」、Multi-Input Program §11.3「開始→一連のtrial→終了を1セッションとする」と同一方針）。

detail候補（座標を含まない事実のみ）:

- duration（session継続時間）
- tapCount
- swipeCount
- totalInteractions
- activeTime
- selectedMode（16章のReaction Mode）
- soundOn
- reactionIntensity
- inputMethod（23章のNew App Standard §23「観測事実優先」原則、Switchだったはずと推測しない）

CSV要否は、記録機能を持つ教材では原則REQUIRED候補（New App Standard §26）。`donomanaRecordBuildCsv()`（UTF-8 BOM付き）を再利用し、独自CSV実装を作らない。

---

## 25. Privacy

保存しない候補（Phase指示・New App Standard §21「個人情報は保存しない」と一致）:

- touch coordinates（座標そのもの）
- gaze coordinates
- raw pointer trail
- biometric-like data

教師自由記述なし。外部送信なし。既存local-only Record Foundation（localStorageのみ、IndexedDBは大容量データ用途、本教材では不要）に準拠する。

---

## 26. Educational Record Meaning

記録は「何回操作したか」「どの入力を使ったか」「どのモードだったか」という**事実のみ**とする。以下は自動推論として記録しない（Multi-Input Program §11.1「診断的解釈は自動記録しない」と同一原則）。

- 集中力が高い
- 理解した
- 心理状態
- 興味がある
- 認知能力

---

## 27. Session Start / End

「はじめる」→ Activity → 「おわる」で1 sessionとするSession boundaryを設計する。Activity中のHome離脱等の扱い（session を明示終了扱いにするか、中断として別途記録するか）は後続Implementation Phaseで確定する。

---

## 28. PWA

### 既存実装の確認結果

`service-worker.js`は**Pilot allowlist方式**（`PILOT_PATHS = ['/', '/learning-records.html', '/janken-app.html', '/tokei-app.html']`＋対応する`/app-details/*-detail.html`のみ）を採用しており、Full Site Precacheではない（`docs/design-system/donomana-pwa-architecture-v1_0.md`のOffline Level B方針）。Pilot allowlist**外**のページ（現行33アプリすべてを含む）に対しては、Service Workerが登録されていてもfetchをそのままネットワークへ素通しするだけで、cacheへの書込み・応答の差し替えを一切行わない（No-op原則）。

### 本教材への適用

**「さわってひろがる」は既定でPilot allowlist外の33アプリと同じ扱いになる**（オフライン対応なし、追加のservice-worker.js変更は不要）。Offline対応（Pilot allowlistへの追加）は`donomana-pwa-architecture-v1_0.md`が管理する別軸の意思決定であり、本Design Contractのスコープ外・MVPスコープ外とする（37章 Deferred）。

`site.webmanifest`（`start_url`/`scope`/`icons`/`theme_color`/`background_color`/`display:standalone`）はサイト全体で共通のため、新規アプリ追加による変更は不要。

---

## 29. Performance / Reduced Motion

### Performance

大量particle等による低性能iPadでのframe dropを避ける。Low/Standardのような設定要否は実装時のパフォーマンス実測で判断する（本書では先取りしない）。

### Reduced Motion

`generate.js`の`buildDesignTokensHTML()`が全アプリへ`prefers-reduced-motion`対応（`animation-duration:0.01ms !important`等）を自動注入する（New App Standard §15）。本教材の目的自体が動きのfeedbackを含むため、完全停止ではなく**Reaction Mode E「ゆっくり」への切替、または刺激強度を穏やかにする方式**を設計する。OSレベルの設定とアプリ内トグル（23章のReaction intensity設定）の両方をコード側で確認する。

---

## 30. Responsive / Browser Support

New App Standard §30/§31に従い、以下のviewportを標準確認セットとする: 375×667／375×812／390×844／768×1024／desktop（1280×900目安）。Portrait/Landscape両対応を基本とする（重度・肢体不自由では端末固定方向が異なる可能性があるため）。

### Browser Support Matrix（現実的な最低対象）

- Edge / Chrome（Windows、タッチデバイスまたはマウス）
- Safari（iPad）
- Chrome（Android）

---

## 31. App Detail Page / Category / Metadata

### Category

`miru-hirogaru-app`/`mitsukete-touch-app`/`junban-miyou-app`はいずれも`category: "認知支援"`（`apps-data.json`で確認済み）。本教材も同一のtarget層・教育哲学であるため、**category: 認知支援を第一候補**とする。

### `a11y[]`フィールド候補

既存3アプリの`a11y`表記パターン（`🔘 スイッチスキャン対応`／`👁️ 視線入力（ドウェル選択）対応`／`🔊 効果音オフ可`／`⬛ ハイコントラスト対応`／`🎬 アニメーション軽減対応`／`📱 iPad・スマートフォン対応`）を踏襲し、Switch/Gaze採用状況が確定してから記入する（20・21章の最終判断待ち）。

### metadata

New App Standard §39に従い、実装Phaseで`apps-data.json`へ`id`/`filename`/`icon`/`iconColor`/`title`/`category`/`tags_display`/`summary`/`features[]`/`steps[]`/`lesson{}`/`a11y[]`/`badges[]`/SEOフィールド/`isRecommend`/`isNew`/`releaseDate`/`releaseDetails[]`を完全記入する。本Design Phaseでは記入しない（Product file変更禁止のため）。

---

## 32. Design Mock Structure

```
Start（「はじめる」のみのSimple Start、26章）
  ↓
Teacher Settings（Reaction Mode / Sound / Intensity、Activity中はhiddenで完全隔離）
  ↓
Activity Surface（画面の大部分がInteractive Surface。Home/Settings/Fullscreen/A11y/Exit/Helpは
                  誤作動防止のためSurfaceから分離した専用領域に配置、9章）
  ↓
End Summary（「おわる」→ duration/tapCount/swipeCount等の事実のみを表示、27章）
```

---

## 33. Test Matrix（後続Implementation用）

- Tap
- Swipe
- long touch
- rapid taps
- multi-touch
- rotate（Portrait/Landscape）
- fullscreen
- screen lock（18章の限界を踏まえた範囲内）
- sound ON/OFF
- record（座標非保存の確認を含む）
- offline（Pilot allowlist外の既定挙動確認、28章）
- keyboard
- switch（採用時）
- gaze（採用時）

---

## 34. Real Device Gate（後続Phase）

最低限、以下を検討する。

- iPad（Safari、Fullscreen/Audio Autoplay/Vibration非対応の実機確認）
- Windows touch device or mouse
- Blue2（Switch、採用時）
- Tobii（Gaze、採用時）

機能対応Inputのみ検証する（採用しない入力方式のReal Device Gateは不要）。

---

## 35. User Browser Review観点（後続Phase）

「楽しいか」だけでなく以下を確認する。

- 操作すると確実に反応する
- 反応が分かりやすい
- 刺激が強すぎない
- 誤操作しにくい
- 終了しやすい
- Teacher設定が分かりやすい

---

## 36. MVP Scope

初回Releaseで欲張りすぎない。以下を中心とする。

- Tap / Touch / Swipe
- Light reaction（Mode A）／Sound reaction（Mode B）／Light+Sound（Mode C）
- intensity設定
- sound ON/OFF
- screen lock／fullscreen（18章の限界明記込み）
- records（session単位、座標非保存）
- basic A11y（common A11yパネルのみ、独自UIなし）

**MVPで確定判断を要する残課題（後続Design Finalize Phaseで決定）**:

- Gaze採用可否（20章）
- Switch Scan候補にInteractive Surface自体を含めるか、専用ボタンにするか（21章）
- Mode D（スワイプ専用演出）／Mode E（ゆっくり）をMVPに含めるか、37章のDeferredへ回すか
- Reaction Cooldownの具体的なms値

---

## 37. Deferred（Future Expansion）

MVP後の候補。MVPへ混入させない。

- 振動（Android限定のOPTIONAL演出、15章）
- custom sound
- custom visual theme（複数Visual Themes: ひかり／ほし／みず／シャボン玉／はな／にじ／おと。28章のPWA同様、初回Releaseではテーマ数を絞ってよい）
- cause/effect sequence（二段階以上の因果連鎖）
- two-step interaction
- collaborative mode
- PWA Offline Pilot allowlistへの追加（28章）
- GLOBAL-1A A11yパネルkeyboard containment（`donomana-a11y-panel-keyboard-contract-v1_0.md`）のPilot対象への追加

---

## 38. 「さかなつり」との共通基盤

リポジトリ内を検索した結果、「さかなつり」「sakana」に関する既存ファイル・docsは**0件**（本調査時点で未着手の完全な新規教材）。

次に制作予定の「さかなつり」と共有できる可能性がある基盤（本教材の設計・調査で判明した既存共通層）:

- audio（14章で判明したとおり、効果音の共通helperは現状存在しない。本教材で新規実装する効果音レイヤーが「さかなつり」とも共有できる最初の候補になりうる）
- fullscreen／screen lock（generate.js共通実装、18章）
- record（Learning Record Foundation、24章）
- 共通A11y Panel（19章）
- input helper（Semantic Activation API思想、6章。ただし本教材固有の`triggerReaction()`実装がそのまま「さかなつり」へ転用できるかは、「さかなつり」自体の教育設計が定まってから判断する）
- animation layer（Reaction Mode描画層、16章。particle/波紋等の描画手法が共有候補になりうる）

いずれも「さかなつり」の設計着手時に改めて評価する（本書では確定しない）。

---

## 39. Release Gates

- 本Design ContractのUser Design Review承認
- 後続`SAWATTE-HIROGARU-DESIGN-FINALIZE-1`（36章の残課題確定）
- Implementation Phase（New App Standard §3 Stage 5〜8）
- local test minimum gate（New App Standard §46）
- Rendered Validation（375×667を含む標準viewport、New App Standard §30/§31）
- 新規アプリ初回公開のUser Review・Explicit Approval取得（New App Standard §48.1、Release Policy）
- production verification（New App Standard §50/§51）

---

## 改訂履歴

- **v1.0（DRAFT、2026-09-13、Phase `SAWATTE-HIROGARU-DESIGN-1`）**: 初版起草。既存アプリ（miru-hirogaru-app／mitsukete-touch-app／junban-miyou-app／drawing-app／kimochi-board）のTouch/Pointer実装、Gaze Accessibility Standard v1.0、Switch Scan仕様書v1.8、Multi-Input Program v1.3、New App Standard v1.7、Learning Record Foundation、共通A11yパネル、Screen Lock/Fullscreen実装、PWA Pilot allowlist方式、Vibration API使用実績（2件）を実コード確認した上で起草。Product code変更0件。
