# Accessibility Audit Pilot-1 Summary

- Phase: ACCESSIBILITY-AUDIT-PILOT-1
- 目的: `donomana-wcag-jis-audit-plan-v1_0.md`で定義した監査方法を5代表アプリで実証し、本監査(全35アプリ)への横展開可否を評価する。
- 本Pilotでは**Findingを発見してもコードを修正しない**(監査とFixを分離)。

---

## 1. Pilot対象5アプリの特徴表(apps-data.json / app-inventory.json / 実コードで確認済み)

| アプリ | Touch | Keyboard | Switch | Gaze | Record | PWA | modal(アプリ固有) | dynamic content | fullscreen | A11y panel | drag/swipe | learning feedback |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| matching-app | - | - | ✅ | - | ✅ | - | 6件 | ✅(aria-live) | ✅ | ✅ | - | ✅(勝敗発表、テキスト+音声) |
| okane-app | ✅ | - | ✅ | ✅ | ✅ | - | 4件 | ✅(aria-live) | ✅ | ✅ | - | ✅ |
| gaze-keyboard | ✅ | ✅ | - | ✅ | - | - | 1件 | ✅(aria-live) | ✅ | ✅ | - | ✅ |
| tokei-app | ✅ | - | ✅ | - | ✅ | ✅ | 2件 | ✅(aria-live) | ✅ | ✅ | - | ✅ |
| timetable-app | ✅ | - | - | - | - | - | 0件 | ✅(aria-live) | ✅ | ✅ | - | ✅ |

(全アプリでdrag/swipe固有の代替操作は検出されず=該当機能自体が存在しない。fullscreen・A11y panelは全アプリ共通chrome機能のためいずれも「あり」)

---

## 2. Gate結果サマリ

| Gate | 結果 |
|---|---|
| 自動DOM/Structure(重複ID・ARIA参照切れ・aria-hidden+focusable競合・tabindex異常) | 5アプリ全件で異常なし |
| Browser(console/page error) | 5アプリ全件0件 |
| Modal(9モーダル、既知トリガーで到達可能な範囲) | 8/9 PASS、1件Finding(PILOT-F1) |
| Responsive/Zoom(5viewport×200%zoom) | 5アプリ全件overflowなし |
| A11yパネル | 5アプリ全件で開閉正常 |
| Keyboard(Tab/Escape/フォーカストラップ) | モーダルを持つアプリで自動確認、trap正常(gaze-keyboardの初期フォーカスを除く) |
| Contrast | **未実施**(ツール未セットアップ、Manual Review送り) |
| Screen Reader(NVDA/VoiceOver) | **未実施**(人間実施者向けチェックリストのみ作成、`accessibility-audit-pilot-1-manual-review.md`) |
| Switch実機 | **未実施**(scanロジック自体は既存tools実績で確認済みという前提を維持、実機体感は未実施) |
| Gaze実機 | **未実施** |
| Touch実機 | **未実施**(target size等の寸法は自動測定範囲外、既存AUDIT-35-FIX-1F基準を参照するに留めた) |

詳細は`accessibility-audit-pilot-1-browser-results.md`(自動検証の生データ)を参照。

---

## 3. Finding概要

- P0: 0 / P1: **1**(PILOT-F1: gaze-keyboard設定モーダルの初期フォーカス欠如) / P2: 0 / P3: 0
- Spec Decision Required: 1件(PILOT-F2: モーダル背景抑制の実装方式がアプリ間で不統一、modal-accessibility-spec §21-13の実例)
- Needs Manual Review: 8件(SR全項目・実機Switch/Gaze/Touch・Contrast・matching-app一部モーダル・Learning Feedback体感)
- **AUDIT PILOT BLOCKING FINDING(P0): なし**

詳細は`accessibility-audit-pilot-1-findings.md`を参照。

---

## 4. Methodology Review(§21相当)

### A. 実際には不要だった項目
- なし(定義した項目はいずれも何らかの形で使用した。5アプリという少数サンプルでも全項目に意味があった)

