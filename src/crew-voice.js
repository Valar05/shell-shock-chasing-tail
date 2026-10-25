import {classifyCrewMessage} from './crew-dialogue.js';

// The browser voice backend is intentionally replaceable with recorded Pocket TTS.
export function createCrewVoice({synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,onState=()=>{}}={}){
 let enabled=false,voiceMap={},lastKey='',lastTime=0,activePriority=0,active=false,queue=[];
 let current=null,suspended=null,interrupted=false,generation=0;
 const available=()=>Boolean(synthesis&&Utterance);
 const voices=()=>synthesis?.getVoices?.()||[];
 function assign(){
  const list=voices().filter(v=>v.lang?.toLowerCase().startsWith('en'));
  const chosen=list.length?list:voices();
  const offsets={delta:0,beta:1,gamma:2,silver:3};
  for(const [actor,i] of Object.entries(offsets))voiceMap[actor]=chosen[i%Math.max(1,chosen.length)]||null;
 }
 function advanceQueue(){
  active=false;activePriority=0;current=null;
  if(interrupted){onState('interrupted');return;}
  if(queue.length&&enabled){const next=queue.shift();say(next,true);}
  else onState(enabled?'ready':'off');
 }
 function say(line,fromQueue=false){
  if(!enabled||!available()||!line?.text)return false;
  const key=line.id+':'+line.text,now=Date.now();
  if(!fromQueue&&key===lastKey&&now-lastTime<1500)return false;
  if(interrupted){if(queue.length<8)queue.push(line);return true;}
  if(active){
   if(line.priority<5){if(queue.length<8)queue.push(line);return true;}
   queue=[];generation++;synthesis.cancel();active=false;current=null;
  }
  if(synthesis.speaking||synthesis.pending)synthesis.cancel();
  lastKey=key;lastTime=now;activePriority=line.priority;active=true;
  const utterance=new Utterance(line.text);
  utterance.lang='en-US';utterance.rate={delta:1.08,beta:1.0,gamma:.94,silver:1.03}[line.speaker]||1;
  utterance.pitch={delta:1.10,beta:.98,gamma:.9,silver:1.14}[line.speaker]||1;
  if(voiceMap[line.speaker])utterance.voice=voiceMap[line.speaker];
  const token=++generation;
  current={line,position:0};
  utterance.onboundary=e=>{if(token===generation&&current&&Number.isFinite(e.charIndex))current.position=Math.max(current.position,e.charIndex);};
  utterance.onend=()=>{if(token===generation)advanceQueue();};
  utterance.onerror=()=>{if(token===generation)advanceQueue();};
  synthesis.speak(utterance);onState('speaking');
  return true;
 }
 function interrupt(){
  if(!enabled||interrupted)return false;
  interrupted=true;
  if(current){
   const {line,position}=current;
   // Resume at the most recent word boundary where speech synthesis reports one.
   // If the platform does not provide boundaries, replay the whole short line.
   let offset=Math.max(0,Math.min(position,line.text.length));
   while(offset>0&&offset<line.text.length&&!/\s/.test(line.text[offset-1]))offset--;
   const remaining=line.text.slice(offset).trim();
   if(remaining)suspended={...line,text:remaining};
  }
  generation++;active=false;current=null;activePriority=0;
  synthesis?.cancel?.();onState('interrupted');
  return true;
 }
 function resume(){
  if(!interrupted)return false;
  interrupted=false;
  if(suspended){
   // New command acknowledgments queued during interruption speak first.
   // The subordinate then finishes the interrupted report.
   queue.push(suspended);suspended=null;
  }
  if(!active&&queue.length)say(queue.shift(),true);
  else onState(enabled?'ready':'off');
  return true;
 }
 function feedback(message){return say(classifyCrewMessage(message));}
 function enable(value){
  enabled=Boolean(value)&&available();
  if(enabled)assign();
  else{generation++;active=false;current=null;suspended=null;interrupted=false;queue=[];activePriority=0;synthesis?.cancel?.();}
  onState(enabled?'ready':'off');return enabled;
 }
 assign();
 if(synthesis&&'onvoiceschanged' in synthesis)synthesis.addEventListener?.('voiceschanged',assign);
 return {enable,feedback,say,interrupt,resume,
  get enabled(){return enabled},get available(){return available()},
  get speakingText(){return current?.line.text||''},
  get interrupted(){return interrupted},
  stop(){generation++;synthesis?.cancel?.();activePriority=0;active=false;current=null;queue=[];suspended=null;interrupted=false;}
 };
}
