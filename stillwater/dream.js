import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

// Shared uniforms for every "bending" shader in the scene.
export const MELTS = 12;
export const CRUMBLES = 12;
// Speed at which the crumbling front eats down through a house (m/s).
export const CRUMBLE_RATE = 1.6;
export const dreamUniforms = {
    dreamTime: { value: 0 },
    // Melting zones: rectangle (centre x, centre z, half x, half z) and
    // parameters (start time, base height, strength, spread).
    meltRect: { value: Array.from({ length: MELTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    meltParam: { value: Array.from({ length: MELTS }, () => new THREE.Vector4(1e9, 0, 0, 0)) },
    // How strange the world is right now: a calm baseline, raised during dream events.
    dreamLevel: { value: 0.3 },
    // The sea climbing into a wall around you (0 = flat horizon).
    seaRise: { value: 0 },
    // A breaking wave of houses: origin x/z and route direction x/z, then
    // start time, deck height, strength.
    waveFrame: { value: new THREE.Vector4(0, 0, 0, -1) },
    waveParam: { value: new THREE.Vector4(-1e9, 0, 0, 0) },
    // Crumbling houses: footprint (centre x/z, half x/z), timing and height
    // (start time, base, top, unused), and the direction away from the walk.
    crumbleRect: { value: Array.from({ length: CRUMBLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
    crumbleParam: { value: Array.from({ length: CRUMBLES }, () => new THREE.Vector4(1e9, 0, 0, 0)) },
    // Nearby lanterns (x, y, z, strength) that actually light the timber around them.
    lanterns: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, -100, 0, 0)) },
    crumbleAway: { value: Array.from({ length: CRUMBLES }, () => new THREE.Vector4(1, 0, 0, 0)) },
};
export const dreamTime = dreamUniforms.dreamTime;

// The world near the player stays solid; further out it sways, leans and
// breathes like it is being remembered rather than seen. Inside a melt zone,
// timber slumps, bulges and drips like candle wax.
export const dreamBendGLSL = `
uniform float dreamTime;
uniform vec4 meltRect[${MELTS}];
uniform vec4 meltParam[${MELTS}];
uniform float dreamLevel;uniform float seaRise;
uniform vec4 waveFrame;uniform vec4 waveParam;
float meltBox(vec2 p,vec2 c,vec2 e){vec2 q=abs(p-c)-e;return length(max(q,0.))+min(max(q.x,q.y),0.);}
vec3 dreamBend(vec3 p){
  float t=dreamTime;
  for(int i=0;i<${MELTS};i++){
    vec4 r=meltRect[i];vec4 m=meltParam[i];
    if(r.z<=0.||t<m.x)continue;
    float inside=1.-smoothstep(-.3,.6,meltBox(p.xz,r.xy,r.zw));
    float h=p.y-m.y;
    if(inside<=0.||h<=0.)continue;
    vec2 cell=floor(p.xz*2.2+floor(p.y*.7)*.37);
    float n=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
    float k=smoothstep(0.,6.,t-m.x-n*2.)*inside*m.z;
    float wave=sin(p.y*2.1+t*2.6+n*6.)*.5+.5;
    // slump: the upper storeys sink faster than the footings
    float sunk=h*(1.-k*(.55+.35*n+.1*wave));
    // drips: some columns run down past the floor line
    float drip=step(.78,n)*k*k*(1.5+n*2.5)*(1.-min(h,8.)/16.);
    p.y=m.y+sunk-drip;
    // the base spreads out like a puddle and the mass wobbles like jelly
    vec2 away=p.xz-r.xy;
    p.xz+=away*k*m.w*(1.-clamp(sunk/5.,0.,1.));
    p.x+=sin(p.y*2.3+t*3.1+n*6.)*.22*k;
    p.z+=cos(p.y*1.9-t*2.7+n*5.)*.22*k;
  }
  // Breaking wave: everything beside the route bends over it like a curling
  // swell as a crest travels ahead, then crumples and slowly stands up again.
  float wt=t-waveParam.x;
  if(wt>0.&&wt<14.&&waveParam.z>0.){
    vec2 dir=waveFrame.zw,perp=vec2(-dir.y,dir.x),o=p.xz-waveFrame.xy;
    float a=dot(o,dir),l=dot(o,perp),side=sign(l);
    float h=p.y+1.3;
    if(abs(l)>2.9&&h>0.&&a>-8.){
      float env=smoothstep(0.,1.5,wt)*(1.-smoothstep(9.,14.,wt))*waveParam.z;
      float front=wt*15.-6.;
      float crest=exp(-pow((a-front)/9.,2.))*env;
      float passed=max(front-a,0.);
      float crumple=smoothstep(0.,7.,passed)*exp(-passed/45.)*env;
      float kappa=.03+crest*.2;
      float bentL=(1.-cos(kappa*h))/kappa,bentH=sin(kappa*h)/kappa;
      float curl=crest/(crest+.05);
      float nl=l-side*bentL*curl;
      float nh=mix(h,bentH,curl);
      // crumple: the curled mass collapses and pours toward the water
      nh*=1.-crumple*.55;
      nl+=side*crumple*h*.18;
      nl+=sin(h*1.7+t*3.+a*.3)*.25*(crest+crumple);
      float y=nh-1.3;
      // the curling mass never crosses over the walk: it stops at its edge
      if(abs(nl)<3.)nl=side*3.;
      p.xz=waveFrame.xy+dir*a+perp*nl;p.y=y;
    }
  }
  float d=distance(p.xz,cameraPosition.xz);
  float k=smoothstep(9.,55.,d)*(.35+dreamLevel*.9);
  float hh=max(p.y+1.,0.);
  // Distant things breathe toward and away from you and lean along your line of
  // sight, never sideways, so nothing ever drifts across the walk ahead.
  vec2 radial=(p.xz-cameraPosition.xz)/max(d,.001);
  p.xz+=radial*(sin(p.x*.045+p.z*.05+t*.31)*1.8)*k;
  float lean=sin(t*.19+p.x*.021+p.z*.034);
  p.xz+=radial*hh*hh*.012*lean*k;
  p.y-=hh*.06*(.5+.5*sin(t*.37+p.x*.11))*k;
  // the horizon slowly rises around you, like the inside of a bowl
  p.y+=d*d*.00055*(.75+.25*sin(t*.13))*k*(1.+seaRise*9.);
  return p;
}`;

// Crumbling: a house comes apart into pixel-sized blocks from the roof down.
// The geometry is eaten away cell by cell; crumble.js throws the cells off as spray.
export const crumbleGLSL = `
uniform float dreamTime;
uniform vec4 crumbleRect[${CRUMBLES}];
uniform vec4 crumbleParam[${CRUMBLES}];
varying vec3 vDreamWorld;
uniform vec4 lanterns[16];
// Warm pools of light around the lanterns, with a slow candle flicker.
float lanternGlowAt(vec3 p){
  float g=0.;
  for(int i=0;i<16;i++){
    vec4 l=lanterns[i];if(l.w<=0.)continue;
    vec3 d=p-l.xyz;float r2=dot(d,d);
    float flicker=.85+.15*sin(dreamTime*11.+l.x*3.1)*sin(dreamTime*7.3+l.z*2.3);
    g+=l.w*flicker*(1.-smoothstep(0.,30.,r2))/(1.+r2*.7);
  }
  return g;
}
void crumbleDiscard(){
  for(int i=0;i<${CRUMBLES};i++){
    vec4 r=crumbleRect[i];vec4 c=crumbleParam[i];
    if(r.z<=0.||dreamTime<c.x)continue;
    vec2 q=abs(vDreamWorld.xz-r.xy)-r.zw;
    if(max(q.x,q.y)>.15||vDreamWorld.y<c.y)continue;
    vec3 cell=floor(vDreamWorld*2.6);
    float n=fract(sin(dot(cell,vec3(12.9898,78.233,37.719)))*43758.5453);
    float front=c.z-(dreamTime-c.x)*${CRUMBLE_RATE.toFixed(2)};
    if(vDreamWorld.y>front+n*1.6-.4)discard;
  }
}`;

// Patch every built-in material once, at compile time, so dynamically
// generated districts bend too without any bookkeeping.
// Hand-drawn surface marks, locked to the world so they never swim:
// 1 wood grain dashes, 2 diagonal hatching in shade (roofs, rock),
// 3 stipple (stone), 4 pale flecks in foliage and dark timber.
const hatchGLSL = `
#ifdef HATCH
{
  vec3 wp=(inverse(viewMatrix)*vec4(-vViewPosition,1.)).xyz;
  vec3 wn=normalize((vec4(normal,0.)*viewMatrix).xyz);
  vec2 uv=abs(wn.y)>.6?wp.xz:vec2(abs(wn.x)>abs(wn.z)?wp.z:wp.x,wp.y);
  float lum=dot(outgoingLight,vec3(.3,.59,.11));
  float fade=1.-smoothstep(16.,38.,length(wp-cameraPosition));
  float hh=fract(sin(dot(floor(uv*9.),vec2(12.9898,78.233)))*43758.5453);
  float mark=1.;
#if HATCH == 1
  float row=floor(uv.y*7.);float off=fract(sin(row*17.3)*911.);
  mark=step(.78,fract(uv.y*7.))*step(.45,fract(uv.x*(1.2+off)+off*7.))>.5?.55:1.;
#elif HATCH == 2
  float band=fract((uv.x+uv.y)*4.5);
  mark=lum<.32&&band<.28?.45:(lum<.18&&fract((uv.x-uv.y)*4.5)<.28?.45:1.);
#elif HATCH == 3
  mark=hh>.8?.6:hh<.06?1.35:1.;
#elif HATCH == 4
  mark=hh>.93&&lum>.015?2.6:1.;
#endif
  outgoingLight*=mix(1.,mark,fade);
}
#endif
`;
THREE.Material.prototype.onBeforeCompile = function (shader) {
    // Every material (shadow casters included) loses the crumbled cells.
    if (shader.vertexShader.includes("#include <project_vertex>") && shader.fragmentShader.includes("void main() {")) {
        Object.assign(shader.uniforms, dreamUniforms);
        shader.fragmentShader = shader.fragmentShader.replace("void main() {", `${crumbleGLSL}\nvoid main() {\ncrumbleDiscard();`);
    }
    if (this.isMeshDepthMaterial || this.isMeshDistanceMaterial) {
        shader.vertexShader = shader.vertexShader
            .replace("void main() {", "varying vec3 vDreamWorld;\nvoid main() {")
            .replace("#include <project_vertex>", "#include <project_vertex>\n{vec4 wpos=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nwpos=instanceMatrix*wpos;\n#endif\nvDreamWorld=(modelMatrix*wpos).xyz;}");
        return;
    }
    if (this.isMeshLambertMaterial && shader.fragmentShader.includes("#include <opaque_fragment>"))
        shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", "outgoingLight+=diffuseColor.rgb*lanternGlowAt(vDreamWorld);\n#include <opaque_fragment>");
    if (shader.fragmentShader.includes("#include <opaque_fragment>") && this.defines?.HATCH !== undefined)
        shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", hatchGLSL + "#include <opaque_fragment>");
    if (!shader.vertexShader.includes("#include <project_vertex>")) return;
    Object.assign(shader.uniforms, dreamUniforms);
    shader.vertexShader = shader.vertexShader
        .replace("void main() {", `${dreamBendGLSL}\nvarying vec3 vDreamWorld;\nvoid main() {`)
        .replace(
            "#include <project_vertex>",
            `vec4 mvPosition=vec4(transformed,1.);
#ifdef USE_INSTANCING
mvPosition=instanceMatrix*mvPosition;
#endif
vec4 dreamWorld=modelMatrix*mvPosition;
#if defined(VINE) && defined(USE_INSTANCING)
// Hanging moss and reeds: the free end swings, the attached end stays put.
float swing=.5-position.y;
#ifdef REED
swing=.5+position.y;
#endif
dreamWorld.xz+=vec2(sin(dreamTime*1.1+instanceMatrix[3].x*.7),cos(dreamTime*.83+instanceMatrix[3].z*.6))*swing*.32;
#endif
vDreamWorld=dreamWorld.xyz;
dreamWorld.xyz=dreamBend(dreamWorld.xyz);
mvPosition=viewMatrix*dreamWorld;
gl_Position=projectionMatrix*mvPosition;`,
        );
};
