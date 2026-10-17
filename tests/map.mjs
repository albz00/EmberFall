import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {MAP,MAP_VERSION,groundHeight,safeZone,isUnderBridge,isLava} from '../dist/shared/map.js';
import {parseMap} from '../dist/shared/map-schema.js';
import {createMapQueries,createCollision,mapColliders,stationObjects} from '../dist/shared/map-queries.js';
import {PREFAB_VISUALS} from '../dist/shared/map-schema.js';

const dist=new URL('../dist/',import.meta.url);
const raw=JSON.parse(await readFile(new URL('maps/emberfall.json',dist),'utf8'));
const issuesFor=mutate=>{const c=structuredClone(raw);mutate(c);try{parseMap(c,'emberfall.json');}catch(error){assert(error.name==='ConfigError'&&Array.isArray(error.issues),error);return error.issues;}assert.fail('invalid map was accepted');};
const expectIssue=(mutate,...fragments)=>{const issues=issuesFor(mutate);for(const fragment of fragments)assert(issues.some(i=>i.includes(fragment)),`expected an issue mentioning ${JSON.stringify(fragment)}, got:\n${issues.join('\n')}`);};

// The bundled map loads, is frozen, and has a fingerprint for client/server matching.
assert.match(MAP_VERSION,/^2-[0-9a-f]{8}$/);
assert(Object.isFrozen(MAP.lava.paths[0].points[0]));
assert.throws(()=>{MAP.prefabs.ledge.surfaces[0].height=3;},TypeError);
assert.equal(groundHeight(0,25),20);assert.equal(groundHeight(25.1,-10,5.2),5.2);assert(safeZone({x:0,y:20,z:28}));
assert(isUnderBridge({x:0,y:1,z:-10}));assert(isLava(0,34));assert(!isLava(0,0));

