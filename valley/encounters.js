/* Things that happen on the road.
   Hand-placed moments, each with something you can see from the road (a cart across the way, a gallows at a fork, smoke over
   the trees, crows circling), and small events that turn up on the roads of the wider world now and then. Plus Old Wenna's
   brewing, which is what the herbs and mushrooms along the verges are for.
   Loaded after game.js and before people.js, so the people here are people like any other (names, memories, trade). */
(function(){
'use strict';
const V=window.__valley,G=V&&V.GAME,THREE=window.THREE;
if(!V||!G||!G.qa||!V.WD)return;
const Q=G.qa,P=V.P,S=()=>G.state();
const E=()=>{const s=S();if(!s.enc)s.enc={done:{},seen:{}};return s.enc;};
const done=k=>!!E().done[k],mark=(k,v)=>{E().done[k]=v||1;Q.save();};
let seed=31337;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;},R=(a,b)=>a+(b-a)*rnd();
const M=V.M,TH=(x,z)=>V.terrainH(x,z),GH=(x,z)=>V.groundH(x,z);
const say=(a,b)=>V.say(a,b),speak=(n,l)=>{if(G.speak)G.speak(n,l);};
const PL=id=>V.WD.places.find(p=>p.id===id);
const nearTown=(x,z,r)=>V.WD.places.some(p=>(p.kind==='town'||p.kind==='camp'||p.kind==='monastery')&&Math.hypot(p.x-x,p.z-z)<(r||p.r+60))||V.inVillage(x,z)||Math.hypot(x-V.TOWN_C[0],z-V.TOWN_C[1])<120;

/* ---------- placing things beside a road ---------- */
function along(id,f){const R0=V.roads[id];if(!R0)return null;const i=Math.max(2,Math.min(R0.length-3,Math.round(f*(R0.length-1)))),a=R0[i-2],b=R0[i+2],p=R0[i];
  const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return {x:p[0],z:p[1],dx:dx/l,dz:dz/l,i,pts:R0};}
const side=(r,s,d,fw)=>[r.x-r.dz*s*d+r.dx*(fw||0),r.z+r.dx*s*d+r.dz*(fw||0)];
const flat=(x,z,r)=>{const h=TH(x,z);for(let a=0;a<6.28;a+=1.05)if(Math.abs(TH(x+Math.cos(a)*r,z+Math.sin(a)*r)-h)>1.6)return false;return true;};
const clear=(x,z,road)=>V.allowed(x,z)&&!V.nearStream(x,z,5)&&V.floorH(x,z)<-1e8&&V.roadDist(x,z)>(road||3);
function spot(id,f,dist,need){for(let k=0;k<40;k++){const r=along(id,f+(k%2?1:-1)*Math.floor(k/2)*.012);if(!r)return null;for(const s of [1,-1]){const [x,z]=side(r,s,dist);if(clear(x,z,dist*.6)&&(!need||need(x,z)))return {r,s,x,z};}}return null;}

/* ---------- small builders ---------- */
const meshes=[];
function add(geo,mat,x,y,z,ry,rx,rz){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,rz||0,'YXZ');V.scene.add(m);meshes.push(m);return m;}
function group(x,z,ry){const g=new THREE.Group();g.position.set(x,TH(x,z),z);g.rotation.y=ry||0;V.scene.add(g);return g;}
const gadd=(g,geo,mat,x,y,z,ry,rx,rz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,rz||0,'YXZ');g.add(m);return m;};
const BOX=(w,h,d)=>V.boxUV?V.boxUV(w,h,d,1.5):new THREE.BoxGeometry(w,h,d);
// soft smoke and a little fire, for a camp you can see over the trees
const SMOKE=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,2,32,32,31);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.55,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
function smokeColumn(x,y,z,h){const sp=[];for(let k=0;k<14;k++){const m=new THREE.SpriteMaterial({map:SMOKE,color:0x55504a,transparent:true,depthWrite:false,fog:false,opacity:0}),s=new THREE.Sprite(m);V.scene.add(s);sp.push({s,ph:k/14});}
  return {x,y,z,h,sp,on:true,tick(t){for(const o of this.sp){const u=(t*.035+o.ph)%1;o.s.visible=this.on;o.s.position.set(this.x+u*9+Math.sin(u*4+o.ph*9)*1.5,this.y+u*this.h,this.z+u*3);o.s.scale.setScalar(4+u*30);o.s.material.opacity=.95*(1-u*.8)*Math.min(1,u*8);}}};}
