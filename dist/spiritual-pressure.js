import * as THREE from './vendor/three.module.js';
export const PRESSURE={radius:28,slow:.68};
export const pressureStrength=distance=>Math.max(0,1-distance/PRESSURE.radius);
export const pressureMultiplier=strength=>1-PRESSURE.slow*Math.max(0,Math.min(1,strength));
const lineGeometry=new THREE.BoxGeometry(1,1,1),moteGeometry=new THREE.OctahedronGeometry(1,0),ringGeometry=new THREE.TorusGeometry(1,.008,4,96),transform=new THREE.Object3D();
const material=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
export function createPressure(){
 const group=new THREE.Group();group.name='spiritual-pressure';group.userData.id='pressure';
 for(const [name,geometry,count,color,opacity]of[['pressure-lines',lineGeometry,360,0xa990ff,.5],['weighted-particles',moteGeometry,200,0xd7ccff,.82]]){
  const mesh=new THREE.InstancedMesh(geometry,material(color,opacity),count);mesh.name=name;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);
 }
 for(let i=0;i<5;i++){const ring=new THREE.Mesh(ringGeometry,material(i%2?0xdbd0ff:0x8d69ff,.32));ring.name='pressure-ring';ring.rotation.x=-Math.PI/2;ring.userData.phase=i/5;ring.frustumCulled=false;group.add(ring);}
 const veil=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,48,1,true).translate(0,.5,0),new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;varying vec2 vUv;void main(){float strands=pow(max(0.,sin(vUv.x*185.+sin(vUv.y*10.+time)*.7)),18.);float fall=pow(fract(vUv.y+time*.55),3.);float endFade=sin(vUv.y*3.14159);gl_FragColor=vec4(.42,.25,.85,strands*fall*endFade*.42);}`}));veil.name='pressure-curtain';veil.scale.set(2.3,22,2.3);veil.frustumCulled=false;group.add(veil);
 const light=new THREE.PointLight(0x8762e9,5,10,2);light.position.y=2;group.add(light);return group;
}
export function updatePressureVisual(group,time,{preview=false,alive=true}={}){
 group.visible=alive;if(!alive)return;const veil=group.getObjectByName('pressure-curtain');veil.visible=!preview;veil.material.uniforms.time.value=time;veil.rotation.y=Math.sin(time*.17)*.12;
 const lines=group.getObjectByName('pressure-lines'),motes=group.getObjectByName('weighted-particles');
 lines.count=preview?36:360;motes.count=preview?24:200;
 for(let i=0;i<lines.count;i++){
  const phase=(i/lines.count+time*(.22+i%5*.014))%1,a=i*2.399,r=preview?.7+(i%7)*.055:.85+Math.sqrt((i+.5)/lines.count)*26;
  const height=preview?2.8:13+(i%7)*2.2,fall=phase*phase,length=(preview?.28:1.1+(i%8)*.55)*Math.sin(phase*Math.PI);
  transform.position.set(Math.cos(a)*r,.13+(1-fall)*height,Math.sin(a)*r);transform.rotation.set(0,a,0);transform.scale.set(.014,length,.022);transform.updateMatrix();lines.setMatrixAt(i,transform.matrix);
 }
 for(let i=0;i<motes.count;i++){
  const phase=(i/motes.count+time*(.3+i%4*.025))%1,a=i*2.399+Math.sin(time*.13)*.02,r=preview?.65+(i%5)*.065:1+Math.sqrt((i+.5)/motes.count)*25;
  transform.position.set(Math.cos(a)*r,.08+(1-phase*phase)*(preview?2.3:3+(i%7)*.8),Math.sin(a)*r);transform.rotation.set(time+i,a,time*.3);const size=(.02+i%3*.009)*Math.sin(phase*Math.PI);transform.scale.set(size,size*(1+phase*2),size);transform.updateMatrix();motes.setMatrixAt(i,transform.matrix);
 }
 lines.instanceMatrix.needsUpdate=true;motes.instanceMatrix.needsUpdate=true;
 group.children.filter(o=>o.name==='pressure-ring').forEach((ring,i)=>{const p=(time*.32+ring.userData.phase)%1;ring.scale.setScalar(preview?.72+p*.12:i<2?.8+p*.25:1.2+p*25);ring.position.y=i<2?.1+(1-p)*2.1:.07;ring.material.opacity=(i<2?.5:.34)*Math.sin(p*Math.PI);});
}
