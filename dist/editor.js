// Map editor: edits a draft of the arena map on the game's own world builder. Nothing is written to the server;
// the draft lives in this browser, exports as a map file, and plays through index.html?draft.
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import bundled from './maps/emberfall.json?v=67' with {type:'json'};
import {buildWorld} from './world.js?v=69';
import {objectColliders,objectSurfaces,rampSurfaceHeight,stationObjects,surfaceWorld} from './shared/map-queries.js?v=65';
import {inspectMap} from './shared/map-schema.js?v=68';
import {DRAFT_KEY} from './shared/map.js?v=68';
import {PROP_FILES,placeMapProps} from './map-props.js?v=46';
import * as model from './editor-model.js?v=68';

const $=id=>document.getElementById(id);
const canvas=$('view'),outline=$('outline'),inspector=$('inspector'),issuesBox=$('issues'),readout=$('readout'),hoverLabel=$('hover-label');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.autoClear=false;
const camera=new THREE.PerspectiveCamera(50,1,.1,400),overlay=new THREE.Scene();

const COLORS={object:0xf2cc89,station:0x7fd6c8,spawn:0x9be37f,destinations:0xc9a0ff,bridgeCover:0x7fb8ff,supplyDrops:0xff9f5a,collider:0xff8a5c,surface:0x8fe07a,region:0x7fb8ff,issue:0xff5c4d,selected:0xffffff};
const state={raw:null,map:null,drawable:false,issues:[],flagged:new Set(),handles:new Map(),labels:new Map(),selected:null,undo:[],redo:[],drag:null,layers:{colliders:true,surfaces:true,regions:true,markers:true}};
const view={target:new THREE.Vector3(0,2,2),yaw:0,pitch:1,distance:50,top:false};
let worldScene=null,world=null,props=null,builtFor=null,lastBuild=0,models=null,handleMeshes=[];
const strip=issue=>issue.slice(issue.indexOf(' → ')+3);

function toast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3200);}
function loadDraft(){try{const saved=JSON.parse(localStorage.getItem(DRAFT_KEY));if(saved&&typeof saved==='object'&&inspectMap(saved).map)return saved;}catch{}return structuredClone(bundled);}
function saveDraft(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(state.raw));}catch{toast('The draft could not be saved in this browser.');}}

// Validates the raw draft. A draft that breaks a field rule keeps drawing its last valid layout until it is fixed.
function setRaw(raw){
 state.raw=raw;const {map,issues}=inspectMap(raw,'draft.json');
 state.issues=issues;state.drawable=Boolean(map);
 if(map){state.map=map;state.handles=model.handlePositions(map);}
 state.flagged=new Set(issues.map(i=>model.issueKey(raw,i)).filter(Boolean));
 if(state.selected&&!exists(state.selected))state.selected=null;
 drawOverlays();renderPanels();
}
function exists(key){try{return Boolean(model.entryOf(state.raw,key));}catch{return false;}}
function commit(next,selected=state.selected){
 if(!next)return;const before=JSON.stringify(state.raw);if(JSON.stringify(next)===before)return select(selected);
 state.undo.push(before);if(state.undo.length>200)state.undo.shift();state.redo.length=0;state.selected=selected;setRaw(next);saveDraft();
}
function history(from,to){if(!from.length)return;to.push(JSON.stringify(state.raw));setRaw(JSON.parse(from.pop()));saveDraft();}
const undo=()=>history(state.undo,state.redo),redo=()=>history(state.redo,state.undo);

// World: rebuilt from the resolved draft with the game's builder and prop placement.
function prepareProp(m){m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return m;}
function disposeTree(o){
 if(o.userData.mapObject)return;
 o.geometry?.dispose();if(o.isLight)o.dispose?.();
 for(const m of [o.material].flat())if(m){for(const v of [...Object.values(m),...Object.values(m.uniforms??{}).map(u=>u.value)])if(v?.isTexture)v.dispose();m.dispose();}
 for(const c of o.children)disposeTree(c);
}
function rebuildWorld(){
 const map=state.map;builtFor=map;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x514954);scene.fog=new THREE.FogExp2(0x514954,.006);
 const built=buildWorld(scene,map);built.setQuality(true);
 const group=new THREE.Group();scene.add(group);
 if(models)for(const visual of Object.keys(PROP_FILES))for(const prop of placeMapProps(map,visual,models,prepareProp))group.add(prop);
 if(worldScene)disposeTree(worldScene);
 worldScene=scene;world=built;props=group;
}
const loader=new GLTFLoader();
Promise.all(Object.values(PROP_FILES).map(async file=>[file,await loader.loadAsync('./assets/'+file+'?v=12')]))
 .then(list=>{models=Object.fromEntries(list);builtFor=null;}).catch(()=>toast('Prop models could not be loaded.'));

