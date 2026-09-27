# どのまな「さかなつり」Future Roadmap v1.0

Phase `FISHING-APP-INPUT-SETTINGS-1`（実装Phase）内で、ユーザー指示
§8〜§22に基づき正式に記録する後続ロードマップ。**本書はロードマップの
記録のみであり、ここに挙げるいずれの機能も本Phaseでは実装していない。**

## この文書の位置づけ

- 入力方式（Method A/B/C、Gaze、Switch Scan、Real Device Gate）の詳細設計は
  既に`docs/design-system/donomana-fishing-app-input-methods-design-v1_0.md`
  （Phase `FISHING-APP-INPUT-METHODS-DESIGN-1`、Design Checkpoint `fa8b672`）
  に確定済み。本書はそれを要約・再掲し、Phase名一覧に位置づけ直す。
- Cast Zoneの構想は既に
  `docs/design-system/donomana-fishing-app-cast-zone-design-notes-v1_0.md`
  （Phase `FISHING-APP-UX-VISUAL-HARDENING-1`内で作成）に記録済み。本書は
  それを要約・再掲する。
- **学習モード（色指定・数指定）は本書で新規に正式記録する**（ユーザー指示
  §11〜§15、これまでの文書に存在しない内容）。
- Fish Data Model（§18）、Cross-App Record／Metadata／Production Release
  （§22の残りのPhase名）も本書で新規に正式記録する。

Doc Fragmentation注記は既存2文書と同一のため、ここでは繰り返さず参照のみ
とする。

---

## 1. 操作方式とは別軸としての「学習モード」

ユーザー指示§11の通り、「どう巻くか」（操作方式: Method A/B/C）と
「何を学ぶか」（学習モード: 自由/色/数）を独立した2軸として設計する。

| 軸 | 選択肢 |
|---|---|
| 操作方式（Input Method） | Method A（円弧）／Method B（長押し、実装済み）／Method C（タイミング、実装済み・`FISHING-APP-METHOD-C-1`） |
| 学習モード（Learning Mode） | 自由（実装済み・今後も必ず残す）／色指定／数指定 |

15章（ユーザー指示）の通り、**学習モード×操作方式は強くcoupleさせない**。
UI構造上も、`sakana-tsuri.html`内で「今どの学習モードか」と「今どの操作
方式か」を別々の状態変数として持ち、片方の値がもう片方の選択肢を制限
しない設計とする（例外: Gaze×Method Bのような、既にInput Methods Design
で確定済みの入力方式側の制約はそのまま有効。学習モード側からの追加制約は
設けない）。

---

## 2. 自由モード（現行・今後も維持）

現在の`sakana-tsuri.html`の中心モード。目的は因果関係・操作と結果の対応・
魚が近づく体験・釣れた達成感の獲得であり、好きな魚を自由に釣る。
**このモードは将来のどのPhaseでも削除・置き換えの対象にしない**
（ユーザー指示§12「このモードは今後も必ず残してください」）。

---

## 3. 色指定モード（Future Phase: 正式記録のみ）

### 3.1 想定Phase名

- `FISHING-APP-COLOR-MODE-DESIGN-1`（設計のみ）
- `FISHING-APP-COLOR-MODE-IMPLEMENTATION-1`（実装、Design Phase完了後）

### 3.2 構想

例:「赤い魚を釣ろう」。指定された色 vs 実際に釣れた魚の色を照合する方式を
基本候補とする（既存Learning Recordの`caughtColor`フィールドがまさに
この照合に使える値を既に記録している——3.4節参照）。

### 3.3 初期色・将来拡張

- 初期色: 赤・青・黄（既存`FISH_PALETTE`と完全に一致、新しい色を作る
  必要がない）。
- 将来拡張候補: 緑・オレンジ・紫（`FISH_PALETTE`への追加のみで対応でき、
  既に「data-drivenな魚定義テーブル」として設計済み——前Phase
  `FISHING-APP-UX-VISUAL-HARDENING-1`のコード内コメント参照）。

