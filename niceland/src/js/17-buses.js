/**
 * Buses
 *
 * Strætó routes and stops from OSM, timetables and buses on their routes.
 *
 * Functions: fetchBus, busClass, headway, busDeps, initBus, busPath, busSpawn, busNextStop, busAtStop
 * State and constants: BUSR, BUSLIVE, busT, BUSSTOPS, BUS_A, BUS_B, BUS_PEAK10, BUS_V
 */

// Frequencies follow Strætó's service from 17 Aug 2025: routes 3, 5, 6, 12 every 10 min at peak and 15 min between peaks (weekdays);
// 19, 21, 24 every 15 min at peak; 22 and 23 every 30 min. Other values (weekends, evenings, first buses) are estimates.
let BUSR = [],
  BUSLIVE = new Map(),
  busT = 0,
  BUSSTOPS = [];
async function fetchBus() {
  try {
    const r = await fetch('bus.txt');
    if (!r.ok) return null;
    const b = atob((await r.text()).trim());
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return JSON.parse(
      await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    );
  } catch (e) {
    console.warn('bus', e);
    return null;
  }
}
const BUS_A = new Set(['1', '2', '3', '4', '5', '6', '12', '15']),
  BUS_B = new Set(['7', '11', '13', '14', '17', '18', '19', '21', '24', '28', '35', '36']),
  BUS_PEAK10 = new Set(['3', '5', '6', '12']);
