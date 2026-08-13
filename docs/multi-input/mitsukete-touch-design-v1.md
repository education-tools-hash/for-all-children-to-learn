# 「どこかな？みーつけた！」個別設計 v1.6（Phase M5〜M7.1c — Pop Discovery / Peekaboo）

- 版: v1.6（v1.0をPhase M6実装で確定・更新、v1.1をPhase M6.2のイラストasset移植で更新、v1.2はPhase M7のProduction公開完了を反映、v1.3はPhase M7.1のBGM追加（Local RC）を反映、v1.4はPhase M7.1aのBGM実機無音バグ修正（HTMLAudioElement方式への切替）を反映、v1.5はPhase M7.1bのオルゴールBGM再設計を反映、v1.6はPhase M7.1cの繊細化（Delicate Music Box）再調整を反映）
- 位置づけ: `docs/multi-input/multi-input-program-design-v1.md`（Program共通設計）の下位文書。Multi-Input Program 2本目のアプリ。「みるとひろがる」（`miru-hirogaru-app.html`／`miru-hirogaru-design-v1.md`）で確立した入力基盤（semantic activation・canonical/transient state分離・Gaze/Switch共存パターン）を再利用しつつ、体験は意図的に作り変えた。
- Production: Phase M7（2026-08-13）にて `https://donomana.jp/mitsukete-touch-app.html` として正式公開済み（User Production Approval取得済み、main統合・apps-data.json登録・generate.js実行・Production smoke test PASS）。**Phase M7.1／M7.1a／M7.1b／M7.1c（BGM追加・修正・オルゴール化・繊細化）はLocal RCの段階であり、main未統合・Production未公開。Audio User Review待ち。**

---

## 1. UX方針（本Phaseの出発点）

**「アクセシブルだから使える」ではなく「楽しそうだからやってみたくなり、結果として誰でも参加できる」教材を目指す。** 「みるとひろがる」は因果関係の経験そのものが目的だったため装飾を最小化したが、「みつけてタッチ」は**発見・かくれんぼという遊びの魅力**が学習動機の中核であり、視覚的な楽しさを削ることは目的そのものを損なう。この方針を14章の学習発展系列（反応→選択→順序）と両立させつつ、Program全体のUX原則として明文化する（69章）。

---

## 2. 学習目標（一文定義）

> 画面の中に隠れている対象に気づき、見る・触れる・スイッチなど自分の使える方法で見つけ、選ぶ経験を楽しむ。

M0で確立した学習目標記述パターン（「みるとひろがる」の一文定義）を踏襲し、正式採用する。

---

## 3. 「みるとひろがる」との差別化

| | みるとひろがる | みつけてタッチ |
|---|---|---|
| きっかけ | 常に見えているtargetへの働きかけ | ちらっとしか見えていないものへの気づき |
| 主目的 | 反応・因果関係 | 視覚探索・発見・選択 |
| 認知プロセス | 働きかけ→変化 | 気づく→探す→見つける→選ぶ→現れる |
| 視覚密度 | 最小限（色面のみ） | ポップ（キャラクター・隠れ場所） |
| 繰り返しの動機 | 「もう一度、変化を起こしたい」 | 「次は何が出てくるだろう」 |

役割はM0 3章の「見つける／選ぶ」のまま変わらないが、**体験の質（面白さ）を今回新たに設計要素として明示的に扱う**点が本Phaseの核心的な追加である。

---

## 4. 世界観

### 4.1 比較（3案）

| 案 | 内容 | 評価 |
|---|---|---|
| A. 草むらかくれんぼ | 草・木・花の陰からキャラクターがちらり | 発見の定番モチーフで親しみやすいが、隠れ場所（草むら）が「地面」を暗示し、画面上部・隅への配置がやや不自然になりやすい |
| B. おへやかくれんぼ | 箱・カーテン・窓・ドアからちらり | 身近だが、ドア/窓は特定の高さ・向きを暗示しやすく、7方向のposition randomization（14章）と相性が悪い |
| C. ふわふわ空の世界 | 雲・風船・星の後ろからちらり | 雲は「上下左右どこに浮いていても自然」という柔軟性があり、画面のどの位置（左/中央/右/左上/右上/左下/右下）に置いても違和感がない。パステル調・丸くやわらかい形状はDesign Systemの既存トーン（角丸・やさしい色）とも親和性が高い |

### 4.2 推奨
**案C（ふわふわ空の世界）を推奨する。** 理由は雲という隠れ場所の形状的な位置非依存性（どこに置いても自然）が、position randomization要件（14章）と最も整合するためであり、副次的に草原/部屋のような重い背景美術を必要とせず「背景はシンプル、隠れ場所だけポップ」（8章の方針）とも自然に両立する。背景は既存Design Systemの`#FAF7F2`系またはごく薄い空色の単色/微グラデーションとし、雲（隠れ場所）とキャラクターだけを視覚的主役にする。

---

## 5. キャラクター

### 5.1 候補と推奨数
うさぎ・ねこ・いぬ・ひよこ・くま・おほしさま の **6種類** を推奨する（10章の「5〜6種類」推奨レンジの上限）。理由: 動物5種＋おほしさま1種という構成にすることで、「動物が隠れている」という直感的な一貫性を保ちながら、おほしさまだけ毛色を変えることで「次は何が出てくるだろう」という期待感の振れ幅を確保できる。

### 5.2 Assetスタイル
**シンプルなSVG/ベクターイラスト**を推奨する（35章の通りemojiは不採用）。理由:
- 環境・OS・ブラウザによる表示差異がない（emojiは絵文字フォントの差でスタイル・存在自体が変わりうる）
- round / soft / friendly / simple / 大きな目 / パステル調という統一styleを全キャラクターで揃えられる（36章）
- 「みるとひろがる」のtarget（circle/square/triangle）と視覚的トーンを揃えやすい（既存Design Systemの角丸・柔らかい配色を継承）

画像生成は本Phaseでは行わない（37章の通りM6判断）。デザイン方向性のみ確定: 全キャラクター共通で顔中心・輪郭は丸み・目は大きめ・配色はDesign System由来のパステル（既存`--dm-color-primary`/`--dm-color-accent`/`--dm-color-info`等を基調にキャラクターごとに彩度・色相のバリエーションを付ける）。

### 5.3 隠れ方
完全に隠すのではなく**一部だけ見える**方式を採用する（11章）。候補（耳だけ／顔半分／頭だけ／しっぽだけ／色の一部）のうち、**「頭の一部（耳や角）が雲の輪郭から少しはみ出す」形**を基本パターンとして推奨する。理由: 雲という隠れ場所の形状と自然に組み合わせやすく（雲の丸みの外側にキャラクターの一部が乗っているように見える）、キャラクター種ごとに「はみ出す部位」を変えることで（うさぎなら耳、くまなら丸い頭、ひよこならくちばし等）バリエーションが生まれる。

### 5.4 見え方段階（Level別）
Level1: かなり見えている（頭の半分近く） / Level2: 半分程度 / Level3: 少しだけ見える（耳や角の先だけ）。12章の候補をそのまま正式採用する。認知負荷の急激な上昇を避けるため、Level間の差は「見える面積」のみで調整し、位置・色・輪郭線の変更は行わない。

---

## 6. Level構成

### 6.1 Level1「どこかな？」

- 隠れ場所1か所（雲1つ）
- キャラクター1体、かなり見えている
- distractorなし、success-only
- 位置はtrialごとに7候補（左/中央/右/左上/右上/左下/右下、14章）からランダム——ただしcommon chrome（home/lock/fullscreen/settings）と重ならない安全領域内に限定
- 目的: 隠れている対象に気づく

### 6.2 Level2「みつけた！」

