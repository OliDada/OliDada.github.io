import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';
import { buildSurface } from './surface.js';
for (const [seed, w] of [[76, 'planet-1'], [12, 'planet-3'], [1, 'moon-0'], [44, 'planet-1']]) {
  const body = generateSystem(seed).bodies.find(b => b.id === w), t = terrainFor(body), R = body.radius, n = new THREE.Vector3(...t.site).normalize();
  const t0 = performance.now();
  buildSurface({ body, radius: R, signalNormal: n, landingNormal: n.clone(), surfacePoint: (m, o = 0) => m.clone().multiplyScalar(R + t.surface(m) + o), coarse: false });
  console.log(seed, w, 'buildSurface ms', (performance.now() - t0).toFixed(0));
}