const FIRE=(()=>{const c=document.createElement('canvas');c.width=16;c.height=16;const g=c.getContext('2d');for(const [x,y,w,h,col] of [[5,6,6,9,'#e8541c'],[6,3,4,10,'#ffb03a'],[7,1,2,8,'#ffd860'],[7,9,2,5,'#fff2b0']]){g.fillStyle=col;g.fillRect(x,y,w,h);}
  const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;return new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});})();
const bloodMat=new THREE.MeshLambertMaterial({color:0x4a1010,transparent:true,opacity:.85,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
const paperMat=new THREE.MeshLambertMaterial({color:0xe8dcb8});
function person(role,x,z,o){const n=V.spawn(role,x,z,Object.assign({type:'stand',face:0,talk:true},o||{}));n.enc=true;return n;}

/* ---------- interaction spots: "Press E to …" ---------- */
const SPOTS=[];   // {x,z,y?,reach,label,btn,ok(),act()}
let near=null;
function useHint(){const H=V.talkHint,B=V.talkBtn;H.textContent=V.coarse?'':'Press E to '+near.label;H.style.color='';H.style.opacity=1;B.textContent=near.btn||'Use';if(V.coarse)B.style.display='block';}

/* ======================================================================== the hand-placed moments */
const ENC={};

// 1. A broken-down cart on the road south: the wheel is off, and the carter cannot lift and fit it at once
(function(){if(done('cart'))return;const r=along('w_south',.2);if(!r)return;
  const ry=Math.atan2(r.dx,r.dz),[cx,cz]=side(r,1,1.2),g=group(cx,cz,ry);
  const wood=M.wood;gadd(g,BOX(1.7,.35,3.2),wood,0,.75,0,0,0,.1);for(const s of [-1,1])gadd(g,BOX(.12,.55,3.2),wood,s*.82,1.1,0,0,0,.1);
  gadd(g,BOX(.12,.12,2.2),wood,0,.55,2.6);gadd(g,BOX(.1,.1,2.2),wood,0,.55,-1.5,0,0,0);
  const wheel=new THREE.CylinderGeometry(.62,.62,.14,12);gadd(g,wheel,wood,.95,.62,.3,0,0,Math.PI/2);
  const loose=gadd(g,wheel,wood,-2.1,.08,-.6,0,0,0);gadd(g,BOX(1,.7,.9),M.thatch,-.2,1.25,-.6,.3);gadd(g,BOX(.8,.6,.8),M.thatch,.35,1.2,.6,-.2);
  const n=person('merchant',cx-r.dz*2.6+r.dx*1.5,cz+r.dx*2.6+r.dz*1.5,{name:'Jory the carter',face:ry+Math.PI/2,lines:'merchant'});n.fixedY=undefined;
  ENC.cart={n,g,loose,r,state:0};
  SPOTS.push({x:cx,z:cz,reach:3.2,label:'take the weight while Jory fits the wheel',btn:'Lift',ok:()=>ENC.cart.state===0,act(){const c=ENC.cart;c.state=1;
    loose.position.set(-.95,.62,.3);loose.rotation.set(0,0,Math.PI/2);g.rotation.z=0;
    speak(n,'Hold it, hold it... there! Bless you. Twelve coins and a loaf, and if you are ever in Oakhurst the first ale is mine.');
    Q.coins(12);Q.give('bread');Q.tell('coin','+12 coins, +1 bread');mark('cart');
    // off he goes, the cart rolling behind him
    const pts=r.pts.slice(r.i).map(p=>[p[0],p[1]]);n.route=pts.filter((p,i)=>i%3===0).slice(0,60);n.routeGo=0;n.speed=1.5;n.talk=false;}});})();

// 2. A gallows where two roads meet, a notice nailed to it, and what the notice does not say
(function(){let best=null;const ids=['w_ashsouth','w_south','w_monamber','w_monnorth','w_monastery','w_west'];
  for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const A=V.roads[ids[a]],B=V.roads[ids[b]];if(!A||!B)continue;
    for(let i=Math.floor(A.length*.15);i<A.length*.85;i+=3)for(let j=Math.floor(B.length*.15);j<B.length*.85;j+=3){const d=Math.hypot(A[i][0]-B[j][0],A[i][1]-B[j][1]);if(d<14&&!nearTown(A[i][0],A[i][1],260)&&(!best||d<best.d))best={d,x:A[i][0],z:A[i][1],id:ids[a],i};}}
  if(!best){const r=along('w_monnorth',.3);if(r)best={x:r.x,z:r.z,id:'w_monnorth',i:r.i};}
  if(!best)return;
  let gx=best.x,gz=best.z;for(let k=0;k<30;k++){const a=k*.7,x=best.x+Math.cos(a)*9,z=best.z+Math.sin(a)*9;if(clear(x,z,6)){gx=x;gz=z;break;}}
  const y=TH(gx,gz),ry=Math.atan2(best.x-gx,best.z-gz);const g=group(gx,gz,ry);
  for(const s of [-1,1])gadd(g,BOX(.3,5.4,.3),M.wood,s*1.6,2.4,0);gadd(g,BOX(4,.3,.34),M.wood,0,5,0);gadd(g,BOX(.3,.3,1.4),M.wood,-1.6,4.4,.5,0,.7);
  gadd(g,new THREE.BoxGeometry(.05,1.1,.05),M.wood,.5,4.35,0);
  const note=gadd(g,new THREE.PlaneGeometry(.45,.6),paperMat,-1.6,1.7,.17);
  const hanged=V.spawn('villager',gx+Math.cos(ry)*.5,gz-Math.sin(ry)*.5,{type:'stand',talk:false,name:'Hanged man',fixedY:y+1.75,tint:0x8a8a90,face:ry});hanged.enc=true;
  // the milestone further along the road
  const R0=V.roads[best.id];let mi=Math.min(R0.length-3,best.i+45),m=null;for(let k=0;k<20&&!m;k++){const p=R0[Math.min(R0.length-3,mi+k)],q=R0[Math.min(R0.length-1,mi+k+2)],dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz)||1,x=p[0]-dz/l*3.4,z=p[1]+dx/l*3.4;if(clear(x,z,2.6))m=[x,z,Math.atan2(dx,dz)];}
  if(m){add(BOX(.6,1.2,.4),M.stone,m[0],TH(m[0],m[1])+.45,m[1],m[2]);add(BOX(.7,.15,.5),M.stone,m[0],TH(m[0],m[1])+1.07,m[1],m[2]);}
  ENC.gallows={x:gx,z:gz,m};
  const c=Math.cos(ry),sn=Math.sin(ry),nx=gx-1.6*c+.6*sn,nz=gz+1.6*sn+.6*c;
  SPOTS.push({x:nx,z:nz,reach:2.6,label:'read the notice',btn:'Read',ok:()=>true,act(){
    say('A notice','EDRIC TANNER, THIEF. HANGED BY ORDER OF THE REEVE OF WESTMILL. LET IT BE A LESSON. Under it, scratched small in another hand: He never stole a thing. He saw what the reeve buried at the old milestone, a little way down the road.');
    if(!E().seen.note){E().seen.note=1;Q.save();}}});
  if(m)SPOTS.push({x:m[0],z:m[1],reach:2.4,label:'dig at the foot of the milestone',btn:'Dig',ok:()=>E().seen.note&&!done('stash'),act(){
    say('The reeve’s stash','A rotten box wrapped in sacking: a heavy purse, and a gold ring with somebody else’s initials in it.');
    Q.coins(45);Q.give('ring');Q.tell('coin','+45 coins, +1 gold ring');mark('stash');}});})();

