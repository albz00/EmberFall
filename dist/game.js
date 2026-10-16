import {updateBurning} from './burning.js?v=24';
import {makeCharacterPose,restoreCharacterPose,applyCharacterPose} from './character-pose.js?v=24';
import {navigationGoal} from './navigation-recovery.js?v=24';
import {rememberMaterial,restoreMaterial} from './material-state.js?v=24';
import {makeLocomotionLayer,restoreLocomotion,applyLocomotion} from './locomotion-layer.js?v=50';
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneRig} from './vendor/SkeletonUtils.js';
import {buildWorld,makeHeroStage,groundHeight as mainGroundHeight,isLava as mainIsLava,safeZone as mainSafeZone,resolveCollision as mainResolveCollision,blocked as mainBlocked,lineBlocked as mainLineBlocked,lavaDistance as mainLavaDistance} from './world.js?v=50';
import {MAP,MAP_SOURCE} from './shared/map.js?v=50';
import {placeMapProps} from './map-props.js?v=46';
const LEDGE_EXIT=MAP.ledgeExit,PLAYER_SPAWN=MAP.spawns.player,BOT_SPAWN=MAP.spawns.bots;
import {MOVEMENT,movementSpeed,gaitStride,KITS,BOT_PROFILES,MAX_BOTS,botProfile,HURT_WINDOW,HITBOX,hitCandidate,rayHitCandidate,resetMeleeState,releaseSprint,updateSprint,consumeSprintHit,damageReady,registerMeleeHit,breakCombo,combatKnockback,steerMovement,decayKnockback,attackDamage,clickInterval,turnAngle,chooseSteer,planLavaJump,MELEE,BOW,BOTS} from './combat.js?v=50';
import {COSMETICS,purchaseCosmetic,NAMEPLATES,purchaseNameplate,WEAPONS,ARMORS,POTIONS,RARITIES,RANKS,CHARACTERS,CHEST_PRICE,EFFECTS,effectDescription,armorReduction,purchasePotion,consumePotion,cleanName,rankFor,LEVELS_PER_RANK,makeProfile,equippedItem,weaponStats,purchaseWeapon,purchaseArmor,openChest,sellItem,rewardKO,recordDeath,CARRY_SLOTS,HOTBAR_SLOTS,itemKind,itemName,itemArtKey,makeItemId,syncInventory,refillStarterPotions,equipInventoryItem,bindHotbar,addInventoryItem,transferItem,moveInventoryItem,expandStorage,takeDeathItems,sanitizeItem,SPELLS,MATCH_REWARDS,MERCHANT,SHOP_WEAPONS} from './progression.js?v=50';
import {merchantStock,merchantCycle,buyExotic,sanitizeMerchantState,rollProc} from './merchant.js?v=50';
import {bestItem,choosePurchase,transactBot,tacticalGoal,targetScore} from './bot-strategy.js?v=50';
import {botReply,ambientReply} from './bot-chat.js?v=50';
import {GAME_VERSION,CHANGELOG} from './changelog.js?v=51';
import {installScrollbars} from './scrollbars.js?v=28';
import {MINI,TEAM_COLORS,inMiniArena,miniBlocked,miniGround,miniResolve,assignTeams,matchOutcome,buildMiniArena,makeMatchSign} from './duels.js?v=24';
import {fitArmor} from './equipment.js?v=24';
import {rankIcon,drawRankIcon} from './rank-icons.js?v=50';
import {updateCosmetic,disposeCosmetic,cosmeticPreview} from './cosmetics.js?v=50';
import {nameplateNode} from './nameplates.js?v=50';
import {makeHeadLook,restoreHeadLook,bodyFacing,applyHeadLook} from './head-look.js?v=24';

import {DESTINATIONS,isUnderBridge,nearestBridgeCover,streakTier,arrowDamage,createEventState,advanceEvent,EVENT_SCHEDULE,HAZARDS,SUPPLIES} from './arena-events.js?v=50';
import {renderInventoryPanel,slotArt} from './inventory-ui.js?v=50';
import {BackgroundMusic,CaveAmbience,DUEL_TRACKS,LOFI_TRACKS} from './music.js?v=48';
import {ASCENSION,ascensionStrength,createChargeOrb,updateChargeOrb} from './ascension.js?v=24';
import {PRESSURE,pressureStrength,pressureMultiplier} from './spiritual-pressure.js?v=24';
import {HEAVY,chargeProgress,chargedStats,heavyRecovery} from './charged-melee.js?v=50';
import {Ragdolls,restoreImpactPose,triggerImpact,applyImpactPose} from './impact-motion.js?v=24';

const $=id=>document.getElementById(id), canvas=$('game'), touch=matchMedia('(pointer: coarse)').matches;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const profile=makeProfile(read('emberfall.profile.v2',{}),read('emberfall.stats',{}));
const persist=()=>write('emberfall.profile.v2',profile);
const merchantState=sanitizeMerchantState(read('emberfall.merchant.v1',null));let merchant=null;
const settings={sensitivity:50,volume:50,music:30,musicEnabled:true,ambience:35,quality:'high',shake:true,...read('emberfall.settings',{})};
let selectedKit=read('emberfall.kit','vanguard');if(!KITS[selectedKit])selectedKit='vanguard';
let mode='lobby',loaded=false,time=0,last=performance.now(),accumulator=0,uiTimer=0,activeModal=null,shopTab='weapons',menuContext='personal',chestBusy=false,chestResult=null,heroYaw=-.3;
let ascensionSoundAt=0,pressureAtmosphere=0;
const meleeCharge={at:-1,itemId:null},orbCharge={at:-1,itemId:null,latched:false};
let meleeRecoveryUntil=-1,heavySwingPower=0,heldOrb=null;
let cameraStride=0,sprintView=0,lastSprintWhoosh=-10,wasVisualSprint=false,criticalUntil=-10;
let yaw=0,pitch=-.08,shake=0,swingAge=10,blockHeld=false,sprinting=false,walkTime=0,combo=0,lastHit=-10,lastHurt=-20,lastTonic=-20,hitmarkerUntil=0,toastTimer;
let firstPersonSwingSequence=0;
let chatOpen=false,pointerLockFailed=false,lockRequested=false,dragLook=false,returnAt=0,lastCombat=-20,lastFootstep=0,lavaTick=-10,healUntil=0,botChatAt=18;
let inventorySelection=null,currentLoot=null,hotbarSignature='';const lootDrops=[];
let selectedSlot='sword',bowDrawAt=-1,arrowCount=BOW.quiver,arrowRefillAt=0,scorePinned=false,playerAvatar=null,nockedArrow=null,bowString=null;
let arenaEvent=createEventState(0),lastEventTick=0;
let lastCast=-20,potionUsedAt=-20,usedPotion='healing',potionHeld=null;
const buffs={haste:0,guard:0},spellLinks=[];
const duel={phase:'idle',at:0,queue:[],teams:null,winner:null};
const admin={god:false,flying:false,hunt:false};let lastJumpTap=-10,lastChatReply=-10,lastChatBot=null,atmosphereBlend=.2;
$('game-version').textContent='v'+GAME_VERSION;$('changelog-content').innerHTML=CHANGELOG.map(entry=>`<article><h3>v${entry.version}</h3><ul>${entry.changes.map(c=>`<li>${c}</li>`).join('')}</ul></article>`).join('');
let thirdPerson=read('emberfall.thirdPerson',false),crouchBlend=0,crouchTouch=false,cameraDistance=4.4;
const cameraRay=new THREE.Raycaster();
const pumpkins=[],projectiles=[],hazardMarks=[],supplyDrops=[],volcanoes=[],cameraObstacles=[],mapCrates=[],killFeed=[];
const V3=THREE.Vector3,keys=new Set(),models={},thumbs={},fighters=[],messages=[],clickTimes=[],pendingChats=[],rings=[];
// Bots, the ledge exit and returns share the surface height under the player spawn, as the map validator requires.
const LEDGE_HEIGHT=mainGroundHeight(PLAYER_SPAWN.x,PLAYER_SPAWN.z);
const player={position:new V3(PLAYER_SPAWN.x,LEDGE_HEIGHT,PLAYER_SPAWN.z),velocity:new V3(),knock:new V3(),grounded:true,crouched:false,health:KITS[selectedKit].health,maxHealth:KITS[selectedKit].health,kills:0,deaths:0,streak:0,runKills:0,potions:3,lastDamage:-20,lastImpact:-20,jumps:0,effects:{},slowUntil:0};
const freecam={active:false,position:new V3(),yaw:0,pitch:0};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x514954);scene.fog=new THREE.FogExp2(0x514954,.014);
const calmFog=new THREE.Color(0x514954),bloodFog=new THREE.Color(0x5c303d);
const camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.06,140);camera.rotation.order='YXZ';
let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){fatal('WebGL is unavailable. Enable hardware acceleration and reload.');throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=THREE.SRGBColorSpace;
const miniArena=buildMiniArena(scene),matchSign=makeMatchSign(scene);
const world=buildWorld(scene),heroScene=new THREE.Scene(),heroCamera=new THREE.PerspectiveCamera(33,1,.1,30);makeHeroStage(heroScene);heroCamera.position.set(2.6,1.9,5.6);heroCamera.lookAt(0,.93,0);let hero=null;
const weaponScene=new THREE.Scene(),weaponCamera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.02,10),weaponPivot=new THREE.Group(),heldGroup=new THREE.Group();weaponScene.add(weaponPivot);weaponPivot.add(heldGroup);weaponScene.add(new THREE.HemisphereLight(0xffeacb,0x756073,3));const keyLight=new THREE.DirectionalLight(0xffffff,3);keyLight.position.set(-2,3,4);weaponScene.add(keyLight);
const trail=new THREE.Mesh(new THREE.TorusGeometry(.65,.035,4,24,1.7),new THREE.MeshBasicMaterial({color:0xffdfb1,transparent:true,opacity:0,depthTest:false}));trail.position.set(.1,-.12,-1.2);trail.rotation.set(.9,.1,.4);weaponScene.add(trail);
const ragdolls=new Ragdolls(scene,groundHeight,resolveCollision);
const correction=new THREE.Quaternion().setFromAxisAngle(new V3(0,0,1),Math.PI/4);
const stationAt=type=>new V3(MAP.stations[type].x,mainGroundHeight(MAP.stations[type].x,MAP.stations[type].z),MAP.stations[type].z);
const stations=[{type:'match',name:'2v2 · Join match',position:stationAt('match')},{type:'weapons',name:'Equipment',position:stationAt('weapons')},{type:'chest',name:'Chest',position:stationAt('chest')},{type:'potions',name:'Potions',position:stationAt('potions')},{type:'merchant',name:MERCHANT.name,position:stationAt('merchant')}];let chestLid=null,chestBaseRotation=0,chestLidUntil=0,currentStation=null;
const touchMove={x:0,z:0};

function isDueling(){return duel.phase!=='idle';}
function groundHeight(x,z,feet=100){return inMiniArena(x,z)?miniGround(x,z,feet):mainGroundHeight(x,z,feet);}
function isLava(x,z,y=0){return inMiniArena(x,z)?false:mainIsLava(x,z,y);}
function lavaDistance(x,z){return inMiniArena(x,z)?100:mainLavaDistance(x,z);}
function safeZone(p){return inMiniArena(p.x,p.z)?duel.phase!=='active':mainSafeZone(p);}
function resolveCollision(p,r=.38,h=1.7){return inMiniArena(p.x,p.z)?miniResolve(p,r):mainResolveCollision(p,r,h);}
function blocked(x,z,y=0,padding=.6){return inMiniArena(x,z)?miniBlocked(x,z,y,padding):mainBlocked(x,z,y,padding);}
function lineBlocked(a,b){
 if(inMiniArena(a.x,a.z)!==inMiniArena(b.x,b.z))return true;
 if(!inMiniArena(a.x,a.z))return mainLineBlocked(a,b);
 const length=a.distanceTo? a.distanceTo(b):Math.hypot(a.x-b.x,a.z-b.z);for(let d=.3;d<length;d+=.3){const t=d/length;if(miniBlocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,a.y+(b.y-a.y)*t,.05))return true;}return false;
}
function canHit(owner,target){
 if(owner===target||inMiniArena(owner.position.x,owner.position.z)!==inMiniArena(target.position.x,target.position.z))return false;
 if(owner.team||target.team)return duel.phase==='active'&&!!owner.team&&!!target.team&&owner.team!==target.team;
 return !(admin.hunt&&owner!==player&&target!==player);
}
function ensureMatchQueue(){
 if(duel.queue.length===3)return;
 const start=Math.floor(time/13)%fighters.length,selected=[0,3,6].map(offset=>fighters[(start+offset)%fighters.length]);duel.queue=selected;duel.queueUntil=time+24;
 selected.forEach((f,i)=>{spawnFighter(f,true);f.signup=i;f.state='signup';f.target=null;f.signupUntil=duel.queueUntil;});
}
function openMatches(){
 if(isDueling()){toast('Finish this match first');return;}
 if(mode==='play'&&!mainSafeZone(player.position)){toast('Use the 2v2 sign on the ledge');return;}
 ensureMatchQueue();openModal('match');
 $('match-roster').innerHTML=[{name:profile.name,rating:profile.rating,you:true},...duel.queue].map(a=>`<div class="match-player">${rankIcon(rankFor(a.rating))}<strong>${a.name}</strong><span>${a.you?'You':a.role==='archer'?'Bow':a.role==='ranger'?'Staff':'Melee'}</span></div>`).join('');
}
function updateSignup(f,dt){
 if(time>f.signupUntil&&duel.phase==='idle'){f.signup=null;f.state='spawn';duel.queue=[];return;}
 const goal={x:(f.signup-1)*1.75,y:8,z:29.3},d=Math.hypot(goal.x-f.position.x,goal.z-f.position.z);
 if(d>.3){const direction=chooseSteer(f.position,goal,blocked,()=>false,time,f.id);f.velocity.x=direction.x*MOVEMENT.shop;f.velocity.z=direction.z*MOVEMENT.shop;f.aimAngle=turnAngle(f.aimAngle,Math.atan2(direction.x,direction.z),dt*7);animateActor(f,'WalkFormal');}
 else{f.velocity.x=f.velocity.z=0;f.aimAngle=Math.PI;animateActor(f,time<(f.talkUntil??0)?'Talk':'StanceAlt');}
 actorPhysics(f,dt);f.healthBg.quaternion.copy(camera.quaternion);
}
function joinMatch(){
 if(isDueling())return;setFreecam(false,false);ensureMatchQueue();duel.phase='assembling';duel.at=time+4;duel.teams=assignTeams(player,duel.queue);duel.winner=null;duel.startedAt=time;admin.god=admin.flying=admin.hunt=false;keys.clear();
 for(const f of duel.queue)f.signupUntil=Infinity;
 if(mode==='lobby'){startGame(false);duel.phase='assembling';duel.at=time+4;}else resume();
 chatSystem('2v2 signed up: '+duel.queue.map(f=>f.name).join(', ')+'.');music?.use(DUEL_TRACKS);updateDuelHud();
}
function clearDuelShots(){for(const shot of projectiles)if(shot.owner===player||duel.queue.includes(shot.owner))shot.life=0;}
function teleportMatch(){
 clearDuelShots();resetPlayer();const teams=duel.teams;duel.phase='countdown';duel.at=time+3;
 for(const [team,actors]of Object.entries(teams))for(const [i,a]of actors.entries()){
  if(a!==player){spawnFighter(a);a.signup=null;a.state='fight';a.purchase=null;a.shopComplete=true;a.target=null;a.planUntil=0;}
  resetMeleeState(a);a.team=team;a.position.set(MINI.x+(i?2:-2),0,team==='blue'?9.5:-9.5);a.velocity.set(0,0,0);a.knock.set(0,0,0);a.grounded=true;a.jumps=0;a.effects={};a.poison=null;a.slowUntil=0;
  if(a!==player){a.aimAngle=team==='blue'?Math.PI:0;a.rig.rotation.y=a.aimAngle;a.animator.look.bodyYaw=a.aimAngle;animateActor(a,a.stats.kind==='staff'?'CastIdle':'Idle_Sword');}
 }
 yaw=0;pitch=-.04;player.maxHealth=KITS[selectedKit].health;arrowCount=BOW.quiver;lastCombat=time-20;returnAt=0;$('pause-spawn').textContent='Leave match';
 chatSystem('Your teammate is '+teams.blue.find(a=>a!==player).name+'. Red team: '+teams.red.map(a=>a.name).join(' and ')+'.');updateDuelHud();
}
function finishMatch(winner,forfeit=false){
 if(duel.phase==='result'||duel.phase==='idle')return;
 if(duel.phase==='assembling'){leaveMatch();return;}
 duel.phase='result';duel.winner=winner;duel.forfeit=forfeit;duel.at=time+(forfeit?1:5);clearDuelShots();keys.clear();blockHeld=false;
 for(const [team,actors]of Object.entries(duel.teams))for(const a of actors){
  a.effects={};a.poison=null;a.slowUntil=0;a.velocity.set(0,0,0);a.knock.set(0,0,0);
  if(forfeit)continue;const account=a===player?profile:a.account,won=team===winner;const reward=MATCH_REWARDS[winner==='draw'?'draw':won?'win':'loss'];account.coins+=reward.coins;account.rating+=reward.points;
  if(a!==player)a.rating=account.rating;
 }
 if(!forfeit){profile.duels.played++;if(winner==='blue')profile.duels.wins++;else if(winner==='red')profile.duels.losses++;}
 persist();updateProfileUI();updateDuelHud();if(winner==='blue'&&!forfeit)sound('ko');
}
function leaveMatch(){
 const participants=[...duel.queue];clearDuelShots();player.team=null;duel.phase='idle';duel.queue=[];duel.teams=null;duel.winner=null;
 for(const f of participants){f.team=null;f.signup=null;spawnFighter(f);f.label.material.map.dispose();f.label.material.map=nameTexture(f.name,f.rating);}
 for(const f of fighters){f.target=null;f.targetUntil=0;}
 $('duel-hud').classList.add('hidden');$('duel-banner').classList.add('hidden');$('pause-spawn').textContent='Return to ledge';
 if(mode==='play'||mode==='pause'){mode='play';closeAll();completeReturn();player.health=KITS[selectedKit].health;updateHud();}music?.use(LOFI_TRACKS);
}
function updateDuel(dt){
 if(duel.phase==='idle')return;
 if(duel.phase==='assembling'&&time>=duel.at)teleportMatch();
 else if(duel.phase==='countdown'&&time>=duel.at){duel.phase='active';duel.at=time+MINI.duration;duel.startedAt=time;for(const f of duel.queue){f.lastImpact=time;f.nextClick=time+f.skill.reaction;f.nextArrow=time+.4;f.nextJump=time+.3;}chatSystem('2v2 started. Friendly fire is off.');}
 else if(duel.phase==='active'){const result=matchOutcome(duel.teams,player,time>=duel.at);if(result)finishMatch(result);}
 else if(duel.phase==='result'&&time>=duel.at)leaveMatch();
 updateDuelHud();
}
function updateDuelHud(){
 const active=isDueling();$('duel-hud').classList.toggle('hidden',!active);if(!active){$('duel-banner').classList.add('hidden');return;}
 const names=team=>duel.teams[team].map(a=>(a===player?profile.name:a.name)+((a===player?a.health>0:a.alive)?'':' ×')).join(' · ');
 $('duel-blue').textContent=names('blue');$('duel-red').textContent=names('red');const seconds=Math.max(0,Math.ceil(duel.at-time));$('duel-clock').textContent=duel.phase==='active'?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'2v2';
 const banner=$('duel-banner');banner.classList.toggle('hidden',duel.phase==='active'&&player.health>0);
 if(duel.phase==='assembling')banner.textContent='Match starts in '+seconds;
 else if(duel.phase==='countdown')banner.textContent=seconds||'Fight';
 else if(duel.phase==='result')banner.textContent=duel.forfeit?'Match forfeited':duel.winner==='blue'?'Victory · +80 coins · +25 EXP':duel.winner==='red'?'Red team wins · +20 coins · +5 EXP':'Draw · +35 coins · +10 EXP';
 else if(player.health<=0)banner.textContent='Eliminated · watching your teammate';
}
$('join-match').addEventListener('click',joinMatch);

// Shared instanced particles keep impact effects inexpensive even during fast clicking.
const fxGeometry=new THREE.TetrahedronGeometry(1),fxMaterial=new THREE.MeshBasicMaterial({color:0xffffff}),fxMesh=new THREE.InstancedMesh(fxGeometry,fxMaterial,420),fx=[];
fxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fxMesh.frustumCulled=false;fxMesh.count=0;scene.add(fxMesh);const dummy=new THREE.Object3D();
function burst(position,color=0xffd58a,count=12,force=1,owner=null){for(let i=0;i<count&&fx.length<420;i++)fx.push({owner,p:position.clone(),v:new V3((Math.random()-.5)*5*force,(Math.random()*4+.5)*force,(Math.random()-.5)*5*force),life:.25+Math.random()*.45,size:.025+Math.random()*.045,color:new THREE.Color(color),seed:Math.random()*10});}
function shockwave(position,color=0xffd087,owner=null){const mesh=new THREE.Mesh(new THREE.RingGeometry(.7,.85,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(position);mesh.position.y+=.05;scene.add(mesh);rings.push({mesh,life:.4,owner});}
function updateFX(dt){
 for(let i=spellLinks.length-1;i>=0;i--){const link=spellLinks[i];link.life-=dt;link.mesh.material.opacity=Math.max(0,link.life/.22);if(link.life<=0){scene.remove(link.mesh);link.mesh.geometry.dispose();link.mesh.material.dispose();spellLinks.splice(i,1);}}
 for(let i=fx.length-1;i>=0;i--){const p=fx[i];p.life-=dt;if(p.life<=0){fx.splice(i,1);continue;}p.p.addScaledVector(p.v,dt);p.v.y-=8*dt;}
 let visible=0;for(const p of fx){if(p.owner===player&&!thirdPerson&&!freecam.active)continue;dummy.position.copy(p.p);dummy.rotation.set(time*4+p.seed,time*3,0);dummy.scale.setScalar(p.size*Math.min(1,p.life*6));dummy.updateMatrix();fxMesh.setMatrixAt(visible,dummy.matrix);fxMesh.setColorAt(visible,p.color);visible++;}fxMesh.count=visible;fxMesh.instanceMatrix.needsUpdate=true;if(fxMesh.instanceColor)fxMesh.instanceColor.needsUpdate=true;
 for(let i=critEffects.length-1;i>=0;i--){const e=critEffects[i];e.life-=dt;e.mesh.quaternion.copy(camera.quaternion);e.mesh.rotateZ(e.life*.7);e.mesh.scale.setScalar(1+(1-e.life/.36)*.45);e.mesh.material.opacity=Math.max(0,e.life/.36);if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();critEffects.splice(i,1);}}
 for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.mesh.visible=r.owner!==player||thirdPerson||freecam.active;r.life-=dt;r.mesh.scale.setScalar(1+(1-r.life/.4)*3);r.mesh.material.opacity=Math.max(0,r.life/.4)*.55;if(r.life<=0){scene.remove(r.mesh);r.mesh.geometry.dispose();r.mesh.material.dispose();rings.splice(i,1);}}
}

let audioCtx=null,master=null,music=null,ambience=null;
function initAudio(){
 if(!music)music=new BackgroundMusic(LOFI_TRACKS,settings.music/100*settings.volume/100,globalThis.Audio,musicStatus);music.setVolume(settings.music/100*settings.volume/100);if(settings.musicEnabled)music.start();
 if(audioCtx){audioCtx.resume().catch(()=>{});return;}try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();master=audioCtx.createGain();master.gain.value=settings.volume/100*.58;master.connect(audioCtx.destination);ambience=new CaveAmbience(audioCtx,master);ambience.setVolume(settings.ambience/100);audioCtx.resume().catch(()=>{});}catch{}
}
function sound(type){if(!audioCtx||audioCtx.state==='suspended')return;const now=audioCtx.currentTime,variation=.92+Math.random()*.16;if(['hit','heavy','critical','hurt','block','arrow','magic','ko','warning'].includes(type)){ambience?.duck(type==='warning'?1.2:.65);music?.duck(type==='warning'?.8:.3);}
 const tone=(freq,dur,volume,wave='triangle',end=freq)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=wave;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(1,end),now+dur);g.gain.setValueAtTime(volume,now);g.gain.exponentialRampToValueAtTime(.001,now+dur);o.connect(g);g.connect(master);o.start(now);o.stop(now+dur);o.onended=()=>{o.disconnect();g.disconnect();};};
 const noise=(dur,vol,cutoff)=>{const buffer=audioCtx.createBuffer(1,Math.ceil(audioCtx.sampleRate*dur),audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const n=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();n.buffer=buffer;f.type='lowpass';f.frequency.value=cutoff;g.gain.value=vol;n.connect(f);f.connect(g);g.connect(master);n.start(now);n.onended=()=>{n.disconnect();f.disconnect();g.disconnect();};};
 if(type==='heavy'){noise(.16,.38,2600);tone(75,.24,.36,'triangle',26);tone(1300,.06,.08,'sine',640);}else if(type==='charge-ready'){tone(560,.12,.07,'sine',920);}else if(type==='orb'){tone(62,.6,.07,'sine',100);noise(.2,.04,4300);}else if(type==='ascension'){noise(.85,.055,460);tone(54,.75,.055,'sine',38);}else if(type==='sprint'){noise(.12,.07,2200);tone(95,.12,.035,'sine',150);}else if(type==='sprint-stop'){noise(.065,.04,1000);}else if(type==='magic'){tone(340,.22,.12,'sine',1150);tone(680,.15,.05,'triangle',260);noise(.12,.06,5000);}else if(type==='swing'){noise(.065,.2,3200*variation);tone(170*variation,.06,.035,'triangle',70);}else if(type==='hit'||type==='critical'){const force=type==='critical'?1.2:1;noise(.013,.3*force,7200);noise(.075,.5*force,2650*variation);tone(128*variation,.115,.43*force,'triangle',46);tone(1070*variation,.14,.09,'sine',890*variation);tone(1783*variation,.085,.038,'sine',1620*variation);if(type==='critical'){tone(65,.17,.2,'sine',36);tone(1950,.075,.13,'triangle',800);noise(.023,.22,6200);}}else if(type==='clang'){noise(.023,.13,4400);tone(1110*variation,.095,.08,'sine',990*variation);}else if(type==='hurt'){noise(.085,.36,1900*variation);tone(95*variation,.16,.39,'triangle',32);noise(.012,.17,5200);}else if(type==='block'){noise(.035,.32,5800);tone(970*variation,.21,.19,'sine',880);tone(1640*variation,.14,.09,'sine',1550);tone(280,.06,.13,'triangle',120);}else if(type==='ko'||type==='buy'){tone(520,.12,.18);setTimeout(()=>tone(780,.2,.1),80);setTimeout(()=>tone(1040,.23,.08),140);}else if(type==='tonic'){tone(370,.3,.17,'sine',1000);noise(.2,.07,3000);}else if(type==='land'){noise(.12,.18,400);tone(60,.08,.08,'triangle',30);}else if(type==='step'){const quiet=player.crouched?.35:1,wood=player.position.y>2;noise(wood?.06:.085,(wood?.22:.25)*quiet,wood?900:1500);tone(wood?130+Math.random()*35:80+Math.random()*30,.045,(wood?.07:.045)*quiet,'triangle',45);}else if(type==='lava'){noise(.18,.22,2500);}else if(type==='jump'){noise(.07,.055,1300);}else if(type==='arrow'){noise(.1,.23,4200);tone(460,.09,.07,'triangle',150);}else if(type==='warning'){tone(330,.45,.18,'sine',440);setTimeout(()=>tone(330,.5,.13,'sine',440),450);}else if(type==='rumble'){noise(.9,.5,200);tone(45,.7,.13,'sine',25);}else if(type==='chest'){tone(90,.6,.19,'sawtooth',700);noise(.3,.15,700);}}
