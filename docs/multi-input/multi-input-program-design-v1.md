# Multi-Input教材群 共通設計 v1.1（Phase M0〜M1）

- 版: v1.1（v1.0をPhase M0承認事項で確定、Phase M1で「みるとひろがる」個別設計を`miru-hirogaru-design-v1.md`へ分離）
- 対象: 「みるとひろがる」「みつけてタッチ」「じゅんばんにみよう」の3教材
- 位置づけ: `docs/design-system/donomana-new-app-development-standard-v1_0.md`（v1.1運用中）の下位文書。既存標準と矛盾する場合は既存標準を優先し、本書側を見直す。
- Production: 本Phaseでは一切のアプリコード・generate.js・apps-data.json・changelogを変更しない。設計文書のみ。

---

## 1. Programの最上位目的

重度・重複障害のある子どもに対し、**入力方式を問わず同じ学習目標へ到達できる教材群**を提供する。

これまでのどのまな教材（かたちをあわせよう、おおきい？ちいさい？くらべよう等）は「Touchで作り、Switch Scan/Gazeを後付けする」設計だった。Multi-Input Programはこれを転換し、**Touch/Gaze/Switch Scanを対等な一級市民として最初から設計する**（Keyboardは開発・支援者操作・アクセシビリティ入力として維持するが、対象児童の主入力としては想定しない）。

### 1.1 エンゲージメント原則（Phase M5で正式化）

**アクセシビリティは前提条件であり、それ自体が学習の質を保証するものではない。子どもが「やってみたい」と感じる体験の魅力（エンゲージメント）も学習の質の一部として扱う。**

「みるとひろがる」（Pilot）は因果関係の経験そのものが目的であったため視覚的装飾を最小化したが、これはProgram全体の標準ではなく、あくまで1本目の学習目標に即した選択だった。2本目「みつけてタッチ」（`mitsukete-touch-design-v1.md`）以降では、各教材の学習目標に応じて「発見の楽しさ」「遊びとしての魅力」を積極的に設計要素として扱ってよい。ただし、success-only・入力方式間の公平性（Input Equity）・刺激の安全性（点滅禁止、reduced motion対応等）といった既存原則は、体験の魅力を高める場合であっても後退させない。

---

## 2. 想定利用者像（診断名ではなく支援・入力特性で整理）

- 意図的な手指操作が難しい、または不可能
- 発語がない、または限定的
- 視線入力が主入力になりうる（追視・注視は可能な場合が多い）
- 1〜2スイッチでの操作が主入力になりうる
- タッチ自体は可能でも、精密なdrag/複数ステップ操作は難しい
- 因果関係理解が形成途上（「自分の行動が画面を変える」体験自体が学習目標になりうる）
- 注視・追視・選択反応そのものを教員/支援者が見取りたい（学習成果の可視化ニーズ）

この整理から導かれる設計要請：
- ターゲット数は少なく、ターゲットは大きく（43章）
- 「間違い」を前提としない教材があってよい（原則3）
- 反応そのものが記録価値を持つ（原則4）

---

## 3. 3教材の役割分担と学習発展系列

| 教材 | 役割 | semantic goal |
|---|---|---|
| みるとひろがる | 見る／反応する | 対象に気づき、見続けることで変化が起きるという因果関係を経験する |
| みつけてタッチ | 見つける／選ぶ | 複数の対象から1つを発見し、働きかける |
| じゅんばんにみよう | 注意を移す／順序に沿う | 提示される対象へ順番に注意を移す |

3教材は「反応→選択→順序」という認知発達的な流れに対応しており、役割は重複しない：
- みるとひろがるは**選択を要求しない**（1対象でも成立する）
- みつけてタッチは**選択を要求するが順序は問わない**
- じゅんばんにみようは**順序（時間的系列）を要求する**が、Guided Sequence型を第一候補とする限り「複数から正しい順を選ばせる」認知負荷までは課さない（後述18-19章）

この3段階は、後述のPilot App選定（44章）・開発順序（45章）の根拠にもなる。

---

## 4. 教材1「みるとひろがる」

### 4.1 目的
「見る」ことで画面に変化が起きる（光る／広がる／音が鳴る／色が変わる／動きが生まれる）体験を通じ、注視・因果関係理解・視覚追従・選好反応を育む。

### 4.2 入力モデル

**Gaze（中心的入力）**
- 対象を見る → dwell → visual expansion / animation / sound
- dwell時間・進捗表示・fixation jitter許容・target遷移guard・re-trigger cooldownを要件化（26章参照）
- continuous gaze（見続けている間だけ変化が持続し、視線を外すと元に戻る）と、dwell完了で確定する方式の両方をLevel設計の選択肢として残す（Level案参照）

