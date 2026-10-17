import * as THREE from './vendor/three.module.js';
// Narrow tongues taper into asymmetric tips. All torch lobes retain their
// authored positions/colors and share one instanced draw with GPU flutter.
export function flameGeometry(){
 const rings=[[-.62,.08,0],[-.43,.6,0],[-.04,.8,.02],[.39,.45,-.1],[.76,.19,.13],[1.12,0,.25]],segments=7,vertices=[],indices=[];
 for(let j=0;j<rings.length;j++){const [y,r,x]=rings[j];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;vertices.push(x+Math.cos(a)*r,y,Math.sin(a)*r);}}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*segments+i,b=j*segments+(i+1)%segments,c=a+segments,e=b+segments;indices.push(a,c,b,b,c,e);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function batchFlames(parent,fires){
 const geometry=flameGeometry(),time={value:0},material=new THREE.MeshBasicMaterial({color:0xffffff});
 geometry.setAttribute('flamePhase',new THREE.InstancedBufferAttribute(new Float32Array(fires.map(f=>f.phase)),1));
 material.onBeforeCompile=shader=>{shader.uniforms.flameTime=time;shader.vertexShader='uniform float flameTime; attribute float flamePhase; varying float flameHeight;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 flameHeight=clamp((position.y+.62)/1.74,0.,1.);
 transformed.y*=1.+sin(flameTime*9.+flamePhase)*.09;
 transformed.x+=pow(flameHeight,1.7)*(sin(flameTime*6.+flamePhase+position.y*3.)*.17+sin(flameTime*13.+flamePhase)*.045);
 transformed.z+=flameHeight*sin(flameTime*7.3+flamePhase+position.y*2.)*.08;`);
 shader.fragmentShader='varying float flameHeight;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 diffuseColor.rgb=mix(diffuseColor.rgb*vec3(1.,1.13,.65),vec3(1.,.23,.025),flameHeight*.55);`);};
 material.customProgramCacheKey=()=> 'emberfall-torch-flames-v2';
 const mesh=new THREE.InstancedMesh(geometry,material,fires.length);mesh.name='torch-flames';mesh.userData.noCameraCollision=true;
 fires.forEach((f,i)=>{mesh.setMatrixAt(i,f.mesh.matrixWorld);mesh.setColorAt(i,f.mesh.material.color);f.mesh.removeFromParent();f.mesh.geometry.dispose();f.mesh.material.dispose();});
 mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.18;parent.add(mesh);return{mesh,time};
}
