# A11y Panel Global Rollout Plan

`WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1`の監査結果(`a11y-panel-global-conformance-matrix.md`)を踏まえた、安全な横展開アーキテクチャとBatch構成の設計案。§9(GLOBAL-1A実装結果)追記以前の内容はPlan(未着手時点)、§9以降はGLOBAL-1A Pilot実装のRC結果を記録する。**Production変更(merge/push/release)はまだ行っていない。**

---

## 1. 共通層で直せるか判断(§19)

| 選択肢 | 内容 | 評価 |
|---|---|---|
| A. 共通A11y component/helperで一括修正可能 | `generate.js`の`buildA11yPanelHTML`に、strict containment用のTab/Shift+Tab handlerとEscape focus restoration処理を追加し、全35アプリへ自動反映する | Escape focus restoration(§4)は**A案で対応可能**と判断する。共通層のコードのみで完結し、app固有DOM構造に依存しない(`btn.focus()`を追加するだけ) |
| B. 共通層 + app adapter必要 | Strict Containment(Tab/Shift+Tab循環)自体は共通ヘルパー化できるが、Modal Coexistence(app固有modalとの優先順位分岐)は各アプリのmodal構造(`activeXxxModal()`相当の関数)に依存するため、app側に「現在modalが開いているか」を返す薄いadapter関数を要求する必要がある | **Strict Containment(§3)はB案が現実的**と判断する |
| C. 各アプリ個別実装しか安全でない | 既にFamily B/C(tyushi・cup_game・katakana-app・hiragana-learn・schedule-app)は独自のcluster実装を持ち、それぞれ微妙に異なるmodal優先順位分岐ロジックを持つ。これらを共通ヘルパーへ強制移行すると、既存のmodal Focus Trap(FAMILY-B/D等で個別にFix済み)との統合テストが必要になり、影響範囲がFAMILY-B/D双方に及ぶ | Family B/C(5アプリ)は個別移行(C案寄り)、Family D(29アプリ、特にD-3の20アプリ)は共通ヘルパー適用が比較的安全(B案) |

### 判断根拠

- **DOM構造差**: A11yパネル自体のマークアップ(`donomanaA11yPanel`/`donomanaA11yBtn`)は全35アプリで完全に共通(`generate.js`が生成)。したがってcluster構成ロジック(internal focusable抽出)自体は共通ヘルパー化に適する。
- **Modal Ownership**: 「現在どのmodal/panelがtop layerか」の判定はアプリごとに異なる関数(`activeScheduleModal()`・`activeOkaneModal()`等)で実装されており、これを無理に統一すると既存のFAMILY-B/D修正実績(20+アプリ)を壊すリスクがある。
- **Opener構造**: `donomanaSettingsProxy`は共通層(`SETTINGS_PROXY`マップ)で既に統一されており、追加のapp adapterは不要。
- **Dynamic Controls**: img-modal(schedule-app)のような動的生成コンテンツを持つmodalは、cluster構築のたびにDOM再走査が必要(既存実装は対応済み)。共通ヘルパーもこの制約を継承する必要がある。
- **Settings Proxy**: 31/35アプリが共通`SETTINGS_PROXY`経由。この機構自体は既に十分にhardening済み(Phase16.43〜16.45)であり、今回の横展開では変更不要。
- **Switch/Gaze**: Tab-key based containmentはSwitch Scan/Gazeの独立したスキャン・dwell機構と直接競合しないと考えられるが、Pilot実装時に個別回帰確認が必須(§21)。
- **Legacy Implementation**: Family B/C(5アプリ)は既にRC実装・User Reviewを経てProduction反映済みのコードを持つため、それらを「間違っているから全部書き換える」のではなく、「不足しているopener/toolbar除外ロジックだけを追加する」最小差分アプローチが望ましい。

**結論**: Strict Containment自体はB案(共通ヘルパー + 薄いapp adapter)、Escape Focus Restorationは共通層のみのA案で対応可能、と設計する。Family B/C(5アプリ)は個別の最小差分修正、Family D(29アプリ)は共通ヘルパー適用を軸としたBatch構成とする。

---

## 2. 共通Helper候補(設計案のみ、未実装)

既存の命名規則(`donomanaIsFocusable`・`donomanaFirstFocusable`・`donomanaAnnounceA11y`等、`generate.js`で使われる`donomana`プレフィックス)に合わせる。

