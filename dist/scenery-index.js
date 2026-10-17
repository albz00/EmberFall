import * as THREE from './vendor/three.module.js';
// Static scenery is indexed once. Camera and aim rays visit only crossed grid columns,
// never update the entire scene or skin every opponent to find a point under the crosshair.
export function createSceneryIndex(meshes,cellSize=4){
 const columns=new Map(),vertices=[],low=[],high=[],sides=[];const v=new THREE.Vector3();
 for(const mesh of meshes){
  if(!mesh.visible||mesh.isSkinnedMesh||mesh.isInstancedMesh||mesh.userData.noCameraCollision)continue;
  const g=mesh.geometry,p=g?.attributes.position;if(!p)continue;mesh.updateWorldMatrix(true,false);
  const index=g.index,start=g.drawRange.start??0,end=Math.min(index?.count??p.count,start+(g.drawRange.count??Infinity));
  for(let i=start;i+2<end;i+=3){
   const group=g.groups.find(s=>i>=s.start&&i<s.start+s.count),material=Array.isArray(mesh.material)?mesh.material[group?.materialIndex??0]:mesh.material;
   if(!material||material.visible===false||material.transparent&&material.opacity<.9)continue;
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,minY=Infinity,maxY=-Infinity;const points=[];
   for(let j=0;j<3;j++){v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);points.push(v.x,v.y,v.z);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minZ=Math.min(minZ,v.z);maxZ=Math.max(maxZ,v.z);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
   const id=low.length;vertices.push(...points);low.push(minY);high.push(maxY);sides.push(material.side);
   for(let x=Math.floor(minX/cellSize);x<=Math.floor(maxX/cellSize);x++)for(let z=Math.floor(minZ/cellSize);z<=Math.floor(maxZ/cellSize);z++){const key=x+','+z;let cell=columns.get(key);if(!cell)columns.set(key,cell=[]);cell.push(id);}
  }
 }
 const data=new Float32Array(vertices),minY=new Float32Array(low),maxY=new Float32Array(high),stamp=new Uint32Array(low.length),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3(),ray=new THREE.Ray();let query=0,lastTests=0;
 return {triangles:low.length,get lastTests(){return lastTests;},distance(origin,direction,far,near=.05){
  lastTests=0;if(!Number.isFinite(far)||far<=0)return null;
  query=(query+1)>>>0;if(!query){stamp.fill(0);query=1;}ray.set(origin,direction);let best=far,found=false;
  let x=Math.floor(origin.x/cellSize),z=Math.floor(origin.z/cellSize),t=0;const sx=Math.sign(direction.x),sz=Math.sign(direction.z),dx=sx?cellSize/Math.abs(direction.x):Infinity,dz=sz?cellSize/Math.abs(direction.z):Infinity;
  let tx=sx?((x+(sx>0?1:0))*cellSize-origin.x)/direction.x:Infinity,tz=sz?((z+(sz>0?1:0))*cellSize-origin.z)/direction.z:Infinity;
  for(let count=0;count<4096&&t<=best;count++){
   const next=Math.min(tx,tz,best),y1=origin.y+direction.y*t,y2=origin.y+direction.y*next;
   for(const id of columns.get(x+','+z)??[]){
    if(stamp[id]===query||maxY[id]<Math.min(y1,y2)-1e-5||minY[id]>Math.max(y1,y2)+1e-5)continue;
    stamp[id]=query;lastTests++;const i=id*9;a.fromArray(data,i);b.fromArray(data,i+3);c.fromArray(data,i+6);
    const point=sides[id]===THREE.BackSide?ray.intersectTriangle(c,b,a,true,hit):ray.intersectTriangle(a,b,c,sides[id]!==THREE.DoubleSide,hit);
    if(point){const distance=origin.distanceTo(point);if(distance>=near&&distance<=best){best=distance;found=true;}}
   }
   if(!sx&&!sz||Math.min(tx,tz)>best)break;
   if(tx<tz){t=tx;tx+=dx;x+=sx;}else if(tz<tx){t=tz;tz+=dz;z+=sz;}else{t=tx;tx+=dx;tz+=dz;x+=sx;z+=sz;}
  }
  return found?best:null;
 }};
}
