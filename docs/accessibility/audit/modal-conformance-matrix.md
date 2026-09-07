# Modal Conformance Matrix(18アプリ × Contract項目)

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)確定に伴い、app固有モーダルを持つ18アプリの現状をContract項目ごとにPASS/PARTIAL/FAIL/N/Aで評価する。**本ファイルはFix対象の正式確定であり、実装は行わない。**

> **[v1.1再評価]** WCAG-JIS-MODAL-SPEC-DECISION-1-REVISIONで「Reverse Tab Boundary(initial focus anchor起点)」列を新設した。これは**過去の評価が誤りだったのではなく、Contract v1.1で新たに追加されたGateに基づく再評価**である(v1.0確定時点ではこの失敗モードが未発見だった)。matching-app/okane-app等の従来「Contract完全準拠」としていた評価は、この新Gateの追加によりPARTIALへ訂正する。

凡例: ✅PASS(Contract準拠) / 🟡PARTIAL(一部準拠) / ❌FAIL(未準拠) / — N/A(該当機能なし、または未検証)

| App | Dialog Semantics | Accessible Name | Initial Focus | Focus Trap(Forward) | **Reverse Tab境界(v1.1新設)** | A11yパネル例外 | Escape | Focus Restoration | 背景抑制 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| register-app | ✅ | ✅ | 🟡(Pattern3、最初のcontrol) | ✅(端点循環) | ✅(Pattern3のためinitial focus=firstと一致、構造的に非該当) | ❌(TIER1-F2) | ✅ | ❌(TIER1-F5、pmOpenerEl退行) | 🟡(系統B、モーダル自身のみ) | 8モーダル共通ヘルパー、Fix影響範囲大 |
| matching-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌**Sub-pattern β、実機再現済み(FAMILY-J)** | ✅ **参照実装** | ✅ | ✅ | ✅(系統A) **参照実装** | A11yパネル例外・背景抑制は引き続き参照実装水準 |
| time-timer | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌**Sub-pattern β、コード同型で推定(未実機確認)** | ❌(TIER1-F2) | ✅ | — (未検証) | 🟡(系統B) | |
| mogura-tataki | 🟡(aria-label直接、labelledby未使用) | 🟡 | ❌(なし) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | — (未検証) | — (未検証) | ❌(系統D) | screen/panelベースの独自アーキテクチャ、深掘り要 |
| okane-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌**Sub-pattern β、実機再現済み(FAMILY-J)** | ✅ **参照実装** | ✅ | ✅(HARDEN-1で対応済み) | ✅(系統A) **参照実装** | A11yパネル例外・背景抑制は引き続き参照実装水準 |
| scratch-app | ✅ | — (未検証) | 🟡(Pattern4、close btn) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | — (未検証) | — (未検証) | ❌(系統D) | |
| nazorin-print | ✅ | ✅ | ❌(なし) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | ✅(3モーダル共通実装) | 🟡(libModalのみ復帰確認) | ❌(系統D) | 3モーダル(help/batch/lib)構成 |
| schedule-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌**Sub-pattern β、実機再現済み(FAMILY-J)。独自の防御分岐[`modal.contains(active)`]を持つが本失敗モードには無効と実証** | ✅ **参照実装** | ✅ | — (未検証) | 🟡(系統C、inertなし) | 背景inertなしでも端点循環が機能する例 |
| janken-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌**Sub-pattern β、コード同型で推定(未実機確認)** | ❌(TIER1-F2) | — (未検証) | — (未検証) | 🟡(系統B) | |
| tokei-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ❌**Sub-pattern β、コード同型で推定(未実機確認)** | ❌(TIER1-F2、両モーダル) | — (未検証) | — (未検証) | 🟡(系統B) | |
| tyushi | ✅ | ✅(aria-label、TIER1-F1対応時に確認済み) | ❌(なし) | ❌(TIER1-F3) | — N/A(Trap自体なし) | — | ✅ | — (未検証) | ❌(系統D) | H1修正済み(AUDIT-35-H1-IMPL-2)、モーダル自体は未着手 |
| gaze-keyboard(settingsModal) | ✅ | ✅ | ✅(Pattern1、PILOT-F1で修正済み) | ✅(端点循環) | ❌**Sub-pattern β、実機再現済み(FAMILY-J)** | ✅(HARDEN-3で修正済み) | ✅ | ✅ | ✅(系統A) | Fix実績最多。Reverse Tab境界のみ新規に未準拠と判明 |
| gaze-keyboard(profileModal/hrModal) | ✅ | ✅(HARDEN-3で修正済み) | ✅(NEW-KNOWN-1で修正済み) | ❌(TIER1-F3、NEW-KNOWN-3) | — N/A(Trap自体なし) | — | — (未検証) | — (未検証) | ❌(系統D) | Initial Focusのみ先行修正済み、Trap未実装 |
| hiragana-learn | ✅ | ✅ | ✅(Pattern1) | ❌(TIER2-F2) | — N/A(Trap自体なし) | — | ✅ | ✅(`traceSampleViewerPrevFocus`) | ❌(系統D) | katakana-appと共通実装 |
| katakana-app | ✅ | ✅ | ✅(Pattern1) | ❌(TIER2-F2) | — N/A(Trap自体なし) | — | ✅ | ✅ | ❌(系統D) | hiragana-learnと共通実装 |
| shiritori2 | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Sub-pattern α(title=first直接代入)、構造的に非該当を確認** | ❌(TIER2-F1) | ✅ | ✅ | 🟡(系統B、自身のみ) | |
| bosai-app | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Sub-pattern α、構造的に非該当を確認** | ❌(TIER2-F1) | ✅ | ✅ | ❌(系統D) | |
| cup_game(helpModal) | ✅ | ✅ | ✅(**Fix済み、commit a53f307**) | ❌(TIER2-F2) | — N/A(Trap自体なし) | — | ✅ | ✅ | ❌(系統D) | Initial FocusのみFAMILY-C先行修正済み |
| ongaku-app(modal-help) | ✅ | ✅ | ✅(Pattern1) | ✅(端点循環) | ✅**Sub-pattern α、構造的に非該当を確認** | ❌(TIER2-F1) | ✅ | ✅ | ❌(系統D) | |
| ongaku-app(modal-pin/export/share) | ✅**Fix済み(commit bdc1b4b)** | ✅**Fix済み** | ✅**Fix済み** | ✅**Fix済み(端点循環、動的focusables)** | ✅**Fix済み(commit 9eebca4、initial focus anchorを境界に含める形で実装。FAMILY-J発見の契機)** | ✅**Fix済み** | ✅**Fix済み** | ✅**Fix済み** | ✅**Fix済み(Plan B1 inert、main内側/外側の非対称構造に対応した2方式実装)** | **Production未反映。Reverse Tab境界を含むContract全項目PASSを達成した最初の実装** |

