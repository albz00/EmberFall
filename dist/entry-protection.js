import {CONFIG} from './shared/config.js?v=69';
export const SPAWN_RULES=CONFIG.combat.spawn;
export function resetEntry(actor){actor.entryArmed=false;actor.entryFalling=false;actor.entryProtectedUntil=0;}
// Arm only after observing a fighter on the actual ledge. A normal pit jump
// cannot arm this state. Touching lava also ends the descent's untimed phase.
export function trackEntry(actor,time,{onLedge=false,atLedgeFloor=false,landed=false,enabled=true}={}){
 if(!enabled){resetEntry(actor);return false;}
 if(onLedge&&atLedgeFloor){actor.entryArmed=true;actor.entryFalling=false;actor.entryProtectedUntil=0;return false;}
 if(actor.entryArmed&&!onLedge){actor.entryArmed=false;actor.entryFalling=true;actor.entryProtectedUntil=0;actor.effects={};actor.poison=null;actor.slowUntil=0;}
 if(actor.entryFalling&&landed){actor.entryFalling=false;actor.entryProtectedUntil=time+SPAWN_RULES.landingProtection;return true;}
 return false;
}
export const entryProtected=(actor,time)=>!!actor&&(actor.entryFalling===true||time<(actor.entryProtectedUntil??0));
export const entryStrength=(actor,time)=>actor?.entryFalling?1:Math.max(0,Math.min(1,((actor?.entryProtectedUntil??0)-time)/SPAWN_RULES.landingProtection));
export const respawnRemaining=(actor,time)=>Math.max(0,(actor.respawnAt??0)-time);
