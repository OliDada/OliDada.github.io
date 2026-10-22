/**
 * Aircraft
 *
 * Airports from OSM runways, parked planes, take-offs, landings and the Reykjavík timetable.
 *
 * Functions: initAir, rkvDay, stepPlanes, planeAll, drawPlane, planeCard
 * State and constants: AIRPORTS, PLANES, PTYPE, LIVERY, AIRL, DESTS, RKV_ROUTES
 */

let AIRPORTS = [],
  PLANES = [];
const PTYPE = {
  jet: { L: 47, span: 38, r: 2, gear: 2, fin: 11, sp: 72, vr: 74, acc: 2, low: 1, name: 'Narrow-body jet' },
  wide: {
    L: 61,
    span: 52,
    r: 2.8,
    gear: 2.6,
    fin: 15,
    sp: 75,
    vr: 78,
    acc: 1.8,
    low: 1,
    name: 'Wide-body jet'
  },
  tp: {
    L: 33,
    span: 28,
    r: 1.4,
    gear: 1.4,
    fin: 7.5,
    sp: 55,
    vr: 55,
    acc: 2,
    low: 0,
    ttail: 1,
    props: 2,
    name: 'Turboprop'
  },
  light: {
    L: 8,
    span: 11,
    r: 0.6,
    gear: 0.7,
    fin: 2,
    sp: 32,
    vr: 28,
    acc: 2.5,
    low: 0,
    props: 1,
    name: 'Light aircraft'
  },
  q400: {
    L: 32.8,
    span: 28.4,
    r: 1.35,
    gear: 1.4,
    fin: 8.3,
    sp: 55,
    vr: 52,
    acc: 2,
    low: 0,
    ttail: 1,
    props: 2,
    name: 'De Havilland Dash 8-400'
  },
  dhc6: {
    L: 15.8,
    span: 19.8,
    r: 0.9,
    gear: 0.9,
    fin: 5.9,
    sp: 40,
    vr: 36,
    acc: 2.3,
    low: 0,
    props: 2,
    name: 'De Havilland Twin Otter'
  }
};
const LIVERY = [
  [24, 64, 140],
  [200, 40, 40],
  [240, 180, 30],
  [30, 30, 34],
  [0, 120, 110],
  [90, 40, 120],
  [230, 110, 30]
];
/* real colours: Icelandair — white with big midnight-blue titles, midnight-blue tail with a white flag mark, blue engines (2022 livery);
   Air Greenland — bright red all over with the white "Red Lady" circle on the tail. Norlandair: not verified, so kept plain white. */
