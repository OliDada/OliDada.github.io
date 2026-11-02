import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { faunaFor } from './fauna.mjs';
import { terrainFor } from './terrain.mjs';
import { buildFauna } from './fauna-mesh.js';
const worlds = [];
for (let s = 0; s < 2500 && worlds.length < 900; s++) worlds.push(...generateSystem(s).bodies);
const living = worlds.filter(b => faunaFor(b).species.length);
const complex = living.filter(b => b.physics.life === 'complex').slice(0, 4);
for (const body of complex) {
  const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site);
  const fauna = buildFauna(THREE, { body, terrain, radius: body.radius, signalNormal: signal, budget: 60 });
  for (let i = 0; i < 1200; i++) fauna.update(.05, i * .05, null);
  const prey = fauna.creatures.find(c => c.sp.behavior === 'skittish');
  if (!prey) continue;
  const player = { position: prey.n.clone().multiplyScalar(body.radius + terrain.surface(prey.n)).add(prey.heading.clone().multiplyScalar(2)), onFoot: true };
  const before = prey.n.angleTo(player.position.clone().normalize());
  for (let i = 0; i < 40; i++) fauna.update(.05, i * .05, player);
  console.log(body.name, body.physics.biochemistry, prey.sp.name, prey.sp.plan, prey.sp.speed, before, prey.n.angleTo(player.position.clone().normalize()), prey.state, prey.speed);
}
