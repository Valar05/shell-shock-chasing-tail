// Acoustic-model integration. Real speech waveform -> browser Web Audio ->
// filtered track -> actual Moonshine WASM model -> deterministic game action.
// The synthesized sample is NOT a substitute for real mobile double-talk tests.
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
// Google mini Speech Commands includes real recorded human voices, unlike
// robotic eSpeak playback (which the model consistently misheard).
const zip='/tmp/shell-shock-mini-speech.zip';
execFileSync('curl',['-fsSL','--retry','2','-o',zip,'https://storage.googleapis.com/download.tensorflow.org/data/mini_speech_commands.zip']);
const entries=execFileSync('unzip',['-Z1',zip]).toString().split('\n');
const clipPath=entries.find(x=>/(?:^|\/)stop\/[^/]+\.wav$/.test(x));
if(!clipPath)throw Error('Human speech STOP sample missing in mini dataset');
const phrase=process.env.VOICE_PHRASE||'driver run over that tree';
const voice=process.env.VOICE_SYNTH||'en-us+f3';
const fixture='/tmp/shell-shock-phrase.wav';
if(process.env.VOICE_PHRASE){
 execFileSync('espeak',['-v',voice,'-s','132','-w',fixture,phrase]);
}
const sample=process.env.VOICE_PHRASE?readFileSync(fixture).toString('base64'):execFileSync('unzip',['-p',zip,clipPath],{maxBuffer:200000}).toString('base64');
const remoteUrl=process.env.SHELL_SHOCK_TEST_URL||'';
const localUrl='http://127.0.0.1:4183/shell-shock-chasing-tail/';
const server=remoteUrl?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--base','/shell-shock-chasing-tail/','--host','127.0.0.1','--port','4183','--strictPort'],{stdio:'ignore'});
let browser;
try{
 if(!remoteUrl)for(let i=0;i<60;i++){try{if((await fetch(localUrl)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 const errors=[],network=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});page.on('requestfailed',request=>network.push({url:request.url(),error:request.failure()?.errorText}));page.on('response',response=>{if(response.status()>=400)network.push({url:response.url(),status:response.status()});});
 await page.addInitScript(base64=>{
  window.__speechFixture=base64;
  window.__voiceCaptureRequests=[];
  const original=MediaDevices.prototype.getUserMedia;
  MediaDevices.prototype.getUserMedia=async function(constraints){
   window.__voiceCaptureRequests.push(constraints);
   const ctx=new AudioContext();
   const dest=ctx.createMediaStreamDestination();
   window.__playSpeech=async()=>{
    await ctx.resume();
    const bytes=Uint8Array.from(atob(window.__speechFixture),c=>c.charCodeAt(0));
    const audio=await ctx.decodeAudioData(bytes.buffer);
    const src=ctx.createBufferSource();src.buffer=audio;
    src.connect(dest);src.start();
   };
   return dest.stream;
  };
 },sample);
 await page.goto(remoteUrl||localUrl,{waitUntil:'domcontentloaded'});
 if(remoteUrl){
  try{await page.waitForFunction(()=>window.crossOriginIsolated===true,null,{timeout:30000});}
  catch(err){
   const info=await page.evaluate(async()=>({url:location.href,isolation:crossOriginIsolated,secure:isSecureContext,
    controller:!!navigator.serviceWorker?.controller,registration:!!(await navigator.serviceWorker?.getRegistration()),
    html:document.body?.textContent?.slice(0,200),scripts:[...document.scripts].map(s=>s.src)}));
   throw Error('Hosted isolation failed '+JSON.stringify({info,network:network.slice(-10),errors:errors.slice(-10)})+' '+err.message);
  }
  await page.locator('#mic').waitFor({timeout:45000});
 }
 await page.locator('#mic').click();
 try{
  await page.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.includes('Moonshine browser speech listening'),null,{timeout:90000});
 }catch(error){
  const diagnostic=await page.evaluate(()=>({status:document.querySelector('#voice-state')?.textContent||null,requests:window.__voiceCaptureRequests||[],location:location.href}));
  throw Error('Actual model did not reach ready state: '+JSON.stringify({...diagnostic,errors:errors.slice(-8),network:network.slice(-8)})+' / '+error.message);
 }
 const started=Date.now();
 await page.evaluate(()=>window.__playSpeech());
 await page.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.startsWith('Command sent:'),null,{timeout:90000});
 const text=await page.locator('#voice-state').textContent();
 const game=await page.locator('#message').textContent();
 if(process.env.VOICE_PHRASE){
 const expected=process.env.EXPECT_RESPONSE||'Tree identified';
 if(!game.includes(expected))throw Error('FULL_COMMAND_FAIL '+JSON.stringify({phrase,voice,text,game,expected}));
}else if(!/Halted/i.test(game))throw Error('Human STOP WAV was not recognized and executed: '+JSON.stringify({text,game,clipPath}));
 if(errors.length)throw Error('Page errors: '+errors.join('\\n'));
 console.log(JSON.stringify({result:process.env.VOICE_PHRASE?'SYNTH_COMPLETE_COMMAND_PASS':'REAL_HUMAN_WAV_TRANSCRIPTION_PASS',text,game,latencyMs:Date.now()-started,
  captureRequests:await page.evaluate(()=>window.__voiceCaptureRequests)}));
}finally{await browser?.close();server?.kill();}
