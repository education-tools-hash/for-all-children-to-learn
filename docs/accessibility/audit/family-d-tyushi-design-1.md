# WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1 — tyushi settings-panel Focus Restoration適用可否設計

**Phase種別**: 設計/調査専用(Design-only)。Production app codeの変更は一切行っていない。
**baseline**: `origin/main` = `main` = `0e2100a`(drift無し)
**worktree**: `for-all-children-to-learn-wcag-jis-family-d-tyushi-design-1`
**branch**: `investigate/family-d-tyushi-settings-design`
**Source of Truth**: [donomana-modal-accessibility-contract-v1_0.md](../donomana-modal-accessibility-contract-v1_0.md)(v1.1) / [modal-conformance-matrix.md](modal-conformance-matrix.md) / [family-d-cross-app-audit-1.md](family-d-cross-app-audit-1.md)

---

## 1. 対象

`tyushi.html` の `#settings-panel`(id="settings-panel"、role="dialog" aria-label="設定")。

WCAG-JIS-FAMILY-D-CROSS-APP-AUDIT-1で `NEEDS SPECIAL HANDLING` として判定保留になっていた最後のFAMILY-D候補。

---

## 2. 構造再調査(最新Production main基準)

| 項目 | 内容 |
|---|---|
| DOM element | `<div id="settings-panel" role="dialog" aria-label="設定">`(**`aria-modal`は無い**) |
| 位置・見た目 | `position:fixed;bottom:96px;right:22px;width:292px;max-height:calc(100svh - 110px)` — 画面右下に浮かぶ固定幅の**小さなフローティングパネル**。画面全体を覆う要素ではない |
| backdrop | **無し**。背景を暗転・ブロックする層は存在しない |
| open trigger(表面上) | `#settings-btn`(画面右下の⚙ボタン) |
| **open trigger(実際)** | `#settings-btn`は共通A11yパネル自動挿入CSS(453行目 `opacity:0 !important;pointer-events:none !important;`)により**常時非表示・クリック不能・tabindex=-1・aria-hidden=true化**されている。実際の到達経路は`donomanaA11yBtn`→`donomanaSettingsProxy`→(隠された`settings-btn`への委譲click)**のみ**。okane-app/cup_game/matching-appのsettings系と全く同じA11yパネルProxy構造(Pattern D5) |
| open/close方式 | `settBtn.addEventListener('click', ()=>{ settPanel.classList.toggle('open'); })` — **単一ボタンでの開閉トグル**(開く専用・閉じる専用の別ボタンではない) |
| 専用close button | **無し**(パネル内に「とじる」「✕」等の明示的close要素が存在しない) |
| 背景クリックで閉じる | `document.addEventListener('click', e=>{ if (!settPanel.contains(e.target) && e.target!==settBtn) settPanel.classList.remove('open'); })` — パネル外の任意のクリックで自動的に閉じる(標準的なpopover/dropdown dismissパターン) |
| Escape | **実装なし**(ファイル内で唯一のEscapeハンドラは共通A11yパネル自身のもの。settings-panel用のEscape処理は存在しない) |
| Focus Trap | **無し** |
| Initial Focus | 明示的な設定は無し。ただしA11yパネルProxy側の汎用open時fallback機構(`donomanaFirstFocusable`)により、パネル内の最初の`<input>`(`#sl-size`、サイズスライダー)へ実機上着地する(非理想パターン、FAMILY-C領域の別Finding) |
| aria-expanded / aria-controls | settings-panel自体・`#settings-btn`のいずれにも無い(A11yパネル側の`donomanaA11yBtn`/`donomanaA11yPanel`にはある) |

---

## 3. 実ブラウザEvidence(app code変更なし、実装確認のみ)

全てLEVEL-A(実機`document.activeElement`確認済み)。

