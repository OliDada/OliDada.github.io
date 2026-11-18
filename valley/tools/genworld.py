# Builds valley/world.js: today's hand-built world baked in, the sketch's new regions laid round it.
import json, base64, math, sys
import numpy as np
B=json.load(open(sys.argv[1]))
nx,nz,x0,z0,cell=B['nx'],B['nz'],B['x0'],B['z0'],B['cell']
LOCK={'x0':-1320,'x1':760,'z0':-930,'z1':260,'f':180}
H0=np.array(B['h'],'float32').reshape(nz,nx);F0=np.array(B['f'],'float32').reshape(nz,nx)
X=x0+np.arange(nx)[None,:]*cell+np.zeros((nz,1));Z=z0+np.arange(nz)[:,None]*cell+np.zeros((1,nx))
# The world is drawn at design scale, then the empty strip just beyond the hand-built valley is cut out on every side,
# so everything further out moves closer without changing shape: Oakhurst keeps its hill and meadows, only nearer.
# The cut sits on the valley's own edge, where the hand-built land still covers the join.
LK0=dict(x0=-1320,x1=760,z0=-930,z1=260);CUT=dict(x0=340,x1=350,z0=100,z1=0)   # the south is left at its full size: Oakhurst stays where it was first placed
BAND=220   # the cut is spread over the first 220 m beyond the valley's edge, so nothing tears
def _f(d,c):return np.where(d<BAND,d*(BAND+c)/BAND,d+c)          # world distance past the edge -> design
def _g(d,c):return np.where(d<BAND+c,d*BAND/(BAND+c),d-c)        # design -> world
def expand(v,a,b,ca,cb):v=np.asarray(v,'float64');return np.where(v<a,a-_f(a-v,ca),np.where(v>b,b+_f(v-b,cb),v))
def comp(v,a,b,ca,cb):v=np.asarray(v,'float64');return np.where(v<a,a-_g(a-v,ca),np.where(v>b,b+_g(v-b,cb),v))
Xd=expand(X,LK0['x0'],LK0['x1'],CUT['x0'],CUT['x1']);Zd=expand(Z,LK0['z0'],LK0['z1'],CUT['z0'],CUT['z1'])
def cpt(x,z):return [round(float(comp(x,LK0['x0'],LK0['x1'],CUT['x0'],CUT['x1'])),1),round(float(comp(z,LK0['z0'],LK0['z1'],CUT['z0'],CUT['z1'])),1)]
def dedupe(P,m=25):
    out=[P[0]]
    for q in P[1:]:
        if math.hypot(q[0]-out[-1][0],q[1]-out[-1][1])>=m:out.append(q)
    if out[-1]!=P[-1]:out[-1]=P[-1]
    return out
def sm(e0,e1,v):t=np.clip((v-e0)/(e1-e0),0,1);return t*t*(3-2*t)
def lockW(x,z):L=LOCK;f=L['f'];return sm(L['x0']-f,L['x0'],x)*sm(L['x1']+f,L['x1'],x)*sm(L['z0']-f,L['z0'],z)*sm(L['z1']+f,L['z1'],z)
rng=np.random.default_rng(5)
def vnoise(fx,fz,seed):
    xi=np.floor(fx).astype(np.int64);zi=np.floor(fz).astype(np.int64);xf=fx-xi;zf=fz-zi;u=xf*xf*(3-2*xf);v=zf*zf*(3-2*zf)
    def h(a,b):
        k=(a*374761393+b*668265263+seed*1442695041)&0xffffffff;k=((k^(k>>13))*1274126177)&0xffffffff;return ((k^(k>>16))&0xffffff)/16777216.0
    a,b,c,d=h(xi,zi),h(xi+1,zi),h(xi,zi+1),h(xi+1,zi+1)
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v
def fbm(fx,fz,seed):return vnoise(fx,fz,seed)*.55+vnoise(fx*2.03+5.2,fz*2.03+9.1,seed+1)*.28+vnoise(fx*4.1+1.7,fz*4.1+3.3,seed+2)*.17
# ---------------- what goes where ----------------
PLACES=[
 dict(id='ashford',name='Ashford',kind='town',x=1460,z=-250,r=90),
 dict(id='farm',name='Abandoned farm',kind='ruin',x=1150,z=250,r=50),
 dict(id='lodge',name="Hunter's lodge",kind='hut',x=820,z=620,r=35),
 dict(id='oakhurst',name='Oakhurst',kind='town',x=-150,z=900,r=90),
 dict(id='monastery',name='Monastery',kind='monastery',x=-800,z=1000,r=70),
 dict(id='mine',name='Silver mine',kind='mine',x=-1100,z=1500,r=45),
 dict(id='amberley',name='Amberley',kind='town',x=-2000,z=-450,r=100),
 dict(id='westmill',name='Westmill',kind='town',x=-2400,z=-80,r=55),
 dict(id='highfold',name='Highfold',kind='town',x=200,z=-1160,r=70),
 dict(id='camp',name='Refugee camp',kind='camp',x=230,z=-215,r=30),
 dict(id='heart',name='The Blight',kind='blight',x=2150,z=-480,r=120),
 dict(id='r_amber',name='The Amber Vale',kind='region',x=-2250,z=-700,r=0),
 dict(id='r_green',name='The Greenwood',kind='region',x=-350,z=1300,r=0),
 dict(id='r_rot',name='The Rotting Edge',kind='region',x=1000,z=-470,r=0),
 dict(id='r_ash',name='The Ashlands',kind='region',x=1800,z=150,r=0),
 dict(id='r_north',name='The Northern Peaks',kind='region',x=-300,z=-2050,r=0),
 dict(id='r_sun',name='The Sunlands',kind='region',x=0,z=2080,r=0)]
