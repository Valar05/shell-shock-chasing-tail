import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission,normalizeCommandSlots} from '../src/command-parser.js';
import {makeGame,command,step,diff,norm} from '../src/model.js';

const actions=[
 {actor:'Driver',verb:'advance',canonical:'ADVANCE',variants:['advance','advanced','advancing','advancd','advnace','advanc','advans','advenced']},
 {actor:'Driver',verb:'reverse',canonical:'REVERSE',variants:['reverse','revers','reverce','reversed','reversing']},
 {actor:'Driver',verb:'halt',canonical:'HALT',variants:['halt','haltt','stop','stopped','stoped']},
 {actor:'Driver',verb:'turn',canonical:'TURN',variants:['turn','trun','tern','turnt','turning']},
 {actor:'Gunner',verb:'traverse',canonical:'TRAVERSE',variants:['traverse','travers','traversed','traversing']},
 {actor:'Loader',verb:'load',canonical:'LOAD',variants:['load','loaded','loading','reaload','reload']},
 {actor:'Gunner',verb:'fire',canonical:'FIRE',variants:['fire','fier','fiire','fired','firing']},
 {actor:'Silver',verb:'report',canonical:'REPORT',variants:['report','reporting','status','sitrep']},
];
const suffix={TURN:' twenty degrees left',TRAVERSE:' fifteen degrees right',LOAD:' AP'};
function canonicalize(verb,action){return verb+(suffix[action]||'');}
const samples=actions.flatMap(entry=>entry.variants.map(variant=>({
 text:entry.actor+' '+canonicalize(variant,entry.canonical),action:entry.canonical
})));
for(const item of samples)test('speech variant '+item.text,()=>{
 const parsed=parseTransmission(item.text);
 assert.equal(parsed.ok,true,JSON.stringify(parsed));
 assert.deepEqual(parsed.frames.map(f=>f.action),[item.action]);
});
const duals=[
 ['Driver advanced and turn twenty degrees left',['ADVANCE','TURN']],
 ['Driver advancd and trun 20 degrees left',['ADVANCE','TURN']],
 ['Driver advanced while Gamma load AP',['ADVANCE','LOAD']],
 ['Delta advance and Gunner traverse left 20 degrees',['ADVANCE','TRAVERSE']],
 ['Silver report and Delta reverse 5 meters',['REPORT','REVERSE']],
 ['Gamma load AP and beta acquire',['LOAD','ACQUIRE']],
 ['Delta turn left 10° and Gamma reload AP',['TURN','LOAD']],
 ['Gunner acquire and fire',['ACQUIRE','FIRE']],
 ['Driver halt and Gunner hold fire',['HALT','HOLD_FIRE']],
 ['Driver advance twenty meters then turn right twenty degrees',['ADVANCE','TURN']],
 ['Gamma load armor piercing then Beta fire',['LOAD','FIRE']]
];
for(const [speech,expected] of duals)test('two action grammar '+speech,()=>{
 const compiled=parseTransmission(speech);
 assert.equal(compiled.ok,true,JSON.stringify(compiled));
 assert.deepEqual(compiled.frames.map(f=>f.action),expected);
});
test('two commands apply to game state, not just parser',()=>{
 const g=makeGame();
 const response=command(g,'Driver advancd and turn twenty degrees left');
 assert.match(response,/Advancing/);assert.match(response,/Turning left 20 degrees/);
 assert.ok(g.player.moving>0);assert.ok(g.player.turn<0);
 const initial=g.player.hull;for(let i=0;i<80;i++)step(g,.05);
 assert.ok(Math.abs(diff(g.player.hull,norm(initial-20)))<.00001);
});
test('many three and four command packets produce all frames',()=>{
 for(const first of ['Driver advance and turn 20 degrees left','Driver reverse 6 meters and turn right 15 degrees']){
  for(const ammo of ['AP','HE']){
   const text=first+' while Gamma load '+ammo+' and Beta acquire';
   const p=parseTransmission(text);
   assert.equal(p.ok,true,JSON.stringify(p));
   assert.deepEqual(p.frames.map(x=>x.action),[first.includes('advance')?'ADVANCE':'REVERSE','TURN','LOAD','ACQUIRE']);
  }
 }
});
const invalid=[
 'Driver teleport 40 meters',
 'Driver fire',
 'Loader load AP and HE',
 'Driver left right 20 degrees',
 'Driver advance and teleport',
 'Driver advance then turn left',
 'Driver advance until the moon falls',
 'Driver turn left zero degrees'
];
for(const speech of invalid)test('never hallucinate '+speech,()=>{
 const g=makeGame();
 const p=parseTransmission(speech);
 assert.equal(p.ok,false,JSON.stringify(p));
 command(g,speech);
 assert.equal(g.player.moving,0);assert.equal(g.player.turn,0);
 assert.equal(g.orderJobs.length,0);
});
test('fuzzy normalization cannot mutate numeric, target, names',()=>{
 assert.equal(normalizeCommandSlots('driver advance 110 degrees'),'driver advance 110 degrees');
 assert.equal(normalizeCommandSlots('gamma load AP'),'gamma load AP');
 assert.equal(normalizeCommandSlots('silver enemy to our right'),'silver enemy to our right');
});
test('generated corpus deterministic in 20 runs',()=>{
 for(const item of [...samples,...duals.map(([text])=>({text}))]){
  const receipt=JSON.stringify(parseTransmission(item.text));
  for(let i=0;i<20;i++)assert.equal(JSON.stringify(parseTransmission(item.text)),receipt);
 }
});

test('reference v6.3 actor splitting handles natural unpunctuated multi-recipient speech',()=>{
 const cases=[
  ['Driver advance Gamma load AP',['ADVANCE','LOAD']],
  ['Silver report Driver halt',['REPORT','HALT']],
  ['Driver turn left ten degrees Gunner traverse right fifteen degrees',['TURN','TRAVERSE']],
  ['Gamma load HE Beta acquire and fire',['LOAD','ACQUIRE','FIRE']],
 ];
 for(const [speech,actions] of cases){
  const p=parseTransmission(speech);
  assert.equal(p.ok,true,JSON.stringify(p));
  assert.deepEqual(p.frames.map(x=>x.action),actions);
 }
});
test('v6.3 actor splitting never splits a subordinate gunner condition',()=>{
 const p=parseTransmission('Driver halt when gunner reports locked');
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.deepEqual(p.frames.map(x=>x.action),['HALT']);
 assert.equal(p.frames[0].condition.type,'GUNNER_LOCKED');
});
