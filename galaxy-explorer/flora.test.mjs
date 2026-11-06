import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { floraFor, suitability, FORMS, plantBiome, PLANT_BIOMES, biomeAffinity } from './flora.mjs';
import { rng } from './rng.mjs';
import { buildFlora } from './flora-mesh.js';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const worlds = [];
for (let s = 0; s < 1500 && worlds.length < 400; s++) for (const b of generateSystem(s).bodies) worlds.push(b);
const living = worlds.filter(b => floraFor(b).species.length);
const hueOf = (hex) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (!d) return 0; return (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; };

test('only living worlds have plants, and microbial worlds only microbial forms', () => {
  assert.ok(living.length > 10, `only ${living.length} worlds with flora`);
  for (const b of worlds) {
    const { species } = floraFor(b);
    if (b.physics.life === 'none') assert.equal(species.length, 0);
    if (b.physics.life === 'microbial') for (const s of species) assert.ok(['mat', 'mound', 'reefmound'].includes(s.form), `${b.name}: ${s.form} on a microbial world`);
    if (b.physics.life === 'complex' && species.length) assert.ok(species.length >= 5);
  }
});

test('species are deterministic, well-formed and described', () => {
  for (const b of living) {
    assert.deepEqual(floraFor(b), floraFor(b));
    for (const s of floraFor(b).species) {
      assert.ok(FORMS[s.form] && s.height > 0 && s.height < 30);
      for (const c of Object.values(s.colors)) assert.match(c, /^#[0-9a-f]{6}$/);
      assert.ok(s.description.length > 20 && s.name.split(' ').length >= 2);
    }
  }
});

test('the environment shapes plants: dim red suns darken leaves, low gravity grows them taller', () => {
  const red = living.filter(b => b.starTemperature < 3800 && b.physics.life !== 'microbial'), sun = living.filter(b => b.starTemperature > 5200 && b.starTemperature < 6600);
  const greenShare = (list) => { const all = list.flatMap(b => floraFor(b).species); return all.filter(s => { const h = hueOf(s.colors.leaf); return h > 70 && h < 160; }).length / Math.max(1, all.length); };
  if (red.length && sun.length) assert.ok(greenShare(sun) > greenShare(red) + .3, `green under sun ${greenShare(sun)} vs red dwarf ${greenShare(red)}`);
  const trees = living.flatMap(b => floraFor(b).species.filter(s => ['tree', 'conifer', 'palm', 'stalk'].includes(s.form)).map(s => ({ s, g: b.physics.gravity })));
  const low = trees.filter(t => t.g < .6), high = trees.filter(t => t.g > 1.2), avg = (l) => l.reduce((a, t) => a + t.s.height, 0) / l.length;
  if (low.length > 2 && high.length > 2) assert.ok(avg(low) > avg(high));
});

test('suitability is 0 underwater and peaks in the preferred climate', () => {
  const s = floraFor(living[0]).species[0], h = s.habitat;
  assert.equal(suitability(s, { submerged: true, localT: h.T, moist: h.moist, above: 2, altitude: .3 }), 0);
  const best = suitability(s, { submerged: false, localT: h.T, moist: h.moist, above: 1.5, altitude: h.highland ? .8 : .3 });
  const worse = suitability(s, { submerged: false, localT: h.T + 60, moist: h.moist, above: 1.5, altitude: .3 });
  assert.ok(best > .3 && worse < best * .1);
});

test('plants near the landing pad are built at once, on dry land, away from the site and pad', () => {
  const sparse = [];
  for (const body of living.filter(b => b.physics.life !== 'microbial').slice(0, 6)) {
    const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site); // the dry site the game uses
    const landing = new THREE.Vector3(...terrain.landing);
    const t0 = performance.now();
    const flora = buildFlora(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: landing, budget: 900 });
    assert.ok(performance.now() - t0 < 1500, 'flora took too long to build');
    let total = 0;
    for (const { positions, meshes, species } of flora.placed) {
      // Every plant drawn is listed, at the position its instance is drawn at.
      const drawn = [], m = new THREE.Matrix4(), at = new THREE.Vector3();
      for (const mesh of meshes) {
        assert.equal(mesh.geometry.groups.length, 2);
        for (let k = 0; k < mesh.count; k++) { mesh.getMatrixAt(k, m); drawn.push(at.setFromMatrixPosition(m).clone()); }
      }
      assert.equal(drawn.length, positions.length / 3);
      for (const d of drawn) assert.ok(drawn.length && [...Array(positions.length / 3).keys()].some(k => d.distanceTo(new THREE.Vector3(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2])) < 1e-3), 'instance matrix does not match a position');
      for (let i = 0; i < positions.length; i += 3) {
        const p = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]), n = p.clone().normalize();
        assert.ok(!!terrain.climate(n).submerged === !!species.aquatic, `${body.name}: ${species.aquatic ? 'sea plant on land' : 'plant under water'}`);
        assert.ok(n.angleTo(signal) >= 9 / body.radius - 1e-9 && n.angleTo(landing) >= 10 / body.radius - 1e-9);
        assert.ok(Math.abs(p.length() - (body.radius + terrain.height(n) - .05)) < 1e-3);
      }
      total += positions.length / 3;
    }
    // Ocean worlds have little dry land near the site, so fewer plants fit there;
    // dry scrub and barren ground are sparse.
    const expected = terrain.liquid === 'water' && terrain.coverage > .6 ? 30 : 100;
    if (total <= expected) sparse.push(`${body.name}: only ${total} plants placed`);
  }
  // Plant biomes grow with the world, so on a big world a landing can fall in a
  // stretch of dry scrub or barren ground: allowed for one world in six, not more.
  assert.ok(sparse.length <= 1, sparse.join('; '));
});

