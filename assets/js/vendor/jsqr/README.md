# jsQR (vendored)

ローカル同梱したサードパーティ製QRコード**読み取り（デコード）**専用ライブラリ
（DONOMANA-REGISTER-QR-PHASE-3-3）。QR生成には使わない（生成は
`assets/js/vendor/qrcode-generator/`、Phase 3-2で別途同梱済み）。

- ライブラリ名: `jsqr`（npm）/ `jsQR`（GitHub, グローバル関数名も`jsQR`）
- 採用バージョン: `1.4.0`
- ライセンス: Apache License 2.0（`LICENSE.txt`に全文を同梱）
- 公式配布元（npm）: https://www.npmjs.com/package/jsqr
- 公式リポジトリ（GitHub）: https://github.com/cozmo/jsQR
- 取得方法: npmレジストリ（`https://registry.npmjs.org/jsqr/-/jsqr-1.4.0.tgz`）から
  取得したtarballの `package/dist/jsQR.js`（webpack UMDビルド、`window.jsQR`として
  グローバル公開）を、改変せずそのまま配置した。`LICENSE.txt`も同tarball内の
  `package/LICENSE`をそのまま配置した。
- ランタイム依存: ゼロ（カメラ制御・UIは含まない。デコード関数のみを提供する）。

## このアプリでの使用方法

`register-app.html`から`<script src="assets/js/vendor/jsqr/jsQR.js"></script>`で
読み込み、グローバル関数 `jsQR(imageData, width, height)` を呼び出して使用する
（register-app.html側の`decodeQrFrame()`参照）。カメラ映像の取得・制御（`getUserMedia`）
・デコードループのタイミング制御（デバウンス等）はjsQR自体の機能ではなく、
register-app.html側で実装している。外部CDN・オンラインQR読み取りAPIは一切使用して
いない（追加の有料API・サブスクも不要）。

## 配布時の注意

このディレクトリを変更・更新する場合は、上記の公式配布元から同じ手順で取得し、
`jsQR.js`と`LICENSE.txt`をセットで更新すること。
