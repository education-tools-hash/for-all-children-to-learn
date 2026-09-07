# WCAG-JIS-AUDIT-1-TIER3: Finding Register

- 分類基準: `donomana-wcag-jis-audit-plan-v1_0.md` v1.1 §17(Severity)・§18(4軸管理: app / finding family / WCAG観点 / input mode)
- Tier1/Tier2で確立したFinding Family(FT-1/FT-2/Contrast/Focus Restoration/Initial Focus Missing/Reflow Overflow/Broken ARIA Reference/Spec Decision Required)へ可能な限り統合し、新規Familyは真に新規のパターンのみ追加した。
- 本Auditでは**発見してもコードを修正しない**。

---

## Tier3の構造的特徴(Family適用状況の総括)

Tier3の6アプリは全てapp固有モーダル(`role="dialog"`)を持たない(共通A11yパネルのみ)。そのため以下のFinding FamilyはTier3では**該当アプリなし(N/A)**:

- FT-1 / FF-A(A11yパネルFocus Trap例外欠如)
- FT-2 / FF-B(Focus Trap欠如)
- Focus Restoration / FF-D
- 背景抑制方式 / FF-E(TIER1-F6統合分)
- Initial Focus Missing / FF-F

破壊的操作(記録削除等)はいずれもブラウザ標準の`confirm()`を使用しており、ARIA/フォーカス管理はブラウザ自身が保証するため、モーダル関連Gateの対象外(Audit plan §23の境界通り)。**これはTier3が「単純構造」に分類されている設計意図を実測データで裏付けるものであり、新たな懸念ではない。**

---

## TIER3-F1(新規Finding: 見出し階層スキップ)

| 項目 | 内容 |
|---|---|
| Finding Family | Heading Hierarchy Skip(新規。Tier1のschedule-app「h2〜h6なし」はTechnical Debt扱いだったが、今回は「一部でh2を経由せずh3へ飛ぶ」という異なるパターンのため新規計上) |
| App | yomikaki-app |
| Severity | **P3 Low**(視覚的には問題なく、SR利用者の見出しナビゲーション時の階層理解にのみ影響するため) |
| WCAG観点 | Perceivable 1.3.1(情報及び関係性)、2.4.6(見出し及びラベル、参考) |
| Input Mode | Screen Reader(見出しジャンプ機能利用時) |
| Automated/Manual | Automated(静的heading構造の直接コード確認) |
| Reproduction | yomikaki-app.htmlをSRで開き、見出しナビゲーションでH1→H2→H3の順を期待して移動する |
| Expected | H1の後、最初のセクション見出しはH2であるべき |
| Actual | yomikaki-app.html:683の`<h1>`直後、688-691行の「つかいかたステップ」4件が`<h2>`を経由せず`<h3>`として実装されている。695行目以降で`<h2>`が初出現し、708行目の`<h2>`配下の設定サブセクション(753行目以降)は正しく`<h3>`としてネストされている(そちらは正常) |
| Evidence | yomikaki-app.html:683,688-691,695,708,753-808 |
| Known/New | New |
| Fix candidate | 688-691行目の4件を`<h2>`へ変更するか、695行目の「できること」相当の見出しをH1直後に挿入して階層を正規化する。いずれも視覚デザイン(CSSクラス)は変更せずタグのみ調整すれば解決可能な見込み |
| Spec decision required | なし |
| 横展開候補 | Tier1/Tier2では発見されなかった新パターンのため、既に完了済みのTier1/Tier2アプリについても任意でheading hierarchy(タグの前後関係)の再点検を推奨(本Auditのstatic-audit.jsの`headingSequenceRaw`収集データを活用可能) |

---

## TIER3-F2(Finding Family: Reflow Overflow — TIER2-F5と同一Family)

