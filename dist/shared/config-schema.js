// Emberfall content schema: field types, units, limits and cross-file rules for
// dist/config/*.json. Shared by the browser, tests and a future match server.
import {ConfigError,number,integer,string,boolean,oneOf,hexColor,cssColor,asset,literal,optional,nullable,array,object,record,variant,ref,parse,resolveRefs} from './schema.js?v=26';

export const SCHEMA_VERSION=1;
export const CONFIG_FILES=['combat','weapons','armor','consumables','cosmetics','progression','bots','events'];

// Saved profiles, chest storage and settings store these ids. Renaming display
// text is safe; removing an id would silently strip owned items from saves.
export const PERSISTED_IDS={
 kits:['vanguard','rogue','sentinel'],
 weapons:['classic','dagger','broadsword','mace','gemblade','frost','venom','arcane','god','riftfang','gilded-oath','thunderclap','voidsplitter','eclipse-edge','cinderfang','warden-cleaver','hollow-scepter'],
 armor:['none','iron','gold','leather','metal','helmet','cryptguard'],
 potions:['healing','haste','guard'],
 cosmetics:['none','ember','glacier','hex','bloodmoon','starfall','prism','inferno','storm','soulfire','hellfire','tempest','eclipse','pressure','ascension'],
 nameplates:['none','ember','volt','venom','aurora','royal','prism'],
 rarities:['common','rare','epic','legendary','exotic'],
 statusEffects:['bleed','frost','fire'],
 titles:['Ruinbound','Winterfang','Bloodmoon','Hellforged','Starbreaker','Ashreaver'],
};

const seconds=(o={})=>number({unit:'s',min:0,max:600,...o});
const meters=(o={})=>number({unit:'m',min:0,max:100,...o});
const speed=(o={})=>number({unit:'m/s',min:0,max:100,...o});
const factor=(o={})=>number({unit:'×',min:0,max:1,...o});
const multiplier=(o={})=>number({unit:'×',min:0,max:20,...o});
const hp=(o={})=>number({unit:'hp',min:0,max:1e6,...o});
const coins=(o={})=>integer({unit:'coins',min:0,max:1e8,...o});
const label=(max=32)=>string({maxLength:max});
const text=(max=320)=>string({maxLength:max});
const header=literal(SCHEMA_VERSION);

