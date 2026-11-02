// The upgrade line (PROGRESSION.md): what you document becomes the knowledge your
// gear is built from. Plain data plus the code that checks it against the codex
// (codex.mjs), so it can be tested with node --test and read by the game and the UI.
//
// Shape: ONE main line, upgraded step by step in `order`, grouped into chapters named
// after the ship you fly (Kestrel, Petrel, Albatross). The next main upgrade is always
// being researched. Side upgrades hang off the line (`opensAt`: a main upgrade); you
// may research one of them at the same time. Only what you are researching can be
// installed, so nothing unlocks by accident; scans made earlier still count.
// Each upgrade has a `gear`: ship, suit, scanner, vehicle or knowledge.
//
// A task ("need") is a question about traits, never a named species:
//   { label, count = 1,
//     kind:     'flora' | 'fauna' | 'formation' | 'settlement' | 'field-note' | 'world' | 'signal' | [...] | 'any',
//     world:    { biome: [...], waterState: 'liquid', giant: true, gravity: { max: .5 }, … },
//     traits:   { plan: [...], glow: { min: .45 }, habitat: { shore: true }, tier: { atLeast: 'city builders' }, … },
//     anyOf:    [query, query]      matches if any query matches (instead of kind/world/traits)
//     distinct: 'traits.formation'  count different values instead of entries
//     spread:   { 'world.biome': 3 } and the matches must cover this many different values
//     sameWorld: true               all on one world
//     special:  'hunt' | 'complete' | 'relationship' }
// A value in a query is a name, a list of names (any of them), { min, max } or { atLeast: tier }.
// Labels are written as tasks ("Scan …"). Hints and the nearest place to go
// (objectives.mjs) are worked out from the query, never written per upgrade.
import { DOCUMENTED } from './codex.mjs';
import { tierAtLeast } from './civilizations.mjs';
import { JUMP_RANGE } from './galaxy.mjs';

export const GEAR = {
  ship: { name: 'Ship', icon: 'rocket' },
  suit: { name: 'Suit', icon: 'helmet' },
  scanner: { name: 'Scanner', icon: 'scan' },
  vehicle: { name: 'Vehicle', icon: 'drone' },
  knowledge: { name: 'Knowledge', icon: 'language' },
};
export const CHAPTERS = [
  { id: 'kestrel', name: 'Kestrel', blurb: 'Your first ship. Learn to scan, then reach farther.' },
  { id: 'petrel', name: 'Petrel', blurb: 'A sea and storm ship: under water, and the first contact with other minds.' },
  { id: 'albatross', name: 'Albatross', blurb: 'The deep-range ship: into giants and across the galaxy.' },
];

