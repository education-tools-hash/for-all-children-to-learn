# どのまな 共通A11y Widget Design Contract v1.0

- 版: v1.0（初回起草は2026-10-06、`design/common-a11y-widget-1`branchのままmain未マージで残存。2026-10-08、Phase `COMMON-A11Y-DESIGN-CONTRACT-DOCS-RECONCILIATION-1`により、その間に実施・Production Release済みのPilot/Wave 2/Modal Coexistence Wave A・B/Settings Proxy Gap Fix/Legacy-C opener fixをfresh Production実装に基づき反映し、本docs-only commitでmainへ初めて取り込む。詳細はDeliverable Bの末尾、11章「2026-10-08 Status Update」を参照）
- 起草日: 2026-10-06（本文1〜10章の棚卸し内容。11章のみ2026-10-08追記）
- 位置づけ: `docs/donomana-site-renewal-roadmap-v2.md` §6.1「アクセシビリティ（最優先）」の最初の項目「共通A11y Widget化」に対応する設計文書。Design/Audit Phaseの成果物であり、**1〜10章の起草時点では実装・公開を一切行っていない。11章で追記する範囲は、別の複数Phaseで既にProduction Release済みの事実を遡って反映するものであり、本docs-only Phase自体はコード変更を一切行っていない。**
- 根拠: 1〜10章は`origin/main`（fresh確認SHA: `3576feb4f77c69a6075f357d191b3b7cb9250c8d`）の`generate.js`・各アプリHTML・`apps-data.json`（37アプリ全件）の直接確認、および既存の承認済み仕様書群（1章参照）。11章は`origin/main`（fresh確認SHA: `3e5e716bc0f6530b5396c90d5b3f26fc47014a2b`）の同範囲の再確認に基づく。
- 既存文書との関係: 本書は既存仕様書を要約・複製しない。新規に判断が必要な部分（Progressive Migration・Pilot提案・Adapter境界の正式契約化）のみを追加する。既存の承認済み決定（PINロックはDesign System §7.6.3の例外、Switch Scanは命名統一を要求しない等）を上書きしない。なお`docs/accessibility/`配下の`donomana-a11y-panel-keyboard-contract-v1_0.md`・`a11y-panel-global-conformance-matrix.md`は本書と主題が重なる別系統の文書（35アプリ時点、`mogura-tataki`等のReference命名）であり、本書とは未統合のまま並存している。本Phaseはこの2系統の統合を行わない（11.6章参照）。

---

## 0. 重要な前提の訂正（正本ロードマップ Ver.2.1 §6.1 との差分）

正本ロードマップ§6.1は「共通A11y Widget化（29アプリ共通の設定パネル基盤設計。独立フェーズとして扱う）」を**今後の**最優先項目として記載している。しかし本Phaseの現状確認により、この記述は**2026-07時点の状況のまま更新されておらず、現在のremote mainの実態と一致しない**ことが判明した。

**実際の現状（2026-10-06、`3576feb`確認）:**

1. 共通A11yパネル自体（起動ボタン・パネル本体・ハイコントラスト・文字サイズ・読み上げトグル・Escape閉じる・外側クリック閉じる）は、**37アプリ全てで`generate.js`の`buildA11yPanelHTML()`により既に完全に共通化されている**。これはゼロから設計する項目ではなく、**既に本番稼働中の実装**である。
2. `WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1`監査（`a11y-panel-global-conformance-matrix.md`）とその後のGLOBAL-1A実装（commit `837d454`ほか、Production Released）により、Tab/Shift+Tab strict containment用の共通helper（`trapA11yPanelFocus`/`restoreA11yPanelFocus`/`getA11yPanelFocusables`）も既に全アプリへ注入済みである。
3. ただし、この共通helperを実際に自アプリのキーボード処理へ**接続（wire）するかどうかは、各アプリが個別に実装する必要がある**（helperの「存在」と「有効化」が意図的に分離されている設計）。本Phaseの再調査で、**37アプリ中7アプリのみが実際に接続済み**であることを確認した（3章）。
4. Switch Scan（`donomana-switch-scan-spec-v1_0.md` v1.8）・視線入力（`donomana-gaze-accessibility-standard-v1_0.md` v1.0改訂5）は、いずれも**コードレベルの統一を要求しない**という設計判断が既に承認済みである。これらは「今後共通化する」対象ではなく、「挙動の契約（behavioral contract）は統一し、実装方式は各アプリの裁量を残す」という既に確定した方針のもとで運用されている。
5. PINロック・画面ロックは、`donomana-design-system-v2_0.html`（内部版Ver.2.1）§7.6.3によりモーダル禁止方針の**明示的な例外**として扱われており、アプリごとの実装がそもそも標準。共通Widgetへ統合する対象ではない。

**したがって、本Design Contractが実際に設計すべき残課題は、「共通パネル基盤をゼロから作る」ことではなく、以下の2点に絞られる：**

- **(a) 既に存在する共通helperの接続率を上げる**（Strict Containment Wave展開。7/37→37/37への道筋）
- **(b) Adapter境界（SETTINGS_PROXY）の形式化と、未接続アプリ2件の穴埋め**（4章・5.5章）

この訂正は正本ロードマップの優先順位そのものを変更するものではない（アクセシビリティは引き続き最優先）。ただし「何を新しく作るか」ではなく「既にあるものの接続率をどう上げるか」という、より小さく安全なスコープへ補正する。

---

## 1. 現状棚卸しレポート（Deliverable A）

### 1.1 対象アプリ件数

`apps-data.json`（`origin/main` `3576feb`）登録件数: **37件**（`node -e`相当のPython集計で直接カウント、推測なし）。

旧ロードマップの「29アプリ」は2026-07時点のスナップショットであり、現在の37件とは8件の差がある。既存監査文書`a11y-panel-global-conformance-matrix.md`は35アプリを対象としており、**現在の37件との差は2件（`sawatte-hirogaru-app`・`sakana-tsuri`）**。この2件は本Phaseで個別に確認した（3.2章）。

孤立ページ・管理用ページ（`app-register.html`・`googlec01fd6375de401c5.html`等）は`apps-data.json`に登録されていない別カテゴリであり、本調査の対象外（正本ロードマップ2章で既に「除外」と整理済み）。

### 1.2 A11y Widget実装状況（共通部分）

37アプリ全件が以下を共通装備している（`generate.js`の`buildA11yPanelHTML()`が生成、手動編集不可）：

| 要素 | 内容 | 共通化状態 |
|---|---|---|
| 起動ボタン `#donomanaA11yBtn` | 固定位置(bottom:16px;right:16px)、`class="scannable" data-scan="1"`、`aria-expanded`/`aria-controls` | ✅ 37/37共通 |
| パネル本体 `#donomanaA11yPanel` | `role="dialog"` `aria-label` | ✅ 37/37共通 |
| 表示モード（ハイコントラスト） | `document.documentElement.style.filter = invert(1) hue-rotate(180deg)` | ✅ 37/37共通 |
| 文字の大きさ（標準/大/特大） | `document.body.style.zoom` | ✅ 37/37共通 |
| 読み上げON/OFF（任意） | `includeSR`フラグで含むアプリのみ | ✅ 含む場合は共通実装 |
| Escapeで閉じる＋opener復帰 | `restoreA11yPanelFocus()` | ✅ 37/37共通（GLOBAL-1A以降） |
| 外側クリックで閉じる | — | ✅ 37/37共通 |
| リセットボタン | localStorage全キー削除 | ✅ 37/37共通 |
| Settings Proxy（アプリ固有設定への橋渡し） | `SETTINGS_PROXY`マップ | 🟡 33/37（4.4章） |
| Tab/Shift+Tab strict containment | `trapA11yPanelFocus()`の**実際の接続** | 🔴 7/37のみ（3章） |

