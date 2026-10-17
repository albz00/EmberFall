// Presentation only: no camera transform, combat state or motion-blur history.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const NONE=Object.freeze({kind:'none',x:0,y:0,intensity:0,progress:0});
const local=(v,yaw)=>({x:v.x*Math.cos(yaw)-v.z*Math.sin(yaw),y:v.x*Math.sin(yaw)+v.z*Math.cos(yaw)});
export function movementCue({player,yaw=0,time=0,sprinting=false,enabled=true,reduced=false,playing=true,chat=false,freecam=false,flying=false}){
 if(!enabled||reduced||!playing||chat||freecam||flying||player.health<=0||player.crouched||player.inLava)return NONE;
 if(time<(player.rollUntil??0)){const v=local(player.rollDirection??player.velocity,yaw),d=Math.hypot(v.x,v.y)||1,p=clamp((time-player.rollStarted)/Math.max(.001,player.rollUntil-player.rollStarted),0,1);return{kind:'roll',x:v.x/d,y:v.y/d,intensity:.5+.5*Math.sin(Math.PI*p),progress:p};}
 if(time<(player.stepUntil??0)){const v=local(player.stepDirection??player.velocity,yaw),d=Math.hypot(v.x,v.y)||1,p=clamp((time-player.stepStarted)/Math.max(.001,player.stepUntil-player.stepStarted),0,1);return{kind:'dodge',x:v.x/d,y:v.y/d,intensity:.5+.5*Math.sin(Math.PI*p),progress:p};}
 const v=local(player.velocity,yaw),speed=player.motionSpeed??Math.hypot(v.x,v.y),length=Math.hypot(v.x,v.y);if(speed<1.3||!player.grounded||length<.1)return NONE;
 if(sprinting)return{kind:'sprint',x:v.x/length,y:v.y/length,intensity:clamp(speed/7,.25,1),progress:0};
 if(Math.abs(v.x)>1.3&&Math.abs(v.x)>Math.abs(v.y)*.7)return{kind:'strafe',x:Math.sign(v.x),y:0,intensity:clamp(speed/6,.2,.75),progress:0};
 return NONE;
}
export class MovementStreaks{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext?.('2d',{alpha:true,desynchronized:true})??null;this.width=0;this.height=0;this.alpha=0;this.lastKind='none';this.lastCue=NONE;}
 clear(){if(this.width&&this.ctx)this.ctx.clearRect(0,0,this.width,this.height);this.alpha=0;this.lastKind='none';this.lastCue=NONE;this.canvas.style.opacity=0;}
 update(input,dt,width,height){
  const cue=movementCue(input);if(!this.ctx)return cue;if(cue.kind==='none'&&(!input.playing||input.chat||input.freecam||input.flying||input.reduced||!input.enabled||input.player.health<=0)){if(this.alpha)this.clear();return cue;}
  const target=cue.intensity;this.alpha+=(target-this.alpha)*(1-Math.exp(-(target>this.alpha?20:15)*Math.max(0,dt)));if(cue.kind!=='none'){this.lastCue=cue;this.lastKind=cue.kind;}
  if(this.alpha<.005){if(this.lastKind!=='none'||Number(this.canvas.style.opacity)>0)this.clear();return cue;}
  if(width!==this.width||height!==this.height){this.width=this.canvas.width=width;this.height=this.canvas.height=height;}
  const c=this.ctx;c.clearRect(0,0,width,height);this.canvas.style.opacity=1;const active=cue.kind==='none'?this.lastCue:cue,kind=active.kind,side=kind==='strafe'||kind==='dodge',count=kind==='sprint'?16:kind==='roll'?12:kind==='dodge'?10:7,t=input.time,color=kind==='roll'?'255,220,166':kind==='dodge'?'167,232,236':'238,235,223';
  c.lineCap='round';for(let i=0;i<count;i++){
   const seed=(i*.61803398875)%1,phase=(t*(kind==='sprint'?1.9:kind==='strafe'?1.5:3.2)+seed)%1;let x,y,ex,ey;
   if(side){const sign=Math.sign(active.x)||1;x=width*(sign<0?.18-phase*.2:.82+phase*.2);y=height*(.13+((i*.171)% .72));const length=width*(kind==='dodge'?.075:.045)*(1+seed*.5);ex=x+sign*length;ey=y+(kind==='dodge'?(i%2?1:-1)*height*.012:0);}
   else{const angle=i/count*Math.PI*2+.13*Math.sin(i*2.1),r=.82+phase*.32,cx=width*(.5-active.x*.11),cy=height*.49;x=cx+Math.cos(angle)*width*.53*r;y=cy+Math.sin(angle)*height*.56*r;const stretch=kind==='roll'?.16:.11;ex=cx+Math.cos(angle)*width*.53*(r+stretch);ey=cy+Math.sin(angle)*height*.56*(r+stretch);}
   const fade=Math.sin(Math.PI*phase),gradient=c.createLinearGradient(x,y,ex,ey);gradient.addColorStop(0,`rgba(${color},0)`);gradient.addColorStop(.7,`rgba(${color},${this.alpha*fade*(kind==='dodge'?.5:.34)})`);gradient.addColorStop(1,`rgba(${color},0)`);c.strokeStyle=gradient;c.lineWidth=kind==='dodge'?1.6:1.15;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();
  }
  if(kind==='roll'){c.strokeStyle=`rgba(255,218,163,${this.alpha*.24})`;c.lineWidth=1.4;for(const sign of [-1,1]){c.beginPath();c.ellipse(width*(sign<0?.03:.97),height*.78,width*.15,height*.29,sign*(.25+active.progress*.45),sign<0?-.9:Math.PI-.9,sign<0?.7:Math.PI+.7);c.stroke();}}
  return cue;
 }
}
