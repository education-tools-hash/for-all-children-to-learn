#!/usr/bin/env node
// Phase SST-COMMON-RECORD-DETAIL-INTEGRATION-1 — Golden Test Harness for
// SST's Level 2 Detail Parity (docs/records/sst-common-record-detail-parity-audit-v1_0.md).
//
// Usage: node tools/record-dashboard-poc/sst-common-detail-golden-tests.js
//
// Existing-adapter regression for the other 21 apps (incl. Sawatte) is
// covered by golden-tests.js / ui-golden-tests.js /
// sawatte-common-detail-golden-tests.js (re-run alongside this file, not
// duplicated here).

'use strict';
const path = require('path');
const REPO_ROOT = path.join(__dirname, '..', '..');
const dash = require(path.join(REPO_ROOT, 'assets', 'js', 'record-dashboard-foundation.js'));
const SstDetail = require(path.join(REPO_ROOT, 'assets', 'js', 'sst-record-detail.js'));
const { FakeStorage } = require('./fixtures.js');

global.donomanaSstRecordDetail = SstDetail;

let pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  [OK  ]', label); }
  else { fail++; console.log('  [FAIL]', label, detail !== undefined ? ('— ' + JSON.stringify(detail)) : ''); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

const meta = dash.getAdapters().find(a => a.appId === 'sst-app');

// ────────────────────────────────────────────────────────────
section('1. Adapter unchanged (Level 1 metadata, backward compat)');
// ────────────────────────────────────────────────────────────
check('sst-app still registered', !!meta);
check('appId/appName/category/storageKey unchanged', meta && meta.appId === 'sst-app' && meta.appName === 'SST ソーシャルスキルトレーニング' && meta.category === '自立活動' && meta.storageKey === 'sst_activity_log_v1');

// ────────────────────────────────────────────────────────────
section('2. Real production-shape fixtures — 8 detail types');
// ────────────────────────────────────────────────────────────
const FIXTURES = {
  roleplay_choice: { ts: Date.parse('2026-09-16T03:00:00Z'), type: 'rp', lv: 'lv1', result: 'best', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'roleplay_choice',
    scenario: { id: 's1', title: '休み時間に誘われた', situation: '友だちに一緒に遊ぼうと誘われました' },
    choices: [{ id: 'c1', text: 'いいよ、一緒に遊ぼう', level: 'best' }, { id: 'c2', text: '今は無理', level: 'good' }],
    selected: { id: 'c1', text: 'いいよ、一緒に遊ぼう', level: 'best' }, custom: false
  }},
  branch_ending: { ts: Date.parse('2026-09-16T04:00:00Z'), type: 'branch', lv: 'lv1', result: 'best', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'branch_ending', scenario: { title: '図書室でのできごと' },
    route: ['静かに本を探す', '司書の先生に聞く'], ending: { title: '本が見つかった', desc: 'よかったね', level: 'best' }
  }},
  emotion_selection: { ts: Date.parse('2026-09-16T05:00:00Z'), type: 'emotion', lv: 0, result: 'うれしい', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'emotion_selection', selected: { label: 'うれしい', face: '😊' }
  }},
  phrase_action: { ts: Date.parse('2026-09-16T06:00:00Z'), type: 'phrase', lv: 0, result: 'spoken', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'phrase_action', category: 'help', phrase: '先生、ちょっといいですか？', action: 'spoken'
  }},
  breathing_activity: { ts: Date.parse('2026-09-16T07:00:00Z'), type: 'breath', lv: 0, result: 'done', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'breathing_activity', activityTitle: 'きもちを落ち着ける', completionStatus: 'done'
  }},
  word_quiz_session: { ts: Date.parse('2026-09-16T08:00:00Z'), type: 'wq', lv: 'lv1', result: 'done', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'word_quiz_session', answers: [
      { question: { id: 'q1', situation: 's', prompt: 'これは何と言う？' }, choices: [{ id: 'a', text: 'おはよう', level: 'best' }], selected: { id: 'a', text: 'おはよう', level: 'best' } },
      { question: { id: 'q2', situation: 's', prompt: '次は？' }, choices: [{ id: 'b', text: 'こんにちは', level: 'good' }], selected: { id: 'b', text: 'こんにちは', level: 'good' } }
    ]
  }},
  sst_quiz_session: { ts: Date.parse('2026-09-16T09:00:00Z'), type: 'quiz', lv: 2, result: '80%', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'sst_quiz_session', answers: [
      { question: { id: 'q1', text: 'どうする？' }, choices: [{ id: 'a', text: '謝る', level: 'best' }], selected: { id: 'a', text: '謝る', level: 'support' } }
    ]
  }},
  social_story_completion: { ts: Date.parse('2026-09-16T10:00:00Z'), type: 'story', lv: 'lv1', result: 'done', schemaVersion: 1, detail: {
    detailSchemaVersion: 1, type: 'social_story_completion', story: { id: 'st1', title: '朝のあいさつ' },
    answers: [{ pageIndex: 0, prompt: { text: 'あいさつは？' }, choices: [{ id: 'a', text: 'おはよう', level: 'best' }], selected: { id: 'a', text: 'おはよう', level: 'best' } }]
  }}
};
FIXTURES.social_story_completion_empty = { ts: Date.parse('2026-09-16T10:30:00Z'), type: 'story', lv: 'lv1', result: 'done', schemaVersion: 1, detail: {
  detailSchemaVersion: 1, type: 'social_story_completion', story: { id: 'st2', title: 'タイトルのみ' }, answers: []
}};
FIXTURES.legacy_thermo = { ts: Date.parse('2026-09-16T11:00:00Z'), type: 'thermo', lv: 0, result: '5', schemaVersion: 1 };
FIXTURES.legacy_photo = { ts: Date.parse('2026-09-16T11:30:00Z'), type: 'photo', lv: 0, result: 'best', schemaVersion: 1 };
FIXTURES.legacy_diary = { ts: Date.parse('2026-09-16T12:00:00Z'), type: 'diary', lv: 0, result: 'うれしい', schemaVersion: 1 };
FIXTURES.malformed_detail = { ts: Date.parse('2026-09-16T12:30:00Z'), type: 'rp', lv: 'lv1', result: 'best', schemaVersion: 1, detail: {} };
FIXTURES.unknown_version = { ts: Date.parse('2026-09-16T13:00:00Z'), type: 'rp', lv: 'lv1', result: 'best', schemaVersion: 1, detail: {
  detailSchemaVersion: 2, type: 'roleplay_choice', scenario: { title: 'x' }
}};
FIXTURES.unknown_type = { ts: Date.parse('2026-09-16T13:30:00Z'), type: 'rp', lv: 'lv1', result: 'best', schemaVersion: 1, detail: {
  detailSchemaVersion: 1, type: 'some_future_activity', scenario: { title: 'ふしぎな場面' }, choices: [{ text: 'A' }], selected: { text: 'A', level: 'best' }
}};

