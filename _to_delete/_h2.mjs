import { homeStar } from './galaxy.mjs'; import { generateSystem } from './system.mjs';
const h=homeStar(); const s=generateSystem(h.seed); console.log(h.id, s.startId, s.bodies.map(b=>b.id+':'+b.type+(b.ringed?'(r)':'')).join(' '));
