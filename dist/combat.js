import {CONFIG} from './shared/config.js?v=50';
const {kits,movement,melee,knockback:KNOCK,bow}=CONFIG.combat;
export const KITS=kits;
export const BOTS=CONFIG.bots;
export const BOT_PROFILES=BOTS.profiles;
export const MAX_BOTS=BOTS.maxBots;
const EXTRA_NAMES=BOTS.extraNames,GENERATED=BOTS.generated;
export function botProfile(id){
 if(BOT_PROFILES[id])return {...BOT_PROFILES[id]};
 const base=BOT_PROFILES[(id*5+2)%BOT_PROFILES.length],variation=Math.sin(id*17.3);
 return {...base,name:EXTRA_NAMES[id-BOT_PROFILES.length]??'Fighter'+(id+1),cps:Math.max(GENERATED.cps.min,Math.min(GENERATED.cps.max,base.cps+variation*GENERATED.cps.variation)),reaction:Math.max(GENERATED.reaction.min,base.reaction+variation*GENERATED.reaction.variation),rating:Math.max(GENERATED.rating.min,Math.round(base.rating+variation*GENERATED.rating.variation))};
}
// Classic melee hurt resistance. Input and impact happen immediately, independently of swing animation.
export const HURT_WINDOW=melee.hurtWindow;
export const HITBOX=melee.hitbox;
export const MELEE=melee;
export const BOW=bow;
export function rayHitCandidate(origin,direction,target,reach=melee.defaultReach,height=HITBOX.height){
 let near=0,far=reach;
 for(const key of ['x','y','z']){
  const low=target[key]-(key==='y'?0:HITBOX.radius),high=target[key]+(key==='y'?height:HITBOX.radius),d=direction[key];
  if(Math.abs(d)<1e-8){if(origin[key]<low||origin[key]>high)return null;continue;}
  let a=(low-origin[key])/d,b=(high-origin[key])/d;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
 }
 return near;
}
export function hitCandidate(origin,yaw,pitch,target,reach=melee.defaultReach,height=HITBOX.height){
 return rayHitCandidate(origin,{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)},target,reach,height);
}
export function resetMeleeState(actor){actor.sprint={active:false,needsReset:false};actor.lastDirectHit=-Infinity;actor.lastSprintHit=-Infinity;actor.lastLandedHit=-Infinity;actor.comboTarget=null;actor.comboCount=0;}
export function releaseSprint(actor){const s=actor.sprint??={active:false,needsReset:false};s.active=false;s.needsReset=false;}
export function updateSprint(actor,requested){
 const s=actor.sprint??={active:false,needsReset:false};
 if(!requested){releaseSprint(actor);return false;}
 s.active=!s.needsReset;return s.active;
}
export function consumeSprintHit(actor,time){
 const s=actor.sprint,boost=!!s?.active&&Math.hypot(actor.velocity.x,actor.velocity.z)>melee.sprintHit.minimumSpeed;
 // Only a registered melee hit consumes sprint. Misses and immune contacts do not.
 if(s?.active){s.active=false;s.needsReset=true;actor.velocity.x*=melee.sprintHit.velocityRetained;actor.velocity.z*=melee.sprintHit.velocityRetained;}
 if(boost)actor.lastSprintHit=time;
 return boost;
}
export function damageReady(actor,time){return time-(actor.lastDirectHit??-Infinity)>=HURT_WINDOW-1e-8;}
export function registerMeleeHit(attacker,victim,time){
 attacker.comboCount=attacker.comboTarget===victim&&time-attacker.lastLandedHit<=melee.comboWindow?(attacker.comboCount??0)+1:1;
 attacker.comboTarget=victim;attacker.lastLandedHit=time;return attacker.comboCount;
}
export function breakCombo(actor){actor.comboCount=0;actor.comboTarget=null;}
export function combatKnockback(victim,attacker,force,critical,guarded=false,sprintHit=false){
 let x=victim.position.x-attacker.position.x,z=victim.position.z-attacker.position.z,d=Math.hypot(x,z);if(d<.001){x=0;z=-1;d=1;}x/=d;z/=d;
 const power=Math.min(KNOCK.maximum,force*KNOCK.forceScale+(sprintHit?force*KNOCK.sprintForceScale+KNOCK.sprintBonus:0))*(guarded?KNOCK.guardedScale:1);
 victim.knock.x=victim.knock.x*KNOCK.retained+x*power;victim.knock.z=victim.knock.z*KNOCK.retained+z*power;
 const magnitude=Math.hypot(victim.knock.x,victim.knock.z);if(magnitude>KNOCK.maximum){victim.knock.x*=KNOCK.maximum/magnitude;victim.knock.z*=KNOCK.maximum/magnitude;}
 const into=victim.velocity.x*x+victim.velocity.z*z;if(into<0){victim.velocity.x-=x*into*KNOCK.counterVelocity;victim.velocity.z-=z*into*KNOCK.counterVelocity;}
 // A short lift opens a spacing advantage; impulses do not stack into permanent flight.
 victim.velocity.y=Math.max(victim.velocity.y,KNOCK.lift[guarded?'guarded':critical?'critical':sprintHit?'sprint':'normal']);victim.grounded=false;
}
export function steerMovement(actor,x,z,dt){
 const length=Math.hypot(actor.knock.x,actor.knock.z);
 if(length>.01){
  const nx=actor.knock.x/length,nz=actor.knock.z/length,against=x*nx+z*nz;
  if(against<0){const resisted=Math.min(KNOCK.steering.maxResist,length/KNOCK.steering.resistDivisor);x-=nx*against*resisted;z-=nz*against*resisted;}
 }
 const blend=1-Math.exp(-dt*(actor.grounded?KNOCK.steering.groundBlend:KNOCK.steering.airBlend));
 actor.velocity.x+=(x-actor.velocity.x)*blend;actor.velocity.z+=(z-actor.velocity.z)*blend;
}
export function decayKnockback(actor,dt){const drag=Math.exp(-(actor.grounded?KNOCK.decay.ground:KNOCK.decay.air)*dt);actor.knock.x*=drag;actor.knock.z*=drag;}

