# Donomana Help / Usage Guide — Production App Inventory v1

策定: Phase M12-D''''。`docs/design-system/donomana-help-usage-guide-standard-v1_0.md`のRollout計画（§21）の根拠資料。
改訂: Phase M12-F（2026-08-23、Production Release）。「どっちがいい？」（dotchiga-ii-app.html）のProduction公開に伴い、Group A・Standard Reference Implementationとして表・集計へ追加（全34→全35アプリ）。策定時点（M12-D''''）の調査対象34アプリの記録はそのまま維持し、削除していない。既存34アプリのコードは本改訂でも変更していない。

改訂2: Phase T5-E-A''（2026-08-30、RC）。`hiragana-learn.html`・`katakana-app.html`をGroup D（Helpなし）からGroup A（Help present, top-chrome entry, decent content）へロールアウトした。Common Chrome固定位置（Lock隣、donomanaHelpBtn）を入口とし、内容はこのアプリについて／学習のすすめ方／なぞり（3段階判定の説明含む）／操作方法（タッチ・スイッチ・キーボード）／設定／記録の6見出し（h2→h3→h4）で構成。実装詳細は`donomana-tracing-judgment-levels-v1.md`のAddendum 3を参照。User Browser Reviewの承認待ち（本Phaseの時点ではまだRC、Production未反映）。

改訂3: Phase T6.5-B1/B2（Local checkpoint、Production未反映・User Review未実施）。Group 1（`kurabeyou-app.html`・`katachi-awase-app.html`）をGroup D（Helpなし）からGroup A相当へロールアウトした。Common Chrome固定位置（Lock→Fullscreen→Helpの順、donomanaHelpBtn）を入口とし、内容はこのアプリについて／活動の違い（レベル別）／操作方法（タッチ・視線入力・スイッチ・キーボード）／設定／記録の5見出し（h2→h3→h4）で構成。Help表示は既存`openSettings()`/`closeSettings()`と同型の非modal in-page panel（`kurabeyou-app.html`は`.settings-panel`クラス、`katachi-awase-app.html`はID指定という既存アプリごとのCSS方針差をそのまま踏襲）。Gaze/Switch隔離・Escape・focus returnは既存Settings非modalパターンをそのまま流用し、新規隔離システムは発明していない。実装詳細は本Phase群のFinal Reportを参照（設計文書としての追補は本改訂のみ）。両アプリともfeature branch `feature/app-usage-guide-t65b`上のlocal checkpointであり、mainへのmerge/push/deployは未実施。次はGroup 2（`mitsukete-touch-app.html`・`junban-miyou-app.html`）を予定。

改訂4: Phase T6.5-B3（Local checkpoint、Production未反映・User Review未実施）。Group 2（`mitsukete-touch-app.html`・`junban-miyou-app.html`）をGroup D（Helpなし）からGroup A相当へロールアウトした。実装は同世代アプリでも構造は一様でないことを実測で確認したうえで各アプリの既存慣習にそのまま合わせた：設定ボタンのDOM ID自体が異なる（`mitsukete-touch-app.html`は`settingsBtn`、`junban-miyou-app.html`は`setBtn`）、Switch Scan対象収集の`commonChromeCandidates()`がアプリごとに異なる固定配列（`mitsukete-touch-app.html`はHome/Lock/Fs/A11yの4件、`junban-miyou-app.html`はA11yのみの1件）で、既存の非対称そのものは変更せずHelp button自体のみを既存配列へ追加した。Gaze/Switchの同時ON可否も実測——Group 1（kurabeyou/katachi-awase）は相互排他だが、Group 2の2アプリは仕様上・apps-data.json記載上ともに視線入力とスイッチスキャンの同時ONが許容されており、Help本文もそれに合わせて書き分けた（排他の誤記載はしていない）。`mitsukete-touch-app.html`ではapps-data.jsonに明記のない実装詳細（雲が1つのときのSwitch Direct Activation挙動）も実コード確認のうえHelp本文へ反映。両アプリともfeature branch `feature/app-usage-guide-t65b`上のlocal checkpointであり、mainへのmerge/push/deployは未実施。Group 1（`kurabeyou-app.html`・`katachi-awase-app.html`）は本Phaseで変更していない。次はGroup 3（`cup_game.html`・`miru-hirogaru-app.html`）を予定。

全35 Productionアプリ（`apps-data.json`記載）を対象に、既存の「使い方」実装状況を調査した。**既存Productionアプリのコードは一切変更していない**（調査のみ）。

## 分類基準

