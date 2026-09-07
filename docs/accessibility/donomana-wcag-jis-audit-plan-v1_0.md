# どのまな WCAG/JIS Accessibility Audit 計画 v1.1

- Phase: ACCESSIBILITY-AUDIT-PREP-1(初版)/ ACCESSIBILITY-AUDIT-PREP-2(v1.1改訂)
- 位置づけ: 本格的なWCAG 2.2 / JIS X 8341-3相当監査に**入る前の**準備・方法設計文書。本文書自体は適合性の判定を行わない。
- Baseline: `main` = `origin/main` = `6939bca`(初版時点)
- 前提: AUDIT-35シリーズ(main/h1構造是正、監査証跡保全含む)およびPOST-AUDIT-35-HARDEN-1-RELEASE(okane-appモーダルアクセシビリティ強化)は完全Close済み。
- v1.1改訂の根拠: ACCESSIBILITY-AUDIT-PILOT-1(5代表アプリでの方法論実証Pilot、Exit Gate判定=PILOT COMPLETE / METHOD REVISION REQUIRED BEFORE FULL AUDIT)の結果を反映。詳細は末尾の改訂履歴、および`docs/accessibility/pilot/`配下のPilot成果物4文書+`accessibility-audit-pilot-1-contrast-results.md`を参照。

---

## 0. Source of Truth棚卸し

本計画は以下を確認・整合させた上で作成した。

| 文書 | 本計画への反映 |
|---|---|
| `docs/design-system/donomana-all-apps-integration-audit-v1_0.md`(main保全済み) | F1〜F4監査結果、Explicit Limitations、Future Browser Gate要件を§9・§24へ反映 |
| `docs/design-system/donomana-main-heading-structure-classification-v1_0.md` | main/h1構造(全35アプリ解消済み)を§5 Inventoryの前提とした |
| `donomana-modal-accessibility-spec-v1_0.md`(v1.1、リポジトリroot) | §21未決定事項15件、register-app/okane-appの既知findingを§26 Known Issueへ引き継ぎ |
| `docs/design-system/donomana-new-app-development-standard-v1_0.md` | 新規アプリ標準パターンをAudit時の「正解」参照基準として利用 |
| `docs/design-system/donomana-switch-scan-spec-v1_0.md`(v1.8) | 4アプリ実証ベースの限定仕様である点を§16 Switch Gateに反映 |
| `docs/design-system/donomana-gaze-accessibility-standard-v1_0.md` | §17 Gaze Gateの基礎 |
| `docs/design-system/donomana-learning-record-standard-v1_0.md`ほかRecord系文書 | §7 Record Foundation軸、§26 Known Issue(okane-app 16.1、既にPOST-AUDIT-35-HARDEN-1で一部解消) |
| `docs/design-system/donomana-pwa-architecture-v1_0.md` | §27 SEO/PWA境界、PWA Pilot対象(janken-app/tokei-app)の扱い |
| `docs/design-system/donomana-communication-history-standard-v1_0.md` | gaze-keyboardの機微データ扱いをPilot選定理由に反映 |
| `tools/`配下の既存監査ツール群 | §9 Playwright環境、§8 自動/手動分担の実績根拠 |

既存tools棚卸し結果:

| tool | 種別 | 対象 |
|---|---|---|
| `tools/main-heading-audit/` | Node静的解析 | main/h1構造(全35アプリ) |
| `tools/fullscreen-touch-target-audit/` | Playwright | フルスクリーンボタンtouch target実測 |
| `tools/settings-proxy-focus-audit/` | Playwright | SETTINGS_PROXYのTab順序・フォーカス |
| `tools/theme-color-audit/` | Playwright | theme-colorメタタグ重複・responsive spot-check |
| `tools/matching-modal-focus-trap/` | Playwright | matching-app 6モーダルのFocus Trap・responsive |
| `tools/matching-modal-switch-scan/` | Playwright | matching-app Switch Scan候補・順序 |
| `tools/pwa-poc/` | Playwright | PWAライフサイクル(install/offline/update) |
| `tools/record-dashboard-poc/` | Golden Tests | Record Foundation adapter |
| `tools/audit35-1/` | Node静的解析 | AUDIT-35-1原本監査(保全済み) |

---

## 1. 35アプリInventory(§5該当)

