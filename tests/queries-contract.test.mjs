import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission} from '../src/command-parser.js';
import {makeGame,command} from '../src/model.js';

const queries=[
 ['What is our heading','HEADING'],
 ['Where are we pointing','HEADING'],
 ['What is our speed','MOTION'],
 ['Are we moving','MOTION'],
 ['How much ammunition do we have','AMMO'],
 ['Is the gun loaded','AMMO'],
 ['Is the gun laid','GUN'],
 ['Where is the enemy','CONTACT'],
 ['Do we have contact','CONTACT'],
 ['What can you see','OBSERVATION'],
 ['What are our options','CAPABILITY'],
 ['What is our objective','OBJECTIVE'],
 ['Silver report status','STATUS']
];
for(const [text,kind] of queries)test('non-destructive voice query '+text,()=>{
 const p=parseTransmission(text);
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.equal(p.frames.length,1);
 assert.equal(p.frames[0].kind,'QUERY');
 assert.equal(p.frames[0].action,'REPORT');
 assert.equal(p.frames[0].queryType,kind);
 const g=makeGame();const prior=g.player.hull;
 const response=command(g,text);
 assert.ok(response.length>8);
 assert.equal(g.player.moving,0);
 assert.equal(g.player.turn,0);
 assert.equal(g.player.hull,prior);
});
test('questions can be chained with actions without being mistaken for orders',()=>{
 const p=parseTransmission('Silver report status and Driver advance');
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.deepEqual(p.frames.map(x=>x.action),['REPORT','ADVANCE']);
 const g=makeGame();command(g,'Silver report status and Driver advance');
 assert.ok(g.player.moving>0);
});
test('a feasibility question does not issue an implied movement command',()=>{
 const g=makeGame();
 const p=parseTransmission('Can we advance');
 assert.equal(p.ok,true,JSON.stringify(p));
 assert.equal(p.frames[0].kind,'QUERY');
 command(g,'Can we advance');
 assert.equal(g.player.moving,0);
});