- 隠れ場所2〜3か所
- 1か所にキャラクター（一部だけ、半分程度見える）、他はneutral distractor（空の雲、17章）
- distractorをactivationしても「間違い」として扱わない——neutral feedback（19章、ふわっ/ゆらっとした軽い揺れ）のみを返し、次trialへは進まない（45章）
- 目的: 複数候補から気づいて選ぶ

### 6.3 Level3「いっぱいかくれんぼ」

- 隠れ場所3か所（22章、MVPは3固定、4〜6は将来）
- target1体（見える部分がLevel2よりさらに小さい）＋neutral distractor 2か所
- moving targetは使用しない（static only、23章）
- 目的: より広い範囲への注意移動と探索

### 6.4 表示名の評価
「どこかな？」「みつけた！」「いっぱいかくれんぼ」はいずれも短く、レベルボタンの幅制約（375px、Phase26以来の実績パターン）に収まる長さであり、意味も各Levelの体験と一致している。**この3名称を正式候補として推奨する。**

---

## 7. Trial Flow / タイミング

### 7.1 基本フロー（24章の通り正式採用）
新しい隠れ場所を表示 → キャラクターがちらり → 子どもが探す → target activation → キャラクター登場（reveal） → feedback → 次trial。

### 7.2 次trialへの移行待ち時間
600ms/900ms/1200ms/1500msを比較検討した結果、**1200msを推奨する。** 理由: 「みるとひろがる」のfeedback(900ms)より本教材は「発見の喜びを味わう」演出（キャラクター全体reveal＋sparkle等、28章）が加わり視覚的情報量が多いため、900msでは結果を見る時間がやや不足する。1500msは待ち時間が目立ち始める。1200msを中間値として推奨する（実装時のRendered Validationで調整可能）。

### 7.3 「次はどこ？」感（26章）
直前trialと同じ位置を避ける制御を推奨する（完全排除ではなく、7候補中「直前と同じ位置」のみ除外して抽選）。

### 7.4 キャラクターの反復回避（27章）
直前trialと同じキャラクターが連続しない制御を推奨する（6種類中、直前の1種のみ除外して抽選）。完全ランダムにしないことで「毎回同じ子ばかり」という単調さを避けつつ、過度な制御アルゴリズムは持ち込まない。

---

## 8. Positive Feedback（Level1〜3共通、target activation時）

pop（雲から少し前へ出る＋scale 1.0→1.08〜1.15程度、31章）＋character reveal（隠れていた部分も含め全体が見える状態になる）＋small sparkle（キラッとした軽い演出）＋soft sound（9章参照）を組み合わせる。強いbounceは使わず、900ms以内で完結させる（31章）。画面上の文言は「みつけた！」程度の短いテキストのみ（16章）。TTSはMVP不要（30章、「みるとひろがる」同様の判断を踏襲）。

### 8.1 Distractor Feedback（Level2/3のみ）
neutral feedback（ふわっ/ゆらっとした軽い揺れ）を採用する。×・赤・ブザー・「ちがう」等の否定的表現は一切使用しない（19章の禁止事項を厳守）。distractorをactivationしても次trialへは進まず、同じtrial内で探索を継続できる（45章）。

---

## 9. Sound

「みるとひろがる」のtone（660→880Hz、約180ms）をそのまま流用せず、**発見感のある短い音**を新規に検討する（29章）。方向性: 「みるとひろがる」より半音程度高く、わずかに跳ねるような2音構成（例: 短い上昇インターバル）を推奨するが、やさしく・短く・驚かせないという制約（29章）は維持する。実装時にWeb Audio APIで具体的な周波数・波形を決定する（本Phaseでは方向性のみ）。

---

## 10. Animation Safety / Reduced Motion / High Contrast

- pop animationは900ms以内、高速反復なし（31章）。
- reduced motion時は、instant reveal（即座に全体表示）または短いfade、あるいはoutline changeで代替する（32章）——「みるとひろがる」の`.activated`パターン（discrete class toggleによる即時状態変化）をそのまま踏襲できる。
- high contrastでは、隠れ場所とキャラクターの区別を色だけに依存させない（33章）——輪郭線（outline）や形状差（雲の丸み vs キャラクターの輪郭）で区別可能にする。

---

## 11. 入力方式別設計

### 11.1 Touch
tap でactivation、8px movement thresholdをPilotから継承（38章）。hit areaは**隠れ場所全体**を採用する（39章、推奨通り）。理由: 見えているキャラクター部分だけをhit areaにすると、Level3のように見える部分が小さい場合に精密なタップ操作が要求されてしまい、手指操作が難しい対象児童にとって不利になる。隠れ場所（雲）全体を大きなhit areaにすることで、視覚的な発見の楽しさと操作のしやすさを両立する。

### 11.2 Gaze
Pilot基盤をそのまま再利用: 900ms dwell、radial progress ring、transition guard、stale dwell reset、Gaze/Switch共存パターン（40章）。dwell対象も**隠れ場所全体**とする（41章）。

### 11.3 Switch
Level1: 隠れ場所1か所のため、**Direct Activation**を継承する（42章、「みるとひろがる」Level1と同じ判断根拠——1候補にscan cycleを回す意味が薄い）。Level2/3: Auto Scan、1500ms固定（43章、Pilotと同一値）。**distractorもscan候補に含める**（44章）——Switch利用者だけがtargetしか選べない構造にしないためのInput Equity上の要件であり、これによりSwitch利用者もTouch/Gaze利用者と同様に「探索してdistractorに当たることもある」という同じ体験を得られる。

### 11.4 Keyboard
全hide spot（target/distractor問わず）をTab移動対象とし、Enter/Spaceでactivateする（46章）。

---

## 12. Semantic API

### 12.1 `activateItem(itemId, inputMethod)`
「みるとひろがる」の`activateTarget()`をそのまま使うのではなく、**`activateItem(itemId, inputMethod)`への一般化を推奨する**（47章）。理由: 本教材のitem（隠れ場所）はtargetとdistractorの両方の役割（role）を持ちうるため、関数名を「target」に固定すると意味的に不正確になる。

### 12.2 Semantic Result（48章）
activation後、`item.role`で分岐する:
- `role: 'target'` → positive reveal（8章のfeedback一式）
- `role: 'distractor'` → neutral feedback（8.1章）

### 12.3 内部命名規則（49章）
`wrong`/`mistake`という語を状態名・変数名として使わない。候補として`targetActivation`/`nonTargetActivation`を採用する。

---

## 13. Canonical / Transient State

### 13.1 Canonical State（50章のまま正式採用）

```js
{
  level,
  phase,                  // 'ready' | 'feedback'（Pilotと同じ2相構造）
  targetItemId,            // このtrialでtargetとなっているitemId
  itemIds,                 // このtrialに存在する全item（target+distractor）のid一覧
  trialIndex,
  targetActivationCount,   // 「みつけた」回数
  totalActivationCount,    // target+distractor合計のactivation回数
  sessionStart
}
```

### 13.2 Transient State
Pilot基盤を基本再利用（51章）: gaze関連（dwellTarget/dwellStartedAt/dwellProgress/leave-reenter gate）、scan関連（scanIndex/scanTimer）、input lock（inputLockUntil）、feedback timer、touch start position。本教材固有の追加として、**次trialのposition/character選出時に「直前trialの位置・キャラクター」を記憶する変数**が必要（7.3/7.4章の反復回避制御のため）。

### 13.3 Activation Lock / Transition Guard
300msのactivation lockをPilotから継承（52章）。新trial生成前に、gaze/scan/touch/feedbackの各状態を確実にリセットしてから次のitem集合を構築する（53章、trial transition guard）。

---

