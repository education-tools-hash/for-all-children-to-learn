// Extracts SETTINGS_PROXY and hideWithDisplayNone from generate.js as JSON,
// for the audit script to consume without re-parsing generate.js in Python.
const fs = require('fs');
const src = fs.readFileSync('generate.js', 'utf-8');

const proxyMatch = src.match(/const SETTINGS_PROXY = (\{[\s\S]*?\n\});/);
const SETTINGS_PROXY = new Function('return ' + proxyMatch[1])();

const hideMatch = src.match(/const hideWithDisplayNone = new Set\((\[[\s\S]*?\])\)/);
const hideWithDisplayNone = new Function('return ' + hideMatch[1])();

fs.writeFileSync(
  'tools/settings-proxy-focus-audit/settings_proxy_map.json',
  JSON.stringify({ SETTINGS_PROXY, hideWithDisplayNone }, null, 2),
  'utf-8'
);
console.log('SETTINGS_PROXY entries:', Object.keys(SETTINGS_PROXY).length);
console.log('hideWithDisplayNone entries:', hideWithDisplayNone.length);
