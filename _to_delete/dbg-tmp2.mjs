import * as THREE from './vendor/three.module.js';
import { faunaFor } from './fauna.mjs';
import { buildFauna } from './fauna-mesh.js';
import { buildStructures } from './structures-mesh.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
const civWorlds = [];
for (let s = 0; s < 3000 && civWorlds.length < 30; s++) for (const b of generateSystem(s).bodies) if (faunaFor(b).species.some(x => x.civilization)) civWorlds.push(b);
for (const body of civWorlds) {
  const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site), landing = new THREE.Vector3(...terrain.landing);
  const fauna = buildFauna(THREE, { body, terrain, radius: body.radius, signalNormal: signal, budget: 90 });
  const t0 = performance.now(); const s = buildStructures(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: landing, fauna });
  if (s.civ) console.log(s.civ.level, s.civ.culture, s.pieces, s.group.children.filter(m => m.isMesh).map(m => m.geometry.attributes.position.count).join('+'), Math.round(performance.now() - t0) + 'ms');
}
