// Paints the Milky Way for the sky off the main thread (sky-paint.mjs, used by deep-space.js).
import { paintSky } from './sky-paint.mjs';
self.onmessage = (e) => { const { id, P, W, H } = e.data, px = paintSky(P, W, H); self.postMessage({ id, px, W, H }, [px.buffer]); };
