# どのまな「さわってひろがる」固定Preview Allowlist拡張 — 設計文書（Version 1.0）

- 版: v1.0
- 発行: 2026年10月2日（Phase SAWATTE-TRACE-DEFAULT-ON-REVIEW-AND-PREVIEW-DESIGN-1）
- 位置づけ: `sawatte-hirogaru-app.html`（軌跡記録の初期値ON化・設定保存失敗通知の修正を含む）を、CLAUDE.md §12 固定Preview（User Browser Review）で実機確認できるようにするための、`education-tools-hash/education-tools-hash.github.io` の `.github/workflows/preview-sync.yml` 最小diff設計。
- baseline: Preview repo `main` = `2b5895057338184cb3def987e13787ac6e269379`（本Phase開始時にfresh取得、読み取りのみで確認）
- 本Phaseのスコープ: **設計のみ。`preview-sync.yml` の編集・コミット・push・workflow dispatchはいずれも行っていない。** 実際の変更はPreview repo側の別Phase（Governance上の「固定Preview workflowの編集・dispatch」の承認が別途必要）に委ねる。

---

## 1. 現状（fresh mainから直接確認した事実）

`preview-sync.yml`（`main` @ `2b58950`）の現在のallowlistは次の7アプリ＋4本のJSファイル＋3本の共通アイコンのみ：

```
schedule-app.html, timetable-app.html, cup_game.html, directions-app.html,
ongaku-app.html, sst-app.html, learning-records.html
assets/js/directions-record-detail.js
assets/js/sst-record-detail.js
assets/js/record-dashboard-foundation.js
assets/js/record-dashboard-ui.js
favicon.png, favicon.svg, apple-touch-icon.png
```

この4箇所（"Build preview artifact"のcp列、`preview-manifest.json`生成の`syncedFiles`配列、Preview `index.html`生成の`<ul>`リンク一覧の3箇所は実質同一リストの重複）に、新しいファイルを追加する形でのみ拡張する。ワイルドカード／全コピーへの変更は行わない（CLAUDE.md §12「明示的な許可リストのみ」）。

`sawatte-hirogaru-app.html` は現在このallowlistに**一切含まれていない**。

## 2. `sawatte-hirogaru-app.html` が実際に参照するローカルファイル（実コードで確認）

