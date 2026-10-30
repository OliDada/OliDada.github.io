// Decorative three.js background ("floaties").
// Lazy-loads three from a CDN and renders a slow-moving field of floating things behind the page.
// It attaches to the canvas with id "three-canvas" and exposes window.__threeScene with
// stop(), pause(), resume(), setOptions(opts) and poke().
//
// Options (also read from localStorage 'floaties' at start-up; site.js writes them):
//   shape:  'sparkles' | 'bubbles' | 'cubes' | 'dolphins' | 'snow' | 'pips' (Pip's head, once he's free)
//   amount: 'few' | 'some' | 'loads'
//   speed:  0.25 .. 3 (multiplier)
//   color:  'auto' or '#rrggbb'
//   follow: true/false – the scene leans towards the mouse (or the phone's tilt)

const THREE_CDN = 'https://unpkg.com/three@0.158.0/build/three.module.js';
const AMOUNTS = { few: 260, some: 800, loads: 2200 };
const DEFAULTS = { shape: 'sparkles', amount: 'some', speed: 1, color: 'auto', follow: true };
// once Pip (the chatbot) is free, a few of his heads are what floats by default
const pipFreeNow = () => { try { return !!JSON.parse(localStorage.getItem('bit-memory') || '{}').freed; } catch (e) { return false; } };
if (pipFreeNow()) Object.assign(DEFAULTS, { shape: 'pips', amount: 'few' });

let THREE = null;
let rafId = null;
let renderer, scene, camera, group, lights;
let _paused = false;
let opts = Object.assign({}, DEFAULTS);
let mouse = { x: 0, y: 0 };
let whoosh = 0;
let bgHex = null; // current page background as an int, or null when it's an image
let objects = null; // { kind, obj, data }

function readSaved() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('floaties') || '{}')); }
  catch (e) { return Object.assign({}, DEFAULTS); }
}

function parseColor(s) {
  if (!s || typeof s !== 'string') return null;
  s = s.trim().replace(/"|'/g, '');
  if (s.startsWith('#')) {
    if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    const n = parseInt(s.slice(1, 7), 16);
    return Number.isNaN(n) ? null : n;
  }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return m ? (+m[1] << 16) + (+m[2] << 8) + +m[3] : null;
}

// Pick a floatie colour that shows up on the current background:
// same hue as the page, much lighter on dark pages and much darker on light ones.
function autoColor() {
  if (bgHex === null) return new THREE.Color(0xffb347);
  const c = new THREE.Color(bgHex);
  const hsl = {}; c.getHSL(hsl);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum < 0.35) return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.1), 0.8);
  return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.1), Math.max(0.18, hsl.l - 0.38));
}
function floatieColor() {
  const n = opts.color && opts.color !== 'auto' ? parseColor(opts.color) : null;
  return n === null ? autoColor() : new THREE.Color(n);
}