`apps-data.json`を基準に`tools/accessibility-audit/build-inventory.js`で機械的に生成(`tools/accessibility-audit/app-inventory.json`、本Phaseで新規作成)。各アプリにつき id/filename/title/category/input配列(touch/keyboard/switch/gaze)/Record Foundation対象可否/PWA Pilot対象可否/`role="dialog"`出現数(共通A11yパネル分を除いたアプリ固有モーダル数)/`<main>`有無/h1数/aria-live有無/localStorage書き込み有無を機械的に収集した。

**確認結果サマリ(全35アプリ)**:
- Total apps: 35(`apps-data.json`と一致)
- `<main>`あり: 35/35、h1=1: 35/35(AUDIT-35で確認済みのProduction状態と整合)
- Switch入力宣言: 27アプリ
- Gaze入力宣言: 15アプリ
- Record Foundation対象: 21アプリ
- PWA Pilot対象: 2アプリ(janken-app, tokei-app)
- アプリ固有モーダル(共通A11yパネルを除く)を1件以上持つアプリ: 18アプリ

**重要な留意点**: `appSpecificModalCount`は`role="dialog"`属性の静的grepに基づく機械集計であり、`role="dialog"`を使わない独自overlay実装(class名のみで判定するモーダル相当UI)を過小カウントする可能性がある(kurabeyou-app/katachi-awase-app/miru-hirogaru-app/mitsukete-touch-app/junban-miyou-app/dotchiga-ii-appの6アプリは4入力モード宣言にもかかわらずmodalCount=0と出ており、要手動確認)。**この数値は層別化の参考値であり、個別アプリのAudit実施時に必ずコードトレースで再確認すること。**

生成物: `tools/accessibility-audit/build-inventory.js`(再現可能スクリプト)・`tools/accessibility-audit/app-inventory.json`(生成結果)。

**[v1.1追記] heading可視性判定の正しい条件(ACCESSIBILITY-AUDIT-PILOT-1で確認)**: 見出し(h1〜h6)がスクリーンリーダーの見出しナビゲーションで実際に到達可能かを実行時DOMで判定する際、`offsetParent !== null`のみ、または`aria-hidden`/`inert`祖先の不在のみ、いずれか単独の条件では誤判定が生じることをPilotで確認した。`opacity:0`+`inert`でモーダルを隠す実装(tokei-app等)は前者だけでは偽陽性(見える扱いになる)、`display:none`でモーダルを隠す実装(okane-app/matching-app等)は後者だけでは偽陽性を生む。**本監査での自動heading構造チェックは、`el.offsetParent !== null && !el.closest('[aria-hidden="true"]') && !el.closest('[inert]')`の両条件を必ず組み合わせること。**(実装例: `tools/accessibility-audit/pilot/browser-check.py`)

---

## 2. WCAG/JIS監査軸(汎用)

Perceivable / Operable / Understandable / Robustの4原則に沿い、以下を監査観点として採用する(本文書では適合宣言を行わず、観点の定義のみ)。

| 原則 | 観点 |
|---|---|
| Perceivable | 代替テキスト、見出し/構造、ランドマーク、ラベル、コントラスト、非テキストコントラスト、zoom、reflow、orientation、感覚的特性への依存、text spacing、画像/アイコンの意味 |
| Operable | キーボード操作、no keyboard trap、フォーカス順序、フォーカス可視化、focus not obscured、bypass blocks、target size、timing、pause/stop/hide、モーション/アニメーション、drag代替、モーダル/オーバーレイのフォーカス挙動 |
| Understandable | ラベル/指示、一貫したナビゲーション、一貫した識別、エラー識別、エラー修正提案、ステータスフィードバック、動的フィードバック、破壊的操作の確認 |
| Robust | セマンティックHTML、name/role/value、ARIA、live region、duplicate id、壊れたARIA参照、妥当な関係性、カスタムコントロール、動的状態の公開 |

---

## 3. どのまな固有監査軸

汎用WCAG/JIS軸に加え、以下を独立した監査軸として設定する。