const AIRL = {
  'Icelandair': {
    body: [240, 242, 244],
    belly: [214, 218, 224],
    tail: [22, 36, 74],
    mark: [244, 244, 244],
    title: [22, 36, 74],
    eng: [22, 36, 74],
    noStripe: 1
  },
  'Air Greenland': {
    body: [206, 32, 46],
    belly: [176, 26, 38],
    tail: [206, 32, 46],
    mark: [245, 245, 245],
    title: [245, 245, 245],
    noStripe: 1
  },
  'Norlandair': { body: [240, 242, 244], belly: [200, 204, 210], tail: [240, 242, 244], noStripe: 1 }
};
const DESTS = {
  intl: [
    'Copenhagen',
    'London',
    'Boston',
    'Oslo',
    'Paris',
    'New York',
    'Amsterdam',
    'Stockholm',
    'Berlin',
    'Toronto',
    'Dublin',
    'Helsinki',
    'Frankfurt',
    'Seattle',
    'Tenerife'
  ],
  dom: [
    'Akureyri',
    'Egilsstaðir',
    'Ísafjörður',
    'Vestmannaeyjar',
    'Nuuk',
    'Höfn',
    'Húsavík',
    'Þórshöfn',
    'Vopnafjörður',
    'Bíldudalur',
    'Grímsey'
  ]
};
function initAir(d) {
  if (!d.rw) return;
  const rws = d.rw
    .map(r => {
      const [x1, y1, x2, y2, w, paved] = r;
      const L = Math.hypot(x2 - x1, y2 - y1);
      return {
        x1,
        y1,
        x2,
        y2,
        L,
        ux: (x2 - x1) / L,
        uy: (y2 - y1) / L,
        w: w || (L > 2500 ? 60 : L > 1400 ? 45 : 30),
        paved,
        cx: (x1 + x2) / 2,
        cy: (y1 + y2) / 2
      };
    })
    .filter(r => r.L > 300);
  for (const r of rws) {
    let ap = AIRPORTS.find(a => Math.hypot(a.cx - r.cx, a.cy - r.cy) < 3500);
    if (!ap) {
      ap = { cx: r.cx, cy: r.cy, rws: [], aprons: [], next: 5 + R() * 30, stands: [] };
      AIRPORTS.push(ap);
    }
    ap.rws.push(r);
  }
  for (const ap of AIRPORTS) {
    const mx = Math.max(...ap.rws.map(r => (r.paved ? r.L : r.L * 0.5)));
    ap.cls = mx > 2800 ? 'intl' : ap.rws.some(r => r.paved && r.L > 1100) ? 'dom' : 'strip';
    ap.name = placeName(ap.cx, ap.cy);
    const R0 = LL(64.13, -21.9406);
    if (Math.hypot(ap.cx - R0[0], ap.cy - R0[1]) < 2500) {
      ap.rkv = 1;
      ap.name = 'Reykjavíkurflugvöllur';
    }
  }
  for (const fl of d.ap || []) {
    const n = fl.length / 2;
    if (n < 3) continue;
    let cx = 0,
      cy = 0;
    for (let i = 0; i < n; i++) {
      cx += fl[2 * i];
      cy += fl[2 * i + 1];
    }
    cx /= n;
    cy /= n;
    const ap = AIRPORTS.find(a => Math.hypot(a.cx - cx, a.cy - cy) < 4000);
    if (!ap) continue;
    const poly = new Float32Array(fl);
    let sxx = 0,
      syy = 0,
      sxy = 0;
    for (let i = 0; i < n; i++) {
      const dx = fl[2 * i] - cx,
        dy = fl[2 * i + 1] - cy;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy),
      ux = Math.cos(ang),
      uy = Math.sin(ang);
    let u0 = 1e9,
      u1 = -1e9,
      v0 = 1e9,
      v1 = -1e9;
    for (let i = 0; i < n; i++) {
      const dx = fl[2 * i] - cx,
        dy = fl[2 * i + 1] - cy,
        u = dx * ux + dy * uy,
        v = -dx * uy + dy * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    ap.aprons.push({ poly, cx, cy, ux, uy, u0, u1, v0, v1 });
  }
  for (const ap of AIRPORTS)
    for (const A of ap.aprons) {
      const types =
        ap.cls === 'intl'
          ? ['jet', 'jet', 'jet', 'wide', 'tp']
          : ap.cls === 'dom'
            ? ['tp', 'tp', 'light', 'tp']
            : ['light'];
      let u = A.u0 + 6;
      let i = 0;
      while (u < A.u1 - 6 && ap.stands.length < 40) {
        const t = types[(h32(i, A.cx | 0, 3) * types.length) | 0],
          T = PTYPE[t];
        const uc = u + T.span / 2;
        if (uc + T.span / 2 > A.u1) break;
        const vmid = (A.v0 + A.v1) / 2;
        const x = A.cx + uc * A.ux - vmid * A.uy,
          y = A.cy + uc * A.uy + vmid * A.ux;
        if (pip(A.poly, x, y) && h32(i, A.cy | 0, 4) < 0.72)
          ap.stands.push({
            x,
            y,
            hd: Math.atan2(A.ux, -A.uy) + (h32(i, 1, 5) < 0.5 ? Math.PI : 0),
            t,
            liv: LIVERY[(h32(i, A.cx | 0, 6) * LIVERY.length) | 0],
            parked: 1,
            alt: 0,
            plane: 1,
            name: 'Parked aircraft',
            dest: pickA(DESTS[ap.cls === 'intl' ? 'intl' : 'dom'])
          });
        u += T.span + 8;
        i++;
      }
    }
}
/* Reykjavík domestic airport: Icelandair to Akureyri, Egilsstaðir, Ísafjörður and Höfn; Norlandair to Bíldudalur and Gjögur;
   Air Greenland to Nuuk and Kulusuk. Routes as published for 2025–26; times of day are spread out, not the real timetable. */
const RKV_ROUTES = [
  ['Icelandair', 'Akureyri', 'q400', 7],
  ['Icelandair', 'Egilsstaðir', 'q400', 4],
  ['Icelandair', 'Ísafjörður', 'q400', 2],
  ['Icelandair', 'Höfn', 'q400', 5 / 7],
  ['Norlandair', 'Bíldudalur', 'dhc6', 1],
  ['Norlandair', 'Gjögur', 'dhc6', 2 / 7],
  ['Air Greenland', 'Nuuk', 'q400', 0.8],
  ['Air Greenland', 'Kulusuk', 'q400', 0.5, 'summer']
];
function rkvDay(day) {
  const ev = [];
  RKV_ROUTES.forEach(([al, dest, t, n, seas], ri) => {
    if (seas && SEAS !== seas) return;
    const whole = Math.floor(n),
      extra = h32(day, ri, 41) < n - whole ? 1 : 0,
      m = whole + extra;
    for (let i = 0; i < m; i++) {
      const dep = (7.2 + (i + 0.5) * (14.5 / Math.max(1, m)) + (h32(day, ri * 7 + i, 42) - 0.5) * 0.8) * 60;
      ev.push({ t: dep - 55, arr: 1, al, dest, type: t }, { t: dep, arr: 0, al, dest, type: t });
    }
  });
  return ev.sort((a, b) => a.t - b.t);
}
function stepPlanes(dt) {
  if (!AIRPORTS.length) return;
  try {
    stepCruise(dt);
  } catch (e) {
    console.warn(e);
  }
  const vr = viewRect(6000, 0);
  for (const ap of AIRPORTS) {
    if (!ap.rkv || ap.cx < vr[0] || ap.cx > vr[2] || ap.cy < vr[1] || ap.cy > vr[3]) continue;
    const day = Math.floor(gameMin / 1440),
      now = gameMin % 1440;
    if (ap.evDay !== day || now < (ap.lastNow || 0) - 1) {
      if (ap.evDay !== day) ap.ev = rkvDay(day);
      ap.evDay = day;
      ap.evI = ap.ev.findIndex(e => e.t >= now);
      if (ap.evI < 0) ap.evI = ap.ev.length;
    }
    ap.lastNow = now;
    while (ap.evI < ap.ev.length && ap.ev[ap.evI].t <= now) {
      const e = ap.ev[ap.evI++];
      if (PLANES.filter(p => p.ap === ap).length >= 3 || entDim() > 0) continue;
      const rw = ap.rws.slice().sort((a, b) => b.L - a.L)[0];
      let dir = rw.ux * WIND[0] + rw.uy * WIND[1] > 0 ? -1 : 1;
      const ux = rw.ux * dir,
        uy = rw.uy * dir,
        sx = dir > 0 ? rw.x1 : rw.x2,
        sy = dir > 0 ? rw.y1 : rw.y2,
        T = PTYPE[e.type];
      const p = {
        plane: 1,
        ap,
        rw,
        t: e.type,
        ux,
        uy,
        sx,
        sy,
        rz: hAt(sx + (ux * rw.L) / 2, sy + (uy * rw.L) / 2),
        liv: [150, 154, 160],
        hd: Math.atan2(uy, ux),
        fade: 0,
        dest: e.dest,
        airline: e.al
      };
      if (e.arr) {
        p.st = 'app';
        p.d = -5500;
        p.v = T.sp;
        p.name = e.al + ' · flight from ' + e.dest;
        // the approach takes over from the cross-country leg, even if that is still flying at real speed on screen
        for (const c of CRUISE) if (c.arr && c.dest === e.dest && c.on) c.u = 1.0001;
      } else {
        p.st = 'lineup';
        p.d = 40;
        p.v = 0;
        p.tm = 8;
        p.name = e.al + ' · flight to ' + e.dest;
      }
      PLANES.push(p);
    }
  }
  for (const ap of AIRPORTS) {
    if (ap.rkv || ap.cx < vr[0] || ap.cx > vr[2] || ap.cy < vr[1] || ap.cy > vr[3]) continue;
    ap.next -= dt;
    if (ap.next > 0 || entDim() > 0) continue;
    ap.next = (ap.cls === 'intl' ? 50 : ap.cls === 'dom' ? 90 : 200) * (0.6 + R() * 0.8);
    if (PLANES.filter(p => p.ap === ap).length >= (ap.cls === 'intl' ? 3 : 2)) continue;
    // use the longest runway, landing and taking off into the wind
    const rw = ap.rws.slice().sort((a, b) => b.L - a.L)[0];
    let dir = rw.ux * WIND[0] + rw.uy * WIND[1] > 0 ? -1 : 1;
    if (windS < 3 && R() < 0.5) dir = -dir;
    const ux = rw.ux * dir,
      uy = rw.uy * dir,
      sx = dir > 0 ? rw.x1 : rw.x2,
      sy = dir > 0 ? rw.y1 : rw.y2;
    const types =
      ap.cls === 'intl'
        ? ['jet', 'jet', 'jet', 'wide', 'tp']
        : ap.cls === 'dom'
          ? ['tp', 'tp', 'tp', 'light']
          : ['light'];
    const t = pickA(types),
      T = PTYPE[t];
    const rz = hAt(sx + (ux * rw.L) / 2, sy + (uy * rw.L) / 2);
    const arr = R() < 0.5;
    const p = {
      plane: 1,
      ap,
      rw,
      t,
      ux,
      uy,
      sx,
      sy,
      rz,
      liv: pickA(LIVERY),
      hd: Math.atan2(uy, ux),
      fade: 0,
      dest: pickA(DESTS[ap.cls === 'intl' && t !== 'light' ? 'intl' : 'dom'])
    };
    if (arr) {
      p.st = 'app';
      p.d = -5500 * (t === 'light' ? 0.4 : 1);
      p.v = T.sp;
      p.name = (t === 'light' ? 'Light aircraft' : 'Flight') + ' from ' + p.dest;
    } else {
      p.st = 'lineup';
      p.d = 40;
      p.v = 0;
      p.tm = 8;
      p.name = (t === 'light' ? 'Light aircraft' : 'Flight') + ' to ' + p.dest;
    }
    PLANES.push(p);
  }
  for (let i = PLANES.length - 1; i >= 0; i--) {
    const p = PLANES[i],
      T = PTYPE[p.t];
    const gs = Math.tan((3 * Math.PI) / 180);
    if (p.st === 'app') {
      p.d += p.v * dt;
      const td = 300;
      p.alt = Math.max(0, (td - p.d) * gs);
      if (p.d >= td) {
        p.st = 'roll';
        p.alt = 0;
      }
    } else if (p.st === 'roll') {
      p.v = Math.max(9, p.v - dt * 2.6);
      p.d += p.v * dt;
      if (p.v <= 9.5) {
        p.st = 'taxi';
        p.tm = 14;
      }
    } else if (p.st === 'taxi') {
      p.tm -= dt;
      const ap = p.ap.aprons[0];
      if (ap) {
        const x = p.sx + p.ux * p.d,
          y = p.sy + p.uy * p.d;
        let want = Math.atan2(ap.cy - y, ap.cx - x),
          dh = want - p.hd;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        p.hd += Math.max(-0.4 * dt, Math.min(0.4 * dt, dh));
      }
      p.sx += Math.cos(p.hd) * 8 * dt;
      p.sy += Math.sin(p.hd) * 8 * dt;
      p.fade = Math.max(0, 1 - p.tm / 4) * -1;
      if (p.tm <= 0) {
        PLANES.splice(i, 1);
        if (follow === p) follow = null;
        continue;
      }
      continue;
    } else if (p.st === 'lineup') {
      p.tm -= dt;
      p.fade = Math.min(1, (8 - p.tm) / 3) - 1;
      if (p.tm <= 0) {
        p.st = 'tko';
        p.fade = 0;
      }
    } else if (p.st === 'tko') {
      p.v += T.acc * dt;
      p.d += p.v * dt;
      if (p.v > T.vr) {
        p.alt = (p.alt || 0) + p.v * 0.13 * dt;
      }
      if (p.d > p.rw.L + 8000) {
        PLANES.splice(i, 1);
        if (follow === p) follow = null;
        continue;
      }
    }
    if (p.st !== 'taxi') {
      p.hd = Math.atan2(p.uy, p.ux);
    }
  }
  for (const p of PLANES) {
    if (p.st === 'taxi') continue;
    p.x = p.sx + p.ux * p.d;
    p.y = p.sy + p.uy * p.d;
    p.z = p.rz + (p.alt || 0) + PTYPE[p.t].gear;
    p.fly = (p.alt || 0) > 3;
  }
  for (const p of PLANES)
    if (p.st === 'taxi') {
      p.x = p.sx + p.ux * p.d;
      p.y = p.sy + p.uy * p.d;
      p.z = p.rz + PTYPE[p.t].gear;
    }
}
function planeAll() {
  const out = [];
  for (const p of CRUISE) if (p.on && p.x !== undefined) out.push(p);
  for (const ap of AIRPORTS)
    for (const s of ap.stands) {
      if (s.z === undefined) {
        s.z = hAt(s.x, s.y) + PTYPE[s.t].gear;
      }
      out.push(s);
    }
  for (const p of PLANES) out.push(p);
  return out;
}
function drawPlane(p) {
  const T = PTYPE[p.t],
    k = K;
  const ca = Math.cos(p.hd),
    sa = Math.sin(p.hd);
  const zb = p.z;
  if (p.x === undefined) return;
  const s0 = sp_(p.x, p.y, zb);
  if (
    s0[0] < -T.L * k - 20 ||
    s0[0] > VW + T.L * k + 20 ||
    s0[1] < -T.L * k - 60 ||
    s0[1] > VH + T.L * k + 60
  )
    return;
  const P = (u, v, z) => {
    const x = p.x + u * ca - v * sa,
      y = p.y + u * sa + v * ca;
    return [PXw(x, y) * k - cx0, (PYw(x, y) - z) * k - cy0];
  };
  const alpha = p.fade < 0 ? 1 + p.fade : 1;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (T.L * k < 4 && p.cruise) {
    const s = sp_(p.x, p.y, zb),
      a = sp_(p.x - Math.cos(p.hd) * 900, p.y - Math.sin(p.hd) * 900, zb),
      dx = s[0] - a[0],
      dy = s[1] - a[1],
      l = Math.hypot(dx, dy) || 1,
      ux = dx / l,
      uy = dy / l; // a small plane shape and a fading trail, readable from far out
    const g = ctx.createLinearGradient(a[0], a[1], s[0], s[1]);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,.55)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s[0] - ux * Math.min(l, 26), s[1] - uy * Math.min(l, 26));
    ctx.lineTo(s[0], s[1]);
    ctx.stroke();
    ctx.fillStyle = C_([246, 246, 246], 1);
    ctx.fillRect(Math.round(s[0] - ux * 2) - 1, Math.round(s[1] - uy * 2) - 1, 2, 2);
    ctx.fillRect(Math.round(s[0] + uy * 2.5), Math.round(s[1] - ux * 2.5), 1, 1);
    ctx.fillRect(Math.round(s[0] - uy * 2.5), Math.round(s[1] + ux * 2.5), 1, 1);
    ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
    if (nightK > 0 && ((time * 1.5) | 0) % 2) {
      ctx.fillStyle = '#ff4040';
      ctx.fillRect(Math.round(s[0]), Math.round(s[1]) - 1, 1, 1);
    }
    ctx.restore();
    return;
  }
  if (T.L * k < 4) {
    const s = sp_(p.x, p.y, zb);
    ctx.fillStyle = C_([240, 240, 240], 1);
    ctx.fillRect(Math.round(s[0]), Math.round(s[1]), Math.max(1, Math.round(T.L * k * 0.5)), 1);
    if (night && ((time * 2) | 0) % 2) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(s[0]), Math.round(s[1]) - 1, 1, 1);
    }
    ctx.restore();
    return;
  }
  const F = (pts, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    pts.forEach((q, i) => {
      const s = P(q[0], q[1], q[2]);
      i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
    });
    ctx.closePath();
    ctx.fill();
  };
  const LV = AIRL[p.airline] || null;
  const L2 = T.L / 2,
    r = T.r,
    sp = T.span / 2,
    wz = T.low ? zb + r * 0.5 : zb + r * 2,
    white = LV ? LV.body : [238, 240, 242],
    belly = LV ? LV.belly : [176, 182, 188];
  // shadow on the ground
  const gz = hAt(p.x, p.y),
    sh = Math.max(0, 1 - (zb - gz) / 400);
  if (sh > 0) {
    ctx.globalAlpha = alpha * 0.22 * sh;
    const shp = (u, v) => {
      const x = p.x + u * ca - v * sa,
        y = p.y + u * sa + v * ca;
      return [x, y];
    };
    const S = pts => {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      pts.forEach((q, i) => {
        const w = shp(q[0], q[1]);
        const s = [PXw(w[0], w[1]) * k - cx0, (PYw(w[0], w[1]) - gz) * k - cy0];
        i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
      });
      ctx.closePath();
      ctx.fill();
    };
    S([
      [L2, 0],
      [L2 * 0.8, r],
      [-L2, r * 0.5],
      [-L2, -r * 0.5],
      [L2 * 0.8, -r]
    ]);
    S([
      [r * 1.5, -sp],
      [-r * 2, -sp],
      [-T.L * 0.25, 0],
      [r * 1.5, 0]
    ]);
    S([
      [r * 1.5, sp],
      [-r * 2, sp],
      [-T.L * 0.25, 0],
      [r * 1.5, 0]
    ]);
    ctx.globalAlpha = alpha;
  }
  const wing = sd => {
    const root0 = T.low ? T.L * 0.06 : T.L * 0.04,
      root1 = T.low ? -T.L * 0.14 : -T.L * 0.06,
      tip0 = T.low ? -T.L * 0.19 : -T.L * 0.01,
      tip1 = T.low ? -T.L * 0.27 : -T.L * 0.08;
    F(
      [
        [root0, sd * r * 0.9, wz],
        [tip0, sd * sp, wz + (T.low ? 1.2 : 0)],
        [tip1, sd * sp, wz + (T.low ? 1.2 : 0)],
        [root1, sd * r * 0.9, wz]
      ],
      C_(white, 0.92)
    );
    if (T.low && k >= 0.6) {
      const eu = -T.L * 0.04,
        ev = sd * sp * 0.36;
      F(
        [
          [eu + 3, ev - 1.2, wz - 1.6],
          [eu - 2, ev - 1.2, wz - 1.6],
          [eu - 2, ev + 1.2, wz - 1.6],
          [eu + 3, ev + 1.2, wz - 1.6]
        ],
        C_([150, 156, 162], 1)
      );
      F(
        [
          [eu + 3, ev - 1.2, wz - 0.3],
          [eu - 2, ev - 1.2, wz - 0.3],
          [eu - 2, ev + 1.2, wz - 0.3],
          [eu + 3, ev + 1.2, wz - 0.3]
        ],
        C_([200, 204, 208], 1)
      );
    }
    if (T.props && k >= 0.6) {
      for (const vv of T.props === 2 ? [sd * sp * 0.32] : []) {
        F(
          [
            [T.L * 0.04, vv - 0.7, wz + 0.1],
            [-T.L * 0.08, vv - 0.7, wz + 0.1],
            [-T.L * 0.08, vv + 0.7, wz + 0.1],
            [T.L * 0.04, vv + 0.7, wz + 0.1]
          ],
          C_(LV && LV.eng ? LV.eng : [220, 222, 226], 1)
        );
        const s = P(T.L * 0.06, vv, wz + 0.2);
        ctx.fillStyle = 'rgba(40,40,40,.5)';
        ctx.fillRect(
          Math.round(s[0] - k * 1.6),
          Math.round(s[1] - k * 0.2),
          Math.max(1, Math.round(k * 3.2)),
          Math.max(1, Math.round(k * 0.4))
        );
      }
    }
    if (night) {
      const s = P(tip1 + 1, sd * sp, wz + 1.2);
      ctx.fillStyle = sd > 0 ? '#40ff60' : '#ff3040';
      ctx.fillRect(
        Math.round(s[0]),
        Math.round(s[1]),
        Math.max(1, (k * 0.6) | 0),
        Math.max(1, (k * 0.6) | 0)
      );
    }
  };
  const stab = sd => {
    const zs = T.ttail ? zb + r * 2 + T.fin : zb + r * 1.2;
    F(
      [
        [-L2 + T.L * 0.1, sd * r * 0.4, zs],
        [-L2 + T.L * 0.02, sd * T.span * 0.17, zs],
        [-L2, sd * T.span * 0.17, zs],
        [-L2 + T.L * 0.04, sd * r * 0.4, zs]
      ],
      C_(white, 0.9)
    );
  };
  // which side is nearer the viewer?
  const nearS = PYw(p.x - sa, p.y + ca) > PYw(p.x, p.y) ? 1 : -1;
  if (T.low) {
    wing(-nearS);
  }
  stab(-nearS);
  // fuselage: tapered nose & tail, belly darker
  const fus = [
    [L2, 0],
    [L2 - r * 1.6, r],
    [-L2 + T.L * 0.2, r],
    [-L2, r * 0.35],
    [-L2, -r * 0.35],
    [-L2 + T.L * 0.2, -r],
    [L2 - r * 1.6, -r]
  ];
  const pts = [];
  for (const [u, v] of fus) pts.push(p.x + u * ca - v * sa, p.y + u * sa + v * ca);
  const o =
    area2(pts) < 0
      ? (() => {
          const q = [];
          for (let i = pts.length / 2 - 1; i >= 0; i--) q.push(pts[2 * i], pts[2 * i + 1]);
          return q;
        })()
      : pts;
  DOX = cx0;
  DOY = cy0;
  DK = k;
  BAKE = true;
  prism(ctx, o, zb, zb + r * 0.7, belly, null);
  prism(ctx, o, zb + r * 0.7, zb + r * 2, white, white);
  if (LV && LV.title && k >= 1.3) {
    const zt = zb + r * 1.55;
    ctx.fillStyle = C_(LV.title, 1);
    for (let u = L2 - r * 4; u > -L2 + T.L * 0.3; u -= Math.max(0.8, T.L / 60)) {
      if (((u * 7) | 0) % 3 === 0) continue;
      const s = P(u, nearS * r * 1.03, zt);
      ctx.fillRect(
        Math.round(s[0]),
        Math.round(s[1]),
        Math.max(1, (k * 0.5) | 0),
        Math.max(1, (k * 0.45) | 0)
      );
    }
  }
  if (k >= 1) {
    const zz = zb + r * 1.4;
    ctx.fillStyle = C_([50, 60, 74], 1);
    for (let u = L2 - r * 3; u > -L2 + T.L * 0.22; u -= Math.max(1.2, T.L / 40)) {
      const s = P(u, nearS * r * 1.02, zz);
      ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, Math.max(1, Math.round(k * 0.35)));
    }
    F(
      [
        [L2 - r * 0.4, -r * 0.5, zb + r * 1.6],
        [L2 - r * 1.4, -r * 0.8, zb + r * 1.9],
        [L2 - r * 1.4, r * 0.8, zb + r * 1.9],
        [L2 - r * 0.4, r * 0.5, zb + r * 1.6]
      ],
      C_([40, 48, 60], 1)
    );
  }
  // tail fin with the livery colour
  F(
    [
      [-L2 + T.L * 0.12, 0, zb + r * 2],
      [-L2 + T.L * 0.02, 0, zb + r * 2 + T.fin],
      [-L2 - T.L * 0.01, 0, zb + r * 2 + T.fin],
      [-L2, 0, zb + r * 1.6]
    ],
    C_(LV ? LV.tail : p.liv, 1)
  );
  if (LV && LV.mark && k >= 0.8) {
    const u = -L2 + T.L * 0.03,
      zc = zb + r * 2 + T.fin * 0.55,
      m = T.fin * 0.18;
    F(
      [
        [u + m, 0, zc - m],
        [u + m, 0, zc + m],
        [u - m, 0, zc + m],
        [u - m, 0, zc - m]
      ],
      C_(LV.mark, 1)
    );
  }
  if (k >= 0.8 && !(LV && LV.noStripe))
    F(
      [
        [-L2 + T.L * 0.1, nearS * r * 0.98, zb + r * 0.9],
        [L2 - r * 1.8, nearS * r * 0.98, zb + r * 0.9],
        [L2 - r * 1.8, nearS * r * 0.98, zb + r * 1.1],
        [-L2 + T.L * 0.1, nearS * r * 0.98, zb + r * 1.1]
      ],
      C_(p.liv, 0.9)
    );
  if (!T.low) {
    wing(-nearS);
  }
  if (T.low) wing(nearS);
  else wing(nearS);
  stab(nearS);
  if (T.t === 'light' || p.t === 'light') {
    const s = P(L2 + 0.2, 0, zb + r);
    ctx.fillStyle = 'rgba(40,40,40,.5)';
    ctx.fillRect(Math.round(s[0] - k), Math.round(s[1] - k * 0.1), Math.max(1, Math.round(k * 2)), 1);
  }
  if (night) {
    const on = (time * 1.3 + p.hd) % 1 < 0.12;
    if (on) {
      const s = P(0, 0, zb + r * 2.1);
      ctx.fillStyle = '#fff';
      ctx.fillRect(
        Math.round(s[0]),
        Math.round(s[1]),
        Math.max(1, (k * 0.7) | 0),
        Math.max(1, (k * 0.7) | 0)
      );
    }
    if (!p.parked && (p.alt || 0) < 600) {
      const s = P(L2, 0, zb);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,250,220,.5)';
      ctx.beginPath();
      ctx.arc(s[0], s[1], Math.max(1.5, k * 2.5), 0, 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  if (p === follow || p === selected) {
    ctx.strokeStyle = '#c6b3ff';
    ctx.lineWidth = 1;
    const s = P(0, 0, zb + r);
    const R2 = T.span * k * 0.55;
    ctx.strokeRect(
      Math.round(s[0] - R2) - 0.5,
      Math.round(s[1] - R2 * 0.7) - 0.5,
      Math.round(R2 * 2) + 1,
      Math.round(R2 * 1.2) + 1
    );
  }
  ctx.restore();
}
function planeCard(p) {
  const T = PTYPE[p.t];
  if (p.cruise) {
    const eta = Math.round(p.t1 + (p.to === 'Reykjavík' ? 1 : 6)) % 1440;
    return {
      h:
        '<h3>' +
        p.name +
        '</h3><div class="sub">' +
        T.name +
        '</div><div class="act">' +
        (p.u < 0.18 ? 'Climbing to cruise height' : p.u > 0.8 ? 'Descending towards ' + p.to : 'Cruising') +
        '</div><div class="row"><span>Altitude</span><span>' +
        Math.round(((p.z - 0) * 3.28) / 100) * 100 +
        ' ft</span></div><div class="row"><span>Arrives</span><span>' +
        String(Math.floor(eta / 60)).padStart(2, '0') +
        ':' +
        String(eta % 60).padStart(2, '0') +
        '</span></div>',
      m: p.name
    };
  }
  const st = p.parked
    ? 'Parked at the gate'
    : p.st === 'app'
      ? 'On final approach'
      : p.st === 'roll'
        ? 'Touched down, braking'
        : p.st === 'taxi'
          ? 'Taxiing to the stand'
          : p.st === 'lineup'
            ? 'Lining up for take-off'
            : (p.alt || 0) < 5
              ? 'Take-off roll'
              : 'Climbing out';
  return {
    h:
      '<h3>' +
      p.name +
      '</h3><div class="sub">' +
      T.name +
      (p.ap ? ' · ' + p.ap.name : '') +
      '</div><div class="act">' +
      st +
      '</div>' +
      (p.parked
        ? ''
        : '<div class="row"><span>Speed</span><span>' +
          Math.round((p.v || 0) * 1.944) +
          ' kn</span></div><div class="row"><span>Altitude</span><span>' +
          Math.round((p.alt || 0) * 3.28) +
          ' ft</span></div>') +
      (p.parked
        ? '<button class="btn" id="doplay">Fly this plane</button>'
        : follow === p
          ? '<button class="btn" id="unfollow">Stop following</button>'
          : '<button class="btn" id="dofollow">Follow</button>'),
    m: p.name
  };
}