## 14. Records / CSV

### 14.1 Records Philosophy
「正答率」を中心にしない（54章）。記録するのは観察事実のみ——「見つけた」「他の場所にも働きかけた」という行動の記録であり、正誤や理解度の評価ではない。

### 14.2 Records項目（55章のまま正式採用）
timestamp / level / selectedItem（semantic label、内部id非露出） / itemRole（target/distractor） / inputMethod / responseTime / dwellDuration / targetPosition / trialIndex。

### 14.3 Target Position Record（59章）
左/中央/右/左上/右上/左下/右下の7値を記録候補とする。

### 14.4 responseTime（58章）
trial表示からtarget activationまでの時間とする。**non-target（distractor）activationではtimerをリセットしない**——同じtrial内での「寄り道」を許容しつつ、最終的にtargetへ到達するまでの探索行動全体を1つの時間として捉える。

### 14.5 Session Summary（60章）
Level / 活動時間 / みつけた回数 / 働きかけ回数（target+distractor合計） / 主な入力方法。評価語は使わない。「みつけた回数」は中立的な観察事実として表示可能と判断する（56章）。「ほかの場所への働きかけ」（non-target count）はUI表示せず内部集計のみに留めることを推奨する（57章）——「まちがい◯回」という誤解を招く表示を避けるため、UIでの露出は本Phaseでは見送り、必要性が明確になった時点で再検討する。

### 14.6 CSV列（61章）
日時 / Level / 選んだ場所（semantic label） / 種類（「みつけた」/「ほかの場所」、target/otherを日本語表示へ変換） / 入力方法 / 反応時間 / 注視時間 / target位置 / trial。**8列**——「みるとひろがる」の7列より1列多いが、target位置という新規の観察事実を記録するために必要な最小限の追加であり、過剰な列増加ではないと判断する。

---

## 15. Completion / Session設計

### 15.1 Completion基準（62章）
「みるとひろがる」の10回activationとは変え、**5回target発見（targetActivationCount===5の倍数）でsoft completion**を採用する。理由: 本教材はtrial構造が明確（1trial=1回の発見体験）なため、「発見した回数」という達成に即した区切りの方が体験と一致する。distractor activationはこのカウントに含めない。

### 15.2 Completion Message（63章）
「いっぱいみつけたね！」を採用する。強制終了なし、継続可能（「みるとひろがる」と同じ設計思想）。

### 15.3 Problem Count UI（64章）
MVPでは出さない。5target発見ごとのsoft completionのみとする。

### 15.4 Session Length（65章）
1〜3分想定、強制終了は設けない。

---

## 16. Settings（66章のまま正式採用）
MVPで持つ設定: sound ON/OFF、fullscreen、accessibility（既存共通パネル）。scan intervalは1500ms固定、custom dwellはなし——「みるとひろがる」と同一方針。

---

## 17. Responsive / Layout

### 17.1 375×667構造（67章）
title / level selector / play area（隠れ場所が配置される領域） / common chromeという構成は「みるとひろがる」のtarget areaパターンを踏襲する。play areaは固定grid配置ではなく、7つの安全位置候補に対応する相対配置（%ベースまたはgrid-template-areas）を検討する。

### 17.2 Hide Spot Size（68章のまま正式採用）
Level1: 160〜200px / Level2: 130〜160px / Level3: 110〜140px。hit areaは隠れ場所全体を維持し、見えるキャラクター部分の縮小とhit areaの縮小を連動させない（11.1章の方針と整合）。

### 17.3 Safe Region（69章）
common chrome（home/lock/fullscreen/a11yボタン、いずれも画面四隅付近に固定配置）との重なりを避けるため、7位置候補の実際の座標は各chromeボタンの占有領域から一定マージンを確保した範囲に限定する。実装時にRendered Validationで確定する。

### 17.4 Visual Density（70章）
背景装飾は最小限に抑え、隠れ場所とキャラクターを視覚的主役とする（4.2章の世界観選定理由と一貫）。

---

## 18. Naming

### 18.1 App Title候補比較（72章）

| 候補 | 評価 |
|---|---|
| みつけてタッチ | 現行名。「タッチ」を含むため、Touch専用に見える懸念がM0以来指摘されていた |
| どこかな？みーつけた！ | 発見体験を最も端的に表すが、やや長い |
| みつけた！ | 短く親しみやすいが、独自性がやや弱い（Level2名と重複） |
| どこにいるかな？ | 探索の問いかけとして自然 |

### 18.2 推奨
**「どこかな？みーつけた！」を第一候補として推奨する。** 理由: Touch専用という誤解を避けられ（Program共通課題、M0以来の指摘）、かつ本Phaseの核心であるUX方針（1章）——発見体験の楽しさを前面に出す——と最も一致する。ただし長さはトップページカード・app-introでの表示崩れがないか実装時に確認が必要（**ユーザー判断事項として明示**）。

### 18.3 Filename（73章）
表示名変更とは independentに、`mitsukete-touch-app.html`を維持する（既存命名規則との整合、表示名は`apps-data.json`の`title`フィールドのみで管理されるため分離可能）。

### 18.4 App Description（74章のまま正式採用）
> どこかにかくれているものを見つけて、タッチ・視線・スイッチなどで選ぶことを楽しむ教材です。

---

## 19. Icon Direction（75章、画像生成なし）
候補: 虫眼鏡＋顔（発見感を直接的に表現）、雲の後ろから星（世界観と直結、4.2章の推奨と一致）。**雲の後ろから星がのぞいているモチーフを第一候補として推奨する**——世界観（4章）と視覚的に一貫し、「かたち探し」ではなく「発見のワクワク感」を伝えられる。🎯等、正解/失敗（的当て）を連想させるiconは明確に禁止する（「みるとひろがる」M4での実例を踏まえた教訓、既にProgram共通の学びとして反映）。

---

## 20. M6 実装スコープ

### 20.1 M6で実装するもの（MVP、76章のまま正式採用）
Level1〜3、popup/peekaboo discovery、5〜6キャラクター、雲を中心とした隠れ場所（本書では単一のvisualモチーフに絞り「3種類程度」という当初候補は不採用——4.2章の理由により雲1種のみで統一する）、安全位置ランダム化、Touch/Gaze/Switch/Keyboard、target/non-target、neutral distractor feedback、positive reveal、records/CSV、soft completion、5viewport、reduced motion、high contrast。

**当初案7章からの変更点**: 「隠れ場所3種類程度」（22章の文脈から示唆されていた複数モチーフ）ではなく、世界観を雲に統一したことで「隠れ場所の見た目は雲1種、中身（キャラクター）が6種類変わる」という構成に整理した。これにより一貫した世界観を保ちながら、asset制作コストも抑えられる。

### 20.2 M6で実装しないもの（77章のまま正式採用）
moving targets、4+ distractors、complex backgrounds、photo images、TTS、manual scan、two-switch、custom dwell、preference analytics、difficulty customizer。

---

## 21. Common Adapter Strategy（78章）
1本目（みるとひろがる）でPilot済みの共通思想（semantic activation・各入力adapter・activation lock）を2本目でも**再利用するが、まだshared JSへ切り出さない**（M0 15章の方針を継続）。`activateTarget()`→`activateItem()`への一般化のように、2本目固有の拡張が生じた箇所はここに記録し、M8（Program振り返り）で正式共通化を判断する材料とする。

---

## 22. Program Document更新提案

「楽しそうだから使いたい」というUX原則をProgram共通文書へ追加することを提案する。`multi-input-program-design-v1.md`の1章（Programの最上位目的）付近へ以下の一文を追記する案:

> **アクセシビリティは前提条件であり、それ自体が学習の質を保証するものではない。子どもが「やってみたい」と感じる体験の魅力（エンゲージメント）も学習の質の一部として扱う。**

