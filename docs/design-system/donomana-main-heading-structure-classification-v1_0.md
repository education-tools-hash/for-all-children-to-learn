# どのまな `<main>`ランドマーク・見出し階層 構造分類 v1.0

- Phase: AUDIT-35-FIX-3A(MAIN LANDMARK / HEADING STRUCTURE CLASSIFICATION)
- Baseline: `main` = `origin/main` = `c253b2f`
- 性質: **分類・設計のみ**。Production HTML変更は0件(監査tool・本doc以外はコミット対象外)
- 監査方式: 静的解析(`tools/main-heading-audit/`)+ 個別コードリーディングによるbody構造分類

## 1. 再監査結果(現行Production基準)

| 項目 | AUDIT-35-1時点 | 今回再監査 | 差異 |
|---|---|---|---|
| `<main>`欠落 | 26 | **26** | 一致 |
| h1欠落 | 20 | **18** | **不一致(後述)** |
| h1過多(directions-app) | 17件 | **17件** | 一致 |
| role="main"代替 | 未調査 | **0件**(landmark完全欠落、代替なし) | 新規確認 |

**h1欠落件数の不一致について**: AUDIT-35-1の報告では「20件」としていたが、報告文中に実際に列挙されていたアプリ名は18件+「ほか」という曖昧な表現だった。今回、生スクリプトでの再検証(タグ有無ベース)と、開始・終了タグの対応が取れているかのペアマッチベースの両方で独立に検証し、**両方法とも完全に一致して18件**という結果を得た。当時の「20」という数字自体が不正確だった可能性が高く、以後は**18件を正とする**。

## 2. h1欠落 18アプリ(確定リスト)

hiragana-learn, katakana-app, nazori-app, janken-app, shiritori2, register-app, schedule-app, matching-app, sugoroku-app, cup_game, sst-app, kimochi-board, drawing-app, slideshow-sakusei, time-timer, suji-manabou, kyou-no-kiroku, gaze-keyboard

## 3. `<main>`欠落 26アプリ(確定リスト)

nazori-app, nazorin-print, janken-app, shiritori2, okane-app, tokei-app, schedule-app, timetable-app, yomikaki-app, bosai-app, matching-app, sugoroku-app, tyushi, cup_game, sst-app, kimochi-board, drawing-app, slideshow-sakusei, directions-app, time-timer, kyou-no-kiroku, scratch-app, gaze-keyboard, mogura-tataki, ongaku-app, junban-miyou-app

## 4. Source of Truth / Generator影響範囲

`generate.js`は各アプリのbody**内部構造**(activity/game領域)を一切生成していない。生成・注入対象は以下の「周辺chrome」のみ:
- design-tokens / seo-tags / favicon(head)
- record-nav-btn / announce-helper / a11y-panel / lock-fs-btn / home-btn(body冒頭への注入)
- learning-record-foundation-js(body末尾)

**結論: `<main>`をどこに巻くか、h1をどこに追加するかは、generate.js側では一切自動化できない**(各アプリのbody本体は100%手書きのため)。ただしSETTINGS_PROXYと同様の「アプリ名→selector」対応表をgenerate.js側に持たせ、注入する形であれば将来的に部分的自動化の余地はある(本Phaseでは設計のみ、実装しない)。

## 5. `<main>`欠落 26アプリの分類

### Group A: 単一wrapperが既に存在し、タグ変換のみで対応可能(低リスク) — 10件

| app | 候補wrapper | CSS/JSタグ依存 |
|---|---|---|
| matching-app | `#main` | 依存なし(確認済み) |
| nazori-app | `.main` | 依存なし(確認済み) |
| bosai-app | `.main` | 依存なし(確認済み) |
| schedule-app | `.main` | 依存なし(確認済み) |
| nazorin-print | `#ui-root`(`.app`) | 依存なし(確認済み) |
| shiritori2 | `.app` | 依存なし(確認済み) |
| slideshow-sakusei | `#app` | 依存なし(確認済み) |
| time-timer | `.app` | 依存なし(確認済み) |
| junban-miyou-app | `.app` | 依存なし(確認済み) |
| directions-app | `#app`(`.app`) | 依存なし(確認済み)。**ただしh1過多は別問題として分離対応(§7)** |

