import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { civilizationOf } from './civilizations.mjs';
import { terrainFor } from './terrain.mjs';
import { buildSurface } from './surface.js';

// The first few worlds with village or city builders.
const worlds = [];
for (let s = 0; s < 3000 && worlds.length < 2; s++) for (const body of generateSystem(s * 7919 + 13).bodies) {
  const civ = civilizationOf(body);
  if (civ && !body.giant && ['village builders', 'city builders', 'industrial'].includes(civ.tier) && worlds.length < 2) worlds.push(body);
}

test('townsfolk go about their work among their buildings and never walk into them', () => {
  for (const body of worlds) {
    const t = terrainFor(body), R = body.radius;
    const site = buildSurface({ body, radius: R, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing), surfacePoint: (n, o = 0) => n.clone().multiplyScalar(R + t.surface(n) + o), coarse: true });
    const sp = site.structures.civ.species, folk = site.fauna.creatures.filter((c) => c.sp.id === sp.id && c.spots);
    assert.ok(folk.length >= 3, 'townsfolk have places to go');
    let at = 0, inside = 0, n = 0;
    for (let time = 0; time < 120; time += .05) {
      site.fauna.update(.05, time, null, null);
      if (Math.round(time * 20) % 10) continue;
      for (const c of folk) {
        n++; if (['atSpot', 'hunt', 'feed', 'sleep', 'duty', 'play', 'inside', 'meeting'].includes(c.state)) at++; // at something (hunters among them hunt)
        const p = c.n.clone().multiplyScalar(R + t.surface(c.n));
        if (site.structures.obstacles.some((o) => { const d = p.clone().sub(o.p); d.addScaledVector(c.n, -d.dot(c.n)); return d.length() < o.r * .9; })) inside++;
      }
    }
    assert.equal(inside, 0, `${sp.name}: never inside a building`);
    assert.ok(at / n > .4, `${sp.name}: mostly at something (${(at / n).toFixed(2)})`);
  }
});

test('a spaceborne civilization leaves empty, overgrown towns and no one in them', async () => {
  let body = null;
  for (let s = 0; s < 40000 && !body; s++) for (const b of generateSystem(s * 7919 + 13).bodies) if (civilizationOf(b)?.spaceborne) { body = b; break; }
  assert.ok(body, 'found one');
  const civ = civilizationOf(body), t = terrainFor(body), R = body.radius;
  assert.match(civ.description, /left their world/);
  const site = buildSurface({ body, radius: R, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing), surfacePoint: (n, o = 0) => n.clone().multiplyScalar(R + t.surface(n) + o), coarse: true });
  assert.ok(site.structures.ruins && site.structures.pieces > 0, 'ruins stand');
  assert.ok(!site.structures.station && !site.structures.flights.length, 'nothing in the sky');
  assert.equal(site.structures.nightLights.points.length, 0, 'dark at night');
  assert.ok(!site.fauna.species.some((s) => s.id === civ.species.id), 'none of them left');
});

