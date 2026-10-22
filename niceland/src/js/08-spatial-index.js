/**
 * Spatial index
 *
 * Hashed buckets for buildings, trees, lamps, road nodes and road segments, so lookups near a point are
 * fast.
 *
 * Functions: bkey, badd, eachB, hallFacade, rebuildHall, addB, buildIndices, segBucket, rasterB, pip,
 *     linkB, nearestNode, bldAtCell, eachBldInCell
 * State and constants: BG, GOX, GOY, BGW, BGH, BBUCK, TBUCK, LBUCK, NBUCK, SBUCK, LAMPX, LAMPY, GW, GD,
 *     NODE_WATER, NDEG, nearB, nearT
 */

const BG = 60;
let GOX, GOY, BGW, BGH;
let BBUCK = new Map(),
  TBUCK = new Map(),
  LBUCK = new Map(),
  NBUCK = new Map(),
  SBUCK = new Map();
let LAMPX = [],
  LAMPY = [],
  GW,
  GD,
  NODE_WATER,
  NDEG;
function bkey(x, y) {
  const i = Math.floor((x - GOX) / BG),
    j = Math.floor((y - GOY) / BG);
  if (i < 0 || j < 0 || i >= BGW || j >= BGH) return -1;
  return i + j * BGW;
}
function badd(m, k, v) {
  if (k < 0) return;
  let a = m.get(k);
  if (!a) {
    a = [];
    m.set(k, a);
  }
  a.push(v);
}

function eachB(m, x0, y0, x1, y1, fn) {
  const i0 = Math.max(0, Math.floor((x0 - GOX) / BG)),
    i1 = Math.min(BGW - 1, Math.floor((x1 - GOX) / BG)),
    j0 = Math.max(0, Math.floor((y0 - GOY) / BG)),
    j1 = Math.min(BGH - 1, Math.floor((y1 - GOY) / BG));
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > m.size * 2) {
    for (const [k, a] of m) {
      const i = k % BGW,
        j = (k / BGW) | 0;
      if (i >= i0 && i <= i1 && j >= j0 && j <= j1) for (const v of a) fn(v);
    }
    return;
  }
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const a = m.get(i + j * BGW);
      if (a) for (const v of a) fn(v);
    }
}

/* Hallgrímskirkja: OSM models the tower as a stack of shrinking boxes; rebuild it as the real facade —
   a central shaft with stepped basalt-column wings falling away on both sides, and the spire on top. */