- **Touch** / **Keyboard** / **Switch Scan** / **Gaze Accessibility** — 特に「Touchでは使えるがSwitch/Gaze/Keyboardでは同等操作できない」という**Input間格差**を横断的に監査できるよう、finding registerに`input_mode`フィールドを持たせる(§13参照)。
- **Record Foundation**(21アプリ) — localStorage設計・記録モーダルのアクセシビリティ・CSV等の書き出し操作
- **PWA accessibility**(janken-app/tokei-app) — install prompt・offline通知・update lifecycleの通知手段がアクセシブルか(SW cache自体はSEO/PWA技術境界として対象外、§9参照)
- **dynamic content** — announce-helper(`donomanaAnnounce`)・aria-live領域の使用実態
- **modal / overlay** — `donomana-modal-accessibility-spec-v1_0.md`のM/R/C/U分類を継承
- **fullscreen** — `donomanaFsBtn`・アプリ独自fullscreen実装(FS_SKIP_APPS 18件)
- **A11y panel** — 共通アクセシビリティパネルとの相互作用(全アプリ共通)
- **learning feedback / reward・完了演出** — 称賛/完了モーダルの正式要件(modal-accessibility-spec §21-3、未決定のまま監査対象)
- **drag/swipe操作** — 代替操作の有無(drawing-app、katachi-awase-app等)
- **alternative input equivalence** — 上記Input間格差の総称軸

---

## 4. 自動検証 / 手動検証の役割分担

| 分類 | 項目 |
|---|---|
| **A. Fully Automated** | duplicate id、`<main>`欠落、h1数、壊れたaria-labelledby/aria-controls、tabindex不整合、console/page error、基本的なTab遷移、モーダルopen/close、**モーダルの初期フォーカス移動(open直後に`document.activeElement`がモーダル内かを直接判定可能。[v1.1]元はB分類だったが、ACCESSIBILITY-AUDIT-PILOT-1でPILOT-F1[gaze-keyboard]を実際にこの自動判定だけで検出できたためA分類へ格上げ)**、フォーカス復帰の一部(要素の存在・isConnected判定)、viewport別layout overflow、target sizeの寸法測定、`role="dialog"`等の静的構造走査、**[v1.1]コントラスト計算そのもの(`tools/accessibility-audit/contrast-check.py`で自動化、ただし背景がgradient/画像の場合は判定不能としてC分類へフォールバックする。下記B行および§16参照)** |
| **B. Automated + Manual確認** | フォーカス順序の妥当性(自動で順序は取れるが「妥当か」は人が判断)、focus visible(自動でoutline有無は取れるが視認性は人が判断)、reflow(自動でoverflow検知、崩れの許容可否は人が判断)、**[v1.1]コントラスト(単色背景の場合は自動計算値をManualが最終確認。gradient/画像背景の場合は自動計算不能なためC分類の実質Manual Onlyとなる)**、aria-live(自動で発火検知、内容の分かりやすさは人が判断)、モーダルusability、動的フィードバック、キーボード等価性 |
| **C. Manual Only** | NVDA/VoiceOverの実読み上げ、読み上げ順序の自然さ、Switch実機の操作感、Gaze dwellの操作感、Touch実指操作、アニメーションの体感、学習フィードバックの理解しやすさ、**[v1.1]gradient/画像背景要素のコントラスト実測**(自動ツールは判定不能、DevToolsスポイト等での目視実測が必要) |

この3分類はAUDIT-35-1の「Explicit Limitations」節(実ブラウザ体感・SR・実スイッチ・視線入力を明示的に対象外とした)と整合させたものであり、新しい判断基準ではなく既存の運用を正式化したもの。**[v1.1]** ACCESSIBILITY-AUDIT-PILOT-1の実証により、A/B/C分類自体も固定ではなく実証を通じて調整されるべきものであることが確認された(モーダル初期フォーカスのB→A格上げが実例)。

---

## 5. Playwright環境状況(本セッション確認済み)

| 項目 | 状態 |
|---|---|
| Python Playwright | ✅ 導入済み(`import playwright`成功) |
| Chromium | ✅ 導入済み・起動確認済み(version 151.0.7922.34) |
| Node Playwright | 未確認(既存toolはすべてPython版のみで構成されており、Node版は本プロジェクトで使用実績なし) |
| ローカルHTTP server | `python -m http.server <port> --bind 127.0.0.1 --directory <repo root>`で起動確認済み |
| 既存script動作 | 本Phaseの前段(POST-AUDIT-35-HARDEN-1/-RELEASE)で、この環境構成のまま新規Playwrightスクリプトを作成・実行し90/90 PASSを達成済み。既存tools配下のスクリプトも同一の`sync_playwright()`パターンで書かれており、そのまま動作する見込み(個別の再実行は本Phaseでは行っていない) |

**結論**: 監査専用の追加環境構築は不要。Production側`package.json`等への依存追加は発生していない(Python側はシステムに既存導入済みのものを使うのみ)。

