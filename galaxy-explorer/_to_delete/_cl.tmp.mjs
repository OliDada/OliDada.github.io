import { generateSystem } from '../system.mjs';
import { cloudsFor } from '../clouds.mjs';
const seen = {};
for (let s = 1; s < 200; s++) for (const b of generateSystem(s).bodies) { const c = cloudsFor(b); if (!c) continue; (seen[c.kind] ||= []).push(`${s}:${b.id}:${b.biome}:cov${c.cover}:R${b.radius}:soft${c.soft}`); }
for (const [k, v] of Object.entries(seen)) console.log(k, v.length, v.slice(0, 3).join('  '));
