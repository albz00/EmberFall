import {MAP,groundHeight} from './shared/map.js?v=67';
import * as THREE from './vendor/three.module.js';

export const MINI={x:96,z:0,halfWidth:11.5,halfDepth:13.5,duration:100};
export const TEAM_COLORS={blue:0x78d8ff,red:0xff738d};
export const inMiniArena=(x,z)=>x>64;
export const MINI_COVER=[{x:92,z:-2,w:2.5,d:5,h:3.2},{x:100,z:2,w:2.5,d:5,h:3.2},{x:89,z:5.8,w:2.2,d:2.2,h:1.6},{x:103,z:-5.8,w:2.2,d:2.2,h:1.6}];
export function miniBlocked(x,z,y=0,padding=.6){
 if(Math.abs(x-MINI.x)>MINI.halfWidth-padding||Math.abs(z)>MINI.halfDepth-padding)return true;
 return MINI_COVER.some(c=>y<c.h&&Math.abs(x-c.x)<c.w/2+padding&&Math.abs(z-c.z)<c.d/2+padding);
}
export function miniGround(x,z,feet=100){let h=0;for(const c of MINI_COVER)if(Math.abs(x-c.x)<c.w/2&&Math.abs(z-c.z)<c.d/2&&feet>c.h-.35)h=Math.max(h,c.h);return h;}
export function miniResolve(p,radius=.38){
 p.x=THREE.MathUtils.clamp(p.x,MINI.x-MINI.halfWidth+radius,MINI.x+MINI.halfWidth-radius);p.z=THREE.MathUtils.clamp(p.z,-MINI.halfDepth+radius,MINI.halfDepth-radius);
 for(const c of MINI_COVER){if(p.y>=c.h-.1)continue;const minX=c.x-c.w/2-radius,maxX=c.x+c.w/2+radius,minZ=c.z-c.d/2-radius,maxZ=c.z+c.d/2+radius;if(p.x>minX&&p.x<maxX&&p.z>minZ&&p.z<maxZ){const sides=[{distance:p.x-minX,axis:'x',value:minX},{distance:maxX-p.x,axis:'x',value:maxX},{distance:p.z-minZ,axis:'z',value:minZ},{distance:maxZ-p.z,axis:'z',value:maxZ}].sort((a,b)=>a.distance-b.distance);p[sides[0].axis]=sides[0].value;}}
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
 const shape=new THREE.Shape();shape.moveTo(-10,-14);shape.lineTo(10,-14);shape.lineTo(12,-12);shape.lineTo(12,12);shape.lineTo(10,14);shape.lineTo(-10,14);shape.lineTo(-12,12);shape.lineTo(-12,-12);shape.closePath();
 const floor=mesh(new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSize:.25,bevelThickness:.2,bevelSegments:1,steps:1}),stone,MINI.x,-1.2,0);floor.rotation.x=-Math.PI/2;
 for(const x of[-12,12]){block(MINI.x+x,1,0,.85,2,27,edge);block(MINI.x+x,2.1,0,1.12,.22,27,cap);}
 for(const z of[-14,14]){block(MINI.x,1,z,23,2,.85,edge);block(MINI.x,2.1,z,23,.22,1.12,cap);}
 for(const c of MINI_COVER){block(c.x,c.h/2,c.z,c.w,c.h,c.d);block(c.x,c.h+.1,c.z,c.w+.22,.2,c.d+.22,cap);for(const side of[-1,1])block(c.x+side*(c.w/2-.2),c.h/2,c.z,.18,c.h+.1,c.d+.08,timber);}
 for(const x of[-11.3,11.3])for(const z of[-12.8,0,12.8]){
  mesh(new THREE.CylinderGeometry(.72,.92,3.8,7),edge,MINI.x+x,1.9,z);mesh(new THREE.ConeGeometry(1,1.3,7),cap,MINI.x+x,4.35,z);
  const color=z<0?TEAM_COLORS.red:TEAM_COLORS.blue,glow=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.2,roughness:.4});mesh(new THREE.IcosahedronGeometry(.3,0),glow,MINI.x+x,3.55,z);
 }
 for(const [team,z]of[['blue',9.5],['red',-9.5]]){
  const ring=mesh(new THREE.RingGeometry(2.3,2.5,48),new THREE.MeshBasicMaterial({color:TEAM_COLORS[team],side:THREE.DoubleSide,transparent:true,opacity:.5,depthWrite:false}),MINI.x,.035,z);ring.rotation.x=-Math.PI/2;
  for(const x of[-1.5,0,1.5]){const rune=mesh(new THREE.PlaneGeometry(.35,.35),new THREE.MeshBasicMaterial({color:TEAM_COLORS[team],side:THREE.DoubleSide}),MINI.x+x,.04,z);rune.rotation.set(-Math.PI/2,0,Math.PI/4);}
 }
 const key=new THREE.DirectionalLight(0xffcdb5,1.2);key.position.set(MINI.x-8,26,12);key.target.position.set(MINI.x,0,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:55});key.shadow.normalBias=.08;root.add(key,key.target);
 const moon=new THREE.PointLight(0xff7c97,75,38,2);moon.position.set(MINI.x,11,0);root.add(moon);
 return{root};
}
export function makeMatchSign(scene){
 const root=new THREE.Group();const at=MAP.stations.match;root.position.set(at.x,groundHeight(at.x,at.z),at.z+1.1);scene.add(root);
 const wood=new THREE.MeshStandardMaterial({color:0x634637,roughness:1}),frame=new THREE.MeshStandardMaterial({color:0xd2a66b,roughness:.7});
 const add=(w,h,d,x,y,z,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;root.add(m);};
 add(.18,2.5,.18,-1.35,1.25,0,wood);add(.18,2.5,.18,1.35,1.25,0,wood);add(3.1,1.42,.22,0,2.05,0,frame);
 const c=document.createElement('canvas');c.width=768;c.height=320;const ctx=c.getContext('2d');ctx.fillStyle='#302538';ctx.fillRect(0,0,768,320);ctx.textAlign='center';ctx.fillStyle='#ffe3b0';ctx.font='900 124px Nunito, sans-serif';ctx.fillText('2v2',384,146);ctx.fillStyle='#59402d';ctx.fillRect(105,183,558,91);ctx.strokeStyle='#cf9d4d';ctx.lineWidth=3;ctx.strokeRect(105,183,558,91);ctx.fillStyle='#ffda83';ctx.font='900 44px Nunito, sans-serif';ctx.fillText('[Join a match]',384,243);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const face=new THREE.Mesh(new THREE.PlaneGeometry(2.95,1.28),new THREE.MeshBasicMaterial({map:texture}));face.rotation.y=Math.PI;face.position.set(0,2.05,-.125);root.add(face);return root;
}
