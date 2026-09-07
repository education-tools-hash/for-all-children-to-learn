# Modal Regression Test Contract

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)に基づく全Modal Fixで共通して使用するRegression Gate定義。既存Tier1/Tier2/Tier3で確立済みのGateを再利用し、未確立部分はテンプレート化する。

> **[v1.1更新]** Contract v1.1で新規発見されたInitial Focus Title Reverse-Tab Escape(FAMILY-J)を受け、「Shift+Tab cycle」Gateを**Forward Tab Boundary Gate**と**Reverse Tab Boundary Gate**に分離し、Reverse側の必須確認項目(initial focus anchorからのShift+Tab)を明記した(§1.1)。

---

## 1. 必須Gate一覧

| Gate | 確認内容 | 既存確立状況 |
|---|---|---|
| role/aria-modal | `getAttribute('role')==='dialog'`、`getAttribute('aria-modal')==='true'` | ✅確立済み(Tier1〜3 static-audit.jsの`roleDialogCount`) |
| Accessible name | `aria-labelledby`参照先が実在し、CDP `Accessibility.getPartialAXTree`で`name`が期待値と一致 | ✅確立済み(WCAG-JIS-FIX-P1-Aで実証) |
| Initial Focus | Modal open直後、`document.activeElement`がtitle(またはPattern2/3許容要素)と一致 | ✅確立済み(PILOT-F1、WCAG-JIS-FIX-P1-Bで実証) |
| Forward Tab Boundary(旧Tab cycle) | Tab連打でfirst→last→first(端点循環)を確認、背景へ抜けないこと | 🟡テンプレート化要(個別実装のみ) |
| **Reverse Tab Boundary(初期focus起点、v1.1で新設)** | **modal open直後(Tabを一度も押さない状態)でShift+Tabを押し、`document.activeElement`がmodal内(last focusable)に留まることを確認。`active===initialFocusAnchor`の境界判定漏れ[Initial Focus Title Reverse-Tab Escape]の再発防止Gate** | 🆕新設(WCAG-JIS-MODAL-SPEC-DECISION-1-REVISIONで追加、ongaku-appで実証済み) |
| Reverse Tab Boundary(通常状態) | 一度Tabで実focusable要素へ移動した後のShift+Tab循環(last→...→first→(境界)→last) | 🟡テンプレート化要 |
| Escape | Escapeでmodal close、複数overlay同時開時の優先順位確認 | ✅確立済み(単一modal)、🟡複数overlay時は未確立 |
| Close button | クリックでmodal close | ✅確立済み |
| Focus Restoration | close後`document.activeElement`がopener(またはfallback順位に従う要素)と一致 | ✅確立済み(WCAG-JIS-FIX-P1-Bで実証) |
| Background inert | `inert`属性の付け外しタイミング確認、A11yパネルは対象外であることの確認 | 🟡テンプレート化要(系統A実装[matching-app等]をベースに一般化) |
| A11yパネル開閉 | modal表示中でも`donomanaA11yPanel`のopen/closeが正常 | ✅確立済み(全Tierで実施済み) |
| Switch candidate parity | Fix前後で`buildScanItems()`等の候補数・順序が意図通り変化(除外漏れ/過剰除外がないこと) | ✅確立済み(WCAG-JIS-FIX-P1-A/Bで実証) |
| Gaze target scope | modal表示中、背景targetが無効化されmodal内targetのみ有効 | ❌未確立(個別アプリごとの実装差異が大きく、汎用テンプレート化は今後の課題) |
| console/page error | 全操作を通じて0件 | ✅確立済み(全Tier共通) |
| Responsive | 5viewport+200%zoomでoverflow/レイアウト崩れなし | ✅確立済み(全Tier共通) |

---

## 1.1 Gate: Initial Focus Reverse-Tab Boundary(必須、v1.1新設)

**目的**: Focus Trap境界判定が、initial focus anchor(通常はtitle要素、`tabindex="-1"`)を境界の一部として正しく扱っているかを検証する。

