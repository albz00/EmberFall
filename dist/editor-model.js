// Edits raw map JSON, where parented positions stay relative to their parent. No THREE or DOM, so tests drive it directly.
import {PREFAB_VISUALS,PLACED_FIELDS} from './shared/map-schema.js?v=68';
import {createMapQueries} from './shared/map-queries.js?v=65';

export const GRID=.1;
// Drops float noise and negative zero, so edited numbers stay as written decimals.
const tidy=v=>{const r=Math.round(v*1e6)/1e6;return r===0?0:r;};
export const onGrid=v=>tidy(Math.round(v/GRID)*GRID);

// Lists of plain positions; their entry keys are `${list}:${index}`.
export const POINT_LISTS={
 destinations:{group:'Bot destinations',label:'Destination',at:m=>m.navigation.destinations},
 bridgeCover:{group:'Bridge cover',label:'Cover point',at:m=>m.navigation.bridgeCover},
 supplyDrops:{group:'Supply drops',label:'Supply drop',at:m=>m.supplyDrops},
};
const SPAWN_LABELS={player:'Player spawn',bots:'Bot spawn strip'};

export const keyKind=key=>key.slice(0,key.indexOf(':'));
const keyId=key=>key.slice(key.indexOf(':')+1);

// The entry for a key in a raw or resolved map, which share their layout.
export function entryOf(m,key){
 const kind=keyKind(key),id=keyId(key);
 if(kind==='object')return m.objects.find(o=>o.id===id);
 if(kind==='station')return m.stations[id];
 if(kind==='spawn')return m.spawns[id];
 return POINT_LISTS[kind]?.at(m)[+id];
}

// Every editable entry in outline order; objects list their children right after them.
export function listEntries(raw){
 const ids=new Set(raw.objects.map(o=>o.id)),seen=new Set(),out=[];
 const add=o=>{if(!seen.has(o)){seen.add(o);out.push({key:'object:'+o.id,group:'Objects',label:o.id,parent:o.parent});}};
 for(const o of raw.objects)if(!ids.has(o.parent)){add(o);for(const c of raw.objects)if(c.parent===o.id)add(c);}
 for(const o of raw.objects)add(o);
 for(const [id,s]of Object.entries(raw.stations))out.push({key:'station:'+id,group:'Stations',label:id,parent:s.parent});
 for(const [id,s]of Object.entries(raw.spawns))out.push({key:'spawn:'+id,group:'Spawns',label:SPAWN_LABELS[id]??id,parent:s.parent});
 for(const [list,spec]of Object.entries(POINT_LISTS))spec.at(raw).forEach((p,i)=>out.push({key:`${list}:${i}`,group:spec.group,label:`${spec.label} ${i+1}`,parent:p.parent}));
 return out;
}

// Where each entry's handle stands in the resolved map.
export function handlePositions(map){
 const q=createMapQueries(map),out=new Map(),onGround=p=>({x:p.x,y:q.groundHeight(p.x,p.z),z:p.z});
 for(const o of map.objects)out.set('object:'+o.id,{x:o.x,y:o.y??0,z:o.z});
 for(const [id,s]of Object.entries(map.stations))out.set('station:'+id,onGround(s));
 for(const [id,s]of Object.entries(map.spawns))out.set('spawn:'+id,onGround(s));
 map.navigation.destinations.forEach((p,i)=>out.set('destinations:'+i,{x:p.x,y:p.y??0,z:p.z}));
 map.navigation.bridgeCover.forEach((p,i)=>out.set('bridgeCover:'+i,{x:p.x,y:0,z:p.z}));
 map.supplyDrops.forEach((p,i)=>out.set('supplyDrops:'+i,onGround(p)));
 return out;
}