---

## 6. Browser Gate

- **標準**: 全35アプリ Chromium(headless)を必須Gateとする。
- **層別追加**: Edge(Chromiumベースのため大半の挙動はChromiumと共通、追加価値は限定的)・WebKit(Safari相当、iOS実機に近い挙動)は、**Tier 1(§21)の代表アプリのみ**追加実行する層別方式を採用する。全35アプリ×3ブラウザの総当たりはコスト超過のため行わない。
- Playwrightは`p.webkit`/`p.firefox`も同一APIで呼び出し可能(追加ダウンロードが必要な場合あり、これは監査専用ツール側の準備として扱いProductionには影響しない)。

---

## 7. ローカルHTTP Server標準

| 項目 | 定義 |
|---|---|
| 起動directory | リポジトリroot(`for-all-children-to-learn`) |
| port | 監査セッションごとに空きポートを選択(過去実績: 8935〜8938)。固定ポートは指定しない(worktree並行作業と衝突するため) |
| cache影響 | `python -m http.server`はデフォルトでキャッシュ制御ヘッダを付与しないため、ブラウザ側キャッシュが古いHTMLを返す可能性がある。各テスト前に新規`BrowserContext`を使うか`cache-control`を無視するオプションで回避する(既存tools実績あり) |
| Service Worker影響 | **通常アプリ監査時は無関係**(SW登録対象はindex.html/learning-records.html/janken-app.html/tokei-app.html の4ファイルのみ)。この4ファイルを監査する場合はSW登録解除(`context.clear_cookies()`+新規context)を毎回行い、他アプリのテストへ影響させない |
| PWA監査時のorigin条件 | SWは`http://127.0.0.1:<port>/`のoriginに登録されるため、通常HTML監査用serverとPWA監査用serverでportを分離することを推奨(過去のtheme-color-audit実績と同様、既に暗黙的にこの運用) |
| test後のserver停止 | `netstat`でLISTENING PIDを特定し`taskkill`(Windows)。既存Phaseで確立した手順をそのまま踏襲 |

---

## 8. Screen Reader Gate

これまで一貫して「未実施」と明記されてきた領域を正式に定義する。

| OS | 構成 |
|---|---|
| Windows | **NVDA + Chromium系ブラウザ(Edge推奨、donomana本番ユーザーの主要環境に近い)** |
| Apple | **VoiceOver + Safari** |

**全35アプリ×両SRの総当たりは行わない**。代表アプリ(Pilot、§22)でSR検証を実施し、問題発見時のみ同種アプリへ横展開する方式を採用する。SR実機操作はClaude単体では実行できないため、**Manual Only Gate**として人間の実施者(ユーザー、または支援者)が担当し、Claudeは事前にチェックリスト(§9)を用意し結果の記録・分類を支援する運用とする。

---

## 9. NVDA検証チェックリスト(案)

`docs/accessibility/donomana-accessibility-manual-review-checklist-v1_0.md`に詳細化。最低限の確認項目:

ページtitle、h1、heading navigation(Hキー)、landmark navigation(Dキー)、skip-link、ボタンのaccessible name、フォームラベル、カスタムコントロール、モーダルのannouncement、dialog role/title、フォーカス移動、フォーカス復帰、aria-live、ステータスフィードバック、非表示コンテンツの誤読、重複読み上げ、動的更新の検知、Record modal、A11y panel。操作キー(H/D/Tab/Enter/Esc等)もチェックリスト内に明記する。

---

## 10. VoiceOver検証チェックリスト(案)

Rotor(headings/landmarks/controls)、モーダルナビゲーション、フォーカス復帰、aria-live、動的コンテンツ、非表示コンテンツ、フルスクリーン/オーバーレイ、Touch操作との併用。

**端末標準**: 本プロジェクトのユーザー実態(学校現場、iPad中心の利用実績が過去のmake-mockups.py/レスポンシブ基準からも読み取れる)を踏まえ、**iPad Safari + VoiceOverを第一候補**とする。iPhone/Macは補助的な確認に留める(教育現場での主要デバイスがiPadであるため)。

---

## 11. Keyboard Gate

標準Gate: Tab / Shift+Tab / Enter / Space / Escape / Arrow keys(使用しているcustom controlのみ) / Home・End(該当control限定) / focus visible / focus order / no keyboard trap / modal trap / modal close / focus restoration。

