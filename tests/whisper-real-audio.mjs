import { chromium } from 'playwright';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
const wav='/tmp/shellshock-whisper-test.wav';
execFileSync('espeak-ng',['-v','en-us','-s','150','-w',wav,'thirty degrees to the left and run over that tree']);
const base64=readFileSync(wav).toString('base64');
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4185'],{stdio:'ignore'});
let browser;
try{
 let available=false;
 for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:4185/voice-whisper-lab.html');if(r.ok){available=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
 if(!available)throw Error('Vite server inaccessible');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();const errs=[];
 page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await page.goto('http://127.0.0.1:4185/voice-whisper-lab.html');
 const result=await page.evaluate(async b64=>{
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const pcm=await window.__whisperLab.decode(new Blob([bytes],{type:'audio/wav'}));
  return window.__whisperLab.transcribeAudio(pcm);
 },base64);
 const t=result.transcript.toLowerCase();
 const ok=/\b(?:30|thirty)\b/.test(t)&&/\bleft\b/.test(t)&&/\btree\b/.test(t)&&/(run over|drive over|crush)/.test(t)&&!/\b(?:50|fifty)\b/.test(t);
 console.log(JSON.stringify({fixture:'espeak-ng 150 en-us',actualAudio:true,result,passed:ok,errors:errs}));
 if(!ok||errs.length)process.exitCode=1;
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.kill()}
