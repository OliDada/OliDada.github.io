// A fixed grid of cells laid over a world (a grid on each cube face, like
// groundcover.js), filled only near the player. What a cell holds is worked out
// from its own hash, so it is always the same: walk away and back and nothing has
// moved, and every part of the world gets its share, not just the landing site.
// As you move, cells ahead are worked out a few per frame, nearest first, and
// cells far behind are forgotten so memory stays small however far you go.
// Plants (flora-mesh.js) and loose rocks (surface.js) are placed this way.
import { FACES } from './chunk-build.mjs';

export function cellHash(f, i, j, k) {
  let h = Math.imul(f + 1, 2246822519) ^ Math.imul(i, 3266489917) ^ Math.imul(j, 668265263) ^ Math.imul(k, 374761393);
  h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// The ground a cell covers shrinks towards a face's corners (the grid is gnomonic):
// a cell at face coordinates (a, b) covers this share of a cell at the face centre.
// Fillers keep only this share of what they would place, so density is even.
export const cellArea = (a, b) => (1 + a * a + b * b) ** -1.5;

// radius: the world's radius; cell: cell size in metres (at a face centre);
// reach: how far around the player cells are filled;
// fill(f, i, j, cell): returns the items for one cell. Each call gets
//   cell.point(u, v, out): the unit direction at (u, v) in 0..1 across the cell,
//   or null if that spot belongs to the next face, and cell.area(u, v) (above).
export function createScatter({ radius: R, cell, reach, fill }) {
  const step = cell / R;
  const faceOf = (n, f) => { const [N, U, V] = FACES[f], d = n.x * N[0] + n.y * N[1] + n.z * N[2]; return d > .2 ? [(n.x * U[0] + n.y * U[1] + n.z * U[2]) / d, (n.x * V[0] + n.y * V[1] + n.z * V[2]) / d] : null; };
  const cells = new Map();
  let active = [], pending = [], anchor = null;

  const ctx = {
    f: 0, i: 0, j: 0,
    point(u, v, out) {
      const [N, U, V] = FACES[this.f], a = (this.i + u) * step, b = (this.j + v) * step;
      if (Math.abs(a) > 1 || Math.abs(b) > 1) return null;
      const x = N[0] + U[0] * a + V[0] * b, y = N[1] + U[1] * a + V[1] * b, z = N[2] + U[2] * a + V[2] * b, l = Math.hypot(x, y, z);
      out.x = x / l; out.y = y / l; out.z = z / l;
      return out;
    },
    area(u, v) { return cellArea((this.i + u) * step, (this.j + v) * step); },
    hash(k) { return cellHash(this.f, this.i, this.j, k); },
  };
  function fillRec(rec) {
    ctx.f = rec.f; ctx.i = rec.i; ctx.j = rec.j;
    rec.items = fill(rec.f, rec.i, rec.j, ctx) || [];
    rec.ready = true;
  }

  // Which cells lie within reach of a direction (plus a margin, so the set only
  // needs working out again after you have moved that far); new ones are queued,
  // nearest first.
  const margin = Math.max(cell, reach * .07);
  let gen = 0;
  function enumerate(dir) {
    const near = [], within = reach + margin + cell, cosLimit = Math.cos(Math.min(Math.PI, within / R));
    const edge = Math.ceil(1 / step);
    gen++;
    for (let f = 0; f < 6; f++) {
      const [N, U, V] = FACES[f], dn = dir.x * N[0] + dir.y * N[1] + dir.z * N[2];
      // A face is no nearer than its centre's angle less the face's own half-width (54.7°).
      if (Math.acos(Math.max(-1, Math.min(1, dn))) - .955 > within / R) continue;
      let i0 = -edge - 1, i1 = edge, j0 = -edge - 1, j1 = edge;
      const ab = faceOf(dir, f);
      if (ab) { // a window around the anchor; faces seen edge-on (small worlds) are scanned whole
        const scale = R / (1 + ab[0] * ab[0] + ab[1] * ab[1]); // metres per unit of a, b (smallest)
        const span = Math.ceil(within / (scale * step)) + 1, ci = Math.floor(ab[0] / step), cj = Math.floor(ab[1] / step);
        i0 = Math.max(i0, ci - span); i1 = Math.min(i1, ci + span); j0 = Math.max(j0, cj - span); j1 = Math.min(j1, cj + span);
      }
      const du = U[0] * dir.x + U[1] * dir.y + U[2] * dir.z, dv = V[0] * dir.x + V[1] * dir.y + V[2] * dir.z;
      for (let i = i0; i <= i1; i++) {
        const a = (i + .5) * step;
        for (let j = j0; j <= j1; j++) {
          const b = (j + .5) * step, dot = (dn + du * a + dv * b) / Math.sqrt(1 + a * a + b * b);
          if (dot < cosLimit) continue;
          const key = (f * 100003 + i + 50000) * 100003 + j + 50000;
          let rec = cells.get(key);
          if (!rec) { rec = { f, i, j, ready: false, items: null, d: 0, seen: 0 }; cells.set(key, rec); }
          rec.d = Math.acos(Math.min(1, dot)) * R; rec.seen = gen;
          near.push(rec);
        }
      }
    }
    // Forget cells well out of range, so memory stays small however far you go.
    if (cells.size > near.length * 2.5) for (const [key, rec] of cells) if (rec.seen !== gen) cells.delete(key);
    active = near.sort((x, y) => x.d - y.d);
    pending = active.filter(rec => !rec.ready);
  }

  return {
    // Cells within reach (and a little beyond), nearest first; each { d: metres from
    // where they were last worked out, ready, items }.
    get active() { return active; },
    get busy() { return pending.length; },
    get anchor() { return anchor; },
    // dir: unit direction of the point to fill around. Returns true when the set
    // of cells or what they hold changed (the caller then redraws).
    update(dir, budgetMs = 3) {
      let changed = false;
      if (!anchor || Math.acos(Math.min(1, anchor.x * dir.x + anchor.y * dir.y + anchor.z * dir.z)) * R > margin) {
        anchor = { x: dir.x, y: dir.y, z: dir.z };
        enumerate(anchor);
        changed = true;
      }
      const t0 = performance.now();
      while (pending.length && performance.now() - t0 < budgetMs) { const rec = pending.shift(); if (!rec.ready) { fillRec(rec); changed = true; } }
      return changed;
    },
    // Fills every cell within `within` metres of dir at once (used when a site is built).
    prime(dir, within = reach) {
      anchor = { x: dir.x, y: dir.y, z: dir.z };
      enumerate(anchor);
      for (const rec of pending) if (rec.d <= within + cell && !rec.ready) fillRec(rec);
      pending = pending.filter(rec => !rec.ready);
    },
    // Forget everything (e.g. once settlements have cleared their ground) and start again.
    reset() { cells.clear(); active = []; pending = []; const a = anchor; anchor = null; return a; },
  };
}

// A coarse spatial grid of { p: {x,y,z}, r, h } obstacles, so a step only checks what is near.
const GRID = 10;
export function obstacleGrid(list) {
  const grid = new Map();
  for (const o of list) {
    const k = `${Math.floor(o.p.x / GRID)},${Math.floor(o.p.y / GRID)},${Math.floor(o.p.z / GRID)}`;
    let cell = grid.get(k);
    if (!cell) grid.set(k, cell = []);
    cell.push(o);
  }
  return {
    near(p, out = []) {
      const cx = Math.floor(p.x / GRID), cy = Math.floor(p.y / GRID), cz = Math.floor(p.z / GRID);
      for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (let z = cz - 1; z <= cz + 1; z++) {
        const cell = grid.get(`${x},${y},${z}`);
        if (cell) for (const o of cell) out.push(o);
      }
      return out;
    },
  };
}
