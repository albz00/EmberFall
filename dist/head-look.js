import * as THREE from './vendor/three.module.js';

const clamp=THREE.MathUtils.clamp,angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
const up=new THREE.Vector3(0,1,0),right=new THREE.Vector3(),axis=new THREE.Vector3();
const parentQ=new THREE.Quaternion(),inverseParentQ=new THREE.Quaternion(),rigQ=new THREE.Quaternion(),yawQ=new THREE.Quaternion(),pitchQ=new THREE.Quaternion(),rotation=new THREE.Quaternion();

export function makeHeadLook(rig){
 const bones=['Neck','Head'].map(name=>rig.getObjectByName(name)).filter(Boolean);
 return {bones:bones.map(bone=>({bone,base:bone.quaternion.clone()})),applied:false,yaw:0,pitch:0,bodyYaw:rig.rotation.y};
}
export function restoreHeadLook(look){
 if(!look?.applied)return;
 for(const {bone,base}of look.bones)bone.quaternion.copy(base);
 look.applied=false;
}
export function bodyFacing(look,lookYaw,velocity,dt,engaged=false){
 const speed=Math.hypot(velocity?.x??0,velocity?.z??0),delta=angle(lookYaw-look.bodyYaw);
 let target=look.bodyYaw;
 if(speed>.7){
  let movement=Math.atan2(velocity.x,velocity.z);
  if(Math.abs(angle(movement-lookYaw))>Math.PI/2)movement+=Math.PI;
  target=lookYaw+clamp(angle(movement-lookYaw),-.55,.55);
 }else if(engaged)target=lookYaw;
 else if(Math.abs(delta)>.98)target=lookYaw-Math.sign(delta)*.8;
 look.bodyYaw+=angle(target-look.bodyYaw)*(1-Math.exp(-dt*(engaged?12:7)));
 // Prevent an instant mouse turn from twisting the neck through the shoulders.
 look.bodyYaw=lookYaw-clamp(angle(lookYaw-look.bodyYaw),-1.15,1.15);
 return look.bodyYaw;
}
export function applyHeadLook(rig,look,lookYaw,lookPitch,dt,enabled=true){
 if(!look.bones.length)return;
 const blend=1-Math.exp(-dt*18);
 look.yaw=THREE.MathUtils.lerp(look.yaw,enabled?clamp(angle(lookYaw-rig.rotation.y),-1.15,1.15):0,blend);
 look.pitch=THREE.MathUtils.lerp(look.pitch,enabled?clamp(lookPitch,-.85,1):0,blend);
 rig.getWorldQuaternion(rigQ);
 axis.copy(up).applyQuaternion(rigQ);right.set(1,0,0).applyQuaternion(rigQ);
 // Apply in the rig's world axes, then convert back through each bone's parent.
 // This works on differently oriented source skeletons and keeps helmets attached.
 for(const entry of look.bones){
  const {bone,base}=entry;base.copy(bone.quaternion);
  const share=look.bones.length===1?1:bone.name==='Neck'?.25:.75;
  bone.parent.getWorldQuaternion(parentQ);inverseParentQ.copy(parentQ).invert();
  yawQ.setFromAxisAngle(axis,look.yaw*share);pitchQ.setFromAxisAngle(right,-look.pitch*share);
  rotation.copy(yawQ).multiply(pitchQ).premultiply(inverseParentQ).multiply(parentQ);
  bone.quaternion.premultiply(rotation);bone.updateWorldMatrix(false,false);
 }
 look.applied=true;
}
