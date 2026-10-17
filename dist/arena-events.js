import {CONFIG} from './shared/config.js?v=62';
import {MAP,isUnderBridge} from './shared/map.js?v=62';
const BOW=CONFIG.combat.bow,TARGETING=CONFIG.bots.targeting,{schedule:SCHEDULE,killstreaks:KILLSTREAKS}=CONFIG.events;
export const EVENT_SCHEDULE=SCHEDULE,SUPPLIES=CONFIG.events.supplies;
// Retained arena navigation helpers; scheduled events are supply giveaways only.
export const BRIDGE_COVER_POINTS=MAP.navigation.bridgeCover.map(p=>({x:p.x,y:0,z:p.z}));
export const DESTINATIONS=MAP.navigation.destinations.map(({x,z,y})=>y===undefined?{x,z}:{x,z,y});
export const EVENT_TYPES=CONFIG.events.types;
export {isUnderBridge};
export function nearestBridgeCover(p,id=0){const point=BRIDGE_COVER_POINTS.reduce((best,s)=>Math.hypot(p.x-s.x,p.z-s.z)<Math.hypot(p.x-best.x,p.z-best.z)?s:best,BRIDGE_COVER_POINTS[0]);return{x:point.x+(id%3-1)*.45,y:0,z:point.z+(Math.floor(id/3)%3-1)*.35};}
export function streakTier(streak){return KILLSTREAKS.tiers.filter(tier=>streak>=tier).length;}
export function targetPriority(distance,streak,current=false){return distance/(1+Math.min(TARGETING.streakCap,streak)*TARGETING.streakWeight)*(current?TARGETING.currentBias:1);}
export function arrowDamage(charge){return Math.round(BOW.baseDamage+Math.max(0,Math.min(1,charge))*BOW.chargeDamage);}
export function createEventState(now=0){return{phase:'idle',type:null,at:now+SCHEDULE.firstDelay,nextPulse:0,serial:0};}
export function advanceEvent(state,now,random=Math.random){
 if(now<state.at)return null;
 if(state.phase==='idle'){state.phase='warning';const alternatives=EVENT_TYPES.filter(t=>t.id!==state.type?.id),options=alternatives.length?alternatives:EVENT_TYPES;state.type=options[Math.floor(random()*options.length)];state.at=now+SCHEDULE.warning;state.serial++;return'warning';}
 if(state.phase==='warning'){state.phase='active';state.at=now+state.type.duration;state.nextPulse=now;return'start';}
 state.phase='idle';state.at=now+SCHEDULE.idleMin+random()*SCHEDULE.idleSpread;return'end';
}
