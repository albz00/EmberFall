import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectMap,parseMap} from '../dist/shared/map-schema.js';
import * as edit from '../dist/editor-model.js';

const dist=new URL('../dist/',import.meta.url);
const text=await readFile(new URL('maps/emberfall.json',dist),'utf8'),raw=JSON.parse(text),map=parseMap(raw);
const resolved=(m,key)=>edit.entryOf(parseMap(m),key);
const obj=(m,id)=>m.objects.find(o=>o.id===id);

// An unedited export is the bundled file byte for byte, and an edit changes only its own line.
assert.equal(edit.formatMap(raw),text,'formatMap writes the bundled layout');
const nudged=edit.moveTo(raw,map,'object:crate-1',obj(raw,'crate-1').x+1,obj(raw,'crate-1').z);
const diff=edit.formatMap(nudged).split('\n').filter((line,i)=>line!==text.split('\n')[i]);
assert.equal(diff.length,1,'one moved object changes one exported line');assert(diff[0].includes('"crate-1"'));

// Moves land on the 0.1 m grid at the resolved position.
const ledge=obj(map,'ledge'),moved=edit.moveTo(raw,map,'object:ledge',ledge.x-3.04,ledge.z+1.97);
assert.deepEqual([obj(moved,'ledge').x,obj(moved,'ledge').z],[ledge.x-3,ledge.z+2]);
// Moving a parent carries its children: their raw offsets stay, their resolved positions shift with it.
const M=parseMap(moved),children=raw.objects.filter(o=>o.parent==='ledge');
assert(children.length>0);
for(const c of children){assert.deepEqual(obj(moved,c.id),c,`${c.id} keeps its offset`);const before=obj(map,c.id),after=obj(M,c.id);assert.deepEqual([after.x,after.z],[edit.onGrid(before.x-3),edit.onGrid(before.z+2)]);}
for(const id of Object.keys(raw.stations).filter(id=>raw.stations[id].parent==='ledge'))assert.deepEqual([M.stations[id].x,M.stations[id].z],[edit.onGrid(map.stations[id].x-3),edit.onGrid(map.stations[id].z+2)]);
assert.deepEqual([M.spawns.player.x,M.regions.safe.x,M.ledgeExit.x],[map.spawns.player.x-3,map.regions.safe.x-3,map.ledgeExit.x-3]);
assert.deepEqual(inspectMap(moved).issues,[],'a moved ledge with its children stays valid');
// Moving a child stores the new offset from its parent.
const rail=obj(map,'ledge-rail-west'),railMoved=edit.moveTo(raw,map,'object:ledge-rail-west',rail.x-.3,rail.z);
assert.equal(obj(railMoved,'ledge-rail-west').x,obj(raw,'ledge-rail-west').x-.3);assert.equal(obj(railMoved,'ledge-rail-west').parent,'ledge');
const coverMoved=edit.moveTo(raw,map,'bridgeCover:0',map.navigation.bridgeCover[0].x+.5,map.navigation.bridgeCover[0].z);
assert.equal(coverMoved.navigation.bridgeCover[0].z,raw.navigation.bridgeCover[0].z,'a cover point keeps its offset from the bridge');

// Reparenting keeps the entry where it stands.
const detached=edit.setParent(raw,'station:chest',undefined);
assert.equal(detached.stations.chest.parent,undefined);assert.deepEqual([detached.stations.chest.x,detached.stations.chest.z],[map.stations.chest.x,map.stations.chest.z]);
const reattached=edit.setParent(detached,'station:chest','ledge');assert.deepEqual(reattached.stations.chest,raw.stations.chest);
const onBridge=edit.setParent(raw,'destinations:0','bridge');
assert.deepEqual([resolved(onBridge,'destinations:0').x,resolved(onBridge,'destinations:0').z],[map.navigation.destinations[0].x,map.navigation.destinations[0].z]);

// Renaming follows children and string lights.
const renamed=edit.renameObject(raw,'object:ledge','spawn-deck');
assert.equal(renamed.key,'object:spawn-deck');assert(renamed.raw.objects.filter(o=>o.parent==='spawn-deck').length===children.length);
assert.equal(renamed.raw.stations.chest.parent,'spawn-deck');assert.deepEqual(inspectMap(renamed.raw).issues,[]);
const lights=edit.renameObject(raw,'object:tower-northwest','tower-a').raw.stringLights;
assert(lights.some(c=>c.from==='tower-a')&&!lights.some(c=>c.from==='tower-northwest'||c.to==='tower-northwest'));

// The palette never offers station visuals or a second copy of a single-use visual.
const palette=edit.placeablePrefabs(raw);
assert(palette.includes('crate')&&palette.includes('rock-cluster')&&palette.includes('ledge'));
for(const id of ['crag','portal','station-pedestal','potion-table'])assert(!palette.includes(id),`${id} is not offered`);
const added=edit.addObject(raw,'rock-cluster',3.04,-2.96);
assert.equal(added.key,'object:rock-cluster-1');assert.deepEqual(obj(added.raw,'rock-cluster-1'),{id:'rock-cluster-1',prefab:'rock-cluster',x:3,z:-3,variant:1});
assert.equal(edit.addObject(raw,'crate',0,0).key,`object:crate-${raw.objects.filter(o=>o.prefab==='crate').length+1}`);
const point=edit.addPoint(raw,'supplyDrops',4,4);assert.equal(point.key,`supplyDrops:${raw.supplyDrops.length}`);
assert.deepEqual(inspectMap(added.raw).issues,[],'a placed rock is valid');