const combatSchema=object({
 schemaVersion:header,
 kits:record(object({name:label(24),health:integer({unit:'hp',min:1,max:1e5}),damageMultiplier:multiplier({above:0}),speed:speed({above:0,max:50}),tint:hexColor(),description:label(80)}),{min:1}),
 movement:object({walk:speed({above:0,max:50,description:'Bot travel pace and camera stride reference'}),shop:speed({above:0,max:50}),sprint:multiplier({above:0}),flight:multiplier({above:0}),block:factor({above:0}),crouch:factor({above:0}),gearSpeed:multiplier({description:'Movement added per point of gear speed'})}),
 roll:object({duration:seconds({above:0,max:3}),cooldown:seconds({above:0,max:10}),speed:speed({above:0,max:20}),minimumClearance:meters({above:0,max:3}),cameraDip:meters({max:0.6})}),
 stamina:object({maximum:number({unit:'stamina',above:0,max:1000}),sprintDrain:number({unit:'stamina/s',above:0,max:100}),regenRate:number({unit:'stamina/s',above:0,max:200}),regenDelay:seconds({max:10}),resumeAt:number({unit:'stamina',min:0,max:1000}),rollCost:number({unit:'stamina',min:0,max:1000}),dodgeCost:number({unit:'stamina',min:0,max:1000})}),
 flightPose:object({blendRate:number({unit:'1/s',above:0,max:30}),response:number({unit:'1/s',above:0,max:30}),maxLean:number({unit:'rad',min:0,max:0.4}),hoverAmount:meters({max:0.1}),jointRate:number({unit:'rad/s',above:0,max:20,description:'Maximum flight leg rotation per second'})}),
 dodge:object({duration:seconds({above:0,max:1}),cooldown:seconds({above:0,max:5}),speed:speed({above:0,max:20}),minimumClearance:meters({above:0,max:3})}),
 melee:object({
  hurtWindow:seconds({max:10,description:'Shared direct-hit immunity'}),aimPadding:meters({max:0.1,description:'Small melee-only horizontal edge allowance; never extends weapon reach'}),defaultReach:meters({above:0,max:60}),comboWindow:seconds({max:30}),
  targeting:object({range:meters({above:0,max:40}),cone:number({unit:'rad',above:0,max:0.15,description:'Visual hover cone; does not widen attack hitboxes'})}),
  criticalMultiplier:multiplier({min:1}),blockMultiplier:factor(),minimumDamage:integer({unit:'hp',min:0,max:1000}),
  hitbox:object({radius:meters({above:0,max:5}),height:meters({above:0,max:10}),crouched:meters({above:0,max:10})}),
  sprintHit:object({minimumSpeed:speed({max:50}),velocityRetained:factor()}),
 }),
 knockback:object({
  forceScale:multiplier(),sprintForceScale:multiplier(),sprintBonus:speed({max:50}),maximum:speed({above:0}),guardedScale:factor(),retained:factor(),counterVelocity:factor(),
  lift:object({normal:speed({max:50}),sprint:speed({max:50}),critical:speed({max:50}),guarded:speed({max:50})}),
  steering:object({maxResist:factor(),resistDivisor:number({above:0,max:1000}),groundBlend:number({unit:'1/s',min:0,max:200}),airBlend:number({unit:'1/s',min:0,max:200})}),
  decay:object({ground:number({unit:'1/s',min:0,max:200}),air:number({unit:'1/s',min:0,max:200})}),
 }),
 heavy:object({
  windup:seconds({max:10}),minimum:seconds({max:10}),full:seconds({above:0,max:10}),minRecovery:seconds({max:20}),maxRecovery:seconds({max:20}),
  damage:object({base:multiplier(),perPower:multiplier()}),knockback:object({base:multiplier(),perPower:multiplier()}),
 }),
 bow:object({quiver:integer({unit:'arrows',min:0,max:999}),maxArrows:integer({unit:'arrows',min:0,max:999}),knockoutArrows:integer({unit:'arrows',min:0,max:999}),fullDraw:seconds({above:0,max:10}),baseDamage:hp({max:1e4}),chargeDamage:hp({max:1e4}),refillDelay:seconds(),refillInterval:seconds({above:0})}),
});