```js
// generate.js の buildA11yPanelHTML() 内、共通スクリプトとして追加する候補

// A11yパネルが現在OPEN中か
function donomanaA11yPanelIsOpen() {
  return panel.style.display === 'block';
}

// A11yパネル内部のvisible/enabled focusable要素を返す(opener自身は含まない)
function getA11yPanelFocusables(panelEl) {
  return Array.from(panelEl.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
    .filter(donomanaIsFocusable); // 既存のdonomanaIsFocusable()を再利用
}

// A11yパネルのTab/Shift+Tabをstrict containmentする(document-level keydownから呼び出す)
// 戻り値: このhandlerがイベントを処理した(preventDefaultした)場合true
function trapA11yPanelFocus(e) {
  if (e.key !== 'Tab' || !donomanaA11yPanelIsOpen()) return false;
  const items = getA11yPanelFocusables(panel);
  if (!items.length) return false;
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement;
  const inPanel = items.includes(active);
  if (e.shiftKey) {
    if (!inPanel || active === first) { e.preventDefault(); last.focus(); }
  } else {
    if (!inPanel || active === last) { e.preventDefault(); first.focus(); }
  }
  return true;
}

// A11yパネルをEscape/外側クリックで閉じる際、明示的にopenerへfocusを戻す
function restoreA11yPanelFocus() {
  if (donomanaIsFocusable(btn)) btn.focus();
}
```

### アプリ側adapter(app固有modalとの優先順位分岐、薄いinterface)

```js
// アプリ側で1関数だけ実装してもらう想定(既存のactiveXxxModal()等をそのまま流用可能)
// 例: schedule-appなら activeScheduleModal、okane-appなら activeOkaneModal
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab') return;
  if (trapA11yPanelFocus(e)) return; // A11yパネル優先(§5 Modal Coexistence)
  const modal = /* アプリ固有: 現在openのtop modal判定 */;
  if (!modal) return;
  // ...既存のmodal Focus Trapロジック(変更不要)
});
```

この設計であれば、Family D(29アプリ)は`trapA11yPanelFocus`/`restoreA11yPanelFocus`を共通層から読み込むだけで済み、Family B/C(5アプリ)は既存の独自cluster関数を`getA11yPanelFocusables`ベースの実装へ置き換える(opener/toolbar混入を除去する)最小差分修正で済む。

---

## 3. Pilot対象選定(§22)

| 候補 | 理由 | 代表性 |
|---|---|---|
| **mogura-tataki** | Reference / PASS baseline(既にProduction Conformant) | 横展開の正解を示す基準点 |
| **tyushi** | Family B、乖離最大(opener+toolbar両方含む)、Gaze対応・スキャンモード実装済み | Family B唯一の代表、Gaze影響確認の代表も兼ねる |
| **cup_game** | Family C、コメント/実装矛盾の典型例、Gaze対応・Switch対応・Touch対応 | Family C(4アプリ中)の代表、コメント修正も同時に行える |
| (追加候補) **schedule-app** | Family C variant、A11yパネル単独open時にcontainmentが発火しない特殊ケース(§2.1既知) | modal-heavy app(new-modal/print-modal/img-modal 3種)の代表、Dynamic Controls(img-modal)対応の実証にもなる |
| (追加候補) **gaze-keyboard** | Family D-1(guard-only)、Switch対応は非対応だがGaze/dwell実装が最も高度、既存Ledgerで「mogura-tataki RC4パターン未適用」と推定記録済み | Gaze app代表、既存Findingとの統合検証も兼ねる |

**Pilotは mogura-tataki(基準)・tyushi(Family B)・cup_game(Family C)の3件を最小構成とし、modal-heavy appの代表としてschedule-appを、Gaze appの代表としてgaze-keyboardを追加した5件を推奨する。** これによりFamily A/B/C全て、Gaze対応・Switch対応・Dynamic Controls・guard-onlyパターンの代表性を確保できる。

---

## 4. Regression Test Contract(§23、案)

`donomana-a11y-panel-keyboard-contract-v1_0.md`§10を正式なtest matrixの土台とする。Pilot実装時は以下を最低限必須とする:

- A11yパネル: open / Forward20-30回 / Reverse20-30回 / first boundary / last boundary / outside-focus / Escape / close restoration / mouse close / app settings transition(settings proxy経由)
- Modal Coexistence: background modal存在下でのA11yパネルopen / nested overlay / A11yパネルclose後のmodal Trap復帰
- Input: Keyboard(必須) / Touch(必須) / Switch(Switch対応アプリのみ) / Gaze(Gaze対応アプリのみ)
- Visual: Visible Focus / Responsive(390×844/768×1024/1280×900)