// The inspector fields an entry has. Positions are relative to the parent when it has one.
export function entryFields(raw,key){
 const kind=keyKind(key),entry=entryOf(raw,key),pos={type:'number',step:GRID};
 const parents=['',...raw.objects.filter(o=>o.parent===undefined&&o!==entry).map(o=>o.id)];
 const fields=[{field:'parent',label:'Parent',type:'select',options:parents}];
 if(kind==='object'){
  const visual=PREFAB_VISUALS[raw.prefabs[entry.prefab]?.visual]??{};
  fields.unshift({field:'id',label:'Id',type:'text'},{field:'prefab',label:'Prefab',type:'select',options:Object.keys(raw.prefabs).filter(id=>!PREFAB_VISUALS[raw.prefabs[id].visual]?.station)});
  fields.push({field:'x',label:'X',...pos},{field:'z',label:'Z',...pos},{field:'y',label:'Y',...pos,optional:true});
  if(visual.rotation)fields.push({field:'rotation',label:'Rotation (rad)',type:'number',step:.05,optional:true});
  if(visual.scale)fields.push({field:'scale',label:'Scale',type:'number',step:.05,optional:true});
  if(visual.variants)fields.push({field:'variant',label:'Variant',type:'select',options:Array.from({length:visual.variants},(_,i)=>i+1)});
  return fields;
 }
 fields.push({field:'x',label:'X',...pos},{field:'z',label:'Z',...pos});
 if(key==='spawn:bots')fields.push({field:'width',label:'Width',...pos},{field:'depth',label:'Depth',...pos});
 if(kind==='destinations')fields.push({field:'y',label:'Y',...pos,optional:true});
 return fields;
}

// Sets one raw field; undefined removes an optional one.
export function setField(raw,key,field,value){
 const next=structuredClone(raw),entry=entryOf(next,key);
 if(value===undefined)delete entry[field];else entry[field]=typeof value==='number'?tidy(value):value;
 return next;
}

// Switches an object's prefab and drops placement options the new visual does not draw.
export function setPrefab(raw,key,prefab){
 const next=setField(raw,key,'prefab',prefab),o=entryOf(next,key),visual=PREFAB_VISUALS[next.prefabs[prefab].visual];
 if(!visual.rotation)delete o.rotation;
 if(!visual.scale)delete o.scale;
 if(!visual.variants)delete o.variant;else if(!(o.variant>=1&&o.variant<=visual.variants))o.variant=1;
 return next;
}

// Moves an entry so its resolved position lands on the grid point nearest (x, z). Children are stored
// relative to it, so they move with it.
export function moveTo(raw,map,key,x,z){
 const next=structuredClone(raw),entry=entryOf(next,key),at=entryOf(map,key);
 entry.x=tidy(entry.x+onGrid(x)-at.x);entry.z=tidy(entry.z+onGrid(z)-at.z);
 return next;
}

const placedFields=(m,entry)=>{for(const [list,xs,zs,ys]of PLACED_FIELDS)if(list(m).some(([e])=>e===entry))return {xs,zs,ys};return null;};
function shift(entry,{xs,zs,ys},dx,dz,dy){
 for(const k of xs)entry[k]=tidy((entry[k]??0)+dx);
 for(const k of zs)entry[k]=tidy(entry[k]+dz);
 for(const k of ys)if(entry[k]!==undefined)entry[k]=tidy(entry[k]+dy);
}
const origin=(m,id)=>{const p=id&&m.objects.find(o=>o.id===id);return p?{x:p.x,z:p.z,y:p.y??0}:{x:0,z:0,y:0};};

// Changes an entry's parent and keeps it where it stands.
export function setParent(raw,key,parent){
 const next=structuredClone(raw),entry=entryOf(next,key),from=origin(next,entry.parent),to=origin(next,parent);
 shift(entry,placedFields(next,entry),from.x-to.x,from.z-to.z,from.y-to.y);
 if(parent)entry.parent=parent;else delete entry.parent;
 return next;
}

// Renames an object along with its children's parent links and its string lights.
export function renameObject(raw,key,id){
 const next=structuredClone(raw),old=keyId(key);
 entryOf(next,key).id=id;
 for(const [list]of PLACED_FIELDS)for(const [entry]of list(next))if(entry.parent===old)entry.parent=id;
 for(const cable of next.stringLights)for(const end of ['from','to'])if(cable[end]===old)cable[end]=id;
 return {raw:next,key:'object:'+id};
}

// Prefabs the palette offers: no station visuals, and single-use visuals only while unplaced.
export function placeablePrefabs(raw){
 return Object.entries(raw.prefabs).filter(([,p])=>{const visual=PREFAB_VISUALS[p.visual];
  return visual&&!visual.station&&!(visual.once&&raw.objects.some(o=>raw.prefabs[o.prefab]?.visual===p.visual));}).map(([id])=>id);
}

