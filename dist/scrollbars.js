import {scrollTrackBox} from './panel-layout.js?v=59';
const CANDIDATES='.modal,#score-scroll,#chat-log,.shop-tabs,.inventory-grid';

function scrolling(el,axis){
 if(!el.isConnected||el.closest('.hidden'))return false;
 const style=getComputedStyle(el),value=axis==='y'?style.overflowY:style.overflowX;
 if(value!=='auto'&&value!=='scroll')return false;
 const box=el.getBoundingClientRect();
 if(box.width<2||box.height<2)return false;
 return axis==='y'?el.scrollHeight>el.clientHeight+2:el.scrollWidth>el.clientWidth+2;
}
function trackBox(el,axis){
 const box=el.getBoundingClientRect(),style=getComputedStyle(el);
 return scrollTrackBox(box,axis,style,{modal:el.classList.contains('modal'),close:!!el.querySelector('.modal-close'),scaleX:el.offsetWidth?box.width/el.offsetWidth:1,scaleY:el.offsetHeight?box.height/el.offsetHeight:1});
}
function place(el,track,thumb,axis){
 const box=trackBox(el,axis);
 track.style.left=box.left+'px';track.style.top=box.top+'px';track.style.width=box.width+'px';track.style.height=box.height+'px';
 const scroll=axis==='y'?el.scrollTop:el.scrollLeft,size=axis==='y'?el.scrollHeight:el.scrollWidth,view=axis==='y'?el.clientHeight:el.clientWidth;
 const span=axis==='y'?box.height:box.width,thumbLen=Math.min(span,Math.max(22,span*view/Math.max(size,1))),max=Math.max(0,size-view);
 const pos=max<=0?0:Math.max(0,Math.min(max,scroll))/max*(span-thumbLen);
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
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>schedule()):null;
 let frame=0,scanNeeded=true;
 const sync=()=>{
  frame=0;
  for(const el of [...owned])if(!el.isConnected){el._emberTracks.y.remove();el._emberTracks.x.remove();resize?.unobserve(el);owned.delete(el);}
  if(scanNeeded)for(const el of document.querySelectorAll(CANDIDATES)){
   if(el.dataset.emberScroll)continue;
   el.dataset.emberScroll='1';
   const tracks={};
   for(const axis of['y','x']){
    const track=document.createElement('div');track.className='ember-scroll-track '+axis;track.hidden=true;track.owner=el;
    const thumb=document.createElement('i');thumb.className='ember-scroll-thumb';track.append(thumb);document.body.append(track);
    wire(el,track,thumb,axis);tracks[axis]=track;tracks[axis+'Thumb']=thumb;
   }
   el._emberTracks=tracks;owned.add(el);resize?.observe(el);el.addEventListener('scroll',schedule,{passive:true});
  }
  scanNeeded=false;for(const el of owned)layout(el);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
 document.addEventListener('scroll',schedule,true);
 document.addEventListener('animationend',schedule,true);
 document.addEventListener('transitionend',schedule,true);
 document.fonts?.ready.then(schedule);
 window.addEventListener('resize',schedule);
 new MutationObserver(records=>{if(records.some(r=>r.type==='childList'))scanNeeded=true;schedule();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
 schedule();
}