### 1.3 実装Pattern数

本Phaseでの再調査により、**6つのPattern（Family）**に分類した（3章で詳細）。旧監査の5分類（A/B/C/D/E、Fは該当なし）に対し、現在はA（7件）・legacy C相当（2件）・D-1（3件）・D-2（5件）・D-3（20件）の実質5分類＋新規2アプリの再分類により構成が変化している。

### 1.4 主要な発見

1. **Strict containment接続率は7/37（約19%）** であり、旧監査時点（GLOBAL-1A後の5/35）から、新規アプリ2件（`sawatte-hirogaru-app`・`sakana-tsuri`）が最初から接続済みの状態で公開されたことにより向上した。**新規アプリは既に正しいPatternで作られている**ことが確認できた点は良い兆候である。
2. **`katakana-app`・`hiragana-learn`は、GLOBAL-1A後も独自cluster実装（opener含む、Family C相当）のままで、共通helperへ移行していない。** 既存のGLOBAL-1B計画（未着手）がこの2件を対象としていた。
3. **Settings Proxyの登録漏れが2件存在する**: `timetable-app`（`#sec-settings`という独自設定タブを持つが`SETTINGS_PROXY`未登録）、`ongaku-app`（PIN保護された`#btn-teacher-settings`を持つが未登録）。`tokei-app`・`nazorin-print`は独自設定パネルを持たないため未登録は正しい（除外漏れではない）。
4. **PINロック・画面ロックは意図的に非共通**（Design System §7.6.3の承認済み例外）。`bosai-app`（教師用PIN）・`sugoroku-app`・`tyushi`・`time-timer`・`mogura-tataki`・`sst-app`・`scratch-app`等、アプリごとに個別実装。共通Widgetへ統合すべきという結論には至らない（9章参照）。
5. **Switch Scan対応は29/37アプリ、視線入力対応は15/37アプリ**（`apps-data.json`の`a11y`フィールド文字列ベース集計。ただし自動走査型と単純キーボード対応を区別しない広義の数値であり、`donomana-switch-scan-spec-v1_0.md` §1.5が既に指摘する通り、これを自動走査型の確定数と断定しない）。
6. **見た目が同じでもJS挙動が違う例**: `katakana-app`と`hiragana-learn`は完全同一実装（Family C、意図的な重複）だが、`schedule-app`は同じく旧Family C的な外見だったものがGLOBAL-1Aで共通helperへ完全移行済み（Family A）。外見のみでは判別できない。

### 1.5 高リスク箇所

- **`katakana-app`/`hiragana-learn`のcluster実装は、opener自身をTab循環に含めてしまう既知の非準拠状態**（旧監査でFamily C、🟡Partial）。実装変更なしに放置した場合、Strict Containment Wave展開時にも個別対応が必要（一括置換では解決しない）。
- **`timetable-app`のSettings Proxy欠落**は、旧全35アプリ監査で指摘された「唯一browser chromeへのescapeを実機確認した」`timetable-app`（Severity P1）と同一アプリであり、この2つの既知課題は無関係ではなく同じアプリに集中している。優先度が高い。
- **D-1（guard-only）3アプリ（`okane-app`・`matching-app`・`ongaku-app`）は、自前のModal Focus Trapを持ちながらA11yパネル自体のcontainmentを提供しない**。Modal Coexistence(優先順位分岐)の実装を伴わないまま共通helperを単純に接続すると、両方のTrapが同時に発火し競合する可能性があり、個別のAdapter実装が必要（5.5章）。

---

## 2. 対象アプリ一覧（Deliverable Aの詳細）

`apps-data.json`から直接取得（37件、`filename`順）。a11yタグはSwitch(🔘スイッチ関連文字列を含む)・Gaze(👁視線関連文字列を含む)の有無のみ要約する（元の詳細タグは`apps-data.json`参照）。

| filename | id | category | Switch | Gaze |
|---|---|---|---|---|
| hiragana-learn | hiragana-learn | 学習アプリ | ○ | — |
| katakana-app | katakana-app | 学習アプリ | ○ | — |
| nazori-app | nazori-app | 学習アプリ | ○ | — |
| nazorin-print | nazorin-print | 学習アプリ | — | — |
| janken-app | janken-app | 認知支援 | ○ | — |
| shiritori2 | shiritori2 | 学習アプリ | ○ | — |
| okane-app | okane-app | 学習アプリ | ○ | ○ |
| register-app | register-app | 学習アプリ | ○ | — |
| tokei-app | tokei-app | 学習アプリ | ○ | — |
| schedule-app | schedule-app | 自立活動 | ○ | — |
| timetable-app | timetable-app | 学習アプリ | — | — |
| yomikaki-app | yomikaki-app | 学習アプリ | — | — |
| bosai-app | bosai-app | 学習アプリ | ○ | — |
| matching-app | matching-app | 認知支援 | ○ | — |
| sugoroku-app | sugoroku-app | 認知支援 | ○ | — |
| tyushi | tyushi | 自立活動 | ○(※1.4節参照) | ○ |
| cup_game | cup_game | 認知支援 | ○ | ○ |
| sst-app | sst-app | 自立活動 | — | — |
| kimochi-board | kimochi-board | 自立活動 | ○ | ○ |
| drawing-app | drawing-app | 創作表現 | — | ○ |
| slideshow-sakusei | slideshow-sakusei | 創作表現 | — | — |
| directions-app | directions-app | 学習アプリ | ○ | — |
| time-timer | time-timer | 自立活動 | ○ | — |
| suji-manabou | suji-manabou | 学習アプリ | ○ | — |
| kyou-no-kiroku | kyou-no-kiroku | 自立活動 | ○ | ○ |
| scratch-app | scratch-app | 自立活動 | — | ○ |
| gaze-keyboard | gaze-keyboard | 自立活動 | ○ | ○ |
| mogura-tataki | mogura-tataki | 自立活動 | ○(※1.4節参照) | ○ |
| ongaku-app | ongaku-app | 創作表現 | ○ | — |
| kurabeyou-app | kurabeyou-app | 学習アプリ | ○ | ○ |
| katachi-awase-app | katachi-awase-app | 学習アプリ | ○ | ○ |
| miru-hirogaru-app | miru-hirogaru-app | 認知支援 | ○ | ○ |
| mitsukete-touch-app | mitsukete-touch-app | 認知支援 | ○ | ○ |
| junban-miyou-app | junban-miyou-app | 認知支援 | ○ | ○ |
| dotchiga-ii-app | dotchiga-ii | 認知支援 | ○ | ○ |
| sawatte-hirogaru-app | sawatte-hirogaru-app | 認知支援 | ○ | ○ |
| sakana-tsuri | sakana-tsuri | 自立活動 | ○ | — |