**Touch**
- tapまたはtouch-holdで同じsemantic resultを得る。精密dragは不要。

**Switch**
- 1 target時：Direct Activation型（switch press → reaction、scan不要）
- 複数target時：Scan型（auto scan → switch activation）
- 本教材はLevel1が1targetのため、Level1ではDirect Activation、Level2以降でScan型に切り替わる設計を推奨（＝Levelごとに要求されるSwitch操作モデルが変わる。これは既存標準のdynamic candidate原則(36章)と整合する）

### 4.3 Level案（最低3段階）

- **Level1**: 画面中央1target。見るだけで変化が起きる。選択なし。継続的な因果関係学習。
- **Level2**: 左右2target。どちらを見るかで異なる変化が起きる（選好反応の観察が可能になる）。
- **Level3**: 複数target、または動きのあるtarget。追視・選好をより明確に観察する。ただし重度児向けとして「同時に3つ以上を提示して選ばせる」ような認知負荷の高い構成は避け、動きの緩やかさ・target数の少なさを維持する。

---

## 5. 教材2「みつけてタッチ」

### 5.1 目的
画面上の対象に気づき、自分の入力方法（Touch/Gaze/Switch/Keyboard）で選ぶ。名称に反し、Touch専用教材にはしない。

### 5.2 Semantic Goal
targetを発見してactivationする。

| 入力 | 物理操作 |
|---|---|
| Touch | tap |
| Gaze | dwell |
| Switch | scan → activate |
| Keyboard | focus → activate |

### 5.3 学習候補
視覚探索、target detection、選択、共同注意の基礎、位置理解（左右/上下）、figure-ground弁別。

### 5.4 Target数（最低3段階）
- Level1: 1target（気づいて働きかけるだけ）
- Level2: 2target
- Level3: 3〜4target

**MUST**: Gaze/Switch Scanで候補数が過剰にならないこと（29章のscan候補数指針と一致させる）。

### 5.5 Distractorの扱い
初期段階（Level1）は「distractorなし＝対象に気づいて働きかける教材」として設計することを推奨する。「正解targetを探す教材」としてのdistractor付き構成はLevel2以降で導入する。これにより、原則3（正解/不正解を必要としない教材を認める）とLevel1の設計が整合する。

### 5.6 Correct/Incorrectの扱い（Levelごとに整理）
- **Level1**: どこを選んでも成功（mistake概念なし。distractorが存在しないため必然的に成立）。
- **Level2**: targetのみ反応する（distractor自体が反応しない＝「間違えた」という否定的feedbackを出さずに済む設計が可能）。
- **Level3**: target/distractorを区別し、区別すること自体が学習目標になる（ここで初めて、既存標準のCanonical Question State（17章）に近いcorrect/mistakeモデルの部分適用を検討してよい）。

---

## 6. 教材3「じゅんばんにみよう」

### 6.1 目的
提示される対象へ順番に注意を向ける。

### 6.2 学習候補
視覚的順序、注意の移動、予測、待つこと、successive attention、left-to-right等の基礎、sequence anticipation。

### 6.3 Semantic Goalの明確化（重要な分岐）
「正しい順番を覚えて答える」教材ではなく、**「順番に提示される刺激へ注目する」教材**として設計する（19章で理由を後述）。target A→B→Cの提示に対し、都度activationすることで次へ進む。

### 6.4 案A/B比較

| | 案A: Guided Sequence | 案B: Choice Sequence |
|---|---|---|
| 方式 | 次に見るtargetだけ強調表示。反応すると次へ | 複数targetから「次はどれか」を選ばせる |
| 認知負荷 | 低い（1つしか選択肢がない） | 高い（順序の記憶・予測が必要） |
| mistake概念 | 不要（強調されたtarget以外は反応しないか、そもそも他targetを目立たせない） | 必要（誤ったtargetを選ぶ可能性がある） |
| Gaze/Switch Scanとの整合 | 高い（scan候補が常に1つ、dwell対象も1つ） | scan候補が複数で認知的にも操作的にも重い |
| 因果関係の理解しやすさ | 高い（反応→次への遷移が明確） | 低い（順序を覚えていないと成立しない） |

### 6.5 推奨開始方式
**Guided Sequence型（案A）を第一候補とする。** 理由は上表の通り、mistake概念を減らせる／gazeで成立しやすい／Switch Scanと整合／因果関係を理解しやすい、の4点に集約される。Choice Sequence型（案B）は、Guided Sequence型の実装・実証後の発展形として将来検討する（本Phaseでは実装しない）。

