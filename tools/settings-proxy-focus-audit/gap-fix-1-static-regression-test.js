// Phase COMMON-A11Y-SETTINGS-PROXY-GAP-FIX-1: minimal static regression guard.
// Asserts timetable-app and ongaku-app keep their SETTINGS_PROXY entry and stay
// in hideWithDisplayNone, without needing a browser/server (unlike audit.py).
// Run: node tools/settings-proxy-focus-audit/gap-fix-1-static-regression-test.js
'use strict';
const fs = require('fs');

const src = fs.readFileSync('generate.js', 'utf-8');
const proxyMatch = src.match(/const SETTINGS_PROXY = (\{[\s\S]*?\n\});/);
const SETTINGS_PROXY = new Function('return ' + proxyMatch[1])();
const hideMatch = src.match(/const hideWithDisplayNone = new Set\((\[[\s\S]*?\])\)/);
const hideWithDisplayNone = new Set(new Function('return ' + hideMatch[1])());

let pass = 0, fail = 0;
function check(label, ok) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + label);
  ok ? pass++ : fail++;
}

check('timetable-app has a SETTINGS_PROXY entry', !!SETTINGS_PROXY['timetable-app']);
check(
  "timetable-app selector targets the settings tab button",
  SETTINGS_PROXY['timetable-app'] && SETTINGS_PROXY['timetable-app'].selector === "[onclick=\"switchTab('settings',this)\"]"
);
check('timetable-app is in hideWithDisplayNone', hideWithDisplayNone.has('timetable-app'));

check('ongaku-app has a SETTINGS_PROXY entry', !!SETTINGS_PROXY['ongaku-app']);
check(
  'ongaku-app selector targets #btn-teacher-settings',
  SETTINGS_PROXY['ongaku-app'] && SETTINGS_PROXY['ongaku-app'].selector === '#btn-teacher-settings'
);
check('ongaku-app is in hideWithDisplayNone', hideWithDisplayNone.has('ongaku-app'));

// tokei-app/nazorin-print correctly have no own settings UI to proxy -- guard
// against someone "fixing" that absence by mistake in a future Phase without
// re-checking the app first (Design Contract v1.0 §1.4).
check('tokei-app intentionally has no SETTINGS_PROXY entry', !SETTINGS_PROXY['tokei-app']);
check('nazorin-print intentionally has no SETTINGS_PROXY entry', !SETTINGS_PROXY['nazorin-print']);

console.log(`\n${pass}/${pass + fail} checks passed.`);
if (fail > 0) { console.log('FAILURES PRESENT.'); process.exit(1); }
console.log('ALL PASS.');