---

## 集計

| Contract項目 | PASS | PARTIAL | FAIL | N/A・未検証 |
|---|---|---|---|---|
| Dialog Semantics | 17(ongaku-app pin/export/share Fix済み含む) | 1(mogura-tataki) | 0 | 0 |
| Accessible Name | 17 | 0 | 0 | 1(scratch-app未検証) |
| Initial Focus | 12(ongaku-app pin/export/share Fix済み含む) | 2(register-app・scratch-app) | 4(mogura-tataki・nazorin-print・tyushi・gaze-keyboard[profileModal/hrModalのTrap側は別軸]) | 0 |
| Focus Trap(Forward) | 10(ongaku-app pin/export/share Fix済み含む) | 0 | 8(register-appを除く旧FT-1/FT-2対象) | 0 |
| **Reverse Tab境界(v1.1新設)** | **4(register-app・shiritori2・bosai-app・ongaku-app[modal-help]、いずれも構造的に非該当)+ongaku-app(pin/export/share、Fix済み)=5** | 0 | **7(matching-app・okane-app・schedule-app・gaze-keyboard[settingsModal]は実機再現済み、time-timer・tokei-app・janken-appはコード同型のため推定FAIL、実機確認推奨)** | 6(Trap自体がないため非該当のアプリ) |
| A11yパネル例外 | 4 | 0 | 11 | 3(未検証) |
| Escape | 13(ongaku-app pin/export/share Fix済み含む) | 0 | 0 | 5(未検証) |
| Focus Restoration | 11(ongaku-app pin/export/share Fix済み含む) | 1(nazorin-print) | 1(register-app、TIER1-F5) | 5(未検証) |
| 背景抑制(inert方式準拠) | 4(ongaku-app pin/export/share Fix済み含む) | 5(系統B) | 9(系統C+D) | 0 |

