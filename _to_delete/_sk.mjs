import { paintSky } from './sky-paint.mjs'; import { homeStar } from './galaxy.mjs';
import zlib from 'zlib'; import fs from 'fs';
const h = homeStar(), W = 1024, H = 512, t = Date.now(), px = paintSky([h.x, h.y, h.z], W, H); console.log('ms', Date.now() - t, h.x|0, h.y|0, h.z|0);
const n = W, raw = Buffer.alloc((W * 4 + 1) * H); for (let j = 0; j < H; j++) Buffer.from(px.buffer, (H - 1 - j) * W * 4, W * 4).copy(raw, j * (W * 4 + 1) + 1);
const crcT = []; for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[i] = c >>> 0; }
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
