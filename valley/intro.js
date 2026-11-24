/* The Blight — the opening.
   A new game starts with the night Ashford burned, shot in the engine on the real town: dusk over the roofs, black roots
   coming out of the east, fire lane by lane, hounds, the church, and you getting Maud and her boy out of the west gate.
   Then dawn, on the road west, walking with what is left of the town until the valley opens up. Skippable; plays once. */
(function(){
'use strict';
const V=window.__valley,THREE=window.THREE;
if(!V||!V.GAME||!V.WD)return;
const G=V.GAME,A=window.__ashNight,P=V.P;
if(!A||!G.story)return;
const PL=id=>V.WD.places.find(p=>p.id===id),ASH=PL('ashford'),CAMP=PL('camp');
if(!ASH||!CAMP)return;
const NO=/[?&]nointro/.test(location.search);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const TH=(x,z)=>V.terrainH(x,z);
let seed=1234567;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;},RR=(a,b)=>a+(b-a)*rnd();
const LEN=42;   // seconds

/* ---------- the screen: letterbox, fades, a skip button ---------- */
const css=document.createElement('style');css.textContent=`
.vi-bar{position:fixed;left:0;right:0;height:0;background:#000;z-index:60;transition:height 1.2s ease;pointer-events:none}
.vi-bar.t{top:0}.vi-bar.b{bottom:0}.vi-on .vi-bar{height:9vh}
.vi-fade{position:fixed;inset:0;background:#000;z-index:61;opacity:1;pointer-events:none;transition:opacity 1.6s ease}
.vi-cap{position:fixed;left:6vw;bottom:13vh;z-index:62;color:#efe2c8;font:600 clamp(18px,2.6vw,30px)/1 Georgia,serif;letter-spacing:.32em;text-transform:uppercase;opacity:0;transition:opacity 1.8s ease;pointer-events:none;text-shadow:0 2px 12px #000}
.vi-skip{position:fixed;right:3vw;bottom:2.4vh;z-index:63;background:none;border:1px solid rgba(239,226,200,.35);color:rgba(239,226,200,.75);font:500 13px/1 system-ui,sans-serif;letter-spacing:.08em;padding:.55em .9em;border-radius:3px;cursor:pointer;opacity:0;transition:opacity .8s}
.vi-skip:hover,.vi-skip:focus-visible{color:#fff;border-color:#fff;outline:none}
.vi-on .vi-skip{opacity:1}`;
document.head.appendChild(css);
const mk=(c,tag)=>{const e=document.createElement(tag||'div');e.className=c;return e;};
const barT=mk('vi-bar t'),barB=mk('vi-bar b'),fade=mk('vi-fade'),cap=mk('vi-cap'),skip=mk('vi-skip','button');
skip.type='button';skip.textContent='Skip ›';fade.style.display='none';cap.textContent='Ashford';

/* ---------- sound: the opening has only its music (valley-music.js), no effects of its own ---------- */
const AC=null;const audioStart=()=>{},audioEnd=()=>{},noiseHit=()=>{},bell=()=>{};

/* ---------- fire ---------- */
const nearest=(x,z,arr,f)=>{let b=null,bd=1e9;for(const q of arr){const d=Math.hypot(f(q)[0]-x,f(q)[1]-z);if(d<bd){bd=d;b=q;}}return [b,bd];};
function pixTex(c,frames){const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;if(frames)t.repeat.set(1/frames,1);return t;}
const FIREC=(()=>{const c=document.createElement('canvas');c.width=64;c.height=32;const g=c.getContext('2d');
  for(let f=0;f<4;f++){seed=77+f*31;for(let y=0;y<32;y++){const v=y/31,cx=8+Math.sin(y*.38+f*1.9)*1.7*(1-v),half=7*Math.pow(v,.65);
      for(let x=0;x<16;x++){const dx=Math.abs(x+.5-cx);if(dx>half*(.78+.3*rnd()))continue;if(v<.38&&rnd()<.35)continue;const k=dx/Math.max(.5,half);
        g.fillStyle=k<.38&&v>.5?'#fff2b0':k<.62&&v>.28?'#ffb03a':v<.2?'#a8280c':'#ec5a1c';g.fillRect(f*16+x,y,1,1);}}}return c;})();
const fireMats=[0,1,2,3].map(k=>new THREE.SpriteMaterial({map:pixTex(FIREC,4),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false}));
const SMOKE=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.55,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const BLOB=(()=>{const c=document.createElement('canvas');c.width=c.height=24;const g=c.getContext('2d');seed=5;
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){const d=Math.hypot(x-11.5,y-11.5)/11.5;if(d<1&&rnd()>Math.pow(d,2.2)){g.fillStyle='#fff';g.fillRect(x,y,1,1);}}return pixTex(c);})();
const glowMat=new THREE.SpriteMaterial({map:null,color:0xff5a20,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false,opacity:0});
glowMat.map=SMOKE;glowMat.needsUpdate=true;
const TORCH=new THREE.PointLight(0xffa050,0,22,1.3);V.scene.add(TORCH);
const LIGHTS=[0,1,2].map(()=>{const l=new THREE.PointLight(0xff7a30,0,55,1.4);V.scene.add(l);return l;});   // made now, at load, so nothing recompiles mid-scene
const FLASH=new THREE.PointLight(0xffb060,0,90,1.2);V.scene.add(FLASH);

