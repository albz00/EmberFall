// Local lofi playlist from Pixabay. Pixabay Content License; not a live stream.
export const LOFI_TRACKS=[
 {file:'./assets/music/lofi-gaming.mp3?v=32',title:'Lofi Gaming',artist:'ZephiraMusic',page:'https://pixabay.com/music/lofi-lofi-gaming-606302/'},
 {file:'./assets/music/tokyo-lofi.mp3?v=32',title:'Tokyo Lofi',artist:'ZephiraMusic',page:'https://pixabay.com/music/lofi-tokyo-lofi-604786/'},
 {file:'./assets/music/lofi-focus.mp3?v=32',title:'Lofi Focus',artist:'ZephiraMusic',page:'https://pixabay.com/music/lofi-lofi-focus-606303/'},
 {file:'./assets/music/lofi-chill.mp3?v=32',title:'Lofi Chill',artist:'ZephiraMusic',page:'https://pixabay.com/music/lofi-lofi-chill-612445/'},
 {file:'./assets/music/tribal-drumming.mp3?v=48',title:'Tribal Drumming Atmosphere',artist:'vjgalaxy',page:'https://pixabay.com/music/world-rpgs-tribal-drumming-atmosphere-608370/'},
 {file:'./assets/music/hand-drums.mp3?v=48',title:'Hand Drums',artist:'vjgalaxy',page:'https://pixabay.com/music/world-rpgs-hand-drums-tribal-background-music-608348/'},
 {file:'./assets/music/fighting-spirit.mp3?v=48',title:'Fighting Spirit',artist:'nojisuma',page:'https://pixabay.com/music/upbeat-fighting-spirit-12550/'}
];
export const DUEL_TRACKS=[
 {file:'./assets/music/feel-the-energy.mp3?v=48',title:'Feel The Energy',artist:'PinLabs',page:'https://pixabay.com/music/drum-n-bass-feel-the-energy-544801/'}
];
export const THEME_MUSIC=LOFI_TRACKS[0].file;
export class BackgroundMusic{
 constructor(source=LOFI_TRACKS,volume=.15,AudioClass=globalThis.Audio,onStatus=()=>{}){
  this.tracks=Array.isArray(source)?source:[{file:source,title:'Lofi',artist:''}];this.index=0;this.source=this.tracks[0].file;
  this.audio=new AudioClass(this.source);this.audio.loop=this.tracks.length<2;this.audio.preload='auto';this.volume=volume;this.audio.volume=volume;this.pending=false;this.error=null;this.status='idle';this.onStatus=onStatus;this.wanted=false;this.generation=0;this.duckUntil=0;
  this.audio.addEventListener?.('error',()=>{if(this.wanted){this.pending=false;this.error??=new Error('Music file unavailable');this.setStatus('unavailable');}});
  this.audio.addEventListener?.('playing',()=>{if(this.wanted){this.error=null;this.setStatus('playing');}});
  this.audio.addEventListener?.('ended',()=>this.advance());
 }
 label(){const track=this.tracks[this.index];return track.artist?`${track.title} · ${track.artist}`:track.title;}
 setStatus(value){this.status=value;this.onStatus(value);}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));this.update();}
 duck(seconds=.35){this.duckUntil=Math.max(this.duckUntil,Date.now()+seconds*1000);this.update();}
 update(){this.audio.volume=this.volume*(Date.now()<this.duckUntil?.65:1);}
 load(index){this.index=index%this.tracks.length;this.source=this.tracks[this.index].file;this.audio.src=this.source;this.audio.loop=this.tracks.length<2;this.audio.load?.();this.update();}
 async start(retry=false){
  if(retry){this.pending=false;this.generation++;this.error=null;this.load(this.index);}
  if(this.status==='unavailable'&&!retry)return false;
  this.wanted=true;if(!this.audio.paused&&!retry)return true;if(this.pending)return false;
  return this.play();
 }
 async advance(){
  if(!this.wanted||this.tracks.length<2)return false;
  this.generation++;this.error=null;this.load(this.index+1);return this.play();
 }
 use(tracks){
  if(this.tracks===tracks)return Promise.resolve(false);
  (this.place??=new Map()).set(this.tracks,this.index);const resume=this.wanted;this.tracks=tracks;this.generation++;this.pending=false;this.error=null;this.load(this.place.get(tracks)??0);
  if(!resume){this.audio.pause();if(this.status==='playing'||this.status==='connecting')this.setStatus('paused');return Promise.resolve(false);}
  return this.play();
 }
 async play(){
  const generation=++this.generation;this.pending=true;this.setStatus('connecting');
  try{await this.audio.play();if(generation!==this.generation)return false;this.pending=false;this.error=null;this.setStatus('playing');return true;}
  catch(error){if(generation!==this.generation)return false;this.pending=false;this.error=error;this.setStatus(error.name==='NotAllowedError'?'blocked':'unavailable');return false;}
 }
 pause(){this.wanted=false;this.generation++;this.pending=false;this.audio.pause();this.setStatus('paused');}
}
// Wind, nearby lava, and drips share an independently adjustable, duckable bus.
export class CaveAmbience{
 constructor(context,destination){
  this.context=context;this.volume=.35;this.duckUntil=0;this.bus=context.createGain();this.bus.gain.value=this.volume;this.bus.connect(destination);
  const buffer=context.createBuffer(1,context.sampleRate*6,context.sampleRate),data=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<data.length;i++){const white=Math.random()*2-1;brown=(brown+white*.045)/1.025;const fade=Math.min(1,i/(context.sampleRate*.03),(data.length-1-i)/(context.sampleRate*.03));data[i]=(white*.28+brown*2.7)*fade;}
  this.source=context.createBufferSource();this.source.buffer=buffer;this.source.loop=true;
  const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=470;const rumbleCut=context.createBiquadFilter();rumbleCut.type='highpass';rumbleCut.frequency.value=65;
  this.lava=context.createGain();this.lava.gain.value=0;this.source.connect(low);low.connect(rumbleCut);rumbleCut.connect(this.lava);this.lava.connect(this.bus);
  const airCut=context.createBiquadFilter();airCut.type='highpass';airCut.frequency.value=280;this.windFilter=context.createBiquadFilter();this.windFilter.type='bandpass';this.windFilter.frequency.value=850;this.windFilter.Q.value=.45;
  this.wind=context.createGain();this.wind.gain.value=.025;this.pan=context.createStereoPanner();this.source.connect(airCut);airCut.connect(this.windFilter);this.windFilter.connect(this.wind);this.wind.connect(this.pan);this.pan.connect(this.bus);
  this.source.start();this.nextDrip=context.currentTime+5;
 }
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));}
 duck(seconds=.65){this.duckUntil=Math.max(this.duckUntil,this.context.currentTime+seconds);}
 update(distance){
  const now=this.context.currentTime,gust=Math.pow(.5+.5*Math.sin(now*.19+Math.sin(now*.067)*1.8),2);
  this.bus.gain.setTargetAtTime(this.volume*(now<this.duckUntil?.28:1),now,now<this.duckUntil?.025:.7);
  this.lava.gain.setTargetAtTime(Math.pow(Math.max(0,1-distance/7),2)*.11,now,.3);
  this.wind.gain.setTargetAtTime(.018+gust*.045,now,.6);this.windFilter.frequency.setTargetAtTime(640+gust*690,now,.8);this.pan.pan.setTargetAtTime(Math.sin(now*.12)*.65,now,.5);
  if(now>this.nextDrip){this.nextDrip=now+5+Math.random()*8;const o=this.context.createOscillator(),g=this.context.createGain();o.frequency.setValueAtTime(1400+Math.random()*550,now);o.frequency.exponentialRampToValueAtTime(760,now+.07);g.gain.setValueAtTime(.02,now);g.gain.exponentialRampToValueAtTime(.0001,now+.2);o.connect(g);g.connect(this.bus);o.start();o.stop(now+.2);o.onended=()=>{o.disconnect();g.disconnect();};}
 }
}
