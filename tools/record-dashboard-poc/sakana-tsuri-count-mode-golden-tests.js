// Count facts must not turn legacy/missing fields into inferred assessments.
const assert = require('assert');
const D = require('../../assets/js/sakana-tsuri-record-detail.js');
let n = 0;
function check(name, fn) { fn(); n++; console.log('PASS - ' + name); }
const old = {timestamp:'2026-10-01',payload:{caughtColor:'orange',caughtSize:'small'}};
const current = {timestamp:'2026-10-04',payload:{mode:'count',targetCount:3,caughtCount:1,challengeId:'synthetic-count-1',challengeCompleted:false,caughtColor:'orange'}};
const done = {...current,payload:{...current.payload,caughtCount:3,challengeCompleted:true}};
check('legacy no invented mode',()=>assert(!D.getDetailRows(old).some(r=>r.label==='あそびかた')));
check('legacy no invented count',()=>assert(!D.summaryText(old.payload).includes('目標')));
check('explicit free displayed',()=>assert(D.getDetailRows({payload:{mode:'free'}}).some(r=>r.value==='自由')));
check('count mode displayed',()=>assert(D.getDetailRows(current).some(r=>r.value==='かず')));
check('target saved fact',()=>assert(D.summaryText(current.payload).includes('目標 3匹')));
check('progress saved fact',()=>assert(D.summaryText(current.payload).includes('この釣果まで 1匹')));
check('unfinished not final failure',()=>assert(D.summaryText(current.payload).includes('この釣果時点で目標未達')));
check('final catch completion',()=>assert(D.summaryText(done.payload).includes('この釣果で目標達成')));
check('challenge id in details',()=>assert(D.getDetailRows(current).some(r=>r.label==='課題ID'&&r.value==='synthetic-count-1')));
const csv=D.buildDetailCsvRows([old,current,done]);
check('csv nine columns unchanged',()=>assert(csv.every(r=>r.length===9)));
check('csv existing header unchanged',()=>assert.deepStrictEqual(csv[0],D.CSV_HEADER));
check('csv count facts included',()=>assert(csv[2][2].includes('目標 3匹')&&csv[2][2].includes('この釣果まで 1匹')));
check('csv id included',()=>assert(csv[2][2].includes('synthetic-count-1')));
check('csv legacy no inferred goal',()=>assert(!csv[1][2].includes('目標')));
check('missing completion not inferred',()=>assert(!D.summaryText({mode:'count'}).includes('達成')));
check('invalid target not displayed',()=>assert(!D.summaryText({mode:'count',targetCount:99}).includes('目標')));
console.log(`${n}/${n} ALL PASS`);
