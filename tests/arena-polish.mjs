import assert from 'node:assert/strict';
import {KITS,attackDamage,MELEE,DODGE} from '../dist/combat.js';
import {WEAPONS,ARMORS,weaponStats,armorReduction} from '../dist/progression.js';
import {findAimFocus} from '../dist/aim-focus.js';
import {scrollTrackBox} from '../dist/panel-layout.js';

// Every starter matchup, including the fast and heavy classes, is 4–6 hits.
const matrix=[];
for(const attacker of Object.values(KITS))for(const victim of Object.values(KITS)){
 const damage=attackDamage(WEAPONS.classic.damage,attacker),hits=Math.ceil(victim.health/damage);
 assert(hits>=4&&hits<=6,`${attacker.name} against ${victim.name}: ${hits}`);matrix.push(hits);
}
assert.equal(Math.ceil(KITS.vanguard.health/WEAPONS.classic.damage),5);
const armored=armorReduction({armor:'gold',helmet:'helmet'}),starter=attackDamage(WEAPONS.classic.damage,KITS.vanguard,false,false,armored),upgrade=attackDamage(WEAPONS.gemblade.damage,KITS.vanguard,false,false,armored);
assert(starter<WEAPONS.classic.damage);assert(upgrade>starter);assert(attackDamage(60,KITS.vanguard,false,true)<60);assert.equal(MELEE.hurtWindow,0);assert.equal(weaponStats({weapon:'god',rarity:'legendary'}).damage,9999);

// Hovering is wider than the damage ray, but never locks aim or sees through walls.
const actor=(x,z)=>({alive:true,position:{x,y:0,z}}),origin={x:0,y:1.52,z:0},forward={x:0,y:0,z:-1};
const near=actor(0,-2.6),far=actor(0,-6),edge=actor(.49,-2.6);
assert.equal(findAimFocus([far,near],origin,forward,3.1).actor,near);
assert(findAimFocus([near],origin,forward,3.1).canStrike);
assert(!findAimFocus([far],origin,forward,3.1).canStrike);
assert.equal(findAimFocus([edge],origin,forward,3.1).actor,edge);assert(!findAimFocus([edge],origin,forward,3.1).canStrike);
assert.equal(findAimFocus([near],origin,forward,3.1,()=>true,()=>true),null);
assert.equal(findAimFocus([near],origin,forward,3.1,()=>false),null);
assert.equal(findAimFocus([actor(0,2)],origin,forward,3.1),null);
assert(DODGE.duration<.3&&DODGE.speed>KITS.vanguard.speed*1.47&&DODGE.cooldown>DODGE.duration);

// Scroll tracks fit within transformed frame borders, even on short panels.
let cases=0;
for(const width of [300,360,650,930])for(const height of [80,180,400,700])for(const scale of [.97,1])for(const axis of ['x','y']){
 const border=width<650?14:18,style={borderLeftWidth:border,borderRightWidth:border,borderTopWidth:border,borderBottomWidth:border,paddingLeft:24,paddingRight:24,paddingTop:24,paddingBottom:24};
 const rect={left:30,top:40,right:30+width*scale,bottom:40+height*scale,width:width*scale,height:height*scale};
 const track=scrollTrackBox(rect,axis,style,{modal:true,close:true,scaleX:scale,scaleY:scale});
 assert(track.left>=rect.left+border*scale);assert(track.top>=rect.top+border*scale);
 assert(track.left+track.width<=rect.right-border*scale+.001);assert(track.top+track.height<=rect.bottom-border*scale+.001);cases++;
}
console.log(JSON.stringify({arenaPolish:'passed',starterMatchups:matrix,armoredUpgrade:true,aimOcclusion:true,hoverDoesNotChangeReach:true,scrollbarBounds:cases}));
