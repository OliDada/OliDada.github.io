// Gas and ice giants. No terrain: a smooth sphere wrapped in a generated cloud
// map (turbulent bands, streaks and an optional storm), a haze at the limb and,
// for ringed giants, rings with gaps. The cloud map is sampled on the sphere,
// so it has no seam; the planet turns slowly.
//
// Alive, not painted (switch ?giants=0 for the still picture): belts and zones drift past
// each other in opposite jets, leaving any great storm whole; haze gathers at the limb; the
// rings cast their shadow on the clouds and the planet casts its own across the rings;
// lightning flickers in the storms of the night side and auroras ring the poles; and close
// to the cloud tops a thin higher deck drifts over the one below. All of it is drawn in the
// shader from the cloud map already made, so it costs no more memory and no extra passes.
// The low tier keeps the jets, the haze and the shadows and leaves out the rest.
import { makeNoise, fbm } from './terrain.mjs';
import { GIANTS } from './quality.mjs';

const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// RGBA cloud map, W × H, equirectangular; row 0 is the south pole.
// Rows from j0 to j1 are written into out, so a map can be filled in slices.
// rel: out holds only rows j0..j1 (the star map's world view paints a band at a time).
export function giantPixels(body, W, H, out = new Uint8Array(W * H * 4), j0 = 0, j1 = H, rel = false) {
  const noise = makeNoise(body.seed, 'clouds'), streaks = makeNoise(body.seed, 'streaks');
  const pal = body.palette.map(rgb), storm = rgb(body.rock), haze = rgb(body.atmosphere);
  const bands = body.bands, turb = body.turbulence, phase = (body.seed % 1000) / 159;
  for (let j = j0; j < j1; j++) {
    const lat = -Math.PI / 2 + (j + .5) / H * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i + .5) / W * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      // Turbulence bends the band edges; stronger at mid-latitudes, where the jets shear.
      const warp = turb * (.035 * fbm(noise, x * 2.2, y * 2.2, z * 2.2, 4) + .012 * noise(x * 9, y * 9, z * 9));
      const l = lat + warp * (.5 + cl);
      // Belts and zones: a base rhythm with each band's own brightness.
      let v = .5 + .3 * Math.sin(l * bands * 2 + phase) + .3 * noise(1.7, l * bands * 1.3, 4.1);
      // Fine streaks stretched along the bands.
      v += .08 * streaks(x * 1.4, y * 45, z * 1.4) + .05 * streaks(x * 4, y * 120, z * 4);
      if (body.physics.kind === 'ice') v = .5 + (v - .5) * .55; // ice giants are calmer, with softer bands
      v = Math.min(1, Math.max(0, v));
      const k = v * 2.999, a = Math.floor(k), t = k - a;
      let r = mix(pal[a][0], pal[a + 1][0], t), g = mix(pal[a][1], pal[a + 1][1], t), b = mix(pal[a][2], pal[a + 1][2], t);
      // Storm: an oval vortex with a bright rim and swirled core.
      if (body.storm) {
        let dl = lon - body.storm.lon; dl -= Math.round(dl / (Math.PI * 2)) * Math.PI * 2;
        const s = body.storm.size, d = Math.hypot(dl * cl / (s * 1.8), (lat - body.storm.lat) / s);
        if (d < 1.25) {
          const swirl = .5 + .5 * Math.sin(d * 14 - Math.atan2(lat - body.storm.lat, dl * cl) * 2);
          const core = (1 - smooth(.55, 1, d)) * (.75 + .25 * swirl), rim = smooth(.8, 1, d) * (1 - smooth(1, 1.25, d)) * .35;
          r = mix(r, storm[0], core) + rim * 60; g = mix(g, storm[1], core) + rim * 60; b = mix(b, storm[2], core) + rim * 60;
        }
      }
      // Polar haze softens the bands toward the poles.
      const p = smooth(1.05, 1.45, Math.abs(lat)) * .6;
      const o = ((rel ? j - j0 : j) * W + i) * 4;
      out[o] = Math.min(255, mix(r, haze[0] * .8, p)); out[o + 1] = Math.min(255, mix(g, haze[1] * .8, p)); out[o + 2] = Math.min(255, mix(b, haze[2] * .8, p)); out[o + 3] = 255;
    }
  }
  return out;
}

