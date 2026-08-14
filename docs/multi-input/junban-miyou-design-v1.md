# 「じゅんばんにみよう」設計書 v1.0（Phase M10-A/B/C/D）

Multi-Input Program 3教材目。設計方針は [multi-input-program-design-v1.md](./multi-input-program-design-v1.md) の6章・7章を継承する。本書はPhase M10-A（Learning/UX/Visual Design）、Phase M10-B（Visual Asset Production / Local Prototype初版）、Phase M10-C（High-Resolution Visual Asset Replacement / Achievement・Accumulation UX Fix）、Phase M10-D（Level Differentiation / Real Boarding / Slow Departure UX Fix）の内容を統合して記録する。

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

## 4. Level設計（Phase M10-D で Level Differentiation を適用）

Phase M10-Cでは全Levelが「5体を1体ずつ出して積み上げる」同一構成になっており、Level1とLevel3の体験が重複していた（User Feedback）。Phase M10-Dで**3Levelを明確に異なる構成へ再設計**した。

| | Level1「ひとつずつ」 | Level2「つぎはどこ？」 | Level3「みんなでしゅっぱつ！」 |
|---|---|---|---|
| 1ラウンドの人数 | 1体 | 5体 | 5体 |
| 出現方式 | 中央に1体、乗車後すぐ出発 | 7位置を移動しながら1体ずつ出現 | **5体を画面に同時配置** |
| 積み上げ | なし（毎回1両編成が出発） | あり（1→5両） | あり（1→5両） |
| Guided Attention | 単一対象への集中 | 位置移動への注意 | **複数対象の中から現在targetのみ強調** |

全Level共通：画面上で実際に「働きかけられる」対象は常に1体のみ（distractorなし、正誤判定なし）。

### Level1「ひとつずつ」
- `LEVEL_SEQUENCE_LEN[1] = 1`。1ラウンド=1体、位置は常に中央固定、最も大きく表示。
- 乗車→`COMPLETE_HOLD_MS`確認→1両編成のまましゅっぱつ、を毎ラウンド繰り返す。「働きかける→乗る→出発する」という最も単純な因果関係を、遠回りせず体験できることを重視する。
- Switch = Direct Activation。

### Level2「つぎはどこ？」
- `LEVEL_SEQUENCE_LEN[2] = 5`。出現位置が7候補の中でランダムに変化する（直前と同一位置は避ける）。矢印等の位置指示UIは使わない。
- 乗車した仲間は列車に残り続け、1→2→3→4→5両と積み上がる。5両完成後にしゅっぱつ。
- Switch = Auto Scan（1500ms間隔）。

### Level3「みんなでしゅっぱつ！」（Phase M10-D で再設計）
- `LEVEL_SEQUENCE_LEN[3] = 5`。**5体全員を画面に同時配置**する（`renderLevel3Stage()`、`PASSENGERS[].slot`によるid固定位置、`.jm-l3-slot-0`〜`-4`）。
- 現在target（`transient.sequence[canonical.sequenceIndex]`）のみ実際に操作可能な`<button>`（`.jm-l3-active`、Guided Attention表示）。残り4体は非interactiveな装飾`<span><img></span>`（`.jm-l3-idle`、`role`/`tabindex`なし）で、scan・gaze候補プールに一切含まれない（両者とも`targetArea.querySelectorAll('.jm-passenger-btn')`のみを参照するため自然に除外される）。
- 乗車済みの仲間は`targetArea`から取り除かれ（列車側に残る）、残る4体（→3→2→1→0）の中でGuided Attentionが次のtargetへ移っていく。**複数の対象の中から順番に注意を移す**という、Level1/2とは異なる体験になる。
- 非currentな4体をタップ/クリックしても、`activatePassenger()`の`passengerId !== canonical.currentPassengerId`ガードにより何も起きない（×・赤・ブザー等の否定的feedbackは一切ない、neutral no-op）。
- Switch = Auto Scan（scan候補は常に1体のみ）。

## 5. Guided Attention

