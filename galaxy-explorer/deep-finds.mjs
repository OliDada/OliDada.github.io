// Finds between the stars: things the star drive's sensors pick up in deep space, far from
// any star. Pure data, deterministic: every cubic light year of the galaxy has a fixed small
// chance of holding one, so the same place always holds the same thing for everyone.
//
//   nebula  a cloud of glowing gas a fifth of a light year or so across, and rare; you fly through it
//   rogue   a dark world with no star, lit only by starlight (rarely with life under its ice)
//   dwarf   a brown dwarf: a failed star, dim and deep red, banded like a giant
//   hole    a black hole: a dark core, a thin ring of bent light and a glowing disc
//
// About one find per 12-18 light years flown; one in six is a nebula. Sizes are in light years: `size` is how big it
// looks (its body; for a nebula its whole cloud), `stop` how close the drive brings you.
import { rng, hash32 } from './rng.mjs';
import { GALAXY_SEED } from './galaxy.mjs';

export const FIND_CELL = 1; // light years per cell edge
export const DETECT_LY = 0.3; // the drive's sensors reach this far (from its edge)
export const REVEAL_LY = 0.05; // close enough to tell what it is
const CHANCE = 0.24;
export const FIND_KINDS = {
  nebula: { w: .16, name: 'Nebula', word: 'a cloud of glowing gas' },
  rogue: { w: .44, name: 'Rogue world', word: 'a dark world with no star' },
  dwarf: { w: .3, name: 'Brown dwarf', word: 'a dim, cool body, warmer than a world' },
  hole: { w: .1, name: 'Black hole', word: 'something massive that gives off no light' },
};
const NEBULA_HUES = [['#ff5f8a', '#7a1f4f'], ['#5fd0ff', '#173b6b'], ['#9b7bff', '#2a1a5a'], ['#7dffb0', '#13402f'], ['#ffb05f', '#5a2a12']];
const SYL = ['ka', 'vel', 'or', 'ith', 'sa', 'mun', 'tre', 'lo', 'quen', 'dar', 'zi', 'eph', 'ru', 'nai', 'col', 'bes'];
const nameFrom = (r) => { let n = ''; for (let k = r.int(2, 3); k > 0; k--) n += r.pick(SYL); return n[0].toUpperCase() + n.slice(1); };

const cache = new Map();
// The find in one cell, or null.
export function findInCell(cx, cy, cz) {
  const key = `${cx}_${cy}_${cz}`;
  if (cache.has(key)) return cache.get(key);
  const r = rng(GALAXY_SEED, 'deep-find', cx, cy, cz);
  let f = null;
  if (r() < CHANCE) {
    let roll = r() * Object.values(FIND_KINDS).reduce((s, k) => s + k.w, 0), kind = 'nebula';
    for (const [k, d] of Object.entries(FIND_KINDS)) { roll -= d.w; if (roll <= 0) { kind = k; break; } }
    const name = nameFrom(r), seed = hash32(GALAXY_SEED, 'deep-find-seed', cx, cy, cz);
    f = {
      id: `find:${key}`, kind, seed, x: (cx + .15 + r() * .7) * FIND_CELL, y: (cy + .15 + r() * .7) * FIND_CELL, z: (cz + .15 + r() * .7) * FIND_CELL,
      name: kind === 'nebula' ? `the ${name} Nebula` : kind === 'hole' ? `${name}, a black hole` : kind === 'dwarf' ? `${name}, a brown dwarf` : name,
      title: kind === 'nebula' ? `${name} Nebula` : name,
      size: kind === 'nebula' ? r.range(.12, .3) : kind === 'dwarf' ? .0007 : kind === 'hole' ? .0005 : .00035,
      stop: kind === 'hole' ? .004 : kind === 'dwarf' ? .0012 : kind === 'rogue' ? .0009 : 0,
      hue: kind === 'nebula' ? r.pick(NEBULA_HUES) : null,
      life: kind === 'rogue' && r() < .12, // warmed from inside, under the ice
    };
  }
  if (cache.size > 20000) cache.clear();
  cache.set(key, f);
  return f;
}
// Finds within `radius` light years of point p ([x, y, z]), nearest first, each with its
// centre distance `d` and distance from its edge `edge` (negative inside a nebula).
export function findsNear(p, radius) {
  const out = [], lo = (v) => Math.floor((v - radius - .2) / FIND_CELL), hi = (v) => Math.floor((v + radius + .2) / FIND_CELL);
  for (let cx = lo(p[0]); cx <= hi(p[0]); cx++) for (let cy = lo(p[1]); cy <= hi(p[1]); cy++) for (let cz = lo(p[2]); cz <= hi(p[2]); cz++) {
    const f = findInCell(cx, cy, cz);
    if (!f) continue;
    const d = Math.hypot(f.x - p[0], f.y - p[1], f.z - p[2]);
    if (d - f.size <= radius) out.push({ f, d, edge: d - f.size });
  }
  return out.sort((a, b) => a.edge - b.edge);
}