// Ring opacity and brightness across the ring (inner edge to outer edge), with gaps.
export function ringProfile(body, N) {
  const noise = makeNoise(body.seed, 'rings'), out = new Float32Array(N * 2);
  const gap = .45 + (body.seed % 97) / 97 * .25;
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    let a = .55 + .3 * noise(x * 6, 0, 0) + .25 * noise(x * 31, 2, 0) + .12 * noise(x * 90, 4, 0);
    a *= smooth(0, .06, x) * (1 - smooth(.9, 1, x)); // soft edges
    a *= smooth(.012, .03, Math.abs(x - gap)); // one clear main gap
    out[i * 2] = Math.min(1, Math.max(0, a)) * (body.physics.kind === 'ice' ? .5 : 1);
    out[i * 2 + 1] = .75 + .25 * noise(x * 14, 6, 0);
  }
  return out;
}

// The cloud map is ~9 m per texel, which looks soft up close. This adds fine
// streaks and eddies on the GPU from the point's position on the sphere, so
// detail stays sharp at any distance. It fades out far away, where the map
// alone is enough (and the noise would shimmer).
const NOISE_GLSL = `
float cHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1,0,0)), f.x), mix(cHash(i + vec3(0,1,0)), cHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0,0,1)), cHash(i + vec3(1,0,1)), f.x), mix(cHash(i + vec3(0,1,1)), cHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;
const AURORAS = ['#6dffb0', '#ff7ad9', '#7fb0ff'];
// live: { THREE, sun, time, ring: { tex, inner, outer } | null, fx } or null for the still picture.
function addCloudDetail(material, R, body, live = null) {
  const seed = (body.seed % 997) / 97;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailRadius = { value: R };
    shader.uniforms.detailSeed = { value: seed };
    if (live) {
      const T = live.THREE, gas = body.physics.kind === 'gas';
      Object.assign(shader.uniforms, {
        uSun: live.sun, uGTime: live.time, uRingTex: { value: live.ring?.tex ?? null },
        uRing: { value: new T.Vector3(live.ring?.inner ?? 0, live.ring?.outer ?? 1, live.ring ? 1 : 0) },
        uJet: { value: new T.Vector3(body.bands, (body.seed % 1000) / 159, 1 / (gas ? 900 : 2000)) },
        uStorm: { value: new T.Vector3(body.storm?.lat ?? 0, body.storm?.size ?? 0, body.storm ? 1 : 0) },
        uHaze: { value: new T.Color(body.atmosphere) }, uAurora: { value: new T.Color(AURORAS[body.seed % 3]) },
        uFx: { value: new T.Vector2(Math.min(1.5, Math.max(.3, body.turbulence ?? 1)) * (gas ? 1 : .4), 0) },
        // Its moons (world centre, radius; system-view.js fills them each frame): their shadows cross the clouds.
        uMoons: live.moons || { value: [0, 1, 2, 3].map(() => new T.Vector4()) },
      });
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloud;\nvarying float vCloudDist;\nvarying vec3 vGW; varying vec3 vGC; varying vec3 vGN; varying float vGS;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloud = normalize(position);')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCloudDist = -mvPosition.z;\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGC = modelMatrix[3].xyz; vGN = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vGS = length(modelMatrix[0].xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCloud;
varying float vCloudDist;
varying vec3 vGW; varying vec3 vGC; varying vec3 vGN; varying float vGS;
uniform float detailRadius;
uniform float detailSeed;
${live ? 'uniform vec3 uSun; uniform float uGTime; uniform sampler2D uRingTex; uniform vec3 uRing; uniform vec3 uJet; uniform vec3 uStorm; uniform vec3 uHaze; uniform vec3 uAurora; uniform vec2 uFx; uniform vec4 uMoons[4];' : ''}
${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `${live ? `
  // Belts and zones drift opposite ways; a great storm's own latitudes move as one.
  float glat = asin(clamp(vCloud.y, -1.0, 1.0));
  float jl = mix(glat, uStorm.x, uStorm.z * smoothstep(uStorm.y * 1.7, uStorm.y * 1.15, abs(glat - uStorm.x)));
  vec2 guv = vMapUv; guv.x += uGTime * uJet.z * clamp(sin(jl * uJet.x * 2.0 + uJet.y) * 2.5, -1.0, 1.0);
  diffuseColor *= texture2D(map, guv);
  vec3 gSun = normalize(uSun - vGC), gUp = normalize(vGW - vGC);
  float gNight = smoothstep(0.1, -0.25, dot(gUp, gSun));
  // Haze at the limb.
  diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2) * .6);
  // The rings' shadow on the clouds.
  if (uRing.z > 0.5) {
    vec3 gp = vGW - vGC; float dn = dot(gSun, vGN), gt = -dot(gp, vGN) / (abs(dn) < 1e-4 ? 1e-4 : dn);
    if (gt > 0.0) { float gu = (length(gp + gSun * gt) / vGS - uRing.x) / (uRing.y - uRing.x); if (gu > 0.0 && gu < 1.0) diffuseColor.rgb *= 1.0 - .72 * texture2D(uRingTex, vec2(gu, .5)).a; }
  }
  // Moons' shadows: a dark core in a soft edge that widens the further the moon is.
  for (int i = 0; i < 4; i++) {
    vec4 mo = uMoons[i]; if (mo.w <= 0.0) continue;
    vec3 mv = mo.xyz - vGW; float mt = dot(mv, gSun);
    if (mt > 0.0) { float md = length(mv - gSun * mt), pen = mo.w * .06 + mt * .006;
      diffuseColor.rgb *= 1.0 - .9 * (1.0 - smoothstep(mo.w - pen, mo.w + pen, md)); }
  }` : '#include <map_fragment>'}
{
  // Stretched along the bands (y is latitude): long thin streaks with eddies between.
  vec3 q = vCloud * detailRadius / 34.0 + vec3(detailSeed);
  float warp = cNoise(q * vec3(1.0, 3.0, 1.0)) * 1.6;
  float d = 0.0, amp = 0.5, total = 0.0;
  vec3 s = vec3(q.x + warp, q.y * 7.0, q.z + warp);
  for (int o = 0; o < 5; o++) { d += amp * cNoise(s); total += amp; amp *= 0.5; s *= vec3(2.1, 2.3, 2.1); }
  d = d / total - 0.5;
  float near = 1.0 - smoothstep(detailRadius * 0.6, detailRadius * 3.0, vCloudDist);
  diffuseColor.rgb *= 1.0 + d * 0.5 * near;
}`)
      // The scene's sky light is tuned for planet surfaces; on a giant it would
      // tint the clouds. Mostly starlight here, with a dim night side.
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.3;')
      .replace('#include <emissivemap_fragment>', live ? `
  #ifdef USE_EMISSIVEMAP
  totalEmissiveRadiance *= texture2D(emissiveMap, guv).rgb;
  #endif
  ${live.fx ? `{
    // Lightning in the storms of the night side, and auroras round the poles.
    vec3 lc = vCloud * 11.0, ci = floor(lc);
    float tt = uGTime * 1.3 + cHash(ci) * 50.0;
    float strike = step(1.0 - .006 * uFx.x, cHash(ci + floor(tt) * .37));
    float fl = strike * (1.0 - fract(tt)) * (.6 + .4 * sin(uGTime * 60.0 + cHash(ci) * 6.0));
    totalEmissiveRadiance += vec3(.75, .85, 1.0) * fl * (1.0 - smoothstep(0.0, .5, length(fract(lc) - .5))) * gNight * 1.6;
    float au = exp(-pow((abs(glat) - 1.2) / .05, 2.0)) * (.35 + .65 * cNoise(vec3(vCloud.x * 6.0, uGTime * .15, vCloud.z * 6.0)));
    totalEmissiveRadiance += uAurora * au * (.2 + .8 * gNight) * .7;
  }` : ''}` : '#include <emissivemap_fragment>');
  };
  material.customProgramCacheKey = () => 'giant-cloud-detail' + (live ? (live.fx ? '-live-fx' : '-live') : '');
}

// Up close, a ring is rocks and ice: boulders tumbling in a thin layer, as many as the ring is
// dense at that radius. Laid out in square cells round the camera (each cell's rocks come from
// its own seed, so they stay put as you fly among them) and grown in from nothing at the edge
// of the field, so nothing pops. Ring-local coordinates (the ring's plane is XZ).
const ROCK_THICK = 55;
// Two layers: near, every pebble and boulder in small cells; far, only the big ones in large
// cells, so the field is seen from well off (and thins out with distance) instead of
// springing up round you. Plus dust: fine specks drifting past, so you feel your speed.
// Each tier: cells round the camera, rocks per cell, sizes, and where the rocks shrink away (fade, metres).
// The dense small rocks reach about 3 km; the cells nearest you get the finer rock shape.
const TIERS = [{ cell: 520, reach: 5, fine: 2, per: 70, min: 1.5, max: 34, pow: 5, key: 0, fade: [2000, 2900] }, { cell: 2200, reach: 3, per: 26, min: 9, max: 60, pow: 3, key: 1, fade: [5000, 7200] }];
// Beyond the modelled rocks, out to where the ring meets the horizon, the same rocks as points of
// light a pixel or two across: once you are close enough to see rocks, the whole ring in view is rocks.
const FAR_CELL = 1500, FAR_REACH = 14, FAR_PER = 26, ACTIVE = 2600;
export function createRingRocks(THREE, body, inner, outer, rockMode = null) {
  const N = 256, profile = ringProfile(body, N);
  const lumpy = (detail) => { const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = .78 + .3 * Math.abs(Math.sin(x * 5.1 + y * 3.7) * Math.cos(z * 4.3 - x * 2.2)); p.setXYZ(i, x * k, y * k * .8, z * k); }
    g.computeVertexNormals(); return g; };
  const geoFine = lumpy(1), geoPlain = lumpy(0);
  const ice = new THREE.Color(body.crystal || '#bbbbbb').lerp(new THREE.Color('#9a958c'), .35), rock = new THREE.Color('#6b625a'), tint = new THREE.Color();
  // Rocks shrink away with distance on the GPU (so they are laid out only when you cross a cell).
  const rockMaterial = (fade) => { const mt = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .95, metalness: 0, flatShading: true });
    mt.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { vec3 rc = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float rs = length(modelMatrix[0].xyz);
    transformed *= 1.0 - smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, distance(rc, cameraPosition) / rs); }`); };
    mt.customProgramCacheKey = () => 'ring-rock-' + fade.join('-'); return mt; };
  const inst = (g, mt, cap) => { const im = new THREE.InstancedMesh(g, mt, cap); im.frustumCulled = false; im.count = 0; im.setColorAt(0, new THREE.Color()); return im; };
  const t0 = TIERS[0], t1 = TIERS[1], fineCap = (t0.fine * 2 + 1) ** 2 * t0.per;
  const fineMesh = inst(geoFine, rockMaterial(t0.fade), fineCap), midMesh = inst(geoPlain, rockMaterial(t0.fade), (t0.reach * 2 + 1) ** 2 * t0.per), farMesh = inst(geoPlain, rockMaterial(t1.fade), (t1.reach * 2 + 1) ** 2 * t1.per);
  const mesh = new THREE.Group(); mesh.add(fineMesh, midMesh, farMesh); mesh.visible = false;
  // Dust: specks in a box that wraps round the camera.
  const DUST = 420, BOX = 260, dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST * 3; i++) dseed[i] = Math.random() * BOX;
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: ice.clone().lerp(new THREE.Color('#ffffff'), .5), size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false; dust.visible = false;
  const group = new THREE.Group(); group.add(mesh, dust);
  const cache = new Map(), live = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const hash = (a, b, c) => { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
  const density = (r) => { const u = (r - inner) / (outer - inner); return u <= 0 || u >= 1 ? 0 : profile[Math.min(N - 1, Math.floor(u * N)) * 2]; };
  function rocksOf(t, cx, cz) {
    const key = t.key + ':' + cx + ',' + cz; let list = cache.get(key);
    if (list) return list;
    const r = hash(cx, cz, body.seed % 100000 + t.key * 7919); list = [];
    for (let i = 0; i < t.per; i++) {
      const x = (cx + r()) * t.cell, z = (cz + r()) * t.cell, keep = r(), size = t.min + (t.max - t.min) * r() ** t.pow, y = (r() + r() + r() - 1.5) * ROCK_THICK;
      if (keep > density(Math.hypot(x, z)) * 1.05) continue;
      list.push({ x, y, z, size, rx: r() * 6.3, ry: r() * 6.3, rz: r() * 6.3, sq: .7 + r() * .5, tone: r() });
    }
    if (cache.size > 3000) cache.clear();
    cache.set(key, list); return list;
  }
  // The far field: fixed points, rebuilt only when you cross into another far cell.
  const FAR_MAX = (FAR_REACH * 2 + 1) ** 2 * FAR_PER, fpos = new Float32Array(FAR_MAX * 3), fsize = new Float32Array(FAR_MAX), fcol = new Float32Array(FAR_MAX * 3);
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fgeo.setAttribute('aSize', new THREE.BufferAttribute(fsize, 1)); fgeo.setAttribute('aColor', new THREE.BufferAttribute(fcol, 3));
  const fmat = new THREE.ShaderMaterial({
    uniforms: { uHalfH: { value: 400 }, uNear: { value: new THREE.Vector2(TIERS[1].cell * 2.2, TIERS[1].cell * 3.2) }, uFar: { value: FAR_CELL * FAR_REACH * .8 } },
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize; attribute vec3 aColor; uniform float uHalfH; uniform vec2 uNear; uniform float uFar; varying vec3 vC; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z, len = length(mv.xyz);
  float px = aSize * 2.0 * projectionMatrix[1][1] * uHalfH / max(d, 1.0);
  gl_PointSize = clamp(px, 1.0, 3.0);
  vA = clamp(px * 1.5, 0.15, 1.0) * smoothstep(uNear.x, uNear.y, len) * (1.0 - smoothstep(uFar * .7, uFar, len));
  vC = aColor; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
varying vec3 vC; varying float vA;
void main() {
#include <logdepthbuf_fragment>
  if (vA < 0.01 || length(gl_PointCoord - 0.5) > 0.5) discard;
  gl_FragColor = vec4(vC, vA);
}`, transparent: true, depthWrite: false });
  const far = new THREE.Points(fgeo, fmat); far.frustumCulled = false; far.visible = false;
  const fsz = new THREE.Vector2();
  far.onBeforeRender = (r) => { r.getDrawingBufferSize(fsz); fmat.uniforms.uHalfH.value = fsz.y / 2; };
  const farTier = { cell: FAR_CELL, per: FAR_PER, min: 1.5, max: 40, pow: 4, key: 9 };
  let farAt = null;
  function updateFar(cam, on) {
    far.visible = on; if (!on) { farAt = null; return; }
    const cx = Math.floor(cam.x / FAR_CELL), cz = Math.floor(cam.z / FAR_CELL), key = cx + ',' + cz;
    if (key === farAt) return; farAt = key;
    let n = 0;
    for (let a = -FAR_REACH; a <= FAR_REACH; a++) for (let b = -FAR_REACH; b <= FAR_REACH; b++) for (const k of rocksOf(farTier, cx + a, cz + b)) {
      fpos[n * 3] = k.x; fpos[n * 3 + 1] = k.y; fpos[n * 3 + 2] = k.z; fsize[n] = k.size;
      tint.copy(ice).lerp(rock, k.tone < .22 ? .75 : k.tone * .25).multiplyScalar(.8 + .35 * ((k.tone * 7.3) % 1));
      fcol[n * 3] = tint.r; fcol[n * 3 + 1] = tint.g; fcol[n * 3 + 2] = tint.b; n++;
    }
    fgeo.setDrawRange(0, n);
    for (const name of ['position', 'aSize', 'aColor']) fgeo.attributes[name].needsUpdate = true;
  }
  // Lays the rocks out round the camera's cell (only when that changes).
  let builtAt = null;
  const put = (im, k, i) => {
    e.set(k.rx, k.ry, k.rz); q.setFromEuler(e); v.set(k.x, k.y, k.z); sc.set(k.size, k.size * k.sq, k.size);
    // Mostly ice in the ring's own colour, some darker rock among it, every piece a little different.
    tint.copy(ice).lerp(rock, k.tone < .22 ? .75 : k.tone * .25).multiplyScalar(.8 + .35 * ((k.tone * 7.3) % 1));
    m.compose(v, q, sc); im.setMatrixAt(i, m); im.setColorAt(i, tint);
  };
  function layout(cam) {
    const c0x = Math.floor(cam.x / t0.cell), c0z = Math.floor(cam.z / t0.cell), c1x = Math.floor(cam.x / t1.cell), c1z = Math.floor(cam.z / t1.cell), key = `${c0x},${c0z},${c1x},${c1z}`;
    if (key === builtAt) return; builtAt = key;
    let nf = 0, nm = 0, nr = 0; live.length = 0;
    for (let a = -t0.reach; a <= t0.reach; a++) for (let b = -t0.reach; b <= t0.reach; b++) {
      const fine = Math.abs(a) <= t0.fine && Math.abs(b) <= t0.fine;
      for (const k of rocksOf(t0, c0x + a, c0z + b)) {
        if (fine) put(fineMesh, k, nf++); else put(midMesh, k, nm++);
        if (Math.abs(a) <= 1 && Math.abs(b) <= 1 && k.size > 5) live.push(k);
      }
    }
    for (let a = -t1.reach; a <= t1.reach; a++) for (let b = -t1.reach; b <= t1.reach; b++) for (const k of rocksOf(t1, c1x + a, c1z + b)) {
      put(farMesh, k, nr++);
      if (Math.abs(a) <= 1 && Math.abs(b) <= 1 && k.size > 5) live.push(k);
    }
    for (const [im, n] of [[fineMesh, nf], [midMesh, nm], [farMesh, nr]]) { im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
  return {
    mesh: group,
    // cam: the camera in ring-local coordinates.
    update(cam) {
      const rr = Math.hypot(cam.x, cam.z);
      const near = Math.abs(cam.y) < ACTIVE && rr > inner - ACTIVE && rr < outer + ACTIVE;
      if (rockMode) rockMode.value += ((near ? 1 : 0) - rockMode.value) * .08;
      mesh.visible = near;
      if (near) layout(cam); else builtAt = null;
      // Dust only inside the ring itself, as thick as the ring is there.
      const inRing = density(rr) * (1 - Math.min(1, Math.abs(cam.y) / (ROCK_THICK * 6)));
      dust.visible = inRing > .02; dust.material.opacity = .7 * inRing;
      if (dust.visible) {
        for (let i = 0; i < DUST; i++) for (let c = 0; c < 3; c++) {
          const o = i * 3 + c, cc = c === 0 ? cam.x : c === 1 ? cam.y : cam.z;
          dpos[o] = cc + ((((dseed[o] - cc) % BOX) + BOX) % BOX) - BOX / 2;
        }
        dgeo.attributes.position.needsUpdate = true;
      }
    },
    // How deep in the ring a point (ring-local) is: 0 outside, up to 1 in its thickest part.
    depth(pt) { return density(Math.hypot(pt.x, pt.z)) * (1 - Math.min(1, Math.abs(pt.y) / (ROCK_THICK * 8))); },
    // A point (ring-local) inside a big rock: { push: a vector out of it } or null.
    hit(pt, radius) {
      for (const k of live) {
        const dx = pt.x - k.x, dy = (pt.y - k.y) / k.sq, dz = pt.z - k.z, d = Math.hypot(dx, dy, dz), lim = k.size * .85 + radius;
        if (d < lim && d > 1e-6) return { push: new THREE.Vector3(dx, dy * k.sq, dz).multiplyScalar((lim - d) / d), size: k.size };
      }
      return null;
    },
    dispose() { geoFine.dispose(); geoPlain.dispose(); for (const im of [fineMesh, midMesh, farMesh]) im.material.dispose(); dgeo.dispose(); dust.material.dispose(); fgeo.dispose(); fmat.dispose(); },
  };
}

// Banded rings with gaps, lying in the local XZ plane. Shared by gas giants and
// ringed rocky worlds, so every ring in the game looks and renders the same way.
// sun ({ value: the star's position in the world }) and planetR: the planet then casts its shadow across the ring.
export function createRing(THREE, body, inner, outer, { segments = 192, opacity = 1, sun = null, planetR = 0 } = {}) {
  const rockMode = { value: 0 }; // 0..1: drawn as rocks (createRingRocks sets it when you are near)
  const N = 512, profile = ringProfile(body, N), ringColor = rgb(body.crystal), data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) data[i * 4 + c] = ringColor[c] * profile[i * 2 + 1];
  for (let i = 0; i < N; i++) data[i * 4 + 3] = profile[i * 2] * 235 * opacity;
  const tex = new THREE.DataTexture(data, N, 1);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const geo = new THREE.RingGeometry(inner, outer, segments, 1);
  // Map u across the ring (inner to outer edge) instead of the default planar layout.
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), .5);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  if (sun && planetR && GIANTS) {
    mesh.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uSun: sun, uPlanetR: { value: planetR }, uRocks: rockMode });
      sh.vertexShader = 'varying vec3 vRW; varying vec3 vRC; varying float vRS; varying vec2 vRL;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRL = position.xy; vRW = (modelMatrix * vec4(transformed, 1.0)).xyz; vRC = modelMatrix[3].xyz; vRS = length(modelMatrix[0].xyz);');
      sh.fragmentShader = 'varying vec3 vRW; varying vec3 vRC; varying float vRS; varying vec2 vRL; uniform vec3 uSun; uniform float uPlanetR; uniform float uRocks;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  // Close to the ring its surface turns grainy, like rubble seen from afar: brightness and
  // thickness flicker from patch to patch at a few scales (no pattern, no flat dots), fading
  // into the smooth bands where the grain gets finer than a pixel.
  if (uRocks > 0.001) {
    float g = 0.0, wsum = 0.0;
    for (int o = 0; o < 3; o++) {
      float sc = o == 0 ? 9.0 : o == 1 ? 23.0 : 61.0;
      vec2 q = vRL / sc; float fw = max(fwidth(q.x), fwidth(q.y)), w = 1.0 - smoothstep(.35, 1.2, fw);
      vec2 ci = floor(q), cf = fract(q), u = cf * cf * (3.0 - 2.0 * cf);
      float a = fract(sin(dot(ci, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(ci + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
      float c = fract(sin(dot(ci + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(ci + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
      float nse = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      g += (nse - .5) * w; wsum += w;
    }
    float k = uRocks * clamp(wsum, 0.0, 1.0);
    diffuseColor.rgb *= 1.0 + .75 * g * k;
    diffuseColor.a *= clamp(1.0 + .9 * g * k, 0.0, 1.3);
  }
  diffuseColor.a *= smoothstep(600.0, 1600.0, distance(vRW, cameraPosition) / vRS); // among the modelled rocks the flat ring gives way to them
  { vec3 s = normalize(uSun - vRC), p = vRW - vRC; float along = dot(p, s), rr = uPlanetR * vRS;
    if (along < 0.0) diffuseColor.rgb *= 1.0 - .9 * (1.0 - smoothstep(rr * .96, rr * 1.03, length(p - s * along))); }`);
    };
    mesh.material.customProgramCacheKey = () => 'ring-shadow';
  }
  return { mesh, tex, rockMode, disposables: [tex, geo, mesh.material] };
}

