import * as THREE from './vendor/three.module.js';
import { damp, smoothstep, smootherstep, verticalTarget } from './flight-math.mjs';
import { generateSystem, terrainHeight, cruisePoint } from './system.mjs';

// Surface flight uses coordinates relative to the current world; space travel is continuous.
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const Y = new THREE.Vector3(0, 1, 0);
const requestedSeed=new URLSearchParams(location.search).get('seed');
const system=generateSystem(requestedSeed===null?1408:requestedSeed);
let activeBody=system.bodies.find(b=>b.id===system.startId);
let RADIUS=activeBody.radius;
let randomState=activeBody.seed;
function random() { randomState = (1664525 * randomState + 1013904223) >>> 0; return randomState / 4294967296; }
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
let worldOrigin=vec(...activeBody.position);
let signalNormal=vec(...activeBody.signal);
let landingNormal=vec(0,1,.17).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y,signalNormal));
const heightAt=n=>terrainHeight(activeBody,n);
const surfaceRadius = (n) => RADIUS + heightAt(n);
const surfacePoint = (n, offset = 0) => n.clone().multiplyScalar(surfaceRadius(n) + offset);
const tangent = (forward, up) => forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('error').hidden = false;
  $('errorMessage').textContent = 'This browser could not create a WebGL renderer. Try a browser with hardware acceleration enabled.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#07101d');
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .08, 90000);
scene.add(new THREE.HemisphereLight(0xb6dfdf, 0x4c3844, 2.0));
const sun = new THREE.DirectionalLight(0xffe6c2, 3.1);
sun.position.set(-600, 550, 350);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x749bd5, .65);
fill.position.set(200, -100, -300); scene.add(fill);

let surfaceGroup=new THREE.Group(); scene.add(surfaceGroup);
let core,ring,beacon,glow;
function buildSurface(){
 randomState=activeBody.seed;
// Faceted, vertex-coloured terrain; the same height function drives walking and landing.
let terrainGeo = new THREE.IcosahedronGeometry(RADIUS, 36);
const positions = terrainGeo.attributes.position;
const colors = new Float32Array(positions.count * 3);
const palette = activeBody.palette.map(c=>new THREE.Color(c));
for (let i = 0; i < positions.count; i += 3) {
  const center = vec();
  for (let j = 0; j < 3; j++) {
    const n = vec().fromBufferAttribute(positions, i + j).normalize();
    const p = surfacePoint(n); positions.setXYZ(i + j, p.x, p.y, p.z); center.add(n);
  }
  center.normalize();
  const h = heightAt(center);
  const c = palette[clamp(Math.floor((h + 3) / 3.3), 0, 3)].clone().multiplyScalar(.91 + random() * .15);
  for (let j = 0; j < 3; j++) c.toArray(colors, (i + j) * 3);
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();
const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
surfaceGroup.add(terrain);

const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS + 15, 64, 48), new THREE.ShaderMaterial({
  uniforms: { tint: { value: new THREE.Color(activeBody.atmosphere) } },
  vertexShader: `varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}`,
  fragmentShader: `varying vec3 n; varying vec3 v; uniform vec3 tint; void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),4.0);gl_FragColor=vec4(tint,rim*.2);}`,
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
})); surfaceGroup.add(atmosphere);

// Instancing keeps surface detail cheap enough for ordinary browser hardware.
const rockMaterial = new THREE.MeshStandardMaterial({ color: activeBody.rock, roughness: 1, flatShading: true });
const rockCount = 650;
const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), rockMaterial, rockCount);
const dummy = new THREE.Object3D();
for (let i = 0; i < rockCount; i++) {
  let n;
  do { const y = random() * 2 - 1, a = random() * Math.PI * 2; n = vec(Math.sqrt(1 - y * y) * Math.cos(a), y, Math.sqrt(1 - y * y) * Math.sin(a)); } while(n.distanceTo(signalNormal) < .23);
  const size = .5 + random() ** 3 * 6;
  dummy.position.copy(surfacePoint(n, size * .25));
  dummy.quaternion.setFromUnitVectors(Y, n);
  dummy.rotateY(random() * 6.28);
  dummy.scale.set(size * (.6 + random()), size * (.6 + random()), size);
  dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
}
surfaceGroup.add(rocks);
// Scatter low mineral outcrops near the site, leaving the central footpath open.
const crystalMaterial = new THREE.MeshStandardMaterial({ color: activeBody.crystal, emissive: 0x315a48, emissiveIntensity: .35, roughness: .6, flatShading: true });
const crystals = new THREE.InstancedMesh(new THREE.ConeGeometry(.35, 1.8, 5), crystalMaterial, 140);
for (let i = 0; i < 140; i++) {
  const a = random() * 6.28, d = .06 + random() * .25;
  const n = vec(Math.cos(a) * d, 1, Math.sin(a) * d).normalize();
  if (Math.abs(n.x) < .025 && n.z > 0) n.x += .045;
  n.normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y,signalNormal)); dummy.position.copy(surfacePoint(n, .4)); dummy.quaternion.setFromUnitVectors(Y,n);
  dummy.scale.setScalar(.5 + random() * 1.2); dummy.updateMatrix(); crystals.setMatrixAt(i,dummy.matrix);
} surfaceGroup.add(crystals);

// The observatory: three broken standing stones around a suspended core.
const monument = new THREE.Group(); monument.position.copy(surfacePoint(signalNormal)); monument.quaternion.setFromUnitVectors(Y,signalNormal);
surfaceGroup.add(monument);
const stone = new THREE.MeshStandardMaterial({ color: 0x263f44, metalness: .25, roughness: .7, flatShading: true });
const luminous = new THREE.MeshStandardMaterial({ color: 0xc5ffe0, emissive: 0x7ef9cd, emissiveIntensity: 2.5 });
for (let i = 0; i < activeBody.landmarkCount; i++) {
  const a = i * Math.PI * 2 / activeBody.landmarkCount + .5;
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7 + i * .7, 1.7),stone);
  pillar.position.set(Math.cos(a)*3, 3.5+i*.35, Math.sin(a)*3); pillar.rotation.y = -a; pillar.rotation.z = i === 1 ? -.13 : .06; monument.add(pillar);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(.09, 4.5, 1.73),luminous);
  slit.position.copy(pillar.position); slit.rotation.copy(pillar.rotation); monument.add(slit);
}
core = new THREE.Mesh(new THREE.OctahedronGeometry(.75), luminous); core.position.y = 4; monument.add(core);
ring = new THREE.Mesh(new THREE.TorusGeometry(2, .035, 8, 64),luminous); ring.rotation.x = Math.PI/2; ring.position.y=1.1; monument.add(ring);
beacon = new THREE.Mesh(new THREE.CylinderGeometry(.11,.25,85,8),new THREE.MeshBasicMaterial({color:0xa6f0d0,transparent:true,opacity:.18,depthWrite:false}));
beacon.position.y = 43; monument.add(beacon);
glow = new THREE.PointLight(0xa4ffcb, 15, 24, 1.5); glow.position.y=4; monument.add(glow);