「正解を教えるUI」ではなく、次に注意してほしい対象をやさしく目立たせる演出。実装は3層構造：
1. **Guided Attention**（最内側）: `radial-gradient`の淡いglow＋1.03〜1.06倍のgentle scale pulse＋薄いring。常時、現在の対象へ適用（唯一の対象なので「区別」ではなく「気づきやすさ」の演出）。
2. **Gaze dwell ring**（中間）: 既存標準（mitsukete-touch/みるとひろがる）と同一の同心円conic-gradientパターンを再利用。
3. **Switch Scan highlight**（最外側）: 破線outline、offset 16px。

3層は半径・形状（塗り/破線/glow）の両方で視覚的に分離しており、Phase M2.1で確立した「Gaze×Switch Scan視覚的共存パターン」をそのまま踏襲・拡張した。reduced motion時はscale pulseアニメーションのみ停止し、glow/ring自体は表示を維持する。

## 6. Negative Feedback

一切実装していない。×・赤・ブザー・「ちがう」等は存在しない。Level1/2では操作可能な対象以外は画面上に存在しないため、原理的に「間違った対象を選ぶ」状況が発生しない。Level3では非currentな4体が画面上に存在するが、非interactive（button化しない）ため、タップしても`activatePassenger()`のガードで静かに無視される（4.のLevel3節参照）。

## 6.5 Real Boarding（Phase M10-D §2）

「passengerをcarriageの前面付近へ移動するだけ」の表現をやめ、実際にcarriageまで移動して着席する様子を見せる。

- activation時、対象passengerのライブ画像をclone（`.jm-boarding-clone`、`position:absolute`で`#stage`直下）し、現在位置（`getBoundingClientRect()`）から対応するcarriageの座席位置まで、`BOARD_TRAVEL_MS`(850ms、700-1000msの目安内)かけてCSS transitionで移動・縮小させる（`animateBoardingTravel()`）。元のボタン自身は260msで素早くfade outし、以降は`tabIndex=-1`・`pointer-events:none`で完全に無効化される。
- 到着後、`boardCar()`でcarriage画像の上へ実際のriderを配置する。riderは`clip-path: inset(0 0 24% 0)`で下部を欠けさせ、車両の縁の内側に腰掛けているように見せる（専用のback/front-rim assetを使わず、既存の単一carriage画像のまま実現）。
- `prefers-reduced-motion`では移動アニメーションを省略し、`animateBoardingTravel()`が即座に`onComplete()`を呼んで着席状態を表示する（移動は省くが、着席という状態変化自体は必ず明確に表示される）。

## 6.6 Departure（Phase M10-D §3）

停車位置は`#trainDock`を`justify-content:flex-end`で画面右側に寄せることで表現する。5体（またはLevel1の1体）完成後：

1. 完成列車を`COMPLETE_HOLD_MS`(1150ms、800-1500msの目安内)静止表示。
2. 「みんな のった！」（1体のみの場合は「のったね！」）のsoft completion。
3. `startDeparture()`：「しゅっぱつ！」バナー表示＋`DEPARTURE_MS`(5500ms、5-6秒基準)かけて列車をtranslateXで左方向へ走らせる。移動距離は列車の**実際に見えている最後の車両**の右端（`trainDock.lastElementChild.getBoundingClientRect()`）を基準にJSで算出し、stageの左端を確実に完全通過する値にする（`#trainDock`自体はa11yボタン避けの右paddingを含めstage全幅に及ぶため、コンテナのrectをそのまま使うと距離を誤ることが実装中に判明し、最後の車両要素基準に修正した）。
4. `DEPARTURE_MS`が経過するまでround終了処理へは進まない（`display:none`等での早期非表示なし）。経過後、`POST_DEPARTURE_GAP_MS`(700ms、500-1000msの目安内)の余白を置いてから次roundを開始する。
5. `prefers-reduced-motion`では`durationMs`を400msへ短縮するが、待機時間の計算式自体は変えず、round終了処理は必ずこの短縮後の時間まで待つ。

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
