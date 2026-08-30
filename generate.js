// variation selector（U+FE00-FE0F）について:
// 以前は JSON.parse 対策として除去していたが、絵文字 (例: 1️⃣ = '1' + U+FE0F + U+20E3) が
// 壊れるため廃止。Node.js の JSON.parse は U+FE0F を問題なくパースできる。
function clean(str) {
  return str; // 互換性のため関数自体は残す(no-op)
}

const fs   = require('fs');
const path = require('path');

const rawJson = fs.readFileSync('./apps-data.json', 'utf-8');
const apps   = JSON.parse(rawJson);
const outDir = './app-details';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// ============================================================
//  ★★ カテゴリ正本マップ（変更厳禁・ユーザー指定）★★
//  apps-data.json で category が違っていても、ここの値で強制的に上書きする。
//  新しいアプリを追加したら、ここにも id を追加すること。
//  ここに無い id はそのまま apps-data.json の category を使う。
// ============================================================
const CATEGORY_TRUTH = {
  // 学習アプリ
  'hiragana-learn':  '学習アプリ',
  'katakana-app':    '学習アプリ',
  'nazori-app':      '学習アプリ',

  'shiritori2':      '学習アプリ',
  'okane-app':       '学習アプリ',
  'register-app':    '学習アプリ',
  'tokei-app':       '学習アプリ',
  'timetable-app':   '学習アプリ',
  'yomikaki-app':    '学習アプリ',
  'bosai-app':       '学習アプリ',
  'directions-app':  '学習アプリ',
  'suji-manabou':      '学習アプリ',
  // 認知支援
  'matching-app':    '認知支援',
  'sugoroku-app':    '認知支援',
  'cup_game':        '認知支援',
  'janken-app':      '認知支援',
  // 自立活動
  'tyushi':          '自立活動',
  'kimochi-board':   '自立活動',
  'schedule-app':    '自立活動',
  'sst-app':         '自立活動',
  'kyou-no-kiroku':      '自立活動',
  'scratch-app':      '自立活動',
  'gaze-keyboard':      '自立活動',
  'mogura-tataki':      '自立活動',
  // 創作表現
  'drawing-app':     '創作表現',
  'slideshow-sakusei':'創作表現',
};

// apps-data.json のカテゴリと正本がズレていたら、警告を出して正本で強制上書き
let __corrected = 0;
for (const app of apps) {
  const truth = CATEGORY_TRUTH[app.id];
  if (truth && app.category !== truth) {
    console.log(`⚠️  カテゴリ自動補正: ${app.title} (${app.id})  ${app.category} → ${truth}`);
    app.category = truth;
    __corrected++;
  }
}
if (__corrected > 0) {
  console.log(`(${__corrected}件のカテゴリを正本に補正しました)\n`);
  // apps-data.json も書き戻して、次回以降の差異を防ぐ
  fs.writeFileSync('./apps-data.json', JSON.stringify(apps, null, 2), 'utf-8');
  console.log('✅ apps-data.json も正本に合わせて更新しました\n');
}

// ============================================================
//  ★★ おすすめ・新着フラグの正本管理 ★★
//  ・RECOMMEND_IDS に登録したアプリは「⭐ おすすめ」タブに表示される
//  ・NEW_IDS に登録したアプリは「🆕 新着」タブに表示される
//  ・apps-data.json 側で isRecommend/isNew が指定されていればそちらも有効
//  ・空にならないよう、未指定の場合は最後の N 件を自動的に新着扱いにする
// ============================================================
const RECOMMEND_IDS = new Set([
  'hiragana-learn',    // ひらがな
  'tokei-app',         // とけい
  'schedule-app',      // スケジュール
  'matching-app',      // マッチング
  'sst-app',           // SST
  'kimochi-board',     // コミュニケーションボード
]);

const NEW_IDS = new Set([
  'directions-app',    // 最新追加分
  'slideshow-sakusei', // 直近追加
  'bosai-app',         // 直近追加
  'suji-manabou',    // 最新追加
  'kyou-no-kiroku',    // 最新追加
  'scratch-app',    // 最新追加
  'gaze-keyboard',    // 最新追加
  'mogura-tataki',    // 最新追加
]);

// フラグを各appに反映(apps-data.jsonで明示指定された値は維持)
for (const app of apps) {
  if (RECOMMEND_IDS.has(app.id) && app.isRecommend !== false) app.isRecommend = true;
  if (NEW_IDS.has(app.id) && app.isNew !== false) app.isNew = true;
}

// 念のため、おすすめ/新着が0件にならないかチェック
const recommendCount = apps.filter(a => a.isRecommend).length;
const newCount       = apps.filter(a => a.isNew).length;
if (recommendCount === 0) {
  console.log('⚠️  おすすめが0件です。最初の3件を自動的におすすめに設定します');
  apps.slice(0, 3).forEach(a => a.isRecommend = true);
}
if (newCount === 0) {
  console.log('⚠️  新着が0件です。末尾3件を自動的に新着に設定します');
  apps.slice(-3).forEach(a => a.isNew = true);
}
console.log(`📌 おすすめ: ${apps.filter(a => a.isRecommend).length}件, 新着: ${apps.filter(a => a.isNew).length}件\n`);


// ============================================================
//  1. app-details/XXX-detail.html を生成（既存機能）
// ============================================================
function generateDetailHTML(app) {
  // どのまなパステルパレット: iconColorの「色相」だけを使い、白文字が読める濃さと
  // 淡いグラデーション用の薄さの2トーンを生成する(index.html/app-intro.htmlと同じ考え方)
  const _hue = hexToHue(app.iconColor || '#5B3FD4');
  const pastelPrimary = hslToHex(_hue, 0.55, 0.42); // 白文字ボタン・バッジ用
  const pastelLight   = hslToHex(_hue, 0.62, 0.86); // グラデーション・淡色用

  const featuresHTML = app.features.map(f => `
      <div class="feature-item">
        <span class="fi-icon">${f.icon}</span>
        <span class="fi-text"><strong>${f.title}</strong><br>${f.desc}</span>
      </div>`).join('');

  const stepsHTML = app.steps.map((s, i) => `
      <div class="step">
        <div class="step-num">${i + 1}</div>
        <div class="step-body">
          <div class="step-label">${s.label}</div>
          <div class="step-desc">${s.desc}</div>
        </div>
      </div>`).join('');

  const a11yHTML   = app.a11y.map(a  => `<span class="a11y-badge">${a}</span>`).join('');
  const badgesHTML = app.badges.map(b => `<span class="tag green">${b}</span>`).join('');

  const softwareHTML = app.software ? `
  <div class="software-alert">
    <div class="software-alert-title">
      <span class="sw-icon">⚠️</span>
      このアプリの使用に必要なソフトウェア<br>（視線入力を使用する場合）
    </div>
    <ul class="software-alert-list">
      ${app.software.items.map(item => {
        const [name, ...rest] = item.split('（');
        const desc = rest.length ? '（' + rest.join('（') : '';
        return `<li><span class="sw-dot"></span><span><strong>${name}</strong>${desc}</span></li>`;
      }).join('')}
    </ul>
    <hr class="software-alert-divider">
    <div class="software-alert-note">${app.software.note}</div>
  </div>` : '';

  // ============================================================
  //  SEO情報を自動生成
  // ============================================================
  const SITE_BASE_URL = 'https://donomana.jp';
  const SITE_NAME = 'どのまな';

  // 共通のSEOキーワード(全アプリ共通)
  const commonKeywords = ['特別支援教育', 'ICT教材', '無料教材', '特別支援学校', '特別支援学級', 'デジタル教材', 'ブラウザ教材', 'インストール不要'];
  // アプリ固有のキーワードを badges / a11y から抽出
  const appKeywords = [];
  // スイッチ・視線入力対応の判定
  const hasSwitch = (app.badges || []).some(b => b.includes('スイッチ')) || (app.a11y || []).some(a => a.includes('スイッチ'));
  const hasGaze = (app.a11y || []).some(a => a.includes('視線'));
  if (hasSwitch) appKeywords.push('スイッチスキャン対応', 'スイッチ教材');
  if (hasGaze) appKeywords.push('視線入力対応', '視線入力アプリ');
  // カテゴリベースのキーワード
  if (app.category === '自立活動') appKeywords.push('自立活動', '自立活動 ICT');
  if (app.category === '認知支援') appKeywords.push('認知支援', '療育');
  if (app.category === '創作表現') appKeywords.push('創作表現', '表現活動');
  if (app.category === '学習アプリ') appKeywords.push('学習アプリ', '個別学習');
  // tags_display から抽出
  if (app.tags_display) {
    app.tags_display.split(/[・,、\/]/).forEach(t => {
      const tag = t.trim();
      if (tag && tag.length >= 2) appKeywords.push(tag);
    });
  }
  // apps-data.json に seoKeywords が定義されていれば最優先で先頭に入れる(併用方式)
  // ・文字列(カンマ/読点区切り)でも配列でも受け付ける
  const manualKeywords = [];
  if (app.seoKeywords) {
    const rawList = Array.isArray(app.seoKeywords)
      ? app.seoKeywords
      : String(app.seoKeywords).split(/[,、]/);
    rawList.forEach(k => {
      const kw = k.trim();
      if (kw) manualKeywords.push(kw);
    });
  }
  // 手動キーワードを先頭に、その後に自動抽出・共通キーワードを続ける(重複は自動排除)
  const allKeywords = [...new Set([...manualKeywords, ...appKeywords, ...commonKeywords])].join(', ');

  // SEO最適化したタイトル(複合キーワード化)
  // app.category が「学習アプリ」のように「アプリ」を含む場合は重複させない
  const categoryLabel = app.category.endsWith('アプリ') ? app.category : `${app.category}アプリ`;
  const accessibilitySuffix = hasSwitch && hasGaze
    ? '|スイッチ・視線入力対応'
    : hasSwitch
      ? '|スイッチスキャン対応'
      : hasGaze
        ? '|視線入力対応'
        : '';
  const seoSuffix = `${categoryLabel}(特別支援教育・無料)${accessibilitySuffix}`;
  // apps-data.json に seoTitle が登録されていればそれを優先する(検索語に最適化した手動タイトル)
  const autoTitle = `${app.title}｜${seoSuffix} - ${SITE_NAME}`;
  const seoTitle = app.seoTitle
    ? (app.seoTitle.includes(SITE_NAME) ? app.seoTitle : `${app.seoTitle} - ${SITE_NAME}`)
    : autoTitle;

  // ディスクリプション(120〜160字目安)
  // apps-data.json に seoDescription があればそれを優先する(検索意図に最適化した手動文)
  const cleanSummary = app.summary.replace(/\s+/g, '').slice(0, 100);
  const autoDescription = `${cleanSummary} 現役の特別支援学校教員が開発した無料のICT教材。${app.category}向け。インストール不要、ブラウザでそのまま使えます。${hasSwitch ? 'スイッチスキャン対応。' : ''}${hasGaze ? '視線入力対応。' : ''}`;
  const seoDescription = app.seoDescription || autoDescription;

  // canonical URL
  const canonicalUrl = `${SITE_BASE_URL}/app-details/${app.filename}-detail.html`;
  // アプリ本体のURL
  const appUrl = `${SITE_BASE_URL}/${app.filename}.html`;

  // スイッチ・視線入力対応アプリには、ガイドページへの誘導バナーを表示
  const guideBannerHTML = (hasSwitch || hasGaze) ? `
  <a href="../switch-gaze-guide.html" class="guide-banner">
    <span class="guide-banner-icon">🔘👁</span>
    <span class="guide-banner-body">
      <span class="guide-banner-title">スイッチ・視線入力をお使いの方へ</span>
      <span class="guide-banner-sub">このアプリを含む、スイッチ教材・視線入力アプリの選び方と使い方を用途別にまとめたガイドがあります。</span>
    </span>
    <span class="guide-banner-arrow">→</span>
  </a>` : '';

  // OGP画像(og:image / twitter:image)
  //  ・apps-data.json に ogImage(相対パス or フルURL)が指定されていれば優先
  //  ・無ければサイト共通のデフォルト画像を使う(要: /ogp.png を用意)
  const DEFAULT_OG_IMAGE = `${SITE_BASE_URL}/ogp.png`;
  // tools/make-mockups.py で生成した実画面モックアップ(存在すればOGPと詳細ページに自動採用)
  const mockupPath = `assets/mockups/${app.id}.png`;
  const hasMockup = fs.existsSync(`./${mockupPath}`);
  const ogImageUrl = app.ogImage
    ? (app.ogImage.startsWith('http') ? app.ogImage : `${SITE_BASE_URL}/${app.ogImage.replace(/^\/+/, '')}`)
    : (hasMockup ? `${SITE_BASE_URL}/${mockupPath}` : DEFAULT_OG_IMAGE);
  const mockupHTML = hasMockup ? `
  <img class="hero-mockup" src="../${mockupPath}" alt="${app.title}の画面イメージ(パソコンとスマートフォンでの表示)" width="1200" height="630" loading="lazy">` : '';

  // 教材の学習分野(教育メタデータ用)。tags_display / category から簡易生成
  const learningResourceTypeMap = {
    '学習アプリ': '練習・ドリル型学習アプリ',
    '認知支援': '認知トレーニングアプリ',
    '自立活動': '自立活動支援アプリ',
    '創作表現': '創作・表現活動アプリ',
  };
  const learningResourceType = learningResourceTypeMap[app.category] || '教育用ICTアプリ';
  const teachesText = (app.tags_display || app.category || '').split(/[・,、\/]/).map(s => s.trim()).filter(Boolean).slice(0, 5).join('、');

  // JSON-LD 構造化データ
  // ・@type を配列にして SoftwareApplication と LearningResource の両方の
  //   プロパティを1つのエンティティとして表現(schema.orgはマルチタイプ表現をサポート)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "LearningResource"],
    "name": app.title,
    "description": cleanSummary,
    "url": canonicalUrl,
    "image": ogImageUrl,
    "applicationCategory": "EducationalApplication",
    "applicationSubCategory": app.category,
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript. Modern browser (Chrome, Edge, Safari)",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "JPY"
    },
    "inLanguage": "ja",
    "isAccessibleForFree": true,
    // ── LearningResource としてのメタデータ ──
    "learningResourceType": learningResourceType,
    "educationalUse": "instruction",
    "educationalLevel": "初等教育・特別支援教育",
    "teaches": teachesText,
    "author": {
      "@type": "Person",
      "jobTitle": ["特別支援学校教員", "元総合教育センター研究員"],
      "description": "現役の特別支援学校教員。日々の教育実践と研究をもとに、子どもたちのためのICTデジタル教材を開発・公開しています。"
    },
    "audience": [
      { "@type": "EducationalAudience", "educationalRole": "teacher" },
      { "@type": "EducationalAudience", "educationalRole": "student" }
    ],
    "isPartOf": {
      "@type": "WebSite",
      "name": SITE_NAME,
      "url": `${SITE_BASE_URL}/`
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "トップ", "item": `${SITE_BASE_URL}/` },
        { "@type": "ListItem", "position": 2, "name": "アプリ一覧", "item": `${SITE_BASE_URL}/app-intro.html` },
        { "@type": "ListItem", "position": 3, "name": app.title, "item": canonicalUrl }
      ]
    }
  };
  const jsonLdHTML = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${seoTitle}</title>
<meta name="description" content="${seoDescription}">
<meta name="keywords" content="${allKeywords}">
<meta name="author" content="${SITE_NAME}">

<!-- 正規URL(canonical) -->
<link rel="canonical" href="${canonicalUrl}">

<!-- Open Graph / SNS共有用 -->
<meta property="og:title" content="${seoTitle}">
<meta property="og:description" content="${seoDescription}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:locale" content="ja_JP">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${app.title}｜${seoSuffix}">
<meta name="twitter:description" content="${seoDescription.slice(0, 120)}">
<meta name="twitter:image" content="${ogImageUrl}">

