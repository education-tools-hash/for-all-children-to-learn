# どのまな ひらがな字体選択機能 — Architecture Inventory & Pilot Design（Version 1.0）

- 版: v1.0
- 発行: 2026年8月（Phase T6.5-A）
- 位置づけ: 「なぞり書き練習ツール」（`nazori-app.html`）「なぞりんプリント」（`nazorin-print.html`）へのひらがな字体選択機能について、実コード監査に基づくArchitecture Inventoryと、`nazori-app.html`側の最小Pilot実装の記録。
- baseline: `35ee6f2`（Phase T6 Production Release後のorigin/main）

---

## 0. 対象アプリの正式ファイル

| ユーザー向け名称 | ファイル | apps-data.json id |
|---|---|---|
| なぞり書き練習ツール | `nazori-app.html` | `nazori-app` |
| なぞりんプリント | `nazorin-print.html` | `nazorin-print` |

---

## 1. Source of Truth（ひらがな表示形状）

### なぞり書き練習ツール（`nazori-app.html`）

**Canvas 2D API（`ctx.font` + `ctx.fillText()`）によるブラウザ標準フォント描画。** SVGパスやカスタムベクターデータは一切使用しない。実装箇所は2つ:

1. `drawGuideChar()`（`nazori-app.html:2179`）— 画面上のなぞりガイド（`guideCanvas`）
2. `drawWorksheetPages()`内の`drawCharCell()`（`nazori-app.html:3388`）— 印刷ワークシートのゴースト文字（一時canvasへ描画→PNG化→jsPDFへ埋め込み）

いずれも本Phase以前は`"BIZ UDPGothic", sans-serif`にハードコードされていた。

### なぞりんプリント（`nazorin-print.html`）

**SVG文字列生成（`<text font-family="...">`）。** `nazori-app.html:236,252`で以下の多段階font-familyスタックが**既に**使われている:

```
"UD デジタル 教科書体 N-R","UD Digi Kyokasho N-R","BIZ UDPGothic","BIZ UDGothic","Klee One",sans-serif
```

これは**OS依存で実際に描画される字体が変わる、既存の（本Phase以前からの）設計**である（§4参照）。

---

## 2. 正誤判定に使われている文字形状のSource of Truth

**該当なし。両ツールとも正誤判定エンジンを持たない。**

- `nazori-app.html`: 実コード全体を`judge`/`score`/`check`/`正誤`/`判定`/`getImageData`/`overlap`/`coverage`/`similarity`等で検索したが、幾何学的な正誤判定ロジックは一切存在しない。「✅ できた！」ボタンは利用者（先生・子ども）の**自己申告**であり、押した時点のcanvas（ガイド+描画の合成）を画像として保存するのみ。hiragana-learn.html/katakana-app.htmlのTracingEngine（T2/T3で整備した高精度判定）とは完全に別のアーキテクチャであり、共有もしていない。
- `nazorin-print.html`: 印刷専用ツールであり、そもそも`<canvas>`要素も判定コードも存在しない。

**この事実により、本Phase冒頭で最も懸念されていた「表示と判定の不一致」というリスクは、両ツールとも構造的に発生しない。**

---

## 3. Architecture Decision: **Option A**

> 表示だけを安全に字体変更可能

判定engineが存在しないため、guide変更（Option B）や判定reference変更（Option C）は不要。`hiragana-learn.html`のTracingEngine・stroke order・geometry guard等には一切触れない（そもそも別ファイル・別実装であり、touchしていないことをdiffで確認済み）。

---

## 4. OS依存性（現行字体のInventory）

