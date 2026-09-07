# WCAG-JIS-AUDIT-1-TIER1: Finding Register

- 分類基準: `donomana-wcag-jis-audit-plan-v1_0.md` v1.1 §17(Severity)・§18(4軸管理: app / finding family / WCAG観点 / input mode)
- 本Auditでは**発見してもコードを修正しない**。

---

## TIER1-F1: tyushiのH1が既定状態で到達不能

| 項目 | 内容 |
|---|---|
| Finding Family | Heading Runtime Visibility |
| App | tyushi |
| Severity | **P2 Medium** |
| WCAG観点 | Perceivable 1.3.1(情報及び関係性)、2.4.6(見出し及びラベル)、Robust |
| Input Mode | Screen Reader全般 |
| Automated/Manual | Automated(Playwright、runtime可視性判定) |
| Reproduction | tyushi.htmlをページ読込直後の状態でheading navigationを試行 |
| Expected | ページ本体に到達可能な見出しが1件以上存在する |
| Actual | 唯一の`<h1>`は`#help-overlay`(既定非表示のヘルプモーダル)内にあり、モーダルを開かない限り到達不能。既定状態でのheading数=0 |
| Evidence | `tools/accessibility-audit/tier1/browser-audit-results.json` → tyushi.headings_default_state=[]。コード確認: tyushi.html:698-700 |
| Known/New | **New**(AUDIT-35の静的h1監査では「h1=1」で合格扱いだったが、実行時可視性を見ていなかったための見落とし) |
| Fix candidate | ページ本体(`<main>`相当)側にvisually-hiddenの静的h1を追加(AUDIT-35-H1シリーズと同一パターン)。ヘルプモーダル内のh1はモーダル固有の見出しとして別途h2等へ調整するかは要検討 |
| Spec decision required | なし |
| 横展開候補 | **要**。AUDIT-35の`tools/main-heading-audit/audit.js`は静的grepのみで実行時可視性を判定していないため、他のTier2/3アプリにも同型の「h1はあるが既定非表示」ケースが存在する可能性がある。Tier2/3監査、および監査ツール自体の改修を推奨 |

---

## TIER1-F2(Finding Family: FT-1 — Modal Focus TrapにA11yパネル対応例外がない)

| 項目 | 内容 |
|---|---|
| Finding Family | FT-1: Focus Trap lacks A11y-panel-aware exception |
| Apps | register-app(record-modal, product-modal の2件)・time-timer(finishOverlay, PIN系4モーダル, helpModal の3件)・janken-app(record-modal-backdrop)・tokei-app(helpModal, recordModal の2件) |
| Severity | **P2 Medium** |
| WCAG観点 | Operable 2.1.2(キーボードトラップなし、逆方向の欠陥)、2.4.3(フォーカス順序) |
| Input Mode | Keyboard, Screen Reader |
| Automated/Manual | Automated(コード直接確認、全件grep+目視) |
| Reproduction | 各アプリで対象モーダルを開いた状態で共通A11yパネルを開き、パネル内でTabを押す |
| Expected | matching-app/okane-app/gaze-keyboard(settingsModal)/schedule-appと同様、フォーカスがA11yパネル内に留まる |
| Actual | Tab handlerが`donomanaA11yPanel`の状態を一切参照しないため、パネル内操作中でもモーダル側のFocus Trapが発動しフォーカスがモーダル内へ強制送還される |
| Evidence | 各アプリのソースコード該当行(register-app.html:1585-1595,1636-1647、time-timer.html:1552-1562,2229-2242,2362-2371、janken-app.html:2377-2385、tokei-app.html:1763-1771,1804-1812) |
| Known/New | New(gaze-keyboardのF3-C[POST-AUDIT-35-HARDEN-3で対応済み]と同型のFinding Familyが他4アプリにも存在すると判明) |
| Fix candidate | okane-app/matching-app/gaze-keyboard(settingsModal)で実証済みの条件式をそのまま横展開: `if(a11yPanel.style.display==='block' && (active===a11yBtn || a11yPanel.contains(active))) return;`をTab handlerの先頭付近へ追加 |
| Spec decision required | なし(既に確立済みパターンの横展開のみ) |
| 横展開候補 | Tier2/3でも同一パターンでの横断チェックを推奨 |