- **Group A**: Help present, top-chrome entry, decent content — ほぼ準拠
- **Group B**: Help present but entry位置が旧式（top chromeでない/持続的でない）
- **Group C**: Help present but内容が明らかに不足
- **Group D**: Helpなし
- 複合（例 B+C）もあり得る

## Inventory

| App | Help有無 | Entry位置 | Pattern | 内容量(該当カテゴリ) | Input説明 | Settings説明 | Record説明 | Accessibility | Standard status | Recommended action |
|---|---|---|---|---|---|---|---|---|---|---|
| hiragana-learn.html | Yes | top chrome（Lock隣、donomanaHelpBtn、Standard §5.1正式ordering準拠） | 既存tab切替（`.section#help`、非表示tab-btn方式、settingsタブと同型） | このアプリについて／学習のすすめ方／なぞり（3段階判定）／操作方法／設定／記録の6セクション、h2→h3→h4階層 | Yes（タッチ・スイッチ・キーボード） | Yes | Yes | native button, OK | Group A（T5-E-A''でRollout、RC・User Review待ち） | ほぼ準拠 |
| katakana-app.html | Yes | top chrome（Lock隣、donomanaHelpBtn、Standard §5.1正式ordering準拠） | 既存tab切替（`.section#help`、非表示tab-btn方式、settingsタブと同型） | このアプリについて／学習のすすめ方／なぞり（3段階判定）／操作方法／設定／記録の6セクション、h2→h3→h4階層 | Yes（タッチ・スイッチ・キーボード） | Yes | Yes | native button, OK | Group A（T5-E-A''でRollout、RC・User Review待ち） | ほぼ準拠 |
| nazori-app.html | Yes | header, top chrome（⚙️隣） | 素の`#helpModal`（`role=dialog`なし） | purpose, teacher-mode, print-worksheet, practice-mode。入力方式説明なし | No | Partial | Yes（簡潔） | native button, OK | Group A | 軽微改善: 入力方式説明追加、ARIA dialog role付与 |
| nazorin-print.html | Yes | header tool row, top chrome | `#helpModal`, `role="dialog" aria-modal="true"` | purpose, 3-step flow, 5種印刷タイプ, 機能, 推奨設定, 印刷tips — 充実 | n/a（印刷ツール） | Yes | n/a（フォルダ説明あり） | native button, OK | Group A | ほぼ準拠 |
| janken-app.html | Yes | home-menuボタン下部（top iconではない） | `.howto-overlay#howto-overlay`, `role="dialog" aria-modal="true"`, tab切替（教員/子ども） | purpose, flow, accessibility(switch/keyboard/tts/contrast/size), 注意事項 | Partial（switch, keyboard；gaze/touch明示なし） | Yes | Partial（簡潔） | native button, OK | Group B | entry位置をtop chromeへ移動 |
| shiritori2.html | No | none | none | — | No | No | No | n/a | Group D | Help新規作成 |
| okane-app.html | Yes | header-tools, top chrome | `#helpModalOverlay`, `role="dialog" aria-modal="true"` | purpose, 4-step flow, accessibility設定全般, record+CSV, gaze機器注記 | Yes（switch, gaze, touch） | Yes | Yes | native button, OK | Group A | ほぼ準拠 |
| register-app.html | Yes | header nav, top chrome | `#help-modal`, `role="dialog" aria-modal="true"`, tab切替 | basic use, editing, accessibility tab（font/contrast/switch/large-buttons/reduce-motion/tts） | Partial（switch；gazeなし） | Yes | n/a | native button, OK | Group A | 軽微改善のみ |
| tokei-app.html | No | none | none | — | No | No | No | n/a | Group D | Help新規作成 |
| schedule-app.html | Yes | 上部タブバー（❓つかいかたタブ） | 素のsection `#content-howto`（常時表示） | 作成/閲覧/共有、自動ハイライト、TTS、印刷 — 充実 | No | Partial | n/a | native button tab, OK | Group A | 軽微改善: switch/gaze対応があれば追記 |
| timetable-app.html | Yes | 上部タブバー（4番目のタブ） | 素のsection `#sec-help` | purpose + 3活動の説明のみ。操作方法・設定の説明なし | No | No | n/a | native button tab, OK | Group C | 内容拡充: 操作方法・設定説明が欠落 |
| yomikaki-app.html | Yes | 上部タブバー、デフォルト/最初のタブ | 素のsection `#pg-guide` | purpose, 4 steps, 機能grid(8項目), switch-scanを2回説明 | Yes（switch） | Yes | n/a | native button tab, OK | Group A | 軽微改善のみ |
| bosai-app.html | No | none | none | — | No | No | No | n/a | **Group D（高優先度）** | Help新規作成 — チェックリスト・シミュレーション等複雑機能を持つため優先度高 |
| matching-app.html | Yes | セットアップ画面本文内バナー（**アプリ自体にheader/top chromeが存在しない**） | `#how-ov`, `role="dialog" aria-modal="true"` | プレイ流れ、難易度、カスタムセット作成、表示/ゲームモード — 仕組みは充実だがaccessibility説明なし | No | No | Partial（時間/回数のみ） | native button, OK | Group B+C | top chrome entry追加 + accessibility/input方式セクション追加 |
| sugoroku-app.html | Yes | プレイ中top chrome（tb-btns）+ セットアップ画面ボタン | `#helpmod` 素のoverlay（`role=dialog`なし） | マス目・イベントの凡例のみ。目的・操作方法・設定の説明なし | No | No | n/a | native button, OK | Group C | 内容拡充必須 — 現状はマス目用語集のみで「使い方」になっていない |
| tyushi.html | Yes | 左下**固定**ボタン（top chromeではない） | `#help-overlay`, `role="dialog" aria-modal="true"`, tab切替（staff/child/home） | purpose, 入力機器(gaze/switch/touch/gamepad), scan mode, 設定grid, tips — 調査対象中最も充実 | Yes（優秀） | Yes | n/a | native button, OK | Group B | entry位置をtop chromeへ移動（内容自体は模範的） |
| cup_game.html | No | none | none | — | No | No | No | n/a | Group D | Help新規作成 |
| sst-app.html | Yes | header hdr-right, top chrome（⛶/🔓隣） | `#help-modal` 独自overlay（`role=dialog`なし） | purpose, 3レベル, 機能8項目, バッジ/記録（簡潔） | No | No | Partial | native button, OK | Group A | 操作方法・設定セクション追加、ARIA dialog role付与 |
| kimochi-board.html | Yes | top-bar, top chrome（⚙️隣） | `#helpOverlay`/`.help-panel`（`role=dialog`なし） | switch-scan, touch/switch/keyboard選択, gaze/pointer(Tobii) — 入力方式カバレッジ優秀 | Yes（優秀 — touch/switch/keyboard/gaze） | Partial | n/a | native button, OK | Group A | 軽微改善: ARIA dialog role付与 |
| drawing-app.html | Yes | topbar, top chrome（固定、⛶あり） | `#help-modal`（`role=dialog`なし） | ツール, 色, アクションボタン, touch/pen, gaze入力(dwell), keyboardショートカット — 非常に充実 | Yes（優秀） | Partial（gaze速度） | n/a | native button, OK | Group A | ARIA dialog role付与、それ以外は模範的 |
| slideshow-sakusei.html | Yes | topbar, top chrome | `#helpModal` 独自（`role=dialog`なし） | 5-step flow, 動画長ガイド表, tips。別のa11y modalを案内 | n/a（作成ツール） | Partial | n/a | native button, OK | Group A | 軽微改善のみ |
| directions-app.html | Yes | ホーム画面grid button；**サブ画面からは戻らないと到達不可** | フルページ`.screen#screen-howto`（dialogなし） | 学習/ゲーム/場所/設定の4ステップ；switch-scan言及；teacher-mode/CSV記録の説明なし | Partial（switch言及） | Partial | No | native button, OK | Group B | entry位置を常時到達可能なtop chromeへ移動、record/teacher-mode説明追加 |
| time-timer.html | Yes | 左下**固定**ボタン（top chromeではない） | `#helpModal`, `role="dialog" aria-modal="true"` | 手順, 子ども用/PINロック済み大人用設定の違い, keyboardショートカット — 充実 | Partial（keyboard；switch/gaze詳細なし） | Yes | n/a | native button, OK | Group B | entry位置をtop chromeへ移動 |
| suji-manabou.html | No | none | none | — | No | No | No | n/a | Group D | Help新規作成 |
| kyou-no-kiroku.html | Yes | header-btns, top chrome（⚙️隣） | `#modalHelp`（`role=dialog`なし） | purpose, record/CSV明示, 児童ごとの記録ワークフロー — アプリの中核機能を説明 | No（a11yパネルは別途存在するがHelp内で未説明） | No | Yes | native button, OK | Group A | accessibility設定・入力方式の説明追加、ARIA dialog role付与 |
| scratch-app.html | Yes | header hright, top chrome（🔓/⚙️/⛶隣） | `.spov#helpOv`, `role="dialog" aria-modal="true"` | touch/penの技法, ブラシサイズ, 背景変更 — カバレッジ良好 | Partial（touch/pen；gaze/switchはa11y-panel経由と思われ、Help内未説明） | No | n/a | native button, OK | Group A | 軽微改善のみ |
| gaze-keyboard.html | Yes | header-right, top chrome（📊/⛶/⚙️隣） | `#helpModal`（`role=dialog`なし）、4タブ（basic/gaze/features/word） | 視線入力専用タブ、機能タブ — 構成良好 | Yes（専用gazeタブ） | Likely（featuresタブ） | No（📊ボタンが別途あるのにHelp内に履歴タブなし） | native button, OK | Group A | 履歴・レポート機能の説明タブ追加 |
| mogura-tataki.html | Yes | header hdr-right **かつ** home-hero-btns（top chrome入口2箇所） | `.panel#panHow`, `role="dialog" aria-modal="true"` | 目的, 難易度, target選択, タップ操作, gaze入力(機器バッジ), 全画面, 記録（明示）, 特殊モグラ種別、10ステップ | Yes（touch + gaze、機器別） | Yes | Yes（明示） | native button, OK | Group A | ほぼ準拠 — 調査対象中最良の実装例 |
| ongaku-app.html | No | none | none | — | No | No | No | n/a | Group D | Help新規作成 |
| kurabeyou-app.html | Yes | top chrome（Lock→Fullscreen→Help、donomanaHelpBtn、Standard §5.1正式ordering準拠） | 既存`.settings-panel`パターン再利用のin-page panel（openSettings/closeSettingsと同型のopenHelp/closeHelp） | このアプリについて／活動の違い（レベル1-4）／操作方法／設定／記録の5セクション、h2→h3→h4階層 | Yes（タッチ・視線入力・スイッチ・キーボード） | Yes | Yes | native button, OK | Group A（T6.5-B1 Pilot、Local checkpointのみ・Production未反映） | ほぼ準拠 |
| katachi-awase-app.html | Yes | top chrome（Lock→Fullscreen→Help、donomanaHelpBtn、Standard §5.1正式ordering準拠） | 素の`&lt;div id="helpPanel"&gt;`（ID指定styling、既存`#settingsPanel`と同方式）、openSettings/closeSettingsと同型のopenHelp/closeHelp | このアプリについて／活動の違い（レベル1-3）／操作方法（タップ・ドラッグ両対応の明記含む）／設定／記録の5セクション、h2→h3→h4階層 | Yes（タッチ・視線入力・スイッチ・キーボード） | Yes | Yes | native button, OK | Group A（T6.5-B2でRollout、Local checkpointのみ・Production未反映） | ほぼ準拠 |
| miru-hirogaru-app.html | No | none | none | — | No | No | No | n/a | Group D | Help新規作成 |
| mitsukete-touch-app.html | Yes | top chrome（Lock→Fullscreen→Help、donomanaHelpBtn、Standard §5.1正式ordering準拠） | 素の`#helpPanel`（ID指定styling、既存`#settingsPanel`と同方式）、openSettings/closeSettingsと同型のopenHelp/closeHelp | このアプリについて／活動の違い（レベル1-3）／操作方法／設定／記録の5セクション、h2→h3→h4階層 | Yes（タッチ・視線入力・スイッチ・キーボード） | Yes | Yes | native button, OK | Group A（T6.5-B3でRollout、Local checkpointのみ・Production未反映） | ほぼ準拠 |
| junban-miyou-app.html | Yes | top chrome（Lock→Fullscreen→Help、donomanaHelpBtn、Standard §5.1正式ordering準拠） | 素の`#helpPanel`（ID指定styling、既存`#settingsPanel`と同方式）、openSettings/closeSettingsと同型のopenHelp/closeHelp | このアプリについて／活動の違い（レベル1-3）／操作方法／設定／記録の5セクション、h2→h3→h4階層 | Yes（タッチ・視線入力・スイッチ・キーボード） | Yes | Yes | native button, OK | Group A（T6.5-B3でRollout、Local checkpointのみ・Production未反映） | ほぼ準拠 |
| dotchiga-ii-app.html | Yes | top chrome（Lock/Fullscreen隣、Standard §5.1正式ordering準拠） | `#helpPanel`（`.settings-panel`再利用、非modal、role=dialogなし） | このアプリについて／3つの活動／自分の画像を使う（Custom Choice・Privacy含む）／操作方法（Touch/視線入力/スイッチ/キーボード個別）／設定／記録の6セクション、h2→h3→h4階層 — Standard自体のReference Implementation | Yes（4入力方式を個別h4で説明） | Yes | Yes | native button, OK | Group A | Standard Reference Implementation（対応不要） |

