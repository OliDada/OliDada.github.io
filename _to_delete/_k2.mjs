import { homeStar, starsNear } from './galaxy.mjs'; import { generateSystem } from './system.mjs';
const h=homeStar(); const f={};
for (const {star,distance} of starsNear(h, 30)) { const s=generateSystem(star.seed);
 for (const b of s.bodies){ const k=b.hot?'hot':b.shepherd?'shep':(b.parent&&b.ringed)?'ringmoon':null; if(k&&!f[k]) f[k]=[star.id,b.id,b.name,b.type,b.physics.clouds||b.biome,distance.toFixed(1)]; } }
console.log(f);
for (const id of ['-918_1260_1_0','-915_1258_1_0','-916_1261_0_0']) { const [x,y,z,i]=id.split('_'); const st=starsNear(h,45).find(e=>e.star.id===id).star; const s=generateSystem(st.seed);
 console.log(id, s.star.physics.spectral||s.star.physics.class, s.bodies.map(b=>b.name+':'+b.type+(b.ringed?'(r)':'')+(b.parent?'<'+b.parent:'')).join(', ')); }