### 6.6 Level案（最低3段階）
- Level1: target 2個の最短シーケンス（A→B）。強調表示のみで進行。
- Level2: target 3個のシーケンス（A→B→C）。
- Level3: シーケンス長を延ばす、またはtarget位置パターンを変える（左右→上下等）。ただし依然としてGuided Sequence型を維持し、選択式にはしない。

---

## 7. 共通Input Adapter設計

### 7.1 Input EventとSemantic Actionの分離（共通原則）

```
Touch tap / touch-hold
Gaze dwell completion
Switch scan → activation
Keyboard focus → Enter/Space
        ↓
   semantic action:  activateTarget(targetId, inputMethod)
```

教材のロジック（何が起きるか）は`activateTarget()`一箇所に集約し、入力方式ごとにロジックを複製しない。これはPhase26-D7でPointer Eventsがtouch/mouseの二重実装を解消したのと同じ設計思想を、Gaze/Switch Scanまで拡張するものである。

### 7.2 Common Target Model（案）

```js
{
  id,            // 一意識別子。かたちをあわせようのcomposite id方式（type+size）と同様、
                 // 意味的キー（role等）から導出できる設計を優先し、DOM順序に依存させない
  role,          // 'primary' | 'distractor' | 'sequence-step' 等、教材ごとに定義
  label,         // TTS/aria-label用。internal idを直接ユーザー向けに出さない（Phase26で確立した原則を継承）
  active,        // 現在の入力対象かどうか（scan highlight / gaze dwell対象）
  completed,     // activation済みかどうか
  visualState    // 'idle' | 'gaze-progress' | 'scan-highlight' | 'activated' 等
}
```

### 7.3 Common Canonical State（案）

```js
{
  phase,               // 'idle' | 'active' | 'feedback' | 'complete' 等、教材ごとに定義
  activeTargetId,
  completedTargetIds,
  trialIndex,
  sessionStart,
  inputMode            // 直近の入力方式（記録用。Phase26のinputMethod記録パターンを継承）
}
```

Canonical/Transient分離はPhase26-E v1.1標準の既存原則をそのまま継承する。教材固有のstate（例: じゅんばんにみようのsequence定義、みるとひろがるのanimation対象）は無理に共通structへ押し込めず、教材ごとに拡張する。

### 7.4 Transient State（共通候補）

- gaze dwell timer / dwell progress
- scan index / scan timer
- touch pressed（視覚feedback用、canonical判定には使わない）
- visual animation state

これらはCanonical stateと分離し、記録（records）には基本的に含めない（39章寄りの整理）。

---

## 8. 入力方式別の共通仕様

### 8.1 Gaze共通仕様

検討項目と本書での扱い：
- **dwell duration**: 27章参照。600/900/1200msの3択を候補とするが、初期実装では固定値（900ms、既存katachi-awase-app/kurabeyou-appと同じ）から開始し、設定UIの追加は将来判断とする（45章のPilot後に判断材料が揃う）。
- **dwell progress表示**: 必須。無音・無表示で待たせない（重度児にとって「何が起きているか分からない待機」は離脱要因になりうる）。
- **transition guard**: Phase26のD6同様、選択中/activation直後のtargetをdwell候補から一時的に除外する非対称ルールを踏襲する。
- **jitter tolerance**: 視線トラッキングの微小揺れでdwellがリセットされない許容範囲を持たせる。
- **cooldown**: activation直後の再dwellを一定時間抑制し、意図しない連続activationを防ぐ。
- **stale dwell prevention**: target構成が変化した（次のtargetへ進んだ等）際に、古いdwell進捗を必ず破棄する。

### 8.2 Switch Scan共通仕様
auto scan / manual scanの両対応、one-switch/two-switch、scan interval、wrap、highlight、activation、pause after activationを既存標準12章に準拠して整備する。**候補数は各教材のLevel1で1〜2、最大でも3程度に抑える**（29章）。

#### 8.2.1 Gaze × Switch Scan 視覚的共存パターン（Phase M2.1で確立、他アプリへ再利用可）
両入力を同時ONにできる設計（8.5章）である以上、Gaze dwell進行リングとSwitch Scanハイライトが同じtarget上で同時に表示されうる。「みるとひろがる」の実装・検証（Phase M2.1）で、両者の描画帯を同じ半径近辺に置くと視覚的に区別できなくなることが確認された。確立した対処パターン: **target本体（内側）→ gaze dwell進行リング（中間、target境界のすぐ外）→ Switch Scanハイライト（外側、gaze リングの外縁から明確な間隔を空ける）** の3層を同心円状に配置し、色だけでなく形状（gaze=進行に応じた塗りつぶし弧、switch=破線アウトライン）でも区別できるようにする。この半径の間隔（実装値の目安: gazeリング外縁からswitchアウトラインの内縁まで4〜6px以上）は、target size・入力方式が同じ限り他のMulti-Input教材でも再利用できる。

