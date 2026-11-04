// Sky events: things that happen at a time, not a place. Pure data, no rendering;
// game.js reads them and sky-events.js draws them.
//
//   eclipse  a moon (or, from a moon, its planet) passes in front of the star.
//            Worked out from the real orbits (orbits.mjs), so it happens when the
//            worlds line up and the star map agrees. Seen by day.
//   aurora   curtains of light at night, on worlds with air. Flares from the star,
//            or the magnetic field of a giant the world orbits, set how often.
//   meteors  a meteor shower at night, on worlds with air that cross a comet's trail.
//
// Aurorae and meteor showers come in storms: time is cut into windows and each
// window's storm (if any) is drawn from its own key path, so everyone sees the same
// sky at the same moment, like the orbits. Time is orbitClock() seconds.
import { rng } from './rng.mjs';
import { bodyPosition } from './orbits.mjs';

export const PHENOMENA = {
  eclipse: { name: 'Eclipse', when: 'day' },
  aurora: { name: 'Aurora', when: 'night' },
  meteors: { name: 'Meteor shower', when: 'night' },
};
const STORMS = {
  aurora: { every: 900, min: 240, max: 480 },
  meteors: { every: 1200, min: 180, max: 360 },
};
export const ECLIPSE_COVER = 0.5; // how much of the star must be hidden to count as an eclipse
export const TOTAL_COVER = 0.97;
const ECLIPSE_MIN = 15; // seconds: a moon flicking across the star's edge is not an eclipse
const DARK = -0.05, LIGHT = 0.03; // the star's elevation (sine) below which it is night, above which day

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// Share of a disc of angular radius a hidden by a disc of radius b, centres d apart.
export function discCover(a, b, d) {
  if (d >= a + b) return 0;
  if (d <= Math.abs(b - a)) return b >= a ? 1 : (b * b) / (a * a);
  const a2 = a * a, b2 = b * b;
  const lens = a2 * Math.acos(clamp((d * d + a2 - b2) / (2 * d * a), -1, 1))
    + b2 * Math.acos(clamp((d * d + b2 - a2) / (2 * d * b), -1, 1))
    - 0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
  return clamp(lens / (Math.PI * a2), 0, 1);
}

// What can come between a world and its star: its moons, or the planet it circles.
const occluders = (system, body) => system.bodies.filter((b) => b.parent === body.id || b.id === body.parent);

// How much of the star is hidden, seen from the world's centre at time t: { cover, by }.
export function eclipseAt(system, body, t) {
  const list = occluders(system, body);
  if (!list.length || body.giant) return { cover: 0, by: null };
  const p = bodyPosition(system, body, t), toStar = [-p[0], -p[1], -p[2]], ds = len(toStar);
  const a = Math.asin(Math.min(1, system.star.radius / ds));
  let best = { cover: 0, by: null };
  for (const o of list) {
    const q = sub(bodyPosition(system, o, t), p), dq = len(q);
    if (dq >= ds || dot(q, toStar) <= 0) continue;
    const b = Math.asin(Math.min(1, o.radius / dq)), d = Math.acos(clamp(dot(q, toStar) / (dq * ds), -1, 1));
    const cover = discCover(a, b, d);
    if (cover > best.cover) best = { cover, by: o.id };
  }
  return best;
}

// Sine of the star's height in the sky at a place (unit normal in the world's frame).
export function starElevation(system, body, normal, t) {
  const p = bodyPosition(system, body, t), d = len(p) || 1;
  return -(normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2]) / d;
}

// How likely a storm is in each window (0: never on this world).
export function stormChances(system, body) {
  const p = body.physics || {}, parent = system.bodies.find((b) => b.id === body.parent);
  if (body.giant || !p.pressure) return { aurora: 0, meteors: 0 };
  const flare = system.star.physics?.flareActivity ?? 0, magnet = parent?.giant ? 0.35 : 0;
  const aurora = p.pressure >= 0.05 && (flare > 0.15 || magnet) ? clamp(0.1 + flare * 0.6 + magnet, 0, 0.75) : 0;
  const meteors = p.pressure >= 0.01 && rng(body.seed, 'sky', 'comet')() < 0.55 ? 0.35 : 0;
  return { aurora, meteors };
}

// Storms of one type between t0 and t1: [{ type, start, end }].
function storms(type, body, chance, t0, t1) {
  const out = [];
  if (!chance) return out;
  const { every, min, max } = STORMS[type];
  for (let k = Math.floor((t0 - max) / every); k * every <= t1; k++) {
    const r = rng(body.seed, 'sky', type, k);
    if (r() >= chance) continue;
    const length = min + r() * (max - min), start = k * every + r() * (every - length);
    if (start + length > t0 && start < t1) out.push({ type, start, end: start + length });
  }
  return out;
}

// Eclipses between t0 and t1 (sampled every `step` s): [{ type, start, end, peak, cover, total, by }].
function eclipses(system, body, t0, t1, step = 2) {
  const out = [];
  if (!occluders(system, body).length || body.giant) return out;
  let open = null;
  for (let t = t0; t <= t1; t += step) {
    const e = eclipseAt(system, body, t);
    if (e.cover >= ECLIPSE_COVER) {
      if (!open) open = { type: 'eclipse', start: t, end: t, peak: t, cover: e.cover, by: e.by };
      open.end = t + step;
      if (e.cover > open.cover) Object.assign(open, { cover: e.cover, peak: t, by: e.by });
    } else if (open) { out.push(open); open = null; }
  }
  if (open) out.push(open);
  for (const e of out) e.total = e.cover >= TOTAL_COVER;
  return out.filter((e) => e.end - e.start >= ECLIPSE_MIN || e.start <= t0 || e.end > t1); // cut-off ones may be longer
}

// Which sky events this world can have at all (sampled over a long stretch of orbits).
export function phenomenaOf(system, body) {
  const chances = stormChances(system, body), out = [];
  if (eclipses(system, body, 0, 4000, 4).length) out.push('eclipse');
  if (chances.aurora) out.push('aurora');
  if (chances.meteors) out.push('meteors');
  return out;
}

// What the sky will do at a place over the next `horizon` seconds, only what can be
// seen from there (eclipses by day, the rest at night), soonest first:
//   [{ type, name, start, end, total?, by? }]  start/end: when it can be seen
export function forecast(system, body, normal, t, horizon = 1800) {
  const t1 = t + horizon, chances = stormChances(system, body), seen = [];
  const events = [...eclipses(system, body, t - 60, t1), ...storms('aurora', body, chances.aurora, t, t1), ...storms('meteors', body, chances.meteors, t, t1)];
  for (const e of events) {
    const want = PHENOMENA[e.type].when, step = e.type === 'eclipse' ? 2 : 10;
    let start = null, end = null;
    for (let s = Math.max(t, e.start); s <= e.end; s += step) {
      const el = starElevation(system, body, normal, s);
      if (want === 'day' ? el > LIGHT : el < DARK) { start ??= s; end = s + step; } else if (start != null) break;
    }
    if (start == null || Math.min(end, e.end) - start < 1) continue; // a glimpse at the edge of day or night
    seen.push({ ...e, name: e.type === 'eclipse' ? (e.total ? 'Total eclipse' : 'Partial eclipse') : PHENOMENA[e.type].name, start, end: Math.min(end, e.end) });
  }
  return seen.sort((a, b) => a.start - b.start);
}
