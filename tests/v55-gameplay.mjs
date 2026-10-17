import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {makeProfile,purchaseWeapon,syncInventory} from '../dist/progression.js';
import {ROLL,MELEE,HITBOX,rayHitCandidate,resetMeleeState} from '../dist/combat.js';
import {MAP} from '../dist/shared/map.js';
import {EVENT_TYPES,advanceEvent,createEventState} from '../dist/arena-events.js';

export async function verifyV55(t,{byId,windowEvents,storage}){
 const descendants=n=>[...n.children,...n.children.flatMap(descendants)];
 const key=(type,code)=>windowEvents[type].forEach(fn=>fn({code,repeat:false,preventDefault(){}}));
 const mouse=(type,button)=>{const listeners=type==='mousedown'?byId.get('game').events.mousedown:windowEvents.mouseup;listeners.forEach(fn=>fn({button}));};
 const reset=()=>{t.setMode('play');t.admin.god=t.admin.flying=false;t.setFreecam(false,false);t.suspendDungeon();t.keys.clear();Object.assign(t.profile,makeProfile({coins:10000}));t.resetPlayer();t.player.position.set(7,0,10);t.setAim(0,0);for(const f of t.fighters){f.alive=false;f.respawnAt=Infinity;}};
 reset();
 // Closing the entrance disables both the prompt and entry function, with a real collider.
 assert.equal(t.world.portal.active,false);assert.equal(t.world.portal.veil,null);
 t.player.position.copy(t.world.portal.origin).add(new T.Vector3(0,0,2));
 const before=t.player.position.clone();assert.equal(t.enterDungeon(),false);assert.equal(t.dungeon.active,false);assert(t.player.position.equals(before));assert.equal(t.dungeonInteraction(),null);
 assert(t.blocked(0,-28.75,1,.1),'fallen portal block is solid');
 const points=[];t.world.root.updateMatrixWorld(true);t.world.root.traverse(o=>{if(o.isMesh&&o.material.color?.getHex()===0x3c3447){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(Math.abs(v.x)<2.2&&Math.abs(v.z+28.75)<1.6&&v.y<3.2)points.push(v);}}});assert(points.length>=20,'fallen block geometry covers the threshold');
 // Only supply giveaways repeat, including after the first cycle.
 assert.deepEqual(EVENT_TYPES.map(e=>e.kind),['supply']);const event=createEventState();
 for(let i=0;i<20;i++){assert.equal(advanceEvent(event,event.at,()=>0),'warning');assert.equal(event.type.kind,'supply');assert.equal(advanceEvent(event,event.at,()=>0),'start');assert.equal(advanceEvent(event,event.at,()=>0),'end');}
 t.event.phase='idle';t.event.type=null;t.event.at=t.time;t.updateArenaEvents(.01);assert.equal(t.event.type.kind,'supply');t.wait(9);t.updateArenaEvents(.01);assert.equal(t.supplyDrops.length,4);const coins=t.profile.coins;t.collectSupply(t.supplyDrops[0],t.player);assert.equal(t.profile.coins,coins+40);t.event.phase='idle';t.event.at=t.time+1000;
 // Q/E are movement only, even with a potion selected; I toggles the physical inventory.
 reset();const potions=t.profile.potions.healing;t.player.health=100;key('keydown','KeyQ');for(let i=0;i<18;i++)t.playerTick();key('keyup','KeyQ');assert(t.player.position.x<6.5);assert.equal(t.profile.potions.healing,potions);assert.equal(t.mode,'play');
 t.player.position.set(7,0,10);t.player.velocity.set(0,0,0);key('keydown','KeyE');for(let i=0;i<18;i++)t.playerTick();key('keyup','KeyE');assert(t.player.position.x>7.5);assert.equal(t.mode,'play','E cannot open a menu');
 key('keydown','KeyI');assert.equal(t.activeModal,'shop');key('keydown','KeyI');assert.equal(t.mode,'play');
 t.wait(2);key('keydown','KeyX');key('keyup','KeyX');assert(t.player.health>100);assert.equal(t.profile.potions.healing,potions-1);
 // Clicks only select/inspect. Dragging moves a real copy, including swaps and chest transfers.
 reset();const a=purchaseWeapon(t.profile,'dagger').item,b=purchaseWeapon(t.profile,'broadsword').item;syncInventory(t.profile);key('keydown','KeyI');
 const nodes=()=>descendants(byId.get('shop-content')),slot=(index,container='carry')=>nodes().find(n=>n.dataset?.slot===String(index)&&n.dataset.container===container),item=id=>nodes().find(n=>n.dataset?.itemId===id);
 const original=[...t.profile.carrySlots];item(a.id).events.click[0]({});slot(15).events.click[0]({});assert.deepEqual(t.profile.carrySlots,original,'click item then empty slot does not move it');item(a.id).events.click[0]({});item(b.id).events.click[0]({});assert.deepEqual(t.profile.carrySlots,original,'clicking another occupied slot does not swap');
 const payload=new Map(),dataTransfer={setData:(k,v)=>payload.set(k,v),getData:k=>payload.get(k)};item(a.id).events.dragstart[0]({dataTransfer});slot(15).events.drop[0]({preventDefault(){},dataTransfer});assert.equal(t.profile.carrySlots[15],a.id);
 const bSlot=t.profile.carrySlots.indexOf(b.id);item(a.id).events.dragstart[0]({dataTransfer});slot(bSlot).events.drop[0]({preventDefault(){},dataTransfer});assert.equal(t.profile.carrySlots[bSlot],a.id);assert.equal(t.profile.carrySlots[15],b.id);assert.deepEqual(JSON.parse(storage.get('emberfall.profile.v2')).carrySlots,t.profile.carrySlots);
 key('keydown','KeyI');t.player.position.set(0,8,28);t.showShop('storage');item(a.id).events.click[0]({shiftKey:true});assert(t.profile.vault.some(i=>i.id===a.id));assert(!t.profile.inventory.some(i=>i.id===a.id));item(a.id).events.click[0]({shiftKey:true});assert(t.profile.inventory.some(i=>i.id===a.id));key('keydown','KeyI');
 // A physical diving roll has no upward impulse, a visible imported clip, real collision and cooldown.
 reset();t.jumpInput();for(let i=0;i<18;i++)t.playerTick();const vertical=t.player.velocity.y;t.jumpInput();assert.equal(t.player.velocity.y,vertical);assert.equal(t.player.jumps,1);assert.equal(t.playerAvatar.animator.currentAction,'Roll');const start=t.player.position.clone(),until=t.player.rollUntil;t.jumpInput();assert.equal(t.player.rollUntil,until);
 for(let i=0;i<56;i++){t.playerTick();t.updatePlayerAvatar(1/90);}assert(start.distanceTo(t.player.position)>4);assert.equal(t.player.jumps,0);assert(t.player.grounded);assert(!t.rollInput(),'cooldown rejects repeated rolling');t.wait(ROLL.cooldown);t.player.position.set(7,0,10);t.player.velocity.set(0,0,0);t.keys.add('KeyQ');key('keydown','AltLeft');assert(t.player.rollDirection.x<-.9);t.keys.clear();
 t.player.health=100;t.player.lastImpact=t.player.lastDirectHit=-Infinity;assert(t.hurtPlayer(10,null,true),'rolls do not grant invulnerability');assert(t.player.health<100);
 t.completeReturn();assert.equal(t.player.rollUntil,0);assert.equal(t.player.nextRoll,0);
 t.player.position.set(0,0,-26.75);t.setAim(0,0);assert.equal(t.rollInput(),false,'roll cannot start into the solid portal block');
 // Exact mouse-button chording and melee edge/reach behavior.
 reset();const f=t.fighters[0];f.alive=true;f.state='fight';f.guard=false;f.hp=1000;f.armor=f.helmet='none';f.position.set(7,0,7.5);f.effects={};resetMeleeState(f);
 mouse('mousedown',2);const hp=f.hp,swings=t.firstPersonSwingSequence;mouse('mousedown',0);assert(f.hp<hp,'left mouse while right is held immediately damages');assert.equal(t.firstPersonSwingSequence,swings+1);mouse('mouseup',0);mouse('mouseup',2);const immune=f.hp;mouse('mousedown',0);mouse('mouseup',0);assert.equal(f.hp,immune,'same 0.5-second immunity');
 t.wait(.51);f.position.set(7+HITBOX.radius+MELEE.aimPadding/2,0,7.5);f.lastDirectHit=-Infinity;mouse('mousedown',0);mouse('mouseup',0);assert(f.hp<immune,'tiny edge miss now connects');t.wait(.51);f.position.x=7+HITBOX.radius+MELEE.aimPadding+.04;const missed=f.hp;mouse('mousedown',0);mouse('mouseup',0);assert.equal(f.hp,missed,'clear off-crosshair attacks still miss');
 assert.equal(rayHitCandidate({x:0,y:1,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:-3.8},3.15,HITBOX.height,MELEE.aimPadding),null,'edge tolerance never increases weapon reach');
 assert.equal(rayHitCandidate({x:0,y:1,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:-(3.15+HITBOX.radius+.02)},3.15,HITBOX.height,MELEE.aimPadding),null,'padding cannot reach a body 2cm beyond range');
 // Real batched meshes: walls overlap roof eaves and support vertices cannot pierce the roof.
 const towers=MAP.objects.filter(o=>MAP.prefabs[o.prefab].visual==='tower');
 for(const tower of towers){const inverse=new T.Matrix4().compose(new T.Vector3(tower.x,tower.y??0,tower.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),tower.rotation??0),new T.Vector3(1,1,1)).invert();let wallTop=-Infinity,roofBottom=Infinity,postTop=-Infinity;
  t.world.root.traverse(o=>{if(!o.isMesh||!o.material.color)return;const color=o.material.color.getHex();if(![0x7d7378,0xa44e50,0x684934].includes(color))return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);if(Math.abs(v.x)>4.9||Math.abs(v.z)>4.9||v.y<0)continue;if(color===0x7d7378)wallTop=Math.max(wallTop,v.y);if(color===0xa44e50)roofBottom=Math.min(roofBottom,v.y);if(color===0x684934&&Math.abs(Math.abs(v.x)-2.25)<.34&&Math.abs(Math.abs(v.z)-2.25)<.34)postTop=Math.max(postTop,v.y);}});
  assert(wallTop>=roofBottom-.001,'tower wall meets roof with no air gap');assert(postTop<roofBottom,'corner supports stay below roof');
 }
 const ledge=MAP.objects.find(o=>MAP.prefabs[o.prefab].visual==='ledge'),garlands=t.world.banners.filter(b=>{const v=b.getWorldPosition(new T.Vector3());return v.y>(ledge.y??0)+10&&v.z>ledge.z-5&&v.z<ledge.z+7;});assert.equal(garlands.length,25,'twenty-five banners hang across ledge garlands');
 reset();console.log(JSON.stringify({v55:'passed',closedPortal:true,supplyOnlyCycles:20,strafeQE:true,inventoryI:true,dragOnlyRearrangement:true,physicalRoll:true,normalRollDamage:true,chordedClicks:true,reachUnchanged:true,connectedTowerRoofs:3,ledgeGarlandBanners:25}));
}
