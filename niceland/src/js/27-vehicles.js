/**
 * Vehicles
 *
 * Vehicle types (cars, vans, buses, lorries) and how they are drawn.
 *
 * Functions: pickVT, setVT, drawVeh
 * State and constants: VT, GLASS, GLASS2
 */

const VT = {
  car: { len: 4.4, wid: 1.8, hgt: 1.5, cab: 0.62, sp: [12, 17] },
  small: {
    len: 3.7,
    wid: 1.65,
    hgt: 1.5,
    cab: 0.7,
    sp: [11, 15],
    cols: [
      [220, 60, 50],
      [240, 240, 236],
      [60, 140, 200],
      [240, 200, 60],
      [120, 190, 120],
      [40, 40, 44]
    ]
  },
  suv: {
    len: 4.8,
    wid: 1.95,
    hgt: 1.8,
    cab: 0.72,
    body: 0.6,
    sp: [12, 17],
    cols: [
      [30, 30, 34],
      [230, 230, 226],
      [150, 150, 156],
      [60, 70, 90],
      [120, 40, 40],
      [200, 200, 204]
    ]
  },
  jeep: {
    len: 5.4,
    wid: 2.4,
    hgt: 2.4,
    cab: 0.7,
    body: 0.62,
    big: 1,
    sp: [11, 15],
    cols: [
      [30, 30, 34],
      [236, 236, 232],
      [180, 30, 30],
      [60, 80, 60],
      [230, 180, 40]
    ]
  },
  van: {
    len: 5.2,
    wid: 2,
    hgt: 2.1,
    box: 1,
    sp: [11, 15],
    cols: [
      [236, 236, 232],
      [200, 200, 204],
      [40, 60, 120],
      [40, 40, 44]
    ]
  },
  pickup: {
    len: 5.3,
    wid: 1.9,
    hgt: 1.85,
    pick: 1,
    sp: [11, 16],
    cols: [
      [200, 200, 204],
      [30, 30, 34],
      [120, 40, 40],
      [60, 90, 130]
    ]
  },
  taxi: {
    len: 4.8,
    wid: 1.85,
    hgt: 1.5,
    cab: 0.62,
    sign: 1,
    sp: [12, 16],
    cols: [
      [30, 30, 34],
      [230, 230, 226],
      [150, 150, 156]
    ]
  },
  police: {
    len: 4.9,
    wid: 1.95,
    hgt: 1.75,
    cab: 0.72,
    body: 0.6,
    bar: 1,
    stripe: [30, 70, 170],
    stripe2: [240, 200, 30],
    sp: [13, 18],
    cols: [[236, 238, 242]]
  },
  amb: {
    len: 6,
    wid: 2.2,
    hgt: 2.6,
    box: 1,
    bar: 1,
    stripe: [40, 140, 80],
    sp: [13, 17],
    cols: [[236, 226, 60]]
  },
  lorry: {
    len: 9,
    wid: 2.5,
    hgt: 3.5,
    lorry: 1,
    sp: [12, 15],
    cols: [
      [236, 236, 232],
      [200, 40, 40],
      [40, 60, 120],
      [230, 180, 40]
    ]
  },
  coach: {
    len: 13,
    wid: 2.55,
    hgt: 3.6,
    box: 1,
    win: 1,
    sp: [14, 18],
    cols: [
      [236, 236, 236],
      [30, 40, 60],
      [200, 200, 204]
    ]
  },
  camper: {
    len: 6.6,
    wid: 2.25,
    hgt: 2.9,
    box: 1,
    over: 1,
    stripe: [90, 140, 200],
    sp: [12, 15],
    cols: [
      [240, 240, 236],
      [226, 230, 232]
    ]
  },
  tractor: {
    len: 3.9,
    wid: 2,
    hgt: 2.7,
    tractor: 1,
    sp: [6, 8],
    cols: [
      [200, 40, 30],
      [40, 120, 60],
      [230, 180, 40],
      [60, 90, 160]
    ]
  },
  moto: {
    len: 2.2,
    wid: 0.8,
    hgt: 1.4,
    moto: 1,
    sp: [14, 20],
    cols: [
      [30, 30, 34],
      [200, 40, 40],
      [240, 160, 30],
      [60, 90, 160]
    ]
  }
};
function pickVT(x, y) {
  const cap = inF(x, y),
    h = (gameMin % 1440) / 60,
    nt = h < 6 || h >= 22,
    sum = SEAS === 'summer';
  let T;
  if (cap)
    T = {
      car: 46,
      small: 10,
      suv: 14,
      jeep: 2,
      van: 7,
      pickup: 3,
      taxi: nt ? 12 : 4,
      police: 1.6,
      amb: 0.6,
      lorry: 4,
      coach: 1.5,
      camper: sum ? 2.5 : 0.6,
      moto: sum ? 2 : 0.3
    };
  else
    T = {
      car: 30,
      suv: 18,
      jeep: 7,
      camper: sum ? 14 : 4,
      coach: 5,
      pickup: 8,
      tractor: 4,
      lorry: 7,
      van: 5,
      moto: sum ? 3 : 0.3,
      police: 0.5
    };
  let s = 0;
  for (const k in T) s += T[k];
  let r = R() * s;
  for (const k in T) {
    r -= T[k];
    if (r <= 0) return k;
  }
  return 'car';
}
function setVT(a, t) {
  const v = VT[t];
  a.vt = t;
  a.len = v.len;
  a.wid = v.wid;
  a.hgt = v.hgt;
  a.sp = v.sp[0] + R() * (v.sp[1] - v.sp[0]);
  a.c = v.cols ? pickA(v.cols) : pickA(CARC);
  a.vname = {
    car: 'Bíll · car',
    small: 'Smábíll · small car',
    suv: 'Jeppi · SUV',
    jeep: 'Breyttur jeppi · super jeep',
    van: 'Sendibíll · van',
    pickup: 'Pallbíll · pickup',
    taxi: 'Leigubíll · taxi',
    police: 'Lögreglubíll · police car',
    amb: 'Sjúkrabíll · ambulance',
    lorry: 'Vörubíll · lorry',
    coach: 'Rúta · tour coach',
    camper: 'Húsbíll · camper van',
    tractor: 'Dráttarvél · tractor',
    moto: 'Mótorhjól · motorbike',
    bus: 'Strætó · city bus',
    fire: 'Slökkvibíll · fire engine'
  }[t];
  if (t === 'police' || t === 'amb') a.siren = R() < 0.25 ? 1 : 0;
}
/* ================= vehicles v2: proper bodies, glasshouse, pillars, wheels ================= */
VT.bus = {
  len: 12,
  wid: 2.55,
  hgt: 3.1,
  coach: 1,
  sp: [10, 12],
  cols: [[244, 196, 36]],
  stripe: [40, 40, 44]
};
VT.fire = {
  len: 9,
  wid: 2.5,
  hgt: 3.1,
  fire: 1,
  bar: 1,
  sp: [18, 22],
  cols: [[200, 30, 30]],
  stripe: [236, 236, 232]
};
VT.coach.coach = 1;
VT.coach.box = 0;
const GLASS = [52, 70, 90],
  GLASS2 = [86, 112, 138];
