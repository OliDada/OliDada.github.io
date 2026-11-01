// Background thread that builds terrain tiles so the game never stutters while
// detail streams in. Receives each body once, then tile requests.
import { buildChunk } from './chunk-build.mjs';

const bodies = new Map();
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'body') { bodies.set(m.key, m.body); return; }
  if (m.type === 'chunk') {
    const out = buildChunk(bodies.get(m.key), m.spec);
    const transfer = [out.positions.buffer, out.colors.buffer, out.normals.buffer, out.lodDelta.buffer, out.lodColor.buffer];
    if (out.water) transfer.push(out.water.buffer, out.waterDelta.buffer);
    self.postMessage({ id: m.id, ...out }, transfer);
  }
};
