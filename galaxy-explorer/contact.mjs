// Contact (PROGRESSION.md): getting to know another mind, and trading what you know.
// Pure data and rules (no Three.js, no DOM); contact-ui.js draws the exchange and
// game.js starts it (E beside one of them, on a station deck or in their town).
//
// The relationship ladder, saved per civilization id (names, never numbers):
//   observed    you have recorded them (a settlement, a station or the species)
//   understood  you can make sense of them: orbital civilizations and above meet you
//               halfway and translate; below that you need Xenolinguistics (tool users
//               to metalworkers) or Diplomatic protocols (city builders to planet-shapers)
//   contact     you have greeted each other
//   trust       knowledge given that they valued
//   friendship  more of it, over more than one meeting
//
// What you trade is knowledge: entries from your codex. What a civilization values
// follows its path (agrarians want plants, scholars sky events and strange chemistry,
// traders word of other peoples, the devout the sky and old signals, the martial the
// dangers of other worlds, expansionists other worlds themselves), and anything from
// beyond their own world is worth more. Something they already know (from their own
// world, or given before) is worth little or nothing.
//
// How they take you (station-deck.js stanceOf) changes the pace: the welcoming warm to
// you quickly, the curious prize the first thing you show them, the wary want you to
// wait before they will greet you, and the guarded take longer to trust.
import { rng } from './rng.mjs';
import { tierAtLeast } from './civilizations.mjs';
import { plural } from './structures.mjs';
import { rarityOf, RARITY_VALUE } from './rarity.mjs';

export const STEPS = ['observed', 'understood', 'contact', 'trust', 'friendship'];
export const STORE = 'elsewhere-relations-v1';
export const stepAtLeast = (a, b) => STEPS.indexOf(a) >= STEPS.indexOf(b);
const TRUST_AT = 1.5, FRIEND_AT = 3.2; // trust points (a valued gift is worth up to 1)
export const PER_MEETING = 3; // gifts they will take in one meeting
export const PATIENCE = 20; // seconds a wary people want you to wait nearby first

// Can you talk with them at all? { ok, needs } (needs: the upgrade that would let you).
export function canTalk(civ, unlocked) {
  if (!civ) return { ok: false, needs: null };
  if (tierAtLeast(civ.tier, 'orbital')) return { ok: true, needs: null }; // they meet you halfway
  if (tierAtLeast(civ.tier, 'city builders')) return unlocked.has('diplomaticProtocols') ? { ok: true, needs: null } : { ok: false, needs: 'diplomaticProtocols' };
  return unlocked.has('xenolinguistics') ? { ok: true, needs: null } : { ok: false, needs: 'xenolinguistics' };
}

