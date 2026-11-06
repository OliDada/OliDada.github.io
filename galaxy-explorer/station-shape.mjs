// The shape of a station's landing deck (station-deck.js draws it and runs its crew).
// Pure data, no Three.js, so it can be tested on its own.
//
// Every civilization's deck is its own: a union of simple pieces (discs, regular
// polygons and long rectangles) laid out to one of several plans, chosen from the
// builders' body family and varied by the seed:
//
//   disc     one round platform                 poly     a hexagon or octagon
//   ring     a walkable ring on spokes round a hub          cross    arms out from a hub, a pad at each end
//   spine    a long walkway with platforms along it         cluster  platforms linked by bridges
//   comb     hexagonal cells (hive builders)                petal    overlapping lobes (grown cultures)
//   web      spokes and rings of walkway (web spinners)
//
// Sizes run from about 38 m in radius (a modest orbital station) to well over a
// hundred metres; a spaceborne civilization's ark (megastation.js) is bigger still.
// The frame: +X faces the world below, +Z across, the floor at y = 0; x and z in metres.
import { rng } from './rng.mjs';

export const ARCHETYPES = ['disc', 'poly', 'ring', 'cross', 'spine', 'cluster', 'comb', 'petal', 'web'];
const FAMILY_PLANS = {
  hive: ['comb', 'comb', 'poly'], web: ['web', 'web', 'ring'], drifters: ['cluster', 'cluster', 'petal'], tentacles: ['petal', 'cluster', 'petal'],
  burrowers: ['petal', 'disc', 'ring'], nests: ['spine', 'cross', 'spine'], rollers: ['ring', 'ring', 'disc'], tripods: ['cross', 'poly', 'cross'],
  grazers: ['disc', 'poly', 'cluster', 'ring'], hands: ['poly', 'ring', 'cross', 'spine', 'cluster', 'disc'],
};
export const PAD_RADIUS = 6.2;

// How big a civilization builds: by tier, more for the ambitious. Never under 38 m.
export function stationSize(civ, r = Math.random, { mega = false } = {}) {
  const base = mega ? 125 : civ?.tier === 'system-shapers' ? 60 : civ?.tier === 'spacefarers' ? 46 : 38;
  const amb = civ?.ambition ?? .5;
  return Math.max(38, Math.round(base * (mega ? 1 + .35 * r() : .9 + .6 * amb + .3 * r())));
}

