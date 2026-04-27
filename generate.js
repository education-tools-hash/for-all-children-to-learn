// variation selector（U+FE00-FE0F）を除去してNode.jsのJSON.parseエラーを防ぐ
function clean(str) {
  if (typeof str !== 'string') return str;
  return str.split('').filter(c => {
    const cp = c.codePointAt(0);
    return !(cp >= 0xFE00 && cp <= 0xFE0F);
  }).join('');
}

const fs   = require('fs');
const path = require('path');

const rawJson = fs.readFileSync('./apps-data.json', 'utf-8').split('').filter(c => { const cp = c.codePointAt(0); return !(cp >= 0xFE00 && cp <= 0xFE0F); }).join('');
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
  'janken-app':      '学習アプリ',
  'shiritori2':      '学習アプリ',
  'okane-app':       '学習アプリ',
  'register-app':    '学習アプリ',
  'tokei-app':       '学習アプリ',
  'timetable-app':   '学習アプリ',
  'yomikaki-app':    '学習アプリ',
  'bosai-app':       '学習アプリ',
  'directions-app':  '学習アプリ',
  // 認知支援
  'matching-app':    '認知支援',
  'sugoroku-app':    '認知支援',
  'cup_game':        '認知支援',
  // 自立活動
  'tyushi':          '自立活動',
  'kimochi-board':   '自立活動',
  'schedule-app':    '自立活動',
  'sst-app':         '自立活動',
  // 創作表現
  'drawing-app':     '創作表現',
  'music-app':       '創作表現',
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

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${app.title} | すべての子どもの学びのためのデジタル教材</title>
<meta name="description" content="${app.summary.slice(0, 100)}">
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
  @media(max-width:600px){.hero{padding:36px 16px 32px;}.content{padding:24px 16px 60px;}.card{padding:20px;}.feature-grid{grid-template-columns:1fr;}.launch-btn{font-size:18px;padding:16px 28px;}}
</style>
</head>
<body>
<nav class="site-nav">
  <a href="../index.html">トップ</a>
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
  'music-app':       'card-music',
  'yomikaki-app':    'card-yomikaki',
  'slideshow-sakusei': 'card-oekaki', // 創作系の色を流用
  'directions-app':  'card-directions', // 専用色(ティール系)
};

function generateAppsArray(apps) {
  const catOrder = ['gakushu', 'ninchi', 'jiritsu', 'sousaku'];
  const catLabels = { gakushu: '学習アプリ', ninchi: '認知支援', jiritsu: '自立活動', sousaku: '創作表現' };

  // categoryを英語キーに変換してソート
  const mapped = apps.map(app => ({
    ...app,
    _cat: CAT_MAP[app.category] || 'gakushu',
    _cardClass: app.cardClass || CARD_CLASS_MAP[app.filename] || ('card-' + app.filename),
  }));
  mapped.sort((a, b) => catOrder.indexOf(a._cat) - catOrder.indexOf(b._cat));

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
  return lines.join('\n');
}

function updateIndexHTML(appsArray) {
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
  html = html.slice(0, start) + appsArray + html.slice(end);
  html = html.split('').filter(c => { const cp = c.codePointAt(0); return !(cp >= 0xFE00 && cp <= 0xFE0F); }).join('');
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('✅ index.html の APPS 配列を更新しました');
}

// ============================================================
//  3. app-intro.html の panel-all カードを自動生成して上書き
// ============================================================
const BASE_URL = 'https://education-tools-hash.github.io/for-all-children-to-learn';

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
  'music-app':        'theme-music',
  'yomikaki-app':     'theme-yomikaki',
  'slideshow-sakusei':'theme-oekaki',
  'directions-app':   'theme-directions',
};

function generateIntroCard(app) {
  const themeClass = app.themeClass || THEME_CLASS_MAP[app.filename] || ('theme-' + app.filename);
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
          <a href="${BASE_URL}/index.html#contactSection" class="header-report-btn" target="_blank"><span class="header-report-icon">✏️</span><span class="header-report-text"><span class="header-report-title">実践報告を送る</span></span></a>
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

function updateAppIntroHTML(apps) {
  const introPath = './app-intro.html';
  if (!fs.existsSync(introPath)) {
    console.log('⚠️  app-intro.html が見つかりません。スキップします。');
    return;
  }
  let html = fs.readFileSync(introPath, 'utf-8');

  // カテゴリラベル
  const catLabels = { gakushu: '✏️ 学習アプリ', ninchi: '🧠 認知支援', jiritsu: '🎯 自立活動', sousaku: '🎨 創作表現' };
  const catOrder = ['gakushu', 'ninchi', 'jiritsu', 'sousaku'];

  // カテゴリ順にソートして、カテゴリラベルが重複しないようにする
  const sortedApps = apps.slice().sort((a, b) => {
    const aKey = CAT_MAP[a.category] || a.category;
    const bKey = CAT_MAP[b.category] || b.category;
    return catOrder.indexOf(aKey) - catOrder.indexOf(bKey);
  });

  // panel-all の中身を生成
  let currentCat = '';
  let cardsHTML = '';
  for (const app of sortedApps) {
    const appCatKey = CAT_MAP[app.category] || app.category;
    if (appCatKey !== currentCat) {
      currentCat = appCatKey;
      cardsHTML += `\n    <div class="cat-label">${catLabels[currentCat] || currentCat}</div>`;
    }
    cardsHTML += generateIntroCard({...app, _catKey: appCatKey});
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
  html = html.split('').filter(c => { const cp = c.codePointAt(0); return !(cp >= 0xFE00 && cp <= 0xFE0F); }).join('');
  fs.writeFileSync(introPath, html, 'utf-8');
  console.log('✅ app-intro.html の panel-all を更新しました');
}

// ============================================================
//  実行
// ============================================================

// 1. 詳細ページ生成
let count = 0;
for (const app of apps) {
  const html    = generateDetailHTML(app);
  const outPath = path.join(outDir, `${app.filename}-detail.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`✅ 生成: ${app.filename}-detail.html`);
  count++;
}
console.log(`\n詳細ページ: ${count}件生成 → ${outDir}/`);

// 2. index.html の APPS 配列を更新
const appsArray = generateAppsArray(apps);
updateIndexHTML(appsArray);

// 3. app-intro.html の panel-all を更新
updateAppIntroHTML(apps);

console.log('\n🎉 完了！');
