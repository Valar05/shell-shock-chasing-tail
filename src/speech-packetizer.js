// Browser speech stream -> deterministic complete utterance packets.
// Chrome can finalize several short recognition results for ONE commander order.
// Index results by transcript slot, not onresult callback, to avoid duplicates.
import {parseTransmission} from './command-parser.js';

export function createSpeechPacketizer({submit,status=()=>{},setDelay=setTimeout,clearDelay=clearTimeout,
 finalGraceMs=420,silenceMs=3000}={}){
 let timer=null;
 let finalized=new Map();
 let interim="";
 let lastRecognized="",batchNumber=0,consumedThrough=-1,baseIndex=0;
 const clear=()=>{if(timer!==null)clearDelay(timer);timer=null;};
 const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\\s+/g,' ').trim();
 const merge=(a,b)=>{if(!a)return b;if(!b)return a;const x=norm(a),y=norm(b);if(x===y||x.endsWith(' '+y)||x===y)return a;
  if(y.startsWith(x+' '))return b;
  const aa=a.split(/\\s+/),bb=b.split(/\\s+/);let count=0;
  for(let n=Math.min(aa.length,bb.length);n>0;n--){if(norm(aa.slice(-n).join(' '))===norm(bb.slice(0,n).join(' '))){count=n;break;}}
  return [a,...bb.slice(count)].join(' ');};
 const combined=()=>[...finalized.entries()].sort((a,b)=>a[0]-b[0]).map(([,s])=>s).concat(interim?[interim]:[]).reduce(merge,'').trim();
 function incomplete(text){
  if(/\b(?:and|then|while|after|when|once|until|if|to|at|bearing|degrees?)\s*$/i.test(text))return true;
  // An incomplete final may become valid when the recognizer appends its next
  // clause. Don't fire the recognized first half into the simulation.
  return !parseTransmission(text).ok;
 }
 function dispatch(){
  clear();const value=combined().trim();
  if(!value)return;
  // The browser can deliver the same final in consecutive callbacks; a packet
  // must never submit twice. Clear result slots after transmitting.
  if(finalized.size)baseIndex=Math.max(baseIndex,...finalized.keys())+1;
  finalized.clear();interim="";consumedThrough=baseIndex-1;batchNumber++;
  submit(value);
  lastRecognized=value;
  status("Command sent: "+value);
 }
 function schedule(){
  clear();const text=combined();if(!text)return;
  const delay=incomplete(text)?silenceMs:interim?silenceMs:finalGraceMs;
  status("Heard: "+text+(delay===silenceMs?" · thinking window":""));
  timer=setDelay(dispatch,delay);
 }
 return {
  receive(event){
   // Recognition resultIndex is the earliest result changed. Read the entire
   // mutable array so both interim replacement and multiple final chunks work.
   for(let i=event.resultIndex||0;i<event.results.length;i++){
    if(i<baseIndex)continue;
    const result=event.results[i],speech=result[0]?.transcript?.trim()||"";
    if(result.isFinal){if(speech)finalized.set(i,speech);interim="";consumedThrough=Math.max(consumedThrough,i);}
    else interim=speech;
   }
   if(consumedThrough>=baseIndex&&event.results.length>0)baseIndex=Math.max(baseIndex,Math.min(consumedThrough+1,event.results.length));
   // Do not advance past the current pending final slots. The base index only
   // moves after dispatch, otherwise multi-result packets lose their first half.
   if(finalized.size)baseIndex=Math.min(baseIndex,...finalized.keys());
   schedule();
  },
  flush:dispatch,
  abort(){clear();finalized.clear();interim="";},
  pending:()=>combined(),
  last:()=>lastRecognized,
  batches:()=>batchNumber
 };
}