function busClass(r) {
  const n = parseInt(r.ref);
  const cap = /Strætó bs|Höfuðborg/.test(r.op) && n > 0 && n < 50;
  if (!cap) return /Akureyr|SVA/.test(r.op) ? 'aku' : 'reg';
  return BUS_A.has(r.ref) ? 'A' : BUS_B.has(r.ref) || BUS_B.has(String(n)) ? 'B' : 'C';
}
// minutes between buses at hour h (decimal) on day-of-week d (0 Sun..6 Sat); 0 = not running
function headway(r, h, d) {
  const c = r.cls,
    we = d === 0 || d === 6;
  if (c === 'reg') {
    if (h < 7 || h >= 21) return 0;
    return 120;
  }
  if (c === 'aku') {
    if (h < 6.5 || h >= 23) return 0;
    return we ? 60 : 30;
  }
  const start = d === 0 ? 9.5 : d === 6 ? 7.5 : 6.5;
  if (h < start || h >= 24) return 0;
  if (we) return c === 'C' ? 60 : 30;
  const peak = (h >= 7 && h < 9) || (h >= 15 && h < 18);
  if (h >= 19) return 30;
  if (c === 'A') return peak ? (BUS_PEAK10.has(r.ref) ? 10 : 10) : 15;
  if (c === 'B') return peak ? 15 : 30;
  return 30;
}
function busDeps(r, day, d) {
  if (r.depDay === day) return r.deps;
  const out = [];
  let m = 0;
  while (m < 1440) {
    const h = headway(r, m / 60, d);
    if (!h) {
      m += 5;
      continue;
    }
    out.push(m + r.off);
    m += h;
  }
  r.deps = out;
  r.depDay = day;
  return out;
}
function initBus(raw) {
  if (!raw || !GD) return;
  BUSR = [];
  const seenStop = new Map();
  for (const q of raw) {
    const [ref, name, op, frm, to, L, S] = q;
    const n = L.length / 2;
    const line = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) line[i] = L[i] * 0.5;
    let minx = 1e12,
      maxx = -1e12,
      miny = 1e12,
      maxy = -1e12,
      len = 0;
    for (let i = 0; i < n; i++) {
      const x = line[2 * i],
        y = line[2 * i + 1];
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
      if (i) len += Math.hypot(x - line[2 * i - 2], y - line[2 * i - 1]);
    }
    const r = {
      ref,
      name,
      op,
      frm,
      to,
      line,
      n,
      minx,
      maxx,
      miny,
      maxy,
      len,
      stops: S.map(s => ({ x: s[0] * 0.5, y: s[1] * 0.5, name: s[2], sh: s[3] })),
      path: null,
      id: BUSR.length
    };
    r.cls = busClass(r);
    r.off = (h32(BUSR.length, ref.length, 9) * 10) | 0;
    BUSR.push(r);
    // one shelter per stop place
    for (const s of r.stops) {
      const k = Math.round(s.x / 6) + ',' + Math.round(s.y / 6);
      if (seenStop.has(k)) continue;
      seenStop.set(k, 1);
      BUSSTOPS.push(s);
    }
  }
  // stand each stop beside the road, facing it
  let ns = 0;
  for (const s of BUSSTOPS) {
    let bd = 1e9,
      bx = 0,
      by = 0,
      ang = 0,
      hw = 4;
    eachB2(SBUCK, s.x - 30, s.y - 30, s.x + 30, s.y + 30, (w, j) => {
      const wy = WAYS[w];
      if (wy.cl > 6) return;
      const a = wy.nodes[j],
        b = wy.nodes[j + 1];
      const ax = NX[a],
        ay = NY[a],
        ex = NX[b] - ax,
        ey = NY[b] - ay,
        L2 = ex * ex + ey * ey || 1;
      let t = ((s.x - ax) * ex + (s.y - ay) * ey) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + ex * t,
        py = ay + ey * t,
        d = Math.hypot(s.x - px, s.y - py);
      if (d < bd) {
        bd = d;
        bx = px;
        by = py;
        ang = Math.atan2(ey, ex);
        hw = RWW(wy) / 2;
      }
    });
    if (bd > 40) continue;
    let nx = -Math.sin(ang),
      ny = Math.cos(ang);
    if (bd > 1 && (s.x - bx) * nx + (s.y - by) * ny < 0) {
      nx = -nx;
      ny = -ny;
    } else if (bd <= 1 && h32(s.x | 0, s.y | 0, 4) < 0.5) {
      nx = -nx;
      ny = -ny;
    }
    const x = bx + nx * (hw + 2.2),
      y = by + ny * (hw + 2.2);
    if (inBld(x, y)) continue;
    s.px = x;
    s.py = y;
    addPt(60, x, y, Math.atan2(ny, nx), s.name, { sh: s.sh || (h32(x | 0, y | 0, 5) < 0.55 ? 1 : 0) });
    ns++;
  }
  console.log('bus routes', BUSR.length, 'stops', ns);
}
// the route as a chain of road-graph nodes (worked out the first time a bus runs it)
function busPath(r) {
  if (r.path !== null) return r.path;
  const P = [];
  let last = -1,
    skip = 0;
  for (let i = 0; i < r.n; i++) {
    const nd = nearestNode(r.line[2 * i], r.line[2 * i + 1], GD, 5);
    if (nd < 0 || nd === last) continue;
    if (last >= 0) {
      let adj = false;
      for (let e = GD.off[last]; e < GD.off[last + 1]; e++)
        if (GD.to[e] === nd) {
          adj = true;
          break;
        }
      if (!adj) {
        const d = Math.hypot(NX[nd] - NX[last], NY[nd] - NY[last]);
        const fill = d < 1500 ? astar(GD, last, nd, 3000) : null;
        let fl = 0;
        if (fill)
          for (let q = 1; q < fill.length; q++)
            fl += Math.hypot(NX[fill[q]] - NX[fill[q - 1]], NY[fill[q]] - NY[fill[q - 1]]);
        if (!fill || fl > d * 1.8 + 40) {
          if (++skip < 60) continue;
        } else for (let q = 1; q < fill.length - 1; q++) P.push(fill[q]);
      }
    }
    skip = 0;
    P.push(nd);
    last = nd;
  }
  if (P.length < 3) {
    r.path = [];
    return r.path;
  }
  const cum = new Float32Array(P.length);
  for (let i = 1; i < P.length; i++)
    cum[i] = cum[i - 1] + Math.hypot(NX[P[i]] - NX[P[i - 1]], NY[P[i]] - NY[P[i - 1]]);
  // stops along the chain, in order
  const st = new Map();
  let from = 0;
  for (const s of r.stops) {
    let bi = -1,
      bd = 40;
    for (let i = from; i < P.length; i++) {
      const d = Math.hypot(NX[P[i]] - s.x, NY[P[i]] - s.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
      if (bi >= 0 && cum[i] - cum[bi] > 300) break;
    }
    if (bi >= 0) {
      st.set(bi, s);
      from = bi + 1;
    }
  }
  r.path = P;
  r.cum = cum;
  r.stopAt = st;
  r.plen = cum[P.length - 1];
  return P;
}
const BUS_V = 330; // metres per minute along the route, stops included (about 20 km/h)
function busSpawn(vr) {
  if (!BUSR.length || time < busT) return;
  busT = time + 0.6;
  for (const [k, a] of BUSLIVE) if (a.dead) BUSLIVE.delete(k);
  if (K < 0.27) return;
  const day = Math.floor(gameMin / 1440),
    d = dayOfWeek(),
    now = gameMin % 1440,
    pad = 140;
  let made = 0;
  for (const r of BUSR) {
    if (r.maxx < vr[0] - pad || r.minx > vr[2] + pad || r.maxy < vr[1] - pad || r.miny > vr[3] + pad)
      continue;
    const deps = busDeps(r, day, d);
    const dur = r.len / BUS_V;
    for (const dep of deps) {
      if (dep > now || now - dep > dur) continue;
      const key = r.id + ':' + day + ':' + dep;
      if (BUSLIVE.has(key)) continue;
      const P = busPath(r);
      if (!P.length) break;
      const s = Math.min(r.plen - 1, (now - dep) * BUS_V * (r.plen / r.len));
      let lo = 0,
        hi = P.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (r.cum[m] <= s) lo = m;
        else hi = m - 1;
      }
      if (lo >= P.length - 1) continue;
      const t = (s - r.cum[lo]) / (r.cum[lo + 1] - r.cum[lo] || 1);
      const x = NX[P[lo]] + (NX[P[lo + 1]] - NX[P[lo]]) * t,
        y = NY[P[lo]] + (NY[P[lo + 1]] - NY[P[lo]]) * t;
      if (x < vr[0] - pad || x > vr[2] + pad || y < vr[1] - pad || y > vr[3] + pad) continue;
      if (onScr(x, y, 60)) continue;
      if (PBLK && (PBLK[P[lo]] || PBLK[P[lo + 1]])) continue;
      const gap = Math.max(600, headway(r, now / 60, d) * BUS_V * (r.plen / r.len) * 0.6);
      let near = false;
      for (const o of BUSLIVE.values())
        if (o.route === r && !o.dead && Math.abs(r.cum[Math.min(o.pi, P.length - 1)] - s) < gap) {
          near = true;
          break;
        }
      if (near) continue;
      const a = mkAgent('bus', x, y);
      a.path = P;
      a.pi = lo;
      a.t = t;
      a.route = r;
      a.dep = dep;
      a.act = 'Leið ' + r.ref;
      a.vname = 'Strætó · Leið ' + r.ref;
      const L = Math.hypot(NX[P[lo + 1]] - NX[P[lo]], NY[P[lo + 1]] - NY[P[lo]]) || 1;
      a.vx = (NX[P[lo + 1]] - NX[P[lo]]) / L;
      a.vy = (NY[P[lo + 1]] - NY[P[lo]]) / L;
      agents.push(a);
      BUSLIVE.set(key, a);
      if (++made >= 4) return;
    }
  }
}
function busNextStop(a) {
  const r = a.route;
  if (!r || !r.stopAt) return null;
  const pi = a.pi + (a.poff || 0);
  let best = null,
    bi = 1e9;
  for (const [i, s] of r.stopAt)
    if (i > pi && i < bi) {
      bi = i;
      best = s;
    }
  return best;
}
function busAtStop(a) {
  const s = a.route && a.route.stopAt && a.route.stopAt.get(a.pi + (a.poff || 0));
  if (!s) return false;
  const busy = trafficFactor();
  a.wait = 4 + R() * 6 * busy;
  a.act = 'At ' + (s.name || 'the stop');
  a.lastStop = s.name;
  const off = Math.round(R() * 3 * busy),
    on = Math.round(R() * 3 * busy);
  a.nPax = Math.max(0, (a.nPax || Math.round(5 + busy * 25)) + on - off);
  for (let q = 0; q < off; q++) {
    const p = mkAgent('walk', a.x, a.y);
    const t = nearestNode(a.x + (R() - 0.5) * 500, a.y + (R() - 0.5) * 500, GW, 200),
      s0 = nearestNode(a.x, a.y, GW, 60);
    const pth = astar(GW, s0, t, 4000);
    if (pth && pth.length > 1) {
      p.path = pth;
      p.act = 'Got off the ' + a.route.ref;
      p.job = pickA(JOBS[4]);
      p.homeAddr = district(a.x, a.y);
      setPos(p);
      agents.push(p);
    }
  }
  return true;
}
