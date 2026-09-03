# どのまな PWA Architecture & Offline Strategy 設計文書（Version 1.0）

Phase T9-A（Audit & Design Only、実装なし）。目的は「どのまな」全体を無条件にofflineへ固定することではなく、通信が不安定な学校現場で、ホーム画面追加・起動体験・必要な範囲でのoffline利用を安全に実現すること。Service Worker実装・manifest本番追加・cache API書込みは本Phaseでは一切行わない。

関連文書: [[donomana-storage-architecture-v2_0]]（localStorage/IndexedDBの保存基盤。本文書はPWA cache層を扱い、保存データそのものは扱わない）、[[donomana-supporter-record-dashboard-design-v1_0]]（「学習のきろく」、§23で参照）

---

## 0. 目的（再掲・確定）

目的: ホーム画面追加の容易化、教材アクセスの簡易化、通信不安定校内環境での利用継続、起動体験改善、必要範囲でのoffline利用。

目的でないもの: サイト全体の無条件永久cache、全画像・全音声の初回download、更新の遅延、Cloud sync、Login、User tracking。本文書の全設計判断はこの境界線を踏まえる。

---

## 1. Baseline

- Production: `main = origin/main = b9d9f70`（T8-C Production Released / T8-B CLOSED）
- Worktree: `for-all-children-to-learn-t9a-pwa-architecture`
- Branch: `docs/pwa-architecture-t9a`
- 本Phase: docs-only。service-worker.js・manifest本番追加・registerServiceWorker実装・cache API書込み・navigation変更・Changelog・main merge・push・deployのいずれも行わない。

---

## 2. 既存PWA実装監査（§5、最重要の発見）

repo全体をgrep調査した結果:

| 項目 | 結果 |
|---|---|
| `service-worker`/`sw.js`/`navigator.serviceWorker`/`CacheStorage`/`caches.open`/`beforeinstallprompt`/`display-mode` | **0件（リポジトリ全体で完全未使用）** |
| `manifest.json`/`manifest.webmanifest`という文字列 | `donomana-storage-architecture-v2_0.md`内の1件のみ（「Service Worker／CacheStorageは未使用」という既存調査結果の記述） |
| **`site.webmanifest`ファイル自体** | **既に存在する**（`/site.webmanifest`、312バイト） |

### 2.1 既存`site.webmanifest`の内容（確定事実）

