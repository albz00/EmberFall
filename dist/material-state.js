// Store numbers: THREE.Material.clone serializes userData through JSON.
// Color.copy cannot restore that serialized number (it produces invalid RGB).
function restoreColor(color,value){
 if(!color||value==null)return;
 if(typeof value==='number'&&Number.isFinite(value))color.setHex(value);
 else if(Array.isArray(value)&&value.length>=3)color.fromArray(value);
 else if(Number.isFinite(value.r)&&Number.isFinite(value.g)&&Number.isFinite(value.b))color.setRGB(value.r,value.g,value.b);
}
export function rememberMaterial(material){
 material.userData.baseColor=material.color?.getHex();
 material.userData.baseEmissive=material.emissive?.getHex();
 material.userData.baseIntensity=material.emissiveIntensity??0;
 return material;
}
export function restoreMaterial(material){
 const data=material.userData;
 if(data.baseColor==null&&material.color)rememberMaterial(material);
 restoreColor(material.color,data.baseColor);restoreColor(material.emissive,data.baseEmissive);
 if(material.emissive)material.emissiveIntensity=data.baseIntensity??0;
}
