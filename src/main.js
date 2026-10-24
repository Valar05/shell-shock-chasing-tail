import * as THREE from 'three';
import {makeGame,step,command,designate,terrainHeight,obstacles,bearing,norm,diff} from './model.js';
import './style.css';
const root=document.querySelector('#app');
root.innerHTML=`<div id="viewport"></div><div id="hud"><div id="title">SHELL SHOCK <small>CHASING TAIL · ORCHARD CONTACT</small></div><div id="bearings"></div><div id="compass" aria-label="Compass and viewing bearing"><div id="compass-ticks"></div><div id="compass-center">▼</div></div><div id="status"></div><div id="message"></div><div id="end-screen" hidden role="alertdialog" aria-live="assertive"><strong id="end-title"></strong><p id="end-caption"></p><button id="end-restart" type="button">↻ Play again</button></div><div id="orders"><div id="voice-panel"><button id="mic" type="button" aria-pressed="false">🎙️ Start voice command</button><span id="voice-state" role="status" aria-live="polite">Tap microphone and speak to your crew</span></div><details id="type-fallback"><summary>Keyboard commands (alternative)</summary><form id="form"><input id="order" placeholder="Command your crew…" autocomplete="off" aria-label="Command your crew"/><button>Issue order</button></form></details><div id="shortcuts"><button data-order="Silver report">Report</button><button data-order="Delta advance">Advance</button><button data-order="Delta halt">Halt</button><button data-order="Delta reverse">Reverse</button><button data-order="Delta left">Turn left</button><button data-order="Delta right">Turn right</button><button data-order="Beta acquire">Acquire</button><button data-order="Gamma load AP">Load AP</button><button data-order="Beta fire">Fire</button><button id="restart" type="button">Restart</button></div></div></div>`;
const viewport=document.querySelector('#viewport');const scene=new THREE.Scene();scene.background=new THREE.Color(0x9eafa5);scene.fog=new THREE.Fog(0x9eafa5,90,310);
const camera=new THREE.PerspectiveCamera(50,1,.1,390);const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));viewport.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdde7dc,0x666341,2));
const sunlight=new THREE.DirectionalLight(0xffe0b0,2);sunlight.position.set(-50,80,100);scene.add(sunlight);
const material=(color)=>new THREE.MeshLambertMaterial({color});
const groundGeometry=new THREE.PlaneGeometry(420,310,64,48);groundGeometry.rotateX(-Math.PI/2);
const pos=groundGeometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,terrainHeight(pos.getX(i),pos.getZ(i)+120)-.5);groundGeometry.computeVertexNormals();
const ground=new THREE.Mesh(groundGeometry,material(0x76815a));ground.position.z=120;scene.add(ground);
function box(x,z,w,d,h,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,terrainHeight(x,z)+h/2,z);scene.add(m);return m;}
for(const o of obstacles){box(o.x,o.z,o.w,o.d,o.h,o.type==='hedge'?0x405f35:0x98876e);if(o.type==='house'){const roof=new THREE.Mesh(new THREE.ConeGeometry(23,9,4),material(0x875743));roof.rotation.y=Math.PI/4;roof.position.set(o.x,terrainHeight(o.x,o.z)+o.h+3,o.z);scene.add(roof);}}
for(let i=0;i<55;i++){const x=Math.sin(i*54.32)*179,z=(i*47)%257;if(obstacles.some(o=>Math.abs(x-o.x)<o.w/2+10&&Math.abs(z-o.z)<o.d/2+10))continue;const trunk=box(x,z,1.5,1.5,5,0x64533b);const leaves=new THREE.Mesh(new THREE.SphereGeometry(4.5,5,4),material(0x456943));leaves.position.set(x,terrainHeight(x,z)+7.8,z);scene.add(leaves);}
const road=new THREE.Mesh(new THREE.PlaneGeometry(15,260),new THREE.MeshLambertMaterial({color:0xada17c,side:THREE.DoubleSide}));road.rotation.x=-Math.PI/2;road.position.set(15,.3,120);scene.add(road);
function tank(color){const group=new THREE.Group();const chassis=new THREE.Mesh(new THREE.BoxGeometry(8,3,12),material(color));chassis.position.y=2.5;group.add(chassis);for(const x of [-4.8,4.8]){const tread=new THREE.Mesh(new THREE.BoxGeometry(2,2.3,12),material(0x292e2a));tread.position.set(x,1.5,0);group.add(tread);}
const turretPivot=new THREE.Group();turretPivot.position.y=4;const tur=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,2,7),material(color));tur.position.y=.5;turretPivot.add(tur);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,10,7),material(0x424642));barrel.rotation.x=Math.PI/2;barrel.position.set(0,.4,6);turretPivot.add(barrel);group.add(turretPivot);scene.add(group);return{group,turretPivot};}
const enemyArt=tank(0x6e6c59);let g=makeGame(1);
function updateArt(){const e=g.enemy;enemyArt.group.position.set(e.x,terrainHeight(e.x,e.z),e.z);enemyArt.group.rotation.y=e.hull*Math.PI/180;enemyArt.turretPivot.rotation.y=diff(e.turret,e.hull)*Math.PI/180;enemyArt.group.visible=e.hp>0;}
const reticle=document.createElement('div');reticle.id='reticle';reticle.innerHTML='<span>+</span><small>DRAG TO SCAN · TAP TO DESIGNATE</small>';viewport.append(reticle);
function size(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',size);size();
let dragging=false,down=0,lastX=0,lastY=0,pitch=0;const lookSensitivity=.55;
renderer.domElement.addEventListener('pointerdown',ev=>{dragging=true;down=ev.clientX;lastX=ev.clientX;lastY=ev.clientY;renderer.domElement.setPointerCapture(ev.pointerId)});
renderer.domElement.addEventListener('pointermove',ev=>{if(!dragging)return;g.view=norm(g.view-(ev.clientX-lastX)*lookSensitivity);pitch=Math.max(-50,Math.min(50,pitch-(ev.clientY-lastY)*lookSensitivity));lastX=ev.clientX;lastY=ev.clientY;});
renderer.domElement.addEventListener('pointerup',ev=>{dragging=false;if(Math.abs(ev.clientX-down)<9){const hit=designate(g);g.message=hit?'Alpha: Panzer designated. Beta, you have the target.':'Silver: No confirmed target on that bearing.';}});
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
let last=performance.now(),hud=0;function frame(now){requestAnimationFrame(frame);let dt=Math.min((now-last)/1000,.06);last=now;step(g,dt);updateArt();
 const p=g.player;camera.position.set(p.x,terrainHeight(p.x,p.z)+5.7,p.z);
 const rad=g.view*Math.PI/180;camera.lookAt(p.x+Math.sin(rad)*100,camera.position.y+Math.tan(pitch*Math.PI/180)*100,p.z+Math.cos(rad)*100);
 renderer.render(scene,camera);hud+=dt;if(hud>.12){renderHud();hud=0;}}requestAnimationFrame(frame);