let S=null;   // everything the scene made, while it runs
function build(){seed=20251;const R={g:new THREE.Group(),fires:[],smokes:[],roots:[],npcs:[],t:0};V.scene.add(R.g);
  A.g.visible=true;for(const h of A.houses){h.roof.position.set(0,0,0);h.roof.rotation.set(0,0,0);h.roof.visible=true;}
  /* the roots: out of the east, fast across the fields, slow once they are in among the houses */
  const east=A.houses.slice().sort((a,b)=>b.x-a.x),west=A.houses.slice().sort((a,b)=>a.x-b.x);
  const rootMat=new THREE.MeshLambertMaterial({color:0x1d1424}),veinMat=new THREE.MeshBasicMaterial({color:0xb070ff,fog:false});
  const tipMat=new THREE.SpriteMaterial({map:BLOB,color:0xb070ff,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false});
  for(let i=0;i<9;i++){const sx=RR(1440,1580),sz=RR(-390,-130),e=east[i%5],w=west[(i*3)%west.length],ez=e.z+RR(-6,6);
    const way=[[sx,sz],[lerp(sx,1200,.5)+RR(-30,30),lerp(sz,ez,.5)+RR(-40,40)],[1190+RR(-8,8),ez+RR(-14,14)],[e.x+RR(4,8),e.z+RR(-5,5)]];
    if(i<6)way.push([lerp(e.x,w.x,.5)+RR(-10,10),lerp(e.z,w.z,.5)+RR(-10,10)],[w.x+RR(-4,4),w.z+RR(-4,4)]);
    const pts=[];for(let k=0;k<way.length-1;k++){const [ax,az]=way[k],[bx,bz]=way[k+1],L=Math.hypot(bx-ax,bz-az),n=Math.max(2,Math.ceil(L/3)),px=-(bz-az)/L,pz=(bx-ax)/L,ph=RR(0,6);
      for(let j=0;j<n;j++){const u=j/n,wob=Math.sin(u*L*.07+ph)*Math.min(6,L*.04)+Math.sin(u*L*.23+ph*2)*1.2,x=lerp(ax,bx,u)+px*wob,z=lerp(az,bz,u)+pz*wob;pts.push([x,z]);}}
    pts.push(way[way.length-1]);
    const r=i<6?RR(.38,.6):RR(.25,.38),v3=pts.map(([x,z])=>new THREE.Vector3(x,TH(x,z)+r*.55,z)),curve=new THREE.CatmullRomCurve3(v3),seg=pts.length*2;
    const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,seg,r,5,false),rootMat),vein=new THREE.Mesh(new THREE.TubeGeometry(curve,seg,r*.3,4,false),veinMat);
    vein.position.y=r*.8;R.g.add(tube,vein);
    const cum=[0];for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+Math.hypot(pts[k][0]-pts[k-1][0],pts[k][1]-pts[k-1][1]));
    let kin=pts.findIndex(p=>p[0]<1180);if(kin<0)kin=pts.length-1;
    const tip=new THREE.Sprite(tipMat);tip.scale.setScalar(3.2);R.g.add(tip);
    R.roots.push({tube,vein,tip,curve,pts,cum,L:cum[cum.length-1],field:cum[kin],t0:7+i*.18+RR(0,.5),seg,fast:58,slow:i<6?7.5:5});
    tube.geometry.setDrawRange(0,0);vein.geometry.setDrawRange(0,0);}
  const tipAt=(rt,t)=>{if(t<rt.t0)return 0;const u=t-rt.t0,tf=rt.field/rt.fast;return Math.min(rt.L,u<tf?u*rt.fast:rt.field+(u-tf)*rt.slow);};
  R.tipAt=tipAt;
  // each house catches when a root reaches it (or, failing that, as the fire spreads west)
  for(const h of A.houses){let tt=16+(1150-h.x)/5;for(const rt of R.roots)for(let k=0;k<rt.pts.length;k+=2){const p=rt.pts[k];if(Math.hypot(p[0]-h.x,p[1]-h.z)<10){
        const s=rt.cum[k],tf=rt.field/rt.fast,t=rt.t0+(s<=rt.field?s/rt.fast:tf+(s-rt.field)/rt.slow);tt=Math.min(tt,t+.6);break;}}
    h.ign=clamp(Math.min(tt,13.5+(1160-h.x)/7.5),13.2,25);
    const fl=[];for(let k=0;k<7;k++){const s=new THREE.Sprite(fireMats[k%4]),lx=RR(-h.w*.42,h.w*.42),lz=RR(-h.d*.42,h.d*.42),hy=k<5?h.y+5.4+RR(.5,3):h.y+RR(1.8,3);
      const c=Math.cos(h.rot),sn=Math.sin(h.rot);s.position.set(h.x+lx*c+lz*sn,hy,h.z-lx*sn+lz*c);s.center.set(.5,.15);s.scale.set(0,0,1);s.userData={size:k<5?RR(3.4,5.6):RR(1.8,2.6),dl:RR(0,2.2)};R.g.add(s);fl.push(s);}
    const sk=[];for(let k=0;k<5;k++){const m=new THREE.SpriteMaterial({map:SMOKE,color:0x3a302a,transparent:true,depthWrite:false,fog:false,opacity:0}),s=new THREE.Sprite(m);s.userData={ph:k/5};R.g.add(s);sk.push(s);}
    R.fires.push({x:h.x,z:h.z,y:h.y+6,ign:h.ign,fl,sk,h});}
  // the church goes up after the town has started to burn; the tower last
  {const c=A.church;const fl=[];for(let k=0;k<6;k++){const s=new THREE.Sprite(fireMats[k%4]);s.position.set(c.x+RR(-4,4),c.y+8+RR(0,2.5),c.z+RR(-6,6));s.center.set(.5,.15);s.scale.set(0,0,1);s.userData={size:RR(4,6.5),dl:RR(0,1.5)};R.g.add(s);fl.push(s);}
    const sk=[];for(let k=0;k<5;k++){const m=new THREE.SpriteMaterial({map:SMOKE,color:0x3a302a,transparent:true,depthWrite:false,fog:false,opacity:0}),s=new THREE.Sprite(m);s.userData={ph:k/5};R.g.add(s);sk.push(s);}
    R.fires.push({x:c.x,z:c.z,y:c.y+9,ign:21,fl,sk,h:null});
    // and at last the tower, which is when the bell stops
    const tf=[];for(let k=0;k<4;k++){const s=new THREE.Sprite(fireMats[k%4]);s.position.set(c.tx+RR(-2,2),c.y+11+k*2.2,c.tz+RR(-2,2));s.center.set(.5,.15);s.scale.set(0,0,1);s.userData={size:RR(3.5,5),dl:k*.4};R.g.add(s);tf.push(s);}
    R.fires.push({x:c.tx,z:c.tz,y:c.y+18,ign:27.6,fl:tf,sk:[],h:null});}
  // embers
  const NE=700,eg=new THREE.BufferGeometry(),ep=new Float32Array(NE*3).fill(-9999);eg.setAttribute('position',new THREE.BufferAttribute(ep,3));
  R.emb={pts:new THREE.Points(eg,new THREE.PointsMaterial({color:0xffa040,size:.32,sizeAttenuation:true,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false})),
    v:new Float32Array(NE*3),life:new Float32Array(NE),n:NE};R.g.add(R.emb.pts);R.emb.pts.frustumCulled=false;
  R.glow=new THREE.Sprite(glowMat);R.glow.position.set(ASH.x+10,TH(ASH.x,ASH.z)+30,ASH.z);R.glow.scale.set(260,120,1);R.g.add(R.glow);

  /* people and hounds: they run when their time comes */
  const who=(role,o)=>{const n=V.spawn(role,o.at[0],o.at[1],Object.assign({type:'stand',talk:false,face:0,name:'',temp:true},o.anim?{anim:o.anim}:{}));n.sp.visible=false;n.cue=o;n.speed=o.speed;R.npcs.push(n);
    if(o.anim==='sheep'&&G.paintHound){G.paintHound(n);n.t.needsUpdate=true;}return n;};
  const lane=[[1134,-207],[1112,-228],[1092,-238],[1068,-249],[1030,-246],[990,-243]];
  [['villager',15.2,0,4.6],['woman',16.4,1.5,4.2],['child',16.9,-1.2,4.4],['villager',18.6,2,4.8],['woman',20.5,-1.6,4.1],['villager',22,1,4.7]].forEach(([r,t,off,sp])=>{
    const route=lane.map(([x,z])=>[x+off,z+off*.6]);who(r,{at:route[0],t,route:route.slice(1),speed:sp});});
  [[16.8,[[1170,-236],[1128,-232],[1096,-214],[1060,-196]]],[17.4,[[1166,-250],[1122,-244],[1100,-226],[1074,-203]]],[19.6,[[1172,-222],[1130,-218],[1108,-250],[1090,-282]]],[21.2,[[1160,-262],[1118,-238],[1092,-228],[1040,-230]]]]
    .forEach(([t,r])=>who('sheep',{anim:'sheep',at:r[0],t,route:r.slice(1),speed:9.5}));
  // the west road, last: you, Maud, her boy
  const road=V.roads.w_east;let ri=0;{let bd=1e9;road.forEach((p,i)=>{const d=Math.abs(p[0]-1030);if(d<bd){bd=d;ri=i;}});}
  const rp=road[ri],rq=road[Math.min(road.length-1,ri+4)],dl=Math.hypot(rq[0]-rp[0],rq[1]-rp[1]),rx=(rq[0]-rp[0])/dl,rz=(rq[1]-rp[1])/dl;
  R.roadCam=[rp[0]-rz*3.2,rp[1]+rx*3.2,rx,rz];
  const along=road.filter((p,i)=>i>ri-30&&p[0]<1070&&p[0]>960).sort((a,b)=>b[0]-a[0]);
  [['villager',31.6,.6,4.3],['woman',31.75,-.7,4.25],['child',31.9,.1,4.25]].forEach(([r,t,off,sp],i)=>{const rt=along.map(p=>[p[0],p[1]+off]);const n=who(r,{at:rt[0],t,route:rt.slice(1),speed:sp,trio:1});if(!i)R.you=n;});
  {const [cx,cz,lx,lz]=R.roadCam;let b=null,ba=1e9;for(const h of A.houses){const dx=h.x-cx,dz=h.z-cz,d=Math.hypot(dx,dz),a=Math.acos((dx*lx+dz*lz)/d);if(d>22&&d<75&&a<ba){ba=a;b=h;}}R.collapse=b;}
  /* the church shot: somewhere low near the tower, clear of the houses */
  {const c=A.church,a0=Math.atan2(c.tz-c.z,c.tx-c.x);let best=null,bh=1e9;for(let a=a0-.9;a<=a0+.9;a+=.1)for(const rr of [26,32,38]){const x=c.tx+Math.cos(a)*rr,z=c.tz+Math.sin(a)*rr;if(A.houses.some(h=>Math.hypot(h.x-x,h.z-z)<13)||Math.hypot(c.x-x,c.z-z)<24)continue;const g=TH(x,z)+rr*.15;if(g<bh){bh=g;best=[x,z];}}
    R.towerCam=best||[c.tx-20,c.tz-12];}
  // the town's own people are not there yet: that is later, in daylight
  R.hidden=V.NPCS.filter(n=>!n.temp&&n.sp.visible&&Math.hypot(n.x-ASH.x,n.z-ASH.z)<160&&n.anim==='person');for(const n of R.hidden)n.sp.visible=false;
  return R;}

