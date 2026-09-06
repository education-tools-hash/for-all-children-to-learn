// Static structural audit (AUDIT-35-FIX-3A): for all 35 apps, extract <main>
// count, role="main" count, heading (h1-h3) counts/sequence/text, and basic
// chrome markers (header/footer tags). Read-only, does not modify any file.
const fs = require('fs');
const apps = require('../../apps-data.json');

function stripCommentsAndScripts(html) {
  // Remove <script>...</script> and <style>...</style> content and HTML comments
  // so headings/mains generated only inside JS strings (not real DOM at parse
  // time) don't get miscounted, and so marker comments don't confuse regexes.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function analyze(filename, html) {
  const clean = stripCommentsAndScripts(html);

  const mainTags = [...clean.matchAll(/<main[\s>]/gi)];
  const roleMain = [...clean.matchAll(/role=["']main["']/gi)];
  const headers = [...clean.matchAll(/<header[\s>]/gi)];
  const footers = [...clean.matchAll(/<footer[\s>]/gi)];

  const headingRe = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [];
  let m;
  while ((m = headingRe.exec(clean))) {
    const level = Number(m[1]);
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    headings.push({ level, text: text.slice(0, 60) });
  }

  const h1s = headings.filter(h => h.level === 1);
  const h2s = headings.filter(h => h.level === 2);
  const h3s = headings.filter(h => h.level === 3);

  return {
    filename,
    mainCount: mainTags.length,
    roleMainCount: roleMain.length,
    headerCount: headers.length,
    footerCount: footers.length,
    h1Count: h1s.length,
    h2Count: h2s.length,
    h3Count: h3s.length,
    headingSequence: headings.map(h => 'h' + h.level),
    h1Texts: h1s.map(h => h.text),
    firstHeading: headings[0] || null,
  };
}

const results = [];
for (const app of apps) {
  const fname = `${app.filename}.html`;
  if (!fs.existsSync(fname)) {
    results.push({ filename: app.filename, error: 'file not found' });
    continue;
  }
  const html = fs.readFileSync(fname, 'utf-8');
  const r = analyze(app.filename, html);
  r.title = app.title;
  results.push(r);
}

fs.writeFileSync(
  require('path').join(__dirname, 'audit-results.json'),
  JSON.stringify(results, null, 2),
  'utf-8'
);

// Console summary
let mainMissing = 0, h1Missing = 0, h1Excess = 0, roleMainAsFallback = 0;
for (const r of results) {
  if (r.error) continue;
  if (r.mainCount === 0) {
    mainMissing++;
    if (r.roleMainCount > 0) roleMainAsFallback++;
  }
  if (r.h1Count === 0) h1Missing++;
  if (r.h1Count > 1) h1Excess++;
}
console.log(`Total apps: ${results.length}`);
console.log(`<main> missing: ${mainMissing} (of which role="main" present instead: ${roleMainAsFallback})`);
console.log(`h1 missing: ${h1Missing}`);
console.log(`h1 excess (>1): ${h1Excess}`);
console.log('\nWrote tools/main-heading-audit/audit-results.json');
