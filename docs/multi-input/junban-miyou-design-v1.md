# 「じゅんばんにみよう」設計書 v1.0（Phase M10-A/B）

Multi-Input Program 3教材目。設計方針は [multi-input-program-design-v1.md](./multi-input-program-design-v1.md) の6章・7章を継承する。本書はPhase M10-A（Learning/UX/Visual Design）とPhase M10-B（Visual Asset Production / Local Prototype）の内容を統合して記録する。

## 1. 学習目標

「順番に現れる対象に気づき、見る・触れる・スイッチなど自分の使える方法で働きかけながら、次の対象へ注意を移していく経験を楽しむ。」

**重要な設計原則**：「正しい順番を理解できたか」を正誤判定する教材にはしない。Guided Attention（次に注意してほしい対象をやさしく目立たせる演出）によって、次の対象へ自然に注意を導く。distractor（誤答となりうる別の対象）は画面上に存在させない設計とし、Program設計書6.4章の「案A: Guided Sequence型」を全Levelで一貫して採用する。

## 2. 世界観

正式アプリ名は「じゅんばんにみよう」（表示名・filenameとも変更しない）。画面内のサブ世界観として「しゅっぱつ！おもちゃのれっしゃ」を使用する。パステル調のおもちゃ鉄道の世界で、かわいい動物たちが1体ずつ列車へ乗っていく。世界観そのものがsequence（順序）を表現する。

## 3. Visual Asset

### 3.1 Source of Truth
Phase M10-Aで生成・User承認済みの Visual Reference Sheet（`junban-visual-reference.png`）から個別assetを抽出した。新規SVG描画・新規AI画像生成は行っていない。

### 3.2 抽出方法
Python(PIL)でsheet内の各要素を自動検出（非白色ピクセルのバウンディングボックス検出）し、タイトクロップ＋背景透過（白色からの距離に基づくアルファ変換＋2px feather）を行った。抽出後、全16asset を目視で品質確認（隣接asset混入なし・shadow/outline欠けなし・透過正常）。

### 3.3 Asset一覧（`assets/junban-miyou/`）
- `train/locomotive.png` — 機関車（左向き3/4view）
- `train/carriage-{pink,orange,green,blue,purple}.png` — 空車両5色
- `passengers/{rabbit,cat,dog,bear,chick}-ready.png` — Ready状態（列車の外）
- `passengers/{rabbit,cat,dog,bear,chick}-active.png` — Active状態（車両に乗車済み、各なかま専用の車両色と合成済み）

### 3.4 なかま↔車両色の対応（固定）
| なかま | 車両色 |
|---|---|
| うさぎ (rabbit) | ピンク |
| ねこ (cat) | みずいろ |
| いぬ (dog) | むらさき |
| くま (bear) | オレンジ |
| ひよこ (chick) | みどり |

この対応は乗車順（sequence順）に関わらず固定。列車内での車両の並び順は、その回のsequence順（左から乗った順）になる。

## 4. Level設計

全Level共通で、画面には常に「今はたらきかけられる対象」が1体のみ存在する（distractorなし）。乗車後、`BOARD_ANIM_MS`(480ms) → `NEXT_APPEAR_DELAY_MS`(650ms) を経て次のなかまが出現する。

### Level1「ひとつずつ」
- 位置は常に中央（`center`）固定。最も大きく表示。
- 乗車ごとに新しいなかまが即座に出現し、無限に継続する（「しゅっぱつ」演出は発生しない）。
- Switch = Direct Activation（Auto Scanなし、Spaceキーで即activation）。

### Level2「つぎはどこ？」
- 出現位置が7候補（`left/right/upper-left/upper-right/lower-left/lower-right/center`、直前と同一位置は避ける）の中でランダムに変化する。
- Level1同様、乗車ごとに次のなかまが即座に出現し継続する（departureなし）。矢印などの位置指示UIは使わない。Guided Attention（後述）のみで次の対象に気づけるようにする。
- Switch = Auto Scan（1500ms間隔）。

### Level3「みんなでしゅっぱつ！」
- 1ラウンド = 3体（MVP、5体中からランダム抽出、直前ラウンドと完全一致しないことを保証）。
- 1体ごとに列車の対応する車両へ乗車していく様子が視覚的に積み上がる。
- 3体全て乗車すると `departureBanner`（「しゅっぱつ！」）表示＋列車が画面外へ短く移動するアニメーション（1s）＋SFXが再生され、その後新しいラウンドが始まる。
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
