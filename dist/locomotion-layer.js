import {gaitStride} from './combat.js?v=50';
import * as THREE from './vendor/three.module.js';
const V=THREE.Vector3,Q=THREE.Quaternion;
const lower=new Set(['Body','Hips','UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR']);
export function makeLocomotionLayer(rig,clips){
 const samples={};
 for(const name of ['Walk','Run','Sprint','CrouchWalk','Idle_Sword']){
  const clip=clips.find(c=>c.name===name);if(!clip)continue;
  samples[name]={duration:clip.duration,tracks:clip.tracks.map(t=>{const p=THREE.PropertyBinding.parseTrackName(t.name);return{bone:rig.getObjectByName(p.nodeName),property:p.propertyName,interpolant:t.createInterpolant()};}).filter(t=>t.bone&&lower.has(t.bone.name))};
 }
 rig.updateMatrixWorld(true);const hip=rig.getObjectByName('UpperLegL'),foot=rig.getObjectByName('FootL');
 const leg=hip&&foot?hip.getWorldPosition(new V()).distanceTo(foot.getWorldPosition(new V())):.8;
 return{samples,leg:THREE.MathUtils.clamp(leg,.45,1.1),phase:0,last:null,weight:0,speed:0,saved:[]};
}
export function restoreLocomotion(layer){
 for(const p of layer.saved)p.bone[p.property].copy(p.value);layer.saved.length=0;
}
function save(layer,bone,property){if(bone&&!layer.saved.some(p=>p.bone===bone&&p.property===property))layer.saved.push({bone,property,value:bone[property].clone()});}
export function applyLocomotion(rig,layer,actor,dt,{flying=false,disabled=false,attack=false,time=0}={}){
 const p=actor.position;if(!p)return;
 let distance=layer.last?Math.hypot(p.x-layer.last.x,p.z-layer.last.z):0;layer.last??=p.clone();layer.last.copy(p);
 if(distance>2||disabled){layer.weight=0;layer.speed=0;return;}
 const actual=distance/Math.max(.001,dt);layer.speed=THREE.MathUtils.damp(layer.speed,actual,18,dt);
 const speed=layer.speed,moving=actor.grounded&&speed>.12;
 layer.weight=THREE.MathUtils.damp(layer.weight,moving?1:0,20,dt);
 const name=flying?'Idle_Sword':actor.crouched?'CrouchWalk':speed>5.65?'Sprint':speed>3.45?'Run':'Walk',sample=layer.samples[name]??layer.samples.Run;
 if(!sample)return;
 const stride=gaitStride(layer.leg,speed,actor.crouched);
 const forward=(actor.velocity?.x??0)*Math.sin(rig.rotation.y)+(actor.velocity?.z??0)*Math.cos(rig.rotation.y);
 if(moving)layer.phase=(layer.phase+distance/stride*(forward<-.2?-1:1)+1)%1;
 const weight=flying?1:layer.weight;
 if(weight>.001){for(const t of sample.tracks){
  const value=t.interpolant.evaluate((flying?time*.35%1:layer.phase)*sample.duration),property=t.property;
  if(!['position','quaternion','scale'].includes(property))continue;save(layer,t.bone,property);
  if(property==='quaternion')t.bone.quaternion.slerp(new Q().fromArray(value),weight);else t.bone[property].lerp(new V().fromArray(value),weight);
 }}
 if(!flying)return;
 const body=rig.getObjectByName('Body');if(body){save(layer,body,'position');save(layer,body,'quaternion');body.position.y+=Math.sin(time*2.1)*.018;const local=new V(actor.velocity?.x??0,0,actor.velocity?.z??0).applyAxisAngle(new V(0,1,0),-rig.rotation.y);body.quaternion.multiply(new Q().setFromEuler(new THREE.Euler(THREE.MathUtils.clamp(local.z*.025,-.15,.18),0,THREE.MathUtils.clamp(-local.x*.02,-.12,.12))));}
}