// Overlays: colliders, walkable surfaces, regions and one handle per editable entry, drawn over the world.
function clearOverlay(){for(const o of [...overlay.children]){o.geometry?.dispose();o.material?.dispose();overlay.remove(o);}handleMeshes=[];}
function segments(points,color,opacity=.85){
 const l=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false}));
 l.renderOrder=2;overlay.add(l);
}
function ring(out,x,z,y,r){for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=(i+1)/32*Math.PI*2;out.push([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r]);}}
function rect(out,minX,maxX,minZ,maxZ,y){out.push([minX,y,minZ],[maxX,y,minZ],[maxX,y,minZ],[maxX,y,maxZ],[maxX,y,maxZ],[minX,y,maxZ],[minX,y,maxZ],[minX,y,minZ]);}
function colliderLines(c,base,color){
 const out=[],low=Math.max(c.minY,base)+.04;
 if(c.type==='ring'){for(const r of [c.inner,c.r])for(const y of [low,c.maxY])ring(out,c.x,c.z,y,r);const sin=Math.sin(c.rotation),cos=Math.cos(c.rotation);for(const side of [-1,1]){const x=c.x+sin*c.r+cos*side*c.doorWidth/2,z=c.z+cos*c.r-sin*side*c.doorWidth/2;out.push([x,low,z],[x,c.minY+c.doorHeight,z]);}}
 else if(c.type==='circle'){ring(out,c.x,c.z,low,c.r);ring(out,c.x,c.z,c.maxY,c.r);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])out.push([c.x+Math.cos(a)*c.r,low,c.z+Math.sin(a)*c.r],[c.x+Math.cos(a)*c.r,c.maxY,c.z+Math.sin(a)*c.r]);}
 else{const [x0,x1,z0,z1]=[c.x-c.w/2,c.x+c.w/2,c.z-c.d/2,c.z+c.d/2];rect(out,x0,x1,z0,z1,low);rect(out,x0,x1,z0,z1,c.maxY);for(const [x,z]of [[x0,z0],[x1,z0],[x1,z1],[x0,z1]])out.push([x,low,z],[x,c.maxY,z]);}
 segments(out,color,.75);
}
function surfaceFill(s,color){
 const corners=[[s.minX,s.minZ],[s.maxX,s.minZ],[s.maxX,s.maxZ],[s.minX,s.maxZ]].map(([x,z])=>{const p=surfaceWorld(s,x,z);return[p.x,(s.type==='flat'?s.top:rampSurfaceHeight(s,p.x,p.z))+.06,p.z];});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(corners.flat(),3));g.setIndex([0,2,1,0,3,2]);
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide}));mesh.renderOrder=1;overlay.add(mesh);
 const out=[];for(let i=0;i<4;i++)out.push(corners[i],corners[(i+1)%4]);segments(out,color,.7);
}
const handleGeometry=new THREE.SphereGeometry(1,16,10);
function drawOverlays(){
 clearOverlay();const map=state.map;if(!map)return;
 const sel=state.selected,colorFor=key=>key===sel?COLORS.selected:state.flagged.has(key)?COLORS.issue:null;
 if(state.layers.colliders){
  for(const o of map.objects)for(const c of objectColliders(map,o))colliderLines(c,o.y??0,colorFor('object:'+o.id)??COLORS.collider);
  for(const o of stationObjects(map))for(const c of objectColliders(map,o))colliderLines(c,o.y,colorFor(o.id.replace('station-','station:'))??COLORS.station);
 }
 if(state.layers.surfaces)for(const o of map.objects)for(const s of objectSurfaces(map,o))surfaceFill(s,colorFor('object:'+o.id)??COLORS.surface);
 if(state.layers.regions){
  const {safe,bridgeCover:cover}=map.regions,{bots}=map.spawns,e=map.ledgeExit,ledge=state.handles.get('spawn:player')?.y??safe.minY,out=[];
  const reach=x=>Math.sqrt(Math.max(0,map.bounds.wallRadius**2-x*x));
  out.push([safe.x-safe.halfWidth,safe.minY,safe.minZ],[safe.x+safe.halfWidth,safe.minY,safe.minZ],[safe.x-safe.halfWidth,safe.minY,safe.minZ],[safe.x-safe.halfWidth,safe.minY,reach(safe.x-safe.halfWidth)],[safe.x+safe.halfWidth,safe.minY,safe.minZ],[safe.x+safe.halfWidth,safe.minY,reach(safe.x+safe.halfWidth)]);
  rect(out,cover.x-cover.halfLength,cover.x+cover.halfLength,cover.minZ,cover.maxZ,cover.minY+.05);rect(out,cover.x-cover.halfLength,cover.x+cover.halfLength,cover.minZ,cover.maxZ,cover.maxY);
  segments(out,COLORS.region,.8);
  const strip=[];rect(strip,bots.x-bots.width/2,bots.x+bots.width/2,bots.z,bots.z+bots.depth,ledge+.08);segments(strip,colorFor('spawn:bots')??COLORS.spawn,.9);
  const exit=[];for(const z of [e.approachZ,e.jumpZ])exit.push([e.x-e.width/2,ledge+.08,z],[e.x+e.width/2,ledge+.08,z]);exit.push([e.x,ledge+.08,e.approachZ],[e.x,0.1,e.dropZ]);segments(exit,0xffd36b,.8);
 }
 for(const [key,at]of state.handles){
  const kind=model.keyKind(key);if(kind!=='object'&&!state.layers.markers)continue;
  const selected=key===sel,mesh=new THREE.Mesh(handleGeometry,new THREE.MeshBasicMaterial({color:colorFor(key)??COLORS[kind],transparent:true,opacity:selected?1:.9,depthTest:false}));
  mesh.scale.setScalar(selected?.62:.42);mesh.position.set(at.x,at.y+.55,at.z);mesh.renderOrder=3;mesh.userData.key=key;overlay.add(mesh);handleMeshes.push(mesh);
  if(selected){const out=[];ring(out,at.x,at.z,at.y+.06,1.1);segments(out,COLORS.selected,1);}
 }
}