<!-- 構造化データ(JSON-LD) -->
${jsonLdHTML}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=Noto+Sans+JP:wght@400;500;700&display=swap');
  :root {
    --c-bg:#FBFBF8; --c-surface:#fff; --c-primary:${pastelPrimary};
    --c-primary-light:${pastelLight}55; --c-accent:#00A99D; --c-accent-light:#E6F6F5;
    --c-text:#3B4A54; --c-muted:#5C6B75; --c-border:#EDF1F0; --c-tag-bg:#FBFBF8;
    --radius:16px; --shadow:0 4px 24px rgba(45,36,23,0.08);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Noto Sans JP',sans-serif;background:var(--c-bg);color:var(--c-text);line-height:1.7;}
  .site-nav{background:var(--c-surface);border-bottom:1px solid var(--c-border);padding:12px 24px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--c-muted);flex-wrap:wrap;}
  .site-nav a{color:var(--c-primary);text-decoration:none;font-weight:500;white-space:nowrap;}
  .site-nav a:hover{text-decoration:underline;}
  .site-nav .sep{color:var(--c-border);}
  .hero{background:linear-gradient(135deg,#FBFBF8,var(--c-primary-light),#FBFBF8);border-bottom:1px solid var(--c-border);padding:48px 24px 40px;text-align:center;}
  .app-icon{width:88px;height:88px;border-radius:24px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 32px ${pastelLight}88;background:${pastelPrimary};font-family:'Zen Maru Gothic',sans-serif;font-size:44px;font-weight:900;color:white;}
  .hero h1{font-family:'Zen Maru Gothic',sans-serif;font-size:clamp(22px,5vw,34px);font-weight:900;color:var(--c-text);margin-bottom:8px;}
  .hero-sub{font-size:15px;color:var(--c-muted);margin-bottom:20px;}
  .tag-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:32px;}
  .tag{background:var(--c-surface);border:1px solid var(--c-border);color:var(--c-muted);font-size:12px;padding:4px 12px;border-radius:999px;font-weight:500;}
  .tag.green{background:var(--c-accent-light);border-color:var(--c-accent);color:#00857B;}
  .launch-btn{display:inline-flex;align-items:center;gap:10px;background:var(--c-primary);color:white;font-family:'Zen Maru Gothic',sans-serif;font-size:20px;font-weight:700;padding:18px 40px;border-radius:999px;text-decoration:none;box-shadow:0 6px 24px ${pastelLight}88;transition:transform 0.15s,box-shadow 0.15s;}
  .launch-btn:hover{transform:translateY(-2px);box-shadow:0 10px 32px ${pastelLight}aa;}
  .hero-mockup{display:block;width:min(780px,94%);height:auto;margin:32px auto 0;border-radius:20px;box-shadow:0 16px 48px ${pastelLight}bb;}
  .app-icon-img{width:88px;height:88px;display:inline-block;margin-bottom:20px;filter:drop-shadow(0 8px 24px ${pastelLight});}
  .launch-note{margin-top:12px;font-size:12px;color:var(--c-muted);}
  .content{max-width:800px;margin:0 auto;padding:40px 20px 80px;display:flex;flex-direction:column;gap:28px;}
  .card{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--radius);padding:28px;box-shadow:var(--shadow);}
  .card-title{font-family:'Zen Maru Gothic',sans-serif;font-size:18px;font-weight:700;color:var(--c-text);margin-bottom:16px;display:flex;align-items:center;gap:8px;}
  .summary-text{font-size:15px;line-height:1.9;}
  .software-alert{background:#fff0f3;border:2.5px solid #e8546a;border-radius:20px;padding:22px 24px 20px;display:flex;flex-direction:column;gap:14px;}
  .software-alert-title{font-family:'Zen Maru Gothic',sans-serif;font-size:clamp(14px,2.5vw,16px);font-weight:900;color:#c0182e;display:flex;align-items:center;gap:10px;line-height:1.5;}
  .software-alert-title .sw-icon{font-size:22px;flex-shrink:0;}
  .software-alert-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;}
  .software-alert-list li{font-size:14px;font-weight:700;color:#2d2417;display:flex;align-items:flex-start;gap:10px;line-height:1.7;}
  .software-alert-list li .sw-dot{width:10px;height:10px;background:#e8546a;border-radius:50%;flex-shrink:0;margin-top:6px;}
  .software-alert-list li strong{color:#c0182e;}
  .software-alert-divider{border:none;border-top:1.5px solid #f0b8c0;margin:0;}
  .software-alert-note{font-size:13px;font-weight:700;color:#5a2030;line-height:1.8;}
  .feature-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}
  .feature-item{background:var(--c-tag-bg);border-radius:12px;padding:14px 16px;font-size:14px;display:flex;gap:10px;align-items:flex-start;}
  .fi-icon{font-size:18px;flex-shrink:0;margin-top:1px;} .fi-text{line-height:1.5;}
  .steps{display:flex;flex-direction:column;}
  .step{display:flex;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--c-border);}
  .step:last-child{border-bottom:none;}
  .step-num{width:32px;height:32px;background:var(--c-primary);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Zen Maru Gothic',sans-serif;font-weight:700;font-size:15px;flex-shrink:0;margin-top:2px;}
  .step-label{font-weight:700;font-size:15px;margin-bottom:2px;} .step-desc{font-size:13px;color:var(--c-muted);line-height:1.6;}
  .lesson-table{width:100%;border-collapse:collapse;font-size:14px;}
  .lesson-table th{background:var(--c-tag-bg);padding:10px 14px;text-align:left;font-weight:700;color:var(--c-muted);font-size:12px;border:1px solid var(--c-border);width:90px;white-space:nowrap;}
  .lesson-table td{padding:10px 14px;border:1px solid var(--c-border);line-height:1.7;}
  .a11y-grid{display:flex;flex-wrap:wrap;gap:10px;}
  .a11y-badge{display:flex;align-items:center;gap:6px;background:var(--c-accent-light);border:1px solid var(--c-accent);color:#00857B;font-size:13px;font-weight:500;padding:8px 14px;border-radius:999px;}
  .caution{background:#fffbea;border-left:4px solid #f0c040;border-radius:0 12px 12px 0;padding:16px 20px;font-size:14px;color:#5a4a10;line-height:1.8;}
  .bottom-launch{text-align:center;padding:40px 20px;background:linear-gradient(135deg,#FBFBF8,var(--c-primary-light));border:1px solid var(--c-border);border-radius:var(--radius);}
  .bottom-launch p{font-size:15px;color:var(--c-muted);margin-bottom:20px;}
  .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--c-muted);font-size:14px;text-decoration:none;margin-top:16px;min-height:44px;}
  .back-link:hover{color:var(--c-primary);}
  .guide-banner{display:flex;align-items:center;gap:16px;padding:18px 22px;background:linear-gradient(120deg,#00A99D,#4DBFB3 55%,#4A8FD9);border-radius:18px;box-shadow:0 6px 22px rgba(0,169,157,0.3);text-decoration:none;color:#fff;transition:transform 0.18s,box-shadow 0.18s;}
  .guide-banner:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(74,123,166,0.42);}
  .guide-banner-icon{font-size:26px;flex-shrink:0;line-height:1;letter-spacing:-4px;}
  .guide-banner-body{display:flex;flex-direction:column;gap:4px;flex:1;}
  .guide-banner-title{font-size:16px;font-weight:900;font-family:'Zen Maru Gothic',sans-serif;}
  .guide-banner-sub{font-size:12.5px;font-weight:500;line-height:1.6;opacity:0.95;}
  .guide-banner-arrow{font-size:24px;font-weight:900;flex-shrink:0;transition:transform 0.18s;}
  .guide-banner:hover .guide-banner-arrow{transform:translateX(5px);}
  @media(max-width:600px){.hero{padding:36px 16px 32px;}.content{padding:24px 16px 60px;}.card{padding:20px;}.feature-grid{grid-template-columns:1fr;}.launch-btn{font-size:18px;padding:16px 28px;}}
</style>
</head>
<body>
<nav class="site-nav">
  <a href="${SITE_BASE_URL}/">トップ</a>
  <span class="sep">›</span>
  <a href="../app-intro.html">アプリ一覧</a>
  <span class="sep">›</span>
  <span>${app.title}</span>
</nav>
<section class="hero">
  ${fs.existsSync(`./assets/icons/${app.id}.png`)
    ? `<img class="app-icon-img" src="../assets/icons/${app.id}.png" alt="" width="88" height="88">`
    : `<div class="app-icon">${app.icon}</div>`}
  <h1>${app.title}</h1>
  <p class="hero-sub">${app.category} / ${app.tags_display}</p>
  <div class="tag-row">
    ${badgesHTML}
    <span class="tag">完全無料</span>
    <span class="tag">インストール不要</span>
  </div>
  <a href="../${app.filename}.html" class="launch-btn">▶ アプリをひらく →</a>
  <p class="launch-note">ブラウザでそのまま使えます。インストール不要。</p>${mockupHTML}
</section>
<main class="content">
  ${softwareHTML}
  ${guideBannerHTML}
  <div class="card">
    <h2 class="card-title">概要・ねらい</h2>
    <p class="summary-text">${app.summary}</p>
  </div>
  <div class="card">
    <h2 class="card-title">主な機能</h2>
    <div class="feature-grid">${featuresHTML}</div>
  </div>
  <div class="card">
    <h2 class="card-title">おすすめの使い方</h2>
    <div class="steps">${stepsHTML}</div>
  </div>
  <div class="card">
    <h2 class="card-title">授業での活用</h2>
    <table class="lesson-table">
      <tr><th>対象</th><td>${app.lesson.target}</td></tr>
      <tr><th>ねらい</th><td>${app.lesson.goal}</td></tr>
      <tr><th>使い方</th><td>${app.lesson.howto}</td></tr>
      <tr><th>工夫</th><td>${app.lesson.tips}</td></tr>
    </table>
  </div>
  <div class="card">
    <h2 class="card-title">アクセシビリティ</h2>
    <div class="a11y-grid">${a11yHTML}</div>
  </div>
  <div class="caution"><strong>使用上の留意点</strong><br>${app.caution}</div>
  <div class="bottom-launch">
    <p>アプリの内容を確認したら、さっそく使ってみましょう！</p>
    <a href="../${app.filename}.html" class="launch-btn">▶ アプリをひらく →</a>
    <br>
    <a href="../app-intro.html" class="back-link">← アプリ一覧にもどる</a>
  </div>
</main>
</body>
</html>`;
}

// ============================================================
//  2. index.html の APPS 配列を自動生成して上書き
// ============================================================

// apps-data.json の category（日本語）→ index.html の category（英語キー）変換
const CAT_MAP = {
  '学習アプリ':   'gakushu',
  '認知支援':     'ninchi',
  '自立活動':     'jiritsu',
  '創作表現':     'sousaku',
  '教材作成ツール': 'sousaku',
};

// ============================================================
//  色ユーティリティ：iconColor から派生色(明色/暗色/タグ色)を生成
//  ・新規アプリは CARD_CLASS_MAP / THEME_CLASS_MAP に無くても、
//    iconColor を元に自動で色付けされる
// ============================================================
function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const v = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h.padEnd(6, '0').slice(0, 6);
  return { r: parseInt(v.slice(0,2),16), g: parseInt(v.slice(2,4),16), b: parseInt(v.slice(4,6),16) };
}
function rgbToHex(r,g,b) {
  const c = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2,'0');
  return '#' + c(r) + c(g) + c(b);
}
function lighten(hex, amount=0.45) {
  const {r,g,b} = hexToRgb(hex);
  return rgbToHex(r + (255-r)*amount, g + (255-g)*amount, b + (255-b)*amount);
}
function darken(hex, amount=0.25) {
  const {r,g,b} = hexToRgb(hex);
  return rgbToHex(r*(1-amount), g*(1-amount), b*(1-amount));
}
// HEX → HSL（色相のみ抽出してパステル化に使う）
function hexToHue(hex) {
  const {r,g,b} = hexToRgb(hex);
  const rn=r/255, gn=g/255, bn=b/255;
  const max=Math.max(rn,gn,bn), min=Math.min(rn,gn,bn);
  let h=0;
  const d=max-min;
  if (d!==0) {
    if (max===rn) h=((gn-bn)/d)%6;
    else if (max===gn) h=(bn-rn)/d+2;
    else h=(rn-gn)/d+4;
    h*=60; if (h<0) h+=360;
  }
  return h;
}
// HSL → HEX（どのまなパステルパレット共通の彩度・明度カーブ）
function hslToHex(h, s, l) {
  const c=(1-Math.abs(2*l-1))*s;
  const x=c*(1-Math.abs((h/60)%2-1));
  const m=l-c/2;
  let r,g,b;
  if (h<60){r=c;g=x;b=0;} else if (h<120){r=x;g=c;b=0;} else if (h<180){r=0;g=c;b=x;}
  else if (h<240){r=0;g=x;b=c;} else if (h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  return rgbToHex((r+m)*255,(g+m)*255,(b+m)*255);
}
// アプリIDから安全なCSSクラス名を生成
function safeClassName(prefix, name) {
  return prefix + String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

// ============================================================
//  order を「真の順位」として解釈してカテゴリ内ソート
//  ・order がないアプリは元の順序を維持
//  ・order があるアプリを order 値の小さい順で取り出し、
//    1-indexed の希望位置に順次「挿入」する
//  ・複数のアプリが同じ位置を希望する場合は order 値の小さい方が先
// ============================================================
function sortAppsByOrder(appsList) {
  // orderあり/なしで分割
  const withOrder = appsList
    .map((a, idx) => ({ a, idx }))
    .filter(x => typeof x.a.order === 'number')
    .sort((x, y) => x.a.order - y.a.order || x.idx - y.idx);
  const withoutOrder = appsList.filter(a => typeof a.order !== 'number');

  // orderなしを並べたベース配列に、orderありを順に挿入
  const result = withoutOrder.slice();
  for (const { a } of withOrder) {
    // a.order=N → 「N番目に置く」 = 配列インデックス N-1 に挿入
    // 範囲外は両端にクランプ
    const pos = Math.max(0, Math.min(result.length, a.order - 1));
    result.splice(pos, 0, a);
  }
  return result;
}

// filename → cardClass のマッピング（既存アプリの色を維持）
const CARD_CLASS_MAP = {
  'hiragana-learn':  'card-hiragana',
  'katakana-app':    'card-katakana',
  'nazori-app':      'card-nazori',
  'janken-app':      'card-janken',
  'shiritori2':      'card-shiritori',
  'okane-app':       'card-okane',
  'register-app':    'card-register',
  'tokei-app':       'card-tokei',
  'schedule-app':    'card-schedule',
  'timetable-app':   'card-timetable',
  'bosai-app':       'card-bosai',
  'matching-app':    'card-matching',
  'sugoroku-app':    'card-sugoroku',
  'tyushi':          'card-hikaru',
  'cup_game':        'card-cupgame',
  'sst-app':         'card-sst',
  'kimochi-board':   'card-board',
  'drawing-app':     'card-oekaki',
   'yomikaki-app':    'card-yomikaki',
  // 'slideshow-sakusei' はマッピングせず動的生成(新iconColor黄緑で全ページ統一。oekaki=緑系との重複を回避)
  'directions-app':  'card-directions', // 専用色(ティール系)
};

// need/input は apps-data.json 側では canonical slug のまま保持し(日本語ラベルの二重管理を避ける)、
// 利用者向けの日本語検索語はここで最小限のmappingから生成する(APPS配列生成時のみ展開)。
// 語彙は既存6目的入口の文言・apps-data記述と整合する範囲に限定し、同義語を増やしすぎない。
const NEED_SEARCH_LABELS = {
  communicate: ['気持ち', '伝える', '気持ちを伝えたい'],
  time:        ['時間', '見通し', '時間の見通しを持たせたい'],
  literacy:    ['文字', '読み書き', '文字・読み書きを学びたい'],
  life:        ['生活', '生活スキル', '生活スキルを育てたい'],
  social:      ['友達', '関わり', '友達との関わりを育てたい'],
};
const INPUT_SEARCH_LABELS = {
  touch:    ['タッチ'],
  switch:   ['スイッチ', 'スイッチ入力'],
  gaze:     ['視線', '視線入力'],
  keyboard: ['キーボード'],
  gamepad:  ['ゲームパッド'],
};
function expandSearchLabels(slugs, table) {
  return (slugs || [])
    .map(slug => [slug, ...(table[slug] || [])].join(' '))
    .join(' ');
}

function generateAppsArray(apps) {
  const catOrder = ['gakushu', 'ninchi', 'jiritsu', 'sousaku'];
  const catLabels = { gakushu: '学習アプリ', ninchi: '認知支援', jiritsu: '自立活動', sousaku: '創作表現' };

  // categoryを英語キーに変換してソート、未マッピングなら専用クラス名を付与
  const mapped = apps.map(app => {
    const mapped = CARD_CLASS_MAP[app.filename];
    const dynamic = !mapped && !app.cardClass;
    return {
      ...app,
      _cat: CAT_MAP[app.category] || 'gakushu',
      _cardClass: app.cardClass || mapped || safeClassName('card-', app.filename),
      _dynamicCard: dynamic,  // 動的CSS注入対象
    };
  });
  // カテゴリ別にグループ化し、各カテゴリ内で order を「真の順位」として並べる
  const byCat = {};
  for (const app of mapped) {
    if (!byCat[app._cat]) byCat[app._cat] = [];
    byCat[app._cat].push(app);
  }
  // catOrder の順番で結合、各カテゴリ内は sortAppsByOrder で並べる
  const sorted = [];
  for (const cat of catOrder) {
    if (byCat[cat]) sorted.push(...sortAppsByOrder(byCat[cat]));
  }
  // catOrder に無いカテゴリも末尾に追加(安全策)
  for (const cat of Object.keys(byCat)) {
    if (!catOrder.includes(cat)) sorted.push(...sortAppsByOrder(byCat[cat]));
  }
  mapped.length = 0;
  mapped.push(...sorted);

  let currentCat = '';
  const lines = ['const APPS = ['];
  for (const app of mapped) {
    if (app._cat !== currentCat) {
      currentCat = app._cat;
      lines.push('  // ' + (catLabels[currentCat] || currentCat));
    }
    const need    = JSON.stringify(app.need || []);
    const input   = JSON.stringify(app.input || []);
    // 検索用: canonical slugを日本語検索語へ展開(apps-data.json側には日本語ラベルを保存しない)
    const needText  = JSON.stringify(expandSearchLabels(app.need, NEED_SEARCH_LABELS));
    const inputText = JSON.stringify(expandSearchLabels(app.input, INPUT_SEARCH_LABELS));
    // feature相当の検索語は新規フィールドを設けず、既存の a11y[] / features[].title を平坦化して流用する
    const a11yText     = JSON.stringify((app.a11y || []).join(' '));
    const featuresText = JSON.stringify((app.features || []).map(f => f.title).join(' '));
    const extras = [
      app.isNew       ? 'isNew: true'      : '',
      app.isRecommend ? 'isRecommend: true' : '',
      app.isComing    ? 'isComing: true'    : '',
    ].filter(Boolean).join(', ');
    lines.push('  {');
    const iconImgPath = fs.existsSync('./assets/icons/' + app.id + '.png') ? 'assets/icons/' + app.id + '.png' : '';
    const mockupImgPath = fs.existsSync('./assets/mockups/' + app.id + '.png') ? 'assets/mockups/' + app.id + '.png' : '';
    lines.push('    name: ' + JSON.stringify(app.title) + ', link: "app-details/' + app.filename + '-detail.html", icon: ' + JSON.stringify(app.icon) + ', iconImg: ' + JSON.stringify(iconImgPath) + ', mockupImg: ' + JSON.stringify(mockupImgPath) + ', desc: ' + JSON.stringify(app.summary.slice(0, 30)) + ', tag: ' + JSON.stringify(app.tags_display) + ',');
    lines.push('    category: "' + app._cat + '", cardClass: "' + app._cardClass + '"' + (extras ? ', ' + extras : '') + ',');
    lines.push('    need:' + need + ', input:' + input + ',');
    lines.push('    needText:' + needText + ', inputText:' + inputText + ',');
    lines.push('    a11yText:' + a11yText + ', featuresText:' + featuresText);
    lines.push('  },');
  }
  lines.push('];');
  return { code: lines.join('\n'), mapped };
}

// 動的カードCSS(新規アプリ用)を生成
// ・iconColorの「色相」だけを使い、彩度・明度は「どのまな」パステルパレット共通の値で再構成する
//   (どんなiconColorが指定されても、必ずやさしいパステル系になる)
function generateDynamicCardCSS(mappedApps) {
  const rules = [];
  for (const app of mappedApps) {
    if (!app._dynamicCard) continue;
    const base = app.iconColor || '#5B3FD4';
    const h = hexToHue(base);
    const light  = hslToHex(h, 0.48, 0.905); // 背景グラデ（明るいパステル）
    const dark   = hslToHex(h, 0.42, 0.825); // 背景グラデ（やや濃いパステル）
    const border = hslToHex(h, 0.40, 0.68); // ホバー時のボーダー
    const tagBg  = hslToHex(h, 0.50, 0.955); // タグ背景（ごく薄く）
    const tagFg  = hslToHex(h, 0.40, 0.36); // タグ文字（読みやすい濃さ）
    const cls = app._cardClass;
    rules.push(`  .${cls} .card-preview { background: linear-gradient(135deg, ${light} 0%, ${dark} 100%); }`);
    rules.push(`  .${cls}:hover { border-color: ${border}; }`);
    rules.push(`  .${cls} .card-tag { background: ${tagBg}; color: ${tagFg}; }`);
  }
  return rules.join('\n');
}

function updateIndexHTML(result) {
  const indexPath = './index.html';
  if (!fs.existsSync(indexPath)) {
    console.log('⚠️  index.html が見つかりません。スキップします。');
    return;
  }
  let html = fs.readFileSync(indexPath, 'utf-8');
  // const APPS = [ ... ]; の部分を置き換え
  const start = html.indexOf('const APPS = [');
  const end   = html.indexOf('];', start) + 2;
  if (start === -1 || end < 2) {
    console.log('⚠️  index.html の APPS 配列が見つかりません。スキップします。');
    return;
  }
  html = html.slice(0, start) + result.code + html.slice(end);

  // ── 動的カードCSSを <style id="dynamic-card-css"> として注入 ──
  const dynCSS = generateDynamicCardCSS(result.mapped);
  const dynStart = '<style id="dynamic-card-css">';
  const dynEnd   = '</style><!-- /dynamic-card-css -->';
  const block    = `${dynStart}\n${dynCSS}\n${dynEnd}`;
  const existIdx = html.indexOf(dynStart);
  if (existIdx !== -1) {
    // 既存ブロックを置き換え
    const tailIdx = html.indexOf(dynEnd, existIdx) + dynEnd.length;
    html = html.slice(0, existIdx) + block + html.slice(tailIdx);
  } else if (dynCSS) {
    // 新規挿入: </head> の直前
    const headEnd = html.indexOf('</head>');
    if (headEnd !== -1) html = html.slice(0, headEnd) + '\n' + block + '\n' + html.slice(headEnd);
  }

  // VS除去は廃止(絵文字を壊すため)
  // ── JavaScript エラー自動修正 ──
  const jsFixRes = fixIndexJsBugs(html);
  html = jsFixRes.html;
  // ── ファビコン注入 ──
  const favRes = injectFavicon(html);
  html = favRes.html;
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('✅ index.html の APPS 配列を更新しました');
  if (dynCSS) console.log(`✅ index.html に新規アプリ用のカードCSSを動的注入 (${(dynCSS.match(/\n/g)||[]).length}行)`);
  if (jsFixRes.fixes.length > 0) console.log(`🔧 index.html のJSバグを自動修正: ${jsFixRes.fixes.join(', ')}`);
  if (favRes.action !== 'skipped') console.log(`✅ index.html にファビコンを ${favRes.action} (action=${favRes.action})`);
}

// ============================================================
//  index.html のJavaScriptバグを自動修正
//  ・未定義関数の呼び出しを安全にコメントアウト
//  ・既知の不具合パターンに対応
//  冪等: 既に修正済みなら何もしない
// ============================================================
function fixIndexJsBugs(html) {
  const fixes = [];
  // 修正1: resetMetaFilter() が未定義なのに呼ばれていてエラーで止まる
  //  → 関数定義が存在しなければ、呼び出し行をコメントアウト
  if (html.includes('resetMetaFilter()') && !html.match(/function\s+resetMetaFilter\s*\(/)) {
    // 既にコメントアウト済みの行はマッチしないように先頭の空白を許容
    const before = html;
    html = html.replace(
      /^(\s*)resetMetaFilter\(\);(\s*\/\/.*)?$/gm,
      '$1// resetMetaFilter(); // [auto-fixed by generate.js] 関数が未定義のため無効化'
    );
    if (html !== before) fixes.push('resetMetaFilter() を無効化');
  }
  return { html, fixes };
}

// ============================================================
//  3. app-intro.html の panel-all カードを自動生成して上書き
// ============================================================
const BASE_URL = 'https://donomana.jp';
const BASE_PATH = ''; // カスタムドメイン(donomana.jp)はサイトルートから配信されるため空文字

// 🏠 ホームボタン: 全ページ共通のフローティングボタン設定
const HOME_BTN_SKIP_APPS = new Set(['scratch-app']); // 既に独自のヘッダー内リンクを実装済み
const HOME_BTN_HTML = [
  '<!-- home-btn: 自動挿入 (generate.js) -->',
  '<style>#donomanaHomeBtn:focus-visible{outline:3px solid #00A99D;outline-offset:2px;}</style>',
  `<a href="${BASE_URL}/" id="donomanaHomeBtn" class="scannable" data-scan="1" aria-label="どのまな トップページへ戻る" title="どのまな トップページへ戻る" style="position:fixed;top:12px;left:12px;z-index:99999;min-width:44px;min-height:44px;border-radius:50%;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center;font-size:20px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:transform .15s,box-shadow .15s;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">🏠</a>`,
  '<!-- /home-btn -->'
].join('\n');

// ⛶🔒 全画面表示・画面ロック: 既に独自実装済みのアプリはスキップする
const FS_SKIP_APPS = new Set([
  'hiragana-learn','katakana-app','register-app','schedule-app',
  'timetable-app','matching-app','sugoroku-app','tyushi','cup_game','sst-app',
  'drawing-app','directions-app','suji-manabou','gaze-keyboard','mogura-tataki',
  'ongaku-app','scratch-app',
  'nazorin-print' // 印刷専用ツールのため全画面表示は不要
]);
const LOCK_SKIP_APPS = new Set(['scratch-app','sugoroku-app','tyushi','sst-app','nazorin-print']);

// SR_SKIP_APPS: 既にアプリ本体が学習コンテンツの読み上げを多用しており、
// 汎用の「タップで読み上げ」機能を重ねると音声が競合・中断してしまうアプリ
// → これらのアプリでは 表示モード/文字の大きさ は提供し、読み上げ機能だけ外す
const SR_SKIP_APPS = new Set(['hiragana-learn', 'katakana-app', 'suji-manabou', 'nazorin-print', 'kurabeyou-app', 'katachi-awase-app']); // nazorin-print: 印刷専用ツールのため読み上げ不要、kurabeyou-app・katachi-awase-app: 学習コンテンツ自体の読み上げと重ねない

// 🔧 既存の独自設定ボタンを持つアプリ: セレクタを指定すると、
// ・元のボタンは非表示にする
// ・統一パネルに「このアプリの詳細設定を開く」ボタンを追加し、
//   クリック時に元のボタンと同じ動作を呼び出す(元の機能はそのまま活かす)
const SETTINGS_PROXY = {
  'hiragana-learn':     { selector: '.tab-btn[data-tab="settings"]', label: '🔧 このアプリの詳細設定を開く' },
  'katakana-app':       { selector: '.tab-btn[data-tab="settings"]', label: '🔧 このアプリの詳細設定を開く' },
  'suji-manabou':       { selector: '.tab-btn[data-tab="settings"]', label: '🔧 このアプリの詳細設定を開く' },
  'nazori-app':         { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'janken-app':         { selector: '.btn-settings', label: '🔧 このアプリの詳細設定を開く' },
  'shiritori2':         { selector: '.settings-btn', label: '🔧 このアプリの詳細設定を開く' },
  'okane-app':          { selector: '[onclick="openSettingsModal()"]', label: '🔧 このアプリの詳細設定を開く' },
  'register-app':       { selector: '#settings-btn', label: '🔧 このアプリの詳細設定を開く' },
  'schedule-app':       { selector: '#tab-settings', label: '🔧 このアプリの詳細設定を開く' },
  'yomikaki-app':       { selector: '#tab-settings', label: '🔧 このアプリの詳細設定を開く' },
  'bosai-app':          { selector: '#settings-open-btn', label: '🔧 このアプリの詳細設定を開く' },
  'matching-app':       { selector: '#btn-settings', label: '🔧 このアプリの詳細設定を開く' },
  'sugoroku-app':       { selector: '#setbtn', label: '🔧 このアプリの詳細設定を開く' },
  'tyushi':             { selector: '#settings-btn', label: '🔧 このアプリの詳細設定を開く' },
  'cup_game':           { selector: '#gearBtn', label: '🔧 このアプリの詳細設定を開く' },
  'sst-app':            { selector: '.hdr-gear', label: '🔧 このアプリの詳細設定を開く' },
  'kimochi-board':      { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'drawing-app':        { selector: '#gaze-toggle-btn', label: '👁 視線入力の設定を開く' },
  'slideshow-sakusei':  { selector: '[onclick="openA11y()"]', label: '🔧 スイッチスキャン等の詳細設定を開く' },
  'directions-app':     { selector: '[onclick="nav(\'settings\')"]', label: '🔧 このアプリの詳細設定を開く' },
  'time-timer':         { selector: '#settingsToggle', label: '🔧 このアプリの詳細設定を開く' },
  'kyou-no-kiroku':     { selector: '#a11yBtn', label: '🔧 スイッチスキャン等の詳細設定を開く' },
  'gaze-keyboard':      { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'mogura-tataki':      { selector: '#btnSet, #homeSetBtn', label: '🔧 このアプリの詳細設定を開く' },
  'scratch-app':        { selector: '#setBtn', label: '🔧 このアプリの詳細設定を開く' },
  'kurabeyou-app':      { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'katachi-awase-app':  { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'miru-hirogaru-app':  { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'mitsukete-touch-app':{ selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
  'junban-miyou-app':   { selector: '#setBtn', label: '🔧 このアプリの詳細設定を開く' },
  'dotchiga-ii-app':    { selector: '#settingsBtn', label: '🔧 このアプリの詳細設定を開く' },
};

// アプリごとに読み上げセクションの有無・既存設定への橋渡しを切り替えてパネルHTML/JSを生成する
function buildA11yPanelHTML(includeSR, appFilename) {
  const proxy = SETTINGS_PROXY[appFilename] || null;

  const srSectionHTML = includeSR ? `
  <div style="font-size:12px;font-weight:700;color:#666;margin-bottom:6px;">🔊 選択・タップの読み上げ</div>
  <div style="display:flex;gap:6px;margin-bottom:14px;">
    <button data-a11y-sr="off" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">オフ</button>
    <button data-a11y-sr="on" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">オン</button>
  </div>` : '';

  const srScriptHTML = includeSR ? `
  var srEnabled = false;
  function speak(text){
    if (!srEnabled || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text.trim());
    u.lang = 'ja-JP'; u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }
  function onGlobalSpeakClick(e){
    if (!srEnabled) return;
    if (e.target.closest('#donomanaA11yPanel, #donomanaA11yBtn')) return;
    var el = e.target.closest('button, a, [role="button"]');
    if (!el) return;
    var text = (el.getAttribute('aria-label') || el.textContent || '').trim();
    if (text) speak(text);
  }
  function applyScreenReader(enabled){
    srEnabled = enabled;
    mark('[data-a11y-sr]', 'a11ySr', enabled ? 'on' : 'off');
    localStorage.setItem(P + 'sr', enabled ? '1' : '0');
    if (enabled) {
      speak('読み上げ機能をオンにしました');
      document.addEventListener('click', onGlobalSpeakClick, true);
    } else {
      window.speechSynthesis && window.speechSynthesis.cancel();
      document.removeEventListener('click', onGlobalSpeakClick, true);
    }
  }` : '';

  const srWireHTML = includeSR
    ? `all('[data-a11y-sr]').forEach(function(b){ b.addEventListener('click', function(){
      applyScreenReader(b.dataset.a11ySr === 'on');
      donomanaAnnounceA11y(b.dataset.a11ySr === 'on' ? '読み上げ機能をオンにしました' : '読み上げ機能をオフにしました');
    }); });`
    : '';
  const srResetHTML = includeSR ? `applyScreenReader(false);` : '';
  const srRemoveHTML = includeSR ? `localStorage.removeItem(P + 'sr');` : '';
  const srRestoreHTML = includeSR ? `applyScreenReader(localStorage.getItem(P + 'sr') === '1');` : '';

  // 既存の独自設定ボタンへの橋渡し行(あるアプリのみ)
  const proxyRowHTML = proxy ? `
  <button id="donomanaSettingsProxy" style="width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;padding:10px;margin-bottom:10px;border-radius:8px;border:2px solid #00A99D;background:#fff;color:#00857B;font-size:12px;font-weight:900;cursor:pointer;">${proxy.label}</button>` : '';
  // opacity:0だと非表示のままレイアウト上の幅・高さだけ残り、隣接要素との間に
  // 不自然な空白/白い帯ができるアプリはこちらでdisplay:noneにして詰める。
  // (hiragana-learn/katakana-app/suji-manabou: 横並びnav-tabsの1要素として存在
  //  shiritori2: 独自の上部バー.top-barの1要素として存在)
  // Phase M11.3-C: junban-miyou-appを追加。opacity:0+pointer-events:noneのみでは
  // ネイティブTab順序からも自アプリのSwitch Scan候補(isVisibleEnabled()は
  // display==='none'のみ判定し、opacityは見ない)からも除外されず、フォーカス可能・
  // 実質operableな「見えないボタン」が残っていた(#setBtnのkeyboard focus/Switch Scan
  // scan-focusが視覚的に何も無い位置に当たる不具合)。同じMulti-Input Pilotの
  // miru-hirogaru-app/mitsukete-touch-appと同じdisplay:none方式に揃えることで、
  // ネイティブTab順序・isVisibleEnabled()双方から自動的に除外される。
  // Phase M12-E: dotchiga-ii-appを追加。miru-hirogaru-app/mitsukete-touch-app/
  // junban-miyou-appと同じMulti-Input系アプリで、Switch Scan・Activity Tabs
  // 双方のネイティブTab順序からsettingsBtnを除外する必要がある点も同一。
  const hideWithDisplayNone = new Set(['hiragana-learn', 'katakana-app', 'suji-manabou', 'shiritori2', 'kurabeyou-app', 'katachi-awase-app', 'miru-hirogaru-app', 'mitsukete-touch-app', 'junban-miyou-app', 'dotchiga-ii-app']);
  const proxyHideDecl = hideWithDisplayNone.has(appFilename)
    ? 'display:none !important;pointer-events:none !important;'
    : 'opacity:0 !important;pointer-events:none !important;';
  const proxyHideCSS = proxy ? `<style>${proxy.selector}{${proxyHideDecl}}</style>` : '';
  const proxyScriptHTML = proxy ? `
  var proxyBtn = document.getElementById('donomanaSettingsProxy');
  if (proxyBtn) {
    // フォーカス可能条件の最小十分セット(Phase16.44-C横断調査で導出、Phase16.45-Bでdisplay/opacity判定を追加):
    // 接続済み・disabledでない・tabIndex!==-1・hidden属性/祖先なし・inert配下でない・
    // クライアント矩形を持つ・display:noneでない・visibility:hidden/collapseでない・opacity:0でない。
    // pointer-events:noneはキーボードフォーカス可否と一致しないため判定条件に含めない。
    function donomanaIsFocusable(el){
      if (!el || !el.isConnected || el.disabled || el.tabIndex === -1) return false;
      if (el.hasAttribute('hidden') || el.closest('[hidden]') || el.closest('[inert]')) return false;
      if (el.getClientRects().length === 0) return false;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (Number.parseFloat(cs.opacity) === 0) return false;
      return true;
    }
    function donomanaFirstFocusable(root){
      if (!root) return null;
      var cands = root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]');
      for (var i = 0; i < cands.length; i++) { if (donomanaIsFocusable(cands[i])) return cands[i]; }
      return null;
    }
    proxyBtn.addEventListener('click', function(e){
      // 実際のクリックイベントがこのままdocumentまでバブリングすると、
      // アプリ側の「パネル外をクリックしたら閉じる」処理が、いま開いたばかりの
      // 設定パネルを"外側クリック"と誤認してすぐ閉じてしまう(反応しないように見えるバグの原因)。
      // これを防ぐため、実クリックの伝播はここで止める。
      e.stopPropagation();
      var candidates = Array.from(document.querySelectorAll(${JSON.stringify(proxy.selector)}));
      // 複数該当する場合、実際に表示されている（offsetParentがnullでない）ものを優先
      var original = candidates.find(function(el){ return el.offsetParent !== null; }) || candidates[0];
      panel.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
      if (!original) return;
      // Phase16.45-A: 上のpanel非表示により、フォーカス中だった#donomanaSettingsProxyの祖先が
      // display:noneになる。ブラウザは非同期にfocusout(relatedTarget=null)を発生させdocument.body
      // へフォーカスを落とす(Phase16.43調査で確認した既存の構造的バグ)。originalへ明示的にfocusして
      // からclickすることで大半のアプリではこれを未然に防げるが、original自身がdisplay:none等で
      // フォーカス不能なアプリも存在するため(Phase16.44-C調査)、その場合に備えたfallbackも用意する。
      var controlsId = original.getAttribute('aria-controls');
      var beforeVisible = null;
      if (!controlsId) {
        // aria-controlsが無いアプリ向け: クリック前の可視要素集合を保存し、
        // fallback時にクリック後との差分(新たに可視化された要素)を求める。
        beforeVisible = new Set();
        document.querySelectorAll('body *').forEach(function(el){
          if (el.getClientRects().length > 0) beforeVisible.add(el);
        });
      }
      original.focus();
      original.click();
      // BODYへ落ちた場合に加え、original.focus()自体は成功しているがoriginalがgenerate.jsにより
      // 恒常的にopacity:0/display:noneで隠されているため、キーボード操作者から見て不可視なフォーカス
      // (例: time-timerの#settingsToggle)が残るケースも救済する(Phase16.45-B)。アプリ独自のfocus処理が
      // 既にoriginal以外の要素へ移動させている場合はここで何もしない(既存の独自focus処理を壊さないため)。
      // janken-app/register-app等、自前で約50ms後にfocusを移すアプリより十分後の100msで判定する。
      setTimeout(function(){
        var active = document.activeElement;
        var needsFallback = (active === document.body) || (active === original && !donomanaIsFocusable(original));
        if (!needsFallback) return;
        var target = null;
        if (controlsId) {
          target = donomanaFirstFocusable(document.getElementById(controlsId));
        } else {
          var newly = [];
          document.querySelectorAll('body *').forEach(function(el){
            if (el.getClientRects().length > 0 && !beforeVisible.has(el)) newly.push(el);
          });
          for (var i = 0; i < newly.length; i++) {
            if (/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(newly[i].tagName) && donomanaIsFocusable(newly[i])) { target = newly[i]; break; }
          }
        }
        if (target) target.focus();
      }, 100);
    });
  }` : '';

  return `<!-- a11y-panel: 自動挿入 (generate.js) -->
${proxyHideCSS}
<style>#donomanaA11yBtn:focus-visible,#donomanaA11yPanel button:focus-visible{outline:3px solid #00A99D;outline-offset:2px;}</style>
<button id="donomanaA11yBtn" class="scannable" data-scan="1" aria-label="アクセシビリティ設定" aria-expanded="false" aria-controls="donomanaA11yPanel" title="アクセシビリティ設定" style="position:fixed;bottom:16px;right:16px;z-index:99998;width:48px;height:48px;border-radius:50%;border:none;background:#00A99D;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">⚙</button>
<div id="donomanaA11yPanel" role="dialog" aria-label="アクセシビリティ設定" aria-hidden="true" style="display:none;position:fixed;bottom:76px;right:16px;z-index:99998;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);padding:18px;width:260px;max-width:calc(100vw - 32px);font-family:'Noto Sans JP',sans-serif;">
  <div style="font-weight:900;font-size:14px;margin-bottom:12px;color:#333;">⚙ アクセシビリティ設定</div>${proxyRowHTML}
  <div style="font-size:12px;font-weight:700;color:#666;margin-bottom:6px;">🎨 表示モード</div>
  <div style="display:flex;gap:6px;margin-bottom:14px;">
    <button data-a11y-contrast="normal" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">通常</button>
    <button data-a11y-contrast="hc" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">ハイコントラスト</button>
  </div>
  <div style="font-size:12px;font-weight:700;color:#666;margin-bottom:6px;">🔤 文字の大きさ</div>
  <div style="display:flex;gap:6px;margin-bottom:14px;">
    <button data-a11y-font="normal" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">標準</button>
    <button data-a11y-font="large" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">大</button>
    <button data-a11y-font="xlarge" style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px 4px;border-radius:8px;border:2px solid #ddd;background:#fff;font-size:12px;font-weight:700;cursor:pointer;">特大</button>
  </div>${srSectionHTML}
  <button id="donomanaA11yReset" style="width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px;border-radius:8px;border:none;background:#f0f0f0;color:#333;font-size:12px;font-weight:900;cursor:pointer;">↺ すべてリセット</button>
</div>
<div id="donomanaA11yStatus" role="status" aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;padding:0;margin:-1px;"></div>
<script>
(function(){
  var P = 'donomana-a11y-';
  function all(sel){return document.querySelectorAll(sel);}
  function mark(sel, dataAttr, value){
    all(sel).forEach(function(b){
      var on = b.dataset[dataAttr] === value;
      b.style.background = on ? '#00A99D' : '#fff';
      b.style.color = on ? '#fff' : '#333';
      b.style.borderColor = on ? '#00A99D' : '#ddd';
    });
  }
  var donomanaAnnounceA11yTimer = null;
  function donomanaAnnounceA11y(msg){
    var live = document.getElementById('donomanaA11yStatus');
    if (!live) return;
    clearTimeout(donomanaAnnounceA11yTimer);
    live.textContent = '';
    donomanaAnnounceA11yTimer = setTimeout(function(){ live.textContent = msg; }, 50);
  }
  function applyContrast(mode){
    // 背景を黒・文字を白に反転する方式(弱視・色覚特性のある方向けに、
    // 単純なコントラスト強調より確実に見やすくなるため)
    document.documentElement.style.filter = (mode === 'hc') ? 'invert(1) hue-rotate(180deg)' : '';
    mark('[data-a11y-contrast]', 'a11yContrast', mode);
    localStorage.setItem(P + 'contrast', mode);
  }
  function applyFont(size){
    var zoomMap = { normal: '', large: '125%', xlarge: '150%' };
    document.body.style.zoom = zoomMap[size] || '';
    mark('[data-a11y-font]', 'a11yFont', size);
    localStorage.setItem(P + 'font', size);
  }
  ${srScriptHTML}
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('donomanaA11yBtn');
    var panel = document.getElementById('donomanaA11yPanel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var open = panel.style.display === 'block';
      panel.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.setAttribute('aria-hidden', open ? 'true' : 'false');
    });
    document.addEventListener('click', function(e){
      if (!panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');
      }
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && panel.style.display === 'block') btn.click();
    });
    all('[data-a11y-contrast]').forEach(function(b){ b.addEventListener('click', function(){
      applyContrast(b.dataset.a11yContrast);
      donomanaAnnounceA11y(b.dataset.a11yContrast === 'hc' ? 'ハイコントラストをオンにしました' : 'ハイコントラストをオフにしました');
    }); });
    all('[data-a11y-font]').forEach(function(b){ b.addEventListener('click', function(){
      applyFont(b.dataset.a11yFont);
      donomanaAnnounceA11y('文字の大きさを' + ({normal:'標準',large:'大',xlarge:'特大'}[b.dataset.a11yFont] || '標準') + 'にしました');
    }); });
    ${srWireHTML}
    ${proxyScriptHTML}
    var resetBtn = document.getElementById('donomanaA11yReset');
    if (resetBtn) resetBtn.addEventListener('click', function(){
      applyContrast('normal'); applyFont('normal'); ${srResetHTML}
      localStorage.removeItem(P + 'contrast'); localStorage.removeItem(P + 'font'); ${srRemoveHTML}
      donomanaAnnounceA11y('設定をリセットしました');
    });
    applyContrast(localStorage.getItem(P + 'contrast') || 'normal');
    applyFont(localStorage.getItem(P + 'font') || 'normal');
    ${srRestoreHTML}
  });
})();
</script>
<!-- /a11y-panel -->`;
}

// アプリごとに必要なボタンだけを含んだHTML/JSブロックを生成する
function buildLockFsHTML(needFs, needLock) {
  if (!needFs && !needLock) return null;
  const buttons = [];
  if (needLock) {
    buttons.push('<button id="donomanaLockBtn" class="scannable" data-scan="1" aria-label="がめんをロック" title="がめんをロック（画面がうしろに戻るのをふせぎます）" style="min-width:44px;min-height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.92);font-size:18px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">🔓</button>');
  }
  if (needFs) {
    buttons.push('<button id="donomanaFsBtn" class="scannable" data-scan="1" aria-label="全画面表示" title="全画面表示" style="min-width:44px;min-height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.92);font-size:18px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">⛶</button>');
  }
  const toastHTML = needLock
    ? '<div id="donomanaLockToast" role="alert" aria-live="assertive" style="position:fixed;top:112px;left:50%;transform:translateX(-50%) translateY(-10px);background:#c0392b;color:#fff;font-size:14px;font-weight:700;padding:10px 20px;border-radius:40px;box-shadow:0 4px 24px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:100000;white-space:nowrap;"></div>'
    : '';
  return [
    '<!-- lock-fs-btn: 自動挿入 (generate.js) -->',
    '<style>#donomanaLockBtn:focus-visible,#donomanaFsBtn:focus-visible{outline:3px solid #00A99D;outline-offset:2px;}</style>',
    `<div style="position:fixed;top:64px;right:12px;z-index:99999;display:flex;gap:8px;">`,
    `  ${buttons.join('\n  ')}`,
    `</div>`,
    toastHTML,
    `<script>
(function(){
  var locked=false, toastTimer=null;
  function toast(msg){
    var el=document.getElementById('donomanaLockToast');
    if(!el)return;
    el.textContent=msg;
    el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)';
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){el.style.opacity='0';el.style.transform='translateX(-50%) translateY(-10px)';},2200);
  }
  function setLock(on){
    locked=on;
    var btn=document.getElementById('donomanaLockBtn');
    if(btn){
      btn.textContent=on?'🔒':'🔓';
      btn.style.background=on?'rgba(255,80,80,0.92)':'rgba(255,255,255,0.92)';
      btn.setAttribute('aria-label',on?'ロックちゅう（タップでかいじょ）':'がめんをロック');
    }
    if(on){
      history.pushState({donomanaLocked:true},'');
      history.pushState({donomanaLocked:true},'');
      toast('🔒 がめんをロックしたよ');
    } else {
      toast('🔓 ロックをかいじょしたよ');
    }
  }
  window.addEventListener('popstate',function(){
    if(locked){history.pushState({donomanaLocked:true},'');toast('🔒 まえの がめんには もどれないよ');}
  });
  window.addEventListener('beforeunload',function(e){
    if(locked){e.preventDefault();e.returnValue='';}
  });
  document.addEventListener('DOMContentLoaded',function(){
    var lockBtn=document.getElementById('donomanaLockBtn');
    if(lockBtn)lockBtn.addEventListener('click',function(){setLock(!locked);});
    var homeBtn=document.getElementById('donomanaHomeBtn');
    if(homeBtn){
      homeBtn.addEventListener('click',function(e){
        if(locked){e.preventDefault();toast('🔒 まえの がめんには もどれないよ');}
      });
    }
    var fsBtn=document.getElementById('donomanaFsBtn');
    function inFS(){return !!(document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement);}
    function updateFsBtn(){if(fsBtn){fsBtn.textContent=inFS()?'⊡':'⛶';fsBtn.setAttribute('aria-label',inFS()?'全画面を解除':'全画面表示');}}
    ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange'].forEach(function(ev){document.addEventListener(ev,updateFsBtn);});
    if(fsBtn)fsBtn.addEventListener('click',function(){
      if(!inFS()){
        var el=document.documentElement;
        var req=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen;
        if(req)req.call(el);
      } else {
        var ex=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen;
        if(ex)ex.call(document);
      }
    });
  });
})();
</script>`,
    '<!-- /lock-fs-btn -->'
  ].join('\n');
}

// Announcement共通ヘルパー: アプリ固有の状態通知(操作結果・スコア更新等)を
// 汎用的にスクリーンリーダーへ伝えるための window.donomanaAnnounce() を提供する。
// donomanaAnnounceA11y() (a11yパネル専用・非公開) とは別に、polite/assertive
// それぞれ独立したlive regionとタイマーを持つ。除外リストは設けず全アプリへ配布する。
function buildAnnounceHelperHTML() {
  return [
    '<!-- announce-helper: 自動挿入 (generate.js) -->',
    '<div id="donomanaAnnouncePolite" role="status" aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;padding:0;margin:-1px;"></div>',
    '<div id="donomanaAnnounceAssertive" role="alert" aria-live="assertive" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;padding:0;margin:-1px;"></div>',
    `<script>
(function(){
  if (window.donomanaAnnounce) return;
  var politeTimer = null, assertiveTimer = null;
  function donomanaAnnounce(message, options){
    if (typeof message !== 'string') return;
    if (message.trim() === '') return;
    var opts = options || {};
    var priority = (opts.priority === 'assertive') ? 'assertive' : 'polite';
    var clearDelay = (typeof opts.clearDelay === 'number' && Number.isFinite(opts.clearDelay) && opts.clearDelay >= 0) ? opts.clearDelay : 50;
    var elId = (priority === 'assertive') ? 'donomanaAnnounceAssertive' : 'donomanaAnnouncePolite';
    var live = document.getElementById(elId);
    if (!live) return;
    if (priority === 'assertive') { clearTimeout(assertiveTimer); } else { clearTimeout(politeTimer); }
    live.textContent = '';
    var timer = setTimeout(function(){ live.textContent = message; }, clearDelay);
    if (priority === 'assertive') { assertiveTimer = timer; } else { politeTimer = timer; }
  }
  window.donomanaAnnounce = donomanaAnnounce;
})();
</script>`,
    '<!-- /announce-helper -->'
  ].join('\n');
}

// Design Token専用ブロック: Design System 3.0(Phase17.2-A)で確定したToken定義を配布する。
// :root の変数定義と、OS設定に連動するprefers-reduced-motionのみであり、
// 通常表示に影響する汎用セレクタは含めない(既存29アプリの見た目・動作は変更しない)。
// 各アプリのCSSが これらの変数を参照するよう書き換える作業はPhase17.3-Aの対象外(Token配布のみ)。
// 影(--dm-shadow-*)はDesign System 9.9.1ログ#5により引き続き対象外とする。
// フォントファミリーTokenはPhase17.3-Aでは追加しない(サイズ・行間Tokenのみ)。
function buildDesignTokensHTML() {
  return [
    '<!-- design-tokens: 自動挿入 (generate.js) -->',
    '<style>',
    ':root{',
    '  --dm-radius-sm:5px;',
    '  --dm-radius-md:9px;',
    '  --dm-radius-pill:999px;',
    '  --dm-radius-circle:50%;',
    '  --dm-focus-width:3px;',
    '  --dm-focus-color:#00A99D;',
    '  --dm-focus-offset:2px;',
    '  --dm-color-primary:#00A99D;',
    '  --dm-color-primary-dark:#00857B;',
    '  --dm-color-accent:#F5A623;',
    '  --dm-color-info:#4A8FD9;',
    '  --dm-color-danger:#EE6C7C;',
    '  --dm-color-danger-text:#BA5461;',
    '  --dm-color-surface:#FFFFFF;',
    '  --dm-color-soft:#F6F9FA;',
    '  --dm-color-border:#EDF1F0;',
    '  --dm-color-ink:#3B4A54;',
    '  --dm-color-sub:#5E6D78;',
    '  --dm-color-bg:#FFFFFF;',
    '  --dm-space-1:4px;',
    '  --dm-space-2:8px;',
    '  --dm-space-3:12px;',
    '  --dm-space-4:16px;',
    '  --dm-space-5:20px;',
    '  --dm-space-6:24px;',
    '  --dm-space-7:32px;',
    '  --dm-space-8:48px;',
    '  --dm-space-9:64px;',
    '  --dm-duration-fast:150ms;',
    '  --dm-duration-base:250ms;',
    '  --dm-easing-standard:ease;',
    '  --dm-font-size-display:2rem;',
    '  --dm-font-size-heading:1.5rem;',
    '  --dm-font-size-subheading:1.25rem;',
    '  --dm-font-size-body:1.0625rem;',
    '  --dm-font-size-body-kid:1.5rem;',
    '  --dm-font-size-caption:0.8125rem;',
    '  --dm-line-height-heading:1.4;',
    '  --dm-line-height-body:1.7;',
    '  --dm-line-height-body-kid:1.8;',
    '  --dm-line-height-caption:1.6;',
    '}',
    '@media (prefers-reduced-motion: reduce){',
    '  *,*::before,*::after{',
    '    animation-duration:0.01ms !important;',
    '    animation-iteration-count:1 !important;',
    '    transition-duration:0.01ms !important;',
    '    scroll-behavior:auto !important;',
    '  }',
    '}',
    '</style>',
    '<!-- /design-tokens -->'
  ].join('\n');
}

// ============================================================
//  Donomana Gaze Foundation (Phase M11.4-A PoC)
//  ・docs/design-system/donomana-gaze-accessibility-standard-v1_0.md §33.3の
//    SAFE TO SHARE分類のみを対象とする(定数・純粋関数・CSS)。
//  ・SHARE WITH OPTIONS（hitTestGazeTargets等）・KEEP LOCAL（gaze tick状態機械・
//    canonical/transient state・activation function等）は対象外。各アプリの
//    手書きコードに残す(§33.4の設計方針どおり、Switch Scan helper6と同じく
//    「契約は揃えるが実装は手書きを維持する」領域)。
//  ・対象アプリはGAZE_SHARED_FOUNDATION_APPSに明示登録した場合のみ(全アプリ
//    一括適用はしない。Phase M11.4-Aはmitsukete-touch-appのみ)。
// ============================================================
const GAZE_SHARED_FOUNDATION_APPS = new Set(['mitsukete-touch-app', 'junban-miyou-app', 'miru-hirogaru-app', 'kurabeyou-app', 'katachi-awase-app', 'kimochi-board']);

function buildGazeSharedFoundationCSSHTML() {
  return [
    '<!-- gaze-shared-css: 自動挿入 (generate.js) -->',
    '<style>',
    '  .stepper-btn { min-width: 44px; min-height: 44px; border-radius: var(--dm-radius-md,9px); border: 2px solid var(--dm-color-border,#EDF1F0); background: #fff; font-size: 1.125rem; font-weight: 700; cursor: pointer; }',
    '  .stepper-btn:focus-visible { outline: var(--dm-focus-width,3px) solid var(--dm-focus-color,#00A99D); outline-offset: 2px; }',
    '  .stepper-val { min-width: 4.2em; text-align: center; font-size: 0.9375rem; font-weight: 700; }',
    '</style>',
    '<!-- /gaze-shared-css -->'
  ].join('\n');
}

function buildGazeSharedFoundationJSHTML() {
  return [
    '<!-- gaze-shared-js: 自動挿入 (generate.js) -->',
    '<script>',
    '/* Donomana Gaze Foundation (Phase M11.4-A/B) — SAFE TO SHARE constants and',
    '   pure helper functions common to Gaze Accessibility Standard v1.0',
    '   implementations (docs/design-system/donomana-gaze-accessibility-standard-v1_0.md',
    '   §33.3/§34/§35). Auto-injected by generate.js — edit generate.js\'s',
    '   buildGazeSharedFoundationJSHTML() instead of this block directly. */',
    'var DWELL_MIN_MS = 300, DWELL_MAX_MS = 3000, DWELL_STEP_MS = 100;               // §8.2',
    'var ENTRY_DELAY_MIN_MS = 0, ENTRY_DELAY_MAX_MS = 500, ENTRY_DELAY_STEP_MS = 50;  // §9.3',
    'var COOLDOWN_MIN_MS = 300, COOLDOWN_MAX_MS = 3000, COOLDOWN_STEP_MS = 100;       // §10',
    'var TARGET_SCALE_STANDARD = 100, TARGET_SCALE_LARGE = 150;                      // §12.3',
    'var MOTION_SLOW_FACTOR = 1.4;                                                   // §14.2',
    'function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }',
    'function effMs(baseMs) { return (motionSpeedLevel === \'slow\') ? Math.round(baseMs * MOTION_SLOW_FACTOR) : baseMs; }',
    'function formatSecondsLabel(ms) { return (ms / 1000).toFixed(1) + \'秒\'; }',
    'function wireStepper(minusId, plusId, valId, get, set, min, max, step, format) {',
    '  var valEl = document.getElementById(valId);',
    '  function refresh() { valEl.textContent = format(get()); }',
    '  document.getElementById(minusId).addEventListener(\'click\', function() { set(clamp(get() - step, min, max)); refresh(); saveSettings(); });',
    '  document.getElementById(plusId).addEventListener(\'click\', function() { set(clamp(get() + step, min, max)); refresh(); saveSettings(); });',
    '  refresh();',
    '  return refresh;',
    '}',
    '// hitTestGazeTargets: upgraded from SHARE WITH OPTIONS to SAFE TO SHARE in',
    '// Phase M11.4-B after confirming byte-identical bodies across all 3 Pilot',
    '// apps (§35.2). options: { scale: <percent, default 100>, erosion: <px,',
    '// default 0> }. Call sites (KEEP LOCAL, per-app gaze-tick code) assemble',
    '// and pass these from their own gazeTargetScalePct/targetSpacingWide state;',
    '// miru-hirogaru never passes erosion (its spacing uses CSS gap instead),',
    '// which this default cleanly reproduces without any app-specific branch here.',
    'function hitTestGazeTargets(x, y, targets, options) {',
    '  var opts = options || {};',
    '  var scalePct = (typeof opts.scale === \'number\') ? opts.scale : 100;',
    '  var erosionPx = (typeof opts.erosion === \'number\') ? opts.erosion : 0;',
    '  if (scalePct <= 100 && erosionPx <= 0) {',
    '    var el = document.elementFromPoint(x, y);',
    '    if (!el) return null;',
    '    for (var i = 0; i < targets.length; i++) { if (targets[i] === el || targets[i].contains(el)) return targets[i]; }',
    '    return null;',
    '  }',
    '  var scale = scalePct / 100;',
    '  var best = null, bestArea = Infinity;',
    '  for (var j = 0; j < targets.length; j++) {',
    '    var r = targets[j].getBoundingClientRect();',
    '    var padX = Math.max(0, (r.width * (scale - 1) / 2) - erosionPx);',
    '    var padY = Math.max(0, (r.height * (scale - 1) / 2) - erosionPx);',
    '    if (x >= r.left - padX && x <= r.right + padX && y >= r.top - padY && y <= r.bottom + padY) {',
    '      var area = r.width * r.height;',
    '      if (area < bestArea) { bestArea = area; best = targets[j]; }',
    '    }',
    '  }',
    '  return best;',
    '}',
    '</script>',
    '<!-- /gaze-shared-js -->'
  ].join('\n');
}

function injectGazeSharedFoundationToAppHtmls(apps) {
  const cssStartMark = '<!-- gaze-shared-css: 自動挿入 (generate.js) -->';
  const cssEndMark   = '<!-- /gaze-shared-css -->';
  const jsStartMark  = '<!-- gaze-shared-js: 自動挿入 (generate.js) -->';
  const jsEndMark    = '<!-- /gaze-shared-js -->';
  const cssBlock = buildGazeSharedFoundationCSSHTML();
  const jsBlock  = buildGazeSharedFoundationJSHTML();
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    if (!GAZE_SHARED_FOUNDATION_APPS.has(app.filename)) continue;
    const fname = `${app.filename}.html`;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      let html = original;

      // CSS: 既存マーカーがあれば差し替え、なければ</title>直後(design-tokensの直前)に挿入
      const cssStartIdx = html.indexOf(cssStartMark);
      if (cssStartIdx !== -1) {
        const cssEndIdx = html.indexOf(cssEndMark, cssStartIdx);
        if (cssEndIdx !== -1) html = html.slice(0, cssStartIdx) + cssBlock + html.slice(cssEndIdx + cssEndMark.length);
      } else {
        const titleEnd = html.indexOf('</title>');
        const headMatch = html.match(/<head[^>]*>/);
        const insertAt = titleEnd !== -1 ? titleEnd + '</title>'.length
                       : headMatch ? headMatch.index + headMatch[0].length : -1;
        if (insertAt !== -1) html = html.slice(0, insertAt) + '\n' + cssBlock + html.slice(insertAt);
      }

      // JS: 既存マーカーがあれば差し替え、なければアプリ本体script直前に挿入
      // -- wireStepper()等はアプリ本体scriptのトップレベルで即時呼び出されるため、
      //    このscriptタグは必ずアプリ本体scriptより前に置く必要がある。
      //    アンカーは</main>ではなくファイル内最後の<script>タグの直前とする
      //    (Phase M11.4-B判明: junban-miyou-app.htmlは<main>を持たず
      //    <div class="app">を使うため</main>アンカーが不成立。lock-fs-btn/
      //    home-btn/announce-helper/a11y-panel等の共通chrome scriptは全アプリで
      //    アプリ本体scriptより前に位置するため、「最後の<script>タグ」は
      //    <main>の有無によらずアプリ本体scriptを指す)。
      const jsStartIdx = html.indexOf(jsStartMark);
      if (jsStartIdx !== -1) {
        const jsEndIdx = html.indexOf(jsEndMark, jsStartIdx);
        if (jsEndIdx !== -1) html = html.slice(0, jsStartIdx) + jsBlock + html.slice(jsEndIdx + jsEndMark.length);
      } else {
        const lastScriptIdx = html.lastIndexOf('<script>');
        if (lastScriptIdx !== -1) {
          const insertAt = lastScriptIdx;
          html = html.slice(0, insertAt) + jsBlock + '\n' + html.slice(insertAt);
        }
      }

      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname}`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n👁 Gaze Shared Foundation挿入(PoC対象アプリのみ): ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0) log.forEach(l => console.log(l));
}

