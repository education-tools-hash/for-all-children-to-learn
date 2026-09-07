# WCAG-JIS-AUDIT-1-TIER2: Finding Register

- 分類基準: `donomana-wcag-jis-audit-plan-v1_0.md` v1.1 §17(Severity)・§18(4軸管理: app / finding family / WCAG観点 / input mode)
- Tier1で確立したFinding Family(FT-1・FT-2・Contrast・Focus Restoration・Spec Decision Required)へ可能な限り統合し、新規Familyは真に新規のパターンのみ追加した(Phase方針§18準拠)。
- 本Auditでは**発見してもコードを修正しない**。

---

## TIER2-F1(Finding Family: FT-1 — Modal Focus TrapにA11yパネル対応例外がない)

| 項目 | 内容 |
|---|---|
| Finding Family | FT-1: Focus Trap lacks A11y-panel-aware exception(TIER1-F2と同一Family) |
| Apps | shiritori2(record-modal-backdrop)・bosai-app(help-modal)・ongaku-app(modal-help) |
| Severity | **P2 Medium** |
| WCAG観点 | Operable 2.1.2(キーボードトラップなし、逆方向の欠陥)、2.4.3(フォーカス順序) |
| Input Mode | Keyboard, Screen Reader |
| Automated/Manual | Automated(コード直接確認、全件grep+目視) |
| Reproduction | 各アプリで対象モーダルを開いた状態で共通A11yパネルを開き、パネル内でTabを押す |
| Expected | matching-app/okane-app/gaze-keyboard(settingsModal)/schedule-appと同様、フォーカスがA11yパネル内に留まる |
| Actual | 3アプリともTab handlerが`donomanaA11yPanel`の状態を一切参照しない(shiritori2.html:2038-2046、bosai-app.html:2377-2384、ongaku-app.html:2810-2817) |
| Evidence | 上記3アプリのソースコード該当行 |
| Known/New | New(Tier1のFT-1がTier2にも17アプリ中3アプリ(18%)で再発することを確認) |
| Fix candidate | okane-app/matching-app/gaze-keyboard(settingsModal)で実証済みの条件式をそのまま横展開 |
| Spec decision required | なし(既に確立済みパターンの横展開のみ) |
| 横展開候補 | Tier3でも同一パターンでの横断チェックを推奨 |

---

## TIER2-F2(Finding Family: FT-2 — Modal Focus Trapが存在しない)

| 項目 | 内容 |
|---|---|
| Finding Family | FT-2: No Focus Trap implementation(TIER1-F3と同一Family) |
| Apps | hiragana-learn(traceSampleViewer)・katakana-app(traceSampleViewer、共通実装)・cup_game(helpModal)・ongaku-app(modal-pin・modal-export・modal-share) |
| Severity | **P2 Medium** |
| WCAG観点 | Robust(dialogのrole/state expectation)、Operable 2.4.3 |
| Input Mode | Keyboard |
| Automated/Manual | Automated(コード全件grep、Tab-key handlerの不在を直接確認) |
| Reproduction | 各アプリのモーダルを開き、Tabを繰り返し押す |
| Expected | フォーカスがモーダル内に留まる、または意図的な代替設計がある |
| Actual | Tabキーによるフォーカス制御が一切実装されておらず、背景要素へ自由に移動できる。**ongaku-appのmodal-pin/modal-export/modal-shareの3件はrole="dialog"自体も未付与**(modal-helpにのみ新規実装されたことがコード内コメントで明記されている、ongaku-app.html:1301-1303, 2785-2787) |
| Evidence | `tools/accessibility-audit/tier2/static-audit-results.json`(該当4アプリで`tabKeyHandlerMentions`のうちmodal-trap用が0件であることをコード直接確認)、ongaku-app.html:1270,1768,1807(role属性なし) |
| Known/New | New |
| Fix candidate | 既存の確立済みFocus Trapパターン(okane-app方式またはtokei-app方式)を新規実装。TIER1-F3同様、単なる横展開ではなく構造判断を伴う |
| Spec decision required | 実装方式(TIER1-F6の解消と合わせて決定)。ongaku-appのmodal-pin/export/shareはrole="dialog"付与自体から必要なため、他3アプリよりコスト大 |
| 横展開候補 | Tier3でも同様の横断チェックを推奨 |

---

## TIER2-F3(新規Finding Family: Modal Initial Focus Missing)