// Validation names the file and field.
expectIssue(c=>{c.prefabs.ledge.surfaces[0].height='8';},'maps/emberfall.json → prefabs.ledge.surfaces[0].height: must be a finite number');
expectIssue(c=>{c.schemaVersion=1;},'schemaVersion: must be 2, got 1');
expectIssue(c=>{c.prefabs.bridge.surfaces[0].wdith=4;},'prefabs.bridge.surfaces[0]: unknown field "wdith"');
expectIssue(c=>{delete c.spawns.player;},'spawns.player: is required');
expectIssue(c=>{c.lava.paths[0].points=[{x:0,z:0}];},'lava.paths[0].points: must have at least 2 entries');
expectIssue(c=>{c.prefabs.ramp.surfaces[0].rises='+z';},'prefabs.ramp needs exactly one ramp surface rising toward -z');
expectIssue(c=>{c.prefabs.bridge.surfaces[0].type='slope';},'type must be one of "flat", "ramp", got "slope"');
// Placement rules run the same queries as the game.
expectIssue(c=>{c.spawns.player={x:0,z:10};},'spawns.player (0, 10) must stand inside the safe region');
expectIssue(c=>{c.spawns.bots.width=30;},'spawns.bots corner (-15, 27) must be on the spawn ledge');
expectIssue(c=>{c.stations.chest={x:12,z:26.5};},'stations.chest (12, 26.5) must be on the spawn ledge');
expectIssue(c=>{c.navigation.destinations[0]={x:-16,z:-14};},'navigation.destinations[0] is in lava');
expectIssue(c=>{c.navigation.destinations[0]={x:0,z:-10,y:3};},'navigation.destinations[0] must sit on a walkable surface at height 3');
expectIssue(c=>{c.navigation.destinations[0]={x:40,z:0};},'navigation.destinations[0] (40, 0) is outside the arena wall');
expectIssue(c=>{c.navigation.bridgeCover[0]={x:0,z:0};},'navigation.bridgeCover[0] must be inside regions.bridgeCover');
expectIssue(c=>{c.supplyDrops[0]={x:-16,z:-14};},'supplyDrops[0] is in lava');
expectIssue(c=>{c.ledgeExit.dropZ=0;},'ledgeExit.dropZ must be off the front of the spawn ledge');
expectIssue(c=>{c.ledgeExit.approachZ=-8.2;},'ledgeExit.approachZ must be on the spawn ledge');
// Prefabs and objects.
const obj=(c,id)=>c.objects.find(o=>o.id===id);
expectIssue(c=>{c.prefabs.tower.visual='castle';},'prefabs.tower.visual: must be one of');
expectIssue(c=>{obj(c,'portal').prefab='gate';},'objects[13].prefab: "gate" is not a defined prefabs id');
expectIssue(c=>{obj(c,'boulder-east').id='boulder-west';},'objects[3]: duplicates "boulder-west"');
expectIssue(c=>{delete c.prefabs['ledge-back-rail'].colliders[0].w;},'prefabs.ledge-back-rail.colliders[0].w: is required');
expectIssue(c=>{c.prefabs.crag.colliders[0].type='cone';},'type must be one of "circle", "box", got "cone"');
expectIssue(c=>{c.prefabs.boulder.colliders[0].minY=2;},'prefabs.boulder.colliders[0].minY must be less than maxY');
expectIssue(c=>{delete c.prefabs.crate.colliders;},'prefabs.crate needs colliders or surfaces');
expectIssue(c=>{c.prefabs.tower.surfaces=[{type:'flat',w:4,d:4,height:8.5,stepUp:.5}];},'"tower-northwest" has walkable surfaces, so it cannot be rotated or scaled');
// Parented entries are offsets from their object; without the parent they are absolute and lose the ledge.
expectIssue(c=>{delete c.spawns.player.parent;},'spawns.player (0, 2.8) must stand inside the safe region');
expectIssue(c=>{c.spawns.player.parent='ledge-tower';},'spawns.player.parent: "ledge-tower" is not an object id');
expectIssue(c=>{c.spawns.player.parent='ledge-rail-back';},'spawns.player.parent: "ledge-rail-back" has a parent of its own');
expectIssue(c=>{c.stations.match.parent='tower-west';},'stations.match.parent: "tower-west" is rotated or scaled, so it cannot hold children');
expectIssue(c=>{obj(c,'ledge').parent='ledge';},'objects[34].parent: "ledge" is the entry itself');
expectIssue(c=>{obj(c,'tower-west').scale=2;},'objects[7] "tower-west" sets scale, but the tower visual cannot be scaled');
expectIssue(c=>{obj(c,'ledge-rail-back').rotation=.5;},'"ledge-rail-back" sets rotation, but the ledge-back-rail visual cannot be rotated');
expectIssue(c=>{c.prefabs.tower.colliders[0].x=1;},'"tower-northwest" is rotated, so prefab tower may only use centered colliders');
expectIssue(c=>{c.objects.push({id:'second-crag',prefab:'crag',x:5,z:5});},'the crag visual can only be placed once');
expectIssue(c=>{obj(c,'ledge-rail-back').z=2.8;},'spawns.player (0, 28) is inside the collider of objects[10] "ledge-rail-back"');
expectIssue(c=>{Object.assign(obj(c,'boulder-north'),{x:-8,z:-21});},'navigation.destinations[0] (-8, -21) is inside the collider of objects[4] "boulder-north"');
expectIssue(c=>{Object.assign(obj(c,'boulder-north'),{x:8,z:3});},'supplyDrops[1] (8, 3) is inside the collider');
expectIssue(c=>{delete obj(c,'rocks-3').variant;},'"rocks-3" needs a variant from 1 to 5');
expectIssue(c=>{obj(c,'crate-2').variant=2;},'"crate-2" sets variant, but the crate visual has none');
expectIssue(c=>{c.objects.push({id:'loose-table',prefab:'potion-table',x:0,z:0});},'"loose-table" uses the potion-table visual, which is placed through a station entry');
expectIssue(c=>{c.stations.chest.prefab='crate';},'stations.chest.prefab must use a station visual');
expectIssue(c=>{c.stations.weapons={x:-5.5,z:29.5,prefab:'station-pedestal'};},'stations.weapons (-5.5, 29.5) is inside the collider of stations.potions');
expectIssue(c=>{c.stringLights[0].to='tower-south';},'stringLights[0].to: "tower-south" is not an object id');
expectIssue(c=>{c.stringLights[1].to='crate-1';},'stringLights[1].to: "crate-1" cannot hold string lights');

