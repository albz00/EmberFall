import * as THREE from './vendor/three.module.js';
const V=THREE.Vector3,Q=THREE.Quaternion,Y=new V(0,1,0);
export function makeCharacterPose(){return{saved:[],weight:0};}
export function restoreCharacterPose(layer){for(const p of layer.saved)p.bone[p.property].copy(p.value);layer.saved.length=0;}
function save(layer,bone,property='quaternion'){if(bone&&!layer.saved.some(p=>p.bone===bone&&p.property===property))layer.saved.push({bone,property,value:bone[property].clone()});}
function aim(layer,bone,end,target,weight){
 const origin=bone.getWorldPosition(new V()),current=end.getWorldPosition(new V()).sub(origin).normalize(),desired=target.clone().sub(origin).normalize();
 if(!current.lengthSq()||!desired.lengthSq())return;
 const world=bone.getWorldQuaternion(new Q()),parent=bone.parent.getWorldQuaternion(new Q());
 const rotation=new Q().setFromUnitVectors(current,desired).multiply(world).premultiply(parent.invert());
 save(layer,bone);bone.quaternion.slerp(rotation,weight);bone.updateWorldMatrix(false,true);
}
// Two-joint targets preserve each avatar's actual limb lengths and bind orientation.
function limb(rig,layer,names,target,pole,weight){
 const [upper,lower,end]=names.map(n=>rig.getObjectByName(n));if(!upper||!lower||!end)return;
 rig.updateMatrixWorld(true);const a=upper.getWorldPosition(new V()),b=lower.getWorldPosition(new V()),c=end.getWorldPosition(new V()),l1=a.distanceTo(b),l2=b.distanceTo(c);
 if(l1<.02||l2<.02)return;
 const delta=target.clone().sub(a),d=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.005,(l1+l2)*.997),axis=delta.normalize(),bend=pole.clone().sub(a);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
 const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
 aim(layer,upper,lower,elbow,weight);aim(layer,lower,end,a.clone().addScaledVector(axis,d),weight);
}
export function applyCharacterPose(rig,layer,actor,dt,{flying=false,blocking=false,attacking=false,disabled=false,armed=true,time=0,gaitPhase=0}={}){
 layer.weight=THREE.MathUtils.damp(layer.weight,disabled||attacking?0:1,24,dt);const weight=layer.weight;if(weight<.001||disabled||attacking)return;
 rig.updateMatrixWorld(true);const point=v=>rig.localToWorld(new V(...v)),local=bone=>rig.worldToLocal(bone.getWorldPosition(new V()));
 const speed=Math.hypot(actor.velocity?.x??0,actor.velocity?.z??0);
 // Keep imported shoulder and elbow motion intact. Only an explicit guard lifts the arms.
 if(blocking)for(const side of ['L','R']){
  const shoulder=rig.getObjectByName('UpperArm'+side),hand=rig.getObjectByName('Wrist'+side),elbow=rig.getObjectByName('LowerArm'+side);if(!shoulder||!hand||!elbow)continue;
  const p=local(shoulder),sign=side==='R'?-1:1,length=shoulder.getWorldPosition(new V()).distanceTo(elbow.getWorldPosition(new V()))+elbow.getWorldPosition(new V()).distanceTo(hand.getWorldPosition(new V()));
  limb(rig,layer,['UpperArm'+side,'LowerArm'+side,'Wrist'+side],point([side==='R'?-.1:.17,p.y-length*.48,p.z+length*.65]),point([p.x+sign*.3,p.y-.3,p.z+.35]),weight);
 }
 // Correct the blade at the wrist, without replacing the authored arm poses.
 const hand=rig.getObjectByName('WristR'),weapon=hand?.children.find(o=>o.userData.slot==='sword'||o.userData.weapon);
 if(hand&&weapon&&armed){
  const desired=new V(blocking?.76:-.22,blocking?.58:.92,blocking?.28:.34).normalize().transformDirection(rig.matrixWorld),current=Y.clone().applyQuaternion(weapon.getWorldQuaternion(new Q()));
  const q=new Q().setFromUnitVectors(current,desired).multiply(hand.getWorldQuaternion(new Q())).premultiply(hand.parent.getWorldQuaternion(new Q()).invert());save(layer,hand);hand.quaternion.slerp(q,weight);hand.updateWorldMatrix(false,true);
 }
 if(flying){
  // Almost straight legs at rest; feet trail softly only while travelling.

  for(const side of ['L','R']){const hip=rig.getObjectByName('UpperLeg'+side),shin=rig.getObjectByName('LowerLeg'+side),foot=rig.getObjectByName('Foot'+side);if(!hip||!shin||!foot)continue;const h=local(hip),length=hip.getWorldPosition(new V()).distanceTo(shin.getWorldPosition(new V()))+shin.getWorldPosition(new V()).distanceTo(foot.getWorldPosition(new V())),trail=Math.min(.22,speed*.025),sign=side==='R'?-1:1;
   // Detached legacy feet need to follow the shin while solving, then retain their ankle offset.
   if(foot.parent.name==='Root'){const offset=shin.worldToLocal(foot.getWorldPosition(new V()));const anchor=new THREE.Object3D();anchor.position.copy(offset);shin.add(anchor);limb(rig,layer,[hip.name,shin.name,anchor.name='flight-ankle-'+side],point([h.x+sign*.04,h.y-length*.975,h.z-trail+Math.sin(time*1.8+sign)*.025]),point([h.x,h.y-.3,h.z+.5]),weight);save(layer,foot,'position');foot.position.copy(foot.parent.worldToLocal(anchor.getWorldPosition(new V())));shin.remove(anchor);}else limb(rig,layer,[hip.name,shin.name,foot.name],point([h.x+sign*.04,h.y-length*.975,h.z-trail]),point([h.x,h.y-.3,h.z+.5]),weight);
  }
 }
 rig.updateMatrixWorld(true);
}
