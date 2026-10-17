import {DUEL_MAP} from './shared/duel-data.js?v=68';
import {MAP,groundHeight} from './shared/map.js?v=68';
import * as THREE from './vendor/three.module.js';

export const MINI=DUEL_MAP;
export const TEAM_COLORS={blue:0x78d8ff,red:0xff738d};
export const inMiniArena=(x,z)=>x>64;
export const MINI_COVER=DUEL_MAP.cover;
const solidShapes=[...MINI_COVER,...DUEL_MAP.terraces];
const terraceAt=(t,x,z)=>terraceHeight(t,Math.max(t.x-t.w/2,Math.min(t.x+t.w/2,x)),Math.max(t.z-t.d/2,Math.min(t.z+t.d/2,z)))??0;
export function miniBlocked(x,z,y=0,padding=.6){
 if(Math.abs(x-MINI.x)>MINI.halfWidth-padding||Math.abs(z)>MINI.halfDepth-padding)return true;
 return DUEL_MAP.terraces.some(t=>{const h=terraceHeight(t,Math.max(t.x-t.w/2,Math.min(t.x+t.w/2,x)),Math.max(t.z-t.d/2,Math.min(t.z+t.d/2,z)));return y<h-.65&&Math.abs(x-t.x)<t.w/2+padding&&Math.abs(z-t.z)<t.d/2+padding;})||MINI_COVER.some(c=>y<c.h&&Math.abs(x-c.x)<c.w/2+padding&&Math.abs(z-c.z)<c.d/2+padding);
}
export function terraceHeight(t,x,z){if(Math.abs(x-t.x)>t.w/2||Math.abs(z-t.z)>t.d/2)return null;return t.type==='flat'?t.height:t.height*(t.rises==='+z'?(z-t.z+t.d/2)/t.d:1-(z-t.z+t.d/2)/t.d);}
export function miniGround(x,z,feet=100){let h=0;for(const t of DUEL_MAP.terraces){const y=terraceHeight(t,x,z);if(y!==null&&feet>=y-.65)h=Math.max(h,y);}for(const c of MINI_COVER)if(Math.abs(x-c.x)<c.w/2&&Math.abs(z-c.z)<c.d/2&&feet>c.h-.35)h=Math.max(h,c.h);return h;}

