# ongaku-app Modal Applied Design(Contract適用設計)

`donomana-modal-accessibility-contract-v1_0.md`(v1.1)をongaku-appのmodal-pin/modal-export/modal-shareに適用した設計。

> **[実装済み]** 本設計はWCAG-JIS-FIX-MODAL-ONGAKU-1(commit `bdc1b4b`)で実装され、追加でWCAG-JIS-MODAL-SPEC-DECISION-1-REVISIONの新Evidence(Initial Focus Title Reverse-Tab Escape)を受けてcommit `9eebca4`でReverse Tab境界を修正済み(Production未反映)。実装は§4で述べた「共通関数化」ではなく、`ongakuOpenModalContract()`/`ongakuCloseModalContract()`/`ongakuSetBackgroundInert()`の3関数分割方式を採用した(理由: modal-pinが`<main>`の内側、modal-export/modal-shareが`<main>`の外側という非対称なDOM構造が実装時に判明し、背景inertの適用方法を2パターンに分岐する必要があったため、単一の`attachModalContract()`より責務分割の方が明確だった)。

参照実装: 同一ファイル内の`modal-help`(role/aria-modal/初期focus/Escape/復帰は実装済み、A11yパネル例外[FAMILY-A]とFocus Trap[FAMILY-B]のみ未実装。**Focus Trapは実は"Sub-pattern α"[title自身をfirst変数とする2要素巡回]で実装済みであることが本Revisionで判明し、Reverse Tab境界問題の対象外であることを確認済み**)。

---

## 1. modal-pin(教員用PIN入力、ongaku-app.html:1270-1298)

| Contract項目 | 現状 | 適用設計 |
|---|---|---|
| role/aria-modal | ❌欠如 | `<div id="modal-pin" class="modal-bg" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">` |
| Title/id | `<h3>せんせいようせってい</h3>`(id無し) | `<h3 id="pin-modal-title" tabindex="-1">せんせいようせってい</h3>` |
| Initial Focus | ❌欠如 | `showPinModal()`末尾に`document.getElementById('pin-modal-title').focus();`追加 |
| Focus Trap(Forward) | ❌欠如 | 端点循環型を新規実装。first=`pin-modal-title`、last=`.pin-key.del`(⌫ボタン) |
| **Reverse Tab境界(v1.1新設、実装済み)** | ❌欠如 | Shift+Tab境界判定に`titleEl`(`modal-pin-title`)を含める(`active===first \|\| active===titleEl`)。**実装・実機確認済み** |
| Escape | ❌欠如 | `closePin()`を呼ぶEscapeハンドラ新規追加 |
| Restoration | ❌欠如 | `showPinModal()`open前に`document.activeElement`を保存、`closePin()`で復帰(トリガーは`.btn-home.btn-teacher`) |
| 背景inert | ❌欠如 | `#app`相当の主要コンテナへ`inert`付与(A11yパネルは除外) |
| A11yパネル例外 | N/A(Trap自体が新規) | Trap実装と同時にA11yパネル例外を組み込む(§4のコードをそのまま適用) |
| Switch/Gaze | 未検証 | Focus Trap実装後、`.pin-key`群のみがscan/gaze候補になることを確認 |

---

## 2. modal-export(WAV書き出し、ongaku-app.html:1768-1804)

| Contract項目 | 現状 | 適用設計 |
|---|---|---|
| role/aria-modal | ❌欠如 | `role="dialog" aria-modal="true" aria-labelledby="export-title"` |
| Title/id | `<h3 id="export-title">`(id既存、tabindexなし) | `tabindex="-1"`を追加するのみ(idは既存のものを再利用可能) |
| Initial Focus | ❌欠如 | `exportWav()`末尾に`document.getElementById('export-title').focus();`追加 |
| Focus Trap(Forward) | ❌欠如 | 端点循環型。ただし`#export-options`/`#export-progress`/`#export-done`の3状態でDOM表示が切り替わるため、**first/lastの判定を「現在表示中のサブビュー内」に限定する動的ロジックが必要**(単純な固定first/lastでは進捗表示中に取りこぼす)。**実装ではkeydownごとに`querySelectorAll(...).filter(offsetParent!==null)`で再取得する方式を採用し、状態遷移に自動追随することを確認済み** |
| **Reverse Tab境界(v1.1新設、実装済み)** | ❌欠如 | Shift+Tab境界判定に`titleEl`(`export-title`)を含める。**実装・実機確認済み**(options/progress/done各状態で個別確認はしていないが、境界ロジック自体は状態非依存のため波及効果を確認) |
| Escape | ❌欠如 | `closeExportModal()`を呼ぶハンドラ新規追加。ただし書き出し処理中(`#export-progress`表示中)のEscape許可可否は要検討(処理中断の扱い)。**実装では特別な制限を設けず常時Escape可能とした** |
| Restoration | ❌欠如 | トリガーボタン(`#btn-export-wav`)への復帰実装 |
| 背景inert | ❌欠如 | modal-pinと同様 |
| A11yパネル例外 | N/A | 同様に組み込み |
| Switch/Gaze | 未検証 | 3状態(options/progress/done)それぞれで候補が正しく切り替わることを確認 |