### B. 足りなかった項目
- **Contrast自動計算**: PREP計画では「自動測定+Manual判断」としていたが、実際には自動測定ツール自体を用意していなかった。本監査までに`axe-core`等の導入検討が必要
- **matching-appのような「実プレイ進行が必要なモーダル」への到達手段**: vs-result-ov/clear-ovは自動テストで直接到達できず、Pilotでは除外にとどめた。本監査ではゲーム状態を直接注入するテストヘルパー(例: `vsPlayers`配列を直接操作してshowVsResult()を呼ぶ等)の追加を検討する価値がある

### C. 自動化可能と判明した項目
- **重複ID・ARIA参照切れ・tabindex異常**: 想定通り完全自動化できた
- **モーダルの初期フォーカス確認**: `document.activeElement`とモーダル要素の`contains()`判定で完全自動化でき、PILOT-F1を実際に検出できた。**PREPの「Automated + Manual」区分だったが、実際にはFully Automatedへ格上げ可能**
- **aria-labelledby/aria-label有無の確認**: 完全自動化できた

### D. Manualでないと判断できなかった項目
- 想定通り、実SR・実Switch・実Gaze・実Touch・Contrastの最終判断はいずれもManual Onlyのままだった。ここはPREP設計通り

### E. Severityが曖昧だったFinding
- PILOT-F1(初期フォーカス欠如)のSeverityをP1とP2の間で検討した。「Tabキーで最終的にモーダルへ到達できる可能性がある(背景がinert化されているため)」ことを理由にP2寄りとも考えられたが、「フォーカス移動が起きないこと自体がSRユーザーへの通知欠如に直結する」ことを優先しP1とした。**本監査でも同種の判断が発生しうるため、「初期フォーカス欠如」の標準Severityをplan文書側で明文化することを推奨**(v1.1候補)

### F. Finding Family化が有効だったか
- 有効だった。PILOT-F1は単独findingだが、命名を「初期フォーカス欠如」というFamily名で管理したことで、本監査で同種の欠陥が他アプリに見つかった場合に同一Familyへ集約できる設計になっている

### G. 35アプリ横展開時の時間コスト再見積り

Pilot 5アプリ(自動検証部分)の実施時間は概算で以下の通り(人間実施者によるSR/実機検証は含まない):

- Inventory特徴表作成: 5アプリで約15分相当の調査(既存app-inventory.jsonがあったため短縮)
- 自動DOM/Structure検証: script実行のみで数秒×5アプリ
- Browser Gate(console/modal/responsive/A11yパネル): script開発+実行で実質1回のみ(5アプリ分をまとめて処理)、開発コストは初回のみで2回目以降は再利用可能
- Methodology修正(heading検出ロジックの発見・修正): 想定外の追加調査が発生(この分だけ本監査側では初回に織り込み済みで短縮される)

**再見積り**: 自動検証部分は「script開発を1回行えば35アプリへの適用はほぼ線形コストで増加するのみ」であることが確認できた。既存の`tools/accessibility-audit/pilot/browser-check.py`を35アプリ対応に拡張すれば、自動部分は数時間規模で全35アプリに適用可能。ボトルネックは自動化できないSR/実機検証(人間の稼働時間に依存)であり、当初見積り(Tier1横展開1〜2週間、Tier2/3横断1〜2週間)は概ね妥当だが、**人間実施者のSR/実機検証スケジュールが実質的なクリティカルパス**であることが明確になった。

### H. 監査中に仕様未確定点が出た場合の扱い
- PILOT-F2で実際に発生した。「Findingではなく別トラックのSpec Decision Requiredとして記録する」という運用は明確に機能した

---

## 5. PREP plan修正要否

**v1.1候補として以下を提案**(User Approvalなしに本文書自体は今回改訂しない):

1. モーダル初期フォーカス確認を「Automated + Manual」から「Fully Automated」へ再分類
2. Contrast Gateの自動測定ツール(候補: axe-core)を監査tool側の準備物として明記
3. 「初期フォーカス欠如」の標準Severity(P1)をSeverity定義に明文化
4. heading構造の自動判定は「offsetParent!==null かつ aria-hidden/inert祖先なし」を正式な判定条件として明記(本Pilotで発見した手法上の教訓)
5. ゲーム進行が必要なモーダルへの到達手段(テストヘルパー注入)を検討事項として追加

---

## 6. Pilot Exit Gate判定

