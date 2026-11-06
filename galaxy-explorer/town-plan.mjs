// How hand-builders lay out a place (pure data; town-build.js draws it, structures-mesh.js
// places it on the world). Streets first, with a purpose: the main ways lead to the heart of
// the place (a square with its well, fountain or monument), a ring road joins them in towns,
// and side streets fill in. Then districts, by where a lot is: the core round the square
// (civic buildings and the market, the tallest), the high streets (shops on the ground floor),
// the homes, and workshops and yards at the edge. Then lots along every street, each facing
// its street with its door on it: in villages, houses stand apart in their gardens; in towns
// they share walls in rows; planned cities (planet-shapers and up) are a grid of perimeter
// blocks round green courtyards, and the most advanced raise towers from the core blocks.
// Last, the life of the street: lamps, trees, benches, market stalls, carts, planters, a
// fountain, a bus stop, according to tier.
//
// Coordinates are metres on the ground, round the place's centre (x, z); angles are radians.
//   planTown({ seed, radius, level, u, path, capital, sw, avoid(x, z, r) }) -> plan
//   planDistrict({ seed, x0, z0, x1, z1, level, u, heart, avoid, ... }) -> plan (a city world's fabric)
//   plan: { streets: [{ pts: [[x, z]], w, main }], squares: [{ x, z, r, kind }],
//           lots: [Lot], props: [{ x, z, ang, kind }] }
//   Lot: { x, z, ang (the way it faces: toward its street), w (frontage), d (depth), floors,
//          kind ('house'|'row'|'shop'|'workshop'|'hall'|'block'|'tower'), district, tower?, seed }
import { rng } from './rng.mjs';

const TAU = Math.PI * 2;
// Floor height for builders of unit size u (metres).
export const floorH = (u) => 3.1 * Math.max(.75, u);

export function planTown({ seed, radius: R, level, u = 1, path = 'mercantile', capital = false, sw = 2.4, avoid = () => false }) {
  // Big builders build big, but a place must still hold a few streets of them.
  const r = rng(seed, 'town-plan'), U = Math.max(.7, Math.min(u, R / (level >= 4 ? 40 : 24)));
  const plan = { streets: [], squares: [], lots: [], props: [], U };
  if (level >= 4) return planGrid({ r, plan, R, level, U, path, capital, sw, avoid, heart: (x, z) => Math.hypot(x, z) / R, inside: (x, z) => Math.hypot(x, z) < R * .96 });
  return planOrganic({ r, plan, R, level, U, path, capital, sw, avoid });
}

// --- Organic places (villages, towns, early cities): streets that radiate and wander ------
function planOrganic({ r, plan, R, level, U, path, capital, sw, avoid }) {
  const sq = Math.min(R * .2, (level >= 3 ? 11 : 7) * U);
  plan.squares.push({ x: 0, z: 0, r: sq, kind: level >= 3 ? 'fountain' : 'well' });
  const n = level >= 3 ? 4 + Math.floor(r() * 3) : 3 + Math.floor(r() * 2), a0 = r() * TAU;
  const streets = [];
  for (let i = 0; i < n; i++) {
    let a = a0 + i / n * TAU + (r() - .5) * .5;
    const pts = [];
    for (let d = sq; d <= R; d += 3 * U) { pts.push([Math.cos(a) * d, Math.sin(a) * d]); a += (r() - .5) * .16 * (6 * U / Math.max(d, 6 * U)); }
    streets.push({ pts, w: sw * (i < 2 ? 1.25 : 1), main: i < 2 });
  }
  // Towns grow in rings: streets round the middle, a block's depth apart, and more lanes
  // reaching out between the main ways in the outer rings (a web, as old towns grow).
  const ringStep = (2 * 8.5 + 3) * U + sw;
  if (level >= 3 || R > 40 * U) {
    let k = 0;
    for (let rr = sq + ringStep * (level >= 3 ? .9 : 1.4); rr < R * .92; rr += ringStep, k++) {
      const pts = [];
      for (let a = 0; a <= TAU + .01; a += 3 * U / rr) { const wob = 1 + .04 * Math.sin(a * 3 + k); pts.push([Math.cos(a) * rr * wob, Math.sin(a) * rr * wob]); }
      streets.push({ pts, w: sw * (k === 0 && level >= 3 ? 1.15 : 1), main: false, ring: true });
      // Lanes from this ring outward, between the main ways.
      const lanes = Math.round(TAU * rr / (ringStep * 2.2));
      for (let i = 0; i < lanes; i++) {
        const a = (i + .5) / lanes * TAU + k * .37;
        if (streets.slice(0, n).some((st) => { const p = st.pts[Math.min(st.pts.length - 1, Math.round((rr - sq) / (3 * U)))]; return p && Math.abs(Math.atan2(Math.sin(Math.atan2(p[1], p[0]) - a), Math.cos(Math.atan2(p[1], p[0]) - a))) < ringStep * .8 / rr; })) continue;
        const lp = [];
        for (let d = rr; d <= Math.min(R, rr + ringStep); d += 3 * U) lp.push([Math.cos(a) * d, Math.sin(a) * d]);
        if (lp.length > 2) streets.push({ pts: lp, w: sw * .85, main: false });
      }
    }
  }
  plan.streets.push(...streets);
  // Lots along both sides of every street.
  const rows = level >= 3; // towns build in rows, sharing walls; villages stand apart in gardens
  for (const st of streets) frontage(plan, st, { R, U, level, rows, r, avoid, heart: (x, z) => Math.hypot(x, z) / R, sq });
  props(plan, { r, R, U, level, path, capital, sq });
  return plan;
}

