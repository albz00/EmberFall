import assert from 'node:assert/strict';
import {makeProfile,openChest,weaponStats,equippedItem,RANKS,rankFor,LEVELS_PER_RANK,ARMORS} from '../dist/progression.js';
import {choosePurchase,transactBot,itemScore,tacticalGoal} from '../dist/bot-strategy.js';
import {botReply,describePlan} from '../dist/bot-chat.js';

assert.equal(RANKS.length,31);assert.equal(new Set(RANKS.map(r=>r.name)).size,31);
for(let i=1;i<RANKS.length;i++)assert(RANKS[i].min>RANKS[i-1].min);
assert.equal(rankFor(RANKS.at(-1).min).name,'Apex');
assert.equal(LEVELS_PER_RANK,16);assert.equal(rankFor(0).level,1);assert.equal(rankFor(0).levelProgress,0);
assert.equal(rankFor(59).level,1);assert.equal(rankFor(60).level,2);assert.equal(rankFor(139).level,2);assert.equal(rankFor(140).level,3);
assert.equal(rankFor(RANKS[1].min-1).level,LEVELS_PER_RANK);assert.equal(rankFor(RANKS[1].min).level,LEVELS_PER_RANK+1);
assert.equal(rankFor(RANKS.at(-1).min).level,(RANKS.length-1)*LEVELS_PER_RANK+1);
assert.equal(rankFor(1e9).level,RANKS.length*LEVELS_PER_RANK);
let expectedLevel=1;for(const rank of RANKS){assert.equal(rankFor(rank.min).level,expectedLevel);expectedLevel+=LEVELS_PER_RANK;}
const legacy=makeProfile({coins:185,inventory:[{id:'old',weapon:'gemblade',rarity:'legendary'}],equipped:'old'});
assert.equal(weaponStats(equippedItem(legacy)).damage,28);
let seed=927;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const counts={forged:0,bleed:0,frost:0,fire:0};
const p=makeProfile();for(let n=0;n<10000;n++){
 p.coins=180;const item=openChest(p,random).item,s=weaponStats(item);assert.equal(p.coins,0);p.inventory=[];
 assert(s.damage<=54&&s.reach<=31.75&&s.speed<=1);assert(s.effects.length<=(item.forged?2:1));
 if(item.forged){counts.forged++;assert.equal(item.rarity,'legendary');assert.equal(s.effects.length,2);assert(s.name!==s.weapon);}
 for(const e of s.effects)counts[e.type]++;
 if(item.forged&&n<5000){const loaded=makeProfile({inventory:[item],equipped:item.id});assert.deepEqual(equippedItem(loaded),item);}
}
assert(counts.forged>100&&counts.forged<200);assert(counts.bleed>500&&counts.frost>500&&counts.fire>500);
const malformed=makeProfile({inventory:[{id:'bad',weapon:'mace',rarity:'common',forged:true,title:'<img>',rolls:{damage:999,reach:10,speed:30},effects:[{type:'fire',level:99},{type:'bad',level:1}]}],equipped:'bad'});
const bounded=weaponStats(equippedItem(malformed));assert.equal(bounded.damage,21);assert.equal(bounded.reach,3.05);assert.equal(bounded.effects[0].level,2);assert(!bounded.forged);

const novice=makeProfile({coins:150});let choice=choosePurchase(novice,'duelist',.2);assert.equal(choice.kind,'armor');assert.equal(choice.id,'leather');assert(transactBot(novice,choice,'duelist').ok);assert.equal(novice.coins,30);assert.equal(novice.armor,'leather');
novice.coins=500;choice=choosePurchase(novice,'ranger',.2);assert(choice);const wallet=novice.coins;transactBot(novice,choice,'ranger');assert(novice.coins<wallet);
const veteran=makeProfile({coins:600,inventory:[{id:'best',weapon:'gemblade',rarity:'legendary',effects:[{type:'bleed',level:2}]}],equipped:'best',armor:'gold',helmet:'helmet',ownedArmor:['gold','helmet']});
choice=choosePurchase(veteran,'duelist',.9);assert.equal(choice.kind,'chest');const beforeScore=itemScore(equippedItem(veteran),'duelist');const result=transactBot(veteran,choice,'duelist',()=>0);assert(result.ok);assert.equal(veteran.coins,420);assert(itemScore(equippedItem(veteran),'duelist')>=beforeScore,'bot keeps stronger old equipment after a weak drop');
const fake={id:4,name:'Rook',role:'duelist',account:veteran,stats:weaponStats(equippedItem(veteran)),armor:'gold',helmet:'helmet',hp:320,kit:{health:400},rating:1400,skill:{cps:7.3},position:{x:4,z:5},strafe:1,alive:true,plan:'duel',state:'fight',kills:5,deaths:2};
const target={position:{x:0,z:0,y:0},velocity:{x:3,z:0},name:'Player'},a=tacticalGoal(fake,target,true),b=tacticalGoal({...fake,id:5},target,true);assert(Math.hypot(a.x-b.x,a.z-b.z)>2,'coordinated hunters take distinct attack angles');
const ranger=tacticalGoal({...fake,stats:{...fake.stats,kind:'staff',projectileSpeed:32}},target);assert(Math.hypot(ranger.x-target.position.x,ranger.z-target.position.z)>8,'staff user keeps distance');
const context={playerName:'Alex',playerStreak:6,playerKills:8,hunt:true,eventName:null};
assert(botReply(fake,'what sword are you using?',context).toLowerCase().includes(fake.stats.name.toLowerCase()));
assert(botReply(fake,'what armor did you buy?',context).includes(String(veteran.coins)));
assert(describePlan(fake,context).includes('flank'));
const first=botReply(fake,'gg',context),second=botReply(fake,'gg',context);assert.notEqual(first,second,'replies avoid immediate repetition');
assert(botReply(fake,'are you an ai?',context).includes('simulated'));
console.log(JSON.stringify({strategy:'passed',ranks:31,chests:10000,counts,persistentRolls:true,boundedStats:true,budgetedPurchases:true,weakLootRejected:true,distinctHuntAngles:true,contextualChat:true}));
