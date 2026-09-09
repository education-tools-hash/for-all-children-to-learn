# WCAG-JIS-FINDING-ESCAPE-1 調査報告

**Phase種別**: 調査専用(Investigation-only)。本Phaseでは一切のProductionコード変更を行っていない。
**調査worktree**: `for-all-children-to-learn-wcag-jis-finding-escape-1`
**調査branch**: `investigate/wcag-jis-finding-escape-1`(baseline: `origin/main` @ `5ef50eb`、drift無し)
**関連文書**: [donomana-modal-accessibility-contract-v1_0.md](../donomana-modal-accessibility-contract-v1_0.md)(v1.1、§5 Escape Priority Contract) / [modal-conformance-matrix.md](modal-conformance-matrix.md) / [global-fix-triage-1.md](global-fix-triage-1.md) / [finding-initial-restore-1.md](finding-initial-restore-1.md)

---

## 1. 背景・目的

modal/overlay/dialog系UI全体を横断し、「Escapeキーで閉じられない」「Escape処理が不統一」な候補を再同定し、正式Findingとして分類する。cup_game settingsOverlay(既知、role/aria-modal欠如は別Finding)を主対象の一つとしつつ、35正式アプリ全体を対象に横断探索した。

---

## 2. Source of Truth確認結果

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)§5「Escape Priority Contract」および§13分類表を確認した。

- **Escape(優先順位付き)はREQUIRED**(§13、明示的な例外規定なし)。
- 優先順位(§5): 1. A11yパネル(最優先) → 2. Nested overlay/modal → 3. Main modal → 4. App state。
- §5「実装への影響」に**Contract自身が既に理論的懸念を明記**していた: 「A11yパネル自身のEscape処理と各アプリのモーダルEscape処理は独立したキーイベントリスナーとして実装されており、優先順位は…ブラウザのイベント伝播順に依存している。これは明示的な優先順位制御ではなく偶然の順序に依存しているため、Fix実施時に上記1〜4を明示的なフラグ確認…へ置き換えることを推奨する。」
- `window.confirm()`は§9によりContract対象外(NOT REQUIRED)。
- Nested Modal/Overlay Contract(§12)は「現時点で適用実例なし」としてOPTIONAL。ただし今回の調査でmogura-tataki等の複数modalアプリでの検証を実施した(§8参照)。
- 破壊的操作/result/forced-choice UIに対する明示的なEscape例外規定はContractに存在しない。個別に評価する方針とした(§10参照)。

**本Phaseの結論**: 上記のContract§5の理論的懸念が、**実機で複数アプリにわたり実際に発現していることを確認した**(本報告の中心的発見、§6参照)。

---

## 3. 母集団確定(35正式アプリ全数、`apps-data.json`基準)

`role="dialog"`/`role="alertdialog"`のgrep走査に加え、class名ベース(`modal`/`overlay`/`popup`/`backdrop`)の広域grepを実施し、**modal-conformance-matrix.mdに記載の無かった新規custom modal群**(role属性を持たない独自実装)を追加発見した。

### 3.1 NOT APPLICABLE(共通A11yパネルのみ、アプリ固有modal無し) — 11アプリ

directions-app, dotchiga-ii-app, kurabeyou-app, sugoroku-app, suji-manabou, timetable-app, yomikaki-app, katachi-awase-app, miru-hirogaru-app, mitsukete-touch-app, junban-miyou-app

### 3.2 新規発見(matrix未記載、role属性なしのcustom modal) — 6アプリ

| App | Modal一覧 |
|---|---|
| nazori-app | completeModal, helpModal, printModal, passcodeModal |
| sst-app | help-modal, settings-modal, teacher-lock-modal, diary-export-modal, badge-modal |
| drawing-app | stamp-modal, share-modal, bg-modal, clear-modal, reset-modal, help-modal |
| slideshow-sakusei | exportModal |
| kyou-no-kiroku | modalHelp, modalAddChild, modalCelebration, modalEditRecord |
| kimochi-board | helpOverlay, settingsOverlay, emojiPickerOverlay, drawOverlay, confirmOverlay |

### 3.3 既存matrix記載アプリ(role="dialog"使用) — 18アプリ

register-app, matching-app, time-timer, mogura-tataki, okane-app, scratch-app, nazorin-print, schedule-app, janken-app, tokei-app, tyushi, gaze-keyboard, hiragana-learn, katakana-app, shiritori2, bosai-app, cup_game, ongaku-app

**合計候補**: modal/overlay単位で50件超(アプリ単位35、うちEscape評価対象24アプリ)。

---

## 4. 静的分類(コード確認)

各候補についてEscapeキー処理の有無・宛先を確認した。分類基準は仕様書§6のA〜Gを用いた。

- **A(modal自身がEscapeを処理)**: 大多数がこのパターン。ただし**A11yパネルの開閉状態を確認しないもの多数**(下記§6参照)。
- **B(共通global handlerが処理)**: 該当なし(donomanaA11yPanel自身のEscapeは各アプリ共通自動挿入コードだが、アプリ固有modalには適用されない)。
- **D(Escape処理なし)**: mogura-tataki(4/5modal)、scratch-app(4/4modal)、cup_game(settingsOverlay)、sst-app(5/5modal)、drawing-app(6/6modal)、slideshow-sakusei(1/1)、kyou-no-kiroku(4/4)、kimochi-board(4/5modal)、nazori-app(4/4modal、要個別評価)。
- **F(Escape処理はあるが特定状態[A11yパネルOpen中]で誤って同時発火)**: 後述§6で新規のRoot Causeパターンとして分類(E6)。

---

## 5. 実ブラウザ再同定(Playwright、実クリック/直接JS呼び出し併用)

推測のみでFAIL確定とせず、可能な範囲で実機確認した。console/page errorsは全テストで0件。

### 5.1 新規発見custom modal(Category D、Escape処理完全欠如)

| App | Modal | 結果 | Evidence |
|---|---|---|---|
| sst-app | help-modal | Escape押下後もstill_open=True | **LEVEL-A(CONFIRMED FAIL)** |
| drawing-app | help-modal | 同上 | **LEVEL-A(CONFIRMED FAIL)** |
| kyou-no-kiroku | modalHelp | 同上 | **LEVEL-A(CONFIRMED FAIL)** |
| kimochi-board | helpOverlay | 同上 | **LEVEL-A(CONFIRMED FAIL)** |
| nazori-app | helpModal | 同上 | **LEVEL-A(CONFIRMED FAIL)** |

各アプリの残りのmodal(sst-appのsettings-modal/teacher-lock-modal/diary-export-modal/badge-modal等)はコード構造が同一(`closeXxx()`関数はあるがEscapeキーから呼ばれていない)であるため、**LEVEL-B(構造推定によるCONFIRMED FAIL)**とする。

### 5.2 既存matrix「未検証」記載の訂正 — 実は実装済みと判明

| App | Modal | 結果 |
|---|---|---|
| janken-app | howto-overlay | Escape押下で正しく閉じた。**LEVEL-A(CONFIRMED PASS、matrix訂正要)** |
| tokei-app | helpModal | 同上。**LEVEL-A(CONFIRMED PASS、matrix訂正要)** |
| gaze-keyboard | profileModal | 同上。**LEVEL-A(CONFIRMED PASS、matrix訂正要)** |

matrixの「未検証」表記は古く、実装自体は既に存在していた。ただしこれらは§6のA11yパネル競合問題を新たに抱えていることが判明した(下記参照)。

### 5.3 既存CONFIRMED FAILの再確認(既存記録どおり)

mogura-tataki(scrStart)・scratch-app(setOv)ともEscape押下後もstill_open=True、既存記録と一致。

---

## 6. 新規発見: E6(A11yパネル競合)パターン — 本調査の中心的発見

Escapeキー処理自体は実装されているが、**共通A11yパネルが同時に開いている状態でEscapeを押すと、A11yパネルとアプリ固有modalが1回のEscapeで同時に閉じてしまう**バグを、複数アプリで実機確認した。

### 6.1 手順

1. アプリ固有modalを開く
2. 共通A11yパネル(`donomanaA11yBtn`)を開く(両方が同時にopen状態になる)
3. Escapeを1回押す
4. 期待値(Contract§5): A11yパネルのみ閉じ、modalは開いたまま
5. 実際の結果: **多くのアプリでmodalも同時に閉じてしまう**

### 6.2 実機確認結果

| App | Modal | 結果 |
|---|---|---|
| mogura-tataki | panRec | **CONFLICT(両方同時に閉じた)** |
| janken-app | howto-overlay | **CONFLICT** |
| tokei-app | helpModal | **CONFLICT** |
| gaze-keyboard | profileModal | **CONFLICT** |
| hiragana-learn | traceSampleViewer | **CONFLICT** |