if(activeBody.ringed){
 const planetaryRing=new THREE.Mesh(new THREE.RingGeometry(RADIUS*1.45,RADIUS*2.05,128),new THREE.MeshBasicMaterial({color:activeBody.atmosphere,side:THREE.DoubleSide,transparent:true,opacity:.27,depthWrite:false}));
 planetaryRing.rotation.x=Math.PI/2+.12;surfaceGroup.add(planetaryRing);
}
}
// Every distant globe is a destination, rendered at lower detail until approached.
const systemGroup=new THREE.Group();scene.add(systemGroup);
const worldMeshes=new Map();
for(const body of system.bodies){
 const geometry=new THREE.IcosahedronGeometry(body.radius,10);
 const p=geometry.attributes.position,c=[];
 for(let i=0;i<p.count;i++){
   const n=vec().fromBufferAttribute(p,i).normalize();const h=terrainHeight(body,n);n.multiplyScalar(body.radius+h);p.setXYZ(i,n.x,n.y,n.z);
   const color=new THREE.Color(body.palette[clamp(Math.floor((h+3)/3.3),0,3)]);c.push(color.r,color.g,color.b);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geometry.computeVertexNormals();
 const group=new THREE.Group();group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1})));
 if(body.ringed){const r=new THREE.Mesh(new THREE.RingGeometry(body.radius*1.45,body.radius*2.05,96),new THREE.MeshBasicMaterial({color:body.atmosphere,side:THREE.DoubleSide,transparent:true,opacity:.3}));r.rotation.x=Math.PI/2+.12;group.add(r);}
 systemGroup.add(group);worldMeshes.set(body.id,group);
}
const starMesh=new THREE.Mesh(new THREE.SphereGeometry(system.star.radius,48,32),new THREE.MeshBasicMaterial({color:system.star.color}));systemGroup.add(starMesh);
const starHalo=new THREE.Mesh(new THREE.SphereGeometry(system.star.radius*1.15,32,24),new THREE.MeshBasicMaterial({color:0xffb467,transparent:true,opacity:.08,side:THREE.BackSide,depthWrite:false}));starMesh.add(starHalo);
function positionSystem(){
 for(const body of system.bodies){const mesh=worldMeshes.get(body.id);mesh.position.copy(vec(...body.position).sub(worldOrigin));mesh.visible=body.id!==activeBody.id;}
 starMesh.position.copy(worldOrigin).negate();sun.position.copy(starMesh.position);
}
buildSurface();positionSystem();
const starPositions = [], starColors=[];
for(let i=0;i<2800;i++) {
  const n=vec(random()*2-1,random()*2-1,random()*2-1).normalize().multiplyScalar(50000);
  starPositions.push(n.x,n.y,n.z); const c = new THREE.Color().setHSL(.48+random()*.2,.12+random()*.25,.4+random()*.5);starColors.push(c.r,c.g,c.b);
}
const starsGeo = new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starsGeo.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({size:22,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.85})));

function makeShip() {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({color:0xe4dfcc,metalness:.25,roughness:.65,flatShading:true});
  const dark = new THREE.MeshStandardMaterial({color:0x233a43,metalness:.55,roughness:.4});
  const orange = new THREE.MeshStandardMaterial({color:0xd99059,metalness:.15,roughness:.7});
  const glass = new THREE.MeshStandardMaterial({color:0x214550,metalness:.75,roughness:.12,emissive:0x10292c,emissiveIntensity:.5});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.9,1.35,5.5,6),hull);body.rotation.x=Math.PI/2;group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.9,2,6),hull);nose.rotation.x=-Math.PI/2;nose.position.z=-3.65;group.add(nose);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.25,.65,1.8),glass);canopy.position.set(0,.85,-1.1);canopy.rotation.x=-.14;group.add(canopy);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-1, 4.4,-.25,2, 0,0,1.8, 0,-.2,-1, 0,-.2,1.8, 4.4,-.45,2, 0,0,-1,0,-.2,-1,4.4,-.45,2, 0,0,-1,4.4,-.45,2,4.4,-.25,2],3));wingGeo.computeVertexNormals();
  for(const side of [-1,1]) {
    const wing = new THREE.Mesh(wingGeo,new THREE.MeshStandardMaterial({color:0xd7d5bd,side:THREE.DoubleSide,roughness:.7}));wing.scale.x=side;group.add(wing);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(.48,.6,3.1,8),orange);pod.rotation.x=Math.PI/2;pod.position.set(side*2.2,0,1.35);group.add(pod);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.42,.48,.6,8),dark);nozzle.rotation.x=Math.PI/2;nozzle.position.set(side*2.2,0,3);group.add(nozzle);
    const engine = new THREE.Mesh(new THREE.ConeGeometry(.38,2,12),new THREE.MeshBasicMaterial({color:0x9ef6e1,transparent:true,opacity:.8}));engine.rotation.x=Math.PI/2;engine.position.set(side*2.2,0,4);group.add(engine);group.userData.engines??=[];group.userData.engines.push(engine);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.3,1,.6),dark);foot.position.set(side*1,-1.1,1);group.add(foot);group.userData.gear??=[];group.userData.gear.push(foot);
    for(const z of [-1.2,1.6]) {
      const jet = new THREE.Mesh(new THREE.ConeGeometry(.24,1.8,8),new THREE.MeshBasicMaterial({color:0xa5f7e1,transparent:true,opacity:.65,depthWrite:false}));
      jet.rotation.z=Math.PI;jet.position.set(side*.85,-2,z);group.add(jet);
      group.userData.liftJets??=[];group.userData.liftJets.push(jet);
    }
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.15,1.5,1.5),orange);fin.position.set(0,1.3,1.6);fin.rotation.x=-.3;group.add(fin);
  return group;
}
const ship = makeShip();scene.add(ship);
const shipShadow = new THREE.Mesh(new THREE.CircleGeometry(4.2,32),new THREE.MeshBasicMaterial({color:0x172323,transparent:true,opacity:.23,depthWrite:false}));scene.add(shipShadow);

