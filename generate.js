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
  'okane-app',         // おかね
  'schedule-app',      // スケジュール
  'matching-app',      // マッチング
  'sst-app',           // SST
  'kimochi-board',     // コミュニケーションボード
  'directions-app',    // ほうこうとばしょ
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
  const seoTitle = `${app.title}｜${seoSuffix} - ${SITE_NAME}`;

  // ディスクリプション(120〜160字目安)
  const cleanSummary = app.summary.replace(/\s+/g, '').slice(0, 100);
  const seoDescription = `${cleanSummary} 現役の特別支援学校教員が開発した無料のICT教材。${app.category}向け。インストール不要、ブラウザでそのまま使えます。${hasSwitch ? 'スイッチスキャン対応。' : ''}${hasGaze ? '視線入力対応。' : ''}`;

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
  const ogImageUrl = app.ogImage
    ? (app.ogImage.startsWith('http') ? app.ogImage : `${SITE_BASE_URL}/${app.ogImage.replace(/^\/+/, '')}`)
    : DEFAULT_OG_IMAGE;

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
    --c-bg:#fdf8f2; --c-surface:#fff; --c-primary:${app.iconColor};
    --c-primary-light:${app.iconColor}22; --c-accent:#4a9e8a; --c-accent-light:#d6f0ea;
    --c-text:#2d2417; --c-muted:#7a6a58; --c-border:#e8ddd0; --c-tag-bg:#f5efe8;
    --radius:16px; --shadow:0 4px 24px rgba(45,36,23,0.08);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Noto Sans JP',sans-serif;background:var(--c-bg);color:var(--c-text);line-height:1.7;}
  .site-nav{background:var(--c-surface);border-bottom:1px solid var(--c-border);padding:12px 24px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--c-muted);flex-wrap:wrap;}
  .site-nav a{color:var(--c-primary);text-decoration:none;font-weight:500;}
  .site-nav a:hover{text-decoration:underline;}
  .site-nav .sep{color:var(--c-border);}
  .hero{background:linear-gradient(135deg,#fff8f2,var(--c-primary-light),#fff3e8);border-bottom:1px solid var(--c-border);padding:48px 24px 40px;text-align:center;}
  .app-icon{width:88px;height:88px;border-radius:24px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 32px ${app.iconColor}55;background:${app.iconColor};font-family:'Zen Maru Gothic',sans-serif;font-size:44px;font-weight:900;color:white;}
  .hero h1{font-family:'Zen Maru Gothic',sans-serif;font-size:clamp(22px,5vw,34px);font-weight:900;color:var(--c-text);margin-bottom:8px;}
  .hero-sub{font-size:15px;color:var(--c-muted);margin-bottom:20px;}
  .tag-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:32px;}
  .tag{background:var(--c-surface);border:1px solid var(--c-border);color:var(--c-muted);font-size:12px;padding:4px 12px;border-radius:999px;font-weight:500;}
  .tag.green{background:var(--c-accent-light);border-color:var(--c-accent);color:#2d6b5e;}
  .launch-btn{display:inline-flex;align-items:center;gap:10px;background:var(--c-primary);color:white;font-family:'Zen Maru Gothic',sans-serif;font-size:20px;font-weight:700;padding:18px 40px;border-radius:999px;text-decoration:none;box-shadow:0 6px 24px ${app.iconColor}55;transition:transform 0.15s,box-shadow 0.15s;}
  .launch-btn:hover{transform:translateY(-2px);box-shadow:0 10px 32px ${app.iconColor}77;}
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
  .a11y-badge{display:flex;align-items:center;gap:6px;background:var(--c-accent-light);border:1px solid var(--c-accent);color:#2d6b5e;font-size:13px;font-weight:500;padding:8px 14px;border-radius:999px;}
  .caution{background:#fffbea;border-left:4px solid #f0c040;border-radius:0 12px 12px 0;padding:16px 20px;font-size:14px;color:#5a4a10;line-height:1.8;}
  .bottom-launch{text-align:center;padding:40px 20px;background:linear-gradient(135deg,#fff8f2,var(--c-primary-light));border:1px solid var(--c-border);border-radius:var(--radius);}
  .bottom-launch p{font-size:15px;color:var(--c-muted);margin-bottom:20px;}
  .back-link{display:inline-flex;align-items:center;gap:6px;color:var(--c-muted);font-size:14px;text-decoration:none;margin-top:16px;}
  .back-link:hover{color:var(--c-primary);}
  .guide-banner{display:flex;align-items:center;gap:16px;padding:18px 22px;background:linear-gradient(120deg,#4a7ba6,#5a8fc0 55%,#4a9e8a);border-radius:18px;box-shadow:0 6px 22px rgba(74,123,166,0.3);text-decoration:none;color:#fff;transition:transform 0.18s,box-shadow 0.18s;}
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
  <div class="app-icon">${app.icon}</div>
  <h1>${app.title}</h1>
  <p class="hero-sub">${app.category} / ${app.tags_display}</p>
  <div class="tag-row">
    ${badgesHTML}
    <span class="tag">完全無料</span>
    <span class="tag">インストール不要</span>
  </div>
  <a href="../${app.filename}.html" class="launch-btn">▶ アプリをひらく →</a>
  <p class="launch-note">ブラウザでそのまま使えます。インストール不要。</p>
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
  'tyushi':          'card-sst',
  'cup_game':        'card-matching',
  'sst-app':         'card-sst',
  'kimochi-board':   'card-board',
  'drawing-app':     'card-oekaki',
   'yomikaki-app':    'card-yomikaki',
  'slideshow-sakusei': 'card-oekaki', // 創作系の色を流用
  'directions-app':  'card-directions', // 専用色(ティール系)
};

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
    const need    = JSON.stringify(app.need    || []);
    const scene   = JSON.stringify(app.scene   || []);
    const input   = JSON.stringify(app.input   || []);
    const feature = JSON.stringify(app.feature || []);
    const extras = [
      app.isNew       ? 'isNew: true'      : '',
      app.isRecommend ? 'isRecommend: true' : '',
      app.isComing    ? 'isComing: true'    : '',
    ].filter(Boolean).join(', ');
    lines.push('  {');
    lines.push('    name: ' + JSON.stringify(app.title) + ', link: "app-details/' + app.filename + '-detail.html", icon: ' + JSON.stringify(app.icon) + ', desc: ' + JSON.stringify(app.summary.slice(0, 30)) + ', tag: ' + JSON.stringify(app.tags_display) + ',');
    lines.push('    category: "' + app._cat + '", cardClass: "' + app._cardClass + '"' + (extras ? ', ' + extras : '') + ',');
    lines.push('    need:' + need + ', scene:' + scene + ', input:' + input + ',');
    lines.push('    feature:' + feature);
    lines.push('  },');
  }
  lines.push('];');
  return { code: lines.join('\n'), mapped };
}

// 動的カードCSS(新規アプリ用)を生成
function generateDynamicCardCSS(mappedApps) {
  const rules = [];
  for (const app of mappedApps) {
    if (!app._dynamicCard) continue;
    const base = app.iconColor || '#5B3FD4';
    const light = lighten(base, 0.30);
    const dark  = darken(base, 0.15);
    const tagBg = lighten(base, 0.78);
    const tagFg = darken(base, 0.35);
    const cls = app._cardClass;
    rules.push(`  .${cls} .card-preview { background: linear-gradient(135deg, ${light} 0%, ${dark} 100%); }`);
    rules.push(`  .${cls}:hover { border-color: ${dark}; }`);
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
  'tyushi':           'theme-sst',
  'cup_game':         'theme-cupgame',
  'sst-app':          'theme-sst',
  'kimochi-board':    'theme-board',
  'drawing-app':      'theme-oekaki',
  'yomikaki-app':     'theme-yomikaki',
  'slideshow-sakusei':'theme-oekaki',
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
        <div class="intro-icon" style="font-size:40px;background:${app.iconColor};width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${app.icon}</div>
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
    const light = lighten(base, 0.20);
    const dark  = darken(base, 0.20);
    const tagBg = lighten(base, 0.82);
    const tagFg = darken(base, 0.35);
    const cls = app._themeClass;
    themeRules.push(`  .${cls} .intro-card-header::before { background: linear-gradient(90deg, ${base}, ${light}); }`);
    themeRules.push(`  .${cls} .intro-tag { background: ${tagBg}; color: ${tagFg}; }`);
    themeRules.push(`  .${cls} .intro-launch-btn { background: linear-gradient(135deg, ${base}, ${dark}); color: white; }`);
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
//  4. index.html の「場面・目的から探す」セクションを自動更新
//  ・PURPOSE_CARDS_TRUTH に各目的カードの所属アプリを登録
//  ・新規アプリ追加時はここに id を追加するだけで自動反映される
// ============================================================
const PURPOSE_CARDS_TRUTH = {
  // theme クラス名 → そのカードに所属するアプリの id 配列
  'theme-ishi': {
    title: '思いを伝えたい子に',
    ids: ['kimochi-board', 'drawing-app', 'yomikaki-app', 'kyou-no-kiroku', 'gaze-keyboard', 'ongaku-app']
  },
  'theme-jikan': {
    title: '時間の見通しを持たせたい',
    ids: ['schedule-app', 'tokei-app', 'timetable-app']
  },
  'theme-moji': {
    title: '文字に興味を持ち出した子に',
    ids: ['hiragana-learn', 'katakana-app', 'nazori-app', 'yomikaki-app', 'shiritori2', 'suji-manabou']
  },
  'theme-seikatsu': {
    title: '生活スキルを育てたい',
    ids: ['okane-app', 'register-app', 'schedule-app', 'timetable-app', 'bosai-app', 'directions-app']
  },
  'theme-sst': {
    title: '友達との関わりを育てたい',
    ids: ['sst-app', 'janken-app', 'sugoroku-app', 'matching-app']
  },
  'theme-switch': {
    title: '視線入力やスイッチを使う子に',
    ids: ['kimochi-board', 'hiragana-learn', 'schedule-app', 'matching-app', 'janken-app', 'tyushi', 'cup_game', 'kyou-no-kiroku', 'gaze-keyboard', 'mogura-tataki']
  },
  'theme-sousaku': {
    title: '創作・表現活動をしたい',
    ids: ['drawing-app', 'slideshow-sakusei', 'ongaku-app']
  },
};

function updatePurposeCards(apps) {
  const indexPath = './index.html';
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf-8');

  // id → app マップ
  const byId = Object.fromEntries(apps.map(a => [a.id, a]));

  let updated = 0;
  for (const [themeClass, def] of Object.entries(PURPOSE_CARDS_TRUTH)) {
    const targetApps = def.ids.map(id => byId[id]).filter(Boolean);
    if (targetApps.length === 0) continue;

    // applyPurposeFilter の引数(タイトル配列) と、 purpose-apps の中身(リンクタグ群) を生成
    const titlesArg = targetApps.map(a => `'${a.title.replace(/'/g, "\\'")}'`).join(',');
    const tagsHTML  = targetApps.map(a => {
      // タグの表示名は短縮版を使う(タイトル→短縮表記)
      const display = (a.title || '')
        .replace(' まなぼう！', '')
        .replace(' サポートエディタ', '')
        .replace('はんばいかい レジ', 'レジマスター')
        .replace('SST ソーシャルスキルトレーニング', 'SST')
        .replace('ぼうさいたんけんたい', 'ぼうさい')
        .replace('ほうこうとばしょをまなぼう', 'ほうこうとばしょ')
        .replace('スライドショー作成', 'スライドショー')
        .replace('どこかな?カップゲーム', 'どこかな?')
        .replace('どこかな？カップゲーム', 'どこかな？')
        .replace('マッチング', 'マッチング(対戦)');
      return `          <a class="purpose-app-tag" href="${a.filename}.html">${display}</a>`;
    }).join('\n');

    // index.html 内の該当 purpose-card を正規表現で置換
    // パターン: <div class="purpose-card themeClass" onclick="applyPurposeFilter([...])"> ... </div>
    // 中身の onclick の引数と、purpose-apps の中身を更新
    const cardRegex = new RegExp(
      `(<div class="purpose-card ${themeClass}" onclick="applyPurposeFilter\\()(\\[[^\\]]*\\])(\\)">[\\s\\S]*?<div class="purpose-apps">)([\\s\\S]*?)(\\s*</div>\\s*</div>)`,
      'g'
    );
    const newOnclick = `[${titlesArg}]`;
    const before = html;
    html = html.replace(cardRegex, (m, p1, p2, p3, p4, p5) => {
      return p1 + newOnclick + p3 + '\n' + tagsHTML + '\n        ' + p5;
    });
    if (html !== before) updated++;
  }

  if (updated > 0) {
    // VS除去は廃止(絵文字を壊すため)
    html = injectFavicon(html).html; // 冪等(既存があれば置換)
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log(`✅ index.html の「場面・目的から探す」を更新しました (${updated}/${Object.keys(PURPOSE_CARDS_TRUTH).length}カード)`);
  }
}

// ============================================================
//  5. index.html の 更新履歴(CHANGELOG)を自動更新
//  ・apps-data.json の各アプリに releaseDate (YYYY-MM-DD) があれば
//    「YYYY年M月D日 「タイトル」を公開しました」を自動追加
//  ・MANUAL_CHANGELOG に手動エントリーを書けば、それも一緒に表示
//  ・全エントリーを日付の新しい順にソート
// ============================================================
const MANUAL_CHANGELOG = [
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

function generateChangelog(apps) {
  // アプリの releaseDate から自動生成
  const autoEntries = apps
    .filter(a => a.releaseDate)
    .map(a => ({
      date: a.releaseDate,
      type: 'new',
      text: `「${a.releaseDisplayName || a.title}」を公開しました`
    }));

  // 手動エントリーと結合し、日付の新しい順にソート
  const all = [...autoEntries, ...MANUAL_CHANGELOG];
  all.sort((a, b) => b.date.localeCompare(a.date));

  return all;
}

function updateChangelog(apps) {
  const indexPath = './index.html';
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf-8');

  const entries = generateChangelog(apps);
  const lines = ['const CHANGELOG = ['];
  for (const e of entries) {
    lines.push(`  { date: ${JSON.stringify(formatDateJP(e.date))}, type: ${JSON.stringify(e.type)}, text: ${JSON.stringify(e.text)} },`);
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

// 4. index.html の「場面・目的から探す」を更新
updatePurposeCards(apps);

// 5. index.html の 更新履歴を更新
updateChangelog(apps);

// 6. index.html のOGP画像・教材一覧構造化データ(ItemList/LearningResource)を更新
updateHomepageSEO(apps);

// 7. 個別アプリHTML(ルート直下の*.html)にファビコンを一括挿入
//    対象: apps-data.json に filename が登録されているアプリの本体HTML
//    対象外: index.html, app-intro.html, app-register.html(ツール本体)
injectFaviconToAppHtmls(apps);

console.log('\n🎉 完了！');

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