// Queries are driven by the data, not a parallel copy.
const edited=structuredClone(raw);edited.prefabs.ledge.surfaces[0].height=9;edited.regions.safe.minY=8.65;edited.prefabs.bridge.surfaces[0].height=6;edited.prefabs.ramp.surfaces[0].height=6;
for(const p of edited.navigation.destinations)if(p.y!==undefined)p.y=6;
const editedMap=parseMap(edited),q=createMapQueries(editedMap);
assert.equal(q.groundHeight(0,25),21);assert.equal(q.groundHeight(0,-10),6);assert(Math.abs(q.groundHeight(25.1,-10,6)-6)<1e-9&&Math.abs(q.groundHeight(25.1,.8,6)-3)<1e-9,'ramps rise to the edited deck height');assert(!q.safeZone({x:0,y:20,z:28}));
assert(stationObjects(editedMap).every(o=>o.y===21),'stations stand on the edited ledge surface');
// Moving the ledge carries its rails, safe region, spawns, stations and exit; moving the bridge carries its cover.
const shifted=structuredClone(raw);obj(shifted,'ledge').x=-4;obj(shifted,'bridge').z=-11;
const S=parseMap(shifted),sq=createMapQueries(S);
assert.deepEqual([S.spawns.player.x,S.spawns.player.z,S.spawns.bots.x,S.stations.chest.x,S.stations.chest.z,S.ledgeExit.x,S.regions.safe.x],[-4,28,-4,2.5,26.5,-4,-4]);
assert.deepEqual(S.objects.filter(o=>o.parent==='ledge').map(o=>[o.x,o.z]),[[-13.1,25.2],[5.1,25.2],[-4,31.3],[-11.2,19],[3.2,19]]);
assert(sq.safeZone({x:-12,y:20,z:28})&&!sq.safeZone({x:6,y:20,z:28}),'the safe region follows the ledge');
assert(sq.isUnderBridge({x:0,y:1,z:-12.4})&&!sq.isUnderBridge({x:0,y:1,z:-8.6}),'bridge cover follows the bridge');
assert.deepEqual(S.navigation.bridgeCover.map(p=>p.z),Array(6).fill(-11));
assert.equal(sq.groundHeight(0,-12.5,5.2),5.2);assert.equal(sq.groundHeight(0,-8.5,5.2),0);

// One source of truth: edited JSON changes the modules the game imports.
const scratch=await mkdtemp(join(tmpdir(),'emberfall-map-'));
try{
 for(const dir of['shared','config','maps','vendor'])await cp(new URL(dir+'/',dist),join(scratch,dir),{recursive:true});
 for(const file of await readdir(dist))if(file.endsWith('.js'))await cp(new URL(file,dist),join(scratch,file));
 const moved=structuredClone(raw);Object.assign(obj(moved,'crate-1'),{x:1,z:-20});Object.assign(obj(moved,'tower-northeast'),{x:22,z:-24});obj(moved,'ramp-east').x=21;obj(moved,'bridge').z=-11;Object.assign(moved.stations.chest,{x:5,z:1.8});moved.navigation.destinations=[{x:5,z:-5}];moved.navigation.bridgeCover=[{x:-2,z:-10}];
 moved.lava.paths=[{width:2,points:[{x:-5,z:5},{x:5,z:5}]}];moved.regions.bridgeCover.maxY=4;
 Object.assign(moved.objects.find(o=>o.id==='boulder-north'),{x:15,z:-25,scale:2});moved.objects.find(o=>o.id==='portal').z=-27;
 await writeFile(join(scratch,'maps','emberfall.json'),JSON.stringify(moved));
 const ctx2d=new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:1}):k==='getImageData'?()=>({data:new Uint8ClampedArray(4)}):()=>({addColorStop(){}}),set:()=>true});
 globalThis.document??={createElement:()=>({getContext:()=>ctx2d,width:0,height:0,style:{}})};
 const load=file=>import(pathToFileURL(join(scratch,file)).href);
 const [W,E]=await Promise.all(['world.js','arena-events.js'].map(load));
 assert.deepEqual(W.lavaPaths,[{points:[[-5,5],[5,5]],width:2}]);
 assert(W.isLava(0,5)&&!W.isLava(-16,-14),'lava channels follow the map file');
 assert.deepEqual(E.DESTINATIONS,[{x:5,z:-5}]);assert.deepEqual(E.BRIDGE_COVER_POINTS,[{x:-2,y:0,z:-10}]);
 assert(E.isUnderBridge({x:0,y:3,z:-10}),'bridge cover height follows the map file');
 // Moving an object in the map moves its collider and its mesh together.
 const T=await load('vendor/three.module.js'),scene=new T.Scene(),built=W.buildWorld(scene);
 assert.equal(W.colliders.length,36,'world meshes, props and stations all collide from the map');assert.deepEqual(W.colliders[4],{type:'circle',x:15,z:-25,r:1.6,minY:-1,maxY:2.2});
 assert(W.blocked(15,-25)&&!W.blocked(9,-21),'blocking follows the moved boulder');
 assert.deepEqual(W.colliders.slice(13,15).map(c=>[c.x,c.z]),[[-3.35,-27],[3.35,-27]]);
 assert.deepEqual(W.colliders[15],{type:'box',x:1,z:-20,w:1.2,d:1.2,minY:0,maxY:1.4},'crate colliders follow their object');
 assert.deepEqual(W.colliders.at(-3),{type:'circle',x:5,z:27,r:.82,minY:20,maxY:22},'station furniture collides at the station');
 assert.deepEqual(W.colliders.at(-1),{type:'circle',x:7.6,z:22.2,r:.6,minY:20,maxY:22.2},'the merchant stand collides on the ledge');
 assert(W.colliders.some(c=>c.type==='circle'&&c.r===4.1*.36&&c.maxY===2.8),'volcano tops stay fixed while their radius scales');
 scene.updateMatrixWorld(true);
 const vertexNear=(color,x,y,z,radius)=>{let hit=false;const v=new T.Vector3();scene.traverse(o=>{if(hit||!o.isMesh||Array.isArray(o.material)||o.material.color?.getHex()!==color)return;const pos=o.geometry.attributes.position;for(let i=0;i<pos.count&&!hit;i++){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);hit=Math.hypot(v.x-x,v.y-y,v.z-z)<radius;}});return hit;};
 assert(vertexNear(0x827279,15,.9,-25,2.6)&&!vertexNear(0x827279,9,.6,-21,1.6),'the boulder mesh moved with its object');
 assert(vertexNear(0x3c3447,4,3.2,-26.35,.01)&&!vertexNear(0x3c3447,4,3.2,-29.85,.01),'the portal pillars moved with their object');
 assert(Math.abs(W.groundHeight(21,.8)-2.6)<1e-9,'the moved ramp is walkable at its new position');assert.equal(W.groundHeight(25.1,.8),0);
 assert(vertexNear(0x987352,22.9,2.55,.79,.3)&&!vertexNear(0x987352,26.9,2.55,.79,.3),'the ramp planks moved with its walkable surface');
 assert(vertexNear(0x282332,22,10.94,-24,.1)&&!vertexNear(0x282332,24,10.94,-22,.1),'string lights and roof posts follow the moved tower');
 assert(built.portal.center.equals(new T.Vector3(0,5.2,-11)),'the bridge rune lies on the moved deck');
 assert.equal(built.rockRunes.group.userData.markCount,10);
}finally{await rm(scratch,{recursive:true,force:true});}

