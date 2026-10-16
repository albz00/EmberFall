import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../dist/vendor/three.module.js';
import {CRYPT,DUNGEON,generateDungeon,createDungeonRun,dungeonBlocked,dungeonResolve,dungeonIsLava,nextDungeonEncounter,markDungeonKill,rollDungeonRewards,depthMultiplier,roomContains} from '../dist/dungeon.js';
import {parseDungeonData} from '../dist/shared/dungeon-data.js';
import {planDungeonSpell,spellPhase,waveHitsPlayer} from '../dist/dungeon-magic.js';
import {buildDungeon} from '../dist/dungeon-world.js';
import {WEAPONS,ARMORS,SHOP_WEAPONS,makeProfile,weaponStats,purchaseWeapon,purchaseArmor,addInventoryItem,takeDeathItems,transferItem,equipInventoryItem} from '../dist/progression.js';
const rawMap=JSON.parse(await readFile(new URL('../dist/maps/ashen-crypt.json',import.meta.url))),rawTuning=JSON.parse(await readFile(new URL('../dist/config/dungeon.json',import.meta.url)));
const invalid=(change,fragment)=>{const m=structuredClone(rawMap),t=structuredClone(rawTuning);change(m,t);assert.throws(()=>parseDungeonData(m,t),e=>e.name==='ConfigError'&&e.message.includes(fragment));};
invalid(m=>m.generation.spacing=20,'spacing');invalid(m=>m.origin.x=0,'origin');invalid(m=>m.templates.forge.packs[0][0]='missing','unknown mob');invalid((m,t)=>t.boss.summonType='warden','summonType');invalid((m,t)=>t.rewards.weapons=['classic'],'dungeon-only');invalid((m,t)=>t.spells['ember-fan'].speed=0,'fan speed');invalid((m,t)=>t.mobs.caster.character='missing','unknown character');
assert.deepEqual(generateDungeon(123),generateDungeon(123));assert.notDeepEqual(generateDungeon(123),generateDungeon(124));assert(depthMultiplier('health',4)>1);assert(depthMultiplier('damage',10000)<=DUNGEON.depthScaling.maximum);
let differentRoutes=new Set(),bosses=new Set();
for(let seed=1;seed<=256;seed++){
 const run=createDungeonRun(seed),l=run.layout;assert(l.rooms.length>=8&&l.rooms.length<=9);assert.equal(l.rooms.filter(r=>r.optional).length,2);assert(l.rooms.every(r=>r.x+r.w/2<-64));assert(new Set(l.rooms.map(r=>r.theme)).size>=7,'strong room variety');assert.equal(l.encounters.filter(r=>r.mobs.some(m=>DUNGEON.mobs[m.type].boss)).length,2);bosses.add(l.encounters.at(l.encounters.findIndex(r=>r.final)).mobs[0].type);differentRoutes.add(l.rooms.map(r=>r.cell.x+':'+r.cell.z).join('|'));
 for(const room of l.rooms){for(const mob of room.mobs)assert(!dungeonBlocked(mob.x,mob.z,0,.38,run)&&!dungeonIsLava(mob.x,mob.z,0,run),'safe mob placement');}
 // Every corridor is truly passable after its gate opens, including seams with cross and octagon rooms.
 for(const r of l.rooms)run.clearedRooms[r.id]=true;
 for(const c of l.corridors){const length=Math.hypot(c.end.x-c.start.x,c.end.z-c.start.z);for(let d=-1;d<=length+1;d+=.5){const f=d/length,x=c.start.x+(c.end.x-c.start.x)*f,z=c.start.z+(c.end.z-c.start.z)*f;assert(!dungeonBlocked(x,z,0,.38,run),'corridor is walkable across both door thresholds');}}
 if(seed<=24){
  const minX=Math.floor(Math.min(...l.rooms.map(r=>r.x-r.w/2))/2)*2-2,maxX=Math.max(...l.rooms.map(r=>r.x+r.w/2))+2,minZ=Math.floor(Math.min(...l.rooms.map(r=>r.z-r.d/2))/2)*2-2,maxZ=Math.max(...l.rooms.map(r=>r.z+r.d/2))+2,key=(x,z)=>x+':'+z,seen=new Set(),queue=[[l.rooms[0].x,l.rooms[0].z]];seen.add(key(...queue[0]));
  for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz]of [[2,0],[-2,0],[0,2],[0,-2]]){const xx=x+dx,zz=z+dz,k=key(xx,zz);if(xx<minX||xx>maxX||zz<minZ||zz>maxZ||seen.has(k)||dungeonBlocked(xx,zz,0,.4,run)||dungeonIsLava(xx,zz,0,run))continue;seen.add(k);queue.push([xx,zz]);}}
  for(const room of l.rooms)assert(seen.has(key(room.x,room.z)),'seed '+seed+' room '+room.id+' '+room.theme+' unreachable; visited '+seen.size);
 }
}
assert(differentRoutes.size>10);assert(bosses.has('warden')&&bosses.has('regent'));
const run=createDungeonRun(1);run.active=true;const first=run.layout.encounters[0];assert.equal(nextDungeonEncounter(run,run.layout.spawn),null);assert.equal(nextDungeonEncounter(run,first),0);run.encounter=0;run.phase='fighting';run.enemies=[{alive:false},{alive:true}];assert(!markDungeonKill(run,run.enemies[0]));run.enemies[1].alive=false;assert(markDungeonKill(run,run.enemies[1]));assert(!markDungeonKill(run,run.enemies[1]));assert(run.clearedRooms[first.id]);
const gate=run.layout.gates.find(g=>!run.clearedRooms[g.unlockRoom]);assert(dungeonBlocked(gate.x,gate.z,0,.38,run));const p={x:gate.x,y:0,z:gate.z};dungeonResolve(p,.38,run);assert(!dungeonBlocked(p.x,p.z,0,.37,run),'closed gates resolve collision');
const owner={alive:true,position:{x:first.x,z:first.z}},player={position:{x:first.x+3,y:0,z:first.z},velocity:{x:1,z:0}};run.encounter=0;
for(const id of Object.keys(DUNGEON.spells)){const s=planDungeonSpell(run,owner,id,player,10);assert.equal(spellPhase(s,10),'warning');assert.equal(spellPhase(s,s.at+.01),'active');assert.equal(spellPhase(s,s.until+.1),'finished');assert(s.targets.every(p=>roomContains(first,p.x,p.z,1)));}
const wave=planDungeonSpell(run,owner,'cinder-wave',player,20),at=wave.at+DUNGEON.spells['cinder-wave'].duration*.3;assert(waveHitsPlayer(wave,player,at));player.position.y=1.3;assert(!waveHitsPlayer(wave,player,at));
let serial=0;const items=rollDungeonRewards(prefix=>prefix+'-'+serial++,()=>0),profile=makeProfile({coins:1e6});const chestMax=weaponStats({weapon:'gemblade',rarity:'legendary',forged:true,title:'Ruinbound',rolls:{damage:7}}).damage;
for(const id of DUNGEON.rewards.weapons){assert(!SHOP_WEAPONS.includes(id));assert(!purchaseWeapon(profile,id).ok);assert(weaponStats({weapon:id,rarity:'legendary'}).damage>chestMax);}assert(!purchaseArmor(profile,DUNGEON.rewards.armor).ok);assert(ARMORS.cryptguard.reduction>ARMORS.gold.reduction);
for(const item of items)assert(addInventoryItem(profile,item).ok);assert(equipInventoryItem(profile,items[1].id).ok);assert(transferItem(profile,items[0].id,true).ok);const death=takeDeathItems(profile);assert(death.dropped.some(i=>i.id===items[1].id));assert(profile.vault.some(i=>i.id===items[0].id));
const scene=new T.Scene(),world=buildDungeon(scene),visual=createDungeonRun(1);visual.active=true;world.update(1,.01,visual,new T.Vector3(visual.layout.spawn.x,0,visual.layout.spawn.z));assert(world.root.visible);let meshes=0,vertices=0;world.root.traverse(o=>{if(!o.isMesh)return;meshes++;assert(o.geometry.attributes.position.array.every(Number.isFinite));vertices+=o.geometry.attributes.position.count;});assert(meshes<500,'static architecture is batched');assert(vertices>30000,'rooms have substantial geometry');assert(world.obstacles.length>20);world.rebuild(generateDungeon(2,2));assert.equal(world.layout.depth,2);
console.log(JSON.stringify({dungeon:'passed',seeds:256,floodFilledFloors:24,differentRoutes:differentRoutes.size,distinctBosses:bosses.size,allRoomAndDoorPaths:true,safeMobPlacement:true,seedRepeatability:true,spellWarningsAndJumpDodge:true,exclusivePhysicalLoot:true,batchedMeshes:meshes,vertices}));
