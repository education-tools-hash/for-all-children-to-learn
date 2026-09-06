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

### Group A候補(要implementation時再検証、確度中) — 3件

| app | 候補wrapper | 備考 |
|---|---|---|
| tyushi | `#stage` | game areaを包むが、周辺(`#help-overlay`等)との境界を要再確認 |
| cup_game | `.container` | 同上 |
| kimochi-board | `#grid` | カードグリッドのみで、`.top-bar`等が別途main相当か要判断 |

### Group B: 複数の画面/セクションが並列し、新規wrapper追加が必要(中リスク) — 9件

okane-app(`<section>`×4)、tokei-app(`<section>`×4、**PWA Pilot対象**)、yomikaki-app(`<section>`×3)、janken-app(`.screen`複数)、timetable-app(`.section`複数)、sugoroku-app(ゲーム状態別div複数)、kyou-no-kiroku(`.screen`複数)、mogura-tataki(`.screen`複数)、ongaku-app(`.screen`複数)

okane-app/tokei-appは既に`<section>`タグを使用しており、`<nav>`+`<section>`群を`<main>`で包む設計は比較的素直。他は`<div class="screen/section">`パターンで、新規`<main>`要素を追加してその中へ複数screenをまとめて移動する必要がある。

### Group C: 複雑・特殊構造で個別設計が必要(高リスク) — 4件

- **sst-app**: `.scr`クラスの画面が30件以上(教員モード・生徒モード混在の巨大SPA)。単純な一括wrapping不可
- **scratch-app**: canvas中心のお絵かきツール、`#root`(canvas)+複数パネル
- **gaze-keyboard**: AAC(拡大代替コミュニケーション)ボード、パネル多数・fullscreen専用領域あり
- **drawing-app**: canvas+sidebar+toolbar群、Gaze設定パネルも混在。Group A候補としたが精査の結果Cへ再分類が妥当

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

## 8. App Title Source of Truth 照合(全35アプリ)

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
