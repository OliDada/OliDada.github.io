import { starById } from './galaxy.mjs'; import { generateSystem } from './system.mjs'; import { paintBand } from './world-paint.mjs';
import zlib from 'zlib'; import fs from 'fs';
const s = generateSystem(starById('-917_1261_0_0').seed), b = JSON.parse(JSON.stringify(s.bodies.find(x => x.name === 'Belderri')));
const W = 768, H = 384, col = paintBand(null, b, W, H, 0, H), px = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = y * (W * 4 + 1) + 1 + x * 4, i = (y * W + x) * 3; px[o] = col[i] * 255; px[o + 1] = col[i + 1] * 255; px[o + 2] = col[i + 2] * 255; px[o + 3] = 255; }
const crcT = []; for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[i] = c >>> 0; }
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
