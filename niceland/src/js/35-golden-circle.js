/**
 * Golden Circle
 *
 * Tour coaches to Þingvellir, Geysir and Gullfoss, and tourists at the stops.
 *
 * Functions: gcInit, gcActive, stepGC
 * State and constants: GC_WP, GC_STOPS, GC, GCB, gcAcc, GC_LIV
 */

const GC_WP = {
  out: [
    [64.1376, -21.9339],
    [64.2556, -21.1296],
    [64.3105, -20.3035],
    [64.3266, -20.119]
  ],
  back: [
    [64.3266, -20.119],
    [63.936, -21.001],
    [64.001, -21.188],
    [64.1376, -21.9339]
  ]
};
const GC_STOPS = [
  { name: 'Þingvellir', park: [64.2556, -21.1296], sight: [64.258, -21.1265], h: [9.4, 12.2] },
  { name: 'Geysir', park: [64.3105, -20.3035], sight: [64.3126, -20.3008], h: [11, 14.2] },
  { name: 'Gullfoss', park: [64.3266, -20.119], sight: [64.3258, -20.1215], h: [12.2, 15.6] }
];
let GC = null,
  GCB = new Map(),
  gcAcc = 0;
const GC_LIV = [
  [236, 236, 232],
  [240, 240, 236],
  [40, 60, 110],
  [230, 230, 226],
  [200, 40, 40]
];
function gcInit() {
  GC = {};
  for (const k of ['out', 'back']) {
    const W = GC_WP[k].map(p => {
      const q = LL(p[0], p[1]);
      return nearestNode(q[0], q[1], GD, 800);
    });
    const R_ = [];
    let ok = true;
    for (let i = 0; i + 1 < W.length; i++) {
      if (W[i] < 0 || W[i + 1] < 0) {
        ok = false;
        break;
      }
      const p = astar(GD, W[i], W[i + 1], 600000);
      if (!p) {
        ok = false;
        break;
      }
      for (let q = R_.length ? 1 : 0; q < p.length; q++) R_.push(p[q]);
    }
    if (!ok) continue;
    GC[k] = Int32Array.from(R_);
    for (let i = 0; i < R_.length; i += 2) {
      const n = R_[i];
      const key = Math.floor(NX[n] / 500) * 100003 + Math.floor(NY[n] / 500);
      let a = GCB.get(key);
      if (!a) GCB.set(key, (a = []));
      a.push([k, i]);
    }
  }
}
function gcActive(k, h) {
  return k === 'out' ? h >= 8 && h < 13.5 : h >= 14.2 && h < 19;
}
function stepGC(dt) {
  gcAcc += dt;
  if (gcAcc < 2) return;
  gcAcc = 0;
  if (K < 0.12) return;
  const h = (gameMin % 1440) / 60;
  if (h < 8 || h > 19.5) return;
  const vr = viewRect(200, 800);
  // is the route anywhere near the view?
  const vis = { out: [], back: [] };
  const i0 = Math.floor(vr[0] / 500),
    i1 = Math.floor(vr[2] / 500),
    j0 = Math.floor(vr[1] / 500),
    j1 = Math.floor(vr[3] / 500);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 20000) return;
  const near = (la, lo) => {
    const q = LL(la, lo);
    return q[0] > vr[0] - 30000 && q[0] < vr[2] + 30000 && q[1] > vr[1] - 30000 && q[1] < vr[3] + 30000;
  };
  if (!GC) {
    if (![...GC_WP.out, ...GC_WP.back].some(p => near(p[0], p[1]))) return;
    gcInit();
  }
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const a = GCB.get(i * 100003 + j);
      if (a) for (const [k, idx] of a) vis[k].push(idx);
    }
  let have = 0;
  for (const a of agents) if (!a.dead && a.coachR) have++;
  for (const k of ['out', 'back']) {
    if (!gcActive(k, h) || !vis[k].length || !GC[k]) continue;
    const peak =
      k === 'out' ? Math.max(0, 1 - Math.abs(h - 10) / 3) : Math.max(0, 1 - Math.abs(h - 16.5) / 2.5);
    const want = Math.min(8, Math.round(((vis[k].length * 2 * 500) / 4000) * peak + 0.4));
    if (have >= want) continue;
    let idx = vis[k][(R() * vis[k].length) | 0];
    const R0 = GC[k];
    for (let q = 0; q < 400 && idx > 0 && onScr(NX[R0[idx]], NY[R0[idx]], 40); q++) idx--;
    if (onScr(NX[R0[idx]], NY[R0[idx]], 40)) continue;
    const c = mkAgent('car', NX[R0[idx]], NY[R0[idx]]);
    setVT(c, 'coach');
    c.c = pickA(GC_LIV);
    c.coachR = R0;
    c.coachI = idx;
    c.path = Array.from(R0.slice(idx, idx + 800));
    c.pi = 0;
    c.t = 0;
    c.coach = 1;
    c.nPax = 30 + ((R() * 28) | 0);
    const nextStop =
      k === 'back'
        ? 'Reykjavík'
        : GC_STOPS.find(s => {
            const q = LL(s.park[0], s.park[1]);
            let best = 1e18;
            for (let z = idx; z < R0.length; z += 40) {
              const d = (NX[R0[z]] - q[0]) ** 2 + (NY[R0[z]] - q[1]) ** 2;
              if (d < best) best = d;
            }
            return best < 400 ** 2;
          })?.name || 'Gullfoss';
    c.vname = 'Hópferðabíll · tour coach';
    c.act = 'Golden Circle tour';
    c.story = {
      drv: {
        name: personName(R() < 0.3),
        age: 28 + ((R() * 30) | 0),
        job: 'Hópferðabílstjóri · coach driver'
      },
      pax: [],
      doing:
        k === 'out'
          ? 'Golden Circle tour · next stop ' + nextStop
          : 'Golden Circle tour · heading back to Reykjavík',
      to: k === 'out' ? nextStop : 'Reykjavík',
      from: k === 'out' ? 'BSÍ, Reykjavík' : 'Gullfoss'
    };
    setPos(c);
    agents.push(c);
    have++;
  }
  // coaches parked at the stops, with their passengers out at the sight
  for (const S of GC_STOPS) {
    const q = LL(S.park[0], S.park[1]);
    const inV = q[0] > vr[0] && q[0] < vr[2] && q[1] > vr[1] && q[1] < vr[3] && K >= 0.3;
    const open = h >= S.h[0] && h < S.h[1];
    S.ag = S.ag || [];
    S.ag = S.ag.filter(a => !a.dead);
    if (!inV || !open) {
      for (const a of S.ag) if (a !== follow && a !== selected) a.dead = true;
      S.ag = [];
      continue;
    }
    const mid = (S.h[0] + S.h[1]) / 2,
      peak = Math.max(0.25, 1 - Math.abs(h - mid) / ((S.h[1] - S.h[0]) / 2));
    const nC = Math.round(2 + peak * 6),
      nT = Math.round(10 + peak * 45);
    let cs = S.ag.filter(a => a.car).length,
      ts = S.ag.length - cs;
    const pn = nearestNode(q[0], q[1], GD, 300);
    let ux = 1,
      uy = 0;
    if (pn >= 0) {
      for (let e = GD.off[pn]; e < GD.off[pn + 1]; e++) {
        const t = GD.to[e];
        const l = Math.hypot(NX[t] - NX[pn], NY[t] - NY[pn]) || 1;
        ux = (NX[t] - NX[pn]) / l;
        uy = (NY[t] - NY[pn]) / l;
        break;
      }
    }
    const bx = pn >= 0 ? NX[pn] - uy * 12 : q[0],
      by = pn >= 0 ? NY[pn] + ux * 12 : q[1];
    for (; cs < nC; cs++) {
      const c = mkAgent('car', bx + ux * (cs - nC / 2) * 16, by + uy * (cs - nC / 2) * 16);
      setVT(c, 'coach');
      c.c = pickA(GC_LIV);
      c.keep = 1;
      c.path = null;
      c.coach = 1;
      c.nPax = 0;
      c.vx = -uy;
      c.vy = ux;
      c.vname = 'Hópferðabíll · tour coach';
      c.act = 'Parked at ' + S.name;
      c.story = {
        drv: {
          name: personName(R() < 0.3),
          age: 28 + ((R() * 30) | 0),
          job: 'Hópferðabílstjóri · coach driver'
        },
        pax: [],
        doing: 'Waiting while the group visits ' + S.name,
        to: '—',
        from: 'BSÍ, Reykjavík'
      };
      agents.push(c);
      S.ag.push(c);
    }
    const sg = LL(S.sight[0], S.sight[1]);
    for (; ts < nT; ts++) {
      let x,
        y,
        ok = false;
      for (let z = 0; z < 8 && !ok; z++) {
        const an = R() * 6.283,
          r = 4 + R() * 40;
        x = sg[0] + Math.cos(an) * r;
        y = sg[1] + Math.sin(an) * r;
        const c0 = cellAt(x, y);
        ok = !(c0 >= 0 && isWaterT(gTfast(c0))) && !inBld(x, y);
      }
      if (!ok) continue;
      const a = mkAgent('tourist', x, y);
      a.keep = 1;
      a.state = 'idle';
      a.idle = 1e9;
      a.photo = 1;
      a.act = 'On a Golden Circle tour at ' + S.name;
      a.face = R() < 0.5 ? 1 : -1;
      a.vx = sg[0] - x;
      a.vy = sg[1] - y;
      if (SEAS === 'winter' || TEMP < 6) {
        a.coat = pickA(PARKA);
        a.shirt = a.coat;
        a.hat = pickA(HATS);
      }
      agents.push(a);
      S.ag.push(a);
    }
  }
}