/* ---------- the shots ---------- */
const W3=(x,z,h)=>new THREE.Vector3(x,V.groundH(x,z)+h,z);
function shots(t){const R=S;
  const sh=(a,b)=>sm(a,b,t);
  if(t<7){const u=sm(0,1,t/7);return [W3(lerp(1008,1036,u),lerp(-302,-290,u),lerp(46,40,u)),W3(lerp(1150,1160,u),lerp(-238,-244,u),lerp(-6,-2,u))];}
  if(t<14.5){const u=(t-7)/7.5,p=W3(lerp(1222,1214,u),lerp(-279,-276,u),lerp(2.2,2.8,u)),k=sh(11.4,14.2),l=W3(lerp(1420,1110,k),lerp(-300,-246,k),lerp(4,8,k));return [p,l];}
  if(t<23){const u=(t-14.5)/8.5;return [W3(lerp(1099,1093,u),lerp(-244,-247,u),lerp(2,2.5,u)),W3(lerp(1140,1130,u),lerp(-212,-202,u),lerp(6,9,u))];}
  if(t<30.5){const u=(t-23)/7.5,c=A.church,[x,z]=R.towerCam,dx=c.tx-x,dz=c.tz-z,d=Math.hypot(dx,dz),sx=-dz/d*lerp(-3,3,u),sz=dx/d*lerp(-3,3,u);
    return [W3(x+sx,z+sz,1.7),new THREE.Vector3(c.tx,lerp(c.top-6,c.top+6,sm(0,1,u)),c.tz)];}
  const [x,z,rx,rz]=R.roadCam,trio=R.npcs.filter(n=>n.cue.trio&&n.sp.visible),f=trio.length?trio[0]:null;
  let l=W3(x+rx*40,z+rz*40,3);if(f){const df=(f.x-x)*rx+(f.z-z)*rz,k=sm(34,37,t)*sm(4,12,df);l.lerp(new THREE.Vector3(f.x,f.y+1.2,f.z),k*.4);}
  return [W3(x-rx*lerp(0,2,sh(31,40)),z-rz*lerp(0,2,sh(31,40)),1.65),l];}

