# WCAG-JIS-AUDIT-GLOBAL-FIX-TRIAGE-1

35アプリ累積監査(Tier1+Tier2+Tier3)のFindingをFinding Family単位で統合し、修正アーキテクチャを確定する。**本Phaseではコードを一切修正しない。**

Source of Truth: `all-35-apps-accessibility-audit-summary.md`・`all-35-apps-accessibility-fix-backlog.md`・`tier1/`・`tier2/`・`tier3/`各成果物。

---

## 1. Finding現状一覧

| Finding ID | Family | Severity | App数 | 対象アプリ | 状態 | Manual Pending | Spec Decision | 既知Fixパターン |
|---|---|---|---|---|---|---|---|---|
| TIER1-F1 | Heading Runtime Visibility | (元P2) | 1 | tyushi | ✅ Closed | あり(体感未確認) | なし | あり(visually-hidden静的H1) |
| TIER1-F2 | FAMILY-A | P2 | 4 | register-app・time-timer・janken-app・tokei-app | Open | - | なし | あり(okane-app等で実証済み) |
| TIER2-F1 | FAMILY-A | P2 | 3 | shiritori2・bosai-app・ongaku-app(modal-help) | Open | - | なし | あり(同上) |
| TIER1-F3 | FAMILY-B | P2 | 6アプリ / **14 Finding(modal単位、2026-09-08 WCAG-JIS-FAMILY-B-LEDGER-NORMALIZE-1で個別Finding ID化。内訳: register-app[delete-modal]=TIER1-F3-a、scratch-app[txtEdOv]=TIER1-F3-b、scratch-app[cov]=TIER1-F3-c、nazorin-print[helpModal]=TIER1-F3-d、nazorin-print[batchModal]=TIER1-F3-e、nazorin-print[libModal]=TIER1-F3-f、tyushi[help-overlay]=TIER1-F3-g、gaze-keyboard[profileModal]=TIER1-F3-h、gaze-keyboard[hrModal]=TIER1-F3-i、mogura-tataki[scrStart/scrResult/panSet/panRec/panHow]=TIER1-F3-j〜n。旧「6」はapp数でありFinding数と異なる単位のため混同しないこと。正式なSource of Truthは`family-b-focus-trap-finding-ledger.md`)** | mogura-tataki・scratch-app(txtEdOv・cov)・nazorin-print(help/batch/lib)・tyushi(help-overlay。settings-panelは非modal確定によりNOT APPLICABLE、対象外)・gaze-keyboard(profileModal/hrModal)・register-app(delete-modal) | **[2026-09-09時点] ALL SUB-FINDINGS TECHNICALLY RESOLVED / PRODUCTION REFLECTED**(旧表記`ALL REMAINING SUB-FINDINGS FIXED IN RC / USER REVIEW PENDING`から更新。以下は個別Finding単位の経緯、削除せず保持)(**[2026-09-08追記] うちTIER1-F3-a(register-app delete-modal)のみ`WCAG-JIS-FIX-FAMILY-B-BATCH-1-RELEASE`(commit `a012cfa`)で✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED。[2026-09-08追記2] TIER1-F3-b(scratch-app txtEdOv)・TIER1-F3-c(scratch-app cov)は`WCAG-JIS-FIX-FAMILY-B-BATCH-2-RELEASE`(commit `fb13634`)で✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED。[2026-09-08追記3] TIER1-F3-d(nazorin-print helpModal)・TIER1-F3-e(batchModal)・TIER1-F3-f(libModal)は`WCAG-JIS-FIX-FAMILY-B-BATCH-3-RELEASE`(commit `4da35d9`)で✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED。[2026-09-08追記4] TIER1-F3-h(gaze-keyboard profileModal)・TIER1-F3-i(hrModal)は`WCAG-JIS-FIX-FAMILY-B-BATCH-4-RELEASE`(commit `f070ca1`)で✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED。[2026-09-08追記5] TIER1-F3-g(tyushi help-overlay)は`WCAG-JIS-FIX-FAMILY-B-BATCH-5`でFIXED IN RC / USER REVIEW PENDINGとしたが、User Browser ReviewでA11yパネル共存回帰がFAILし`USER REVIEW FAILED / RC REVISION REQUIRED`。[2026-09-08追記6] RC2で再修正しUser Browser Review Approved、`WCAG-JIS-FIX-FAMILY-B-BATCH-5-RELEASE`(commit `26217f6`)で✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTED。[2026-09-08追記7] TIER1-F3-j(mogura-tataki scrStart)・TIER1-F3-k(scrResult)・TIER1-F3-l(panSet)・TIER1-F3-m(panRec)・TIER1-F3-n(panHow)は`WCAG-JIS-FIX-FAMILY-B-BATCH-6`でFIXED IN RC / USER REVIEW PENDING(Production未反映)。これでTIER1-F3配下14 Finding全てがProduction反映済みまたはRC完了となったため、親Finding全体のステータスを`ALL REMAINING SUB-FINDINGS FIXED IN RC / USER REVIEW PENDING`へ更新する(Production Release完了までは正式Closeとしない)。[2026-09-09追記8] TIER1-F3-j〜nはUser Browser Reviewで指摘(panSet close後の予期しないフォーカス移動等)を受け、RC2で`panSet`の`closePanelAndReturnFocus`にopener可視性フォールバックを追加して再修正、`FIXED IN RC2 / USER REVIEW PENDING`。[2026-09-09追記9] RC2も再度User Browser ReviewでFAIL(A11yパネル継続Tabでmogura側/共通ツールバー側へフォーカス移動・不可視ボタンのTab順序混入・panSetトグルへのTab到達性体感不良)。推測を排した完全なkeyboard focus model再調査により、A11yパネルクラスタへのmogura固有ボタン(`btnHow`/`btnRec`/`btnFS`)誤含有(tyushi実装との比較で確定)と、panSet内トグルswitchのVISIBLE FOCUS問題(Focus Trap問題とは別カテゴリと明確に分離)を新規特定。RC3でクラスタ修正とfocus-visible CSS追加により再修正、`FIXED IN RC3 / USER REVIEW PENDING`。詳細はfamily-b-focus-trap-finding-ledger.md§26参照。[2026-09-09追記10] RC3も再度User Browser ReviewでFAIL(A11yパネルOPEN中のTabでホーム/学習の記録/画面ロックへ移動)、RC1〜RC3の「A11yパネル+共通toolbarクラスタ」設計自体が否定され、RC4でA11yパネル単体のstrict focus containment(トリガー+パネル内部要素のみで循環、outside-focus-guardも単純化)へ変更、`FIXED IN RC4 / USER REVIEW PENDING`。[2026-09-09追記11] RC4でUser Browser Review Approved。`WCAG-JIS-FIX-FAMILY-B-BATCH-6-RELEASE`(commit `9f8fb59`、mainへfast-forward merge、CI自動コミット`400f661`)でTIER1-F3-j〜nは✅ TECHNICALLY RESOLVED / PRODUCTION REFLECTEDとなった。panSet内disabled-state不整合(dwT/togCur/dwTol)はSeparate Finding継続、今回のReleaseには含まない。これによりTIER1-F3配下14 Finding全てがProduction反映済みとなったため、親Finding全体のステータスを`ALL SUB-FINDINGS TECHNICALLY RESOLVED / PRODUCTION REFLECTED`へ更新する。詳細はfamily-b-focus-trap-finding-ledger.md§28参照**) | - | あり(Modal Accessibility Contract v1.1で正式要件確定済み) | あり(register-app product-modal等の端点循環実装を参照実装として適用可能。詳細はfamily-b-cross-app-audit-1.md・family-b-focus-trap-finding-ledger.md参照) |
| TIER2-F2 | FAMILY-B | P2 | 3アプリ / **4 Finding(modal単位、2026-09-08 WCAG-JIS-FAMILY-B-LEDGER-NORMALIZE-1で個別Finding ID化。内訳: cup_game[settingsOverlay]=TIER2-F2-a、cup_game[helpOverlay]=TIER2-F2-b、hiragana-learn[traceSampleViewer]=TIER2-F2-c、katakana-app[traceSampleViewer]=TIER2-F2-d。旧「5」は行単位の暫定値でFinding数と異なる単位のため混同しないこと。正式なSource of Truthは`family-b-focus-trap-finding-ledger.md`)** | hiragana-learn・katakana-app・cup_game(helpModal・settingsOverlay) | **[2026-09-09時点] ALL SUB-FINDINGS TECHNICALLY RESOLVED / PRODUCTION REFLECTED / CLOSED**(旧表記`ALL SUB-FINDINGS FIXED IN RC / USER REVIEW PENDING`から更新。`WCAG-JIS-FIX-FAMILY-B-BATCH-7-RELEASE`[commit `24dd18e`]でUser Browser Review Approved、Production HEAD上での再検証[Forward/Reverse各15回・immediate Shift+Tab・outside-focus-guard・A11yパネルcoexistence・Responsive5パターン・Touch]全てPASS、console/page errors 0件。4件全てTECHNICALLY RESOLVED / PRODUCTION REFLECTEDとなったためParentをCLOSEDとする。詳細はfamily-b-focus-trap-finding-ledger.md§29・§30参照) | - | あり | あり(同上) |
| ~~TIER2-F2旧記載~~ | ~~FAMILY-B~~ | — | — | ~~ongaku-app(modal-pin/export/share、role自体も欠如)~~ | **[2026-09-08訂正] `WCAG-JIS-FIX-MODAL-ONGAKU-1-RELEASE`(commit `c8a5bd0`)で解消済み、Technically Resolved。TIER2-F2の対象からは既に除外済みだったが、この行自体の「Open」記載が更新されず残っていたため本行で訂正・削除する** | - | - | - |
| TIER2-F3 | FAMILY-C | P1 | 2 | cup_game(✅解消済み)・ongaku-app(Open) | **Partially Resolved** | - | ongaku-app分はFAMILY-Bと一体 | cup_gameはあり(適用済み)、ongaku-appは単独パターン不可 |
| TIER1-F5 | FAMILY-D | P2 | 1 | register-app(product-modal) | ✅ **Technically Resolved(WCAG-JIS-FIX-FAMILY-D-REGISTER-1-RELEASE、commit `b71cbfb`、Production Validation PASS)** | - | あり(Modal Accessibility Contract v1.1で正式要件確定済み) | 適用済み(`pmOpenerProductId`追加+disconnected時の同一商品再取得fallback) |
| TIER1-F5B[2026-09-08新規登録] | FAMILY-D | P2 | 1 | register-app(delete-modal) | ✅ **Technically Resolved(WCAG-JIS-FIX-FAMILY-D-REGISTER-DELETE-1-RELEASE、commit `3282b02`、Production Validation PASS)** | - | あり(TIER1-F5と同一Contract) | 適用済み(`dmDeletingId`+`dmDeletingIndex`保持。cancel/Escapeは同一`.product-card`、confirm削除後は再描画後の同一index位置のカードへlogical replacement。TIER1-F5のRC検証中に新規発見、product-modalとは別のFinding) |
| TIER1-F7[2026-09-09新規登録] | **FAMILY-K = Escape Close(`WCAG-JIS-FAMILY-K-SPEC-DECISION-1`で正式採用)** | P2 | 18アプリ / **modal単位で約37件(K1約21件+K3約16件、`WCAG-JIS-FINDING-ESCAPE-1`調査。正式なSource of Truthは`finding-escape-1.md`)** | mogura-tataki・scratch-app・cup_game・sst-app・drawing-app・slideshow-sakusei・kyou-no-kiroku・kimochi-board・nazori-app・janken-app・tokei-app・gaze-keyboard・hiragana-learn・katakana-app・nazorin-print・shiritori2・bosai-app・ongaku-app | **CROSS-APP ESCAPE AUDIT COMPLETE / SPEC DECISION REQUIRED**。Escapeキーで閉じられないmodal(K1: Escape mechanism missing、旧E1)、および共通A11yパネルとの優先順位競合により1回のEscapeで両方同時に閉じてしまうmodal(K3: Escape Priority Contract §5 violation、旧E3)を35アプリ横断で確認した。janken-app/tokei-app/gaze-keyboard(profileModal/hrModal)は旧matrix「未検証」記載がstale(K4、Documentation Correction category)だったことも判明・訂正済み。nazori-app(4modal)・sst-app(5modal)・drawing-app(6modal)・slideshow-sakusei(1modal)・kyou-no-kiroku(4modal)・kimochi-board(5modal、うち1件PASS)は今回新規発見(role属性なしのcustom modal、旧matrix未記載)。Fix実装は未着手(調査専用Phase)。**[2026-09-09追記、WCAG-JIS-FAMILY-K-SPEC-DECISION-1完了] 以下4点のSPEC DECISIONがUser承認により正式確定した:** (1)FAMILY-K = Escape Closeを単一Familyとして正式採用、E1〜E6をK1〜K6として同一Family内のSub-patternに統一(K4はFix Findingではなくdocs stale訂正のDocumentation Correction categoryと位置づけ)。(2)nazori-app passcodeModal = `FAMILY-K / K6 / SPECIAL HANDLING / DESIGN REVIEW REQUIRED`(ロック解除workflowのため今回Fix対象外)。(3)kyou-no-kiroku modalCelebration = 同上(celebration modalの性質確認が先に必要)。(4)新規発見6アプリはEscapeのみ無条件実装せず、Focus Trap状態を同時確認したうえでFix、Focus Trap欠如が見つかっても自動的にFAMILY-Bを再オープンせずSeparate Finding化。Fix Batch順序はBATCH-K1(K3最優先)→BATCH-K2(K1、既存architecture確立済みアプリ)→BATCH-K3(K1、新規6アプリ、要構造レビュー)で正式確定。詳細はfinding-escape-1.md§27参照。ステータスを`SPEC APPROVED / READY FOR BATCH-K1`へ更新、次Phaseは`WCAG-JIS-FIX-FAMILY-K-BATCH-1`(対象K3)**。**[2026-09-09追記、WCAG-JIS-FIX-FAMILY-K-BATCH-1完了]** K3対象17件(mogura-tataki panRec・janken-app 2modal・tokei-app 2modal・gaze-keyboard 2modal・hiragana-learn・katakana-app・nazorin-print 3modal・shiritori2 2modal・bosai-app・cup_game helpModal・ongaku-app modal-help)全てにEscapeハンドラへA11yパネルopen判定を追加するRC修正を実装(commit `967432f`、worktree`for-all-children-to-learn-wcag-jis-family-k-batch-1`、branch`fix/family-k-escape-priority-batch-1`)。Case A(modalのみ)/Case B(A11yパネル共存8ステップ)全17件PASS、Forward/Reverse Tab・immediate Shift+Tab・Touch・Responsive(4パターン)・200%zoom・console/page errors 0件を代表対象で確認。既存のkeydownリスナー数もProduction版と完全一致(重複追加なし)。検証中にjanken-app howto-overlay(Focus Trap実装自体が無い)・gaze-keyboard profileModal(A11yパネル共存時のstrict containment失敗)という2件の**既存の別問題(regressionではない、Production版でも同一症状を確認済み)**を新規発見し、FAMILY-B領域のSeparate Finding候補として記録(今回未修正)。ステータスを`RC READY / WAITING FOR USER BROWSER REVIEW`へ更新、Production未反映。詳細はfinding-escape-1.md§28参照 | (2026-09-09確定)nazori-app passcodeModal・kyou-no-kiroku modalCelebrationは`K6 / DESIGN REVIEW REQUIRED`として別Design Phaseへ送付、今回のBatchには含めない | **解消(2026-09-09、WCAG-JIS-FAMILY-K-SPEC-DECISION-1で全4点確定)**: (1)Family命名=FAMILY-K採用確定、(2)(3)nazori-app/kyou-no-kirokuの2件はDESIGN REVIEW REQUIREDとして正式に切り分け済み(Fix対象外として確定、仕様未決定ではない)、(4)新規6アプリはBatch-K3でFocus Trap同時確認する方針が確定 | あり(gaze-keyboard settingsModal・ongaku-app modal-pin/export/shareが正解Pattern。Escapeハンドラ先頭に`if(a11yPanel && a11yPanel.style.display==='block')return;`を追加する1行パターンをK3に、既存close helperへのEscapeハンドラ新規追加をK1にそれぞれ横展開可能。詳細はfinding-escape-1.md§15・§26.10・§27参照) |
| TIER1-F6 | FAMILY-E | (Spec) | 18 | 全app固有モーダル保有アプリ(4系統) | Open | - | あり(実装方式統一要否) | N/A(方針決定が前提) |
| TIER1-F4 | FAMILY-F | P2〜P3 | 8 | register-app・matching-app・time-timer・mogura-tataki・okane-app・nazorin-print・schedule-app・gaze-keyboard | Open | あり(gradient等) | デザイントークン方針 | 部分的(トークン単位) |
| TIER2-F4 | FAMILY-F | P3 | 5 | cup_game・ongaku-app・kimochi-board・drawing-app・katachi-awase-app | Open | あり | 同上 | 同上 |
| TIER3-F3 | FAMILY-F | P3 | 4 | timetable-app・yomikaki-app・sst-app・slideshow-sakusei | Open | あり | 同上 | あり(yomikaki-appは単一トークン一括改善の見込み) |
| TIER2-F5 | FAMILY-G | P2 | 1 | drawing-app | Open | - | なし | 調査要(ResizeObserver方向) |
| TIER3-F2 | FAMILY-G | P2 | 1 | slideshow-sakusei | Open | - | あり(モバイル対応方針) | 方針依存 |
| TIER3-F1 | FAMILY-H | P3 | 1 | yomikaki-app | Open | - | なし | あり(タグ変更のみ) |
| TIER2-F6 | FAMILY-I | (元P1→P2) | 1 | katachi-awase-app | ✅ **Technically Resolved** | あり(他AT差異) | なし | 適用済み |

