import {mapSurfaces,rampSurfaceHeight} from './shared/map-queries.js?v=45';
export function createElevationRouter(map){
 const surfaces=mapSurfaces(map),inside=(s,p,margin=0)=>p.x>s.minX-margin&&p.x<s.maxX+margin&&p.z>s.minZ-margin&&p.z<s.maxZ+margin;
 const ramps=surfaces.filter(s=>s.type==='ramp').map(s=>{const x=(s.minX+s.maxX)/2,z=(s.minZ+s.maxZ)/2,alongZ=s.rises[1]==='z',positive=s.rises[0]==='+';
  const low={x:alongZ?x:positive?s.minX:s.maxX,z:alongZ?positive?s.minZ:s.maxZ:z},high={x:alongZ?x:positive?s.maxX:s.minX,z:alongZ?positive?s.maxZ:s.minZ:z};return{s,low,high,alongZ};});
 return (position,goal)=>{
  const floor=surfaces.filter(s=>s.type==='flat'&&inside(s,goal)&&s.top<=((goal.y??position.y)+.8)&&s.top>position.y+.65).sort((a,b)=>b.top-a.top)[0];if(!floor)return goal;
  let route=null,best=Infinity;
  for(const r of ramps){if(Math.abs(r.s.base+r.s.rise-floor.top)>.05||!inside(floor,r.high,.12))continue;
   const score=Math.hypot(position.x-r.low.x,position.z-r.low.z)+Math.hypot(goal.x-r.high.x,goal.z-r.high.z)*.25;if(score>=best)continue;route=r;best=score;}
  if(!route)return goal;const {s,low,high,alongZ}=route;
  const onRamp=inside(s,position,.2)&&Math.abs(position.y-rampSurfaceHeight(s,position.x,position.z))<.8,atFoot=Math.hypot(position.x-low.x,position.z-low.z)<.8;
  const direction=Math.sign((alongZ?high.z:high.x)-(alongZ?low.z:low.x));
  return onRamp||atFoot?{x:high.x+(alongZ?0:direction*.6),z:high.z+(alongZ?direction*.6:0),y:floor.top}:{x:low.x-(alongZ?0:direction*.55),z:low.z-(alongZ?direction*.55:0),y:s.base};
 };
}