### 8.3 Touch共通仕様
tap、touchstart時の即時視覚feedback、大きなhit area、誤操作許容（小さな指ズレでactivationが暴発しない）。**dragは原則不要**（既存2教材のようなdrag-and-dropは本Program非対象）。

### 8.4 Keyboard共通仕様
Tab / Enter / Space。開発・検証・支援者操作・アクセシビリティ上の入力として維持するが、対象児童の主入力としては想定しない。

### 8.5 Input Mode UI
既存どのまな標準（7章: 設定入口一本化）との整合を優先し、**A. 自動併用（Touch/Gaze/Switchすべて同時に有効）を既定**とする。Mode選択UI（B）は、複数入力が同時に競合する具体的な問題が確認された場合にのみ追加を検討する（過剰な設定はしない、45章）。

### 8.6 Multi-Input Conflict対策
**1 physical input = 1 semantic activation** を原則とする。Touch中にGaze dwellが完了する等の競合ケースには、activation発生時に短い「activation lock」（例: 300〜500ms）を設け、同一target・同一trialに対する二重activationを防ぐ。この間は他の入力方式からのactivationも無視する。

---

## 9. Feedback / Sensory設計

- **強すぎる刺激を避ける**: 点滅・高速flashは禁止（55章）。
- 候補: visual expansion、gentle animation、color change、sound、TTS。振動は「可」だが必須にはしない（デバイス依存が大きいため）。
- **音がなくても学習が成立すること**を必須要件とする（音声/環境の制約がある利用シーンを想定）。
- 音の役割はreinforcement/cue/completionのいずれかを教材ごとに明確化し、混在させない。
- **Sensory Load調整**（しずか/ふつう/にぎやか等の3段階）は価値があるが、設定複雑化とのtradeoffが大きいため、**M0では正式仕様としない**。Pilot App実装後、実際に刺激量調整のニーズが確認された場合に追加を検討する（67章の判断事項）。
- TTSは単語・短文中心。Gaze教材では音声再生がdwell進行の妨げにならないこと（dwell中に長い音声を挟まない）。

---

## 10. Error Philosophy（既存教材との明確な差別化）

既存のquiz型教材（かたちをあわせよう等）のcorrect/mistakeモデルを機械的に持ち込まない。初期Levelでは「失敗」というfeedbackを極力減らし、**働きかけたこと自体を肯定的feedbackにつなげる**。この方針は教材ごとに5章・14章・18章で個別に整理済みだが、Program共通の哲学として改めて明記する。

---

## 11. Records Philosophy

### 11.1 基本方針
従来のcorrect/mistakeだけでは不十分。**教材上で観察できた行動のみ**を保存し、診断的解釈（「理解している」等）は自動記録しない（例: 「5秒注視した」は可、「理解している」は不可）。

### 11.2 記録候補
target activation count、first response latency、dwell completion、input method、repeated activation、session duration、target preference（どのtargetに反応が集中したか）、sequence completion、skipped target、response count。

### 11.3 Session Grouping
1 activation = 1 sessionにはしない。「開始→一連のtrial→終了」を1セッションとする既存教材（かたちをあわせよう等）のパターンを踏襲する。

### 11.4 CSV共通列候補
date, app, level, target, inputMethod, responseTime, dwellDuration, result, trial。**列を大量に増やさない**——既存教材（かたちをあわせよう12列、くらべよう16列）の実績を踏まえ、教材ごとに本当に必要な列のみを追加する。

### 11.5 Privacy
既存方針（ブラウザlocalStorage中心）を維持。個人名・医療情報は記録しない。

---

## 12. Responsive / Large Target / Common Chrome

- 最重要viewport: **375×667**。追加確認: 375×812 / 390×844 / 768×1024 / 1280×900（既存標準30章と同一方針）。
- **Large Target Principle**: target数を減らし、targetを大きくすることを優先する。小さなボタンを多数配置しない（43章）。
- Common Chrome（home/settings/fullscreen/accessibility）との重なりを考慮し、教材領域を最大化する（既存標準8章と同一方針）。

---

## 13. Accessibility

