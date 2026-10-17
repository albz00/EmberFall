import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CHARACTERS,makeProfile,purchaseWeapon,purchaseArmor,syncInventory,moveInventoryItem,addInventoryItem,transferItem,sellItem} from '../dist/progression.js';
import {rememberMaterial,restoreMaterial} from '../dist/material-state.js';
import {createChargeOrb,updateChargeOrb} from '../dist/ascension.js';
import {buildWorld,blocked,isLava,resolveCollision} from '../dist/world.js';
import {chooseSteer} from '../dist/combat.js';
const descendants=node=>[node,...(node.children??[]).flatMap(descendants)];
export async function verifyRepairs(t,{byId,isolate,target}){
 // Regression: material cloning serializes Color userData to a hex number.
 for(const hex of [0,0x5377aa,0xffcc88]){const material=rememberMaterial(new T.MeshStandardMaterial({color:hex,emissive:0x130d19,emissiveIntensity:.3})),copy=material.clone();copy.color.setHex(0xff3038);restoreMaterial(copy);assert.equal(copy.color.getHex(),hex);assert.equal(copy.emissive.getHex(),0x130d19);assert(copy.color.toArray().every(Number.isFinite));}
 t.setMode('play');t.cancelAttack(true);t.setFreecam(false,false);t.profile.cosmetic='none';t.resetPlayer();isolate();t.admin.flying=false;t.player.grounded=true;t.setCrouch(0);t.setAim(0,0);
 let animated=0;
 for(const id of Object.keys(CHARACTERS)){
  t.profile.character=id;t.refreshEquipment();const a=t.playerAvatar,leg=a.rig.getObjectByName('UpperLegL');t.player.position.set(7,0,10);t.player.velocity.set(0,0,-6);t.player.grounded=true;t.updatePlayerAvatar(1/60);let maxChange=0,initial=leg.quaternion.clone();
  for(let frame=0;frame<90;frame++){
   // Continuous rapid whole-body attacks must not freeze the lower body.
   if(frame%9===0){const action=a.animator.actions.Sword_Slash;action.reset().setLoop(T.LoopOnce,1).play();a.animator.currentAction='Sword_Slash';a.animUntil=t.time+.2;}
   t.player.position.z-=.1;t.wait(1/60);t.updatePlayerAvatar(1/60);maxChange=Math.max(maxChange,initial.angleTo(leg.quaternion));
   if(frame%15===0){const size=new T.Box3().setFromObject(a.rig,true).getSize(new T.Vector3());assert(size.toArray().every(n=>Number.isFinite(n)&&n>0&&n<4),id+' layered skin stays anatomically bounded');}
   a.root.updateMatrixWorld(true);a.rig.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();assert([...o.skeleton.boneMatrices].every(Number.isFinite));}if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.color)assert(m.color.toArray().every(Number.isFinite),'live colors finite: '+id);}});
  }
  assert(maxChange>.2,id+' legs continue through attacks');assert(a.animator.gait.phase>0,'gait advances with displacement');animated++;
  // No movement means no new gait phase, regardless of desired speed.
  const phase=a.animator.gait.phase;for(let n=0;n<20;n++){t.wait(1/60);t.updatePlayerAvatar(1/60);}assert.equal(a.animator.gait.phase,phase);
  a.animUntil=0;t.admin.flying=true;t.player.grounded=false;t.player.velocity.set(0,0,6);t.player.position.y=5;t.updatePlayerAvatar(1/60);assert.equal(a.animator.currentAction,'Idle_Sword','flight uses hover rather than jump loop');const flight=leg.quaternion.clone();assert(flight.toArray().every(Number.isFinite));
  const body=t.ragdolls.spawn(a,t.player);body.rig.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.color){assert(m.color.toArray().every(Number.isFinite));assert.equal(m.color.getHex(),m.userData.baseColor);}}});t.ragdolls.clear();t.admin.flying=false;t.player.grounded=true;
 }
 // World geometry tests use rays against the actual merged bridge mesh.
 const worldScene=new T.Scene(),w=buildWorld(worldScene);worldScene.updateMatrixWorld(true);const ray=new T.Raycaster(),solids=[];w.root.traverse(o=>{if(o.isMesh)solids.push(o);});
 for(const x of [-25.1,25.1])for(const y of [5.65,6.15]){ray.set(new T.Vector3(x,y,-7),new T.Vector3(0,0,-1));ray.far=2.3;assert.equal(ray.intersectObjects(solids,false).length,0,'ramp-to-bridge opening clear at body and rail height');}
 for(const x of [-22,-12,12,22]){ray.set(new T.Vector3(x,7,-10),new T.Vector3(0,-1,0));ray.far=3;const hit=ray.intersectObjects(solids,false)[0];assert(hit&&hit.point.y<5.21,'support never projects through planks');}
 ray.set(new T.Vector3(0,11.75,24),new T.Vector3(0,0,1));ray.far=5;assert.equal(ray.intersectObjects(solids,false).length,0,'floating log above spawn removed');assert(w.moon.position.y>40);assert.equal(w.banners.length,35);
 // Actual navigation escapes the old physical-radius/path-radius mismatch.
 const f=t.fighters[0];t.profile.cosmetic='none';t.setMode('play');t.resetPlayer();isolate();t.player.position.set(0,t.groundHeight(0,28),28);
 for(const x of [-33,33]){target(f,x,0);f.position.y=0;f.grounded=true;f.velocity.set(0,0,0);f.knock.set(0,0,0);f.plan='roam';f.planUntil=t.time+20;f.goal={x:x<0?-25:25,z:0,y:0};f.target=null;f.navigation=null;f.aiTimer=0;
  const steering=chooseSteer(f.position,f.goal,blocked,isLava,t.time,f.id);assert(Math.abs(steering.x)>.3,'edge permits inward step');for(let n=0;n<120;n++)t.tick();assert(Math.hypot(f.position.x,f.position.z)<32,'bot leaves the edge');
 }
 for(const x of [-8.6,8.6]){t.spawnFighter(f);f.shopComplete=true;f.purchase=null;f.spawnUntil=t.time;f.position.set(x,t.groundHeight(0,28),19.6);resolveCollision(f.position);for(let n=0;n<90*12&&f.state!=='fight';n++){t.wait(1/90);t.updateBotSpawn(f,1/90);}assert.equal(f.state,'fight','bot routes from ledge corner into pit');}
 // Migrate a legacy shortcut layout without deleting or duplicating any copy.
 const legacy=makeProfile({coins:5000,rating:1000000});const a=purchaseWeapon(legacy,'dagger').item,b=purchaseArmor(legacy,'gold').item;legacy.version=3;legacy.hotbar=[a.id,'starter-bow','starter-healing','starter',null,null,null,null,b.id];delete legacy.carrySlots;delete legacy.vaultSlots;
 const p=makeProfile(legacy);assert.equal(p.version,4);assert.equal(p.carrySlots[0],a.id);assert.equal(p.carrySlots[8],b.id);const originalIds=p.inventory.map(i=>i.id).sort();
 assert(moveInventoryItem(p,a.id,false,false,15).ok);assert.equal(p.hotbar[0],null);assert.equal(p.carrySlots[15],a.id);assert(moveInventoryItem(p,b.id,false,false,15).ok);assert.equal(p.carrySlots[8],a.id);assert.equal(p.carrySlots[15],b.id);
 assert(moveInventoryItem(p,b.id,false,true,17).ok);assert.equal(p.vaultSlots[17],b.id);assert.equal(p.carrySlots[15],null);const saved=makeProfile(JSON.parse(JSON.stringify(p)));assert.deepEqual(saved.carrySlots,p.carrySlots);assert.deepEqual(saved.vaultSlots,p.vaultSlots);assert.deepEqual([...saved.inventory,...saved.vault].map(i=>i.id).sort(),originalIds);
 assert(!moveInventoryItem(p,'starter',false,true,17).ok,'bound kit cannot swap into chest');assert.equal(p.vaultSlots[17],b.id);
 // Full inventories can swap across containers, without an extra free slot.
 while(p.inventory.length<20)addInventoryItem(p,{id:'filler-'+p.inventory.length,weapon:'dagger',rarity:'common'});
 assert(moveInventoryItem(p,b.id,true,false,8).ok);assert.equal(p.carrySlots[8],b.id);assert.equal(p.vaultSlots[17],a.id);assert.equal(p.inventory.length,20);assert.equal(new Set(p.carrySlots).size,20);
 const keep=p.carrySlots[18];sellItem(p,p.carrySlots[14]);assert.equal(p.carrySlots[14],null);assert.equal(p.carrySlots[18],keep,'selling does not collapse item positions');
 // Exercise the actual menus and their actual drag/drop event handlers.
 Object.assign(t.profile,makeProfile({coins:5000,rating:1000000}));const paid=purchaseWeapon(t.profile,'dagger').item;syncInventory(t.profile);t.setMode('play');t.player.position.set(0,t.groundHeight(0,28),28);t.showShop('storage');
 assert.equal(t.menuContext,'chest');assert(byId.get('shop-tabs').hidden);assert(byId.get('personal-settings').hidden);let nodes=descendants(byId.get('shop-content')),slots=nodes.filter(n=>n.dataset?.container);assert.equal(slots.filter(n=>n.dataset.container==='carry').length,20);assert.equal(slots.filter(n=>n.dataset.container==='vault').length,20);
 const itemSlots=slots.filter(n=>n.dataset.itemId);assert.equal(itemSlots.length,t.profile.inventory.length);assert.equal(new Set(itemSlots.map(n=>n.dataset.itemId)).size,itemSlots.length,'hotbar is not repeated in backpack grid');
 const src=slots.find(n=>n.dataset.itemId===paid.id),dest=slots.find(n=>n.dataset.container==='vault'&&n.dataset.slot==='12'),payload=new Map(),dataTransfer={setData:(k,v)=>payload.set(k,v),getData:k=>payload.get(k)};
 src.events.dragstart[0]({dataTransfer});dest.events.drop[0]({preventDefault(){},dataTransfer});assert.equal(t.profile.vaultSlots[12],paid.id);assert(!t.profile.inventory.some(i=>i.id===paid.id));
 nodes=descendants(byId.get('shop-content'));const stored=nodes.find(n=>n.dataset?.itemId===paid.id),bag=nodes.find(n=>n.dataset?.container==='carry'&&n.dataset.slot==='14');stored.events.dragstart[0]({dataTransfer});bag.events.drop[0]({preventDefault(){},dataTransfer});assert.equal(t.profile.carrySlots[14],paid.id);
 t.showShop('potions');assert.equal(t.menuContext,'potions');assert(byId.get('shop-tabs').hidden);for(const node of document.querySelectorAll('[data-tab]'))assert.equal(node.hidden,node.dataset.tab!=='potions');
 t.showShop('armor');assert.equal(t.menuContext,'equipment');for(const node of document.querySelectorAll('[data-tab]'))assert.equal(node.hidden,!['weapons','armor'].includes(node.dataset.tab));
 t.setMode('play');t.player.position.set(7,0,10);t.showShop('ranks');assert.equal(t.menuContext,'personal');assert(!byId.get('personal-settings').hidden);for(const node of document.querySelectorAll('[data-tab]'))assert.equal(node.hidden,!['inventory','skills','ranks','cosmetics','nameplates','emblem'].includes(node.dataset.tab));
 // Voluntary common drops are physical and recoverable; death rules stay rare+.
 const before=t.lootDrops.length;t.dropInventoryItem(paid.id);assert.equal(t.lootDrops.length,before+1);assert(!t.profile.inventory.some(i=>i.id===paid.id));const drop=t.lootDrops.at(-1);assert.equal(drop.item.rarity,'common');t.wait(1);t.player.position.copy(drop.position);assert(t.pickUpLoot(drop,t.player));assert.equal(t.profile.inventory.filter(i=>i.id===paid.id).length,1);const starterCount=t.profile.inventory.length;t.dropInventoryItem('starter');assert.equal(t.profile.inventory.length,starterCount);
 const orb=createChargeOrb();updateChargeOrb(orb,3,1);const core=orb.getObjectByName('orb-core');assert(core.material.transparent&&!core.material.depthWrite&&core.material.isShaderMaterial);assert.equal(core.material.uniforms.power.value,1);
 console.log(JSON.stringify({v22:'passed',animatedCharacters:animated,attacksKeepLegsMoving:true,stationaryGaitStops:true,flightHover:true,finiteLiveAndRagdollColors:true,clearBridgeJoins:true,supportsBelowDeck:true,edgeRecovery:true,cornerEgress:true,physicalSlots:true,preservedMigration:true,crossContainerFullSwap:true,actualDragDrop:true,contextMenus:true,commonManualDropPickup:true,transparentOrb:true}));
}
