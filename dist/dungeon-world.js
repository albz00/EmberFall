import * as THREE from './vendor/three.module.js';
import {CRYPT,dungeonPoint,dungeonGateClosed} from './dungeon.js?v=53';

export function buildDungeon(scene){
 const root=new THREE.Group();root.name='Ashen Crypt';scene.add(root);root.visible=false;
 const stone=new THREE.MeshStandardMaterial({color:0x3d3a51,roughness:.92,flatShading:true}),edge=new THREE.MeshStandardMaterial({color:0x242338,roughness:1,flatShading:true}),trim=new THREE.MeshStandardMaterial({color:0x71627d,roughness:.76,flatShading:true}),gold=new THREE.MeshStandardMaterial({color:0xbc9161,metalness:.6,roughness:.5}),glow=new THREE.MeshBasicMaterial({color:0x84d7f5}),ember=new THREE.MeshBasicMaterial({color:0xffa567});
 const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(CRYPT.origin.x+x,y,CRYPT.origin.z+z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const box=(x,y,z,w,h,d,mat=stone)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 box(0,-.65,0,CRYPT.halfWidth*2+2,1.3,CRYPT.halfDepth*2+2,edge);
 // Large fitted flagstones, with slightly different stone values instead of noisy textures.
 const tiles=[0x484354,0x413f50,0x4d4658].map(color=>new THREE.MeshStandardMaterial({color,roughness:.95,flatShading:true}));
 for(let x=-12;x<13;x+=3)for(let z=-37.5;z<39;z+=3)box(x,-.025,z,2.93,.05,2.93,tiles[Math.abs(Math.round(x+z))%tiles.length]);
 for(const x of [-CRYPT.halfWidth,CRYPT.halfWidth]){box(x,CRYPT.wallHeight/2,0,1,CRYPT.wallHeight,CRYPT.halfDepth*2+1);box(x,1.1,0,1.12,.2,CRYPT.halfDepth*2,trim);box(x,6.7,0,1.15,.28,CRYPT.halfDepth*2,trim);}
 for(const z of [-CRYPT.halfDepth,CRYPT.halfDepth])box(0,CRYPT.wallHeight/2,z,CRYPT.halfWidth*2,CRYPT.wallHeight,1);
 const gates=[];
 for(const z of CRYPT.dividers){const side=(CRYPT.halfWidth-CRYPT.doorWidth/2)/2;for(const sign of [-1,1])box(sign*(CRYPT.doorWidth/2+side),4,z,side*2,8,1);
  box(0,6,z,CRYPT.doorWidth+.6,.6,1.3,trim);for(const x of [-CRYPT.doorWidth/2,CRYPT.doorWidth/2]){box(x,3,z,.55,6,1.4,trim);box(x,.2,z,.9,.4,1.7,gold);}
  const gate=new THREE.Group();root.add(gate);gate.position.set(CRYPT.origin.x,0,CRYPT.origin.z+z);
  for(let x=-CRYPT.doorWidth/2+.3;x<CRYPT.doorWidth/2;x+=.6){const bar=new THREE.Mesh(new THREE.BoxGeometry(.13,5.8,.19),gold);bar.position.set(x,2.9,0);gate.add(bar);}for(const y of [1,4.5]){const cross=new THREE.Mesh(new THREE.BoxGeometry(CRYPT.doorWidth,.16,.24),trim);cross.position.y=y;gate.add(cross);}gates.push(gate);
 }
 for(const p of CRYPT.obstacles){box(p.x,p.h/2,p.z,p.w,p.h,p.d,edge);box(p.x,.18,p.z,p.w+.4,.36,p.d+.4,trim);box(p.x,p.h-.15,p.z,p.w+.35,.3,p.d+.35,trim);for(const dx of [-.3,.3])box(p.x+dx,p.h*.6,p.z+p.d/2+.012,.05,.95,.025,gold);}
 const flames=[];
 for(const z of [-33,-21,-8,5,19,32])for(const sign of [-1,1]){const x=sign*(CRYPT.halfWidth-.7);box(x,2.25,z,.3,.3,.8,gold);const crystal=add(new THREE.OctahedronGeometry(.28,0),z<-15?ember:glow,x,2.8,z);crystal.scale.y=1.65;flames.push(crystal);const light=new THREE.PointLight(z<-15?0xff9461:0x72b6ff,14,12,2);light.position.set(CRYPT.origin.x+x,3.3,z+CRYPT.origin.z);root.add(light);}
 // Repeated ceiling ribs frame each room while leaving room to jump and aim.
 box(0,8.8,0,26,.5,78,edge);
 for(const z of [-36,-24,-4,7,23,35]){box(0,8.2,z,26,.35,.6,edge);for(const sign of [-1,1]){const beam=box(sign*7,7.6,z,12,.3,.45,trim);beam.rotation.z=sign*.14;}}
 const ring=(x,z,r,color)=>{const m=add(new THREE.RingGeometry(r-.045,r,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}),x,.07,z);m.rotation.x=-Math.PI/2;return m;};
 ring(0,-26,7,0xb690d5);ring(0,-26,7.3,0xbc9161);for(let i=0;i<16;i++){const a=i*Math.PI/8,m=box(Math.sin(a)*6.4,.08,-26+Math.cos(a)*6.4,.06,.02,.36,gold);m.rotation.y=a;}
 const exit=new THREE.Group();const at=dungeonPoint(CRYPT.exit);exit.position.set(at.x,0,at.z);root.add(exit);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(1.7,.15,5,48),trim);rim.position.y=2;exit.add(rim);const veil=new THREE.Mesh(new THREE.CircleGeometry(1.55,48),new THREE.MeshBasicMaterial({color:0x7ba8ff,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}));veil.position.set(0,2,-.02);exit.add(veil);
 const motes=new THREE.Group();root.add(motes);const moteGeo=new THREE.OctahedronGeometry(.04,0);for(let i=0;i<65;i++){const m=new THREE.Mesh(moteGeo,i%3?glow:ember);m.position.set(CRYPT.origin.x+Math.sin(i*17)*11,.7+(i%13)*.45,CRYPT.origin.z+Math.cos(i*9)*36);m.userData.phase=i;motes.add(m);}
 const tell=add(new THREE.RingGeometry(.94,1,64),new THREE.MeshBasicMaterial({color:0xff604e,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}),0,.09,-26);tell.rotation.x=-Math.PI/2;tell.visible=false;
 let cache=null;
 return{root,gates,tell,exit,setCache(model){cache=model;cache.position.set(CRYPT.origin.x+CRYPT.cache.x,.08,CRYPT.origin.z+CRYPT.cache.z);cache.rotation.y=Math.PI;cache.visible=false;root.add(cache);},update(time,dt,run){root.visible=run.active;if(!root.visible)return;for(const [i,g]of gates.entries()){const target=dungeonGateClosed(run,i)?0:6.6;g.position.y+=(target-g.position.y)*Math.min(1,dt*5);}flames.forEach((m,i)=>{m.rotation.y=time*.6+i;m.position.y=2.8+Math.sin(time*2+i)*.07;});motes.children.forEach(m=>{m.position.y+=dt*.14;if(m.position.y>7)m.position.y=.4;});veil.material.opacity=.4+Math.sin(time*2)*.08;if(cache)cache.visible=run.phase==='complete'&&!run.claimed;tell.visible=!!run.cast;if(run.cast){tell.position.set(run.cast.x,.09,run.cast.z);tell.scale.setScalar(run.cast.radius);tell.material.opacity=.35+Math.sin(time*18)*.18;tell.material.color.setHex(run.cast.kind==='slam'?0xff7f4e:0xae78ff);}}};
}