1. **Initial Focus**: `donomanaA11yBtn`→`donomanaSettingsProxy`経由でopen → `#sl-size`(サイズスライダー)にfocus。
2. **Tab動線**: `#sl-size`から順にTabしていくと、settings-panel内の全コントロール(色スウォッチ・絵文字ボタン・アップロード・スライダー・スイッチ)を辿った**後、パネルの外(背景の`#lock-btn`)へ自然にTab移動する**。Focus Trapは存在せず、**意図的にpanel内へfocusを閉じ込めない設計**であることを確認(29回目のTabで`lock-btn`へ到達)。
3. **背景の実操作可能性**: パネルが開いている状態で、背景の`#lock-btn`の座標に対して`document.elementFromPoint()`を実行した結果、`lock-btn`自身がヒットする(パネルや透明なoverlayに覆われていない)。**マウス/タッチ操作でも背景コントロールが物理的にクリック可能**であることを確認。
4. **Escapeキー**: 押してもsettings-panelの`open`クラスは変化しない(閉じない)。既存のまま、機能なし。
5. **トグル再クリック(A11yパネルProxy経由で`settings-btn`へ2回目の委譲click)によるclose**: パネルは正しく閉じるが、**`document.activeElement`が非表示・aria-hidden化された`#settings-btn`自身になる**(視覚的なfocusリングが画面上どこにも存在しない状態)。A11yパネルProxy共通機構の「open時のfallback救済(newly-visible要素へのfocus)」は、close方向のトグルでは新規可視要素が発生しないため機能しない。
6. **背景クリックによるclose**: パネル外の座標(例: 50,50)をクリックすると正しく閉じ、`document.activeElement`は実際にクリックした座標にあった要素(無ければBODY)になる。**ユーザー自身が直接指示した位置に自然にfocusが追随する**、一般的なpopover/dropdownの「outside click to dismiss」として妥当な挙動。
7. **再操作性**: close後も同じA11yパネルProxy経路から再度open可能。

---

## 4. Modal Contract適用判定

### Modal Contract applicable: **NO**

根拠:
- `aria-modal`が設定されていない。
- backdrop(背景を覆う層)が存在しない。
- **Focus Trapが意図的に存在せず、Tabで背景コントロールへ自然に抜けられる**(§3-2で実機確認)。
- **背景がpointer操作・キーボード操作とも常に生きている**(§3-3で実機確認)。
- 開閉が単一トグルボタン(開く/閉じるが同じ操作)であり、モーダルの「開いたら専用の閉じる手段が必要」という設計ではない。
- tyushiは重度運動障がい・意思伝達困難児童向けのTobii/dwell/switch中心アプリであり、settings-panelには「ドウェル時間」「移動速度」「スキャンモード」「アニメ速度」等、**メインの操作対象(画面上を動く1つの巨大ボタン)を見ながら並行して調整する必要がある設定**が含まれる。これをmodal化して背景を完全にブロックすると、**まさにこのアプリの主要ユーザー層にとって調整体験を悪化させる**(§11の懸念が実際に該当する)。

これらは全て、**意図的な非modal disclosure/popoverパターンとして一貫しており、既存の共通A11yパネル(`donomanaA11yPanel`)自体と同一の設計思想**である(A11yパネル自身もaria-modal無し・backdrop無し・Focus Trap無し・背景操作可能)。

**結論**: settings-panelは「Modal Dialog」ではなく「**Non-modal Disclosure Panel(常設設定サイドパネル)**」に分類する。Modal Accessibility Contract v1.1が要求するFocus Trap・Reverse Tab境界・Focus Restoration(opener型)は、この分類には**そのままでは適用されない**。

---

## 5. FAMILY-D適用判定

### 主判定: **B. FAMILY-D NOT APPLICABLE**(伝統的なModal Focus Restorationの意味において)

非modal disclosure panelとして、以下は**正常な設計であり欠陥ではない**:
- Focus Trap不在
- Tabでの背景への抜け
- 背景クリックでのclose時、クリック位置に応じたfocus追随(BODYになることも含め、ユーザー自身の操作結果として妥当)

### ただし派生的な発見: **Pattern D5型の別Finding(小規模、FAMILY-D中核ではない)**

