import { pipeline } from '@huggingface/transformers';
const out=document.querySelector('#output');
let recognizer=null;
const say=x=>{out.textContent=String(x)};
async function load(){
 if(recognizer)return recognizer;
 say('Loading Whisper');
 recognizer=await pipeline('automatic-speech-recognition','Xenova/whisper-base.en',{device:'wasm',dtype:'q8'});
 document.querySelector('#transcribe').disabled=false;
 say('Whisper ready');
 return recognizer;
}
async function decode(file){
 const ctx=new AudioContext({sampleRate:16000});
 try{
  const b=await ctx.decodeAudioData(await file.arrayBuffer());
  const data=new Float32Array(b.length);
  for(let c=0;c<b.numberOfChannels;c++){const channel=b.getChannelData(c);for(let i=0;i<data.length;i++)data[i]+=channel[i]/b.numberOfChannels}
  return data;
 }finally{await ctx.close()}
}
async function transcribeAudio(pcm){
 if(!(pcm instanceof Float32Array)||!pcm.length)throw Error('Nonempty real PCM required');
 const model=await load();
 const started=performance.now();
 const response=await model(pcm,{language:'english',task:'transcribe'});
 const result={transcript:response.text,elapsedMs:Math.round(performance.now()-started),samples:pcm.length};
 say(JSON.stringify(result,null,2));return result;
}
window.__whisperLab={load,decode,transcribeAudio};
document.querySelector('#load').onclick=()=>load().catch(e=>say(e.stack));
document.querySelector('#transcribe').onclick=async()=>{try{const f=document.querySelector('#audio').files[0];if(!f)throw Error('Select WAV');await transcribeAudio(await decode(f))}catch(e){say(e.stack)}};
