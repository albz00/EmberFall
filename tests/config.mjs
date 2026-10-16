import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,cp,rm,access,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CONFIG,CONFIG_VERSION} from '../dist/shared/config.js';
import {parseConfig,CONFIG_FILES,PERSISTED_IDS} from '../dist/shared/config-schema.js';
import {makeProfile,sanitizeItem,WEAPONS,ARMORS,POTIONS} from '../dist/progression.js';

const dist=new URL('../dist/',import.meta.url);
const raw={};for(const name of CONFIG_FILES)raw[name]=JSON.parse(await readFile(new URL(`config/${name}.json`,dist),'utf8'));
const copy=()=>structuredClone(raw);
const issuesFor=mutate=>{const c=copy();mutate(c);try{parseConfig(c);}catch(error){assert(error.name==='ConfigError'&&Array.isArray(error.issues),error);return error.issues;}assert.fail('invalid config was accepted');};
const expectIssue=(mutate,...fragments)=>{const issues=issuesFor(mutate);for(const fragment of fragments)assert(issues.some(i=>i.includes(fragment)),`expected an issue mentioning ${JSON.stringify(fragment)}, got:\n${issues.join('\n')}`);return issues;};

// The bundled content loads, is frozen, and has a stable fingerprint for client/server matching.
assert.match(CONFIG_VERSION,/^1-[0-9a-f]{8}$/);
assert(Object.isFrozen(CONFIG.combat.kits.vanguard)&&Object.isFrozen(CONFIG.progression.ranks));
assert.throws(()=>{CONFIG.weapons.weapons.dagger.damage=99;},TypeError);
assert.equal(typeof CONFIG.weapons.weapons.frost.color,'number','#rrggbb colors become numbers for rendering');

// Load-time validation names the file and field, and reports every problem at once.
expectIssue(c=>{c.weapons.weapons.dagger.damage='13';},'weapons.json → weapons.dagger.damage: must be a finite number');
expectIssue(c=>{c.armor.armor.iron.price=-5;},'armor.json → armor.iron.price: must be at least 0 coins');
expectIssue(c=>{c.combat.melee.hurtWindow=45;},'combat.json → melee.hurtWindow: must be at most 10 s');
expectIssue(c=>{c.weapons.weapons.mace.reech=3;},'weapons.mace: unknown field "reech"');
expectIssue(c=>{c.progression.schemaVersion=2;},'progression.json → schemaVersion: must be 1, got 2');
expectIssue(c=>{delete c.cosmetics;},'cosmetics.json → (root): is required');
expectIssue(c=>{c.progression.chest.weapons.push('spear');},'chest.weapons[7]: "spear" is not a defined weapons id');
expectIssue(c=>{c.progression.starterKit.potion='elixir';},'starterKit.potion: "elixir" is not a defined potions id');
expectIssue(c=>{delete c.weapons.weapons.mace;},'weapons: "mace" is stored in saved profiles and must not be removed');
expectIssue(c=>{c.progression.chest.forged.titles.shift();},'"Ruinbound" is stored in saved profiles');
expectIssue(c=>{c.progression.rarities.common.weight=50;},'rarity weights must total 100%, got 98');
expectIssue(c=>{c.progression.ranks[3].min=200;},'ranks[3].min must be greater than ranks[2].min');
expectIssue(c=>{delete c.weapons.weapons.venom.spell;},'weapons.venom.spell is required for staffs');
expectIssue(c=>{c.combat.kits.rogue.tint='teal';},'kits.rogue.tint: must be a #rrggbb color');
expectIssue(c=>{c.cosmetics.cosmetics['Gold Aura']={name:'Gold',price:1,colors:['#ffffff','#000000'],description:'x'};},'id "Gold Aura" must be lowercase');
expectIssue(c=>{c.combat.heavy.windup=1.5;},'heavy.windup must be shorter than heavy.full');
expectIssue(c=>{c.weapons.statusEffects.frost.slowPercentPerLevel=40;},'statusEffects.frost would stop movement entirely');
expectIssue(c=>{c.progression.chest.weapons.push('god');},'must not include absolute-damage weapon "god"');
expectIssue(c=>{c.progression.chest.weapons.push('cinderfang');},'must not include dungeon-only weapon "cinderfang"');
expectIssue(c=>{c.events.types=c.events.types.slice(0,1);},'events.json → types: must have at least 2 entries');
expectIssue(c=>{c.events.types[2].id='cavein';},'types[2]: duplicates "cavein"');
expectIssue(c=>{delete c.events.types[1].damage;},'types[1].damage: is required');
expectIssue(c=>{c.events.types[0].kind='flood';},'types[0]: kind must be one of "hazard", "supply"');
expectIssue(c=>{c.events.killstreaks.tiers=[3,10,5];},'killstreaks.tiers[2] must be greater than killstreaks.tiers[1]');
expectIssue(c=>{c.bots.generated.cps.min=13;},'generated.cps.min must not exceed generated.cps.max');
expectIssue(c=>{c.bots.extraNames.push('Vex');},'extraNames repeats profile name "Vex"');
expectIssue(c=>{c.bots.profiles[4].cps=0;},'bots.json → profiles[4].cps: must be greater than 0 clicks/s');
assert(expectIssue(c=>{c.weapons.weapons.dagger.price=1.5;c.consumables.potions.healing.amount=0;}).length>=2,'multiple problems are reported together');

