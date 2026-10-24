import {parseTransmission} from './command-parser.js';
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
export function blocked(a,b,ignore=[],breaches=[]) {
 for(let i=1;i<60;i++){const t=i/60,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  if(obstacles.some((o,id)=>!ignore.includes(o)&&intersectRect(x,z,o)&&!insideBreach(x,z,id,breaches)))return true;}
 return false;
}
export function insideBreach(x,z,id,breaches=[]){const b=breaches.find(q=>q.id===id);if(!b)return false;return b.axis==='z'?Math.abs(x-b.center)<b.width/2:Math.abs(z-b.center)<b.width/2;}
export function move(tank,speed,dt,g=null){
 const rad=tank.hull*Math.PI/180,x=tank.x+Math.sin(rad)*speed*dt,z=tank.z+Math.cos(rad)*speed*dt;
 if(Math.abs(x)>=205||z<=-25||z>=260)return;
 const houseId=obstacles.findIndex((o,id)=>o.type==='house'&&intersectRect(x,z,o,5)&&!insideBreach(x,z,id,g?.breaches));
 if(houseId>=0){
  if(!g)return;
  const axis=Math.abs(Math.cos(rad))>=Math.abs(Math.sin(rad))?'z':'x';
  const o=obstacles[houseId];
  const center=axis==='z'?clamp(x,o.x-o.w/2+7,o.x+o.w/2-7):clamp(z,o.z-o.d/2+7,o.z+o.d/2-7);
  if(!g.breaches.some(b=>b.id===houseId))g.breaches.push({id:houseId,axis,center,width:14});
  g.message='Delta: Pushing through the building! Masonry collapsing!';
 }
 const hedge=obstacles.find(o=>o.type==='hedge'&&intersectRect(x,z,o,5));
 const effectiveSpeed=houseId>=0?speed*.18:hedge?speed*.28:speed;
 const permitted=tank.moveRemaining==null?Infinity:Math.max(0,tank.moveRemaining);
 const travel=Math.sign(effectiveSpeed)*Math.min(Math.abs(effectiveSpeed*dt),permitted);
 tank.x+=Math.sin(rad)*travel;
 tank.z+=Math.cos(rad)*travel;
 if(tank.moveRemaining!=null){
  tank.moveRemaining=Math.max(0,tank.moveRemaining-Math.abs(travel));
  if(tank.moveRemaining<.000001){tank.moveRemaining=0;tank.moving=0;}
 }
 tank.brushing=Boolean(hedge);
}
export function makeGame(seed=1){
 const variation=(seed%5)*7;
 return {seed,elapsed:0,finished:null,view:5,message:'Silver: Road ahead. Possible armor near the orchard.',loaded:null,selected:'AP',loading:0,commands:[],enemySeen:false,breaches:[],pendingFrames:[],orderJobs:[],orderPacketId:0,
 player:{x:-4,z:1,hull:8,turret:8,hp:100,reload:0,moving:0,moveRemaining:null,turn:0,turnRemaining:0,gunTraverse:0,gunTraverseRemaining:0,aim:null,aimError:0,aimTime:0,shotCount:0},
 enemy:{x:68+variation,z:196,hull:190,turret:190,hp:100,reload:6,moving:0,turn:0,aim:null,aimTime:0,shotCount:0,alert:false}
 };}
