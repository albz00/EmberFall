import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {makeProfile,CHARACTERS} from '../dist/progression.js';
import {CONFIG} from '../dist/shared/config.js';
export async function verifyV60(t,{byId,windowEvents}){
 t.closeAll();t.setMode('play');t.keys.clear();t.setFreecam(false,false);Object.assign(t.profile,makeProfile({coins:10000}));t.resetPlayer();t.player.position.set(7,0,10);t.admin.god=t.admin.flying=false;if(t.thirdPerson)t.togglePerspective();
 for(const f of t.fighters){f.alive=false;f.respawnAt=Infinity;}
 t.player.stamina=0;t.player.exhausted=true;t.keys.add('KeyW');t.keys.add('ShiftLeft');t.playerTick();assert(!t.player.sprint.active);assert(!t.rollInput());assert(!t.stepInput(1));t.keys.clear();t.wait(2);for(let i=0;i<90;i++)t.playerTick();assert(t.player.stamina>=20);t.player.position.set(7,0,10);t.player.velocity.set(0,0,0);t.player.grounded=true;const before=t.player.stamina;assert(t.stepInput(1));assert.equal(t.player.stamina,before-CONFIG.combat.stamina.dodgeCost);t.updateHud();assert(Number(byId.get('player-stamina')['aria-valuenow'])<100);assert(byId.get('stamina-fill').style.width.endsWith('%'));
 // Instant healing and instant sword input must agree with what the player sees.
 t.resetPlayer();t.player.position.set(7,0,10);t.player.health=100;t.profile.selectedPotion='healing';const bottles=t.profile.potions.healing;t.drinkTonic();assert.equal(t.player.health,215);assert.equal(t.profile.potions.healing,bottles-1);t.updateWeapon(0);assert(t.potionHeld.visible&&!t.weaponPivot.visible);
 t.wait(.2);t.updateWeapon(.2);const head=t.playerAvatar.rig.getObjectByName('Head'),hand=t.playerAvatar.rig.getObjectByName('WristL');assert(hand.getWorldPosition(new T.Vector3()).distanceTo(head.getWorldPosition(new T.Vector3()))<.6,'third-person hand lifts the bottle toward the face');
 const swings=t.firstPersonSwingSequence;byId.get('game').events.mousedown.forEach(fn=>fn({button:0}));windowEvents.mouseup.forEach(fn=>fn({button:0}));assert.equal(t.firstPersonSwingSequence,swings+1);assert(t.weaponPivot.visible&&!t.potionHeld.visible,'attacking immediately restores the visible weapon');assert.equal(t.profile.potions.healing,bottles-1,'visual interruption does not double-consume a bottle');
 t.wait(1.2);t.player.health=100;t.drinkTonic();t.selectHotbarSlot(1);assert(!t.playerAvatar.drinking&&!t.potionHeld.visible,'slot changes end the sip pose');
 // A real KO announces the victim/reward, then clears itself. Match kills announce without extra payouts.
 t.selectHotbarSlot(0);const f=t.fighters[0];t.spawnFighter(f);f.position.set(7,0,7.5);f.state='fight';const wallet=t.profile.coins;t.killFighter(f,t.player);assert(!byId.get('ko-celebration').classList.contains('hidden'));assert.equal(byId.get('ko-name').textContent,f.name);assert(t.profile.coins>wallet);assert(byId.get('ko-reward').textContent.includes('coins'));t.wait(1.7);t.updateHud();assert(byId.get('ko-celebration').classList.contains('hidden'));
 t.completeReturn();t.openMatches();t.joinMatch();t.wait(4.1);t.updateDuel(.1);t.wait(3.1);t.updateDuel(.1);const opponent=t.duel.teams.red[0],matchWallet=t.profile.coins;t.killFighter(opponent,t.player);assert.equal(byId.get('ko-name').textContent,opponent.name);assert.equal(t.profile.coins,matchWallet);t.leaveMatch();
 // A relaxed flight idle moves all four limbs, with no duplicated lean owner or frozen arms.
 t.admin.god=t.admin.flying=true;t.profile.character='adventurer';t.refreshEquipment();t.player.position.set(7,6,10);t.player.velocity.set(0,0,0);t.player.grounded=false;t.playerAvatar.animUntil=0;const samples=[];
 for(let i=0;i<120;i++){t.wait(1/60);t.updatePlayerAvatar(1/60);if(i===40||i===119)samples.push(['UpperArmL','UpperArmR','UpperLegL','UpperLegR'].map(n=>t.playerAvatar.rig.getObjectByName(n).quaternion.clone()));}
 for(let i=0;i<4;i++)assert(samples[0][i].angleTo(samples[1][i])>.005,'flight limb '+i+' is not frozen');
 t.admin.flying=t.admin.god=false;t.resetPlayer();const settings=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8'));assert(!settings.slice(settings.indexOf('id="settings-modal"'),settings.indexOf('id="help-modal"')).includes('data-personal'));
 assert(!t.merchant.root.children.some(o=>['TorusGeometry','CylinderGeometry'].includes(o.geometry?.type)),'merchant has no purple floor ring or plinth');
 let cones=0;t.world.root.traverse(o=>{if(o.geometry?.type==='ConeGeometry'&&Math.abs(o.rotation.z-Math.PI)<.01)cones++;});assert.equal(cones,0,'floating inverted spikes removed');
 console.log(JSON.stringify({v60:'passed',staminaDrainsAndRecovers:true,instantHealingAndVisibleAttack:true,thirdPersonSipPose:true,slotCancelsSip:true,knockoutCelebration:true,matchKONoExtraRewards:true,livingFlightLimbs:4,settingsOnly:true,merchantRingRemoved:true,floatingSpikesRemoved:true,characters:Object.keys(CHARACTERS).length}));
}