function fatal(message){$('fatal').classList.remove('hidden');$('fatal-message').textContent=message;}
function toast(text,duration=1800){$('toast').textContent=text;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,duration);}
function updateSettings(){write('emberfall.settings',settings);if(master)master.gain.value=settings.volume/100*.58;if(music)music.setVolume(settings.music/100*settings.volume/100);if(ambience)ambience.setVolume(settings.ambience/100);$('ambience-value').textContent=settings.ambience+'%';$('music-value').textContent=settings.music+'%';const high=settings.quality==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.75:1));renderer.shadowMap.enabled=high;world.setQuality(high);$('sensitivity-value').textContent=settings.sensitivity+'%';$('volume-value').textContent=settings.volume+'%';}
function musicStatus(state){
 const title=music?.label?.()??'Lofi';$('music-status').textContent=({idle:'Lofi',connecting:'Starting…',playing:title,blocked:'Press Play music to start',unavailable:'Music file unavailable',paused:'Music paused'})[state]??title;
 $('music-preview').textContent=state==='playing'?'Pause music':state==='unavailable'?'Retry music':'Play music';
}
$('music-preview').addEventListener('click',()=>{
 if(music&&['playing','connecting'].includes(music.status)){settings.musicEnabled=false;music.pause();}
 else{settings.musicEnabled=true;if(settings.music===0){settings.music=30;$('music').value=30;}if(!music)initAudio();else music.start(true);}
 updateSettings();
});
for(const key of ['sensitivity','volume','music','ambience']){$(key).value=settings[key];$(key).addEventListener('input',e=>{settings[key]=Number(e.target.value);updateSettings();});}
$('quality').value=settings.quality;$('quality').addEventListener('change',e=>{settings.quality=e.target.value;updateSettings();});$('screen-shake').checked=settings.shake;$('screen-shake').addEventListener('change',e=>{settings.shake=e.target.checked;updateSettings();});updateSettings();

function prepareModel(model){model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.material){const clone=m=>{const n=m.clone();if(n.transparent)n.depthWrite=false;else if('roughness'in n)n.roughness=.82;return rememberMaterial(n);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}}});return model;}
function makeWeapon(item){
 const model=prepareModel(models[WEAPONS[item.weapon].file].scene.clone(true));model.userData.weapon=item.weapon;model.userData.itemId=item.id;
 model.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(item.weapon==='god'){
   const grip=m.name==='DarkWood',gold=['DarkSteel','LightWood'].includes(m.name);
   m.color?.setHex(grip?0x352a48:gold?0xffcc5b:0xfff2cc);if(m.emissive){m.emissive.setHex(grip?0x322450:gold?0xffa832:0xffe8a0);m.emissiveIntensity=grip?.12:gold?.32:.66;}m.metalness=grip?.15:.75;m.roughness=grip?.65:.27;
  }else if(WEAPONS[item.weapon].proc){if(m.emissive){m.emissive.setHex(WEAPONS[item.weapon].proc.color);m.emissiveIntensity=.2;}
  }else if(item.rarity!=='common'&&m.emissive){m.emissive.setHex(RARITIES[item.rarity].hex);m.emissiveIntensity=item.rarity==='legendary'?.42:.25;}
  rememberMaterial(m);
 }});return model;
}
function makeAnimator(rig,animations){const mixer=new THREE.AnimationMixer(rig),actions={};for(const clip of animations)actions[clip.name]=mixer.clipAction(clip);actions.Idle_Sword?.play();const wrist=rig.getObjectByName('WristR');return{mixer,actions,wrist,baseWrist:wrist?.quaternion.clone(),look:makeHeadLook(rig),pose:makeCharacterPose(),gait:makeLocomotionLayer(rig,animations),corrected:false,currentAction:'Idle_Sword'};}
function updateAnimator(actor,dt){
 restoreImpactPose(actor);const a=actor.animator;restoreCharacterPose(a.pose);restoreHeadLook(a.look);restoreLocomotion(a.gait);if(a.corrected&&a.wrist)a.wrist.quaternion.copy(a.baseWrist);a.mixer.update(dt);
 const locomotor=actor===playerAvatar?player:actor;if(actor!==hero)applyLocomotion(actor.rig,a.gait,locomotor,dt,{flying:actor===playerAvatar&&admin.flying,disabled:locomotor.alive===false||['Roll','Death','DeathAlt','Dance'].includes(a.currentAction),attack:time<(actor.animUntil??0),time});
 if(a.wrist){a.baseWrist.copy(a.wrist.quaternion);a.wrist.quaternion.multiply(correction);a.corrected=true;}
 const human=actor===playerAvatar,lobby=actor===hero,physical=human?player:actor;
 const gazeYaw=human?yaw+Math.PI:lobby?heroYaw+Math.sin(time*.4)*.34:actor.aimAngle??actor.rig.rotation.y;
 let gazePitch=human?pitch:lobby?Math.sin(time*.31)*.09:0;
 if(!human&&!lobby&&actor.target?.position){const target=actor.target,flat=Math.hypot(target.position.x-actor.position.x,target.position.z-actor.position.z);gazePitch=Math.atan2(target.position.y-actor.position.y-(target.crouched?.5:0),Math.max(.25,flat));}
 const active=(human?player.health>0:actor.alive!==false)&&!['Roll','Death','DeathAlt','Dance'].includes(a.currentAction);
 if(lobby)actor.rig.rotation.y=heroYaw;else if(active)actor.rig.rotation.y=bodyFacing(a.look,gazeYaw,physical.velocity,dt,human?swingAge<.3||blockHeld:time-actor.lastSwing<.3||actor.guard);
 applyCharacterPose(actor.rig,a.pose,physical,dt,{flying:human&&admin.flying,blocking:human?blockHeld:actor.guard,attacking:time<(actor.animUntil??0),disabled:!active||lobby||physical.crouched||(human?selectedSlot==='bow'||selectedSlot==='orb'||WEAPONS[equippedItem(profile).weapon].kind==='staff':actor.combatMode==='bow'||actor.stats?.kind==='staff'),armed:human?selectedSlot==='sword':actor.combatMode!=='bow',time,gaitPhase:a.gait.phase});
 applyHeadLook(actor.rig,a.look,gazeYaw,gazePitch,dt,active);if(!human&&!lobby&&actor.alive)applyImpactPose(actor,actor,time);
}
function animateActor(actor,name,once=false,speed=1){const a=actor.animator;if(a.currentAction===name&&!once){a.actions[name]?.setEffectiveTimeScale(speed);return;}const action=a.actions[name]||a.actions.Idle_Sword;if(!action)return;const previous=a.actions[a.currentAction];if(previous&&previous!==action)previous.fadeOut(.065);action.reset().setEffectiveTimeScale(speed).setEffectiveWeight(1).fadeIn(.06);action.clampWhenFinished=once;action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity).play();a.currentAction=name;}
function attackAnimation(actor,duration=.2){
 actor.swingSequence=(actor.swingSequence??0)+1;
 const name=actor.animator.actions.StrikeAlt&&actor.swingSequence%3===0?'StrikeAlt':'Sword_Slash',clip=actor.animator.actions[name]?.getClip();
 animateActor(actor,name,true,(clip?.duration??1)/duration);actor.animUntil=time+duration;
}
function locomotion(actor,visual,moving,sprint=false){
 let clip='Idle_Sword';const staff=actor===player?selectedSlot==='sword'&&WEAPONS[equippedItem(profile).weapon].kind==='staff':actor.stats?.kind==='staff';
 if(actor===player&&admin.flying)clip='Idle_Sword';
 else if(!actor.grounded)clip=actor.velocity.y>4.8?'Jump_Start':'Jump_Loop';
 else if(actor.crouched)clip=moving?'CrouchWalk':'CrouchIdle';
 else if(moving){
  clip=sprint?'Sprint':Math.hypot(actor.velocity.x,actor.velocity.z)<3.45?'Walk':'Run';
  const heading=actor===player?yaw+Math.PI:actor.aimAngle??0,forward=actor.velocity.x*Math.sin(heading)+actor.velocity.z*Math.cos(heading),side=actor.velocity.x*Math.cos(heading)-actor.velocity.z*Math.sin(heading),speed=Math.hypot(actor.velocity.x,actor.velocity.z);
  if(!sprint&&forward<-speed*.45&&visual.animator.actions.Run_Back)clip='Run_Back';
  else if(!sprint&&Math.abs(side)>speed*.7&&visual.animator.actions.Run_Left)clip=side>0?'Run_Left':'Run_Right';
 }else if(time<(visual.talkUntil??0))clip='Talk';else if(actor.combatMode==='bow')clip='Idle_Gun';else if(staff)clip='CastIdle';
 if(!visual.animator.actions[clip])clip=moving?'Run':'Idle_Sword';
 if(clip==='Jump_Start'){if(visual.animator.currentAction!==clip)animateActor(visual,clip,true,2.5);}
 else animateActor(visual,clip,false,actor.crouched?.95:sprint?1.1:1);
}
function animationAsset(file){return file.startsWith('fighter-')?'quaternius-fighter-animations.glb':'quaternius-'+file.replace('.glb','')+'-animations.glb';}
function installQuaterniusAnimations(){
 const aliases={Sword_Idle:'Idle_Sword',Walk_Loop:'Walk',Jog_Fwd_Loop:'Run',Sprint_Loop:'Sprint',Jump_Start:'Jump_Start',Jump_Loop:'Jump_Loop',Jump_Land:'Jump_Land',Sword_Attack:'Sword_Slash',Hit_Chest:'HitRecieve',Crouch_Fwd_Loop:'CrouchWalk',Crouch_Idle_Loop:'CrouchIdle',Dance_Loop:'Dance',Death01:'Death',Hit_Head:'HitHead',Idle_Talking_Loop:'Talk',Interact:'Interact',PickUp_Table:'Pickup',Roll:'Roll',Spell_Simple_Enter:'CastEnter',Spell_Simple_Exit:'CastExit',Spell_Simple_Idle_Loop:'CastIdle',Spell_Simple_Shoot:'Cast',Walk_Formal_Loop:'WalkFormal'};
 for(const character of [...Object.values(CHARACTERS),{name:MERCHANT.name,file:MERCHANT.file}]){
  const template=models[character.file],source=models[animationAsset(character.file)].animations;
  for(const [original,name]of [['Sword_Slash','StrikeAlt'],['Death','DeathAlt'],['Idle_Sword','StanceAlt']]){const originalClip=template.animations.find(c=>c.name===original);if(originalClip){const saved=originalClip.clone();saved.name=name;template.animations.push(saved);}}
  for(const [original,name]of Object.entries(aliases)){const animation=source.find(c=>c.name===original);if(!animation)throw new Error('Missing Quaternius animation: '+original);let clip=animation.clone();if(original==='Jump_Start')clip=THREE.AnimationUtils.subclip(clip,name,3,15,30);if(original==='Jump_Land')clip=THREE.AnimationUtils.subclip(clip,name,0,12,30);if(original==='Sword_Attack')clip=THREE.AnimationUtils.subclip(clip,name,5,30,30);for(const track of clip.tracks){const node=THREE.PropertyBinding.parseTrackName(track.name).nodeName;if(!template.scene.getObjectByName(node))throw new Error('Animation binding missing on '+character.name+': '+node);}clip.name=name;clip.userData={source:'Quaternius Universal Animation Library Standard'};template.animations=template.animations.filter(c=>c.name!==name);template.animations.push(clip);}
 }
}
function attachGear(rig,item,armorKey,helmetKey='none'){
 const old=[];rig.traverse(o=>{if(o.userData.equipment)old.push(o);});old.forEach(o=>o.removeFromParent());
 const wrist=rig.getObjectByName('WristR');if(wrist){const weapon=makeWeapon(item);weapon.userData.equipment=true;weapon.userData.slot='sword';weapon.position.set(0,.07,0);weapon.rotation.z=Math.PI/2;wrist.add(weapon);}
 for(const key of [armorKey,helmetKey]){const data=ARMORS[key];if(!data?.file||!models[data.file])continue;const armor=prepareModel(models[data.file].scene.clone(true));armor.userData.asset=data.file;
  if(data.fit){if(data.fit==='head')armor.rotation.y=Math.PI;fitArmor(armor,rig,data.fit);}
  else{armor.userData.equipment=true;armor.userData.armor=true;armor.position.set(-.0046076,-.1278487,.028659);armor.quaternion.set(-.0676475,.00223166,-.00108543,.9977062);rig.getObjectByName('Chest')?.add(armor);}
 }
}
function setHero(){if(!loaded)return;if(hero){disposeCosmetic(hero);heroScene.remove(hero.rig);hero.animator.mixer.stopAllAction();hero.animator.mixer.uncacheRoot(hero.rig);disposeMaterials(hero.rig);}const template=models[CHARACTERS[profile.character].file],rig=prepareModel(cloneRig(template.scene));rig.rotation.y=heroYaw;heroScene.add(rig);hero={rig,root:rig,preview:true,animator:makeAnimator(rig,template.animations),gestureAt:time+4};attachGear(rig,equippedItem(profile),profile.armor,profile.helmet);$('character-name').textContent=CHARACTERS[profile.character].name;}
function disposeMaterials(root){root?.traverse(o=>{if(o.userData.ownedGeometry)o.geometry?.dispose();if(o.isMesh||o.isLine)for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});}
function refreshEquipment(){if(!loaded)return;disposeMaterials(heldGroup);bowString?.geometry.dispose();heldGroup.clear();const item=equippedItem(profile),weapon=makeWeapon(item);weapon.scale.setScalar(WEAPONS[item.weapon].kind==='staff'?.72:.83);weapon.rotation.y=WEAPONS[item.weapon].kind==='staff'?0:Math.PI/2;heldGroup.add(weapon);if(models['bow.glb']){const bow=prepareModel(models['bow.glb'].scene.clone(true));bow.scale.setScalar(.82);bow.userData.bow=true;bow.getObjectByName('BowString')?.traverse(o=>{if(o.isMesh)o.visible=false;});const stringGeometry=new THREE.BufferGeometry().setFromPoints([new V3(0,.66,.229),new V3(0,0,.229),new V3(0,-.66,.229)]);bowString=new THREE.Line(stringGeometry,new THREE.LineBasicMaterial({color:0xe9ddc9}));bow.add(bowString);heldGroup.add(bow);if(!nockedArrow){nockedArrow=arrowMesh();nockedArrow.scale.setScalar(.85);weaponPivot.add(nockedArrow);}}rebuildPlayerAvatar();setSlot(selectedSlot);trail.material.color.setHex(item.rarity==='common'?0xffdfb1:RARITIES[item.rarity].hex);setHero();updatePotionArt();updateProfileUI();updateHud();}
function selectKit(id){selectedKit=id;write('emberfall.kit',id);document.querySelectorAll('[data-kit]').forEach(e=>{e.classList.toggle('selected',e.dataset.kit===id);e.setAttribute('aria-pressed',String(e.dataset.kit===id));});}
document.querySelectorAll('[data-kit]').forEach(b=>{b.querySelector('small').textContent=KITS[b.dataset.kit].description;b.addEventListener('click',()=>selectKit(b.dataset.kit));});
const TUNING_TEXT={'hurt-window':HURT_WINDOW,'heavy-full':HEAVY.full,'heavy-damage':Math.round((HEAVY.damage.base+HEAVY.damage.perPower)*100)/100,'heavy-recovery':HEAVY.maxRecovery,'match-win-coins':MATCH_REWARDS.win.coins,'match-win-points':MATCH_REWARDS.win.points};document.querySelectorAll('[data-tuning]').forEach(e=>e.textContent=String(TUNING_TEXT[e.dataset.tuning]));
function cycleCharacter(delta){const list=Object.keys(CHARACTERS);profile.character=list[(list.indexOf(profile.character)+delta+list.length)%list.length];persist();setHero();rebuildPlayerAvatar();}
$('character-prev').addEventListener('click',()=>cycleCharacter(-1));$('character-next').addEventListener('click',()=>cycleCharacter(1));
function heroViewport(){const narrow=innerWidth<650,w=narrow?innerWidth*.66:innerWidth*.5,h=innerHeight*.76,x=narrow?innerWidth*.46:innerWidth*.47,y=innerHeight*.24;return {left:x,top:innerHeight-(y+h),right:x+w,bottom:innerHeight-y};}
function overHero(e){const r=heroViewport();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
let heroDrag=null;
$('lobby').addEventListener('pointerdown',e=>{if(mode!=='lobby'||e.button!==0||e.target.closest('button,a,input,select,label,.character-picker')||!overHero(e))return;heroDrag={id:e.pointerId,x:e.clientX,yaw:heroYaw};$('lobby').setPointerCapture(e.pointerId);$('lobby').style.cursor='grabbing';});
$('lobby').addEventListener('pointermove',e=>{if(heroDrag?.id===e.pointerId){heroYaw=heroDrag.yaw-(e.clientX-heroDrag.x)*.015;if(hero)hero.rig.rotation.y=heroYaw;return;}const interactive=e.target.closest('button,a,input,select,label,.character-picker');$('lobby').style.cursor=!interactive&&mode==='lobby'&&overHero(e)?'grab':'';});
const endHeroDrag=e=>{if(!heroDrag||e.pointerId!==heroDrag.id)return;heroDrag=null;$('lobby').style.cursor='';};
$('lobby').addEventListener('pointerup',endHeroDrag);$('lobby').addEventListener('pointercancel',endHeroDrag);
installScrollbars();$('player-name').value=profile.name;$('player-name').addEventListener('change',()=>{profile.name=cleanName($('player-name').value);$('player-name').value=profile.name;persist();updateProfileUI();});
function updateProfileUI(){const rank=rankFor(profile.rating);document.querySelectorAll('[data-coins]').forEach(e=>e.textContent=profile.coins.toLocaleString());document.querySelectorAll('[data-rank]').forEach(e=>{e.textContent=rank.name+' · Lv '+rank.level;e.style.color=rank.color;});document.querySelectorAll('[data-rank-icon]').forEach(e=>e.innerHTML=rankIcon(rank));const xp=$('hud-xp');if(xp)xp.style.width=(rank.levelProgress*100)+'%';const exp=$('hud-exp');if(exp)exp.textContent=rank.next?(rank.next.min-profile.rating).toLocaleString()+' EXP to '+rank.next.name:profile.rating.toLocaleString()+' EXP';}

const icon=(id)=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const effectBadges=stats=>(stats.effects??[]).map(e=>`<span class="effect-badge" style="--effect:${EFFECTS[e.type].color}">${EFFECTS[e.type].name} ${['','I','II','III'][e.level]}</span>`).join('');
const itemDetails=stats=>`<div class="effect-badges">${stats.forged?'<span class="forged-badge">Forged</span>':''}${effectBadges(stats)}</div><details class="item-details"><summary>Stats</summary>${stats.description?`<p>${stats.description}</p>`:''}<dl><dt>Damage</dt><dd>${stats.damage}</dd>${stats.kind==='staff'?`<dt>Cast interval</dt><dd>${stats.cooldown}s</dd>`:`<dt>Critical hit</dt><dd>${stats.absoluteDamage?stats.damage.toLocaleString():Math.round(stats.damage*MELEE.criticalMultiplier)}</dd>`}<dt>${stats.kind==='staff'?'Range':'Reach'}</dt><dd>${stats.reach.toFixed(2)}m</dd><dt>Knockback</dt><dd>${stats.knockback.toFixed(1)}</dd><dt>Speed bonus</dt><dd>${stats.speed>0?'+':''}${stats.speed.toFixed(2)}</dd>${(stats.effects??[]).map(e=>`<dt style="color:${EFFECTS[e.type].color}">${EFFECTS[e.type].name}</dt><dd>${effectDescription(e)}</dd>`).join('')}</dl></details>`;
const itemArt=(key,fallback='sword')=>thumbs[key]?`<img src="${thumbs[key]}" alt="">`:icon(fallback);
function atShops(){return !isDueling()&&(mode==='lobby'||safeZone(player.position));}
const stationTab=station=>station.type==='chest'?'storage':station.type==='merchant'?'exotics':station.type;
const MENU_TABS={personal:['inventory','cosmetics','nameplates','ranks'],chest:['storage'],equipment:['weapons','armor'],potions:['potions'],merchant:['exotics']};
function showShop(tab='inventory'){
 if(tab==='match'){openMatches();return;}
 const context=['storage','chest'].includes(tab)?'chest':['weapons','armor'].includes(tab)?'equipment':tab==='potions'?'potions':tab==='exotics'?'merchant':'personal';
 if(context!=='personal'&&!atShops()){toast('Return to the ledge to trade or use storage');return;}
 menuContext=context;shopTab=tab==='chest'?'storage':tab;inventorySelection=null;openModal('shop');renderShop();
}
function inventoryChanged(result){if(result&&!result.ok){toast(result.error);return;}cancelAttack(true);hotbarSignature='';const selected=profile.inventory.find(i=>i.id===profile.hotbar[profile.selectedHotbar]);updateHeldArmor(selected);if(selected?.potion){profile.selectedPotion=selected.potion;showPotionBottle(selected.potion);}selectedSlot=selected?itemKind(selected)==='weapon'?'sword':itemKind(selected):'empty';if(selected?.weapon)profile.equipped=selected.id;persist();refreshEquipment();renderShop();}
function selectInventoryItem(item){
 if(item.armor){const result=equipInventoryItem(profile,item.id);inventoryChanged(result);return;}
 const result=equipInventoryItem(profile,item.id);if(!result.ok){toast(result.error);return;}selectHotbarSlot(profile.selectedHotbar);renderShop();
}
function rollStorageChest(){
 if(chestBusy||!atShops())return;const result=openChest(profile);if(!result.ok){toast(result.error);return;}
 chestResult=result.item;chestLidUntil=time+1.5;inventorySelection={id:result.item.id,stored:false};sound('chest');chatSystem(`Found ${RARITIES[result.item.rarity].name} ${weaponStats(result.item).name}.`,'reward');inventoryChanged(result);
}
function dropInventoryItem(id=profile.hotbar[profile.selectedHotbar]){
 const item=profile.inventory.find(i=>i.id===id);if(!item)return;
 if(item.bound){toast('Starter kit stays with you');return;}if(mode==='lobby'||player.health<=0||isDueling()){toast('Enter the arena to drop items');return;}
 const at=player.position.clone().add(new V3(-Math.sin(yaw)*1.2,0,-Math.cos(yaw)*1.2));
 if(!spawnLoot(item,at))return;profile.inventory.splice(profile.inventory.indexOf(item),1);syncInventory(profile);inventorySelection=null;saveLoot();inventoryChanged({ok:true});toast('Dropped '+itemName(item));updateHud();
}
function renderCarriedInventory(storage=false){

 renderInventoryPanel({root:$('shop-content'),profile,thumbs,storage,canTrade:atShops()&&!storage,selection:inventorySelection,details:itemDetails,
  onSelect:(id,stored)=>{inventorySelection=id?{id,stored}:null;renderShop();},onEquip:selectInventoryItem,
  onTransfer:(id,toVault)=>{if(!atShops())return;inventorySelection=null;inventoryChanged(transferItem(profile,id,toVault));},
  onSell:(id,stored)=>{if(!atShops())return;const result=sellItem(profile,id,stored);if(result.ok){inventorySelection=null;sound('buy');toast('+'+result.coins+' coins');}inventoryChanged(result);},
  onExpand:()=>{if(atShops())inventoryChanged(expandStorage(profile));},
  onMove:(id,from,to,index)=>{if((from||to)&&!atShops())return;const result=moveInventoryItem(profile,id,from,to,index);if(result.ok)inventorySelection=null;inventoryChanged(result);},onDrop:dropInventoryItem,onRoll:rollStorageChest});
}
function renderShop(){updateProfileUI();$('shop-title').textContent=menuContext==='personal'?'Your character':menuContext==='chest'?'Chest':menuContext==='potions'?'Potions':menuContext==='merchant'?MERCHANT.name:'Weapons & armor';$('shop-modal').classList.toggle('inventory-modal',shopTab==='inventory'||shopTab==='storage');const allowed=MENU_TABS[menuContext];document.querySelectorAll('[data-tab]').forEach(b=>{b.hidden=!allowed.includes(b.dataset.tab);b.classList.toggle('selected',b.dataset.tab===shopTab);});$('shop-tabs').hidden=allowed.length===1;$('personal-settings').hidden=menuContext!=='personal';const content=$('shop-content');content.replaceChildren();
 if(shopTab==='weapons'||shopTab==='armor'){
  const armorShop=shopTab==='armor',grid=document.createElement('div');grid.className='equipment-grid';
  for(const [id,w]of armorShop?Object.entries(ARMORS):SHOP_WEAPONS.map(id=>[id,WEAPONS[id]])){
   if(armorShop&&!w.file)continue;const starter=!armorShop&&id==='classic',count=profile.inventory.filter(i=>armorShop?i.armor===id:i.weapon===id).length,card=document.createElement('article');card.className='equipment-card'+(w.absoluteDamage?' sovereign-card':'');
   card.innerHTML=`<div class="equipment-art">${itemArt(armorShop?'armor-'+id:id,armorShop?'armor':'sword')}</div><h3>${w.name}</h3><p>${armorShop?Math.round(w.reduction*100)+'% damage reduction':w.damage.toLocaleString()+' damage · '+w.reach.toFixed(1)+'m '+(w.kind==='staff'?'range':'reach')}</p><p>${count} carried</p>${armorShop?'':itemDetails(w)}<button class="secondary-button" ${starter?'disabled':''}>${starter?'Starter kit':'Buy '+icon('coin')+' '+w.price.toLocaleString()}</button>`;
   card.querySelector('button').addEventListener('click',()=>{if(!atShops())return;const result=armorShop?purchaseArmor(profile,id):purchaseWeapon(profile,id);if(!result.ok){toast(result.error);return;}persist();updateHud();renderShop();sound('buy');toast(w.name+' added to inventory');});grid.append(card);
  }content.append(grid);
 }
 else if(shopTab==='exotics'){
  const stock=merchantStock(merchantState),bar=document.createElement('div');bar.className='cosmetics-summary';bar.innerHTML=`<span class="merchant-restock">Restocks in ${restockClock(stock)}</span>`;content.append(bar);
  const grid=document.createElement('div');grid.className='equipment-grid';
  for(const entry of stock.items){const id=entry.weapon,w=WEAPONS[id],stats=weaponStats({weapon:id,rarity:w.rarity}),open=entry.status==='available',card=document.createElement('article');card.className='equipment-card exotic-card'+(open?'':' sold-out');
   card.innerHTML=`<div class="equipment-art">${itemArt(id,w.icon)}</div><h3>${w.name}</h3><p>${stats.damage} damage · ${stats.reach.toFixed(1)}m reach</p><p class="exotic-stock">${open?'1 left':entry.status==='bought'?'Bought':'Sold out'}</p>${itemDetails(stats)}<button class="secondary-button" ${open?'':'disabled'}>${open?'Buy '+icon('coin')+' '+entry.price.toLocaleString():'Sold out'}</button>`;
   card.querySelector('button').addEventListener('click',()=>{if(!atShops())return;const result=buyExotic(profile,merchantState,id);if(!result.ok){toast(result.error);renderShop();return;}write('emberfall.merchant.v1',merchantState);persist();updateHud();renderShop();syncMerchantDisplays();sound('buy');toast(w.name+' added to inventory');if(merchant)playMerchant('Wave');});grid.append(card);
  }content.append(grid);merchantShopSignature=stockSignature(stock);
 }
 else if(shopTab==='potions'){
  const grid=document.createElement('div');grid.className='equipment-grid';
  for(const [id,p]of Object.entries(POTIONS)){const active=profile.selectedPotion===id,card=document.createElement('article');card.className='equipment-card'+(active?' equipped':'');
   card.innerHTML=`<div class="equipment-art">${itemArt('potion-'+id,'potion')}</div><h3>${p.name}</h3><p>${p.description}</p><div class="potion-stock">${profile.potions[id]} owned</div><div class="item-actions"><button class="secondary-button select-potion">${active?'Selected':'Select'}</button><button class="secondary-button buy-potion">${icon('coin')} ${p.price}</button></div>`;
   card.querySelector('.select-potion').disabled=active;card.querySelector('.select-potion').addEventListener('click',()=>{profile.selectedPotion=id;persist();updatePotionArt();updateHud();renderShop();});card.querySelector('.buy-potion').setAttribute('aria-label','Buy '+p.name+' for '+p.price+' coins');card.querySelector('.buy-potion').addEventListener('click',()=>{const result=purchasePotion(profile,id);if(!result.ok){toast(result.error);return;}profile.selectedPotion=id;player.potions=profile.potions.healing;persist();updatePotionArt();updateHud();renderShop();sound('buy');});grid.append(card);
  }content.append(grid);const note=document.createElement('p');note.className='potion-help';note.textContent='Q drinks · Z changes potion. Healing potions refill to 3 on the ledge; extra stock is saved.';content.append(note);
 }
 else if(shopTab==='cosmetics'){
  const bar=document.createElement('div');bar.className='cosmetics-summary';bar.innerHTML=`<span>Permanent effects · equip one at a time</span><button class="secondary-button" id="remove-effect" ${profile.cosmetic==='none'?'disabled':''}>${profile.cosmetic==='none'?'No effect equipped':'Unequip effect'}</button>`;content.append(bar);
  $('remove-effect').addEventListener('click',()=>{purchaseCosmetic(profile,'none');persist();updateCosmetic(playerAvatar,'none',time);setHero();renderShop();});
  const grid=document.createElement('div');grid.className='equipment-grid';
  for(const [id,c]of Object.entries(COSMETICS)){if(id==='none')continue;const owned=profile.ownedCosmetics.includes(id),active=profile.cosmetic===id,card=document.createElement('article');card.className='equipment-card cosmetic-card'+(c.power?' sovereign-card':'')+(active?' equipped':'');card.innerHTML=`${cosmeticPreview(id)}<h3>${c.name}</h3><p>${c.description}</p><button class="secondary-button" ${active?'disabled':''}>${active?'Equipped':owned?'Equip':icon('coin')+' '+c.price.toLocaleString()}</button>`;card.querySelector('button').addEventListener('click',()=>{const result=purchaseCosmetic(profile,id);if(!result.ok){toast(result.error);return;}persist();if(playerAvatar)updateCosmetic(playerAvatar,id,time);setHero();renderShop();sound('buy');toast((result.equipped?'Equipped ':'Unlocked ')+c.name);});grid.append(card);}content.append(grid);
 }
 else if(shopTab==='nameplates'){
  const bar=document.createElement('div');bar.className='cosmetics-summary';bar.innerHTML=`<span>Permanent animated chat names</span><button class="secondary-button" id="remove-nameplate" ${profile.nameplate==='none'?'disabled':''}>${profile.nameplate==='none'?'Plain name equipped':'Use plain name'}</button>`;content.append(bar);
  $('remove-nameplate').addEventListener('click',()=>{purchaseNameplate(profile,'none');persist();renderShop();});
  const grid=document.createElement('div');grid.className='equipment-grid';
  for(const [id,plate]of Object.entries(NAMEPLATES)){if(id==='none')continue;const owned=profile.ownedNameplates.includes(id),active=profile.nameplate===id,card=document.createElement('article');card.className='equipment-card nameplate-card'+(active?' equipped':'');
   card.innerHTML=`<div class="nameplate-preview"></div><h3>${plate.name}</h3><p>${plate.description}</p><button class="secondary-button" ${active?'disabled':''}>${active?'Equipped':owned?'Equip':icon('coin')+' '+plate.price}</button>`;
   card.querySelector('.nameplate-preview').append(nameplateNode(profile.name,id));
   card.querySelector('button').addEventListener('click',()=>{const result=purchaseNameplate(profile,id);if(!result.ok){toast(result.error);return;}persist();renderShop();sound('buy');toast((result.equipped?'Equipped ':'Unlocked ')+plate.name+' nameplate');});grid.append(card);
  }content.append(grid);
 }
 else if(shopTab==='inventory'||shopTab==='storage')renderCarriedInventory(shopTab==='storage');
 else if(shopTab==='ranks'){const rank=rankFor(profile.rating);content.innerHTML=`<div class="rank-summary">${rankIcon(rank)}<div><strong style="color:${rank.color}">${rank.name}</strong><p>Level ${rank.level} of ${rank.maxLevel} · ${profile.rating.toLocaleString()} EXP${rank.next?' · '+(rank.next.min-profile.rating).toLocaleString()+' to '+rank.next.name:''}</p><div class="rank-progress"><i style="width:${rank.levelProgress*100}%"></i></div></div></div><div class="rank-list">${RANKS.map((r,i)=>`<div class="rank-cell ${r.name===rank.name?'current':''}">${rankIcon(r)}<span><strong style="color:${r.color}">${r.name}</strong><small>Lv ${i*LEVELS_PER_RANK+1}–${(i+1)*LEVELS_PER_RANK} · ${r.min.toLocaleString()} EXP</small></span></div>`).join('')}</div><div class="rank-stats"><span><b>${profile.kills}</b>KOs</span><span><b>${profile.deaths}</b>Deaths</span><span><b>${profile.best}</b>Best streak</span></div>`;}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{if(MENU_TABS[menuContext].includes(b.dataset.tab)){shopTab=b.dataset.tab;inventorySelection=null;renderShop();}}));document.querySelectorAll('[data-ranks]').forEach(b=>b.addEventListener('click',()=>showShop('ranks')));

