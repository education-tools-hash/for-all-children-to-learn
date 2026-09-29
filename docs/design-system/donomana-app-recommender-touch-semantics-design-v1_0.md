# 「3つの質問」Touch入力semantics 再設計 v1.0

- Status: DESIGN COMPLETE（設計のみ。コード・metadata変更なし）
- Phase: `APP-RECOMMENDER-TOUCH-SEMANTICS-DESIGN-1`
- 作成日: 2026-09-30
- Baseline: `origin/main` = `87b7d1f63b197401992d0122caba445e446350c3`
- Branch: `design/app-recommender-touch-semantics-design-1`
- 前提Phase: `APP-INPUT-METADATA-TOUCH-RE-AUDIT-1`（CURRENTLY_CORRECT 21件・SAFE_ADD 15件・PARTIAL/AMBIGUOUS/POSSIBLE_OVERREPORT いずれも0件、projected touch coverage 36/36）
- 本文書は**設計のみ**。`apps-data.json`・`wizard.html`・app source・testsのいずれも変更しない。

---

## 0. Executive Summary

Touch再監査の結果、`apps-data.json`の`touch`値を実装事実へ正しく揃えると**36アプリ全てがtouch=trueになる**ことが判明した。現在の`wizard.html`のQ1（操作方法）は`touch`/`switch`/`gaze`/`any`（こだわらない）の4択で、`touch`選択時は`apps.filter(a => a.input.includes('touch'))`という**完全一致のhard filter**として動作している（`wizard.html` L728-733）。

**この設計のまま36/36を反映すると、「画面に直接触れる」を選んだ場合と「こだわらない」を選んだ場合の結果が完全に同一（36件）になる。** つまりTouch選択肢は情報量ゼロの選択肢になり、事実上「こだわらない」の別名でしかなくなる。一方、`switch`（28/36）と`gaze`（16/36）は今回の監査対象外であり、引き続き意味のある絞り込みとして機能する。

これはmetadataの問題ではなく、**Wizardの質問設計がTouch=universalという前提に対応できていない**という構造的な問題である。本Phaseでは、単純な「Touch質問削除」に決め打ちせず、利用者（教員・保護者）が本当に知りたい情報が何かを起点に4案＋を比較し、以下を推奨する：

**推奨: Option B（Touchを標準入力として前提化し、Wizardでは「追加の入力方法が必要か」を聞く形に再設計）を第一候補とし、より細かいgesture情報（Option C/Dの客観的データ版）は将来の別metadata・別用途（ranking/detail表示）として切り離す。**

実装順序は、(1) `APP-INPUT-METADATA-TOUCH-CORRECTION-1`でmetadataのtruth correctionを**先に単独で実施**、(2) その後`wizard.html`のQ1文言・ロジック変更を別Phaseとして実施、(3) 両方をUser Reviewしてから初めてProduction Releaseする、という2段階を推奨する。

---

## 1. Background（監査結果の継承）

`APP-INPUT-METADATA-TOUCH-RE-AUDIT-1`（read-only、baseline `87b7d1f`）の結果：

| 分類 | 件数 |
|---|---|
| CURRENTLY_CORRECT | 21 |
| SAFE_ADD | 15 |
| PARTIAL | 0 |
| AMBIGUOUS | 0 |
| POSSIBLE_OVERREPORT | 0 |
| **合計** | **36** |

projected touch coverage: 21 + 15 = **36/36（100%）**。この結果を本Phaseの前提として使用する。ただしmetadata自体はまだProductionへ反映されていない。

---

## 2. 現在のWizard実装（read-only確認、`origin/main`直接参照）

`wizard.html`（864行、単一ファイル）:

1. **データソース**: `apps-data.json`を`fetch()`で動的取得（過去のHARDENING-1 Phaseで手書きDBから移行済み）。
2. **質問構成（3問）**:
   - Q1（操作方法）: `touch` 👆画面に直接触れる / `switch` 🔘外部スイッチ / `gaze` 👀視線入力 / `any` ✨こだわらない
   - Q2（育てたい力）: `apps-data.json`の`category`4種にそのまま対応
   - Q3（大切にしたいこと）: `apps-data.json`の`need`配列（literacy/time/communicate/life・social）に対応。**絞り込みには使わず、同点内の並び替えにのみ使用**（`stableSortByQ3`、L706-726）。
