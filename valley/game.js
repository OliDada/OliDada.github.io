/* The Valley — game layer. Step 1: things to carry, coins, and merchants who trade.
   Step 5: locks — doors shut at night, locked chests, lockpicking, and a gaol you can break out of.
   Step 4: fighting — health, sword hits, blocking, wolves in the hills, bandits in the golden woods, and people who fight back or flee.
   Step 3: the watch — guards who chase you down, the choice of fine or cells, and running for it.
   Step 2: sneaking, people who notice you, things that belong to someone, theft and witnesses.
   Loaded after the world in index.html and plugs into it through window.__valley.
   Later steps (sneaking and theft, guards and jail, combat, locks) build on the state kept here. */
(function(){
"use strict";
const V=window.__valley;if(!V||!window.THREE)return;
const THREE=window.THREE,G=V.GAME,P=V.P;
const $=s=>document.querySelector(s);

/* ================= items ================= */
// v: what it is worth in coins. use: what the bag offers to do with it.
const ITEMS={
  mushroom:{n:'Mushroom',v:2,heal:5,use:'Eat',said:'Earthy. Probably the safe kind.'},
  berries:{n:'Wild berries',v:1,heal:3,use:'Eat',said:'Sweet, and gone too quickly.'},
  herb:{n:'Meadow herbs',v:3},
  flower:{n:'Wildflowers',v:1},
  apple:{n:'Apple',v:2,heal:8,use:'Eat',said:'Crisp and a little sharp.'},
  bread:{n:'Loaf of bread',v:3,heal:15,use:'Eat',said:'Still warm in the middle.'},
  honeycake:{n:'Honey cake',v:5,heal:12,use:'Eat',said:'Sticky fingers. Worth it.'},
  cheese:{n:'Wheel of cheese',v:8,heal:20,use:'Eat',said:'Strong enough to walk on its own.'},
  stew:{n:'Bowl of stew',v:4,heal:30,use:'Eat',said:'Hot, salty, and mostly turnip.'},
  ale:{n:'Mug of ale',v:3,heal:5,use:'Drink',said:'Watered, as promised.'},
  candle:{n:'Tallow candle',v:2},
  cloth:{n:'Bolt of cloth',v:14},
  boots:{n:'Walking boots',v:40,worn:true},
  jug:{n:'Pewter jug',v:7},
  candlestick:{n:'Silver candlestick',v:18},
  ring:{n:'Gold ring',v:30},
  purse:{n:'Coin purse',v:10},
  pelt:{n:'Wolf pelt',v:12},
  mutton:{n:'Mutton',v:6,heal:18,use:'Eat',said:'Tough, and it tastes of somebody else\'s flock.'},
  pick:{n:'Lockpick',v:4},
  draught:{n:'Healing draught',v:14,heal:60,use:'Drink',said:'Bitter as bark, and warm all the way down.'},
  // carried for someone: never sold, never eaten
  parcel:{n:'Parcel',v:0,quest:true},
  keepsake:{n:'Lost keepsake',v:0,quest:true},
  // gear: bought once and kept (S.gear), never in the bag
  steel:{n:'Steel sword',v:90,gear:true,does:'strikes half again as hard',got:'Castle steel. It sits in the hand as if it had always been yours.'},
  jack:{n:'Padded jack',v:60,gear:true,does:'blows hurt a fifth less',got:'Thick quilted linen. It will turn a tooth or a cudgel.'},
  mail:{n:'Mail shirt',v:170,gear:true,does:'blows hurt two fifths less',got:'Heavy on the shoulders, and worth every link.'},
  cloak:{n:'Hunter\'s cloak',v:70,gear:true,does:'harder to spot when sneaking',got:'The colour of moss and bark. Eyes slide off it.'},
  room:{n:'A room of your own',v:150,gear:true,does:'sleep here for nothing',got:'The key is yours. Top of the stairs, and the bed is always made.'}
};
const ORDER=Object.keys(ITEMS);

// 16x16 pixel icons, drawn once and used both in the world and in the bag
const PIX={
  mushroom:[[5,4,6,1,'#8a4a2c'],[4,5,8,2,'#a85c34'],[3,7,10,2,'#8a4a2c'],[5,5,2,1,'#d49a6a'],[9,6,1,1,'#d49a6a'],[6,9,4,5,'#e8dcc0'],[9,9,1,5,'#c2b594'],[5,14,6,1,'#b0a284']],
  berries:[[3,9,10,5,'#3c6a2e'],[2,11,12,3,'#2e5426'],[5,7,6,2,'#4c7e38'],[4,10,2,2,'#a02038'],[8,9,2,2,'#c02848'],[11,11,2,2,'#a02038'],[6,12,2,2,'#c02848'],[8,9,1,1,'#f08090'],[4,10,1,1,'#f08090']],
  herb:[[7,7,1,8,'#3c6a2e'],[4,8,3,2,'#5c9440'],[8,6,4,2,'#6aa648'],[3,11,4,2,'#4c7e38'],[8,10,4,2,'#5c9440'],[6,4,3,3,'#7ab852'],[7,3,1,1,'#b0d880']],
  flower:[[7,8,1,7,'#3c6a2e'],[4,11,3,1,'#4c7e38'],[8,12,3,1,'#4c7e38'],[6,3,3,1,'#e8d04c'],[5,4,5,3,'#f0e070'],[6,7,3,1,'#e8d04c'],[7,5,1,1,'#c87a2c'],[11,7,2,2,'#d86a8a'],[2,8,2,2,'#8a7ad8']],
  apple:[[5,6,6,1,'#b02a2a'],[4,7,8,5,'#c83838'],[5,12,6,1,'#9a2424'],[5,8,2,2,'#f08070'],[7,4,1,3,'#5a3a20'],[8,4,3,1,'#5c9440']],
  bread:[[3,7,10,1,'#a8703a'],[2,8,12,4,'#c88a48'],[3,12,10,1,'#8a5a2c'],[4,8,2,1,'#e8c080'],[7,8,2,1,'#e8c080'],[10,8,2,1,'#e8c080']],
  honeycake:[[3,8,10,4,'#c8903c'],[3,12,10,1,'#8a5a2c'],[3,6,10,2,'#f0c860'],[4,8,1,2,'#f0c860'],[9,8,1,3,'#f0c860'],[5,6,3,1,'#fff0b0']],
  cheese:[[2,8,12,5,'#e0b040'],[2,7,12,1,'#f0cc60'],[2,13,12,1,'#b88828'],[5,9,2,2,'#b88828'],[10,10,2,2,'#b88828'],[8,8,1,1,'#b88828']],
  stew:[[3,8,10,1,'#6a4a30'],[2,9,12,3,'#8a6440'],[3,12,10,1,'#6a4a30'],[5,13,6,1,'#4e3622'],[4,8,8,1,'#b05a30'],[6,8,1,1,'#e0a040'],[9,8,1,1,'#7aa848'],[6,4,1,3,'#d0d0d0'],[9,3,1,4,'#d0d0d0']],
  ale:[[4,5,7,9,'#8a6440'],[4,5,7,2,'#f4ecd8'],[5,4,5,1,'#f4ecd8'],[11,7,2,1,'#6a4a30'],[12,8,1,3,'#6a4a30'],[11,11,2,1,'#6a4a30'],[5,8,1,5,'#b08a5c'],[4,14,7,1,'#5a3e28']],
  candle:[[6,7,4,7,'#e8dcc0'],[9,7,1,7,'#c2b594'],[5,14,6,1,'#8a7a5c'],[7,5,1,2,'#3a3028'],[7,2,2,3,'#f2b45c'],[7,3,1,1,'#fff0b0']],
  cloth:[[2,6,12,7,'#3c5a94'],[2,6,12,1,'#5878b8'],[2,12,12,1,'#2a4070'],[2,6,2,7,'#e8dcc0'],[12,6,2,7,'#e8dcc0'],[5,8,6,1,'#5878b8']],
  boots:[[4,3,4,8,'#6a4428'],[4,3,4,1,'#8a6038'],[4,11,8,3,'#5a3820'],[4,14,9,1,'#2e2018'],[9,11,3,1,'#6a4428'],[5,5,2,1,'#8a6038']],
  jug:[[6,3,4,1,'#b8bcc4'],[5,4,6,2,'#9aa0aa'],[4,6,8,7,'#8a909c'],[5,13,6,1,'#6a707c'],[5,6,2,5,'#c8ccd4'],[12,6,1,1,'#6a707c'],[13,7,1,3,'#6a707c'],[12,10,1,1,'#6a707c']],
  candlestick:[[7,1,2,2,'#f2b45c'],[7,3,2,3,'#e8dcc0'],[6,6,4,1,'#d8dce4'],[7,7,2,5,'#b0b6c2'],[7,8,1,3,'#eef0f4'],[5,12,6,1,'#b0b6c2'],[4,13,8,2,'#8a909c'],[5,13,2,1,'#d8dce4']],
  ring:[[5,8,6,1,'#f2c860'],[4,9,2,4,'#e0a838'],[10,9,2,4,'#b88420'],[5,13,6,1,'#b88420'],[6,5,4,3,'#c83838'],[7,5,1,1,'#f08070'],[5,9,1,1,'#fff0b0']],
  purse:[[6,3,4,1,'#5a3820'],[5,4,6,1,'#c8a040'],[5,5,6,2,'#7a5030'],[4,7,8,6,'#8a5c34'],[5,13,6,1,'#5a3820'],[5,8,2,3,'#a87848'],[11,8,1,4,'#5a3820']],
  pelt:[[3,5,10,8,'#6a6660'],[2,7,12,4,'#7c7870'],[4,4,2,2,'#56524c'],[10,4,2,2,'#56524c'],[4,13,2,2,'#56524c'],[10,13,2,2,'#56524c'],[6,7,4,3,'#948e84'],[7,13,2,2,'#4a4640']],
  mutton:[[3,6,8,6,'#a84a40'],[4,5,6,1,'#c06a5a'],[4,12,6,1,'#7a2e28'],[5,7,3,2,'#d08a78'],[10,8,3,2,'#e8dcc0'],[12,7,2,4,'#f4ecd8'],[13,6,1,1,'#f4ecd8'],[13,11,1,1,'#f4ecd8']],
  pick:[[2,12,3,2,'#8a909c'],[4,10,3,2,'#9aa0aa'],[6,8,3,2,'#b0b6c2'],[8,6,3,2,'#b0b6c2'],[10,4,3,2,'#c8ccd4'],[12,3,2,2,'#d8dce4'],[13,5,1,2,'#8a909c'],[1,13,2,2,'#5a3820']],
  draught:[[7,2,2,2,'#8a6a40'],[6,4,4,2,'#b8d8c8'],[4,6,8,8,'#3c8a5a'],[5,7,2,4,'#7ac89a'],[4,14,8,1,'#2a6040']],
  parcel:[[3,5,10,9,'#b08a5c'],[3,5,10,1,'#c8a878'],[3,13,10,1,'#8a6440'],[7,5,2,9,'#7c2419'],[3,9,10,1,'#7c2419'],[6,3,4,2,'#7c2419']],
  keepsake:[[6,2,4,1,'#c89030'],[5,3,1,3,'#c89030'],[10,3,1,3,'#c89030'],[5,7,6,6,'#f2c860'],[6,6,4,1,'#f2c860'],[6,13,4,1,'#b88420'],[7,9,2,2,'#3c5a94'],[6,8,1,1,'#fff0b0']],
  steel:[[7,1,2,9,'#d8dce4'],[8,1,1,9,'#b0b6c2'],[7,0,1,1,'#eef0f4'],[4,10,8,1,'#c89030'],[7,11,2,3,'#5a3820'],[6,14,4,1,'#c89030']],
  jack:[[4,3,8,10,'#8a6a3c'],[2,4,2,5,'#7a5c34'],[12,4,2,5,'#7a5c34'],[6,3,4,2,'#35240f'],[5,6,1,6,'#a88450'],[8,6,1,6,'#a88450'],[11,6,1,6,'#6a4e2a'],[4,13,8,1,'#5a4224']],
  mail:[[4,3,8,10,'#9aa0aa'],[2,4,2,5,'#8a909c'],[12,4,2,5,'#8a909c'],[6,3,4,2,'#35240f'],[5,6,1,1,'#d8dce4'],[7,6,1,1,'#d8dce4'],[9,6,1,1,'#d8dce4'],[6,8,1,1,'#d8dce4'],[8,8,1,1,'#d8dce4'],[10,8,1,1,'#d8dce4'],[5,10,1,1,'#d8dce4'],[7,10,1,1,'#d8dce4'],[9,10,1,1,'#d8dce4'],[4,13,8,1,'#6a707c']],
  cloak:[[5,2,6,3,'#2e5426'],[4,5,8,9,'#3c6a2e'],[3,8,10,6,'#2e5426'],[6,3,4,2,'#1a2c16'],[7,5,2,1,'#c89030'],[5,6,1,7,'#4c7e38']],
  room:[[2,5,5,6,'#c89030'],[3,7,3,2,'#7a5a20'],[7,7,7,2,'#c89030'],[10,9,1,2,'#c89030'],[12,9,2,3,'#c89030']],
  scroll:[[3,3,10,10,'#e8dcc0'],[2,2,12,2,'#c2b594'],[2,12,12,2,'#c2b594'],[5,6,6,1,'#6b5230'],[5,8,6,1,'#6b5230'],[5,10,4,1,'#6b5230']],
  coin:[[5,3,6,1,'#c89030'],[4,4,8,8,'#f2c860'],[5,12,6,1,'#a87420'],[3,5,1,6,'#c89030'],[12,5,1,6,'#a87420'],[6,6,1,4,'#fff0b0'],[8,5,1,6,'#c89030']]
};
const ICON={},ICON_URL={};
for(const k in PIX){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');for(const [x,y,w,h,col] of PIX[k]){g.fillStyle=col;g.fillRect(x,y,w,h);}ICON[k]=c;ICON_URL[k]=c.toDataURL();}

/* ================= state and saving ================= */
const KEY='valley.save.1';
const MAXHP=100;
const fresh=()=>({jailed:false,evidence:{},hp:MAXHP,coins:5,inv:{},hot:{},bounty:0,picked:{},boots:false,pos:null,tod:null,sheathed:true,boat:'pier',gear:{},quests:null});   // hot: how many of each thing you carry are stolen
let S=fresh(),hadSave=false;
try{const raw=localStorage.getItem(KEY);if(raw){const d=JSON.parse(raw);if(d&&typeof d.coins==='number'){S=Object.assign(fresh(),d);if(!S.gear||typeof S.gear!=='object')S.gear={};delete S.inv.tobin;hadSave=true;}}}catch(e){}
function save(){if(V.started){S.pos=[+P.x.toFixed(2),+P.z.toFixed(2),+P.yaw.toFixed(3)];S.tod=+V.DN.tod.toFixed(4);}
  try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
addEventListener('pagehide',save);
const count=k=>S.inv[k]||0;
function give(k,n){S.inv[k]=count(k)+(n||1);}
const hot=k=>Math.min(S.hot[k]||0,count(k));
function take(k,n,stolen){S.inv[k]=count(k)-(n||1);if(S.inv[k]<=0)delete S.inv[k];if(stolen)S.hot[k]=(S.hot[k]||0)-(n||1);S.hot[k]=Math.min(S.hot[k]||0,count(k));if(S.hot[k]<=0)delete S.hot[k];}
function wear(){G.speed=(S.boots?1.12:1)*(G.sneak?.45:1)*(G.block?.6:1);}
wear();

/* ================= things growing wild ================= */
let seed=90210;
const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const R=(a,b)=>a+rnd()*(b-a);
const REGROW=20*60*1000,RESTOCK=60*60*1000;   // wild things grow back after twenty minutes; households replace what went missing after an hour
const PICK=[],grid=new Map(),CELL=8,gk=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
const MATS={};
function mat(kind){if(MATS[kind])return MATS[kind];const t=new THREE.CanvasTexture(ICON[kind]);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
  return MATS[kind]=new THREE.SpriteMaterial({map:t,alphaTest:.5,fog:true});}
function free(x,z){if(!V.allowed(x,z)||V.inVillage(x,z)||V.inCourt(x,z)||V.roadDist(x,z)<3||V.nearStream(x,z,3))return false;
  for(const t of V.trees){const dx=x-t[0],dz=z-t[1];if(dx<6&&dx>-6&&dz<6&&dz>-6&&Math.hypot(dx,dz)<t[2]+.3)return false;}
  for(const p of PICK)if(Math.abs(p.x-x)<1.2&&Math.abs(p.z-z)<1.2)return false;
  return true;}
function place(kind,x,z,sc,y,owned){const sp=new THREE.Sprite(mat(kind));sp.center.set(.5,0);sp.scale.set(sc,sc,1);sp.position.set(x,y===undefined?V.groundH(x,z)-.02:y,z);sp.visible=false;V.scene.add(sp);
  const p={id:kind[0]+PICK.length,kind,x,z,sp,owned:!!owned};PICK.push(p);const k=gk(x,z);let l=grid.get(k);if(!l)grid.set(k,l=[]);l.push(p);}
(function grow(){
  const trees=V.trees,slim=trees.filter(t=>t[2]>.2&&t[2]<1.3);
  const woods=(x,z,r)=>{let n=0;for(const t of trees){const dx=x-t[0],dz=z-t[1];if(dx<r&&dx>-r&&dz<r&&dz>-r)n++;}return n;};
  // mushrooms at the foot of trees and berry bushes between them, wherever the trees stand close
  let n=0;for(let i=0;i<4000&&n<70&&slim.length;i++){const t=slim[(rnd()*slim.length)|0],a=R(0,6.283),d=t[2]+R(.5,1.6),x=t[0]+Math.cos(a)*d,z=t[1]+Math.sin(a)*d;
    if(!free(x,z)||woods(x,z,14)<5)continue;place('mushroom',x,z,.42);n++;}
  n=0;for(let i=0;i<4000&&n<32&&slim.length;i++){const t=slim[(rnd()*slim.length)|0],a=R(0,6.283),d=R(2.5,6),x=t[0]+Math.cos(a)*d,z=t[1]+Math.sin(a)*d;
    if(!free(x,z)||woods(x,z,14)<3)continue;place('berries',x,z,.7);n++;}
  // herbs and flowers in the open ground beside the roads
  const pts=[];for(const k of ['meadow','west','track','castle','forest'])if(V.roads[k])for(const p of V.roads[k])pts.push(p);
  for(const [kind,want,sc] of [['herb',45,.5],['flower',45,.5]]){n=0;for(let i=0;i<5000&&n<want&&pts.length;i++){const p=pts[(rnd()*pts.length)|0],a=R(0,6.283),d=R(6,26),x=p[0]+Math.cos(a)*d,z=p[1]+Math.sin(a)*d;
    if(!free(x,z)||woods(x,z,10)>2)continue;place(kind,x,z,sc);n++;}}
  // windfalls under the orchard trees
  const o=window.ORCHARD;if(o){n=0;for(let i=0;i<600&&n<14;i++){const x=o[0]+R(-17,17),z=o[1]+R(-17,17);if(!free(x,z))continue;place('apple',x,z,.3);n++;}}
})();
/* ================= things that belong to someone ================= */
(function belongings(){
  const pickW=list=>{let t=0;for(const e of list)t+=e[1];let r=rnd()*t;for(const e of list){r-=e[1];if(r<0)return e[0];}return list[0][0];};
  const COMMON=[['bread',5],['cheese',3],['apple',3],['jug',4],['honeycake',2],['purse',2],['candlestick',1]],RICH=[['candlestick',5],['purse',4],['jug',3],['cheese',2],['ring',2],['honeycake',2]];
  // on the table in every home
  for(const f of V.FLOORS){if(!f.seats||f.seats.length!==2||f.inn||f.upper)continue;const mx=(f.seats[0][0]+f.seats[1][0])/2,mz=(f.seats[0][1]+f.seats[1][1])/2,c=Math.cos(f.ry),s=Math.sin(f.ry);
    const rich=V.inCourt(f.x,f.z),k=rnd()<.55?2:1,sd=rnd()<.5?1:-1;
    for(let i=0;i<k;i++){const u=(i?-.45:.4)*sd;place(pickW(rich?RICH:COMMON),mx+u*c,mz-u*s,.3,f.y+.86,true);PICK[PICK.length-1].home=f;}}
  // on the counters of the market stalls (same order as the stalls are built in the courtyard)
  const STALLS=[[-34,22,['bread','honeycake','bread']],[-24,23,['apple','cheese','apple']],[-14,22.5,['cloth','cloth']],[22,22,['candle','candle','candle']]];
  for(const [lx,lz,g] of STALLS){const [x,z]=V.cw(lx,lz-.65/V.CS);g.forEach((kind,i)=>place(kind,x+(i-(g.length-1)/2)*(g.length===2?1.2:.6),z,.3,V.CTOP+1.12,true));}   // each sits on one of the stall's crates
})();

// along the roads of the wider world: herbs and flowers in the verges, mushrooms and berries where the woods come close
if(V.WD){let s2=4711;const r2=()=>{s2|=0;s2=s2+0x6D2B79F5|0;let t=Math.imul(s2^s2>>>15,1|s2);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const ids=V.WD.roads.map(r=>r.id).filter(k=>V.roads[k]);let n=0;
  for(let i=0;i<9000&&n<260;i++){const P=V.roads[ids[(r2()*ids.length)|0]],p=P[(r2()*P.length)|0],a=r2()*6.283,d=4+r2()*28,x=p[0]+Math.cos(a)*d,z=p[1]+Math.sin(a)*d;
    if(!V.allowed(x,z)||V.roadDist(x,z)<3.5||V.nearStream(x,z,3)||V.floorH(x,z)>-1e8)continue;let ok=true;for(const q of PICK)if(Math.abs(q.x-x)<1.5&&Math.abs(q.z-z)<1.5){ok=false;break;}if(!ok)continue;
    const f=V.forestAt(x,z),k=f>.45?(r2()<.6?'mushroom':'berries'):(r2()<.5?'herb':'flower');place(k,x,z,k==='berries'?.7:k==='mushroom'?.42:.5);n++;}}
/* ================= merchants ================= */
// fav: what this trader pays well for. Everything else fetches half its worth.
const SHOPS={
  baker:{name:'Baker',hello:'Fresh from the oven this morning. Berries and apples I will always take off your hands.',sells:['bread','honeycake'],fav:['berries','apple']},
  grocer:{name:'Greengrocer',hello:'Whatever grows, I buy. Whatever I buy, I sell for a little more.',sells:['apple','cheese'],fav:['mushroom','berries','apple']},
  draper:{name:'Draper',hello:'Cloth from the coast, boots from my brother. Bring me flowers and I will make dye of them.',sells:['cloth','boots','jack','cloak'],fav:['flower','pelt']},
  herbalist:{name:'Herbalist',hello:'Herbs for the pot, herbs for the cough. I pay fairly for anything picked clean.',sells:['candle','draught'],fav:['herb','mushroom']},
  inn:{name:'Innkeeper',hello:'Ale, stew, or a bed until morning. And I never ask where a thing came from.',sells:['ale','stew','pick','room'],fav:['mushroom','cheese','bread'],bed:6,fence:true},
  pedlar:{name:'Pedlar',hello:'Needles, picks, a draught for the road. And I will take anything that fits in the pack.',sells:['pick','draught','bread','candle'],fav:['pelt','ring','candlestick','cloth']},
  smith:{name:'Smith',hello:'Good steel is not cheap, and cheap steel is not good. Pelts I can always use, for the bellows.',sells:['steel','mail'],fav:['pelt','jug','candlestick']}
};
{const stalls=V.NPCS.filter(n=>n.name==='Merchant'&&n.type==='stand'),ids=['baker','grocer','draper','herbalist'];
 stalls.forEach((n,i)=>{const id=ids[i%ids.length];n.shop=id;n.name=SHOPS[id].name;});
 const keeper=V.NPCS.find(n=>n.name==='Innkeeper');if(keeper)keeper.shop='inn';
 const smith=V.NPCS.find(n=>n.role==='smith');if(smith)smith.shop='smith';}
// --- the watch: the castle has its gate guards; the village, the lake town, the inn and the courtyard get watchmen of their own ---
{const spot=(c,r)=>{for(let i=0;i<60;i++){const a=R(0,6.283),d=R(3,r),x=c[0]+Math.cos(a)*d,z=c[1]+Math.sin(a)*d;if(V.allowed(x,z)&&!V.wallHit(x,z,1.2)&&V.floorH(x,z)<-1e8&&V.roadDist(x,z)<14)return [x,z];}return null;};
 const post=(c,r,name,n)=>{for(let i=0;i<n;i++){const p=spot(c,r*.6);if(p)V.spawn('guard',p[0],p[1],{type:'wander',radius:r,home:[c[0],c[1]],name});}};
 post(V.V,30,'Watchman',2);post(V.TOWN_C,36,'Watchman',2);post(V.INN,22,'Road warden',1);
 for(const [lx,lz] of [[0,10],[-24,8]]){const [x,z]=V.cw(lx,lz);V.spawn('guard',x,z,{type:'wander',court:true,radius:24*V.CS,home:V.cw(-5,12),name:'Castle guard'});}}
const fenced=k=>Math.max(1,Math.floor(ITEMS[k].v*.4));   // what a fence pays for stolen goods
const LAW=n=>n&&n.anim==='person'&&!n.wall&&/guard|soldier/.test(n.role);
const offer=(shop,k)=>{const v=ITEMS[k].v;return shop.fav.includes(k)?Math.max(1,Math.round(v*.8)):Math.max(1,Math.floor(v/2));};

/* ================= interface ================= */
// parchment, painted in the same dabbed pixels as the world, and a ragged edge for the sheets
{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#d8bf8a';g.fillRect(0,0,64,64);
 const dab=(n,cols,w,h)=>{for(let i=0;i<n;i++){g.fillStyle=cols[(rnd()*cols.length)|0];const x=(rnd()*64)|0,y=(rnd()*64)|0;for(const ox of [0,-64])for(const oy of [0,-64])g.fillRect(x+ox,y+oy,w,h);}};
 dab(150,['#dcc591','#d3ba84','#dac28d','#d0b680'],5,2);dab(50,['#e0ca98','#ccb17a'],3,1);dab(8,['#c6aa72'],7,3);dab(18,['#b89a62'],1,1);
 document.documentElement.style.setProperty('--parch','url('+c.toDataURL()+')');
 const L=[],Rt=[],N=36;let a=R(0,5),b=R(0,5);for(let i=0;i<N;i++){const y0=(i/N*100).toFixed(2)+'%',y1=((i+1)/N*100).toFixed(2)+'%';if(rnd()<.6)a=Math.round(R(0,6));if(rnd()<.6)b=Math.round(R(0,6));
   Rt.push('calc(100% - '+b+'px) '+y0,'calc(100% - '+b+'px) '+y1);L.unshift(a+'px '+y1,a+'px '+y0);}
 document.documentElement.style.setProperty('--ragged','polygon('+Rt.concat(L).join(',')+')');}
const css=document.createElement('style');css.textContent=`
:root{--ink:#35240f;--ink2:#6b5230;--rule:rgba(84,58,22,.45);--wax:#7c2419;--waxhi:#f3e3bb}
.parch{background:#d8bf8a var(--parch) 0 0/256px 256px;image-rendering:pixelated;color:var(--ink)}
#vgHud{position:fixed;z-index:15;top:calc(8px + env(safe-area-inset-top,0px));left:calc(8px + env(safe-area-inset-left,0px));display:none;align-items:center;gap:.35rem;margin:0;padding:.2rem .3rem;font-size:1.05rem;background:none;color:var(--fg);border:0;text-shadow:0 1px 4px #000,0 0 10px #000;cursor:pointer;touch-action:manipulation;transition:opacity 1.2s}
#vgHud.rest{opacity:0}
#vgHud img,#vg img{width:22px;height:22px;image-rendering:pixelated;flex:none}
#vgHp{position:fixed;z-index:15;top:calc(40px + env(safe-area-inset-top,0px));left:calc(13px + env(safe-area-inset-left,0px));width:92px;height:5px;background:rgba(0,0,0,.5);opacity:0;transition:opacity .8s;pointer-events:none}
#vgHp i{display:block;height:100%;background:#c8423a;transition:width .25s}
#vgHurt{position:fixed;inset:0;z-index:14;pointer-events:none;opacity:0;transition:opacity .5s;background:radial-gradient(ellipse at center,transparent 45%,rgba(150,16,8,.6) 100%)}
#vgEye{position:fixed;z-index:15;top:calc(50px + env(safe-area-inset-top,0px));left:calc(12px + env(safe-area-inset-left,0px));display:none;flex-direction:column;align-items:flex-start;gap:2px;pointer-events:none;font-size:1rem}
#vgEye div{color:var(--fg);font-style:italic;text-shadow:0 1px 4px #000,0 0 10px #000}
#vgEye div.bad{color:#ff9c8a}
#vgSneak{display:none;position:fixed;right:calc(22px + env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 222px);width:62px;height:62px;margin:0;padding:0;border-radius:50%;font-size:.95rem;background:rgba(22,20,34,.55);color:var(--fg);border:2px solid var(--line);touch-action:none}
#vgSneak.on{border-color:var(--accent);color:var(--accent)}
#vgToast{position:fixed;z-index:15;left:calc(12px + env(safe-area-inset-left,0px));top:calc(104px + env(safe-area-inset-top,0px));font-size:1.05rem;pointer-events:none;text-shadow:0 1px 4px #000,0 0 10px #000}
#vgToast div{display:flex;align-items:center;gap:.4rem;margin:.15rem 0;transition:opacity .8s}
#vgToast img{width:20px;height:20px;image-rendering:pixelated}
#vgWrap{position:fixed;inset:0;z-index:18;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(8,8,14,.45)}
#vg{width:min(44rem,calc(100% - 28px));display:flex;flex-direction:column;max-height:calc(100dvh - 32px);color:var(--ink);-webkit-user-select:none;user-select:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.55))}
#vg.one{width:min(27rem,calc(100% - 28px))}
#vg .sheet{flex:1;min-height:0;overflow:auto;padding:1.1rem 1.7rem 1.2rem;background:#d8bf8a var(--parch) 0 0/256px 256px;image-rendering:pixelated;clip-path:var(--ragged);box-shadow:inset 0 0 34px rgba(96,64,20,.5),inset 0 12px 10px -8px rgba(60,38,10,.6),inset 0 -12px 10px -8px rgba(60,38,10,.6);touch-action:pan-y}
#vg .rod{flex:none;position:relative;z-index:1;height:22px;margin:0 -14px;background:linear-gradient(#b3935a 0 14%,#ecd9a8 14% 36%,#dcc48e 36% 60%,#b8985e 60% 82%,#86683a 82%)}
#vg .rod::before,#vg .rod::after{content:"";position:absolute;top:-3px;bottom:-3px;width:12px;background:linear-gradient(#7a5230 0 22%,#a5733f 22% 45%,#6b4526 45% 75%,#3f2815 75%)}
#vg .rod::before{left:-8px}#vg .rod::after{right:-8px}
#vg h2{font-weight:400;font-size:1.7rem;margin:0;line-height:1.1}
#vg .top{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}
#vg .purse{display:flex;align-items:center;gap:.35rem;font-size:1.15rem;white-space:nowrap}
#vg .hello{color:var(--ink2);font-style:italic;margin:.35rem 0 .2rem;font-size:1.05rem;line-height:1.4}
#vg .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 1.4rem}
#vg.one .cols{grid-template-columns:1fr}
@media (max-width:620px){#vg .cols{grid-template-columns:1fr}}
#vg h3{font-weight:400;font-size:1rem;font-style:italic;color:var(--wax);margin:.9rem 0 .2rem;border-bottom:1px solid var(--rule);padding-bottom:.2rem}
#vg .row{display:flex;align-items:center;gap:.55rem;padding:.3rem 0;font-size:1.05rem;min-height:2.3rem}
#vg .row .nm{flex:1;min-width:0;line-height:1.2}
#vg .row .nm small{color:var(--ink2);font-style:italic;font-size:.9rem;margin-left:.3rem}
#vg .row .nm small.hot{color:var(--wax)}
#vg .row .pr{color:var(--ink2);white-space:nowrap}
#vg .none{color:var(--ink2);font-style:italic;padding:.5rem 0}
#vg button{font:inherit;font-size:.98rem;margin:0;padding:.28rem .7rem;min-width:3.4rem;color:var(--waxhi);background:var(--wax);border:0;box-shadow:0 2px 0 #4a130c;cursor:pointer;touch-action:manipulation}
#vg button:active{transform:translateY(2px);box-shadow:none}
#vg button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
#vg button.alt{background:transparent;color:var(--ink);border:1px solid var(--ink2);box-shadow:none}
#vg button:disabled{opacity:.35;cursor:default}
#vgPins{text-align:center;font-size:1.3rem;letter-spacing:.5rem;color:var(--wax);margin:.5rem 0 .4rem}
#vgLock{position:relative;height:22px;margin:0 0 .3rem;background:rgba(84,58,22,.28);box-shadow:inset 0 2px 0 rgba(60,38,10,.35)}
#vgLock i{position:absolute;top:0;bottom:0;background:rgba(124,36,25,.45);border-left:2px solid var(--wax);border-right:2px solid var(--wax)}
#vgLock b{position:absolute;top:-4px;bottom:-4px;width:4px;margin-left:-2px;background:var(--ink)}
#vg .foot{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem}
#vg .note{color:var(--ink2);font-style:italic;font-size:.98rem;min-height:1.3em}
#vgFade{position:fixed;inset:0;z-index:30;background:#05050a;opacity:0;pointer-events:none;transition:opacity 1.1s}
/* the start card, on the same parchment */
#start .card{background:#d8bf8a var(--parch) 0 0/256px 256px;image-rendering:pixelated;color:var(--ink);border:0;clip-path:var(--ragged);box-shadow:inset 0 0 34px rgba(96,64,20,.5);-webkit-backdrop-filter:none;backdrop-filter:none;padding:1.4rem 2rem}
#start .card p{color:var(--ink2)}#start .card #go{color:var(--waxhi);background:var(--wax);box-shadow:0 2px 0 #4a130c}
#vgOver{background:transparent!important;color:var(--ink2)!important;box-shadow:none!important;font-size:.95rem!important;font-style:italic;text-decoration:underline;padding:.2rem!important;margin-top:.5rem!important;display:block;margin-left:auto;margin-right:auto}`;
document.head.appendChild(css);
const hud=document.createElement('button');hud.id='vgHud';hud.type='button';hud.setAttribute('aria-label','Open your bag');
const toast=document.createElement('div');toast.id='vgToast';
const wrap=document.createElement('div');wrap.id='vgWrap';const box=document.createElement('div');box.id='vg';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Valley conversation and inventory');box.tabIndex=-1;wrap.appendChild(box);
const fade=document.createElement('div');fade.id='vgFade';
const eye=document.createElement('div');eye.id='vgEye';
const sneakBtn=document.createElement('button');sneakBtn.id='vgSneak';sneakBtn.type='button';sneakBtn.textContent='Sneak';
const hpBar=document.createElement('div');hpBar.id='vgHp';hpBar.innerHTML='<i></i>';const hurtFx=document.createElement('div');hurtFx.id='vgHurt';
document.body.append(hurtFx,hud,hpBar,eye,toast,wrap,fade,sneakBtn);
function drawHp(){hpBar.firstChild.style.width=Math.max(0,S.hp/MAXHP*100)+'%';hpBar.style.opacity=S.hp<MAXHP&&V.started?1:0;}
for(const el of [hud,wrap])for(const ev of ['touchstart','mousedown'])el.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
const img=k=>'<img alt="" src="'+ICON_URL[k]+'">';
let hudShown=-1,hudT=0;   // the purse shows when it changes, then fades (it stays put on touch, where it is also the bag button)
function drawHud(){hud.innerHTML=img('coin')+S.coins;if(S.coins!==hudShown){hudShown=S.coins;hudT=5;hud.classList.remove('rest');}}
function tell(k,text){const d=document.createElement('div');d.innerHTML=(k?img(k):'')+text;toast.appendChild(d);while(toast.children.length>4)toast.firstChild.remove();
  setTimeout(()=>{d.style.opacity=0;setTimeout(()=>d.remove(),900);},2600);}

{const t=V.talkBox.style;t.background='none';t.border='0';t.padding='0 1rem';t.textShadow='0 1px 4px #000,0 0 12px #000,0 0 3px #000';}   // speech is just words over the world
let view=null,shopNPC=null,note='',speechTimer=0,finishSpeech=null;
function animateSpeech(){
 clearTimeout(speechTimer);const el=box.querySelector('.conversation');if(!el)return;
 const text=el.textContent;finishSpeech=null;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 el.style.minHeight=el.offsetHeight+'px';el.setAttribute('aria-label',text);
 const ink=document.createElement('span');ink.setAttribute('aria-hidden','true');el.replaceChildren(ink);let i=0;
 finishSpeech=()=>{clearTimeout(speechTimer);ink.textContent=text;finishSpeech=null;};
 function next(){if(view!=='person'||!el.isConnected)return;ink.textContent=text.slice(0,++i);if(i<text.length)speechTimer=setTimeout(next,/[.!?]/.test(text[i-1])?220:/[,;:]/.test(text[i-1])?110:22);else finishSpeech=null;}
 next();el.onclick=()=>finishSpeech?.();
}
box.addEventListener('keydown',e=>{if(view==='person'&&e.code==='Space'&&finishSpeech&&e.target===box){e.preventDefault();finishSpeech();}});

function open(v,npc){if(view==='person'&&v!=='person'&&G.social)G.social.end();view=v;shopNPC=npc||null;note='';G.modal=v!=='person';wrap.style.display='flex';if(document.pointerLockElement)document.exitPointerLock();for(const k in V.keys)V.keys[k]=false;V.talkBox.style.opacity=0;draw();box.focus();}
function close(){clearTimeout(speechTimer);if(!view)return;if(G.social)G.social.end();if(view==='arrest'&&shopNPC){if(caught){S.bounty+=5;shopNPC.stun=2.5;tell(null,'Resisting arrest. Fine: '+S.bounty);}else shopNPC.stun=8;}view=null;shopNPC=null;G.modal=false;wrap.style.display='none';save();
  if(!V.coarse&&V.canvas.requestPointerLock){try{const p=V.canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}}}
function bagRows(shop){let h='';for(const k of ORDER){const n=count(k);if(!n)continue;const it=ITEMS[k],st=hot(k),clean=n-st;
    if(it.quest){if(!shop)h+='<div class="row">'+img(k)+'<span class="nm">'+it.n+(n>1?'<small>×'+n+'</small>':'')+'</span><span class="pr">'+(it.keep?'':'for someone')+'</span>'+(it.use&&it.keep?'<button type="button" data-use="'+k+'">'+it.use+'</button>':'')+'</div>';continue;}
    if(!shop){h+='<div class="row">'+img(k)+'<span class="nm">'+it.n+(n>1?'<small>×'+n+'</small>':'')+(st?'<small class="hot">'+(st===n?'stolen':st+' stolen')+'</small>':'')+'</span><span class="pr">worth '+it.v+'</span>'+(it.use?'<button type="button" data-use="'+k+'">'+it.use+'</button>':'')+'</div>';continue;}
    if(clean){const o=offer(shop,k);h+='<div class="row">'+img(k)+'<span class="nm">'+it.n+(clean>1?'<small>×'+clean+'</small>':'')+'</span><span class="pr">'+o+(shop.fav.includes(k)?' ★':'')+'</span><button type="button" data-sell="'+k+'">Sell</button>'+(clean>1?'<button type="button" class="alt" data-sellall="'+k+'">All</button>':'')+'</div>';}
    if(st){h+='<div class="row">'+img(k)+'<span class="nm">'+it.n+(st>1?'<small>×'+st+'</small>':'')+'<small class="hot">stolen</small></span>'+(shop.fence?'<span class="pr">'+fenced(k)+'</span><button type="button" data-sell="'+k+'" data-hot="1">Sell</button>'+(st>1?'<button type="button" class="alt" data-sellall="'+k+'" data-hot="1">All</button>':''):'<span class="pr">will not buy</span>')+'</div>';}}
  if(S.boots&&!shop)h+='<div class="row">'+img('boots')+'<span class="nm">Walking boots<small>worn</small></span><span class="pr">a quicker stride</span></div>';
  if(!shop)for(const k of ORDER)if(S.gear[k])h+='<div class="row">'+img(k)+'<span class="nm">'+ITEMS[k].n+'<small>yours</small></span><span class="pr">'+ITEMS[k].does+'</span></div>';
  return h||'<div class="none">'+(shop?'You have nothing to sell.':'Nothing but lint. Mushrooms, berries, herbs and flowers grow wild in the valley.')+'</div>';}
function draw(){if(!view)return;const talking=view==='person';wrap.classList.toggle('talking',talking);box.setAttribute('aria-modal',String(!talking));if(talking&&G.social){box.className='dialogue';box.innerHTML=G.social.panel(shopNPC);animateSpeech();return;}const shop=view==='shop'?SHOPS[shopNPC.shop]:null;box.className=shop?'':'one';
  if(view==='lock'&&PK){const L=PK.L,n=count('pick'),name=L.kind==='chest'?'Chest lock':L.kind==='evidence'?'Evidence chest':L.kind==='cell'?'Cell door':'Door lock';let pins='';for(let i=0;i<L.pins;i++)pins+=i<PK.set?'●':'○';
    box.innerHTML='<div class="rod"></div><div class="sheet"><div class="top"><h2>'+name+'</h2><div class="purse">'+img('pick')+n+(n===1?' pick':' picks')+'</div></div><p class="hello">Set each pin while it sits in the notch. Miss, and the pick snaps.</p>'
      +'<div id="vgPins">'+pins+'</div><div id="vgLock"><i style="left:'+PK.a*100+'%;width:'+PK.w*100+'%"></i><b style="left:'+PK.pos*100+'%"></b></div>'
      +'<div class="foot"><span class="note">'+note+'</span><span style="display:flex;gap:.5rem"><button type="button" data-set="1">'+(V.coarse?'Set pin':'Set pin (E)')+'</button><button type="button" class="alt" data-close="1">Leave it</button></span></div></div><div class="rod"></div>';return;}
  if(view==='arrest'){const can=S.coins>=S.bounty,loot=ORDER.some(k=>hot(k)),nights=nightsFor(S.bounty),coins=S.bounty+(S.bounty===1?' coin':' coins');
    box.innerHTML='<div class="rod"></div><div class="sheet"><div class="top"><h2>'+shopNPC.name+'</h2><div class="purse">'+img('coin')+S.coins+' coins</div></div><p class="hello">“'+(caught?'Got you. ':'')+'There is a fine of '+coins+' on your head'+(loot?', and whatever you took is forfeit':'')+'. Pay it, or it is '+(nights===1?'a night':nights+' nights')+' in the cells.”</p>'
      +'<div class="foot" style="flex-wrap:wrap;justify-content:flex-start">'+(can?'<button type="button" data-fine="1">Pay '+coins+'</button>':'')+'<button type="button"'+(can?' class="alt"':'')+' data-jail="1">Go to the cells</button><button type="button" class="alt" data-close="1" style="margin-left:auto">'+(caught?'Run for it':'Walk away')+'</button></div></div><div class="rod"></div>';return;}
  if(view==='journal'&&G.quests){box.innerHTML='<div class="rod"></div><div class="sheet">'+G.quests.journal()+'<div class="foot"><span class="note">'+note+'</span><span style="display:flex;gap:.5rem"><button type="button" class="alt" data-bag="1">Bag</button><button type="button" class="alt" data-close="1">'+(V.coarse?'Close':'Close (Esc)')+'</button></span></div></div><div class="rod"></div>';return;}
  let h='<div class="top"><h2>'+(shop?shop.name:'Your bag')+'</h2><div class="purse">'+img('coin')+S.coins+' coins</div></div>';
  if(shop){h+='<p class="hello">“'+shop.hello+'”</p><div class="cols"><div><h3>For sale</h3>';
    for(const k of shop.sells){const it=ITEMS[k],own=(it.worn&&S.boots)||(it.gear&&S.gear[k]);h+='<div class="row">'+img(k)+'<span class="nm">'+it.n+(it.does?'<small>'+it.does+'</small>':'')+'</span><span class="pr">'+it.v+'</span><button type="button" data-buy="'+k+'"'+(S.coins<it.v||own?' disabled':'')+'>'+(own?(it.gear?'Yours':'Worn'):'Buy')+'</button></div>';}
    if(shop.bed){const own=S.gear.room;h+='<div class="row">'+img(own?'room':'candle')+'<span class="nm">'+(own?'Your own bed, until morning':'A bed until morning')+'</span><span class="pr">'+(own?'yours':shop.bed)+'</span><button type="button" data-bed="1"'+(!own&&S.coins<shop.bed?' disabled':'')+'>Sleep</button></div>';}
    h+='</div><div><h3>Your bag <small style="font-style:normal;color:var(--ink2)">★ pays extra</small></h3>'+bagRows(shop)+'</div></div>';}
  else h+='<h3>Carrying</h3>'+bagRows(null);
  h+='<div class="foot"><span class="note">'+note+'</span><span style="display:flex;gap:.5rem">'+(!shop&&G.quests?'<button type="button" class="alt" data-journal="1">'+(V.coarse?'Journal':'Journal (J)')+'</button>':'')+'<button type="button" class="alt" data-close="1">'+(V.coarse?'Close':'Close (Esc)')+'</button></span></div>';
  const top=box.querySelector('.sheet'),y=top?top.scrollTop:0;box.innerHTML='<div class="rod"></div><div class="sheet">'+h+'</div><div class="rod"></div>';box.querySelector('.sheet').scrollTop=y;drawHud();}
box.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();});
box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset,shop=shopNPC&&SHOPS[shopNPC.shop];
  if(d.close){close();return;}
  if(d.journal||d.bag){view=d.journal?'journal':'bag';note='';draw();box.focus();return;}
  if(d.q&&view==='journal'&&G.quests){note=G.quests.click(d.q,d.id)||'';save();draw();return;}
  if(d.topic&&view==='person'){G.social.topic(shopNPC,d.topic);draw();(box.querySelector('[data-topic="'+d.topic+'"]')||box).focus();return;}
  if(d.trade&&view==='person'&&shop){if(!G.sheathed){G.social.topic(shopNPC,'hello');draw();return;}if(S.bounty>0&&!shop.fence){tell(null,'Settle your fine with the watch first.');return;}if(!G.social.willTrade(shopNPC)){tell(null,'They do not trust you enough to trade.');return;}view='shop';G.modal=true;draw();return;}
  if(d.set){lockTry();return;}
  if(d.fine){if(S.coins<S.bounty)return;S.coins-=S.bounty;forfeit();view='paid';close();standDown();V.say('Fine paid','Your name is clear again.');drawHud();return;}
  if(d.jail){jail();return;}
  if(d.buy&&shop){const it=ITEMS[d.buy];if(S.coins<it.v)return;S.coins-=it.v;if(it.gear){if(S.gear[d.buy]){S.coins+=it.v;return;}S.gear[d.buy]=true;note=it.got;}else if(it.worn){S.boots=true;wear();note='You lace them up. The road feels shorter already.';}else{give(d.buy);note='Bought: '+it.n.toLowerCase()+'.';}}
  else if((d.sell||d.sellall)&&shop){const k=d.sell||d.sellall,st=!!d.hot,have=st?hot(k):count(k)-hot(k),n=d.sellall?have:1;if(have<1||(st&&!shop.fence))return;const c=(st?fenced(k):offer(shop,k))*n;take(k,n,st);S.coins+=c;note='Sold for '+c+(c===1?' coin.':' coins.');}
  else if(d.use){const it=ITEMS[d.use];if(!count(d.use))return;if(it.keep){note=it.said;save();draw();return;}take(d.use,1,hot(d.use)>0);note=it.said;if(it.heal&&S.hp<MAXHP){S.hp=Math.min(MAXHP,S.hp+it.heal);note+=' You feel better.';drawHp();}}
  else if(d.bed&&shop){const c=S.gear.room?0:shop.bed;if(S.coins<c)return;S.coins-=c;sleep();return;}
  if(shop&&(d.buy||d.sell||d.sellall)&&G.social)G.social.trade(shopNPC);
  save();draw();});
// --- fine or cells ---
const nightsFor=b=>Math.max(1,Math.ceil(b/30));
function forfeit(){for(const k of ORDER){const n=hot(k);if(n)take(k,n,true);}S.hot={};S.bounty=0;}
function jail(beaten){const nights=nightsFor(S.bounty),loot=ORDER.some(k=>hot(k));fade.style.opacity=1;view=null;wrap.style.display='none';G.modal=true;
  setTimeout(()=>{standDown(true);calmAll();S.hp=beaten?45:Math.max(S.hp,45);dying=false;drawHp();G.sneak=false;wear();sneakBtn.classList.remove('on');
    if(J){   // into the lock-up: what you stole goes in the chest outside, your picks are taken, and the fine stands until you serve it
      for(const k of ORDER){const n=hot(k);if(n){S.evidence[k]=(S.evidence[k]||0)+n;take(k,n,true);}}S.hot={};if(count('pick'))take('pick',count('pick'));give('pick');
      S.jailed=true;J.door.forced=false;bar(J.door,true);P.x=J.x+.4;P.z=J.z-.2;P.y=J.y;P.yaw=Math.PI;P.pitch=.02;
      V.say(beaten?'Beaten and locked up':'The cells','Sleep on the straw to serve your '+(nights===1?'night':nights+' nights')+'. There is a bent nail in it.');}
    else{forfeit();V.DN.tod=.3;let x=V.GATEW.x-10,z=V.GATEW.z;if(!V.allowed(x,z)){x=V.GATEW.x-14;}P.x=x;P.z=z;P.y=V.groundH(x,z);P.yaw=Math.PI/2;P.pitch=.02;
      V.say(beaten?'Beaten and dragged off':'Released',(nights===1?'A night':nights+' nights')+' in the castle cells.'+(loot?' What you stole was taken back.':''));}
    save();fade.style.opacity=0;G.modal=false;shopNPC=null;drawHud();},1500);}
function sleep(){if(G.social)G.social.end();fade.style.opacity=1;view=null;wrap.style.display='none';
  setTimeout(()=>{V.DN.tod=.27;S.hp=MAXHP;drawHp();save();fade.style.opacity=0;G.modal=false;shopNPC=null;V.say('Morning','You slept soundly at the inn.');drawHud();},1300);}
hud.addEventListener('click',()=>{if(!V.started)return;if(view)close();else open('bag');});
addEventListener('keydown',e=>{if(!V.started)return;
  if(view==='person'&&!V.coarse&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&/^(Digit|Numpad)[1-9]$/.test(e.code)){e.preventDefault();if(!e.repeat)box.querySelector('[data-dialog-key="'+e.code.slice(-1)+'"]')?.click();return;}
  if(e.code==='Tab'&&view){e.preventDefault();const buttons=[...box.querySelectorAll('button:not(:disabled)')];if(buttons.length){const i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}return;}
  if(e.code==='Tab'||e.code==='KeyI'||e.code==='KeyB'){e.preventDefault();if(e.repeat)return;if(view==='bag')close();else if(!G.modal)open('bag');}
  else if(e.code==='KeyJ'&&G.quests){if(e.repeat)return;if(view==='journal')close();else if(view==='bag'){view='journal';note='';draw();}else if(!G.modal&&!view)open('journal');}
  else if(view==='lock'&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();if(!e.repeat)lockTry();}
  else if(e.code==='Escape'&&view)close();});
wrap.addEventListener('click',e=>{if(e.target===wrap)close();});

/* ================= hooks into the world ================= */
let nearItem=null,cullT=0,saveT=0,sightT=0,watchers=[],lpx=P.x,lpz=P.z,pace=0,speakT=0;
const PEOPLE=V.NPCS.filter(n=>n.anim==='person'&&!n.wall&&!n.fly);
// --- getting about: anyone game.js is moving (chasing, fleeing, going home) steers round walls, trees and water ---
const TG=new Map(),tgk=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8);
for(const t of V.trees){const r=t[2]+.8;for(let a=Math.floor((t[0]-r)/8);a<=Math.floor((t[0]+r)/8);a++)for(let b=Math.floor((t[1]-r)/8);b<=Math.floor((t[1]+r)/8);b++){const k=a+','+b;let l=TG.get(k);if(!l)TG.set(k,l=[]);l.push(t);}}
function passable(n,x,z){const r=n.r>0?n.r:.35;if(V.wallHit(x,z,r+.15)||!V.allowed(x,z))return false;const l=TG.get(tgk(x,z));if(l)for(const t of l)if(Math.hypot(x-t[0],z-t[1])<t[2]+r)return false;return true;}
function go(n,x,z,stop,done){n.drive=true;n.route=null;n.routeGo=0;n.goal=[x,z];n.stop=stop||.4;n.onArrive=done||null;n.stuck=0;}
function halt(n){n.drive=false;n.driving=false;n.goal=null;n.onArrive=null;n.ghost=false;n.driveT=undefined;n.state='idle';n.timer=1;}
G.drive=function(n,dt){const g=n.goal;n.driving=false;if(!g)return;
  const dx=g[0]-n.x,dz=g[1]-n.z,d=Math.hypot(dx,dz);
  if(n.driveT!==undefined){n.driveT-=dt;}
  if(d<=n.stop||(n.driveT!==undefined&&n.driveT<=0)){const f=n.onArrive;n.onArrive=null;n.driveT=undefined;if(f)f(n);return;}
  const stp=Math.min(n.speed*dt,d),a0=Math.atan2(dx,dz),s=n.side||1,ph=stp*(n.anim==='person'?1.6:3);
  if(n.ghost&&n.stuck>2){n.x+=dx/d*stp;n.z+=dz/d*stp;n.face=a0;n.phase+=ph;n.driving=true;return;}   // on the way home and boxed in: just go
  for(const off of [0,.6*s,1.2*s,1.9*s,-.6*s,-1.2*s,-1.9*s]){const a=a0+off,sx=Math.sin(a),cz=Math.cos(a);
    if(!passable(n,n.x+sx*stp,n.z+cz*stp)||!passable(n,n.x+sx*.8,n.z+cz*.8))continue;
    n.x+=sx*stp;n.z+=cz*stp;n.face=a;n.phase+=ph;n.driving=true;n.stuck=0;if(off*s<0)n.side=-s;return;}
  n.stuck=(n.stuck||0)+dt;};