// Every model referenced by content exists.
for(const entry of[...Object.values(WEAPONS),...Object.values(ARMORS),...Object.values(POTIONS)])if(entry.file)await access(new URL('assets/'+entry.file,dist));

// A save holding every persisted id loads without stripping anything.
const everything=makeProfile({version:4,itemPrefix:'cfg',coins:10,ownedCosmetics:PERSISTED_IDS.cosmetics,ownedNameplates:PERSISTED_IDS.nameplates,
 inventory:PERSISTED_IDS.weapons.slice(0,8).map((weapon,n)=>({id:'w'+n,weapon,rarity:PERSISTED_IDS.rarities[n%4],effects:[{type:PERSISTED_IDS.statusEffects[n%3],level:1}]})),
 vault:[...PERSISTED_IDS.armor.filter(id=>id!=='none').map((armor,n)=>({id:'a'+n,armor,rarity:'common'})),...PERSISTED_IDS.potions.map((potion,n)=>({id:'p'+n,potion,count:2})),{id:'g',weapon:'god'}]});
assert.deepEqual([...everything.ownedCosmetics].sort(),[...PERSISTED_IDS.cosmetics].sort());
assert.deepEqual([...everything.ownedNameplates].sort(),[...PERSISTED_IDS.nameplates].sort());
assert.equal(everything.inventory.filter(i=>i.weapon&&!i.bound).length,8);assert.equal(everything.vault.length,PERSISTED_IDS.armor.length-1+PERSISTED_IDS.potions.length+1);
assert(everything.inventory.every(i=>!i.effects||i.effects.length===1));
for(const title of PERSISTED_IDS.titles)assert.equal(sanitizeItem({id:'f',weapon:'mace',rarity:'legendary',forged:true,title}).title,title);