export function designStation(civ, seed, { mega = false, size = null } = {}) {
  const r = rng(seed, 'station-shape');
  const E = size ?? stationSize(civ, r, { mega });
  const plans = FAMILY_PLANS[civ?.family] || FAMILY_PLANS.hands;
  const archetype = r() < .22 ? ARCHETYPES[Math.floor(r() * ARCHETYPES.length)] : plans[Math.floor(r() * plans.length)];
  const prims = [], padSpots = [];
  const disc = (x, z, rad) => prims.push({ type: 'disc', x, z, r: rad });
  const poly = (x, z, rad, n, a = 0) => prims.push({ type: 'poly', x, z, r: rad, n, a });
  const rect = (x, z, hw, hd, a = 0) => prims.push({ type: 'rect', x, z, hw, hd, a });
  const bar = (x0, z0, x1, z1, w) => rect((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2, w / 2, Math.atan2(z1 - z0, x1 - x0));
  const at = (d, a) => [Math.cos(a) * d, Math.sin(a) * d];
  const turn = r() * Math.PI * 2; // how the plan sits relative to the world below
  const ringOf = (R, w, n) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + turn, [x, z] = at(R, a); rect(x, z, Math.PI * R / n * 1.25, w / 2, a + Math.PI / 2); } };
  switch (archetype) {
    case 'disc': disc(0, 0, E); for (let i = 0; i < 8; i++) padSpots.push(at(E * .64, i / 8 * Math.PI * 2)); break;
    case 'poly': { const n = r() < .5 ? 6 : 8; poly(0, 0, E, n, turn); for (let i = 0; i < n; i++) padSpots.push(at(E * .62, turn + (i + .5) / n * Math.PI * 2)); break; }
    case 'ring': {
      const hub = Math.max(14, E * .3), R = E * .78, w = Math.max(16, E * .3), spokes = 3 + Math.floor(r() * 3);
      disc(0, 0, hub); ringOf(R, w, Math.max(14, Math.round(E / 3)));
      for (let i = 0; i < spokes; i++) { const a = turn + i / spokes * Math.PI * 2, [x, z] = at(R, a); bar(0, 0, x, z, 5); }
      for (let i = 0; i < 10; i++) padSpots.push(at(R, turn + (i + .5) / 10 * Math.PI * 2));
      break;
    }
    case 'cross': {
      const arms = civ?.family === 'tripods' ? 3 : 3 + Math.floor(r() * 3), hub = E * .4, end = Math.max(PAD_RADIUS + 3, E * .25), w = Math.max(9, E * .2);
      disc(0, 0, hub);
      for (let i = 0; i < arms; i++) { const a = turn + i / arms * Math.PI * 2, [x, z] = at(E - end, a); bar(0, 0, x, z, w); disc(x, z, end); padSpots.push([x, z]); }
      for (let i = 0; i < arms; i++) padSpots.push(at(hub * .62, turn + (i + .5) / arms * Math.PI * 2));
      break;
    }
    case 'spine': {
      const a = turn, end = Math.max(PAD_RADIUS + 3, E * .2), w = Math.max(11, E * .22), sides = 2 + Math.floor(E / 50);
      const [x0, z0] = at(E - end, a), [x1, z1] = at(E - end, a + Math.PI);
      bar(x0, z0, x1, z1, w); disc(x0, z0, end); disc(x1, z1, end); disc(0, 0, Math.max(14, E * .3));
      padSpots.push([x0, z0], [x1, z1]);
      for (let i = 0; i < sides; i++) { // side platforms along the spine, alternating sides
        const t = (i / (sides - 1) - .5) * 1.3, side = i % 2 ? 1 : -1, rad = end * 1.05, [cx, cz] = at((E - end) * t, a), [ox, oz] = at(w * .5 + rad * .75, a + Math.PI / 2 * side);
        disc(cx + ox, cz + oz, rad); padSpots.push([cx + ox, cz + oz]);
      }
      break;
    }
    case 'cluster': {
      const main = E * .42, k = 3 + Math.floor(r() * 3);
      disc(0, 0, main);
      for (let i = 0; i < k; i++) {
        const a = turn + i / k * Math.PI * 2 + (r() - .5) * .5, rad = Math.max(PAD_RADIUS + 3.5, E * (.2 + r() * .1)), [x, z] = at(E - rad, a);
        disc(x, z, rad); bar(0, 0, x, z, 5.5); padSpots.push([x, z]);
      }
      break;
    }
    case 'comb': {
      const rh = Math.max(11, E * .24), cells = [[0, 0]], ring1 = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
      for (const c of ring1) cells.push(c);
      for (const [q, s] of [[2, -1], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2], [2, 0], [0, 2], [-2, 2], [-2, 0], [0, -2], [2, -2]]) if (r() < .45) cells.push([q, s]);
      for (const [q, s] of cells) { const x = rh * Math.sqrt(3) * (q + s / 2), z = rh * 1.5 * s; poly(x, z, rh * 1.08, 6, Math.PI / 6); if (q || s) padSpots.push([x, z]); }
      break;
    }
    case 'petal': {
      const n = 5 + Math.floor(r() * 3), core = E * .45, lobe = E * .32;
      disc(0, 0, core);
      for (let i = 0; i < n; i++) { const [x, z] = at(E - lobe, turn + i / n * Math.PI * 2); disc(x, z, lobe); padSpots.push([x, z]); }
      break;
    }
    case 'web': {
      const spokes = 6 + Math.floor(r() * 3), R1 = E * .55, R2 = E * .86;
      disc(0, 0, Math.max(13, E * .26));
      for (let i = 0; i < spokes; i++) { const a = turn + i / spokes * Math.PI * 2, [x, z] = at(E - 6, a); bar(0, 0, x, z, 5); }
      ringOf(R1, 6, Math.max(14, Math.round(E / 3.2))); ringOf(R2, 9, Math.max(18, Math.round(E / 2.6)));
      for (let i = 0; i < spokes; i++) { const [x, z] = at(R2 + 2, turn + i / spokes * Math.PI * 2); disc(x, z, PAD_RADIUS + 2.5); padSpots.push([x, z]); }
      break;
    }
  }
  return finish({ archetype, E, prims, padSpots, r, mega });
}