---

## 2. Open / Partially Resolved / Technically Resolved 総括

| 状態 | Finding | 件数 |
|---|---|---|
| ✅ Closed | TIER1-F1 | 1 |
| ✅ Technically Resolved | TIER2-F6・TIER1-F5[WCAG-JIS-FIX-FAMILY-D-REGISTER-1-RELEASE]・**TIER1-F5B[2026-09-08追加、WCAG-JIS-FIX-FAMILY-D-REGISTER-DELETE-1-RELEASE]** | 3 |
| 🟡 Partially Resolved | TIER2-F3(cup_game分のみ解消) | 1 |
| 🔴 Open(未着手) | TIER1-F2,F3,F4,F6 / TIER2-F1,F2,F4,F5 / TIER3-F1,F2,F3 | 11 |

**解消済みFindingをFix backlogへ再度入れない**(§5準拠)。TIER2-F3はcup_game分を再修正対象にせず、ongaku-app分のみを以降のFAMILY-B/Cの対象として扱う。**register-appのproduct-modal(TIER1-F5)・delete-modal(TIER1-F5B)はいずれもProduction解消済み**(詳細はfamily-d-focus-restoration-close-1.md参照)。

---

## 3. Severity集計(35アプリ累積、再確認)

| Severity | 件数 | 内訳 |
|---|---|---|
| P0 | 0 | - |
| P1 | 1 | TIER2-F3(ongaku-app分が現存する限りFamily全体としてP1維持) |
| P2 | 10 | TIER1-F2,F3,F5 / TIER1-F4(P2側)/ TIER2-F1,F2,F5 / TIER2-F6(解消済みだが件数上P2として記録) / TIER3-F2 |
| P3 | 個別評価 | TIER1-F4(P3側)・TIER2-F4・TIER3-F1・TIER3-F3 |

