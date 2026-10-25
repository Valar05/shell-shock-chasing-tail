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

test('commander interruption re-evaluates full crew report after reply',()=>{
 const utterances=[],cancelled=[];
 class U{constructor(text){this.text=text;}}
 const synth={speaking:false,pending:false,getVoices:()=>[{lang:'en-US'}],addEventListener(){},
  speak(u){utterances.push(u);this.speaking=true;},cancel(){cancelled.push(true);this.speaking=false;}};
 const voice=createCrewVoice({synthesis:synth,Utterance:U});voice.enable(true);
 voice.say({id:'silver.long',speaker:'silver',priority:1,text:'Enemy tank moving behind the farmhouse at two o clock.'});
 const first=utterances[0];first.onboundary({charIndex:18});
 assert.equal(voice.interrupt(),true);
 assert.equal(voice.interrupted,true);
 assert.ok(cancelled.length);
 voice.say({id:'delta.new',speaker:'delta',priority:1,text:'Turning left, sir.'});
 assert.equal(utterances.length,1,'crew waits while commander speaks');
 voice.resume();
 assert.equal(utterances[1].text,'Turning left, sir.');
 utterances[1].onend();
 assert.equal(utterances.length,2,'obsolete equal-priority report should yield');
 assert.equal(voice.interrupted,false);
});
test('cancelled synthesis callbacks cannot complete replacement audio',()=>{
 const utterances=[];
 class U{constructor(text){this.text=text;}}
 const synth={speaking:false,pending:false,getVoices:()=>[],addEventListener(){},speak(u){utterances.push(u)},cancel(){}};
 const voice=createCrewVoice({synthesis:synth,Utterance:U});voice.enable(true);
 voice.say({id:'old',speaker:'silver',text:'Old warning',priority:1});
 const old=utterances[0];voice.interrupt();voice.say({id:'new',speaker:'delta',text:'New command',priority:1});voice.resume();
 const count=utterances.length;old.onend();
 assert.equal(utterances.length,count);
});

test('stale interrupted threat is dropped after target destroyed',()=>{
 let alive=true;const utterances=[];
 class U{constructor(text){this.text=text;}}
 const synth={speaking:false,pending:false,getVoices:()=>[],addEventListener(){},speak(u){utterances.push(u)},cancel(){}};
 const voice=createCrewVoice({synthesis:synth,Utterance:U,isRelevant:l=>alive||l.id==='beta.destroyed'});
 voice.enable(true);
 voice.say({id:'beta.contact',speaker:'beta',priority:4,text:'Panzer in my sights, bearing forty.'});
 voice.interrupt();
 voice.say({id:'beta.destroyed',speaker:'beta',priority:5,text:'Panzer knocked out! Target destroyed!'});
 alive=false;voice.resume();
 assert.equal(utterances.length,2);
 assert.match(utterances[1].text,/destroyed/);
 utterances[1].onend();
 assert.equal(utterances.length,2,'obsolete contact must not resume');
});

test('interrupted report is replaced by fresh tactical state',()=>{
 let current='contact';const heard=[];
 class U{constructor(text){this.text=text;}}
 const synthesis={speaking:false,pending:false,getVoices:()=>[],addEventListener(){},cancel(){},speak:u=>heard.push(u)};
 const voice=createCrewVoice({synthesis,Utterance:U,resolveInterrupted:old=>current==='destroyed'?null:{...old,text:'Lost sight of armor behind the farmhouse.'}});
 voice.enable(true);voice.say({id:'delta.contact',speaker:'delta',text:'Enemy ahead!',priority:4});voice.interrupt();
 voice.resume();assert.equal(heard[1].text,'Lost sight of armor behind the farmhouse.');
 voice.interrupt();current='destroyed';voice.resume();assert.equal(heard.length,2);
});