---

## TIER1-F3(Finding Family: FT-2 — Modal Focus Trapが存在しない)

| 項目 | 内容 |
|---|---|
| Finding Family | FT-2: No Focus Trap implementation |
| Apps | mogura-tataki(全6dialog)・scratch-app(全5dialog)・nazorin-print(全4dialog)・tyushi(全3dialog)・gaze-keyboard(profileModal, hrModal — **NEW-KNOWN-3として既出**) |
| Severity | **P2 Medium** |
| WCAG観点 | Robust(dialogのrole/state expectation)、Operable 2.4.3 |
| Input Mode | Keyboard |
| Automated/Manual | Automated(コード全件grep、Tab-key handlerの不在を確認) |
| Reproduction | 各アプリのモーダルを開き、Tabを繰り返し押す |
| Expected | フォーカスがモーダル内に留まる、または意図的な代替設計がある |
| Actual | Tabキーによるフォーカス制御が一切実装されておらず、背景要素へ自由に移動できる |
| Evidence | `tools/accessibility-audit/tier1/static-audit-results.json`(該当5アプリで`tabKeyHandlerMentions`のうちmodal-trap用が0件であることをコード直接確認) |
| Known/New | gaze-keyboard分はKnown(NEW-KNOWN-3)、他4アプリは New |
| Fix candidate | 既存の確立済みFocus Trapパターン(okane-app方式またはtokei-app方式)を新規実装。**ただし「Focus Trapが存在しない」ことはWCAG 2.1.2自体の違反ではなく(同基準はむしろ逆に「トラップされて出られない」ことを禁止するもの)、Robust/ベストプラクティスの観点からの改善提案に近い**。単なる数行修正の横展開ではなく構造判断を伴う(POST-AUDIT-35-HARDEN-3-RELEASEでのOption A/B比較と同種の判断) |
| Spec decision required | 実装方式(matching-app/okane-app型の背景inert方式か、tokei-app/gaze-keyboard型の静的inert属性方式か)をmodal-accessibility-spec §21-13の解消と合わせて決定する必要がある |
| 横展開候補 | Tier2/3でも同様の横断チェックを推奨 |

---

## TIER1-F4(Finding Family: Contrast)

| 項目 | 内容 |
|---|---|
| Finding Family | Contrast(WCAG 1.4.3/1.4.11) |
| Apps | register-app(9)・matching-app(8)・time-timer(4)・mogura-tataki(1)・okane-app(3)・nazorin-print(6)・schedule-app(13)・gaze-keyboard(2) ※( )内は信頼できる判定でのfail件数 |
| Severity | **P2〜P3**(ratio<2.0は P2、2.0〜4.49は P3の目安で個別評価が必要) |
| WCAG観点 | Perceivable 1.4.3(コントラスト最低限)、1.4.11(非テキストコントラスト、未測定) |
| Input Mode | 低視力・弱視ユーザー全般 |
| Automated/Manual | Automated(一次スクリーニング)、最終判断はManual |
| Evidence | `tools/accessibility-audit/tier1/contrast-audit-results.json`、要約は`tier1-contrast-results.md` |
| Known/New | New(本Auditで初めて全Tier1横断計測) |
| Fix candidate | デザイントークンレベルでの配色見直しが必要な可能性が高く(schedule-app/register-app/matching-appで特に集中)、個別ボタン単位の場当たり的修正ではなくデザインシステム側の再検討を推奨 |
| Spec decision required | デザイントークンの正式なコントラスト基準策定 |

---

## TIER1-F5: register-app pmOpenerElのフォーカス復帰がBODYへ退行(正式Finding化)

