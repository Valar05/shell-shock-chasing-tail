import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission} from '../src/command-parser.js';
import {makeGame,command,step,diff,norm} from '../src/model.js';
const parse=s=>parseTransmission(s);
const cases=[
 ['driver advance and turn 20 degrees left',['ADVANCE','TURN']],
 ['driver, advance and turn twenty degrees left',['ADVANCE','TURN']],
 ['Delta advance; Delta turn right 10°',['ADVANCE','TURN']],
 ['Driver reverse five meters, then turn 45 degrees right',['REVERSE','TURN']],
 ['driver advance and loader load AP then gunner fire',['ADVANCE','LOAD','FIRE']],
 ['Silver report; Delta advance; Gamma load HE; Beta acquire and fire',['REPORT','ADVANCE','LOAD','ACQUIRE','FIRE']],
];
for(const [utterance,expected] of cases)test('compound frames '+utterance,()=>{const p=parse(utterance);assert.equal(p.ok,true,JSON.stringify(p));assert.deepEqual(p.frames.map(f=>f.action),expected);});
test('combined advance turn actually moves and turns left',()=>{const g=makeGame();const start=g.player.hull,z=g.player.z;const receipt=command(g,'driver advance and turn 20 degrees left');assert.match(receipt,/Advancing/);assert.match(receipt,/left 20 degrees/);for(let i=0;i<50;i++)step(g,.05);assert.ok(g.player.z>z);assert.ok(Math.abs(diff(g.player.hull,norm(start-20)))<.0001);assert.equal(g.player.turn,0);});
test('turn direction sign and finite end are stable',()=>{for(const [direction,sign] of [['left',-1],['right',1]]){const g=makeGame();const a=g.player.hull;command(g,'driver turn '+direction+' 10 degrees');for(let i=0;i<50;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,norm(a+sign*10)))<.00001);assert.equal(g.player.turn,0);}});
test('fails closed on unknown clauses',()=>{const p=parse('driver advance then teleport');assert.equal(p.ok,false);assert.equal(p.errors[0].code,'UNKNOWN_ACTION');const g=makeGame();command(g,'driver advance then teleport');assert.equal(g.player.moving,0);});
test('parser repeated input deterministic',()=>{const input='Driver advance and turn twenty degrees left, then Gamma load AP and Beta fire';const first=JSON.stringify(parse(input));for(let i=0;i<30;i++)assert.equal(JSON.stringify(parse(input)),first);});

test('gunner traverse remains independent of hull heading',()=>{const g=makeGame();const h=g.player.hull,t=g.player.turret;const receipt=command(g,'Gunner traverse left 20 degrees');assert.match(receipt,/Traversing left 20 degrees/);for(let i=0;i<60;i++)step(g,.05);assert.equal(g.player.hull,h);assert.ok(Math.abs(diff(g.player.turret,norm(t-20)))<.00001);});
test('GDD deferred halt waits for gunner lock',()=>{const g=makeGame();command(g,'driver advance');const result=command(g,'driver halt when gunner reports locked');assert.match(result,/Standing by for gunner locked/);assert.ok(g.player.moving>0);assert.equal(g.orderJobs.filter(j=>j.status==='pending').length,1);g.player.aimTime=2;step(g,.05);assert.equal(g.player.moving,0);assert.equal(g.orderJobs.filter(j=>j.status==='pending').length,0);});
test('unsupported conditional fails closed with no movement',()=>{const g=makeGame();const r=command(g,'driver advance until the moon falls');assert.match(r,/UNKNOWN_CONDITION/);assert.equal(g.player.moving,0);});

test('spoken degrees are primary, symbol is only an optional input alias',()=>{
 const pairs=[
  ['driver turn left twenty degrees','driver turn left 20°','TURN','degrees',20],
  ['turn right forty five degrees','turn right 45°','TURN','degrees',45],
  ['gunner traverse left ninety degrees','gunner traverse left 90°','TRAVERSE','degrees',90],
  ['driver turn right one hundred eighty degrees','driver turn right 180°','TURN','degrees',180],
 ];
 for(const [spoken,symbol,action,field,value] of pairs){
  const a=parse(spoken),b=parse(symbol);
  assert.equal(a.ok,true,spoken+': '+JSON.stringify(a.errors));
  assert.equal(b.ok,true,symbol+': '+JSON.stringify(b.errors));
  assert.equal(a.frames[0].action,action);
  assert.equal(a.frames[0][field],value);
  assert.equal(b.frames[0][field],value);
  assert.equal(a.frames[0].actor,b.frames[0].actor);
 }
});
test('spoken heading with degrees preserves absolute bearing',()=>{
 for(const [spoken,value] of [['heading ninety degrees',90],['driver heading one hundred and eighty degrees',180]]){
  const result=parse(spoken);
  assert.equal(result.ok,true,JSON.stringify(result.errors));
  assert.equal(result.frames[0].action,'HEADING');
  assert.deepEqual(result.frames[0].bearing,{type:'ABSOLUTE',value});
 }
});
