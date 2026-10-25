import test from 'node:test';import assert from 'node:assert/strict';
import {makeGame,command,step,bearing,diff,norm,designate,blocked} from '../src/model.js';
test('bearing and relative angle are deterministic',()=>{assert.equal(bearing({x:0,z:0},{x:0,z:10}),0);assert.equal(bearing({x:0,z:0},{x:10,z:0}),90);assert.equal(diff(10,350),20);assert.equal(norm(-10),350);});
test('commander does not manually aim the gun',()=>{const g=makeGame(1);g.view=275;assert.equal(g.player.turret,8);assert.equal(g.view,275);assert.equal(designate(g),false);assert.equal(g.player.aim,null);});
test('loader respects selected ammo and breech',()=>{const g=makeGame();assert.match(command(g,'Gamma load AP'),/loading/);for(let i=0;i<100;i++)step(g,.05);assert.equal(g.loaded,'AP');command(g,'Gamma load HE');assert.equal(g.loaded,'AP');assert.equal(g.selected,'HE');});
test('driver advances under orders and halts',()=>{const g=makeGame();const z=g.player.z;command(g,'Delta advance');for(let i=0;i<20;i++)step(g,.05);assert.ok(g.player.z>z);command(g,'Delta halt');assert.equal(g.player.moving,0);});
test('enemy uses limited awareness',()=>{const g=makeGame(1);assert.equal(g.enemy.alert,false);step(g,.05);assert.equal(g.enemy.alert,false);});
test('ballistic damage responds to actual facing',()=>{const g=makeGame();assert.ok(g.enemy.hp>0);assert.equal(blocked({x:0,z:0},{x:0,z:10}),false);});

test('driver right ten degrees stops at exact heading',()=>{const g=makeGame();const start=g.player.hull;assert.match(command(g,'driver turn right 10 degrees'),/right 10 degrees/);for(let i=0;i<200;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,norm(start+10)))<.0001);assert.equal(g.player.turn,0);for(let i=0;i<200;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,norm(start+10)))<1e-8);});
test('driver left degree sign and indefinite turns',()=>{const g=makeGame();command(g,'driver turn left 10°');for(let i=0;i<200;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,norm(8-10)))<1e-8);assert.equal(g.player.turn,0);command(g,'delta right');step(g,.05);assert.ok(diff(g.player.hull,norm(8-10))>0);command(g,'delta halt');assert.equal(g.player.turn,0);});

test('commander target callouts accept clock, compass degrees and vague directions',()=>{const g=makeGame();g.enemy.x=100;g.enemy.z=0;g.player.hull=0;g.player.turret=0;g.view=0;assert.match(command(g,"Beta target at 3 o'clock"),/confirmed contact/i);assert.equal(g.player.aim,'enemy');g.player.aim=null;assert.match(command(g,'Beta target bearing 90 degrees'),/confirmed contact/i);g.player.aim=null;assert.match(command(g,'Silver enemy to the right'),/confirmed contact/i);g.player.aim=null;assert.match(command(g,"Beta target at 9 o'clock"),/No confirmed target/i);assert.equal(g.player.aim,null);});

test('hedges slow but never immobilize advancing tank; house remains solid',()=>{const g=makeGame();g.player.x=-28;g.player.z=52;g.player.hull=0;g.player.moving=11;const before=g.player.z;for(let i=0;i<80;i++)step(g,.05);assert.ok(g.player.z>before+5,'tank should progress through hedge');assert.ok(g.player.z<before+45,'hedge should slow tracks');const h=makeGame();h.player.x=87;h.player.z=128;h.player.hull=0;h.player.moving=11;const initial=h.player.z;for(let i=0;i<80;i++)step(h,.05);assert.ok(h.player.z>initial+3,'tank should push into house');assert.ok(h.breaches.length===1,'house records permanent breach');});
test('left turn decreases compass bearing while right turn increases it',()=>{const g=makeGame();const initial=g.player.hull;command(g,'driver left 10 degrees');for(let i=0;i<30;i++)step(g,.05);assert.ok(diff(g.player.hull,initial)<0);command(g,'driver right 10 degrees');for(let i=0;i<30;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,initial))<1e-8);});

test('bulldozed building creates persistent sight corridor',()=>{const g=makeGame();g.player.x=87;g.player.z=128;g.player.hull=0;g.player.moving=11;for(let i=0;i<120;i++)step(g,.05);assert.equal(g.breaches.length,1);const b=g.breaches[0];assert.equal(b.axis,'z');assert.equal(b.width,14);assert.equal(g.breaches[0].id,3);});

test('Delta spots line-of-sight armor within driving arc and reports once',()=>{
 const g=makeGame();g.player.x=0;g.player.z=0;g.player.hull=0;g.player.turret=180;g.enemy.x=0;g.enemy.z=75;
 step(g,.05);
 assert.equal(g.contactReported.delta,true);
 assert.equal(g.contactReported.beta,false);
 assert.equal(g.crewEvents.length,1);
 assert.match(g.crewEvents[0].message,/Delta: Armor ahead/);
 assert.match(g.crewEvents[0].message,/Bearing 0 degrees/);
 for(let i=0;i<10;i++)step(g,.05);
 assert.equal(g.crewEvents.filter(x=>x.speaker==='delta').length,1);
});
test('Beta detects separately through his gun sight, even outside driver cone',()=>{
 const g=makeGame();g.player.x=0;g.player.z=0;g.player.hull=0;g.player.turret=90;g.enemy.x=75;g.enemy.z=0;
 step(g,.05);
 assert.equal(g.contactReported.delta,false);
 assert.equal(g.contactReported.beta,true);
 assert.match(g.crewEvents[0].message,/Beta: Panzer in my sights/);
});
test('occluded or rearward targets cannot produce supernatural callouts',()=>{
 const g=makeGame();g.player.x=0;g.player.z=0;g.player.hull=0;g.player.turret=0;
 g.enemy.x=0;g.enemy.z=-75;step(g,.05);
 assert.equal(g.crewEvents.length,0);
 const h=makeGame();h.player.x=-28;h.player.z=40;h.player.hull=0;h.player.turret=0;h.enemy.x=-28;h.enemy.z=95;
 step(h,.05);assert.equal(h.crewEvents.length,0);
});

