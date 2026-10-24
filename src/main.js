import * as THREE from 'three';
import {makeGame,step,command,designate,terrainHeight,obstacles,bearing,norm,diff} from './model.js';
import './style.css';
const root=document.querySelector('#app');
root.innerHTML=`<div id="viewport"></div><div id="hud"><div id="title">SHELL SHOCK <small>CHASING TAIL · ORCHARD CONTACT</small></div><div id="bearings"></div><div id="status"></div><div id="message"></div><div id="orders"><form id="form"><input id="order" placeholder="Command your crew…" autocomplete="off" aria-label="Command your crew"/><button>Issue order</button></form><div id="shortcuts"><button data-order="Silver report">Report</button><button data-order="Delta advance">Advance</button><button data-order="Delta halt">Halt</button><button data-order="Delta reverse">Reverse</button><button data-order="Delta left">Turn left</button><button data-order="Delta right">Turn right</button><button data-order="Beta acquire">Acquire</button><button data-order="Gamma load AP">Load AP</button><button data-order="Beta fire">Fire</button><button id="restart" type="button">Restart</button></div></div></div>`;
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
const reticle=document.createElement('div');reticle.id='reticle';reticle.innerHTML='<span>+</span><small>DRAG TO SCAN · TAP ENEMY TO DESIGNATE</small>';viewport.append(reticle);
function size(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}addEventListener('resize',size);size();
let dragging=false,down=0,lastX=0,lastY=0;
renderer.domElement.addEventListener('pointerdown',ev=>{dragging=true;down=ev.clientX;lastX=ev.clientX;lastY=ev.clientY;renderer.domElement.setPointerCapture(ev.pointerId)});
renderer.domElement.addEventListener('pointermove',ev=>{if(!dragging)return;g.view=norm(g.view+(ev.clientX-lastX)*.14);lastX=ev.clientX;lastY=ev.clientY;});
renderer.domElement.addEventListener('pointerup',ev=>{dragging=false;if(Math.abs(ev.clientX-down)<9){const hit=designate(g);g.message=hit?'Alpha: Panzer designated. Beta, you have the target.':'Silver: No confirmed target on that bearing.';}});
const ui=document.querySelector('#message');
function issue(s){g.message=command(g,s);renderHud();}document.querySelector('#form').addEventListener('submit',ev=>{ev.preventDefault();const input=document.querySelector('#order');issue(input.value);input.value='';});
document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>issue(b.dataset.order)));
document.querySelector('#restart').addEventListener('click',()=>{g=makeGame(g.seed+1);renderHud()});
function renderHud(){document.querySelector('#bearings').textContent='HULL '+Math.round(g.player.hull).toString().padStart(3,'0')+'°  |  VIEW '+Math.round(g.view).toString().padStart(3,'0')+'°  |  GUN '+Math.round(g.player.turret).toString().padStart(3,'0')+'°';
 document.querySelector('#status').textContent='ARMOR '+Math.max(0,Math.round(g.player.hp))+'% · GUN '+(g.loaded||'EMPTY')+' · '+(g.player.aimTime>1.8?'LAID':'ACQUIRING')+' · '+(g.enemySeen?'PANZER CONTACT':'NO CONTACT')+(g.finished?' · '+g.finished.toUpperCase():'');
 ui.textContent=g.message+(g.finished?' · Press Restart for another seed.':'');}
let last=performance.now(),hud=0;function frame(now){requestAnimationFrame(frame);let dt=Math.min((now-last)/1000,.06);last=now;step(g,dt);updateArt();
 const p=g.player;camera.position.set(p.x,terrainHeight(p.x,p.z)+5.7,p.z);
 const rad=g.view*Math.PI/180;camera.lookAt(p.x+Math.sin(rad)*100,camera.position.y-1,p.z+Math.cos(rad)*100);
 renderer.render(scene,camera);hud+=dt;if(hud>.12){renderHud();hud=0;}}requestAnimationFrame(frame);