// --- Geometry queries --------------------------------------------------------------
export function insidePrim(p, x, z, pad = 0) {
  const dx = x - p.x, dz = z - p.z;
  if (p.type === 'disc') return dx * dx + dz * dz < (p.r - pad) ** 2;
  if (p.type === 'rect') { const c = Math.cos(p.a), s = Math.sin(p.a), u = dx * c + dz * s, v = -dx * s + dz * c; return Math.abs(u) < p.hw - pad && Math.abs(v) < p.hd - pad; }
  const ap = p.r * Math.cos(Math.PI / p.n); // poly: inside every edge's half-plane
  for (let k = 0; k < p.n; k++) { const a = p.a + (k + .5) / p.n * Math.PI * 2; if (dx * Math.cos(a) + dz * Math.sin(a) > ap - pad) return false; }
  return true;
}
// The outline of one piece as points (closed loop).
function outline(p) {
  const pts = [];
  if (p.type === 'disc') { const n = Math.max(24, Math.round(Math.PI * 2 * p.r / 3)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([p.x + Math.cos(a) * p.r, p.z + Math.sin(a) * p.r]); } return pts; }
  let corners;
  if (p.type === 'rect') { const c = Math.cos(p.a), s = Math.sin(p.a); corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [p.x + u * p.hw * c - v * p.hd * s, p.z + u * p.hw * s + v * p.hd * c]); }
  else corners = Array.from({ length: p.n }, (_, k) => [p.x + Math.cos(p.a + k / p.n * Math.PI * 2) * p.r, p.z + Math.sin(p.a + k / p.n * Math.PI * 2) * p.r]);
  for (let i = 0; i < corners.length; i++) { // edges cut into ~3 m pieces
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % corners.length], n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3));
    for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return pts;
}
const segDist = (x, z, s) => { const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2)); return Math.hypot(x - s.ax - dx * t, z - s.az - dz * t); };

