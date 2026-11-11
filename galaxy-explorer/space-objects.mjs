// Things in a system besides its star and worlds. Pure data, deterministic per system (its own
// random stream, so nothing else moves); space-objects-view.js draws them, game.js flies you
// among them and records them, the star map marks them.
//
//   belts    an asteroid belt: a ring of rock between two orbits (or just beyond the last),
//            a few kilometres wide and thin, dense enough that you fly between the rocks
//   trojans  swarms of rocks gathered sixty degrees ahead of and behind a giant on its orbit
//            (the same points arks use), moving round with it
//   comets   an icy nucleus on a long, narrow orbit; near the star it grows a glowing head
//            and a tail that always points away from the star
//
// Positions are in system coordinates (metres, the star at the origin), at orbit time t.
import { rng } from './rng.mjs';
import { bodyPosition, angularSpeed } from './orbits.mjs';

const SYL = ['ka', 'vel', 'or', 'ith', 'sa', 'mun', 'tre', 'lo', 'quen', 'dar', 'zi', 'eph', 'ru', 'nai', 'col', 'bes', 'tor', 'ulm'];
const nameFrom = (r) => { let n = ''; for (let k = r.int(2, 3); k > 0; k--) n += r.pick(SYL); return n[0].toUpperCase() + n.slice(1); };
const cache = new WeakMap();

// Switched off for now: systems are compact, and belts, swarms and comets ran through moons'
// orbits and crowded them. Set to true to bring them back (game, map and codex all follow).
export const SPACE_OBJECTS = false;
const NONE = { belts: [], trojans: [], comets: [] };
export function spaceObjectsOf(system) {
  if (!SPACE_OBJECTS) return NONE;
  let out = cache.get(system);
  if (out) return out;
  const r = rng(system.seed, 'space-objects'), planets = system.bodies.filter((b) => !b.parent).sort((a, b) => a.orbit - b.orbit);
  const belts = [], trojans = [], comets = [];
  // A belt in the widest gap between orbits (most systems), or beyond the outermost world.
  if (planets.length && r() < .7) {
    let at = planets[planets.length - 1].orbit * 1.12, gap = planets[planets.length - 1].orbit * .12;
    if (planets.length > 1 && r() < .7) {
      let best = 0;
      for (let i = 1; i < planets.length; i++) { const g = planets[i].orbit - planets[i - 1].orbit - planets[i].radius - planets[i - 1].radius; if (g > best) { best = g; at = (planets[i].orbit + planets[i - 1].orbit) / 2; gap = g; } }
    }
    const width = Math.max(3000, gap * r.range(.18, .3));
    belts.push({ id: 'belt', kind: 'belt', name: `the ${nameFrom(r)} Belt`, R: at, width, thick: width * r.range(.09, .15), density: r.range(.6, 1), seed: r.int(0, 1e6), tint: r.pick(['#8a7f74', '#7d746b', '#968a7a', '#6f6a66', '#8c7b6a']) });
  }
  // Trojan swarms: at most giants, both ahead (+1) and behind (-1).
  for (const g of planets.filter((b) => b.giant)) {
    if (r() > .7) continue;
    for (const lead of [1, -1]) trojans.push({ id: `trojans:${g.id}:${lead}`, kind: 'trojans', name: `${g.name}'s ${lead > 0 ? 'leading' : 'trailing'} Trojans`, giant: g.id, lead, spread: r.range(.04, .07), radial: g.orbit * r.range(.02, .035), thick: g.orbit * .008, density: r.range(.5, .9), seed: r.int(0, 1e6), tint: '#7c7068' });
  }
  // Comets: long narrow orbits reaching from beyond the worlds to close to the star.
  const outer = planets.length ? planets[planets.length - 1].orbit : system.star.radius * 4;
  for (let k = r.int(0, 2); k >= 0; k--) {
    const a = outer * r.range(.65, 1.05), q = system.star.radius * r.range(1.5, 2.6), e = Math.min(.95, 1 - q / a);
    comets.push({ id: `comet:${k}`, kind: 'comet', name: `Comet ${nameFrom(r)}`, a, e, w: r() * Math.PI * 2, inc: r.range(-.25, .25), node: r() * Math.PI * 2, period: r.range(2400, 5400), phase: r(), radius: r.range(180, 420), seed: r.int(0, 1e6) });
  }
  out = { belts, trojans, comets };
  cache.set(system, out);
  return out;
}

// A comet's position at time t (system coordinates), and how far it is from the star.
export function cometPosition(c, t) {
  const M = ((c.phase + t / c.period) % 1) * Math.PI * 2;
  let E = M;
  for (let i = 0; i < 8; i++) E = E - (E - c.e * Math.sin(E) - M) / (1 - c.e * Math.cos(E));
  const x = c.a * (Math.cos(E) - c.e), y = c.a * Math.sqrt(1 - c.e * c.e) * Math.sin(E);
  // Turned by its argument, tilted out of the plane, then turned to its node.
  const xw = x * Math.cos(c.w) - y * Math.sin(c.w), yw = x * Math.sin(c.w) + y * Math.cos(c.w);
  const X = xw, Y = yw * Math.sin(c.inc), Z = yw * Math.cos(c.inc);
  return [X * Math.cos(c.node) - Z * Math.sin(c.node), Y, X * Math.sin(c.node) + Z * Math.cos(c.node)];
}
// Where a Trojan swarm's centre is: the giant's position turned sixty degrees about the star.
export function trojanCentre(system, tr, t) {
  const g = system.bodies.find((b) => b.id === tr.giant), p = bodyPosition(system, g, t), a = tr.lead * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}
// How thick the rock is at a point (0..1): inside a belt or a swarm. p: system coordinates.
export function rockDensity(system, objs, p, t) {
  let best = 0;
  const rho = Math.hypot(p[0], p[2]);
  for (const b of objs.belts) {
    const dr = (rho - b.R) / (b.width / 2), dy = p[1] / (b.thick / 2);
    best = Math.max(best, b.density * Math.exp(-(dr * dr * dr * dr) - dy * dy * 1.5));
  }
  for (const tr of objs.trojans) {
    const c = trojanCentre(system, tr, t), cr = Math.hypot(c[0], c[2]);
    const ang = Math.atan2(p[2], p[0]) - Math.atan2(c[2], c[0]), da = Math.atan2(Math.sin(ang), Math.cos(ang)) / tr.spread;
    const dr = (rho - cr) / tr.radial, dy = (p[1] - c[1]) / tr.thick;
    best = Math.max(best, tr.density * Math.exp(-(da * da) - dr * dr - dy * dy));
  }
  return best;
}
// Metres from the nearest belt or swarm (0 inside), for the engines (they slow among rocks).
export function rockClearance(system, objs, p, t) {
  let best = Infinity;
  const rho = Math.hypot(p[0], p[2]);
  for (const b of objs.belts) best = Math.min(best, Math.max(0, Math.hypot(Math.max(0, Math.abs(rho - b.R) - b.width / 2), Math.max(0, Math.abs(p[1]) - b.thick / 2))));
  for (const tr of objs.trojans) { const c = trojanCentre(system, tr, t); best = Math.min(best, Math.max(0, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - Math.hypot(c[0], c[2]) * tr.spread * 1.2)); }
  return best;
}
