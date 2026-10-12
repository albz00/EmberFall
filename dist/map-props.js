// Places a map's GLB model props. The game and the map editor share it, so both draw the same layout.
import * as THREE from './vendor/three.module.js';

// The model file each prop visual is cut from; station visuals are placed by the game's station code.
export const PROP_FILES={crate:'supply-crate.glb','rock-cluster':'rock-pack.glb',volcano:'volcano.glb'};

// Returns positioned models for every object using the visual. prepare() receives each clone before it is fitted.
export function placeMapProps(map,visual,models,prepare){
 const placed=[];
 for(const o of map.objects){
  if(map.prefabs[o.prefab].visual!==visual)continue;
  let model;
  if(visual==='crate'){model=prepare(models['supply-crate.glb'].scene.clone(true));model.scale.setScalar(1.15);model.rotation.y=o.rotation??0;model.userData.asset='supply-crate.glb';}
  else if(visual==='rock-cluster'){const original=models['rock-pack.glb'].scene.getObjectByName('Rock_'+o.variant);if(!original)continue;model=prepare(original.clone(true));const width=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).x;model.scale.multiplyScalar((o.scale??1)/Math.max(.1,width));model.rotation.y=o.rotation??0;}
  else if(visual==='volcano'){model=prepare(models['volcano.glb'].scene.clone(true));const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());model.scale.setScalar((o.scale??1)/Math.max(size.x,size.z));}
  else throw new Error('No model placement for prefab visual '+visual);
  model.position.set(o.x,o.y??0,o.z);model.userData.mapObject=o.id;placed.push(model);
 }
 return placed;
}
