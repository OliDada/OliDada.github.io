import { generateSystem } from './system.mjs';
let hot=0, shep=0, rm=0, n=2000, ex={};
for (let s=1;s<=n;s++){ const sys=generateSystem(s*7919);
 for (const b of sys.bodies){ if(b.hot){hot++; ex.hot??=[s*7919,b.id,b.type,b.physics.clouds,b.physics.au.toFixed(3)];}
  if(b.shepherd){shep++; ex.shep??=[s*7919,b.id,b.radius,b.orbit]} if(b.parent&&b.ringed){rm++;ex.rm??=[s*7919,b.id]} } }
console.log({hot,shep,rm,ex});