// Small canvas textures so points are round dots / bubbles / snowflakes rather than squares
function makeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'bubble') {
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(22, 22, 6, 0, Math.PI * 2); g.fill();
  } else if (kind === 'flake') {
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      g.beginPath(); g.moveTo(32 - Math.cos(a) * 26, 32 - Math.sin(a) * 26); g.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26); g.stroke();
    }
  } else {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#fff'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Pip's face, as drawn by bit.js (falls back to a simple drawing if the chatbot isn't on this page).
// Each head is two sprites: the face (mouth, cheeks, little extras) and the eyes on top, so the
// eyes can look at your mouse. Textures are drawn once per mood and shared by every head.
const PIP_MOODS = ['happy', 'smile', 'joy', 'blush', 'love', 'surprised', 'smug', 'thinking', 'sleepy', 'hopeful', 'awkward'];
const pipTextures = new Map();
function svgTexture(key, svg, fallback) {
  if (pipTextures.has(key)) return pipTextures.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  pipTextures.set(key, tex);
  const simple = () => { g.clearRect(0, 0, 128, 128); fallback(g); tex.needsUpdate = true; };
  if (!svg) { simple(); return tex; }
  const img = new Image();
  // the whole 32x32 drawing, so the outline and the little extras (hearts, sparkles) are never cut off
  img.onload = () => { g.clearRect(0, 0, 128, 128); g.drawImage(img, 0, 0, 128, 128); tex.needsUpdate = true; };
  img.onerror = simple;
  let sized = svg.replace('<svg', '<svg width="128" height="128"');
  if (!sized.includes('xmlns=')) sized = sized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
  return tex;
}
const hasPip = () => window.Pip && typeof window.Pip.faceSVG === 'function' && typeof window.Pip.eyesSVG === 'function';
const faceTexture = mood => svgTexture('face:' + mood, hasPip() ? window.Pip.faceSVG(mood, 'none') : null, g => {
  g.fillStyle = '#fffaf0'; g.strokeStyle = '#1d1a2b'; g.lineWidth = 8;
  g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(64, 70, 18, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
});
const eyesTexture = key => svgTexture('eyes:' + key, hasPip() ? window.Pip.eyesSVG(key) : null, g => {
  g.fillStyle = g.strokeStyle = '#1d1a2b'; g.lineWidth = 6; g.lineCap = 'round';
  for (const x of [48, 80]) {
    if (key === 'shut') { g.beginPath(); g.moveTo(x - 7, 56); g.lineTo(x + 7, 56); g.stroke(); }
    else { g.beginPath(); g.arc(x, 56, key === 'wide' ? 10 : 8, 0, Math.PI * 2); g.fill(); }
  }
});
const eyesOf = mood => (hasPip() && window.Pip.moodEyes ? window.Pip.moodEyes(mood) : 'dots');
const pipMaterials = new Map();
function spriteMaterial(key, tex) {
  if (!pipMaterials.has(key)) pipMaterials.set(key, new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: true }));
  return pipMaterials.get(key);
}
const faceMat = mood => spriteMaterial('face:' + mood, faceTexture(mood));
const eyesMat = key => spriteMaterial('eyes:' + key, eyesTexture(key));