// What one of your codex entries is worth to them, 0..1 (rel: their relationship record).
const KIND_BASE = { fauna: .35, flora: .3, formation: .22, core: .3, behaviour: .3, phenomenon: .3, settlement: .4, station: .4, 'field-note': .3, world: .25, signal: .3 };
const ENTRY_KEY = (e) => `${e.kind}|${e.seed}|${e.bodyId}|${e.id}`;
export const tradeable = (e) => e.kind in KIND_BASE;
export function valueOf(civ, e, rel = null, homeSeed = null) {
  if (!tradeable(e) || rel?.gifts?.includes(ENTRY_KEY(e))) return 0;
  const [seed, bodyId] = civ.id.split(':');
  if (e.seed === seed && e.bodyId === bodyId) return .05; // their own world: they know it
  if ((e.kind === 'settlement' || e.kind === 'station') && e.id === civ.id) return 0; // themselves
  let v = KIND_BASE[e.kind];
  const t = e.traits || {}, w = e.world || {}, exotic = w.biochemistry && !['water', 'carbon'].includes(w.biochemistry);
  switch (civ.path) {
    case 'agrarian': if (e.kind === 'flora') v += .35; if (e.kind === 'behaviour' && t.behaviour === 'graze') v += .15; break;
    case 'scholarly': if (['phenomenon', 'core', 'formation'].includes(e.kind)) v += .3; if (exotic) v += .2; if (t.rare) v += .15; break;
    case 'mercantile': if (['settlement', 'station', 'signal'].includes(e.kind)) v += .45; break;
    case 'devotional': if (e.kind === 'phenomenon' || e.kind === 'field-note') v += .4; if (t.glow > .4) v += .15; break;
    case 'martial': if (e.kind === 'fauna' && (t.stalksYou || t.diet === 'carnivore')) v += .4; if (e.kind === 'behaviour' && (t.behaviour === 'hunt' || t.behaviour === 'kill')) v += .2; break;
    case 'expansionist': if (e.kind === 'world') v += .4; if (e.kind === 'world' && w.life && w.life !== 'none') v += .15; break;
  }
  if (homeSeed != null && e.seed !== String(homeSeed)) v += .15; // from another star
  v += RARITY_VALUE[rarityOf(e)]; // rare things are worth more to anyone (rarity.mjs)
  return Math.min(1, v);
}
// What they hope to hear about, as a sentence (what they show you to ask for it).
export function askOf(civ) {
  const many = plural(civ.species?.name || 'builder');
  return {
    agrarian: `The ${many} hold out a seed and turn their palms up: they want to know what grows elsewhere.`,
    scholarly: `The ${many} sketch the sky in light: stars, a strange rock, a world unlike theirs. They wait for yours.`,
    mercantile: `The ${many} lay out tokens in a ring, one for every people they know of, and leave a space.`,
    devotional: `The ${many} point up at the sky and are quiet: they want to hear what you have seen in other skies.`,
    martial: `The ${many} show you a crude image of a hunter's jaws: they want to know what is dangerous out there.`,
    expansionist: `The ${many} spread a chart with gaps in it: they want to hear about worlds they have not reached.`,
  }[civ.path] || `The ${many} wait to see what you will show them.`;
}
// How they take a gift, by its worth.
export function reactionTo(civ, value, name) {
  const s = civ.species?.name ? plural(civ.species.name) : 'they';
  if (value <= .01) return `The ${s} have this already. They hand it back, politely.`;
  if (value < .2) return `The ${s} glance at ${name} and nod. They know something like it.`;
  if (value < .45) return `The ${s} study ${name} with interest and keep it.`;
  if (value < .7) return `The ${s} gather round ${name}, talking among themselves.`;
  return `${name}: the ${s} go very still, then answer in a rush of light and gesture. This mattered to them.`;
}

// A keepsake they give a friend: a thing of theirs, named for them.
export function keepsakeOf(civ) {
  const r = rng(civ.id, 'keepsake'), who = (civ.species?.name || 'alien').split(' ')[0];
  const things = {
    agrarian: ['seed pod sealed in resin', 'woven harvest charm', 'jar of dried blossoms'],
    scholarly: ['star chart etched in glass', 'lens ground from a crystal', 'tablet of their notation'],
    mercantile: ['trade token of every people they know', 'set of weighing stones', 'knotted record cord'],
    devotional: ['string of prayer beads', 'small carved shrine', 'lamp that never goes out'],
    martial: ['hilt without a blade', 'banner of their oldest guard', 'tooth of a great hunter, set in metal'],
    expansionist: ['model of their first ship', 'flag of a colony not yet founded', 'map with your world added'],
  }[civ.path] || ['carving', 'woven cord', 'polished stone'];
  return `a ${who} ${things[Math.floor(r() * things.length)]}`;
}
// What a friend shares, by tier and path (the effects game.js applies).
//   guide:  on their world, an arrow to what you have not recorded (as Life sonar does)
//   charts: their stars: every system within `radius` ly shows its worlds on the map
//   drive:  their drive technology: jump range +3 ly (up to two friends)
export function giftsOf(civ) {
  if (tierAtLeast(civ.tier, 'spacefarers')) return { drive: 3, charts: civ.tier === 'system-shapers' ? 60 : 40 };
  if (tierAtLeast(civ.tier, 'orbital')) return { charts: 30 };
  if (tierAtLeast(civ.tier, 'city builders')) return { charts: civ.tier === 'city builders' ? 15 : 22 };
  return { guide: true };
}
export function giftWords(g) {
  return [g.guide && 'where everything on their world lives (an arrow on foot, as Life sonar)', g.charts && `star charts: every system within ${g.charts} light years shows its worlds on your map`, g.drive && `drive technology: your jump range grows by ${g.drive} light years`].filter(Boolean).join('; ');
}

