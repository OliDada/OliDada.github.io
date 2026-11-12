// Paints the far galaxy view off the main thread (galaxy-paint.mjs, used by starmap.js).
import { paintGalaxy } from './galaxy-paint.mjs';
self.onmessage = (e) => { const px = paintGalaxy(e.data.n); self.postMessage({ n: e.data.n, px }, [px.buffer]); };