function chatSystem(text,kind='system'){addChat({kind,text});}
function addChat(entry){if(entry.kind==='kill'){addKill(entry);return;}messages.push({...entry,nameplate:entry.nameplate??(!entry.ai&&entry.name===profile.name?profile.nameplate:'none'),t:time});if(messages.length>100){const old=messages.shift();old.node?.remove();}renderChat();}
function addKill(entry){const node=document.createElement('div');node.className='kill-entry'+(entry.killer===profile.name||entry.victim===profile.name?' yours':'');const killer=document.createElement('span'),victim=document.createElement('span'),mark=document.createElement('span');killer.className='killer';victim.className='victim';mark.className='kill-mark';killer.textContent=entry.killer;victim.textContent=entry.victim;mark.innerHTML=icon('sword');node.append(killer,mark,victim);$('kill-feed').append(node);killFeed.push({...entry,node,t:time});while(killFeed.length>4)killFeed.shift().node.remove();}
function updateKillFeed(){for(let i=killFeed.length-1;i>=0;i--){const entry=killFeed[i],age=time-entry.t;entry.node.style.opacity=age<5?1:Math.max(0,6-age);if(age>=6){entry.node.remove();killFeed.splice(i,1);}}}
function renderChat(){const log=$('chat-log'),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<40;const live=new Set(messages.map(m=>m.node).filter(Boolean));for(const child of [...log.children])if(!live.has(child))child.remove();let added=false;
 for(let i=0;i<messages.length;i++){const msg=messages[i];let line=msg.node;if(!line){line=msg.node=document.createElement('div');line.className='chat-line '+(msg.kind??'message');if(msg.kind==='kill'){const mark=document.createElement('span');mark.className='kill-icon';mark.textContent='⚔';line.append(mark);const a=document.createElement('span');a.className='chat-name';a.textContent=msg.killer;const b=document.createElement('span');b.className='victim';b.textContent=msg.victim;line.append(a,document.createTextNode(' defeated '),b);if(msg.extra)line.append(document.createTextNode(' · '+msg.extra));}
 else if(msg.name){const rank=rankFor(msg.rating??0),r=document.createElement('span');r.className='chat-rank';r.style.color=rank.color;r.innerHTML=rankIcon(rank);r.append(document.createTextNode('['+rank.name+'] Lv '+rank.level+' '));line.append(r);line.append(nameplateNode(msg.name,msg.nameplate));if(msg.ai){const ai=document.createElement('span');ai.className='ai-tag';ai.textContent='AI';line.append(ai);}line.append(document.createTextNode(': '+msg.text));}else line.textContent=msg.text;log.append(line);added=true;}line.classList.toggle('faded',!chatOpen&&(i<messages.length-6||time-msg.t>16));}
 if(added&&(nearBottom||!chatOpen))log.scrollTop=log.scrollHeight;
}
function openChat(prefill=''){if(mode!=='play')return;cancelAttack();chatOpen=true;keys.clear();blockHeld=false;bowDrawAt=-1;document.exitPointerLock?.();$('chat').classList.add('open');$('chat-form').classList.remove('hidden');$('chat-input').value=prefill;renderChat();setTimeout(()=>$('chat-input').focus(),0);}
function closeChat(relock=true){chatOpen=false;$('chat').classList.remove('open');$('chat-form').classList.add('hidden');$('chat-input').blur();renderChat();if(relock&&mode==='play')requestLock();}
function chatContext(){return{time,match:duel.phase!=='idle',teamMate:duel.teams?.blue.find(a=>a!==player)?.name,playerName:profile.name,playerStreak:player.streak,playerKills:player.kills,hunt:admin.hunt,eventName:arenaEvent.phase!=='idle'?arenaEvent.type?.name:null};}
function queueReply(text){
 if(time-lastChatReply<2)return;lastChatReply=time;
 const addressed=fighters.find(f=>new RegExp('\\b'+f.name+'\\b','i').test(text));
 const followup=/^(why|how so|really|tell me more|more|and|go on|explain|what do you mean|what about you|yes|yeah|no|nah|ok|okay|sure)[.!? ]*$/i.test(text);
 const bot=addressed??(followup&&lastChatBot&&time-lastChatBot.at<60?lastChatBot.bot:null)??[...fighters].sort((a,b)=>a.position.distanceTo(player.position)-b.position.distanceTo(player.position))[(messages.length)%Math.min(3,fighters.length)];
 if(bot){lastChatBot={bot,at:time};const message=addressed?text.replace(new RegExp('\\b'+addressed.name+'\\b[:, ]*','i'),'').trim()||'hello':text;pendingChats.push({at:time+.9+Math.random()*1.3,bot,text:botReply(bot,message,chatContext())});}
}
function toggleAdmin(value){admin.god=value;if(!value)admin.flying=false;player.effects={};player.poison=null;player.slowUntil=0;if(value){player.health=KITS[selectedKit].health;player.knock.set(0,0,0);lastHurt=time-20;}chatSystem('Admin '+(value?'on. Double-tap Space to fly.':'off.'));updateHud();}
function toggleFlight(value){if(!admin.god){chatSystem('Enable /admin on first.');return;}admin.flying=value;player.velocity.y=0;player.knock.set(0,0,0);lastJumpTap=-10;chatSystem(value?'Flight on · Space up · C / Ctrl down.':'Flight off.');updateHud();}
function jumpInput(){
 if(freecam.active)return;
 if(isDueling()&&(duel.phase!=='active'||player.health<=0))return;
 if(mode!=='play'||chatOpen)return;
 if(admin.god&&time-lastJumpTap<.3){toggleFlight(!admin.flying);return;}lastJumpTap=time;
 if(admin.flying)return;
 if(player.inLava){player.velocity.y=Math.max(7.7,Math.sqrt(44*(.55-player.position.y)));player.inLava=false;player.jumps=1;sound('jump');}
 else if(player.grounded){player.jumps=1;player.velocity.y=7.7;player.grounded=false;sound('jump');}
 else if((player.jumps??0)<2){player.jumps=2;player.velocity.y=7.7;sound('jump');burst(player.position.clone().add(new V3(0,.08,0)),0xc5dcff,12,.55,player);shockwave(player.position,0xb8d8ff,player);}
}
function syncViewControls(){
 const label=freecam.active?'Return to body':thirdPerson?'First person':'Third person';
 $('view-button').setAttribute('aria-pressed',String(freecam.active||thirdPerson));$('view-button').setAttribute('aria-label',label);$('view-button').title=label+' (V)';
 $('hud').classList.toggle('freecam',freecam.active);
}
function setFreecam(enabled,announce=true){
 if(enabled===freecam.active)return true;
 if(enabled&&(!loaded||mode!=='play'||player.health<=0||isDueling())){if(announce)chatSystem('Free camera is available while alive outside 2v2.');return false;}
 if(enabled){
  freecam.position.copy(player.position).add(new V3(Math.sin(yaw)*6,3.6,Math.cos(yaw)*6));
  const direction=player.position.clone().add(new V3(0,1.25,0)).sub(freecam.position).normalize();freecam.yaw=Math.atan2(-direction.x,-direction.z);freecam.pitch=Math.asin(direction.y);
  player.velocity.x=player.velocity.z=0;if(admin.flying)player.velocity.y=0;releaseSprint(player);sprinting=false;
 }
 cancelAttack();freecam.active=enabled;camera.far=enabled?320:140;cameraStride=sprintView=0;wasVisualSprint=false;shake=0;keys.clear();touchMove.x=touchMove.z=0;crouchTouch=false;blockHeld=false;bowDrawAt=-1;lastJumpTap=-10;
 syncViewControls();if(loaded){updateCamera(0);updatePlayerAvatar(0);updateFX(0);}
 if(announce)chatSystem(enabled?'Free camera: WASD to move, Space up, C / Ctrl down, Shift faster. V or /freecam off returns to your body.':'Returned to your body.');
 return true;
}
function updateFreecam(dt){
 if(mode==='play'&&!chatOpen){
  const horizontal=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x,forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.z;
  const vertical=(keys.has('Space')?1:0)-((keys.has('KeyC')||keys.has('ControlLeft')||keys.has('ControlRight')||crouchTouch)?1:0);
  const direction=new V3(Math.cos(freecam.yaw)*horizontal-Math.sin(freecam.yaw)*Math.cos(freecam.pitch)*forward,Math.sin(freecam.pitch)*forward+vertical,-Math.sin(freecam.yaw)*horizontal-Math.cos(freecam.yaw)*Math.cos(freecam.pitch)*forward);
  if(direction.lengthSq()>1)direction.normalize();freecam.position.addScaledVector(direction,(keys.has('ShiftLeft')||keys.has('ShiftRight')?24:9)*dt);
 }
 camera.position.copy(freecam.position);camera.rotation.set(freecam.pitch,freecam.yaw,0,'YXZ');camera.fov=70;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);shake=0;
}
function executeCommand(text){
 if(isDueling()&&/^\/(admin|fly|freecam|chargeorb|targetme|killall|heal|give|coins|bots)(?:\s|$)/i.test(text)){chatSystem('Admin powers are disabled during 2v2. Use /spawn to leave.');return;}
 const [command,arg,rarity='legendary',effect]=text.toLowerCase().trim().split(/\s+/),toggle=current=>arg==='on'?true:arg==='off'?false:!current;
 if(['/admin','/fly','/freecam','/chargeorb','/targetme'].includes(command)&&arg&&!['on','off'].includes(arg)){chatSystem('Use '+command+' on or '+command+' off.');return;}
 if(command==='/2v2'){closeChat(false);openMatches();}
 else if(command==='/bots'){
  const args=text.trim().split(/\s+/),count=Number(args[2]);
  if(arg!=='add'||args.length!==3||!/^\d+$/.test(args[2])||!Number.isSafeInteger(count)||count<1){chatSystem('Use /bots add <number>, for example /bots add 5.');return;}
  const available=MAX_BOTS-fighters.length;
  if(count>available){chatSystem(available>0?'Room for '+available+' more bots ('+MAX_BOTS+' maximum).':'Bot limit reached: '+MAX_BOTS+'.');return;}
  if(!loaded){chatSystem('Wait for the characters to finish loading.');return;}
  for(let i=0;i<count;i++)makeFighter(fighters.length);
  chatSystem('Added '+count+' '+(count===1?'bot':'bots')+' on the ledge. '+fighters.length+' bots in this session.');
 }
 else if(command==='/admin')toggleAdmin(toggle(admin.god));
 else if(command==='/fly')toggleFlight(toggle(admin.flying));
 else if(command==='/freecam')setFreecam(toggle(freecam.active));
 else if(command==='/chargeorb'){if(toggle(orbCharge.at>=0)){if(startChargeOrb(true))chatSystem('Charge orb held. /chargeorb off releases it; /freecam lets you watch.');}else{orbCharge.at=-1;orbCharge.itemId=null;orbCharge.latched=false;chatSystem('Charge orb released.');}}
 else if(command==='/targetme'){admin.hunt=toggle(admin.hunt);for(const f of fighters){f.target=null;f.targetUntil=0;f.planUntil=0;f.returnAt=0;}chatSystem(admin.hunt?'Coordinated hunt on. All bots target you once you leave the ledge.':'Coordinated hunt off. Free-for-all resumed.');}
 else if(command==='/killall'){
  if(arg&&!['everyone','bots'].includes(arg)){chatSystem('Use /killall, /killall everyone, or /killall bots.');return;}
  let count=0;for(const f of fighters)if(f.alive){killFighter(f,null,'Command');count++;}
  chatSystem(count+' bots eliminated. They will respawn on the ledge.');
  if(arg!=='bots'){player.health=0;defeatPlayer(null,'Command',false);}
 }
 else if(command==='/heal'){player.health=KITS[selectedKit].health;player.effects={};player.poison=null;player.slowUntil=0;refillStarterPotions(profile);persist();sound('tonic');chatSystem('Health restored and effects cleared.');}
 else if(command==='/coins'){
  const amount=Number(arg);if(!admin.god){chatSystem('Enable /admin on to grant coins.');return;}
  if(!arg||!Number.isInteger(amount)||amount<1||amount>1000000){chatSystem('Use /coins 1–1000000.');return;}profile.coins+=amount;persist();updateProfileUI();chatSystem('Added '+amount.toLocaleString()+' coins.');
 }
 else if(command==='/give'){
  if(!admin.god){chatSystem('Enable /admin on to grant weapons.');return;}
  if(arg==='chargeorb'){const item={id:makeItemId(profile,'chargeorb'),orb:'charge',rarity:'legendary'},result=addInventoryItem(profile,item);if(!result.ok){chatSystem(result.error);return;}equipInventoryItem(profile,item.id);persist();selectHotbarSlot(profile.selectedHotbar);chatSystem('Charge orb equipped. With Ascension equipped, hold left click to pull fighters inward. /chargeorb on holds it for free camera.');return;}
  if(!WEAPONS[arg]||!RARITIES[rarity]||(effect&&!EFFECTS[effect])){chatSystem('Use /give <weapon> [common|rare|epic|legendary] [bleed|frost|fire]. Weapons: '+Object.keys(WEAPONS).join(', ')+'.');return;}
  const item={id:'admin-'+Date.now()+'-'+profile.inventory.length,weapon:arg,rarity,effects:effect?[{type:effect,level:2}]:[]};const result=addInventoryItem(profile,item);if(!result.ok){chatSystem(result.error);return;}equipInventoryItem(profile,item.id);persist();selectHotbarSlot(profile.selectedHotbar);chatSystem('Equipped '+weaponStats(item).name+'.');
 }
 else if(command==='/spawn'){closeChat(false);if(admin.god)completeReturn();else beginReturn();}
 else if(command==='/shop'){closeChat(false);showShop('weapons');}
 else if(command==='/rank'){const rank=rankFor(profile.rating);chatSystem(`${rank.name} · Level ${rank.level} · ${profile.rating.toLocaleString()} EXP${rank.next?' · '+(rank.next.min-profile.rating).toLocaleString()+' to '+rank.next.name:''} · ${profile.kills} KOs.`);}
 else if(command==='/wave'||command==='/dance'){
  if(time-lastCombat<3){chatSystem('Finish the fight before emoting.');return;}
  if(playerAvatar){const name=command==='/wave'?'Wave':'Dance';animateActor(playerAvatar,name,command==='/wave',1);playerAvatar.animUntil=time+2.9;playerAvatar.emoting=true;}
 }
 else if(command==='/help'){closeChat(false);openModal('commands');}
 else if(command==='/edit'){location.href='./editor.html';}
 else if(command==='/changelog'){closeChat(false);openModal('changelog');}
 else if(command==='/clear'){messages.length=0;renderChat();}
 else chatSystem('Unknown command. Use /help.');
 updateHud();
}
$('chat-open').addEventListener('click',()=>openChat());$('chat-form').addEventListener('submit',e=>{e.preventDefault();const text=$('chat-input').value.trim().slice(0,140);if(text){if(text.startsWith('/'))executeCommand(text);else{addChat({name:profile.name,rating:profile.rating,text});queueReply(text);}}if(chatOpen)closeChat(mode==='play');else if(mode==='play')requestLock();});

function closeAll(){document.querySelectorAll('.modal').forEach(e=>e.classList.add('hidden'));$('modal-backdrop').classList.add('hidden');activeModal=null;}
function openModal(id){cancelAttack();bowDrawAt=-1;if(chatOpen)closeChat(false);if(mode==='play'){mode='pause';keys.clear();blockHeld=false;document.exitPointerLock?.();}document.querySelectorAll('.modal').forEach(e=>e.classList.add('hidden'));$(id+'-modal').classList.remove('hidden');$('modal-backdrop').classList.remove('hidden');activeModal=id;if(id==='pause')setTimeout(()=>$('resume').focus(),20);}
function closeModal(){const previous=activeModal;closeAll();if(mode==='pause'){if(previous==='shop')resume();else openModal('pause');}}
function requestLock(){if(touch)return;pointerLockFailed=false;lockRequested=true;try{const p=canvas.requestPointerLock?.();p?.catch(()=>{lockRequested=false;pointerLockFailed=true;toast('Drag to look · click to strike',3000);});if(!canvas.requestPointerLock){pointerLockFailed=true;lockRequested=false;}}catch{pointerLockFailed=true;lockRequested=false;}}
function resume(){initAudio();scorePinned=false;$('scoreboard').classList.add('hidden');closeAll();mode='play';keys.clear();requestLock();last=performance.now();}
function resetPlayer(){cancelAttack(true);meleeRecoveryUntil=-1;heavySwingPower=0;player.impactReaction=null;player.pressureSlow=1;setFreecam(false,false);resetMeleeState(player);sprinting=false;sprintView=0;cameraStride=0;wasVisualSprint=false;player.jumps=0;player.inLava=false;player.effects={};player.poison=null;player.slowUntil=0;admin.flying=false;lastJumpTap=-10;crouchTouch=false;crouchBlend=0;player.crouched=false;arrowCount=BOW.quiver;bowDrawAt=-1;selectedSlot='sword';let slot=profile.hotbar.indexOf(profile.equipped);if(slot<0){slot=0;bindHotbar(profile,slot,profile.equipped);}profile.selectedHotbar=slot;lastCast=time-20;potionUsedAt=time-20;buffs.haste=buffs.guard=0;refillStarterPotions(profile);persist();Object.assign(player,{health:KITS[selectedKit].health,maxHealth:KITS[selectedKit].health,streak:0,runKills:0,potions:profile.potions.healing,grounded:true,lastDamage:time-20,lastImpact:time-20});player.position.set(PLAYER_SPAWN.x,LEDGE_HEIGHT,PLAYER_SPAWN.z);player.velocity.set(0,0,0);player.knock.set(0,0,0);yaw=0;pitch=-.08;swingAge=10;blockHeld=false;combo=0;lastHit=-10;lastHurt=-20;lastTonic=-20;lastCombat=-20;returnAt=0;clickTimes.length=0;$('combo').classList.add('hidden');refreshEquipment();}
function startGame(resetMatch=true){if(!loaded)return;if(resetMatch&&isDueling())leaveMatch();scorePinned=false;$('scoreboard').classList.add('hidden');initAudio();profile.name=cleanName($('player-name').value);$('player-name').value=profile.name;persist();closeAll();mode='play';$('lobby').classList.add('hidden');$('hud').classList.remove('hidden');if(touch)$('touch-controls').classList.remove('hidden');if(resetMatch){ragdolls.clear();admin.hunt=false;pendingChats.length=0;lastChatBot=null;player.kills=0;player.deaths=0;fighters.forEach(f=>{f.kills=0;f.deaths=0;spawnFighter(f);});arenaEvent=createEventState(time);hazardMarks.forEach(h=>{scene.remove(h.ring,h.rock);});hazardMarks.length=0;clearSupplies();messages.length=0;killFeed.length=0;$('kill-feed').replaceChildren();chatSystem('T to chat · /help for commands. AI opponents and chat are simulated.');if(MAP_SOURCE==='draft')chatSystem('Playing the editor draft map.');}resetPlayer();requestLock();}
function returnLobby(){cancelAttack(true);pressureAtmosphere=0;world.setPressure(null);ragdolls.clear();setFreecam(false,false);if(isDueling())leaveMatch();scorePinned=false;closeAll();if(chatOpen)closeChat(false);mode='lobby';keys.clear();blockHeld=false;returnAt=0;document.exitPointerLock?.();$('lobby').classList.remove('hidden');$('hud').classList.add('hidden');$('scoreboard').classList.add('hidden');$('damage-flash').style.opacity=0;setHero();}
function saveLoot(){write('emberfall.loot.v1',lootDrops.map(d=>({item:d.item,position:d.position.toArray(),expiresAt:d.expiresAt})));}
function spawnLoot(item,position,remaining=300){
 const clean=sanitizeItem(item);if(!clean||clean.bound)return null;
 const point=position.clone();point.y=groundHeight(point.x,point.z,point.y)+.08;
 if(isLava(point.x,point.z,point.y)||blocked(point.x,point.z,point.y,.2)){
  search:for(const radius of [1.2,2.4,3.6,5])for(let n=0;n<12;n++){const x=position.x+Math.cos(n*Math.PI/6)*radius,z=position.z+Math.sin(n*Math.PI/6)*radius,y=groundHeight(x,z,position.y);if(!isLava(x,z,y)&&!blocked(x,z,y,.25)){point.set(x,y+.08,z);break search;}}
 }
 const file=clean.weapon?WEAPONS[clean.weapon].file:clean.armor?ARMORS[clean.armor].file:clean.potion?POTIONS[clean.potion].file:'bow.glb';
 const root=new THREE.Group(),model=clean.orb?createChargeOrb():prepareModel(models[file].scene.clone(true));const box=new THREE.Box3().setFromObject(model),size=box.getSize(new V3()),center=box.getCenter(new V3()),scale=.68/Math.max(size.x,size.y,size.z);model.scale.multiplyScalar(scale);model.position.copy(center).multiplyScalar(-scale);const spin=new THREE.Group();spin.add(model);spin.position.y=.48;root.add(spin);
 const rarity=RARITIES[clean.rarity],ring=new THREE.Mesh(new THREE.RingGeometry(.27,.32,24),new THREE.MeshBasicMaterial({color:rarity.hex,side:THREE.DoubleSide,transparent:true,opacity:.6,depthWrite:false}));ring.rotation.x=-Math.PI/2;root.add(ring);root.position.copy(point);scene.add(root);
 const drop={item:clean,position:point,root,spin,ring,expires:time+remaining,expiresAt:Date.now()+remaining*1000,availableAt:time+.75};lootDrops.push(drop);return drop;
}
function restoreLoot(){const saved=read('emberfall.loot.v1',[]);if(!Array.isArray(saved))return;const owned=new Set([...profile.inventory,...profile.vault].map(i=>i.id)),seen=new Set();for(const entry of saved){const remaining=(entry?.expiresAt-Date.now())/1000;if(!(remaining>0)||!Array.isArray(entry.position)||entry.position.length!==3||!entry.position.every(Number.isFinite)||owned.has(entry.item?.id)||seen.has(entry.item?.id))continue;seen.add(entry.item.id);spawnLoot(entry.item,new V3(...entry.position),Math.min(300,remaining));}}
function removeLoot(drop){scene.remove(drop.root);drop.root.traverse(o=>{if(o.userData.ownedGeometry)o.geometry?.dispose();if(o.isMesh||o.isLine)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});drop.ring.geometry.dispose();const index=lootDrops.indexOf(drop);if(index>=0)lootDrops.splice(index,1);if(currentLoot===drop)currentLoot=null;}
function dropCarriedItems(actor){
 const account=actor===player?profile:actor.account,result=takeDeathItems(account);
 result.dropped.forEach((item,n)=>spawnLoot(item,actor.position.clone().add(new V3(Math.sin(n*2.4)*.45,0,Math.cos(n*2.4)*.45))));
 if(actor===player){persist();hotbarSignature='';$('death-loot').textContent=result.lost.length?`${result.lost.length} carried items lost. ${result.dropped.length?result.dropped.length+' rare or better drops can be recovered for 5 minutes.':'Common gear was lost.'} Chest storage is safe.`:'Your starter kit is ready.';}
 saveLoot();return result;
}
function nearestLoot(actor){if(actor===player&&player.health<=0)return null;let closest=null,distance=1.8;for(const d of lootDrops){if(time<d.availableAt||lootExpired(d))continue;const range=actor.position.distanceTo(d.position);if(range<distance&&!lineBlocked(actor.position,d.position)){closest=d;distance=range;}}return closest;}
function pickUpLoot(drop,actor){
 if(!drop||!lootDrops.includes(drop)||time<drop.availableAt||lootExpired(drop)||actor.position.distanceTo(drop.position)>1.85||(actor===player?player.health<=0:!actor.alive))return false;
 const account=actor===player?profile:actor.account,result=addInventoryItem(account,drop.item);if(!result.ok){if(actor===player)toast(result.error);return false;}
 const name=itemName(drop.item);removeLoot(drop);if(actor===player){persist();hotbarSignature='';updateHud();sound('buy');toast('Picked up '+name);}else{account.equipped=bestItem(account,actor.role).id;if(result.item.armor)equipInventoryItem(account,result.item.id);syncBotEquipment(actor);}saveLoot();return true;
}
function lootExpired(drop){return time>=drop.expires||Date.now()>=drop.expiresAt;}
function pruneLoot(){let changed=false;for(const drop of [...lootDrops])if(lootExpired(drop)){removeLoot(drop);changed=true;}if(changed)saveLoot();}
function updateLoot(dt){
 let expired=false;for(const drop of [...lootDrops]){if(lootExpired(drop)){removeLoot(drop);expired=true;continue;}drop.spin.rotation.y+=dt*1.3;drop.spin.position.y=.48+Math.sin(time*2.3+drop.expires)*.07;drop.root.visible=drop.position.distanceTo(player.position)<75;}
 for(const f of fighters){if(!f.alive||f.state!=='fight'||f.account.inventory.length>=CARRY_SLOTS||time<(f.lootCheckAt??0))continue;f.lootCheckAt=time+.5;const drop=nearestLoot(f);if(drop)pickUpLoot(drop,f);}
 if(expired)saveLoot();
}
window.addEventListener('beforeunload',saveLoot);

