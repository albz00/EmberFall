import map from '../maps/ashen-crypt.json?v=53' with {type:'json'};
import tuning from '../config/dungeon.json?v=53' with {type:'json'};
import {CONFIG} from './config.js?v=53';
import {CHARACTERS} from '../progression.js?v=53';
import {ConfigError,parse,deepFreeze,object,array,record,number,integer,string,boolean,literal} from './schema.js?v=26';

const meters=(min=0,max=500)=>number({unit:'m',min,max}),seconds=()=>number({unit:'s',above:0,max:120}),count=(max=10000)=>integer({unit:'count',min:0,max});
const point=object({x:meters(-500),z:meters(-500)});
const mapSchema=object({schemaVersion:literal(1),name:string(),origin:point,halfWidth:meters(8,50),halfDepth:meters(20,100),wallHeight:meters(3,20),doorWidth:meters(3,15),spawn:point,exit:point,cache:point,dividers:array(meters(-100,100),{length:2}),obstacles:array(object({x:meters(-50,50),z:meters(-100,100),w:meters(.1,10),d:meters(.1,10),h:meters(.1,15)})),encounters:array(object({name:string(),triggerZ:meters(-100,100),minZ:meters(-100,100),maxZ:meters(-100,100),mobs:array(object({type:string(),x:meters(-50,50),z:meters(-100,100)}),{min:1,max:12})}),{length:3})});
const tuningSchema=object({schemaVersion:literal(1),interactionRange:meters(1,8),clearHealing:number({unit:'hp',min:0,max:1000}),mobCoins:count(),mobExp:count(),bossCoins:count(),bossExp:count(),aggroRange:meters(3,100),jumpSpeed:number({unit:'m/s',min:0,max:15}),jumpInterval:seconds(),staggerResistance:number({unit:'×',min:0,max:1}),boss:object({enrageAt:number({unit:'×',above:0,max:1}),enrageSpeed:number({unit:'×',min:1,max:3}),attackInterval:seconds(),enragedInterval:seconds(),windup:seconds(),damage:number({unit:'hp',min:1,max:1000}),radius:meters(1,15),knockback:number({unit:'m/s',min:0,max:30}),safeJumpHeight:meters(.1,5),summons:count(6),summonType:string()}),mobs:record(object({name:string(),character:string(),weapon:string(),armor:string(),health:number({unit:'hp',min:1,max:10000}),speed:number({unit:'m/s',min:0,max:12}),damage:number({unit:'hp',min:1,max:500}),cps:number({unit:'clicks/s',above:0,max:15}),range:meters(1,40),scale:number({unit:'×',min:.5,max:2}),boss:boolean()})),rewards:object({weapons:array(string(),{min:1}),armor:string(),weaponCount:count(3),armorCount:count(3),effectLevel:integer({unit:'level',min:1,max:3}),effects:array(string(),{min:1})})});
export function parseDungeonData(rawMap,rawTuning){
 const ctx={issues:[],refs:[],file:'maps/ashen-crypt.json'},m=parse(mapSchema,rawMap,'',ctx);ctx.file='config/dungeon.json';const t=parse(tuningSchema,rawTuning,'',ctx);
 if(!ctx.issues.length){
  const inside=p=>Math.abs(p.x)<m.halfWidth-.5&&Math.abs(p.z)<m.halfDepth-.5;
  for(const [id,p]of Object.entries({spawn:m.spawn,exit:m.exit,cache:m.cache}))if(!inside(p))ctx.issues.push('maps/ashen-crypt.json → '+id+': must be inside the dungeon');
  if(m.origin.x+m.halfWidth>=-64)ctx.issues.push('maps/ashen-crypt.json → origin: must be west of the arena');
  if(m.doorWidth>=m.halfWidth*2)ctx.issues.push('maps/ashen-crypt.json → doorWidth: must leave walls');
  m.encounters.forEach((e,i)=>{if(e.minZ>=e.maxZ||!inside({x:0,z:e.triggerZ})||i&&e.triggerZ>=m.encounters[i-1].triggerZ)ctx.issues.push('maps/ashen-crypt.json → encounters['+i+']: invalid room or trigger order');for(const p of e.mobs)if(!t.mobs[p.type]||!inside(p)||p.z<e.minZ||p.z>e.maxZ)ctx.issues.push('maps/ashen-crypt.json → encounters['+i+']: invalid mob placement or type');});
  for(const mob of Object.values(t.mobs)){if(!CONFIG.weapons.weapons[mob.weapon]||!CONFIG.armor.armor[mob.armor])ctx.issues.push('config/dungeon.json → mobs: unknown equipment');if(!CHARACTERS[mob.character])ctx.issues.push('config/dungeon.json → mobs: unknown character');}
  if(!t.mobs[t.boss.summonType]||t.mobs[t.boss.summonType].boss)ctx.issues.push('config/dungeon.json → boss.summonType: must name a normal mob');
  for(const id of t.rewards.weapons)if(!CONFIG.weapons.weapons[id]?.dungeonOnly)ctx.issues.push('config/dungeon.json → rewards.weapons: must name dungeon-only weapons');
  if(!CONFIG.armor.armor[t.rewards.armor]?.dungeonOnly)ctx.issues.push('config/dungeon.json → rewards.armor: must name dungeon-only armor');
  for(const id of t.rewards.effects)if(!CONFIG.weapons.statusEffects[id])ctx.issues.push('config/dungeon.json → rewards.effects: unknown effect');
 }
 if(ctx.issues.length)throw new ConfigError(ctx.issues);return deepFreeze({map:m,tuning:t});
}
const data=parseDungeonData(map,tuning);
export const CRYPT=data.map,DUNGEON=data.tuning;