`div[.#]main` / `div[.#]app` のようなタグ名修飾セレクタ、`closest('div')`、`querySelectorAll('div')`をこの10件全てでgrep確認し、**該当0件**。CSS/JS構造リスクは低いと判定。

### Group A候補 → AUDIT-35-FIX-3Cで個別再確認・解消済み — 3件

3A時点では「境界要再確認」としていたが、Phase AUDIT-35-FIX-3Cで実装可否を1アプリずつ個別調査し、全件で安全な境界を確定した(3件ともGroup A相当・実装済み)。

| app | 採用wrapper | 境界確認の結論 |
|---|---|---|
| tyushi | `#stage` | `#stars`/`#screen-flash`/`#fx-layer`は全て`position:fixed;pointer-events:none`の装飾専用エフェクト層(初期状態で空div)であり、`#help-overlay`等のmodal同様main外が適切と確認。`#stage`単体が既存の完結したactivity wrapperであり、そのままdiv→main変換で対応可能(Priority A) |
| cup_game | `.container` | title-area/HUD/settings/game-field/action-areaを含む唯一の既存wrapperで、周辺の`.bg-clouds`/`.stars-container`/`.gaze-cursor`は同じくposition:fixed;pointer-events:noneの装飾層と確認。div→main変換のみで対応可能(Priority A) |
| kimochi-board | `#grid` | `.top-bar`(タイトル+設定ボタン)は他アプリの`#hdr`相当のheader chromeとして意味的にmain外が妥当。`.scan-bar`/`.hint`は常時表示の操作関連UIだが、`#grid`が`display:grid`のgrid containerであるため、これらを`<main>`内へ含めるには`#grid`の閉じタグをその後方へ移動する必要があり、その場合`.scan-bar`/`.hint`がgrid itemとして誤ってgrid配置ロジックに巻き込まれ重大なlayout破損を起こすことを検証で確認した。新規wrapper追加なしに安全な境界拡張はできないため、今回は`#grid`単体のみをmain化し(Priority A相当の最小変更)、`.scan-bar`/`.hint`をmain外に残す判断とした。`.top-bar`/`.scan-bar`/`.hint`をまとめて意味的にmain化する場合は新規wrapper追加(Group B相当)が必要であり、必要なら別Phaseで検討する |

3件ともh1についても個別確認: tyushiは既存h1(`#help-overlay`内「✨ひかるボタン 使い方」)が既に1件存在し追加対象外(ページ本体には可視タイトルが存在しないため、新規h1は今回作成しない)。cup_game(`.title-main`)・kimochi-board(`.title`)は既存の静的可視タイトルをh1化した。両アプリとも当該class定義に`font-weight`が明示されておらず、UAデフォルトのh1太字(700)が適用され本来の見た目(400)からvisual diffが発生することをbefore/after計測で検出し、`font-weight:400`を明示追加して解消した(h1化に伴うUAスタイルシート対策の実例)。

### Group B: 複数の画面/セクションが並列し、新規wrapper追加が必要(中リスク) — 9件

okane-app(`<section>`×4)、tokei-app(`<section>`×4、**PWA Pilot対象**)、yomikaki-app(`<section>`×3)、janken-app(`.screen`複数)、timetable-app(`.section`複数)、sugoroku-app(ゲーム状態別div複数)、kyou-no-kiroku(`.screen`複数)、mogura-tataki(`.screen`複数)、ongaku-app(`.screen`複数)

okane-app/tokei-appは既に`<section>`タグを使用しており、`<nav>`+`<section>`群を`<main>`で包む設計は比較的素直。他は`<div class="screen/section">`パターンで、新規`<main>`要素を追加してその中へ複数screenをまとめて移動する必要がある。

