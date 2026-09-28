# 「3つの質問でピッタリのアプリを探す」入力方式カテゴリ 全件監査 v1.0

- Status: AUDIT COMPLETE（調査・設計のみ。コード変更なし）
- Phase: `APP-RECOMMENDER-INPUT-CATEGORY-AUDIT-1`
- 作成日: 2026-09-28
- Baseline: `origin/main` = `39928645eebf0e4fb52b2b9a2ded43faff652ee1`
- Branch: `audit/app-recommender-input-category-audit-1`
- 本文書は **調査＋設計のみ**。`wizard.html`・`apps-data.json`・`switch-gaze-guide.html`・各アプリへの変更は一切含まない。

---

## 0. Executive Summary

**`wizard.html`（「3つの質問でピッタリのアプリを探す」）は、`apps-data.json`を一切参照しない、完全に独立した手書きの静的テーブルである。** `fetch`も`apps-data`という文字列も`wizard.html`には一度も出現しない。36通りの質問の組み合わせ（`${q1}_${q2}_${q3}`）ごとに、あらかじめ人手で選んだアプリ4件を固定で表示するだけの構造であり、実行時にアプリの実際の対応状況を参照する仕組みが存在しない。

さらに重要な事実として、**`apps-data.json`には既に`input: []`という構造化フィールドが存在し**、`touch`/`switch`/`gaze`/`keyboard`/`gamepad`の値を正しく持っている（過去のPhase `INPUT-SUPPORT-GUIDE-DESIGN-1`の調査ではこのフィールドの存在が見落とされていた）。この`input`配列の値は、今回のコードレベル監査結果とほぼ完全に一致しており、`wizard.html`の手書きテーブルより明らかに信頼できる。つまり、**直す方法は既にデータとして存在しているのに、`wizard.html`がそれを使っていない**、というのが問題の本質である。

具体的な実害:
- **7アプリ**（`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`・`sawatte-hirogaru-app`）が`wizard.html`に一切存在せず、スイッチ・視線入力ユーザーがどう回答しても**絶対に**レコメンドされない。このうち3本（`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`等）は、どのまな自身のGaze Accessibility Standardの**一次参照実装**である。
- 一方、`wizard.html`は`sst-app`（スイッチ対応なし、`input:[]`）と`scratch-app`／けずりえ（スイッチ対応なし、`input`に`switch`なし）を`switch_*`（スイッチ・視線入力ユーザー向け）の結果として実際に推薦している。
- `switch-gaze-guide.html`（対応アプリを探す既存ページ）も同じく7アプリを欠落させており、加えて1件のリンク切れ（`app-details/music-app-detail.html`が存在しない）がある。

このPhaseは監査・設計のみであり、`wizard.html`・`apps-data.json`・`switch-gaze-guide.html`のいずれも変更していない。§13に修正候補をまとめたが、実施は別Phaseの承認を要する。

---

## 1. 調査対象・方法

§3で指示された対象すべてを調査した: `apps-data.json`、`generate.js`、`index.html`、`app-intro.html`、`wizard.html`（3つの質問実装）、`switch-gaze-guide.html`、`input-support-guide.html`、`docs/design-system/donomana-gaze-accessibility-standard-v1_0.md`、`docs/design-system/donomana-switch-scan-spec-v1_0.md`、公開中36アプリのHTML実装コード。

方針として、metadata（`a11y`/`badges`/`input`）を鵜呑みにせず、各アプリの実装コードを実際に読み、スイッチスキャンは「候補配列＋自動ハイライトループ（`setInterval`等）＋activation処理」が実在するかで判定し、視線入力は「dwellタイマー・大きなターゲット・Leave-and-Reenter Gate等、視線入力を想定した設計」が実在するかで判定した。「Space/Enterがたまたま反応する」「マウスでクリックできる」だけではSwitch対応／Gaze対応と判定していない。

---

## 2. 「3つの質問」実装の全容（§4）

