# どのまな アクセス解析・プライバシー表記 整合性監査 設計文書 v1.0

対象: 「どのまな」サイト全体における、Google Analytics(アクセス解析)・
個人情報の取り扱いに関する利用者向け説明の整合性。

本文書は Phase T4-A(監査、READ-ONLY)の確定事項を記録する。
Production変更は行っていない。次Phase(T4-B)で修正を実施する。

---

## 0. 現状ステータス

- **Phase T4-A: 完了 — AUDITED, NOT YET FIXED**。矛盾箇所を特定済み、
  Production未変更。
- 次Phase候補: **T4-B — Analytics / Privacy Disclosure Consistency
  Fix**(User Review後に着手)。

---

## 1. 実際のAnalytics実装(実装監査)

- **使用サービス**: Google Analytics 4(GA4)。Google tag(gtag.js)、
  measurement ID `G-8GHH7JKZMB`。
- **実装箇所**: `index.html` のみ(1047-1053行目)。
  ```html
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-8GHH7JKZMB"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-8GHH7JKZMB');
  </script>
  ```
- **導入範囲(実地確認)**: リポジトリ内の`*.html`を機械的に走査した結果、
  `gtag`/`googletagmanager`を含むのは**ルート直下81ファイル中
  `index.html`の1件のみ**。`app-intro.html`・`app-details/`配下
  35ファイル・各学習/支援アプリ本体(`katakana-app.html`・
  `hiragana-learn.html`等)・`terms.html`はいずれも**GA未導入**。
- **結論**: Google Analyticsは「サイト全体」ではなく**トップページ
  (`index.html`)のみ**に限定して導入されている。同意取得(Cookie
  consent)の仕組みは実装されていない。
- **アクセス解析以外の解析手段**: 確認されず(広告配信・第三者
  トラッキングスクリプト等は見つからなかった)。

## 2. 学習記録(learningLog等)との区別

各学習アプリの`localStorage`/`IndexedDB`保存(ひらがな・カタカナの
なぞり記録、きょうのきろくの体調記録等)は、**アクセス解析とは完全に
別の仕組み**であり、以下の通り正しく区別されている。

- 学習記録: 各アプリ内でのみ完結、運営者・外部へは一切送信されない
  (T2/T3フェーズの実装調査で確認済みの`learningLog`/`addLog`の
  挙動と一致)。
- アクセス解析(GA): ページ閲覧・滞在時間等の統計情報を収集し、
  Googleのサーバーへ送信する。学習記録の**内容**(なぞり成績・
  体調記録の値そのもの)は収集対象ではない。

この区別自体は、site内の記述(後述)でも概ね正しく保たれている。

## 3. 現在のプライバシーポリシー現状(`index.html` `#privacySection`)

`index.html`内の折りたたみ式「プライバシーポリシー」セクション
(2109-2163行目、最終更新日2026年6月15日と明記)は、以下を含む
**充実した内容**である。

1. 運営者について(個人運営、教育・研究目的)
2. 収集する情報: お問い合わせフォーム(Formspree経由)・
   GitHub Pagesのサーバーログ・**Google Analyticsによる統計情報
   (Googleのサーバーへ送信される旨を明記)**
3. 収集しない情報: 広告配信なし、フォーム以外での個人情報収集なし
4. アプリ内写真・画像の取り扱い(端末内処理のみ)
5. アプリ内学習記録の取り扱い(端末内保存のみ)
6. お問い合わせ情報の利用目的
7. 外部サービス一覧とプライバシーポリシーへのリンク
   (Formspree・GitHub Pages・**Google Analytics(オプトアウト
   リンク付き)**)
8. ポリシー変更について
9. お問い合わせ

**この内容自体は実装と整合しており、正確である。** ただし
「本サイトでは...使用しており」という表現が、GAが実際には
トップページ限定であることを明示していない点は、より正確にできる
余地がある(Section 5参照、優先度は低い)。

## 4. 発見された矛盾

### 4.1 `index.html` 内の自己矛盾(最重要)

同一ページ(`index.html`)内に、以下の**直接矛盾する2つの記述**が
存在する。

- **2078行目**(「個人情報・写真の取り扱いについて」info-card、
  FAQ的な簡易案内):
  > 📌 本サイトは **GitHub Pages** を利用して公開しています。
  > アクセス解析や個人情報の収集は行っていません。

- **2124行目**(同じページの`#privacySection`、正式なプライバシー
  ポリシー本文):
  > **アクセス解析**：本サイトではGoogle Analytics（Google LLC）
  > を使用しており、訪問者数・閲覧ページ・滞在時間などの統計情報を
  > 収集しています。(中略)データはGoogleのサーバーに送信されます。

2078行目の文言は、同じファイルの1047-1053行目で実際にGoogle
Analyticsのタグが読み込まれている事実、および2124行目の自ドキュメント
内の記述と**直接矛盾する**。

### 4.2 `terms.html`(「ご利用にあたって」ページ)

`terms.html`(210-213行目)は、GA使用を正しく開示しており、
`index.html`の正式プライバシーポリシーと整合している。**矛盾なし。**

### 4.3 `apps-data.json`(きょうのきろくアプリの機能説明)

`apps-data.json`(2296行目、きょうのきろくの`features[].desc`):

> 入力したすべてのデータは端末内にのみ保存。サーバー送信・広告・
> 解析ツールは一切なし。

この文言は`generate.js`の`generateIntroCard()`/
`updateAppIntroHTML()`経由で`app-intro.html`へ、通常の詳細ページ
生成経由で`app-details/kyou-no-kiroku-detail.html`へそれぞれ
伝播している。

