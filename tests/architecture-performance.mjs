import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import * as T from '../dist/vendor/three.module.js';
import {MAP,isLava,groundHeight} from '../dist/shared/map.js';
import {createCollision,mapColliders,colliderTouches} from '../dist/shared/map-queries.js';
import {createElevationRouter} from '../dist/elevation-route.js';
import {buildWorld} from '../dist/world.js';
import {rigMaterials,invalidateMaterials,freezeStatic,visualInterval} from '../dist/render-work.js';
const collision=createCollision(MAP,mapColliders(MAP)),route=createElevationRouter(MAP);
for(const room of mapColliders(MAP).filter(c=>c.type==='ring')){
 const at=(x,z)=>({x:room.x+x*Math.cos(room.rotation)+z*Math.sin(room.rotation),y:0,z:room.z-x*Math.sin(room.rotation)+z*Math.cos(room.rotation)});
 assert(!collision.blocked(room.x,room.z,0,.38));assert(!isLava(room.x,room.z,0));assert.equal(groundHeight(room.x,room.z,0),0);
 for(let z=4;z>=0;z-=.08){const p=at(0,z),result=collision.resolveCollision({...p});assert(Math.hypot(p.x-result.x,p.z-result.z)<1e-6,'door allows a complete capsule through the wall');}
 assert(collision.blocked(at(2.9,0).x,at(2.9,0).z,0,.38));assert(collision.blocked(at(0,2.9).x,at(0,2.9).z,3.1,.38),'lintel remains solid');
 const target={x:room.x,z:room.z,y:0},via=route(at(-6,-2),target),front=at(0,3.9);assert(Math.hypot(via.x-front.x,via.z-front.z)<.01,'AI approaches the actual rotated door');
}
// Broad-phase point bins must preserve exact guard/visibility/collision answers, including wide-query fallback.
const all=mapColliders(MAP),rooms=all.filter(c=>c.type==='ring');let queries=0;
for(let x=-35;x<=35;x+=.7)for(let z=-35;z<=35;z+=.7)for(const y of [0,3.2,7,20])for(const padding of [.05,.6,1.2]){const wall=Math.hypot(x,z)>MAP.bounds.wallRadius-Math.min(.4,padding)&&!rooms.some(c=>y>=c.minY-1&&y<=c.maxY&&Math.hypot(x-c.x,z-c.z)<c.r+padding),expected=wall||all.some(c=>colliderTouches(c,x,z,y,padding));assert.equal(collision.blocked(x,z,y,padding),expected);queries++;}
assert.equal(groundHeight(0,26,3.2),3.2);assert.equal(groundHeight(0,26,7),7);assert.equal(groundHeight(0,26,0),0);
const upper={x:0,y:7,z:26},first=route({x:5.4,y:0,z:12},upper);assert(first.z<16,'ground approach uses the first staircase');const second=route({x:5.4,y:3.2,z:24.5},upper);assert(second.y===7&&second.z>29,'second ascent uses the upper landing');
globalThis.document={createElement:()=>createCanvas(256,256)};const scene=new T.Scene(),world=buildWorld(scene);scene.updateMatrixWorld(true);
assert(world.flameBatch.isInstancedMesh&&world.flameBatch.instanceColor&&world.flameBatch.count>30);assert(world.clothBatch.isInstancedMesh);assert.equal(world.clothBatch.count,35);assert(world.banners.every(f=>!f.visible&&f.userData.noCameraCollision));const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};world.clothBatch.material.onBeforeCompile(shader);world.update(5);assert.equal(shader.uniforms.clothTime.value,5);assert(shader.vertexShader.includes('freeHem*freeHem'));assert(shader.fragmentShader.includes('diamond'));
// Probe the actual visible tower shells: a horizontal ray goes through each doorway into the room.
const meshes=[];world.root.traverse(o=>{if(o.isMesh&&!o.userData.noCameraCollision)meshes.push(o);});
for(const room of mapColliders(MAP).filter(c=>c.type==='ring')){const front=new T.Vector3(Math.sin(room.rotation),0,Math.cos(room.rotation)),origin=new T.Vector3(room.x,1.4,room.z).addScaledVector(front,4),ray=new T.Raycaster(origin,front.negate(),0,4);assert.equal(ray.intersectObjects(meshes,false).length,0,'door has no hidden wall mesh across the opening');}
const rig=new T.Group(),material=new T.MeshStandardMaterial({color:0xabcdef});rig.add(new T.Mesh(new T.BoxGeometry(),material),new T.Mesh(new T.BoxGeometry(),material));assert.equal(rigMaterials(rig).length,1);assert.strictEqual(rigMaterials(rig),rigMaterials(rig));invalidateMaterials(rig);assert.equal(rigMaterials(rig).length,1);freezeStatic(rig);assert(rig.children.every(m=>m.frustumCulled&&!m.matrixAutoUpdate&&!m.matrixWorldAutoUpdate));assert.equal(visualInterval(5,true),0);assert.equal(visualInterval(40,true),1/30);assert.equal(visualInterval(5,false),1/12);
console.log(JSON.stringify({architecture:'passed',enterableTowers:3,matchingDoorMeshes:true,rotatedDoorCollision:true,privateLevels:[3.2,7],multiStageStairRouting:true,clothInstances:world.clothBatch.count,clothDraws:1,passThroughCloth:true,cachedMaterials:true,staticTransformsFrozen:true,identicalBroadphaseQueries:queries}));