1. **実装ファイル**: `wizard.html`（1038行、単一ファイル完結、外部データ取得なし）
2. **質問1〜3の内容**:
   - Q1（操作方法）: 👆タッチ・タップで操作する / 🔘スイッチ・視線入力を使う / ✨どちらでも・まだ決めていない
   - Q2（ねらい）: ✏️文字・数の読み書き / 🏪生活スキル・見通し / 🌟気持ちを伝える・友達と関わる / 🧠認知・因果関係・創作
   - Q3（使う場面）: 🏫授業・自立活動で使いたい / 🌅朝・帰りの会など日常的に / 🏠家庭学習・保護者が使う
3. **回答値**: `q1 ∈ {touch, switch, any}`、`q2 ∈ {literacy, life, communication, cognition}`、`q3 ∈ {lesson, daily, home}`（3×4×3=36通り）
4. **フィルタリングロジック**: `const key = \`${answers.q1}_${answers.q2}_${answers.q3}\`; const result = RESULTS[key] || RESULTS['any_literacy_lesson'];` — キー文字列で`RESULTS`オブジェクトを直接引くだけ。動的な絞り込み・スコアリング・条件分岐は一切ない。
5. **参照しているmetadata**: **なし。** `wizard.html`内に`fetch`・`apps-data`という文字列は0件。アプリ情報は`wizard.html`自身が持つ、27アプリ分の手書き`APPS`オブジェクト（アプリ名・URL・タグ・説明文をすべて手書きで複製したもの）。
6. **Switch/Gaze判定条件**: **判定ロジックは存在しない。** Q1の「スイッチ」選択肢は文言上「🔘 スイッチ・視線入力を使う」（外部スイッチ、Tobii視線入力など）であり、**スイッチとGazeを1つのボタンに統合**している。ユーザーは「スイッチだけ」「視線だけ」を区別して回答できない。回答後は単に`switch_*`という36キーのうち該当する3件（q2×q3分岐）を引くのみで、実際にそのアプリがスイッチ対応か視線対応かを判定する処理はない。
7. **現在の表示対象アプリ**: `wizard.html`のAPPSオブジェクトに存在する27アプリのみ（後述§5参照）。
8. **現在漏れている可能性があるアプリ**: `apps-data.json`に存在する36アプリ中、以下**9アプリ**が`wizard.html`に一切登場しない（`APPS`にも`RESULTS`のどのバケットにも存在しない。ファイル全体をgrepしてアプリ名・IDで0件ヒットを確認済み）:

   | 未登場アプリ | Switch実装 | Gaze実装 |
   |---|---|---|
   | `nazorin-print`（なぞりんプリント） | 対象外（印刷専用ツール、本人もスイッチ非対応と明記） | 対象外 |
   | `mogura-tataki`（もぐらたたき） | 弱い（自動スキャンなし、Tab+Enter/Spaceのみ） | ✅あり（Leave-and-Reenter Gate実装済み） |
   | `kurabeyou-app`（おおきい？ちいさい？くらべよう） | ✅あり | ✅あり（**Gaze標準の一次参照実装**） |
   | `katachi-awase-app`（かたちをあわせよう） | ✅あり | ✅あり（Dwell Progress Ringの模範例） |
   | `miru-hirogaru-app`（みるとひろがる） | ✅あり | ✅あり（Tobii実機検証済みPilot） |
   | `mitsukete-touch-app`（どこかな？みーつけた！） | ✅あり | ✅あり（Pilot） |
   | `junban-miyou-app`（じゅんばんにみよう） | ✅あり | ✅あり（Pilot） |
   | `dotchiga-ii`（どっちがいい？） | ✅あり | ✅あり |
   | `sawatte-hirogaru-app`（さわってひろがる） | ✅あり（1操作で反応、意図的にスキャンなし） | ✅あり（意図的に独自設計） |

   このうち7アプリ（`mogura-tataki`を除く）は、実装として極めて強固なスイッチ・視線対応を持ちながら、レコメンド機能からは完全に不可視である。