let verticalSpeed=0, flightPitch=0, bankAngle=0, turnVelocity=0, gearDeployment=0, maneuver=null;
const dustMaterial=new THREE.MeshBasicMaterial({color:0xb9bba2,transparent:true,opacity:0,depthWrite:false});
const dust=new THREE.Group();
for(let i=0;i<28;i++){const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),dustMaterial);dust.add(puff);}
scene.add(dust);
let started=false, mode='flight', speed=0, autoApproach=false, stage=0, discovered=false, completed=false;
const saveKey=`elsewhere-system-${system.seed}`;
let records=new Set(),visited=new Set([activeBody.id]);
try{const saved=JSON.parse(localStorage.getItem(saveKey)||'{}');records=new Set((saved.records||[]).filter(id=>system.bodies.some(b=>b.id===id)));visited=new Set([activeBody.id,...(saved.visited||[]).filter(id=>system.bodies.some(b=>b.id===id))]);}catch{}
discovered=records.has(activeBody.id);
let selectedBody=system.bodies[0],travel=null;
const spaceUp=Y.clone();
function saveSurvey(){try{localStorage.setItem(saveKey,JSON.stringify({records:[...records],visited:[...visited]}));}catch{}}
function setDiscoveryText(body){
 $('discoveryEyebrow').textContent=`FIELD NOTE / ${body.name.toUpperCase()}`;
 $('discoveryTitle').textContent=body.title;
 $('discoveryText').textContent=body.note;
 $('discoveryQuote').textContent=body.message;
}

$('logBtn').hidden=!discovered;
$('logBtn').onclick=()=>{keys.clear();setDiscoveryText(activeBody);$('discovery').showModal();};
let shipPosition=landingNormal.clone().multiplyScalar(RADIUS+150), shipForward=tangent(signalNormal.clone().sub(landingNormal),landingNormal);
let playerNormal=landingNormal.clone(), playerForward=vec(0,0,-1), lookPitch=0;
let orbitYaw=0, orbitPitch=.18, dragging=false, lastPointer={x:0,y:0};
let toastTime=0, animationTime=0, previousTime=performance.now(), bob=0;
const keys=new Set();
const clockBasis=new THREE.Matrix4();
function orientShip(dt=1) {
  const up=shipPosition.clone().normalize();shipForward=tangent(shipForward,up);
  const right=shipForward.clone().cross(up).normalize();
  clockBasis.makeBasis(right,up,shipForward.clone().negate());
  const attitude=new THREE.Quaternion().setFromRotationMatrix(clockBasis);
  attitude.multiply(new THREE.Quaternion().setFromAxisAngle(vec(1,0,0),flightPitch+clamp(verticalSpeed*.004,-.1,.1)));
  attitude.multiply(new THREE.Quaternion().setFromAxisAngle(vec(0,0,1),bankAngle));
  ship.quaternion.slerp(attitude,1-Math.exp(-dt*9));ship.position.copy(shipPosition);
  shipShadow.position.copy(surfacePoint(up,.13));shipShadow.quaternion.setFromUnitVectors(vec(0,0,1),up);shipShadow.material.opacity=clamp(.3-(shipPosition.length()-surfaceRadius(up))*.007,0,.25);
}
function altitude() {const n=shipPosition.clone().normalize();return shipPosition.length()-surfaceRadius(n)-1.7;}
function distanceToSignal() {return Math.acos(clamp((mode==='walk'?playerNormal:shipPosition.clone().normalize()).dot(signalNormal),-1,1))*RADIUS;}
function toast(message) {$('toast').textContent=message;$('toast').classList.add('visible');toastTime=4;}
function setStage(next) {
  stage=next;
  const entries=[['Follow the signal','Something is transmitting from the surface.'],['Investigate the surface','Leave the ship and follow the signal on foot.'],['Return to Kestrel','Signal recorded. Your ship is waiting nearby.'],['A beginning, not an ending',`Signal recorded. Open the system map to visit another world.`]];
  $('objective').textContent=entries[stage][0];$('objectiveDetail').textContent=entries[stage][1];$('stepCount').textContent=`0${stage+1} / 04`;$('progress').style.width=`${(stage+1)*25}%`;
}
function modalOpen(){return $('help').open||$('discovery').open||$('systemMap').open;}
function start(){if(started)return;started=true;$('hud').inert=false;$('intro').inert=true;$('intro').classList.add('hidden');document.body.classList.add('playing');toast('Welcome to '+system.name+'. Press M to choose a world, or explore '+activeBody.name+'.');}
function approach(){if(mode!=='flight')return;autoApproach=!autoApproach;toast(autoApproach?'Approach assist engaged. Manual controls cancel it.':'Approach assist disengaged.');}
function act() {
  if(!started||modalOpen())return;
  if(mode==='space'){beginCruise();return;}
  if(mode==='transit'){cancelCruise();return;}
  if(mode==='flight'){
    if(altitude()>32){toast('Descend below 32 m with F, or use Approach signal.');return;}
    if(Math.abs(speed)>18){toast('Slow below 18 m/s. Release thrust or hold X to brake.');return;}
    // A conservative slope check rejects exceptionally steep generated ridges.
    const n=shipPosition.clone().normalize(), side=shipForward.clone().cross(n).normalize();
    const slope=Math.abs(heightAt(n.clone().addScaledVector(side,.018).normalize())-heightAt(n.clone().addScaledVector(side,-.018).normalize()));
    if(slope>3.5){toast('Terrain too steep. Move toward flatter ground.');return;}
    autoApproach=false;keys.clear();
    maneuver={time:0,duration:3.8,start:shipPosition.clone(),normal:n.clone(),height:shipPosition.length()-surfaceRadius(n)-1.7};
    mode='landing';toast('Landing sequence. Gear down; settling onto the surface.');
  }else if(mode==='landed'){
    keys.clear();speed=0;verticalSpeed=0;
    maneuver={time:0,duration:3.6,start:shipPosition.clone(),normal:shipPosition.clone().normalize()};
    mode='takeoff';toast('Lift engines charging. Clearing the surface.');
  }else if(mode==='walk'){
    const shipDistance=surfacePoint(playerNormal).distanceTo(shipPosition);
    if(shipDistance<9){mode='landed';speed=0;verticalSpeed=0;toast('Back aboard Kestrel. Press L to lift off.');}
    else if(distanceToSignal()<9){discover();}
    else toast(stage===2?'Follow the Kestrel marker to return to your ship.':'Follow the signal. Get closer to investigate.');
  }
}
function interact(){
  if(!started||modalOpen())return;
  if(mode==='landed'){
    const up=shipPosition.clone().normalize(), right=shipForward.clone().cross(up).normalize();
    playerNormal=shipPosition.clone().addScaledVector(right,5.5).addScaledVector(shipForward,2).normalize();
    playerForward=tangent(signalNormal.clone().sub(playerNormal),playerNormal);if(playerForward.lengthSq()<.1)playerForward=tangent(shipForward,playerNormal);
    lookPitch=0;mode='walk';if(stage===0)setStage(1);toast('On foot. Drag to look; WASD to walk.');
  }else if(mode==='walk')act();
}
function discover(){
  discovered=true;records.add(activeBody.id);saveSurvey();setDiscoveryText(activeBody);$('logBtn').hidden=false;setStage(2);beacon.visible=false;
  keys.clear();$('discovery').showModal();
}
$('startBtn').onclick=start;$('approachBtn').onclick=approach;
$('actionBtn').onclick=()=>mode==='landed'?interact():act();
$('helpBtn').onclick=()=>{keys.clear();$('help').showModal();};$('closeHelp').onclick=()=>$('help').close();
$('closeDiscovery').onclick=()=>$('discovery').close();
$('resetBtn').onclick=()=>{try{localStorage.removeItem(saveKey);}catch{}location.reload();};
window.addEventListener('keydown',(e)=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&started&&!modalOpen())e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyM'){if($('systemMap').open)$('systemMap').close();else openMap();return;}
  if(e.code==='KeyT'&&!modalOpen()){if(mode==='transit')cancelCruise();else beginCruise();return;}
  if(e.code==='KeyH'){if($('help').open)$('help').close();else{keys.clear();$('help').showModal();}return;}
  if(!started||modalOpen()||['BUTTON','A'].includes(document.activeElement?.tagName)&&e.code==='Space')return;
  keys.add(e.code);
  if(['KeyW','KeyS','KeyA','KeyD','KeyR','KeyF','KeyX','ArrowUp','ArrowDown'].includes(e.code))autoApproach=false;
  if(e.code==='KeyL'){if(mode!=='walk')act();}
  if(e.code==='KeyE')interact();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();dragging=false;});
