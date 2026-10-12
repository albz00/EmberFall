import assert from 'node:assert/strict';
import {HURT_WINDOW,HITBOX,rayHitCandidate,hitCandidate,damageReady,resetMeleeState,updateSprint,releaseSprint,consumeSprintHit,registerMeleeHit,breakCombo,combatKnockback,steerMovement,decayKnockback} from '../dist/combat.js';

const vector=(x=0,y=0,z=0)=>({x,y,z});
const actor=(x=0,z=0)=>{const a={position:vector(x,0,z),velocity:vector(),knock:vector(),grounded:true,hits:0,attempts:0,maxCombo:0};resetMeleeState(a);return a;};
const origin=a=>vector(a.position.x,a.position.y+1.52,a.position.z);
const toward=(a,b,height=.98)=>{const d=vector(b.position.x-a.position.x,b.position.y+height-a.position.y-1.52,b.position.z-a.position.z),len=Math.hypot(d.x,d.y,d.z);return vector(d.x/len,d.y/len,d.z/len);};
function attempt(a,b,time,dir=toward(a,b)){
 a.attempts++;if(rayHitCandidate(origin(a),dir,b.position,3.1)===null||!damageReady(b,time))return false;
 b.lastDirectHit=time;breakCombo(b);a.hits++;a.maxCombo=Math.max(a.maxCombo,registerMeleeHit(a,b,time));
 const sprint=consumeSprintHit(a,time);combatKnockback(b,a,4.5,false,false,sprint);return true;
}
function physics(a,dt){a.position.x+=(a.velocity.x+a.knock.x)*dt;a.position.z+=(a.velocity.z+a.knock.z)*dt;a.velocity.y-=22*dt;a.position.y+=a.velocity.y*dt;if(a.position.y<=0){a.position.y=0;a.velocity.y=0;a.grounded=true;}else a.grounded=false;decayKnockback(a,dt);}

assert.equal(HURT_WINDOW,.5);
const rayOrigin=vector(0,1.52,0),forward=vector(0,0,-1);
assert.notEqual(rayHitCandidate(rayOrigin,forward,vector(0,0,-3.45),3.1),null,'reach ends at the front of the hitbox');
assert.equal(rayHitCandidate(rayOrigin,forward,vector(0,0,-3.48),3.1),null,'no hidden reach extension');
assert.equal(rayHitCandidate(rayOrigin,forward,vector(.6,0,-2.5),3.1),null,'nearby opponents outside crosshair miss');
assert.equal(hitCandidate(rayOrigin,0,0,vector(0,0,2),3.1),null,'opponents behind you miss');
assert.equal(rayHitCandidate(rayOrigin,forward,vector(0,0,-2.5),3.1,HITBOX.crouched),null,'crouched hitboxes are shorter');
assert.notEqual(hitCandidate(rayOrigin,0,-.3,vector(0,0,-2.5),3.1,HITBOX.crouched),null,'aiming down reaches crouched opponents');

function clickWindow(cps){const a=actor(),b=actor(0,3);b.lastDirectHit=-.01;let first=null;for(let n=0;n<cps*5;n++){const t=n/cps;if(damageReady(b,t)){b.lastDirectHit=t;first??=t;a.hits++;}a.attempts++;}return {first,hits:a.hits,attempts:a.attempts};}
const slow=clickWindow(3),quick=clickWindow(9.4),extreme=clickWindow(1000);assert(quick.first<slow.first);assert(quick.attempts>slow.attempts);assert(quick.hits<=10&&extreme.hits<=10,'clicking does not bypass damage immunity');
const a=actor(),b=actor(0,3);a.velocity.z=8;updateSprint(a,true);assert(attempt(a,b,0));const impulse=b.knock.z;assert(impulse>9);assert(!a.sprint.active&&a.sprint.needsReset);assert.equal(updateSprint(a,true),false,'holding forward does not auto-reset sprint');
const bHealthClock=b.lastDirectHit;for(let i=1;i<100;i++)assert(!attempt(a,b,i*.004));assert.equal(b.lastDirectHit,bHealthClock);assert.equal(b.knock.z,impulse,'immune contacts add no knockback');
releaseSprint(a);assert(updateSprint(a,true));a.velocity.z=8;const c=actor(2,3);assert(!attempt(a,c,.5,forward));assert(a.sprint.active,'whiffs do not consume sprint');
const into=actor();into.knock.z=10;steerMovement(into,6.35,-6.35,.1);assert(into.velocity.x>Math.abs(into.velocity.z)*2,'lateral movement remains responsive under knockback');
const normal=actor(0,3),guarded=actor(0,3);combatKnockback(normal,a,4.5,false,false,true);combatKnockback(guarded,a,4.5,false,true,true);assert(guarded.knock.z<normal.knock.z*.5,'blocking creates an escape option');

