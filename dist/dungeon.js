import {CRYPT,DUNGEON} from './shared/dungeon-data.js?v=53';
export {CRYPT,DUNGEON};
export const inDungeon=(x,z)=>x<-64;
export const dungeonPoint=p=>({x:CRYPT.origin.x+p.x,y:0,z:CRYPT.origin.z+p.z});
export function createDungeonRun(){return{active:false,encounter:-1,cleared:0,phase:'ready',enemies:[],claimed:false,cast:null,enraged:false,summoned:false,nextAttack:0,kills:0,attacks:0};}
export function nextDungeonEncounter(run,z){return run.active&&run.phase!=='fighting'&&run.cleared<CRYPT.encounters.length&&z-CRYPT.origin.z<=CRYPT.encounters[run.cleared].triggerZ?run.cleared:null;}
export function dungeonGateClosed(run,index){return run.cleared<=index;}
export function dungeonObstacles(run){const boxes=CRYPT.obstacles.map(c=>({...c,x:c.x+CRYPT.origin.x,z:c.z+CRYPT.origin.z}));for(const [i,z]of CRYPT.dividers.entries()){
 const side=(CRYPT.halfWidth-CRYPT.doorWidth/2)/2;
 for(const sign of [-1,1])boxes.push({x:CRYPT.origin.x+sign*(CRYPT.doorWidth/2+side),z:CRYPT.origin.z+z,w:side*2,d:1,h:CRYPT.wallHeight});
 if(dungeonGateClosed(run,i))boxes.push({x:CRYPT.origin.x,z:CRYPT.origin.z+z,w:CRYPT.doorWidth,d:.6,h:CRYPT.wallHeight});
 }return boxes;}
export function dungeonBlocked(x,z,y=0,padding=.38,run={cleared:0}){if(Math.abs(x-CRYPT.origin.x)>CRYPT.halfWidth-padding||Math.abs(z-CRYPT.origin.z)>CRYPT.halfDepth-padding)return true;return dungeonObstacles(run).some(c=>y<c.h&&Math.abs(x-c.x)<c.w/2+padding&&Math.abs(z-c.z)<c.d/2+padding);}
export function dungeonResolve(p,radius=.38,run){p.x=Math.max(CRYPT.origin.x-CRYPT.halfWidth+radius,Math.min(CRYPT.origin.x+CRYPT.halfWidth-radius,p.x));p.z=Math.max(CRYPT.origin.z-CRYPT.halfDepth+radius,Math.min(CRYPT.origin.z+CRYPT.halfDepth-radius,p.z));for(const c of dungeonObstacles(run)){if(p.y>=c.h)continue;const dx=p.x-c.x,dz=p.z-c.z,px=c.w/2+radius-Math.abs(dx),pz=c.d/2+radius-Math.abs(dz);if(px>0&&pz>0){if(px<pz)p.x+=Math.sign(dx||1)*px;else p.z+=Math.sign(dz||1)*pz;}}return p;}
export function dungeonGround(x,z,feet=100){let h=0;for(const c of CRYPT.obstacles)if(Math.abs(x-CRYPT.origin.x-c.x)<c.w/2&&Math.abs(z-CRYPT.origin.z-c.z)<c.d/2&&feet>=c.h-.35)h=Math.max(h,c.h);return h;}
export function markDungeonKill(run,enemy){if(!run.enemies.includes(enemy)||enemy.dungeonCounted)return false;enemy.dungeonCounted=true;run.kills++;if(run.phase!=='fighting'||run.enemies.some(f=>f.alive))return false;run.cleared++;run.phase=run.cleared===CRYPT.encounters.length?'complete':'ready';run.cast=null;return true;}
export function rollDungeonRewards(makeId,random=Math.random){const r=DUNGEON.rewards,items=[],pick=list=>list[Math.min(list.length-1,Math.floor(random()*list.length))];for(let i=0;i<r.weaponCount;i++)items.push({id:makeId('dungeon'),weapon:pick(r.weapons),rarity:'legendary',effects:[{type:pick(r.effects),level:r.effectLevel}]});for(let i=0;i<r.armorCount;i++)items.push({id:makeId('dungeon-armor'),armor:r.armor,rarity:'legendary'});return items;}