---

## 4. P1対応方針: ongaku-app構造Fix

**現在唯一のP1はTIER2-F3のongaku-app分。** ただし直接コード確認済みの通り、ongaku-appのmodal-pin/modal-export/modal-shareは以下が同時に欠如しており、初期focus単独修正は禁止する(WCAG-JIS-AUDIT-FIX-TRIAGE-1で既に確立した判断を踏襲):

- `role="dialog"` / `aria-modal="true"` — 3モーダルとも欠如(実測: `getAttribute`が`null`)
- accessible name(`aria-labelledby`結び付け) — 欠如
- Initial Focus(`.focus()`呼び出し) — 欠如
- Focus Trap(Tab-key handler) — 欠如
- Escape close — 欠如
- Focus Restoration — 欠如(modal-help以外は`focus()`呼び出し自体がないため復帰も発生しない)

**この6要素は「initial focus」という1 Findingラベルの範囲を超えており、実質的にFAMILY-A・FAMILY-B・FAMILY-Cの3つが重なった複合構造課題である。** したがって仮称`FIX-P2-ONGAKU-MODAL`ではなく、P1を含む実態を反映した名称 **`WCAG-JIS-FIX-MODAL-ONGAKU-1`** を正式Phase名候補とする。

比較のため、modal-help(TIER2-F1で確認済み、role/aria-modal/Escape/初期focus/復帰は実装済みでA11yパネル例外のみ欠如)とmodal-pin/export/shareとでは実装完成度に大きな差があり、**modal-helpの既存実装をベースパターンとして3モーダルへ横展開する**方針を第一候補とする(§8で詳述)。

