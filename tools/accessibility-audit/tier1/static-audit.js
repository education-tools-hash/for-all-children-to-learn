// WCAG-JIS-AUDIT-1-TIER1: Tier1 12アプリの静的構造監査(Structure + Modal/Focus Trapパターン)。
// Read-only。Productionファイルは一切変更しない。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');

const TIER1 = ['register-app','matching-app','time-timer','mogura-tataki','okane-app','scratch-app','nazorin-print','schedule-app','janken-app','tokei-app','tyushi','gaze-keyboard'];

function nearby(html, a, b, window) {
  // aとbの出現位置が指定文字数以内で近接するペアが存在するか
  const posA = [...html.matchAll(new RegExp(a, 'g'))].map(m => m.index);
  const posB = [...html.matchAll(new RegExp(b, 'g'))].map(m => m.index);
  for (const pa of posA) for (const pb of posB) if (Math.abs(pa - pb) <= window) return true;
  return false;
}

const results = {};
for (const app of TIER1) {
  const fpath = path.join(ROOT, app + '.html');
  const html = fs.readFileSync(fpath, 'utf8');
  const r = {};

  // duplicate id
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Map(); const dups = new Set();
  for (const id of ids) { seen.set(id, (seen.get(id) || 0) + 1); if (seen.get(id) > 1) dups.add(id); }
  r.duplicateIds = [...dups];

  // broken aria refs
  const idSet = new Set(ids);
  r.brokenAriaRefs = [];
  for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns']) {
    for (const m of html.matchAll(new RegExp(attr + '="([^"]+)"', 'g'))) {
      for (const id of m[1].split(/\s+/)) if (id && !idSet.has(id)) r.brokenAriaRefs.push({ attr, id });
    }
  }

  // tabindex anomalies
  const tvals = [...html.matchAll(/tabindex="(-?\d+)"/g)].map(m => m[1]);
  r.tabindexAnomalies = tvals.filter(v => v !== '-1' && v !== '0');

  // structure
  r.hasMain = /<main[\s>]/.test(html);
  r.hasHeader = /<header[\s>]/.test(html);
  r.h1CountRaw = (html.match(/<h1[\s>]/g) || []).length;
  r.headingSequenceRaw = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));

  // modal / focus trap pattern audit
  r.roleDialogCount = (html.match(/role="dialog"/g) || []).length;
  const tabHandlerMatches = [...html.matchAll(/e\.key\s*(?:!==|===)\s*'Tab'/g)];
  r.tabKeyHandlerMentions = tabHandlerMatches.length;
  r.hasA11yPanelRef = /donomanaA11yPanel/.test(html);
  r.tabHandlerNearA11yPanel = nearby(html, "e\\.key\\s*(?:!==|===)\\s*'Tab'", "donomanaA11yPanel", 1200);
  r.hasFocusCallCount = (html.match(/\.focus\(\)/g) || []).length;
  r.hasInertUsage = /\.inert\s*=|setAttribute\('inert'|\sinert(?:[\s>=])/.test(html);
  r.hasEscapeHandlerCount = (html.match(/e\.key\s*(?:!==|===)\s*'Escape'/g) || []).length;

  // record / pwa / dynamic content markers
  r.hasAriaLive = /aria-live/.test(html);
  r.hasLocalStorageDelete = /localStorage\.removeItem|confirm\(/.test(html);

  results[app] = r;
}
fs.writeFileSync(path.join(__dirname, 'static-audit-results.json'), JSON.stringify(results, null, 2));
for (const [app, r] of Object.entries(results)) {
  console.log(app.padEnd(16),
    'dupId=' + r.duplicateIds.length,
    'brokenAria=' + r.brokenAriaRefs.length,
    'tabAnom=' + r.tabindexAnomalies.length,
    'main=' + r.hasMain,
    'h1=' + r.h1CountRaw,
    'dialogs=' + r.roleDialogCount,
    'tabHandlers=' + r.tabKeyHandlerMentions,
    'a11yPanelRef=' + r.hasA11yPanelRef,
    'tabNearA11y=' + r.tabHandlerNearA11yPanel,
    'inertUsage=' + r.hasInertUsage
  );
}
