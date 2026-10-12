import * as THREE from './vendor/three.module.js';
const count=38,positions=new Float32Array(count*3),seeds=new Float32Array(count);
for(let i=0;i<count;i++){const angle=i*2.399;positions.set([Math.cos(angle)*(.18+i%3*.065),.1+i%7*.15,Math.sin(angle)*(.18+i%3*.065)],i*3);seeds[i]=i/count;}
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
export function updateBurning(actor,active,time){
 if(!actor.burning&&!active)return;
 if(!actor.burning){const material=new THREE.ShaderMaterial({uniforms:{time:{value:time}},vertexShader:`uniform float time;attribute float seed;varying float life;void main(){life=fract(seed+time*(.63+seed*.35));vec3 p=position;p.y+=life*.85;p.x+=sin(time*7.+seed*45.)*.07*life;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((1.-life*.65)*185./max(.3,-v.z),2.,65.);}`,fragmentShader:`varying float life;void main(){vec2 p=gl_PointCoord-.5;p.x*=1.5;float taper=1.-smoothstep(.06,.49,length(p));float edge=sin((p.y+life)*18.)*.035;float a=max(0.,taper+edge)*(1.-life)*.75;vec3 c=mix(vec3(1.,.8,.25),vec3(1.,.12,.015),clamp(life+gl_PointCoord.y*.45,0.,1.));gl_FragColor=vec4(c,a);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});actor.burning=new THREE.Points(geometry,material);actor.burning.name='burning-flames';actor.burning.frustumCulled=false;actor.root.add(actor.burning);}
 actor.burning.visible=active;actor.burning.material.uniforms.time.value=time;
}