---

## 5. ongaku-app構造Fix Architecture(設計のみ、実装しない)

| 要素 | modal-help(既存・参照可能) | modal-pin/export/share(要実装) |
|---|---|---|
| role="dialog" | ✅済み | 新規付与要 |
| aria-modal="true" | ✅済み | 新規付与要 |
| accessible name(aria-labelledby) | ✅済み(`help-modal-title`) | 新規: 各モーダルの`<h3>`にid付与し`aria-labelledby`で結び付け(modal-pinの`<h3>せんせいようせってい</h3>`、modal-exportの既存`#export-title`、modal-shareの`<h3>`) |
| Initial Focus | ✅済み | 新規: 各titleへ`tabindex="-1"`+open関数内`.focus()`(PILOT-F1/TIER2-F3[cup_game]と同一パターン) |
| Focus Trap | ❌欠如(TIER2-F1対象) | 新規実装要(TIER1-F3/TIER2-F2で確立した2方式[matching-app型/tokei-app型]のいずれかを採用) |
| Escape | ✅済み | 新規実装要 |
| Focus Restoration | ✅済み(`donomanaHelpBtn.focus()`) | 新規: 各トリガーボタンへの復帰実装 |
| 背景抑制 | ❌欠如(系統D) | 方針次第(TIER1-F6のSpec Decision待ち) |
| A11yパネル共存 | ❌欠如(TIER2-F1対象、今回同時解消が望ましい) | 新規実装要 |
| Switch/Gaze | 未検証(独立) | 3モーダルとも新規実装後に候補分離ロジックの検証が必要 |

