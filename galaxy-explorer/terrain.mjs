// Planet surfaces. Seeded 3D simplex noise sampled on the unit sphere, shaped
// per biome (continents, ridges, dunes, craters, volcanoes). Sea level is set
// so the right share of the surface lies below it. Colour is decided per point
// from altitude, latitude, local temperature and moisture: beaches, vegetation,
// snow caps and lava shores all come from the world's physics.
import { rng } from './rng.mjs';
import { vegetationShift } from './biomes.mjs';

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
  const nA = makeNoise(body.seed, 'a'), nB = makeNoise(body.seed, 'b'), nC = makeNoise(body.seed, 'c');
  // Bigger worlds get taller relief (but not proportionally, or they would look spiky).
  const amp = 9 * Math.min(body.relief || 1, 2) * Math.min(1.8, Math.max(1, Math.sqrt((body.radius || 180) / 180)));
  const off = [r() * 100, r() * 100, r() * 100];
  const duneDir = [r() - .5, r() - .5, r() - .5];
  const craters = [], volcanoes = [];
  const randomUnit = () => { const y = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - y * y); return [Math.cos(a) * s, y, Math.sin(a) * s]; };
  for (let i = 0; i < (shape.craters || 0); i++) craters.push({ c: randomUnit(), r: .025 + .22 * r() ** 3, depth: .4 + r() * .6 });
  for (let i = 0; i < (shape.volcanoes || 0); i++) volcanoes.push({ c: randomUnit(), r: .1 + r() * .14, height: 1 + r() * .9 });
  // Spin axis. The signal site sits at a temperate latitude (not at a pole), so the
  // place you land shows the world's typical climate rather than its coldest corner.
  const sig = body.signal, other = randomUnit();
  let px = sig[1] * other[2] - sig[2] * other[1], py = sig[2] * other[0] - sig[0] * other[2], pz = sig[0] * other[1] - sig[1] * other[0];
  const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
  const siteLat = .05 + r() * .45, cosLat = Math.sqrt(1 - siteLat * siteLat);
  const axis = [sig[0] * siteLat + px * cosLat, sig[1] * siteLat + py * cosLat, sig[2] * siteLat + pz * cosLat];

  function raw(n) {
    const x = n.x, y = n.y, z = n.z;
    const cont = fbm(nA, x * 1.25 + off[0], y * 1.25 + off[1], z * 1.25 + off[2], 5);
    const ridge = ridged(nB, x * 2.4, y * 2.4, z * 2.4, 5, shape.sharp || 2);
    const detail = fbm(nC, x * 9, y * 9, z * 9, 5); // fine octaves matter once close-up detail can show them
    let h = cont * shape.continents + ridge * shape.mountains * smooth(-.15, .45, cont) + detail * shape.detail * 2;
    if (shape.dunes) {
      const along = (x * duneDir[0] + y * duneDir[1] + z * duneDir[2]) * 70 + 4 * fbm(nC, x * 3, y * 3, z * 3, 2);
      h += shape.dunes * (1 - Math.abs(Math.sin(along))) * smooth(.25, -.1, cont);
    }
    if (shape.cracks) h -= shape.cracks * (1 - smooth(0, .06, Math.abs(nC(x * 7, y * 7, z * 7))));
    for (const k of craters) {
      const d = Math.sqrt(Math.max(0, 2 * (1 - (x * k.c[0] + y * k.c[1] + z * k.c[2])))) / k.r;
      if (d < 1.8) h += k.depth * (d < 1 ? (d * d - 1) * .9 : 0) + k.depth * .35 * Math.exp(-(((d - 1) / .22) ** 2));
    }
    for (const v of volcanoes) {
      const d = Math.sqrt(Math.max(0, 2 * (1 - (x * v.c[0] + y * v.c[1] + z * v.c[2])))) / v.r;
      if (d < 1) h += v.height * ((1 - d) ** 1.6 - (d < .16 ? (.16 - d) * 3.5 : 0));
    }
    return h * amp;
  }

  // Statistics: range and sea level from the shape of the whole world.
  const samples = fibonacciSphere(700).map(raw).sort((a, b) => a - b);
  const minH = samples[0], maxH = samples[samples.length - 1];
  let liquid = null, coverage = 0;
  if (ph.waterState === 'liquid') { liquid = 'water'; coverage = ph.waterCoverage; }
  else if (body.biome === 'Volcanic' && ph.temperature > 230) { liquid = 'lava'; coverage = .06 + ph.volcanism * .12; }
  else if (ph.waterState === 'ice' && ph.waterCoverage > .3) { liquid = 'ice'; coverage = ph.waterCoverage * .55; }
  const sea = liquid ? samples[Math.min(samples.length - 1, Math.floor(coverage * samples.length))] : -Infinity;

  // The signal site is a flat plateau, raised above any sea so it is always reachable.
  const signal = { x: body.signal[0], y: body.signal[1], z: body.signal[2] };
  const plateauInner = 40 / (body.radius || 180), plateauOuter = 90 / (body.radius || 180); // ~40 m flat, easing out to ~90 m
  // Capped at a moderate altitude so the site is not on a cold summit.
  const ground = liquid === 'water' || liquid === 'lava' ? sea : minH;
  const siteHeight = Math.max(Math.min(raw(signal), ground + (maxH - ground) * .35), liquid === 'water' || liquid === 'lava' ? sea + 1.8 : -Infinity);
  function height(n) {
    const d = Math.hypot(n.x - signal.x, n.y - signal.y, n.z - signal.z);
    const t = smooth(plateauInner, plateauOuter, d);
    return t >= 1 ? raw(n) : siteHeight + (raw(n) - siteHeight) * t;
  }
  // The top surface: what a ship hovers over. Frozen seas are solid ground.
  const surface = liquid ? (n) => Math.max(height(n), sea) : height;
  const isLiquid = (n) => (liquid === 'water' || liquid === 'lava') && height(n) < sea;
  // The visible mesh: sea floor under liquid seas (drawn with a separate liquid sphere), ice on top of frozen ones.
  const meshHeight = liquid === 'ice' ? surface : height;

  // --- Colours ---
  const pal = body.palette.map(rgb);
  const vegShift = vegetationShift(body.starTemperature || 5600);
  const lush = ph.life === 'simple' || ph.life === 'complex';
  const vegetation = shiftHue(rgb(ph.life === 'complex' ? '#4f7d43' : '#6d8a52'), vegShift.hue, vegShift.light);
  const forest = vegetation.map(v => v * .72);
  const sand = mix(rgb('#d8c79c'), pal[3], .3), snow = rgb('#edf3f6'), iceColor = mix(rgb('#d6e8f1'), rgb(body.atmosphere), .12);
  const crust = rgb('#2b2020'), mats = mix(pal[1], rgb('#6c7a52'), .5);
  const waterColor = liquid === 'lava' ? rgb('#ff5a1f') : mix(rgb('#15506e'), rgb(body.atmosphere), .1);
  const lo = liquid === 'water' || liquid === 'lava' ? sea : minH, span = Math.max(1, maxH - lo);
  const baseT = ph.temperature;
  function ramp(t) {
    const f = Math.min(2.999, Math.max(0, t * 3)), i = Math.floor(f);
    return mix(pal[i], pal[i + 1], f - i);
  }
  // Local climate at a surface point; colours and plant life both read it.
  function climate(n, h = height(n)) {
    const lat = Math.abs(n.x * axis[0] + n.y * axis[1] + n.z * axis[2]);
    const above = liquid === 'water' || liquid === 'lava' ? h - sea : h - minH * .5;
    const localT = baseT + 16 - 70 * lat * lat - Math.max(0, above) * 2.2; // poles and peaks are colder
    const moist = .5 + .5 * fbm(nC, n.x * 2.2 + 40, n.y * 2.2, n.z * 2.2, 3) + (liquid === 'water' ? .25 * smooth(8, 0, above) : 0);
    const submerged = (liquid === 'water' || liquid === 'lava') ? h < sea : liquid === 'ice' && h <= sea + .01;
    return { lat, above, localT, moist, submerged, altitude: (h - lo) / span };
  }
  function color(n, h) {
    const { lat, above, localT, moist } = climate(n, h);
    let c = ramp((h - lo) / span);
    if (liquid === 'water' && h < sea) return mix(mix(pal[0], sand, .4), waterColor, Math.min(.7, (sea - h) / 8)).map(v => v * .85);
    if (liquid === 'water' && above < .9) c = sand;
    else if (liquid === 'lava' && above < 1.2) c = mix(crust, rgb('#7a2a14'), smooth(1.2, 0, above));
    else if (liquid === 'ice' && h <= sea + .01) c = iceColor;
    else {
      if (lush && localT > 255 && localT < 322) {
        const v = smooth(.35, .62, moist) * smooth(255, 268, localT) * smooth(322, 305, localT);
        c = mix(c, moist > .7 ? forest : vegetation, v * .9);
      } else if (ph.life === 'microbial' && liquid === 'water' && above < 4) c = mix(c, mats, .35);
      if (localT < 266 && (ph.pressure > .01 || ph.volatiles > .2) && liquid !== 'lava') c = mix(c, snow, smooth(266, 248, localT) * .92);
    }
    const grain = .93 + .1 * nB(n.x * 23, n.y * 23, n.z * 23);
    return [c[0] * grain, c[1] * grain, c[2] * grain];
  }
  return { raw, height, surface, meshHeight, isLiquid, color, climate, sea, liquid, coverage, minH, maxH, waterColor, siteHeight, lush };
}