export function designate(g){const p=g.player,e=g.enemy;const b=bearing(p,e);if(Math.abs(diff(g.view,b))>14||blocked(p,e,[],g.breaches))return false;g.enemySeen=true;p.aim='enemy';p.aimTime=0;return true;}
function legacyCommand(g,input){
 const c=input.toLowerCase().replace(/[.,!?]/g,'').trim();const p=g.player;
 if(/\b(restart|retry)\b/.test(c))return 'Restart available by voice or Play again.';
 if(/\b(delta|driver)\b/.test(c)){
  if(/\b(halt|stop)\b/.test(c)){p.moving=0;p.turn=0;p.turnRemaining=0;return 'Delta: Halted, sir.';}
  if(/\b(reverse|back)\b/.test(c)){p.moving=-9;return 'Delta: Reversing.';}
  if(/\b(advance|forward|move)\b/.test(c)){p.moving=11;return 'Delta: Advancing.';}
  const d=c.match(/\b(left|right)\b/);if(d){const magnitude=c.match(/\b(\d+(?:\.\d+)?)\s*(?:degrees?|deg)?\b/);const spoken=c.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|forty five|ninety|one hundred|one eighty)\b/);const numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fifteen:15,twenty:20,thirty:30,forty:40,'forty five':45,ninety:90,'one hundred':100,'one eighty':180};const degrees=magnitude?Number(magnitude[1]):spoken?numbers[spoken[1]]:null;if(degrees!==null&&(!Number.isFinite(degrees)||degrees<=0||degrees>360))return 'Delta: Specify a turn from 1 to 360 degrees.';p.turn=d[1]==='left'?-22:22;p.turnRemaining=degrees;return 'Delta: Turning '+d[1]+(degrees===null?' until ordered to halt.':' '+degrees+' degrees.');}
 }
 // Commander bearing callouts are references, not magical target acquisition.
 const clock=c.match(/\b(?:at|on|bearing|target|enemy|contact)?\s*(1[0-2]|[1-9])\s*o\s*'?\s*clock\b/);
 const absolute=c.match(/\b(?:bearing|azimuth|heading)\s*(\d{1,3})\s*(?:degrees?|deg)?\b/);
 const vague=c.match(/\b(ahead|forward|front|left|right|behind|rear|back)\b/);
 if((clock||absolute||vague)&&/\b(beta|gunner|silver|contact|target|enemy|panzer|spot|designate|bearing|azimuth)\b/.test(c)){
  let indicated,kind,tolerance;
  if(clock){indicated=norm(p.hull+((Number(clock[1])%12)*30));kind=clock[1]+" o'clock";tolerance=16;}
  else if(absolute){indicated=norm(Number(absolute[1]));kind='bearing '+Math.round(indicated)+'°';tolerance=9;}
  else {const dirs={ahead:0,forward:0,front:0,left:-90,right:90,behind:180,rear:180,back:180};indicated=norm(p.hull+dirs[vague[1]]);kind=vague[1];tolerance=48;}
  if(Math.abs(diff(bearing(p,g.enemy),indicated))<=tolerance&&!blocked(p,g.enemy)&&g.enemy.hp>0){g.enemySeen=true;p.aim='enemy';p.aimTime=0;return 'Beta: Contact confirmed '+kind+'. Traversing to target.';}
  return 'Silver: Checking '+kind+'. No confirmed armor there.';
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

// Deterministic order-graph interpreter. This keeps compound speech atomic at
// compile time and late-binds conditions/dependencies to real simulation state.
function conditionMet(g,condition){
 if(!condition)return true;
 if(condition.type==="GUNNER_LOCKED")return g.player.aimTime>1.8;
 if(condition.type==="ROUND_LOADED")return Boolean(g.loaded);
 if(condition.type==="CONTACT_CONFIRMED")return g.enemySeen;
 return false;
}
function resolveBearing(g,reference){
 if(reference.type==="ABSOLUTE")return norm(reference.value);
 if(reference.type==="CLOCK")return norm(g.player.hull+(reference.value%12)*30);
 const cardinal={north:0,northeast:45,east:90,southeast:135,south:180,southwest:225,west:270,northwest:315};
 if(reference.type==="CARDINAL")return cardinal[reference.value];
 const offsets={ahead:0,front:0,forward:0,left:-90,port:-90,right:90,starboard:90,behind:180,rear:180};
 return norm(g.player.hull+offsets[reference.value]);
}
function executeFrame(g,job){
 const f=job.frame,p=g.player;
 job.status="running";
 job.startedAt=g.elapsed;
 job.startShots=p.shotCount;
 job.startBearing=p.hull;
 let response="";
 if(f.action==="ADVANCE"||f.action==="REVERSE"){
  const multiplier=f.speedProfile==="SLOW"?.45:f.speedProfile==="FAST"?1.35:1;
  p.moving=(f.action==="ADVANCE"?11:-9)*multiplier;
  p.moveRemaining=f.distance;
  response="Delta: "+(p.moving>0?"Advancing":"Reversing")+(f.distance===null?".":" "+f.distance+" meters.");
 }else if(f.action==="HALT"){
  p.moving=0;p.moveRemaining=0;p.turn=0;p.turnRemaining=0;
  response="Delta: Halted, sir.";
  job.status="done";
 }else if(f.action==="TURN"){
  p.turn=f.direction==="left"?-22:22;
  p.turnRemaining=f.degrees;
  response="Delta: Turning "+f.direction+(f.degrees===null?" until ordered to halt.":" "+f.degrees+" degrees.");
 }else if(f.action==="HEADING"){
  const angle=resolveBearing(g,f.bearing);const delta=diff(angle,p.hull);
  p.turn=Math.abs(delta)<.001?0:Math.sign(delta)*22;
  p.turnRemaining=Math.abs(delta);
  response="Delta: Turning to heading "+Math.round(angle)+" degrees.";
  if(!p.turn){job.status="done";}
 }else if(f.action==="TRAVERSE"){
  p.aim=null;p.gunTraverse=f.direction==="left"?-18:18;
  p.gunTraverseRemaining=f.degrees;
  response="Beta: Traversing "+f.direction+(f.degrees===null?" until ordered to halt.":" "+f.degrees+" degrees.");
 }else if(f.action==="LOAD"){
  if(f.ammo)g.selected=f.ammo;
  if(!g.loaded&&g.loading<=0)g.loading=3.8;
  response="Gamma: "+g.selected+" selected; "+(g.loaded?"already loaded.":"loading.");
 }else if(f.action==="ACQUIRE"){
  response=legacyCommand(g,"Beta acquire");
  if(/No confirmed target/.test(response))job.status="done";
 }else if(f.action==="FIRE"){
  response=legacyCommand(g,"Beta fire");
 }else if(f.action==="HOLD_FIRE"){
  p.hold=true;p.fireRequested=false;
  response="Beta: Holding fire.";
  job.status="done";
 }else if(f.action==="REPORT"){
  response=legacyCommand(g,"Silver report");
  job.status="done";
 }else if(f.action==="SPOT"){
  const indicated=resolveBearing(g,f.bearing);
  const tolerance=f.bearing.type==="RELATIVE"?48:f.bearing.type==="CLOCK"?16:9;
  if(g.enemy.hp>0&&!blocked(p,g.enemy,[],g.breaches)&&Math.abs(diff(bearing(p,g.enemy),indicated))<=tolerance){
   g.enemySeen=true;p.aim="enemy";p.aimTime=0;
   response="Beta: Confirmed contact, bearing "+Math.round(indicated)+" degrees.";
  }else response="Silver: No confirmed target at bearing "+Math.round(indicated)+" degrees.";
  job.status="done";
 }else if(f.action==="RESTART"){
  response="Restart available by voice or Play again.";
  job.status="done";
 }
 if(job.status==="done")job.completedAt=g.elapsed;
 return response;
}
function jobComplete(g,job){
 const f=job.frame,p=g.player;
 if(["HALT","HOLD_FIRE","REPORT","SPOT","RESTART"].includes(f.action))return true;
 if(["TURN","HEADING"].includes(f.action))return f.action==="HEADING"?p.turn===0:f.degrees!==null&&p.turn===0;
 if(f.action==="TRAVERSE")return f.degrees!==null&&p.gunTraverse===0;
 if(["ADVANCE","REVERSE"].includes(f.action))return f.distance!==null&&p.moveRemaining===0;
 if(f.action==="LOAD")return Boolean(g.loaded)&&(!f.ammo||g.loaded===f.ammo);
 if(f.action==="ACQUIRE")return p.aimTime>1.8;
 if(f.action==="FIRE")return p.shotCount>job.startShots;
 return false;
}
function processOrderGraph(g){
 for(const job of g.orderJobs||[]){
  if(job.status==="running"){
   if(job.frame.condition?.mode==="UNTIL"&&conditionMet(g,job.frame.condition)){
    if(["ADVANCE","REVERSE","TURN"].includes(job.frame.action)){g.player.moving=0;g.player.moveRemaining=0;g.player.turn=0;g.player.turnRemaining=0;}
    if(job.frame.action==="TRAVERSE"){g.player.gunTraverse=0;g.player.gunTraverseRemaining=0;}
    job.status="done";job.completedAt=g.elapsed;
    g.message="Crew: Conditional order complete.";
   }else if(jobComplete(g,job)){job.status="done";job.completedAt=g.elapsed;}
  }
 }
 // Dependencies refer to frames within one transmission, not the global queue.
 for(const job of g.orderJobs||[]){
  if(job.status!=="pending")continue;
  const deps=job.frame.dependencies||[];
  if(deps.some(d=>g.orderJobs.some(j=>j.packet===job.packet&&j.frame.index===d.frame&&j.status==="skipped"))){job.status="skipped";continue;}
  if(deps.some(d=>!g.orderJobs.some(j=>j.packet===job.packet&&j.frame.index===d.frame&&j.status==="done")))continue;
  const condition=job.frame.condition;
  if(condition&&condition.mode!=="UNTIL"&&!conditionMet(g,condition)){
    if(condition.mode==="IF"){job.status="skipped";g.message="Crew: Condition not met; order not executed.";}
    continue;
  }
  g.message=executeFrame(g,job)||g.message;
 }
 // Bound work retained for the running encounter only.
 if(g.orderJobs?.length>160)g.orderJobs=g.orderJobs.filter(j=>j.status==="pending"||j.status==="running").slice(-160);
}
export function command(g,input){
 const parsed=parseTransmission(input,g.discourse||{});
 if(!parsed.ok)return "Silver: Order not executed. "+parsed.errors.map(e=>e.code+": "+(e.clause||e.detail)).join("; ")+".";
 if(parsed.frames.some(f=>f.action==="RESTART")){
  if(parsed.frames.length!==1)return "Silver: Restart must be a separate order.";
  return "Restart available by voice or Play again.";
 }
 g.discourse=parsed.discourse;
 g.lastCompiled={normalized:parsed.normalized,frames:parsed.frames.map(f=>({action:f.action,actor:f.actor,degrees:f.degrees,distance:f.distance,relation:f.relation,condition:f.condition}))};
 g.orderJobs ||= [];
 g.orderPacketId=(g.orderPacketId||0)+1;
 const packet=g.orderPacketId,receipts=[];
 for(const frame of parsed.frames){
  const job={packet,frame,status:"pending"};
  g.orderJobs.push(job);
  if(frame.dependencies?.length){receipts.push("Crew: Queued "+frame.action.toLowerCase()+" after prior order.");continue;}
  const condition=frame.condition;
  if(condition&&condition.mode!=="UNTIL"&&!conditionMet(g,condition)){
   if(condition.mode==="IF"){job.status="skipped";receipts.push("Crew: Condition not met.");}
   else receipts.push("Crew: Standing by for "+condition.type.toLowerCase().replace(/_/g," ")+".");
   continue;
  }
  receipts.push(executeFrame(g,job));
 }
 return receipts.join(" | ")||"Silver: No executable order.";
}

export function step(g,dt){
 if(g.finished)return;dt=Math.min(dt,.08);g.elapsed+=dt;const p=g.player,e=g.enemy;
 if(p.turn){const delta=p.turnRemaining===null?p.turn*dt:Math.sign(p.turn)*Math.min(Math.abs(p.turn*dt),p.turnRemaining);p.hull=norm(p.hull+delta);p.turret=norm(p.turret+delta);g.view=norm(g.view+delta);if(p.turnRemaining!==null){p.turnRemaining=Math.max(0,p.turnRemaining-Math.abs(delta));if(p.turnRemaining<.00001){p.turn=0;p.turnRemaining=0;g.message='Delta: Turn complete. Holding heading.';}}}
 if(p.gunTraverse){const delta=p.gunTraverseRemaining===null?p.gunTraverse*dt:Math.sign(p.gunTraverse)*Math.min(Math.abs(p.gunTraverse*dt),p.gunTraverseRemaining);p.turret=norm(p.turret+delta);if(p.gunTraverseRemaining!==null){p.gunTraverseRemaining=Math.max(0,p.gunTraverseRemaining-Math.abs(delta));if(p.gunTraverseRemaining<.00001){p.gunTraverse=0;p.gunTraverseRemaining=0;}}}
 if(p.moving)move(p,p.moving,dt,g);
 if(g.loading>0){g.loading-=dt;if(g.loading<=0){g.loaded=g.selected;g.message='Gamma: '+g.loaded+' loaded.';}}
 if(!g.enemySeen&&!blocked(p,e,[],g.breaches)&&Math.abs(diff(g.view,bearing(p,e)))<13){g.enemySeen=true;g.message='Silver: Enemy Panzer! Bearing '+Math.round(bearing(p,e))+'!';}
 if(e.hp>0){
  if(!e.alert&&((distance(p,e)<105&&!blocked(p,e,[],g.breaches))||g.elapsed>24))e.alert=true;
  if(e.alert){
   const target=bearing(e,p);e.turret=norm(e.turret+clamp(diff(target,e.turret),-14*dt,14*dt));e.aimTime=Math.abs(diff(target,e.turret))<7&&!blocked(e,p,[],g.breaches)?e.aimTime+dt:0;
   if(e.reload>0)e.reload-=dt;
   if(e.aimTime>2.7&&e.reload<=0){e.shotCount++;e.reload=7.5;e.aimTime=0;
    const hit=!blocked(e,p,[],g.breaches)&&Math.abs(diff(target,e.turret))<5;
    if(hit){const flank=Math.abs(diff(bearing(p,e),p.hull));p.hp-=flank>55?53:27;g.message='Silver: INCOMING! We took a hit!';}else g.message='Silver: Panzer fired! Impact in the hedgerow!';
   }
  }
 }
 if(p.aim==='enemy'&&e.hp>0){const target=bearing(p,e);p.turret=norm(p.turret+clamp(diff(target,p.turret),-20*dt,20*dt));p.aimTime=Math.abs(diff(target,p.turret))<5&&!blocked(p,e,[],g.breaches)?p.aimTime+dt:0;}
 if(p.fireRequested&&p.aimTime>1.8&&g.loaded&&e.hp>0){p.fireRequested=false;p.shotCount++;const clear=!blocked(p,e,[],g.breaches);const angle=Math.abs(diff(bearing(e,p),e.hull));const dmg=g.loaded==='AP'?(angle>55?68:38):g.loaded==='HE'?11:0;
  g.message=clear?(dmg?'Beta: HIT! '+(angle>55?'Side armor!':'Frontal armor!'):'Beta: Smoke away!'):'Beta: Shot blocked by terrain!';
  if(clear)e.hp-=dmg;g.loaded=null;g.loading=3.8;p.aimTime=0;e.alert=true;
 }
 processOrderGraph(g);
 if(p.hp<=0){g.finished='Defeat';g.message='Silver: We are hit! Abandon tank!';}
 if(e.hp<=0){g.finished='Victory';g.message='Beta: Panzer knocked out! Target destroyed!';}
}
