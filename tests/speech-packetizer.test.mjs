import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechPacketizer} from '../src/speech-packetizer.js';

function clock(){
 let now=0,next=0;
 const tasks=new Map();
 return {
  setDelay(fn,delay){const id=++next;tasks.set(id,{time:now+delay,fn});return id;},
  clearDelay(id){tasks.delete(id);},
  advance(ms){now+=ms;for(let again=true;again;){again=false;for(const [id,task] of tasks){if(task.time<=now){tasks.delete(id);task.fn();again=true;break;}}}}
 };
}
function harness(){
 const c=clock(),submitted=[],messages=[];
 const p=createSpeechPacketizer({submit:text=>submitted.push(text),status:m=>messages.push(m),
  setDelay:c.setDelay,clearDelay:c.clearDelay});
 const result=(transcript,isFinal)=>({0:{transcript},isFinal});
 return {c,p,submitted,messages,result};
}
test('multiple final pieces are one atomic compound utterance',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver advance',true)]});
 h.c.advance(220);
 h.p.receive({resultIndex:1,results:[h.result('Driver advance',true),h.result('and turn twenty degrees left',true)]});
 h.c.advance(219);assert.deepEqual(h.submitted,[]);
 h.c.advance(202);assert.deepEqual(h.submitted,['Driver advance and turn twenty degrees left']);
 h.c.advance(3000);assert.equal(h.submitted.length,1);
});
test('incomplete trailing connector gives caller three seconds to finish',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver advance and',true)]});
 h.c.advance(2500);assert.deepEqual(h.submitted,[]);
 h.p.receive({resultIndex:1,results:[h.result('Driver advance and',true),h.result('turn ten degrees left',true)]});
 h.c.advance(421);assert.deepEqual(h.submitted,['Driver advance and turn ten degrees left']);
});
test('a final replaces interim without double execution',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver advan',false)]});
 h.c.advance(500);
 h.p.receive({resultIndex:0,results:[h.result('Driver advanced',true)]});
 h.c.advance(421);assert.deepEqual(h.submitted,['Driver advanced']);
 h.c.advance(5000);assert.equal(h.submitted.length,1);
});
test('separate complete commands still submit separately',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver advance',true)]});
 h.c.advance(421);
 h.p.receive({resultIndex:1,results:[h.result('Driver advance',true),h.result('Delta turn ten degrees left',true)]});
 h.c.advance(421);assert.deepEqual(h.submitted,['Driver advance','Delta turn ten degrees left']);
});
test('abort prevents stale utterance execution',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver advance',true)]});
 h.p.abort();h.c.advance(5000);assert.deepEqual(h.submitted,[]);
});
test('microphone toggle flushes pending transmission once',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver reverse five meters',true)]});
 h.p.flush();h.p.flush();h.c.advance(5000);
 assert.deepEqual(h.submitted,['Driver reverse five meters']);
});
test('three seconds remain the fallback for unresolved interim',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver advanced and turn twenty degrees left',false)]});
 h.c.advance(2999);assert.deepEqual(h.submitted,[]);
 h.c.advance(2);assert.deepEqual(h.submitted,['Driver advanced and turn twenty degrees left']);
});

test('overlapping recognition hypotheses are coalesced instead of multiplied',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('driver run over',true)]});
 h.p.receive({resultIndex:1,results:[h.result('driver run over',true),h.result('driver run over that tree',true)]});
 assert.equal(h.p.pending(),'driver run over that tree');
 h.c.advance(3001);
 assert.deepEqual(h.submitted,['driver run over that tree']);
});
test('new results never replay slots previously dispatched',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('Driver halt',true)]});
 h.c.advance(421);
 h.p.receive({resultIndex:1,results:[h.result('Driver halt',true),h.result('Gamma load AP',true)]});
 h.c.advance(421);
 assert.deepEqual(h.submitted,['Driver halt','Gamma load AP']);
});
test('interim replacement with cumulative transcript does not duplicate prefix',()=>{
 const h=harness();
 h.p.receive({resultIndex:0,results:[h.result('driver advance',true),h.result('driver advance and turn right',false)]});
 assert.equal(h.p.pending(),'driver advance and turn right');
 h.p.abort();
});