---

## 3. 公開アプリ全件棚卸し（§5）

`apps-data.json`記載の36アプリ全件。**Switch/Gaze/Touch/Keyboard列は、既存の構造化`input`配列（apps-data.jsonに既に存在）とコードレベル監査結果（Part B）を突き合わせた結果。** 「Evidence」は根拠の要約。「apps-data整合」列は、`input`配列と実装コードが一致しているかどうか。

凡例: ✅=実装確認済み　⚠️=弱い/部分的　❌=実装なし　（空欄）=metadata上も対象外

| App ID | App名 | Touch | Switch | Gaze | Keyboard | Evidence（要約） | apps-data整合 |
|---|---|:-:|:-:|:-:|:-:|---|:-:|
| hiragana-learn | ひらがな まなぼう！ | ✅ | ✅ | | | `buildScanItems`/`startSwitchScan`実装確認、Switch Scan Rollout Group D | 整合 |
| katakana-app | カタカナ まなぼう！ | ✅ | ✅ | | | 同上、Rollout Group A | 整合 |
| nazori-app | なぞり書き練習ツール | | ✅ | | | `switchScan`関連コード6件、Rollout Group B | 整合 |
| nazorin-print | なぞりんプリント | | | | | 本文に「スイッチスキャンや読み上げ機能はありません」と明記（印刷専用） | 整合 |
| janken-app | じゃんけん まなぼう！ | | ✅ | | ✅ | `buildScanItems`等8件、Rollout Group A | 整合 |
| shiritori2 | しりとりあそび | | ✅ | | | 同上9件、Rollout Group A | 整合 |
| okane-app | おかねのおべんきょう | ✅ | ✅ | ✅ | | `gazeAwaitingLeave`実装確認、Pilot（Switch）/Group D（Gaze、要再確認とされていたが本監査でLeave-and-Reenter Gate実装を確認） | 整合 |
| register-app | はんばいかい レジ | | ✅ | | | `SWITCH_SCAN_SELECTOR`/`buildScanItems`/`startSwitchScan`を直接確認、Pilot | 整合 |
| tokei-app | とけい | ✅ | ⚠️ | | | **未使用の`scanActive`変数のみ、自動走査ループなし**（既存spec §19.22.12でも既知） | **不整合（過大申告）** |
| schedule-app | スケジュール | | ✅ | | | 実装確認、Pilot | 整合 |
| timetable-app | じこくひょう | ✅ | ✅ | | | **`scanInterval`/`buildScanItems`/`startSwitchScan`等、完全な実装があるがmetadataに記載なし** | **不整合（過小申告）** |
| yomikaki-app | よみかき サポートエディタ | | ✅ | | | **`scanTimer`/`buildScanItems`/`startSwitchScan`等、完全な実装があるがmetadataに記載なし（`input:[]`）** | **不整合（過小申告）** |
| bosai-app | ぼうさいたんけんたい | | ✅ | | | 実装確認6件、Rollout Group B | 整合 |
| matching-app | マッチング | | ✅ | | | Pilot実装 | 整合 |
| sugoroku-app | すごろく | ✅ | ✅ | | | 実装確認、Rollout Group B | 整合 |
| tyushi（ひかるボタン） | ひかるボタン（注視訓練） | | ✅ | ✅ | | Space/Enter/ゲームパッド直接activation実装確認。「スキャンモード」表記はビジュアル用パルスタイマーで候補配列を持たない別機能（既存spec既知） | 部分整合（switchは実質的にactivationのみ、"scan"表記はミスリード） |
| cup_game | どこかな？カップゲーム | ✅ | ✅ | ✅ | | 実装確認、Switch Rollout Group A・Gaze Group A | 整合 |
| sst-app | SST ソーシャルスキルトレーニング | ✅ | ❌ | | | scan関連コード0件、`input:[]`。汎用a11yパネル・Escapeキー処理のみ | 整合（対応なしで一致） |
| kimochi-board | コミュニケーションボード | ✅ | ✅ | ✅ | | `state.switchScan`実装確認、`gazeAwaitingLeave`実装確認、既存specの唯一のswitch×gaze統合実例 | 整合 |
| drawing-app | おえかきひろば | ✅ | ❌ | ✅ | | gaze実装確認（3モード）、switch claimなし・実装なしで一致 | 整合 |
| slideshow-sakusei | スライドショー作成 | | | | | a11yはハイコントラスト等のみ、switch/gaze claim・実装なし | 整合 |
| directions-app | ほうこうとばしょをまなぼう | ✅ | ✅ | | | Pilot（1st）実装確認 | 整合 |
| time-timer | タイムタイマー | | ✅ | | | 実装確認、Rollout Group B | 整合 |
| suji-manabou | すうじ まなぼう！ | ✅ | ✅ | | | 実装確認、Rollout Group D | 整合 |
| kyou-no-kiroku | きょうのきろく | | ✅ | ✅ | | `gazeAwaitingLeave`実装確認、Switch Rollout Group A・Gaze Group A | 整合 |
| scratch-app（けずりえ） | けずりえ | ✅ | ❌ | ✅ | | switch claim・実装なしで一致。gaze実装は連続マウス移動型（Leave-and-Reenter Gateなし、既存specでGroup Bと分類） | 整合 |
| gaze-keyboard | 視線キーボード | ✅ | ✅ | ✅ | | 実装確認多数、Switch Rollout Group C・Gaze Group A | 整合 |
| mogura-tataki | もぐらたたき | | ⚠️ | ✅ | ✅ | **自動走査ループなし、Tab+Enter/Spaceのみ（既存specで既知の過大申告）**。gazeは`gazeAwaitingLeave`実装確認 | **不整合（switch過大申告）** |
| ongaku-app | おんがくあそび | ✅ | ✅ | | | 実装確認14件、Rollout Group B | 整合 |
| kurabeyou-app | おおきい？ちいさい？くらべよう | ✅ | ✅ | ✅ | ✅ | `gazeAwaitingLeave`/`resetDwellState`実装確認。**Gaze標準の一次参照実装**。Rollout 21アプリ外（別トラック） | 整合（ただし**wizard.html/switch-gaze-guide.html双方に不在**） |
| katachi-awase-app | かたちをあわせよう | ✅ | ✅ | ✅ | ✅ | 同上。Dwell Progress Ringの模範例 | 整合（同上、**両ページに不在**） |
| miru-hirogaru-app | みるとひろがる | ✅ | ✅ | ✅ | ✅ | Tobii実機検証済みPilot #1 | 整合（同上、**両ページに不在**） |
| mitsukete-touch-app | どこかな？みーつけた！ | ✅ | ✅ | ✅ | ✅ | Pilot #2 | 整合（同上、**両ページに不在**） |
| junban-miyou-app | じゅんばんにみよう | ✅ | ✅ | ✅ | ✅ | Pilot #3 | 整合（同上、**両ページに不在**） |
| dotchiga-ii | どっちがいい？ | ✅ | ✅ | ✅ | ✅ | 実装確認（走査・dwell hit数最多） | 整合（同上、**両ページに不在**） |
| sawatte-hirogaru-app | さわってひろがる | ✅ | ✅ | ✅ | ✅ | 意図的な1操作直接反応設計（コード内コメントで明記）、Leave-and-Reenter非適用も設計として妥当 | 整合（同上、**両ページに不在**） |