| フォント | 提供方式 | ライセンス | 備考 |
|---|---|---|---|
| BIZ UDPGothic | Google Fonts `@import`（Web Font） | SIL OFL 1.1 | 現行デフォルト。全OS・全ブラウザで同一字形。 |
| BIZ UDPMincho | Google Fonts `@import`（Web Font） | SIL OFL 1.1 | `nazori-app.html`内でUIラベル装飾フォントとして使用（なぞり文字には未使用）。 |
| "UD デジタル 教科書体 N-R" | **Windows専用システムフォント**（`nazorin-print.html`のfont-familyスタック先頭） | モリサワ商用ライセンス（TypeBank Select Pack／MORISAWA PASSPORT等、買い切り or 年間契約） | **Web配信・self-host・redistribution不可**。Windows 10 Fall Creators Update以降にOS標準搭載されている場合のみ描画される、完全にパッシブなfallback。**Windows 11 24H2以降はフォント名が`"UD デジタル教科書体 N"`に変更されており、既存のfont-familyスタック（`"UD デジタル 教科書体 N-R"`）は最新Windows環境では一致しなくなっている可能性がある**（新発見、§8参照）。 |
| Klee One | Google Fonts（`nazorin-print.html`のfallback末尾に既存記載、`nazori-app.html`では本Phaseで新規追加） | SIL OFL 1.1 | |

結論: **`nazorin-print.html`は既に、Windows環境か否かで実際に印刷される字体が変わるという「意図しない字体差」を抱えている。** 今回のPhaseが解決しようとしている「先生が字体を選べるようにしたい」というニーズの一部は、既にこの既存の不安定な挙動として顕在化している可能性が高い。

---

## 5. 46文字字形差調査（重点10文字：き・さ・そ・ふ・り・れ・わ・む・も・や）

候補5書体（BIZ UDPGothic・BIZ UDPMincho・Klee One・Zen Maru Gothic・Kosugi Maru）を実レンダリングして比較した（画像はPhase内スクラッチパッドに保存、本文書には要約のみ記載）。

- **BIZ UDPGothic**（現行）: UD配慮された安定ゴシック体。線が太く、はね・とめが明確。視認性・字形安定性ともに高い。
- **BIZ UDPMincho**: 明朝体特有の入り抜き・うろこがあり、手書き運筆の構造と視覚的に乖離する。**なぞり教材の字体候補としては不適切と判断し、候補から除外した。**
- **Klee One**: 手書き風。線に太さの強弱があり、はらいが自然。「き」の上部が分離した手書きらしい字形。線がやや細く、小サイズでは視認性がBIZ UDPGothicに劣る可能性がある。
- **Zen Maru Gothic / Kosugi Maru**: 丸ゴシック体。線の端が丸く親しみやすい印象。両者は非常に近い見た目。Kosugi Maruはgaze-keyboard.htmlで既に採用実績がある。

「教科書体」に相当するオープンソースWebフォント（UDデジタル教科書体のような手書き運筆に近い実用書体）は、Google Fonts上に適切な候補が見当たらなかった。無理に追加せず、将来検討事項とする（§9参照）。

---

## 6. Pilot実装（`nazori-app.html`のみ、`nazorin-print.html`は未実装）

### 候補（MVP、現行+2種）

| 表示名 | 実フォント名 | 教育的理由 |
|---|---|---|
| 標準 | BIZ UDPGothic（現状維持） | UD配慮された安定した字形。デフォルト。 |
| やさしい丸文字 | Kosugi Maru | 丸みがあり親しみやすい。視認性を保ちつつ柔らかい印象。 |
| 手書きふう | Klee One | 手書きの運筆に近い自然な線。はらい・とめが明確。 |

「教科書に近い」は今回追加しない（§5参照）。

### 実装内容