// --- the watch on your heels ---
// Guards who can leave their post. Once you are wanted, any of them who sees you gives chase; a witness's cry brings the ones nearby.
// They run faster than you walk but slower than you run, lose you if you stay out of sight, and go back to their post.
const WATCH=PEOPLE.filter(n=>/^(guard|soldier)$/.test(n.role)&&n.fixedY===undefined);
let caught=false,chaseT=0;
const HALT=['You there! Halt!','Stop! In the name of the King!','Thief! Stand where you are!'];
function hunt(g,shout){if(g.hunt||g.down||S.jailed)return;g.hunt={x:g.x,z:g.z,speed:g.speed,lost:0,last:[P.x,P.z]};g.speed=6.2;g.sit=false;go(g,P.x,P.z,1.5);if(shout)speak(g,HALT[(Math.random()*HALT.length)|0]);}
function goHome(g,now){const h=g.hunt;g.fight=false;unwind(g);if(!h)return;g.hunt=null;g.speed=h.speed;
  if(now){halt(g);g.x=h.x;g.z=h.z;}else{go(g,h.x,h.z,.4,m=>{halt(m);m.face=m.face0;});g.ghost=true;}}
function standDown(now){for(const g of WATCH)goHome(g,now);}
function raiseAlarm(){for(const g of WATCH)if(!g.sleep&&Math.hypot(g.x-P.x,g.z-P.z)<45&&Math.abs(g.y-P.y)<12)hunt(g,false);}
function watch(dt){
  for(const g of WATCH){if(g.stun>0)g.stun-=dt;
    if(g.down)continue;
    if(!g.hunt){if(S.bounty>0&&!S.jailed&&g.sees&&!(g.stun>0)&&!G.modal)hunt(g,true);continue;}
    if(S.bounty<=0||S.jailed){goHome(g);continue;}
    const h=g.hunt,d=Math.hypot(g.x-P.x,g.z-P.z);
    if(g.sees||(d<30&&clearLine(g))){h.last=[P.x,P.z];h.lost=0;}else h.lost+=dt;
    if(h.lost>9){goHome(g);continue;}
    if(g.stun>0){g.goal=null;continue;}
    g.goal=[h.last[0],h.last[1]];g.stop=h.lost>0?.5:1.5;
    if(d<1.7)g.face=Math.atan2(P.x-g.x,P.z-g.z);
    if(g.fight)continue;
    if(!G.modal&&d<1.9&&Math.abs(g.y-P.y)<2&&clearLine(g)){caught=true;g.goal=null;g.face=Math.atan2(P.x-g.x,P.z-g.z);open('arrest',g);return;}}}
