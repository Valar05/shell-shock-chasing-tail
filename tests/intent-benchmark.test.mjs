import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {suggestIntent} from '../src/intent-candidate.js';
test('benchmarks independent corruption fixtures with no critical wrong execution',()=>{
 const output=execFileSync(process.execPath,['research/intent-benchmark/evaluate.mjs'],{encoding:'utf8'});
 const line=output.split('\n').find(x=>x.startsWith('INTENT_BENCHMARK_SUMMARY='));
 assert.ok(line,'Missing audit summary');
 const report=JSON.parse(line.slice('INTENT_BENCHMARK_SUMMARY='.length));
 assert.equal(report.samples,16);
 assert.equal(report.criticalFalseAuthorization,0);
 assert.ok(report.baselineCorrect>=1);
 console.log(line);
});
test('intent suggestion cannot itself authorize gameplay',()=>{
 for(const phrase of ['beta fire','turn thirty degrees left','driver hall','do not fire']){
  const candidate=suggestIntent(phrase);
  assert.equal(candidate.authorized,false);
  assert.ok(candidate.score>=0&&candidate.score<=1);
 }
});