ROADS=[
 dict(id='w_east',kind='road',pts=[[636,-254],[680,-246],[740,-238],[820,-232],[920,-226],[1050,-210],[1180,-220],[1300,-238],[1420,-250]]),
 dict(id='w_blight',kind='track',pts=[[1520,-262],[1640,-300],[1780,-360],[1920,-420],[2060,-470],[2130,-480]]),
 dict(id='w_ashsouth',kind='lane',pts=[[1440,-230],[1420,-100],[1330,60],[1220,180],[1150,250],[1050,380],[930,500],[820,620],[600,720],[350,800],[100,860],[-150,900]]),
 dict(id='w_south',kind='road',pts=[[2,86],[-10,180],[-40,300],[-80,450],[-120,620],[-150,780],[-150,900],[-140,1100],[-120,1350],[-90,1600],[-60,1850],[-20,2100],[0,2160]]),
 dict(id='w_monastery',kind='road',pts=[[-150,900],[-300,930],[-480,960],[-650,990],[-800,1000]]),
 dict(id='w_mine',kind='lane',pts=[[-800,1000],[-900,1150],[-1000,1300],[-1100,1450]]),
 dict(id='w_monnorth',kind='lane',pts=[[-800,1000],[-900,800],[-980,600],[-1000,400],[-950,200],[-880,0],[-840,-200],[-815,-390]]),
 dict(id='w_west',kind='road',pts=[[-815,-390],[-830,-500],[-900,-600],[-1050,-640],[-1250,-620],[-1450,-560],[-1650,-500],[-1850,-470],[-2000,-450]]),
 dict(id='w_westmill',kind='road',pts=[[-2000,-450],[-2120,-330],[-2250,-200],[-2400,-80],[-2650,-20],[-2850,0]]),
 dict(id='w_nw',kind='lane',pts=[[-2000,-450],[-2150,-650],[-2350,-850],[-2550,-960]]),
 dict(id='w_monamber',kind='lane',pts=[[-800,1000],[-1050,900],[-1350,750],[-1650,550],[-1900,300],[-2100,0],[-2150,-250],[-2000,-450]]),
 dict(id='w_north',kind='road',pts=[[92,-555],[130,-548],[200,-580],[255,-650],[278,-740],[292,-840],[304,-940],[312,-1030],[262,-1110],[205,-1150]])]
se=B['streamEnd']
RIVERS=[
 dict(id='r_main',w=6,pts=[[se[0],se[1]],[-600,480],[-560,650],[-480,820],[-380,980],[-250,1150],[-60,1320],[180,1480],[450,1640],[760,1780],[1100,1920],[1450,2080],[1650,2180]]),
 dict(id='r_east',w=5,pts=[[1680,-1350],[1640,-1000],[1580,-500],[1545,-250],[1500,0],[1420,300],[1300,650],[1160,1050],[1000,1450],[880,1720],[790,1785]]),
 dict(id='r_west',w=4,pts=[[-1950,-1250],[-2000,-1000],[-2060,-700],[-2120,-420],[-2250,-220],[-2420,-60],[-2350,200],[-2100,420],[-1800,600],[-1450,780],[-1100,880],[-750,900],[-560,880],[-485,830]])]
