import { route, areaFor, SEA_ENERGY } from "./motion.mjs";
import { dreamUniforms, dreamBendGLSL } from "./dream.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

// Shared GLSL: pier footprints as rectangles, plus cheap hashing/noise.
const commonGLSL = `
uniform vec4 piers[10];
float rectangle(vec2 p,vec2 c,vec2 e){vec2 q=abs(p-c)-e;return length(max(q,0.))+min(max(q.x,q.y),0.);}
uniform vec4 seaRocks[16];
// Distance to the nearest solid thing the sea breaks against: decks, and rocks out in the water.
float pierDistance(vec2 p){float d=10000.;for(int i=0;i<10;i++)d=min(d,rectangle(p,piers[i].xy,piers[i].zw));
  for(int i=0;i<16;i++)if(seaRocks[i].z>0.)d=min(d,length(p-seaRocks[i].xy)-seaRocks[i].z);return d;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
// Width of the border between drifting cells: a web of foam lines.
float cells(vec2 p,float t){vec2 i=floor(p),f=fract(p);float a=8.,b=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y);vec2 h=vec2(hash(i+o),hash(i+o+17.3));
    h=.5+.45*sin(t+6.2831*h);float d=length(o+h-f);if(d<a){b=a;a=d;}else b=min(b,d);}return b-a;}
// Irregular sea: crests bend (phase warp) and come in sets (a drifting group
// envelope), so some waves are lazy and some arrive heavy and steep.
float phaseWarp(vec2 p,float t){return 2.2*noise(p*.026+vec2(t*.018,-t*.011))+1.1*noise(p*.071-vec2(t*.03,0.));}
float groupEnvelope(vec2 p,float t){
  float a=noise(p*.019+vec2(-t*.06,-t*.016)),b=noise(p*.043+vec2(t*.035,-t*.05)+7.);
  return clamp(.25+1.35*pow(a*.65+b*.35,1.7)*1.7,.25,1.45);}
float chopEnvelope(vec2 p,float t){return .35+.9*noise(p*.11+vec2(t*.12,t*.07)+31.);}
// Seconds since the last crest passed a point, and which crest it was.
// Locked to the dominant swell, so impacts happen when its crest really arrives.
vec2 crestAge(vec2 p,float time){float a=1.5707963-(.36960*dot(vec2(.97661,.21485),p)+phaseWarp(p,time)-time*1.4);
  return vec2(mod(a,6.2831853)/1.4,floor(a/6.2831853));}
// Seven swells: direction, wavelength, amplitude, rate, steepness, offset.
#define SWELLS 7
void swellParams(int i,out vec2 d,out float L,out float A,out float R,out float S,out float O){
  if(i==0){d=vec2(.97661,.21485);L=17.;A=1.;R=1.4;S=.55;O=0.;}
  else if(i==1){d=vec2(-.8,.6);L=12.;A=.55;R=1.7;S=.45;O=1.7;}
  else if(i==2){d=vec2(.89443,-.44721);L=23.;A=.7;R=1.23;S=.35;O=4.1;}
  else if(i==3){d=vec2(.33035,.94386);L=7.;A=.24;R=2.22;S=.5;O=.8;}
  else if(i==4){d=vec2(.6,.8);L=9.5;A=.3;R=1.9;S=.55;O=2.6;}
  else if(i==5){d=vec2(-.28735,.95783);L=5.2;A=.14;R=2.58;S=.65;O=5.3;}
  else {d=vec2(.99504,-.09950);L=3.7;A=.08;R=3.06;S=.75;O=3.9;}
}
// Full Gerstner displacement plus surface derivatives at a world position.
void seaSurface(vec2 xz,float time,float energy,out vec3 disp,out vec3 tangent,out vec3 bitangent,out float crest){
  disp=vec3(0.);tangent=vec3(1.,0.,0.);bitangent=vec3(0.,0.,1.);crest=0.;
  float warp=phaseWarp(xz,time),group=groupEnvelope(xz,time),chop=chopEnvelope(xz,time);
  for(int i=0;i<SWELLS;i++){
    vec2 d;float L,A,R,S,O;swellParams(i,d,L,A,R,S,O);
    float amplitude=A*energy*(i<3?group:chop);
    float k=6.2831853/L;
    float phase=k*dot(d,xz)+warp*(i==0?1.:.6+float(i)*.15)-time*R+O;
    float s=sin(phase),c=cos(phase);
    disp.xz+=d*amplitude*S*c;disp.y+=amplitude*s;
    tangent+=vec3(-d.x*d.x*amplitude*S*k*s,d.x*amplitude*k*c,-d.x*d.y*amplitude*S*k*s);
    bitangent+=vec3(-d.x*d.y*amplitude*S*k*s,d.y*amplitude*k*c,-d.y*d.y*amplitude*S*k*s);
    crest+=max(0.,s)*amplitude*(1.+S);
  }
}
float swellHeight(vec2 p,float time,float energy){vec3 d,t,b;float c;seaSurface(p,time,energy,d,t,b,c);return d.y;}
`;

