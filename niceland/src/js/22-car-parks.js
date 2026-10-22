/**
 * Car parks
 *
 * Parking stalls along the kerbs, how full each car park is through the day, and cars and drivers coming
 * and going.
 *
 * Functions: parkRows, nearWay, stallsFor, lotStalls, pwl, lotKind, lotTarget, lotInit, dirtyProps,
 *     lotEnt, lotRoute, lotPed, bldDoor, lotDepart, lotCar, lotCarOut, lotArrive, lotCarIn, lotDone,
 *     lotFinish, stepWp, stepLots
 * State and constants: LOTT, lotAcc, LOTSTAT, OCC, LOTKN
 */

/* car parks: rows of 2.6 m stalls, 5 m deep, back to back with a 6.5 m aisle between each pair, laid along the lot's own kerbs.
   Long lots keep a 5 m drive lane across each end so cars can reach the aisles without crossing parked cars. */
function parkRows(A, o) {
  if (A.rows && o === undefined) return A.rows;
  const W = A.W,
    vs = [],
    va = [],
    lamps = [];
  o = o || 0;
  if (W >= 15) {
    const n = Math.max(1, Math.floor((W + 1.5) / 16.5)),
      st = A.v0 + (W - n * 16.5) / 2 + o;
    for (let i = o ? -1 : 0; i < n; i++) {
      const ac = st + i * 16.5 + 8.25;
      vs.push(ac - 5.75, ac + 5.75);
      va.push(ac, ac);
      if (i < n - 1) lamps.push(st + (i + 1) * 16.5);
    }
  } else if (W >= 8.5) {
    vs.push(A.v0 + 2.5);
    va.push(A.v0 + 8.25);
  } else {
    const m = A.v0 + W / 2;
    vs.push(m);
    va.push(m + W / 2 + 3.5);
  }
  return { vs, va, lamps, end: A.L > 34 ? 5 : 1 };
}
function nearWay(x, y, pad) {
  let hit = false;
  eachB2(SBUCK, x - 14, y - 14, x + 14, y + 14, (w, j) => {
    if (hit) return;
    const wy = WAYS[w];
    if (wy.cl > 9) return;
    const n0 = wy.nodes[j],
      n1 = wy.nodes[j + 1];
    if (segD(x, y, NX[n0], NY[n0], NX[n1], NY[n1]) < RWW(wy) / 2 + pad) hit = true;
  });
  return hit;
}
function stallsFor(A, R_, every) {
  const out = [],
    e = R_.end,
    ns = Math.max(0, Math.floor((A.L - 2 * e) / 2.6)),
    off = (A.L - 2 * e - ns * 2.6) / 2;
  for (let r = 0; r < R_.vs.length; r++) {
    const v = R_.vs[r],
      va = R_.va[r];
    for (let q = 0; q < ns; q += every) {
      const u = A.u0 + e + (q + 0.5) * 2.6 + off;
      const [x, y] = AU(A, u, v);
      if (!pip(A.poly, x, y)) continue;
      const [xa, ya] = AU(A, u, v - 2.2),
        [xb, yb] = AU(A, u, v + 2.2);
      if (!pip(A.poly, xa, ya) || !pip(A.poly, xb, yb)) continue;
      if (nearWay(x, y, 2.2)) continue; // keep the real drive aisles and footpaths clear
      if (every > 1) {
        out.push(1);
        continue;
      }
      if (inBld(x, y) || inBld(xa, ya) || inBld(xb, yb)) continue;
      const sd = h32(A.id + r, q, 78);
      out.push({
        x,
        y,
        u,
        v,
        va,
        ang: Math.atan2(A.uy, A.ux) + Math.PI / 2 + (sd < 0.5 ? Math.PI : 0),
        nose: sd < 0.5 ? 1 : -1,
        sd,
        h: h32(A.id * 31 + r, q, 77)
      });
    }
  }
  return out;
}
// slide the row pattern across the lot until it lines up best with the real aisles mapped in OpenStreetMap
function lotStalls(A) {
  if (A.stalls) return A.stalls;
  let bo = 0;
  if (A.W >= 15) {
    let best = -1;
    for (let o = 0; o < 16.5; o += 1.5) {
      const c = stallsFor(A, parkRows(A, o), 3).length + (o === 0 ? 0.5 : 0);
      if (c > best) {
        best = c;
        bo = o;
      }
    }
  }
  A.rows = parkRows(A, bo);
  return (A.stalls = stallsFor(A, A.rows, 1));
}
/* car-park life: each stall is empty or holds a car; how full a lot is follows the hour, the day and what the lot serves
   (homes stay full at night, offices and shops empty out). On screen the change is played out: a driver walks out of a
   building to a parked car and drives it away, or a car comes in off the street, parks, and the driver walks off.
   Only the few cars that are moving are live; everything parked stays baked in the props layer. */