function finish({ archetype, E, prims, padSpots, r, mega }) {
  const inside = (x, z, pad = 0) => prims.some((p) => insidePrim(p, x, z, pad));
  // The rim: every piece's outline where the outside of it is not another piece.
  const segs = [];
  for (const p of prims) {
    const pts = outline(p);
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az) || 1;
      let nx = (bz - az) / len, nz = -(bx - ax) / len; // outward for a counter-clockwise loop; checked below
      if (insidePrim(p, mx + nx * .2, mz + nz * .2)) { nx = -nx; nz = -nz; }
      if (inside(mx + nx * .3, mz + nz * .3)) continue; // a seam with a neighbouring piece
      segs.push({ ax, az, bx, bz, nx, nz, len });
    }
  }
  // Rim pieces by cell, so the distance to the rim is quick to find nearby.
  const C = 6, cells = new Map(), key = (i, j) => `${i},${j}`;
  for (const s of segs) {
    const x0 = Math.floor((Math.min(s.ax, s.bx) - 3) / C), x1 = Math.floor((Math.max(s.ax, s.bx) + 3) / C), z0 = Math.floor((Math.min(s.az, s.bz) - 3) / C), z1 = Math.floor((Math.max(s.az, s.bz) + 3) / C);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(s); }
  }
  // Distance to the rim, up to 3 m (beyond that it says 3).
  const edgeDist = (x, z) => { let d = 3; for (const s of cells.get(key(Math.floor(x / C), Math.floor(z / C))) || []) d = Math.min(d, segDist(x, z, s)); return d; };
  // Up to `max` metres (beyond that it says max), from the cells around the point.
  const edgeDistFar = (x, z, max = 14) => {
    const ci = Math.floor(x / C), cj = Math.floor(z / C), k = Math.ceil(max / C), seen = new Set();
    let d = max;
    for (let i = ci - k; i <= ci + k; i++) for (let j = cj - k; j <= cj + k; j++) for (const s of cells.get(key(i, j)) || []) if (!seen.has(s)) { seen.add(s); d = Math.min(d, segDist(x, z, s)); }
    return d;
  };
  const walkable = (x, z, rad = .35) => inside(x, z) && (rad <= 2.9 ? edgeDist(x, z) >= rad : edgeDistFar(x, z) >= rad);

  // Open floor on a 2.5 m grid (where things can be built and crew can stand).
  const grid = [];
  for (let x = -E; x <= E; x += 2.5) for (let z = -E; z <= E; z += 2.5) if (inside(x, z)) grid.push({ x, z, edge: edgeDistFar(x, z) });
  const area = grid.length * 6.25;

  // Pads: as many as the deck can hold, spread out; the first is the visitors'.
  const want = Math.max(3, Math.min(mega ? 8 : 6, Math.round(E / 15)));
  const hubClear = Math.min(mega ? 12 : 4 + E * .06, 12) + PAD_RADIUS + 3.5; // room for the spire at the hub
  const fits = ([x, z]) => edgeDistFar(x, z) >= PAD_RADIUS + .8 && inside(x, z) && Math.hypot(x, z) > hubClear;
  let cand = padSpots.filter(fits);
  if (cand.length < want) cand = cand.concat(grid.filter((g, i) => i % 3 === 0 && g.edge >= PAD_RADIUS + .8 && Math.hypot(g.x, g.z) > Math.max(hubClear, E * .35)).map((g) => [g.x, g.z]));
  const pads = [];
  // Visitors land on the side away from the world, so they walk toward it; the rest spread out.
  { const seen = new Set(); cand = cand.filter(([x, z]) => { const k = `${Math.round(x / 2)},${Math.round(z / 2)}`; if (seen.has(k)) return false; seen.add(k); return true; }); }
  if (cand.length) { const first = cand.reduce((a, b) => (b[0] < a[0] ? b : a)); pads.push({ x: first[0], z: first[1], r: PAD_RADIUS, guest: true }); }
  while (pads.length < want) {
    let best = null, bd = PAD_RADIUS * 2 + 2.5;
    for (const c of cand) { const d = Math.min(...pads.map((p) => Math.hypot(p.x - c[0], p.z - c[1]))); if (d > bd) { bd = d; best = c; } }
    if (!best) break;
    pads.push({ x: best[0], z: best[1], r: PAD_RADIUS, guest: false });
  }
  // The spire at the hub: as big as the hub allows.
  const hubEdge = edgeDistFar(0, 0), SR = Math.max(2.4, Math.min(mega ? 12 : 4 + E * .06, hubEdge - 3.2));

  // Routes between pieces: which overlap, and a doorway point in each overlap.
  const portals = prims.map(() => new Map());
  const box = (p) => { const e = p.type === 'rect' ? p.hw + p.hd : p.r; return [p.x - e, p.x + e, p.z - e, p.z + e]; };
  for (let i = 0; i < prims.length; i++) for (let j = i + 1; j < prims.length; j++) {
    const a = prims[i], b = prims[j], A = box(a), B = box(b);
    const x0 = Math.max(A[0], B[0]), x1 = Math.min(A[1], B[1]), z0 = Math.max(A[2], B[2]), z1 = Math.min(A[3], B[3]);
    if (x0 >= x1 || z0 >= z1) continue;
    const step = Math.max(.6, Math.sqrt((x1 - x0) * (z1 - z0) / 400)); // at most ~400 samples
    let sx = 0, sz = 0, n = 0; const pts = [];
    for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) if (insidePrim(a, x, z, .4) && insidePrim(b, x, z, .4) && Math.hypot(x, z) > SR + 3) { sx += x; sz += z; n++; pts.push([x, z]); }
    if (!n) continue;
    const cx = sx / n, cz = sz / n, m = pts.reduce((best, q) => (Math.hypot(q[0] - cx, q[1] - cz) < Math.hypot(best[0] - cx, best[1] - cz) ? q : best));
    portals[i].set(j, m); portals[j].set(i, m);
  }
  const doorways = [...new Set(portals.flatMap((m) => [...m.values()]))];
  const primAt = (x, z) => { let best = -1, bd = Infinity; prims.forEach((p, i) => { if (insidePrim(p, x, z)) { const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = i; } } }); return best; };
  // Waypoints from one point to another: through the doorways between pieces.
  function route(x0, z0, x1, z1) {
    const a = primAt(x0, z0), b = primAt(x1, z1);
    if (a < 0 || b < 0 || a === b) return [[x1, z1]];
    const prev = new Map([[a, -1]]), queue = [a];
    while (queue.length) { const i = queue.shift(); if (i === b) break; for (const j of portals[i].keys()) if (!prev.has(j)) { prev.set(j, i); queue.push(j); } }
    if (!prev.has(b)) return [[x1, z1]];
    const chain = []; for (let i = b; i !== a; i = prev.get(i)) chain.unshift([prev.get(i), i]);
    return [...chain.map(([i, j]) => portals[i].get(j)), [x1, z1]];
  }
  // Every piece can be reached from every other (a deck must hold together).
  const reach = new Set([0]), q = [0];
  while (q.length) { const i = q.shift(); for (const j of portals[i].keys()) if (!reach.has(j)) { reach.add(j); q.push(j); } }

  return { archetype, E, prims, segs, pads, spire: { x: 0, z: 0, r: SR }, doorways, grid, area, inside, edgeDist, edgeDistFar, walkable, primAt, route, connected: reach.size === prims.length, rand: r };
}
