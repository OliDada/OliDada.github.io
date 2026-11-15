/* People belong to this world: knowledge travels between actual acquaintances,
   routines yield to danger, and identities/memories survive a saved game. */
(function(){
'use strict';
const V=window.__valley,G=V.GAME,C=window.ValleyPeopleCore,A=G.socialAccess;
if(!A||!C)return;
const people=V.NPCS.filter(n=>n.anim==='person'),byId=new Map();
let ready=false,elapsed=0,lastTod=null,current=null,line='',topic='hello';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=()=>{const s=G.state();if(!s.social||s.social.version!==1)s.social={version:1,time:V.DN.tod,serial:0,people:{}};return s.social;};
const memory=n=>C.state(data().people,n.person.id),day=()=>Math.floor(data().time);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const safe=n=>!n.down&&!n.dead&&!n.sleep&&!n.foe&&!n.hunt&&!n.avenge&&!n.rep;
function init(){if(ready)return;ready=true;
 for(const n of people){n.person=C.identity(n);byId.set(n.person.id,n);n.workplace=(n.origin||n.home||[n.x,n.z]).slice();n.originalHome=n.home.slice();n.originalType=n.type;n.originalRadius=n.radius;n.activity=n.person.job==='child'?'playing':n.shop?'tending the shop':n.type==='patrol'?'on the road':'at work';
   n.bold=n.person.traits.courage>.57;n.hot=n.person.traits.temper>.65;
   if(!n.homeF&&!n.wall&&!n.foe&&n.fixedY===undefined&&n.type!=='patrol'){
     const f=V.FLOORS.filter(f=>f.bed&&f.door&&f.doorIn&&!f.inn&&!f.upper&&(f.occ||0)<3&&V.inCourt(f.x,f.z)===!!n.court&&Math.hypot(f.x-n.x,f.z-n.z)<110).sort((a,b)=>Math.hypot(a.x-n.x,a.z-n.z)-Math.hypot(b.x-n.x,b.z-n.z))[0];
     if(f){n.homeF=f;n.seatI=f.occ||0;f.occ=(f.occ||0)+1;}}
 }
 const homes=new Map();for(const n of people){if(!n.homeF)continue;let group=homes.get(n.homeF);if(!group)homes.set(n.homeF,group=[]);group.push(n);}
 for(const [f,group] of homes){const family=group.map(n=>n.person.id).sort()[0],adults=group.filter(n=>n.role!=='child');const surname=C.identity({role:'family',personId:family,origin:[f.x,f.z]}).surname;
   for(const n of group){n.person.surname=surname;for(const other of group)if(other!==n)n.person.family.push({id:other.person.id,kind:n.role==='child'?(other.role==='child'?'sibling':adults.indexOf(other)<2?'parent':'relative'):(other.role==='child'?(adults.indexOf(n)<2?'child':'relative'):(adults.indexOf(n)<2&&adults.indexOf(other)<2?'partner':'sibling'))});}}
 // Unhoused travellers and sentries still have family ties, without pretending they share a bed.
 const unpaired=people.filter(n=>!n.person.family.length&&!n.foe);
 for(let i=0;i<unpaired.length;i++){const n=unpaired[i];if(n.person.family.length)continue;const kin=unpaired.slice(i+1).filter(m=>!m.person.family.length&&!!m.court===!!n.court&&distance(n,m)<240).sort((a,b)=>distance(n,a)-distance(n,b))[0];if(kin){n.person.family.push({id:kin.person.id,kind:'cousin'});kin.person.family.push({id:n.person.id,kind:'cousin'});kin.person.surname=n.person.surname;}}
 const used=new Set();for(const n of people){let name=n.person.first+' '+n.person.surname;const start=C.hash(n.person.id+'second')%C.names.length;for(let i=0;used.has(name)&&i<C.names.length;i++){n.person.first=C.names[(start+i)%C.names.length];name=n.person.first+' '+n.person.surname;}used.add(name);n.name=name;n.first=n.person.first;C.recover(n.person,memory(n),data().time);}

 for(const n of people){const candidates=people.filter(m=>m!==n&&!m.foe&&!n.foe&&!C.relation(n.person,m.person.id)&&!!m.court===!!n.court&&distance(n,m)<180).sort((a,b)=>friendScore(n,a)-friendScore(n,b));
   for(const m of candidates.slice(0,2)){if(!C.relation(n.person,m.person.id))n.person.friends.push({id:m.person.id,kind:'friend'});if(!C.relation(m.person,n.person.id))m.person.friends.push({id:n.person.id,kind:'friend'});}}
}
function friendScore(n,m){return distance(n,m)+80*Math.abs(n.person.traits.sociability-m.person.traits.sociability);}
function remember(n,event){if(n&&n.person)C.remember(memory(n),event);}
function event(kind,targets,detail={}){init();const d=data(),id='e'+(++d.serial);for(const n of new Set(targets.filter(Boolean)))remember(n,{id,kind,at:d.time,impact:detail.impact??(kind==='assault'?-40:-15),subject:detail.subject||null,source:null,heard:false});return id;}
function crime(ws,o){const victim=o.victim||o.owner;const targets=ws.concat(o.victim?[o.victim]:[]);event(o.violent?'assault':'theft',targets,{subject:victim?.person?.id});}
function reaction(n,o){return C.response(n.person,memory(n),{...o,law:/^(guard|soldier)$/.test(n.role)});}
function related(n,victim){return victim&&!!C.relation(n.person,victim.person?.id);}
const tone=(n,lines)=>lines[n.person.voice]||lines.thoughtful;
function greeting(n){const s=memory(n),m=C.salient(s),who=m?.subject&&byId.get(m.subject),source=m?.source&&byId.get(m.source);
 if(!G.sheathed)return n.person.traits.courage>.6?'Put the blade away. We can speak without it.':'Please put that away first. You are making me nervous.';
 if(m&&m.impact<0&&s.trust<0){if(m.heard)return `${source?.first||'Someone I trust'} told me ${m.kind==='assault'?'you hurt '+(who?.first||'someone here'):'what happened'}. I would like to hear your side.`;
   if(m.kind==='assault')return who===n?'I remember your blade. Keep your distance.':`I saw what you did${who?' to '+who.first:''}. I have not forgotten.`;
   return 'I saw you taking what was not yours. Have you come to put things right?';}
 if(m&&m.kind==='kindness'&&data().time-m.at<1)return tone(n,{kind:'Thank you again for sharing your food. Have you had enough yourself?',blunt:'That food was welcome. Thank you.',reserved:'I appreciated what you shared.',wry:'You arrive bearing food once and I start looking forward to your visits.',thoughtful:'I remember your kindness. Thank you.'});
 const d=s.dialogue;if(d?.promise?.status==='open'&&d.promise.overdue)return 'I waited for you yesterday. If you cannot bring the food, just tell me.';
 if(d?.promise?.status==='open')return 'Good to see you. Were you able to find something to eat?';
 if(d?.promise?.status==='kept'&&data().time-d.promise.at<1)return 'You kept your word about the food. That meant something to me.';
 if(s.met&&s.trust>=0&&d?.lastTopic==='ambition')return 'I have been thinking about what we spoke of. It was good to have someone hear it.';
 if(s.trust>25)return tone(n,{kind:'There you are. It is good to see a familiar face.',blunt:'You again. Good. Someone I can rely on.',reserved:'I hoped you might stop by.',wry:'I was beginning to think the road had swallowed you.',thoughtful:'It is good to see you back. How has the road treated you?'});
 if(s.met)return tone(n,{kind:'Hello again. Have you eaten?',blunt:'Back again? What is on your mind?',reserved:'Hello again.',wry:'Still here? The valley has that effect on people.',thoughtful:'We have met. How are you finding the valley?'});
 return tone(n,{kind:`A new face. I am ${n.first}. You are welcome to stop a while.`,blunt:`${n.first}. If you need something, ask.`,reserved:`I am ${n.first}. Hello.`,wry:`${n.first}, at your service. Within reason.`,thoughtful:`I am ${n.first}. Have you come far?`});}
const workLines={baker:'The dough decides when I get up. Cold mornings mean a longer wait before the first loaves.',greengrocer:'I buy what is fresh and sell it before it is not. A bruise on an apple matters more than a fine speech.',draper:'Good cloth takes patience. People notice the colour first; I look at the stitching.',herbalist:'Knowing a plant is easy. Knowing when to leave it growing takes longer.',innkeeper:'A fire, a meal, a bed. People tell you things while they wait for all three.',watchkeeper:'I keep watch. Most days that means noticing trouble before it becomes someone else’s grief.',soldier:'Drill, watch, mend the straps. There is more waiting than glory.',blacksmith:'Iron tells you when it is ready. Listen to it, and keep your hands clear.',woodcutter:'I leave the young trees. Someone will need this wood after I am gone.',farmer:'The fields do not care whether I slept well. There is always another row.',shepherd:'I count them in the morning and again before dark. You learn each one’s foolishness.',fisher:'Some days I catch supper. Other days I come home with a story about the one that got away.',priest:'Mostly I listen. People need that more often than they need advice.',child:'I am supposed to stay near home. There are interesting things just a little farther away.',traveller:'I follow the roads. The trick is knowing where to stop before dark.',weaver:'One thread is nothing. Enough of them, handled carefully, keep a family warm.',gardener:'Weeding, mostly. Everyone admires the flowers; nobody admires the weeding.',mender:'Bring me something worn and I look for what is still sound.',carter:'I carry what other people cannot. My back knows every rut in the road.',launderer:'Water, soap, and a great deal of work. Clean clothes do not happen by wishing.',trader:'I make my living noticing what people need.'};
function familyLine(n){const relations=n.person.family.map(r=>({r,n:byId.get(r.id)})).filter(x=>x.n);if(!relations.length)return 'My family are beyond these hills. Some days the distance feels longer than others.';
 const {r,n:kin}=relations[0],m=memory(n).memories.find(e=>e.subject===kin.person.id&&e.impact<0);
 if(m)return `${kin.first} is my ${r.kind}. ${m.heard?'I heard what happened.':'I was there.'} Of course it matters to me.`;
 return `${kin.first} is my ${r.kind}. ${kin.sleep?'They will be asleep now.':kin.activity==='visiting a friend'?'Probably off seeing a friend.':kin.person.job==='child'?'They are always finding some new thing to ask about.':'They work as '+(/^[aeiou]/.test(kin.person.job)?'an ':'a ')+kin.person.job+'.'} `+tone(n,{kind:'We look after one another.',blunt:'We disagree. We still look after our own.',reserved:'I do not say it often, but they matter to me.',wry:'They know exactly how to annoy me. It is a family talent.',thoughtful:'It is easier to belong somewhere when someone notices you are late.'});}
function answer(n,t){const s=memory(n),p=n.person;
 if(t==='hello'||!G.sheathed)return greeting(n);
 if(t==='work'&&n.deliveryReason)return 'I am '+n.deliveryReason+'. '+(n.errand?'I follow the castle road, leave the goods with the gatekeeper, then head back to the village.':'That is part of my daily round. The climb takes longer than the business at the gate.');
 if(t==='work')return (workLines[p.job]||'I help keep things in order. There is more to it than people think.')+' '+(n.activity==='visiting a friend'?'I have put it aside for a little company.':C.phase(p,V.DN.tod)==='eve'?'But the day’s work can wait until tomorrow.':'');
 if(t==='family')return familyLine(n);
 if(t==='friends'){const friend=byId.get(p.friends[0]?.id);return friend?`${friend.first} and I are friends. ${friend.sleep?'I would let them sleep just now.':friend.activity==='visiting a friend'?'They have gone looking for company.':`You may find them near ${V.inCourt(friend.x,friend.z)?'the castle':Math.hypot(friend.x-V.TOWN_C[0],friend.z-V.TOWN_C[1])<150?'the lake town':'their work'}.`} `+tone(n,{kind:'They have been kind to me.',blunt:'We can disagree without making enemies.',reserved:'We do not have to talk all the time.',wry:'Do not believe every story they tell about me.',thoughtful:'It is good to have someone who knows you.'}):'I know faces here. Friendship takes a little longer.';}
 if(t==='thoughts')return tone(n,{kind:`I was thinking about ${p.interest}. Little things can carry a whole day.`,blunt:`${p.interest[0].toUpperCase()+p.interest.slice(1)}. More worth talking about than court gossip.`,reserved:`Mostly ${p.interest}. I keep my thoughts to myself, usually.`,wry:`${p.interest[0].toUpperCase()+p.interest.slice(1)}. You did ask.`,thoughtful:`I keep coming back to ${p.interest}. Funny what stays with a person.`});
 if(t==='apology'){const m=[...s.memories].reverse().find(e=>e.impact<0);if(!m)return 'There is nothing between us that needs an apology.';if(s.apologized===m.id)return 'You have said that. Give it time, and let your actions speak.';s.apologized=m.id;s.trust=Math.min(10,s.trust+3+Math.round(p.traits.warmth*5));return p.traits.temper>.6?'I heard you. That does not make it right.':'Thank you for saying so. I will need time. An apology does not settle what you owe the watch.';}
 if(t==='gift'){if(s.lastGift===day())return 'You have already shared something today. Keep the rest for yourself.';if(s.trust<-15)return 'Keep it. I am not ready for gifts from you.';const food=['bread','apple','cheese','berries'].find(k=>A.count(k)>A.hot(k));if(!food)return 'You have no food of your own to share.';A.take(food,1,false);s.lastGift=day();event('kindness',[n],{impact:4+Math.round(p.traits.warmth*4)});return tone(n,{kind:'For me? Thank you. That was thoughtful.',blunt:'Thank you. I had forgotten to stop and eat.',reserved:'That is kind of you. Thank you.',wry:'You have discovered the shortest way to my good side.',thoughtful:'Thank you. I will remember the kindness.'});}
 return greeting(n);
}
// Conversations have a subject and follow-ups, rather than a row of unrelated facts.
const lives={
 fisher:[['My father taught me to mend nets before he let me touch a rod. I thought it was a punishment. Now I spend half my time mending nets.','I would like a boat of my own. Nothing grand. One that does not take on water when I lean over.','I keep checking the knots even when I know they are sound. My father did that too.'],['I used to carry the catch to market. Started staying by the water longer than I needed to. Eventually I stopped carrying anyone else’s fish.','A dry roof over the tackle would do me. I am tired of laying everything out beside the bed.','When the water is quiet I forget how long I have been standing here. Then I go home late again.']],
 farmer:[['I worked this soil beside my mother. She could tell where we were in the field with her eyes shut, just by the stones.','I want enough put aside that one bad harvest does not decide the whole winter.','I find myself checking the sky in the middle of a conversation. I know it is rude.'],['I married into the work. Thought I knew what a long day was before that.','I would like to leave one corner fallow without worrying about what it costs us.','I sometimes envy people who can finish a job and put it down.']],
 blacksmith:[['My first master made me straighten nails for a month. I still have one of them. It is not very straight.','I want to make one fine piece with no customer leaning over my shoulder.','I hear the hammer in my head when I am trying to sleep.']],
 woodcutter:[['I learned by carrying wood for someone twice my age. They could fell a tree in the time I spent choosing one.','A better axe handle. I can mend this one again, but I would rather not have to.','I count the trees I leave standing. Nobody pays me for those.']],
 shepherd:[['I was given the slowest ewe to mind as a child. Lost her on the first afternoon. Found her asleep behind the house.','I would like one whole night without waking to listen for the flock.','There is always one that waits until I look away. I know which one. It still works.']],
 baker:[['I burned my first batch and scraped the bottoms instead of admitting it. My family ate very quietly that evening.','An oven that heats evenly. I turn every loaf by hand in this one.','I give away the misshapen loaves. I tell myself they would not sell anyway.']],
 innkeeper:[['I used to think keeping an inn meant meeting people. Mostly it means washing up after them. I do like the people, though.','I would like to sit at one of my own tables for an evening and let someone else mind the door.','I remember what people drink more easily than their names. I am not proud of that.']],
 watchkeeper:[['I took the work for the steady pay. I stayed because someone ought to notice who has not come home.','A quiet watch, and someone who turns up on time to relieve me.','I check the same corners twice. Once I did not, and it has bothered me since.']],
 soldier:[['The first time I stood watch I jumped at a bucket falling over. Nobody has let me forget it.','I would like to finish a season with no new names to remember for the wrong reasons.','I mend my straps before I eat. It annoys people waiting for me at supper.']],
 child:[['I used to be frightened of the geese. I am not now. Except the big one.','I want to see the lake from a boat. From the middle, not just the edge.','I hide interesting stones in my pockets. They get found on washing day.']],
 weaver:[['I learned at home. For a long time everything I made came out narrower at one end.','I am saving the best scraps for something I do not have to sell.','I notice loose threads on people’s sleeves while they are talking.']],
 mender:[['People started bringing me things after I fixed my own coat. I wish they had seen the inside of it first.','I would like enough good thread that I do not have to match the colour by candlelight.','I keep buttons I will probably never use. Throwing one away feels wasteful.']],
 herbalist:[['I learned the useful plants one at a time. The names came later. I remember who first showed me each one.','A dry cupboard with a door that shuts properly. Damp ruins more work than people think.','I smell a leaf before I remember I have picked it up.']],
 traveller:[['I meant to be away for a few weeks. Then there was another road, and another reason not to turn back yet.','I would like somewhere to return to without feeling I ought to leave again.','I keep a place in my bag for things I never end up buying.']]
};
const ordinary=[['I started by helping at home. People kept asking, so after a while it became what I did.','I would like a little money put by without something breaking the next morning.','I mend things longer than I should. I dislike giving up on them.'],['I tried other work first. This suited my hands better. I wish I had discovered that sooner.','I would like an evening with nothing waiting to be finished.','I start jobs before I have found all the things I need. Then I spend half the morning looking.']];
function dialogueState(n){const s=memory(n);return s.dialogue||(s.dialogue={heard:[],lastTopic:null,listenedDay:-1,promise:null});}
function life(n){const list=lives[n.person.job]||ordinary;return list[C.hash(n.person.id+':life')%list.length];}
function confidant(n){return memory(n).trust>=5||(memory(n).trust>=0&&n.person.traits.warmth>.7);}
function relative(n){const r=n.person.family[0];return r&&{...r,person:byId.get(r.id)};}
function relationshipStory(n,other){const key=[n.person.id,other.person.id].sort().join('|');return [
 `We once spent half a morning looking for a missing key. ${other.first} was certain I had it. It was in the door. Neither of us mentions it now.`,
 `${other.first} notices when I go quiet. Sometimes I want to be left alone, but I am glad someone notices.`,
 `We disagree about money. ${other.first} thinks I worry too much. Perhaps I do. We still share what we have.`,
 `We do not always have much to say. I can sit beside ${other.first} without having to fill the silence.`
 ][C.hash(key)%4];}
function followup(n,t){const s=memory(n),d=dialogueState(n),p=n.person,k=relative(n),friend=byId.get(p.friends[0]?.id);
 if(s.trust<-15&&['background','ambition','private','kinstory','friendstory','concern'].includes(t))return greeting(n)+' I am not ready for a friendly conversation.';
 if(t==='background')return life(n)[0];
 if(t==='ambition')return life(n)[1];
 if(t==='private')return confidant(n)?life(n)[2]:tone(n,{kind:'Perhaps when we know each other a little better.',blunt:'That is rather personal. We have only just met.',reserved:'I would rather keep that to myself.',wry:'You do not waste time on small talk, do you? Ask me another day.',thoughtful:'I do not know you well enough to talk about that yet.'});
 if(t==='kinstory')return k?.person?(confidant(n)?relationshipStory(n,k.person):`${k.person.first} is important to me. I would rather not discuss our private business with someone I hardly know.`):'They live beyond the valley. I would rather tell you about them when we have more time.';
 if(t==='friendstory')return friend?relationshipStory(n,friend):'I am still getting to know people here. It takes me a while.';
 if(t==='concern'){const bad=[...s.memories].reverse().find(e=>e.impact<0);if(bad&&s.trust<0)return greeting(n);if(d.promise?.status==='open')return 'You said you would bring something to eat. I have not forgotten.';if(s.lastGift===day())return 'You have already helped with supper. I can manage the rest today.';return p.job==='child'?'I want to explore, but I do not want to worry anyone at home. Both things at once.':life(n)[1];}
 if(t==='listen'){if(d.listenedDay!==day()&&s.trust>=0){d.listenedDay=day();s.trust=Math.min(40,s.trust+2);}return tone(n,{kind:'Thank you for hearing me out. I did not mean to keep you.',blunt:'Well. It helps to say it aloud, I suppose.',reserved:'Thank you. I do not usually talk this much.',wry:'You have been very patient. Most people have found an excuse to leave by now.',thoughtful:'I appreciate you listening. You do not have to fix it for me.'});}
 if(t==='help'){if(s.trust<-15)return 'I need some distance from you. Start with that.';if(s.lastGift===day())return 'You have done enough for today. Keep something for yourself.';if(d.promise?.status==='open')return 'Just the food you mentioned. Bread, an apple, anything you can spare.';return p.job==='child'?'An apple would be nice. Only if you have a spare one.':'If you have some food to spare, I would be grateful. I have not stopped to eat.';}
 if(t==='promise'){if(s.trust<-15||s.lastGift===day())return 'There is no need to promise me anything just now.';if(d.promise?.status==='open')return 'You already said you would. I will leave it with you.';d.promise={status:'open',at:data().time};return 'Thank you. If you cannot manage it, come and tell me. I would rather know.';}
 if(t==='release'){if(d.promise?.status==='open'){d.promise.status='released';return p.traits.warmth>.4?'All right. Thank you for telling me. I will sort something out.':'All right. Next time, be sure before you promise.';}return 'You do not owe me anything.';}
 if(t==='return')return 'What else did you want to ask?';
 if(t==='more')return 'Go on. I am listening.';
 return null;
}
function choices(n){const d=dialogueState(n),s=memory(n),k=relative(n),friend=byId.get(n.person.friends[0]?.id);let opts;
 if(['work','background','ambition','private'].includes(topic))opts=[['background','How did you get into this work?'],['ambition','What would you like to change?'],['private','What do most people not know about you?'],['return','Ask about something else.']];
 else if(['family','kinstory','friends','friendstory'].includes(topic))opts=[...(k?.person?[['kinstory',`What are you and ${k.person.first} like together?`]]:[]),...(friend?[['friendstory',`How do you get along with ${friend.first}?`]]:[]),['listen','Thank you for telling me.'],['return','Ask about something else.']];
 else if(['thoughts','concern','listen'].includes(topic))opts=[['concern','Is something worrying you?'],['help','Is there anything I can do?'],['listen','I am happy to listen.'],['return','Ask about something else.']];
 else if(['help','promise','gift','release','more','apology'].includes(topic)){
 opts=[];const food=['bread','apple','cheese','berries'].find(k=>A.count(k)>A.hot(k));
 if(food&&s.lastGift!==day()&&s.trust>=-15)opts.push(['gift',`Share ${food==='berries'?'some berries':food==='bread'?'a loaf of bread':food==='cheese'?'some cheese':'an apple'}.`]);
 if(d.promise?.status==='open')opts.push(['release','I cannot bring that food after all.']);else if(s.lastGift!==day()&&s.trust>=-15)opts.push(['promise','I will bring you something to eat.']);
 if(s.memories.some(e=>e.impact<0))opts.push(['apology','I am sorry for what happened.']);
 if(n.shop)opts.push(['trade','Show me what you have for sale.']);
 opts.push(['return','Ask about something else.']);
 }else opts=[['work','What do you do here?'],['family','Do you have family in the valley?'],['thoughts','How have things been lately?'],[n.shop?'more':'help',n.shop?'May we trade, or can I help?':'Can I do anything for you?']];
 return opts.filter(([key])=>key!==topic);
}
function choose(n,t){const d=dialogueState(n),giftedBefore=memory(n).lastGift;topic=t;
 if(!G.sheathed){line=greeting(n);A.save();return;}
 const detailed=followup(n,t);line=detailed===null?answer(n,t):detailed;
 if(t==='gift'&&giftedBefore!==day()&&memory(n).lastGift===day()&&d.promise?.status==='open'){d.promise.status='kept';d.promise.at=data().time;memory(n).trust=Math.min(100,memory(n).trust+3);line+=' You remembered what you promised. Thank you.';}
 if(['background','ambition','private','kinstory','friendstory','concern'].includes(t)){
 if(d.heard.includes(t)&&t!=='private')line='As I was saying, '+line.charAt(0).toLowerCase()+line.slice(1);else if(t!=='private'||confidant(n))d.heard.push(t);
 d.lastTopic=t;}
 A.save();
}

function updatePromise(n){const s=memory(n),promise=s.dialogue?.promise;if(promise?.status==='open'&&!promise.overdue&&data().time-promise.at>1){promise.overdue=true;s.trust=Math.max(-100,s.trust-2);}}
function meet(n){updatePromise(n);if(current)current.conversing=false;current=n;n.conversing=true;topic='hello';line=answer(n,topic);const s=memory(n);s.met=true;if(s.lastChat!==day()){s.lastChat=day();s.visits++;if(G.sheathed&&s.trust>=0&&s.trust<15)s.trust=Math.min(15,s.trust+1);}A.save();}
function panel(n){if(current!==n)meet(n);const opts=choices(n);
 return '<div class="dialogue-head"><h2>'+esc(n.name)+'</h2><button type="button" data-close="1" aria-label="End conversation">Farewell'+(!V.coarse?' <small>Esc</small>':'')+'</button></div><p class="conversation" aria-live="polite">'+esc(line)+'</p><div class="topics" aria-label="Conversation choices">'+opts.map(([k,label],i)=>'<button type="button" '+(k==='trade'?'data-trade="1"':'data-topic="'+k+'"')+(!V.coarse?' data-dialog-key="'+(i+1)+'" aria-keyshortcuts="'+(i+1)+'"':'')+'>'+(!V.coarse?'<span class="dialog-key" aria-hidden="true">'+(i+1)+'</span>':'')+'<span>'+esc(label)+'</span></button>').join('')+'</div>';}

function trade(n){if(!n?.person)return;const s=memory(n);if(s.lastTrade===day())return;s.lastTrade=day();event('trade',[n],{impact:2});}
function socialize(){const d=data();for(const n of people){updatePromise(n);C.recover(n.person,memory(n),d.time);if(!safe(n))continue;
 for(const r of n.person.family.concat(n.person.friends)){const m=byId.get(r.id);if(!m||!safe(m)||distance(n,m)>5||Math.abs(n.y-m.y)>2)continue;
   const e=[...memory(n).memories].reverse().find(e=>!e.heard&&e.impact<0&&d.time-e.at<3);if(e&&n.person.traits.sociability>.25)remember(m,{...e,source:n.person.id,heard:true,impact:Math.round(e.impact*(r.kind==='friend'?.35:.55))});
 }} }
function weaponLine(n){return n.role==='child'?(n.person.traits.sociability>.6?'Why have you got your sword out?':'Please do not bring that near me.'):tone(n,{kind:'We can talk. There is no need for the blade.',blunt:'Sheathe it. You are frightening people.',reserved:'Please put that away.',wry:'Expecting the bread to fight back? Put it away.',thoughtful:'A drawn sword makes it difficult to trust a stranger.'});}
function homeLine(n){const s=memory(n);if(s.trust>10)return tone(n,{kind:'Come in. Mind the things by the door.',blunt:'You know where the door is. Shut it behind you.',reserved:'You may come in.',wry:'Come in, then. You are letting the weather in.',thoughtful:'There is room for a familiar face.'});return n.person.traits.warmth>.65&&s.trust>=0?'Hello? Did you need something? This is our home.':n.person.traits.courage>.55?'This is our home. Ask before you come in.':'Please wait outside. I do not know you.';}
// Delivery work follows the actual switchback road, in both directions.
let greetingWait=10,deliveryWorkers=null;
function passing(dt){greetingWait-=dt;if(greetingWait>0||current||!A.ambient)return;
 const n=people.find(n=>safe(n)&&!n.conversing&&distance(n,V.P)<7&&distance(n,V.P)>2&&(n.lastHail===undefined||data().time-n.lastHail>.08)&&n.person.traits.sociability>.35);
 if(!n)return;
 const text=n.errand?'I have a delivery for the castle. A long climb today.':memory(n).trust<0?'I remember you. Best keep moving.':memory(n).met?'Good to see you again.':tone(n,{kind:'Good day. There is room on the road for both of us.',blunt:'Morning. Mind your footing on the hill.',reserved:'Good day.',wry:'If you are climbing that hill, save your breath.',thoughtful:'A fine day to be out walking.'});
 if(A.ambient(n,text)){n.lastHail=data().time;greetingWait=18+C.hash(n.person.id)%17;n.face=Math.atan2(V.P.x-n.x,V.P.z-n.z);}
}
function deliveries(){if(!V.roads?.castle)return;
 const workers=deliveryWorkers||(deliveryWorkers=people.filter(n=>!n.court&&!n.shop&&!n.wall&&!n.foe&&n.fixedY===undefined&&n.type!=='patrol'&&Math.hypot(n.workplace[0]-V.V[0],n.workplace[1]-V.V[1])<100&&!/child|guard|soldier/.test(n.role)).slice(0,4));
 workers.forEach((n,i)=>{if(!safe(n)||n.conversing)return;
  const start=.32+i*.065,t=V.DN.tod;
  if(!n.errand&&t>=start&&t<start+.035&&n.deliveryDay!==day()&&!n.drive&&!n.route){
   n.sit=false;n.deliveryDay=day();n.errand={index:0,back:false,wait:0};n.deliveryReason=['delivering vegetables to the castle kitchen','taking repaired harness to the garrison','bringing clean linen to the great hall','collecting the kitchen’s empty baskets'][i];n.activity=n.deliveryReason;
  }
  const e=n.errand;if(!e||n.drive)return;
  if(e.wait&&data().time<e.wait)return;
  const road=V.roads.castle,points=road.filter((_,j)=>j%8===0).concat([road.at(-1)]);
  const path=e.back?points.slice().reverse():points;
  if(e.index>=path.length){if(!e.back){e.back=true;e.index=0;e.wait=data().time+.025;n.activity='finishing business at the castle gate';return;}n.errand=null;n.activity='back from the castle';n.routineTarget=null;n.phaseR=null;A.halt(n);return;}
  const dest=path[e.index];n.activity=e.back?'returning from the castle':n.deliveryReason;
  A.go(n,dest[0],dest[1],2,m=>{A.halt(m);if(m.errand)m.errand.index++;});
 });
}
function routines(){for(const n of people){if(!safe(n)||n.errand||n.conversing||n.wall||n.fixedY!==undefined||n.type==='patrol'||n.drive||n.route||n.sit)continue;const p=n.person,ph=C.phase(p,V.DN.tod);
 if(ph!=='day'){n.routinePhase=ph;n.activity=ph==='eve'?'home for supper':'resting';continue;}
 const hour=V.DN.tod,visit=!n.shop&&!/guard|soldier/.test(n.role)&&hour>.60+p.offset&&hour<.67+p.offset&&p.traits.sociability>.35;
 const friend=visit&&byId.get(p.friends[0]?.id);const dest=friend&&safe(friend)&&distance(n,friend)<55&&V.floorH(friend.x,friend.z)<-1e8?[friend.x,friend.z]:n.workplace;
 const activity=dest===n.workplace?(n.role==='child'?'playing':n.shop?'tending the shop':'at work'):'visiting a friend';n.activity=activity;
 const target=activity+':'+day();if(n.routineTarget===target&&n.routinePhase===ph)continue;n.routineTarget=target;n.routinePhase=ph;
 if(Math.hypot(n.x-dest[0],n.z-dest[1])<3)continue;
 n.sit=false;A.go(n,dest[0],dest[1],2,m=>{A.halt(m);m.activity=activity;m.phaseR='day';});n.driveT=35;
 }}
const tick=G.tick;
G.tick=function(dt,T){tick(dt,T);if(!V.started)return;if(!ready)init();const d=data();if(lastTod!==null){let change=V.DN.tod-lastTod;if(change<-.1)change+=1;if(change>0)d.time+=change;}lastTod=V.DN.tod;
 passing(dt);elapsed+=dt;if(elapsed<2||G.modal)return;elapsed=0;socialize();deliveries();routines();};
G.social={init,panel,meet,weaponLine,homeLine,willTrade(n){return memory(n).trust>=-35;},end(){if(current)current.conversing=false;current=null;},topic:choose,choices,trade,crime,reaction,related,phase(n,t){return n.person?C.phase(n.person,t):(t>=.27&&t<.77?'day':t>=.77&&t<.88?'eve':'night');},memory,all:people};
})();
