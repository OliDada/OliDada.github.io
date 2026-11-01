import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { floraFor, suitability, FORMS } from './flora.mjs';
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
    if (b.physics.life === 'microbial') for (const s of species) assert.ok(['mat', 'mound'].includes(s.form), `${b.name}: ${s.form} on a microbial world`);
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

test('plants are built and placed on dry land, away from the site and landing pad', () => {
  for (const body of living.filter(b => b.physics.life !== 'microbial').slice(0, 6)) {
    const terrain = terrainFor(body), signal = new THREE.Vector3(...terrain.site); // the dry site the game uses
    const landing = new THREE.Vector3(0, 1, 30 / body.radius).normalize().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), signal));
    const t0 = performance.now();
    const flora = buildFlora(THREE, { body, terrain, radius: body.radius, signalNormal: signal, landingNormal: landing, budget: 900 });
    assert.ok(performance.now() - t0 < 1500, 'flora took too long to build');
    let total = 0;
    for (const { positions, mesh } of flora.placed) {
      assert.equal(mesh.count, positions.length / 3);
      assert.equal(mesh.geometry.groups.length, 2);
      const m = new THREE.Matrix4(), at = new THREE.Vector3();
      for (let k = 0; k < mesh.count; k++) { mesh.getMatrixAt(k, m); at.setFromMatrixPosition(m); assert.ok(at.distanceTo(new THREE.Vector3(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2])) < 1e-4, 'instance matrix does not match its position'); }
      for (let i = 0; i < positions.length; i += 3) {
        const p = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]), n = p.clone().normalize();
        assert.ok(!terrain.climate(n).submerged, `${body.name}: plant under water`);
        assert.ok(n.angleTo(signal) >= 9 / body.radius - 1e-9 && n.angleTo(landing) >= 10 / body.radius - 1e-9);
        assert.ok(Math.abs(p.length() - (body.radius + terrain.height(n) - .05)) < 1e-3);
      }
      total += positions.length / 3;
    }
    // Ocean worlds have little dry land near the site, so fewer plants fit there.
    const expected = terrain.liquid === 'water' && terrain.coverage > .6 ? 100 : 300;
    assert.ok(total > expected, `${body.name}: only ${total} plants placed`);
  }
});