// 3. Bandits on a bridge: a toll, or a fight
(function(){if(done('bridge'))return;const b=V.WBR.slice().sort((p,q)=>Math.hypot(p.x+412,p.z-932)-Math.hypot(q.x+412,q.z-932))[0];if(!b||Math.hypot(b.x+412,b.z-932)>200)return;
  const crew=[];for(const [al,ac,role] of [[0,0,'bandit'],[-1.6,1.5,'bandit'],[1.8,-1.4,'bandit']]){const x=b.x+b.ux*al-b.uz*ac,z=b.z+b.uz*al+b.ux*ac;
    const n=V.spawn(role,x,z,{type:'stand',talk:false,name:crew.length?'Bandit':'Bandit with a cudgel',face:Math.atan2(b.ux,b.uz)});n.enc=true;
    Object.assign(n,{hp:70,maxhp:70,dmg:13,run:5.6,walk:1.2,r0:n.r,real:[x,z]});n.home=[x+900,z+900];   // not wandering off to fight until it comes to that
    n.foe='bandit';if(G.addFoe)G.addFoe(n);crew.push(n);}
  ENC.bridge={b,crew,state:0,t:0};
  SPOTS.push({get x(){return crew[0].x;},get z(){return crew[0].z;},reach:3.2,label:'pay the toll (10 coins)',btn:'Pay',ok:()=>ENC.bridge.state===1,act(){const B=ENC.bridge;
    if(S().coins<10){speak(crew[0],'Ten. You have not got ten. Then it is the river, or it is us.');return;}
    Q.coins(-10);Q.tell('coin','-10 coins');B.state=3;mark('bridge','paid');speak(crew[0],'A sensible traveller. Mind the third stone, it wobbles.');
    crew.forEach((n,i)=>{n.route=[[n.x+b.uz*(i?2.6:-2.6),n.z-b.ux*(i?2.6:-2.6)]];n.routeGo=0;n.speed=1;});}});})();
