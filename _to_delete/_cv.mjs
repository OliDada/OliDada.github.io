import { homeStar, starsNear } from './galaxy.mjs'; import { generateSystem } from './system.mjs'; import * as C from './civilizations.mjs';
const cnt = {}; let ex = null;
for (const { star, distance } of starsNear(homeStar(), 120)) { const s = generateSystem(star.seed); for (const b of s.bodies) { const c = C.civilizationOf(b); if (c) { cnt[c.tier] = (cnt[c.tier] || 0) + 1; if (c.tier === 'system-shapers' && (!ex || distance < ex[2])) ex = [star.id, b.id, +distance.toFixed(1)]; } } }
console.log(JSON.stringify(cnt), JSON.stringify(ex));