対照として、正しく実装されているケースも確認した:

| App | Modal | 結果 |
|---|---|---|
| gaze-keyboard | settingsModal | **OK**(A11yパネルのみ閉じ、settingsModalは開いたまま) |
| ongaku-app | modal-pin/modal-export/modal-share | コード確認: `if (a11yPanel && a11yPanel.style.display === 'block') return;`を明示的に実装済み(**LEVEL-B PASS**) |

### 6.3 コード上のRoot Cause

正しく実装されているケース(gaze-keyboard settingsModal、ongaku-app modal-pin等)は、Escapeハンドラの先頭で`donomanaA11yPanel`のdisplay状態を確認し、開いていれば`return`する設計になっている。一方、CONFLICTが発生するケースは、この確認が欠如しており、単純に`if (e.key==='Escape' && modal.classList.contains('open')) close();`のみで実装されている。

**同一アプリ内で実装が不統一な実例**: ongaku-appは`modal-pin/export/share`ではA11yパネルチェックを実装しているが、`modal-help`(`closeHelp()`)には同じチェックが欠如している(コード確認、未実機確認)。

### 6.4 コード構造推定によるE6候補(未実機確認、LEVEL-B)

以下はEscapeハンドラの実装がCONFLICTパターン(A11yパネルチェック欠如)と同一構造であることをコードで確認した:

- mogura-tataki: panRec(実機確認済み、上記)
- janken-app: record-modal-backdrop
- tokei-app: recordModal
- gaze-keyboard: hrModal
- katakana-app: traceSampleViewer(hiragana-learnと完全同一実装)
- nazorin-print: helpModal, batchModal, libModal(3モーダルとも同一パターン)
- shiritori2: settings, record-modal-backdrop
- bosai-app: help
- cup_game: helpModal
- ongaku-app: modal-help

---

## 7. cup_game settingsOverlay(既知候補)の再確認

Escape機構自体が存在しないことを実機で再確認(既存記録どおりCONFIRMED FAIL)。role/aria-modal欠如は別Finding(既存記録どおり)、Visible Focus問題も別Finding(FAMILY-B-BATCH-7調査で既知)、今回はEscape欠如のみを対象として分離する。

---

## 8. Nested / Multiple Layer確認

mogura-tatakiで複数レイヤーの重なりを確認した。

1. `scrStart`(背面)を開いたまま`panHow`(前面)を開く → Escape押下 → `panHow`はEscape未実装(Category D)のため変化なし、`scrStart`は影響を受けない(誤って背面が閉じる、というパターンは確認されなかった)。
2. `panHow`を開いた状態でA11yパネルも開く → Escape1回目でA11yパネルのみ閉じる(`panHow`はEscape未実装のため、そもそも競合しようがない) → Escape2回目でも`panHow`は閉じない(既知のCategory D)。
3. `panRec`(Escape実装あり)でA11yパネルとの重なりを確認 → 上記§6の通りCONFLICT(1回で両方閉じる)を確認。

**結論**: 「2枚同時に閉じる」という誤動作は、Escape処理を持つmodal(§6のE6パターン該当分)でのみ発生する。Escape処理自体が無いmodal(Category D)では、この種の誤動作は原理的に発生しない(そもそも反応しないため)。

---

## 9. A11y Panel coexistence(総括)

Contract§5の優先順位(A11yパネル最優先)は、**明示的にフラグチェックを実装しているアプリ(gaze-keyboard settingsModal、ongaku-app modal-pin/export/share)でのみ正しく機能している**。それ以外の大多数のアプリでは、A11yパネルとアプリ固有modalのEscapeハンドラが独立して動作しており、Contractが警告していた「偶然の順序依存」が実際に問題として発現していることを確認した。優先順位の仕様自体はContract§5で確定済みのため、`SPEC DECISION REQUIRED`ではなく**CONFIRMED FAIL(既存Contractへの違反)**として分類する。

---

## 10. Forced / Result / Destructive UIの例外確認

- **nazori-app passcodeModal**: 名称から「ロック画面」的な性質を持つ可能性がある。Escapeで閉じられない設計が意図的である可能性は否定できないため、**NEEDS SPECIAL HANDLING**として保留する(実機確認未実施、UIの実際の用途をコードから確認する追加調査が必要)。
- **kyou-no-kiroku modalCelebration**: 名称から結果/祝賀系overlayと推測される。result系UIとしてEscape必須除外の可能性があるため、**NEEDS SPECIAL HANDLING**として保留する。
- それ以外(help/settings/record/export/print系)は、いずれも通常の情報表示・設定系modalであり、destructive/forced-choiceの性質は認められないため、Escape必須(CONFIRMED FAIL)の通常分類とする。

---

## 11. Classification 総括表

| # | App | Modal | 分類 | Evidence | Root Cause |
|---|---|---|---|---|---|
| 1 | mogura-tataki | scrStart/scrResult/panSet/panHow | CONFIRMED FAIL | LEVEL-A(既存) | E1 |
| 2 | mogura-tataki | panRec | CONFIRMED FAIL | LEVEL-A(今回) | E6 |
| 3 | scratch-app | setOv/helpOv/txtEdOv/cov | CONFIRMED FAIL | LEVEL-A(既存+今回再確認) | E1 |
| 4 | cup_game | settingsOverlay | CONFIRMED FAIL | LEVEL-A(既存) | E1 |
| 5 | cup_game | helpModal | CONFIRMED FAIL(推定) | LEVEL-B | E6 |
| 6 | sst-app | help-modal | CONFIRMED FAIL | LEVEL-A | E1 |
| 7 | sst-app | settings-modal/teacher-lock-modal/diary-export-modal/badge-modal | CONFIRMED FAIL(推定) | LEVEL-B | E1 |
| 8 | drawing-app | help-modal | CONFIRMED FAIL | LEVEL-A | E1 |
| 9 | drawing-app | stamp-modal/share-modal/bg-modal/clear-modal/reset-modal | CONFIRMED FAIL(推定) | LEVEL-B | E1 |
| 10 | slideshow-sakusei | exportModal | CONFIRMED FAIL | LEVEL-A | E1 |
| 11 | kyou-no-kiroku | modalHelp | CONFIRMED FAIL | LEVEL-A | E1 |
| 12 | kyou-no-kiroku | modalAddChild/modalEditRecord | CONFIRMED FAIL(推定) | LEVEL-B | E1 |
| 13 | kyou-no-kiroku | modalCelebration | NEEDS SPECIAL HANDLING | LEVEL-C | — |
| 14 | kimochi-board | helpOverlay | CONFIRMED FAIL | LEVEL-A | E1 |
| 15 | kimochi-board | emojiPickerOverlay/drawOverlay/confirmOverlay | CONFIRMED FAIL(推定) | LEVEL-B | E1 |
| 16 | kimochi-board | settingsOverlay | CONFIRMED PASS | LEVEL-A(既存実装確認済み) | — |
| 17 | nazori-app | helpModal | CONFIRMED FAIL | LEVEL-A | E1 |
| 18 | nazori-app | printModal | CONFIRMED FAIL(推定) | LEVEL-B | E1 |
| 19 | nazori-app | completeModal | UNRESOLVED | LEVEL-C | — |
| 20 | nazori-app | passcodeModal | NEEDS SPECIAL HANDLING | LEVEL-C | — |
| 21 | janken-app | howto-overlay | CONFIRMED PASS(単独)/CONFIRMED FAIL(A11y競合時) | LEVEL-A | E6 |
| 22 | janken-app | record-modal-backdrop | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 23 | tokei-app | helpModal | CONFIRMED PASS(単独)/CONFIRMED FAIL(A11y競合時) | LEVEL-A | E6 |
| 24 | tokei-app | recordModal | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 25 | gaze-keyboard | profileModal | CONFIRMED PASS(単独)/CONFIRMED FAIL(A11y競合時) | LEVEL-A | E6 |
| 26 | gaze-keyboard | hrModal | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 27 | gaze-keyboard | settingsModal | CONFIRMED PASS(A11y競合なし) | LEVEL-A | — |
| 28 | hiragana-learn | traceSampleViewer | CONFIRMED PASS(単独)/CONFIRMED FAIL(A11y競合時) | LEVEL-A | E6 |
| 29 | katakana-app | traceSampleViewer | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 30 | nazorin-print | helpModal/batchModal/libModal | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 31 | shiritori2 | settings/record-modal-backdrop | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 32 | bosai-app | help | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 33 | ongaku-app | modal-help | CONFIRMED FAIL(推定、A11y競合) | LEVEL-B | E6 |
| 34 | ongaku-app | modal-pin/export/share | CONFIRMED PASS(A11y競合なし) | LEVEL-B | — |
| 35 | register-app | 8モーダル共通 | CONFIRMED PASS(既存matrix記載) | LEVEL-A(既存) | — |
| 36 | matching-app | 全modal | CONFIRMED PASS(既存matrix記載) | LEVEL-A(既存) | — |
| 37 | time-timer | 全modal | CONFIRMED PASS(既存matrix記載) | LEVEL-A(既存) | — |
| 38 | okane-app | 全modal | CONFIRMED PASS(既存matrix記載) | LEVEL-A(既存) | — |
| 39 | schedule-app | print-modal/new-modal/img-modal | CONFIRMED PASS(既存matrix記載) | LEVEL-A(既存) | — |
| 40 | bosai-app | settings-modal(既存記載、Escape元々無し設計) | NOT APPLICABLE(既存の意図的設計、別記録) | — | — |
| 41 | tyushi | help-overlay | CONFIRMED PASS(既存matrix記載) | LEVEL-A(既存) | — |
| 42 | tyushi | settings-panel | NOT APPLICABLE(非modal disclosure panel、既存確定) | LEVEL-A(既存) | — |

