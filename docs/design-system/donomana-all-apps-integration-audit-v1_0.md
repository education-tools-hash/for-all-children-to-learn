> **[AUDIT-35-ARCHIVE-1 注記]** 本文書はAUDIT-35初回監査(AUDIT-35-1)時点の記録であり、内容は無改変で保存している。ここに記載のfinding(F1〜F4)は後続のAUDIT-35-FIX-1〜FIX-3J・AUDIT-35-H1-DESIGN-1/IMPL-1/RELEASE-1により全件解消済み(AUDIT-35-CLOSE-GATE-1で確認)。現在値は`tools/main-heading-audit/`および`docs/design-system/donomana-main-heading-structure-classification-v1_0.md`を参照のこと。以下は当時のSource of Truthとして保存する。
>
> 原文中で参照される`tools/audit35-1/audit-results.json`は派生生成物のため保存対象外とし、`audit.js`と記載baselineから再生成可能。

# どのまな 全35アプリ統合監査 v1.0

- Phase: AUDIT-35-1 (ALL 35 APPS STATIC INTEGRATION AUDIT)
- Baseline: `main` = `origin/main` = `2ea10a8`
- Worktree: `for-all-children-to-learn-audit35-1` / branch `audit/all-apps-integration-audit35-1`
- Production変更: 0件(監査スクリプトのみ`tools/audit35-1/`に追加。本docのみcommit対象)

## 重要: このAuditの性質

このPhaseで完了したのは**静的解析・Source of Truth照合・コードトレースを中心としたStatic Integration Audit**である。

**次のように表現してはならない:**
- 「全35アプリのブラウザ品質検証完了」
- 「WCAG/JIS監査完了」

いずれも本Auditのスコープ外であり、未実施(下記「Explicit limitations」参照)。

## Scope(実施範囲)

- 全35アプリ(`apps-data.json`基準)
- Static analysis(Node script によるHTML/JSテキスト解析)
- Source of Truth inspection(`generate.js`内の`FS_SKIP_APPS`等の集合と実ファイルの突合)
- Generator Set照合(除外リスト・対象リストとの一致確認)
- Targeted code trace(自動検出結果を手動でコードリーディングし裏取り)

## Explicit limitations(このPhaseでは未実施)

Playwright/jsdom等が本環境に未導入のため、以下は**未実施**:

- Responsive実測(375×667 / 390×844 / 768×1024 / 1280×900等)
- Console/runtime error確認(35アプリ全件の実起動)
- Touch target実測(44px等の実測)
- Audio実動作(autoplay制限・実再生)
- Modal/focusのreal-browser挙動確認
- Gaze/Switchの体感的実機確認(dwell time、スキャン順序の体感)

これらはコードの静的読解では判定できない領域であり、今回の「クリーン」判定はあくまで**静的な実装痕跡の有無**を根拠とする。実ブラウザでの動作を保証するものではない。

## Future Browser Gate(将来Phase必須事項)

構造是正(F1〜F4の解消)後、WCAG/JIS等の正式アクセシビリティ監査へ入る前に、**real-browser integration verification**(Playwright導入 or 実機/実ブラウザでの代表アプリレビュー)を独立したPhaseとして実施すること。この未実施項目を消失・省略してはならない。

## 1. Source of Truth matrix

| 機能 | Source of Truth |
|---|---|
| アプリ一覧・メタデータ | `apps-data.json`(35件) |
| Home/Lock/Fullscreen/A11yパネル/Record導線の注入ロジック | `generate.js`(`injectHomeButtonToAppHtmls`/`injectLockFsButtonToAppHtmls`/`injectA11yPanelToAppHtmls`/Record Foundation注入部) |
| Lock/Fullscreen対象除外 | `generate.js` `FS_SKIP_APPS`(18件) / `LOCK_SKIP_APPS`(5件) |
| 読み上げ(SR)対象除外 | `generate.js` `SR_SKIP_APPS`(6件) |
| Home button独自実装許容 | `generate.js` `HOME_BTN_SKIP_APPS`(`scratch-app`のみ) |
| Record Foundation対象 | `generate.js` `LEARNING_RECORD_FOUNDATION_APPS`(21件) |
| 学習のきろく共通導線(chrome側) | `generate.js` `donomanaRecordNavBtn`注入部(`data-supporter-only="true"`) |
| PWA Pilot対象パス | `service-worker.js` `PILOT_PATHS`(`/`, `/learning-records.html`, `/janken-app.html`, `/tokei-app.html`) |
| PWA登録スクリプト注入対象 | `generate.js`(`pwa-register.js`をPILOT_PATHS相当の4ファイルにのみ注入) |
| Learning Record Standard(storage設計) | `docs/design-system/donomana-learning-record-standard-v1_0.md` |
| Communication History(gaze-keyboard機微データ) | `docs/design-system/donomana-communication-history-standard-v1_0.md`(v1.0, 2026-08-30) |
| Switch Scan仕様 | `docs/design-system/donomana-switch-scan-spec-v1_0.md` |
| Gaze標準 | `docs/design-system/donomana-gaze-accessibility-standard-v1_0.md` |
| PWAアーキテクチャ | `docs/design-system/donomana-pwa-architecture-v1_0.md` |

