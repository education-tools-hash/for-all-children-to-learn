# donomana Modal Accessibility Contract v1.0

WCAG-JIS-AUDIT-1(Tier1+Tier2+Tier3、35アプリ)およびWCAG-JIS-AUDIT-GLOBAL-FIX-TRIAGE-1で確立したFinding Family(FAMILY-A〜E)を統合し、今後の全Modal Fixで使用する正式Contractを定義する。

- 本Contractは`donomana-modal-accessibility-spec-v1_0.md`(v1.1)§21の未決定事項6・13番等を正式決定するものであり、既存specを置き換える。
- 適用範囲: `role="dialog"`で実装される、またはすべきapp固有のオーバーレイ/モーダル。ネイティブ`window.confirm()`/`alert()`/`prompt()`は対象外(§9参照)。

---

## 1. Dialog Semantics — REQUIRED

| 項目 | 決定内容 |
|---|---|
| `role="dialog"` | REQUIRED。全てのapp固有モーダルに必須 |
| `aria-modal="true"` | REQUIRED |
| accessible name | REQUIRED。**優先順位: 1. `aria-labelledby`(可視タイトル要素を参照) → 2. `aria-label`(可視タイトルが存在しない場合のfallbackのみ)**。両方を同時に付与しない(過去のTIER2-F6のような不要な二重指定を避ける) |

**現状の分裂**: mogura-tataki(`aria-label`直接指定、可視タイトルがあるのに`aria-labelledby`を使っていない)、nazorin-print/cup_game/ongaku-app(modal-help)等(`aria-labelledby`使用、こちらが標準形)。**`aria-labelledby`を標準とし、mogura-tatakiのような直接`aria-label`指定は移行対象とする。**

---

## 2. Initial Focus — REQUIRED

Modal open直後、必ずmodal内部の意味のある要素へfocusを移動する。**単純に最初のbutton/inputへfocusする方式(register-appの現状パターン)や、close buttonへfocusする方式(scratch-appの現状パターン)を標準化しない。**

### 優先順位(REQUIRED)

1. **Title要素**(`tabindex="-1"`を付与し、open時に`.focus()`) — 最優先。ユーザーがまず「何のダイアログが開いたか」を認識できる
2. **Active tab/現在状態を表すcontrol**(タイトル相当の安定要素がない場合。例: gaze-keyboardのhrModalのように毎回再描画されるコンテンツで、代わりに`.hr-tab.active`へfocus)
3. **最初の意味のある操作要素**(1・2のいずれも成立しない場合の最終手段。単なる「DOM順で最初のfocusable」ではなく、モーダルの主目的に対応する操作要素であること)

### 現状分類(18アプリ横断で確認された実装パターン)

| パターン | 該当アプリ |
|---|---|
| Pattern 1(Title tabindex=-1 + focus) | matching-app・okane-app・time-timer・tokei-app・janken-app・schedule-app・gaze-keyboard(全モーダル、HARDEN1-3で統一済み)・hiragana-learn・katakana-app(traceSampleViewer)・shiritori2・bosai-app・cup_game(helpModal、Fix済み)・ongaku-app(modal-help) |
| Pattern 3(最初のfocusable control) | register-app(全8モーダル、`openModal()`共通関数で`el.querySelector('button,input,[tabindex]')`を使用) — **非推奨パターンとして移行対象** |
| Pattern 4(close buttonへfocus) | scratch-app(`openHelp()`) — **非推奨パターンとして移行対象** |
| Pattern None(Initial Focus欠如) | mogura-tataki・nazorin-print・tyushi・ongaku-app(modal-pin/export/share) |

**register-appとscratch-appは、Focus Trap自体は一部実装されている/されていないに関わらず、Initial Focusパターンとして非推奨(Pattern 3/4)に分類される。これはTier1完了時点では「Initial Focus Missing」がFinding Familyとして未確立だったため見落とされていた新規事実であり、本Contract確定時に新たに判明した。** FAMILY-B/A Fix実施時にあわせてPattern 1へ統一することを推奨(§19参照)。

---

## 3. Focus Trap — REQUIRED

Modal表示中、Tab/Shift+Tabがmodal内部で循環すること(REQUIRED)。

### 実装方式(既存2パターンの評価)

| 方式 | 内容 | 該当 | 評価 |
|---|---|---|---|
| 端点循環型(端点判定してfirst/lastへ折り返す) | `if(active===last){first.focus()}else if(active===first){last.focus()}` | matching-app・okane-app・time-timer・tokei-app・janken-app・schedule-app・shiritori2・bosai-app・cup_game(Fix後もTrap自体は未実装のため実際はN/A)・ongaku-app(modal-help、Trap未実装のためN/A) | シンプルで実装済み実績多数。**REQUIRED方式として採用** |
| Focus Trap自体が存在しない | Tab-key handlerが皆無 | mogura-tataki・scratch-app・nazorin-print・tyushi・hiragana-learn・katakana-app・cup_game・ongaku-app(modal-help/pin/export/share) | 8アプリ・11モーダルが該当(FAMILY-B対象) |