---

## 5. Rollout Batch案(§29)

| Batch | 対象 | 内容 |
|---|---|---|
| **GLOBAL-1A** | mogura-tataki(基準)・tyushi・cup_game・schedule-app・gaze-keyboard(5アプリ) | Contract/Helper Pilot。共通ヘルパー(`getA11yPanelFocusables`/`trapA11yPanelFocus`/`restoreA11yPanelFocus`)を`generate.js`へ追加し、Family B/C 5アプリの既存cluster実装を置き換え、Family D-1のgaze-keyboardへ新規適用。User Browser Review必須 |
| **GLOBAL-1B** | katakana-app・hiragana-learn(schedule-appと同型のC実装2アプリ)・okane-app・matching-app・ongaku-app(D-1残り3アプリ)・nazorin-print・shiritori2・tokei-app・janken-app・bosai-app(D-2、5アプリ)・timetable-app(P1最優先) | same-pattern apps。GLOBAL-1Aで確立したhelperをそのまま適用可能なアプリ群。timetable-appはbrowser chrome escape実証済み(P1)のため最優先で含める |
| **GLOBAL-1C** | D-3の残り19アプリ(time-timer・scratch-appは disabled-state Separate Finding調査と合わせて個別確認) | legacy/special apps。単一画面型(modal無し)アプリが多く含まれるため、A11yパネル単体のcontainmentのみで完結し、Modal Coexistence adapterは不要なケースが多い |
| **GLOBAL-1D** | 全35アプリ | Production re-audit。GLOBAL-1A〜1Cの反映後、本Matrixと同形式で全35アプリを再評価し、Strict Containment Conformant数が35/35になっていることを確認する |

---

## 6. FAMILY-B/C/D/Eとの関係整理(§30-31)

- **FAMILY-B**: 本Global Phaseは、FAMILY-B residual 4件そのものをResolvedにしない。FAMILY-B residual count = **4のまま維持**。ただし、GLOBAL-1Bで対象となるkatakana-app/hiragana-learn(Family C)は既にFAMILY-B-BATCH-7でTECHNICALLY RESOLVED済みのTIER2-F2-c/dとは別軸(A11yパネル自体のcontainment)の修正であり、重複修正には当たらない。順序としては、GLOBAL-1系のFixがFAMILY-B側のFinding番号に影響を与えないよう、Batch-7とは独立したFinding ID体系(GLOBAL-1固有のFinding ID)で管理することを推奨する。
- **FAMILY-C(Initial Focus)**: A11yパネル自体にはInitial Focus実装がない(open時に最初の要素へfocusを移す処理が共通層に存在しない)。本Contractでは意図的に扱わなかった(A11yパネルはボタンクリックで開くため、クリックしたボタン自身に自然にfocusが残る設計を許容)。ただし、settings proxy等のクリック不能な起動経路がある場合は要確認。cross-family dependencyとして記録する(Findingを統合・Closeしない)。
- **FAMILY-D(Focus Restoration)**: 本Phaseで確認したA11yパネルのEscape/close時のBODY focus loss(§4)は、既存FAMILY-D(app固有modal向け)とは別の、A11yパネル自体に固有のFocus Restoration欠如である。既存FAMILY-Dのいずれの個別Findingとも重複しないが、概念的に同じ「Focus Restoration」カテゴリに属するため、命名・Finding ID付与時に既存FAMILY-Dとの混同を避けること。
- **FAMILY-E(Background Suppression)**: A11yパネルOPEN中の背景要素への`inert`適用は共通層に存在しない(§5)。既存の「A11yパネル例外」列(TIER1-F2/TIER2-F1、`modal-conformance-matrix.md`)とも異なる軸であり、統合しない(§4末尾参照)。

---

## 7. 未解決のSeparate Findings(維持、今回は修正しない)

- A. mogura disabled-state mismatch(`dwT`/`togCur`/`dwTol`)
- B. A11yパネルEscape focus restoration → BODY(本Phaseで35アプリ共通の構造的リスクと確認)
- C. tyushi containment divergence(Family B)
- D. cup_game containment divergence(Family C)
- E. (新規)schedule-app: A11yパネル単独open時にcontainmentが発火しない
- F. (新規候補)scratch-app・time-timer: disabled-state mismatch疑い(`body.locked`パターン)
- G. (新規候補)cup_game settingsOverlay: Visible Focus欠如(既存記録の継続)

---

