import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { RADIUS, groundHeight, createBall, stepBall } from './forest-rush/movement.mjs';

const host = document.getElementById('gravity-dash-canvas');
host.innerHTML = `
  <div class="hud"><div class="brand">GRAVITY DASH<span>THE SUNLIT WOODS</span></div>
    <button id="pause" aria-label="Pause">Ⅱ</button></div>
  <div class="readout"><span id="distance">0 m</span><span id="speed">Just keep rolling.</span></div>
  <div id="intro" class="intro"><div><span class="eyebrow">ROOM TO FIND YOUR RHYTHM</span>
    <h1>Take the<br><em>long way.</em></h1><p>A ball. Rolling hills. A quiet forest.<br>No obstacles. Just find your flow.</p>
    <button id="start">Start rolling <span>↗</span></button><small>A / D or ← / → to steer · Space to hop<br>Touch: drag to steer · tap HOP</small></div></div>
  <button id="hop" aria-label="Hop">HOP ↑</button>
  <div class="hint" id="hint">A / D to steer · Space to hop · P to pause</div>`;
const style = document.createElement('style');
style.textContent = `
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#93a28b}
  #gravity-dash-canvas{position:fixed;inset:0;font-family:system-ui,sans-serif;color:#fff5df;overflow:hidden}
  canvas{display:block;width:100%;height:100%;touch-action:none}
  .hud{position:absolute;top:max(24px,env(safe-area-inset-top));left:26px;right:26px;display:flex;justify-content:space-between;align-items:start;z-index:2;pointer-events:none}
  .brand{font-size:12px;letter-spacing:3px;font-weight:650;text-shadow:0 1px 8px #244734}.brand span{display:block;font-size:9px;letter-spacing:2px;margin-top:9px;opacity:.8}
  button{font:inherit;cursor:pointer;border:0;touch-action:none}#pause{pointer-events:auto;color:#fff5df;background:#28493899;border:1px solid #ffffff44;border-radius:50%;width:38px;height:38px}
  .readout{position:absolute;bottom:28px;left:26px;display:grid;gap:6px;pointer-events:none}.readout span:first-child{font-size:27px;font-weight:400}.readout span:last-child{font-size:11px;opacity:.8}
  .hint{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;text-shadow:0 1px 5px #1a3b2a;pointer-events:none}
  .intro{position:absolute;inset:0;z-index:3;display:flex;align-items:center;padding:6vw;background:linear-gradient(90deg,#153426cc,#15342600)}.intro[hidden]{display:none}
  .eyebrow{font-size:10px;letter-spacing:3px;color:#eecf93}h1{font-family:Georgia,serif;font-size:clamp(50px,7vw,90px);line-height:1;letter-spacing:-2px;font-weight:400;margin:22px 0}h1 em{color:#eac88e}p{line-height:1.8;font-size:14px;color:#e0e5cf}#start{margin:12px 0;background:#edcc96;color:#243f31;border-radius:4px;padding:17px 23px;min-width:220px;text-align:left;font-weight:650}#start span{float:right}small{display:block;font-size:11px;line-height:1.9;color:#d3ddcc}
  #hop{display:none;position:absolute;bottom:max(24px,env(safe-area-inset-bottom));right:24px;width:78px;height:78px;border-radius:50%;color:#fff4dc;background:#294d3bc9;border:1px solid #ffffff66;z-index:2}
  @media(any-pointer:coarse),(max-width:600px){#hop{display:block}.hint{display:none}.intro{padding:25px}.readout{bottom:25px}.hud{left:20px;right:20px}.intro:not([hidden])~#hop{display:none}}
`;
document.head.appendChild(style);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor('#a6b29a');
host.prepend(renderer.domElement);
const scene = new THREE.Scene();
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 512; skyCanvas.height = 512;
const skyContext = skyCanvas.getContext('2d');
const skyGradient = skyContext.createLinearGradient(0,0,0,512);
skyGradient.addColorStop(0,'#809888'); skyGradient.addColorStop(.7,'#c9c9a6'); skyGradient.addColorStop(1,'#a6b29a');
skyContext.fillStyle=skyGradient; skyContext.fillRect(0,0,512,512);
const sunGlow=skyContext.createRadialGradient(365,120,4,365,120,180);
sunGlow.addColorStop(0,'#fff1bcb0');sunGlow.addColorStop(1,'#fff1bc00');
skyContext.fillStyle=sunGlow;skyContext.fillRect(0,0,512,512);
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.colorSpace=THREE.SRGBColorSpace;scene.background=skyTexture;
scene.fog = new THREE.Fog('#a6b29a', 40, 160);
scene.add(new THREE.HemisphereLight('#fff0ca', '#446342', 2.4));
const sun = new THREE.DirectionalLight('#ffe1a1', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 32, bottom: -32, near: 1, far: 100 });
sun.shadow.bias = -0.001;
scene.add(sun, sun.target);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 230);

