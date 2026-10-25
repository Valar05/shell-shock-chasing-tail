import test from 'node:test';
import assert from 'node:assert/strict';
import {CREW_LINES,makeCrewLine,classifyCrewMessage} from '../src/crew-dialogue.js';
import {createCrewVoice} from '../src/crew-voice.js';
test('dialogue catalogue has stable IDs and valid speakers',()=>{
 const keys=Object.keys(CREW_LINES);assert.ok(keys.length>=25);
 for(const [id,v] of Object.entries(CREW_LINES)){
  assert.match(id,/^(delta|beta|gamma|silver)\./);
  assert.ok(['delta','beta','gamma','silver'].includes(v.speaker));
  assert.ok(v.text&&Number.isInteger(v.priority));
 }
});
test('parameterized lines resolve meaningful acknowledgments',()=>{
 const turn=makeCrewLine('delta.turn',{direction:'left',degrees:20});
 assert.equal(turn.text,'Turning left 20 degrees.');
 assert.equal(turn.speaker,'delta');
 const hit=classifyCrewMessage('Silver: INCOMING! We took a hit!');
 assert.equal(hit.id,'silver.incoming');assert.equal(hit.priority,5);
 assert.equal(classifyCrewMessage('Gamma: AP loaded.').id,'gamma.loaded');
});
test('browser synth adapter can be replaced with recorded clips',()=>{
 let spoken=[],cancels=0;
 class FakeUtterance{constructor(text){this.text=text;}}
 const synth={speaking:false,pending:false,getVoices:()=>[{lang:'en-US',name:'A'},{lang:'en-US',name:'B'}],speak:u=>spoken.push(u),cancel:()=>{cancels++;},addEventListener(){}};
 const engine=createCrewVoice({synthesis:synth,Utterance:FakeUtterance});
 assert.equal(engine.feedback('Delta: Advancing.'),false);
 assert.equal(engine.enable(true),true);
 assert.equal(engine.feedback('Delta: Advancing.'),true);
 assert.equal(spoken[0].text,'Advancing, sir.');
 assert.equal(engine.feedback('Delta: Advancing.'),false);
 assert.equal(engine.feedback('Silver: INCOMING! We took a hit!'),true);
 assert.equal(spoken[1].text,'Incoming! We took a hit!');
 engine.enable(false);assert.ok(cancels>0);
});