**Contract全項目(Reverse Tab境界含む)でPASSしているのは、Production未反映のongaku-app(modal-pin/export/share、Fix済み)のみ。** matching-app・okane-appは従来「完全準拠」としていたが、Reverse Tab境界の新設によりPARTIALへ再評価した(v1.0時点の評価が誤りだったのではなく、v1.1で新たなGateが追加されたことによる)。18アプリ中17アプリが何らかのContract項目でFAIL/PARTIALを持つ。

**「未検証」の項目について**: Tier1監査時点ではEscape/Focus Restoration/A11yパネル例外を全モーダルで網羅的に確認しておらず、一部は「疑わしい場合のみ直接コード確認」という方式だったため、本Matrixの「未検証」欄はFAIL/PARTIALの可能性を排除するものではない。**FAMILY別Fix着手時に該当アプリを再確認することを推奨する。**

---

## Fix対象数の正式確定(Contract基準)

| Family | Contract項目 | 対象アプリ数(FAIL+PARTIAL) |
|---|---|---|
| FAMILY-A | A11yパネル例外 | 11 |
| FAMILY-B | Focus Trap(Forward) | 8(ongaku-app pin/export/share分はFix済みのため除外) |
| FAMILY-C | Initial Focus(非推奨パターン含む) | 6(register-app・scratch-app[パターン移行]、mogura-tataki・nazorin-print・tyushi。ongaku-app pin/export/shareはFix済みのため除外) |
| FAMILY-D | Focus Restoration | 2(register-app・nazorin-print) |
| FAMILY-E | 背景抑制 | 13(系統B 5 + 系統C 1 + 系統D 7、ongaku-app pin/export/shareはFix済みのため除外) |
| **FAMILY-J(新設)** | **Reverse Tab境界** | **7(matching-app・okane-app・schedule-app・gaze-keyboard[settingsModal]・time-timer・tokei-app・janken-app)** |

**Global Fix Triageで確認した件数(FAMILY-A:7・FAMILY-B:9)と、本Matrixで確認した件数(FAMILY-A:11・FAMILY-B:8)に差異がある。** これはGlobal Fix Triage時点ではFinding化されていた「確定Finding」のみをカウントしていたのに対し、本Matrixは**Contract確定に伴い新たに発覚したregister-app(Initial Focus Pattern3)・scratch-app(Pattern4)・mogura-tataki(aria-label直接指定)等の追加項目を含む**ため。**この差異は正式な追加Finding候補として次項で扱う。**

---

## Contract確定に伴う新規発覚事項(追加Finding候補)

| # | App | 項目 | 内容 | 推奨対応 |
|---|---|---|---|---|
| 1 | register-app | Initial Focus | 全8モーダルが「最初のfocusable要素」へfocus(Pattern3、非推奨) | FAMILY-C/A統合Fix時にTitle focusへ変更を推奨 |
| 2 | scratch-app | Initial Focus | helpModalがclose buttonへfocus(Pattern4、非推奨) | 同上 |
| 3 | mogura-tataki | Accessible Name | `aria-label`直接指定(可視タイトルがあるのに`aria-labelledby`未使用) | FAMILY-B Fix時に`aria-labelledby`へ統一を推奨 |
| 4 | nazorin-print | Focus Restoration | libModalのみ復帰実装、help/batchModalは未確認 | FAMILY-D調査対象に追加 |
| 5(v1.1追加) | matching-app・okane-app・schedule-app・gaze-keyboard(settingsModal) | Reverse Tab境界(FAMILY-J) | 実機再現済み。initial focus直後の最初のShift+Tabでmodal外へfocusが漏れる | FAMILY-J Fix Phaseで境界判定にinitial focus anchorを追加(ongaku-appのFix実装[commit 9eebca4]をそのまま横展開可能) |
| 6(v1.1追加) | time-timer・tokei-app・janken-app | Reverse Tab境界(FAMILY-J、推定) | コードが上記4アプリと同型(`active===first`のみで境界判定)のため同一欠陥を持つと推定。実機未確認 | 実機確認後、#5と同一Fixを適用 |

**これらは今回のContract確定作業で新たに判明した事実であり、既存のTIER1/TIER2 Finding Registerには含まれていなかった。次のGlobal Fix実装Phaseで正式Finding化するか、既存Family内の追加対象として扱うかをUser判断とする(本Phaseでは判断・修正しない)。**