| 項目 | 内容 |
|---|---|
| Finding Family | Focus Restoration |
| App | register-app(Tier1対象のため正式Finding化) |
| Severity | **P2 Medium** |
| WCAG観点 | Operable 2.4.3 |
| Input Mode | Keyboard, Screen Reader |
| Automated/Manual | Manual(実証済みでバグのない参照実装が現時点でないため、`donomana-modal-accessibility-spec-v1_0.md`自体がフォーカス復帰要件を「U(未決定)」としている) |
| Reproduction | product-modal(pmModal)を開閉後、背景の再描画が発生するケース |
| Expected | 起点要素または妥当なフォールバック先へフォーカスが復帰する |
| Actual | 背景の再描画後にフォーカスが`BODY`要素へ落ちる(Phase18.1-C発見、Phase18.6-Bで再確認、本Auditでも構造不変を確認) |
| Evidence | `donomana-modal-accessibility-spec-v1_0.md` §12.1、register-app.html:1648-1652(MutationObserverによるpmOpenerEl管理) |
| Known/New | Known(modal-accessibility-spec既知記載を正式にTier1 Finding Registerへ移管) |
| Fix candidate | なし確定(spec自身が正解未確定と明記) |
| **Spec decision required** | **あり**。フォーカス復帰の正式要件(最低要件かRecommended要件か、背景再描画時の安全な復帰先標準)をmodal-accessibility-spec §21-1で決定する必要がある |

---

## TIER1-F6(Spec Decision Required): モーダル背景抑制の実装方式が全Tier1で3系統に分裂

| 項目 | 内容 |
|---|---|
| 分類 | Spec Decision Required(PILOT-F2をTier1データで拡張) |
| 系統A(手動inert切替、`<header>`/`<main>`単位) | matching-app・okane-app・gaze-keyboard(settingsModal) |
| 系統B(静的`inert`属性+動的トグル、モーダル自身単位) | tokei-app・janken-app・register-app・time-timer(inertUsage=true群、詳細未検証) |
| 系統C(背景inertなし、端点循環型Focus Trap) | schedule-app |
| 系統D(背景抑制自体が存在しない) | mogura-tataki・scratch-app・nazorin-print・tyushi(TIER1-F3と重複) |
| 関連 | `donomana-modal-accessibility-spec-v1_0.md` §21未決定事項6番・13番 |
| 判断 | 本Auditでは判断しない。本監査完了後、Spec Decision専用の場で正式決定することを推奨 |

---

## Known Issue引き継ぎ状況

| Finding | 状態 |
|---|---|
| PILOT-F1(gaze-keyboard settingsModal初期focus欠如) | ✅ POST-AUDIT-35-HARDEN-2-RELEASEで解消済み(Closed) |
| PILOT-F2 | TIER1-F6へ拡張・統合 |
| NEW-KNOWN-1(gaze-keyboard profileModal/hrModal初期focus欠如) | ✅ POST-AUDIT-35-HARDEN-3-RELEASEで解消済み(Closed) |
| NEW-KNOWN-2(gaze-keyboard settingsModal A11yパネル例外欠如) | ✅ POST-AUDIT-35-HARDEN-3-RELEASEで解消済み(Closed) |
| NEW-KNOWN-3(gaze-keyboard profileModal/hrModal Focus Trap欠如) | TIER1-F3へ統合(gaze-keyboard分として記載) |
| schedule-app heading hierarchy(h2〜h6なし) | Known Issueとして保持。Tier1対象だが、AUDIT-35-H1シリーズで意図的に据え置いた既定路線であり、今回新規Findingとしては計上しない。Technical Debtタグのまま維持 |
| register-app pmOpenerEl | TIER1-F5として正式Finding化(上記) |
| Contrast Pilot Findings(matching-app/okane-app/gaze-keyboard/tokei-app/timetable-app) | Tier1範囲内の4アプリ(matching-app/okane-app/gaze-keyboard/tokei-app)分はTIER1-F4へ統合。timetable-appはTier3のため対象外、Pilot記録のまま保持 |

## Severity集計

| Severity | 件数 |
|---|---|
| P0 Critical | 0 |
| P1 High | 0 |
| P2 Medium | 5(TIER1-F1, F2, F3, F5 + F4の一部) |
| P3 Low | F4(Contrast)の一部(個別ratio評価待ち) |

Technical Debt: 1(schedule-app heading hierarchy)、Spec Decision Required: 2(TIER1-F5, TIER1-F6)、Needs Manual Review: `tier1-manual-review.md`のA〜H、8カテゴリ。

**AUDIT PILOT BLOCKING FINDING相当(P0操作不能)は0件。**