---

## 4. Switch対応監査（§6）

現時点で**実装コードにより正式にSwitch対応が確認できるアプリ**（21アプリ、Switch Scan仕様書v1.8のRollout対象と一致）:

`directions-app`・`matching-app`・`schedule-app`・`okane-app`（Pilot 4）、`katakana-app`・`janken-app`・`shiritori2`・`register-app`・`timetable-app`・`cup_game`・`kyou-no-kiroku`（Group A 7）、`yomikaki-app`・`bosai-app`・`ongaku-app`・`time-timer`・`sugoroku-app`・`nazori-app`（Group B 6）、`kimochi-board`・`gaze-keyboard`（Group C 2）、`hiragana-learn`・`suji-manabou`（Group D 2）

**上記21件に加え、別トラック（Multi-Input Pilot）で正式なSwitch対応が確認できる7アプリ**: `kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`・`sawatte-hirogaru-app`

**Switch対応と誤認すべきでない、または要再検討のアプリ**:
- `tokei-app`: 未使用変数のみ、自動走査ループなし → **実質Switch非対応**
- `mogura-tataki`: 自動走査なし、Tab+Enter/Spaceのみ → **狭義のSwitch Scan非対応**（キーボード等価操作としては可）
- `tyushi`: Space/Enter/ゲームパッドでの直接activationは実在するが、「スキャンモード」表記の実体は候補配列を持たないビジュアルタイマー → **switchとしての単純activationは可、"scan"表記は不正確**