// collectRecords via storage for the 8 known types
{
  const storage = new FakeStorage();
  const KNOWN = ['roleplay_choice', 'branch_ending', 'emotion_selection', 'phrase_action', 'breathing_activity', 'word_quiz_session', 'sst_quiz_session', 'social_story_completion'];
  storage.setItem('sst_activity_log_v1', JSON.stringify(KNOWN.map(k => FIXTURES[k])));
  const result = dash.collectRecords({ storage, appIds: ['sst-app'], maxPerApp: 50 });
  check('all 8 fixtures normalize without crashing', result.records.length === 8, result);
  check('0 read/normalize errors', result.errors.length === 0, result.errors);
}

// ────────────────────────────────────────────────────────────
section('3. getDetails() via the real public API — per type');
// ────────────────────────────────────────────────────────────
function rowMap(appId, entry) { const m = {}; dash.getRecordDetails(appId, entry).forEach(r => m[r.label] = r.value); return m; }

let m = rowMap('sst-app', FIXTURES.roleplay_choice);
check('roleplay_choice: 場面', m['場面'] === '休み時間に誘われた', m);
check('roleplay_choice: 提示された選択肢', m['提示された選択肢'] === '①いいよ、一緒に遊ぼう｜②今は無理', m);
check('roleplay_choice: 選んだ回答', m['選んだ回答'] === 'いいよ、一緒に遊ぼう', m);
check('roleplay_choice: 教材内区分', m['教材内区分'] === 'best', m);

