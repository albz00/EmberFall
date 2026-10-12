// Progress is measured in world space, so animation or attempted velocity
// cannot disguise a bot that has been pushing the same obstacle for seconds.
export function navigationGoal(actor,goal,time,blocked,hazard,arenaRadius=31.2){
 const p=actor.position,state=actor.navigation??={at:time,x:p.x,z:p.z,stalled:0,until:0,goal:null};
 let target={x:goal.x,y:goal.y??p.y,z:goal.z};
 if(arenaRadius){const radius=Math.hypot(target.x,target.z);if(radius>arenaRadius){target.x*=arenaRadius/radius;target.z*=arenaRadius/radius;}}
 if(time-state.at>.7){
  const moved=Math.hypot(p.x-state.x,p.z-state.z),intent=Math.hypot(actor.velocity.x,actor.velocity.z),remaining=Math.hypot(target.x-p.x,target.z-p.z);
  state.stalled=actor.grounded&&intent>.8&&remaining>1.5&&moved<.28?state.stalled+(time-state.at):0;state.at=time;state.x=p.x;state.z=p.z;
  if(state.stalled>1.3){
   const inward=arenaRadius&&Math.hypot(p.x,p.z)>29?Math.atan2(-p.x,-p.z):Math.atan2(target.x-p.x,target.z-p.z);let best=null;
   for(const distance of [2.5,4.5,6])for(const offset of [0,.8,-.8,1.6,-1.6,2.5,-2.5,Math.PI]){
    const a=inward+offset,x=p.x+Math.sin(a)*distance,z=p.z+Math.cos(a)*distance;
    if(arenaRadius&&Math.hypot(x,z)>arenaRadius||blocked(x,z,p.y)||hazard(x,z,p.y))continue;
    let clear=true;for(let d=.8;d<distance;d+=.5)if(blocked(p.x+Math.sin(a)*d,p.z+Math.cos(a)*d,p.y)){clear=false;break;}
    if(!clear)continue;const score=Math.cos(offset)*2+distance*.08;if(!best||score>best.score)best={x,z,y:p.y,score};
   }
   if(best){state.goal=best;state.until=time+2.4;actor.aiTimer=0;actor.planUntil=0;}state.stalled=0;
  }
 }
 if(state.goal&&time<state.until&&Math.hypot(state.goal.x-p.x,state.goal.z-p.z)>.6)return state.goal;
 state.goal=null;return target;
}
