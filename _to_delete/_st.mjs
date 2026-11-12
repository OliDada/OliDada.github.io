import { homeStar, starsNear, starPhysics } from './galaxy.mjs';
const h = homeStar();
for (const r of [60, 120, 200]) { const t = Date.now(); const l = starsNear(h, r); const t2 = Date.now(); l.slice(0, 20000).forEach(e => starPhysics(e.star)); console.log(r, l.length, t2 - t, 'ms', Date.now() - t2, 'ms phys'); }
