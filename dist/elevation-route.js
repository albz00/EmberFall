import {mapSurfaces,rampSurfaceHeight,objectColliders,surfaceWorld,surfaceContains} from './shared/map-queries.js?v=65';
export function createElevationRouter(map){
 const rooms=map.objects.flatMap(o=>objectColliders(map,o)).filter(c=>c.type==='ring');
 const surfaces=mapSurfaces(map),inside=surfaceContains;
 const ramps=surfaces.filter(s=>s.type==='ramp').map(s=>{const x=(s.minX+s.maxX)/2,z=(s.minZ+s.maxZ)/2,alongZ=s.rises[1]==='z',positive=s.rises[0]==='+';
  const low={x:alongZ?x:positive?s.minX:s.maxX,z:alongZ?positive?s.minZ:s.maxZ:z},high={x:alongZ?x:positive?s.maxX:s.minX,z:alongZ?positive?s.maxZ:s.minZ:z};return{s,low:surfaceWorld(s,low.x,low.z),high:surfaceWorld(s,high.x,high.z),alongZ};});
 const route=(position,goal,depth=0)=>{if(depth>8)return goal;
  for(const room of rooms){const here=Math.hypot(position.x-room.x,position.z-room.z)<room.inner,there=Math.hypot(goal.x-room.x,goal.z-room.z)<room.inner;if(here===there)continue;const sin=Math.sin(room.rotation),cos=Math.cos(room.rotation),dx=position.x-room.x,dz=position.z-room.z,localX=dx*cos-dz*sin,localZ=dx*sin+dz*cos;if(!here&&localZ>room.inner-.2&&Math.abs(localX)<.65)return goal;return{x:room.x+sin*(room.r+.7),z:room.z+cos*(room.r+.7),y:room.minY};}

  const floor=surfaces.filter(s=>s.type==='flat'&&inside(s,goal)&&s.top<=((goal.y??position.y)+.8)&&s.top>position.y+.1).sort((a,b)=>b.top-a.top)[0];if(!floor)return goal;
  const connected=new Set([floor]);for(let i=0;i<surfaces.length;i++)for(const s of surfaces)if(s.type==='flat'&&Math.abs(s.top-floor.top)<.05&&[...connected].some(f=>s.maxX>=f.minX&&s.minX<=f.maxX&&s.maxZ>=f.minZ&&s.minZ<=f.maxZ))connected.add(s);
  let chosen=null,best=Infinity;
  for(const r of ramps){if(Math.abs(r.s.base+r.s.rise-floor.top)>.05||![...connected].some(f=>inside(f,r.high,.12)))continue;
   const score=Math.hypot(position.x-r.low.x,position.z-r.low.z)+Math.hypot(goal.x-r.high.x,goal.z-r.high.z)*.25;if(score>=best)continue;chosen=r;best=score;}
  if(!chosen)return goal;const {s,low,high,alongZ}=chosen;if(position.y<s.base-.6)return route(position,{...low,y:s.base},depth+1);
  const onRamp=inside(s,position,.2)&&Math.abs(position.y-rampSurfaceHeight(s,position.x,position.z))<.8,atFoot=Math.hypot(position.x-low.x,position.z-low.z)<.8;
  const length=Math.hypot(high.x-low.x,high.z-low.z),dx=(high.x-low.x)/length,dz=(high.z-low.z)/length;
  return onRamp||atFoot?{x:high.x+dx*.6,z:high.z+dz*.6,y:floor.top}:{x:low.x-dx*.55,z:low.z-dz*.55,y:s.base};
 };return route;
}
