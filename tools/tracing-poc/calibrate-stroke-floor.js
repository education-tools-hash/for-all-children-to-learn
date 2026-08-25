#!/usr/bin/env node
// Phase T2-B'' — generalizes the「あ」3rd-stroke false-positive check to all
// 5 Pilot characters: draw every stroke ideally except the LAST one, which is
// replaced with a straight line between its own start/end (the single most
// telling "sloppy substitute" from the あ repro). Confirms the Per-Stroke
// Quality Floor rejects this pattern everywhere, not just for あ.
'use strict';
const Engine = require('./engine.js');
const Traces = require('./golden-traces.js');
const REFERENCE = require('./fixtures/reference-data.generated.js');

const CHARS = ['い', 'く', 'こ', 'あ', 'ま'];

function straightLineSubstitute(refDefs, idx) {
  const ideal = Traces.ideal(refDefs);
  const target = ideal[idx];
  const p0 = target[0], p1 = target[target.length - 1];
  const n = 20;
  const line = Array.from({ length: n }, (_, i) => ({
    x: p0.x + (p1.x - p0.x) * (i / (n - 1)),
    y: p0.y + (p1.y - p0.y) * (i / (n - 1)),
  }));
  return ideal.map((s, i) => (i === idx ? line : s));
}

console.log('=== Straight-line substitute for the LAST stroke only (all others ideal) ===\n');
let anyFail = false;
CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const lastIdx = refDefs.length - 1;
  if (lastIdx === 0) {
    console.log(`${ch}: skipped (1-stroke character, no "other good strokes to mask behind")`);
    return;
  }
  const strokes = straightLineSubstitute(refDefs, lastIdx);
  const result = Engine.evaluateCharacter(strokes, refDefs);
  const ok = result.pass === false;
  if (!ok) anyFail = true;
  console.log(
    `${ch} (${refDefs.length}画, last=${lastIdx}): pass=${result.pass}  score=${result.score.toFixed(3)}  ` +
    `lastStrokePerStrokeScore=${result.strokes[lastIdx].perStrokeScore.toFixed(3)}  reason=${result.reason}  ` +
    `[expect pass=false] ${ok ? 'OK' : 'FAIL <-- STILL A FALSE POSITIVE'}`
  );
});

console.log('\n=== Sanity: ideal traces still pass (floor must not reject good strokes) ===\n');
CHARS.forEach((ch) => {
  const refDefs = REFERENCE[ch];
  const result = Engine.evaluateCharacter(Traces.ideal(refDefs), refDefs);
  const ok = result.pass === true;
  if (!ok) anyFail = true;
  console.log(`${ch}: pass=${result.pass} score=${result.score.toFixed(3)} ${ok ? 'OK' : 'FAIL <-- regression'}`);
});

process.exitCode = anyFail ? 1 : 0;