※1.4節: `tyushi`の「スイッチ」表記はひかるボタン明滅演出の変数名`scanOn`等を含むが、`donomana-switch-scan-spec-v1_0.md` §1.4区分3「scanという名称を使うが対象外の実装」に該当し、自動走査型Switch Scanではない。`mogura-tataki`の「キーボード操作対応（スイッチ入力にも対応）」表記も、自動走査型かKeyboard Activation対応かは同仕様書が確定数値化を留保している（1.4節）。本表の○は`apps-data.json`の広義表記に基づく機械集計であり、過大評価のリスクを明記する。

集計: Switch広義○ = 29/37、Gaze○ = 15/37（Pythonで`apps-data.json`から直接集計、推測なし）。

---

## 3. 実装パターン分類（Deliverable Aの核心、Pattern C）

### 3.1 分類方法

本Phaseでは、全37アプリのHTMLソース（`origin/main`）に対し、以下を機械的に確認した：

1. `trapA11yPanelFocus(e)`という呼び出し文字列の出現回数（共通layerの定義自体を除いた**追加の呼び出し箇所数**）→ Strict Containment接続有無の直接証拠
2. `generate.js`の`SETTINGS_PROXY`マップへの登録有無 → Adapter接続有無の直接証拠
3. 既存監査文書（`a11y-panel-global-conformance-matrix.md`、35アプリ時点）との差分比較 → Family分類の継承・更新

この方法は「過去に29アプリを監査したから現在も同じ」という仮定を避け、現在のソースを直接確認した結果のみを採用する。

### 3.2 Family分類（37アプリ、現在のmain基準）

| Family | 定義 | 該当数 | 該当アプリ |
|---|---|---|---|
| **A（Reference / Wired）** | 共通helper(`trapA11yPanelFocus`)を実際に接続済み。Strict Containment Conformant | **7** | `mogura-tataki`・`tyushi`・`cup_game`・`schedule-app`・`gaze-keyboard`（GLOBAL-1A Pilot、Production Released）／`sawatte-hirogaru-app`・`sakana-tsuri`（新規アプリ、開発時点から接続済みで公開。本Phaseで新規確認） |
| **Legacy-C（独自cluster、opener含む）** | 共通helperへ未移行。独自のcluster実装がopener自身をTab循環に含める非準拠状態 | **2** | `katakana-app`・`hiragana-learn`（完全同一実装） |
| **D-1（guard-only）** | 自前Modal Focus Trap内に「A11yパネルOPEN中はTrap無効化」というguardのみ。A11yパネル自体のcontainmentなし | **3** | `okane-app`・`matching-app`・`ongaku-app` |
| **D-2（escape-only defer）** | 独自Escapeハンドラで委譲するのみ。**[2026-10-08追記・訂正: 「Tab処理はA11yパネルを意識しない」という当初の記述は不正確だった。5アプリ全てが実際には自前のapp固有modal用Tab Focus Trapを既に持っており、A11yパネルとの同時open時にTrapが競合する構造的リスクを抱えていた。詳細は11.2章]** | **5** | `nazorin-print`・`shiritori2`・`tokei-app`・`janken-app`・`bosai-app` |
| **D-3（baseline）** | A11yパネルを意識したコードが一切存在しない。共通層のhelperが注入されているが未呼び出し | **20** | `nazori-app`・`register-app`・`timetable-app`・`yomikaki-app`・`sugoroku-app`・`sst-app`・`kimochi-board`・`drawing-app`・`slideshow-sakusei`・`directions-app`・`time-timer`・`suji-manabou`・`kyou-no-kiroku`・`scratch-app`・`kurabeyou-app`・`katachi-awase-app`・`miru-hirogaru-app`・`mitsukete-touch-app`・`junban-miyou-app`・`dotchiga-ii-app` |

合計: 7+2+3+5+20 = **37**（内訳の合計が対象アプリ件数と一致することを確認済み）。

### 3.3 Family別の特徴と回帰リスク

| Family | 共通構造 | 差分 | 共通化難易度 | 回帰リスク |
|---|---|---|---|---|
| A | 共通helperを呼ぶ1行のTab listenerを追加済み | なし（既に統一パターン） | — (完了) | 低（既にProduction実績あり） |
| Legacy-C | 独自cluster配列を構築し、内部でTab循環を自前実装 | opener(`donomanaA11yBtn`自身)をcluster要素として含めてしまっている | 中（既存の独自実装を置き換える必要があり、2アプリの既存回帰テストと要調整） | 中（既存のcluster実装はこの2アプリで動作確認済みのため、置き換え時の再検証が必要） |
| D-1 | 自前Modal Focus Trapが存在し、A11yパネルopen中はTrapを`return`で無効化 | Modal Coexistence（優先順位分岐）の実装が必要 | 中（Trapとの競合を避ける薄いadapter関数が必要、5.5章） | 中（自前Modalとの同時open時の挙動検証が必須） |
| D-2 | 独自Escapeハンドラのみ、Tab処理はノータッチ | Escapeは既に共通層が処理するため実質的に追加実装は少ない | 低（Tab listener1行の追加のみで完結するケースが多い） | 低〜中（アプリ固有のEscape処理との重複確認が必要） |
| D-3 | アプリ側にA11yパネル関連コードが存在しない | 共通helperを呼ぶだけで完結（単一画面型アプリが多い） | **低**（最も安全に横展開できる層） | 低（Modal自体を持たないアプリが多く、競合要因が少ない） |

**見た目が似ていてもJS挙動が違うケースの具体例**: `schedule-app`（Family A）と`katakana-app`/`hiragana-learn`（Legacy-C）は、いずれも元は「独自cluster構築」という同じ外見のアプローチだったが、`schedule-app`はGLOBAL-1AでAdapter経由の共通helper呼び出しへ完全移行済みであるのに対し、`katakana-app`/`hiragana-learn`は移行前の状態のまま取り残されている。コードを読まずに「3アプリとも同じ実装パターン」と判断すると誤る。

---

## 4. Switch Scan / Gazeとの境界（Scope §4対応）

本PhaseではSwitch Scan共通化・視線入力共通化そのものは実装しない。以下は、既存の承認済み仕様（`donomana-switch-scan-spec-v1_0.md` v1.8、`donomana-gaze-accessibility-standard-v1_0.md` v1.0改訂5）との境界整理である。

### 4.1 Widget起動ボタンをスキャン対象にする方法

既に解決済み: `#donomanaA11yBtn`は`class="scannable" data-scan="1"`を持ち、Strategy A（明示marker方式）を採用する全アプリの候補取得セレクタに自然に含まれる。Strategy B（ネイティブ操作要素包括取得方式）採用アプリも、`<button>`実体であるため自動的に候補へ入る（`donomana-switch-scan-spec-v1_0.md` §3.3）。**新たな設計は不要。既存の2戦略いずれでも自動的に機能する。**

### 4.2 Widget内部の操作要素をスキャン可能にする方法

現状、A11yパネル内部のボタン（表示モード・文字サイズ・読み上げトグル等）は、各アプリの候補取得ロジックのスコープ外になりやすい（パネルは`position:fixed`で`z-index:99998`、アプリ本体のスキャン対象スコープ外に配置されるため）。これが旧監査の「共通パネル内部のボタンへの到達性」課題の技術的実体である。

