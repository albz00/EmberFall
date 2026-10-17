// Arena map schema: field types, units, limits and placement rules for dist/maps/*.json.
// Shared by the browser, tests and a future match server.
import {ConfigError,number,integer,string,boolean,literal,oneOf,optional,array,object,record,variant,ref,parse,resolveRefs,ID} from './schema.js?v=26';
import {createMapQueries,objectColliders,stationObjects,colliderTouches,snap} from './map-queries.js?v=65';

export const MAP_SCHEMA_VERSION=2;
// Mesh builders, one per prefab visual, and the placement options each one draws. "world" visuals are
// procedural meshes built by world.js; "model" visuals are GLB models placed by game.js once they load.
// A visual that ignores scale or rotation must not be given them, or its colliders would drift from the mesh.
// anchor: string lights can hang from it. station: placed through a station entry, not as an object.
// ramp: draws the prefab's ramp surface, which must rise toward -z.
export const PREFAB_VISUALS={
 crag:{builtBy:'world',once:true},boulder:{builtBy:'world',scale:true},tower:{builtBy:'world',rotation:true,anchor:true},
 'ledge-side-rail':{builtBy:'world',anchor:true},'ledge-back-rail':{builtBy:'world'},'ledge-front-rail':{builtBy:'world'},portal:{builtBy:'world',once:true},
 crate:{builtBy:'model',rotation:true},'rock-cluster':{builtBy:'model',scale:true,rotation:true,variants:5},volcano:{builtBy:'model',scale:true},
 station:{builtBy:'model',station:true},'potion-table':{builtBy:'model',station:true},merchant:{builtBy:'model',station:true},
 'combat-mezzanine':{builtBy:'world'},'screen-wall':{builtBy:'world'},
 'combat-deck':{builtBy:'world'},'combat-stairs':{builtBy:'world',stairs:true},
 ledge:{builtBy:'world'},bridge:{builtBy:'world'},ramp:{builtBy:'world',ramp:true},
};

const coord=(description)=>number({unit:'m',min:-200,max:200,description});
const height=(description)=>number({unit:'m',min:-20,max:60,description});
const length=(description)=>number({unit:'m',above:0,max:200,description});
const point=object({x:coord('east–west position'),z:coord('north–south position')});
// parent: an object id. The entry's positions are offsets from that object, so it moves with it.
const parent=optional(string({pattern:ID,patternLabel:'an object id',description:'positions are relative to this object'}));
const centerX=optional(coord('center along x; 0 when omitted'));
const placedPoint=object({parent,x:coord('east–west position'),z:coord('north–south position')});
const groundPoint=object({parent,x:coord('east–west position'),z:coord('north–south position'),y:optional(height('surface height when not on the floor'))});

const colliderBase={x:optional(coord('offset from the object')),z:optional(coord('offset from the object')),minY:height('bottom, relative to the object; not scaled'),maxY:height('top, relative to the object; scales with it'),scaleTop:optional(boolean({description:'false keeps maxY fixed when the object is scaled'}))};
const collider=variant('type',{
 circle:object({...colliderBase,r:length('radius')}),
 ring:object({...colliderBase,r:length('outer radius'),inner:length('interior radius'),doorWidth:length('door clearance'),doorHeight:length('door clearance height')}),
 box:object({...colliderBase,w:length('width along x'),d:length('depth along z')}),
});
const surfaceBase={x:optional(coord('offset from the object')),z:optional(coord('offset from the object')),w:length('width along x'),d:length('depth along z'),
 height:height('top above the object base; for a ramp, the high end'),
 stepUp:number({unit:'m',min:0,max:3,description:'how far below the surface feet can be and still land on it'})};
const surface=variant('type',{
 flat:object(surfaceBase),
 ramp:object({...surfaceBase,rotation:optional(number({unit:'rad',min:-6.284,max:6.284,description:'rotates the slope and footprint together about its center'})),rises:oneOf(['-z','+z','-x','+x'])}),
});

