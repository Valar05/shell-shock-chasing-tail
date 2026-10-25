// Real generated speech WAV -> browser getUserMedia track -> conditioning ->
// Whisper listener VAD -> complete transcript -> game's command parser.
// Virtual microphone avoids real speaker acoustics; physical echo remains unverified.
import {chromium} from 'playwright';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const wav='/tmp/shellshock-integrated-voice.wav';
execFileSync('espeak-ng',['-v','en-us','-s','150','-w',wav,'thirty degrees to the left and run over that tree']);
const base64=readFileSync(wav).toString('base64');
const remoteUrl=process.env.SHELL_SHOCK_WHISPER_SITE||'';
const pageUrl=remoteUrl||'http://127.0.0.1:4186/';
const server=remoteUrl?null:spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4186'],{stdio:'ignore'});
let browser;
try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(pageUrl)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 if(!ready)throw Error('Vite server failed');
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:700}});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(b64=>{
  const original=MediaDevices.prototype.getUserMedia;
  MediaDevices.prototype.getUserMedia=async function(){
   const context=new AudioContext();
   const dest=context.createMediaStreamDestination();
   window.__playWhisperFixture=async()=>{
    await context.resume();
    const bytes=Uint8Array.from(atob(b64),x=>x.charCodeAt(0));
    const audio=await context.decodeAudioData(bytes.buffer);
    const node=context.createBufferSource();node.buffer=audio;node.connect(dest);node.start();
    return audio.duration;
   };
   return dest.stream;
  };
 },base64);
 await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
 await page.locator('#mic').click();
 await page.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.includes('Whisper browser speech listening'),null,{timeout:120000});
 const duration=await page.evaluate(()=>window.__playWhisperFixture());
 await page.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.includes('Command sent:'),null,{timeout:30000});
 const heard=await page.locator('#voice-state').textContent();
 const transcript=heard.replace(/^.*Command sent:/,'').trim().toLowerCase();
 const game=await page.locator('#message').textContent();
 const result={duration,transcript,game,pageErrors:errors};
 console.log(JSON.stringify(result));
 if(!/\b(?:30|thirty)\b/.test(transcript)||!/\bleft\b/.test(transcript)||!/\btree\b/.test(transcript)||!/run over/.test(transcript)||errors.length)process.exitCode=1;
}finally{await browser?.close();server?.kill()}
