// Background thread for the map's world view (starmap.js): paints a band of rows of a world's
// surface map (equirectangular colour, with relief shading lit from the north-west the way
// shaded relief maps are) from its terrain, so the sharp globe comes in without the map
// stuttering. Receives a body, the map size and the band.
import { terrainFor } from './terrain.mjs';
import { paintBand } from './world-paint.mjs';

self.onmessage = (e) => {
  const { id, body, W, H, y0, y1 } = e.data;
  let t = null;
  try { t = terrainFor(body); } catch { /* nothing to paint */ }
  const grad = new Float32Array((y1 - y0) * W * 3), col = paintBand(t, body, W, H, y0, y1, grad);
  self.postMessage({ id, y0, y1, col, grad }, [col.buffer, grad.buffer]);
};