function bridgeTick(dt){const B=ENC.bridge;if(!B||B.state>=3)return;const L=B.crew[0],d=Math.hypot(L.x-P.x,L.z-P.z);
  const alive=B.crew.filter(n=>!n.down&&!n.dead);
  if(!alive.length){B.state=3;mark('bridge','won');Q.tell(null,'The bridge is clear.');return;}
  if(B.crew.some(n=>n.angry)&&B.state<2){B.state=2;}
  if(B.state===0&&d<20){B.state=1;B.t=0;speak(L,'Hold there, friend. This bridge has a toll now. Ten coins, or you can swim.');}
  if(B.state===1){B.t+=dt;if(d<1.9||(d<9&&B.t>28)){speak(L,'Wrong answer.');B.state=2;}}
  if(B.state===2)for(const n of B.crew)if(!n.down&&!n.dead){n.home=n.real;if(!n.angry){n.angry=true;n.speed=n.run;}}}

// 4. A hermit by a wayside shrine, and his riddle
(function(){const s=spot('w_monnorth',.55,20,(x,z)=>flat(x,z,4));if(!s)return;const {x,z,r}=s,ry=Math.atan2(r.x-x,r.z-z);
  add(BOX(1.2,1.3,1),M.stone,x,TH(x,z)+.55,z,ry);add(BOX(.25,1.6,.2),M.wood,x,TH(x,z)+1.9,z,ry);add(BOX(1,.2,.2),M.wood,x,TH(x,z)+2.25,z,ry);
  for(let k=0;k<4;k++){const a=k*1.5,cx=x+Math.cos(a)*1.3,cz=z+Math.sin(a)*1.3;add(new THREE.BoxGeometry(.12,.3,.12),paperMat,cx,TH(cx,cz)+.15,cz);const f=new THREE.Sprite(FIRE);f.scale.set(.18,.22,1);f.position.set(cx,TH(cx,cz)+.38,cz);V.scene.add(f);}
  for(let k=0;k<8;k++){const a=k*.8+.3,cx=x+Math.cos(a)*2.2,cz=z+Math.sin(a)*2.2;add(V.boxUV?V.boxUV(.4,.3,.4,1):new THREE.BoxGeometry(.4,.3,.4),M.stone,cx,TH(cx,cz)+.1,cz,a);}
  const n=person('priest',x+Math.sin(ry)*2.2,z+Math.cos(ry)*2.2,{name:'The hermit',face:ry,fixedY:TH(x+Math.sin(ry)*2.2,z+Math.cos(ry)*2.2)});n.encKey='hermit';ENC.hermit={n};})();

