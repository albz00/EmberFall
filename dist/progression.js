import {CONFIG} from './shared/config.js?v=62';
import {deepFreeze} from './shared/schema.js?v=26';
const {inventory:INVENTORY,storage:STORAGE,starterKit:STARTER,chest:CHEST,salvage:SALVAGE,rewards:REWARDS}=CONFIG.progression;
export const WEAPONS=CONFIG.weapons.weapons;
export const MERCHANT=CONFIG.progression.merchant;
export const SHOP_WEAPONS=Object.keys(WEAPONS).filter(id=>!MERCHANT.weapons.includes(id)&&!WEAPONS[id].dungeonOnly);
export const SPELLS=CONFIG.weapons.spells;
export const ARMORS=CONFIG.armor.armor;
export const POTIONS=CONFIG.consumables.potions;
export function armorReduction(p){return 1-(1-(ARMORS[p.armor]?.reduction??0))*(1-(ARMORS[p.helmet]?.reduction??0));}
export const COSMETICS=CONFIG.cosmetics.cosmetics;
export function purchaseCosmetic(p,id){
 const item=Object.hasOwn(COSMETICS,id)?COSMETICS[id]:null;if(!item)return{ok:false,error:'Unknown effect'};
 p.ownedCosmetics??=['none'];
 if(p.ownedCosmetics.includes(id)){p.cosmetic=id;return{ok:true,equipped:true};}
 if(p.coins<item.price)return{ok:false,error:`Need ${item.price-p.coins} more coins`};
 p.coins-=item.price;p.ownedCosmetics.push(id);p.cosmetic=id;return{ok:true};
}
export const NAMEPLATES=CONFIG.cosmetics.nameplates;
export function purchaseNameplate(p,id){
 const plate=Object.hasOwn(NAMEPLATES,id)?NAMEPLATES[id]:null;if(!plate)return{ok:false,error:'Unknown nameplate'};
 p.ownedNameplates??=['none'];
 if(p.ownedNameplates.includes(id)){p.nameplate=id;return{ok:true,equipped:true};}
 if(p.coins<plate.price)return{ok:false,error:`Need ${plate.price-p.coins} more coins`};
 p.coins-=plate.price;p.ownedNameplates.push(id);p.nameplate=id;return{ok:true};
}
export const RARITIES=deepFreeze(Object.fromEntries(Object.entries(CONFIG.progression.rarities).map(([id,{name,color,...rest}])=>[id,{name,color,hex:parseInt(color.slice(1),16),...rest}])));
const LEVELING=CONFIG.progression.leveling;
export const LEVELS_PER_RANK=LEVELING.levelsPerRank;
const stepExp=level=>REWARDS.knockout.points*Math.round(LEVELING.stepBase+LEVELING.stepGrowth*Math.pow(level-1,LEVELING.stepExponent));
const MAX_LEVEL=CONFIG.progression.ranks.length*LEVELS_PER_RANK,expAtLevel=[0,0];
for(let level=1;level<MAX_LEVEL;level++)expAtLevel[level+1]=expAtLevel[level]+stepExp(level);
export const RANKS=CONFIG.progression.ranks.map((rank,index)=>({...rank,min:expAtLevel[index*LEVELS_PER_RANK+1]}));
export const CHEST_PRICE=CHEST.price;
export const MATCH_REWARDS=REWARDS.match;
export const MATCH_RULES=CONFIG.progression.match;
export const EFFECTS=CONFIG.weapons.statusEffects;
const TITLES=CHEST.forged.titles;
const rollTable=forged=>forged?CHEST.forged.rolls:CHEST.rolls;
const rollMax=(forged,key)=>{const r=rollTable(forged)[key];return key==='damage'?r.min+r.spread-1:r.min+r.spread;};
const maxEffectLevel=forged=>forged?Math.max(...CHEST.forged.effectLevels):Math.max(...Object.values(RARITIES).map(r=>r.effectLevel));
const bounded=(n,min,max)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
export function sanitizeItem(i){
 if(!i||typeof i!=='object')return null;
 const rarity=WEAPONS[i.weapon]?.rarity??(RARITIES[i.rarity]?i.rarity:'common');
 if(i.orb==='charge')return{id:i.id,orb:'charge',rarity:'legendary'};
 if(i.armor&&ARMORS[i.armor]?.file)return{id:i.id,armor:i.armor,rarity};
 if(i.potion&&POTIONS[i.potion])return{id:i.id,potion:i.potion,rarity:'common',count:Math.floor(bounded(i.count,0,INVENTORY.stackLimit)),...(i.id==='starter-healing'?{bound:true}:{})};
 if(i.bow)return{id:i.id,bow:true,rarity,...(i.id==='starter-bow'?{bound:true}:{})};
 if(!WEAPONS[i.weapon])return null;
 const item={id:i.id,weapon:i.weapon,rarity,...(i.id==='starter'?{bound:true}:{})};
 if(i.forged&&i.rarity==='legendary'){item.forged=true;item.title=TITLES.includes(i.title)?i.title:TITLES[0];}
 if(i.rolls)item.rolls={damage:Math.round(bounded(i.rolls.damage,0,rollMax(item.forged,'damage'))),reach:Math.round(bounded(i.rolls.reach,0,rollMax(item.forged,'reach'))*100)/100,speed:Math.round(bounded(i.rolls.speed,0,rollMax(item.forged,'speed'))*100)/100};
 if(Array.isArray(i.effects))item.effects=[...new Map(i.effects.filter(e=>EFFECTS[e?.type]).map(e=>[e.type,{type:e.type,level:Math.round(bounded(e.level,1,maxEffectLevel(item.forged)))}])).values()].slice(0,item.forged?CHEST.forged.effectLevels.length:1);
 return item;
}
export function effectDescription(effect){const n=effect.level,e=EFFECTS[effect.type];return e.kind==='slow'?`${e.baseSlowPercent+n*e.slowPercentPerLevel}% slow for ${e.duration}s`:`${e.baseDamage+n*e.damagePerLevel} damage × ${e.ticks} over ${Math.round(e.interval*e.ticks*100)/100}s`;}
export const CHARACTERS={
 adventurer:{name:'Adventurer',file:'fighter-adventurer.glb'},ember:{name:'Ember',file:'fighter-ember.glb'},knight:{name:'Knight',file:'actor-knight.glb'},punk:{name:'Punk',file:'fighter-punk.glb'},robot:{name:'Robot',file:'avatar-robot.glb'},astronaut:{name:'Astronaut',file:'avatar-astronaut.glb'},pirate:{name:'Pirate',file:'avatar-pirate.glb'},wizard:{name:'Wizard',file:'avatar-wizard.glb'},mask:{name:'Masked fighter',file:'avatar-mask.glb'},king:{name:'King',file:'fighter-king.glb'},skeleton:{name:'Skeleton',file:'avatar-skeleton.glb'},explorer:{name:'Explorer',file:'avatar-adventurer.glb'},tribal:{name:'Tribal fighter',file:'avatar-tribal.glb'},
};
export function cleanName(value){return String(value??'').replace(/[^a-zA-Z0-9_ ]/g,'').trim().slice(0,16)||'Player';}
export function rankFor(points){const exp=Math.max(0,points);let lo=1,hi=MAX_LEVEL;while(lo<hi){const mid=(lo+hi+1)>>1;if(expAtLevel[mid]<=exp)lo=mid;else hi=mid-1;}const level=lo,index=Math.floor((level-1)/LEVELS_PER_RANK),rank=RANKS[index],next=RANKS[index+1]??null,start=expAtLevel[level],end=level<MAX_LEVEL?expAtLevel[level+1]:start,rankEnd=next?next.min:expAtLevel[MAX_LEVEL];return {...rank,index,next,progress:rankEnd>rank.min?Math.max(0,Math.min(1,(exp-rank.min)/(rankEnd-rank.min))):1,level,levelInRank:level-index*LEVELS_PER_RANK,levelProgress:level>=MAX_LEVEL?1:(exp-start)/(end-start),maxLevel:MAX_LEVEL};}
export const CARRY_SLOTS=INVENTORY.carrySlots,HOTBAR_SLOTS=INVENTORY.hotbarSlots,VAULT_INITIAL=STORAGE.initialSlots,VAULT_STEP=STORAGE.stepSlots;
export function itemKind(i){return i?.orb?'orb':i?.weapon?'weapon':i?.armor?'armor':i?.potion?'potion':i?.bow?'bow':null;}
export function itemName(i){return i?.orb?'Charge orb':i?.weapon?weaponStats(i).name:i?.armor?ARMORS[i.armor].name:i?.potion?POTIONS[i.potion].name:i?.bow?'Bow':'Empty';}
export function itemArtKey(i){return i?.orb?'chargeorb':i?.weapon??(i?.armor?'armor-'+i.armor:i?.potion?'potion-'+i.potion:i?.bow?'bow':'');}
export function makeItemId(p,prefix='item'){p.itemSerial=(p.itemSerial??0)+1;return p.itemPrefix+'-'+prefix+'-'+p.itemSerial;}
export function syncInventory(p){
 p.potions=Object.fromEntries(Object.keys(POTIONS).map(id=>[id,0]));p.ownedArmor=['none'];
 for(const i of p.inventory){if(i.potion)p.potions[i.potion]+=i.count;if(i.armor&&!p.ownedArmor.includes(i.armor))p.ownedArmor.push(i.armor);}
 for(const slot of ['armor','helmet']){const item=p.inventory.find(i=>i.id===p[slot+'Item']&&i.armor&&(ARMORS[i.armor].slot==='head'?'helmet':'armor')===slot);p[slot]=item?.armor??'none';if(!item)p[slot+'Item']=null;}
 if(!p.inventory.some(i=>i.id===p.equipped&&i.weapon))p.equipped=p.inventory.find(i=>i.weapon)?.id??'starter';
 // The first nine physical carried slots ARE the hotbar. Object collections
 // are registries only; neither renderer creates a second copy of these slots.
 const arrange=(items,old,capacity)=>{const ids=new Set(items.map(i=>i.id)),used=new Set(),slots=Array.from({length:capacity},(_,n)=>{const id=old?.[n];if(!ids.has(id)||used.has(id))return null;used.add(id);return id;});for(const item of items)if(!used.has(item.id)){const empty=slots.indexOf(null);if(empty>=0){slots[empty]=item.id;used.add(item.id);}}return slots;};
 p.carrySlots=arrange(p.inventory,p.carrySlots??p.hotbar,CARRY_SLOTS);
 p.vaultSlots=arrange(p.vault,p.vaultSlots,p.vaultCapacity);
 p.hotbar=p.carrySlots.slice(0,HOTBAR_SLOTS);
 p.selectedHotbar=Math.floor(bounded(p.selectedHotbar??0,0,HOTBAR_SLOTS-1));
}
export function refillStarterPotions(p,count=STARTER.potionCount){const item=p.inventory.find(i=>i.id==='starter-healing');if(item)item.count=Math.max(item.count,Math.min(STARTER.potionCount,count));syncInventory(p);}
export function makeProfile(saved={},legacy={}){
 const p={version:4,name:cleanName(saved.name??'Player'),character:CHARACTERS[saved.character]?saved.character:'adventurer',coins:Math.max(0,Math.floor(saved.coins??(legacy.kills??0)*25)),rating:Math.max(0,Math.floor(saved.rating??0)),kills:Math.max(0,Math.floor(saved.kills??legacy.kills??0)),deaths:Math.max(0,Math.floor(saved.deaths??0)),best:Math.max(0,Math.floor(saved.best??legacy.best??0)),inventory:[],vault:[],equipped:saved.equipped??'starter',armorItem:saved.armorItem??null,helmetItem:saved.helmetItem??null,chests:Math.max(0,Math.floor(saved.chests??0)),itemPrefix:typeof saved.itemPrefix==='string'?saved.itemPrefix:Date.now().toString(36)+Math.random().toString(36).slice(2,8),itemSerial:Math.max(0,Math.floor(saved.itemSerial??0)),vaultCapacity:Math.max(VAULT_INITIAL,Math.ceil((Number.isFinite(saved.vaultCapacity)?saved.vaultCapacity:VAULT_INITIAL)/VAULT_STEP)*VAULT_STEP),carrySlots:saved.version>=4&&Array.isArray(saved.carrySlots)?saved.carrySlots:null,vaultSlots:saved.version>=4&&Array.isArray(saved.vaultSlots)?saved.vaultSlots:null,hotbar:saved.hotbar??[],selectedHotbar:saved.selectedHotbar??0};
 const seen=new Set();const readItems=items=>(Array.isArray(items)?items:[]).filter(i=>i&&typeof i.id==='string').map(sanitizeItem).filter(i=>{if(!i||seen.has(i.id))return false;seen.add(i.id);return true;});
 p.inventory=readItems(saved.inventory);p.vault=readItems(saved.vault).filter(i=>!i.bound);
 for(const item of [{id:'starter',weapon:STARTER.weapon,rarity:'common',bound:true},{id:'starter-bow',bow:true,rarity:'common',bound:true},{id:'starter-healing',potion:STARTER.potion,rarity:'common',count:STARTER.potionCount,bound:true}])if(!p.inventory.some(i=>i.id===item.id))p.inventory.push(item);
 if(!(saved.version>=3)){
  for(const id of new Set(saved.ownedArmor??[]))if(ARMORS[id]?.file&&!p.inventory.some(i=>i.armor===id))p.inventory.push({id:makeItemId(p,'armor'),armor:id,rarity:'common'});
  p.armorItem=p.inventory.find(i=>i.armor===saved.armor)?.id??null;p.helmetItem=p.inventory.find(i=>i.armor===saved.helmet)?.id??null;
  for(const id of Object.keys(POTIONS)){const starter=id===STARTER.potion,count=Math.floor(bounded(saved.potions?.[id]??(starter?STARTER.potionCount:0),0,INVENTORY.stackLimit)),kept=starter?Math.min(STARTER.potionCount,count):0;if(starter)p.inventory.find(i=>i.id==='starter-healing').count=kept;const extra=count-kept;if(extra)p.inventory.push({id:makeItemId(p,'potion'),potion:id,rarity:'common',count:extra});}
 }
 // Migrate existing collections without deleting anything. Equipped gear and the
 // starter kit stay carried; excess physical copies move to expanded safe storage.
 const priority=new Set(['starter','starter-bow','starter-healing',p.equipped,p.armorItem,p.helmetItem]);
 if(p.inventory.length>CARRY_SLOTS){const ordered=[...p.inventory.filter(i=>priority.has(i.id)),...p.inventory.filter(i=>!priority.has(i.id))];p.inventory=ordered.slice(0,CARRY_SLOTS);p.vault.push(...ordered.slice(CARRY_SLOTS));}
 p.vaultCapacity=Math.max(p.vaultCapacity,Math.ceil(p.vault.length/VAULT_STEP)*VAULT_STEP);
 if(!Array.isArray(saved.hotbar))p.hotbar=[p.equipped,'starter-bow','starter-healing',...p.inventory.filter(i=>!priority.has(i.id)).map(i=>i.id)].slice(0,HOTBAR_SLOTS);
 p.selectedPotion=POTIONS[saved.selectedPotion]?saved.selectedPotion:'healing';
 p.ownedCosmetics=[...new Set(['none',...(Array.isArray(saved.ownedCosmetics)?saved.ownedCosmetics.filter(id=>Object.hasOwn(COSMETICS,id)):[])])];
 p.ownedNameplates=[...new Set(['none',...(Array.isArray(saved.ownedNameplates)?saved.ownedNameplates.filter(id=>Object.hasOwn(NAMEPLATES,id)):[])])];
 p.nameplate=p.ownedNameplates.includes(saved.nameplate)?saved.nameplate:'none';p.cosmetic=p.ownedCosmetics.includes(saved.cosmetic)?saved.cosmetic:'none';
 p.duels={};for(const key of ['played','wins','losses'])p.duels[key]=Number.isFinite(saved.duels?.[key])?Math.max(0,Math.floor(saved.duels[key])):0;
 syncInventory(p);return p;
}
export function equippedItem(p){return p.inventory.find(i=>i.id===p.equipped&&i.weapon)??p.inventory.find(i=>i.weapon);}
export function moveInventoryItem(p,id,fromVault,toVault,index){
 syncInventory(p);const source=fromVault?p.vault:p.inventory,target=toVault?p.vault:p.inventory,fromSlots=fromVault?p.vaultSlots:p.carrySlots,toSlots=toVault?p.vaultSlots:p.carrySlots;
 const item=source.find(i=>i.id===id),from=fromSlots.indexOf(id);
 if(!item||from<0||!Number.isInteger(index)||index<0||index>=toSlots.length)return{ok:false,error:'Choose an inventory slot'};
 const displaced=target.find(i=>i.id===toSlots[index]);
 if(fromVault!==toVault&&(item.bound||displaced?.bound))return{ok:false,error:'Starter kit stays with you'};
 if(fromVault===toVault){[fromSlots[from],toSlots[index]]=[toSlots[index],fromSlots[from]];}
 else{
  const sourceIndex=source.indexOf(item),targetIndex=displaced?target.indexOf(displaced):-1;
  if(displaced){source[sourceIndex]=displaced;target[targetIndex]=item;}else{source.splice(sourceIndex,1);target.push(item);}
  fromSlots[from]=displaced?.id??null;toSlots[index]=id;
 }
 syncInventory(p);return{ok:true,item};
}
export function bindHotbar(p,index,id){
 syncInventory(p);if(!Number.isInteger(index)||index<0||index>=HOTBAR_SLOTS)return{ok:false,error:'Choose a hotbar slot'};
 if(!id){const old=p.hotbar[index];if(!old)return{ok:true};const empty=p.carrySlots.findIndex((v,n)=>n>=HOTBAR_SLOTS&&!v);return empty<0?{ok:false,error:'Backpack full · move or drop an item'}:moveInventoryItem(p,old,false,false,empty);}
 return moveInventoryItem(p,id,false,false,index);
}
export function equipInventoryItem(p,id){
 const item=p.inventory.find(i=>i.id===id);if(!item)return{ok:false,error:'Item is not carried'};
 if(item.weapon)p.equipped=id;
 if(item.armor){const slot=ARMORS[item.armor].slot==='head'?'helmet':'armor';p[slot+'Item']=p[slot+'Item']===id?null:id;}
 if(item.potion)p.selectedPotion=item.potion;
 if(item.armor){syncInventory(p);return{ok:true,item};}
 let slot=p.hotbar.indexOf(id);if(slot<0){slot=p.hotbar.indexOf(null);if(slot<0)slot=p.selectedHotbar;bindHotbar(p,slot,id);}p.selectedHotbar=slot;syncInventory(p);return{ok:true,item};
}
export function addInventoryItem(p,item){
 if(p.inventory.length>=CARRY_SLOTS)return{ok:false,error:'Inventory full · store or sell an item'};
 const clean=sanitizeItem(item);if(!clean||typeof clean.id!=='string')return{ok:false,error:'Invalid item'};
 if([...p.inventory,...p.vault].some(i=>i.id===clean.id))return{ok:false,error:'This copy is already owned'};
 p.inventory.push(clean);syncInventory(p);return{ok:true,item:clean};
}
export function transferItem(p,id,toVault){
 syncInventory(p);const slots=toVault?p.vaultSlots:p.carrySlots,index=slots.indexOf(null);
 if(index<0)return{ok:false,error:toVault?'Storage full · buy more space':'Inventory full · store or sell an item'};
 return moveInventoryItem(p,id,!toVault,toVault,index);
}
export function storagePrice(p){return STORAGE.basePrice*(1+Math.max(0,(p.vaultCapacity-VAULT_INITIAL)/VAULT_STEP));}
export function expandStorage(p){const cost=storagePrice(p);if(p.coins<cost)return{ok:false,error:`Need ${cost-p.coins} more coins`};p.coins-=cost;p.vaultCapacity+=VAULT_STEP;syncInventory(p);return{ok:true,cost};}
export function takeDeathItems(p){
 const lost=p.inventory.filter(i=>!i.bound),dropped=lost.filter(i=>i.rarity!=='common');p.inventory=p.inventory.filter(i=>i.bound);p.equipped='starter';p.armorItem=p.helmetItem=null;syncInventory(p);p.selectedHotbar=Math.max(0,p.hotbar.indexOf('starter'));return{lost,dropped};
}
export function weaponStats(item){const clean=sanitizeItem(item),base=WEAPONS[clean.weapon],rarity=RARITIES[clean.rarity];return {...base,name:clean.forged?clean.title+' '+base.name.toLowerCase():base.name,damage:base.absoluteDamage?base.damage:base.damage+rarity.damage+(clean.rolls?.damage??0),reach:base.reach+(clean.rolls?.reach??0)*(base.kind==='staff'?CHEST.staffReachMultiplier:1),speed:base.speed+(clean.rolls?.speed??0),effects:clean.effects??[],forged:!!clean.forged,rarity:clean.rarity,rarityColor:rarity.color,weapon:clean.weapon};}
export function purchaseWeapon(p,id){const weapon=WEAPONS[id];if(weapon?.dungeonOnly)return{ok:false,error:weapon.name+' is found only in the Ashen Crypt'};if(MERCHANT.weapons.includes(id))return{ok:false,error:`${weapon.name} is sold only by ${MERCHANT.name}`};if(!weapon||id===STARTER.weapon)return{ok:false,error:`${WEAPONS[STARTER.weapon].name} is in your starter kit`};if(p.coins<weapon.price)return{ok:false,error:`Need ${weapon.price-p.coins} more coins`};const result=addInventoryItem(p,{id:makeItemId(p,'weapon'),weapon:id,rarity:weapon.rarity??'common'});if(result.ok)p.coins-=weapon.price;return result;}
export function purchaseArmor(p,id){const armor=ARMORS[id];if(armor?.dungeonOnly)return{ok:false,error:armor.name+' is found only in the Ashen Crypt'};if(!armor?.file)return{ok:false,error:'Choose a chestplate or helmet'};if(p.coins<armor.price)return{ok:false,error:`Need ${armor.price-p.coins} more coins`};const result=addInventoryItem(p,{id:makeItemId(p,'armor'),armor:id,rarity:'common'});if(result.ok)p.coins-=armor.price;return result;}
export function purchasePotion(p,id){const potion=POTIONS[id];if(!potion)return{ok:false,error:'Unknown potion'};if(p.coins<potion.price)return{ok:false,error:`Need ${potion.price-p.coins} more coins`};const stack=p.inventory.find(i=>i.potion===id&&!i.bound&&i.count<INVENTORY.stackLimit);if(stack){stack.count++;p.coins-=potion.price;syncInventory(p);return{ok:true,item:stack};}const result=addInventoryItem(p,{id:makeItemId(p,'potion'),potion:id,rarity:'common',count:1});if(result.ok)p.coins-=potion.price;return result;}
export function consumePotion(p,id,preferred=null){const item=p.inventory.find(i=>i.id===preferred&&i.potion===id&&i.count>0)??p.inventory.find(i=>i.potion===id&&i.count>0);if(!item)return false;item.count--;if(!item.count&&!item.bound)p.inventory.splice(p.inventory.indexOf(item),1);syncInventory(p);return true;}
export function openChest(p,random=Math.random){
 if(p.inventory.length>=CARRY_SLOTS)return{ok:false,error:'Inventory full · store or sell an item before opening'};
 if(p.coins<CHEST_PRICE)return{ok:false,error:`Need ${CHEST_PRICE-p.coins} more coins`};
 const rng=()=>{const n=random();return Number.isFinite(n)?bounded(n,0,.999999):.5;};p.coins-=CHEST_PRICE;
 let roll=rng()*100,rarity='common';for(const [key,r]of Object.entries(RARITIES)){if(!r.weight)continue;roll-=r.weight;if(roll<0){rarity=key;break;}}
 const weapons=CHEST.weapons,weapon=weapons[Math.floor(rng()*weapons.length)];p.chests++;
 const item={id:makeItemId(p,'drop-'+Math.floor(rng()*1e8).toString(36)),weapon,rarity},forged=rarity==='legendary'&&rng()<CHEST.forged.chance;
 const rollStats=t=>({damage:t.damage.min+Math.floor(rng()*t.damage.spread),reach:t.reach.min+rng()*t.reach.spread,speed:t.speed.min+rng()*t.speed.spread});
 if(forged){item.forged=true;item.title=TITLES[Math.floor(rng()*TITLES.length)];item.rolls=rollStats(CHEST.forged.rolls);}
 else if(rarity!=='common')item.rolls=rollStats(CHEST.rolls);
 if(forged||rng()<RARITIES[rarity].effectChance){
  const types=Object.keys(EFFECTS);item.effects=(forged?CHEST.forged.effectLevels:[RARITIES[rarity].effectLevel]).map(level=>({type:types.splice(Math.floor(rng()*types.length),1)[0],level}));
 }
 return addInventoryItem(p,sanitizeItem(item));
}
export function salvageValue(item){if(item.bound||item.orb)return 0;const base=item.weapon?WEAPONS[item.weapon].price:item.armor?ARMORS[item.armor].price:item.potion?POTIONS[item.potion].price:0;return item.potion?Math.floor(base*SALVAGE.potionFactor)*item.count:RARITIES[item.rarity].salvage+Math.floor(base*SALVAGE.priceFactor);}
export function sellItem(p,id,stored=false){const source=stored?p.vault:p.inventory,index=source.findIndex(i=>i.id===id);if(index<0)return{ok:false,error:'Item not found'};const item=source[index];if(item.bound)return{ok:false,error:'Starter kit cannot be sold'};const coins=salvageValue(item);source.splice(index,1);p.coins+=coins;syncInventory(p);return{ok:true,coins};}
export function rewardKO(p,opponentRating,streak){const before=rankFor(p.rating);const r=REWARDS.knockout,coins=r.coins+Math.min(r.maxStreakCoins,Math.max(0,streak-1)*r.streakCoins),points=Math.max(r.minPoints,Math.min(r.maxPoints,Math.round(r.points+(opponentRating-p.rating)/r.ratingDivisor)));p.coins+=coins;p.rating+=points;p.kills++;p.best=Math.max(p.best,streak);const rank=rankFor(p.rating);return{coins,points,rankUp:rank.index>before.index,rank};}
export function recordDeath(p,opponentRating=0){const r=REWARDS.death,points=Math.max(r.minPoints,Math.min(r.maxPoints,Math.round(r.points+(p.rating-opponentRating)/r.ratingDivisor)));const lost=Math.min(p.rating,points);p.rating-=lost;p.deaths++;return lost;}
