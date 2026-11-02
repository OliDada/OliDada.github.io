import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { faunaFor } from './fauna.mjs';
import { buildFauna } from './fauna-mesh.js';
import { buildFlora } from './flora-mesh.js';
import { isAwake, ACTIVITY } from './ecology.mjs';
import { generateSystem } from './system.mjs';
import { terrainFor } from './terrain.mjs';

const worlds = [];
for (let s = 0; s < 2500 && worlds.length < 900; s++) worlds.push(...generateSystem(s).bodies);
const living = worlds.filter(b => faunaFor(b).species.length);
const all = living.flatMap(b => faunaFor(b).species.map(s => ({ s, b, list: faunaFor(b).species })));

test('food webs follow diet and size; nothing hunts its own hunter', () => {
  let hunters = 0;
  for (const { s, list } of all) {
    const e = s.ecology, byId = Object.fromEntries(list.map(o => [o.id, o]));
    assert.ok(ACTIVITY.includes(e.activity));
    if (s.traits.diet === 'herbivore' || s.traits.diet === 'filter') assert.equal(e.prey.length, 0, `${s.name} is a ${s.traits.diet} that hunts`);
    for (const id of e.prey) {
      const o = byId[id];
      assert.ok(o !== s && o.altitude[1] === 0, `${s.name} hunts a flier or itself`);
      assert.ok(o.size < s.size * 1.15, `${s.name} hunts the much bigger ${o.name}`);
      assert.ok(!o.ecology.prey.includes(s.id), `${s.name} and ${o.name} hunt each other`);
      assert.ok(o.ecology.predators.includes(s.id));
    }
    if (s.plan === 'floater') assert.equal(e.predators.length, 0);
    hunters += e.prey.length > 0;
  }
  assert.ok(hunters > all.length * .1, `only ${hunters} of ${all.length} species hunt`);
});

test('activity cycles: dim worlds favour the night; no day cycle when tidally locked to the star', () => {
  const night = (l) => l.filter(x => x.s.ecology.activity === 'nocturnal').length / Math.max(1, l.length);
  const ground = all.filter(x => x.s.plan !== 'floater' && !(x.b.physics.tidallyLocked && !x.b.parent));
  const dim = ground.filter(x => x.s.ecology && x.b.starTemperature < 3800), bright = ground.filter(x => x.b.starTemperature > 5000);
  if (dim.length > 10 && bright.length > 10) assert.ok(night(dim) > night(bright), `night share ${night(dim).toFixed(2)} vs ${night(bright).toFixed(2)}`);
  for (const x of all) if (x.b.physics.tidallyLocked && !x.b.parent) assert.equal(x.s.ecology.activity, 'any');
  assert.ok(isAwake('diurnal', .5) && !isAwake('diurnal', -.5) && isAwake('nocturnal', -.5) && !isAwake('nocturnal', .5));
  assert.ok(isAwake('crepuscular', .05) && !isAwake('crepuscular', .8) && isAwake('any', -1) && isAwake('nocturnal', null));
});

function world(b, budget = 70) {
  const terrain = terrainFor(b), signal = new THREE.Vector3(...terrain.site);
  const flora = buildFlora(THREE, { body: b, terrain, radius: b.radius, signalNormal: signal, landingNormal: signal.clone(), budget: 600 });
  return { terrain, signal, fauna: buildFauna(THREE, { body: b, terrain, radius: b.radius, signalNormal: signal, budget, plants: flora.placed }) };
}

test('hunters catch prey, prey come back later, and herds react', () => {
  const webs = living.filter(b => b.physics.life === 'complex' && faunaFor(b).species.some(s => s.ecology.prey.length)).slice(0, 6);
  assert.ok(webs.length >= 3);
  let catches = 0, fled = 0, back = 0;
  for (const b of webs) {
    const { fauna } = world(b);
    for (const c of fauna.creatures) c.hunger = 1;
    const caught = new Set();
    for (let i = 0; i < 20 * 240; i++) { // four minutes
      fauna.update(.05, i * .05, null);
      for (const e of fauna.events) if (e.type === 'catch') { catches++; caught.add(e.prey); assert.ok(e.hunter.eco.prey.includes(e.prey.sp.id)); }
      fled += fauna.creatures.filter(c => c.state === 'flee').length > 0;
    }
    for (const c of caught) back += !c.hidden;
  }
  assert.ok(catches > 0, 'no hunt ever succeeded');
  assert.ok(fled > 0, 'prey never fled a hunter');
  assert.ok(back > 0, 'caught animals never returned');
});

