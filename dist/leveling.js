import {CONFIG} from './shared/config.js?v=68';
const REWARDS=CONFIG.progression.rewards;
const LEVELING=CONFIG.progression.leveling;
export const LEVELS_PER_RANK=LEVELING.levelsPerRank;
const stepExp=level=>REWARDS.knockout.points*Math.round(LEVELING.stepBase+LEVELING.stepGrowth*Math.pow(level-1,LEVELING.stepExponent));
const MAX_LEVEL=CONFIG.progression.ranks.length*LEVELS_PER_RANK,expAtLevel=[0,0];
for(let level=1;level<MAX_LEVEL;level++)expAtLevel[level+1]=expAtLevel[level]+stepExp(level);
export const RANKS=CONFIG.progression.ranks.map((rank,index)=>({...rank,min:expAtLevel[index*LEVELS_PER_RANK+1]}));
export function rankFor(points){const exp=Math.max(0,points);let lo=1,hi=MAX_LEVEL;while(lo<hi){const mid=(lo+hi+1)>>1;if(expAtLevel[mid]<=exp)lo=mid;else hi=mid-1;}const level=lo,index=Math.floor((level-1)/LEVELS_PER_RANK),rank=RANKS[index],next=RANKS[index+1]??null,start=expAtLevel[level],end=level<MAX_LEVEL?expAtLevel[level+1]:start,rankEnd=next?next.min:expAtLevel[MAX_LEVEL];return {...rank,index,next,progress:rankEnd>rank.min?Math.max(0,Math.min(1,(exp-rank.min)/(rankEnd-rank.min))):1,level,levelInRank:level-index*LEVELS_PER_RANK,levelProgress:level>=MAX_LEVEL?1:(exp-start)/(end-start),maxLevel:MAX_LEVEL};}
export const experienceForLevel=level=>expAtLevel[Math.max(1,Math.min(MAX_LEVEL,Math.floor(level)))];
