import test from 'node:test';import assert from 'node:assert/strict';
import {ProgressiveInterpreter,interpretClause} from '../src/progressive-interpreter.js';
test('commits turn before trailing tree order is spoken and never twice',()=>{
 const p=new ProgressiveInterpreter();
 assert.equal(p.accept({utteranceId:'a',transcript:'turn thirty'}).actions.length,0);
 assert.deepEqual(p.accept({utteranceId:'a',transcript:'turn thirty degrees left'}).actions.map(a=>[a.kind,a.angle,a.direction]),[['TURN',30,'left']]);
 assert.equal(p.accept({utteranceId:'a',transcript:'turn 30 degrees left and run over'}).actions.length,0);
 assert.deepEqual(p.accept({utteranceId:'a',transcript:'turn 30 degrees left and run over that tree',isFinal:true}).actions.map(a=>a.kind),['CRUSH_TREE']);
});
test('never invents missing numeric slot',()=>assert.equal(interpretClause('turn right for the degrees',{final:true}).status,'clarify'));
test('refuses fire from any partial',()=>{const p=new ProgressiveInterpreter();assert.equal(p.accept({utteranceId:'b',transcript:'Beta fire'}).actions.length,0);assert.equal(p.accept({utteranceId:'b',transcript:'Beta do not fire',isFinal:true}).actions[0].kind,'HOLD_FIRE');});
test('Driver Holt is only recoverable at final',()=>{const p=new ProgressiveInterpreter();assert.equal(p.accept({utteranceId:'c',transcript:'Driver Holt'}).actions.length,0);assert.equal(p.accept({utteranceId:'c',transcript:'Driver Holt',isFinal:true}).actions[0].kind,'HALT');});
test('no unlimited movement on invalid angles',()=>assert.equal(interpretClause('turn right 999 degrees',{final:true}).status,'reject'));