document.addEventListener('visibilitychange',()=>{keys.clear();previousTime=performance.now();});
const canvas=$('world');
canvas.addEventListener('pointerdown',e=>{if(!started||modalOpen())return;dragging=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if(!dragging)return;const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;lastPointer={x:e.clientX,y:e.clientY};
  if(mode==='walk'){playerForward.applyAxisAngle(playerNormal,-dx*.004);lookPitch=clamp(lookPitch-dy*.003,-1.15,1.1);}
  else{orbitYaw-=dx*.005;orbitPitch=clamp(orbitPitch+dy*.004,-.25,1.15);}
});
canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
for(const button of document.querySelectorAll('[data-key]')){
  const key=button.dataset.key;
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(modalOpen())return;autoApproach=false;keys.add(key);button.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));
}

// Optional quiet engine drone, created only after an explicit sound-button gesture.
let audioContext,engineGain,engineOsc,sound=false;
$('soundBtn').onclick=async()=>{
  try{
    if(!audioContext){audioContext=new AudioContext();engineOsc=audioContext.createOscillator();engineOsc.type='sine';engineGain=audioContext.createGain();engineGain.gain.value=0;engineOsc.connect(engineGain).connect(audioContext.destination);engineOsc.start();}
    await audioContext.resume();sound=!sound;$('soundLabel').textContent=sound?'ON':'OFF';$('soundBtn').setAttribute('aria-label',sound?'Disable sound':'Enable sound');
  }catch{toast('Audio is unavailable in this browser.');}
};

