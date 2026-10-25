import {pipeline} from '@huggingface/transformers';

// Browser-only Whisper listener. One conditioned track, PCM-based silence
// segmentation, one completed utterance per ASR call, no forced phrase lattice.
export function createWhisperRecognizer({input,onPartial=()=>{},onFinal=()=>{},onStatus=()=>{},load=()=>pipeline('automatic-speech-recognition','Xenova/whisper-base.en',{device:'wasm',dtype:'q8'})}){
 let model=null,context=null,source=null,processor=null,output=null;
 let running=false,starting=false,epoch=0,utterance=[],speechSamples=0,quietSamples=0,started=false;
 let pending=Promise.resolve();
 function clear(){utterance=[];speechSamples=0;quietSamples=0;started=false;}
 async function decode(samples,rate){
  const target=16000;
  const count=Math.round(samples.length*target/rate);
  const output=new Float32Array(count);
  for(let i=0;i<count;i++){
   const index=i*rate/target,lo=Math.floor(index),hi=Math.min(samples.length-1,lo+1),t=index-lo;
   output[i]=samples[lo]*(1-t)+samples[hi]*t;
  }
  return output;
 }
 function submit(rate,token){
  const chunks=utterance;clear();
  if(speechSamples<0)return;
  const size=chunks.reduce((n,a)=>n+a.length,0);
  if(size<Math.round(rate*.28))return;
  const pcm=new Float32Array(size);let at=0;
  for(const chunk of chunks){pcm.set(chunk,at);at+=chunk.length;}
  pending=pending.then(async()=>{
   if(token!==epoch)return;
   try{
    const data=await decode(pcm,rate);
    const result=await model(data);
    if(token!==epoch)return;
    const text=String(result.text||'').trim();
    if(text)onFinal(text);
   }catch(e){if(token===epoch)onStatus('Whisper recognition error: '+e.message);}
  });
 }
 async function start(){
  if(running||starting)return;
  starting=true;const token=++epoch;
  try{
   onStatus('Loading Whisper English recognition model');
   model=await load();
   if(token!==epoch)return;
   const capture=await input.prepare();
   if(token!==epoch)return;
   context=new (globalThis.AudioContext||globalThis.webkitAudioContext)();
   source=context.createMediaStreamSource(new MediaStream([capture.track]));
   processor=context.createScriptProcessor(4096,1,1);
   output=context.createGain();output.gain.value=0;
   const rate=context.sampleRate;
   clear();
   processor.onaudioprocess=event=>{
    if(!running||token!==epoch)return;
    const pcm=new Float32Array(event.inputBuffer.getChannelData(0));
    let energy=0;for(const s of pcm)energy+=s*s;
    const rms=Math.sqrt(energy/pcm.length);
    if(rms>.013){started=true;quietSamples=0;speechSamples+=pcm.length}
    else if(started)quietSamples+=pcm.length;
    if(!started)return;
    utterance.push(pcm);
    if(quietSamples>=rate*.72||utterance.length*4096>=rate*15)submit(rate,token);
   };
   source.connect(processor);processor.connect(output);output.connect(context.destination);
   await context.resume();
   if(token!==epoch)return;
   running=true;onStatus('Whisper browser speech listening');
  }catch(e){onStatus('Whisper start failed: '+e.message);throw e}
  finally{starting=false}
 }
 async function stop(){
  epoch++;running=false;
  if(utterance.length)clear();
  processor?.disconnect();source?.disconnect();output?.disconnect();
  processor=null;source=null;output=null;
  await context?.close();context=null;
  await input.close();onStatus('Microphone OFF');
 }
 return {start,stop,get running(){return running}};
}