**help modalとの共通化可能性**: 4モーダルとも`.modal-bg`/`.modal`という共通CSSクラスを使用しており(コード内コメントで明記済み)、Focus Trap/Escape/初期focus/復帰の実装を共通関数化した上で4モーダルへ適用する設計が、個別に4回実装するより保守性・一貫性の面で優れる可能性が高い。**ただし今回は設計評価のみで実装しない。**

---

## 6. Modal Family横断Fix Strategy(FAMILY-A/B/D/E)

FAMILY-A(A11yパネル例外欠如)・FAMILY-B(Focus Trap欠如)・FAMILY-D(Focus Restoration)・FAMILY-E(背景抑制方式)は、いずれも「モーダルアクセシビリティ」という同一領域に属し、対象アプリも重複する(例: ongaku-appはFAMILY-A・B双方に該当)。

### Plan M1: アプリごとに個別Fix
- 利点: 各Phaseが小さく、User Reviewが早く回る
- 欠点: FAMILY-Eの方針(背景抑制の実装方式統一)が未決定のまま個別Fixを進めると、後で方式変更が必要になった場合に手戻りが発生する。特にFAMILY-B(Focus Trap新規実装)は背景抑制の要否と密接に関わる

### Plan M2: Modal Accessibility Contractを先に確定し、Family単位で横断Fix
- 利点: 実装方式の一貫性が保たれ、Regression Gateを1セット確立すれば全対象アプリに再利用できる。TIER1-F6のSpec Decisionを一度で解消できる
- 欠点: Contract確定まで実装Fixが始められない(ただしFAMILY-A[A11yパネル例外]は既存の確立済みパターンをそのまま横展開するだけなので、Contract確定を待たずに先行可能)

