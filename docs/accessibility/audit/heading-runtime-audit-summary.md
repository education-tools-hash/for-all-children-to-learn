# Heading Runtime Audit Hardening Summary

- Phase: ACCESSIBILITY-AUDIT-TOOL-HARDEN-1
- 目的: TIER1-F1(tyushiのh1が既定状態で到達不能)が明らかにした`tools/main-heading-audit/audit.js`の盲点を修正し、全35アプリを新しい監査レイヤーで再監査する。
- 本Phaseでは**アプリ側HTMLを一切修正しない**。監査tool・fixture・docsのみ追加。

---

## 1. 既存tool(`tools/main-heading-audit/audit.js`)のRoot Cause

該当コード(`analyze()`関数)は、HTML文字列から`<script>`/`<style>`/コメントを除去した上で、正規表現`<h([1-3])[^>]*>([\s\S]*?)<\/h\1>`により`<h1>`〜`<h3>`タグの**静的な出現数のみ**をカウントしている。DOM構築・CSS適用・`display:none`/`aria-hidden`/`inert`/`hidden`属性などの**実行時状態は一切評価していない**(そもそもNode.js上の純粋な文字列処理であり、ブラウザDOMを構築すらしていない)。

このため、tyushiの唯一の`<h1>`が既定で`display:none`の`#help-overlay`(ヘルプモーダル)内にあっても、静的カウント上は「h1=1件、正常」と判定されてきた。これはツールの設計上避けられない限界であり、AUDIT-35時点の`Total apps=35 / main missing=0 / h1 missing=0 / h1 excess=0`という結果自体は**静的構造監査としては誤りではない**。

---

## 2. runtime reachable headingの定義(新設)

既存のstatic auditを置き換えず、**Layer 2として追加**する(`tools/main-heading-audit/runtime-audit.py`)。

### Accessibility Reachable(Gate判定に使用する主指標)

要素自身または祖先のいずれかが以下に該当しないこと:

1. `hidden`属性を持つ祖先
2. `aria-hidden="true"`を持つ祖先
3. `inert`属性を持つ祖先
4. `display:none`(自身または祖先の計算済みスタイル)
5. `visibility:hidden`/`visibility:collapse`(自身または祖先)

**意図的に`offsetParent`やgeometryを判定条件に含めない**。理由: register-app/schedule-appの既存visually-hidden静的h1(`position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);...`)は上記5条件のいずれにも該当しないため、スクリーンリーダーのaccessibility treeには残り続ける。これを「不可視だから不適合」と誤判定しないことが本Phaseの必須要件(§9)。

### Runtime Visible(補助指標、Gate判定には使用しない)

`Accessibility Reachable`であり、かつ:
- `offsetParent !== null`(ただし`position:fixed`は例外的に除外判定しない — fixed要素は可視でも常にoffsetParentがnullになるため)
- 実測bounding rectが1px×1px以下ではない(visually-hiddenのclipパターンを「人の目には見えない」側として区別するための閾値)

この2値を分離することで、「静的に存在する」「人の目に見える」「SRのaccessibility treeに残る」という3層を明確に区別できる。

---

## 3. Fixture Test結果

`tools/main-heading-audit/fixtures/reachability-fixture.html`(8ケース、A〜Hを本文書用に命名)を作成し、判定ロジックを実装前に検証した。

| Case | 内容 | 期待(reachable, visible) | 実測 |
|---|---|---|---|
| A | 通常表示h1 | (true, true) | ✅一致 |
| B | display:none親内h1 | (false, false) | ✅一致 |
| C | hidden属性親内h1 | (false, false) | ✅一致 |
| D | aria-hidden="true"親内h1 | (false, false) | ✅一致 |
| E | inert親内h1 | (false, false) | ✅一致 |
| F | 閉じたmodal内h1(tyushi方式の再現) | (false, false) | ✅一致 |
| G | visually-hidden静的h1(register-app/schedule-app方式) | **(true, false)** | ✅一致 |
| H(追加) | visibility:hidden親内h1 | (false, false) | ✅一致 |

**8/8 PASS**。特にCase G(視覚的には不可視だがaccessibility treeには残るべき)が期待通り`reachable=true`と判定されたことが、本ツールの核心的な正しさを保証する。

---

## 4. tyushi Before/After検出

| | 判定 |
|---|---|
| Before(既存audit.js) | static h1 count = 1 → PASS(既存Gate上は合格) |
| After(runtime-audit.py) | static=1, **accessibilityReachable=0**, runtimeVisible=0 → **MISMATCH検出** |