Fully Automated(Playwright `page.keyboard`)で大部分をカバー可能。「focus visibleの見た目が十分か」「focus orderが利用者にとって自然か」はManual確認を要する(§4のB分類)。

---

## 12. Switch Gate

対象: Switch入力を宣言する27アプリ。

確認項目: 対象アプリ一覧の固定(§1 Inventoryより)、scan開始、scan移動、select、long press(対応3アプリのみ: kimochi-board/matching-app/bosai-app、`donomana-switch-scan-spec-v1_0.md` §表参照)、modal内scan、modal close時のscan復帰、A11y panelとの競合、非activeな要素の除外、非表示要素の除外。

**役割分離**: Playwrightによる`buildScanItems()`相当のロジック確認(候補リスト・順序、Fully Automated)と、実Blue2等のスイッチデバイスによる操作感(Manual Only)を明確に分ける。既存`tools/matching-modal-switch-scan/`がこの分離の実例。

**既知の限界**: `donomana-switch-scan-spec-v1_0.md`(v1.8)は4アプリの実証のみを根拠とした限定仕様であり、27アプリ全件への一般化はまだ検証されていない。Audit本体でこの検証を拡大することを想定する。

---

## 13. Gaze Gate

対象: Gaze入力を宣言する15アプリ。

確認項目: gaze ON/OFF、dwell time、dwell progress表示、reselection guard、target enlargement、spacing、visual timing、gaze delay、modalとの共存、A11y panel、equivalent operation(他入力方式との等価性)。

Tobii等の実機はManual Only Gateとして扱う。`donomana-gaze-accessibility-standard-v1_0.md`には未解決項目の記録がなく(本Phase調査でgrep一致なし)、比較的成熟した仕様として扱ってよい。

---

## 14. Touch Gate

target size、spacing、accidental activation、drag、swipe、scroll干渉、modal、fullscreen、landscape/portrait。AUDIT-35-FIX-1Fで確立した「実測`getBoundingClientRect()`高さ44px基準」をそのまま踏襲する。

---

## 15. Responsive / Zoom / Reflow Gate

過去実績(AUDIT-35各Fix commitで反復使用)に基づき、以下を標準候補とする。

- 375×667 / 390×844 / 768×1024 / 1280×900 / 200%zoom

追加候補: 320 CSS px相当(WCAG 1.4.10 Reflowの基準値)、landscape。

**層別**: 上記5点は**全35アプリ共通の必須Gate**とする(過去実績でも既に標準化されているため追加コストは小さい)。320px相当とlandscapeは**Tier 1代表アプリのみ**の追加確認とする。

---

## 16. Contrast Gate

text contrast、large text、UIコンポーネントコントラスト、focus indicatorコントラスト、disabled state、selected state、error state。自動ツールは一次スクリーニングとして使用し、**自動判定のみで最終適合判断はしない**(デザイントークン`--dm-color-*`の意図的な選択とその文脈での視認性は人が最終確認する)。

**[v1.1] ツール確定**: `tools/accessibility-audit/contrast-check.py`(ACCESSIBILITY-AUDIT-PREP-2で新規作成)。axe-core等の外部ライブラリは導入せず、WCAG公式のrelative luminance/contrast ratio計算式をPlaywright経由で取得した`getComputedStyle()`の色情報に直接適用する(Production dependency非追加)。

**判定ロジックと既知の限界(Pilot 5アプリでの実証で確認済み)**:
- 通常テキスト4.5:1・大きいテキスト(24px以上、または19px以上でfont-weight700以上)3:1のWCAG AA閾値で判定
- 祖先要素の`background-color`をalpha合成して実効背景色を算出(半透明の背景色ティントを正しく合成しないと誤判定が生じることをmatching-appの`.game-mode-btn.active`[`rgba(232,149,109,.08)`]で確認・修正済み)
- **既知の限界**: `background-image`(`linear-gradient()`等)で表現された背景は自動判定できない(`getComputedStyle().backgroundColor`はgradientを反映しないため)。祖先に`background-image`を持つ要素は`backgroundUnreliable: true`としてPass/Fail判定から除外し、Needs Manual Reviewへ回す(okane-app/tokei-appのグラデーションヘッダーで実例確認)。本監査でこの割合が大きい場合、実pixelサンプリング方式への切り替えを検討する