test('townsfolk come out to meet you as their stance has it, and wild animals keep out of cities', () => {
  let body = null;
  for (let s = 0; s < 3000 && !body; s++) for (const b of generateSystem(s * 7919 + 13).bodies) { const c = civilizationOf(b); if (c && !b.giant && ['city builders', 'industrial'].includes(c.tier)) { body = b; break; } }
  const t = terrainFor(body), R = body.radius;
  const site = buildSurface({ body, radius: R, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing), surfacePoint: (n, o = 0) => n.clone().multiplyScalar(R + t.surface(n) + o), coarse: true });
  const f = site.fauna, sp = site.structures.civ.species;
  // No wild ground animal lives inside a city (herds were moved out), and none wanders in.
  const zones = site.structures.places.map((p) => ({ n: p.n, r: p.r + 15 }));
  const wildInside = () => f.creatures.filter((c) => c.sp.id !== sp.id && !c.kept && !c.sp.aquatic && !c.hidden && !c.band.dry && zones.some((z) => z.n.angleTo(c.n) * R < z.r - 4)).length;
  assert.equal(wildInside(), 0, 'none at the start');
  for (let time = 0; time < 40; time += .05) f.update(.05, time, null, null);
  // (An animal running for its life may cut through a town for a moment; fauna-mesh.js allows that.)
  const wildWandered = () => f.creatures.filter((c) => c.sp.id !== sp.id && !c.kept && !c.sp.aquatic && !c.hidden && !c.band.dry && c.state !== 'flee' && zones.some((z) => z.n.angleTo(c.n) * R < z.r - 4)).length;
  assert.ok(wildWandered() <= 1, `none wander in (${wildWandered()})`);
  // Welcoming: a crowd at the edge of the landing ground, facing you, greeting.
  const folk = f.creatures.filter((c) => c.sp.id === sp.id && c.spots);
  const at = folk[0].n.clone();
  const came = f.arrive(at, 'welcome');
  assert.ok(came >= 2, `some came (${came})`);
  const ship = at.clone().multiplyScalar(R + t.surface(at));
  let greeted = 0;
  for (let time = 40; time < 72; time += .05) { f.update(.05, time, { position: ship, onFoot: false }, null); for (const c of folk) if (c.ex?.gesture) c.greeted = true; }
  const meeting = folk.filter((c) => c.state === 'meeting');
  greeted = folk.filter((c) => c.greeted).length;
  assert.ok(meeting.length >= Math.min(2, came), `they wait at the edge (${meeting.length}/${came})`);
  assert.ok(greeted >= 1, 'and greet you');
  for (const c of meeting) { const d = c.n.angleTo(at) * R; assert.ok(d > 4 && d < 30, `at the edge of the landing ground (${d.toFixed(1)} m)`); }
  // Talking to one: it stops and turns to face you.
  const one = meeting[0] || folk[0], me = one.n.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0).cross(one.n).normalize(), 5 / R);
  f.talkWith(one, 'welcome');
  const pos = me.clone().multiplyScalar(R + t.surface(me));
  for (let time = 72; time < 76; time += .05) f.update(.05, time, { position: pos, onFoot: true }, null);
  const toMe = pos.clone().sub(one.n.clone().multiplyScalar(R)); toMe.addScaledVector(one.n, -toMe.dot(one.n)).normalize();
  assert.equal(one.state, 'talk');
  assert.ok(one.heading.dot(toMe) > .7, `faces you (${one.heading.dot(toMe).toFixed(2)})`);
  f.talkWith(null);
  assert.notEqual(one.state, 'talk');
});

test('townsfolk going across town keep to the streets, and now and then go indoors', () => {
  let routed = 0, inside = 0, tried = 0;
  for (let s = 0; s < 3000 && tried < 2; s++) for (const body of generateSystem(s * 7919 + 13).bodies) {
    const civ = civilizationOf(body);
    if (!civ || body.giant || civ.spaceborne || !['village builders', 'city builders', 'industrial'].includes(civ.tier) || tried >= 2) continue;
    const t = terrainFor(body), R = body.radius;
    const site = buildSurface({ body, radius: R, signalNormal: new THREE.Vector3(...t.site), landingNormal: new THREE.Vector3(...t.landing), surfacePoint: (n, o = 0) => n.clone().multiplyScalar(R + t.surface(n) + o), coarse: true });
    if (!site.structures.paths?.length) continue; // builders that lay no streets go straight
    tried++;
    const sp = site.structures.civ.species, folk = site.fauna.creatures.filter((c) => c.sp.id === sp.id && c.spots);
    for (let time = 0; time < 240; time += .05) {
      site.fauna.update(.05, time, null, null);
      for (const c of folk) { if (c.route?.length) routed++; if (c.state === 'inside') inside++; }
    }
  }
  assert.ok(routed > 0, 'some trips follow the streets');
  assert.ok(inside > 0, 'some go indoors');
});
