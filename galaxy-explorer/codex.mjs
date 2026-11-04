// The codex: everything you have documented, across every system, in one save.
// Each entry copies in the traits that upgrade requirements ask about at the moment
// you record it, so upgrades.mjs can check progress without regenerating old systems.
// Names, never numbers: tiers, body plans and formations are stored by name.
//
//   { kind, seed, bodyId, id, traits: {…}, world: {…} | null }
//
//   kind: 'flora' | 'fauna' | 'formation' | 'settlement' | 'field-note' | 'world' | 'signal'
//         | 'behaviour' (an animal seen doing something) | 'phenomenon' (a sky event)
//   Later kinds ('station', 'megastructure', 'derelict', 'contact') only need
//   an entry function here and a scanner in the game; requirements can ask for them at once.
//
// Pure apart from the storage passed in (localStorage in the browser, a stub in tests).
import { generateSystem } from './system.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { geologyFor } from './geology.mjs';
import { civilizationOf, colonistOf, tierName } from './civilizations.mjs';

export const STORE = 'elsewhere-codex-v1';
// What counts as "a thing you documented" when a requirement asks for any kind.
export const DOCUMENTED = ['flora', 'fauna', 'formation', 'settlement', 'field-note'];

const round = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v ?? null);

// The world-level traits requirements can ask about (see PROGRESSION.md).
export function worldTraits(system, body) {
  const p = body.physics || {};
  return {
    name: body.name, biome: body.biome, giant: !!body.giant, moon: !!body.parent,
    life: p.life ?? 'none', biochemistry: p.biochemistry ?? null, waterState: p.waterState ?? null,
    subsurfaceOcean: !!p.subsurfaceOcean, tidallyLocked: !!p.tidallyLocked,
    gravity: round(p.gravity), pressure: round(p.pressure), temperature: round(p.temperature), volcanism: round(p.volcanism),
    clouds: body.giant ? p.clouds ?? null : null, ringed: !!body.ringed,
    star: system.star?.spectralClass?.[0] ?? null, // O, B, A, F, G, K or M
    colonists: !body.giant && !civilizationOf(body) && !!colonistOf(system, body), // settled from another world of the system
  };
}

const entry = (kind, system, body, id, traits) => ({
  kind, seed: String(system.seed), bodyId: body.id, id, traits, world: worldTraits(system, body),
});

export const floraEntry = (system, body, s) => entry('flora', system, body, s.id, {
  name: s.name, form: s.form, glow: round(s.glow || 0),
  habitat: { shore: !!s.habitat?.shore, highland: !!s.habitat?.highland },
});
export const faunaEntry = (system, body, s) => entry('fauna', system, body, s.id, {
  name: s.name, plan: s.plan, form: s.form, diet: s.traits?.diet ?? s.diet, legs: s.legs ?? 0, glow: round(s.glow || 0),
  activity: s.ecology?.activity ?? 'any', stalksYou: !!s.ecology?.stalksYou, prey: [...(s.ecology?.prey || [])],
  mind: s.mind ?? null,
});
export const formationEntry = (system, body, f) => entry('formation', system, body, f.id, {
  name: f.name, formation: f.key, type: f.type ?? 'formation', rare: !!f.rare,
});
// A species seen doing something (ecology.mjs BEHAVIOURS): one entry per species and behaviour.
export const behaviourEntry = (system, body, s, behaviour) => entry('behaviour', system, body, `${s.id}:${behaviour}`, {
  name: s.name, species: s.id, behaviour, plan: s.plan, diet: s.traits?.diet ?? s.diet, activity: s.ecology?.activity ?? 'any',
});
// A deep core sample of a recorded rock or landform (Deep core sampler; geology.mjs coreSample).
export const coreEntry = (system, body, f, sample) => entry('core', system, body, f.id, {
  name: f.name, formation: f.key, type: f.type ?? 'formation', ageGy: round(sample.age),
});
// A sky event seen from a world (phenomena.mjs): one entry per world and type.
export const phenomenonEntry = (system, body, type, { total = false } = {}) => entry('phenomenon', system, body, type, { type, total: !!total });
// civ: from civilizationOf(body); tier is a name (tierName reads old numeric saves).
export const settlementEntry = (system, body, civ, tier = civ?.tier) => entry('settlement', system, body, civ?.id ?? `${system.seed}:${body.id}`, {
  name: civ?.species?.name ?? null, tier: tierName(tier), family: civ?.family ?? null, culture: civ?.culture ?? null, reach: civ?.reach ?? null,
});
export const fieldNoteEntry = (system, body) => entry('field-note', system, body, 'signal', { name: body.title || body.name });
// A world you have been to. `totals` (how many plants, animals and formations it has)
// lets "fully document a world" be checked later.
export const worldEntry = (system, body, totals = totalsOf(body)) => entry('world', system, body, body.id, { name: body.name, totals });
// A radio source heard on the star map (signals.mjs): { id: starId, tier, civ, distance }.
export const signalEntry = (source) => ({
  kind: 'signal', seed: source.id, bodyId: null, id: source.civ, traits: { tier: tierName(source.tier) }, world: null,
});