// ============================================================
//  Donomana Learning Record Foundation (Phase T5-B PoC)
//  ・docs/design-system/donomana-learning-record-standard-v1_0.md の
//    Storage API(readLog/writeLog/addLog/clearLog相当)・schemaVersion
//    fallback・CSV組み立てのみを共有する。各アプリのstorage key・
//    record schema(教材固有フィールド)はアプリ側に残す
//    (Gaze Shared Foundationと同じく「契約は揃えるが実装は手書きを
//    維持する」領域が中心。ここで共有するのはlocalStorage I/Oの
//    メカニクスのみ)。
//  ・対象アプリはLEARNING_RECORD_FOUNDATION_APPSに明示登録した場合のみ
//    (全アプリ一括適用はしない。Phase T5-BはPilot 2本のみ: miru-hirogaru-app
//    ・hiragana-learn)。
// ============================================================
// Phase T5-E-B: Multi-Input sibling apps(miru-hirogaru-appと同型のFoundation未統合5本)を
// 追加。既存writer(readLog/writeLog/addLog等)をFoundationのdonomanaRecordReadLog/WriteLog/
// AddLog/ClearLogへ委譲する方式(directions-app方式)。Foundation API自体は追加していない。
// Phase T5-E-C: okane-app(okane_activity_log配列のみ委譲。okane_records集計統計objectは
// Learning Recordではないため対象外)・sst-app(sst_activity_log_v1配列のみ委譲。
// sst_diary_entries_v1〈きもち日記、音声入力を含みうる〉はPrivacy境界のため対象外)を追加。
const LEARNING_RECORD_FOUNDATION_APPS = new Set(['miru-hirogaru-app', 'hiragana-learn', 'directions-app', 'kyou-no-kiroku', 'katakana-app', 'suji-manabou', 'mitsukete-touch-app', 'junban-miyou-app', 'kurabeyou-app', 'katachi-awase-app', 'dotchiga-ii-app', 'okane-app', 'sst-app']);

