// The settlement network of an intelligent species across its world: a capital near
// where you land, and, depending on its extent, towns, cities and villages spreading
// over a region, a continent or the whole planet, joined by roads. Pure and
// deterministic; structures-mesh.js builds the places near the site in detail and
// the rest as distant towns and night lights, and the star map summarises it.
import { rng } from './rng.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));
// A point `dist` metres from n along bearing `bearing` (radians), on a sphere of radius R.
function offset(n, dist, bearing, R) {
  let east = cross([0, 1, 0], n); if (Math.hypot(...east) < 1e-6) east = cross([1, 0, 0], n);
  east = norm(east); const north = cross(n, east), a = dist / R;
  const dir = [0, 1, 2].map(i => east[i] * Math.cos(bearing) + north[i] * Math.sin(bearing));
  return norm([0, 1, 2].map(i => n[i] * Math.cos(a) + dir[i] * Math.sin(a)));
}
// The terrain functions take {x, y, z} points.
const P = (n) => ({ x: n[0], y: n[1], z: n[2] });
export const slerp = (a, b, t) => { const w = angle(a, b); if (w < 1e-9) return a.slice(); const s = Math.sin(w); return norm([0, 1, 2].map(i => a[i] * Math.sin((1 - t) * w) / s + b[i] * Math.sin(t * w) / s)); };

// Where the game puts the landing pad: (0, 1, 30/R) turned from straight up onto the site
// (the same rotation as THREE's Quaternion.setFromUnitVectors(Y, site)).
export function landingOf(site, R) {
  const v = norm([0, 1, 30 / R]), c = site[1];
  if (c > 1 - 1e-9) return v;
  if (c < -1 + 1e-9) return [v[0], -v[1], -v[2]];
  const k = norm([site[2], 0, -site[0]]), sin = Math.sqrt(1 - c * c); // axis Y x site
  const kv = cross(k, v), kd = dot(k, v);
  return norm([0, 1, 2].map(i => v[i] * c + kv[i] * sin + k[i] * kd * (1 - c)));
}

// Size of each kind of place, in building units (scaled by the builders' size).
export const KINDS = {
  camp: { radius: 8 }, village: { radius: 13 }, town: { radius: 18 }, city: { radius: 28 },
  metropolis: { radius: 40 }, capital: { radius: 46 }, megacity: { radius: 66 }, colony: { radius: 14 },
};
const CAPITAL = { 'tool users': 'camp', 'village builders': 'village', metalworkers: 'village', 'city builders': 'city', industrial: 'city', 'planet-shapers': 'metropolis', orbital: 'metropolis', spacefarers: 'capital', 'system-shapers': 'megacity' };
// How many of each kind of place, by extent (before cohesion), and how far they reach (radians).
const SPREAD = {
  local: { reach: null, city: [0, 0], town: [0, 0], village: [1, 2] },
  regional: { reach: .45, city: [0, 0], town: [2, 4], village: [4, 8] },
  continental: { reach: 1.1, city: [2, 4], town: [6, 10], village: [10, 18] },
  planetary: { reach: Math.PI, city: [6, 10], town: [16, 26], village: [26, 42] },
  system: { reach: Math.PI, city: [7, 12], town: [18, 30], village: [26, 42] },
};
// The best kind a tier can build below its capital.
const ALLOWED = {
  'tool users': ['camp'], 'village builders': ['village'], metalworkers: ['village'], 'city builders': ['town', 'village'], industrial: ['city', 'town', 'village'], orbital: ['city', 'town', 'village'],
  'planet-shapers': ['city', 'town', 'village'], spacefarers: ['city', 'town', 'village'], 'system-shapers': ['city', 'town', 'village'],
};
export const MAX_RADIUS = 115; // metres: even giant builders' capitals fit beside the landing site
const kindsRoomy = (civ) => !['tool users'].includes(civ.tier);