function refreshWorldLabels(){
 $('worldName').textContent=activeBody.name.toUpperCase();
 $('worldType').textContent=activeBody.type+' · '+system.name+' system';
 $('systemName').textContent=system.name.toUpperCase()+' / '+system.bodies.length+' WORLDS';
 $('seedInput').value=system.seed;
 $('introDescription').textContent=`Seven worlds orbit ${system.star.name}. Start above ${activeBody.name}, or open your map and chart a different course.`;
 $('systemCoordinates').textContent=`${system.name.toUpperCase()} SYSTEM / SEED ${system.seed}`;
}
function switchWorld(body,globalPosition){
 const oldOrigin=worldOrigin.clone();
 activeBody=body;RADIUS=body.radius;worldOrigin=vec(...body.position);
 signalNormal=vec(...body.signal);
 landingNormal=vec(0,1,.17).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y,signalNormal));
 const geometries=new Set(),materials=new Set();
 surfaceGroup.traverse(object=>{if(object.isInstancedMesh)object.dispose();if(object.geometry)geometries.add(object.geometry);if(object.material)for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);});
 scene.remove(surfaceGroup);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
 surfaceGroup=new THREE.Group();scene.add(surfaceGroup);buildSurface();positionSystem();
 shipPosition.copy(globalPosition).sub(worldOrigin);camera.position.add(oldOrigin).sub(worldOrigin);
 const arrivalNormal=shipPosition.lengthSq()>.01?shipPosition.clone().normalize():signalNormal.clone();
 const safeRadius=surfaceRadius(arrivalNormal)+4;
 if(shipPosition.length()<safeRadius)shipPosition.copy(arrivalNormal.multiplyScalar(safeRadius));
 const n=shipPosition.clone().normalize();
 shipForward=tangent(signalNormal.clone().sub(n),n);
 if(shipForward.lengthSq()<.01)shipForward=tangent(vec(0,0,-1),n);
 speed=0;verticalSpeed=0;flightPitch=0;bankAngle=0;turnVelocity=0;autoApproach=false;mode='flight';gearDeployment=0;
 discovered=records.has(body.id);completed=discovered;setStage(discovered?3:0);beacon.visible=!discovered;$('logBtn').hidden=!discovered;
 visited.add(body.id);saveSurvey();refreshWorldLabels();orientShip();
 toast(`Arrived at ${body.name}. Fly down, or use Approach signal to find a landing site.`);
}
function orientSpace(dt){
 let right=shipForward.clone().cross(spaceUp);
 if(right.lengthSq()<1e-8)right=shipForward.clone().cross(Math.abs(shipForward.x)<.9?vec(1,0,0):vec(0,0,1));
 right.normalize();spaceUp.copy(right.clone().cross(shipForward).normalize());
 clockBasis.makeBasis(right,spaceUp,shipForward.clone().negate());
 const attitude=new THREE.Quaternion().setFromRotationMatrix(clockBasis);
 attitude.multiply(new THREE.Quaternion().setFromAxisAngle(vec(0,0,1),bankAngle));
 ship.quaternion.slerp(attitude,1-Math.exp(-dt*6));ship.position.copy(shipPosition);shipShadow.visible=false;
}
function updateSpace(dt){
 const yaw=(keys.has('KeyA')?1:0)-(keys.has('KeyD')?1:0);
 shipForward.applyAxisAngle(spaceUp,yaw*dt*.85);
 const right=shipForward.clone().cross(spaceUp).normalize();
 const pitch=(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0);
 shipForward.applyAxisAngle(right,pitch*dt*.7).normalize();spaceUp.applyAxisAngle(right,pitch*dt*.7).normalize();
 const boost=keys.has('ShiftLeft')||keys.has('ShiftRight'),brake=keys.has('KeyX');
 speed=damp(speed,brake?0:((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0))*(boost?900:220),brake?4:1.4,dt);
 verticalSpeed=damp(verticalSpeed,brake?0:((keys.has('KeyR')?1:0)-(keys.has('KeyF')?1:0))*(boost?100:35),3,dt);
 bankAngle=damp(bankAngle,yaw*.25,4,dt);
 shipPosition.addScaledVector(shipForward,speed*dt).addScaledVector(spaceUp,verticalSpeed*dt);
 const global=shipPosition.clone().add(worldOrigin);
 if(global.length()<system.star.radius+140){global.setLength(system.star.radius+145);shipPosition.copy(global).sub(worldOrigin);speed=0;verticalSpeed=0;toast('Stellar exclusion zone. Turn away from Helion.');}
 const nearby=system.bodies.map(body=>({body,clearance:global.distanceTo(vec(...body.position))-body.radius})).filter(item=>item.clearance<240).sort((a,b)=>a.clearance-b.clearance);
 if(nearby.length){switchWorld(nearby[0].body,global);return;}
 orientSpace(dt);
}
function beginCruise(){
 if(!started)return;
 if(mode!=='flight'&&mode!=='space'){toast('Return to your ship and take off before engaging cruise.');return;}
 const start=shipPosition.clone().add(worldOrigin),n=shipPosition.clone().normalize();
 const departure=mode==='space'?start.clone():worldOrigin.clone().addScaledVector(n,RADIUS+650);
 const end=vec(...selectedBody.position).addScaledVector(vec(...selectedBody.signal),selectedBody.radius+190);
 travel={body:selectedBody,start:start.toArray(),departure:departure.toArray(),end:end.toArray(),time:0,duration:12};
 autoApproach=false;keys.clear();mode='transit';spaceUp.copy(n);$('systemMap').close();
 $('transit').hidden=false;$('transitTitle').textContent=`BOUND FOR ${selectedBody.name.toUpperCase()}`;
 toast('Cruise engaged. Press T to disengage and fly manually.');
}
function cancelCruise(){
 if(mode!=='transit')return;
 mode='space';travel=null;speed=Math.min(speed,150);verticalSpeed=0;$('transit').hidden=true;keys.clear();toast('Cruise disengaged. Manual spaceflight.');
}
function updateCruise(dt){
 travel.time+=dt;const t=clamp(travel.time/travel.duration,0,1);
 const next=vec(...cruisePoint(travel.start,travel.departure,travel.end,t)).sub(worldOrigin);
 const delta=next.clone().sub(shipPosition);
 speed=delta.length()/Math.max(dt,.001);verticalSpeed=0;
 if(delta.lengthSq()>.00001)shipForward.lerp(delta.normalize(),1-Math.exp(-dt*3)).normalize();
 shipPosition.copy(next);bankAngle=damp(bankAngle,0,3,dt);spaceUp.lerp(Y,dt*.4).normalize();
 orientSpace(dt);$('transitProgress').style.width=`${t*100}%`;$('transitPercent').textContent=`${Math.round(t*100)}%`;
 if(t>=1){const destination=travel.body,global=next.clone().add(worldOrigin);travel=null;$('transit').hidden=true;switchWorld(destination,global);}
}
let mapScale=1,mapX=0,mapY=0,mapDrag=null;
function renderMap(){
 const extent=Math.max(...system.bodies.filter(b=>!b.parent).map(b=>b.orbit))+1000;
 $('mapOrbits').innerHTML=system.bodies.filter(b=>!b.parent).map(b=>`<circle cx="50" cy="50" r="${b.orbit/extent*44}"/>`).join('');
 $('mapBodies').replaceChildren();$('worldList').replaceChildren();
 for(const body of system.bodies){
  const select=()=>{selectedBody=body;renderMap();};
  const dot=document.createElement('button');dot.className='map-body'+(selectedBody.id===body.id?' selected':'')+(body.parent?' moon':'');
  dot.style.left=`${50+body.position[0]/extent*44}%`;dot.style.top=`${50+body.position[2]/extent*44}%`;dot.style.setProperty('--planet-color',body.palette[2]);
  dot.setAttribute('aria-label',`Select ${body.name}`);dot.innerHTML=`<i></i><span>${body.name}</span>`;dot.onclick=select;$('mapBodies').append(dot);
  const row=document.createElement('button');row.className='world-row'+(selectedBody.id===body.id?' selected':'');row.setAttribute('aria-pressed',String(selectedBody.id===body.id));
  row.innerHTML=`<i style="background:${body.palette[2]}"></i><span><strong>${body.name}</strong><small>${body.type}${body.parent?' · '+system.bodies.find(b=>b.id===body.parent).name:''}</small></span><em>${records.has(body.id)?'RECORDED':activeBody.id===body.id?'HERE':visited.has(body.id)?'VISITED':'UNKNOWN'}</em>`;
  row.onclick=select;$('worldList').append(row);
 }
 $('selectedName').textContent=selectedBody.name;$('selectedType').textContent=selectedBody.type.toUpperCase();$('selectedDescription').textContent=selectedBody.description;
 $('selectedFacts').textContent=`${selectedBody.radius*2} m diameter · ${records.has(selectedBody.id)?'Signal recorded':'Unidentified surface signal'}`;
 $('travelBtn').disabled=!started||!['flight','space'].includes(mode);
 $('travelBtn').textContent=mode==='transit'?'Cruise in progress':!started?'Begin expedition first':!['flight','space'].includes(mode)?'Take off to travel':`Cruise to ${selectedBody.name} ↗`;
 $('surveyCount').textContent=`${visited.size} / ${system.bodies.length} visited · ${records.size} signals recorded`;
}
function transformMap(){$('mapPlane').style.transform=`translate(${mapX}px,${mapY}px) scale(${mapScale})`;}
function openMap(){if($('help').open||$('discovery').open)return;keys.clear();renderMap();$('systemMap').showModal();}
$('mapBtn').onclick=openMap;$('closeMap').onclick=()=>$('systemMap').close();$('travelBtn').onclick=beginCruise;$('cancelTransit').onclick=cancelCruise;
$('seedForm').onsubmit=e=>{e.preventDefault();const value=$('seedInput').value;if(!/^\d+$/.test(value)||Number(value)>4294967295)return;location.search=`?seed=${value}`;};
$('randomSystem').onclick=()=>{const value=crypto.getRandomValues(new Uint32Array(1))[0];location.search=`?seed=${value}`;};
$('mapViewport').addEventListener('wheel',e=>{e.preventDefault();mapScale=clamp(mapScale*Math.exp(-e.deltaY*.001),.7,3);transformMap();},{passive:false});
$('mapViewport').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;mapDrag={x:e.clientX,y:e.clientY};$('mapViewport').setPointerCapture(e.pointerId);});
$('mapViewport').addEventListener('pointermove',e=>{if(!mapDrag)return;mapX+=e.clientX-mapDrag.x;mapY+=e.clientY-mapDrag.y;mapDrag={x:e.clientX,y:e.clientY};transformMap();});
for(const event of ['pointerup','pointercancel'])$('mapViewport').addEventListener(event,()=>mapDrag=null);
$('resetMap').onclick=()=>{mapScale=1;mapX=0;mapY=0;transformMap();};

