import test from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, MAIN, SIDE, GEAR, CHAPTERS, progress, activeResearch, advanced, matches, hint, completedWorlds, recordedOn, jumpRange, prerequisite, radioHearing, decodesSignals, exposureOf, exposureScale, landsBesideLava, hasFieldGlasses } from './upgrades.mjs';
import { nearestPlace, worldEntries, placeless } from './objectives.mjs';
import * as C from './codex.mjs';
import { generateSystem } from './system.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { geologyFor } from './geology.mjs';
import { homeStar, jumpTargets, JUMP_RANGE } from './galaxy.mjs';

// A small hand-made entry, for matching tests.
const E = (kind, traits = {}, world = {}, where = { seed: '1', bodyId: 'planet-0' }) =>
  ({ kind, ...where, id: `${kind}-${Math.random()}`, traits, world: { biome: 'Verdant', ...world } });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), key: (i) => [...m.keys()][i], get length() { return m.size; } }; };
const ids = Object.keys(UPGRADES);
const installed = (n) => new Set(MAIN.slice(0, n).map((u) => u.id));

test('one main line in order, chapters, gear, and side upgrades hanging off it', () => {
  assert.deepEqual(MAIN.map((u) => u.order), MAIN.map((_, i) => i + 1), 'main orders run 1, 2, 3, …');
  const chapters = CHAPTERS.map((c) => c.id);
  assert.deepEqual([...new Set(MAIN.map((u) => u.chapter))], chapters, 'chapters in order, none empty');
  for (const u of Object.values(UPGRADES)) {
    assert.ok(GEAR[u.gear], `${u.id}: gear`);
    assert.ok(['live', 'partial', 'planned'].includes(u.status), `${u.id}: status`);
    assert.ok(u.name && u.effect && u.needs.length, `${u.id}: name, effect and tasks`);
    for (const n of u.needs) assert.match(n.label, /^(Scan|Find|Fully|Visit|Befriend|Earn|Watch|Record|Investigate)\b/, `${u.id}: tasks read as things to do`);
    for (const n of u.needs) assert.ok((n.count ?? 1) <= 6, `${u.id}: counts stay small`);
  }
  for (const s of SIDE) assert.equal(UPGRADES[s.opensAt]?.line, 'main', `${s.id} opens at a main upgrade`);
  assert.equal(prerequisite(MAIN[0]), null);
  assert.equal(prerequisite(UPGRADES.jumpDrive2), 'orbitalSurvey');
  for (const u of MAIN.filter((x) => x.ship)) assert.equal(MAIN.indexOf(u), MAIN.findLastIndex((x) => x.chapter === u.chapter), `${u.name} ends its chapter`);
});

test('every task has a readable hint', () => {
  for (const u of Object.values(UPGRADES)) for (const n of u.needs) {
    const h = hint(n);
    assert.ok(h === null || !/undefined|null/.test(h), `${u.id}: "${n.label}" -> ${h}`);
    if (n.world || n.traits || n.special || n.anyOf) assert.ok(h, `${u.id}: "${n.label}" has a hint`);
  }
});

test('queries match names, lists, ranges, tiers and nested traits', () => {
  assert.ok(matches(E('fauna', { plan: 'slug' }), { kind: 'fauna', traits: { plan: ['serpent', 'slug'] } }));
  assert.ok(!matches(E('flora', { plan: 'slug' }), { kind: 'fauna' }));
  assert.ok(matches(E('flora', { glow: 0.6 }), { kind: ['flora', 'fauna'], traits: { glow: { min: 0.45 } } }));
  assert.ok(matches(E('formation', {}, { temperature: 150 }), UPGRADES.thermalLining.needs[0]));
  assert.ok(!matches(E('formation', {}, { temperature: 250 }), UPGRADES.thermalLining.needs[0]));
  assert.ok(matches(E('settlement', { tier: 'planet-shapers' }), UPGRADES.signalDrive.needs[0]));
  assert.ok(!matches(E('settlement', { tier: 'village builders' }), UPGRADES.signalDrive.needs[0]));
  assert.ok(matches(E('formation', { formation: 'seastacks' }), UPGRADES.pressureHull1.needs[2]), 'anyOf');
  assert.ok(!matches(E('world'), { kind: 'any' }), '"any" means things you documented');
});