WCAG/JISを意識し、semantic buttons、accessible names、focus、high contrast、reduced motion、TTS、Switch Scan、gazeを既存標準（11-13章、37章）に準拠して整備する。

**Reduced Motion**: animationが教材の本質（例: みるとひろがるの「広がる」演出）である場合でも、reduced-motion設定時に完全停止ではなく代替feedback（色変化やサイズ変化のジャンプカット等）を用意する必要がある——これは既存標準15章の一般原則を、演出が学習内容そのものである本Program向けに具体化したものである。

---

## 14. Naming / Icon Concept

### 14.1 正式表示名・ファイル名候補

| 表示名 | app id候補 | filename候補 |
|---|---|---|
| みるとひろがる | miru-hirogaru | `miru-hirogaru-app.html` |
| みつけてタッチ | mitsukete-touch | `mitsukete-touch-app.html` |
| じゅんばんにみよう | junban-miyou | `junban-miyou-app.html` |

既存命名規則（`{ローマ字}-app.html`、apps-data.jsonへの`id`/`filename`登録）と整合している。確定はPhase M1（各教材の個別設計）で行う。

### 14.2 Icon方向性（言語のみ、画像生成なし）
- みるとひろがる: 中心から外側へ広がる同心円、または光の演出を示唆する柔らかい放射状モチーフ
- みつけてタッチ: 虫眼鏡やタップ痕を思わせる、発見・選択を示すシンプルな指標
- じゅんばんにみよう: 1→2→3のような順序性を示す矢印または番号ドット

---

## 15. Shared Foundation戦略

**最初から巨大な共通ライブラリを作らない。** Phase25のSwitch Scan横展開の経験（各アプリへの個別適用→パターン収束→標準化、という順序で進んだこと）を踏まえ、以下の順序を推奨する。

1. **1本目（Pilot）で小さな共通Input Adapterを実装・検証**
2. **2本目で共通化ポイントを再検証**（1本だけでは「本当に共通化すべき部分」と「教材固有の部分」の境界が誤って引かれるリスクがあるため）
3. **3本目で正式に共通化**（例えば`multi-input-common.js`のような共有ファイルを切り出すのはこの段階）

### Pilot App: 「みるとひろがる」
理由: semantic actionが最も単純（activateTargetのみ、複数ステップ操作がない）、correct/mistakeモデルが不要（原則3をもっとも純粋な形で検証できる）、Gaze中心でありながらSwitch/Touchも自然に成立する、共通input adapterの最小構成を検証しやすい。

---

## 16. Development Order / Phase構成案

### 16.1 開発順序の評価
推奨順序（みるとひろがる→みつけてタッチ→じゅんばんにみよう）は、3章で整理した学習発展系列（反応→選択→順序）と一致しており、認知負荷の低い順に実装することで、共通基盤の検証も段階的に難度が上がる形になる。**この順序を推奨する。**

### 16.2 Phase構成案

| Phase | 内容 |
|---|---|
| M0 | 共通設計（本書） |
| M1 | 「みるとひろがる」個別設計（Level詳細・DOM構成・状態遷移・命名確定） |
| M2 | 「みるとひろがる」実装（共通Input AdapterのPilot実装を含む） |
| M3 | 「みるとひろがる」実授業前Validation・Release Approval Gate |
| M4 | 「みつけてタッチ」設計・実装（M2の共通Adapterを再利用・検証） |
| M5 | 「みつけてタッチ」Validation・Release |
| M6 | 「じゅんばんにみよう」設計・実装（共通Adapterの正式共通化を検討） |
| M7 | 「じゅんばんにみよう」Validation・Release |
| M8 | 3教材共通振り返り・共通ライブラリの正式切り出し判断 |

M2/M4/M6それぞれで「実装→Validation→User Review→Explicit Approval→Release」のRelease Approval Gateを踏む（3教材いずれも新規アプリの初回公開に該当するため、既存標準48章に基づき必須）。

---

## 17. Release Policy

3教材はいずれも新規アプリであり、初回Production公開は**Release Approval Gate必須**（設計→Implementation→Validation→User Review→Explicit Approval→Release）。本Phase M0はこのGateの「設計」段階に相当し、次のGate対象はM2（みるとひろがる実装）以降となる。

---

## 18. 確定事項（Phase M0承認・2026-08-13）

以下はM0時点で「残存論点」としていたが、ユーザーにより確定した。以降のPhase（M1以降）はこれを前提とする。