**設計方針**: Widget内部操作要素のスキャン到達性は、**Strict Containment Wave展開（5章・7章）と同じ共通helperの中で解決する**べきであり、Switch Scan側の候補取得ロジックを個別に変更する必要はない。具体的には、A11yパネルがopenのときはキーボードTab/Shift+Tabに加えて、各アプリのSwitch Scanタイマーも「A11yパネル内部のみを候補とする」モードへ一時的に切り替える、という設計が必要になる（本Phaseでは設計のみ、実装は次Phase）。

### 4.3 Widgetを閉じた後のスキャン復帰位置

既存の`restoreA11yPanelFocus()`がキーボードフォーカスを`#donomanaA11yBtn`へ戻す処理と同じタイミングで、Switch Scan側の「現在のスキャン位置」も`#donomanaA11yBtn`相当の位置（またはパネルを開く直前の位置）へ復帰させる必要がある。アプリごとのスキャン位置変数（`scanIndex`等、命名は不統一）へ直接介入する共通コードは書けないため、**薄いadapter関数（「スキャン位置をNへ設定する」という1関数をアプリ側に実装してもらう）**が必要になる。5.5章のApp Adapter境界と同じ構造。

### 4.4 実フォーカス型スキャンとの競合

`donomana-switch-scan-spec-v1_0.md` §2.1 M2「Switch Scanの走査と、キーボードの通常のTab操作を同時に競合させない」という既存契約がある。A11yパネルのStrict Containment（Tab trap）と、実フォーカスを使うSwitch Scan方式（`hiragana-learn`/`katakana-app`/`suji-manabou`/`tokei-app`等）が同時に有効化されると、2つのフォーカス制御機構が同一の`document.activeElement`を奪い合う可能性がある。**この4アプリは本Design Contractの対象（Family Legacy-C・D-3）でもあり、Strict Containment接続時は個別のModal Coexistence確認（5.5章のadapter設計と同一の考え方）が必須**。

### 4.5 独自scan index方式との競合

同上。アプリ内部のデータ配列index型（`cup_game`のスキャン方式等、`donomana-switch-scan-spec-v1_0.md` §3.3 v1.6追記で言及）は、DOM上のfocus状態と独立した自前state変数でスキャン位置を管理する。この方式はDOM focus管理（Strict Containment）と直接競合しないが、4.3節のスキャン復帰位置の同期は同様に必要。

### 4.6 Blue2等外部スイッチ入力との境界

外部スイッチはOS/ブラウザ側でキーボードイベント（Space/Enter等）として到達する前提（`donomana-switch-scan-spec-v1_0.md` §2.2で確認済みの既存設計）。Strict Containment（Tab trap）はTab/Shift+Tabキーのみを処理し、Space/Enterには介入しないため、**外部スイッチの決定操作そのものとは衝突しない**。ただし4.4節の「走査の自動送り」との競合は上記の通り残る。

### 4.7 キーボード入力との境界

Strict Containmentの対象そのものがキーボード（Tab/Shift+Tab）であるため、最も直接的な関係を持つ。5.2章で正式に定義する。

### 4.8 視線入力との境界

`donomana-gaze-accessibility-standard-v1_0.md` §0 Decision Aにより、「GazeとSwitch Scanは相互排他にしない」「common activation gateで重複activationを防ぐ」という既存の確定方針がある。A11yパネルも同じ原則に従うべきであり、**視線入力のdwell選択操作がA11yパネル起動ボタンに対して行われた場合、通常のクリックと同じ扱いで開閉できる（視線入力は多くのアプリでマウスエミュレーション経由のため、技術的には自然に対応している）**。パネル内部のdwellターゲットサイズ・間隔は、`donomana-gaze-accessibility-standard-v1_0.md` §12・§13のTarget Size/Spacing要件をパネル内ボタンにも適用すべきかは、次Phase（Pilot Implementation）での個別確認が必要（本Design Contractでは設計方針のみ示し、未検証として明記する）。

**実機確認について**: 本章の設計はコード・既存仕様書の確認に基づくものであり、Blue2・Tobii・iPad Safari等でのReal Device Verificationは一切行っていない（Cloud上のコード確認をReal Device Verificationとして扱わないこと、との指示に従う）。

---

## 5. Common A11y Widget Design Contract v1.0（Deliverable B）

### 5.1 UI構造

既存実装（`generate.js` `buildA11yPanelHTML()`）を正式な契約として確定する。**変更を提案する箇所のみ明示し、それ以外は現状維持とする。**

| 要素 | 現状 | 本Contractでの扱い |
|---|---|---|
| Widget launcher | `#donomanaA11yBtn`、固定位置、円形、⚙アイコン | 現状維持。Family全体で統一済み |
| panel / dialog | `#donomanaA11yPanel`、`role="dialog"` | 現状維持。`aria-modal`は付与されていない点は5.2章で議論 |
| heading | パネル内の最初の`<div>`（「⚙ アクセシビリティ設定」、非見出し要素） | **改善候補**: 視覚的heading的要素だが実際には`<h2>`等のheading roleを持たない。本Contractでは現状のまま許容するが、次Phaseでのaccessible name改善時に検討対象とする（5.2章） |
| controls | 表示モード・文字の大きさ・（任意）読み上げ・（任意）proxy行 | 現状維持 |
| close control | 専用のCloseボタンは存在しない。外側クリック／Escapeのみ | **設計判断が必要**: 明示的な❌closeボタンを追加するか、現状の2経路（outside click/Escape）のみで十分とするかは、本Phaseでは決定事項とせず次Phaseでの検討課題として残す（5.2章） |
| optional sections | 読み上げセクション（`includeSR`）・proxy行（`SETTINGS_PROXY`） | 現状維持。両方とも既にApp Adapter境界として機能している（5.5章） |

### 5.2 Accessibility semantics

| 項目 | 現状 | 方針 |
|---|---|---|
| role | `role="dialog"` | 維持 |
| aria-expanded | launcherボタンに付与済み（`aria-expanded="false"`、開閉で切替） | 維持 |
| aria-controls | launcherボタンに`aria-controls="donomanaA11yPanel"` | 維持 |
| dialog使用の是非 | `role="dialog"`だが`aria-modal="true"`は付与されていない（＝non-modalとして扱われる） | **現状維持を推奨**。Design System §7.5のモーダル原則禁止方針と整合させるなら、A11yパネルは「non-modal dialog」（`donomana-help-usage-guide-standard-v1_0.md`のHelp/Usage Guide Standardと同じ非モーダルパターン）として明示的に位置づけるべきであり、`aria-modal="true"`を新たに追加する変更は行わない（背景の操作可能性を奪わない設計を維持） |
| accessible name | `aria-label="アクセシビリティ設定"` | 維持 |
| focus management | 現状: 開く際にフォーカス移動なし（ボタンclickのまま）。閉じる際: Escapeは`restoreA11yPanelFocus()`で明示的復帰、外側クリックは復帰処理なし | **部分的ギャップ**: 外側クリックで閉じた場合、フォーカス位置はクリックした要素のまま変わらない（これは問題ではない、クリックは既にその要素へfocusを与えているため）。開く際に最初のcontrolへfocusを移動する設計は、**強制的なfocus移動はSwitch Scan/Gazeの操作継続性を損なう可能性があるため、本Contractでは採用しない**（現状のボタンfocus維持を推奨） |
| Escape handling | 全37アプリ共通で実装済み | 維持 |
| focus return | `restoreA11yPanelFocus()`、全37アプリに注入済みだが「呼ばれるタイミング」はEscape時のみ（Tab-containment経由で外へ出ようとした場合は3章の通り7アプリのみ） | 7章のWave展開で37/37へ |
| tab order | 現状: 7アプリのみstrict containment。残り30アプリはnative tab orderに依存 | 7章のWave展開対象 |

