import {MERCHANT,WEAPONS,addInventoryItem,makeItemId} from './progression.js?v=65';

// Stock follows real time: each restock cycle draws its weapons and sell-out times from the cycle number,
// so only the player's own purchases are saved.
const cycleLength=MERCHANT.restock*1000;
function seeded(seed){let s=(seed*2654435761)>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}

export function merchantCycle(now=Date.now()){return Math.floor(now/cycleLength);}

export function merchantStock(state,now=Date.now()){
 const cycle=merchantCycle(now),start=cycle*cycleLength,rng=seeded(cycle+1),pool=[...MERCHANT.weapons],bought=state?.cycle===cycle?state.bought??[]:[];
 const items=[];for(let n=0;n<MERCHANT.offered;n++){const weapon=pool.splice(Math.floor(rng()*pool.length),1)[0],soldOutAt=start+(MERCHANT.sellOut.min+rng()*MERCHANT.sellOut.spread)*1000;
  items.push({weapon,price:WEAPONS[weapon].price,soldOutAt,status:bought.includes(weapon)?'bought':now>=soldOutAt?'sold':'available'});}
 return{cycle,restockAt:start+cycleLength,items};
}

export function sanitizeMerchantState(raw){return{cycle:Number.isInteger(raw?.cycle)?raw.cycle:-1,bought:Array.isArray(raw?.bought)?raw.bought.filter(id=>MERCHANT.weapons.includes(id)):[]};}

export function buyExotic(p,state,id,now=Date.now()){
 const stock=merchantStock(state,now),entry=stock.items.find(i=>i.weapon===id);
 if(!entry)return{ok:false,error:`${MERCHANT.name} is not selling that this restock`};
 if(entry.status!=='available')return{ok:false,error:`${WEAPONS[id].name} is sold out`};
 if(p.coins<entry.price)return{ok:false,error:`Need ${(entry.price-p.coins).toLocaleString()} more coins`};
 const result=addInventoryItem(p,{id:makeItemId(p,'exotic'),weapon:id,rarity:WEAPONS[id].rarity});if(!result.ok)return result;
 p.coins-=entry.price;if(state.cycle!==stock.cycle){state.cycle=stock.cycle;state.bought=[];}state.bought.push(id);return result;
}

// One roll per landed direct melee hit.
export function rollProc(stats,random=Math.random){return stats?.proc&&random()<stats.proc.chance?stats.proc:null;}