## 集計（全35アプリ、unique app単位）

Group分類は各アプリにつき1個のみ付与する（`Group B+C`は「入口・内容の両方に課題を持つ」ための**独立した複合カテゴリ**であり、`Group B`・`Group C`の内数ではない。matching-appは`Group B`・`Group C`いずれの件数にも含まれず、`Group B+C`としてのみ1回カウントする）。表の35行から機械的に再集計した結果は以下のとおりで、5カテゴリの合計は35アプリと一致する。

- **Group A**（Help有・top chrome入口・内容十分、ほぼ準拠）: **21**（T5-E-A''でhiragana-learn・katakana-appが追加、15→17；T6.5-B1/B2でkurabeyou-app・katachi-awase-appが追加、17→19；T6.5-B3でmitsukete-touch-app・junban-miyou-appが追加、19→21） — nazori-app, nazorin-print, okane-app, register-app, schedule-app, yomikaki-app, sst-app, kimochi-board, drawing-app, slideshow-sakusei, kyou-no-kiroku, scratch-app, gaze-keyboard, mogura-tataki, dotchiga-ii-app, hiragana-learn, katakana-app, kurabeyou-app, katachi-awase-app, mitsukete-touch-app, junban-miyou-app（うちokane-app/mogura-tataki/dotchiga-ii-appが特に模範的——dotchiga-ii-appはStandard自体のReference Implementation。hiragana-learn/katakana-appはT5-E-A''時点でRC・User Review待ち。kurabeyou-app/katachi-awase-app/mitsukete-touch-app/junban-miyou-appはT6.5-B1〜B3時点でLocal checkpointのみ・Production未反映）
- **Group B**（Help有だが入口が旧式・非持続。matching-appを含まない）: 4 — janken-app, tyushi, directions-app, time-timer
- **Group C**（Help有だが内容不足。matching-appを含まない）: 2 — timetable-app, sugoroku-app
- **Group B+C**（入口・内容両方に課題。B/Cいずれとも重複カウントしない独立カテゴリ）: 1 — matching-app
- **Group D**（Helpなし）: 7（T5-E-A''でhiragana-learn・katakana-appが離脱、13→11；T6.5-B1/B2でkurabeyou-app・katachi-awase-appが離脱、11→9；T6.5-B3でmitsukete-touch-app・junban-miyou-appが離脱、9→7） — shiritori2, tokei-app, cup_game, bosai-app, suji-manabou, ongaku-app, miru-hirogaru-app