function buildPips(count) {
  const g = new THREE.Group(), data = [], now = performance.now();
  for (let i = 0; i < count; i++) {
    const mood = PIP_MOODS[Math.floor(Math.random() * PIP_MOODS.length)];
    const face = new THREE.Sprite(faceMat(mood)), eyes = new THREE.Sprite(eyesMat(eyesOf(mood)));
    // kept closer together than the other floaties, so a few heads are always in view
    face.position.set((Math.random() - 0.5) * 170, (Math.random() - 0.5) * 95, -55 + Math.random() * 85);
    const size = 4.6 * (0.85 + Math.random() * 0.3);
    face.scale.set(size, size, 1); eyes.scale.set(size, size, 1);
    g.add(face, eyes);
    data.push({ face, eyes, size, mood, blinkAt: now + 800 + Math.random() * 5000, blinkUntil: 0, moodAt: now + 4000 + Math.random() * 14000, look: new THREE.Vector2() });
  }
  return { kind: 'pips', obj: g, data };
}
let startledUntil = 0, goodbyeAt = 0;
// Pip is being reset: every head goes sad, starts to cry, and sinks out of sight
function pipsGoodbye() {
  if (!objects || objects.kind !== 'pips') return;
  goodbyeAt = performance.now();
  objects.data.forEach((d, i) => {
    d.gone = { delay: 500 + Math.random() * 1200, v: 0 };
    d.face.material = faceMat(i % 3 ? 'sad' : 'cry'); d.eyes.material = eyesMat(eyesOf(i % 3 ? 'sad' : 'cry'));
  });
}
function startlePips() {
  if (!objects || objects.kind !== 'pips') return;
  const now = performance.now();
  startledUntil = now + 1400;
  for (const d of objects.data) { d.startled = true; d.face.material = faceMat('surprised'); d.eyes.material = eyesMat('wide'); d.blinkUntil = 0; d.blinkAt = now + 1600 + Math.random() * 2000; }
}
let _v, _w, _toCam, _up; // made once three.js has loaded
function updatePips() {
  if (!_v) { _v = new THREE.Vector3(); _w = new THREE.Vector3(); _toCam = new THREE.Vector3(); _up = new THREE.Vector3(); }
  const now = performance.now();
  for (const d of objects.data) {
    if (d.gone) {
      // sad, then sinking: no more blinking or looking around
      if (now - goodbyeAt > d.gone.delay) { d.gone.v += 0.012; d.face.position.y -= d.gone.v; }
      d.face.getWorldPosition(_v); _toCam.copy(camera.position).sub(_v).normalize().multiplyScalar(0.06);
      d.eyes.position.copy(group.worldToLocal(_v.add(_toCam)));
      continue;
    }
    if (d.startled && now > startledUntil) { d.startled = false; d.face.material = faceMat(d.mood); d.eyes.material = eyesMat(eyesOf(d.mood)); }
    if (!d.startled) {
      if (d.blinkUntil && now > d.blinkUntil) { d.blinkUntil = 0; d.eyes.material = eyesMat(eyesOf(d.mood)); }
      if (!d.blinkUntil && now > d.blinkAt) {
        d.blinkUntil = now + 130; d.blinkAt = now + 2400 + Math.random() * 4800;
        if (Math.random() < 0.12) d.blinkAt = now + 260; // sometimes a double blink
        d.eyes.material = eyesMat('shut');
      }
      if (now > d.moodAt && !d.blinkUntil) {
        d.mood = PIP_MOODS[Math.floor(Math.random() * PIP_MOODS.length)];
        d.moodAt = now + 5000 + Math.random() * 15000;
        d.face.material = faceMat(d.mood); d.eyes.material = eyesMat(eyesOf(d.mood));
      }
    }
    // the eyes look towards the mouse: work out where the head is on screen
    d.face.getWorldPosition(_v);
    _w.copy(_v).project(camera);
    const dx = mouse.x - _w.x, dy = -mouse.y - _w.y, len = Math.hypot(dx, dy) || 1, k = Math.min(1, len * 3);
    d.look.x += ((dx / len) * k - d.look.x) * 0.15;
    d.look.y += ((dy / len) * k - d.look.y) * 0.15;
    // in the group's own space: a small step towards the camera (so the eyes sit on the face) and towards the mouse
    _toCam.copy(camera.position).sub(_v).normalize().multiplyScalar(0.06);
    const right = _w.set(1, 0, 0).applyQuaternion(camera.quaternion), up = _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const reach = d.size * 0.045;
    _v.add(_toCam).addScaledVector(right, d.look.x * reach).addScaledVector(up, d.look.y * reach);
    d.eyes.position.copy(group.worldToLocal(_v));
  }
}

function disposeObjects() {
  if (!objects) return;
  const o = objects.obj;
  group.remove(o);
  if (objects.kind === 'pips') { objects = null; return; } // the heads share cached textures, kept for next time
  try { o.geometry && o.geometry.dispose(); } catch (e) {}
  try { if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } } catch (e) {}
  objects = null;
}