// Exotic on-hit effects. chance is rolled on every landed direct melee hit; damage ignores the hurt window.
const procBase={chance:factor({above:0,description:'Chance per landed direct melee hit'}),damage:hp({max:1e4,description:'Before kit and armor'}),color:hexColor()};
const procSchema=variant('kind',{
 explosion:object({...procBase,radius:meters({above:0,max:30}),knockback:speed({description:'Outward push'}),lift:speed({max:50}),ignite:boolean({description:'Sets everyone caught on fire'})}),
 launch:object({...procBase,lift:speed({max:50}),knockback:speed({description:'Push away from the wielder'})}),
 nova:object({...procBase,radius:meters({above:0,max:30}),heal:hp({max:1e4,description:'Restored to the wielder'}),knockback:speed({description:'Outward push'})}),
 chain:object({...procBase,targets:integer({unit:'enemies',min:1,max:20}),range:meters({above:0,max:30,description:'Longest jump between enemies'}),slow:seconds({max:30,description:'Chill on every enemy struck'})}),
 singularity:object({...procBase,radius:meters({above:0,max:30}),pull:speed({description:'Inward pull toward the target'})}),
});
const weaponsSchema=object({
 schemaVersion:header,
 weapons:record(object({
  name:label(),file:asset(),kind:optional(oneOf(['staff'])),price:coins(),damage:hp({above:0}),absoluteDamage:optional(boolean()),dungeonOnly:optional(boolean({description:'Earned in dungeons; unavailable to shop and chest purchases'})),rarity:optional(ref('rarities')),
  reach:meters({above:0}),knockback:speed(),speed:number({unit:'swing bonus',min:-5,max:5}),icon:oneOf(['sword','dagger','mace','staff']),
  spell:optional(ref('spells')),cooldown:optional(seconds({above:0,max:60})),projectileSpeed:optional(speed({above:0,max:500})),color:optional(hexColor()),description:optional(text()),
  proc:optional(procSchema),
 }),{min:1}),
 spells:object({
  frost:object({slowDuration:seconds({max:60}),speedMultiplier:factor()}),
  venom:object({tickInterval:seconds({above:0,max:60}),ticks:integer({min:1,max:100}),tickDamage:hp({max:1e4})}),
  arcane:object({chainTargets:integer({min:0,max:20}),chainRange:meters(),chainDamage:hp({max:1e4}),chainKnockback:speed()}),
 }),
 statusEffects:record(variant('kind',{
  damage:object({name:label(24),color:cssColor(),hex:hexColor(),interval:seconds({above:0,max:60}),ticks:integer({min:1,max:100}),baseDamage:hp({max:1e4}),damagePerLevel:hp({max:1e4})}),
  slow:object({name:label(24),color:cssColor(),hex:hexColor(),duration:seconds({above:0,max:60}),baseSlowPercent:number({unit:'%',min:0,max:100}),slowPercentPerLevel:number({unit:'%',min:0,max:100})}),
 }),{min:1}),
});

const armorSchema=object({
 schemaVersion:header,
 armor:record(object({name:label(),file:nullable(asset()),price:coins(),reduction:number({unit:'×',min:0,max:.95}),dungeonOnly:optional(boolean({description:'Earned in dungeons; unavailable to equipment purchases'})),slot:optional(oneOf(['head'])),fit:optional(oneOf(['torso','head']))}),{required:['none']}),
});

const potionBase={name:label(),file:asset(),price:coins(),color:hexColor(),description:text()};
const consumablesSchema=object({
 schemaVersion:header,
 potions:object({
  healing:object({...potionBase,amount:integer({unit:'hp',min:1,max:1e5})}),
  haste:object({...potionBase,duration:seconds({above:0}),multiplier:multiplier({min:1,max:10})}),
  guard:object({...potionBase,duration:seconds({above:0}),reduction:factor()}),
 }),
});

const cosmeticsSchema=object({
 schemaVersion:header,
 cosmetics:record(object({name:label(),price:coins(),style:optional(oneOf(['flame','lightning','fusion','pressure','ascension'])),power:optional(oneOf(['pressure','ascension'])),colors:array(hexColor(),{length:2}),description:text()}),{required:['none']}),
 nameplates:record(object({name:label(),price:coins(),description:text()}),{required:['none']}),
});