## 8. Stop(GLOBAL-1 Owner Review時点)

本Planは調査・設計・Batch案の提示までとする。Pilot実装・全アプリ修正・Production merge/push/release/cleanup・FAMILY-B Batch-7(既にRELEASE済みのため該当なし、次のFAMILY-B関連Batchがあれば同様)は、本Phaseでは一切開始しない。Owner Reviewを待つ。

---

## 9. GLOBAL-1A実装結果(2026-09-09、Owner Approved後)

Owner Decision(a)(b)(c)(d)により、Pilot 5アプリ(mogura-tataki・tyushi・cup_game・schedule-app・gaze-keyboard)への実装、およびEscape Focus Restorationの共通層修正を実施した。worktree `for-all-children-to-learn-a11y-panel-global-1a`、branch `fix/a11y-panel-global-pilot-1a`(`origin/main`@`12c00da`から作成、drift無し)。

### 実装内容

- **共通層(`generate.js`)**: `getA11yPanelFocusables(panelEl)`・`trapA11yPanelFocus(e)`・`restoreA11yPanelFocus()`を`buildA11yPanelHTML`のDOMContentLoadedコールバック内に追加し、`window`経由で公開(§2の設計案どおり、既存helper[`donomanaIsFocusable`等]との重複なし、命名衝突なしを確認)。Escapeハンドラを`btn.click()`委譲から直接close+`restoreA11yPanelFocus()`呼び出しへ変更(全35アプリ共通、`node generate.js`実行で反映)。
- **mogura-tataki**: 既存の`moguraA11yClusterFocusables`(Reference実装、既にopener/toolbar除外済み)を削除し、`window.trapA11yPanelFocus(e)`への委譲に置換(重複実装の解消)。
- **tyushi**: 既存の`a11yClusterFocusables`(opener+toolbar含む、Family B)を削除し、`window.trapA11yPanelFocus(e)`への委譲に置換。加えて、A11yパネル判定がhelp-overlay(`overlay.style.display==='none'`)open時のみ発火する構造的欠陥を発見・是正(判定をTabキーlistener最上位・無条件へ移動)。
- **cup_game**: 既存の`cupGameA11yPanelFocusables`(opener含む、コメント/実装矛盾、Family C)を削除し、`window.trapA11yPanelFocus(e)`への委譲に置換。
- **schedule-app**: 既存のA11yパネル分岐(opener含む、`activeScheduleModal()`が非nullの場合のみ発火する構造的欠陥、Owner Decision(c)対象)を削除し、Tabキーlistener最上位で`window.trapA11yPanelFocus(e)`を無条件呼び出す形へ是正。
- **gaze-keyboard**: 既存実装はguard-only(containment自体なし、Family D-1)だったため、新規に`if(scanMode)return; window.trapA11yPanelFocus(e);`という専用listenerを追加(Switch Scan動作中は既存settingsModal Trapと同様に無効化)。既存のsettingsModal/profileModal/hrModalのguard節はそのまま維持(相互に非干渉)。

### Pre-fix / Post-fix実機検証(Microsoft Edge、5アプリ共通)

Forward Tab 30回・Reverse Shift+Tab 30回・immediate Shift+Tab・outside-focus-guard(Tab/Shift+Tab)・Escape restoration(Panel内部3 Tab後・`donomanaA11yReset`から直接の両方)を実施し、**5アプリ全てで完全に同一の結果**を得た:

- Forward/Reverse 30回: opener(`donomanaA11yBtn`)・common toolbar(`donomanaHomeBtn`/`donomanaRecordNavBtn`/`donomanaLockBtn`/`donomanaFsBtn`)・browser chromeへの遷移ゼロ。Panel内部8要素(`donomanaSettingsProxy`〜`donomanaA11yReset`)のみで循環。
- immediate Shift+Tab: `donomanaA11yBtn`→`donomanaA11yReset`(Panel内最後の項目)。
- outside-focus-guard: `document.body.focus()`後のTabで`donomanaSettingsProxy`(Panel内最初の項目)へ強制送還。
- Escape restoration: Panel内部の任意の深さからEscapeを押しても`document.activeElement`が`donomanaA11yBtn`へ確実に復帰(BODY退行ゼロ)。
- Console/page errors: 全アプリ・全ケースで0件。

### Modal Coexistence実機検証