let LOTT = [],
  lotAcc = 0;
const LOTSTAT = {};
function pwl(h, P) {
  for (let i = 0; i < P.length - 1; i++) {
    const [a, x] = P[i],
      [b, y] = P[i + 1];
    if (h >= a && h <= b) return x + ((y - x) * (h - a)) / (b - a || 1);
  }
  return P[P.length - 1][1];
}
const OCC = {
  home: [
    [0, 0.9],
    [6.5, 0.9],
    [8.5, 0.55],
    [16, 0.5],
    [18.5, 0.85],
    [24, 0.9]
  ],
  homeWE: [
    [0, 0.9],
    [10, 0.85],
    [13, 0.65],
    [18, 0.75],
    [21, 0.88],
    [24, 0.9]
  ],
  work: [
    [0, 0.05],
    [6.5, 0.08],
    [8.5, 0.88],
    [15.5, 0.86],
    [17.5, 0.3],
    [19, 0.12],
    [22, 0.06],
    [24, 0.05]
  ],
  workWE: [
    [0, 0.04],
    [9, 0.06],
    [12, 0.18],
    [16, 0.14],
    [20, 0.05],
    [24, 0.04]
  ],
  shop: [
    [0, 0.03],
    [8, 0.05],
    [10, 0.35],
    [12, 0.65],
    [17, 0.75],
    [18.5, 0.6],
    [20, 0.3],
    [22, 0.08],
    [24, 0.03]
  ],
  shopWE: [
    [0, 0.03],
    [10, 0.1],
    [12, 0.6],
    [15, 0.85],
    [18, 0.55],
    [20, 0.15],
    [22, 0.05],
    [24, 0.03]
  ],
  care: [
    [0, 0.32],
    [7, 0.4],
    [9, 0.85],
    [16, 0.8],
    [19, 0.5],
    [24, 0.32]
  ],
  careWE: [
    [0, 0.3],
    [10, 0.5],
    [16, 0.5],
    [20, 0.4],
    [24, 0.3]
  ]
};
const LOTKN = {
  home: 'Residents’ parking',
  work: 'Workplace parking',
  shop: 'Shoppers’ parking',
  care: 'Hospital and clinic parking',
  mixed: 'Mixed-use parking'
};
function lotKind(A) {
  if (A.lk) return A.lk;
  let res = 0,
    com = 0,
    shop = 0,
    care = 0;
  const r = Math.max(60, Math.min(170, Math.max(A.L, A.W) * 0.7 + 50));
  nearB(A.cx, A.cy, r, b => {
    if (b.state >= 9 || Math.hypot(b.cx - A.cx, b.cy - A.cy) > r + b.r) return;
    const w = b.area * Math.max(1, (b.h || 4) / 6);
    if (b.kind <= 2) {
      res += w;
      return;
    }
    com += w;
    const u = b.use || '';
    if (b.kind === 4 || /shop|mall|supermarket|retail/.test(u)) shop += w;
    if (/hospital|clinic/.test(u)) care += w;
  });
  return (A.lk =
    care > com * 0.35 && care > 0
      ? 'care'
      : res > com * 1.3
        ? 'home'
        : shop > com * 0.45
          ? 'shop'
          : com > res * 1.3
            ? 'work'
            : 'mixed');
}
function lotTarget(A) {
  const h = (((gameMin % 1440) + 1440) % 1440) / 60,
    we = isWeekend() ? 'WE' : '',
    k = lotKind(A);
  if (k === 'mixed')
    return (pwl(h, OCC['home' + we]) + pwl(h, OCC['shop' + we]) + pwl(h, OCC['work' + we])) / 3;
  return pwl(h, OCC[k + we]);
}
function lotInit(A) {
  const S = lotStalls(A),
    t = lotTarget(A);
  A.st = new Uint8Array(S.length);
  for (let i = 0; i < S.length; i++) A.st[i] = S[i].h < t ? 1 : 0;
  A.simM = gameMin;
}
function dirtyProps(x, y, now) {
  for (let L = 0; L < LEVELS.length; L++) {
    const k = LEVELS[L];
    if (k < 0.4) continue;
    const S = CCF(k) * 10,
      cx = Math.floor((x - GOX) / S),
      cy = Math.floor((y - GOY) / S),
      base = ckey(L, 5, cx, cy) - ROT * RS;
    for (let r = 0; r < 8; r++) {
      const kk = base + r * RS,
        e = CACHE.get(kk);
      if (!e) continue;
      if (L === li && r === ROT) {
        if (now) {
          const nv = renderProps(L, cx, cy);
          CACHE.delete(kk);
          cachePx -= e.px;
          putChunk(L, 5, cx, cy, nv);
        } else e.stale = 1;
      } else {
        CACHE.delete(kk);
        cachePx -= e.px;
      }
    }
  }
}
function lotEnt(A) {
  if (A.entN === undefined) A.entN = nearestNode(A.cx, A.cy, GD, Math.max(A.L, A.W) / 2 + 80);
  return A.entN;
}
// a drive from a stall to (x,y): out to the aisle, along it to the end lane, along that, then off to the street
function lotRoute(A, s, x, y) {
  const R_ = parkRows(A),
    du = (x - A.cx) * A.ux + (y - A.cy) * A.uy,
    dv = -(x - A.cx) * A.uy + (y - A.cy) * A.ux,
    e = R_.end;
  const out = [AU(A, s.u, s.va)];
  if (e >= 5) {
    const ue = du < A.mu ? A.u0 + 2.5 : A.u1 - 2.5;
    out.push(AU(A, ue, s.va));
    const vv = Math.max(A.v0 + 2, Math.min(A.v1 - 2, dv));
    if (Math.abs(vv - s.va) > 2) out.push(AU(A, ue, vv));
  } else out.push(AU(A, Math.max(A.u0 + 1, Math.min(A.u1 - 1, du)), s.va));
  out.push([x, y]);
  return out;
}
function lotPed(x, y) {
  const p = mkAgent('walk', x, y);
  p.job = pickA(JOBS[4]);
  p.homeAddr = district(x, y);
  if (SEAS === 'winter' || TEMP < 5) {
    p.coat = pickA(PARKA);
    p.shirt = p.coat;
    p.hat = pickA(HATS);
  }
  return p;
}
function bldDoor(b, x, y) {
  let dx = x - b.cx,
    dy = y - b.cy;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  let sx = b.cx,
    sy = b.cy;
  for (let q = 0; q < 160 && pip(b.poly, sx, sy); q++) {
    sx += dx * 0.5;
    sy += dy * 0.5;
  }
  return [sx + dx * 0.6, sy + dy * 0.6];
}
function lotDepart(A) {
  const S = A.stalls,
    n = S.length;
  let i = -1;
  for (let q = 0; q < 12; q++) {
    const j = (R() * n) | 0;
    if (A.st[j] === 1 && onScr(S[j].x, S[j].y, 10)) {
      i = j;
      break;
    }
  }
  if (i < 0 || lotEnt(A) < 0) return false;
  const s = S[i],
    b = nearBld(s.x, s.y, 140, b => b.state === 0 && b.kind !== 3);
  let sx, sy;
  if (b) [sx, sy] = bldDoor(b, s.x, s.y);
  else {
    const g = nearestNode(s.x, s.y, GW, 140);
    if (g < 0) return false;
    sx = NX[g];
    sy = NY[g];
  }
  const p = lotPed(sx, sy);
  p.keep = 1;
  p.act = 'Walking back to the car';
  const sg = s.nose * (s.va > s.v ? 1 : -1); // driver's door is on the left of the car
  p.wp = [[s.x + A.ux * 1.5 * sg, s.y + A.uy * 1.5 * sg]];
  p.wpi = 0;
  agents.push(p);
  A.st[i] = 2;
  A.live = (A.live || 0) + 1;
  const T = { A, i, kind: 'out', ag: p };
  LOTT.push(T);
  p.wpDone = () => lotCarOut(T);
  return true;
}
function lotCar(s, x, y) {
  const c = mkAgent('car', x, y);
  setVT(c, 'car');
  c.c = CARC[(s.sd * CARC.length) | 0];
  c.len = 4.3;
  c.keep = 1;
  return c;
}
function lotCarOut(T) {
  const { A, i } = T,
    s = A.stalls[i],
    p = T.ag;
  p.dead = true;
  A.st[i] = 0;
  dirtyProps(s.x, s.y, true);
  const c = lotCar(s, s.x, s.y);
  c.drv = p.name;
  c.act = 'Leaving the car park';
  c.hd = s.ang;
  c.vx = Math.cos(s.ang);
  c.vy = Math.sin(s.ang);
  const ent = lotEnt(A),
    ex = NX[ent],
    ey = NY[ent],
    rt = lotRoute(A, s, ex, ey),
    fwd = s.nose === (s.va > s.v ? 1 : -1);
  c.wp = rt;
  c.wpRev = rt.map((_, q) => q === 0 && !fwd);
  c.wpi = 0;
  agents.push(c);
  T.ag = c;
  c.wpDone = () => {
    lotDone(T);
    const t = nearestNode(ex + (R() - 0.5) * 1800, ey + (R() - 0.5) * 1800, GD, 400);
    const pth = t >= 0 && t !== ent ? astar(GD, ent, t, 16000) : null;
    if (!pth || pth.length < 2) {
      c.dead = true;
      return;
    }
    c.path = pth;
    c.pi = 0;
    c.t = 0;
    c.keep = 0;
    c.act = '';
  };
}
function lotArrive(A) {
  const S = A.stalls,
    n = S.length;
  let i = -1;
  for (let q = 0; q < 12; q++) {
    const j = (R() * n) | 0;
    if (A.st[j] === 0 && onScr(S[j].x, S[j].y, 10)) {
      i = j;
      break;
    }
  }
  if (i < 0) return false;
  const ent = lotEnt(A);
  if (ent < 0) return false;
  let st = -1;
  for (let q = 0; q < 6 && st < 0; q++) {
    const an = R() * 6.283,
      d = 140 + R() * 200,
      m = nearestNode(NX[ent] + Math.cos(an) * d, NY[ent] + Math.sin(an) * d, GD, 200);
    if (m >= 0 && m !== ent && !onScr(NX[m], NY[m], 40) && !(PBLK && PBLK[m])) st = m;
  }
  if (st < 0) return false;
  const pth = astar(GD, st, ent, 12000);
  if (!pth || pth.length < 2) return false;
  const s = S[i],
    c = lotCar(s, NX[st], NY[st]);
  c.path = pth;
  c.pi = 0;
  c.t = 0;
  c.act = 'Looking for a parking space';
  setPos(c);
  agents.push(c);
  A.st[i] = 3;
  A.live = (A.live || 0) + 1;
  const T = { A, i, kind: 'in', ag: c };
  LOTT.push(T);
  c.toStall = T;
  return true;
}
function lotCarIn(c) {
  const T = c.toStall;
  c.toStall = null;
  const { A, i } = T,
    s = A.stalls[i];
  const rt = lotRoute(A, s, c.x, c.y).reverse();
  rt.shift();
  rt.push([s.x, s.y]);
  const fwdIn = s.nose !== (s.va > s.v ? 1 : -1);
  c.path = null;
  c.wp = rt;
  c.wpRev = rt.map((_, q) => q === rt.length - 1 && !fwdIn);
  c.wpi = 0;
  c.act = 'Parking';
  c.wpDone = () => {
    c.wp = [[s.x, s.y]];
    c.wpi = 0;
    c.hdT = s.ang;
    c.ghost = 0.35;
    A.st[i] = 1;
    dirtyProps(s.x, s.y, true);
    lotDone(T);
    c.dead = true;
    const sg = s.nose * (s.va > s.v ? 1 : -1),
      px = s.x + A.ux * 1.5 * sg,
      py = s.y + A.uy * 1.5 * sg,
      p = lotPed(px, py);
    p.act = pickA(['Off to work', 'Popping into the shop', 'Home again', 'Running errands']);
    const b = nearBld(s.x, s.y, 140, b => b.state === 0 && b.kind !== 3);
    if (b) {
      p.wp = [bldDoor(b, s.x, s.y)];
      p.wpDone = () => {
        p.dead = true;
      };
    } else {
      const g = nearestNode(s.x, s.y, GW, 140);
      if (g < 0) return;
      p.wp = [[NX[g], NY[g]]];
      p.wpDone = () => {
        const t = nearestNode(NX[g] + (R() - 0.5) * 500, NY[g] + (R() - 0.5) * 500, GW, 200),
          pth = t >= 0 ? astar(GW, g, t, 4000) : null;
        if (pth && pth.length > 1) {
          p.path = pth;
          p.pi = 0;
          p.t = 0;
        } else p.dead = true;
      };
    }
    p.wpi = 0;
    agents.push(p);
  };
}
function lotDone(T) {
  if (T.done) return;
  T.done = 1;
  LOTSTAT[T.kind] = (LOTSTAT[T.kind] || 0) + 1;
  T.A.live = Math.max(0, (T.A.live || 0) - 1);
}
function lotFinish(T, far) {
  if (T.done) return;
  const { A, i } = T,
    s = A.stalls[i],
    a = T.ag;
  if (T.kind === 'out') {
    if (A.st[i] === 2) A.st[i] = far ? 0 : 1;
  } else if (A.st[i] === 3) A.st[i] = far ? 1 : 0;
  if (a && !a.dead && far) {
    if (a !== follow && a !== selected) a.dead = true;
    else {
      a.wp = null;
      a.toStall = null;
      a.keep = 0;
    }
  }
  dirtyProps(s.x, s.y, false);
  lotDone(T);
}
function stepWp(a, dt) {
  const w = a.wp[a.wpi],
    dx = w[0] - a.x,
    dy = w[1] - a.y,
    d = Math.hypot(dx, dy);
  if (a.car) {
    const rev = a.wpRev && a.wpRev[a.wpi];
    const th = d > 0.05 ? Math.atan2(dy, dx) + (rev ? Math.PI : 0) : a.hd || 0;
    if (a.hd === undefined) a.hd = th;
    const df = ((((th - a.hd) % 6.2832) + 9.4248) % 6.2832) - 3.1416;
    a.hd += Math.max(-dt * 1.6, Math.min(dt * 1.6, df));
    a.vx = Math.cos(a.hd);
    a.vy = Math.sin(a.hd);
    const sp = (rev ? 2.2 : 6) * Math.max(0.2, Math.cos(Math.min(1.5708, Math.abs(df)))) * wxDrive() * dt;
    if (d <= sp) {
      a.x = w[0];
      a.y = w[1];
      a.wpi++;
    } else {
      a.x += (dx / d) * sp;
      a.y += (dy / d) * sp;
    }
  } else {
    const sp = a.sp * 1.8 * dt;
    a.phase += dt * a.sp * 5;
    if (d > 0.01) {
      a.vx = dx / d;
      a.vy = dy / d;
    }
    if (d <= sp) {
      a.x = w[0];
      a.y = w[1];
      a.wpi++;
    } else {
      a.x += (dx / d) * sp;
      a.y += (dy / d) * sp;
    }
  }
  if (a.wpi >= a.wp.length) {
    a.wp = null;
    const f = a.wpDone;
    a.wpDone = null;
    if (f) f(a);
  }
}
function stepLots(dt) {
  if (!PROPS_OK) return;
  if (LOTT.length) {
    const vr = viewRect(320);
    for (const T of LOTT) {
      if (T.done) continue;
      const A = T.A,
        far = K < 0.6 || A.maxx < vr[0] || A.minx > vr[2] || A.maxy < vr[1] || A.miny > vr[3];
      if (far || (T.ag && T.ag.dead)) lotFinish(T, far);
    }
    LOTT = LOTT.filter(T => !T.done);
  }
  lotAcc += dt;
  if (lotAcc < 1 || K < 0.4) return;
  lotAcc = 0;
  const vr = viewRect(30);
  let live = LOTT.length;
  areasIn(vr[0], vr[1], vr[2], vr[3], A => {
    if (A.c !== AK.PARKING || !A.stalls || !A.st) return;
    const S = A.stalls,
      n = S.length;
    if (!n) return;
    const gap = gameMin - A.simM;
    A.simM = gameMin;
    const t = lotTarget(A);
    if (gap > 30 || gap < 0) {
      for (let i = 0; i < n; i++) {
        const o = A.st[i];
        if (o > 1) continue;
        const w = S[i].h < t ? 1 : 0;
        if (w !== o) {
          A.st[i] = w;
          dirtyProps(S[i].x, S[i].y, false);
        }
      }
      return;
    }
    let cur = 0;
    for (let i = 0; i < n; i++) {
      const o = A.st[i];
      if (o === 1 || o === 3) cur++;
    }
    let diff = cur - Math.round(t * n);
    if (!diff) return;
    if (K >= 0.6 && speed > 0) {
      const cap = Math.min(6, 1 + Math.floor(n / 20));
      let al = A.live || 0;
      for (let q = 0; q < 3 && diff && al < cap && live < 22; q++) {
        if (R() > 0.55) continue;
        if (!(diff > 0 ? lotDepart(A) : lotArrive(A))) break;
        al++;
        live++;
        diff += diff > 0 ? -1 : 1;
      }
    }
    // the clock runs fast, so the rest catch up quietly, off screen first
    const slack = K >= 0.6 ? Math.max(1, Math.round(n * 0.1)) : 0;
    if (Math.abs(diff) <= slack) return;
    let need = Math.abs(diff) - slack;
    const cand = [];
    for (let i = 0; i < n; i++) {
      const o = A.st[i];
      if (diff > 0 ? o === 1 : o === 0) cand.push(i);
    }
    cand.sort((a, b) => (diff > 0 ? S[b].h - S[a].h : S[a].h - S[b].h));
    const off = cand.filter(i => !onScr(S[i].x, S[i].y, 20)),
      on = K < 0.6 || Math.abs(diff) > n * 0.2 ? cand.filter(i => onScr(S[i].x, S[i].y, 20)) : [];
    for (const i of off.concat(on)) {
      if (need <= 0) break;
      A.st[i] = diff > 0 ? 0 : 1;
      dirtyProps(S[i].x, S[i].y, false);
      need--;
    }
  });
}