**決定: 端点循環型をREQUIRED実装方式として採用する。** register-appの`openModal()`共通ヘルパーで確認された`el.querySelector('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')`による`focusables`配列生成ロジックは、端点循環型の実装にそのまま転用可能な既存資産として評価する。

---

## 4. A11y Panel Exception Contract(FAMILY-A) — REQUIRED

Modal Focus Trap処理内で、共通A11yパネル(`donomanaA11yPanel`)が開いている場合の例外処理を正式化する。

### 決定事項

1. **A11yパネルがopen(`style.display==='block'`)の場合、Modal側のFocus Trapは介入しない。** 具体的には、Tab handler冒頭で以下を判定し、該当時は`return`する:
   ```js
   const a11yPanel = document.getElementById('donomanaA11yPanel');
   const a11yBtn = document.getElementById('donomanaA11yBtn');
   if (a11yPanel.style.display === 'block' && (document.activeElement === a11yBtn || a11yPanel.contains(document.activeElement))) return;
   ```
   (okane-app/matching-app/gaze-keyboard[settingsModal]で実証済みのパターンをそのまま正式Contract化)
2. **A11yパネルclose後のfocus復帰先**: A11yパネルは`donomanaA11yBtn`(トリガーボタン)へ自身の責任で復帰する(既存の共通A11yパネル実装が担当)。**元Modal側は何もする必要がない**(A11yパネルとModalは独立したfocus管理を行い、互いのcloseで相手のfocus状態を上書きしない)。これはmatching-app/okane-app/gaze-keyboardの実証済み挙動と一致する

### 現状分裂

- 実装済み(REQUIRED準拠): matching-app・okane-app・gaze-keyboard(settingsModal)
- 未実装(FAMILY-A対象、11アプリ): register-app・time-timer・janken-app・tokei-app(Tier1、TIER1-F2)・shiritori2・bosai-app・ongaku-app(modal-help、Tier2、TIER2-F1)

---

## 5. Escape Priority Contract — REQUIRED

複数Overlayが同時に開きうる状況でのEscape優先順位を正式化する。

### 決定事項(優先順位)

1. **A11yパネル**(最優先。開いていれば最初にこれを閉じる)
2. **Nested overlay/modal**(§13参照。現時点で実例は未確認だが将来のため規定)
3. **Main modal**(app固有モーダル本体)
4. **App state**(ゲーム進行等のapp内部状態。Escapeで戻る対象がなければ何もしない)

### 実装への影響

現状、A11yパネル自身のEscape処理と各アプリのモーダルEscape処理は独立したキーイベントリスナーとして実装されており(`document.addEventListener('keydown', ...)`の多重登録)、優先順位は「後から登録されたリスナーが先に評価される」というブラウザのイベント伝播順に依存している。**これは明示的な優先順位制御ではなく偶然の順序に依存しているため、Fix実施時に上記1〜4を明示的なフラグ確認(「A11yパネルが開いているか」を各モーダルのEscapeハンドラの先頭で確認し、開いていれば何もしない)へ置き換えることを推奨する。**

---

## 6. Focus Restoration Contract(FAMILY-D) — REQUIRED

Modal close後のfocus復帰先を正式化する。

### 決定事項(優先順位)

1. **Opener element**(モーダルを開いた起点要素。原則) — hiragana-learn/katakana-app(`traceSampleViewerPrevFocus`パターン、`document.activeElement`を開く前に保存)が最も堅牢な実装
2. Openerが**DOM上に存在しない/disabled/hidden/inert/detached**の場合のfallback順:
   - a. **論理的な代替control**(opener相当の役割を持つ現存要素。例: openerが削除されたリスト項目の場合、リストの次の項目や親コンテナの操作ボタン)
   - b. **最も近い安定したcontrol**(アプリのメインナビゲーション/固定ツールバー内の要素)
   - c. **アプリのメイン見出し(H1)**(tabindex="-1"を付与しfocus)
   - d. **`<main>`ランドマーク要素**(tabindex="-1"を付与しfocus)
   - e. **`document.body`**(最終手段。**フォールバックの最後の砦としてのみ許容し、通常の設計目標にはしない**)

### register-app TIER1-F5への適用

TIER1-F5(product-modal[pmModal]closeで`pmOpenerEl`がBODYへ退行)は、`pmOpenerEl`(MutationObserverで管理される起点要素参照)がDOM再描画によってdetached状態になることが根本原因。**本Contractの2-a/2-bを適用し、「削除された起点要素の代わりに、再描画後の商品リストの対応する新しい要素、または存在しなければ商品リストのコンテナ自体」へフォールバックする設計を正式仕様とする。** 実装はしない(次Phase)。

