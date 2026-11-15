/* Deterministic identities and bounded social memory. No network or model required. */
(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const first=['Aldric','Bram','Cecily','Dunstan','Edith','Flora','Godwin','Hilda','Ives','Joan','Kit','Leof','Mabel','Nesta','Osric','Piers','Rowan','Sibyl','Tilda','Wat','Wynn','Agnes','Marta','Jory','Linnet','Hob'];
const surnames=['Holt','Marsh','Wick','Fenn','Barrow','Sedge','Rook','Thorne','Ashby','Cobb','Hale','Kettle','Lark','Mallow','Pell','Quill','Wren','Yarrow','Calder','Heron','Loam','Merrow','Pike','Reeve'];
const interests=['the first frost','old songs','the price of flour','birds along the river','stories from the road','a well-made tool','the smell of fresh bread','the changing weather','quiet mornings','the things people leave unsaid'];
const jobs={guard:'watchkeeper',soldier:'soldier',smith:'blacksmith',woodcutter:'woodcutter',farmer:'farmer',shepherd:'shepherd',fisher:'fisher',priest:'priest',child:'child',noble:'estate steward',queenlady:'court adviser',traveller:'traveller',witch:'herbalist',merchant:'trader'};
function identity(n){const id=n.personId||n.role+':'+n.origin.join(','),h=hash(id),r=k=>hash(id+':'+k)/4294967295;
 const traits={warmth:r('warmth'),courage:r('courage'),temper:r('temper'),honesty:r('honesty'),sociability:r('social'),loyalty:r('loyalty'),diligence:r('work')};
 if(n.role==='child')traits.courage*=.45;
 const voice=traits.warmth>.7?'kind':traits.temper>.7?'blunt':traits.sociability<.3?'reserved':traits.sociability>.7?'wry':'thoughtful';
 return {id,traits,voice,first:first[h%first.length],surname:surnames[hash(id+'family')%surnames.length],job:n.shop?({baker:'baker',grocer:'greengrocer',draper:'draper',herbalist:'herbalist',inn:'innkeeper'}[n.shop]):jobs[n.role]||['weaver','gardener','mender','carter','launderer'][h%5],interest:interests[hash(id+'interest')%interests.length],offset:(r('wake')-.5)*.035,family:[],friends:[]};}
function state(store,id){return store[id]||(store[id]={trust:0,memories:[],met:false,visits:0,lastGift:-1,lastTrade:-1,lastChat:-1,apologized:null});}
function remember(s,event){if(s.memories.some(e=>e.id===event.id))return false;
 s.memories.push({...event});if(s.memories.length>12)s.memories.shift();s.trust=clamp(s.trust+(event.impact||0),-100,100);return true;}
function recover(p,s,time){if(s.lastRecovery===undefined){s.lastRecovery=time;return;}const days=Math.max(0,time-s.lastRecovery);if(days<1)return;if(s.trust<0)s.trust=Math.min(0,s.trust+days*(.5+1.5*p.traits.warmth));s.lastRecovery=time;}
function disposition(p,s){if(s.trust<-45)return 'afraid';if(s.trust<-15)return 'wary';if(s.trust>35)return 'fond';if(s.trust>10)return 'familiar';return p.traits.warmth>.6?'welcoming':'reserved';}
function response(p,s,{violent=false,own=false,kin=false,self=false,law=false}={}){
 if(law)return 'report';if(p.job==='child')return violent?'flee':'report';
 const t=p.traits,stake=self?1:kin?t.loyalty:own?.75:0;
 if(t.courage>.57&&t.temper+stake>1.05)return 'defend';
 if(violent&&t.courage<.32)return 'flee';
 if(!violent&&!own&&!kin&&!self&&t.honesty<.28&&s.trust>10)return 'ignore';
 return 'report';}
function phase(p,t){if(p.job==='watchkeeper'&&p.traits.diligence>.5)t=(t+.5)%1;const workStart=p.job==='innkeeper'?.38:.27+p.offset,evening=p.job==='innkeeper'?.9:.77+p.offset,bed=p.job==='innkeeper'?.97:.88+p.offset;
 return t>=workStart&&t<evening?'day':t>=evening&&t<bed?'eve':'night';}
function relation(p,id){return p.family.find(r=>r.id===id)||p.friends.find(r=>r.id===id);}
function salient(s){return [...s.memories].reverse().find(e=>e.impact<0)||s.memories[s.memories.length-1];}
const api={names:first,hash,identity,state,remember,recover,disposition,response,phase,relation,salient};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ValleyPeopleCore=api;
})(typeof window!=='undefined'?window:globalThis);