**AUDIT-35-FIX-3D実装結果(PWA Pilot対象2件=janken-app/tokei-appを除く7件)**: 新規`<main>` wrapperを既存要素の前後に挿入する形(要素の並び順は変更せず、既存の兄弟要素をmainの子要素へ変える)で全7件を実装。

- **okane-app**: `<nav>`〜4×`<section>`(learn/match/shop/mondai)をmain化。`<header>`(h1タイトル含む)はmain外(既存の他Group A/3Cアプリと同じhdr-outside-main境界)
- **yomikaki-app**: `.tabs`〜`.wrap`(3×`<section class="pg">`)をmain化。`<header>`(ロゴのみ、h1は`#pg-guide`内)はmain外
- **timetable-app**: `.tab-nav`〜5×`<section class="section">`をmain化。`.header`(h1タイトル含む)・`#fs-btn`はmain外
- **mogura-tataki**: `.wrap`(GAME AREA)単体をmain化(Priority A相当、タグ変換のみ)。`role="dialog" aria-modal="true"`を持つ`#scrStart`/`#scrResult`はmodal相当としてmain外に残置
- **kyou-no-kiroku**: `#screenChild`〜5×`.screen`+`<nav id="bottomNav">`をmain化。`<header>`(h1タイトル含む)・`#a11yPanel`・help modalはmain外、`#gazePointer`/`#scanBarContainer`は装飾/状態表示としてmain外
- **ongaku-app**: `#screen-home`〜`#screen-compositions`(7画面)をmain化。この範囲に元々挟まっていた`#modal-pin`/`#modal-help`は、順序を変えずに結果的にmainの子要素になる(要素の並び替えは行っていない)
- **sugoroku-app**: `#online-lobby`〜`#game`(6画面、`#dice-overlay`含む)をmain化。全画面とも`position:fixed;inset:0`のため、wrapper追加によるlayout上の影響なし。h1は`#setup`内の既存可視タイトル`.s-title`(「🎲 すごろく」)をタグ変換。直後の`tools/sugoroku-hotfix-test/test.py`(33件)で回帰なしを確認

h1については、既にh1=1だったokane-app/yomikaki-app/mogura-tataki/ongaku-app/timetable-appは変更していない(heading cleanupのついで実施はしない、という本Phase方針どおり)。sugoroku-app/kyou-no-kirokuの2件のみ新規h1化した。両アプリともCSS上`font-weight`未指定/指定済みの差を確認し、UAデフォルトのh1太字化によるvisual diffが出ないよう対応済み(kyou-no-kirokuの`.app-title`は元々`font-weight:bold`指定済みのため対応不要、sugoroku-appの`.s-title`は`font-weight:400`を明示追加)。

**AUDIT-35-FIX-3E-PWA実装結果(PWA Pilot対象2件)**: 残るjanken-app/tokei-appを実装し、Group B 9件すべてmain化完了。

- **janken-app**: `#screen-title`〜`#screen-battle`(6画面)をmain化。この範囲に元々挟まっていた`#record-modal-backdrop`/`#howto-overlay`は、ongaku-appと同様に順序を変えずmainの子要素になる。h1は`#screen-title`内の既存可視タイトル`.title-text`(「じゃんけん<br>まなぼう！」)をタグ変換(`font-weight:700`指定済みのためUAデフォルト太字化の懸念なし)
- **tokei-app**: `.difficulty-bar`〜4×`<section>`(sec1-4)をmain化。この範囲に含まれる`.scan-indicator`(switch scan中のみ表示のstatus text、`display:none`既定)は、`.difficulty-bar`と`<nav>`の間に位置し前後を切り離せないため、main内へ含めることとした(常時非表示のstatic textでlayout上の実害なし)。`<header>`(既存h1)はmain外。h1は既にh1=1のため無変更