// Lots in a line along a street: each faces it; widths by district, in rows or apart.
function frontage(plan, st, { R, U, level, rows, r, avoid, heart, sq }) {
  const pts = st.pts;
  if (pts.length < 2) return;
  for (const side of [-1, 1]) {
    let along = 0, i = 0, carry = 0;
    // Walk the street, measuring off lots.
    let seg = 0, t = 0;
    const len = []; for (let k = 1; k < pts.length; k++) len.push(Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const total = len.reduce((a, b) => a + b, 0);
    let s = rows ? 2 * U : 3 * U + r() * 4 * U;
    while (s < total - 2 * U) {
      // Where along the street, and its direction there.
      let acc = 0, k = 0; while (k < len.length - 1 && acc + len[k] < s) { acc += len[k]; k++; }
      const f = (s - acc) / len[k], [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const px = ax + (bx - ax) * f, pz = az + (bz - az) * f, dx = (bx - ax) / len[k], dz = (bz - az) / len[k];
      const nx = -dz * side, nz = dx * side; // the side of the street
      const hd = heart(px, pz), core = hd < .38, main = st.main;
      const district = core ? 'core' : main ? 'high street' : hd > .78 ? 'edge' : 'homes';
      // Lots about as deep as they are wide, so a building stands in its own ground.
      let w = rows ? (district === 'core' ? 10 : main ? 9 : 8) * U * (.85 + r() * .35) : (7 + r() * 3) * U;
      let d = w * (.88 + r() * .3);
      if (district === 'edge' && level >= 3) { w *= 1.5; d *= 1.2; }
      const off = st.w / 2 + .6 * U + d / 2, x = px + nx * off, z = pz + nz * off;
      const lot = { x, z, ang: Math.atan2(-nz, -nx), w, d, district, seed: Math.floor(r() * 1e9) };
      if (Math.hypot(x, z) < sq + d / 2 + 1 || Math.hypot(x, z) > R + d * .2 || clash(plan.lots, lot) || plan.streets.some((o) => o !== st && nearStreet(o, x, z, d / 2 + o.w / 2)) || avoid(x, z, Math.max(w, d) / 2)) { s += 2 * U; continue; }
      lot.kind = district === 'edge' ? (level >= 3 ? 'workshop' : 'house') : district === 'core' && level >= 3 ? (r() < .35 ? 'hall' : 'shop') : district === 'high street' && level >= 3 ? 'shop' : rows ? 'row' : 'house';
      lot.floors = floorsOf(level, district, r, hd);
      plan.lots.push(lot);
      s += w + (rows ? 1.2 * U + r() * 2 * U : 2.5 * U + r() * 5 * U);
    }
  }
}
const floorsOf = (level, district, r, hd) => {
  if (level <= 2) return 1 + (r() < .3 ? 1 : 0);
  const top = level === 3 ? 4 : level === 4 ? 6 : 7;
  const base = district === 'core' ? top : district === 'high street' ? top - 1 : district === 'edge' ? 1 : top - 2;
  return Math.max(1, Math.round(base * (1.15 - hd * .5) * (.75 + r() * .4)));
};
// Rectangles overlapping (oriented boxes, by their corners).
function corners(l) { const c = Math.cos(l.ang), s = Math.sin(l.ang), hw = l.w / 2, hd = l.d / 2; return [[-hd, -hw], [hd, -hw], [hd, hw], [-hd, hw]].map(([a, b]) => [l.x + c * a - s * b, l.z + s * a + c * b]); }
function overlaps(a, b) {
  const A = corners(a), B = corners(b);
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % 4], nx = z2 - z1, nz = x1 - x2;
    const pa = A.map(([x, z]) => x * nx + z * nz), pb = B.map(([x, z]) => x * nx + z * nz);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
}
const clash = (lots, l) => { const reach = Math.hypot(l.w, l.d); for (const o of lots) if (Math.hypot(o.x - l.x, o.z - l.z) < (reach + Math.hypot(o.w, o.d)) / 2 && overlaps(o, l)) return true; return false; };
function nearStreet(st, x, z, dist) {
  for (let k = 1; k < st.pts.length; k++) {
    const [ax, az] = st.pts[k - 1], [bx, bz] = st.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < dist) return true;
  }
  return false;
}