// 5. A dead knight just off the road, crows over him, and a trail of blood into the trees
(function(){const s=spot('w_monamber',.33,9,(x,z)=>flat(x,z,3));if(!s)return;const {x,z,r}=s;
  const n=V.spawn('guard',x,z,{type:'stand',talk:false,name:'Dead knight',face:R(0,6)});n.enc=true;n.down=true;n.r=-1;
  {const lx=x+1.6,lz=z-1.1,ly=TH(lx,lz);add(new THREE.CylinderGeometry(.06,.08,4.2,6),M.wood,lx,ly+1.9,lz,0,.12,.08);
   const pen=new THREE.Mesh(new THREE.PlaneGeometry(.9,.45),new THREE.MeshLambertMaterial({color:0x9a2a2a,side:THREE.DoubleSide}));pen.position.set(lx+.55,ly+3.6,lz);V.scene.add(pen);
   add(new THREE.CylinderGeometry(.55,.45,.1,8),new THREE.MeshLambertMaterial({color:0x3a4a7a}),x-1.1,TH(x-1.1,z+.6)+.08,z+.6,0,.15,0);}
  for(let k=0;k<5;k++)V.spawn('bird',0,0,{anim:'bird',fly:true,talk:false,cx:x+R(-4,4),cz:z+R(-4,4),cr:R(5,11),cy:TH(x,z)+R(14,22),w:R(.5,.8)*(k%2?1:-1),a0:R(0,6.3),tint:0x2a2a30});
  // the trail: away from the road, into the woods, to where the thing that did it lies up
  const ax=x-r.x,az=z-r.z,al=Math.hypot(ax,az)||1;let hx=x,hz=z,dirx=ax/al,dirz=az/al;const trail=[];
  for(let k=0;k<34;k++){const turn=Math.sin(k*.4)*.35,c=Math.cos(turn),sn=Math.sin(turn),dx=dirx*c-dirz*sn,dz=dirx*sn+dirz*c,nx=hx+dx*2.4,nz=hz+dz*2.4;
    if(!V.allowed(nx,nz)||V.nearStream(nx,nz,3)||V.roadDist(nx,nz)<6)break;hx=nx;hz=nz;trail.push([hx,hz]);}
  const marks=trail.map(([tx,tz],k)=>{const m=add(new THREE.CircleGeometry(R(.18,.38),6),bloodMat,tx+R(-.4,.4),TH(tx,tz)+.05,tz+R(-.4,.4),0,-Math.PI/2);m.visible=false;return m;});
  const [dx,dz]=trail.length?trail[trail.length-1]:[x+6,z];
  for(let k=0;k<6;k++)add(new THREE.BoxGeometry(.08,.08,R(.4,.8)),M.stone,dx+R(-2,2),TH(dx,dz)+.05,dz+R(-2,2),R(0,6));
  let grey=null;if(!done('grey')){grey=V.spawn('sheep',dx,dz,{anim:'sheep',type:'wander',radius:7,home:[dx,dz],speed:1,talk:false,r:.6,name:'The Grey',scale:1});
    if(G.paintWolf)G.paintWolf(grey);grey.sp.scale.set(1.75,1.35,1);Object.assign(grey,{foe:'wolf',hp:150,maxhp:150,dmg:17,run:7.6,walk:1,r0:.6,enc:true});if(G.addFoe)G.addFoe(grey);}
  ENC.knight={n,marks,grey};
  SPOTS.push({x,z,reach:2.4,label:'search the knight',btn:'Search',ok:()=>!done('knight'),act(){
    say('Ser Aldwin of Highfold','His mail is torn open from the side, not cut. In his belt, a letter to his wife he never finished, and a little money. The blood does not stop here. It goes on, into the trees.');
    Q.coins(18);Q.tell('coin','+18 coins');mark('knight');marks.forEach(m=>m.visible=true);}});
  if(done('knight'))marks.forEach(m=>m.visible=true);})();
function knightTick(){const K=ENC.knight;if(!K||!K.grey||done('grey'))return;if(K.grey.dead){mark('grey');Q.give('pelt',2);Q.give('ring');Q.tell('pelt','+2 wolf pelts, +1 gold ring');
  say('The Grey','Among the bones in its lair: Ser Aldwin’s signet ring. Someone at Highfold will want to know.');}}

// 6. Smoke over the trees: a bandit camp, and a strongbox for whoever can reach it unseen
(function(){const fo=(x,z)=>V.forestAt?V.forestAt(x,z):0;let s=null;for(const f of [.42,.5,.34,.58,.26,.66])if(!s)s=spot('w_ashsouth',f,70,(x,z)=>flat(x,z,7)&&!nearTown(x,z,300)&&fo(x,z)<.3);if(!s)s=spot('w_ashsouth',.42,70,(x,z)=>flat(x,z,7));if(!s)return;const {x,z}=s,y=TH(x,z);
  const sm=smokeColumn(x,y+1,z,60);const fire=new THREE.Sprite(FIRE);fire.position.set(x,y+.55,z);fire.scale.set(1.1,1.1,1);V.scene.add(fire);
  for(let k=0;k<7;k++){const a=k*.9;add(new THREE.BoxGeometry(.5,.25,.35),M.stone,x+Math.cos(a)*.9,y+.1,z+Math.sin(a)*.9,a);}
  for(const a of [.6,2.6,4.4]){const tx=x+Math.cos(a)*5,tz=z+Math.sin(a)*5;add(new THREE.ConeGeometry(1.7,2.2,4,1,true),new THREE.MeshLambertMaterial({color:0x8a7a5c,side:THREE.DoubleSide}),tx,TH(tx,tz)+1.1,tz,a);}
  const bx=x+2.4,bz=z-3.1;const box=add(BOX(1,.6,.65),M.wood,bx,TH(bx,bz)+.3,bz,.4);add(new THREE.BoxGeometry(1.04,.1,.7),M.iron||M.stone,bx,TH(bx,bz)+.45,bz,.4);
  const crew=[];if(!done('camp'))for(let k=0;k<3;k++){const a=k*2.1+.4,nx=x+Math.cos(a)*2.4,nz=z+Math.sin(a)*2.4;const n=V.spawn('bandit',nx,nz,{type:'wander',radius:6,home:[x,z],speed:.8,talk:false,name:'Bandit'});n.enc=true;
    Object.assign(n,{foe:'bandit',hp:65,maxhp:65,dmg:12,run:5.6,walk:.8,r0:n.r});if(G.addFoe)G.addFoe(n);crew.push(n);}
  ENC.camp={sm,fire,crew,box};
  SPOTS.push({x:bx,z:bz,reach:2.2,label:'open the strongbox',btn:'Open',ok:()=>!done('camp'),act(){
    const awake=crew.filter(n=>!n.down&&!n.dead&&(n.angry||(n.sees&&!G.sneak)||Math.hypot(n.x-P.x,n.z-P.z)<4.5));
    if(awake.length){awake.forEach(n=>{n.angry=true;n.speed=n.run;});speak(awake[0],'Oi! Hands off!');return;}
    Q.coins(52);Q.give('pick',2);Q.give('draught');Q.tell('coin','+52 coins, +2 lockpicks, +1 healing draught');mark('camp');box.rotation.z=.4;}});})();

