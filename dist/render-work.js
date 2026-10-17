// Preserve source textures/geometry. Reuse cloned materials within one model and cache
// per-rig material lists; different characters still have independent damage tints.
const lists=new WeakMap();
export function invalidateMaterials(rig){lists.delete(rig);}
export function rigMaterials(rig){let list=lists.get(rig);if(!list){const unique=new Set();rig.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.color)unique.add(m);});list=[...unique];lists.set(rig,list);}return list;}
export function freezeStatic(root){root.updateWorldMatrix(true,true);root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;if(o.isMesh&&!o.isSkinnedMesh)o.frustumCulled=true;});return root;}
export function visualInterval(distance,visible=true){return visible?(distance>28?1/30:0):1/12;}