// Walks to random dry spots and lets the plants fill in around each one.
function plantsAround(flora, terrain, body, n, within = 150) {
  const cam = n.clone().multiplyScalar(body.radius + terrain.surface(n) + 1.7);
  for (let k = 0; k < 4000 && (k < 3 || flora.busy); k++) flora.update(k / 60, cam);
  flora.update(99, cam);
  let count = 0;
  for (const { positions } of flora.placed) for (let i = 0; i < positions.length; i += 3)
    if (Math.hypot(positions[i] - cam.x, positions[i + 1] - cam.y, positions[i + 2] - cam.z) < within) count++;
  return count;
}

test('plants grow all over the world, not just around the landing site', () => {
  let worldsChecked = 0;
  for (const body of living.filter(b => b.physics.life === 'complex').slice(0, 5)) {
    const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site), landing = new THREE.Vector3(...terrain.landing);
    const flora = buildFlora(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: landing, budget: 1600 });
    const r = rng(body.seed, 'flora-test'), counts = [];
    for (let k = 0; k < 400 && counts.length < 8; k++) {
      const y = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - y * y), n = new THREE.Vector3(q * Math.cos(a), y, q * Math.sin(a));
      if (terrain.isLiquid(n) || n.angleTo(landing) * body.radius < 600) continue;
      const biome = flora.biomeAt(n);
      if (biome === 'barren' || biome === 'dryland' || biome === 'highland') continue; // sparse by nature
      counts.push(plantsAround(flora, terrain, body, n));
    }
    if (counts.length < 4) continue;
    worldsChecked++;
    const atSite = plantsAround(flora, terrain, body, landing), mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    assert.ok(counts.filter(c => c > 20).length >= counts.length * .75, `${body.name}: plants missing far from the site: ${counts}`);
    assert.ok(atSite < mean * 3 + 60, `${body.name}: the site (${atSite}) is far denser than elsewhere (${mean.toFixed(0)})`);
  }
  assert.ok(worldsChecked >= 3, `only ${worldsChecked} worlds checked`);
});

test('the same plants are in the same places when you come back', () => {
  const body = living.find(b => b.physics.life === 'complex'), terrain = terrainFor(body);
  const landing = new THREE.Vector3(...terrain.landing), signal = new THREE.Vector3(...terrain.site);
  const flora = buildFlora(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: landing, budget: 1600 });
  const snapshot = () => { plantsAround(flora, terrain, body, landing); return flora.placed.map(p => Array.from(p.positions).map(v => v.toFixed(3)).sort().join()).join('|'); };
  const before = snapshot();
  plantsAround(flora, terrain, body, landing.clone().negate()); // the far side of the world
  assert.equal(snapshot(), before);
});

test('plant biomes: several on a world, forests thick and dry scrub sparse', () => {
  let forest = 0, dry = 0, kinds = new Set();
  for (const body of living.filter(b => b.physics.life === 'complex').slice(0, 8)) {
    const terrain = terrainFor(body), e = floraFor(body).environment, seen = new Set();
    for (let k = 0; k < 400; k++) { const n = new THREE.Vector3().randomDirection(), b = plantBiome(terrain.climate(n), e); if (b) seen.add(b); }
    assert.ok(seen.size >= 3, `${body.name}: only ${[...seen]}`);
    for (const b of seen) kinds.add(b);
  }
  assert.ok(kinds.size >= 5, `only ${[...kinds]} across worlds`);
  assert.ok(PLANT_BIOMES.forest.density > 3 * PLANT_BIOMES.dryland.density && PLANT_BIOMES.barren.density < .1);
  // Each biome favours its own forms.
  assert.ok(biomeAffinity('forest', 'tree') > biomeAffinity('dryland', 'tree') * 5);
  assert.ok(biomeAffinity('dryland', 'succulent') > biomeAffinity('forest', 'succulent'));
  assert.ok(biomeAffinity('wetland', 'mat') > biomeAffinity('highland', 'mat'));
});