これは既存の原則（3教材の役割分担、success-only等）と矛盾せず、むしろそれらを支える上位方針として機能する。実際の追記はユーザー承認後に行う（本Phaseでは提案のみ）。

---

## 23. M6実装確定事項（ユーザー承認・実装反映済み）

M5時点の16件の残存論点は、ユーザー承認とPhase M6実装を経てすべて確定した（`mitsukete-touch-app.html`実装済み、feature/mitsukete-touch-mvp branch）。

1. **世界観**: ふわふわ空の世界（雲）で確定・実装。単一の雲SVG（`CLOUD_SVG`）で統一。
2. **キャラクター**: うさぎ/ねこ/いぬ/ひよこ/くま/おほしさまの6種で確定・実装。
3. **キャラクターstyle**: オリジナルSVG（`characterInnerSVG()`）、round/soft/pastel統一styleで実装。emoji不使用、既存キャラクター模倣なし。
4. **Level名**: 「どこかな？」「みつけた！」「いっぱいかくれんぼ」で確定・実装。
5. **Level1位置ランダム化**: 7候補位置＋直前位置除外（`pickFrom()`）で実装。100trial×3levelのランダム性検証で異常なしを確認。
6. **Level2 distractor方式**: neutral distractor（空の雲、`characterId:null`）で実装。
7. **distractor feedback**: `neutral-pulse`クラスによる380ms sway animationで実装、×/赤/ブザー/「ちがう」等は一切使用していない。
8. **Level3**: 3か所固定（left/center/right）で実装。
9. **positive reveal演出**: pop(scale 1.12)+character reveal+sparkle+discovery sound(2音)+「みつけた！」テキストの組み合わせで実装。
10. **次trial待ち時間**: 1200msで実装（`NEXT_TRIAL_MS`）。
11. **Switch Level1 Direct Activation**: 実装・確認済み（`startAutoScan()`がlevel===1で早期returnし、Spaceキーが`currentItems[0]`を直接activateする専用分岐）。
12. **distractor scan**: target/other双方がscan候補に含まれることを実測確認（`buildScanItems()`はroleで区別しない）。
13. **records**: 正式に**9項目**として確定（M5時点の「8列」表記はM6で訂正）。timestamp/level/selectedPosition/itemRole/inputMethod/responseTime/dwellDuration/targetPosition/trialIndex。CSVも9列。
14. **soft completion**: target発見5回ごとで実装（`SOFT_COMPLETE_EVERY=5`）、強制終了なし。
15. **アプリ表示名**: 「どこかな？みーつけた！」で確定・実装（filenameは`mitsukete-touch-app.html`のまま）。
16. **M6 MVP範囲**: 21章のスコープ通り実装完了。

### 実装で判明した追加調整（Rendered Validation、コード側で対応）

- **Position percentage修正**: 当初の`left:10%/right:90%`は、hidespotの`translate(-50%)`центering と組み合わさると375〜390px幅のviewportで実際に水平overflowを起こすことをPlaywright実測で発見（Level2/3で確認、Level1でも理論上発生しうる潜在バグ）。`left:24%/right:76%`（および corner位置も同様に調整）へ修正し、全position×全level×全viewportの網羅テストでoverflow 0を確認。
- **Peek視認性の調整**: 当初のpeek量（top: -4%/16%/30%）は、おほしさまの細い光条等、特徴の薄いキャラクターでLevel2/3の視認性が低すぎたため、`-12%/4%/19%`へ引き上げ。
- **ひよこキャラクターへの頭部tuftの追加**: ひよこは耳がなく、雲の外に飛び出す「上部特徴」を持たない唯一のキャラクターだったため、小さな頭の巻き毛（tuft）を追加し、他5キャラクターと同様に発見時のシルエットで判別できるようにした。

### Phase M6.1: User Review後の最終調整

- **いぬの耳位置修正**: M6終了時点で残っていた懸念（いぬの耳が側面に垂れる形状のため、他キャラクターより雲からの「ちらり」感が弱い）をRendered Validationで確認したところ、実際にLevel3では他キャラクターと比べて明確に視認性が劣ることを確認した。耳の付け根の位置を頭の中央付近（cy=48）から頭頂部付近（cy=30）へ引き上げ、外側への角度も広げることで、垂れ耳らしい形状を保ったまま、耳の上部が雲の陰から覗く量を他キャラクターと同等まで改善した。全身表示（reveal時）の見た目に変更はない。
- 世界観・キャラクター種・アプリ表示名・position margin・discovery sound・ひよこtuftはM6のまま変更なし——User Reviewで問題なしと判断されたため。

### Phase M6.1（2回目）: キャラクターデザイン全面移植・品質条件追加

User Reviewの結果、抽象的なオリジナル造形（`viewBox="0 0 100 100"`、頭部円＋簡易耳のみ）よりも、幼児・知的障害のある学習者が一目で認識しやすい具体的な動物表現を優先する方針が示された。加えて、うさぎの耳がviewBox上端でclippingする実バグ（SVGはデフォルトでviewBox範囲外を描画しない。旧デザインは耳の先端がy=-8等、範囲外に出ていた）が確認された。

**対応**: `viewBox`を`0 0 100 100`→`0 0 100 130`へ拡張し、頭部中心を(50,58)→(50,82)へ下げることで、耳・tuft・星の角等すべての「飛び出す特徴」に十分な安全マージンを確保した（6キャラクター×3Level×5viewportの網羅検証でclipping 0件を確認）。同時に、各キャラクターへ以下の具体的特徴を追加し、シルエットのみでも種類を判別できるようにした。

- **うさぎ**: 長い耳2本＋耳内側pink、pink三角の鼻
- **ねこ**: 三角耳2本＋耳内側pink、額の簡易しま模様、左右ひげ、三角の鼻
- **いぬ**: 丸みを帯びた垂れ耳（頭頂部寄りに付け根）、白いmuzzle、黒い鼻
- **ひよこ**: 頭頂部tuft（M6.1初回より拡大）、小さな翼2枚、オレンジのくちばし
- **くま**: 丸耳2本＋耳内側の明るい色、明るいmuzzle、黒い鼻
- **おほしさま**: 星型（角を丸めのstroke-linejoinで柔らかく）、丸い目、頬のblush

いずれも独自SVGとして実装し、raster画像の埋め込み・emoji・既存キャラクターの模倣は行っていない。peek量（`peek-1/2/3`のtop%）もviewBox拡張に合わせて再調整（`-12%/-4%/8%`）し、Level3でも6キャラクターすべてで存在を示す視覚的手がかり（耳・tuft・星の角）が残ることを確認した。

**新規品質条件として正式に追加**:
- **Character Recognition**: full reveal時に6キャラクターが一目で区別できること。peek時はLevel1で種類まで分かりやすく、Level2/3では「何かいる」ことが明確であれば種類の断定は不要。
- **No Character Clipping**: 全viewport・全Level・全キャラクターでSVG/hidespot/viewportいずれによるclippingが発生しないこと。

### Phase M6.2: キャラクターasset方式への移行（コード生成SVG→イラストasset）

User Reviewにより、M6.1（2回目）の具体化SVGでも、ユーザーが別途ChatGPTで生成した参考イラスト（グロッシーな3D調・大きな黒目に白ハイライト・丸い輪郭・淡いパステル色・雲から覗く構図の6キャラクター）と比べると、可愛らしさ・親しみやすさ・「見つけたい」と思わせる訴求力の面で見劣りするとの指摘があった。これを受け、方針を次のとおり変更した。

