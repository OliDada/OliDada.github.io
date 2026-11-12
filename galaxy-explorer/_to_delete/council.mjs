// The Concord: where the peoples of this part of the galaxy meet. One star, a couple of
// jumps from where you start, keeps it: a vast ring round a captive light, with an embassy
// tower for every people that sends envoys, their own ships berthed beside them. Who sits
// in the Concord is worked out from the civilizations of the stars around it (members):
// the nearest peoples to have reached orbit.
// Pure data; council-mesh.js builds it, game.js and starmap.js point you to it.
import { starsNear, homeStar, starById } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { civilizationsIn, tierAtLeast } from './civilizations.mjs';

export const COUNCIL_NAME = 'the Concord of the Spiral';
let star = null, members = null;

export function councilStar() {
  if (star) return star;
  const h = homeStar();
  star = starsNear(h, 34).filter((e) => e.distance > 15).sort((a, b) => a.distance - b.distance)[0]?.star || h;
  return star;
}
export const isCouncilSystem = (system) => !!system && system.seed === councilStar().seed;
export const isCouncilStar = (s) => !!s && s.id === councilStar().id;

// The peoples with an embassy here: [{ civ, star, system, distance }]: the sixteen nearest
// peoples to have reached orbit. (Civilizations are rare and spacefaring ones rarer still,
// so they were found once, offline, by searching outward from the Concord's star, and are
// listed here by star and world; the galaxy is the same for everyone, so this holds.)
const MEMBER_HOMES = [['-917_1255_0_0', 'planet-2'], ['-923_1259_-5_0', 'planet-1'], ['-912_1262_3_0', 'planet-2'], ['-917_1269_-2_1', 'planet-2'], ['-924_1255_5_0', 'planet-2'], ['-909_1261_4_0', 'planet-1'], ['-929_1264_-1_0', 'planet-1'], ['-916_1270_6_0', 'planet-3'], ['-929_1261_-4_0', 'moon-1'], ['-912_1264_8_1', 'planet-2'], ['-916_1252_-7_0', 'planet-2'], ['-920_1263_11_0', 'planet-1'], ['-928_1264_6_1', 'planet-1'], ['-908_1257_3_0', 'planet-1'], ['-918_1268_9_0', 'planet-1'], ['-908_1257_-2_1', 'planet-1']];
export function councilMembers() {
  if (members) return members;
  members = [];
  for (const [id, world] of MEMBER_HOMES) {
    const s = starById(id); if (!s) continue;
    let sys; try { sys = generateSystem(s.seed); } catch { continue; }
    const civ = civilizationsIn(sys).find((c) => c.home === world && tierAtLeast(c.tier, 'orbital'));
    if (civ) members.push({ civ, star: id, system: sys.name, distance: Math.hypot(s.x - councilStar().x, s.y - councilStar().y, s.z - councilStar().z) });
  }
  return members;
}

export function councilWords() {
  const m = councilMembers(), n = m.length;
  return {
    hail: [`Traveller, you have come to ${COUNCIL_NAME}.`, `${n} peoples keep embassies on this ring. None of them were born here; all of them came, as you have, across the dark.`],
    clear: ['You are welcome among us. Berth where you like. Speak with whom you like.', 'Every people here was once the stranger. We remember.'],
    reply: ['Who are you, all of you?', `We are the ones who looked up and found each other. ${m.find((x) => x.civ.tier === 'system-shapers') ? `The eldest of us, the ${m.find((x) => x.civ.tier === 'system-shapers').civ.species.name}s, lit the lamp at the centre.` : 'Together we lit the lamp at the centre.'} Every one of us came from a world as strange to the others as yours is to us.`],
  };
}