function beginReturn(){if(mode!=='play')return;if(isDueling()){finishMatch('red',true);return;}if(safeZone(player.position)){toast('Already on the ledge');return;}if(time-lastCombat<5){toast('In combat · wait '+Math.ceil(5-(time-lastCombat))+'s');return;}returnAt=time+3;}
function completeReturn(){cancelAttack(true);player.impactReaction=null;resetMeleeState(player);sprinting=false;sprintView=0;cameraStride=0;wasVisualSprint=false;returnAt=0;player.jumps=0;player.inLava=false;player.effects={};player.poison=null;player.slowUntil=0;admin.flying=false;player.position.set(PLAYER_SPAWN.x,LEDGE_HEIGHT,PLAYER_SPAWN.z);player.velocity.set(0,0,0);player.knock.set(0,0,0);player.health=KITS[selectedKit].health;refillStarterPotions(profile);player.potions=profile.potions.healing;persist();arrowCount=BOW.quiver;player.grounded=true;player.lastDamage=time-20;player.lastImpact=time-20;yaw=0;pitch=-.08;chatSystem('Returned to the ledge.');sound('tonic');}
$('play').addEventListener('click',()=>startGame(true));$('respawn').addEventListener('click',()=>startGame(false));$('resume').addEventListener('click',resume);$('to-lobby').addEventListener('click',returnLobby);$('death-lobby').addEventListener('click',returnLobby);$('pause-button').addEventListener('click',()=>openModal('pause'));$('pause-spawn').addEventListener('click',()=>{resume();beginReturn();});$('spawn-button').addEventListener('click',beginReturn);$('inventory-button').addEventListener('click',()=>showShop('inventory'));
document.querySelectorAll('[data-personal]').forEach(b=>b.addEventListener('click',()=>showShop(b.dataset.personal)));
$('personal-settings').addEventListener('click',()=>openModal('settings'));
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>b.dataset.open==='shop'?showShop():openModal(b.dataset.open)));document.querySelectorAll('.modal-close,.modal-close-action').forEach(b=>b.addEventListener('click',closeModal));
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas)lockRequested=false;else if(mode==='play'&&!chatOpen&&!touch&&!pointerLockFailed&&!lockRequested)openModal('pause');});document.addEventListener('pointerlockerror',()=>{lockRequested=false;pointerLockFailed=true;});
function look(dx,dy){const sensitivity=.00065+settings.sensitivity*.000025;if(freecam.active){freecam.yaw-=dx*sensitivity;freecam.pitch=THREE.MathUtils.clamp(freecam.pitch-dy*sensitivity,-1.54,1.54);}else{yaw-=dx*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*sensitivity,-1.36,1.36);}}
document.addEventListener('mousemove',e=>{if(mode==='play'&&!chatOpen&&(document.pointerLockElement===canvas||dragLook))look(e.movementX,e.movementY);});
canvas.addEventListener('pointerdown',e=>{if(mode!=='play'||touch||chatOpen)return;initAudio();if(e.button===0){beginAttack();if(pointerLockFailed)dragLook=true;}if(e.button===2&&!freecam.active&&selectedSlot==='sword'){cancelAttack();blockHeld=true;}});window.addEventListener('pointerup',e=>{if(touch)return;if(e.button===0){dragLook=false;releaseAttack();}if(e.button===2)blockHeld=false;});window.addEventListener('pointercancel',()=>{if(!touch)cancelAttack();});canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
 if(chatOpen){if(e.code==='Escape'){e.preventDefault();closeChat();}return;}
 if(activeModal==='shop'&&(shopTab==='inventory'||shopTab==='storage')){
  if(e.code==='KeyE'||e.code==='KeyB'){e.preventDefault();closeModal();return;}
  if(e.code==='KeyG'&&inventorySelection&&!inventorySelection.stored){e.preventDefault();dropInventoryItem(inventorySelection.id);return;}
  if(/^Digit[1-9]$/.test(e.code)&&inventorySelection&&!inventorySelection.stored){e.preventDefault();inventoryChanged(bindHotbar(profile,Number(e.code.slice(5))-1,inventorySelection.id));return;}
 }
 if(e.code==='Escape'){if(mode==='play')openModal('pause');else if(scorePinned){scorePinned=false;$('scoreboard').classList.add('hidden');if(mode==='pause')resume();}else if(activeModal&&activeModal!=='death'){if(activeModal==='pause')resume();else closeModal();}return;}
 if(mode!=='play')return;if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','Tab','KeyG','KeyQ','KeyZ','KeyR','KeyB','KeyE','KeyF','KeyT','Enter','Slash','KeyV','KeyC','ControlLeft','ControlRight'].includes(e.code)||/^Digit[1-9]$/.test(e.code))e.preventDefault();
 if(e.code==='KeyT'||e.code==='Enter'||e.code==='Slash'){openChat(e.code==='Slash'?'/':'');return;}keys.add(e.code);if(e.repeat)return;
 if(e.code==='Space')jumpInput();if(e.code==='KeyV')togglePerspective();if(e.code==='KeyG')dropInventoryItem();if(e.code==='KeyQ')drinkTonic();if(e.code==='KeyZ')cyclePotion();if(/^Digit[1-9]$/.test(e.code))selectHotbarSlot(Number(e.code.slice(5))-1);if(e.code==='KeyR')beginReturn();if(e.code==='KeyB'||e.code==='KeyE')showShop('inventory');
 if(e.code==='KeyF'){if(currentLoot)pickUpLoot(currentLoot,player);else if(currentStation)showShop(stationTab(currentStation));}if(e.code==='Tab')showScoreboard();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(['KeyW','ShiftLeft','ShiftRight'].includes(e.code))releaseSprint(player);if(e.code==='Tab'&&!scorePinned)$('scoreboard').classList.add('hidden');});window.addEventListener('blur',()=>{keys.clear();crouchTouch=false;blockHeld=false;dragLook=false;touchMove.x=touchMove.z=0;if(mode==='play')openModal('pause');});document.addEventListener('visibilitychange',()=>{if(document.hidden){music?.pause();if(mode==='play')openModal('pause');}});
