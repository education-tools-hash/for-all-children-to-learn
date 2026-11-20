# 設定画面・ヘルプ（つかいかた）に関する既存ドキュメント上の取り決め 調査（READ-ONLY）

- 対象: 凍結コピー `scratchpad/tree`（production commit 7218d8f）。リポジトリ本体は開いていない・変更していない。
- 方法: 指定文書の通読／`設定`等のgrep。行番号は凍結コピー内のもの。版・状態は文書の記載をそのまま引用（推測していない）。
- 補足として、文書の記述を確かめるために `generate.js`・アプリHTMLを読み取り専用で確認した箇所がある（「※コード確認」と明記）。

---

## 0. 要点サマリ

1. **設定入口（場所・ラベル）**: 新規アプリは独自の設定ボタンを増やさず、共通A11yパネル（右下 `donomanaA11yBtn`）内の `donomanaSettingsProxy`（ラベル「🔧 このアプリの詳細設定を開く」）を唯一の入口にする（New App Standard §7 REQUIRED）。アプリ本来の設定ボタンはCSSで隠し、proxyから `.focus()+.click()` で委譲する。「詳細設定」という言葉が文書に出てくるのは、このproxyラベルの中だけ。共通パネルで扱う基本設定と、アプリの「詳細設定」を段階的に分ける正式な仕組み（段階的開示）は、どの文書にも定義されていない。
2. **ヘルプ（つかいかた）**: Help / Usage Guide Standard v1.0 に定めがある。Common Chrome右上クラスター（`top:64px;right:12px`）に **Lock → Fullscreen → Help** の順で常に表示する。ボタンは native `<button>`、アイコンは `❓`、`aria-label`は「つかいかた」、44px以上。**Settingsの中だけに置くことは禁止**。内容は「A.このアプリについて／B.活動／C.操作方法／D.設定／E.記録／F.固有機能」で、**「D. 設定 — 利用に重要なSettingsのみ」**を含める（設定を説明する義務はあるが、範囲は重要なものに限る）。
3. **標準設定項目と既定値**: 名前・既定値・範囲まで文書で決まっているのは**視線入力（Gaze Standard v1.0 改訂5「確定」）だけ**。dwellは既定900ms、300〜3000ms、100ms刻み。entry delayは既定0ms、0〜500ms。hit area拡大は100%から150〜200%。視線入力ON/OFFはREQUIRED（実装例は既定OFF）。設定グループはA→B→C→Dの順。表示名の対応表もある。**スキャン速度（走査間隔）は、既定値・範囲・正式な表示名のどれも定めた文書がない**。Switch Scan仕様 v1.8 にも項目がない。
4. **表示系の共通設定**: 共通A11yパネルが全アプリで同じ localStorage キーを使う（`donomana-a11y-contrast`／`donomana-a11y-font`／`donomana-a11y-sr`。既定は normal／normal／0）。同じオリジンなので、アプリをまたいで共有される事実上唯一の仕組みになっている。**`donomana-access` という共有設定キーは存在しない**。Donomana Access（`donomana-access.html`）は入力方法を評価するアプリで、キーは `donomana_access_log_v1`／`donomana_access_teacher_notes_v1` の2つだけ。ほかのアプリからは参照されていない。
5. **PIN／教員ロック**: Design System §7.6.3 で、モーダル禁止の唯一の正式例外とされている（8条件付き）。共通化しない（Common A11y Widget Contract §9）。ただし正本ロードマップには「PINロック共通化」が「今後」の項目として残っており、矛盾がある。
6. **プレビュー／「ためす」**: 設定の効果をその場で試す（プレビューする）ことを求める規定は、**どの文書にも見当たらなかった**。
7. **アプリ別のヘルプ一覧**: `donomana-help-inventory-v1.md` がある（35アプリ、Settings説明列あり）。**アプリ別の設定項目一覧**は、視線入力の11アプリ表（Gaze Standard §30）と SETTINGS_PROXY登録状況（Widget Contract）だけ。全アプリ・全設定項目の一覧はない。

---

## 1. 文書別の取り決め