11アプリ(§3.1)は NOT APPLICABLE(アプリ固有modal無し)。

---

## 12. Root Cause分類

- **E1(Escape listener完全欠如)**: 最多。mogura-tataki(4)・scratch-app(4)・cup_game(1)・sst-app(5)・drawing-app(6)・slideshow-sakusei(1)・kyou-no-kiroku(2〜3)・kimochi-board(4)・nazori-app(2〜4)。
- **E6(A11yパネル競合、優先順位制御なし)**: 新規発見。mogura-tataki panRec・janken-app(2)・tokei-app(2)・gaze-keyboard(hrModal)・hiragana-learn・katakana-app・nazorin-print(3)・shiritori2(2)・bosai-app・cup_game helpModal・ongaku-app modal-help。**このパターンは仕様書のRoot Cause分類リストに無かったため、新規区分としてE6を割り当てた**(仕様書§12「必要に応じて追加してよい」に基づく)。
- 他の区分(E2〜E5、E7、E8)に該当する実例は今回発見しなかった。

---

## 13. Finding Family / ID設計(提案、未確定)

既存命名規則(FAMILY-A〜J、Aは使用済み)を確認した結果、**A〜Jは全て既存Findingに割り当て済み**(FAMILY-Eは既にBackground Suppressionに使用中のため、仕様書が例示した「FAMILY-E = Escape Close」は使用できない)。

**次に空いている文字は`FAMILY-K`である。** 今回発見した2つのRoot Causeパターン(E1: 完全欠如、E6: A11yパネル競合)は、いずれも「Escape Close」という同一テーマに属し、既存のFAMILY-B(Focus Trap)・FAMILY-D(Focus Restoration)・FAMILY-J(Reverse Tab Boundary)のいずれとも異なる観点(閉じる操作自体の可否、優先順位)であるため、**`FAMILY-K = Escape Close`として新設することを提案する**。E1とE6はFAMILY-K内の異なるSub-pattern(またはFAMILY-K-1/K-2のような分割)として扱うことを提案するが、**最終的なID確定・命名承認はUser判断とし、本Phaseでは提案に留める**。

---

## 14. Cross-app集計

| 区分 | 件数(modal単位) |
|---|---|
| 候補総数(NOT APPLICABLE除く、アプリ×modal) | 約42 |
| CONFIRMED FAIL(E1、完全欠如、LEVEL-A実機確認) | 6 |
| CONFIRMED FAIL(E1、完全欠如、LEVEL-B構造推定) | 約15 |
| CONFIRMED FAIL(E6、A11y競合、LEVEL-A実機確認) | 5 |
| CONFIRMED FAIL(E6、A11y競合、LEVEL-B構造推定) | 約11 |
| CONFIRMED PASS(A11y競合なし、既存または今回確認) | 約13(register-app/matching-app/time-timer/okane-app/schedule-app/tyushi help-overlay等の既存記載分含む) |
| NOT APPLICABLE(アプリ固有modal無し) | 11アプリ |
| NOT APPLICABLE(非modal確定済み、既存) | tyushi settings-panel、bosai-app settings-modal |
| NEEDS SPECIAL HANDLING | 2(kyou-no-kiroku modalCelebration、nazori-app passcodeModal) |
| UNRESOLVED | 1(nazori-app completeModal) |
| SPEC DECISION REQUIRED | 0(Contract§5は既に優先順位を確定済みのため該当なし) |

**アプリ単位**: 35アプリ中、Escape Findingが1件以上存在するアプリは**14アプリ**(mogura-tataki, scratch-app, cup_game, sst-app, drawing-app, slideshow-sakusei, kyou-no-kiroku, kimochi-board, nazori-app, janken-app, tokei-app, gaze-keyboard, hiragana-learn, katakana-app, nazorin-print, shiritori2, bosai-app, ongaku-app = **18アプリ**、集計を訂正)。

---

## 15. Fix architecture案(実装はしない)

### E1(完全欠如)向け

各modalの既存close helper(`closeXxx()`)を再利用し、以下パターンを追加する:

```js
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  var a11yPanel = document.getElementById('donomanaA11yPanel');
  if (a11yPanel && a11yPanel.style.display === 'block') return; // A11yパネル優先
  if (!modalIsOpen()) return;
  closeXxx(); // 既存close helperをそのまま呼ぶ、DOM直接操作は避ける
});
```

新しいglobal modal frameworkは導入せず、各アプリのローカルスコープに個別実装する(mogura-tataki/cup_game等の既存Fix Batchで確立した設計を踏襲)。

### E6(A11yパネル競合)向け

既存のEscapeハンドラの先頭に、gaze-keyboard settingsModal/ongaku-app modal-pin等で確立済みの1行を追加するだけで解消可能:

```js
const a11yPanel = document.getElementById('donomanaA11yPanel');
if (a11yPanel && a11yPanel.style.display === 'block') return;
```

**Regression Risk: 低**。既存のclose処理自体には触れず、条件分岐の追加のみ。

---

## 16. Focus Restorationとの関係

E1修正でEscape→close helperを追加する際、close helper自体が既にFocus Restoration(FAMILY-D lineageで大半のアプリが対応済み)を含んでいる場合はそのまま機能する。ただし、sst-app/drawing-app/slideshow-sakusei/kyou-no-kiroku/kimochi-board/nazori-appは**FAMILY-D cross-app auditの対象アプリリストに含まれていなかった**(前回調査の35アプリリストは`role="dialog"`ベースの一次スクリーニングだったため、これらのrole属性なしcustom modalは捕捉されていなかった可能性が高い)。E1 Fix実装時は、対象close helperが実際にFocus Restorationを実装しているかを個別に確認する必要がある(dependencyとして記録)。

---

## 17. Focus Trapとの関係

同様に、sst-app/drawing-app/slideshow-sakusei/kyou-no-kiroku/kimochi-board/nazori-appの各custom modalが既存のFAMILY-B(Focus Trap)監査対象に含まれていたかも未確認である。これらのアプリは今回のEscape調査で初めて詳細に検証したため、**Focus Trap自体の欠如も合わせて抱えている可能性が高い**(FAMILY-B同様のパターンが多数のアプリで未発見のまま残っている可能性)。これはFAMILY-K(Escape)のFix実装時に、Escapeハンドラ追加とFocus Trap追加が同時に必要になるケースが多いことを意味する。dependencyとして記録する。

---

## 18. Switch / Gaze / Touch影響

Escape追加はキーボード専用処理であり、Switch Scan/Gaze/Touchの候補構築ロジックには直接影響しない設計が可能(既存のFAMILY-B/D Fix実装で確立された前例と同様)。ただし、shared global listenerの構造変更を伴う場合(例: mogura-tatakiのdocument-level keydownリスナーへの追加)は、既存のTab処理との共存を個別に確認する必要がある。

---

## 19. role/aria-modal Separate Finding分離

以下は今回のFAMILY-K候補と同一UIに存在するが、別Findingとして分離し混在させない:

- cup_game settingsOverlay: role/aria-modal欠如(既存、別Finding) — **dependency: 同一UI**
- sst-app/drawing-app/slideshow-sakusei/kyou-no-kiroku/kimochi-board/nazori-appの各modal: role/aria-modal付与状況は今回のPhaseでは未調査(Escape調査中に偶然確認した範囲では、多くがrole属性を持たない可能性が高い) — **今回はEscapeのみを対象とし、role/aria-modal自体の是非は別Phaseの調査に委ねる**

---

## 20. Visible Focus等既存Separate Finding保全