// What a world holds, from the generators. The game corrects this with what was
// actually placed at the landing site (a species that found no room is not counted).
export function totalsOf(body) {
  if (body.giant || !body.physics) return { flora: 0, fauna: 0, formations: 0 };
  return {
    flora: floraFor(body).species.length,
    fauna: faunaFor(body).species.length,
    formations: geologyFor(body).formations.length,
  };
}

export const keyOf = (e) => `${e.kind}|${e.seed}|${e.bodyId}|${e.id}`;

// createCodex(localStorage) -> { entries, unlocked, tracked, add, unlock, track, … }
export function createCodex(storage = globalThis.localStorage) {
  // research.side: the side upgrade being researched (the main line researches itself).
  let data = { v: 1, entries: [], unlocked: [], research: { side: null }, backfilled: false };
  try {
    const saved = JSON.parse(storage?.getItem(STORE) || 'null');
    if (saved && Array.isArray(saved.entries)) data = { ...data, ...saved };
  } catch {}
  const index = new Map(data.entries.map((e) => [keyOf(e), e]));
  const save = () => { try { storage?.setItem(STORE, JSON.stringify(data)); } catch {} };
  return {
    get entries() { return data.entries; },
    get unlocked() { return new Set(data.unlocked); },
    get research() { return data.research || { side: null }; },
    get backfilled() { return data.backfilled; },
    has: (e) => index.has(keyOf(e)),
    // Adds an entry; returns true if it is new. World entries update their totals.
    add(e, { persist = true } = {}) {
      const old = index.get(keyOf(e));
      if (old) {
        if (e.kind === 'world' && JSON.stringify(old.traits.totals) !== JSON.stringify(e.traits.totals)) {
          old.traits.totals = e.traits.totals;
          if (persist) save();
        }
        return false;
      }
      data.entries.push(e);
      index.set(keyOf(e), e);
      if (persist) save();
      return true;
    },
    unlock(id) {
      if (data.unlocked.includes(id)) return;
      data.unlocked.push(id);
      if (data.research?.side === id) data.research = { ...data.research, side: null };
      save();
    },
    // Test mode (dev-panel.js): take an upgrade out again, or set the whole installed list.
    lock(id) { data.unlocked = data.unlocked.filter((x) => x !== id); save(); },
    setUnlocked(ids) { data.unlocked = [...ids]; save(); },
    setSide(id) { data.research = { ...(data.research || {}), side: id }; save(); },
    markBackfilled() { data.backfilled = true; save(); },
    save,
    reset() { data = { v: 1, entries: [], unlocked: [], research: { side: null }, backfilled: true }; index.clear(); save(); },
  };
}

// Copies what older per-system saves (`elsewhere-system-<seed>`) recorded into the codex,
// regenerating each system once to read the traits. Returns how many entries were added.
export function backfill(codex, storage = globalThis.localStorage) {
  let added = 0;
  const keys = [];
  try { for (let i = 0; i < storage.length; i++) keys.push(storage.key(i)); } catch { return 0; }
  for (const key of keys) {
    const m = /^elsewhere-system-(.+)$/.exec(key || '');
    if (!m) continue;
    try {
      const saved = JSON.parse(storage.getItem(key) || '{}'), system = generateSystem(m[1]);
      const body = (id) => system.bodies.find((b) => b.id === id);
      const add = (e) => { if (e && codex.add(e, { persist: false })) added++; };
      for (const id of saved.visited || []) if (body(id)) add(worldEntry(system, body(id)));
      for (const id of saved.records || []) if (body(id)) add(fieldNoteEntry(system, body(id)));
      for (const [id, list] of Object.entries(saved.flora || {})) {
        const b = body(id); if (!b) continue;
        const species = floraFor(b).species;
        for (const sid of list) { const s = species.find((x) => x.id === sid); if (s) add(floraEntry(system, b, s)); }
      }
      for (const [id, list] of Object.entries(saved.fauna || {})) {
        const b = body(id); if (!b) continue;
        const species = faunaFor(b).species;
        for (const sid of list) { const s = species.find((x) => x.id === sid); if (s) add(faunaEntry(system, b, s)); }
      }
      for (const [id, list] of Object.entries(saved.geology || {})) {
        const b = body(id); if (!b) continue;
        const formations = geologyFor(b).formations;
        for (const fid of list) { const f = formations.find((x) => x.id === fid); if (f) add(formationEntry(system, b, f)); }
      }
      for (const [id, tier] of Object.entries(saved.traces || {})) {
        const b = body(id); if (!b) continue;
        add(settlementEntry(system, b, civilizationOf(b), tierName(tier) ?? civilizationOf(b)?.tier));
      }
    } catch {}
  }
  codex.markBackfilled();
  return added;
}