§3-5で確認した「A11yパネルProxyを介した2回目のトグルclose」経路でのみ、focusが非表示・aria-hidden化された`#settings-btn`自身に残留する現象を確認した。これは:

- settings-panelが**modalだから**起きている問題ではない。
- 既に確定済みの **Pattern D5(A11yパネルProxy構造)** — cup_game/okane-app/matching-appのsettings系で発見・修正済みの問題 — と**全く同一のRoot Cause**(Proxyの委譲click対象自身が恒常的に非表示化されているため、Proxy経由の操作でその対象へfocusが渡ると必ず「見えないfocus」が生じる)。
- 発生条件が特殊(A11yパネルを再度開いてProxyを再クリックするという、実際にはあまり取られないであろう間接的な閉じ方)であり、**主要な閉じ方(背景クリック)には該当しない**。
- Severity: P3相当(発生条件が限定的、他のPattern D5ケースと異なり「唯一の閉じ方」ではなく「唯一ではない一部の閉じ方」でのみ発生するため)。

この派生Findingは、**tyushi固有のFAMILY-D Fixとしてではなく、「Pattern D5を持つ全アプリに共通する、Proxy自身のclose方向fallback未対応」という、より広いスコープの改善候補**として記録する(下記§10)。今回のtyushi判定自体には影響しない。

---

## 6. WCAG/JIS観点(実装都合でなく操作継続性で判断)

| 観点 | 結果 |
|---|---|
| keyboard userがfocus locationを認識できるか | Tabで辿れる限り認識可能。トグル経由close時のみ非表示要素に留まり認識不能瞬間が生じる(§5派生Finding) |
| operationを継続できるか | 背景クリックでのcloseでは問題なく継続可能。トグルcloseでも実害としては次のTabでdocumentの通常順に戻るため致命的ではない |
| unexpected context lossがあるか | 背景クリックcloseでは無い(ユーザーの意図した位置)。トグルcloseでは軽微なcontext loss(視覚的focus indicatorの喪失)がある |

「モーダルだから戻すべき」という実装都合ではなく、**実際の操作継続性で見ても、非modal設計自体は問題を生んでいない**。派生Findingは軽微。

---

## 7. Gaze / Switch / Touch評価

- **Gaze**: settings-panel自体がdwell時間・移動速度等のGaze/Tobii関連設定を含む。非modalであることにより、**設定変更をmain UIの動きを見ながら並行して行える**という実利がある。modal化した場合、設定変更のたびに背景が見えなくなり、dwell時間などの調整→即座に動作確認、というワークフローが破壊される。**非modal維持が明確にGazeユーザーへ有利**。
- **Switch**: 独自のスキャンモード切替(`#sw-scan`)をsettings-panel内に持つ。SCAN_SELECTOR/GAZE_SELECTOR等の共通グローバル定数は本ファイルには存在せず、tyushi独自実装。settings-panel自体のSwitch特有のscan対象化はコード上確認できず、NOT APPLICABLEと判断。
- **Touch**: `#settings-btn`はTobii proxy構造により通常操作からは到達不能(A11yパネルProxy経由のみ)。パネル内の操作(スライダー・スウォッチ・絵文字ボタン)はタッチ操作でも問題なく機能する通常のUIコントロール。

---

## 8. Modal化した場合の副作用 / 非modal維持の副作用

| 選択肢 | 副作用 |
|---|---|
| **Modal化する**(aria-modal追加、Focus Trap実装、背景操作禁止) | Gaze/dwell設定の即時確認ワークフローを破壊。tyushiの主要ユーザー(重度運動障がい児童)にとって、設定変更→効果確認のループが遅くなる。背景の巨大ターゲットが見えなくなることで訓練文脈が失われる可能性。**明確にマイナス**。 |
| **非modalのまま維持**(現状) | 背景クリックでのclose時、稀にBODYへfocusが移る(ただしユーザー自身の意図した操作の自然な結果)。トグル再close時のみ非表示要素へのfocus残留という軽微な別Finding(§5)が残る。 |