Evidence: `tools/main-heading-audit/runtime-results.json` → `tyushi: {staticH1Count: 1, accessibilityReachableCount: 0, runtimeVisibleCount: 0}`

---

## 5. register-app / schedule-app Regression(必須確認)

| app | static | accessibilityReachable | runtimeVisible |
|---|---|---|---|
| register-app | 1 | **1**(✅) | 0(想定通り、視覚的には隠れている) |
| schedule-app | 1 | **1**(✅) | 0(同上) |

両アプリともAccessibility Reachable = trueと正しく判定された。AUDIT-35-H1シリーズで導入したvisually-hidden静的h1パターンを誤ってunreachable扱いする回帰は発生していない。

---

## 6. 全35アプリ再監査結果

Evidence: `tools/main-heading-audit/runtime-results.json`

| 指標 | 値 |
|---|---|
| Total apps | 35 |
| static h1 missing | 0 |
| static h1 excess | 0 |
| **accessibility-reachable h1 missing** | **1**(tyushiのみ) |
| accessibility-reachable h1 excess | 0 |

35アプリ中34アプリでstatic=reachableが一致(問題なし)。tyushiのみ不一致。

## 7. Static Gate結果(既存audit.js、無変更で再実行)

```
Total apps: 35
<main> missing: 0 (of which role="main" present instead: 0)
h1 missing: 0
h1 excess (>1): 0
```

AUDIT-35時点の結果と完全一致。既存Static Gateは本Phaseの変更によって一切破壊されていない。

## 8. 同型Finding探索結果

全35アプリに対しruntime-audit.pyを実行した結果、**tyushi以外にstatic/reachableの不一致は0件**。TIER1-F1はTier1(および全35アプリ)の中で唯一の事例であることが実証された(推測ではなく全数実行による確認)。

「static h1 > 1だがreachable h1 = 1」等の逆パターン(excess側)も0件。

## 9. 新規Finding一覧

本Phaseでは新規Finding番号を採番する事象は発見されなかった(tyushiの件はTIER1-F1として既に登録済み)。ただし以下を記録する:

**TOOL-HARDEN-EVIDENCE-1**: TIER1-F1に対し、Static Structure層とRuntime Accessibility層を分離したEvidenceを追加した。

- Static structure audit(`tools/main-heading-audit/audit.js`): **PASS**(h1=1、変更なし)
- Accessibility runtime reachable heading(`tools/main-heading-audit/runtime-audit.py`): **FAIL**(reachable=0)

Severityは変更しない(TIER1-F1のP2のまま、Tier1 Finding Registerを正本として維持)。

## 10. AUDIT-35との整合性

AUDIT-35が確定した`main missing=0 / h1 missing=0 / h1 excess=0`は、**静的構造監査(Layer 1)としては引き続き正しい結果**である。本Phaseはこれを「誤りだった」として書き換えるものではなく、**Layer 2(Accessibility Runtime Reachable Heading)という新しい監査軸を追加**するものである。

正式表現:
> AUDIT-35 static heading structure = PASS(不変)
> Accessibility runtime reachable heading = additional finding(tyushiのみ、TIER1-F1として既に記録済み)

## 11. Tool変更内容

- **変更なし**: `tools/main-heading-audit/audit.js`・`tools/main-heading-audit/body-structure.js`(既存Layer 1、無修正)
- **新規追加**: `tools/main-heading-audit/runtime-audit.py`(Layer 2)
- **新規追加**: `tools/main-heading-audit/fixtures/reachability-fixture.html`(fixture、8ケース)
- **新規追加**: `tools/main-heading-audit/runtime-results.json`(35アプリ実行結果)

## 12. 作成ファイル

- `docs/accessibility/audit/heading-runtime-audit-summary.md`(本ファイル)
- `tools/main-heading-audit/runtime-audit.py`
- `tools/main-heading-audit/fixtures/reachability-fixture.html`
- `tools/main-heading-audit/runtime-results.json`

## 13. Tier2/3への推奨

Tier2(17アプリ)・Tier3(6アプリ)の監査でも、`runtime-audit.py`を同様に実行し、Layer 1(既存static audit)とLayer 2(本Phaseで追加したruntime reachable audit)の両方でGateを確認することを推奨する。

## 改訂履歴

| version | date | 内容 |
|---|---|---|
| v1.0 | 2026-09-07 | Phase ACCESSIBILITY-AUDIT-TOOL-HARDEN-1。main-heading audit toolへruntime reachable heading判定(Layer 2)を追加。全35アプリ再監査完了、tyushi以外に同型事例なしと確認。 |