- `S.fontFamily`（デフォルト`'BIZ UDPGothic'`）を追加し、`drawGuideChar()`・`drawCharCell()`の2箇所の`ctx.font`をこれを参照するよう変更（印刷ワークシートの日付・名前欄等のUIラベルを描画する`addTextImage()`は対象外、なぞり文字ではないため変更していない）
- Google Fonts `@import`にKosugi Maru・Klee Oneを追加
- 「先生パネル」の既存`.setting-group`群（お手本の太さ等と同じ並び）に「🔤 お手本の字体」を追加。3つのボタンはそれぞれ実際のフォントで「あ」をプレビュー表示（新規Preview UIを別途作らず、既存の「お手本の太さ」ボタンと同じ手法＝ボタンラベル自体を対象フォント/ウェイトで描画、を踏襲）
- 選択状態は`aria-pressed`で明示（色だけに依存しない）、全ボタン`min-height:44px; min-width:44px`
- `localStorage`の新規key `nazori_guide_font` へ保存（既存の`S`オブジェクトの他プロパティ（文字・スタイル・サイズ・回数等）は元々一切永続化されていないため、既存Storage方式の「再利用」はできなかった。字体は「先生・学校ごとの継続的な環境設定」という性質が他の毎回変わる設定と異なるため、新規に1つのシンプルなkeyを追加する方式を採った。大規模なStorage Foundationは作っていない）
- 未設定時（既存利用者含む）は`GUIDE_FONT_DEFAULT = 'BIZ UDPGothic'`にフォールバックし、従来と同じ見た目を維持（Backward Compatibility）

---

## 7. Network / Privacy

新規third-party requestは**Google Fontsの静的アセット取得のみ**（Kosugi Maru・Klee Oneの追加）。これは既存の`donomana-learning-record-standard-v1_0.md`等で既に許容されているパターンと同種であり、新たな種類の外部通信は発生しない。

---

## 8. 本Phaseで発見した既存の重大な既存バグ（本Phaseのスコープ外、別Phase推奨）

### 8.1 `nazori-app.html`の活動記録機能が実質的に機能していない

`loadRecords()`/`saveRecords()`（`nazori-app.html:2589,2600`）が`window.storage.get/set('nazori_records', ...)`という、**通常のブラウザ環境（GitHub Pages含む）には存在しないAPI**を呼び出している。実測（Playwright、Production相当の静的サーバー配信）で`typeof window.storage === 'undefined'`を確認し、「できた！」ボタンを押しても`records`配列が0件のまま増えないことを確認した。`try/catch`で例外が握りつぶされるため、console/page errorには一切現れない。

これはコメント「window.storage API（アーティファクト対応）でロード」から、Claude.ai Artifacts環境向けに開発されたコードがそのまま移植され、通常のWeb環境向けの実装（`localStorage`等）に置き換えられていない既存の実装ミスと推測される。apps-data.jsonにこのアプリの「きろく機能あり」相当のbadgeが付いていないのは、結果的に正確な状態と言える。

**本Phaseでは修正しない**（字体選択とは無関係、Scope Freeze対象）。別Phaseでの修正を推奨する。

### 8.2 `nazorin-print.html`のfont-familyスタックがWindows 11 24H2以降で機能しなくなっている可能性

§4参照。フォント名の変更（`"UD デジタル 教科書体 N-R"` → `"UD デジタル教科書体 N"`）により、既存のfont-familyスタックの先頭指定が最新Windows環境では一致しなくなっている可能性がある。実機検証はしていない（Windows 11 24H2環境がPhase内で用意できないため）。次のsubphaseでの確認を推奨する。

---

## 9. 次のT6.5-A subphase候補

1. **`nazorin-print.html`への同様の字体選択機能追加**（SVG `<text font-family>`ベースなので技術的には`nazori-app.html`より単純だが、印刷レイアウトへの影響確認が別途必要）
2. **§8.1のnazori-app活動記録バグ修正**（`window.storage` → `localStorage`への置き換え、字体選択とは独立した別Phase）
3. **§8.2のWindows 11 24H2フォント名変更の実機確認**
4. 「教科書体」候補の再検討（将来、適切なオープンソースフォントが見つかった場合）

---

## 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| v1.0 | 2026-08-30 | Phase T6.5-A。Architecture Inventory完了（判定engineなし、Option A確定）。`nazori-app.html`へ3択の字体選択機能をPilot実装（表示のみ、localStorage永続化、44px/keyboard/aria-pressed対応）。`nazorin-print.html`は未実装（次subphase）。既存の`window.storage`バグ、Windows 11 24H2フォント名変更リスクを発見・記録。 |