// --- sneaking ---
G.sneak=false;G.duck=0;
function setSneak(v){if(!V.started||G.modal)return;G.sneak=v;wear();sneakBtn.classList.toggle('on',v);}
addEventListener('keydown',e=>{if(e.code==='KeyC'&&!e.repeat)setSneak(!G.sneak);});
sneakBtn.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();setSneak(!G.sneak);},{passive:false});sneakBtn.addEventListener('click',()=>setSneak(!G.sneak));
// --- who can see you ---
// People see in front of them, further by day than by night, and less far if you crouch. A raised torch gives you away.
// Close by they hear you instead: running carries, walking a little, sneaking hardly at all. Walls block both.
function daylight(){const e=Math.sin((V.DN.tod-.25)*Math.PI*2)*.82,d=Math.min(1,Math.max(0,(e+.12)/.3));let l=.3+.7*d;
  if(V.floorH(P.x,P.z)>-1e8)l=Math.max(l,.6);if(V.torch)l=1;return l;}
function clearLine(n){const dx=P.x-n.x,dz=P.z-n.z,d=Math.hypot(dx,dz),k=Math.ceil(d/.6);
  for(let i=1;i<k;i++){const t=i/k,x=n.x+dx*t,z=n.z+dz*t;if(V.wallHit(x,z,.12)||V.castleBlocked(x,z))return false;}return true;}
