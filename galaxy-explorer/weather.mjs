// Weather: what falls from a world's clouds, where, and when. Pure data, no
// rendering: weather-fx.js draws it, cloud-mesh.js heaps storm cloud up, game.js
// darkens the sky, sets the wind and flashes the lightning.
//
// Rain (or snow, ash...) falls where the cloud overhead is thick. Storms come and
// go in time windows, like the aurorae (phenomena.mjs): each window may bring a
// storm or two, each a patch of the world a couple of hundred metres across that
// drifts with the clouds and piles them into thick, dark masses with strong wind
// and heavy rain. Everything follows from the seed and the orbit clock, so everyone
// sees the same weather at the same moment.
//
//   weatherOf(body, clouds)              null, or { kind, wet, storminess, lightning, wind }
//   stormsAt(body, clouds, t)            the storms in the sky now (for clouds.mjs)
//   weatherAt(body, clouds, w, dir, angles, storms)   { kind, precip, wind, storm, thick, lightning }
import { rng } from './rng.mjs';
import { clamp } from './physics.mjs';
import { airOf, cloudValue, stormFrame, stormReach, MAX_STORMS, OCTAVES } from './clouds.mjs';

// What falls. lines: drawn as streaks (drops) or as flakes.
export const PRECIP = {
  rain: { name: 'Rain', storm: 'Thunderstorm' },
  snow: { name: 'Snow', storm: 'Blizzard' },
  acid: { name: 'Acid rain', storm: 'Acid storm' },
  ash: { name: 'Ash fall', storm: 'Volcanic storm' },
  methane: { name: 'Methane rain', storm: 'Methane storm' },
  dust: { name: 'Blowing dust', storm: 'Dust storm' },
};
export const WINDOW = 900; // seconds: each window may bring storms

export function weatherOf(body, c) {
  if (!c) return null;
  const p = body.physics || {}, air = airOf(p.pressure);
  const W = {
    water: { kind: (p.temperature ?? 288) < 272 ? 'snow' : 'rain', wet: 1, storminess: body.biome === 'Oceanic' ? 0.75 : 0.55, lightning: true },
    ice: { kind: 'snow', wet: 0.75, storminess: 0.3, lightning: false },
    sulfur: { kind: 'acid', wet: 0.65, storminess: 0.5, lightning: true },
    ash: { kind: 'ash', wet: 0.8, storminess: 0.5, lightning: true }, // volcanic lightning
    haze: { kind: 'methane', wet: 0.6, storminess: 0.25, lightning: false },
    dust: { kind: 'dust', wet: 0, storminess: 0.5, lightning: false },
  }[c.kind];
  if (!W) return null;
  return { ...W, wind: +(0.12 + 0.3 * air).toFixed(3) }; // the everyday breeze, 0..1
}

// The storms of one window: when they start, how long they last, where they sit.
function windowStorms(body, c, w, n) {
  const r = rng(body.seed, 'storms', n), out = [];
  if (r() >= w.storminess) return out;
  const count = r() < w.storminess * 0.5 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const y = r.range(-0.85, 0.85), a = r() * Math.PI * 2, s = Math.sqrt(1 - y * y);
    // A storm is 150-300 m across, but never more than about a third of a small moon.
    const radius = Math.min(0.6, r.range(75, 150) / (body.radius + c.height));
    out.push({
      dir: [Math.cos(a) * s, y, Math.sin(a) * s], cos: Math.cos(radius),
      start: n * WINDOW + r() * 0.5 * WINDOW, length: r.range(0.6, 1.2) * WINDOW, peak: r.range(0.7, 1),
    });
  }
  return out;
}
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
export function stormsAt(body, c, t, w = weatherOf(body, c)) {
  if (!w) return [];
  const n = Math.floor(t / WINDOW), out = [];
  for (const m of [n - 1, n]) // a storm may run on into the next window
    for (const s of windowStorms(body, c, w, m)) {
      const u = (t - s.start) / s.length;
      if (u <= 0 || u >= 1) continue;
      // Builds up over the first quarter, dies away over the last.
      out.push({ dir: s.dir, cos: s.cos, k: s.peak * smooth(u / 0.25) * smooth((1 - u) / 0.25) });
    }
  return out.sort((a, b) => b.k - a.k).slice(0, MAX_STORMS);
}

// The weather at a direction from the world's centre, right now.
export function weatherAt(body, c, w, dir, angles, storms) {
  if (!w) return null;
  const v = cloudValue(c, dir, angles, OCTAVES, storms);
  const thick = clamp((v - c.threshold - c.soft) / (2.5 * c.soft), 0, 1); // 0 thin or clear, 1 the heart of a cloud
  const q = stormFrame(dir, angles[0]);
  let storm = 0, gusts = 0;
  for (const s of storms) {
    storm = Math.max(storm, s.k * stormReach(q, s));
    gusts = Math.max(gusts, s.k * stormReach(q, s, 2.2)); // wind reaches well beyond the rain
  }
  const wind = clamp(w.wind + 0.75 * gusts + 0.12 * thick, 0, 1);
  const precip = w.kind === 'dust'
    ? smooth((wind - 0.45) / 0.4) // dust is lifted by the wind, not dropped by cloud
    : w.wet * smooth((thick - 0.2) / 0.65);
  return { kind: w.kind, precip: +precip.toFixed(4), wind: +wind.toFixed(4), storm: +storm.toFixed(4), thick: +thick.toFixed(4), lightning: w.lightning && storm > 0.45 && thick > 0.6 };
}
