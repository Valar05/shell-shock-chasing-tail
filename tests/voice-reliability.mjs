// Repeat the actual WAV through the complete browser microphone -> conditioner ->
// Whisper -> game pipeline. Count ALL trials and their errors, never success-only.
// Usage: node tests/voice-reliability.mjs (install espeak-ng first).
import {chromium} from 'playwright';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const trials=Number(process.env.VOICE_TRIALS||12);
const url=process.env.VOICE_BENCH_URL||'http://127.0.0.1:4190/';
const remote=Boolean(process.env.VOICE_BENCH_URL);
const cases=[
 {id:'compound',spoken:'thirty degrees to the left and run over that tree',must:[/\\b(?:30|thirty)\\b/,/\\bleft\\b/,/\\btree\\b/,/run over/],responses:[/turning left 30 degrees/i,/tree identified/i]},
 {id:'halt',spoken:'driver halt',must:[/\\bhalt\\b/],responses:[/halted/i]},
 {id:'turn',spoken:'turn right forty degrees',must:[/\\bright\\b/,/\\b(?:40|forty)\\b/],responses:[/turning right 40 degrees/i]}
];
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const server=remote?null:spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4190','--strictPort'],{stdio:'ignore'});
const rows=[];
try{
 for(let i=0;i<40;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,500))}
 for(const testCase of cases){
  const wav='/tmp/shellshock-bench-'+testCase.id+'.wav';
  execFileSync('espeak-ng',['-v','en-us','-s','150','-w',wav,testCase.spoken]);
  const base64=readFileSync(wav).toString('base64');
  for(let trial=0;trial<trials;trial++){
   const page=await browser.newPage({viewport:{width:1000,height:700}});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const started=Date.now();
   const row={case:testCase.id,trial:trial+1,engine:'whisper-base.en',source:'eSpeak synthesized WAV via virtual microphone',transcript:'',game:'',error:'',latencyMs:null};
   try{
    await page.addInitScript(b64=>{
     MediaDevices.prototype.getUserMedia=async function(){
      const context=new AudioContext(),dest=context.createMediaStreamDestination();
      window.__playBenchmark=async()=>{
       await context.resume();
       const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
       const audio=await context.decodeAudioData(bytes.buffer);
       const node=context.createBufferSource();node.buffer=audio;node.connect(dest);node.start();
      };
      return dest.stream;
     };
    },base64);
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.locator('#mic').click();
    await page.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.includes('Whisper browser speech listening'),null,{timeout:120000});
    const inferenceStart=Date.now();
    await page.evaluate(()=>window.__playBenchmark());
    await page.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.startsWith('Command sent:'),null,{timeout:30000});
    row.latencyMs=Date.now()-inferenceStart;
    row.transcript=(await page.locator('#voice-state').textContent()).replace(/^.*Command sent:/,'').trim().toLowerCase();
    row.game=await page.locator('#message').textContent();
    row.wordsCorrect=testCase.must.every(rx=>rx.test(row.transcript));
    row.intentCorrect=testCase.responses.every(rx=>rx.test(row.game));
    if(errors.length)row.error=errors.join('; ');
   }catch(e){row.error=String(e.message||e)}
   finally{await page.close()}
   rows.push(row);console.log(JSON.stringify(row));
  }
 }
 const summary=cases.map(c=>{const a=rows.filter(r=>r.case===c.id);return {case:c.id,total:a.length,wordSlotPass:a.filter(r=>r.wordsCorrect).length,intentPass:a.filter(r=>r.intentCorrect).length,errors:a.filter(r=>r.error).length,latencyMs:a.map(r=>r.latencyMs).filter(Number.isFinite).sort((x,y)=>x-y)}});
 console.log('VOICE_BENCH_SUMMARY='+JSON.stringify(summary));
 if(summary.some(s=>s.intentPass!==s.total||s.errors))process.exitCode=1;
}finally{server?.kill();await browser.close()}
