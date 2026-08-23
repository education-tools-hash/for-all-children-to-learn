# Donomana Help / Usage Guide Standard v1.0

策定: Phase M12-D''''（`dotchiga-ii-app.html`をReference Implementationとして策定）
関連文書: `donomana-design-system-v2_0.html`（§7.6.4 ヘルプ）、`donomana-new-app-development-standard-v1_0.md`

## 0. 背景と目的

Phase M12（「どっちがいい？」）のUser Reviewを通じて、以下の課題が明らかになった。

1. Helpが存在するだけでは不十分（初見の教員・保護者・支援者が実際に使い始められる内容量が必要）。
2. Settings内やページ下部にHelpの入口を隠すと、初見ユーザーが見つけられない。
3. アプリごとにHelpの位置・内容量・構造が異なると、どのまな全体の操作性が統一されない。

本Standardは、**どのまなの全アプリ**に対して、「つかいかた」の入口位置・内容量・必須説明項目・Accessibilityを共通仕様として定める。**形式（入口・見出し構造・基本UI・Accessibility）は共通化するが、文章そのものはアプリごとの教育目的・機能に合わせる**（全アプリへ同一文章をコピーしない）。

## 1. 適用範囲

- **新規アプリ**: 本Standardを設計段階からREQUIREDとして適用する（後付けにしない、New App Development Standard §Help/Usage Guide Complianceを参照）。
- **既存Productionアプリ**: 本Phaseでは一括変更を行わない。後続Phaseで段階的Rolloutを行う（本文書§13 Rollout方針、および`docs/design-system/donomana-help-inventory-v1.md`の分類を参照）。

## 2. 既存仕様との関係（OLD → NEW）

`donomana-design-system-v2_0.html` §7.6.4「ヘルプ」は、v2.0で新設（"新設"タグ）された共通UIコンポーネントの一つであり、「短文（1画面に収まる内容）はページ内アコーディオンで展開、長文・複数対象者の場合は別画面ルート」という表示方式の原則のみを定めていた。本Standardはこれを**否定・上書きするものではなく**、以下を新たに明確化・具体化する OLD → NEW の追補である。

| 項目 | OLD（§7.6.4のみ） | NEW（本Standard） |
|---|---|---|
| 入口の位置 | 規定なし | Common Chrome上部（画面ロック／全画面付近）にREQUIRED常時表示（§4） |
| 内容量の下限 | 規定なし | 「初見の教員・保護者・支援者がHelpだけで基本操作を理解できる」ことを完了基準とし、必須説明構造（§6）を定める |
| 見出し構造 | §7.2階層規約に準拠（既存のまま） | 変更なし。本Standardでも維持 |
| 表示方式の判断 | 短文/長文で二択 | 変更なし。「形式は共通、内容は個別」の原則を追加（§3） |
| 旧modal Help（`role="dialog"`等）の扱い | 規定なし | Legacy / Transitionalとして許容し、即時全置換はしない（§14） |

New App Development Standardには本Standardへの参照とRelease Gate必須項目を追加する（§15/§16）。

## 3. 原則：形式は共通、内容は個別

- 共通化するもの: Help入口の位置・アイコン・Accessible name・基本UIパターン・見出し階層・Accessibility契約。
- アプリごとに書くもの: 実際の説明文。アプリの教育目的・活動内容・固有機能に応じて記述する。全アプリへ同一文章をコピーしない。

## 4. Help Entry — REQUIRED（入口）

**「つかいかた」の入口はCommon Chromeへ常時表示する。** Settings内だけに隠すこと、ページ下部までスクロールしないと見つからない配置は禁止する。

## 5. Help Entry Position — REQUIRED

「つかいかた」は、画面ロック・全画面・その他Common Chromeと同じ上部の固定操作領域に配置する。**画面ロック／全画面アイコンの並びに含める**ことを必須条件とする（Reference Implementationでは`top:64px;right:12px`の固定クラスターへ第3ボタンとして追加した）。

### 5.1 Common Chrome Ordering

既存Common Chrome（`donomanaHomeBtn`＝左上／`donomanaLockBtn`・`donomanaFsBtn`＝右上／`donomanaA11yBtn`＝右下）を調査した結果、ロック・全画面は同一クラスター（右上、`top:64px;right:12px`、flex row, gap 8px）にまとまっている。本Standardは、この既存クラスターへ

```
Lock → Fullscreen → Help
```

の順で追加することを正式orderingとする。Settings自体はアプリ内ヘッダーの独自ボタン（`#settingsBtn`、a11yパネル経由でのみ到達）であり、Common Chromeクラスターの対象外のまま変更しない。

## 6. Help Button — REQUIRED

- native `<button>`
- icon: `❓`（または既存の正式Helpアイコンがあればそれに合わせる）
- **accessible name = 「つかいかた」**（`aria-label`）。「？」の文字だけをaccessible nameにしない。
- `title`属性は既存Common Chromeパターン（`aria-label`と同一文字列）に合わせる
- Keyboard focusable、visible focus（`:focus-visible`でoutline表示）
- Touch target: 既存Common Chrome標準（`min-width/min-height: 44px`、円形）

## 7. Responsive Placement — REQUIRED

最低 375×667 / 375×812 / 390×844 / 768×1024 / 1280×900 で、Lock・Fullscreen・Help・Home・a11yボタン等が衝突しないこと。画面へ収めるためにTouch targetを縮小しない（44px最低サイズを維持したまま、クラスター自体の横幅で調整する）。

Gaze対応アプリでは、target enlargement最大（150%）×spacing normal/wideの組み合わせでも、Help buttonの拡大hit areaがActivity Tabs等の教材targetと衝突しないことを実測で確認する（Reference Implementationでの実測方法は`dotchiga-ii-design-v1.md`§37/§40を参照）。

## 8. Help Content Quality — REQUIRED（完了基準）

**初めてそのアプリを開いた教員・保護者・支援者が、Helpだけを読んで基本的な使い方を理解できること**を完了基準とする。「Helpが存在する」だけではPASSにしない。固定文字数では判定しないが、「○○するアプリです。ボタンを押してください。」程度の数行だけでは不足とみなす。

## 9. Help Required Structure

以下の情報を含める（アプリの機能に応じて該当項目のみでよい）。

- **A. このアプリについて** — 何をする教材か、どのような経験を目的とするか、正解・不正解等の重要な方針
- **B. 活動・遊び方** — 基本flow、複数活動がある場合はその違い
- **C. 操作方法** — 実装されている入力方式のみ（Touch / Gaze / Switch Scan / Keyboard）。実装にない操作方法は書かない
- **D. 設定** — 利用に重要なSettingsのみ
- **E. 記録** — Record機能がある場合のみ
- **F. App-specific Feature** — アプリ固有機能

見出し階層は`h2`（Helpタイトル）→`h3`（上記A〜F相当の大項目）→`h4`（小項目）とし、見た目の都合だけでレベルを飛ばさない（§7.2階層規約準拠）。

## 10. Plain Language — REQUIRED

以下のような技術用語をUser向け説明文へ出さない：IndexedDB、Blob、DOM、ARIA、helper6、Gaze Shared Foundation、state machine、semantic activation 等。教員・保護者・支援者に自然な日本語で説明する。

## 11. 入力方式別の説明ガイド

- **Gaze**: 最低「視線入力をONにできる」「見つめて選べる」「見つめる時間等をSettingsで調整できる」を記載。8設定を仕様書のように列挙する必要はない。
- **Switch**: 最低「スキャンをONにする」「選べる場所が順番に移動する」「選びたいところで入力する」を説明。特定製品名を必須にしない。
- **Keyboard**: 実装と一致する操作のみ記載（例: Tab/Enter/Space）。存在しない操作を書かない。

## 12. Record機能の説明ガイド

Record機能を持つアプリのHelpには最低、「何を記録するか」「どこで確認できるか」「CSV等がある場合その使い方」を記載する。加えて、記録が能力・好み等を診断するものではない旨の誤解防止説明を含めることが望ましい（例:「記録はそのときの選択を振り返るためのもので、一度の選択だけから好みや能力を判断するものではありません。」）。

## 13. Privacy説明ガイド

画像・音声等を端末内保存するアプリは、必要なPrivacy説明をHelpへ含める（例:「画像はこの端末のブラウザ内だけに保存されます。」）。技術名称（IndexedDB等）は不要。不要に長いPrivacy文にはしない。

## 14. Help Display Pattern と Legacy Modal Policy

- Help入口はCommon Chromeで統一する。内容の表示方式（ページ内パネル／アコーディオン／別画面）は情報量に応じて選択してよい（§7.6.4の原則のまま）。ただし入口を再びSettingsへ戻すことは禁止する。
- 既存Productionの旧modal Help（`role="dialog" aria-modal="true"`等）は、**即不具合扱い・即全置換しない**。`Legacy / Transitional`として`docs/design-system/donomana-help-inventory-v1.md`に記録し、既存Design System改訂ログ#8の「既存実装は経過措置として容認、新規アクセシビリティ改善のみ許容」方針を踏襲する。新規アプリでは本Standardへ準拠する（旧modalパターンを新規採用しない）。

## 15. Accessibility — REQUIRED

- Keyboard open（Enter/Space）
- close/back（Escape、または明示的な閉じるボタン）
- visible focus
- accessible Help button（§6）
- screen reader見出し構造（§9）
- Gaze isolation（§16）
- Switch isolation（§17）
- 適切なfocus return（§18）
- `prefers-reduced-motion`尊重（開閉にanimationを使う場合、§19）

## 16. Gaze Isolation

Help表示中は、Activity Tabs・Choice・学習targetなど背面の教材targetをGaze activationさせない。既存のSettings非modal isolationパターン（`getGazeTargets()`が`settingsOpen`中は`[]`を返す等）と同一の仕組みをHelpにも適用し、新しい隔離システムを発明しない。

## 17. Switch Isolation

Help表示中は背面の教材targetをScan候補にしない。Help終了後は通常Scanへ復帰する。

## 18. Focus Return

Help終了後は、Helpを開いたbuttonへfocus returnする。

## 19. Reduced Motion

Help open/close animationを使う場合は`prefers-reduced-motion`を尊重する。

## 20. Reference Implementation

本Standardの最初のReference Implementationは`dotchiga-ii-app.html`（Phase M12-D''''）。実装詳細・検証結果は`docs/multi-input/dotchiga-ii-design-v1.md` §41を参照。

