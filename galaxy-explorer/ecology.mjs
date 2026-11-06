// Ecology: how each species lives from day to day, derived from its traits and
// its world. Pure data, no rendering; fauna-mesh.js acts on it.
//
//   activity   when it is awake: diurnal, nocturnal, crepuscular (dawn and dusk) or
//              any time. Dim stars, glowing markings and keen senses favour the night;
//              worlds that always show the star one face have no day cycle at all.
//   prey       which species it hunts. Carnivores take anything on the ground smaller
//              than themselves (fliers only small prey, other hunters only if much
//              smaller); omnivores take small non-hunters. Floaters drift out of reach. `predators` is the reverse.
//   hunger, thirst  how fast they build up (per second); metabolism sets the pace.
//   sight      how far it notices prey or danger (m), from perception.
//   stamina    how long it will chase (s): metabolism and aggression.
//   defends    big or aggressive grazers face a hunter down instead of running.
//   stalksYou  big, aggressive hunters (never intelligent ones) stalk you on foot and lunge.
//
// Draws come from their own key path, so no existing trait or world changes.
import { rng } from './rng.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ACTIVITY = ['diurnal', 'nocturnal', 'crepuscular', 'any'];

export function ecologyFor(species, body, e) {
  const p = body.physics, locked = !!p.tidallyLocked && !body.parent; // same face to the star: no days
  const seas = p.waterState === 'liquid' || ['methane', 'ammonia', 'sulfur'].includes(p.solvent);
  const out = {};
  for (const s of species) {
    const r = rng(body.seed, 'ecology', s.id), t = s.traits, flying = s.altitude[1] > 0;
    let activity = 'any';
    if (!locked && s.plan !== 'floater') {
      const w = {
        diurnal: .55 + Math.min(e.light, 1.5) * .2 - e.dim * .3,
        nocturnal: .12 + e.dim * .6 + (s.glow ? .35 : 0) + t.perception * .15 + (t.diet === 'carnivore' ? .12 : 0) - (flying ? .08 : 0),
        crepuscular: .14 + t.caution * .15,
        any: .06 + (1 - t.metabolism) * .1,
      };
      let roll = r() * Object.values(w).reduce((a, v) => a + Math.max(0, v), 0);
      for (const [k, v] of Object.entries(w)) { roll -= Math.max(0, v); if (roll <= 0) { activity = k; break; } }
    } else r();
    const prey = [];
    // Where it can hunt: its own places; fliers swoop on the ground, and divers into the sea.
    const h = s.habitats || { land: !s.aquatic && !flying, water: !!s.aquatic }, can = { land: h.land || flying, water: h.water };
    for (const o of species) {
      if (o === s || o.altitude[1] > 0) continue; // nothing catches fliers or drifters
      const oh = o.habitats || { land: !o.aquatic, water: !!o.aquatic };
      if (!((can.land && oh.land) || (can.water && oh.water))) continue; // never meet
      // Hunters take other hunters only when much smaller, so no two species hunt each other.
      const reach = (flying ? .7 : 1.15) * (o.traits.diet === 'carnivore' ? .55 : 1);
      if (t.diet === 'carnivore' && o.size < s.size * reach && o.size > s.size * .1) prey.push(o.id);
      else if (t.diet === 'omnivore' && !flying && o.traits.diet !== 'carnivore' && o.size < s.size * .55) prey.push(o.id);
    }
    out[s.id] = {
      activity, prey, predators: [],
      eatsPlants: t.diet === 'herbivore' || t.diet === 'omnivore',
      drinks: seas && !flying && s.plan !== 'floater',
      hungerRate: 1 / (50 + (1 - t.metabolism) * 110 + r() * 30) * (t.diet === 'carnivore' ? .4 : 1), // hunters eat big meals, seldom
      thirstRate: 1 / (80 + (1 - t.metabolism) * 140 + r() * 40),
      sight: 10 + t.perception * 30,
      stamina: 3 + t.metabolism * 5 + t.aggression * 3,
      defends: t.diet === 'herbivore' && s.size > .8 && (t.aggression > .3 || s.horns >= 2),
      // Big, bold hunters without a mind for culture see an explorer on foot as prey.
      stalksYou: t.diet === 'carnivore' && t.aggression > .6 && !s.civilization && s.plan !== 'floater' && s.size > (flying ? 1.3 : 1.1),
    };
  }
  for (const s of species) for (const id of out[s.id].prey) out[id].predators.push(s.id);
  // Explorers land by day: where days and nights exist, keep at least one ground
  // species awake in daylight (the least keen-eyed one is the likeliest day-dweller).
  const ground = species.filter(s => s.plan !== 'floater' && s.altitude[1] === 0 && !s.aquatic);
  if (!locked && ground.length && !ground.some(s => ['diurnal', 'any'].includes(out[s.id].activity)))
    out[ground.reduce((a, s) => s.traits.perception < a.traits.perception ? s : a).id].activity = 'diurnal';
  return out;
}