以下は今回変更していない: cup_game settingsOverlay Visible Focus、panSet disabled-state不整合、mogura-tataki潜在的Focus Trap脆弱性、Initial Focus関連Separate Finding、A11yパネルProxy再トグル時focus残留。

---

## 21. Regression Risk評価

| Fix種別 | Risk |
|---|---|
| E1(既存close helper呼び出し追加) | Low(close処理自体は既存のまま) |
| E6(A11yパネルチェック1行追加) | Low(条件分岐追加のみ、gaze-keyboard settingsModalで実績あり) |
| sst-app/drawing-app等、Focus Trap未確認アプリへの複合Fix | Medium(Escape追加と同時にFocus Trap欠如が発覚した場合、スコープが拡大する可能性) |

---

## 22. 推奨Fix Batch設計(実装はしない)

- **Batch K-1(E6、A11yパネルチェック追加のみ、最低リスク)**: mogura-tataki(panRec)・janken-app・tokei-app・gaze-keyboard(hrModal)・hiragana-learn・katakana-app・nazorin-print・shiritori2・bosai-app・cup_game(helpModal)・ongaku-app(modal-help)。全て同一の1行追加パターンで対応可能。
- **Batch K-2(E1、mogura-tataki/scratch-app/cup_game、既存Fix Batchの延長)**: 既にFocus Trap Fix等で個別実装が確立しているアプリ群。
- **Batch K-3(E1、新規発見6アプリ、要Focus Trap同時確認)**: sst-app・drawing-app・slideshow-sakusei・kyou-no-kiroku・kimochi-board・nazori-app。Focus Trap自体の有無も含めた個別調査が先に必要な可能性が高いため、他Batchと分離することを推奨。
- **保留**: nazori-app completeModal(UNRESOLVED)、kyou-no-kiroku modalCelebration・nazori-app passcodeModal(NEEDS SPECIAL HANDLING) — 個別のUI用途確認が先に必要。

---

## 23. User Review項目(Fix実装後に想定)

1. modal open
2. Escape押下で閉じるか
3. Focus Restoration(元triggerへ復帰)
4. Forward Tab / Reverse Tab(regressionなし)
5. A11yパネルcoexistence(A11yパネル単独close → modal単独close、2段階で正しく動作)
6. nested modalがある場合、layer priority
7. Touch close(タップでも同様に問題ないか)
8. console/page errors 0件

---

## 24. Production保全・投資調査branch保全

本Phase中、`main`/`origin/main`へのmerge/push/Production Releaseは一切行っていない。旧investigation branch(`investigate/wcag-jis-finding-initial-restore-1`、HEAD `457f113`)には一切触れていない。

---

## 25. 最終Status(初回、§26以降で更新)

`WCAG-JIS-FINDING-ESCAPE-1 = CROSS-APP ESCAPE AUDIT COMPLETE / READY FOR FIX DESIGN`

Fix architecture自体は§15で最小設計を提示したが、以下が未確定のため`FIX ARCHITECTURE DEFINED`までは到達していない:
- 新規発見6アプリ(sst-app等)のFocus Trap有無の個別確認(§17)
- Finding Family ID(`FAMILY-K`案)のUser承認
- LEVEL-B(構造推定)候補約26件の個別実機確認
- NEEDS SPECIAL HANDLING/UNRESOLVED 3件の用途確認

---

## 26. [WCAG-JIS-FINDING-ESCAPE-1-CLOSE追記] 正式Root Cause分類(E1〜E6)への統一と追加実機検証

前Phase(§1〜25)は独自呼称で「E1(完全欠如)」「E6(A11yパネル競合)」を用いていたが、本CLOSE Phaseの仕様書が正式なRoot Cause区分を再定義したため、以下のマッピングで統一する。**§1〜25の記述内容自体は削除・書き換えない**(履歴保存の原則)。読み替え表のみ本節に追加する。

### 26.1 呼称統一(読み替え表)

| §1〜25での旧呼称 | 本節以降の正式呼称 | 定義 |
|---|---|---|
| E1(完全欠如) | **E1** | Escape mechanism missing(変更なし) |
| (未使用) | **E2** | Escape wrong target/wrong layer(今回0件、該当実例なし) |
| E6(A11yパネル競合) | **E3** | Escape Priority Contract violation |
| (未分類、matrix stale訂正として個別記述) | **E4** | Escape implemented / audit matrix stale |
| NOT APPLICABLE | **E5** | NOT APPLICABLE(Contract上妥当) |
| NEEDS SPECIAL HANDLING | **E6** | NEEDS SPECIAL HANDLING(destructive/forced/result等) |

以降、全ての分類はこの正式E1〜E6に従う。

### 26.2 E3(Escape Priority Contract violation)の正式実機検証(§10手順準拠)

仕様書§10の8ステップ(1.modal open→2.A11yPanel open→3.Escape1回→4/5.判定→6.Escape2回目→7.判定→8.restoration確認)に従い、以下を実機再検証した。

| App/Modal | 1.modal open | 2.A11yPanel open | 3.Escape#1後 | 4/5判定 | 6.Escape#2後 | 8.restoration | 結論 |
|---|---|---|---|---|---|---|---|
| mogura-tataki panRec | open=True | a11y=block, modal維持 | a11y=none, **modal=False(同時に閉じた)** | **CONFIRMED FAIL/E3** | (既にmodal閉済み、対象外) | btnRec | **CONFIRMED FAIL/E3(LEVEL-A)** |
| gaze-keyboard profileModal | open=True | a11y=block, modal維持 | a11y=none, **modal=False** | **CONFIRMED FAIL/E3** | (既にmodal閉済み) | BODY | **CONFIRMED FAIL/E3(LEVEL-A)** |
| gaze-keyboard hrModal | open=True | a11y=block, modal維持 | a11y=none, **modal=False** | **CONFIRMED FAIL/E3** | (既にmodal閉済み) | 未計測 | **CONFIRMED FAIL/E3(LEVEL-A、LEVEL-Bから昇格)** |
| gaze-keyboard settingsModal(**正解Pattern**) | open=True | a11y=block, modal維持 | a11y=none, **modal=True(開いたまま)** | **CONFIRMED PASS** | modal=False(今度は正しく閉じた) | `donomanaA11yBtn` | **CONFIRMED PASS(2段階Escapeで正しく動作)** |

**結論**: E3のCONFIRMED FAILパターンは、いずれも「Escape1回で両レイヤーが同時に閉じる」という同一症状。正解Pattern(gaze-keyboard settingsModal)は「Escape1回目=A11yパネルのみ閉じ、modalは開いたまま維持→Escape2回目=modalが閉じ元triggerへ復帰」という、Contract§5が求める段階的な優先順位処理を正しく実装している。

### 26.3 正解Pattern比較(§11)

| 項目 | gaze-keyboard settingsModal | ongaku-app modal-pin/export/share |
|---|---|---|
| A11yPanel open判定 | `if(a11yPanel && a11yPanel.style.display==='block')return;`をEscapeハンドラ先頭に配置 | 同様に`if (a11yPanel && a11yPanel.style.display === 'block') return;`をEscapeハンドラ先頭に配置(コード確認済み、§6.3) |
| Escape priority | ハンドラ内の早期returnのみ、複雑な優先度スタックなし | 同様 |
| stopPropagation/preventDefault | `e.preventDefault()`のみ使用、`stopPropagation`は不使用 | 同様(`e.preventDefault()`は使用箇所あり) |
| close helper | 既存の`document.getElementById('settingsClose').click()`を呼ぶ形(close処理を迂回しない) | 既存の`closePin()`/`closeExportModal()`/`closeShareModal()`をそのまま呼ぶ |
| restoration | close helper内部で処理(Escapeハンドラ自体はrestorationに関与しない) | 同様 |

**次Fix Phaseの前提**: 新規architectureを発明せず、この「Escapeハンドラ先頭でA11yPanel display確認→block中はreturn」という1行パターンをそのまま横展開する。

### 26.4 E4(docs stale)の正式確定

| App | Modal | 旧matrix記載 | 実際の状態 | 分類 |
|---|---|---|---|---|
| janken-app | howto-overlay | 「未検証」 | Escape実装済み・単独ではPASS。**ただしA11yPanel競合時はE3 CONFIRMED FAIL**(§26.5) | **E4(matrix訂正)+E3(複合)** |
| tokei-app | helpModal | 「未検証」 | 同上 | **E4+E3(複合)** |
| gaze-keyboard | profileModal/hrModal | 「未検証」 | 実装済み・単独PASS、**A11yPanel競合でE3 CONFIRMED FAIL**(§26.2) | **E4+E3(複合)** |

1つのmodalが複数のRoot Causeに同時に該当する「複合ケース」であることを明記する(単純なdocs staleだけでなく、実装自体に別の欠陥[E3]も抱えている)。

