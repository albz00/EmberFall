import {CONFIG} from './shared/config.js?v=68';
import * as THREE from './vendor/three.module.js';
const V=THREE.Vector3,Q=THREE.Quaternion,Y=new V(0,1,0),FLIGHT=CONFIG.combat.flightPose;
export function makeCharacterPose(){return{bones:new Map(),saved:[],weight:0,flightBlend:0,flightVelocity:new V(),flightPhase:0,flightHover:0,flightAnchors:{},flightJoints:{},flightSolving:false,flightDt:0};}
export function restoreCharacterPose(layer){for(const p of layer.saved)p.bone[p.property].copy(p.value);layer.saved.length=0;}
function save(layer,bone,property='quaternion'){if(bone&&!layer.saved.some(p=>p.bone===bone&&p.property===property))layer.saved.push({bone,property,value:bone[property].clone()});}
function bone(layer,rig,name){if(!layer.bones.has(name))layer.bones.set(name,rig.getObjectByName(name));return layer.bones.get(name);}
function aim(layer,bone,end,target,weight){
 const origin=bone.getWorldPosition(new V()),current=end.getWorldPosition(new V()).sub(origin).normalize(),desired=target.clone().sub(origin).normalize();
 if(!current.lengthSq()||!desired.lengthSq())return;
 const world=bone.getWorldQuaternion(new Q()),parent=bone.parent.getWorldQuaternion(new Q());
 const rotation=new Q().setFromUnitVectors(current,desired).multiply(world).premultiply(parent.invert());
 save(layer,bone);
 if(layer.flightSolving){const desired=bone.quaternion.clone().slerp(rotation,weight),previous=layer.flightJoints[bone.uuid]??=bone.quaternion.clone();bone.quaternion.copy(previous).rotateTowards(desired,FLIGHT.jointRate*layer.flightDt);previous.copy(bone.quaternion);}else bone.quaternion.slerp(rotation,weight);
 bone.updateWorldMatrix(false,true);
}
// Two-joint targets preserve each avatar's actual limb lengths and bind orientation.
function limb(rig,layer,names,target,pole,weight){
 const [upper,lower,end]=names.map(n=>bone(layer,rig,n));if(!upper||!lower||!end)return;
 rig.updateMatrixWorld(true);const a=upper.getWorldPosition(new V()),b=lower.getWorldPosition(new V()),c=end.getWorldPosition(new V()),l1=a.distanceTo(b),l2=b.distanceTo(c);
 if(l1<.02||l2<.02)return;
 const delta=target.clone().sub(a),d=THREE.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.005,(l1+l2)*.997),axis=delta.normalize(),bend=pole.clone().sub(a);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
 const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
 aim(layer,upper,lower,elbow,weight);aim(layer,lower,end,a.clone().addScaledVector(axis,d),weight);
}
export function applyCharacterPose(rig,layer,actor,dt,{flying=false,blocking=false,attacking=false,disabled=false,armed=true,time=0,gaitPhase=0,drinking=false,drinkAge=0}={}){
 layer.flightDt=dt;layer.flightSolving=false;
 layer.flightBlend=THREE.MathUtils.damp(layer.flightBlend,flying&&!disabled?1:0,FLIGHT.blendRate,dt);layer.flightVelocity.lerp(actor.velocity??new V(),1-Math.exp(-FLIGHT.response*dt));layer.flightPhase+=dt*(1.65+Math.min(12,layer.flightVelocity.length())*.025);layer.flightHover=Math.sin(layer.flightPhase)*FLIGHT.hoverAmount*layer.flightBlend;if(layer.flightBlend<.001)layer.flightJoints={};
 layer.weight=THREE.MathUtils.damp(layer.weight,disabled||attacking?0:1,24,dt);const weight=layer.weight;if((weight<.001||disabled||attacking)&&layer.flightBlend<.001&&!drinking)return;
 rig.updateMatrixWorld(true);const point=v=>rig.localToWorld(new V(...v)),local=bone=>rig.worldToLocal(bone.getWorldPosition(new V()));
 const localVelocity=layer.flightVelocity.clone().applyQuaternion(rig.getWorldQuaternion(new Q()).invert()),travel=THREE.MathUtils.clamp(localVelocity.z/7,-1,1),sideTravel=THREE.MathUtils.clamp(localVelocity.x/7,-1,1);
 // Keep imported shoulder and elbow motion intact. Only an explicit guard lifts the arms.
 if(blocking&&!disabled&&!attacking)for(const side of ['L','R']){
  const shoulder=bone(layer,rig,'UpperArm'+side),hand=bone(layer,rig,'Wrist'+side),elbow=bone(layer,rig,'LowerArm'+side);if(!shoulder||!hand||!elbow)continue;
  const p=local(shoulder),sign=side==='R'?-1:1,length=shoulder.getWorldPosition(new V()).distanceTo(elbow.getWorldPosition(new V()))+elbow.getWorldPosition(new V()).distanceTo(hand.getWorldPosition(new V()));
  limb(rig,layer,['UpperArm'+side,'LowerArm'+side,'Wrist'+side],point([side==='R'?-.1:.17,p.y-length*.48,p.z+length*.65]),point([p.x+sign*.3,p.y-.3,p.z+.35]),weight);
 }
 // Correct the blade at the wrist, without replacing the authored arm poses.
 const hand=bone(layer,rig,'WristR'),weapon=hand?.children.find(o=>o.userData.slot==='sword'||o.userData.weapon);
 if(hand&&weapon&&armed&&!disabled&&!attacking){
  const desired=new V(blocking?.76:-.22,blocking?.58:.92,blocking?.28:.34).normalize().transformDirection(rig.matrixWorld),current=Y.clone().applyQuaternion(weapon.getWorldQuaternion(new Q()));
  const q=new Q().setFromUnitVectors(current,desired).multiply(hand.getWorldQuaternion(new Q())).premultiply(hand.parent.getWorldQuaternion(new Q()).invert());save(layer,hand);hand.quaternion.slerp(q,weight);hand.updateWorldMatrix(false,true);
 }
 if(layer.flightBlend>.001){
  layer.flightSolving=true;const flightWeight=layer.flightBlend;
  // Almost straight legs at rest; feet trail softly only while travelling.

  for(const side of ['L','R']){const hip=bone(layer,rig,'UpperLeg'+side),shin=bone(layer,rig,'LowerLeg'+side),foot=bone(layer,rig,'Foot'+side);if(!hip||!shin||!foot)continue;const h=local(hip),length=hip.getWorldPosition(new V()).distanceTo(shin.getWorldPosition(new V()))+shin.getWorldPosition(new V()).distanceTo(foot.getWorldPosition(new V())),trail=travel*.26,sign=side==='R'?-1:1,sway=Math.sin(layer.flightPhase+sign*.75)*.045;
   // Detached legacy feet need to follow the shin while solving, then retain their ankle offset.
   if(foot.parent.name==='Root'){const offset=shin.worldToLocal(foot.getWorldPosition(new V()));const anchor=layer.flightAnchors[side]??=new THREE.Object3D();anchor.position.copy(offset);shin.add(anchor);limb(rig,layer,[hip.name,shin.name,anchor.name='flight-ankle-'+side],point([h.x+sign*.055-sideTravel*.1,h.y-length*(.97+Math.sin(layer.flightPhase+sign)*.008),h.z-trail+sway]),point([h.x,h.y-.3,h.z+.5]),flightWeight);save(layer,foot,'position');foot.position.copy(foot.parent.worldToLocal(anchor.getWorldPosition(new V())));shin.remove(anchor);}else limb(rig,layer,[hip.name,shin.name,foot.name],point([h.x+sign*.055-sideTravel*.1,h.y-length*(.97+Math.sin(layer.flightPhase+sign)*.008),h.z-trail+sway]),point([h.x,h.y-.3,h.z+.5]),flightWeight);
  }
  if(!attacking&&!disabled&&!blocking&&!drinking)for(const side of ['L','R']){
   const shoulder=bone(layer,rig,'UpperArm'+side),elbow=bone(layer,rig,'LowerArm'+side),hand=bone(layer,rig,'Wrist'+side);if(!shoulder||!elbow||!hand)continue;
   const p=local(shoulder),sign=side==='R'?-1:1,length=shoulder.getWorldPosition(new V()).distanceTo(elbow.getWorldPosition(new V()))+elbow.getWorldPosition(new V()).distanceTo(hand.getWorldPosition(new V())),sway=Math.sin(layer.flightPhase+sign*.7);
   limb(rig,layer,[shoulder.name,elbow.name,hand.name],point([p.x+sign*(.12+sway*.035)-sideTravel*.07,p.y-length*.88+sway*.018,p.z-travel*.18+sway*.045]),point([p.x+sign*.32,p.y-.3,p.z+.12]),flightWeight);
  }
 }
 layer.flightSolving=false;
 if(layer.flightBlend>.001){const pitch=THREE.MathUtils.clamp(localVelocity.z*.018,-FLIGHT.maxLean,FLIGHT.maxLean),bank=THREE.MathUtils.clamp(-localVelocity.x*.015,-FLIGHT.maxLean*.7,FLIGHT.maxLean*.7);save(layer,rig);rig.quaternion.multiply(new Q().setFromEuler(new THREE.Euler(pitch*layer.flightBlend,0,(bank+Math.sin(layer.flightPhase)*.025)*layer.flightBlend)));}
 if(drinking){const shoulder=bone(layer,rig,'UpperArmL'),head=bone(layer,rig,'Head');if(shoulder&&head){const p=local(shoulder),mouth=local(head),weight=Math.min(1,drinkAge/.14)*Math.min(1,(.72-drinkAge)/.16);limb(rig,layer,['UpperArmL','LowerArmL','WristL'],point([mouth.x+.045,mouth.y-.09,mouth.z+.17]),point([p.x+.34,p.y-.18,p.z+.25]),Math.max(0,weight));}}
 rig.updateMatrixWorld(true);
}
