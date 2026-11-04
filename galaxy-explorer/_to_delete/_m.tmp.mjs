import { generateSystem } from '../system.mjs';
import { cloudsFor } from '../clouds.mjs';
for (let s = 1; s < 60; s++) { const sys = generateSystem(s); for (const b of sys.bodies) { const c = cloudsFor(b); const par = sys.bodies.find(x => x.id === b.parent?.id || x.id === b.parent); if (c && b.id.startsWith('moon') && par?.giant) console.log(s, b.id, b.biome, b.radius, c.kind, c.cover, 'parent', par.id); } }