### 26.5 janken-app record-modal-backdrop・tokei-app recordModalのE3再確認

§6.4(LEVEL-B構造推定)としていた2件を実機再検証した。

```
janken-app record-modal-backdrop + A11yPanel: Escape1回で両方同時に閉じた → CONFIRMED FAIL/E3(LEVEL-A昇格)
tokei-app recordModal + A11yPanel: Escape1回で両方同時に閉じた → CONFIRMED FAIL/E3(LEVEL-A昇格)
```

### 26.6 cup_game settingsOverlayの最終分類

- **Escape**: E1(mechanism missing)、CONFIRMED FAIL(LEVEL-A、既存記録どおり変更なし)。
- **Separate Finding(dependency記録のみ、本Findingに混在させない)**: role欠如・aria-modal欠如(既存、FAMILY-A寄り)・Visible Focus問題(既存、FAMILY-B-BATCH-7調査で判明)。
- これらは同一UI(`settingsOverlay`)に複数のFindingが重複する実例であり、Fix Batch設計時は「Escapeのみを追加する」スコープを厳守し、role/aria-modal付与やVisible Focus修正を同時に行わないこと(仕様書§6の指示どおり)。

### 26.7 nazori-app 4modal 正式個別静的確認(§7要求充足)

| Modal | Escape実装 | close helper | role | aria-modal | aria-labelledby | Focus Trap | Restoration | 分類 |
|---|---|---|---|---|---|---|---|---|
| helpModal | なし | `closeHelp()`(存在するがEscapeから未接続) | なし | なし | なし | なし(Tabキー処理コード自体が存在しない) | 未確認(closeHelp内容未精査) | **CONFIRMED FAIL/E1(LEVEL-A実機確認)** |
| printModal | なし | `closePrintModal()`(同上、未接続) | なし | なし | なし | なし | 未確認 | **CONFIRMED FAIL/E1(LEVEL-B)** |
| completeModal | なし | `modalCloseBtn`クリックのみ(専用close関数なし、インラインhandler) | なし | なし | なし | なし | 未確認 | **CONFIRMED FAIL/E1(LEVEL-B)**。前回report §11-#19でUNRESOLVEDとしていたが、mogura-tataki scrResult(既存CONFIRMED FAIL、result overlayでもE1として扱う既存先例)との整合性から、本CLOSE Phaseで**CONFIRMED FAILへ確定**する |
| passcodeModal | なし | `showPasscodeModal()`/`lockRecord()`(記録閲覧のパスコード保護、`recordUnlocked`フラグ管理) | なし | なし | なし | なし | 未確認 | **E6(NEEDS SPECIAL HANDLING)、変更なし**。「保護者向け記録の閲覧制限」という性質上、Escapeでの回避を許可しない設計が意図的である可能性が高く、これはlock screen相当のUIとしてContract上の通常Escape要件をそのまま適用すべきでない候補と判断する。ただし開発者が意図的にそう設計したのか、単なる実装漏れなのかは本Phaseでは確定できないため、`NEEDS SPECIAL HANDLING`のまま次Phase(または開発者判断)へ持ち越す |

nazori-app全4modalに共通して、role/aria-modal/aria-labelledby欠如(FAMILY-A寄り、Separate Finding)およびFocus Trap欠如(FAMILY-B寄り、Separate Finding)を確認した。nazori-appは既存のFAMILY-B/FAMILY-D cross-app audit(いずれも`role="dialog"`ベースの一次スクリーニングを用いていた)の対象アプリリストに含まれていなかったため、これらのFinding候補はいずれも今回初めて発見されたものであり、正式なFAMILY-B/A追加候補として次Phaseでの扱いをUserに委ねる。

### 26.8 kimochi-board true modal再判定(§8要求充足)

前回LEVEL-B推定に留めていた3件(confirmOverlay/drawOverlay/emojiPickerOverlay)の構造を確認し、いずれもfalse positiveではなく正当なtrue modal candidateであることを確定した。

- **emojiPickerOverlay**: `openEmojiPicker()`/`closeEmojiPicker()`の明確なペア、絵文字選択UI。true modal。
- **drawOverlay**: `openDrawModal()`/`closeDrawModal()`の明確なペア、お絵かき機能。true modal。
- **confirmOverlay**: コード内コメントに「アプリ内蔵 確認モーダル(`window.confirm`代替)」と明記。**重要な仕様解釈**: Contract§9は「`window.confirm()`はブラウザ標準実装であり、role/aria-modal/Focus Trap/初期focus/フォーカス復帰の全てをブラウザ自身が保証するため対象外」としているが、この理由づけは**ブラウザネイティブの`window.confirm()`関数のみに適用されるものであり、`confirmOverlay`のようなカスタムHTML/CSS実装による代替UIには適用されない**(ブラウザによる自動保証が一切働かないため)。したがって、`confirmOverlay`は**Contract対象外(NOT APPLICABLE)ではなく、通常のmodal Contract(Escape含む)が適用されるべき対象**と判断する。これは新たな仕様判断を要する`SPEC DECISION REQUIRED`ではなく、既存Contract§9の適用範囲を正しく解釈した結果である。

3件ともEscapeキー処理は実装されていないことを確認済み(§6.1のkimochi-board総括より)。confirmOverlayは破壊的操作(「けす」等)の確認用途であるため、Escapeでの取り消し(=キャンセル相当)は自然な期待動作であり、通常のCONFIRMED FAIL(E1)として扱うのが妥当と判断する。

| Modal | 分類 |
|---|---|
| kimochi-board emojiPickerOverlay | CONFIRMED FAIL/E1(LEVEL-B) |
| kimochi-board drawOverlay | CONFIRMED FAIL/E1(LEVEL-B) |
| kimochi-board confirmOverlay | CONFIRMED FAIL/E1(LEVEL-B)、Contract§9適用対象外の解釈を明記 |

### 26.9 Finding Family最終提案

既存FAMILY-A〜Jが全て使用済みであることを再確認(前回§13で確認済み、変更なし)。**`FAMILY-K = Escape Close`を単一Familyとして新設することを提案する**(E1とE3を別Familyに分割しない)。理由: 両者とも「Escapeで閉じるべき場面で正しく閉じない」という同一症状ドメインに属し、既存のFAMILY-B/FAMILY-D自体も内部に複数のRoot Cause区分(B1等)を持ちながら単一Familyとして運用されてきた前例と整合させるため。E1をFAMILY-K-1、E3をFAMILY-K-2のようなSub-ID分割とするかはUser判断に委ねる。**最終確定はUser承認待ち。**

### 26.10 Fix Batch最終設計

仕様書§14の指示に従い、E1とE3を無理に1 Batchへまとめず分離する。

- **Batch A(E1、Escape mechanism missing)**: 対象は既存close helperへEscapeハンドラを新規追加するのみ。mogura-tataki(4modal)・scratch-app(4modal)・cup_game(settingsOverlay)は既存のFix Batch実績があるアプリ群のため優先度高。sst-app/drawing-app/kyou-no-kiroku/kimochi-board/slideshow-sakusei/nazori-app(新規発見6アプリ)はFocus Trap欠如の同時確認が必要なため、**Batch A-1(実績アプリ、mogura-tataki/scratch-app/cup_game)とBatch A-2(新規6アプリ、要Focus Trap同時調査)に分割**することを推奨する。
- **Batch B(E3、Escape Priority Contract violation)**: mogura-tataki(panRec)・janken-app(howto-overlay・record-modal-backdrop)・tokei-app(helpModal・recordModal)・gaze-keyboard(profileModal・hrModal)・hiragana-learn・katakana-app・nazorin-print(3modal)・shiritori2・bosai-app・cup_game(helpModal)・ongaku-app(modal-help)。全て「Escapeハンドラ先頭にA11yPanel display確認1行を追加する」という同一Fix architectureで対応可能なため、**単一Batchでの一括処理が可能**と判断する(Regression Riskが最も低い)。
- **Batch C(E2/E6、wrong layer/special handling)**: E2は今回該当実例0件のためBatch自体不要。E6(nazori-app passcodeModal、kyou-no-kiroku modalCelebration)はFix対象ではなく、開発者/Userへの用途確認を先に行うべき事案のため、Fix Batchとしては設計しない。

**Batch優先順位案**: Batch B(E3) → Batch A-1(E1、実績アプリ) → Batch A-2(E1、新規アプリ、要Focus Trap同時調査)。Batch Bが最もRegression Riskが低く、影響範囲が明確なため最優先を推奨する。

### 26.11 Cross-app集計(最終版)

