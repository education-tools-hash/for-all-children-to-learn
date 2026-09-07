const fs = require('fs');
const apps = ['matching-app','okane-app','gaze-keyboard','tokei-app','timetable-app'];
const results = {};

for (const app of apps) {
  const html = fs.readFileSync(app + '.html', 'utf8');
  const r = {};

  // duplicate id
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  const seen = new Map(); const dups = new Set();
  for (const id of ids) { seen.set(id,(seen.get(id)||0)+1); if (seen.get(id)>1) dups.add(id); }
  r.duplicateIds = [...dups];

  // broken aria-* references
  const idSet = new Set(ids);
  const refAttrs = ['aria-controls','aria-labelledby','aria-describedby','aria-owns'];
  r.brokenAriaRefs = [];
  for (const attr of refAttrs) {
    const re = new RegExp(attr + '="([^"]+)"', 'g');
    for (const m of html.matchAll(re)) {
      for (const id of m[1].split(/\s+/)) {
        if (id && !idSet.has(id)) r.brokenAriaRefs.push({attr, id});
      }
    }
  }

  // aria-hidden="true" element containing a plausibly-focusable descendant tag (heuristic, tag-name based only)
  const hiddenBlocks = [...html.matchAll(/<[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/[a-zA-Z]+>/g)].map(m=>m[0]);
  r.ariaHiddenWithFocusableHeuristicHits = hiddenBlocks.filter(b => /<(button|a\s|input|select|textarea)[\s>]/.test(b)).length;

  // tabindex values other than -1 or 0
  const tabindexVals = [...html.matchAll(/tabindex="(-?\d+)"/g)].map(m=>m[1]);
  r.tabindexValues = [...new Set(tabindexVals)];
  r.tabindexAnomalies = tabindexVals.filter(v => v !== '-1' && v !== '0');

  // heading structure
  r.h1Count = (html.match(/<h1[\s>]/g)||[]).length;
  r.headingSequence = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m=>Number(m[1]));

  // landmark presence
  r.hasMain = /<main[\s>]/.test(html);
  r.hasHeader = /<header[\s>]/.test(html);

  // console error prone patterns: inline onerror alert etc not checked here (needs browser)
  results[app] = r;
}

fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
