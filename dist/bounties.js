import {CONFIG} from './shared/config.js?v=65';
export const BOUNTIES=CONFIG.progression.bounties.contracts;
export const BOUNTY_LIMIT=CONFIG.progression.bounties.activeLimit;
const catalog=new Map(BOUNTIES.map(b=>[b.id,b]));
export function sanitizeBounties(saved={}){
 const claimed=[...new Set((Array.isArray(saved?.claimed)?saved.claimed:[]).filter(id=>catalog.has(id)))],active=[];
 for(const entry of Array.isArray(saved?.active)?saved.active:[]){const b=catalog.get(entry?.id);if(!b||claimed.includes(b.id)||active.some(a=>a.id===b.id)||active.length>=BOUNTY_LIMIT)continue;active.push({id:b.id,progress:Number.isFinite(entry.progress)?Math.max(0,Math.min(b.target,Math.floor(entry.progress))):0});}
 return{active,claimed};
}
export function acceptBounty(profile,id){
 const b=catalog.get(id),state=profile.bounties;
 if(!b||state.claimed.includes(id))return{ok:false,error:'Bounty unavailable'};
 if(state.active.some(a=>a.id===id))return{ok:false,error:'Bounty already active'};
 if(state.active.length>=BOUNTY_LIMIT)return{ok:false,error:'Finish or abandon an active bounty first'};
 state.active.push({id,progress:0});return{ok:true};
}
export function advanceBounties(profile,metric,amount=1){
 if(!Number.isSafeInteger(amount)||amount<=0)return false;let changed=false;
 for(const entry of profile.bounties.active){const b=catalog.get(entry.id);if(b.metric!==metric||entry.progress>=b.target)continue;entry.progress=Math.min(b.target,entry.progress+amount);changed=true;}return changed;
}
export function claimBounty(profile,id){
 const state=profile.bounties,b=catalog.get(id),entry=state.active.find(a=>a.id===id);
 if(!b||!entry||entry.progress<b.target||state.claimed.includes(id))return{ok:false,error:'Bounty is not complete'};
 state.active=state.active.filter(a=>a.id!==id);state.claimed.push(id);profile.coins+=b.coins;profile.rating+=b.points;return{ok:true,coins:b.coins,points:b.points};
}
export function abandonBounty(profile,id){const before=profile.bounties.active.length;profile.bounties.active=profile.bounties.active.filter(a=>a.id!==id);return{ok:profile.bounties.active.length<before};}
