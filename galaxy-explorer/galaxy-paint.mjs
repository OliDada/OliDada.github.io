// The galaxy seen from far outside: a painted image for the most zoomed-out map (starmap.js).
// Starlight from the disc, blue where the arms' young stars burn, a warm old bulge with a
// blazing nucleus, dark dust lanes along the inner edge of each arm, pink star-forming
// knots and blue clusters strung along the arms, and a faint halo. Pure and deterministic
// (the same galaxy for everyone); returns opaque RGBA bytes, n × n, covering VISUAL_EXTENT.
import { GALAXY, VISUAL_EXTENT } from './galaxy.mjs';
import { rng } from './rng.mjs';

const BG = [4, 9, 17];
// Small value-noise fbm (enough for wisps and clumps at this scale).
function makeNoise(seed) {
  const P = new Uint8Array(512), r = rng(seed, 'galaxy-paint-noise');
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x, y) => P[P[x & 255] + (y & 255)] / 255;
  const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, y, oct = 4) => { let s = 0, amp = .5, f = 1; for (let o = 0; o < oct; o++) { s += amp * n2(x * f + o * 17.3, y * f - o * 9.1); f *= 2.03; amp *= .5; } return s / (1 - .5 ** oct); };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function paintGalaxy(n = 1024) {
  const G = GALAXY, R = G.radius, B = G.bulgeRadius, noise = makeNoise(G.seed);
  const tanP = Math.tan(G.pitch), E = VISUAL_EXTENT, px = E / n;
  const L = new Float32Array(n * n * 3); // linear light
  const armPhase = (x, y, r) => G.arms * (Math.atan2(y, x) - Math.log(Math.max(r, 1) / 1000) / tanP) + G.armOffset;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + .5) / n * E - E / 2, y = E / 2 - (j + .5) / n * E, r = Math.hypot(x, y), k = (j * n + i) * 3;
    const edge = r > R ? Math.exp(-(((r - R) / 2600) ** 2)) : 1;
    const disk = Math.exp(-r / (.3 * R)) * edge;
    // Arms, with their edges feathered by noise into spurs and wisps.
    const w = noise(x / 2600, y / 2600, 5), fine = noise(x / 700, y / 700, 3);
    const ph = armPhase(x, y, r) + (w - .5) * 1.0;
    const inArm = smooth(B * .6, B * 1.7, r);
    const c = .5 + .5 * Math.cos(ph);
    const arm = (c ** 7 * 1.2 + c ** 2 * .25) * inArm; // a bright crest in a broad soft glow
    const spur = 0;
    // Dust: a dark lane hugging the inner edge of each arm, clumpy, and dust patches in the disc.
    const lane = (.5 + .5 * Math.cos(ph - .62)) ** 14 * inArm * (.55 + .7 * noise(x / 900 + 40, y / 900, 4));
    const dust = Math.min(.92, (lane * 1.25 + smooth(.62, .9, noise(x / 1500 - 20, y / 1500, 4)) * .35 * inArm) * smooth(R * 1.05, R * .3, r));
    // Light: old warm disc, young blue arms, warm bulge, white-hot nucleus, faint round halo.
    const clump = noise(x / 1800 + 7, y / 1800 - 3, 4); // brighter and dimmer stretches along each arm
    const young = disk * arm * (.3 + 1.1 * fine ** 1.5) * (.45 + 1.3 * clump * clump) * 2.6;
    const old = disk * (.16 + .12 * arm) * (.7 + .6 * w);
    const bulge = 1.3 * Math.exp(-(r * r) / (B * .9) ** 2) + .45 * Math.exp(-(r * r) / (B * 1.9) ** 2) + 1.4 * Math.exp(-r / (B * .16));
    const halo = .025 * Math.exp(-r / (R * .55)) * smooth(R * 1.6, R * .2, r);
    const t = 1 - dust * smooth(B * .35, B * 1.1, r); // dust darkens all but the very core
    let cr = (young * .45 + old * 1 + bulge * 1.0) * t + halo * .8;
    let cg = (young * .66 + old * .82 + bulge * .82) * t + halo * .85;
    let cb = (young * 1.25 + old * .62 + bulge * .55) * t + halo * 1.1;
    // Dust glows a little red-brown where starlight catches it.
    const rim = lane * disk * .12; cr += rim; cg += rim * .45;
    L[k] = cr; L[k + 1] = cg; L[k + 2] = cb;
  }
  // Pink star-forming regions and blue clusters, strung along the arms' bright crests.
  const sr = rng(G.seed, 'galaxy-paint-knots'), add = (cx, cy, rad, c, s) => {
    const ci = (cx + E / 2) / px, cj = (E / 2 - cy) / px, rp = rad / px, m = Math.ceil(rp * 3);
    for (let dj = -m; dj <= m; dj++) for (let di = -m; di <= m; di++) {
      const i = Math.round(ci + di), j = Math.round(cj + dj); if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const f = s * Math.exp(-((i - ci) ** 2 + (j - cj) ** 2) / (rp * rp)), k = (j * n + i) * 3;
      L[k] += c[0] * f; L[k + 1] += c[1] * f; L[k + 2] += c[2] * f;
    }
  };
  for (let tries = 0, placed = 0; placed < 380 && tries < 40000; tries++) {
    const r = B * .9 + sr() ** .8 * (R * .95 - B * .9), th = sr() * Math.PI * 2, x = Math.cos(th) * r, y = Math.sin(th) * r;
    const ph = armPhase(x, y, r) + (noise(x / 2600, y / 2600, 5) - .5) * 1.0, arm = (.5 + .5 * Math.cos(ph)) ** 3;
    if (sr() > arm ** 5) continue;
    placed++;
    const disk = Math.exp(-r / (.3 * R)) * 6, pink = sr() < .6;
    const big = sr() ** 3;
    add(x, y, px * (.7 + big * 3.2), pink ? [1, .32, .62] : [.6, .78, 1.3], disk * (pink ? .8 : .7) * (.25 + big * 1.2));
  }
  // Tone map (soft shoulder, so the core blazes without clipping flat) onto the background.
  const out = new Uint8ClampedArray(n * n * 4), ex = 1.5;
  for (let p = 0; p < n * n; p++) {
    for (let c = 0; c < 3; c++) { const v = 1 - Math.exp(-L[p * 3 + c] * ex); out[p * 4 + c] = BG[c] + (255 - BG[c]) * v ** (1 / 1.25); }
    out[p * 4 + 3] = 255;
  }
  return out;
}