**Pilot実証結果**: `docs/accessibility/pilot/accessibility-audit-pilot-1-contrast-results.md`参照。5アプリ中4アプリで閾値未達を検出(matching-app 8件・okane-app 3件・gaze-keyboard 2件・timetable-app 3件、tokei-appは信頼できる判定範囲内では0件)。いずれも本Phaseでは修正せず、本監査のFinding Registerへ引き継ぐ。

---

## 17. Severity分類

| 分類 | 定義 |
|---|---|
| **P0 Critical** | 操作不能、学習継続不能、重大なアクセシビリティ遮断 |
| **P1 High** | 主要操作が特定入力方式で利用不可、keyboard trap、モーダル閉鎖不能、重要情報がSRで取得不能、**[v1.1標準化]モーダルopen時の初期フォーカス移動が完全に欠如している場合(SRユーザーへのダイアログ開始通知が実質的に失われるため)** 等 |
| **P2 Medium** | 代替操作はあるが重大な使いづらさ、focus order不整合、不十分なラベル、reflow問題、**[v1.1]コントラスト比不足(通常テキスト4.5:1・大きいテキスト3:1未達、ただし完全に判読不能な組み合わせはP1へ格上げを検討)** 等 |
| **P3 Low** | 軽微な構造・一貫性・説明不足 |

追加タグ(Severityとは独立): `Technical Debt`(既知・原因特定済み)、`Enhancement`(適合ではなく改善提案)、`Needs Manual Review`(自動検出のみで確定できない)。

**[v1.1追記] 初期フォーカス欠如のSeverity標準化の根拠**: ACCESSIBILITY-AUDIT-PILOT-1のPILOT-F1(gaze-keyboard設定モーダル)で、P1/P2の判断に揺れが生じた実例が発生した。「背景がinert化されているためTabで最終的にモーダルへ到達する可能性がある」ことを理由にP2寄りとも考えられたが、「フォーカス移動が起きないこと自体がSRユーザーへの通知欠如に直結する」ことを優先しP1で確定した。本監査でも同種の判断が発生しうるため、ここに標準として明文化する。

---

## 18. Finding管理方式

Findingは以下4軸すべてで追跡可能な構造とする(Finding register、§19参照)。

1. **app単位**(どのアプリで発生したか)
2. **finding family単位**(同一原因が複数アプリに存在する場合、AUDIT-35のF1〜F4方式を踏襲し「共通Finding Family」としてまとめる)
3. **success criterion単位**(WCAG 2.2のどの達成基準に対応するか)
4. **input mode単位**(Touch/Keyboard/Switch/Gazeのどれで発生するか。Input間格差を横断的に把握するため)

---

## 19. Audit成果物構成(案)

配置候補: `docs/accessibility/`(既存の`docs/design-system/`とは目的が異なるため分離)。

| # | 成果物 | 形式 |
|---|---|---|
| 1 | 35アプリInventory | `tools/accessibility-audit/app-inventory.json`(本Phaseで作成済み) + 付随md |
| 2 | Audit matrix | app × success criterion のクロス表(md table or json) |
| 3 | Finding register | 上記4軸を持つ構造化リスト(json推奨、mdでの要約併記) |
| 4 | Manual Review checklist | `docs/accessibility/donomana-accessibility-manual-review-checklist-v1_0.md`(本Phaseで作成) |
| 5 | Browser Gate結果 | Playwright実行ログ・PASS/FAIL集計(既存tools形式踏襲) |
| 6 | Screen Reader結果 | 人間実施者による記録(チェックリスト回答形式) |
| 7 | Input mode結果 | Touch/Keyboard/Switch/Gaze別の横断サマリ |
| 8 | Fix backlog | Severity別・Finding Family別に整理したTODOリスト |
| 9 | Final audit summary | 本計画書と同格の総括文書(Audit完了時に作成) |

---

## 20. Tier分類(35アプリ)

`role="dialog"`件数・入力モード複合度・Record/PWA対象を基準に層別化した(§1の留意点の通り、modal件数は参考値)。

**Tier 1(複雑・高リスク、12アプリ)**: register-app・matching-app・time-timer・mogura-tataki・okane-app・scratch-app・nazorin-print・schedule-app・janken-app・tokei-app・tyushi・gaze-keyboard
(理由: モーダル数が多い/Switch+Gaze+Keyboard等の入力複合/Record Foundation対象/PWA Pilot対象/機微データ標準(communication-history)対象のいずれかに該当)