### 3.4 色だけに依存しない設計（必須要件）

ユーザー指示の通り、以下いずれかまたは複数の代替情報を必ず持たせる。

- 文字（例: 画面上に「あかい さかなを つろう」という文言表示、既存の
  `elStatusChip`/`donomanaAnnounce`の仕組みがそのまま使える）
- 音声（既存Reaction Layer・読み上げ機構の拡張で対応可能）
- 視覚形状（魚のSVGは既に頭・胴体・尾びれ・目・ひれを個別パスで持つため、
  色以外の形状差（例: 斑点・縞模様のオーバーレイ）を将来追加する余地が
  ある）
- 状態表示（「めざす いろ」を常時表示するUI要素）

### 3.5 判定方式

指定された色（`targetColor`）と実際に釣れた魚の色（`currentFish.color`）
の一致判定を基本候補とする。**この2つのフィールドは共に既存Learning
Record payloadに既に存在する**（`targetColor`は現在`null`固定、
`caughtColor`は`currentFish.color`から記録済み）——10章参照。

---

## 4. 数指定モード（Future Phase: 正式記録のみ）

### 4.1 想定Phase名

- `FISHING-APP-NUMBER-MODE-DESIGN-1`（設計のみ）
- `FISHING-APP-NUMBER-MODE-IMPLEMENTATION-1`（実装、Design Phase完了後）

### 4.2 構想

例:「2匹釣ろう」。初期1〜3匹、将来1〜5匹まで拡張。

### 4.3 進捗表示

- 例示: 「あと2匹」「あと1匹」「できた！」
- 数字表示のON/OFFを教師設定で切り替えられる余地を残す（2章で新設した
  「アプリ固有詳細設定パネル」に、将来この設定行を追加できる構造に
  しておく——本Phaseで実装したpreset-group方式のCSS/JS構造はMethodや
  難易度以外の任意の2〜3択設定にもそのまま再利用できる）。
- **数字を読めない利用者にも成立するよう、視覚的な個数表現も検討する**
  （例: 釣った魚のアイコンを実際に並べて表示する、既存`.fish`のSVGを
  小さく複製して並べる方式が候補になりうる。詳細設計は
  `FISHING-APP-NUMBER-MODE-DESIGN-1`で行う）。

### 4.4 Learning Recordとの関係

`targetCount`は現在Learning Record payloadに既に存在する
（現在`null`固定）。数指定モード実装時は、この既存フィールドへ実際の
目標数を書き込むだけでよい（10章参照）。

---

## 5. 色・数モード × Input Method（結合方針）

ユーザー指示§15の例（色モード×Method B、数モード×Method C）の通り、
学習モードはMethod A/B/Cのいずれとも組み合わせ可能な構造とする。1章の
「別軸」原則がそのままこの要件を満たす——学習モードの判定ロジック
（色/数の照合）は`landFish()`（釣れた瞬間）にフックする形にすれば、
どのMethodで巻いてきたかに関わらず同一の判定コードで扱える
（`applyReelProgress`がMethod A/B/C共通のcanonical entry pointであるのと
同じ設計原則、Input Methods Design v1.0 §1.1参照）。

---

## 6. Cast Zone（既存文書の要約・再掲）

### 6.1 想定Phase名

`FISHING-APP-CAST-ZONE-DESIGN-1`（設計のみ、既に構想は文書化済み）

### 6.2 構想（要約）

キャストする場所（cast zone）によって出現する魚の種類・特徴が変わる
（浅瀬→小さな魚、水草付近→特定の魚、岩場→別の魚、深場→大きな魚、
中央→標準魚）。詳細は
`docs/design-system/donomana-fishing-app-cast-zone-design-notes-v1_0.md`
を参照（cast zone選択UIの設計原則——大きく分かりやすい領域、Switch
Scan/Gaze/Touch対応——も既にそちらに記録済み）。

