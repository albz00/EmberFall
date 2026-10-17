import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
// Forward is -Z for both the nocked arrow and projectile flight. Each arrow owns
// its three merged geometries/materials, matching the projectile disposal path.
export function makeArrow(){
 const root=new THREE.Group();root.name='arrow';root.userData.nockZ=.395;
 const parts={wood:[],metal:[],feather:[]},matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);
 const add=(kind,geometry,x,y,z,rotation=new THREE.Euler())=>{q.setFromEuler(rotation);matrix.compose(new THREE.Vector3(x,y,z),q,scale);geometry.applyMatrix4(matrix);parts[kind].push(geometry);};
 add('wood',new THREE.CylinderGeometry(.014,.018,.76,7),0,0,0,new THREE.Euler(Math.PI/2,0,0));
 // A broad, sharpened diamond point with a raised center ridge.
 const head=new THREE.BufferGeometry(),v=[0,0,-.57,-.065,0,-.405,0,.022,-.405,.065,0,-.405,0,-.022,-.405,0,0,-.34];
 head.setAttribute('position',new THREE.Float32BufferAttribute(v,3));head.setIndex([0,1,2,0,2,3,0,3,4,0,4,1,5,2,1,5,3,2,5,4,3,5,1,4]);head.computeVertexNormals();add('metal',head,0,0,0);
 for(const z of[-.36,.25,.33])add('metal',new THREE.CylinderGeometry(.021,.021,.018,7),0,0,z,new THREE.Euler(Math.PI/2,0,0));
 // Three swept feather vanes, each with a cut trailing edge rather than a box.
 for(let i=0;i<3;i++){
  const shape=new THREE.Shape();shape.moveTo(.012,.15);shape.lineTo(.082,.255);shape.lineTo(.078,.35);shape.lineTo(.012,.32);shape.closePath();
  const fin=new THREE.ShapeGeometry(shape);fin.rotateX(Math.PI/2);add('feather',fin,0,0,0,new THREE.Euler(0,0,i*Math.PI*2/3));
 }
 // Split nock; the bowstring seats between the two short prongs.
 for(const x of[-.012,.012])add('wood',new THREE.BoxGeometry(.012,.022,.06),x,0,.395);
 const materials={wood:new THREE.MeshStandardMaterial({color:0xb88c57,roughness:.8}),metal:new THREE.MeshStandardMaterial({color:0xd1dce6,metalness:.72,roughness:.28}),feather:new THREE.MeshStandardMaterial({color:0xf1d9a3,roughness:.9,side:THREE.DoubleSide})};
 for(const [kind,geometries]of Object.entries(parts)){const inputs=geometries.map(g=>{const n=g.index?g.toNonIndexed():g.clone();n.deleteAttribute('uv');return n;}),geometry=mergeGeometries(inputs);[...geometries,...inputs].forEach(g=>g.dispose());geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,materials[kind]);mesh.name='arrow-'+kind;root.add(mesh);}
 return root;
}