const voiceFile=description=>string({pattern:/^[\w-]+\.mp3$/,patternLabel:'an .mp3 file name in assets/voice',description});
const rollRange=(damageMax,max)=>object({damage:object({min:integer({min:0,max:damageMax}),spread:integer({min:1,max:damageMax})}),reach:object({min:meters({max}),spread:meters({max})}),speed:object({min:number({min:0,max}),spread:number({min:0,max})})});
const progressionSchema=object({
 schemaVersion:header,
 inventory:object({carrySlots:integer({unit:'slots',min:1,max:200}),hotbarSlots:integer({unit:'slots',min:1,max:9}),stackLimit:integer({unit:'items',min:1,max:999})}),
 storage:object({initialSlots:integer({unit:'slots',min:0,max:1000}),stepSlots:integer({unit:'slots',min:1,max:1000}),basePrice:coins()}),
 starterKit:object({weapon:ref('weapons'),potion:ref('potions'),potionCount:integer({min:0,max:999})}),
 rarities:record(object({name:label(24),color:cssColor(),damage:integer({unit:'hp',min:0,max:1000}),weight:number({unit:'%',min:0,max:100}),salvage:coins(),effectChance:factor(),effectLevel:integer({min:1,max:10})}),{required:['common','legendary']}),
 chest:object({
  price:coins(),staffReachMultiplier:multiplier(),weapons:array(ref('weapons'),{min:1,unique:true}),rolls:rollRange(100,5),
  forged:object({chance:factor(),titles:array(label(24),{min:1,unique:true}),effectLevels:array(integer({min:1,max:10}),{min:1}),rolls:rollRange(100,5)}),
 }),
 merchant:object({
  name:label(24),level:integer({unit:'level',min:1,max:9999,description:'Shown on the overhead label'}),file:asset(),
  weapons:array(ref('weapons'),{min:1,unique:true,description:'Sold only here, never in the equipment shop or chest'}),
  offered:integer({unit:'weapons',min:1,max:20,description:'Weapons on sale each restock, one copy each'}),
  restock:seconds({above:0,max:86400,description:'Real time between restocks'}),
  sellOut:object({min:seconds({max:86400,description:'Earliest sell-out after a restock'}),spread:seconds({max:86400})}),
  voice:object({
   greet:voiceFile('Played when the player walks up'),call:voiceFile('Called out while the player is in earshot and after each restock'),
   greetCooldown:seconds({description:'Shortest gap between greetings'}),callInterval:object({min:seconds({above:0}),spread:seconds()}),
   hearing:meters({above:0,description:'Voice fades to silence at this distance'}),volume:factor({description:'Before the master volume setting'}),
  }),
 }),
 salvage:object({potionFactor:factor(),priceFactor:factor()}),
 match:object({rounds:integer({unit:'rounds',min:1,max:9}),betweenRounds:seconds({min:1,max:15})}),
 rewards:object({
  knockout:object({coins:coins(),streakCoins:coins(),maxStreakCoins:coins(),points:integer({unit:'points',min:0,max:1e4}),ratingDivisor:number({above:0,max:1e6}),minPoints:integer({unit:'points',min:0,max:1e4}),maxPoints:integer({unit:'points',min:0,max:1e4})}),
  death:object({points:integer({unit:'points',min:0,max:1e4}),ratingDivisor:number({above:0,max:1e6}),minPoints:integer({unit:'points',min:0,max:1e4}),maxPoints:integer({unit:'points',min:0,max:1e4})}),
  match:object(Object.fromEntries(['win','draw','loss'].map(result=>[result,object({coins:coins(),points:integer({unit:'points',min:0,max:1e4})})]))),
 }),
 leveling:object({
  levelsPerRank:integer({unit:'levels',min:1,max:100,description:'Levels inside each rank. The level count is this value times the number of ranks.'}),
  stepBase:number({unit:'knockouts',min:0,max:1000,description:'Equal-fight knockouts to leave level 1. One knockout is rewards.knockout.points EXP.'}),
  stepGrowth:number({unit:'knockouts',min:0,max:1000,description:'Extra knockouts added as the level rises.'}),
  stepExponent:number({above:0,max:3,description:'How fast the extra knockout cost grows.'}),
 }),
 ranks:array(object({name:label(24),min:integer({unit:'points',min:0,max:1e9}),color:cssColor()}),{min:1,unique:'name'}),
});

