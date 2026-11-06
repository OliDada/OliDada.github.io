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
  const newLand = body.landStyle !== 'classic';
  const { edge } = chunkIndices(S);
  const count = V * V + edge.length;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  // What the ground is made of at each vertex (grass, bare rock, snow, 0..1): picks the close-up detail drawn by the shader.
  const cover = new Float32Array(count * 3);
  const wet = t.liquid === 'water' || t.liquid === 'lava';
  const water = wet ? new Float32Array(count * 3) : null;
  // The sea is a smooth sphere: it gets its own straight-up normals rather than
  // the ground's, which made it look faceted like the sea floor beneath it.
  const waterNormals = wet ? new Float32Array(count * 3) : null;
  const waterDepth = wet ? new Float32Array(count) : null; // metres of liquid over the ground (the sea's colour, foam at the shore)
  const mid = faceDirection(spec.face, spec.a0 + spec.size / 2, spec.b0 + spec.size / 2);
  const cn = { x: mid[0], y: mid[1], z: mid[2] };
  const cr = R + t.meshHeight(cn);
  const center = [mid[0] * cr, mid[1] * cr, mid[2] * cr];
  let anyWet = false, maxD = 0;
  const n = { x: 0, y: 0, z: 0 };
  const spacing = R * spec.size * Math.PI / 4 / S; // metres between grid points
  // Two surfaces are worked out: this tile's own, and its parent's (the next coarser
  // level, twice the spacing). Each level only keeps ground detail it can show
  // (terrain.mjs fades out bumps and colour noise finer than about three grid
  // spacings), so nothing aliases into blocky squares. The parent's surface is what
  // this tile blends into with distance (geomorphing), so when the parent replaces
  // it, or it replaces the parent, nothing changes on screen.
  // Grid points run from -2 to S + 2: a ring around the tile so slope, hollows and
  // normals are measured the same way on both sides of a tile edge.
  const O = 2, E = S + 1 + 2 * O, idx = (i, j) => (j + O) * E + i + O;
  const dirs = new Float64Array(E * E * 3), own = new Float64Array(E * E).fill(NaN), par = new Float64Array(E * E).fill(NaN);
  for (let j = -O; j <= S + O; j++) for (let i = -O; i <= S + O; i++) {
    const d = faceDirection(spec.face, spec.a0 + spec.size * i / S, spec.b0 + spec.size * j / S), e = idx(i, j);
    dirs[e * 3] = d[0]; dirs[e * 3 + 1] = d[1]; dirs[e * 3 + 2] = d[2];
    n.x = d[0]; n.y = d[1]; n.z = d[2];
    if (i >= -1 && i <= S + 1 && j >= -1 && j <= S + 1) own[e] = t.meshHeight(n, spacing);
    if (!(i % 2) && !(j % 2)) par[e] = t.meshHeight(n, spacing * 2);
  }
  // Slope and hollowness at grid point (i, j) of a surface, using neighbours `st` points away.
  const shapeAt = (hs, i, j, st, sp, out) => {
    const e = idx(i, j), at = (ii, jj) => idx(ii, jj);
    const p = (k, h) => [dirs[k * 3] * (R + h), dirs[k * 3 + 1] * (R + h), dirs[k * 3 + 2] * (R + h)];
    const A = p(at(i + st, j), hs[at(i + st, j)]), B = p(at(i - st, j), hs[at(i - st, j)]), C = p(at(i, j + st), hs[at(i, j + st)]), D = p(at(i, j - st), hs[at(i, j - st)]);
    const ux = A[0] - B[0], uy = A[1] - B[1], uz = A[2] - B[2], vx = C[0] - D[0], vy = C[1] - D[1], vz = C[2] - D[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // u × v points outward on every face
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    out.nx = nx; out.ny = ny; out.nz = nz;
    out.slope = 1 - Math.max(0, nx * dirs[e * 3] + ny * dirs[e * 3 + 1] + nz * dirs[e * 3 + 2]);
    out.hollow = ((hs[at(i + st, j)] + hs[at(i - st, j)] + hs[at(i, j + st)] + hs[at(i, j - st)]) / 4 - hs[e]) / sp;
    // New land: this measure grows with the spacing (it is curvature times spacing), so on
    // coarse, distant tiles over tall mountains every small bench read as a deep hollow or
    // a sharp crest, and the shading and colours that follow hollows (darker hollows, lit
    // crests, snow, scree, moss) striped the slopes along their contours. Held to what a
    // 2 m grid would measure.
    if (newLand && sp > 2) out.hollow *= 2 / sp;
    out.spacing = sp;
    return out;
  };
  const shape = {}, pshape = {}, info = {};
  // The parent's position and colour at its own grid points (even i and j), relative to the tile centre.
  const parPos = new Float32Array(count * 3), parCol = new Float32Array(count * 3), parNor = new Float32Array(count * 3);
  const colourAt = (i, j, h, sh, outArr, k, withCover) => {
    const e = idx(i, j); n.x = dirs[e * 3]; n.y = dirs[e * 3 + 1]; n.z = dirs[e * 3 + 2];
    // terrain.mjs works in sRGB (the palettes are hex colours); the renderer expects
    // linear vertex colours, so convert, or every world looks washed out and pale.
    const col = t.color(n, h, sh, info);
    outArr[k] = col[0] ** 2.2; outArr[k + 1] = col[1] ** 2.2; outArr[k + 2] = col[2] ** 2.2;
    if (withCover) { cover[k] = info.veg; cover[k + 1] = info.bare; cover[k + 2] = info.snow; }
  };
  for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
    const e = idx(i, j), k = (j * V + i) * 3, h = own[e];
    const dx = dirs[e * 3], dy = dirs[e * 3 + 1], dz = dirs[e * 3 + 2];
    positions[k] = dx * (R + h) - center[0]; positions[k + 1] = dy * (R + h) - center[1]; positions[k + 2] = dz * (R + h) - center[2];
    shapeAt(own, i, j, 1, spacing, shape);
    normals[k] = shape.nx; normals[k + 1] = shape.ny; normals[k + 2] = shape.nz;
    colourAt(i, j, h, shape, colors, k, true);
    if (!(i % 2) && !(j % 2)) {
      const hp = par[e];
      parPos[k] = dx * (R + hp) - center[0]; parPos[k + 1] = dy * (R + hp) - center[1]; parPos[k + 2] = dz * (R + hp) - center[2];
      colourAt(i, j, hp, shapeAt(par, i, j, 2, spacing * 2, pshape), parCol, k, false);
      parNor[k] = pshape.nx; parNor[k + 1] = pshape.ny; parNor[k + 2] = pshape.nz;
    }
    if (wet) {
      const rw = R + t.sea;
      water[k] = dx * rw - center[0]; water[k + 1] = dy * rw - center[1]; water[k + 2] = dz * rw - center[2];
      waterNormals[k] = dx; waterNormals[k + 1] = dy; waterNormals[k + 2] = dz;
      waterDepth[k / 3] = t.sea - h;
      if (h < t.sea) anyWet = true;
    }
    maxD = Math.max(maxD, Math.hypot(positions[k], positions[k + 1], positions[k + 2]));
  }
  // Geomorphing: how far each vertex is from the parent's surface. Even vertices sit
  // on the parent's own grid points; odd ones on the line (or diagonal) between them,
  // which is exactly the parent's triangle. The shader blends toward it with
  // distance, so switching detail levels never pops and tile edges meet coarser neighbours.
  // Normals blend too (the ground is smoothly shaded), so lighting doesn't pop either.
  const lodDelta = new Float32Array(count * 3), lodColor = new Float32Array(count * 3), lodNormal = new Float32Array(count * 3);
  const waterDelta = wet ? new Float32Array(count * 3) : null;
  const morph = (own, target, out, j, i) => {
    const k = (j * V + i) * 3;
    let a, b;
    if (i % 2 && !(j % 2)) { a = j * V + i - 1; b = j * V + i + 1; }
    else if (!(i % 2) && j % 2) { a = (j - 1) * V + i; b = (j + 1) * V + i; }
    else if (i % 2 && j % 2) { a = (j - 1) * V + i + 1; b = (j + 1) * V + i - 1; } // the coarse quad's diagonal
    else { for (let c = 0; c < 3; c++) out[k + c] = target[k + c] - own[k + c]; return; }
    for (let c = 0; c < 3; c++) out[k + c] = (target[a * 3 + c] + target[b * 3 + c]) / 2 - own[k + c];
  };
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    morph(positions, parPos, lodDelta, j, i); morph(colors, parCol, lodColor, j, i); morph(normals, parNor, lodNormal, j, i);
    if (wet) morph(water, water, waterDelta, j, i);
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
    cover[k] = cover[src]; cover[k + 1] = cover[src + 1]; cover[k + 2] = cover[src + 2];
    for (let c = 0; c < 3; c++) { lodDelta[k + c] = lodDelta[src + c]; lodColor[k + c] = lodColor[src + c]; lodNormal[k + c] = lodNormal[src + c]; if (wet) waterDelta[k + c] = waterDelta[src + c]; }
    // Water gets a shallow skirt too, so seams between tiles of different detail never show the sea floor.
    if (wet) {
      const wd = drop * .5; water[k] = water[src] - ux * wd; water[k + 1] = water[src + 1] - uy * wd; water[k + 2] = water[src + 2] - uz * wd;
      waterNormals[k] = waterNormals[src]; waterNormals[k + 1] = waterNormals[src + 1]; waterNormals[k + 2] = waterNormals[src + 2];
      waterDepth[k / 3] = waterDepth[src / 3];
    }
  }
  return { positions, colors, normals, cover, lodDelta, lodColor, lodNormal, water: anyWet ? water : null, waterDelta: anyWet ? waterDelta : null, waterNormals: anyWet ? waterNormals : null, waterDepth: anyWet ? waterDepth : null, center, radius: maxD + drop };
}
