import { homeStar, starsNear } from './galaxy.mjs'; import { generateSystem } from './system.mjs';
const h=homeStar(); const out=[];
for (const {star,distance} of starsNear(h, 40)) { const s=generateSystem(star.seed);
 const sib=new Set(s.bodies.map(b=>b.biome)).size;
 for (const b of s.bodies) { if(!b.parent||b.shepherd) continue; const g=s.bodies.find(x=>x.id===b.parent); if(!g.giant) continue; const p=b.physics;
  if (p.life==='complex'||p.life==='simple') continue;
  const ang=g.radius/(b.orbit); let sc=ang*12 + (g.ringed?3:0) + (g.physics.kind==='gas'?1:0) + (s.bodies.some(x=>x.parent===g.id&&x.shepherd)?.5:0);
  const T=p.temperature-273; sc+= 2-Math.min(2,Math.abs(T+20)/40); sc+= 1-Math.min(1,Math.abs(p.gravity-.6)); sc+=Math.min(2,sib*.3); sc-=distance/25;
  sc+= ['Frozen','Amethyst','Barren','Desert'].includes(b.biome)?1:0;
  out.push({sc:+sc.toFixed(2),id:star.id,w:b.id,name:b.name,type:b.type,giant:g.name+':'+g.type+(g.ringed?'(r)':'')+':'+g.physics.clouds,ang:ang.toFixed(2),T:T.toFixed(0),g:p.gravity.toFixed(2),P:p.pressure.toFixed(2),life:p.life,d:distance.toFixed(1)}); } }
out.sort((a,b)=>b.sc-a.sc); for (const o of out.slice(0,10)) console.log(JSON.stringify(o));