function canSee(n,light){if(n.sleep||n.down)return false;const dx=P.x-n.x,dz=P.z-n.z,d=Math.hypot(dx,dz);
  if(d>26||Math.abs(n.y-P.y)>2.4+d*.5)return false;   // a storey apart indoors, but a hillside does not hide you
  const hear=G.sneak?(pace>.3?1.3:.7):(pace>6?7:pace>.3?3.5:1.6);
  const front=(Math.sin(n.face)*dx+Math.cos(n.face)*dz)/(d||1)>.26;
  if(!(d<hear||(front&&d<24*light*(G.sneak?(S.gear.cloak?.34:.5):1))))return false;
  return d<1.2||clearLine(n);}
function look(){const light=daylight();watchers=[];for(const n of PEOPLE){const far=Math.abs(n.x-P.x)>28||Math.abs(n.z-P.z)>28;n.sees=!far&&canSee(n,light);if(n.sees)watchers.push(n);}}
function speak(n,line){V.talkBox.innerHTML='<b style="font-weight:400;color:var(--accent)">'+n.name+'</b><br>'+line;V.talkBox.style.opacity=1;speakT=3.5;}
const CRIES=['Thief! Stop, thief!','Put that back! Guards!','I saw that! Thief!','Hands off! That is not yours!'];

