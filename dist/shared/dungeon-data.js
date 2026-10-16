import map from '../maps/ashen-crypt.json?v=54' with {type:'json'};
import tuning from '../config/dungeon.json?v=54' with {type:'json'};
import {CONFIG} from './config.js?v=53';
import {CHARACTERS} from '../progression.js?v=53';
import {ConfigError,parse,deepFreeze,object,array,record,number,integer,string,boolean,literal,oneOf,hexColor} from './schema.js?v=26';

const meters=(min=0,max=500)=>number({unit:'m',min,max});
const seconds=(min=0)=>number({unit:'s',above:min,max:120});
const count=(max=10000)=>integer({unit:'count',min:0,max});
const hp=()=>number({unit:'hp',min:0,max:10000});
const speed=()=>number({unit:'m/s',min:0,max:50});
const fraction=()=>number({unit:'fraction of room half-size',min:-.95,max:.95});
const point=object({x:meters(-1000,0),z:meters(-1000,1000)});
const prop=object({kind:oneOf(['pillar','sarcophagus','shelf','altar','anvil','planter','throne']),x:fraction(),z:fraction(),w:meters(.2,12),d:meters(.2,12),h:meters(.1,20)});
const template=object({name:string(),visual:oneOf(['ossuary','library','forge','rift','garden','vault','crown','storm']),shape:oneOf(['rect','cross','octagon']),sizes:array(object({w:meters(18,44),d:meters(18,44)}),{min:1,max:5}),height:meters(8,24),color:hexColor(),props:array(prop,{max:20}),packs:array(array(string(),{min:1,max:6}),{max:5}),hazards:array(object({x:fraction(),z:fraction(),w:meters(.5,8),d:meters(.5,24)}),{max:6})});
const mapSchema=object({schemaVersion:literal(2),name:string(),origin:point,generation:object({spacing:meters(48,65),corridorWidth:meters(4,9),sideRooms:integer({unit:'rooms',min:1,max:3})}),templates:record(template,{required:['entrance','ossuary','library','forge','rift','garden','vault','crown','storm']})});
const spell=object({kind:oneOf(['fan','lightning','meteor','well','wave']),color:hexColor(),windup:seconds(),duration:seconds(),cooldown:seconds(),damage:hp(),radius:meters(0,20),range:meters(1,60),speed:speed(),count:integer({unit:'projectiles or targets',min:1,max:12}),spread:number({unit:'radians for fans; m for target spread',min:0,max:12}),knockback:speed(),effect:string(),effectLevel:integer({unit:'level',min:1,max:3}),pull:speed(),tickDamage:hp(),tickInterval:seconds(),jumpable:boolean()});
const tuningSchema=object({schemaVersion:literal(2),interactionRange:meters(1,8),clearHealing:hp(),mobCoins:count(),mobExp:count(),bossCoins:count(),bossExp:count(),eliteCoins:count(),eliteExp:count(),sideCoins:count(),sideRewards:array(string(),{min:1}),depthScaling:object({health:number({unit:'× per depth',min:0,max:1}),damage:number({unit:'× per depth',min:0,max:1}),rewards:number({unit:'× per depth',min:0,max:1}),maximum:number({unit:'×',min:1,max:10})}),magic:object({maxActive:integer({unit:'spells',min:1,max:40}),maxProjectiles:integer({unit:'projectiles',min:10,max:80}),minimumDistance:meters(0,15),pullLimit:speed(),targetStagger:seconds(),prediction:number({unit:'s',min:0,max:1})}),aggroRange:meters(3,100),jumpSpeed:speed(),jumpInterval:seconds(),staggerResistance:number({unit:'×',min:0,max:1}),boss:object({enrageAt:number({unit:'×',above:0,max:1}),enrageSpeed:number({unit:'×',min:1,max:3}),attackInterval:seconds(),enragedInterval:seconds(),windup:seconds(),damage:hp(),radius:meters(1,15),knockback:speed(),safeJumpHeight:meters(.1,5),summons:count(6),summonType:string()}),mobs:record(object({name:string(),character:string(),weapon:string(),armor:string(),health:number({unit:'hp',min:1,max:10000}),speed:speed(),damage:hp(),cps:number({unit:'clicks/s',above:0,max:15}),range:meters(1,40),scale:number({unit:'×',min:.5,max:2}),boss:boolean(),color:hexColor(),spells:array(string(),{max:8})})),spells:record(spell),rewards:object({weapons:array(string(),{min:1}),armor:string(),weaponCount:count(3),armorCount:count(3),effectLevel:integer({unit:'level',min:1,max:3}),effects:array(string(),{min:1})})});
export function parseDungeonData(rawMap,rawTuning){
 const ctx={issues:[],refs:[],file:'maps/ashen-crypt.json'},m=parse(mapSchema,rawMap,'',ctx);
 ctx.file='config/dungeon.json';const t=parse(tuningSchema,rawTuning,'',ctx);
 if(!ctx.issues.length){
  if(m.origin.x+3*m.generation.spacing+22>=-64)ctx.issues.push('maps/ashen-crypt.json → origin: generated rooms must stay west of the arena');
  for(const [id,room]of Object.entries(m.templates))for(const pack of room.packs)for(const type of pack)if(!t.mobs[type])ctx.issues.push('maps/ashen-crypt.json → templates.'+id+': unknown mob '+type);
  for(const [id,mob]of Object.entries(t.mobs)){
   if(!CONFIG.weapons.weapons[mob.weapon]||!CONFIG.armor.armor[mob.armor])ctx.issues.push('config/dungeon.json → mobs.'+id+': unknown equipment');
   if(!CHARACTERS[mob.character])ctx.issues.push('config/dungeon.json → mobs.'+id+': unknown character');
   for(const spell of mob.spells)if(!t.spells[spell])ctx.issues.push('config/dungeon.json → mobs.'+id+': unknown spell '+spell);
  }
  for(const [id,s]of Object.entries(t.spells)){
   if(s.effect!=='none'&&!CONFIG.weapons.statusEffects[s.effect])ctx.issues.push('config/dungeon.json → spells.'+id+': unknown effect');
   if(s.cooldown<s.windup)ctx.issues.push('config/dungeon.json → spells.'+id+': cooldown must include windup');
   if(s.kind==='fan'&&s.speed<=0)ctx.issues.push('config/dungeon.json → spells.'+id+': fan speed must be positive');
   if(s.kind!=='fan'&&s.radius<=0)ctx.issues.push('config/dungeon.json → spells.'+id+': area spell needs a radius');
  }
  if(!t.mobs[t.boss.summonType]||t.mobs[t.boss.summonType].boss)ctx.issues.push('config/dungeon.json → boss.summonType: must name a normal mob');
  for(const id of t.rewards.weapons)if(!CONFIG.weapons.weapons[id]?.dungeonOnly)ctx.issues.push('config/dungeon.json → rewards.weapons: must name dungeon-only weapons');
  if(!CONFIG.armor.armor[t.rewards.armor]?.dungeonOnly)ctx.issues.push('config/dungeon.json → rewards.armor: must name dungeon-only armor');
  for(const id of t.rewards.effects)if(!CONFIG.weapons.statusEffects[id])ctx.issues.push('config/dungeon.json → rewards.effects: unknown effect');
  for(const id of t.sideRewards)if(!CONFIG.weapons.weapons[id]||CONFIG.weapons.weapons[id].absoluteDamage||CONFIG.weapons.weapons[id].dungeonOnly)ctx.issues.push('config/dungeon.json → sideRewards: invalid arena weapon');
 }
 if(ctx.issues.length)throw new ConfigError(ctx.issues);
 return deepFreeze({map:m,tuning:t});
}
const data=parseDungeonData(map,tuning);
export const CRYPT=data.map,DUNGEON=data.tuning;
