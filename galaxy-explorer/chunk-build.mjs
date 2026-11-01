// Builds one terrain tile ("chunk") of a planet: a grid of vertices on a patch of
// a cube projected onto the sphere, with heights and colours from terrain.mjs.
// Used by the worker (terrain-worker.js) and, as a fallback, on the main thread.
import { terrainFor } from './terrain.mjs';

// Cube faces: [normal, u axis, v axis].
export const FACES = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];
// Point on a cube face (a, b in -1..1) to a unit direction. The "spherified cube"
// mapping keeps tiles close to equal in size across the sphere.
export function faceDirection(face, a, b) {
  const [n, u, v] = FACES[face];
  const x = n[0] + u[0] * a + v[0] * b, y = n[1] + u[1] * a + v[1] * b, z = n[2] + u[2] * a + v[2] * b;
  const x2 = x * x, y2 = y * y, z2 = z * z;
  return [x * Math.sqrt(1 - y2 / 2 - z2 / 2 + y2 * z2 / 3), y * Math.sqrt(1 - z2 / 2 - x2 / 2 + z2 * x2 / 3), z * Math.sqrt(1 - x2 / 2 - y2 / 2 + x2 * y2 / 3)];
}

// Triangle indices for an S×S grid plus a skirt around its edge. Skirts hang down
// from tile edges to hide hairline cracks where neighbouring tiles differ in detail.
const indexCache = new Map();
export function chunkIndices(S) {
  if (indexCache.has(S)) return indexCache.get(S);
  const V = S + 1, idx = [];
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
    idx.push(a, b, c, b, d, c); // counter-clockwise seen from outside (u × v points outward on every face)
  }
  const edge = [];
  for (let i = 0; i < S; i++) edge.push(i);                    // bottom (j = 0)
  for (let j = 0; j < S; j++) edge.push(j * V + S);            // right
  for (let i = S; i > 0; i--) edge.push(S * V + i);            // top
  for (let j = S; j > 0; j--) edge.push(j * V);                // left
  const base = V * V;
  for (let k = 0; k < edge.length; k++) {
    const a = edge[k], b = edge[(k + 1) % edge.length], sa = base + k, sb = base + (k + 1) % edge.length;
    idx.push(a, sa, b, b, sa, sb); // skirts face outward, toward the neighbouring tile
  }
  const out = { indices: new Uint32Array(idx), edge };
  indexCache.set(S, out);
  return out;
}