function buildLearningRecordFoundationJSHTML() {
  return [
    '<!-- learning-record-foundation-js: 自動挿入 (generate.js) -->',
    '<script>',
    '/* Donomana Learning Record Foundation (Phase T5-B PoC) — shared localStorage-backed',
    '   activity-log read/write/normalize helpers common to Learning Record Standard v1.0',
    '   (docs/design-system/donomana-learning-record-standard-v1_0.md). Auto-injected by',
    '   generate.js — edit generate.js\'s buildLearningRecordFoundationJSHTML() instead of',
    '   this block directly. Each app keeps its own storage key and its own record shape;',
    '   this Foundation standardizes only the read/write/normalize/CSV mechanics, never',
    '   the app-specific payload fields. */',
    'function donomanaRecordReadLog(storageKey) {',
    '  try { var raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }',
    '}',
    'function donomanaRecordWriteLog(storageKey, log) {',
    '  try { localStorage.setItem(storageKey, JSON.stringify(log)); } catch (e) {}',
    '}',
    'function donomanaRecordAddLog(storageKey, entry) {',
    '  var log = donomanaRecordReadLog(storageKey);',
    '  log.push(entry);',
    '  donomanaRecordWriteLog(storageKey, log);',
    '  return log;',
    '}',
    'function donomanaRecordClearLog(storageKey) {',
    '  donomanaRecordWriteLog(storageKey, []);',
    '}',
    '// schemaVersion欠落 = legacy v1として扱う(Standard §9)。既存フィールドは書き換えない。',
    'function donomanaRecordNormalizeLegacy(entry) {',
    '  if (entry && typeof entry === \'object\' && entry.schemaVersion == null) entry.schemaVersion = 1;',
    '  return entry;',
    '}',
    '// Standard Core Schemaに沿った新規recordを組み立てる(将来のnested payload移行用。',
    '// 既存2 Pilotの実データ形式は変更しない。関数として提供し単体テストのみ対象)。',
    'function donomanaRecordCreate(appId, activity, inputMethod, payload) {',
    '  return {',
    '    timestamp: new Date().toISOString(),',
    '    appId: appId,',
    '    activity: activity,',
    '    inputMethod: (typeof inputMethod === \'string\') ? inputMethod : null,',
    '    schemaVersion: 1,',
    '    payload: payload || {}',
    '  };',
    '}',
    '// UTF-8 BOM付きCSV文字列を組み立てる(Standard §17)。rows: 2次元配列(先頭行=header)。',
    '// ダウンロードUI自体は各アプリの既存実装を維持し、統一しない。',
    'function donomanaRecordBuildCsv(rows) {',
    '  function esc(v) {',
    '    var s = (v === null || v === undefined) ? \'\' : String(v);',
    '    return /["\\,\\n]/.test(s) ? \'"\' + s.replace(/"/g, \'""\') + \'"\' : s;',
    '  }',
    '  var body = rows.map(function(r) { return r.map(esc).join(\',\'); }).join(\'\\n\');',
    '  return \'\\uFEFF\' + body;',
    '}',
    '// Phase T5-C: Composite Storage Adapter — storageKeyの値がrecord配列そのものではなく',
    '// { records: [...], ...他のapp-specific property } のような複合objectの場合に、',
    '// 指定fieldだけを読み書きし、他のpropertyを完全に保持する(既知/未知を問わず)。',
    '// kyou-no-kiroku専用ではなく、同様の複合storage構造を持つ将来アプリでも再利用できる',
    '// 汎用primitiveとして提供する。array-basedのdonomanaRecordReadLog/WriteLogを',
    '// 複合objectのstorageKeyへ直接使わないこと(recordsだけの配列で他propertyを',
    '// 上書き破壊してしまう)。',
    'function donomanaRecordReadNestedCollection(storageKey, field) {',
    '  try {',
    '    var raw = localStorage.getItem(storageKey);',
    '    var obj = raw ? JSON.parse(raw) : null;',
    '    var arr = (obj && typeof obj === \'object\' && !Array.isArray(obj)) ? obj[field] : undefined;',
    '    return Array.isArray(arr) ? arr : [];',
    '  } catch (e) { return []; }',
    '}',
    'function donomanaRecordWriteNestedCollection(storageKey, field, collection) {',
    '  try {',
    '    var raw = localStorage.getItem(storageKey);',
    '    var obj = null;',
    '    try { obj = raw ? JSON.parse(raw) : null; } catch (e2) { obj = null; }',
    '    if (!obj || typeof obj !== \'object\' || Array.isArray(obj)) obj = {};',
    '    obj[field] = collection;',
    '    localStorage.setItem(storageKey, JSON.stringify(obj));',
    '  } catch (e) {}',
    '}',
    '// Phase T5-D: UI Foundation — Data Foundation(read/write/normalize/CSV)とは責務を分離した',
    '// 純粋な表示整形/grouping関数群(DOM操作なし、副作用なし)。Common Viewerの「Core表示」を',
    '// 構成する最小限のhelperのみを提供し、教材固有の要約文(例:「『あ』のなぞり」)は各アプリの',
    '// adapter責務のまま残す(Switch Scan共通仕様16.3節と同じ、helperはlifecycle/整形、',
    '// adapterはcontentという責務分離)。',
    '// timeValueはISO 8601・ja-JPロケール文字列('
      + '"2026/8/29 19:28:18"'
      + ')・epoch msのいずれでも受け付け、解析できない場合は元の値をそのまま返す(値の欠落・空文字表示を防ぐ)。',
    'function donomanaRecordFormatDateTime(timeValue) {',
    '  try {',
    '    if (timeValue === null || timeValue === undefined || timeValue === \'\') return \'\';',
    '    var d = (timeValue instanceof Date) ? timeValue : new Date(timeValue);',
    '    if (isNaN(d.getTime())) return (timeValue === null || timeValue === undefined) ? \'\' : String(timeValue);',
    '    var p = function (n) { return n < 10 ? \'0\' + n : String(n); };',
    '    return (d.getMonth() + 1) + \'/\' + d.getDate() + \' \' + p(d.getHours()) + \':\' + p(d.getMinutes());',
    '  } catch (e) { return (timeValue === null || timeValue === undefined) ? \'\' : String(timeValue); }',
    '}',
    '// Phase T5-E-A\': CSV Date/Time Excel Compatibility Fix — Excelは日時1列のCSV文字列を日付/時刻値',
    '// として自動認識するが、CSVには列幅情報を保存できないため既定列幅に収まらず「#######」表示に',
    '// なる(内部timestampやData Foundationのnormalize処理は無変更、CSV表示専用のpure helper)。',
    '// 日付・時刻の2列へ分離するだけでは不十分だった点に注意(実Excelで検証して判明): ハイフン',
    '// 区切り("2026-08-30")・スラッシュ区切り・漢字区切り("2026年8月30日")はいずれもExcelの自動',
    '// 日付認識に該当し、月または日が2桁の日付(1年の大半)では既定列幅を超えて結局#######に',
    '// なる。ドット区切り("2026.08.30")のみExcelの自動認識に該当せず常にプレーンテキストとして',
    '// 表示されることを実Excel COM検証で確認したため採用する。時刻(HH:MM:SS、コロン区切り)は',
    '// 自動的に時刻値へ変換されるが表示文字列が最大8文字("23:59:59")に収まり既定列幅を超えない',
    '// ことを確認済みのため、読みやすさを優先しコロン区切りのまま維持する。',
    '// timeValueはdonomanaRecordFormatDateTimeと同じくISO 8601・ja-JPロケール文字列・epoch ms・',
    '// Dateいずれも受け付ける。ローカル時刻basisで整形する(既存Viewerの表示・',
    '// donomanaRecordFormatDateTimeと同じlocal basisに揃え、UTCとの新たな時差混乱を作らない)。',
    '// 解析できない場合は元の文字列をdateへそのまま保持し(空白化・推測変換はしない)、timeは',
    '// 空文字を返す。',
    'function donomanaRecordFormatCsvDateTime(timeValue) {',
    '  try {',
    '    if (timeValue === null || timeValue === undefined || timeValue === \'\') return { date: \'\', time: \'\' };',
    '    var d = (timeValue instanceof Date) ? timeValue : new Date(timeValue);',
    '    if (isNaN(d.getTime())) return { date: String(timeValue), time: \'\' };',
    '    var p = function (n) { return n < 10 ? \'0\' + n : String(n); };',
    '    var date = d.getFullYear() + \'.\' + p(d.getMonth() + 1) + \'.\' + p(d.getDate());',
    '    var time = p(d.getHours()) + \':\' + p(d.getMinutes()) + \':\' + p(d.getSeconds());',
    '    return { date: date, time: time };',
    '  } catch (e) { return { date: (timeValue === null || timeValue === undefined) ? \'\' : String(timeValue), time: \'\' }; }',
    '}',
    '// entriesを日付ごとにグループ化する(新しい日付が先頭、group内も新しい順)。getTimeFnを渡さない',
    '// 場合はentry.timeを使う。解析できないtimestampのentryは「日付不明」groupへ末尾でまとめる',
    '// (無視・削除はしない)。',
    'function donomanaRecordGroupByDate(entries, getTimeFn) {',
    '  function dateKey(d) {',
    '    var p = function (n) { return n < 10 ? \'0\' + n : String(n); };',
    '    return d.getFullYear() + \'-\' + p(d.getMonth() + 1) + \'-\' + p(d.getDate());',
    '  }',
    '  var todayKey = dateKey(new Date());',
    '  var yesterdayKey = dateKey(new Date(Date.now() - 86400000));',
    '  var groups = {};',
    '  (entries || []).forEach(function (entry) {',
    '    var raw = getTimeFn ? getTimeFn(entry) : entry.time;',
    '    var d = new Date(raw);',
    '    var valid = !isNaN(d.getTime());',
    '    var key = valid ? dateKey(d) : \'__unknown__\';',
    '    if (!groups[key]) groups[key] = [];',
    '    groups[key].push({ entry: entry, ms: valid ? d.getTime() : -1 });',
    '  });',
    '  var keys = Object.keys(groups).sort(function (a, b) {',
    '    if (a === \'__unknown__\') return 1;',
    '    if (b === \'__unknown__\') return -1;',
    '    return a < b ? 1 : (a > b ? -1 : 0);',
    '  });',
    '  return keys.map(function (key) {',
    '    var items = groups[key].slice().sort(function (a, b) { return b.ms - a.ms; });',
    '    var label = key === \'__unknown__\' ? \'日付不明\'',
    '      : key === todayKey ? \'きょう\'',
    '      : key === yesterdayKey ? \'きのう\'',
    '      : (function () { var p = key.split(\'-\'); return parseInt(p[1], 10) + \'/\' + parseInt(p[2], 10); })();',
    '    return { dateLabel: label, entries: items.map(function (x) { return x.entry; }) };',
    '  });',
    '}',
    '// inputMethodを利用者向け日本語ラベルへ変換する(Standard Core Schema §5のenumのみ対応)。',
    '// 未知の値・null/undefinedはnullを返す。呼び出し側はnullのとき「不明」等を表示せず、',
    '// 非表示にすることを推奨する(推測禁止の既存方針を維持)。',
    'function donomanaRecordFormatInputMethod(inputMethod) {',
    '  var MAP = { touch: \'タッチ\', gaze: \'視線\', switch: \'スイッチ\', keyboard: \'キーボード\', click: \'クリック\' };',
    '  if (inputMethod === null || inputMethod === undefined) return null;',
    '  return MAP[inputMethod] || null;',
    '}',
    '// hiragana-learn/katakana-appのtracingJudgmentLevel(easy/standard/precise)を',
    '// 利用者向け日本語ラベルへ変換する。フィールド欠落(legacy record)・未知の値はnullを返す。',
    'function donomanaRecordFormatTracingLevel(level) {',
    '  var MAP = { easy: \'やさしく\', standard: \'ひょうじゅん\', precise: \'ていねいに\' };',
    '  return MAP[level] || null;',
    '}',
    '</script>',
    '<!-- /learning-record-foundation-js -->'
  ].join('\n');
}