if(touch){let stickId=null,touchLook=null;const joystick=$('joystick'),knob=joystick.querySelector('i');const moveStick=e=>{const b=joystick.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/38,z=(e.clientY-b.top-b.height/2)/38,l=Math.max(1,Math.hypot(x,z));touchMove.x=x/l;touchMove.z=z/l;knob.style.transform=`translate(${touchMove.x*32}px,${touchMove.z*32}px)`;};joystick.addEventListener('pointerdown',e=>{stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)moveStick(e);});const endStick=()=>{stickId=null;touchMove.x=touchMove.z=0;knob.style.transform='none';};joystick.addEventListener('pointerup',endStick);joystick.addEventListener('pointercancel',endStick);canvas.addEventListener('pointerdown',e=>{if(mode==='play'&&!chatOpen){touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointermove',e=>{if(touchLook?.id===e.pointerId){look((e.clientX-touchLook.x)*1.5,(e.clientY-touchLook.y)*1.5);touchLook.x=e.clientX;touchLook.y=e.clientY;}});canvas.addEventListener('pointerup',()=>touchLook=null);canvas.addEventListener('pointercancel',()=>touchLook=null);$('touch-strike').addEventListener('pointerdown',e=>{e.preventDefault();beginAttack();$('touch-strike').setPointerCapture(e.pointerId);});$('touch-strike').addEventListener('pointerup',releaseAttack);$('touch-strike').addEventListener('pointercancel',()=>cancelAttack());$('touch-jump').addEventListener('pointerdown',e=>{e.preventDefault();keys.add('Space');jumpInput();$('touch-jump').setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel'])$('touch-jump').addEventListener(event,()=>keys.delete('Space'));$('touch-guard').addEventListener('pointerdown',e=>{e.preventDefault();if(!freecam.active){cancelAttack();blockHeld=true;}$('touch-guard').setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel'])$('touch-guard').addEventListener(event,()=>blockHeld=false);$('interact-prompt').style.pointerEvents='auto';$('interact-prompt').addEventListener('click',()=>{if(currentLoot)pickUpLoot(currentLoot,player);else if(currentStation)showShop(stationTab(currentStation));});}

function nameTexture(name,rating){const c=document.createElement('canvas');c.width=360;c.height=100;const ctx=c.getContext('2d'),rank=rankFor(rating),title=rank.name+' · Lv '+rank.level;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;ctx.strokeStyle='#211b28';ctx.font='900 22px Nunito, sans-serif';if(ctx.measureText(title).width>280)ctx.font='900 16px Nunito, sans-serif';drawRankIcon(ctx,rank,24,2,40);ctx.strokeText(title,198,24);ctx.fillStyle=rank.color;ctx.fillText(title,198,24);ctx.font='1000 39px Nunito, sans-serif';ctx.strokeText(name,180,66);ctx.fillStyle='#fff3df';ctx.fillText(name,180,66);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function makeFighter(id){const skill=botProfile(id),seed=id%BOT_PROFILES.length,kitName=['vanguard','rogue','sentinel'][id%3],character=Object.keys(CHARACTERS)[id%Object.keys(CHARACTERS).length],template=models[CHARACTERS[character].file],rig=prepareModel(cloneRig(template.scene)),root=new THREE.Group();root.add(rig);scene.add(root);const item={id:'initial-'+id+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),weapon:['classic','dagger','classic','broadsword','dagger','frost','broadsword','mace','venom'][seed],rarity:seed===7?'rare':'common'},armor=seed>6?'iron':'none';attachGear(rig,item,armor);
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:nameTexture(skill.name,skill.rating),transparent:true,depthTest:true,opacity:1}));label.position.y=2.47;label.scale.set(2,.625,1);root.add(label);const healthBg=new THREE.Mesh(new THREE.PlaneGeometry(.82,.075),new THREE.MeshBasicMaterial({color:0x29202e,side:THREE.DoubleSide}));healthBg.position.set(0,2.08,0);root.add(healthBg);const healthFill=new THREE.Mesh(new THREE.PlaneGeometry(.76,.045),new THREE.MeshBasicMaterial({color:KITS[kitName].tint,side:THREE.DoubleSide}));healthFill.position.z=.005;healthBg.add(healthFill);
 const role=[1,6].includes(seed)?'archer':id%3===2?'ranger':id%3===1?'flanker':'duelist',account=makeProfile({name:skill.name,character,coins:80+seed*28,rating:skill.rating,inventory:[item],equipped:item.id,armor,ownedArmor:['none',armor]});
 const f={account,role,combatMode:'melee',arrowStock:BOW.quiver,bowDrawAt:-1,nextArrow:0,helmet:'none',effects:{},jumps:0,returnAt:0,spendAt:0,incomeAt:time+18,shopComplete:false,purchase:null,potionAt:0,buffGuardUntil:0,id,name:skill.name,skill,rating:skill.rating,kitName,kit:KITS[kitName],item,stats:weaponStats(item),armor,root,rig,animator:makeAnimator(rig,template.animations),label,healthBg,healthFill,position:root.position,velocity:new V3(),knock:new V3(),direction:new V3(),alive:true,hp:KITS[kitName].health,kills:0,deaths:0,streak:0,plan:'roam',planUntil:0,goal:null,lastPlanAt:0,healAt:0,hitFlashUntil:0,state:'spawn',spawnUntil:0,respawnAt:0,target:null,targetUntil:0,reactionUntil:0,nextClick:0,nextJump:0,aimAngle:Math.PI,aimPitch:0,lastImpact:-20,lastSwing:-20,animUntil:0,lastSeen:0,aiTimer:0,grounded:true,guard:false,strafe:1,strafeUntil:0,exitX:0};fighters.push(f);syncBotEquipment(f);spawnFighter(f);return f;
}
function spawnFighter(f,keepStreak=false){f.navigation=null;f.inLava=false;f.lastLava=-20;f.exitStage=false;restoreImpactPose(f);f.impactReaction=null;f.pressureSlow=1;f.rig.visible=true;resetMeleeState(f);f.sprintReleaseAt=f.sprintReleaseUntil=0;f.wTapping=false;const oldStreak=f.streak;f.arrowStock=BOW.quiver;f.bowDrawAt=-1;f.nextArrow=time+.5;f.effects={};f.jumps=0;f.rollUntil=0;f.nextRoll=time+3+(f.id%9)*.4;f.returnAt=0;f.shopComplete=false;f.purchase=choosePurchase(f.account,f.role,.2+(f.id%9)*.085);f.shopStarted=time;f.purchaseAt=0;refillStarterPotions(f.account);syncBotEquipment(f);f.position.set(BOT_SPAWN.x+(Math.random()-.5)*BOT_SPAWN.width,LEDGE_HEIGHT,BOT_SPAWN.z+Math.random()*BOT_SPAWN.depth);f.velocity.set(0,0,0);f.knock.set(0,0,0);f.hp=f.kit.health;f.slowUntil=0;f.poison=null;f.lavaCrossing=null;f.alive=true;f.root.visible=true;f.label.visible=true;f.healthBg.visible=true;f.rig.position.y=0;f.aimAngle=Math.PI;f.rig.rotation.y=Math.PI;f.animator.look.bodyYaw=Math.PI;f.animator.look.yaw=f.animator.look.pitch=0;f.target=null;f.targetUntil=0;f.lastImpact=time-20;f.lastSwing=time-20;f.state='spawn';f.spawnUntil=time+.5+Math.random()*2.1;f.nextClick=time+1;f.nextJump=time+1;f.lastCast=time-10;f.grounded=true;f.guard=false;f.streak=keepStreak?oldStreak:0;f.plan='roam';f.planUntil=0;f.goal=null;f.healthFill.scale.x=1;f.healthFill.position.x=0;f.healthBg.quaternion.copy(camera.quaternion);f.exitX=LEDGE_EXIT.x+(Math.random()-.5)*LEDGE_EXIT.width;animateActor(f,'Idle_Sword');}
function actorPhysics(actor,dt){
 const oldY=actor.position.y,liquid=isLava(actor.position.x,actor.position.z,actor.position.y)&&actor.position.y<.025;
 const drag=liquid?.64:1;actor.position.x+=(actor.velocity.x+actor.knock.x)*dt*drag;actor.position.z+=(actor.velocity.z+actor.knock.z)*dt*drag;
 // Buoyancy leaves the waist below the surface. Crouching lets the head submerge.
 if(liquid&&actor.velocity.y<2){const level=actor.crouched?-1.85:-1.12;actor.velocity.y+=((level-actor.position.y)*32-actor.velocity.y*8)*dt;}else actor.velocity.y-=22*dt;
 actor.position.y+=actor.velocity.y*dt;resolveCollision(actor.position,.38,actor.crouched?1.15:1.7);
 const floor=groundHeight(actor.position.x,actor.position.z,Math.max(oldY,actor.position.y)),landed=actor.position.y<=floor&&actor.velocity.y<=0;
 if(landed){if(!actor.grounded&&actor.velocity.y<-8){if(actor===player)sound('land');if(actor===player||actor.position.distanceTo(player.position)<16)burst(actor.position.clone().setY(floor+.1),0xad9b87,6,.4);}if(!actor.grounded){const visual=actor===player?playerAvatar:actor;if(visual?.animator?.actions.Jump_Land&&time>(visual.animUntil??0)){animateActor(visual,'Jump_Land',true,1.5);visual.animUntil=time+.12;}}actor.position.y=floor;actor.velocity.y=0;actor.grounded=true;actor.jumps=0;}else actor.grounded=false;
 actor.inLava=isLava(actor.position.x,actor.position.z,actor.position.y)&&actor.position.y<.025;decayKnockback(actor,dt);
}
function ignite(actor,owner=null,duration=4){
 if(actor===player&&admin.god||safeZone(actor.position))return;
 actor.effects??={};const previous=actor.effects.fire;
 actor.effects.fire={type:'fire',level:previous?.level??0,owner:previous?.owner??owner,until:Math.max(previous?.until??0,time+duration),next:previous?.next??time+.75,interval:.75,ticks:Math.max(previous?.ticks??0,Math.ceil(duration/.75)),damage:previous?.damage??4};
}
function updatePlayer(dt){const strideStart=player.position.clone();if(isDueling()&&(duel.phase!=='active'||player.health<=0)){player.velocity.set(0,0,0);return;}updateAilments(player,dt);if(player.health<=0)return;if(!freecam.active)player.crouched=!admin.flying&&!chatOpen&&(crouchTouch||keys.has('KeyC')||keys.has('ControlLeft')||keys.has('ControlRight'));crouchBlend=THREE.MathUtils.lerp(crouchBlend,player.crouched?1:0,1-Math.exp(-18*dt));const kit=KITS[selectedKit],gear=weaponStats(equippedItem(profile));let ix=chatOpen||freecam.active?0:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x,iz=chatOpen||freecam.active?0:(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touchMove.z;const length=Math.hypot(ix,iz);if(length>1){ix/=length;iz/=length;}sprinting=updateSprint(player,(keys.has('ShiftLeft')||keys.has('ShiftRight')||(touch&&length>.8))&&iz<-.1&&!blockHeld&&!player.crouched&&!admin.flying);const speed=movementSpeed(kit,gear.speed,sprinting)*(blockHeld?MOVEMENT.block:1)*(player.crouched?MOVEMENT.crouch:1)*(time<buffs.haste?POTIONS.haste.multiplier:1)*slowMultiplier(player)*(admin.flying?MOVEMENT.flight:1),vx=(ix*Math.cos(yaw)+iz*Math.sin(yaw))*speed,vz=(-ix*Math.sin(yaw)+iz*Math.cos(yaw))*speed;steerMovement(player,vx,vz,dt);if(admin.flying){const down=keys.has('KeyC')||keys.has('ControlLeft')||keys.has('ControlRight')||crouchTouch;player.velocity.y=chatOpen||freecam.active?0:((keys.has('Space')?1:0)-(down?1:0))*8;player.position.addScaledVector(player.velocity,dt);resolveCollision(player.position,.38,1.7);player.position.y=THREE.MathUtils.clamp(player.position.y,groundHeight(player.position.x,player.position.z,player.position.y),24);player.grounded=false;player.knock.set(0,0,0);}else actorPhysics(player,dt);const distance=Math.hypot(player.position.x-strideStart.x,player.position.z-strideStart.z);if(player.grounded&&!admin.flying&&distance>0&&distance<1){const stride=gaitStride(playerAvatar?.animator.gait.leg??.8,distance/dt,player.crouched),previous=Math.floor(walkTime/Math.PI);walkTime+=distance/stride*Math.PI*2;if(Math.floor(walkTime/Math.PI)!==previous&&time-lastFootstep>.09){sound('step');lastFootstep=time;}}if(isLava(player.position.x,player.position.z,player.position.y)&&time-lavaTick>.46){ignite(player);hurtPlayer(9,null,true);lavaTick=time;}if(player.health>0&&time-player.lastDamage>6&&player.health<kit.health)player.health=Math.min(kit.health,player.health+9*dt);if(returnAt&&time>=returnAt)completeReturn();}
function chooseTarget(f){
 if(admin.hunt){const target=mode==='play'&&player.health>0&&!safeZone(player.position)?player:null;if(target!==f.target)f.reactionUntil=time+f.skill.reaction;f.target=target;f.targetUntil=time+.6;return;}
 const candidates=fighters.filter(o=>o!==f&&o.alive&&o.state==='fight'&&!safeZone(o.position)&&canHit(f,o));
 if(mode==='play'&&player.health>0&&!safeZone(player.position)&&canHit(f,player)){const count=fighters.filter(o=>o!==f&&o.target===player&&o.plan==='duel').length;if(f.team||count<3+streakTier(player.streak)||f.position.distanceTo(player.position)<2.7)candidates.push(player);}
 let target=null,score=Infinity;for(const c of candidates){if(lineBlocked(f.position,c.position))continue;const value=targetScore(f,c,c===player,c===f.target);if(value<score){score=value;target=c;}}
 if(target!==f.target)f.reactionUntil=time+f.skill.reaction;f.target=target;f.targetUntil=time+.7+f.skill.reaction*2;
}
function planFighter(f){
 if(f.team){f.plan=f.hp<f.kit.health*.28&&time>f.healAt?'retreat':'duel';f.goal=f.plan==='retreat'?{x:MINI.x+(f.position.x<MINI.x?-8:8),y:0,z:f.position.z<0?8:-8}:f.target?tacticalGoal(f,f.target):f.position.clone();f.goal.x=THREE.MathUtils.clamp(f.goal.x,MINI.x-9.8,MINI.x+9.8);f.goal.z=THREE.MathUtils.clamp(f.goal.z,-11.7,11.7);f.planUntil=time+1.5;return;}

 const danger=arenaEvent.phase!=='idle'&&arenaEvent.type?.kind!=='supply';
 if(danger){f.plan='cover';f.goal=nearestBridgeCover(f.position,f.id);f.planUntil=arenaEvent.at+.2;return;}
 if(f.hp<f.kit.health*.32&&time>f.healAt){f.plan='retreat';f.goal=nearestBridgeCover(f.position,f.id);f.planUntil=time+5.5;return;}
 if(admin.hunt&&f.target){f.plan='duel';f.goal=tacticalGoal(f,f.target,true);f.planUntil=time+1;return;}
 const drops=supplyDrops.filter(d=>!d.collected&&d.position.y<2.5).sort((a,b)=>a.position.distanceTo(f.position)-b.position.distanceTo(f.position));
 if(drops.length&&(f.hp<f.kit.health*.65||f.account.coins<CHEST_PRICE||!f.target)&&drops[0].position.distanceTo(f.position)<18){f.plan='loot';f.goal=drops[0].position;f.planUntil=time+7;return;}
 if(f.target){f.plan='duel';f.goal=tacticalGoal(f,f.target);f.planUntil=time+1.3+f.skill.reaction;}
 else{f.plan='roam';f.goal=DESTINATIONS[(f.id+Math.floor(time/12))%DESTINATIONS.length];f.planUntil=time+5;}
 f.lastPlanAt=time;
}
function updateBotEconomy(f,dt){
 // A small survival stipend also lets weaker opponents eventually upgrade.
 if(mode==='play'&&time>=f.incomeAt){f.account.coins+=BOTS.economy.income;f.incomeAt=time+BOTS.economy.incomeInterval;}
 if(f.hp<f.kit.health*BOTS.healing.threshold&&time>f.potionAt&&f.account.potions.healing>0){consumePotion(f.account,'healing');f.hp=Math.min(f.kit.health,f.hp+POTIONS.healing.amount);f.potionAt=time+BOTS.healing.cooldown;burst(f.position.clone().add(new V3(0,.9,0)),0xf38c99,14,.5);}
 if(f.team)return false;
 if(f.returnAt){
  const unsafe=admin.hunt||time-f.lastImpact<5||f.target&&f.position.distanceTo(f.target.position)<8;
  if(unsafe){f.returnAt=0;f.spendAt=time+6;}
  else if(time>=f.returnAt){f.spendAt=time+22;spawnFighter(f,true);return true;}
 }
 if(!admin.hunt&&!f.returnAt&&time>=f.spendAt&&time-f.lastImpact>6&&f.account.coins>=BOTS.economy.shopMinimumCoins&&(!f.target||f.position.distanceTo(f.target.position)>10)&&arenaEvent.phase==='idle'&&choosePurchase(f.account,f.role,.2+(f.id%9)*.085)){
  f.returnAt=time+3;f.plan='return';f.goal=f.position.clone();f.planUntil=time+3.2;
 }
 return false;
}
function syncBotEquipment(f){
 f.item=equippedItem(f.account);f.stats=weaponStats(f.item);f.armor=f.account.armor;f.helmet=f.account.helmet;f.activeItemId=null;setBotLoadout(f,Infinity);
}
function setBotLoadout(f,distance){
 const preferred=equippedItem(f.account),preferredStats=weaponStats(preferred),bow=f.role==='archer'&&f.arrowStock>0&&distance>(f.combatMode==='bow'?4.3:6.3)&&distance<31;
 let item=preferred;
 if(preferredStats.kind==='staff'&&distance<(f.combatMode==='melee'?5:3.8))item=f.account.inventory.filter(i=>i.weapon&&!WEAPONS[i.weapon].kind).sort((a,b)=>weaponStats(b).damage-weaponStats(a).damage)[0]??preferred;
 const nextMode=bow?'bow':WEAPONS[item.weapon].kind==='staff'?'staff':'melee';
 if(f.activeItemId!==item.id||f.role==='archer'&&!f.bow?.parent){
  attachGear(f.rig,item,f.armor,f.helmet);f.activeItemId=item.id;
  if(f.role==='archer'){const model=prepareModel(models['bow.glb'].scene.clone(true));model.userData.equipment=true;model.userData.slot='bow';model.position.set(0,.07,0);model.rotation.z=-Math.PI/2;model.scale.setScalar(.8);f.rig.getObjectByName('WristL')?.add(model);f.bow=model;}
 }
 if(f.combatMode!==nextMode)f.bowDrawAt=-1;f.combatMode=nextMode;f.item=item;f.stats=weaponStats(item);
 f.rig.traverse(o=>{if(o.userData.slot)o.visible=o.userData.slot===(bow?'bow':'sword');});
}
function botBow(f,target){
 if(time<f.nextArrow||f.arrowStock<=0||safeZone(target.position)||lineBlocked(f.position,target.position)){f.bowDrawAt=-1;return;}
 const origin=f.position.clone().add(new V3(0,1.45,0)),distance=origin.distanceTo(target.position),flight=distance/54;
 const aim=target.position.clone().add(new V3((target.velocity?.x??0)*flight,target.crouched?.65:1,(target.velocity?.z??0)*flight));aim.y+=5*flight*flight;
 const error=f.skill.aimError*distance*.18;aim.x+=Math.sin(time*1.7+f.id)*error;aim.z+=Math.cos(time*2.1+f.id)*error;
 const direction=aim.sub(origin).normalize();if(direction.x*Math.sin(f.aimAngle)+direction.z*Math.cos(f.aimAngle)<.8){f.bowDrawAt=-1;return;}
 if(f.bowDrawAt<0){f.bowDrawAt=time;animateActor(f,'Idle_Gun');}
 f.animUntil=time+.12;if(time-f.bowDrawAt<.7+f.skill.reaction*.5)return;
 const charge=Math.min(1,(time-f.bowDrawAt)/BOW.fullDraw),mesh=arrowMesh();mesh.position.copy(origin).addScaledVector(direction,.5);const velocity=direction.multiplyScalar(26+charge*31);mesh.quaternion.setFromUnitVectors(new V3(0,0,-1),velocity.clone().normalize());scene.add(mesh);
 projectiles.push({kind:'arrow',mesh,velocity,life:3,damage:arrowDamage(charge),owner:f,stats:{damage:arrowDamage(charge),knockback:3,effects:[]}});
 f.arrowStock--;f.bowDrawAt=-1;f.nextArrow=time+.55+f.skill.reaction;f.lastSwing=time;if(f.position.distanceTo(player.position)<22)sound('arrow');
}
function updateBotSpawn(f,dt){
 f.healthBg.quaternion.copy(camera.quaternion);f.label.material.opacity=1;
 if(f.position.z<18.8&&f.position.y<7.6){f.state='fight';f.target=null;f.nextClick=time+f.skill.reaction;f.nextJump=time+.2;f.planUntil=0;f.spendAt=time+18;f.navigation=null;return;}
 if(time<f.spawnUntil){animateActor(f,time<(f.talkUntil??0)?'Talk':f.id%3===0?'StanceAlt':f.stats.kind==='staff'?'CastIdle':'Idle_Sword');f.velocity.x=f.velocity.z=0;actorPhysics(f,dt);return;}
 if(!f.shopComplete&&f.purchase&&time-f.shopStarted<8){
  f.state='shopping';const station=stations.find(s=>s.type===f.purchase.station),distance=f.position.distanceTo(station.position);
  if(distance>2){const direction=chooseSteer(f.position,station.position,blocked,()=>false,time,f.id);const pace=distance<4?MOVEMENT.shop:MOVEMENT.walk;f.velocity.x=direction.x*pace;f.velocity.z=direction.z*pace;f.aimAngle=turnAngle(f.aimAngle,Math.atan2(direction.x,direction.z),dt*9);animateActor(f,distance<4?'WalkFormal':'Run',false,1.1);}
  else{
   f.velocity.x=f.velocity.z=0;if(!f.purchaseAt){const gesture=f.purchase.kind==='chest'?'Interact':'Pickup';animateActor(f,gesture,true,f.purchase.kind==='chest'?1.5:1.6);}f.purchaseAt ||= time+(f.purchase.kind==='chest'?1.1:.55);if(f.purchase.kind==='chest')chestLidUntil=time+.6;
   if(time>=f.purchaseAt){const choice=f.purchase,result=transactBot(f.account,choice,f.role);if(result.ok){syncBotEquipment(f);f.lastPurchase=choice.kind==='chest'?`I rolled ${weaponStats(result.item).name}${result.item.effects?.length?' with '+result.item.effects.map(e=>EFFECTS[e.type].name).join(' and '):''}. ${result.changed?'It’s my new main weapon.':'My current weapon is still better, so I kept it.'}`:choice.kind==='armor'?`I bought ${ARMORS[choice.id].name.toLowerCase()}. I have ${f.account.coins} coins left.`:`I restocked at the ledge. ${f.stats.name} is ready.`;if(mode==='play'&&Math.random()<.4)pendingChats.push({at:time+1,bot:f,text:f.lastPurchase});burst(f.position.clone().add(new V3(0,1,0)),0xffce88,10,.5);}f.shopComplete=true;f.state='spawn';f.purchase=null;}
  }
  actorPhysics(f,dt);return;
 }
 f.shopComplete=true;f.state='spawn';
 if(Math.abs(f.position.x-LEDGE_EXIT.x)<LEDGE_EXIT.laneHalfWidth&&f.position.z<LEDGE_EXIT.laneZ)f.exitStage=true;
 const goal=navigationGoal(f,{x:f.exitX,z:f.exitStage?LEDGE_EXIT.dropZ:LEDGE_EXIT.approachZ,y:LEDGE_HEIGHT},time,blocked,()=>false,0),dir=chooseSteer(f.position,goal,blocked,()=>false,time,f.id);f.velocity.x=dir.x*MOVEMENT.walk;f.velocity.z=dir.z*MOVEMENT.walk;f.aimAngle=turnAngle(f.aimAngle,Math.atan2(dir.x,dir.z),dt*8);animateActor(f,'Run',false,1.1);
 if(f.exitStage&&f.grounded&&f.position.z<LEDGE_EXIT.jumpZ){f.velocity.y=7.7;f.grounded=false;f.jumps=1;}actorPhysics(f,dt);
 if(f.position.y<1.6&&f.grounded){f.state='fight';f.target=null;f.nextClick=time+f.skill.reaction;f.nextJump=time+.2;f.planUntil=0;f.spendAt=time+18;}
}
function botCast(f,target){
 if(time-f.lastCast<f.stats.cooldown||safeZone(target.position)||lineBlocked(f.position,target.position))return;
 f.lastCast=time;f.lastSwing=time;animateActor(f,'Cast',true,1.7);f.animUntil=time+.3;
 const origin=f.position.clone().add(new V3(0,1.4,0)),lead=Math.min(.6,f.position.distanceTo(target.position)/f.stats.projectileSpeed),aim=target.position.clone().add(new V3((target.velocity?.x??0)*lead,target.crouched?.7:1,(target.velocity?.z??0)*lead));
 const error=f.skill.aimError*2;aim.add(new V3((Math.random()-.5)*error,Math.sin(time+f.id)*error,(Math.random()-.5)*error));const direction=aim.sub(origin).normalize();
 // Reaction and turning still gate the shot, so ranged bots cannot shoot behind themselves.
 if(direction.x*Math.sin(f.aimAngle)+direction.z*Math.cos(f.aimAngle)<.65)return;
 const mesh=magicMesh(f.stats.color);mesh.position.copy(origin).addScaledVector(direction,.5);scene.add(mesh);projectiles.push({kind:'magic',mesh,velocity:direction.multiplyScalar(f.stats.projectileSpeed),life:f.stats.reach/f.stats.projectileSpeed,damage:f.stats.damage,stats:{...f.stats},owner:f,trailAt:0});if(f.position.distanceTo(player.position)<18)sound('magic');
}

function updateFighters(dt){for(const f of fighters){updateAilments(f,dt);updateAnimator(f,dt);updateAppearance(f,dt);if(!f.alive){if(!f.team&&time>=f.respawnAt)spawnFighter(f);continue;}
 if(f.team&&duel.phase!=='active'){f.velocity.set(0,0,0);continue;}
 if(f.state==='signup'){updateSignup(f,dt);continue;}
 if(f.state==='spawn'||f.state==='shopping'){updateBotSpawn(f,dt);continue;}
 if(updateBotEconomy(f,dt))continue;
 if(!f.target||(f.target!==player&&!f.target.alive)||(f.target===player&&(mode!=='play'||safeZone(player.position)))||safeZone(f.target.position)||!canHit(f,f.target)||time>f.targetUntil)chooseTarget(f);
 setBotLoadout(f,f.target?f.position.distanceTo(f.target.position):Infinity);
 const danger=!f.team&&arenaEvent.phase!=='idle'&&arenaEvent.type?.kind!=='supply';if(time>f.planUntil||!f.goal||danger&&f.plan!=='cover'||!danger&&f.plan==='cover'||f.goal&&Math.hypot(f.goal.x-f.position.x,f.goal.z-f.position.z)<1.2&&['roam','flank'].includes(f.plan))planFighter(f);
 let target=f.target,dist=target?f.position.distanceTo(target.position):Infinity;
 if(f.plan==='roam'&&dist<3.8){f.plan='duel';f.planUntil=time+3;}
 let goal=f.plan==='duel'&&target?tacticalGoal(f,target,admin.hunt):f.goal??f.position;if(f.team){goal={...goal,x:THREE.MathUtils.clamp(goal.x,MINI.x-9.8,MINI.x+9.8),z:THREE.MathUtils.clamp(goal.z,-11.7,11.7)};}
 if(!f.team)goal=navigationGoal(f,goal,time,blocked,isLava);
 const marked=hazardMarks.find(h=>h.at>time&&Math.hypot(h.ring.position.x-f.position.x,h.ring.position.z-f.position.z)<2.4);if(marked&&!isUnderBridge(f.position)){let dx=f.position.x-marked.ring.position.x,dz=f.position.z-marked.ring.position.z;if(Math.hypot(dx,dz)<.1){dx=Math.sin(f.id*2);dz=Math.cos(f.id*2);}const d=Math.hypot(dx,dz);goal={x:f.position.x+dx/d*4,z:f.position.z+dz/d*4,y:f.position.y};f.aiTimer=0;}
 if(f.plan==='retreat'&&time>f.healAt&&Math.hypot(goal.x-f.position.x,goal.z-f.position.z)<1.8){if(f.account.potions.healing>0){consumePotion(f.account,'healing');f.hp=Math.min(f.kit.health,f.hp+POTIONS.healing.amount);}else if(time-f.lastImpact>6)f.hp=Math.min(f.kit.health,f.hp+50);f.healAt=time+22;f.planUntil=time+.7;burst(f.position.clone().add(new V3(0,.8,0)),0x98e9bd,12,.6);}
 const closeDuel=target&&dist<(f.combatMode==='bow'?30:f.stats.kind==='staff'?f.stats.reach:8)&&f.plan!=='cover'&&f.plan!=='retreat',lookAt=closeDuel?target.position:goal,delta=new V3(lookAt.x-f.position.x,(lookAt.y??0)-f.position.y,lookAt.z-f.position.z),flat=Math.hypot(delta.x,delta.z),error=f.skill.aimError*(Math.sin(time*5.3+f.id*17)+Math.sin(time*2.7+f.id)*.35);
 if(flat>.1)f.aimAngle=turnAngle(f.aimAngle,Math.atan2(delta.x,delta.z)+(closeDuel?error:0),dt*f.skill.turn);f.aimPitch=THREE.MathUtils.lerp(f.aimPitch,Math.atan2(delta.y-(target?.crouched?.87:.54),Math.max(.1,flat))+error*.4,Math.min(1,dt*f.skill.turn));
 if(time>f.strafeUntil){f.strafeUntil=time+.22+Math.random()*.6;f.strafe=Math.random()<.5?-1:1;}const incoming=target===player?swingAge<.23:target&&time-target.lastSwing<.25;f.guard=f.combatMode!=='bow'&&f.stats.kind!=='staff'&&!!closeDuel&&dist<3.6&&!!incoming&&f.skill.cps>5&&Math.sin(time*4+f.id)>-.35;
 f.wTapping=time>=(f.sprintReleaseAt||Infinity)&&time<f.sprintReleaseUntil;
 const forwardIntent=f.direction.x*Math.sin(f.aimAngle)+f.direction.z*Math.cos(f.aimAngle);
 f.sprinting=updateSprint(f,!!closeDuel&&f.plan==='duel'&&dist>1.8&&forwardIntent>.15&&!f.guard&&!f.wTapping&&time>(f.rollUntil??0));
 if(f.combatMode==='bow'&&target&&f.plan==='duel'&&time>=f.reactionUntil)botBow(f,target);else if(f.plan!=='duel')f.bowDrawAt=-1;
 if(f.combatMode!=='bow'&&time>(f.rollUntil??0)&&target&&dist<f.stats.reach+1&&time>=f.nextClick&&time>=f.reactionUntil&&f.plan!=='retreat'&&f.plan!=='return'&&!f.guard){f.nextClick=time+(f.stats.kind==='staff'?f.stats.cooldown:clickInterval(f.skill));if(f.stats.kind==='staff')botCast(f,target);else botSwing(f,target);}
 const settled=!f.inLava&&(f.plan==='return'||f.plan==='duel'&&(f.combatMode==='bow'||f.stats.kind==='staff')&&Math.hypot(goal.x-f.position.x,goal.z-f.position.z)<1.5||f.plan==='cover'&&isUnderBridge(f.position)||f.plan==='retreat'&&Math.hypot(goal.x-f.position.x,goal.z-f.position.z)<1.8);
 if(time>(f.rollUntil??0)&&time>f.nextJump&&f.grounded&&!settled&&!f.lavaCrossing&&lavaDistance(f.position.x,f.position.z)>2.3&&f.velocity.lengthSq()>7){f.nextJump=time+.5+Math.random()*.9;if(Math.random()<(closeDuel?f.skill.jump:.12)){f.velocity.y=7.2+Math.random()*.6;f.grounded=false;f.jumps=1;}}
 if(!f.grounded&&f.jumps===1&&f.velocity.y<-.5&&closeDuel&&f.skill.cps>=7&&Math.sin(time*3+f.id)>.9&&!f.lavaCrossing&&!settled){f.velocity.y=7.1;f.jumps=2;burst(f.position.clone(),0xc5dcff,5,.4);}
 f.aiTimer-=dt;if(f.aiTimer<=0){f.aiTimer=.045+f.skill.reaction*.2;let tx=goal.x,tz=goal.z;
  if(f.plan==='cover'&&f.position.y>2.8){tx=f.position.x;tz=f.position.z>-10?-6.9:-13.1;}else if((goal.y??0)>3.5&&f.position.y<4.95){const side=goal.x<0?-25.1:25.1;if(Math.abs(f.position.x-side)>1.7||f.position.z>12){tx=side;tz=12.3;}else{tx=side;tz=-10;}}
  if((f.grounded||f.inLava)&&!settled&&!f.lavaCrossing){const crossing=planLavaJump(f.position,{x:tx,z:tz},blocked,isLava);if(crossing){f.lavaCrossing={...crossing,until:time+crossing.duration+.1};f.velocity.set(crossing.x*crossing.speed,crossing.vertical,crossing.z*crossing.speed);f.grounded=false;f.nextJump=time+1;}}
  const direction=chooseSteer(f.position,{x:tx,z:tz},blocked,isLava,time,f.id),strafeAmount=closeDuel&&f.plan==='duel'?(admin.hunt?.22:.45)*f.strafe:0;f.direction.set(direction.x+Math.cos(f.aimAngle)*strafeAmount,0,direction.z-Math.sin(f.aimAngle)*strafeAmount);
  if(closeDuel&&dist<1.5&&f.plan==='duel')f.direction.set(-Math.sin(f.aimAngle)*.4+Math.cos(f.aimAngle)*f.strafe,0,-Math.cos(f.aimAngle)*.4-Math.sin(f.aimAngle)*f.strafe);
  f.direction.normalize();if(blocked(f.position.x+f.direction.x*.8,f.position.z+f.direction.z*.8,f.position.y)||isLava(f.position.x+f.direction.x*.9,f.position.z+f.direction.z*.9,f.position.y))f.direction.set(direction.x,0,direction.z);
 }
 const moveSpeed=settled?0:movementSpeed(f.kit,f.stats.speed,f.sprinting)*Math.min(1,f.skill.aggression)*(f.guard?.48:1)*(f.plan==='retreat'?1.25:1)*slowMultiplier(f);
 let mx=f.direction.x*moveSpeed,mz=f.direction.z*moveSpeed;
 if(f.wTapping){const forward=Math.max(0,mx*Math.sin(f.aimAngle)+mz*Math.cos(f.aimAngle));mx-=Math.sin(f.aimAngle)*forward;mz-=Math.cos(f.aimAngle)*forward;}
 steerMovement(f,mx,mz,dt);
 if(f.grounded&&!settled&&!f.lavaCrossing&&time>(f.nextRoll??0)&&time-f.lastImpact>.5&&f.skill.cps>=6.5&&(f.plan==='retreat'||marked)&&dist>3.4&&Math.hypot(f.velocity.x,f.velocity.z)>2){
  const direction=new V3(f.velocity.x,0,f.velocity.z).normalize();let clear=true;
  for(let d=.4;d<=3;d+=.4)if(blocked(f.position.x+direction.x*d,f.position.z+direction.z*d,f.position.y)||isLava(f.position.x+direction.x*d,f.position.z+direction.z*d,f.position.y))clear=false;
  if(clear){f.rollDirection=direction;f.rollUntil=time+.5;f.nextRoll=time+6+(f.id%9)*.25;f.animUntil=f.rollUntil;animateActor(f,'Roll',true,(f.animator.actions.Roll?.getClip().duration??1.46)/.5);}
 }
 if(time<(f.rollUntil??0)){f.guard=false;f.velocity.x=f.rollDirection.x*6;f.velocity.z=f.rollDirection.z*6;f.rig.rotation.y=Math.atan2(f.rollDirection.x,f.rollDirection.z);}
 for(const other of fighters){if(other===f||!other.alive||Math.abs(other.position.y-f.position.y)>1.3)continue;const dx=f.position.x-other.position.x,dz=f.position.z-other.position.z,d=Math.hypot(dx,dz);if(d>.001&&d<.82){f.velocity.x+=dx/d*(.82-d)*14*dt;f.velocity.z+=dz/d*(.82-d)*14*dt;}}
 if(f.lavaCrossing){f.velocity.x=f.lavaCrossing.x*f.lavaCrossing.speed;f.velocity.z=f.lavaCrossing.z*f.lavaCrossing.speed;}actorPhysics(f,dt);if(f.lavaCrossing&&(f.grounded||time>f.lavaCrossing.until))f.lavaCrossing=null;if(time-f.lastImpact>6)f.hp=Math.min(f.kit.health,f.hp+9*dt);if(time>f.animUntil)locomotion(f,f,Math.hypot(f.velocity.x,f.velocity.z)>.7,f.plan==='retreat');if(isLava(f.position.x,f.position.z,f.position.y)&&time-(f.lastLava??-20)>.48){ignite(f);f.lastLava=f.lastImpact=time;f.hp-=9;if(f.hp<=0)killFighter(f,null);}
 f.healthFill.scale.x=Math.max(0,f.hp/f.kit.health);f.healthFill.position.x=-(1-f.healthFill.scale.x)*.38;f.healthBg.quaternion.copy(camera.quaternion);const visibleDistance=camera.position.distanceTo(f.position);f.label.visible=visibleDistance<34;f.healthBg.visible=visibleDistance<18;f.label.material.opacity=Math.min(1,Math.max(0,(39-visibleDistance)/8));}}

const critEffects=[];
function criticalImpact(point){
 burst(point,0xffd783,18,1.25);burst(point,0xd8faff,7,.8);
 if(critEffects.length>=8)return;const shape=new THREE.Shape();for(let n=0;n<16;n++){const angle=n*Math.PI/8,r=n%2?.13:n%4===0?.68:.39,x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(!n)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();
 const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xffe3a1,transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false}));mesh.position.copy(point);scene.add(mesh);critEffects.push({mesh,life:.36});
}