const botsSchema=object({
 schemaVersion:header,
 strategy:object({spellAccuracy:factor({description:'Estimated projectile accuracy for purchase comparisons'}),rangerBonus:multiplier({description:'Staff preference in starter-sword damage units'}),meleeBias:multiplier({description:'Non-ranger staff penalty in starter-sword damage units'})}),
 maxBots:integer({unit:'bots',min:0,max:64}),
 profiles:array(object({name:label(16),cps:number({unit:'clicks/s',above:0,max:30}),reaction:seconds({max:5}),aimError:number({unit:'rad',min:0,max:3}),turn:number({unit:'rad/s',above:0,max:100}),jump:factor(),aggression:multiplier({max:3}),rating:integer({unit:'points',min:0,max:1e6})}),{min:1,unique:'name'}),
 extraNames:array(label(16),{unique:true}),
 generated:object({cps:object({min:number({unit:'clicks/s',above:0,max:30}),max:number({unit:'clicks/s',above:0,max:30}),variation:number({unit:'clicks/s',min:0,max:10})}),reaction:object({min:seconds({max:5}),variation:seconds({max:5})}),rating:object({min:integer({unit:'points',min:0,max:1e6}),variation:integer({unit:'points',min:0,max:1e6})})}),
 clicks:object({jitterMin:multiplier({above:0,max:5,description:'Shortest click gap as a fraction of 1/cps'}),jitterSpread:multiplier({max:5})}),
 economy:object({income:coins(),incomeInterval:seconds({above:0}),shopMinimumCoins:coins()}),
 healing:object({threshold:factor({description:'Drink below this fraction of max health'}),cooldown:seconds()}),
 targeting:object({streakCap:integer({unit:'KOs',min:0,max:100}),streakWeight:multiplier({max:5}),currentBias:factor({above:0})}),
});

const eventBase={id:string({pattern:/^[a-z][a-z0-9-]*$/,patternLabel:'a lowercase id'}),name:label(32),warning:text(120),duration:seconds({above:0}),color:hexColor()};
const eventsSchema=object({
 schemaVersion:header,
 schedule:object({firstDelay:seconds(),warning:seconds({above:0,max:60}),idleMin:seconds(),idleSpread:seconds()}),
 types:array(object({...eventBase,kind:literal('supply')}),{min:1,unique:'id'}),
 supplies:object({pickupRadius:meters({above:0,max:10}),player:object({coins:coins(),arrows:integer({unit:'arrows',min:0,max:999}),health:hp({max:1e5})}),bot:object({coins:coins(),health:hp({max:1e5})})}),
 killstreaks:object({tiers:array(integer({unit:'KOs',min:1,max:1000}),{min:1})}),
});

const SCHEMAS={combat:combatSchema,weapons:weaponsSchema,armor:armorSchema,consumables:consumablesSchema,cosmetics:cosmeticsSchema,progression:progressionSchema,bots:botsSchema,events:eventsSchema};

