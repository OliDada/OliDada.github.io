import { generateSystem } from "./system.mjs";
const n = 4000, c = {}, seas = {}; let carbonSys = 0, exoSys = 0;
for (let s = 0; s < n; s++) { const sys = generateSystem(s); let cs = false, es = false;
  for (const b of sys.bodies) { const p = b.physics; if (!p) continue;
    if (p.solvent && p.solvent !== 'water') seas[p.solvent] = (seas[p.solvent] || 0) + 1;
    if (p.life !== 'none') { const k = p.biochemistry + ':' + p.life; c[k] = (c[k] || 0) + 1; if (p.biochemistry === 'carbon') cs = true; else es = true; } }
  carbonSys += cs; exoSys += es; }
console.log(c, seas, 'systems carbon', carbonSys, 'exotic', exoSys);
