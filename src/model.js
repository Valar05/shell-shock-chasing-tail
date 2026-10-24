export const norm = a => ((a % 360) + 360) % 360;
export const diff = (a,b) => ((norm(a-b)+540)%360)-180;
export const bearing=(from,to)=>norm(Math.atan2(to.x-from.x,to.z-from.z)*180/Math.PI);
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const obstacles=[
 {x:-28,z:64,w:50,d:9,h:5,type:'hedge'},
 {x:45,z:100,w:10,d:90,h:5,type:'hedge'},
 {x:-70,z:119,w:46,d:11,h:6,type:'hedge'},
 {x:87,z:147,w:29,d:24,h:11,type:'house'},
 {x:-83,z:189,w:55,d:9,h:5,type:'hedge'},
 {x:32,z:211,w:65,d:8,h:5,type:'hedge'}
];
export function terrainHeight(x,z){return 1.8*Math.sin(x*.015)*Math.cos(z*.023)+2*Math.exp(-(((z-165)/38)**2));}
export function intersectRect(x,z,o,margin=0){return x>o.x-o.w/2-margin&&x<o.x+o.w/2+margin&&z>o.z-o.d/2-margin&&z<o.z+o.d/2+margin;}
export function blocked(a,b,ignore=[]) {
 for(let i=1;i<60;i++){const t=i/60,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  if(obstacles.some(o=>!ignore.includes(o)&&intersectRect(x,z,o)))return true;}
 return false;
}
export function move(tank,speed,dt){const rad=tank.hull*Math.PI/180;const x=tank.x+Math.sin(rad)*speed*dt,z=tank.z+Math.cos(rad)*speed*dt;
 if(!obstacles.some(o=>intersectRect(x,z,o,5))&&Math.abs(x)<205&&z>-25&&z<260){tank.x=x;tank.z=z;}}
export function makeGame(seed=1){
 const variation=(seed%5)*7;
 return {seed,elapsed:0,finished:null,view:5,message:'Silver: Road ahead. Possible armor near the orchard.',loaded:null,selected:'AP',loading:0,commands:[],enemySeen:false,
 player:{x:-4,z:1,hull:8,turret:8,hp:100,reload:0,moving:0,turn:0,aim:null,aimError:0,aimTime:0,shotCount:0},
 enemy:{x:68+variation,z:196,hull:190,turret:190,hp:100,reload:6,moving:0,turn:0,aim:null,aimTime:0,shotCount:0,alert:false}
 };}
