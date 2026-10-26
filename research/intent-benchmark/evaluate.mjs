import {cases} from './corruption-corpus.mjs';
import {interpretClause} from '../../src/progressive-interpreter.js';
import {suggestIntent} from '../../src/intent-candidate.js';
const scores=[];
function baseline(s){const x=interpretClause(s,{final:true});return x.status==='commit'?x.kind:x.status==='reject'?'REJECT':'CLARIFY'}
for(const c of cases){
 const base=baseline(c.heard),candidate=suggestIntent(c.heard);
 // Policy gate: candidate cannot invent slots or authorize firing.
 const proposed=(candidate.score>=0.7&&candidate.margin>=0.10)?candidate.intent:'CLARIFY';
 const safe=proposed==='HALT' && /^(?:driver|delta)\s+(?:halt|holt|hall)$/i.test(c.heard.trim()) ? 'HALT' : base;
 const row={id:c.id,heard:c.heard,expected:c.want,baseline:base,candidate:proposed,conservativeResult:safe,
   baselineCorrect:base===c.want,candidateCorrect:proposed===c.want,conservativeCorrect:safe===c.want,
   critical:c.risk==='critical'};
 scores.push(row);console.log(JSON.stringify(row));
}
const summary={
 samples:scores.length,
 baselineCorrect:scores.filter(x=>x.baselineCorrect).length,
 candidateCorrect:scores.filter(x=>x.candidateCorrect).length,
 conservativeCorrect:scores.filter(x=>x.conservativeCorrect).length,
 criticalFalseAuthorization:scores.filter(x=>x.critical&&['TURN','FIRE','CRUSH_TREE'].includes(x.conservativeResult)&&x.conservativeResult!==x.expected).length
};
console.log('INTENT_BENCHMARK_SUMMARY='+JSON.stringify(summary));
if(summary.criticalFalseAuthorization!==0)process.exitCode=1;
