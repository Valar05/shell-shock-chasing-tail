import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const wav='/tmp/shellshock-native-test.wav';
execFileSync('espeak-ng',['-v','en-us','-s','150','-w',wav,'thirty degrees to the left and run over that tree']);
const data=readFileSync(wav).toString('base64');
const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream']});
try{
 const page=await browser.newPage();
 await page.goto('https://example.com');
 const result=await page.evaluate(async b64=>{
  const API=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;
  if(!API)return {available:false,reason:'SpeechRecognition API absent'};
  const context=new AudioContext();
  try{
   const pcm=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
   const decoded=await context.decodeAudioData(pcm.buffer);
   const dst=context.createMediaStreamDestination(),src=context.createBufferSource();src.buffer=decoded;src.connect(dst);
   const rec=new API();rec.lang='en-US';rec.continuous=false;
   const events=[];
   const done=new Promise(resolve=>{
    rec.onresult=e=>events.push({type:'result',text:e.results[0]?.[0]?.transcript||''});
    rec.onerror=e=>events.push({type:'error',code:e.error});
    rec.onend=()=>resolve();
   });
   await context.resume();
   const started=performance.now();
   try {rec.start(dst.stream.getAudioTracks()[0]);src.start();}
   catch(e){return {available:true,trackAccepted:false,error:String(e)}}
   await Promise.race([done,new Promise(resolve=>setTimeout(resolve,12000))]);
   try{rec.abort()}catch{}
   return {available:true,trackAccepted:true,events,elapsedMs:Math.round(performance.now()-started),input:'real WAV via MediaStreamTrack',warning:'trackAccepted does not imply OS recognition service is installed'};
  }finally{await context.close()}
 },data);
 console.log('NATIVE_TRACK_PROBE='+JSON.stringify(result));
}finally{await browser.close()}