export function miniResolve(p,radius=.38){
 p.x=THREE.MathUtils.clamp(p.x,MINI.x-MINI.halfWidth+radius,MINI.x+MINI.halfWidth-radius);p.z=THREE.MathUtils.clamp(p.z,-MINI.halfDepth+radius,MINI.halfDepth-radius);
 for(const c of solidShapes){const h=c.h??terraceAt(c,p.x,p.z)-.55;if(p.y>=h-.1)continue;const minX=c.x-c.w/2-radius,maxX=c.x+c.w/2+radius,minZ=c.z-c.d/2-radius,maxZ=c.z+c.d/2+radius;if(p.x>minX&&p.x<maxX&&p.z>minZ&&p.z<maxZ){const sides=[{distance:p.x-minX,axis:'x',value:minX},{distance:maxX-p.x,axis:'x',value:maxX},{distance:p.z-minZ,axis:'z',value:minZ},{distance:maxZ-p.z,axis:'z',value:maxZ}].sort((a,b)=>a.distance-b.distance);p[sides[0].axis]=sides[0].value;}}
 return p;
}
export function assignTeams(player,bots){
 if(bots.length!==3)throw new Error('2v2 requires exactly three opponents.');
 const strength=a=>a.skill?.cps??9.4,total=bots.reduce((n,b)=>n+strength(b),0),p=strength(player);
 const ally=[...bots].sort((a,b)=>Math.abs(p+2*strength(a)-total)-Math.abs(p+2*strength(b)-total))[0];
 return{blue:[player,ally],red:bots.filter(b=>b!==ally)};
}
export function matchOutcome(teams,player,timeout=false){
 const alive=a=>a===player?a.health>0:a.alive;
 const blue=teams.blue.filter(alive),red=teams.red.filter(alive);
 if(!blue.length&&!red.length)return'draw';if(!blue.length)return'red';if(!red.length)return'blue';
 if(!timeout)return null;
 if(blue.length!==red.length)return blue.length>red.length?'blue':'red';
 const health=list=>list.reduce((n,a)=>n+(a===player?a.health/a.maxHealth:a.hp/a.kit.health),0);
 const difference=health(blue)-health(red);return Math.abs(difference)<.03?'draw':difference>0?'blue':'red';
}
export function buildMiniArena(scene){
 const root=new THREE.Group();root.name='Duel courtyard';scene.add(root);
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true});
 const stone=mat(0x655566),edge=mat(0x342c43),cap=mat(0x96818a),timber=mat(0x694d47);
 const mesh=(geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 const block=(x,y,z,w,h,d,material=stone)=>mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);
 // Separate courtyard, 96 metres east of the main arena. Two broken columns
 // create crossfire routes; low cover at opposite corners supports bow play.
 const shape=new THREE.Shape();const w=MINI.halfWidth+.5,d=MINI.halfDepth+.5;shape.moveTo(-w+1,-d);shape.lineTo(w-1,-d);shape.lineTo(w,-d+1);shape.lineTo(w,d-1);shape.lineTo(w-1,d);shape.lineTo(-w+1,d);shape.lineTo(-w,d-1);shape.lineTo(-w,-d+1);shape.closePath();
 const floor=mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSize:.25,bevelThickness:.2,bevelSegments:1,steps:1}),stone,MINI.x,-1.2,0);floor.rotation.x=-Math.PI/2;
 for(const x of[-w,w]){block(MINI.x+x,1,MINI.z,.85,2,d*2,edge);block(MINI.x+x,2.1,MINI.z,1.12,.22,d*2,cap);}
 for(const z of[-d,d]){block(MINI.x,1,MINI.z+z,w*2,2,.85,edge);block(MINI.x,2.1,MINI.z+z,w*2,.22,1.12,cap);}
 for(const c of MINI_COVER){block(c.x,(c.h-.2)/2,c.z,c.w,c.h-.2,c.d);block(c.x,c.h-.1,c.z,c.w+.22,.2,c.d+.22,cap);for(const side of[-1,1])block(c.x+side*(c.w/2-.2),c.h/2,c.z,.18,c.h+.1,c.d+.08,timber);}
 for(const x of[-w+.8,w-.8])for(const z of[-d+1.2,-8,8,d-1.2]){
  mesh(new THREE.CylinderGeometry(.72,.92,3.8,7),edge,MINI.x+x,1.9,z);mesh(new THREE.ConeGeometry(1,1.3,7),cap,MINI.x+x,4.35,z);
  const color=z<0?TEAM_COLORS.red:TEAM_COLORS.blue,glow=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.2,roughness:.4});mesh(new THREE.IcosahedronGeometry(.3,0),glow,MINI.x+x,3.55,z);
 }
 for(const [team,z]of[['blue',MINI.spawnZ],['red',-MINI.spawnZ]]){
  const ring=mesh(new THREE.RingGeometry(2.3,2.5,48),new THREE.MeshBasicMaterial({color:TEAM_COLORS[team],side:THREE.DoubleSide,transparent:true,opacity:.5,depthWrite:false}),MINI.x,.035,z);ring.rotation.x=-Math.PI/2;
  for(const x of[-1.5,0,1.5]){const rune=mesh(new THREE.PlaneGeometry(.35,.35),new THREE.MeshBasicMaterial({color:TEAM_COLORS[team],side:THREE.DoubleSide}),MINI.x+x,.04,z);rune.rotation.set(-Math.PI/2,0,Math.PI/4);}
 }
 const key=new THREE.DirectionalLight(0xffcdb5,1.2);key.position.set(MINI.x-8,26,12);key.target.position.set(MINI.x,0,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:80});key.shadow.normalBias=.08;root.add(key,key.target);
 const moon=new THREE.PointLight(0xff7c97,75,38,2);moon.position.set(MINI.x,13,0);root.add(moon);
 // Raised flank routes have visible slope meshes matching miniGround exactly.
 for(const t of DUEL_MAP.terraces){if(t.type==='flat')block(t.x,t.height/2,t.z,t.w,t.height,t.d,cap);else{const geom=new THREE.BufferGeometry(),a=t.w/2,b=t.d/2,low=terraceHeight(t,t.x,t.z-b),high=terraceHeight(t,t.x,t.z+b);geom.setAttribute('position',new THREE.Float32BufferAttribute([-a,low,-b,a,low,-b,a,high,b,-a,high,b,-a,-.04,-b,a,-.04,-b,a,-.04,b,-a,-.04,b],3));geom.setIndex([0,3,1,1,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);geom.computeVertexNormals();mesh(geom,cap,t.x,0,t.z);}}
 // Fractured paving, crystal obelisks and a quiet ring of moving runes.
 const crystal=new THREE.MeshStandardMaterial({color:0xb8a0ff,emissive:0x654cc9,emissiveIntensity:1.4,roughness:.3,metalness:.25});
 for(const x of[-1,1])for(const z of[-1,1]){const atX=MINI.x+x*(w-1.4),atZ=z*(d-3);block(atX,.3,atZ,1.3,.6,1.3,edge);const shard=mesh(new THREE.OctahedronGeometry(.6,0),crystal,atX,DUEL_MAP.effects.crystalHeight/2,atZ);shard.scale.set(.65,3,.65);}
 for(let i=0;i<16;i++){const z=-d+2+i*(d*2-4)/15;block(MINI.x+(i%2?-.8:.8),.008,z,1.2,.015,.08,cap);}
 const orbit=new THREE.Group();root.add(orbit);orbit.position.set(MINI.x,.045,0);const runeMat=new THREE.MeshBasicMaterial({color:0xc19aff,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false});
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,m=new THREE.Mesh(new THREE.PlaneGeometry(.15,.5),runeMat);m.rotation.set(-Math.PI/2,0,-a);m.position.set(Math.cos(a)*DUEL_MAP.effects.runeRadius,0,Math.sin(a)*DUEL_MAP.effects.runeRadius);orbit.add(m);}
 const positions=new Float32Array(DUEL_MAP.effects.motes*3);for(let i=0;i<positions.length/3;i++){positions.set([MINI.x+Math.sin(i*7.13)*(w-1),.3+(i%17)/17*7,Math.sin(i*13.7)*(d-1)],i*3);}
 const dustTime={value:0},dustMat=new THREE.ShaderMaterial({uniforms:{time:dustTime},vertexShader:`uniform float time;varying float glow;void main(){vec3 p=position;p.y=mod(p.y+time*.22,7.);p.x+=sin(time*.4+position.z)*.18;glow=.3+.5*abs(sin(time+position.x));vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(24./max(1.,-v.z),1.,4.);}`,fragmentShader:`varying float glow;void main(){float a=1.-smoothstep(.05,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.66,.54,1.,a*glow*.6);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));const dust=new THREE.Points(dustGeo,dustMat);dust.frustumCulled=false;root.add(dust);
 root.traverse(o=>{if(o.isMesh)o.userData.noCameraCollision=false;});
 return{root,update(time){if(!root.visible)return;dustTime.value=time;orbit.rotation.y=time*.04;runeMat.opacity=.23+Math.sin(time*1.8)*.06;crystal.emissiveIntensity=1.25+Math.sin(time*1.3)*.2;}};
}
export function makeMatchSign(scene){
 const root=new THREE.Group();const at=MAP.stations.match;root.position.set(at.x,groundHeight(at.x,at.z),at.z+1.1);scene.add(root);
 const wood=new THREE.MeshStandardMaterial({color:0x634637,roughness:1}),frame=new THREE.MeshStandardMaterial({color:0xd2a66b,roughness:.7});
 const add=(w,h,d,x,y,z,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;root.add(m);};
 add(.18,2.5,.18,-1.35,1.25,0,wood);add(.18,2.5,.18,1.35,1.25,0,wood);add(3.1,1.42,.22,0,2.05,0,frame);
 const c=document.createElement('canvas');c.width=768;c.height=320;const ctx=c.getContext('2d');ctx.fillStyle='#302538';ctx.fillRect(0,0,768,320);ctx.textAlign='center';ctx.fillStyle='#ffe3b0';ctx.font='900 124px Nunito, sans-serif';ctx.fillText('2v2',384,146);ctx.fillStyle='#59402d';ctx.fillRect(105,183,558,91);ctx.strokeStyle='#cf9d4d';ctx.lineWidth=3;ctx.strokeRect(105,183,558,91);ctx.fillStyle='#ffda83';ctx.font='900 44px Nunito, sans-serif';ctx.fillText('[Join a match]',384,243);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const face=new THREE.Mesh(new THREE.PlaneGeometry(2.95,1.28),new THREE.MeshBasicMaterial({map:texture}));face.rotation.y=Math.PI;face.position.set(0,2.05,-.125);root.add(face);return root;
}