/* ---------- running it ---------- */
let on=false,done=false,frames=0;
const _l=new THREE.Vector3();
function cam(camera,dt){if(!on||done)return;dt=Math.min(dt,.05);const R=S;
  if(frames<3){frames++;dt=0;if(frames===3)R.t=0;}   // the first frames after the jump load the ground; keep the clock still
  R.t+=dt;
  // with the music running, the music keeps the time, so the bell and the drums land on their pictures
  const VM=window.valleyMusic;if(frames===3&&!R.music&&VM){R.music=1;VM.playIntro();}
  if(VM&&!R.manual&&VM.introStart&&VM.context&&VM.context.state==='running'){const at=VM.context.currentTime-VM.introStart;if(at>0&&Math.abs(at-R.t)<3)R.t=at;}
  const t=R.t;
  V.DN.tod=lerp(.744,.79,sm(0,32,t));
  const [p,l]=shots(t);
  const shake=t>14.5&&t<30.5?.035:0;p.x+=Math.sin(t*13.1)*shake;p.y+=Math.sin(t*17.3)*shake;
  camera.position.copy(p);camera.lookAt(_l.copy(l));P.x=p.x;P.z=p.z;
  // roots
  for(const rt of R.roots){const s=R.tipAt(rt,t),u=s/rt.L,nseg=Math.floor(u*rt.seg);rt.tube.geometry.setDrawRange(0,nseg*5*6);rt.vein.geometry.setDrawRange(0,nseg*4*6);
    rt.tip.visible=s>0&&s<rt.L;if(rt.tip.visible){rt.curve.getPointAt(Math.min(1,u),rt.tip.position);rt.tip.scale.setScalar(3+Math.sin(t*9+rt.t0)*.9);}}
  // fire
  const fr=Math.floor(t*9);fireMats.forEach((m,k)=>m.map.offset.x=((fr+k)%4)/4);
  let burning=0;const near=[];
  for(const f of R.fires){const age=t-f.ign;if(age<0)continue;burning++;near.push([Math.hypot(f.x-p.x,f.z-p.z),f]);
    for(const s of f.fl){const g=sm(s.userData.dl,s.userData.dl+3,age)*s.userData.size*(.9+.12*Math.sin(t*7+s.userData.dl*5));s.scale.set(g*.62,g,1);}
    for(const s of f.sk){const u=(t*.16+s.userData.ph)%1,k=sm(0,3,age);s.position.set(f.x+u*8,f.y+u*30,f.z+u*3);s.scale.setScalar(4+u*16);s.material.opacity=k*.42*(1-u)*sm(0,.15,u);}}
  glowMat.opacity=Math.min(.28,burning*.022);
  near.sort((a,b)=>a[0]-b[0]);LIGHTS.forEach((L,i)=>{const n=near[i];if(!n){L.intensity=0;return;}const f=n[1];L.position.set(f.x,f.y+1,f.z);L.intensity=sm(0,3,t-f.ign)*(2.2+.5*Math.sin(t*11+i*2)+.3*Math.sin(t*23+i));});
  // embers rise from what burns
  const E=R.emb,pa=E.pts.geometry.attributes.position.array,lit=R.fires.filter(f=>t>f.ign+1);
  for(let i=0;i<E.n;i++){E.life[i]-=dt;if(E.life[i]<=0){if(!lit.length){pa[i*3+1]=-9999;continue;}const f=lit[(Math.random()*lit.length)|0];
      pa[i*3]=f.x+RR(-4,4);pa[i*3+1]=f.y+RR(-1,2);pa[i*3+2]=f.z+RR(-4,4);E.v[i*3]=RR(-.6,1.6);E.v[i*3+1]=RR(2,6);E.v[i*3+2]=RR(-.8,.8);E.life[i]=RR(1.5,4);}
    pa[i*3]+=E.v[i*3]*dt+Math.sin(t*3+i)*.02;pa[i*3+1]+=E.v[i*3+1]*dt;pa[i*3+2]+=E.v[i*3+2]*dt;}
  E.pts.geometry.attributes.position.needsUpdate=true;
  // the roof that comes down behind them
  {const h=R.collapse,k=sm(35.6,36.9,t);if(h&&k>0){h.roof.rotation.z=k*.5;h.roof.position.y=-k*k*7;h.roof.visible=k<1;
      if(!R.fell){R.fell=1;for(let i=0;i<220;i++){const j=(Math.random()*E.n)|0;pa[j*3]=h.x+RR(-3,3);pa[j*3+1]=h.y+RR(2,6);pa[j*3+2]=h.z+RR(-3,3);E.v[j*3]=RR(-6,6);E.v[j*3+1]=RR(4,14);E.v[j*3+2]=RR(-6,6);E.life[j]=RR(1.5,3.5);}
}
      FLASH.position.set(h.x,h.y+5,h.z);FLASH.intensity=6*Math.exp(-(t-35.6)*2.2);}}
  // people and hounds
  for(const n of R.npcs){const c=n.cue;if(t>=c.t&&!n.go){n.go=1;n.sp.visible=true;n.route=c.route.map(q=>q.slice());n.routeGo=0;n.routeEnd=m=>{m.sp.visible=false;};}}
  if(R.you&&R.you.go&&R.you.sp.visible){TORCH.position.set(R.you.x+.4,R.you.y+2,R.you.z);TORCH.intensity=1.8+.3*Math.sin(t*14);}else TORCH.intensity=0;
  // sound
  // the screen
  cap.style.opacity=t>1.2&&t<5.6?1:0;
  if(t>40.2&&!R.out){R.out=1;fade.style.transition='opacity 1.6s ease';fade.style.opacity=1;}
  if(t>LEN)finish(true);}

