# 「じゅんばんにみよう」設計書 v1.0（Phase M10-A/B/C）

Multi-Input Program 3教材目。設計方針は [multi-input-program-design-v1.md](./multi-input-program-design-v1.md) の6章・7章を継承する。本書はPhase M10-A（Learning/UX/Visual Design）、Phase M10-B（Visual Asset Production / Local Prototype初版）、Phase M10-C（High-Resolution Visual Asset Replacement / Achievement・Accumulation UX Fix）の内容を統合して記録する。

## 1. 学習目標

「順番に現れる対象に気づき、見る・触れる・スイッチなど自分の使える方法で働きかけながら、次の対象へ注意を移していく経験を楽しむ。」

**重要な設計原則**：「正しい順番を理解できたか」を正誤判定する教材にはしない。Guided Attention（次に注意してほしい対象をやさしく目立たせる演出）によって、次の対象へ自然に注意を導く。distractor（誤答となりうる別の対象）は画面上に存在させない設計とし、Program設計書6.4章の「案A: Guided Sequence型」を全Levelで一貫して採用する。

## 2. 世界観

正式アプリ名は「じゅんばんにみよう」（表示名・filenameとも変更しない）。画面内のサブ世界観として「しゅっぱつ！おもちゃのれっしゃ」を使用する。パステル調のおもちゃ鉄道の世界で、かわいい動物たちが1体ずつ列車へ乗っていく。世界観そのものがsequence（順序）を表現する。

## 3. Visual Asset

### 3.1 Source of Truth（Phase M10-C で刷新）
Phase M10-BではVisual Reference Sheet（`junban-visual-reference.png`）から個別assetをPIL自動クロップで抽出していたが、**User Visual Reviewで画質不足（ぼやけ・隣接イラスト混入）が指摘され、Phase M10-Cで方式を全面刷新した**。

現在の方式：Userが個別に用意した高解像度assetをそのまま使用する。Reference Sheetからの再トリミングは廃止し、Visual Reference Sheetは世界観・配色確認用のみに用途を限定する（3.1旧方式は廃止、新方式に完全移行）。

### 3.2 Asset仕様
- passenger: 1024〜1536px級、RGBA・透明背景。5体とも1枚の独立イラストとして提供され、専用の「Active（車両に乗った状態）」画像は存在しない。
- train: locomotive・carriage 5色とも1536×1024、RGBA・透明背景。
- Ready/Activeの区別は、**同一のpassenger画像をCSSでcarriage画像の上へlayer合成する**ことで実現する（`.jm-car-rider`）。専用のActive画像を用意する必要がなくなり、asset数が16→11に削減された。

### 3.3 Asset一覧（`assets/junban-miyou/`）
- `train/locomotive.png` — 機関車
- `train/carriage-{pink,orange,green,blue,purple}.png` — 空車両5色
- `passengers/{rabbit,cat,dog,bear,chick}.png` — なかま5体（単一の高解像度イラスト、Ready/Active共用）

### 3.4 なかま↔車両色の対応（固定）
| なかま | 車両色 |
|---|---|
| うさぎ (rabbit) | ピンク |
| ねこ (cat) | みずいろ |
| いぬ (dog) | むらさき |
| くま (bear) | オレンジ |
| ひよこ (chick) | みどり |

この対応は乗車順（sequence順）に関わらず固定。列車内での車両の並び順は、その回のsequence順（左から乗った順）になる。

## 4. Level設計（Phase M10-C で Achievement / Accumulation UX Fix を適用）

Phase M10-BではLevel1/2は1体乗せるごとに即次のなかまへ切り替わり、働きかけた結果が画面上に残らないという課題があった（User Feedback）。Phase M10-Cで**全Levelを「5体全員を順に乗せ、乗せた結果が列車として画面に残り続ける」構成へ統一**した。

全Level共通の仕様：
- 1ラウンド = 5体（`PASSENGERS`の全員、`LEVEL_SEQUENCE_LEN`は全Level `5`）。
- 画面には常に「今はたらきかけられる対象」が1体のみ存在する（distractorなし）。
- 乗車した仲間は**列車の対応する車両に残り続ける**（`completedPassengerIds`はラウンド完了までクリアしない。車両画像はcarriage＋riderのlayer合成で、乗車後も消えない）。
- 5体全員が乗車すると、完成した列車をそのまま`COMPLETE_HOLD_MS`(750ms)見せてから、「みんな のった！」のsoft completion→`しゅっぱつ！`のdeparture演出（列車が画面外へ移動、SFX）→新ラウンド開始、という流れになる。

### Level1「ひとつずつ」
- 位置は常に中央（`center`）固定。最も大きく、最も分かりやすい条件で「働きかける→乗る→残る」を経験する。
- Switch = Direct Activation（Auto Scanなし、Spaceキーで即activation）。

### Level2「つぎはどこ？」
- 出現位置が7候補（`left/right/upper-left/upper-right/lower-left/lower-right/center`、直前と同一位置は避ける）の中でランダムに変化する。矢印などの位置指示UIは使わない。Guided Attention（後述）のみで次の対象に気づけるようにする。
- Switch = Auto Scan（1500ms間隔）。