**推奨: Plan M2をベースに、FAMILY-Aのみ例外的に先行(既に3アプリ[okane-app/matching-app/gaze-keyboard]で実証済みのパターンをそのまま複製するだけであり、Spec Decision に依存しないため)。** FAMILY-B・D・Eは`donomana-modal-accessibility-spec-v1_0.md` §21の未決定事項6番・13番の解消(§7参照)を待ってから横断着手する。

---

## 7. Modal Spec Decision(Contract確定が必要な項目)

`donomana-modal-accessibility-spec-v1_0.md` §21の未決定事項のうち、今回のFinding修正に先行して決定が必要な項目:

| # | 項目 | 関連Finding | 現状の分裂状況 |
|---|---|---|---|
| 1 | Focus Trap必須範囲(全モーダル必須か、性質により任意か) | TIER1-F3・TIER2-F2 | 9アプリでFocus Trap欠如、既存Trap実装アプリも2方式(matching-app型/tokei-app型)に分裂 |
| 2 | 背景inert方式の統一要否 | TIER1-F6 | 4系統(A:手動inert切替、B:静的inert属性、C:端点循環型でinertなし、D:抑制自体なし)、18アプリに分裂 |
| 3 | A11yパネルEscape例外の標準化 | TIER1-F2・TIER2-F1 | 3アプリ(okane-app/matching-app/gaze-keyboard)は実装済み、7アプリは未実装。パターン自体は既に確立しているため単純横展開で解消可能 |
| 4 | opener消失時のfocus restoration標準 | TIER1-F5 | register-appでBODY退行を確認、spec自体が正解未確定と明記 |
| 5 | nested overlay(modal内modal)の扱い | 新規検討事項 | 現時点で35アプリ中nested overlayの実例は未確認(本Triageの範囲では検出なし) |
| 6 | Switch Scan scope(modal内候補分離) | FAMILY-B全般 | Tier1で一部実装確認、Tier2のcup_game等では候補分離の不備を確認済み(TIER2フェーズのFIX-P1-B検証時に発覚、既存動作として現状維持) |
| 7 | modal内Gaze target sizing | 新規検討事項 | 個別アプリでの実装は確認しているが横断基準は未策定 |

