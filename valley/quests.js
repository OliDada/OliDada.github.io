/* Work for the people of the valley: they ask for things, you write it in your journal,
   the map shows where to go, and they pay you when it is done.
   State lives in the saved game under `quests`. People are known by their stable person id. */
(function(){
'use strict';
const V=window.__valley,G=V.GAME,Q=G.qa,C=window.ValleyPeopleCore;
if(!Q||!G.social||!C)return;
const P=V.P,S=()=>G.state(),hash=C.hash,MAX=5;
const data=()=>{const s=S();if(!s.quests||s.quests.v!==1)s.quests={v:1,active:[],done:{},last:{},total:0,track:null,log:[],hint:false};const q=s.quests;if(!q.known)q.known={};if(!q.news)q.news={};return q;};
const day=()=>Math.floor((S().social&&S().social.time)||0);
const folk=()=>G.social.all;
const who=id=>folk().find(n=>n.person&&n.person.id===id);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const coins=n=>n+(n===1?' coin':' coins');
const cap=s=>s[0].toUpperCase()+s.slice(1);
function where(n){const d=c=>Math.hypot(n.x-c[0],n.z-c[1]);
  if(n.court||V.inCourt(n.x,n.z))return 'at the castle';if(d(V.INN)<45)return 'at the inn';if(d(V.V)<130)return 'in the village';
  if(d(V.TOWN_C)<160)return 'in Lake Town';if(d(V.RUIN)<60)return 'by the ruined tower';if(n.x>250)return 'in the Old Wood';return 'out in the valley';}

/* ---------- what people ask for ---------- */
const NAMES={herb:['bundle of meadow herbs','bundles of meadow herbs'],mushroom:['mushroom','mushrooms'],flower:['bunch of wildflowers','bunches of wildflowers'],berries:['handful of berries','handfuls of berries'],apple:['apple','apples'],
  pelt:['wolf pelt','wolf pelts'],bread:['loaf of bread','loaves of bread'],cheese:['wheel of cheese','wheels of cheese'],candle:['tallow candle','tallow candles'],candlestick:['silver candlestick','silver candlesticks'],
  cloth:['bolt of cloth','bolts of cloth'],honeycake:['honey cake','honey cakes'],ale:['mug of ale','mugs of ale'],stew:['bowl of stew','bowls of stew']};
const SHORT={herb:'Herbs',mushroom:'Mushrooms',flower:'Wildflowers',berries:'Berries',apple:'Apples',pelt:'Wolf pelts',bread:'Bread',cheese:'Cheese',candle:'Candles',candlestick:'A silver candlestick',cloth:'Cloth',honeycake:'Honey cakes',ale:'Ale',stew:'Stew'};
const FIND={herb:'Herbs grow in open ground beside the roads.',flower:'Wildflowers grow in open ground beside the roads.',mushroom:'Mushrooms grow at the foot of trees, where the woods are thick.',berries:'Berry bushes grow between the trees in the woods.',
  apple:'Windfalls lie under the orchard trees, and the greengrocer sells them.',pelt:'Wolves keep to the hills, well away from the roads.',bread:'The baker at the castle market sells it.',cheese:'The greengrocer at the castle market sells it.',
  candle:'The herbalist at the castle market sells them.',cloth:'The draper at the castle market sells it.',honeycake:'The baker at the castle market sells them.',ale:'The innkeeper sells it.',stew:'The innkeeper sells it.',
  candlestick:'Fine houses keep one on the table. Nobody will give theirs up willingly.'};
const B=(item,n,pay,pitch,hot)=>({type:'bring',item,n,pay,pitch,hot:!!hot});
const H=(foe,n,pay,pitch)=>({type:'hunt',foe,n,pay,pitch});
const D={type:'deliver'},F={type:'find'};
const WOLF2='Wolves have been coming down off the hills at night. Put down two of them and I will sleep easier, and pay you for it.';
const BAND='There are bandits camped in the Golden Woods, off the west road, and the watch cannot spare the men. Put three of them on the ground and there is a purse in it.';
const WORK={
  herbalist:[B('herb',4,22,'I am down to my last bundle of meadow herbs, and half the castle has a cough. Bring me four, picked clean, and I will pay better than the stall price.'),
    B('mushroom',5,24,'I need five of the brown-capped mushrooms for a tincture. They grow at the foot of the trees.'),B('flower',5,18,'Five bunches of wildflowers, for a salve. It smells dreadful, but it works.')],
  baker:[B('berries',6,20,'The castle wants berry tarts and I have no berries. Six handfuls from the woods would save my week.'),B('apple',4,22,'I need four apples for the honey cakes. Orchard windfalls will do nicely.'),D],
  greengrocer:[B('mushroom',6,26,'Mushrooms sell as fast as I can lay them out. Bring me six and I will make it worth the walk.'),B('apple',5,24,'My apple basket is empty. Five would fill it.'),B('berries',5,18,'Five handfuls of berries, if you are passing through the woods.')],
  draper:[B('flower',6,22,'I am out of dye. Six bunches of wildflowers will give me a good yellow.'),B('pelt',2,48,'A lady at court wants a wolf-fur collar. I need two pelts, and I would rather not fetch them myself.'),D],
  innkeeper:[B('mushroom',4,20,'The stew is thin this week. Four mushrooms would thicken it.'),B('cheese',2,34,'I am out of cheese and cannot leave the counter. Two wheels from the castle market, and keep the change.'),
    B('candlestick',1,45,'A guest left without paying. He admired my silver candlestick, and then it was gone. Bring me one like it. I will not ask where it came from.',true)],
  blacksmith:[B('pelt',2,46,'My bellows are splitting. Two wolf pelts would mend them.'),H('bandit',3,80,BAND)],
  shepherd:[H('wolf',2,44,'I lost two ewes this month. The wolves den in the hills and come down after dark. Kill two of them and I will pay you what the ewes were worth.'),F,H('wolf',3,66,'They are back, and bolder. Three this time, if you have the arm for it.')],
  woodcutter:[H('wolf',2,42,WOLF2),B('bread',2,22,'I have not been down to the market in a week. Two loaves of bread would do me until I can.'),F],
  watchkeeper:[H('bandit',3,80,BAND),H('wolf',2,40,WOLF2)],
  soldier:[H('bandit',3,80,BAND),H('wolf',2,40,WOLF2)],
  farmer:[F,D,H('wolf',2,40,WOLF2)],
  fisher:[B('bread',2,20,'The fish are biting and I dare not leave the line. Two loaves of bread would keep me here until dusk.'),D,B('ale',2,20,'It is thirsty work, sitting still. Two mugs of ale from the inn, if you would.')],
  priest:[B('candle',3,24,'The altar candles are burnt to stubs. Three tallow candles would see us through the week.'),D,B('flower',5,18,'Five bunches of wildflowers for the altar, if you would.')],
  witch:[B('mushroom',6,30,'Six mushrooms. The ones the deer will not touch.'),B('pelt',1,30,'One wolf pelt. Do not ask, and I will not tell you.'),B('herb',5,26,'Five bundles of meadow herbs, cut where the sun reaches. The wood grows the wrong kind.')],
  'estate steward':[B('cloth',1,34,'The hall needs a new table runner. One bolt of cloth from the draper.'),B('honeycake',2,28,'Her ladyship wants honey cakes, and wants them now. Two, if you please.'),D],
  'court adviser':[B('honeycake',2,28,'I should like two honey cakes, and I cannot be seen queueing for them.'),D,B('cloth',1,34,'One bolt of cloth, for a gown. The draper knows the colour.')],
  other:[D,F,B('bread',1,14,'I have not eaten since morning. A loaf of bread would be a kindness.'),B('honeycake',1,16,'I have had a honey cake on my mind all day. Would you fetch me one?')]
};
const ALWAYS=/^(herbalist|baker|greengrocer|draper|innkeeper|blacksmith|shepherd|woodcutter|fisher|priest|witch)$/,NEVER=/^(child|king|queen|royalguard|herald|jester)$/;
function job(n){if(n._qj)return n._qj;const j=n.role==='witch'?'witch':n.person.job;return n._qj=WORK[j]?j:'other';}
function gives(n){if(n._qg!==undefined)return n._qg;
  if(!n.person||n.foe||n.wall||n.talk===false||NEVER.test(n.role))return n._qg=false;
  return n._qg=ALWAYS.test(job(n))||hash(n.person.id+':work')%(job(n)==='other'?9:/^(estate steward|court adviser)$/.test(job(n))?5:3)===0;}
const activeOf=n=>data().active.find(q=>q.id===n.person.id);
function available(n){if(!gives(n))return false;const d=data();if(activeOf(n)||d.last[n.person.id]===day())return false;return G.social.memory(n).trust>=-15;}

/* ---------- making a task ---------- */
function anchors(){const a=[[V.RUIN[0],V.RUIN[1],'near the ruined tower']],r=V.roads||{};
  const add=(k,f,t)=>{const p=r[k];if(p&&p.length>4){const q=p[Math.floor(p.length*f)];a.push([q[0],q[1],t]);}};
  add('forest',.5,'beside the forest road');add('meadow',.5,'in the meadow below the village');add('west',.3,'off the west road');add('west',.7,'off the west road, toward the lake');add('castle',.5,'beside the castle road');add('track',.5,'along the old track');
  return a;}
function spotNear(ax,az,seed){let s=seed>>>0;const r=()=>{s=Math.imul(s,1664525)+1013904223>>>0;return s/4294967296;};
  for(let i=0;i<400;i++){const a=r()*6.283,d=14+r()*34,x=ax+Math.cos(a)*d,z=az+Math.sin(a)*d;
    if(!V.allowed(x,z)||V.inVillage(x,z)||V.inCourt(x,z)||V.roadDist(x,z)<5||V.nearStream(x,z,4)||V.floorH(x,z)>-1e8||V.wallHit(x,z,1))continue;
    if(V.trees.some(t=>Math.abs(t[0]-x)<3&&Math.abs(t[1]-z)<3&&Math.hypot(t[0]-x,t[1]-z)<t[2]+.6))continue;
    return [+x.toFixed(1),+z.toFixed(1),r(),r()];}
  return null;}
function make(n){const d=data(),id=n.person.id,list=WORK[job(n)],k=(d.done[id]||0)+hash(id+':first');
  for(let i=0;i<list.length;i++){const t=list[(k+i)%list.length],q={id,type:t.type,day:day(),first:n.first,from:n.name};
    if(t.type==='bring'){Object.assign(q,{item:t.item,n:t.n,pay:t.pay,hot:t.hot,pitch:t.pitch,title:SHORT[t.item]+' for '+n.first});return q;}
    if(t.type==='hunt'){if(t.foe==='bandit'&&!G.camp)continue;if(t.foe==='wolf'&&!(G.dens&&G.dens.length))continue;
      Object.assign(q,{foe:t.foe,n:t.n,k:0,pay:t.pay,pitch:t.pitch,title:t.foe==='wolf'?n.first+'’s wolf trouble':'Bandits in the Golden Woods'});return q;}
    if(t.type==='deliver'){const c=folk().filter(m=>m!==n&&m.person&&!m.foe&&!m.wall&&m.talk!==false&&m.fixedY===undefined&&m.type!=='patrol'&&!NEVER.test(m.role)&&dist(n,m)>220&&!d.active.some(a=>a.to===m.person.id))
        .sort((a,b)=>a.person.id<b.person.id?-1:1);if(!c.length)continue;
      const m=c[hash(id+':to:'+(d.done[id]||0))%c.length];
      Object.assign(q,{to:m.person.id,toName:m.name,toFirst:m.first,pay:12+Math.round(dist(n,m)/28),title:'A parcel for '+m.first,
        pitch:'I have a parcel that must reach '+m.name+', '+where(m)+'. It is a long walk and I cannot leave my work. Would you carry it?'});return q;}
    if(t.type==='find'){const A=anchors().sort((a,b)=>Math.hypot(a[0]-n.x,a[1]-n.z)-Math.hypot(b[0]-n.x,b[1]-n.z)).slice(0,3),a=A[hash(id+':lost:'+(d.done[id]||0))%A.length],s=spotNear(a[0],a[1],hash(id+':spot:'+(d.done[id]||0)));if(!s)continue;
      Object.assign(q,{spot:[s[0],s[1]],area:[+(s[0]+(s[2]-.5)*40).toFixed(1),+(s[1]+(s[3]-.5)*40).toFixed(1),48],desc:a[2],found:false,pay:32,title:n.first+'’s lost locket',
        pitch:'I lost a locket '+a[2]+'. It was my mother’s, and I have walked the ground three times. If you see it glinting in the grass, bring it back to me.'});return q;}}
  return null;}
const have=q=>q.hot?Q.count(q.item):Q.count(q.item)-Q.hot(q.item);
function ready(q){if(q.type==='bring')return have(q)>=q.n;if(q.type==='hunt')return q.k>=q.n;if(q.type==='find')return q.found&&Q.count('keepsake')>0;return false;}
function objective(q){const g=q.first;
  if(q.type==='bring'){const h=Math.min(q.n,have(q));return ready(q)?'Take '+(q.n>1?'them':'it')+' to '+g+' ('+h+'/'+q.n+')':'Bring '+q.n+' '+NAMES[q.item][q.n>1?1:0]+' to '+g+' ('+h+'/'+q.n+')';}
  if(q.type==='hunt')return ready(q)?'Tell '+g+' it is done':(q.foe==='wolf'?'Kill '+q.n+' wolves':'Beat '+q.n+' bandits')+' ('+q.k+'/'+q.n+')';
  if(q.type==='deliver')return 'Carry the parcel to '+q.toName;
  return q.found?'Take the locket back to '+g:'Find the locket '+q.desc;}
function hintOf(q){if(q.type==='bring')return ready(q)?'':FIND[q.item]||'';
  if(q.type==='hunt')return ready(q)?'':q.foe==='wolf'?'Their dens are marked on your map. They are bolder at night.':'Their camp is marked on your map. They hit hard: block, or strike from behind.';
  if(q.type==='deliver'){const m=who(q.to);return m?cap(where(m))+'. People go home in the evening and sleep at night.':'';}
  return q.found?'':'The circle on your map shows where to search. Look for a glint.';}
function short(q){if(q.type==='bring')return ready(q)?'Return to '+q.first:SHORT[q.item]+' '+Math.min(q.n,have(q))+'/'+q.n;
  if(q.type==='hunt')return ready(q)?'Return to '+q.first:(q.foe==='wolf'?'Wolves ':'Bandits ')+q.k+'/'+q.n;if(q.type==='deliver')return 'Parcel for '+q.toFirst;return q.found?'Return to '+q.first:'Find the locket';}

/* ---------- taking, finishing, giving up ---------- */
let offer=null,dropAsk=null;
function accept(n){const d=data(),q=offer&&offer.id===n.person.id?offer:make(n);offer=null;if(!q)return 'Nothing just now, after all.';
  d.active.push(q);if(q.type==='deliver')Q.give('parcel');if(!d.track||!d.active.some(a=>a.id===d.track))d.track=q.id;
  Q.tell('scroll','New task: '+q.title);refresh();Q.save();
  return q.type==='bring'?'Thank you. You will find me here.':q.type==='hunt'?'Good. Mind yourself out there, and come back in one piece.':q.type==='deliver'?'Here it is. Mind the seal, and thank you.':'Bless you. Look for a glint in the grass.';}
function finish(q,n){const d=data();
  if(q.type==='bring'){const clean=Q.count(q.item)-Q.hot(q.item),c=Math.min(q.n,clean);if(c>0)Q.take(q.item,c);if(q.n-c>0)Q.take(q.item,q.n-c,true);}
  if(q.type==='deliver')Q.take('parcel',1);if(q.type==='find')Q.take('keepsake',1);
  d.active=d.active.filter(a=>a!==q);d.done[q.id]=(d.done[q.id]||0)+1;d.last[q.id]=day();d.total++;d.log.push(q.title);if(d.log.length>8)d.log.shift();
  if(d.track===q.id)d.track=d.active[0]?d.active[0].id:null;
  Q.coins(q.pay);Q.tell('coin','+'+coins(q.pay));V.say('Task done',q.title);
  for(const m of new Set([n,who(q.id)]))if(m&&m.person){const s=G.social.memory(m);s.trust=Math.min(100,s.trust+(m===n?6:3));}
  dropKeep(q);refresh();Q.save();}
function abandon(q){const d=data();d.active=d.active.filter(a=>a!==q);if(q.type==='deliver'&&Q.count('parcel'))Q.take('parcel',1);if(q.type==='find'&&q.found&&Q.count('keepsake'))Q.take('keepsake',1);
  d.last[q.id]=day();if(d.track===q.id)d.track=d.active[0]?d.active[0].id:null;const n=who(q.id);if(n){const s=G.social.memory(n);s.trust=Math.max(-100,s.trust-3);}dropKeep(q);refresh();}
function kill(foe){const d=data();for(const q of d.active)if(q.type==='hunt'&&q.foe===foe&&q.k<q.n){q.k++;Q.tell('scroll',q.k>=q.n?q.title+': done. Return to '+q.first+'.':q.title+': '+q.k+'/'+q.n);}refresh();}

/* ---------- talking ---------- */
function options(n){if(!n.person)return [];const d=data(),mine=activeOf(n),out=[];
  const forMe=d.active.find(q=>q.type==='deliver'&&q.to===n.person.id);
  if(forMe)out.push(['q:deliver','I have a parcel for you, from '+forMe.first+'.']);
  if(mine)out.push(mine.type!=='deliver'&&ready(mine)?['q:done',mine.type==='bring'?'I have what you asked for.':mine.type==='hunt'?'It is done.':'I found your locket.']:['q:about','About the task you gave me.']);
  else if(available(n))out.push(['q:ask','Do you have any work for me?']);
  return out.concat(smallTalk(n));}
function followups(n,t){const f=talkNext(n,t);if(f)return f;return t==='q:ask'&&offer?[['q:yes','I will do it.'],['return','Not just now.']]:[['return','Ask about something else.']];}
function choose(n,t){const d=data(),mine=activeOf(n);
  {const l=talk(n,t);if(l!==null)return l;}
  if(t==='q:ask'){offer=available(n)?make(n):null;return offer?offer.pitch+' There '+(offer.pay===1?'is ':'are ')+coins(offer.pay)+' in it for you.':'Nothing just now. Ask me another day.';}
  if(t==='q:yes'){if(d.active.length>=MAX){offer=null;return 'You look as though you have promised enough already. Finish something first, then come back.';}return accept(n);}
  if(t==='q:deliver'){const q=d.active.find(a=>a.type==='deliver'&&a.to===n.person.id);if(!q||!Q.count('parcel'))return 'A parcel? You do not seem to have it with you.';finish(q,n);return 'From '+q.first+'? I had nearly given up on it. Here, '+coins(q.pay)+' for your trouble.';}
  if(t==='q:done'&&mine&&ready(mine)){finish(mine,n);return (mine.type==='find'?'You found it! I never thought I would see it again. ':mine.type==='hunt'?'Then we can breathe again. ':'That is everything I asked for. ')+'Here, '+coins(mine.pay)+', and my thanks.';}
  if(mine){if(mine.type==='bring')return 'I still need '+mine.n+' '+NAMES[mine.item][mine.n>1?1:0]+'. You have '+have(mine)+(Q.hot(mine.item)&&!mine.hot?', not counting what was stolen. I will not take that.':'.');
    if(mine.type==='hunt')return mine.k+' of '+mine.n+' so far. Finish it, and the money is yours.';
    if(mine.type==='deliver')return mine.toFirst+' is still waiting on that parcel. You will find them '+(who(mine.to)?where(who(mine.to)):'further on')+'.';
    return 'No sign of it yet? I lost it '+mine.desc+'.';}
  return 'There is nothing between us to settle.';}

/* ---------- small talk: news, dice, riddles, and what each trade knows ---------- */
const DIRS=['north','north-east','east','south-east','south','south-west','west','north-west'];
const dirTo=(dx,dz)=>DIRS[Math.round(((Math.atan2(dx,-dz)+6.2832)%6.2832)/.7854)%8];
const PLACES=['The stone circle in the Old Wood is best left alone after dark. Lights move between the stones, they say.','The innkeeper buys anything and never asks where it came from. Useful, if your pockets are heavier than they should be.',
  'There is an island on the lake with nobody on it. The boat at the Lake Town pier will take you, if you row.','The bandits in the Golden Woods carry lockpicks. Not that I would know what to do with one.',
  'Wolves keep to the hills by day. At night they come down further than anyone likes.','The fine houses up at the castle keep silver on the table and a chest by the bed. So I am told.',
  'Old Wenna in the Old Wood knows more than she says. Take the east road and keep climbing.','If you walk at night, raise a torch on the road and put it out near houses. People do not like a light at the window.',
  'The herbalist at the castle market brews a draught that closes a wound in a breath. It costs, mind.','The smith at the castle forges proper steel. Ninety coins, and worth it the first time a wolf gets close.'];
const TEASE={bring:'Wants something fetched, I think.',hunt:'Something about beasts, or worse.',deliver:'Something that needs carrying.',find:'Lost something dear, I heard.'};
function gossip(m){const t=m.person.traits,f=m.first;return t.temper>.72?f+' has a temper like a kicked hive. Do not say I said so.':t.honesty<.28?f+' would sell you your own boots and call it a favour.':t.courage>.78?f+' is afraid of nothing, which is its own kind of foolish.':
  t.warmth>.78?f+' would give a stranger the last crust in the house.':t.sociability<.22?f+' has not said ten words together this year.':t.diligence>.8?f+' is up before the cock and still working at dusk. It makes the rest of us look bad.':f+' is steadier than most. You could do worse for a friend.';}
function news(n){const d=data(),id=n.person.id,s=G.social.memory(n);if(s.trust<-15)return 'I have nothing to say to you.';
  let r=d.news[id];if(!r||r.day!==day())r=d.news[id]={day:day(),c:0,t:r?r.t:0};
  if(r.c>=(job(n)==='innkeeper'?5:3))return 'That is all I have heard today. Ask me tomorrow.';
  const k=r.c++,turn=r.t++;
  if(k===0&&Q.bounty()>0)return 'They say the watch is looking for a stranger. About your height, now I think of it.';
  const lead=()=>{const m=folk().filter(m=>m!==n&&m.person&&!d.known[m.person.id]&&available(m)&&dist(n,m)<700).sort((a,b)=>dist(n,a)-dist(n,b))[0];if(!m)return null;const q=make(m);if(!q)return null;
    d.known[m.person.id]=1;Q.tell('scroll',m.name+' noted on your map');return m.name+', the '+m.person.job+' '+where(m)+', has been looking for a pair of hands. '+TEASE[q.type];};
  const hint=()=>PLACES[(hash(id+':place')+turn)%PLACES.length];
  const talkOf=()=>{const f=n.person.friends.concat(n.person.family).map(r=>who(r.id)).filter(Boolean);if(!f.length)return null;return gossip(f[turn%f.length]);};
  const order=k%3===0?[lead,hint]:k%3===1?[talkOf,hint]:[hint];
  for(const f of order){const l=f();if(l)return l;}return hint();}
const DICERS=/^(innkeeper|traveller|soldier|trader|carter|fisher|woodcutter|blacksmith|mender)$/;
const plays=n=>n.role==='jester'||((DICERS.test(n.person.job)||Math.hypot(n.x-V.INN[0],n.z-V.INN[1])<30)&&n.person.traits.sociability>.25&&n.role!=='child');
const RIDDLES=[['I run all day and never tire. I have a bed and never sleep. What am I?','A river.','A horse.','The wind.'],['The more of these you take, the more you leave behind you. What are they?','Footsteps.','Coins.','Apples.'],
  ['I have teeth and cannot bite. What am I?','A comb.','An old dog.','A river.'],['I am full of holes and still I hold water. What am I?','A sponge.','A bucket.','A net.'],
  ['I follow you all day and hide at night. What am I?','Your shadow.','Your dog.','The sun.'],['I have a neck and no head, and I wear a cap. What am I?','A bottle.','A goose.','A candle.'],
  ['Feed me and I live. Give me a drink and I die. What am I?','A fire.','A fish.','A seed.'],['I have one eye and a long tail of thread. What am I?','A needle.','A mouse.','A kite.']];
let dice=null,riddle=null;
const pips=a=>'a '+a[0]+' and a '+a[1];
const roll=()=>[1+(Math.random()*6|0),1+(Math.random()*6|0)];
function smallTalk(n){const out=[],j=job(n),p=n.person;if(n.foe)return out;
  if(n.role==='child'||n.role==='jester')out.push(['q:riddle',n.role==='jester'?'Try me with a riddle, fool.':'Do you know any riddles?']);
  if(n.role!=='child')out.push(['q:news','What is the news?']);
  if(j==='priest')out.push(['q:bless','Would you say a blessing for me?']);
  else if(j==='witch')out.push(['q:fortune','Read my fortune.']);
  else if(j==='watchkeeper'||j==='soldier')out.push(['q:watch','Any trouble about?']);
  else if(j==='blacksmith')out.push(['q:blade','What do you make of my sword?']);
  else if(/^(shepherd|farmer|woodcutter|herbalist|gardener|greengrocer)$/.test(p.job))out.push(['q:land','Where is the good foraging?']);
  if(plays(n))out.push(['q:dice','Care for a throw of the dice?']);
  return out;}
function talkNext(n,t){
  if(t==='q:news'||t==='q:news2')return [[t==='q:news'?'q:news2':'q:news','What else have you heard?'],['return','Ask about something else.']];
  if(t==='q:dice'&&dice)return [['q:stand','Stand on that.']].concat(S().coins>=dice.stake*2?[['q:double','Double the stake.']]:[],[]);
  if(t==='q:stand'||t==='q:double')return [['q:dice','Throw again.'],['return','Enough dice for now.']];
  if(t==='q:riddle'&&riddle)return riddle.order.map(i=>['q:r'+i,RIDDLES[riddle.k][i+1]]);
  if(/^q:r\d$/.test(t))return [['q:riddle','Another one.'],['return','Ask about something else.']];
  return null;}
function talk(n,t){const d=data(),s=G.social.memory(n),p=n.person,st=S();
  if(t==='q:news'||t==='q:news2')return news(n);
  if(t==='q:bless'){if(s.trust<-15)return 'Make your peace with those you have wronged. Then come back.';if(s.blessed===day())return 'One blessing a day is plenty. More would be greed.';s.blessed=day();Q.heal(100);return 'Go gently, then. May your road be dry, your purse be heavy, and your sword stay in its sheath.';}
  if(t==='q:fortune'){const f=d.active.find(q=>q.type==='find'&&!q.found);
    if(f)return 'You are looking for something small and gold. Stand in the middle of the ground you mean to search, and walk '+dirTo(f.spot[0]-f.area[0],f.spot[1]-f.area[1])+'. It is closer than you think.';
    const h=d.active.find(q=>q.type==='hunt'&&q.k<q.n);if(h)return h.foe==='wolf'?'I see grey shapes and a red blade. Go at noon, when they are slow, and come at them from behind.':'I see three fires in a golden wood. Let them come to you one at a time. Together they will bury you.';
    return ['I see a long road and a full purse at the end of it. I do not see how you come by the purse. Perhaps that is for the best.','Someone in this valley is going to ask you for something. Say yes. It leads somewhere.','You will be bitten before the month is out. I do not say by what. Buy a draught.'][(hash(p.id)+day())%3];}
  if(t==='q:watch'){if(Q.bounty()>0)return 'You, by the look of it. There is a fine of '+coins(Q.bounty())+' on your head. Pay it, or I call the others.';
    const den=(G.dens||[]).slice().sort((a,b)=>Math.hypot(a[0]-n.x,a[1]-n.z)-Math.hypot(b[0]-n.x,b[1]-n.z))[0];
    return 'Bandits in the Golden Woods, off the west road. Three of them, and they hit hard.'+(den?' And there is a wolf den to the '+dirTo(den[0]-n.x,den[1]-n.z)+' of here. Keep to the road after dark.':'');}
  if(t==='q:blade'){const g=Q.gear();return g.steel?'That is my work. Keep it dry and it will outlive you.'+(g.mail?' And the shirt sits well. You look like someone it would be a mistake to rob.':' Now you want mail to go with it. A good sword does not stop a bad bite.'):'Village iron. It will cut bread, and it will cut a wolf if the wolf is patient. Bring me ninety coins and I will show you what steel is.';}
  if(t==='q:land'){const tips=['Mushrooms come up at the foot of the trees, where the wood is thick. The greengrocer and the herbalist pay best for them.','Herbs and wildflowers like open ground beside the roads. The herbalist takes the herbs, the draper takes the flowers for dye.',
    'There are windfalls under the orchard trees, free for the stooping. The baker will take every apple you carry.','Berry bushes grow between the trees in any wood. The baker pays best. Everything you pick grows back, given a little time.'];
    s.landT=(s.landT||0)+1;return tips[(hash(p.id)+s.landT)%tips.length];}
  if(t==='q:dice'){dice=null;if(s.trust<-15)return 'I do not play with people I cannot trust.';if(s.diceDay!==day()){s.diceDay=day();s.diceN=0;}
    if(s.diceN>=6)return 'That is enough for one day. I have a living to earn.';if(st.coins<5)return 'Five coins a throw. Come back when you have five coins to lose.';
    dice={id:p.id,me:roll(),stake:5};s.diceN++;const tot=dice.me[0]+dice.me[1];
    return 'Five coins a throw, highest pair takes it. You first. '+cap(pips(dice.me))+': '+tot+'. '+(tot>=10?'Hm.':tot<=4?'Ha.':'Not bad.')+' Stand on that, or double the stake before I throw?';}
  if(t==='q:stand'||t==='q:double'){if(!dice||dice.id!==p.id)return 'We have not thrown yet.';if(t==='q:double'&&st.coins>=dice.stake*2)dice.stake*=2;
    let them=roll();const mine=dice.me[0]+dice.me[1];while(them[0]+them[1]===mine)them=roll();const won=mine>them[0]+them[1],stake=dice.stake;dice=null;
    Q.coins(won?stake:-stake);Q.tell('coin',(won?'+':'−')+coins(stake));
    if(won){if(p.traits.temper>.7)s.trust=Math.max(-100,s.trust-1);return cap(pips(them))+'. '+(p.traits.temper>.7?'Luck. Nothing but luck. Take your '+coins(stake)+'.':p.voice==='wry'?'Well, there goes supper. '+cap(coins(stake))+' to you.':'Yours, fair and square. '+cap(coins(stake))+'.');}
    return cap(pips(them))+'. '+(p.voice==='kind'?'Oh, I am sorry. That is '+coins(stake)+' to me.':p.voice==='blunt'?'Mine. Pay up: '+coins(stake)+'.':'Mine, I think. '+cap(coins(stake))+', if you please.');}
  if(t==='q:riddle'){s.riddleT=(s.riddleT||0)+1;const k=(hash(p.id)+s.riddleT)%RIDDLES.length,o=k%3;riddle={id:p.id,k,order:[0,1,2].map(i=>(i+o)%3)};return RIDDLES[k][0];}
  if(/^q:r\d$/.test(t)){if(!riddle||riddle.id!==p.id)return 'I have forgotten what I asked.';const right=t==='q:r0',k=riddle.k;riddle=null;
    if(right){let extra='';if(s.riddleDay!==day()){s.riddleDay=day();s.trust=Math.min(100,s.trust+2);if(n.role==='jester'){Q.coins(3);Q.tell('coin','+3 coins');extra=' Three coins for the clever one!';}}
      return (n.role==='jester'?'Correct! A scholar walks among us.':'Yes! How did you know?')+extra;}
    return (n.role==='jester'?'Wrong, wrong, gloriously wrong. ':'No! ')+'It is '+RIDDLES[k][1].toLowerCase().replace('.','')+'.';}
  return null;}

/* ---------- the journal ---------- */
const css=document.createElement('style');css.textContent=`
#vg .q{padding:.55rem 0 .6rem;border-bottom:1px solid var(--rule)}
#vg .q:last-of-type{border-bottom:0}
#vg .q .qt{display:flex;align-items:baseline;gap:.5rem;font-size:1.15rem;line-height:1.2}
#vg .q .qt b{flex:none;display:inline-block;width:1.45rem;height:1.45rem;line-height:1.45rem;text-align:center;border-radius:50%;background:var(--wax);color:var(--waxhi);font-weight:400;font-size:.95rem}
#vg .q .qt small{color:var(--ink2);font-style:italic;font-size:.9rem}
#vg .q .qo{margin:.3rem 0 .1rem 1.95rem;font-size:1.05rem}
#vg .q .qh{margin:0 0 .35rem 1.95rem;color:var(--ink2);font-style:italic;font-size:.93rem;line-height:1.35}
#vg .q .qb{margin:.3rem 0 0 1.95rem;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
#vg .q .qb span{display:flex;align-items:center;gap:.3rem;color:var(--ink2);margin-right:auto}
#vg .qlog{color:var(--ink2);font-size:1rem;line-height:1.5;padding:.3rem 0}
#vgCompass{position:fixed;z-index:15;top:calc(8px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);width:min(420px,56vw);height:30px;display:none;pointer-events:none}
#vgQuest{position:fixed;z-index:15;top:calc(40px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);max-width:min(70vw,24rem);white-space:nowrap;display:none;margin:0;padding:.1rem .3rem;background:none;border:0;color:var(--fg);font:inherit;font-size:.95rem;font-style:italic;text-align:center;line-height:1.25;text-shadow:0 1px 4px #000,0 0 10px #000;cursor:pointer;touch-action:manipulation}
#vgQuest i{font-style:normal;color:#f2c860;margin-right:.35rem;font-size:.7em;vertical-align:.12em}
body:has(#vgWrap[style*="display: flex"]) :is(#vgQuest,#vgCompass),body:has(#wmap[style*="display: flex"]) :is(#vgQuest,#vgCompass){visibility:hidden}`;
document.head.appendChild(css);
function journal(){const d=data();let h='<div class="top"><h2>Journal</h2><div class="purse">'+Q.img('coin')+S().coins+' coins</div></div><h3>Tasks in hand</h3>';
  if(!d.active.length)h+='<div class="none">You have promised nothing to anyone. Ask people for the news to hear who needs a hand. Anyone nearby with work for you shows as a small ring on the compass.</div>';
  d.active.forEach((q,i)=>{const hint=hintOf(q),on=d.track===q.id;
    h+='<div class="q"><div class="qt"><b>'+(i+1)+'</b><span>'+q.title+' <small>for '+q.from+'</small></span></div><div class="qo">'+objective(q)+'</div>'+(hint?'<div class="qh">'+hint+'</div>':'')
      +'<div class="qb"><span>'+Q.img('coin')+coins(q.pay)+'</span><button type="button" data-q="track" data-id="'+q.id+'"'+(on?' disabled':'')+'>'+(on?'Following':'Follow')+'</button><button type="button" class="alt" data-q="drop" data-id="'+q.id+'">'+(dropAsk===q.id?'Really give up?':'Give up')+'</button></div></div>';});
  const n=folk().filter(m=>m.person&&d.known[m.person.id]&&available(m)).length;
  if(d.active.length&&n)h+='<div class="qlog">'+(n===1?'One more person':n+' more people')+' you know of '+(n===1?'has':'have')+' work for you. They are marked ! on the map.</div>';
  if(d.total)h+='<h3>Finished</h3><div class="qlog">'+d.log.slice().reverse().join(' · ')+(d.total>d.log.length?' · and '+(d.total-d.log.length)+' before that':'')+'</div>';
  return h;}
function click(act,id){const d=data(),q=d.active.find(a=>a.id===id);if(!q)return '';
  if(act==='track'){d.track=id;dropAsk=null;refresh();return 'Following: '+q.title+'.';}
  if(act==='drop'){if(dropAsk!==id){dropAsk=id;return q.first+' will be disappointed.';}dropAsk=null;abandon(q);return 'You let it go.';}return '';}

/* ---------- in the world: marks over heads, the lost locket, the line at the top of the screen ---------- */
const THREE=window.THREE,WHITE=new THREE.Color(1,1,1);
const tex=c=>{const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;};
const keepMat=new THREE.SpriteMaterial({map:tex(Q.ICON.keepsake),alphaTest:.5,fog:true});
const glintMat=new THREE.SpriteMaterial({map:(()=>{const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.fillStyle='#fff6d8';for(const [x,y,w,h] of [[7,1,2,14],[1,7,14,2],[5,5,6,6]])g.fillRect(x,y,w,h);return tex(c);})(),transparent:true,depthWrite:false,fog:true});
const KEEPS=new Map();   // task -> {sp,glint}
function dropKeep(q){const k=KEEPS.get(q);if(k){V.scene.remove(k.sp);V.scene.remove(k.glint);KEEPS.delete(q);}}
function keepFor(q){let k=KEEPS.get(q);if(k)return k;const y=V.groundH(q.spot[0],q.spot[1]);
  const sp=new THREE.Sprite(keepMat);sp.center.set(.5,0);sp.scale.set(.34,.34,1);sp.position.set(q.spot[0],y-.02,q.spot[1]);
  const glint=new THREE.Sprite(glintMat);glint.position.set(q.spot[0],y+.5,q.spot[1]);V.scene.add(sp);V.scene.add(glint);k={sp,glint};KEEPS.set(q,k);return k;}
const hud=document.createElement('button');hud.id='vgQuest';hud.type='button';hud.setAttribute('aria-label','Open your journal');document.body.appendChild(hud);
for(const ev of ['touchstart','mousedown'])hud.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
hud.addEventListener('click',()=>{if(V.started&&!G.modal&&!Q.view())Q.open('journal');});
const comp=document.createElement('canvas');comp.id='vgCompass';document.body.appendChild(comp);const cg=comp.getContext('2d');
let nearKeep=null,acc=1,clock=0,hinted=0,POINTS=[],trackLine='';
const nearest=(list,k)=>list.slice().sort((a,b)=>Math.hypot(a[0]-P.x,a[1]-P.z)-Math.hypot(b[0]-P.x,b[1]-P.z)).slice(0,k);
// where a task sends you: people (who move) or fixed spots. Nothing, while you are only gathering.
function targets(q){const g=who(q.id);if(q.type==='deliver'){const m=who(q.to);return m?[m]:[];}if(ready(q))return g?[g]:[];
  if(q.type==='hunt')return q.foe==='bandit'?(G.camp?[{x:G.camp[0],z:G.camp[1]}]:[]):nearest(G.dens||[],1).map(s=>({x:s[0],z:s[1]}));
  if(q.type==='find')return Math.hypot(q.area[0]-P.x,q.area[1]-P.z)<q.area[2]*.8?[]:[{x:q.area[0],z:q.area[1]}];
  if(q.type==='bring'&&q.item==='pelt')return nearest(G.dens||[],1).map(s=>({x:s[0],z:s[1]}));return [];}
function refresh(){if(!folk()[0]||!folk()[0].person)return;const d=data();POINTS=[];
  for(const q of d.active){if(q.type==='bring'){if(ready(q)){if(!q.told){q.told=true;Q.tell('scroll',q.title+': return to '+q.first+'.');}}else q.told=false;}
    for(const t of targets(q))POINTS.push({t,kind:d.track===q.id?'track':'task'});}
  for(const n of folk()){if(!n.person||n.sleep||n.down||n.dead)continue;const dd=Math.hypot(n.x-P.x,n.z-P.z);if(dd<45&&Math.abs(n.y-P.y)<8&&available(n)){d.known[n.person.id]=1;POINTS.push({t:n,kind:'giver'});}}
  const c=V.NPCS[0]&&V.NPCS[0].sp.material.color;if(c)keepMat.color.copy(c).lerp(WHITE,.55);
  const t=d.active.find(q=>q.id===d.track)||d.active[0];
  if(t&&V.started){let s=short(t);if(t.type==='find'&&!t.found&&!targets(t).length)s='Search here for a glint';s='<i>◆</i>'+s;if(hud.innerHTML!==s)hud.innerHTML=s;hud.style.display='block';}else hud.style.display='none';}
// a thin line of compass across the top: the four winds, and a mark for each place a task sends you
const HALF=1.75;
function compass(){const dpr=Math.min(2,window.devicePixelRatio||1),w=comp.clientWidth,h=30;if(!w)return;if(comp.width!==Math.round(w*dpr)){comp.width=Math.round(w*dpr);comp.height=h*dpr;}
  cg.setTransform(dpr,0,0,dpr,0,0);cg.clearRect(0,0,w,h);const b=-P.yaw,y=19;
  const at=a=>{let r=a-b;r=Math.atan2(Math.sin(r),Math.cos(r));const k=Math.abs(r)/HALF;return k>1?null:[w/2+r/HALF*(w/2-8),Math.min(1,(1-k)/.22)];};
  const line=cg.createLinearGradient(0,0,w,0);line.addColorStop(0,'rgba(240,230,207,0)');line.addColorStop(.18,'rgba(240,230,207,.7)');line.addColorStop(.82,'rgba(240,230,207,.7)');line.addColorStop(1,'rgba(240,230,207,0)');
  cg.shadowColor='rgba(0,0,0,.9)';cg.shadowBlur=4;cg.shadowOffsetY=1;cg.fillStyle=line;cg.fillRect(0,y,w,1);
  cg.textAlign='center';cg.textBaseline='alphabetic';
  for(let i=0;i<24;i++){const p=at(i*.2618);if(!p)continue;cg.globalAlpha=p[1]*(i%6?.55:1);cg.fillStyle='#f0e6cf';
    if(i%6===0){cg.font='14px Georgia,serif';cg.fillText('NESW'[i/6],p[0],y-5);}else cg.fillRect(Math.round(p[0]),y-(i%3?3:5),1,i%3?3:5);}
  for(const pt of POINTS){const t=pt.t,dx=t.x-P.x,dz=t.z-P.z,dd=Math.hypot(dx,dz);if(dd<2.5)continue;const p=at(Math.atan2(dx,-dz));if(!p)continue;const x=p[0];cg.globalAlpha=p[1];
    if(pt.kind==='giver'){cg.strokeStyle='#f0e6cf';cg.lineWidth=1.5;cg.beginPath();cg.arc(x,y+6,2.6,0,6.283);cg.stroke();continue;}
    const r=pt.kind==='track'?5.5:4;cg.fillStyle=pt.kind==='track'?'#f2c860':'#f0e6cf';cg.beginPath();cg.moveTo(x,y-r+6);cg.lineTo(x+r*.75,y+6);cg.lineTo(x,y+r+6);cg.lineTo(x-r*.75,y+6);cg.closePath();cg.fill();}
  cg.globalAlpha=1;cg.shadowColor='transparent';}
function tick(dt){if(!V.started)return;clock+=dt;acc+=dt;if(acc>.5){acc=0;refresh();}
  if(comp.style.display!=='block')comp.style.display='block';compass();
  nearKeep=null;
  for(const q of data().active){if(q.type!=='find'||q.found)continue;const dd=Math.hypot(q.spot[0]-P.x,q.spot[1]-P.z);
    if(dd>130){const k=KEEPS.get(q);if(k)k.sp.visible=k.glint.visible=false;continue;}
    const k=keepFor(q),tw=.5+.5*Math.sin(clock*3.1),s=(.35+.5*tw)*Math.min(1.6,.6+dd/40);k.sp.visible=true;k.glint.visible=true;k.glint.scale.set(s,s,1);k.glint.material.opacity=.35+.65*tw;
    if(dd<2.4&&!G.modal&&!Q.view())nearKeep=q;}
  if(nearKeep){const H=V.talkHint,B=V.talkBtn;H.textContent=V.coarse?'':'Press E to pick up the locket';H.style.color='';H.style.opacity=1;B.textContent='Take';if(V.coarse)B.style.display='block';}
  const d=data();if(!d.hint&&!d.total&&!d.active.length){hinted+=dt;if(hinted>25&&!G.modal&&!Q.view()){d.hint=true;Q.tell('scroll','Ask people for the news to find work.');Q.tell('scroll',V.coarse?'Your journal is in your bag.':'Press J for your journal.');}}}
const tick0=G.tick,use0=G.use;
G.tick=function(dt,T){tick0(dt,T);tick(dt);};
G.use=function(npc){if(nearKeep&&!G.modal&&!Q.view()){const q=nearKeep;nearKeep=null;q.found=true;Q.give('keepsake');dropKeep(q);Q.tell('keepsake','Found: '+q.first+'’s locket');refresh();Q.save();return true;}return use0(npc);};

/* ---------- on the map ---------- */
G.mapMarks=function(g,proj,fs,W,H){if(!folk()[0]||!folk()[0].person)return;const d=data(),r=Math.max(8,fs*.8),pulse=1+.2*Math.sin(performance.now()/260);
  g.textAlign='center';g.textBaseline='middle';
  const bang=(x,z)=>{const [px,py]=proj(x,z);g.fillStyle='rgba(46,28,16,.85)';g.beginPath();g.arc(px,py,r*.62,0,6.283);g.fill();g.fillStyle='#f2c860';g.font='bold '+Math.round(r*1.05)+'px Georgia,serif';g.fillText('!',px,py+1);};
  const seal=(x,z,i,solid,on)=>{const [px,py]=proj(x,z);if(on){g.strokeStyle='rgba(124,36,25,.6)';g.lineWidth=2;g.beginPath();g.arc(px,py,r*1.45*pulse,0,6.283);g.stroke();}
    g.beginPath();g.arc(px,py,r,0,6.283);if(solid){g.fillStyle='#7c2419';g.fill();g.strokeStyle='#f3e3bb';g.lineWidth=1.5;g.stroke();g.fillStyle='#f3e3bb';}else{g.fillStyle='rgba(236,222,186,.85)';g.fill();g.strokeStyle='#7c2419';g.lineWidth=2;g.stroke();g.fillStyle='#7c2419';}
    g.font=Math.round(r*1.25)+'px Georgia,serif';g.fillText(String(i),px,py+1);};
  for(const n of folk())if(n.person&&d.known[n.person.id]&&available(n))bang(n.x,n.z);
  d.active.forEach((q,ix)=>{const i=ix+1,on=d.track===q.id,giver=who(q.id),rd=ready(q);
    if(q.type==='deliver'){const m=who(q.to);if(m)seal(m.x,m.z,i,true,on);return;}
    if(!rd){
      if(q.type==='hunt')for(const s of q.foe==='bandit'?(G.camp?[G.camp]:[]):nearest(G.dens||[],3))seal(s[0],s[1],i,true,on);
      if(q.type==='find'){const [px,py]=proj(q.area[0],q.area[1]),[ex]=proj(q.area[0]+q.area[2],q.area[1]),pr=Math.max(r*1.6,Math.abs(ex-px));
        g.fillStyle='rgba(124,36,25,.16)';g.strokeStyle='#7c2419';g.lineWidth=2;g.setLineDash([6,5]);g.beginPath();g.ellipse(px,py,pr,pr*.6,0,0,6.283);g.fill();g.stroke();g.setLineDash([]);seal(q.area[0],q.area[1],i,true,on);}
      if(q.type==='bring'&&q.item==='pelt')for(const s of nearest(G.dens||[],1))seal(s[0],s[1],i,true,on);}
    if(giver)seal(giver.x,giver.z,i,rd,on&&rd);});
  const y=H-fs*1.3,txt='!  someone you know has work      ●  a task from your journal';g.textAlign='left';g.font='italic '+fs+'px "IM Fell English",Georgia,serif';g.lineWidth=3;g.strokeStyle='rgba(236,222,186,.9)';
  g.strokeText(txt,fs,y);g.fillStyle='#2e1c10';g.fillText(txt,fs,y);};
G.quests={options,choose,followups,journal,click,kill,data,available,make,ready,refresh};
})();