1. **dwell時間**: **初期値900msに確定**（8.1章）。将来600/1200ms等への拡張余地は設計上残すが、可変設定は現時点で実装しない。
2. **初期Levelでmistakeを持つか**: **設けない**（5.6章）。子どもが働きかけたこと自体を成功として扱う（success-only）。
3. **sensory feedback量**: **M1では「ふつう」相当を標準とし、しずか/ふつう/にぎやかの3段階設定は実装前提にしない**（9章）。
4. **scan方式**: **初期標準はAuto Scan**（8.2章）。Manual Scan/2-switchへの将来拡張余地は設計上残す。
5. **input mode UI**: **自動併用に確定**（8.5章）。Touch/Gaze/Switchを排他的モード選択にしない。
6. **records項目**: **必要最小限から開始**。観察可能な行動のみ記録し、診断的解釈は保存しない（11.2章の候補から各アプリの個別設計で取捨選択する）。
7. **development order**: **みるとひろがる→みつけてタッチ→じゅんばんにみようで確定**（16.1章）。

---

## 19. 引用・参照した既存資料

- `docs/design-system/donomana-new-app-development-standard-v1_0.md`（v1.1運用中）: Release Policy(48章)、Canonical/Transient State(17章)、Input Asymmetry、Switch Scan(12章)、gaze/dwell(13章)、Pointer Events Standard(49章)、Rendered Validation(27-29章)、responsive(30章)、Records/CSV(22,26章)、更新履歴(44章)を参照。
- `katachi-awase-app.html`（Phase26-D〜I5.1）: Pointer Events統一drag、composite id設計、Switch Scan/gaze D6非対称仕様、Rendered Validation手法（stroke幅ピクセル計測）を参照。
- `kurabeyou-app.html`: 記録/CSV設計、レベル切替UI、Design System適用の参照実装として使用。

---

## 20. Phase M8知見: Engagement RedesignとProgram共通原則の関係

「みるとひろがる」Phase M8（Engagement Redesign、詳細は`docs/multi-input/miru-hirogaru-design-v1.md`30章）で得られた、他教材にも再利用価値のある知見を2点記録する。

1. **資産/意味分離（asset/semantic separation）はEngagementとMulti-Input Equityを両立させる。** `activateItem(itemId, inputMethod)`のようなsemantic activation APIの外形を変えずに、target実装を図形からイラストアセット（ready/active2状態のPNG差し替え）へ差し替えることで、Touch/Gaze/Switch/Keyboardの等価性（7章の共通Input Adapter原則）を一切崩さずに視覚的訴求力を大幅に高められる。すなわちEngagement向上は「入力方式ごとの特別扱い」を必要としない——同一のsemantic状態（例: `.is-activated`）をGaze対象抽出・Switch Scan候補抽出双方が参照する構造を保てば、どれだけビジュアルを作り込んでもInput Equityは自動的に維持される。
2. **Sound Experienceにおいて「技術的再生成功」と「体感品質」は独立した合格基準である。** 「どこかな？みーつけた！」M7.1〜M7.1eのBGM実験（実機で鳴ることの確認は複数回成功したが、音質・自然さの面でUser Reviewを通過できず最終的に不採用）を踏まえ、本Phaseでは新規BGMを追加しないという判断を先取りして行った。今後BGMやCustom SFXを追加する教材でも、Playwright等での「鳴ることの確認」だけをRelease基準にせず、実際に聴いた上でのUser Review Gateを必須とする。

---

## 21. Phase M10知見: Guided Attentionの位置づけ

「じゅんばんにみよう」（詳細は`docs/multi-input/junban-miyou-design-v1.md`）の設計・実装で明確化した点を1つ記録する。

**Guided Attentionは「正解を教えるUI」ではなく、次に注意を向けやすくする支援である。** 6.5章で選定した「Guided Sequence型」はdistractorを持たないため、対象が正誤判定の手がかりになることはない。Guided Attention（gentle scale＋soft glow＋inner ring）は、唯一操作可能な対象の「気づきやすさ」を高めるための演出であり、複数候補から正解を選ばせるための強調表示ではない。この区別は、既存のGaze dwell ring（8.1章）・Switch Scan highlight（8.2.1章）と役割・視覚层を明確に分離する設計判断の前提になっている。なおGuided Attentionは専用のtiming定数群を持つ独立した機構ではなく、既存のLevel3 flow（boarding/departure等）のタイミング設計に内包された視覚演出として実装されている（M11監査で確認、22.6章）。

---

## 22. Phase M11知見: 3教材横断監査で確定したFoundation

