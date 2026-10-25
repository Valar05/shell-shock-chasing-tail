import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransmission} from '../src/command-parser.js';
import {makeGame,command} from '../src/model.js';

// Seeded property-based mutation checks. A one-character STT error may recover
// the correct intent or be rejected. It must never become a different action.
const seedActions=[
 ['driver','advance','ADVANCE',''],
 ['driver','reverse','REVERSE',''],
 ['driver','halt','HALT',''],
 ['driver','turn','TURN',' left twenty degrees'],
 ['gunner','traverse','TRAVERSE',' right ten degrees'],
 ['gunner','acquire','ACQUIRE',''],
 ['gunner','fire','FIRE',''],
 ['loader','reload','LOAD',' AP'],
 ['silver','report','REPORT','']
];
function mutations(word){
 const out=new Set([word]);
 for(let i=0;i<word.length;i++){
  out.add(word.slice(0,i)+word.slice(i+1));
  for(const ch of ['a','e','i','o','u','s','t','r','n']){
   if(ch!==word[i])out.add(word.slice(0,i)+ch+word.slice(i+1));
  }
 }
 for(let i=0;i<=word.length;i++)for(const ch of ['a','e','i','o','u'])out.add(word.slice(0,i)+ch+word.slice(i));
 return [...out];
}
test('generated single-edit ASR matrix never dispatches an incorrect action',()=>{
 let trials=0,accepted=0,rejected=0;
 for(const [actor,verb,expected,suffix] of seedActions){
  for(const mutation of mutations(verb)){
   const speech=actor+' '+mutation+suffix;
   const graph=parseTransmission(speech);
   trials++;
   if(graph.ok){
    accepted++;
    assert.deepEqual(graph.frames.map(f=>f.action),[expected],JSON.stringify({speech,graph}));
   }else{
    rejected++;
    const g=makeGame();const prior={moving:g.player.moving,turn:g.player.turn,jobs:g.orderJobs.length};
    command(g,speech);
    assert.equal(g.player.moving,prior.moving,speech);
    assert.equal(g.player.turn,prior.turn,speech);
    assert.equal(g.orderJobs.length,prior.jobs,speech);
   }
  }
 }
 assert.ok(trials>500);assert.ok(accepted>15);assert.ok(rejected>0);
});
test('multi-verb packet fuzz always preserves atomic rejection',()=>{
 const wrong=['teleport','levitate','explade','unknown','flee'];
 for(const bad of wrong){
  for(const prefix of ['Driver advance','Driver turn left twenty degrees','Gamma load AP','Silver report']){
   const g=makeGame();const text=prefix+' and '+bad;
   const r=parseTransmission(text);
   assert.equal(r.ok,false,text);
   command(g,text);
   assert.equal(g.orderJobs.length,0,text);
   assert.equal(g.player.moving,0,text);
  }
 }
});