export const mapSchema=object({
 schemaVersion:literal(MAP_SCHEMA_VERSION),
 id:string({pattern:ID,patternLabel:'lowercase letters, digits and dashes'}),
 name:string({maxLength:40}),
 bounds:object({
  wallRadius:length('players are held inside this distance from the center'),
  lavaRadius:length('ground beyond this distance from the center is lava'),
 }),
 lava:object({
  bedHeight:height('floor height inside a lava channel'),
  surfaceClearance:number({unit:'m',min:0,max:5,description:'feet below this height touch lava'}),
  paths:array(object({width:length('channel width'),points:array(point,{min:2})}),{min:1}),
 }),
 regions:object({
  safe:object({parent,x:centerX,halfWidth:length('half width along x'),minZ:coord('front edge'),minY:height('lowest protected feet height')}),
  bridgeCover:object({parent,x:centerX,halfLength:length('half length along x'),minZ:coord('north edge'),maxZ:coord('south edge'),minY:height('lowest covered feet height'),maxY:height('feet at or above this are not covered')}),
 }),
 spawns:object({
  player:placedPoint,
  bots:object({parent,x:coord('center of the spawn strip'),z:coord('front of the spawn strip'),width:length('strip width along x'),depth:length('strip depth along z')}),
 }),
 ledgeExit:object({
  parent,x:centerX,
  width:length('bots pick an exit lane within this width'),
  laneHalfWidth:length('a bot this close to the exit center along x has reached the exit'),
  laneZ:coord('a bot in front of this has reached the exit'),
  approachZ:coord('bots walk here before the exit'),
  jumpZ:coord('bots jump off in front of this'),
  dropZ:coord('bots aim here after jumping'),
 }),
 stations:object(Object.fromEntries(['match','weapons','chest','potions','merchant'].map(id=>[id,object({parent,x:coord('east–west position'),z:coord('north–south position'),prefab:optional(ref('prefabs'))})]))),
 navigation:object({
  destinations:array(groundPoint,{min:1}),
  bridgeCover:array(placedPoint,{min:1}),
 }),
 prefabs:record(object({visual:oneOf(Object.keys(PREFAB_VISUALS)),colliders:optional(array(collider,{min:1})),surfaces:optional(array(surface,{min:1}))}),{min:1}),
 objects:array(object({
  id:string({pattern:ID,patternLabel:'lowercase letters, digits and dashes'}),
  prefab:ref('prefabs'),parent,
  x:coord('east–west position'),z:coord('north–south position'),y:optional(height('base height')),
  rotation:optional(number({unit:'rad',min:-20,max:20,description:'turns the visual around y'})),
  scale:optional(number({unit:'×',above:0,max:20})),
  variant:optional(integer({min:1,max:20,description:'which mesh of a multi-mesh model'})),
 }),{min:1,unique:'id'}),
 stringLights:array(object({from:string({description:'object id'}),to:string({description:'object id'}),sag:number({unit:'m',min:0,max:20})})),
 supplyDrops:array(placedPoint,{min:1}),
});

// Resolves parented entries to absolute positions, rounded like surfaces so offsets give exact decimals.
// Only positions move with a parent; sizes do not. Parents are unrotated, unscaled top-level objects.
// Each row lists entries with their label, then the fields offset by the parent's x, z and y.
export const PLACED_FIELDS=[
 [m=>m.objects.map((o,i)=>[o,`objects[${i}]`]),['x'],['z'],['y']],
 [m=>Object.entries(m.stations).map(([id,s])=>[s,'stations.'+id]),['x'],['z'],[]],
 [m=>[[m.spawns.player,'spawns.player'],[m.spawns.bots,'spawns.bots']],['x'],['z'],[]],
 [m=>[[m.regions.safe,'regions.safe']],['x'],['minZ'],['minY']],
 [m=>[[m.regions.bridgeCover,'regions.bridgeCover']],['x'],['minZ','maxZ'],['minY','maxY']],
 [m=>[[m.ledgeExit,'ledgeExit']],['x'],['laneZ','approachZ','jumpZ','dropZ'],[]],
 [m=>[...m.navigation.destinations.map((p,i)=>[p,`navigation.destinations[${i}]`]),...m.navigation.bridgeCover.map((p,i)=>[p,`navigation.bridgeCover[${i}]`]),...m.supplyDrops.map((p,i)=>[p,`supplyDrops[${i}]`])],['x'],['z'],['y']],
];
function resolveParents(map,report){
 const ids=new Map(map.objects.map(o=>[o.id,o]));
 for(const entry of [map.regions.safe,map.regions.bridgeCover,map.ledgeExit])entry.x??=0;
 for(const [list,xs,zs,ys]of PLACED_FIELDS)for(const [entry,label]of list(map)){
  if(entry.parent===undefined)continue;const p=ids.get(entry.parent);
  if(!p){report(`${label}.parent: "${entry.parent}" is not an object id`);continue;}
  if(p===entry||p.parent!==undefined){report(`${label}.parent: "${entry.parent}" ${p===entry?'is the entry itself':'has a parent of its own'}`);continue;}
  if(p.rotation||(p.scale??1)!==1){report(`${label}.parent: "${entry.parent}" is rotated or scaled, so it cannot hold children`);continue;}
  const py=p.y??0;
  for(const k of xs)entry[k]=snap(p.x+entry[k]);
  for(const k of zs)entry[k]=snap(p.z+entry[k]);
  for(const k of ys)if(entry[k]!==undefined)entry[k]=snap(py+entry[k]);
 }
}