### 5.3 Input independence

以下の入力方式を壊さない設計を本Contractの必須要件とする。

| 入力方式 | 現状の対応 | 本Contractの要件 |
|---|---|---|
| タッチ | launcher/panel内ボタンは通常の`<button>`、タップで機能 | 変更不要 |
| マウス | クリックで開閉・選択 | 変更不要 |
| キーボード | Tab到達は可能（native order）。Strict Containmentは7/37のみ | Wave展開（7章）で改善。**どのアプリでもキーボード単独で開閉・設定変更・閉じるが完結すること**を必須要件とする |
| スイッチ | `.scannable`マーカー経由でlauncherへは到達可能。**パネル内部への到達は4.2節の既知ギャップ** | 4.2節の設計を次Phaseで実装するまでは「既知の制約」として明記し、隠さない |
| 視線入力 | マウスエミュレーション経由で動作（多くのアプリがdwell→クリックに変換） | 4.8節の通り、Target Size/Spacing要件の適用可否は未検証として次Phaseへ持ち越す |

**特定入力方式だけに依存する設計は禁止**という指示に対し、現状のWidget実装はこの原則に違反していない（禁止すべき新規の依存を本Contractでは導入しない）。既知のギャップ（Switch Scanのパネル内到達性）は「禁止された依存」ではなく「未実装の到達性改善」として区別する。

### 5.4 State / storage

| 設定 | 管理者 | localStorageキー | 初期値 |
|---|---|---|---|
| ハイコントラスト | 共通Widget | `donomana-a11y-contrast` | `normal`（未設定時は通常表示） |
| 文字サイズ | 共通Widget | `donomana-a11y-font` | `normal` |
| 読み上げON/OFF（該当アプリのみ） | 共通Widget | `donomana-a11y-sr` | `0`（OFF） |
| アプリ固有設定（音量・難易度・リール速度等） | アプリ側（proxy経由） | アプリ固有のキー（例: `sakana-tsuri`は独自キー） | アプリ側が管理 |

**既存キーを破壊的に変更しないこと**という指示に対し、本Contractは既存の3キー（`donomana-a11y-contrast`/`donomana-a11y-font`/`donomana-a11y-sr`）のnamespace・schema・値形式を一切変更しない。Versioningは現状不要（キーの形式自体がv1から一度も変わっていないため、migration機構は本Contractの対象外とする）。将来的にキー形式を変更する必要が生じた場合は、別のDesign Contractで新バージョンとして定義する。

**共通Widget側が管理する設定とアプリ側が管理すべき設定の分離**: 上表の通り、表示系（コントラスト・文字サイズ・読み上げ）は共通Widget、教材固有の値（難易度・音量・ゲームパラメータ等）はアプリ側、という既存の分離は妥当であり、本Contractはこれを正式な境界として確定する。

### 5.5 App Adapter boundary

既存の`SETTINGS_PROXY`マップ（`generate.js`）を、本Contractにおける正式なApp Adapter境界として位置づける。

```
Common Widget (#donomanaA11yPanel)
        ↓
Adapter: SETTINGS_PROXY[filename] = { selector, label }
        ↓
App-specific behavior（アプリが既に持つ設定ボタン/タブ/モーダルをクリック）
```

**設計原則**: Common Widgetは、各アプリの内部DOM構造や状態機械を直接は知らない。Adapterは「どの要素をクリックすればアプリ固有の設定UIが開くか」という**セレクタ文字列1つ**だけを宣言し、実際の開閉ロジック・状態管理は完全にアプリ側に委ねる。この境界は既に37アプリ中33アプリで機能しており、**新しい仕組みを作るのではなく、既存の仕組みを正式契約として文書化し、残り2アプリ（`timetable-app`・`ongaku-app`）の欠落を埋める**ことが本Contractの実務的な提案である（1.4節・8章）。

**Strict Containmentにおけるアプリ側Adapter**: 同様の薄い境界が必要になる。`sawatte-hirogaru-app`の実装（`if (window.trapA11yPanelFocus && window.trapA11yPanelFocus(e)) return;`を自前のTab処理の先頭に置く、1行のガード）が、既に実証されたAdapter形式である。これを正式なテンプレートとして7章のWaveで横展開する。

### 5.6 Progressive migration

37アプリを一括置換する前提にしない。既存のGLOBAL-1A〜1D計画（`a11y-panel-global-rollout-plan.md`、未着手部分）をベースに、現在のFamily分類（3.2章）へ合わせて更新する。

| Wave | 対象 | 内容 |
|---|---|---|
| **Pilot（完了済み・既にProduction）** | `mogura-tataki`・`tyushi`・`cup_game`・`schedule-app`・`gaze-keyboard`（GLOBAL-1A）、および新規アプリ2件（`sawatte-hirogaru-app`・`sakana-tsuri`、開発時から接続） | 参照実装として確定済み。本Phaseでは変更しない |
| **Wave 1（次点Pilot候補、6章）** | 2〜4アプリ、Family横断で選定 | 本Phaseが提案する次の実装Phaseの対象 |
| **Wave 2** | Legacy-C（`katakana-app`・`hiragana-learn`）＋D-1残り（`okane-app`・`matching-app`・`ongaku-app`） | 旧GLOBAL-1Bに相当。Modal Coexistence Adapterの実装を要する5アプリ |
| **Wave 3** | D-2（`nazorin-print`・`shiritori2`・`tokei-app`・`janken-app`・`bosai-app`） | Tab listener追加のみで完結する可能性が高い5アプリ |
| **Wave 4（Remaining）** | D-3の残り20アプリ | 最も安全に横展開できる層。ただしSwitch Scan実フォーカス型の4アプリ（4.4節）は個別確認が必要 |
| **Settings Proxy欠落修正** | `timetable-app`・`ongaku-app` | Strict Containment Waveと独立して、Adapter欠落修正単体でも先行実施可能 |

---

## 6. Pilot候補（Deliverable D）

次のImplementation Phaseで最初に着手すべき2〜4アプリを提案する。単に実装が簡単なアプリだけで選ばず、共通化の妥当性を検証できる組み合わせを優先した。

### 候補1: `directions-app`（D-3、Switch対応、Modal無し）

- **理由**: D-3（最も単純なカテゴリ、Tab listener追加のみで完結する想定）の代表。Switch Scan対応アプリであり、4.4節のSwitch Scan競合確認ができる。単一画面型（Modal無し）のため、Modal Coexistence Adapterが不要な最単純ケースを実証できる。
- **検証価値**: 「最も安全なはずのWave 4が本当に安全か」を最初に確かめられる。

### 候補2: `okane-app`（D-1、guard-only、視線入力対応）

- **理由**: D-1（自前Modal Focus Trapを持ち、既にA11yパネルopen中はTrapを無効化するguardのみ実装済み）の代表。Modal Coexistence Adapterの実装パターンを初めて実証する。視線入力(Gaze)対応アプリでもあり、4.8節の視線入力境界を同時に検証できる。
- **検証価値**: Wave 2で必要になるModal Coexistence Adapterの実装・検証を、最初の1アプリで先行して確立できる。

