// Clouds: which worlds have them, what they are made of, how much of the sky they
// cover and how they drift. Pure data and maths, no rendering: cloud-mesh.js draws
// them (a shell around the world, and their shadows on the ground) and game.js
// asks cloudDensity() whether the camera is inside one.
//
// The cloud pattern is value noise on the direction from the world's centre. The
// same noise is written in JS (here) and GLSL (CLOUD_GLSL), with a hash that is
// exact in 32-bit floats, so the clouds you see are the clouds you fly through.
// Time is orbitClock() seconds, so everyone sees the same clouds at the same moment.
//
//   cloudsFor(body)               null (no air, or a giant) or the world's cloud layer
//   cloudAngles(c, t)             [a1, a2]: how far the big systems and the fine detail have drifted
//   cloudDensity(c, dir, angles)  0..1 cloud at a direction (a unit [x, y, z]) right now
import { rng } from './rng.mjs';
import { clamp } from './physics.mjs';
import { terrainFor } from './terrain.mjs';

export const OCTAVES = 5, OCTAVES_LITE = 3;
// The big systems (first BASE octaves) and the fine detail drift at different rates,
// so the clouds slowly change shape as well as move.
const BASE = 2, DETAIL_DRIFT = 1.35;
const SHIFT = [17.3, -9.1, 5.7]; // each octave is offset by i × SHIFT so octaves don't line up
// Gentle bands by latitude, as on Earth: cloudier at the equator and around 60°, clearer between.
const BAND = 0.03;
const WARP = 0.35, STRETCH = 1.35;

// Kinds of cloud, by what the air holds.
export const CLOUD_KINDS = {
  water: { name: 'Water cloud', color: '#f4f7fb', opacity: 0.95 },
  ice: { name: 'Ice cloud', color: '#e8eefc', opacity: 0.72 },
  sulfur: { name: 'Sulfur cloud', color: '#e3cb7a', opacity: 0.97 },
  ash: { name: 'Ash cloud', color: '#86766a', opacity: 0.86 },
  haze: { name: 'Organic haze', color: '#d29a5f', opacity: 0.8 },
  dust: { name: 'Dust', color: '#dcc8a6', opacity: 0.55 },
};

// 0 below ~0.03 bar, about 0.6 at Earth's 1 bar, 1 for very thick air (as game.js's airOf).
export const airOf = (pressure) => clamp((Math.log10(Math.max(pressure ?? 0, 1e-4)) + 1.5) / 2.5, 0, 1);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

export function cloudsFor(body) {
  if (!body || body.giant) return null;
  const p = body.physics || {}, air = airOf(p.pressure);
  if (air < 0.05) return null; // too thin to hold cloud
  const r = rng(body.seed, 'clouds');
  let kind, cover;
  if (body.biome === 'Toxic') { kind = 'sulfur'; cover = 0.9; }
  else if (p.solvent === 'methane') { kind = 'haze'; cover = 0.62; }
  else if (body.biome === 'Volcanic') { kind = 'ash'; cover = 0.3 + 0.45 * (p.volcanism ?? 0.5); }
  else if (p.waterState === 'liquid') { kind = 'water'; cover = 0.28 + 0.42 * (p.waterCoverage ?? 0.5); }
  else if (p.waterState === 'ice' || p.solvent) { kind = 'ice'; cover = 0.2 + 0.35 * Math.min(1, p.waterCoverage ?? 0.3); }
  else { kind = 'dust'; cover = 0.14; }
  const k = CLOUD_KINDS[kind];
  // Thin air holds less, and wispier, cloud.
  cover = clamp((cover + r.range(-0.08, 0.08)) * (0.55 + 0.45 * Math.min(1, air / 0.6)), 0.06, 0.95);
  const opacity = k.opacity * (0.55 + 0.45 * Math.min(1, air / 0.5));
  // Lower on small worlds; on the new, taller land (terrain.mjs landTop) the deck sits above
  // most of the land, so you land and walk below it and only the high peaks rise into it.
  const R = body.radius, height = Math.round(Math.max(clamp(40 + 0.1 * R, 55, 130), body.landStyle === 'classic' ? 0 : Math.min(320, terrainFor(body).landTop + 50)));
  const c = {
    kind, name: k.name, cover: +cover.toFixed(3), opacity: +opacity.toFixed(3),
    color: mixHex(k.color, body.atmosphere || k.color, 0.12), // a touch of the sky's own colour
    height, // metres above sea level
    thickness: 18, // the layer you fly through, metres either side of height
    scale: (R + height) / r.range(80, 120), // cloud systems about a hundred metres across
    drift: ((1.5 + 3 * air) / (R + height)) * (r() < 0.5 ? -1 : 1), // radians a second: a few metres a second
    offset: [r.range(0, 40), r.range(0, 40), r.range(0, 40)],
  };
  Object.assign(c, calibrate(c));
  return c;
}

