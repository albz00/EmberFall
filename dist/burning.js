import * as THREE from './vendor/three.module.js';
const count=38,positions=new Float32Array(count*3),seeds=new Float32Array(count);
for(let i=0;i<count;i++){const angle=i*2.399;positions.set([Math.cos(angle)*(.18+i%3*.065),.1+i%7*.15,Math.sin(angle)*(.18+i%3*.065)],i*3);seeds[i]=i/count;}
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
export function updateBurning(actor,active,time){
 if(!actor.burning&&!active)return;
 if(!actor.burning){const material=new THREE.ShaderMaterial({uniforms:{time:{value:time}},vertexShader:`uniform float time;attribute float seed;varying float life;void main(){life=fract(seed+time*(.63+seed*.35));vec3 p=position;p.y+=life*.85;p.x+=sin(time*7.+seed*45.)*.07*life;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp((1.-life*.65)*185./max(.3,-v.z),2.,65.);}`,fragmentShader:`varying float life;void main(){vec2 uv=gl_PointCoord;float h=1.-uv.y;float sway=sin(h*8.+life*17.)*.055*h;float width=mix(.34,.015,pow(h,.82));float edge=1.-smoothstep(width*.63,width,abs(uv.x-.5-sway));float base=smoothstep(0.,.12,h),tip=1.-smoothstep(.85,1.,h);float a=edge*base*tip*(1.-life)*.86;if(a<.015)discard;vec3 c=mix(vec3(1.,.91,.5),vec3(1.,.15,.018),smoothstep(.08,.85,h+life*.22));gl_FragColor=vec4(c,a);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});actor.burning=new THREE.Points(geometry,material);actor.burning.name='burning-flames';actor.burning.frustumCulled=false;actor.root.add(actor.burning);}
 actor.burning.visible=active;actor.burning.material.uniforms.time.value=time;
}