3. **Q1のフィルタロジック**（`filterAndRank`、L728-746）:
   ```js
   var inputFiltered = (ans.q1 === 'any')
     ? apps.slice()
     : apps.filter(function (a) {
         return Array.isArray(a.input) && a.input.indexOf(ans.q1) !== -1;
       });
   ```
   `any`以外は**完全一致のhard AND filter**。`input`配列にその値が無いアプリは無条件に除外される（表示順位を下げるのではなく、結果セットから完全に消える）。
4. **Q2**はフィルタではなく**グルーピング**（`recommended`/`others`の2群、除外なし）。
5. **現在の各入力方式の該当数**（`origin/main`の`apps-data.json`より確認、36アプリ中）:

   | input値 | 該当数 | Wizard Q1の選択肢か |
   |---|---|---|
   | touch | 21 | ✅（本Phaseの対象） |
   | switch | 28 | ✅ |
   | gaze | 16 | ✅ |
   | keyboard | 24 | ❌（Q1の選択肢にそもそも無い） |
   | gamepad | 2 | ❌（同上） |

   keyboard・gamepadはそもそも現在のWizard Q1に選択肢として存在しない。これは本Phaseが作った制約ではなく既存の設計判断であり、本Phaseはこれを変更しない。

---

## 3. Problem statement

**Touch=36/36を素直に反映すると、Q1の4択のうち「touch」と「any」が常に同じ結果セットを返す。** 選択肢として存在する意味がなくなる一方、選択肢自体は画面に残り続け、利用者に「選んでも選ばなくても同じ」という無意味な意思決定を強いることになる。これは:

- 利用者の時間を無駄にする（教材探しを遅くしないという運用原則に反する）
- 「Touch対応」というmetadata自体の信頼性を損なう可能性がある（もし後で気づかれた場合）
- switch(28)・gaze(16)という**本当に意味のある**絞り込みの隣に、意味のない選択肢が並ぶことで、Wizard全体の設計品質への信頼を下げる

---

## 4. User needs（「Touch対応」という1bitが実際に伝えている可能性のある意味）

現状の「Touch対応」表示・選択肢は、以下のような異なる意味を暗黙に混在させている:

- タップだけで使える
- スワイプが必要
- ドラッグが必要
- 長押しが必要
- 複数指操作が必要
- 正確な位置合わせが必要
- 画面全体を触るだけで反応する
- 小さいtargetを狙う必要がある
- 連続的な指の動きが必要
- touchを主入力として使える（switch/gazeを使わなくても良い）

今回の監査で判明した実態（36/36がtouch可能）を踏まえると、利用者が本当に知りたいのは「touchで使えるかどうか」ではなく、**「switch/gazeなど特別な入力機器が必要か、それとも普通のタッチ操作で十分か」**、そして場合によっては**「どのくらい細かい操作（ドラッグ・なぞり書き・長押し等）が必要か」**である可能性が高い。前者は既存のswitch/gaze filterで既にほぼ満たされている。後者は現在のmetadataでは表現されていない。

---

## 5. Touch task taxonomy（36アプリのタッチ操作実態、read-only分類）

前Phaseの実コード監査結果を踏まえた概観（厳密な1app=1分類ではなく傾向把握目的）:

| タイプ | 該当app例 | 件数目安 |
|---|---|---|
| tap-only（単純タップ中心） | janken-app, shiritori2, sst-app, timetable-app, sugoroku-app, cup_game, dotchiga-ii, miru-hirogaru-app, mitsukete-touch-app, junban-miyou-app, kurabeyou-app, okane-app, gaze-keyboard, directions-app 等 | 過半数（20件以上） |
| tap + 連続タップ | mogura-tataki | 1〜2件 |
| drag | schedule-app（並べ替え）, slideshow-sakusei（並べ替え）, katachi-awase-app（配置、tap fallbackあり） | 3件 |
| trace（なぞり） | nazori-app, hiragana-learn, katakana-app, suji-manabou | 4件 |
| long-press | schedule-app, slideshow-sakusei（drag起点として） | 2件（dragと重複） |
| 連続ポインタ移動（描画） | drawing-app, scratch-app | 2件 |
| 画面全体反応 | sawatte-hirogaru-app | 1件 |
| 精密な位置合わせ | tokei-app（時計針drag）, time-timer（ダイヤルdrag）, mogura-tataki（小さい的） | 3件程度（他分類と重複） |
| multi-touch | scratch-app, sawatte-hirogaru-app | 2件 |

**この分布が示すこと**: 「Touch対応」という一語では、単純タップだけで完結するapp（過半数）と、なぞり書き・ドラッグ・多点タッチを要求するapp（1割強）が同じ扱いになっている。これは利用者、特に運動機能に制約のある子どもを担当する教員・保護者にとって、実務上意味のある区別を覆い隠している。

---

## 6. Design options

### Option A — Touch質問をWizardから外す（metadataは保持）

Touch metadataはそのまま保持するが、Wizard Q1では聞かない。Switch/Gaze（＋必要ならkeyboard）だけを聞く。

- **Strengths**: 実装が単純。無意味な選択肢を除去できる。質問数を増やさない。
- **Weaknesses**: 「Touchで使えるか」という情報がWizard上で一切見えなくなる（結果カードのバッジ表示では見えるが、質問としては存在しない）。「なぜTouchの選択肢が消えたのか」を利用者へ説明しにくい。
- **Suitable use case**: とにかくシンプルさを最優先する場合。

### Option B — Touchを標準入力として前提化する（推奨）

Q1を「操作方法を選ぶ」ではなく「追加の入力方法が必要か」という質問へ再構成する。例（文言は未確定、方向性のみ）：
「多くのアプリは画面タッチで使えます。ほかに使う入力方法はありますか？」→ 🔘外部スイッチ / 👀視線入力 / ✨特にない（タッチで使う）

- **Strengths**: 現状のfilterロジック（switch/gaze=hard filter、該当なし=除外）をほぼそのまま流用でき、実装コストが低い。switch/gazeという**本当に意味のある**絞り込みは維持される。「Touchはほぼ全対応」という監査で判明した事実に即した、誠実な文言。質問数を増やさない（既存Q1を置き換えるだけ）。
- **Weaknesses**: 「touchを選ぶ」という明示的な行為が無くなるため、Touch自体を積極的に選びたい利用者（他の選択肢との対比で安心感を得たい等）には多少の説明が要る。文言設計に注意が必要（「タッチが前提」という書き方が、touchを使えない子どもの保護者を疎外しないよう配慮が要る——後述§9参照）。
- **Suitable use case**: 現状のfilterの信頼性・実装の単純さを保ったまま、監査結果の誠実な反映を優先する場合。**本Phaseの第一推奨。**

### Option C — Touch semanticsを細分化する（tap/drag/swipe/trace/longPress等）

§5の分類を正式なmetadata（例: `touchGestures: ['tap','drag','trace',...]`）として持たせ、Wizardでも選択肢化する。

- **Strengths**: 最も情報量が多い。運動機能の特性に合わせた高精度な絞り込みが理論上可能。
- **Weaknesses**: 36アプリ全ての再監査・再分類が必要（新たなAudit Phase相当の工数）。Wizardの選択肢・質問数が増える、または既存3問を再設計する必要がある。「ドラッグが少しでも含まれるapp」を機械的に除外すると、実際には十分使える教材まで過剰に除外するリスクがある（§7参照）。専門用語（trace/multi-touch等）を利用者にどう翻訳するかという新たな課題が生じる。
- **Suitable use case**: 将来、教材数が大幅に増え、運動機能別の絞り込みニーズが実際に強まった場合。**今回は時期尚早と判断。**

### Option D — Touch difficulty / motor demandへ再定義する