**modal-exportは3モーダル中最も複雑(進捗表示の状態遷移を持つ)。Focus Trapのfirst/last判定を動的にする必要があり、他2モーダルより実装コストが高い。**

---

## 3. modal-share(共有URL、ongaku-app.html:1807-1817)

| Contract項目 | 現状 | 適用設計 |
|---|---|---|
| role/aria-modal | ❌欠如 | `role="dialog" aria-modal="true" aria-labelledby="share-modal-title"` |
| Title/id | `<h3>さくひんをきょうゆうする</h3>`(id無し) | `<h3 id="share-modal-title" tabindex="-1">さくひんをきょうゆうする</h3>` |
| Initial Focus | ❌欠如 | `shareComposition()`末尾に`.focus()`追加 |
| Focus Trap(Forward) | ❌欠如 | 端点循環型。first=title、last=`.btn-back`(とじるボタン) |
| **Reverse Tab境界(v1.1新設、実装済み)** | ❌欠如 | Shift+Tab境界判定に`titleEl`(`modal-share-title`)を含める。**実装・実機確認済み** |
| Escape | ❌欠如 | 新規追加 |
| Restoration | ❌欠如 | トリガーボタン(`.btn-save-compose`系の共有ボタン)への復帰実装 |
| 背景inert | ❌欠如 | 同様 |
| A11yパネル例外 | N/A | 同様に組み込み |
| Switch/Gaze | 未検証 | URLコピーボタン・とじるボタンのみが候補になることを確認 |

---

## 4. 共通実装方針

4モーダル(modal-help含む)は全て`.modal-bg`/`.modal`という共通CSSクラスを使用しているため(既存コードコメントで明記済み)、**Focus Trap/Escape/初期focus/復帰の実装を共通関数化した上で4モーダルへ適用する設計**を推奨する:

```js
// 設計イメージ(実装しない)
function attachModalContract(overlayId, opts) {
  // opts: {titleId, firstId, lastId, triggerSelector, onClose}
  // - Escapeハンドラ登録(A11yパネル例外込み)
  // - Tab/Shift+Tab端点循環ハンドラ登録(A11yパネル例外込み)
  // - open時: inert解除+title.focus()
  // - close時: inert再設定+trigger.focus()
}
```

この共通化により、modal-help自身のFAMILY-A(A11yパネル例外)・FAMILY-B(Focus Trap)も同時に解消でき、4モーダル分の実装を1つの共通関数+3〜4回の呼び出しに集約できる見込み。**ただし今回は設計のみとし、実装はしない。**

---

## 5. 推定実装規模

| モーダル | 新規コード行数目安 | 複雑度 |
|---|---|---|
| modal-help(A11yパネル例外+Trap追加のみ) | 約10-15行 | 低 |
| modal-pin | 約20-25行(共通関数利用時は呼び出し1行+マークアップ変更) | 低〜中 |
| modal-export | 約25-30行(動的first/last判定が必要) | 中〜高 |
| modal-share | 約20-25行 | 低〜中 |
| 共通関数`attachModalContract()`自体 | 約40-60行 | 中(初回のみ) |

**共通関数化した場合の合計: 約100-130行程度。個別実装した場合より若干多いが、4モーダル分の一貫性・保守性・再Fix時の再利用性を考慮すると共通関数化を推奨する。**