### Level3「みんなでしゅっぱつ！」
- 位置は中央固定（Level1と同様）。5体全員での完成・しゅっぱつを最も気持ちよく体験できることに主眼を置く（位置の複雑さより、完成体験の質を優先）。
- 1体ごとに列車の対応する車両へ乗車していく様子が視覚的に積み上がる。
- 5体全て乗車すると`COMPLETE_HOLD_MS`(750ms)完成列車を見せてから、`departureBanner`（「しゅっぱつ！」）表示＋列車が画面外へ短く移動するアニメーション（1s）＋SFXが再生され、その後新しいラウンドが始まる。
- Switch = Auto Scan。

## 5. Guided Attention

「正解を教えるUI」ではなく、次に注意してほしい対象をやさしく目立たせる演出。実装は3層構造：
1. **Guided Attention**（最内側）: `radial-gradient`の淡いglow＋1.03〜1.06倍のgentle scale pulse＋薄いring。常時、現在の対象へ適用（唯一の対象なので「区別」ではなく「気づきやすさ」の演出）。
2. **Gaze dwell ring**（中間）: 既存標準（mitsukete-touch/みるとひろがる）と同一の同心円conic-gradientパターンを再利用。
3. **Switch Scan highlight**（最外側）: 破線outline、offset 16px。

3層は半径・形状（塗り/破線/glow）の両方で視覚的に分離しており、Phase M2.1で確立した「Gaze×Switch Scan視覚的共存パターン」をそのまま踏襲・拡張した。reduced motion時はscale pulseアニメーションのみ停止し、glow/ring自体は表示を維持する。

## 6. Negative Feedback

一切実装していない。×・赤・ブザー・「ちがう」等は存在しない。操作可能な対象以外は画面上に存在しないため、原理的に「間違った対象を選ぶ」状況が発生しない。

## 7. Semantic State / API

Program設計書7章の思想を継承しつつ、教材固有の意味が伝わる命名を採用した。

```js
activatePassenger(passengerId, inputMethod)
```

Touch/Gaze/Switch/Keyboardのすべてがこの一箇所に合流する（mitsukete-touchの`activateItem`と同型のパターン）。

### Canonical State
```js
{
  level, phase,               // 'ready' | 'boarding' | 'departing'
  sequenceIndex, currentPassengerId, completedPassengerIds,
  trialIndex, activationCount, sessionStart
}
```

### Transient State
```js
{
  gazePassengerId, gazeStartedAt, gazeAwaitingLeaveId,
  scanIndex, scanTimer, inputLockUntil,
  feedbackTimer, nextAppearTimer, roundResetTimer, guidedAttentionTimer,
  touchStartPos, previousPassengerId, previousPosition, sequence, previousSequence
}
```

Canonical/Transientの分離、`sessionStart`等はProgram標準どおり。Level/Round切替時（`startNewRound`/`setLevel`）に全timerを`clearAllTimers()`で確実にcleanupする。

## 8. Multi-Input

- **1 physical input = 1 semantic activation**: `activatePassenger`冒頭の`phase!=='ready'`ガード＋`inputLockUntil`（300ms）により、Touch連打・Gaze dwell完了とTouchの競合等を防止。Stress test（連続activation・意図的な同一要素への連打含む）で二重activation 0件を確認。
- **Touch**: 210px（モバイルは168px）角の大きなhit area、tap。dragなし。
- **Gaze**: dwell 900ms、既存標準のjitter許容・transition guard・stale dwell resetパターンをそのまま再利用。
- **Switch**: Level1のみDirect Activation、Level2/3はAuto Scan（1500ms）。scan候補は「現在operableなpassenger」＋level切替ボタン＋設定ボタン＋共有a11yボタンのみ（背景装飾は対象外）。
- **Keyboard**: Tab→Enter/Space。DOM順=視覚順=semantic順（対象は常に1つなので自明に一致）。

## 9. Records / CSV

観察事実のみを記録し、正答率・注意力スコア等の能力評価は一切含めない。

CSV列: `日時, レベル, なかま, じゅんばん, ぜんたい数, 入力方法, 反応時間ms, 注視時間ms, trial`

## 10. SFX

BGMなし。Web Audio合成音のみ（外部音源ファイルなし）。
- 乗車時: 「ぽん♪」（2音の短いポップ音）
- なかま出現時: 「きらん♪」（控えめな単音）
- しゅっぱつ時: 「ガタン♪」（低音2音）

Sound OFF設定で完全無音になる（`soundEnabled`フラグで全SFX関数をガード）。

## 11. Responsive / Reduced Motion / High Contrast

- 375×667を最重要viewportとし、375×812/390×844/768×1024/1280×900を含む5viewportでhorizontal overflow 0を確認。
- reduced motion時はGuided Attentionのpulse・乗車アニメーション・departureのtrain移動・sparkleアニメーションを停止し、状態変化（Ready→Active、sequence進行、departure）自体は即時切り替えで明確に残す。
- High Contrast時はasset自体を反転せず、共有a11yパネルの画面全体invertフィルターに委ねる（既存標準と同一）。Guided Attention/Gaze/Switchの3層区別はHC専用の色調整（黄色系）で維持。

## 12. Engagement Principle

Rendered Validationにより、6種のなかまが一貫した画風で表示され、Guided Attention・Gaze・Switchの3層が視覚的に破綻なく共存すること、Level3で列車が1体ずつ実際に埋まっていく様子が視覚的に分かりやすいことを確認した。「かわいい」「次はだれ？」「乗せたい」という反応を狙ったVisual/UX設計だが、最終的な子ども向け適合性の判断はUser Reviewに委ねる。
