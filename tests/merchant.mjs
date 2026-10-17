import assert from 'node:assert/strict';
import {MERCHANT,SHOP_WEAPONS,WEAPONS,RARITIES,makeProfile,purchaseWeapon,openChest,takeDeathItems,weaponStats} from '../dist/progression.js';
import {merchantStock,merchantCycle,buyExotic,sanitizeMerchantState,rollProc} from '../dist/merchant.js';
import {choosePurchase} from '../dist/bot-strategy.js';

const cycleMs=MERCHANT.restock*1000,start=merchantCycle(Date.UTC(2026,9,12))*cycleMs;

// Stock comes from the cycle: same cycle, same offer; each copy sells out on its own timer.
const stock=merchantStock({},start+1000);
assert.equal(stock.items.length,MERCHANT.offered);
assert.equal(new Set(stock.items.map(i=>i.weapon)).size,MERCHANT.offered,'one copy of each offered weapon');
assert(stock.items.every(i=>MERCHANT.weapons.includes(i.weapon)&&i.price===WEAPONS[i.weapon].price&&i.price>=10000));
assert.deepEqual(merchantStock({},start+2000).items.map(i=>i.weapon),stock.items.map(i=>i.weapon),'the offer holds for the whole cycle');
assert.equal(stock.restockAt,start+cycleMs);
for(const item of stock.items){assert(item.soldOutAt>=start+MERCHANT.sellOut.min*1000&&item.soldOutAt<=start+(MERCHANT.sellOut.min+MERCHANT.sellOut.spread)*1000);assert.equal(merchantStock({},item.soldOutAt).items.find(i=>i.weapon===item.weapon).status,'sold');}
assert(merchantStock({},start+cycleMs-1).items.every(i=>i.status==='sold'),'everything sells out before the next restock');
const offers=new Set();for(let n=0;n<40;n++)for(const i of merchantStock({},start+n*cycleMs+1000).items)offers.add(i.weapon);
assert.equal(offers.size,MERCHANT.weapons.length,'every exotic rotates into stock');

// Buying takes coins, gives one physical exotic copy, and marks it bought for this cycle only.
const state=sanitizeMerchantState(null),rich=makeProfile({coins:100000,rating:1000000}),pick=stock.items[0].weapon;
assert.equal(buyExotic(makeProfile({coins:9999}),sanitizeMerchantState(null),pick,start+1000).ok,false);
const bought=buyExotic(rich,state,pick,start+1000);
assert(bought.ok);assert.equal(bought.item.rarity,'exotic');assert.equal(rich.coins,100000-WEAPONS[pick].price);
assert.equal(merchantStock(state,start+1000).items[0].status,'bought');
assert.match(buyExotic(rich,state,pick,start+1500).error,/sold out/);
assert.equal(merchantStock(state,start+cycleMs+1000).items.every(i=>i.status!=='bought'),true,'a restock clears the purchase record');
const missing=MERCHANT.weapons.find(id=>!stock.items.some(i=>i.weapon===id));assert.equal(buyExotic(rich,state,missing,start+1000).ok,false);
assert.deepEqual(sanitizeMerchantState({cycle:4,bought:['thunderclap','god',7]}),{cycle:4,bought:['thunderclap']});

// Exotics come only from the merchant, never from the shop, chests or bot shopping.
for(const id of MERCHANT.weapons){assert(!SHOP_WEAPONS.includes(id));assert.equal(purchaseWeapon(rich,id).ok,false);assert(WEAPONS[id].proc);}
assert.equal(RARITIES.exotic.weight,0);
let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
for(let n=0;n<400;n++){const p=makeProfile({coins:1000});const r=openChest(p,random);assert(r.ok);assert.notEqual(r.item.rarity,'exotic');assert(!MERCHANT.weapons.includes(r.item.weapon));}
const botAccount=makeProfile({coins:1e6});for(let n=0;n<20;n++){const choice=choosePurchase(botAccount,'duelist',.9);if(choice?.kind==='weapon')assert(!MERCHANT.weapons.includes(choice.id));}

// Exotics are physical gear: they drop on death like other rare items.
const dropped=takeDeathItems(rich).dropped;assert(dropped.some(i=>i.weapon===pick&&i.rarity==='exotic'));

// Effects roll per hit at their configured chance.
const stats=weaponStats({weapon:'thunderclap',rarity:'exotic'});
assert.equal(stats.proc.kind,'explosion');assert.equal(stats.proc.chance,.05);
assert.equal(rollProc(stats,()=>.049),stats.proc);assert.equal(rollProc(stats,()=>.05),null);
assert.equal(rollProc(weaponStats({weapon:'gemblade',rarity:'legendary'}),()=>0),null);
console.log('merchant ok');