/* ================= people who see what you do ================= */
// Nothing is a crime until someone tells the watch. A guard who sees it is the watch. Anyone else has to reach a guard, or be close
// enough to shout for one - and a witness who is knocked out first tells nobody. Who does what depends on who they are:
// the bold and hot-tempered go for you, owners and family most of all; the rest run for help.
const REPORTS=[],AV=[],DEAD=[],STAG=[];
const OWNCRY=['Thief! In my own house!','That is mine! Put it down!','Out! Get out of my house!'],KINCRY=['Leave them be, you animal!','Get away from them!'],FLOCK=['My flock! You butcher!','That is my sheep, you devil!','Touch another and I will break this staff on you!'];
function sendHome(m){if(m.fleeS){m.speed=m.fleeS;m.fleeS=0;}const day=V.DN.tod>=.27&&V.DN.tod<.77;if(m.homeF&&!day){halt(m);m.phaseR=null;}else if(m.home&&Math.hypot(m.x-m.home[0],m.z-m.home[1])>(m.radius||4)+2){go(m,m.home[0],m.home[1],2,q=>{halt(q);q.phaseR=null;});m.ghost=true;}else{halt(m);m.phaseR=null;}}
function crime(label,fine,o){o=o||{};look();
  const ws=watchers.filter(w=>!w.foe&&!w.down&&w!==o.victim);
  for(const e of [o.self,o.owner])if(e&&!e.down&&!e.sleep&&!ws.includes(e))ws.push(e);
  if(G.social)G.social.crime(ws,o);
  if(!ws.length&&!o.known)return false;
  const C={label,fine,done:false,n:0,violent:!!o.violent},near=ws.length?ws.reduce((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)<Math.hypot(b.x-P.x,b.z-P.z)?a:b):null,law=ws.find(LAW);
  let spoke=false;
  if(o.known||law){S.bounty+=fine;C.done=true;if(law&&!o.known){law.face=Math.atan2(P.x-law.x,P.z-law.z);speak(law,HALT[(Math.random()*HALT.length)|0]);spoke=true;}raiseAlarm();
    tell(null,label+(law&&!o.known?' — seen by '+law.name:'')+'. Fine: '+S.bounty);}
  else tell(null,label+' — seen by '+near.name+(ws.length>1?' and '+(ws.length-1)+' more':'')+'.');
  ws.sort((a,b)=>(b===o.owner||b===o.self?1:0)-(a===o.owner||a===o.self?1:0));
  for(const w of ws){if(LAW(w))continue;
    const own=(o.home&&w.homeF===o.home)||o.owner===w,self=w===o.self,kin=!self&&o.victim&&(G.social?G.social.related(w,o.victim):(o.victim.homeF&&w.homeF===o.victim.homeF));
    const response=G.social?G.social.reaction(w,{violent:o.violent,own:!!own,kin:!!kin,self}):null;
    if(response==='ignore')continue;
    w.face=Math.atan2(P.x-w.x,P.z-w.z);
    if(!spoke){const L=self?YELP:own?(o.ownCry||OWNCRY):kin?KINCRY:o.violent?YELP:CRIES;speak(w,L[(Math.random()*L.length)|0]);spoke=true;}
    if(response){if(response==='defend')avenge(w,C);else if(response==='flee')flee(w);else tattle(w,C);continue;}
    if(w.role!=='child'&&(own?(w.bold||w.hot):kin?true:self?(w.bold&&w.hot):(o.violent&&w.bold&&w.hot)))avenge(w,C);else tattle(w,C);}
  return true;}
function tattle(w,C){w.sit=false;
  if(C.done){if(C.violent)flee(w);return;}
  let g=null,gd=220;for(const q of WATCH){if(q.down||q.sleep)continue;const d=Math.hypot(q.x-w.x,q.z-w.z);if(d<gd&&Math.abs(q.y-w.y)<14){gd=d;g=q;}}
  if(!g||(gd>=26&&w.fixedY!==undefined)){if(C.violent)flee(w);else w.phaseR=null;return;}
  const r={w,C,g,shout:gd<26,t:gd<26?1.8:50};C.n++;REPORTS.push(r);w.rep=r;
  if(!r.shout){w.route=null;w.routeGo=0;if(!w.fleeS)w.fleeS=w.speed;w.speed=w.role==='child'?4.9:4.3;go(w,g.x,g.z,3.5);}}
function reports(dt){for(let i=REPORTS.length-1;i>=0;i--){const r=REPORTS[i],w=r.w,C=r.C,g=r.g;
  const end=()=>{REPORTS.splice(i,1);w.rep=null;if(!w.down&&!w.avenge)sendHome(w);};
  if(C.done){end();continue;}
  if(w.down){end();C.n--;if(C.n<=0&&clockT-quietT>3){quietT=clockT;tell(null,'No one is left to tell of it.');}continue;}
  if(g.down||g.sleep){end();C.n--;tattle(w,C);continue;}
  r.t-=dt;
  if(r.shout?r.t<=0:Math.hypot(w.x-g.x,w.z-g.z)<4.5){C.done=true;S.bounty+=C.fine;speak(w,r.shout?'Guard! Guard! Over here!':'That one — there! I saw it all!');tell(null,w.name+' told the watch. Fine: '+S.bounty);
    if(Math.hypot(g.x-P.x,g.z-P.z)<80)hunt(g,false);raiseAlarm();drawHud();save();end();continue;}
  if(r.shout)continue;
  if(r.t<=0){end();C.n--;continue;}
  if(!w.drive)go(w,g.x,g.z,3.5);w.goal=[g.x,g.z];}}
// someone who would rather settle it themselves
function avenge(w,C){if(w.avenge)return;if(w.fixedY!==undefined){tattle(w,C);return;}w.sit=false;w.route=null;w.routeGo=0;if(w.hp===undefined)w.hp=w.maxhp=40;w.dmg=w.dmg||(w.role==='shepherd'?8:5);
  if(!w.fleeS)w.fleeS=w.speed;w.speed=5.1;w.avenge={t:20,C};AV.push(w);go(w,P.x,P.z,1.5);}
function avengers(dt){for(let i=AV.length-1;i>=0;i--){const w=AV[i],a=w.avenge,d=Math.hypot(w.x-P.x,w.z-P.z);a.t-=dt;
  if(w.down||a.t<=0||d>45||dying||S.jailed||w.hp<w.maxhp*.45){AV.splice(i,1);w.avenge=null;unwind(w);if(!w.down){if(a.C.done){if(w.hp<w.maxhp*.45&&!dying)flee(w);else sendHome(w);}else tattle(w,a.C);}continue;}
  if(!w.drive)go(w,P.x,P.z,1.5);w.goal=[P.x,P.z];w.stop=1.5;w.ghost=false;if(d<1.7)w.face=Math.atan2(P.x-w.x,P.z-w.z);strike(w,d,dt);}}
// --- a drawn sword, a face they have learned to fear, a stranger in the house ---
const NERV=['Please... I want no trouble.','Mind where you point that.','Is there need for a sword here?','Easy, now. Easy.'],ANGRY=['Put that away before someone gets hurt!','Wave that about somewhere else!','Sheathe it, or I fetch the watch.'],KID=['He has a sword! A real one!','Is that sharp?'];
let hinted=false,lastSword=0,quietT=-9;
function setSheath(v){if(!V.started||G.modal||dying)return;G.sheathed=v;S.sheathed=v;lastSword=clockT;}
G.draw=()=>setSheath(false);G.sheathed=!!S.sheathed;G.sheathK=G.sheathed?1:0;
addEventListener('keydown',e=>{if(e.code==='KeyX'&&!e.repeat)setSheath(!G.sheathed);});
function mood(){if(S.jailed||dying||G.modal)return;
  for(const w of watchers){if(w.foe||w.down||w.rep||w.avenge||w.drive||!w.fear||w.fearT>clockT)continue;if(Math.hypot(w.x-P.x,w.z-P.z)<12){w.fearT=clockT+15;if(speakT<=0)speak(w,'Keep away from me!');flee(w);}}
  const fl=V.floorH(P.x,P.z)>-1e8;
  if(fl)for(const w of watchers){const f=w.homeF;if(!f||w.drive||w.rep||w.avenge||w.homeT>clockT||Math.hypot(P.x-f.x,P.z-f.z)>f.r||Math.abs(f.y-P.y)>1.5||Math.hypot(w.x-P.x,w.z-P.z)>8)continue;
    w.homeT=clockT+18;if(speakT<=0){w.face=Math.atan2(P.x-w.x,P.z-w.z);speak(w,G.social?G.social.homeLine(w):(w.bold?'This is my house. Out with you.':'What are you doing in here?'));}}
  if(G.sheathed)return;
  if(!(V.inVillage(P.x,P.z)||Math.hypot(P.x-V.TOWN_C[0],P.z-V.TOWN_C[1])<95||V.inCourt(P.x,P.z)||Math.hypot(P.x-V.INN[0],P.z-V.INN[1])<28||fl))return;
  for(const w of watchers){if(w.foe||w.down||w.rep||w.avenge||w.drive||w.hunt)continue;const d=Math.hypot(w.x-P.x,w.z-P.z);if(d>9)continue;
    const hint=()=>{if(!hinted){hinted=true;tell(null,V.coarse?'People are uneasy at a drawn sword. Leave it be a while and it goes back in its sheath.':'People are uneasy at a drawn sword. Press X to sheathe it.');}};
    if(LAW(w)){if(S.bounty>0)continue;
      if(!(w.warnT>clockT-45)){w.warnT=clockT;w.fined=false;w.face=Math.atan2(P.x-w.x,P.z-w.z);speak(w,'Sheathe that blade. I will not ask twice.');hint();}
      else if(clockT-w.warnT>9&&!w.fined){w.fined=true;S.bounty+=5;speak(w,'I warned you. Bare steel in the street is a fine.');tell(null,'Bare steel in town. Fine: '+S.bounty);drawHud();}
      continue;}
    if(w.nervT>clockT)continue;w.nervT=clockT+14;w.face=Math.atan2(P.x-w.x,P.z-w.z);const stern=w.bold&&w.hot&&w.role!=='child';
    if(speakT<=0){const L=w.role==='child'?KID:stern?ANGRY:NERV;speak(w,G.social?G.social.weaponLine(w):L[(Math.random()*L.length)|0]);}hint();
    if(!stern&&w.fixedY===undefined&&!w.sit&&!w.shop&&!w.route&&w.type!=='work'){const a=Math.atan2(w.x-P.x,w.z-P.z),k=w.role==='child'?9:w.bold?3:6;if(!w.fleeS)w.fleeS=w.speed;w.speed=w.role==='child'?4.4:2.4;go(w,w.x+Math.sin(a)*k,w.z+Math.cos(a)*k,.5,sendHome);w.driveT=4;}}}
/* ================= blood ================= */
const BLOOD=(function(){const c=document.createElement('canvas');c.width=c.height=4;const g=c.getContext('2d');g.fillStyle='#6e0e0c';g.fillRect(0,0,4,4);g.fillStyle='#96180f';g.fillRect(1,0,2,2);
  const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;const mat=new THREE.SpriteMaterial({map:t,fog:true}),parts=[],pools=[];
  for(let i=0;i<40;i++){const s=new THREE.Sprite(mat);const k=.035+Math.random()*.04;s.scale.set(k,k,1);s.visible=false;V.scene.add(s);parts.push({s,v:new THREE.Vector3(),t:9});}
  const pg=new THREE.CircleGeometry(1,16);pg.rotateX(-Math.PI/2);
  for(let i=0;i<10;i++){const m=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:0x5a0c0a,transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));m.visible=false;V.scene.add(m);pools.push({m,n:null,k:0,r:.8});}
  return {parts,pools,mat};})();
function burst(x,y,z,k){let n=0;for(const p of BLOOD.parts){if(p.t<1)continue;p.t=0;p.s.visible=true;p.s.position.set(x,y,z);p.v.set((Math.random()-.5)*2.6,.6+Math.random()*2.4,(Math.random()-.5)*2.6);if(++n>=k)break;}}
function pool(n){if(BLOOD.pools.some(p=>p.n===n))return;const p=BLOOD.pools.find(q=>!q.n)||BLOOD.pools[0];p.n=n;p.k=0;p.r=n.anim==='person'?.9:.6;p.m.visible=true;p.m.material.opacity=.85;p.m.position.set(n.x,n.y+.05,n.z);p.m.scale.set(.01,1,.01);}
function gory(dt){const day=V.NPCS[0]&&V.NPCS[0].sp.material.color;if(day)BLOOD.mat.color.copy(day);
  for(const p of BLOOD.parts){if(p.t>=1){p.s.visible=false;continue;}p.t+=dt*1.5;p.v.y-=9*dt;p.s.position.addScaledVector(p.v,dt);}
  for(const p of BLOOD.pools){if(!p.n)continue;const n=p.n;if(day)p.m.material.color.setRGB(.36,.05,.04).multiply(day);
    if(n.down||n.dead){p.k=Math.min(1,p.k+dt*.3);p.m.scale.set(p.r*(.25+.75*p.k),1,p.r*(.2+.6*p.k));}
    else{p.m.material.opacity-=dt*.12;if(p.m.material.opacity<=0){p.n=null;p.m.visible=false;}}}
  for(let i=STAG.length-1;i>=0;i--){const n=STAG[i];n.stag-=dt;n.flash=Math.max(0,n.flash-dt*2.2);if(n.stag>0&&!n.down&&!n.dead)n.sp.material.rotation=n.stagS*.38*(n.stag/.3);if(n.stag<=0&&n.flash<=0)STAG.splice(i,1);}}
// cuts that stay on them until they have mended
function wound(n){const c=n.t.image,g=c.getContext('2d'),person=n.anim==='person',cols=person?6:4,rows=person?3:1,cw=c.width/cols,ch=c.height/rows;
  if(!n.skin0){const b=document.createElement('canvas');b.width=c.width;b.height=c.height;b.getContext('2d').drawImage(c,0,0);n.skin0=b;}
  const u=Math.random(),v=Math.random(),len=person?5+Math.random()*9:2+Math.random()*3,x0=person?22+u*20:9+u*13,y0=person?(Math.random()<.25?9+v*8:36+v*26):8+v*6;
  g.globalCompositeOperation='source-atop';
  for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){const x=(q*cw+x0)|0,y=(r*ch+y0)|0;g.fillStyle='#7a100c';g.fillRect(x,y,person?3:2,len|0);g.fillStyle='#b4241a';g.fillRect(x,y,person?2:1,person?3:1);g.fillStyle='#7a100c';g.fillRect(x+(person?4:2),y+1,1,(len*.5)|0);}
  g.globalCompositeOperation='source-over';n.t.needsUpdate=true;}
function heal(n){if(n.skin0){const g=n.t.image.getContext('2d');g.clearRect(0,0,n.t.image.width,n.t.image.height);g.drawImage(n.skin0,0,0);n.t.needsUpdate=true;}n.hurtT=0;}
function gore(n,k){burst(n.x,n.y+(n.anim==='person'?1.15:.55),n.z,k);n.flash=.75;n.stag=.3;n.stagS=Math.random()<.5?1:-1;if(!STAG.includes(n))STAG.push(n);wound(n);}
// an animal that has been killed lies where it fell for a while, then is gone; another takes its place in time
function corpse(n,back){halt(n);unwind(n);const b=n.bs||(n.bs=[n.sp.scale.x,n.sp.scale.y]);n.dead=true;n.deadT=45;n.back=back;n.type0=n.type;n.type='stand';n.rr=n.r;n.r=-1;n.route=null;n.routeGo=0;n.sp.scale.set(b[0],b[1]*.55,1);n.tint0=n.tint;n.tint=true;pool(n);DEAD.push(n);}
function fallen(dt){for(let i=DEAD.length-1;i>=0;i--){const n=DEAD[i];
  if(n.dead){n.deadT-=dt;if(n.deadT<=0){n.dead=false;n.gone=true;n.goneT=n.back;n.sp.visible=false;}continue;}
  n.goneT-=dt;if(n.goneT<=0&&Math.hypot(n.home[0]-P.x,n.home[1]-P.z)>90){n.gone=false;n.hp=n.maxhp;n.r=n.rr;n.type=n.type0;n.tint=n.tint0;n.sp.scale.set(n.bs[0],n.bs[1],1);heal(n);n.angry=false;if(n.foe)n.speed=n.walk;n.x=n.home[0]+R(-4,4);n.z=n.home[1]+R(-4,4);n.sp.visible=true;DEAD.splice(i,1);}}}
