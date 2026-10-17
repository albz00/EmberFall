import {addRockRunes} from './rock-runes.js?v=24';
import {buildSky} from './arena-sky.js?v=46';
import {buildPortal,addStringLights} from './portal.js?v=59';
import * as THREE from './vendor/three.module.js';
import {MAP,lavaDistance,isLava,groundHeight,safeZone} from './shared/map.js?v=60';
import {mapColliders,createCollision,createMapQueries,objectSurfaces,rampSurfaceHeight} from './shared/map-queries.js?v=45';
import {PREFAB_VISUALS} from './shared/map-schema.js?v=60';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Every collider in the arena comes from the map: world meshes, model props and station furniture.
export const colliders=mapColliders(MAP);
export const {resolveCollision,blocked,lineBlocked}=createCollision(MAP,colliders);
const pathsOf=map=>map.lava.paths.map(path=>({points:path.points.map(p=>[p.x,p.z]),width:path.width}));
export const lavaPaths=pathsOf(MAP);
export {lavaDistance,isLava,groundHeight,safeZone};
// Where string lights attach: the tower roof peak and the rail's back post top.
const TOWER_EAVE=7.87,TOWER_PEAK=TOWER_EAVE+2.5;
const ANCHORS={tower:o=>[o.x,(o.y??0)+TOWER_PEAK+.53,o.z],'ledge-side-rail':o=>[o.x,(o.y??0)+1.45,o.z+1.9]};
const RAND_SEED=68247;let seed=RAND_SEED;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const mix=(a,b,t)=>a+(b-a)*t;
const m=new Map();
export function material(color,roughness=1){const key=color+':'+roughness;if(!m.has(key))m.set(key,new THREE.MeshStandardMaterial({color,roughness,flatShading:true}));return m.get(key);}
function mesh(geometry,mat,x=0,y=0,z=0,parent){const o=new THREE.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent?.add(o);return o;}
function box(parent,x,y,z,w,h,d,color){return mesh(new THREE.BoxGeometry(w,h,d),typeof color==='number'?material(color):color,x,y,z,parent);}
function beam(parent,a,b,r,color=0x6e4735,segments=7){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),dir=B.clone().sub(A);const o=mesh(new THREE.CylinderGeometry(r,r*.94,dir.length(),segments),material(color),...A.clone().add(B).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return o;}
function rock(parent,x,y,z,sx,sy,sz,color=0x64616b,detail=0){const geom=new THREE.IcosahedronGeometry(1,detail);const p=geom.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);const vscale=.89+.18*Math.sin(v.x*8.7+v.y*3.1+v.z*10.7+sx);v.multiplyScalar(vscale);p.setXYZ(i,v.x,v.y,v.z);}geom.computeVertexNormals();const o=mesh(geom,material(color),x,y,z,parent);o.scale.set(sx,sy,sz);o.rotation.set(rand()*.3,rand()*6.28,rand()*.15);return o;}
function glowTexture(){const size=64,d=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const v=Math.max(0,1-Math.hypot(x-size/2,y-size/2)/(size/2)),i=(y*size+x)*4;d[i]=255;d[i+1]=184;d[i+2]=86;d[i+3]=Math.pow(v,2.4)*160;}const t=new THREE.DataTexture(d,size,size);t.needsUpdate=true;return t;}
const flameGlow=glowTexture();
function banner(parent,x,y,z,width=1.2,height=3.3,rotation=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);const s=new THREE.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,-height+.5);s.lineTo(0,-height);s.lineTo(-width/2,-height+.5);const cloth=mesh(new THREE.ShapeGeometry(s),new THREE.MeshStandardMaterial({color:0x9f4146,roughness:1,side:THREE.DoubleSide}),0,0,0,g);cloth.rotation.x=.045;beam(g,[-width/2-.18,.12,0],[width/2+.18,.12,0],.075,0xb68b53);const sigil=mesh(new THREE.PlaneGeometry(width*.33,width*.33),material(0xdca75d),0,-height*.43,.025,g);sigil.rotation.z=Math.PI/4;return cloth;}
function plinth(parent,x,y,z,r=2){mesh(new THREE.CylinderGeometry(r,r*1.1,.45,8),material(0x7b7376),x,y-.225,z,parent);mesh(new THREE.CylinderGeometry(r*.97,r,.15,8),material(0x998b80),x,y+.01,z,parent);}
let floorCache=null;
function floorMesh(map,lavaDistance){
 const key=JSON.stringify([map.bounds,map.lava]);if(floorCache?.key!==key)floorCache={key,geometry:floorGeometry(map,lavaDistance)};
 return new THREE.Mesh(floorCache.geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
}
function floorGeometry(map,lavaDistance){
 const verts=[],colors=[],palette=[0x6c6468,0x686166,0x70676b,0x645e67,0x74696a].map(c=>new THREE.Color(c)),bank=new THREE.Color(0x382c39);
 const distance=p=>Math.min(map.bounds.lavaRadius-Math.hypot(p[0],p[2]),lavaDistance(p[0],p[2]));
 const triangle=(a,b,c,color)=>{verts.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);};
 function clip(points,color){const out=[],cuts=[];for(let i=0;i<3;i++){const a=points[i],b=points[(i+1)%3],da=distance(a),db=distance(b);if(da>=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db),p=[mix(a[0],b[0],t),0,mix(a[2],b[2],t)];out.push(p);cuts.push(p);}}for(let i=1;i<out.length-1;i++)triangle(out[0],out[i],out[i+1],color);if(cuts.length===2){const[a,b]=cuts,c=[b[0],-2.2,b[2]],d=[a[0],-2.2,a[2]];triangle(a,b,c,bank);triangle(a,c,d,bank);}}
 // Cut real channels in the ground, including vertical banks and a recessed bed.
 const step=.65;for(let x=-35;x<35;x+=step)for(let z=-35;z<35;z+=step){const a=[x,0,z],b=[x+step,0,z],c=[x+step,0,z+step],d=[x,0,z+step],color=palette[Math.abs(Math.floor(x/2)*17+Math.floor(z/2)*31)%palette.length];clip([a,c,b],color);clip([a,d,c],color);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

// Builds the arena for a parsed map; the editor passes drafts, the game uses the bundled map.
export function buildWorld(scene,map=MAP){
  seed=RAND_SEED;const paths=map===MAP?lavaPaths:pathsOf(map),gaps=map===MAP?lavaDistance:createMapQueries(map).lavaDistance;const root=new THREE.Group();scene.add(root);const fires=[],glows=[],banners=[];
  const ambient=new THREE.HemisphereLight(0xb9b7d3,0x664344,2.05);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffdec0,3.0);sun.position.set(-18,38,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:100});sun.shadow.bias=-.0005;sun.shadow.normalBias=.1;scene.add(sun);
  const sky=buildSky(scene),moon=sky.moon;
  const fill=new THREE.DirectionalLight(0xa6bfda,1.5);fill.position.set(20,25,-20);scene.add(fill);
  const lavaMat=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec2 vP;void main(){vec4 p=modelMatrix*vec4(position,1.);vP=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`uniform float time;varying vec2 vP;void main(){vec2 p=vP;float a=sin(p.x*4.+sin(p.y*2.5+time*.6)*1.8-time*.7);float b=sin(p.y*5.-sin(p.x*2.+time*.7)*1.5+time*.5);float c=pow(abs(a*b),2.);vec3 col=mix(vec3(1.,.21,.022),vec3(1.,.76,.14),smoothstep(.13,.85,c));gl_FragColor=vec4(col,1.);}`,side:THREE.DoubleSide});
  mesh(new THREE.CylinderGeometry(36.5,37,2,64),material(0x433744),0,-3.2,0,root);
  const floor=floorMesh(map,gaps);root.add(floor);floor.receiveShadow=true;
  const ring=mesh(new THREE.RingGeometry(33.6,36.8,90),lavaMat,0,.04,0,root);ring.rotation.x=-Math.PI/2;
  for(const path of paths){const vertices=[];for(let i=0;i<path.points.length-1;i++){const [ax,az]=path.points[i],[bx,bz]=path.points[i+1];const len=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/len*path.width*.52,nz=(bx-ax)/len*path.width*.52;vertices.push(ax+nx,.035,az+nz,bx-nx,.035,bz-nz,bx+nx,.035,bz+nz,ax+nx,.035,az+nz,ax-nx,.035,az-nz,bx-nx,.035,bz-nz);for(let j=0;j<len;j+=1.8){const t=j/len,x=mix(ax,bx,t),z=mix(az,bz,t);for(const sign of [-1,1])rock(root,x+nx*1.5*sign,.03,z+nz*1.5*sign,.4+rand()*.4,.16+rand()*.12,.3+rand()*.3,0x493d49);}}const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.computeVertexNormals();root.add(new THREE.Mesh(geom,lavaMat));for(const [x,z]of path.points){const join=mesh(new THREE.CircleGeometry(path.width*.53,8),lavaMat,x,.037,z,root);join.rotation.x=-Math.PI/2;}}
  // Deep faceted cavern: irregular slabs, buttresses, and distant rim.
  for(let i=0;i<45;i++){const a=i/45*Math.PI*2,r=38+rand()*2,x=Math.cos(a)*r,z=Math.sin(a)*r;rock(root,x,9+rand()*3,z,5+rand()*3,13+rand()*7,5+rand()*3,[0x655d67,0x6f6268,0x585361,0x786b71][i%4],0);rock(root,x*1.04,26+rand()*4,z*1.04,7,13+rand()*6,7,[0x514d5f,0x635864,0x585162][i%3]);if(i%2===0)rock(root,x*.88,1.6,z*.88,3+rand()*1.5,2.4+rand()*2,3,0x615a66);}
  // Map objects: each world visual draws its mesh at the object; the object's colliders come from the map. game.js places model visuals.
  let rockRunes=null,portal=null;
  const builders={
   // A central crag, narrow enough to fight around and break line of sight.
   crag(o){const y=o.y??0,centralCrag=rock(root,o.x,y+4.9,o.z,3.8,6.8,3.5,0x635d6c),upperCrag=rock(root,o.x-.7,y+10.3,o.z+.4,2.3,4.1,2.5,0x777080);rockRunes=addRockRunes(scene,[centralCrag,upperCrag]);rock(root,o.x+.2,y+.5,o.z,4.4,1.1,4.1,0x443945);},
   boulder(o){const s=o.scale??1;rock(root,o.x,(o.y??0)+s*.45,o.z,s,s*.75,s,0x827279);},
   tower:o=>tower(o.x,o.z,o.rotation??0,o.y??0),
   'ledge-side-rail'(o){const y=o.y??0;beam(root,[o.x,y+1.15,o.z-6.1],[o.x,y+1.15,o.z+6.3],.1,0xbb9770);for(const dz of [-6.1,-2.1,1.9,5.9])bandedPost(root,o.x,y,o.z+dz,1.45);},
   'ledge-back-rail'(o){const y=o.y??0;beam(root,[o.x-9,y+1.1,o.z+.2],[o.x+9,y+1.1,o.z+.2],.12,0xc09669);},
   // The post sits at the inner end, beside the open drop.
   'ledge-front-rail'(o){const y=o.y??0;beam(root,[o.x-1.9,y+1.1,o.z],[o.x+1.9,y+1.1,o.z],.1,0xb99164);bandedPost(root,o.x-Math.sign(o.x)*2,y,o.z,1.3);},
   // The dormant rune lies on the bridge deck's center.
   portal(o){const bridge=map.objects.find(b=>map.prefabs[b.prefab].visual==='bridge'),deck=bridge&&objectSurfaces(map,bridge)[0];portal=buildPortal(root,scene,o,deck?[bridge.x,deck.top,bridge.z]:[o.x,o.y??0,o.z]);},
   // Elevated timber bridge with suspended crimson standards.
   bridge(o){const X=o.x,Y=o.y??0,Z=o.z;
    let plank=0;for(let x=-26.65;x<27;x+=.65)box(root,X+x,Y+4.94,Z,.61,.48,3.75,[0x95724f,0x88654a,0x9c7854][plank++%3]);
    for(const side of [-1,1]){const z=Z+side*1.8;beam(root,[X-27,Y+4.62,z],[X+27,Y+4.62,z],.22);for(let x=-26;x<=26;x+=4){if(side>0&&Math.abs(x)>22)continue;bandedPost(root,X+x,Y+5.2,z,1.18);if(Math.abs(x)>5){const end=Math.min(x+4,side>0?22:27);if(end>x)beam(root,[X+x,Y+6.2,z],[X+end,Y+6.2,z],.08,0xc2a174);}}}
    for(const x of [-22,22]){bandedPost(root,X+x,Y,Z,4.45);beam(root,[X+x,Y+1,Z],[X+x-3,Y+4.42,Z],.2);beam(root,[X+x,Y+1,Z],[X+x+3,Y+4.42,Z],.2);}
    for(const x of [-22,-12,12,22]){banners.push(banner(root,X+x,Y+4.42,Z+2.28,1.45,3.25));beam(root,[X+x-.85,Y+4.54,Z+1.8],[X+x-.85,Y+4.54,Z+2.28],.065);beam(root,[X+x+.85,Y+4.54,Z+1.8],[X+x+.85,Y+4.54,Z+2.28],.065);}
    for(const x of [-26,-18,-6,6,18,26])torch(root,X+x,Y+6.75,Z-1.8,.72,x===-6||x===18);},
   // Sloped walkway drawn from its ramp surface, so the planks follow the height players walk on.
   ramp(o){const s=objectSurfaces(map,o).find(s=>s.type==='ramp'),x=(s.minX+s.maxX)/2,top=s.minZ,length=s.maxZ-s.minZ,slope=Math.atan2(s.rise,length),h=z=>rampSurfaceHeight(s,x,z);
    const deck=box(root,x,s.base+s.rise/2-.15,(s.minZ+s.maxZ)/2,3.95,.3,Math.hypot(length,s.rise),0x795641);deck.rotation.x=slope;
    for(let z=top+.25;z<s.maxZ;z+=.62){const plank=box(root,x,h(z)-.08,z,3.8,.18,.56,0x987352);plank.rotation.x=slope;}
    for(let z=top+3;z<=top+15;z+=6){const y=h(z);bandedPost(root,x,s.base,z,Math.max(.15,y-s.base-.34));beam(root,[x-1.65,y-.34,z],[x+1.65,y-.34,z],.15);}
    for(const side of [-1,1]){const edge=x+side*1.87;for(let z=top+2;z<=top+20;z+=6){const y=h(z);beam(root,[edge,y-.1,z],[edge,y+1.05,z],.1,0x684934);if(z<top+20){const next=z+6;beam(root,[edge,y+1,z],[edge,h(next)+1,next],.075,0xc2a174);}}}},
   'combat-deck'(o){const s=objectSurfaces(map,o)[0],h=s.top,centerZ=(s.minZ+s.maxZ)/2;box(root,o.x,h-.28,centerZ,s.maxX-s.minX,.42,s.maxZ-s.minZ,0x50454b);
    for(let x=s.minX+.19;x<s.maxX;x+=.4)box(root,x,h-.045,centerZ,.37,.09,s.maxZ-s.minZ,0x987352);
    for(const c of map.prefabs[o.prefab].colliders??[])bandedPost(root,o.x+c.x,o.y??0,o.z+c.z,h-.4);
    for(const z of [s.minZ+.2,s.maxZ-.2])beam(root,[s.minX,h-.4,z],[s.maxX,h-.4,z],.15,0x684934);
    for(const side of [-1,1]){beam(root,[o.x+side*6.8,1.1,centerZ-2.1],[o.x+side*5.5,h-.4,centerZ-2.1],.12,0x684934);bandedPost(root,o.x+side*6.8,h-.4,centerZ+2.1,1.15);torch(root,o.x+side*6.8,h+1.3,centerZ+2.1,.5,true);}},
   'combat-stairs'(o){const s=objectSurfaces(map,o).find(s=>s.type==='ramp'),n=Math.ceil(s.rise/.2),depth=(s.maxZ-s.minZ)/n;
    for(let i=0;i<n;i++){const z=s.minZ+(i+.5)*depth,h=s.base+s.rise*(i+.5)/n;box(root,o.x,h-.08,z,s.maxX-s.minX,.16,depth+.015,i%2?0xa17e57:0x93704e);}
    for(const side of [-1,1]){const x=o.x+side*(s.maxX-s.minX-.25)/2;beam(root,[x,s.base-.1,s.minZ],[x,s.base+s.rise-.1,s.maxZ],.16,0x684934);bandedPost(root,x,s.base,s.maxZ-1,s.rise-.5);}},
   // Safe spawn balcony, open along the front so the entry is a real drop.
   ledge(o){const X=o.x,Y=o.y??0,Z=o.z;
    box(root,X,Y+7.25,Z,18.8,1.05,12.6,0x50454b);let plank=0;for(let z=-6.1;z<6.4;z+=.63)box(root,X,Y+7.89,Z+z,18.55,.22,.59,plank++%2?0xa17e57:0x93704e);
    for(const x of [-8,8]){const side=Math.sign(x);for(const z of [-4.2,3.8]){const foot=(map===MAP?groundHeight:createMapQueries(map).groundHeight)(X+x,Z+z,0);bandedPost(root,X+x,foot,Z+z,Y+6.6-foot);beam(root,[X+x,Y+3.5,Z+z],[X+side*4.5,Y+6.4,Z+z],.25);beam(root,[X+x,Y+4.5,Z+z],[X+x,Y+6.4,Z+(z<0?-1.2:.8)],.22);}torch(root,X+side*9.1,Y+10.15,Z-2.1,.72,true);banners.push(banner(root,X+side*7.2,Y+7.5,Z-6.72,1.35,2.2,Math.PI));beam(root,[X+side*7.2,Y+7.62,Z-6.72],[X+side*7.2,Y+7.62,Z-6.05],.08);}
    for(const z of [-4.2,3.8])box(root,X,Y+6.6,Z+z,16.6,.25,.5,0x684934);
    for(const x of [-8,8]){const base=(map===MAP?groundHeight:createMapQueries(map).groundHeight)(X+x,Z,0),top=Y+6.4;if(top-base>9){beam(root,[X+x,base+2,Z-4.2],[X+x,top-1,Z+3.8],.17);beam(root,[X+x,base+2,Z+3.8],[X+x,top-1,Z-4.2],.17);beam(root,[X+x,(base+top)/2,Z-4.2],[X+x,(base+top)/2,Z+3.8],.18);}}
    const garland=(a,b,count,sag)=>{const point=t=>new THREE.Vector3(mix(a[0],b[0],t),mix(a[1],b[1],t)-4*t*(1-t)*sag,mix(a[2],b[2],t)),points=Array.from({length:41},(_,i)=>point(i/40));root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xc39b6b})));
     const length=point(0).distanceTo(point(1));for(let i=1;i<=count;i++){const t=i/(count+1),p=point(t),cloth=banner(root,p.x,p.y-.12,p.z,.6,.85,Math.atan2(b[2]-a[2],b[0]-a[0]));banners.push(cloth);const bar=cloth.parent.children.find(o=>o.geometry?.type==='CylinderGeometry');bar?.removeFromParent();for(const side of [-1,1]){const q=point(t+side*.3/length),r=point(t+side*.25/length);beam(root,q.toArray(),[r.x,p.y-.12,r.z],.012,0xc39b6b);}}};
    for(const x of [-8.8,8.8])for(const z of [-5.6,4.9]){beam(root,[X+x,Y+8,Z+z],[X+x,Y+13.8,Z+z],.075,0x987352);mesh(new THREE.SphereGeometry(.11,6,4),material(0xc39b6b),X+x,Y+13.8,Z+z,root);}
    garland([X-8.8,Y+13.7,Z+4.9],[X+8.8,Y+13.7,Z+4.9],11,.25);
    for(const x of [-8.8,8.8])garland([X+x,Y+13.7,Z-5.6],[X+x,Y+13.7,Z+4.9],7,.2);
    for(let z=-5.2;z<-2.2;z+=1.1){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([X-.35,Y+8.018,Z+z+.4,X+.35,Y+8.018,Z+z+.4,X,Y+8.018,Z+z-.25],3));g.computeVertexNormals();root.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xffd08b,side:THREE.DoubleSide})));}},
  };
  for(const [visual,spec]of Object.entries(PREFAB_VISUALS)){if(spec.builtBy==='world'&&!builders[visual])throw new Error('No mesh builder for prefab visual '+visual);if(spec.anchor&&!ANCHORS[visual])throw new Error('No string light anchor for prefab visual '+visual);}
  for(const o of map.objects){const build=builders[map.prefabs[o.prefab].visual];if(build)build(o);}
  function torch(parent,x,y,z,scale=1,light=false){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);beam(g,[0,-1.1,0],[0,.05,0],.16,0x483846);mesh(new THREE.CylinderGeometry(.38,.22,.45,7),material(0x3f3543),0,-.15,0,g);for(let i=0;i<3;i++){const f=mesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:[0xff6c24,0xffbd4c,0xffe194][i]}),0,.22+i*.17,0,g);f.scale.set(.27-i*.055,.65-i*.15,.27-i*.055);fires.push({mesh:f,base:f.scale.clone(),phase:rand()*10});}const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:flameGlow,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.position.y=.3;sprite.scale.set(3,3,1);g.add(sprite);glows.push(sprite);if(light){const l=new THREE.PointLight(0xff9f4c,22,14,2);l.position.set(x,y+.5,z);scene.add(l);}}
  function bandedPost(parent,x,y,z,height){beam(parent,[x,y,z],[x,y+height,z],.29,0x684934);for(const yy of [y+.4,y+height-.3])mesh(new THREE.CylinderGeometry(.315,.315,.18,7),material(0x403a48),x,yy,z,parent);}
  function tower(x,z,rotation=0,y=0){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;root.add(g);mesh(new THREE.CylinderGeometry(3.2,3.7,1.1,8),material(0x706873),0,.5,0,g);mesh(new THREE.CylinderGeometry(2.9,3.1,7.4,8),material(0x7d7378),0,4.25,0,g);for(let y=1.5;y<7;y+=1.7)mesh(new THREE.CylinderGeometry(3.02,3.04,.16,8),material(0x5f5461),0,y,0,g);for(const xx of [-2.25,2.25])for(const zz of [-2.25,2.25])bandedPost(g,xx,.6,zz,7.1);for(const y of [4,7.6]){box(g,0,y,0,6.3,.42,6.3,0x6c4938);box(g,0,y+.26,0,6.7,.13,6.7,0x9f7650);}box(g,0,6,2.84,1.2,2.05,.08,0x252334);box(g,0,5.8,2.89,.8,1.15,.08,new THREE.MeshStandardMaterial({color:0xffce83,emissive:0xe99a48,emissiveIntensity:1.1}));for(const xx of [-.34,0,.34])box(g,xx,5.8,2.96,.075,1.4,.1,0x493644);mesh(new THREE.ConeGeometry(4.8,2.5,4),material(0xa44e50),0,TOWER_EAVE+1.25,0,g).rotation.y=Math.PI/4;box(g,0,TOWER_EAVE+.01,0,6.7,.16,6.7,0x5a3b3d);banners.push(banner(g,0,4.1,3.48,1.1,2.7));beam(g,[-.7,4.22,3],[-.7,4.22,3.48],.07);beam(g,[.7,4.22,3],[.7,4.22,3.48],.07);torch(g,-2.3,5.18,3.1,.8);torch(g,2.3,5.18,3.1,.8);}
  const objectsById=new Map(map.objects.map(o=>[o.id,o])),anchor=id=>{const o=objectsById.get(id);return ANCHORS[map.prefabs[o.prefab].visual](o);};
  const towersWithLights=[...new Set(map.stringLights.flatMap(c=>[c.from,c.to]))].map(id=>objectsById.get(id)).filter(o=>map.prefabs[o.prefab].visual==='tower');
  const stringLights=addStringLights(root,map.stringLights.map(c=>({from:anchor(c.from),to:anchor(c.to),sag:c.sag})),towersWithLights.map(o=>[o.x,(o.y??0)+TOWER_PEAK+.27,o.z]));
  // Retain the original cloth standard on a supported post beside the ruin.
  bandedPost(root,-6.2,0,-29.8,7.8);beam(root,[-7,7.4,-29.8],[-5.4,7.4,-29.8],.08);banners.push(banner(root,-6.2,7.28,-29.25,1.35,2.8));for(const x of [-6.95,-5.45])beam(root,[x,7.4,-29.8],[x,7.4,-29.25],.07);
  for(const x of [-5.1,5.1]){bandedPost(root,x,0,-30.8,4.5);torch(root,x,5.05,-30.8,.65);}
  // Embers originate along the actual lava streams and rise into the cavern.
  const emberCount=620,positions=new Float32Array(emberCount*3),sizes=new Float32Array(emberCount);
  for(let i=0;i<emberCount;i++){const path=paths[i%paths.length],segment=Math.floor(rand()*(path.points.length-1)),a=path.points[segment],b=path.points[segment+1],t=rand(),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),across=(rand()-.5)*path.width*.8;positions[i*3]=mix(a[0],b[0],t)+dz/length*across;positions[i*3+1]=.12;positions[i*3+2]=mix(a[1],b[1],t)-dx/length*across;sizes[i]=rand();}
  const eGeo=new THREE.BufferGeometry();eGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));eGeo.setAttribute('phase',new THREE.BufferAttribute(sizes,1));
  const eMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},pressureCenter:{value:new THREE.Vector2()},pressureRadius:{value:0}},vertexShader:`uniform float time;uniform vec2 pressureCenter;uniform float pressureRadius;attribute float phase;varying float vA;varying float vHeat;void main(){float life=fract(phase+time/(4.8+phase*4.));vec3 p=position;float weight=pressureRadius>0.?1.-smoothstep(0.,pressureRadius,distance(p.xz,pressureCenter)):0.;p.y+=mix(life,1.-life*life,weight)*(3.5+phase*4.5)*(1.-weight*.6);p.x+=sin(time*.55+phase*40.)*life*.75+life*life*.6;p.z+=cos(time*.4+phase*23.)*life*.55;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((90.+phase*65.)/-mv.z,1.4,6.5);vA=smoothstep(0.,.06,life)*(1.-smoothstep(.62,1.,life))*(.6+phase*.35);vHeat=phase;}`,fragmentShader:`varying float vA;varying float vHeat;void main(){float d=length(gl_PointCoord-vec2(.5));float glow=1.-smoothstep(.08,.5,d);vec3 color=mix(vec3(1.,.30,.055),vec3(1.,.78,.28),vHeat);gl_FragColor=vec4(color,vA*glow);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const embers=new THREE.Points(eGeo,eMat);embers.frustumCulled=false;scene.add(embers);
  // A few ore seams connect the foundry to the reference mine.
  const crystalMat=new THREE.MeshStandardMaterial({color:0xa2d9c5,emissive:0x4aa58a,emissiveIntensity:.4,roughness:.45,flatShading:true});for(const [x,z]of [[-30,-19],[29,-9],[-30,20],[21,27]])for(let i=0;i<5;i++){const c=mesh(new THREE.ConeGeometry(.18+rand()*.12,.7+rand()*.5,5),crystalMat,x+(rand()-.5)*1.8,.4,z+(rand()-.5)*1.5,root);c.rotation.z=(rand()-.5)*.9;}
  // Batch the stationary architecture by material to keep the arena light on the GPU.
  root.updateMatrixWorld(true);const animated=new Set([...fires.map(f=>f.mesh),...banners]),batches=new Map(),remove=[];
  root.traverse(o=>{if(!o.isMesh||animated.has(o)||Array.isArray(o.material))return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),geo=g.index?g.toNonIndexed():g,key=o.material.uuid+':'+Object.keys(geo.attributes).sort().join(',');if(!batches.has(key))batches.set(key,{material:o.material,geometries:[],cast:o.castShadow,receive:o.receiveShadow});batches.get(key).geometries.push(geo);remove.push(o);});
  for(const o of remove)o.removeFromParent();for(const batch of batches.values()){const geometry=mergeGeometries(batch.geometries,false);if(!geometry)continue;const combined=new THREE.Mesh(geometry,batch.material);combined.castShadow=batch.cast;combined.receiveShadow=batch.receive;root.add(combined);for(const g of batch.geometries)g.dispose();}
  return {root,sun,embers,banners,moon,sky,portal,stringLights,rockRunes,setView:sky.setView,setPressure(position,radius=28){eMat.uniforms.pressureRadius.value=position?radius:0;if(position)eMat.uniforms.pressureCenter.value.set(position.x,position.z);},setAtmosphere(amount,pressure=0){sky.setAtmosphere(amount,pressure);
   ambient.color.setHex(0xb9b7d3).lerp(new THREE.Color(0xe5a6ae),amount);ambient.groundColor.setHex(0x664344).lerp(new THREE.Color(0x571f32),amount);ambient.color.lerp(new THREE.Color(0x9a82cb),pressure*.65);ambient.groundColor.lerp(new THREE.Color(0x221a32),pressure*.7);ambient.intensity=2.05-amount*.18-pressure*.35;
   sun.color.setHex(0xffdec0).lerp(new THREE.Color(0xffb8a3),amount);sun.color.lerp(new THREE.Color(0xbbb0ef),pressure*.65);sun.intensity=3-amount*.35-pressure*.35;
   fill.color.setHex(0xa6bfda).lerp(new THREE.Color(0xb984ab),amount);fill.color.lerp(new THREE.Color(0x9456d5),pressure*.75);fill.intensity=1.5-amount*.35+pressure*.35;
  },update(t){rockRunes.update(t);portal.update(t);stringLights.update(t);lavaMat.uniforms.time.value=t;eMat.uniforms.time.value=t;for(const f of fires){const v=1+Math.sin(t*7+f.phase)*.11;f.mesh.scale.y=f.base.y*v;f.mesh.position.x=Math.sin(t*5+f.phase)*.045;}for(let i=0;i<banners.length;i++)banners[i].rotation.x=.045+Math.sin(t*1.8+i)*.018;},setQuality(high){sun.castShadow=high;embers.visible=true;eGeo.setDrawRange(0,high?emberCount:240);for(const g of glows)g.visible=high;}};
}

export function makeHeroStage(scene){const stage=new THREE.Group();scene.add(stage);plinth(stage,0,0,0,1.12);mesh(new THREE.CylinderGeometry(.96,1.08,.6,8),material(0x4e414c),0,-.54,0,stage);const key=new THREE.DirectionalLight(0xffe2ac,4);key.position.set(-3,5,4);scene.add(key);const rim=new THREE.DirectionalLight(0xff9059,5);rim.position.set(3,2,-3);scene.add(rim);scene.add(new THREE.HemisphereLight(0xc1d6fa,0x5f414b,2.4));return stage;}