function crossCheck(c,issue){
 const {combat,weapons,armor,consumables,cosmetics,progression,bots,events}=c;
 const keep=(file,label,ids,list)=>{if(ids)for(const id of list)if(!ids.includes(id))issue(file,`${label}: ${JSON.stringify(id)} is stored in saved profiles and must not be removed`);};
 keep('combat.json','kits',combat?.kits&&Object.keys(combat.kits),PERSISTED_IDS.kits);
 keep('weapons.json','weapons',weapons?.weapons&&Object.keys(weapons.weapons),PERSISTED_IDS.weapons);
 keep('weapons.json','statusEffects',weapons?.statusEffects&&Object.keys(weapons.statusEffects),PERSISTED_IDS.statusEffects);
 keep('armor.json','armor',armor?.armor&&Object.keys(armor.armor),PERSISTED_IDS.armor);
 keep('cosmetics.json','cosmetics',cosmetics?.cosmetics&&Object.keys(cosmetics.cosmetics),PERSISTED_IDS.cosmetics);
 keep('cosmetics.json','nameplates',cosmetics?.nameplates&&Object.keys(cosmetics.nameplates),PERSISTED_IDS.nameplates);
 keep('progression.json','rarities',progression?.rarities&&Object.keys(progression.rarities),PERSISTED_IDS.rarities);
 keep('progression.json','chest.forged.titles',progression?.chest?.forged?.titles,PERSISTED_IDS.titles);
 if(combat?.melee?.hitbox&&combat.melee.hitbox.crouched>combat.melee.hitbox.height)issue('combat.json','melee.hitbox.crouched must not exceed melee.hitbox.height');
 const stamina=combat?.stamina;if(stamina)for(const key of ['resumeAt','rollCost','dodgeCost'])if(stamina[key]>stamina.maximum)issue('combat.json',`stamina.${key} must not exceed stamina.maximum`);
 const h=combat?.heavy;
 if(combat?.bow&&combat.bow.maxArrows<combat.bow.quiver)issue('combat.json','bow.maxArrows must be at least bow.quiver');
 if(h){if(h.windup>=h.full)issue('combat.json','heavy.windup must be shorter than heavy.full');if(h.minimum>h.full)issue('combat.json','heavy.minimum must not exceed heavy.full');if(h.minRecovery>h.maxRecovery)issue('combat.json','heavy.minRecovery must not exceed heavy.maxRecovery');}
 for(const [id,w]of Object.entries(weapons?.weapons??{})){if(!w)continue;
  if(w.kind==='staff'){for(const key of['spell','cooldown','projectileSpeed','color'])if(w[key]===undefined)issue('weapons.json',`weapons.${id}.${key} is required for staffs`);}
  else if(w.spell!==undefined||w.cooldown!==undefined||w.projectileSpeed!==undefined)issue('weapons.json',`weapons.${id} uses staff fields without kind "staff"`);
 }
 const maxLevel=Math.max(...(progression?.chest?.forged?.effectLevels??[1]),...Object.values(progression?.rarities??{}).map(r=>r?.effectLevel??1));
 for(const [id,e]of Object.entries(weapons?.statusEffects??{}))if(e?.kind==='slow'&&e.baseSlowPercent+e.slowPercentPerLevel*maxLevel>=100)issue('weapons.json',`statusEffects.${id} would stop movement entirely at level ${maxLevel}`);
 const effectCount=Object.keys(weapons?.statusEffects??{}).length,forgedEffects=progression?.chest?.forged?.effectLevels?.length??0;
 if(weapons?.statusEffects&&forgedEffects>effectCount)issue('progression.json',`chest.forged.effectLevels lists ${forgedEffects} effects but only ${effectCount} status effects exist`);
 const none=armor?.armor?.none;if(none&&(none.file!==null||none.reduction!==0||none.price!==0))issue('armor.json','armor.none must have file null, price 0 and reduction 0');
 for(const [id,a]of Object.entries(armor?.armor??{}))if(id!=='none'&&a&&!a.file)issue('armor.json',`armor.${id}.file is required`);
 for(const key of['cosmetics','nameplates'])if(cosmetics?.[key]?.none&&cosmetics[key].none.price!==0)issue('cosmetics.json',`${key}.none.price must be 0`);
 const inv=progression?.inventory;
 if(inv){if(inv.hotbarSlots>inv.carrySlots)issue('progression.json','inventory.hotbarSlots must not exceed inventory.carrySlots');if(progression.starterKit&&progression.starterKit.potionCount>inv.stackLimit)issue('progression.json','starterKit.potionCount must not exceed inventory.stackLimit');}
 if(progression?.rarities){const total=Object.values(progression.rarities).reduce((a,r)=>a+(r?.weight??0),0);if(Math.abs(total-100)>1e-9)issue('progression.json',`rarity weights must total 100%, got ${total}`);}
 const ranks=progression?.ranks,leveling=progression?.leveling,ko=progression?.rewards?.knockout?.points;
 if(Array.isArray(ranks)&&ranks.length){if(ranks[0]?.min!==0)issue('progression.json','ranks[0].min must be 0');for(let i=1;i<ranks.length;i++)if(!(ranks[i]?.min>ranks[i-1]?.min))issue('progression.json',`ranks[${i}].min must be greater than ranks[${i-1}].min`);
  if(leveling&&Number.isFinite(ko)&&leveling.levelsPerRank){const per=leveling.levelsPerRank,step=level=>ko*Math.round(leveling.stepBase+leveling.stepGrowth*Math.pow(level-1,leveling.stepExponent));let total=0;for(let i=0;i<ranks.length;i++){if(ranks[i]?.min!==total)issue('progression.json',`ranks[${i}].min must be ${total}, the EXP where level ${i*per+1} starts`);for(let level=i*per+1;level<=(i+1)*per;level++)total+=step(level);}}}
 for(const key of['knockout','death']){const r=progression?.rewards?.[key];if(r&&r.minPoints>r.maxPoints)issue('progression.json',`rewards.${key}.minPoints must not exceed maxPoints`);}
 const generated=bots?.generated?.cps;if(generated&&generated.min>generated.max)issue('bots.json','generated.cps.min must not exceed generated.cps.max');
 if(bots?.profiles&&bots.extraNames){const names=new Set(bots.profiles.map(p=>p?.name));for(const name of bots.extraNames)if(names.has(name))issue('bots.json',`extraNames repeats profile name ${JSON.stringify(name)}`);}
 const tiers=events?.killstreaks?.tiers;if(Array.isArray(tiers))for(let i=1;i<tiers.length;i++)if(!(tiers[i]>tiers[i-1]))issue('events.json',`killstreaks.tiers[${i}] must be greater than killstreaks.tiers[${i-1}]`);
 if(progression?.chest?.weapons&&weapons?.weapons)for(const id of progression.chest.weapons)if(weapons.weapons[id]?.absoluteDamage)issue('progression.json',`chest.weapons must not include absolute-damage weapon ${JSON.stringify(id)}`);
 if(progression?.chest?.weapons&&weapons?.weapons)for(const id of progression.chest.weapons)if(weapons.weapons[id]?.dungeonOnly)issue('progression.json',`chest.weapons must not include dungeon-only weapon ${JSON.stringify(id)}`);
 const merchant=progression?.merchant;
 if(merchant?.weapons&&weapons?.weapons&&progression.rarities){
  if(merchant.offered>merchant.weapons.length)issue('progression.json','merchant.offered must not exceed the number of merchant.weapons');
  if(merchant.sellOut&&merchant.sellOut.min+merchant.sellOut.spread>merchant.restock)issue('progression.json','merchant.sellOut.min + spread must not exceed merchant.restock');
  for(const id of merchant.weapons){const w=weapons.weapons[id];if(!w)continue;
   if(!w.rarity||progression.rarities[w.rarity]?.weight!==0)issue('progression.json',`merchant.weapons.${id} needs a rarity with weight 0, so chests never roll it`);
   if(w.kind==='staff'||w.absoluteDamage)issue('progression.json',`merchant.weapons.${id} must be a melee weapon without absolute damage`);
   if(progression.chest?.weapons?.includes(id))issue('progression.json',`chest.weapons must not include merchant weapon ${JSON.stringify(id)}`);}
  for(const [id,w]of Object.entries(weapons.weapons))if(w?.proc&&!merchant.weapons.includes(id))issue('weapons.json',`weapons.${id}.proc is only allowed on merchant weapons`);
 }
}

// Validates raw JSON objects and returns converted, unfrozen content.
// Throws ConfigError listing every problem with its file and field path.
export function parseConfig(raw){
 const ctx={issues:[],refs:[],file:''},out={};
 for(const name of CONFIG_FILES){ctx.file=name+'.json';out[name]=parse(SCHEMAS[name],raw?.[name],'',ctx);}
 ctx.file='';
 resolveRefs(ctx,{
  weapons:Object.keys(out.weapons?.weapons??{}),spells:Object.keys(out.weapons?.spells??{}),rarities:Object.keys(out.progression?.rarities??{}),potions:Object.keys(out.consumables?.potions??{}),
 });
 crossCheck(out,(file,message)=>ctx.issues.push(`${file} → ${message}`));
 if(ctx.issues.length)throw new ConfigError(ctx.issues);
 return out;
}