### 1.1 `docs/design-system/donomana-new-app-development-standard-v1_0.md`
- 状態: 「版: v1.7」（L3）。改訂履歴の最終版は v1.7（2026-09-06）。L7「承認: 本v1.1は文書化Phase（Phase26-E）の成果物として…既存の承認済み仕様書…の内容を変更・上書きするものではない」
- 設定・ヘルプに関する取り決め:
  - L79-80 原則7「User-facing simplicity」: 内部機能が多くても、利用者に見せるUIは必要なときだけ表示する。
  - L138-145 §5 Level UI（REQUIRED）: Levelを頻繁に切り替える教材では、**設定画面の奥にLevel選択を置かない**。設定の中に同じLevel UIをもう一つ作らない。
  - L151-162 §6 条件付きUI（REQUIRED）: 設定項目は意味があるときだけ表示する。隠すときは `hidden` 属性を使う（keyboard・Switch・gazeの対象にもならないようにする）。
  - **L166-170 §7 設定入口一本化（REQUIRED）**: 「新規アプリ独自の設定入口を、共通設定ボタン（`donomanaA11yBtn`）とは別に増設しない。既存の`SETTINGS_PROXY`方式（…共通A11yパネル内の『このアプリの詳細設定を開く』ボタンへ統合）を使う。『設定ボタンが2つ存在する』状態を原則禁止」。元の設定ボタンはCSSで隠し、proxyから `.focus()+.click()` で委譲する。独自の委譲処理は作らない。
  - L174-183 §8 common chrome（A11y／Lock／Home／Fs）は generate.js が挿入する。手書きは禁止。
  - L189-197 §8.1 Help Compliance（REQUIRED）: Help入口はLock・Fullscreenと同じクラスターに常に表示し、Settingsの中に隠さない。
  - L292: 設定パネルを開いている間は `getGazeTargets()` が `[]` を返す（gazeを切り離す）。
  - L388-399 §21 保存: 軽い設定やログは localStorage に置く。JSONが壊れていても動くようにする。「設定保存と学習ログは必要に応じて分離」「個人情報は保存しない」。
  - L312-314 §15 reduced motion: generate.js が全アプリに挿入する `prefers-reduced-motion` と、アプリ独自のanimation設定（例: `animationEnabled`）は別の層として扱い、両方を守る。
  - **L618 §37 共通A11yパネルの正式な構成**: `#donomanaSettingsProxy`（該当時）／表示モード（ハイコントラスト `[data-a11y-contrast="normal"|"hc"]`）／文字の大きさ（`normal/large/xlarge` = 100/125/150% zoom）／すべてリセット／読み上げON-OFF（`SR_SKIP_APPS`に登録されていないとき）。「独自の表示モード切替UIを重複実装しない」。
  - L624 §38: 設定パネルは非modal（7.6.1 側面パネル／ボトムシート）。新しいmodalは作らない（PINだけが例外）。
  - L884: Release Gate に Help Standard への準拠を含める。「入口がSettings内等に隠れた状態ではRelease Approval Gateを通過しない」。
  - L986・L1042 チェックリスト: 「設定入口が1つ」「設定入口はSETTINGS_PROXY一本化」。L1093 Case D: 設定入口が二重になっていたものを共通の導線にまとめた事例。