export function createGiant(THREE, body, { coarse = false, gradual = false, sun = null, moons = null } = {}) {
  const R = body.radius, group = new THREE.Group(), tilted = new THREE.Group();
  tilted.rotation.z = body.tilt;
  group.add(tilted);
  const W = coarse ? 512 : 1024, H = W / 2;
  // Built gradually, the map fills a slice of rows per frame; `ready` resolves when done.
  const pixels = new Uint8Array(W * H * 4);
  let ready = null;
  if (!gradual) giantPixels(body, W, H, pixels);
  else ready = (async () => {
    const rows = coarse ? 12 : 24;
    for (let j = 0; j < H; j += rows) {
      giantPixels(body, W, H, pixels, j, Math.min(H, j + rows));
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    map.needsUpdate = true;
  })();
  const map = new THREE.DataTexture(pixels, W, H);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true;
  map.anisotropy = 4; map.needsUpdate = true;
  const hot = body.physics.clouds === 'silicate' || body.physics.clouds === 'alkali';
  const material = new THREE.MeshStandardMaterial({ map, roughness: .95, metalness: 0,
    ...(hot ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: body.physics.clouds === 'silicate' ? .45 : .15 } : {}) });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, coarse ? 128 : 192, coarse ? 80 : 128), material);
  tilted.add(sphere);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, coarse ? 96 : 160, coarse ? 64 : 96), new THREE.MeshBasicMaterial({
    color: body.atmosphere, transparent: true, opacity: .12, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  tilted.add(halo);
  const disposables = [map, material, sphere.geometry, halo.geometry, halo.material];
  const alive = GIANTS && !!sun, time = { value: 0 };
  let ringLive = null, deck = null, rocks = null;
  const rockCam = new THREE.Vector3(), untilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -body.tilt);
  if (body.ringed) {
    const inner = R * (body.physics.kind === 'ice' ? 1.45 : 1.3), outer = R * (body.physics.kind === 'ice' ? 1.95 : 2.25);
    const ring = createRing(THREE, body, inner, outer, { segments: coarse ? 128 : 192, sun: alive ? sun : null, planetR: R });
    tilted.add(ring.mesh);
    disposables.push(...ring.disposables);
    ringLive = { tex: ring.tex, inner, outer };
    if (alive && !coarse) { rocks = createRingRocks(THREE, body, inner, outer, ring.rockMode); ring.mesh.parent.add(rocks.mesh); disposables.push(rocks); }
  }
  addCloudDetail(material, R, body, alive ? { THREE, sun, time, ring: ringLive, fx: !coarse, moons } : null);
  if (alive && !coarse) {
    // A thin higher deck: torn sheets of cloud drifting over the one below, seen only from near.
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(body.atmosphere).lerp(new THREE.Color(0xffffff), .55), transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide }); // (seen from beneath too, by a ship in the clouds)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.detailRadius = { value: R }; sh.uniforms.detailSeed = { value: (body.seed % 613) / 61 };
      sh.vertexShader = 'varying vec3 vCloud; varying float vCloudDist;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloud = normalize(position);').replace('#include <project_vertex>', '#include <project_vertex>\nvCloudDist = -mvPosition.z;');
      sh.fragmentShader = 'varying vec3 vCloud; varying float vCloudDist; uniform float detailRadius; uniform float detailSeed;' + NOISE_GLSL + '\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec3 q = vCloud * detailRadius / 130.0 + detailSeed; q.y *= 4.0;
    float n = cNoise(q) * .55 + cNoise(q * 2.3) * .3 + cNoise(q * 5.1) * .15;
    diffuseColor.a *= smoothstep(.5, .78, n) * (1.0 - smoothstep(detailRadius * .2, detailRadius * 1.5, vCloudDist)) * .5; }`).replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.3;');
    };
    mat.customProgramCacheKey = () => 'giant-deck';
    deck = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 160, 96), mat);
    deck.renderOrder = 1;
    tilted.add(deck);
    disposables.push(deck.geometry, mat);
  }
  // A full turn takes a few minutes; big gas giants spin fastest.
  const spin = (Math.PI * 2) / (body.physics.kind === 'gas' ? 240 : 360);
  let last = performance.now();
  return {
    body, group, ready,
    // local: the camera relative to the giant (unscaled); the rocks need it in the ring's frame.
    // Bumping into the ring's rocks: point is in world space; returns a world-space push or null.
    bump(point, radius = 9) { if (!rocks?.mesh.visible) return null; const lp = rocks.mesh.worldToLocal(point.clone()), h = rocks.hit(lp, radius); if (!h) return null; const w = rocks.mesh.localToWorld(lp.clone().add(h.push)).sub(point); return { push: w, size: h.size }; },
    ringDepth(point) { return rocks?.mesh.visible ? rocks.depth(rocks.mesh.worldToLocal(point.clone())) : 0; },
    update(local) { if (rocks && local) rocks.update(rockCam.copy(local).applyQuaternion(untilt)); const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); sphere.rotation.y += spin * dt; if (deck) deck.rotation.y += spin * 1.2 * dt; time.value += dt; last = now; },
    dispose() { for (const d of disposables) d.dispose(); },
  };
}
