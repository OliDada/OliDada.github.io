import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import { generateSystem } from './system.mjs';
import { civilizationsIn } from './civilizations.mjs';
import { buildStationDeck, stanceOf, STANCES } from './station-deck.js';
import { designStation, ARCHETYPES, PAD_RADIUS } from './station-shape.mjs';

// A real spacefaring civilization, then the same one with its traits and path changed to
// give each way of taking a visitor.
const base = (() => { for (let s = 0; s < 20000; s++) { const c = civilizationsIn(generateSystem(s)).find(c => ['orbital', 'spacefarers', 'system-shapers'].includes(c.tier)); if (c) return c; } })();
const variant = (traits, path, extra = {}) => ({ ...base, path, ...extra, species: { ...base.species, traits: { ...base.species.traits, ...traits } } });
const CIVS = {
  welcome: variant({ sociality: 1, caution: .1, aggression: .05, perception: .3 }, 'mercantile'),
  curious: variant({ sociality: .6, caution: .1, aggression: .1, perception: .9 }, 'scholarly'),
  wary: variant({ sociality: .6, caution: .75, aggression: .05, perception: .3 }, 'devotional'),
  guarded: variant({ sociality: .5, caution: .1, aggression: .9, perception: .3 }, 'martial'),
};
const colours = { hull: '#eef1f2', trim: '#c0503a', glow: '#7fd4ff', panel: '#1b2a52', window: '#ffd98a' };
const deckFor = (civ, seed = 'test', opts = {}) => buildStationDeck(THREE, { seed, tier: civ.tier, level: 5, civ, colours, ...opts });
const dist = (c, p) => Math.hypot(c.x - p.x, c.z - p.z);
const run = (deck, player, seconds, ship = null) => { const events = []; for (let t = 0; t < seconds; t += .05) events.push(...deck.update(.05, t, player, ship)); return events; };

test('each stance comes from traits and path', () => {
  for (const s of STANCES) assert.equal(stanceOf(CIVS[s]), s);
});

test('every plan holds together, has room for pads and is at least 38 m in radius', () => {
  const fams = ['hands', 'hive', 'web', 'drifters', 'tentacles', 'rollers', 'tripods', 'nests', 'grazers', 'burrowers'], seen = new Set();
  for (let i = 0; i < 160; i++) {
    const d = designStation({ family: fams[i % fams.length], tier: ['orbital', 'spacefarers', 'system-shapers'][i % 3], ambition: (i * 37 % 100) / 100 }, `s${i}`, { mega: i % 40 === 0 });
    seen.add(d.archetype);
    assert.ok(d.E >= 38, 'at least 38 m');
    assert.ok(d.connected, `${d.archetype} holds together`);
    assert.ok(d.pads.length >= 3 && d.pads[0].guest, `${d.archetype}: pads`);
    for (const p of d.pads) assert.ok(d.walkable(p.x, p.z) && d.edgeDistFar(p.x, p.z) >= PAD_RADIUS, `${d.archetype}: pad on the deck`);
  }
  assert.ok(seen.size >= 8, `many plans (${[...seen]})`);
  for (const a of ARCHETYPES) if (!seen.has(a)) console.log('not seen:', a);
});

test('the crew get on with their work: they reach jobs, do them, and never walk through anything', () => {
  for (let k = 0; k < 6; k++) {
    const civ = variant({ sociality: .7, caution: .3, aggression: .2, perception: .4 }, ['agrarian', 'mercantile', 'scholarly', 'expansionist', 'martial', 'devotional'][k], { family: ['hands', 'hive', 'web', 'drifters', 'rollers', 'nests'][k], ambition: .3 + k * .12 });
    const deck = deckFor(civ, `crew${k}`);
    const solid = deck.obstacles().slice(0, -deck.crewCount);
    let busy = 0, samples = 0, inside = 0, off = 0;
    for (let t = 0; t < 90; t += .05) {
      deck.update(.05, t, null);
      if (Math.round(t * 20) % 10) continue;
      for (const c of deck.crew()) {
        samples++;
        if (c.state === 'job') busy++;
        if (!deck.walkable(c.x, c.z, .05)) off++;
        if (solid.some((o) => dist(c, o) < o.r + c.r * .5)) inside++;
      }
    }
    assert.equal(off, 0, `${deck.archetype}: crew stay on the deck`);
    assert.ok(inside / samples < .01, `${deck.archetype}: crew don't walk into things (${inside}/${samples})`);
    assert.ok(busy / samples > .4, `${deck.archetype}: crew spend most of their time at work (${(busy / samples).toFixed(2)})`);
  }
});

test('walking on the deck keeps you on it and out of the spire', () => {
  const deck = deckFor(CIVS.welcome);
  const p = deck.pads[0];
  let [x, z] = [p.x, p.z];
  for (let i = 0; i < 400; i++) [x, z] = deck.resolve(x, z, x + (p.x < 0 ? -.2 : .2), z, .35, 0); // walk off the edge
  assert.ok(deck.walkable(x, z, .3));
  [x, z] = deck.resolve(p.x, p.z, .1, .1, .35, 0);
  assert.ok(Math.hypot(x, z) > 2);
});

test('the crew take a visitor the way their stance says', () => {
  const at = (deck) => { const p = deck.pads[0]; return { x: p.x * .6, z: p.z * .6 }; };
  // Welcoming: two come to meet you.
  let deck = deckFor(CIVS.welcome), player = at(deck); run(deck, player, 40);
  let crew = deck.crew();
  assert.ok(crew.filter(c => dist(c, player) < 7 + c.r * 4).length >= 2, 'greeters come close');
  // Wary: nobody stays close.
  deck = deckFor(CIVS.wary); player = at(deck); run(deck, player, 40);
  assert.ok(deck.crew().every(c => dist(c, player) > 5), 'the wary keep their distance');
  // Guarded: two wardens follow at a distance, not crowding you.
  deck = deckFor(CIVS.guarded); player = at(deck); run(deck, player, 40);
  const near = deck.crew().filter(c => dist(c, player) < 14);
  assert.ok(near.length >= 2 && near.every(c => dist(c, player) > 3), 'wardens follow');
  // Curious: one comes to scan you.
  deck = deckFor(CIVS.curious); player = at(deck);
  assert.ok(run(deck, player, 40).some(e => e.type === 'scanned'), 'one of them scans you');
});