| Root Cause | 件数(modal単位) |
|---|---|
| E1(Escape mechanism missing) | 21件(LEVEL-A実機確認9件+LEVEL-B構造推定12件、nazori-app completeModal/kimochi-board 3件を含め確定) |
| E2(wrong target/wrong layer) | 0件(該当実例なし) |
| E3(Escape Priority Contract violation) | 16件(LEVEL-A実機確認9件[mogura-tataki panRec/janken-app 2件/tokei-app 2件/gaze-keyboard 2件/hiragana-learn/katakana-app推定含まず]+LEVEL-B構造推定7件) |
| E4(docs stale) | 3件(janken-app howto-overlay、tokei-app helpModal、gaze-keyboard profileModal/hrModal ※E3と複合) |
| E5(NOT APPLICABLE) | 11アプリ(共通A11yパネルのみ)+tyushi settings-panel+bosai-app settings-modal |
| E6(NEEDS SPECIAL HANDLING) | 2件(nazori-app passcodeModal、kyou-no-kiroku modalCelebration) |
| UNRESOLVED | 0件(前回のnazori-app completeModalは§26.7でE1へ確定、UNRESOLVED解消) |
| SPEC DECISION REQUIRED | 0件(kimochi-board confirmOverlayの論点は§26.8でContract§9の解釈適用により解消) |

**アプリ単位**: Escape Finding(E1/E3/E4/E6のいずれか)が1件以上存在するアプリは18アプリ(mogura-tataki, scratch-app, cup_game, sst-app, drawing-app, slideshow-sakusei, kyou-no-kiroku, kimochi-board, nazori-app, janken-app, tokei-app, gaze-keyboard, hiragana-learn, katakana-app, nazorin-print, shiritori2, bosai-app, ongaku-app)。

### 26.12 Production/旧investigation branch保全確認

本CLOSE Phase中、`main`/`origin/main`(`5ef50eb`)への変更・merge・pushは一切行っていない。旧investigation branch`investigate/wcag-jis-finding-initial-restore-1`(HEAD `457f113`)には一切触れていない。

### 26.13 最終Status(確定)

`WCAG-JIS-FINDING-ESCAPE-1 = CROSS-APP ESCAPE AUDIT COMPLETE / SPEC DECISION REQUIRED`

**`FIX ARCHITECTURE DEFINED`まで到達しなかった理由**: Fix Architecture自体(§15/§16、Batch A/B/C設計含む)は本CLOSE Phaseで確定できたが、以下がUser判断待ちのため、完全な`FIX ARCHITECTURE DEFINED`とはしない:

1. **Finding Family ID確定**(`FAMILY-K`という新規Family名、およびE1/E3をSub-ID分割するか単一Familyのままにするかの最終承認)
2. **nazori-app passcodeModal・kyou-no-kiroku modalCelebrationの用途確認**(意図的なEscape除外設計か、単なる実装漏れかをUser/開発者に確認する必要がある)
3. **Batch A-2(新規発見6アプリ)のスコープ確定**(Focus Trap欠如も同時に見つかった場合、Escape Fixだけに留めるかFocus Trap Fixも同時に行うFAMILY横断Batchにするかの判断)

上記3点は技術的な未解決事項ではなく、**プロジェクトオーナー(User)の意思決定を要する事項**であるため、`SPEC DECISION REQUIRED`として次Phaseへ引き継ぐ。

---

## 27. [WCAG-JIS-FAMILY-K-SPEC-DECISION-1追記] 正式仕様決定(User承認済み)

`WCAG-JIS-FAMILY-K-SPEC-DECISION-1`にて、§26.13で持ち越した3点の仕様判断がUserにより正式決定された。本節はその決定内容を記録する(§1〜26は削除・書き換えせず保持)。

### 27.1 SPEC DECISION 1: FAMILY-K命名 — 正式採用

**`FAMILY-K = Escape Close`を正式採用する。** E1〜E6を別Familyへ分割せず、単一Family内のSub-pattern(K1〜K6)として扱う。

理由(User決定に基づく): (1)いずれもEscape Close Contract違反という共通の症状ドメインに属する、(2)Fix Root Causeは異なるがユーザー操作契約(Escapeで閉じられるべき)は同一、(3)Family乱立を防止できる、(4)技術的な差異はBatch分割で吸収できる(Family分割は不要)。

#### K1〜K6正式定義(旧E1〜E6との対応)

| Sub-pattern | 定義 | 旧呼称 | 性質 |
|---|---|---|---|
| **K1** | Escape mechanism missing | E1 | Fix Finding |
| **K2** | Escape wrong target / wrong layer | E2 | Fix Finding(該当実例0件) |
| **K3** | Escape Priority Contract violation | E3 | Fix Finding |
| **K4** | Docs stale | E4 | **Documentation Correction category(Fix Findingではない)** |
| **K5** | Not Applicable | E5 | 対象外 |
| **K6** | Needs Special Handling | E6 | 設計判断待ち、Fix対象外 |

**K4の位置づけ**: K4(janken-app/tokei-app/gaze-keyboard profileModal・hrModalのmatrix「未検証」stale)は、app codeの欠陥ではなくdocs記載の陳腐化であるため、FAMILY-K配下のFix Finding(K1/K3)とは異なる「Documentation Correction」という別カテゴリとして扱う。既にmodal-conformance-matrix.mdの該当セルは訂正済み(§26.4)であり、追加のapp code修正は不要。

### 27.2 SPEC DECISION 2: nazori-app passcodeModal — 正式状態確定

**正式状態: `FAMILY-K / K6 / SPECIAL HANDLING / DESIGN REVIEW REQUIRED`**

passcodeModalは単純な情報表示modalではなく、`recordUnlocked`フラグと`lockRecord()`関数によって管理される「記録閲覧のロック解除workflow」を持つ(§26.7で確認済み)。Escapeでの閉鎖が意図したセキュリティ・操作設計(保護者向け記録へのアクセス制御)を壊さないかは、本Phaseでは判断せず、別のDesign Reviewへ委ねる。**今回のFAMILY-K Fix Batchには含めない。**

### 27.3 SPEC DECISION 3: kyou-no-kiroku modalCelebration — 正式状態確定

**正式状態: `FAMILY-K / K6 / SPECIAL HANDLING / DESIGN REVIEW REQUIRED`**

celebration modalが「自動消去」「一時的フィードバック」「interaction不要」「通常のEscape対象modal」のいずれに該当するかは、UI設計意図の確認が必要であり、本Phaseでは判断しない。**今回のFAMILY-K Fix Batchには含めない。**

### 27.4 SPEC DECISION 4: 新規発見6アプリのBatch方針 — 正式確定

新規発見6アプリ(nazori-app・sst-app・drawing-app・slideshow-sakusei・kyou-no-kiroku・kimochi-board)には、**Escapeだけを無条件実装しない。** Fix着手前に各対象modalのFocus Trap状態(Tab/Shift+Tab循環・Initial Focus・Focus Restoration)を同時確認することを正式方針とする。理由: Escapeのみ追加しても、Tab/Shift+Tabが背景へ流出する・Initial Focusが無い・Restorationが無い、といった別の欠陥が残存する可能性があるため(§26.7でnazori-appの4modal全てにFocus Trap欠如を確認済み、他5アプリも未確認のため同様の可能性)。

**ただし、Focus Trap未実装が見つかった場合でも自動的にFAMILY-Bを再オープンしない。** 各アプリ・各modalでSeparate Finding(FAMILY-B候補)として個別記録し、必要なら専用のFix Phase(FAMILY-B拡張、または新規Batch)へ分離する。FAMILY-K Batch(Escape)とFAMILY-B Batch(Focus Trap)は、たとえ同一modalが両方の欠陥を抱えていても、Fix実装そのものは分離すること。

### 27.5 FAMILY-K Fix Batch構成(正式採用)

以下の順序をUser承認済みの正式構成とする。

#### BATCH-K1: Escape Priority Contract Fix(対象: K3/E3)

**最優先**で実施する。対象はA11yパネルとのEscape優先順位違反16件相当(mogura-tataki panRec・janken-app howto-overlay/record-modal-backdrop・tokei-app helpModal/recordModal・gaze-keyboard profileModal/hrModal・hiragana-learn・katakana-app・nazorin-print[3modal]・shiritori2・bosai-app・cup_game helpModal・ongaku-app modal-help)。既存正解Pattern(gaze-keyboard settingsModal・ongaku-app modal-pin/export/share)をそのまま再利用する。理由: 修正パターンが均一、Contractが明確(§8)、Regression Riskが低い、影響範囲を限定しやすい。

#### BATCH-K2: Escape mechanism missing — 既存modal architecture確立済みアプリ(対象: K1/E1)

mogura-tataki・scratch-app・cup_game(settingsOverlay)等、既に他のFAMILY(B/D)のFix Batch実績があり、close helperの構造が把握済みのアプリを対象とする。既存close helperをEscapeから呼ぶ最小修正。