function start(){on=true;done=false;frames=0;S=build();S.nextBell=12.6;
  document.body.append(barT,barB,fade,cap,skip);document.body.classList.add('vi-on');
  fade.style.display='block';fade.style.transition='none';fade.style.opacity=1;
  G.modal=true;G.cine=true;G.cam=cam;audioStart();if(window.valleyMusic)window.valleyMusic.unlock();
  setTimeout(()=>{fade.style.transition='opacity 2.4s ease';fade.style.opacity=0;},350);
  skip.focus({preventScroll:true});}
function cleanup(){on=false;G.cam=null;G.cine=false;
  if(S){V.scene.remove(S.g);S.g.traverse(o=>{if(o.geometry)o.geometry.dispose();});
    for(const n of S.npcs){V.scene.remove(n.sp);const i=V.NPCS.indexOf(n);if(i>=0)V.NPCS.splice(i,1);}
    for(const n of S.hidden)n.sp.visible=true;S=null;}
  A.g.visible=false;V.scene.remove(A.g);LIGHTS.forEach(l=>l.intensity=0);FLASH.intensity=0;TORCH.intensity=0;glowMat.opacity=0;
  audioEnd();cap.remove();}
function finish(){if(done)return;done=true;fade.style.transition='opacity .5s ease';fade.style.opacity=1;cap.style.opacity=0;
  setTimeout(()=>{cleanup();document.body.classList.remove('vi-on');skip.remove();setTimeout(()=>{barT.remove();barB.remove();},1300);G.modal=false;dawn();},S&&S.out?150:550);}