// Choose a complete crossing before takeoff, including a dry landing footprint.
export function planLavaJump(position,target,isBlocked,isHazard){
 if(position.y>.28)return null;
 const dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz);if(distance<.2)return null;
 const base=Math.atan2(dx,dz),escaping=isHazard(position.x,position.z,0),flight=2*7.8/22;
 const angles=escaping?[0,.5,-.5,1,-1,1.6,-1.6,Math.PI]:[0,.22,-.22,.48,-.48];
 for(const offset of angles){const angle=base+offset,x=Math.sin(angle),z=Math.cos(angle);let entry=escaping?0:null,exit=null;
  for(let d=.2;d<=4.35;d+=.15){const px=position.x+x*d,pz=position.z+z*d;if(isBlocked(px,pz,0,.38))break;const hot=isHazard(px,pz,0);if(hot&&entry===null)entry=d;if(entry!==null&&!hot){exit=d;break;}}
  if(entry===null||entry>1.75||exit===null)continue;
  const landingDistance=exit+.7;if(landingDistance>4.95)continue;const landing={x:position.x+x*landingDistance,z:position.z+z*landingDistance};let safe=true;
  for(const along of[-.35,0,.5])for(const side of[-.4,0,.4]){const px=landing.x+x*along+z*side,pz=landing.z+z*along-x*side;if(isBlocked(px,pz,0,.38)||isHazard(px,pz,0))safe=false;}
  if(safe)return{x,z,landing,speed:landingDistance/flight,vertical:7.8+Math.max(0,-position.y)/flight,duration:flight};
 }
 return null;
}
export function attackDamage(base,kit,critical=false,blocking=false,armor=0){return Math.max(melee.minimumDamage,Math.round(base*kit.damageMultiplier*(critical?melee.criticalMultiplier:1)*(blocking?melee.blockMultiplier:1)*(1-armor)));}
export function clickInterval(profile,random=Math.random){return (1/profile.cps)*(BOTS.clicks.jitterMin+random()*BOTS.clicks.jitterSpread);}
export function turnAngle(current,target,factor){const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+delta*Math.min(1,Math.max(0,factor));}
export function chooseSteer(position,target,isBlocked,isHazard,time,id){
  const dx=target.x-position.x,dz=target.z-position.z,d=Math.hypot(dx,dz);if(d<.001)return{x:0,z:0};
  const base=Math.atan2(dx,dz);let best=null;
  for(const offset of [0,.5,-.5,1,-1,1.55,-1.55,2.3,-2.3]){const a=base+offset,x=Math.sin(a),z=Math.cos(a),px=position.x+x*1.25,pz=position.z+z*1.25;let score=Math.cos(offset)*3;if(isBlocked(px,pz,position.y))score-=20;if(isHazard(px,pz,position.y))score-=10;if(isBlocked(position.x+x*.55,position.z+z*.55,position.y))score-=15;score+=Math.sin(time*.6+id+offset)*.06;if(!best||score>best.score)best={x,z,score};}
  return best.score< -8?{x:0,z:0}:best;
}

export const MOVEMENT=movement;
export function movementSpeed(kit,gear=0,sprint=false){return(kit.speed+gear*MOVEMENT.gearSpeed)*(sprint?MOVEMENT.sprint:1);}
export function gaitStride(leg,speed,crouched=false){return leg*(crouched?1.4:speed>5.65?3.45:speed>3.45?2.7:1.75);}
