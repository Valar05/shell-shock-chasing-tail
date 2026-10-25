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
 await page.locator('#mic').waitFor();
 if(!(await page.locator('#mic').isVisible()))throw Error('Primary microphone control missing');
 await page.locator('#type-fallback').evaluate(e=>e.open=true);
 const before=await page.locator('#bearings').textContent();
 const bounds=await page.locator('#viewport canvas').boundingBox();
 await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.4);
 await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.5+120,bounds.y+bounds.height*.4-60,{steps:6});await page.mouse.up();
 await page.waitForTimeout(300);const after=await page.locator('#bearings').textContent();
 if(before===after)throw Error('Camera horizontal movement did not update heading');
 await page.waitForTimeout(700);
 await page.locator('#bearings').getByText(/HULL/).count().then(n=>{if(!n)throw Error('Heading instrumentation missing');});
 await page.locator('button[data-order="Delta advance"]').click();
 await page.waitForTimeout(500);
 await page.locator('button[data-order="Delta halt"]').click();
 await page.locator('button[data-order="Gamma load AP"]').click();
 await page.locator('#order').fill('Silver report');
 await page.locator('#form button').click();
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 await mkdir('artifacts',{recursive:true});
 const phone=await browser.newPage({viewport:{width:915,height:412},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await phone.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
 await phone.locator('#mic').waitFor();
 if(!(await phone.locator('#mic').isVisible()))throw Error('Mobile microphone toggle absent');
 const boundsMobile=await phone.locator('#mic').boundingBox();
 if(!boundsMobile||boundsMobile.y<0||boundsMobile.y+boundsMobile.height>412||boundsMobile.x+boundsMobile.width>915)throw Error('Mobile microphone outside viewport');
 const canvasBounds=await phone.locator('#battle-canvas').boundingBox();
 if(!canvasBounds||canvasBounds.width>916||canvasBounds.height>413||canvasBounds.x<-.5||canvasBounds.y<-.5)throw Error('Canvas displayed larger than mobile viewport: '+JSON.stringify(canvasBounds));
 const webgl=await phone.locator('#battle-canvas').evaluate(el=>Boolean(el.getContext('webgl2')||el.getContext('webgl')));
 if(!webgl)throw Error('First-person Three.js WebGL context missing');
 await phone.screenshot({path:'artifacts/mobile-landscape.png'});
 await phone.close();

 // Visual steering contract: a left command must turn the physical view left,
 // making a fixed landmark straight ahead shift to the screen's right.
 const orient=await browser.newPage({viewport:{width:1200,height:780}});
 await orient.goto('http://127.0.0.1:4173/?debug=1',{waitUntil:'networkidle'});
 await orient.waitForFunction(()=>Boolean(window.__shellShockDebug));
 const initial=await orient.evaluate(()=>{
  const d=window.__shellShockDebug,p=d.player();
  return {hull:d.hull(),x:d.project(p.x,p.z+80).x,marker:p};
 });
 await orient.locator('button[data-order="Delta left"]').click();
 await orient.waitForTimeout(900);
 const turned=await orient.evaluate((p)=>({
  hull:window.__shellShockDebug.hull(),
  x:window.__shellShockDebug.project(p.x,p.z+80).x
 }),initial.marker);
 if(!(((turned.hull-initial.hull+540)%360)-180<-2&&turned.x>initial.x+.04))
  throw Error('LEFT steering visually reversed or stalled: '+JSON.stringify({initial,turned}));
 const hedgesBefore=await orient.evaluate(()=>window.__shellShockDebug.hedgeRotations());
 await orient.waitForTimeout(200);
 const hedgesAfter=await orient.evaluate(()=>window.__shellShockDebug.hedgeRotations());
 if(JSON.stringify(hedgesBefore)!==JSON.stringify(hedgesAfter))throw Error('Hedge sprite rotates with camera');
 await orient.close();

 // Voice-first end-to-end with an injected browser speech recognizer: final
 // transcript commits immediately while the microphone remains toggled on.
 const voice=await browser.newPage({viewport:{width:915,height:412}});
 await voice.addInitScript(()=>{
  class FakeRecognition{
   start(){window.__testRecognition=this;this.onstart?.();}
   stop(){this.onend?.();}
  }
  window.SpeechRecognition=FakeRecognition;
 });
 await voice.goto('http://127.0.0.1:4173',{waitUntil:'networkidle'});
 await voice.locator('#mic').click();
 await voice.waitForFunction(()=>Boolean(window.__testRecognition));
 await voice.evaluate(()=>{
  const result=[{transcript:'Driver advance and turn 20 degrees left'}];result.isFinal=true;
  window.__testRecognition.onresult({resultIndex:0,results:[result]});
 });
 await voice.waitForFunction(()=>document.querySelector('#voice-state')?.textContent?.startsWith('Command sent:'),{timeout:5000});
 const spoken=await voice.locator('#voice-state').textContent();
 if(!/Driver advance and turn 20 degrees left/.test(spoken))
  throw Error('Compound speech packet was not submitted together: '+spoken);
 const gameText=await voice.locator('#message').textContent();
 if(!/Advancing/.test(gameText)||!/Turning left 20 degrees/.test(gameText))
  throw Error('Compound voice commands did not execute: '+gameText);
 if(await voice.locator('#mic').getAttribute('aria-pressed')!=='true')
  throw Error('Microphone is not an active toggle');
 await voice.close();

await page.screenshot({path:'artifacts/first-playable-smoke.png',fullPage:true});
 console.log('Browser smoke passed; screenshot saved.');
}finally{await browser?.close();server.kill();}
