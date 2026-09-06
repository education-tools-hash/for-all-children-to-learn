// Body-structure classification helper (AUDIT-35-FIX-3A): for the <main>-missing
// apps, list direct <body> children (tag/id/class), marking which are
// generator-injected common-chrome blocks (identified by the marker comments
// generate.js writes) vs hand-authored app content, to classify how a <main>
// wrapper could be introduced. Read-only.
const fs = require('fs');
const apps = require('../../apps-data.json');

const GENERATOR_MARKERS = [
  'design-tokens', 'seo-tags', 'favicon', 'record-nav-btn', 'announce-helper',
  'a11y-panel', 'lock-fs-btn', 'home-btn', 'pwa-manifest', 'pwa-register',
];

function isGeneratorMarkerComment(text) {
  return GENERATOR_MARKERS.some(m => text.includes(m));
}

function directBodyChildren(html) {
  const bodyStart = html.search(/<body[^>]*>/i);
  if (bodyStart === -1) return null;
  const bodyOpenEnd = html.indexOf('>', bodyStart) + 1;
  const bodyCloseIdx = html.lastIndexOf('</body>');
  const inner = html.slice(bodyOpenEnd, bodyCloseIdx === -1 ? html.length : bodyCloseIdx);

  // Walk top-level nodes: comments, and elements at depth 0 relative to body.
  const nodes = [];
  let depth = 0;
  let i = 0;
  let currentStart = 0;
  const tagRe = /<!--([\s\S]*?)-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m;
  let pendingComment = null;
  while ((m = tagRe.exec(inner))) {
    if (m[1] !== undefined) {
      // comment
      if (depth === 0) {
        const text = m[1].trim();
        nodes.push({ type: 'comment', text: text.slice(0, 50) });
      }
      continue;
    }
    const closing = m[2] === '/';
    const tag = m[3].toLowerCase();
    const attrs = m[4] || '';
    const selfClosing = /\/>\s*$/.test(m[0]) || ['br', 'img', 'input', 'link', 'meta', 'hr'].includes(tag);

    if (!closing) {
      if (depth === 0) {
        const idMatch = attrs.match(/\sid=["']([^"']+)["']/);
        const classMatch = attrs.match(/\sclass=["']([^"']+)["']/);
        nodes.push({
          type: 'element', tag,
          id: idMatch ? idMatch[1] : null,
          class: classMatch ? classMatch[1].split(/\s+/).slice(0, 3).join(' ') : null,
        });
      }
      if (!selfClosing) depth++;
    } else {
      if (!selfClosing) depth = Math.max(0, depth - 1);
    }
  }
  return nodes;
}

const targets = process.argv.slice(2);
const list = targets.length ? targets : apps.map(a => a.filename);

for (const filename of list) {
  const fname = `${filename}.html`;
  if (!fs.existsSync(fname)) { console.log(filename, 'FILE NOT FOUND'); continue; }
  const html = fs.readFileSync(fname, 'utf-8');
  const nodes = directBodyChildren(html);
  console.log(`\n=== ${filename} ===`);
  if (!nodes) { console.log('  (no <body> found)'); continue; }
  nodes.forEach(n => {
    if (n.type === 'comment') {
      const marker = isGeneratorMarkerComment(n.text) ? ' [generator marker]' : '';
      console.log(`  <!-- ${n.text} -->${marker}`);
    } else {
      console.log(`  <${n.tag}${n.id ? ' id="' + n.id + '"' : ''}${n.class ? ' class="' + n.class + '"' : ''}>`);
    }
  });
}