#### BATCH-K3: Escape mechanism missing — 新規発見・構造レビュー要(対象: 新規6アプリ)

sst-app・drawing-app・slideshow-sakusei・kyou-no-kiroku・kimochi-board・nazori-app(passcodeModal除く)。§27.4の方針に従い、各modalのrole/aria-modal/aria-labelledby/Initial Focus/Focus Trap/Restoration/Escape/A11yパネルcoexistenceを確認したうえでFixする。構造問題(Focus Trap欠如等)が見つかった場合はEscape Fixと混ぜず、Separate Finding化する。

### 27.6 K3 Fix Contract(正式確定、既存Source of Truthと一致確認済み)

A11yパネルopen中:
- Escape 1回目 → A11yパネルのみ閉じる。modalはopenのまま。
- Escape 2回目 → modalを閉じる。
- Focus Restoration → 正しいopenerへ戻る。

これはContract§5(Escape Priority Contract)の優先順位規定、および§26.2/§26.3で実機確認したgaze-keyboard settingsModalの正解Pattern動作と完全に一致する。新規のContract制定ではなく、既存Contractの正式適用として確定する。

### 27.7 K1 Fix Contract(正式確定)

Escape mechanism missing対象では:
```
Escape → existing close helper → existing restoration
```
とする。Escape専用に`style.display`変更・`hidden`属性直接変更・class除去・DOM削除のみを行い、既存close helperを迂回する実装は**禁止**とする(§15で提示した設計方針をそのまま正式Contract化)。

### 27.8 Separate Finding分離(再確認、変更なし)

以下はFAMILY-Kに混ぜない(§19/§20/§26.6から変更なし): role欠如・aria-modal欠如・aria-labelledby欠如・Visible Focus・Focus Trap欠如・Initial Focus欠如・Focus Restoration欠如・disabled-state不整合・A11yパネルProxy focus残留。dependencyのみ記録する。

### 27.9 次Phase

`WCAG-JIS-FIX-FAMILY-K-BATCH-1`(対象: K3/E3、Escape Priority Contract違反のFix実装)を次Phaseとして正式に推奨する。

### 27.10 Production/investigation branch保全確認

本Phase中、`main`/`origin/main`(`5ef50eb`)への変更・merge・pushは一切行っていない。`investigate/wcag-jis-finding-escape-1`(本docsコミット追加のみ)・`investigate/wcag-jis-finding-initial-restore-1`(HEAD `457f113`、完全untouched)ともに保全した。

### 27.11 最終Status(確定)

**`WCAG-JIS-FAMILY-K-SPEC-DECISION-1 = SPEC APPROVED / READY FOR BATCH-K1`**

FAMILY-K命名・K1〜K6定義・nazori-app passcodeModal/kyou-no-kiroku modalCelebrationの正式状態・新規6アプリのBatch方針・Fix Batch順序(K1→K2→K3)・K1/K3 Fix Contract、全てUser承認により確定した。次Phase `WCAG-JIS-FIX-FAMILY-K-BATCH-1` でK3(Escape Priority Contract違反)のコード修正に着手可能な状態となった。

---

## 28. [WCAG-JIS-FIX-FAMILY-K-BATCH-1追記] BATCH-K1(K3) RC実装結果

`WCAG-JIS-FIX-FAMILY-K-BATCH-1`にて、§27.5で確定したBATCH-K1(K3、Escape Priority Contract違反)のFix実装をRCとして完了した。worktree`for-all-children-to-learn-wcag-jis-family-k-batch-1`、branch`fix/family-k-escape-priority-batch-1`(baseline: `origin/main` @ `5ef50eb`、drift無し)。

### 28.1 正式対象一覧(17件、推測せず全件列挙)

§11総括表と§26.2/§26.5の実機再確認結果を統合し、以下17件をK3の正式Fix対象として確定した(K1・K2・K4・K5・K6には一切触れない)。

| # | App | Modal | Pre-fix Evidence |
|---|---|---|---|
| 1 | mogura-tataki | panRec | LEVEL-A(§26.2) |
| 2 | janken-app | howto-overlay | LEVEL-A(§26.2) |
| 3 | janken-app | record-modal-backdrop | LEVEL-A(§26.5) |
| 4 | tokei-app | helpModal | LEVEL-A(§26.2) |
| 5 | tokei-app | recordModal | LEVEL-A(§26.5) |
| 6 | gaze-keyboard | profileModal | LEVEL-A(§26.2) |
| 7 | gaze-keyboard | hrModal | LEVEL-A(§26.2) |
| 8 | hiragana-learn | traceSampleViewer | LEVEL-A(§6.2) |
| 9 | katakana-app | traceSampleViewer | LEVEL-B(構造推定) |
| 10 | nazorin-print | helpModal | LEVEL-B(構造推定) |
| 11 | nazorin-print | batchModal | LEVEL-B(構造推定) |
| 12 | nazorin-print | libModal | LEVEL-B(構造推定) |
| 13 | shiritori2 | settings | LEVEL-B(構造推定) |
| 14 | shiritori2 | record-modal-backdrop | LEVEL-B(構造推定) |
| 15 | bosai-app | help | LEVEL-B(構造推定) |
| 16 | cup_game | helpModal | LEVEL-B(構造推定) |
| 17 | ongaku-app | modal-help | LEVEL-B(構造推定) |

### 28.2 正解Pattern確認(再検証)

`gaze-keyboard.html`の`settingsModal`Escapeハンドラを再確認し、以下の順序を正式Fix Contractとして採用した: (1)Escapeキー判定、(2)modal自身のopen状態判定、(3)`donomanaA11yPanel`の`style.display==='block'`判定(該当すればreturn)、(4)`preventDefault()`、(5)既存close helper呼び出し。新しいglobal frameworkは導入せず、この4行相当のガード条件を各対象へ個別に追加した。

### 28.3 Root Cause確認(対象ごと)

17件全て同一のRoot Cause: **modal側のEscape keydownハンドラが、共通A11yパネルのopen状態を一切参照せずに自身のclose helperを呼んでいた**(gaze-keyboard settingsModal・ongaku-app modal-pin/export/shareのみ既にこの参照を実装済みだった)。global Escape handlerとmodal Escape handlerが両方とも同一のEscapeキーイベントに独立して反応し、preventDefault/stopPropagationによる制御も無かったため、1回のEscapeで両方のcloseロジックが実行されていた。

### 28.4 changed files / 修正内容

11ファイル、113行追加・19行削除(最小差分)。各ファイルの既存Escapeハンドラに、A11yパネルopen判定によるガード条件を追加しただけで、close helper自体・Focus Restoration処理・Focus Trap実装には一切手を加えていない。commit `967432f`(app fixのみ)。

### 28.5 Browser Validation結果

**Case A(modalのみopen)**: 17件全てPASS(Escape押下でmodal close、console/page errors 0件)。

**Case B(modal + A11yパネル、8ステップ)**: 17件全てPASS。Escape#1でA11yパネルのみclose(`a11y=none, modal=True`)、Escape#2でmodal close(`modal=False`)+正しいopenerへFocus Restoration、を全対象で実機確認(Playwright `page.locator(...).click()`による実クリック、JS直接`.click()`は不使用)。

**Case C(keyboard navigation、代表5対象)**: mogura-tataki panRec・gaze-keyboard profileModal/hrModal・hiragana-learn traceSampleViewer・cup_game helpModalでForward Tab 15回・Reverse Shift+Tab 15回・immediate Shift+Tabを再確認、全てPASS(regressionなし)。

**A11yパネルstrict containment(代表3対象)**: mogura-tataki panRec・hiragana-learn traceSampleViewerはPASS(A11yパネルOPEN中のTabがmodal内へ戻らない)。**gaze-keyboard profileModalはFAIL**(A11yパネルOPEN中のTab 15回後もactiveElementがprofileModal内に残留)。

**janken-app howto-overlay Focus Trap再確認(§10要求)**: Forward Tab#3でBODY外へ、Reverse#1で即座に脱出、immediate Shift+TabもFAIL。

**Regression判定**: 上記2件について、修正前のProduction版(`main`、`5ef50eb`)で同一テストを実施した結果、**いずれも修正前から同一の症状が再現した**(今回のK3差分とは無関係のpre-existing issue)。よって今回のK3 Fixによるregressionではないと判定し、Fix自体は継続した。

### 28.6 Separate Finding新規発見(FAMILY-B候補、今回修正せず)

