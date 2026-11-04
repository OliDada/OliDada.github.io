import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
for (const seed of [1,2,3,4,5,6,7]) {
  const s = generateSystem(seed);
  for (const b of s.bodies) { if (b.giant) continue; const t = terrainFor(b);
    console.log(seed, b.id, b.biome, b.radius, b.physics.pressure?.toFixed(3), b.physics.temperature|0, b.physics.waterState, (b.physics.waterCoverage??0).toFixed(2), b.physics.solvent, b.physics.volcanism?.toFixed(2), 'maxH', t.maxH.toFixed(0), 'sea', t.sea?.toFixed?.(0), b.atmosphere); }
}