### 候補3: `timetable-app`（Settings Proxy欠落修正＋browser chrome escape既知課題）

- **理由**: 1.5節で述べた通り、旧全アプリ監査で「唯一browser chromeへのescapeを実機確認した」P1課題を持つアプリであり、かつSettings Proxy欠落も同時に存在する。この2つの既知課題を同じPilotで扱うことで、Adapter欠落修正とStrict Containment導入の両方を1アプリで実証できる。
- **検証価値**: 最も実利用上のリスクが高いアプリへの対応を先送りにしない。Adapter欠落修正単体の検証もここで行える。

### 候補4: `katakana-app`（Legacy-C、既存cluster実装の置き換え）

- **理由**: 旧GLOBAL-1B対象。既存の独自cluster実装（opener含む非準拠状態）を、Family A（共通helper接続）へ置き換える唯一の実例を作る。`hiragana-learn`は完全同一実装のため、`katakana-app`での実証結果をそのまま横展開できる（2アプリ分の価値を1アプリの実装で得られる）。
- **検証価値**: 「既存の独自実装をどう安全に置き換えるか」という、Wave 2全体で最も技術的難易度が高いパターンを最初に確立できる。

**Pilotの組み合わせとしての妥当性**: D-3（最も単純）・D-1（Modal競合）・Settings Proxy欠落・Legacy-C（既存実装の置き換え）という、4つの異なる技術的課題をそれぞれ1アプリで代表させている。単に「簡単な4アプリ」を選んでいない。

---

## 7. Migration Matrix（Deliverable C、2026-10-08時点の現状へ更新）

**[2026-10-08追記]** 以下は起草時点(2026-10-06)の計画表ではなく、11章の現状確認に基づく現在状態である。元の6列（Current Pattern/Common Widget compatibility/Adapter required/Risk/Proposed Wave）は、Production Statusと混同しないよう列構成を変更した。「完了率」等の独自スコアは追加していない。各列の意味: **Classification**=Family分類（D-2は実態に応じてD-2a/D-2bへ細分、11.2章参照）／**App-specific modal trap**=そのアプリ自身が持つ固有modal/overlay用Tab Trapの状態／**A11y guard**=共通A11yパネルとの競合防止guardの状態／**Production status**=Production Release済みか否かとそのPhase名／**Known residual issue**=本Matrixの対象外として明示的に残る既知課題／**Real Device Verification**=iPad Safari・VoiceOver・Blue2・Tobii等の実機確認状態（Automated Chromium/User Browser Review/Production ReleaseとReal Device Verificationを区別する指示に従い、全行で明確にPENDINGと記載）。

| App | Classification | App-specific modal trap | A11y guard | Production status | Known residual issue | Real Device Verification |
|---|---|---|---|---|---|---|
| mogura-tataki | A (Reference) | N/A | 共通helper wired | Production Released (GLOBAL-1A) | disabled-state(`dwT`/`togCur`/`dwTol`)、Visible Focus等、既存Separate Finding(別軸) | PENDING |
| tyushi | A | N/A | 共通helper wired | Production Released (GLOBAL-1A) | 無し | PENDING |
| cup_game | A | N/A | 共通helper wired | Production Released (GLOBAL-1A) | settingsOverlay `toggleDwell`等のVisible Focus欠如(別軸、未修正) | PENDING |
| schedule-app | A | N/A | 共通helper wired | Production Released (GLOBAL-1A) | 1スイッチ設定でのScan停止(別軸、未修正) | PENDING |
| gaze-keyboard | A | N/A | 共通helper wired | Production Released (GLOBAL-1A) | Blue2 Scanがキーボード側に残る(別軸、未修正) | PENDING |
| sawatte-hirogaru-app | A | N/A | 共通helper wired(開発時から) | Production Released(新規アプリ公開時から) | 無し | PENDING |
| sakana-tsuri | A | N/A | 共通helper wired(開発時から) | Production Released(新規アプリ公開時から) | 無し | PENDING |
| katakana-app | Legacy-C(opener-bug修正済み) | N/A(自前clusterがパネル循環を兼ねる) | 自前cluster内で対応、共通helperは未接続 | Production Released (COMMON-A11Y-STRICT-CONTAINMENT-PILOT-WAVE-1、**自前clusterのopener除外bugを直接修正。Family Aへの移行は実施していない**) | traceSampleViewer自身の別Tab trapは無変更 | PENDING |
| hiragana-learn | Legacy-C(opener-bug修正済み、katakana-appと同一実装) | 同上 | 同上 | Production Released (COMMON-A11Y-HIRAGANA-LEGACY-C-OPENER-FIX-1、同上の直接修正) | 同上 | PENDING |
| okane-app | D-1 | 自前4modal Focus Trap(guard-only、既存) | 共通helper wired(Pilot Wave 1) | Production Released (COMMON-A11Y-STRICT-CONTAINMENT-PILOT-WAVE-1) | 無し | PENDING |
| matching-app | D-1 | 自前Modal Focus Trap(guard-only、既存) | 共通helper 未接続 | **未着手**(対応するPhase無し) | A11yパネル自体のcontainment欠如(元Finding継続) | PENDING |
| ongaku-app | D-1(`modal-pin`/`modal-export`/`modal-share`) + Case A(`modal-help`のみ) | `modal-pin`/`export`/`share`: guard-onlyのまま(既存)／`modal-help`: Wave Aで新規にexact-match Trap+guard追加 | `modal-help`分のみ共通helper wired(Wave A connector)。他3modalのA11yパネル自体のcontainmentは未接続 | Production Released (`modal-help`分: COMMON-A11Y-MODAL-COEXISTENCE-FIX-1-WAVE-A／Settings Proxy登録: COMMON-A11Y-SETTINGS-PROXY-GAP-FIX-1) | **modal単位でFamily状態が異なる唯一のアプリ(本書11.3章で初めて明記)** | PENDING |
| nazorin-print | D-2b(Case B、積極的再捕捉型) | 3modal(helpModal/batchModal/libModal)共有の`!modal.contains(active)`型Trap、race解消済み | 共通helper wired(Wave B connector) | Production Released (COMMON-A11Y-MODAL-COEXISTENCE-FIX-1-WAVE-B) | 無し | PENDING |
| shiritori2 | D-2a(Case A、厳密一致型) | 自前record-modal-backdrop Trap、guard追加済み | 共通helper wired(Wave A connector) | Production Released (COMMON-A11Y-MODAL-COEXISTENCE-FIX-1-WAVE-A) | 無し | PENDING |
| tokei-app | D-2a(Case A) | 自前helpModal/recordModal Trap、guard追加済み | 共通helper wired(Wave A connector) | Production Released (Wave A) | 無し | PENDING |
| janken-app | D-2a(Case A、`record-modal-backdrop`分)。**howto-overlayは本Matrixの対象外の別軸(11.4章参照)** | `record-modal-backdrop`: 自前Trap、guard追加済み | 共通helper wired(Wave A connector) | Production Released (`record-modal-backdrop`: Wave A／`howto-overlay`: JANKEN-HOWTO-OVERLAY-FOCUS-FIX-1、別Phase) | 無し(`record-modal-backdrop`分) | PENDING |
| bosai-app | D-2a(Case A) | 自前help-modal Trap、guard追加済み | 共通helper wired(Wave A connector) | Production Released (Wave A) | **settings-modalにEscape handlerが存在しない既存残存課題(本Phaseで修正しない)** | PENDING |
| timetable-app | D-3 + Settings Proxy欠落(修正済み) | N/A | 共通helper wired(Pilot Wave 1) | Production Released (Tab containment: Pilot Wave 1／Settings Proxy: COMMON-A11Y-SETTINGS-PROXY-GAP-FIX-1) | 旧P1(reverse Shift+Tabでbrowser chromeへescape)はPilot Wave 1で解消確認済み | PENDING |
| directions-app | D-3 | N/A | 共通helper wired(Pilot Wave 1) | Production Released (Pilot Wave 1) | 無し | PENDING |
| nazori-app | D-3 | N/A | 共通helper wired(Wave 2) | Production Released (COMMON-A11Y-STRICT-CONTAINMENT-WAVE-2) | 無し | PENDING |
| yomikaki-app | D-3 | N/A | 共通helper wired(Wave 2) | Production Released (Wave 2) | 無し | PENDING |
| sugoroku-app | D-3 | N/A | 共通helper wired(Wave 2) | Production Released (Wave 2) | 画面ロック併存(別軸、既存) | PENDING |
| slideshow-sakusei | D-3 | N/A | 共通helper wired(Wave 2) | Production Released (Wave 2) | 無し | PENDING |
| register-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| sst-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 画面ロック併存(別軸、既存) | PENDING |
| kimochi-board | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| drawing-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| time-timer | D-3 | N/A | 共通helper 未接続 | **未着手** | PIN併存(別軸、既存) | PENDING |
| suji-manabou | D-3(実フォーカス型Switch Scan) | N/A | 共通helper 未接続 | **未着手**(4.4節の競合確認も未実施) | 無し | PENDING |
| kyou-no-kiroku | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| scratch-app | D-3 | N/A | 共通helper 未接続 | **未着手** | PIN併存(別軸、既存) | PENDING |
| kurabeyou-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| katachi-awase-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| miru-hirogaru-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| mitsukete-touch-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| junban-miyou-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |
| dotchiga-ii-app | D-3 | N/A | 共通helper 未接続 | **未着手** | 無し | PENDING |