// status: what installing does in the game today.
//   'live' the effect works · 'partial' part of it works (`built` says which) · 'planned' still a to-do item
const ROCK = (formation) => ({ kind: 'formation', traits: { formation } });
const DRIFTER = { kind: 'fauna', traits: { plan: 'floater' } };
const LIVING = ['flora', 'fauna'];
export const UPGRADES = {
  // ===== Main line: chapter Kestrel =====
  suitPlating: {
    line: 'main', order: 1, chapter: 'kestrel', gear: 'suit', name: 'Suit plating', status: 'live',
    effect: 'Your suit takes 30% less damage and recovers twice as fast.',
    needs: [{ label: 'Scan 3 things on one world', kind: 'any', sameWorld: true, count: 3 }],
  },
  orbitalSurvey: {
    line: 'main', order: 2, chapter: 'kestrel', gear: 'ship', name: 'Orbital survey', status: 'partial',
    effect: "See a world's biome, chemistry and life before landing.",
    built: 'the long-range scan already shows life at stars in jump range',
    needs: [{ label: 'Scan 5 things, on 2 different worlds', kind: 'any', count: 5, spread: { world: 2 } }],
  },
  jumpDrive2: {
    line: 'main', order: 3, chapter: 'kestrel', gear: 'ship', name: 'Jump drive II', status: 'live',
    effect: 'Jump range 12 → 16 light years.',
    needs: [
      { label: 'Scan 3 plants', kind: 'flora', count: 3 },
      { label: 'Scan things on 3 kinds of world', kind: 'any', distinct: 'world.biome', count: 3 },
    ],
  },
  thermalLining: {
    line: 'main', order: 4, chapter: 'kestrel', gear: 'suit', name: 'Thermal lining', status: 'planned',
    effect: 'Stay out longer on very hot and very cold worlds.',
    needs: [
      { label: 'Scan something on a world colder than −80 °C', kind: 'any', world: { temperature: { max: 193 } } },
      { label: 'Scan something on a world hotter than 80 °C', kind: 'any', world: { temperature: { min: 353 } } },
    ],
  },
  heatPlating: {
    line: 'main', order: 5, chapter: 'kestrel', gear: 'ship', name: 'Heat plating', status: 'partial',
    effect: 'The hull heats up more slowly near stars, and you can land right beside lava.',
    built: 'slower hull heating works; landing beside lava comes later',
    needs: [
      { label: 'Scan volcanic rock or a volcanic landform', ...ROCK(['basalt', 'obsidian', 'columns', 'fumaroles']) },
      { label: 'Scan 2 animals', kind: 'fauna', count: 2 },
    ],
  },
  petrel: {
    line: 'main', order: 6, chapter: 'kestrel', gear: 'ship', ship: true, name: 'Petrel', status: 'planned',
    effect: 'A new ship for seas and storms. Opens the Petrel chapter.',
    needs: [{ label: 'Fully document 2 worlds with life: every plant, animal and rock', special: 'complete', count: 2, world: { life: ['microbial', 'simple', 'complex'] } }],
  },
  // ===== Main line: chapter Petrel =====
  pressureHull1: {
    line: 'main', order: 7, chapter: 'petrel', gear: 'ship', name: 'Pressure hull I', status: 'planned',
    effect: 'Dive into liquid seas, down to the shallows.',
    needs: [
      { label: 'Scan 3 animals on worlds with seas', kind: 'fauna', world: { waterState: 'liquid' }, count: 3 },
      { label: 'Scan a coil or a creeper', kind: 'fauna', traits: { plan: ['serpent', 'slug'] } },
      { label: 'Scan sea stacks or a shoreline plant', anyOf: [ROCK('seastacks'), { kind: 'flora', traits: { habitat: { shore: true } } }] },
    ],
  },
  xenolinguistics: {
    line: 'main', order: 8, chapter: 'petrel', gear: 'knowledge', name: 'Xenolinguistics', status: 'planned',
    effect: 'Settlements give longer field notes; attempt contact with tool users and village builders.',
    needs: [{ label: 'Find a settlement', kind: 'settlement' }],
  },
  pressureHull2: {
    line: 'main', order: 9, chapter: 'petrel', gear: 'ship', name: 'Pressure hull II', status: 'planned',
    effect: 'Deep dives, and the oceans hidden under the ice of frozen moons.',
    needs: [
      { label: 'Scan a drifter', ...DRIFTER },
      { label: 'Scan water ice, pingos or a cryovolcano', ...ROCK(['ice', 'pingo', 'cryovolcano']) },
    ],
  },
  jumpDrive3: {
    line: 'main', order: 10, chapter: 'petrel', gear: 'ship', name: 'Jump drive III', status: 'live',
    effect: 'Jump range 16 → 24 light years.',
    needs: [{ label: 'Scan animals of 4 different body plans', kind: 'fauna', distinct: 'traits.plan', count: 4 }],
  },
  signalDecoder: {
    line: 'main', order: 11, chapter: 'petrel', gear: 'knowledge', name: 'Signal decoder', status: 'planned',
    effect: 'Radio sources on the map say who they are and what they want.',
    needs: [{ label: 'Find a settlement of village builders or higher', kind: 'settlement', traits: { tier: { atLeast: 'village builders' } } }],
  },
  albatross: {
    line: 'main', order: 12, chapter: 'petrel', gear: 'ship', ship: true, name: 'Albatross', status: 'planned',
    effect: 'The deep-range ship. Opens the Albatross chapter.',
    needs: [
      { label: 'Scan life built on 3 different chemistries', kind: LIVING, distinct: 'world.biochemistry', count: 3 },
      { label: 'Befriend a spacefaring civilization', special: 'relationship', level: 'friendship' },
    ],
  },
  // ===== Main line: chapter Albatross =====
  cryoSeals: {
    line: 'main', order: 13, chapter: 'albatross', gear: 'ship', name: 'Cryo seals', status: 'planned',
    effect: 'Dive into seas of liquid methane and ammonia.',
    needs: [
      { label: 'Scan life on a methane world', kind: LIVING, world: { biochemistry: 'methane' } },
      { label: 'Scan life on an ammonia world', kind: LIVING, world: { biochemistry: 'ammonia' } },
    ],
  },
  cloudDiver: {
    line: 'main', order: 14, chapter: 'albatross', gear: 'ship', name: 'Cloud diver', status: 'planned',
    effect: 'Descend below 250 m into the clouds of gas and ice giants.',
    needs: [
      { label: 'Visit 3 giants with different clouds', kind: 'world', world: { giant: true }, distinct: 'world.clouds', count: 3 },
      { label: 'Scan 2 drifters', ...DRIFTER, count: 2 },
    ],
  },
  diplomaticProtocols: {
    line: 'main', order: 15, chapter: 'albatross', gear: 'knowledge', name: 'Diplomatic protocols', status: 'planned',
    effect: 'Attempt contact with city builders and above.',
    needs: [{ label: 'Earn the trust of a civilization', special: 'relationship', level: 'trust' }],
  },
  signalDrive: {
    line: 'main', order: 16, chapter: 'albatross', gear: 'ship', name: 'Signal drive', status: 'planned',
    effect: 'Jump straight to any radio source you can hear, up to 150 light years.',
    needs: [{ label: 'Find a settlement of city builders or higher', kind: 'settlement', traits: { tier: { atLeast: 'city builders' } } }],
  },
  // ===== Side upgrades: optional gear, one researched at a time =====
  lifeSonar: {
    line: 'side', opensAt: 'orbitalSurvey', gear: 'scanner', name: 'Life sonar', status: 'planned',
    effect: 'A HUD arrow points to the nearest species you have not recorded.',
    needs: [
      { label: 'Scan 4 animals', kind: 'fauna', count: 4 },
      { label: 'Scan a nocturnal animal', kind: 'fauna', traits: { activity: 'nocturnal' } },
    ],
  },
  surveyDrone: {
    line: 'side', opensAt: 'jumpDrive2', gear: 'vehicle', name: 'Survey drone', status: 'planned',
    effect: 'Scan from a distance: cliffs, skittish herds, high nests, stalkers you would rather not approach.',
    needs: [{ label: 'Scan 2 fliers', kind: 'fauna', traits: { plan: 'flyer' }, count: 2 }],
  },
  nightFilter: {
    line: 'side', opensAt: 'thermalLining', gear: 'suit', name: 'Night filter', status: 'planned',
    effect: 'See clearly at night; glowing species stand out.',
    needs: [{ label: 'Scan 2 glowing species', kind: LIVING, traits: { glow: { min: 0.45 } }, count: 2 }],
  },
  deepCoreSampler: {
    line: 'side', opensAt: 'heatPlating', gear: 'scanner', name: 'Deep core sampler', status: 'planned',
    effect: 'Rocks and landforms give a second, deeper entry: their age and origin.',
    needs: [{ label: 'Scan 6 kinds of rock or landform', kind: 'formation', distinct: 'traits.formation', count: 6 }],
  },
  returnBeacons: {
    line: 'side', opensAt: 'heatPlating', gear: 'ship', name: 'Return beacons', status: 'planned',
    effect: 'Fast-travel to any system you have fully documented.',
    needs: [{ label: 'Fully document a world: every plant, animal and rock', special: 'complete' }],
  },
  rover: {
    line: 'side', opensAt: 'petrel', gear: 'vehicle', name: 'Rover', status: 'planned',
    effect: 'Fast surface travel without taking off; a refuge on wheels from stalkers.',
    needs: [{ label: 'Scan 4 walking animals on 2 kinds of world', kind: 'fauna', traits: { legs: { min: 1 } }, count: 4, spread: { 'world.biome': 2 } }],
  },
  behaviourLogger: {
    line: 'side', opensAt: 'petrel', gear: 'scanner', name: 'Behaviour logger', status: 'planned',
    effect: 'Record behaviour: a hunt, a herd drinking, an animal asleep.',
    needs: [{ label: 'Scan a hunter and an animal it hunts, on one world', special: 'hunt' }],
  },
  decoyBeacon: {
    line: 'side', opensAt: 'pressureHull1', gear: 'suit', name: 'Decoy beacon', status: 'planned',
    effect: 'Distracts a stalker for a while. Never a weapon.',
    needs: [{ label: 'Scan 2 species that stalk explorers', kind: 'fauna', traits: { stalksYou: true }, count: 2 }],
  },
  jumpJets: {
    line: 'side', opensAt: 'pressureHull2', gear: 'suit', name: 'Jump jets', status: 'planned',
    effect: 'Much higher jumps on foot: climb ridges and cross gullies.',
    needs: [{ label: 'Scan 3 things on worlds with gravity under 0.5 g', kind: 'any', world: { gravity: { max: 0.5 } }, count: 3 }],
  },
  atmosphericProbe: {
    line: 'side', opensAt: 'jumpDrive3', gear: 'vehicle', name: 'Atmospheric probe', status: 'planned',
    effect: 'Scan the cloud layers of giants from orbit.',
    needs: [
      { label: 'Scan a drifter', ...DRIFTER },
      { label: 'Visit a gas or ice giant', kind: 'world', world: { giant: true } },
    ],
  },
};
for (const [id, u] of Object.entries(UPGRADES)) u.id = id;
export const MAIN = Object.values(UPGRADES).filter((u) => u.line === 'main').sort((a, b) => a.order - b.order);
export const SIDE = Object.values(UPGRADES).filter((u) => u.line === 'side');
// What has to be installed before an upgrade can be researched.
export const prerequisite = (u) => (u.line === 'side' ? u.opensAt : MAIN[MAIN.indexOf(u) - 1]?.id ?? null);

