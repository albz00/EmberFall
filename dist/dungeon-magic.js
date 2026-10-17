import {DUNGEON,seededRandom,roomContains} from './dungeon.js?v=68';
export function planDungeonSpell(run,owner,id,player,now,blocked=()=>false){
 const spec=DUNGEON.spells[id],room=run.layout.encounters[run.encounter],serial=++run.attacks,rng=seededRandom(run.seed^Math.imul(serial,2654435761));
 const aim={x:player.position.x+(player.velocity?.x??0)*DUNGEON.magic.prediction,z:player.position.z+(player.velocity?.z??0)*DUNGEON.magic.prediction};
 const spell={id:serial,spell:id,owner,room:room.id,started:now,at:now+spec.windup,until:now+spec.windup+spec.duration,targets:[],released:false,hit:false};
 const home=spec.kind==='wave'||spec.kind==='fan'?owner.position:aim;spell.x=home.x;spell.z=home.z;spell.aim=aim;
 const count=['meteor','lightning'].includes(spec.kind)?spec.count:1;
 for(let i=0;i<count;i++){
  let point={x:home.x,z:home.z};if(i){const a=i/count*Math.PI*2+rng()*.7,r=spec.spread*(.5+rng()*.5);point.x+=Math.sin(a)*r;point.z+=Math.cos(a)*r;}
  if(!roomContains(room,point.x,point.z,1)||blocked(point.x,point.z)){
   point.x=room.x;point.z=room.z;for(let n=0;n<20;n++){const a=rng()*Math.PI*2,p={x:room.x+Math.sin(a)*(2+rng()*5),z:room.z+Math.cos(a)*(2+rng()*5)};if(roomContains(room,p.x,p.z,1)&&!blocked(p.x,p.z)){point=p;break;}}
  }
  spell.targets.push({...point,at:spell.at+i*DUNGEON.magic.targetStagger,resolved:false,nextTick:spell.at+i*DUNGEON.magic.targetStagger+spec.tickInterval});
 }
 spell.until+=Math.max(0,count-1)*DUNGEON.magic.targetStagger;return spell;
}
export function spellPhase(cast,now){return now<cast.at?'warning':now>=cast.until?'finished':'active';}
export function waveHitsPlayer(cast,player,now){const spec=DUNGEON.spells[cast.spell];if(spellPhase(cast,now)!=='active'||cast.hit)return false;const r=Math.min(spec.radius,(now-cast.at)/spec.duration*spec.radius),d=Math.hypot(player.position.x-cast.x,player.position.z-cast.z);return Math.abs(d-r)<spec.spread&&(!spec.jumpable||player.position.y<DUNGEON.boss.safeJumpHeight);}
