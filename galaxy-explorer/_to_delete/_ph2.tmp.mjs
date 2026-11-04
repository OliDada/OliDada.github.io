import { generateSystem } from './system.mjs';
import { phenomenaOf, forecast, eclipseAt } from './phenomena.mjs';
import { bodyPosition } from './orbits.mjs';
const lines = []; let total=0, count=0, tot=0;
for (let s = 1; s <= 120; s++) {
  const sys = generateSystem(s);
  for (const b of sys.bodies) {
    if (b.giant || !phenomenaOf(sys, b).includes('eclipse')) continue;
    // sample one hour at 2 s from body centre
    let open=false, n=0, dur=0, totals=0, maxc=0;
    for (let t=1e6; t<1e6+3600; t+=2){ const e=eclipseAt(sys,b,t); if(e.cover>=.5){ if(!open){n++;open=true;} dur+=2; maxc=Math.max(maxc,e.cover);} else { if(open && maxc>=.97) totals++; open=false; maxc=0;} }
    count++; total+=n; tot+=totals;
    if (lines.length<20) lines.push(`${b.parent?(sys.bodies.find(x=>x.id===b.parent).giant?'giantmoon':'moon'):'planet'} r=${b.radius} eclipses/h=${n} totals=${totals} avgdur=${n?Math.round(dur/n):0}s`);
  }
}
console.log(count, 'worlds; mean per hour', (total/count).toFixed(2), 'totals/h', (tot/count).toFixed(2)); console.log(lines.join('\n'));
