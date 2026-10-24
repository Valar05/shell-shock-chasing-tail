import {makeGame,step,command,designate,terrainHeight,obstacles,bearing,norm,diff} from './model.js';
import './style.css';
const root=document.querySelector('#app');
root.innerHTML=`<div id="viewport"></div><div id="hud"><div id="title">SHELL SHOCK <small>CHASING TAIL · ORCHARD CONTACT</small></div><div id="bearings"></div><div id="compass" aria-label="Compass and viewing bearing"><div id="compass-ticks"></div><div id="compass-center">▼</div></div><div id="status"></div><div id="message"></div><div id="end-screen" hidden role="alertdialog" aria-live="assertive"><strong id="end-title"></strong><p id="end-caption"></p><button id="end-restart" type="button">↻ Play again</button></div><div id="orders"><div id="voice-panel"><button id="mic" type="button" aria-pressed="false">🎙️ Start voice command</button><span id="voice-state" role="status" aria-live="polite">Tap microphone and speak to your crew</span></div><details id="type-fallback"><summary>Keyboard commands (alternative)</summary><form id="form"><input id="order" placeholder="Command your crew…" autocomplete="off" aria-label="Command your crew"/><button>Issue order</button></form></details><div id="shortcuts"><button data-order="Silver report">Report</button><button data-order="Delta advance">Advance</button><button data-order="Delta halt">Halt</button><button data-order="Delta reverse">Reverse</button><button data-order="Delta left">Turn left</button><button data-order="Delta right">Turn right</button><button data-order="Beta acquire">Acquire</button><button data-order="Gamma load AP">Load AP</button><button data-order="Beta fire">Fire</button><button id="restart" type="button">Restart</button></div></div></div>`;
const viewport=document.querySelector('#viewport');
const canvas=document.createElement('canvas');canvas.id='battle-canvas';canvas.setAttribute('aria-label','Vector tactical world view');viewport.append(canvas);
const ctx=canvas.getContext('2d',{alpha:false});
let g=makeGame(1);
const scale=2.25;
function point(x,z){const dx=x-g.player.x,dz=z-g.player.z,r=g.view*Math.PI/180;
 return [canvas.clientWidth/2+(dx*Math.cos(r)-dz*Math.sin(r))*scale,canvas.clientHeight*.63-(dx*Math.sin(r)+dz*Math.cos(r))*scale];}