## 2. 35アプリ一覧(apps-data.json由来)

filename, category, 宣言input(`apps-data.json`の`input`配列), Record対象, PWA Pilot対象を機械的に突合(詳細は`tools/audit35-1/audit-results.json`)。35件全て app本体・detailページとも存在を確認、欠落0件。

## 3. 確認済み: 問題なし(自動検証)

- **App/Detail整合**: 35件全てでファイル存在・detail→app相互リンク確認。Broken link 0。
- **Common chrome(Home/Lock/Fullscreen/A11yパネル)**: `generate.js`の`FS_SKIP_APPS`/`LOCK_SKIP_APPS`/`HOME_BTN_SKIP_APPS`の期待値と実ファイルの実装を全35件突合し、不一致0件。
  - `scratch-app`はHome button共通注入対象外(独自実装)だが、実際に`id="backBtn" aria-label="もどる" href="https://donomana.jp/"`の同等リンクが実装されていることをコード確認済み(false alarmの解消)。Lock機能も自前実装(`がめんロック`トグル)を確認。
- **Switch Scan / Gaze 宣言と実装の突合**: `apps-data.json`の`input`に`switch`/`gaze`を宣言している全アプリで、対応する実装マーカー(`data-scan`/`scannable`/`gaze`関連コード)の存在を確認。不一致0件。
- **`data-supporter-only="true"`のScan漏れ**: 全35件で、supporter-only要素が`data-scan`/`scannable`を同時に持つケース0件(RECORD-NAV-1のScan除外は健全)。
- **PWA Pilot隔離**: `pwa-register.js`の注入は`index.html`/`learning-records.html`/`janken-app.html`/`tokei-app.html`の4ファイルのみ。他31アプリへの漏れ0件、Pilot対象での欠落0件。
- **localStorageキー衝突**: 全35アプリの実データ用リテラルキー(共通`donomana-a11y-*`名前空間を除く)35件を抽出し、アプリ間の重複0件を確認。
- **Generator冪等性**: `node generate.js`を3回連続実行し、`git status`/`git diff`でcumulative drift = 0を確認(未追跡の監査スクリプトディレクトリを除く)。
- **既知debt再確認 - `kyou-no-kiroku`複合オブジェクト問題**: `donomana-learning-record-standard-v1_0.md`記載の「配列前提APIを複合storageキーへ誤適用すると`children`/`kimochiOptions`/`a11y`を破壊する」問題は、実コード確認により`donomanaRecordReadNestedCollection`/`WriteNestedCollection`(Composite Storage Adapter)で解消済みと確認(`kyou-no-kiroku.html:2109,2155,2525,2733,2750,2967`)。
- **既知debt再確認 - `gaze-keyboard`孤児データ問題**: 同docに記載の「プロファイル削除時に`gaze_history_*`/`gaze_stats_*`が削除されず残存する」問題は、`donomana-communication-history-standard-v1_0.md`(Phase T6-A, 2026-08-30)にて`deleteProfileCommunicationData(id)`のCascade Delete実装で解消済みと確認(`gaze-keyboard.html:4066,4170-4174`)。
- **`tokei-app`のCDN依存(html2canvas)**: PWA Pilot対象アプリだが、`html2canvas`未ロード時(オフライン等)は`typeof html2canvas === 'undefined'`を検出し、ユーザー向けエラーメッセージを表示して安全にreturnする実装を確認(`tokei-app.html:2313-2322`)。この機能(教員向けPNGエクスポート)は時計学習の主要機能ではないため、オフライン時に機能しなくてもBlockerには該当しない。

## 4. 確認済み: false positive(自動検出だが手動トレースで問題なしと判定)

- `bosai-app.html`の`id="bag-max"`、`sugoroku-app.html`の`id="sce-prev-ic"`: 静的テキスト上は2箇所出現するが、両方とも同一コンテナの`innerHTML`を丸ごと差し替える実装(`count.innerHTML=...`/`prev.innerHTML=...`)であり、実行時に同時に2つ存在することはない。真の重複IDではない。
- `dotchiga-ii-app.html`の`aria-label=""`(2箇所、`#choiceA`/`#choiceB`): 初期HTMLの空プレースホルダーであり、`setAttribute('aria-label', CHOICES[...].label)`(1620-1621行目)でラウンド開始時に必ず設定される。利用者が実際に操作可能になった時点で空ラベルは残らない。

## 5. Severity集計

