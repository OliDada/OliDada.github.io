/* The Blight — act one.
   Refugees from Ashford camp by the village; the king hears of it and sends you east; Ashford is ash, a priest stayed,
   and what you find there says the Old Wood was a wall and the wall is failing. The act ends at Old Wenna's door.
   State lives in the saved game under `story`. Dialogue goes through people.js like every other conversation:
   options starting with "s:" are ours. */
(function(){
'use strict';
const V=window.__valley,G=V.GAME,Q=G.qa;
if(!Q||!G.social||!V.WD)return;
const P=V.P,S=()=>G.state();
const data=()=>{const s=S();if(!s.story||s.story.v!==1)s.story={v:1,stage:'start',clues:{},seen:{},t:0};return s.story;};
const PL=id=>V.WD.places.find(p=>p.id===id);
const ASH=PL('ashford'),CAMP=PL('camp'),HEART=PL('heart');
const byStory=k=>V.NPCS.find(n=>n.story===k);
const king=()=>V.NPCS.find(n=>n.role==='king');
const wenna=()=>V.NPCS.find(n=>n.role==='witch');
const say=(a,b)=>V.say(a,b);

/* ---------- the people of the story keep their own names ---------- */
const NAMES={maud:['Maud','Maud Fletcher'],refugee1:['Hob','Hob Fletcher'],refugee2:['Wat','Wat the carter'],aldous:['Aldous','Father Aldous'],survivor:['Edda','Edda Rooke']};
let named=false;
function nameThem(){if(named||!V.NPCS.some(n=>n.person))return;named=true;
  const ROLE={king:['Aldric','King Aldric'],queen:['Maren','Queen Maren'],witch:['Wenna','Old Wenna']};
  for(const n of V.NPCS){const nm=n.story&&NAMES[n.story]||ROLE[n.role];if(!nm)continue;const [f,full]=nm;n.first=f;n.name=full;if(n.person)n.person.first=f;}}

/* ---------- the stages ---------- */
// each: what the journal says, where the compass points, the short line under it
const STAGES={
  road:{title:'The road west',text:'Ashford burned in the night. You got Maud Fletcher and her boys out through the west gate. The road was thick with hounds, so you went south and round through the forest, and everyone who could still walk has walked until morning. The valley is over the rise.',goal:'Walk with the others to the valley',to:()=>[CAMP]},
  start:{title:'The road west',text:'The others have stopped in a meadow east of the village, as far as their legs would carry them. Maud wants a word.',goal:'Speak to Maud',to:()=>[byStory('maud')]},
  tell:{title:'The road west',text:'Someone has to tell the castle what came out of the east. The lords will not listen to a camp of refugees. They might listen to you; you saw it.',goal:'Bring word to King Aldric',to:()=>[king()]},
  ashford:{title:'The road to Ashford',text:'The king sent a patrol east under Captain Ranulf. None came back. He wants to know what became of them, and of Ashford. The road runs east through the Old Wood.',goal:'Go to Ashford',to:()=>[ASH]},
  aldous:{title:'What is left of Ashford',text:'Ashford is ash. Someone has kept a lamp lit in the ruined church.',goal:'Find whoever stayed in Ashford',to:()=>[byStory('aldous')]},
  clues:{title:'What is left of Ashford',text:'Father Aldous stayed when the others fled. He will not say what he saw, not yet. He asks you to look for the patrol among the ruins and in the dead woods beyond.',goal:'Search the ruins of Ashford',to:()=>CLUES.filter(c=>!data().clues[c.id])},
  report:{title:'What is left of Ashford',text:'You found the patrol, or what it left behind.',goal:'Show Father Aldous what you found',to:()=>[byStory('aldous')]},
  king2:{title:'The Blight',text:'Father Aldous calls it the Blight: an old rot from the east, held back for a thousand years by the Old Wood. The wood is failing. The king must know.',goal:'Return to King Aldric',to:()=>[king()]},
  wenna:{title:'The Blight',text:'The king knows the name, from a story his grandmother told. He sends you to the one person who might know more, the woman the court has pretended for years not to need.',goal:'Find Old Wenna in the Old Wood',to:()=>[wenna()]},
  end:{title:'The Blight',text:'Old Wenna knew. The Old Wood was planted to bind the Blight, and its heart has begun to beat again. And she says the Blight does not kill what it takes. It keeps it, under the hill. Ranulf’s men may still be out there.',goal:'',to:()=>[]}};
const order=['road','start','tell','ashford','aldous','clues','report','king2','wenna','end'];
function go(stage,note){const d=data();d.stage=stage;d.t=0;const s=STAGES[stage];Q.tell('scroll',stage==='end'?'The Blight: end of the first act':s.title+(note?': '+note:''));if(G.quests)G.quests.refresh();Q.save();}

/* ---------- clues in the ruins ---------- */
// places round Ashford, worked out once from the town itself; each glints until found
const CLUES=(function(){if(!ASH)return [];const out=[],spots=[[.6,38,'shield'],[2.5,42,'letter'],[-.35,70,'root']];
  for(const [a0,r0,id] of spots){let best=null;for(let k=0;k<40&&!best;k++){const a=a0+k*.13,r=r0+(k%5)*8,x=ASH.x+Math.cos(a)*r,z=ASH.z+Math.sin(a)*r;if(V.allowed(x,z)&&V.roadDist(x,z)>4&&!V.nearStream(x,z,4)&&V.floorH(x,z)<-1e8)best=[x,z];}
    if(best)out.push({id,x:best[0],z:best[1]});}return out;})();
const CLUE_TEXT={shield:['A soldier’s shield','Split down the middle, the king’s colours blackened. Whatever struck it did not use a blade.'],
  letter:['A half-burnt letter','From one of Ranulf’s men, never sent: “…the trees on the east ridge move at night. Ranulf says wind. It is not wind. If this reaches you, do not come…”'],
  root:['A black root','It lies across the path like a dropped rope, wet and warm. When you touch it, it pulls away.']};
const THREE=window.THREE,tex=c=>{const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t;};
const glintMat=new THREE.SpriteMaterial({map:(()=>{const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.fillStyle='#e8d0ff';for(const [x,y,w,h] of [[7,1,2,14],[1,7,14,2],[5,5,6,6]])g.fillRect(x,y,w,h);return tex(c);})(),transparent:true,depthWrite:false,fog:true});
const GL=CLUES.map(c=>{const s=new THREE.Sprite(glintMat);s.position.set(c.x,V.groundH(c.x,c.z)+.5,c.z);s.visible=false;V.scene.add(s);return s;});
let nearClue=null;

/* ---------- conversations ---------- */
let node=null;   // the branch we are part way through with someone: [npc, key]
const L={
  maud1:'Asleep, both of them, on the bare ground. I did not think they would ever sleep again. If you had not come down our lane last night, I would still be standing in the kitchen, looking at the door.',
  maud2:'Father Aldous would not leave the church. He was still ringing the bell when we reached the gate, and then it stopped. My husband went back for him. I keep listening for it.',
  maudsoldier:'The king’s men. Ten of them rode east through Ashford a week ago, a young one at the back who sang. Into the orchard, after the tithe. They never came back through. Whatever that was, they met it first.',
  maud3:'Then go up to the castle. They will not listen to a widow in a borrowed blanket. They might listen to you. You saw it too.',
  king1:'Ashford? Burned? I sent Captain Ranulf east a week ago with ten men because the tithe had not come. Not one of them has ridden back.',
  king2:'You were there, and you walked out of it. Then you are the one to go back. Find Ranulf, or what happened to him, and come back and tell me plainly. Take this for the road.',
  aldous1:'You. I saw you at the gate with the Fletcher woman, and I thought, good, one of them is out. Then they did hear, at the castle. Sit, if you like. Not there. The ground there is not right any more.',
  aldous2:'I rang the bell until the rope burned through. Then I stayed, because someone must, for the ones who did not get out. The soldiers came after. They went into the dead wood east of here, and I heard them, and then I did not. Look for them. Look in the ruins, and on the path east. Bring me what you find, and I will tell you what I think it means.',
  aldous3:'A shield split from inside. A letter. And that. You touched it? Wash your hands before you eat. My grandfather called it the Blight. It sleeps under the eastern hills, and the Old Wood was planted on its doorstep to keep it there. Every root of that wood is a nail in its coffin. The nails are coming loose.',
  aldous4:'Go back to your king. Tell him the name. And tell him the old woman in the wood will know more than any priest.',
  king3:'The Blight. My grandmother told me that story to frighten me to sleep. I thought it was a story.',
  king4:'The witch in the Old Wood. My father drove her out of the court for saying things he did not want to hear. If she knows anything, she will not tell it to a man in a crown. She might tell it to you. Go. And take more than you think you need.',
  wenna1:'So. The king finally sends someone. Late, as kings do.',
  wenna2:'I know what it is. I planted half of what holds it, when I was younger than you. The Elder is the oldest nail of all, and its leaves are browning at the edges. The stones in the circle are warm at night. They never used to be.',
  wenna4:'Ten men? Listen to me: the Blight does not kill what it takes. It keeps it, under the hill. If he went in, he may be there still.',
  wenna3:'Come back when you have rested. There is a long way to go, and not much time to go it in.'};
function options(n){const d=data(),out=[];if(!n)return out;
  const st=d.stage;
  if(n.story==='maud'&&(st==='start'||st==='road'))out.push(['s:maud','Maud. How are the boys?']);
  if(n.story==='maud'&&st!=='start'&&st!=='road')out.push(['s:maudnews','Any word from Ashford?']);
  if(n.role==='king'&&st==='tell')out.push(['s:king','Your Majesty, Ashford has burned.']);
  if(n.role==='king'&&st==='king2')out.push(['s:king2','I have been to Ashford.']);
  if(n.story==='aldous'&&st==='aldous')out.push(['s:aldous','Father? You stayed?']);
  if(n.story==='aldous'&&st==='report')out.push(['s:report','I found the patrol. What was left of it.']);
  if(n.story==='aldous'&&st==='clues')out.push(['s:clueask','What should I look for?']);
  if(n.role==='witch'&&st==='wenna')out.push(['s:wenna','The king sent me. Ashford has fallen to the Blight.']);
  if((n.story==='refugee1'||n.story==='refugee2'||n.story==='survivor'))out.push(['s:hear','What did you see?']);
  return out;}
const NEXT={'s:maud':['s:maud2','Did anyone else get out?'],'s:maud2':['s:maudsoldier','Has anyone gone for help?'],'s:maudsoldier':['s:maud3','Someone has to tell the king.'],
  's:king':['s:king1b','It was not fire alone. I was there.'],'s:king1b':['s:kingyes','I will go east.'],
  's:aldous':['s:aldous2','What happened here?'],'s:report':['s:report2','What is it?'],'s:king2':['s:king2b','The priest calls it the Blight.'],
  's:wenna':['s:wenna2','Then you know what it is.'],'s:wenna2':['s:wenna4','The king’s patrol went east. Ten men.'],'s:wenna4':['s:wenna3','Then how do I bring him back?']};
function followups(n,t){const nx=NEXT[t];node=nx?[n,t]:null;return nx?[nx]:[['return','Ask about something else.']];}
function choose(n,t){const d=data();
  switch(t){
    case 's:maudsoldier':return L.maudsoldier;
    case 's:wenna4':return L.wenna4;
    case 's:maud':return L.maud1;
    case 's:maud2':return L.maud2;
    case 's:maud3':if(d.stage==='start'||d.stage==='road')go('tell','tell the castle');return L.maud3;
    case 's:maudnews':return d.stage==='end'||d.stage==='wenna'||d.stage==='king2'?'Then it is true. All of it. I hoped you would come back and tell me I dreamed it.':'Nothing. No one comes down that road any more. I keep watching it.';
    case 's:king':return L.king1;
    case 's:king1b':return 'Not fire alone. Then what? No, not here, not in front of the court. Ranulf went east. If he rode into this, I want to know what became of him.';
    case 's:kingyes':if(d.stage==='tell'){Q.coins(25);Q.tell('coin','+25 coins');go('ashford','ride east');}return L.king2;
    case 's:aldous':return L.aldous1;
    case 's:aldous2':if(d.stage==='aldous')go('clues','search the ruins');return L.aldous2;
    case 's:clueask':return 'Anything of theirs. Anything that is not ash. And do not stay out past dark if you can help it.';
    case 's:report':return 'Show me.';
    case 's:report2':if(d.stage==='report')go('king2','return to the castle');return L.aldous3+' '+L.aldous4;
    case 's:king2':return 'Then speak. Plainly.';
    case 's:king2b':if(d.stage==='king2'){Q.coins(40);Q.tell('coin','+40 coins');go('wenna','find Old Wenna');}return L.king3+' '+L.king4;
    case 's:wenna':return L.wenna1;
    case 's:wenna2':return L.wenna2;
    case 's:wenna3':if(d.stage==='wenna'){go('end');say('The Blight','End of the first act');}return L.wenna3;
    case 's:hear':return {refugee1:'Lights in the orchard. Green ones. Mam says not to talk about it.',refugee2:'I had a cart and a horse. I have a cart. Do not go east, friend.',survivor:'The priest will not leave the church. Someone has to bring him bread. Is it you now?'}[n.story]||'Nothing I can bear to tell.';}
  return null;}

/* ---------- each frame ---------- */
let acc=0;
function tick(dt){if(!V.started)return;nameThem();const d=data();d.t+=dt;acc+=dt;
  // the first nudge, once the player has found their feet
  if(d.stage==='camp')d.stage='start';   // saves from the version with a gate scene
  if(d.stage==='road'&&CAMP&&Math.hypot(P.x-CAMP.x,P.z-CAMP.z)<45)go('start','speak to Maud');
  if(ASH&&!d.seen.ash&&Math.hypot(P.x-ASH.x,P.z-ASH.z)<110){d.seen.ash=1;say('Ashford','What is left of it.');if(d.stage==='ashford')go('aldous');}
  if(HEART&&!d.seen.heart&&Math.hypot(P.x-HEART.x,P.z-HEART.z)<160){d.seen.heart=1;say('The Blight','The air is thick, and something under the ground is breathing.');}
  // clues glint once you are looking for them
  nearClue=null;const look=d.stage==='clues';
  CLUES.forEach((c,i)=>{const s=GL[i],got=d.clues[c.id],dd=Math.hypot(c.x-P.x,c.z-P.z);s.visible=look&&!got&&dd<260;if(s.visible){const tw=.5+.5*Math.sin(performance.now()/300+i);s.scale.setScalar((.35+.5*tw)*Math.min(1.6,.6+dd/40));s.material.opacity=.4+.6*tw;}
    if(look&&!got&&dd<2.6&&!G.modal&&!Q.view())nearClue=c;});
  if(nearClue){const H=V.talkHint,B=V.talkBtn;H.textContent=V.coarse?'':'Press E to look closer';H.style.color='';H.style.opacity=1;B.textContent='Look';if(V.coarse)B.style.display='block';}}
const tick0=G.tick,use0=G.use;
G.tick=function(dt,T){tick0(dt,T);tick(dt);};
G.use=function(npc){if(nearClue){const c=nearClue,d=data();nearClue=null;d.clues[c.id]=1;const [t,txt]=CLUE_TEXT[c.id];say(t,txt);
  const n=CLUES.filter(q=>d.clues[q.id]).length;Q.tell('scroll',t+' ('+n+'/'+CLUES.length+')');if(n>=CLUES.length)go('report','back to Father Aldous');else Q.save();return true;}return use0(npc);};

/* ---------- what the journal, compass and map ask of us ---------- */
function journal(){const d=data(),s=STAGES[d.stage];if(!s)return '';const on=!G.quests||G.quests.data().track===null||G.quests.data().track==='story';
  let h='<h3>The Blight</h3><div class="q"><div class="qt"><b>✦</b><span>'+s.title+'</span></div><div class="qh" style="margin-top:.3rem">'+s.text+'</div>';
  if(s.goal)h+='<div class="qo">'+s.goal+(d.stage==='clues'?' ('+CLUES.filter(c=>d.clues[c.id]).length+'/'+CLUES.length+')':'')+'</div><div class="qb"><span></span><button type="button" data-q="track" data-id="story"'+(on?' disabled':'')+'>'+(on?'Following':'Follow')+'</button></div>';
  return h+'</div>';}
function targets(){const s=STAGES[data().stage];if(!s)return [];if(data().stage==='clues')return Math.hypot(ASH.x-P.x,ASH.z-P.z)>220?[ASH]:s.to();return s.to().filter(Boolean);}
function short(){const d=data(),s=STAGES[d.stage];if(!s||!s.goal)return '';return s.goal+(d.stage==='clues'?' '+CLUES.filter(c=>d.clues[c.id]).length+'/'+CLUES.length:'');}
G.story={options,choose,followups,journal,targets,short,data,go,CLUES,STAGES};
})();
