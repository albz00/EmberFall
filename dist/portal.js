import * as THREE from './vendor/three.module.js';
export function buildPortal(root,scene,origin,runeAt){
 const ox=origin.x,oy=origin.y??0,oz=origin.z;
 const stone=new THREE.MeshStandardMaterial({color:0x3c3447,roughness:.8,flatShading:true}),gold=new THREE.MeshStandardMaterial({color:0x90714e,metalness:.5,roughness:.5});
 const add=(g,m,p,r=0)=>{const o=new THREE.Mesh(g,m);o.position.set(...p);o.rotation.z=r;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 // A cracked horseshoe gateway. The missing crown falls beside the opening.
 for(let i=0;i<13;i++){if(i===3||i===4)continue;const a=i/12*Math.PI,x=Math.cos(a)*3.35,y=3.2+Math.sin(a)*3.8;add(new THREE.BoxGeometry(1.15,1.05,1.05),stone,[ox+x,oy+y,oz],a-Math.PI/2);}
 for(const x of [-3.35,3.35]){add(new THREE.BoxGeometry(1.3,3.2,1.3),stone,[ox+x,oy+1.6,oz]);add(new THREE.BoxGeometry(1.85,.38,1.8),gold,[ox+x,oy+.19,oz]);}
 add(new THREE.BoxGeometry(1.2,1.05,1.2),stone,[ox+4.7,oy+.6,oz+1.4],.53);add(new THREE.BoxGeometry(1.05,.9,1.05),stone,[ox+5.9,oy+.48,oz+.5],-.35);
 // The gateway is broken and inert: stone and weathered inlay, with no veil or beam.
 const fx=new THREE.Group();fx.name='dormant-bridge-rune';scene.add(fx);
 const center=new THREE.Vector3(...runeAt),plinth=add(new THREE.CylinderGeometry(1.03,1.08,.075,16),stone,[center.x,center.y-.0275,center.z]);plinth.name='bridge-rune-plinth';
 const runes=new THREE.Group();runes.position.copy(center).add(new THREE.Vector3(0,.013,0));fx.add(runes);
 const inlay=new THREE.MeshStandardMaterial({color:0xa08c72,metalness:.3,roughness:.8,side:THREE.DoubleSide});
 for(const r of [.55,.88]){const ring=new THREE.Mesh(new THREE.RingGeometry(r-.018,r+.018,64),inlay);ring.rotation.x=-Math.PI/2;runes.add(ring);}
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2,glyph=new THREE.Mesh(new THREE.BoxGeometry(.047,.009,.15),inlay);glyph.position.set(Math.sin(a)*.715,.003,Math.cos(a)*.715);glyph.rotation.y=a+(i%2?.6:0);runes.add(glyph);}
 const diamond=new THREE.Mesh(new THREE.RingGeometry(.15,.19,4),inlay);diamond.rotation.x=-Math.PI/2;diamond.rotation.z=Math.PI/4;runes.add(diamond);
 // Hairline fractures interrupt the device's rings, making its dormant state visible.
 const crackMaterial=new THREE.MeshStandardMaterial({color:0x211c29,roughness:1});
 for(const [x,z,angle,length]of [[.38,.04,.2,.84],[-.45,-.28,-.55,.78],[.08,.53,.7,.35]]){const crack=new THREE.Mesh(new THREE.BoxGeometry(.027,.011,length),crackMaterial);crack.position.set(x,.006,z);crack.rotation.y=angle;runes.add(crack);}
 fx.traverse(o=>o.userData.noCameraCollision=true);return{fx,runes,veil:null,active:false,center,update(){}};
}

export function addStringLights(root,spans,posts){
 const cables=[],bulbs=[],mat=new THREE.MeshStandardMaterial({color:0x282332,roughness:1}),palette=[0xff8d24,0xb97cff,0xafd869,0xffc871],materials=palette.map(color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.5,roughness:.35}));
 for(const {from:aa,to:bb,sag}of spans){const a=new THREE.Vector3(...aa),b=new THREE.Vector3(...bb),pts=[];for(let i=0;i<=36;i++){const t=i/36,p=a.clone().lerp(b,t);p.y-=4*t*(1-t)*sag;pts.push(p);}const curve=new THREE.CatmullRomCurve3(pts),cable=new THREE.Mesh(new THREE.TubeGeometry(curve,72,.021,4,false),mat);root.add(cable);cables.push({start:a,end:b,sag});
  const count=Math.ceil(a.distanceTo(b)/1.7);for(let i=1;i<count;i++){const p=curve.getPoint(i/count),socket=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.12,5),mat);socket.position.copy(p).add(new THREE.Vector3(0,-.055,0));root.add(socket);const bulb=new THREE.Mesh(new THREE.SphereGeometry(.095,6,5),materials[i%4]);bulb.scale.y=1.35;bulb.position.copy(p).add(new THREE.Vector3(0,-.19,0));root.add(bulb);bulbs.push(bulb);}
 }
 for(const [x,y,z]of posts){const post=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,.6,6),mat);post.position.set(x,y,z);root.add(post);}
 return{cables,bulbs,update(time){materials.forEach((m,i)=>m.emissiveIntensity=1.35+Math.sin(time*1.2+i*.8)*.15);}};
}
