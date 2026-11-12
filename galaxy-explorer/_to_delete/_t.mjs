import { starById } from './galaxy.mjs';
import { generateSystem } from './system.mjs';
import { civilizationsIn } from './civilizations.mjs';
import { personaOf, talkTopics, bodyLine } from './persona.mjs';
const sys = generateSystem(starById('-924_1255_5_0').seed);
const civ = civilizationsIn(sys)[0];
for (const k of [0,1,2]) { const p = personaOf(civ, k, 'ark'); console.log(p.name, p.role, p.temper, p.quirk.id);
 const tps = talkTopics(civ, p, { home: 'Ionbelket', homeType: 'Verdant', stance: 'wary', step: 'contact', ark: civ.arkName, others: 'x' });
 for (const t of tps.slice(0,3)) { const a = t.answer(); console.log(' -', t.label, '|', a.text, '|', bodyLine(civ.species, a.feeling)); } }