// Placement rules use the same queries as the game, so a point accepted here is valid in play.
function crossCheck(map,report){
 const q=createMapQueries(map),{bounds,regions,spawns,ledgeExit}=map,f=v=>Math.round(v*100)/100,level=(a,b)=>Math.abs(a-b)<1e-6;
 const order=(label,a,b,aName,bName)=>{if(!(a<b))report(`${label}.${aName} must be less than ${label}.${bName}`);};
 order('regions.bridgeCover',regions.bridgeCover.minZ,regions.bridgeCover.maxZ,'minZ','maxZ');order('regions.bridgeCover',regions.bridgeCover.minY,regions.bridgeCover.maxY,'minY','maxY');
 if(bounds.lavaRadius<bounds.wallRadius)report('bounds.lavaRadius must be at least bounds.wallRadius');
 // The player spawn's surface is the spawn ledge: bots, stations and the ledge exit share its height.
 const ground=p=>q.groundHeight(p.x,p.z),spawnHeight=ground(spawns.player);
 if(!q.safeZone({...spawns.player,y:spawnHeight}))report(`spawns.player (${f(spawns.player.x)}, ${f(spawns.player.z)}) must stand inside the safe region`);
 const onLedge=(label,p)=>{if(!level(ground(p),spawnHeight)||!q.safeZone({x:p.x,y:spawnHeight,z:p.z}))report(`${label} (${f(p.x)}, ${f(p.z)}) must be on the spawn ledge inside the safe region`);};
 const b=spawns.bots;for(const [x,z]of [[b.x-b.width/2,b.z],[b.x+b.width/2,b.z],[b.x-b.width/2,b.z+b.depth],[b.x+b.width/2,b.z+b.depth]])onLedge('spawns.bots corner',{x,z});
 for(const [id,p]of Object.entries(map.stations))onLedge('stations.'+id,p);
 if(!(ground({x:ledgeExit.x,z:ledgeExit.dropZ})<spawnHeight))report('ledgeExit.dropZ must be off the front of the spawn ledge');
 if(!level(ground({x:ledgeExit.x,z:ledgeExit.approachZ}),spawnHeight))report('ledgeExit.approachZ must be on the spawn ledge');
 const inside=(label,p)=>Math.hypot(p.x,p.z)<bounds.wallRadius||(report(`${label} (${f(p.x)}, ${f(p.z)}) is outside the arena wall`),false);
 map.navigation.destinations.forEach((p,i)=>{const label=`navigation.destinations[${i}]`,y=p.y??0;if(!inside(label,p))return;if(q.isLava(p.x,p.z,y))report(`${label} is in lava`);else if(!level(q.groundHeight(p.x,p.z,y),y))report(`${label} must sit on a walkable surface at height ${y}`);});
 map.navigation.bridgeCover.forEach((p,i)=>{const label=`navigation.bridgeCover[${i}]`;if(inside(label,p)&&!q.isUnderBridge({x:p.x,y:0,z:p.z}))report(`${label} must be inside regions.bridgeCover`);});
 for(const [id,prefab]of Object.entries(map.prefabs)){
  if(!prefab.colliders&&!prefab.surfaces)report(`prefabs.${id} needs colliders or surfaces`);
  prefab.colliders?.forEach((c,i)=>{if(c.type==='ring'&&(c.inner>=c.r||c.doorWidth>=c.r*2))report(`prefabs.${id}.colliders[${i}] needs inner < r and doorWidth < diameter`);if(!(c.minY<c.maxY))report(`prefabs.${id}.colliders[${i}].minY must be less than maxY`);});
  if(PREFAB_VISUALS[prefab.visual].stairs&&!(prefab.surfaces?.filter(s=>s.type==='ramp').length===1&&prefab.surfaces.find(s=>s.type==='ramp').rises==='+z'))report(`prefabs.${id} needs exactly one ramp surface rising toward +z for the ${prefab.visual} visual`);
  if(PREFAB_VISUALS[prefab.visual].ramp&&prefab.surfaces?.some(s=>s.rotation))report(`prefabs.${id} does not support rotated surfaces; use combat-stairs for diagonal flights`);
  if(PREFAB_VISUALS[prefab.visual].ramp&&!(prefab.surfaces?.filter(s=>s.type==='ramp').length===1&&prefab.surfaces.find(s=>s.type==='ramp').rises==='-z'))report(`prefabs.${id} needs exactly one ramp surface rising toward -z for the ${prefab.visual} visual`);
 }
 const placed=[];
 map.objects.forEach((o,i)=>{const label=`objects[${i}] "${o.id}"`,prefab=map.prefabs[o.prefab];
  const visual=PREFAB_VISUALS[prefab.visual];
  if(o.scale!==undefined&&!visual.scale)report(`${label} sets scale, but the ${prefab.visual} visual cannot be scaled`);
  if(o.rotation!==undefined&&!visual.rotation)report(`${label} sets rotation, but the ${prefab.visual} visual cannot be rotated`);
  if(prefab.surfaces&&(o.rotation||(o.scale??1)!==1))report(`${label} has walkable surfaces, so it cannot be rotated or scaled`);
  if(o.rotation&&prefab.colliders?.some(c=>c.x||c.z))report(`${label} is rotated, so prefab ${o.prefab} may only use centered colliders`);
  if(visual.station)report(`${label} uses the ${prefab.visual} visual, which is placed through a station entry`);
  if(visual.variants&&!(o.variant>=1&&o.variant<=visual.variants))report(`${label} needs a variant from 1 to ${visual.variants}`);
  else if(!visual.variants&&o.variant!==undefined)report(`${label} sets variant, but the ${prefab.visual} visual has none`);
  for(const c of objectColliders(map,o))placed.push({c,label});});
 for(const [id,s]of Object.entries(map.stations))if(s.prefab&&!PREFAB_VISUALS[map.prefabs[s.prefab].visual].station)report(`stations.${id}.prefab must use a station visual`);
 for(const o of stationObjects(map))for(const c of objectColliders(map,o))placed.push({c,label:o.id.replace('station-','stations.'),station:o.id});
 const ids=new Map(map.objects.map(o=>[o.id,o]));
 map.stringLights.forEach((cable,i)=>{for(const end of ['from','to']){const o=ids.get(cable[end]);if(!o)report(`stringLights[${i}].${end}: "${cable[end]}" is not an object id`);else if(!PREFAB_VISUALS[map.prefabs[o.prefab].visual].anchor)report(`stringLights[${i}].${end}: "${cable[end]}" cannot hold string lights`);}});
 for(const [name,visual]of Object.entries(PREFAB_VISUALS))if(visual.once&&map.objects.filter(o=>map.prefabs[o.prefab].visual===name).length>1)report(`the ${name} visual can only be placed once`);
 // Everything the game spawns, stops at, or picks up must be reachable, with the player's radius as clearance.
 const clear=(label,p,y,clearance=.38,own)=>{const hit=placed.find(({c,station})=>(own===undefined||station!==own)&&colliderTouches(c,p.x,p.z,y,clearance));if(hit)report(`${label} (${f(p.x)}, ${f(p.z)}) is inside the collider of ${hit.label}`);};
 clear('spawns.player',spawns.player,spawnHeight);
 // Bots spawn anywhere in the strip and are pushed out of colliders, so its edges may touch a station's clearance.
 for(const [x,z]of [[b.x-b.width/2,b.z],[b.x+b.width/2,b.z],[b.x-b.width/2,b.z+b.depth],[b.x+b.width/2,b.z+b.depth],[b.x,b.z+b.depth/2]])clear('spawns.bots',{x,z},spawnHeight,0);
 for(const [id,p]of Object.entries(map.stations))clear('stations.'+id,p,ground(p),.38,'station-'+id);
 map.navigation.destinations.forEach((p,i)=>clear(`navigation.destinations[${i}]`,p,p.y??0));
 map.navigation.bridgeCover.forEach((p,i)=>clear(`navigation.bridgeCover[${i}]`,p,0));
 map.supplyDrops.forEach((p,i)=>clear(`supplyDrops[${i}]`,p,0));
 map.supplyDrops.forEach((p,i)=>{const label=`supplyDrops[${i}]`;if(inside(label,p)&&q.isLava(p.x,p.z))report(`${label} is in lava`);});
}