/* ======================================================================== events on the road */
// a few people and animals kept back, out of sight, until the road needs them
const HIDE=[6000,6000];
function pooled(role,o){const n=V.spawn(role,HIDE[0],HIDE[1],Object.assign({type:'stand',talk:false},o));n.enc=true;n.sp.visible=false;n.pool=true;return n;}
const POOL={traveller:pooled('woman',{name:'Traveller',fixedY:0}),pedlar:pooled('merchant',{name:'Pedlar',fixedY:0}),deer:[0,1,2].map(i=>pooled('deer',{anim:'deer',stag:i===0,fixedY:0}))};
POOL.pedlar.shop='pedlar';
function show(n,x,z){n.x=x;n.z=z;n.fixedY=undefined;n.sp.visible=true;n.route=null;n.routeGo=0;}
function hide(n){n.x=HIDE[0];n.z=HIDE[1];n.fixedY=0;n.sp.visible=false;n.route=null;n.routeGo=0;n.talk=false;}
const RUMOURS=['They say the monks at the monastery have stopped ringing for vespers. Nobody knows why.','My cousin in Amberley swears the trees there turned gold in a single night, years back, and never turned back.',
  'If you see lights in the Old Wood, do not follow them. That is all I will say about that.','There is a hermit up the north road who will not give you a thing unless you can answer him.',
  'A knight rode out toward Amberley a week ago, alone. Too proud for company, my husband said.','The reeve of Westmill hanged a man at the crossroads. Half the town says he deserved it. The other half will not talk about it.'];
