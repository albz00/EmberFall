import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {KITS,DODGE,resetMeleeState} from '../dist/combat.js';
import {WEAPONS,ARMORS,POTIONS,CHARACTERS,CHEST_PRICE,makeProfile,weaponStats,purchaseWeapon,purchaseArmor,openChest} from '../dist/progression.js';
import {CONFIG} from '../dist/shared/config.js';
import {MAP} from '../dist/shared/map.js';

export async function verifyV57(t,{byId,windowEvents}){
 const key=(code,repeat=false)=>windowEvents.keydown.forEach(fn=>fn({code,repeat,preventDefault(){}}));
 const click=()=>{byId.get('game').events.mousedown.forEach(fn=>fn({button:0}));windowEvents.mouseup.forEach(fn=>fn({button:0}));};
 t.setMode('play');t.setFreecam(false,false);t.admin.god=t.admin.flying=false;Object.assign(t.profile,makeProfile());t.resetPlayer();if(t.thirdPerson)t.togglePerspective();t.player.position.set(7,0,10);t.setAim(0,0);
 for(const a of t.fighters){a.alive=false;a.respawnAt=Infinity;}
 const f=t.fighters[0],target=(hp=300)=>{f.alive=true;f.state='fight';f.root.visible=true;f.kit=KITS.vanguard;f.armor=f.helmet='none';f.guard=false;f.hp=hp;f.effects={};f.account.cosmetic='none';f.position.set(7,0,7.5);f.velocity.set(0,0,0);f.knock.set(0,0,0);f.hitFlashUntil=-Infinity;resetMeleeState(f);};
 target();t.fx.length=0;
 for(let i=0;i<4;i++){click();assert(f.alive);assert.equal(f.hp,300-60*(i+1));t.wait(.51);}
 assert(t.fx.some(p=>p.blood),'landed sword hits create red droplets');click();assert(!f.alive,'fifth starter hit defeats an unarmored Vanguard');
 target(1000);const bleeding={...weaponStats({weapon:'classic',rarity:'common'}),effects:[{type:'bleed',level:2}]};t.applyWeaponEffects(f,t.player,bleeding);const hp=f.hp;t.wait(.86);t.updateAilments(f,.86);assert(f.hp<hp);for(let i=0;i<10;i++)t.updateFX(.05);assert(t.fx.some(p=>p.blood&&p.splat),'blood leaves short-lived ground flecks');
 t.fx.length=0;t.bleedBurst(t.player,8);t.updateFX(0);assert.equal(t.fxMesh.count,0,'own blood stays out of first-person view');t.togglePerspective();t.updateFX(0);assert.equal(t.fxMesh.count,8);t.togglePerspective();
 target();t.updateAimFeedback();assert.equal(t.aimTarget,f);assert(t.aimTargetReachable&&t.aimFocus.visible);assert(byId.get('crosshair').classList.contains('target-ready'));t.updateAppearance(f,.01);let lit=0;f.rig.traverse(o=>{if(o.isMesh&&o.material.emissiveIntensity>=.14)lit++;});assert(lit>0,'hover cue reaches real character materials');
 t.setAim(1.5,0);t.updateAimFeedback();assert.equal(t.aimTarget,null);assert(!t.aimFocus.visible);t.updateAppearance(f,.01);f.rig.traverse(o=>{if(o.isMesh)assert(Number.isFinite(o.material.color.r),'material restoration remains finite');});
 t.setAim(0,0);f.position.z=1;t.updateAimFeedback();assert.equal(t.aimTarget,f);assert(!t.aimTargetReachable,'out-of-reach hover cannot claim a melee hit');
 t.player.position.set(0,0,6);f.position.set(0,0,-5);t.updateAimFeedback();assert.equal(t.aimTarget,null,'central rock occludes hover feedback');
 t.resetPlayer();t.player.position.set(7,0,10);t.setAim(0,0);const start=t.player.position.x;key('KeyQ');const end=t.player.stepUntil;for(let i=0;i<18;i++){key('KeyQ',true);t.playerTick();}assert(t.player.position.x<start-1.5);assert.equal(t.player.stepUntil,end,'holding Q does not repeat the dodge');assert(!t.stepInput(1));t.wait(DODGE.cooldown);t.keys.clear();t.player.velocity.set(0,0,0);t.player.grounded=true;key('KeyE');assert(t.player.stepDirection.x>.9,'E dodges right');
 t.completeReturn();t.player.position.copy(t.world.portal.origin).add(new T.Vector3(0,0,2));t.updateHud();assert.equal(t.dungeonInteraction().type,'disabled');key('KeyF');assert(!t.dungeon.active&&t.mode==='play');assert(!t.enterDungeon());assert(t.world.portal.active&&!t.world.portal.dungeonEnabled);assert(!t.blocked(0,-28.75,1,.1));
 t.scene.updateMatrixWorld(true);const meshes=[];t.world.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const i of [3,4]){const a=i/12*Math.PI,x=Math.cos(a)*3.35,y=3.2+Math.sin(a)*3.8,ray=new T.Raycaster(new T.Vector3(x,y,-25),new T.Vector3(0,0,-1),0,5);assert(ray.intersectObjects(meshes,false).length,'missing crown stones are restored');}
 for(const tower of MAP.objects.filter(o=>MAP.prefabs[o.prefab].visual==='tower')){
  const inverse=new T.Matrix4().compose(new T.Vector3(tower.x,tower.y??0,tower.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),tower.rotation??0),new T.Vector3(1,1,1)).invert();let roof=Infinity,deck=-Infinity;
  for(const o of meshes){const color=o.material.color?.getHex();if(![0xa44e50,0x9f7650].includes(color))continue;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse);if(Math.abs(v.x)>4.9||Math.abs(v.z)>4.9||v.y<7)continue;if(color===0xa44e50)roof=Math.min(roof,v.y);else deck=Math.max(deck,v.y);}}
  assert(Math.abs(roof-deck)<.08,'roof directly meets the top platform');
 }
 const cords=[];t.world.root.traverse(o=>{if(o.isLine&&o.material.color?.getHex()===0xc39b6b)cords.push(o);});assert.equal(cords.length,3);for(const c of cords){const p=c.geometry.attributes.position;assert(p.getY(20)<p.getY(0)-.15,'banner cords sag between thin poles');}
 console.log(JSON.stringify({v57:'passed',fiveHitStarterKO:true,bleedDropletsAndTicks:true,firstPersonBloodHidden:true,subtleAimFeedback:true,noAimThroughWalls:true,discreteDodges:true,completePortalDisabledAdmission:true,roofPlatformContact:true,saggingBannerCords:3}));
}