入力方式ではなく「画面のどこでも触れる」「正確な位置合わせが必要」等、操作の身体的要求として再定義する。

- **Strengths**: 特別支援教育の現場感覚（「この子はどこまでの操作ができるか」）により近い。
- **Weaknesses**: 「簡単」「難しい」といった主観的な3段階評価に陥りやすく、監査可能性・一貫性を保つのが難しい（§21-22の「客観的に判定できるmetadataを優先する」という原則に抵触しやすい）。実質的にはOption Cのgestureデータを異なる言葉で提示しているだけであり、**独立したデータモデルというよりOption Cの提示方法の一種**として扱うのが適切。
- **Suitable use case**: Option Cの客観的gestureデータが蓄積された後、その**表示・翻訳レイヤー**として採用する場合（例: 「drag操作を含む」を「指を動かし続ける操作が必要です」と自然文へ変換する）。単独では今回推奨しない。

### 追加案は必要なし

A〜Dの4案の組み合わせ（B＋将来のC/Dの部分採用）で十分カバーできると判断し、5案目は提案しない。

---

## 7. Comparison table

| Option | 利用者への分かりやすさ | 絞り込みへの実効性 | 特別支援現場での意味 | 重度・重複障害児にも有用か | metadata維持負荷 | 実装complexity | 将来拡張性 | 主なリスク |
|---|---|---|---|---|---|---|---|---|
| A（質問削除） | 高（選択肢が減りシンプル） | switch/gazeは維持、touch概念は消滅 | 中（touchの可否が見えなくなる） | 中 | 低（変更なし） | 低 | 中 | 「なぜ消えたか」の説明責任 |
| **B（touch標準化・推奨）** | 高（「追加の入力方法」という素直な聞き方） | switch/gazeは現状維持、touch自体は前提化 | 高（switch/gaze利用者を明確に区別しつつ、touch利用者への配慮文言も可能） | 高（switch/gaze利用者への案内は変わらず機能） | 低（既存metadata流用） | 低〜中（文言・分岐ロジックの変更） | 高（将来Option C/Dを追加質問として後付け可能） | 文言設計を誤ると「touch前提」が排他的に読める |
| C（gesture細分化） | 中〜低（専門用語の翻訳が必要） | 非常に高い（理論上） | 高（運動特性に踏み込める） | 高いが実装依存 | 高（36app再監査必須） | 高 | 高いが今は時期尚早 | 過剰filterで候補を消しすぎる、専門用語の押し付け |
| D（motor demand再定義） | 中（主観的表現になりがち） | 中（主観評価だと監査困難） | 高いが一貫性に課題 | 高いが評価者依存 | 高（評価基準の継続監査が必要） | 高 | Cのデータがあれば向上 | 主観評価の一貫性・監査可能性の欠如 |

---

## 8. Relationship with developmental pathway（因果関係→選択→マッチング→認知→コミュニケーション）

発達段階に基づく教材探し（今後整備予定）と、入力方式（touch/switch/gaze）は**独立した別軸**である。「選択ができる」という発達段階の子どもは、touch・switch・gazeのいずれでその選択を行ってもよい。したがって:

- 本Design（Option B）は発達段階質問と**競合しない**。Q1を「追加の入力方法」という軽い質問に整理することで、むしろ将来Wizardへ発達段階質問を追加する余地を作ることにもなる。
- 逆に、Option C/Dの「gesture複雑度」を安易に「発達段階の高さ」と混同しないよう注意が必要である。「ドラッグが必要」は運動機能の話であり、認知発達段階の話ではない。この2軸を将来のWizard設計で混ぜないことを明記しておく。

---

## 9. Relationship with Input Support Guide

既存の`input-support-guide.html`はTouch/Switch/Gaze/デバイス対応を案内している。本Phaseでは同ファイルを変更しないが、将来Wizard Q1の文言を変更する場合（Option B実装時）、Guide側の「タッチについて」の説明と用語・トーンを揃える必要がある（例: Guideが「タッチは基本的な操作方法です」という前提で書かれているなら、Wizardの新しいQ1文言と自然に整合する）。この整合作業は本Phaseのスコープ外とし、次のWizard実装Phaseの中で確認することを推奨する。