let EV=null,evT=60+R(0,60),cool={};
function onWorldRoad(){return V.roadDist(P.x,P.z)<7&&(V.lockW?V.lockW(P.x,P.z)<.5:true)&&!nearTown(P.x,P.z);}
function roadAhead(dist){// the nearest world road point, and the way you are heading along it
  let best=null;for(const r of V.WD.roads){const R0=V.roads[r.id];if(!R0)continue;for(let i=0;i<R0.length;i+=2){const d=Math.hypot(R0[i][0]-P.x,R0[i][1]-P.z);if(!best||d<best.d)best={d,R0,i};}}
  if(!best||best.d>9)return null;const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),R0=best.R0,i=best.i,j=Math.min(R0.length-1,i+3),dx=R0[j][0]-R0[i][0],dz=R0[j][1]-R0[i][1];
  const dir=(dx*fx+dz*fz)>=0?1:-1;let k=i,acc=0;while(acc<dist&&k+dir>0&&k+dir<R0.length-1){acc+=Math.hypot(R0[k+dir][0]-R0[k][0],R0[k+dir][1]-R0[k][1]);k+=dir;}
  if(acc<dist*.8)return null;const a=R0[Math.max(0,k-1)],b=R0[Math.min(R0.length-1,k+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  return {x:R0[k][0],z:R0[k][1],dx:(b[0]-a[0])/l*dir,dz:(b[1]-a[1])/l*dir,k,dir,R0};}
function startEvent(){const night=V.DN.tod<.23||V.DN.tod>.8,east=P.x>820;
  const opts=east?[['hound',night?6:3],['traveller',1]]:[['traveller',night?.5:3],['pedlar',night?0:2],['deer',night?1:3]];
  const pool=opts.filter(([k])=>!(cool[k]>0));let tot=pool.reduce((a,b)=>a+b[1],0);if(!tot)return;let q=rnd()*tot,kind=pool[0][0];for(const [k,w] of pool){q-=w;if(q<=0){kind=k;break;}}
  const ra=roadAhead(kind==='deer'?32:kind==='hound'?40:46);if(!ra)return;cool[kind]=kind==='pedlar'?600:240;
  if(kind==='traveller'){const n=POOL.traveller;show(n,ra.x-ra.dz*1.2,ra.z+ra.dx*1.2);n.talk=true;const pts=[];for(let k=ra.k,c=0;k>0&&k<ra.R0.length-1&&c<120;k+=ra.dir,c++)if(c%3===0)pts.push([ra.R0[k][0]-ra.dz*1.2,ra.R0[k][1]+ra.dx*1.2]);
    n.route=pts;n.routeGo=0;n.speed=1.3;EV={kind,n,walked:0,lx:P.x,lz:P.z,said:0,t:0};}
  else if(kind==='pedlar'){const n=POOL.pedlar,x=ra.x-ra.dz*3.4,z=ra.z+ra.dx*3.4;show(n,x,z);n.fixedY=TH(x,z);n.face=n.face0=Math.atan2(-ra.dz*-1,ra.dx*-1);n.face0=n.face=Math.atan2(ra.x-x,ra.z-z);n.talk=true;EV={kind,n,t:0,said:0};}
  else if(kind==='deer'){const s=rnd()<.5?1:-1,list=POOL.deer.slice(0,2+(rnd()<.5?1:0));list.forEach((n,i)=>{const x=ra.x-ra.dz*s*16+ra.dx*i*2.2,z=ra.z+ra.dx*s*16+ra.dz*i*2.2;show(n,x,z);n.speed=0;n.wait=.4+i*.35;n.goal=[ra.x+ra.dz*s*26+ra.dx*(i*2.2+4),ra.z-ra.dx*s*26+ra.dz*(i*2.2+4)];});EV={kind,list,t:0};}
  else if(kind==='hound'){const x=ra.x-ra.dz*5,z=ra.z+ra.dx*5;const n=V.spawn('sheep',x,z,{anim:'sheep',type:'stand',talk:false,r:.55,name:'Wounded hound'});if(G.paintHound)G.paintHound(n);
    Object.assign(n,{foe:'hound',hp:35,maxhp:75,dmg:11,run:5,walk:.4,r0:.55,enc:true});n.home=[x+900,z+900];if(G.addFoe)G.addFoe(n);n.sp.scale.set(1.2,.85,1);EV={kind,n,t:0,x,z};}}
function eventTick(dt){if(!EV){if(!V.started||G.modal)return;evT-=dt;for(const k in cool)cool[k]-=dt;if(evT<=0){evT=70+R(0,90);if(onWorldRoad()&&rnd()<.75)startEvent();}return;}
  const e=EV;e.t+=dt;
  if(e.kind==='traveller'){const n=e.n,d=Math.hypot(n.x-P.x,n.z-P.z);
    if(d<14){e.walked+=Math.hypot(P.x-e.lx,P.z-e.lz);if(!e.said&&d<6){e.said=1;speak(n,'Oh! You gave me a fright. Going my way? Walk with me a while, the road is long and I talk too much.');}
      if(e.said===1&&e.walked>60){e.said=2;speak(n,RUMOURS[(rnd()*RUMOURS.length)|0]);}
      if(e.said===2&&e.walked>170){e.said=3;speak(n,'Here is where I leave the road. Thank you for the company. Take this, for your trouble.');Q.coins(6);Q.give('apple');Q.tell('coin','+6 coins, +1 apple');n.route=null;}}
    e.lx=P.x;e.lz=P.z;if((d>110||e.t>420)&&!onScreen(n)){hide(n);EV=null;}}
  else if(e.kind==='pedlar'){const n=e.n,d=Math.hypot(n.x-P.x,n.z-P.z);if(!e.said&&d<9){e.said=1;speak(n,'Needles, picks, a draught for the road! Come and look, it costs nothing to look.');}if(d>160&&!onScreen(n)){hide(n);EV=null;}}
  else if(e.kind==='deer'){for(const n of e.list){if(n.wait>0){n.wait-=dt;if(n.wait<=0){n.route=[n.goal];n.routeGo=0;n.speed=9.5;n.routeEnd=m=>{m.sp.visible=false;};}}}
    if(e.t>9){e.list.forEach(hide);EV=null;}}
  else if(e.kind==='hound'){const n=e.n,d=Math.hypot(n.x-P.x,n.z-P.z);if(!n.angry&&d<8&&!n.dead){n.home=[e.x,e.z];n.angry=true;n.speed=n.run;}
    if(n.dead&&!e.said){e.said=1;Q.tell(null,'It was half dead already. Something had been at it.');}
    if((d>130||e.t>400)&&!onScreen(n)){n.sp.visible=false;n.gone=true;n.x=HIDE[0];n.z=HIDE[1];EV=null;}}}
const _v=new THREE.Vector3();function onScreen(n){const c=V.scene&&window.__valley;if(!n.sp.visible)return false;_v.set(n.x,n.y+1,n.z);const cam=V.camera;if(!cam)return Math.hypot(n.x-P.x,n.z-P.z)<60;_v.project(cam);return Math.abs(_v.x)<1&&Math.abs(_v.y)<1&&_v.z<1;}

/* ======================================================================== conversations: the hermit, Old Wenna's brewing */
const HL={
  h1:'Not a father. Not anyone’s, now. Sit, if you like. You look like someone who walks a great deal and thinks very little. Answer me this and I will give you something for the road: I have roots that nobody sees, I am taller than the trees; up, up I go, and yet I never grow. What am I?',
  hyes:'A mountain. There: you can think after all. Take these. A hermit does not need medicine, he needs fewer visitors. And when you go east, go by day. The Old Wood knows who walks in it.',
  hno:'No. Walk a while and think on it. I will still be here; I have nowhere else to be.',
  hlife:'Roots, berries, the odd rabbit that is slower than I am. And quiet. Mostly quiet. You are standing on some of it.',
  brew0:'Herbs, mushrooms. Three of the one and two of the other, and I can make you something that will keep your blood inside you. Bring them, and I will brew.',
  brew1:'Give them here. Mind, it is bitter. There. Drink it when you need it, not before.'};
function wire(){if(!G.story||G.story._enc)return;G.story._enc=true;const S0=G.story;const o0=S0.options,f0=S0.followups,c0=S0.choose;
  S0.options=function(n){const out=o0(n);if(n&&n.encKey==='hermit'){if(!done('hermit'))out.unshift(['s:e_h1','Good day, father.']);else out.unshift(['s:e_hlife','How do you live out here?']);}
    if(n&&n.role==='witch')out.push(['s:e_brew','Could you brew something from what I have gathered?']);return out;};
  S0.followups=function(n,t){if(t==='s:e_h1'||t==='s:e_hno')return [['s:e_hA','A mountain.'],['s:e_hB','An old oak.'],['s:e_hC','A church tower.']];
    if(t.startsWith('s:e_'))return [['return','Ask about something else.']];return f0(n,t);};
  S0.choose=function(n,t){switch(t){
    case 's:e_h1':return HL.h1;
    case 's:e_hA':if(!done('hermit')){mark('hermit');Q.give('draught',2);Q.tell('draught','+2 healing draughts');}return HL.hyes;
    case 's:e_hB':case 's:e_hC':return HL.hno;
    case 's:e_hlife':return HL.hlife;
    case 's:e_brew':{const h=Q.count('herb'),m=Q.count('mushroom');if(h<3||m<2)return HL.brew0+' You have '+h+' herb'+(h===1?'':'s')+' and '+m+' mushroom'+(m===1?'':'s')+'.';
      Q.take('herb',3);Q.take('mushroom',2);Q.give('draught');Q.tell('draught','+1 healing draught');return HL.brew1;}}
    return c0(n,t);};}

/* ======================================================================== each frame */
const tick0=G.tick,use0=G.use;let t=0;
G.tick=function(dt,T){tick0(dt,T);wire();if(!V.started)return;t+=dt;
  if(ENC.camp)ENC.camp.sm.tick(t),ENC.camp.fire.scale.set(1+.15*Math.sin(t*13),1.1+.2*Math.sin(t*9),1);
  if(ENC.cart&&ENC.cart.state===1){const c=ENC.cart,n=c.n;const fx=Math.sin(n.face),fz=Math.cos(n.face);c.g.position.set(n.x-fx*2.6,TH(n.x-fx*2.6,n.z-fz*2.6),n.z-fz*2.6);c.g.rotation.y=n.face;
    if(!n.route&&Math.hypot(n.x-P.x,n.z-P.z)>120){c.state=2;c.g.visible=false;n.sp.visible=false;n.x=HIDE[0];n.z=HIDE[1];n.fixedY=0;}}
  bridgeTick(dt);knightTick();eventTick(dt);
  // herbs are for something: say so, once
  if(!E().seen.herbs&&Q.count('herb')+Q.count('mushroom')>0){E().seen.herbs=1;Q.tell('herb','Old Wenna in the Old Wood can brew a healing draught from 3 herbs and 2 mushrooms.');Q.save();}
  near=null;if(G.modal||Q.view())return;let bd=9;for(const s of SPOTS){if(!s.ok())continue;const d=Math.hypot(s.x-P.x,s.z-P.z);if(d<s.reach&&d<bd){bd=d;near=s;}}
  if(near)useHint();};
G.use=function(npc){if(near&&!G.modal){const s=near;near=null;s.act();return true;}return use0?use0(npc):false;};
window.__enc={ENC,SPOTS,get EV(){return EV;},start:startEvent,POOL};
})();
