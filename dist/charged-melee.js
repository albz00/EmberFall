import {CONFIG} from './shared/config.js?v=65';
export const HEAVY=CONFIG.combat.heavy;
export const chargeProgress=elapsed=>elapsed>=HEAVY.full-1e-6?1:Math.max(0,Math.min(1,(elapsed-HEAVY.windup)/(HEAVY.full-HEAVY.windup)));
export function chargedStats(stats,power){
 const p=Math.max(0,Math.min(1,power));
 return {...stats,damage:stats.absoluteDamage?stats.damage:Math.round(stats.damage*(HEAVY.damage.base+p*HEAVY.damage.perPower)),knockback:stats.knockback*(HEAVY.knockback.base+p*HEAVY.knockback.perPower),heavy:true,power:p,melee:true};
}
export const heavyRecovery=power=>HEAVY.minRecovery+(HEAVY.maxRecovery-HEAVY.minRecovery)*Math.max(0,Math.min(1,power));