> User Reviewの結果、認識性だけでなくEngagementを高めるため、コード生成によるsimple SVGキャラクターから、統一された高品質イラストasset方式へ変更した。Visual Source of TruthはUser承認済みの生成参考画像とし、Touch/Gaze/Switch/Keyboardのsemantic interactionとは独立したpresentation assetとして管理する。

**設計原則（新規追加）**: キャラクターの見た目（asset）と、Touch/Gaze/Switch/Keyboardが操作する意味的なUI（`.mt-hidespot`ボタン・`aria-label`・`activateItem(itemId, inputMethod)`）は、明確に別レイヤーとして扱う。asset側をどれだけ作り替えても、意味的interaction層（イベントリスナー・キーボード操作・スクリーンリーダー向け名前）には触れない。今回の移行でも`activateItem`のシグネチャ・呼び出し規約・records/CSVスキーマは一切変更していない。

**Visual Source of Truth**: ユーザーがChatGPTで生成し、ローカルに配置した参考画像1枚（3列×2行グリッド、うさぎ/ねこ/いぬ/ひよこ/くま/おほしさまの6キャラクターが雲の上から覗く構図）。実装前に画像ファイルを直接読み込んで確認した上で作業を開始した（想像や既存キャラクターの模倣ではなく、実ファイルを参照）。

**asset抽出方法（優先順位どおり「クリーンな抽出」を採用）**:
1. 参考画像を3×2のセル（512×512）に分割。
2. 各セルから、参考画像自身の雲・前足イラスト部分を除いた「キャラクターの顔・上半身」のみを切り出し（雲は本アプリ自身のSVG（`CLOUD_SVG`）を引き続き使用するため、参考画像側の雲は採用しない）。
3. 切り出し境界に合わせてアルファチャンネルへ feather（縁を滑らかに透明化するグラデーションマスク）を適用し、背景色や矩形境界が見えないようにした。くま/ひよこ/おほしさまの3体は当初の切り出し下端が参考画像自身の雲の水色ふちに掛かっていたため、下端を再調整（feather幅も個別に縮小）し、雲の色が一切残らないことを確認した。
4. 6体を統一キャンバス（543×382px、透明背景）へ正規化。各キャラクターの目の中心座標を全て同一点に揃えることで、種ごとに異なるアートワークの縦横比・余白があっても、CSS側は1種類のwidth/top設定だけで全キャラクターに同じ見え方（視覚的中心・目の高さ・基準線が統一）を実現できるようにした（8章の「統一canvas」要件に対応）。

**保存場所・形式**: `assets/mitsukete-touch/{rabbit,cat,dog,chick,bear,star}.png`（リポジトリ既存の`assets/{app}/`慣例に準拠、外部URL不使用）。全てPNG(RGBA)、543×382px、ファイルサイズは1体あたり約83〜138KB（6体合計 約700KB）。

**レイヤー構成**: `.mt-character`（背面・キャラクターimg）→`.mt-cloud`（前面・本アプリ自身のCLOUD_SVGのまま、参考画像の雲は不使用）という既存の重なり順を維持。キャラクターimgには`alt=""`と`aria-hidden="true"`を付与し、意味的な名前は引き続き`.mt-hidespot`の`aria-label`のみが担う（重複読み上げなし）。

**旧SVGの扱い**: `characterInnerSVG()`・`characterSVG()`は完全に削除し、`characterImg(charId)`（`<img src="assets/mitsukete-touch/{id}.png">`を返す）へ置き換えた。フォールバックとして旧SVG関数を残すことはしていない（未使用コードを残さない方針）。

**雲・キャラクターの拡大**（User Review「雲とイラストがもっと大きくてもよい」への対応）: `.mt-size-1/2/3`を200/150/130px（モバイル168/128/100px）から230/176/152px（モバイル194/150/104px）へ拡大、`.mt-cloud`のwidthも90%→98%へ拡大。Playwrightによる境界矩形の網羅測定（5 viewport×3 Level×6キャラクター）で、Level3の3か所横並びレイアウトが375/390px幅では`left:24%/right:76%`のままだと衝突することを発見したため、**Level3限定**で`.mt-size-3.mt-pos-left/right`を17.5%/82.5%へ個別に広げ（Level1/2の位置指定には影響しない）、モバイル用breakpointも480px→600pxへ拡張して衝突しない範囲を広げた。最終的に0 clipping・0 collision・0 horizontal overflowを確認した。

**peek量の再調整**: 6体を統一canvasへ正規化した結果、キャラクターごとに「canvas最上部から実際に不透明なピクセルが始まる位置」が異なることが判明した（うさぎは耳が最上部近くにあるため7%、いぬは垂れ耳が最も低い位置から始まるため40%）。最も厳しいいぬを基準に、Level3（`peek-3: -6%`）でもいぬの耳先が確実に覗くことをRendered Validationで確認した上で、`peek-1/2/3`を`-34%/-18%/-6%`、revealed状態を`-46%`へ再設定した。

**新規に発見・修正したバグ（asset作業とは無関係、Switch再検証で発見）**: Level2/3でSwitchスキャンによりhidespotへ意味的activationがフォーカスされている状態でSpaceキーを押すと、hidespotボタン自身のkeydownリスナーが`activateItem()`を呼び出し、その内部で同期的に`renderItems()`→`refreshSwitchScanItems()`が走ってDOMとフォーカスが再構築される。その直後、同じSpaceキー入力がdocument側のAuto Scanハンドラへもbubbleし、再構築後にフォーカスが移っていた別要素（レベル切替ボタン等）を誤ってclickし、trialとlevelが意図せずリセットされる二重発火が生じることを、本Phase必須のSwitch再検証で発見した。hidespotボタン側のkeydownリスナーで、scanMode有効時のSpaceキーをdocument側ハンドラへ一任する（何もしない）よう1行のガードを追加し修正した（Enterキーの直接操作には影響なし）。修正後、Level2/3のSwitch scan+space活性化で二重発火・trial/level誤リセットが発生しないことを確認した。

### Phase M7: Production Release

2026-08-13、User Production Approval（「とても良い感じです。リリースしてOKです」）を受領し、`900e07c`をFinal RCとしてmainへfast-forward統合、`apps-data.json`/`generate.js`への正式登録を経て`https://donomana.jp/mitsukete-touch-app.html`として公開した。

**登録内容**: `apps-data.json`へ「みるとひろがる」と同型のschemaで新規エントリを追加（category「認知支援」、releaseDate 2026-08-13）。`generate.js`の`SETTINGS_PROXY`・`hideWithDisplayNone`へ`mitsukete-touch-app`を登録し、アプリ自身の`#settingsBtn`が共通a11yパネルの「このアプリの詳細設定を開く」プロキシへ正しく統合されるようにした（Phase M4で発生した新規アプリ設定ボタン登録漏れの再発なし）。changelogは`MANUAL_CHANGELOG`を手編集せず、`releaseDate`による自動生成（`generateChangelog()`）に任せた結果、同日公開の「みるとひろがる」・同日改善の「かたちをあわせよう」と自動的に1つの日付エントリへ統合された。

**Production Release検証で新規に発見・修正した回帰バグ**: M6.2で`.mt-size-1`（Level1のhidespotサイズ）を168px→194px（モバイル）へ拡大した際、同じくM6.1以来存在する`.mt-ring`（gaze dwellリング、`inset:-8px`で常にDOM上に存在しopacityのみ切り替え）の8px外側張り出しを考慮せずに24%/76%の角position設定を据え置いたため、375/390px幅でLevel1の右側position（right/upper-right/lower-right）が実際に7px程度の水平overflowを起こすことをProduction公開前のresponsive再検証で発見した。position指定を27%/73%へ調整し、`.mt-ring`の外側張り出しを含めた実測（Playwright `scrollWidth`＋各要素`getBoundingClientRect()`）で5viewport×3Level×6キャラクターの overflow 0 / clipping 0 / collision 0 を確認した上で公開した。

