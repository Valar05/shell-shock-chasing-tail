import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission} from '../src/command-parser.js';
import {makeGame,command,step,diff,norm} from '../src/model.js';
const parse=s=>parseTransmission(s);
const cases=[
 ['driver advance and turn 20 degrees left',['ADVANCE','TURN']],
 ['driver, advance and turn twenty degrees left',['ADVANCE','TURN']],
 ['Delta advance; Delta turn right 10°',['ADVANCE','TURN']],
 ['Driver reverse, then turn 45 degrees right',['REVERSE','TURN']],
 ['driver advance and loader load AP then gunner fire',['ADVANCE','LOAD','FIRE']],
 ['Silver report; Delta advance; Gamma load HE; Beta acquire and fire',['REPORT','ADVANCE','LOAD','ACQUIRE','FIRE']],
];
for(const [utterance,expected] of cases)test('compound frames '+utterance,()=>{const p=parse(utterance);assert.equal(p.ok,true,JSON.stringify(p));assert.deepEqual(p.frames.map(f=>f.action),expected);});
test('combined advance turn actually moves and turns left',()=>{const g=makeGame();const start=g.player.hull,z=g.player.z;const receipt=command(g,'driver advance and turn 20 degrees left');assert.match(receipt,/Advancing/);assert.match(receipt,/left 20 degrees/);for(let i=0;i<50;i++)step(g,.05);assert.ok(g.player.z>z);assert.ok(Math.abs(diff(g.player.hull,norm(start-20)))<.0001);assert.equal(g.player.turn,0);});
test('turn direction sign and finite end are stable',()=>{for(const [direction,sign] of [['left',-1],['right',1]]){const g=makeGame();const a=g.player.hull;command(g,'driver turn '+direction+' 10 degrees');for(let i=0;i<50;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,norm(a+sign*10)))<.00001);assert.equal(g.player.turn,0);}});
test('fails closed on unknown clauses',()=>{const p=parse('driver advance then teleport');assert.equal(p.ok,false);assert.equal(p.errors[0].code,'UNKNOWN_ACTION');const g=makeGame();command(g,'driver advance then teleport');assert.equal(g.player.moving,0);});
test('parser repeated input deterministic',()=>{const input='Driver advance and turn twenty degrees left, then Gamma load AP and Beta fire';const first=JSON.stringify(parse(input));for(let i=0;i<30;i++)assert.equal(JSON.stringify(parse(input)),first);});
