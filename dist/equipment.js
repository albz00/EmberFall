import * as THREE from './vendor/three.module.js';

// Fit rigid equipment in the target bone's coordinates; keep the supplied art intact.
export function fitArmor(model,rig,fit){
  const bone=rig.getObjectByName(fit==='head'?'Head':'Chest');
  if(!bone)return null;
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const root=new THREE.Group();root.add(model);model.position.sub(center);
  if(fit==='head'){
    rig.updateMatrixWorld(true);const headBounds=new THREE.Box3(),point=new THREE.Vector3(),inverse=bone.matrixWorld.clone().invert();
    rig.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();
      const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,positions=mesh.geometry.attributes.position;
      if(!indices||!weights)return;
      for(let i=0;i<positions.count;i++){
        let influence=0;for(let j=0;j<4;j++)if(mesh.skeleton.bones[indices.getComponent(i,j)]?.name==='Head')influence+=weights.getComponent(i,j);
        if(influence<.45)continue;
        mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);headBounds.expandByPoint(point);
      }
    });
    if(headBounds.isEmpty())headBounds.set(new THREE.Vector3(-.18,0,-.18),new THREE.Vector3(.18,.35,.2));
    const headSize=headBounds.getSize(new THREE.Vector3());
    root.scale.set(Math.max(.34,headSize.x*1.13)/size.x,Math.max(.4,headSize.y*1.12)/size.y,Math.max(.38,headSize.z*1.13)/size.z);
    root.position.copy(headBounds.getCenter(new THREE.Vector3()));root.position.y+=.015;
  }else{
    root.scale.setScalar(.68/size.y);root.position.set(-.0046,-.128,.029);root.quaternion.set(-.0676475,.00223166,-.00108543,.9977062);
  }
  root.userData.equipment=true;root.userData.armor=true;bone.add(root);return root;
}
