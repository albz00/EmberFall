// Pure map queries built from a parsed map. No THREE or DOM, so a server and the validator can use them.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

const mix=(a,b,t)=>a+(b-a)*t;

// Places a prefab's colliders at an object. Offsets, sizes and maxY scale with the object unless the
// collider sets scaleTop: false; minY stays at its depth so footings remain buried. Boxes stay
// axis-aligned even when the object's mesh is rotated.
export function objectColliders(map,object){
 const s=object.scale??1,y=object.y??0;
 return (map.prefabs[object.prefab].colliders??[]).map(c=>{const x=object.x+(c.x??0)*s,z=object.z+(c.z??0)*s,minY=y+c.minY,maxY=y+(c.scaleTop===false?c.maxY:c.maxY*s);
  if(c.type==='ring')return{type:'ring',x,z,r:c.r*s,inner:c.inner*s,doorWidth:c.doorWidth*s,doorHeight:c.doorHeight*s,rotation:object.rotation??0,minY,maxY};
  return c.type==='circle'?{type:'circle',x,z,r:c.r*s,minY,maxY}:{type:'box',x,z,w:c.w*s,d:c.d*s,minY,maxY};});
}
// Placed surface edges and heights are rounded to 1 nm, so an object position plus an offset gives the same
// number as writing that decimal coordinate directly (0.8 + 10.8 would otherwise be 11.600000000000001).
export const snap=value=>Math.round(value*1e9)/1e9;
// Places a prefab's walkable surfaces at an object. Surface objects are never rotated or scaled.
export function objectSurfaces(map,object){
 const y=object.y??0;
 return (map.prefabs[object.prefab].surfaces??[]).map(s=>{const x=object.x+(s.x??0),z=object.z+(s.z??0),top=snap(y+s.height);
  const edges={minX:snap(x-s.w/2),maxX:snap(x+s.w/2),minZ:snap(z-s.d/2),maxZ:snap(z+s.d/2)};
  return s.type==='flat'?{type:'flat',...edges,top,minFeet:snap(top-s.stepUp)}:{type:'ramp',...edges,base:snap(y),rise:s.height,rises:s.rises,stepUp:s.stepUp};});
}
export const mapSurfaces=map=>map.objects.flatMap(object=>objectSurfaces(map,object));
// Height of a ramp at a point along its slope; the ramp reaches base + rise at the end it rises toward.
export function rampSurfaceHeight(s,x,z){
 const [lo,hi,at]=s.rises[1]==='z'?[s.minZ,s.maxZ,z]:[s.minX,s.maxX,x];
 return s.base+s.rise*(s.rises[0]==='-'?hi-at:at-lo)/(hi-lo);
}
// The surface height under a point for feet at a given height, or null. Flat surfaces exclude their edges and
// catch feet at or above minFeet, so players can pass under a deck. Ramps include both ends of the slope, so
// they meet the floor and the deck, and catch feet within stepUp below the slope.
export function surfaceHeight(s,x,z,feet){
 if(s.type==='flat')return x>s.minX&&x<s.maxX&&z>s.minZ&&z<s.maxZ&&feet>=s.minFeet?s.top:null;
 const alongZ=s.rises[1]==='z';
 if(!(alongZ?x>s.minX&&x<s.maxX&&z>=s.minZ&&z<=s.maxZ:z>s.minZ&&z<s.maxZ&&x>=s.minX&&x<=s.maxX))return null;
 const h=rampSurfaceHeight(s,x,z);return feet>=h-s.stepUp?h:null;
}
// Stations with a prefab stand on the surface at the station's own position.
export const stationObjects=map=>{const {groundHeight}=createMapQueries(map);return Object.entries(map.stations).filter(([,s])=>s.prefab).map(([id,s])=>({id:'station-'+id,prefab:s.prefab,x:s.x,y:groundHeight(s.x,s.z),z:s.z}));};
export const mapColliders=map=>[...map.objects,...stationObjects(map)].flatMap(object=>objectColliders(map,object));
export function ringDoor(c,x,z,y,height,padding){const dx=x-c.x,dz=z-c.z,localX=dx*Math.cos(c.rotation)-dz*Math.sin(c.rotation),localZ=dx*Math.sin(c.rotation)+dz*Math.cos(c.rotation);return localZ>0&&Math.abs(localX)+padding<c.doorWidth/2&&y+height<=c.minY+c.doorHeight;}
export function colliderTouches(c,x,z,y,clearance){if(c.type==='ring'){const d=Math.hypot(x-c.x,z-c.z);return y+1.6>=c.minY&&y<=c.maxY&&d>c.inner-clearance&&d<c.r+clearance&&!ringDoor(c,x,z,y,1.6,clearance);}return y+1.6>=c.minY&&y<=c.maxY&&(c.type==='circle'?Math.hypot(x-c.x,z-c.z)<c.r+clearance:Math.abs(x-c.x)<c.w/2+clearance&&Math.abs(z-c.z)<c.d/2+clearance);}