**推奨: 非modalのまま維持する。** Modal化はこのアプリの主要ユーザー層にとって明確な悪化である。

---

## 9. 最終分類

### Modal Contract applicable: **NO**
### FAMILY-D applicable: **NOT APPLICABLE**(主判定)
### UI分類: **Non-modal Disclosure Panel(常設設定サイドパネル、popover型)**

理由の要約: `aria-modal`無し・backdrop無し・Focus Trap意図的不在・背景操作常時可能、という一貫した非modal設計であり、これはGaze/dwell中心のアプリ特性上むしろ適切な設計判断である。既存のCross-App Audit時点での「NEEDS SPECIAL HANDLING」は、本調査により正式に**「FAMILY-D NOT APPLICABLE」**へ格下げ(判定確定)する。

ただし、調査の過程で以下の**別Finding(FAMILY-D中核ではない)**を新たに発見・記録する:

1. **Pattern D5派生**: A11yパネルProxyを再度介した2回目のトグルclose経路でのみ、非表示要素(`#settings-btn`)にfocusが残留する。Severity P3。tyushi固有ではなく、Proxy機構自体の close方向fallback未対応という横断的な改善候補。
2. **Initial Focus非理想**(FAMILY-C領域): open時にA11yパネルProxyの汎用fallbackにより`#sl-size`(意味的に先頭ではないスライダー)へ着地する。理想はタイトル相当の要素または最初の意味あるコントロールへの意図的な初期フォーカス。
3. **Escape未実装**: settings-panel自体にEscapeキーでの閉じる機能が無い(既知、Contract外のUX機能追加相当)。

これら3件はいずれも**今回Fixしない**。次のFinding候補として記録するに留める。

---

## 10. 推奨次アクション

1. 本Design結果をUser Reviewへ提示し、**FAMILY-D NOT APPLICABLE**の判定に合意を得る。
2. 合意が得られれば、`modal-conformance-matrix.md`のtyushi行のFocus Restoration欄を「— (未検証)」から「NOT APPLICABLE(non-modal disclosure panel、本designで確定)」へ更新するdocs-only Releaseを実施可能(次Phase候補)。
3. §5-1で発見したPattern D5派生Finding(Proxy再トグルclose時の非表示要素focus残留)は、tyushi単体のFixではなく、**A11yパネルProxy共通機構(全35アプリで共有)自体の改善**として、別途横断的なPhase(例: `WCAG-JIS-A11Y-PROXY-CLOSE-FALLBACK-1`)で扱うことを推奨する。優先度は低(P3、限定的な発生条件)。
4. Initial Focus非理想・Escape未実装は、それぞれFAMILY-C・別Family領域の既存Finding backlogへ追記する程度に留める(今回は追記もしない、次回該当Family着手時に反映)。

---

## 11. FAMILY-D全体の状態

Cross-App Auditで確定した5件のCONFIRMED FAIL(cup_game settingsOverlay・schedule-app new-modal/img-modal・scratch-app txtEdOv/cov)は全てProduction反映済み。tyushi settings-panelは本Designにより**NOT APPLICABLE**と判定されたため、**FAMILY-Dとして正式にFixすべき残存対象は0件**となる。

ただし:
- NVDA / VoiceOver / Blue2 / Tobii実機によるManual Validationは全てPendingのまま。
- §9で記録した3件の別Finding(Pattern D5派生・Initial Focus非理想・Escape未実装)はFAMILY-D外の独立Backlogとして残る。

これをもって「WCAG/JIS全体の対応が完了した」とは扱わない。あくまで**FAMILY-D(Focus Restoration)というFinding Familyの技術的remediationが完了候補になった**という意味に限定する。

---

## 12. 正式Status

**`WCAG-JIS-FAMILY-D-TYUSHI-DESIGN-1 = NOT APPLICABLE / READY FOR FAMILY-D CLOSURE`**

app codeの変更は本Phaseで一切行っていない。