```html
<script src="assets/js/record-trace-renderer.js"></script>
<script src="assets/js/sawatte-hirogaru-record-detail.js"></script>
<link rel="icon" href="/favicon.ico">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

（スタイルシートは全てインライン。外部/CDN URLなし。）

## 3. 既存のPreview自体にすでにあるギャップ（本Phase起因ではないが、今回の調査で判明）

`learning-records.html` はすでにPreviewのallowlistに含まれ配信されているが、その実コードは次の2本を無条件に読み込んでいる（`learning-records.html` 412–414行目、コメント "Sawatte Reference Implementation"）：

```html
<script src="assets/js/record-trace-renderer.js"></script>
<script src="assets/js/sawatte-hirogaru-record-detail.js"></script>
```

このどちらも現在のallowlistに含まれていない。つまり、`sawatte-hirogaru-app.html` 自体を追加するかどうかに関係なく、**現在デプロイされているPreviewの `learning-records.html` はこの2本のJSが404になっている状態**（共通「学習の記録」画面でさわってひろがるの記録を軌跡付きで表示しようとした場合にのみ影響し、他の6アプリの記録表示は個別のadapterファイルで完結するため無関係）。本Phaseはこの既存ギャップを作り込んでいないが、放置すると次にlearning-records.html側でさわってひろがるの記録を確認しようとした時に無言で失敗する。

## 4. 追加が必要な最小ファイル一覧

| ファイル | 種別 | 必須/任意 | 理由 |
|---|---|---|---|
| `sawatte-hirogaru-app.html` | 本体HTML | **必須** | Preview実機確認の対象そのもの |
| `assets/js/record-trace-renderer.js` | JS | **必須** | sawatte-hirogaru-app.html自身の軌跡検証/描画と、learning-records.htmlの共通Detail統合の両方が読み込む（§3のギャップも同時に解消） |
| `assets/js/sawatte-hirogaru-record-detail.js` | JS | **必須** | 同上（sawatte専用の記録詳細ロジック。learning-records.htmlも既に読み込んでいる） |
| `favicon.svg` | アイコン | 任意（追加不要） | 既にallowlistに存在する共通アイコンで足りる |
| `apple-touch-icon.png` | アイコン | 任意（追加不要） | 同上 |
| `favicon.ico` | アイコン | **任意** | 他の7アプリも現状未同期（既存の一貫したギャップ）。無くてもブラウザタブの見た目が欠けるだけで、レビュー自体は妨げない |
| `favicon-32.png` / `favicon-16.png` | アイコン | **任意** | 同上 |
| `site.webmanifest` | PWA manifest | **任意** | 他の7アプリ（learning-records.html含む）も現状未同期。Preview環境でPWAインストール/ホーム画面機能を確認する想定はない（CLAUDE.md §5がそもそも実機Production/Home Screen確認が必要な領域と明記） |
| Service Worker登録 | — | **追加しない** | `preview-sync.yml` には現状どのapp向けのService Worker登録ステップも存在しない。今回の最小diffでも新設しない — オフライン/PWAキャッシュの実機確認はPreviewの対象外（CLAUDE.md §5） |

**結論: 3ファイル（本体HTML 1本＋JS依存2本）の追加のみで、`sawatte-hirogaru-app.html` のPreview実機確認と、既存のlearning-records.htmlの404ギャップ解消の両方を満たす。** favicon/manifest/Service Workerはいずれも既存7アプリとの整合を保つため、意図的に対象外とする。

## 5. 具体的な最小diff案（実装Phaseでそのまま使える形）

### 5.1 "Build preview artifact" ステップのcp列に追加

```bash
cp source/sawatte-hirogaru-app.html                    dist/
cp source/assets/js/record-trace-renderer.js            dist/assets/js/
cp source/assets/js/sawatte-hirogaru-record-detail.js   dist/assets/js/
```

### 5.2 `preview-manifest.json` 生成ステップの `syncedFiles` 配列に追加

```json
"sawatte-hirogaru-app.html",
"assets/js/record-trace-renderer.js",
"assets/js/sawatte-hirogaru-record-detail.js"
```

### 5.3 Preview `index.html` 生成ステップの `<ul>` に追加

```html
<li><a href="sawatte-hirogaru-app.html">sawatte-hirogaru-app.html</a></li>
```

### 5.4 cp列／syncedFiles／index.htmlリンクの一致確認

上記3箇所は常に同じファイル集合を指すべきという既存の設計原則（CLAUDE.md §12 "What a Preview deploy may contain"）に従い、3箇所とも同一の3ファイルを追加するのみで、既存7アプリ分の記述には一切手を加えない。

## 6. この設計が変更しないもの

- `preview-sync.yml` の `on:`/`permissions:`/`concurrency:`/Pages deploy関連のステップ — 無変更
- 既存7アプリのcp行・syncedFiles・indexリンク — 無変更
- Service Worker・オフラインキャッシュ・manifest関連の新規ステップ — 追加しない
- ソースファイル自体（`sawatte-hirogaru-app.html` 等）はPreview側でも一切改変せず、byte-for-byteコピーのまま配信する（CLAUDE.md §12既定方針を踏襲）

## 7. 実装Phaseで必要な手順（本Phaseでは実施しない）

1. Preview repo `main` のfresh Drift Gate
2. Preview repo専用branch/worktree作成
3. 本文書§5のdiffを `preview-sync.yml` に適用
4. 構文検証（YAML lint相当）・ローカルdry-run相当の確認
5. checkpoint commit → 専用branchへpush → Preview `main` へのマージ（別途ユーザー承認必須）
6. `workflow_dispatch` で `source_ref` に本Phaseのsource repo側checkpoint full SHAを指定して実行
7. `preview-manifest.json` の `sourceCommit`・`syncedFiles`、Pages deploy成功、`sawatte-hirogaru-app.html` と `learning-records.html` 双方の実配信を確認
8. ユーザーへiPhone等で開けるPreview URLと確認手順を提示

いずれもCLAUDE.mdの「固定Preview workflowの編集・dispatchは行わないでください」という本Phaseの明示的境界に従い、**本Phaseでは未実施**。
