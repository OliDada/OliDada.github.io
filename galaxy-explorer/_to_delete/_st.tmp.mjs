import { generateSystem } from '../system.mjs';
import { cloudsFor } from '../clouds.mjs';
import { weatherOf, stormsAt } from '../weather.mjs';
import { orbitClock } from '../orbits.mjs';
const t = orbitClock() + 30;
for (let s = 1; s < 40; s++) for (const b of generateSystem(s).bodies) { const c = cloudsFor(b); if (!c) continue; const w = weatherOf(b, c); const st = stormsAt(b, c, t, w); const k = Math.max(0, ...st.map(x => x.k)); if (k > 0.6 && ['rain','dust','snow','ash'].includes(w.kind)) console.log(s, b.id, b.biome, w.kind, k.toFixed(2)); }