// --- somebody's sheep ---
function scare(m,d){if(m.dead||m.gone||m.drive)return;const a=Math.atan2(m.x-P.x,m.z-P.z)+(Math.random()-.5);m.sp0=m.sp0||m.speed;m.speed=4.2;go(m,m.x+Math.sin(a)*d,m.z+Math.cos(a)*d,1,q=>{q.speed=q.sp0;halt(q);});m.driveT=5;}
function livestock(n){const dead=n.hp<=0,o=n.owner&&!n.owner.down&&!n.owner.sleep&&Math.hypot(n.owner.x-n.x,n.owner.z-n.z)<45?n.owner:null;
  if(dead){corpse(n,600);give('mutton');S.hot.mutton=(S.hot.mutton||0)+1;}else scare(n,16);
  for(const m of SHEEP)if(m!==n&&Math.hypot(m.x-n.x,m.z-n.z)<16)scare(m,12);
  if(!crime(dead?'A sheep killed':'A sheep struck',dead?18:8,{violent:true,owner:o,ownCry:FLOCK}))tell(dead?'mutton':null,dead?'+1 Mutton — not yours. No one saw.':'The flock scatters. No one saw.');
  else if(dead)tell('mutton','+1 Mutton');}
/* ================= the boat ================= */
const BOAT=(function(){if(!V.PIER||!V.ISLE)return null;const K=V.kit(),B=V.boxUV,g=new THREE.Group();
  K.add(B(3.1,.4,1.25,1),'wood',0,.12,0);K.add(B(.9,.38,.9,1),'wood',1.55,.13,0,Math.PI/4);
  for(const sd of [-1,1]){K.add(B(3.1,.16,.09,1),'wood',0,.38,sd*.6);K.add(B(2.3,.05,.12,1),'wood',-.2,.44,sd*.95,sd*.35);}
  for(const x of [-.9,.3])K.add(B(.32,.06,1.2,1),'wood',x,.36,0);
  K.build(V.M,g);V.scene.add(g);
  let shore=V.ISLE.x+V.ISLE.rx;for(let x=V.ISLE.x;x<V.ISLE.x+90;x+=.5)if(V.terrainH(x,V.ISLE.z)<V.LAKEY+.3){shore=x;break;}
  const b={g,at:S.boat==='isle'?'isle':'pier',pier:[V.PIER.x0-V.PIER.len+7,V.PIER.z+2.3,0],isle:[shore+1.4,V.ISLE.z,0],land:[shore-2.4,V.ISLE.z]};
  b.put=()=>{const p=b[b.at];g.position.set(p[0],V.LAKEY-.02,p[1]);g.rotation.y=b.at==='pier'?0:.5;};b.put();return b;})();
function row(){const to=BOAT.at==='pier'?'isle':'pier';fade.style.opacity=1;G.modal=true;
  setTimeout(()=>{BOAT.at=to;S.boat=to;BOAT.put();if(to==='isle'){P.x=BOAT.land[0];P.z=BOAT.land[1];P.yaw=Math.PI/2;}else{P.x=BOAT.pier[0];P.z=V.PIER.z;P.yaw=-Math.PI/2;}P.y=V.groundH(P.x,P.z);P.pitch=.02;
    standDown(true);save();fade.style.opacity=0;G.modal=false;V.say(to==='isle'?'The island':'The pier',to==='isle'?'The boat grounds on the shingle.':'');},1300);}
/* ================= who they are ================= */
// Everyone with a home gets a name and a household. Families share a surname, stand up for each other, and know what is theirs.
let named=false;
function nameAll(){named=true;
  const FAM=['Holt','Aldery','Marsh','Tanner','Wick','Fenn','Barrow','Sedge','Rook','Thorne','Ashby','Cobb','Dunmore','Elwood','Garrick','Hale','Ivers','Kettle','Lark','Mallow','Nance','Orrin','Pell','Quill','Rudd','Stile','Tolly','Underhay','Vane','Wren','Yarrow','Brock','Calder','Dray','Esk','Furze','Gorse','Heron','Inch','Jessop','Kell','Loam','Merrow','Nettle','Oakes','Pike','Reeve','Shaw'],
   M=['Aldric','Bram','Cuthbert','Dunstan','Edric','Godwin','Hob','Ives','Jory','Kenric','Leof','Merek','Osric','Piers','Rowan','Sewal','Tobias','Wat','Wilmot','Gareth'],
   F=['Ada','Beatrix','Cecily','Edith','Elswyth','Gunnild','Hilda','Isolde','Joan','Maud','Mabel','Nesta','Odila','Rohese','Sibyl','Tilda','Wynn','Agnes','Marta','Linnet'],
   K=['Tam','Pip','Nell','Robin','Wren','Kit','Bess','Jem'];let fi=0;
  for(const n of PEOPLE){const f=n.homeF;if(!f||n.foe||LAW(n))continue;if(!f.fam){f.fam=FAM[fi++%FAM.length];f.folk=[];}
    const L=n.role==='child'?K:/woman|queen/.test(n.role)?F:M;let nm=L[(rnd()*L.length)|0];for(let k=0;k<6&&f.folk.some(m=>m.first===nm);k++)nm=L[(rnd()*L.length)|0];
    n.first=nm;n.title=n.name;n.name=nm+' '+f.fam;f.folk.push(n);}}
/* ================= fighting ================= */
let dying=false,clockT=0,lastHurt=-99,regenT=0,prevSw=-1,blockHeld=false;
addEventListener('mousedown',e=>{if(e.button===2)blockHeld=true;});addEventListener('mouseup',e=>{if(e.button===2)blockHeld=false;});
V.canvas.addEventListener('contextmenu',e=>e.preventDefault());
{const sb=$('#swing');let t=0;if(sb){sb.addEventListener('touchstart',()=>{clearTimeout(t);t=setTimeout(()=>{blockHeld=true;},230);},{passive:true});   // on touch: tap Swing to strike, hold it to block
  for(const ev of ['touchend','touchcancel'])sb.addEventListener(ev,()=>{clearTimeout(t);blockHeld=false;},{passive:true});}}
// --- being hurt ---
function hurt(dmg,src){if(dying||!V.started)return;
  if(G.block){const dx=src.x-P.x,dz=src.z-P.z,d=Math.hypot(dx,dz)||1;if((-Math.sin(P.yaw)*dx-Math.cos(P.yaw)*dz)/d>.2)dmg=Math.ceil(dmg*.25);}
  if(S.gear.mail)dmg=Math.ceil(dmg*.6);else if(S.gear.jack)dmg=Math.ceil(dmg*.8);
  S.hp-=dmg;lastHurt=clockT;hurtFx.style.transition='none';hurtFx.style.opacity=Math.min(1,.45+dmg/30);requestAnimationFrame(()=>{hurtFx.style.transition='';hurtFx.style.opacity=0;});drawHp();
  if(S.hp<=0)die(src);}
function die(src){dying=true;if(G.social)G.social.end();if(view){view=null;shopNPC=null;wrap.style.display='none';}G.modal=true;
  if(LAW(src)){jail(true);return;}
  fade.style.opacity=1;
  setTimeout(()=>{const lost=Math.floor(S.coins/3);S.coins-=lost;S.hp=50;calmAll();standDown(true);G.sneak=false;wear();sneakBtn.classList.remove('on');V.DN.tod=.3;
    const x=V.V[0]+6,z=V.V[1]+16;P.x=x;P.z=z;P.y=V.groundH(x,z);P.yaw=Math.atan2(6,16);P.pitch=.02;
    dying=false;G.modal=false;drawHp();drawHud();save();fade.style.opacity=0;
    V.say('You wake in the village','Someone carried you down in the night'+(lost?', and kept '+lost+(lost===1?' coin':' coins')+' for the trouble.':'.'));},1500);}
// --- things that want to hurt you ---
// Wolves keep to the hills, well away from roads and houses; they are bolder at night. Bandits camp in the golden woods off the west road.
const FOES=[];
function paintWolf(n){const c=n.t.image,g=c.getContext('2d');g.clearRect(0,0,128,24);const Pt=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
  for(let f=0;f<4;f++){const o=f*32,low=f===3,st=f===1?2:f===2?-2:0,hy=low?5:0;
    for(const [lx,d] of [[6,1],[9,-1],[19,1],[22,-1]])Pt(o+lx+st*d,15,2,8,'#3a3834');
    Pt(o+5,8,19,8,'#6e6a64');Pt(o+5,8,19,2,'#8a867e');Pt(o+7,14,14,2,'#56524c');Pt(o+17,7,7,3,'#7c7870');
    Pt(o+1,low?9:6,5,3,'#5e5a54');Pt(o,low?11:5,2,2,'#4a4640');
    Pt(o+22,4+hy,7,7,'#7c7870');Pt(o+27,7+hy,4,3,'#8a867e');Pt(o+30,7+hy,1,1,'#1a1816');Pt(o+23,2+hy,2,3,'#56524c');Pt(o+26,2+hy,2,3,'#56524c');Pt(o+26,6+hy,1,1,'#e8c040');Pt(o+27,10+hy,3,1,'#e8e0d0');}
  n.t.needsUpdate=true;n.sp.scale.set(1.55,1.16,1);}
function paintHound(n){const c=n.t.image,g=c.getContext('2d');g.clearRect(0,0,128,24);const Pt=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
  for(let f=0;f<4;f++){const o=f*32,low=f===3,st=f===1?2:f===2?-2:0,hy=low?5:0;
    for(const [lx,d] of [[6,1],[9,-1],[19,1],[22,-1]])Pt(o+lx+st*d,15,2,8,'#140c18');
    Pt(o+5,8,19,8,'#2a1a30');Pt(o+5,8,19,2,'#3e2848');Pt(o+7,14,14,2,'#1c1222');for(let i=0;i<5;i++)Pt(o+7+i*3,6+(i%2),1,3,'#4a2c58');
    Pt(o+1,low?9:6,5,3,'#1c1222');Pt(o,low?11:5,2,2,'#140c18');
    Pt(o+22,4+hy,7,7,'#2a1a30');Pt(o+27,7+hy,4,3,'#3e2848');Pt(o+26,6+hy,2,1,'#d070ff');Pt(o+29,6+hy,1,1,'#d070ff');Pt(o+27,10+hy,3,1,'#c8b8d8');Pt(o+23,2+hy,2,3,'#1c1222');Pt(o+26,2+hy,2,3,'#1c1222');}
  n.t.needsUpdate=true;n.sp.scale.set(1.75,1.3,1);}
(function populate(){
  const far=(x,z,c,r)=>Math.hypot(x-c[0],z-c[1])>r,castle=V.cw(0,0),start=V.roads.forest||[];
  const flat=(x,z)=>Math.abs(V.groundH(x+5,z)-V.groundH(x-5,z))<3&&Math.abs(V.groundH(x,z+5)-V.groundH(x,z-5))<3;
  const dens=[];
  const WB=V.WB||{x0:-1250,x1:850,z0:-1250,z1:280};for(let i=0;i<9000&&dens.length<(V.WD?11:6);i++){const x=R(Math.max(-1500,WB.x0+150),Math.min(1300,WB.x1-150)),z=R(Math.max(-1250,WB.z0+150),Math.min(1300,WB.z1-150));
    if(!V.allowed(x,z)||V.roadDist(x,z)<45||!flat(x,z)||V.nearStream(x,z,10)||V.floorH(x,z)>-1e8)continue;
    if(!far(x,z,V.V,180)||!far(x,z,V.TOWN_C,180)||!far(x,z,V.INN,130)||!far(x,z,castle,230)||!far(x,z,V.RUIN,90))continue;
    if(start.some(p=>Math.hypot(x-p[0],z-p[1])<150)||dens.some(p=>Math.hypot(x-p[0],z-p[1])<170))continue;
    dens.push([x,z]);const k=rnd()<.5?3:2;
    for(let j=0;j<k;j++){const n=V.spawn('sheep',x+R(-5,5),z+R(-5,5),{anim:'sheep',type:'wander',radius:16,home:[x,z],speed:1.3,talk:false,r:.5,name:'Wolf'});
      paintWolf(n);Object.assign(n,{foe:'wolf',hp:45,maxhp:45,dmg:9,run:7.2,walk:1.3,r0:.5});FOES.push(n);}}
  let camp=null;for(let i=0;i<400&&!camp;i++){const x=-600+R(-60,60),z=-325+R(-50,50);if(V.allowed(x,z)&&V.roadDist(x,z)>22&&flat(x,z)&&V.floorH(x,z)<-1e8&&!V.nearStream(x,z,8))camp=[x,z];}
  if(camp)for(let j=0;j<3;j++){const n=V.spawn('bandit',camp[0]+R(-5,5),camp[1]+R(-5,5),{type:'wander',radius:11,home:camp,speed:1.2,talk:false,name:'Bandit'});
    Object.assign(n,{foe:'bandit',hp:70,maxhp:70,dmg:14,run:5.7,walk:1.2,r0:n.r});FOES.push(n);PEOPLE.push(n);}
  if(V.WD)for(const rid of ['w_monamber','w_ashsouth','w_westmill']){const P=V.roads[rid];if(!P)continue;let spot=null;
    for(let i=0;i<300&&!spot;i++){const p=P[Math.floor(P.length*R(.3,.7))],a=R(0,6.283),d=R(22,40),x=p[0]+Math.cos(a)*d,z=p[1]+Math.sin(a)*d;if(V.allowed(x,z)&&V.roadDist(x,z)>18&&flat(x,z)&&!V.nearStream(x,z,8)&&V.floorH(x,z)<-1e8)spot=[x,z];}
    if(spot)for(let j=0;j<2;j++){const n=V.spawn('bandit',spot[0]+R(-4,4),spot[1]+R(-4,4),{type:'wander',radius:9,home:spot,speed:1.1,talk:false,name:'Bandit'});
      Object.assign(n,{foe:'bandit',hp:65,maxhp:65,dmg:12,run:5.6,walk:1.1,r0:n.r});FOES.push(n);PEOPLE.push(n);}}
  if(V.WD){const A=V.WD.places.find(p=>p.id==='ashford'),Hh=V.WD.places.find(p=>p.id==='heart');
    for(const [c,k,r0,r1] of [[A,4,90,170],[Hh,5,60,200]]){if(!c)continue;for(let j=0,m=0;j<200&&m<k;j++){const a=R(0,6.283),d=R(r0,r1),x=c.x+Math.cos(a)*d,z=c.z+Math.sin(a)*d;if(!V.allowed(x,z)||V.nearStream(x,z,6))continue;
      const n=V.spawn('sheep',x,z,{anim:'sheep',type:'wander',radius:28,home:[x,z],speed:1.1,talk:false,r:.55,name:'Blight hound'});paintHound(n);Object.assign(n,{foe:'hound',hp:75,maxhp:75,dmg:13,run:7.6,walk:1.1,r0:.55});FOES.push(n);m++;}}}
  G.dens=dens;G.camp=camp;
})();
function calm(n){n.angry=false;n.speed=n.walk;unwind(n);go(n,n.home[0],n.home[1],3,halt);n.ghost=true;}
function calmAll(){for(const n of FOES)if(n.drive){n.angry=false;n.speed=n.walk;unwind(n);halt(n);n.x=n.home[0];n.z=n.home[1];}}
// A blow lands half a second after they close with you, and you can see it coming: they rear up first. Back off or block.
function unwind(n){n.wind=0;if(n.bs)n.sp.scale.set(n.bs[0],n.bs[1],1);}
function strike(n,d,dt){if(G.modal||dying)return;const b=n.bs||(n.bs=[n.sp.scale.x,n.sp.scale.y]);n.wind=n.wind||0;
  if(n.wind<0){n.wind=Math.min(0,n.wind+dt);const k=Math.max(0,(-n.wind-.72)/.18);n.sp.scale.set(b[0]*(1+.14*k),b[1]*(1-.1*k),1);return;}   // the lunge, then recovery
  if(d<2){n.wind+=dt;if(n.wind>=.5){n.wind=-.9;if(d<2.4)hurt(n.dmg,n);}}else n.wind=0;
  const k=n.wind>0?n.wind/.5:0;n.sp.scale.set(b[0]*(1-.1*k),b[1]*(1+.2*k),1);}