m = rowMap('sst-app', FIXTURES.branch_ending);
check('branch_ending: たどりついたエンディング', m['たどりついたエンディング'] === '本が見つかった', m);
check('branch_ending: たどった道', m['たどった道'] === '①静かに本を探す｜②司書の先生に聞く', m);

m = rowMap('sst-app', FIXTURES.emotion_selection);
check('emotion_selection: 選んだカード', m['選んだカード'] === '😊 うれしい', m);

m = rowMap('sst-app', FIXTURES.phrase_action);
check('phrase_action: カテゴリ', m['カテゴリ'] === '助けを求める', m);
check('phrase_action: 実行した操作', m['実行した操作'] === '読み上げました', m);

m = rowMap('sst-app', FIXTURES.breathing_activity);
check('breathing_activity: 状態', m['状態'] === '完了', m);

m = rowMap('sst-app', FIXTURES.word_quiz_session);
check('word_quiz_session: 全体の記録', m['全体の記録'] === '全2問', m);
check('word_quiz_session: 問題1', m['問題1'] === 'Q: これは何と言う？／選んだ回答: おはよう（教材内区分：best）', m);

m = rowMap('sst-app', FIXTURES.sst_quiz_session);
check('sst_quiz_session: support tier preserved verbatim', m['問題1'].indexOf('support') !== -1, m);

m = rowMap('sst-app', FIXTURES.social_story_completion);
check('social_story_completion: 場面', m['場面'] === '朝のあいさつ', m);
check('social_story_completion: 問題1', m['問題1'] === 'Q: あいさつは？／選んだ回答: おはよう（教材内区分：best）', m);

m = rowMap('sst-app', FIXTURES.social_story_completion_empty);
check('social_story_completion (no answers): only 場面, no crash', m['場面'] === 'タイトルのみ' && !('全体の記録' in m), m);

// ────────────────────────────────────────────────────────────
section('4. Legacy / malformed / unknown — Common Detail must not break');
// ────────────────────────────────────────────────────────────
check('legacy (thermo, no detail): getRecordDetails returns []', dash.getRecordDetails('sst-app', FIXTURES.legacy_thermo).length === 0);
check('legacy (photo, no detail): getRecordDetails returns []', dash.getRecordDetails('sst-app', FIXTURES.legacy_photo).length === 0);
check('legacy (diary, no detail): getRecordDetails returns []', dash.getRecordDetails('sst-app', FIXTURES.legacy_diary).length === 0);
check('malformed detail ({}): getRecordDetails returns [], no throw', dash.getRecordDetails('sst-app', FIXTURES.malformed_detail).length === 0);
check('unknown detailSchemaVersion: getRecordDetails returns [] (fallback to Level 1)', dash.getRecordDetails('sst-app', FIXTURES.unknown_version).length === 0);
m = rowMap('sst-app', FIXTURES.unknown_type);
check('unknown type: safe fallback renders 場面/選んだ回答', m['場面'] === 'ふしぎな場面' && m['選んだ回答'] === 'A', m);
check('getRecordDetails never throws on null/undefined entry', (() => { try { dash.getRecordDetails('sst-app', null); dash.getRecordDetails('sst-app', undefined); return true; } catch (e) { return false; } })());

