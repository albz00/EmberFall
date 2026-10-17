import {CARRY_SLOTS,HOTBAR_SLOTS,VAULT_STEP,CHEST_PRICE,RARITIES,ARMORS,POTIONS,itemKind,itemName,itemArtKey,weaponStats,salvageValue,storagePrice} from './progression.js?v=60';
const icon=id=>`<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
export function slotArt(item,thumbs){
 if(!item)return '';
 const key=itemArtKey(item),fallback=item.orb?'orb':item.weapon?'sword':item.armor?'armor':item.potion?'potion':'bow';
 return (thumbs[key]?`<img src="${thumbs[key]}" alt="" draggable="false">`:icon(fallback))+(item.potion?`<b>${item.count}</b>`:'');
}
export function renderInventoryPanel({root,profile:p,thumbs,storage=false,canTrade=false,selection,onSelect,onEquip,onTransfer,onSell,onExpand,onMove,onDrop,onRoll,details}){
 let selected=(selection?.stored?p.vault:p.inventory).find(i=>i.id===selection?.id);const slots=[],layout=document.createElement('div');layout.className='inventory-layout'+(storage?' with-storage':'');
 const slot=(index,stored)=>{
  const id=(stored?p.vaultSlots:p.carrySlots)[index],item=(stored?p.vault:p.inventory).find(i=>i.id===id),b=document.createElement('button');
  b.className='inventory-slot'+(item?' occupied':'')+(selected===item&&item?' selected':'')+(!stored&&index===p.selectedHotbar?' held':'');b.dataset.slot=String(index);b.dataset.container=stored?'vault':'carry';
  if(item){b.dataset.itemId=item.id;b.style.setProperty('--rarity',RARITIES[item.rarity].color);b.innerHTML=slotArt(item,thumbs);b.draggable=true;b.title=itemName(item)+' · '+RARITIES[item.rarity].name+(item.bound?' · Starter kit':'');
   if([p.armorItem,p.helmetItem].includes(item.id)){const mark=document.createElement('span');mark.className='slot-equipped';mark.textContent='✓';b.append(mark);}
   b.addEventListener('dragstart',e=>{e.dataTransfer.setData('application/x-emberfall-item',JSON.stringify({id:item.id,stored}));e.dataTransfer.effectAllowed='move';b.classList.add('dragging');});
   b.addEventListener('dragend',()=>b.classList.remove('dragging'));
  }else b.title='Empty '+(stored?'chest':index<HOTBAR_SLOTS?'hotbar':'backpack')+' slot';
  b.setAttribute('aria-label',b.title+' '+(index+1));b.setAttribute('aria-pressed',String(item===selected&&!!item));
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
 const detail=document.createElement('aside');detail.className='inventory-detail';
 const renderDetail=()=>{detail.replaceChildren();
 if(selected){const kind=itemKind(selected),rarity=RARITIES[selected.rarity],active=[p.armorItem,p.helmetItem].includes(selected.id);
  detail.innerHTML=`<div class="inventory-item-art">${slotArt(selected,thumbs)}</div><strong>${itemName(selected)}</strong><span class="inventory-rarity" style="color:${rarity.color}">${rarity.name}${selected.bound?' · Starter kit':''}</span>${kind==='orb'?'<p>Hold left click with Ascension equipped to charge an inward electric pull.</p>':kind==='weapon'?`<p>${weaponStats(selected).damage.toLocaleString()} damage · ${weaponStats(selected).reach.toFixed(2)}m reach</p>${details(weaponStats(selected))}`:kind==='armor'?`<p>${Math.round(ARMORS[selected.armor].reduction*100)}% damage reduction</p>`:kind==='potion'?`<p>${POTIONS[selected.potion].description}</p>`:'<p>Hold left click to draw. Release to shoot.</p>'}`;
  const actions=document.createElement('div');actions.className='inventory-actions';const action=(label,callback)=>{const b=document.createElement('button');b.className='secondary-button';b.textContent=label;b.addEventListener('click',callback);actions.append(b);};
  if(!selection.stored)action(kind==='armor'?(active?'Unequip':'Wear'):'Hold item',()=>onEquip(selected));
  if(storage&&!selected.bound)action(selection.stored?'Take':'Store',()=>onTransfer(selected.id,!selection.stored));
  if(!selection.stored&&!selected.bound)action('Drop item',()=>onDrop(selected.id));
  if(canTrade&&!selected.bound)action('Sell · '+salvageValue(selected)+' coins',()=>onSell(selected.id,selection.stored));detail.append(actions);
 }else detail.innerHTML='<div class="inventory-empty-art">'+icon(storage?'crate':'bag')+'</div><p>Drag items to move or swap them. Click an item to inspect it.</p>';};renderDetail();
 layout.append(detail);root.append(layout);
 const note=document.createElement('p');note.className='inventory-rule';note.textContent=storage?'Drag to rearrange · Shift-click to transfer · I closes. Stored items survive death.':'20 slots, including your hotbar. Drag to rearrange · 1–9 moves the selected item · G drops · I closes.';root.append(note);
 return{select(id,stored){selection=id?{id,stored}:null;selected=(stored?p.vault:p.inventory).find(i=>i.id===id);for(const slot of slots){const active=!!selected&&slot.item?.id===selected.id&&slot.stored===stored;slot.button.classList.toggle('selected',active);slot.button.setAttribute('aria-pressed',String(active));}renderDetail();}};
}
