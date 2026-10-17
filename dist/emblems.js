// Small, validated vector designs. Saved data never contains SVG, URLs or HTML.
export const EMBLEM_LIMIT=12;
export const EMBLEM_SHAPES={
 bolt:{name:'Lightning',path:'M5 -29 -20 3 -3 3 -9 29 22 -7 4 -7Z'},
 sword:{name:'Sword',path:'M0 -30 7 -20 4 8 16 12 13 17 3 14 3 26 -3 26 -3 14 -13 17 -16 12 -4 8 -7 -20Z'},
 star:{name:'Star',path:'M0 -29 7 -9 28 -9 11 4 17 25 0 12 -17 25 -11 4 -28 -9 -7 -9Z'},
 diamond:{name:'Diamond',path:'M0 -29 24 0 0 29 -24 0Z'},
 circle:{name:'Circle',path:'M27 0A27 27 0 1 1 -27 0A27 27 0 1 1 27 0Z'},
 ring:{name:'Ring',path:'M28 0A28 28 0 1 1 -28 0A28 28 0 1 1 28 0ZM18 0A18 18 0 1 0 -18 0A18 18 0 1 0 18 0Z'},
 chevron:{name:'Chevron',path:'M-28 -4 0 -24 28 -4 28 12 0 -7 -28 12Z'},
 wing:{name:'Wing',path:'M-25 22 -20 -23 27 -28 12 -13 23 -14 7 1 17 0 -2 15 5 15 -12 27Z'},
 flame:{name:'Flame',path:'M0 -30C6 -13 26 -9 22 10C19 29 -15 32 -22 12C-29 -6 -9 -10 -13 -23C-5 -20 -8 -5 -1 -4C6 -7 3 -20 0 -30Z'},
 crown:{name:'Crown',path:'M-28 -19 -14 -3 0 -28 14 -3 28 -19 22 20 -22 20ZM-21 24 21 24 21 29 -21 29Z'},
 eye:{name:'Eye',path:'M-30 0Q0 -32 30 0Q0 32 -30 0ZM10 0A10 10 0 1 0 -10 0A10 10 0 1 0 10 0Z'},
 triangle:{name:'Triangle',path:'M0 -29 29 25 -29 25Z'},
};
const BADGES={shield:'M10 10H118V64Q116 102 64 122Q12 102 10 64Z',hex:'M64 4 116 34V94L64 124 12 94V34Z',circle:'M123 64A59 59 0 1 1 5 64A59 59 0 1 1 123 64Z'};
const color=(v,fallback)=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v)?v.toUpperCase():fallback;
const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.round(Math.max(min,Math.min(max,v))*100)/100:fallback;
export function sanitizeEmblem(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 return{version:1,badge:Object.hasOwn(BADGES,value.badge)?value.badge:'shield',background:color(value.background,'#251D34'),border:color(value.border,'#D8B477'),layers:(Array.isArray(value.layers)?value.layers:[]).slice(0,EMBLEM_LIMIT).filter(l=>l&&Object.hasOwn(EMBLEM_SHAPES,l.shape)).map(l=>({shape:l.shape,color:color(l.color,'#FFE1A0'),x:number(l.x,-48,48,0),y:number(l.y,-48,48,0),scale:number(l.scale,.15,2,1),rotation:number(l.rotation,-180,180,0),opacity:number(l.opacity,.1,1,1),flip:l.flip===true}))};
}
export function defaultEmblem(){return sanitizeEmblem({layers:[{shape:'wing',color:'#9576C9',x:-18,scale:.9},{shape:'wing',color:'#9576C9',x:18,scale:.9,flip:true},{shape:'sword',color:'#FFE1A0',scale:1.12}]});}
export function emblemSVG(value,selected=-1){const e=sanitizeEmblem(value);if(!e)return'';const shape=BADGES[e.badge];return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Custom emblem"><defs><clipPath id="badge-clip"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="${e.background}" stroke="${e.border}" stroke-width="4" stroke-linejoin="round"/><g clip-path="url(#badge-clip)">${e.layers.map((l,i)=>`<g data-layer="${i}" transform="translate(${64+l.x} ${64+l.y}) rotate(${l.rotation}) scale(${l.flip?-l.scale:l.scale} ${l.scale})" opacity="${l.opacity}"><path d="${EMBLEM_SHAPES[l.shape].path}" fill="${l.color}" fill-rule="evenodd"/>${i===selected?'<rect x="-31" y="-33" width="62" height="66" rx="3" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" pointer-events="none"/>':''}</g>`).join('')}</g></svg>`;}
export const emblemDataURL=value=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(emblemSVG(value));
const copy=value=>JSON.parse(JSON.stringify(value));
export class EmblemDraft{
 constructor(value){this.value=sanitizeEmblem(value)??defaultEmblem();this.selected=this.value.layers.length-1;this.past=[];this.future=[];}
 snapshot(){this.past.push({value:copy(this.value),selected:this.selected});if(this.past.length>50)this.past.shift();this.future=[];}
 update(patch,record=true){const current=this.value.layers[this.selected];if(!current)return;const clean=sanitizeEmblem({layers:[{...current,...patch}]}).layers[0];if(!clean)return;if(record)this.snapshot();this.value.layers[this.selected]=clean;}
 badge(patch){this.snapshot();this.value=sanitizeEmblem({...this.value,...patch});}
 add(shape){if(!Object.hasOwn(EMBLEM_SHAPES,shape)||this.value.layers.length>=EMBLEM_LIMIT)return false;this.snapshot();this.value.layers.push(sanitizeEmblem({layers:[{shape}]}).layers[0]);this.selected=this.value.layers.length-1;return true;}
 remove(){if(this.selected<0)return;this.snapshot();this.value.layers.splice(this.selected,1);this.selected=Math.min(this.selected,this.value.layers.length-1);}
 duplicate(){if(this.selected<0||this.value.layers.length>=EMBLEM_LIMIT)return;this.snapshot();const l=copy(this.value.layers[this.selected]);l.x=Math.min(48,l.x+4);this.value.layers.splice(this.selected+1,0,l);this.selected++;}
 move(direction){const to=this.selected+direction;if(this.selected<0||to<0||to>=this.value.layers.length)return;this.snapshot();const [l]=this.value.layers.splice(this.selected,1);this.value.layers.splice(to,0,l);this.selected=to;}
 reset(){this.snapshot();this.value=defaultEmblem();this.selected=this.value.layers.length-1;}
 undo(){if(!this.past.length)return;this.future.push({value:copy(this.value),selected:this.selected});const s=this.past.pop();this.value=s.value;this.selected=s.selected;}
 redo(){if(!this.future.length)return;this.past.push({value:copy(this.value),selected:this.selected});const s=this.future.pop();this.value=s.value;this.selected=s.selected;}
}
export function createEmblemEditor(parent,{value,onSave,onCancel}){
 const draft=new EmblemDraft(value),root=document.createElement('div');root.className='emblem-editor';
 root.innerHTML=`<div class="emblem-workspace"><div class="emblem-stage" tabindex="0" aria-label="Emblem canvas. Drag a shape to move it."></div><div class="emblem-history"><button type="button" data-emblem-action="undo">Undo</button><button type="button" data-emblem-action="redo">Redo</button><button type="button" data-emblem-action="reset">Reset</button></div><div class="emblem-base"><label>Badge<select data-emblem-field="badge"><option value="shield">Shield</option><option value="hex">Hexagon</option><option value="circle">Circle</option></select></label><label>Background<input type="color" data-emblem-field="background"></label><label>Border<input type="color" data-emblem-field="border"></label></div><p class="emblem-hint">Drag shapes to place them. Your saved emblem appears on the leaderboard.</p></div><div class="emblem-tools"><div class="emblem-shapes" aria-label="Add a shape"></div><div class="emblem-layers" aria-label="Layers"></div><div class="emblem-transform"><label>Color<input type="color" data-emblem-field="color"></label>${[['scale','Size',.15,2,.05],['rotation','Rotation',-180,180,1],['x','Horizontal',-48,48,1],['y','Vertical',-48,48,1],['opacity','Opacity',.1,1,.05]].map(([key,label,min,max,step])=>`<label>${label}<input type="range" data-emblem-field="${key}" min="${min}" max="${max}" step="${step}"></label>`).join('')}<div class="emblem-layer-actions"><button type="button" data-emblem-action="flip">Mirror</button><button type="button" data-emblem-action="duplicate">Copy</button><button type="button" data-emblem-action="up" aria-label="Bring layer forward">↑</button><button type="button" data-emblem-action="down" aria-label="Send layer backward">↓</button><button type="button" data-emblem-action="remove">Delete</button></div></div></div><div class="emblem-save"><button type="button" class="text-button" data-emblem-action="clear">Remove emblem</button><button type="button" class="secondary-button" data-emblem-action="cancel">Cancel</button><button type="button" class="primary-button" data-emblem-action="save">Save emblem</button></div>`;
 parent.append(root);const stage=root.querySelector('.emblem-stage'),layers=root.querySelector('.emblem-layers'),shapes=root.querySelector('.emblem-shapes'),fields={};
 for(const key of ['badge','background','border','color','scale','rotation','x','y','opacity'])fields[key]=root.querySelector(`[data-emblem-field="${key}"]`);
 const actions={};for(const key of ['undo','redo','reset','flip','duplicate','up','down','remove','clear','cancel','save'])actions[key]=root.querySelector(`[data-emblem-action="${key}"]`);
 const shapeButtons=[];for(const [key,s]of Object.entries(EMBLEM_SHAPES)){const b=document.createElement('button');b.type='button';b.title='Add '+s.name;b.setAttribute('aria-label','Add '+s.name);b.innerHTML=`<svg viewBox="-34 -34 68 68" aria-hidden="true"><path d="${s.path}" fill="currentColor" fill-rule="evenodd"/></svg>`;b.addEventListener('click',()=>{draft.add(key);refresh();stage.focus();});shapes.append(b);shapeButtons.push(b);}
 function refresh(){stage.innerHTML=emblemSVG(draft.value,draft.selected);layers.replaceChildren();
  [...draft.value.layers].map((l,i)=>({l,i})).reverse().forEach(({l,i})=>{const b=document.createElement('button');b.type='button';b.className='emblem-layer'+(i===draft.selected?' selected':'');b.innerHTML=`<i style="background:${l.color}"></i><span>${EMBLEM_SHAPES[l.shape].name}</span><small>${i+1}</small>`;b.setAttribute('aria-pressed',String(i===draft.selected));b.addEventListener('click',()=>{draft.selected=i;refresh();stage.focus();});layers.append(b);});
  const l=draft.value.layers[draft.selected];for(const [key,input]of Object.entries(fields)){const base=['badge','background','border'].includes(key);input.disabled=!base&&!l;input.value=base?draft.value[key]:l?.[key]??'';}
  actions.undo.disabled=!draft.past.length;actions.redo.disabled=!draft.future.length;for(const key of ['flip','duplicate','remove'])actions[key].disabled=!l;actions.up.disabled=!l||draft.selected===draft.value.layers.length-1;actions.down.disabled=!l||draft.selected===0;actions.duplicate.disabled=!l||draft.value.layers.length>=EMBLEM_LIMIT;shapeButtons.forEach(b=>b.disabled=draft.value.layers.length>=EMBLEM_LIMIT);
 }
 for(const [key,input]of Object.entries(fields))input.addEventListener(key==='badge'?'change':'input',()=>{const base=['badge','background','border'].includes(key),v=['badge','background','border','color'].includes(key)?input.value:Number(input.value);if(base)draft.badge({[key]:v});else draft.update({[key]:v});refresh();});
 const perform={undo:()=>draft.undo(),redo:()=>draft.redo(),reset:()=>draft.reset(),flip:()=>draft.update({flip:!draft.value.layers[draft.selected]?.flip}),duplicate:()=>draft.duplicate(),up:()=>draft.move(1),down:()=>draft.move(-1),remove:()=>draft.remove(),clear:()=>onSave(null),cancel:onCancel,save:()=>onSave(sanitizeEmblem(draft.value))};
 for(const [key,b]of Object.entries(actions))b.addEventListener('click',()=>{perform[key]();if(!['save','clear','cancel'].includes(key))refresh();});
 let drag=null;stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;const node=e.target.closest?.('[data-layer]');if(!node)return;const i=Number(node.dataset.layer);if(!draft.value.layers[i])return;e.preventDefault();draft.selected=i;draft.snapshot();const l=draft.value.layers[i];drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:l.x,startY:l.y};stage.setPointerCapture(e.pointerId);refresh();});
 stage.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;const b=stage.getBoundingClientRect();draft.update({x:drag.startX+(e.clientX-drag.x)*128/b.width,y:drag.startY+(e.clientY-drag.y)*128/b.height},false);refresh();});for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,()=>drag=null);
 stage.addEventListener('keydown',e=>{if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();draft.remove();refresh();return;}const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key],l=draft.value.layers[draft.selected];if(direction&&l){e.preventDefault();const step=e.shiftKey?5:1;draft.update({x:l.x+direction[0]*step,y:l.y+direction[1]*step});refresh();}});
 root.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.target.closest?.('input,select'))return;const key=e.key.toLowerCase();if(key==='z'||key==='y'){e.preventDefault();e.stopPropagation?.();if(key==='y'||e.shiftKey)draft.redo();else draft.undo();refresh();}});
 refresh();return{root,draft,refresh};
}
