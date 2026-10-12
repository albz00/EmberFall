import {NAMEPLATES} from './progression.js?v=50';

// Both shop previews and chat use the same live CSS treatment. Names stay text.
export function nameplateNode(name,id='none'){
 const node=document.createElement('span');
 node.className='chat-name'+(id!=='none'&&Object.hasOwn(NAMEPLATES,id)?' nameplate nameplate-'+id:'');
 node.textContent=name;
 return node;
}