test('gunner remembers a sighted tank disappearing behind farmhouse and searches',()=>{
 const g=makeGame();g.player.x=87;g.player.z=110;g.player.hull=0;g.player.turret=0;
 g.enemy.x=87;g.enemy.z=125;
 step(g,.05);
 assert.equal(g.threatMemory.observers.beta.state,'visible');
 assert.equal(g.threatMemory.z,125);
 g.enemy.z=190;
 step(g,.05);
 assert.equal(g.threatMemory.observers.beta.state,'lost');
 assert.equal(g.threatMemory.z,125,'memory must not update to hidden target position');
 assert.equal(g.threatMemory.state,'last-known');
 const lost=g.crewEvents.find(e=>e.id==='beta.lost');
 assert.match(lost.message,/behind the farmhouse/i);
 assert.equal(g.player.aim,null);
 const heading=g.player.turret;
 for(let i=0;i<45;i++)step(g,.05);
 assert.notEqual(g.player.turret,heading,'gunner should scan near last known location');
 assert.equal(g.crewEvents.filter(e=>e.id==='beta.lost').length,1,'no repeated lost reports');
 g.enemy.z=125;
 step(g,.05);
 assert.equal(g.threatMemory.observers.beta.state,'visible');
 assert.equal(g.crewEvents.filter(e=>e.id==='beta.reacquired').length,1);
});
test('no threat memory or false report for unseen armor behind farmhouse',()=>{
 const g=makeGame();g.player.x=87;g.player.z=110;g.player.hull=0;g.player.turret=0;
 g.enemy.x=87;g.enemy.z=190;
 step(g,.05);
 assert.equal(g.threatMemory,null);
 assert.equal(g.crewEvents.length,0);
});

test('unaddressed movement and gun orders route to responsible crew',()=>{
 const g=makeGame();assert.match(command(g,'advance'),/Delta: Advancing/);
 assert.match(command(g,'load AP'),/Gamma:/);
 assert.match(command(g,'report'),/Silver:/);
});
test('run over that tree resolves through commander view and actually removes world tree',async()=>{
 const g=makeGame();g.player.x=-4;g.player.z=1;g.player.hull=8;
 // A grounded existing tree within the forward sight line.
 const {trees}=await import('../src/model.js');
 const t=trees.filter(t=>Math.hypot(t.x+4,t.z-1)>9&&Math.hypot(t.x+4,t.z-1)<130)
  .sort((a,b)=>Math.hypot(a.x+4,a.z-1)-Math.hypot(b.x+4,b.z-1))[0];
 g.view=bearing(g.player,t);g.player.hull=g.view;
 assert.match(command(g,'run over that tree'),/Tree identified/);
 for(let i=0;i<1000&&!g.crushedTrees.includes(t.id);i++)step(g,.05);
 assert.ok(g.crushedTrees.includes(t.id),'tree should be run over and removed');
 assert.equal(g.navigation,null);
});

test('tree target 30 degrees to left is measured relative to the viewing bearing',async()=>{
 const {trees}=await import('../src/model.js');
 const {parseTransmission}=await import('../src/command-parser.js');
 const frame=parseTransmission('run over the tree 30 degrees to the left').frames[0];
 assert.equal(frame.action,'CRUSH_TREE');
 assert.equal(frame.targetOffset,30);
 assert.equal(frame.direction,'left');
 const g=makeGame();g.player.x=-4;g.player.z=1;
 const target=trees.find(t=>Math.hypot(t.x+4,t.z-1)>15&&Math.hypot(t.x+4,t.z-1)<80);
 assert.ok(target);
 g.view=norm(bearing(g.player,target)+30);
 const response=command(g,'run over the tree 30 degrees to the left');
 assert.match(response,/30 degrees left/i);
 assert.equal(g.navigation.treeId,target.id);
 const other=makeGame();other.player.x=-4;other.player.z=1;other.view=g.view;
 const noAngle=command(other,'run over the tree');
 assert.ok(!other.navigation||other.navigation.treeId!==target.id||!/Tree identified/.test(noAngle),
 'unqualified sightline targeting should not secretly apply a 30 degree offset');
});
test('relative right tree bearing is preserved and out-of-range angles are rejected',async()=>{
 const {parseTransmission}=await import('../src/command-parser.js');
 const parsed=parseTransmission('driver run over that tree thirty degrees to the right');
 assert.equal(parsed.ok,true,JSON.stringify(parsed.errors));
 assert.equal(parsed.frames[0].targetOffset,30);
 assert.equal(parsed.frames[0].direction,'right');
 assert.equal(parseTransmission('run over the tree 200 degrees left').ok,false);
});