function injectLearningRecordFoundationToAppHtmls(apps) {
  const jsStartMark = '<!-- learning-record-foundation-js: 自動挿入 (generate.js) -->';
  const jsEndMark   = '<!-- /learning-record-foundation-js -->';
  const jsBlock = buildLearningRecordFoundationJSHTML();
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    if (!LEARNING_RECORD_FOUNDATION_APPS.has(app.filename)) continue;
    const fname = `${app.filename}.html`;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      let html = original;

      // 既存マーカーがあれば差し替え、なければ挿入する。
      // -- Gaze Shared Foundationは「ファイル内最後の<script>タグ」をアンカーに
      //    採用しているが、これは「共通chrome scriptは全アプリでアプリ本体script
      //    より前に位置する」という前提に依存する。hiragana-learn.htmlで検証した
      //    ところ、この前提はM11/M12 Multi-Input教材以外では成立しない(RECORD
      //    scriptブロックの直後に独自のフルスクリーン共通scriptが続く構成のため、
      //    「最後の<script>」がRECORDブロックより後ろに来て donomanaRecordReadLog
      //    等が未定義のまま呼ばれるバグを本Phaseで発見・修正)。
      //    そのためLearning Record Foundationは、各Pilotアプリが実際に
      //    donomanaRecord*() を呼び出している最初の箇所を探し、その箇所を含む
      //    <script>タグの直前へ挿入する(=呼び出しより確実に前に来る)。
      const jsStartIdx = html.indexOf(jsStartMark);
      if (jsStartIdx !== -1) {
        const jsEndIdx = html.indexOf(jsEndMark, jsStartIdx);
        if (jsEndIdx !== -1) html = html.slice(0, jsStartIdx) + jsBlock + html.slice(jsEndIdx + jsEndMark.length);
      } else {
        const usageIdx = html.indexOf('donomanaRecord');
        const anchorScriptIdx = usageIdx !== -1 ? html.lastIndexOf('<script>', usageIdx) : -1;
        const insertAt = anchorScriptIdx !== -1 ? anchorScriptIdx : html.lastIndexOf('<script>');
        if (insertAt !== -1) {
          html = html.slice(0, insertAt) + jsBlock + '\n' + html.slice(insertAt);
        }
      }

      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname}`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n📊 Learning Record Foundation挿入(PoC対象アプリのみ): ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0) log.forEach(l => console.log(l));
}

// ============================================================
//  ファビコン関連: 全ページの <head> に統一して挿入する
//  ・サイトルート絶対パス指定 (/) なので
//    どの階層のページからも同じファビコンが参照される
// ============================================================
const FAVICON_TAGS = [
  '<!-- favicon: 自動挿入 (generate.js) -->',
  `<link rel="icon" href="${BASE_PATH}/favicon.ico" sizes="48x48">`,
  `<link rel="icon" type="image/svg+xml" href="${BASE_PATH}/favicon.svg">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="${BASE_PATH}/favicon-32.png">`,
  `<link rel="icon" type="image/png" sizes="16x16" href="${BASE_PATH}/favicon-16.png">`,
  `<link rel="apple-touch-icon" sizes="180x180" href="${BASE_PATH}/apple-touch-icon.png">`,
  `<link rel="manifest" href="${BASE_PATH}/site.webmanifest">`,
  `<meta name="theme-color" content="#00A99D">`,
  '<!-- /favicon -->'
].join('\n  ');

// HTML文字列に対してファビコンタグを冪等に注入する
// ・既に挿入済みなら何もしない (同じマーカーで再挿入を防止)
// ・既存の "<!-- favicon: 自動挿入" ブロックがあれば置き換え
// ・なければ </head> 直前に挿入
// 戻り値: { html, action: 'inserted'|'replaced'|'skipped'|'no-head' }
function injectFavicon(html) {
  if (typeof html !== 'string') return { html, action: 'skipped' };
  const startMark = '<!-- favicon: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /favicon -->';
  const startIdx = html.indexOf(startMark);
  if (startIdx !== -1) {
    // 既存ブロックを置き換え
    const endIdx = html.indexOf(endMark, startIdx);
    if (endIdx !== -1) {
      const tail = endIdx + endMark.length;
      const newHtml = html.slice(0, startIdx) + FAVICON_TAGS + html.slice(tail);
      return { html: newHtml, action: 'replaced' };
    }
  }
  // </head> の直前に挿入
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) return { html, action: 'no-head' };
  // インデント調整: </head> 行のインデントを取得
  const lineStart = html.lastIndexOf('\n', headEnd) + 1;
  const indent = html.slice(lineStart, headEnd).match(/^\s*/)[0];
  const insertion = indent + FAVICON_TAGS + '\n' + indent;
  const newHtml = html.slice(0, headEnd) + insertion + html.slice(headEnd);
  return { html: newHtml, action: 'inserted' };
}

// filename → themeClass のマッピング（app-intro.html のCSSに対応）
const THEME_CLASS_MAP = {
  'hiragana-learn':   'theme-hiragana',
  'katakana-app':     'theme-katakana',
  'nazori-app':       'theme-nazori',
  'janken-app':       'theme-janken',
  'shiritori2':       'theme-shiritori',
  'okane-app':        'theme-okane',
  'register-app':     'theme-register',
  'tokei-app':        'theme-tokei',
  'schedule-app':     'theme-schedule',
  'timetable-app':    'theme-jikokuhyo',
  'bosai-app':        'theme-bousai',
  'matching-app':     'theme-matching',
  'sugoroku-app':     'theme-sugoroku',
  // 'tyushi' はマッピングせず動的生成(iconColorのオレンジ系。theme-sst=シアン系との重複を回避)
  'cup_game':         'theme-cupgame',
  'sst-app':          'theme-sst',
  'kimochi-board':    'theme-board',
  'drawing-app':      'theme-oekaki',
  'yomikaki-app':     'theme-yomikaki',
  // 'slideshow-sakusei' はマッピングせず動的生成(theme-oekaki=緑系との重複を回避)
  'directions-app':   'theme-directions',
};

function generateIntroCard(app) {
  const mappedTheme = THEME_CLASS_MAP[app.filename];
  const themeClass  = app.themeClass || mappedTheme || safeClassName('theme-', app.filename);
  app._themeClass = themeClass;
  app._dynamicTheme = !mappedTheme && !app.themeClass;
  const catKey = CAT_MAP[app.category] || app.category;
  const featuresHTML = app.features.map(f =>
    `          <li>${f.icon} ${f.title}：${f.desc}</li>`
  ).join('\n');
  const a11yHTML = app.a11y.map(a =>
    `          <span class="access-badge">${a}</span>`
  ).join('');
  return `
    <!-- ${app.title} -->
    <div class="intro-card ${themeClass}" data-cat="${catKey}">
      <div class="intro-card-header">
        ${fs.existsSync(`./assets/icons/${app.id}.png`)
          ? `<img class="intro-icon-img" src="assets/icons/${app.id}.png" alt="" width="64" height="64" loading="lazy" style="width:64px;height:64px;flex-shrink:0;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.12));">`
          : `<div class="intro-icon" style="font-size:40px;background:${app.iconColor};width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${app.icon}</div>`}
        <div class="intro-header-text">
          <div class="intro-app-name">${app.title}</div>
          <span class="intro-tag">${app.tags_display}</span><br>
          <a class="intro-launch-btn" href="${app.filename}.html">▶ アプリをひらく</a>
        </div>
        <div class="intro-header-side">
          <div class="header-qr-block"><div class="header-qr-label">QR</div><div class="header-qr-img" data-url="${BASE_URL}/${app.filename}.html"></div></div>
          <a href="${BASE_URL}/#contactSection" class="header-report-btn" target="_blank"><span class="header-report-icon">✏️</span><span class="header-report-text"><span class="header-report-title">実践報告を送る</span></span></a>
        </div>
      </div>
      <div class="intro-body">
        <div><div class="intro-section-title">概要・ねらい</div><p class="intro-text">${app.summary}</p></div>
        <div><div class="intro-section-title">主な機能</div><ul class="feature-list">