---

## 7. Background Suppression Contract(FAMILY-E) — REQUIRED

### 方式比較

| Plan | 内容 | Browser support | AT挙動 | Switch/Gaze影響 | 復帰の複雑さ | 実装規模 | 既存donomanaパターン |
|---|---|---|---|---|---|---|---|
| B1: `inert`属性 | 背景コンテナに`inert`を付与 | Chrome/Edge/Safari 17+で標準サポート、Firefoxは112+で対応 | AT探索・Tab双方から確実に除外 | Switch/Gaze候補からも自動除外(`[inert]`を候補構築ロジックで除外済みのアプリが多数) | 単純(属性の付け外しのみ) | 小 | 系統A(matching-app/okane-app/gaze-keyboard)・系統B(tokei-app等、モーダル自身への静的inert) |
| B2: `aria-hidden` + tabindex抑制 | 背景に`aria-hidden="true"`+各操作要素へ`tabindex="-1"`を個別付与 | 全ブラウザ対応済みだが実装が煩雑 | AT探索からは除外されるが、`aria-hidden`祖先内のfocusable要素へブラウザの標準Tabで到達できてしまう既知の問題あり(いわゆる"aria-hidden focus leak") | 個別付与漏れのリスクが高い | 中〜大(要素数分の付け外し) | 未使用 |
| B3: イベント傍受のみ | 背景クリック/フォーカスイベントをJSで捕捉しキャンセル | 全ブラウザ対応 | ATの探索自体は防げない(読み上げは可能なまま) | 部分的 | 中 | 系統C(schedule-app、端点循環型Focus Trapのみで背景を明示的に抑制しない) |
| B4: ハイブリッド | inert+視覚的な非活性化(opacity等) | B1準拠 | B1と同等 | B1と同等 | 小〜中 | 未使用 |

### 決定

**Plan B1(`inert`属性)をREQUIRED方式として採用する。** 理由: 既にdonomanaコードベースの3アプリ(系統A)で実証済み、AT/Switch/Gaze全てに対して単一の属性操作で一貫した除外を実現でき、実装規模も最小。

**例外**: 共通A11yパネル(`donomanaA11yPanel`)は`inert`のスコープに含めない(§10で範囲を明示)。ブラウザのFirefox 111以前など`inert`未対応の古い環境への配慮は、視覚的な非活性化(opacity低下等、Plan B4のハイブリッド要素)を保険的に併用することを推奨する。

### 現状の4系統(再掲、Contract未適用状態)

| 系統 | 対象app数 | 対象 |
|---|---|---|
| A(inert、Contract準拠) | 3 | matching-app・okane-app・gaze-keyboard(settingsModal) |
| B(モーダル自身への静的inert、背景は未抑制) | 5 | tokei-app・janken-app・register-app・time-timer・shiritori2 |
| C(inertなし、端点循環型Trapのみ) | 1 | schedule-app |
| D(背景抑制自体が存在しない) | 9 | mogura-tataki・scratch-app・nazorin-print・tyushi・hiragana-learn・katakana-app・bosai-app・cup_game・ongaku-app |

**系統B・C・Dの15アプリが移行対象。**

---

## 8. Background Suppression Scope — REQUIRED

`inert`対象の範囲を正式化する。

| 対象 | inert適用 |
|---|---|
| App main(`<main>`等の主要コンテンツ領域) | ✅ 適用 |
| Common chrome(Home/Lock/Fullscreenボタン群) | ✅ 適用 |
| Home button | ✅ 適用(chromeに含む) |
| Settings proxy(`donomanaSettingsProxy`) | ✅ 適用(app本体の一部として扱う) |
| 他のoverlay(app固有の別モーダルが同時に存在する場合) | ✅ 適用(§13のnested overlay contractと整合) |
| **共通A11yパネル(`donomanaA11yPanel`)とそのトリガーボタン(`donomanaA11yBtn`)** | ❌ **適用しない**(§4のA11yパネル例外と整合。モーダル表示中も常に操作可能) |

---

## 9. Native `confirm()`の扱い

`window.confirm()`(記録削除等の破壊的操作確認で使用、35アプリ中21のRecord Foundation対象アプリで確認)は、**本Contractの対象外とする**。理由: `confirm()`はブラウザ標準実装であり、role/aria-modal/Focus Trap/初期focus/フォーカス復帰の全てをブラウザ自身が保証する。カスタムモーダルへの置換は、より柔軟なUI(削除理由の入力等)が必要になった場合にのみ検討する将来課題とし、**現時点でFix対象に含めない**ことを正式に明記する。

