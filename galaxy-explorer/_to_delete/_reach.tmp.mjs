import { homeStar, jumpTargets } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { floraFor } from './flora.mjs';
import { faunaFor } from './fauna.mjs';
import { geologyFor } from './geology.mjs';
import { civilizationOf } from './civilizations.mjs';
import * as C from './codex.mjs';
import { progress, UPGRADES } from './upgrades.mjs';
const all = (system, body) => [C.worldEntry(system, body), C.fieldNoteEntry(system, body),
  ...floraFor(body).species.map(s => C.floraEntry(system, body, s)), ...faunaFor(body).species.map(s => C.faunaEntry(system, body, s)),
  ...geologyFor(body).formations.map(f => C.formationEntry(system, body, f)), ...(civilizationOf(body) ? [C.settlementEntry(system, body, civilizationOf(body))] : [])];
const home = homeStar(), sys = generateSystem(home.seed);
console.log('home', home.id, sys.bodies.map(b => `${b.id}:${b.biome}:${b.physics.life}`).join(' '));
const report = (name, entries) => { const p = progress(entries, new Set(Object.keys(UPGRADES).filter(id => !UPGRADES[id].ship))); console.log(name, entries.length, 'met:', Object.values(p).filter(x => x.needs.every(n => n.done)).map(x => x.id).join(','));
  console.log('   unmet:', Object.values(p).filter(x => !x.needs.every(n => n.done)).map(x => x.id + '[' + x.needs.filter(n=>!n.done).map(n=>`${n.label} ${n.have}/${n.count}`).join('; ') + ']').join(' | ')); };
for (const b of sys.bodies) report('world ' + b.id, all(sys, b));
let entries = sys.bodies.flatMap(b => all(sys, b)); report('home system', entries);
const { targets } = jumpTargets(home);
for (const t of targets) { const s = generateSystem(t.star.seed); entries.push(...s.bodies.flatMap(b => all(s, b))); }
report(`+${targets.length} neighbours`, entries);
// two jumps
const seen = new Set([home.id, ...targets.map(t=>t.star.id)]);
for (const t of targets) for (const u of jumpTargets(t.star).targets) if (!seen.has(u.star.id)) { seen.add(u.star.id); const s = generateSystem(u.star.seed); entries.push(...s.bodies.flatMap(b => all(s, b))); }
report(`2 jumps (${seen.size} stars)`, entries);
