import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
let out='';server.stdout.on('data',x=>out+=x);server.stderr.on('data',x=>out+=x);
async function ready(){for(let i=0;i<75;i++){if(server.exitCode!==null)throw Error('Vite exited: '+out);try{const r=await fetch('http://127.0.0.1:4173');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Vite not ready: '+out);}
let browser;
try{
 await ready();browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1200,height:780}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
 await page.locator('#viewport canvas').waitFor();
 await page.waitForTimeout(700);
 await page.locator('#bearings').getByText(/HULL/).count().then(n=>{if(!n)throw Error('Heading instrumentation missing');});
 await page.locator('button[data-order="Delta advance"]').click();
 await page.waitForTimeout(500);
 await page.locator('button[data-order="Delta halt"]').click();
 await page.locator('button[data-order="Gamma load AP"]').click();
 await page.locator('#order').fill('Silver report');
 await page.locator('#form button').click();
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/first-playable-smoke.png',fullPage:true});
 console.log('Browser smoke passed; screenshot saved.');
}finally{await browser?.close();server.kill();}
