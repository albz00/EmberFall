import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createCanvas} from '@napi-rs/canvas';
import {STAMINA,resetStamina,canSprint,spendStamina,updateStamina} from '../dist/stamina.js';
import {createSceneryIndex} from '../dist/scenery-index.js';
import {createElevationRouter} from '../dist/elevation-route.js';
import {MAP,groundHeight} from '../dist/shared/map.js';
import {buildWorld} from '../dist/world.js';
const actor={};resetStamina(actor);assert.equal(actor.stamina,100);let time=0;
for(let i=0;i<900;i++){time+=1/90;updateStamina(actor,1/90,time,true);}assert.equal(actor.stamina,0);assert(!canSprint(actor));assert(!spendStamina(actor,STAMINA.rollCost,time));
updateStamina(actor,.1,time+.1,false);assert.equal(actor.stamina,0,'recovery waits after exertion');time+=1;updateStamina(actor,.5,time,false);assert.equal(actor.stamina,12);assert(!canSprint(actor),'exhaustion does not flicker sprint at one stamina');updateStamina(actor,.5,time+.5,false);assert(canSprint(actor));
assert(spendStamina(actor,STAMINA.dodgeCost,time+1));assert.equal(actor.stamina,6);assert(!spendStamina(actor,STAMINA.rollCost,time+1));updateStamina(actor,1,time+2,false,true);assert.equal(actor.stamina,100);assert(spendStamina(actor,10000,time,true),'admin bypasses stamina costs');
const route=createElevationRouter(MAP),goal={x:0,y:3.2,z:27.2},approach=route({x:5.4,y:0,z:12},goal);assert(approach.z<16&&approach.x>0);assert(route({x:5.4,y:0,z:15.5},goal).z>24.4);assert(route({x:5.4,y:1.6,z:20.2},goal).z>24.4);assert.strictEqual(route({x:0,y:3.2,z:27},goal),goal);
for(const x of [-5.4,5.4])for(let i=0;i<=42;i++){const z=16+i*.2;assert(Math.abs(groundHeight(x,z,3.2)-3.2*i/42)<1e-7,'stair collision continuously joins the floor and terrace');}
assert.equal(groundHeight(0,27.2,3.2),3.2);assert.equal(groundHeight(0,27.2,0),0,'ground walkway remains beneath the terrace');
// Real arena geometry, not simplified boxes: compare indexed rays to THREE and count narrow-phase work.
globalThis.document={createElement:tag=>tag==='canvas'?createCanvas(256,256):{style:{}}};
const scene=new T.Scene(),world=buildWorld(scene);scene.updateMatrixWorld(true);const meshes=[];scene.traverse(o=>{const m=o.material;if(o.isMesh&&!o.userData.noCameraCollision&&!o.isSkinnedMesh&&!Array.isArray(m)&&!(m.transparent&&m.opacity<.9)&&m.visible!==false)meshes.push(o);});
const index=createSceneryIndex(meshes);let totalTests=0,queries=0;
for(let i=0;i<80;i++){
 const origin=new T.Vector3(Math.sin(i*1.7)*27,[1.6,4.8,21.6][i%3],Math.cos(i*2.3)*27),direction=new T.Vector3(Math.sin(i*.73),Math.sin(i*1.1)*.8,Math.cos(i*.73)).normalize(),far=i%4?4.5:60;
 const expected=new T.Raycaster(origin,direction,.05,far).intersectObjects(meshes,false)[0]?.distance??null,actual=index.distance(origin,direction,far);
 if(expected===null)assert.equal(actual,null);else assert(actual!==null&&Math.abs(actual-expected)<.0001,`ray ${i}: ${actual} vs ${expected}`);
 if(far<5){totalTests+=index.lastTests;queries++;}
}
// Short projectile segments retain the original 1 mm near plane and exact nearest wall hit.
let projectileTests=0;
for(let i=0;i<240;i++){
 const origin=new T.Vector3(Math.sin(i*.71)*31,1.4+(i%3)*3,Math.cos(i*.43)*31),direction=new T.Vector3(Math.sin(i*.91),Math.sin(i*.37)*.6,Math.cos(i*.91)).normalize(),far=.2+(i%4)*.15;
 const expected=new T.Raycaster(origin,direction,.001,far).intersectObjects(meshes,false)[0]?.distance??null,actual=index.distance(origin,direction,far,.001);
 if(expected===null)assert.equal(actual,null);else assert(actual!==null&&Math.abs(actual-expected)<.0001);projectileTests+=index.lastTests;
}
assert(projectileTests/240<index.triangles*.01,'projectiles inspect less than 1% of static triangles per segment');
assert(totalTests/queries<index.triangles*.1,'near-camera rays inspect less than 10% of the map triangles');
console.log(JSON.stringify({stamina:'passed',exhaustionAndRecovery:true,adminBypass:true,stairsAndUnderpass:true,routedStairApproach:true,indexedRays:80,triangles:index.triangles,meanCameraTriangles:Math.round(totalTests/queries),exactSceneryHits:true}));