```json
{
  "name": "どのまな",
  "short_name": "どのまな",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#00A99D",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

`start_url`・`scope`が**未定義**。`icons`に`purpose`指定なし。

### 2.2 既存の冪等注入基盤（`generate.js` `injectFavicon()`、重要な既存資産）

`generate.js`は既に、`<!-- favicon: 自動挿入 (generate.js) -->` 〜 `<!-- /favicon -->` というマーカーコメントで囲んだブロックを冪等注入する仕組みを持っている（`injectFavicon()`関数、5箇所から呼び出し）。このブロックには以下が含まれ、`<link rel="manifest">`と`theme-color`は**既にこの仕組みで注入済み**:

```html
<!-- favicon: 自動挿入 (generate.js) -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#00A99D">
<!-- /favicon -->
```

同様に「🏠 ホームボタン」も`<!-- home-btn: 自動挿入 (generate.js) -->`マーカーで冪等注入されている（`injectFaviconToAppHtmls()`/`injectHomeButtonToAppHtmls()`相当、35アプリの34本に適用済み）。

**この2つの既存機構は、T9-Bで「Service Worker登録scriptタグ」を全ページへ冪等注入する際にそのまま転用できるパターンとして極めて重要**（§19で再述）。architecture Bは既にこの意味で"半分実装済み"と言える。

### 2.3 カバレッジの実態（manifest link）

`site.webmanifest`をlinkしているファイル: **67 / 82 root HTML**（index.html＋35アプリ＋35 app-details）。

**linkしていない15ファイル**:

| 分類 | ファイル |
|---|---|
| 静的/ガイド/ポリシーページ（本物のProductionページ、injectFavicon対象外） | `about.html` `philosophy.html` `terms.html` `wizard.html` `home-screen-guide.html` `404.html` |
| **T8-B2で新規公開したばかりの本物のProductionページ（見落とし）** | **`learning-records.html`** |
| 非公開/孤立ページ（`SITEMAP_EXCLUDE`相当、apps-data.json未登録） | `app-register.html` `cooking.html` `meeting-notes-app.html` `shisen.html` `sugoroku-online.html` `switch-training-app.html` `donomana-design-system-v2_0.html` `googlec01fd6375de401c5.html`（Google Search Console検証ファイル） |

**発見（T9-B候補）**: `learning-records.html`にmanifest/favicon自動注入ブロックが入っていない。T8-B2時点ではPWA整備前だったため見落としではなく単純に対象外だったが、静的ページ6件と合わせて「injectFaviconの対象範囲を静的ページ＋learning-records.htmlへ広げる」ことがT9-Bでの低リスクな最初の一手になる。

---

## 3. Site Inventory（§4）

| 分類 | 件数 | 備考 |
|---|---|---|
| 教材アプリ本体（apps-data.json） | 35 | `node -e apps-data.json.length` で確認 |
| アプリ詳細ページ（`app-details/*.html`） | 35 | generate.js自動生成、手編集禁止 |
| トップページ | 1 | `index.html` |
| Supporter Platform Feature | 1 | `learning-records.html`（apps-data.json未登録、§16のT8-C Decisionを維持） |
| Guide/Policyページ | 6 | `about.html` `philosophy.html` `terms.html` `wizard.html` `home-screen-guide.html` `switch-gaze-guide.html` |
| エラーページ | 1 | `404.html` |
| 非公開/孤立ページ（sitemap除外・apps-data.json未登録） | 8 | `app-register.html` `cooking.html` `meeting-notes-app.html` `shisen.html` `sugoroku-online.html` `switch-training-app.html` `donomana-design-system-v2_0.html` `googlec01fd6375de401c5.html` |
| root HTML合計 | 82 | |
| app-details込みHTML合計 | 119 | (`find . -name "*.html"`) |

**PWA scope方針（第一候補）**: precache/manifest対象は「35アプリ＋index.html＋Supporter Feature＋Guide/Policyページ」のみ。app-detailsページ（SEO専用、教材本体への入口でしかない）と非公開/孤立ページはPWA scope外とする（§54とも整合）。

---

## 4. Asset Inventory（§6-7）

リポジトリ全体（`.git`除く）: **約46MB**。

| 拡張子 | 件数 | 合計サイズ |
|---|---|---|
| `.png` | 279 | 約35.06MB（**全体の約76%**） |
| `.html` | 119 | 約8.53MB |
| `.md` | 32 | 約1.58MB |
| `.js` | 46 | 約0.79MB |
| `.json` | 17 | 約0.40MB |
| `.py` | 17 | 約0.17MB |
| `.svg` | 5 | 約0.12MB |
| audio（mp3/wav/ogg/m4a/webm/aac） | **0** | リポジトリ内に静的音声ファイルは存在しない |

### 4.1 最大ファイル(上位、Multi-Input系画像が突出)

| ファイル | サイズ |
|---|---|
| `assets/miru-hirogaru/piano-active.png` | 約1.89MB |
| `assets/miru-hirogaru/piano-ready.png` | 約1.62MB |
| `assets/dotchiga-ii/cat.png` | 約1.40MB |
| `assets/dotchiga-ii/dog.png` | 約1.28MB |
| `assets/dotchiga-ii/apple.png` | 約1.13MB |
| `assets/junban-miyou/passengers/dog.png`等5点 | 約0.5〜0.7MB each |
| `sst-app.html`（HTML自体） | 約445KB |
| `bosai-app.html`（HTML自体） | 約350KB |
| `assets/mockups/*.png`（OGP画像、35アプリ分） | 各約200〜350KB |

sst-app.html/bosai-app.htmlの大きさはbase64埋め込みではなく、機能量（教員向けエディタ・分岐ストーリー等）そのものによるもの（`data:image`/`data:audio`はいずれも0件）。

**結論（§7）**: Multi-Input系（miru-hirogaru-app・dotchiga-ii-app・junban-miyou-app）と35アプリ分のmockup画像だけで数MB〜十数MBに達する。**全35アプリ・全assetのinstall時precacheは、学校の低速回線での初回install体験を著しく悪化させるため禁止**（§9の結論と直結）。

---

## 5. Network Dependency Inventory（§25-26）

### 5.1 外部依存の実態（grep調査で確定）

| 依存先 | 使用箇所 | 性質 |
|---|---|---|
| Google Fonts (`fonts.googleapis.com`/`fonts.gstatic.com`) | 全ページ共通 | CSS2 API、`display=swap`指定済み(**既に取得失敗時もsystem fontへ即fallbackする設計**、offline時の見た目劣化のみで機能停止なし) |
| Google Analytics | `index.html`のみ | 既存Privacy Policy記載どおりトップページ限定 |
| Formspree（お問い合わせフォーム） | `index.html` | フォーム送信機能自体が本来的にオンライン専用 |
| **`https://education-tools-hash.github.io/hiragana-audio/`（別リポジトリのGitHub Pages、cross-origin）** | **`hiragana-learn.html`・`katakana-app.html`** | **発音読み上げ音声(.mp3)を都度fetch。offline時はこの2アプリの音声再生機能のみ失敗する** |
| `https://sst-api.YOUR-SUBDOMAIN.workers.dev`（未設定プレースホルダー） | `sst-app.html` | AIコンテンツ生成機能用、現状未設定のためそもそも到達しない。将来設定されてもオンライン専用機能として扱う |
| `https://api.anthropic.com/v1/messages` | `meeting-notes-app.html` | **apps-data.json未登録の非公開プロトタイプ。PWA scope外** |

### 5.2 Offline Capability分類（§25、35アプリ）

| 分類 | 該当 | 理由 |
|---|---|---|
| **Yes（完全offline可）** | 33アプリ（35 − hiragana-learn − katakana-app） | 外部fetchなし。record保存はlocalStorage/IndexedDBのみ |
| **Partial（一部機能のみ制限）** | hiragana-learn・katakana-app | HTML/JS自体はoffline動作可能。発音読み上げ(.mp3)のみcross-origin音声取得に失敗し無音になる（クラッシュはしない想定、要T9-B実機確認） |
| **No（offline非対応）** | なし（35アプリ中） | — |
| **PWA scope外** | `meeting-notes-app.html`（非公開プロトタイプ、外部API必須） | apps-data.json未登録 |

sst-appは「AI生成機能のみオンライン必須、既存のロールプレイ/クイズ等コア機能はlocalStorageのみでoffline動作可能」というPartial扱い（Yes/Partial境界は「コア学習体験がofflineで完結するか」で判定）。

---

## 6. Offline Requirements 3段階比較（§8）

| 案 | 内容 | 評価 |
|---|---|---|
| Level A: Online-first | 常時ネット必須、PWAは起動体験改善のみ | 学校の通信不安定要件（§0）を満たさない |
| **Level B: Visited-app offline（第一候補）** | 一度使った教材はofflineでも起動可能。未訪問教材はonline時のみ | 初回install負荷が小さく、実利用パターン（担当教材を繰り返し使う）と一致。§4のasset量からも現実的 |
| Level C: Core offline（Top＋主要教材precache） | Topと一部主要教材を先読み | 「主要教材」の選定基準が恣意的になりやすく、35アプリの重要度に優劣をつけるべきでないという運営方針（§0「新しいアプリの追加よりも改善を優先」の姿勢）と緊張関係がある |

**決定: Level B（Visited-app offline）**。Level Cの要素は§7のPilot選定で小規模に限定して取り込む。

---

## 7. Architecture Options比較（§58-59）

| 案 | 説明 | 評価 |
|---|---|---|
| A. Full Precache | install時に全35アプリ＋全assetをcache | §4の46MB規模・Multi-Input系の大容量画像により初回install失敗リスク大（§45）。却下 |
| **B. App Shell + Runtime Cache（第一候補）** | 最小限のApp Shell（index.html・共通CSS/JS・アイコン）のみprecache。個別アプリは訪問時にruntime cacheへ追加 | Level B要件と一致。install失敗リスクを主要shellのみに限定できる |
| C. Per-app explicit offline download | 利用者が「このアプリをofflineで使う」ボタンを押した教材のみ明示的にdownload | UIコストが高く、対象ユーザー（教員・支援者）に追加操作を強いる。将来検討候補に留める |

**決定: B（App Shell + Runtime Cache）**。Cは§66 Next Recommendationの将来候補として保持。

---

## 8. HTML Strategy（§10）

どのまなはT7〜T8期を通じて高頻度に更新されている（本セッションだけでも複数のchore(release)コミット）。

| 案 | 評価 |
|---|---|
| Cache First | 更新が反映されず、古いHTMLが長期間残るリスクが高い。継続更新前提のこのサイトには不向き |
| **Network First + offline fallback（第一候補）** | オンライン時は常に最新HTML、offline時のみcacheへfallback。更新反映の速さを優先する運営方針と一致 |
| Stale While Revalidate | 一見古いHTMLを一瞬表示してから更新するため、Network Firstより更新反映が緩やかに遅れる。今回は不採用 |

**決定: Network First + offline fallback**（全HTML: index.html・35アプリ・Supporter Feature・Guideページ共通）。

---

## 9. Static Asset Strategy（§11）

現状、CSS/JSはインラインまたは`assets/js/*.js`として**固定ファイル名**（content hash/versioningなし、`record-dashboard-foundation.js`等）。generate.jsにもasset hashing機構はない。

**リスク**: 固定ファイル名でCache Firstを採用すると、ファイル内容を更新してもcacheが古いまま残る（stale asset問題）。

**方針（第一候補）**: T9-Bでは静的JS/CSSも**Network First**または**Stale-While-Revalidateへcache version bump連動**のいずれかとし、Cache First単体は採用しない。真のCache Firstを使うのはfont/画像等、変更頻度が低く実質immutableな資産のみに限定する。ファイル名へのcontent hash付与（例: `record-dashboard-ui.abcd123.js`）は生成パイプラインの変更を伴うためT9-B以降の別途検討事項とする。

---

## 10. Image Strategy（§12）

35アプリ分の`assets/icons/*.png`（512×512、35件）・`assets/mockups/*.png`（OGP、35件）・各アプリ固有画像（Multi-Input系等）が対象。

**方針**: runtime Cache First候補（画像は一度取得すれば内容が変わることは稀）。ただし§4の大容量ファイル（miru-hirogaru/dotchiga-ii等、単体1MB超）を無制限にruntime cacheへ蓄積するとcache容量が急増するため、cache容量上限とeviction方針（例: 最大N MB、LRU的に古いものから削除、または「訪問app数上限」でruntime cacheグループごと管理）をT9-Bで設計する。old asset cleanupは§18のcache versioning（activate時の旧cache全体削除）と役割分担する。

---

## 11. Audio Strategy（§13）

§4の調査どおり、**リポジトリ内に静的音声ファイルは0件**。実際の音声機構は:

1. **`speechSynthesis`（Web Speech API）** — ブラウザ内蔵、ネットワーク非依存。offline時も基本的に動作する（音声合成エンジンが端末内蔵か否かはブラウザ実装依存だが、追加downloadは発生しない）
2. **`new Audio('data:audio/mp3;base64,...')`** — 無音のダミー音声（iOS Safariの自動再生ロック解除用と推測される小さなbase64定数）。cache不要
3. **`new Audio(url)`（Blob URL）** — ongaku-app等でのユーザー録音再生。ユーザー生成コンテンツのためprecache対象外（§53 Do Not Cache List該当）
4. **hiragana-learn/katakana-appのみ**: cross-origin `.mp3`取得（§5.1参照）

**結論**: 「Audio/BGM large」という一般的PWA懸念は、このリポジトリには実質的に該当しない。唯一の音声cache課題はhiragana-learn/katakana-appのcross-origin音声で、これはruntime cache（cross-origin opaque response、§28のリスクと表裏一体）として個別に評価する。install時precache対象には含めない。

---

## 12. Google Fonts戦略（§14）

現状: `fonts.googleapis.com`のCSS2 API 1本のみ（M PLUS Rounded 1c / Noto Sans JP）、`display=swap`指定済み。CSS2 APIはブラウザのUser-Agentに応じて自動的にunicode-range分割された`@font-face`を返す(明示的なsubsetパラメータ指定はしていないが、API自体が持つ標準機能)。

`display=swap`により、フォント取得前後を問わずテキストはsystem fontで即表示され、フォント取得失敗時もレイアウト崩れ・機能停止は起きない（**既に十分offline-resilient**）。

**方針**: Google FontsをPWA cacheへ積極的に取り込む優先度は低い（取得失敗時の劣化が「装飾フォントがsystem fontになる」程度に留まるため）。runtime cache対象の候補には含めるが、T9-B必須スコープではない。

---

## 13. Offline Fallback（§15）

**方針**: `offline.html`を新設（実装はT9-B）。

文案（第一候補）:

> インターネットに接続できません。
> 一度開いたことのある教材は、そのまま使える場合があります。
> ホーム画面のアイコンからもう一度お試しください。

子ども向けでなく**支援者・教員が読む**ことを想定した文言（教材画面自体のoffline fallbackは、個別アプリの通常のロード失敗時にこのページへ誘導する形を想定）。技術語（Service Worker/cache等）は使わない。

---

## 14. Update Strategy / Update UX（§16-17）

| 方式 | 評価 |
|---|---|
| `skipWaiting()` + `clients.claim()`を無条件実行 | 教材利用中（記録入力中等）に予期せぬreloadを起こすリスクがあり、§43の「Record入力中の強制reload」を直接引き起こしうるため単体では不採用 |
| **Controlled update prompt（第一候補）** | 新しいSWがinstallされたら「新しいバージョンがあります」の控えめな通知を出し、利用者の操作（次回起動時 or 明示的なボタン）で更新を適用する | UI追加の複雑性はあるが、Record入力中の事故を避けられる。§17の要件と直接一致 |
| Versioned cache（cache名にversion embed） | 更新方式そのものではなく、§18のcache管理方針と併用する前提 |

**決定**: Controlled update prompt。ただし「新しいバージョンがあります」通知UIの具体設計（バナー/トースト等）はT9-B以降。

---

## 15. Cache Version / Generator Integration（§18-19）

### 15.1 Cache Version

`donomana-v{N}`のような手動bumpは運用負担が高い（release頻度が高いこのプロジェクトの実態と不整合）。

**方針（第一候補）**: `generate.js`実行時（＝release毎に必ず通るpipeline）に、git commit hashまたはbuild日時を元にcache版文字列を自動生成し、Service Worker本体（またはSWが参照する小さなversion定数ファイル）へ埋め込む。手作業でのversion bump運用は避ける。**実装はT9-B以降**、本Phaseでは方針確定のみ。

### 15.2 Generator Integration

§2.2で確認した`injectFavicon()`/home-btn注入と同じ「マーカーコメントによる冪等注入」パターンが、Service Worker登録タグ（`<script>if('serviceWorker' in navigator){...}</script>`）の全ページ挿入にそのまま転用できる。**precache対象ファイル一覧の手書きは絶対に避け**、`apps-data.json`（35アプリ）・`SITEMAP_STATIC_PAGES`（generate.js既存定数、§19「手書きasset一覧はdriftしやすい」への対処として既に存在する定数を再利用できる）から動的に生成する。実装はT9-B以降。

---

## 16. GitHub Pages / Custom Domain（§20-21）

- Deploy pipeline: `push to main` → `.github/workflows/generate.yml`(`generate`ジョブ、Node 20、`node generate.js`実行後 変更があれば自動commit&push) → GitHub Pages側の`pages build and deployment`ジョブ（別ワークフロー、リポジトリ設定側）
- Custom domain: `CNAME`ファイルに`donomana.jp`。**サイトはリポジトリ名のsubpathではなくdomain rootで配信されている**ため、Service Worker scopeは`/`（ドメインroot）を素直に指定でき、GitHub Pagesのproject-page特有の「`/repo-name/`がscopeに混ざる」問題は発生しない。

---

## 17. localStorage / IndexedDB保護（§22、Critical Constraint）

**絶対原則（T9-B以降も継続して守る）**: Service Workerのinstall/activate/update処理は、`localStorage.clear()`・`indexedDB.deleteDatabase()`等を**一切呼び出さない**。PWA cache（CacheStorage）と学習記録（localStorage / IndexedDB）は完全に別のstorage機構であり、SWのcache世代管理（§18のcache版切替・§44のold cache削除）が記録データに触れることは設計上あってはならない。

現状のIndexedDB利用は**4アプリ**（`schedule-app`・`matching-app`・`ongaku-app`・**`dotchiga-ii-app`**）で確認した（`donomana-storage-architecture-v2_0.md`記載の「3アプリ」から、Phase18-25系のdotchiga-ii-app IndexedDB移行分だけ増えている。本文書で更新記録として残す）。

---

## 18. 「学習のきろく」のoffline対応（§23）

Dashboard(`learning-records.html`)はlocalStorageの横断read-onlyであり、外部fetchを一切行わない（§5.1のNetwork Dependency Inventoryにも非該当）。**HTML/JS(`record-dashboard-foundation.js`/`record-dashboard-ui.js`)さえruntime cacheされていれば、offline時でも既存Recordの閲覧・filter・CSV出力（端末内処理）が問題なく機能する**。§2.3で判明した「manifest未link」の解消と合わせ、**T9-Bのpilot候補として極めて適性が高い**（外部依存なし・read-only・record保存責務を持たない＝§17の懸念と無関係）。

---

## 19. Record Apps(21 Foundation)のoffline対応（§24）

21 Foundation Apps（Learning Record機能を持つアプリ）は§5.2の分類のとおり、hiragana-learn/katakana-appを除く19本が完全offline対応（record保存はlocalStorageのみ、Network Dependencyなし）。hiragana-learn/katakana-appもrecord保存自体はoffline動作可能で、影響は発音読み上げ機能のみに限定される。

---

## 20. Privacy / Security（§27-28）

- Service Workerのcache対象は**static application assets（HTML/CSS/JS/画像/フォント）のみ**。Record内容・個人情報・communication data（gaze-keyboard等）をcacheへコピーする設計は採用しない（そもそもfetchで取得するものではなくlocalStorage上のデータのため、Service Workerの通常のfetchハンドラでは触れようがないが、明文の原則として記載する）。
- HTTPS only（`donomana.jp`は既にHTTPS配信、GitHub Pages custom domain標準）。
- 禁止事項を継続: dynamic code eval、外部script injection、正当な理由のない広範なopaque response caching（§5.1のhiragana-audio cross-origin音声を除き、cross-origin cacheは原則行わない）。

---

## 21. Cache Quota / iPad・Safari / Windows / Android（§29-32）

| プラットフォーム | 論点 | 本Phaseでの扱い |
|---|---|---|
| iPad/Safari | Storage evictionの可能性（Safari ITPは低使用頻度originのCacheStorageを削除しうる）。Add to Home ScreenのPWA対応・install差異 | 学校現場で最重要。**T9-Bで実機検証必須**（§30、コード実装はしない） |
| Windows Chrome/Edge | Desktop PWA installability・standalone表示・update挙動 | 学校PC想定、Browser Matrix(§47)の主要対象 |
| Android Chrome | 基本的なPWA互換性 | 副次対象、可能なら検証 |

localStorageとCacheStorageは別quota体系だが、端末のbrowser storage全体としては共有の上限に影響しうる（特にiOS）。既存の`donomana-supporter-record-dashboard-design-v1_0.md` §12.2で指摘済みの「35アプリが同一originでlocalStorageを共有し、無制限capアプリ7本＋画像データが枠を奪い合う」origin共有quotaリスクと、CacheStorageの追加容量消費は**同じorigin quotaを食い合う**ため、既存Riskと合わせて監視が必要（§21 Risk Register参照）。

---

## 22. Manifest Design（§33-34、確定内容）

現行`site.webmanifest`をベースに、T9-Bで以下を追加する設計とする（実装はしない）:

```json
{
  "name": "どのまな",
  "short_name": "どのまな",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#00A99D",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`start_url`/`scope`ともtracking parameterなしの`/`。`purpose: maskable`は§23の安全地帯未確認の理由により、既存`icon-512.png`をそのまま`maskable`用途に転用することは**推奨しない**（新規maskable専用画像の作成が必要、T9-Aでは作らない）。

---

## 23. Icon Audit（§35）

| icon | 状態 |
|---|---|
| `favicon.ico`(27KB) / `favicon.svg` | 既存、問題なし |
| `favicon-16.png`(16×16) / `favicon-32.png`(32×32) | 既存、正方形、問題なし |
| `apple-touch-icon.png`(180×180) | 既存、正方形、問題なし |
| `icon-192.png`(192×192) / `icon-512.png`(512×512) | **既存**。正方形・適切な解像度。中身は4色クアドラント(teal円・orange三角・blue四角・coral hearts)のロゴが**キャンバス全体を余白なく占有**しており、**maskable safe-zone(中心80%円)の確認が取れない**ため、現状は`purpose: "any"`用途に限定すべき |

**判断**: 新規maskable専用アイコン制作はT9-Aでは行わない。T9-B以降、余白(safe-zone)を持たせた別バージョンの作成を検討候補とする。

---

## 24. Apple Support（§36）

`apple-mobile-web-app-capable`/`apple-mobile-web-app-status-bar-style`は現状**`ongaku-app.html`1ファイルのみ**に個別追加されており(`black-fullscreen`指定)、サイト全体では統一されていない。T9-Bで`site.webmanifest`のstandalone対応と合わせて、これらのmeta tagを§2.2の冪等注入ブロックへ統合するか判断する（現時点では不統一のまま残っている、という監査事実の記録に留める）。

---

## 25. Common Chrome / Navigation Audit（§37-38）

- 35アプリ中**34本**に「🏠 ホームボタン」（generate.js自動注入、floating button）が存在。**唯一の例外`scratch-app.html`は自前実装のback-link(`#backBtn`、`←`アイコン)を既に持っており、Home導線自体は欠落していない**（実装方式が異なるだけ）。
- 静的ページ(about/philosophy/terms/wizard/home-screen-guide/switch-gaze-guide/index/app-intro)は共通header内`<nav>`の「アプリ」リンクでHomeへ戻れる。
- `learning-records.html`（T8-B2）はheader brandリンク(`https://donomana.jp/`)で同等の導線を持つ。
- app-detailsページは既存のback-link実装（Phase23-Bで44px化済み、過去メモリ記録と一致）。

**結論**: standalone表示時にHome導線が欠落しているページは確認されなかった。

---

## 26. Fullscreen Interaction（§39）

`requestFullscreen`/`exitFullscreen`は**35アプリ全教材**で使用（共通機能として広く普及）。PWA standalone表示は既にブラウザchromeを持たないため、Fullscreen APIとの機能的な重複はあるが、標準APIの二重使用自体が問題を起こす証跡は現時点のコード調査からは見つからなかった。**実機でのdisplay-mode:standalone × fullscreen APIの相互作用はT9-Bの実機検証項目とする**（コード変更はしない）。

---

## 27. Install UX（§40）

**方針（第一候補）**: T9-Bでは`beforeinstallprompt`を使った独自Install UIを自作せず、ブラウザ標準のインストール導線（Chromeのアドレスバー install icon、Safari/iOSの「ホーム画面に追加」等）に委ねる。独自UIのメリット（インストール率向上の余地）より、実装・保守コストと「学校現場のブラウザ多様性に対する独自UIの互換性リスク」を優先して回避する。将来、実利用データからインストール率が課題になった場合に再評価する。

---

## 28. Offline Indicator / Network Recovery（§41-42）

- Offline Indicator（「オフラインです」の常時表示）: **MVPでは不要と判断**。offline fallback(§13)と個別アプリのfetch失敗時の自然な劣化（音声が鳴らない等）で十分と考えられ、常時バナーは画面占有・視覚的ノイズになりうる（子ども向け画面での配慮、§0の目的に照らして過剰）。
- Network Recovery（offline→online復帰時）: **自動reloadしない**。教材活動中の入力状態・Record未保存データの消失を避けるため、既存タブはそのまま維持し、次回のnavigation/reload時に新しいcontentへ自然に切り替わる設計とする。

---

## 29. Update While Recording（§43）

§14のControlled update prompt方針に直結する制約として明文化: **Record入力中（テスト実行中・フォーム入力中等）に、Service Worker更新起因の強制reloadを発生させてはならない**。`skipWaiting()`の無条件呼び出しを避け、利用者操作による更新適用のみを許可する設計を維持する。

---

## 30. Cache Cleanup（§44）

`activate`イベントで、現在のcache版名と一致しない**このPWAが作成したcacheのみ**を削除する（cache名にprefix、例: `donomana-v{N}-*`を持たせ、`caches.keys()`でそのprefixに一致するがversionが異なるものだけ削除）。他originのstorageや、無関係なcache名には一切触れない。

---

## 31. Failed Install対策（§45）

§7の決定（App Shell + Runtime Cache）と直結: install時にprecacheするApp Shellのfile数を最小限に抑えることで、1 assetの取得失敗がinstall全体を失敗させるリスクを下げる。Service Worker標準の`cache.addAll()`は1件でも失敗すると全体が失敗する仕様のため、App Shell構成ファイルは「同一origin・小容量・安定して存在する」もの（HTML shell・共通CSS・最小限のJS・icon類）に厳密に限定する。

---

## 32. Do Not Cache List（§53）/ Dev/Test Assets除外（§54）

| 除外対象 | 理由 |
|---|---|
| localStorage/IndexedDB由来の動的・個人データ全般 | §17/§20のprivacy原則 |
| ユーザー生成Blob（ongaku-app録音、drawing-app作品等） | ユーザー生成コンテンツをPWA cacheへ複製する設計上の必要性がない |
| Record CSV export | 都度生成されるファイル、cache対象ではない |
| ローカルfixture/テストデータ | 本番PWAと無関係 |
| `tools/` `docs/`ディレクトリ全体 | 開発者向け資産、利用者向けprecacheに含めない(§54) |
| 非公開/孤立ページ(§3の8件) | apps-data.json未登録、PWA scope外 |

---

## 33. Sitemapとの関係（§55）/ Analytics（§56）

- PWA cache戦略とSEO `sitemap.xml`は独立した仕組みであり、混同しない。sitemap変更は本Phaseで行わない（対象外）。
- Offline時にGoogle Analyticsの送信が失敗しても、教材利用（record保存含む）を一切阻害しない（Analyticsは`index.html`のみに存在し、非同期・fire-and-forget的な性質のため、既存実装のままで問題なし）。Record内容をAnalyticsイベントへ送信しないという既存原則（T8-B2の§39と同じ）を継続する。

---

## 34. Storage Monitoring（§57）

初期PWAにquota meter UIは不要（利用者向け機能としては過剰）。ただし開発時、T9-B実装フェーズでCacheStorageの実際の増加量（訪問app数に応じたruntime cache growth）を計測し、§10のeviction方針の妥当性を検証する。

---

## 35. Offline Test Matrix（§46）/ Browser Matrix（§47）

### Test Matrix（T9-B以降で実施）

- 初回訪問（オンライン）
- 2回目訪問（offline）— visited appが起動できること
- 未訪問ページのoffline — offline fallback(§13)が表示されること
- オンライン復帰時のupdate — §14のController update promptが機能すること
- offline時のrecord保存 — 21 Foundation appsでlocalStorage書込みが問題なく動作すること
- offline中のreload — 状態消失なし
- 「学習のきろく」のoffline閲覧 — §18の想定どおり動作すること
- cache版更新 — 旧cacheが正しく破棄され、localStorage/IndexedDBは無傷であること(§17)
- localStorage/IndexedDB保持 — SW install/update前後でRecord内容が完全一致すること(§48のCritical Release Gate)

### Browser Matrix

最低: Windows Edge・Windows Chrome・iPad Safari(Add to Home Screen)。可能ならAndroid Chromeも追加。

---

## 36. Rollback Strategy / Kill Switch（§49-50）

| 手段 | 内容 |
|---|---|
| Emergency empty SW | 問題発生時、fetchハンドラを持たない/全リクエストをnetworkへ素通しする最小限のSWへ即座に差し替えてdeployし、実質的にcache介入を無効化する |
| Unregister path | SW自身の中に「特定条件下で`self.registration.unregister()`を呼ぶ」緊急停止コードを仕込む設計を候補として保持（実装はT9-B以降） |
| Cache全削除 | activate時に全donomana-v*キャッシュを削除するworkaround版SWをdeployする手順を運用文書化する |

**運用手順の文書化**をT9-Bのリリース準備物に含める（今回は方針の存在確認のみ）。

---

## 37. Phased Rollout / Pilot候補（§51-52）

| Phase | 内容 |
|---|---|
| T9-B | Manifest正式化(§22)＋minimal Service Worker shell pilot（App Shell最小構成のみ、§7決定B） |
| T9-C | Small app pilotの実装・実機検証 |
| T9-D | Record apps(21 Foundation)への展開・record保持検証(§48) |
| T9-E | Full rollout（35アプリ全体） |

**Pilot候補（2〜3本、条件: 軽量・外部依存少・Recordあり）**:

1. **`learning-records.html`（最有力候補）** — 外部fetchゼロ、read-only、localStorage横断readのみ。§18で述べたとおりoffline対応の適性が最も高い
2. **`janken-app.html`** — Foundation Standard Core Schema採用5本の一つ、外部依存なし、HTML/JSとも軽量
3. **`tokei-app.html`** — 同じく外部依存なし、Foundation対応、UIがシンプル

hiragana-learn/katakana-app（cross-origin音声あり）は最初のpilotから意図的に外し、T9-C以降でcross-origin cache戦略が固まってから対応する。

---

## 38. Risk Register（§62）

| リスク | 内容 | 対応方針 |
|---|---|---|
| stale HTML | Cache Firstによる更新反映遅延 | §8: Network First採用 |
| stale JS/CSS | 固定filenameでのCache First | §9: Network First/SWR、hashing検討はT9-B以降 |
| cache poisoning | 不正/破損レスポンスのcache化 | fetchハンドラでHTTPステータス確認、200以外はcacheしない |
| quota逼迫 | CacheStorage増加が既存localStorage origin quotaリスク（design v1.0 §12.2）と競合 | §21・§34で監視方針を明記 |
| iOS eviction | Safari ITPによる低頻度originのcache削除 | §21、T9-Bで実機検証必須 |
| SW update事故 | 強制reloadによるRecord入力中断 | §14/§29: Controlled update prompt |
| offline stale content | 古いHTML/JSがofflineで居座り続ける | §8のNetwork First + §18のcache版切替 |
| Record preservation破壊 | SW cache操作がlocalStorage/IndexedDBに影響 | §17: 絶対原則として明文化、§48でCritical Release Gate化 |
| broken navigation | standalone表示でHomeへ戻れない | §25で監査済み、現状問題なし |
| fullscreen相互作用 | standalone × Fullscreen API | §26、実機検証項目 |
| release rollback失敗 | 問題発生時にSWを止める手段がない | §36で運用手順を設計 |
| cross-origin audio cache | hiragana/katakana音声のopaque response | §5.1/§11、cache範囲を限定し無制限のopaque cachingを避ける(§28) |

---

## 39. Implementation Estimate（§64、概算）

| Phase | 内容 | 概算規模 |
|---|---|---|
| T9-B | Manifest正式化・icon整備判断・minimal SW shell・offline.html・3 pilot appsへのruntime cache適用・generate.js統合 | 中〜大（新規ファイル追加＋generate.js改修＋実機検証） |
| T9-C | Pilotの実機検証拡大・Update UX実装 | 中 |
| T9-D | Record apps(21本)展開・record保持のCritical Gate検証 | 中〜大（T7-J/T8-C相当の検証範囲） |
| T9-E | Full rollout（35アプリ全体、cross-origin音声対応含む） | 大 |

段階的に複数sub-phase（T9-B, T9-C, ...）へ分割することを推奨する。一括実装は§4の資産規模・§21のプラットフォーム差異から現実的でない。

---

## 40. Recommendation（§59、まとめ）

| 項目 | 決定 |
|---|---|
| Offline Level | B（Visited-app offline） |
| Architecture | B（App Shell + Runtime Cache） |
| HTML戦略 | Network First + offline fallback |
| 静的Asset戦略 | Network First/SWR中心、真のCache Firstは低頻度更新資産に限定 |
| 画像戦略 | Runtime Cache First + 容量上限/eviction設計 |
| 音声戦略 | Precache対象外、hiragana/katakana cross-origin音声のみ個別評価 |
| Update戦略 | Controlled update prompt |
| Cache版管理 | generate.js連動の自動version生成（手動bump回避） |
| Install UX | ブラウザ標準委任、独自UI自作なし |
| Pilot | learning-records.html／janken-app／tokei-app |

---

## 41. T9-B Scope（§60）/ Excluded Scope（§61）

### T9-B Scope（最小化提案）

- `site.webmanifest`の`start_url`/`scope`追加（§22）
- 静的ページ6件＋`learning-records.html`へのfavicon/manifest注入対象拡大（§2.3の既知gap解消）
- minimal Service Worker（App Shell precache＋Network First HTML＋Runtime Cache画像）
- `offline.html`
- Pilot 2〜3アプリ（`learning-records.html`／`janken-app`／`tokei-app`）へのruntime cache動作確認

### Excluded（T9-Bではやらない）

全35 apps precache／custom install wizard／background sync／push notification／cloud sync／offline record synchronization／maskable icon新規制作／cross-origin音声のcache対応。

---

## 42. Production変更（§65）

T9-A: docs-only。`service-worker.js`・`manifest`本番変更・`registerServiceWorker`・cache API書込み・navigation変更・Changelog追加・main merge・push・deployのいずれも行っていない。

---

## 43. Implementation Notes（Phase T9-B、Minimal Foundation + Visited-App Offline Pilot、Local RC）

T9-Bで「PWA最小基盤 + Visited-App Offline Pilot」をLocal RCまで実装した。Production公開・main merge・pushは行っていない（本Phaseのスコープ外）。

### 43.1 実装物

- `site.webmanifest`（既存ファイルを更新） — `start_url:"/"`・`scope:"/"`を追加。`icons`/`theme_color`/`background_color`/`display`は既存のまま維持。maskable purposeは追加しない（§23の理由により、safe-zone未確認のicon-512.pngをそのまま転用しない判断を維持）。
- `service-worker.js`（新規、repo root、scope `/`） — Pilot allowlist(`/`／`/learning-records.html`／`/janken-app.html`／`/tokei-app.html`)のnavigationのみNetwork First+runtime cache。それ以外のnavigationには一切介入しない。sub-resourceは要求元client URLがPilot allowlistの場合のみruntime cacheする(non-pilotページ由来のsub-resourceは`fetch(req)`をそのまま返すのみ)。`self.skipWaiting()`は`message`イベント経由でのみ実行(Controlled Update)。`localStorage`/`sessionStorage`/`indexedDB.deleteDatabase`は一切参照しない。
- `offline.html`（新規） — 技術用語なしのoffline fallback。Home導線・再読み込みボタンを実装。
- `assets/js/pwa-register.js`（新規） — SW登録＋Controlled Update UI（「新しいバージョンがあります」＋「更新する」ボタン、44px・keyboard操作可）。登録失敗時も例外を握りつぶし通常利用に影響しない。
- `generate.js`拡張 — 冪等注入patternを再利用した2つの新規機構:
  1. `PWA_MANIFEST_TARGET_FILES`(7ファイル: about.html/philosophy.html/terms.html/wizard.html/home-screen-guide.html/404.html/learning-records.html)へmanifest link + theme-colorのみを注入(T9-A §2.3で確認したgapの解消。既存の手書きfavicon linkとは重複させない別マーカー方式)。
  2. `PWA_REGISTER_TARGET_FILES`(4ファイル: index.html/learning-records.html/janken-app.html/tokei-app.html)へService Worker登録scriptタグのみを注入(全35アプリへの個別貼付は行わない、§21)。
- `tools/pwa-poc/manifest-tests.js` — Node単体テスト(71件): manifest JSON妥当性、service-worker.jsソース安全性(localStorage/eval/importScripts等の不在)、offline.html構造、pwa-register.js安全性、generate.js注入カバレッジ(manifest link/theme-color/登録scriptがそれぞれ対象ファイルに正確に1件のみ、非Pilotアプリには登録scriptが皆無)、apps-data.json(35のまま)・sitemap.xml(offline.html/service-worker.js/site.webmanifest不掲載)の非影響確認。
- `tools/pwa-poc/pwa-realbrowser-test.py` — Playwright実ブラウザライフサイクルテスト(54件、詳細は§43.3)。

### 43.2 既存メカニズムの再利用(§19/§57)

`generate.js`が既に持っていた「マーカーコメントによる冪等注入」(`injectFavicon()`)と全く同じ設計の汎用helper`injectMarkedBlock()`/`injectMarkedBlockToFiles()`を切り出し、PWA関連の2つの注入(manifest link・SW登録script)に再利用した。個別HTMLへの手貼りは一切行っていない。

### 43.3 検証結果サマリ

- Node PWA静的テスト: **71/71 PASS**
- 既存回帰(B1 Golden Tests 783/783・UI Golden Tests 58/58・Dashboard実ブラウザテスト49/49)は全PASS維持(dashboard-realbrowser-test.pyは、learning-records.htmlへ追加されたroot-absolute path資源(`/site.webmanifest`・`/assets/js/pwa-register.js`)がfile://読み込み環境でのみ発生させる既知の無害な`ERR_FILE_NOT_FOUND`を、`requestfailed`イベントで実URLを確認した上で除外するよう調整。Production相当のHTTP配信では発生しない)。
- Playwright PWAライフサイクルテスト(`pwa-realbrowser-test.py`、**54/54 PASS**):
  - **Storage Preservation(§0 最重要原則)**: localStorage 4key + IndexedDB 4db(schedule-app/matching-app/ongaku-app/dotchiga-ii-app)のfixtureが、register→install→activate→online訪問→offline再読込→offline中のRecord書込み→オンライン復帰→Service Worker v1→v2 update→kill switch(unregister+cache削除)の全工程を通じて**完全に保持される**ことを確認(各段階でbyte-for-byte/行単位の一致を検証)。
  - Visited-app offline: learning-records.html/janken-app.html/tokei-app.htmlとも訪問後はoffline再読込で正常表示。learning-records.htmlはoffline状態でも既存Record・Detail modalが機能。
  - Fresh/unvisited offline: 一度も訪問していないPilotページへのoffline初回アクセスはoffline.htmlへ正しくfallback(空白/エラー画面なし)。
  - Non-pilot regression: matching-app/shiritori2/bosai-app/nazori-app/hiragana-learn/katakana-appの6本は、SW active状態でもonline時の挙動に変化なし、かつCacheStorageへ一切書き込まれない(No-op原則の実証)。
  - Update flow: 新versionは`waiting`のまま留まり自動reloadなし。「更新する」明示操作後のみ`controllerchange`→reload(1回のみ)。
  - Cache content audit: cache名は`donomana-`prefixのみ、`/tools/`・`/docs/`・非Pilot app HTML・blob/data URLはいずれも含まれない。
  - Installability前提(§45): manifest fetch 200(`application/manifest+json`)・必須フィールド具備・SW registration(scope `/`, active)・secure context(`127.0.0.1`)を確認。**実際の「ホーム画面に追加」プロンプト(`beforeinstallprompt`)自体はブラウザ側のengagement heuristics依存のため、headless自動テストでは確認できていない(正直な申告、T9-C以降の実機確認事項)**。
  - HTTP SHA-256: `service-worker.js`/`site.webmanifest`/`offline.html`/`learning-records.html`/`janken-app.html`/`tokei-app.html`の6ファイルすべてworktree⇔HTTP配信で一致。
- `node generate.js`×3(index.html/sitemap.xml/learning-records.html): unexpected diff 0。

### 43.4 既存の未修正事項(参考記録、対応せず)

Injection Coverage監査中に、`kyou-no-kiroku.html`・`mogura-tataki.html`・`ongaku-app.html`の3アプリで`<meta name="theme-color">`が2重に存在することを発見した(手書きの独自theme-color + `injectFavicon()`による自動注入分)。**この3ファイルは本Phaseで一切変更していない既存の問題であり**、T9-Bのスコープ外として修正しない(大量のapp business logic変更を避ける方針、§69)。将来Phaseでの修正候補として記録する。

### 43.5 未対応・Future Candidate(本Phaseでは対応しない)

- Edge/iPad Safari等、Chromiumエンジン以外での実機確認(本Phaseの自動テストはPlaywright=Chromiumエンジンのみ。Edgeも同エンジンだが、ブランド別の実機確認は未実施)
- 実際の「ホーム画面に追加」プロンプト表示の実機確認
- Update Prompt表示中のfocus管理の精緻化(§53、キーボード操作自体は可能)
- 静的asset(CSS/JS)のcontent-hash化・cache容量上限/eviction設計(design doc §9/§10、T9-C以降)
- cross-origin音声(hiragana-learn/katakana-app)のcache戦略
- theme-color重複(§43.4)の解消

---

## 44. T9-C4追記: Pilot Small App-Shell Precache（Runtime Cache raceの実機知見、§7の例外）

**§7で決定した「Architecture B: App Shell + Runtime Cache」の全体方針は維持する**。Full Site Precache（全35アプリ＋全asset）は今回も採用しない。この節は§7の決定を上書きするものではなく、**Pilot(4ページ)に限定した例外**を追記するものである。

### 44.1 実機知見: Runtime Cacheのrace

T9-C''（iPad実機Re-Gate）で、Pilotページを「Top→learning-records→janken→tokei」の順にオンライン訪問した直後、iPad実機のApp SwitcherからHome Screen appをforce-quitし、Wi-Fi OFFで再起動したところ、**janken-app.html/tokei-app.htmlがofflineで開かなかった**（learning-records.html/Topは開いた）。

T9-C''で`event.waitUntil()`によるruntime cache書込み保護（fire-and-forgetの解消）を実装済みだったが、それでも本事象は解消しなかった。T9-C'''調査（Playwright+Chromiumによる自動実験）で、**Chromium（WebKitより一般にService Worker実行に寛容とされるエンジン）ですら、「訪問直後にブラウザプロセスを閉じる」タイミングでは、waitUntilで保護していてもruntime cache書込みが完了しきらないページが発生しうる**ことを実証した（詳細はセッション記録を参照、本文書の改訂範囲外のため転記しない）。

**結論**: `event.waitUntil()`保護は「タブを閉じる/ページを離れる」ケースのraceには有効だが、**「Home Screen appのApp Switcher force-quitによるプロセス終了」ケースのraceには対処できない**。これはruntime cache方式（訪問時にcache.putする設計そのもの）が本質的に抱える限界であり、実装の不備ではない。訪問からforce-quitまでの時間差が常に十分とは限らないため。

### 44.2 Pilot Offline Contract

上記知見を受け、Pilotに限り以下の契約を新設する：

> **Pilotページは、PWAのService Worker installが正常完了した時点でoffline-readyである。ユーザーが各Pilotページを事前訪問したことをoffline利用の前提としない。**

対象は既存のPilot allowlist(§9のPILOT_PATHS)と完全一致する4ページ:

- `/`（Top）
- `/learning-records.html`
- `/janken-app.html`
- `/tokei-app.html`

および、これらが起動時に必要とする専用JS（`<script src>`によるsame-origin依存、Pilotページのresource graph調査で判明した必須subresourceのみ）:

- `/assets/js/pwa-register.js`（4ページ共通）
- `/assets/js/record-dashboard-foundation.js`（learning-records.html専用）
- `/assets/js/record-dashboard-ui.js`（learning-records.html専用）

この7件を`REQUIRED_PRECACHE_URLS`として、既存の`install`イベントハンドラでinstall時にprecacheする（`SHELL_CACHE`、§11の対象を拡張）。**非Pilot 31アプリ・app-details・画像(icons/mockups)はこれまでどおり一切precache対象に含めない**。非Pilotは引き続きRuntime Cache方針を完全に維持する（§9/§10、変更なし）。

### 44.3 Install Atomicity

`REQUIRED_PRECACHE_URLS`は**atomicに全件成功させる**（1件でも取得に失敗したらinstall全体を失敗させる、`Promise.all`をcatch無しで使用）。理由: §45（Failed Install対策）が前提としていた「1資産の失敗でinstall全体を失敗させない」best-effort方針を無条件にPilot必須assetへ適用すると、「installは成功したのにPilotがoffline-readyでない」という、Pilot Offline Contract自体と矛盾する状態が発生しうるため。

失敗したinstallはブラウザが新SWを破棄し、既存の(または未installの)状態を維持したまま、次回の`navigator.serviceWorker.register()`呼び出し(=次回ページロード時)で自動的に再試行される。追加のretryロジックは実装していない(既存install/update contractを不必要に壊さない最小設計)。

§45のbest-effort方針自体は**維持**する。`offline.html`・`site.webmanifest`はPilot Offline Contractの必須条件ではない付随assetとして`OPTIONAL_PRECACHE_URLS`に残し、従来どおり1件の失敗でinstall全体を失敗させない。

### 44.4 Sub-resource fallbackの拡張

`handleSubResource()`の offline fallback chain は元々`RUNTIME_CACHE`のみを確認していたが、これだと「一度もオンラインで読み込まれずRUNTIME_CACHEに存在しないPilot専用JS」(未訪問offline初回起動、Pilot Offline Contractが主に想定するシナリオ)がofflineで解決できない。`RUNTIME_CACHE`miss後に`SHELL_CACHE`も確認するよう1箇所拡張した(navigation側の`offlineFallbackForNavigate()`は元々`SHELL_CACHE`も確認していたため変更不要)。

### 44.5 規模

Pilot precache全体(REQUIRED 7件 + OPTIONAL 2件)の合計は約538KB(実測)。既存精査(§4)で却下された「Full Precache = 全35アプリ+全asset、46MB規模」とは2桁以上規模が異なり、§45(Failed Install対策)の趣旨(installするasset数を最小限に抑える)とも矛盾しない。

### 44.6 既知の別issue(本Phaseでは対応せず)

T9-C'''調査で、**Topページ自体の初回訪問時、35アプリ分のicon/mockup画像がruntime cacheされない**問題を発見した(SWが自分自身を登録したページの初回サブリソースを制御できないという仕様上の既知の挙動による)。これはjanken/tokei offline blockerとは別のRoot Causeであり、Pilot app-shell fixのscopeを広げないため、T9-C4では修正しない。将来Phaseのbacklog候補として記録する。

---

## 45. T9-C5追記: First-Launch Offline Readiness Contract

### 45.1 経緯

T9-C4のPilot Offline Contract(「installが正常完了した時点でoffline-ready」)を実機Gate Aで再検証したところ、Standalone初回起動直後(install/precache完了を待たず)にforce-quitするとjanken/tokeiがofflineで開かなかった。これはT9-C4契約への違反ではなく、**Gate Aの手順自体がT9-C4契約の範囲外(install「完了前」の強制終了)を要求していた**ため。「install途中でprocessが強制終了されてもoffline-ready」はWeb Platform上保証不能(SW仕様上、install中のwaitUntilはprocess kill自体からの保護を提供しない)。

T9-C5はこれを認め、**「ユーザーが待てばよい」から「どのまなが準備完了を正しく知らせる」へ契約を転換**した。

### 45.2 Readiness Source of Truth

`navigator.serviceWorker.ready`を基本のSource of Truthとする。T9-C4のinstall atomicity(REQUIRED_PRECACHE_URLSを1件でも失敗させたらinstall全体を失敗させる)により、`ready`が新規registrationについて解決する時点で、REQUIRED_PRECACHE_URLS全件のcacheは既に完了している(installが失敗した場合、readyはそもそも解決しない)。

念のため、ready解決後にSW側へ`CHECK_OFFLINE_READY`メッセージを送り、`SHELL_CACHE`の実データを直接再確認してから「準備完了」を表示する(推測ではなく、SW側の実データを唯一のSource of Truthとして参照する)。

### 45.3 SW install timing測定(実装前の実測)

fresh browser profile・clean origin(localhost)で、first page load→register→install→active→ready resolveまでの時間を12回計測。register()呼び出しからready解決までの差分(ms):

- median: 2.85ms
- min: 1.7ms
- max: 552.3ms

localhost・理想的条件下でも最小-最大で約300倍の開きがあり、固定timeout値を製品仕様として採用しないことの実測根拠とした。

### 45.4 UI設計

Standalone初回起動時のみ(`window.matchMedia('(display-mode: standalone)')`または`navigator.standalone`で判定)、非侵襲的なbanner(`role="status"`、暗黙的に`aria-live="polite"`)を表示する。「準備中: オフラインでも使えるように準備しています…」→「準備完了: オフラインで使う準備ができました」。modalにしない・focusを奪わない・音を鳴らさない・自動reloadしない。準備完了表示は5秒後に自動的に消える(演出上のcosmeticな自動非表示であり、readiness判定そのものには使わない)。installが万一完了しない場合も、20秒後に静かに非表示にする(同様にcosmetic、実際のreadiness判定はいつ解決しても正しく反映される)。

2回目以降の通常起動では表示しない。表示済みかどうかは`localStorage`の`donomana-pwa-readiness-notice-shown`キー(learner Recordの各key(`janken_log`等)とは完全に別、個人情報を含まない単純なbooleanマーカー)で管理する。SW version単位のscopingはせず、「一度でも確認・表示済みか」のみを管理する最小設計を採用した(SW version scopingを追加する複雑さに見合う実益が薄いと判断)。

### 45.5 Controlled Updateとの整合

新versionがwaitingになった場合の既存Controlled Update(§14/§23-26)は無変更。readiness banner(画面上部)とupdate banner(画面下部)は表示位置を分離しており、視覚的に競合しない。なお初回install(readiness banner対象)ではcontrollerが存在しないため構造上update bannerと同時に出ることはない(`showUpdatePrompt`はcontroller存在を前提とする既存ロジック)。

---

## 46. T9-C6追記: Offline Navigation Contract(Root Cause確定と再定義)

### 46.1 iPad実機Gate A再FAIL

T9-C5のreadiness banner「準備完了」表示後、実機Gate Aで再度force-quit→Wi-Fi OFF→cold startを行ったところ、Top・学習のきろくはPASSしたが、じゃんけん・とけいはFAILした。Safariは`https://.../app-details/janken-app-detail.html`に対し「インターネットに接続されていないため、このページをSafariで開くことができません」というブラウザネイティブのオフラインエラーを表示した(どのまな独自の`offline.html`ではない)。

### 46.2 Root Cause

**Top(`index.html`)のapp cardはPilotアプリ本体ではなく、`generate.js`が生成する`app-details/{app}-detail.html`(detail page)へlinkする。** detail pageには「▶ アプリをひらく →」という起動ボタンがあり、そこから初めてPilotアプリ本体(`{app}-app.html`)へ到達する。

実際のnavigation path(Topからの実ユーザー導線、§46.3で全列挙):

```
Top(/) → app-details/janken-app-detail.html → janken-app.html
Top(/) → app-details/tokei-app-detail.html  → tokei-app.html
Top(/) → learning-records.html(detail page経由なし、直接link)
```

`app-details/janken-app-detail.html`/`app-details/tokei-app-detail.html`は、T9-C4/T9-C5時点の`PILOT_PATHS`(navigation介入対象)にも`REQUIRED_PRECACHE_URLS`(install時precache対象)にも含まれていなかった。そのためこれらのnavigationは、Service Workerが登録されていても一切介入されず(§9/§10のNo-op原則がPilot対象外ページ全般に適用される設計上、detail pageも「対象外」と誤って扱われていた)、ブラウザのnative fetchがそのままofflineで失敗していた。

learning-records.htmlはTopから直接linkされ、中間detail pageを持たないため、この不具合の影響を受けなかった。これがjanken/tokeiのみ失敗し、Top/learning-recordsが成功した理由の全容である。

### 46.3 実ユーザーnavigation path 完全列挙

| Pilot | Topからのlink | 中間page | 最終URL |
|---|---|---|---|
| Top | (エントリポイントそのもの) | なし | `/` |
| learning-records | `<a href="learning-records.html">`(直接) | なし | `/learning-records.html` |
| janken | `<a class="app-card" href="app-details/janken-app-detail.html">` | `/app-details/janken-app-detail.html`の`<a href="../janken-app.html" class="launch-btn">` | `/janken-app.html` |
| tokei | `<a class="app-card" href="app-details/tokei-app-detail.html">` | `/app-details/tokei-app-detail.html`の`<a href="../tokei-app.html" class="launch-btn">` | `/tokei-app.html` |

**注記(調査で判明、対象外と確定)**: リポジトリ直下に`janken-app-detail.html`/`tokei-app-detail.html`という同名ファイルが存在するが(`app-details/`配下のものとは別ファイル)、これは旧構成の遺物であり、現行のどこからもlinkされていない(grep調査で確認済み)。Offline Navigation Contractの対象外。`app-intro.html`・`kurabeyou-app.html`・`wizard.html`もjanken/tokeiへの直接linkを持つが、これらはTop起点の主導線ではない非Pilotページであり、Pilot scopeを拡張しない方針(§9)により対象外とする。

### 46.4 なぜ既存自動Gateが検知できなかったか(test gap)

T9-C5の`readiness-realbrowser-test.py`(G/H)は、`page.goto()`で4つのPilot URL(`/`・`/learning-records.html`・`/janken-app.html`・`/tokei-app.html`)へ**直接**遷移できることだけを検証していた。これは「教材本体URLを直接開ける」ことの証明であり、「Topから実際にリンクをたどって到達できる」こととは別の主張である。detail pageという中間navigationの実在を、既存test群のどれも検証していなかった。

T9-C6ではこの空白を埋めるため、`tools/pwa-poc/offline-navigation-realbrowser-test.py`を新設した。`page.goto()`でアプリ本体へ直接飛ぶことは一切せず、Topのapp card要素を`click()`→detail pageの起動ボタンを`click()`という、実際のuser navigationと同じ経路のみを使う。この新testを意図的に**T9-C6適用前のservice-worker.jsに対して実行し、実機と同じ失敗(janken/tokei detail pageで`chrome-error://chromewebdata/`)を再現できることを確認した上で**、修正を適用してPASSに転じることを確認した(推測でなく、再現→修正→再確認の手順を踏んだ)。

### 46.5 Offline Navigation Contract(再定義)

> fresh install後、一度もPilot教材またはそのdetail pageを訪問していなくても、readiness完了表示後にappを終了しoffline cold startした場合、Topから通常のUI導線(実際のリンク操作)を用いて全Pilotへ到達・起動できる。

「offline-ready」とは、単にPilotアプリ本体のHTMLがcache済みという意味ではなく、**ユーザーが通常UIからPilotへ到達するnavigation chain全体(中間detail pageを含む)がoffline usableであること**を意味する。

### 46.6 実装: Single Source of Truth化

`PILOT_DETAIL_PATHS`(Top→教材本体への必須中間ページ、janken/tokeiの2件)を新設し、`PILOT_NAVIGABLE_PATHS = PILOT_PATHS.concat(PILOT_DETAIL_PATHS)`を、navigation介入対象(旧`isPilotPath`が担っていた判定を`isNavigablePilotPath`が新たに担う)と`REQUIRED_PRECACHE_URLS`の両方が直接参照する形にした(`REQUIRED_PRECACHE_URLS = PILOT_NAVIGABLE_PATHS.concat([専用JS...])`)。同じURL集合を複数箇所へ手書きし列挙し直す設計を避け、drift の可能性を構造的に排除した。

`PILOT_PATHS`自体の意味(教材本体4ページ)は変更していない -- `handleSubResource()`の「このsub-resourceはPilotページ本体から読み込まれたか」判定は今後もこの4ページのみを基準にする(detail pageのicon/mockup画像を新たにruntime cache対象へ広げることはしない、§46.7)。

`CHECK_OFFLINE_READY`は`REQUIRED_PRECACHE_URLS`をそのまま参照するコードを変更していない。配列の中身が自動的に拡張されたことで、「準備完了」の意味そのものがOffline Navigation Contractと自動的に一致する(手動での二重管理が発生しない)。

### 46.7 Scopeの明確化(拡張しなかったもの)

- detail page(`app-details/janken-app-detail.html`/`tokei-app-detail.html`)が参照する`assets/icons/{app}.png`・`assets/mockups/{app}.png`は、REQUIRED化しなかった(§44.6のTop画像issueと同種の既知のcosmetic課題として、別backlogのまま据え置く。画像が壊れてもnavigation自体は機能する)。
- 他31アプリ・その他のPilot外detail pageは一切precache対象に追加していない(非Pilot isolationは無変更)。
- `app-intro.html`・`kurabeyou-app.html`・`wizard.html`等、Top以外からjanken/tokeiへ到達する経路は、Pilot scope外として今回のContract対象に含めない(§46.3)。