// --- Effects the game reads ----------------------------------------------------------
export const jumpRange = (unlocked) => unlocked.has('jumpDrive3') ? 24 : unlocked.has('jumpDrive2') ? 16 : JUMP_RANGE;
export const suitDamageScale = (unlocked) => unlocked.has('suitPlating') ? 0.7 : 1;
export const suitRecoveryScale = (unlocked) => unlocked.has('suitPlating') ? 2 : 1;
export const heatScale = (unlocked) => unlocked.has('heatPlating') ? 0.6 : 1;

// --- Matching ------------------------------------------------------------------------
const get = (e, path) => path === 'world' ? (e.world ? `${e.seed}:${e.bodyId}` : undefined)
  : path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), e);
function matchValue(v, c) {
  if (Array.isArray(c)) return c.includes(v);
  if (c && typeof c === 'object') {
    if ('atLeast' in c) return tierAtLeast(v, c.atLeast);
    if ('min' in c || 'max' in c) return typeof v === 'number' && (c.min == null || v >= c.min) && (c.max == null || v <= c.max);
    return v != null && Object.entries(c).every(([k, x]) => matchValue(v[k], x));
  }
  return v === c;
}
const worldMatches = (e, w) => !w || (e.world && Object.entries(w).every(([k, c]) => matchValue(e.world[k], c)));
export function matches(e, q) {
  if (q.anyOf) return q.anyOf.some((x) => matches(e, x));
  const kind = q.kind ?? 'any';
  if (kind === 'any' ? !DOCUMENTED.includes(e.kind) : Array.isArray(kind) ? !kind.includes(e.kind) : kind !== e.kind) return false;
  if (!worldMatches(e, q.world)) return false;
  if (q.traits && !Object.entries(q.traits).every(([k, c]) => matchValue(e.traits?.[k], c))) return false;
  return true;
}
const distinct = (list, path) => new Set(list.map((e) => get(e, path)).filter((v) => v != null)).size;

