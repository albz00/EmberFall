import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {clone} from '../dist/vendor/SkeletonUtils.js';
import {makeProfile,NAMEPLATES,COSMETICS,CHARACTERS,purchaseNameplate,purchaseCosmetic,weaponStats,equippedItem} from '../dist/progression.js';
import {MAX_BOTS,botProfile} from '../dist/combat.js';
import {makeHeadLook,restoreHeadLook,bodyFacing,applyHeadLook} from '../dist/head-look.js';
import {updateCosmetic,disposeCosmetic} from '../dist/cosmetics.js';
const require=createRequire(import.meta.url);
const {loadImage}=require('@napi-rs/canvas');globalThis.self=globalThis;globalThis.createImageBitmap=async b=>loadImage(Buffer.from(await b.arrayBuffer()));
const loader=new GLTFLoader(),cache=new Map();
const load=async file=>{if(cache.has(file))return cache.get(file);const b=await readFile(new URL('../dist/assets/'+file,import.meta.url)),asset=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');cache.set(file,asset);return asset;};

const p=makeProfile({coins:20000}),stats=weaponStats(equippedItem(p));
for(const [id,plate]of Object.entries(NAMEPLATES)){
 const coins=p.coins;assert(purchaseNameplate(p,id).ok);assert.equal(p.coins,coins-plate.price);assert(purchaseNameplate(p,id).ok);assert.equal(p.coins,coins-plate.price,'no second charge');
 const reloaded=makeProfile(JSON.parse(JSON.stringify(p)));assert.equal(reloaded.nameplate,id);assert(reloaded.ownedNameplates.includes(id));
}
const poor=makeProfile({coins:10});assert(!purchaseNameplate(poor,'volt').ok);assert.equal(poor.coins,10);assert.equal(poor.nameplate,'none');
for(const id of ['unknown','__proto__','toString'])assert(!purchaseNameplate(poor,id).ok);
const sanitized=makeProfile({nameplate:'prism',ownedNameplates:['__proto__','volt','volt']});assert.equal(sanitized.nameplate,'none');assert.deepEqual(sanitized.ownedNameplates,['none','volt']);
assert.deepEqual(weaponStats(equippedItem(p)),stats);purchaseNameplate(p,'none');assert.equal(p.nameplate,'none');assert(p.ownedNameplates.includes('prism'));
const actor={root:new T.Group(),alive:true};
for(const [id,effect]of Object.entries(COSMETICS).filter(([,e])=>['flame','lightning','fusion'].includes(e.style))){
 assert(purchaseCosmetic(p,id).ok);updateCosmetic(actor,id,.3,true);const group=actor.cosmetic,animated=group.getObjectByName(effect.style==='lightning'?'lightning':'flames'),first=[...animated.instanceMatrix.array];
 const values=[];group.traverse(o=>{if(o.isInstancedMesh)values.push(...o.instanceMatrix.array);if(o.userData.ownedGeometry)values.push(...o.geometry.attributes.position.array);});assert(values.every(Number.isFinite));
 updateCosmetic(actor,id,.6,true);assert.notDeepEqual([...animated.instanceMatrix.array],first,'effect visibly changes over time');assert.strictEqual(actor.cosmetic,group,'no geometry is rebuilt every frame');
 const positions=group.getObjectByName('lightning-cores')?.geometry.attributes.position.array;if(positions)assert([...positions].every(n=>Math.abs(n)<2.8),'lightning stays around the body');
}disposeCosmetic(actor);assert.equal(actor.root.children.length,0);

const profiles=Array.from({length:MAX_BOTS},(_,i)=>botProfile(i));assert.equal(new Set(profiles.map(p=>p.name)).size,MAX_BOTS);assert(profiles.every(p=>Number.isFinite(p.cps)&&p.cps>=2.5&&p.cps<=12.8));assert(profiles.some(p=>p.cps<4)&&profiles.some(p=>p.cps>11));

let poses=0;
for(const character of Object.values(CHARACTERS)){
 const template=await load(character.file),rig=clone(template.scene),asset=character.file.startsWith('fighter-')?'quaternius-fighter-animations.glb':'quaternius-'+character.file.replace('.glb','')+'-animations.glb',animations=(await load(asset)).animations,mixer=new T.AnimationMixer(rig),look=makeHeadLook(rig);
 const head=rig.getObjectByName('Head'),chest=rig.getObjectByName('Chest');assert(head);assert(look.bones.length>0);
 // A helmet surrogate remains a child of the same moving bone used by real equipment.
 const helmet=new T.Object3D();head.add(helmet);helmet.position.y=.1;
 for(const name of ['Sword_Idle','Jog_Fwd_Loop','Crouch_Idle_Loop','Sword_Attack']){
  restoreHeadLook(look);mixer.stopAllAction();const clip=animations.find(c=>c.name===name);assert(clip);mixer.clipAction(clip).play();
  for(const [yaw,pitch]of [[.7,.5],[-.9,-.65],[1.15,1],[-1.15,-.85],[0,0]]){
   restoreHeadLook(look);mixer.setTime(clip.duration*.3);rig.rotation.y=.45;rig.updateMatrixWorld(true);
   const torso=chest.quaternion.clone(),headBefore=head.getWorldQuaternion(new T.Quaternion()),base=look.bones.map(b=>b.bone.quaternion.clone());
   applyHeadLook(rig,look,yaw+.45,pitch,.6,true);rig.updateMatrixWorld(true);rig.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
   const size=new T.Box3().setFromObject(rig,true).getSize(new T.Vector3());assert(size.toArray().every(n=>Number.isFinite(n)&&n>.1&&n<4.5),character.name+' bounded posed skin');
   assert(chest.quaternion.toArray().every((n,i)=>Math.abs(n-torso.toArray()[i])<1e-9),'head movement does not overwrite chest animation');if(Math.abs(yaw)>.3)assert(head.getWorldQuaternion(new T.Quaternion()).angleTo(headBefore)>.2,'head actually turns');
   assert(head.getWorldPosition(new T.Vector3()).distanceTo(helmet.getWorldPosition(new T.Vector3()))<.3,'head attachment stays aligned');
   restoreHeadLook(look);look.bones.forEach((b,i)=>assert(b.bone.quaternion.toArray().every((n,j)=>Math.abs(n-base[i].toArray()[j])<1e-9),'additive look resets without accumulating'));poses++;
  }
 }
 const idle=makeHeadLook(rig);idle.bodyYaw=0;const stationary={x:0,z:0};for(let i=0;i<30;i++)bodyFacing(idle,.6,stationary,1/60);assert(Math.abs(idle.bodyYaw)<1e-7,'look around without rotating torso');
 for(let i=0;i<60;i++)bodyFacing(idle,2.6,stationary,1/60);assert(idle.bodyYaw>1.5,'body follows large turns');assert(Math.abs(2.6-idle.bodyYaw)<=1.15);
 mixer.stopAllAction();mixer.uncacheRoot(rig);
}
console.log(JSON.stringify({customization:'passed',purchasesPersist:true,insufficientFunds:true,animatedAuras:6,nameplates:6,uniqueBots:32,characterLookPoses:poses,headAttachments:true,noPoseAccumulation:true}));
