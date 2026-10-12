import {restoreMaterial} from './material-state.js?v=24';
import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/SkeletonUtils.js';

const V=THREE.Vector3,Q=THREE.Quaternion;
const joints=['Body','Hips','Abdomen','Torso','Chest','Neck','Head','ShoulderL','UpperArmL','LowerArmL','WristL','ShoulderR','UpperArmR','LowerArmR','WristR','UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR'];
const aims={Body:'Chest',Hips:'Abdomen',Abdomen:'Torso',Torso:'Chest',Chest:'Neck',Neck:'Head',ShoulderL:'UpperArmL',UpperArmL:'LowerArmL',LowerArmL:'WristL',ShoulderR:'UpperArmR',UpperArmR:'LowerArmR',LowerArmR:'WristR',UpperLegL:'LowerLegL',LowerLegL:'FootL',UpperLegR:'LowerLegR',LowerLegR:'FootR'};
const vector=new V(),rotation=new Q(),parentRotation=new Q();

// The live rig receives an additive, directional spring recoil. Its animation
// pose is restored before the next mixer update; it never accumulates rotation.
export function restoreImpactPose(visual){
 for(const saved of [...(visual?.impactPose??[])].reverse())saved.bone.quaternion.copy(saved.quaternion);
 if(visual)visual.impactPose=[];
}
export function triggerImpact(actor,attacker,time,strength=1){
 const direction=actor.position.clone().sub(attacker?.position??actor.position.clone().add(new V(0,0,1)));direction.y=0;
 if(direction.lengthSq()<.01)direction.set(0,0,1);direction.normalize();
 actor.impactReaction={at:time,strength:Math.min(1.5,strength),direction,duration:.72};
}
export function applyImpactPose(visual,actor,time,charge=0){
 if(!visual?.rig)return;const rig=visual.rig,poses=visual.impactPose??=[];
 const turn=(name,x,y=0,z=0)=>{const bone=rig.getObjectByName(name);if(!bone)return;poses.push({bone,quaternion:bone.quaternion.clone()});bone.quaternion.multiply(new Q().setFromEuler(new THREE.Euler(x,y,z)));};
 const hit=actor.impactReaction,age=hit?time-hit.at:Infinity;
 if(hit&&age>=0&&age<hit.duration){
  const envelope=Math.sin(Math.min(1,age/.09)*Math.PI/2)*Math.exp(-age*5.5)*hit.strength;
  const local=hit.direction.clone().applyQuaternion(rig.getWorldQuaternion(new Q()).invert()),wobble=Math.sin(age*24)*envelope;
  turn('Torso',local.z*.7*envelope,local.x*.25*envelope,-local.x*.65*envelope);
  turn('Head',-local.z*.4*envelope,0,local.x*.3*envelope);
  turn('UpperArmL',-.5*envelope,0,-.7*envelope);turn('UpperArmR',-.4*envelope,0,.65*envelope);
  turn('LowerArmL',.8*envelope+wobble*.15);turn('LowerArmR',.7*envelope-wobble*.15);
  if(!actor.grounded){turn('UpperLegL',-.4*envelope+wobble*.2);turn('UpperLegR',.3*envelope-wobble*.2);turn('LowerLegL',.65*envelope);turn('LowerLegR',.5*envelope);}
 }else if(hit)actor.impactReaction=null;
 if(charge>0){turn('UpperArmR',-1.15*charge,-.25*charge,.28*charge);turn('LowerArmR',-.55*charge);turn('Chest',.08*charge,-.2*charge);}
 rig.updateMatrixWorld(true);
}