skip.addEventListener('click',e=>{e.stopPropagation();finish();});
addEventListener('keydown',e=>{if(on&&!done&&(e.code==='Escape'||e.code==='Enter'||e.code==='Space')){e.preventDefault();e.stopPropagation();finish();}},true);

/* ---------- dawn, on the road west ---------- */
// the way home is gone; the way west runs from the Old Wood down into the valley, past the village, to the meadow where they stop
// The east road was thick with hounds, so they went south and round through the forest all night, and come over the
// rise into the valley the way the game always began: down the forest road, across the meadow, along to the camp.
function roadWest(){const chain=['forest','meadow','east'].map(k=>V.roads[k]).filter(Boolean);if(chain.length<3)return null;
  let all=[];for(const r of chain){let q=r.map(p=>[p[0],p[1]]);if(all.length){const e=all[all.length-1];if(Math.hypot(q[q.length-1][0]-e[0],q[q.length-1][1]-e[1])<Math.hypot(q[0][0]-e[0],q[0][1]-e[1]))q.reverse();}
    else if(Math.hypot(q[0][0]-START[0],q[0][1]-START[1])>Math.hypot(q[q.length-1][0]-START[0],q[q.length-1][1]-START[1]))q.reverse();all=all.concat(q);}
  let ic=0,bd=1e9;all.forEach((p,i)=>{const d=Math.hypot(p[0]-CAMP.x,p[1]-CAMP.z);if(d<bd){bd=d;ic=i;}});
  return all.slice(0,ic+1);}