| 項目 | 内容 |
|---|---|
| Finding Family | Initial Focus Missing(Audit plan v1.1で「missing initial focus」はP1に標準化済みの基準を適用。新規Family名だが判定基準自体は既存のPILOT-F1/NEW-KNOWN-1と同型) |
| Apps | cup_game(helpModal)・ongaku-app(modal-pin・modal-export・modal-share) |
| Severity | **P1 High**(Audit plan v1.1標準:初期focus欠如はP1) |
| WCAG観点 | Operable 2.4.3(フォーカス順序)、Perceivable 1.3.1 |
| Input Mode | Keyboard, Screen Reader, Switch |
| Automated/Manual | Automated(コード直接確認: open関数内に`.focus()`呼び出しが一切ないことを確認) |
| Reproduction | 各モーダルをキーボード/switchで開く |
| Expected | モーダルを開いた瞬間、モーダル内(タイトル等)へフォーカスが移動する |
| Actual | cup_game.html:1331-1335(openHelp)、ongaku-app.html:2781(showPinModal)/4092(openExport相当)/5232(openShare相当)のいずれも`.focus()`呼び出しが存在せず、フォーカスはモーダルを開いたトリガーボタン上に留まったままになる |
| Evidence | 上記該当行の直接コード確認 |
| Known/New | New。ただし判定基準自体はPILOT-F1(gaze-keyboard、HARDEN-2-RELEASEで解消済み)と同型 |
| Fix candidate | PILOT-F1/NEW-KNOWN-1の修正パターン(タイトル要素に`tabindex="-1"`を付与し開時に`.focus()`)をそのまま横展開可能 |
| Spec decision required | なし |
| 横展開候補 | Tier3でも横断チェックを推奨。Tier1側にも同型の再点検余地がある可能性(本Auditでは対象外) |

---

## TIER2-F4(Finding Family: Contrast)

| 項目 | 内容 |
|---|---|
| Finding Family | Contrast(WCAG 1.4.3/1.4.11、TIER1-F4と同一Family) |
| Apps | cup_game(2)・ongaku-app(1)・kimochi-board(9)・drawing-app(1)・katachi-awase-app(2) ※( )内は信頼できる判定でのfail件数、合計15件 |
| Severity | **P3 Low**(全件ratio 2.0以上のため、Tier1の分類基準でP3) |
| WCAG観点 | Perceivable 1.4.3(コントラスト最低限) |
| Input Mode | 低視力・弱視ユーザー全般 |
| Automated/Manual | Automated(一次スクリーニング)、最終判断はManual |
| Evidence | `tools/accessibility-audit/tier2/contrast-results.json`、要約は`tier2-contrast-results.md` |
| Known/New | New |
| Fix candidate | kimochi-boardのアイコンボタン(×/−/＋)・グレー系説明文が特に集中しており、デザイントークン単位での見直しを推奨 |
| Spec decision required | TIER1-F4と共通のデザイントークン正式コントラスト基準策定に合流 |
| 特記事項 | Tier2は10/17アプリでページ全体のgradient背景を採用しており、Contrast Gateの自動カバレッジがTier1より大幅に低い(詳細`tier2-contrast-results.md`)。この10アプリのManual Review優先度を上げることを推奨 |

---

## TIER2-F5(新規Finding Family: Reflow / 200%Zoom時の横スクロール発生)

| 項目 | 内容 |
|---|---|
| Finding Family | Reflow Overflow(新規。Tier1では0件だったため未確立だったFamily) |
| App | drawing-app |
| Severity | **P2 Medium** |
| WCAG観点 | Perceivable 1.4.10(リフロー) |
| Input Mode | 低視力・弱視ユーザー(拡大表示利用者) |
| Automated/Manual | Automated(Playwright、`document.body.style.zoom="200%"`条件下でのscrollWidth比較) |
| Reproduction | drawing-app.htmlを1280×900で開き、200%ズームを適用する |
| Expected | 200%ズームでも横スクロールが発生しない(コンテンツが折り返し/縮小される) |
| Actual | `#canvas-wrap`とその子である3枚の`<canvas>`(`#bg-canvas`/`#draw-canvas`/`#overlay-canvas`)がズーム後も2340pxの固定サイズのまま追従せず、`#topbar`/`#main-row`ごと2560px幅に押し広げられ横スクロールが発生する |
| Evidence | `tools/accessibility-audit/tier2/browser-audit-results.json` → drawing-app.viewport_overflow["1280x900_200pct_zoom"]=true。コード確認: drawing-app.html:1502-1508(`resize()`はwrapの`clientWidth`/`clientHeight`を読むが、CSS zoom変更はwindowの`resize`イベントを発火させないため再計算が走らない) |
| Known/New | New |
| Fix candidate | `resize()`をCSS zoomの変更でも再実行させる(`ResizeObserver`を`canvas-wrap`自体に付与する等)ことで解消できる可能性が高い。他Tier1のcanvas利用アプリ(mogura-tataki・scratch-app・nazorin-print)は同条件で0件だったため、drawing-app固有の実装差異と考えられる |
| Spec decision required | なし |
| 横展開候補 | Tier3のcanvas系アプリでも同条件チェックを推奨 |