const THREAT=['Your purse, or your blood!','Wrong woods to wander in, friend.','Hold still. This will not take long.'];
function foes(dt){const night=V.DN.tod<.25||V.DN.tod>.8;
  for(const n of FOES){
    if(n.gone||n.dead||n.down)continue;
    const d=Math.hypot(n.x-P.x,n.z-P.z),hd=Math.hypot(n.x-n.home[0],n.z-n.home[1]);
    if(!n.angry){if(d>40||G.modal||dying||hd>60||S.jailed)continue;
      const sense=n.foe==='hound'?d<(night?30:20)*(G.sneak?.6:1):n.foe==='wolf'?d<(night?24:13)*(G.sneak?.6:1):(n.sees||d<4);
      if(sense){n.angry=true;n.speed=n.run;go(n,P.x,P.z,1.5);if(n.foe==='bandit')speak(n,THREAT[(Math.random()*THREAT.length)|0]);}continue;}
    if(dying||hd>80||d>48){calm(n);continue;}
    if(!n.drive)go(n,P.x,P.z,1.5);n.goal=[P.x,P.z];n.stop=1.5;n.ghost=false;if(d<1.7)n.face=Math.atan2(P.x-n.x,P.z-n.z);
    strike(n,d,dt);}
  for(const g of WATCH)if(g.fight&&g.hunt&&!g.down)strike(g,Math.hypot(g.x-P.x,g.z-P.z),dt);
  for(const n of PEOPLE)if(n.down){n.state='idle';n.timer=9;n.route=null;n.downT-=dt;if(n.downT<=0){n.down=false;n.looted=false;n.hp=n.maxhp;n.angry=false;if(n.foe)n.speed=n.walk;heal(n);if(n.homeF)n.phaseR=null;}}
    else if(n.hurtT>0){n.hurtT-=dt;if(n.hurtT<=0){n.hp=n.maxhp;heal(n);}}}
// --- your sword ---
const puff=(()=>{const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.fillStyle='#fff6d8';for(const [x,y,w,h] of [[7,1,2,14],[1,7,14,2],[4,4,2,2],[10,4,2,2],[4,10,2,2],[10,10,2,2]])g.fillRect(x,y,w,h);
  const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false,fog:false}));sp.visible=false;V.scene.add(sp);return {sp,t:0};})();
const SHEEP=V.NPCS.filter(n=>n.anim==='sheep'&&!n.foe);
const HITTABLE=PEOPLE.filter(n=>n.role!=='child').concat(FOES.filter(n=>n.foe==='wolf'||n.foe==='hound'),SHEEP);
// two traits each: bold or timid, hot-tempered or mild. Shepherds will always stand up for the flock.
for(const n of PEOPLE){const a=rnd(),b=rnd();n.bold=LAW(n)||!!n.foe||n.role==='shepherd'||(n.role!=='child'&&a<(/smith|woodcutter|farmer|soldier/.test(n.role)?.7:.3));n.hot=n.role==='shepherd'||b<.35;}
for(const s of SHEEP){let o=null,od=50;for(const p of PEOPLE)if(p.role==='shepherd'){const d=Math.hypot(p.x-s.x,p.z-s.z);if(d<od){od=d;o=p;}}s.owner=o;}
const YELP=['Help! Help!','Murder! Guards!','Stop! Please!','Somebody help me!'];
function flee(n){if(n.fixedY!==undefined||n.drive)return;n.sit=false;n.route=null;n.routeGo=0;const dx=n.x-P.x,dz=n.z-P.z,d=Math.hypot(dx,dz)||1;
  if(!n.fleeS)n.fleeS=n.speed;n.speed=4.6;go(n,n.x+dx/d*24,n.z+dz/d*24,1,sendHome);n.driveT=7;}
function attack(){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);let n=null,bd=2.7;lastSword=clockT;
  for(const m of HITTABLE){if(m.gone||m.down||m.sleep||m.dead)continue;const dx=m.x-P.x,dz=m.z-P.z;if(dx>3||dx<-3||dz>3||dz<-3)continue;const d=Math.hypot(dx,dz);
    if(d>=bd||Math.abs(m.y-P.y)>1.8||(d>.9&&(dx*fx+dz*fz)/d<.45))continue;n=m;bd=d;}
  if(!n)return;
  look();const person=n.anim==='person',unseen=person&&!n.sees,dmg=(unseen?50:25)*(S.gear.steel?1.5:1),law=LAW(n);
  puff.sp.position.set(n.x-fx*.3,n.y+(person?1.2:.6),n.z-fz*.3);puff.sp.scale.set(.9,.9,1);puff.sp.visible=true;puff.t=.16;
  if(n.fixedY===undefined&&!n.sit){const x=n.x+fx*.6,z=n.z+fz*.6;if(!V.wallHit(x,z,.4)&&!V.castleBlocked(x,z)){n.x=x;n.z=z;}}
  if(n.hp===undefined){n.hp=n.maxhp=person?(law?90:40):30;if(person)n.dmg=n.dmg||(law?12:5);}
  n.hp-=dmg;gore(n,n.hp<=0?18:9);
  if(n.foe){n.angry=true;n.speed=n.run;
    if(n.hp>0)return;
    if(n.foe==='wolf'){n.angry=false;corpse(n,300);give('pelt');tell('pelt','+1 Wolf pelt');if(G.quests)G.quests.kill('wolf',n);}
    else if(n.foe==='hound'){n.angry=false;corpse(n,240);tell(null,'The thing stops moving. The grass under it is already grey.');}
    else{const c=8+((Math.random()*13)|0);halt(n);unwind(n);n.down=true;n.downT=180;n.angry=false;pool(n);S.coins+=c;tell('coin','+'+c+' coins from the bandit');if(Math.random()<.6){give('pick');tell('pick','+1 Lockpick');}if(G.quests)G.quests.kill('bandit',n);}
    drawHud();save();return;}
  if(!person){livestock(n);drawHud();save();return;}
  // someone who was minding their own business: that is assault, if anyone lives to tell the watch it was you
  const out=n.hp<=0;
  if(out){if(n.hunt){n.speed=n.hunt.speed;n.hunt=null;}if(n.fleeS){n.speed=n.fleeS;n.fleeS=0;}halt(n);unwind(n);n.down=true;n.looted=false;n.downT=law?60:90;n.route=null;n.routeGo=0;n.sit=false;n.fight=false;n.fear=!law;pool(n);}
  else n.hurtT=150;
  if(law&&!out){crime('You struck the watch',25,{victim:n,violent:true,known:true});speak(n,'To arms! To arms!');for(const g of WATCH)if(!g.down&&Math.hypot(g.x-P.x,g.z-P.z)<30){hunt(g,false);g.fight=true;}}
  else if(!crime(out?n.name+' struck down':'Assault',(law?25:20)+(out?15:0),{victim:n,self:out?null:n,violent:true}))tell(null,n.name+' is out cold. No one saw.');
  drawHud();save();}
/* ================= locks ================= */
// Homes shut their doors at night. Chests are always locked. A lockpick and a steady hand open both; being seen at it is a crime.
const LOCKS=[];let nearLock=null,PK=null;
const isNight=()=>V.DN.tod>=.88||V.DN.tod<.27;
const pinsFor=(x,z)=>V.inCourt(x,z)?4:Math.hypot(x-V.TOWN_C[0],z-V.TOWN_C[1])<130?3:2;
function mkSeg(x0,z0,x1,z1){const w=[x0,z0,x1,z1];w.r=[x0,z0,x1,z1];V.indexWall(w);return w;}
function bar(L,shut){L.shut=shut;L.mesh.visible=shut;const w=L.seg;for(let i=0;i<4;i++)w[i]=shut?w.r[i]:1e6;}
{const geo=new THREE.BoxGeometry(1.4,2.3,.1);
 for(const f of V.FLOORS){if(!f.door||f.inn||f.upper||!f.bed)continue;const c=Math.cos(f.ry),s=Math.sin(f.ry),lz=f.hd-.3,cx=f.x+lz*s,cz=f.z+lz*c;
  const m=new THREE.Mesh(geo,V.M.door);m.position.set(cx,f.y+1.15,cz);m.rotation.y=f.ry;V.scene.add(m);
  const L={kind:'door',x:cx,z:cz,y:f.y,nx:s,nz:c,seg:mkSeg(cx-.8*c,cz+.8*s,cx+.8*c,cz-.8*s),mesh:m,pins:pinsFor(cx,cz),forced:false,reach:1.8,home:f};bar(L,false);LOCKS.push(L);
  if(f.chest)LOCKS.push({kind:'chest',id:'k'+LOCKS.length,x:f.chest[0],z:f.chest[1],y:f.y,pins:pinsFor(cx,cz),rich:V.inCourt(cx,cz),reach:1.7,home:f});}}
// --- the gaol: a stone lock-up in the castle barracks, by the smithy, with a barred door and a chest for what they take off you ---
const J=(function gaol(){let best=null,bs=1e9;
  // Find a clear courtyard plot large enough for the whole guardhouse.
  for(let lx=-45;lx<=45;lx+=4)for(let lz=-40;lz<=34;lz+=4){const p=V.cw(lx,lz),x=p[0],z=p[1];let ok=true;
   for(let dx=-7;dx<=7;dx+=2)for(let dz=-4;dz<=11;dz+=2){const xx=x+dx,zz=z+dz;if(!V.inCourt(xx,zz)||!V.allowed(xx,zz)||V.floorH(xx,zz)>-1e8||V.wallHit(xx,zz,.5))ok=false;}
   if(!ok)continue;const sp=V.cw(34,-20),score=Math.hypot(x-sp[0],z-sp[1])-.4*Math.hypot(x-V.GATEW.x,z-V.GATEW.z);if(score<bs){bs=score;best=[x,z,V.CTOP];}}   // by the smithy and the soldiers, well away from the gate
  if(!best){console.warn('No clear courtyard plot for the guardhouse');return null;}
  const [x,z,hi]=best,y=hi+.45,K=V.kit(),B=V.boxUV;
  K.add(B(5,2.6,4.2,2),'stone',x,y-1.36,z);
  K.add(B(4.9,2.6,.3,2),'ashlar',x,y+1.3,z-1.95);for(const sd of [-1,1]){K.add(B(.3,2.6,4.2,2),'ashlar',x+sd*2.3,y+1.3,z);K.add(B(1.75,2.6,.3,2),'ashlar',x+sd*1.425,y+1.3,z+1.95);}
  K.add(B(1.1,.5,.3,2),'ashlar',x,y+2.35,z+1.95);K.add(B(5.5,.25,4.8,2),'slate',x,y+2.72,z);
  K.add(B(1.9,.22,.9,1),'thatch',x-1.15,y+.05,z-1.3);
  const cx=x+1.75,cz=z+2.6,cy=V.terrainH(cx,cz);K.add(B(.9,.55,.5,1),'wood',cx,cy+.27,cz);K.add(B(.94,.08,.54,1),'iron',cx,cy+.5,cz);
  // The cell occupies the rear of a larger barracks, with a desk and bunks in front.
  K.add(B(13,.45,15,1),'stone',x,y-.25,z+3.5);
  K.add(B(13,4.5,.4,1),'ashlar',x,y+2.25,z-4);
  for(const sd of [-1,1]){K.add(B(.4,4.5,15,1),'ashlar',x+sd*6.5,y+2.25,z+3.5);K.add(B(5.5,4.5,.4,1),'ashlar',x+sd*3.75,y+2.25,z+11);
   mkSeg(x+sd*6.5,z-4,x+sd*6.5,z+11);mkSeg(x+sd,z+11,x+sd*6.5,z+11);
   for(const zz of [4,7]){K.add(B(2,.5,1.1,1),'wood',x+sd*4.7,y+.25,z+zz);K.add(B(1.9,.15,1,1),'thatch',x+sd*4.7,y+.6,z+zz);}}
  mkSeg(x-6.5,z-4,x+6.5,z-4);K.add(B(2,1.7,.4,1),'ashlar',x,y+3.65,z+11);
  V.roofOn(K,13,15,4.5,3,'slate','ashlar',.6,0,x,y,z+3.5);
  K.add(B(2.2,.18,1,1),'wood',x+3,y+1,z+2.8);
  V.FLOORS.push({x,z:z+3.5,ry:0,hw:6.5,hd:7.5,y,r:11});
  if(V.clearPlants)V.clearPlants(x,z+3.5,7.2,8.2);   // no lawn flowers growing through the floor
  const barracksM={...V.M,ashlar:V.M.ashlar.clone()};barracksM.ashlar.side=THREE.DoubleSide;K.build(barracksM,V.scene);V.trees.push([cx,cz,.45]);
  const g=new THREE.Group(),K2=V.kit();for(let i=0;i<6;i++)K2.add(new THREE.BoxGeometry(.07,2.1,.07),'iron',-.5+i*.2,1.05,0);for(const h of [.25,1.1,1.95])K2.add(new THREE.BoxGeometry(1.1,.07,.07),'iron',0,h,0);
  K2.build(V.M,g);g.position.set(x,y,z+1.95);V.scene.add(g);
  V.FLOORS.push({x,z,ry:0,hw:2.3,hd:2.1,y,r:3.8});
  mkSeg(x-2.45,z-1.95,x+2.45,z-1.95);mkSeg(x-2.3,z-2.1,x-2.3,z+2.1);mkSeg(x+2.3,z-2.1,x+2.3,z+2.1);mkSeg(x-2.45,z+1.95,x-.55,z+1.95);mkSeg(x+.55,z+1.95,x+2.45,z+1.95);
  const door={kind:'cell',x,z:z+1.95,y,nx:0,nz:1,seg:mkSeg(x-.55,z+1.95,x+.55,z+1.95),mesh:g,pins:4,forced:false,reach:1.7};bar(door,true);
  LOCKS.push(door,{kind:'straw',x:x-1.15,z:z-1.2,y,reach:1.7},{kind:'evidence',x:cx,z:cz,y:cy,pins:3,reach:1.7});
  return {x,z,y,door,out:[x,z+3.7]};})();
