import { paintGalaxy } from './galaxy-paint.mjs';
import zlib from 'zlib'; import fs from 'fs';
const n = +process.argv[2] || 800, t = Date.now(), px = paintGalaxy(n); console.log('ms', Date.now() - t);
const raw = Buffer.alloc((n * 4 + 1) * n); for (let j = 0; j < n; j++) { raw[j * (n * 4 + 1)] = 0; Buffer.from(px.buffer, j * n * 4, n * 4).copy(raw, j * (n * 4 + 1) + 1); }
const crcT = []; for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[i] = c >>> 0; }
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 6;
fs.writeFileSync(process.argv[3], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
