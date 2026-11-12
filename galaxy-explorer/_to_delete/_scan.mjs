import { starsNear } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { civilizationsIn, tierAtLeast } from './civilizations.mjs';
import { councilStar } from './council.mjs';
const cs = councilStar(); const t0 = Date.now();
const near = starsNear(cs, 140); console.error('stars', near.length);
const out = [];
for (const { star, distance } of near) {
  if (Date.now() - t0 > 150000) break;
  let sys; try { sys = generateSystem(star.seed); } catch { continue; }
  for (const c of civilizationsIn(sys)) if (tierAtLeast(c.tier, 'orbital')) out.push([star.id, c.home, c.tier, Math.round(distance), c.species.name]);
  if (out.length >= 16) break;
}
console.log(JSON.stringify(out), (Date.now() - t0) / 1000);
