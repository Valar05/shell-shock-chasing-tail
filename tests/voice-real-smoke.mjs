// Acoustic-model integration. Real speech waveform -> browser Web Audio ->
// filtered track -> actual Moonshine WASM model -> deterministic game action.
// The synthesized sample is NOT a substitute for real mobile double-talk tests.
import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
const wav='/tmp/shell-shock-real-order.wav';
execFileSync('espeak',['-v','en-us','-s','125','-w',wav,'driver advance']);
const sample=readFileSync(wav).toString('base64');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4183')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
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
 await page.goto('http://127.0.0.1:4183/',{waitUntil:'domcontentloaded'});
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
 if(!/Advancing/i.test(game))throw Error('Actual WAV recognition did not execute advance: '+JSON.stringify({text,game}));
 if(errors.length)throw Error('Page errors: '+errors.join('\\n'));
 console.log(JSON.stringify({result:'REAL_WASM_TRANSCRIPTION_PASS',text,game,latencyMs:Date.now()-started,
  captureRequests:await page.evaluate(()=>window.__voiceCaptureRequests)}));
}finally{await browser?.close();server.kill();}
