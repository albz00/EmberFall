import {skillBonuses} from './skills.js?v=68';
import {CONFIG} from './shared/config.js?v=68';
export const STAMINA=CONFIG.combat.stamina;
export const staminaMaximum=actor=>STAMINA.maximum*(1+skillBonuses(actor.account??actor).staminaMax);
export function resetStamina(actor){actor.stamina=staminaMaximum(actor);actor.staminaReadyAt=0;actor.exhausted=false;}
export function canSprint(actor){return !actor.exhausted&&(actor.stamina??STAMINA.maximum)>0;}
export function spendStamina(actor,amount,time,unlimited=false){
 if(unlimited)return true;
 if((actor.stamina??STAMINA.maximum)<amount)return false;
 actor.stamina=Math.max(0,(actor.stamina??STAMINA.maximum)-amount);actor.staminaReadyAt=time+STAMINA.regenDelay;if(actor.stamina===0)actor.exhausted=true;return true;
}
export function updateStamina(actor,dt,time,sprinting=false,unlimited=false){
 actor.stamina??=STAMINA.maximum;
 if(unlimited){resetStamina(actor);return;}
 if(sprinting){actor.stamina=Math.max(0,actor.stamina-STAMINA.sprintDrain*(1-skillBonuses(actor.account??actor).sprintDrain)*dt);actor.staminaReadyAt=time+STAMINA.regenDelay;if(actor.stamina===0)actor.exhausted=true;}
 else if(time>=(actor.staminaReadyAt??0))actor.stamina=Math.min(staminaMaximum(actor),actor.stamina+STAMINA.regenRate*(1+skillBonuses(actor.account??actor).staminaRegen)*dt);
 if(actor.stamina>=STAMINA.resumeAt)actor.exhausted=false;
}
