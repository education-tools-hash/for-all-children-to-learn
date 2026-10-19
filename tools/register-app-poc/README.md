# tools/register-app-poc/

「はんばいかい レジ」（`register-app.html`）のQR機能追加に先立って整備した
既存機能のベースライン回帰テストと、QR機能自体のテスト一式。

- DONOMANA-REGISTER-QR-PHASE-3-1-BASELINE-TESTS-1：既存機能のベースライン回帰テストを新設。
- DONOMANA-REGISTER-QR-PHASE-3-1B-SHARE-URL-FIX-1：共有URLの不具合を最小修正し、回帰テストを拡張。
- DONOMANA-REGISTER-QR-PHASE-3-2-QR-GENERATION-1：商品QRコードの発行・表示・印刷機能を追加し、
  QR専用のテスト（生成・ペイロード検証・印刷統合・ライセンス同梱確認）を追加。
  カメラ読み取り・QRレジモード・台帳同期QRはまだ実装していない。

対象アプリ: `../../register-app.html`。商品登録・カート・会計・共有・設定・アクセシビリティ・
CSV出力・QR発行が現在どう動くかを固定した、以後の機能追加（カメラ読み取り等）に対する
回帰検出の基準とする。

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

### 追加の依存（Phase 3-2: QR自己往復テスト用、テスト専用）

QRコードの自己往復テスト（生成→実際にデコードして商品IDと一致するか確認）では、
生成側ライブラリ（`assets/js/vendor/qrcode-generator/`、`register-app.html`にのみ同梱）
とは完全に独立したデコーダとして `opencv-python-headless`（OpenCV、MITライセンス、
`cv2.QRCodeDetector`）を使う：

```bash
pip install opencv-python-headless
```

これは**テスト実行環境だけに必要な依存**であり、`register-app.html`には一切同梱・
読み込みされない。アプリ本体の「追加の有料API・サブスク禁止」方針とは無関係の、
テストツール側のローカルOSSライブラリである（Playwright自体も同様にテスト専用の
依存）。

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
| QRコード生成（Phase 3-2） | 商品ごとのQR生成・ペイロードとID一致・名前/価格が含まれない・複数商品・モーダル開閉・編集後も同一ID・削除後のQR発行不可 |
| QRモーダルは既存モーダルより危険を増やしていないことの確認（Phase 3-2） | （ユーザー指示：QRモーダルが既存の構造的課題を悪化させていないことの確認） |
| QR印刷統合（Phase 3-2） | 既存印刷機能の維持・QR一覧印刷の内容（カード/リスト両形式） |
| ライセンス同梱確認（Phase 3-2） | qrcode-generatorのLICENSE.txt同梱・著作権表示 |

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

## QRコード発行機能（Phase 3-2）

商品編集モード中、商品カードの編集オーバーレイに「🔳」ボタンを追加した
（`register-app.html`の`.edit-overlay`、既存の✏️/🗑️と同じ`.edit-btn-small`クラス）。
タップすると商品名・価格・QRコード（SVG）を表示するモーダル（`#qr-modal`）が開く。

- QRペイロードは `DMREG1:<商品ID>` のみ（商品名・価格は含めない、Phase 2設計方針どおり）。
- QR生成は`assets/js/vendor/qrcode-generator/`にローカル同梱した`qrcode-generator`
  v2.0.4（MIT License, Copyright (c) 2009 Kazuhiko Arase, 配布元:
  https://github.com/kazuhikoarase/qrcode-generator）を使用。外部CDN・オンラインAPIは
  一切使用しない。
- 既存の印刷モーダルに「QRコードを表示する」チェックボックス（既定OFF、既存の印刷
  出力に影響しない）を追加し、商品一覧のカード形式・一覧形式の両方でQRを印刷できる。
  QRモーダル自体にも「このQRを印刷」ボタンがあり、単体でも印刷できる。
- 不正な/削除済みの商品IDで`openQrModal()`を呼んでもクラッシュせず、わかりやすい
  トースト通知を表示してモーダルは開かない（実装D）。
- 商品名はすべて`textContent`相当のエスケープ処理（既存の`esc()`ヘルパー）を経て
  表示し、HTMLインジェクションを許さない。
- 商品を削除して登録し直すと（`uid()`が新しいIDを発行するため）印刷済みQRが無効に
  なる旨をヘルプ（「🔳 QRコード」タブ）に明記した。

## 実行結果（PASS/FAIL）について

Phase 3-2での最新の実行結果は **PASS: 144　FAIL: 1**。このFAILは意図的・既知のもので、
隠さずそのまま報告している。

**「既知の構造的課題の確認」グループ1件（Phase 2設計調査で既発見、本Phaseでは
対象外）** — `register-app.html`のモーダル実装（`openModal`/`closeModal`）は背景を
`inert`化しないため、開いているモーダルの外にあるスイッチスキャン対象
（ヘッダーアイコンや商品カード等）も選択可能なままになる。DONOMANA-REGISTER-QR-
PHASE-2-DESIGN-1 §8で文書化済みの既存の構造的限界であり、本Phaseでもモーダル
基盤そのものを修正しない方針のため、意図的にFAILのまま報告している。新設した
QRモーダル（`#qr-modal`）がこの既存の問題を悪化させていないことは、別テスト
「QRモーダルは既存モーダルより危険を増やしていないことの確認」で、同一条件下の
product-modalとqr-modalの漏れ集合が完全に一致することを確認してPASSしている。

Phase 3-1で発見した共有URLの不具合はPhase 3-1Bで修正済みのため、対応するテストは
全てPASSへ反転した（日本語・絵文字入り・`+`/`=`/`&`を含む商品名、複数商品、
不正な共有データでのクラッシュ耐性、旧形式URLとの後方互換性を含む、拡張済みの
回帰テストで確認）。

これら以外のFAILが将来の実行で発生した場合は、新たな回帰として調査が必要。