### 6.3 学習モードとの接続（新規記録、ユーザー指示§17）

将来、色モード×cast zone（例:「赤い魚がいる場所を選ぼう」）、数モード
×cast zone（例:「3匹釣ろう」で複数zoneを組み合わせる）へ発展できる
設計余地を残す。**ただし自由に釣るモードは常に残す**（2章と同じ原則）。
この結合の詳細設計は、cast zone・色モード・数モードそれぞれのDesign
Phaseが個別に完了した後、統合設計として別途行う（本Phaseでは方針の
記録のみ）。

---

## 7. Fish Data Model（構想のみ、実装しない）

将来の魚種追加に備えたdata-driven構造の候補フィールドを記録する
（ユーザー指示§18）。

```js
// 構想例、実装しない
{
  id: 'fish-red-01',
  name: 'あかいさかな',       // 表示用（将来、色指定モードの文言等で使用）
  color: 'red',                // 既存FISH_PALETTEのcolorと統合
  size: 2,                     // 既存currentFish.sizeと統合
  habitat: 'shallow',          // cast zoneとの接続用（6章）
  movement: 'slow',            // 将来、種類ごとに泳ぎ方を変える場合
  visualVariant: 'default',    // 将来、同じ色でも見た目のバリエーションを増やす場合
  spawnWeight: 1               // 出やすさ。"rarity"という競争的な語は避ける
}
```

**競争的な「レア魚集め」を主目的にしない**（ユーザー指示、既存
`donomana-fishing-app-cast-zone-design-notes-v1_0.md`のFish Variation節
でも同じ方針を確認済み）。本Phaseでは実装しない。将来のPhaseで
`FISH_PALETTE`をこの形へ拡張する際は、既存の`color`/`hex`キーとの
後方互換を維持すること。

---

## 8. Input Methods（既存文書の要約・再掲）

`docs/design-system/donomana-fishing-app-input-methods-design-v1_0.md`
（Design Checkpoint `fa8b672`）に確定済み。想定Phase名（既存文書の
12章を再掲、ユーザー指示§22の番号付けと対応）:

1. `FISHING-APP-METHOD-A-1`（円弧ジェスチャ、Touch/Pointer中心、
   tokei-app.htmlのatan2/angleDiffを角度計算のみ参考、Gaze/Switchへ
   円弧を要求しない）
2. `FISHING-APP-METHOD-C-1`（タイミング、ミス時はreelProgress減少なし・
   進行量0のみ・ペナルティなし、Gaze/Switchとの親和性が高い方式、
   **実装済み**：`sakana-tsuri.html`に`reelMethod: 'timing'`として追加、
   既存の状態機械・Learning Record・Method A/Bへの変更なし）
3. `FISHING-APP-SWITCH-SCAN-1`（現状`data-scan="1"`はあるがhelper6
   自動走査は未実装、という既知のギャップを埋める）
4. `FISHING-APP-GAZE-1`（Tobii Eye Tracker 5等、Gaze Standard v1.0の
   dwell 900ms初期値・300〜3000ms可変・Leave-and-Reenter Gate等を継承。
   Method A→非対応、Method B→原則非対応または限定候補、Method C→
   主要候補）
5. `FISHING-APP-REAL-DEVICE-GATE-1`（iPad Safari・Blue2・Tobii・Touch・
   Keyboardの実施マトリクス、既存文書11章）

---

## 9. Cross-App Record / Metadata / Production Release（枠組みのみ）

ユーザー指示§22が列挙する残り3Phaseについて、現時点で確定している
枠組みのみを記録する（詳細設計は各Phase自身で行う）。

- **`FISHING-APP-CROSS-APP-RECORD-1`**: sakana-tsuriのLearning Record
  payload（10章）を、どのまなサイト全体の学習記録ダッシュボード（既存
  `donomana-learning-record-standard-v1_0.md`・Common Record Detail
  Foundation）へ接続するPhase。**既存Core Schema上で許容される範囲の
  みを使用し、独自schemaは新設しない**という原則（今回のPhaseで既に
  適用、10章）をそのまま継承する。