Phase M11（Multi-Input Pilot 3-App Cross-Audit / Foundation Close）で、「みるとひろがる」「みつけてタッチ」「じゅんばんにみよう」の実装を横断監査し、15章で示した「1本目で試作→2本目で再検証→3本目で正式共通化」の判断点に到達した。本章はその監査結果を、今後のMulti-Input教材（4本目以降）が最初から採用すべきFoundationとして整理する。分類基準は「A: 今すぐFoundationとして固定（新規教材で原則必須）」「B: 次の新規教材から採用（既存3本へのretrofit不要）」「C: 教材固有（共通化しない）」「D: 追加調査」の4段階。

### 22.1 Foundation A（今すぐFoundationとして固定）

3教材すべてで値・実装パターンが完全一致し、かつ意図的な設計判断として文書化されていることを確認したもの。今後の新規教材は特段の理由がない限りこれらをそのまま採用する。

- **Semantic Activation Architecture**: `activateXxx(targetId, inputMethod)`という2引数の単一関数へTouch/Gaze/Switch/Keyboardの4入力ハンドラすべてを合流させる設計（7章）。3教材とも入力方式ごとのロジック複製は皆無だった。
- **dwell = 900ms固定**（8.1章で確定済みの値がそのまま3教材で踏襲）。
- **Switch Scan interval = 1500ms**、**activation lock = 300ms**（教材固有の理由がある場合はこれに加算してよい。例: じゅんばんにみようは乗車移動アニメーション分`BOARD_TRAVEL_MS`を加算）。
- **helper6パターン**（`buildScanItems`/`startSwitchScan`/`stopSwitchScan`/`refreshSwitchScanItems`/`activateCurrentScanItem`/`clearScanHighlight`）と`isVisibleEnabled(el)`: 3教材で関数名・実装ロジックがほぼ完全一致。
- **Level1（候補1個）でのSwitch Direct Activation**: scan cyclingを行わずswitch押下で即activationする設計が3教材全てに存在し、判定条件・document-level keydown分岐まで共通化されている。9章で挙げた論点はこれをもって「Multi-Input Foundation標準」として確定する。
- **Gaze re-trigger gate**（`gazeAwaitingLeaveId`による「leave-and-reenter」パターン）と`resetDwellState()`命名。
- **Gaze targetは常に学習targetのみ、common chromeを含めない**（`getGazeTargets()`が3教材ともcommon chrome要素を返さない設計で統一。13章の原則の実装レベルでの確認）。
- **Touch**: hit area 44px超のwidth/height明示指定、8px移動しきい値による`suppressNextClick`パターン（tap/drag誤判定防止）。
- **success-onlyのFeedback Philosophy**: 3教材とも`correct`/`mistake`/`score`フィールドを持たず、コード中コメントに一貫して「success-only」「observed behavior only、no diagnostic interpretation」が明記されている。×・赤・ブザー・「ちがう」等の否定的表現は皆無。
- **Records**: `date/level/inputMethod/responseTime/dwellDuration`の5フィールドは3教材でフィールド名まで統一。`groupIntoSessions()`によるUI表示側セッション集約（生ログ自体は1 activation = 1 entryのフラット構造を維持）も3教材でほぼ同一実装。
- **1 physical input = 1 semantic activation**（8.6章）: M11で3教材に対しTouch/Gaze/Switch/Keyboardを同一targetへ同時発火させるstress testを実施し、いずれも二重activationが発生しないことを実機（Production）で確認した。
- **sound OFF時にAudioContext/oscillatorを生成しない**設計（`soundEnabled`フラグによるガード）。
- **Common Chrome標準（Home/Lock/Fs/A11y）のgenerate.js注入のみを使用し、独自実装を持たない**こと（M10-J是正後、3教材で確認）。

### 22.2 Foundation B（次の新規教材から採用、既存3本へのretrofitは不要）