// --- Planned places (planet-shapers and up, and a city world's fabric): a grid ------------
// Streets every block, a wide avenue every few, perimeter blocks of buildings round green
// courts; the core blocks raise towers (spacefarers and up) on podiums of shops.
export function planDistrict({ seed, x0, z0, x1, z1, level, u = 1, path = 'mercantile', sw = 2.6, avoid = () => false, heart = () => .5, inside = () => true, origin = [0, 0] }) {
  const r = rng(seed, 'district'), U = Math.max(.7, u);
  const plan = { streets: [], squares: [], lots: [], props: [], U };
  return planGrid({ r, plan, level, U, path, sw, avoid, heart, inside, box: [x0, z0, x1, z1], origin });
}
function planGrid({ r, plan, R = 0, level, U, path, capital = false, sw, avoid, heart, inside, box = null, origin = [0, 0] }) {
  const block = Math.min((level >= 5 ? 34 : 28) * U, R ? R / 2.2 : Infinity), avenueEvery = 3;
  const swA = sw * 1.8; // avenues
  const pitch = block + sw;
  const [x0, z0, x1, z1] = box || [-R, -R, R, R];
  // Grid lines are fixed to the origin, so neighbouring districts' streets meet.
  const i0 = Math.floor((x0 - origin[0]) / pitch), i1 = Math.ceil((x1 - origin[0]) / pitch), j0 = Math.floor((z0 - origin[1]) / pitch), j1 = Math.ceil((z1 - origin[1]) / pitch);
  const lineX = (i) => origin[0] + i * pitch, lineZ = (j) => origin[1] + j * pitch;
  const wOf = (k) => (((k % avenueEvery) + avenueEvery) % avenueEvery === 0 ? swA : sw);
  // Streets: along x and along z, clipped to where the place is.
  const run = (fixed, axis, a, b) => {
    const pts = []; const out = [];
    for (let t = a; t <= b + .01; t += 4 * U) {
      const x = axis ? fixed : t, z = axis ? t : fixed;
      if (inside(x, z)) pts.push([x, z]); else if (pts.length) { if (pts.length > 1) out.push(pts.splice(0)); else pts.length = 0; }
    }
    if (pts.length > 1) out.push(pts);
    return out;
  };
  for (let i = i0; i <= i1; i++) for (const pts of run(lineX(i), 1, z0, z1)) plan.streets.push({ pts, w: wOf(i), main: wOf(i) > sw });
  for (let j = j0; j <= j1; j++) for (const pts of run(lineZ(j), 0, x0, x1)) plan.streets.push({ pts, w: wOf(j), main: wOf(j) > sw });
  // Blocks.
  let squareDone = false;
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const ax = lineX(i) + wOf(i) / 2, bx = lineX(i + 1) - wOf(i + 1) / 2, az = lineZ(j) + wOf(j) / 2, bz = lineZ(j + 1) - wOf(j + 1) / 2;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, W = bx - ax, D = bz - az;
    if (!inside(cx, cz)) continue; // (lots outside the place are dropped one by one, below)
    const hd = heart(cx, cz), bseed = Math.floor(r() * 1e9);
    // The heart of the place: a square (the block nearest the centre), with its fountain or monument.
    if (!squareDone && !box && Math.hypot(cx, cz) < pitch * .75) { squareDone = true; plan.squares.push({ x: cx, z: cz, r: Math.min(W, D) / 2, kind: level >= 5 ? 'monument' : 'fountain', block: true }); continue; }
    if (box && hd < .02 && !squareDone) { squareDone = true; plan.squares.push({ x: cx, z: cz, r: Math.min(W, D) / 2, kind: 'monument', block: true }); continue; }
    if (avoid(cx, cz, Math.min(W, D) / 3)) continue;
    // A park now and then.
    if (r() < (hd > .7 ? .14 : .08)) { plan.squares.push({ x: cx, z: cz, r: Math.min(W, D) / 2, kind: 'park', block: true }); continue; }
    const core = hd < .35, tall = level >= 5 && core && r() < .8;
    const depth = Math.min((level >= 5 ? 11 : 9) * U, Math.min(W, D) * .42), floors = floorsOf(level, core ? 'core' : hd > .75 ? 'edge' : 'homes', r, hd);
    // The perimeter: rows facing outward on all four sides, a green court in the middle.
    for (const [side, len, fx, fz, ox, oz] of [
      ['n', W, 1, 0, cx, az + depth / 2], ['s', W, 1, 0, cx, bz - depth / 2],
      ['w', D - depth * 2, 0, 1, ax + depth / 2, cz], ['e', D - depth * 2, 0, 1, bx - depth / 2, cz]]) {
      if (len < 4 * U) continue;
      const faceAng = side === 'n' ? -Math.PI / 2 : side === 's' ? Math.PI / 2 : side === 'w' ? Math.PI : 0;
      const n = Math.max(1, Math.round(len / Math.max(depth * 1.15, (core ? 12 : 10) * U))), w = len / n;
      const mainSide = (side === 'n' && wOf(j) > sw) || (side === 's' && wOf(j + 1) > sw) || (side === 'w' && wOf(i) > sw) || (side === 'e' && wOf(i + 1) > sw);
      for (let k = 0; k < n; k++) {
        const t = -len / 2 + (k + .5) * w, x = ox + fx * t, z = oz + fz * t;
        const kind = core ? (r() < .25 ? 'hall' : 'shop') : mainSide ? 'shop' : hd > .8 ? 'workshop' : 'row';
        const hw = fx ? w / 2 : depth / 2, hd2 = fx ? depth / 2 : w / 2; // (the lot's corners must be in the place too)
        if (!inside(x, z) || [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => !inside(x + a * hw, z + b * hd2)) || avoid(x, z, Math.max(w, depth) / 2)) continue;
        plan.lots.push({ x, z, ang: faceAng, w: w * .995, d: depth, district: core ? 'core' : mainSide ? 'high street' : 'homes', kind, floors: tall ? 2 + Math.floor(r() * 2) : Math.max(1, floors + (mainSide ? 1 : 0) - (r() < .3 ? 1 : 0)), seed: Math.floor(r() * 1e9), block: bseed });
      }
    }
    // Towers rise from the core blocks' courts, on the podium the rows make.
    if (tall) {
      const tw = Math.min(W, D) - depth * 2 - 2 * U;
      if (tw > 8 * U && inside(cx + tw / 2, cz) && inside(cx - tw / 2, cz)) plan.lots.push({ x: cx, z: cz, ang: 0, w: tw, d: tw * (.7 + r() * .3), district: 'core', kind: 'tower', floors: Math.round((level >= 6 ? 22 : 14) * (1.2 - hd) * (.6 + r() * .6)), seed: Math.floor(r() * 1e9), block: bseed, inner: true });
    } else plan.squares.push({ x: cx, z: cz, r: Math.max(2, (Math.min(W, D) - depth * 2) / 2 - 1), kind: 'court', block: true });
  }
  props(plan, { r, R: R || Math.hypot(x1 - x0, z1 - z0) / 2, U, level, path, capital, sq: 0, grid: true });
  return plan;
}