// Panels
function renderPanels(){renderOutline();renderInspector();renderIssues();
 $('undo').disabled=!state.undo.length;$('redo').disabled=!state.redo.length;
 const play=$('play');play.disabled=state.issues.length>0;play.title=play.disabled?'Fix the issues to play this draft':'Play this draft in a local match';
 const prefabs=model.placeablePrefabs(state.raw),select=$('add-prefab'),keep=select.value;
 select.replaceChildren(...prefabs.map(id=>new Option(id,id)));if(prefabs.includes(keep))select.value=keep;
}
function renderOutline(){
 const frag=document.createDocumentFragment();let group=null;state.labels.clear();
 for(const e of model.listEntries(state.raw)){
  state.labels.set(e.key,e.label);
  if(e.group!==group){group=e.group;const g=document.createElement('div');g.className='ed-group-label';g.textContent=group;frag.append(g);}
  const b=document.createElement('button'),dot=document.createElement('i');
  b.className='ed-item'+(e.parent?' child':'')+(e.key===state.selected?' selected':'')+(state.flagged.has(e.key)?' flagged':'');b.dataset.key=e.key;
  dot.style.background='#'+COLORS[model.keyKind(e.key)].toString(16).padStart(6,'0');b.append(dot,e.label);frag.append(b);
 }
 outline.replaceChildren(frag);
 outline.querySelector('.selected')?.scrollIntoView({block:'nearest'});
}
function renderInspector(){
 const key=state.selected,focused=document.activeElement?.dataset?.field;
 if(!key){inspector.innerHTML='<p class="ed-empty">Click a marker or an entry to select it, then drag it on the 0.1 m grid. Drag empty space to orbit, right-drag to pan, scroll to zoom.</p>';return;}
 const entry=model.entryOf(state.raw,key),title=document.createElement('div'),fields=document.createElement('div'),actions=document.createElement('div');
 title.className='ed-title';title.textContent=state.labels.get(key)??key;inspector.replaceChildren(title);
 if(entry.parent){const note=document.createElement('div');note.className='ed-note';note.textContent='Position relative to '+entry.parent;inspector.append(note);}
 fields.className='ed-fields';
 for(const f of model.entryFields(state.raw,key)){
  const label=document.createElement('label'),id='field-'+f.field;label.htmlFor=id;label.textContent=f.label;let input;
  if(f.type==='select'){input=document.createElement('select');for(const value of f.options)input.add(new Option(value===''?'None':String(value),String(value)));input.value=String(entry[f.field]??'');}
  else{input=document.createElement('input');input.type=f.type;if(f.step)input.step=f.step;input.value=entry[f.field]??'';if(f.optional)input.placeholder=f.field==='scale'?'1':'0';}
  input.id=id;input.dataset.field=f.field;fields.append(label,input);
 }
 actions.className='ed-actions';
 const focus=Object.assign(document.createElement('button'),{className:'ed-button',textContent:'Focus',onclick:focusSelected});
 const remove=Object.assign(document.createElement('button'),{className:'ed-button',textContent:'Delete',onclick:removeSelected,disabled:!model.canRemove(state.raw,key)});
 actions.append(focus,remove);inspector.append(fields,actions);
 if(focused)inspector.querySelector(`[data-field="${focused}"]`)?.focus();
}
function renderIssues(){
 if(!state.issues.length){issuesBox.innerHTML='<div class="ed-ok">No issues</div>';return;}
 const head=document.createElement('div');head.className='ed-count';head.textContent=state.issues.length===1?'1 issue':state.issues.length+' issues';
 issuesBox.replaceChildren(head,...state.issues.map(issue=>{const b=document.createElement('button');b.className='ed-issue';b.textContent=strip(issue);const key=model.issueKey(state.raw,issue);if(key)b.dataset.key=key;return b;}));
}