- **`FISHING-APP-METADATA-1`**: `apps-data.json`への正式登録
  （id/filename/icon/summary/features/steps/lesson/a11y/badges等）、
  および`generate.js`の`SETTINGS_PROXY`マップへ
  `'sakana-tsuri': { selector: '#sakanaSettingsBtn', label: '...' }`を
  追加するPhase。本Phase（`FISHING-APP-INPUT-SETTINGS-1`）は
  `#sakanaSettingsBtn`という安定したselectorを既に用意しており、
  METADATA Phaseではこの1行を追加して`node generate.js`を実行するだけで
  よい（実装コスト・リスクを本Phaseの時点で最小化済み。13章の
  sandboxed byte-diff検証で動作確認済み）。
- **`FISHING-APP-PRODUCTION-RELEASE-1`**: 上記すべて（Input Methods・
  学習モード・Cast Zone・Cross-App Record・Metadata）が完了し、
  User Browser Review・Real Device Gateを経た後の最終公開Phase。

---

## 10. Learning Record 拡張余地（本Phase時点の整理）

本Phase（`FISHING-APP-INPUT-SETTINGS-1`）で確認・追加したフィールドと、
将来追加候補フィールドを一覧化する。独自schemaは新設していない
（既存`donomanaRecordCreate(appId, activity, inputMethod, payload)`の
`payload`はもともと自由なオブジェクトであり、Core Schemaはこの4引数の
形自体——`payload`の中身の個々のキーには関知しない）。

| フィールド | 状態 | 導入Phase |
|---|---|---|
| `reelMethod` | 既存（`'hold'`固定） | FISHING-APP-IMPLEMENTATION-1 |
| `difficulty` | 既存（`null`固定） | FISHING-APP-IMPLEMENTATION-1 |
| `reelGainPreset` | **本Phaseで追加**（`'small'/'medium'/'large'`） | FISHING-APP-INPUT-SETTINGS-1 |
| `reelSpeedPreset` | **本Phaseで追加**（`'slow'/'standard'/'fast'`） | FISHING-APP-INPUT-SETTINGS-1 |
| `targetColor` | 既存（`null`固定、色指定モードが書き込む予定地） | FISHING-APP-IMPLEMENTATION-1（フィールドのみ）→ FISHING-APP-COLOR-MODE-IMPLEMENTATION-1（実値） |
| `targetCount` | 既存（`null`固定、数指定モードが書き込む予定地） | FISHING-APP-IMPLEMENTATION-1（フィールドのみ）→ FISHING-APP-NUMBER-MODE-IMPLEMENTATION-1（実値） |
| `learningMode`（将来） | 未追加 | 色/数モードいずれかの実装Phaseで追加候補（`'free'/'color'/'number'`、1章の軸を明示的に記録する場合） |
| `castZone`（将来） | 未追加 | FISHING-APP-CAST-ZONE-DESIGN-1後の実装Phase |
| `fishType`（将来） | 未追加 | Fish Data Model（7章）が実装される場合 |

`reelMethod`は現在`'hold'`固定だが、Method A/C実装後は`'arc'`/
`'timing'`という値を持つようになる（フィールド自体の追加は不要、
Input Methods Design v1.0 §10.2で既に整理済み）。

---

## 変更履歴

- v1.0（2026-09-23、Phase `FISHING-APP-INPUT-SETTINGS-1`で新規作成）:
  学習モード（自由/色/数）を新規に正式記録。既存のInput Methods Design
  （Design Checkpoint fa8b672）とCast Zone Design Notesを要約・再掲し、
  ユーザー指示§22が列挙する13Phase名を本書1件に集約。Fish Data Model・
  Cross-App Record・Metadata・Production Releaseの枠組みを記録。
  Production code変更0件（docsのみ）。