if(J){const places=document.getElementById('devPlaces');if(places){const b=document.createElement('button');b.textContent='Barracks and cells';b.onclick=()=>V.tp(J.x,J.z+9,0,.02);places.appendChild(b);}}
// --- picking: a pin slides back and forth; set it while it sits in the notch. Miss and the pick snaps. ---
function newPin(){const L=PK.L,w=Math.max(.09,.25-.035*PK.set-.025*(L.pins-2));PK.w=w;PK.a=.04+Math.random()*(.92-w);PK.v=.7+.2*PK.set+.12*(L.pins-2);}
function startPick(L){if(!count('pick')){tell(null,'You need a lockpick.');return;}if(crime('Lockpicking',10,{home:L.home})){drawHud();save();return;}
  PK={L,set:0,pos:Math.random(),dir:1,t:0};newPin();open('lock');requestAnimationFrame(lockLoop);}
function lockLoop(ts){if(view!=='lock'||!PK)return;const dt=PK.t?Math.min(.05,(ts-PK.t)/1000):0;PK.t=ts;PK.pos+=PK.dir*PK.v*dt;if(PK.pos>1){PK.pos=2-PK.pos;PK.dir=-1;}if(PK.pos<0){PK.pos=-PK.pos;PK.dir=1;}
  const m=box.querySelector('#vgLock b');if(m)m.style.left=PK.pos*100+'%';requestAnimationFrame(lockLoop);}
function lockTry(){if(view!=='lock'||!PK)return;
  if(PK.pos>=PK.a&&PK.pos<=PK.a+PK.w){PK.set++;if(PK.set>=PK.L.pins){const L=PK.L;PK=null;view='done';close();unlock(L);return;}note='A pin sets.';newPin();}
  else{take('pick');PK.set=Math.max(0,PK.set-1);note='The pick snaps'+(PK.set?', and a pin drops back.':'.');if(!count('pick')){PK=null;view='done';close();tell(null,'Your last lockpick snapped.');return;}newPin();}
  draw();}
const LOOT=[['candlestick',3],['jug',3],['cloth',2],['cheese',2],['ring',1]];
function unlock(L){
  if(L.kind==='door'||L.kind==='cell'){L.forced=true;bar(L,false);tell(null,'The lock gives.');}
  else if(L.kind==='chest'){S.picked[L.id]=Date.now();const c=(8+((Math.random()*18)|0))*(L.rich?2:1);S.coins+=c;let got='+'+c+' coins';
    if(Math.random()<.6){let t=0;for(const e of LOOT)t+=e[1];let r=Math.random()*t,k=LOOT[0][0];for(const e of LOOT){r-=e[1];if(r<0){k=e[0];break;}}if(L.rich&&Math.random()<.4)k='ring';give(k);S.hot[k]=(S.hot[k]||0)+1;got+=', '+ITEMS[k].n.toLowerCase();}
    if(!crime(got,15,{home:L.home}))tell('coin',got+' — stolen. No one saw.');}
  else if(L.kind==='evidence'){let n=0;for(const k in S.evidence){give(k,S.evidence[k]);S.hot[k]=(S.hot[k]||0)+S.evidence[k];n+=S.evidence[k];}S.evidence={};if(!crime('Your things, taken back',15))tell(null,'You take back what they took from you.');}
  drawHud();save();}
function useLock(L){
  if(L.kind==='body'){const n=L.n;n.looted=true;const c=2+((Math.random()*9)|0);S.coins+=c;if(!crime('+'+c+' coins',10,{victim:n}))tell('coin','+'+c+' coins from '+n.name+'. No one saw.');drawHud();save();return;}
  if(L.kind==='boat'){row();return;}
  if(L.kind==='straw'){serve();return;}
  if(L.kind==='door'&&(P.x-L.x)*L.nx+(P.z-L.z)*L.nz<0){L.forced=true;bar(L,false);return;}   // from inside, a house door just opens
  startPick(L);}
function lockHint(L){if(L.kind==='boat')return BOAT.at==='pier'?'row out to the island':'row back to the pier';if(L.kind==='body')return 'search '+L.n.name;if(L.kind==='straw')return 'sleep off your sentence';if(L.kind==='chest')return 'pick the chest lock';if(L.kind==='evidence')return 'pick the evidence chest';
  if(L.kind==='door'&&(P.x-L.x)*L.nx+(P.z-L.z)*L.nz<0)return 'open the door';return 'pick the lock';}
function findLock(){let best=null,bd=9;for(const L of LOCKS){const dx=L.x-P.x,dz=L.z-P.z;if(dx>2||dx<-2||dz>2||dz<-2||Math.abs(L.y-P.y)>1.5)continue;const d=Math.hypot(dx,dz);if(d>L.reach||d>=bd)continue;
    if((L.kind==='door'||L.kind==='cell')&&!L.shut)continue;if(L.kind==='chest'&&S.picked[L.id])continue;if(L.kind==='straw'&&!S.jailed)continue;if(L.kind==='evidence'&&!Object.keys(S.evidence).length)continue;best=L;bd=d;}
  if(!best)for(const n of PEOPLE){if(!n.down||n.looted||n.foe)continue;const d=Math.hypot(n.x-P.x,n.z-P.z);if(d<1.9&&Math.abs(n.y-P.y)<1.5){best={kind:'body',n};break;}}
  if(!best&&BOAT){const b=BOAT[BOAT.at];if(Math.hypot(b[0]-P.x,b[1]-P.z)<3.6&&Math.abs(P.y-V.LAKEY)<2.5)best={kind:'boat'};}
  return best;}
function doors(){const night=isNight();for(const L of LOCKS){if(L.kind==='chest'&&S.picked[L.id]&&Date.now()-S.picked[L.id]>RESTOCK)delete S.picked[L.id];if(L.kind!=='door')continue;if(!night)L.forced=false;const want=night&&!L.forced;
    if(want!==L.shut&&!(want&&Math.hypot(P.x-L.x,P.z-L.z)<1.4))bar(L,want);}}
// --- doing time ---
function serve(){const nights=nightsFor(S.bounty);fade.style.opacity=1;G.modal=true;
  setTimeout(()=>{S.evidence={};S.bounty=0;S.jailed=false;V.DN.tod=.3;S.hp=Math.max(S.hp,60);drawHp();if(J){J.door.forced=false;bar(J.door,true);P.x=J.out[0];P.z=J.out[1];P.y=V.groundH(P.x,P.z);P.yaw=Math.PI;}
    save();fade.style.opacity=0;G.modal=false;drawHud();V.say('Released',(nights===1?'A night':nights+' nights')+' in the cells. Your name is clear.');},1500);}
// E, or the Talk button: take what is at your feet, answer to a guard, or trade with a merchant. Returning true tells the world it was handled.
G.use=function(npc){
  if(view==='lock'){lockTry();return true;}
  if(view){close();return true;}
  if(G.modal)return true;
  if(nearItem){const p=nearItem,it=ITEMS[p.kind];S.picked[p.id]=Date.now();p.sp.visible=false;nearItem=null;
    let got='+1 '+it.n;if(p.kind==='purse'){const c=6+((p.x*7+p.z*13)&7);S.coins+=c;got='+'+c+' coins';}else{give(p.kind);if(p.owned)S.hot[p.kind]=(S.hot[p.kind]||0)+1;}
    if(p.owned){if(!crime(got,it.v+5,{home:p.home}))tell(p.kind,got+' — stolen. No one saw.');}
    else tell(p.kind,got);
    drawHud();save();return true;}
  if(nearLock){useLock(nearLock);return true;}
  if(LAW(npc)&&S.bounty>0&&!S.jailed){caught=false;open('arrest',npc);return true;}
  if(npc&&npc.fear&&!G.sheathed){speak(npc,'Stay back. Put the weapon away.');return true;}
  if(npc&&G.social&&!npc.sleep&&!npc.down&&!npc.foe&&!npc.hunt&&!npc.avenge&&!npc.rep){G.social.init();G.social.meet(npc);open('person',npc);return true;}
  if(npc&&npc.shop&&!npc.sleep&&!G.sheathed){speak(npc,'Put the sword away, and then we can talk business.');return true;}
  if(npc&&npc.shop&&!npc.sleep){const shop=SHOPS[npc.shop];if(S.bounty>0&&!shop.fence){speak(npc,'I do not trade with thieves. Settle up with the guard first.');return true;}open('shop',npc);return true;}
  return false;};
G.tick=function(dt,T){
  if(!V.started)return;
  if(view==='person'&&shopNPC&&(Math.hypot(P.x-shopNPC.x,P.z-shopNPC.z)>4.5||shopNPC.down||shopNPC.hunt||shopNPC.avenge||shopNPC.rep||shopNPC.sleep))close();
  const now=Date.now();
  pace=pace*.8+.2*Math.hypot(P.x-lpx,P.z-lpz)/Math.max(dt,1e-3);lpx=P.x;lpz=P.z;
  G.duck+=((G.sneak?.62:0)-G.duck)*Math.min(1,dt*9);
  if(speakT>0){speakT-=dt;if(speakT<=0)V.talkBox.style.opacity=0;}
  clockT+=dt;
  if(!named&&window._homed)nameAll();
  G.sheathK+=((G.sheathed?1:0)-G.sheathK)*Math.min(1,dt*7);
  if(V.coarse&&!G.sheathed&&clockT-lastSword>30&&!FOES.some(f=>f.angry)&&!WATCH.some(g=>g.hunt))setSheath(true);
  {const b=(blockHeld||V.keys.KeyV)&&!G.modal&&!dying&&!G.sheathed;if(b)lastSword=clockT;if(b!==G.block){G.block=b;wear();}G.blockK=(G.blockK||0)+((b?1:0)-(G.blockK||0))*Math.min(1,dt*14);}
  {const sw=V.swingT;if(prevSw<.38&&sw>=.38)attack();prevSw=sw;}
  if(puff.t>0){puff.t-=dt;if(puff.t<=0)puff.sp.visible=false;}
  foes(dt);gory(dt);reports(dt);avengers(dt);fallen(dt);
  if(S.hp<MAXHP&&!dying&&clockT-lastHurt>12){regenT+=dt;if(regenT>5){regenT=0;S.hp++;drawHp();}}
  chaseT-=dt;if(chaseT<=0){watch(.25+chaseT);chaseT=.25;}
  nearLock=G.modal?null:findLock();
  if(S.jailed&&J&&!G.modal&&Math.hypot(P.x-J.x,P.z-J.z)>3.6){S.jailed=false;S.bounty+=15;tell(null,'You broke out. Fine: '+S.bounty);save();}
  cullT-=dt;if(cullT<=0){cullT=.4;doors();for(const p of PICK){const t=S.picked[p.id];if(t&&now-t>(p.owned?RESTOCK:REGROW)){delete S.picked[p.id];}
    p.sp.visible=!S.picked[p.id]&&Math.abs(p.x-P.x)<110&&Math.abs(p.z-P.z)<110;}
    const c=V.NPCS[0]&&V.NPCS[0].sp.material.color;if(c)for(const k in MATS)MATS[k].color.copy(c);}
  nearItem=null;let bd=2.3;const cx=Math.floor(P.x/CELL),cz=Math.floor(P.z/CELL);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=grid.get((cx+a)+','+(cz+b));if(!l)continue;for(const p of l){if(S.picked[p.id])continue;const d=Math.hypot(p.x-P.x,p.z-P.z);if(d<bd&&Math.abs(p.sp.position.y-P.y)<2){bd=d;nearItem=p;}}}
  sightT-=dt;if(sightT<=0){sightT=.2;look();mood();
    let h='';if(S.jailed)h+='<div class="bad">In the cells</div>';else if(S.bounty>0)h+='<div class="bad">Wanted. Fine: '+S.bounty+'</div>';
    if(REPORTS.length){const r=REPORTS[0];h+='<div class="bad">'+r.w.name+(r.shout?' is calling for the watch':' is running for the watch')+'</div>';}
    if(G.sneak||(nearItem&&nearItem.owned)||(nearLock&&nearLock.pins))h+='<div>'+(watchers.length?'Seen by '+watchers[0].name+(watchers.length>1?' and '+(watchers.length-1)+' more':''):(G.sneak?'Hidden':'Unseen'))+'</div>';
    if(eye.innerHTML!==h)eye.innerHTML=h;eye.style.display=h?'flex':'none';}
  const npc=V.near,H=V.talkHint,B=V.talkBtn;H.style.color='';
  if(G.modal||view==='person'){H.style.opacity=0;B.style.display='none';}
  else if(nearItem){const nm=ITEMS[nearItem.kind].n.toLowerCase();H.textContent=V.coarse?'':'Press E to '+(nearItem.owned?'steal ':'pick ')+nm;if(nearItem.owned)H.style.color='#ffb4a0';H.style.opacity=1;B.textContent=nearItem.owned?'Steal':'Take';if(V.coarse)B.style.display='block';}
  else if(nearLock){H.textContent=V.coarse?'':'Press E to '+lockHint(nearLock);H.style.opacity=1;B.textContent=nearLock.kind==='boat'?'Row':nearLock.kind==='body'?'Search':nearLock.kind==='straw'?'Sleep':'Open';if(V.coarse)B.style.display='block';}
  else{const tr=npc&&npc.shop,law=LAW(npc)&&S.bounty>0&&!S.jailed;H.textContent=V.coarse?'':(law?'Press E to give yourself up':tr?'Press E to trade':'Press E to talk');B.textContent=law?'Yield':tr?'Trade':'Talk';}
  if(hudT>0&&!V.coarse){hudT-=dt;if(hudT<=0&&!G.modal)hud.classList.add('rest');}
  saveT+=dt;if(saveT>10){saveT=0;save();}
};
G.begin=function(){hud.style.display='flex';drawHud();if(!(S.hp>0))S.hp=50;drawHp();if(V.coarse)sneakBtn.style.display='block';
  if(S.pos&&V.allowed(S.pos[0],S.pos[1])){P.x=S.pos[0];P.z=S.pos[1];P.y=V.groundH(P.x,P.z);P.yaw=S.pos[2];P.pitch=.02;}
  if(typeof S.tod==='number')V.DN.tod=S.tod;};

// the start card: continue where you left off, or start over
if(hadSave&&S.pos){const go=$('#go');if(go){go.textContent='Continue';const o=document.createElement('button');o.id='vgOver';o.type='button';o.textContent='New game';
  o.addEventListener('click',()=>{try{localStorage.removeItem(KEY);}catch(e){}S=fresh();G.sneak=false;wear();o.remove();go.textContent='New game';G.sheathed=true;G.sheathK=1;});go.after(o);}}
G.qa={give,take,count,hot,tell,img,save,drawHud,open,close,ITEMS,ICON,view:()=>view,bounty:()=>S.bounty,gear:()=>S.gear,heal(n){S.hp=Math.min(MAXHP,S.hp+n);drawHp();},coins(n){S.coins+=n;drawHud();}};
G.socialAccess={save,count,hot,take,go,halt,ambient(n,line){if(view||speakT>0||S.jailed||!G.sheathed)return false;speak(n,line);return true;}};
G.paintHound=paintHound;G.paintWolf=paintWolf;G.speak=speak;G.addFoe=n=>{FOES.push(n);if(n.anim==="person")PEOPLE.push(n);HITTABLE.push(n);};G.reports=REPORTS;G.attack=attack;G.crime=crime;G.setSheath=setSheath;G.boat=BOAT;G.row=row;G.people=PEOPLE;G.sheep=SHEEP;G.foes=FOES;G.hurt=hurt;G.locks=LOCKS;G.gaol=J;G.jail=jail;G.pk=()=>PK;G.state=()=>S;G.items=ITEMS;G.picks=PICK;G.watchers=()=>watchers;
})();
