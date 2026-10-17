import * as THREE from './vendor/three.module.js';
// Pinned upper hems, gravity-hung pennants, broad gusts and smaller travelling folds.
// All flags share one instanced draw; deformation stays on the GPU and has no collider.
export function makeWindCloth(){
 const geometry=new THREE.PlaneGeometry(1,1,8,12),p=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<p.count;i++){const u=uv.getX(i),v=uv.getY(i);p.setY(i,-(1-v)*(1-.14*Math.pow(Math.abs(u-.5)*2,6)));}geometry.computeBoundingSphere();
 const time={value:0},material=new THREE.MeshStandardMaterial({color:0x9f4146,roughness:1,side:THREE.DoubleSide});
 material.onBeforeCompile=shader=>{shader.uniforms.clothTime=time;shader.vertexShader=`uniform float clothTime; varying vec2 clothUv;
 float clothSeed(){
 #ifdef USE_INSTANCING
 vec3 anchor=instanceMatrix[3].xyz;
 #else
 vec3 anchor=modelMatrix[3].xyz;
 #endif
 return fract(sin(dot(anchor,vec3(12.9898,37.719,78.233)))*43758.5453);
 }
 `+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
 float normalSeed=clothSeed(),normalTime=clothTime*(.76+normalSeed*.57),normalPhase=normalSeed*31.4;objectNormal.x-=(1.-uv.y)*cos(uv.y*8.-normalTime*3.2+normalPhase+uv.x*2.2)*(.09+normalSeed*.07);objectNormal.y+=(1.-uv.y)*sin(uv.y*8.-normalTime*3.2+normalPhase)*.08;objectNormal=normalize(objectNormal);`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   clothUv=uv;float freeHem=1.-uv.y;float seed=clothSeed(),phase=seed*31.4,localTime=clothTime*(.76+seed*.57),strength=.75+seed*.6;
   float gust=.55+.32*sin(clothTime*.61+phase)+.13*sin(localTime*.93+phase*2.);
   float fold=sin(uv.y*(7.+seed*3.)-localTime*3.2+phase+uv.x*2.2);
   transformed.z+=freeHem*freeHem*strength*(.13+gust*.14+fold*.12+sin(uv.y*17.+uv.x*6.-localTime*5.+phase)*.025);
   transformed.x+=freeHem*freeHem*sin(localTime*1.4+uv.y*5.+phase)*(.02+seed*.018);
   transformed.y+=freeHem*freeHem*(.018+sin(localTime*2.+uv.x*5.+phase)*.018);`);
  shader.fragmentShader='varying vec2 clothUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float diamond=abs(clothUv.x-.5)*3.6+abs(clothUv.y-.57)*5.;float mark=1.-smoothstep(.28,.31,diamond);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.39,.12),mark);`);
 };material.customProgramCacheKey=()=> 'emberfall-wind-cloth-v2';
 return{geometry,material,time,create(parent,width,height){const flag=new THREE.Mesh(geometry,material);flag.scale.set(width,height,1);flag.visible=false;flag.userData.noCameraCollision=true;flag.userData.cloth=true;parent.add(flag);return flag;},batch(parent,flags){parent.updateMatrixWorld(true);const batch=new THREE.InstancedMesh(geometry,material,flags.length);flags.forEach((f,i)=>batch.setMatrixAt(i,f.matrixWorld));batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();batch.boundingSphere.radius+=.7;batch.userData.noCameraCollision=true;batch.name='wind-cloth';parent.add(batch);return batch;}};
}