| Severity | 件数 | 内訳 |
|---|---|---|
| P0 | 0 | なし |
| P1 | 0 | なし |
| P2 | 1 | F2(matching-app modal focus trap) |
| P3 | **finding families = 3**(F1/F3/F4) | F1: theme-color重複=3アプリ / F3: `<main>`欠落=26アプリ / F4: 見出し階層不備=21アプリ(h1欠落20+h1過多1) |

**注意**: 「P3 = 3」は finding families(finding種別)の数であり、影響アプリ数の合計ではない。影響アプリ実数はF1=3、F3=26、F4=21(app単位で重複しうる)。

## 6. 確認済み: 新規finding(要Fix Phase)

### F1. `theme-color`メタタグ重複(3アプリ) — P3 / Fix Category C(Generator Fix)
`kyou-no-kiroku`・`mogura-tataki`・`ongaku-app`の3ファイルで、アプリ独自の`<meta name="theme-color">`(それぞれ`#4A4270`/`#4A4270`/`#0f0e17`)に加え、`generate.js`の`FAVICON_TAGS`が無条件に注入する共通値`#00A99D`が重複挿入されている。原因は`injectFaviconToAppHtmls`系処理が既存の`theme-color`有無をチェックせず一律注入するため。他32アプリは重複なし(1件のみ)。表示上の実害は軽微(ブラウザは通常先頭の値を採用)だが、意図と異なる値が使われうる。

### F2. `matching-app.html`: 一部モーダルがキーボードFocus Trap対象外 — P2 / Fix Category B(App-specific Fix)
同ファイル内に`role="dialog" aria-modal="true"`が6件(`vs-result-ov`, `clear-ov`, `how-ov`, `settings-ov`, `record-ov`, `edit-ov`)。Tabキーのフォーカストラップ実装(2542-2569行目)は`['how-ov','settings-ov','edit-ov','record-ov']`の4件のみを対象としており、`vs-result-ov`(対戦結果画面、ボタン2件)と`clear-ov`(クリア画面、ボタン2件)はアクセシビリティツリー上`aria-modal="true"`と宣言されているにもかかわらず、Tab/Shift+Tabでモーダル外へフォーカスが抜けてしまう。既知debtリストの「matching modal Shift+Tab」に該当する残存分と考えられる(4/6は対応済み、2/6が未対応)。

### F3. `<main>`ランドマーク未実装(26/35アプリ) — P3 / Fix Category D(Accessibility Fix)
`nazori-app`, `nazorin-print`, `janken-app`, `shiritori2`, `okane-app`, `tokei-app`, `schedule-app`, `timetable-app`, `yomikaki-app`, `bosai-app`, `matching-app`, `sugoroku-app`, `tyushi`, `cup_game`, `sst-app`, `kimochi-board`, `drawing-app`, `slideshow-sakusei`, `directions-app`, `time-timer`, `kyou-no-kiroku`, `scratch-app`, `gaze-keyboard`, `mogura-tataki`, `ongaku-app`, `junban-miyou-app`の26アプリに`<main>`要素がない。スクリーンリーダーのランドマークナビゲーションで主要コンテンツへ直接ジャンプできない。機能的なブロッカーではない。

### F4. 見出し階層の不備(h1欠落20件・h1過多1件) — P3 / Fix Category D(Accessibility Fix)
- `<h1>`が0件のアプリ20件(`hiragana-learn`, `katakana-app`, `nazori-app`, `janken-app`, `shiritori2`, `register-app`, `schedule-app`, `matching-app`, `sugoroku-app`, `cup_game`, `sst-app`, `kimochi-board`, `drawing-app`, `slideshow-sakusei`, `time-timer`, `suji-manabou`, `kyou-no-kiroku`, `gaze-keyboard`ほか)。
- `directions-app`は`<h1>`が17件出現(繰り返しカード/設問テンプレートごとに`<h1>`を複製している可能性が高い、要個別確認)。

## 7. Local Browser Review推奨対象(将来Browser Gate Phase用)

「Explicit limitations」節の項目を実施する際の代表アプリ候補: standard=hiragana-learn、Record=tokei-app、Switch=bosai-app、Gaze=kimochi-board、modal-heavy=matching-app、drag=drawing-app、PWA Pilot=janken-app/tokei-app。

## 8. 確認できなかった既知debt項目

Phase実行プロンプトが例示した「RECORD-NAV-2 query filter」「Top first-offline image absence」「Header/Settings重複」については、git log・docsともに該当する記録を発見できなかった。誤記または別名称の可能性があるため、次回言及時に詳細(該当ファイル・Phase名)を確認されたい。

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-06 | Phase AUDIT-35-1。全35アプリStatic Integration Auditの初版。判定: ALL 35 APPS STATIC INTEGRATION AUDIT COMPLETE / CLOSED。次Phase候補: AUDIT-35-FIX-1(matching modal focus trap hardening)。 |