function damageNumber(position,amount,crit=false){const p=position.clone().project(camera);if(p.z>1||p.z< -1)return;const el=document.createElement('span');el.textContent=(crit?'CRIT · ':'')+amount;if(crit)el.className='critical';el.style.left=((p.x*.5+.5)*innerWidth+Math.random()*24-12)+'px';el.style.top=((-p.y*.5+.5)*innerHeight-12)+'px';$('damage-numbers').append(el);setTimeout(()=>el.remove(),650);}
function swing(heavyPower=null){
 if(player.health<=0||mode!=='play'||chatOpen||freecam.active||selectedSlot!=='sword'||time<meleeRecoveryUntil)return;
 if(WEAPONS[equippedItem(profile).weapon].kind==='staff'){castSpell();return;}
 const heavy=heavyPower!==null;heavySwingPower=heavy?heavyPower:0;if(heavy)meleeRecoveryUntil=time+heavyRecovery(heavyPower);else clickTimes.push(time);blockHeld=false;swingAge=0;firstPersonSwingSequence++;sound(heavy?'heavy':'swing');if(playerAvatar){playerAvatar.emoting=false;if(heavy||time>=(playerAvatar.bodySwingUntil??-Infinity)){const duration=heavy?.38:.31;playerAvatar.bodySwingUntil=time+duration;attackAnimation(playerAvatar,duration);}}if(safeZone(player.position))return;
 const base=weaponStats(equippedItem(profile)),gear=heavy?chargedStats(base,heavyPower):base,origin=player.position.clone().add(new V3(0,player.crouched?1.02:1.52,0)),direction=aimDirection();let victim=null,distance=Infinity;
 for(const f of fighters){if(!f.alive||f.state!=='fight'||safeZone(f.position)||!canHit(player,f))continue;const d=rayHitCandidate(origin,direction,f.position,gear.reach,f.crouched?HITBOX.crouched:HITBOX.height);if(d!==null&&d<distance&&!lineBlocked(player.position,f.position)){distance=d;victim=f;}}
 if(!victim)return;
 const critical=!player.grounded&&player.velocity.y<-.65,didDamage=hurtFighter(victim,player,critical,null,heavy?gear:null);
 if(didDamage){if(critical)criticalUntil=time+.28;hitmarkerUntil=time+(critical?.24:.095);$('hitmarker').classList.toggle('critical',critical);$('hitmarker').style.color=critical?'#ffca63':'#ffeacf';combo=player.comboCount;lastHit=time;shake=critical?.05:.018;if(combo>1){$('combo').classList.remove('hidden');$('combo').textContent=combo+'×';}else $('combo').classList.add('hidden');if(heavy){criticalImpact(victim.position.clone().add(new V3(0,1.05,0)));shockwave(victim.position,0xffe0a3);shake=Math.max(shake,.04);}sound(heavy?'heavy':critical?'critical':'hit');}else sound('clang');
}
function botSwing(f,target){
 if(time-f.lastSwing>.31){attackAnimation(f,.31);f.lastSwing=time;}
 const origin=f.position.clone().add(new V3(0,f.crouched?1.02:1.52,0)),hit=hitCandidate(origin,f.aimAngle+Math.PI,f.aimPitch,target.position,f.stats.reach,target.crouched?HITBOX.crouched:HITBOX.height);
 if(hit===null||lineBlocked(f.position,target.position)||safeZone(target.position))return;
 const crit=!f.grounded&&f.velocity.y<-.7;if(target===player)hurtPlayer(f.stats.damage,f,false,crit);else hurtFighter(target,f,crit);
}
function applyKnock(victim,attacker,force,critical,guarded=false,melee=false){
 const boosted=melee&&consumeSprintHit(attacker,time);
 if(melee){registerMeleeHit(attacker,victim,time);if(attacker===player)sprinting=!!player.sprint.active;else if(attacker.sprint.needsReset&&attacker.skill.cps>=5.6){attacker.sprintReleaseAt=time+.06+attacker.skill.reaction*.45;attacker.sprintReleaseUntil=attacker.sprintReleaseAt+.065+attacker.skill.reaction*.25;attacker.sprinting=false;}}
 combatKnockback(victim,attacker,force,critical,guarded,boosted);
}
function hurtFighter(f,attacker,critical=false,overrideDamage=null,attackStats=null){
 if(!f.alive||safeZone(f.position)||attacker&&!canHit(attacker,f))return false;
 const yours=attacker===player,stats=attackStats??(yours?weaponStats(equippedItem(profile)):attacker.stats),kit=yours?KITS[selectedKit]:attacker.kit,point=f.position.clone().add(new V3(0,1.05,0));
 if(yours||f.position.distanceTo(player.position)<16)burst(point,yours?RARITIES[equippedItem(profile).rarity].hex:0xffd8a5,!damageReady(f,time)?3:9,critical?1.35:.85);
 if(!damageReady(f,time))return false;
 const dx=attacker.position.x-f.position.x,dz=attacker.position.z-f.position.z,guarded=f.guard&&(dx*Math.sin(f.aimAngle)+dz*Math.cos(f.aimAngle)>0),amount=stats.absoluteDamage&&overrideDamage===null?stats.damage:attackDamage(overrideDamage??stats.damage,kit,critical,guarded,armorReduction(f));
 if(critical)criticalImpact(point);f.hp-=amount;f.lastImpact=f.lastDirectHit=time;breakCombo(f);f.returnAt=0;f.hitFlashUntil=time+.2;f.target=admin.hunt?player:attacker;f.targetUntil=time+1.5;
 if(f.plan!=='cover'&&f.plan!=='retreat'){f.plan='duel';f.planUntil=time+3.5;}f.reactionUntil=Math.min(f.reactionUntil,time+f.skill.reaction);applyKnock(f,attacker,stats.knockback,critical,guarded,(attackStats===null||stats.melee)&&overrideDamage===null);
 if(!guarded&&(stats.heavy||critical||amount>=f.kit.health*.18))triggerImpact(f,attacker,time,stats.heavy?1.4:1);
 if(yours){lastCombat=time;returnAt=0;damageNumber(f.position.clone().add(new V3(0,1.55,0)),amount,critical);}
 if(f.hp<=0)killFighter(f,attacker);else{if(!guarded)applyWeaponEffects(f,attacker,stats);if(time-f.lastSwing>.12){animateActor(f,critical?'HitHead':(f.hitsTaken=(f.hitsTaken??0)+1)%2?'HitRecieve':'HitRecieve_2',true,2);f.animUntil=time+.14;}}
 if(overrideDamage===null&&stats.proc)triggerProc(attacker,f,stats);
 return true;
}
function rewardBot(bot,opponentRating){
 bot.kills++;bot.streak++;rewardKO(bot.account,opponentRating,bot.streak);bot.rating=bot.account.rating;
 bot.label.material.map.dispose();bot.label.material.map=nameTexture(bot.name,bot.rating);bot.hp=Math.min(bot.kit.health,bot.hp+45);
}
function killFighter(f,attacker,cause=null){
 if(!f.alive)return;ragdolls.spawn(f,f);f.root.visible=false;if(!cause||cause!=='Command')dropCarriedItems(f);f.alive=false;f.hp=0;f.streak=0;f.deaths++;f.respawnAt=time+2.7;f.target=null;f.returnAt=0;f.effects={};f.poison=null;f.slowUntil=0;f.label.visible=false;f.healthBg.visible=false;f.velocity.set(0,0,0);f.knock.set(0,0,0);f.lastDefeatBy=attacker===player?profile.name:attacker?.name??cause??'the arena';
 if(!cause){recordDeath(f.account,attacker===player?profile.rating:attacker?.rating??0);f.rating=f.account.rating;}
 let extra='';
 if(attacker===player){player.kills++;player.runKills++;player.streak++;const beforeLevel=rankFor(profile.rating).level;const reward=rewardKO(profile,f.rating,player.streak);persist();player.health=Math.min(KITS[selectedKit].health,player.health+56);refillStarterPotions(profile,Math.min(3,profile.inventory.find(i=>i.id==='starter-healing').count+1));player.potions=profile.potions.healing;persist();arrowCount=Math.min(BOW.maxArrows,arrowCount+BOW.knockoutArrows);extra=`${reward.rank.level>beforeLevel?'Level '+reward.rank.level+' · ':''}+${reward.coins} coins · +${reward.points} EXP`;toast(reward.rankUp?reward.rank.name+' rank · '+extra:extra,1800);sound('ko');burst(f.position.clone().add(new V3(0,1,0)),0xffcf77,30,1.6);shockwave(f.position,0xffce8d);healUntil=time+.25;updateProfileUI();if(Math.random()<.42)pendingChats.push({at:time+1.8+Math.random()*2,bot:f,text:botReply(f,'good fight',chatContext())});}
 else if(attacker)rewardBot(attacker,f.rating);
 addKill({killer:attacker===player?profile.name:attacker?.name??cause??(arenaEvent.phase==='active'?arenaEvent.type.name:'Lava'),victim:f.name,extra});
}
function defeatPlayer(attacker=null,cause='Arena',rewards=true){
 setFreecam(false,false);
 if(player.health<=0&&mode==='dead')return;cancelAttack(true);if(playerAvatar){playerAvatar.root.position.copy(player.position);ragdolls.spawn(playerAvatar,player);playerAvatar.root.visible=false;}if(rewards)dropCarriedItems(player);
 if(player.team){player.health=0;player.deaths++;player.streak=0;player.effects={};player.poison=null;keys.clear();blockHeld=false;bowDrawAt=-1;if(attacker&&rewards)rewardBot(attacker,profile.rating);if(rewards)recordDeath(profile,attacker?.rating??0);persist();addKill({killer:attacker?.name??cause,victim:profile.name});updateDuelHud();return;}

 player.health=0;player.deaths++;if(attacker&&rewards)rewardBot(attacker,profile.rating);player.streak=0;admin.flying=false;player.effects={};player.poison=null;
 const loss=rewards?recordDeath(profile,attacker?.rating??0):0;persist();addKill({killer:attacker?.name??cause,victim:profile.name,extra:loss?'−'+loss+' EXP':''});mode='dead';camera.position.copy(player.position).add(new V3(Math.sin(yaw)*4,3,Math.cos(yaw)*4));camera.lookAt(player.position.clone().add(new V3(0,.6,0)));camera.updateMatrixWorld(true);keys.clear();if(chatOpen)closeChat(false);document.exitPointerLock?.();
 $('death-reason').textContent=attacker?'Defeated by '+attacker.name+'.':cause==='Command'?'Eliminated by /killall.':'Caught by '+cause.toLowerCase()+'.';$('death-kills').textContent=player.runKills;$('death-best').textContent=profile.best;$('death-points').textContent='−'+loss;openModal('death');updateProfileUI();
}
function hurtPlayer(base,attacker=null,lava=false,critical=false,attackStats=null,periodic=false){
 if(mode!=='play'||admin.god||attacker&&!canHit(attacker,player)||safeZone(player.position)||player.health<=0||(!lava&&!periodic&&!damageReady(player,time)))return false;
 const stats=attackStats??attacker?.stats;let guarded=false;
 if(blockHeld&&attacker&&!periodic){const dx=attacker.position.x-player.position.x,dz=attacker.position.z-player.position.z;guarded=dx*-Math.sin(yaw)+dz*-Math.cos(yaw)>0;}
 const amount=lava||attackStats?.aura?base:stats?.absoluteDamage&&!periodic&&(attackStats===null||stats.melee)?stats.damage:attackDamage(base,attacker?.kit??KITS.vanguard,critical,guarded,1-(1-armorReduction(profile))*(time<buffs.guard?1-POTIONS.guard.reduction:1));
 player.health=Math.max(0,player.health-amount);player.lastDamage=time;if(!periodic){if(critical&&(thirdPerson||freecam.active))criticalImpact(player.position.clone().add(new V3(0,1,0)));player.lastImpact=time;if(!lava)player.lastDirectHit=time;breakCombo(player);combo=0;$('combo').classList.add('hidden');}lastCombat=time;lastHurt=time-(attackStats?.aura?.18:0);
 if(returnAt){returnAt=0;toast('Return interrupted');}if(attacker&&!periodic)applyKnock(player,attacker,stats.knockback,critical,guarded,(attackStats===null||stats.melee)&&!lava);if(attacker&&!periodic&&!lava&&!guarded&&(stats.heavy||critical||amount>=player.maxHealth*.18))triggerImpact(player,attacker,time,stats.heavy?1.4:1);shake=attackStats?.aura?.004:periodic?.015:guarded?.016:.07;if(!attackStats?.aura)sound(lava?'lava':guarded?'block':'hurt');
 if(player.health<=0)defeatPlayer(attacker,lava?(arenaEvent.phase==='active'?arenaEvent.type.name:'Lava'):'Arena');
 else if(attacker&&!lava&&!periodic&&!guarded)applyWeaponEffects(player,attacker,stats);
 if(attacker&&!lava&&!periodic&&!attackStats&&stats?.proc)triggerProc(attacker,player,stats);
 return true;
}
function drinkTonic(){if(player.health<=0)return;cancelAttack();
 if(mode!=='play'||chatOpen||time-lastTonic<1.1)return;
 const id=profile.selectedPotion,p=POTIONS[id];
 if(id==='healing'&&player.health>=KITS[selectedKit].health){toast('Health full');return;}
 if(id!=='healing'&&buffs[id]>time){toast(p.name+' is still active');return;}
 if(!consumePotion(profile,id,selectedSlot==='potion'?profile.hotbar[profile.selectedHotbar]:null)){toast('No '+p.name.toLowerCase()+'s · buy more on the ledge');return;}
 lastTonic=time;potionUsedAt=time;usedPotion=id;blockHeld=false;bowDrawAt=-1;
 if(id==='healing'){player.health=Math.min(KITS[selectedKit].health,player.health+p.amount);healUntil=time+.7;}else buffs[id]=time+p.duration;
 player.potions=profile.potions.healing;if(selectedSlot==='potion'&&!profile.inventory.some(i=>i.id===profile.hotbar[profile.selectedHotbar]))setSlot('empty');persist();showPotionBottle(id);sound('tonic');burst(player.position.clone().add(new V3(0,.8,0)),p.color,24,.7,player);shockwave(player.position,p.color,player);updateHud();
}
function cyclePotion(){const ids=Object.keys(POTIONS);profile.selectedPotion=ids[(ids.indexOf(profile.selectedPotion)+1)%ids.length];persist();updatePotionArt();updateHud();toast(POTIONS[profile.selectedPotion].name,1100);}
function updatePotionArt(){hotbarSignature='';}
function updateItemHud(){
 renderHotbar();
 const active=[];if(admin.god)active.push(admin.flying?'Admin · flying':'Admin');if(admin.hunt)active.push('Hunted');if((player.pressureSlow??1)<.99)active.push('Spiritual pressure');for(const [type,effect]of Object.entries(player.effects??{}))if(effect.until>time)active.push(EFFECTS[type].name+' '+Math.ceil(effect.until-time)+'s');if(player.slowUntil>time&&!player.effects?.frost)active.push('Frost '+Math.ceil(player.slowUntil-time)+'s');if(player.poison)active.push('Poison');if(buffs.haste>time)active.push('Haste '+Math.ceil(buffs.haste-time)+'s');if(buffs.guard>time)active.push('Guard '+Math.ceil(buffs.guard-time)+'s');$('active-effects').textContent=active.join(' · ');$('active-effects').classList.toggle('hidden',!active.length);
}
function showPotionBottle(id){
 if(potionHeld){weaponScene.remove(potionHeld);potionHeld.traverse(o=>{if(o.isMesh){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});}
 potionHeld=prepareModel(models[POTIONS[id].file].scene.clone(true));potionHeld.userData.asset=POTIONS[id].file;weaponScene.add(potionHeld);
 if(playerAvatar){const old=playerAvatar.rig.getObjectByName('DrinkingPotion');old?.removeFromParent();const bottle=prepareModel(models[POTIONS[id].file].scene.clone(true));bottle.name='DrinkingPotion';bottle.userData.equipment=true;bottle.userData.drink=true;bottle.position.set(0,.04,0);bottle.rotation.z=-Math.PI/2;playerAvatar.rig.getObjectByName('WristL')?.add(bottle);}
 updatePotionVisual();
}
function updatePotionVisual(){const age=time-potionUsedAt,drinking=age>=0&&age<.85;weaponPivot.visible=!drinking&&(selectedSlot==='sword'||selectedSlot==='bow');if(heldArmor)heldArmor.visible=selectedSlot==='armor'&&!drinking;if(heldOrb)heldOrb.visible=selectedSlot==='orb'&&!drinking;
 if(potionHeld){potionHeld.visible=drinking||selectedSlot==='potion';const rise=drinking?Math.sin(Math.min(1,age/.85)*Math.PI):0;potionHeld.position.set(.26-rise*.15,-.62+rise*.38,-.66);potionHeld.rotation.set(0,.25,-rise*1.15);}
 if(playerAvatar){const bottle=playerAvatar.rig.getObjectByName('DrinkingPotion');if(bottle)bottle.visible=drinking;}
}


let scoreSignature='';
function showScoreboard(){
 const list=[{name:profile.name,rating:profile.rating,kills:player.kills,deaths:player.deaths,streak:player.streak,you:true},...fighters.map(f=>({name:f.name,rating:f.rating,kills:f.kills,deaths:f.deaths,streak:f.streak}))].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths);
 $('career-stats').textContent='Career: '+profile.kills+' KOs · '+profile.rating.toLocaleString()+' EXP · best streak '+profile.best;$('scoreboard').classList.remove('hidden');
 const signature=JSON.stringify(list);if(signature===scoreSignature)return;scoreSignature=signature;
 const scroll=$('score-scroll'),top=scroll.scrollTop,columns=Math.min(3,Math.ceil(list.length/12)),perColumn=Math.ceil(list.length/columns),bodies=[$('score-rows'),$('score-rows-2'),$('score-rows-3')];
 $('score-tables').style.setProperty('--score-columns',columns);$('scoreboard').dataset.columns=String(columns);bodies.forEach((body,i)=>{body.replaceChildren();body.parentElement?.classList.toggle('hidden',i>=columns);});
 list.forEach((f,index)=>{const row=document.createElement('tr');if(f.you)row.className='player';const name=document.createElement('td'),r=document.createElement('span'),rank=rankFor(f.rating);r.className='table-rank';r.style.color=rank.color;r.innerHTML=rankIcon(rank);r.append(document.createTextNode('['+rank.name+'] Lv '+rank.level));name.append(r,document.createTextNode(f.name));if(!f.you){const b=document.createElement('span');b.className='ai-label';b.textContent='AI';name.append(b);}row.append(name);for(const value of[f.kills,f.deaths,f.streak]){const td=document.createElement('td');td.textContent=value;row.append(td);}bodies[Math.floor(index/perColumn)].append(row);});scroll.scrollTop=top;
}

function updateHud(){const kit=KITS[selectedKit],item=equippedItem(profile),gear=weaponStats(item),safe=safeZone(player.position);$('health').textContent=Math.ceil(player.health);$('max-health').textContent=kit.health;$('health-fill').style.width=Math.max(0,player.health/kit.health*100)+'%';updateItemHud();$('kills').textContent=player.kills;const held=profile.inventory.find(i=>i.id===profile.hotbar[profile.selectedHotbar]);$('equipped-name').textContent=held?itemName(held):'Empty slot';$('equipped-name').style.color=RARITIES[item.rarity].color;$('armor-value').textContent=Math.round(armorReduction(profile)*100)+'%';$('armor-track').classList.toggle('hidden',profile.armor==='none'&&profile.helmet==='none');while(clickTimes.length&&time-clickTimes[0]>5)clickTimes.shift();$('cps').textContent=clickTimes.filter(t=>time-t<1).length.toFixed(1);
 currentStation=null;if(safe&&!isDueling()){let nearest=3.3;for(const station of stations){const delta=new V3().subVectors(station.position,player.position);if(delta.length()<nearest&&(delta.x*-Math.sin(yaw)+delta.z*-Math.cos(yaw)>-.1)){currentStation=station;nearest=delta.length();}}}currentLoot=nearestLoot(player);$('interact-prompt').classList.toggle('hidden',!currentStation&&!currentLoot);if(currentLoot)$('interact-prompt').querySelector('span').textContent='Pick up '+itemName(currentLoot.item);else if(currentStation)$('interact-prompt').querySelector('span').textContent=currentStation.name;$('spawn-progress').classList.toggle('hidden',!returnAt);if(returnAt){$('spawn-progress').querySelector('b').textContent=Math.max(0,returnAt-time).toFixed(1);$('spawn-progress').querySelector('i').style.transform='scaleX('+Math.max(0,Math.min(1,(3-(returnAt-time))/3))+')';}if(keys.has('Tab')||scorePinned)showScoreboard();$('streak-label').classList.toggle('hidden',player.streak<3);$('streak-label').textContent=player.streak+' kill streak';renderChat();updateKillFeed();updateEventHud();}

function addAlchemyTable(station){
 const table=prepareModel(models['ledge-table.glb'].scene.clone(true));table.scale.setScalar(.72);table.position.copy(station.position);table.userData.asset='ledge-table.glb';scene.add(table);station.model=table;station.displays=[];
 for(const [i,id]of Object.keys(POTIONS).entries()){const bottle=prepareModel(models[POTIONS[id].file].scene.clone(true));bottle.position.copy(station.position).add(new V3((i-1)*.47,1.215,.61));bottle.rotation.y=(i-1)*.2;bottle.userData.asset=POTIONS[id].file;scene.add(bottle);station.displays.push(bottle);}
}
const EXOTIC_COLOR=RARITIES[WEAPONS[MERCHANT.weapons[0]].rarity].color,MERCHANT_LOOPS=new Set(['Idle','Talk','Dance']);
const MERCHANT_ACTS=[['Wave',3],['Talk',2],['Dance',1.2],['Interact',1.4],['Pickup',1],['Cast',1.6],['Kick_Left',.4]];
let merchantShopSignature='';
const stockSignature=stock=>stock.cycle+':'+stock.items.map(i=>i.weapon+'.'+i.status).join(',');
function restockClock(stock){const s=Math.max(0,Math.ceil((stock.restockAt-Date.now())/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function merchantTexture(){const c=document.createElement('canvas');c.width=360;c.height=130;const ctx=c.getContext('2d'),title='Lv '+MERCHANT.level;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=7;ctx.strokeStyle='#211b28';ctx.font='900 22px Nunito, sans-serif';ctx.strokeText(title,180,24);ctx.fillStyle=EXOTIC_COLOR;ctx.fillText(title,180,24);ctx.font='1000 39px Nunito, sans-serif';ctx.strokeText(MERCHANT.name,180,66);ctx.fillStyle='#fff3df';ctx.fillText(MERCHANT.name,180,66);ctx.font='900 22px Nunito, sans-serif';ctx.lineWidth=6;ctx.strokeText('(Merchant)',180,106);ctx.fillStyle='#e9d9e6';ctx.fillText('(Merchant)',180,106);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function addMerchant(station){
 const template=models[MERCHANT.file],rig=prepareModel(cloneRig(template.scene)),root=new THREE.Group(),toward=new V3(PLAYER_SPAWN.x,0,PLAYER_SPAWN.z).sub(station.position);
 const rug=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.05,.12,10),new THREE.MeshStandardMaterial({color:0x3b2648,roughness:.95,flatShading:true})),rim=new THREE.Mesh(new THREE.TorusGeometry(.98,.035,4,30),new THREE.MeshStandardMaterial({color:EXOTIC_COLOR,emissive:EXOTIC_COLOR,emissiveIntensity:.55,roughness:.6}));
 rug.position.y=.06;rug.receiveShadow=true;rim.rotation.x=Math.PI/2;rim.position.y=.12;rig.position.y=.12;root.add(rug,rim,rig);root.position.copy(station.position);root.rotation.y=Math.atan2(toward.x,toward.z);
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:merchantTexture(),transparent:true}));label.position.y=2.62;label.scale.set(2,.722,1);root.add(label);
 const displays={};for(const id of MERCHANT.weapons){const d=makeWeapon({weapon:id,rarity:WEAPONS[id].rarity});d.scale.setScalar(.8);d.visible=false;root.add(d);displays[id]=d;}
 root.traverse(o=>{o.userData.noCameraCollision=true;});scene.add(root);
 const mixer=new THREE.AnimationMixer(rig),actions=Object.fromEntries(template.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
 const voice=Object.fromEntries(['greet','call'].map(kind=>{const audio=new Audio('./assets/voice/'+MERCHANT.voice[kind]+'?v=50');audio.preload='auto';return[kind,audio];}));
 merchant={station,root,rig,label,mixer,actions,displays,voice,speaking:null,speakingUntil:0,greetAt:0,callAt:MERCHANT.voice.callInterval.min,current:null,until:0,castAt:-1,near:false,checkAt:0,signature:'',cycle:merchantCycle()};station.model=root;
 playMerchant('Idle',true);syncMerchantDisplays();
}
function playMerchant(name,loop=MERCHANT_LOOPS.has(name)){
 const m=merchant,action=m.actions[name]??m.actions.Idle;if(!action)return;const previous=m.actions[m.current];if(previous&&previous!==action)previous.fadeOut(.25);
 action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.25);action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=!loop;action.play();
 const length=action.getClip().duration;m.current=name;m.until=time+(loop?3+Math.random()*3.5:length);m.castAt=name==='Cast'?time+length*.45:-1;
}
function syncMerchantDisplays(){
 if(!merchant)return;const stock=merchantStock(merchantState),n=stock.items.length;merchant.signature=stockSignature(stock);for(const d of Object.values(merchant.displays))d.visible=false;
 stock.items.forEach((entry,i)=>{const d=merchant.displays[entry.weapon];if(!d||entry.status!=='available')return;const a=n>1?(i/(n-1)-.5)*2.1:0;d.visible=true;d.userData.base=new V3(Math.sin(a)*1.25,1.5+Math.cos(a)*.5,-.2-Math.cos(a)*.7);d.userData.phase=i*2.1;});
}
const voiceLevel=distance=>MERCHANT.voice.volume*settings.volume/100*Math.max(0,1-distance/MERCHANT.voice.hearing);
function speakMerchant(kind,distance){
 const m=merchant;if(mode!=='play'||distance>=MERCHANT.voice.hearing||time<m.speakingUntil)return false;
 const audio=m.voice[kind];audio.currentTime=0;audio.volume=voiceLevel(distance);audio.onended=()=>{m.speakingUntil=0;};audio.play()?.catch?.(()=>{m.speakingUntil=0;});
 m.speaking=audio;m.speakingUntil=time+(Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:5);music?.duck(m.speakingUntil-time);ambience?.duck(m.speakingUntil-time);return true;
}
function updateMerchant(dt){
 const m=merchant;if(!m)return;
 const dx=player.position.x-m.root.position.x,dz=player.position.z-m.root.position.z,distance=Math.hypot(dx,dz),near=mode==='play'&&player.health>0&&distance<7&&Math.abs(player.position.y-m.root.position.y)<2;
 if(near&&!m.near){m.near=true;playMerchant('Wave');if(time>=m.greetAt&&speakMerchant('greet',distance))m.greetAt=time+MERCHANT.voice.greetCooldown;}else if(!near&&distance>9)m.near=false;
 if(time>=m.callAt){m.callAt=time+MERCHANT.voice.callInterval.min+Math.random()*MERCHANT.voice.callInterval.spread;if(!near&&speakMerchant('call',distance))playMerchant('Talk');}
 if(m.speaking&&time<m.speakingUntil){if(mode==='play')m.speaking.volume=voiceLevel(distance);else{m.speaking.pause();m.speakingUntil=0;}}
 if(time>=m.until){if(m.current!=='Idle')playMerchant('Idle');else{let roll=Math.random()*MERCHANT_ACTS.reduce((a,[,w])=>a+w,0),pick='Wave';for(const [name,w]of MERCHANT_ACTS){roll-=w*(near&&name==='Wave'?1.6:1);if(roll<0){pick=name;break;}}playMerchant(pick);}}
 if(m.castAt>0&&time>=m.castAt){m.castAt=-1;const hand=m.rig.getObjectByName('WristR')?.getWorldPosition(new V3())??m.root.position.clone().add(new V3(0,1.4,0)),color=WEAPONS[MERCHANT.weapons[Math.floor(Math.random()*MERCHANT.weapons.length)]].proc.color;burst(hand,color,22,.8);if(distance<18)sound('magic');}
 const facing=near?Math.atan2(dx,dz)-m.root.rotation.y:0,turn=Math.atan2(Math.sin(facing-m.rig.rotation.y),Math.cos(facing-m.rig.rotation.y));m.rig.rotation.y+=turn*Math.min(1,dt*4);
 for(const d of Object.values(m.displays))if(d.visible){d.position.copy(d.userData.base);d.position.y+=Math.sin(time*1.6+d.userData.phase)*.08;d.rotation.y=time*.9+d.userData.phase;}
 m.mixer.update(dt);
 if(time>=m.checkAt){m.checkAt=time+.5;const stock=merchantStock(merchantState),signature=stockSignature(stock);
  if(signature!==m.signature){syncMerchantDisplays();if(stock.cycle!==m.cycle&&mode==='play'){chatSystem(MERCHANT.name+' restocked.');if(speakMerchant('call',distance))playMerchant('Talk');}m.cycle=stock.cycle;}
  if(activeModal==='shop'&&shopTab==='exotics'){if(signature!==merchantShopSignature)renderShop();else{const clock=$('shop-content').querySelector('.merchant-restock');if(clock)clock.textContent='Restocks in '+restockClock(stock);}}}
}
function addImportedEnvironment(){
 const stoneMat=new THREE.MeshStandardMaterial({color:0x655769,roughness:1,flatShading:true});
 for(const station of stations){if(station.type==='match')continue;if(station.type==='potions'){addAlchemyTable(station);continue;}if(station.type==='merchant'){addMerchant(station);continue;}const base=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.2,.18,8),stoneMat);base.position.copy(station.position);base.position.y+=.09;base.receiveShadow=true;scene.add(base);const model=prepareModel(models[station.type==='chest'?'treasure-chest.glb':'sword-rack.glb'].scene.clone(true));model.position.copy(station.position);model.position.y+=.18;model.rotation.y=station.type==='chest'?-.6:.6;scene.add(model);station.model=model;if(station.type==='chest'){chestLid=model.getObjectByName('Chest_Top');chestBaseRotation=chestLid?.rotation.x??0;}}
 for(const crate of placeMapProps(MAP,'crate',models,prepareModel)){scene.add(crate);mapCrates.push(crate);}
 for(const rock of placeMapProps(MAP,'rock-cluster',models,prepareModel))scene.add(rock);
}
function addPumpkins(){
 const groups=[[-8,29.8,8],[8,29.5,8],[-7.4,21.2,8],[7.4,21.5,8],[-12,17,0],[13,16,0],[-23,20,0],[24,4,0],[-25,-13,0],[13,-23,0],[-12,-24,0],[18,-14,0],[-7,-7,0]];
 for(const [i,[x,z,y]]of groups.entries())for(let n=0;n<(i%3===0?3:2);n++){
  const px=x+(n-1)*.62,pz=z+(n%2)*.43,scale=n===0?1.12:n===1?.72:.51;if(isLava(px,pz,y)||blocked(px,pz,y,.27))continue;
  const model=prepareModel(models['pumpkin.glb'].scene.clone(true));model.scale.setScalar(scale);model.position.set(px,y,pz);model.rotation.y=i*1.21+n*1.7;model.userData.asset='pumpkin.glb';scene.add(model);pumpkins.push(model);
 }
}
function generateThumbnails(){let r;try{r=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(220,220);r.setPixelRatio(1);r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.3;r.outputColorSpace=THREE.SRGBColorSpace;const s=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);s.add(new THREE.HemisphereLight(0xe6f1ff,0xb59a84,3));const light=new THREE.DirectionalLight(0xffe1b3,4);light.position.set(-3,5,5);s.add(light);const entries=[...Object.entries(WEAPONS).map(([id,w])=>[id,w.file]),...Object.entries(ARMORS).filter(([,a])=>a.file).map(([id,a])=>['armor-'+id,a.file]),...Object.entries(POTIONS).map(([id,p])=>['potion-'+id,p.file]),['chest','treasure-chest.glb'],['bow','bow.glb']];for(const [id,file]of entries){const item=WEAPONS[id]?makeWeapon({weapon:id,rarity:WEAPONS[id].rarity??'common'}):prepareModel(models[file].scene.clone(true)),group=new THREE.Group();if(id==='armor-helmet')item.rotation.y=Math.PI;group.add(item);if(WEAPONS[id]){group.rotation.z=-.55;group.rotation.y=.55;}else group.rotation.y=-.35;group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new V3()),size=bounds.getSize(new V3()),largest=Math.max(size.x,size.y,size.z);group.position.sub(center);s.add(group);const extent=Math.max(size.x,size.y)*.65;camera.left=-extent;camera.right=extent;camera.top=extent;camera.bottom=-extent;camera.position.set(0,0,largest*3+1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();group.updateMatrixWorld(true);r.clear();r.render(s,camera);thumbs[id]=r.domElement.toDataURL('image/png');s.remove(group);disposeMaterials(group);}r.dispose();r.forceContextLoss();}catch(error){r?.dispose();console.warn('Equipment thumbnails unavailable',error);}}
function cameraClearDistance(origin,direction,maxDistance){let distance=maxDistance;for(const offset of [new V3(),new V3(.14,0,0),new V3(-.14,0,0),new V3(0,.14,0)]){cameraRay.set(origin.clone().add(offset),direction);cameraRay.near=.05;cameraRay.far=maxDistance;const hit=cameraRay.intersectObjects(cameraObstacles,false)[0];if(hit)distance=Math.min(distance,Math.max(.2,hit.distance-.22));}return distance;}
function updateAtmosphere(dt){
 const target=player.team?.8:mode==='lobby'?.24:THREE.MathUtils.clamp(1-(player.position.y-1)/9,.2,1);
 atmosphereBlend=THREE.MathUtils.lerp(atmosphereBlend,target,1-Math.exp(-dt*1.6));
 scene.fog.color.copy(calmFog).lerp(bloodFog,atmosphereBlend);scene.fog.color.lerp(new THREE.Color(0x241731),pressureAtmosphere*.8);scene.background.copy(scene.fog.color);scene.fog.density=.014+atmosphereBlend*.008+pressureAtmosphere*.006;
 world.setAtmosphere(atmosphereBlend,pressureAtmosphere);const submerged=isLava(camera.position.x,camera.position.z,camera.position.y)&&camera.position.y<.035;if(submerged){scene.fog.color.setHex(0xa32b07);scene.fog.density=.62;}renderer.toneMappingExposure=1.04-atmosphereBlend*.035-pressureAtmosphere*.13;$('pressure-static').style.opacity=(mode==='play'?pressureAtmosphere*.2:0).toFixed(3);$('pressure-static').classList.toggle('still',!settings.shake);
}
function updateCamera(dt){if(freecam.active){updateFreecam(dt);return;}if(player.team&&player.health<=0){const ally=duel.teams.blue.find(a=>a!==player&&a.alive),focus=ally?.position??new V3(MINI.x,0,0);camera.position.copy(focus).add(new V3(6,9,8));camera.lookAt(focus.clone().add(new V3(0,1,0)));camera.updateMatrixWorld(true);return;}if(mode==='lobby'){camera.position.set(22+Math.sin(time*.05)*2,17.4,29);camera.lookAt(-2,4.6,-9);camera.fov=64;camera.updateProjectionMatrix();return;}if(mode==='dead')return;
 const speed=Math.hypot(player.velocity.x,player.velocity.z),moving=speed>1&&player.grounded&&!admin.flying,visualSprint=sprinting&&speed>2;
 if(visualSprint!==wasVisualSprint&&time-lastSprintWhoosh>.09){if(visualSprint||wasVisualSprint)sound(visualSprint?'sprint':'sprint-stop');lastSprintWhoosh=time;}wasVisualSprint=visualSprint;
 sprintView=THREE.MathUtils.lerp(sprintView,visualSprint?1:0,1-Math.exp(-(visualSprint?14:23)*dt));
 cameraStride=THREE.MathUtils.lerp(cameraStride,moving&&settings.shake?Math.min(1,speed/MOVEMENT.walk)*(1-crouchBlend*.75):0,1-Math.exp(-14*dt));
 const bob=Math.sin(walkTime*2)*.028*cameraStride,side=Math.cos(walkTime)*.018*cameraStride,eye=player.position.clone().add(new V3(Math.cos(yaw)*side,1.62-crouchBlend*.57+bob,-Math.sin(yaw)*side));
 if(thirdPerson){scene.updateMatrixWorld(true);const forward=new V3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)),right=new V3(Math.cos(yaw),0,-Math.sin(yaw)),offset=forward.clone().multiplyScalar(-4.1).addScaledVector(right,.48).add(new V3(0,.45,0));cameraDistance=cameraClearDistance(eye,offset.clone().normalize(),offset.length());camera.position.copy(eye).addScaledVector(offset.normalize(),cameraDistance);camera.position.y=Math.max(camera.position.y,.28);camera.lookAt(eye.clone().addScaledVector(forward,9));}
 else{cameraDistance=0;camera.position.copy(eye);camera.rotation.set(pitch,yaw,0,'YXZ');}
 if(settings.shake&&!thirdPerson){camera.rotation.z+=Math.sin(walkTime)*.0025*cameraStride;camera.rotation.x+=Math.cos(walkTime*2)*.0015*cameraStride;}if(settings.shake&&shake>.001){camera.rotation.x+=(Math.random()-.5)*shake;camera.rotation.z+=(Math.random()-.5)*shake*.35;}shake*=Math.exp(-14*dt);camera.fov=(thirdPerson?70:76)+sprintView*(thirdPerson?5:9);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