// Shared height function drives both the mesh and the ball's contact with the ground.
const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
const terrainTiles = [];
const tileLength = 40;
function colorGround(x, z, color) {
  const pathBlend = Math.min(1, Math.abs(x) / 12);
  color.set('#b5ab78').lerp(new THREE.Color('#65834e'), pathBlend);
  color.multiplyScalar(0.96 + 0.04 * Math.sin(z * 0.8 + x * 1.4));
}
function placeTile(tile, startZ) {
  tile.userData.startZ = startZ;
  const positions = tile.geometry.attributes.position;
  const colors = tile.geometry.attributes.color;
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = tile.userData.localZ[i] + startZ;
    positions.setY(i, groundHeight(x, z));
    positions.setZ(i, z);
    colorGround(x, z, color);
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  positions.needsUpdate = colors.needsUpdate = true;
  tile.geometry.computeVertexNormals();
  tile.geometry.computeBoundingSphere();
}
for (let i = 0; i < 7; i++) {
  const geometry = new THREE.PlaneGeometry(150, tileLength, 64, 24);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
  const tile = new THREE.Mesh(geometry, terrainMaterial);
  tile.userData.localZ = Array.from({ length: geometry.attributes.position.count }, (_, j) => geometry.attributes.position.getZ(j));
  tile.receiveShadow = true;
  scene.add(tile); terrainTiles.push(tile);
}

// Forest stays beside the open rolling ground; trees are scenery, never hazards.
const bark = new THREE.MeshStandardMaterial({ color: '#6b5036', roughness: 1 });
const leaves = ['#365d3b', '#487346', '#5d8150'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
const trunkGeometry = new THREE.CylinderGeometry(.22, .4, 4, 6);
const crownGeometry = new THREE.ConeGeometry(2.7, 6, 7);
const trees = [];
function hash(n) { return (Math.sin(n * 127.1 + 33.7) * 43758.5453) % 1 + 1; }
for (let i = 0; i < 120; i++) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeometry, bark); trunk.position.y = 2; tree.add(trunk);
  for (let level = 0; level < 3; level++) {
    const crown = new THREE.Mesh(crownGeometry, leaves[level]);
    crown.position.y = 4 + level * 2;
    crown.scale.setScalar(1 - level * .18);
    crown.castShadow = true;
    tree.add(crown);
  }
  tree.scale.setScalar(.8 + (hash(i) % 1) * .6);
  tree.userData.index = i;
  scene.add(tree); trees.push(tree);
}
function placeTree(tree, z) {
  const i = tree.userData.index;
  const x = (i % 2 ? 1 : -1) * (11 + (hash(i + 40) % 1) * 30);
  tree.position.set(x, groundHeight(x, z), z);
}

const ballMesh = new THREE.Group();
const sphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 32, 20), new THREE.MeshStandardMaterial({ color: '#d4ebc0', roughness: .28, metalness: .12 }));
sphere.castShadow = true; ballMesh.add(sphere);
const stripeMaterial = new THREE.MeshStandardMaterial({ color: '#628d65', roughness: .5 });
for (let i = 0; i < 2; i++) {
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(RADIUS + .004, .018, 6, 64), stripeMaterial);
  if (i) stripe.rotation.y = Math.PI / 2;
  ballMesh.add(stripe);
}
scene.add(ballMesh);
// Soft contact shadow stays visible even while hopping.
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
const sc = shadowCanvas.getContext('2d');
const gradient = sc.createRadialGradient(32,32,0,32,32,32); gradient.addColorStop(0,'#20362088'); gradient.addColorStop(1,'#20362000'); sc.fillStyle=gradient; sc.fillRect(0,0,64,64);
const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7,2.7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
contact.rotation.x=-Math.PI/2;scene.add(contact);