export function createMapQueries(map){
 const {bounds,lava,regions:{safe,bridgeCover}}=map,surfaces=mapSurfaces(map),rooms=map.objects.flatMap(o=>objectColliders(map,o)).filter(c=>c.type==='ring');
 const roomAt=(x,z)=>rooms.find(c=>Math.hypot(x-c.x,z-c.z)<c.r);
 function lavaDistance(x,z){let best=100;for(const path of lava.paths){for(let i=0;i<path.points.length-1;i++){const a=path.points[i],b=path.points[i+1],ax=a.x,az=a.z;const dx=b.x-ax,dz=b.z-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(x-ax-t*dx,z-az-t*dz)-path.width*.5);}}return best;}
 function isLava(x,z,y=0){const room=roomAt(x,z);if(room&&y>=room.minY-.1&&y<room.maxY)return false;return y<lava.surfaceClearance&&(Math.hypot(x,z)>bounds.lavaRadius||lavaDistance(x,z)<0);}
 // The highest surface that catches the feet, over the floor or the lava bed.
 function groundHeight(x,z,feet=100){const room=roomAt(x,z);let y=room&&feet>=room.minY-.5?room.minY:isLava(x,z,0)?lava.bedHeight:0;for(const s of surfaces){const h=surfaceHeight(s,x,z,feet);if(h!==null)y=Math.max(y,h);}return y;}
 function safeZone(p){return p.y>safe.minY&&Math.abs(p.x-safe.x)<safe.halfWidth&&p.z>safe.minZ;}
 function isUnderBridge(p){return p.y>=bridgeCover.minY&&p.y<bridgeCover.maxY&&Math.abs(p.x-bridgeCover.x)<bridgeCover.halfLength&&p.z>bridgeCover.minZ&&p.z<bridgeCover.maxZ;}
 return {lavaDistance,isLava,groundHeight,safeZone,isUnderBridge};
}

// Collision against a collider list, normally mapColliders(map). Pure, so a server can run it unchanged.
export function createCollision(map,colliders){
 const wall=map.bounds.wallRadius,rooms=colliders.filter(c=>c.type==='ring'),roomBounds=(x,z,padding=0,y=0)=>rooms.some(c=>y>=c.minY-1&&y<=c.maxY&&Math.hypot(x-c.x,z-c.z)<c.r+padding);
 // Pre-expanded bins preserve every existing point/contact test while avoiding a full
 // collider scan at every 30 cm line-of-sight sample. Unusually wide queries use the full list.
 const bins=new Map(),cellSize=4;
 for(const c of colliders){const rx=c.type==='box'?c.w/2:c.r,rz=c.type==='box'?c.d/2:c.r;for(let x=Math.floor((c.x-rx-1)/cellSize);x<=Math.floor((c.x+rx+1)/cellSize);x++)for(let z=Math.floor((c.z-rz-1)/cellSize);z<=Math.floor((c.z+rz+1)/cellSize);z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(c);}}
 const empty=[];
 function resolveCollision(pos,radius=.38,height=1.7){const distance=Math.hypot(pos.x,pos.z);if(distance>wall&&!roomBounds(pos.x,pos.z,radius,pos.y)){pos.x*=wall/distance;pos.z*=wall/distance;}for(const c of colliders){if(pos.y+height<c.minY||pos.y>c.maxY)continue;if(c.type==='ring'){const dx=pos.x-c.x,dz=pos.z-c.z,d=Math.hypot(dx,dz);if(d>c.inner-radius&&d<c.r+radius&&!ringDoor(c,pos.x,pos.z,pos.y,height,radius)){const boundary=d<(c.inner+c.r)/2?c.inner-radius:c.r+radius;if(d){pos.x=c.x+dx/d*boundary;pos.z=c.z+dz/d*boundary;}}}else if(c.type==='circle'){const dx=pos.x-c.x,dz=pos.z-c.z,d=Math.hypot(dx,dz),r=c.r+radius;if(d<r){if(d<.001){pos.x+=r;continue;}pos.x=c.x+dx/d*r;pos.z=c.z+dz/d*r;}}else{const x=clamp(pos.x,c.x-c.w/2,c.x+c.w/2),z=clamp(pos.z,c.z-c.d/2,c.z+c.d/2),dx=pos.x-x,dz=pos.z-z,ds=Math.hypot(dx,dz);if(ds>0&&ds<radius){pos.x=x+dx/ds*radius;pos.z=z+dz/ds*radius;}else if(ds===0){const sides=[{d:Math.abs(pos.x-(c.x-c.w/2)),axis:'x',v:c.x-c.w/2-radius},{d:Math.abs(pos.x-(c.x+c.w/2)),axis:'x',v:c.x+c.w/2+radius},{d:Math.abs(pos.z-(c.z-c.d/2)),axis:'z',v:c.z-c.d/2-radius},{d:Math.abs(pos.z-(c.z+c.d/2)),axis:'z',v:c.z+c.d/2+radius}].sort((a,b)=>a.d-b.d);pos[sides[0].axis]=sides[0].v;}}}return pos;}
 function blocked(x,z,y=0,padding=.6){if(Math.hypot(x,z)>wall-Math.min(.4,padding)&&!roomBounds(x,z,padding,y))return true;return (padding<=1?bins.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))??empty:colliders).some(c=>colliderTouches(c,x,z,y,padding));}
 function lineBlocked(a,b){const distance=Math.hypot(a.x-b.x,a.z-b.z),steps=Math.ceil(distance/.3);for(let i=1;i<steps;i++){const t=i/steps;if(blocked(mix(a.x,b.x,t),mix(a.z,b.z,t),mix(a.y,b.y,t),.05))return true;}return false;}
 return {resolveCollision,blocked,lineBlocked};
}