${featuresHTML}
        </ul></div>
        <div><div class="intro-section-title">使い方</div><p class="intro-text">${app.steps.map((s,i) => `${i+1}. ${s.label}：${s.desc}`).join(' ')}</p></div>
        <div><div class="intro-section-title">アクセシビリティ</div><div class="access-badges">
          ${a11yHTML}
        </div></div>
        <div><div class="intro-section-title">授業での活用</div><div class="practice-box">
          <div class="practice-item"><span class="practice-label">対象</span><span class="practice-text">${app.lesson.target}</span></div>
          <div class="practice-item"><span class="practice-label">ねらい</span><span class="practice-text">${app.lesson.goal}</span></div>
          <div class="practice-item"><span class="practice-label">使い方</span><span class="practice-text">${app.lesson.howto}</span></div>
          <div class="practice-item"><span class="practice-label">工夫</span><span class="practice-text">${app.lesson.tips}</span></div>
        </div></div>
        <div><div class="intro-section-title">使用上の留意点</div><div class="caution-box"><p>${app.caution}</p></div></div>
      </div>
    </div>`;
}

// ============================================================
//  ItemList(LearningResource)構造化データの共通生成
//  ・index.html / app-intro.html など複数ページで再利用
// ============================================================
function buildMaterialsItemListJsonLd(apps, listName) {
  const itemListElement = apps.map((app, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "item": {
      "@type": ["CreativeWork", "LearningResource"],
      "name": app.title,
      "url": `${BASE_URL}/app-details/${app.filename}-detail.html`,
      "description": (app.summary || '').replace(/\s+/g, '').slice(0, 100),
      "learningResourceType": "教育用ICTアプリ",
      "isAccessibleForFree": true,
      "inLanguage": "ja",
      "audience": { "@type": "EducationalAudience", "educationalRole": "teacher" }
    }
  }));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": listName,
    "numberOfItems": apps.length,
    "itemListElement": itemListElement
  };
}

function injectStructuredDataBlock(html, jsonLd, markerKey) {
  const startMarker = `<!-- STRUCTURED_DATA_${markerKey}_START -->`;
  const endMarker    = `<!-- STRUCTURED_DATA_${markerKey}_END -->`;
  const block = `${startMarker}\n<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n${endMarker}`;
  const existStart = html.indexOf(startMarker);
  if (existStart !== -1) {
    const existEnd = html.indexOf(endMarker) + endMarker.length;
    return html.slice(0, existStart) + block + html.slice(existEnd);
  }
  const headEnd = html.indexOf('</head>');
  if (headEnd !== -1) return html.slice(0, headEnd) + block + '\n' + html.slice(headEnd);
  return html;
}

// ============================================================
//  app-intro.html: canonical / OGP / Twitter Card / 構造化データを
//  丸ごと整備する(元ファイルにOGPが一切無かったため新規追加)
//  ・冪等: マーカーで既存ブロックを検出して置き換える
// ============================================================
function ensureAppIntroSEOTags(html) {
  const pageUrl   = `${BASE_URL}/app-intro.html`;
  const pageTitle = 'アプリ紹介 | どのまな';
  const pageDesc  = 'どのまなの全アプリ紹介ページ。各アプリの概要・ねらい・機能・使い方・アクセシビリティ情報を掲載しています。';
  const siteName  = 'どのまな';

  const startMarker = '<!-- SEO_TAGS_APPINTRO_START -->';
  const endMarker    = '<!-- SEO_TAGS_APPINTRO_END -->';
  const block = `${startMarker}
