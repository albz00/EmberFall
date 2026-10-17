import * as THREE from './vendor/three.module.js';
// Retain the authored three-lobe torch look, colors and phase, in a single draw.
export function batchFlames(parent,fires){
 const geometry=new THREE.IcosahedronGeometry(1,0),time={value:0},material=new THREE.MeshBasicMaterial({color:0xffffff});
 geometry.setAttribute('flamePhase',new THREE.InstancedBufferAttribute(new Float32Array(fires.map(f=>f.phase)),1));
 material.onBeforeCompile=shader=>{shader.uniforms.flameTime=time;shader.vertexShader='uniform float flameTime; attribute float flamePhase;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 transformed.y*=1.+sin(flameTime*7.+flamePhase)*.11;
 transformed.x+=sin(flameTime*5.+flamePhase)*.045/max(length(instanceMatrix[0].xyz),.001);`);};
 material.customProgramCacheKey=()=> 'emberfall-torch-flames-v1';
 const mesh=new THREE.InstancedMesh(geometry,material,fires.length);mesh.name='torch-flames';mesh.userData.noCameraCollision=true;
 fires.forEach((f,i)=>{mesh.setMatrixAt(i,f.mesh.matrixWorld);mesh.setColorAt(i,f.mesh.material.color);f.mesh.removeFromParent();f.mesh.geometry.dispose();f.mesh.material.dispose();});
 mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.08;parent.add(mesh);return{mesh,time};
}