test('grazers walk to plants and eat; animals drink at the shore and stay dry', () => {
  const wet = living.filter(b => b.physics.life === 'complex' && terrainFor(b).liquid === 'water').slice(0, 5);
  let fed = 0, drank = 0;
  for (const b of wet) {
    const { fauna, terrain } = world(b);
    for (const c of fauna.creatures) { c.hunger = .9; c.thirst = .95; c.timer = 0; }
    for (let i = 0; i < 20 * 90; i++) {
      fauna.update(.05, i * .05, null);
      for (const c of fauna.creatures) {
        if (c.state === 'drink') drank++;
        if (c.state === 'feed' && c.eco.eatsPlants) fed++;
        if (!c.hidden && c.sp.altitude[1] === 0) assert.ok(!terrain.isLiquid(c.n), `${c.sp.name} walked into the sea`);
      }
    }
  }
  assert.ok(fed > 0 && drank > 0, `fed ${fed}, drank ${drank}`);
});

test('animals sleep outside their time of day and wake when it comes', () => {
  const b = living.find(b => b.physics.life === 'complex' && faunaFor(b).species.some(s => s.ecology.activity === 'diurnal' && s.altitude[1] === 0));
  const { fauna } = world(b);
  const day = fauna.creatures.filter(c => c.eco.activity === 'diurnal' && c.sp.altitude[1] === 0);
  // Night for everyone: the star is straight below each diurnal animal's herd.
  const sun = day[0].herd.clone().negate();
  for (let i = 0; i < 20 * 60; i++) fauna.update(.05, i * .05, null, sun);
  const asleep = day.filter(c => c.state === 'sleep' && c.n.dot(sun) < -.08);
  assert.ok(asleep.length >= day.filter(c => c.n.dot(sun) < -.3).length * .5, `${asleep.length} of ${day.length} asleep at night`);
  for (const c of asleep) assert.ok(c.speed < .05 && (c.sink > 0 || ["serpent", "slug"].includes(c.sp.plan)));
  for (let i = 0; i < 20 * 3; i++) fauna.update(.05, 60 + i * .05, null, sun.clone().negate());
  assert.ok(day.every(c => c.state !== 'sleep'), 'still asleep at noon');
});

test('ecology costs little per frame', () => {
  const b = living.filter(b => b.physics.life === 'complex').sort((x, y) => faunaFor(y).species.length - faunaFor(x).species.length)[0];
  const { fauna } = world(b, 90);
  for (let i = 0; i < 200; i++) fauna.update(.016, i * .016, null, new THREE.Vector3(0, 1, 0));
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) fauna.update(.016, 4 + i * .016, null, new THREE.Vector3(0, 1, 0));
  const ms = (performance.now() - t0) / 600;
  assert.ok(ms < 2, `${ms.toFixed(2)} ms per frame for ${fauna.creatures.length} animals`);
});

test('danger: big aggressive hunters stalk and lunge at you on foot, but never aboard ship, and intelligent species never do', () => {
  const b = living.find(b => b.physics.life === 'complex' && faunaFor(b).species.some(s => s.ecology.stalksYou && s.altitude[1] === 0));
  assert.ok(b, 'no world with a ground stalker');
  for (const x of living) for (const s of faunaFor(x).species) if (s.ecology.stalksYou) assert.ok(s.traits.diet === 'carnivore' && !s.civilization && s.size > 1.1);
  const run = (onFoot) => {
    const { fauna } = world(b);
    const hunter = fauna.creatures.find(c => c.eco.stalksYou && c.sp.altitude[1] === 0);
    hunter.cooldown = 0;
    // Stand 12 m ahead of it, still.
    const n = hunter.n.clone().applyAxisAngle(hunter.n.clone().cross(hunter.heading).normalize(), 12 / b.radius).normalize();
    const player = { position: n.multiplyScalar(b.radius + terrainFor(b).surface(n)), onFoot };
    const events = [];
    for (let i = 0; i < 20 * 15; i++) { fauna.update(.05, i * .05, player); events.push(...fauna.events.filter(e => e.creature === hunter)); }
    return events;
  };
  const onFoot = run(true);
  assert.ok(onFoot.some(e => e.type === 'stalk'), 'it never noticed you');
  const hits = onFoot.filter(e => e.type === 'attack');
  assert.ok(hits.length >= 1 && hits.length <= 2, `${hits.length} lunges in 15 s`);
  for (const h of hits) assert.ok(h.damage > .1 && h.damage <= .45);
  assert.equal(run(false).filter(e => e.type === 'attack').length, 0, 'attacked you aboard the ship');
});
