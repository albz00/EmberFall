// A flat, deterministic lunar texture: mineral detail, soft pearlescent light and a quiet corona.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
function hash(x,y){let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
function fbm(x,y){let total=0,weight=.56;for(let i=0;i<5;i++){total+=noise(x,y)*weight;const xx=x;x=y*1.63+xx*.73+17.2;y=y*.73-xx*1.63+8.4;weight*=.47;}return total;}
const moonCache=new Map();
export function enchantedMoonPixels(size=768){if(!moonCache.has(size))moonCache.set(size,moonPixels(size));return moonCache.get(size);}
function moonPixels(size){
 const data=new Uint8Array(size*size*4),radius=size*.286,center=size*.5,craters=[];
 for(let i=0;i<46;i++){const angle=hash(i,17)*Math.PI*2,r=Math.sqrt(hash(i,63))*.9;craters.push({x:Math.cos(angle)*r,y:Math.sin(angle)*r,r:.012+Math.pow(hash(i,37),2)*.079,depth:.05+hash(i,84)*.08});}
 const stars=[[-1.3,-.4,.038],[1.34,.2,.025],[.8,-1.23,.021],[-.56,1.24,.016]];
 for(let py=0;py<size;py++)for(let px=0;px<size;px++){
  const x=(px-center)/radius,y=(py-center)/radius,r=Math.hypot(x,y),i=(py*size+px)*4;let red=139,green=128,blue=216,alpha=0;
  if(r<=1.003){
   const z=Math.sqrt(Math.max(0,1-r*r)),light=clamp(-x*.36-y*.29+z*.88),large=fbm(x*3.9+37,y*3.9-12),detail=fbm(x*25+81,y*25+24),fine=noise(x*137+301,y*137+404);
   const mare=clamp((large-.37)*4),mineral=.68+mare*.28+(detail-.46)*.23+(fine-.5)*.065;
   let crater=0;for(const c of craters){const dx=x-c.x,dy=y-c.y,d=Math.hypot(dx,dy)/c.r;if(d<1.38){const rim=Math.exp(-Math.pow((d-.91)*8,2)),basin=(1-clamp(d))*c.depth;crater+=rim*c.depth*.44-basin+(d<1?(-dx*.36-dy*.29)/c.r*c.depth*.5:0);}}
   const illuminated=.37+.64*Math.pow(light,.7),shade=clamp((illuminated-.35)/.66),texture=mineral+crater;
   red=mix(117,255,shade)*texture;green=mix(115,239,shade)*texture;blue=mix(163,220,shade)*texture;
   const rim=Math.pow(clamp(r),20)*.06;red+=rim*120;green+=rim*100;blue+=rim*190;alpha=clamp((1.003-r)*radius);
  }else{
   const edge=r-1,corona=Math.exp(-edge*8)*.19+Math.exp(-edge*2.5)*.024;
   const filament=(noise(x*4+21,y*4+2)-.3)*.04*Math.exp(-edge*3);alpha=corona+Math.max(0,filament);
   const a=Math.atan2(y,x),arc=Math.exp(-Math.pow((r-1.19)*radius/0.62,2))*.24*((a>-.95&&a<.3)||(a>2.2&&a<2.9)?1:0);
   alpha+=arc;if(arc>.025){red=212;green=198;blue=242;}
   for(const [sx,sy,s]of stars){const dx=Math.abs(x-sx),dy=Math.abs(y-sy),star=Math.exp(-(dx*dx+dy*dy)/(s*s*.24))*.8+Math.exp(-dx/s*17-dy/s*.65)*.28+Math.exp(-dy/s*17-dx/s*.65)*.28;if(star>alpha){alpha=star;red=239;green=229;blue=255;}}
   alpha*=clamp((1.71-r)*12);
  }
  data[i]=clamp(red,0,255);data[i+1]=clamp(green,0,255);data[i+2]=clamp(blue,0,255);data[i+3]=clamp(alpha)*255;
 }
 return{data,width:size,height:size};
}