test('only research can be installed: nothing unlocks by accident', () => {
  const w = (bodyId) => ({ seed: '7', bodyId });
  const plants = ['Verdant', 'Desert', 'Frozen'].map((biome, i) => E('flora', {}, { biome }, w(`p${i}`)));
  const p0 = progress(plants);
  assert.ok(p0.suitPlating.researching, 'the first step researches itself');
  assert.ok(p0.jumpDrive2.needs.every((n) => n.done), 'Jump drive II tasks are met…');
  assert.ok(!p0.jumpDrive2.ready && !p0.jumpDrive2.researching, '…but it is not ready: it is not being researched');
  const p2 = progress(plants, installed(2));
  assert.ok(p2.jumpDrive2.researching && p2.jumpDrive2.ready, 'once it is next on the line, earlier scans count');
  assert.deepEqual(activeResearch(installed(2), { side: 'lifeSonar' }), { main: 'jumpDrive2', side: 'lifeSonar' });
  assert.equal(activeResearch(installed(1), { side: 'lifeSonar' }).side, null, 'a side upgrade opens at its main upgrade');
  assert.equal(activeResearch(new Set([...installed(2), 'lifeSonar']), { side: 'lifeSonar' }).side, null, 'installed side research ends');
  assert.equal(activeResearch(new Set(MAIN.map((u) => u.id))).main, null);
});

test('distinct, spread and one-world tasks', () => {
  const w = (bodyId) => ({ seed: '7', bodyId });
  const entries = [E('formation', { formation: 'strata' }, {}, w('a')), E('formation', { formation: 'strata' }, {}, w('a')), E('flora', {}, {}, w('a')), E('flora', {}, { biome: 'Desert' }, w('b'))];
  const p = progress(entries, installed(1));
  assert.equal(progress(entries).suitPlating.needs[0].have, 3, 'three things on world a');
  assert.deepEqual(p.orbitalSurvey.needs[0].spread[0], { label: 'worlds', have: 2, need: 2 });
  assert.equal(p.deepCoreSampler.needs[0].have, 1, 'two strata are one kind');
});

test('hunting pairs and fully documented worlds, with a world filter', () => {
  const where = { seed: '3', bodyId: 'planet-1' };
  const hunter = { ...E('fauna', { diet: 'carnivore', prey: ['an-2'] }, {}, where), id: 'an-0' };
  const prey = { ...E('fauna', { diet: 'herbivore', prey: [] }, {}, where), id: 'an-2' };
  assert.equal(progress([hunter]).behaviourLogger.needs[0].have, 0);
  assert.equal(progress([hunter, prey]).behaviourLogger.needs[0].have, 1);
  const world = { ...E('world', { totals: { flora: 0, fauna: 2, formations: 1 } }, { life: 'complex' }, where), id: 'planet-1' };
  const rock = E('formation', { formation: 'basalt' }, {}, where);
  assert.equal(completedWorlds([world, hunter, rock]).length, 0);
  assert.equal(completedWorlds([world, hunter, prey, rock]).length, 1);
  assert.equal(progress([world, hunter, prey, rock]).petrel.needs[0].have, 1, 'a world with life counts for the Petrel');
  const barren = { ...world, world: { ...world.world, life: 'none' } };
  assert.equal(progress([barren, hunter, prey, rock]).petrel.needs[0].have, 0, 'a lifeless world does not');
  assert.deepEqual(recordedOn([world, hunter, prey, rock], 3, 'planet-1'), { flora: 0, fauna: 2, formation: 1 });
});

test('advanced() reports progress on research only', () => {
  const where = { seed: '9', bodyId: 'planet-0' };
  const before = [E('formation', { formation: 'strata' }, {}, where), E('flora', {}, {}, where)];
  const after = [...before, E('formation', { formation: 'basalt' }, {}, where)];
  const moved = advanced(progress(before), progress(after));
  assert.deepEqual(moved.map((m) => m.id), ['suitPlating']);
  assert.ok(moved[0].ready, 'three things on one world: Suit plating is ready');
});

test('effects read installed upgrades', () => {
  assert.equal(jumpRange(new Set()), JUMP_RANGE);
  assert.equal(jumpRange(new Set(['jumpDrive2'])), 16);
  assert.equal(jumpRange(new Set(['jumpDrive2', 'jumpDrive3'])), 24);
});

test('the codex keeps one entry per thing and saves research', () => {
  const storage = memory(), codex = C.createCodex(storage);
  const system = generateSystem(homeStar().seed), body = system.bodies.find((b) => !b.giant);
  const f = geologyFor(body).formations[0];
  assert.ok(codex.add(C.formationEntry(system, body, f)));
  assert.ok(!codex.add(C.formationEntry(system, body, f)), 'recorded once');
  codex.unlock('suitPlating');
  codex.setSide('lifeSonar');
  const again = C.createCodex(storage);
  assert.ok(again.unlocked.has('suitPlating'));
  assert.equal(again.research.side, 'lifeSonar');
  again.unlock('lifeSonar');
  assert.equal(again.research.side, null, 'installing a side upgrade ends its research');
  assert.equal(again.entries[0].traits.formation, f.key, 'stored by name');
});

