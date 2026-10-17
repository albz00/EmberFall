import {RANKS} from './progression.js?v=55';

// Shared vector primitives keep the HUD badges and world nameplates identical.
const polygon=(points,fill,stroke='#211928',width=1.4)=>({points,fill,stroke,width});
const circle=(x,y,r,fill,stroke='#211928',width=1.4)=>({circle:[x,y,r],fill,stroke,width});
const star=(n=5,r=13,inner=6,turn=-Math.PI/2)=>Array.from({length:n*2},(_,i)=>[32+Math.cos(turn+i*Math.PI/n)*(i%2?inner:r),30+Math.sin(turn+i*Math.PI/n)*(i%2?inner:r)]);
const diamond=[[32,15],[43,29],[32,43],[21,29]];
const sword=[[30,15],[34,15],[35,33],[40,35],[39,38],[34,37],[34,43],[30,43],[30,37],[25,38],[24,35],[29,33]];
const crown=[[20,22],[27,28],[32,17],[37,28],[44,22],[41,39],[23,39]];
const flame=[[32,14],[34,24],[40,21],[43,32],[38,42],[27,43],[21,34],[25,23],[27,30]];
const bolt=[[34,14],[22,32],[30,32],[27,46],[43,25],[34,25]];
const skull=[[24,20],[40,20],[45,28],[41,37],[37,37],[37,43],[27,43],[27,37],[23,37],[19,28]];
const bird=[[15,23],[26,27],[32,17],[38,27],[49,23],[42,35],[35,36],[32,45],[29,36],[22,35]];
const axes=[[20,17],[29,22],[26,28],[34,38],[36,42],[33,44],[30,41],[23,31],[17,30],[15,24]];
const mirror=points=>points.map(([x,y])=>[64-x,y]);
function emblem(index,c){
 const p=(points,fill=c)=>polygon(points,fill),white='#fff0cf',dark='#372537';
 switch(index){
  case 0:return[p([[21,23],[32,29],[43,23],[43,31],[32,39],[21,31]])];
  case 1:return[p([[21,19],[32,25],[43,19],[43,26],[32,32],[21,26]]),p([[21,31],[32,37],[43,31],[43,36],[32,43],[21,36]],white)];
  case 2:return[p(star())];
  case 3:return[p(bird),p(diamond,white)];
  case 4:return[p(diamond),p([[32,15],[32,43],[21,29]],white)];
  case 5:return[p(crown),circle(32,32,3,white)];
  case 6:return[p(crown),p([[23,43],[41,43],[38,47],[26,47]],white)];
  case 7:return[p(star(8,15,9)),circle(32,30,6,white)];
  case 8:return[p(axes),p(mirror(axes),white)];
  case 9:return[p(bird),p(sword,white)];
  case 10:return[p(sword),p([[19,20],[16,25],[18,38],[25,42],[24,36],[22,28]],white),p([[45,20],[48,25],[46,38],[39,42],[40,36],[42,28]],white)];
  case 11:return[p(crown),p([[23,39],[32,47],[41,39]],white)];
  case 12:return[p([[20,23],[26,18],[38,18],[44,23],[40,29],[24,29]]),p([[28,29],[36,29],[36,44],[28,44]],white)];
  case 13:return[p([[19,20],[29,20],[32,26],[35,20],[45,20],[43,38],[37,43],[35,30],[29,30],[27,43],[21,38]])];
  case 14:return[p([[19,17],[26,21],[25,39],[21,44]]),p([[29,15],[35,17],[34,41],[29,46]],white),p([[39,18],[46,20],[41,42],[37,40]])];
  case 15:return[p([[20,19],[38,18],[45,24],[40,32],[27,32],[25,37],[38,37],[42,42],[23,44],[18,37],[22,28],[37,28],[39,24],[24,24]])];
  case 16:return[p(flame),p([[32,29],[36,37],[32,43],[28,38]],white)];
  case 17:return[p(skull),p([[20,26],[14,15],[26,22]]),p([[44,26],[50,15],[38,22]]),circle(27,30,2,dark),circle(37,30,2,dark)];
  case 18:return[p(skull),p([[23,20],[20,13],[29,17],[32,11],[35,17],[44,13],[41,20]],white),circle(27,29,2,dark),circle(37,29,2,dark)];
  case 19:return[p([[32,15],[42,22],[42,38],[46,44],[36,40],[32,44],[28,40],[18,44],[22,38],[22,22]]),circle(28,29,2,dark),circle(36,29,2,dark)];
  case 20:return[p(bird),p(flame,white)];
  case 21:return[p([[17,30],[24,22],[40,38],[47,30],[40,22],[24,38]],'none'),circle(32,30,4,white)];
  case 22:return[p(star(4,18,5)),circle(32,30,4,white)];
  case 23:return[p([[35,15],[26,18],[21,26],[22,36],[31,43],[40,42],[34,38],[29,32],[29,25]],white),p(star(4,7,3).map(([x,y])=>[x+6,y-6]))];
  case 24:return[p(star(6,16,7)),p(star(6,8,4),white)];
  case 25:return[p(star(8,18,7)),p(bolt,white)];
  case 26:return[p([[16,30],[25,20],[39,20],[48,30],[39,40],[25,40]]),p(diamond,dark),circle(32,30,4,white)];
  case 27:return[circle(32,30,15,c),p([[34,15],[27,27],[35,31],[28,45],[40,31],[33,26]],dark)];
  case 28:return[p(bird),p(crown,white),circle(32,32,3,c)];
  case 29:return[p([[16,36],[26,26],[32,14],[38,26],[48,36],[39,34],[32,25],[25,34]]),p([[22,40],[32,33],[42,40],[32,47]],white)];
  default:return[p(star(8,18,10)),p(crown,white),p([[27,40],[32,45],[37,40]],white)];
 }
}
function primitives(rank){
 const index=rank.index??RANKS.findIndex(r=>r.name===rank.name),tier=Math.floor(index/6),c=rank.color;
 const layers=[];
 if(index>4)for(const side of[-1,1])for(let i=0;i<Math.min(4,1+tier);i++)layers.push(polygon([[32+side*19,22+i*5],[32+side*(27-i),17+i*7],[32+side*23,35+i*4],[32+side*17,39+i*3]],i%2?'#fff0cf':c));
 layers.push(polygon([[32,3],[52,12],[49,42],[32,60],[15,42],[12,12]],'#191827','#100f17',2.2));
 layers.push(polygon([[32,6],[49,14],[46,41],[32,55],[18,41],[15,14]],c));
 layers.push(polygon([[32,11],[44,17],[42,38],[32,48],[22,38],[20,17]],'#362b3e', '#fff0cf',.7));
 layers.push(...emblem(index,c));
 for(let i=0;i<Math.min(4,1+index%6);i++)layers.push(circle(32+(i-(Math.min(4,1+index%6)-1)/2)*5,51,1.3,'#fff0cf','none'));
 return layers;
}
export function rankIcon(rank){
 return `<svg class="rank-emblem" viewBox="0 0 64 64" aria-hidden="true">${primitives(rank).map(p=>p.circle?`<circle cx="${p.circle[0]}" cy="${p.circle[1]}" r="${p.circle[2]}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.width}"/>`:`<polygon points="${p.points.map(x=>x.join(',')).join(' ')}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.width}" stroke-linejoin="round"/>`).join('')}</svg>`;
}
export function drawRankIcon(ctx,rank,x,y,size){
 ctx.save();ctx.translate(x,y);ctx.scale(size/64,size/64);
 for(const p of primitives(rank)){
  ctx.beginPath();if(p.circle)ctx.arc(...p.circle,0,Math.PI*2);else{p.points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();}
  if(p.fill!=='none'){ctx.fillStyle=p.fill;ctx.fill();}if(p.stroke!=='none'){ctx.strokeStyle=p.stroke;ctx.lineWidth=p.width;ctx.lineJoin='round';ctx.stroke();}
 }ctx.restore();
}