// Both fighters click independently and use the production raycast, sprint, steering
// and impulse functions. The skilled controller tracks immediately and holds reach;
// its opponent uses delayed aim and either charges or jumps/changes approach.
// Spacing anticipates 150 ms of momentum, with speed capped to the real kit.
export function duelScenario({reset=true,escape=false,tracking=true}={}){
 const a=actor(0,0),b=actor(0,3.38),dt=1/180,history=[];let nextA=0,nextB=.16,tapUntil=0,byaw=Math.PI,bpitch=-.15;
 a.velocity.z=8.3;b.velocity.z=-6.35;
 for(let t=0;t<7;t+=dt){
  const dx=b.position.x-a.position.x,dz=b.position.z-a.position.z,d=Math.hypot(dx,dz),nx=dx/d,nz=dz/d;
  history.push({t,x:a.position.x,y:a.position.y,z:a.position.z});const seen=history[Math.max(0,history.length-1-Math.round(.16/dt))];
  const aim=Math.atan2(seen.x-b.position.x,seen.z-b.position.z),delta=Math.atan2(Math.sin(aim-byaw),Math.cos(aim-byaw));byaw+=delta*(1-Math.exp(-12*dt));bpitch+=(Math.atan2(seen.y+.98-b.position.y-1.52,d)-bpitch)*(1-Math.exp(-12*dt));
  const relative=(b.velocity.x+b.knock.x-a.velocity.x-a.knock.x)*nx+(b.velocity.z+b.knock.z-a.velocity.z-a.knock.z)*nz,predicted=d+relative*.15;
  const moving=predicted>3.5,retreat=predicted<3.4,forwardHeld=moving&&t>=tapUntil;
  const sprint=updateSprint(a,reset?forwardHeld:true),speed=sprint?8.5:6.35,radial=forwardHeld?speed:retreat?-6.35:0,side=Math.sin(t*3.5)*2.3;
  const limit=Math.min(1,speed/Math.hypot(radial,side));steerMovement(a,(nx*radial+nz*side)*limit,(nz*radial-nx*side)*limit,dt);
  const dodging=escape&&t>1,escapeSide=dodging?Math.sign(Math.sin(t*3)):0,advance=dodging?2:6.35;
  if(dodging&&b.grounded){b.velocity.y=7.8;b.grounded=false;}
  steerMovement(b,-nx*advance+nz*escapeSide*6,-nz*advance-nx*escapeSide*6,dt);
  if(t>=nextA){nextA+=1/9.4;if(attempt(a,b,t,tracking?toward(a,b):vector(0,-.15,.9887))&&reset)tapUntil=t+.105;}
  if(t>=nextB){nextB+=1/7.3;const direction=vector(Math.sin(byaw)*Math.cos(bpitch),Math.sin(bpitch),Math.cos(byaw)*Math.cos(bpitch));attempt(b,a,t,direction);}
  physics(a,dt);physics(b,dt);
 }
 return {attackerHits:a.hits,returnHits:b.hits,longestCombo:a.maxCombo,attempts:a.attempts};
}
const combo=duelScenario(),noReset=duelScenario({reset:false}),escape=duelScenario({escape:true}),lostAim=duelScenario({tracking:false});
assert(combo.longestCombo>=3,'good spacing and tracking permit sustained combos');
assert(combo.returnHits>0,'the opponent can land return hits; this is not a permanent stun');
assert(combo.longestCombo>noReset.longestCombo,'sprint resets improve pressure with the same spacing controller');
assert(escape.attackerHits<combo.attackerHits,'changing direction and jumping creates missed attacks');
assert(lostAim.attackerHits<combo.attackerHits/2,'clicking without aim tracking loses the advantage');
const counter=actor(),one=actor(),two=actor();assert.equal(registerMeleeHit(counter,one,0),1);assert.equal(registerMeleeHit(counter,one,.55),2);assert.equal(registerMeleeHit(counter,two,1.1),1,'switching opponents resets the chain');breakCombo(counter);assert.equal(registerMeleeHit(counter,two,1.65),1,'a return hit breaks the chain');assert.equal(registerMeleeHit(counter,two,3),1,'a long spacing gap ends the chain');
console.log(JSON.stringify({classicCombat:'checks passed',clickWindows:{slow,quick,extreme},combo,noReset,escape,lostAim}));