集計(2026-10-08時点): Production Released = 23/37、未着手 = 14/37。内訳はいずれもAutomated Regression PASSを伴うが、**Real Device Verificationは37/37全てPENDING**（iPad Safari・VoiceOver・Blue2・Tobii・実スイッチ・実視線入力のいずれも、Automated ChromiumまたはUser Browser Reviewで代替していない）。

---

## 8. 後続Phase案（Deliverable E）

1. **Settings Proxy欠落修正Phase**（`timetable-app`・`ongaku-app`）: 単独でも実施可能、低リスク、Strict Containmentと独立。
2. **Pilot Implementation Phase**: 6章の4候補（`directions-app`・`okane-app`・`timetable-app`・`katakana-app`）への共通helper接続＋Adapter実装。
3. **Pilot Automated Verification Phase**: 既存の`donomana-a11y-panel-keyboard-contract-v1_0.md` §10のtest matrix（open/Forward/Reverse/boundary/outside-focus/Escape/close restoration/mouse close/settings proxy経由）をPilot4アプリで実行。Switch Scan競合確認（4.4節該当アプリのみ）も含める。
4. **User Browser Review Phase**: 固定Preview経由でPilot4アプリをユーザー確認。
5. **Real Device Gate Phase**: Blue2・Tobii・iPad Safari等、ユーザー本人による実機確認（Cloud側は一切代替しない）。
6. **Production Release Phase**: User Browser Review PASSかつReal Device Gate結果を踏まえ、ユーザーの明示承認後にのみ実施。
7. **Wave expansion Phase（複数）**: Wave 2(Legacy-C+D-1残り)→Wave 3(D-2)→Wave 4(D-3残り)の順に、Pilotで確立したパターンを横展開。各WaveごとにAutomated Verification→User Browser Review→Real Device Gate(必要な入力方式のみ)→Production Releaseのサイクルを繰り返す。
8. **GLOBAL-1D相当の最終再監査Phase**: 全37アプリがStrict Containment Conformant（37/37）になった時点で、`a11y-panel-global-conformance-matrix.md`と同形式の最終再評価を実施。

いずれも本Phase（COMMON-A11Y-WIDGET-DESIGN-1）の範囲外であり、本Design Contractの承認後に個別Phaseとして開始する。

---

## 9. PINロック・ハイコントラストに関する判断（14章「重要な判断基準」への対応）

- **PINロック**: Design System §7.6.3の承認済み例外に基づき、共通Widgetへの統合を提案しない。アプリ固有のまま残すことが既存の正式な設計判断であり、本Contractはこれを変更しない。
- **ハイコントラスト**: 共通Widget自体の「ON/OFF切り替え機構」（`style.filter = invert(1) hue-rotate(180deg)`）は既に37アプリ共通。正本ロードマップ§6.1が言う「ハイコントラスト統一」は、この切り替え機構自体ではなく、**各アプリの配色トークンがハイコントラストモード下でも十分なコントラスト比を保てているか**（Contrast Gate、既存のTier1/Tier2/Tier3監査が継続中の別軸）を指すと解釈すべきであり、これは本Common A11y Widget Design Contractのスコープ外（別のFinding Family）として明確に区別する。混同しないこと。

---

## 10. 非実施事項の確認（Non-goals §7対応）

本Phaseでは以下を一切行っていない（指示通り）：

- Productionコード変更・mainへのpush・Production Release
- A11y Widgetの本実装（コード変更ゼロ、Design文書のみ）
- 37アプリへの一括変更
- スイッチスキャン共通化・PINロック共通化・ハイコントラスト統一の実装
- UIデザイン刷新・SEO変更
- 魚釣りCount-mode関連branchの取り込み（確認もしていない。本Phaseの調査対象外）
- 実機確認済みとの記録（本書のいかなる章も「実機確認済み」と記載していない。4.8節・6章・8章で明示的に「未実施」と記載）

---

## 11. 2026-10-08 Status Update（Phase `COMMON-A11Y-DESIGN-CONTRACT-DOCS-RECONCILIATION-1`）

本章のみ2026-10-08に追記。fresh `origin/main`（SHA `3e5e716bc0f6530b5396c90d5b3f26fc47014a2b`）の直接確認に基づく。**本章の追記自体はdocs-onlyであり、コード変更を一切伴わない**（コード側の変更は、本章が参照する各Production Release Phase側で既に完了・反映済みの事実）。

### 11.1 本文書のmain未マージ状態について

本文書(v1.0)は起草（2026-10-06、Phase `COMMON-A11Y-WIDGET-DESIGN-1`）から本追記まで、`design/common-a11y-widget-1`branchに留まり、`origin/main`へ一度もマージされていなかった。fresh確認の結果:

- branch HEAD: `513a60032bed6970b75eace30509467291cef7ad`
- mainとのmerge-base: `3576feb4f77c69a6075f357d191b3b7cb9250c8d`
- branch上でmainに無いcommitは`513a600`の1件のみ、変更ファイルは本書1ファイルのみ（docs以外のコード変更は無し）
- mainに本書と同名・同スコープの後継文書は存在しない。ただし`docs/accessibility/`配下に主題が重なる別系統の文書（`donomana-a11y-panel-keyboard-contract-v1_0.md`・`a11y-panel-global-conformance-matrix.md`、35アプリ時点）が既に存在し、未統合のまま並存している（11.6章）