| 項目 | 内容 |
|---|---|
| Finding Family | Reflow Overflow(TIER2-F5と同一Family) |
| App | slideshow-sakusei |
| Severity | **P2 Medium**(TIER2-F5と同等。ただしモバイル通常幅でも発生するため実質的な影響範囲はTIER2-F5より広い可能性がある) |
| WCAG観点 | Perceivable 1.4.10(リフロー) |
| Input Mode | モバイル利用者全般、低視力・弱視ユーザー(拡大表示利用者) |
| Automated/Manual | Automated(Playwright、4viewport+200%zoom条件下でのscrollWidth比較) |
| Reproduction | slideshow-sakusei.htmlを375×667または390×844で開く。または1280×900で200%ズームを適用する |
| Expected | モバイル標準幅・拡大表示でも横スクロールが発生しない(コンテンツが折り返し/縮小される) |
| Actual | `slideshow-sakusei.html:165`の`body{...overflow-x:auto;overflow-y:hidden;...min-width:760px;}`により、bodyに明示的な最小幅760pxが設定されている。375×667・390×844の通常モバイル幅、および1280×900の200%zoom相当幅(実効640px)のいずれでも760px未満となり、横スクロールが発生する |
| Evidence | `tools/accessibility-audit/tier3/browser-audit-results.json` → slideshow-sakusei.viewport_overflow(375x667=true, 390x844=true, 1280x900_200pct_zoom=true)。コード確認: slideshow-sakusei.html:165,187 |
| Known/New | New |
| Fix candidate | `min-width:760px`の要否を精査し、レスポンシブ対応が必要な場合はメディアクエリでモバイル幅時のレイアウト再構成(topbarのボタン折り返し等)を設計する。デスクトップ専用の編集ツールとして`min-width`を維持する設計判断も選択肢としてあり得るが、その場合は「モバイル非対応」であることをUIおよびドキュメント上で明示することを推奨 |
| Spec decision required | **あり**。本アプリ(スライドショー作成という編集系ツール)がモバイル対応を要件とするかどうかの方針決定が必要 |
| 横展開候補 | Tier1/Tier2のcanvas/複雑UI系アプリ(drawing-app等)と合わせて横断的なReflow基準の確立を推奨 |

---

## TIER3-F3(Finding Family: Contrast — TIER1-F4/TIER2-F4と同一Family)

| 項目 | 内容 |
|---|---|
| Finding Family | Contrast(WCAG 1.4.3) |
| Apps | timetable-app(3)・yomikaki-app(8)・sst-app(4)・slideshow-sakusei(1) ※( )内は信頼できる判定でのfail件数、合計16件 |
| Severity | **P3 Low**(全件ratio 2.0以上のため、Tier1/Tier2の分類基準でP3) |
| WCAG観点 | Perceivable 1.4.3(コントラスト最低限) |
| Input Mode | 低視力・弱視ユーザー全般 |
| Automated/Manual | Automated(一次スクリーニング)、最終判断はManual |
| Evidence | `tools/accessibility-audit/tier3/contrast-results.json`、要約は`tier3-contrast-results.md` |
| Known/New | New |
| Fix candidate | yomikaki-appのブランドカラー系青(rgb(45,125,210))がほぼ全件で僅かに閾値未達(4.22 vs 4.5)であり、単一トークンの微調整で一括改善できる可能性が高い |
| Spec decision required | TIER1-F4/TIER2-F4と共通のデザイントークン正式コントラスト基準策定に合流 |
| 特記事項 | sugoroku-appは25件中25件がgradient背景でNeeds Manual Review(信頼できる判定0件)。Tier2で確認された「ページ全体gradient背景アプリでの自動カバレッジ低下」がTier3でも再現した |

---

## 構造監査での誤検知(Findingとして計上しないもの)

| 項目 | 内容 |
|---|---|
| sugoroku-app: duplicate id `sce-prev-ic` | 静的マークアップの`<span id="sce-prev-ic">📝</span>`(sugoroku-app.html:1310)と、JSの`updateScePreview()`が親要素`#sce-preview`ごと`innerHTML`で置換する際の同名span(sugoroku-app.html:2124)が異時点で使われるのみで、実行時に同時存在する重複ではない。Tier2のbosai-app`bag-max`と同一パターンの誤検知 |

---

## Severity集計(Tier3単独)

| Severity | 件数 |
|---|---|
| P0 Critical | 0 |
| P1 High | 0 |
| P2 Medium | 1(TIER3-F2) |
| P3 Low | 2(TIER3-F1, TIER3-F3) |

Technical Debt: 0。Spec Decision Required: 1(TIER3-F2、モバイル対応方針)。Needs Manual Review: `tier3-manual-review.md`参照。

**AUDIT PILOT BLOCKING FINDING相当(P0操作不能)は0件。**