// The world as sea-dwelling builders see it: open water deep enough to build in is their
// "dry land", and the ground is the sea floor. Everything that places settlements and
// buildings reads terrain through this, so the same code builds on the sea bed.
export function seaFloorTerrain(t) {
  if (t.underwater) return t;
  if (t.liquid !== 'water') return { ...t, underwater: true, isLiquid: () => true };
  const deep = (n) => t.sea - t.height(n) > 4.5; // deep enough that their tallest homes stay under water
  return { ...t, underwater: true, isLiquid: (n) => !deep(n), surface: (n) => t.height(n) };
}
const cache = new Map();
// civ: from civilizations.mjs; terrain: terrainFor(body). A colony (civ.colony) is a
// single outpost. Returns { capital, settlements: [{ id, kind, n, radius }], roads: [{ a, b }] }.
export function networkFor(body, civ, terrain, { colony = false } = {}) {
  const key = `${body.seed}:${body.id}:${civ.id}:${colony}`;
  if (cache.has(key)) return cache.get(key);
  if (civ.underwater) terrain = seaFloorTerrain(terrain);
  const R = body.radius, u = civ.unit, r = rng(body.seed, 'settlements', civ.id, colony ? 'colony' : 'home');
  const site = norm(terrain.site), landing = terrain.landing ? norm(terrain.landing) : landingOf(site, R);
  // Hand-builders' places are planned street by street (town-plan.mjs) and hold more: twice the room.
  // Every people that builds on the ground plans its towns (structures-mesh.js units).
  const planned = civ.family !== 'drifters' && !colony && !civ.underwater && !civ.species?.aquatic, roomy = planned && kindsRoomy(civ);
  const metres = (kind) => Math.min(roomy ? MAX_RADIUS * 2.2 : MAX_RADIUS, KINDS[kind].radius * u * (roomy ? 2 : 1) * (kind === 'megacity' || kind === 'capital' || kind === 'metropolis' || kind === 'city' ? .85 + .35 * civ.cohesion : 1));
  // How wet and how rough the ground is over a disc (0 = dry and level).
  const ground = (n, rad) => {
    let wet = 0, lo = Infinity, hi = -Infinity, k = 0;
    for (const f of [0, .5, 1]) for (let j = 0; j < (f ? 8 : 1); j++) {
      const m = f ? offset(n, rad * f, j / 8 * Math.PI * 2, R) : n; k++;
      if (terrain.isLiquid(P(m))) wet++; else { const h = terrain.surface(P(m)); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    }
    return { wet: wet / k, rough: hi > lo ? (hi - lo) / Math.max(rad, 1) : 0 };
  };
  const settlements = [];
  // The capital: open, dry, fairly level ground beside the landing site.
  const capKind = colony ? 'colony' : CAPITAL[civ.tier];
  let capital = null;
  // Capitals may sit on a coast or among hills (each building still avoids water and
  // cliffs); on crowded coasts and rugged worlds a smaller one will do.
  const shrinks = [1, .75, .55, .4];
  for (const shrink of shrinks) {
    const rad = metres(capKind) * shrink, last = shrink === shrinks.at(-1);
    let best = null, bestScore = Infinity, bestWet = 1;
    for (let d = rad * .6 + 40; d <= rad * .6 + 240; d += 12) for (let j = 0; j < 16; j++) {
      const n = offset(site, d, j / 16 * Math.PI * 2 + d * .07, R);
      if (angle(n, landing) * R < rad * .55 + 30 || terrain.isLiquid(P(n))) continue;
      const g = ground(n, rad), score = g.wet * 10 + g.rough * 3 + d * .004;
      if (score < bestScore) { bestScore = score; best = n; bestWet = g.wet; }
    }
    if (best && (bestScore < 4 || (last && bestWet < .7))) { capital = { id: 's0', kind: capKind, n: best, radius: rad }; break; }
  }
  // Ocean worlds may have no land near the site at all: the capital stands on the
  // nearest real land instead, seen from the air rather than beside the landing site.
  for (let d = 280; !capital && d <= Math.min(2600, Math.PI * R * .9); d += 45) for (let j = 0; j < 24 && !capital; j++) {
    const rad = metres(capKind) * .7, n = offset(site, d, j / 24 * Math.PI * 2 + d * .01, R);
    if (terrain.isLiquid(P(n))) continue;
    const g = ground(n, rad);
    if (g.wet < .45) capital = { id: 's0', kind: capKind, n, radius: rad, far: true };
  }
  if (!capital) { const out = { capital: null, settlements, roads: [] }; cache.set(key, out); return out; }
  settlements.push(capital);
  // Everything else, spreading as far as the civilization's extent.
  if (!colony) {
    const spread = SPREAD[civ.extent] || SPREAD.local, allowed = ALLOWED[civ.tier], many = 1.45 - civ.cohesion * .9;
    const want = [];
    for (const kind of ['city', 'town', 'village']) {
      const [a, b] = spread[kind]; let n = Math.round((a + r() * (b - a)) * many);
      if (!n) continue;
      const k = allowed.includes(kind) ? kind : allowed[allowed.length - 1];
      for (let i = 0; i < n; i++) want.push(k);
    }
    const reach = spread.reach ?? 220 / R; // local places stay within walking range
    let id = 1;
    for (const kind of want) {
      const rad = metres(kind);
      for (let t = 0; t < 40; t++) {
        // Bigger places tend to be nearer the capital; villages scatter widely.
        const span = reach * (kind === 'city' ? .7 : kind === 'town' ? .85 : 1);
        const a = Math.acos(1 - r() * (1 - Math.cos(Math.min(Math.PI, span)))), n = offset(capital.n, a * R, r() * Math.PI * 2, R);
        if (angle(n, site) * R < rad + 45 || angle(n, landing) * R < rad + 40) continue;
        if (settlements.some(s => angle(s.n, n) * R < (s.radius + rad) * 1.25 + 10)) continue;
        const g = ground(n, rad * .6);
        if (g.wet > .1 || g.rough > .9) continue;
        settlements.push({ id: `s${id++}`, kind, n, radius: rad });
        break;
      }
    }
  }
  // Roads: a spanning tree from the capital (shortest links first), skipping links
  // that would cross much water. Those that remain are drawn near the site.
  const roads = [], linked = new Set([0]);
  while (linked.size < settlements.length) {
    let best = null, bd = Infinity;
    for (const i of linked) for (let j = 0; j < settlements.length; j++) if (!linked.has(j)) { const d = angle(settlements[i].n, settlements[j].n); if (d < bd) { bd = d; best = [i, j]; } }
    linked.add(best[1]);
    const [a, b] = best.map(i => settlements[i]);
    let wet = 0; for (let k = 1; k < 24; k++) if (terrain.isLiquid(P(slerp(a.n, b.n, k / 24)))) wet++;
    if (wet <= 3) roads.push({ a: a.id, b: b.id, wet });
  }
  const out = { capital, settlements, roads };
  if (cache.size > 300) cache.clear();
  cache.set(key, out);
  return out;
}

// "a capital, 7 cities, 22 towns and 31 villages", for the star map.
export function describeNetwork(net) {
  const count = {}; for (const s of net.settlements.slice(1)) count[s.kind] = (count[s.kind] || 0) + 1;
  const k = net.capital?.kind, parts = [k === 'megacity' ? 'a towering capital' : k === 'capital' || k === 'metropolis' ? 'a capital' : k === 'city' ? 'a city' : k === 'colony' ? 'a colony' : `a main ${k || 'home'}`];
  for (const k of ['city', 'town', 'village', 'camp']) if (count[k]) parts.push(`${count[k]} ${k === 'city' && count[k] > 1 ? 'cities' : k + (count[k] > 1 ? 's' : '')}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
}
