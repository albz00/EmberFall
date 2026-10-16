import {CRYPT,DUNGEON} from './shared/dungeon-data.js?v=54';
export {CRYPT,DUNGEON};
export const inDungeon=(x,z)=>x<-64;
export const dungeonPoint=p=>({x:CRYPT.origin.x+p.x,y:p.y??0,z:CRYPT.origin.z+p.z});
export function seededRandom(seed){let value=seed>>>0;return()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const depthMultiplier=(kind,depth)=>Math.min(DUNGEON.depthScaling.maximum,1+Math.max(0,depth-1)*DUNGEON.depthScaling[kind]);
const rectContains=(p,x,z,pad=0)=>Math.abs(x-p.x)<=p.w/2-pad&&Math.abs(z-p.z)<=p.d/2-pad;
export function roomContains(room,x,z,pad=0){
 const dx=Math.abs(x-room.x),dz=Math.abs(z-room.z),w=room.w/2-pad,d=room.d/2-pad;
 if(dx>w||dz>d)return false;
 if(room.shape==='cross')return dx<=room.w/4-pad||dz<=room.d/4-pad;
 if(room.shape==='octagon')return dx+dz<=room.w/2+room.d/2-Math.min(room.w,room.d)*.18-pad*1.42;
 return true;
}
function polygon(room){const w=room.w/2,d=room.d/2,c=Math.min(room.w,room.d)*.18;
 const pts=room.shape==='cross'?[[-w,-d/2],[-w/2,-d/2],[-w/2,-d],[w/2,-d],[w/2,-d/2],[w,-d/2],[w,d/2],[w/2,d/2],[w/2,d],[-w/2,d],[-w/2,d/2],[-w,d/2]]:room.shape==='octagon'?[[-w+c,-d],[w-c,-d],[w,-d+c],[w,d-c],[w-c,d],[-w+c,d],[-w,d-c],[-w,-d+c]]:[[-w,-d],[w,-d],[w,d],[-w,d]];
 return pts.map(([x,z])=>({x:x+room.x,z:z+room.z}));
}
const nearestOnSegment=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return{x:a.x+dx*t,z:a.z+dz*t};};
export function generateDungeon(seed,depth=1){
 const rng=seededRandom(seed),pick=xs=>xs[Math.floor(rng()*xs.length)],s=rng()<.5?-1:1,spacing=CRYPT.generation.spacing;
 const paths=[[[0,0],[0,-1],[s,-1],[s,-2],[0,-2],[0,-3]],[[0,0],[s,0],[s,-1],[0,-1],[0,-2],[s,-2],[s,-3]]],path=pick(paths),rooms=[],corridors=[],gates=[],walls=[];
 const themes=['ossuary','library','forge','garden'];for(let i=themes.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[themes[i],themes[j]]=[themes[j],themes[i]];}
 const addRoom=(cell,index,optional=false)=>{
  const final=!optional&&index===path.length-1,elite=!optional&&index===Math.floor(path.length/2),available=['vault','library','garden','forge','ossuary'].filter(id=>!rooms.some(r=>r.theme===id)),theme=optional?pick(available.length?available:['vault']):index===0?'entrance':final?pick(['crown','storm']):elite?'rift':themes[(index-1)%themes.length],t=CRYPT.templates[theme],size=pick(t.sizes);
  const room={id:'room-'+rooms.length,cell:{x:cell[0],z:cell[1]},x:CRYPT.origin.x+cell[0]*spacing,z:CRYPT.origin.z+cell[1]*spacing,...size,shape:t.shape,height:t.height,color:t.color,theme,name:t.name,optional,final,elite,ports:[],props:[],hazards:[],mobs:[],encounter:null};
  room.polygon=polygon(room);if(optional)room.sideCache={x:room.x,y:0,z:room.z-4};
  for(const p of t.props){const prop={...p,x:room.x+p.x*room.w/2,z:room.z+p.z*room.d/2};if(roomContains(room,prop.x,prop.z,Math.max(prop.w,prop.d)/2+.4))room.props.push(prop);}
  for(const h of t.hazards)room.hazards.push({...h,x:room.x+h.x*room.w/2,z:room.z+h.z*room.d/2});
  if(index!==0||optional){const pack=pick(t.packs);for(const [i,type]of pack.entries()){let at;
    for(let attempt=0;attempt<50;attempt++){const a=(i/pack.length)*Math.PI*2+rng()*.7,r=pack.length===1?0:4+rng()*2;at={x:room.x+Math.sin(a)*r,z:room.z+Math.cos(a)*r};if(roomContains(room,at.x,at.z,1)&&!room.props.some(p=>rectContains(p,at.x,at.z,-.8))&&!room.hazards.some(p=>rectContains(p,at.x,at.z,-1)))break;}
    room.mobs.push({type,...at});
   }}rooms.push(room);return room;
 };
 const connect=(a,b)=>{const dx=Math.sign(b.x-a.x),dz=Math.sign(b.z-a.z),horizontal=!!dx,w=CRYPT.generation.corridorWidth;
  const start={x:a.x+dx*a.w/2,z:a.z+dz*a.d/2},end={x:b.x-dx*b.w/2,z:b.z-dz*b.d/2};
  a.ports.push({x:start.x,z:start.z,dx,dz,target:b.id});b.ports.push({x:end.x,z:end.z,dx:-dx,dz:-dz,target:a.id});
  const corridor={x:(start.x+end.x)/2,z:(start.z+end.z)/2,w:horizontal?Math.abs(end.x-start.x)+2:w,d:horizontal?w:Math.abs(end.z-start.z)+2,from:a.id,to:b.id,horizontal,start,end,height:8};corridors.push(corridor);
  gates.push({x:corridor.x,z:corridor.z,w:horizontal?.55:w,d:horizontal?w:.55,h:6.5,unlockRoom:a.id,horizontal});
 };
 path.forEach((cell,i)=>addRoom(cell,i));for(let i=1;i<path.length;i++)connect(rooms[i-1],rooms[i]);
 for(let n=0;n<CRYPT.generation.sideRooms;n++){
  const candidates=[];for(const parent of rooms.slice(1,path.length-1))for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]]){const x=parent.cell.x+dx,z=parent.cell.z+dz;if(Math.abs(x)>2||z>0||z<-3||rooms.some(r=>r.cell.x===x&&r.cell.z===z))continue;const adjacent=rooms.filter(r=>Math.abs(r.cell.x-x)+Math.abs(r.cell.z-z)===1);if(adjacent.length===1)candidates.push({parent,cell:[x,z]});}
  if(!candidates.length)break;const chosen=pick(candidates),r=addRoom(chosen.cell,rooms.length,true);connect(chosen.parent,r);
 }
 const encounters=rooms.filter(r=>r.mobs.length);encounters.forEach((r,i)=>r.encounter=i);
 // Exact polygon walls, with gaps at actual corridor sockets. The same polygons drive collision.
 for(const room of rooms)for(let i=0;i<room.polygon.length;i++){
  const a=room.polygon[i],b=room.polygon[(i+1)%room.polygon.length],length=Math.hypot(b.x-a.x,b.z-a.z),ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;
  const port=room.ports.find(p=>{const q=nearestOnSegment(p,a,b);return Math.hypot(q.x-p.x,q.z-p.z)<.01;});
  if(port){const mid=Math.hypot(port.x-a.x,port.z-a.z),gap=CRYPT.generation.corridorWidth/2;for(const [lo,hi]of [[0,mid-gap],[mid+gap,length]])if(hi-lo>.05)walls.push({a:{x:a.x+ux*lo,z:a.z+uz*lo},b:{x:a.x+ux*hi,z:a.z+uz*hi},height:room.height,room:room.id});}
  else walls.push({a,b,height:room.height,room:room.id});
 }
 for(const c of corridors)for(const side of [-1,1]){const offset=CRYPT.generation.corridorWidth/2;walls.push({a:{x:c.start.x+(c.horizontal?0:offset*side),z:c.start.z+(c.horizontal?offset*side:0)},b:{x:c.end.x+(c.horizontal?0:offset*side),z:c.end.z+(c.horizontal?offset*side:0)},height:c.height,room:null});}
 const entrance=rooms[0],final=rooms.find(r=>r.final),first=entrance.ports[0],spawn={x:entrance.x,y:0,z:entrance.z+3},exit={x:entrance.x,y:0,z:entrance.z+7};
 return{seed:seed>>>0,depth,rooms,encounters,corridors,gates,walls,props:rooms.flatMap(r=>r.props),hazards:rooms.flatMap(r=>r.hazards),spawn,exit,cache:{x:final.x,y:0,z:final.z-6},returnPoint:{x:final.x-6,y:0,z:final.z-8},descendPoint:{x:final.x+6,y:0,z:final.z-8},spawnYaw:Math.atan2(-first.dx,-first.dz),finalRoom:final.id};
}
const fallback=generateDungeon(1);
export function createDungeonRun(seed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0,depth=1){const layout=generateDungeon(seed,depth);return{layout,seed:layout.seed,depth,active:false,encounter:-1,cleared:0,phase:'ready',enemies:[],claimed:false,spells:[],clearedRooms:{[layout.rooms[0].id]:true},sideClaimed:{},pendingRewards:[],enraged:false,summoned:false,nextAttack:0,kills:0,attacks:0};}
export function nextDungeonEncounter(run,position){if(!run.active||run.phase==='fighting'||run.phase==='complete')return null;const room=run.layout.encounters.find(r=>!run.clearedRooms[r.id]&&roomContains(r,position.x,position.z,3));return room?.encounter??null;}
export function dungeonGateClosed(run,index){const gate=(run.layout??fallback).gates[index];return gate?!run.clearedRooms?.[gate.unlockRoom]:false;}
export function dungeonObstacles(run={}){const l=run.layout??fallback;return[...l.props,...l.gates.filter((g,i)=>dungeonGateClosed(run,i))];}
export function dungeonWalkable(x,z,run={}){const l=run.layout??fallback;return l.rooms.some(r=>roomContains(r,x,z))||l.corridors.some(c=>rectContains(c,x,z));}
export function dungeonBlocked(x,z,y=0,padding=.38,run={}){
 if(![[-padding,-padding],[padding,-padding],[-padding,padding],[padding,padding]].every(([dx,dz])=>dungeonWalkable(x+dx,z+dz,run)))return true;
 return dungeonObstacles(run).some(c=>y<c.h-.03&&Math.abs(x-c.x)<c.w/2+padding&&Math.abs(z-c.z)<c.d/2+padding);
}
export function dungeonResolve(p,radius=.38,run={}){
 const l=run.layout??fallback;
 for(let pass=0;pass<3;pass++){
  for(const c of dungeonObstacles(run)){if(p.y>=c.h-.03)continue;const dx=p.x-c.x,dz=p.z-c.z,px=c.w/2+radius-Math.abs(dx),pz=c.d/2+radius-Math.abs(dz);if(px>0&&pz>0){if(px<pz)p.x+=Math.sign(dx||1)*px;else p.z+=Math.sign(dz||1)*pz;}}
  if(dungeonBlocked(p.x,p.z,p.y,radius-.002,run)){
   let best=null,bestD=Infinity;for(const wall of l.walls){const q=nearestOnSegment(p,wall.a,wall.b),dx=wall.b.x-wall.a.x,dz=wall.b.z-wall.a.z,length=Math.hypot(dx,dz);for(const side of [-1,1]){const x=q.x-dz/length*(radius+.03)*side,z=q.z+dx/length*(radius+.03)*side,d=(x-p.x)**2+(z-p.z)**2;if(d<bestD&&!dungeonBlocked(x,z,p.y,radius-.002,run)){best={x,z};bestD=d;}}}
   if(best){p.x=best.x;p.z=best.z;}
  }
 }
 return p;
}
export function dungeonIsLava(x,z,y=0,run={}){return y<.13&&(run.layout??fallback).hazards.some(h=>rectContains(h,x,z));}
export function dungeonLavaDistance(x,z,run={}){return Math.min(100,...(run.layout??fallback).hazards.map(h=>Math.hypot(Math.max(0,Math.abs(x-h.x)-h.w/2),Math.max(0,Math.abs(z-h.z)-h.d/2))));}
export function dungeonGround(x,z,feet=100,run={}){if(dungeonIsLava(x,z,0,run))return-2.4;let h=0;for(const c of (run.layout??fallback).props)if(rectContains(c,x,z)&&feet>=c.h-.35)h=Math.max(h,c.h);return h;}
export function markDungeonKill(run,enemy){
 if(!run.enemies.includes(enemy)||enemy.dungeonCounted)return false;enemy.dungeonCounted=true;run.kills++;
 if(run.phase!=='fighting'||run.enemies.some(f=>f.alive))return false;
 const room=run.layout.encounters[run.encounter];run.clearedRooms[room.id]=true;run.cleared++;run.phase=room.final?'complete':'ready';run.spells.length=0;return true;
}
export function rollDungeonRewards(makeId,random=Math.random){const r=DUNGEON.rewards,items=[],pick=list=>list[Math.min(list.length-1,Math.floor(random()*list.length))];for(let i=0;i<r.weaponCount;i++)items.push({id:makeId('dungeon'),weapon:pick(r.weapons),rarity:'legendary',effects:[{type:pick(r.effects),level:r.effectLevel}]});for(let i=0;i<r.armorCount;i++)items.push({id:makeId('dungeon-armor'),armor:r.armor,rarity:'legendary'});return items;}