## 21. Rollout方針（概要）

既存Productionアプリへの一括変更は行わない。優先順位は概ね次の順（詳細は`donomana-help-inventory-v1.md`）。

1. Helpなし（Group D）
2. Help内容が著しく不足（Group C）
3. Help入口がSettings内等で見つけにくい（Group B）
4. Legacy modal（§14のTransitional対象）
5. 軽微差分（Group A、微調整のみ）

Multi-Input重要度・利用頻度も加味する。各batchは原則2〜4アプリとし、each batchでbefore inventory → Help content作成 → Common Chrome配置 → responsive/Keyboard/Gaze/Switch確認 → regression → content reviewを行う。generator (`generate.js`) への変更を伴うCommon Chrome共通化（Help buttonをinjector化する等）は、既存29+アプリへの一括影響が大きいため、本Phaseでは実施せずPoC候補として記録するにとどめる（§22）。

## 22. Shared Foundation分析（将来のCommon Chrome injector化に向けて）

- **SAFE TO SHARE候補**: Help buttonの基本CSS・アイコン・focus-visibleスタイル、Help panelのbase container CSS、Accessibility helper（isolation/focus-return関数）
- **SHARE WITH OPTIONS候補**: section container構造、Common Chromeへの挿入位置ロジック（アプリごとに既存クラスター構成が異なるため、挿入点の調整が必要な場合がある）
- **KEEP LOCAL候補**: アプリ固有の説明文章、アプリ固有機能の説明、記録・設定の個別項目名

`generate.js`のCommon Chrome injector（home-btn/lock-fs-btn/a11y-panel等と同様のパターン）へHelp buttonを将来組み込めるかは技術的に有望だが、既存Production全アプリへの一括影響が大きいため、本Phaseでは変更を行わず、後続Phaseでのrollout batch計画の一部として個別に判断する。

## 23. 改訂履歴

| # | 日付 | 内容 |
|---|---|---|
| 1 | Phase M12-D'''' | 初版策定。`dotchiga-ii-app.html`をReference Implementationとして正式化 |