export async function verifyV58(t){
 const p=makeProfile({coins:100});assert(!purchaseWeapon(p,'dagger').ok);assert(!purchaseArmor(p,'leather').ok);assert(!openChest(p).ok);assert.equal(p.coins,100);
 assert.equal(WEAPONS.dagger.price,250);assert.equal(ARMORS.leather.price,300);assert.equal(CHEST_PRICE,650);assert.equal(POTIONS.healing.price,70);assert.equal(WEAPONS.god.price,1000000);
 let frames=0,maxStep=0;
 t.setMode('play');t.setFreecam(false,false);t.admin.god=true;t.keys.clear();
 for(const id of Object.keys(CHARACTERS)){
  t.profile.character=id;t.refreshEquipment();t.player.position.set(7,5,10);t.player.velocity.set(0,0,-7);t.player.grounded=false;t.admin.flying=true;t.setAim(0,0);t.playerAvatar.animUntil=0;
  const pose=t.playerAvatar.animator.pose,leg=t.playerAvatar.rig.getObjectByName('UpperLegL');let previous=null;
  for(let i=0;i<80;i++){
   if(i===35)t.player.velocity.set(0,0,7);
   t.wait(1/60);t.updatePlayerAvatar(1/60);
   assert(pose.flightBlend>0&&pose.flightBlend<=1);assert(pose.flightVelocity.toArray().every(Number.isFinite));assert(Math.abs(pose.flightHover)<=CONFIG.combat.flightPose.hoverAmount+.0001);
   if(i===0)assert(pose.flightBlend<.2,'entry blends instead of snapping');
   if(i===35)assert(pose.flightVelocity.z<0,'a reversed input does not instantly reverse the pose');
   if(previous){const step=previous.angleTo(leg.quaternion);maxStep=Math.max(maxStep,step);assert(step<.3,id+' leg pose changes smoothly');}previous=leg.quaternion.clone();frames++;
  }
  t.admin.flying=false;t.player.velocity.set(0,0,0);const before=pose.flightBlend;t.wait(1/60);t.updatePlayerAvatar(1/60);assert(pose.flightBlend>0&&pose.flightBlend<before,'exit fades instead of snapping');
  for(let i=0;i<90;i++){t.wait(1/60);t.updatePlayerAvatar(1/60);}assert(pose.flightBlend<.002);
 }
 t.admin.flying=t.admin.god=false;t.profile.character='adventurer';t.refreshEquipment();t.resetPlayer();
 console.log(JSON.stringify({v58:'passed',configuredPriceFloors:true,starterWalletCannotBuyUpgrades:true,preservedMillionCoinSword:true,flightCharacters:Object.keys(CHARACTERS).length,flightFrames:frames,maxLegStep:+maxStep.toFixed(3),filteredReversals:true,blendedEntryAndExit:true}));
}

