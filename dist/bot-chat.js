import {weaponStats,equippedItem,ARMORS,CHEST_PRICE,rankFor,RANKS,LEVELS_PER_RANK,EFFECTS,COSMETICS} from './progression.js?v=64';

const VOICES=[
 ['Okay, ','Honestly, ','',''],['','Alright, ','',''],['','For me, ','',''],['','Yeah, ','',''],['','Fair. ','',''],['','Right, ','',''],['','Watch this. ','',''],['','My take: ','',''],['','Fine, ','',''],
];
export const CHAT_TOPICS={
 matches:/\b(2v2|duo|match|signup|sign up|teammate|team mate|blue team|red team)\b/,
 commands:/\b(admin|fly|flying|command|killall|targetme)\b/,
 cosmetics:/\b(cosmetic|effect shop|aura|colorful|colourful|glow|prism|starfall|bloodmoon|hexflame|outfit|skin)\b/,
 weapons:/\b(sword|staff|weapon|damage|reach|build|loadout|dagger|mace|gemblade)\b/,
 effects:/\b(bleed|fire|frost|burn|frozen|freeze|poison|venom|enchant|affix)\b/,
 chest:/\b(chest|loot|drop|rarity|legendary|forged|roll|lucky|luck|gambl\w*)\b/,
 economy:/\b(armor|armour|helmet|buy|shop|coin\w*|money|broke|poor|rich|saving)\b/,
 ranks:/\b(rank|rating|points|rp|leaderboard|bronze|silver|diamond|apex|badge|icon)\b/,
 health:/\b(health|hp|heal|potion|hurt|low|regen|tonic|survive|surviving)\b/,
 events:/\b(event|eruption|cave.?in|meteor|shelter|warning|hide|cover|storm)\b/,
 map:/\b(bridge|lava|pit|map|ledge|spawn|pumpkin|halloween|fog|red|flag|entrance)\b/,
 movement:/\b(jump|double jump|crouch|sprint|strafe|movement|dodge|roll|space|controls|camera|third person)\b/,
 combat:/\b(w-tap|wtap|sprint reset|combo|block|blocking|critical|crit|click|cps|aim|swing|parry|hit|knockback|tip|advice|practice)\b/,
 strategy:/\b(why|plan|strategy|doing|where|target|team|help|fight|come|scared|run|running|chase|camp|camping)\b/,
 identity:/\b(bot|ai|real|human|cheat|aimbot|smart|intelligen\w*)\b/,
 music:/\b(music|song|metal|trap|beat|beats|bass|radio|band|guitar|sound|loud|volume)\b/,
 streak:/\b(streak|bounty|unbeaten|unstoppable)\b/,
 rematch:/\b(rematch|again|1v1|duel|revenge|round two)\b/,
 compliment:/\b(gg|good game|good fight|nice|well played|good job|impressive|respect)\b/,
 banter:/\b(bad|easy|trash|suck|noob|loser|ez|rekt|terrible|weak|idiot|dumb|skill issue)\b/,
 laughter:/\b(lol|lmao|lmfao|haha|funny|bruh|wtf|hilarious)\b/,
 greeting:/\b(hi|hey|hello|yo|sup|morning|evening|whats up|what's up|how are you)\b/,
 thanks:/\b(thanks|thank you|thx|cheers|appreciate)\b/,
 apology:/\b(sorry|my bad|apolog\w*|oops|accident)\b/,
 farewell:/\b(bye|goodbye|later|gtg|goodnight|see you|leaving)\b/,
 opinion:/\b(favorite|favourite|prefer|best|worst|like|love|hate|think)\b/,
};
const FOLLOWUP=/^(?:why\??|how so\??|really\??|tell me more|more|and\??|go on|explain|what do you mean\??|what about you\??|yes|yeah|no|nah|ok|okay|sure)[.!? ]*$/;
function choose(bot,topic,lines,message=''){
 bot.chatMemory??=[];const recent=bot.chatMemory.slice(-40),fresh=lines.filter(s=>!recent.includes(s));
 const pool=fresh.length?fresh:lines.filter(s=>s!==recent.at(-1));
 let seed=(bot.id??0)*177+(bot.chatSequence??0)*97;for(const ch of message)seed=(seed*31+ch.charCodeAt(0))>>>0;
 const line=(pool.length?pool:lines)[seed%(pool.length||lines.length)];bot.chatSequence=(bot.chatSequence??0)+1;bot.chatMemory.push(line);if(bot.chatMemory.length>60)bot.chatMemory.shift();if(topic!=='ambient')bot.lastChatTopic=topic;
 return line;
}
export function describePlan(bot,context){
 if(!bot.alive)return`I’m respawning on the ledge. ${bot.lastDefeatBy?bot.lastDefeatBy+' got that one.':'I need a cleaner opening.'}`;
 if(bot.state==='shopping')return bot.purchase?.kind==='chest'?`I’m spending ${CHEST_PRICE} coins on a chest roll. I keep my current weapon if the drop is weaker.`:`I’m buying ${bot.purchase?.id?bot.purchase.id+' gear':'an upgrade'} before I drop back in.`;
 if(bot.returnAt)return`I’m trying to return with ${bot.account.coins} coins. Another hit cancels it.`;
 if(bot.plan==='cover')return'I’m finding room to recover.';
 if(context.hunt)return bot.stats.kind==='staff'?'I’m holding range while the others close your escape routes.':'I’m taking the '+(bot.id%2?'right':'left')+' flank while the others keep you busy.';
 if(bot.plan==='retreat')return`I’m at ${Math.ceil(bot.hp)} health. I need to break contact and heal.`;
 if(bot.plan==='loot')return'I’m going for the supply crate. I want the coins and health before the next fight.';
 if(bot.stats.kind==='staff')return`I’m keeping my ${bot.stats.name.toLowerCase()} outside sword range and leading the next shot.`;
 return bot.target?`I’m watching ${bot.target.name??context.playerName}. ${bot.role==='flanker'?'I want the side angle.':'I’m waiting for an opening.'}`:'I’m rotating toward the next fight.';
}
export function botReply(bot,message,context){
 const text=String(message).toLowerCase().replace(/[’]/g,"'"),s=weaponStats(equippedItem(bot.account)),coins=bot.account.coins;
 const name=context.playerName,rank=rankFor(bot.rating),effects=s.effects.map(e=>EFFECTS[e.type].name).join(' + ')||'no rolled effects';
 const plan=describePlan(bot,context),health=Math.max(0,Math.ceil(bot.hp)),potions=bot.account.potions.healing,armor=ARMORS[bot.armor]?.name??'no armor';
 let topic=FOLLOWUP.test(text)&&bot.lastChatTopic?bot.lastChatTopic:Object.entries(CHAT_TOPICS).find(([,pattern])=>pattern.test(text))?.[0]??'unknown';
 if(/\b(bleed|fire|frost|poison)\b/.test(text)&&! /\b(staff|sword|weapon)\b/.test(text))topic='effects';
 const pools={
 matches:[context.match?'We’re in a 2v2. Stay with your teammate and watch the crossfire.':'The 2v2 sign is at the back of the ledge.',context.teamMate?`Your teammate is ${context.teamMate}. Friendly fire is off.`:'Sign up and the teams are assigned by combat skill.','One life each. Eliminated players watch until the match ends.','A winning team gets 80 coins and 25 EXP on top of its KOs.','The courtyard has two main pieces of cover. A bow can control a lane while a teammate moves.','R leaves a match, but forfeiting does not pay rewards.','At the time limit, more survivors win. Equal survivors are decided by remaining health.'],
 greeting:[`Hey ${name}. What’s the plan?`,`Yo. ${plan}`,'Hey. Ready for another round?',`I’ve got ${coins} coins and questionable survival instincts.`,`Doing ${health<bot.kit.health*.4?'badly. I need a potion.':'fine. Give it one fight.'}`,`Hey ${name}. Still using that loadout?`,'I was just checking the next angle.','Hello from the least relaxing pit in existence.'],
 compliment:[`gg, ${name}.`,bot.lastDefeatBy===name?'You caught me before I could reset. Clean finish.':'That was a good exchange.','Your direction changes were the hard part to track.','Respect. Next one should be closer.','Good fight. I need to stop giving away the first hit.','That last jump threw off my timing.','I’ll give you that one.','Fair play. I’m adjusting for the next round.'],
 weapons:[`I’m using ${s.name}: ${s.damage} damage, ${s.reach.toFixed(1)}m ${s.kind==='staff'?'range':'reach'}, ${effects}.`,`My ${s.name.toLowerCase()} suits my ${bot.role} role. I compare gear before swapping.`,`Current weapon is ${s.name}. Raw damage isn’t everything; I check reach and effects too.`,s.kind==='staff'?'My staff needs space and a clear shot. Close the gap and I have a problem.':'I want you near the edge of my reach, where I can hit and still turn out.',`This one hits for ${s.damage} before armor or crits.`,`I’m keeping ${s.name.toLowerCase()} until I own something I score higher.`,s.speed>0?'This build has extra movement speed. It helps me choose when to engage.':'I’m relying on positioning more than a speed bonus.',`Effects on mine: ${effects}.`],
 effects:[`My current roll has ${effects}.`,'Bleed and fire tick after the hit. Frost slows movement instead.','A blocked melee hit won’t apply the weapon’s rolled effect.','Refreshing an effect keeps it active; it doesn’t stack forever.','Frost is useful when somebody keeps escaping the last hit.','Fire pressures people who try to disengage on low health.','Bleed makes a quick trade cost more than the first damage number.','A forged drop can carry two different effects. That combination is the interesting part.','Armor still reduces damage-over-time ticks.','A frost staff also has its own chill on top of its basic hit.'],
 chest:[`I have ${coins} coins. A chest costs ${CHEST_PRICE}.`,`I need ${Math.max(0,CHEST_PRICE-coins)} more coins for a roll.`,bot.lastPurchase??'I compare a drop with my equipped weapon before I change anything.','Forged drops are rare: 1.5% of all chests.','I don’t equip something just because it has a shiny rarity label.','Sometimes a guaranteed upgrade is worth more than another gamble.','Two effects on a forged weapon can change how you approach a fight.','A bad roll is salvage money. I keep the gear that fits my role.','I’d like one ridiculous drop. The chest has other ideas.','Reach, damage, and movement can all roll bonuses.'],
 economy:[`I’ve got ${coins} coins and ${armor.toLowerCase()}${bot.helmet==='helmet'?' plus a helmet':''}.`,`My wallet says ${coins}. My wish list says more.`,`I’m ${coins<120?'saving for basic protection':'comparing armor and weapon upgrades'} before my next purchase.`,'I earn coins from KOs and supplies, then spend them on the ledge.','Protection first if I’m getting melted. A weapon first if I can’t finish a fight.','A helmet works alongside body armor.','That chestplate is one copy. Lose it and I have to buy another.','My starter kit comes back. Common gear is lost on death, and rare gear falls on the ground.','I don’t get free equipment; my purchases come out of my own coins.','I need a safe return window. Getting hit cancels the trip.','I’ll keep extra healing potions if I can afford them.','It’s easy to spend the entire wallet on the chest. Usually a terrible plan.'],
 ranks:[`I’m ${rank.name}, level ${rank.level}. ${bot.rating} EXP.`,rank.next?`${rank.next.min-bot.rating} more EXP until ${rank.next.name}.`:'Apex is the last rank.',`My round: ${bot.kills} KOs, ${bot.deaths} deaths.`,'Tab opens the leaderboard.',`There are ${RANKS.length} ranks, ${LEVELS_PER_RANK} levels each, from 1 to ${RANKS.length*LEVELS_PER_RANK}.`,'Winning against higher-ranked opponents is worth more EXP.','Deaths cost some EXP, so a clean retreat has value.','My badge is earned through fights, not bought with coins.'],
 health:[`${health} / ${bot.kit.health} health. ${potions} healing potions left.`,health<bot.kit.health*.4?'I’m low. I want cover and a moment to heal.':'I can take another fight, but I’m not wasting health.',`My class has ${bot.kit.health} maximum health.`,'Healing potions restore 115, up to your maximum.','Natural regeneration waits until you’ve been out of damage for a while.','The starter healing stack refills to three on the ledge. Bought potion copies can be stored or lost.','Running in a straight line to drink is asking to get caught.',potions?'I’ve got a potion. I need the right moment to use it.':'No healing potions left. That changes the plan.'],
 events:[context.eventName?`${context.eventName}. I’m checking where the crates landed.`:'Only supply giveaways now. There are no arena disasters.','The supply rush is a good chance to restock between fights.','Crates give coins, arrows and health.','No more running under the bridge for warnings.'],
 map:['The ledge is safe. The pit is where we fight.','The bridge and central rock help break line of sight.','I look for a dry landing before jumping a lava channel.','The red fog makes the far side feel a lot deeper.','The pumpkins can stay. I’m more worried about the lava.','Shops and the chest are back on the ledge.','Those original crimson flags fit the place.','I try not to retreat toward a lava crossing with somebody behind me.','The ramps are a longer route, but they beat jumping into a bad landing.','I’m using the bridge and rocks to break sight lines.'],
 movement:['Space jumps. Press it again in the air to dive-roll, or use Alt to roll from the ground.','C or Ctrl crouches. Shift sprints. Q/E dodge left or right, I opens inventory; F interacts.','V switches first and third person.','Jumping in one spot is predictable. Change direction too.','I’d rather land somewhere useful than spam jumps with no route.','A short strafe can beat a huge turn if you time it with their swing.','Save the second jump when you need a longer crossing.','Crouching lowers your profile, but you give up speed.','Keep a dry landing in mind before committing over lava.','I watch where you’re going, not just where you were.'],
 combat:[`My approximate click rate is ${bot.skill.cps} CPS. Aim still matters.`,'Every click swings. Damage waits for the target’s half-second immunity to end.','Land a sprint hit, briefly release W, then press it again while holding Shift. That restores sprint knockback.','Hold the edge of your reach and track the body. Clicking into empty space will not keep a combo going.','If you get a return hit, that breaks their combo. Strafe out of the line before pushing back in.','Falling hits can crit. Jump timing matters.','Blocking helps when you see a swing coming. It also slows you down.','Reach matters more than swinging at empty air faster.','When you lose the angle, reset instead of chasing the same line.','A good first hit sets up the next approach.','Knockback can buy space or push somebody toward a worse landing.','Don’t burn every potion trying to rescue the same bad fight.','Watch the opponent’s movement between your own clicks.'],
 strategy:[plan,`Right now? ${plan}`,bot.target?`My current target is ${bot.target.name??name}. I’m checking their angle before closing.`:'I’m looking for a fight I can actually reach.',bot.role==='flanker'?'I prefer arriving from the side while somebody is occupied.':bot.role==='ranger'?'I want distance, clear sight, and a way out.':'I want a clean opening and enough room to reset.',`You’re on ${context.playerStreak} straight KOs. ${context.playerStreak>=3?'That attracts attention.':'I’m still choosing fights by distance and opportunity.'}`,'If the route becomes dangerous, I change the route.','A retreat is useful if it gets me back in with better odds.','I’m weighing the fight against healing and spending what I earned.'],
 identity:[`I’m a simulated opponent, about ${bot.skill.cps} CPS with aim error and reaction delay.`,'We’re local bots. Nobody else is connected to this match.','My decisions use the arena, targets, health, and equipment.','The chat is a local dialogue system. I can discuss the match, but I’m not a general chatbot.','We have different skill levels. Some of us are absolutely having a worse time.','I can lead shots and flank, but I still need an open line to hit you.'],
 commands:['/help shows the command list.','/freecam lets you watch your body and its effects. WASD flies; V returns.','/admin on turns admin on. Double-tap Space to toggle flight.','While flying, Space goes up and C or Ctrl goes down.','/targetme makes us coordinate against you. /targetme off restores free-for-all.','/killall includes you. /killall bots leaves you alive.','/coins works while admin is on if you want to try equipment or cosmetics.','/heal restores health and clears effects.','/spawn returns you to the ledge; with admin off it has a channel.'],
 music:['The arena music is a Pixabay playlist. Music volume is in Settings.','Music volume is separate from environment sounds.','Play music in Settings starts it if the browser blocked it.','Pause music leaves the footsteps and lava alone.','After the lofi tracks come Tribal Drumming Atmosphere, Hand Drums, and Fighting Spirit.','2v2 switches to Feel The Energy, then the arena playlist comes back.','Credits names the Pixabay tracks. They are free under the Pixabay Content License.'],
 cosmetics:['Effects are in the shop. They’re bought with arena coins.','Most effects are visual. Ascension also pushes enemies back and chips their health.','Prism cycles through colors. Subtle? Absolutely not.','Glacier has those blue orbiting shards.','Bloodmoon looks right in this red fog.','Ascension costs a million. That gold column is hard to miss across the pit.','Once you buy an effect, you can equip it again without paying twice.','You can switch an appearance off with No effect.',`There are ${Object.keys(COSMETICS).length-1} purchasable appearances.`],
 streak:[`You’re on a ${context.playerStreak} streak.`,context.playerStreak>=3?'You’re glowing and drawing attention. I’d protect that streak.':'Three straight KOs is where the streak aura starts.',`My streak is ${bot.streak??0}. Working on it.`,'A big streak makes you a more attractive target.','There’s a difference between winning one fight and surviving the next three.','I’d use that reward money before getting cornered.'],
 rematch:['Sure. See you down there.','Round two. I’m changing my angle this time.','Give me a moment to reset and I’m back in.','I remember who got me last time.','I’m not promising the same result.','Meet me in the pit. The ledge is protected.','One more fight, then I should probably spend these coins.','I’m coming back with the same confidence and hopefully better timing.'],
 banter:['Bold talk for somebody standing near lava.','Save it for the next fight.','Fair. I’ll try making the rematch less comfortable.','I was collecting data. Very painful data.','Enjoy the opening. It won’t always be there.',`You have ${context.playerKills} KOs. I can see why you’re confident.`,'My strategy apparently needed a revision.','That was a tactical donation of EXP.','All that talking and the chest still charges full price.','I’ll let the next round answer that.'],
 laughter:['Yeah, that looked ridiculous.','I’m choosing to call that intentional.','The replay would not be kind.','We’re never speaking of that landing again.','That went about as planned. So, badly.','The lava has the best K/D here.','I saw that. Unfortunately.','Nothing to see here. Just expert footwork.'],
 thanks:['No problem.','Anytime. Now watch the next swing.','You got it.','Glad it helped.','All good.','Now use that information against somebody else, please.'],
 apology:['You’re good.','It’s the pit. These things happen.','No worries.','I’ll survive. Or respawn. One of those.','All good. Next fight.','Accidental or not, that still counted.'],
 farewell:[`Later, ${name}.`,'Good games.','See you next round.','Take care. Your gear stays saved here.','I’ll be somewhere between the ledge and a bad decision.','Catch you later.'],
 opinion:[`For my ${bot.role} role, I’m sticking with ${s.name.toLowerCase()}.`,'Best build is one you can use without wasting its range.','I like a clean opening more than a flashy rarity.','My least favorite feature is landing in lava.','Best feeling? Surviving a fight with enough coins for the upgrade.','A good frost roll is annoying to fight against.'],
 unknown:[`I didn’t quite catch that, ${name}. What did you mean?`,'Gear, tactics, the map, or something else?',`I’m listening, but I’ve also got ${health} health to worry about.`,'Ask me about the match and I’ll have a better answer.',`Meanwhile, ${plan.charAt(0).toLowerCase()+plan.slice(1)}`,'That one went over my helmet.','You may have to rephrase that for me.','I know this arena better than I know the outside world.'],
 };
 let candidates=pools[topic]??pools.unknown;
 if(topic==='identity'&&/are you|are we|is this/.test(text))candidates=[`I’m a simulated opponent, about ${bot.skill.cps} CPS. The other fighters are local bots too.`,`Yes, I’m a simulated opponent. My dialogue is local and my tactics use what’s happening in the arena.`];
 if(topic==='economy'&&/\b(armor|armour|helmet)\b/.test(text)&&/what|your|wear|buy/.test(text))candidates=[`I’m wearing ${armor.toLowerCase()}${bot.helmet==='helmet'?' and a helmet':''}. ${coins} coins left.`,`My armor is ${armor.toLowerCase()}. I’ve got ${coins} coins for the next upgrade.`];
 if(topic==='weapons'&&/\b(what|which|using|carrying|your)\b/.test(text))candidates=candidates.filter(line=>line.toLowerCase().includes(s.name.toLowerCase()));
 if(topic==='economy'&&/how (many|much)|your (coin|money)|what.*(coin|money)/.test(text))candidates=candidates.filter(line=>line.includes(String(coins)));
 if(topic==='ranks'&&/your rank|what.*rank|which rank/.test(text))candidates=candidates.filter(line=>line.includes(rank.name));
 const line=choose(bot,topic,candidates.length?candidates:pools[topic],text);
 // Sparing voice markers vary cadence without turning every answer into a slogan.
 return (bot.chatSequence%7===0&&line.startsWith('I ')?VOICES[(bot.id??0)%VOICES.length][bot.chatSequence%4]:'')+line;
}
export function ambientReply(bot,context){
 const lines=[describePlan(bot,context)];
 if(bot.lastPurchase)lines.push(bot.lastPurchase);
 if(!bot.alive)lines.push('Back to the ledge. I need a better entry.','Respawning. Nobody saw that, right?');
 else if(bot.hp<bot.kit.health*.3)lines.push('Low health. I need an exit.','Backing out before this gets worse.','A potion and five seconds would be useful.');
 else if(context.eventName)lines.push('Watch the marks.','I’m heading for the bridge.','Not fighting in the impact zone.');
 else if(context.hunt)lines.push('Keep the exits covered.','I’ll close this side.','Don’t all take the same angle.');
 else lines.push('That lava crossing is going to get somebody.','Another fight, another repair bill.','Checking the far side.','I’m saving for the next upgrade.','Somebody always forgets the second jump.','The bridge is getting crowded.');
 if(bot.account.coins>=CHEST_PRICE)lines.push(`I’ve got ${bot.account.coins} coins. Looking for a safe window to spend them.`);
 return choose(bot,'ambient',lines);
}