// --- Noise (keep in step with CLOUD_GLSL) ---
const INV = 1 / 289;
const mod289 = (x) => x - Math.floor(x * INV) * 289;
const permute = (x) => mod289((x * 34 + 1) * x); // exact in float32: every value stays below 2^24
const hash = (x, y, z) => permute(permute(permute(mod289(x)) + mod289(y)) + mod289(z)) * INV;
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  return lerp(
    lerp(lerp(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), lerp(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
    lerp(lerp(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), lerp(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
// Fewer octaves (phones) keep the same average: the missing detail counts as its mean.
// The detail is swirled around the big systems (turned by how cloudy the big
// systems are there) and everything is stretched east-west, like weather on a
// spinning world.
export function cloudValue(c, dir, angles, octaves = OCTAVES, storms = null) {
  const [x, y, z] = dir, [a1, a2] = angles;
  let sum = 0, amp = 0.5, total = 0, base = 0, baseTotal = 0, a = a1;
  for (let i = 0; i < OCTAVES; i++) {
    if (i === BASE) a = a2 + WARP * (base / baseTotal - 0.5);
    total += amp;
    if (i < octaves) {
      const cs = Math.cos(a), sn = Math.sin(a), f = c.scale * 2 ** i;
      const n = amp * noise((x * cs - z * sn) * f + c.offset[0] + i * SHIFT[0], y * f * STRETCH + c.offset[1] + i * SHIFT[1], (x * sn + z * cs) * f + c.offset[2] + i * SHIFT[2]);
      sum += n;
      if (i < BASE) { base += n; baseTotal += amp; }
    } else sum += amp * 0.5;
    amp *= 0.5;
  }
  let v = sum / total + BAND * Math.cos(6 * Math.asin(clamp(y, -1, 1)));
  if (storms) v = stormBoost(c, v, dir, a1, storms);
  return v;
}
// Storms (weather.mjs) heap cloud up into thick, dark masses. Each storm sits in the
// frame of the big systems, so it drifts with them: { dir: [x, y, z], cos (cosine of
// its angular radius), k (0..1 strength) }. At most MAX_STORMS.
export const MAX_STORMS = 3, STORM_TOP = 3.8; // a storm's heart: at least this many c.soft above the threshold
export const stormFrame = (dir, a1) => { const cs = Math.cos(a1), sn = Math.sin(a1); return [dir[0] * cs - dir[2] * sn, dir[1], dir[0] * sn + dir[2] * cs]; };
export function stormReach(dir, s, wide = 1) {
  const cosR = 1 - (1 - s.cos) * wide, inner = cosR + (1 - cosR) * 0.6;
  return smooth(cosR, inner, dir[0] * s.dir[0] + dir[1] * s.dir[1] + dir[2] * s.dir[2]);
}
function stormBoost(c, v, dir, a1, storms) {
  const q = stormFrame(dir, a1), top = c.threshold + STORM_TOP * c.soft;
  for (const s of storms) v += (Math.max(v, top) - v) * s.k * stormReach(q, s);
  return v;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function cloudDensity(c, dir, angles, octaves = OCTAVES, storms = null) {
  return smooth(c.threshold, c.threshold + c.soft, cloudValue(c, dir, angles, octaves, storms));
}
export function cloudAngles(c, t) {
  const turn = Math.PI * 2;
  return [(c.drift * t) % turn, (c.drift * DETAIL_DRIFT * t + 0.37) % turn];
}

// The noise threshold that leaves `cover` of the sky clouded: sampled over the sphere.
function calibrate(c, n = 1200) {
  const values = [], golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, s = Math.sqrt(1 - y * y), a = i * golden;
    values.push(cloudValue(c, [Math.cos(a) * s, y, Math.sin(a) * s], [0, 0.37]));
  }
  values.sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const soft = 1.15 * sd;
  // A pixel counts as half cloud at threshold + soft / 2: put that at the cover quantile.
  const at = values[Math.min(n - 1, Math.floor((1 - c.cover) * n))];
  return { threshold: +(at - soft / 2).toFixed(5), soft: +soft.toFixed(5) };
}

// The same noise for shaders. Needs uniforms uCloudRot (cos a1, sin a1, cos a2, sin a2),
// uCloudScale, uCloudOffset, uCloudThreshold, uCloudSoft, and CLOUD_OCT defined.
const WARP_GLSL = WARP.toFixed(2), STRETCH_GLSL = STRETCH.toFixed(2);
export const CLOUD_GLSL = /* glsl */ `
uniform vec4 uCloudRot; uniform float uCloudScale, uCloudThreshold, uCloudSoft; uniform vec3 uCloudOffset;
uniform vec4 uStorm[${MAX_STORMS}]; uniform vec3 uStormK; // storms: direction and cosine of radius; strengths
float cMod(float x) { return x - floor(x * ${INV.toFixed(10)}) * 289.0; }
float cPerm(float x) { return cMod((x * 34.0 + 1.0) * x); }
float cHash(vec3 i) { return cPerm(cPerm(cPerm(cMod(i.x)) + cMod(i.y)) + cMod(i.z)) * ${INV.toFixed(10)}; }
float cNoise(vec3 x) {
  vec3 i = floor(x), f = x - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash(i), cHash(i + vec3(1, 0, 0)), f.x), mix(cHash(i + vec3(0, 1, 0)), cHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cHash(i + vec3(0, 0, 1)), cHash(i + vec3(1, 0, 1)), f.x), mix(cHash(i + vec3(0, 1, 1)), cHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float cloudValue(vec3 d) {
  float sum = 0.0, amp = 0.5, total = 0.0, f = uCloudScale, base = 0.0, baseTotal = 0.0;
  vec2 r = uCloudRot.xy;
  for (int i = 0; i < ${OCTAVES}; i++) {
    if (i == ${BASE}) { float a = atan(uCloudRot.w, uCloudRot.z) + ${WARP_GLSL} * (base / baseTotal - 0.5); r = vec2(cos(a), sin(a)); }
    total += amp;
    if (i < CLOUD_OCT) {
      vec3 q = vec3(d.x * r.x - d.z * r.y, d.y * ${STRETCH_GLSL}, d.x * r.y + d.z * r.x);
      float n = amp * cNoise(q * f + uCloudOffset + float(i) * vec3(${SHIFT.map((v) => v.toFixed(1)).join(', ')}));
      sum += n;
      if (i < ${BASE}) { base += n; baseTotal += amp; }
    } else sum += amp * 0.5;
    amp *= 0.5; f *= 2.0;
  }
  float v = sum / total + ${BAND.toFixed(3)} * cos(6.0 * asin(clamp(d.y, -1.0, 1.0)));
  vec3 sq = vec3(d.x * uCloudRot.x - d.z * uCloudRot.y, d.y, d.x * uCloudRot.y + d.z * uCloudRot.x);
  for (int i = 0; i < ${MAX_STORMS}; i++) {
    float cosR = uStorm[i].w;
    v = mix(v, max(v, uCloudThreshold + ${STORM_TOP.toFixed(1)} * uCloudSoft), uStormK[i] * smoothstep(cosR, cosR + (1.0 - cosR) * 0.6, dot(sq, uStorm[i].xyz)));
  }
  return v;
}
float cloudDensity(vec3 d) { return smoothstep(uCloudThreshold, uCloudThreshold + uCloudSoft, cloudValue(d)); }
`;