function aimDirection(){const forward=new V3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));if(!thirdPerson)return forward;const origin=player.position.clone().add(new V3(0,player.crouched?1.02:1.5,0)),view=camera.getWorldDirection(new V3()),aimRay=new THREE.Raycaster(camera.position,view,.15,60),targets=[...cameraObstacles,...fighters.filter(f=>f.alive).map(f=>f.rig)];scene.updateMatrixWorld(true);const hit=aimRay.intersectObjects(targets,true)[0],target=hit?hit.point:camera.position.clone().addScaledVector(view,60);return target.sub(origin).normalize();}
function updatePlayerAvatar(dt){if(!playerAvatar)return;if(player.health<=0){playerAvatar.root.visible=false;return;}const a=playerAvatar;restoreImpactPose(a);if(selectedSlot==='orb'){const orb=a.rig.getObjectByName('charge-orb');if(orb)updateChargeOrb(orb,time,orbPower(),true);}a.team=player.team;if(a.posed)a.hipPose.bone.position.copy(a.hipPose.base);for(const p of a.crouchBones)if(a.posed)p.bone.quaternion.copy(p.base);a.rig.position.set(0,0,0);a.root.position.copy(player.position);
 if(a.emoting&&(Math.hypot(player.velocity.x,player.velocity.z)>.5||!player.grounded||player.crouched)){a.animUntil=0;a.emoting=false;}
 if(time>a.animUntil){const moving=Math.hypot(player.velocity.x,player.velocity.z)>.7;if(!moving&&player.grounded&&selectedSlot==='bow')animateActor(a,'Idle_Gun');else locomotion(player,a,moving,sprinting);}updateAnimator(a,dt);a.rig.updateMatrixWorld(true);const left=a.rig.getObjectByName('FootL'),right=a.rig.getObjectByName('FootR'),footY=()=>Math.min(left?.getWorldPosition(new V3()).y??player.position.y,right?.getWorldPosition(new V3()).y??player.position.y),before=footY(),poseCrouch=['CrouchIdle','CrouchWalk'].includes(a.animator.currentAction)?0:crouchBlend;a.hipPose.base.copy(a.hipPose.bone.position);if(left?.parent?.name==='Root')a.hipPose.bone.position.y-=.35*poseCrouch;
 for(const p of a.crouchBones){p.base.copy(p.bone.quaternion);const angle=p.bone.name==='Torso'?.24:p.bone.name.startsWith('UpperLeg')?-.78:p.bone.name.startsWith('LowerLeg')?1.3:-.4;p.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),angle*poseCrouch));}a.posed=true;a.root.updateMatrixWorld(true);a.rig.position.y=before-footY();a.root.updateMatrixWorld(true);applyImpactPose(a,player,time,meleeCharge.at<0?0:chargeProgress(time-meleeCharge.at));a.root.visible=(mode==='play'||mode==='pause')&&(freecam.active||thirdPerson&&cameraDistance>1.05);a.rig.visible=freecam.active||thirdPerson&&cameraDistance>1.05;updateAppearance(a,dt,player.streak);
}
function updateWeapon(dt){if(profile.cosmetic!=='none'){const effect=COSMETICS[profile.cosmetic];trail.material.color.setHex(effect.colors[0]);if(profile.cosmetic==='prism')trail.material.color.setHSL((time*.09)%1,.8,.66);}swingAge+=dt;const t=Math.min(swingAge/(heavySwingPower?.34:.17),1),arc=t<1?Math.sin(Math.PI*t):0,bob=Math.hypot(player.velocity.x,player.velocity.z)>1?Math.sin(walkTime)*.011:Math.sin(time*1.7)*.004,charge=bowDrawAt<0?0:Math.min(1,(time-bowDrawAt)/BOW.fullDraw);
 if(nockedArrow){nockedArrow.visible=selectedSlot==='bow'&&arrowCount>0;nockedArrow.position.set(.012,.018,.03+charge*.25);}if(bowString){bowString.geometry.attributes.position.setXYZ(1,0,0,.229+charge*.3);bowString.geometry.attributes.position.needsUpdate=true;}
 if(selectedSlot==='bow'){weaponPivot.position.set(-.36+charge*.04,-.42+bob,-.92+charge*.12);weaponPivot.rotation.set(.04,-.06,.05);trail.material.opacity=0;}
 else if(selectedSlot==='orb'){weaponPivot.position.set(.38,-.34+bob,-.9);weaponPivot.rotation.set(0,0,0);trail.material.opacity=0;if(heldOrb){heldOrb.position.set(.37,-.3+bob,-.9);updateChargeOrb(heldOrb,time,orbPower(),true);}}
 else if(meleeCharge.at>=0&&time-meleeCharge.at>HEAVY.windup){const power=chargeProgress(time-meleeCharge.at);weaponPivot.position.set(.42+power*.1,-.38+power*.12+bob,-.84+power*.13);weaponPivot.rotation.set(.07+power*.9,-.12-power*.3,-.035-power*.22);trail.material.opacity=0;if(power===1&&!meleeCharge.ready){meleeCharge.ready=true;sound('charge-ready');}}
 else if(blockHeld){weaponPivot.position.set(.23,-.39+bob,-.87);weaponPivot.rotation.set(.08,.05,.98);trail.material.opacity=0;}
 else if(WEAPONS[equippedItem(profile).weapon].kind==='staff'){weaponPivot.position.set(.42,-.46+bob,-1.05-arc*.14);weaponPivot.rotation.set(-.03-arc*.27,.05,-.13);trail.material.opacity=0;}
 else{const variation=firstPersonSwingSequence%3;weaponPivot.position.set(.42-arc*(variation===1?.2:.1),-.48+arc*(variation===2?.04:.1)+bob,-.86-arc*(variation===2?.44:.25));weaponPivot.rotation.set(-.10-arc*(variation===2?.58:1.3),.10+arc*(variation===1?.3:.12),-.12+arc*(variation===1?.42:.15));trail.material.opacity=arc>.25?(1-t)*.3:0;trail.rotation.x=.9-arc*1.4;}
 const meter=selectedSlot==='orb'?orbPower():meleeCharge.at>=0?chargeProgress(time-meleeCharge.at):charge;$('bow-charge').querySelector('i').style.transform='scaleX('+meter+')';$('bow-charge').classList.toggle('hidden',selectedSlot!=='bow'&&selectedSlot!=='orb'&&!(meleeCharge.at>=0&&time-meleeCharge.at>HEAVY.windup));$('bow-charge').classList.toggle('orb-charge',selectedSlot==='orb');$('crosshair').classList.toggle('bow',selectedSlot==='bow');$('bow-charge').classList.toggle('charged',meter>=1);updatePlayerAvatar(dt);updatePotionVisual();
}
function render(){renderer.setViewport(0,0,innerWidth,innerHeight);renderer.autoClear=true;renderer.render(scene,camera);if(mode==='lobby'&&hero){renderer.autoClear=false;renderer.clearDepth();const w=innerWidth<650?innerWidth*.66:innerWidth*.5,h=innerHeight*.76,x=innerWidth<650?innerWidth*.46:innerWidth*.47,y=innerHeight*.24;renderer.setViewport(x,y,w,h);heroCamera.aspect=w/h;heroCamera.updateProjectionMatrix();renderer.render(heroScene,heroCamera);renderer.setViewport(0,0,innerWidth,innerHeight);}else if(!thirdPerson&&!freecam.active&&player.health>0&&(mode==='play'||mode==='pause')){renderer.autoClear=false;renderer.clearDepth();renderer.render(weaponScene,weaponCamera);}renderer.autoClear=true;}
function updateBotChat(){for(let i=pendingChats.length-1;i>=0;i--){const msg=pendingChats[i];if(time>=msg.at){msg.bot.talkUntil=time+2.2;addChat({name:msg.bot.name,rating:msg.bot.rating,ai:true,text:msg.text});pendingChats.splice(i,1);}}if(mode==='play'&&time>botChatAt){botChatAt=time+22+Math.random()*17;const bot=fighters[Math.floor(Math.random()*fighters.length)];if(bot){bot.talkUntil=time+2.2;addChat({name:bot.name,rating:bot.rating,ai:true,text:ambientReply(bot,chatContext())});}}}
function frame(now){requestAnimationFrame(frame);pruneLoot();const elapsed=Math.min((now-last)/1000,.05);last=now;if(mode==='play'||mode==='lobby'){time+=elapsed;world.update(time);updateMerchant(elapsed);if(mode==='play'){updateDuel(elapsed);if(isDueling()){arenaEvent.at+=elapsed;arenaEvent.nextPulse+=elapsed;for(const h of hazardMarks)h.at+=elapsed;}else updateArenaEvents(elapsed);}if(hero){if(time>hero.gestureAt){hero.gestureAt=time+7+Math.random()*5;animateActor(hero,['Idle_Sword','StanceAlt','Wave','Talk'][Math.floor(time/7)%4],false,.9);}updateAnimator(hero,elapsed);updateCosmetic(hero,profile.cosmetic,time);}accumulator+=elapsed;while(accumulator>=1/90){if(mode==='play'){validateChargeOrb();updatePressureFields();updateAscensionFields(1/90);updatePlayer(1/90);}if(loaded){updateProjectiles(1/90);updateFighters(1/90);}updateFX(1/90);if(mode==='play')updateLoot(1/90);accumulator-=1/90;}updateCamera(elapsed);world.setView(camera);updateAtmosphere(elapsed);updateWeapon(elapsed);updateBotChat();if(ambience)ambience.update(Math.hypot(Math.max(0,lavaDistance(player.position.x,player.position.z)),Math.max(0,player.position.y)));uiTimer+=elapsed;if(uiTimer>.1){if(mode==='play')updateHud();uiTimer=0;}}else accumulator=0;
 if(mode==='play'||mode==='lobby'||mode==='dead')ragdolls.update(elapsed);
 music?.update();if(chestLid)chestLid.rotation.x=THREE.MathUtils.lerp(chestLid.rotation.x,chestBaseRotation+(time<chestLidUntil?-1.15:0),.08);$('hitmarker').style.opacity=time<hitmarkerUntil?1:0;$('damage-flash').style.opacity=mode==='play'&&!freecam.active?Math.max(0,.34-(time-lastHurt)*1.3):0;$('fire-flash').style.opacity=mode==='play'&&!freecam.active&&!thirdPerson&&time<(player.effects?.fire?.until??0)?.22+Math.sin(time*11)*.035:0;$('heal-flash').style.opacity=mode==='play'&&!freecam.active?Math.max(0,(healUntil-time)*.33):0;if(time-lastHit>1.5)$('combo').classList.add('hidden');render();}
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;weaponCamera.aspect=camera.aspect;camera.updateProjectionMatrix();weaponCamera.updateProjectionMatrix();});
function rebuildPlayerAvatar(){
 if(!loaded)return;if(playerAvatar){disposeCosmetic(playerAvatar);scene.remove(playerAvatar.root);playerAvatar.animator.mixer.stopAllAction();playerAvatar.animator.mixer.uncacheRoot(playerAvatar.rig);disposeMaterials(playerAvatar.rig);}const template=models[CHARACTERS[profile.character].file],rig=prepareModel(cloneRig(template.scene)),root=new THREE.Group();root.add(rig);scene.add(root);attachGear(rig,equippedItem(profile),profile.armor,profile.helmet);
 const orb=createChargeOrb();orb.userData.slot='orb';orb.userData.equipment=true;orb.scale.setScalar(.13);orb.position.set(0,.09,0);rig.getObjectByName('WristR')?.add(orb);
 const bow=prepareModel(models['bow.glb'].scene.clone(true));bow.userData.slot='bow';bow.userData.equipment=true;bow.position.set(0,.07,0);bow.rotation.z=-Math.PI/2;bow.scale.setScalar(.8);rig.getObjectByName('WristL')?.add(bow);
 const crouchBones=['Torso','UpperLegL','UpperLegR','LowerLegL','LowerLegR','FootL','FootR'].map(name=>rig.getObjectByName(name)).filter(Boolean).map(bone=>({bone,base:bone.quaternion.clone()}));
 playerAvatar={root,rig,animator:makeAnimator(rig,template.animations),position:root.position,crouchBones,hipPose:{bone:rig.getObjectByName('Body'),base:rig.getObjectByName('Body').position.clone()},posed:false,animUntil:0};playerAvatar.animator.look.bodyYaw=yaw+Math.PI;rig.rotation.y=yaw+Math.PI;syncAvatarEquipment();rig.visible=thirdPerson||freecam.active;
}
function syncAvatarEquipment(){if(!playerAvatar)return;playerAvatar.rig.traverse(o=>{if(o.userData.slot)o.visible=o.userData.slot===selectedSlot;});}
function togglePerspective(){if(freecam.active){setFreecam(false);return;}thirdPerson=!thirdPerson;write('emberfall.thirdPerson',thirdPerson);syncViewControls();if(loaded){updateCamera(1/30);updateWeapon(0);}}
$('view-button').addEventListener('click',togglePerspective);$('touch-crouch').addEventListener('click',()=>{crouchTouch=!crouchTouch;$('touch-crouch').classList.toggle('active',crouchTouch);});
function setSlot(slot){
 cancelAttack(true);selectedSlot=slot;bowDrawAt=-1;blockHeld=false;if(heldOrb)heldOrb.visible=slot==='orb';if(slot==='orb'&&!heldOrb){heldOrb=createChargeOrb();heldOrb.scale.setScalar(.19);heldOrb.position.set(.37,-.3,-.9);weaponScene.add(heldOrb);}
 for(const o of heldGroup.children)o.visible=slot==='bow'?!!o.userData.bow:slot==='sword'&&!o.userData.bow;
 if(nockedArrow)nockedArrow.visible=false;syncAvatarEquipment();$('bow-charge').classList.toggle('hidden',slot!=='bow');
}
function selectHotbarSlot(index){
 if(index<0||index>=HOTBAR_SLOTS||player.health<=0)return;
 profile.selectedHotbar=index;const item=profile.inventory.find(i=>i.id===profile.hotbar[index]),kind=itemKind(item),changed=!!item?.weapon&&(profile.equipped!==item.id||heldGroup.children.find(o=>o.userData.weapon)?.userData.itemId!==item.id);
 if(item?.weapon)profile.equipped=item.id;if(item?.potion)profile.selectedPotion=item.potion;
 setSlot(kind==='weapon'?'sword':kind??'empty');if(changed)refreshEquipment();
 if(item?.potion)showPotionBottle(item.potion);updateHeldArmor(item);persist();hotbarSignature='';updateHud();
}
let heldArmor=null;
function updateHeldArmor(item){
 if(heldArmor){weaponScene.remove(heldArmor);heldArmor.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});heldArmor=null;}
 if(!item?.armor||!loaded)return;heldArmor=prepareModel(models[ARMORS[item.armor].file].scene.clone(true));const size=new THREE.Box3().setFromObject(heldArmor).getSize(new V3());heldArmor.scale.multiplyScalar(.4/Math.max(size.x,size.y,size.z));heldArmor.position.set(.38,-.4,-.8);heldArmor.rotation.set(.08,-.35,0);weaponScene.add(heldArmor);
}
function renderHotbar(){
 const entries=profile.hotbar.map(id=>profile.inventory.find(i=>i.id===id));
 const signature=JSON.stringify([profile.hotbar,profile.selectedHotbar,entries.map(i=>i?.count),arrowCount,loaded]);
 if(signature!==hotbarSignature){hotbarSignature=signature;const bar=$('quickbar');bar.replaceChildren();
  for(let n=0;n<HOTBAR_SLOTS;n++){const item=entries[n],button=document.createElement('button');button.className='hotbar-slot'+(n===profile.selectedHotbar?' active':'');button.setAttribute('aria-pressed',String(n===profile.selectedHotbar));button.setAttribute('aria-label','Slot '+(n+1)+': '+(item?itemName(item):'Empty'));button.title=(item?itemName(item):'Empty')+' ('+(n+1)+')';button.innerHTML=`<kbd>${n+1}</kbd>${slotArt(item,thumbs)}${item?.bow?'<b>'+arrowCount+'</b>':''}<span class="hotbar-cooldown hidden"></span>`;button.addEventListener('click',()=>{if(mode==='play'&&!chatOpen)selectHotbarSlot(n);});bar.append(button);}
 }
 const gear=weaponStats(equippedItem(profile)),remaining=gear.kind==='staff'&&selectedSlot==='sword'?Math.max(0,gear.cooldown-(time-lastCast)):selectedSlot==='sword'?Math.max(0,meleeRecoveryUntil-time):0;
 const cooldown=$('quickbar').children[profile.selectedHotbar]?.querySelector('.hotbar-cooldown');if(cooldown){cooldown.textContent=remaining>0?remaining.toFixed(1):'';cooldown.classList.toggle('hidden',remaining<=0);}
}
window.addEventListener('wheel',e=>{if(!$('scoreboard').classList.contains('hidden')){if(document.pointerLockElement===canvas){e.preventDefault();$('score-scroll').scrollTop+=e.deltaY;}return;}if(mode!=='play'||chatOpen||!e.deltaY)return;e.preventDefault();selectHotbarSlot((profile.selectedHotbar+(e.deltaY>0?1:-1)+HOTBAR_SLOTS)%HOTBAR_SLOTS);},{passive:false});
function cancelAttack(forceOrb=false){
 meleeCharge.at=-1;meleeCharge.itemId=null;meleeCharge.ready=false;bowDrawAt=-1;
 if(forceOrb||!orbCharge.latched){orbCharge.at=-1;orbCharge.itemId=null;orbCharge.latched=false;}
}
function releaseAttack(){
 releaseBow();if(orbCharge.at>=0&&!orbCharge.latched){orbCharge.at=-1;orbCharge.itemId=null;}
 if(meleeCharge.at<0)return;const elapsed=time-meleeCharge.at,itemId=meleeCharge.itemId;meleeCharge.at=-1;meleeCharge.itemId=null;
 if(elapsed>=HEAVY.minimum&&itemId===profile.equipped&&selectedSlot==='sword'&&!blockHeld)swing(chargeProgress(elapsed));
}
function orbPower(){return orbCharge.at<0?0:Math.min(1,Math.max(0,(time-orbCharge.at)/4));}
function hasChargeOrb(){return selectedSlot==='orb'&&profile.inventory.some(i=>i.id===profile.hotbar[profile.selectedHotbar]&&i.orb==='charge');}
function startChargeOrb(latched=false){
 if(player.health<=0||isDueling()||mode!=='play'||(!latched&&(chatOpen||freecam.active)))return false;
 if(profile.cosmetic!=='ascension'||!profile.ownedCosmetics.includes('ascension')){toast('Equip Ascension to use the charge orb');return false;}
 if(!hasChargeOrb()){toast('Select a charge orb from your hotbar');return false;}
 if(orbCharge.at<0){orbCharge.at=time;orbCharge.itemId=profile.hotbar[profile.selectedHotbar];sound('orb');}orbCharge.latched=latched;blockHeld=false;return true;
}
function validateChargeOrb(){
 if(orbCharge.at>=0&&(!hasChargeOrb()||profile.hotbar[profile.selectedHotbar]!==orbCharge.itemId||player.health<=0||profile.cosmetic!=='ascension'||!profile.ownedCosmetics.includes('ascension')||isDueling())){orbCharge.at=-1;orbCharge.itemId=null;orbCharge.latched=false;}
}
function beginAttack(){if(player.health<=0||freecam.active)return;if(mode!=='play'||chatOpen)return;initAudio();if(selectedSlot==='potion'){drinkTonic();return;}if(selectedSlot==='armor'){const item=profile.inventory.find(i=>i.id===profile.hotbar[profile.selectedHotbar]);if(item&&profile[ARMORS[item.armor].slot==='head'?'helmetItem':'armorItem']!==item.id){equipInventoryItem(profile,item.id);persist();refreshEquipment();}return;}if(selectedSlot==='orb'){startChargeOrb();return;}if(selectedSlot==='empty')return;if(selectedSlot==='sword'){if(WEAPONS[equippedItem(profile).weapon].kind==='staff')castSpell();else if(time>=meleeRecoveryUntil&&meleeCharge.at<0){swing();meleeCharge.at=time;meleeCharge.itemId=profile.equipped;meleeCharge.ready=false;}return;}if(arrowCount<=0){toast('Out of arrows · KOs or the ledge refill them');return;}if(bowDrawAt<0)bowDrawAt=time;}
function castSpell(){
 if(player.health<=0||mode!=='play'||chatOpen||freecam.active||selectedSlot!=='sword')return;const stats=weaponStats(equippedItem(profile));
 if(stats.kind!=='staff'||time-lastCast<stats.cooldown)return;swingAge=0;
 if(safeZone(player.position))return;lastCast=time;lastCombat=time;returnAt=0;blockHeld=false;clickTimes.push(time);
 const direction=aimDirection(),mesh=magicMesh(stats.color);mesh.position.copy(player.position).add(new V3(0,player.crouched?1.02:1.5,0)).addScaledVector(direction,.5);scene.add(mesh);
 projectiles.push({kind:'magic',mesh,velocity:direction.multiplyScalar(stats.projectileSpeed),life:stats.reach/stats.projectileSpeed,damage:stats.damage,stats:{...stats},owner:player,trailAt:0});
 if(playerAvatar){playerAvatar.emoting=false;animateActor(playerAvatar,'Cast',true,1.7);playerAvatar.animUntil=time+.3;}burst(mesh.position,stats.color,14,.4);sound('magic');updateHud();
}
function magicMesh(color){
 const group=new THREE.Group(),core=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,1),new THREE.MeshBasicMaterial({color:0xf6f0ff})),halo=new THREE.Mesh(new THREE.IcosahedronGeometry(.24,1),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.43,depthWrite:false,blending:THREE.AdditiveBlending}));
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.022,4,18),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));ring.rotation.x=.7;group.add(core,halo,ring);return group;
}
function arcLink(from,to,color){
 const points=[];for(let i=0;i<=7;i++){const p=from.clone().lerp(to,i/7);if(i&&i<7)p.add(new V3((Math.random()-.5)*.24,(Math.random()-.5)*.24,(Math.random()-.5)*.24));points.push(p);}
 const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(mesh);spellLinks.push({mesh,life:.22});
}
function validVictims(owner){return[...(mode==='play'&&player.health>0?[player]:[]),...fighters.filter(f=>f.alive)].filter(target=>canHit(owner,target));}
function applyMagicHit(projectile,victim){
 const stats=projectile.stats,owner=projectile.owner,hit=victim===player?hurtPlayer(projectile.damage,owner,false,false,stats):hurtFighter(victim,owner,false,projectile.damage,stats);if(!hit)return;
 if(owner===player){hitmarkerUntil=time+.13;sound('hit');}burst(victim.position.clone().add(new V3(0,1,0)),stats.color,20,.9,victim);shockwave(victim.position,stats.color,victim);
 const alive=victim===player?player.health>0:victim.alive;
 if(stats.spell==='frost'&&alive)victim.slowUntil=time+SPELLS.frost.slowDuration;
 if(stats.spell==='venom'&&alive)victim.poison={next:time+SPELLS.venom.tickInterval,ticks:SPELLS.venom.ticks,damage:SPELLS.venom.tickDamage,owner};
 if(stats.spell==='arcane'){
  const hit=new Set([victim,owner]);let previous=victim;
  for(let n=0;n<SPELLS.arcane.chainTargets;n++){const next=validVictims(owner).filter(f=>!safeZone(f.position)&&!hit.has(f)&&f.position.distanceTo(previous.position)<SPELLS.arcane.chainRange&&!lineBlocked(previous.position,f.position)).sort((a,b)=>a.position.distanceTo(previous.position)-b.position.distanceTo(previous.position))[0];if(!next)break;
   arcLink(previous.position.clone().add(new V3(0,1,0)),next.position.clone().add(new V3(0,1,0)),stats.color);if(next===player)hurtPlayer(SPELLS.arcane.chainDamage,owner,false,false,{...stats,knockback:SPELLS.arcane.chainKnockback,effects:[]});else hurtFighter(next,owner,false,SPELLS.arcane.chainDamage,{...stats,knockback:SPELLS.arcane.chainKnockback,effects:[]});hit.add(next);previous=next;
  }
 }
}
function applyWeaponEffects(victim,owner,stats){
 if(victim===player&&admin.god)return;victim.effects??={};
 for(const effect of stats.effects??[]){
  const {type}=effect,config=EFFECTS[type],slow=config.kind==='slow',existing=victim.effects[type],level=Math.max(effect.level,existing?.level??0),interval=slow?0:config.interval,duration=slow?config.duration:interval*config.ticks;
  victim.effects[type]={type,level:Math.max(level,existing?.level??0),owner,until:time+duration+.01,next:existing?.next??time+interval,interval,ticks:slow?0:config.ticks,damage:slow?0:config.baseDamage+level*config.damagePerLevel};
  if(slow)victim.slowUntil=Math.max(victim.slowUntil??0,time+duration);
  burst(victim.position.clone().add(new V3(0,.9,0)),EFFECTS[type].hex,6,.35,victim);
 }
}
function effectDamage(victim,effect,color){
 if(victim===player){hurtPlayer(effect.damage,effect.owner,false,false,effect.owner===player?weaponStats(equippedItem(profile)):effect.owner?.stats,true);return;}
 const kit=effect.owner===player?KITS[selectedKit]:effect.owner?.kit??KITS.vanguard,amount=attackDamage(effect.damage,kit,false,false,armorReduction(victim));victim.hp-=amount;victim.hitFlashUntil=time+.12;victim.lastImpact=time;victim.returnAt=0;burst(victim.position.clone().add(new V3(0,.9,0)),color,6,.4);
 if(effect.owner===player){lastCombat=time;damageNumber(victim.position.clone().add(new V3(0,1.6,0)),amount);}
 if(victim.hp<=0)killFighter(victim,effect.owner);
}
const PROC_NAMES={explosion:'Explosion',launch:'Rift',nova:'Golden nova',chain:'Chain lightning',singularity:'Singularity'};
function shove(target,direction,force,lift){direction.y=0;if(direction.lengthSq()<1e-4)direction.set(0,0,-1);direction.normalize();target.knock.x=direction.x*force;target.knock.z=direction.z*force;target.velocity.y=Math.max(target.velocity.y,lift);target.grounded=false;}
function triggerProc(owner,victim,stats,random=Math.random){
 const proc=rollProc(stats,random);if(!proc||!owner)return null;
 const center=victim.position.clone(),mid=center.clone().add(new V3(0,1,0)),close=Math.min(center.distanceTo(player.position),owner.position.distanceTo(player.position));
 const hittable=t=>(t===player?mode==='play'&&player.health>0:t.alive)&&canHit(owner,t)&&!safeZone(t.position);
 const enemies=(from,radius)=>validVictims(owner).filter(t=>!safeZone(t.position)&&t.position.distanceTo(from)<radius);
 const strike=(t,amount)=>effectDamage(t,{damage:Math.round(amount),owner},proc.color);
 if(proc.kind==='explosion'){
  burst(mid,proc.color,44,2.6);burst(mid,0xfff0c8,22,1.7);criticalImpact(mid);shockwave(center,proc.color);shockwave(center.clone().add(new V3(0,.6,0)),0xffd27a);sound('heavy');sound('rumble');
  for(const t of enemies(center,proc.radius)){const falloff=1-t.position.distanceTo(center)/proc.radius*.5;shove(t,t.position.clone().sub(center).add(t===victim?t.position.clone().sub(owner.position):new V3()),proc.knockback*falloff,proc.lift*falloff);if(proc.ignite)ignite(t,owner);strike(t,proc.damage*falloff);}
  if(close<14)shake=Math.max(shake,.1);
 }else if(proc.kind==='launch'){
  if(hittable(victim)){shove(victim,center.clone().sub(owner.position),proc.knockback,proc.lift);strike(victim,proc.damage);}
  shockwave(center,proc.color);burst(center.clone().add(new V3(0,.2,0)),proc.color,34,1.9);burst(mid,0xf3e8ff,12,1.2);sound('magic');if(close<10)shake=Math.max(shake,.05);
 }else if(proc.kind==='nova'){
  const home=owner.position.clone();if(owner===player){player.health=Math.min(KITS[selectedKit].health,player.health+proc.heal);healUntil=time+.6;}else owner.hp=Math.min(owner.kit.health,owner.hp+proc.heal);
  burst(home.clone().add(new V3(0,1,0)),proc.color,40,1.6,owner);shockwave(home,proc.color,owner);shockwave(home.clone().add(new V3(0,.5,0)),0xfff6d8,owner);sound('tonic');sound('magic');
  for(const t of enemies(home,proc.radius)){shove(t,t.position.clone().sub(home),proc.knockback,4);strike(t,proc.damage);}
 }else if(proc.kind==='chain'){
  const struck=new Set([owner]);let previous=null,next=hittable(victim)?victim:null;
  while(next&&struck.size<=proc.targets){arcLink((previous??owner).position.clone().add(new V3(0,1.1,0)),next.position.clone().add(new V3(0,1,0)),proc.color);burst(next.position.clone().add(new V3(0,1,0)),proc.color,14,1);strike(next,proc.damage);next.slowUntil=Math.max(next.slowUntil??0,time+proc.slow);struck.add(next);previous=next;
   next=enemies(previous.position,proc.range).filter(t=>!struck.has(t)&&!lineBlocked(previous.position,t.position)).sort((a,b)=>a.position.distanceTo(previous.position)-b.position.distanceTo(previous.position))[0]??null;}
  sound('magic');sound('critical');
 }else if(proc.kind==='singularity'){
  burst(mid,proc.color,46,1.1);burst(mid,0x150c26,20,.7);criticalImpact(mid);shockwave(center,proc.color);sound('rumble');sound('magic');if(close<16)shake=Math.max(shake,.07);
  for(const t of enemies(center,proc.radius)){const d=t.position.distanceTo(center);if(t!==victim)shove(t,center.clone().sub(t.position),proc.pull*Math.min(1,d/proc.radius+.35),3.5);strike(t,proc.damage);}
 }
 if(owner===player||close<20)damageNumber(mid.clone().add(new V3(0,.9,0)),PROC_NAMES[proc.kind]);
 return proc;
}
function updatePressureFields(){
 const actors=[player,...fighters];for(const a of actors)a.pressureSlow=1;pressureAtmosphere=0;
 if(mode!=='play'){world.setPressure(null);return;}
 const owners=actors.filter(a=>(a===player?a.health>0:a.alive)&&!safeZone(a.position)&&(a===player?profile:a.account).cosmetic==='pressure'&&(a===player?profile:a.account).ownedCosmetics.includes('pressure'));
 let nearest=null,nearestDistance=Infinity;
 for(const owner of owners){
  const viewDistance=(freecam.active?camera.position:player.position).distanceTo(owner.position);if(viewDistance<nearestDistance){nearest=owner;nearestDistance=viewDistance;}
  pressureAtmosphere=Math.max(pressureAtmosphere,pressureStrength(viewDistance));
  for(const victim of actors){if(victim===owner||owners.includes(victim)||!(victim===player?victim.health>0:victim.alive)||safeZone(victim.position)||!canHit(owner,victim)||victim===player&&admin.god)continue;
   victim.pressureSlow=Math.min(victim.pressureSlow,pressureMultiplier(pressureStrength(victim.position.distanceTo(owner.position))));
  }
 }
 world.setPressure(nearest?.position??null,PRESSURE.radius);
}
function updateAscensionFields(dt){
 validateChargeOrb();if(mode!=='play')return;const actors=[player,...fighters];let audible=false;
 for(const owner of actors){
  const account=owner===player?profile:owner.account,alive=owner===player?owner.health>0:owner.alive;
  const active=alive&&account.cosmetic==='ascension'&&account.ownedCosmetics.includes('ascension')&&!safeZone(owner.position);
  if(!active){owner.ascensionActive=false;continue;}
  if(!owner.ascensionActive){owner.ascensionActive=true;owner.ascensionTickAt=time+ASCENSION.interval;}
  const tick=time>=owner.ascensionTickAt;if(tick)owner.ascensionTickAt=time+ASCENSION.interval;
  if(owner===player||owner.position.distanceTo(player.position)<28)audible=true;
  for(const victim of actors){
   if(victim===owner||!(victim===player?victim.health>0:victim.alive)||safeZone(victim.position)||!canHit(owner,victim)||victim===player&&admin.god)continue;
   const dx=victim.position.x-owner.position.x,dz=victim.position.z-owner.position.z,distance=Math.hypot(dx,dz),strength=ascensionStrength(distance);if(strength<=0)continue;
   // A steady outward acceleration, independent of melee hit immunity. Existing
   // movement and collision still let players strafe, run into it, and jump.
   const reverse=owner===player&&orbCharge.at>=0,power=reverse?orbPower():0;
   const angle=distance<.01?(victim.id??0)*2.399:Math.atan2(dz,dx),gust=reverse?-(32+power*46)*(.5+.5*strength)*Math.min(1,Math.max(0,(distance-1.15)/2)):ASCENSION.wind*(.45+.55*strength)*(1+.12*Math.sin(time*2.6));
   victim.knock.x+=Math.cos(angle)*gust*dt;victim.knock.z+=Math.sin(angle)*gust*dt;if(reverse){const speed=Math.hypot(victim.knock.x,victim.knock.z),limit=9+power*5;if(speed>limit){victim.knock.x*=limit/speed;victim.knock.z*=limit/speed;}}
   if(!tick)continue;const damage=distance<12?ASCENSION.nearDamage:ASCENSION.farDamage;
   if(victim===player){hurtPlayer(damage,owner,false,false,{damage,knockback:0,effects:[],aura:true},true);continue;}
   victim.hp=Math.max(0,victim.hp-damage);victim.hitFlashUntil=time+.09;victim.lastImpact=time;victim.returnAt=0;
   if(!victim.target){victim.target=admin.hunt?player:owner;victim.targetUntil=time+1;}
   if(owner===player){lastCombat=time;returnAt=0;}
   if(victim.hp<=0)killFighter(victim,owner);
  }
 }
 if(audible&&time>=ascensionSoundAt){sound('ascension');ascensionSoundAt=time+1.8;}
}
function updateAilments(f,dt){
 const alive=f===player?f.health>0:f.alive;if(!alive)return;
 if(safeZone(f.position)||f===player&&admin.god){f.effects={};f.poison=null;f.slowUntil=0;return;}
 if(f.poison&&time>=f.poison.next){const effect=f.poison;effect.next+=SPELLS.venom.tickInterval;effect.ticks--;effectDamage(f,effect,0x9ae57e);if(effect.ticks<=0)f.poison=null;if(f===player?f.health<=0:!f.alive)return;}
 for(const [type,effect]of Object.entries(f.effects??{})){
  const slow=EFFECTS[type].kind==='slow';
  if(!slow&&time>=effect.next&&effect.ticks>0){effect.next+=effect.interval;effect.ticks--;effectDamage(f,effect,EFFECTS[type].hex);}
  if(time>=effect.until||!slow&&effect.ticks<=0)delete f.effects[type];
  else if(Math.random()<dt*8)burst(f.position.clone().add(new V3((Math.random()-.5)*.4,.6,(Math.random()-.5)*.4)),EFFECTS[type].hex,2,.2,f);
  if(f===player?f.health<=0:!f.alive)break;
 }
 if(time<(f.slowUntil??0)&&Math.random()<dt*9)burst(f.position.clone().add(new V3(0,.4,0)),0xa4e7ff,2,.22,f);
}
function slowMultiplier(actor){const pressure=actor.pressureSlow??1;if(time>=(actor.slowUntil??0))return pressure;const frost=actor.effects?.frost;return pressure*(frost&&frost.until>time?1-(EFFECTS.frost.baseSlowPercent+frost.level*EFFECTS.frost.slowPercentPerLevel)/100:SPELLS.frost.speedMultiplier);}

