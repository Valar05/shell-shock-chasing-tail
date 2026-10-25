import * as THREE from 'three';
import {createSpeechPacketizer} from './speech-packetizer.js';
import {createCrewVoice} from './crew-voice.js';
import {makeCrewLine} from './crew-dialogue.js';
import {makeGame,step,command,designate,terrainHeight,obstacles,bearing,norm,diff} from './model.js';
import './style.css';
const root=document.querySelector('#app');
root.innerHTML=`<div id="viewport"></div><div id="hud"><div id="title">SHELL SHOCK <small>CHASING TAIL · ORCHARD CONTACT</small></div><div id="bearings"></div><div id="compass" aria-label="Compass and viewing bearing"><div id="compass-ticks"></div><div id="compass-center">▼</div></div><div id="status"></div><div id="message"></div><div id="end-screen" hidden role="alertdialog" aria-live="assertive"><strong id="end-title"></strong><p id="end-caption"></p><button id="end-restart" type="button">↻ Play again</button></div><div id="orders"><div id="voice-panel"><button id="mic" type="button" aria-pressed="false">🎙️ Start voice command</button><button id="crew-audio" type="button" aria-pressed="false">🔊 Crew voices OFF</button><span id="voice-state" role="status" aria-live="polite">Tap microphone and speak to your crew</span></div><details id="type-fallback"><summary>Keyboard commands (alternative)</summary><form id="form"><input id="order" placeholder="Command your crew…" autocomplete="off" aria-label="Command your crew"/><button>Issue order</button></form></details><div id="shortcuts"><button data-order="Silver report">Report</button><button data-order="Delta advance">Advance</button><button data-order="Delta halt">Halt</button><button data-order="Delta reverse">Reverse</button><button data-order="Delta left">Turn left</button><button data-order="Delta right">Turn right</button><button data-order="Beta acquire">Acquire</button><button data-order="Gamma load AP">Load AP</button><button data-order="Beta fire">Fire</button><button id="restart" type="button">Restart</button></div></div></div>`;
const viewport=document.querySelector('#viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xa5b8aa);scene.fog=new THREE.Fog(0xa5b8aa,90,340);
const camera=new THREE.PerspectiveCamera(65,1,.1,400);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.domElement.id='battle-canvas';viewport.append(renderer.domElement);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(440,310),new THREE.MeshBasicMaterial({color:0x798460}));ground.rotation.x=-Math.PI/2;ground.position.z=118;scene.add(ground);
let g=makeGame(1);
function spriteTexture(draw){const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');draw(x);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t;}
const tankTexture=spriteTexture(x=>{x.fillStyle='#414b3d';x.fillRect(22,60,84,38);x.fillStyle='#a1a48b';x.fillRect(34,42,60,28);x.fillStyle='#363b36';x.fillRect(6,92,116,12);x.fillStyle='#d6cdab';x.fillRect(49,30,29,14);x.fillRect(60,17,12,20);});
const treeTexture=spriteTexture(x=>{x.fillStyle='#584431';x.fillRect(57,70,14,58);x.fillStyle='#365e35';for(const [px,py,r] of [[38,55,30],[85,52,31],[63,31,35]]){x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();}});
const hedgeTexture=spriteTexture(x=>{x.fillStyle='#34522c';x.fillRect(0,27,128,101);for(let i=0;i<11;i++){x.beginPath();x.arc(i*13,28+(i%3)*7,20,0,Math.PI*2);x.fill();}});
function houseTexture(breach){return spriteTexture(x=>{x.fillStyle='#8c7260';x.fillRect(8,40,112,88);x.fillStyle='#744d3e';x.beginPath();x.moveTo(0,43);x.lineTo(64,0);x.lineTo(128,43);x.fill();if(breach){x.globalCompositeOperation='destination-out';x.beginPath();x.moveTo(47,128);x.lineTo(50,80);x.lineTo(44,66);x.lineTo(53,54);x.lineTo(76,54);x.lineTo(84,69);x.lineTo(79,85);x.lineTo(83,128);x.closePath();x.fill();x.globalCompositeOperation='source-over';}});}
function billboard(texture,w,h,x,z,y=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.1,side:THREE.DoubleSide,depthWrite:true}));m.position.set(-x,y+h/2,z);scene.add(m);return m;}
const environment=[];
for(const [id,o] of obstacles.entries()){const isHouse=o.type==='house',t=isHouse?houseTexture(false):hedgeTexture;const m=billboard(t,Math.max(o.w,16),isHouse?18:7,o.x,o.z);if(o.type==='hedge')m.rotation.y=o.d>o.w?Math.PI/2:0;
environment.push({id,o,m,breached:false});}
for(let i=0;i<48;i++){const x=Math.sin(i*43.17)*175,z=(i*47)%250;if(obstacles.some(o=>Math.abs(x-o.x)<o.w/2+9&&Math.abs(z-o.z)<o.d/2+9))continue;const tree=billboard(treeTexture,13,18,x,z);tree.userData.cameraFacing=true;}
const enemySprite=billboard(tankTexture,13,11,0,0);
function drawWorld(){const e=g.enemy;enemySprite.visible=e.hp>0;enemySprite.position.set(-e.x,5.5,e.z);
enemySprite.lookAt(camera.position.x,5.5,camera.position.z);
scene.traverse(obj=>{if(obj.userData?.cameraFacing)obj.lookAt(camera.position.x,obj.position.y,camera.position.z);});
for(const item of environment){if(item.o.type==='house'&&g.breaches.some(b=>b.id===item.id)&&!item.breached){item.breached=true;item.m.material.map=houseTexture(true);item.m.material.needsUpdate=true;}}
camera.position.set(-g.player.x,5.8,g.player.z);const r=g.view*Math.PI/180,el=pitch*Math.PI/180;camera.lookAt(-g.player.x-Math.sin(r)*Math.cos(el)*100,5.8+Math.sin(el)*100,g.player.z+Math.cos(r)*Math.cos(el)*100);renderer.render(scene,camera);}
if(new URLSearchParams(location.search).has('debug'))window.__shellShockDebug={view:()=>g.view,hull:()=>g.player.hull,project:(x,z)=>{const p=new THREE.Vector3(-x,5.5,z).project(camera);return {x:p.x,y:p.y}},player:()=>({x:g.player.x,z:g.player.z}),hedgeRotations:()=>environment.filter(e=>e.o.type==='hedge').map(e=>e.m.rotation.y)};
const reticle=document.createElement('div');reticle.id='reticle';reticle.innerHTML='<span>+</span><small>DRAG TO SCAN · TAP TO DESIGNATE</small>';viewport.append(reticle);
function size(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',size);size();
let dragging=false,down=0,lastX=0,lastY=0,pitch=0;const lookSensitivity=.55;
renderer.domElement.addEventListener('pointerdown',ev=>{dragging=true;down=ev.clientX;lastX=ev.clientX;lastY=ev.clientY;renderer.domElement.setPointerCapture(ev.pointerId)});
renderer.domElement.addEventListener('pointermove',ev=>{if(!dragging)return;g.view=norm(g.view+(ev.clientX-lastX)*lookSensitivity);pitch=Math.max(-50,Math.min(50,pitch-(ev.clientY-lastY)*lookSensitivity));lastX=ev.clientX;lastY=ev.clientY;});
renderer.domElement.addEventListener('pointerup',ev=>{dragging=false;if(Math.abs(ev.clientX-down)<9){const hit=designate(g);g.message=hit?'Alpha: Panzer designated. Beta, you have the target.':'Silver: No confirmed target on that bearing.';}});
const ui=document.querySelector('#message');
let lastSpokenMessage='';
let crewSpeaking=false;
function words(t){return String(t||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function isCrewEcho(transcript){const heard=words(transcript),spoken=words(crewVoice.speakingText);if(!heard||!spoken)return false;if(/^(?:driver|delta|gunner|beta|loader|gamma|silver|commander|alpha)\b/.test(heard))return false;return heard.length>=5&&(spoken.includes(heard)||heard.includes(spoken));}
const crewAudioButton=document.querySelector('#crew-audio');
const crewVoice=createCrewVoice({onState:status=>{crewSpeaking=status==='speaking';},resolveInterrupted:line=>{
 if(!/^(beta|delta|silver)\.(contact|lost|reacquired)$/.test(line.id))return line;
 if(g.enemy.hp<=0)return null;
 const station=line.speaker;
 const state=g.threatMemory?.observers?.[station]?.state;
 if(!state)return null;
 const b=g.threatMemory.bearing,range=g.threatMemory.range;
 if(state==='visible')return makeCrewLine(station+'.contact',{bearing:b,range});
 if(state==='lost')return makeCrewLine(station+'.lost',{location:'outside my sight',bearing:b});
 return null;
},isRelevant:line=>{
 if(g.finished==='Victory'&&/^(delta|beta|silver)\.(contact|lost|reacquired)$/.test(line.id))return false;
 if(g.finished==='Defeat'&&line.priority<5)return false;
 if(g.enemy.hp<=0&&/enemy|panzer|contact|armor|armour|threat|farmhouse/i.test(line.text)&&!/(destroyed|knocked out)/i.test(line.text))return false;
 return true;
}});
if(!crewVoice.available){crewAudioButton.disabled=true;crewAudioButton.textContent='Crew audio unavailable';}
crewAudioButton.addEventListener('click',()=>{const on=crewVoice.enable(!crewVoice.enabled);crewAudioButton.setAttribute('aria-pressed',String(on));crewAudioButton.textContent=on?'🔊 Crew voices ON':'🔇 Crew voices OFF';if(on){lastSpokenMessage='';crewVoice.feedback('Silver: Radio check. Crew audio online.');}});
function restartGame(){g=makeGame(g.seed+1);pitch=0;document.querySelector('#end-screen').hidden=true;renderHud();}
function issue(s){if(!s.trim())return;if(/^(restart|retry)(?: game)?[.!?]?$/i.test(s.trim())){restartGame();return;}g.message=command(g,s);renderHud();}
const mic=document.querySelector('#mic'),voiceState=document.querySelector('#voice-state');
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,listening=false,wantListening=false,restartTimer=null;
function updateVoice(message){mic.setAttribute('aria-pressed',String(wantListening));mic.textContent=wantListening?'🛑 Microphone ON · tap to stop':'🎙️ Microphone OFF · tap to talk';voiceState.textContent=message;}
const speechPackets=createSpeechPacketizer({submit:text=>{issue(text);crewVoice.resume();},status:msg=>voiceState.textContent=msg});
function retryListening(){if(!wantListening||listening)return;clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(!wantListening||listening)return;try{recognition.start();}catch{updateVoice('Microphone paused. Tap OFF then ON to retry.');}},300);}
if(SpeechRecognition){
 recognition=new SpeechRecognition();recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;
 recognition.onstart=()=>{listening=true;updateVoice('Listening continuously · 3 seconds of quiet submits');};
 recognition.onresult=ev=>{const text=Array.from(ev.results).slice(ev.resultIndex||0).map(r=>r[0]?.transcript||'').join(' ').trim();if(crewSpeaking&&isCrewEcho(text))return;if(text&&crewSpeaking)crewVoice.interrupt();speechPackets.receive(ev);};
 recognition.onerror=ev=>{if(['not-allowed','service-not-allowed','audio-capture'].includes(ev.error)){wantListening=false;speechPackets.abort();clearTimeout(restartTimer);}updateVoice('Microphone: '+ev.error+'. Check browser permission if needed.');};
 recognition.onend=()=>{listening=false; if(wantListening)retryListening();else updateVoice('Microphone OFF · tap to talk');};
 mic.addEventListener('click',()=>{wantListening=!wantListening;if(wantListening){speechPackets.abort();updateVoice('Starting microphone…');retryListening();}else{clearTimeout(restartTimer);speechPackets.flush();crewVoice.resume();updateVoice('Microphone OFF · tap to talk');if(listening)recognition.stop();}});
}else{mic.disabled=true;updateVoice('Speech recognition unavailable in this browser. Try Chrome or keyboard fallback.');}
document.querySelector('#form').addEventListener('submit',ev=>{ev.preventDefault();const input=document.querySelector('#order');issue(input.value);input.value='';});
document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>issue(b.dataset.order)));
document.querySelector('#restart').addEventListener('click',restartGame);
document.querySelector('#end-restart').addEventListener('click',restartGame);
const compassTicks=document.querySelector('#compass-ticks');
const cardinal=deg=>({0:'N',90:'E',180:'S',270:'W'}[norm(deg)]||String(norm(deg)).padStart(3,'0')+'°');
function renderCompass(){const width=document.querySelector('#compass').clientWidth||360;const spacing=width/120;let html='';const view=g.view;for(let i=-60;i<=60;i+=5){const a=norm(Math.round(view/5)*5+i);const x=width/2+(diff(a,view))*spacing;if(x<0||x>width)continue;const major=a%30===0;const medium=a%15===0;html+='<div class="tick '+(major?'major':medium?'medium':'minor')+'" style="left:'+x+'px"><span></span>'+(major?'<b>'+cardinal(a)+'</b>':'')+'</div>';}compassTicks.innerHTML=html;document.querySelector('#compass').setAttribute('aria-label','Viewing bearing '+Math.round(view)+' degrees, hull '+Math.round(g.player.hull)+' degrees');}
function renderHud(){renderCompass();document.querySelector('#bearings').textContent='HULL '+Math.round(g.player.hull).toString().padStart(3,'0')+'°  |  VIEW '+Math.round(g.view).toString().padStart(3,'0')+'°  |  GUN '+Math.round(g.player.turret).toString().padStart(3,'0')+'°';
 document.querySelector('#status').textContent='ARMOR '+Math.max(0,Math.round(g.player.hp))+'% · GUN '+(g.loaded||'EMPTY')+' · '+(g.player.aimTime>1.8?'LAID':'ACQUIRING')+' · '+(g.threatMemory?.observers?.beta?.state==='lost'?'LAST KNOWN '+g.threatMemory.bearing+'° · BETA SEARCHING':g.enemySeen?'PANZER CONTACT':'NO CONTACT')+(g.finished?' · '+g.finished.toUpperCase():'');
 ui.textContent=g.message;
 const reported=g.crewEvents?.splice(0)||[];
 for(const event of reported){crewVoice.feedback(event.message);}
 if(g.message!==lastSpokenMessage){lastSpokenMessage=g.message;
   if(!reported.some(event=>event.message===g.message))crewVoice.feedback(g.message);
 }
 const end=document.querySelector('#end-screen');if(g.finished){end.hidden=false;document.querySelector('#end-title').textContent=g.finished==='Victory'?'Victory · Enemy destroyed':'Defeat · Tank knocked out';document.querySelector('#end-caption').textContent=g.message;}else end.hidden=true;}
let last=performance.now(),hud=0,simulationDebt=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min(Math.max((now-last)/1000,0),.25);last=now;simulationDebt+=dt;let steps=0;while(simulationDebt>=.02&&steps<13){step(g,.02);simulationDebt-=.02;steps++;}drawWorld();hud+=dt;if(hud>.12){renderHud();hud=0;}}requestAnimationFrame(frame);