PWA Pilot対象という制約上、`tools/pwa-poc/`配下の全real-browser/static suiteおよび`tools/record-dashboard-poc/dashboard-realbrowser-test.py`を実装後に再実行し、Storage Preservation・Offline Navigation Contract(Top→detail page→app本体の実UI導線)・First-Launch Readiness・Update Lifecycle・non-Pilot isolationのいずれにも回帰がないことを確認した(詳細はPhase報告を参照。本docは境界判断の記録のみとし、検証ログの転記はしない)。

### Group C: 複雑・特殊構造で個別設計が必要(高リスク) — 4件

- **sst-app**: `.scr`クラスの画面が30件以上(教員モード・生徒モード混在の巨大SPA)。単純な一括wrapping不可 → **AUDIT-35-FIX-3G-SSTで実装済み(下記)**
- **scratch-app**: canvas中心のお絵かきツール、`#root`(canvas)+複数パネル
- **gaze-keyboard**: AAC(拡大代替コミュニケーション)ボード、パネル多数・fullscreen専用領域あり
- **drawing-app**: canvas+sidebar+toolbar群、Gaze設定パネルも混在。Group A候補としたが精査の結果Cへ再分類が妥当 → **AUDIT-35-FIX-3H-DRAWINGで実装済み(下記)**

**AUDIT-35-FIX-3H-DRAWING実装結果**: `body{display:flex;flex-direction:column;height:100vh;overflow:hidden}`で`#topbar`(flex-shrink:0)→`#main-row`(flex:1)→`#statusbar`という縦flex構成であることを確認。`#main-row`自体が既に`display:flex;flex-direction:row;flex:1`で`#sidebar`(タイトル+ツール+パレット)と`#canvas-wrap`(bg/draw/overlayの3枚canvas)を内包する単一の既存wrapperであったため、`#topbar`等と束ねて新規`<main>`で連続wrapする案(body直下のflex-column構成を壊すリスクが高い)は採らず、`#main-row`単体をそのまま`<main>`へタグ変換した(Priority A、DOM再配置なし)。`#topbar`(undo/redo/clear/reset/share/save/fullscreen等)・`#statusbar`・`#bottombar`・Gaze関連UI(`#gaze-cursor`/`#gaze-panel`等)・`#float-toolbar`(フルスクリーン専用複製ツールバー)・各種modalはmain外に残置(意味的にはapp固有の操作UIだが、束ねるとflex layoutが壊れるため安全側に倒した判断)。h1は`#sidebar`内の既存可視タイトル`#app-title`(「🎨おえかきひろば」)をタグ変換、`font-weight:900`指定済み・グローバル`margin:0`resetありでUAデフォルト太字化リスクなし。canvas座標変換(`getBoundingClientRect()`ベース)・Gaze座標判定(`elementFromPoint()`ベース、DOM構造非依存)ともwrapper追加の影響を受けない設計であることをコードから確認し、実測でcanvas/sidebar/topbar/statusbar/gaze-panel等11要素のgeometryが完全一致することを確認した。

**AUDIT-35-FIX-3G-SST実装結果**: 「単純な一括wrapping不可」は画面数の多さ(26件の`.scr`)そのものではなく、`teacher-lock-modal`/`diary-export-modal`/`badge-modal`/`celebrate`(装飾オーバーレイ)が26画面の間に散在している点が理由と再確認した。既存順序を変えずに`#s-home`〜`#s-thermo`(全26画面)を新規`<main>`で連続wrapすることで、これら4件は結果的にmainの子要素になる(要素の並び替えは行っていない、AUDIT-35-FIX-3D/3E-PWAのongaku-app/janken-appと同じ扱い)。`.hdr`(既存h1候補`.hdr-title`含む)・`#bottom-back-bar`・`#help-modal`・`#screen-lock-overlay`・`#settings-modal`はmain開始位置より前にあり、そのままmain外を維持。h1は`.hdr-title`(「SST」、apps-data.json titleの一部と一致)を変換、新規文言追加なし。body/`.scr`とも`position:fixed`ではなく通常のblock/flow要素のため、wrapper追加によるlayout影響なし(`.celebrate`のみ`position:fixed`の装飾層で、fixedゆえに親要素に依存しないことを確認済み)。