**Tier 2(一般的な教材、17アプリ)**: hiragana-learn・katakana-app・shiritori2・bosai-app・cup_game・ongaku-app・kimochi-board・drawing-app・directions-app・suji-manabou・kyou-no-kiroku・kurabeyou-app・katachi-awase-app・miru-hirogaru-app・mitsukete-touch-app・junban-miyou-app・dotchiga-ii-app

**Tier 3(単純構造、6アプリ)**: nazori-app・timetable-app・yomikaki-app・sugoroku-app・sst-app・slideshow-sakusei

---

## 21. Pilot候補(5アプリ、コード確認済み)

| アプリ | 選定理由 |
|---|---|
| **matching-app** | modal(8件中6件がアプリ固有)・Switch・複雑UI。AUDIT-35 F2で既に深い監査実績あり |
| **okane-app** | modal・Record・Switch+Gaze+Touch。直近POST-AUDIT-35-HARDEN-1で修正したばかりのため、Auditが新規findingを過検出しないかの検証にも使える |
| **gaze-keyboard** | Gaze対応アプリの中で最も入力が複合(gaze/keyboard/touch/gamepad)、`donomana-communication-history-standard-v1_0.md`の機微データ標準も関わる |
| **tokei-app** | PWA Pilot対象、Record Foundation対象も兼ねる |
| **timetable-app** | 単純教材(touch onlyでmodal無し)、Tier 3の代表としてベースライン確認用 |

---

## 22. Known Issue引き継ぎ(新規findingとして計上しない)

- **register-app**: `pmOpenerEl`によるフォーカス復帰が背景再描画後に`BODY`要素へ退行する既知問題(`donomana-modal-accessibility-spec-v1_0.md` §12.1)。Audit本体で正しい要件を評価・策定する。
- **schedule-app**: H1は存在するがh2〜h6が存在しない(AUDIT-35-H1シリーズで意図的に対象外とした既定路線)。heading hierarchy監査対象として正式に引き継ぐ。
- **modal-accessibility-spec §21未決定事項15件**: フォーカス復帰要件レベル、複数モーダル同時オープン、`inert`と`aria-hidden`併用方針、`role="alertdialog"`基準等。Audit design/modal reviewの対象として引き継ぐ。

これらは本Phaseでは修正しない。

---

## 23. SEO / PWAとの境界

以下はWCAG/JIS Audit本体から分離する(既存の分類C/Dを再確認):

- **SEO**: title整合(register-app/tokei-app/slideshow-sakusei等)、meta description、canonical、sitemap、IndexNow
- **PWA技術**: SW cache、install機構自体、offlineキャッシュ戦略、update lifecycle

ただし、**PWA上のfocus/aria-live/install prompt accessibility**はAccessibility Audit対象に含める(janken-app/tokei-appのPWA Pilot範囲)。

---

## 24. blocking issueの有無

**なし**。POST-AUDIT-35-HARDEN-1-RELEASEまでの全Phaseが正常にClose済みであり、本Phase自体もコード変更を伴わない準備作業として完了できる。

---

## 25. Entry Gate判定

| # | 条件 | 状態 |
|---|---|---|
| 1 | 35アプリInventory固定 | ✅ `tools/accessibility-audit/app-inventory.json` |
| 2 | WCAG/JIS監査軸固定 | ✅ §2 |
| 3 | Browser Gate固定 | ✅ §6(Chromium必須+Tier1層別WebKit) |
| 4 | Keyboard Gate固定 | ✅ §11 |
| 5 | SR Gate固定 | ✅ §8(NVDA+Edge / VoiceOver+iPad Safari、代表アプリ方式) |
| 6 | Switch Gate固定 | ✅ §12 |
| 7 | Gaze Gate固定 | ✅ §13 |
| 8 | Responsive/Reflow Gate固定 | ✅ §15 |
| 9 | Severity定義固定 | ✅ §17 |
| 10 | Audit成果物形式固定 | ✅ §19 |
| 11 | Pilot対象固定 | ✅ §21(matching-app/okane-app/gaze-keyboard/tokei-app/timetable-app) |
| 12 | 自動/手動役割分担固定 | ✅ §4 |

**ACCESSIBILITY-AUDIT-PREP-1 = READY FOR ACCESSIBILITY AUDIT PILOT**

---

## 26. 推定本監査時間

