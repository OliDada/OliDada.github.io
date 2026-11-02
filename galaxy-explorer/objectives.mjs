// Where to go for a research task: the nearest world that would move it forward.
// Tasks ask about traits ("a plant on a Desert world"), so the place is worked out
// from the generators: the world you are on first, then the rest of this system,
// then star systems one and two jumps away. Pure; game.js runs it after scans and
// when research changes, and the upgrade screen shows the result ("Show on map").
import { generateSystem } from './system.mjs';
import { jumpTargets } from './galaxy.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { geologyFor } from './geology.mjs';
import { civilizationOf } from './civilizations.mjs';
import { worldEntry, floraEntry, faunaEntry, formationEntry, settlementEntry, keyOf } from './codex.mjs';
import { wouldAdvance } from './upgrades.mjs';

// Everything there is to record on a world, as codex entries.
export function worldEntries(system, body) {
  const civ = civilizationOf(body);
  return [
    worldEntry(system, body),
    ...floraFor(body).species.map((s) => floraEntry(system, body, s)),
    ...faunaFor(body).species.map((s) => faunaEntry(system, body, s)),
    ...geologyFor(body).formations.map((f) => formationEntry(system, body, f)),
    ...(civ ? [settlementEntry(system, body, civ)] : []),
  ];
}

// Tasks no world can help with (they wait on Contact, or come from the star map).
export const placeless = (need) => need.special === 'relationship' || need.kind === 'signal';

const systems = new Map();
const systemOf = (star) => {
  if (!systems.has(star.id)) { if (systems.size > 200) systems.clear(); systems.set(star.id, generateSystem(star.seed)); }
  return systems.get(star.id);
};

// The order worlds are tried in: { star, system, body, jumps } — this world, this
// system, then stars by jumps (nearest first). star is null for an off-chart system.
export function* candidateWorlds({ star, system, bodyId, range, hops = 2 }) {
  const here = system.bodies.find((b) => b.id === bodyId);
  if (here) yield { star, system, body: here, jumps: 0 };
  for (const b of system.bodies) if (b.id !== bodyId) yield { star, system, body: b, jumps: 0 };
  if (!star) return;
  let frontier = [star];
  const seen = new Set([star.id]);
  for (let hop = 1; hop <= hops; hop++) {
    const next = [];
    for (const s of frontier) for (const t of jumpTargets(s, range).targets) if (!seen.has(t.star.id)) { seen.add(t.star.id); next.push(t); }
    next.sort((a, b) => a.distance - b.distance);
    for (const t of next) { const sys = systemOf(t.star); for (const b of sys.bodies) yield { star: t.star, system: sys, body: b, jumps: hop }; }
    frontier = next.map((t) => t.star);
  }
}

// nearestPlace(need, codexEntries, { star, system, bodyId, range, hops }) ->
//   { star, system, body, jumps, here } | null
export function nearestPlace(need, entries, where) {
  if (placeless(need)) return null;
  const known = new Set(entries.map(keyOf));
  for (const c of candidateWorlds(where)) {
    const extra = worldEntries(c.system, c.body).filter((e) => !known.has(keyOf(e)) || e.kind === 'world');
    if (extra.length && wouldAdvance(need, entries, extra)) return { ...c, here: c.jumps === 0 && c.body.id === where.bodyId };
  }
  return null;
}
