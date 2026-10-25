import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission} from '../src/command-parser.js';
import {makeGame,command,step,norm,diff} from '../src/model.js';

const graph=sentence=>parseTransmission(sentence);
const goldens=[
 ['Driver advance',['ADVANCE']],
 ['Driver, advance and turn 20 degrees left',['ADVANCE','TURN']],
 ['Driver advance and turn twenty degrees left',['ADVANCE','TURN']],
 ['Driver reverse five meters',['REVERSE']],
 ['Delta turn 90 degrees right',['TURN']],
 ['Driver turn left ten degrees',['TURN']],
 ['Gunner traverse left',['TRAVERSE']],
 ['Gunner slew to the right',['TRAVERSE']],
 ['Loader armor-piercing',['LOAD']],
 ['Gamma load HE',['LOAD']],
 ['Gamma smoke',['LOAD']],
 ['Beta fire',['FIRE']],
 ['Beta acquire and fire',['ACQUIRE','FIRE']],
 ['Gunner hold fire',['HOLD_FIRE']],
 ['Silver report',['REPORT']],
 ['Silver what do you see',['REPORT']],
 ['Driver face north',['HEADING']],
 ['Driver head east',['HEADING']],
 ['Driver turn to bearing 270',['HEADING']],
 ['Beta target at 3 oclock',['SPOT']],
 ["Alpha designate enemy at 6 o'clock",['SPOT']],
 ['Silver enemy to our right',['SPOT']],
 ['Driver halt when gunner reports locked',['HALT']],
 ['Driver advance until enemy contact confirmed',['ADVANCE']],
 ['Gunner fire when loaded',['FIRE']],
 ['Driver advance while Gamma load AP',['ADVANCE','LOAD']],
 ['Gamma load HE then Beta acquire and fire',['LOAD','ACQUIRE','FIRE']],
 ['Driver reverse ten yards and pivot forty five degrees right',['REVERSE','TURN']],
 ['Driver advance twenty meters then turn left thirty degrees',['ADVANCE','TURN']],
 ['Silver report; Delta advance; Gamma load AP; Beta acquire and fire',['REPORT','ADVANCE','LOAD','ACQUIRE','FIRE']],
];
for(const [prompt,actions] of goldens)test('source-derived command graph: '+prompt,()=>{
 const p=graph(prompt);
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.deepEqual(p.frames.map(f=>f.action),actions);
});
test('GDD two-axis steering keeps move and turn simultaneously',()=>{
 const g=makeGame();const start=g.player.hull,initial=g.player.z;
 assert.match(command(g,'Driver advance and turn twenty degrees left'),/Turning left 20 degrees/);
 for(let i=0;i<100;i++)step(g,.05);
 assert.ok(Math.abs(diff(g.player.hull,norm(start-20)))<1e-6);
 assert.ok(g.player.z>initial);assert.equal(g.player.turn,0);
});
test('finite distance movement actually stops',()=>{
 const g=makeGame();const x=g.player.x,z=g.player.z;
 command(g,'Driver advance 10 meters');
 for(let i=0;i<100;i++)step(g,.05);
 assert.equal(g.player.moving,0);
 assert.ok(Math.abs(Math.hypot(g.player.x-x,g.player.z-z)-10)<1e-6);
});
test('sequenced turn finishes before advancing',()=>{
 const g=makeGame();const initial=g.player.z;
 const p=graph('Driver turn left ten degrees then advance five meters');
 assert.deepEqual(p.frames[1].dependencies,[{type:'AFTER_FRAME',frame:0}]);
 command(g,'Driver turn left ten degrees then advance five meters');
 assert.equal(g.player.moving,0);
 for(let i=0;i<30;i++)step(g,.05);
 assert.ok(g.player.moving>0||g.player.moveRemaining===0);
 for(let i=0;i<100;i++)step(g,.05);
 assert.equal(g.player.moveRemaining,0);
 assert.notEqual(g.player.z,initial);
});
test('THEN stage passes prerequisite to every simultaneous member',()=>{
 const p=graph('Gamma load AP then Beta acquire and fire');
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.deepEqual(p.frames[1].dependencies,[{type:'AFTER_FRAME',frame:0}]);
 assert.deepEqual(p.frames[2].dependencies,[{type:'AFTER_FRAME',frame:0}]);
});
test('conditional halt remains standing until gunner locked',()=>{
 const g=makeGame();command(g,'Driver advance');
 command(g,'Driver halt when gunner reports locked');
 assert.ok(g.player.moving>0);
 assert.equal(g.orderJobs.filter(j=>j.status==='pending').length,1);
 g.player.aimTime=2;step(g,.05);
 assert.equal(g.player.moving,0);
});
test('until-contact movement stops after actual contact',()=>{
 const g=makeGame();command(g,'Driver advance until enemy contact confirmed');
 assert.ok(g.player.moving>0);
 g.enemySeen=true;step(g,.05);
 assert.equal(g.player.moving,0);
});
test('crew selection remains independent of input modality',()=>{
 const g1=makeGame(),g2=makeGame();
 command(g1,'driver advance and turn 20° left');
 command(g2,'Driver advance and turn twenty degrees left');
 assert.equal(g1.player.moving,g2.player.moving);
 assert.equal(g1.player.turn,g2.player.turn);
 assert.equal(g1.player.turnRemaining,g2.player.turnRemaining);
});
const invalid=[
 ['driver advance and teleport','UNPARSED_CONJUNCTION'],
 ['driver advance until unicorns arrive','UNKNOWN_CONDITION'],
 ['driver advance then halt','NON_TERMINATING_DEPENDENCY'],
 ['driver advance and reverse','CONFLICTING_CONCURRENT_ORDERS'],
 ['driver turn left and turn right','CONFLICTING_CONCURRENT_ORDERS'],
 ['gamma load AP and gamma load HE','CONFLICTING_CONCURRENT_ORDERS'],
 ['driver turn left 0 degrees','INVALID_ANGLE'],
 ['driver advance -10 meters','NEGATIVE_QUANTITY'],
 ['driver turn both left and right','CONTRADICTORY_DIRECTIONS'],
 ['loader load AP and HE','CONFLICTING_AMMUNITION'],
 ['driver advance to orchard','ROUTE_UNAVAILABLE'],
 ['driver turn to the moon','MISSING_DIRECTION'],
 ['driver fire','WRONG_CREW'],
 ['driver advance if it feels lucky','UNKNOWN_CONDITION']
];
for(const [utterance,code] of invalid)test('fail closed: '+utterance,()=>{
 const parsed=graph(utterance);
 assert.equal(parsed.ok,false,'unexpected accepted utterance '+utterance);
 assert.ok(parsed.errors.some(e=>e.code===code),'expected '+code+' got '+JSON.stringify(parsed.errors));
 const g=makeGame(),start=g.player.hull;
 command(g,utterance);assert.equal(g.player.moving,0);assert.equal(g.player.hull,start);
 assert.equal(g.orderJobs.length,0);
});
test('large compound command remains deterministic across 100 compilations',()=>{
 const utterance='Silver report; Driver advance 20 meters and turn left 30 degrees while Gamma load armor piercing, then Beta acquire and fire';
 const baseline=JSON.stringify(graph(utterance));
 for(let i=0;i<100;i++)assert.equal(JSON.stringify(graph(utterance)),baseline);
});

test('ASR autocorrect variants preserve compound two-order execution',()=>{
 for(const phrase of ['Driver advanced and turn twenty degrees left','Driver advancd and trun 20 degrees left','Driver advnace and turn left 20 degrees']){
  const p=graph(phrase);assert.equal(p.ok,true,JSON.stringify(p));assert.deepEqual(p.frames.map(f=>f.action),['ADVANCE','TURN']);
  const g=makeGame();command(g,phrase);assert.ok(g.player.moving>0,phrase);assert.ok(g.player.turn<0,phrase);
 }
});
test('independent two-crew orders in one transmission',()=>{
 const p=graph('Driver advanced and Gamma load AP');
 assert.equal(p.ok,true,JSON.stringify(p));assert.deepEqual(p.frames.map(f=>f.action),['ADVANCE','LOAD']);
 const g=makeGame();const response=command(g,'Driver advanced and Gamma load AP');
 assert.ok(g.player.moving>0);assert.ok(g.loading>0);assert.match(response,/Advancing/);assert.match(response,/loading/i);
});
