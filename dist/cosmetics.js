import * as THREE from './vendor/three.module.js';
import {COSMETICS} from './progression.js?v=68';
import {createAscension,updateAscension} from './ascension.js?v=24';

import {createPressure,updatePressureVisual} from './spiritual-pressure.js?v=24';

// Bounded visual pools. Ascension's combat field is handled by the simulation.
const ringGeometry=new THREE.TorusGeometry(.79,.014,4,64);
const shardGeometry=new THREE.OctahedronGeometry(.038,0);
const flameGeometry=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.13,.08),new THREE.Vector2(.18,.24),new THREE.Vector2(.12,.47),new THREE.Vector2(.08,.7),new THREE.Vector2(0,1)],7);
const boltGeometry=new THREE.CylinderGeometry(.012,.012,1,4);
const up=new THREE.Vector3(0,1,0),start=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3();
const transform=new THREE.Object3D(),color=new THREE.Color();
export function disposeCosmetic(actor){
 if(!actor.cosmetic)return;
 actor.cosmetic.removeFromParent();
 actor.cosmetic.traverse(o=>{if(o.material)o.material.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});
 actor.cosmetic=null;
}
export function updateCosmetic(actor,id,time,moving=false){
 const data=COSMETICS[id];
 if(!data||id==='none'){disposeCosmetic(actor);return;}
 if(data.style==='ascension'){
  if(actor.cosmetic?.userData.id!==id){disposeCosmetic(actor);actor.cosmetic=createAscension();actor.root.add(actor.cosmetic);}
  updateAscension(actor.cosmetic,time,{preview:!!actor.preview,alive:actor.alive!==false,charge:actor.ascensionCharge??0});return;
 }
 if(data.style==='pressure'){if(actor.cosmetic?.userData.id!==id){disposeCosmetic(actor);actor.cosmetic=createPressure();actor.root.add(actor.cosmetic);}updatePressureVisual(actor.cosmetic,time,{preview:!!actor.preview,alive:actor.alive!==false});return;}
 if(actor.cosmetic?.userData.id!==id){
  disposeCosmetic(actor);const group=new THREE.Group();group.userData.id=id;
  for(let i=0;i<3;i++){
   const ring=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:data.colors[i%data.colors.length],transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending}));
   ring.rotation.x=Math.PI/2;group.add(ring);
  }
  const particles=new THREE.InstancedMesh(shardGeometry,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}),36);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.frustumCulled=false;group.add(particles);actor.root.add(group);actor.cosmetic=group;
  if(data.style==='flame'||data.style==='fusion'){
   for(const core of[false,true]){
    const flames=new THREE.InstancedMesh(flameGeometry,new THREE.MeshBasicMaterial({color:data.colors[core?1:0],transparent:true,opacity:core?.8:.45,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),24);
    flames.name=core?'flame-cores':'flames';flames.frustumCulled=false;flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(flames);
   }
  }
  if(data.style==='lightning'||data.style==='fusion'){
   const bolts=new THREE.InstancedMesh(boltGeometry,new THREE.MeshBasicMaterial({color:data.colors[0],transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}),84);
   bolts.name='lightning';bolts.frustumCulled=false;bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(bolts);
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(84*6),3).setUsage(THREE.DynamicDrawUsage));
   const cores=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:data.colors[1],transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending}));
   cores.name='lightning-cores';cores.userData.ownedGeometry=true;cores.frustumCulled=false;group.add(cores);
  }
 }
 const group=actor.cosmetic;group.visible=actor.alive!==false;
 const palette=data.colors,prism=id==='prism',orbital=['glacier','starfall','hex'].includes(id);
 group.children.slice(0,3).forEach((ring,i)=>{
  ring.material.color.setHex(palette[i%palette.length]);if(prism)ring.material.color.setHSL((time*.09+i*.23)%1,.8,.66);
  ring.material.opacity=(data.style?.15:.36)+Math.sin(time*2+i)*.08;
  ring.position.y=i===0?.07:.18+i*.15+Math.sin(time*1.5+i)*.08;
  ring.scale.setScalar(i===0?1.1:orbital?.78+i*.15:.65+i*.2);
  ring.rotation.set(Math.PI/2+(orbital&&i?Math.sin(time*.7+i)*.7:0),orbital&&i?Math.cos(time*.6+i)*.35:0,time*(i%2?-1:1)*.35);
 });
 const particles=group.children[3];
 for(let i=0;i<36;i++){
  const phase=(i/36+time*(id==='ember'?.24:.13))%1,angle=i*2.399+time*(i%2?-.7:.7),radius=.55+Math.sin(i*13.7)*.22;
  transform.position.set(Math.cos(angle)*radius,.15+phase*(orbital?1.65:2.1),Math.sin(angle)*radius);
  if(moving)transform.position.z+=Math.sin(i*4.1)*phase*.25;
  transform.rotation.set(time+i,angle,time*.5);
  transform.scale.setScalar(Math.sin(phase*Math.PI)*(id==='starfall'?1.3:1));transform.updateMatrix();particles.setMatrixAt(i,transform.matrix);
  color.setHex(palette[i%palette.length]);if(prism)color.setHSL((time*.09+i/36)%1,.8,.65);particles.setColorAt(i,color);
 }
 particles.instanceMatrix.needsUpdate=true;if(particles.instanceColor)particles.instanceColor.needsUpdate=true;
 const flames=group.getObjectByName('flames'),flameCores=group.getObjectByName('flame-cores');
 if(flames){
  for(let i=0;i<24;i++){
   const phase=(i/24+time*(id==='soulfire'?.48:.72))%1,angle=i*2.399+time*.38,radius=.48+Math.sin(i*7.2)*.16+phase*.13;
   const envelope=Math.sin(phase*Math.PI),height=(id==='hellfire'?1.05:.82)*envelope;
   transform.position.set(Math.cos(angle)*radius,.04+phase*1.7,Math.sin(angle)*radius);
   transform.rotation.set(Math.sin(time*5+i)*.17,angle,Math.cos(time*6+i)*.18);
   transform.scale.set(.65*envelope,height,.65*envelope);transform.updateMatrix();flames.setMatrixAt(i,transform.matrix);
   transform.scale.multiply(new THREE.Vector3(.47,.64,.47));transform.updateMatrix();flameCores.setMatrixAt(i,transform.matrix);
  }
  flames.instanceMatrix.needsUpdate=true;flameCores.instanceMatrix.needsUpdate=true;
 }
 const bolts=group.getObjectByName('lightning'),cores=group.getObjectByName('lightning-cores');
 if(bolts){
  const pulse=Math.floor(time*11),positions=cores.geometry.attributes.position;let index=0;
  const segment=(a,b)=>{
   direction.copy(b).sub(a);transform.position.copy(a).add(b).multiplyScalar(.5);transform.quaternion.setFromUnitVectors(up,direction.clone().normalize());transform.scale.set(1,direction.length(),1);transform.updateMatrix();bolts.setMatrixAt(index,transform.matrix);
   positions.setXYZ(index*2,a.x,a.y,a.z);positions.setXYZ(index*2+1,b.x,b.y,b.z);index++;
  };
  for(let arc=0;arc<7;arc++){
   const angle=arc*Math.PI*2/7+time*.22,base=arc%2?.25:.05,span=arc%2?1.9:1.45,radius=.68+(arc%2)*.05;
   start.set(Math.cos(angle)*radius,base,Math.sin(angle)*radius);
   for(let step=1;step<=9;step++){
    const jitter=Math.sin(step*19.3+arc*13.1+pulse*9.7)*.19,theta=angle+step*.055;
    end.set(Math.cos(theta)*(radius+jitter),base+span*step/9,Math.sin(theta)*(radius+jitter));segment(start,end);start.copy(end);
    if(step===5){const branch=start.clone();for(let fork=1;fork<=3;fork++){const tip=branch.clone().add(new THREE.Vector3(Math.cos(angle+1.2)*.13,.1,Math.sin(angle+1.2)*.13));segment(branch,tip);branch.copy(tip);}}
   }
  }
  bolts.material.opacity=.5+.27*(.5+.5*Math.sin(time*7));bolts.instanceMatrix.needsUpdate=true;positions.needsUpdate=true;
 }
}
export function cosmeticPreview(id){
 const c=COSMETICS[id],flame=['flame','fusion'].includes(c.style),bolt=['lightning','fusion','ascension'].includes(c.style);return `<div class="cosmetic-preview effect-${id} ${flame?'effect-flames':''} ${bolt?'effect-lightning':''}" style="--effect-a:#${c.colors[0].toString(16).padStart(6,'0')};--effect-b:#${c.colors[1].toString(16).padStart(6,'0')}"><div class="effect-figure"><i></i><b></b></div><span></span><span></span><span></span>${Array.from({length:12},(_,i)=>`<i class="effect-spark" style="--n:${i}"></i>`).join('')}${flame?Array.from({length:9},(_,i)=>`<b class="preview-flame" style="--n:${i}"></b>`).join(''):''}${bolt?Array.from({length:5},(_,i)=>`<b class="preview-bolt" style="--n:${i}"></b>`).join(''):''}</div>`;
}