このため、本Phaseでは**Case A（既存branch上の文書を、fresh Production実装に合わせて最小更新し、docs-onlyでmainへ取り込む）**を採用した。branchそのものをmergeするのではなく、専用branch（`docs/common-a11y-design-contract-reconciliation-1`）上で本文書を再構成し、新規にcommitしている。

### 11.2 D-2のdrift確認（§6対応）

3.2章の原記述「独自Escapeハンドラで委譲するのみ。Tab処理はA11yパネルを意識しない」は不正確だった。fresh codeで5アプリ全てを確認した結果、各アプリは実際には**自前のapp固有modal用Tab Focus Trapを既に持っていた**（Escapeハンドラのみ、ではない）。この事実自体は本書起草時点（2026-10-06）でも既にコード上に存在していたが、本書は見落としていた。後続の`COMMON-A11Y-MODAL-COEXISTENCE-AUDIT-1`（Audit Phase、本書の範囲外で別途実施）がこの事実を発見し、以下の2種類に分類した:

- **D-2a（Case A、厳密一致型）**: `activeElement===first/last`の厳密一致判定を使うTrap。A11yパネルにfocusがある状態では判定が構造的に成立しないため、guard無しでも実害は無かった（ただし実行順序に依存しない明示的ownership保証のため、Wave Aでguardを追加）。該当: `shiritori2`・`janken-app`(`record-modal-backdrop`)・`tokei-app`・`bosai-app`
- **D-2b（Case B、積極的再捕捉型）**: `!modal.contains(activeElement)`型の判定を使うTrap。A11yパネルにfocusがある状態でも判定が成立してしまい、guard無しではTab押下ごとにfocusをmodal内へ強制的に引き戻す実害のあるraceだった（Wave Bで解消）。該当: `nazorin-print`

この命名はWave A/Wave Bの実装コメント・Audit文書が既に使っている「Case A」「Case B」という用語に合わせたものであり、新規の用語や大規模な再分類は導入していない。D-1・D-3等、他のFamily分類構造自体は変更していない。

### 11.3 ongaku-appのmodal単位の差異（§8対応）

原文書はongaku-appを単一のFamily D-1として記載していたが、fresh codeではmodal単位で状態が異なることを確認した。`ongakuModalIds()`が管理する`modal-pin`/`modal-export`/`modal-share`の3modalは元々のD-1 guard-onlyパターンのまま変更されていない。一方`modal-help`は、このD-1関数の対象から明示的に除外されており（アプリ内コメント「modal-helpは対象外」）、Wave Aで初めてexact-match Trap＋guardが新規実装された、D-2aと同型のパターンを持つ。単一のFamily labelでは表現できないこの差異を、7章のMatrixで初めてmodal単位で明記した。

### 11.4 janken-appのrecord-modal-backdropとhowto-overlayの区別（§9対応）

janken-appには現在、2種類の独立したmodal/overlay Tab Trapが存在する。両者を混同しないこと:

- **`record-modal-backdrop`**: 本Design Contractのスコープ内（共通A11yパネルとの競合防止）。D-2a(Case A)として分類、Wave Aでguard追加・共通helperへ接続済み
- **`howto-overlay`**: 本Design Contractのスコープ外の別軸。`JANKEN-HOWTO-OVERLAY-FOCUS-AUDIT-1`/`-FIX-1`で「Case E-1」として個別に分類・修正された、janken-app固有のヘルプ表示overlay。共通A11yパネルとの競合は論点ではなく（howto-overlay自身にTab Focus Trapが一切存在しなかったことが本来の問題だった）、共通helper(`window.trapA11yPanelFocus`)への接続も行っていない（動的focusable集合を都度計算する専用の独立したTrapを新設）。Production Released (`JANKEN-HOWTO-OVERLAY-FOCUS-PRODUCTION-RELEASE-1`)

### 11.5 Legacy-C（katakana-app/hiragana-learn）の現状

1.5節・3.3節で指摘されていたopener inclusion bug（`[a11yBtn].concat(panelItems)`）は両アプリで修正済み（`COMMON-A11Y-STRICT-CONTAINMENT-PILOT-WAVE-1`・`COMMON-A11Y-HIRAGANA-LEGACY-C-OPENER-FIX-1`、fresh codeで該当する`.concat`呼び出しが無いことを確認）。ただし実際に採用された修正方式は、6章候補4が想定していた「Family A（共通helper接続）への移行」ではなく、**自前のcluster関数自身からopener参照を取り除くという、より軽量な直接修正**だった。両アプリは現在も独自のcluster実装を保持しており、`window.trapA11yPanelFocus`は未接続のままである。この点は当初の計画と実際の実装選択が異なった箇所として明記する（Legacy-Cの非準拠自体は解消済みだが、Family Aへの統合という体裁上の移行は行われていない）。

### 11.6 他文書との統合について（Case B/Cを採用しなかった理由）

`docs/accessibility/`配下の`donomana-a11y-panel-keyboard-contract-v1_0.md`・`a11y-panel-global-conformance-matrix.md`は、本書と重なる主題（共通A11yパネルのStrict Containment）を35アプリ時点・別の用語系（`mogura-tataki`をReference Implementationとする、Family A/B/C/D/E表記）で扱っている別系統の文書である。本書とこれら2文書は、現時点でも相互に参照し合っておらず、統合もされていない。

本Phaseでは、この2系統を1つのv1.1/v2文書へ統合するCase C、または一方をobsolete化するCase Bのいずれも採用しなかった。理由: (a) 本Phaseの発端となったFindingは「本書がmain未マージのまま孤立している」ことであり、2系統の統合が無くてもこのFinding自体は本commitで解消できる、(b) 2系統の統合には両文書の用語・App数・Wave番号付けの全面的な再整理が必要であり、「不要なら既存文書の最小更新を優先する」という本Phaseの指示に反する規模になる。**両系統が未統合のまま並存している状態は、本Phase完了後も残存課題として引き続き残る**（本Phase完了報告の残存課題を参照）。

---

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-10-06 | 初版。`COMMON-A11Y-WIDGET-DESIGN-1`の成果物として、37アプリの現状再棚卸し・Family分類・Design Contract・Migration Matrix・Pilot提案・後続Phase案を作成 |
| v1.0 Status Update | 2026-10-08 | `COMMON-A11Y-DESIGN-CONTRACT-DOCS-RECONCILIATION-1`。本書が`design/common-a11y-widget-1`branchに留まりmain未マージだったFindingへの対応として、docs-onlyでmainへ初取り込み。D-2の記述drift訂正（D-2a/D-2b細分、11.2章）、ongaku-appのmodal単位の差異明記（11.3章）、janken-appのrecord-modal-backdrop/howto-overlay区別明記（11.4章）、Legacy-C 2アプリの現状反映（11.5章）、7章Migration Matrixの全面的な現状更新（Production Status/Known residual issue/Real Device Verification列を新設、Production Released 23/37・未着手14/37・Real Device Verification 37/37 PENDINGを明記）。Productionコード・generator・Preview・アプリ実装は一切変更していない（docs-onlyのstatus reconciliation） |
