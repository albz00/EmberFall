import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {clone} from '../dist/vendor/SkeletonUtils.js';
import {Ragdolls,restoreImpactPose,applyImpactPose,triggerImpact} from '../dist/impact-motion.js';
import {HEAVY,chargedStats} from '../dist/charged-melee.js';
import {CHARACTERS,COSMETICS,purchaseCosmetic,makeProfile,weaponStats,addInventoryItem,equipInventoryItem,syncInventory,transferItem,takeDeathItems,itemName} from '../dist/progression.js';
import {createAscension,updateAscension,createChargeOrb,updateChargeOrb} from '../dist/ascension.js';
import {createPressure,updatePressureVisual,pressureMultiplier,pressureStrength} from '../dist/spiritual-pressure.js';

export async function verifyNewCombat(t,{byId,windowEvents,isolate,target}){
 const down=()=>byId.get('game').events.mousedown.forEach(fn=>fn({button:0})),up=()=>windowEvents.mouseup.forEach(fn=>fn({button:0}));
 const f=t.fighters[0];t.setMode('play');t.profile.equipped='starter';t.resetPlayer();isolate();t.admin.god=false;t.profile.cosmetic='none';t.player.grounded=true;
 target(f,7,7);f.helmet=f.armor='none';f.guard=false;f.effects={};f.root.visible=true;f.hp=5000;
 const start=f.hp;down();assert.equal(start-f.hp,60,'light sword hit happens on mouse down');up();assert.equal(start-f.hp,60,'quick release does not add damage');
 t.wait(.6);down();const afterLight=f.hp;t.wait(HEAVY.full);t.updateWeapon(.01);assert.equal(f.hp,afterLight,'holding never auto-attacks');assert(byId.get('bow-charge').classList.contains('charged'));
 const lightKnock=f.knock.length();up();assert.equal(afterLight-f.hp,144,'full charge deals rounded 2.4x sword damage');assert(f.knock.length()>lightKnock,'heavy strike adds knockback');assert(f.impactReaction,'hard hit starts procedural recoil');assert(Math.abs(t.meleeRecoveryUntil-t.time-1.65)<.0001);
 const afterHeavy=f.hp;down();up();t.wait(.7);down();up();assert.equal(f.hp,afterHeavy,'recovery rejects repeated click damage');t.setSlot('bow');t.setSlot('sword');down();up();assert.equal(f.hp,afterHeavy,'switching slots cannot bypass heavy recovery');t.wait(1);down();up();assert.equal(f.hp,afterHeavy-60,'quick combat resumes after recovery');
 t.wait(.6);down();t.wait(.7);const beforeCancel=f.hp;t.setSlot('bow');up();assert.equal(f.hp,beforeCancel,'switching weapons cancels charge');t.setSlot('sword');
 for(const cancel of [()=>t.openChat(),()=>t.openModal('pause'),()=>windowEvents.pointercancel.forEach(fn=>fn({}))]){
  t.setMode('play');t.cancelAttack(true);t.wait(.6);down();t.wait(.8);const hp=f.hp;cancel();up();assert.equal(f.hp,hp,'chat, pause and pointer cancellation never release a heavy attack');if(t.mode!=='play')t.setMode('play');t.closeChat(false);
 }
 t.cancelAttack(true);t.wait(2);down();t.wait(1.2);f.lastDirectHit=t.time;const immuneHP=f.hp;up();assert.equal(f.hp,immuneHP,'heavy attack respects the existing hit immunity');
 assert.equal(chargedStats(weaponStats({id:'god-test',weapon:'god',rarity:'legendary'}),1).damage,9999,'God Sword remains exactly 9999');

 // A spring reaction restores the underlying rig, and corpse snapshots work
 // across every real character hierarchy (including detached foot bones).
 t.ragdolls.clear();const sandboxScene=new T.Scene(),rags=new Ragdolls(sandboxScene,()=>0,p=>{p.x=Math.max(-8,Math.min(8,p.x));});
 let worstStretch=0;
 for(const character of Object.values(CHARACTERS)){
  const rig=clone(t.models[character.file].scene),root=new T.Group();root.position.set(0,0,0);root.add(rig);sandboxScene.add(root);
  const visual={root,rig},physical={position:root.position,velocity:new T.Vector3(1,1,-1),knock:new T.Vector3(0,4,-9),grounded:false};
  const torso=rig.getObjectByName('Torso'),before=torso.quaternion.clone();triggerImpact(physical,{position:new T.Vector3(0,0,2)},0,1.4);applyImpactPose(visual,physical,.1,.7);assert(torso.quaternion.angleTo(before)>.01);restoreImpactPose(visual);assert(torso.quaternion.angleTo(before)<.000001,'additive pose does not accumulate');
  const body=rags.spawn(visual,physical),original=body.byName.get('Body').p.clone();assert(body.points.length>=18);root.visible=false;
  for(let i=0;i<210;i++)rags.update(1/90);
  assert(body.byName.get('Body').p.distanceTo(original)>.5,'hit momentum sends the corpse tumbling');
  for(const p of body.points){assert(p.p.toArray().every(Number.isFinite));assert(p.p.y>=p.radius-.001,'ragdoll joints stay above floor');assert(p.bone.getWorldPosition(new T.Vector3()).distanceTo(p.p)<.0001,'skeleton follows physics joints');}
  for(const link of body.links)worstStretch=Math.max(worstStretch,link.a.p.distanceTo(link.b.p)/link.max);
  assert(worstStretch<1.3,'constraint solver retains anatomical lengths');
  assert(body.rig!==rig);for(let i=0;i<180;i++)rags.update(1/90);assert.equal(rags.bodies.length,0,'corpse expires and releases its private materials');root.removeFromParent();
 }
 t.cancelAttack(true);t.wait(2);target(f,7,7);f.hp=1;f.root.visible=true;t.player.position.set(7,0,10);t.setSlot('sword');down();up();assert(!f.alive&&!f.root.visible);assert(t.ragdolls.bodies.some(b=>b.actor===f),'actual death creates a ragdoll');t.wait(2.8);t.spawnFighter(f);assert(f.alive&&f.root.visible&&f.rig.visible,'respawn restores the live rig');t.ragdolls.clear();

 // Command-granted orbs are physical inventory copies and persist safely.
 t.resetPlayer();isolate();t.executeCommand('/admin on');t.profile.coins=2000000;purchaseCosmetic(t.profile,'ascension');t.executeCommand('/give chargeorb');
 const orb=t.profile.inventory.find(i=>i.id===t.profile.hotbar[t.profile.selectedHotbar]);assert.equal(orb.orb,'charge');assert.equal(itemName(orb),'Charge orb');assert.equal(t.selectedSlot,'orb');assert(t.heldOrb);
 const saved=makeProfile(JSON.parse(JSON.stringify(t.profile)));assert(saved.inventory.some(i=>i.id===orb.id&&i.orb==='charge'));assert(transferItem(saved,orb.id,true).ok);takeDeathItems(saved);assert(saved.vault.some(i=>i.id===orb.id),'stored orb survives death');assert(transferItem(saved,orb.id,false).ok);assert(takeDeathItems(saved).dropped.some(i=>i.id===orb.id),'carried orb drops on death');
 target(f,7,0);f.account.cosmetic='none';t.player.position.set(7,0,10);t.player.ascensionActive=false;down();assert(t.orbCharge.at>=0);t.wait(1);t.updateAscensionFields(1/90);const firstPull=f.knock.z;assert(firstPull>0,'field attracts an opponent instead of pushing it away');f.knock.set(0,0,0);t.wait(3);t.updateAscensionFields(1/90);assert(f.knock.z>firstPull,'attraction strengthens with charge');t.updatePlayerAvatar(.01);assert.equal(t.playerAvatar.cosmetic.userData.charge,1);assert(t.playerAvatar.cosmetic.getObjectByName('ascension-charge-orb').visible);
 up();f.knock.set(0,0,0);t.updateAscensionFields(1/90);assert(f.knock.z<0,'release immediately restores outward pressure');
 t.executeCommand('/chargeorb on');assert(t.orbCharge.latched);t.openChat();t.executeCommand('/freecam on');t.closeChat(false);assert(t.orbCharge.at>=0&&t.freecam.active,'latched charge remains on the body in free camera');t.wait(4);t.updatePlayerAvatar(.01);assert(t.playerAvatar.root.visible);assert.equal(t.playerAvatar.cosmetic.userData.charge,1);
 t.executeCommand('/chargeorb off');assert.equal(t.orbCharge.at,-1);t.executeCommand('/freecam off');t.executeCommand('/chargeorb on');t.setSlot('sword');assert.equal(t.orbCharge.at,-1,'unequipping orb releases it');t.executeCommand('/chargeorb on');assert.equal(t.orbCharge.at,-1,'cannot latch an unselected orb');
 t.selectHotbarSlot(t.profile.hotbar.indexOf(orb.id));t.duel.phase='active';t.executeCommand('/chargeorb on');down();assert.equal(t.orbCharge.at,-1,'orb admin power is unavailable in matches');t.duel.phase='idle';t.profile.cosmetic='none';down();assert.equal(t.orbCharge.at,-1,'orb requires equipped, owned Ascension');
 t.profile.cosmetic='ascension';down();assert(t.orbCharge.at>=0);t.profile.inventory=t.profile.inventory.filter(i=>i.id!==orb.id);syncInventory(t.profile);t.validateChargeOrb();assert.equal(t.orbCharge.at,-1,'losing or storing the orb cancels its field');
 const orbVisual=createChargeOrb();updateChargeOrb(orbVisual,0,0);const small=orbVisual.userData.radius;updateChargeOrb(orbVisual,3,1);assert(orbVisual.userData.radius>small*5);assert.equal(orbVisual.getObjectByName('orb-electricity').geometry.drawRange.count,384,'full charge enables more lightning');
 const asc=createAscension();for(let i=0;i<240;i++)updateAscension(asc,i/60,{charge:i/240});const pressure=createPressure();for(let i=0;i<240;i++)updatePressureVisual(pressure,i/60);
 for(const group of[asc,pressure,orbVisual])group.traverse(o=>{if(o.isInstancedMesh)assert([...o.instanceMatrix.array].every(Number.isFinite));if(o.geometry)assert([...o.geometry.attributes.position.array].every(Number.isFinite));});

 // Pressure actually modifies the shared movement rules, with no owner slow,
 // no permanent debuff, no friendly fire, and no safe-ledge spillover.
 t.profile.coins=1000000;assert(purchaseCosmetic(t.profile,'pressure').ok);assert.equal(t.profile.coins,0);assert.equal(COSMETICS.pressure.price,1000000);
 t.resetPlayer();isolate();t.admin.god=false;t.player.position.set(7,0,10);t.profile.cosmetic='pressure';target(f,7,7);const far=t.fighters[1];target(far,-26,-23);t.updatePressureFields();assert.equal(f.pressureSlow,pressureMultiplier(pressureStrength(3)));assert.equal(t.player.pressureSlow,1,'owner remains unaffected');assert.equal(far.pressureSlow,1);assert.equal(t.slowMultiplier(f),f.pressureSlow);
 f.position.set(7,t.groundHeight(7,27),27);t.updatePressureFields();assert.equal(f.pressureSlow,1,'ledge is protected');f.position.set(7,0,7);t.profile.cosmetic='none';t.updatePressureFields();assert.equal(f.pressureSlow,1,'unequip clears slow immediately');assert.equal(t.world.embers.material.uniforms.pressureRadius.value,0);
 f.account.cosmetic='pressure';f.account.ownedCosmetics=['none','pressure'];t.updatePressureFields();assert(t.player.pressureSlow<.6,'enemy pressure slows the player too');assert.equal(f.pressureSlow,1);
 t.player.effects={frost:{level:2,until:t.time+5}};t.player.slowUntil=t.time+5;assert(t.slowMultiplier(t.player)<t.player.pressureSlow,'frost still works alongside pressure');t.player.effects={};t.player.slowUntil=0;
 t.admin.god=true;t.updatePressureFields();assert.equal(t.player.pressureSlow,1);t.admin.god=false;
 t.duel.phase='active';t.player.team=f.team='blue';t.player.position.set(105,0,7);f.position.set(105,0,4);t.updatePressureFields();assert.equal(t.player.pressureSlow,1,'teammates are protected');t.player.team=f.team=null;t.duel.phase='idle';
 f.account.cosmetic='none';t.profile.cosmetic='pressure';t.player.position.set(7,0,10);t.updatePressureFields();t.updatePlayerAvatar(.01);assert(!t.playerAvatar.root.visible,'own pressure is hidden in first person');t.executeCommand('/freecam on');t.updatePlayerAvatar(.01);assert(t.playerAvatar.root.visible&&t.playerAvatar.cosmetic.visible,'free camera displays pressure around the body');t.executeCommand('/freecam off');
 const visualCount=pressure.children.length;updatePressureVisual(pressure,100);assert.equal(pressure.children.length,visualCount);updatePressureVisual(pressure,101,{alive:false});assert(!pressure.visible);
 console.log(JSON.stringify({chargedMelee:'passed',instantMouseDown:true,fullDamage:144,recovery:1.65,immunityPreserved:true,cancellation:true,ragdollCharacters:12,worstStretch:+worstStretch.toFixed(3),orbInventory:true,orbPullAndFreecam:true,spiritualPressure:true,ownerAndTeamImmunity:true,boundedVisuals:true}));
}