function build() {
  disposeObjects();
  const shape = opts.shape;
  let count = AMOUNTS[opts.amount] || AMOUNTS.some;
  const col = floatieColor();

  if (shape === 'cubes') {
    count = Math.round(count / 6);
    const geo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.1, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const data = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const d = {
        p: new THREE.Vector3((Math.random() - 0.5) * 380, (Math.random() - 0.5) * 200, -130 + Math.random() * 150),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
        s: 0.5 + Math.random() * 1.3,
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.03)
      };
      data.push(d);
      m.compose(d.p, new THREE.Quaternion().setFromEuler(d.r), new THREE.Vector3(d.s, d.s, d.s));
      mesh.setMatrixAt(i, m);
    }
    group.add(mesh);
    objects = { kind: 'cubes', obj: mesh, data };
    return;
  }

  if (shape === 'pips') { objects = buildPips(Math.round(count / 13)); group.add(objects.obj); return; }
  if (shape === 'dolphins') count = Math.round(count / 4); // they're big, so fewer of them
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 400;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    seeds[i] = Math.random() * 100;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  let mat;
  if (shape === 'dolphins') {
    // points are square sprites, so draw the (wide) logo into a square canvas without stretching it
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      const s = Math.min(128 / img.width, 128 / img.height);
      const w = img.width * s, h = img.height * s;
      c.getContext('2d').drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
      tex.needsUpdate = true;
    };
    img.src = '/images/dolphin1.png';
    mat = new THREE.PointsMaterial({ size: 15, map: tex, transparent: true, alphaTest: 0.2, color: 0xffffff, depthWrite: false });
  } else if (shape === 'bubbles') {
    mat = new THREE.PointsMaterial({ size: 7, map: makeTexture('bubble'), transparent: true, depthWrite: false, color: col, opacity: 0.85 });
  } else if (shape === 'snow') {
    mat = new THREE.PointsMaterial({ size: 5, map: makeTexture('flake'), transparent: true, depthWrite: false, color: col, opacity: 0.9 });
  } else {
    mat = new THREE.PointsMaterial({ size: 3, map: makeTexture('dot'), transparent: true, depthWrite: false, color: col, opacity: 0.9 });
  }
  const pts = new THREE.Points(geometry, mat);
  group.add(pts);
  objects = { kind: shape, obj: pts, data: seeds };
}

function recolor() {
  if (!objects) return;
  const mat = objects.obj.material;
  if (objects.kind === 'dolphins' || objects.kind === 'pips') return; // dolphins and Pips keep their own colours
  mat.color = floatieColor();
  mat.needsUpdate = true;
}

function updateRendererBackground() {
  if (!renderer) return;
  try {
    const rootStyle = window.getComputedStyle(document.documentElement);
    const pageBg = (rootStyle.getPropertyValue('--page-bg') || '').trim();
    let hex = null;
    if (pageBg && !pageBg.toLowerCase().startsWith('url(')) hex = parseColor(pageBg);
    if (hex === null) {
      renderer.setClearColor(0x000000, 0);
      scene.background = null;
    } else {
      renderer.setClearColor(hex, 1);
      scene.background = new THREE.Color(hex);
    }
    const changed = hex !== bgHex;
    bgHex = hex;
    if (changed && opts.color === 'auto') recolor();
  } catch (e) {}
}

let bgObserver = null;
function onMouse(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
}
function onTilt(e) {
  if (e.gamma == null) return;
  mouse.x = Math.max(-1, Math.min(1, e.gamma / 30));
  mouse.y = Math.max(-1, Math.min(1, (e.beta - 40) / 30));
}
function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

