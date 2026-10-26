import test from 'node:test';import assert from 'node:assert/strict';import {ProgressiveInterpreter,interpretClause} from '../src/progressive-interpreter.js';
test('stable partial turn executes before trailing objective, and no duplicate on final',()=>{
 const p=new ProgressiveInterpreter();
 assert.equal(p.accept({utteranceId:'a',transcript:'turn thirty degrees left'}).actions.length,0);
 assert.deepEqual(p.accept({utteranceId:'a',transcript:'turn thirty degrees left'}).actions.map(x=>[x.kind,x.angle,x.direction]),[['TURN',30,'left']]);
 assert.equal(p.accept({utteranceId:'a',transcript:'turn thirty degrees left and run over that tree'}).actions.length,0);
 assert.deepEqual(p.accept({utteranceId:'a',transcript:'turn 30 degrees left and run over that tree',isFinal:true}).actions.map(x=>x.kind),['CRUSH_TREE']);
});
test('do not fire never becomes an interim fire command',()=>{
 const p=new ProgressiveInterpreter();assert.equal(p.accept({utteranceId:'b',transcript:'beta fire'}).actions.length,0);
 assert.equal(p.accept({utteranceId:'b',transcript:'beta do not fire',isFinal:true}).actions[0].kind,'HOLD_FIRE');
});
test('no fabricated angles, double direction, or infinite movement',()=>{
 assert.equal(interpretClause('turn right for the debris',{final:true}).status,'clarify');
 assert.equal(interpretClause('turn right 999 degrees',{final:true}).status,'reject');
 assert.equal(interpretClause('turn left and right 30 degrees',{final:true}).status,'reject');
});
test('stability resets on changed provisional angle',()=>{
 const p=new ProgressiveInterpreter();
 p.accept({utteranceId:'c',transcript:'turn 13 degrees right'});
 assert.equal(p.accept({utteranceId:'c',transcript:'turn 30 degrees right'}).actions.length,0);
 assert.equal(p.accept({utteranceId:'c',transcript:'turn 30 degrees right'}).actions[0].angle,30);
 const corrected=p.accept({utteranceId:'c',transcript:'turn 40 degrees right',isFinal:true});
 assert.equal(corrected.actions.length,0);assert.equal(corrected.clauses[0].status,'conflict');
});
test('Driver Holt recovery requires final result',()=>{
 const p=new ProgressiveInterpreter();
 assert.equal(p.accept({utteranceId:'d',transcript:'driver holt'}).actions.length,0);
 assert.equal(p.accept({utteranceId:'d',transcript:'driver holt',isFinal:true}).actions[0].kind,'HALT');
});
test('interim repeated incomplete order never executes',()=>{
 const p=new ProgressiveInterpreter();
 for(let i=0;i<10;i++)assert.equal(p.accept({utteranceId:'e',transcript:'turn right for the degrees'}).actions.length,0);
});
