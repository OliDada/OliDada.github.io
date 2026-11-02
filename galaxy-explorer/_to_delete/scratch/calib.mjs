const { generateSystem } = await import('../../system.mjs');
const { faunaFor } = await import('../../fauna.mjs');
const MANIP = { quadruped: { hopper: .35, _: .3 }, biped: { _: .45 }, hexapod: { mantis: .75, ant: .7, _: .5 }, arachnid: { spider: .7, scorpion: .65, _: .55 }, serpent: { _: .4 }, slug: { _: .25 }, flyer: { _: .45 }, floater: { bell: .75, cluster: .7, balloon: .55, manta: .35 }, radial: { octo: .9, star: .8, tripod: .55 }, roller: { _: .15 } };
const rows = [];
const N = 8000;
for (let s = 0; s < N; s++) { let best = null; for (const b of generateSystem(s).bodies) for (const x of faunaFor(b).species) {
  const m = x.arms ? 1 : (MANIP[x.plan][x.form] ?? MANIP[x.plan]._);
  const pot = x.traits.intelligence * .62 + x.traits.sociality * .18 + m * .2;
  const v = { pot, age: b.starAge ?? 4, plan: x.plan };
  if (!best || pot > best.pot) best = v; }
  if (best) rows.push(best); }
const levels = eval(process.argv[2]);
const lvl = (r) => { let l = 0; for (let i = 0; i < levels.length; i++) if (r.pot > levels[i][0] && r.age > levels[i][1]) l = i + 1; else break; return l; };
const counts = [0,0,0,0,0,0], plans = {};
for (const r of rows) { const l = lvl(r); for (let k = 1; k <= l; k++) counts[k]++; if (l >= 3) plans[r.plan] = (plans[r.plan] || 0) + 1; }
console.log(counts.map((c, i) => i ? `L${i} 1 in ${(N / c).toFixed(0)} systems` : '').join('\n'), plans);
