import {classifyCrewMessage} from './crew-dialogue.js';

// Replace speakLine() with Pocket TTS audio lookup later. Nothing outside
// this adapter depends on browser SpeechSynthesisUtterance.
export function createCrewVoice({synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,onState=()=>{}}={}){
 let enabled=false,voiceMap={},lastKey='',lastTime=0,activePriority=0;
 const available=()=>Boolean(synthesis&&Utterance);
 function voices(){return synthesis?.getVoices?.()||[];}
 function assign(){
  const list=voices().filter(v=>v.lang?.toLowerCase().startsWith('en'));
  const chosen=list.length?list:voices();
  const offsets={delta:0,beta:1,gamma:2,silver:3};
  for(const [actor,i] of Object.entries(offsets))voiceMap[actor]=chosen[i%Math.max(1,chosen.length)]||null;
 }
 function say(line){
  if(!enabled||!available()||!line?.text)return false;
  const key=line.id+':'+line.text,now=Date.now();
  if(key===lastKey&&now-lastTime<1500)return false;
  if(synthesis.speaking&&line.priority<activePriority)return false;
  if(synthesis.speaking||synthesis.pending)synthesis.cancel();
  lastKey=key;lastTime=now;activePriority=line.priority;
  const utterance=new Utterance(line.text);
  utterance.lang='en-US';utterance.rate={delta:1.08,beta:1.0,gamma:.94,silver:1.03}[line.speaker]||1;
  utterance.pitch={delta:1.10,beta:.98,gamma:.9,silver:1.14}[line.speaker]||1;
  if(voiceMap[line.speaker])utterance.voice=voiceMap[line.speaker];
  utterance.onend=()=>{activePriority=0;onState('ready');};
  utterance.onerror=()=>{activePriority=0;onState('unavailable');};
  synthesis.speak(utterance);
  onState('speaking');
  return true;
 }
 function feedback(message){return say(classifyCrewMessage(message));}
 function enable(value){enabled=Boolean(value)&&available();if(enabled)assign();else{activePriority=0;synthesis?.cancel?.();}onState(enabled?'ready':'off');return enabled;}
 assign();
 if(synthesis&&'onvoiceschanged' in synthesis)synthesis.addEventListener?.('voiceschanged',assign);
 return {enable,feedback,say,get enabled(){return enabled},get available(){return available()},stop(){synthesis?.cancel?.();activePriority=0}};
}
