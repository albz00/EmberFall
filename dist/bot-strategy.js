import {HURT_WINDOW,BOTS} from './combat.js?v=62';
import {WEAPONS,SHOP_WEAPONS,ARMORS,POTIONS,CHEST_PRICE,weaponStats,equippedItem,armorReduction,purchaseWeapon,purchaseArmor,purchasePotion,openChest,sellItem,equipInventoryItem} from './progression.js?v=62';

export function itemScore(item,role='duelist'){
 const s=weaponStats(item),ranged=s.kind==='staff';
 const damage=ranged?s.damage/s.cooldown*BOTS.strategy.spellAccuracy:s.damage/HURT_WINDOW;
 return damage+(ranged?7:s.reach*5)+s.speed*7+s.effects.reduce((v,e)=>v+(e.type==='frost'?5:6)*e.level,0)+(role==='ranger'&&ranged?WEAPONS.classic.damage*BOTS.strategy.rangerBonus:role!=='ranger'&&ranged?-WEAPONS.classic.damage*BOTS.strategy.meleeBias:0);
}
export function bestItem(account,role){return account.inventory.filter(i=>i.weapon).reduce((best,i)=>!best||itemScore(i,role)>itemScore(best,role)?i:best,null);}
// Every decision uses the bot's actual wallet and current gear. A guaranteed
// upgrade wins while equipment is weak; the chest becomes worthwhile later.
export function choosePurchase(account,role='duelist',risk=.5){
 const current=bestItem(account,role),score=itemScore(current,role),coins=account.coins;
 const armor=Object.entries(ARMORS).filter(([id,a])=>a.file&&!a.dungeonOnly&&!account.ownedArmor.includes(id)&&a.price<=coins&&a.reduction>(a.slot==='head'?(ARMORS[account.helmet]?.reduction??0):(ARMORS[account.armor]?.reduction??0))).sort((a,b)=>a[1].price-b[1].price);
 if(armor.length&&armorReduction(account)<.15)return{kind:'armor',id:armor[0][0],station:'weapons'};
 const weapons=SHOP_WEAPONS.filter(id=>WEAPONS[id].price<=coins&&!account.inventory.some(i=>i.weapon===id)&&itemScore({weapon:id,rarity:'common'},role)>score+7).sort((a,b)=>itemScore({weapon:b,rarity:'common'},role)-itemScore({weapon:a,rarity:'common'},role));
 if(weapons.length&&(score<56||coins<CHEST_PRICE*2||risk<.4))return{kind:'weapon',id:weapons[0],station:'weapons'};
 if(armor.length&&armorReduction(account)<.25&&risk<.72)return{kind:'armor',id:armor[0][0],station:'weapons'};
 if(coins>=CHEST_PRICE&&score>=38)return{kind:'chest',station:'chest'};
 if(weapons.length)return{kind:'weapon',id:weapons[0],station:'weapons'};
 if(coins>=POTIONS.healing.price&&account.potions.healing<2)return{kind:'potion',id:'healing',station:'potions'};
 return null;
}
export function transactBot(account,choice,role,random=Math.random){
 if(!choice)return{ok:false};
 const before=account.equipped;
 const result=choice.kind==='chest'?openChest(account,random):choice.kind==='armor'?purchaseArmor(account,choice.id):choice.kind==='potion'?purchasePotion(account,choice.id):purchaseWeapon(account,choice.id);
 if(!result.ok)return result;
 if(result.item?.armor)equipInventoryItem(account,result.item.id);
 account.equipped=bestItem(account,role).id;
 // Keep the best six weapons; salvage genuinely worse rolls to fund a later trip.
 if(account.inventory.filter(i=>i.weapon).length>7){const extras=account.inventory.filter(i=>i.weapon&&!i.bound&&i.id!==account.equipped).sort((a,b)=>itemScore(a,role)-itemScore(b,role));for(const item of extras.slice(0,account.inventory.filter(i=>i.weapon).length-7))sellItem(account,item.id);}
 return{...result,changed:before!==account.equipped,choice};
}
export function tacticalGoal(bot,target,hunt=false){
 const p=bot.position,t=target.position,dx=p.x-t.x,dz=p.z-t.z,d=Math.max(.1,Math.hypot(dx,dz)),ranged=bot.combatMode==='bow'||bot.stats.kind==='staff';
 const prediction=Math.min(.55,d/(ranged?(bot.combatMode==='bow'?52:bot.stats.projectileSpeed):22));
 const px=t.x+(target.velocity?.x??0)*prediction,pz=t.z+(target.velocity?.z??0)*prediction;
 if(ranged){const distance=bot.hp<bot.kit.health*.35?13:bot.combatMode==='bow'?12:10;return{x:px+dx/d*distance,z:pz+dz/d*distance,y:t.y};}
 const radius=hunt?Math.max(1.8,bot.stats.reach*.78):bot.skill.cps>=7?bot.stats.reach+.04:bot.skill.cps>=5?bot.stats.reach-.4:1.8;
 const angle=hunt?bot.id*2.3999632297:Math.atan2(dx,dz)+(bot.role==='flanker'?bot.strafe*.65:0);
 return{x:px+Math.sin(angle)*radius,z:pz+Math.cos(angle)*radius,y:t.y};
}
export function targetScore(bot,target,isPlayer,current){
 const distance=bot.position.distanceTo(target.position),health=(isPlayer?target.health:target.hp)/(isPlayer?(target.maxHealth??400):target.kit.health);
 return distance*(current?.82:1)/(1+Math.min(12,target.streak??0)*.12)+health*2-(health<.28?3:0)+(isPlayer?-.7:0);
}