**Production確認結果**: HTTP 200、主要ファイル（アプリ本体・6キャラクターPNG）のSHA256が全てlocalと一致、Level1〜3・6キャラクター・Touch/Keyboard・共通chrome（home/lock/fullscreen/a11y）・独自設定ボタンの非表示化・duplicate ID 0・console/pageerror 0・failed request 0を確認。GitHub Actionsの`generate`workflowによる自動commit（1件、mockup/icon反映によるog:image等の差し替えのみ）を経て、最終的に`main`=`origin/main`=`1c3f865`で一致。

### Phase M7.1: BGM / Sound Experience Enhancement（Local RC、Audio User Review待ち）

Production公開済みアプリへの改善Phaseとして、「楽しい雰囲気づくり」を目的にBGMを追加した。既存の発見音（`playDiscoverySound()`、740Hz/988Hz）とは完全に独立したON/OFFを持つ、控えめな背景音という位置づけ。**本Phaseはmain未統合・push未実行・Production未公開のLocal RCであり、Audio User Review（実際に聞いての承認）を経て初めてRelease Phaseへ進む。**

**BGM素材**: 参考音源のコピー・外部素材の流用は行わず、numpyによる完全自作のオリジナル合成（トイピアノ／グロッケンシュピール風のベル音色＋ミュージックボックス風のプラック音色、Cメジャー、96BPM、8小節=20.0秒のシームレスループ）。ペンタトニック（C D E G A）の疎らなメロディに、コード進行 C–G–Am–F–C–G–F–C の柔らかいアルペジオ伴奏を重ね、軽いマルチタップ・ディレイ由来のリバーブで「ふわふわ空」の空気感を加えた。continuous bassは使用していない。ループ境界は「末尾の減衰テールを先頭へ折り返して加算する」手法＋10msの短いイコールパワー・クロスフェードにより、聴感上の継ぎ目が出ないよう設計した。soft limiter（tanh）でクリッピングを防止し、最終ピークは意図的に-6dBFS相当（0.5）に抑えている。著作権上の懸念は一切ない（完全新規制作物）。

**保存形式**: `assets/mitsukete-touch/audio/bgm-loop.mp3`（自己ホスト、外部CDN不使用）。WAV（1.7MB）ではなくMP3（`soundfile`/libsndfileでエンコード、約214KB）を採用し、iPad/iPhone（Safari/WebKit）を含む主要ブラウザでの再生互換性とファイルサイズのバランスを優先した。

**BGM ON/OFFと「音」の分離**: 設定パネルに「音」（既存の発見音トグル）とは独立した「BGM（バックグラウンド音楽）」トグルを新設。`STORAGE_SETTINGS_KEY`（`mitsukete_touch_settings`）の同一JSONへ`bgmEnabled`フィールドを追加する形で保存し、新しい保存基盤は作っていない。4通りの組み合わせ（BGM ON/OFF × 音 ON/OFF）すべてで学習体験が正常に成立することをPlaywrightで確認済み。

**初期値の判断**: BGM初期値は**OFF**とした。優先順位は要件どおり (1)既存慣例 (2)autoplay安全性 (3)感覚刺激への配慮 (4)Engagement の順で検討し、(3)を(4)より優先した。理由: 本Programは重度・重複障害のある学習者を含む対象を想定しており、M0以来「刺激が強くなりすぎないよう」という一貫した設計判断がある（`multi-input-program-design-v1.md`、miru-hirogaruの発見音設計等）。継続的なBGMは単発の発見音よりも持続的・侵襲的な刺激になりうるため、既定はOFFとし、設定パネルの最上段（「音」の直下）という発見しやすい位置に置くことでEngagement重視の利用者が即座にONへ切り替えられるようにした。既存アプリ調査では`tyushi.html`（ひかるボタン）に類似の「BGM」トグル（既定ON）が存在するが、これは1回の操作ごとに約7.5秒だけ鳴る短い反応的な演奏であり、本アプリが目指す「セッション全体を通じて流れ続ける背景音」とは性質が異なるため、既定値をそのまま踏襲しなかった。

**Autoplay Policy対応**: `document`レベルの`pointerdown`/`keydown`リスナー（capture phase、副作用のみでpreventDefault/stopPropagationなし）により、Touch・Keyboard・Switch（物理スイッチはこのアプリでは既にkeydown/clickとして到達する設計）のいずれかによる最初の実操作でAudioContextを`resume()`し、BGM ONであれば再生を開始する。加えて`activateItem()`冒頭でもベストエフォートで同じ解錠を試みる（Gaze起点の呼び出しに対する保険、ただし後述の制約により確実性は保証されない）。**Gazeのみでの解錠は、ブラウザのautoplayポリシーが要求する「信頼できるユーザー操作」にrequestAnimationFrame駆動のdwellタイマーが該当しないため、原理的に不確実な既知の制約である。** ローカルのPlaywright自動テスト環境では簡易なmousemoveでも解錠に成功する挙動が観測されたが、これは自動化環境（headless Chromium）特有の緩和されたautoplay判定による可能性が高く、実機Safari等の厳格な挙動を保証するものではないため、本書はこれを「Gazeでの解錠が確実に動作する」根拠として扱わない。代替案として、設定パネルの「BGM」トグル自体（Gaze非対象・Touch/Keyboard/Switchでのみ到達可能な既存設計）を確実な解錠手段として位置づけている——Gaze主体の利用者でも、支援者が一度トグルへ触れればセッション中は継続再生される。

**多重再生防止（M7.1a時点でHTMLAudioElement方式に変更、下記参照）**: `bgmPlaying`/`bgmPlayAttemptInFlight`フラグによるガード、単一の`<audio id="bgmAudio">`要素。Level切替・trial切替では要素を再生成しない（同一要素が`loop`属性でループを継続）。55回の混在input活性化ストレス・20回のBGM ON/OFF連続切替ストレスいずれも、多重再生・console error・pageerrorともに0件を確認。

**Visibility制御**: `document.visibilitychange`で、タブが隠れたら`bgmAudioEl.pause()`（発見音用の共有AudioContextは別途`suspend()`）、復帰時にBGM ONであれば`startBgm()`で`play()`を再試行。

**音量バランス**: BGMファイル自体のピークは0.5（-6dBFS）だが、再生時は`bgmAudioEl.volume`で0.22倍に絞り、実効ピークは約0.11——既存発見音のピークゲイン0.13よりやや小さい値とした（M7.1時点の0.16→M7.1aで0.22へ引き上げ、詳細は下記）。MVPでは複雑なduckingは実装していない。

**Records/CSV**: 変更なし（9項目/9列を維持）。BGM設定は学習記録に含めていない。

**Audio User Review事項（未確認・ユーザー確認が必要）**: (1)可愛さ・楽しさの主観評価、(2)音量が適切か、(3)テンポ感、(4)聴き続けて疲れないか、(5)発見音を邪魔しないか、(6)Level1〜3を通じて違和感がないか——これらはAI自身が聴覚的に検証できないため、構造的な設計（ペンタトニック・エンベロープ・ループ処理・音量バランス）のみを保証し、実際の聴感評価はユーザーに委ねる。

### Phase M7.1a: BGM実機無音バグ調査・修正

Phase M7.1のLocal RC（`c5af79d`）をAudio User Reviewへ供したところ、設定でBGM=ONへ切り替えても**実際には聞こえない**ことが判明した。自動テスト（`audioCtx.state==='running'`、`bgmPlaying===true`、正しいbuffer/gain値）は全てPASSしていたが、これらは内部stateに過ぎず実際の音声出力を証明しないという本Phaseの指摘どおりの事象だった。

