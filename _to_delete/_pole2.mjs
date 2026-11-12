import { starById } from './galaxy.mjs'; import { generateSystem } from './system.mjs'; import { terrainFor } from './terrain.mjs';
import zlib from 'zlib'; import fs from 'fs';
const s = generateSystem(starById('-917_1261_0_0').seed), b = s.bodies.find(x => x.id === 'moon-1'), t = terrainFor(b);
const n = 400, px = new Uint8ClampedArray(n * n * 4), sign = +(process.argv[2] || 1);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const u = (i / n) * 2 - 1, v = (j / n) * 2 - 1, r2 = u * u + v * v; const k = (j * n + i) * 4; px[k + 3] = 255;
  if (r2 > 1) continue; const p = { x: u * .9, y: sign * Math.sqrt(1 - .81 * r2), z: v * .9 };
  const e = .002, h = t.meshHeight(p), hx = t.meshHeight({ x: p.x + e, y: p.y, z: p.z }), hz = t.meshHeight({ x: p.x, y: p.y, z: p.z + e }), R = b.radius, sh = 128 + 60 * Math.max(-2, Math.min(2, ((h - hx) - (h - hz) * .6) / (e * R) * 3)); px[k] = px[k + 1] = px[k + 2] = sh;
}
const raw = Buffer.alloc((n * 4 + 1) * n); for (let j = 0; j < n; j++) Buffer.from(px.buffer, j * n * 4, n * 4).copy(raw, j * (n * 4 + 1) + 1);
const crcT = []; for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[i] = c >>> 0; }
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(process.argv[3], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