// createRelations(localStorage) -> { get(id), step(id), greet, give, … }
export function createRelations(storage = globalThis.localStorage) {
  let data = { v: 1, civs: {} };
  try { const saved = JSON.parse(storage?.getItem(STORE) || 'null'); if (saved?.civs) data = saved; } catch {}
  const save = () => { try { storage?.setItem(STORE, JSON.stringify(data)); } catch {} };
  const get = (id) => data.civs[id] || null;
  const ensure = (civ) => (data.civs[civ.id] ||= { step: 'observed', trust: 0, gifts: [], meetings: 0, lastMeeting: 0, given: 0, tier: civ.tier, name: civ.species?.name, path: civ.path });
  const thresholds = (stance) => (stance === 'guarded' ? [TRUST_AT * 1.5, FRIEND_AT * 1.4] : stance === 'welcome' ? [TRUST_AT * .85, FRIEND_AT * .9] : [TRUST_AT, FRIEND_AT]);
  // Climb as far as trust and meetings allow; returns the steps newly reached.
  function climb(rel, stance) {
    const [t, f] = thresholds(stance), reached = [];
    const up = (s) => { if (!stepAtLeast(rel.step, s)) { rel.step = s; reached.push(s); } };
    if (stepAtLeast(rel.step, 'contact') && rel.trust >= t) up('trust');
    if (stepAtLeast(rel.step, 'trust') && rel.trust >= f && rel.meetings >= 2) up('friendship');
    return reached;
  }
  return {
    get all() { return data.civs; },
    get, step: (id) => get(id)?.step ?? null,
    // A meeting begins (counted once per half hour of real time).
    meet(civ, now = Date.now()) {
      const rel = ensure(civ);
      if (!stepAtLeast(rel.step, 'understood')) rel.step = 'understood'; // you can talk (canTalk), so you can make sense of them
      if (now - rel.lastMeeting > 30 * 60 * 1000) { rel.meetings++; rel.given = 0; }
      rel.lastMeeting = now; save();
      return rel;
    },
    // First greeting: { ok, text, reached }. waited: seconds you have spent near them.
    greet(civ, stance, waited = Infinity) {
      const rel = ensure(civ);
      if (stepAtLeast(rel.step, 'contact')) return { ok: true, text: null, reached: [] };
      if (stance === 'wary' && waited < PATIENCE) return { ok: false, text: `The ${civ.species?.name ? plural(civ.species.name) : 'strangers'} step back from your greeting. Stay a while, without crowding them, and try again.`, reached: [] };
      rel.step = 'contact';
      if (stance === 'welcome') rel.trust += .3;
      save();
      return { ok: true, text: `You hold up an open hand; the ${civ.species?.name ? plural(civ.species.name) : 'strangers'} answer with a gesture of their own. Contact.`, reached: ['contact'] };
    },
    // Give one codex entry: { value, text, reached, done (no more this meeting) }.
    give(civ, stance, entry, homeSeed, name) {
      const rel = ensure(civ);
      if (rel.given >= PER_MEETING) return { value: 0, text: 'They have taken in all they can for now. Come back another time.', reached: [], done: true };
      let value = valueOf(civ, entry, rel, homeSeed);
      if (stance === 'curious' && !rel.gifts.length) value = Math.min(1, value * 1.5); // the first thing you show them
      rel.gifts.push(ENTRY_KEY(entry)); rel.given++; rel.trust += value;
      const reached = climb(rel, stance);
      save();
      return { value, text: reactionTo(civ, value, name), reached, done: rel.given >= PER_MEETING };
    },
    // Steps reached since the last meeting (a second visit can bring friendship).
    settle(civ, stance) { const rel = ensure(civ), reached = climb(rel, stance); if (reached.length) save(); return reached; },
    setGranted(id, what) { const rel = data.civs[id]; if (rel) { rel.granted = { ...(rel.granted || {}), ...what }; save(); } },
    // Effects of friendships: { guides: Set of world keys "seed:bodyId", charted: Set of star ids, drive: ly }
    effects() {
      const out = { guides: new Set(), charted: new Set(), drive: 0 };
      for (const [id, rel] of Object.entries(data.civs)) {
        if (!rel.granted) continue;
        if (rel.granted.guide) { const [seed, body] = id.split(':'); out.guides.add(`${seed}:${body}`); }
        for (const s of rel.granted.charted || []) out.charted.add(s);
        if (rel.granted.drive) out.drive = Math.min(6, out.drive + rel.granted.drive);
      }
      return out;
    },
    reset() { data = { v: 1, civs: {} }; save(); },
  };
}