**Root Cause**: 当初実装はWeb Audioの`AudioBufferSourceNode`を使用し、unlockジェスチャの**後**にMP3を`fetch()`→`decodeAudioData()`し、かつ`audioCtx.resume()`を`await`せずに（fire-and-forgetで）`source.start(0)`を呼んでいた。headless Chromiumの自動テスト環境ではこの非同期gestureタイミングのズレが問題にならず内部stateは健全に見えたが、実機ブラウザでは同じ非同期経路が原因で実際の音声出力に至らなかったと判断した（正確な失敗メカニズムはブラウザ実装依存で完全特定はできないが、fetch/decodeという実質的に不確定な時間のかかる非同期処理をunlock gestureとplayback開始の間に挟んでいたこと自体が構造的リスクであり、これを取り除く方向で修正した）。

**調査手順と証拠**:
1. MP3 asset自体を`soundfile`で直接解析——peak 0.5、RMS 0.103、全882,000サンプルが非ゼロ、NaN/Infなし。**asset自体は正常**と確認。
2. Web Audio経路のtrace——fetch→decodeAudioData→source.start()の各段階を個別確認したが、いずれも「成功したように見える」内部stateしか得られず、実音の証拠にならないことを再確認。
3. `HTMLAudioElement`方式へ切替後、`currentTime`の実時間進行を計測——トグルON後、壁時計1.503秒の経過に対し`currentTime`が1.515秒進行（ほぼ1:1）。これは実際にブラウザが継続的にデコード・再生していることの強い証拠であり、単なる`paused===false`フラグより遥かに説得力のある検証とした。
4. OFF時は`currentTime`が完全に静止すること、ON→OFF→ON再開時に正しく`currentTime`が再進行することも確認。

**修正内容**: BGMの実装を`AudioBufferSourceNode`から`<audio id="bgmAudio" src="..." loop preload="auto">`（body直下、`aria-hidden="true"`）＋`HTMLAudioElement.play()/.pause()`へ全面変更した。理由は要件が示すとおり「実装方式へのこだわりより実機で確実に音が出ることを優先」——`<audio>`要素は自身でバッファリング・ループを完結し、`play()`が返すPromiseがautoplayブロック時に明示的にrejectするため、fetch/decodeの手動管理や非同期gestureタイミングのズレという不確実性の高い経路を排除できる。発見音（正確なタイミングでの短いoscillator2音）は変更のメリットが薄く、実装済みで実績もあるためWeb Audio（共有`audioCtx`）のまま維持した。

**音量再調整**: 旧実装のBGM_GAIN 0.16（Web Audio gain、ファイルpeak0.5への乗数）を、新実装ではBGM_VOLUME 0.22（`HTMLAudioElement.volume`、同じくファイルpeak0.5への乗数）へ引き上げた。実効ピークは約0.08→約0.11。「聞こえない」の根本原因は経路の問題であり音量そのものではなかった可能性が高いが、要件の推奨（0.20〜0.35を候補として比較）に従い、発見音のピークゲイン0.13をわずかに下回る範囲で余裕を持たせた。

**再検証結果**: ON/OFF/ON→OFF→ON/reload persistence/Touch・Keyboard・Switch解錠/Level切替/trial切替/visibility制御/4通りのsound設定組み合わせ/55回混在活性化ストレス/20回BGM切替ストレス——全てPlaywrightで`currentTime`の実進行を含めて再確認し、PASS。console error・pageerrorとも0件を維持。

**それでも自動テストでは証明できないこと**: 実際にスピーカー/ヘッドフォンから音が聞こえるか、システム音量・OSのミュート設定・実ブラウザのメディア許可設定等、JavaScriptから観測不能な要因は今回のような自動検証の範囲外である。今回の修正は「アプリ側のコードに起因する構造的な無音バグ」を解消したという主張に留まり、**実際に聞こえることの最終確認はAudio User Reviewに委ねる。**

### Phase M7.1b: オルゴールBGM調整

Phase M7.1aのLocal RC（`2e38233`）に対するAudio User Reviewの結果、**BGMが実際に鳴ることを確認（PASS）**、HTMLAudioElementによる再生基盤・BGM ON/OFFともに承認された。その上で、「オルゴール風の方がアプリの世界観に合う」というUser Feedbackを受け、再生基盤・game logic・他のcharacter/layout等には一切触れず、`assets/mitsukete-touch/audio/bgm-loop.mp3`の音楽的デザインのみを再設計した。

**新BGMコンセプト**: 「ふわふわ雲の上で、かわいい動物たちとかくれんぼをしているようなオルゴール」。子守唄ではなく、穏やかだが少し弾む、遊びのBGMを目指した。

**音色設計**: music box（オルゴール）系の音色を主役に据え、Phase M7.1のベル（やや非調和なパーシャル比）から、より調和的なパーシャル比（1, 2.006, 3, 4 — 2倍音のみわずかにデチューンして自然な揺らぎを持たせ、金属的になりすぎないようにした）へ変更。低次倍音ほど長く鳴る減衰設計（1.35秒/0.95秒/0.6秒/0.38秒）で丸く温かい響きとし、マスターローパスを6200Hz（M7.1は7000Hz）へ下げて高音の鋭さ（キンキン感）を抑えた。補助的に非常に薄いwarm pad（各小節頭に1回、root+fifthのdyadを小音量0.034で配置）を追加し、和声的な土台を与えつつ主旋律の邪魔をしないようにした。リバーブもM7.1（wet 0.22）よりさらに軽く（wet 0.15、taps 3本・より短いdelay）し、長い残響で音像が濁らないようにした。

**作曲**: 完全新規のオリジナル作曲。既存曲・童謡・有名なオルゴール曲の引用は一切なし。Cメジャー・ペンタトニック（C D E G A）中心、8小節のAABB的構成（bar0-1とbar4-5がほぼ同型の動機、bar2-3とbar6-7が応答的な動機、最終小節はC5一音で静かに減衰しループ境界へ繋がる）。旋律は意図的に疎らにし（1小節に2〜3音、休符を多く配置）、「音と音の間に適度な余白」を作った。和声進行はI–I–IV–V–I–I–IV–Iというシンプルな構成としたが、Phase M7.1（I–V–vi–IV–I–V–IV–I）とは別の進行にして単純な焼き直しにならないようにした。

**tempo/duration**: 80BPM（M7.1の96BPMよりゆったり）、8小節=24.0秒（M7.1は20.0秒）。要件の20〜30秒範囲内。

**ループ**: M7.1と同じ手法（末尾減衰テールの先頭への折り返し加算＋10msイコールパワー・クロスフェード）を踏襲。波形解析でループ境界前後が完全な無音（`0.0`）であることを確認済み。加えて、`currentTime`を意図的にループ境界直前（23.5秒）へシークしてから境界を跨がせるテストを行い、`paused`のまま停止せず正しく先頭付近（約1.17秒）へ折り返して再生継続することを確認した。

**音量/asset比較**: 新assetもM7.1と同じ手法でマスターピークを-6dBFS相当（0.5）へ正規化したため、アプリ側の`BGM_VOLUME`（`HTMLAudioElement.volume`）は0.22のまま変更していない。ただし新assetのRMSは0.128（M7.1のBGMは0.103）で、ピークは同一でも平均的な音圧はやや高め——疎らな旋律の合間を埋める常時鳴っているwarm padの存在が主因と考えられる。数値上clippingはなく（近フルスケールサンプル0件）、要件どおり「安易にvolume設定を変更しない」方針を維持したが、この音圧差はAudio User Reviewで報告し、体感で強すぎる場合は`BGM_VOLUME`側の微調整を次Phaseで検討する。

