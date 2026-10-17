// Prepare off-screen material variants and shared textures before enabling Play.
// compile traverses every mesh rather than only the current camera frustum.
export async function warmRenderer(renderer,views,extraRoots=[]){
 const textures=new Set();
 for(const root of [...views.map(([scene])=>scene),...extraRoots])root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
 let batch=0;for(const texture of textures){renderer.initTexture?.(texture);if(++batch%8===0)await new Promise(resolve=>setTimeout(resolve,0));}
 for(const [scene,camera]of views){if(renderer.compileAsync)await renderer.compileAsync(scene,camera);else renderer.compile?.(scene,camera);}
 return{textures:textures.size,views:views.length};
}
