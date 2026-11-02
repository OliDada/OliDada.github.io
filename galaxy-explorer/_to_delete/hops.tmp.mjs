import { homeStar, jumpTargets } from '../galaxy.mjs';
import { generateSystem } from '../system.mjs';
import { floraFor } from '../flora.mjs';
import { faunaFor } from '../fauna.mjs';
import { geologyFor } from '../geology.mjs';
import { civilizationOf } from '../civilizations.mjs';
import * as C from '../codex.mjs';
import { progress, UPGRADES } from '../upgrades.mjs';
const all = (system, body) => [C.worldEntry(system, body), C.fieldNoteEntry(system, body),
  ...floraFor(body).species.map(s => C.floraEntry(system, body, s)), ...faunaFor(body).species.map(s => C.faunaEntry(system, body, s)),
  ...geologyFor(body).formations.map(f => C.formationEntry(system, body, f)), ...(civilizationOf(body) ? [C.settlementEntry(system, body, civilizationOf(body))] : [])];
const range = +(process.argv[2] || 12);
const unlockedAll = new Set(Object.keys(UPGRADES).filter(id => !UPGRADES[id].ship));
let frontier = [homeStar()], seen = new Set([homeStar().id]), entries = [], firstMet = {};
for (let hop = 0; hop <= 6; hop++) {
  for (const st of frontier) { const s = generateSystem(st.seed); entries.push(...s.bodies.flatMap(b => all(s, b))); }
  const p = progress(entries, unlockedAll);
  for (const [id, x] of Object.entries(p)) x.needs.forEach((n, i) => { const k = `${id}#${i} ${n.label}`; if (n.done && !(k in firstMet)) firstMet[k] = hop; });
  console.log(`hop ${hop}: ${seen.size} stars`);
  const next = [];
  for (const st of frontier) for (const t of jumpTargets(st, range).targets) if (!seen.has(t.star.id)) { seen.add(t.star.id); next.push(t.star); }
  frontier = next;
  if (seen.size > 1500) { console.log('cap'); break; }
}
for (const u of Object.values(UPGRADES)) u.needs.forEach((n, i) => console.log(`${u.id}#${i} ${n.label}`.padEnd(80), firstMet[`${u.id}#${i} ${n.label}`] ?? '-'));
