import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { floraFor } from './flora.mjs';
import { buildFlora } from './flora-mesh.js';
import { terrainFor } from './terrain.mjs';
const per = {}, seen = new Set();
for (let s = 1; s < 400; s++) for (const b of generateSystem(s).bodies) { const f = floraFor(b); if (!f.species.length || f.species.every(x => seen.has(x.form))) continue;
  const t = terrainFor(b); const fl = buildFlora(THREE, { body: b, terrain: t, radius: b.radius, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing) });
  for (const p of fl.placed) { const v = p.mesh.geometry.attributes.position.count; (per[p.species.form] ||= []).push(v); seen.add(p.species.form); } }
for (const [k, v] of Object.entries(per)) console.log(k, Math.round(v.reduce((a, b) => a + b) / v.length));