// --- The life of the street ------------------------------------------------------------------
function props(plan, { r, R, U, level, path, capital, sq, grid = false }) {
  for (const st of plan.streets) {
    const lamps = level >= 3, trees = level >= 3 && (st.main || level >= 5), step = (st.main ? 12 : 16) * U;
    let s = r() * step;
    for (let k = 1; k < st.pts.length; k++) {
      const [ax, az] = st.pts[k - 1], [bx, bz] = st.pts[k], L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-6) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      while (s < L) {
        const x = ax + dx * s, z = az + dz * s, side = (Math.floor(s / step + k) % 2) ? 1 : -1, off = st.w / 2 + .5 * U;
        const px = x - dz * side * off, pz = z + dx * side * off, ang = Math.atan2(dz * side, -dx * side);
        if (lamps) plan.props.push({ x: px, z: pz, ang, kind: level >= 5 ? 'lamp-tall' : 'lamp' });
        if (trees && r() < .7) plan.props.push({ x: x + dz * side * off, z: z - dx * side * off, ang, kind: 'tree' });
        if (level >= 4 && st.main && r() < .12) plan.props.push({ x: px + dx * 2 * U, z: pz + dz * 2 * U, ang, kind: level >= 5 ? 'stop' : 'bench' });
        s += step;
      }
      s -= L;
    }
  }
  for (const s of plan.squares) {
    const kind = s.kind;
    if (kind === 'park') { for (let i = 0; i < 6; i++) plan.props.push({ x: s.x + (r() - .5) * s.r * 1.4, z: s.z + (r() - .5) * s.r * 1.4, ang: r() * TAU, kind: 'tree' }); plan.props.push({ x: s.x, z: s.z, ang: 0, kind: 'pond' }); continue; }
    if (kind === 'court') { plan.props.push({ x: s.x, z: s.z, ang: r() * TAU, kind: 'tree' }); continue; }
    plan.props.push({ x: s.x, z: s.z, ang: 0, kind });
    // Round the square: market stalls (on market days, and always where they trade), benches, trees.
    const stalls = level >= 2 && (path === 'mercantile' || capital || level >= 3) ? 4 + Math.floor(r() * 5) : 0;
    for (let i = 0; i < stalls; i++) { const a = i / stalls * TAU + r() * .3, d = s.r * .62; plan.props.push({ x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, ang: a + Math.PI, kind: 'stall' }); }
    for (let i = 0; i < 4; i++) { const a = (i + .5) / 4 * TAU, d = s.r * .35; plan.props.push({ x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, ang: a + Math.PI, kind: level >= 3 ? 'bench' : 'log' }); }
    if (level >= 3) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .26, d = s.r * .88; plan.props.push({ x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, ang: a, kind: 'tree' }); }
  }
  // Workshops have their yards: crates, carts, barrels.
  for (const l of plan.lots) if (l.kind === 'workshop' && r() < .7) { const c = Math.cos(l.ang), s = Math.sin(l.ang); plan.props.push({ x: l.x + c * (l.d / 2 + 1.2 * U) + -s * (l.w * .3), z: l.z + s * (l.d / 2 + 1.2 * U) + c * (l.w * .3), ang: l.ang, kind: level >= 4 ? 'crates' : 'cart' }); }
  // Village houses have gardens and a fence behind.
  if (level <= 2) for (const l of plan.lots) if (r() < .6) { const c = Math.cos(l.ang), s = Math.sin(l.ang); plan.props.push({ x: l.x - c * (l.d / 2 + 2.2 * U), z: l.z - s * (l.d / 2 + 2.2 * U), ang: l.ang, kind: 'garden', w: l.w }); }
}
