// Declarative validation for JSON content. Pure: no DOM, network or filesystem
// access, so browsers, tests, tools and a future server share one implementation.
// Field metadata (unit, description) is kept for future editor forms.

export class ConfigError extends Error{
 constructor(issues){super('Emberfall config is invalid:\n'+issues.map(i=>'  - '+i).join('\n'));this.name='ConfigError';this.issues=issues;}
}
export const ID=/^[a-z][a-z0-9-]*$/;
const HEX=/^#[0-9a-f]{6}$/;

export const number=(o={})=>({type:'number',...o});
export const integer=(o={})=>({type:'number',integer:true,...o});
export const string=(o={})=>({type:'string',...o});
export const boolean=(o={})=>({type:'boolean',...o});
export const oneOf=(values,o={})=>({type:'enum',values,...o});
export const hexColor=(o={})=>({type:'hex',...o});
export const cssColor=(o={})=>({type:'css',...o});
export const asset=(o={})=>({type:'string',pattern:/^[\w-]+\.glb$/,patternLabel:'a .glb file name',...o});
export const literal=value=>({type:'literal',value});
export const optional=node=>({...node,optional:true});
export const nullable=node=>({...node,nullable:true});
export const array=(item,o={})=>({type:'array',item,...o});
export const object=(fields,o={})=>({type:'object',fields,...o});
export const record=(value,o={})=>({type:'record',value,...o});
export const variant=(key,options,o={})=>({type:'variant',key,options,...o});
export const ref=(target,o={})=>({type:'ref',target,...o});

const show=v=>typeof v==='string'?JSON.stringify(v):Array.isArray(v)?'an array':v===null?'null':typeof v==='object'?'an object':String(v);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const join=(path,key)=>path?path+'.'+key:key;
const where=(ctx,path)=>(ctx.file?ctx.file+' → ':'')+(path||'(root)');

export function parse(node,value,path,ctx){
 const issue=message=>{ctx.issues.push(`${where(ctx,path)}: ${message}`);return undefined;};
 if(value===undefined)return node.optional?undefined:issue('is required');
 if(value===null)return node.nullable?null:issue('must not be null');
 switch(node.type){
  case 'number':{
   if(typeof value!=='number'||!Number.isFinite(value))return issue(`must be a finite number, got ${show(value)}`);
   if(node.integer&&!Number.isInteger(value))return issue(`must be a whole number, got ${value}`);
   const unit=node.unit?' '+node.unit:'';
   if(node.min!==undefined&&value<node.min)return issue(`must be at least ${node.min}${unit}, got ${value}`);
   if(node.max!==undefined&&value>node.max)return issue(`must be at most ${node.max}${unit}, got ${value}`);
   if(node.above!==undefined&&value<=node.above)return issue(`must be greater than ${node.above}${unit}, got ${value}`);
   return value;
  }
  case 'string':
   if(typeof value!=='string')return issue(`must be text, got ${show(value)}`);
   if(!node.empty&&!value.trim())return issue('must not be empty');
   if(node.maxLength&&value.length>node.maxLength)return issue(`must be at most ${node.maxLength} characters`);
   if(node.pattern&&!node.pattern.test(value))return issue(`must be ${node.patternLabel??'formatted as '+node.pattern}, got ${show(value)}`);
   return value;
  case 'boolean':return typeof value==='boolean'?value:issue(`must be true or false, got ${show(value)}`);
  case 'enum':return node.values.includes(value)?value:issue(`must be one of ${node.values.map(show).join(', ')}, got ${show(value)}`);
  case 'literal':return value===node.value?value:issue(`must be ${show(node.value)}, got ${show(value)}`);
  case 'hex':return typeof value==='string'&&HEX.test(value)?parseInt(value.slice(1),16):issue(`must be a #rrggbb color, got ${show(value)}`);
  case 'css':return typeof value==='string'&&HEX.test(value)?value:issue(`must be a #rrggbb color, got ${show(value)}`);
  case 'ref':
   if(typeof value!=='string')return issue(`must be an id from ${node.target}, got ${show(value)}`);
   ctx.refs.push({path:where(ctx,path),id:value,target:node.target});return value;
  case 'array':{
   if(!Array.isArray(value))return issue(`must be a list, got ${show(value)}`);
   if(node.min!==undefined&&value.length<node.min)return issue(`must have at least ${node.min} entries`);
   if(node.max!==undefined&&value.length>node.max)return issue(`must have at most ${node.max} entries`);
   if(node.length!==undefined&&value.length!==node.length)return issue(`must have exactly ${node.length} entries`);
   const out=value.map((v,i)=>parse(node.item,v,`${path}[${i}]`,ctx));
   if(node.unique){const seen=new Set();value.forEach((v,i)=>{const key=node.unique===true?v:v?.[node.unique];if(seen.has(key))ctx.issues.push(`${where(ctx,path+'['+i+']')}: duplicates ${show(key)}`);seen.add(key);});}
   return out;
  }
  case 'object':{
   if(!plain(value))return issue(`must be an object, got ${show(value)}`);
   const out={};
   for(const key of Object.keys(value)){
    if(!Object.hasOwn(node.fields,key)){issue(`unknown field ${show(key)}`);continue;}
    const parsed=parse(node.fields[key],value[key],join(path,key),ctx);if(parsed!==undefined)out[key]=parsed;
   }
   for(const [key,field]of Object.entries(node.fields))if(!Object.hasOwn(value,key))parse(field,undefined,join(path,key),ctx);
   return out;
  }
  case 'record':{
   if(!plain(value))return issue(`must be an object keyed by id, got ${show(value)}`);
   const keys=Object.keys(value);
   if(node.min!==undefined&&keys.length<node.min)return issue(`must define at least ${node.min} entries`);
   for(const id of node.required??[])if(!keys.includes(id))issue(`must define ${show(id)}`);
   const out={};
   for(const key of keys){if(!ID.test(key)){issue(`id ${show(key)} must be lowercase letters, digits and dashes`);continue;}out[key]=parse(node.value,value[key],join(path,key),ctx);}
   return out;
  }
  case 'variant':{
   if(!plain(value))return issue(`must be an object, got ${show(value)}`);
   const option=node.options[value[node.key]];
   if(!option)return issue(`${node.key} must be one of ${Object.keys(node.options).map(show).join(', ')}, got ${show(value[node.key])}`);
   return parse(object({[node.key]:literal(value[node.key]),...option.fields}),value,path,ctx);
  }
  default:throw new Error('Unknown schema node '+node.type);
 }
}

export function resolveRefs(ctx,collections){
 for(const {path,id,target}of ctx.refs){const ids=collections[target];if(!ids)ctx.issues.push(`${path}: unknown reference target ${target}`);else if(!ids.includes(id))ctx.issues.push(`${path}: ${show(id)} is not a defined ${target} id`);}
}
export function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))deepFreeze(v);}return value;}
export function contentHash(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
