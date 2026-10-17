import {SKILL_BRANCHES,SKILLS,skillAccess,skillBonuses,skillSummary} from './skills.js?v=68';
import {rankFor} from './leveling.js?v=68';
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const icons={sprint:'rogue',shield:'sentinel'};
export function createSkillTree(root,{profile,onBuy}){
 const tree=el('div','skill-tree'),summary=el('div','skill-tree-summary');summary.append(el('strong','','Level '+rankFor(profile.rating).level),el('span','',(profile.skills??[]).length+' / '+Object.keys(SKILLS).length+' learned'),el('span','',profile.coins.toLocaleString()+' coins'));tree.append(summary);
 const bonuses=el('div','skill-totals');for(const b of skillSummary(skillBonuses(profile)))bonuses.append(el('span','',b.label+' +'+b.percent+'%'));if(!bonuses.children.length)bonuses.append(el('span','','Choose a starting skill. Each branch builds on its previous node.'));tree.append(bonuses);
 const scroll=el('div','skill-tree-scroll'),branches=el('div','skill-branches');scroll.setAttribute('tabindex','0');scroll.setAttribute('aria-label','Skill tree branches');
 for(const branch of SKILL_BRANCHES){const column=el('section','skill-branch');column.style.setProperty('--branch-color',branch.color);const heading=el('h3','',branch.name);column.append(heading);
  for(const [index,node]of branch.nodes.entries()){
   const access=skillAccess(profile,node.id),owned=access.owned===true,prerequisite=node.requires.some(id=>!(profile.skills??[]).includes(id)),card=el('article','skill-node'+(owned?' learned':access.ok?' available':' locked')+(index===9?' capstone':''));card.dataset.skill=node.id;
   const mark=el('div','skill-node-icon');mark.innerHTML=`<svg aria-hidden="true"><use href="#i-${icons[branch.icon]??branch.icon}"/></svg>`;const title=el('strong','',node.name);card.append(mark,title,el('small','skill-level','Level '+node.level+' · '+node.price.toLocaleString()+' coins'));
   const values=el('p','skill-node-bonus');values.textContent=skillSummary(node.bonuses).map(b=>b.label+' +'+b.percent+'%').join(' · ');card.append(values);
   const button=el('button','secondary-button',owned?'Learned ✓':access.ok?'Learn · '+node.price.toLocaleString()+' coins':rankFor(profile.rating).level<node.level?'Level '+node.level+' required':prerequisite?'Learn '+SKILLS[node.requires[0]].name:node.price.toLocaleString()+' coins required');button.disabled=!access.ok;button.title=access.error??'Permanent passive skill';button.addEventListener('click',()=>onBuy(node.id));card.append(button);column.append(card);
  }branches.append(column);
 }
 scroll.append(branches);tree.append(scroll);root.append(tree);return tree;
}
