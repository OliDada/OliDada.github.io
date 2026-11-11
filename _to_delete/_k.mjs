import { homeStar, starsNear } from './galaxy.mjs'; import { generateSystem } from './system.mjs'; import { civilizationOf } from './civilizations.mjs';
const h=homeStar(); const out=[];
for (const {star,distance} of starsNear(h, 40)) {
  const s=generateSystem(star.seed);
  const types=new Set(s.bodies.map(b=>b.biome+(b.variant?'/'+b.variant:'')));
  const ringedGiant=s.bodies.some(b=>b.giant&&b.ringed), giants=s.bodies.filter(b=>b.giant).length;
  const civs=s.bodies.map(b=>civilizationOf(b)).filter(Boolean);
  for (const b of s.bodies) { const p=b.physics; if (b.giant||p.life!=='complex'||p.waterState!=='liquid') continue;
    let sc=0; const T=p.temperature-273;
    sc+= 3-Math.min(3,Math.abs(T-15)/8); sc+= 3-Math.min(3,Math.abs(p.gravity-1)*6); sc+=2-Math.min(2,Math.abs(Math.log(p.pressure))*2);
    sc+= b.biome==='Verdant'?3:0; sc+= p.tidallyLocked?-2:1; sc+= b.parent?-1:0;
    const moons=s.bodies.filter(m=>m.parent===b.id).length; sc+= moons?1.5:0;
    sc+= Math.min(3,types.size*.4)+ (ringedGiant?1.5:0) + (giants?.5:0); sc-= distance/20;
    const civ=civilizationOf(b);
    out.push({sc:+sc.toFixed(2), id:star.id, w:b.id, name:b.name, type:b.type, T:T.toFixed(0), g:p.gravity.toFixed(2), P:p.pressure.toFixed(2), water:p.waterCoverage?.toFixed(2), locked:p.tidallyLocked, moons, types:types.size, ringedGiant, d:distance.toFixed(1), civ: civ?civ.tier?.name??civ.stage:null, sysCivs:civs.length, n:s.bodies.length, star:star.seed&&s.star.physics.spectral});
  }
}
out.sort((a,b)=>b.sc-a.sc); for (const o of out.slice(0,12)) console.log(JSON.stringify(o));
console.log(out.length);