// One source of truth: edited JSON changes behavior in every migrated module.
const scratch=await mkdtemp(join(tmpdir(),'emberfall-config-'));
try{
 for(const file of['combat.js','progression.js','charged-melee.js','arena-events.js'])await cp(new URL(file,dist),join(scratch,file));
 await cp(new URL('shared/',dist),join(scratch,'shared'),{recursive:true});await cp(new URL('maps/',dist),join(scratch,'maps'),{recursive:true});await mkdir(join(scratch,'config'));
 const edited=copy();
 Object.assign(edited.combat.melee,{hurtWindow:.7,criticalMultiplier:2,blockMultiplier:.5});edited.combat.kits.vanguard.health=333;
 Object.assign(edited.combat.bow,{baseDamage:10,chargeDamage:20});edited.combat.heavy.damage={base:1,perPower:2};edited.combat.movement.gearSpeed=1;
 edited.progression.chest.price=99;edited.progression.storage.basePrice=100;edited.progression.inventory.stackLimit=5;edited.progression.starterKit.potionCount=2;
 edited.progression.rewards.knockout.coins=40;
 Object.assign(edited.bots.clicks,{jitterMin:1,jitterSpread:0});edited.bots.generated.cps={min:3,max:3,variation:0};edited.bots.targeting={streakCap:2,streakWeight:1,currentBias:.5};
 Object.assign(edited.events.schedule,{firstDelay:5,warning:2,idleMin:10,idleSpread:0});edited.events.killstreaks.tiers=[2,4];edited.weapons.statusEffects.fire.baseDamage=10;edited.weapons.weapons.dagger.damage=20;
 for(const name of CONFIG_FILES)await writeFile(join(scratch,'config',name+'.json'),JSON.stringify(edited[name]));
 const load=file=>import(pathToFileURL(join(scratch,file)).href);
 const [C,P,H,E]=await Promise.all(['combat.js','progression.js','charged-melee.js','arena-events.js'].map(load));
 assert.equal(C.KITS.vanguard.health,333);
 assert.equal(C.damageReady({lastDirectHit:0},.6),false,'hurt window follows config');assert.equal(C.damageReady({lastDirectHit:0},.7),true);
 assert.equal(C.attackDamage(10,C.KITS.vanguard,true),20);assert.equal(C.attackDamage(10,C.KITS.vanguard,false,true),5);
 assert.equal(C.movementSpeed(C.KITS.vanguard,1),C.KITS.vanguard.speed+1);
 assert.equal(E.arrowDamage(1),30);assert.equal(H.chargedStats({damage:10,knockback:1},1).damage,30);
 assert.equal(P.effectDescription({type:'fire',level:1}),'12 damage × 4 over 3s');
 const p=P.makeProfile({itemPrefix:'cfg',coins:1000});assert.equal(p.inventory.find(i=>i.id==='starter-healing').count,2,'starter stock follows config');
 assert(P.openChest(p,()=>.1).ok);assert.equal(p.coins,901,'chest price follows config');assert.equal(P.storagePrice(p),100);
 assert.equal(P.weaponStats({id:'d',weapon:'dagger',rarity:'common'}).damage,20);
 assert.equal(C.clickInterval({cps:4},()=>.7),.25,'click jitter follows config');assert.equal(C.botProfile(C.BOT_PROFILES.length+3).cps,3,'generated bot skill follows config');
 assert.deepEqual([1,2,3,4,9].map(E.streakTier),[0,1,1,2,2]);assert.equal(E.targetPriority(12,5,true),2);
 const ev=E.createEventState(0);assert.equal(ev.at,5);assert.equal(E.advanceEvent(ev,5,()=>0),'warning');assert.equal(ev.at,7);E.advanceEvent(ev,7,()=>0);assert.equal(E.advanceEvent(ev,ev.at,()=>0),'end');assert.equal(ev.at,7+ev.type.duration+10);
 assert.equal(P.sanitizeItem({id:'s',potion:'haste',count:50}).count,5);assert.equal(P.rewardKO(p,0,1).coins,40);
}finally{await rm(scratch,{recursive:true,force:true});}

// Cache-busting: every reference to a module or content file uses the same version.
const versions=new Map();
const scan=async(dir,prefix='')=>{for(const entry of await readdir(new URL(dir,dist),{withFileTypes:true})){if(entry.name==='vendor'||entry.name==='assets')continue;if(entry.isDirectory()){await scan(dir+entry.name+'/',prefix+entry.name+'/');continue;}if(!/\.(js|html)$/.test(entry.name))continue;
 const text=await readFile(new URL(dir+entry.name,dist),'utf8');
 for(const m of text.matchAll(/from\s*'(\.{1,2}\/[^']+)'/g))assert(m[1].includes('vendor/')||/\?v=\d+$/.test(m[1]),`${prefix+entry.name} imports ${m[1]} without a cache version`);
 for(const m of text.matchAll(/['"]\.{1,2}\/([\w./-]+\.(?:js|json|css))\?v=(\d+)['"]/g)){const target=new URL(m[1],new URL(dir,dist)).pathname;(versions.get(target)??versions.set(target,new Set()).get(target)).add(m[2]);}}};
await scan('');
for(const [file,set]of versions)assert.equal(set.size,1,`${file} is referenced with different versions: ${[...set]}`);
console.log(JSON.stringify({result:'passed',checks:'bundled config, validation messages, assets, persisted ids, config-driven behavior, cache versions',version:CONFIG_VERSION}));
