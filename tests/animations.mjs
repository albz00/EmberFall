import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as T from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {CHARACTERS} from '../dist/progression.js';
const require=createRequire(import.meta.url);
const {loadImage}=require('@napi-rs/canvas');globalThis.self=globalThis;globalThis.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
const loader=new GLTFLoader(),cache=new Map(),load=async file=>{if(cache.has(file))return cache.get(file);const b=await readFile(new URL('../dist/assets/'+file,import.meta.url));const result=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');cache.set(file,result);return result;};
const names=['Sword_Idle','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land','Sword_Attack','Hit_Chest'];
let poses=0;const warn=console.warn;console.warn=(...args)=>{if(String(args[0]).includes('PropertyBinding'))throw new Error(args.join(' '));warn(...args);};
try{
 for(const [id,character]of Object.entries(CHARACTERS)){
  const template=await load(character.file),asset=character.file.startsWith('fighter-')?'quaternius-fighter-animations.glb':'quaternius-'+character.file.replace('.glb','')+'-animations.glb',animations=(await load(asset)).animations,mixer=new T.AnimationMixer(template.scene);
  for(const name of names){
   const clip=animations.find(c=>c.name===name);assert(clip,id+' has '+name);
   for(const track of clip.tracks){const node=T.PropertyBinding.parseTrackName(track.name).nodeName;assert(template.scene.getObjectByName(node),id+': missing '+node);for(const n of track.values)assert(Number.isFinite(n));}
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
   for(const part of[0,.25,.5,.75]){
    mixer.setTime(clip.duration*part);template.scene.updateMatrixWorld(true);template.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    const bounds=new T.Box3().setFromObject(template.scene,true),size=bounds.getSize(new T.Vector3());
    assert(size.toArray().every(n=>Number.isFinite(n)&&n>0&&n<4),id+' '+name+': bounded skinned geometry');
    assert(bounds.min.y>-.35&&bounds.max.y<3,id+' '+name+': upright at ground');
    const root=template.scene.getObjectByName('Body').getWorldPosition(new T.Vector3());assert(Math.hypot(root.x,root.z)<.85,id+' '+name+': no locomotion drift');poses++;
   }
  }
  mixer.stopAllAction();mixer.uncacheRoot(template.scene);
 }
}finally{console.warn=warn;}
console.log(JSON.stringify({animations:'passed',characters:Object.keys(CHARACTERS).length,poses,bindings:true,finiteSkinning:true,groundedBounds:true,inPlace:true}));
