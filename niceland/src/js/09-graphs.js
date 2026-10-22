/**
 * Road graphs and A*
 *
 * Driving (GD) and walking (GW) graphs built from the roads, and A* path finding.
 *
 * Functions: buildGraph, initAstar, blockedNode, astar, edgeWay, edgeClass
 * State and constants: AS_g, AS_p, AS_s, AS_stamp, HEAPN, HEAPF
 */

function buildGraph(drive) {
  const cnt = new Int32Array(NODE_N + 1);
  const ok = c => (drive ? c <= 6 : c !== 0 && c < 10);
  const one = w => drive && w.ow;
  for (const w of WAYS) {
    if (!ok(w.cl) || (drive && SHUT && w.fl & 1)) continue;
    const ns = w.nodes;
    for (let j = 0; j + 1 < ns.length; j++) {
      cnt[ns[j]]++;
      if (!one(w)) cnt[ns[j + 1]]++;
    }
  }
  const off = new Int32Array(NODE_N + 1);
  for (let i = 0; i < NODE_N; i++) off[i + 1] = off[i] + cnt[i];
  const E = off[NODE_N],
    to = new Int32Array(E),
    wt = new Float32Array(E),
    cl = new Uint8Array(E),
    wi = new Int32Array(E),
    fill = off.slice(0, NODE_N);
  let wn = -1;
  const SPD = [1, 25, 18, 15, 13, 9, 6, 5, 5, 5];
  for (const w of WAYS) {
    wn++;
    if (!ok(w.cl) || (drive && SHUT && w.fl & 1)) continue;
    const ns = w.nodes;
    for (let j = 0; j + 1 < ns.length; j++) {
      const a = ns[j],
        b = ns[j + 1],
        L = Math.hypot(NX[a] - NX[b], NY[a] - NY[b]);
      const c = drive ? L / SPD[w.cl] : L * (w.cl <= 2 ? 2.2 : w.cl === 9 ? 1.4 : w.cl >= 7 ? 0.85 : 1);
      to[fill[a]] = b;
      wt[fill[a]] = c;
      cl[fill[a]] = w.cl;
      wi[fill[a]] = wn;
      fill[a]++;
      if (!one(w)) {
        to[fill[b]] = a;
        wt[fill[b]] = c;
        cl[fill[b]] = w.cl;
        wi[fill[b]] = wn;
        fill[b]++;
      }
    }
  }
  return { off, to, wt, cl, wi, drive, sp: drive ? 25 : 1 };
}
let AS_g,
  AS_p,
  AS_s,
  AS_stamp = 1,
  HEAPN,
  HEAPF;
function initAstar() {
  AS_g = new Float32Array(NODE_N);
  AS_p = new Int32Array(NODE_N);
  AS_s = new Uint32Array(NODE_N);
  HEAPN = new Int32Array(1 << 17);
  HEAPF = new Float32Array(1 << 17);
}
function blockedNode(n) {
  const c = cellAt(NX[n], NY[n]);
  if (c < 0) return false;
  const t = gTfast(c);
  if (t === LAVA) return true;
  if (!NODE_WATER[n] && (t === SEA || t === LAKE)) return true;
  if (flood > 0 && !NODE_WATER[n] && hAtFast(NX[n], NY[n]) < flood) return true;
  return false;
}
function astar(G, s, t, maxExp) {
  if (s < 0 || t < 0) return null;
  if (s === t) return [s];
  const st = ++AS_stamp,
    tx = NX[t],
    ty = NY[t],
    hs = G.drive ? 1 / G.sp : 1;
  let hn = 0;
  const push = (n, f) => {
    let i = hn++;
    if (i >= HEAPN.length) return;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (HEAPF[p] <= f) break;
      HEAPN[i] = HEAPN[p];
      HEAPF[i] = HEAPF[p];
      i = p;
    }
    HEAPN[i] = n;
    HEAPF[i] = f;
  };
  const pop = () => {
    const r = HEAPN[0];
    const ln = HEAPN[--hn],
      lf = HEAPF[hn];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= hn) break;
      if (c + 1 < hn && HEAPF[c + 1] < HEAPF[c]) c++;
      if (HEAPF[c] >= lf) break;
      HEAPN[i] = HEAPN[c];
      HEAPF[i] = HEAPF[c];
      i = c;
    }
    HEAPN[i] = ln;
    HEAPF[i] = lf;
    return r;
  };
  AS_s[s] = st;
  AS_g[s] = 0;
  AS_p[s] = -1;
  push(s, 0);
  let exp = 0;
  while (hn > 0) {
    const n = pop();
    if (n === t) break;
    if (++exp > maxExp) return null;
    const gn = AS_g[n];
    for (let e = G.off[n]; e < G.off[n + 1]; e++) {
      const m = G.to[e];
      const ng = gn + G.wt[e];
      if (AS_s[m] === st && AS_g[m] <= ng) continue;
      if (blockedNode(m)) continue;
      if (G.drive && PBLK && PBLK[m] && m !== t) continue;
      AS_s[m] = st;
      AS_g[m] = ng;
      AS_p[m] = n;
      push(m, ng + Math.hypot(NX[m] - tx, NY[m] - ty) * hs);
    }
  }
  if (AS_s[t] !== st) return null;
  const path = [];
  for (let n = t; n >= 0; n = AS_p[n]) {
    path.push(n);
    if (n === s) break;
  }
  return path.reverse();
}
function edgeWay(G, a, b) {
  if (!G.wi) return -1;
  for (let e = G.off[a]; e < G.off[a + 1]; e++) if (G.to[e] === b) return G.wi[e];
  return -1;
}
function edgeClass(G, a, b) {
  for (let e = G.off[a]; e < G.off[a + 1]; e++) if (G.to[e] === b) return G.cl[e];
  return 5;
}
