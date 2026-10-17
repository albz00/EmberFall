import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {CRYPT,DUNGEON,roomContains,dungeonGateClosed} from './dungeon.js?v=59';

const V=THREE.Vector3;
export function createDungeonBolt(color){
 const root=new THREE.Group(),core=new THREE.MeshBasicMaterial({color:0xf4f5ff}),glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});
 root.add(new THREE.Mesh(new THREE.OctahedronGeometry(.15,0),core));
 for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.25+i*.08,.025,3,16),glow);ring.rotation.set(i*.9,.5+i,0);root.add(ring);}
 const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),glow);root.add(shell);return root;
}
export function decorateDungeonEnemy(actor,color){
 const root=new THREE.Group();root.name='dungeon-spell-aura';actor.root.add(root);const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}),size=actor.boss?1.3:.65;
 for(let i=0;i<(actor.boss?3:1);i++){const g=new THREE.TorusGeometry(size+i*.15,.018,3,48),ring=new THREE.Mesh(g,material);ring.rotation.x=Math.PI/2;ring.position.y=.06+i*.24;ring.userData.ownedGeometry=true;root.add(ring);}
 if(actor.boss)for(let i=0;i<7;i++){const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.085,0),material);shard.position.set(Math.sin(i/7*Math.PI*2)*.75,3.3,Math.cos(i/7*Math.PI*2)*.75);shard.scale.y=3;shard.userData.ownedGeometry=true;root.add(shard);}
 actor.dungeonFX=root;return root;
}
export function buildDungeon(scene){
 const root=new THREE.Group();root.name='Generated Ashen Crypt';root.visible=false;scene.add(root);
 let staticRoot=new THREE.Group(),liveRoot=new THREE.Group(),layout=null,templates=null,prepare=null,cacheModels=[],portals=[],animations=[],lamps=[],gates=[],cameraMeshes=[],spellGroups=new Map(),materials=new Map();
 const mat=(color,metalness=0,emission=0)=>{const key=color+':'+metalness+':'+emission;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.44:.9,flatShading:true,emissive:color,emissiveIntensity:emission}));return materials.get(key);};
 const lightMat=(color,opacity=.8)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
 const add=(geometry,material,x,y,z,parent=staticRoot)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(x,y,z,w,h,d,material=mat(0x393848),parent=staticRoot)=>add(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent);
 const beam=(a,b,width,material,parent=staticRoot)=>{const av=new V(...a),bv=new V(...b),m=add(new THREE.CylinderGeometry(width,width*.92,av.distanceTo(bv),5),material,...av.clone().add(bv).multiplyScalar(.5).toArray(),parent);m.quaternion.setFromUnitVectors(new V(0,1,0),bv.sub(av).normalize());return m;};
 const ring=(x,y,z,r,color,width=.035,parent=staticRoot)=>{const m=add(new THREE.RingGeometry(r-width,r,64),lightMat(color,.65),x,y,z,parent);m.rotation.x=-Math.PI/2;m.userData.noCameraCollision=true;return m;};
 const sigil=(x,z,r,color)=>{ring(x,.025,z,r,color);ring(x,.028,z,r*.82,color,.018);for(let i=0;i<12;i++){const a=i*Math.PI/6,m=box(x+Math.sin(a)*r*.65,.026,z+Math.cos(a)*r*.65,.045,.013,.23,mat(color,0,.65));m.rotation.y=a+(i%2?.4:-.4);m.userData.noCameraCollision=true;}};
 const flame=(x,y,z,color,scale=1)=>{const m=add(new THREE.ConeGeometry(.18*scale,.7*scale,5),lightMat(color),x,y,z,liveRoot);animations.push(t=>{m.scale.y=1+Math.sin(t*8+x)*.15;m.rotation.y=t*1.4;});return m;};
 const sconce=(x,y,z,color)=>{box(x,y-.45,z,.25,.55,.25,mat(0x52424a,.55));box(x,y-.18,z,.4,.12,.4,mat(0x9b7959,.5));flame(x,y+.18,z,color);};
 function arch(a,b,height,color){
  const av=new V(...a),bv=new V(...b),mid=av.clone().add(bv).multiplyScalar(.5),delta=bv.clone().sub(av),width=delta.length()/2,heading=delta.normalize(),material=mat(color);
  const points=Array.from({length:17},(_,i)=>{const theta=i/16*Math.PI;return new V(mid.x+Math.cos(theta)*width*heading.x,height-1.6+Math.sin(theta)*1.6,mid.z+Math.cos(theta)*width*heading.z);});
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],center=a.clone().add(b).multiplyScalar(.5),direction=b.clone().sub(a),stone=box(center.x,center.y,center.z,.68,direction.length()+.035,.86,material);stone.quaternion.setFromUnitVectors(new V(0,1,0),direction.normalize());}
 }
 function floorShape(room){const shape=new THREE.Shape();room.polygon.forEach((p,i)=>i?shape.lineTo(p.x-room.x,-(p.z-room.z)):shape.moveTo(p.x-room.x,-(p.z-room.z)));shape.closePath();for(const h of room.hazards){const path=new THREE.Path();path.moveTo(h.x-room.x-h.w/2,-(h.z-room.z-h.d/2));path.lineTo(h.x-room.x+h.w/2,-(h.z-room.z-h.d/2));path.lineTo(h.x-room.x+h.w/2,-(h.z-room.z+h.d/2));path.lineTo(h.x-room.x-h.w/2,-(h.z-room.z+h.d/2));path.closePath();shape.holes.push(path);}return shape;}
 function drawFloor(room){
  const floor=add(new THREE.ExtrudeGeometry(floorShape(room),{depth:.65,bevelEnabled:false}),mat(room.theme==='garden'?0x3b4743:room.theme==='forge'?0x4c3c3c:0x494452),room.x,-.65,room.z);floor.rotation.x=-Math.PI/2;
  // Inlaid flagstones are clipped to each authored footprint, including the cross-shaped chambers.
  for(let x=-room.w/2+1.5;x<room.w/2;x+=3)for(let z=-room.d/2+1.5;z<room.d/2;z+=3){const wx=room.x+x,wz=room.z+z;if(!roomContains(room,wx,wz,2.1)||room.hazards.some(h=>Math.abs(wx-h.x)<h.w/2+1.5&&Math.abs(wz-h.z)<h.d/2+1.5))continue;box(wx,-.018,wz,2.92,.03,2.92,mat((Math.round(x+z)%3)?0x514b59:0x47424e));}
  const ceiling=add(new THREE.ShapeGeometry(floorShape({...room,hazards:[]})),mat(0x202333),room.x,room.height+.3,room.z);ceiling.rotation.x=Math.PI/2;
  ceiling.rotation.x=-Math.PI/2;ceiling.material.side=THREE.DoubleSide;
  for(const h of room.hazards){const liquid=new THREE.ShaderMaterial({uniforms:{time:{value:0}},side:THREE.DoubleSide,vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float time;varying vec2 p;void main(){float n=sin(p.x*35.+sin(p.y*18.+time))*sin(p.y*28.-time*1.3);vec3 c=mix(vec3(.35,.035,.015),vec3(1.,.39,.045),smoothstep(-.3,.6,n));gl_FragColor=vec4(c,1.);}'});const m=add(new THREE.PlaneGeometry(h.w,h.d),liquid,h.x,.02,h.z,liveRoot);m.rotation.x=-Math.PI/2;animations.push(t=>liquid.uniforms.time.value=t);box(h.x,-2.6,h.z,h.w,.3,h.d,mat(0x1e1a27));for(const side of [-1,1])box(h.x+side*(h.w/2+.12),.07,h.z,.24,.14,h.d+.3,mat(0x28222c));}
 }
 function prop(p,room){
  const stone=mat(0x605664),trim=mat(0x938078),metal=mat(0x736c79,.7),gold=mat(0xb38d5b,.65),wood=mat(0x4b3341);
  if(p.kind==='pillar'){
   add(new THREE.CylinderGeometry(p.w*.43,p.w*.5,p.h,7),stone,p.x,p.h/2,p.z);box(p.x,.18,p.z,p.w+.25,.36,p.d+.25,trim);box(p.x,p.h-.18,p.z,p.w+.25,.36,p.d+.25,trim);
   for(let i=0;i<3;i++)box(p.x-.3+i*.3,p.h*.58,p.z+p.d/2*.84,.035,p.h*.23,.025,mat(room.color,0,.5));
  }else if(p.kind==='sarcophagus'){
   box(p.x,p.h*.45,p.z,p.w,p.h*.9,p.d,stone);box(p.x,p.h-.07,p.z,p.w*1.04,.14,p.d*1.04,trim);box(p.x,p.h+.02,p.z,.1,.025,p.d*.6,gold);box(p.x,p.h+.025,p.z-.45,p.w*.45,.025,.1,gold);
   for(const side of [-1,1]){const y=p.h+.16;add(new THREE.CylinderGeometry(.055,.055,.28,5),mat(0xd8c1a5),p.x+side*p.w*.3,y,p.z-p.d*.34);flame(p.x+side*p.w*.3,y+.25,p.z-p.d*.34,0xffc375,.55);}
  }else if(p.kind==='shelf'){
   for(const side of [-1,1])box(p.x+side*p.w*.44,p.h/2,p.z,.2,p.h,p.d,wood);box(p.x,p.h/2,p.z-p.d*.47,p.w,p.h,.16,wood);
   for(let shelf=0;shelf<5;shelf++){const y=.2+shelf*(p.h-.5)/4;box(p.x,y,p.z,p.w,.12,p.d,wood);for(let row=0;row<8;row++){const shade=[0x835867,0x618a85,0xa18464,0x6d6b96][(row+shelf)%4];box(p.x,y+.31,p.z-p.d/2+.4+row*(p.d-.6)/8,p.w*.62,.45+row%3*.08,.24,mat(shade));}}
  }else if(p.kind==='anvil'){
   box(p.x,.35,p.z,p.w*.75,.7,p.d*.75,stone);box(p.x,.9,p.z,p.w*.32,.6,p.d*.7,metal);box(p.x,p.h-.13,p.z,p.w,.26,p.d,metal);const horn=add(new THREE.ConeGeometry(.3,p.w*.5,4),metal,p.x+p.w*.56,p.h-.12,p.z);horn.rotation.z=-Math.PI/2;
  }else if(p.kind==='planter'){
   box(p.x,.4,p.z,p.w,.8,p.d,stone);box(p.x,.83,p.z,p.w-.18,.1,p.d-.18,mat(0x273d33));
   for(let i=0;i<9;i++){const x=p.x+Math.sin(i*13)*p.w*.35,z=p.z+Math.cos(i*9)*p.d*.38;beam([x,.85,z],[x+.2,1.5+(i%3)*.4,z-.2],.055,mat(0x4a7960));for(let n=0;n<3;n++){const leaf=add(new THREE.OctahedronGeometry(.3,0),mat([0x79a87f,0x527e71,0x6e7c95][n]),x+Math.sin(n*2)*.3,1.15+(i%3)*.4,z+Math.cos(n*2)*.3);leaf.scale.set(1.7,.3,.55);leaf.rotation.y=n*2;}if(i%2===0){const cap=add(new THREE.ConeGeometry(.27,.22,7),mat(0x89cbb7,0,.45),x,1.02,z);cap.rotation.z=.1;}}
  }else if(p.kind==='throne'){
   box(p.x,.5,p.z,p.w,1,p.d,stone);box(p.x,1.2,p.z,p.w*.65,.4,p.d*.7,trim);box(p.x,p.h*.57,p.z-p.d*.4,p.w*.65,p.h*.86,.48,stone);for(const side of [-1,1])box(p.x+side*p.w*.38,1.65,p.z,.45,1,p.d,trim);
   for(let i=-3;i<=3;i++){const spike=add(new THREE.ConeGeometry(.2,1.2+1.3*(1-Math.abs(i)/4),4),gold,p.x+i*.4,p.h-.1,p.z-p.d*.4);spike.rotation.z=-i*.12;}
  }else{box(p.x,p.h*.45,p.z,p.w*.83,p.h*.9,p.d*.83,stone);box(p.x,p.h-.08,p.z,p.w,.16,p.d,trim);sigil(p.x,p.z,Math.min(p.w,p.d)*.4,room.color);}
 }
 function theme(room){const x=room.x,z=room.z,c=room.color,hw=room.w/2,hd=room.d/2;
  sigil(x,z,room.final?6.8:3.3,c);
  if(room.theme==='ossuary'||room.theme==='entrance'){
   for(const dz of [-hd*.55,hd*.55])arch([x-hw+.4,0,z+dz],[x+hw-.4,0,z+dz],room.height-1,0x6a5e69);
   box(x,.018,z,3.8,.025,room.d*.8,mat(0x663946));for(const side of [-1,1])box(x+side*1.78,.033,z,.055,.012,room.d*.8,mat(0xbc9467,.3));
   for(const side of [-1,1])for(const dz of [-hd*.35,hd*.35])sconce(x+side*(hw-.65),2.7,z+dz,0xffc38b);
  }else if(room.theme==='library'){
   const ringA=add(new THREE.TorusGeometry(2.3,.04,4,64),lightMat(c),x,5.7,z,liveRoot);animations.push(t=>ringA.rotation.set(1.1,t*.17,.35));
   for(let i=0;i<7;i++){const book=new THREE.Group();liveRoot.add(book);box(0,0,0,.65,.12,.9,mat(0x6d486c),book);box(0,.08,0,.57,.08,.8,mat(0xd1c6b0),book);const left=box(-.18,.15,0,.32,.015,.8,mat(0xe7d9bd),book),right=box(.18,.15,0,.32,.015,.8,mat(0xe7d9bd),book);left.rotation.z=-.3;right.rotation.z=.3;animations.push(t=>{const a=i/7*Math.PI*2+t*.16;book.position.set(x+Math.sin(a)*(3+i%2),3.7+i%3*.6+Math.sin(t+i)*.3,z+Math.cos(a)*3);book.rotation.set(.2,a+.5,Math.sin(t*.8+i)*.15);});}
   for(const side of [-1,1])arch([x-hw*.47,0,z+side*(hd-.2)],[x+hw*.47,0,z+side*(hd-.2)],room.height-2,0x655774);
  }else if(room.theme==='forge'){
   const bowl=add(new THREE.CylinderGeometry(1.8,1.2,1.6,8),mat(0x3a3039,.7),x,6.6,z,liveRoot);const surface=add(new THREE.CircleGeometry(1.65,8),lightMat(0xff7f35,.9),x,7.42,z,liveRoot);surface.rotation.x=-Math.PI/2;
   for(const side of [-1,1]){box(x+side*1.2,room.height+.1,z,.6,.4,.6,mat(0x615766,.7));for(let i=0;i<Math.ceil((room.height-7.3)/.3);i++){const link=add(new THREE.TorusGeometry(.16,.045,4,8),mat(0x615766,.7),x+side*1.2,7.5+i*.3,z);link.rotation.y=i%2*Math.PI/2;}}
   for(const dx of [-.8,0,.8])flame(x+dx,7.7,z,0xff9b45,1.6);animations.push(t=>bowl.rotation.y=Math.sin(t*.25)*.035);
   for(const h of room.hazards)for(const side of [-1,1]){sconce(h.x,1.1,h.z+side*h.d*.43,0xff8842);}
   for(let i=0;i<9;i++){const crack=box(x+Math.sin(i*4)*hw*.6,.025,z+Math.cos(i*3)*hd*.6,.045,.012,2.5,mat(0xff8e49,0,1));crack.rotation.y=i*.9;}
  }else if(room.theme==='rift'){
   const orb=add(new THREE.IcosahedronGeometry(1.25,1),new THREE.MeshBasicMaterial({color:0xa77cff,wireframe:true,transparent:true,opacity:.6}),x,6,z,liveRoot);
   for(let i=0;i<3;i++){const r=add(new THREE.TorusGeometry(2.1+i*.35,.055,4,64),mat(c,.5,.8),x,6,z,liveRoot);animations.push(t=>r.rotation.set(i*.8+t*.08,t*(i%2?-.13:.13),i*.65));}
   for(let i=0;i<16;i++){const rock=add(new THREE.IcosahedronGeometry(.22+i%3*.13,0),mat(0x686072),x,4,z,liveRoot);rock.scale.set(1,.55,1);animations.push(t=>{const a=i/16*Math.PI*2+t*.09;rock.position.set(x+Math.sin(a)*4.3,4.5+(i%4)*.8+Math.sin(t*.7+i)*.3,z+Math.cos(a)*4.3);rock.rotation.set(t*.1+i,0,t*.17);});}
   animations.push(t=>orb.rotation.set(t*.2,t*.14,0));
  }else if(room.theme==='garden'){
   for(const side of [-1,1]){const pts=[new V(x+side*hw*.43,0,z-hd*.85),new V(x+side*hw*.47,3,z-hd*.72),new V(x+side*hw*.25,6,z-hd*.65),new V(x,8,z-hd*.63)];add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.23,5,false),mat(0x52695b),0,0,0);}
   for(let i=0;i<14;i++){const shard=add(new THREE.OctahedronGeometry(.12,0),lightMat(i%2?0xa5edbc:0xcac0ff,.55),x,2,z,liveRoot);animations.push(t=>{const a=i*2.4+t*.07;shard.position.set(x+Math.sin(a)*(3+i%5),1.2+(i%5)*.5+Math.sin(t*.7+i)*.25,z+Math.cos(a)*(3+i%4));});}
   ring(x,.03,z,5.6,c,.02);
  }else if(room.theme==='vault'){
   for(let i=0;i<12;i++){const a=i*Math.PI/6;box(x+Math.sin(a)*8,.04,z+Math.cos(a)*8,.26,.05,.7,mat(0xe0bb79,.5,.4)).rotation.y=a;}
   const crown=add(new THREE.TorusGeometry(2.4,.12,5,32),mat(0xd8b476,.7),x,6.8,z,liveRoot);crown.rotation.x=Math.PI/2;animations.push(t=>crown.rotation.z=t*.08);
  }else{
   // Final arenas have a much taller silhouette, a throne or suspended storm crystal,
   // sweeping ribs, and an overhead crown rather than another corridor ceiling.
   for(const dz of [-hd*.5,hd*.5])arch([x-hw*.86,0,z+dz],[x+hw*.86,0,z+dz],room.height-1,0x676073);
   for(let i=0;i<12;i++){const a=i*Math.PI/6;const shard=add(new THREE.ConeGeometry(.25,1.4+i%3*.35,4),mat(c,.45,.7),x+Math.sin(a)*3.5,10,z+Math.cos(a)*3.5,liveRoot);shard.rotation.z=Math.sin(a)*.35;animations.push(t=>shard.position.y=10+Math.sin(t*.65+i)*.2);}
   for(const r of [3.3,3.7]){const crown=add(new THREE.TorusGeometry(r,.06,4,64),lightMat(c),x,9.7,z,liveRoot);crown.rotation.x=Math.PI/2;animations.push(t=>crown.rotation.z=t*(r<3.5?.08:-.06));}
   if(room.theme==='storm'){const crystal=add(new THREE.OctahedronGeometry(1.5,0),mat(0x9bcfee,.4,.4),x,11.5,z,liveRoot);crystal.scale.set(.7,1.8,.7);animations.push(t=>crystal.rotation.y=t*.17);}
   else for(let i=0;i<8;i++){const fissure=box(x+Math.sin(i*2.4)*7,.03,z+Math.cos(i*2.4)*7,.07,.012,4,mat(0xff9560,0,.9));fissure.rotation.y=i*2.4;}
  }
 }
 function portal(at,color){const group=new THREE.Group();group.position.set(at.x,0,at.z);liveRoot.add(group);const rim=add(new THREE.TorusGeometry(1.65,.19,5,48),mat(0x8d809c,.3),0,2,0,group);const inner=add(new THREE.CircleGeometry(1.48,48),lightMat(color,.32),0,2,-.02,group);inner.material.side=THREE.DoubleSide;
  for(let i=0;i<8;i++){const a=i*Math.PI/4,glyph=box(Math.sin(a)*1.65,2+Math.cos(a)*1.65,.19,.08,.22,.04,mat(color,0,1.2),group);glyph.rotation.z=-a;}
  animations.push(t=>{inner.material.opacity=.3+Math.sin(t*2)*.07;inner.rotation.z=t*.06;});return group;
 }
 function treasure(at,roomId,final){
  if(!templates||!prepare)return;const m=prepare(templates['treasure-chest.glb'].scene.clone(true));m.position.set(at.x,.08,at.z);m.rotation.y=Math.PI;markAsset(m);liveRoot.add(m);cacheModels.push({model:m,roomId,final,lid:m.getObjectByName('Chest_Top'),base:m.getObjectByName('Chest_Top')?.rotation.x??0});
  box(at.x,-.05,at.z,2.3,.1,1.8,mat(0x716078));sigil(at.x,at.z,1.7,final?0xffc77e:0xbd9aff);
 }
 const markAsset=o=>o.traverse(n=>{if(n.isMesh)n.userData.sharedGeometry=true;});
 function disposeRoot(){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry&&!o.userData.sharedGeometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());root.clear();materials=new Map();animations=[];lamps=[];gates=[];cacheModels=[];portals=[];cameraMeshes=[];spellGroups.clear();}
 function batch(){
  staticRoot.updateMatrixWorld(true);const buckets=new Map();staticRoot.traverse(o=>{if(!o.isMesh||o.isSkinnedMesh)return;const a=buckets.get(o.material)??[];const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());geo.applyMatrix4(o.matrixWorld);a.push(geo);buckets.set(o.material,a);});
  const oldGeometries=new Set();staticRoot.traverse(o=>{if(o.geometry)oldGeometries.add(o.geometry);});staticRoot.clear();oldGeometries.forEach(g=>g.dispose());
  for(const [material,geometries]of buckets){const g=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!g)throw new Error('Dungeon geometry batch failed');const m=new THREE.Mesh(g,material);m.castShadow=!material.isMeshBasicMaterial;m.receiveShadow=true;staticRoot.add(m);if(!material.isMeshBasicMaterial)cameraMeshes.push(m);}
 }
 function rebuild(next){
  if(layout?.seed===next.seed&&layout?.depth===next.depth)return;disposeRoot();layout=next;staticRoot=new THREE.Group();liveRoot=new THREE.Group();root.add(staticRoot,liveRoot);
  for(const room of layout.rooms){drawFloor(room);for(const p of room.props)prop(p,room);theme(room);
   for(const port of room.ports){const w=CRYPT.generation.corridorWidth,h=room.height-7;box(port.x,7+h/2,port.z,port.dx?.7:w+.7,h,port.dx?w+.7:.7,mat(0x484051));for(const side of [-1,1]){const px=port.x+(port.dx?0:side*(w/2+.12)),pz=port.z+(port.dx?side*(w/2+.12):0);box(px,3.4,pz,.5,6.8,.5,mat(0x817281));box(px,.15,pz,.72,.3,.72,mat(0xb09368,.3));}box(port.x,6.85,port.z,port.dx?.8:w+.8,.3,port.dx?w+.8:.8,mat(0x9c8095));}

   const lamp=new THREE.PointLight(room.color,room.final?85:45,Math.max(room.w,room.d)*.85,2);lamp.position.set(room.x,room.height*.46,room.z);liveRoot.add(lamp);lamps.push(lamp);
   if(room.optional){const at={x:room.x,y:0,z:room.z-4};treasure(at,room.id,false);}
  }
  for(const wall of layout.walls){const dx=wall.b.x-wall.a.x,dz=wall.b.z-wall.a.z,len=Math.hypot(dx,dz),material=mat(wall.room?0x474251:0x383545),x=(wall.a.x+wall.b.x)/2,z=(wall.a.z+wall.b.z)/2;const m=box(x,wall.height/2,z,len,wall.height,.6,material);m.rotation.y=-Math.atan2(dz,dx);
   const band=box(x,1,z,len,.18,.69,mat(0x786576));band.rotation.y=m.rotation.y;const cap=box(x,wall.height-.4,z,len,.35,.8,mat(0x6f6177));cap.rotation.y=m.rotation.y;
   for(let d=2;d<len;d+=5){const t=d/len;box(wall.a.x+dx*t,2.5,wall.a.z+dz*t,.18,.65,.18,mat(0xb68a65,.6));}
  }
  for(const c of layout.corridors){box(c.x,-.16,c.z,c.w,.3,c.d,mat(0x3c3947));box(c.x,8.15,c.z,c.w,.3,c.d,mat(0x242535));
   const length=Math.hypot(c.end.x-c.start.x,c.end.z-c.start.z);for(let d=2;d<length;d+=5){const t=d/length,x=c.start.x+(c.end.x-c.start.x)*t,z=c.start.z+(c.end.z-c.start.z)*t;ring(x,.025,z,.45,layout.rooms.find(r=>r.id===c.to).optional?0xc799ff:0xe7b57c,.055);}
  }
  layout.gates.forEach(g=>{const group=new THREE.Group();group.position.set(g.x,0,g.z);if(g.horizontal)group.rotation.y=Math.PI/2;liveRoot.add(group);const w=CRYPT.generation.corridorWidth;for(let x=-w/2+.2;x<w/2;x+=.5)box(x,3,0,.1,6,.15,mat(0xb08e6c,.65),group);box(0,1.3,0,w,.14,.2,mat(0x776777,.4),group);box(0,4.8,0,w,.14,.2,mat(0x776777,.4),group);gates.push(group);group.traverse(o=>{if(o.isMesh)cameraMeshes.push(o);});});
  portals=[portal(layout.exit,0x86c9ff),portal(layout.returnPoint,0x86c9ff),portal(layout.descendPoint,0xcba0ff)];treasure(layout.cache,layout.finalRoom,true);
  batch();root.updateMatrixWorld(true);
 }
 function makeSpell(s){
  const group=new THREE.Group();group.name='spell-'+s.id;liveRoot.add(group);const spec=DUNGEON.spells[s.spell],color=spec.color;
  const targets=s.targets??[{x:s.x,z:s.z,at:s.at}],parts=[];
  for(const target of targets){const node=new THREE.Group();node.position.set(target.x,0,target.z);group.add(node);const rim=ring(0,.06,0,Math.max(.25,spec.radius),color,.06,node),disc=add(new THREE.CircleGeometry(Math.max(.25,spec.radius),48),lightMat(color,.1),0,.04,0,node);disc.rotation.x=-Math.PI/2;const glyph=add(new THREE.TorusGeometry(Math.max(.25,spec.radius*.72),.018,3,48),lightMat(color,.5),0,.08,0,node);glyph.rotation.x=Math.PI/2;
   const core=new THREE.Group();node.add(core);
   if(spec.kind==='lightning'){
    const pts=[];for(let i=0;i<9;i++)pts.push(new V(Math.sin(i*7+s.id)*.3*(i===8?0:1),9-i*1.1,Math.cos(i*4+s.id)*.23));core.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.07,4,false),lightMat(0xdff6ff,1)));core.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.2,4,false),lightMat(color,.35)));
   }else if(spec.kind==='meteor'){
    const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,0),mat(0xff8844,0,1.2));core.add(rock);const tail=new THREE.Mesh(new THREE.ConeGeometry(.4,2.5,6),lightMat(color,.6));tail.position.y=1.3;core.add(tail);
   }else if(spec.kind==='well'){
    for(let i=0;i<5;i++){const torus=new THREE.Mesh(new THREE.TorusGeometry(spec.radius*(1-i*.15),.04,4,64),lightMat(color,.65));torus.rotation.x=Math.PI/2;torus.position.y=.12+i*.45;core.add(torus);}const dark=new THREE.Mesh(new THREE.CircleGeometry(spec.radius*.64,48),new THREE.MeshBasicMaterial({color:0x100a20,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));dark.rotation.x=-Math.PI/2;dark.position.y=.09;core.add(dark);
   }else if(spec.kind==='wave'){
    const wave=new THREE.Mesh(new THREE.TorusGeometry(1,.095,4,96),lightMat(color,.95));wave.rotation.x=Math.PI/2;wave.position.y=.22;core.add(wave);const outer=new THREE.Mesh(new THREE.TorusGeometry(1,.035,3,96),lightMat(0xffedca,.8));outer.rotation.x=Math.PI/2;outer.position.y=.28;core.add(outer);
   }else{core.add(createDungeonBolt(color));core.position.y=1.5;}
   parts.push({node,rim,disc,glyph,core,target});
  }
  group.traverse(o=>o.userData.noCameraCollision=true);return{group,parts};
 }
 function updateSpell(s,fx,time){const spec=DUNGEON.spells[s.spell];for(const p of fx.parts){const at=p.target.at??s.at,age=time-at,warning=age<0,progress=Math.min(1,Math.max(0,(time-s.started)/spec.windup));p.rim.visible=warning;p.disc.visible=warning;p.glyph.visible=warning;p.rim.material.opacity=.4+Math.sin(time*15)*.18;p.glyph.rotation.z=time*.8;p.disc.scale.setScalar(.15+.85*progress);p.core.visible=!warning;
   if(spec.kind==='lightning'){p.core.visible=age>=0&&age<.35;p.core.scale.setScalar(.9+Math.sin(time*90)*.1);}
   else if(spec.kind==='meteor'){p.core.visible=age<.1;p.core.position.y=Math.max(.4,(at-time)*12);p.core.visible=time>at-.7&&age<.15;if(age>=0){p.rim.visible=true;p.rim.material.opacity=Math.max(0,.7-age/spec.duration);}}
   else if(spec.kind==='wave'){p.core.scale.setScalar(Math.max(.02,age/spec.duration*spec.radius));}
   else if(spec.kind==='well'){p.core.rotation.y=time*1.8;p.core.children.forEach((o,i)=>{if(i<5){o.rotation.z=time*(i%2?-1:1);o.position.y=.15+i*.37+Math.sin(time*4+i)*.1;}});}
   else{p.core.visible=warning;p.core.rotation.y=time*4;p.core.scale.setScalar(.3+progress*.8);}
  }}
 return{root,get gates(){return gates;},get obstacles(){return cameraMeshes;},get layout(){return layout;},get spellCount(){return spellGroups.size;},setModels(m,p){templates=m;prepare=p;},rebuild,
  update(time,dt,run,playerPosition){root.visible=run.active;if(!run.active)return;rebuild(run.layout);for(const animate of animations)animate(time);gates.forEach((g,i)=>{const y=dungeonGateClosed(run,i)?0:7;g.position.y+=(y-g.position.y)*Math.min(1,dt*6);});for(const lamp of lamps)lamp.visible=!playerPosition||lamp.position.distanceTo(playerPosition)<42;
   portals[1].visible=run.phase==='complete';portals[2].visible=run.phase==='complete'&&run.claimed;
   for(const c of cacheModels){const opened=c.final?run.claimed:run.sideClaimed[c.roomId];if(c.lid)c.lid.rotation.x=c.base+(opened?-1:0);}
   const live=new Set(run.spells.map(s=>s.id));for(const [id,fx]of spellGroups)if(!live.has(id)){liveRoot.remove(fx.group);const gs=new Set(),ms=new Set();fx.group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>{if(![...materials.values()].includes(m))m.dispose();});spellGroups.delete(id);}
   for(const s of run.spells){if(!spellGroups.has(s.id))spellGroups.set(s.id,makeSpell(s));updateSpell(s,spellGroups.get(s.id),time);}
  }};
}