### 1.2 `docs/design-system/donomana-help-usage-guide-standard-v1_0.md`
- 状態: 冒頭に版・承認の記載はない。L3「策定: Phase M12-D''''（`dotchiga-ii-app.html`をReference Implementationとして策定）」。改訂履歴は#1のみで、日付欄も「Phase M12-D''''」（L167-169）。
- 取り決め:
  - L42 §4: 「つかいかた」の入口はCommon Chromeに常に表示する。**Settingsの中だけに置くこと、ページ下部までスクロールしないと見つからない配置は禁止**。
  - L44-56 §5/5.1: 右上クラスター（`top:64px;right:12px`、flex row、gap 8px）に **Lock → Fullscreen → Help** の順で置く。L56「Settings自体はアプリ内ヘッダーの独自ボタン（`#settingsBtn`、a11yパネル経由でのみ到達）であり、Common Chromeクラスターの対象外のまま変更しない」。
  - L58-65 §6 ボタン: native `<button>`。icon `❓`。**accessible name「つかいかた」**（「？」だけにしない）。`title` は aria-label と同じ文字列。44px以上の円形。
  - L67-71 §7: 5つのviewportでボタン同士が重ならないこと。Gaze 150%でも重ならないこと。
  - L73-75 §8 完了基準: 「初めてそのアプリを開いた教員・保護者・支援者が、Helpだけを読んで基本的な使い方を理解できること」。
  - **L77-88 §9 必須構造**: A.このアプリについて／B.活動・遊び方／C.操作方法（実装されている入力方式だけ）／**D.設定 — 利用に重要なSettingsのみ**／E.記録（ある場合）／F.固有機能。見出しは h2→h3→h4。
  - L90-92 §10: 技術用語を使わない。
  - **L94-98 §11**: Gazeについては最低限「視線入力をONにできる」「見つめて選べる」「**見つめる時間等をSettingsで調整できる**」を書く（8項目すべてを並べる必要はない）。Switchは「スキャンをONにする／順番に移動／選びたいところで入力」。
  - L100-106 §12・§13: 記録・Privacyの説明（記録は診断ではない、と誤解を防ぐ文を推奨）。
  - L108-111 §14: 表示方式は自由。「入口を再びSettingsへ戻すことは禁止」。古いmodal型Helpは「Legacy / Transitional」として当面認める。
  - L113-139 §15-19: Keyboardで開閉できる、Escape、focus return、Gaze/Switchの切り離し（Settingsと同じ仕組みを使う）、reduced-motion。
  - L145-163 §21・§22: 既存アプリへは2〜4アプリずつ段階的に適用する。Help buttonの generate.js injector化は「PoC候補」で、まだ実施していない。KEEP LOCAL: 「記録・設定の個別項目名」。