実地確認の結果、**この2ページ(`app-intro.html`・
`app-details/kyou-no-kiroku-detail.html`)にはGoogle Analyticsが
導入されていない**ため、「解析ツールは一切なし」という記述は
**このページ単体としては事実と矛盾しない**。ただし、
「解析ツールは一切なし」という表現がアプリ固有の記録データに
限定されず「サイト全体」であるかのように読める点はやや紛らわしく、
明確化の余地がある(優先度: 低)。

## 5. Contradiction Matrix

| 箇所 | 文言 | 分類 | 理由 |
|---|---|---|---|
| `index.html` 2078行目 | 「アクセス解析や個人情報の収集は行っていません」 | **B. 不正確** | 同一ページでGAが実際に稼働しており、同一ページの正式プライバシーポリシーとも矛盾する |
| `index.html` 2109-2163行目(`#privacySection`) | GA使用・データ送信先・Cookie・オプトアウト等を開示 | **A. 正確**(軽微な精度改善の余地あり) | 実装と整合。「本サイトでは」がGAの実際の導入範囲(トップページ限定)を明示していない点のみ要検討 |
| `terms.html` 210-213行目 | GA使用を開示 | **A. 正確** | 実装・プライバシーポリシーと整合 |
| `apps-data.json` 2296行目 / `app-intro.html` / `app-details/kyou-no-kiroku-detail.html` | 「解析ツールは一切なし」 | **A. 正確(該当ページ単体では)** / 表現はC寄り | 該当ページにGA未導入のため事実と矛盾しないが、範囲が曖昧で誤解を招きうる表現 |

**最優先で修正すべきはindex.html 2078行目の1文のみ。**

## 6. Source of Truth と生成物の関係

| 修正対象 | Source of Truth | 生成物 | 備考 |
|---|---|---|---|
| index.html 2078行目 | `index.html`(手書き、生成対象外) | なし(このファイル自体が最終出力) | `generate.js`の`skipFiles`に`index.html`が含まれ、生成処理の対象外であることを確認済み |
| index.html `#privacySection`の精度改善(任意) | 同上 | なし | 同上 |
| きょうのきろくの機能説明(任意) | `apps-data.json`(2296行目 `features[].desc`) | `app-intro.html`(`generateIntroCard`/`updateAppIntroHTML`経由)、`app-details/kyou-no-kiroku-detail.html`(通常の詳細ページ生成経由) | **`apps-data.json`を編集し、`node generate.js`を実行して伝播させる必要がある。`app-intro.html`や`app-details/*.html`を直接編集しても次回generate実行時に上書きされる** |

## 7. Production比較

`https://donomana.jp/index.html`・`https://donomana.jp/terms.html`を
直接取得し、リポジトリ版と完全一致(byte-identical)することを確認した。
Production固有の差異は存在しない。

## 8. 既知の関連事項(本Phaseのスコープ外)

`docs/donomana-site-renewal-roadmap-v2.md`(153行目)に、ルート直下の
`*-detail.html`重複29件・孤立学習アプリ5件が既に文書化されている
(例: `kyou-no-kiroku-detail.html`がルート直下と`app-details/`配下の
両方に存在し、内容にわずかな差異がある)。これはAnalytics/Privacy
表記の整合性とは無関係な、既知・別管理の技術的負債であり、本Phaseでは
対応しない。

## 9. 推奨修正方針(T4-B向け)

### 9.1 トップページ等の短い案内(最優先)

`index.html` 2078行目を、矛盾する断定を避け、詳細をプライバシー
ポリシーへ誘導する表現に置き換える。例:

> 📌 本サイトは **GitHub Pages** を利用して公開しています。
> アクセス解析・個人情報の取り扱いについては、下記の
> <a href="#privacySection">プライバシーポリシー</a>をご確認ください。

### 9.2 プライバシーポリシー本文の精度改善(任意・優先度低)

`#privacySection`の「アクセス解析」項目に、GAの導入範囲が
トップページに限定されている旨を一文追記できる(例:
「(Google Analyticsはトップページ(https://donomana.jp/)にのみ
設置しています)」)。必須ではないが、より正確になる。

### 9.3 きょうのきろくの機能説明(任意・優先度低)

`apps-data.json`の該当`desc`を、範囲をアプリの記録データに限定する
表現へ調整できる(例:「入力したすべての記録データは端末内にのみ
保存されます。サーバーへの送信は一切ありません。」— 「解析ツールは
一切なし」という曖昧な断定を避ける)。修正後は`node generate.js`を
実行し、`app-intro.html`・`app-details/kyou-no-kiroku-detail.html`
への伝播とidempotencyを確認する。

## 10. T4-B実装計画(提案)

単一の実装Phaseで完結可能と判断する。

1. `index.html` 2078行目の文言修正(Section 9.1、必須)
2. `index.html` `#privacySection`の精度改善(Section 9.2、任意)
3. `apps-data.json`のきょうのきろく`desc`修正 + `node generate.js`
   実行(Section 9.3、任意)
4. generate idempotency確認
5. Production未反映のままcheckpoint commit、User Review後にRelease

Phase T4-C等への追加分割は不要と判断する(範囲が限定的なテキスト
修正のみのため)。

## 11. 本Phaseで変更していないこと(明記)

- Google Analyticsの削除・設定変更: 行っていない
- Cookie consent機能の追加: 行っていない
- Analytics providerの変更: 行っていない
- PWA対応・学習記録機能改修・UI大規模変更: 行っていない
- Production HTML/JSの内容変更: 行っていない(本文書と調査記録のみ追加)

## 12. Phase Status

**Phase T4-A = ANALYTICS / PRIVACY DISCLOSURE AUDITED — READY FOR
CONSISTENCY FIX。** main merge/push/Production deployは行っていない。