function select(key){state.selected=key&&exists(key)?key:null;drawOverlays();renderOutline();renderInspector();}
function focusSelected(){const at=state.handles.get(state.selected);if(!at)return;view.target.set(at.x,at.y,at.z);view.distance=Math.min(view.distance,28);}
function removeSelected(){if(state.selected&&model.canRemove(state.raw,state.selected))commit(model.removeEntry(state.raw,state.selected),null);}
function nudge(dx,dz){const key=state.selected,at=state.drawable&&model.entryOf(state.map,key);if(at)commit(model.moveTo(state.raw,state.map,key,at.x+dx,at.z+dz));}
function setTop(top){view.top=top;$('view-top').setAttribute('aria-pressed',String(top));$('view-orbit').setAttribute('aria-pressed',String(!top));if(top)view.yaw=0;}

outline.addEventListener('click',e=>{const b=e.target.closest('.ed-item');if(b)select(b.dataset.key);});
outline.addEventListener('dblclick',e=>{if(e.target.closest('.ed-item'))focusSelected();});
issuesBox.addEventListener('click',e=>{const key=e.target.closest('.ed-issue')?.dataset.key;if(key){select(key);focusSelected();}});
inspector.addEventListener('change',e=>{
 const field=e.target.dataset.field,key=state.selected,value=e.target.value;if(!field||!key)return;
 if(field==='parent')commit(model.setParent(state.raw,key,value||undefined));
 else if(field==='id'){if(!value.trim())return renderInspector();const r=model.renameObject(state.raw,key,value.trim());commit(r.raw,r.key);}
 else if(field==='prefab')commit(model.setPrefab(state.raw,key,value));
 else if(field==='variant')commit(model.setField(state.raw,key,field,+value));
 else if(value==='')model.entryFields(state.raw,key).find(f=>f.field===field)?.optional?commit(model.setField(state.raw,key,field,undefined)):renderInspector();
 else if(Number.isFinite(Number(value)))commit(model.setField(state.raw,key,field,Number(value)));
});
for(const chip of document.querySelectorAll('[data-layer]'))chip.addEventListener('click',()=>{const layer=chip.dataset.layer;state.layers[layer]=!state.layers[layer];chip.setAttribute('aria-pressed',String(state.layers[layer]));drawOverlays();});
$('undo').onclick=undo;$('redo').onclick=redo;
$('view-orbit').onclick=()=>setTop(false);$('view-top').onclick=()=>setTop(true);
// New entries land at the view's center so they appear where the camera is looking.
$('add-object').onclick=()=>{const prefab=$('add-prefab').value;if(!prefab)return;const r=model.addObject(state.raw,prefab,view.target.x,view.target.z);commit(r.raw,r.key);};
$('add-point').onclick=()=>{const r=model.addPoint(state.raw,$('add-list').value,view.target.x,view.target.z);commit(r.raw,r.key);};
$('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([model.formatMap(state.raw)],{type:'application/json'}));a.download=(state.raw.id||'map')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 let raw;try{raw=JSON.parse(await file.text());}catch{return toast(file.name+' is not valid JSON.');}
 const {map,issues}=inspectMap(raw,file.name);
 if(!map)return toast(`${file.name} cannot be drawn: ${strip(issues[0])}`);
 commit(raw,null);toast('Imported '+file.name);
};
$('reset').onclick=()=>{commit(structuredClone(bundled),null);toast('The draft now matches the bundled map. Undo restores your edits.');};
$('play').onclick=()=>{if(state.issues.length)return;saveDraft();open('./index.html?draft','_blank');};