### 1.3 `docs/design-system/donomana-help-inventory-v1.md`（**アプリ別ヘルプ一覧**）
- 状態・日付: L3「策定: Phase M12-D''''」（日付なし）。改訂: M12-F（**2026-08-23**、Production Release）、改訂2 T5-E-A''（**2026-08-30**、RC）、改訂3〜8（T6.5-B1〜B7、それぞれ「Local checkpoint、Production未反映・User Review未実施」と記載。日付なし）。
- 内容（L36-74）: 35アプリについて、Help有無／入口の位置／Pattern／内容量／Input説明／**Settings説明**（Yes/Partial/No/n/a）／Record説明／Group判定。
- 集計（L80-86）: **Group A 28／B 3（tyushi・directions-app・time-timer）／C 2（timetable-app・sugoroku-app）／B+C 0／D 2（shiritori2・suji-manabou）＝35**。
- Settings説明が足りないアプリ（表の記載どおり）:
  - No: timetable-app、sugoroku-app、kyou-no-kiroku、scratch-app、sst-app（＋Helpがない shiritori2・suji-manabou）
  - Partial: nazori-app、schedule-app、kimochi-board、drawing-app（gaze速度）、slideshow-sakusei、directions-app
  - n/a: tokei-app（専用Settings UIがなく、ヘッダー付近で直接切り替える）
- L90 横断的な所見: Group Aでも `role="dialog"` のないHelp overlayが多い。
- 改訂4（L10）の観察: 設定ボタンのDOM IDはアプリごとに違う（`settingsBtn`／`setBtn` 等）。
- **注意（※コード確認）**: 7218d8f では `donomanaHelpBtn` を持つアプリが17本ある。T6.5系の「Production未反映」という記載は、現在のproductionとは合っていない可能性が高い。また apps-data.json は39件（sawatte-hirogaru・sakana-tsuri・ringo-potton・minna-de-kakeru-niji〔HTMLなし〕が追加されている）だが、一覧は35件のまま更新されていない。

### 1.4 `docs/design-system/donomana-gaze-accessibility-standard-v1_0.md`（**設定項目の名前・既定値を定めた唯一の文書**）
- 状態: 「版: v1.0（改訂5）」（L3）。「状態: **確定**（…Phase M11.3-Aにおけるユーザー明示決定（0章）により正式確定した…）」（L5）。起草・改訂はすべて 2026-08-19。
- 取り決め:
  - L59-65 §0: Decision A（Gaze×Switchを排他にしない）、Decision B（**視線入力ON/OFFはREQUIRED**）。
  - L128-139 §6: REQUIRED 8項目（6.1 ON/OFF／6.2 dwell時間／6.3 進捗表示／6.4 再選択防止／6.5 動き・速度〔基礎水準〕／6.6 target拡大／6.7 余白／6.8 entry delay）。
  - **L162 §8.1: 既定dwell 900ms**。**L168 §8.2: 300〜3000ms、100ms刻みを推奨**。
  - **L192-194 §9.3: entry delay は既定0ms、0〜500msを暫定推奨**。
  - L266 §12.3: hit areaは100%から始め、150〜200%まで拡大できるようにする。L283 §13: 余白は2〜3段階（「ふつう」「ひろめ」）を暫定推奨。
  - L296-298 §14.2: 「はやい／ふつう／ゆっくり」のような速度の調整は RECOMMENDED（REQUIREDではない）。L302: 「速い＝快適」を当てはめない。
  - **L308-310 §15.1 設定入口: New App §7 を継承。「Gaze専用の独自設定ボタンを追加しない」**。A11yパネル → SETTINGS_PROXY の順でたどる。
  - **L314-323 §15.2 グループの順**: A.視線入力（ON/OFF）→ B.選択（dwell・entry delay・cooldown）→ C.見やすさ・操作しやすさ（進捗表示・拡大・余白）→ D.動き。視線入力がOFFのときはB・Cを `dimmed` 表示にする（cup_gameを参照パターンとして推奨）。
  - **L325-340 §15.3 表示名の対応表**: Gaze ON/OFF=「視線入力」／Dwell=「見つめて決めるまでの時間 / みつめる時間 / 注視じかん」／Entry Delay=暫定「見はじめの待ち時間」／Cooldown=「再入力までの間 / 決定後の待ち時間」／Progress=「見つめている印」／Target Scale=「見やすさ・押しやすさの範囲」／Spacing=「ボタンの間隔」／Motion Speed=「**動きの速さ**」。L340「表示名を1つに強制するのではなく」対応関係を示す、としている。
  - L342-348 §15.4: 設定UIもSwitch Scanの対象に含める。aria-label を付ける。
  - **L352-372 §16 保存**: canonical settings は `gazeEnabled, dwellDuration, dwellProgressVisible, cooldownMode, cooldownDurationMs, gazeTargetScale, targetSpacingLevel, gazeEntryDelayMs, motionSpeedLevel`。**「アプリごとに新規のlocalStorageキーを乱立させない」**。アプリごとにある既存の1つのsettingsオブジェクトに追加する。L374-376: transient state（その場限りの状態）は保存しない。
  - L553-560 §29: Pilot 3教材の実装値（ON/OFFは既定OFFで永続化、900ms、2段階の速度「ふつう/ゆっくり」、100/150%、0–500ms）。L657 §33.1: 3教材でラベル文言と定数（300/3000/100、0/500/50）が完全に一致することを確認済み。
  - L566-592 §30: **既存の視線入力11アプリの設定一覧**（dwell UIの方式・範囲。gaze-keyboard 300-3000、cup_game 500-5000、tyushi 200-4000 など）。
  - L629-644 §32 チェックリスト: 「設定保存が標準方式」「設定UIが標準順序（A→B→C→D）」。
  - L699 §34: 将来 `<!-- gaze-settings-ui: 自動挿入 -->` で設定UIをinjector化する案（未実施）。

### 1.5 `docs/design-system/donomana-switch-scan-spec-v1_0.md`
- 状態: 「版: v1.8（**承認済み**）」（L3）。L12「本文書v1.8は2026-08-12に承認済みである」。
- 取り決め:
  - L69-76 §2.1 M3: Switch Scanの動作中も、共通A11yパネル・Settings Proxyの文字サイズ・ハイコントラストと共存できること。
  - L157 §4.2 C1: モーダル・設定パネルを表示している間は、その中の候補を優先する。
  - L164-180 §5: `donomanaSettingsProxy` を含む共通chromeを走査候補に含めることを推奨（R）。理由は「共通アクセシビリティ設定そのものに到達できない」状態を避けるため。
  - L286 §9.3: bosai-app は設定modalを開くとスキャンを一時停止し、閉じると再構築する。
  - L442 §16.7: adapter名の例として `intervalMs`。
  - **走査間隔（スキャン速度）の既定値・範囲・表示名は定めていない**（grepで「秒」「速度」「間隔」の規定は見つからない）。L1365-1376 Version2検討事項にも速度の標準化は入っていない（Auto/Manual Scanの切り替えだけ）。

### 1.6 `docs/design-system/donomana-common-a11y-widget-design-v1_0.md`
- 状態: 「版: v1.0（初回起草は2026-10-06…2026-10-08…本docs-only commitでmainへ初めて取り込む）」（L3）。11章は2026-10-08、12章は2026-10-09に追記。
- 取り決め:
  - L17・L44-56 §1.2: 共通パネル（ハイコントラスト・文字の大きさ・読み上げ・Escape・リセット）は37/37で共通化済み。Settings Proxy は 33/37（起草時点）。
  - L67: Proxyの登録漏れは timetable-app と ongaku-app の2件。tokei-app と nazorin-print は独自設定がないので未登録で正しい。→ L350・※コード確認: その後 `COMMON-A11Y-SETTINGS-PROXY-GAP-FIX-1` で両方とも登録済み。現在の `SETTINGS_PROXY` は36エントリで、ringo-potton-app も含む。
  - L68・L392-394 §9: **PINロック・画面ロックは意図的に共通化しない**（Design System §7.6.3 の承認済み例外）。
  - **L255-266 §5.4 State/storage**: ハイコントラスト `donomana-a11y-contrast`（初期値 `normal`）、文字サイズ `donomana-a11y-font`（`normal`）、読み上げ `donomana-a11y-sr`（`0`）。アプリ固有の設定（音量・難易度・リール速度など）はアプリ側が独自キーで持つ。「既存の3キー…のnamespace・schema・値形式を一切変更しない」。表示系は共通Widget、教材固有の値はアプリ側、という分け方を「正式な境界として確定」。
  - L268-280 §5.5: **SETTINGS_PROXY を正式なApp Adapter境界**とする（宣言するのはselector文字列1つだけ）。
  - **不一致（※コード確認）**: L55 はリセットボタンを「localStorage全キー削除」と書いている。しかし generate.js L1346-1350 が消すのは `donomana-a11y-contrast/font`（とsr）だけ。アプリ固有のキーは消えない。
  - L222: パネルの見出しは「⚙ アクセシビリティ設定」で、heading role がない（将来の改善候補）。

### 1.7 `docs/accessibility/donomana-a11y-panel-keyboard-contract-v1_0.md`
- 状態: タイトル「v0.9.1 (DRAFT)」。L7「本ステータス: DRAFT v0.9.1。GLOBAL-1A Production Released（User Browser Review PASS / Blue2 Real Device Gate PASS / Tobii Real Device Gate PASS…）」。L8で2026-10-09にstatusを更新（対象37アプリ）。
- 取り決め: L20 settings proxy の定義（31/35時点）: クリックするとA11yパネルを閉じ、アプリ固有の設定トリガーに focus+click を渡す。L60: proxyはパネル内部のfocus対象に含める。L126: proxy経由でアプリの設定modalに移るときは、focusを二重に持たない（パネルは `display:none` にする）。L203: テストに「app settings transition」を含める。L151・L174: cup_game と mogura-tataki の設定トグルで、focus-visible がない・disabled属性がないという既知の不具合。

### 1.8 `donomana-design-system-v2_0.html`（内部は Ver.2.1）
- 状態: L1028「全章 確定。Ver.2.1で7.6共通UIコンポーネント・9.9.1 #6・10.5を追加」。New App Standard L46 は「**承認済み・最上位**」と位置づけている。
- 取り決め:
  - **§7.6.1 設定パネル**（L3706付近）: PC・タブレットは固定サイドパネル（幅320〜380px）、スマホはボトムシート（50〜70%）。背景は覆わない。閉じる手段はEscape・外側クリック・閉じるボタンの複数を用意する。閉じる操作はスキャン対象に必ず含める。
  - **§7.6.3 PINロック**（L3726-3731）: 「保護者・教員が、子どもを意図的にブロックするためだけに使う」。許可条件は ①子どものブロックだけが目的 ②実フォーカストラップ ③物理キーボードで数字を入力できる ④デフォルトPINを平文で表示しない ⑤Escapeで抜けられない ⑥スイッチスキャン/キーボードで入力できる ⑦自動タイムアウトなし ⑧**共通化されたコンポーネントを使う（独自実装の新規作成は禁止）**。
  - §7.6.4 ヘルプ（L3735-3740）: 短いものはページ内アコーディオン、長いもの・対象者が複数のものは別画面。入口位置・内容量は Help Standard v1.0 の追補による。
  - §6.3 入力手段の切替（L2960-2972・L3318-3330・改訂記録L872）: 「子ども画面の右上に常設」「どの画面からでも2タップ以内」「**設定の奥に隠さない**」。理由は「『設定 → アクセシビリティ → 入力方法』の奥に置いた瞬間、それは大人が設定するものになります」。画面C「せんせいの設定」のモックには「この設定は、子ども画面の右上からも2タップで変えられます」（L3255）。
  - §6.4 モーション（L3335-3339）: 制限時間は「設定項目としても存在しない」。「設定『動きを減らす』を用意する。ただし既定から既に、減らしてある」。
  - §1.3 ふりがな（L1337）: 「子ども向け画面は既定で全ルビ。設定でOFF」。学年で切り替える方式は採用しない。
  - §1.6（L1400-1420）: 時間制限なし、200%ズームで成立すること、フォーカスは3px。
  - §9.8.1（L1132-1142）: 2026-07時点の調査で、共通パネル内部のボタンは29アプリすべてでスイッチから到達できなかった。

### 1.9 `donomana-modal-accessibility-spec-v1_0.md`
- 状態: 「版: v1.1（初版から改訂・**承認済み**・レビュー完了・main統合済み）」。承認日 2026-08-02。
- 取り決め: L62-64: 設定・ヘルプを新しく作るときは非モーダルにする。新規に認められるモーダルはPINロックだけ。L108: 非モーダル設定パネル（`donomanaA11yPanel` 等）にはこの仕様の要件をそのまま当てはめない。L149: 設定modalでは、見出しか最初の安全な操作要素に初期フォーカスを置く。L221: PINではEscapeで抜けられないようにする。

### 1.10 `donomana-dev-rules-v1.0-revised.md`
- 状態: New App Standard L47 では「Ver.1.0 **承認済み**」。本文に設定UIそのものの規定はない。L567「ローカル保存を変更する場合は、既存データとの互換性を考慮する」のみ。

### 1.11 `donomana-storage-architecture-v2_0.md`
- 状態: 「版: v2.0（**Phase20-B設計 + Phase20-C1〜C7a実装検証を反映して確定**）」。L10「v1.0設計は承認済み。v2.0は…確定版」。
- 取り決め: L83「localStorage / IndexedDB等の既存キーを安易にrename/deleteしない」。L86「ユーザー操作なしのデータ破棄は禁止」。設定キーの命名規則・共有キーの規定はない。

### 1.12 `donomana-typography-spec-v3_0.md`
- 状態: 「版: v3.0（改訂4・レビュー待ち・未承認・未統合）」。L10「本文書はドラフトである」。
- 設定に関係する点: L36-37・L198: ブラウザやOSの文字サイズ設定に追従することを優先する。`html` の font-size を固定pxで上書きしない。ページズームだけで「文字拡大対応」とみなさない。L662: 設定modalの見出しは「教員・保護者・介助者向け」の小〜中型modalとして分類する。

### 1.13 `docs/design-system/donomana-input-operation-support-guide-design-v1_0.md`
- 状態: 「Status: **FINALIZED（設計確定）**」（L3）。2026-09-28。
- 取り決め: L105・L295・L321: ガイドでは dwell の値と用語を**新しく定義しない**。Gaze Standard と完全に一致させる（既定900ms、300–3000ms/100ms刻み）。L107: 共通A11yパネルは表示モード・文字サイズ・各アプリ設定への入口であり、スイッチや視線入力の説明はしていない。L182-188: どのまな画面ロックの既存コピーを流用する。L241: 「最適な設定（**走査速度**・1スイッチ/2スイッチ）は異なる旨」を書く。L339: トラブル確認の順序は「ブラウザ設定 → アプリ内設定 → ドウェル設定 → ターゲットサイズ → 画面ロック」。

### 1.14 Donomana Access 設計（`donomana-access-assessment-design-v2_0.md` / `..._v2_1-draft.md`）
- v2.0 の状態: 「設計統合版 v2.0（永続保存版）」。作成日 2026-10-18。v2.1 はファイル名が `-draft` だが、本文は「**APPROVED — 2026-10-18** 本文書はユーザーにより正式承認されました」（L3-4）。
- 取り決め: v2.0 L39・L172: 外部スイッチは `SCAN_SPEED_MS=1200` 固定（※コード確認: donomana-access.html L423）。L104・L114: 記録を比べるときは「スキャン速度設定が同一」を条件とし、「この走査速度（○ms）での操作傾向です」と書く。L236「スキャン速度を将来設定可能にするかどうか自体は本文書では決定していない」。L16: スワイプのしきい値（10px）を教員が調整するUIは今回の対象外。
- 保存キー: `donomana_access_log_v1`、`donomana_access_teacher_notes_v1`（v2.0 L161、v2.1 L33）。**ほかのアプリと共有する設定キーではない**（※コード確認: これらのキーを参照するのは `donomana-access.html` だけ）。
- `tools/donomana-access-poc/README.md`: 「開発中、Phase 2」「まだ apps-data.json / index.html / generate.js には登録していない」。設定に関する規定はない。

### 1.15 Multi-Input 設計群（`docs/multi-input/`）
- `multi-input-program-design-v1.md`（v1.3）: L212・L356 dwellは900msで確定。可変の設定は当初は実装しない（その後 Gaze Std で REQUIRED になった）。L232: 入力方式を選ぶUIは作らず、自動併用を既定にする（設定入口一本化との整合を理由に挙げている）。L245・L358: しずか/ふつう/にぎやかの3段階はまだ正式仕様にしない。
- `miru-hirogaru-design-v1.md`（v1.2）L392: 「**Switch interval: 1500ms固定（設定UIなし）**」。`mitsukete-touch-design-v1.md`（v1.2）L236: 同じく1500ms固定。設定はsound・fullscreen・共通パネル。`junban-miyou-design-v1.md` L153: Auto Scan 1500ms。
- `dotchiga-ii-design-v1.md`（Help Standard の Reference Implementation）: L300-310 §18「設定過多にしない」。最小限の候補として音・音声ラベル・Level・えらぶかいすう・アニメ・左右入れ替え（既定ON）・Gaze 8項目・「Switch Scan設定（既存共通パターン、スキャン間隔等）」を挙げる。L320-324: 名前の検討で「ためすかいすう」は評価っぽく聞こえるので却下。L588 §34.7: 設定のトップレベルを「あそび／おと・ひょうじ／しせん…」に分け、その中に Gaze の4群を入れる。L620: Activity Selector を設定の中から上部タブに出した（操作の段階を1つ減らすため）。L931-935 §40.7: Settings の先頭に `<details>❓ つかいかた` を置いた（のちに Help Standard で、入口は Common Chrome に移す方針になった）。

### 1.16 そのほかの関連文書
- `donomana-sawatte-hirogaru-design-contract-v1_0.md`（「DRAFT / Design Finalized」）L417: 設定入口は一本化し SETTINGS_PROXY を使う。L491: 固有設定は増やしすぎない（Reaction Intensity「やさしい／ふつう／はっきり」）。L495: 設定を隠して「はじめる」だけを出す Simple Start を検討。L499: **教師・支援者向けの設定と、児童生徒用のActivity Surfaceを明確に分ける**。
- `donomana-fishing-app-design-roadmap-v1_0.md`（「版：1.0」）L15・L166-182: 入力設定は「まきとる量/速さ」。タイミング方式の速さは `.preset-group`。活動中に設定を変えても、その回の結果には反映しない。
- `docs/katachi-awase-size-learning-design-v1.md`（v1.1）L128-133: 詳細設定パネルの奥に置くと見つけにくい、という短所の指摘。
- `docs/donomana-site-renewal-roadmap-v2.md`（Ver.2.1、2026-10-06）L46-48・L174-176: 「今後: 共通A11y Widget」「PINロック共通化」。→ Widget Contract §0・§9 の結論（すでに共通化済み／PINは共通化しない）と食い違っている。
- `docs/design-system/donomana-all-apps-integration-audit-v1_0.md`（v1.0、2026-09-06、アーカイブ注記つき）L78: `donomana-a11y-*` 以外のキーで、アプリ間の重複は0件。
- `docs/design-system/donomana-record-foundation-expansion-inventory-v1.md` L116: a11yの共通設定や `match-prefs3` などは「設定・非Record系storage」であり、記録（Record）と混同しないよう注意。
- `docs/design-system/donomana-learning-record-standard-v1_0.md` L524: kyou-no-kiroku は1つのstateに `a11y:{hc,tts,scan,scanSpeed,gaze,…}` を持つ（`scanSpeed` というフィールド名がある例）。

---

## 2. 公開ページが教員に伝えている設定の情報
- `switch-gaze-guide.html` L948-949: 「**スキャン速度**や設定を調整する — 多くのアプリには、スキャン速度やゆっくりモードなどの設定があります。その子のペースに合わせて調整してください。」。L215: 機器の設定は入力・操作サポートガイドで案内している。
- `input-support-guide.html` L292: どのまな画面ロックは「設定変更や意図しない操作を減らすための機能です。教材画面の🔒ボタンから使えます」。L346: 「**走査速度**なども、お子さんのペースに合わせて調整してください」。L398-404: トラブル確認の順序（どのまな側の入力設定 → ドウェル時間 → ターゲットサイズ）。L228: 最終確認は2026年9月。
- `donomana-access.html` L147: 「かんきょう設定」（音を出す／動きを弱める）。走査は1200ms固定で、ページ上では調整できない。
- → 公開ページの中でも、走査の速さの呼び方が「スキャン速度」と「走査速度」で揃っていない。

---

## 3. 確認できたこと・できなかったこと
- **速度設定の正式な呼び方**:
  - 走査（スイッチ）: 正式な呼び方はない。文書の中では「スキャン速度」「走査速度」「スキャン間隔」「scan interval」「`intervalMs`」「`scanSpeed`」が混在している。
  - 視線入力・動き: Gaze Standard §15.3 に「動きの速さ」(Motion Speed) の対応表がある。速度の段階は「ふつう/ゆっくり」（2段階、Pilot実装）、RECOMMENDED として「はやい／ふつう／ゆっくり」。
- **アプリをまたいで共有する設定の仕組み**: 唯一あるのは共通A11yパネルの `donomana-a11y-contrast` / `donomana-a11y-font` / `donomana-a11y-sr` で、generate.js が全アプリに挿入している。`SR_SKIP_APPS` に登録したアプリでは読み上げを除く。Gazeやスキャンの設定は「アプリごとに1つのsettingsオブジェクト」に入れるのが標準で、アプリ間では共有しない。`donomana-access` という共有キーは存在しない。
- **次のことを定めた文書は見つからなかった**: スキャン速度の既定値・範囲／設定の効果を「ためす」・プレビューする要件／「詳細設定」を段階的に出す正式なルール／設定画面の見出しやボタン名の共通語彙（Gaze以外）／設定の「教員専用」範囲を一般的に定めること（PINの使い方と sawatte の「教師向けと児童向けを分ける」だけ）。
- 作業: grepと通読で調べた。文書の記述を確かめるため、generate.js の SETTINGS_PROXY と リセット処理、各アプリの `donomanaHelpBtn` の有無、donomana-access.html を読み取りで確認した。実機での確認・ブラウザでの確認はしていない。