// Returns every issue, plus the resolved map whenever its fields and references are valid, so the editor
// can still draw a draft that breaks a placement rule while it is being fixed.
export function inspectMap(raw,file=`${raw?.id??'map'}.json`){
 const ctx={issues:[],refs:[],file:'maps/'+file},out=parse(mapSchema,raw,'',ctx);
 resolveRefs(ctx,{prefabs:Object.keys(out?.prefabs??{})});
 const report=message=>ctx.issues.push(`maps/${file} → ${message}`);
 if(!ctx.issues.length)resolveParents(out,report);
 const drawable=!ctx.issues.length;
 if(drawable)crossCheck(out,report);
 return {map:drawable?out:null,issues:ctx.issues};
}

export function parseMap(raw,file=`${raw?.id??'map'}.json`){
 const {map,issues}=inspectMap(raw,file);
 if(issues.length)throw new ConfigError(issues);
 return map;
}

// The duel map is separate from the editable main arena; its authored terrain
// drives drawing, walkable slopes, cover and match bounds together.
const duelMeters=(min,max)=>number({unit:'m',min,max});
const duelMapSchema=object({schemaVersion:literal(1),name:string(),x:duelMeters(65,500),z:duelMeters(-500,500),halfWidth:duelMeters(10,30),halfDepth:duelMeters(15,50),duration:number({unit:'s',min:30,max:600}),spawnZ:duelMeters(5,45),cover:array(object({x:duelMeters(65,500),z:duelMeters(-500,500),w:duelMeters(.5,12),d:duelMeters(.5,15),h:duelMeters(.3,8)}),{min:1,max:40}),terraces:array(object({type:oneOf(['flat','ramp']),x:duelMeters(65,500),z:duelMeters(-500,500),w:duelMeters(1,15),d:duelMeters(1,20),height:duelMeters(.1,4),rises:oneOf(['+z','-z'])}),{max:20}),effects:object({motes:integer({unit:'particles',min:0,max:300}),runeRadius:duelMeters(1,6),crystalHeight:duelMeters(2,8)})});
export function parseDuelMap(raw){const ctx={issues:[],refs:[],file:'maps/duel-courtyard.json'},m=parse(duelMapSchema,raw,'',ctx);if(!ctx.issues.length){if(m.spawnZ>=m.halfDepth-2)ctx.issues.push('maps/duel-courtyard.json → spawnZ: must leave 2m inside the end wall');for(const c of[...m.cover,...m.terraces])if(Math.abs(c.x-m.x)+c.w/2>=m.halfWidth||Math.abs(c.z-m.z)+c.d/2>=m.halfDepth)ctx.issues.push('maps/duel-courtyard.json → terrain must fit inside the courtyard');}if(ctx.issues.length)throw new ConfigError(ctx.issues);return m;}
