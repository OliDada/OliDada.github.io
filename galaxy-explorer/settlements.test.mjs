import test from 'node:test';
import assert from 'node:assert/strict';
import { networkFor, describeNetwork, landingOf } from './settlements.mjs';
import { civilizationsIn, colonistOf, EXTENT } from './civilizations.mjs';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const civs = [];
for (let s = 0; s < 3000; s++) { const sys = generateSystem(s); for (const c of civilizationsIn(sys)) civs.push({ sys, c, body: sys.bodies.find(b => b.id === c.home) }); }
const P = (n) => ({ x: n[0], y: n[1], z: n[2] });
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

test('civilizations have a temperament and an extent that grows with tier and ambition', () => {
  for (const { c } of civs) {
    for (const k of ['ambition', 'cohesion', 'harmony']) assert.ok(c[k] >= 0 && c[k] <= 1, k);
    assert.ok(EXTENT.includes(c.extent));
    if (c.tier === 'tool users') assert.equal(c.extent, 'local');
    if (c.extent === 'system') assert.equal(c.tier, 'spacefarers');
    if (c.extent === 'planetary') assert.ok(['planet-shapers', 'spacefarers'].includes(c.tier));
  }
  assert.ok(new Set(civs.map(x => x.c.extent)).size >= 4);
});

test('every civilization has a capital beside the landing site, on dry ground, and a network that fits its extent', () => {
  let missing = 0;
  for (const { body, c } of civs) {
    const t = terrainFor(body), net = networkFor(body, c, t), site = t.site, R = body.radius;
    if (!net.capital) { missing++; continue; }
    assert.deepEqual(networkFor(body, c, t), net);
    const landing = landingOf(site, R);
    for (const s of net.settlements) {
      assert.ok(!t.isLiquid(P(s.n)), `${s.kind} in the sea`);
      assert.ok(ang(s.n, site) * R > 30 && ang(s.n, landing) * R > 25, `${s.kind} on the landing site`);
    }
    if (!net.capital.far) assert.ok(ang(net.capital.n, site) * R < 300, 'capital too far from the landing site');
    // Places never overlap.
    for (let i = 0; i < net.settlements.length; i++) for (let j = i + 1; j < net.settlements.length; j++) {
      const a = net.settlements[i], b = net.settlements[j];
      assert.ok(ang(a.n, b.n) * R > (a.radius + b.radius) * .9, 'places overlap');
    }
    // Roads join real places.
    const ids = new Set(net.settlements.map(s => s.id));
    for (const r of net.roads) assert.ok(ids.has(r.a) && ids.has(r.b));
    if (c.extent === 'local') assert.ok(net.settlements.length <= 4);
    if (c.extent === 'planetary' && net.settlements.length > 8) assert.ok(Math.max(...net.settlements.map(s => ang(s.n, site))) > 1.2, 'a planetary civilization stayed local');
    if (c.tier === 'tool users') assert.ok(net.settlements.every(s => s.kind === 'camp'));
    assert.ok(describeNetwork(net).length > 4);
  }
  assert.ok(missing <= civs.length * .03, `${missing} of ${civs.length} have no capital`);
});

test('ambitious spacefarers settle other worlds of their system, never inhabited ones or giants', () => {
  let colonies = 0;
  for (const { sys, c } of civs) {
    for (const b of sys.bodies) {
      const col = colonistOf(sys, b);
      if (!col) continue;
      colonies++;
      assert.equal(col.extent, 'system');
      assert.ok(!b.giant && b.id !== col.home);
    }
    if (c.extent !== 'system') assert.ok(!sys.bodies.some(b => colonistOf(sys, b)?.id === c.id));
  }
  assert.ok(colonies > 0, 'no colonies anywhere');
});