// Removing an object leaves its children where they stand and drops its string lights.
const noLedge=edit.removeEntry(raw,'object:ledge'),N=inspectMap(noLedge).map;
assert(N,'the map still resolves without the ledge');assert(!noLedge.objects.some(o=>o.parent==='ledge'));
for(const c of children)assert.deepEqual([obj(N,c.id).x,obj(N,c.id).z,obj(N,c.id).y],[obj(map,c.id).x,obj(map,c.id).z,obj(map,c.id).y]);
assert.deepEqual([N.stations.chest.x,N.stations.chest.z],[map.stations.chest.x,map.stations.chest.z]);
assert(!edit.removeEntry(raw,'object:tower-west').stringLights.some(c=>c.from==='tower-west'||c.to==='tower-west'));
assert.equal(edit.removeEntry(raw,'station:chest'),null,'stations are required');assert.equal(edit.removeEntry(raw,'spawn:player'),null);
const lastDrop={...raw,supplyDrops:[raw.supplyDrops[0]]};assert.equal(edit.removeEntry(lastDrop,'supplyDrops:0'),null,'lists keep one entry');
assert.equal(edit.removeEntry(raw,'supplyDrops:1').supplyDrops.length,raw.supplyDrops.length-1);

// Switching prefab drops options the new visual cannot draw.
const asTower=edit.setPrefab(raw,'object:rocks-10','tower');assert.equal(obj(asTower,'rocks-10').variant,undefined);assert.equal(obj(asTower,'rocks-10').scale,undefined);assert.equal(obj(asTower,'rocks-10').rotation,obj(raw,'rocks-10').rotation);
assert.equal(obj(edit.setPrefab(raw,'object:crate-1','rock-cluster'),'crate-1').variant,1);
assert.deepEqual(edit.entryFields(raw,'object:crate-1').map(f=>f.field),['id','prefab','parent','x','z','y','rotation']);
assert.deepEqual(edit.entryFields(raw,'spawn:bots').map(f=>f.field),['parent','x','z','width','depth']);

// Placement problems still return a drawable map, and each issue points at its entry.
const inLava=structuredClone(raw);Object.assign(inLava.supplyDrops[0],{x:raw.lava.paths[0].points[1].x,z:raw.lava.paths[0].points[1].z});
const lava=inspectMap(inLava,'draft.json');
assert(lava.map,'placement issues keep the draft drawable');assert.deepEqual(lava.issues,['maps/draft.json → supplyDrops[0] is in lava']);
assert.equal(edit.issueKey(inLava,lava.issues[0]),'supplyDrops:0');
assert.equal(edit.issueKey(raw,'maps/draft.json → objects[2] "boulder-east" sets rotation'),'object:'+raw.objects[2].id);
assert.equal(edit.issueKey(raw,'maps/draft.json → stations.chest (1, 2) is inside the collider of objects[3]'),'station:chest');
assert.equal(edit.issueKey(raw,'maps/draft.json → navigation.bridgeCover[2] must be inside regions.bridgeCover'),'bridgeCover:2');
const badField=edit.setField(raw,'object:crate-1','x',500);
assert.equal(inspectMap(badField).map,null,'a field outside its limits cannot be drawn');assert(inspectMap(badField).issues[0].includes('objects[14].x'));
const handles=edit.handlePositions(map);
assert.equal(handles.size,edit.listEntries(raw).length,'every listed entry has a handle');
assert.equal(handles.get('station:chest').y,8,'stations stand on the ledge');

// Drafts reach the game only through index.html?draft, from this browser's storage.
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
const {DRAFT_KEY}=await import('../dist/shared/map.js');
store.set(DRAFT_KEY,JSON.stringify(nudged));
globalThis.location={search:''};
const plain=await import('../dist/shared/map.js?bundled-test');
assert.equal(plain.MAP_SOURCE,'bundled');assert.equal(obj(plain.MAP,'crate-1').x,obj(raw,'crate-1').x);
globalThis.location={search:'?draft'};
const drafted=await import('../dist/shared/map.js?draft-test');
assert.equal(drafted.MAP_SOURCE,'draft');assert.equal(obj(drafted.MAP,'crate-1').x,obj(raw,'crate-1').x+1);assert.notEqual(drafted.MAP_VERSION,plain.MAP_VERSION);

// The editor draws with the game's builders and never writes to a server.
const editor=await readFile(new URL('editor.js',dist),'utf8');
assert(editor.includes('buildWorld(scene,map)')&&editor.includes('placeMapProps(map,visual,models'),'the editor draws with the game builders');
assert(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(editor),'the editor makes no network writes');
const game=await readFile(new URL('game.js',dist),'utf8');
assert(game.includes("command==='/edit'")&&game.includes("location.href='./editor.html'"),'/edit opens the editor');

console.log(JSON.stringify({result:'passed',checks:'export layout, parented moves, reparenting, palette, removal, issue targets, draft loading'}));