**#3(A11yパネルEscape例外)は既に3アプリで実証済みパターンが存在するため、Contract確定を待たずに横展開可能。#1・#2・#4は正式決定が前提。**

---

## 8. Focus Restoration方針(FAMILY-D)

TIER1-F5(register-app、pmOpenerElがBODYへ退行)は、`donomana-modal-accessibility-spec-v1_0.md`自体が「正解未確定」と明記している唯一のFinding。今回のTriageでは以下を提案する:

- 背景再描画時の安全なフォールバック先の標準を策定(候補: 直近の意味のあるコンテナ、またはページ本体のH1)
- 決定後、register-appへ適用し、他アプリで同種の再描画パターンがないか横断確認

---

## 9. 背景抑制方式(Modal Background Suppression、FAMILY-E)

| 系統 | 実装方式 | 対象アプリ数 | 対象 |
|---|---|---|---|
| A | 手動inert切替(`<header>`/`<main>`単位) | 3 | matching-app・okane-app・gaze-keyboard(settingsModal) |
| B | 静的`inert`属性+動的トグル(モーダル自身単位) | 5 | tokei-app・janken-app・register-app・time-timer・shiritori2 |
| C | 背景inertなし、端点循環型Focus Trap | 1 | schedule-app |
| D | 背景抑制自体が存在しない | 9 | mogura-tataki・scratch-app・nazorin-print・tyushi・hiragana-learn・katakana-app・bosai-app・cup_game・ongaku-app |