---

## 10. Metadata implications

### 10.1 WizardからTouch質問を外しても、metadataとしてのtouchは残す価値がある

- app詳細ページでの入力対応バッジ表示（既に`inputBadgesHTML`で使用中）
- Input Support Guideの対応アプリ一覧
- 将来のfilter/ranking機能
- 外部へのデータ提供・支援者向け資料
- 今回の監査自体が示す通り、「touchで主要活動が完結できる」という事実そのものに価値がある（Wizardの質問として使うかどうかとは別の話）

**Wizard UI ≠ metadata schema** という前提を維持する。

### 10.2 touch metadataの定義は本Phaseでは変更しない

現在の定義「一般的なタッチスクリーンで主要activityが使える」を維持する。§30のkyou-no-kirokuの件（`editChild`/`deleteChild`がhover限定でtouch非到達）を踏まえても、この定義は**主要activity（記録作成・閲覧・保存）が対象であり、全機能の100%対応を求めるものではない**、という既存の運用方針をそのまま再確認する。

---

## 11. kyou-no-kiroku caveatの扱い（§30-31への回答）

「Touch対応」metadataが「主要activityが完結できる」ことを意味するのか、「全機能が完全対応」を意味するのかを整理する必要がある。**本Design Phaseでの結論: 現行の「主要activityが完結できる」という定義を維持する。** 理由:

1. これは今回のTouch再監査全体（36app）で一貫して使われてきた判定基準であり、途中で基準を変えるとこれまでの分類が無効になる。
2. 「全機能100%対応」を要求すると、実質的にどのappも基準を満たせなくなる可能性が高く（設定パネルや編集機能の隅々までtouch対応を保証しているappは稀）、metadataとして非現実的になる。
3. kyou-no-kiroku自体は、記録作成・閲覧・保存という**利用者が毎日行う主要activity**がtouchで完結しており、editChild/deleteChildは**低頻度の管理機能**である。この区別自体が「主要activity」定義の正しい適用例になっている。

ただし、**表示文言としての誤解リスク**（§31）は別問題として扱う。「Touch対応」という単なるラベルは「全操作がtouchで完全対応」と読める余地があるため、将来的に文言を「タッチで主な操作ができます」のように**主要活動に限定した表現**へ寄せることを推奨する（実装はしない、方向性の提案のみ）。kyou-no-kirokuのeditChild/deleteChild touch非到達は、Separate Finding（前Phaseで既に記録済み）として、将来のTouch/Keyboard Hardening Phaseの候補に留める。

---

## 12. 新しいobjective metadata候補（設計レベルのみ、実装しない）

将来Option C/Dを検討する場合の候補（§21-22の「客観的に判定可能」という原則に従う）:

```
touchGestures: ["tap", "drag", "longPress", "trace", "continuousMovement", "multiTouch"]
```

- 主観的な「easy/medium/hard」等の3段階評価は**採用しない**（監査可能性・再現性に欠けるため）。
- 各値は実コード上の存在（`dragstart`/`touchmove`ベースの連続追跡/`touchstart`からの一定時間経過等）から機械的・半機械的に判定可能な項目に限定する。
- 本Phaseではこの候補を**設計上の記録として残すのみ**とし、実装・監査は行わない。

---

## 13. Strict filter vs ranking

| データ種別 | 推奨方式 | 理由 |
|---|---|---|
| switch / gaze（既存） | **hard filter（現状維持）** | 対応が無いアプリは、その入力方式のユーザーにとって文字通り操作不能。安全側に倒し除外するのが正しい。 |
| touch（Option B適用後） | 質問自体を「追加入力の有無」へ変えるため、実質的にswitch/gaze同様のhard filterロジックを流用 | 同上 |
| 将来のtouchGestures（Option C/D） | **soft ranking / 補助的な並び替え boost**（hard filterにしない） | drag等の操作は「その操作が一切できない」わけではなく、多くの利用者にとって通常の範囲内。過度なhard filterは候補を消しすぎるリスクがある（§26）。 |