**合計確認**: 21 + 4 + 2 + 1 + 7 = **35**（全Production app総数と一致）。

### 横断的な技術的所見

Group Aのアプリでも、多くのHelp modal/panelが`role="dialog" aria-modal="true"`を持たない素の`<div>`overlayである（kimochi-board, drawing-app, slideshow-sakusei, kyou-no-kiroku, gaze-keyboard, sst-app, sugoroku-app）。正しく実装されているアプリ: janken-app, register-app, matching-app, mogura-tataki, time-timer, tyushi, scratch-app, nazorin-print, okane-app。Group分類とは別に、一括でのARIA dialog role付与パスが有効な可能性がある。

## Rollout優先順位トップ5

1. **bosai-app.html（Group D）** — チェックリスト・171番シミュレーション等の複雑機能を持つ防災アプリだが、Helpが皆無。初見の保護者・教員にとって非自明な機能が多く、Group D中で最優先。
2. **sugoroku-app.html（Group C）** — 唯一の「Help」がマス目・イベントの用語集のみ。ゲーム設定・オンラインモード・アクセシビリティについて説明が一切ない。
3. **directions-app.html / matching-app.html（Group B / B+C）** — いずれも内容自体は良好だが、入口がホーム画面からしか到達できない（directions-app）、またはheader自体が存在しない（matching-app）。内容がほぼ既存のため低コストで高価値な改善。
4. **tyushi.html / time-timer.html（Group B）** — 調査対象中最も内容が充実している（特にtyushiはgaze/switch/touch/gamepad入力の説明が模範的）にもかかわらず、入口が左下固定ボタンでtop chromeに含まれていない。構造的な移動だけで大きく改善する。
5. ~~hiragana-learn.html / katakana-app.html（Group D）~~ — **Phase T5-E-A''で対応済み（Group D→Group A）。** カタログ中でも利用頻度が高いと想定される「学習アプリ」の中核2本にHelpを新設した。User Browser Review待ち。

## 本Phaseでの対応範囲

上記Inventoryは調査のみであり、**本Phaseでは既存Productionアプリのコードを一切変更していない**。段階的Rolloutは後続Phaseで、`donomana-help-usage-guide-standard-v1_0.md` §21のbatch方針（原則2〜4アプリ/batch）に従って実施する。