test('older per-system saves are copied into the codex', () => {
  let system, body;
  for (const t of [homeStar(), ...jumpTargets(homeStar(), 30).targets.map((x) => x.star)]) {
    system = generateSystem(t.seed);
    body = system.bodies.find((b) => faunaFor(b).species.length && floraFor(b).species.length);
    if (body) break;
  }
  const storage = memory();
  storage.setItem(`elsewhere-system-${system.seed}`, JSON.stringify({
    records: [body.id], visited: [body.id],
    flora: { [body.id]: [floraFor(body).species[0].id] }, fauna: { [body.id]: [faunaFor(body).species[0].id] },
    geology: { [body.id]: [geologyFor(body).formations[0].id] }, traces: {},
  }));
  const codex = C.createCodex(storage);
  assert.equal(C.backfill(codex, storage), 5);
  assert.equal(C.backfill(codex, storage), 0, 'nothing is copied twice');
});

test('the nearest place for a task: here, this system, or a jump away', () => {
  const home = homeStar(), system = generateSystem(home.seed), start = system.bodies.find((b) => b.id === system.startId);
  const where = { star: home, system, bodyId: start.id, range: JUMP_RANGE };
  const rock = nearestPlace(UPGRADES.suitPlating.needs[0], [], where);
  assert.ok(rock?.here, 'rocks to scan right where you land');
  const plants = nearestPlace(UPGRADES.jumpDrive2.needs[0], [], where);
  assert.ok(plants && floraFor(plants.body).species.length, 'a world with plants');
  assert.equal(plants.jumps > 0, !system.bodies.some((b) => floraFor(b).species.length), 'it leaves the system only if it has to');
  const recorded = worldEntries(system, start).filter((e) => e.kind !== 'world');
  const next = nearestPlace(UPGRADES.suitPlating.needs[0], recorded, where);
  assert.ok(!next?.here, 'once this world is recorded, the place moves on');
  assert.equal(nearestPlace(UPGRADES.diplomaticProtocols.needs[0], [], where), null);
  assert.ok(placeless(UPGRADES.albatross.needs[1]));
});

// Reachability (PROGRESSION.md): the galaxy is fixed, so check it. Walking out from
// the home star, every step of the main line can be finished within a few jumps,
// and each side upgrade too. Tasks that wait on Contact are skipped.
test('the main line can be followed from the home star', () => {
  const home = homeStar(), entries = [];
  let frontier = [home];
  const seen = new Set([home.id]), first = {};
  const met = (id) => progress(entries, new Set(ids))[id].needs.every((n) => n.done || n.notYet);
  for (let hop = 0; hop <= 5; hop++) {
    if (hop) {
      const next = [];
      for (const st of frontier) for (const t of jumpTargets(st).targets) if (!seen.has(t.star.id)) { seen.add(t.star.id); next.push(t.star); }
      frontier = next;
    }
    for (const st of frontier) { const s = generateSystem(st.seed); for (const b of s.bodies) entries.push(...worldEntries(s, b)); }
    for (const id of ids) if (!(id in first) && met(id)) first[id] = hop;
  }
  const limit = { kestrel: 2, petrel: 4, albatross: 5 };
  for (const u of MAIN) assert.ok(first[u.id] <= limit[u.chapter], `${u.name} within ${limit[u.chapter]} jumps (first met at ${first[u.id] ?? 'never'})`);
  for (const u of SIDE) assert.ok(first[u.id] <= 4, `${u.name} within 4 jumps (first met at ${first[u.id] ?? 'never'})`);
  assert.equal(first.suitPlating, 0, 'the first step is finished in the home system');
});

test('effects are read from what is installed, wherever an upgrade sits in the line', () => {
  const none = new Set(), all = new Set(Object.keys(UPGRADES));
  assert.ok(radioHearing(none) < 1 && radioHearing(all) === 1, 'the receiver hears farther');
  assert.ok(!decodesSignals(none) && decodesSignals(all));
  assert.ok(!hasFieldGlasses(none) && hasFieldGlasses(all));
  assert.ok(!landsBesideLava(none) && landsBesideLava(all));
  assert.equal(exposureOf(288), 0, 'a mild world is no danger');
  assert.ok(exposureOf(150) > 0 && exposureOf(450) > 0 && exposureOf(20) <= 1);
  assert.ok(exposureScale(all) < exposureScale(none), 'thermal lining slows it');
});
