import * as THREE from './vendor/three.module.js';

export const ASCENSION={radius:72,wind:17,interval:1,nearDamage:3,farDamage:2};
export function ascensionStrength(distance){return Math.max(0,1-distance/ASCENSION.radius);}

// Reused geometry and bounded instance pools: the column and its wind do not
// create new meshes each frame, even while the effect is active indefinitely.
const columnGeometry=new THREE.CylinderGeometry(1,1,1,32,32,true).translate(0,.5,0);
const sparkGeometry=new THREE.OctahedronGeometry(1,0);
const ringGeometry=new THREE.TorusGeometry(1,.009,4,96);
const streakGeometry=new THREE.BoxGeometry(1,1,1);
const transform=new THREE.Object3D(),tint=new THREE.Color();
const glow=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const orbGeometry=new THREE.IcosahedronGeometry(1,3);
export function createChargeOrb(){
 const group=new THREE.Group(),visual=new THREE.Group();group.name='charge-orb';group.add(visual);
 const core=new THREE.Mesh(orbGeometry,new THREE.ShaderMaterial({uniforms:{time:{value:0},power:{value:0}},transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec3 vNormal;varying vec3 vView;varying vec3 vP;void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;vP=position;gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float time;uniform float power;varying vec3 vNormal;varying vec3 vView;varying vec3 vP;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.3);float ribbon=pow(max(0.,sin(vP.y*17.+atan(vP.x,vP.z)*3.-time*(2.+power*3.))),14.);float wave=.7+.3*sin(time*2.1+vP.y*9.);vec3 c=mix(vec3(.32,.17,1.),vec3(.88,.8,1.),rim);float a=rim*(.42+power*.25)+ribbon*.055*wave;gl_FragColor=vec4(c*1.45,a);}`}));core.name='orb-core';visual.add(core);
 const shell=new THREE.Mesh(orbGeometry,glow(0xac9aff,.018));shell.scale.setScalar(1.08);visual.add(shell);
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(ringGeometry,glow(i===0?0xf1ddff:0x9c8aff,.7));ring.name='orb-ring';ring.scale.setScalar(1.12+i*.1);visual.add(ring);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*16*6),3).setUsage(THREE.DynamicDrawUsage));
 const arcs=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xd6cbff,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));arcs.name='orb-electricity';arcs.frustumCulled=false;arcs.userData.ownedGeometry=true;visual.add(arcs);return group;
}
export function updateChargeOrb(group,time,power=0,held=false){
 const p=THREE.MathUtils.clamp(power,0,1),visual=group.children[0],radius=held?1+p*.2:.35+p*2.65;
 visual.scale.setScalar(radius);group.userData.radius=radius;const shader=visual.getObjectByName('orb-core').material;shader.uniforms.time.value=time;shader.uniforms.power.value=p;
 visual.children.filter(o=>o.name==='orb-ring').forEach((ring,i)=>{ring.rotation.set(.45+i*.72,time*(.3+p)*(i%2?-1:1),time*.4+i);ring.material.opacity=.45+p*.35;});
 const arcs=visual.getObjectByName('orb-electricity'),positions=arcs.geometry.attributes.position,count=4+Math.floor(p*8),pulse=Math.floor(time*(6+p*17));let n=0;
 for(let arc=0;arc<count;arc++){let previous=null;for(let j=0;j<=16;j++){
  const a=j/16*Math.PI*1.75+arc*.6,r=1.12+Math.sin(j*13+arc*8+pulse)*(.045+p*.14),tilt=arc*2.399;
  const point=[Math.cos(a)*r,Math.sin(a)*Math.cos(tilt)*r,Math.sin(a)*Math.sin(tilt)*r];
  if(previous){positions.setXYZ(n++,...previous);positions.setXYZ(n++,...point);}previous=point;
 }}arcs.geometry.setDrawRange(0,n);positions.needsUpdate=true;arcs.material.opacity=.45+p*.45;
}
function pool(group,name,geometry,material,count){const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(mesh);return mesh;}
function column(color,opacity,radius,height,phase){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  uniforms:{time:{value:0},tint:{value:new THREE.Color(color)},opacity:{value:opacity},phase:{value:phase}},
  vertexShader:`uniform float time; uniform float phase; varying vec2 vUv;
   void main(){vUv=uv;vec3 p=position;float h=p.y;float a=atan(p.z,p.x);
    float taper=mix(1.0,.12,smoothstep(.12,1.0,h));
    float jagged=1.0+.13*sin(a*7.0+h*18.0-time*3.1+phase)+.08*sin(a*11.0-h*28.0+time*2.7);
    p.xz*=taper*jagged;p.x+=sin(h*10.0-time*1.5+phase)*h*.16;p.z+=cos(h*8.0-time*1.8)*h*.16;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`uniform float time;uniform float phase;uniform vec3 tint;uniform float opacity;varying vec2 vUv;
   void main(){float flow=.64+.36*sin(vUv.x*50.265+vUv.y*24.0-time*5.0+phase);
    float fade=smoothstep(.065,.13,vUv.y)*(1.0-smoothstep(.72,1.0,vUv.y));
    gl_FragColor=vec4(tint,opacity*flow*fade);}`});
 const mesh=new THREE.Mesh(columnGeometry,material);mesh.scale.set(radius,height,radius);mesh.name='sky-column';mesh.frustumCulled=false;return mesh;
}
export function createAscension(){
 const group=new THREE.Group();group.name='ascension-aura';group.userData.id='ascension';
 // Keep the silhouette clear: no flame meshes around the body or white core.
 // The two translucent outer columns begin above the character's head.
 group.add(column(0xff9c16,.11,2.15,44,0),column(0xffdf45,.12,1.42,48,2));
 pool(group,'ascension-sparks',sparkGeometry,glow(0xffe88c,.8),120);
 pool(group,'ascension-debris',sparkGeometry,new THREE.MeshStandardMaterial({color:0x8d7060,roughness:1,flatShading:true}),28);
 pool(group,'ascension-wind',streakGeometry,glow(0xffe7ab,.22),112);
 for(let i=0;i<5;i++){const ring=new THREE.Mesh(ringGeometry,glow(i%2?0xfff3ba:0xffbb41,.3));ring.name='pressure-wave';ring.rotation.x=-Math.PI/2;ring.userData.phase=i/5;ring.frustumCulled=false;group.add(ring);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6*14*6),3).setUsage(THREE.DynamicDrawUsage));
 const lightning=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xfff5c8,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending}));lightning.name='ascension-lightning';lightning.userData.ownedGeometry=true;lightning.frustumCulled=false;group.add(lightning);
 const light=new THREE.PointLight(0xffce55,6,9,2);light.name='ascension-light';light.position.y=2.3;group.add(light);
 const orb=createChargeOrb();orb.name='ascension-charge-orb';orb.visible=false;group.add(orb);
 return group;
}
export function updateAscension(group,time,{preview=false,alive=true,charge=0}={}){
 group.visible=alive;if(!alive)return;
 const reverse=charge>0,power=THREE.MathUtils.clamp(charge,0,1);group.userData.charge=power;
 const orb=group.getObjectByName('ascension-charge-orb');orb.visible=reverse&&!preview;if(orb.visible){updateChargeOrb(orb,time,power);orb.position.y=3.3+orb.userData.radius;}
 for(const child of group.children)if(child.name==='sky-column'){child.visible=!preview;child.material.uniforms.time.value=reverse?-time:time;child.material.uniforms.tint.value.setHex(reverse?0x9b83ff:child.scale.y===44?0xff9c16:0xffdf45);}
 const sparks=group.getObjectByName('ascension-sparks');sparks.count=preview?40:120;
 for(let i=0;i<sparks.count;i++){
  const phase=(i/sparks.count+time*(i%3===0?.38:.19))%1,a=i*2.399+time*.32,radius=1.1+Math.sin(i*4.2)*.35+phase*(preview?.25:1.9);
  transform.position.set(Math.cos(a)*radius,.12+(reverse?1-phase:phase)*(preview?3.5:i%3===0?5:39),Math.sin(a)*radius);transform.rotation.set(0,a,0);
  const size=(.018+(i%4)*.008)*Math.sin(phase*Math.PI);transform.scale.set(size,size*(i%3===0?2.3:9),size);transform.updateMatrix();sparks.setMatrixAt(i,transform.matrix);
  tint.setHex(reverse?(i%2?0xc7b8ff:0x9477ff):i%4===0?0xffffff:i%2?0xfff5ac:0xffc24c);sparks.setColorAt(i,tint);
 }
 sparks.instanceMatrix.needsUpdate=true;sparks.instanceColor.needsUpdate=true;
 const debris=group.getObjectByName('ascension-debris');debris.visible=!preview;
 for(let i=0;i<28;i++){const phase=(i/28+time*.21)%1,a=i*2.399+phase*.6,radius=reverse?1.5+(1-phase)*9:1.5+phase*5.5;
  transform.position.set(Math.cos(a)*radius,.07+Math.sin(phase*Math.PI)*(.6+i%5*.35),Math.sin(a)*radius);transform.rotation.set(time+i,time*.8+i,time*.3);
  transform.scale.setScalar((.07+i%4*.034)*Math.sin(phase*Math.PI));transform.updateMatrix();debris.setMatrixAt(i,transform.matrix);}
 debris.instanceMatrix.needsUpdate=true;
 const wind=group.getObjectByName('ascension-wind');wind.visible=!preview;
 for(let i=0;i<112;i++){const phase=(i/112+time*(reverse?.5+power*.35:.44))%1,a=i*2.399,radius=2+(reverse?1-phase:phase)*58;
  transform.position.set(Math.cos(a)*radius,.15+Math.sin(i*2.5)**2*1.7,Math.sin(a)*radius);transform.rotation.set(0,-a,0);
  const fade=Math.sin(phase*Math.PI);transform.scale.set((.65+phase*2.7)*fade,.012*fade,.025*fade);transform.updateMatrix();wind.setMatrixAt(i,transform.matrix);}
 wind.instanceMatrix.needsUpdate=true;wind.material.color.setHex(reverse?0xb7a1ff:0xffe7ab);
 for(const ring of group.children.filter(o=>o.name==='pressure-wave')){const p=(time*(reverse?.35:.28)+ring.userData.phase)%1,radius=preview?.65+p*.7:1.4+(reverse?1-p:p)*59;ring.scale.setScalar(radius);ring.position.y=.1+p*.25;ring.material.opacity=(preview?.23:.32)*(1-p)**2;ring.material.color.setHex(reverse?0xa18aff:0xffcf72);}
 const lightning=group.getObjectByName('ascension-lightning'),positions=lightning.geometry.attributes.position,pulse=Math.floor(time*9);let n=0;
 for(let arc=0;arc<6;arc++){let previous=null;for(let step=0;step<=14;step++){
  const h=step/14,a=arc*Math.PI/3+h*.6+time*.18,jitter=Math.sin(step*17.3+arc*7.9+pulse)*(.2+power*.2),r=reverse?1.4+jitter+(1-h)*(4+power*8):1.35+jitter+h*.2;
  const point=[Math.cos(a)*r,.12+h*(preview?2.8:reverse?orb.position.y:arc%3===0?27:4.6),Math.sin(a)*r];
  if(previous){positions.setXYZ(n++,...previous);positions.setXYZ(n++,...point);}previous=point;
 }}positions.needsUpdate=true;lightning.material.opacity=.46+power*.27+Math.sin(time*4)*.12;lightning.material.color.setHex(reverse?0xddd3ff:0xfff5c8);
 const light=group.getObjectByName('ascension-light');light.intensity=preview?3:6+power*2+Math.sin(time*2);light.color.setHex(reverse?0xae93ff:0xffce55);
}
