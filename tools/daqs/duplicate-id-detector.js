// DAQS-DUPLICATE-ID-DETECTION-HARDENING-1: single source of truth for the
// static duplicate-id check, shared by tools/audit35-1/audit.js and
// tools/accessibility-audit/tier{1,2,3}/static-audit.js. Those 4 scripts
// previously each carried their own copy of a raw-text regex
// (`/\sid="([^"]+)"/g`) applied directly to the whole .html source, which
// could not tell an `id="..."` attribute actually present in live HTML
// markup apart from the same literal text sitting inside a <script> block's
// JS string or template literal -- e.g. bosai-app.html's #bag-max and
// sugoroku-app.html's #sce-prev-ic, where the JS string is destined to
// *replace* (via innerHTML), never duplicate, the one existing element with
// that id. Confirmed in DONOMANA-DAQS-REMAINING-KNOWN-3-INVESTIGATION-1 via
// real-browser verification (19/19 PASS): neither id ever exists twice in
// the live DOM.
//
// tools/main-heading-audit/audit.js already solved this exact class of
// problem for its own <main>/<h1> counts via a stripCommentsAndScripts()
// pre-filter; this module applies the identical technique to id-attribute
// scanning specifically, read-only, with no change to the output shape
// (still a plain array of duplicated id strings) that callers depend on.
'use strict';

function stripNonMarkup(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function findDuplicateIds(html) {
  const clean = stripNonMarkup(html);
  const ids = [...clean.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Map();
  const dups = new Set();
  for (const id of ids) {
    seen.set(id, (seen.get(id) || 0) + 1);
    if (seen.get(id) > 1) dups.add(id);
  }
  return [...dups];
}

module.exports = { stripNonMarkup, findDuplicateIds };
