import {MELEE,HITBOX,rayHitCandidate} from './combat.js?v=69';

// Visual feedback only. The narrow melee ray remains the authority for damage.
export function findAimFocus(actors,origin,direction,reach,eligible=()=>true,occluded=()=>false){
 let result=null,best=Infinity;
 for(const actor of actors){
  if(!actor.alive||!eligible(actor))continue;
  const p=actor.position,height=actor.crouched?HITBOX.crouched:HITBOX.height;
  const depth=(p.x-origin.x)*direction.x+(p.y+height/2-origin.y)*direction.y+(p.z-origin.z)*direction.z;
  if(depth<0||depth>MELEE.targeting.range+HITBOX.radius)continue;
  const allowance=MELEE.aimPadding+depth*MELEE.targeting.cone;
  const distance=rayHitCandidate(origin,direction,p,MELEE.targeting.range,height,allowance);
  if(distance===null||distance>=best||occluded(actor))continue;
  best=distance;result={actor,canStrike:rayHitCandidate(origin,direction,p,reach,height,MELEE.aimPadding)!==null};
 }
 return result;
}