| # | 条件 | 状態 |
|---|---|---|
| 1 | 5アプリの自動監査完了 | ✅ |
| 2 | Browser Gate完了 | ✅ |
| 3 | Keyboard Gate完了 | ✅(モーダルを持つ範囲、trap確認含む) |
| 4 | Modal Gate完了 | ✅(9/9モーダルのうち到達可能な8件を検証、vs-result-ov/clear-ovはNeeds Manual Review) |
| 5 | Responsive/Reflow Gate完了 | ✅ |
| 6 | Contrast Gate実行 | ❌ **未実行**(ツール未整備、v1.1候補#2として引き継ぎ) |
| 7 | Manual Review項目が明確 | ✅(`accessibility-audit-pilot-1-manual-review.md`で5アプリ個別化済み) |
| 8 | NVDA Gate方法が実証可能 | ✅(方法は明確化、実施自体は人間実施者待ち) |
| 9 | VoiceOver Gate方法が実証可能 | ✅(同上) |
| 10 | Switch Manual Gate方法が明確 | ✅ |
| 11 | Gaze Manual Gate方法が明確 | ✅ |
| 12 | Finding Registerが実運用可能 | ✅(PILOT-F1/F2で実証) |
| 13 | Severity分類が実運用可能 | ✅(ただし#5参照、明文化の余地あり) |
| 14 | 本監査への横展開方式が確定 | ✅(§4-G参照) |
| 15 | 本監査所要時間を再見積もり可能 | ✅(§4-G参照) |

15項目中14項目クリア、1項目(#6 Contrast Gate)が未実行。ただしこれは「Gateの設計自体が使えないか」ではなく「ツール未整備」という運用上のギャップであり、方法論としては明確(§Methodology Review B参照)。

**ACCESSIBILITY-AUDIT-PILOT-1 = PILOT COMPLETE / METHOD REVISION REQUIRED BEFORE FULL AUDIT**

Pilotの失敗を意味するものではない。方法論の大部分(14/15項目)は5アプリで実証済みであり、Contrast Gateのみ整備が未了のため、Full Audit着手前に**ACCESSIBILITY-AUDIT-PREP-2**(Contrast tool整備 + Audit plan v1.1改訂)を挟むことを正式に要求する判定である。

---

## 7. 推定本監査所要時間(再見積り後)

- 自動検証部分(全35アプリ): 数時間〜1日規模(script拡張+実行、Pilotで検証済みの再利用可能な基盤があるため当初見積りより短縮)
- Contrast Gate整備: 半日〜1日(ツール導入・spot-check基準確立)
- Manual Review(SR/Switch/Gaze/Touch、人間実施者依存): Tier1(12アプリ)で1〜2週間、Tier2/3(23アプリ)で1〜2週間 — **当初見積りを維持**(クリティカルパスは人間の稼働時間)
- 総計: 数週間規模、ただし自動部分の比重が想定より軽いことが判明したため、実質的なボトルネックはScreen Reader Gate(§8参照、人間実施者のスケジュール)

---

## 8. 作成ファイル

- `docs/accessibility/pilot/accessibility-audit-pilot-1-summary.md`(本ファイル)
- `docs/accessibility/pilot/accessibility-audit-pilot-1-findings.md`
- `docs/accessibility/pilot/accessibility-audit-pilot-1-manual-review.md`
- `docs/accessibility/pilot/accessibility-audit-pilot-1-browser-results.md`
- `tools/accessibility-audit/pilot/browser-check.py`(再現用script、port番号は`<port>`プレースホルダーに置換済み)
- `tools/accessibility-audit/pilot/browser-results.json`(自動検証生データ)
- `tools/accessibility-audit/pilot/static-check.js` / `static-results.json`(DOM/Structure自動検証)

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PILOT-1。5代表アプリでの方法論実証Pilot完了。Exit Gate判定 = PILOT COMPLETE / METHOD REVISION REQUIRED BEFORE FULL AUDIT(Contrast Gate未整備のためPREP-2を挟む)。 |
| v1.0(訂正) | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-PILOT-RELEASE-1。Exit Gate表記を実態(Contrast Gate未実行)に合わせて修正。Pilot自体の結論・Finding・Methodology Reviewの内容に変更はない。 |
