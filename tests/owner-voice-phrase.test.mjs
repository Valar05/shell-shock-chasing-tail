import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission} from '../src/command-parser.js';

// Research characterization of the owner's problematic spoken command.
// This is a text-to-parser test, NOT an ASR or acoustic success claim.
test('owner audio benchmark: exact words expose missing relative turn direction',()=>{
 const p=parseTransmission('rotate 30 degrees and run over that tree');
 assert.equal(p.ok,false);
 assert.ok(p.errors.some(e=>e.code==='MISSING_DIRECTION'),JSON.stringify(p));
 assert.ok(p.frames.some(f=>f.action==='CRUSH_TREE'),JSON.stringify(p));
});
test('an explicitly directional compound phrase retains both orders',()=>{
 const p=parseTransmission('turn right 30 degrees and run over that tree');
 assert.equal(p.ok,true,JSON.stringify(p.errors));
 assert.deepEqual(p.frames.map(f=>f.action),['TURN','CRUSH_TREE']);
 assert.equal(p.frames[0].direction,'right');
 assert.equal(p.frames[0].degrees,30);
});