- tyushi: help-overlay単独・A11yパネル単独(help-overlay閉状態)・両方同時openの3パターンを検証、いずれもcontainmentが正しく発火(旧構造的欠陥の解消を確認)。
- cup_game: helpModal単独・helpModal+A11yパネル同時openを検証、優先順位分岐が正常動作。
- schedule-app: A11yパネル単独open(3modalいずれも非open)でcontainmentが正しく発火することを確認(Owner Decision(c)で指摘された既知バグの解消)。
- gaze-keyboard: settingsModal(`donomanaSettingsProxy`経由の実フロー)+A11yパネル同時open、A11yパネル単独openの両方を検証、優先順位分岐が正常動作。
- mogura-tataki: 既存の5modal(scrStart等)との優先順位分岐に回帰なし。

### Responsive / Touch実機検証

5アプリ×3viewport(390×844/768×1024/1280×900)、Touch環境ではtouchscreen tap APIでA11yパネルをopenし、Forward Tab 8回でopenerへの遷移ゼロを確認。全15ケースPASS、Console/page errors 0件。

### Visible Focus regression

5アプリのdiffに`:focus-visible`関連CSSへの変更が含まれないことを確認(`git diff`でカウント0件)。既存のVisible Focus実装(mogura-tatakiの`.tog input:focus-visible+.ts`等)への影響なし。

### Switch / Gaze影響

gaze-keyboardの新規listenerには`if(scanMode)return;`ガードを追加し、既存のSwitch Scan Tab Trap無効化パターン(settingsModal Trap)と同一の設計思想を踏襲した。Gaze/dwellロジック(pointerイベント系)自体には一切触れていない。**実機(Tobii/Switchデバイス)によるUser Real Device Gateを実施し、Blue2(Switch)・Tobii(Gaze)ともPASS。GLOBAL-1A Pilot 5アプリのStrict Containment/Escape Focus Restorationについて実機由来の新規回帰は0件。** gaze-keyboard/schedule-appの既存Switch Scan関連の別findingは`donomana-a11y-panel-keyboard-contract-v1_0.md`§9(Separate Findings、PRE-EXISTING/NON-BLOCKING)を参照。本Pilotのcontainment実装が原因ではなく、修正はしていない。

### Static Validation

`git diff --check`エラーなし。変更ファイルは意図した6ファイル(`generate.js`+Pilot 5アプリ)のみ、`node generate.js`実行後も`app-details/`・`index.html`・`apps-data.json`・`sitemap.xml`への意図しない差分はゼロ(確認済み)。ID重複なし(5アプリとも)。`node --check generate.js`構文エラーなし。

### disabled-state Separate Findings(維持、変更なし)

mogura-tataki・scratch-app・time-timerの3件は、GLOBAL-1A scopeに含めず、コード変更を一切行っていない(Owner Decision(d)どおり)。

### Escape Priority(§25)との整合

tyushi/schedule-appの是正は、A11yパネルのcontainment判定をTabキーlistenerの最上位に移動しただけであり、Escapeキーの優先順位(共通層のEscapeハンドラが引き続き最優先)には触れていない。既知の同時close問題(A11yパネルとapp固有modalが1回のEscapeで同時に閉じる等)は本Pilotのscope外であり、発見・修正の対象としていない(scope expansion回避)。

### FAMILY-B残件

FAMILY-B Production residual count: **4のまま維持**(Owner Decision §34どおり、Production未反映のため変更なし)。

### Formal Status

**WCAG-JIS-A11Y-PANEL-STRICT-CONTAINMENT-GLOBAL-1A = PRODUCTION RELEASED / USER REVIEW COMPLETE / BLUE2 VERIFIED / TOBII VERIFIED / GLOBAL-1A COMPLETE**

Pilot 5アプリ全てで、Strict Containment・Escape Focus Restoration・Modal Coexistence・Visible Focus regression・Responsive・Touch・Console/Static Validationが完全にPASSした。User Browser Review PASS、Blue2 Real Device Gate PASS、Tobii Real Device Gate PASS。Production baseline `837d454`。New regression 0。

**Separate Findings(PRE-EXISTING / NOT CAUSED BY GLOBAL-1B / NON-BLOCKING、今回未修正)**:
- `gaze-keyboard.html`: A11yパネルを開いてもBlue2 Scan対象がキーボード側に残り、パネル内をスキャンできない。
- `schedule-app.html`: 1スイッチ設定で「みる」画面のScanが2番目で停止し、3番目以降へ進まない。

GLOBAL-1B/1C/1D(残り30アプリへの横展開)・FAMILY-B Batch-7は本Phaseでは開始しない。次のRollout判断はUser Approval待ち。