## 5. Gaze対応監査（§7）

現時点で**実装コードにより正式にGaze対応が確認できるアプリ**（15アプリ）:

`okane-app`・`tyushi`・`kimochi-board`・`cup_game`・`kyou-no-kiroku`・`drawing-app`・`scratch-app`・`gaze-keyboard`・`mogura-tataki`・`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`・`sawatte-hirogaru-app`（16件、重複なし確認要）

うち、`donomana-gaze-accessibility-standard-v1_0.md`が定めるLeave-and-Reenter Gate（`gazeAwaitingLeaveId`/`resetDwellState()`パターン）に準拠しているもの: `okane-app`・`kimochi-board`・`kyou-no-kiroku`・`mogura-tataki`・`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`。

非標準だが正当な設計として仕様書自身が把握しているもの: `tyushi`（単一ターゲットのため複数ターゲット前提のLeave-and-Reenterが構造的に不適用）、`drawing-app`（3モードの複雑な入力モデル）、`scratch-app`（連続マウス移動型）、`sawatte-hirogaru-app`（画面全体が1ターゲットの独自設計、コード内コメントで意図的な逸脱と明記）。

**単なる「マウスでクリックできる」を視線対応と水増ししていないことを確認済み**（上記16件はすべてdwell・Leave-and-Reenter・専用UI設計等の実装的裏付けがある）。

## 6. Touch / Keyboard確認（§8）

`apps-data.json`の`input`配列（既存の構造化フィールド、今回発見・再確認）を確認したところ:
- `input`が完全に空（`[]`）のアプリ: `nazorin-print`（印刷専用、妥当）、`yomikaki-app`（**switch実装ありなのに空、metadata欠落**）、`sst-app`（switch/gaze実装なしで空、妥当）、`slideshow-sakusei`（妥当）
- `keyboard`が明示されているアプリ: `janken-app`・`gaze-keyboard`・`mogura-tataki`・`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`・`sawatte-hirogaru-app`の10アプリのみ。それ以外の多くのアプリも実際にはEnter/Space等のキーボード操作を実装しているとみられるが、`input`配列上は明示されておらず、**旧世代アプリ（Switch Scan Rollout以前）ほど`keyboard`値が付与されていない傾向**が見られる。これは新規スキーマ追加ではなく既存フィールドへの追記漏れの可能性が高い。
- `touch`が明示的に外れているが実際にはタッチ操作可能なはずのアプリ（例: `nazori-app`・`register-app`・`schedule-app`・`bosai-app`・`matching-app`・`time-timer`・`kyou-no-kiroku`等、`input`にswitchのみでtouchなし）がある。iPadアプリとして`touch`が「当然」すぎて記載省略された可能性があるが、`input`配列の一貫性という観点では古い分類が残っている可能性がある。

---

## 7. apps-data.jsonの問題点（修正候補一覧・このPhaseでは修正しない）（§9）