---

## 10. Switch Scan Contract — REQUIRED

Modal表示中のSwitch Scanについて:

1. **候補をmodal内部へ限定**: `settingsPanel.querySelectorAll('[tabindex="0"]')`のような、modal自身のサブツリーに限定したquerySelectorを候補構築ロジックの入口条件に追加する(katachi-awase-app等の`buildScanItems()`で既に確立済みのパターン、§8背景の`inert`適用と組み合わせれば`[inert]`を除外する既存ロジックだけで自動的に達成される場合が多い)
2. **背景候補の除外**: §8のinert適用により、`el.closest('[inert]')`チェックを持つ既存の候補構築ロジック(hiragana-learn/katakana-app/shiritori2/bosai-app/cup_game等で既に確認済みの`el.closest('[hidden]') || el.closest('[inert]')`パターン)がそのまま機能する
3. **A11yパネル開時のscope移行**: A11yパネルが開いた場合、Switch Scanのscopeもパネル内へ移行する(既存のA11yパネル自体の実装に準拠。本Contractでは新規要件を課さない)
4. **パネルclose時のscope復帰**: A11yパネルを閉じた際、Switch ScanのscopeはA11yパネル開始前の状態(modal内)へ自動復帰する(候補構築ロジックが都度再評価される設計であれば自動的に満たされる)

**標準化する。** cup_gameのFIX-P1-B検証時に発覚した「help modal表示中の候補分離が不完全([`cup-wrapper disabled`, `cup-wrapper disabled`]という重複した無効候補を返す)」という既存の潜在的な問題は、本Contractの#1適用と合わせて是正することを推奨する(現時点ではFinding化せず、FAMILY-B Fix実施時に併せて確認する)。

---

## 11. Gaze Contract — REQUIRED

Modal表示中のGazeについて:

1. **modal内部targetのみ有効化**、背景targetは§8のinert適用により自動的に無効化される
2. **dwell reset**: modal open時、進行中のdwellタイマーは破棄しmodal内要素で新規に開始する
3. **A11yパネル表示時のscope移行**: Switch同様、A11yパネル自身の実装に準拠
4. **modal close後のstate restoration**: dwell設定(速度・サイズ等)はグローバル設定のため、modal open/closeで変更しない。進行中のdwellタイマーのみリセットする

**標準化する。** 実装詳細はFAMILY-B Fix実施時にgaze-keyboard/drawing-app/katachi-awase-app等の既存実装を比較の上で確定する。

---

## 12. Nested Modal / Overlay Contract

現時点で35アプリ中、modal上にさらに別のconfirm/picker等が重なる実例は本Auditの範囲では確認されていない(A11yパネルとapp固有モーダルの共存が唯一の「2階層」の実例)。将来のため以下を規定する:

- **Focus stack**: 各overlay開時に直前の`document.activeElement`をスタックへpush、close時にpopして復帰する(hiragana-learn/katakana-appの`traceSampleViewerPrevFocus`パターンをスタック化したもの)
- **Escape stack**: §5の優先順位を「スタックの最上位から処理する」という形で一般化する
- **Restoration stack**: Focus stackと同一
- **Inert scope**: 新しいoverlayが開くたびに、それより下位の全レイヤー(app本体+既存overlay)へinertを適用する

**現時点で適用実例がないため、この節はOPTIONAL(将来の拡張時に参照する設計指針)とする。**

---

## 13. Contract項目のREQUIRED/RECOMMENDED/OPTIONAL/NOT REQUIRED分類

| 項目 | 分類 |
|---|---|
| Dialog semantics(role/aria-modal) | REQUIRED |
| Accessible name(aria-labelledby優先) | REQUIRED |
| Initial Focus(Title優先) | REQUIRED |
| Focus Trap(端点循環型) | REQUIRED |
| A11yパネル例外 | REQUIRED |
| Escape(優先順位付き) | REQUIRED |
| Focus Restoration(フォールバック順位付き) | REQUIRED |
| Background Suppression(inert方式) | REQUIRED |
| Background Suppression Scope | REQUIRED |
| Switch Scan Contract | REQUIRED(Switch宣言アプリのみ) |
| Gaze Contract | REQUIRED(Gaze宣言アプリのみ) |
| Nested Overlay Contract | OPTIONAL(将来拡張) |
| Native confirm()置換 | NOT REQUIRED(現時点でFix対象外) |
| Focus stack汎化(§12) | OPTIONAL |

**REQUIRED項目は8つ(適用対象アプリの入力方式に応じてSwitch/Gazeが加算)。全て未決のまま残った項目はない。**

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase WCAG-JIS-MODAL-SPEC-DECISION-1。donomana-modal-accessibility-spec-v1_0.md §21の未決定事項6・13番等を正式決定。 |