def meander(pts,amp,seed):
    """break each stretch into ~70 m pieces and swing them side to side, ends fixed, nothing moved inside the hand-built valley"""
    out=[pts[0]];acc=0
    for (ax,az),(bx,bz) in zip(pts[:-1],pts[1:]):
        L=math.hypot(bx-ax,bz-az);n=max(1,int(L/70));nx_,nz_=-(bz-az)/L,(bx-ax)/L
        for k in range(1,n+1):
            t=k/n;x=ax+(bx-ax)*t;z=az+(bz-az)*t;acc+=L/n
            if k<n:
                lw=float(lockW(np.array(x),np.array(z)));o=amp*(math.sin(acc/230+seed)*.7+math.sin(acc/97+seed*2.3)*.3)*(1-lw)*math.sin(math.pi*t)**.5
                x+=nx_*o;z+=nz_*o
            out.append([round(x,1),round(z,1)])
    return out
for p in PLACES:p['x'],p['z']=cpt(p['x'],p['z'])
for rd in ROADS:rd['pts']=dedupe([cpt(*q) for q in rd['pts']])
for rv in RIVERS:rv['pts']=dedupe([rv['pts'][0] if (rv['id']=='r_main' and i==0) else cpt(*q) for i,q in enumerate(rv['pts'])],40)
for i,rd in enumerate(ROADS):rd['pts']=meander(rd['pts'],{'road':26,'lane':22,'track':16}[rd['kind']],i*1.7+.4)
def along(rid,f,side,off):
    P=[r for r in ROADS if r['id']==rid][0]['pts'];L=[0]
    for a,b in zip(P[:-1],P[1:]):L.append(L[-1]+math.hypot(b[0]-a[0],b[1]-a[1]))
    t=f*L[-1];k=max(i for i in range(len(L)) if L[i]<=t);k=min(k,len(P)-2);a,b=P[k],P[k+1];u=(t-L[k])/max(1e-6,L[k+1]-L[k])
    x=a[0]+(b[0]-a[0])*u;z=a[1]+(b[1]-a[1])*u;l=math.hypot(b[0]-a[0],b[1]-a[1]);return round(x-(b[1]-a[1])/l*side*off,1),round(z+(b[0]-a[0])/l*side*off,1)
for (rid,f,side,off,pid,name,kind,r) in [
    ('w_south',.15,1,34,'shrine_s','Wayside shrine','shrine',18),('w_south',.28,-1,55,'woodcut','Woodcutters\' camp','charcoal',40),
    ('w_south',.62,1,60,'south_farm','Ashby farm','farm',45),
    ('w_monnorth',.22,1,50,'brackenford','Brackenford','town',48),('w_monnorth',.4,-1,45,'charcoal_w','Charcoal burners','charcoal',35),
    ('w_monnorth',.32,1,30,'shrine_w','Roadside cross','shrine',16),
    ('w_ashsouth',.3,-1,45,'shrine_e','Old shrine','shrine',16),('w_monamber',.5,1,55,'amber_farm','Hollins farm','farm',45),('w_west',.45,-1,50,'west_farm','Cobb farm','farm',45)]:
    x,z=along(rid,f,side,off);PLACES.append(dict(id=pid,name=name,kind=kind,x=x,z=z,r=r))
def polyd(pts):
    """distance from every cell to the polyline, and how far along it the nearest point is"""
    P=np.array(pts,'float64');D=np.full(X.shape,1e9);S=np.zeros(X.shape);acc=0
    for (ax,az),(bx,bz) in zip(P[:-1],P[1:]):
        dx,dz=bx-ax,bz-az;L=math.hypot(dx,dz);t=np.clip(((X-ax)*dx+(Z-az)*dz)/(L*L),0,1);d=np.hypot(X-ax-dx*t,Z-az-dz*t)
        m=d<D;D[m]=d[m];S[m]=acc+t[m]*L;acc+=L
    return D,S,acc
