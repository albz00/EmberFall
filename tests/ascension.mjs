import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {WEAPONS,COSMETICS,makeProfile,purchaseWeapon,purchaseCosmetic,weaponStats,equipInventoryItem,transferItem,takeDeathItems,addInventoryItem,sellItem} from '../dist/progression.js';
import {updateCosmetic,disposeCosmetic} from '../dist/cosmetics.js';

assert.equal(WEAPONS.god.price,1000000);assert.equal(COSMETICS.ascension.price,1000000);
const p=makeProfile({coins:999999,rating:1000000});assert(!purchaseWeapon(p,'god').ok);assert(!purchaseCosmetic(p,'ascension').ok);assert.equal(p.coins,999999);
p.coins=4000000;const first=purchaseWeapon(p,'god'),second=purchaseWeapon(p,'god');assert(first.ok&&second.ok);assert.notEqual(first.item.id,second.item.id);assert.equal(p.coins,2000000);assert.equal(first.item.rarity,'legendary');assert.equal(p.equipped,'starter');
for(const rarity of ['common','rare','epic','legendary'])assert.equal(weaponStats({weapon:'god',rarity,rolls:{damage:7}}).damage,9999);
assert(purchaseCosmetic(p,'ascension').ok);assert.equal(p.coins,1000000);assert(purchaseCosmetic(p,'ascension').ok);assert.equal(p.coins,1000000,'owned aura re-equips without charging twice');
assert(equipInventoryItem(p,first.item.id).ok);assert(transferItem(p,second.item.id,true).ok);
const saved=makeProfile(JSON.parse(JSON.stringify(p)));assert.equal(saved.cosmetic,'ascension');assert.equal(weaponStats(saved.inventory.find(i=>i.id===first.item.id)).damage,9999);
const death=takeDeathItems(saved);assert(death.dropped.some(i=>i.id===first.item.id));assert(saved.vault.some(i=>i.id===second.item.id));assert(saved.ownedCosmetics.includes('ascension'));
assert(addInventoryItem(saved,death.dropped[0]).ok);assert(!addInventoryItem(saved,death.dropped[0]).ok);assert(sellItem(saved,first.item.id).ok);assert(!sellItem(saved,first.item.id).ok);
while(p.inventory.length<20)assert(purchaseWeapon(p,'dagger').ok);p.coins=1000000;assert(!purchaseWeapon(p,'god').ok);assert.equal(p.coins,1000000,'full inventory cannot charge for a God Sword');

const actor={root:new THREE.Group(),alive:true};updateCosmetic(actor,'ascension',0);const group=actor.cosmetic,count=group.children.length;
assert(group.children.filter(o=>o.name==='sky-column').some(o=>o.scale.y>=44));assert(!group.getObjectByName('ascension-flames'));assert(!group.getObjectByName('ascension-cores'));assert.equal(group.children.filter(o=>o.name==='sky-column').length,2,'only the softer outer columns remain');
for(let i=0;i<300;i++)updateCosmetic(actor,'ascension',i/60);
assert.equal(actor.cosmetic,group);assert.equal(group.children.length,count,'aura remains a bounded pool');let instances=0;
group.traverse(o=>{if(o.isInstancedMesh){instances+=o.count;for(const n of o.instanceMatrix.array)assert(Number.isFinite(n));}if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});assert(instances<=340);assert(count<20);
actor.preview=true;updateCosmetic(actor,'ascension',6);assert(group.children.filter(o=>o.name==='sky-column').every(o=>!o.visible),'lobby preview does not render a screen-filling column');assert(!group.getObjectByName('ascension-wind').visible);
actor.alive=false;updateCosmetic(actor,'ascension',7);assert(!group.visible);disposeCosmetic(actor);assert.equal(actor.root.children.length,0);assert(!actor.cosmetic);
console.log(JSON.stringify({millionCoinItems:'passed',separateSwordCopies:true,exactDamage:9999,legendaryDeathDrop:true,protectedStorage:true,fullInventoryNoCharge:true,auraOwnershipPersists:true,boundedInstances:instances,finiteVisuals:true}));
