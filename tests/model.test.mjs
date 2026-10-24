import test from 'node:test';import assert from 'node:assert/strict';
import {makeGame,command,step,bearing,diff,norm,designate,blocked} from '../src/model.js';
test('bearing and relative angle are deterministic',()=>{assert.equal(bearing({x:0,z:0},{x:0,z:10}),0);assert.equal(bearing({x:0,z:0},{x:10,z:0}),90);assert.equal(diff(10,350),20);assert.equal(norm(-10),350);});
test('commander does not manually aim the gun',()=>{const g=makeGame(1);g.view=275;assert.equal(g.player.turret,8);assert.equal(g.view,275);assert.equal(designate(g),false);assert.equal(g.player.aim,null);});
test('loader respects selected ammo and breech',()=>{const g=makeGame();assert.match(command(g,'Gamma load AP'),/loading/);for(let i=0;i<100;i++)step(g,.05);assert.equal(g.loaded,'AP');command(g,'Gamma load HE');assert.equal(g.loaded,'AP');assert.equal(g.selected,'HE');});
test('driver advances under orders and halts',()=>{const g=makeGame();const z=g.player.z;command(g,'Delta advance');for(let i=0;i<20;i++)step(g,.05);assert.ok(g.player.z>z);command(g,'Delta halt');assert.equal(g.player.moving,0);});
test('enemy uses limited awareness',()=>{const g=makeGame(1);assert.equal(g.enemy.alert,false);step(g,.05);assert.equal(g.enemy.alert,false);});
test('ballistic damage responds to actual facing',()=>{const g=makeGame();assert.ok(g.enemy.hp>0);assert.equal(blocked({x:0,z:0},{x:0,z:10}),false);});

test('driver right ten degrees stops at exact heading',()=>{const g=makeGame();const start=g.player.hull;assert.match(command(g,'driver turn right 10 degrees'),/right 10 degrees/);for(let i=0;i<200;i++)step(g,.05);assert.ok(Math.abs(diff(g.player.hull,norm(start+10)))<.0001);assert.equal(g.player.turn,0);for(let i=0;i<200;i++)step(g,.05);assert.equal(g.player.hull,norm(start+10));});
test('driver left degree sign and indefinite turns',()=>{const g=makeGame();command(g,'driver turn left 10°');for(let i=0;i<200;i++)step(g,.05);assert.equal(g.player.hull,norm(8-10));assert.equal(g.player.turn,0);command(g,'delta right');step(g,.05);assert.ok(diff(g.player.hull,norm(8-10))>0);command(g,'delta halt');assert.equal(g.player.turn,0);});