// The shared collision, with no THREE or scene, matches the game's world module everywhere.
const DW=await import('../dist/world.js'),server=createCollision(MAP,mapColliders(MAP));
for(let x=-34;x<=34;x+=.7)for(let z=-34;z<=34;z+=.7)for(const y of [0,5.2,20]){assert.equal(server.blocked(x,z,y),DW.blocked(x,z,y));const a=server.resolveCollision({x,y,z}),b=DW.resolveCollision({x,y,z});assert(a.x===b.x&&a.z===b.z);}
for(let i=0;i<200;i++){const a={x:Math.sin(i)*30,y:0,z:Math.cos(i*1.3)*30},b={x:Math.cos(i*.7)*30,y:i%3?0:5.2,z:Math.sin(i*2.1)*30};assert.equal(server.lineBlocked(a,b),DW.lineBlocked(a,b));}

// The game reads spawns, stations, exits, supply drops and props from the map instead of repeating them.
const game=await readFile(new URL('game.js',dist),'utf8');
const {PROP_FILES}=await import('../dist/map-props.js');
const propVisuals=Object.entries(PREFAB_VISUALS).filter(([,spec])=>spec.builtBy==='model'&&!spec.station).map(([visual])=>visual);
assert.deepEqual(Object.keys(PROP_FILES).sort(),propVisuals.sort(),'map-props.js places every model prop visual');
for(const visual of propVisuals)assert(game.includes(`placeMapProps(MAP,'${visual}'`),`game.js places the ${visual} model visual from the map`);
for(const copy of['new V3(0,8,28)','position.set(0,8,28)','new V3(0,8,29.6)','new V3(-6.5,8,26.5)','27+Math.random()*3','{x:-7,z:13}','f.position.z<22.4','f.position.z<20.3','colliders.push','LEDGE.height','MAP.ledge.','[[-30,-17,2.5]','[[-14,-25,4.1]','rotation.y=i*.7'])assert(!game.includes(copy),`game.js repeats map data: ${copy}`);

console.log(JSON.stringify({result:'passed',checks:'bundled map, validation messages, placement rules, data-driven queries, single source',version:MAP_VERSION}));