## 6. h1欠落 18アプリの分類

全18アプリで、確認できた範囲では:
- 見出しタグ自体が0件(div/p/spanでタイトルを表現、または視覚的タイトルがヘッダー内に存在するが非見出し要素)
- hidden titleは0件(視覚的に隠されたh1候補は見つからず)
- h2から始まっているケースも無し(見出し自体が皆無)

個別の「現在使われている視覚的タイトル文言」の特定と、apps-data.json/page`<title>`との突合は次のFix Phaseで1アプリずつ確認が必要(本Phaseでは代表確認のみ実施)。

## 7. directions-app: h1過多(17件)の詳細

body構造は単一wrapper(`#app`/`.app`)で全て包まれており、**`<main>`化自体はGroup A相当の低リスク**。問題はwrapper内部の見出し構造:

| 分類 | 該当h1 | 件数 | 推奨方針(設計のみ、未実装) |
|---|---|---|---|
| アプリ全体タイトル(apps-data.json `title`と一致) | 「ほうこうと ばしょを まなぼう」 | 1 | **唯一のh1として維持** |
| 学習トピック画面 | まなぶ/みぎとひだり/まえとうしろ/うえとした/ほうがく/じゅんばん/ゲーム/なんばんめ？/どっちかな？/ほうがくクイズ/はいちゲーム/ごほうび | 12 | h2へ変更(トップh1配下のサブセクション) |
| UIパネル見出し | つかいかた/せってい/せんせい モード/学習ログ | 4 | 他アプリのmodal見出し規約(how-ov/settings-ov等のh2/h3パターン)に合わせてh2または既存パネル規約準拠 |

apps-data.jsonの`title`("ほうこうとばしょをまなぼう")と、現在の最初のh1テキスト("ほうこうと ばしょを まなぼう"、表記上のスペース差のみ)が一致することを確認済み。**新しい文言を作る必要はなく、既存の最初のh1をそのまま正式タイトルとして残せばよい**。

**AUDIT-35-FIX-3F実装結果**: 上記の設計どおりに実装した。`<div class="app" id="app">`は単一wrapperのタグ変換のみで`<main>`化(新規wrapper追加なし)。h1は「ほうこうと ばしょを まなぼう」のみ維持し、学習トピック12件・UIパネル4件の計16件は全てh2へ統一(3A設計の「同一階層ならh2で統一してよい」を採用。各screenは`.screen.active`で排他的に表示され同時に共存しないため、トピック間で親子関係を新設する意味的根拠がないと判断)。既存のパネル内サブ見出し2件(「せんせいモード」画面内の「🔒 パスワードを入力してください」、「学習ログ」画面内の「カテゴリ別 正答率」)はh2→h3へ1段階シフトし、親のscreen見出しがh1→h2になったことと整合させた。

CSS依存の実装時の発見: `.title-bar h1`(スクリーン見出し共通)に加えて`.card h2`(パネル内サブ見出し、`font-size:1.15em`)という**当初のgrepで見落としていたタグ修飾セレクタ**が実在し、素朴にh3へ変換すると「🔒 パスワードを入力してください」の見た目が変化することをbefore/after計測で検出した。両セレクタとも`h1, h2`/`h2, h3`を追加する形で拡張し、visual diff 0を実測で確認した。

apps-data.jsonの`title`とpage `<title>`タグを全35アプリで突合。ほとんどのアプリで一致(表記ゆれのみ)。明確な乖離が見られたのは:

- **register-app**: data.json「はんばいかい レジ」 vs `<title>`「レジマスター」
- **tokei-app**: data.json「とけい」 vs `<title>`「時計を学ぼう！」
- **slideshow-sakusei**: data.json「スライドショー作成」 vs `<title>`「SlideMovie — スライドショー・動画作成」