<link rel="canonical" href="${pageUrl}">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${pageDesc}">
<meta property="og:type" content="website">
<meta property="og:url" content="${pageUrl}">
<meta property="og:locale" content="ja_JP">
<meta property="og:site_name" content="${siteName}">
<meta property="og:image" content="${HOME_OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${pageTitle}">
<meta name="twitter:description" content="${pageDesc}">
<meta name="twitter:image" content="${HOME_OG_IMAGE}">
${endMarker}`;

  const existStart = html.indexOf(startMarker);
  if (existStart !== -1) {
    const existEnd = html.indexOf(endMarker) + endMarker.length;
    html = html.slice(0, existStart) + block + html.slice(existEnd);
  } else {
    // meta description の直後に挿入(無ければ </head> の直前)
    const descRe = /(<meta[^>]*name="description"[^>]*\/?>)/;
    if (descRe.test(html)) {
      html = html.replace(descRe, `$1\n${block}`);
    } else {
      const headEnd = html.indexOf('</head>');
      html = html.slice(0, headEnd) + block + '\n' + html.slice(headEnd);
    }
  }

  return html;
}

function updateAppIntroHTML(apps) {
  const introPath = './app-intro.html';
  if (!fs.existsSync(introPath)) {
    console.log('⚠️  app-intro.html が見つかりません。スキップします。');
    return;
  }
  let html = fs.readFileSync(introPath, 'utf-8');

  // ── SEOタグを丸ごと整備(canonical/OGP/Twitter Card が未設定だったため追加) ──
  html = ensureAppIntroSEOTags(html);


  // カテゴリラベル
  const catLabels = { gakushu: '✏️ 学習アプリ', ninchi: '🧠 認知支援', jiritsu: '🎯 自立活動', sousaku: '🎨 創作表現' };
  const catOrder = ['gakushu', 'ninchi', 'jiritsu', 'sousaku'];

  // カテゴリ別にグループ化し、各カテゴリ内で order を「真の順位」として並べる
  const byCat = {};
  for (const app of apps) {
    const k = CAT_MAP[app.category] || app.category;
    if (!byCat[k]) byCat[k] = [];
    byCat[k].push(app);
  }
  const sortedApps = [];
  for (const cat of catOrder) {
    if (byCat[cat]) sortedApps.push(...sortAppsByOrder(byCat[cat]));
  }
  for (const cat of Object.keys(byCat)) {
    if (!catOrder.includes(cat)) sortedApps.push(...sortAppsByOrder(byCat[cat]));
  }

  // panel-all の中身を生成
  let currentCat = '';
  let cardsHTML = '';
  for (const app of sortedApps) {
    const appCatKey = CAT_MAP[app.category] || app.category;
    if (appCatKey !== currentCat) {
      currentCat = appCatKey;
      cardsHTML += `\n    <div class="cat-label">${catLabels[currentCat] || currentCat}</div>`;
    }
    // generateIntroCard 内で app._themeClass / _dynamicTheme を直接書き込むため
    // シャローコピー({...app}) ではなく元の参照を渡す。catKeyは generateIntroCard 内で再計算される
    cardsHTML += generateIntroCard(app);
  }

  // panel-all の開始〜終了を置き換え
  const startMarker = '<div class="tab-panel active" id="panel-all" role="tabpanel">';
  const endMarker   = '</div><!-- /panel-all -->';
  const start = html.indexOf(startMarker);
  const end   = html.indexOf(endMarker) + endMarker.length;
  if (start === -1 || end < endMarker.length) {
    console.log('⚠️  app-intro.html の panel-all が見つかりません。スキップします。');
    return;
  }
  const newPanel = `${startMarker}${cardsHTML}\n\n  ${endMarker}`;
  html = html.slice(0, start) + newPanel + html.slice(end);

  // ── タブカウントを自動更新 ──
  // 各カテゴリの件数を計算
  const counts = { all: apps.length, gakushu: 0, ninchi: 0, jiritsu: 0, sousaku: 0 };
  for (const a of apps) {
    const k = CAT_MAP[a.category] || a.category;
    if (counts[k] !== undefined) counts[k]++;
  }
  // <button class="tab-btn ..." data-tab="XXX" ...><span class="tab-icon">...</span>...<span class="tab-count">N</span></button>
  // の N を置換。button要素内の data-tab に限定するため<button までを含めて厳密にマッチ
  let countUpdated = 0;
  for (const [tab, n] of Object.entries(counts)) {
    const re = new RegExp(
      `(<button[^>]*data-tab="${tab}"[^>]*>[\\s\\S]*?<span class="tab-count">)\\d+(</span>)`,
      'g'
    );
    const before = html;
    html = html.replace(re, `$1${n}$2`);
    if (html !== before) countUpdated++;
  }

  // ── 動的テーマCSS注入(新規アプリ用) ──
  const themeRules = [];
  for (const app of sortedApps) {
    if (!app._dynamicTheme) continue;
    const base = app.iconColor || '#5B3FD4';
    const h = hexToHue(base);
    const bgD    = hslToHex(h, 0.55, 0.74);
    const border = hslToHex(h, 0.50, 0.62);
    const tagBg  = hslToHex(h, 0.65, 0.94);
    const tagFg  = hslToHex(h, 0.45, 0.32);
    const btnA   = hslToHex(h, 0.55, 0.58);
    const btnB   = hslToHex(h, 0.55, 0.42);
    const cls = app._themeClass;
    themeRules.push(`  .${cls} .intro-card-header::before { background: linear-gradient(90deg, ${border}, ${bgD}); }`);
    themeRules.push(`  .${cls} .intro-tag { background: ${tagBg}; color: ${tagFg}; }`);
    themeRules.push(`  .${cls} .intro-launch-btn { background: linear-gradient(135deg, ${btnA}, ${btnB}); color: white; }`);
  }
  const themeCSS = themeRules.join('\n');
  const dynStart = '<style id="dynamic-theme-css">';
  const dynEnd   = '</style><!-- /dynamic-theme-css -->';
  const block    = `${dynStart}\n${themeCSS}\n${dynEnd}`;
  const existIdx = html.indexOf(dynStart);
  if (existIdx !== -1) {
    const tailIdx = html.indexOf(dynEnd, existIdx) + dynEnd.length;
    html = html.slice(0, existIdx) + block + html.slice(tailIdx);
  } else if (themeCSS) {
    const headEnd = html.indexOf('</head>');
    if (headEnd !== -1) html = html.slice(0, headEnd) + '\n' + block + '\n' + html.slice(headEnd);
  }

  // VS除去は廃止(絵文字を壊すため)
  // ── ファビコン注入 ──
  const favRes2 = injectFavicon(html);
  html = favRes2.html;
  // ── 教材一覧の構造化データ(ItemList/LearningResource)を注入 ──
  html = injectStructuredDataBlock(html, buildMaterialsItemListJsonLd(apps, 'アプリ紹介 教材一覧'), 'APPINTRO');
  fs.writeFileSync(introPath, html, 'utf-8');
  console.log('✅ app-intro.html の panel-all を更新しました');
  console.log(`✅ app-intro.html のタブカウントを更新: all=${counts.all}, 学習=${counts.gakushu}, 認知=${counts.ninchi}, 自立=${counts.jiritsu}, 創作=${counts.sousaku}`);
  if (themeCSS) console.log(`✅ app-intro.html に新規アプリ用のテーマCSSを動的注入 (${themeRules.length}ルール)`);
  if (favRes2.action !== 'skipped') console.log(`✅ app-intro.html にファビコンを ${favRes2.action}`);
}

// ============================================================
//  5. index.html の 更新履歴(CHANGELOG)を自動更新
//  ・apps-data.json の各アプリに releaseDate (YYYY-MM-DD) があれば
//    「YYYY年M月D日 「タイトル」を公開しました」を自動追加
//  ・MANUAL_CHANGELOG に手動エントリーを書けば、それも一緒に表示
//  ・全エントリーを日付の新しい順にソート
// ============================================================
// details（任意）: 「バグを修正しました」だけでは何が直ったか分からないため、
//   修正箇所を配列で書くと、更新履歴上でクリックすると開く内訳として表示される。
//   例: details: ["音が鳴らない問題を修正", "設定が保存されない問題を修正"]
const MANUAL_CHANGELOG = [
  { date: "2026-08-30", type: "update", text: "なぞり書きと学習記録、視線キーボード、ひらがな教材の機能を改善しました。", details: [
    "『ひらがな まなぼう！』『カタカナ まなぼう！』で、なぞり判定を『やさしく・ひょうじゅん・ていねいに』の3段階から選べるようにし、実際に書いた文字を学習記録から見返せるようにしました。あわせて、複数の教材で学習記録やCSV出力を改善しました。",
    "『視線キーボード』で、複数のユーザーを切り替えて使うときに、それぞれの入力履歴や使用状況の記録がきちんと分けて保存・削除されるようにしました。また、履歴や使用状況の画面のボタンを押しやすく、操作しやすく改善しました。",
    "『なぞり書き練習ツール』『なぞりんプリント』で、ひらがなの字体を『標準』『やさしい丸文字』『手書きふう』の3種類から選べるようにしました。あわせて、『なぞり書き練習ツール』の活動記録を、保存・削除できるように改善しました。",
  ], verbatim: true },
  { date: "2026-08-25", type: "update", text: "いくつかの教材のなぞり判定を改善しました。", details: [
    "「ひらがな まなぼう！」のなぞり判定を改善しました。",
    "「カタカナ まなぼう！」のなぞり判定を改善しました。",
  ] },
  { date: "2026-08-25", type: "update", text: "プライバシーに関するご案内を分かりやすくしました。" },
  { date: "2026-08-19", type: "update", text: "「コミュニケーションボード」の視線入力設定を充実しました。" },
  { date: "2026-08-19", type: "update", text: "「かたちをあわせよう」の視線入力設定を充実しました。" },
  { date: "2026-08-19", type: "update", text: "「おおきい？ちいさい？くらべよう」の視線入力設定を充実しました。" },
  { date: "2026-08-19", type: "update", text: "「じゅんばんにみよう」の設定画面を閉じたあとの操作をより分かりやすくしました。" },
  { date: "2026-08-19", type: "update", text: "「じゅんばんにみよう」の設定ボタンを操作しやすくしました。" },
  { date: "2026-08-19", type: "update", text: "「じゅんばんにみよう」の視線入力の設定を充実させました。" },
  { date: "2026-08-19", type: "update", text: "「どこかな？みーつけた！」の視線入力の設定を充実させました。" },
  { date: "2026-08-19", type: "update", text: "「みるとひろがる」の視線入力の設定を充実させました。" },
  { date: "2026-08-15", type: "update", text: "「みるとひろがる」の効果音と表示を改善しました。" },
  { date: "2026-08-14", type: "design", text: "アプリのデザインを、より楽しく親しみやすく改善しました。", details: [
    "「みるとひろがる」は、6種類のかわいいおもちゃが登場する「おもちゃのへや」に生まれ変わりました。働きかけると、おもちゃが動いたり音が鳴ったりして応えてくれます。",
    "「けずりえ」の下絵イラストを、より親しみやすく改善しました。",
  ] },
  { date: "2026-08-13", type: "update", text: "各アプリの不具合をまとめて修正しました。", details: [
    "「かたちをあわせよう」に大きさを見分ける学習を追加し、図形の見やすさや操作性も改善しました",
  ] },
  { date: "2026-08-12", type: "update", text: "各アプリの不具合をまとめて修正しました。", details: [
    "「なぞり書き練習ツール」で、スイッチ操作中にスペースキーやEnterキーでボタンを選べない問題を修正しました。",
    "「視線入力キーボード」で、よく使うフレーズやAACカード、予測変換の候補を選んでも、入力欄に反映されないことがある問題を修正しました。",
    "「ひらがな まなぼう！」で、スイッチ操作のときに1回の操作で複数回反応してしまうことがある問題（マッチングで選んでもすぐ選択が消えてしまうなど）と、スイッチ操作を終了した直後に、選択位置が意図せず動いてしまうことがある問題を修正しました。",
    "「すうじ まなぼう！」で、スイッチ操作のときに1回の操作で複数回反応してしまうことがある問題（マッチングで選んでもすぐ選択が消えてしまうなど）と、スイッチ操作を終了した直後に、選択位置が意図せず動いてしまうことがある問題を修正しました。",
    "「おおきい？ちいさい？くらべよう」に「ながい・みじかい」の学習や、大きさ・長さの順に3つ並べる学習を追加し、問題数の選択や学習記録の確認・CSV書き出しができるようにしました。また、画面の見やすさや操作性も改善しました。",
    "「かたちをあわせよう」の図形の見やすさ、操作性を改善しました",
  ] },
  { date: "2026-08-11", type: "update", text: "各アプリの不具合をまとめて修正しました。", details: [
    "「すごろく」スイッチ操作でスキャンをオフにした直後に、選んだボタンのハイライトが消えずに残ってしまうことがある問題を修正しました。",
    "「おんがくあそび」スイッチ操作でスキャン中に、アクセシビリティ設定などの共通ボタンを選んで決定すると操作できなくなる問題を修正しました。",
  ] },
  { date: "2026-08-08", type: "design", text: "トップページや教材紹介ページを、さらに使いやすく改善しました。", details: [
    "トップページで、目的や操作方法（スイッチ・タッチなど）からも教材を探しやすくしました。",
    "教材紹介ページで、キーボード操作がしやすくなるよう見直しました。",
    "ボタンやリンクを押しやすい大きさに整え、操作の安心感を高めました。",
  ] },
  { date: "2026-08-07", type: "update", text: "アクセシビリティと操作性を大幅に改善しました。", details: [
    "文字サイズ設定を見直し、各アプリで統一した表示になるよう改善しました。",
    "キーボードやスイッチなど、さまざまな操作方法で利用しやすいよう改善しました。",
    "文字を大きくした際の表示やレイアウトを見直し、小さな画面でも使いやすくしました。",
    "ボタンや画面の操作性を改善し、より安心して利用できるよう調整しました。",
    "各アプリのアクセシビリティを見直し、どのまな全体の使いやすさを向上させました。",
  ] },
  { date: "2026-08-01", type: "update", text: "サイト全体の品質向上に関するお知らせを掲載しました。" },
  { date: "2026-07-26", type: "design", text: "トップページをより使いやすく改善しました。", details: [
    "アプリを探しやすいよう、検索やおすすめアプリの配置を見直しました。",
    "初めて利用する方が目的のアプリへ素早くアクセスできるよう改善しました。",
    "情報を整理し、「どのまならしい」落ち着いたデザインへ調整しました。",
  ] },
  { date: "2026-07-26", type: "update", text: "アクセシビリティを改善しました。", details: [
    "スクリーンリーダーや検索エンジンがページを理解しやすい構成へ改善しました。",
    "ページ構造を整理し、より利用しやすくなりました。",
  ] },
  { date: "2026-07-19", type: "update", text: "各アプリを更新しました。", details: [
    "「とけい」に「とけいタイマー」機能を追加：時間・分・秒を設定すると、アナログ時計の時針・分針・秒針が実際の時計と同じ速さで動きながらカウントダウンします。知的障害のある児童生徒にも分かりやすいよう、針を色・太さ・長さではっきり区別しています。",
    "「しりとりあそび」の単語データを一部見直し：しりとりがつながりにくかった単語を、より遊びやすい単語に入れ替えました。",
    "「けずりえ」のバグを修正：何も削っていないのに、開いた瞬間に「やったね！」の完成画面が表示されてしまう不具合を修正しました。",
    "「とけい」の「とけいタイマー」タブが白背景に白文字で読めなくなっていた不具合を修正しました。",
    "「とけい」の「とけいタイマー」で、時間になった後「もどす」ボタンを押さなくても続けて次の時間を設定できるようにしました。",
    "「なぞりんプリント」の「どのまな」2次元コードの表示・非表示ボタンを廃止し、印刷するプリントには常に2次元コードとURLが入るようにしました。",
  ] },
  { date: "2026-07-12", type: "update", text: "各アプリの不具合をまとめて修正しました。", details: [
    "「カタカナ まなぼう！」マッチングときろくのボタンの間に不自然な空白ができていた問題を修正",
    "「すうじ まなぼう！」マッチングで数字の横にイラストを表示できるようにしました（表示のON/OFFも選べます）",
    "「なぞり書き練習ツール」練習スタイル等の選択欄で文字が見切れる問題を修正",
    "「なぞり書き練習ツール」続けて書くモードで、スライダーを動かしても途中から画面が動かなくなる問題を修正",
    "「なぞり書き練習ツール」「全部けす」の近くに触れただけで消えてしまう問題を修正（2回押して確定する方式に変更）",
    "「しりとりあそび」トップ画面の上に不要な白い帯が表示される問題を修正",
    "「読み書きサポートエディタ」ふりがなが一部の漢字にしか振られない問題を修正（常用漢字に対応）",
    "「ぼうさいたんけんたい」回答後の解説を、項目ごとに読み上げられるようにしました",
    "「マッチング」スイッチスキャンが動作しない問題と、パソコンでスクロールできない問題を修正",
    "「きょうのきろく」ボタンが重なって気持ちを選べない問題を修正",
    "「ひかるボタン」「おえかきひろば」設定から詳細設定が開けない問題を修正",
    "「SST」声の種類を変えても反映されない問題を修正",
    "「コミュニケーションボード」ボタンを押しても何も表示されない問題を修正",
    "「けずりえ」全画面の切り替えで削った内容が消える問題を修正（完成の基準も1%単位で調整できるようにしました）",
    "「もぐらたたき」画面ロックの解除に暗証番号を不要にしました",
    "「おんがくあそび」鍵盤を押すと音名の色付き丸が浮き出るようにしました",
  ] },
  { date: "2026-07-11", type: "update", text: "サイト名を「どのまな」に変更し、ロゴやデザインを一新しました。" },
  { date: "2026-07-05", type: "update", text: "「おんがくあそび」のバグを修正しました。" },
  { date: "2026-07-05", type: "update", text: "「ひかるボタン」のバグを修正しました。" },
  { date: "2026-07-05", type: "update", text: "「すごろく」にオンラインモードを追加しました。" },
  { date: "2026-06-21", type: "update", text: "「おかねのべんきょう」を修正しました。" },
  { date: "2026-06-21", type: "update", text: "「すごろく」を修正しました。" },
  { date: "2026-06-21", type: "update", text: "「SST ソーシャルスキルトレーニング」の内容（分岐ストーリー、きもち日記）を更新しました。" },
  { date: "2026-06-21", type: "update", text: "「コミュニケーションボード」のバグを修正しました。" },
  { date: "2026-06-17", type: "update", text: "「SST ソーシャルスキルトレーニング」の内容を更新しました。" },
  { date: "2026-06-13", type: "update", text: "「ひかるボタン」のバグを修正しました。" },
  { date: "2026-06-11", type: "update", text: "「SST ソーシャルスキルトレーニング」の内容を大幅に修正しました。" },
  { date: "2026-06-09", type: "update", text: "「すごろく」を修正しました。" },
  { date: "2026-06-09", type: "update", text: "「けずりえ」のバグを修正しました。" },
   { date: "2026-06-07", type: "update", text: "「SST ソーシャルスキルトレーニング」の内容を修正しました。" },
  { date: "2026-06-07", type: "update", text: "「しりとり」のバグを修正しました。" },
  { date: "2026-05-31", type: "update", text: "「なぞり書き練習ツール」にワークシートを印刷できる機能を追加しました。" },
   // ここに「アプリ追加以外」の更新履歴を書く(機能追加・改修・お知らせなど)
  // 例: { date: "2026-04-20", type: "update", text: "ホーム画面を更新しました" },
  { date: "2026-04-20", type: "new",  text: "ホーム画面を更新しました" },
  { date: "2026-03-13", type: "new",  text: "ホームページを開設しました" },
];

function formatDateJP(ymd) {
  // "2026-04-22" → "2026年4月22日"
  const [y, m, d] = ymd.split('-').map(s => parseInt(s, 10));
  return `${y}年${m}月${d}日`;
}

// Phase26-D4: MANUAL_CHANGELOG の各行は歴史的に「「アプリ名」で...」という表記が
// 大半だが、そのアプリ名は必ずしも現行 apps-data.json の title と一致しない
// (改名・表記ゆれ: 例「読み書きサポートエディタ」→現行「よみかき サポートエディタ」、
// 「ひかるボタン」→現行「ひかるボタン（注視訓練）」、「おかねのべんきょう」→現行
// 「おかねのおべんきょう」等)。誤った統合を避けるため、曖昧な正規表現一致では
// なく、実際の過去データを確認して構築したこの明示的なエイリアス表のみを
// 「安全にアプリだと判断できる」根拠として使う。ここに無い表記は非アプリ扱いにする。
const APP_NAME_ALIASES = {
  'なぞり書き練習ツール': 'nazori-app',
  '視線入力キーボード': 'gaze-keyboard',
  '視線キーボード': 'gaze-keyboard',
  'ひらがな まなぼう！': 'hiragana-learn',
  'すうじ まなぼう！': 'suji-manabou',
  'おおきい？ちいさい？くらべよう': 'kurabeyou-app',
  'かたちをあわせよう': 'katachi-awase-app',
  'すごろく': 'sugoroku-app',
  'おんがくあそび': 'ongaku-app',
  'とけい': 'tokei-app',
  'しりとりあそび': 'shiritori2',
  'しりとり': 'shiritori2',
  'けずりえ': 'scratch-app',
  'なぞりんプリント': 'nazorin-print',
  'カタカナ まなぼう！': 'katakana-app',
  '読み書きサポートエディタ': 'yomikaki-app',
  'よみかき サポートエディタ': 'yomikaki-app',
  'ぼうさいたんけんたい': 'bosai-app',
  'マッチング': 'matching-app',
  'きょうのきろく': 'kyou-no-kiroku',
  'ひかるボタン': 'tyushi',
  'ひかるボタン（注視訓練）': 'tyushi',
  'おえかきひろば': 'drawing-app',
  'SST': 'sst-app',
  'SST ソーシャルスキルトレーニング': 'sst-app',
  'コミュニケーションボード': 'kimochi-board',
  'もぐらたたき': 'mogura-tataki',
  'おかねのべんきょう': 'okane-app',
  'おかねのおべんきょう': 'okane-app',
};

// 文字列先頭から連続する「...」を全て取り出す。先頭以外(文中)の「」は対象外とする
// ことで、「とけい」の「とけいタイマー」タブが... のような「アプリ名の中の機能名」
// を誤ってアプリ名として拾わない。「ひかるボタン」「おえかきひろば」設定から... の
// ような、1行で2アプリに触れているケースは両方とも正しく拾える。
function extractLeadingAppNames(text) {
  const names = [];
  let rest = String(text);
  let m;
  while ((m = rest.match(/^「([^」]+)」/))) {
    names.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  return names;
}

function generateChangelog(apps) {
  const appById = {};
  apps.forEach(a => { appById[a.id] = a; });

  // アプリの releaseDate から自動生成。sourceAppId を持たせ、後続の集約処理が
  // 曖昧な文字列一致に頼らず確実にアプリを特定できるようにする。
  const autoEntries = apps
    .filter(a => a.releaseDate)
    .map(a => ({
      date: a.releaseDate,
      type: 'new',
      text: `「${a.releaseDisplayName || a.title}」を公開しました`,
      sourceAppId: a.id,
      ...(a.releaseDetails ? { details: a.releaseDetails } : {})
    }));

  // 手動エントリーと結合し、日付の新しい順にソート
  const all = [...autoEntries, ...MANUAL_CHANGELOG];
  all.sort((a, b) => b.date.localeCompare(a.date));

  // 1 calendar date = 1 visible changelog entry（Phase26-D2）は維持したまま、
  // Phase26-D4ではさらに 1 app = 1 visible detail item / 1 意味のあるsite変更 = 1 item
  // まで集約する。元のMANUAL_CHANGELOG/releaseDetailsは一切書き換えず、ここでは
  // 表示用の集約だけを行う。
  const dateOrder = [];
  const dateGroups = {};
  all.forEach(item => {
    if (!dateGroups[item.date]) {
      dateGroups[item.date] = [];
      dateOrder.push(item.date);
    }
    dateGroups[item.date].push(item);
  });

  const TYPE_PRIORITY = ['new', 'update', 'design', 'fix'];

  return dateOrder.map(date => {
    const members = dateGroups[date];

    // 明示的opt-out(`verbatim: true`): 通常はdetailsの各行を「先頭の「アプリ名」で
    // 対象アプリを判定し、見出しを自動要約する」処理にかけるが、その日の唯一の
    // 手動entryがこのフラグを持つ場合は、text/detailsをそのまま(見出しを自動生成で
    // 上書きせず、detailsも破棄せず)使う。同日に他のentryが混在する場合は既存の
    // 集約ロジックとの相互作用が未定義になるため、「その日の唯一のentryである」
    // 場合のみ適用する。
    if (members.length === 1 && members[0].verbatim) {
      const m = members[0];
      const details = Array.isArray(m.details) ? m.details.map(d => String(d).trim()).filter(Boolean) : [];
      return details.length > 0
        ? { date, type: m.type, text: m.text, details, updateCount: details.length }
        : { date, type: m.type, text: m.text, updateCount: 1 };
    }

    const appGroups = {}; // appId -> { releasedHere, updatedHere, updateType, updateLines }
    const appOrder = [];
    const siteItems = []; // { text } — アプリを安全に特定できない/アプリ横断の変更

    members.forEach(m => {
      if (m.sourceAppId) {
        // automatic release entry: アプリは確定済み
        if (!appGroups[m.sourceAppId]) {
          appGroups[m.sourceAppId] = { releasedHere: false, updatedHere: false, updateType: m.type, updateLines: [] };
          appOrder.push(m.sourceAppId);
        }
        appGroups[m.sourceAppId].releasedHere = true;
        return;
      }

      const contentLines = (Array.isArray(m.details) && m.details.length > 0) ? m.details : [m.text];
      const perLineApps = [];
      let allLinesMatched = true;
      contentLines.forEach(line => {
        const names = extractLeadingAppNames(line).map(n => APP_NAME_ALIASES[n]).filter(Boolean);
        if (names.length === 0) allLinesMatched = false;
        perLineApps.push(names);
      });

      if (!allLinesMatched) {
        // 1行でもアプリを安全に特定できない場合、このentry全体を1つのsite項目として
        // 扱う（誤ったアプリへの統合より、元のtextをそのまま見せる方が安全）。
        siteItems.push({ text: m.text });
        return;
      }
      // 各行が指すアプリを判定するのと同時に、その行の原文(MANUAL_CHANGELOGの著者が
      // 書いたuser-facing text)自体もappごとに保持する(Phase26-F)。この原文は、
      // 後段でその日のそのアプリの改善内容として一意に確定できる場合(＝同日にその
      // アプリを指す行が1本だけの場合)にそのまま表示へ使う。Structure(1 app=1 item
      // への集約)は自動化してよいが、著者が書いたsemantics(具体的に何が良くなったか)
      // は生成処理が勝手に一般化・破棄してはならない、というPhase26-E策定の原則
      // (Structure may be normalized; semantics must be preserved)をここで実装する。
      contentLines.forEach((line, idx) => {
        perLineApps[idx].forEach(appId => {
          if (!appGroups[appId]) {
            appGroups[appId] = { releasedHere: false, updatedHere: false, updateType: m.type, updateLines: [] };
            appOrder.push(appId);
          }
          appGroups[appId].updatedHere = true;
          appGroups[appId].updateType = m.type;
          appGroups[appId].updateLines.push(String(line).trim());
        });
      });
    });

    const releaseApps = [];
    const updatedOnlyApps = [];
    const detailLines = [];
    appOrder.forEach(appId => {
      const g = appGroups[appId];
      const app = appById[appId];
      const title = app ? app.title : appId;
      // そのアプリを名指しした行が同日に1本だけなら、その原文を意味を保ったまま
      // そのまま使う。複数本ある場合(同じアプリへ複数Phase由来の別々の一文が
      // まだMANUAL_CHANGELOG側で1文へ統合されていない場合)は、無理な自動合成は
      // 行わず、従来通りの一般化文へフォールバックする(44.6/44.7は執筆時に人が
      // 統合する運用を前提としており、本関数は新たな文章生成処理を持たない)。
      const updateText = g.updateLines.length === 1
        ? g.updateLines[0]
        : (g.updateType === 'design' ? `「${title}」を見やすく改善しました` : `「${title}」を改善しました`);
      if (g.releasedHere && g.updatedHere) {
        // 新規公開とその日の改善は意味の異なるsemantic categoryのため、1行へ
        // 一般化して合成せず、2つの別項目として保持する(Phase26-E 44.3/Phase26-F)。
        releaseApps.push({ appId, title });
        detailLines.push(`「${title}」を公開しました`);
        detailLines.push(updateText);
      } else if (g.releasedHere) {
        releaseApps.push({ appId, title });
        detailLines.push(`「${title}」を公開しました`);
      } else {
        updatedOnlyApps.push({ appId, title });
        detailLines.push(updateText);
      }
    });
    siteItems.forEach(s => detailLines.push(s.text));

    // 1行で複数アプリへ言及する原文(例:「AAA」「BBB」設定から〜を修正)は、その同じ
    // 原文がappごとの行として2回積まれうる。情報を落とさない範囲での構造的な整理
    // として、完全一致する行の重複だけを除去する(Phase26-F)。
    const seenDetailLines = new Set();
    const dedupedDetailLines = detailLines.filter(line => {
      if (seenDetailLines.has(line)) return false;
      seenDetailLines.add(line);
      return true;
    });

    const updateCount = dedupedDetailLines.length;
    const isTrivialSingleSiteItem = releaseApps.length === 0 && updatedOnlyApps.length === 0 && siteItems.length === 1;

    // 見出し生成: 固定文言「どのまなを更新しました」は使わず、その日の内容から
    // 短く要約する。非アプリ変更が1件だけの日は、その元のtext(既に人が書いた
    // 要約)をそのまま見出しに使う。
    let text;
    if (isTrivialSingleSiteItem) {
      text = siteItems[0].text;
    } else {
      const clauses = [];
      if (releaseApps.length > 0) {
        clauses.push(releaseApps.length === 1 ? `「${releaseApps[0].title}」を公開` : `新しい教材を${releaseApps.length}つ追加`);
      }
      if (updatedOnlyApps.length > 0) {
        clauses.push(updatedOnlyApps.length === 1 ? `「${updatedOnlyApps[0].title}」を改善` : 'いくつかの教材を改善');
      }
      if (siteItems.length > 0) {
        clauses.push(siteItems.length === 1 ? 'サイトの一部を改善' : 'サイトを改善');
      }
      text = clauses.length > 0 ? clauses.join('し、') + 'しました' : '更新しました';
    }

    const types = members.map(m => m.type);
    const primaryType = TYPE_PRIORITY.find(t => types.includes(t)) || types[0];

    // 単独のsite項目1件だけの日は、見出し自体がその内容そのものなので、同じ文を
    // もう一度「詳細」として展開させる意味のないトグルを出さない(details省略)。
    return isTrivialSingleSiteItem
      ? { date, type: primaryType, text, updateCount }
      : { date, type: primaryType, text, details: dedupedDetailLines, updateCount };
  });
}

function updateChangelog(apps) {
  const indexPath = './index.html';
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf-8');

  const entries = generateChangelog(apps);
  const lines = ['const CHANGELOG = ['];
  for (const e of entries) {
    const parts = [
      `date: ${JSON.stringify(formatDateJP(e.date))}`,
      `type: ${JSON.stringify(e.type)}`,
      `text: ${JSON.stringify(e.text)}`,
    ];
    // details(修正箇所の内訳)がある場合のみ出力。
    // 「バグを修正しました」だけでは利用者に何が直ったか伝わらないため、
    // クリックで開く内訳をここに持たせる。
    const details = Array.isArray(e.details)
      ? e.details.map(d => String(d).trim()).filter(Boolean)
      : [];
    if (details.length > 0) {
      parts.push(`details: ${JSON.stringify(details)}`);
    }
    // updateCount(Phase26-D2.1): 表示件数(「N件」)は details.length ではなくこの値を
    // 使う。単なる表示行数(グループ見出しを含む)と意味上の更新件数を混同しないため。
    parts.push(`updateCount: ${JSON.stringify(e.updateCount)}`);
    lines.push(`  { ${parts.join(', ')} },`);
  }
  lines.push('];');
  const newArray = lines.join('\n');

  // const CHANGELOG = [ ... ]; を置換
  const start = html.indexOf('const CHANGELOG = [');
  if (start === -1) {
    console.log('⚠️  index.html の CHANGELOG 配列が見つかりません。スキップします。');
    return;
  }
  const end = html.indexOf('];', start) + 2;
  html = html.slice(0, start) + newArray + html.slice(end);
  // VS除去は廃止(絵文字を壊すため)
  html = injectFavicon(html).html; // 冪等(既存があれば置換)
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`✅ index.html の 更新履歴を更新しました (${entries.length}件)`);
}

// ============================================================
//  6. index.html(ホームページ) の OGP画像 と 教材一覧構造化データを更新
//  ・og:image / twitter:image が無ければ追加(あれば冪等に維持)
//  ・全教材を LearningResource の ItemList として構造化データに追加
//    → 「教材ごとにCreativeWork/LearningResourceでマークアップ」の対応
// ============================================================
const HOME_OG_IMAGE = `${BASE_URL}/ogp.png`;

function updateHomepageOgImage(html) {
  let changed = false;
  if (!html.includes('property="og:image"')) {
    const before = html;
    html = html.replace(
      /(<meta[^>]*property="og:locale"[^>]*\/?>)/,
      `$1\n<meta property="og:image" content="${HOME_OG_IMAGE}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`
    );
    if (html !== before) changed = true;
  }
  if (!html.includes('name="twitter:image"')) {
    const before = html;
    html = html.replace(
      /(<meta[^>]*name="twitter:description"[^>]*\/?>)/,
      `$1\n<meta name="twitter:image" content="${HOME_OG_IMAGE}">`
    );
    if (html !== before) changed = true;
  }
  return { html, changed };
}

function updateHomepageStructuredData(html, apps) {
  const jsonLd = buildMaterialsItemListJsonLd(apps, 'どのまな 一覧');
  return injectStructuredDataBlock(html, jsonLd, 'MATERIALS');
}

function updateHomepageSEO(apps) {
  const indexPath = './index.html';
  if (!fs.existsSync(indexPath)) {
    console.log('⚠️  index.html が見つかりません。スキップします(ホームページSEO更新)。');
    return;
  }
  let html = fs.readFileSync(indexPath, 'utf-8');

  const ogRes = updateHomepageOgImage(html);
  html = ogRes.html;

  html = updateHomepageStructuredData(html, apps);

  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`✅ index.html のホームページSEOを更新しました(og:image${ogRes.changed ? '追加' : '維持'} / 教材${apps.length}件のLearningResource構造化データ)`);
}

// ============================================================
//  実行
// ============================================================