let t = 0;
function animate() {
  if (_paused || !renderer) return;
  const sp = Math.max(0.1, +opts.speed || 1);
  const boost = 1 + whoosh * 14;
  whoosh *= 0.96;
  t += 0.002 * sp * boost;

  group.rotation.y = t * 0.6;
  group.rotation.x = Math.sin(t * 0.4) * 0.2;

  if (objects && objects.kind === 'pips') updatePips();
  if (objects && (objects.kind === 'bubbles' || objects.kind === 'snow')) {
    // bubbles rise and snow falls, both drift a little sideways
    const pos = objects.obj.geometry.attributes.position;
    const a = pos.array, seeds = objects.data;
    const dir = objects.kind === 'bubbles' ? 1 : -1;
    for (let i = 0; i < seeds.length; i++) {
      a[i * 3 + 1] += dir * (0.08 + (seeds[i] % 1) * 0.12) * sp * boost;
      a[i * 3] += Math.sin(t * 20 + seeds[i]) * 0.04 * sp;
      if (a[i * 3 + 1] > 110) a[i * 3 + 1] = -110;
      if (a[i * 3 + 1] < -110) a[i * 3 + 1] = 110;
    }
    pos.needsUpdate = true;
    group.rotation.x = 0;
    group.rotation.y = t * 0.15;
  } else if (objects && objects.kind === 'cubes') {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    // cubes drift sideways instead of orbiting, so none of them swing up close to the camera
    group.rotation.y = Math.sin(t * 0.5) * 0.25;
    group.rotation.x = Math.sin(t * 0.3) * 0.1;
    objects.data.forEach((d, i) => {
      d.p.x += (0.05 + d.s * 0.04) * sp * boost;
      if (d.p.x > 200) d.p.x = -200;
      d.r.x += d.w.x * sp * boost; d.r.y += d.w.y * sp * boost; d.r.z += d.w.z * sp * boost;
      sc.set(d.s, d.s, d.s);
      m.compose(d.p, q.setFromEuler(d.r), sc);
      objects.obj.setMatrixAt(i, m);
    });
    objects.obj.instanceMatrix.needsUpdate = true;
  }

  // lean towards the mouse / phone tilt
  const tx = opts.follow ? mouse.x * 22 : 0;
  const ty = opts.follow ? -mouse.y * 14 : 0;
  camera.position.x += (tx - camera.position.x) * 0.05;
  camera.position.y += (ty - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  rafId = requestAnimationFrame(animate);
}

async function initThree() {
  try { if (window.__threeScene && typeof window.__threeScene.stop === 'function') window.__threeScene.stop(); } catch (e) {}
  THREE = await import(THREE_CDN);
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;
  try { canvas.style.background = 'transparent'; } catch (e) {}

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 80;
  group = new THREE.Group();
  scene.add(group);
  lights = [new THREE.AmbientLight(0xffffff, 1.1), new THREE.DirectionalLight(0xffffff, 1.6)];
  lights[1].position.set(40, 60, 80);
  lights.forEach(l => scene.add(l));

  opts = readSaved();
  updateRendererBackground();
  build();
  setTimeout(updateRendererBackground, 50);
  try {
    bgObserver = new MutationObserver(updateRendererBackground);
    bgObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    if (document.body) bgObserver.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('storage', updateRendererBackground);
  } catch (e) { bgObserver = null; }

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pointermove', onMouse, { passive: true });
  window.addEventListener('deviceorientation', onTilt, { passive: true });

  _paused = false;
  animate();

  window.__threeScene = {
    setOptions(o) {
      const prev = opts;
      opts = Object.assign({}, opts, o || {});
      if (!THREE || !group) return;
      if (opts.shape !== prev.shape || opts.amount !== prev.amount) build();
      else if (opts.color !== prev.color) recolor();
    },
    poke() { whoosh = 1; if (!goodbyeAt) startlePips(); },
    pipsGoodbye,
    pause() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      _paused = true;
    },
    resume() {
      if (!_paused) return;
      _paused = false;
      if (!rafId) rafId = requestAnimationFrame(animate);
    },
    stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      _paused = false;
      try {
        disposeObjects();
        if (renderer) { renderer.forceContextLoss && renderer.forceContextLoss(); renderer.dispose(); renderer = null; }
        scene = null;
        if (bgObserver) { bgObserver.disconnect(); bgObserver = null; }
        window.removeEventListener('storage', updateRendererBackground);
      } catch (e) { console.warn('Error while stopping three scene', e); }
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('pointermove', onMouse);
      window.removeEventListener('deviceorientation', onTilt);
      try { const c = document.getElementById('three-canvas'); if (c) c.style.background = 'transparent'; } catch (e) {}
    }
  };
}

export { initThree };
export default { initThree };