function poly(points,color,stroke='#1d2e21'){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
function rectangle(x,z,w,d,color){poly([[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]].map(p=>point(...p)),color);}
function buildingArt(o,id){const b=g.breaches.find(v=>v.id===id);if(!b){rectangle(o.x,o.z,o.w,o.d,'#8a6756');return;}
 const jag=2.2;
 if(b.axis==='z'){const left=o.x-o.w/2,right=o.x+o.w/2,cutL=b.center-b.width/2,cutR=b.center+b.width/2;
  const halves=[[[left,o.z-o.d/2],[cutL-jag,o.z-o.d/2],[cutL+jag,o.z-o.d/4],[cutL-jag,o.z],[cutL+jag,o.z+o.d/4],[cutL,o.z+o.d/2],[left,o.z+o.d/2]],[[cutR,o.z-o.d/2],[right,o.z-o.d/2],[right,o.z+o.d/2],[cutR,o.z+o.d/2],[cutR-jag,o.z+o.d/4],[cutR+jag,o.z],[cutR-jag,o.z-o.d/4]]];halves.forEach(h=>poly(h.map(v=>point(...v)),'#8a6756'));}
 else{const low=o.z-o.d/2,high=o.z+o.d/2,a=b.center-b.width/2,c=b.center+b.width/2;[[[o.x-o.w/2,low],[o.x+o.w/2,low],[o.x+o.w/2,a],[o.x+o.w/4,a+jag],[o.x,a-jag],[o.x-o.w/4,a+jag],[o.x-o.w/2,a]],[[o.x-o.w/2,c],[o.x-o.w/4,c-jag],[o.x,c+jag],[o.x+o.w/4,c-jag],[o.x+o.w/2,c],[o.x+o.w/2,high],[o.x-o.w/2,high]]].forEach(h=>poly(h.map(v=>point(...v)),'#8a6756'));}
}
function tankArt(t,color){
 const r=t.hull*Math.PI/180,ca=Math.cos(r),si=Math.sin(r);
 const hull=[[-5,-6],[5,-6],[5,6],[-5,6]].map(([x,z])=>point(t.x+x*ca+z*si,t.z-x*si+z*ca));
 poly(hull,color);const center=point(t.x,t.z);
 ctx.beginPath();ctx.arc(...center,7,0,Math.PI*2);ctx.fillStyle='#474e42';ctx.fill();
 const gunR=t.turret*Math.PI/180,tip=point(t.x+Math.sin(gunR)*12,t.z+Math.cos(gunR)*12);
 ctx.beginPath();ctx.moveTo(...center);ctx.lineTo(...tip);ctx.strokeStyle='#e4dfc6';ctx.lineWidth=5;ctx.stroke();
}
function drawWorld(){
 const w=canvas.clientWidth,h=canvas.clientHeight;ctx.fillStyle='#798460';ctx.fillRect(0,0,w,h);
 const p=g.player;
 for(let x=-200;x<=200;x+=25){const a=point(x,-25),b=point(x,260);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle='#ffffff13';ctx.lineWidth=1;ctx.stroke();}
 for(let z=0;z<=250;z+=25){const a=point(-205,z),b=point(205,z);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle='#ffffff13';ctx.stroke();}
 rectangle(15,120,15,260,'#ac9d7c');
 for(const [id,o] of obstacles.entries()){if(o.type==='house')buildingArt(o,id);else rectangle(o.x,o.z,o.w,o.d,'#334e2b');}
 if(g.enemy.hp>0)tankArt(g.enemy,'#76674e');
 tankArt(p,'#d2c292');
 const [cx,cy]=point(p.x,p.z);
 ctx.beginPath();ctx.moveTo(cx,cy);const sight=point(p.x+Math.sin(g.view*Math.PI/180)*65,p.z+Math.cos(g.view*Math.PI/180)*65);ctx.lineTo(...sight);ctx.strokeStyle='#fbe49b80';ctx.lineWidth=1;ctx.stroke();
 ctx.fillStyle='#f5efda';ctx.font='12px system-ui';ctx.fillText('VECTOR PROTOTYPE · HEDGES SLOW TRACKS',12,h-14);
}
const reticle=document.createElement('div');reticle.id='reticle';reticle.innerHTML='<span>+</span><small>DRAG TO SCAN · TAP TO DESIGNATE</small>';viewport.append(reticle);
function size(){const w=viewport.clientWidth,h=viewport.clientHeight;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);}addEventListener('resize',size);size();
let dragging=false,down=0,lastX=0,lastY=0,pitch=0;const lookSensitivity=.55;
canvas.addEventListener('pointerdown',ev=>{dragging=true;down=ev.clientX;lastX=ev.clientX;lastY=ev.clientY;canvas.setPointerCapture(ev.pointerId)});
canvas.addEventListener('pointermove',ev=>{if(!dragging)return;g.view=norm(g.view-(ev.clientX-lastX)*lookSensitivity);pitch=Math.max(-50,Math.min(50,pitch-(ev.clientY-lastY)*lookSensitivity));lastX=ev.clientX;lastY=ev.clientY;});
canvas.addEventListener('pointerup',ev=>{dragging=false;if(Math.abs(ev.clientX-down)<9){const hit=designate(g);g.message=hit?'Alpha: Panzer designated. Beta, you have the target.':'Silver: No confirmed target on that bearing.';}});
const ui=document.querySelector('#message');
function restartGame(){g=makeGame(g.seed+1);pitch=0;document.querySelector('#end-screen').hidden=true;renderHud();}
function issue(s){if(!s.trim())return;if(/^(restart|retry)(?: game)?[.!?]?$/i.test(s.trim())){restartGame();return;}g.message=command(g,s);renderHud();}
const mic=document.querySelector('#mic'),voiceState=document.querySelector('#voice-state');
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,listening=false,wantListening=false,phrase='',silenceTimer=null,restartTimer=null;
const SILENCE_MS=3000; // Fallback for interim recognition; final speech results submit immediately.
function updateVoice(message){mic.setAttribute('aria-pressed',String(wantListening));mic.textContent=wantListening?'🛑 Microphone ON · tap to stop':'🎙️ Microphone OFF · tap to talk';voiceState.textContent=message;}
function cancelSilence(){if(silenceTimer!==null){clearTimeout(silenceTimer);silenceTimer=null;}}
function commitPhrase(){cancelSilence();const spoken=phrase.trim();phrase='';if(spoken){issue(spoken);updateVoice('Command sent: '+spoken);}}
function holdPhrase(text){phrase=text.trim();cancelSilence();if(!phrase)return;voiceState.textContent='Heard: '+phrase+' · sending after 3 seconds of quiet';silenceTimer=setTimeout(commitPhrase,SILENCE_MS);}
function retryListening(){if(!wantListening||listening)return;clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(!wantListening||listening)return;try{recognition.start();}catch{updateVoice('Microphone paused. Tap OFF then ON to retry.');}},300);}
if(SpeechRecognition){
 recognition=new SpeechRecognition();recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;
 recognition.onstart=()=>{listening=true;updateVoice('Listening continuously · 3 seconds of quiet submits');};
 recognition.onresult=ev=>{let assembled='';let finalText='';for(let i=ev.resultIndex;i<ev.results.length;i++){const t=ev.results[i][0]?.transcript?.trim()||'';if(!t)continue;if(ev.results[i].isFinal)finalText+=(finalText?' ':'')+t;else assembled+=(assembled?' ':'')+t;}if(finalText){phrase=finalText;commitPhrase();}else if(assembled)holdPhrase(assembled);};
 recognition.onerror=ev=>{if(['not-allowed','service-not-allowed','audio-capture'].includes(ev.error)){wantListening=false;cancelSilence();clearTimeout(restartTimer);}updateVoice('Microphone: '+ev.error+'. Check browser permission if needed.');};
 recognition.onend=()=>{listening=false; if(wantListening)retryListening();else updateVoice('Microphone OFF · tap to talk');};
 mic.addEventListener('click',()=>{wantListening=!wantListening;if(wantListening){phrase='';updateVoice('Starting microphone…');retryListening();}else{clearTimeout(restartTimer);commitPhrase();updateVoice('Microphone OFF · tap to talk');if(listening)recognition.stop();}});
}else{mic.disabled=true;updateVoice('Speech recognition unavailable in this browser. Try Chrome or keyboard fallback.');}
document.querySelector('#form').addEventListener('submit',ev=>{ev.preventDefault();const input=document.querySelector('#order');issue(input.value);input.value='';});
document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>issue(b.dataset.order)));
document.querySelector('#restart').addEventListener('click',restartGame);
document.querySelector('#end-restart').addEventListener('click',restartGame);
const compassTicks=document.querySelector('#compass-ticks');
const cardinal=deg=>({0:'N',90:'E',180:'S',270:'W'}[norm(deg)]||String(norm(deg)).padStart(3,'0')+'°');
function renderCompass(){const width=document.querySelector('#compass').clientWidth||360;const spacing=width/120;let html='';const view=g.view;for(let i=-60;i<=60;i+=5){const a=norm(Math.round(view/5)*5+i);const x=width/2+(diff(a,view))*spacing;if(x<0||x>width)continue;const major=a%30===0;const medium=a%15===0;html+='<div class="tick '+(major?'major':medium?'medium':'minor')+'" style="left:'+x+'px"><span></span>'+(major?'<b>'+cardinal(a)+'</b>':'')+'</div>';}compassTicks.innerHTML=html;document.querySelector('#compass').setAttribute('aria-label','Viewing bearing '+Math.round(view)+' degrees, hull '+Math.round(g.player.hull)+' degrees');}
function renderHud(){renderCompass();document.querySelector('#bearings').textContent='HULL '+Math.round(g.player.hull).toString().padStart(3,'0')+'°  |  VIEW '+Math.round(g.view).toString().padStart(3,'0')+'°  |  GUN '+Math.round(g.player.turret).toString().padStart(3,'0')+'°';
 document.querySelector('#status').textContent='ARMOR '+Math.max(0,Math.round(g.player.hp))+'% · GUN '+(g.loaded||'EMPTY')+' · '+(g.player.aimTime>1.8?'LAID':'ACQUIRING')+' · '+(g.enemySeen?'PANZER CONTACT':'NO CONTACT')+(g.finished?' · '+g.finished.toUpperCase():'');
 ui.textContent=g.message;const end=document.querySelector('#end-screen');if(g.finished){end.hidden=false;document.querySelector('#end-title').textContent=g.finished==='Victory'?'Victory · Enemy destroyed':'Defeat · Tank knocked out';document.querySelector('#end-caption').textContent=g.message;}else end.hidden=true;}
let last=performance.now(),hud=0;function frame(now){requestAnimationFrame(frame);let dt=Math.min((now-last)/1000,.06);last=now;step(g,dt);drawWorld();hud+=dt;if(hud>.12){renderHud();hud=0;}}requestAnimationFrame(frame);
