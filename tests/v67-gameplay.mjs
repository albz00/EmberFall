import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {defaultEmblem} from '../dist/emblems.js';
export async function verifyV67(t,{byId,windowEvents}){
 t.closeAll();t.setMode('play');t.keys.clear();t.admin.god=t.admin.flying=false;t.resetPlayer();
 const m=t.merchant,station=t.stations.find(s=>s.type==='merchant');m.speakingUntil=0;
 t.player.position.copy(station.position);assert(t.speakMerchant('greet',1));assert(!m.voice.greet.paused);
 t.player.position.y=0;t.updateMerchant(1/60);assert(m.voice.greet.paused);assert.equal(m.voice.greet.volume,0,'leaving the ledge silences an already-playing clip');assert(!t.speakMerchant('call',1),'nearby arena players cannot start merchant speech');
 t.player.position.y=7;assert(!t.speakMerchant('call',1),'under-ledge balcony is also outside voice area');
 t.player.position.copy(station.position);assert(t.speakMerchant('call',1),'voice resumes normally on the ledge');m.speakingUntil=0;
 t.profile.emblem=defaultEmblem();t.showScoreboard();const own=[...byId.get('score-rows').children,...byId.get('score-rows-2').children,...byId.get('score-rows-3').children].find(r=>r.classList.contains('player')),identity=own.children[0].children[0];assert.equal(identity.children[0].className,'score-emblem');assert.equal(identity.children[0].width,44);assert.equal(identity.children[1].children[0].textContent,t.profile.name,'name has a separate column to the right of the emblem');
 assert(!byId.has('pause-leaderboard')&&!byId.has('leaderboard-button')&&!byId.has('leaderboard-close'));
 for(const fn of windowEvents.keyup)fn({code:'Tab'});assert(byId.get('scoreboard').classList.contains('hidden'));
 t.resetPlayer();for(const fn of windowEvents.keydown)fn({code:'Tab',repeat:false,target:{tagName:'BODY'},preventDefault(){}});assert(!byId.get('scoreboard').classList.contains('hidden'));for(const fn of windowEvents.keyup)fn({code:'Tab'});assert(byId.get('scoreboard').classList.contains('hidden'));
 t.setSlot('bow');t.updateWeapon(0);t.weaponPivot.updateMatrixWorld(true);const arrow=t.weaponPivot.getObjectByName('arrow');assert(arrow&&arrow.children.length===3);const string=(()=>{let found;t.heldGroup.traverse(o=>{if(o.isLine)found=o;});return found;})();assert(string);const nock=arrow.localToWorld(new T.Vector3(0,0,arrow.userData.nockZ)),seat=string.localToWorld(new T.Vector3().fromBufferAttribute(string.geometry.attributes.position,1));assert(nock.distanceTo(seat)<1e-6,'arrow nock seats on the bowstring');t.setSlot('sword');
 assert.equal(t.stations.find(s=>s.type==='match').name,'[Join a match]');
 console.log(JSON.stringify({v67:'passed',merchantVoiceOnlyOnLedge:true,activeClipStopsOnExit:true,largeEmblemLeftOfName:true,tabOnlyPlayerList:true,goldMatchAction:true}));
}