export function addObject(raw,prefab,x,z){
 const next=structuredClone(raw),ids=new Set(next.objects.map(o=>o.id));
 let n=1;while(ids.has(`${prefab}-${n}`))n++;
 const o={id:`${prefab}-${n}`,prefab,x:onGrid(x),z:onGrid(z)};
 if(PREFAB_VISUALS[next.prefabs[prefab].visual].variants)o.variant=1;
 next.objects.push(o);
 return {raw:next,key:'object:'+o.id};
}

export function addPoint(raw,list,x,z){
 const next=structuredClone(raw),points=POINT_LISTS[list].at(next);
 points.push({x:onGrid(x),z:onGrid(z)});
 return {raw:next,key:`${list}:${points.length-1}`};
}

// Stations and spawns are required, and every list keeps at least one entry.
export function canRemove(raw,key){
 const kind=keyKind(key);
 if(kind==='object')return raw.objects.length>1;
 return Boolean(POINT_LISTS[kind])&&POINT_LISTS[kind].at(raw).length>1;
}

// Removes an entry. A removed object's children stay where they stand, and its string lights go with it.
export function removeEntry(raw,key){
 if(!canRemove(raw,key))return null;
 const next=structuredClone(raw),kind=keyKind(key),id=keyId(key);
 if(kind!=='object'){POINT_LISTS[kind].at(next).splice(+id,1);return next;}
 const [o]=next.objects.splice(next.objects.findIndex(o=>o.id===id),1);
 for(const [list,xs,zs,ys]of PLACED_FIELDS)for(const [entry]of list(next))if(entry.parent===id){shift(entry,{xs,zs,ys},o.x,o.z,o.y??0);delete entry.parent;}
 next.stringLights=next.stringLights.filter(cable=>cable.from!==id&&cable.to!==id);
 return next;
}

// The entry an issue message points at, if any.
export function issueKey(raw,issue){
 const at=issue.slice(issue.indexOf(' → ')+3);let m;
 if((m=/^objects\[(\d+)\]/.exec(at)))return raw.objects[+m[1]]?'object:'+raw.objects[+m[1]].id:null;
 if((m=/^stations\.(\w+)/.exec(at)))return raw.stations[m[1]]?'station:'+m[1]:null;
 if((m=/^spawns\.(player|bots)/.exec(at)))return 'spawn:'+m[1];
 if((m=/^navigation\.(destinations|bridgeCover)\[(\d+)\]/.exec(at)))return `${m[1]}:${m[2]}`;
 if((m=/^supplyDrops\[(\d+)\]/.exec(at)))return 'supplyDrops:'+m[1];
 return null;
}

// Writes a map in the bundled file's layout: sections and lists one entry per line, so an unedited map
// exports byte for byte and an edit shows up as a one-line diff.
const EXPANDED=new Set(['lava','prefabs','stations','navigation','regions','spawns']);
const inline=v=>Array.isArray(v)?`[${v.map(inline).join(', ')}]`:v&&typeof v==='object'?`{${Object.entries(v).map(([k,x])=>`${JSON.stringify(k)}: ${inline(x)}`).join(', ')}}`:JSON.stringify(v);
export function formatMap(raw){
 const block=(lines,pad,open,close)=>lines.length?`${open}\n${lines.join(',\n')}\n${pad}${close}`:open+close;
 const list=(items,pad)=>block(items.map(x=>pad+'  '+inline(x)),pad,'[',']');
 const value=(v,pad)=>Array.isArray(v)?list(v,pad):inline(v);
 const section=(o,pad)=>block(Object.entries(o).map(([k,v])=>`${pad}  ${JSON.stringify(k)}: ${value(v,pad+'  ')}`),pad,'{','}');
 return block(Object.entries(raw).map(([k,v])=>`  ${JSON.stringify(k)}: ${EXPANDED.has(k)&&v&&typeof v==='object'&&!Array.isArray(v)?section(v,'  '):value(v,'  ')}`),'','{','}')+'\n';
}