**比較用asset**: 差し替え前のPhase M7.1a版BGM（`bgm-loop-OLD-bell-for-comparison.mp3`）はリポジトリ外のスクラッチ領域にのみ一時保存し、コミットには含めていない。最終的にUserが試聴するのは新オルゴール版のみ。

**再検証結果**: Phase M7.1aで確立した検証一式（ON/OFF/ON→OFF→ON/reload persistence/Touch・Keyboard・Switch解錠/Level遷移/trial遷移/visibility制御/4通りのsound設定組み合わせ/55回混在活性化ストレス/20回BGM切替ストレス/`currentTime`実時間進行）を新assetに対して再実行し、全てPASS。再生基盤（`HTMLAudioElement`）・ファイルパス（`assets/mitsukete-touch/audio/bgm-loop.mp3`）・app側コードはPhase M7.1aから一切変更していないため、game logic・Records・CSV・Touch/Gaze/Switch/Keyboardへの影響はない。console error・pageerrorとも0件。

**Audio Validation事項（未確認・ユーザー確認が必要）**: 「オルゴールらしいか」「かわいいか」「M7.1のベル版と比べてより世界観に合うか」「音圧がやや高めに感じられないか」——これらはAI自身が聴覚的に検証できないため、構造的な設計（音色パーシャル比・エンベロープ・和声・音圧測定値）のみを保証し、実際の聴感評価はユーザーに委ねる。

### Phase M7.1c: Delicate Music Box Final Tuning

Phase M7.1b（オルゴール化）のAudio User Reviewでは、「BGMが実際に鳴ることを確認（PASS）」は維持されたものの、**旧BGMとの差が十分に感じられない・音の存在感がやや強い・もっと繊細な感じがよい**というフィードバックを受けた。目標を「オルゴール曲を前面で聴かせる」ことから、**「ふわふわした空の中で、遠くから小さなオルゴールが自然に聞こえてくる」**ことへ明確に引き下げ、`assets/mitsukete-touch/audio/bgm-loop.mp3`を再設計した（`mitsukete-touch-app.html`のplayback architecture・game logicには一切触れていない）。

**M7.1bからの具体的変更**:
- **warm padを完全に削除**——music box単体（モノフォニック、和音伴奏なし）で成立させた。M7.1bは各小節頭にroot+fifthのdyadを常時鳴らしていたが、これがBGMの密度・存在感を上げていたと判断し撤去した。
- **音数を大幅に削減**——M7.1bは旋律18音＋伴奏16音＝計34イベントだったのに対し、本版は**10音のみ**（メロディのみ、和音なし）。24秒あたりの音数密度は約9.5音（M7.1bは約34音）。
- **休符を積極的に設計**——10音を4つの短いフレーズ群（2〜3音ずつ）に分け、フレーズ間に平均2.55秒・最大6.08秒の完全な沈黙区間を配置した（「♪……ころん……　……♪……ころん、ころん……」のイメージ）。
- **音色をさらに柔らかく**——attackを2ms→9msへ延ばし最初のtransientを丸め、decayを短縮（1.35〜0.38秒→0.85〜0.20秒）して長く鳴り続けないようにし、上位倍音の音量をさらに絞った（2〜4倍音の振幅を0.40/0.16/0.06→0.30/0.10/0.03へ）。
- **マスターローパスを6200Hz→5500Hz**へ（要件の5000〜6000Hz候補範囲内）、こもらない範囲で高域をさらに抑制。
- **リバーブ（air）のwetを0.15→0.09**へ（要件の0.06〜0.12候補範囲内）、tapも3本→2本へ削減し、「大きなホール」ではなく「オルゴールの周囲にわずかな空気がある」程度に留めた。
- **velocity variation**: 各音に±15%のランダムな強弱（`rng.uniform(0.85,1.15)`）を付与し、機械的な均一感を避けた。
- **timing humanization**: 各音の発音位置に±12msのジッターを付与し、完全な等間隔感を弱めた（リズムが不安定になるほどではない範囲）。
- **register**: C5〜A5（中高域）のみを使用し、極端な高音（C6等）は使わない方針を維持・徹底した。
- **tempo**: 80BPM→76BPM（要件の72〜82候補範囲内）。ただしテンポ変更よりも音数削減を優先する方針どおり、テンポ差は小さく留めている。
- **duration**: 24.0秒→約25.26秒（要件の20〜30秒範囲内、「24秒を音で埋める必要はない」との指示どおり沈黙区間を許容）。
- **音圧の正規化方針を変更**——M7.1/M7.1bはピークを-6dBFS（0.5）へ強制正規化していたが、本版は「peakを必要以上に0.5へ正規化しない」という要件に従い、**RMSを直接0.075（要件の0.065〜0.090の中央値）へ正規化**する方式に変更した。結果として最終peakは0.441（自然な値、強制正規化なし）。

**M7.1bとの客観比較**（開発中のみ、比較用assetはリポジトリ外のスクラッチ領域にのみ保存しFinal commitには含めていない）:

| 指標 | M7.1b | M7.1c |
|---|---|---|
| RMS | 0.1275 | 0.075（-41%） |
| Peak | 0.500（強制正規化） | 0.441（自然） |
| 音イベント数（24秒あたり換算） | 約34 | 約9.5 |
| 和音/pad | あり（常時） | なし |
| ファイルサイズ | 173KB | 73KB |
| duration | 24.0秒 | 25.26秒 |

音数・音圧・ファイルサイズいずれも明確に減少しており、「客観的にも疎で静かになっている」ことを数値で確認した。

**ループ検証**: M7.1/M7.1bと同じ手法（末尾減衰の折り返し加算＋10msクロスフェード）を維持。境界前後の完全無音を波形解析で確認。加えて`currentTime`をloop終端-0.6秒へシークして境界を跨がせるテストで、`paused`のまま停止せず正しく先頭付近（約1.14秒）へ折り返し再生継続することを実測確認した。

**再検証結果**: Phase M7.1a/M7.1bで確立した検証一式（ON/OFF/ON→OFF→ON/reload persistence/Touch・Keyboard・Switch解錠/Level遷移/trial遷移/visibility制御/4通りのsound設定組み合わせ/`currentTime`実時間進行/loop境界越え）を新assetに対して再実行し、全てPASS。`mitsukete-touch-app.html`はPhase M7.1a以降変更していない（`BGM_VOLUME=0.22`も据え置き）ため、game logic・Records・CSV・Touch/Gaze/Switch/Keyboardへの影響はない。console error・pageerrorとも0件。

**Audio Validation事項（未確認・ユーザー確認が必要）**: 「繊細に感じられるか」「自然に背景へ溶け込んでいるか」「discovery SFXより明確に控えめか」「音圧・密度は今度こそ十分に下がったと感じられるか」——引き続きAI自身が聴覚的に検証できないため、構造的な設計・測定値の変化のみを保証し、実際の聴感評価はユーザーに委ねる。

---

## 24. 引用・参照

- `docs/multi-input/multi-input-program-design-v1.md`（Phase M0、v1.1）: Program共通方針全般。
- `miru-hirogaru-app.html` / `docs/multi-input/miru-hirogaru-design-v1.md`（Phase M1〜M4）: Pilot実装——semantic activation API、canonical/transient state分離、Gaze/Switch coexistence視覚パターン（内側リング/外側破線、offset 14px）、success-only設計、records/CSV最小仕様、10回→今回5回への完了基準変更判断の参照元。
- `docs/design-system/donomana-new-app-development-standard-v1_0.md`（v1.1）: Design System・Switch Scan・gaze/dwell・Release Policy等。
