/**
 * Ferries
 *
 * Herjólfur, Baldur, Sævar and Sæfari on their timetables, with cars on and off.
 *
 * Functions: initFerries, ferryDeps, ferryRuns, ferryState, ferryNext, stepFerry, ferryDock, ferryCars,
 *     stepFerryCars, ferryCardTxt
 * State and constants: HM, FERRIES, FQ
 */

/* ================= scheduled ferries: Herjólfur, Baldur, Sævar (Hrísey) and Sæfari (Grímsey) =================
   Timetables follow the published patterns (Herjólfur: seven round trips a day between Vestmannaeyjar and Landeyjahöfn,
   35 minutes each way; Baldur: Stykkishólmur–Flatey–Brjánslækur, a second sailing in summer; Sævar every two hours;
   Sæfari Monday, Wednesday and Friday). Boats run on the game clock; cars drive off on arrival and queue up to board. */
const HM = s => {
  const [h, m] = s.split(':');
  return +h * 60 + (+m || 0);
};
const FERRIES = {
  herjolfur: {
    name: 'Herjólfur',
    en: 'Car ferry · Vestmannaeyjar–Landeyjahöfn',
    L: 70,
    W: 16,
    hull: [236, 236, 232],
    cab: [36, 64, 118],
    A: 'Landeyjahöfn',
    B: 'Vestmannaeyjar',
    dur: 35,
    cars: 40,
    depA: ['8:15', '10:45', '13:15', '15:45', '18:15', '20:45', '23:15'],
    depB: ['7:00', '9:30', '12:00', '14:30', '17:00', '19:30', '22:00'],
    path: [
      [63.5321, -20.1189],
      [63.5262, -20.129],
      [63.49, -20.2],
      [63.456, -20.252],
      [63.4437, -20.2668],
      [63.4428, -20.2732]
    ]
  },
  baldur: {
    name: 'Baldur',
    en: 'Car ferry · Stykkishólmur–Flatey–Brjánslækur',
    L: 68,
    W: 15,
    hull: [30, 58, 108],
    cab: [240, 240, 236],
    A: 'Stykkishólmur',
    B: 'Brjánslækur',
    dur: 150,
    cars: 30,
    via: 'Flatey',
    depA: ['15:00'],
    depB: ['18:00'],
    sumA: ['9:00', '15:00'],
    sumB: ['12:00', '18:00'],
    path: [
      [65.0785, -22.7262],
      [65.088, -22.742],
      [65.15, -22.79],
      [65.26, -22.85],
      [65.36, -22.895],
      [65.382, -22.92],
      [65.46, -23.03],
      [65.51, -23.13],
      [65.531, -23.184]
    ]
  },
  saevar: {
    name: 'Sævar',
    en: 'Ferry · Árskógssandur–Hrísey',
    L: 24,
    W: 7,
    hull: [236, 236, 232],
    cab: [200, 50, 40],
    A: 'Árskógssandur',
    B: 'Hrísey',
    dur: 15,
    cars: 0,
    depA: ['7:30', '9:30', '11:30', '13:30', '15:30', '17:30', '19:30', '21:30', '23:30'],
    depB: ['7:00', '9:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'],
    path: [
      [65.9442, -18.365],
      [65.956, -18.37],
      [65.979, -18.382]
    ]
  },
  saefari: {
    name: 'Sæfari',
    en: 'Ferry · Dalvík–Grímsey',
    L: 40,
    W: 10,
    hull: [230, 232, 230],
    cab: [40, 90, 150],
    A: 'Dalvík',
    B: 'Grímsey',
    dur: 180,
    cars: 4,
    days: [1, 3, 5],
    depA: ['9:00'],
    depB: ['16:00'],
    path: [
      [65.9707, -18.5262],
      [65.99, -18.51],
      [66.1, -18.43],
      [66.3, -18.24],
      [66.5, -18.05],
      [66.5395, -18.0185]
    ]
  }
};
function initFerries() {
  for (const k in FERRIES) {
    const F_ = FERRIES[k];
    const Ln = Object.assign({}, F_, {
      n: 1,
      v: 8,
      hours: [[0, 24]],
      wait: 1e9,
      linger: 0,
      sched: 1,
      key: k
    });
    Ln.path = F_.path;
    BLINES[k] = Ln;
  }
}
function ferryDeps(Ln, side) {
  const sum = SEAS === 'summer';
  const L = side === 'A' ? (sum && Ln.sumA ? Ln.sumA : Ln.depA) : sum && Ln.sumB ? Ln.sumB : Ln.depB;
  return L.map(HM);
}
function ferryRuns(Ln) {
  if (!Ln.days) return true;
  return Ln.days.includes(dayOfWeek());
}
// where the ferry is at a given game minute: sailing A→B, B→A, or tied up at one end
function ferryState(Ln, m) {
  const runs = ferryRuns(Ln);
  let best = null;
  if (runs)
    for (const [side, list] of [
      ['A', ferryDeps(Ln, 'A')],
      ['B', ferryDeps(Ln, 'B')]
    ])
      for (const d of list) {
        if (m >= d && m < d + Ln.dur)
          return { st: side === 'A' ? 'out' : 'back', u: (m - d) / Ln.dur, dep: d };
        if (m >= d + Ln.dur && (!best || d > best.d)) best = { d, at: side === 'A' ? 'B' : 'A' };
      }
  if (!best) {
    // before the first sailing of the day: wherever the last sailing of yesterday ended (assume B for evening returns)
    const lastA = Math.max(...ferryDeps(Ln, 'A')),
      lastB = Math.max(...ferryDeps(Ln, 'B'));
    best = { at: lastA > lastB ? 'B' : 'A' };
  }
  return { st: best.at === 'A' ? 'dock' : 'dock2', u: best.at === 'A' ? 0 : 1 };
}
function ferryNext(Ln, m) {
  const all = [...ferryDeps(Ln, 'A').map(d => [d, 'A']), ...ferryDeps(Ln, 'B').map(d => [d, 'B'])].sort(
    (a, b) => a[0] - b[0]
  );
  const n = all.find(e => e[0] > m);
  return n || all[0];
}
function stepFerry(b, dt) {
  const Ln = b.Ln,
    m = gameMin % 1440,
    S = ferryState(Ln, m);
  const prev = b.st;
  b.st = S.st;
  const ease = u => (u < 0.08 ? (u * u) / 0.16 : u > 0.92 ? 1 - ((1 - u) * (1 - u)) / 0.16 : u); // slow out of and into harbour
  const u = S.st === 'out' ? ease(S.u) : S.st === 'back' ? 1 - ease(S.u) : S.u;
  b.s = u * Ln.len;
  const p = boatPos(Ln, Math.min(Ln.len - 0.01, Math.max(0.01, b.s)));
  b.x = p[0];
  b.y = p[1];
  const hd = p[2] + (S.st === 'back' ? Math.PI : 0);
  if (S.st === 'out' || S.st === 'back') {
    let dh = hd - b.hd;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    b.hd += dh * Math.min(1, dt * 2);
    b.v = S.u < 0.08 || S.u > 0.92 ? 3 : 9;
  } else b.v = 0;
  if (S.st === 'out' && prev !== 'out')
    b.pax = Math.round((Ln.cars ? Ln.cars * 2.2 : 30) * (0.4 + R() * 0.6));
  // cars: drive off on arrival, queue to board before departure
  if (Ln.cars && K >= 0.3) {
    const side = S.st === 'dock' ? 'A' : S.st === 'dock2' ? 'B' : null;
    if (side && prev !== S.st && (prev === 'out' || prev === 'back'))
      ferryCars(Ln, side, 'off', Math.round(Ln.cars * (0.4 + R() * 0.5)));
    if (side) {
      const nx = ferryNext(Ln, m);
      if (nx && nx[1] === side && nx[0] - m < 20 && nx[0] - m > 2 && R() < dt * 0.25)
        ferryCars(Ln, side, 'on', 1);
    }
  }
}
function ferryDock(Ln, side) {
  const key = 'dock' + side;
  if (Ln[key] === undefined) {
    const P = side === 'A' ? Ln.P[0] : Ln.P[Ln.P.length - 1];
    Ln[key] = nearestNode(P[0], P[1], GD, 600);
  }
  return Ln[key];
}
const FQ = [];
function ferryCars(Ln, side, dir, n) {
  const d = ferryDock(Ln, side);
  if (d < 0) return;
  const vr = viewRect(600, 800);
  if (NX[d] < vr[0] || NX[d] > vr[2] || NY[d] < vr[1] || NY[d] > vr[3]) return;
  for (let i = 0; i < n; i++) FQ.push({ d, dir, t: i * 1.4 });
}
function stepFerryCars(dt) {
  for (let i = FQ.length - 1; i >= 0; i--) {
    const q = FQ[i];
    q.t -= dt;
    if (q.t > 0) continue;
    FQ.splice(i, 1);
    if (q.dir === 'off') {
      const an = R() * 6.283,
        t = nearestNode(NX[q.d] + Math.cos(an) * 3000, NY[q.d] + Math.sin(an) * 3000, GD, 800);
      const p = t >= 0 ? astar(GD, q.d, t, 20000) : null;
      if (!p || p.length < 2) continue;
      const c = mkAgent('car', NX[q.d], NY[q.d]);
      setVT(c, pickVT(c.x, c.y));
      c.path = p;
      c.pi = 0;
      c.t = 0;
      c.act = 'Off the ferry';
      agents.push(c);
    } else {
      let s = -1;
      for (let k = 0; k < 5 && s < 0; k++) {
        const an = R() * 6.283,
          m = nearestNode(NX[q.d] + Math.cos(an) * 1200, NY[q.d] + Math.sin(an) * 1200, GD, 500);
        if (m >= 0 && m !== q.d && !onScr(NX[m], NY[m], 30)) s = m;
      }
      if (s < 0) continue;
      const p = astar(GD, s, q.d, 20000);
      if (!p || p.length < 2) continue;
      const c = mkAgent('car', NX[s], NY[s]);
      setVT(c, pickVT(c.x, c.y));
      c.path = p;
      c.pi = 0;
      c.t = 0;
      c.ferryIn = 1;
      c.act = 'Heading for the ferry';
      setPos(c);
      agents.push(c);
    }
  }
}
function ferryCardTxt(b) {
  const Ln = b.Ln,
    m = gameMin % 1440,
    nx = ferryNext(Ln, m),
    hh = v => String(Math.floor(v / 60) % 24).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  const st =
    b.st === 'out'
      ? 'Sailing to ' + Ln.B + (Ln.via ? ' via ' + Ln.via : '')
      : b.st === 'back'
        ? 'Sailing to ' + Ln.A + (Ln.via ? ' via ' + Ln.via : '')
        : 'At the quay in ' + (b.st === 'dock' ? Ln.A : Ln.B);
  return {
    st,
    rows:
      '<div class="row"><span>Route</span><span>' +
      Ln.A +
      ' – ' +
      (Ln.via ? Ln.via + ' – ' : '') +
      Ln.B +
      '</span></div><div class="row"><span>Crossing</span><span>' +
      (Ln.dur >= 60
        ? Math.floor(Ln.dur / 60) + ' h ' + (Ln.dur % 60 ? (Ln.dur % 60) + ' min' : '')
        : Ln.dur + ' min') +
      '</span></div>' +
      (nx && ferryRuns(Ln)
        ? '<div class="row"><span>Next departure</span><span>' +
          hh(nx[0]) +
          ' from ' +
          (nx[1] === 'A' ? Ln.A : Ln.B) +
          '</span></div>'
        : '<div class="row"><span>Today</span><span>No sailings</span></div>') +
      (Ln.days ? '<div class="row"><span>Sails</span><span>Mon, Wed, Fri</span></div>' : '')
  };
}