let ball = createBall(), state = 'ready', jump = false, pointer = null, touch = 0, origin = 0;
const keys = new Set();
const intro = document.getElementById('intro'), startButton = document.getElementById('start');
const aim = new THREE.Vector3(), desiredCamera = new THREE.Vector3(), rotationAxis = new THREE.Vector3();
function resetInput() { keys.clear(); jump = false; touch = 0; pointer = null; }
function resetWorld() {
  ball = createBall(); ballMesh.quaternion.identity();
  terrainTiles.forEach((tile,i) => placeTile(tile, 20 - i * tileLength));
  trees.forEach((tree,i) => placeTree(tree, 20 - Math.floor(i / 2) * 3.6));
  camera.position.set(0, ball.y + 4.3, ball.z + 8.5);
  aim.set(0,ball.y+.6,ball.z-8);
  camera.lookAt(aim);
}
function resume() { state = 'running'; intro.hidden = true; resetInput(); }
function pause() {
  if (state === 'paused') return resume();
  if (state !== 'running') return;
  state = 'paused'; resetInput(); intro.hidden = false;
  intro.querySelector('h1').innerHTML = 'Take a<br><em>breather.</em>';
  intro.querySelector('p').textContent = 'Your patch of forest will be right here.';
  startButton.innerHTML = 'Keep rolling <span>↗</span>';
}
startButton.onclick = resume;
document.getElementById('pause').onclick = pause;
document.getElementById('hop').addEventListener('pointerdown', e => {e.preventDefault();if(state==='running')jump=true;});
addEventListener('keydown', e => {
  if (['Space','ArrowLeft','ArrowRight','ArrowUp'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (state==='running' && ['Space','ArrowUp'].includes(e.code)) jump=true;
  if (['KeyP','Escape'].includes(e.code)) pause();
  if (e.code==='Enter' && state!=='running') resume();
  if (e.code==='KeyR') {resetWorld();resume();}
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur',()=>{if(state==='running')pause();resetInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')pause();});
const surface=renderer.domElement;
surface.addEventListener('pointerdown',e=>{if(state!=='running'||pointer!==null)return;pointer=e.pointerId;origin=e.clientX;surface.setPointerCapture(pointer);});
surface.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;const dx=e.clientX-origin;touch=THREE.MathUtils.clamp(dx/45,-1,1);if(Math.abs(dx)>45)origin=e.clientX-Math.sign(dx)*45;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,e=>{if(e.pointerId===pointer){pointer=null;touch=0;}});
function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();resetWorld();
function update(dt) {
  const steer=THREE.MathUtils.clamp((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch,-1,1);
  const movement=stepBall(ball,steer,jump,dt);jump=false;
  if(ball.grounded){rotationAxis.set(movement.dz,0,-movement.dx).normalize();ballMesh.rotateOnWorldAxis(rotationAxis,Math.hypot(movement.dx,movement.dz)/RADIUS);}
  for(const tile of terrainTiles)if(tile.userData.startZ>ball.z+65)placeTile(tile,tile.userData.startZ-terrainTiles.length*tileLength);
  for(const tree of trees)if(tree.position.z>ball.z+25)placeTree(tree,tree.position.z-216);
  desiredCamera.set(ball.x*.65,groundHeight(ball.x,ball.z)+5.3,ball.z+8.5);
  camera.position.lerp(desiredCamera,1-Math.exp(-6*dt));
  aim.lerp(new THREE.Vector3(ball.x*.85,groundHeight(ball.x,ball.z-8)+1.2,ball.z-8),1-Math.exp(-9*dt));
  camera.lookAt(aim);
}
let previous=performance.now();
function frame(now) {
  let dt=Math.min(.05,(now-previous)/1000);previous=now;
  if(state==='running')while(dt>0){const step=Math.min(dt,1/120);update(step);dt-=step;}
  ballMesh.position.set(ball.x,ball.y,ball.z);
  contact.position.set(ball.x,groundHeight(ball.x,ball.z)+.025,ball.z);
  contact.material.opacity=1/(1+Math.max(0,ball.y-groundHeight(ball.x,ball.z)-RADIUS)*.3);
  sun.position.set(ball.x+15,ball.y+30,ball.z-20);sun.target.position.set(ball.x,ball.y,ball.z-8);
  document.getElementById('distance').textContent=`${Math.floor(ball.distance)} m`;
  document.getElementById('speed').textContent=state==='running'?`${Math.round(ball.speed*3.6)} km/h · room to roam`:'Just keep rolling.';
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