// spec: { face, a0, b0, size, segments }. Positions are relative to the tile centre (float precision).
export function buildChunk(body, spec) {
  const t = terrainFor(body), R = body.radius, S = spec.segments, V = S + 1;
  const { edge } = chunkIndices(S);
  const count = V * V + edge.length;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const wet = t.liquid === 'water' || t.liquid === 'lava';
  const water = wet ? new Float32Array(count * 3) : null;
  // The sea is a smooth sphere: it gets its own straight-up normals rather than
  // the ground's, which made it look faceted like the sea floor beneath it.
  const waterNormals = wet ? new Float32Array(count * 3) : null;
  const mid = faceDirection(spec.face, spec.a0 + spec.size / 2, spec.b0 + spec.size / 2);
  const cn = { x: mid[0], y: mid[1], z: mid[2] };
  const cr = R + t.meshHeight(cn);
  const center = [mid[0] * cr, mid[1] * cr, mid[2] * cr];
  let anyWet = false, maxD = 0;
  const n = { x: 0, y: 0, z: 0 };
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const d = faceDirection(spec.face, spec.a0 + spec.size * i / S, spec.b0 + spec.size * j / S);
    n.x = d[0]; n.y = d[1]; n.z = d[2];
    const h = t.meshHeight(n), r = R + h, k = (j * V + i) * 3;
    positions[k] = d[0] * r - center[0]; positions[k + 1] = d[1] * r - center[1]; positions[k + 2] = d[2] * r - center[2];
    normals[k] = d[0]; normals[k + 1] = d[1]; normals[k + 2] = d[2];
    const c = t.color(n, h); colors[k] = c[0]; colors[k + 1] = c[1]; colors[k + 2] = c[2];
    if (wet) {
      const rw = R + t.sea;
      water[k] = d[0] * rw - center[0]; water[k + 1] = d[1] * rw - center[1]; water[k + 2] = d[2] * rw - center[2];
      waterNormals[k] = d[0]; waterNormals[k + 1] = d[1]; waterNormals[k + 2] = d[2];
      if (h < t.sea) anyWet = true;
    }
    maxD = Math.max(maxD, Math.hypot(positions[k], positions[k + 1], positions[k + 2]));
  }
  // Surface normals from neighbouring grid points (used to light the skirts like the
  // ground beside them, so hairline gaps between tiles are invisible).
  const P = (i, j) => (Math.min(S, Math.max(0, j)) * V + Math.min(S, Math.max(0, i))) * 3;
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const a = P(i + 1, j), b = P(i - 1, j), c = P(i, j + 1), d = P(i, j - 1), k = (j * V + i) * 3;
    const ux = positions[a] - positions[b], uy = positions[a + 1] - positions[b + 1], uz = positions[a + 2] - positions[b + 2];
    const vx = positions[c] - positions[d], vy = positions[c + 1] - positions[d + 1], vz = positions[c + 2] - positions[d + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // u × v points outward on every face
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[k] = nx / l; normals[k + 1] = ny / l; normals[k + 2] = nz / l;
  }
  // Geomorphing: where each vertex sits in the next coarser level of detail. Odd
  // vertices move onto the line (or diagonal) between their even neighbours, which is
  // exactly the coarser tile's surface; the shader blends toward it with distance, so
  // switching detail levels never pops and tile edges meet their coarser neighbours.
  const lodDelta = new Float32Array(count * 3), lodColor = new Float32Array(count * 3);
  const waterDelta = wet ? new Float32Array(count * 3) : null;
  const morph = (src, out, j, i) => {
    let a, b;
    if (i % 2 && !(j % 2)) { a = j * V + i - 1; b = j * V + i + 1; }
    else if (!(i % 2) && j % 2) { a = (j - 1) * V + i; b = (j + 1) * V + i; }
    else if (i % 2 && j % 2) { a = (j - 1) * V + i + 1; b = (j + 1) * V + i - 1; } // the coarse quad's diagonal
    else return;
    const k = (j * V + i) * 3;
    for (let c = 0; c < 3; c++) out[k + c] = (src[a * 3 + c] + src[b * 3 + c]) / 2 - src[k + c];
  };
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    morph(positions, lodDelta, j, i); morph(colors, lodColor, j, i);
    if (wet) morph(water, waterDelta, j, i);
  }
  // Skirt vertices: copies of the edge, pulled toward the planet centre.
  const quad = R * spec.size * Math.PI / 4 / S, drop = quad * 1.5 + 1;
  for (let e = 0; e < edge.length; e++) {
    const src = edge[e] * 3, k = (V * V + e) * 3;
    const sx = positions[src] + center[0], sy = positions[src + 1] + center[1], sz = positions[src + 2] + center[2], sl = Math.hypot(sx, sy, sz);
    const ux = sx / sl, uy = sy / sl, uz = sz / sl; // radial direction for the drop
    positions[k] = positions[src] - ux * drop; positions[k + 1] = positions[src + 1] - uy * drop; positions[k + 2] = positions[src + 2] - uz * drop;
    normals[k] = normals[src]; normals[k + 1] = normals[src + 1]; normals[k + 2] = normals[src + 2];
    colors[k] = colors[src]; colors[k + 1] = colors[src + 1]; colors[k + 2] = colors[src + 2];
    for (let c = 0; c < 3; c++) { lodDelta[k + c] = lodDelta[src + c]; lodColor[k + c] = lodColor[src + c]; if (wet) waterDelta[k + c] = waterDelta[src + c]; }
    // Water gets a shallow skirt too, so seams between tiles of different detail never show the sea floor.
    if (wet) {
      const wd = drop * .5; water[k] = water[src] - ux * wd; water[k + 1] = water[src + 1] - uy * wd; water[k + 2] = water[src + 2] - uz * wd;
      waterNormals[k] = waterNormals[src]; waterNormals[k + 1] = waterNormals[src + 1]; waterNormals[k + 2] = waterNormals[src + 2];
    }
  }
  return { positions, colors, normals, lodDelta, lodColor, water: anyWet ? water : null, waterDelta: anyWet ? waterDelta : null, waterNormals: anyWet ? waterNormals : null, center, radius: maxD + drop };
}
