import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4198','--strictPort'],{stdio:'ignore'});
let browser;
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4198/voice-corpus-lab.html')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}
 if(!ready)throw Error('Corpus server unavailable');
 browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const context=await browser.newContext({permissions:['microphone'],acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4198/voice-corpus-lab.html');
 await page.getByText('0 recordings saved locally').waitFor();
 await page.locator('#record').click();
 await page.waitForTimeout(1200);
 await page.locator('#stop').click();
 await page.getByText('1 recordings saved locally').waitFor({timeout:15000});
 const persisted=await page.evaluate(async()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('shellshock-corpus-v1',1);
  req.onsuccess=()=>{const tx=req.result.transaction('samples');const q=tx.objectStore('samples').getAll();q.onsuccess=()=>resolve(q.result.map(x=>({bytes:x.audio.size,spoken:x.spoken,raw:x.hypotheses.length,prompt:x.prompt})));q.onerror=()=>reject(q.error)};
  req.onerror=()=>reject(req.error)
 }));
 if(persisted.length!==1||persisted[0].bytes===0)throw Error('Audio was not actually persisted: '+JSON.stringify(persisted));
 await page.reload();
 await page.getByText('1 recordings saved locally').waitFor();
 await page.locator('#download-json').click();
 const dl=await page.waitForEvent('download',{timeout:10000}).catch(()=>null);
 if(!dl)throw Error('JSON download not triggered');
 const text=await (await import('node:fs/promises')).readFile(await dl.path(),'utf8');
 const obj=JSON.parse(text);
 if(obj.records.length!==1||obj.records[0].audio_bytes<=0)throw Error('Invalid JSON export');
 if(errors.length)throw Error('Page errors: '+errors.join('; '));
 console.log('CORPUS_SMOKE_PASS='+JSON.stringify({persisted,records:obj.records.length,download:dl.suggestedFilename()}));
}finally{await browser?.close();server.kill()}