function arrowMesh(){const g=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.73,5),new THREE.MeshStandardMaterial({color:0xb98b58}));shaft.rotation.x=Math.PI/2;g.add(shaft);const tip=new THREE.Mesh(new THREE.ConeGeometry(.05,.14,4),new THREE.MeshStandardMaterial({color:0xe1e8ed,metalness:.5,roughness:.35}));tip.rotation.x=-Math.PI/2;tip.position.z=-.43;g.add(tip);const feather=new THREE.Mesh(new THREE.BoxGeometry(.13,.012,.15),new THREE.MeshStandardMaterial({color:0xe8d7b2}));feather.position.z=.3;g.add(feather);return g;}
function releaseBow(){if(bowDrawAt<0)return;const charge=Math.min(1,(time-bowDrawAt)/BOW.fullDraw);bowDrawAt=-1;if(player.health<=0||mode!=='play'||freecam.active||selectedSlot!=='bow'||chatOpen||safeZone(player.position)||arrowCount<=0)return;arrowCount--;const direction=aimDirection(),mesh=arrowMesh();mesh.position.copy(player.position).add(new V3(0,player.crouched?1.02:1.5,0)).addScaledVector(direction,.45);const velocity=direction.multiplyScalar(26+charge*31);mesh.quaternion.setFromUnitVectors(new V3(0,0,-1),velocity.clone().normalize());scene.add(mesh);projectiles.push({mesh,velocity,life:3,damage:arrowDamage(charge),owner:player});sound('arrow');swingAge=0;lastCombat=time;updateHud();}
function updateProjectiles(dt){
 for(let i=projectiles.length-1;i>=0;i--){
  const shot=projectiles[i],old=shot.mesh.position.clone(),magic=shot.kind==='magic';shot.life-=dt;if(!magic)shot.velocity.y-=10*dt;shot.mesh.position.addScaledVector(shot.velocity,dt);
  if(magic){shot.mesh.rotation.x+=dt*7;shot.mesh.rotation.y+=dt*9;if(time>shot.trailAt){burst(old,shot.stats.color,2,.15);shot.trailAt=time+.045;}}
  else shot.mesh.quaternion.setFromUnitVectors(new V3(0,0,-1),shot.velocity.clone().normalize());
  const now=shot.mesh.position,segment=now.clone().sub(old),length=segment.length();let victim=null,closest=2;
  for(const f of validVictims(shot.owner)){if(safeZone(f.position))continue;const point=f.position.clone().add(new V3(0,f.crouched?.65:.95,0)),t=THREE.MathUtils.clamp(point.clone().sub(old).dot(segment)/Math.max(.001,segment.lengthSq()),0,1);if(point.distanceTo(old.clone().addScaledVector(segment,t))<(magic?.72:.6)&&t<closest){closest=t;victim=f;}}
  const ray=new THREE.Raycaster(old,segment.clone().normalize(),.001,length),wall=ray.intersectObjects(cameraObstacles,false)[0];
  const obstructed=!!wall||now.y<=groundHeight(now.x,now.z,now.y)||(inMiniArena(now.x,now.z)?Math.abs(now.x-MINI.x)>13||Math.abs(now.z)>15:Math.hypot(now.x,now.z)>34);
  if(victim&&(!obstructed||wall&&closest*length<wall.distance)){if(magic)applyMagicHit(shot,victim);else if(victim===player?hurtPlayer(shot.damage,shot.owner,false,false,{damage:shot.damage,knockback:3,effects:[]}):hurtFighter(victim,shot.owner,false,shot.damage,{damage:shot.damage,knockback:3,effects:[]})){if(shot.owner===player){hitmarkerUntil=time+.13;sound('hit');}}shot.life=0;}
  else if(obstructed){burst(wall?.point??now,magic?shot.stats.color:0xd3b690,magic?12:5,.5);shot.life=0;}
  if(shot.life<=0){scene.remove(shot.mesh);shot.mesh.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});projectiles.splice(i,1);}
 }
 if(safeZone(player.position))arrowCount=BOW.quiver;else if(arrowCount<BOW.quiver&&time>arrowRefillAt&&time-lastCombat>BOW.refillDelay){arrowCount++;arrowRefillAt=time+BOW.refillInterval;}
}

function makeAura(){const group=new THREE.Group();for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.69+i*.12,.018+i*.003,5,56),new THREE.MeshBasicMaterial({color:0xffc56c,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));ring.rotation.x=Math.PI/2;ring.position.y=.08+i*.48;group.add(ring);}return group;}
function updateAppearance(actor,dt,streak=actor.streak??0){
 const physical=actor===playerAvatar?player:actor;updateBurning(actor,(physical===player?player.health>0:actor.alive!==false)&&time<(physical.effects?.fire?.until??0),time);
 if(actor.team){if(!actor.teamRing){actor.teamRing=new THREE.Mesh(new THREE.RingGeometry(.5,.59,32),new THREE.MeshBasicMaterial({color:TEAM_COLORS[actor.team],side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));actor.teamRing.rotation.x=-Math.PI/2;actor.teamRing.position.y=.045;actor.root.add(actor.teamRing);}actor.teamRing.material.color.setHex(TEAM_COLORS[actor.team]);actor.teamRing.visible=actor.alive!==false;}else if(actor.teamRing)actor.teamRing.visible=false;
 if(actor===playerAvatar){actor.ascensionCharge=orbCharge.at>=0?Math.max(.001,orbPower()):0;const moving=Math.hypot(player.velocity.x,player.velocity.z)>.5;updateCosmetic(actor,profile.cosmetic,time,moving);
  if((thirdPerson||freecam.active)&&profile.cosmetic!=='none'&&moving&&player.grounded&&time>(actor.cosmeticTrailAt??0)){actor.cosmeticTrailAt=time+.11;const palette=COSMETICS[profile.cosmetic].colors,c=profile.cosmetic==='prism'?new THREE.Color().setHSL((time*.09)%1,.8,.6).getHex():palette[Math.floor(time*9)%palette.length];burst(player.position.clone().add(new V3(0,.12,0)),c,2,.3,player);}
 }
 if(actor!==playerAvatar)updateCosmetic(actor,actor.account?.cosmetic??'none',time,Math.hypot(actor.velocity?.x??0,actor.velocity?.z??0)>.5);
 const root=actor.root,tier=streakTier(streak),flash=time<(actor===playerAvatar?lastHurt+.2:actor.hitFlashUntil??0);if(!actor.aura){actor.aura=makeAura();root.add(actor.aura);}actor.aura.visible=tier>0&&actor.alive!==false;const color=tier===3?0xd69cff:tier===2?0xffad53:0xffdb79;
 actor.aura.children.forEach((ring,i)=>{ring.material.color.setHex(color);ring.material.opacity=.48+Math.sin(time*3+i)*.17;ring.rotation.z=time*(i%2?-1:1);ring.rotation.x=Math.PI/2+Math.sin(time*1.5+i)*.16;ring.position.y=.09+i*.46+Math.sin(time*2+i)*.055;ring.scale.setScalar(1+tier*.075);});
 actor.rig.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m.color)continue;const data=m.userData;restoreMaterial(m);if(flash)m.color.lerp(new THREE.Color(0xff3038),.78);if(m.emissive){m.emissiveIntensity=data.baseIntensity;if(flash){m.emissive.setHex(0xff2028);m.emissiveIntensity=.42;}else if(Object.keys((actor===playerAvatar?player:actor).effects??{}).length){const effect=Object.keys((actor===playerAvatar?player:actor).effects)[0];m.emissive.setHex(EFFECTS[effect].hex);m.emissiveIntensity=.18+Math.sin(time*6)*.06;}else if(tier){m.emissive.setHex(color);m.emissiveIntensity=Math.max(data.baseIntensity,.1+tier*.07);}}}});
 if(tier&&(actor!==playerAvatar||thirdPerson||freecam.active)&&Math.random()<dt*(tier*5))burst(actor.position.clone().add(new V3((Math.random()-.5)*.8,.1,(Math.random()-.5)*.8)),color,1,.22,actor===playerAvatar?player:actor);
}
function addVolcanoes(){for(const model of placeMapProps(MAP,'volcano',models,prepareModel)){scene.add(model);volcanoes.push(model);}}
function clearSupplies(){for(const drop of supplyDrops){scene.remove(drop.mesh);scene.remove(drop.ring);drop.ring.geometry.dispose();drop.ring.material.dispose();}supplyDrops.length=0;}
function addSupplies(){clearSupplies();for(const p of MAP.supplyDrops){const mesh=prepareModel(models['supply-crate.glb'].scene.clone(true));mesh.scale.setScalar(.62);mesh.position.set(p.x,14,p.z);scene.add(mesh);const ring=new THREE.Mesh(new THREE.RingGeometry(.95,1.06,40),new THREE.MeshBasicMaterial({color:0xffda79,side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.06,p.z);scene.add(ring);supplyDrops.push({mesh,ring,position:mesh.position,collected:false});}}
function collectSupply(drop,actor){drop.collected=true;scene.remove(drop.mesh,drop.ring);burst(drop.position.clone().add(new V3(0,.4,0)),0xffd684,22,1);shockwave(drop.position,0xffd684);if(actor===player){const reward=SUPPLIES.player;profile.coins+=reward.coins;arrowCount=Math.min(BOW.maxArrows,arrowCount+reward.arrows);player.health=Math.min(KITS[selectedKit].health,player.health+reward.health);persist();chatSystem(`Supply crate: +${reward.coins} coins · +${reward.arrows} arrows · +${reward.health} health`,'reward');sound('buy');updateProfileUI();}else{actor.account.coins+=SUPPLIES.bot.coins;actor.hp=Math.min(actor.kit.health,actor.hp+SUPPLIES.bot.health);actor.planUntil=0;}}
function spawnHazard(position){if(isUnderBridge(position)||safeZone(position))return;const eruption=arenaEvent.type.fire,ring=new THREE.Mesh(new THREE.RingGeometry(1.65,1.84,36),new THREE.MeshBasicMaterial({color:eruption?0xff7850:0xffd286,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(position.x,.055,position.z);const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(eruption?.54:.8,0),new THREE.MeshStandardMaterial({color:eruption?0x572f35:0x7d6b77,emissive:eruption?0xff6524:0x000000,emissiveIntensity:eruption?1.7:0,roughness:.9}));rock.position.copy(ring.position);rock.position.y=20;scene.add(ring,rock);hazardMarks.push({ring,rock,fire:eruption,at:time+HAZARDS.fallTime,damage:arenaEvent.type.damage});}
function updateArenaEvents(dt){const change=advanceEvent(arenaEvent,time);if(change==='warning'){chatSystem(arenaEvent.type.name+' in '+EVENT_SCHEDULE.warning+'s. '+arenaEvent.type.warning+'.');sound('warning');}if(change==='start'){chatSystem(arenaEvent.type.name+' started.');if(arenaEvent.type.kind==='supply')addSupplies();else{sound('rumble');shake=.1;}}if(change==='end'){chatSystem('The arena has settled.');clearSupplies();}
 if(arenaEvent.phase==='active'&&arenaEvent.type.kind==='hazard'&&time>=arenaEvent.nextPulse){arenaEvent.nextPulse=time+HAZARDS.pulseInterval;const targets=[player,...fighters.filter(f=>f.alive)];for(let i=0;i<HAZARDS.perPulse;i++){const a=targets[Math.floor(Math.random()*targets.length)];spawnHazard(a.position.clone().add(new V3((Math.random()-.5)*HAZARDS.scatter,0,(Math.random()-.5)*HAZARDS.scatter)));}if(arenaEvent.type.fire)for(const v of volcanoes)burst(v.position.clone().add(new V3(0,2.5,0)),0xff8845,12,2.4);if(time-lastEventTick>HAZARDS.ambientInterval){lastEventTick=time;sound('rumble');shake=Math.max(shake,.022);const ambient=arenaEvent.type.ambientDamage;if(ambient>0)for(const a of [player,...fighters]){if(safeZone(a.position)||isUnderBridge(a.position)||a!==player&&!a.alive)continue;if(arenaEvent.type.fire)ignite(a);if(a===player)hurtPlayer(ambient,null,true);else{a.hp-=ambient;a.hitFlashUntil=time+.15;if(a.hp<=0)killFighter(a,null);}}}}
 for(let i=hazardMarks.length-1;i>=0;i--){const h=hazardMarks[i],remaining=h.at-time;h.rock.position.y=Math.max(.35,remaining*14);h.rock.rotation.x+=dt*3;h.rock.rotation.z+=dt*2;h.ring.material.opacity=.55+Math.sin(time*20)*.3;if(remaining<=0){const p=h.ring.position;burst(p.clone().add(new V3(0,.4,0)),0xf6b87c,20,2);shockwave(p,0xffa05d);for(const a of[player,...fighters]){if(a!==player&&!a.alive||safeZone(a.position)||isUnderBridge(a.position))continue;if(Math.hypot(a.position.x-p.x,a.position.z-p.z)<HAZARDS.radius&&a.position.y<HAZARDS.maxHeight){if(h.fire)ignite(a);if(a===player){const damaged=hurtPlayer(h.damage,null,true);const direction=a.position.clone().sub(p);direction.y=0;if(damaged&&direction.lengthSq())a.knock.addScaledVector(direction.normalize(),HAZARDS.knockback);}else{a.hp-=h.damage;a.hitFlashUntil=time+.2;a.lastImpact=time;if(a.hp<=0)killFighter(a,null);}}}if(p.distanceTo(player.position)<12)shake=Math.max(shake,.05);scene.remove(h.ring,h.rock);h.ring.geometry.dispose();h.ring.material.dispose();h.rock.geometry.dispose();h.rock.material.dispose();hazardMarks.splice(i,1);}}
 for(const drop of supplyDrops){if(drop.collected)continue;drop.mesh.position.y=Math.max(.12,drop.mesh.position.y-dt*5);drop.ring.rotation.z=time*.7;if(drop.mesh.position.y<=.2){for(const a of[player,...fighters])if((a===player||a.alive)&&a.position.distanceTo(drop.position)<SUPPLIES.pickupRadius){collectSupply(drop,a);break;}}}
}
function updateEventHud(){updateDuelHud();const show=!isDueling()&&arenaEvent.phase!=='idle';$('event-warning').classList.toggle('hidden',!show);if(!show)return;const remaining=Math.max(0,Math.ceil(arenaEvent.at-time));$('event-name').textContent=arenaEvent.type.name;$('event-countdown').textContent=remaining+'s';$('event-detail').textContent=arenaEvent.type.kind==='supply'?(arenaEvent.phase==='warning'?'Supply crates arriving':'Collect the glowing supply crates'):isUnderBridge(player.position)?'Covered by the bridge':safeZone(player.position)?'Protected on the ledge':arenaEvent.type.warning;$('event-warning').classList.toggle('protected',isUnderBridge(player.position)||safeZone(player.position));}

async function load(){try{const loader=new GLTFLoader(),files=[...Object.values(CHARACTERS).map(c=>c.file),...new Set(Object.values(WEAPONS).map(w=>w.file)),...Object.values(ARMORS).map(a=>a.file).filter(Boolean),...Object.values(POTIONS).map(p=>p.file),'ledge-table.glb','sword-rack.glb','treasure-chest.glb','supply-crate.glb','rock-pack.glb','bow.glb','volcano.glb','pumpkin.glb',...new Set(Object.values(CHARACTERS).map(c=>animationAsset(c.file))),MERCHANT.file,animationAsset(MERCHANT.file)];let count=0;await Promise.all(files.map(async file=>{models[file]=await loader.loadAsync('./assets/'+file+'?v='+(file==='fighter-adventurer.glb'?51:12));count++;$('play-label').textContent='Loading '+Math.round(count/files.length*100)+'%';}));installQuaterniusAnimations();loaded=true;generateThumbnails();addImportedEnvironment();addVolcanoes();addPumpkins();scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh&&o!==fxMesh&&!o.userData.noCameraCollision)cameraObstacles.push(o);});refreshEquipment();restoreLoot();for(let i=0;i<9;i++)makeFighter(i);$('play').disabled=false;$('play-label').textContent='Play';if(activeModal==='shop')renderShop();}catch(error){console.error('Emberfall asset load failed',error);fatal('A required game asset failed to load. Reload to retry. '+(error.message??''));}}
syncViewControls();selectKit(selectedKit);updateProfileUI();updateCamera(0);requestAnimationFrame(frame);load();