// A small position-based ragdoll: real skeleton joints, fixed bone lengths,
// torso braces and joint limits. Geometry/textures remain shared, materials do
// not. Detached foot bones in the modular pack use their anatomical knee link.
export class Ragdolls{
 constructor(scene,ground,collide){this.scene=scene;this.ground=ground;this.collide=collide;this.bodies=[];this.limit=18;}
 spawn(visual,actor){
  if(!visual?.rig)return null;if(this.bodies.length>=this.limit)this.remove(this.bodies[0]);
  visual.root.updateMatrixWorld(true);const rig=clone(visual.rig),root=new THREE.Group();root.name='ragdoll';rig.visible=true;
  visual.rig.matrixWorld.decompose(rig.position,rig.quaternion,rig.scale);root.add(rig);this.scene.add(root);
  rig.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material]){restoreMaterial(m);}}});
  root.updateMatrixWorld(true);
  const points=[],byName=new Map(),velocity=(actor.velocity??new V()).clone().add(actor.knock??new V());velocity.clampLength(0,15);velocity.y=Math.max(2,Math.min(7,velocity.y));
  const sideways=new V(velocity.z,0,-velocity.x).normalize();
  for(const name of joints){const bone=rig.getObjectByName(name);if(!bone)continue;
   const p=bone.getWorldPosition(new V()),spin=p.y-actor.position.y-.65,v=velocity.clone().multiplyScalar(.65+Math.max(0,spin)*.3).addScaledVector(sideways,spin*1.6);
   // A forward topple also occurs for environmental deaths without a hit.
   if(velocity.x*velocity.x+velocity.z*velocity.z<.1)v.z+=spin*2.2;
   const point={name,bone,p,old:p.clone().addScaledVector(v,-1/90),radius:name==='Head'?.2:['Body','Chest'].includes(name)?.16:.07,worldQ:bone.getWorldQuaternion(new Q())};points.push(point);byName.set(name,point);
  }
  const links=[],link=(a,b,min=1,max=1)=>{a=byName.get(a);b=byName.get(b);if(!a||!b)return;const length=a.p.distanceTo(b.p);if(length>.002)links.push({a,b,min:length*min,max:length*max});};
  for(const p of points){let parent=p.bone.parent;while(parent&&!byName.has(parent.name))parent=parent.parent;if(p.name.startsWith('Foot'))link('LowerLeg'+p.name.slice(-1),p.name);else if(parent)link(parent.name,p.name);const target=byName.get(aims[p.name]);if(target)p.aim=target.p.clone().sub(p.p).normalize();}
  for(const [a,b]of[['Body','Chest'],['UpperArmL','UpperArmR'],['Body','UpperArmL'],['Body','UpperArmR'],['UpperLegL','UpperLegR'],['Chest','UpperLegL'],['Chest','UpperLegR'],['Body','Head']])link(a,b,.96,1.04);
  for(const side of ['L','R']){link('UpperArm'+side,'Wrist'+side,.4,1.07);link('UpperLeg'+side,'Foot'+side,.48,1.03);}
  const depth=o=>{let n=0;while(o.parent){n++;o=o.parent;}return n;};points.sort((a,b)=>depth(a.bone)-depth(b.bone));
  const body={root,rig,points,byName,links,age:0,accumulator:0,actor};this.bodies.push(body);return body;
 }
 step(body,dt){
  for(const p of body.points){const prior=p.p.clone(),v=p.p.clone().sub(p.old).multiplyScalar(.994);v.clampLength(0,.25);p.p.add(v);p.p.y-=22*dt*dt;p.old.copy(prior);}
  for(let iteration=0;iteration<9;iteration++){
   for(const c of body.links){vector.copy(c.b.p).sub(c.a.p);const distance=vector.length();if(distance<.0001)continue;const wanted=THREE.MathUtils.clamp(distance,c.min,c.max),amount=(distance-wanted)/distance*.5;vector.multiplyScalar(amount);c.a.p.add(vector);c.b.p.sub(vector);}
   for(const p of body.points){const floor=this.ground(p.p.x,p.p.z,Math.max(p.p.y,p.old.y)-p.radius)+p.radius;
    if(p.p.y<floor){p.p.y=floor;p.old.y=Math.min(p.old.y,floor);p.old.x=THREE.MathUtils.lerp(p.old.x,p.p.x,.28);p.old.z=THREE.MathUtils.lerp(p.old.z,p.p.z,.28);}
    if(this.collide&&iteration===8){const contact=p.p.clone();contact.y-=p.radius;this.collide(contact,p.radius,p.radius*2);p.p.x=contact.x;p.p.z=contact.z;}
   }
  }
 }
 pose(body){
  for(const p of body.points){const bone=p.bone,target=body.byName.get(aims[p.name]);bone.parent.updateWorldMatrix(true,false);
   bone.position.copy(bone.parent.worldToLocal(p.p.clone()));
   if(target&&p.aim){vector.copy(target.p).sub(p.p).normalize();rotation.setFromUnitVectors(p.aim,vector).multiply(p.worldQ);bone.quaternion.copy(bone.parent.getWorldQuaternion(parentRotation).invert().multiply(rotation));}
   bone.updateMatrixWorld(true);
  }
 }
 update(dt){
  for(const body of [...this.bodies]){body.age+=dt;if(body.age>=4){this.remove(body);continue;}body.accumulator+=Math.min(dt,.05);while(body.accumulator>=1/90){this.step(body,1/90);body.accumulator-=1/90;}this.pose(body);
   if(body.age>3.3){const opacity=(4-body.age)/.7;body.rig.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=Math.min(m.opacity,opacity);m.depthWrite=false;}});}
  }
 }
 remove(body){body.root.removeFromParent();body.rig.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();if(o.isSkinnedMesh)o.skeleton.dispose();}});const i=this.bodies.indexOf(body);if(i>=0)this.bodies.splice(i,1);}
 clear(){for(const body of [...this.bodies])this.remove(body);}
}