const START=[P.x,P.z];   // where a new game has always started
let WALK=null;
function pathAt(path,cum,s){s=clamp(s,0,cum[cum.length-1]);let k=1;while(k<cum.length-1&&cum[k]<s)k++;const u=(s-cum[k-1])/Math.max(1e-6,cum[k]-cum[k-1]);
  const a=path[k-1],b=path[k];return [lerp(a[0],b[0],u),lerp(a[1],b[1],u),Math.atan2(b[0]-a[0],b[1]-a[1]),b[0]-a[0],b[1]-a[1]];}
function dawn(){const d=G.story.data();d.seen.intro=1;if(d.stage==='start')d.stage='road';
  V.begin();
  const path=roadWest();
  if(path&&path.length>2){const cum=[0];for(let k=1;k<path.length;k++)cum.push(cum[k-1]+Math.hypot(path[k][0]-path[k-1][0],path[k][1]-path[k-1][1]));
    const [x,z,yaw]=pathAt(path,cum,6);V.tp(x,z,yaw+Math.PI,.04);
    // the ones still walking: Maud, her boy, Hob, Wat, and a few whose names you did not know yet
    const crew=[['maud',10,-1.3],['refugee1',7,1.8],['refugee2',17,1.4],[null,13,.3,'child'],[null,-6,-1.2,'woman'],[null,23,-1.1,'villager'],[null,-12,1.1,'villager']];
    const W=[];for(const [k,o,lat,role] of crew){let n=k&&V.NPCS.find(m=>m.story===k);
      if(!n&&k)continue;if(!n){const at=CAMP;n=V.spawn(role,at.x,at.z,{type:'stand',talk:false,name:'Refugee',face:RR(0,6)});n.extra=1;}
      W.push({n,o,lat,s:6+o,home:[n.x,n.z],fy:n.fixedY,face:n.face0,spot:n.extra?[CAMP.x+RR(-14,14),CAMP.z+RR(-10,10)]:[n.x,n.z]});n.fixedY=undefined;}
    WALK={path,cum,W,L:cum[cum.length-1],t:0,said:{}};
    for(const w of W){const [x2,z2,,dx,dz]=pathAt(path,cum,w.s),l=Math.hypot(dx,dz)||1;w.n.x=x2-dz/l*w.lat;w.n.z=z2+dx/l*w.lat;}}
  V.DN.tod=.262;
  if(window.valleyMusic)window.valleyMusic.playTheme(5);
  G.qa.save();if(G.quests)G.quests.refresh();
  fade.style.transition='opacity 3s ease';requestAnimationFrame(()=>requestAnimationFrame(()=>{fade.style.opacity=0;setTimeout(()=>fade.remove(),3200);}));}