- Pilot Audit(5アプリ、方法論実証): 数日規模(自動検証構築+手動SR/Switch/Gaze実施を含む)
- Tier 1横展開(12アプリ、Pilotの知見を適用): 1〜2週間規模
- Tier 2/3横断監査(23アプリ、確立した方法論の反復適用): 1〜2週間規模
- 総計: 数週間規模(既存見積りPOST-AUDIT-35-TRANSITION-1と同水準)
- **[v1.1]** ACCESSIBILITY-AUDIT-PILOT-1での再見積り: 自動検証部分は「script開発1回→35アプリへほぼ線形コストで適用可能」と判明し数時間〜1日規模へ短縮見込み。実質的なクリティカルパスはSR/実機検証(人間の稼働時間依存)であり、Tier1/Tier2-3の見積り自体は変更なし。

---

## 27. Test Helper候補(ゲーム進行系modalへの到達手段、[v1.1]新設)

ACCESSIBILITY-AUDIT-PILOT-1で、matching-appのvs-result-ov/clear-ov(対戦結果・クリア画面)は実プレイ進行が必要なため自動到達できず、Needs Manual Reviewとして除外した。本監査でも同種のアプリ(ゲーム性のある教材でのクリア/結果画面)が想定されるため、以下を検討事項として記録する(本Phaseでは設計のみ、実装しない)。

- 候補: 各アプリの内部state変数(matching-appの`vsPlayers`配列等)を直接操作し、結果表示関数(`showVsResult()`等)を直接呼び出すテストヘルパーの追加
- 懸念: アプリごとに内部実装が異なるため汎用化が難しく、Fully Automated化のコストがリターンに見合うか個別に判断が必要
- 代替案: 該当モーダルはManual Reviewの範囲に留め、Automated範囲を「静的に到達可能なモーダル」に限定し続ける(Pilotの実施方針を維持)

**判断は本監査開始時に個別アプリごとに行う。全アプリ一律の方針は定めない。**

---

## 28. Full Audit Entry Gate 再判定(ACCESSIBILITY-AUDIT-PREP-2時点、[v1.1]新設)

ACCESSIBILITY-AUDIT-PILOT-1のExit Gate(15項目)のうち唯一未達だった「#6 Contrast Gate実行」を、本Phase(ACCESSIBILITY-AUDIT-PREP-2)で`tools/accessibility-audit/contrast-check.py`の新規作成・Pilot 5アプリでの実証により解消した。

| # | Pilot Exit Gate項目(15項目) | PREP-2時点の状態 |
|---|---|---|
| 1〜5, 7〜15 | (Pilot summary参照、いずれもPilotで既に✅) | ✅ 変更なし |
| 6 | Contrast Gate実行 | ✅ **解消**(`contrast-check.py`実装・Pilot 5アプリで実証、`docs/accessibility/pilot/accessibility-audit-pilot-1-contrast-results.md`参照) |

**15項目中15項目クリア。**

あわせて、§25(ACCESSIBILITY-AUDIT-PREP-1時点のEntry Gate、12項目)も全項目✅のまま維持されていることを再確認した(§25の内容は変更なし、歴史的記録として保持)。

**ACCESSIBILITY-AUDIT-PREP-2 = READY FOR WCAG/JIS FULL AUDIT**

ただし、Contrast Gate toolは「gradient/画像背景を判定不能として除外する」という既知の限界を持つ(§16参照)。本監査の初期(Tier1着手時)にこの除外率が実運用上問題になるレベルか再評価し、必要であれば実pixelサンプリング方式への切り替えを検討することを、Full Audit側の初期タスクとして引き継ぐ。

---

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PREP-1。WCAG/JIS Accessibility Audit本体着手前の準備・方法設計として初版作成。Entry Gate判定 = READY FOR ACCESSIBILITY AUDIT PILOT。 |
| v1.1 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PREP-2。ACCESSIBILITY-AUDIT-PILOT-1の実証結果を反映: (1)heading可視性判定条件を`offsetParent`+`aria-hidden`/`inert`祖先除外の組み合わせへ正式化(§1)、(2)モーダル初期フォーカス確認をB→A(Fully Automated)へ格上げ(§4)、(3)Contrast Gate tool(`contrast-check.py`)を新規実装しPilot 5アプリで実証、gradient/画像背景の既知の限界を明記(§16)、(4)初期フォーカス欠如のSeverity(P1)を標準化(§17)、(5)ゲーム進行系modalのtest helper候補を検討事項として追加(§27新設)。Full Audit Entry Gateを再判定し15/15達成、判定 = READY FOR WCAG/JIS FULL AUDIT(§28新設)。 |
