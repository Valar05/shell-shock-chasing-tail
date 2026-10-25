// Browser speech stream -> deterministic complete utterance packets.
// Chrome can finalize several short recognition results for ONE commander order.
// Index results by transcript slot, not onresult callback, to avoid duplicates.
import {parseTransmission} from './command-parser.js';

export function createSpeechPacketizer({submit,status=()=>{},setDelay=setTimeout,clearDelay=clearTimeout,
 finalGraceMs=420,silenceMs=3000}={}){
 let timer=null;
 let finalized=new Map();
 let interim="";
 let lastRecognized="",batchNumber=0;
 const clear=()=>{if(timer!==null)clearDelay(timer);timer=null;};
 const combined=()=>[...finalized.entries()].sort((a,b)=>a[0]-b[0]).map(([,s])=>s).concat(interim?[interim]:[]).join(' ').trim();
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
  finalized.clear();interim="";batchNumber++;
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
    const result=event.results[i],speech=result[0]?.transcript?.trim()||"";
    if(result.isFinal){if(speech)finalized.set(i,speech);interim="";}
    else interim=speech;
   }
   schedule();
  },
  flush:dispatch,
  abort(){clear();finalized.clear();interim="";},
  pending:()=>combined(),
  last:()=>lastRecognized,
  batches:()=>batchNumber
 };
}