これらのアプリでh1を追加する際は、apps-data.json/page`<title>`のどちらでもなく、**アプリ画面内に実際に表示されている視覚的タイトル文言**を優先して使うべきと結論(利用者が実際に目にする文言と一致させるため)。個別確認はFix Phaseで実施。

## 9. CSS/JS構造リスク

Group A(10件)については前述の通りタグ依存セレクタ0件を確認。Group B/Cは新規wrapper追加を伴うため、実装時に都度、対象アプリの完全なCSS/JSを個別精査する必要がある(本Phaseでは代表確認のみ)。

## 10. Switch Scan / Gaze影響

これまでのAUDIT-35シリーズで確認した限り、Switch Scan候補セレクタ(`buildScanItems()`等)はいずれも`class`/`id`ベースであり`div`タグ名に依存する実装は確認されていない。`<main>`追加によるSwitch Scan/Gaze target selectorへの直接的な破壊リスクは低いと考えられるが、Group B/C(新規wrapper追加)についてはDOM階層が変わるため、実装時に各アプリのSwitch Scan/Gaze実装を個別に再確認する必要がある。

## 11. Record Foundation影響

Record Foundation対象21件のうち、`<main>`欠落アプリと重複するのは: janken-app, matching-app, bosai-app, tokei-app, kyou-no-kiroku, mogura-tataki, directions-app, okane-app, sst-app, katachi-awase-app(main有)等。Record保存は`localStorage`キー・JS関数呼び出しに依存しておりDOM構造(main有無)とは独立しているため、影響は低いと考えられる。実装時にRecord回帰テストで確認する。

## 12. PWA影響

PWA Pilot対象(janken-app, tokei-app, learning-records.html, Top)のうち、**tokei-appが`<main>`欠落(Group B)に該当**。tokei-appの構造変更は既存のPWA関連test(cache-lifetime, readiness, navigation等)への影響を実装時に必ず再確認すること。janken-appも`<main>`欠落(Group B、`.screen`複数)に該当するため同様の注意が必要。

## 13. 推奨バッチ順(実装時の目安、今回は未実装)

| Batch | 対象 | 内容 | リスク |
|---|---|---|---|
| Batch 1 | matching-app, nazori-app, bosai-app, schedule-app, nazorin-print, shiritori2, slideshow-sakusei, time-timer, junban-miyou-app(9件) | Group A: 既存wrapperのタグ変換のみ | 低 |
| Batch 2 | h1欠落18件のうちGroup A/Batch1と重複しないもの | 視覚的タイトル文言をh1化(1アプリずつ確認) | 低〜中 |
| Batch 3 | tyushi, cup_game, kimochi-board(3件) | Group A候補、実装時に境界再確認してからタグ変換 | 中 |
| Batch 4 | okane-app, yomikaki-app, sugoroku-app, kyou-no-kiroku, mogura-tataki, ongaku-app, janken-app, timetable-app(8件) | Group B: 新規main wrapper追加 | 中 |
| Batch 4-PWA | tokei-app(1件) | Group B、PWA Pilot対象のため既存PWA testと併走必須 | 中〜高 |
| Batch 5 | directions-app | main化(低リスク)+h1階層是正(17→1+16見出しレベル変更、個別設計) | 中〜高(専用Phase推奨) |
| Batch 6 | sst-app, scratch-app, gaze-keyboard, drawing-app(4件) | Group C: 個別設計が必要な複雑構造 | 高 |

## 14. Severity