// Is a species awake when its star is at `elevation` (sine of its height in the
// sky: 1 overhead, 0 on the horizon, negative below)? Without a star, always.
export function isAwake(activity, elevation) {
  if (elevation == null || activity === 'any') return true;
  if (activity === 'diurnal') return elevation > -.08;
  if (activity === 'nocturnal') return elevation < .08;
  return Math.abs(elevation) < .3; // crepuscular
}

export function describeEcology(s, eco, species) {
  const name = (id) => species.find(o => o.id === id)?.name;
  const list = (ids) => ids.length > 2 ? `${name(ids[0])}, the ${name(ids[1])} and others` : ids.map(name).join(' and the ');
  const when = { diurnal: 'Active by day.', nocturnal: 'Active by night.', crepuscular: 'Active at dawn and dusk.', any: '' }[eco.activity];
  const hunts = eco.prey.length ? ` Hunts the ${list(eco.prey)}.` : '';
  const hunted = eco.predators.length ? ` Hunted by the ${list(eco.predators)}${eco.defends ? ', but stands its ground' : ''}.` : '';
  const danger = eco.stalksYou ? ' Dangerous: it stalks explorers on foot.' : '';
  return `${when}${hunts}${hunted}${danger}`.trim();
}

// Behaviour you can watch and record (codex kind 'behaviour'). Which ones a species
// shows follows from its ecology; what one animal is doing now comes from its state
// in fauna-mesh.js (behaviourNow).
export const BEHAVIOURS = {
  graze: { name: 'Grazing', verb: 'grazing' },
  drink: { name: 'Drinking', verb: 'drinking' },
  sleep: { name: 'Asleep', verb: 'asleep' },
  hunt: { name: 'Hunting', verb: 'hunting' },
  kill: { name: 'Feeding on a catch', verb: 'feeding on a catch' },
  defend: { name: 'Standing its ground', verb: 'standing its ground' },
};
export function behavioursOf(s, eco = s.ecology) {
  if (!eco) return [];
  const flying = s.altitude?.[1] > 0, out = [];
  if (eco.eatsPlants && !flying) out.push('graze');
  if (eco.drinks) out.push('drink');
  if (eco.activity !== 'any') out.push('sleep');
  if (eco.prey.length) out.push('hunt', 'kill');
  if (eco.defends && eco.predators.length) out.push('defend');
  return out;
}
// What a creature (fauna-mesh.js) is doing that can be recorded, or null.
export function behaviourNow(c) {
  if (!c || c.hidden) return null;
  switch (c.state) {
    case 'sleep': return 'sleep';
    case 'drink': return 'drink';
    case 'hunt': return 'hunt';
    case 'defend': return 'defend';
    case 'feed': return c.meal === 'kill' ? 'kill' : c.eco.eatsPlants ? 'graze' : null;
    case 'graze': return c.eco.eatsPlants ? 'graze' : null;
  }
  return null;
}
