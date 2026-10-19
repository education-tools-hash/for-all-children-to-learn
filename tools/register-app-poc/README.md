# tools/register-app-poc/

「はんばいかい レジ」（`register-app.html`）のQR機能追加（DONOMANA-REGISTER-QR-PHASE-2
以降）に先立って整備した、既存機能のベースライン回帰テスト一式
（DONOMANA-REGISTER-QR-PHASE-3-1-BASELINE-TESTS-1、
DONOMANA-REGISTER-QR-PHASE-3-1B-SHARE-URL-FIX-1で共有URLの不具合修正に伴い拡張）。

対象アプリ: `../../register-app.html`。QRコード生成・読み取り機能はまだ実装していない。
ここにあるのは、既存の商品登録・カート・会計・共有・設定・アクセシビリティ・CSV出力が
現在どう動くかを固定した、QR実装後の回帰検出の基準（ベースライン）専用のテストである。
**Phase 3-1BでのみアプリのロジックにPhase 3-1で発見した不具合の最小修正を1件加えた
（`openShareModal()`の共有URL生成部分、詳細は下記）。**それ以外、アプリ本体の仕様は
変更していない。

## 実行方法

```bash
python3 tools/register-app-poc/register-app-realbrowser-test.py
```

既存の `tools/donomana-access-poc/donomana-access-realbrowser-test.py` と同じ慣習
（Playwright + Chromium、`file://`でHTMLを直接開く）に従う。

`register-app.html`はロジックを別ファイル（`assets/js/*.js`）に切り出していない
（DOM非依存の純粋ロジック・モジュールが存在しない、アプリ本体は変更しない方針の
ため本Phaseでも切り出しは行っていない）。そのため、`donomana-access-poc`や
`record-dashboard-poc`にある「Node.js golden tests（純粋ロジック単体テスト）」は
本ディレクトリには存在しない。実ブラウザでのUI操作による検証のみで構成している。

### 実行環境に関する注意（この実行環境固有）

このCloudセッションの実行環境では、Playwright Python (`pip` 管理) が解決しようとする
既定のChromiumリビジョンと、`/opt/pw-browsers/`に事前配置されたChromiumのリビジョンが
一致せず、`playwright install`も実行できない（環境の方針）。本テストは
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`環境変数が設定されていれば、そのパスの
Chromium実行ファイルを明示的に使う（未設定時は通常のPlaywrightの既定解決に任せる）。
このCloud環境でこのテストを実行する場合の例：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-<リビジョン>/chrome-linux/chrome \
  python3.13 tools/register-app-poc/register-app-realbrowser-test.py
```

（このセッションでは`python3`の既定が3.11でPlaywrightパッケージ未インストール、
`python3.13`に`pip install playwright`済みの状態だったため`python3.13`を使用した。
通常の開発環境では`pip install playwright && playwright install chromium`を行った上で
`python3 tools/register-app-poc/register-app-realbrowser-test.py`で足りる。）

## データ分離・既存データへの影響

各テストはPlaywrightが起動する使い捨てのheadless Chromiumプロファイル内の、
独立したbrowser contextで実行される。実際の利用者のブラウザ・実際の端末の
localStorageには構造的に一切アクセスしない（本番の商品データ・会計記録に触れる
ことはあり得ない）。テストデータ（`テスト商品`, `=SUM(A1)`等）も各テスト内の
使い捨てcontext内でのみ存在する。

## カバー範囲（DONOMANA-REGISTER-QR-PHASE-3-1の必須テスト14項目 + 構造的課題確認）

| グループ | 対応する必須テスト項目 |
|---|---|
| 1. 商品登録・編集・削除 | 1 |
| 2〜8. カート追加〜会計完了（一連の買い物フロー） | 2,3,4,5,6,7,8 |
| 9〜10. 商品リスト共有URL・商品IDの保持・画像の取り扱い | 9,10 |
| 11. 設定の保存・復元 | 11 |
| 12. 既存アクセシビリティ設定 | 12 |
| 13. CSV Formula Injection対策 | 13 |
| 14. 既存機能の基本的なキーボード操作 | 14 |
| 既知の構造的課題の確認 | （ユーザー指示：モーダル/スイッチスキャンの構造的問題を確認するテストを追加） |

## 共有URLの不具合修正（Phase 3-1B）

Phase 3-1は「9〜10」グループで、`register-app.html`の`openShareModal()`
（L1992/L1995）がbase64文字列を`encodeURIComponent()`せずそのままURLへ連結しており、
日本語の商品名を含むbase64には高確率で`+`が含まれ、受信側`loadSharedProducts()`
（L2033）の`URLSearchParams.get('products')`が仕様上`+`を空白へ変換してしまうため
`atob()`が例外を投げて読み込みに失敗する、という不具合をFAILとして記録していた。

Phase 3-1BはこれをL1995の1行のみの最小差分で修正した：

```diff
- const url=`${location.origin}${location.pathname}?products=${encoded}`;
+ const url=`${location.origin}${location.pathname}?products=${encodeURIComponent(encoded)}`;
```

`loadSharedProducts()`（デコード側）は変更していない。`URLSearchParams.get()`は
受け取った値を自動的にパーセントデコードするため、エンコード側だけを直すことで
対応する。既存の（たまたま`+`を含まない）共有URLとの後方互換性も保たれる。

## 実行結果（PASS/FAIL）について

Phase 3-1Bでの最新の実行結果は **PASS: 111　FAIL: 1**。このFAILは意図的・既知のもので、
隠さずそのまま報告している。

**末尾の「既知の構造的課題の確認」グループ1件（Phase 2設計調査で既発見、本Phaseでは
対象外）** — `register-app.html`のモーダル実装（`openModal`/`closeModal`）は背景を
`inert`化しないため、開いているモーダルの外にあるスイッチスキャン対象
（ヘッダーアイコンや商品カード等）も選択可能なままになる。DONOMANA-REGISTER-QR-
PHASE-2-DESIGN-1 §8で文書化済みの既存の構造的限界であり、本Phaseではモーダル
基盤そのものを修正しない方針のため、意図的にFAILのまま報告している。

Phase 3-1で発見した共有URLの不具合は本Phaseで修正済みのため、対応するテストは
全てPASSへ反転した（日本語・絵文字入り・`+`/`=`/`&`を含む商品名、複数商品、
不正な共有データでのクラッシュ耐性、旧形式URLとの後方互換性を含む、拡張済みの
回帰テストで確認）。

これら以外のFAILが将来の実行で発生した場合は、新たな回帰として調査が必要。