`<main>`欠落・h1不備はいずれも即時のP0/P1ではないが、WCAG/JIS正式監査前に是正すべき構造的accessibility debtとして分類する(既存のAUDIT-35-1判定を維持)。

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-06 | Phase AUDIT-35-FIX-3A。全35アプリの`<main>`/heading構造分類の初版。h1欠落件数をAUDIT-35-1の20から18へ訂正(再検証による確定値)。 |
| v1.0(改訂1) | 2026-09-06 | Phase AUDIT-35-FIX-3C。§5の「Group A候補(要implementation時再検証、確度中) — 3件」(tyushi/cup_game/kimochi-board)を個別実装可否調査のうえ解消。3件ともGroup A相当と確定し実装済み(tyushi・cup_gameは既存単一wrapperのdiv→main変換のみ、kimochi-boardは`#grid`単体のみをmain化し`.scan-bar`/`.hint`はCSS Grid実装上の安全上の理由でmain外に残す個別境界判断)。他章の分類・数値(Group B/C、directions-app等)は変更なし。 |
| v1.0(改訂2) | 2026-09-06 | Phase AUDIT-35-FIX-3D。§5 Group B 9件のうちPWA Pilot対象2件(janken-app/tokei-app)を除く7件(okane-app/yomikaki-app/sugoroku-app/kyou-no-kiroku/mogura-tataki/ongaku-app/timetable-app)を実装。新規`<main>` wrapperを既存要素の前後へ挿入する方式(要素順序は変更せず)で全7件のmain化に成功。h1はsugoroku-app/kyou-no-kirokuの2件のみ新規化(他5件は既にh1=1のため無変更)。janken-app/tokei-appは今回もPWA専用Phaseへ引き続き分離、Group C・directions-appも無変更。 |
| v1.0(改訂3) | 2026-09-06 | Phase AUDIT-35-FIX-3E-PWA。PWA Pilot対象の残り2件(janken-app/tokei-app)を実装し、Group B 9件全件のmain化が完了。janken-appは新規h1化も実施(h1欠落6→5)。既存PWA regression suite(tools/pwa-poc/全種・record-dashboard-poc)を全て再実行し回帰なしを確認。service-worker.js等PWAコア資産は無変更(実装中に発生したservice-worker.jsの見かけ上の差分はtools/pwa-poc/pwa-realbrowser-test.pyのUpdate Flowテストが検証用一時ファイルをWindows text-modeで書き戻す際の改行コード変更のみに起因する既知のテストスクリプト副作用と特定し、`git checkout --`でHEADと完全一致するLF版へ復元した。内容差分ではないためcommit対象に含めていない)。 |
| v1.0(改訂4) | 2026-09-06 | Phase AUDIT-35-FIX-3F。directions-appのh1過多(17件)を是正し、Group C 4件を除く全34アプリのmain欠落・h1欠落・h1過多を解消。`<div class="app" id="app">`を単一wrapperのタグ変換のみで`<main>`化。h1は「ほうこうと ばしょを まなぼう」のみ維持、学習トピック12件+UIパネル4件の計16件をh2へ、既存のパネル内サブ見出し2件をh2からh3へ1段階シフト。実装時に`.card h2`という当初未発見のタグ修飾CSSセレクタを検出し、`.card h2, .card h3`へ拡張してvisual diff 0を確保した。 |
| v1.0(改訂5) | 2026-09-06 | Phase AUDIT-35-FIX-3G-SST。Group C 4件のうちsst-appを実装(残るscratch-app/gaze-keyboard/drawing-appは個別Phase継続)。26画面(`.scr`)+散在する4件のmodal/装飾層を新規`<main>`で連続wrap、`.hdr-title`をh1化。「単純な一括wrapping不可」の実際の理由(modal散在)を再確認した上で、要素順序を変えない連続wrap方式で対応可能と判定・実装した。main missing 4→3、h1 missing 5→4。 |
| v1.0(改訂6) | 2026-09-06 | Phase AUDIT-35-FIX-3H-DRAWING。Group C 4件のうちdrawing-appを実装(残るscratch-app/gaze-keyboardは個別Phase継続)。bodyがflex-column構成(`#topbar`→`#main-row`(flex:1)→`#statusbar`)であることを確認し、`#topbar`等を束ねる新規wrapper方式ではなく、既にsidebar+canvasを内包する`#main-row`単体をPriority Aでmain化する安全側の設計に変更した。`#app-title`をh1化。main missing 3→2、h1 missing 4→3。canvas座標変換・Gaze座標判定ともDOM構造非依存であることをコード確認し、実測でgeometry完全一致を確認した。 |