// 1. 詳細ページ生成
let count = 0;
for (const app of apps) {
  let html      = generateDetailHTML(app);
  html          = injectFavicon(html).html; // ファビコン注入
  const outPath = path.join(outDir, `${app.filename}-detail.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`✅ 生成: ${app.filename}-detail.html`);
  count++;
}
console.log(`\n詳細ページ: ${count}件生成 → ${outDir}/`);

// 2. index.html の APPS 配列を更新
const appsResult = generateAppsArray(apps);
updateIndexHTML(appsResult);

// 3. app-intro.html の panel-all を更新
updateAppIntroHTML(apps);

// 5. index.html の 更新履歴を更新
updateChangelog(apps);

// 6. index.html のOGP画像・教材一覧構造化データ(ItemList/LearningResource)を更新
updateHomepageSEO(apps);

// 7. 個別アプリHTML(ルート直下の*.html)にファビコンを一括挿入
//    対象: apps-data.json に filename が登録されているアプリの本体HTML
//    対象外: index.html, app-intro.html, app-register.html(ツール本体)
injectFaviconToAppHtmls(apps);

// 8. 個別アプリHTML(ルート直下の*.html)にホームボタンを一括挿入
//    対象: apps-data.json に filename が登録されているアプリの本体HTML
//    対象外: index.html, app-intro.html, app-register.html(ツール本体)、
//           および既に独自のトップリンクを実装済みのアプリ(HOME_BTN_SKIP_APPS)
injectHomeButtonToAppHtmls(apps);

// 9. 個別アプリHTML(ルート直下の*.html)に全画面表示・画面ロックボタンを一括挿入
//    対象外: 既に独自実装済みのアプリ(FS_SKIP_APPS / LOCK_SKIP_APPS)
injectLockFsButtonToAppHtmls(apps);

// 10. 個別アプリHTML(ルート直下の*.html)に統一アクセシビリティパネルを一括挿入
//     既存のスイッチスキャン・視線入力等はそのまま残し、並行して動作させる
injectA11yPanelToAppHtmls(apps);

// 個別アプリHTML(ルート直下の*.html)にAnnouncement共通ヘルパー(donomanaAnnounce)を一括挿入
//     除外リストなし。全アプリへ配布する(既存 donomanaAnnounceA11y / donomanaLockToast はそのまま維持)
injectAnnounceHelperToAppHtmls(apps);

// 個別アプリHTML(ルート直下の*.html)にDesign Token(角丸・フォーカス共通CSS変数)を一括挿入
//     除外リストなし。:root の変数定義のみのため既存表示には影響しない
injectDesignTokensToAppHtmls(apps);

// Donomana Gaze Foundation(Phase M11.4-A PoC)をGAZE_SHARED_FOUNDATION_APPSに
//     登録したアプリのみへ挿入。SAFE TO SHARE分類の定数・純粋関数・CSSのみ対象
//     (docs/design-system/donomana-gaze-accessibility-standard-v1_0.md §33.3-33.4)
injectGazeSharedFoundationToAppHtmls(apps);

// Donomana Learning Record Foundation(Phase T5-B PoC)をLEARNING_RECORD_FOUNDATION_APPSに
//     登録したアプリのみへ挿入。readLog/writeLog/addLog/clearLog相当のI/Oメカニクスと
//     schemaVersion fallback・CSV組み立てのみ共有する
//     (docs/design-system/donomana-learning-record-standard-v1_0.md)
injectLearningRecordFoundationToAppHtmls(apps);

// 11. 個別アプリHTML(ルート直下の*.html)にcanonical/meta descriptionを一括挿入
//     アプリ本体ページと詳細ページが同じ検索語で評価を分け合う(カニバリゼーション)のを防ぐため、
//     本体ページのcanonicalは詳細ページに向ける(検索評価を詳細ページへ統合する)
injectSeoTagsToAppHtmls(apps);

// 12. sitemap.xml を自動生成
//     手動管理だとアプリ追加時に載せ忘れる(実際 ongaku-app / wizard が漏れていた)ため、
//     apps-data.json + 固定ページ一覧から毎回生成し直す。
//     ※ 呼び出しはファイル末尾(定数定義のあと)。他のHTML書き換えが全て終わってから実行する
//        ことで、lastmodに今回の更新日が正しく反映される。

// ============================================================
//  sitemap.xml 自動生成
// ============================================================
// 各アプリの優先度は apps-data.json の sitemapPriority で管理(未指定なら0.7)。
// 詳細ページはアプリ本体より0.1高い(検索評価を詳細ページに寄せる方針のため)。
const SITEMAP_STATIC_PAGES = [
  { url: '',                       priority: 1.0, changefreq: 'weekly'  }, // トップ
  { url: 'app-intro.html',         priority: 0.9, changefreq: 'weekly'  },
  { url: 'switch-gaze-guide.html', priority: 0.9, changefreq: 'monthly' },
  { url: 'about.html',             priority: 0.8, changefreq: 'monthly' },
  { url: 'philosophy.html',        priority: 0.8, changefreq: 'monthly' },
  { url: 'wizard.html',            priority: 0.8, changefreq: 'monthly' },
  { url: 'home-screen-guide.html', priority: 0.6, changefreq: 'monthly' },
  { url: 'terms.html',             priority: 0.5, changefreq: 'monthly' },
];

// 意図的にsitemapへ載せないページ(未完成・非公開・検証用など)
const SITEMAP_EXCLUDE = new Set([
  'sugoroku-online.html',
  'switch-training-app.html',
  'app-register.html',
  '404.html',
]);

// lastmod は「そのファイルが最後にコミットされた日」を使う。
// 注意: fs.statSync().mtime を使ってはいけない。GitHub Actions の actions/checkout は
// 全ファイルのmtimeをチェックアウト時刻にリセットするため、CIで実行するたびに全URLの
// lastmodが「今日」になり、毎回sitemap全体が書き換わってしまう(検索エンジンに対して
// 「全ページが毎日更新された」と誤った信号を送ることになる)。
// git が使えない環境(zip配布の手元実行など)ではmtimeにフォールバックする。
const { execFileSync } = require('child_process');
let _gitAvailable = null;

function gitLastCommitDate(filePath) {
  if (_gitAvailable === false) return null;
  try {
    const out = execFileSync(
      'git', ['log', '-1', '--format=%cs', '--', filePath],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    _gitAvailable = true;
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch (e) {
    _gitAvailable = false;
    return null;
  }
}

function sitemapLastmod(filePath) {
  const fromGit = gitLastCommitDate(filePath);
  if (fromGit) return fromGit;
  try {
    return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
  } catch (e) {
    return null;
  }
}

function generateSitemap(apps) {
  const entries = [];

  // 固定ページ
  for (const p of SITEMAP_STATIC_PAGES) {
    if (SITEMAP_EXCLUDE.has(p.url)) continue;
    const file = p.url === '' ? './index.html' : `./${p.url}`;
    if (!fs.existsSync(file)) {
      console.log(`  ⚠️  sitemap: ${p.url || 'index.html'} が見つかりません(スキップ)`);
      continue;
    }
    entries.push({
      loc: `${BASE_URL}/${p.url}`,
      lastmod: sitemapLastmod(file),
      changefreq: p.changefreq,
      priority: p.priority.toFixed(1),
    });
  }

  // アプリ本体ページ + 詳細ページ
  for (const app of apps) {
    const appFile    = `./${app.filename}.html`;
    const detailFile = `./app-details/${app.filename}-detail.html`;
    const appPri     = typeof app.sitemapPriority === 'number' ? app.sitemapPriority : 0.7;
    const detailPri  = Math.min(appPri + 0.1, 1.0);

    if (SITEMAP_EXCLUDE.has(`${app.filename}.html`)) continue;

    if (fs.existsSync(appFile)) {
      entries.push({
        loc: `${BASE_URL}/${app.filename}.html`,
        lastmod: sitemapLastmod(appFile),
        changefreq: 'monthly',
        priority: appPri.toFixed(1),
      });
    } else {
      console.log(`  ⚠️  sitemap: ${app.filename}.html が見つかりません(スキップ)`);
    }

    if (fs.existsSync(detailFile)) {
      entries.push({
        loc: `${BASE_URL}/app-details/${app.filename}-detail.html`,
        lastmod: sitemapLastmod(detailFile),
        changefreq: 'monthly',
        priority: detailPri.toFixed(1),
      });
    } else {
      console.log(`  ⚠️  sitemap: ${app.filename}-detail.html が見つかりません(スキップ)`);
    }
  }

  // 優先度の高い順 → 同順位はURL順(生成結果を安定させ、無駄なdiffを防ぐ)
  entries.sort((a, b) =>
    (parseFloat(b.priority) - parseFloat(a.priority)) || a.loc.localeCompare(b.loc)
  );

  const body = entries.map(e => {
    const lines = [
      '  <url>',
      `    <loc>${e.loc}</loc>`,
    ];
    if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
    lines.push(`    <priority>${e.priority}</priority>`);
    lines.push('  </url>');
    return lines.join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- このファイルは generate.js が自動生成しています。直接編集しないでください。 -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    ''
  ].join('\n');

  const prev = fs.existsSync('./sitemap.xml') ? fs.readFileSync('./sitemap.xml', 'utf-8') : '';
  if (prev !== xml) {
    fs.writeFileSync('./sitemap.xml', xml, 'utf-8');
    console.log(`\n🗺  sitemap.xml を生成しました (${entries.length}件のURL)`);
  } else {
    console.log(`\n🗺  sitemap.xml は既に最新です (${entries.length}件のURL)`);
  }
}

// ============================================================
//  個別アプリHTMLに対するcanonical/meta description一括注入
// ============================================================
function injectSeoTagsToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  const startMark = '<!-- seo-tags: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /seo-tags -->';
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    const canonicalUrl = `${BASE_URL}/app-details/${app.filename}-detail.html`;
    const desc = (app.summary || '').replace(/\s+/g, '').slice(0, 110) + ' 特別支援教育向けの無料Webアプリ。インストール不要でブラウザからすぐ使えます。';
    const block = [
      startMark,
      `<link rel="canonical" href="${canonicalUrl}">`,
      `<meta name="description" content="${desc}">`,
      endMark
    ].join('\n');
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      let html = original;
      const startIdx = html.indexOf(startMark);
      if (startIdx !== -1) {
        const endIdx = html.indexOf(endMark, startIdx);
        if (endIdx !== -1) html = html.slice(0, startIdx) + block + html.slice(endIdx + endMark.length);
      } else {
        // </title> の直後、なければ<head>直後に挿入
        const titleEnd = html.indexOf('</title>');
        const headMatch = html.match(/<head[^>]*>/);
        const insertAt = titleEnd !== -1 ? titleEnd + '</title>'.length
                       : headMatch ? headMatch.index + headMatch[0].length : -1;
        if (insertAt === -1) { skipped++; log.push(`  ⚠️  ${fname} (head/title未検出)`); continue; }
        html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
      }
      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname}`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n🔗 個別アプリHTML へのcanonical/description挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}

// 12. sitemap.xml を自動生成(全HTML書き換え完了後に実行)
generateSitemap(apps);

console.log('\n🎉 完了！');

// ============================================================
//  個別アプリHTMLに対する統一アクセシビリティパネル一括注入
// ============================================================
function injectA11yPanelToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  const startMark = '<!-- a11y-panel: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /a11y-panel -->';
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const includeSR = !SR_SKIP_APPS.has(app.filename);
      const panelHTML = buildA11yPanelHTML(includeSR, app.filename);
      let html = original;
      const startIdx = html.indexOf(startMark);
      if (startIdx !== -1) {
        const endIdx = html.indexOf(endMark, startIdx);
        if (endIdx !== -1) html = html.slice(0, startIdx) + panelHTML + html.slice(endIdx + endMark.length);
      } else {
        const bodyMatch = html.match(/<body[^>]*>/);
        if (bodyMatch) {
          const insertAt = bodyMatch.index + bodyMatch[0].length;
          html = html.slice(0, insertAt) + '\n' + panelHTML + html.slice(insertAt);
        }
      }
      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname}`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n⚙ 個別アプリHTML への統一アクセシビリティパネル挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}

// ============================================================
//  個別アプリHTMLに対するAnnouncement共通ヘルパー(donomanaAnnounce)一括注入
//  ・対象: apps-data.json に登録された全アプリ(除外リストなし)
//  ・対象外: index.html, app-intro.html, app-register.html
// ============================================================
function injectAnnounceHelperToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  const startMark = '<!-- announce-helper: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /announce-helper -->';
  const block = buildAnnounceHelperHTML();
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      let html = original;
      const startIdx = html.indexOf(startMark);
      if (startIdx !== -1) {
        const endIdx = html.indexOf(endMark, startIdx);
        if (endIdx !== -1) html = html.slice(0, startIdx) + block + html.slice(endIdx + endMark.length);
      } else {
        const bodyMatch = html.match(/<body[^>]*>/);
        if (bodyMatch) {
          const insertAt = bodyMatch.index + bodyMatch[0].length;
          html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
        }
      }
      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname}`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n📢 個別アプリHTML への Announcement共通ヘルパー挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}

// ============================================================
//  個別アプリHTMLに対するDesign Token(角丸・フォーカス共通CSS変数)一括注入
//  ・対象: apps-data.json に登録された全アプリ(除外リストなし)
//  ・対象外: index.html, app-intro.html, app-register.html
//  ・:root の変数定義のみを配布し、既存CSSへの影響はない(表示は変わらない)
// ============================================================
function injectDesignTokensToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  const startMark = '<!-- design-tokens: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /design-tokens -->';
  const block = buildDesignTokensHTML();
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      let html = original;
      const startIdx = html.indexOf(startMark);
      if (startIdx !== -1) {
        const endIdx = html.indexOf(endMark, startIdx);
        if (endIdx !== -1) html = html.slice(0, startIdx) + block + html.slice(endIdx + endMark.length);
      } else {
        // </title> の直後、なければ<head>直後に挿入(既存スタイルより前に置く)
        const titleEnd = html.indexOf('</title>');
        const headMatch = html.match(/<head[^>]*>/);
        const insertAt = titleEnd !== -1 ? titleEnd + '</title>'.length
                       : headMatch ? headMatch.index + headMatch[0].length : -1;
        if (insertAt === -1) { skipped++; log.push(`  ⚠️  ${fname} (head/title未検出)`); continue; }
        html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
      }
      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname}`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n🎛 個別アプリHTML への Design Token挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}

// ============================================================
//  個別アプリHTMLに対する全画面表示・画面ロックボタン一括注入
// ============================================================
function injectLockFsButtonToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  const startMark = '<!-- lock-fs-btn: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /lock-fs-btn -->';
  let updated = 0, skipped = 0, notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    const needFs   = !FS_SKIP_APPS.has(app.filename);
    const needLock = !LOCK_SKIP_APPS.has(app.filename);
    const block = buildLockFsHTML(needFs, needLock);
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) { notFound++; log.push(`  ⏭️  ${fname} (ファイルなし)`); continue; }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      let html = original;
      const startIdx = html.indexOf(startMark);
      if (!block) {
        // 両方とも既存実装がある場合、以前挿入したブロックが残っていれば除去
        if (startIdx !== -1) {
          const endIdx = html.indexOf(endMark, startIdx);
          if (endIdx !== -1) html = html.slice(0, startIdx) + html.slice(endIdx + endMark.length);
        }
      } else if (startIdx !== -1) {
        const endIdx = html.indexOf(endMark, startIdx);
        if (endIdx !== -1) html = html.slice(0, startIdx) + block + html.slice(endIdx + endMark.length);
      } else {
        const bodyMatch = html.match(/<body[^>]*>/);
        if (bodyMatch) {
          const insertAt = bodyMatch.index + bodyMatch[0].length;
          html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
        }
      }
      if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname} (fs=${needFs?'追加':'既存'}, lock=${needLock?'追加':'既存'})`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新 または対象外)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n⛶🔒 個別アプリHTML への全画面/ロックボタン挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}

// ============================================================
//  🏠 ホームボタン: 全ページ共通のフローティングボタンを注入する
//  ・サイトルート(https://donomana.jp/)へ戻れるよう、
//    各アプリ画面の左上に固定表示する
//  ・既に自前のトップリンクを実装しているアプリはスキップする
// ============================================================
// HTML文字列に対してホームボタンを冪等に注入する(favicon注入と同じマーカー方式)
function injectHomeButton(html) {
  if (typeof html !== 'string') return { html, action: 'skipped' };
  const startMark = '<!-- home-btn: 自動挿入 (generate.js) -->';
  const endMark   = '<!-- /home-btn -->';
  const startIdx = html.indexOf(startMark);
  if (startIdx !== -1) {
    const endIdx = html.indexOf(endMark, startIdx);
    if (endIdx !== -1) {
      const tail = endIdx + endMark.length;
      const newHtml = html.slice(0, startIdx) + HOME_BTN_HTML + html.slice(tail);
      return { html: newHtml, action: 'replaced' };
    }
  }
  // 新規挿入: <body ...> の直後
  const bodyMatch = html.match(/<body[^>]*>/);
  if (!bodyMatch) return { html, action: 'no-body' };
  const insertAt = bodyMatch.index + bodyMatch[0].length;
  const newHtml = html.slice(0, insertAt) + '\n' + HOME_BTN_HTML + html.slice(insertAt);
  return { html: newHtml, action: 'inserted' };
}

// ============================================================
//  個別アプリHTMLに対するホームボタン一括注入
// ============================================================
function injectHomeButtonToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    if (HOME_BTN_SKIP_APPS.has(app.filename)) {
      skipped++;
      log.push(`  ⏭️  ${fname} (既に独自実装のためスキップ)`);
      continue;
    }
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) {
      notFound++;
      log.push(`  ⏭️  ${fname} (ファイルなし)`);
      continue;
    }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const result = injectHomeButton(original);
      if (result.action === 'skipped' || result.action === 'no-body') {
        skipped++;
        log.push(`  ⚠️  ${fname} (${result.action})`);
        continue;
      }
      if (result.html !== original) {
        fs.writeFileSync(filePath, result.html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname} (${result.action})`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n🏠 個別アプリHTML へのホームボタン挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}

// ============================================================
//  個別アプリHTMLに対するファビコン一括注入
// ============================================================
function injectFaviconToAppHtmls(apps) {
  const skipFiles = new Set(['index.html', 'app-intro.html', 'app-register.html']);
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const log = [];
  for (const app of apps) {
    const fname = `${app.filename}.html`;
    if (skipFiles.has(fname)) continue;
    const filePath = `./${fname}`;
    if (!fs.existsSync(filePath)) {
      notFound++;
      log.push(`  ⏭️  ${fname} (ファイルなし)`);
      continue;
    }
    try {
      const original = fs.readFileSync(filePath, 'utf-8');
      const result = injectFavicon(original);
      if (result.action === 'skipped' || result.action === 'no-head') {
        skipped++;
        log.push(`  ⚠️  ${fname} (${result.action})`);
        continue;
      }
      // 内容が変わったときだけ書き込み(GitHub上の不要なdiff防止)
      if (result.html !== original) {
        fs.writeFileSync(filePath, result.html, 'utf-8');
        updated++;
        log.push(`  ✅ ${fname} (${result.action})`);
      } else {
        skipped++;
        log.push(`  ⏭️  ${fname} (既に最新)`);
      }
    } catch (e) {
      skipped++;
      log.push(`  ❌ ${fname} (エラー: ${e.message})`);
    }
  }
  console.log(`\n📌 個別アプリHTML へのファビコン挿入: ${updated}件更新, ${skipped}件スキップ, ${notFound}件未発見`);
  if (log.length > 0 && process.env.VERBOSE === '1') {
    log.forEach(l => console.log(l));
  } else if (log.length > 0) {
    // 件数が多いので最初の5件のみ表示
    log.slice(0, 5).forEach(l => console.log(l));
    if (log.length > 5) console.log(`  ... (他 ${log.length - 5} 件、VERBOSE=1 で全表示)`);
  }
}