const SPREAD_WORDS = { world: 'worlds', 'world.biome': 'kinds of world', 'traits.plan': 'body plans', 'world.biochemistry': 'chemistries', 'world.clouds': 'cloud types' };
function measure(need, list) {
  const count = need.count ?? 1;
  const raw = need.distinct ? distinct(list, need.distinct) : list.length;
  const spread = Object.entries(need.spread || {}).map(([path, n]) => ({ label: SPREAD_WORDS[path] || path, have: Math.min(distinct(list, path), n), need: n }));
  return { have: Math.min(raw, count), count, spread, done: raw >= count && spread.every((s) => s.have >= s.need) };
}
const score = (m) => (m.have / m.count + m.spread.reduce((a, s) => a + s.have / s.need, 0)) / (1 + m.spread.length);
const worldKey = (e) => `${e.seed}:${e.bodyId}`;
function byWorld(list) {
  const groups = new Map();
  for (const e of list) { const k = worldKey(e); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  return [...groups.values()];
}

// What has been recorded on one world: { flora, fauna, formation } counts.
export function recordedOn(entries, seed, bodyId) {
  const c = { flora: 0, fauna: 0, formation: 0 };
  for (const e of entries) if (e.seed === String(seed) && e.bodyId === bodyId && e.kind in c) c[e.kind]++;
  return c;
}
// Worlds where every plant, animal and rock or landform that is there has been recorded.
export function completedWorlds(entries) {
  const counts = new Map();
  for (const e of entries) if (['flora', 'fauna', 'formation'].includes(e.kind)) {
    const k = worldKey(e), c = counts.get(k) || { flora: 0, fauna: 0, formation: 0 };
    c[e.kind]++; counts.set(k, c);
  }
  return entries.filter((e) => {
    if (e.kind !== 'world' || !e.traits?.totals) return false;
    const t = e.traits.totals, c = counts.get(worldKey(e)) || { flora: 0, fauna: 0, formation: 0 };
    return t.flora + t.fauna + t.formations > 0 && c.flora >= t.flora && c.fauna >= t.fauna && c.formation >= t.formations;
  });
}

// How far one task has got: { have, count, spread: [{ label, have, need }], done, notYet? }
export function needProgress(need, entries) {
  switch (need.special) {
    case 'complete': return measure(need, completedWorlds(entries).filter((e) => worldMatches(e, need.world)));
    case 'hunt': {
      const fauna = entries.filter((e) => e.kind === 'fauna');
      const seen = new Set(fauna.map((e) => `${worldKey(e)}:${e.id}`));
      return measure(need, fauna.filter((e) => e.traits.diet === 'carnivore' && e.traits.prey?.some((id) => seen.has(`${worldKey(e)}:${id}`))));
    }
    case 'relationship': return { ...measure(need, []), notYet: 'Contact' }; // relationships arrive with Contact (roadmap)
  }
  const list = entries.filter((e) => matches(e, need));
  if (!need.sameWorld) return measure(need, list);
  return byWorld(list).map((g) => measure(need, g)).reduce((best, m) => (score(m) > score(best) ? m : best), measure(need, []));
}
// Would these extra entries move a task forward? (objectives.mjs uses this to find places.)
export function wouldAdvance(need, entries, extra) {
  const a = needProgress(need, entries), b = needProgress(need, entries.concat(extra));
  return b.have > a.have || b.spread.some((s, i) => s.have > a.spread[i].have) || (b.done && !a.done);
}

// The research that is running: the next main upgrade (always), and the chosen side
// upgrade if it is still open. research: { side: id | null } from the codex.
export function activeResearch(unlocked, research = {}) {
  const main = MAIN.find((u) => !unlocked.has(u.id)) || null;
  const s = UPGRADES[research.side];
  const side = s && s.line === 'side' && !unlocked.has(s.id) && unlocked.has(s.opensAt) ? s : null;
  return { main: main?.id ?? null, side: side?.id ?? null };
}

// progress(codex.entries, codex.unlocked, codex.research) ->
//   { [id]: { id, upgrade, installed, available, researching, ready, needs: [...] } }
//   available: its prerequisite is installed · researching: main or chosen side research
//   ready: researching and every task done (only research can be installed)
export function progress(entries, unlocked = new Set(), research = {}) {
  const active = activeResearch(unlocked, research), out = {};
  for (const u of Object.values(UPGRADES)) {
    const needs = u.needs.map((n) => ({ label: n.label, ...needProgress(n, entries) }));
    const pre = prerequisite(u), installed = unlocked.has(u.id);
    const researching = !installed && (active.main === u.id || active.side === u.id);
    out[u.id] = { id: u.id, upgrade: u, installed, available: !installed && (!pre || unlocked.has(pre)), researching, ready: researching && needs.every((n) => n.done), needs };
  }
  return out;
}

// What a new entry moved forward, for research only: compare progress before and after.
// -> [{ id, name, label, have, count, spread, ready }]
export function advanced(before, after) {
  const out = [];
  for (const [id, a] of Object.entries(after)) {
    const b = before[id];
    if (!a.researching || !b) continue;
    a.needs.forEach((n, i) => {
      const o = b.needs[i];
      if (n.have > o.have || n.spread.some((s, j) => s.have > o.spread[j].have))
        out.push({ id, name: a.upgrade.name, label: n.label, have: n.have, count: n.count, spread: n.spread, ready: a.ready && !b.ready });
    });
  }
  return out;
}

// --- Hints: where to look, generated from the task -----------------------------------
const PLAN_HINTS = {
  quadruped: 'worlds with complex life', biped: 'complex-life worlds, more often with low gravity',
  hexapod: 'drier worlds with life', arachnid: 'drier worlds with life', serpent: 'drier worlds with life', slug: 'wet worlds with life',
  flyer: 'complex-life worlds with thick enough air: look up', floater: 'complex-life worlds with thick air or low gravity: look up',
  radial: 'worlds with complex life', roller: 'dry complex-life worlds',
};
const FORMATION_HINTS = {
  basalt: 'volcanic worlds, and most rocky worlds', obsidian: 'volcanic worlds', ice: 'frozen worlds and icy moons',
  columns: 'volcanic worlds', fumaroles: 'volcanic worlds with air', pingo: 'frozen worlds and icy moons', cryovolcano: 'icy, volcanically active moons',
  seastacks: 'coasts of worlds with seas',
};
const CHEM_HINTS = {
  methane: 'very cold worlds under an orange haze (violet ring on the map)', ammonia: 'cold worlds with thick air (violet ring on the map)',
  sulfur: 'hot volcanic worlds (violet ring on the map)', silicon: 'very hot worlds (violet ring on the map)', carbon: 'worlds with water-based life',
};
const asList = (v) => (Array.isArray(v) ? v : [v]);
const or = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
function hintFor(q) {
  const out = [], w = q.world || {}, t = q.traits || {};
  if (w.giant) out.push('gas and ice giants');
  if (w.biochemistry) out.push(...asList(w.biochemistry).map((c) => CHEM_HINTS[c]));
  if (w.waterState === 'liquid') out.push('Oceanic and Verdant worlds');
  if (w.gravity?.max) out.push('small moons and light worlds');
  if (w.temperature?.max) out.push('frozen worlds and far-out moons');
  if (w.temperature?.min) out.push('volcanic worlds and worlds close to their star');
  if (t.plan) out.push(...asList(t.plan).map((p) => PLAN_HINTS[p]));
  if (t.formation) out.push(...asList(t.formation).map((f) => FORMATION_HINTS[f]));
  if (t.habitat?.shore) out.push('coasts of worlds with seas');
  if (t.legs) out.push('worlds with animals (bold green rings on the map)');
  if (t.glow) out.push('dim worlds around red dwarfs');
  if (t.activity === 'nocturnal') out.push('worlds with day and night, after dark');
  if (t.stalksYou) out.push('complex-life worlds with big hunters; keep your distance');
  if (t.tier) out.push('worlds with intelligent life (SIGNALS on the map)');
  return out.filter(Boolean);
}
export function hint(need) {
  if (need.special === 'hunt') return "Complex-life worlds: an animal's card says what it hunts.";
  if (need.special === 'complete') return 'The HUD counts what is left on the world you are on.';
  if (need.special === 'relationship') return 'Arrives with Contact (not in the game yet).';
  if (need.kind === 'settlement' && !need.traits) return 'Settlements are found on worlds with intelligent life; they record themselves when you come near.';
  const found = [...new Set(need.anyOf ? need.anyOf.flatMap(hintFor) : hintFor(need))];
  return found.length ? `Look on ${or(found)}.` : null;
}
