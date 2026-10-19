# tools/register-app-poc/

「はんばいかい レジ」（`register-app.html`）のQR機能追加（DONOMANA-REGISTER-QR-PHASE-2
以降）に先立って整備した、既存機能のベースライン回帰テスト一式
（DONOMANA-REGISTER-QR-PHASE-3-1-BASELINE-TESTS-1）。

対象アプリ: `../../register-app.html`。本Phaseでは**アプリ本体は変更していない**
（QRコード生成・読み取り機能もまだ実装していない）。ここにあるのは、既存の
商品登録・カート・会計・共有・設定・アクセシビリティ・CSV出力が現在どう動くかを
固定した、QR実装後の回帰検出の基準（ベースライン）専用のテストである。

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

## 実行結果（PASS/FAIL）について

最新の実行結果は **PASS: 100　FAIL: 2**。この2件のFAILは両方とも意図的・既知のもので、
隠さずそのまま報告している（詳細はDONOMANA-REGISTER-QR-PHASE-3-1の報告書§4/§5、
および各テストのコード内コメントを参照）。

1. **「9〜10」グループの共有URL関連1件（新たに発見した既存の不具合）** —
   `register-app.html`の`openShareModal()`（L1992/L1995）が、base64文字列を
   `encodeURIComponent()`せずそのままURLへ連結している。日本語の商品名を含む
   base64エンコード結果には高確率で`+`が含まれ、受信側`loadSharedProducts()`
   （L2033）が`URLSearchParams.get('products')`で読む際に`+`が仕様上空白へ変換
   されてしまうため、`atob()`が例外を投げて読み込みに失敗する。アプリが実際に
   生成した共有URLをそのまま使うと、ほぼ必ず失敗する（確率的な問題ではなく、
   日本語商品名を含む限りほぼ常に再現する）。このテストグループでは、
   (a) アプリが実際に生成するURLそのままでの失敗を記録し、(b) 本テストスクリプト側
   でURLをペイロードだけ正しく`encodeURIComponent()`し直した場合は、ID保持・
   画像null化・localStorage永続化のすべてが正しく動くことを別途確認しており、
   不具合の原因がURL構築部分のみであることを切り分けている。
   **register-app.html自体は本Phaseでは変更していない**（テスト対象の仕様を
   無断変更しない方針のため）。
2. **末尾の「既知の構造的課題の確認」グループ1件（Phase 2設計調査で既発見）** —
   `register-app.html`のモーダル実装（`openModal`/`closeModal`）は背景を
   `inert`化しないため、開いているモーダルの外にあるスイッチスキャン対象
   （ヘッダーアイコンや商品カード等）も選択可能なままになる。DONOMANA-REGISTER-QR-
   PHASE-2-DESIGN-1 §8で文書化済みの既存の構造的限界であり、本Phaseではモーダル
   基盤そのものを修正しない方針のため、意図的にFAILのまま報告している。

これら2件以外のFAILが将来の実行で発生した場合は、新たな回帰として調査が必要。