**手順**:
1. Modal open(トリガー要素を実クリックまたは同等の操作で発火)
2. `document.activeElement`がinitial focus anchor(title等)と一致することを確認(§Initial Focus Gateと共通)
3. **この時点でTabを一度も押さない**
4. Shift+Tabを1回押す
5. `document.activeElement`を確認
6. `document.activeElement`がmodalの子孫要素であること(`modal.contains(document.activeElement)`)を確認
7. 期待値: `document.activeElement`はmodal内の最後の意味のある操作要素(`last`)と一致する

**PASS条件**: 手順6・7が両方成立すること。手順6が不成立(`modal.contains()===false`)であれば、Initial Focus Title Reverse-Tab Escapeが再発しているとみなしFAIL。

**既知の非該当ケース**: Sub-pattern α(title自身が`first`変数として直接使われる2要素巡回実装、bosai-app/shiritori2/ongaku-app[modal-help]等)は、この失敗モードの対象外であることが構造的に保証されているため、本Gateを実行しても常にPASSする(念のため実行は推奨するが、Fix優先度には影響しない)。

---

## 2. Browser / AT Validation対象

| 種別 | 対象 | 適用範囲 |
|---|---|---|
| Automated | Chromium(Playwright) | 全Fix必須 |
| Manual | NVDA + Edge | Fix対象アプリ全て(`manual-review-strategy.md`のhigh-risk/代表選定に準拠) |
| Manual | VoiceOver + iPad Safari | 同上 |
| 任意 | WebKit smoke(Playwright、Safari相当エンジン) | `inert`のWebKit実装差異を懸念する場合、Automated範囲に追加を検討(現時点では必須としない) |

---

## 3. Fix Phase共通テンプレート(疑似コード)

```python
# 各Modal Fix Phaseで共通利用する検証シーケンス(設計のみ、実装しない)
def verify_modal_contract(app, modal_id, trigger_selector, title_id, close_selector):
    # 1. Dialog semantics
    assert get_attr(modal_id, 'role') == 'dialog'
    assert get_attr(modal_id, 'aria-modal') == 'true'
    # 2. Open + Initial Focus
    click(trigger_selector)
    assert active_element_id() == title_id
    # 3. Dialog semantics via AX tree
    assert ax_name(modal_id) == expected_name
    # 4. Forward Tab boundary
    assert tab_cycle_stays_within(modal_id)
    # 4.1 Reverse Tab boundary from initial focus anchor(v1.1新設、§1.1)
    #     再open->即Shift+Tabで、境界判定漏れ(Initial Focus Title Reverse-Tab Escape)がないことを確認
    click(trigger_selector)
    assert active_element_id() == title_id
    press('Shift+Tab')
    assert element_is_inside(modal_id, active_element())
    # 5. A11y panel exception
    click('#donomanaA11yBtn')
    assert a11y_panel_focus_not_hijacked()
    click('#donomanaA11yBtn')
    # 6. Escape
    press('Escape')
    assert not is_visible(modal_id)
    assert active_element_id() == trigger_selector
    # 7. Reopen + close button
    click(trigger_selector)
    click(close_selector)
    assert active_element_id() == trigger_selector
    # 8. Switch candidate parity(該当アプリのみ)
    assert scan_candidates_match_baseline()
    # 9. console/page error
    assert error_count == 0
```

**このテンプレートは各Fix Phase(FAMILY-A/B/C/ongaku-app等)で共通利用可能。個別アプリの差異(title要素の有無、Pattern2/3許容等)はパラメータ化して吸収する。**

---

## 4. 既存資産の再利用性まとめ

- **完全に再利用可能**(追加コストなし): role/aria-modal確認、console/page error、Responsive、A11yパネル開閉、Switch candidate parity
- **確立済み(v1.1で新設、ongaku-appで実証済み)**: Reverse Tab Boundary(初期focus起点)
- **部分的にテンプレート化が必要**: Forward Tab Boundary、Reverse Tab Boundary(通常状態)、Focus Restoration fallback順位確認、Background inert確認
- **未確立、個別実装が続く見込み**: Gaze target scope(アプリごとの実装差異が大きいため)