---

## 14. Backward compatibility

- `apps-data.json`の`input`配列構造自体は変更しない（値の追加のみ、TOUCH-CORRECTION-1で実施予定）。
- app detail pageのバッジ表示ロジック（`inputBadgesHTML`相当）は影響を受けない。
- Input Support Guideは本Phaseで変更しないため、既存ページはそのまま維持される（将来のterminology整合は別Phase）。
- 既存のdeep link・analyticsへの影響はない（Wizardの`answer()`関数のq1値の意味が変わるだけで、URL構造・app URLは変更しない）。

---

## 15. Migration plan（実装順序の提案）

| Phase | 内容 | 前提条件 |
|---|---|---|
| **Phase 1**（次に推奨） | `APP-INPUT-METADATA-TOUCH-CORRECTION-1`: SAFE_ADD 15件を`apps-data.json`へ反映するtruth correction。Wizardには触れない。 | 本Design Phaseの完了・User Review |
| **Phase 2** | `wizard.html` Q1の文言・ロジック再設計（Option B方向）。switch/gaze filterロジックは流用、touch選択肢を「追加の入力方法」フレームへ変更。 | Phase 1完了（36/36の事実に基づいた文言にするため） |
| **Phase 3** | Phase 1・Phase 2をまとめてUser Browser Review、固定Preview経由で実機確認。 | Phase 1・2完了 |
| **Phase 4**（将来・任意） | Option C/Dのgesture metadata設計・監査（実施するかどうかは別途判断）。 | Phase 1-3の運用実績を見てから判断 |

**Phase 1を先に単独実施することを推奨する（§16参照）。**

---

## 16. APP-INPUT-METADATA-TOUCH-CORRECTION-1を先に実施すべきか

**先に、単独で実施することを推奨する。**

理由:
1. metadataのtruth correctionは、Wizardの設計判断とは独立した価値を持つ（app詳細ページ・Input Support Guide等、Wizard以外の場所でも使われている）。
2. Wizardの新しいQ1文言（例:「多くのアプリはタッチで使えます」）は、metadataが実際に36/36へ修正された**後**でなければ正確な主張にならない。修正前（21/36=58%）の状態でこの文言を先に出すと、事実と異なる主張になってしまう。
3. これまでのGovernance運用（本セッション全体を通じて）でも、「truth correctionは独立した小さなPhaseとして先に確定させ、UIへの反映は別Phaseで行う」という順序が一貫して採られてきた。

---

## 17. Out of scope（本Phaseで扱わないこと）

- `apps-data.json`・`wizard.html`・app source・tests・`CLAUDE.md`・Input Support Guide・Preview repoへの実装
- Option C/Dのgesture metadataの実装・監査
- kyou-no-kirokuのeditChild/deleteChild touch到達性の修正
- 発達段階ベースのナビゲーション設計そのもの

---

## 18. Open questions（User Reviewで確認したい点）

1. Option B方向のWizard Q1文言を、次のWizard実装Phaseで具体的に何パターンか提示してよいか。
2. Option C/D（gesture metadata）を将来Phase候補として正式に登録してよいか、それとも現時点では完全に見送るか。
3. kyou-no-kirokuのhover-only edit/delete機能の修正を、いつ・どのPhaseで扱うか（Touch Hardening / Keyboard Hardeningのどちらと合流させるか）。

---

## 19. Acceptance criteria（この設計が「実装可能」と言えるための条件）

- 実装可能: Option Bは既存のswitch/gaze filterロジックをそのまま流用でき、新しいmetadataスキーマを必要としない。
- metadata監査可能: touch定義そのものは変更しないため、既存の監査基準がそのまま使える。
- Wizardが複雑化しすぎない: 質問数は3問のまま、Q1の文言のみ変更。
- 教員・保護者に説明しやすい: 「多くのアプリはタッチで使えます。追加で必要な入力方法はありますか？」という素直な言い回しが可能。
- 将来appが増えても維持可能: 新規app追加時にtouchはデフォルトで真であることが多いと想定され、監査負荷は現状と同程度かそれ以下。
