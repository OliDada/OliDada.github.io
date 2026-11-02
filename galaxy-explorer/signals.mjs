// Radio signals: planet-shapers and spacefarers broadcast, and their signals carry
// much farther than the jump drive reaches, so the map can show where they are long
// before you can get there. Planet-shapers are heard out to 80 light years,
// spacefarers (stronger, and with transmitters in orbit) out to 150.
// Pure: used by signals-worker.js in the background, or in slices on the main thread.
import { starsNear } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { faunaFor } from './fauna.mjs';

export const HEARD = { 4: 80, 5: 150 }; // light years, by civilization level
export const SCAN_RADIUS = Math.max(...Object.values(HEARD));

// The highest civilization level in a star's system (0 if none). Only worlds with
// complex life can hold one, so most systems cost just their generation.
export function civilizationAt(star) {
  let level = 0;
  for (const b of generateSystem(star.seed).bodies)
    if (b.physics?.life === 'complex') for (const s of faunaFor(b).species) level = Math.max(level, s.civilization);
  return level;
}

// Every broadcasting system that can be heard from `center` ({x, y, z}):
// [{ id, x, y, z, level, distance }], nearest first. `slice` lets a caller process the
// candidate list in parts (main-thread fallback): call with { from, to } and merge.
export function candidates(center) { return starsNear(center, SCAN_RADIUS); }
export function scan(list, from = 0, to = list.length) {
  const out = [];
  for (let i = from; i < Math.min(to, list.length); i++) {
    const { star, distance } = list[i], level = civilizationAt(star);
    if (level >= 4 && distance <= HEARD[Math.min(level, 5)]) out.push({ id: star.id, x: star.x, y: star.y, z: star.z, level, distance });
  }
  return out;
}
export const radioSources = (center) => scan(candidates(center));