| Finding | 対象 | 内容 | Evidence |
|---|---|---|---|
| 新規1 | janken-app howto-overlay | Focus Trap実装が存在しない(コード内コメントで「howto-overlayには独自のTab focus-trapが無い」と明記済み、`record-modal-backdrop`側にのみ専用Trap実装がある)。modal-conformance-matrix.mdのjanken-app行Focus Trap列「✅(端点循環)」は`record-modal-backdrop`側の実装を指しており、`howto-overlay`自体の欠如は記載から読み取れない状態だった | LEVEL-A(Production版・Fix版とも同一症状を実機確認) |
| 新規2 | gaze-keyboard profileModal | 共通A11yパネルOPEN中のTab処理が、A11yパネル自身のstrict containmentへ正しく移行せず、profileModal内にactiveElementが留まる(mogura-tatakiのFAMILY-B-BATCH-6-RC4で確立したstrict containmentパターンが、gaze-keyboardのA11yパネル実装には未適用と推定) | LEVEL-A(Production版・Fix版とも同一症状を実機確認) |

いずれも既存のFAMILY-B(Focus Trap)領域の別Findingであり、今回のK3 Fixのscope外として記録するに留める。§27.4のnew-app方針(Focus Trap欠如が見つかっても自動的にFAMILY-Bを再オープンしない)と同じ原則を、既存アプリでの新規発見にも適用する。

### 28.7 Touch / Responsive / 200%zoom / Multi-input

- **Touch**: mogura-tataki panRec(tap操作でCase B再確認)・cup_game helpModal(close buttonのtap操作、今回の差分と無関係な既存動作)いずれも正常。
- **Responsive**: 375×667/390×844/768×1024/1280×900の4パターンでmogura-tataki panRecのCase B(8ステップ)を再確認、全てPASS、horizontal overflowなし。
- **200%zoom**: 同上、PASS。
- **Switch/Gaze**: 修正はkeydownリスナーの条件分岐追加のみで、gaze-keyboardの`pointermove`(dwell)リスナー数がProduction版と一致することを確認(1件、変更なし)。Switch Scan関連コードにも触れていない。
- **keydownリスナー数**: 11ファイル全てでProduction版と完全一致(意図しない重複リスナー追加なし)。

### 28.8 Console/page errors

全テストを通じて0件。

### 28.9 Static Validation

`git diff --check`エラーなし。変更は11ファイル・113行追加/19行削除の最小差分のみ。

### 28.10 Separate Finding保全確認

K1(Escape mechanism missing)・cup_game settingsOverlay(K1)・role/aria-modal欠如・aria-labelledby欠如・Visible Focus・Initial Focus・Focus Restoration・disabled-state不整合・A11yパネルProxy focus残留・K6(nazori-app passcodeModal・kyou-no-kiroku modalCelebration)は今回一切変更していない。

### 28.11 Production/investigation branch保全確認

本Phase中、`main`/`origin/main`(`5ef50eb`)への変更・merge・pushは一切行っていない。`investigate/wcag-jis-finding-escape-1`・`investigate/wcag-jis-finding-initial-restore-1`(HEAD `457f113`)はいずれも変更していない(本Fix branch上でdocsの最新版を複製し追記したのみ)。

### 28.12 RC Gate判定

17件全てCase A/B PASS、Regression Riskは新規発見2件のみだがいずれもPre-existing(regressionではない)と確認済みのため、**RC READY**と判定する。

**`WCAG-JIS-FIX-FAMILY-K-BATCH-1 = RC READY / WAITING FOR USER BROWSER REVIEW`**

Production Releaseへは進まず、User Browser Reviewを待つ。

---

## 29. [WCAG-JIS-FIX-FAMILY-K-BATCH-1-RELEASE追記] Production Release完了

User Browser Review Approved後、`WCAG-JIS-FIX-FAMILY-K-BATCH-1`のRC(commit `967432f`app fix・`aab8e22`docs)を`git merge --ff-only`でProductionへ反映した。

### 29.1 Release手順

1. Release開始時baseline再確認: `main = origin/main = 5ef50eb`(drift無し)。
2. RC branch(`fix/family-k-escape-priority-batch-1`)の履歴・diffを再確認、K3以外の混入(K1/role/aria-modal/Focus Trap/Initial Focus/Focus Restoration/Visible Focus/リファクタ)が無いことを11ファイル全件の差分表示で確認。
3. `git merge --ff-only fix/family-k-escape-priority-batch-1`で`5ef50eb`→`aab8e22`へfast-forward。
4. `git push origin main`実施。
5. CI確認: push後、`sitemap.xml`のみのCI自動コミット`bfd0f3d`(11アプリ分のlastmod更新、意図した正常な生成差分)を確認。
6. ローカルmainを`git merge --ff-only origin/main`で`bfd0f3d`へ追従。

### 29.2 Production反映確認

`grep -c "FAMILY-K/K3是正"`でProduction上の11ファイル全てに修正コメントが存在することを確認(mogura-tataki×1、janken-app×2、tokei-app×2、gaze-keyboard×2、hiragana-learn×1、katakana-app×1、nazorin-print×3、shiritori2×2、bosai-app×1、cup_game×1、ongaku-app×1)。

### 29.3 Production HEAD上でのK3再検証(17件全件)

§28で使用したbrowser validation scriptをProduction HEAD(`bfd0f3d`)に対して再実行した。

**Case A(modalのみ)・Case B(A11yパネル共存8ステップ)**: 17件全てPASS(RC検証時と完全に同一の結果)。Escape#1でA11yパネルのみclose、Escape#2でmodal close+正しいopenerへFocus Restoration、を実クリックで再確認。console/page errors 0件。

### 29.4 Regression再確認(代表5対象)

Forward Tab 15回・Reverse Shift+Tab 15回・immediate Shift+Tab: mogura-tataki panRec・gaze-keyboard hrModal・hiragana-learn traceSampleViewer・cup_game helpModalは全てPASS(regressionなし)。

**既知のpre-existing issue再確認**: janken-app howto-overlay(Focus Trap欠如)・gaze-keyboard profileModal(A11yパネル共存時のstrict containment失敗)は、Production HEAD上でもRC検証時と完全に同一の症状が再現することを確認した。これらは今回のK3差分と無関係であることが二重に(RC時のPre-K3比較、Release後のProduction再確認)確定した。§28.6のSeparate Finding記録は変更しない。

### 29.5 Touch / Responsive / 200%zoom / Multi-input

Touch(mogura-tataki panRec Case B再確認、cup_game helpModal close button操作)・Responsive(375×667/390×844/768×1024/1280×900、horizontal overflowなし)・200%zoom、全てPASS。gaze-keyboardの`pointermove`(dwell)リスナー数がRelease前後で1件のまま変化なし(Gaze/dwellへの影響なし)。console/page errors 0件。

### 29.6 Docs最終更新

K3対象17件について、`modal-conformance-matrix.md`の該当セルを`RC FIXED / LOCAL VERIFIED`から`✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED`へ更新した(commit `967432f`参照)。`global-fix-triage-1.md`のTIER1-F7ステータスも更新した。

### 29.7 Separate Finding維持(変更なし)

以下は今回のReleaseに一切含まれていない、引き続き未解決のまま維持する: janken-app howto-overlay Focus Trap欠如、gaze-keyboard profileModal strict containment失敗、K1(Escape mechanism missing)群全て、cup_game settingsOverlay role/aria-modal、Visible Focus、aria-labelledby関連、K6(nazori-app passcodeModal・kyou-no-kiroku modalCelebration)、A11yパネルProxy focus残留、その他既存Separate Finding。

### 29.8 FAMILY-K / BATCH-K1状態

- **K3 = ✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(17件全て)
- **BATCH-K1 = CLOSED**
- **FAMILY-K = OPEN**(K1・K6が残存するため、Family全体はCloseしない)

### 29.9 Production/investigation branch保全確認

`main = origin/main = bfd0f3d`。`investigate/wcag-jis-finding-escape-1`(HEAD `8193073`)・`investigate/wcag-jis-finding-initial-restore-1`(HEAD `457f113`)ともに本Release作業中一切変更していない。

### 29.10 次Phase

`WCAG-JIS-FIX-FAMILY-K-BATCH-2`(対象: K1 Escape mechanism missing)を推奨する。対象数が多いため、既存architecture確立済みアプリ群(mogura-tataki・scratch-app・cup_game等)を最初のBatchとし、新規発見6アプリ(sst-app等)は§27.4の方針どおりFocus Trap同時確認が必要な別Batchとする。K6(nazori-app passcodeModal・kyou-no-kiroku modalCelebration)はまだ触らない。

### 29.11 最終Status

**`WCAG-JIS-FIX-FAMILY-K-BATCH-1-RELEASE = PRODUCTION RELEASED / CLOSED`**

`FAMILY-K = OPEN`を維持する(K1・K6が残存)。
