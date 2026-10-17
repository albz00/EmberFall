import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {makeProfile,weaponStats} from '../dist/progression.js';
import {KITS,GUARD,resetMeleeState} from '../dist/combat.js';
export async function verifyV61(t,{byId,windowEvents}){
 t.closeAll();t.setMode('play');t.keys.clear();t.setFreecam(false,false);t.admin.god=t.admin.flying=false;Object.assign(t.profile,makeProfile());t.resetPlayer();t.player.position.set(7,0,10);t.setAim(0,0);if(t.thirdPerson)t.togglePerspective();
 for(const f of t.fighters){f.alive=false;f.respawnAt=Infinity;}
 const enemy=t.fighters[0];t.spawnFighter(enemy);enemy.state='fight';enemy.position.set(7,0,7.5);enemy.kit=KITS.vanguard;enemy.stats=weaponStats({weapon:'classic',rarity:'common'});enemy.guard=false;enemy.armor=enemy.helmet='none';enemy.hp=2000;resetMeleeState(enemy);
 const mouse=(type,button)=>{(type==='mousedown'?byId.get('game').events.mousedown:windowEvents.mouseup).forEach(fn=>fn({button}));};
 mouse('mousedown',2);t.player.lastDirectHit=-Infinity;const hp=t.player.health;assert(t.hurtPlayer(60,enemy));assert.equal(hp-t.player.health,25,'guard absorbs 58% of the incoming starter hit');assert(byId.get('crosshair').classList.contains('guard-impact'));
 mouse('mousedown',0);mouse('mouseup',0);assert(!t.blockHeld,'swing opens a brief guard window');t.wait(GUARD.resumeDelay+.02);t.playerTick();assert(t.blockHeld,'holding RMB restores guard without another click');t.wait(.51);t.player.lastDirectHit=-Infinity;const protectedHP=t.player.health;t.hurtPlayer(60,enemy);assert.equal(protectedHP-t.player.health,25);
 mouse('mouseup',2);t.player.lastDirectHit=-Infinity;const exposedHP=t.player.health;t.hurtPlayer(60,enemy);assert.equal(exposedHP-t.player.health,60,'releasing RMB receives normal damage');
 // Body yaw follows the cursor during movement in either perspective; idle head freedom is covered by existing tests.
 t.togglePerspective();t.setAim(2.2,0);t.player.velocity.set(-Math.sin(2.2)*4,0,-Math.cos(2.2)*4);t.updatePlayerAvatar(1/60);const delta=t.playerAvatar.rig.rotation.y-(2.2+Math.PI);assert(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<.001);t.player.velocity.set(0,0,0);t.togglePerspective();
 byId.get('toast').textContent='unchanged';enemy.alive=true;enemy.hp=1;const wallet=t.profile.coins;t.killFighter(enemy,t.player);assert(t.profile.coins>wallet);assert.equal(byId.get('toast').textContent,'unchanged','kill does not create the legacy reward toast');assert(byId.get('ko-reward').textContent.includes('coins'));t.player.streak=4;t.updateHud();assert.equal(byId.get('hud-streak').textContent,'4 streak');assert(!byId.has('streak-label'));
 // Live rendering advances a nearby rig once per visual update, not once for every physics substep.
 t.spawnFighter(enemy);enemy.position.set(7,0,7);t.setAim(0,0);t.updateCamera(0);let updates=0;const update=enemy.animator.mixer.update.bind(enemy.animator.mixer);enemy.animator.mixer.update=dt=>{updates++;return update(dt);};t.updateFighters(.011,false);assert.equal(updates,0);t.updateFighterVisuals(1/60);assert.equal(updates,1);enemy.animator.mixer.update=update;
 t.resetPlayer();console.log(JSON.stringify({v61:'passed',guardDamage:25,unguardedDamage:60,blockHitResumes:true,cursorFacingInThirdPerson:true,noDuplicateKOPopup:true,topRightStreakOnly:true,visualsIndependentFromPhysics:true}));
}
