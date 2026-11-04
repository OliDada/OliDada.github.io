import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
import { forecast, starElevation } from './phenomena.mjs';
for (let s=1;s<=60;s++){const sys=generateSystem(s); for(const b of sys.bodies){ if(b.giant) continue; const n=terrainFor(b).site; for(const e of forecast(sys,b,n,2e6,3600)){ const el=starElevation(sys,b,n,(e.start+e.end)/2); if(!(e.end>e.start&&e.start>=2e6-1) || (e.type==='eclipse'?el<=0:el>=0)) console.log(s,b.id,e.type,e.start-2e6,e.end-e.start,el);}}}