合計18アプリ(app固有モーダル保有アプリの全数)。**系統Dが最多(9アプリ、50%)であり、「背景抑制なし」が現状のデファクトに近い。** Spec Decisionでは、系統A(明示的抑制)を正式標準とするか、系統Dを許容範囲とするかの判断が必要。

---

## 10. Reflow Fix Strategy(FAMILY-G)

| App | Root Cause | 発生条件 | 性質 |
|---|---|---|---|
| drawing-app(TIER2-F5) | canvas固定サイズ、CSS zoom変更で`resize()`が再実行されない | 200%zoomのみ | 実装バグ(意図しない) |
| slideshow-sakusei(TIER3-F2) | `body{min-width:760px}` | 375px/390px通常モバイル幅、および200%zoom | デザイン判断の可能性あり(意図的な最小幅) |

**両者は同じFinding Family(Reflow Overflow)だが、根本原因の性質が異なるため別Phase化を推奨する。**

- drawing-app: `ResizeObserver`の追加という技術的修正のみで完結する見込み。Spec Decision不要。Priority 2(構造Fix)
- slideshow-sakusei: モバイル対応方針(維持/再設計)というSpec Decisionが先行必須。方針確定後の実装規模は決定次第で大きく変動するため、Priority 2だが後続順位

---

## 11. Heading Hierarchy Fix方針(FAMILY-H)

TIER3-F1(yomikaki-app、H1→H3×4→H2)は、視覚デザイン(CSSクラス指定によるスタイリング)は変更せず、タグのみ調整すれば解決できる可能性が高いことを確認済み(`tier3-findings.md`参照)。

比較:
- Plan H1: 該当4箇所を`<h3>`→`<h2>`へ変更
- Plan H2: 695行目の「できること」相当の中間見出しをH1直後に追加し、既存の4件はH3のまま維持

**Plan H1を推奨**(構造変更が最小、既存の695行目以降のH2/H3ネストとの整合性も保たれる)。Priority 3(小規模Fix)として即時対応可能。

---

## 12. Contrast Strategy(FAMILY-F)概要

詳細分類は`contrast-finding-family-matrix.md`を参照。要点:

- 信頼できる判定350件中77件fail(全てratio 2.0以上、P3相当)
- 色ペア頻度分析の結果、`rgb(255,255,255)→rgb(255,107,53)`(白文字/オレンジ背景)が**register-app(Tier1)・time-timer(Tier1)・sst-app(Tier3)の3アプリ・Tier横断**で検出され、共有デザイントークン(アクセントオレンジ)由来の可能性が高い
- 一方`rgb(90,122,153)→rgb(255,255,255)`はschedule-app単独で8件検出されており、同一アプリ内の同一トークンの繰り返し使用(アプリ内で1箇所直せば8件解消)
- yomikaki-app(Tier3)は`rgb(45,125,210)→rgb(255,255,255)`が6件、単一トークン調整で一括改善の見込み

**「77件を77件のFixとして扱わない」という方針を採用**し、まず共有トークン単位でグルーピングしてから実装規模を見積もる。
