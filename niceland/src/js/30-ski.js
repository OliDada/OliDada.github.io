/**
 * Ski areas
 *
 * Lifts, runs and skiers in the ski season.
 *
 * Functions: CL_, polyCum, polyAt, skiAdd, initSki, skiSnow, skiOpen, skiVis, drawPistes, drawLifts,
 *     drawSkierAt, stepSki, drawSkiers, skiCard
 * State and constants: LIFTS, PISTES, SKIB, SKIERS, skiAcc, LIFTH, LIFTN, PDIFF, SKIC
 */

/* ================= ski areas: lifts and pistes from OpenStreetMap (Bláfjöll, Skálafell, Hlíðarfjall, Oddsskarð…) =================
   Lifts stand all year; in the season (December–April, 10:00 to 21:00 on weekdays, to 17:00 at weekends) chairs and T-bars run and
   skiers come down the runs. Runs show as groomed snow with coloured edge poles by difficulty, floodlit after dark. */
let LIFTS = [],
  PISTES = [],
  SKIB = new Map(),
  SKIERS = [],
  skiAcc = 0;
const LIFTH = {
  chair_lift: 9,
  gondola: 12,
  mixed_lift: 10,
  drag_lift: 3.6,
  't-bar': 3.6,
  'j-bar': 3.6,
  platter: 3.4,
  rope_tow: 1,
  magic_carpet: 0.3,
  zip_line: 10
};
const LIFTN = {
  chair_lift: 'Stólalyfta · chairlift',
  gondola: 'Kláfur · gondola',
  drag_lift: 'Toglyfta · drag lift',
  't-bar': 'T-lyfta · T-bar',
  platter: 'Diskalyfta · platter lift',
  rope_tow: 'Kaðallyfta · rope tow',
  magic_carpet: 'Töfrateppi · magic carpet',
  zip_line: 'Sviflína · zip line'
};
const PDIFF = {
  novice: [60, 170, 90],
  easy: [40, 110, 210],
  intermediate: [210, 40, 40],
  advanced: [24, 24, 28],
  expert: [24, 24, 28],
  freeride: [230, 140, 30]
};
function CL_(c) {
  return (
    'rgb(' +
    ((c[0] * Math.min(1, LR)) | 0) +
    ',' +
    ((c[1] * Math.min(1, LG)) | 0) +
    ',' +
    ((c[2] * Math.min(1, LB)) | 0) +
    ')'
  );
}
function polyCum(xs, ys) {
  const c = new Float32Array(xs.length);
  for (let i = 1; i < xs.length; i++) c[i] = c[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return c;
}
function polyAt(o, s) {
  const c = o.cum;
  s = Math.max(0, Math.min(o.L, s));
  let lo = 0,
    hi = o.n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (c[m] <= s) lo = m;
    else hi = m;
  }
  const t = (s - c[lo]) / (c[hi] - c[lo] || 1);
  const dx = o.xs[hi] - o.xs[lo],
    dy = o.ys[hi] - o.ys[lo],
    l = Math.hypot(dx, dy) || 1;
  return [o.xs[lo] + dx * t, o.ys[lo] + dy * t, dx / l, dy / l];
}
function skiAdd(o, M, id) {
  for (let i = 0; i + 1 < o.n; i++) ifAdd(o.xs[i], o.ys[i], o.xs[i + 1], o.ys[i + 1], id * 1e5 + i, M);
}
function initSki(d) {
  if (!d || !d.lifts) return;
  const mk = (arr, up) => {
    let xs = new Float32Array(arr.length / 2),
      ys = new Float32Array(arr.length / 2);
    for (let i = 0; i < xs.length; i++) {
      xs[i] = arr[2 * i] / 2;
      ys[i] = arr[2 * i + 1] / 2;
    }
    const z0 = hAt(xs[0], ys[0]),
      z1 = hAt(xs[xs.length - 1], ys[ys.length - 1]);
    if (up ? z0 > z1 : z0 < z1) {
      xs = xs.reverse();
      ys = ys.reverse();
    }
    return { xs, ys, n: xs.length };
  };
  for (const [t, name, a] of d.lifts) {
    if (a.length < 4) continue;
    const o = mk(a, true);
    o.t = t;
    o.name = name;
    o.h = LIFTH[t] || 4;
    o.cum = polyCum(o.xs, o.ys);
    o.L = o.cum[o.n - 1];
    if (o.L < 15) continue;
    o.id = LIFTS.length;
    o.chair = t === 'chair_lift' || t === 'gondola' || t === 'mixed_lift';
    o.sp = o.chair ? 2.4 : t === 'magic_carpet' ? 0.8 : 3;
    o.gap = o.chair ? 14 : t === 'rope_tow' || t === 'magic_carpet' ? 9 : 12;
    LIFTS.push(o);
    skiAdd(o, SKIB, o.id);
  }
  for (const [t, diff, name, area, a] of d.pistes) {
    if (a.length < 4) continue;
    const o = mk(a, false);
    o.t = t;
    o.diff = diff;
    o.name = name;
    o.cum = polyCum(o.xs, o.ys);
    o.L = o.cum[o.n - 1];
    if (o.L < 20) continue;
    o.id = 1e4 + PISTES.length;
    o.w = t === 'downhill' ? 18 : t === 'sled' ? 6 : 3;
    PISTES.push(o);
    skiAdd(o, SKIB, o.id);
  }
}
function skiSnow() {
  return SP.cover > 0 || snowAcc > 0.2;
}
function skiOpen() {
  const d = curDOY(),
    h = (gameMin % 1440) / 60;
  if (!(d >= 330 || d <= 120)) return false;
  return h >= 10 && h < (isWeekend() ? 17 : 21);
}
function skiVis(fn) {
  if (!LIFTS.length && !PISTES.length) return;
  ifVisible(
    viewRect(60, 1200),
    v => {
      const id = (v / 1e5) | 0;
      fn(id >= 1e4 ? PISTES[id - 1e4] : LIFTS[id], v % 1e5, id >= 1e4);
    },
    SKIB
  );
}
/* groomed runs and edge poles, drawn on the ground before people and buildings */
function drawPistes() {
  if (!PISTES.length || K < 0.05) return;
  const k = K,
    snow = skiSnow(),
    open = skiOpen();
  const seen = new Set(),
    list = [];
  skiVis((o, i, p) => {
    if (p && !seen.has(o.id)) {
      seen.add(o.id);
      list.push(o);
    }
  });
  if (!list.length) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const o of list) {
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i < o.n; i++) {
        const s = sp_(o.xs[i], o.ys[i], hAt(o.xs[i], o.ys[i]));
        i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
      }
    };
    if (o.t === 'downhill') {
      if (!snow) {
        if (k < 0.3) continue;
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = C_([150, 140, 110], 1);
        ctx.lineWidth = Math.max(1, o.w * k);
        path();
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = CL_([150, 154, 160]);
      ctx.lineWidth = Math.max(1, o.w * k + Math.max(1, k * 1.5));
      path();
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = CL_([252, 252, 252]);
      ctx.lineWidth = Math.max(1, o.w * k);
      path();
      ctx.stroke();
      if (k >= 0.9) {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = CL_([214, 216, 222]);
        ctx.lineWidth = 1;
        for (const off of [-0.3, 0, 0.3]) {
          ctx.beginPath();
          for (let s = 0; s <= o.L; s += 8) {
            const p = polyAt(o, s),
              x = p[0] - p[3] * off * o.w,
              y = p[1] + p[2] * off * o.w,
              q = sp_(x, y, hAt(x, y));
            s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (k >= 0.5) {
        const col = C_(PDIFF[o.diff] || PDIFF.intermediate, 1);
        ctx.fillStyle = col;
        for (let s = 20; s < o.L; s += 40)
          for (const sd of [-1, 1]) {
            const p = polyAt(o, s),
              x = p[0] - p[3] * sd * o.w * 0.55,
              y = p[1] + p[2] * sd * o.w * 0.55,
              g = hAt(x, y),
              a = sp_(x, y, g),
              b = sp_(x, y, g + 2);
            ctx.fillRect(
              Math.round(a[0]),
              Math.round(b[1]),
              Math.max(1, Math.round(k * 0.3)),
              Math.max(1, Math.round(a[1] - b[1]))
            );
          }
      }
      if (open && nightK > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,236,190,' + 0.1 * nightK + ')';
        for (let s = 30; s < o.L; s += 70) {
          const p = polyAt(o, s),
            q = sp_(p[0], p[1], hAt(p[0], p[1]));
          ctx.beginPath();
          ctx.ellipse(q[0], q[1], Math.max(3, k * 22), Math.max(2, k * 11), 0, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
    } else if (snow && k >= 0.2) {
      // cross-country tracks: two pairs of grooves
      ctx.strokeStyle = C_([176, 190, 210], 1);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      for (const off of k >= 1 ? [-1.1, -0.6, 0.6, 1.1] : [0]) {
        ctx.beginPath();
        for (let s = 0; s <= o.L; s += k >= 1 ? 4 : 15) {
          const p = polyAt(o, s),
            x = p[0] - p[3] * off,
            y = p[1] + p[2] * off,
            q = sp_(x, y, hAt(x, y));
          s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  ctx.lineCap = 'butt';
}
/* lifts: T-pylons, cables, bottom and top stations, chairs or T-bars moving round the loop */
function drawLifts() {
  if (!LIFTS.length || K < 0.1) return;
  const k = K,
    seen = new Set(),
    list = [];
  skiVis((o, i, p) => {
    if (!p && !seen.has(o.id)) {
      seen.add(o.id);
      list.push(o);
    }
  });
  if (!list.length) return;
  const open = skiOpen();
  for (const o of list) {
    const h = o.h,
      step = Math.min(70, Math.max(25, o.L / Math.max(1, Math.round(o.L / 55))));
    const side = o.chair ? 1.8 : 1.2;
    const C3 = (s, sd, zz) => {
      const p = polyAt(o, s),
        x = p[0] - p[3] * sd * side,
        y = p[1] + p[2] * sd * side;
      return sp_(x, y, hAt(x, y) + zz);
    };
    // stations
    for (const s of [0, o.L]) {
      const p = polyAt(o, s),
        g = hAt(p[0], p[1]),
        a = sp_(p[0], p[1], g),
        b = sp_(p[0], p[1], g + Math.max(2.6, h * 0.45));
      const w = Math.max(2, Math.round(k * 4));
      ctx.fillStyle = C_([196, 72, 52], 1);
      ctx.fillRect(Math.round(a[0] - w / 2), Math.round(b[1]), w, Math.max(1, Math.round(a[1] - b[1])));
      ctx.fillStyle = C_([90, 90, 96], 1);
      ctx.fillRect(
        Math.round(a[0] - w / 2 - 1),
        Math.round(b[1]) - 1,
        w + 2,
        Math.max(1, Math.round(k * 0.6))
      );
    }
    if (o.t === 'magic_carpet') {
      ctx.strokeStyle = C_([60, 64, 72], 1);
      ctx.lineWidth = Math.max(1, k * 0.9);
      ctx.beginPath();
      for (let s = 0; s <= o.L; s += 5) {
        const q = C3(s, 0, 0.2);
        s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      continue;
    }
    // pylons
    if (k >= 0.25) {
      ctx.strokeStyle = C_([110, 114, 122], 1);
      ctx.lineWidth = Math.max(1, k * 0.3);
      for (let s = step; s < o.L - 5; s += step) {
        const p = polyAt(o, s),
          g = hAt(p[0], p[1]),
          a = sp_(p[0], p[1], g),
          b = sp_(p[0], p[1], g + h + 0.6);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        const l = C3(s, -1, h + 0.6),
          r = C3(s, 1, h + 0.6);
        ctx.moveTo(l[0], l[1]);
        ctx.lineTo(r[0], r[1]);
        ctx.stroke();
      }
    }
    // cables
    ctx.strokeStyle = C_([46, 48, 52], 1);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      for (let s = 0; s <= o.L; s += Math.max(4, step / 4)) {
        const sag = Math.sin(Math.PI * ((s % step) / step)) * Math.min(1.2, h * 0.12);
        const q = C3(s, sd, h - sag);
        s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!open || k < 0.5) continue;
    // carriers round the loop: up on the right-hand cable, back down on the left
    const loop = 2 * o.L,
      n = Math.floor(loop / o.gap),
      ph = (time * o.sp) % o.gap;
    for (let j = 0; j < n; j++) {
      let u = j * o.gap + ph;
      const up = u < o.L,
        s = up ? u : loop - u,
        sd = up ? 1 : -1;
      const sag = Math.sin(Math.PI * ((s % step) / step)) * Math.min(1.2, h * 0.12);
      const top = C3(s, sd, h - sag);
      const rider = up && h32(o.id, j, ((time * o.sp) / loop) | 0) < 0.6;
      if (o.chair) {
        const seat = C3(s, sd, h - sag - 1.8);
        ctx.strokeStyle = C_([60, 62, 66], 1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(seat[0], seat[1]);
        ctx.stroke();
        ctx.fillStyle = C_([40, 44, 54], 1);
        ctx.fillRect(
          Math.round(seat[0] - k * 0.6),
          Math.round(seat[1]),
          Math.max(2, Math.round(k * 1.2)),
          Math.max(1, Math.round(k * 0.35))
        );
        if (rider) {
          ctx.fillStyle = C_(SKIC[(j * 7 + o.id) % SKIC.length], 1);
          ctx.fillRect(
            Math.round(seat[0] - k * 0.3),
            Math.round(seat[1] - k * 0.9),
            Math.max(1, Math.round(k * 0.6)),
            Math.max(1, Math.round(k * 0.9))
          );
        }
      } else if (o.t !== 'rope_tow') {
        const g = C3(s, sd, 0),
          bar = C3(s, sd, up && rider ? 1.1 : h - 1.4);
        ctx.strokeStyle = C_([70, 72, 78], 1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(bar[0], bar[1]);
        ctx.stroke();
        if (up && rider) drawSkierAt(g[0], g[1], polyAt(o, s), SKIC[(j * 5 + o.id) % SKIC.length], k, 0);
      } else if (up && rider) {
        const g = C3(s, sd, 0);
        drawSkierAt(g[0], g[1], polyAt(o, s), SKIC[(j * 5 + o.id) % SKIC.length], k, 0);
      }
    }
  }
}
const SKIC = [
  [220, 40, 50],
  [30, 120, 220],
  [250, 200, 30],
  [40, 170, 110],
  [230, 90, 170],
  [250, 130, 30],
  [30, 30, 36],
  [240, 240, 240]
];
function drawSkierAt(x, y, p, col, k, lean) {
  const sc = Math.max(1, k * 0.62);
  const dx = PXw(p[2], p[3]) - PXw(0, 0),
    dy = PYw(p[2], p[3]) - PYw(0, 0);
  const l = Math.hypot(dx, dy) || 1;
  ctx.strokeStyle = C_([30, 30, 34], 1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - (dx / l) * sc * 1.6, y - (dy / l) * sc * 1.6);
  ctx.lineTo(x + (dx / l) * sc * 1.6, y + (dy / l) * sc * 1.6);
  ctx.stroke();
  ctx.fillStyle = C_([40, 44, 60], 1);
  ctx.fillRect(
    Math.round(x - sc * 0.4 + lean * sc * 0.3),
    Math.round(y - sc * 1.4),
    Math.max(1, Math.round(sc * 0.8)),
    Math.max(1, Math.round(sc * 0.8))
  );
  ctx.fillStyle = C_(col, 1);
  ctx.fillRect(
    Math.round(x - sc * 0.45 + lean * sc * 0.5),
    Math.round(y - sc * 2.6),
    Math.max(1, Math.round(sc * 0.9)),
    Math.max(1, Math.round(sc * 1.3))
  );
  ctx.fillStyle = C_([238, 200, 170], 1);
  ctx.fillRect(
    Math.round(x - sc * 0.25 + lean * sc * 0.6),
    Math.round(y - sc * 3.2),
    Math.max(1, Math.round(sc * 0.55)),
    Math.max(1, Math.round(sc * 0.55))
  );
}
/* skiers carving down the runs (and skating along the cross-country tracks) */
function stepSki(dt) {
  if (!PISTES.length) return;
  skiAcc += dt;
  for (const s of SKIERS) {
    s.s += s.sp * dt;
    if (s.s >= s.o.L) {
      if (s.o.t === 'nordic' && R() < 0.5) {
        s.s = 0;
      } else {
        s.dead = 1;
      }
    }
  }
  if (skiAcc < 1) return;
  skiAcc = 0;
  SKIERS = SKIERS.filter(s => !s.dead);
  if (!skiOpen() || !skiSnow() || K < 0.4) {
    SKIERS.length = 0;
    return;
  }
  const seen = new Set(),
    vis = [];
  skiVis((o, i, p) => {
    if (p && !seen.has(o.id)) {
      seen.add(o.id);
      vis.push(o);
    }
  });
  const cnt = new Map();
  for (const s of SKIERS) {
    if (!seen.has(s.o.id)) {
      s.dead = 1;
      continue;
    }
    cnt.set(s.o.id, (cnt.get(s.o.id) || 0) + 1);
  }
  const busy = isWeekend() ? 1 : 0.6;
  for (const o of vis) {
    const want = Math.round(Math.min(40, o.L / (o.t === 'downhill' ? 35 : 90)) * busy),
      have = cnt.get(o.id) || 0;
    for (let q = 0; q < Math.min(3, want - have); q++)
      SKIERS.push({
        o,
        s: have === 0 && q === 0 ? R() * o.L * 0.5 : R() * o.L * 0.15,
        sp: o.t === 'downhill' ? 6 + R() * 8 : o.t === 'sled' ? 3 + R() * 3 : 2.5 + R() * 1.5,
        ph: R() * 6.3,
        amp: o.t === 'downhill' ? (0.15 + R() * 0.3) * o.w : 0,
        f: 0.06 + R() * 0.08,
        col: pickA(SKIC),
        kid: o.t === 'sled' || R() < 0.15
      });
  }
}
function drawSkiers() {
  if (!SKIERS.length || K < 0.4) return;
  const k = K;
  for (const s of SKIERS) {
    if (s.dead) continue;
    const o = s.o,
      p = polyAt(o, s.s),
      sw = Math.sin(s.s * s.f + s.ph),
      off = s.amp * sw * 0.5,
      x = p[0] - p[3] * off,
      y = p[1] + p[2] * off;
    const q = sp_(x, y, hAt(x, y));
    if (q[0] < -10 || q[0] > VW + 10 || q[1] < -10 || q[1] > VH + 10) continue;
    const c = Math.cos(s.s * s.f + s.ph) * s.amp * s.f;
    drawSkierAt(
      q[0],
      q[1],
      [p[0], p[1], p[2] - p[3] * c, p[3] + p[2] * c],
      s.col,
      k * (s.kid ? 0.75 : 1),
      sw
    );
  }
}
function skiCard(x, y) {
  let best = null,
    bd = 12;
  skiVis((o, i, p) => {
    const d = segD(x, y, o.xs[i], o.ys[i], o.xs[i + 1], o.ys[i + 1]);
    if (d < (p ? o.w * 0.6 : bd) && (!best || d < best[1])) best = [o, d, p];
  });
  if (!best) return null;
  const [o, , p] = best;
  const st = skiOpen() ? (skiSnow() ? 'Open' : 'Waiting for snow') : 'Closed';
  if (!p)
    return {
      h:
        '<h3>' +
        (o.name || LIFTN[o.t] || 'Lyfta') +
        '</h3><div class="sub">' +
        (LIFTN[o.t] || o.t) +
        '</div><div class="row"><span>Length</span><span>' +
        Math.round(o.L) +
        ' m</span></div><div class="row"><span>Rise</span><span>' +
        Math.round(hAt(o.xs[o.n - 1], o.ys[o.n - 1]) - hAt(o.xs[0], o.ys[0])) +
        ' m</span></div><div class="row"><span>Now</span><span>' +
        st +
        '</span></div><div class="row"><span>Season</span><span>December–April</span></div>',
      m: o.name || LIFTN[o.t]
    };
  const dn = {
    novice: 'Byrjendabrekka · beginner',
    easy: 'Auðveld · easy (blue)',
    intermediate: 'Miðlungs · intermediate (red)',
    advanced: 'Erfið · advanced (black)',
    expert: 'Mjög erfið · expert',
    freeride: 'Utanbrautar · freeride'
  };
  const n = SKIERS.filter(s => s.o === o && !s.dead).length;
  return {
    h:
      '<h3>' +
      (o.name ||
        (o.t === 'downhill' ? 'Skíðabrekka' : o.t === 'nordic' ? 'Gönguskíðabraut' : 'Sleðabrekka')) +
      '</h3><div class="sub">' +
      (o.t === 'downhill' ? 'Ski run' : o.t === 'nordic' ? 'Cross-country ski track' : 'Sledging hill') +
      '</div>' +
      (o.t === 'downhill'
        ? '<div class="row"><span>Grade</span><span>' + (dn[o.diff] || '—') + '</span></div>'
        : '') +
      '<div class="row"><span>Length</span><span>' +
      Math.round(o.L) +
      ' m</span></div><div class="row"><span>Drop</span><span>' +
      Math.round(Math.abs(hAt(o.xs[0], o.ys[0]) - hAt(o.xs[o.n - 1], o.ys[o.n - 1]))) +
      ' m</span></div><div class="row"><span>Now</span><span>' +
      st +
      (n ? ' · ' + n + ' on the run' : '') +
      '</span></div>',
    m: o.name || 'Ski run'
  };
}
