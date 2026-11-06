// Radio signals: planet-shapers, spacefarers and system-shapers broadcast, and their
// signals carry much farther than the jump drive reaches, so the map can show where
// they are long before you can get there. Planet-shapers are heard out to 80 light
// years, spacefarers (stronger, and with transmitters in orbit) and system-shapers
// (with transmitters on every world of their system) out to 150.
// Pure: used by signals-worker.js in the background, or in slices on the main thread.
import { starsNear } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { civilizationsIn, TIERS } from './civilizations.mjs';

export const HEARD = { industrial: 30, 'planet-shapers': 80, orbital: 110, spacefarers: 150, 'system-shapers': 150 }; // a wider scan would cost too much on phones // light years, by tier
export const SCAN_RADIUS = Math.max(...Object.values(HEARD));

// The most advanced civilization broadcasting from a star's system, or null.
// Only worlds with complex life can hold one, so most systems cost just their generation.
export function broadcasterAt(star) {
  let best = null;
  for (const c of civilizationsIn(generateSystem(star.seed)))
    if (HEARD[c.tier] && (!best || TIERS.indexOf(c.tier) > TIERS.indexOf(best.tier))) best = c;
  return best;
}

// Every broadcasting system that can be heard from `center` ({x, y, z}):
// [{ id, x, y, z, tier, civ, distance }] (civ: the civilization's id), nearest first. `slice` lets a caller process the
// candidate list in parts (main-thread fallback): call with { from, to } and merge.
export function candidates(center) { return starsNear(center, SCAN_RADIUS); }
export function scan(list, from = 0, to = list.length) {
  const out = [];
  for (let i = from; i < Math.min(to, list.length); i++) {
    const { star, distance } = list[i], c = broadcasterAt(star);
    if (c && distance <= HEARD[c.tier]) out.push({ id: star.id, x: star.x, y: star.y, z: star.z, tier: c.tier, civ: c.id, distance });
  }
  return out;
}
export const radioSources = (center) => scan(candidates(center));
