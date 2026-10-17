import {CARRY_SLOTS,HOTBAR_SLOTS,VAULT_STEP,CHEST_PRICE,RARITIES,ARMORS,POTIONS,itemKind,itemName,itemArtKey,weaponStats,salvageValue,storagePrice} from './progression.js?v=68';
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
export function slotArt(item,thumbs){
 if(!item)return '';
 const key=itemArtKey(item),fallback=item.orb?'orb':item.weapon?'sword':item.armor?'armor':item.potion?'potion':'bow';
 return (thumbs[key]?`<img src="${thumbs[key]}" alt="" draggable="false">`:icon(fallback))+(item.potion?`<b>${item.count}</b>`:'');
}
export function renderInventoryPanel({root,profile:p,thumbs,storage=false,canTrade=false,selection,onSelect,onEquip,onTransfer,onSell,onExpand,onMove,onDrop,onRoll,details,mountPreview,hidePreview}){
 let tooltip=null;const hideTip=()=>{if(tooltip)tooltip.hidden=true;};if(document.removeEventListener)document.addEventListener('scroll',hideTip,true);
 let selected=(selection?.stored?p.vault:p.inventory).find(i=>i.id===selection?.id);const slots=[],layout=document.createElement('div');layout.className='inventory-layout'+(storage?' with-storage':'');
 const slot=(index,stored)=>{
  const id=(stored?p.vaultSlots:p.carrySlots)[index],item=(stored?p.vault:p.inventory).find(i=>i.id===id),b=document.createElement('button');
  b.className='inventory-slot'+(item?' occupied':'')+(selected===item&&item?' selected':'')+(!stored&&index===p.selectedHotbar?' held':'');b.dataset.slot=String(index);b.dataset.container=stored?'vault':'carry';
  if(item){b.dataset.itemId=item.id;b.style.setProperty('--rarity',RARITIES[item.rarity].color);b.innerHTML=slotArt(item,thumbs);b.draggable=true;b.title='';b.setAttribute('aria-label',itemName(item));
   b.addEventListener('pointerenter',e=>showTip(item,e,b));b.addEventListener('pointermove',e=>placeTip(e,b));b.addEventListener('pointerleave',hideTip);b.addEventListener('focus',e=>showTip(item,null,b));b.addEventListener('blur',hideTip);b.addEventListener('dblclick',()=>{if(!stored){hideTip();onEquip(item);}});
   if([p.armorItem,p.helmetItem].includes(item.id)){const mark=document.createElement('span');mark.className='slot-equipped';mark.textContent='✓';b.append(mark);}
   b.addEventListener('dragstart',e=>{hideTip();e.dataTransfer.setData('application/x-emberfall-item',JSON.stringify({id:item.id,stored}));e.dataTransfer.effectAllowed='move';b.classList.add('dragging');});
   b.addEventListener('dragend',()=>b.classList.remove('dragging'));
  }else b.title='Empty '+(stored?'chest':index<HOTBAR_SLOTS?'hotbar':'backpack')+' slot';
  b.setAttribute('aria-label',(item?itemName(item):b.title)+' '+(index+1));b.setAttribute('aria-pressed',String(item===selected&&!!item));
  if(!stored&&index<HOTBAR_SLOTS){const key=document.createElement('kbd');key.textContent=String(index+1);b.append(key);}
  b.addEventListener('click',e=>{if(e?.shiftKey&&item&&storage){onTransfer(item.id,!stored);return;}onSelect(item===selected?null:item?.id??null,stored);});
  b.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add('drop-target');});
  b.addEventListener('dragleave',()=>b.classList.remove('drop-target'));
  b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('drop-target');try{const data=JSON.parse(e.dataTransfer.getData('application/x-emberfall-item'));if(typeof data.id==='string')onMove(data.id,!!data.stored,stored,index);}catch{}});
  slots.push({button:b,item,stored});return b;
 };
 const panel=(stored)=>{
  const el=document.createElement('section');el.className='inventory-panel '+(stored?'vault-panel':'carry-panel');const heading=document.createElement('div');heading.className='inventory-heading';heading.innerHTML=`<strong>${stored?'Chest':'Inventory'}</strong><span>${stored?p.vault.length:p.inventory.length} / ${stored?p.vaultCapacity:CARRY_SLOTS}</span>`;el.append(heading);
  const grid=document.createElement('div');grid.className='inventory-grid '+(stored?'vault-grid':'backpack-grid');grid.setAttribute('aria-label',stored?'Chest slots':'Backpack slots');
  for(let i=stored?0:HOTBAR_SLOTS;i<(stored?p.vaultCapacity:CARRY_SLOTS);i++)grid.append(slot(i,stored));el.append(grid);
  if(!stored){const belt=document.createElement('div');belt.className='physical-hotbar';belt.setAttribute('aria-label','Hotbar slots · part of your 20-slot inventory');for(let i=0;i<HOTBAR_SLOTS;i++)belt.append(slot(i,false));el.append(belt);}
  else{const actions=document.createElement('div');actions.className='chest-actions';const expand=document.createElement('button');expand.className='secondary-button storage-upgrade';expand.innerHTML=`+${VAULT_STEP} slots ${icon('coin')} ${storagePrice(p)}`;expand.addEventListener('click',onExpand);actions.append(expand);
   const roll=document.createElement('button');roll.className='secondary-button chest-roll';roll.innerHTML=`Roll equipment ${icon('coin')} ${CHEST_PRICE}`;roll.title='Random physical weapon. Common 52% · Rare 32% · Epic 13% · Legendary 3%';roll.addEventListener('click',onRoll);actions.append(roll);el.append(actions);}
  return el;
 };
 layout.append(panel(false));if(storage)layout.append(panel(true));
 const detail=document.createElement('aside');detail.className='inventory-detail character-paperdoll';
 const avatar=document.createElement('div');avatar.className='inventory-avatar';avatar.setAttribute('aria-label','Your equipped character');detail.append(avatar);mountPreview?.(avatar);
 const hint=document.createElement('small');hint.className='avatar-rotate-hint';hint.textContent='Drag to rotate';detail.append(hint);
 const armorSlots=document.createElement('div');armorSlots.className='armor-equip-slots';
 for(const [key,label,accept]of[['helmetItem','Helmet','head'],['armorItem','Chestplate','torso'],['equipped','Weapon','weapon']]){
  const b=document.createElement('button'),item=p.inventory.find(i=>i.id===p[key]);b.className='armor-equip-slot';b.dataset.equipSlot=key;b.innerHTML=(item?slotArt(item,thumbs):icon(accept==='weapon'?'sword':'armor'))+'<span>'+label+'</span>';b.title='Drag '+label.toLowerCase()+' here'+(item?' · click to '+(accept==='weapon'?'hold':'unequip'):'');b.setAttribute('aria-label',label+(item?': '+itemName(item):': empty'));
  b.addEventListener('click',()=>{if(item){hideTip();onEquip(item);}});if(item){b.addEventListener('pointerenter',e=>showTip(item,e,b));b.addEventListener('pointermove',e=>placeTip(e,b));b.addEventListener('pointerleave',hideTip);}
  b.addEventListener('dragover',e=>{e.preventDefault();b.classList.add('drop-target');});b.addEventListener('dragleave',()=>b.classList.remove('drop-target'));b.addEventListener('drop',e=>{e.preventDefault();hideTip();b.classList.remove('drop-target');try{const data=JSON.parse(e.dataTransfer.getData('application/x-emberfall-item')),candidate=p.inventory.find(i=>i.id===data.id);if(data.stored||!candidate)return;const valid=accept==='weapon'?!!candidate.weapon:!!candidate.armor&&(ARMORS[candidate.armor].slot==='head'?'head':'torso')===accept;if(valid&&p[key]!==candidate.id)onEquip(candidate);}catch{}});armorSlots.append(b);
 }detail.append(armorSlots);
 const actionsHost=document.createElement('div');actionsHost.className='inventory-selection-actions';detail.append(actionsHost);
 const renderDetail=()=>{actionsHost.replaceChildren();if(!selected){const help=document.createElement('p');help.textContent='Hover for stats. Drag gear onto an equipment slot, or double-click to equip.';actionsHost.append(help);return;}
  const label=document.createElement('strong');label.textContent=itemName(selected);actionsHost.append(label);const actions=document.createElement('div');actions.className='inventory-actions';const action=(label,callback)=>{const b=document.createElement('button');b.className='secondary-button';b.textContent=label;b.addEventListener('click',()=>{hideTip();callback();});actions.append(b);};
  if(!selection.stored)action(selected.armor?([p.armorItem,p.helmetItem].includes(selected.id)?'Unequip':'Wear'):'Hold item',()=>onEquip(selected));
  if(storage&&!selected.bound)action(selection.stored?'Take':'Store',()=>onTransfer(selected.id,!selection.stored));
  if(!selection.stored&&!selected.bound)action('Drop item',()=>onDrop(selected.id));if(canTrade&&!selected.bound)action('Sell · '+salvageValue(selected)+' coins',()=>onSell(selected.id,selection.stored));actionsHost.append(actions);
 };renderDetail();
 function placeTip(event,button){if(!tooltip||tooltip.hidden)return;const bounds=button.getBoundingClientRect(),x=event?.clientX??bounds.left+bounds.width/2,y=event?.clientY??bounds.top,w=tooltip.offsetWidth||280,h=tooltip.offsetHeight||160,viewW=globalThis.innerWidth??1200,viewH=globalThis.innerHeight??800;let left=x+17,top=y-h-14;if(left+w>viewW-12)left=x-w-17;if(top<12)top=y+21;tooltip.style.left=Math.max(12,Math.min(viewW-w-12,left))+'px';tooltip.style.top=Math.max(12,Math.min(viewH-h-12,top))+'px';}
 function showTip(item,event,button){if(!tooltip)return;const rarity=RARITIES[item.rarity],kind=itemKind(item);tooltip.style.setProperty('--rarity',rarity.color);tooltip.innerHTML='<strong style="color:'+rarity.color+'">'+itemName(item)+'</strong><small>'+rarity.name+(item.bound?' · Starter kit':'')+'</small>'+(kind==='weapon'?'<p>'+weaponStats(item).damage.toLocaleString()+' damage · '+weaponStats(item).reach.toFixed(2)+'m reach</p>'+details(weaponStats(item)):kind==='armor'?'<p>'+Math.round(ARMORS[item.armor].reduction*100)+'% damage reduction</p>':kind==='potion'?'<p>'+POTIONS[item.potion].description+'</p>':kind==='bow'?'<p>Hold to draw. Release to shoot.</p>':'<p>Hold to charge an inward electric pull.</p>');tooltip.hidden=false;button.setAttribute('aria-describedby','inventory-item-tooltip');placeTip(event,button);}

 layout.append(detail);root.append(layout);tooltip=document.createElement('div');tooltip.id='inventory-item-tooltip';tooltip.className='inventory-hover-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');(document.body??layout).append(tooltip);
 const note=document.createElement('p');note.className='inventory-rule';note.textContent=storage?'Drag to rearrange · Shift-click to transfer · I closes. Stored items survive death.':'20 slots, including your hotbar. Drag to rearrange · 1–9 moves the selected item · G drops · I closes.';root.append(note);
 return{destroy(){hideTip();document.removeEventListener?.('scroll',hideTip,true);tooltip?.remove();hidePreview?.();},select(id,stored){selection=id?{id,stored}:null;selected=(stored?p.vault:p.inventory).find(i=>i.id===id);for(const slot of slots){const active=!!selected&&slot.item?.id===selected.id&&slot.stored===stored;slot.button.classList.toggle('selected',active);slot.button.setAttribute('aria-pressed',String(active));}renderDetail();}};
}