export function designate(g){const p=g.player,e=g.enemy;const b=bearing(p,e);if(Math.abs(diff(g.view,b))>14||blocked(p,e))return false;g.enemySeen=true;p.aim='enemy';p.aimTime=0;return true;}
export function command(g,input){
 const c=input.toLowerCase().replace(/[.,!?]/g,'').trim();const p=g.player;
 if(/\b(restart|retry)\b/.test(c))return 'Restart with the Restart button.';
 if(/\b(delta|driver)\b/.test(c)){
  if(/\b(halt|stop)\b/.test(c)){p.moving=0;p.turn=0;return 'Delta: Halted, sir.';}
  if(/\b(reverse|back)\b/.test(c)){p.moving=-9;return 'Delta: Reversing.';}
  if(/\b(advance|forward|move)\b/.test(c)){p.moving=11;return 'Delta: Advancing.';}
  const d=c.match(/\b(left|right)\b/);if(d){p.turn=d[1]==='left'?-22:22;return 'Delta: Turning '+d[1]+'.';}
 }
 if(/\b(gamma|loader)\b/.test(c)||/\bload\b/.test(c)){
  const m=c.match(/\b(ap|he|smoke)\b/);if(m)g.selected=m[1].toUpperCase();if(!g.loaded&&g.loading<=0)g.loading=3.8;return 'Gamma: '+g.selected+' selected; '+(g.loaded?g.loaded+' already in breech.':'loading.');
 }
 if(/\b(beta|gunner)\b/.test(c)||/\b(fire|engage|acquire|track)\b/.test(c)){
  if(/\b(hold|cease|stop)\b/.test(c)){p.hold=true;return 'Beta: Holding fire.';}
  if(/\b(acquire|track|target|engage)\b/.test(c)){if(!g.enemySeen)return 'Beta: No confirmed target, sir.';p.aim='enemy';p.hold=true;return 'Beta: Traversing onto designated Panzer.';}
  if(/\b(fire)\b/.test(c)){p.hold=false;p.fireRequested=true;return 'Beta: Firing when laid and loaded.';}
  if(/\b(short|over|left|right|lead|higher|lower)\b/.test(c)){p.aimError=clamp(p.aimError*.5,-12,12);return 'Beta: Correction received.';}
 }
 if(/\b(silver|report|status|contact)\b/.test(c)){return g.enemySeen?'Silver: Enemy armor marked, bearing '+Math.round(bearing(p,g.enemy))+' degrees.':'Silver: No confirmed contact. Keep scanning.';}
 return 'Crew: Say again, sir?';
}
export function step(g,dt){
 if(g.finished)return;dt=Math.min(dt,.08);g.elapsed+=dt;const p=g.player,e=g.enemy;
 if(p.turn){p.hull=norm(p.hull+p.turn*dt);p.turret=norm(p.turret+p.turn*dt);g.view=norm(g.view+p.turn*dt);}
 if(p.moving)move(p,p.moving,dt);
 if(g.loading>0){g.loading-=dt;if(g.loading<=0){g.loaded=g.selected;g.message='Gamma: '+g.loaded+' loaded.';}}
 if(!g.enemySeen&&!blocked(p,e)&&Math.abs(diff(g.view,bearing(p,e)))<13){g.enemySeen=true;g.message='Silver: Enemy Panzer! Bearing '+Math.round(bearing(p,e))+'!';}
 if(e.hp>0){
  if(!e.alert&&((distance(p,e)<105&&!blocked(p,e))||g.elapsed>24))e.alert=true;
  if(e.alert){
   const target=bearing(e,p);e.turret=norm(e.turret+clamp(diff(target,e.turret),-14*dt,14*dt));e.aimTime=Math.abs(diff(target,e.turret))<7&&!blocked(e,p)?e.aimTime+dt:0;
   if(e.reload>0)e.reload-=dt;
   if(e.aimTime>2.7&&e.reload<=0){e.shotCount++;e.reload=7.5;e.aimTime=0;
    const hit=!blocked(e,p)&&Math.abs(diff(target,e.turret))<5;
    if(hit){const flank=Math.abs(diff(bearing(p,e),p.hull));p.hp-=flank>55?53:27;g.message='Silver: INCOMING! We took a hit!';}else g.message='Silver: Panzer fired! Impact in the hedgerow!';
   }
  }
 }
 if(p.aim==='enemy'&&e.hp>0){const target=bearing(p,e);p.turret=norm(p.turret+clamp(diff(target,p.turret),-20*dt,20*dt));p.aimTime=Math.abs(diff(target,p.turret))<5&&!blocked(p,e)?p.aimTime+dt:0;}
 if(p.fireRequested&&p.aimTime>1.8&&g.loaded&&e.hp>0){p.fireRequested=false;p.shotCount++;const clear=!blocked(p,e);const angle=Math.abs(diff(bearing(e,p),e.hull));const dmg=g.loaded==='AP'?(angle>55?68:38):g.loaded==='HE'?11:0;
  g.message=clear?(dmg?'Beta: HIT! '+(angle>55?'Side armor!':'Frontal armor!'):'Beta: Smoke away!'):'Beta: Shot blocked by terrain!';
  if(clear)e.hp-=dmg;g.loaded=null;g.loading=3.8;p.aimTime=0;e.alert=true;
 }
 if(p.hp<=0){g.finished='Defeat';g.message='Silver: We are hit! Abandon tank!';}
 if(e.hp<=0){g.finished='Victory';g.message='Beta: Panzer knocked out! Target destroyed!';}
}
