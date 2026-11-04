import { generateSystem } from './system.mjs';
import { phenomenaOf, forecast, stormChances } from './phenomena.mjs';
const n = { eclipse: 0, aurora: 0, meteors: 0 }; let worlds = 0, gaps = [];
const t0 = Date.now();
for (let s = 1; s <= 300; s++) {
  const sys = generateSystem(s);
  for (const b of sys.bodies) {
    if (b.giant) continue; worlds++;
    const ph = phenomenaOf(sys, b); for (const k of ph) n[k]++;
    if (ph.includes('eclipse') && gaps.length < 15) {
      const f = forecast(sys, b, [0,1,0], 1000000, 3600).filter(e=>e.type==='eclipse');
      gaps.push(`${b.parent?'moon':'planet'} ${f.length} visible/h ` + f.map(e => `${Math.round(e.end-e.start)}s${e.total?'T':''}`).join(','));
    }
  }
}
console.log(worlds, n, (Date.now()-t0)+'ms'); console.log(gaps.join('\n'));