// Broad Gerstner swells, then the harbor edge: foam lace that is torn apart by
// each arriving crest, rings reflecting off the pilings, and spray particles.
export function createOcean(scene) {
    const uniforms = {
        time: { value: 0 },
        ...dreamUniforms,
        energy: { value: 1 },
        baseHeight: { value: -2.1 },
        center: { value: new THREE.Vector2() },
        pixelScale: { value: 300 },
        piers: {
            value: Array.from(
                { length: 10 },
                () => new THREE.Vector4(10000, 10000, 0, 0),
            ),
        },
        mirrorMix: { value: 0 },
        seaRocks: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    };
    const material = new THREE.ShaderMaterial({
        uniforms,
        side: THREE.DoubleSide,
        vertexShader: `
      uniform float time;
      uniform vec2 center;
      uniform float energy;uniform float baseHeight;
      ${commonGLSL}
      ${dreamBendGLSL}
      varying vec3 worldPosition;
      varying vec3 surfaceNormal;
      varying float crest;
      void main() {
        vec3 p = position;p.xz+=center;
        vec3 disp,tangent,bitangent;
        seaSurface(p.xz,time,energy,disp,tangent,bitangent,crest);
        p+=disp;
        vec2 worldXZ=(modelMatrix*vec4(p,1.)).xz;
        float shore=pierDistance(worldXZ);
        // Each crest piles up against the timber, then drains back out.
        float age=crestAge(worldXZ,time).x;
        float slam=exp(-age*2.2)*exp(-pow(shore/1.2,2.));
        float set=groupEnvelope(worldXZ,time);
        p.y+=slam*.7*energy*set-exp(-pow((shore-1.6-age*1.2)/.9,2.))*.18*energy*step(.4,age);
        // Big sets may climb high beside the quay, but never over the boards.
        p.y=min(p.y,-.15-baseHeight+max(shore,0.)*.7);
        // Water stays below every deck footprint.
        p.y=mix(min(p.y,-.35-baseHeight),p.y,smoothstep(.05,.75,shore));
        surfaceNormal = normalize(cross(bitangent,tangent));
        worldPosition = dreamBend((modelMatrix * vec4(p,1.)).xyz);
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition,1.);
      }`,
        fragmentShader: `
      uniform float time;uniform float energy;
      ${commonGLSL}
      varying vec3 worldPosition;
      varying vec3 surfaceNormal;
      varying float crest;
      float lanternReflection(vec3 lamp, vec3 n, vec3 eye) {
        vec3 delta = lamp-worldPosition;
        vec3 light = normalize(delta);
        float glint = pow(max(dot(reflect(-light,n),eye),0.),30.);
        return glint * 5. / (1.+dot(delta,delta)*.055);
      }
      uniform float mirrorMix;
      void main() {
        // In the mirror shallows the surface is screen-door thin, so the reflected
        // world drawn beneath it shows through in a fine dither.
        if(mirrorMix>0.){vec2 f=floor(gl_FragCoord.xy);float b=mod(f.x,2.)+mod(f.y,2.)*2.;if(b<3.*mirrorMix)discard;}
        vec2 xz=worldPosition.xz;
        float shore=max(pierDistance(xz),0.);
        vec2 ca=crestAge(xz,time);float age=ca.x;
        float nearEdge=exp(-shore*.45)*energy;
        // Fine chop near the timber, scattering the moonlight into single pixels.
        vec2 chop=vec2(noise(xz*3.1+time*.9),noise(xz*3.1-time*.8+9.))-.5;
        vec3 n=normalize(surfaceNormal+vec3(chop.x,0.,chop.y)*(.1+nearEdge*1.2));
        vec3 eye=normalize(cameraPosition-worldPosition);
        vec3 moon=normalize(vec3(-.6,.5,-.45));
        float fresnel=pow(1.-max(dot(n,eye),0.),3.);
        float moonlight=pow(max(dot(reflect(-moon,n),eye),0.),65.);
        float face=max(dot(n,moon),0.);
        float light=.015+face*.095+fresnel*.07+moonlight*.55;
        light+=lanternReflection(vec3(-.9,2.7,7.),n,eye);
        light+=lanternReflection(vec3(2.5,2.7,-3.),n,eye);
        light+=lanternReflection(vec3(-.9,2.7,-17.),n,eye);
        // Open-water foam: long ridges on the swell crests.
        float ribbons=sin(worldPosition.z*.65+worldPosition.x*.19-time*.4)*.5+.5;
        float foam=smoothstep(2.3,3.,crest+ribbons*.15)*step(.45,noise(worldPosition.xz*.9+time*.2));
        // Harbor edge: the slam leaves a white churn hugging the pilings...
        float churn=cells(xz*2.6+vec2(ca.y*3.1,0.),time*1.3+age*3.);
        float slam=exp(-age*1.4)*exp(-shore*.9)*min(1.,groupEnvelope(xz,time-age)*.9);
        // Fresh impact: a solid white mass that tears into a web as it ages.
        foam=max(foam,step(churn,slam*.62-.04)*1.1);
        // ...which then drains outward as a ragged, torn sheet of lace.
        float front=1.2+age*1.9;
        float sheet=exp(-pow((shore-front)/(.5+age*.25),2.))*exp(-age*.6);
        float lace=cells(xz*1.9+vec2(0.,-age*.7)+ca.y*5.7,time*.7);
        float patchy=smoothstep(.35,.7,noise(xz*.55+vec2(age*.4,ca.y*2.3)));
        foam=max(foam,step(lace,sheet*.3*patchy)*.9);
        // Persistent scum line right against the timber.
        foam=max(foam,step(noise(xz*6.+time*.3),.55)*exp(-shore*3.)*.8);
        // Faint reflected rings bouncing back off the quay.
        float ring=step(.86,sin(shore*5.5-time*4.2+noise(xz*.8)*2.))*exp(-shore*.35)*.35;
        foam=max(foam,ring*energy);
        light=mix(light,.72,clamp(foam,0.,1.)*mix(.6,1.,nearEdge));
        float fog=1.-exp(-length(cameraPosition-worldPosition)*.009);
        // Alpha 0 tags water pixels for the post pass.
        gl_FragColor=vec4(vec3(mix(light,.06,fog)),0.);
      }`,
    });
    const geometry = new THREE.PlaneGeometry(260, 260, 320, 320);
    geometry.rotateX(-Math.PI / 2);
    const surface = new THREE.Mesh(geometry, material);
    surface.position.set(0, -2.1, 0);
    surface.frustumCulled = false;
    scene.add(surface);

    // Spray: thousands of single-pixel droplets thrown ballistically off the
    // pier edges as each crest arrives. They climb the timber, arc outward,
    // spill over the outer boards and fall back as the wave drains.
    const COUNT = 52000;
    const seeds = new Float32Array(COUNT * 4),
        pierIndex = new Float32Array(COUNT),
        edge = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random();
        // Most droplets belong to the piers around the player (slots 1-4).
        const r = Math.random();
        // A third of the droplets are reserved for rocks out in the water (slots 10-25).
        pierIndex[i] = r < 0.33 ? 10 + Math.floor(Math.random() * 16) : r < 0.83 ? 1 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 10);
        edge[i] = Math.random();
    }
    const sprayGeometry = new THREE.BufferGeometry();
    sprayGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    sprayGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));
    sprayGeometry.setAttribute("pierIndex", new THREE.BufferAttribute(pierIndex, 1));
    sprayGeometry.setAttribute("edge", new THREE.BufferAttribute(edge, 1));
    const sprayMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
      uniform float time;uniform float energy;uniform float baseHeight;uniform float pixelScale;
      attribute vec4 seed;attribute float pierIndex;attribute float edge;
      ${commonGLSL}
      ${dreamBendGLSL}
      varying float bright;
      void kill(){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;}
      void main(){
        float s;vec2 P,N,T;
        if(pierIndex>9.5){
          // Spray off a rock: launch from its waterline, straight out from its face.
          vec4 k=seaRocks[int(pierIndex)-10];
          if(k.z<=0.){kill();return;}
          float ang=edge*6.2831853;N=vec2(cos(ang),sin(ang));P=k.xy+N*k.z;s=ang*k.z+pierIndex*7.;
        }else{
          vec4 r=piers[int(pierIndex)];
          vec2 e=r.zw;
          if(e.x<=0.){kill();return;}
          // Walk the rectangle's perimeter to find this droplet's launch point.
          s=edge*2.*(e.x+e.y)*2.;
          if(s<2.*e.x){P=r.xy+vec2(-e.x+s,-e.y);N=vec2(0,-1);}
          else if((s-=2.*e.x)<2.*e.y){P=r.xy+vec2(e.x,-e.y+s);N=vec2(1,0);}
          else if((s-=2.*e.y)<2.*e.x){P=r.xy+vec2(e.x-s,e.y);N=vec2(0,1);}
          else{s-=2.*e.x;P=r.xy+vec2(-e.x,e.y-s);N=vec2(-1,0);}
        }
        T=vec2(-N.y,N.x);
        // Edges that sit inside a neighbouring deck (corners) never launch.
        if(pierDistance(P+N*.3)<.05){kill();return;}
        vec2 ca=crestAge(P,time);
        float wave=ca.y;
        // Each crest hits unevenly: lumpy lobes a few metres wide.
        float lobe=floor(s/1.9);
        float strength=.35+.95*hash(vec2(lobe+pierIndex*31.,wave));
        strength*=smoothstep(.25,.75,noise(vec2(s*.35,wave*.7)))*.7+.3;
        strength*=groupEnvelope(P,time-ca.x)*.85;
        float jit=hash(seed.xy+wave);
        float tau=ca.x-seed.x*.45-jit*.1;
        float kind=seed.y;
        vec3 v;float g=9.8;float size;
        float spread=(hash(seed.zw+wave)-.5);
        if(kind<.55){ // climbing sheet up the timber face, spilling over the edge
          v=vec3(0.,(2.6+jit*2.6)*strength,0.);v.xz+=N*(.15+seed.z*.6)-N*step(.8,jit)*1.2+T*spread*.7;size=.15;
        }else if(kind<.9){ // thrown spray arcing back out to sea
          v=vec3(0.,(1.8+jit*3.)*strength,0.);v.xz+=N*(.9+seed.z*2.4)+T*spread*2.;size=.1;
        }else{ // hanging mist
          v=vec3(0.,(.9+jit*1.4)*strength,0.);v.xz+=N*(.4+seed.z)+T*spread;size=.06;g=2.6;
        }
        float y0=min(baseHeight+swellHeight(P,time-ca.x,energy)+.35*energy,-.35)+seed.w*.25;
        vec3 p=vec3(P.x+N.x*.12,y0,P.y+N.y*.12);
        float drag=kind>.9?1.6:.25;
        float travel=(1.-exp(-drag*tau))/drag;
        p+=v*travel;p.y-=.5*g*tau*tau;
        float dist=pierDistance(p.xz);
        bool alive=tau>0.&&tau<2.6&&seed.z<energy*1.15&&strength>.45;
        alive=alive&&p.y>baseHeight+swellHeight(p.xz,time,energy)-.1;
        // Over the boards: land on the outer planks, never in the walking lane.
        if(dist<0.){alive=alive&&dist>-1.&&p.y>.05;}
        if(!alive){kill();return;}
        vec3 w=dreamBend(p);
        vec4 mv=viewMatrix*vec4(w,1.);
        if(-mv.z>70.){kill();return;}
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(floor(size*pixelScale/-mv.z+.5+seed.w*.6),1.,4.);
        // Rising water is white; it greys into the sea colour as it falls apart.
        float rising=step(0.,v.y-g*tau);
        bright=kind>.9?.4:mix(.6,1.,rising)-tau*.12+(jit-.5)*.25;
        bright*=exp(-(-mv.z)*.012);
      }`,
        fragmentShader: `varying float bright;void main(){gl_FragColor=vec4(vec3(bright),.5);}`,
    });
    const spray = new THREE.Points(sprayGeometry, sprayMaterial);
    spray.frustumCulled = false;
    scene.add(spray);

    let previousTime = 0;
    return {
        setPixelScale(value) {
            uniforms.pixelScale.value = value;
        },
        // Rocks the sea should break against, nearest first (at most 16).
        setRocks(list, player) {
            const near = list.map((r) => [r, Math.hypot(r.x - player.x, r.z - player.z)]).filter(([, d]) => d < 60).sort((a, b) => a[1] - b[1]).slice(0, 16);
            uniforms.seaRocks.value.forEach((v, i) => near[i] ? v.set(near[i][0].x, near[i][0].z, near[i][0].r, 0) : v.set(0, 0, 0, 0));
        },
        update(time, index = 0, player = { x: 0, z: 0 }) {
            const dt = Math.max(0, time - previousTime);
            previousTime = time;
            const target = SEA_ENERGY[areaFor(index)] ?? 1;
            uniforms.mirrorMix.value += ((areaFor(index) === "shallows" ? 0.6 : 0) - uniforms.mirrorMix.value) * (1 - Math.exp(-dt * 0.8));
            uniforms.energy.value +=
                (target - uniforms.energy.value) * (1 - Math.exp(-dt * 0.8));
            uniforms.baseHeight.value =
                -2.1 + (1 - uniforms.energy.value) * 1.4;
            surface.position.y = uniforms.baseHeight.value;
            uniforms.time.value = time;
            uniforms.center.value.set(
                Math.round(player.x / 40) * 40,
                Math.round(player.z / 40) * 40,
            );
            for (let j = 0; j < 10; j++) {
                const s = route[index - 2 + j];
                if (s)
                    uniforms.piers.value[j].set(
                        s.x + (s.dx * s.length) / 2,
                        s.z + (s.dz * s.length) / 2,
                        s.dx ? s.length / 2 + 2.2 : s.width / 2 + 0.4,
                        s.dz ? s.length / 2 + 2.2 : s.width / 2 + 0.4,
                    );
                else uniforms.piers.value[j].set(10000, 10000, 0, 0);
            }
        },
    };
}