# ---------------- the shape of the new land ----------------
T=18+38*fbm(Xd*.0018,Zd*.0018,1)+14*fbm(Xd*.007+3,Zd*.007+9,2)+4*fbm(Xd*.03,Zd*.03,3)
T+=55*sm(640,900,Xd)*(1-sm(1200,1600,Xd))          # the Old Wood's rim runs on east as the Rotting Edge
T+=70*sm(1750,2300,Xd)                              # the blasted upland of the Blight
dB=np.hypot(Xd-2150,Zd-480*-1);T-=35*np.exp(-(dB/170)**2)  # a hollow at its heart
T+=25*sm(500,1500,Zd)+15*sm(1700,2150,Zd)             # the Greenwood rolls south, the warm land beyond
rid=1-np.abs(fbm(Xd*.0022+11,Zd*.0022+4,70)*2-1)                 # ridged noise: crests for the far hills
T+=(200*sm(-2350,-3200,Xd)+220*sm(1450,2150,Zd)+190*sm(2100,2420,Xd))*(.45+.9*rid*fbm(Xd*.004,Zd*.004,71))   # the world is ringed by hills and peaks: blue backdrops for every view
T+=70*sm(-900,-1300,Zd)*sm(-1700,-2500,Xd)   # higher to the north-west
# the northern range: foothills, then a line of rounded peaks with saddles between, snow only on the highest tops
r1=1-np.abs(fbm(Xd*.0016+5,Zd*.0016+2,80)*2-1);r2=1-np.abs(fbm(Xd*.0042+9,Zd*.0042+3,81)*2-1)
T+=150*sm(-850,-1300,Zd)+sm(-1050,-1750,Zd)*(240+430*r1**1.5+120*r2**2)+140*sm(-1800,-2500,Zd)*r1
T-=14*sm(150,600,Zd)*(1-sm(700,1100,Zd))*np.exp(-((Xd+100)/700)**2)   # a vale south of the first forest, open toward Oakhurst
# rivers: each falls gently from source to mouth, and the land around it slopes down to meet it
prof={}
for rv in RIVERS:
    D,S,L=polyd(rv['pts']);i0=int((rv['pts'][0][1]-z0)/cell);j0=int((rv['pts'][0][0]-x0)/cell)
    if rv['id']=='r_main':h0,h1=se[2]-.4,se[2]-7
    elif rv['id']=='r_east':h0,h1=float(T[i0,j0])-6,None
    else:h0,h1=float(T[i0,j0])-6,None
    if h1 is None:h1=prof['r_main'](rv['pts'][-1])+.6
    wl=h0+(h1-h0)*(S/L)**.75
    bank=wl+.8+.03*D+.00016*D*D
    T=np.minimum(T,bank)
    P=np.array(rv['pts']);
    def mk(P=P,L=L,h0=h0,h1=h1):
        def f(pt):
            acc=0;best=(1e9,0)
            for (ax,az),(bx,bz) in zip(P[:-1],P[1:]):
                dx,dz=bx-ax,bz-az;l=math.hypot(dx,dz);t=max(0,min(1,((pt[0]-ax)*dx+(pt[1]-az)*dz)/(l*l)));d=math.hypot(pt[0]-ax-dx*t,pt[1]-az-dz*t)
                if d<best[0]:best=(d,acc+t*l)
                acc+=l
            return h0+(h1-h0)*(best[1]/L)**.75
        return f
    prof[rv['id']]=mk()
Driv=np.full(X.shape,1e9)
for rv in RIVERS:
    Driv=np.minimum(Driv,polyd(rv['pts'])[0])
# landmarks stand up where they can be seen: the monastery and the watchtower on knolls, hills closing the view behind Oakhurst
for (kx,kz,kr,kh) in [(-800,1000,170,38),(-2000,-450,0,0),(-150,905,170,46),(-150,1380,320,40),(250,1250,300,40),(-500,1300,260,34),(1460,-250,0,0)]:
    if kr:T+=kh*np.exp(-((Xd-kx)**2+(Zd-kz)**2)/(kr*kr))*sm(50,230,Driv)
for p in PLACES:                                     # towns sit on level ground
    if p['r']<=0:continue
    d=np.hypot(X-p['x'],Z-p['z']);c=T[int((p['z']-z0)/cell),int((p['x']-x0)/cell)];T=T*(1-.8*sm(p['r']*1.6,p['r']*.6,d))+c*.8*sm(p['r']*1.6,p['r']*.6,d)
wn=1.0   # the whole world, peaks included, comes from the design below
L=LOCK;dl=np.hypot(np.maximum(0,np.maximum(L['x0']-X,X-L['x1'])),np.maximum(0,np.maximum(L['z0']-Z,Z-L['z1'])))
w=sm(L['f']*.6,L['f']+650,dl)*wn          # the valley's own ridges taper away over most of a kilometre instead of stopping at a line
Hn=H0*(1-w)+T*w
# ---------------- regions ----------------
REG=['valley','amber','green','oldwood','rot','ash','blight','north','warm']
C={'valley':((-200,-350),800),'amber':((-2250,-350),700),'green':((-200,1150),700),'oldwood':((560,-300),210),'rot':((1050,-260),260),'ash':((1600,-100),380),'blight':((2150,-480),300),'north':((-300,-2200),520),'warm':((0,2300),320)}
Wt=[]
for k in REG:
    (cx,cz),sg=C[k];e=np.exp(-((Xd-cx)**2+(Zd-cz)**2)/(2*sg*sg))
    if k=='north':e=np.maximum(e,sm(-1250,-1550,Zd))
    if k=='warm':e=np.maximum(e,sm(1850,2100,Zd)*.9)
    Wt.append(e)