| # | App ID | 問題種別 | 内容 |
|---|---|---|---|
| 1 | `tokei-app` | inputが実態より過大 | `input`に`switch`があるが実装は未使用変数のみ |
| 2 | `mogura-tataki` | inputが実態より過大（switch） | `input`に`switch`があるが自動走査なし、Tab+Enter/Spaceのみ |
| 3 | `timetable-app` | inputが実態より過小 | 完全なSwitch Scan実装があるが`input`に`switch`がない（`['touch']`のみ） |
| 4 | `yomikaki-app` | inputが完全に空、実態は対応あり | 完全なSwitch Scan実装があるが`input:[]` |
| 5 | `tyushi` | a11y文言が実態とややズレ | 「スキャンモード」表記の実体は候補配列を持たないタイマー。switch自体はactivationとして実在 |
| 6 | 多数の旧世代アプリ | keyboard値の記載漏れ疑い | Enter/Space等の実装があるとみられるが`input`に`keyboard`が付与されていないアプリが多い（要個別確認） |
| 7 | 多数のiPadアプリ | touch値の記載漏れ疑い | 明らかにタッチ操作可能なはずのアプリで`input`に`touch`がないケースが複数 |

上記はいずれも**修正候補として報告するのみ**であり、本Phaseでは`apps-data.json`を一切変更していない。

---

## 8. switch-gaze-guide.htmlとの整合（§10）

- 現行の「視線入力で使えるアプリ」セクション（5件）: コミュニケーションボード・視線キーボード・おえかきひろば・どこかな？カップゲーム・きょうのきろく
- 現行の「スイッチで使えるアプリ」セクション（7件、3グループ）: ひかるボタン・おんがくあそび・マッチング・じゃんけん まなぼう！・すごろく・ひらがな まなぼう！・スケジュール
- ページ末尾の注記で、上記以外にも「なぞり書き・レジ・防災学習・方向と場所・すうじ・タイムタイマー」がスイッチ対応であると正しく補足されている。**同様の補足が視線入力セクションには存在しない。**
- **リンク切れを1件発見**: 「おんがくあそび」のリンク先`app-details/music-app-detail.html`が実際には存在しない（正しくは`app-details/ongaku-app-detail.html`）。ディスク上で存在しないことを確認済み。
- **重大な欠落**: `tyushi`（ひかるボタン）は視線・注視訓練が主目的のアプリだが、視線入力セクションには掲載されず、スイッチセクションのみに掲載されている。
- **重大な欠落**: §2・§3で述べた7アプリ（`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`・`sawatte-hirogaru-app`）が、視線入力・スイッチいずれのセクションにも一切掲載されていない。うち3本はどのまな自身のTobii実機検証済みPilotアプリである。
- `mogura-tataki`（gaze実装は正式、switchは弱い）も両セクションに不在。

---

## 9. wizard.html固有の問題（RESULTS vs 実態、§4の補足）

- `switch_communication_*`（3バケット）は`sst-app`を含むが、`sst-app`はSwitch実装なし（`input:[]`）。スイッチ・視線入力ユーザーが回答してもSwitch非対応アプリが提示される。
- `switch_cognition_*`（3バケット）は`kezuri`（scratch-app）を含むが、scratch-appはSwitch実装なし（`input`に`switch`なし）。加えてこのアプリの中核操作（なぞって削る連続操作）はそもそも単一スイッチでは実行不可能な操作モデルであり、他の3アプリ（`hikaru`・`cupGame`・`drawing`）と同じ「認知支援」カテゴリという理由だけで便乗的に含まれた可能性が高い。
- `hikaru`（tyushi）は同じ`switch_cognition_*`バケットに含まれ、switch activationとしては妥当だが、本来はGaze特化アプリであるにもかかわらず、wizard.html・switch-gaze-guide.htmlのいずれにおいてもGazeカテゴリとして扱われていない。
- 7アプリ（§2表）はwizard.html内に一切登場しないため、`switch_*`のどのバケットを選んでも表示されることがない。

---