---

## TIER2-F6(新規Finding: 存在しないidへのaria-labelledby参照によるスイッチスキャン設定の無名化)

| 項目 | 内容 |
|---|---|
| Finding Family | Broken ARIA Reference(新規。Tier1では0件だったため未確立だったFamily) |
| App | katachi-awase-app |
| Severity | **P1 High** |
| WCAG観点 | Robust 4.1.2(名前・役割・値)、Perceivable 1.3.1(情報及び関係性) |
| Input Mode | Screen Reader、スイッチスキャン利用者 |
| Automated/Manual | Automated(構造監査で`brokenAriaRefs`検出、直接コード確認で実害を確認) |
| Reproduction | katachi-awase-app.htmlの設定パネルでスクリーンリーダーにより「スイッチスキャン」トグルへフォーカスする |
| Expected | `<label for="toggleScan">スイッチスキャン</label>`(katachi-awase-app.html:819)により「スイッチスキャン」という名前が読み上げられる |
| Actual | `#toggleScan`に`aria-labelledby="scanLabel"`が付与されているが(katachi-awase-app.html:820)、id="scanLabel"を持つ要素はページ内に存在しない。アクセシブルネーム計算では存在する`<label for>`より`aria-labelledby`が優先されるため、参照先が解決できないchekcboxは**アクセシブルネームが空になる**可能性が高く、この設定が「まさにスイッチスキャン利用者向けの機能を有効化するトグルそのもの」であることを踏まえると影響度が高い |
| Evidence | katachi-awase-app.html:818-820。`tools/accessibility-audit/tier2/static-audit-results.json`のkatachi-awase-app.brokenAriaRefs |
| Known/New | New |
| Fix candidate | 不要な`aria-labelledby="scanLabel"`属性を削除し、既存の`<label for="toggleScan">`のみに一本化する(1行修正で解消可能) |
| Spec decision required | なし |
| 横展開候補 | 他アプリの`aria-labelledby`/`aria-describedby`等の全参照先が実在するか、Tier3でも同一チェックを推奨(本Auditのstatic-audit.jsでの自動検出手法は再利用可能) |

---

## モーダル背景抑制方式(TIER1-F6への統合)

| 項目 | 内容 |
|---|---|
| 統合先 | TIER1-F6(Spec Decision Required: モーダル背景抑制の実装方式の分裂) |
| 系统B(静的`inert`属性+動的トグル、モーダル自身単位) | shiritori2 |
| 系统D(背景抑制自体が存在しない) | hiragana-learn・katakana-app・bosai-app・cup_game・ongaku-app |
| 判断 | 本Auditでは判断しない。TIER1-F6と合わせてSpec Decision専用の場で正式決定することを推奨 |

---

## 構造監査での誤検知(Findingとして計上しないもの)

| 項目 | 内容 |
|---|---|
| bosai-app: duplicate id `bag-max` | 静的マークアップの`<span id="bag-max">5</span>`(bosai-app.html:2005)と、JSの`count.innerHTML`テンプレート文字列内の同名span(bosai-app.html:2849)を機械的regexが両方カウントしたことによる誤検知。後者は前者の親要素`#bag-count`ごと`innerHTML`で置換するため、実行時に同一idの要素が2つ同時に存在することはない。Tier1で確立済みの「静的regexスキャンはコメント/文字列に対する誤検知が起こりうる」という教訓と同種のケースであり、直接コード確認により実害なしと判断した |

---

## Known Issue引き継ぎ状況

| Finding | 状態 |
|---|---|
| TIER1-F1〜F6 | Tier2側の再発有無は上表の通り確認済み(TIER1-F1相当は0件、TIER1-F2/F3相当はTIER2-F1/F2として再発、TIER1-F4はTIER2-F4として再発、TIER1-F5[Focus Restoration]はTier2の6モーダルアプリいずれも正常でTier2側の再発なし、TIER1-F6はTier2データで拡張) |

## Severity集計

| Severity | 件数 |
|---|---|
| P0 Critical | 0 |
| P1 High | 2(TIER2-F3, TIER2-F6) |
| P2 Medium | 3(TIER2-F1, F2, F5) |
| P3 Low | 1(TIER2-F4、Contrast 15件) |

Technical Debt: 0。Spec Decision Required: 1(TIER1-F6への統合分)。Needs Manual Review: `tier2-manual-review.md`参照。

**AUDIT PILOT BLOCKING FINDING相当(P0操作不能)は0件。**
