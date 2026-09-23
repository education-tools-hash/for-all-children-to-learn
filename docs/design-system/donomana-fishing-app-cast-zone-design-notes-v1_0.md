# どのまな「さかなつり」Cast Zone Future Extension — Design Notes v1.0

## この文書について

このメモは、Phase `FISHING-APP-UX-VISUAL-HARDENING-1` の中でユーザーから明示的に
指示された Future Extension 候補「キャスト場所によって釣れる魚が変わる」を、
**今回のPhaseでは実装せず、仕様上の余地としてのみ**記録するために作成した。

正式なSource of Truthは以下の2文書である（いずれも本Phaseのbranch/worktreeの
lineageには含まれておらず、別branchにのみ存在する — 下記「Doc Fragmentation」参照）。

- `docs/design-system/donomana-fishing-app-design-contract-v1_0.md`
  （branch `design/fishing-app-design-finalize-1`）
- `docs/design-system/donomana-fishing-app-implementation-plan-v1_0.md`
  （branch `design/fishing-app-implementation-plan-1`）

Design Contract v1.0 §20「初版とFuture Extensionの境界（Decision 11・FINAL）」は
既にFuture Extension候補の一般的な枠組みを確立している（狙いキャスト・複数釣り場
バリエーション等）。本メモはその枠組みに、今回ユーザーが追加指示した候補を
1件追記するものであり、§20の原則（「実装する場合は個別の新規Phaseとして扱う」）を
そのまま継承する。

## Doc Fragmentation（既知の問題、本メモのスコープ外）

この2文書は、Design/Implementation Planブランチからそのまま
`feature/fishing-app-implementation-1` 系列へマージされておらず、実装系の
worktree（本Phaseを含む）には存在しない。過去のSST Record Detail系Phaseでも
同種の問題（設計docsがmainへ一度もmergeされない）が記録されている
（`[[donomana_project]]` メモリ、SST-RECORD-DETAIL-VIEWER-PILOT-1節）。
本Phaseのスコープではこの統合は行わない。将来のいずれかのPhaseで
「fishing-app設計docs一式をmainへ統合する」ドキュメント整理Phaseを推奨する。

---

## 1. Future Extension Candidate: FISHING-APP-CAST-ZONE-DESIGN-1（仮Phase名）

### 1.1 構想

Userがキャストする場所（cast zone）を選ぶことで、その場所に応じて出現する魚の
種類・特徴が変わる。

例:
- 浅瀬 → 小さな魚
- 水草の近く → 特定の魚
- 岩場 → 別の魚
- 深場 → 大きな魚
- 中央 → 標準的な魚

この仕組みにより、「どこに投げるか」→「どんな魚が来るか」という因果関係と
選択性を、現行の完全自動アワセ方式（Design Contract §8・§9、狙い不要・失敗なし
の原則）を壊さずに追加できる可能性がある。

### 1.2 現行実装との関係

現行の`sakana-tsuri.html`（mode="free" x reelMethod="hold" Pilot）は、キャスト
位置の選択が存在せず、`FISH_START_PCT`/`FISH_Y_PCT`という単一の固定座標へ
常にキャストする。今回のPhase（FISHING-APP-UX-VISUAL-HARDENING-1）で
`FISH_PALETTE`を「data-drivenな魚定義テーブル」として明示的にコメント整備した
（`sakana-tsuri.html`内、`FISH_PALETTE`定義直前のコメント参照）のは、将来
このテーブルへ`zone`のような追加フィールドを足すだけでcast zone連動を
実装できる余地を残すためであり、本Phaseでの機能実装ではない。

## 2. Cast Zone Design Principles（Future Phase向け指針）

- 最初から細かい座標指定を要求しない。大きく分かりやすい選択領域から始める。
  例: 「左／中央／右」または「浅瀬／水草／深場」程度の粒度。
- 重度・重複障害のある利用者でも選択できるよう、large target・Switch Scan・
  Gaze・Touchのいずれでも選択可能な構造で設計すること
  （既存の共通A11yパネル・`data-scan`属性の慣習に合わせる）。
- 狙いキャスト（正確な位置への高精度操作）を必須にしないこと — Design Contract
  §20が既に「正確な狙いキャスト必須」を初版除外・Future Extension候補としており、
  cast zoneは「大まかな方向/エリア選択」であって「精密操作」ではない、という
  区別を維持する。

## 3. Fish Variation（データ設計方針）

将来的に魚ごとに以下をdata-drivenに定義できる設計を検討する。

- 種類（type）
- 色（color、既存`FISH_PALETTE`の`color`と統合）
- 大きさ（size、既存`currentFish.size`と統合）
- 出現エリア（zone、新規）
- 動き（movement pattern、新規）
- 出やすさ（spawn weight相当。「rarity」という競争的な語感を避け、
  学習教材として中立な呼称を検討する）

**ただし、競争的な「レア魚集め」を主目的にしないこと。** Design Contract §20が
「複雑な魚コレクション」を初版除外・Future Extension候補（簡易な一覧表示に
とどめる範囲でのみ将来検討）としている方針と整合させる。

## 4. Learning Connection（将来の学習モード接続候補）

キャスト場所による魚種変化は、将来的に以下のような学習モードと接続できる
余地を残す。

- 赤い魚が来る場所を選ぶ
- 大きい魚がいる場所を選ぶ
- 2匹釣る
- 指定された魚を探す

**ただし、自由に釣る体験（mode="free"）は常に残すこと。** 学習モードは
既存のfree modeを置き換えるのではなく並列に追加する候補として扱う
（Design Contract §6.1「Mode並列構成」の既存方針と整合）。

## 5. Current Phase Boundary（FISHING-APP-UX-VISUAL-HARDENING-1）

今回のPhaseでは以下を実装していない（意図的なスコープ外、上記1〜4は
すべて仕様上の余地の記録のみ）:

- cast zone
- 場所選択
- 魚種分岐
- 狙いキャスト

今回のPhaseは「自由に釣る × 長押し」の体験品質完成（魚の視認性・bite
approach・reeling resistance・caught演出・scene一体感）に専念し、上記は
次のいずれかのFuture Phaseで個別に着手する。

---

## 変更履歴

- v1.0（2026-09-23、Phase `FISHING-APP-UX-VISUAL-HARDENING-1`内でユーザー指示に
  基づき新規作成）: Future Extension候補「キャスト場所によって釣れる魚が変わる」
  （仮Phase名 `FISHING-APP-CAST-ZONE-DESIGN-1`）を記録。Product code変更なし
  （本文書はdocsのみ、`sakana-tsuri.html`側の対応コメントは別コミット）。
