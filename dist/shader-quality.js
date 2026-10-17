import * as THREE from './vendor/three.module.js';
import {CONFIG} from './shared/config.js?v=69';
// HDR glow is extracted and blurred on its own. Scene color stays sharp; no history,
// velocity buffer, temporal accumulation, depth-of-field or motion blur is used.
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const settings=CONFIG.combat.presentation.shaders;
const material=(fragment,uniforms)=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,depthTest:false,depthWrite:false,toneMapped:false});
export class AdvancedShaders{
 constructor(renderer){this.renderer=renderer;this.enabled=false;this.width=0;this.height=0;this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.quad.frustumCulled=false;this.scene.add(this.quad);this.targets=[];
  this.bright=material(`varying vec2 vUv;uniform sampler2D source;uniform float threshold;void main(){vec3 c=texture2D(source,vUv).rgb;float light=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(threshold,threshold+.65,light),1.);}`,{source:{value:null},threshold:{value:settings.bloomThreshold}});
  this.blur=material(`varying vec2 vUv;uniform sampler2D source;uniform vec2 direction;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+direction*1.384615).rgb+texture2D(source,vUv-direction*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+direction*3.230769).rgb+texture2D(source,vUv-direction*3.230769).rgb)*.070270;gl_FragColor=vec4(c,1.);}`,{source:{value:null},direction:{value:new THREE.Vector2()}});
  this.compose=material(`varying vec2 vUv;uniform sampler2D source;uniform sampler2D glow;uniform float strength;uniform float exposure;
   vec3 film(vec3 c){return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
   void main(){vec3 base=texture2D(source,vUv).rgb,bloom=texture2D(glow,vUv).rgb;vec3 c=film((base+bloom*strength)*exposure);float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,1.065);c*=vec3(1.015,.985,1.02);vec2 p=(vUv-.5)*2.;c*=1.-dot(p,p)*.035;gl_FragColor=vec4(max(c,0.),1.);
   #include <colorspace_fragment>
  }`,{source:{value:null},glow:{value:null},strength:{value:settings.bloomStrength},exposure:{value:settings.exposure}});
 }
 setEnabled(enabled){this.enabled=enabled;if(!enabled)this.releaseTargets();}
 releaseTargets(){for(const target of this.targets)target.dispose();this.targets=[];this.width=this.height=0;}
 resize(width,height,pixelRatio=1){if(!this.enabled)return;const w=Math.max(1,Math.floor(width*pixelRatio)),h=Math.max(1,Math.floor(height*pixelRatio));if(w===this.width&&h===this.height)return;this.releaseTargets();this.width=w;this.height=h;const hdr=this.renderer.extensions?.has('EXT_color_buffer_float')!==false;this.bright.uniforms.threshold.value=hdr?settings.bloomThreshold:Math.min(.75,settings.bloomThreshold);const options={type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false};this.color=new THREE.WebGLRenderTarget(w,h,{...options,depthBuffer:true});this.color.samples=Math.min(4,this.renderer.capabilities?.maxSamples??0);this.glowA=new THREE.WebGLRenderTarget(Math.max(1,w>>1),Math.max(1,h>>1),options);this.glowB=this.glowA.clone();this.targets=[this.color,this.glowA,this.glowB];}
 begin(width,height,pixelRatio){if(!this.enabled)return false;this.resize(width,height,pixelRatio);this.oldToneMapping=this.renderer.toneMapping;this.oldTarget=this.renderer.getRenderTarget();this.renderer.toneMapping=THREE.NoToneMapping;this.renderer.setRenderTarget(this.color);return true;}
 pass(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);}
 finish(){const r=this.renderer,auto=r.autoClear;r.autoClear=true;
  this.bright.uniforms.source.value=this.color.texture;this.pass(this.bright,this.glowA);
  this.blur.uniforms.source.value=this.glowA.texture;this.blur.uniforms.direction.value.set(1/this.glowA.width,0);this.pass(this.blur,this.glowB);
  this.blur.uniforms.source.value=this.glowB.texture;this.blur.uniforms.direction.value.set(0,1/this.glowA.height);this.pass(this.blur,this.glowA);
  this.compose.uniforms.source.value=this.color.texture;this.compose.uniforms.glow.value=this.glowA.texture;r.toneMapping=this.oldToneMapping;this.pass(this.compose,this.oldTarget);r.autoClear=auto;
 }
 async warmup(){if(!this.enabled)return;const saved=this.quad.material;for(const m of [this.bright,this.blur,this.compose]){this.quad.material=m;if(this.renderer.compileAsync)await this.renderer.compileAsync(this.scene,this.camera);}this.quad.material=saved;}
 dispose(){this.releaseTargets();this.quad.geometry.dispose();for(const m of [this.bright,this.blur,this.compose])m.dispose();}
}
