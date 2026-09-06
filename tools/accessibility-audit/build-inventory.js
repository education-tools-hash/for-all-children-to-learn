// Phase ACCESSIBILITY-AUDIT-PREP-1: 35アプリの監査対象Inventoryを
// apps-data.json / generate.js / service-worker.js / 各アプリHTMLから機械的に再構築する。
// Read-only。Productionファイルは一切変更しない。
// 実行: node tools/accessibility-audit/build-inventory.js > tools/accessibility-audit/app-inventory.json
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const apps = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-data.json'), 'utf8'));
const genSrc = fs.readFileSync(path.join(ROOT, 'generate.js'), 'utf8');

function extractSet(varName) {
  const re = new RegExp(varName + "\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)");
  const m = genSrc.match(re);
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
}
const RECORD_APPS = extractSet('LEARNING_RECORD_FOUNDATION_APPS');

let swSrc = '';
try { swSrc = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8'); } catch (e) {}
const pilotMatch = swSrc.match(/PILOT_PATHS\s*=\s*\[([\s\S]*?)\]/);
const PILOT_PATHS = pilotMatch ? [...pilotMatch[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];

const rows = [];
for (const app of apps) {
  const fname = `${app.filename}.html`;
  let html = '';
  try { html = fs.readFileSync(path.join(ROOT, fname), 'utf8'); } catch (e) {}
  const input = app.input || [];
  // modalCount: role="dialog"の出現数。共通A11yパネル(donomanaA11yPanel、全35アプリに注入)を
  // 含むため、アプリ固有のモーダル数は基本的に (modalCount - 1)。
  const modalCount = (html.match(/role="dialog"/g) || []).length;
  rows.push({
    id: app.id,
    filename: app.filename,
    title: app.title,
    category: app.category,
    input,
    declaresSwitch: input.includes('switch'),
    declaresGaze: input.includes('gaze'),
    declaresKeyboard: input.includes('keyboard'),
    declaresTouch: input.includes('touch'),
    modalCountIncludingA11yPanel: modalCount,
    appSpecificModalCount: Math.max(0, modalCount - 1),
    hasMain: /<main[\s>]/.test(html),
    h1Count: (html.match(/<h1[\s>]/g) || []).length,
    isPwaPilot: PILOT_PATHS.some(p => p.replace(/^\//, '') === fname),
    isRecordFoundation: RECORD_APPS.has(app.filename),
    hasAriaLive: /aria-live/.test(html),
    hasLocalStorageWrite: /localStorage\.setItem/.test(html),
  });
}
process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
