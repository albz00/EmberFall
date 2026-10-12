const CANDIDATES='.modal,#score-scroll,#chat-log,.shop-tabs,.inventory-grid';

function scrolling(el,axis){
 const style=getComputedStyle(el),value=axis==='y'?style.overflowY:style.overflowX;
 if(value!=='auto'&&value!=='scroll')return false;
 if(!el.isConnected||el.closest('.hidden'))return false;
 const box=el.getBoundingClientRect();
 if(box.width<2||box.height<2)return false;
 return axis==='y'?el.scrollHeight>el.clientHeight+2:el.scrollWidth>el.clientWidth+2;
}
function trackBox(el,axis){
 const box=el.getBoundingClientRect(),modal=el.classList.contains('modal');
 if(axis==='y'){
  const top=modal?(el.querySelector('.modal-close')?46:16):6,bottom=modal?16:6,right=modal?12:6;
  return {left:box.right-right-8,top:box.top+top,width:8,height:Math.max(0,box.height-top-bottom)};
 }
 const left=10,right=modal?18:10,bottom=el.classList.contains('shop-tabs')?3:8;
 return {left:box.left+left,top:box.bottom-bottom-8,width:Math.max(0,box.width-left-right),height:8};
}
function place(el,track,thumb,axis){
 const box=trackBox(el,axis);
 track.style.left=box.left+'px';track.style.top=box.top+'px';track.style.width=box.width+'px';track.style.height=box.height+'px';
 const scroll=axis==='y'?el.scrollTop:el.scrollLeft,size=axis==='y'?el.scrollHeight:el.scrollWidth,view=axis==='y'?el.clientHeight:el.clientWidth;
 const span=axis==='y'?box.height:box.width,thumbLen=Math.max(22,Math.min(span,span*view/Math.max(size,1))),max=Math.max(0,size-view);
 const pos=max<=0?0:scroll/max*(span-thumbLen);
 track._travel=Math.max(1,span-thumbLen);
 if(axis==='y'){thumb.style.top=pos+'px';thumb.style.height=thumbLen+'px';thumb.style.left='1px';thumb.style.right='1px';thumb.style.width='auto';}
 else{thumb.style.left=pos+'px';thumb.style.width=thumbLen+'px';thumb.style.top='1px';thumb.style.bottom='1px';thumb.style.height='auto';}
}
function show(node,value){if(node.hidden!==value)node.hidden=value;}
function wire(el,track,thumb,axis){
 const key=axis==='y'?'scrollTop':'scrollLeft',extent=()=>axis==='y'?el.scrollHeight-el.clientHeight:el.scrollWidth-el.clientWidth;
 thumb.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  try{thumb.setPointerCapture(e.pointerId);}catch{}
  const start=axis==='y'?e.clientY:e.clientX,origin=el[key],travel=track._travel||1,max=extent();
  const move=ev=>{if(ev.pointerId===e.pointerId)el[key]=origin+((axis==='y'?ev.clientY:ev.clientX)-start)*max/travel;};
  const end=ev=>{if(ev.pointerId!==e.pointerId)return;thumb.removeEventListener('pointermove',move);thumb.removeEventListener('pointerup',end);thumb.removeEventListener('pointercancel',end);};
  thumb.addEventListener('pointermove',move);thumb.addEventListener('pointerup',end);thumb.addEventListener('pointercancel',end);
 });
 track.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target===thumb)return;
  e.preventDefault();e.stopPropagation();
  const rect=track.getBoundingClientRect(),click=axis==='y'?e.clientY-rect.top:e.clientX-rect.left,thumbAt=axis==='y'?thumb.offsetTop:thumb.offsetLeft;
  const page=axis==='y'?el.clientHeight:el.clientWidth;
  el[key]+=click<thumbAt?-page:page;
 });
 track.addEventListener('wheel',e=>{el[key]+=axis==='y'?e.deltaY:e.deltaX||e.deltaY;e.preventDefault();},{passive:false});
}
function layout(el){
 const tracks=el._emberTracks;
 for(const axis of['y','x']){
  const active=scrolling(el,axis);
  show(tracks[axis],!active);
  if(active)place(el,tracks[axis],tracks[axis+'Thumb'],axis);
 }
}

export function installScrollbars(){
 if(typeof MutationObserver!=='function'||!document.documentElement)return;
 const owned=new Set();
 let frame=0;
 const sync=()=>{
  frame=0;
  for(const el of [...owned])if(!el.isConnected){el._emberTracks.y.remove();el._emberTracks.x.remove();owned.delete(el);}
  for(const el of document.querySelectorAll(CANDIDATES)){
   if(el.dataset.emberScroll)continue;
   el.dataset.emberScroll='1';
   const tracks={};
   for(const axis of['y','x']){
    const track=document.createElement('div');track.className='ember-scroll-track '+axis;track.hidden=true;track.owner=el;
    const thumb=document.createElement('i');thumb.className='ember-scroll-thumb';track.append(thumb);document.body.append(track);
    wire(el,track,thumb,axis);tracks[axis]=track;tracks[axis+'Thumb']=thumb;
   }
   el._emberTracks=tracks;owned.add(el);el.addEventListener('scroll',schedule,{passive:true});
  }
  for(const el of owned)layout(el);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
 document.addEventListener('scroll',schedule,true);
 window.addEventListener('resize',schedule);
 new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
 schedule();
}