// Camera and pointer input. Left-drag on a handle moves it; elsewhere it orbits, or pans in top view.
const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),hit=new THREE.Vector3(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function pointerRay(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(ndc,camera);return raycaster.ray;}
function pickHandle(e){pointerRay(e);return raycaster.intersectObjects(handleMeshes,false)[0]?.object.userData.key??null;}
// A click on a mesh selects the smallest object whose collider or surface footprint holds the point.
function pickWorld(e){
 if(!worldScene||!state.map)return null;pointerRay(e);const p=raycaster.intersectObjects([world.root,props],true)[0]?.point;if(!p)return null;
 let best=null,area=Infinity;
 for(const o of state.map.objects)for(const s of [...objectColliders(state.map,o),...objectSurfaces(state.map,o)]){
  const box=s.minX!==undefined,inside=s.type==='circle'?Math.hypot(p.x-s.x,p.z-s.z)<=s.r:box?p.x>=s.minX&&p.x<=s.maxX&&p.z>=s.minZ&&p.z<=s.maxZ:Math.abs(p.x-s.x)<=s.w/2&&Math.abs(p.z-s.z)<=s.d/2;
  const size=s.type==='circle'?Math.PI*s.r*s.r:box?(s.maxX-s.minX)*(s.maxZ-s.minZ):s.w*s.d;
  if(inside&&size<area){best='object:'+o.id;area=size;}
 }
 return best;
}
const f1=v=>(Math.round(v*10)/10).toFixed(1);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 try{canvas.setPointerCapture(e.pointerId);}catch{}hoverLabel.classList.add('hidden');
 const pan=e.button!==0||e.shiftKey||view.top;
 if(e.button===0&&!e.shiftKey){
  const key=pickHandle(e)??pickWorld(e);
  if(key){
   select(key);const at=state.handles.get(key);
   if(state.drawable&&at&&pointerRay(e).intersectPlane(ground.set(ground.normal,-at.y),hit)){state.drag={mode:'move',key,offset:{x:at.x-hit.x,z:at.z-hit.z},y:at.y,raw:state.raw,map:state.map,x:e.clientX,y0:e.clientY,moved:false};return;}
  }
 }
 state.drag={mode:pan?'pan':'orbit',x:e.clientX,y0:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
});
canvas.addEventListener('pointermove',e=>{
 const d=state.drag;
 if(!d){
  const key=pickHandle(e);
  if(key){hoverLabel.textContent=state.labels.get(key)??key;hoverLabel.style.left=e.clientX+'px';hoverLabel.style.top=e.clientY+'px';hoverLabel.classList.remove('hidden');}else hoverLabel.classList.add('hidden');
  readout.textContent=pointerRay(e).intersectPlane(ground.set(ground.normal,0),hit)?`x ${f1(hit.x)}   z ${f1(hit.z)}`:'';
  return;
 }
 if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y0)<4)return;d.moved=true;
 if(d.mode==='move'){
  if(!pointerRay(e).intersectPlane(ground.set(ground.normal,-d.y),hit))return;
  const next=model.moveTo(d.raw,d.map,d.key,hit.x+d.offset.x,hit.z+d.offset.z);
  if(JSON.stringify(next)!==JSON.stringify(state.raw))setRaw(next);
  const at=state.handles.get(d.key);if(at)readout.textContent=`x ${f1(at.x)}   z ${f1(at.z)}`;
  return;
 }
 const dx=e.clientX-d.lastX,dy=e.clientY-d.lastY;d.lastX=e.clientX;d.lastY=e.clientY;
 if(d.mode==='orbit'){view.yaw-=dx*.006;view.pitch=Math.min(1.5,Math.max(.12,view.pitch+dy*.006));}
 else{const s=view.distance*.0014,c=Math.cos(view.yaw),n=Math.sin(view.yaw);view.target.x+=(-dx*c-dy*n)*s;view.target.z+=(dx*n-dy*c)*s;}
});
function endDrag(){
 const d=state.drag;state.drag=null;if(!d)return;
 if(d.mode==='move'&&d.moved&&JSON.stringify(d.raw)!==JSON.stringify(state.raw)){state.undo.push(JSON.stringify(d.raw));if(state.undo.length>200)state.undo.shift();state.redo.length=0;saveDraft();renderPanels();}
 else if(d.mode==='orbit'&&!d.moved)select(null);
 else if(d.mode==='pan'&&!d.moved&&view.top&&!pickHandle({clientX:d.x,clientY:d.y0}))select(null);
}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('pointerleave',()=>{if(!state.drag){hoverLabel.classList.add('hidden');readout.textContent='';}});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.distance=Math.min(140,Math.max(6,view.distance*Math.exp(e.deltaY*.0012)));},{passive:false});
addEventListener('keydown',e=>{
 if(e.target.closest?.('input,select,textarea'))return;
 const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
 if(mod&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();}
 else if(mod&&k==='y'){e.preventDefault();redo();}
 else if(mod)return;
 else if(k==='delete'||k==='backspace'){e.preventDefault();removeSelected();}
 else if(k==='escape')select(null);
 else if(k==='t')setTop(!view.top);
 else if(k==='f')focusSelected();
 else if(e.key.startsWith('Arrow')&&state.selected){e.preventDefault();const step=e.shiftKey?1:model.GRID;nudge({ArrowLeft:-step,ArrowRight:step}[e.key]??0,{ArrowUp:-step,ArrowDown:step}[e.key]??0);}
});

function placeCamera(){
 const pitch=view.top?1.5607:view.pitch,flat=Math.cos(pitch)*view.distance;
 camera.position.set(view.target.x+Math.sin(view.yaw)*flat,view.target.y+Math.sin(pitch)*view.distance,view.target.z+Math.cos(view.yaw)*flat);camera.lookAt(view.target);
}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
// Rebuilds are throttled while dragging; the overlays follow the pointer every frame.
function frame(now){
 requestAnimationFrame(frame);resize();
 if(state.map&&builtFor!==state.map&&(state.drag?.mode!=='move'||now-lastBuild>200)){rebuildWorld();lastBuild=now;}
 placeCamera();if(world){world.update(now/1000);world.setView(camera);}
 renderer.clear();if(worldScene)renderer.render(worldScene,camera);renderer.render(overlay,camera);
}
const bar=document.querySelector('.ed-bar');new ResizeObserver(()=>document.body.style.setProperty('--bar-bottom',bar.getBoundingClientRect().bottom+8+'px')).observe(bar);
setRaw(loadDraft());
requestAnimationFrame(frame);
