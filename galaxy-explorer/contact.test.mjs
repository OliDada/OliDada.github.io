import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSystem } from './system.mjs';
import { civilizationsIn } from './civilizations.mjs';
import { createRelations, canTalk, valueOf, stepAtLeast, giftsOf, askOf } from './contact.mjs';
import { contactEntry, floraEntry, faunaEntry } from './codex.mjs';
import { UPGRADES, needProgress } from './upgrades.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const find = (pred) => { for (let s = 0; s < 20000; s++) { const sys = generateSystem(s); const c = civilizationsIn(sys).find(pred); if (c) return { sys, c }; } };
const { sys: farSys } = find((c) => c.tier === 'village builders');
// Things from another world to show them.
const gifts = (() => { const out = []; for (let s = 100; out.length < 30; s++) { const sys = generateSystem(s); for (const b of sys.bodies) { for (const f of floraFor(b).species) out.push(floraEntry(sys, b, f)); for (const a of faunaFor(b).species) out.push(faunaEntry(sys, b, a)); } } return out; })();

test('who you can talk to depends on their tier and your upgrades', () => {
  const low = find((c) => c.tier === 'village builders').c, mid = find((c) => c.tier === 'city builders').c, high = find((c) => c.tier === 'spacefarers').c;
  assert.deepEqual(canTalk(low, new Set()), { ok: false, needs: 'xenolinguistics' });
  assert.ok(canTalk(low, new Set(['xenolinguistics'])).ok);
  assert.equal(canTalk(mid, new Set(['xenolinguistics'])).needs, 'diplomaticProtocols');
  assert.ok(canTalk(high, new Set()).ok, 'spacefarers meet you halfway');
});

test('what they value follows their path; what they know is worth little', () => {
  const { c } = find((c) => c.tier === 'spacefarers');
  const agrarian = { ...c, path: 'agrarian' }, martial = { ...c, path: 'martial' };
  const plant = gifts.find((e) => e.kind === 'flora'), hunter = gifts.find((e) => e.kind === 'fauna' && e.traits.diet === 'carnivore');
  assert.ok(valueOf(agrarian, plant) > valueOf(martial, plant));
  if (hunter) assert.ok(valueOf(martial, hunter) > valueOf(agrarian, hunter));
  const [seed, bodyId] = c.id.split(':');
  assert.ok(valueOf(c, { ...plant, seed, bodyId }) < .1, 'their own world');
  assert.equal(valueOf(c, plant, { gifts: [`${plant.kind}|${plant.seed}|${plant.bodyId}|${plant.id}`] }), 0, 'given before');
  assert.ok(askOf(c).length > 20);
});

test('the ladder: greet, give, trust, and friendship over more than one meeting', () => {
  const { c } = find((c) => c.tier === 'spacefarers');
  const rel = createRelations(store());
  let now = 0;
  rel.meet(c, now);
  assert.equal(rel.step(c.id), 'understood');
  assert.ok(!rel.greet(c, 'wary', 3).ok, 'the wary want you to wait');
  assert.ok(rel.greet(c, 'wary', 30).ok);
  assert.equal(rel.step(c.id), 'contact');
  const reached = [];
  let i = 0;
  for (let meeting = 0; meeting < 4; meeting++) {
    if (meeting) rel.meet(c, now += 31 * 60 * 1000);
    for (let k = 0; k < 3; k++) reached.push(...rel.give(c, 'wary', gifts[i++], 0, 'x').reached);
    reached.push(...rel.settle(c, 'wary'));
  }
  assert.ok(reached.includes('trust') && reached.includes('friendship'), `reached ${reached}`);
  assert.ok(stepAtLeast(rel.step(c.id), 'friendship'));
  // A fourth gift in one meeting is not taken.
  rel.meet(c, now);
  assert.ok(rel.give(c, 'wary', gifts[i++], 0, 'x').done || rel.get(c.id).given <= 3);
  assert.ok(giftsOf(c).drive > 0);
});

test('befriending a spacefaring civilization counts toward the Albatross; trust toward Diplomatic protocols', () => {
  const { sys, c } = find((c) => c.tier === 'spacefarers'), home = sys.bodies.find((b) => b.id === c.home);
  const friend = UPGRADES.albatross.needs.find((n) => n.special === 'relationship'), trust = UPGRADES.diplomaticProtocols.needs[0];
  assert.equal(needProgress(friend, []).done, false);
  const entries = ['contact', 'trust', 'friendship'].map((s) => contactEntry(sys, home, c, s));
  assert.ok(needProgress(friend, entries).done && needProgress(trust, entries).done);
  const low = find((x) => x.tier === 'village builders'), lowHome = low.sys.bodies.find((b) => b.id === low.c.home);
  const lowFriend = ['contact', 'trust', 'friendship'].map((s) => contactEntry(low.sys, lowHome, low.c, s));
  assert.ok(!needProgress(friend, lowFriend).done, 'a village is not spacefaring');
  assert.ok(needProgress(trust, lowFriend).done);
  void farSys;
});
