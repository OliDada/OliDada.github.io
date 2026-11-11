// Planet surfaces. Seeded 3D simplex noise sampled on the unit sphere, shaped
// per biome (continents, ridges, dunes, craters, volcanoes). Sea level is set
// so the right share of the surface lies below it. Colour is decided per point
// from altitude, latitude, local temperature and moisture: beaches, vegetation,
// snow caps and lava shores all come from the world's physics.
import { rng } from './rng.mjs';
import { vegetationShift } from './biomes.mjs';
import { floraFor } from './flora.mjs';
import { urbanOf } from './urban.mjs';
import { civilizationOf } from './civilizations.mjs';
import { networkFor } from './settlements.mjs';

// --- Simplex noise (Stefan Gustavson's public-domain algorithm) ---
const GRAD = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
const F3 = 1 / 3, G3 = 1 / 6;
export function makeNoise(...seed) {
  const r = rng(...seed, 'noise'), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512), mod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; mod12[i] = perm[i] % 12; }
  return function noise(x, y, z) {
    const s = (x + y + z) * F3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3, x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
    else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + .5, y3 = y0 - 1 + .5, z3 = z0 - 1 + .5;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = .6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { g = mod12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0 + GRAD[g + 2] * z0); }
    tt = .6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { g = mod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1 + GRAD[g + 2] * z1); }
    tt = .6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { g = mod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2 + GRAD[g + 2] * z2); }
    tt = .6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { g = mod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x3 + GRAD[g + 1] * y3 + GRAD[g + 2] * z3); }
    return 32 * n; // roughly -1..1
  };
}
// Fractal sum: large shapes plus progressively finer detail.
export function fbm(noise, x, y, z, octaves, lacunarity = 2.03, gain = .5) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise(x, y, z); norm += amp; amp *= gain; x *= lacunarity; y *= lacunarity; z *= lacunarity; }
  return sum / norm;
}
// Ridged noise: sharp crests, the shape of mountain ranges. 0..1
export function ridged(noise, x, y, z, octaves, sharpness = 2) {
  let sum = 0, amp = 1, norm = 0, weight = 1;
  for (let o = 0; o < octaves; o++) {
    let v = 1 - Math.abs(noise(x, y, z)); v = v ** sharpness * weight;
    weight = Math.min(1, v * 1.6);
    sum += v * amp; norm += amp; amp *= .5; x *= 2.07; y *= 2.07; z *= 2.07;
  }
  return sum / norm;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const shiftHue = ([r, g, b], degrees, light = 0) => {
  // Rotate hue in RGB space (cheap, good enough for tinting).
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = (1 - c) / 3, q = Math.sqrt(1 / 3) * s;
  const m = [c + k, k - q, k + q, k + q, c + k, k - q, k - q, k + q, c + k];
  return [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b].map(v => Math.min(1, Math.max(0, v + light)));
};
// Evenly spread points on a sphere, for statistics.
function fibonacciSphere(count) {
  const pts = [], golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) { const y = 1 - (i + .5) / count * 2, r = Math.sqrt(1 - y * y), a = i * golden; pts.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r }); }
  return pts;
}

// Per-biome shape recipes: how much of each ingredient a world gets.
const SHAPES = {
  Verdant:  { continents: 1,   mountains: .8,  detail: .12 },
  Oceanic:  { continents: 1.1, mountains: .7,  detail: .1 },
  Desert:   { continents: .6,  mountains: .7,  detail: .1, dunes: .16 },
  Frozen:   { continents: .7,  mountains: .55, detail: .07, cracks: .1 },
  Volcanic: { continents: .7,  mountains: 1,   detail: .14, volcanoes: 5 },
  Toxic:    { continents: .6,  mountains: .6,  detail: .1, volcanoes: 2 },
  Amethyst: { continents: .6,  mountains: 1.1, detail: .1, sharp: 3 },
  Barren:   { continents: .45, mountains: .5,  detail: .1, craters: 46 },
};

// Landforms (the 'new' land style, style.mjs): what each biome's country is built from,
// on top of the shapes above. All heights in metres for an Earth-sized world, scaled with
// the world's radius. shelf: continents rising from the sea over a shelf, so land comes in
// a few big connected masses rather than scattered specks; hills: rolling country;
// ranges: mountain chains along belts, highest far inland; rivers: winding valleys whose
// floors reach the sea in the lowlands (dry gullies and canyons where there is no sea);
// mesas: flat-topped tablelands with cliff edges; isles: island chains off the coasts.
// Each world then varies these by its own roll (stream 'landform'), so some worlds are
// gentle plains and others alpine.
const LANDFORMS = {
  Verdant:  { shelf: 1,   hills: 1,   ranges: 1,   rivers: 1,   mesas: 0,   isles: .5 },
  Oceanic:  { shelf: 1.1, hills: .9,  ranges: .8,  rivers: .8,  mesas: 0,   isles: 1 },
  Desert:   { shelf: .6,  hills: .5,  ranges: .8,  rivers: .7,  mesas: 1,   isles: 0 },
  Frozen:   { shelf: .8,  hills: .6,  ranges: 1.25, rivers: .5, mesas: 0,   isles: .4 },
  Volcanic: { shelf: .7,  hills: .7,  ranges: .9,  rivers: .3,  mesas: .35, isles: .3 },
  Toxic:    { shelf: .6,  hills: .8,  ranges: .6,  rivers: .6,  mesas: .6,  isles: .2 },
  Amethyst: { shelf: .6,  hills: .6,  ranges: 1.3, rivers: .3,  mesas: .4,  isles: 0 },
  Barren:   { shelf: .4,  hills: .45, ranges: .6,  rivers: 0,   mesas: .25, isles: 0 },
};

// The largest amplitude (metres) a layer of noise with wavelength lam (metres) may
// have: no steeper than about 30 degrees on its own, so the ground never turns into
// needles and walking stays smooth. Measured from the noise's actual gradients.
// Large features (hills, mountains: scale over ~100 m) may be up to four times as
// steep, so big relief stays dramatic; only small-scale roughness is held back.
const capWith = (bigK) => (amplitude, lam) => {
  const t = Math.min(1, Math.max(0, (lam - 15) / 105)), big = t * t * (3 - 2 * t);
  return Math.sign(amplitude) * Math.min(Math.abs(amplitude), .064 * lam * (1 + bigK * big));
};
const capClassic = capWith(3);
// The new land style holds big features to half that steepness: its ranges are far taller,
// and at four times they made faces of 60-80 degrees, which a height grid draws as
// stretched, striped walls.
const capLand = capWith(.7); // (1.2 before: lone hills stood up as steep cones; ranges keep their height from their breadth)

// Which kind of small-scale ground each biome gets (others are unchanged for now).
const GROUND = { Verdant: 'soft', Oceanic: 'soft', Barren: 'rocky', Amethyst: 'rocky', Volcanic: 'volcanic', Desert: 'sand', Frozen: 'ice', Toxic: 'toxic' };
// Small integer hash -> 0..1, for features placed on a grid (metre-scale craters).
function hash01(a, b, c, k) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const cache = new WeakMap();
export function terrainFor(body) {
  let t = cache.get(body);
  if (!t) { t = buildTerrain(body); cache.set(body, t); }
  return t;
}

