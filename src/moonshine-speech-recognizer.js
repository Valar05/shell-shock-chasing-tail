// Browser-only Moonshine WASM speech engine. Consumes precisely the filtered
// MediaStreamTrack provided by our Web Audio capture pipeline.
// Low-level Transcriber/Stream API ensures no second unfiltered mic opens.
import {Transcriber,ModelArch} from '@moonshine-ai/moonshine-wasm';
import wasmAssetUrl from '@moonshine-ai/moonshine-wasm/moonshine.wasm?url';

export function createMoonshineRecognizer({input,onPartial=()=>{},onFinal=()=>{},onStatus=()=>{},createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),load=options=>Transcriber.load(options)}){
 let transcriber=null,stream=null,context=null,source=null,processor=null,silent=null;
 let running=false,starting=false,epoch=0;
 const emitted=new Set();
 async function start(){
  if(running||starting)return;
  starting=true;const token=++epoch;
  try{
   onStatus('Loading browser speech model…');
   transcriber=await load({language:'en',modelArch:ModelArch.SmallStreaming,onProgress:(loaded,total,file)=>onStatus('Downloading speech model: '+file+' '+Math.round(loaded/1024/1024)+' MB'+(total?' / '+Math.round(total/1024/1024)+' MB':'')),moduleOptions:{locateFile:path=>path.endsWith('.wasm')?wasmAssetUrl:path}});
   if(token!==epoch)return;
   const capture=await input.prepare();
   if(token!==epoch)return;
   context=createContext();
   source=context.createMediaStreamSource(new MediaStream([capture.track]));
   stream=transcriber.createStream({updateInterval:.45});
   stream.addListener({
    onLineTextChanged:({line})=>{if(token===epoch&&!line.isComplete)onPartial(line.text||'');},
    onLineStarted:({line})=>{if(token===epoch&&!line.isComplete)onPartial(line.text||'');},
    onLineCompleted:({line})=>{
     if(token!==epoch||!line.text?.trim()||emitted.has(line.id))return;
     emitted.add(line.id);onFinal(line.text.trim());
    },
    onError:({error})=>onStatus('Recognition error: '+error.message)
   });
   stream.start();
   processor=context.createScriptProcessor(4096,1,1);
   processor.onaudioprocess=event=>{
    if(!running||token!==epoch)return;
    const data=new Float32Array(event.inputBuffer.getChannelData(0));
    try{stream.addAudio(data,context.sampleRate);stream.transcribe();}
    catch(error){onStatus('Speech processing error: '+error.message);}
   };
   silent=context.createGain();silent.gain.value=0;
   source.connect(processor);processor.connect(silent);silent.connect(context.destination);
   await context.resume();
   if(token!==epoch)return;
   running=true;onStatus('Moonshine browser speech listening · conditioned audio');
  }finally{starting=false;}
 }
 async function stop(){
  epoch++;running=false;
  processor?.disconnect();source?.disconnect();silent?.disconnect();
  processor=null;source=null;silent=null;
  try{stream?.stop();}catch{}
  try{stream?.close();}catch{}
  stream=null;
  try{transcriber?.close();}catch{}
  transcriber=null;
  try{await context?.close();}catch{}
  context=null;emitted.clear();
  await input.close();onStatus('Microphone OFF');
 }
 return {start,stop,get running(){return running}};
}
