import * as THREE from '../vendor/three.module.js';
import { generateSystem } from '../system.mjs';
import { terrainFor } from '../terrain.mjs';
import { buildGeology } from '../geology-mesh.js';
const worlds = []; for (let s = 1; worlds.length < 40; s++) worlds.push(...generateSystem(s).bodies.filter(b => !b.giant));
let worst = 0, tot = 0, maxN = 0;
for (const body of worlds) { const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site);
  const t = performance.now(); const g = buildGeology(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: signal });
  const dt = performance.now() - t; worst = Math.max(worst, dt); tot += dt; const n = g.placed.reduce((a,p)=>a+p.scales.length,0); maxN = Math.max(maxN,n); }
console.log('avg ms', (tot/worlds.length).toFixed(1), 'worst', worst.toFixed(1), 'max instances', maxN);