## 10. docs/design-system仕様書との整合性（§追加確認）

- `donomana-switch-scan-spec-v1_0.md`（v1.8、**承認済み・2026-08-12**）は21アプリのRollout完了を宣言しており、§19.22.12で`tokei-app`・`mogura-tataki`・`tyushi`の過大申告、`timetable-app`・`yomikaki-app`・`gaze-keyboard`の過小申告を**文書自身が既に把握・記録済み**（「本v1.8でも`apps-data.json`は変更しない」と明記）。今回のコード監査はこの既存記述と完全に一致する結果となった。
- `donomana-gaze-accessibility-standard-v1_0.md`（v1.0改訂5、**確定・2026-08-19**）はGroup A〜Dの独自コンプライアンスマトリクスを持ち、`okane-app`をGroup D（要再確認）としているが、本監査で直接コードを読んだ結果、Leave-and-Reenter Gate（`gazeAwaitingLeave`）の実装を確認できた。文書側の「要再確認」は監査の深さの問題であり、機能自体が欠落しているわけではないとみられる。
- **両仕様書とも、`wizard.html`・`switch-gaze-guide.html`という「利用者に見える窓口」がこれらの既知の相違点・新規アプリ群を反映していないという、今回の監査で明らかになった問題には触れていない。** 既存仕様書は「実装とmetadataの整合」を扱っているが、「レコメンド導線とmetadataの整合」は範囲外だった。

---

## 11. Remediation Candidates（修正候補・本Phaseでは未実施）

優先度の高い順に整理する。実施は別Phase・ユーザー承認が必要。

1. **【最優先】wizard.htmlの7アプリ欠落解消**: `kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii`・`sawatte-hirogaru-app`を`APPS`および適切な`RESULTS`バケットに追加する。
2. **【高】wizard.htmlの誤った推薦の是正**: `switch_communication_*`から`sst`を除外（または別の代替アプリに差し替え）、`switch_cognition_*`から`kezuri`を除外（または`hikaru`のGaze版バケットの新設を検討）。
3. **【中〜長期・設計要検討】wizard.htmlをapps-data.jsonの`input`配列から動的に生成する方式への移行**: 現在の36キー手書きテーブルは今後も同じドリフトを繰り返す構造的リスクを抱えている。`input`配列を正とした動的フィルタリングへの置き換え、または最低限「`input`配列とRESULTSの整合を検証する自動テスト」の追加を検討。
4. **【中】switch-gaze-guide.htmlの7アプリ追加＋tyushiの視線入力セクションへの追加**、および視線入力セクションにもスイッチセクション同様の「その他対応アプリ」補足文を追加。
5. **【中】switch-gaze-guide.htmlのリンク切れ修正**: `app-details/music-app-detail.html` → `app-details/ongaku-app-detail.html`。
6. **【低〜中】apps-data.jsonの`input`配列の是正**（§7の7項目）: `tokei-app`/`mogura-tataki`からの`switch`過大申告の是正、`timetable-app`/`yomikaki-app`への`switch`追加、旧世代アプリへの`keyboard`/`touch`値の棚卸し的な追記。
7. **【低】`tyushi`の「スキャンモード」表記の是正**: UI文言・a11y記述を、候補配列を持たない機能であることが分かる表現に見直す（既存Switch Scan仕様書が既に把握している論点）。

---

## 12. Governance確認事項

- このPhaseは調査・設計のみで、`wizard.html`・`apps-data.json`・`switch-gaze-guide.html`・各アプリコードへの変更は一切行っていない。
- 調査には実装コードの直接確認（grep・Read）を用い、metadataの記述のみで判定した箇所はない。
- 既存の承認済み仕様書（Switch Scan spec v1.8、Gaze Accessibility Standard v1.0改訂5）の記述内容を再定義・変更していない。

---

*本文書はPhase `APP-RECOMMENDER-INPUT-CATEGORY-AUDIT-1`の成果物として作成された監査文書であり、実装や修正を承認するものではない。*
