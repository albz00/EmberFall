import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {clone} from '../dist/vendor/SkeletonUtils.js';
import {makeCharacterPose,restoreCharacterPose,applyCharacterPose} from '../dist/character-pose.js';
import {KITS,MOVEMENT,movementSpeed,resetMeleeState} from '../dist/combat.js';
import {CHARACTERS,makeProfile} from '../dist/progression.js';
const V=T.Vector3,Q=T.Quaternion;
export async function verifyV24(t){
 t.setMode('play');t.setFreecam(false,false);t.admin.god=t.admin.hunt=t.admin.flying=false;t.cancelAttack(true);Object.assign(t.profile,makeProfile());t.resetPlayer();if(t.thirdPerson)t.togglePerspective();t.keys.clear();for(const f of t.fighters){f.alive=false;f.respawnAt=Infinity;}t.player.position.set(7,0,10);t.player.velocity.set(0,0,0);t.player.knock.set(0,0,0);t.player.grounded=true;t.player.health=1000;t.setAim(0,0);t.setBlock(false);
 assert.equal(KITS.vanguard.speed,(6.35+2.15)/2);assert(movementSpeed(KITS.vanguard,0,true)>6&&movementSpeed(KITS.vanguard,0,true)<6.5);
 const f=t.fighters[0];f.alive=true;f.state='fight';f.position.set(7,0,7.4);f.hp=10000;f.kit=KITS.vanguard;f.armor=f.helmet='none';f.guard=false;f.effects={};f.lastImpact=-Infinity;f.velocity.set(0,0,0);f.knock.set(0,0,0);resetMeleeState(f);
 const clicks=t.clickTimes.length,fp=t.firstPersonSwingSequence,body=t.playerAvatar.swingSequence??0;let hits=0;
 for(let i=0;i<47;i++){const hp=f.hp;t.swing();assert.equal(t.swingAge,0,'every accepted click immediately restarts the first-person swing');if(f.hp<hp)hits++;for(let n=0;n<7;n++){t.wait(1/9.4/7);t.updateWeapon(1/9.4/7);}}
 const bodySwings=(t.playerAvatar.swingSequence??0)-body;assert.equal(t.clickTimes.length-clicks,47);assert.equal(t.firstPersonSwingSequence-fp,47);assert.equal(hits,10,'classic hit immunity is unchanged');assert(bodySwings>=13&&bodySwings<=17,'third-person body completes calmer arcs independently');t.wait(.18);t.updateWeapon(.18);assert(t.swingAge>=.17);const rest=t.weaponPivot.quaternion.clone();t.swing();t.wait(.085);t.updateWeapon(.085);assert(t.weaponPivot.quaternion.angleTo(rest)>.45,'first-person slash keeps the fast, full-size arc');
 // Compare the actual imported arm poses before and after blade correction, on every rig.
 let armFrames=0;
 for(const character of Object.values(CHARACTERS)){
  const template=t.models[character.file],rig=clone(template.scene),mixer=new T.AnimationMixer(rig),pose=makeCharacterPose(),hand=rig.getObjectByName('WristR'),weapon=t.makeWeapon({id:'verify',weapon:'classic',rarity:'common'});weapon.userData.slot='sword';weapon.rotation.z=Math.PI/2;weapon.position.set(0,.07,0);hand.add(weapon);
  const arms=['UpperArmL','LowerArmL','UpperArmR','LowerArmR'].map(n=>rig.getObjectByName(n));
  for(const clipName of ['Idle_Sword','Walk','Run','Sprint']){
   mixer.stopAllAction();mixer.clipAction(template.animations.find(c=>c.name===clipName)).reset().play();
   for(let n=0;n<9;n++){
    restoreCharacterPose(pose);mixer.update(.07);const before=arms.map(b=>({q:b.quaternion.clone(),p:b.position.clone()}));rig.updateMatrixWorld(true);applyCharacterPose(rig,pose,{velocity:new V(0,0,MOVEMENT.walk)},.2,{armed:true,time:n*.07});
    arms.forEach((b,i)=>{assert(b.quaternion.toArray().every((value,n)=>Math.abs(value-before[i].q.toArray()[n])<1e-10),character.name+' retains authored '+clipName+' arm rotation');assert(b.position.distanceTo(before[i].p)<.000001,character.name+' retains authored arm placement');});
    const blade=new V(0,1,0).applyQuaternion(weapon.getWorldQuaternion(new Q()));assert(blade.y>.7&&blade.z>.1&&blade.x<-.06,'sword points away while preserving the arms');armFrames++;
   }
  }
 }
 const meshes=[];t.world.root.traverse(o=>{if(o.isMesh)meshes.push(o);});t.scene.updateMatrixWorld(true);const ray=new T.Raycaster();
 for(const x of [-1.5,0,1.5]){ray.set(new V(x,4,-29.9),new V(0,0,-1));ray.far=14;assert(ray.intersectObjects(meshes,false).length,'rock wall remains behind the broken portal');}
 for(const x of [-12,12]){ray.set(new V(x,1.5,-8.7),new V(0,0,-1));ray.far=3;assert.equal(ray.intersectObjects(meshes,false).length,0,'middle bridge piers removed');}
 for(const x of [-22,22]){ray.set(new V(x,1.5,-8.7),new V(0,0,-1));ray.far=3;assert(ray.intersectObjects(meshes,false).length,'outer bridge supports retained');}
 const p=t.world.portal;assert.equal(p.active,true);assert.equal(p.dungeonEnabled,false);assert(p.veil?.material.isShaderMaterial);assert(p.center.equals(new V(0,5.2,-10)));assert(p.runes.position.distanceTo(new V(0,5.213,-10))<.0001);const before=p.runes.quaternion.clone();p.update(500);assert(p.runes.quaternion.equals(before),'dormant bridge rune stays centered');assert(p.origin.equals(new V(0,0,-29.2)));

 assert.equal(t.world.rockRunes.group.userData.markCount,10);assert(t.world.rockRunes.samples.length>100);assert.equal(t.world.rockRunes.group.children.length,2);for(const sample of t.world.rockRunes.samples)assert(sample.surface.toArray().every(Number.isFinite)&&Math.abs(sample.normal.length()-1)<.001);
 const moon=t.world.moon;assert.equal(moon.geometry.type,'PlaneGeometry');assert(moon.material.map.isDataTexture&&moon.material.map.image.width>=768);assert(moon.material.transparent&&!moon.material.depthWrite&&!moon.material.toneMapped);assert(moon.material.map.image.data.some((n,i)=>i%4===3&&n===0),'moon texture has a genuinely transparent outer border');
 console.log(JSON.stringify({v24:'passed',walk:KITS.vanguard.speed,sprint:movementSpeed(KITS.vanguard,0,true),clicks:47,firstPersonSwings:47,bodySwings,hits,originalArmFrames:armFrames,wallRestored:true,dungeonAdmissionDisabled:true,middlePiersRemoved:true,bridgeRuneCentered:true,rockRunes:10,enchantedMoon:true}));
}
