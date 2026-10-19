# qrcode-generator (vendored)

ローカル同梱したサードパーティ製QRコード生成ライブラリ（DONOMANA-REGISTER-QR-PHASE-3-2）。

- ライブラリ名: `qrcode-generator`
- 採用バージョン: `2.0.4`
- ライセンス: MIT License（`LICENSE.txt`に全文を同梱）
- 著作権者: Copyright (c) 2009 Kazuhiko Arase
- 公式配布元（npm）: https://www.npmjs.com/package/qrcode-generator
- 公式リポジトリ（GitHub）: https://github.com/kazuhikoarase/qrcode-generator
- 取得方法: npmレジストリ（`https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz`）
  から取得したtarballの `package/dist/qrcode.js` を、改変せずそのまま配置した。
- `LICENSE.txt` は公式リポジトリの `LICENSE` ファイル
  （`https://raw.githubusercontent.com/kazuhikoarase/qrcode-generator/master/LICENSE`）を
  そのまま配置した（npmパッケージ自体にはLICENSEファイルが同梱されていないため）。

## このアプリでの使用方法

`register-app.html`から`<script src="assets/js/vendor/qrcode-generator/qrcode.js"></script>`で
読み込み、グローバル関数 `qrcode(typeNumber, errorCorrectionLevel)` を呼び出して使用する
（register-app.html側の`buildQrSvgForProduct()`参照）。外部CDN・オンラインQR生成APIは
一切使用していない（追加の有料API・サブスクも不要）。

## 配布時の注意

このディレクトリを変更・更新する場合は、上記の公式配布元から同じ手順で取得し、
`qrcode.js`と`LICENSE.txt`をセットで更新すること。ライブラリ本体のファイル内にも
著作権・ライセンスのヘッダーコメントが含まれている（削除しないこと）。