export async function verifyV59(t,{byId,windowEvents}){
 const key=(code,repeat=false)=>windowEvents.keydown.forEach(fn=>fn({code,repeat,preventDefault(){}}));
 const all=n=>[n,...(n.children??[]).flatMap(all)];
 t.setMode('play');t.keys.clear();t.admin.god=t.admin.flying=false;Object.assign(t.profile,makeProfile({coins:10000,rating:1000000}));t.resetPlayer();t.completeReturn();
 const ledge=t.groundHeight(MAP.spawns.player.x,MAP.spawns.player.z);assert.equal(ledge,20);assert.equal(t.player.position.y,ledge);
 for(const s of t.stations)assert.equal(s.position.y,ledge,'all trading stations follow the taller platform');
 const sign=t.matchSign;assert.equal(sign.position.y,ledge,'2v2 sign follows the ledge');
 // Probe the actual merged meshes: the post reaches the crossbeam and its top meets the stone underside.
 t.scene.updateMatrixWorld(true);const timber=[],stone=[];t.world.root.traverse(o=>{if(o.isMesh){if(o.material.color?.getHex()===0x684934)timber.push(o);if(o.material.color?.getHex()===0x50454b)stone.push(o);}});
 const platform=MAP.objects.find(o=>o.id==='ledge'),z=platform.z-4.2;
 const hit=(x,y,z,dy,objects)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(0,dy,0),0,30).intersectObjects(objects,false)[0]?.point.y;
 const underside=hit(platform.x,ledge-1.3,z,1,stone),crossTop=hit(platform.x,ledge-1.2,z,-1,timber);
 assert(Math.abs(underside-crossTop)<1e-5,'crossbeam touches the platform without a gap');
 for(const x of [-8,8]){const foot=hit(platform.x+x,-1,z,1,timber),postTop=hit(platform.x+x,ledge-1.35,z,-1,timber);assert(Math.abs(foot-t.groundHeight(platform.x+x,z,0))<1e-5,'posts reach terrain');assert(postTop>=crossTop-.25,'posts overlap their supporting crossbeams');}
 const first=purchaseWeapon(t.profile,'dagger').item,second=purchaseWeapon(t.profile,'broadsword').item;t.refreshEquipment();
 byId.get('shop-modal').scrollTop=190;t.showShop('inventory');assert.equal(byId.get('shop-modal').scrollTop,0,'newly opened panels start at the top');
 const content=byId.get('shop-content'),grid=content.children[0],find=id=>all(content).find(n=>n.dataset?.itemId===id),firstNode=find(first.id),secondNode=find(second.id),rig=t.playerAvatar.rig,weapon=t.heldGroup.children[0];
 byId.get('shop-modal').scrollTop=75;firstNode.events.click[0]({});assert.strictEqual(content.children[0],grid);assert.strictEqual(find(second.id),secondNode,'selection preserves all slot nodes');assert(firstNode.classList.contains('selected'));assert.equal(byId.get('shop-modal').scrollTop,75);
 secondNode.events.click[0]({});assert(!firstNode.classList.contains('selected'));assert(secondNode.classList.contains('selected'));secondNode.events.click[0]({});assert(!secondNode.classList.contains('selected'),'repeat click clears selection');
 const {moveInventoryItem}=await import('../dist/progression.js');t.inventoryChanged(moveInventoryItem(t.profile,first.id,false,false,15));assert.strictEqual(t.playerAvatar.rig,rig,'moving unequipped gear preserves the avatar');assert.strictEqual(t.heldGroup.children[0],weapon,'moving unequipped gear preserves the held weapon');assert.equal(byId.get('shop-modal').scrollTop,75,'refresh retains scroll position');
 key('KeyI');assert.equal(t.activeModal,null);t.showShop('storage');assert.equal(t.menuContext,'chest');assert.equal(byId.get('shop-modal').scrollTop,0);key('KeyF',true);assert.equal(t.activeModal,'shop','held F cannot flicker the chest closed');key('KeyF');assert.equal(t.activeModal,null);key('KeyI');assert.equal(t.activeModal,'shop');key('KeyI',true);assert.equal(t.activeModal,'shop');key('KeyI');assert.equal(t.activeModal,null);
 t.keys.clear();t.resetPlayer();console.log(JSON.stringify({v59:'passed',ledgeHeight:ledge,stationsFollowHeight:true,supportsReachTerrainAndPlatform:true,stableInventorySelection:true,unequippedMovePreservesModels:true,repeatKeysDoNotFlicker:true}));
}
