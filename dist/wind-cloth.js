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
  shader.fragmentShader=`varying vec2 clothUv;
 float crestSegment(vec2 p,vec2 a,vec2 b,float width){vec2 v=b-a;float t=clamp(dot(p-a,v)/dot(v,v),0.,1.);return 1.-smoothstep(width,width+.008,length(p-a-v*t));}
 `+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=clothUv-vec2(.5,.56);float crestMask=0.;
   // A pointed blade, crossguard, three swept wing feathers and shield edge.
   float blade=(1.-smoothstep(.018,.026,abs(p.x)))*step(-.095,p.y)*step(p.y,.16);
   float point=(1.-smoothstep(.0,.008,abs(p.x)-(.22-p.y)*.38))*step(.16,p.y)*step(p.y,.22);
   crestMask=max(blade,point);crestMask=max(crestMask,crestSegment(p,vec2(-.09,-.10),vec2(.09,-.10),.012));crestMask=max(crestMask,crestSegment(p,vec2(0.,-.10),vec2(0.,-.19),.015));
   for(int i=0;i<3;i++){float f=float(i),side=abs(p.x);crestMask=max(crestMask,crestSegment(vec2(side,p.y),vec2(.055,.03-f*.045),vec2(.21-f*.018,.14-f*.063),.012));}
   vec2 q=vec2(abs(p.x),p.y);float shield=max(crestSegment(q,vec2(.245,.21),vec2(.22,-.16),.007),crestSegment(q,vec2(.22,-.16),vec2(0.,-.31),.007));crestMask=max(crestMask,shield);
   vec3 gold=mix(vec3(.65,.32,.08),vec3(1.,.80,.37),clamp(clothUv.y,0.,1.));diffuseColor.rgb=mix(diffuseColor.rgb,gold,crestMask);`);
 };material.customProgramCacheKey=()=> 'emberfall-wind-cloth-v3';
 return{geometry,material,time,create(parent,width,height){const flag=new THREE.Mesh(geometry,material);flag.scale.set(width,height,1);flag.visible=false;flag.userData.noCameraCollision=true;flag.userData.cloth=true;parent.add(flag);return flag;},batch(parent,flags){parent.updateMatrixWorld(true);const batch=new THREE.InstancedMesh(geometry,material,flags.length);flags.forEach((f,i)=>batch.setMatrixAt(i,f.matrixWorld));batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();batch.boundingSphere.radius+=.7;batch.userData.noCameraCollision=true;batch.name='wind-cloth';parent.add(batch);return batch;}};
}