- **SFX Perceptual Design**（Phase M10-I/M10-I-2知見）: 数値上のpeak/RMSだけでは知覚音量を判断できない。小型スピーカーは低域（150Hz未満）を強く減衰させるため、低域中心のSFXは電気的に大きくても知覚的に小さく感じられる。対策として(a) 150〜300Hz程度のmid body成分の追加、(b) onset transient（短いclick/pop）による立ち上がりの手応え、(c) 聴覚の時間積分窓（約200ms）を意識した継続時間、(d) 複数の短い断片で構成する音は断片間の無音gapを詰める、の4点を今後のSFX設計時に最初から考慮する。実測はOfflineAudioContextでの数値検証に加え、実ブラウザでの聴取確認（User Review）を両方必須とする（20.2章の既存原則を強化）。
- **Timing Accessibility ≒ 「速い＝快適」を適用しない**: じゅんばんにみようのDeparture演出（停車位置から画面外まで完全に退出するまで約5.5秒、reduced motion時は約400msへ短縮）は、一般的なWeb UIなら「遅すぎる」と判断されうる時間だが、「子どもが完成状態を見届けられること」自体を目的として意図的に設計された。今後の教材でも、気づく・見る・反応する・追視する・見届けるための時間は短縮対象ではなくアクセシビリティ要件として扱う。
- **Records CSV**: 列を7〜9列程度に収める既存方針（11.4章）は3教材で守られている。ただし11.4が示した共通列候補のうち`app`（保存key名で暗黙に判別できるため不要）と`result`（success-onlyのため不要）は3教材とも実装しておらず、これは意図的な簡略化として追認する。11.4章の候補リストは「その教材で本当に意味を持つ列だけ採用してよい」というガイドとして扱い、全列の実装を義務としない。
- **Pre-Production Checklistへの明示チェック追加**（M10-J・M11で判明、詳細は`docs/design-system/donomana-new-app-development-standard-v1_0.md` v1.2 §56・57 Case I）。

### 22.3 Foundation C（教材固有、共通化しない）

- Level/Room/Round遷移待ち時間（`NEXT_TRIAL_MS`等）は700ms〜1200msの間で教材の情報量に応じて個別設計されており、統一しない。
- `commonChromeCandidates()`（Switch Scanの共通chrome候補範囲）: みるとひろがる・みつけてタッチはHome/Lock/Fs/A11yの4つを候補に含めるが、じゅんばんにみようはA11yのみ（`junban-miyou-design-v1.md`に明記された個別設計判断）。「含める/含めない」自体は教材ごとに明示決定する現行ルール（12章）を維持し、一律標準化しない。
- Records/CSVの`target`相当フィールド名（`target`/`selectedPosition`/`passenger`）は教材の意味に応じて異なる名前を使ってよい。無理に共通名へ揃えない。
- SFX種類数・複雑さ（みるとひろがる6種+noise burst、みつけてタッチ1種、じゅんばんにみよう3種）は教材の役割に応じたスコープで妥当であり、一律の音数・構成を求めない。

### 22.4 Foundation D（追加調査、まだ標準化しない）

- **Keyboard Escape一貫性**: じゅんばんにみようのみアプリ本体`settingsPanel`にEscapeで閉じる独自ハンドラを持つ。みるとひろがる・みつけてタッチの自アプリ設定パネルはEscapeに未対応（共通A11yパネルのEscapeのみ対応）。重大な不具合ではないが、3教材間の一貫性という観点では要検討。次の新規教材着手前に別Fix Phaseで方針を決める。
- **Shared Code化の是非**（23章参照）: helper6・`isVisibleEnabled`・Touch 8pxしきい値・CSV BOM書き出し等は3教材でほぼ逐語的に一致しており、15章が想定した「3本目での正式共通化」の判断点に到達している。ただしこのリポジトリはビルド工程を持たない自己完結HTML群（`package.json`なし、`generate.js`のみ）であり、ランタイムで`<script src>`により外部JSを読み込む方式は各アプリの自己完結性を損なう。M11時点では、`generate.js`の既存の「マーカーコメント差し替えによる注入」方式（Common Chromeで実績あり）をMulti-Input共通helperへ拡張できないか、という設計方向のみを次Phase候補として記録し、本Phaseでは実装しない。

### 22.5 Asset Production Lessons

- 「みるとひろがる」の`piano-ready.png`/`piano-active.png`は2枚合計約3.51MBで、同アプリのasset合計（約4.86MB）の約69%を占める。他の10枚（1枚あたり数十〜200KB台）と比べ突出しており、将来のasset最適化Phaseで優先対象とする（本Phaseでは最適化しない）。
- 「じゅんばんにみよう」の`passengers/*.png`（非active版、717〜802px、400〜680KB台）は、対応する`*-active.png`（614×410、130〜200KB台）より3〜5倍大きい非対称な構成になっている。M10-Eで導入された「Dedicated Active Boarding Asset」がactive版のみ実rendered size×DPR基準で最適化され、非active（ready）版は最適化されないまま残った可能性が高い。M10-Gで確立した「実rendered size×DPRを基準にProduction解像度を決める」手法を、ready/active両方の状態へ一貫して適用することを今後のAsset Production Standardの原則として明記する。
- 上記2件はいずれも「今すぐ最適化」ではなく「将来まとめて最適化」を推奨する（現時点でProduction上のfailed request・表示不具合は確認されていないため）。