function updateFlight(dt){
  const up=shipPosition.clone().normalize();
  if(autoApproach){
    const angle=up.angleTo(landingNormal), currentRadius=shipPosition.length();
    const nextUp=up.clone();
    const turnStep=Math.min(angle,dt*Math.min(.14,angle*.75));
    if(angle>.001){const axis=up.clone().cross(landingNormal).normalize();nextUp.applyAxisAngle(axis,turnStep);shipForward=tangent(landingNormal.clone().sub(up),nextUp);}
    const targetRadius=surfaceRadius(nextUp)+(angle>.16?65:14);
    const targetVertical=clamp((targetRadius-currentRadius)*.8,-18,18);
    verticalSpeed=damp(verticalSpeed,targetVertical,2.2,dt);
    const radius=currentRadius+verticalSpeed*dt;
    shipPosition.copy(nextUp.multiplyScalar(radius));speed=angle>.001?turnStep/dt*radius:0;
    flightPitch=damp(flightPitch,0,3,dt);bankAngle=damp(bankAngle,0,3,dt);
    if(angle<.012&&altitude()<18){autoApproach=false;speed=0;toast('Approach complete. Press L to land.');}
  }else{
    const turn=(keys.has('KeyA')?1:0)-(keys.has('KeyD')?1:0);
    turnVelocity=damp(turnVelocity,turn*1.0,4,dt);
    shipForward.applyAxisAngle(up,turnVelocity*dt);
    bankAngle=damp(bankAngle,turnVelocity*.3,4,dt);
    const pitchInput=(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0);
    flightPitch=damp(flightPitch,pitchInput*.65,2.4,dt);
    const boost=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const braking=keys.has('KeyX');
    let targetSpeed=((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0))*(boost?100:40);
    if(braking)targetSpeed=0;
    speed=damp(speed,targetSpeed,braking?5:1.7,dt);
    const lift=(keys.has('KeyR')?1:0)-(keys.has('KeyF')?1:0);
    const desiredVertical=braking?0:verticalTarget(lift,flightPitch,speed,boost,altitude());
    verticalSpeed=damp(verticalSpeed,desiredVertical,braking?5:(lift?2.2:3.2),dt);
    const radius=shipPosition.length()+verticalSpeed*dt;
    const n=shipPosition.clone().addScaledVector(shipForward,speed*Math.cos(flightPitch)*dt).normalize();
    const floor=surfaceRadius(n)+3.2;
    const boundedRadius=Math.max(radius,floor);
    if(boundedRadius!==radius)verticalSpeed=0;
    shipPosition.copy(n.multiplyScalar(boundedRadius));
  }
  orientShip(dt);
  const global=shipPosition.clone().add(worldOrigin);
  const neighbor=system.bodies.filter(body=>body.id!==activeBody.id).map(body=>({body,clearance:global.distanceTo(vec(...body.position))-body.radius})).filter(item=>item.clearance<240&&item.clearance<altitude()).sort((a,b)=>a.clearance-b.clearance)[0];
  if(neighbor){switchWorld(neighbor.body,global);return;}
  if(altitude()>600){mode='space';shipForward=shipForward.clone().multiplyScalar(Math.cos(flightPitch)).addScaledVector(up,Math.sin(flightPitch)).normalize();spaceUp.copy(up);autoApproach=false;toast('Orbit cleared. Fly freely, or press M to chart a course.');}
}
function updateManeuver(dt){
  maneuver.time+=dt;
  const t=clamp(maneuver.time/maneuver.duration,0,1);
  const before=shipPosition.clone();
  bankAngle=damp(bankAngle,0,5,dt);flightPitch=damp(flightPitch,0,5,dt);
  speed=damp(speed,0,5,dt);
  if(mode==='landing'){
    const ease=smootherstep(t);
    shipPosition.copy(maneuver.normal).multiplyScalar(surfaceRadius(maneuver.normal)+1.7+maneuver.height*(1-ease));
    verticalSpeed=shipPosition.clone().sub(before).dot(maneuver.normal)/dt;
    if(t>=1){mode='landed';verticalSpeed=0;speed=0;maneuver=null;toast('Touchdown. Engines idle. Press E to leave Kestrel.');}
  }else{
    // Charge, lift vertically, then gently hand control back above the terrain.
    const liftT=clamp((t-.16)/.84,0,1);
    const height=22*smootherstep(liftT);
    shipPosition.copy(maneuver.normal).multiplyScalar(surfaceRadius(maneuver.normal)+1.7+height);
    verticalSpeed=shipPosition.clone().sub(before).dot(maneuver.normal)/dt;
    if(t>=1){mode='flight';verticalSpeed=0;speed=0;maneuver=null;
      if(stage===2){completed=true;setStage(3);toast('Signal recorded. Press M to choose your next world.');}
      else toast('Clear of the surface. You have control.');
    }
  }
  orientShip(dt);
}
function updateShipEffects(dt){
  const maneuvering=mode==='landing'||mode==='takeoff';
  const gearTarget=mode==='landed'||mode==='walk'||mode==='landing'?1:0;
  gearDeployment=damp(gearDeployment,gearTarget,mode==='takeoff'?1.2:3,dt);
  for(const foot of ship.userData.gear){foot.scale.y=.15+.85*gearDeployment;foot.position.y=-.5-.6*gearDeployment;}
  const agl=Math.max(0,altitude());
  let liftPower=mode==='flight'?.2+Math.abs(verticalSpeed)*.025:0;
  if(mode==='landing')liftPower=.4+.45*(1-clamp(agl/28,0,1));
  if(mode==='takeoff')liftPower=.25+.8*smoothstep(maneuver.time/.8);
  for(const jet of ship.userData.liftJets){jet.visible=liftPower>.05;jet.scale.y=liftPower*(.9+.1*Math.sin(animationTime*45));jet.position.y=-1.25-jet.scale.y*.9;}
  for(const engine of ship.userData.engines){engine.visible=mode==='flight'||mode==='space'||mode==='transit'||maneuvering;engine.scale.y=.12+Math.min(Math.abs(speed),130)*.026+Math.sin(animationTime*40)*.025;}
  const dustPower=(mode==='space'||mode==='transit')?0:liftPower*clamp(1-agl/18,0,1);
  dust.visible=dustPower>.025;
  if(dust.visible){const n=shipPosition.clone().normalize();dust.position.copy(surfacePoint(n,.2));dust.quaternion.setFromUnitVectors(Y,n);dustMaterial.opacity=dustPower*.12;
    for(let i=0;i<dust.children.length;i++){const phase=(animationTime*.55+i/28)%1;const angle=i*2.399;const radius=2+phase*10;const puff=dust.children[i];puff.position.set(Math.cos(angle)*radius,.15+phase*.8,Math.sin(angle)*radius);puff.scale.set(1+phase*2,.2+phase*.45,1+phase*2);}
  }
}
function updateWalk(dt){
  const turn=(keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0);playerForward.applyAxisAngle(playerNormal,turn*dt*1.6);
  lookPitch=clamp(lookPitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*dt,-1.15,1.1);
  const right=playerForward.clone().cross(playerNormal).normalize();
  const direction=playerForward.clone().multiplyScalar((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)).addScaledVector(right,(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0));
  const moving=direction.lengthSq()>.01;
  const walkingSpeed=keys.has('ShiftLeft')||keys.has('ShiftRight')?8:4.5;
  if(moving){direction.normalize();const next=surfacePoint(playerNormal).addScaledVector(direction,walkingSpeed*dt).normalize();
    // Keep the player outside the central solid pedestal; interaction is available around it.
    if(Math.acos(clamp(next.dot(signalNormal),-1,1))*RADIUS>3.7)playerNormal.copy(next);
  }
  playerForward=tangent(playerForward,playerNormal);bob+=moving?dt*walkingSpeed*1.8:0;
  speed=moving?walkingSpeed:0;
}
function updateCamera(dt){
  if(mode==='walk'){
    const eye=surfacePoint(playerNormal,1.75+Math.sin(bob)*.025);
    camera.position.copy(eye);camera.up.copy(playerNormal);
    const look=playerForward.clone().multiplyScalar(Math.cos(lookPitch)).addScaledVector(playerNormal,Math.sin(lookPitch));camera.lookAt(eye.clone().add(look));
    camera.fov=70;
  }else{
    if(!dragging){orbitYaw=THREE.MathUtils.damp(orbitYaw,0,2,dt);orbitPitch=THREE.MathUtils.damp(orbitPitch,.18,2,dt);}
    const inSpace=mode==='space'||mode==='transit';
    const up=inSpace?spaceUp.clone():shipPosition.clone().normalize();
    const back=shipForward.clone().negate().applyAxisAngle(up,orbitYaw);
    const framing = Math.max(1, .65 / camera.aspect);
    const desired=shipPosition.clone().addScaledVector(back,26*framing*Math.cos(orbitPitch)).addScaledVector(up,(21+20*Math.sin(orbitPitch))*framing);
    const normal=desired.clone().normalize();const floor=surfaceRadius(normal)+2;
    if(!inSpace&&desired.length()<floor)desired.copy(normal.multiplyScalar(floor));
    camera.position.lerp(desired,1-Math.exp(-dt*4));camera.up.lerp(up,1-Math.exp(-dt*4)).normalize();
    camera.lookAt(shipPosition.clone().addScaledVector(shipForward,12).addScaledVector(up,inSpace?0:-7));camera.fov=THREE.MathUtils.damp(camera.fov,58+(Math.abs(speed)>55?7:0),3,dt);
  }
  camera.updateProjectionMatrix();
}
function updateHUD(){
  const isWalking=mode==='walk', maneuvering=mode==='landing'||mode==='takeoff';
  const inSpace=mode==='space'||mode==='transit';
  const destination=vec(...selectedBody.position).sub(worldOrigin);
  $('worldName').textContent=inSpace?system.name.toUpperCase():activeBody.name.toUpperCase();
  $('worldType').textContent=inSpace?`Destination: ${selectedBody.name} · ${selectedBody.type}`:activeBody.type+' · '+system.name+' system';
  shipShadow.visible=!inSpace;
  $('modeLabel').textContent=inSpace?(mode==='transit'?'CRUISE / INTERPLANETARY':'FREE FLIGHT / INTERPLANETARY'):isWalking?'SURFACE EXPEDITION':mode==='landed'?'LANDED / KEStREL'.toUpperCase():maneuvering?(mode==='landing'?'LANDING / GEAR DOWN':'TAKEOFF / VERTICAL LIFT'):autoApproach?'APPROACH ASSIST':'ORBITAL FLIGHT';
  $('altLabel').textContent=inSpace?'TO DESTINATION':isWalking?(stage===2?'TO SHIP':'TO SIGNAL'):'ALTITUDE';
  $('altitude').innerHTML=`${Math.max(0,Math.round(inSpace?shipPosition.distanceTo(destination):isWalking?(stage===2?surfacePoint(playerNormal).distanceTo(shipPosition):distanceToSignal()):altitude()))} <small>m</small>`;
  $('speed').innerHTML=`${(isWalking?Math.abs(speed):Math.hypot(speed,verticalSpeed)).toFixed(0)} <small>m/s</small>`;
  const displayedVertical=Math.abs(verticalSpeed)<.05?0:verticalSpeed;
  $('verticalSpeed').innerHTML=`${displayedVertical>=0?'+':''}${displayedVertical.toFixed(1)} <small>m/s</small>`;
  $('verticalReadout').hidden=isWalking;
  $('actionBtn').disabled=maneuvering;$('approachBtn').disabled=maneuvering;
  $('vesselStatus').textContent=mode==='landed'?'LANDED':isWalking?'ON FOOT':'KESTREL';
  $('approachBtn').hidden=mode==='walk';
  $('approachBtn').textContent=inSpace?'◉ System map [M]':mode==='landed'?'↑ Take off [L]':autoApproach?'× Cancel approach':'◎ Approach signal';
  $('approachBtn').onclick=inSpace?openMap:mode==='landed'?act:approach;
  let label;
  if(inSpace)label=mode==='transit'?'Disengage cruise <kbd>T</kbd>':`Cruise to ${selectedBody.name} <kbd>T</kbd>`;
  else if(maneuvering)label=mode==='landing'?'Settling onto surface…':'Lift engines engaged…';
  else if(mode==='landed')label='Leave ship <kbd>E</kbd>';
  else if(isWalking){const nearShip=surfacePoint(playerNormal).distanceTo(shipPosition)<9;label=nearShip?'Board Kestrel <kbd>E</kbd>':distanceToSignal()<9?'Investigate <kbd>E</kbd>':'Follow the marker <kbd>E</kbd>';}
  else label=altitude()>32?'Descend to land <kbd>L</kbd>':Math.abs(speed)>18?'Slow to land <kbd>L</kbd>':`Land on ${activeBody.name} <kbd>L</kbd>`;
  $('actionBtn').innerHTML=label;
  $('crosshair').style.display=isWalking?'block':'none';
  $('controlHint').innerHTML=isWalking?'<kbd>W A S D</kbd> walk <kbd>← →</kbd> look <kbd>E</kbd> interact <span>M system map · H controls</span>':'<kbd>W S</kbd> thrust <kbd>A D</kbd> steer <kbd>R F</kbd> lift <kbd>↑ ↓</kbd> pitch <kbd>SHIFT</kbd> boost <span>M system map · H controls</span>';
  const target=inSpace?destination:stage===2?shipPosition.clone():surfacePoint(signalNormal,9);
  const projected=target.clone().project(camera);
  const ahead=target.clone().sub(camera.position).dot(camera.getWorldDirection(vec()))>0;
  const x=clamp((projected.x*.5+.5)*innerWidth,55,innerWidth-55);
  const y=clamp((-projected.y*.5+.5)*innerHeight,100,innerHeight-200);
  $('waypoint').style.left=`${ahead?x:innerWidth/2}px`;$('waypoint').style.top=`${ahead?y:innerHeight-210}px`;
  $('waypointLabel').textContent=(ahead?'':'↶ ')+(inSpace?selectedBody.name.toUpperCase():stage===2?'KESTREL':discovered?'SIGNAL RECORDED':'UNKNOWN SIGNAL');
  const origin=isWalking?surfacePoint(playerNormal):shipPosition;
  $('waypointDistance').textContent=`${Math.round(origin.distanceTo(target))} m${ahead?'':' · behind you'}`;
}
let hudTimer=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-previousTime)/1000,.05);previousTime=now;
  if(document.hidden)return;
  const paused=modalOpen();
  if(!paused){animationTime+=dt;
    if(started){if(mode==='space')updateSpace(dt);else if(mode==='transit')updateCruise(dt);else if(mode==='flight')updateFlight(dt);else if(mode==='landing'||mode==='takeoff')updateManeuver(dt);else if(mode==='walk')updateWalk(dt);}
    else orientShip();
    updateCamera(dt);core.rotation.y+=dt*.5;core.position.y=4+Math.sin(animationTime*1.4)*.3;ring.rotation.z+=dt*.2;
    beacon.material.opacity=.1+Math.sin(animationTime*2)*.045;
    updateShipEffects(dt);
    toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');
    hudTimer+=dt;if(hudTimer>.08){updateHUD();hudTimer=0;}
  }
  if(engineGain){engineGain.gain.setTargetAtTime(sound&&!paused&&started&&(mode==='flight'||mode==='landing'||mode==='takeoff')?.025+Math.abs(speed)*.0004+Math.abs(verticalSpeed)*.001:0,audioContext.currentTime,.15);engineOsc.frequency.setTargetAtTime(45+Math.abs(speed)*.65+Math.abs(verticalSpeed)*1.2,audioContext.currentTime,.15);}
  renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',(e)=>{e.preventDefault();keys.clear();$('error').hidden=false;$('errorMessage').textContent='The graphics context was interrupted. Reload to start again; recorded discoveries are preserved.';});
orientShip();camera.position.copy(shipPosition).addScaledVector(shipForward,-22).addScaledVector(shipPosition.clone().normalize(),10);camera.up.copy(shipPosition.clone().normalize());camera.lookAt(shipPosition);
refreshWorldLabels();setStage(discovered?3:0);beacon.visible=!discovered;updateHUD();requestAnimationFrame(frame);
