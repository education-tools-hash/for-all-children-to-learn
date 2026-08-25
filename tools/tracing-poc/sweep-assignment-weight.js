#!/usr/bin/env node
// Phase T3-C — sweep ASSIGNMENT_POSITION_WEIGHT to find the minimal value
// that fixes U's assignment swap WITHOUT increasing W5 mirror unexpected
// passes beyond the existing 2 (E, ni). Investigation only.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CANDIDATE_PATH = path.join(__dirname, 'engine-katakana-candidate.js');
const original = fs.readFileSync(CANDIDATE_PATH, 'utf8');

const weights = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.15];

weights.forEach((w) => {
  const patched = original.replace(/const ASSIGNMENT_POSITION_WEIGHT = [\d.]+;/, `const ASSIGNMENT_POSITION_WEIGHT = ${w};`);
  fs.writeFileSync(CANDIDATE_PATH, patched);
  delete require.cache[require.resolve('./engine-katakana-candidate.js')];
  const Engine = require('./engine-katakana-candidate.js');
  const Traces = require('./golden-traces.js');
  const IW = require('./independent-wrong-trace.js');
  const KATAKANA = require('./fixtures/reference-data-katakana.generated.js');

  // U fix check
  const refDefs = KATAKANA['ウ'];
  const mw = Engine.evaluateCharacter(Traces.mildWobble(refDefs, 0.018, 11), refDefs, { allCharacters: KATAKANA, targetChar: 'ウ' });
  const un = Engine.evaluateCharacter(Traces.mildlyUneven(refDefs, 20), refDefs, { allCharacters: KATAKANA, targetChar: 'ウ' });
  const uFixed = mw.pass && un.pass;

  // Mirror check (all 46 chars, H+V)
  let mirrorUnexpected = 0;
  const mirrorDetail = [];
  Object.keys(KATAKANA).forEach((ch) => {
    const rd = KATAKANA[ch];
    const ideal = Traces.ideal(rd);
    const mH = ideal.map((s) => IW.w5MirrorHorizontal(s));
    const mV = ideal.map((s) => IW.w5MirrorVertical(s));
    [['H', mH], ['V', mV]].forEach(([lbl, tr]) => {
      const r = Engine.evaluateCharacter(tr, rd, { allCharacters: KATAKANA, targetChar: ch });
      if (r.pass) { mirrorUnexpected++; mirrorDetail.push(`${ch}${lbl}`); }
    });
  });

  // Full Motor Accessibility quick check
  const POSITIVE_CASES = [
    (r) => Traces.ideal(r), (r) => Traces.mildWobble(r, 0.012, 10), (r) => Traces.mildWobble(r, 0.018, 11),
    (r) => Traces.slightOffset(r, 0.03, 0.02), (r) => Traces.slightScale(r, 1.1),
    (r) => Traces.withIrregularSpacing(Traces.ideal(r), 40), (r) => Traces.withSmallBacktrack(Traces.ideal(r), 60),
    (r) => Traces.withTremor(Traces.ideal(r), 0.01, 1.2, 50), (r) => Traces.withBriefPause(Traces.ideal(r)),
    (r) => Traces.mildlyUneven(r, 20),
  ];
  let motorFail = 0;
  Object.keys(KATAKANA).forEach((ch) => {
    POSITIVE_CASES.forEach((fn) => {
      const r = Engine.evaluateCharacter(fn(KATAKANA[ch]), KATAKANA[ch], { allCharacters: KATAKANA, targetChar: ch });
      if (!r.pass) motorFail++;
    });
  });

  console.log(`w=${w.toFixed(2)}: U_fixed=${uFixed} mirror_unexpected=${mirrorUnexpected} [${mirrorDetail.join(',')}] motor_fail=${motorFail}`);
});

fs.writeFileSync(CANDIDATE_PATH, original);
console.log('\n(restored original candidate weight after sweep)');