// keep them walking beside you; they will not wait long, and they will not be left far behind
function walk(dt){if(!WALK)return;const Wk=WALK;Wk.t+=dt;
  let sp=0,bd=1e9;for(let k=0;k<Wk.path.length;k++){const d=Math.hypot(Wk.path[k][0]-P.x,Wk.path[k][1]-P.z);if(d<bd){bd=d;sp=Wk.cum[k];}}
  if(bd>=60&&Math.hypot(P.x-CAMP.x,P.z-CAMP.z)<90){sp=Wk.L;bd=0;}
  let left=0;
  for(const w of Wk.W){const n=w.n;if(w.home===null)continue;
    if(w.s>=Wk.L){if(!w.last){w.last=1;n.route=[w.spot.slice()];n.routeGo=0;n.speed=1.4;n.routeEnd=m=>{m.fixedY=V.terrainH(m.x,m.z);m.face0=m.face=w.face||RR(0,6);if(m.extra)m.face0=m.face=Math.atan2(CAMP.x-m.x,CAMP.z-m.z);};}
      if(!n.route){w.home=null;}left++;continue;}
    left++;
    // run on far ahead and they catch you up where you cannot see them do it
    if(bd<60&&sp-w.s>110&&Math.hypot(n.x-P.x,n.z-P.z)>95){w.s=Math.max(w.s,sp-60+w.o);const [x0,z0,,ddx,ddz]=pathAt(Wk.path,Wk.cum,w.s),l0=Math.hypot(ddx,ddz)||1;n.x=x0-ddz/l0*w.lat;n.z=z0+ddx/l0*w.lat;}
    const want=(bd<60?sp:w.s)+w.o,v=clamp(1.35+.7*(want-w.s),1.05,5.4);w.s=Math.min(Wk.L,w.s+v*dt);
    const [x,z,,dx,dz]=pathAt(Wk.path,Wk.cum,Math.min(Wk.L,w.s+2.5)),l=Math.hypot(dx,dz)||1;
    n.route=[[x-dz/l*w.lat,z+dx/l*w.lat]];n.routeGo=0;n.speed=v;}
  // a word or two on the way
  const m=Wk.W[0]&&Wk.W[0].n,h=Wk.W[1]&&Wk.W[1].n,say=(k,n,line,t)=>{if(Wk.said[k]||Wk.t<t||!n||!G.socialAccess)return;if(Math.hypot(n.x-P.x,n.z-P.z)<14&&G.socialAccess.ambient(n,line))Wk.said[k]=1;};
  say('a',m,'Keep walking. Do not look back, either of you.',5);
  if(P.z<-105)say('b',h,'Is that the castle? Up there? The king’s?',0);
  if(Wk.W.every(w=>w.home===null))WALK=null;}

/* ---------- hooks ---------- */
const tick0=G.tick;G.tick=function(dt,T){tick0(dt,T);if(V.started&&!G.modal)walk(dt);};
// a new game opens on the night Ashford burned; "Continue" goes straight back to where you were
addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#go');if(!b||NO||on||V.started)return;
  const s=G.state(),d=G.story.data();if(s.pos||d.seen.intro||d.stage!=='start')return;
  e.stopImmediatePropagation();e.preventDefault();document.querySelector('#start').style.display='none';start();},true);
window.__intro={start,finish,get S(){return S;},seek(t){if(S){S.t=t;S.manual=1;}},get walk(){return WALK;},roadWest};
})();