function buildTerrain(body) {
  const ph = body.physics || { temperature: 280, pressure: 1, volatiles: .5, waterState: 'none', waterCoverage: 0, life: 'none', volcanism: .3 };
  const shape = { ...(SHAPES[body.biome] || SHAPES.Verdant) };
  if (ph.pressure < .01 && !shape.craters) shape.craters = 24; // airless worlds keep their impact scars
  const r = rng(body.seed, 'terrain');
  const nA = makeNoise(body.seed, 'a'), nB = makeNoise(body.seed, 'b'), nC = makeNoise(body.seed, 'c'), nD = makeNoise(body.seed, 'd');
  const RM = body.radius || 180; // metres, for detail measured in metres rather than fractions of the world
  const ground = GROUND[body.biome] || null, airless = ph.pressure < .01;
  // Bigger worlds get taller relief (but not proportionally, or they would look spiky).
  const amp = 9 * Math.min(body.relief || 1, 2) * Math.min(1.8, Math.max(1, Math.sqrt((body.radius || 180) / 180)));
  const off = [r() * 100, r() * 100, r() * 100];
  const duneDir = [r() - .5, r() - .5, r() - .5];
  const windLen = Math.hypot(...duneDir) || 1, windDir = duneDir.map(v => v / windLen);
  const craters = [], volcanoes = [];
  const randomUnit = () => { const y = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - y * y); return [Math.cos(a) * s, y, Math.sin(a) * s]; };
  for (let i = 0; i < (shape.craters || 0); i++) craters.push({ c: randomUnit(), r: .025 + .22 * r() ** 3, depth: .4 + r() * .6 });
  for (let i = 0; i < (shape.volcanoes || 0); i++) volcanoes.push({ c: randomUnit(), r: .1 + r() * .14, height: 1 + r() * .9 });
  // Frozen worlds (their own random stream, so nothing else moves). Lineae: long cracks
  // that run right across icy moons and small frozen worlds, a trough between two low
  // ridges, like Europa's; each a great circle broken into long arcs, wavering slightly.
  const FROZEN = body.biome === 'Frozen', fr = rng(body.seed, 'frozen'), lineae = [];
  let seaLevel = null;
  // Toxic worlds (own stream): mineral springs, terraced mounds of crust round a hot pool,
  // ringed in bright colours; and acid pools scattered over the lowlands (one cell in three
  // of a 220 m grid holds one, placed well inside its cell).
  const TOXIC = body.biome === 'Toxic' && body.landStyle !== 'classic', tr = rng(body.seed, 'toxic'), springs = [];
  if (TOXIC) for (let k = tr.int(40, 70); k > 0; k--) { const y = tr() * 2 - 1, a = tr() * Math.PI * 2, q = Math.sqrt(1 - y * y); springs.push({ c: [Math.cos(a) * q, y, Math.sin(a) * q], rM: tr.range(55, 150), H: tr.range(5, 12), step: tr.range(.9, 1.6) }); }
  const POOL = 220;
  const WETLAND = body.variant === 'wetland';
  // Amethyst worlds (own stream): geodes, basins whose walls are lined with crystal, and
  // shattered crystal fields where the ground is broken into facets.
  // (Carbon worlds get the same, in diamond: their crystal colour.)
  const AMETHYST = (body.biome === 'Amethyst' || body.variant === 'carbon') && body.landStyle !== 'classic', ar = rng(body.seed, 'amethyst'), geodes = [];
  if (AMETHYST) for (let k = ar.int(25, 45); k > 0; k--) { const y = ar() * 2 - 1, a = ar() * Math.PI * 2, q = Math.sqrt(1 - y * y); geodes.push({ c: [Math.cos(a) * q, y, Math.sin(a) * q], rM: ar.range(60, 170), depth: ar.range(.1, .16) }); }
  const FACET = 34;
  // Oceanic worlds (own stream): atolls, rings of reef round a shallow lagoon, scattered over
  // the open sea; and island arcs, chains of small volcanic islands strung along curves.
  const OCEANIC = body.biome === 'Oceanic' && body.landStyle !== 'classic', or = rng(body.seed, 'oceanic'), atolls = [], isles = [];
  if (OCEANIC) {
    const unitAt = () => { const y = or() * 2 - 1, a = or() * Math.PI * 2, q = Math.sqrt(1 - y * y); return [Math.cos(a) * q, y, Math.sin(a) * q]; };
    for (let k = or.int(25, 45); k > 0; k--) atolls.push({ c: unitAt(), rM: or.range(70, 190), w: or.range(.12, .22), seed: or() * 30 });
    for (let a = or.int(2, 4); a > 0; a--) { // an arc: points along a small circle round a pole
      const pole = unitAt(), ang0 = or() * Math.PI * 2, span = or.range(.4, 1), rad = or.range(.25, .6), count = or.int(6, 12);
      const h0 = Math.abs(pole[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      let e = [pole[1] * h0[2] - pole[2] * h0[1], pole[2] * h0[0] - pole[0] * h0[2], pole[0] * h0[1] - pole[1] * h0[0]]; const el = Math.hypot(...e); e = e.map((v) => v / el);
      const f = [pole[1] * e[2] - pole[2] * e[1], pole[2] * e[0] - pole[0] * e[2], pole[0] * e[1] - pole[1] * e[0]];
      for (let i = 0; i < count; i++) {
        const t = ang0 + span * (i / (count - 1) + (or() - .5) * .08), q = [0, 1, 2].map((k) => pole[k] * Math.cos(rad) + (e[k] * Math.cos(t) + f[k] * Math.sin(t)) * Math.sin(rad)), l = Math.hypot(...q);
        isles.push({ c: q.map((v) => v / l), rM: or.range(50, 140), H: or.range(8, 30) });
      }
    }
  }
  // Barren worlds (own stream): craters of every age, old ones worn soft and partly filled,
  // young ones crisp with bright rays thrown across the land; scarps, long cliffs where the
  // crust shrank; and dark plains of old lava (maria) in the lowest basins.
  const BARREN = body.biome === 'Barren' && body.landStyle !== 'classic', br = rng(body.seed, 'barren'), scarps = [];
  if (BARREN) {
    for (const k of craters) { k.age = br(); k.rays = k.age < .18; k.seed = br() * 60; }
    for (let i = br.int(3, 6); i > 0; i--) { const y = br() * 2 - 1, a = br() * Math.PI * 2, q = Math.sqrt(1 - y * y); scarps.push({ n: [Math.cos(a) * q, y, Math.sin(a) * q], off: br.range(-.4, .4), H: br.range(6, 16), seed: br() * 40 }); }
  }
  // Volcanic worlds (own stream): around each volcano a cluster of small cinder cones, and
  // lava flows that run down its flanks from the summit and from vents, each its own length.
  const VOLCANIC = body.biome === 'Volcanic' && body.landStyle !== 'classic', vr = rng(body.seed, 'volcanic'), cones = [];
  if (VOLCANIC) for (const v of volcanoes) {
    v.flows = vr.range(5, 11); v.flowSeed = vr() * 40; v.caldera = vr.range(.14, .24);
    for (let k = vr.int(3, 7); k > 0; k--) {
      const a = vr() * Math.PI * 2, d = v.r * vr.range(.7, 1.7), c = v.c, h0 = Math.abs(c[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      let e = [c[1] * h0[2] - c[2] * h0[1], c[2] * h0[0] - c[0] * h0[2], c[0] * h0[1] - c[1] * h0[0]]; const el = Math.hypot(...e); e = e.map((q) => q / el);
      const f = [c[1] * e[2] - c[2] * e[1], c[2] * e[0] - c[0] * e[2], c[0] * e[1] - c[1] * e[0]];
      const q = [0, 1, 2].map((i) => c[i] + (e[i] * Math.cos(a) + f[i] * Math.sin(a)) * d), ql = Math.hypot(...q);
      cones.push({ c: q.map((x) => x / ql), rM: vr.range(35, 85), hgt: vr.range(.28, .42) });
    }
  }
  // Deserts: dune seas and salt flats. The wind blows one way across the whole world
  // (windDir); dunes are laid out along it and across it, from the world's own coordinates
  // (so the pattern is continuous everywhere), and fade out where that frame turns.
  const DESERT = body.biome === 'Desert', SALT = body.variant === 'salt';
  let saltLevel = null; // dry deserts: the lowest basins are salt flats (set once the land is sampled)
  const crossDir = (() => { const a = windDir, b = Math.abs(a[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...c); return c.map((v) => v / l); })();
  if (FROZEN) {
    const count = (body.radius || 180) < 1600 ? fr.int(7, 12) : fr.int(3, 6);
    for (let i = 0; i < count; i++) { const y = fr() * 2 - 1, a = fr() * Math.PI * 2, q = Math.sqrt(1 - y * y); lineae.push({ n: [Math.cos(a) * q, y, Math.sin(a) * q], w: fr.range(18, 45) * Math.min(1.4, Math.max(.7, RM / 900)), k: fr.range(.6, 1.2), seed: fr() * 50 }); }
  }
  // Spin axis. The signal site sits at a temperate latitude (not at a pole), so the
  // place you land shows the world's typical climate rather than its coldest corner.
  const sig = body.signal, other = randomUnit();
  let px = sig[1] * other[2] - sig[2] * other[1], py = sig[2] * other[0] - sig[0] * other[2], pz = sig[0] * other[1] - sig[1] * other[0];
  const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
  const siteLat = .05 + r() * .45, cosLat = Math.sqrt(1 - siteLat * siteLat);
  const axis = [sig[0] * siteLat + px * cosLat, sig[1] * siteLat + py * cosLat, sig[2] * siteLat + pz * cosLat];

  const LAND = body.landStyle !== 'classic';
  const cap = LAND ? capLand : capClassic;
  const FINE_S = .5; // the spacing walking and placing use (FINE, below)
  let liquid = null, coverage = 0;
  // Seas behave the same whatever they are made of; solvent only changes their colour.
  const solvent = ph.solvent || (ph.waterState === 'liquid' ? 'water' : null);
  if (ph.waterState === 'liquid') { liquid = 'water'; coverage = ph.waterCoverage; }
  else if (solvent === 'methane' || solvent === 'ammonia') { liquid = 'water'; coverage = ph.solventCoverage; }
  else if (body.biome === 'Volcanic' && ph.temperature > 230 && solvent !== 'sulfur') { liquid = 'lava'; coverage = .06 + ph.volcanism * .12; }
  else if (solvent === 'sulfur') { liquid = 'water'; coverage = ph.solventCoverage; }
  else if (ph.waterState === 'ice' && ph.waterCoverage > .3) { liquid = 'ice'; coverage = ph.waterCoverage * .55; }
  // New land style: even ocean worlds keep real continents to walk across. Seas beyond
  // three fifths of the surface are only partly drawn as sea (97% becomes 77%), and what
  // land there is gathers into a few big masses (the shelf, below).
  if (LAND && coverage > .6) coverage = .6 + (coverage - .6) * .45;

  // --- New landforms (see LANDFORMS). Everything here reads its own noise and random
  // stream, so the classic shapes underneath are unchanged.
  const lr = rng(body.seed, 'landform'), nE = makeNoise(body.seed, 'e'), nF = makeNoise(body.seed, 'f');
  const base0 = LANDFORMS[body.biome] || LANDFORMS.Verdant;
  // Relief in metres grows with the world (an Earth-sized world gets mountains a couple of
  // hundred metres high; small moons far less), and with the biome's own relief (weak gravity).
  const scaleR = Math.min(1.5, Math.max(.3, RM / 2300)), reliefK = Math.min(body.relief || 1, 1.8);
  const L = {
    shelf: base0.shelf, hills: base0.hills * lr.range(.55, 1.45), ranges: base0.ranges * (lr() < .18 ? lr.range(.15, .4) : lr.range(.7, 1.5)),
    rivers: base0.rivers > 0 && lr() < .92 ? Math.min(1, base0.rivers + .3) : 0, mesas: base0.mesas > 0 && lr() < .7 ? base0.mesas * lr.range(.7, 1.3) : 0,
    isles: base0.isles * lr.range(.4, 1.2), riverFreq: lr.range(1.6, 2.6), beltFreq: lr.range(1.1, 1.8), contFreq: lr.range(.42, .66),
  };
  if (airless) { L.rivers = 0; L.shelf *= .6; }
  if (body.variant === 'salt') L.rivers = 0; // a dried-out sea bed: no rivers cut it (their dry beds drew as thin white lines across the hills)
  // Small moons get gentle, rounded country: jagged ranges and cliffs looked like spikes on them.
  { const small = smooth(500, 1800, RM); L.ranges *= .25 + .75 * small; L.mesas *= .3 + .7 * small; L.hills *= .6 + .4 * small; }
  if (base0.mesas >= 1 && !L.mesas && !L.rivers) L.mesas = 1; // every desert has tablelands or canyons
  const landTarget = liquid ? coverage : .42; // dry worlds: lowland basins and highlands instead of sea and land
  // The continent field: low-frequency noise, warped so coasts wind, then levelled by its
  // own quantile so the share of land is known before the rest is added.
  const contAt = (x, y, z) => {
    const w = .32, f = L.contFreq;
    const wx = x + w * nE(x * 1.7 + 11, y * 1.7, z * 1.7), wy = y + w * nE(x * 1.7, y * 1.7 + 23, z * 1.7), wz = z + w * nE(x * 1.7, y * 1.7, z * 1.7 + 37);
    return fbm(nE, wx * f + 3, wy * f, wz * f, 4) + L.isles * .16 * Math.max(0, fbm(nF, x * 5.5, y * 5.5 + 9, z * 5.5, 2) - .3);
  };
  const SAMPLE_POINTS = fibonacciSphere(700);
  let contSea = 0;
  if (LAND) { const cs = SAMPLE_POINTS.map(p => contAt(p.x, p.y, p.z)).sort((a, b) => a - b); contSea = cs[Math.min(cs.length - 1, Math.floor(landTarget * cs.length))]; }
  let riverSea = null, riverRange = 1;
  // Small worlds don't get the weak-gravity boost on top of their size: on moons a few
  // hundred metres across it made ranges a sixth of the radius high, jagged against the sky.
  const M = Math.min(scaleR * reliefK, Math.max(.12, RM / 2300));
  // Heights in metres added by the landforms at a point (n on the unit sphere); s: mesh spacing.
  // d: the continent field less its sea level (> 0 on land).
  let calm = 0; // how much of a point is mountain massif (set by landforms(), read by micro())
  let mesaH = 0; // how much of a point's height is tableland (set by landforms(), read by rivers())
  // Erosion, faked: water running off the mountains cuts gullies straight down their flanks,
  // side by side, joining and wandering, deepest where the slope is steepest, fading out on
  // the crests and on the valley floors, with spurs left standing between them. The way down
  // is measured from the ranges' own large shapes (their first octaves); the gullies are
  // stripes across that direction, drawn from small overlapping patches (each turning with the
  // slope where it is) and blended by their phase, so the pattern bends with the mountains
  // without tearing.
  const ERO_E = .0012;
  function massifLow(x, y, z, bf) { // the ranges' broad shape (metres): swell and main ridges
    const belt = smooth(-.1, .5, fbm(nF, x * bf + 17, y * bf, z * bf, 2));
    if (belt <= 0) return 0;
    const wf = RM / 900, wq = 260 / RM;
    const wx = x + wq * nF(x * wf + 3, y * wf, z * wf), wy = y + wq * nF(x * wf, y * wf + 7, z * wf), wz = z + wq * nF(x * wf, y * wf, z * wf + 11);
    return belt * sridged(nE, wx + 4, wy, wz, RM / 760, 2, 2.1, 230 * M * L.ranges, 60) + belt * belt * 55 * M * L.ranges;
  }
  function stripes(x, y, z, cx, cy, cz, lam, key) { // phase-blended stripes across direction c, spacing lam (m)
    const X = x * RM / lam, Y = y * RM / lam, Z = z * RM / lam, ix = Math.floor(X), iy = Math.floor(Y), iz = Math.floor(Z);
    let re = 0, im = 0;
    for (let k = 0; k < 8; k++) {
      const ox = k & 1, oy = (k >> 1) & 1, oz = (k >> 2) & 1, dx = X - ix - ox, dy = Y - iy - oy, dz = Z - iz - oz;
      const w = (1 - Math.abs(dx)) * (1 - Math.abs(dy)) * (1 - Math.abs(dz));
      const th = TAU * ((dx * cx + dy * cy + dz * cz) + hash01(ix + ox, iy + oy, iz + oz, key));
      re += w * Math.cos(th); im += w * Math.sin(th);
    }
    return Math.cos(Math.atan2(im, re)); // 1 on a stripe's line, -1 between
  }
  function erosion(x, y, z, bf, mass, s) {
    const lamA = 190 * Math.max(.6, M); // metres between gullies
    const wA = bw(lamA, s);
    if (wA <= 0 || mass <= .02) return 0;
    const h0 = massifLow(x, y, z, bf);
    const gx = (massifLow(x + ERO_E, y, z, bf) - h0) / (ERO_E * RM), gy = (massifLow(x, y + ERO_E, z, bf) - h0) / (ERO_E * RM), gz = (massifLow(x, y, z + ERO_E, bf) - h0) / (ERO_E * RM);
    const gn = gx * x + gy * y + gz * z, tx = gx - gn * x, ty = gy - gn * y, tz = gz - gn * z, slope = Math.hypot(tx, ty, tz); // metres per metre
    if (slope < .02) return 0;
    // Across the slope (along the contours): the gullies alternate this way.
    const cx = (y * tz - z * ty) / slope, cy = (z * tx - x * tz) / slope, cz = (x * ty - y * tx) / slope;
    // Only on the long flanks of real mountains: none on gentle ground, none on cliffs and
    // steep faces (there they drew as even flutes, like a comb), none on small hills (where
    // they met at the top in a star).
    const flankSlope = smooth(.08, .22, slope) * (1 - smooth(.4, .7, slope));
    if (flankSlope <= 0) return 0;
    const g1 = Math.pow(Math.max(0, stripes(x, y, z, cx, cy, cz, lamA, 1)), 1.2);
    // Uneven: some gullies deep, some faint, some missing, so they never read as a pattern.
    const vary = smooth(-.3, .6, nE(x * RM / (lamA * 2.5) + 21, y * RM / (lamA * 2.5), z * RM / (lamA * 2.5)));
    const flank = smooth(.25, .6, mass) * (1 - smooth(.85, 1, mass) * .5);
    return cap(14 * M, lamA) * g1 * vary * wA * flank * flankSlope;
  }
  function landforms(x, y, z, d, s) {
    calm = 0; mesaH = 0;
    const inland = smooth(.02, .32, d), coast = smooth(-.04, .06, d);
    // The shelf: land rises gently inland, the sea floor drops away beyond the coast.
    let h = L.shelf * (d * 30 * M + 16 * M * smooth(0, .07, d) + 16 * M * Math.pow(smooth(.05, .45, d), .8) - 30 * M * smooth(0, -.08, d));
    // Rolling hills everywhere on land (gentle near the coast and on the sea floor, so
    // coasts follow the continents instead of breaking them up into specks).
    // Some country is hilly and some flat plain, in broad regions.
    const hilly = .2 + .8 * smooth(-.35, .45, nF(x * 2.6 + 13, y * 2.6, z * 2.6 - 4));
    h += sfbm(nF, x, y, z, RM / 260, 3, 22 * M * L.hills, s, [5, 1, 7]) * (.12 + .88 * inland) * hilly;
    // Mountain ranges along belts (where a second field crosses zero), tallest far inland.
    if (L.ranges > 0 && inland > 0) {
      // Massifs: the belt widens and narrows along its length, and rises as a broad swell
      // (so a range stands up out of the land as a whole, not a strip of ridges on a plain).
      // Massifs: broad mountain country a kilometre or few across (a low-frequency field),
      // rising as a swell, so a range stands up out of the land as a whole.
      // (Two octaves and a wide ramp: the massif's edge rises gradually, since its swell and
      // ridges scale with it and a sharp edge made sheer walls.)
      const bf = L.beltFreq * 1.6, massV = fbm(nF, x * bf + 17, y * bf, z * bf, 2);
      const belt = smooth(-.1, .5, massV), mass = belt * smooth(0, .45, inland);
      calm = mass;
      if (mass > 0) {
        // Ridges branching off a main crest, from ridged noise on a warped domain: the warp
        // bends the ridgelines and splits them into spurs, and each octave is weighted by the
        // one before (sridged), so the fine ridges and gullies sit on the high ground and
        // the valley floors between stay smooth, as erosion leaves them.
        const wf = RM / 900, wq = 260 / RM;
        const wx = x + wq * nF(x * wf + 3, y * wf, z * wf), wy = y + wq * nF(x * wf, y * wf + 7, z * wf), wz = z + wq * nF(x * wf, y * wf, z * wf + 11);
        const crest = sridged(nE, wx + 4, wy, wz, RM / 760, 6, 2.1, 230 * M * L.ranges, s);
        const rangeH = mass * crest + mass * mass * 55 * M * L.ranges;
        h += rangeH; mesaH += rangeH; // the ridges, and the swell they stand on (counted like tableland by the rivers)
        h -= erosion(x, y, z, bf, mass, s) * L.ranges; // gullies down the flanks
      }
      // Debris fans at the foot of the mountains: the land rises in a long concave apron
      // into them instead of meeting them at a crease.
      h += smooth(0, .3, belt) * (1 - smooth(.3, .75, belt)) * 14 * M * L.ranges * smooth(0, .45, inland);
      h += sridged(nE, x + 9, y + 2, z, RM / 320, 3, 2, 14 * M * L.ranges, s) * inland * (.3 + .7 * belt); // foothills, mostly near the ranges
    }
    // Mesas: flat-topped tablelands with cliff edges and a terraced fringe.
    // The cliff is wide enough to stay under about 50 degrees, and wider still on coarse
    // (distant) tiles, so its edge never zig-zags along the grid of vertices; mesas no
    // longer vanish from afar either.
    if (L.mesas > 0) {
      const m = fbm(nF, x * RM / 420 + 51, y * RM / 420, z * RM / 420, 3), w = Math.min(.12, s * .012);
      // (The cliff is spread over a wider band than it was: at its old steepness the mesh drew it as a
      // wall of saw teeth.)
      const top = smooth(.04 - w, .32 + w, m) * smooth(-.02, .22, d); // (tablelands rise from the coast over a wide band, not a cliff at the shore)
      calm = Math.max(calm, 1 - Math.abs(top - .5) * 2); // the cliff band
      if (top > 0) { const mh = L.mesas * 38 * M * (top + .35 * smooth(.24, .5, m)); mesaH += mh; h += mh; }
    }
    return h;
  }
  // Rivers: winding along the zero line of their own field, so they meander, join the sea
  // and never end in a wall. Across a river: the water channel, a flat floodplain either
  // side, then the valley sides easing back up into the land (wider in high country). In
  // the lowlands the channel lies below sea level, so the sea runs up it as a river; high
  // in the hills the bed climbs with the land and runs dry, a stream bed in a deep valley.
  // Width varies along the course. Deserts get dry canyons.
  const riverField = (x, y, z) => { const f = L.riverFreq; return nF(x * f + 31, y * f, z * f + 3) + .3 * nF(x * f * 2.1 + 5, y * f * 2.1, z * f * 2.1) + .04 * nF(x * f * 6, y * f * 6, z * f * 6 + 8); }; // few octaves: long courses, few closed loops
  let riverGrad = 0; // how fast the field changes per metre, so its value reads as metres from the river
  function rivers(x, y, z, h, s) {
    if (riverSea === null) return h;
    const above = h - riverSea;
    if (above <= 0) return h;
    if (!riverGrad) { // measured once, from the field itself
      let sum = 0;
      for (let k = 0; k < 64; k++) { const p = SAMPLE_POINTS[k * 10], e = 5 / RM; sum += Math.hypot(riverField(p.x + e, p.y, p.z) - riverField(p.x, p.y, p.z), riverField(p.x, p.y + e, p.z) - riverField(p.x, p.y, p.z)) / 5 / Math.SQRT2; }
      riverGrad = Math.max(1e-6, sum / 64);
    }
    const d = Math.abs(riverField(x, y, z)) / riverGrad; // metres from the middle of the river, roughly
    // Where a river cuts through tableland, how high the land is under the mesa decides whether
    // the river runs there (so it does not stop dead at the mesa's edge, leaving a wall), and
    // the valley is as wide as the whole height it cuts through needs to keep its sides sloping.
    const aboveB = Math.max(0, above - mesaH);
    const valleyW = 40 + 20 * M + above * 3; // (wider through high ground: steeper sides drew as saw-toothed walls)
    if (d > valleyW * 1.3) return h;
    const source = 1 - smooth(35 * M, 75 * M, aboveB); // rivers rise in the hills: none on the high ground (a bed climbing far up a mountainside drew as a thin line across it)
    const wet = 50 * M, rise = Math.max(0, aboveB - wet) * .75; // above this the bed runs dry and climbs
    const half = (6 + 9 * M) * (.65 + .7 * (.5 + .5 * nF(x * RM / 600 + 2, y * RM / 600, z * RM / 600))) * (liquid ? 1 : 1.6);
    const plain = half * 2.5 + 6, bank = riverSea + 2.4 + rise, floor = riverSea - 2.2 + rise * .96;
    let out = h;
    // The valley: the land eases down to the floodplain.
    const side = smooth(plain, valleyW * 1.3, d);
    out = bank + Math.max(0, h - bank) * side + Math.min(0, h - bank);
    // The channel.
    // (Drawn coarsely, far off, the channel is widened to the mesh's own spacing and kept
    // far longer than other detail its size: where it faded out, the next coarser tile had
    // no channel and no water, and the river ended in a straight wall at the tile's edge.)
    const halfS = Math.max(half, (s || 0) * 1.4);
    // (The walls widen with the depth they drop, so a deep canyon has sloping sides: sheer ones
    // drew as walls of saw teeth.)
    const deepC = Math.max(0, out - Math.min(floor, out)), ch = (1 - smooth(halfS * .6, Math.max(halfS * 1.25, halfS * .6 + deepC * 1.1), d)) * bw(half * 14, s);
    out += (Math.min(floor, out) - out) * ch;
    return h + (out - h) * L.rivers * source;
  }

  // Fractal noise for the large shapes, in metres. Two limits on each octave: it is
  // never steeper than about 30 degrees on its own (small worlds and rough biomes
  // otherwise grew needle-like spikes), and it fades out when finer than the mesh
  // being built can show (s, see micro()).
  const TAU = Math.PI * 2;
  function sfbm(noise, x, y, z, freq, oct, metres, s, offs = [0, 0, 0], lac = 2.03) {
    let sum = 0, a = 1, norm = 0, k = 1;
    for (let o = 0; o < oct; o++) norm += .5 ** o;
    for (let o = 0, f = freq; o < oct; o++, f *= lac, a *= .5, k *= lac) {
      const lam = RM / f, octave = cap(metres * a / norm, lam); // lam: the noise's scale in metres
      const w = bw(lam, s);
      if (w > 0) sum += octave * w * noise(x * f + offs[0] * k, y * f + offs[1] * k, z * f + offs[2] * k);
    }
    return sum;
  }
  function sridged(noise, x, y, z, freq, oct, sharpness, metres, s) {
    let sum = 0, a = 1, norm = 0, weight = 1;
    for (let o = 0; o < oct; o++) norm += .5 ** o;
    for (let o = 0, f = freq; o < oct; o++, f *= 2.07, a *= .5) {
      const lam = RM / f;
      if (bw(lam, s) <= 0) break; // finer octaves cannot show on this mesh either: nothing more to add
      // New land: the crest is rounded off by about a mesh spacing (|n| softened to
      // sqrt(n² + e²)); a knife-edge crease drawn on a grid of vertices zig-zags along it,
      // which showed as sawtooth ridges and waffled mountain sides.
      const nv = noise(x * f, y * f, z * f), e = LAND ? Math.min(.45, .03 + 3 * Math.max(s, FINE_S) / lam) : 0;
      let v = 1 - (e ? Math.sqrt(nv * nv + e * e) - e : Math.abs(nv)); v = Math.max(0, v) ** sharpness * weight;
      weight = Math.min(1, v * 1.6);
      const octave = cap(metres * a / norm, lam / sharpness); // sharp crests are steeper
      sum += octave * v * bw(lam, s);
    }
    return sum;
  }
  // Ergs: seas of dunes in the basins and plains (none on mountains or mesas). Deep in an erg
  // the dunes are long, straight-crested ridges running with the wind (seif dunes), side by
  // side and gently sinuous; toward its edges the sand thins into crescent dunes across the
  // wind, gentle on the windward side and steep on the lee, broken into separate horns.
  function ergs(x, y, z, s, cd) {
    const lamL = 170 * Math.max(.6, M), lamT = 95 * Math.max(.6, M), wL = bw(lamL, s);
    if (wL <= 0) return 0;
    const ax = x * windDir[0] + y * windDir[1] + z * windDir[2];
    const frame = 1 - smooth(.8, .95, Math.abs(ax)); // near the wind's own poles the layout turns: none there
    const basin = smooth(.28, .02, cd), still = 1 - smooth(.03, .3, calm);
    const mask = smooth(-.05, .4, fbm(nF, x * 2.2 + 41, y * 2.2, z * 2.2, 2)) * frame * basin * still;
    if (mask <= 0) return 0;
    const A = ax * RM, C = (x * crossDir[0] + y * crossDir[1] + z * crossDir[2]) * RM;
    const inner = smooth(.35, .75, mask);
    // Seif: crest lines along the wind.
    const ph = Math.PI * C / lamL + .9 * nE(A / 700 + 2, C / 2400, 3.3);
    const seif = Math.pow(1 - Math.min(1, Math.sqrt(Math.sin(ph) ** 2 + .01)), 1.4);
    // Crescents: across the wind, a long gentle windward slope and a short steep lee (rounded at the crest).
    const wT = bw(lamT, s), u = A / lamT + .7 * nE(C / 320, A / 900, 8.8), t = u - Math.floor(u);
    const prof = smooth(0, .72, t) * (1 - smooth(.78, 1, t));
    const horns = smooth(.05, .45, nE(C / (lamT * 1.1) + 5, A / (lamT * 2.2), 4.4));
    return mask * (cap(15 * Math.max(.6, M), lamL) * seif * inner * wL + cap(8 * Math.max(.6, M), lamT) * prof * horns * (1 - inner) * wT);
  }
  // Shield volcanoes: broad, gently rising domes (wide and low, as runny lava builds them)
  // steepening a little toward the top, with a caldera at the summit: a flat-floored pit with
  // cliff walls. Lava flows run down from it as raised tongues of their own lengths, and cinder
  // cones stand around the foot. flowAt() tells the colouring where the fresh lava is.
  // Distance from a volcano's centre in its radii, its outline warped (lopsided, with lobes and
  // spurs) so no two are the same shape and none is a perfect circle.
  function volcanoD(v, x, y, z) {
    const d = Math.sqrt(Math.max(0, 2 * (1 - (x * v.c[0] + y * v.c[1] + z * v.c[2])))) / v.r;
    if (d > 1.6) return d;
    const f = 1.4 / v.r, g = 3.2 / v.r, k = v.flowSeed || 0;
    return d * (1 + .26 * nE(x * f + k, y * f, z * f) + .05 * nE(x * g, y * g + k, z * g));
  }
  function flowAt(x, y, z) {
    let best = 0;
    for (const v of volcanoes) {
      const d = volcanoD(v, x, y, z);
      if (d >= 1.25 || d < v.caldera * .9) continue;
      // Angle round the volcano (from a frame on its centre).
      const c = v.c, h0 = Math.abs(c[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      const ex = c[1] * h0[2] - c[2] * h0[1], ey = c[2] * h0[0] - c[0] * h0[2], ez = c[0] * h0[1] - c[1] * h0[0], el = Math.hypot(ex, ey, ez);
      const fx = c[1] * ez - c[2] * ey, fy = c[2] * ex - c[0] * ez, fz = c[0] * ey - c[1] * ex;
      const ang = Math.atan2((x * fx + y * fy + z * fz) / el, (x * ex + y * ey + z * ez) / el);
      // Each flow a lobe in angle that wanders as it runs down, ending at its own distance.
      // Each flow a tongue: a narrow wedge that bends gently as it runs down (its bend depends
      // only on how far down it is), widens a little toward its end and stops at its own length.
      const k = v.flows, u0 = (ang / TAU + .5) * k, cell = Math.floor(u0);
      const id = hash01(cell, Math.floor(v.flowSeed), 3, 9), bend = .22 * nE(d * 2.6 + id * 9, cell * 1.7 + v.flowSeed, 1.3);
      const t = u0 - cell - .5 - bend;
      const reach = .5 + .7 * id, width = (.07 + .07 * hash01(cell, 7, Math.floor(v.flowSeed), 2)) * (.6 + .8 * smooth(v.caldera, reach, d));
      const lobe = smooth(width, width * .45, Math.abs(t)) * smooth(reach + .06, reach - .05, d) * smooth(v.caldera, v.caldera + .08, d);
      best = Math.max(best, lobe);
    }
    return best;
  }
  function volcanic(x, y, z, s) {
    let h = 0;
    for (const v of volcanoes) {
      const d = volcanoD(v, x, y, z);
      if (d >= 1.25) continue;
      const rM = v.r * RM, H = Math.min(v.height * amp * (1 + 3 * scaleR) * .9, rM * .2);
      // The shield: low and wide, a little steeper near the top.
      let dome = d < 1 ? H * Math.pow(1 - d * d, 1.7) : 0;
      // The caldera: its floor a fifth of the way down, cliff walls round it.
      const rc = v.caldera, wall = smooth(rc * .78, rc, d);
      dome -= H * .2 * (1 - wall) * bw(rc * rM, s);
      h += dome;
    }
    // Lava flows: raised a few metres, with a rounded edge.
    const fl = flowAt(x, y, z);
    if (fl > 0) h += cap(5 * Math.max(.6, M), 60) * smooth(0, .5, fl) * bw(40, s);
    // Cinder cones: small, steep, each with a crater.
    for (const c of cones) {
      const dM = Math.sqrt(Math.max(0, 2 * (1 - (x * c.c[0] + y * c.c[1] + z * c.c[2])))) * RM / c.rM;
      if (dM >= 1) continue;
      const w = bw(c.rM, s);
      if (w <= 0) continue;
      h += w * c.rM * c.hgt * (Math.pow(1 - dM, 1.3) - (dM < .28 ? (.28 - dM) * 1.1 : 0));
    }
    return h;
  }
  // Toxic features. springAt: the nearest spring's distance in its own radii (or Infinity).
  function springAt(x, y, z) {
    let best = Infinity, sp = null;
    for (const q of springs) { const dM = Math.sqrt(Math.max(0, 2 * (1 - (x * q.c[0] + y * q.c[1] + z * q.c[2])))) * RM / q.rM; if (dM < best) { best = dM; sp = q; } }
    // Ragged edges: the rings follow where the water spilled.
    return { d: best * (1 + .2 * nE(x * RM / 45 + 3, y * RM / 45, z * RM / 45) + .08 * nE(x * RM / 12, y * RM / 12 + 5, z * RM / 12)), sp };
  }
  function poolAt(x, y, z) { // { d: distance in pool radii } of the pool in this cell, if any
    const X = x * RM / POOL, Y = y * RM / POOL, Z = z * RM / POOL, ix = Math.floor(X), iy = Math.floor(Y), iz = Math.floor(Z);
    if (hash01(ix, iy, iz, 21) > .33) return Infinity;
    const cx = ix + .3 + .4 * hash01(ix, iy, iz, 22), cy = iy + .3 + .4 * hash01(ix, iy, iz, 23), cz = iz + .3 + .4 * hash01(ix, iy, iz, 24), r = (12 + 24 * hash01(ix, iy, iz, 25)) / POOL;
    // (The pool lies on the sphere: measure across it, ignoring the depth direction.)
    const dx = X - cx, dy = Y - cy, dz = Z - cz, along = dx * x + dy * y + dz * z;
    return Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along)) / r * (1 + .25 * nE(x * RM / 9, y * RM / 9, z * RM / 9));
  }
  function toxicLand(x, y, z, s) {
    let h = 0;
    const { d, sp } = springAt(x, y, z);
    if (d < 1) {
      // A mound of crust in terraces: flat treads (where water pools) and short risers with rims.
      const mound = sp.H * Math.pow(1 - d, 1.25), w = bw(sp.step * 6, s);
      const q = mound / sp.step, f = q - Math.floor(q), terr = (Math.floor(q) + smooth(.72, 1, f)) * sp.step;
      h += mound + (terr - mound) * w * .85 + .25 * w * Math.exp(-(((f - .98) / .05) ** 2));
      if (d < .14) h -= 1.4 * smooth(.14, .05, d); // the hot pool at the top
    }
    const pd = poolAt(x, y, z);
    if (pd < 1.3) h -= 1.3 * smooth(1.15, .8, pd) * bw(20, s); // acid pools: shallow, flat-bottomed
    return h;
  }
  function geodeAt(x, y, z) {
    let best = Infinity, g = null;
    for (const q of geodes) { const dM = Math.sqrt(Math.max(0, 2 * (1 - (x * q.c[0] + y * q.c[1] + z * q.c[2])))) * RM / q.rM; if (dM < best) { best = dM; g = q; } }
    return { d: best, g };
  }
  // Facets: which crystal plate a point is on (cellular), and how close to its edge.
  function facetAt(X, Y, Z) {
    const fx = X / FACET, fy = Y / FACET, fz = Z / FACET, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
    let f1 = 9, f2 = 9, id = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = ix + a, cy = iy + b, cz = iz + c, dx = cx + hash01(cx, cy, cz, 31) - fx, dy = cy + hash01(cx, cy, cz, 32) - fy, dz = cz + hash01(cx, cy, cz, 33) - fz, d = dx * dx + dy * dy + dz * dz;
      if (d < f1) { f2 = f1; f1 = d; id = hash01(cx, cy, cz, 34); } else if (d < f2) f2 = d;
    }
    return { id, edge: Math.sqrt(f2) - Math.sqrt(f1) };
  }
  const shatterMask = (x, y, z) => smooth(.1, .45, fbm(nF, x * 3.1 + 61, y * 3.1, z * 3.1, 2));
  function amethystLand(x, y, z, s) {
    let h = 0;
    const { d, g } = geodeAt(x, y, z);
    if (d < 1.3) { // a bowl with a raised rim; steep walls
      const rM = g.rM, depth = rM * g.depth, w = bw(rM, s);
      h += w * (-depth * (1 - smooth(.55, .95, d)) + depth * .35 * Math.exp(-(((d - 1) / .16) ** 2)));
    }
    const m = shatterMask(x, y, z), wf = bw(FACET, s);
    if (m > 0 && wf > 0) { const f = facetAt(x * RM, y * RM, z * RM); h += m * wf * ((f.id - .5) * 1.6 - .5 * Math.exp(-((f.edge / .05) ** 2))); } // plates at their own heights, split by cracks
    return h;
  }
  // Oceanic features, measured from the sea level (so they are added once it is known).
  function oceanLand(x, y, z, h, s) {
    if (seaLevel === null || !Number.isFinite(seaLevel)) return h;
    for (const a of atolls) {
      const dM = Math.sqrt(Math.max(0, 2 * (1 - (x * a.c[0] + y * a.c[1] + z * a.c[2])))) * RM / a.rM;
      if (dM > 1.6 || h > seaLevel - 1) continue; // only out at sea
      if (a.base === undefined) a.base = raw0({ x: a.c[0], y: a.c[1], z: a.c[2] }, 0, true, true);
      if (a.base > seaLevel - 9) continue; // and only in deep water, well off any coast
      const wob = 1 + .12 * nE(x * RM / 60 + a.seed, y * RM / 60, z * RM / 60);
      const ring = Math.exp(-(((dM * wob - 1) / a.w) ** 2)), w = bw(a.rM * a.w * 2, s);
      // The reef just breaks the surface (in places) round a lagoon a few metres deep, on a
      // shallow platform rising out of the deep sea.
      const platform = seaLevel - 7 + 4 * smooth(1.5, .9, dM), lagoon = seaLevel - 2.6;
      let top = dM < 1 ? Math.max(lagoon, platform) : platform;
      top = Math.max(top, seaLevel - 2 + (2.9 + .8 * nE(x * RM / 35, y * RM / 35 + a.seed, z * RM / 35)) * ring * w);
      if (dM < 1.6) h = Math.max(h, h + (top - h) * smooth(1.6, 1.2, dM));
    }
    for (const q of isles) {
      let dM = Math.sqrt(Math.max(0, 2 * (1 - (x * q.c[0] + y * q.c[1] + z * q.c[2])))) * RM / q.rM;
      if (dM > 2.6) continue;
      // An irregular outline: lobes, headlands and coves, not a round cone.
      const f1 = RM / (q.rM * 1.1), f2 = RM / (q.rM * .55);
      dM *= 1 + .3 * nE(x * f1 + q.H, y * f1, z * f1) + .06 * nE(x * f2, y * f2 + q.H, z * f2);
      if (dM > 2.2) continue;
      // A volcanic island: a cone rising steeply from the deep, gentler where it breaks the surface.
      const cone = seaLevel + q.H * Math.pow(Math.max(0, 1 - dM), 1.4) - 14 * smooth(.8, 2.2, dM) + 6 * (1 - smooth(0, 1, dM));
      const k = bw(q.rM, s) * smooth(2.2, 1.5, dM); // blends into the sea floor at its foot
      h = Math.max(h, cone * k + h * (1 - k));
    }
    return h;
  }
  function raw0(n, s = 0, noIce = false, noOcean = false) {
    const x = n.x, y = n.y, z = n.z;
    const cont = fbm(nA, x * 1.25 + off[0], y * 1.25 + off[1], z * 1.25 + off[2], 5);
    const cd = LAND ? contAt(x, y, z) - contSea : 0; // the new continents: > 0 on land
    const lf = LAND ? landforms(x, y, z, cd, s) : 0; // first, so calm (mountain and cliff) is known to the dunes below
    // Heights in metres from here on.
    let h = sfbm(nA, x, y, z, 1.25, 5, shape.continents * amp * (LAND ? .35 : 1), s, off)
      + sridged(nB, x, y, z, 2.4, 5, shape.sharp || 2, shape.mountains * amp, s) * smooth(-.15, .45, cont) * (LAND ? .25 + .75 * smooth(-.03, .12, cd) : 1) // new land: the classic ridges mostly kept to land
      + sfbm(nC, x, y, z, 9, 5, shape.detail * 2 * amp, s); // fine octaves matter once close-up detail can show them
    if (shape.dunes && LAND && DESERT && !SALT) h += ergs(x, y, z, s, cd); // (salt worlds: flats, not dune seas)
    else if (shape.dunes) {
      const along = (x * duneDir[0] + y * duneDir[1] + z * duneDir[2]) * 70 + 4 * fbm(nC, x * 3, y * 3, z * 3, 2);
      const sn = Math.sin(along), crest = LAND ? 1 - Math.sqrt(sn * sn + .04) + .2 : 1 - Math.abs(sn); // (new land: rounded crests; a cusp on a grid of vertices drew saw teeth)
      h += bw(TAU * RM / 70, s) * shape.dunes * amp * crest * smooth(.25, -.1, cont) * (LAND ? 1 - smooth(.05, .4, calm) : 1);
    }
    // Frozen worlds: broad, gentle grooves (narrow trenches came out as sawtooth steps on the mesh).
    if (shape.cracks) h -= bw(TAU * RM / 70, s) * shape.cracks * amp * .7 * (1 - smooth(0, .22, Math.abs(nC(x * 7, y * 7, z * 7))));
    // Craters and volcanoes keep believable proportions on any size of world: a crater
    // is at most a quarter as deep as it is wide in radius, a volcano at most half as
    // tall as its radius (small moons otherwise got deep shafts ringed with spikes).
    for (const k of craters) {
      const d = Math.sqrt(Math.max(0, 2 * (1 - (x * k.c[0] + y * k.c[1] + z * k.c[2])))) / k.r;
      if (d < 1.8) {
        const rM = k.r * RM, depth = Math.min(k.depth * amp * (LAND ? 1 + 2 * scaleR : 1), rM * .25) * bw(rM, s);
        if (BARREN) { // by age: young ones deep and crisp, old ones shallow, soft-rimmed and filled flat
          const young = 1 - k.age, dep = depth * (.45 + .75 * young), rimW = .14 + .2 * k.age;
          const bowl = d < 1 ? Math.max((d * d - 1) * .9, -(.35 + .6 * young)) : 0; // old craters: flat floors
          h += dep * bowl + dep * (.25 + .2 * young) * Math.exp(-(((d - 1) / rimW) ** 2));
          if (young > .6 && d < .18 && rM > 120) h += dep * .3 * (1 - d / .18); // a central peak in big young craters
        } else
        h += depth * (d < 1 ? (d * d - 1) * .9 : 0) + depth * .35 * Math.exp(-(((d - 1) / .22) ** 2));
      }
    }
    if (VOLCANIC) h += volcanic(x, y, z, s);
    else for (const v of volcanoes) {
      const d = Math.sqrt(Math.max(0, 2 * (1 - (x * v.c[0] + y * v.c[1] + z * v.c[2])))) / v.r;
      if (d < 1) h += Math.min(v.height * amp * (LAND ? 1 + 3 * scaleR : 1), v.r * RM * (LAND ? .32 : .5)) * ((1 - d) ** 1.6 - (d < .16 ? (.16 - d) * 3.5 : 0));
    }
    if (LAND) h = rivers(x, y, z, h + lf, s);
    if (FROZEN && !noIce) h = frozenLand(n, x, y, z, h, s);
    if (TOXIC) h += toxicLand(x, y, z, s);
    if (AMETHYST) h += amethystLand(x, y, z, s);
    if (OCEANIC && !noOcean) h = oceanLand(x, y, z, h, s);
    // Wetland worlds: the low country lies within a metre or two of the water, so the sea
    // threads through it in channels and pools; higher ground rises out of the marsh.
    if (WETLAND && seaLevel !== null && Number.isFinite(seaLevel)) {
      // The lowlands are pressed down toward the water (hills and mountains keep their height).
      const a0 = h - seaLevel, lowK = 90 * Math.max(.6, M);
      if (a0 > 0 && a0 < lowK * 2) h = seaLevel + (a0 < lowK ? a0 * .3 : lowK * .3 + (a0 - lowK) * 1.7);
      const above = h - seaLevel, k = smooth(22 * Math.max(.6, M), 5, above) * smooth(-14, -2, above);
      if (k > 0) h = h + (seaLevel + .2 + 2.4 * nE(x * RM / 70 + 4, y * RM / 70, z * RM / 70) + .9 * nE(x * RM / 22, y * RM / 22 + 7, z * RM / 22) - h) * k; // about half of it under water: pools and channels
    }
    if (BARREN) for (const sc of scarps) { // a lobate scarp: the ground steps up along a long, wandering line
      const dl = (x * sc.n[0] + y * sc.n[1] + z * sc.n[2] - sc.off * .3 + .02 * nE(x * 4 + sc.seed, y * 4, z * 4)) * RM;
      const arc = smooth(-.1, .2, nF(x * 1.2 + sc.seed, y * 1.2, z * 1.2));
      if (arc > 0 && Math.abs(dl) < 400) h += sc.H * arc * smooth(-35, 25, dl) * (1 + .3 * Math.exp(-(((dl - 22) / 18) ** 2)));
    }
    const out = micro(x * RM, y * RM, z * RM, h, s);
    return saltLevel !== null && out < saltLevel ? saltLevel - (saltLevel - out) * .03 : out; // salt flats: the basin floor dead level
  }
  // Frozen worlds: ice sheets and lineae (see FROZEN above).
  // Ice sheets: over wide regions, colder toward the poles and high up, a smooth sheet of ice
  // lies over the land: the land's own broad shape (its large features only) plus the ice's
  // thickness. It fills the valleys and buries the low country; peaks and ridges stand out of
  // it (nunataks). Where it reaches the sea it ends in an ice cliff.
  function sheetMask(x, y, z) {
    const lat = Math.abs(x * axis[0] + y * axis[1] + z * axis[2]);
    return smooth(.05, .45, fbm(nF, x * 1.3 + 77, y * 1.3, z * 1.3 - 5, 3) + .45 * lat - .15);
  }
  function linea(x, y, z, s) {
    let h = 0;
    for (const L of lineae) {
      const wob = .012 * nE(x * 3 + L.seed, y * 3, z * 3) + .004 * nE(x * 11 + L.seed, y * 11, z * 11);
      const d = Math.abs(x * L.n[0] + y * L.n[1] + z * L.n[2] + wob) * RM;
      if (d > L.w * 3) continue;
      const arc = smooth(-.15, .15, nF(x * 1.4 + L.seed, y * 1.4, z * 1.4)); // broken into long arcs
      if (arc <= 0) continue;
      const w = L.w, wv = bw(w * 2, s);
      if (wv <= 0) continue;
      const ridge = Math.exp(-(((d - w) / (w * .45)) ** 2)), trough = Math.exp(-((d / (w * .4)) ** 2));
      h += cap(5 * L.k, w * 2) * (ridge - .8 * trough) * arc * wv;
    }
    return h;
  }
  function frozenLand(n, x, y, z, h, s) {
    const m = sheetMask(x, y, z);
    if (m > 0) {
      const broad = raw0(n, Math.max(s, 150 * Math.max(.5, M)), true); // the land's large shape only
      const thick = (3 + 12 * m) * Math.max(.35, M);
      // The ice surface; how much of the land it covers rises smoothly into the sheet (so it
      // never stands as a wall where the sheet ends, or over a valley at its edge) and thins
      // out toward the sea (no sheer step at the coast).
      const ice = broad + thick * smooth(0, .35, m);
      let k = smooth(0, .3, m);
      if ((liquid === 'water' || liquid === 'ice') && seaLevel !== null) k *= smooth(seaLevel - .5, seaLevel + 8, broad);
      if (ice > h) h += (ice - h) * k;
    }
    if (lineae.length) h += linea(x, y, z, s);
    return h;
  }
  // Pack ice on frozen seas: flat floes with low pressure ridges where they meet (cellular).
  const PACK = 26;
  function packIce(n, s) {
    const w = bw(PACK, s);
    if (w <= 0) return 0;
    const X = n.x * RM / PACK, Y = n.y * RM / PACK, Z = n.z * RM / PACK, ix = Math.floor(X), iy = Math.floor(Y), iz = Math.floor(Z);
    let f1 = 9, f2 = 9, id = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = ix + a, cy = iy + b, cz = iz + c;
      const dx = cx + hash01(cx, cy, cz, 1) - X, dy = cy + hash01(cx, cy, cz, 2) - Y, dz = cz + hash01(cx, cy, cz, 3) - Z, d = dx * dx + dy * dy + dz * dz;
      if (d < f1) { f2 = f1; f1 = d; id = hash01(cx, cy, cz, 4); } else if (d < f2) f2 = d;
    }
    const edge = Math.sqrt(f2) - Math.sqrt(f1); // 0 on a seam between floes
    return w * (.45 * Math.exp(-((edge / .06) ** 2)) + .25 * id * id);
  }
  // Small-scale relief, in metres: the shapes you notice on foot. Soft ground gets
  // hummocks, swales and low banks; rocky ground gets ledges (the slope broken into
  // steps), slabs, boulders and a rough surface.
  // s: the spacing (metres) of the mesh being built. Features finer than about
  // three spacings are faded out, since that mesh cannot show them (they would
  // only alias into noise). s = 0 keeps everything: walking, landing and placing
  // things use the full detail, which the finest tiles around the player show.
  // (New land: on coarser meshes, seen from further off, features need more spacings
  // still, 8 rather than 6: at about three vertices a wavelength they showed as regular,
  // waffle-like ripples on long slopes.)
  const bw = LAND ? (lam, s) => { const a = s <= 1 ? 6 : 6 + 2 * smooth(1, 3, s); return s <= lam / a ? 1 : 1 - smooth(lam / a, lam / (a / 2), s); } : (lam, s) => s <= lam / 6 ? 1 : 1 - smooth(lam / 6, lam / 3, s);
  // Fractal noise with octaves measured in metres (finest octaves fade with s).
  // metres: the total amplitude; each octave is also held to cap().
  function bfbm(X, Y, Z, lam, oct, s, off = 0, metres = 1) {
    let norm = 0;
    for (let o = 0, a = 1; o < oct; o++, a *= .5) norm += a;
    let sum = 0, amp = 1, l = lam;
    for (let o = 0; o < oct; o++) {
      const w = bw(l, s);
      if (w > 0) sum += cap(metres * amp / norm, l) * w * nD(X / l + off, Y / l, Z / l);
      amp *= .5; l /= 2.03; off *= 1.7;
    }
    return sum;
  }
  function micro(X, Y, Z, h, s = 0) {
    if (ground === 'soft') {
      // (New land: mountainsides lose the meadow's hummocks and banks. On steep faces those
      // small bumps drew wavy ripples across the whole slope.)
      const k = LAND ? 1 - smooth(.05, .5, calm) : 1;
      if (k <= 0) return h + bfbm(X, Y, Z, 48, 2, s, 31, 1.2);
      const hummock = bfbm(X, Y, Z, 6, 3, s, 0, .5) + bfbm(X, Y, Z, 2.4, 2, s, 9, .12);
      const swale = bfbm(X, Y, Z, 48, 2, s, 31, 1.2);
      const bank = bw(26, s) * ridged(nD, X / 26 + 7, Y / 26, Z / 26, 2, 2) * cap(1.2, 26 / 2) * smooth(.1, .5, nD(X / 90, Y / 90 + 5, Z / 90));
      return h + (hummock + bank) * k + swale;
    }
    if (airless) h += smallCraters(X, Y, Z, s);
    if (ground === 'sand') {
      // Wind ripples across the dunes, gentle drifts, and the odd rock outcrop.
      let ripple = 0;
      if (bw(2.6, s) > 0) {
        const along = (X * windDir[0] + Y * windDir[1] + Z * windDir[2]) / 2.6 + 1.5 * nD(X / 9, Y / 9, Z / 9);
        const f = along - Math.floor(along); ripple = (f < .7 ? f / .7 : (1 - f) / .3) * bw(2.6, s); // gentle upwind, steep lee side
      }
      const drift = bfbm(X, Y, Z, 14, 2, s, 11, .35);
      const outcrop = bw(20, s) * smooth(.5, .9, ridged(nD, X / 20 + 5, Y / 20, Z / 20, 2, 2)) * 1.2 * smooth(.3, .7, nD(X / 70, Y / 70 + 9, Z / 70));
      const still = LAND ? 1 - smooth(.05, .4, calm) : 1; // no wind ripples on mountains and mesa walls (they showed as saw teeth on steep faces)
      // (New land: the ripples are drawn by the ground shader instead, planet-lod.js, so they
      // reach as far as you can see rather than only the finest tiles around you.)
      return h + (LAND ? 0 : ripple * .16) + drift + outcrop * still;
    }
    if (ground === 'ice') {
      // Pressure ridges, soft snow drifts and wind-cut grooves.
      const ridge = bw(22, s) * ridged(nD, X / 22, Y / 22, Z / 22, 2, 2.5) * cap(.9, 22 / 2.5) * smooth(0, .5, nD(X / 80 + 3, Y / 80, Z / 80));
      const drift = bfbm(X, Y, Z, 12, 2, s, -6, .4);
      const groove = bfbm(X, Y, Z, 1.8, 2, s, 3, .06);
      return h + ridge + drift + groove; // cracks are drawn by the ground shader, not carved
    }
    if (ground === 'toxic') {
      // A cracked crust with blisters and the occasional vent mound.
      const blister = bw(3.5, s) * smooth(.4, .8, nD(X / 3.5 + 7, Y / 3.5, Z / 3.5)) * .3;
      const vent = bw(25, s) * smooth(.6, .95, nD(X / 25, Y / 25 + 12, Z / 25)) * 2;
      const swell = bfbm(X, Y, Z, 15, 2, s, -8, .4);
      return h + blister + vent + swell; // cracks are drawn by the ground shader, not carved
    }
    if (ground === 'volcanic') {
      // Lava-flow lobes with ropy surfaces, cracked crust and broken slabs.
      const lobes = bw(18, s) * ridged(nD, X / 18 + 1, Y / 18, Z / 18, 2, 1.5) * cap(1.3, 18 / 1.5) * smooth(-.2, .4, nD(X / 50, Y / 50, Z / 50 + 3));
      const rw = bw(3.4, s), ropes = rw > 0 ? rw * Math.sin((X + Y * .7 - Z * .4) / .55 + 4 * nD(X / 5, Y / 5, Z / 5)) * .05 : 0;
      const slabs = bw(9, s) * ridged(nD, X / 9 + 3, Y / 9, Z / 9, 2, 1.6) * cap(.7, 9 / 1.6);
      const rough = bfbm(X, Y, Z, 2, 2, s, -4, .25);
      return h + lobes + ropes + slabs + rough; // cracks are drawn by the ground shader, not carved
    }
    if (ground === 'rocky') {
      const step = 2.2, f = h / step, i = Math.floor(f), terrace = (i + smooth(.55, .95, f - i)) * step;
      h += bw(6, s) * (terrace - h) * .6 * smooth(-.1, .4, nD(X / 60, Y / 60, Z / 60));
      const slabs = bw(9, s) * ridged(nD, X / 14 + 3, Y / 14, Z / 14, 3, 1.6) * cap(airless ? .6 : 1.2, 14 / 1.6 / 2); // airless: flatter, so the small craters show
      const boulders = bw(4.5, s) * smooth(.35, .8, nD(X / 4.5 + 9, Y / 4.5, Z / 4.5)) * .55; // rounded, not cones
      const rough = bfbm(X, Y, Z, 2.2, 2, s, -4, .25);
      return h + slabs + boulders + rough;
    }
    return h;
  }
  // Airless worlds: small craters, a few metres across, scattered everywhere (each
  // grid cell may hold one, with a raised rim).
  function smallCraters(X, Y, Z, s = 0) {
    const C = 14, ix = Math.floor(X / C), iy = Math.floor(Y / C), iz = Math.floor(Z / C);
    let out = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = ix + a, cy = iy + b, cz = iz + c;
      if (hash01(cx, cy, cz, 7) > .55) continue;
      const r = C * (.1 + .4 * hash01(cx, cy, cz, 4) ** 2), w = bw(r * 2, s);
      if (w <= 0) continue;
      const dx = X - (cx + hash01(cx, cy, cz, 1)) * C, dy = Y - (cy + hash01(cx, cy, cz, 2)) * C, dz = Z - (cz + hash01(cx, cy, cz, 3)) * C;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / r;
      if (d > 1.7) continue;
      const depth = r * .2;
      out += w * ((d < 1 ? (d * d - 1) * depth : 0) + depth * .35 * Math.exp(-(((d - 1) / .25) ** 2)));
    }
    return out;
  }

  // Statistics: range and sea level from the shape of the whole world. With the new
  // landforms the sea level is found twice: once without rivers, which then carve their
  // valleys down to that level, and the final level is read from the carved world.
  let samples = SAMPLE_POINTS.map(p => raw0(p)).sort((a, b) => a - b);
  let sea = liquid ? samples[Math.min(samples.length - 1, Math.floor(coverage * samples.length))] : -Infinity;
  seaLevel = sea;
  if (LAND && L.rivers > 0) {
    riverSea = Number.isFinite(sea) ? sea : samples[Math.floor(samples.length * .3)];
    riverRange = Math.max(1, samples[samples.length - 1] - riverSea);
    samples = SAMPLE_POINTS.map(p => raw0(p)).sort((a, b) => a - b);
    if (liquid) seaLevel = sea = samples[Math.min(samples.length - 1, Math.floor(coverage * samples.length))];
  }
  // Dry deserts: the lowest few percent of the land (after the rivers have cut) are salt flats.
  if (DESERT && !liquid) saltLevel = samples[Math.floor(samples.length * (SALT ? .34 : .06))]; // salt worlds: a third of the land is salt flat

  const minH = samples[0], maxH = samples[samples.length - 1];
  // How high most of the land reaches (its 92nd percentile, above the sea or the lowest
  // ground): clouds.mjs keeps the cloud deck above it, so only the high peaks reach the clouds.
  const landBase = Number.isFinite(sea) ? sea : minH, landH = samples.filter((h) => h > landBase);
  const landTop = landH.length ? landH[Math.min(landH.length - 1, Math.floor(landH.length * .92))] - landBase : 0;

  // City worlds (urban.mjs): inside the city the land is levelled into broad terraces a
  // few metres apart, with short ramps between, as builders who reshape their world
  // would leave it. The coast and the sea floor are left as they are.
  const urban = urbanOf(body), base = Number.isFinite(sea) ? sea : minH;
  const terrace = urban ? (n, h) => {
    const m = urban.mask(n) * (Number.isFinite(sea) ? smooth(sea + 1, sea + 4, h) : 1);
    if (m <= 0) return h;
    const q = (h - base) / urban.step, fl = Math.floor(q), t = base + (fl + smooth(.82, 1, q - fl)) * urban.step;
    return h + (t - h) * m;
  } : (n, h) => h;
  // Cities stand on level ground: builders from city builders up level the land under
  // every town and city of theirs (a plateau at the town's mean height, easing back into
  // the land round its edge). Filled in once the site is known (below); found by a coarse
  // grid of directions so the check is cheap.
  const levels = [], levelCells = new Map(), LC = 5;
  const cellOf = (x, y, z) => `${Math.floor(x * LC)},${Math.floor(y * LC)},${Math.floor(z * LC)}`;
  const levelled = (n, h) => {
    const list = levelCells.get(cellOf(n.x, n.y, n.z));
    if (!list) return h;
    for (const L of list) {
      const c = n.x * L.n[0] + n.y * L.n[1] + n.z * L.n[2];
      if (c < L.cosOut) continue;
      const d = Math.acos(Math.min(1, c)) * RM, w = 1 - smooth(L.r, L.r + L.fall, d);
      if (w > 0) h += (L.h - h) * w;
    }
    return h;
  };
  const raw = (n, s = 0) => levelled(n, terrace(n, raw0(n, s)));
  // Elsewhere the terrain is left exactly as generated: no flattened site.
  // Walking, landing and placing things use the detail the finest ground tiles show
  // (features under about 1.5 m are smoothed away there too), so feet, rocks and
  // plants sit exactly on the visible surface.
  const FINE = .5;
  const height = (n) => raw(n, FINE);
  // The top surface: what a ship hovers over. Frozen seas are solid ground.
  const surface = liquid ? (n) => Math.max(height(n), sea) : height;
  const isLiquid = (n) => (liquid === 'water' || liquid === 'lava') && height(n) < sea;
  // The visible mesh: sea floor under liquid seas (drawn with a separate liquid sphere), ice on top of frozen ones.
  // s (optional): the spacing of the mesh being built; see micro().
  const meshHeight = liquid === 'ice' ? (n, s = FINE) => { const g = raw(n, Math.max(s, FINE)); return g > sea ? g : sea + packIce(n, Math.max(s, FINE)); } : (n, s = FINE) => raw(n, Math.max(s, FINE));

  // --- Colours ---
  // The world's palette, as the land's own colours. On a world with seas of water, a palette
  // band as blue as the sea is the sea's colour, not the ground's: land in it could not be
  // told from water (blue hills, blue cliffs). Those bands become earth and pale rock,
  // keeping a fifth of the palette's tint. (body.palette itself is unchanged: sky, haze and
  // the colours of life still take the world's own key from it.)
  const EARTH = ['#75694f', '#8f8566', '#a39a84', '#bcb5a2'];
  const pal = body.palette.map(rgb).map((c, i) => liquid === 'water' && solvent === 'water' && c[2] > c[0] * 1.25 && c[2] > c[1] * 1.02 ? mix(rgb(EARTH[i]), c, .2) : c);
  const vegShift = vegetationShift(body.starTemperature || 5600);
  const lush = ph.life === 'simple' || ph.life === 'complex';
  const chem = ph.biochemistry || 'carbon';
  // Ground cover of non-carbon life: dark red tar-like growth on methane worlds,
  // pale waxy crusts on ammonia worlds, yellow-black sulfur growths, glassy silicon.
  const CHEM_VEG = { methane: '#5b2a2c', ammonia: '#8f93b8', sulfur: '#a88a2a', silicon: '#7aa3a6' };
  const baseVegetation = chem === 'carbon' ? shiftHue(rgb(ph.life === 'complex' ? '#4f7d43' : '#6d8a52'), vegShift.hue, vegShift.light) : rgb(CHEM_VEG[chem]);
  const vegT = chem === 'carbon' ? [255, 268, 305, 322] : [ph.temperature - 70, ph.temperature - 50, ph.temperature + 20, ph.temperature + 40];
  // The ground's plant cover takes the colours of the world's own plants (weighted by
  // how common each is, low growth counting most), so grass and trees match.
  let vegetation = baseVegetation;
  if (lush) {
    const species = floraFor(body).species;
    let sum = [0, 0, 0], weight = 0;
    for (const sp of species) {
      const w = sp.abundance * (['grass', 'shrub', 'moss', 'succulent'].includes(sp.form) ? 2 : 1);
      const leaf = mix(rgb(sp.colors.leaf), rgb(sp.colors.leaf2), .5);
      sum = sum.map((v, i) => v + leaf[i] * w); weight += w;
    }
    if (weight) vegetation = mix(baseVegetation, sum.map(v => v / weight * .82), .7);
  }
  const forest = vegetation.map(v => v * .72);
  // Only worlds with trees get a dark forest floor (new land); elsewhere it was dark blotches with nothing growing on them.
  const hasTrees = lush && floraFor(body).species.some((sp) => !sp.aquatic && sp.height >= 4);
  // Forest floor (new land): fallen needles and leaves, and deep moss in the hollows.
  const floorLitter = mix(rgb('#4a3826'), vegetation, .18), forestMoss = mix(vegetation, rgb('#2f4a24'), .5).map(v => v * .7);
  const sand = mix(rgb({ methane: '#7a5230', sulfur: '#d6c25a' }[solvent] || '#d8c79c'), pal[3], .3), snow = rgb(solvent === 'methane' ? '#c9a77c' : '#edf3f6'), iceColor = mix(rgb('#d6e8f1'), rgb(body.atmosphere), .12);
  const crust = rgb('#2b2020'), mats = mix(pal[1], rgb('#6c7a52'), .5);
  // Bare rock (cliffs, steep banks) and dry grass for patchy meadows.
  const rock = body.rock ? rgb(body.rock) : pal[0].map(v => v * .8);
  const cliff = (ground === 'rocky' ? mix(rock, pal[1], .2) : mix(rock, pal[1], .4)).map(v => v * .85).map((v, i) => body.landStyle !== 'classic' && ground === 'soft' ? v * .6 + [.58, .55, .5][i] * .4 : v); // (new land: earthy, paler banks on soft ground, not dark slate)
  // The rock of high mountains (new land): the world's rock, paler and nearer grey.
  const mountainRock = mix(rock, rgb('#a39d92'), .7).map(v => Math.min(1, v * 1.25));
  const dry = mix(vegetation, chem === 'carbon' ? rgb('#b8a660') : pal[2], .55);
  const iceBlue = mix(rgb('#8fc0dc'), rgb(body.atmosphere), .15), sulfurCrust = mix(pal[3], rgb('#e8d25a'), .35);
  const SEA = { water: '#15506e', methane: '#2e2116', ammonia: '#5d7f86', sulfur: '#b9731a' };
  const waterColor = liquid === 'lava' ? rgb('#ff5a1f') : mix(rgb(SEA[solvent] || SEA.water), rgb(body.atmosphere), .1);
  const lo = liquid === 'water' || liquid === 'lava' ? sea : minH, span = Math.max(1, maxH - lo);
  const baseT = ph.temperature;
  // Colder with height: the classic land kept its relief low, so 2.2 K a metre; the new
  // land's tallest peaks end up about 38 K colder than the coast, snow-capped on mild worlds.
  const lapse = LAND ? Math.min(2.2, 40 / Math.max(10, maxH - lo)) : 2.2;
  // Frost: water snow below freezing; on worlds with methane or ammonia seas, frost of those near the poles.
  const frostT = solvent === 'methane' || solvent === 'ammonia' ? baseT - 20 : 266;
  function ramp(t) {
    const f = Math.min(2.999, Math.max(0, t * 3)), i = Math.floor(f);
    return mix(pal[i], pal[i + 1], f - i);
  }
  // Local climate at a surface point; colours and plant life both read it.
  function climate(n, h = height(n)) {
    const lat = Math.abs(n.x * axis[0] + n.y * axis[1] + n.z * axis[2]);
    const above = liquid === 'water' || liquid === 'lava' ? h - sea : h - minH * .5;
    const localT = baseT + 16 - 70 * lat * lat - Math.max(0, above) * lapse; // poles and peaks are colder
    const moist = .5 + .5 * fbm(nC, n.x * 2.2 + 40, n.y * 2.2, n.z * 2.2, 3) + (liquid === 'water' ? .25 * smooth(8, 0, above) : 0);
    const submerged = (liquid === 'water' || liquid === 'lava') ? h < sea : liquid === 'ice' && h <= sea + .5;
    // Stands: where the woods grow thick and where they open into glades, a hundred metres
    // or two across (flora.mjs plantBiome reads it on the new land; -1..1).
    const stand = fbm(nE, n.x * RM / 170 + 71, n.y * RM / 170, n.z * RM / 170, 2) * 1.6;
    return { lat, above, localT, moist, submerged, altitude: (h - lo) / span, stand };
  }
  // shape (optional, from the mesh): { slope: 0 flat..1 vertical, hollow: + in hollows, - on crests }.
  // info (optional): filled with how much grass, bare rock and snow the point has (0..1),
  // which ground cover (groundcover.js) uses to decide what grows there.
  // City colours: pale paving and roofs tinted by the builders' own colours, darker streets.
  const tint = urban ? rgb(urban.species.colors?.accent || '#888888') : [.5, .5, .5];
  const cityRoof = urban ? mix([.62, .62, .6], tint, .18) : null, cityRoof2 = urban ? mix([.42, .43, .45], tint, .1) : null, cityStreet = [.2, .21, .23];
  function color(n, h, shape, info) {
    let vegAmount = 0, bareAmount = 0, snowAmount = 0, woodAmount = 0;
    const clim = climate(n, h), { lat, above, localT, moist } = clim;
    // (New land: hollows count for less. The small hummocks on every slope made hollow and
    // crest flip from metre to metre, and with them dark moss and light grass, in stripes.)
    const slope = shape ? shape.slope : 0, hollow = shape ? Math.max(-.6, Math.min(.6, shape.hollow * (LAND ? .35 : 1))) : 0;
    const X = n.x * RM, Y = n.y * RM, Z = n.z * RM;
    // Colour noise finer than the mesh can show is faded out, like the bumps in micro().
    const sp = shape?.spacing ?? .6, w22 = bw(22, sp), w5 = bw(5, sp), w8 = bw(8, sp), w25 = bw(2.5, sp);
    // New land: most ground lies low under the tall ranges, so the colour ramp is eased (a
    // square-root-like curve) to keep the lowlands as varied as the gentler classic land was.
    let c = ramp(LAND ? Math.pow(Math.min(1, Math.max(0, (h - lo) / span)), .45) : (h - lo) / span);
    if (info) { info.veg = info.bare = info.snow = info.wood = 0; info.climate = null; info.shore = (liquid === 'water' || liquid === 'lava') && above < 1.2; }
    // Dry country on a living world: sunburnt grass and bare earth in broad patches, so
    // land without thick growth is not one flat colour.
    if (LAND && lush && liquid === 'water') {
      const p1 = smooth(-.25, .45, nB(X / 120 + 9, Y / 120, Z / 120 + 2)), p2 = smooth(-.2, .5, nC(X / 45 - 3, Y / 45 + 6, Z / 45));
      c = mix(c, dry, .55 * p1); c = mix(c, c.map(v => v * .8), .45 * p2);
    }
    // (The bed just under the waterline is nearly the beach's own sand, so the colour does not jump at the shore.)
    if (liquid === 'water' && h < sea) return mix(mix(pal[0], sand, .8), waterColor, Math.min(.7, (sea - h) / 8)).map(v => v * .9);
    if (liquid === 'water' && above < .9 && !LAND) c = sand; // (new land: a soft beach, below)
    else if (liquid === 'lava' && above < 1.2) c = mix(crust, rgb('#7a2a14'), smooth(1.2, 0, above));
    else if (liquid === 'ice' && h <= sea + .5) c = iceColor.map((v) => v * (.92 + .16 * smooth(sea, sea + .4, h))); // floes, their ridges a little brighter
    else {
      if (lush && localT > vegT[0] && localT < vegT[3]) {
        // Grass thins out on steep banks; drier patches, lusher hollows.
        const v = vegAmount = smooth(.35, .62, moist) * smooth(vegT[0], vegT[1], localT) * smooth(vegT[3], vegT[2], localT) * (1 - (LAND ? smooth(.1, .5, slope) : smooth(.14, .32, slope)));
        let g = mix(vegetation, dry, w22 > 0 ? smooth(0, .6, nD(X / 22, Y / 22, Z / 22)) * (LAND ? .4 : .85) * w22 : 0); // (new land: gentler dry patches; the shader adds finer variety)
        if (w5 > 0) g = mix(g, vegetation.map(x => x * 1.25), smooth(.2, .8, nD(X / 5 + 50, Y / 5, Z / 5)) * (LAND ? .22 : .6) * w5); // (new land: subtler, so hills don't read as blotches from afar)
        g = mix(g, forest.map(x => x * .85), smooth(0, LAND ? .35 : .2, hollow) * (LAND ? .45 : .85));
        // New land: meadows vary in hue over tens of metres (sunburnt, golden, cool and
        // lush), the way real grassland does, rather than one even green.
        if (LAND) {
          const warm = smooth(-.1, .5, nB(X / 70 + 13, Y / 70, Z / 70)), cool = smooth(.1, .6, nC(X / 40 - 7, Y / 40, Z / 40 + 3));
          g = mix(g, [g[0] * 1.2 + .02, g[1] * 1.07, g[2] * .72], warm * .45);
          g = mix(g, [g[0] * .82, g[1] * .98, g[2] * 1.1], cool * .3 * (1 - warm));
        }
        c = mix(c, LAND ? mix(g, forest, (hasTrees ? .55 : .25) * smooth(.6, .8, moist)) : moist > .7 ? mix(g, forest, .65) : g, v * .9); // (new land: no hard edge where it turns wet)
        // New land: under the woods (flora.mjs plantBiome) the floor is dark moss and
        // fallen needles and leaves, not meadow; darkest in the old heart of a forest.
        if (LAND && chem === 'carbon' && hasTrees) {
          const wood = woodAmount = smooth(.53, .6, moist + .09 * clim.stand) * (.55 + .45 * smooth(.62, .72, moist + .09 * clim.stand)) * smooth(-.85, -.1, clim.stand) * smooth(vegT[0], vegT[1] + 6, localT) * smooth(.66, .6, clim.altitude);
          if (wood > 0) {
            const litter = w5 > 0 ? .4 + (smooth(-.1, .5, nD(X / 6 + 20, Y / 6, Z / 6)) - .4) * w5 * .6 : .4; // (patches of litter, gentle: seen from the air they must not blotch)
            const floor = mix(mix(forest.map(x => x * .62), floorLitter, litter * .4), forestMoss, smooth(.1, .45, hollow + .15) * .3);
            c = mix(c, floor, wood * .92 * (1 - smooth(.25, .5, slope)));
          }
        }
      } else if (ph.life === 'microbial' && liquid === 'water' && above < 4) c = mix(c, mats, .35);
      // Alpine meadow: above the woods the grass turns short, pale and golden.
      if (LAND && vegAmount > 0 && clim.altitude > .4) c = mix(c, mix(dry, rgb('#b9b27a'), .25), smooth(.4, .7, clim.altitude) * vegAmount * .55);
      // Bare rock where the ground is steep, banded into layers.
      // New land: high in the mountains rock shows through on gentler slopes too, crags and
      // faces bare, the ridges' flanks in broken rock and grass.
      const alpine = LAND ? smooth(.42, .72, clim.altitude) : 0;
      // (New land: wide transitions, so the small hummocks on a mountainside don't flip the
      // ground between grass and rock from metre to metre, which striped the slopes.)
      const bare = bareAmount = ground === 'rocky' || ground === 'volcanic' ? smooth(.08, .26, slope) : LAND && ground === 'ice' ? smooth(.3, .55, slope)
        : LAND ? smooth(.12 - .1 * alpine, .55 - .2 * alpine, slope + (w8 > 0 ? alpine * .05 * w8 * nD(X / 9 + 3, Y / 9, Z / 9) : 0)) : smooth(.2, .42, slope);
      if (bare > 0) {
        // Bands follow the height, so on a steep face they lie close together across the
        // ground: faded out once the mesh is too coarse to draw them there (on tall slopes
        // seen from afar they showed as rippling stripes).
        const steep = Math.sqrt(Math.max(0, 1 / ((1 - Math.min(.99, slope)) ** 2) - 1)), across = (p) => bw(p / Math.max(.15, steep), sp);
        // New land: no height bands at all. Drawn on slopes they read as even stripes across
        // whole mountainsides, not as rock; the rock's own patchiness (below) breaks it up instead.
        const band = LAND ? .9 + .14 * (w8 > 0 ? w8 * nD(X / 7 + 2, Y / 11, Z / 7) : 0) + .08 * nB(X / 30, Y / 30 + 4, Z / 30) : .945 + w8 * .25 * Math.sin(h * 1.6 + 3 * nD(X / 40, Y / 40, Z / 40));
        // New land: high up the rock is the mountains' own, paler and greyer, in layered
        // strata a few metres thick that wander across the faces.
        const rk = alpine > 0 ? mix(cliff, mountainRock, alpine * .8) : cliff;
        const strata = 1;
        c = mix(c, rk.map(x => x * band * strata), bare * (.85 + .1 * alpine));
      }
      // Scree: broken rock gathered at the foot of the crags, in the hollows below them.
      if (alpine > 0 && bare < .6 && ground !== 'ice') c = mix(c, mountainRock.map(x => x * 1.08), alpine * smooth(.02, .3, slope) * smooth(-.15, .35, hollow) * (1 - bare) * .55);
      // Snow slides off steep slopes and gathers in hollows.
      if (localT < frostT && (ph.pressure > .01 || ph.volatiles > .2) && liquid !== 'lava') c = mix(c, snow, (snowAmount = Math.min(1, smooth(frostT, frostT - 18, localT) * (1 - (LAND && ground === 'ice' ? smooth(.32, .58, slope) : smooth(.18, .4, slope))) * (1 + smooth(0, .2, hollow) * .3))) * .92);
    }
    // New land: beaches blend into the land instead of switching at a fixed height (which
    // drew blocky, stepped edges wherever the ground lay near that height). How far up the
    // sand reaches wanders along the coast, sand gives way to grass raggedly, and steep
    // banks and cliffs get none.
    if (LAND && liquid === 'water' && WETLAND) {
      // Wetland: no beaches; the land at the water's edge is dark mud and reeds.
      const edge = smooth(2.2, .2, above);
      if (edge > 0) c = mix(c, mix(rgb('#2e3a22'), pal[1], .35), edge * .7);
    } else if (LAND && liquid === 'water') {
      const reach = 1.1 + .8 * nB(X / 90 + 4, Y / 90, Z / 90) + (w5 > 0 ? .35 * w5 * nD(X / 4 + 13, Y / 4, Z / 4) : 0);
      // (The band from sand to land is at least a couple of mesh cells wide on the slope it
      // lies on: narrower than that, the mesh drew its edge as a row of saw teeth.)
      const grad = Math.sqrt(Math.max(0, 1 / Math.max(.05, 1 - slope) ** 2 - 1)), wide = Math.min(7, 2.2 * sp * grad);
      const sandK = smooth(reach + wide, reach * .45, above) * (1 - smooth(.3, .6, slope));
      if (sandK > 0) { c = mix(c, sand, sandK); vegAmount *= 1 - sandK; woodAmount *= 1 - sandK; }
    }
    // Salt flats: white crust split into polygons by its cracks.
    if (saltLevel !== null && h <= saltLevel + .06 && h > saltLevel - .4 && slope < .04) { // (the flat floor only, not a channel or a slope)
      const k = bw(5, sp);
      let edge = 1;
      if (k > 0) {
        const X5 = X / 5, Y5 = Y / 5, Z5 = Z / 5, ix = Math.floor(X5), iy = Math.floor(Y5), iz = Math.floor(Z5);
        let f1 = 9, f2 = 9;
        for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) for (let c2 = -1; c2 <= 1; c2++) { const cx = ix + a, cy = iy + b2, cz = iz + c2, dx = cx + hash01(cx, cy, cz, 5) - X5, dy = cy + hash01(cx, cy, cz, 6) - Y5, dz = cz + hash01(cx, cy, cz, 7) - Z5, d = dx * dx + dy * dy + dz * dz; if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
        edge = 1 - .3 * k * Math.exp(-(((Math.sqrt(f2) - Math.sqrt(f1)) / .06) ** 2));
      }
      c = mix(rgb('#eee8dc'), pal[3], .12).map((v) => v * edge * (.96 + .06 * nB(X / 40, Y / 40, Z / 40)));
    }
    // Amethyst: crystal on the crests, lining the geodes and in the shattered fields.
    if (AMETHYST && !(liquid === 'water' && h < sea)) {
      const cry = rgb(body.crystal || '#dec0ff');
      c = mix(c, cry.map((v) => v * 1.05), smooth(-.05, -.3, hollow) * smooth(.15, .45, slope) * .55); // crests and steep faces
      const { d } = geodeAt(n.x, n.y, n.z);
      if (d < 1.1) c = mix(c, mix(cry, rgb('#ffffff'), .25 * smooth(.95, .5, d)), smooth(1.1, .85, d) * .85);
      const m = shatterMask(n.x, n.y, n.z);
      if (m > 0 && w8 > 0) { const f = facetAt(X, Y, Z); c = mix(c, cry.map((v) => v * (.7 + .5 * f.id)), m * .6 * w8); c = c.map((v) => v * (1 - .35 * m * w8 * Math.exp(-((f.edge / .06) ** 2)))); }
      c = c.map((v) => Math.min(1, v));
    }
    // Barren: dark old lava plains in the low basins; bright rays and ejecta round young craters.
    if (BARREN) {
      c = mix(c, c.map((v) => v * .55), smooth(.25, .05, (h - lo) / span) * smooth(-.1, .3, nB(n.x * 2.3 + 4, n.y * 2.3, n.z * 2.3)) * .8);
      for (const k of craters) {
        if (!k.rays) continue;
        const d = Math.sqrt(Math.max(0, 2 * (1 - (n.x * k.c[0] + n.y * k.c[1] + n.z * k.c[2])))) / k.r;
        if (d > 6) continue;
        // Rays: narrow streaks out from the crater, fading with distance; a bright blanket close in.
        const cx = k.c, h0 = Math.abs(cx[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
        const ex = cx[1] * h0[2] - cx[2] * h0[1], ey = cx[2] * h0[0] - cx[0] * h0[2], ez = cx[0] * h0[1] - cx[1] * h0[0], el = Math.hypot(ex, ey, ez);
        const fx = cx[1] * ez - cx[2] * ey, fy = cx[2] * ex - cx[0] * ez, fz = cx[0] * ey - cx[1] * ex;
        const ang = Math.atan2((n.x * fx + n.y * fy + n.z * fz) / el, (n.x * ex + n.y * ey + n.z * ez) / el);
        const ray = Math.pow(Math.max(0, (nE(Math.cos(ang) * 2.5 + k.seed, Math.sin(ang) * 2.5, d * .15) + .5 * nE(Math.cos(ang) * 7, Math.sin(ang) * 7 + k.seed, 1.1)) * .45 + .5), 3.2) * smooth(6, 1.2, d) * .8;
        const blanket = smooth(2, 1, d) * (d > .9 ? 1 : .3);
        c = mix(c, mix(c, [1, 1, 1], .55), Math.min(1, ray * 1.6 + blanket * .6));
      }
    }
    // Ground-specific touches in cracks and hollows.
    if (ground === 'ice') c = mix(c, iceBlue, Math.min(.75, smooth(.04, .3, hollow) * .7 + smooth(.12, .35, slope) * (LAND ? .25 : .45))); // (new land is steeper: less blue on its slopes)
    else if (ground === 'toxic') {
      c = mix(c, sulfurCrust, smooth(.04, .3, hollow) * .55);
      if (TOXIC && !(liquid === 'water' && h < sea)) {
        // Bleached crust on the flats.
        c = mix(c, mix(rgb('#e6dcc2'), pal[3], .25), smooth(.06, .02, slope) * smooth(.2, .6, fbm(nB, X / 700 + 6, Y / 700, Z / 700, 2)) * .4);
        // Mineral springs: a blue-green pool, then yellow, orange and rust rings outward.
        const { d } = springAt(n.x, n.y, n.z);
        if (d < 1.15) {
          const ring = d < .14 ? rgb('#1fa3a8') : d < .32 ? mix(rgb('#9fd3a0'), rgb('#e8d24a'), smooth(.14, .32, d)) : d < .6 ? mix(rgb('#e8d24a'), rgb('#e0782a'), smooth(.32, .6, d)) : mix(rgb('#e0782a'), rgb('#6e3420'), smooth(.6, 1, d));
          c = mix(c, ring.map((v) => v * (.9 + .15 * smooth(.02, .0, slope))), smooth(1.15, .9, d) * .9);
        }
        // Acid pools.
        const pd = poolAt(n.x, n.y, n.z);
        if (pd < 1.2) c = mix(c, chem === 'sulfur' ? rgb('#d6e04a') : mix(rgb('#7fe06a'), rgb(body.atmosphere), .25), smooth(1.15, .85, pd) * .92);
      }
    }
    else if (ground === 'volcanic' && !(liquid === 'lava' && above < 1.2)) {
      c = mix(c, crust, smooth(.05, .35, hollow) * .6);
      // Fresh lava flows: black, glassy basalt; on the most active worlds, still glowing in its cracks.
      if (VOLCANIC) {
        const fl = flowAt(n.x, n.y, n.z);
        if (fl > 0) {
          c = mix(c, rgb('#17151a'), smooth(0, .4, fl) * .85);
          if (ph.volcanism > .55 && w5 > 0) c = mix(c, rgb('#ff5a1f'), smooth(.55, .95, 1 - Math.abs(nD(X / 6 + 2, Y / 6, Z / 6))) * smooth(.3, .8, fl) * w5 * .55 * ph.volcanism);
        }
      }
    }
    // A city world's city: paving and rooftops in a grid of blocks, parks left green.
    if (urban && !(Number.isFinite(sea) && h < sea + .9)) {
      const m = urban.mask(n);
      if (m > 0) {
        // (no painted grid: the streets and squares are laid by the city itself, structures-mesh.js;
        // the ground between is worn, tended land in the builders' tint, parks left green)
        const park = urban.park(n);
        const city = park ? mix(c, [.25, .45, .2], .5) : mix(c, mix(cityRoof, cityRoof2, .5 + .5 * nB(X / 30, Y / 30, Z / 30)), .35);
        c = mix(c, city, m * (park ? .6 : .8));
        if (info) { vegAmount *= park ? 1 : 1 - m; bareAmount *= 1 - m; }
      }
    }
    if (info) { info.veg = vegAmount; info.bare = bareAmount; info.snow = snowAmount; info.wood = woodAmount; info.climate = clim; }
    // Light catches crests and edges; hollows are darker.
    const lit = 1 - hollow * .6;
    const grain = (.93 + .1 * nB(n.x * 23, n.y * 23, n.z * 23)) * (w25 > 0 ? 1 + .12 * w25 * nD(X / 2.5, Y / 2.5 + 70, Z / 2.5) : 1) * lit;
    return [c[0] * grain, c[1] * grain, c[2] * grain];
  }
  // The signal site: the nearest dry, fairly level ground to the generated signal
  // point, found by searching outward in a spiral (it is never under water or lava).
  const R = body.radius || 180, liquidAt = (n) => (liquid === 'water' || liquid === 'lava') && raw(n) < sea + 1;
  const slope = (n) => {
    const e = 6 / R, a = { x: n.x + e, y: n.y, z: n.z }, b = { x: n.x, y: n.y + e, z: n.z }, c = { x: n.x, y: n.y, z: n.z + e };
    const u = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const h0 = raw(n);
    return Math.max(Math.abs(raw(u(a)) - h0), Math.abs(raw(u(b)) - h0), Math.abs(raw(u(c)) - h0)) / 6;
  };
  let site = body.signal;
  {
    const s0 = { x: body.signal[0], y: body.signal[1], z: body.signal[2] };
    const helper = Math.abs(s0.y) < .9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let ux = s0.y * helper.z - s0.z * helper.y, uy = s0.z * helper.x - s0.x * helper.z, uz = s0.x * helper.y - s0.y * helper.x;
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = s0.y * uz - s0.z * uy, vy = s0.z * ux - s0.x * uz, vz = s0.x * uy - s0.y * ux;
    let best = null, bestScore = Infinity;
    for (let i = 0; i < 400; i++) {
      const ang = i * 2.39996, dist = Math.sqrt(i) * 14 / R; // ~14 m apart, out to ~280 m
      const p = { x: s0.x + (ux * Math.cos(ang) + vx * Math.sin(ang)) * dist, y: s0.y + (uy * Math.cos(ang) + vy * Math.sin(ang)) * dist, z: s0.z + (uz * Math.cos(ang) + vz * Math.sin(ang)) * dist };
      const l = Math.hypot(p.x, p.y, p.z); p.x /= l; p.y /= l; p.z /= l;
      if (liquidAt(p)) continue;
      const score = slope(p) * 4 + dist * R / 120;
      if (score < bestScore) { bestScore = score; best = p; }
      if (best && i > 40 && bestScore < .9) break;
    }
    // Ocean worlds: if there is no dry ground nearby, keep searching farther out, to the
    // nearest land of any size (otherwise the site, the pad and every herd would be at sea).
    // (New land: the seas are open water between whole continents, so the search covers
    // the whole world, about evenly, instead of stopping a couple of kilometres out.)
    for (let i = 0; !best && i < 6000; i++) {
      const ang = i * 2.39996, dist = LAND ? 280 / R + (Math.PI * .995 - 280 / R) * Math.sqrt(i / 6000) : (280 + Math.sqrt(i) * 30) / R;
      if (dist > Math.PI * .9 && !LAND) break;
      const c = Math.cos(dist), sn = Math.sin(dist);
      const p = { x: s0.x * c + (ux * Math.cos(ang) + vx * Math.sin(ang)) * sn, y: s0.y * c + (uy * Math.cos(ang) + vy * Math.sin(ang)) * sn, z: s0.z * c + (uz * Math.cos(ang) + vz * Math.sin(ang)) * sn };
      const l = Math.hypot(p.x, p.y, p.z); p.x /= l; p.y /= l; p.z /= l;
      if (!liquidAt(p) && slope(p) < .5) best = p;
    }
    // Sea builders (their towns stand on the sea floor, settlements.mjs): land on a shore
    // with deep water close offshore, so their capital is just out from the pad instead of
    // wherever the nearest deep water happens to be (often a kilometre or more away).
    let seaFolk = null;
    try { const c = civilizationOf(body); if (c && (c.underwater || c.species?.aquatic) && !c.spaceborne && liquid === 'water') seaFolk = c; } catch { /* none */ }
    if (seaFolk) {
      const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
      const around = (p, d, a) => {
        const h = Math.abs(p.y) < .9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
        const e = unit({ x: p.y * h.z - p.z * h.y, y: p.z * h.x - p.x * h.z, z: p.x * h.y - p.y * h.x }), f = { x: p.y * e.z - p.z * e.y, y: p.z * e.x - p.x * e.z, z: p.x * e.y - p.y * e.x };
        const t = d / R, c = Math.cos(t), sn = Math.sin(t), ca = Math.cos(a), sa = Math.sin(a);
        return unit({ x: p.x * c + (e.x * ca + f.x * sa) * sn, y: p.y * c + (e.y * ca + f.y * sa) * sn, z: p.z * c + (e.z * ca + f.z * sa) * sn });
      };
      // Deep water within reach of the shore, deep enough for their towns (settlements.mjs wants 4.5 m).
      const shore = (p) => { let deep = 0; for (const d of [70, 120, 180]) for (let j = 0; j < 12; j++) if (sea - raw(around(p, d, j / 12 * Math.PI * 2 + d)) > 6) deep++; return deep >= 6; };
      for (let i = 0; i < 2500; i++) {
        const ang = i * 2.39996, dist = Math.sqrt(i) * 45 / R; // out to ~2.2 km
        if (dist > Math.PI * .9) break;
        const c = Math.cos(dist), sn = Math.sin(dist);
        const p = unit({ x: s0.x * c + (ux * Math.cos(ang) + vx * Math.sin(ang)) * sn, y: s0.y * c + (uy * Math.cos(ang) + vy * Math.sin(ang)) * sn, z: s0.z * c + (uz * Math.cos(ang) + vz * Math.sin(ang)) * sn });
        if (liquidAt(p) || slope(p) > .45 || !shore(p)) continue;
        best = p;
        break;
      }
    }
    if (best) site = [best.x, best.y, best.z];
  }
  // The landing pad: about 30 m from the site, where the game has always put it (the
  // site's "up" turned to point (0, 1, 30/R)), unless that is in water, lava or on a
  // steep slope; then the nearest dry, level ground beside the site. Never at sea.
  let landing;
  {
    const n0 = site.map(v => v / Math.hypot(...site)), c = n0[1], sx = { x: n0[0], y: n0[1], z: n0[2] };
    const unit = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const v = unit({ x: 0, y: 1, z: 30 / R });
    let pad;
    if (c > 1 - 1e-9) pad = v;
    else if (c < -1 + 1e-9) pad = { x: v.x, y: -v.y, z: -v.z };
    else {
      const kl = Math.hypot(n0[2], n0[0]), k = { x: n0[2] / kl, y: 0, z: -n0[0] / kl }, sn = Math.sqrt(1 - c * c);
      const kv = { x: k.y * v.z - k.z * v.y, y: k.z * v.x - k.x * v.z, z: k.x * v.y - k.y * v.x }, kd = k.x * v.x + k.y * v.y + k.z * v.z;
      pad = unit({ x: v.x * c + kv.x * sn + k.x * kd * (1 - c), y: v.y * c + kv.y * sn + k.y * kd * (1 - c), z: v.z * c + kv.z * sn + k.z * kd * (1 - c) });
    }
    const good = (p) => !liquidAt(p) && slope(p) < .35;
    if (!good(pad)) {
      const helper = Math.abs(sx.y) < .9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      let ax = sx.y * helper.z - sx.z * helper.y, ay = sx.z * helper.x - sx.x * helper.z, az = sx.x * helper.y - sx.y * helper.x;
      const al = Math.hypot(ax, ay, az); ax /= al; ay /= al; az /= al;
      const bx = sx.y * az - sx.z * ay, by = sx.z * ax - sx.x * az, bz = sx.x * ay - sx.y * ax;
      let best = null, bestScore = Infinity;
      for (let d = 18; d <= 90; d += 6) for (let j = 0; j < 16; j++) {
        const a = j / 16 * Math.PI * 2, t = d / R, cc = Math.cos(t), ss = Math.sin(t);
        const p = unit({ x: sx.x * cc + (ax * Math.cos(a) + bx * Math.sin(a)) * ss, y: sx.y * cc + (ay * Math.cos(a) + by * Math.sin(a)) * ss, z: sx.z * cc + (az * Math.cos(a) + bz * Math.sin(a)) * ss });
        if (liquidAt(p)) continue;
        const score = slope(p) * 4 + Math.abs(d - 30) * .02;
        if (score < bestScore) { bestScore = score; best = p; }
      }
      pad = best || sx;
    }
    landing = [pad.x, pad.y, pad.z];
  }
  // The levelled ground under towns and cities (see levelled, above).
  try {
    const civ = civilizationOf(body);
    if (civ && civ.level >= 3 && !civ.underwater && !civ.species?.aquatic && civ.family !== 'drifters') {
      const net = networkFor(body, civ, { isLiquid, surface, height, site, landing, sea, liquid });
      for (const st of net.settlements) {
        const c = st.n, r = st.radius * 1.04, fall = 14 + st.radius * .25, hs = [];
        const e = Math.abs(c[1]) < .9 ? [c[2], 0, -c[0]] : [0, -c[2], c[1]], el = Math.hypot(...e), ex = e.map((v) => v / el);
        const ny = [c[1] * ex[2] - c[2] * ex[1], c[2] * ex[0] - c[0] * ex[2], c[0] * ex[1] - c[1] * ex[0]];
        const at = (d, a) => { const t = d / RM, dir = [0, 1, 2].map((i) => ex[i] * Math.cos(a) + ny[i] * Math.sin(a)); const v = [0, 1, 2].map((i) => c[i] * Math.cos(t) + dir[i] * Math.sin(t)); const l = Math.hypot(...v); return { x: v[0] / l, y: v[1] / l, z: v[2] / l }; };
        for (const f of [0, .5, 1]) for (let j = 0; j < (f ? 8 : 1); j++) { const p = at(r * f, j / 8 * Math.PI * 2); if (!isLiquid(p)) hs.push(height(p)); }
        if (!hs.length) continue;
        hs.sort((a, b) => a - b);
        let h = hs[Math.floor(hs.length / 2)];
        if (Number.isFinite(sea) && liquid === 'water') h = Math.max(h, sea + 1.2);
        const L = { n: c, r, fall, h, cosOut: Math.cos((r + fall) / RM) };
        levels.push(L);
        const cells = new Set();
        for (const f of [0, .35, .7, 1]) for (let j = 0; j < 24; j++) { const p = at((r + fall) * f, j / 24 * Math.PI * 2); cells.add(cellOf(p.x, p.y, p.z)); }
        for (const k of cells) (levelCells.get(k) || levelCells.set(k, []).get(k)).push(L);
      }
    }
  } catch (e) { /* no civilization to level for */ }
  // rockColor: bare rock as it shows on cliffs (sRGB), for rocks and formations to match.
  return { volcanoes, atolls, isles, raw, height, surface, meshHeight, isLiquid, color, climate, sea, liquid, solvent, coverage, minH, maxH, waterColor, site, landing, lush, ground, airless, rockColor: cliff, vegetation, landform: LAND ? L : null, landTop, windDir: ground === 'sand' && LAND ? windDir : null };
}
