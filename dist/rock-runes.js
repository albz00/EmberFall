import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
const V=THREE.Vector3;
const glyphs=[[[[0,-.48],[0,.48]],[[-.28,.05],[0,.34],[.28,.05]]],[[[-.27,.32],[.27,-.32]],[[-.27,-.32],[.27,.32]],[[0,-.5],[0,.5]]],[[[0,.5],[.3,.12],[0,-.22],[-.3,.12],[0,.5]],[[0,-.22],[0,-.5]]],[[[-.28,.3],[0,.47],[.28,.3]],[[0,.47],[0,-.46]],[[0,-.08],[.3,-.28]]]];
export function addRockRunes(scene,rocks){
 const group=new THREE.Group();group.name='central-rock-runes';scene.add(group);const grooves=[],light=[],samples=[];rocks.forEach(r=>r.updateWorldMatrix(true,false));const ray=new THREE.Raycaster();
 function projected(u,v,angle,y){const normal=new V(Math.sin(angle),0,Math.cos(angle)),tangent=new V(Math.cos(angle),0,-Math.sin(angle)),origin=normal.clone().multiplyScalar(8).addScaledVector(tangent,u).setY(y+v);ray.set(origin,normal.clone().negate());ray.far=12;const hit=ray.intersectObjects(rocks,false)[0];if(!hit)return null;const n=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();return{point:hit.point,normal:n};}
 function stroke(points,angle,y){const projectedPoints=[];for(let j=0;j<points.length-1;j++){const a=points[j],b=points[j+1],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.065);for(let i=0;i<=steps;i++){const t=i/steps,p=projected(THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t),angle,y);if(p){projectedPoints.push(p);samples.push({surface:p.point.clone(),normal:p.normal.clone()});}}}if(projectedPoints.length<2)return;
  // Sample the actual facets so the markings sit on rock rather than floating planes.
  for(const [array,radius,offset]of [[grooves,.037,.004],[light,.011,.022]]){const curve=new THREE.CatmullRomCurve3(projectedPoints.map(p=>p.point.clone().addScaledVector(p.normal,offset)),false,'centripetal');array.push(new THREE.TubeGeometry(curve,Math.max(8,projectedPoints.length*2),radius,4,false));}
 }
 for(const [angle,height,index]of [[0,2.3,0],[0,3.8,2],[0,5.5,1],[0,7.0,3],[-1.35,2.5,3],[-1.35,4.2,1],[-1.35,5.9,0],[1.35,2.5,1],[1.35,4.2,0],[1.35,5.9,2]])for(const path of glyphs[index])stroke(path,angle,height);
 const cutMaterial=new THREE.MeshStandardMaterial({color:0x302837,roughness:1}),runeMaterial=new THREE.MeshStandardMaterial({color:0xc7b9eb,emissive:0x8e72c2,emissiveIntensity:1.05,roughness:.8});
 for(const [geometries,material,name]of [[grooves,cutMaterial,'rune-grooves'],[light,runeMaterial,'rune-inlays']]){const geometry=mergeGeometries(geometries,false);if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.noCameraCollision=true;group.add(mesh);}geometries.forEach(g=>g.dispose());}
 group.userData.markCount=10;return{group,samples,update(time){runeMaterial.emissiveIntensity=1.05+Math.sin(time*.7)*.07;}};
}