function drawVeh(a, z) {
  const k = K,
    V = VT[a.vt];
  let dx = a.vx,
    dy = a.vy,
    L = Math.hypot(dx, dy);
  if (L < 0.01) {
    dx = a.ldx || 1;
    dy = a.ldy || 0;
    L = 1;
  }
  dx /= L;
  dy /= L;
  a.ldx = dx;
  a.ldy = dy;
  const hl = a.len / 2,
    hw = a.wid / 2,
    W = (u, v) => [a.x + dx * u - dy * v, a.y + dy * u + dx * v];
  if (k * a.len < 3) {
    const s = sp_(a.x, a.y, z + 1);
    ctx.fillStyle = C_(a.c, 1);
    ctx.fillRect(Math.round(s[0]), Math.round(s[1]), Math.max(1, Math.round(k * a.len * 0.6)), 1);
    return;
  }
  const S = (u, v, zz) => {
    const w = W(u, v);
    return [PXw(w[0], w[1]) * k - cx0, (PYw(w[0], w[1]) - zz) * k - cy0];
  };
  const poly = (pts, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fill();
  };
  // world-space normals of the four sides (+u front, -u back, +v left, -v right)
  const nF = [dx, dy],
    nB = [-dx, -dy],
    nL = [-dy, dx],
    nR = [dy, -dx];
  const vis = n => faces(n[0], n[1]) > 0;
  const shade = n => wallShade(n[0], n[1]);
  const C = (c, m) => C_(c, m);
  // a box with per-face fills; opts.glass:{z0,z1,pillars:[u...],front:true} paints a window band on the sides
  const box = (u0, u1, v0, v1, z0, z1, col, o) => {
    o = o || {};
    const top = o.top || col;
    const fs = [
      [
        nF,
        [
          [u1, v0],
          [u1, v1]
        ]
      ],
      [
        nB,
        [
          [u0, v1],
          [u0, v0]
        ]
      ],
      [
        nL,
        [
          [u1, v1],
          [u0, v1]
        ]
      ],
      [
        nR,
        [
          [u0, v0],
          [u1, v0]
        ]
      ]
    ];
    for (const [n, [p, q]] of fs) {
      if (!vis(n)) continue;
      const sh = shade(n);
      poly(
        [S(p[0], p[1], z0), S(q[0], q[1], z0), S(q[0], q[1], z1), S(p[0], p[1], z1)],
        C(o.sideCol || col, sh)
      );
      const g = o.glass;
      if (g) {
        const isF = n === nF,
          isB = n === nB;
        if ((isF && g.front !== false) || (isB && g.back) || (!isF && !isB && g.side !== false)) {
          const gz0 = isF && g.fz0 !== undefined ? g.fz0 : g.z0,
            gz1 = g.z1;

          const pa = [p[0], p[1]],
            qa = [q[0], q[1]]; // inset along the face
          const lerp = t => [pa[0] + (qa[0] - pa[0]) * t, pa[1] + (qa[1] - pa[1]) * t];
          const t0 = isF || isB ? 0.1 : g.t0 || 0.04,
            t1 = isF || isB ? 0.9 : g.t1 || 0.96;
          const A1 = lerp(t0),
            B1 = lerp(t1);
          poly(
            [S(A1[0], A1[1], gz0), S(B1[0], B1[1], gz0), S(B1[0], B1[1], gz1), S(A1[0], A1[1], gz1)],
            C(isF ? GLASS2 : GLASS, isF ? 1 : sh)
          );
          if (!isF && !isB && g.pillars && k >= 1.6) {
            ctx.strokeStyle = C(col, sh);
            ctx.lineWidth = Math.max(1, k * 0.18);
            for (const u of g.pillars) {
              // u along the vehicle -> fraction along this face
              const t = n === nL ? (u1 - u) / (u1 - u0) : (u - u0) / (u1 - u0);
              if (t <= t0 || t >= t1) continue;
              const P1 = lerp(t);
              const s1 = S(P1[0], P1[1], gz0),
                s2 = S(P1[0], P1[1], gz1);
              ctx.beginPath();
              ctx.moveTo(s1[0], s1[1]);
              ctx.lineTo(s2[0], s2[1]);
              ctx.stroke();
            }
          }
          if (isF && k >= 2 && !(BAKE && night)) {
            const A2 = lerp(0.2),
              B2 = lerp(0.45);
            poly(
              [
                S(A2[0], A2[1], gz1 - (gz1 - gz0) * 0.15),
                S(B2[0], B2[1], gz1 - (gz1 - gz0) * 0.15),
                S(B2[0], B2[1], gz1 - (gz1 - gz0) * 0.3),
                S(A2[0], A2[1], gz1 - (gz1 - gz0) * 0.3)
              ],
              C([150, 176, 196], 1)
            );
          }
        }
      }
    }
    poly([S(u0, v0, z1), S(u1, v0, z1), S(u1, v1, z1), S(u0, v1, z1)], C(top, 1.06));
  };
  // wheels: far side first, then body, then near side
  const wr = V.big
    ? 0.75
    : V.tractor
      ? 0.65
      : V.coach || V.lorry || V.fire || a.vt === 'camper' || a.vt === 'amb'
        ? 0.5
        : a.vt === 'suv' || a.vt === 'police' || a.vt === 'pickup' || a.vt === 'van'
          ? 0.4
          : 0.33;
  const axles =
    V.coach || V.lorry || V.fire
      ? [hl - 1.9, -hl + 2.1, -hl + 3.3]
      : V.tractor
        ? [hl - 0.7, -hl + 0.9]
        : [hl - Math.min(1.05, hl * 0.42), -hl + Math.min(1.1, hl * 0.42)];
  const nearV = vis(nL) ? 1 : -1;
  const wheel = (u, v, big) => {
    const r = big || wr;
    const c0 = S(u, v, z + r),
      wpx = Math.max(1, Math.round(r * 2 * k * 0.85)),
      hpx = Math.max(1, Math.round(r * 2 * k * 0.8));
    ctx.fillStyle = C([22, 22, 24], 1);
    ctx.fillRect(Math.round(c0[0] - wpx / 2), Math.round(c0[1] - hpx / 2), wpx, hpx);
    if (k >= 2.2) {
      ctx.fillStyle = C([150, 150, 150], 1);
      ctx.fillRect(
        Math.round(c0[0]) - 1,
        Math.round(c0[1]) - 1,
        Math.max(1, Math.round(k * 0.3)),
        Math.max(1, Math.round(k * 0.3))
      );
    }
  };
  const wheels = side => {
    if (V.moto) return;
    for (let i = 0; i < axles.length; i++) {
      const u = axles[i];
      const big = V.tractor && i === 1 ? 1.05 : 0;
      wheel(u, side * hw * 0.98, big);
    }
  };
  if (k >= 1.1) wheels(-nearV);
  const bz = z + wr * (V.big ? 1.1 : 0.7),
    H = a.hgt;
  if (V.moto) {
    box(-hl, hl, -0.25, 0.25, z + 0.3, z + 0.75, a.c);
    box(-0.4, 0.3, -0.28, 0.28, z + 0.75, z + 1.55, [40, 40, 44], { top: [60, 60, 64] });
    const s = S(0.1, 0, z + 1.85);
    ctx.fillStyle = C(a.c, 0.8);
    ctx.fillRect(
      Math.round(s[0] - k * 0.3),
      Math.round(s[1]),
      Math.max(1, Math.round(k * 0.6)),
      Math.max(1, Math.round(k * 0.6))
    );
  } else if (V.tractor) {
    box(0.1, hl, -hw * 0.45, hw * 0.45, bz, bz + 1.1, a.c);
    box(-hl, 0.1, -hw * 0.6, hw * 0.6, bz, bz + 0.9, a.c);
    box(-hl + 0.2, 0.1, -hw * 0.55, hw * 0.55, bz + 0.9, bz + H - 0.4, a.c, {
      glass: { z0: bz + 1.1, z1: bz + H - 0.5, back: true },
      top: a.c
    });
    const s = S(hl - 0.5, 0, bz + 1.1);
    ctx.fillStyle = C([40, 40, 40], 1);
    ctx.fillRect(
      Math.round(s[0]),
      Math.round(s[1] - k * 1.1),
      Math.max(1, Math.round(k * 0.25)),
      Math.max(1, Math.round(k * 1.1))
    );
  } else if (V.lorry || V.fire) {
    const cl = 2.3;
    const cab = () =>
      box(hl - cl, hl, -hw, hw, bz, bz + 2.7, a.c, {
        glass: { z0: bz + 1.6, z1: bz + 2.5, side: true, t0: 0.45, t1: 0.95 },
        top: a.c
      });
    const cargo = () => {
      if (V.fire) {
        box(-hl, hl - cl - 0.1, -hw, hw, bz, bz + H - 0.3, a.c, { top: [150, 150, 156] });
      } else box(-hl, hl - cl - 0.15, -hw, hw, bz + 0.15, bz + H, [236, 236, 232], { top: [220, 220, 216] });
    };
    const fr = W(hl - 1, 0),
      bk = W(-hl / 2, 0);
    if (PYw(fr[0], fr[1]) < PYw(bk[0], bk[1])) {
      cab();
      cargo();
    } else {
      cargo();
      cab();
    }
  } else if (V.coach) {
    box(-hl, hl, -hw, hw, bz, bz + H, a.c, {
      glass: {
        z0: bz + 1.25,
        z1: bz + H - 0.35,
        fz0: bz + 0.9,
        pillars: Array.from({ length: Math.floor(a.len / 1.4) }, (_, i) => -hl + 0.7 + i * 1.4)
      },
      top: a.vt === 'bus' ? [236, 236, 232] : a.c
    });
  } else if (V.box) {
    const front =
      a.vt === 'van'
        ? { z0: bz + H * 0.55, z1: bz + H * 0.88, t0: 0.62, t1: 0.97, pillars: [hl - 0.9] }
        : {
            z0: bz + H * 0.55,
            z1: bz + H * 0.85,
            pillars: Array.from({ length: Math.floor(a.len / 1.6) }, (_, i) => -hl + 0.8 + i * 1.6)
          };
    box(-hl, hl, -hw, hw, bz, bz + H, a.c, { glass: Object.assign({ fz0: bz + H * 0.45 }, front) });
    if (V.over) box(hl - 1.4, hl - 0.05, -hw * 0.94, hw * 0.94, bz + H, bz + H + 0.5, a.c);
  } else if (V.pick) {
    const bh = H * 0.5;
    box(-0.3, hl, -hw, hw, bz, bz + bh, a.c);
    box(-0.3, hl * 0.45, -hw * 0.9, hw * 0.9, bz + bh, bz + H, a.c, {
      glass: { z0: bz + bh + 0.05, z1: bz + H - 0.12, pillars: [-0.3 + 0.3, hl * 0.1] }
    });
    box(-hl, -0.35, -hw, hw, bz, bz + bh, a.c, { top: [46, 46, 50] });
    if (k >= 1.6) {
      ctx.strokeStyle = C(a.c, 0.8);
      ctx.lineWidth = 1;
      const p1 = S(-hl + 0.1, -hw + 0.1, bz + bh),
        p2 = S(-0.4, -hw + 0.1, bz + bh),
        p3 = S(-0.4, hw - 0.1, bz + bh),
        p4 = S(-hl + 0.1, hw - 0.1, bz + bh);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();
      ctx.stroke();
    }
  } else {
    // cars: lower body + glasshouse set back from the bonnet
    const tall = a.vt === 'suv' || a.vt === 'jeep' || a.vt === 'police',
      bh = H * (tall ? 0.56 : 0.5),
      c0 = tall ? -hl * 0.82 : -hl * 0.62,
      c1 = tall ? hl * 0.32 : hl * 0.22;
    box(-hl, hl, -hw, hw, bz, bz + bh, a.c);
    box(c0, c1, -hw * 0.9, hw * 0.9, bz + bh, bz + H, a.c, {
      glass: {
        z0: bz + bh + 0.06,
        z1: bz + H - 0.1,
        fz0: bz + bh + 0.02,
        pillars: [(c0 + c1) / 2],
        back: true
      }
    });
    if (a.vt === 'jeep' && k >= 1.3) {
      const s = S(c0 + 0.2, 0, bz + H + 0.12);
      ctx.fillStyle = C([30, 30, 30], 1);
      ctx.fillRect(
        Math.round(s[0] - k * 0.8),
        Math.round(s[1]),
        Math.max(2, Math.round(k * 1.6)),
        Math.max(1, Math.round(k * 0.3))
      );
    }
  }
  if (k >= 1.1) wheels(nearV);
  // liveries, signs, light bars
  const band = (zz, col, from, to, step, w) => {
    ctx.fillStyle = col;
    for (const sd of [1, -1]) {
      if (!vis(sd > 0 ? nL : nR)) continue;
      for (let u = from; u <= to; u += step) {
        const s = S(u, sd * hw * 1.01, zz);
        ctx.fillRect(
          Math.round(s[0]),
          Math.round(s[1]),
          Math.max(1, Math.round(k * (w || 0.9))),
          Math.max(1, Math.round(k * 0.35))
        );
      }
    }
  };
  if (k >= 1.3) {
    if (V.stripe) band(bz + (V.coach ? 0.75 : H * 0.32), C(V.stripe, 1), -hl + 0.2, hl - 0.2, 0.35, 0.45);
    if (V.stripe2) band(bz + H * 0.22, C(V.stripe2, 1), -hl + 0.3, hl - 0.3, 0.7, 0.45);
    if (V.sign) {
      const s = S(-0.2, 0, bz + H + 0.28);
      ctx.fillStyle = night ? '#fff3a0' : C([240, 210, 60], 1);
      ctx.fillRect(
        Math.round(s[0] - k * 0.4),
        Math.round(s[1]),
        Math.max(1, Math.round(k * 0.8)),
        Math.max(1, Math.round(k * 0.4))
      );
    }
    if (V.bar) {
      const on = a.siren ? ((time * 6) | 0) % 2 : 0;
      const bzT = V.fire ? bz + 2.7 : V.box ? bz + H : bz + H;
      const s = S(V.fire ? hl - 1.2 : 0, 0, bzT + 0.18);
      ctx.fillStyle = a.siren ? (on ? '#ff3030' : '#3070ff') : C([60, 90, 200], 1);
      ctx.fillRect(
        Math.round(s[0] - k * 0.7),
        Math.round(s[1]),
        Math.max(2, Math.round(k * 1.4)),
        Math.max(1, Math.round(k * 0.45))
      );
      if (a.siren) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = on ? 'rgba(255,40,40,.16)' : 'rgba(40,90,255,.16)';
        ctx.beginPath();
        ctx.arc(s[0], s[1], k * 7, 0, 7);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // lamps on the front and back faces
  const lz = bz + (V.coach || V.box || V.lorry || V.fire ? 0.7 : H * 0.3),
    ls = Math.max(1, Math.round(k * 0.5));
  for (const sd of [-1, 1]) {
    if (night || vis(nF)) {
      const f = S(hl + 0.02, hw * 0.72 * sd, lz);
      ctx.fillStyle = night ? '#fff6cc' : C([236, 236, 226], 1);
      ctx.fillRect(Math.round(f[0]), Math.round(f[1]), ls, ls);
    }
    if (night || vis(nB)) {
      const r = S(-hl - 0.02, hw * 0.72 * sd, lz);
      ctx.fillStyle = night ? '#ff3b30' : C([180, 30, 30], 1);
      ctx.fillRect(Math.round(r[0]), Math.round(r[1]), ls, ls);
    }
    if (V.moto) break;
  }
  if (a === follow || a === selected) {
    const s = S(0, 0, bz + H / 2);
    const R2 = a.len * k * 0.6;
    ctx.strokeStyle = '#c6b3ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(s[0] - R2) - 0.5,
      Math.round(s[1] - R2 * 0.6) - 0.5,
      Math.round(R2 * 2) + 1,
      Math.round(R2 * 1.2) + 1
    );
  }
}