// Normalize must still succeed (Level 1) for every legacy/malformed/unknown fixture
{
  const storage = new FakeStorage();
  const edge = [FIXTURES.legacy_thermo, FIXTURES.legacy_photo, FIXTURES.legacy_diary, FIXTURES.malformed_detail, FIXTURES.unknown_version, FIXTURES.unknown_type];
  storage.setItem('sst_activity_log_v1', JSON.stringify(edge));
  const result = dash.collectRecords({ storage, appIds: ['sst-app'], maxPerApp: 50 });
  check('edge-case records: record itself never hidden (6 normalized)', result.records.length === 6, result);
}

// ────────────────────────────────────────────────────────────
section('5. Rich Visualization — NOT APPLICABLE (Audit §15)');
// ────────────────────────────────────────────────────────────
check('supportsRichVisualization is false for every fixture (SST has none)', Object.keys(FIXTURES).every(k => dash.supportsRichVisualization('sst-app', FIXTURES[k]) === false));
check('renderRichVisualization is a safe no-op (adapter defines none)', (() => { try { dash.renderRichVisualization('sst-app', {}, FIXTURES.roleplay_choice); return true; } catch (e) { return false; } })());

// ────────────────────────────────────────────────────────────
section('6. CSV Parity — getCsvActions(), exact 8-column shape');
// ────────────────────────────────────────────────────────────
{
  const csvActions = dash.getCsvActions('sst-app');
  check('getCsvActions returns exactly 1 action (detail CSV)', csvActions.length === 1, csvActions.map(a => a.id));
  check('getCsvActions returns [] for an unregistered appId', dash.getCsvActions('does-not-exist').length === 0);
  const action = csvActions[0];
  const log = [FIXTURES.roleplay_choice, FIXTURES.branch_ending, FIXTURES.emotion_selection, FIXTURES.phrase_action, FIXTURES.breathing_activity, FIXTURES.word_quiz_session, FIXTURES.sst_quiz_session, FIXTURES.social_story_completion, FIXTURES.legacy_thermo];
  const rows = action.buildRows(log);
  check('CSV header has exactly 8 columns', rows[0].length === 8, rows[0]);
  check('CSV header matches Audit §12 exactly', JSON.stringify(rows[0]) === JSON.stringify(['日時', '教材', 'モード', '場面', '問題文', '提示された選択肢', '選んだ回答', '教材内区分']));
  check('CSV has 9 data rows (8 typed + 1 legacy)', rows.length === 10, rows.length);
  check('legacy row (thermo): scene/question/choices/selected/tier all empty', JSON.stringify(rows[9].slice(3)) === JSON.stringify(['', '', '', '', '']), rows[9]);
  check('roleplay row: 教材 column uses SST_ACT_LABEL name', rows[1][1] === 'ロールプレイ', rows[1]);
  check('action disabled() is false when the log has valid-detail records', action.disabled(log) === false);
  check('action disabled() is true for an all-legacy log', action.disabled([FIXTURES.legacy_thermo, FIXTURES.legacy_photo]) === true);
  check('action does not throw on malformed log entries (null/string/number)', (() => { try { action.buildRows([null, 'x', 42, FIXTURES.legacy_thermo]); return true; } catch (e) { return false; } })());
}

// ────────────────────────────────────────────────────────────
section('7. App-local / Common semantic parity (same record, same values)');
// ────────────────────────────────────────────────────────────
{
  // App-local's own getDetailRows() call (same shared function) must equal
  // what Common receives through the public API passthrough — verifies the
  // Adapter's getDetails() is a pure delegate, not a re-implementation.
  const direct = SstDetail.getDetailRows(FIXTURES.sst_quiz_session);
  const viaCommon = dash.getRecordDetails('sst-app', FIXTURES.sst_quiz_session);
  check('Common getRecordDetails() output is byte-identical to direct SstDetail.getDetailRows()', JSON.stringify(direct) === JSON.stringify(viaCommon));
}

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed.');
if (fail > 0) { console.log(fail + ' FAILURES.'); process.exit(1); }
console.log('ALL PASS.');