function hallFacade(T, ux, uy, du0, du1, W, mk) {
  const vx = -uy,
    vy = ux;
  const box = (u0, u1, v0, v1) => {
    const p = [];
    for (const [u, v] of [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1]
    ])
      p.push(T[0] + u * ux + v * vx, T[1] + u * uy + v * vy);
    return area2(p) < 0
      ? new Float32Array([p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]])
      : new Float32Array(p);
  };
  const SH = 4.2,
    NC = 6,
    cw = (W - SH) / NC,
    um = (du0 + du1) / 2;
  const shaft = mk(box(du0, du1, -SH, SH), 0, 62, 0);
  const spire = mk(box(um - 3.2, um + 3.2, -3.2, 3.2), 62, 69.5, 3);
  if (shaft && spire) {
    spire.sup = shaft;
    rotB(spire);
  }
  for (let i = 0; i < NC; i++) {
    const f = i / (NC - 1),
      top = Math.round(14 + 36 * Math.pow(1 - f, 1.25)),
      d0 = du0 + 0.6 + i * 0.35;
    for (const s of [1, -1]) {
      const a = s * (SH + i * cw),
        b2 = s * (SH + (i + 1) * cw);
      mk(box(d0, du1, Math.min(a, b2), Math.max(a, b2)), 0, top, 0);
    }
  }
}
function rebuildHall() {
  const g = B.filter(b => b.sp === 1);
  if (!g.length) return;
  const nave = g.filter(b => b.roof === 1).sort((a, b) => b.area - a.area)[0];
  const top = g.filter(b => b.base > 0).sort((a, b) => b.base - a.base)[0];
  if (!nave || !top) return;
  const tower = g.filter(b => b !== nave && Math.hypot(b.cx - top.cx, b.cy - top.cy) < 7);
  const bot = tower.sort((a, b) => b.area - a.area)[0];
  if (!bot || bot.base > 0) return;
  let ux = bot.cx - nave.cx,
    uy = bot.cy - nave.cy;
  const L = Math.hypot(ux, uy) || 1;
  ux /= L;
  uy /= L;
  const vx = -uy,
    vy = ux;
  let u0 = 1e9,
    u1 = -1e9,
    w = 0;
  const P = bot.poly;
  for (let j = 0; j < bot.n; j++) {
    const dx = P[2 * j] - bot.cx,
      dy = P[2 * j + 1] - bot.cy,
      u = dx * ux + dy * uy,
      v = dx * vx + dy * vy;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    w = Math.max(w, Math.abs(v));
  }
  if (u1 - u0 > w * 2) {
    /* footprint is long along the nave axis: swap */ const t = w;
    w = (u1 - u0) / 2;
    u0 = -t;
    u1 = t;
  }
  const keep = B.filter(b => !tower.includes(b));
  const add = [];
  const proto = nave;
  hallFacade([bot.cx, bot.cy], ux, uy, u0, u1, Math.max(w, 12), (poly, base, topz, roof) => {
    const b = mkB(poly, {
      h: topz - base,
      base,
      kind: 8,
      roof,
      sp: 1,
      name: proto.name,
      addr: proto.addr,
      use: proto.use,
      res: 0,
      jobs: 0
    });
    b.wallC = proto.wallC;
    b.roofC = proto.roofC;
    b.group = 'hall';
    add.push(b);
    return b;
  });
  B.length = 0;
  for (const b of keep) B.push(b);
  for (const b of add) B.push(b);
  for (let i = 0; i < B.length; i++) B[i].id = i;
}
function addB(b) {
  badd(BBUCK, bkey(b.cx, b.cy), b);
  b.z = hAt(b.cx, b.cy);
}
function buildIndices() {
  GOX = C.OX;
  GOY = C.OY;
  BGW = Math.ceil((C.x1 - C.OX) / BG);
  BGH = Math.ceil((C.y1 - C.OY) / BG);
  for (const b of B) addB(b);
  {
    const g = B.filter(b => b.group === 'hall');
    if (g.length) {
      const z = Math.min(...g.map(b => b.z));
      for (const b of g) b.z = z;
    }
  }
  {
    const G = new Map();
    for (const b of B)
      if ((b.lm || b.po) && b.group) {
        if (!G.has(b.group)) G.set(b.group, []);
        G.get(b.group).push(b);
      }
    for (const g of G.values()) {
      const z = Math.min(...g.map(b => b.z));
      for (const b of g) b.z = z;
    }
  }
  for (let i = 0; i < NT; i++) badd(TBUCK, bkey(TREES.x[i], TREES.y[i]), i);
  for (const b of B) if (inF(b.cx, b.cy)) rasterB(b);
  for (const b of B) linkB(b);
  NODE_WATER = new Uint8Array(NODE_N);
  for (let i = 0; i < NODE_N; i++) {
    const c = cellAt(NX[i], NY[i]);
    if (c >= 0 && isWaterT(gTfast(c))) NODE_WATER[i] = 1;
  }
  const deg = new Uint8Array(NODE_N);
  for (let w = 0; w < WAYS.length; w++) {
    const wy = WAYS[w],
      ns = wy.nodes;
    for (let j = 0; j < ns.length; j++)
      deg[ns[j]] = Math.min(255, deg[ns[j]] + (j === 0 || j === ns.length - 1 ? 1 : 2));
    for (let j = 0; j + 1 < ns.length; j++) segBucket(w, j, ns[j], ns[j + 1]);
    if (wy.cl <= 5 && !wy.tu && !wy.br && inF(NX[ns[0]], NY[ns[0]])) {
      let acc = 17;
      for (let j = 0; j + 1 < ns.length; j++) {
        const a = ns[j],
          b = ns[j + 1],
          dx = NX[b] - NX[a],
          dy = NY[b] - NY[a],
          L = Math.hypot(dx, dy);
        if (L < 0.1) continue;
        while (acc < L) {
          const t = acc / L,
            s = (LAMPX.length % 2 ? 1 : -1) * (wy.cl <= 2 ? 9 : 5.5);
          const px = NX[a] + dx * t - (dy / L) * s,
            py = NY[a] + dy * t + (dx / L) * s;
          badd(LBUCK, bkey(px, py), LAMPX.length);
          LAMPX.push(px);
          LAMPY.push(py);
          acc += 36;
        }
        acc -= L;
      }
    }
  }
  for (let i = 0; i < NODE_N; i++) if (deg[i] > 0) badd(NBUCK, bkey(NX[i], NY[i]), i);
  NDEG = deg;
  NDEGD = new Uint8Array(NODE_N);
  for (const wy of WAYS) {
    if (wy.cl > 6) continue;
    const ns = wy.nodes;
    for (let j = 0; j < ns.length; j++)
      NDEGD[ns[j]] = Math.min(255, NDEGD[ns[j]] + (j === 0 || j === ns.length - 1 ? 1 : 2));
  }
  GW = buildGraph(false);
  GD = buildGraph(true);
  roadxIndices();
}
function segBucket(w, j, a, b) {
  const L = Math.hypot(NX[b] - NX[a], NY[b] - NY[a]),
    st = Math.max(1, Math.ceil(L / (BG * 0.5)));
  let last = -2;
  for (let s = 0; s <= st; s++) {
    const t = s / st,
      k = bkey(NX[a] + (NX[b] - NX[a]) * t, NY[a] + (NY[b] - NY[a]) * t);
    if (k >= 0 && k !== last) {
      badd(SBUCK, k, w);
      badd(SBUCK, k, j);
      last = k;
    }
  }
}
function rasterB(b) {
  const g = F;
  const i0 = Math.max(0, Math.floor((b.minx - g.OX) / g.CS)),
    i1 = Math.min(g.W - 1, Math.floor((b.maxx - g.OX) / g.CS)),
    j0 = Math.max(0, Math.floor((b.miny - g.OY) / g.CS)),
    j1 = Math.min(g.H - 1, Math.floor((b.maxy - g.OY) / g.CS));
  let any = false;
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const x = g.OX + (i + 0.5) * g.CS,
        y = g.OY + (j + 0.5) * g.CS;
      if (pip(b.poly, x, y)) {
        g.CBLD[i + j * g.W] = b.id;
        any = true;
      }
    }
  if (!any) {
    const c = cellAt(b.cx, b.cy);
    if (c >= 0 && c < FN && g.CBLD[c] < 0) g.CBLD[c] = b.id;
  }
}
function pip(P, x, y) {
  let ins = false;
  const n = P.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = P[2 * i],
      yi = P[2 * i + 1],
      xj = P[2 * j],
      yj = P[2 * j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const nearB = (x, y, r, fn) => eachB(BBUCK, x - r, y - r, x + r, y + r, fn);
const nearT = (x, y, r, fn) => eachB(TBUCK, x - r, y - r, x + r, y + r, fn);
function linkB(b) {
  b.nb = [];
  nearB(b.cx, b.cy, 90, o => {
    if (o === b) return;
    const d = Math.hypot(o.cx - b.cx, o.cy - b.cy);
    if (d < b.r + o.r + 7) {
      b.nb.push(o);
      if (o.nb && !o.nb.includes(b) && o.id > b.id) o.nb.push(b);
    }
  });
}
function nearestNode(x, y, G, maxR) {
  let best = -1,
    bd = 1e18;
  const r = maxR || 120;
  eachB(NBUCK, x - r, y - r, x + r, y + r, n => {
    if (G && G.off[n] === G.off[n + 1]) return;
    const d = (NX[n] - x) ** 2 + (NY[n] - y) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  });
  return best;
}
function bldAtCell(c) {
  if (c < FN) {
    const bi = F.CBLD[c];
    if (bi >= 0) return B[bi];
  }
  const [x, y] = cellCenter(c);
  let r = null;
  nearB(x, y, 60, b => {
    if (!r && b.state < 9 && (cellAt(b.cx, b.cy) === c || pip(b.poly, x, y))) r = b;
  });
  return r;
}
function eachBldInCell(c, fn) {
  const [x, y] = cellCenter(c);
  const seen = new Set();
  if (c < FN) {
    const bi = F.CBLD[c];
    if (bi >= 0) {
      seen.add(bi);
      fn(B[bi]);
    }
  }
  nearB(x, y, 60, b => {
    if (seen.has(b.id)) return;
    if (cellAt(b.cx, b.cy) === c || pip(b.poly, x, y)) {
      seen.add(b.id);
      fn(b);
    }
  });
}