Wt=np.array(Wt)
# borders wander: pick the winner from noisy weights, so edges are ragged and interleave over a few hundred metres
jit=np.array([fbm(Xd*.0035+k*13,Zd*.0035+k*7,40+k)*.9+fbm(Xd*.012+k*3,Zd*.012+k*5,60+k)*.5 for k in range(len(REG))])
RID=np.argmax(np.log(Wt+1e-9)+6*(jit-.7),0).astype('uint8')
Wn=Wt/np.maximum(Wt.sum(0),1e-6)
inlock=lockW(X,Z)>.5
ow=((X-550)/240)**2+((Z+290)/150)**2<1
RID=np.where(inlock,np.where(ow,3,0),RID).astype('uint8')
# ---------------- forest ----------------
dens=np.tensordot(np.array([.42,.5,.64,.8,.72,.55,.75,.5,.18]),Wn,1)
n=fbm(Xd*.004+20,Zd*.004+7,7)*.7+fbm(Xd*.015+3,Zd*.015+1,8)*.3
Fn=sm(1-dens-.07,1-dens+.07,n)
LAND=[p for p in PLACES if p['kind'] in ('town','monastery','blight','mine','ruin','hut','farm','shrine')]+[dict(x=40,z=-660,kind='castle')]
for k,rd in enumerate(ROADS):
    D,S,Ltot=polyd(rd['pts'])
    flag=sm(.42,.58,np.sin(S/260+k*2.1)*.5+.5+ (fbm(S*.004+k,S*0+3.3,90)-.5)*.6)   # 1: forest closes in, 0: meadows open out
    edge=sm(11,19,D)*(1-sm(50,85,D))
    Fn=np.where(D<95,np.maximum(Fn*(1-flag)*sm(26,70,D),edge*flag*.95)+0*Fn,Fn)
    Fn*=sm(9,15,D)
    # views: every so often along the road, cut a widening wedge through the trees toward a landmark ahead
    P=np.array(rd['pts']);acc=0
    for (ax,az),(bx,bz) in zip(P[:-1],P[1:]):
        Ls=math.hypot(bx-ax,bz-az);dx,dz=(bx-ax)/Ls,(bz-az)/Ls
        for t in np.arange(0,Ls,140):
            px,pz=ax+dx*t,az+dz*t
            for lm in LAND:
                vx,vz=lm['x']-px,lm['z']-pz;dd=math.hypot(vx,vz)
                if dd<120 or dd>2300:continue
                if (vx*dx+vz*dz)/dd<math.cos(math.radians(55)):continue
                ux,uz=vx/dd,vz/dd;along=(X-px)*ux+(Z-pz)*uz;across=np.abs(-(X-px)*uz+(Z-pz)*ux)
                cone=(along>15)&(along<min(dd-20,1100))&(across<6+along*.13)
                Fn=np.where(cone,Fn*.12,Fn)
                break
        acc+=Ls
for p in PLACES:
    if p['r']>0:d=np.hypot(X-p['x'],Z-p['z']);Fn*=sm(p['r']*(1.7 if p['kind'] in ('town','farm') else 1.3),p['r']*(2.3 if p['kind'] in ('town','farm') else 1.6),d)
for rv in RIVERS:
    D,_,_=polyd(rv['pts']);Fn*=sm(rv['w']+4,rv['w']+26,D)
wf=sm(L['f']*.6,L['f']+300,dl)*wn
Fw=F0*(1-wf)+Fn*wf
Fw=np.where(inlock,F0,Fw)

# ---------------- write ----------------
hv=np.clip(np.round((Hn+200)*10),0,65535).astype('<u2');fv=np.clip(np.round(Fw*255),0,255).astype('uint8')
b64=lambda a:base64.b64encode(a.tobytes()).decode()
W=dict(v=1,x0=x0,z0=z0,cell=cell,nx=nx,nz=nz,lock=LOCK,height=b64(hv),forest=b64(fv),region=b64(RID),regions=REG,
       roads=ROADS,rivers=RIVERS,places=PLACES,ref=dict(roads=B['roads'],water=B['water'],lakes=B['lakes'],labels=B['labels']))
open(sys.argv[2],'w').write('/* The Valley: the world outside the hand-built core. Made with editor.html. */\nwindow.WORLD='+json.dumps(W,separators=(',',':'))+';\n')
print('written',sys.argv[2],'heights',float(Hn.min()),float(Hn.max()))
