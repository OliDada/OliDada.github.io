/**
 * Events through the year
 *
 * 17. júní, Pride, Menningarnótt, Christmas lights, New Year fireworks and bonfires, parades and concerts.
 *
 * Functions: evNow, evToast, rocket, burst, stepEvents, streetRoute, paradeRoute, paradeUnit, spawnRank,
 *     spawnMarcher, stepParade, spectators, disperse, stepLeaving, endParade, stepConcertTimer,
 *     startConcert, stepConcert, concertTool, endConcert, drawStage, drawStage0, carried, drawEventFlags,
 *     evCrowd, drawEvents, drawXmas, gotoEvent
 * State and constants: EVX, EVSTATE, BRENNUR, EVNAME, EVSPOT, PARADE_WP, PARADE_ST, PARADE, RAINBOW,
 *     LEAVING, CONCERT, EVFLAGKEY, XCOL
 */

// Dates follow the real calendar rules (Pride parade: Saturday 8–14 Aug; Menningarnótt: Saturday 18–24 Aug); bonfire spots are approximate.
const EVX = []; // firework sparks: {x,y,z,vx,vy,vz,life,max,c}
let EVSTATE = { key: '', toast: '', crowdT: 0, shows: [] };
const BRENNUR = [
  ['Ægisíða', 64.1408, -21.9655],
  ['Geirsnef', 64.1255, -21.842],
  ['Gufunes', 64.145, -21.813],
  ['Úlfarsárdalur', 64.142, -21.748]
];
function evNow() {
  const doy = curDOY(),
    h = (gameMin % 1440) / 60,
    d = dayOfWeek(),
    sat = d === 6;
  const out = [];
  if (doy === 167 && h >= 10 && h < 18) out.push('jun17');
  if (sat && doy >= 219 && doy <= 225 && h >= 12 && h < 18) out.push('pride');
  if (sat && doy >= 229 && doy <= 235 && h >= 11) out.push('menning');
  if (sat && doy >= 229 && doy <= 235 && h >= 22.9 && h < 23.4) out.push('menningfw');
  if (doy >= 334 || doy <= 5) out.push('xmas');
  if (doy === 364 && h >= 20.5 && h < 22.5) out.push('brenna');
  if ((doy === 364 && h >= 21) || (doy === 0 && h < 2)) out.push('nye');
  if (doy === 5 && h >= 18 && h < 21) out.push('brenna', 'thirteenth');
  return out;
}
const EVNAME = {
  jun17: "17. júní · Iceland's National Day",
  pride: 'Hinsegin dagar · the Pride parade',
  menning: 'Menningarnótt · Culture Night',
  menningfw: 'Menningarnótt fireworks over the harbour',
  xmas: 'Jólin · Christmas lights are up',
  nye: "Gamlárskvöld · New Year's Eve fireworks",
  brenna: 'Áramótabrennur · the bonfires are lit',
  thirteenth: 'Þrettándinn · the last day of Christmas'
};
const EVSPOT = {
  jun17: [64.1477, -21.9349, 220],
  pride: [64.1459, -21.9365, 260],
  menning: [64.1466, -21.935, 420]
};
function evToast(ev) {
  const k = ev.filter(e => e !== 'xmas' || EVSTATE.key.indexOf('xmas') < 0).join(',');
  if (k === EVSTATE.toast) return;
  const fresh = ev.find(e => EVSTATE.toast.split(',').indexOf(e) < 0);
  EVSTATE.toast = k;
  if (fresh) toast(EVNAME[fresh]);
}
function rocket(x, y, z0, big) {
  const h = (big ? 90 : 45) + R() * (big ? 60 : 35),
    t = h / (big ? 40 : 32);
  EVX.push({
    rk: 1,
    x,
    y,
    z: z0,
    vz: h / t,
    life: t,
    max: t,
    big,
    c: pickA([
      [255, 80, 80],
      [255, 210, 80],
      [120, 220, 255],
      [150, 255, 140],
      [255, 140, 220],
      [255, 255, 255],
      [200, 120, 255]
    ])
  });
}
function burst(r) {
  const n = r.big ? 70 : 40,
    sp = r.big ? 16 : 11;
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283,
      b = Math.acos(2 * R() - 1);
    const v = sp * (0.6 + R() * 0.4);
    EVX.push({
      x: r.x,
      y: r.y,
      z: r.z,
      vx: Math.cos(a) * Math.sin(b) * v,
      vy: Math.sin(a) * Math.sin(b) * v,
      vz: Math.cos(b) * v,
      life: 1.4 + R() * 0.8,
      max: 2.2,
      c: i % 7 === 0 ? [255, 255, 240] : r.c
    });
  }
}

function stepEvents(dt) {
  const ev = evNow();
  evToast(ev);
  EVSTATE.key = ev.join(',');
  const vr = viewRect(200);
  stepLeaving();
  if (!ev.includes('menning') && EVSTATE.mc) {
    EVSTATE.mc = 0;
    disperse(agents.filter(a => a.event === 'menning' && !a.dead));
  }
  if (ev.includes('menning')) EVSTATE.mc = 1;
  // fireworks: everyone on New Year's Eve (madness at midnight), a big show over the harbour on Culture Night
  if (ev.includes('nye') || ev.includes('menningfw') || ev.includes('thirteenth')) {
    const h = (gameMin % 1440) / 60,
      mid = ev.includes('nye')
        ? h >= 23.5 || h < 0.6
          ? 1
          : h >= 23
            ? 0.5
            : 0.18
        : ev.includes('menningfw')
          ? 1
          : 0.2;
    const n =
      dt * mid * (ev.includes('menningfw') ? 6 : Math.min(40, ((vr[2] - vr[0]) * (vr[3] - vr[1])) / 1e5));
    for (let q = 0; q < n || (R() < n % 1 && q < 1); q++) {
      let x, y;
      if (ev.includes('menningfw')) {
        const p = LL(64.1515, -21.932);
        x = p[0] + (R() - 0.5) * 120;
        y = p[1] + (R() - 0.5) * 60;
      } else {
        x = vr[0] + R() * (vr[2] - vr[0]);
        y = vr[1] + R() * (vr[3] - vr[1]);
        const c = cellAt(x, y);
        if (c < 0 || isWaterT(gTfast(c))) continue;
      }
      rocket(x, y, hAt(x, y), ev.includes('menningfw') || R() < 0.08);
    }
  }
  for (let i = EVX.length - 1; i >= 0; i--) {
    const p = EVX[i];
    p.life -= dt;
    if (p.rk) {
      p.z += p.vz * dt;
      if (R() < 0.6)
        EVX.push({
          x: p.x,
          y: p.y,
          z: p.z,
          vx: 0,
          vy: 0,
          vz: -1,
          life: 0.4,
          max: 0.4,
          c: [255, 200, 120],
          trail: 1
        });
      if (p.life <= 0) {
        burst(p);
        EVX[i] = EVX[EVX.length - 1];
        EVX.pop();
      }
      continue;
    }
    if (p.life <= 0) {
      EVX[i] = EVX[EVX.length - 1];
      EVX.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= 4 * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
  if (EVX.length > 3000) EVX.splice(0, EVX.length - 3000);
  // fireworks and bonfires placed with the People tool
  for (let i = EVSTATE.shows.length - 1; i >= 0; i--) {
    const sh = EVSTATE.shows[i];
    if (time > sh.until) {
      EVSTATE.shows.splice(i, 1);
      continue;
    }
    const z = hAt(sh.x, sh.y);
    if (sh.kind === 'fw') {
      if (R() < dt * 5) rocket(sh.x + (R() - 0.5) * 60, sh.y + (R() - 0.5) * 60, z, R() < 0.3);
    } else {
      for (let q = 0; q < 3; q++)
        addP({
          t: 2,
          x: sh.x + (R() - 0.5) * 7,
          y: sh.y + (R() - 0.5) * 7,
          z: z + R() * 4,
          vx: (R() - 0.5) * 2,
          vy: (R() - 0.5) * 2,
          vz: 5 + R() * 7,
          life: 0.8 + R() * 0.6,
          max: 1.4,
          c: (R() * 3) | 0,
          s: 2.2
        });
      if (R() < dt * 6) smoke(sh.x, sh.y, z + 8, true, 1, 6);
    }
  }
  // bonfires
  if (ev.includes('brenna'))
    for (const [n, la, lo] of BRENNUR) {
      const p = LL(la, lo);
      if (p[0] < vr[0] || p[0] > vr[2] || p[1] < vr[1] || p[1] > vr[3]) continue;
      const z = hAt(p[0], p[1]);
      for (let q = 0; q < 3; q++)
        addP({
          t: 2,
          x: p[0] + (R() - 0.5) * 8,
          y: p[1] + (R() - 0.5) * 8,
          z: z + R() * 4,
          vx: (R() - 0.5) * 2,
          vy: (R() - 0.5) * 2,
          vz: 5 + R() * 7,
          life: 0.8 + R() * 0.6,
          max: 1.4,
          c: (R() * 3) | 0,
          s: 2.2
        });
      if (R() < dt * 6) smoke(p[0], p[1], z + 8, true, 1, 6);
    }
  // crowds downtown
  EVSTATE.crowdT -= dt;
  if (EVSTATE.crowdT <= 0) {
    EVSTATE.crowdT = 1.2;
    if (ev.includes('menning')) evCrowd('menning', vr);
  }
  for (const e of ['jun17', 'pride'])
    if (ev.includes(e)) stepParade(e, dt);
    else if (PARADE[e] && PARADE[e].on) endParade(e);
  const h = (gameMin % 1440) / 60;
  stepConcertTimer();
  if (ev.includes('menning') && h >= 19.5) stepConcert(dt);
  else if (CONCERT.on && CONCERT.menning) endConcert();
}
/* ---- parades: 17. júní (brass band, scouts with flags, families with balloons) and the Pride parade with its floats ---- */
// 17. júní: down Skólavörðustígur from Hallgrímskirkja; Pride: down Laugavegur; both then Bankastræti, Lækjargata and Fríkirkjuvegur to Hljómskálagarður
const PARADE_WP = {
  jun17: [
    [64.1421, -21.9268],
    [64.1466, -21.935],
    [64.144, -21.9384],
    [64.142, -21.9392]
  ],
  pride: [
    [64.1442, -21.9245],
    [64.1466, -21.935],
    [64.144, -21.9384],
    [64.142, -21.9392]
  ]
};
const PARADE_ST = {
  jun17: ['Skólavörðustígur', 'Bankastræti', 'Lækjargata', 'Fríkirkjuvegur', 'Lækjartorg'],
  pride: ['Laugavegur', 'Bankastræti', 'Lækjargata', 'Fríkirkjuvegur', 'Lækjartorg']
};
function streetRoute(a, b, names) {
  // Dijkstra over the walking graph, strongly preferring the named streets
  const ok = new Uint8Array(NODE_N);
  for (const w of WAYS) if (w.name && names.includes(w.name)) for (const n of w.nodes) ok[n] = 1;
  const g = new Map(),
    par = new Map(),
    heap = [[0, a]];
  g.set(a, 0);
  let it = 0;
  while (heap.length && it++ < 200000) {
    heap.sort((x, y) => y[0] - x[0]);
    const [f, n] = heap.pop();
    if (n === b) break;
    if (f > g.get(n)) continue;
    for (let e = GW.off[n]; e < GW.off[n + 1]; e++) {
      const m = GW.to[e];
      const c = GW.wt[e] * (ok[n] && ok[m] ? 1 : 30);
      const ng = f + c;
      if (ng < (g.has(m) ? g.get(m) : 1e18)) {
        g.set(m, ng);
        par.set(m, n);
        heap.push([ng, m]);
      }
    }
  }
  if (!par.has(b)) return astar(GW, a, b, 20000);
  const out = [b];
  let n = b;
  while (n !== a) {
    n = par.get(n);
    out.push(n);
  }
  return out.reverse();
}
const PARADE = {};
const RAINBOW = [
  [228, 3, 3],
  [255, 140, 0],
  [255, 237, 0],
  [0, 128, 38],
  [36, 64, 142],
  [115, 41, 130]
];
function paradeRoute(e) {
  const P = PARADE[e] || (PARADE[e] = {});
  if (P.route) return P.route;
  const W = PARADE_WP[e].map(q => LL(q[0], q[1]));
  let path = [];
  for (let i = 1; i < W.length; i++) {
    const a = nearestNode(W[i - 1][0], W[i - 1][1], GW, 80),
      b = nearestNode(W[i][0], W[i][1], GW, 80);
    const seg = streetRoute(a, b, PARADE_ST[e]);
    if (!seg) continue;
    if (path.length) seg.shift();
    path = path.concat(seg);
  }
  P.route = path;
  let minx = 1e9,
    maxx = -1e9,
    miny = 1e9,
    maxy = -1e9;
  for (const n of path) {
    minx = Math.min(minx, NX[n]);
    maxx = Math.max(maxx, NX[n]);
    miny = Math.min(miny, NY[n]);
    maxy = Math.max(maxy, NY[n]);
  }
  P.bb = [minx, miny, maxx, maxy];
  // where the flags go: both sides of the route every 18 m
  P.flags = [];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      L = Math.hypot(NX[b] - NX[a], NY[b] - NY[a]);
    const ux = (NX[b] - NX[a]) / (L || 1),
      uy = (NY[b] - NY[a]) / (L || 1);
    for (let t = acc; t < L; t += 18) {
      const x = NX[a] + ux * t,
        y = NY[a] + uy * t;
      for (const sd of [-1, 1]) {
        const fx = x - uy * sd * 7.5,
          fy = y + ux * sd * 7.5;
        if (!inBld(fx, fy)) P.flags.push([fx, fy, Math.atan2(uy, ux)]);
      }
    }
    acc = (acc - L) % 18;
    if (acc < 0) acc += 18;
  }
  return path;
}
function paradeUnit(e, i) {
  if (e === 'pride') return i % 9 === 0 ? 'float' : 'march';
  const c = i % 40;
  return c < 10 ? 'band' : c < 18 ? 'scout' : 'family';
}
function spawnRank(e, P, pi) {
  const kind = paradeUnit(e, P.n);
  if (kind === 'float') {
    spawnMarcher(e, P, pi, 0);
    return;
  }
  const m = kind === 'band' ? 4 : 5;
  for (let i = 0; i < m; i++) spawnMarcher(e, P, pi, (i - (m - 1) / 2) * 1.6 + (R() - 0.5) * 0.4);
  P.n++;
}
function spawnMarcher(e, P, pi, off) {
  const route = P.route;
  const kind = paradeUnit(e, P.n);
  if (kind === 'float') P.n++;
  const n = route[pi];
  if (kind === 'float') {
    const a = mkAgent('car', NX[n], NY[n]);
    setVT(a, 'lorry');
    a.c = RAINBOW[((P.n / 9) | 0) % 6];
    a.path = route;
    a.pi = pi;
    a.t = 0;
    a.sp = 2.5;
    a.parade = e;
    a.event = e;
    a.keep = 1;
    a.vname = 'Vagn · Pride float';
    a.act = 'Pride float';
    a.float = 1;
    agents.push(a);
    return;
  }
  const a = mkAgent('walk', NX[n], NY[n]);
  a.path = route;
  a.pi = pi;
  a.t = R() * 0.5;
  a.sp = 1.15;
  a.side = off > 0 ? 1 : -1;
  a.wob = off;
  a.parade = e;
  a.event = e;
  a.keep = 1;
  if (kind === 'band') {
    a.shirt = [24, 44, 96];
    a.pants = [24, 30, 50];
    a.hat = [240, 240, 236];
    a.coat = null;
    a.act = 'Playing in Lúðrasveit Reykjavíkur';
    a.horn = 1;
  } else if (kind === 'scout') {
    a.shirt = [70, 100, 64];
    a.pants = [50, 60, 50];
    a.hat = null;
    a.act = 'Carrying the flag in the 17. júní parade';
    a.carry = 'is';
  } else if (kind === 'family') {
    a.act = 'Walking in the 17. júní parade';
    if (R() < 0.45) {
      a.scale = 0.66;
      a.age = 4 + ((R() * 8) | 0);
      a.balloon = pickA([
        [230, 40, 50],
        [40, 90, 200],
        [250, 250, 250],
        [250, 200, 40],
        [60, 180, 90],
        [240, 110, 180]
      ]);
      a.act = 'Out with a balloon on 17. júní';
    }
    if (R() < 0.25) a.carry = 'is';
  } else {
    a.shirt = pickA(RAINBOW);
    a.act = 'Marching in Gleðigangan, the Pride parade';
    if (R() < 0.35) a.carry = 'rb';
    if (R() < 0.15) a.balloon = pickA(RAINBOW);
  }
  agents.push(a);
}
function stepParade(e, dt) {
  const route = paradeRoute(e);
  if (route.length < 5) return;
  const P = PARADE[e],
    vr = viewRect(600);
  const near = !(P.bb[2] < vr[0] || P.bb[0] > vr[2] || P.bb[3] < vr[1] || P.bb[1] > vr[3]);
  if (!near) {
    if (P.on) endParade(e);
    return;
  }
  if (!P.on) {
    P.on = 1;
    P.n = 0;
    P.t = 0;
    closeRoute(route, 1);
    toast(
      e === 'pride'
        ? 'Gleðigangan · the Pride parade is coming down Lækjargata'
        : '17. júní · the parade is on its way'
    );
    for (let i = Math.floor(route.length * 0.92); i >= 0; i -= 2) spawnRank(e, P, i); // already under way
  }
  P.t -= dt;
  if (P.t <= 0) {
    P.t = 1.4;
    spawnRank(e, P, 0);
  }
  P.st = (P.st || 0) - dt;
  if (P.st <= 0) {
    P.st = 0.8;
    const v2 = viewRect(500);
    for (const a of agents)
      if (a.spect && a.event === e && !a.dead && (a.x < v2[0] || a.x > v2[2] || a.y < v2[1] || a.y > v2[3])) {
        a.dead = true;
      }
    if (P.specDone) {
      for (let i = 1; i < route.length; i++) {
        const n = route[i];
        if (NX[n] < v2[0] || NX[n] > v2[2] || NY[n] < v2[1] || NY[n] > v2[3]) P.specDone[i] = 0;
      }
    }
    spectators(e, P, viewRect(120));
  }
  for (const a of agents)
    if (a.parade === e && !a.dead && !a.leaving && a.pi >= route.length - 2) disperse([a]);
}
function spectators(e, P, vr) {
  const route = P.route;
  if (!P.specDone) P.specDone = new Uint8Array(route.length);
  let made = 0,
    alive = 0;
  for (const a of agents) if (a.spect && a.event === e && !a.dead) alive++;
  if (alive > 850) return;
  for (let i = 1; i < route.length && made < 260; i++) {
    if (P.specDone[i]) continue;
    const a = route[i - 1],
      b = route[i];
    const mx = (NX[a] + NX[b]) / 2,
      my = (NY[a] + NY[b]) / 2;
    if (mx < vr[0] || mx > vr[2] || my < vr[1] || my > vr[3]) continue;
    P.specDone[i] = 1;
    const L = Math.hypot(NX[b] - NX[a], NY[b] - NY[a]);
    if (L < 0.5) continue;
    const ux = (NX[b] - NX[a]) / L,
      uy = (NY[b] - NY[a]) / L,
      cl = edgeClass(GD, a, b),
      hw = (RW[cl] || 6) / 2;
    if (GD.off[a] === GD.off[a + 1]) continue; // only along streets, not park paths
    for (let t = 0.5; t < L; t += 1)
      for (const sd of [-1, 1])
        for (let row = 0; row < 2; row++) {
          if (R() < (row === 0 ? 0.3 : 0.65)) continue;
          const d = hw + 0.9 + row * 0.8 + (R() - 0.5) * 0.3,
            x = NX[a] + ux * t - uy * sd * d,
            y = NY[a] + uy * t + ux * sd * d;
          if (inBld(x, y)) continue;
          const p = mkAgent('walk', x, y);
          p.keep = 1;
          p.event = e;
          p.spect = 1;
          p.state = 'idle';
          p.idle = 1e9;
          p.path = null;
          p.vx = uy * sd;
          p.vy = -ux * sd;
          p.act = e === 'pride' ? 'Cheering on the Pride parade' : 'Watching the 17. júní parade';
          if (e === 'jun17' && R() < 0.3) {
            p.scale = 0.66;
            p.age = 5 + ((R() * 7) | 0);
            p.balloon = pickA([
              [230, 40, 50],
              [40, 90, 200],
              [250, 250, 250],
              [250, 200, 40]
            ]);
          }
          if (e === 'pride' && R() < 0.2) p.carry = 'rb';
          if (e === 'jun17' && R() < 0.2) p.carry = 'is';
          agents.push(p);
          made++;
        }
  }
}
/* when an event ends the crowd drifts away a few at a time, then the normal culling removes them off-screen */
const LEAVING = [];
function disperse(list) {
  for (const a of list) {
    if (a.dead || a.leaving) continue;
    a.leaving = 1;
    LEAVING.push([a, time + R() * 25]);
  }
}
function stepLeaving() {
  for (let i = LEAVING.length - 1; i >= 0; i--) {
    const [a, t] = LEAVING[i];
    if (time < t) continue;
    LEAVING.splice(i, 1);
    if (a.dead) continue;
    if (a.car) {
      a.parade = null;
      a.keep = 0;
      a.event = null;
      continue;
    }
    a.zone = null;
    a.zk = null;
    a.keep = 0;
    a.event = null;
    a.parade = null;
    a.spect = 0;
    a.crowd = null;
    a.state = 'walk';
    a.idle = 0;
    const s0 = nearestNode(a.x, a.y, GW, 60),
      t0 = nearestNode(a.x + (R() - 0.5) * 900, a.y + (R() - 0.5) * 900, GW, 200);
    const pth = s0 >= 0 && t0 >= 0 ? astar(GW, s0, t0, 6000) : null;
    if (pth && pth.length > 1) {
      a.path = pth;
      a.pi = 0;
      a.t = 0;
      a.act = 'Heading home';
    } else a.dead = true;
  }
}
function endParade(e) {
  const P = PARADE[e];
  if (P) {
    if (P.on && P.route) closeRoute(P.route, 0);
    P.on = 0;
    P.specDone = null;
  }
  disperse(agents.filter(a => a.event === e && !a.dead));
}
/* ---- Menningarnótt: the big evening concert on Arnarhóll ---- */
const CONCERT = { on: 0 };
function stepConcertTimer() {
  if (CONCERT.on && CONCERT.until && time > CONCERT.until) endConcert();
}
function startConcert(st, c, n, act, life) {
  if (CONCERT.on) endConcert(true);
  CONCERT.on = 1;
  CONCERT.fade = 0;
  const ang = Math.atan2(st[1] - c[1], st[0] - c[0]);
  CONCERT.ang = ang;
  CONCERT.x = st[0];
  CONCERT.y = st[1];
  CONCERT.until = life ? time + life : 0;
  CONCERT.t0 = time;
  const R0 = 36,
    poly = rotPoly(c[0], c[1], ang, -R0, R0 * 0.85, -R0 * 0.9, R0 * 0.9);
  const A = mkArea(0, 0, '', poly);
  A.custom = 1;
  A.until = time + 1e9;
  A.kind = 'concert';
  CONCERT.A = A;
  for (let i = 0; i < n; i++) {
    let px, py;
    for (let q = 0; q < 10; q++) {
      const u = -R0 + R() * R0 * 1.75,
        v = (R() - 0.5) * R0 * 1.7;
      px = c[0] + u * Math.cos(ang) - v * Math.sin(ang);
      py = c[1] + u * Math.sin(ang) + v * Math.cos(ang);
      if (!inBld(px, py)) break;
    }
    if (inBld(px, py)) continue;
    const a = mkAgent('walk', px, py);
    applyLook(a, mkPersona({ cx: px, cy: py, kind: 0, seed: 0.5, area: 150 }, 16 + ((R() * 40) | 0)));
    a.scooter = a.bike = 0;
    a.zone = A;
    a.keep = 1;
    a.zk = 'play';
    a.state = 'zone';
    a.tx = px;
    a.ty = py;
    a.zt = R() * 3;
    A.ag++;
    a.crowd = 'concert';
    a.event = 'concert';
    a.act = act;
    a.vx = Math.cos(ang);
    a.vy = Math.sin(ang);
    agents.push(a);
  }
  ZONES.add(A); // the band
  CONCERT.band = [
    { u: -3.6, v: 0, role: 'sing', col: [230, 60, 80] },
    { u: -2.6, v: -4.2, role: 'gtr', col: [40, 40, 44] },
    { u: -2.4, v: 4.4, role: 'bass', col: [240, 240, 236] },
    { u: 2.6, v: 0, role: 'drums', col: [60, 90, 160] },
    { u: 1.6, v: 5.6, role: 'keys', col: [220, 180, 60] }
  ];
}
function stepConcert(dt) {
  const st = LL(64.14808, -21.93398),
    hill = LL(64.148, -21.93305),
    c = [st[0] + (hill[0] - st[0]) * 0.75, st[1] + (hill[1] - st[1]) * 0.75];
  const vr = viewRect(500);
  if (c[0] < vr[0] || c[0] > vr[2] || c[1] < vr[1] || c[1] > vr[3]) {
    if (CONCERT.on && CONCERT.menning) endConcert();
    return;
  }
  if (CONCERT.on) return;
  startConcert(st, c, 300, 'At the Menningarnótt concert on Arnarhóll', 0);
  CONCERT.menning = 1;
  toast('Menningarnótt · the big concert on Arnarhóll has started');
}
function concertTool(x, y) {
  const ang = roadAngle(x, y) + Math.PI / 2;
  const c = [x - Math.cos(ang) * 30, y - Math.sin(ang) * 30];
  startConcert([x, y], c, 220, 'At an outdoor concert', 150);
  CONCERT.menning = 0;
  toast('Tónleikar · a stage goes up and a band starts to play');
}
function endConcert(now) {
  CONCERT.on = 0;
  CONCERT.fade = now ? 0 : 1;
  const L = agents.filter(a => a.event === 'concert' && !a.dead);
  if (now) for (const a of L) a.dead = true;
  else disperse(L);
}
function drawStage() {
  if ((!CONCERT.on && !CONCERT.fade) || K < 0.4) return;
  if (!CONCERT.on) {
    CONCERT.fade = Math.max(0, CONCERT.fade - 0.002);
    if (!CONCERT.fade) return;
  }
  ctx.save();
  ctx.globalAlpha = CONCERT.on ? 1 : CONCERT.fade;
  drawStage0();
  ctx.restore();
}
function drawStage0() {
  const k = K,
    x = CONCERT.x,
    y = CONCERT.y,
    ang = CONCERT.ang,
    ca = Math.cos(ang),
    sa = Math.sin(ang),
    z = hAt(x, y);
  const P = (u, v, h) => {
    const X = x + u * ca - v * sa,
      Y = y + u * sa + v * ca;
    return [PXw(X, Y) * k - cx0, (PYw(X, Y) - z - h) * k - cy0];
  };
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
  const W = 9,
    D = 6;
  F(
    [
      [-D, -W, 1.6],
      [D, -W, 1.6],
      [D, W, 1.6],
      [-D, W, 1.6]
    ],
    C_([92, 88, 84], 1)
  );
  F(
    [
      [-D, -W, 0],
      [-D, W, 0],
      [-D, W, 1.6],
      [-D, -W, 1.6]
    ],
    C_([60, 58, 56], 1)
  );
  // LED wall at the back, playing colours
  const hue = (time * 40) % 360;
  F(
    [
      [D - 0.5, -W * 0.8, 2],
      [D - 0.5, W * 0.8, 2],
      [D - 0.5, W * 0.8, 8.5],
      [D - 0.5, -W * 0.8, 8.5]
    ],
    'hsl(' + hue + ',70%,' + (night ? 55 : 40) + '%)'
  );
  for (const [u, v] of [
    [-D, -W],
    [-D, W],
    [D, -W],
    [D, W]
  ]) {
    const a = P(u, v, 1.6),
      b = P(u, v, 11);
    ctx.strokeStyle = C_([170, 172, 176], 1);
    ctx.lineWidth = Math.max(1, k * 0.4);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  {
    const r = [
      [-D - 1, -W - 1, 11],
      [D + 1, -W - 1, 11],
      [D + 1, W + 1, 11],
      [-D - 1, W + 1, 11]
    ];
    ctx.save();
    ctx.globalAlpha *= 0.55;
    F(r, C_([150, 152, 158], 1));
    ctx.restore();
    ctx.strokeStyle = C_([180, 182, 186], 1);
    ctx.lineWidth = Math.max(1, k * 0.3);
    ctx.beginPath();
    r.forEach((q, i) => {
      const s = P(q[0], q[1], q[2]);
      i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
    });
    ctx.closePath();
    ctx.stroke();
  }
  for (const v of [-W - 1.8, W + 1.8])
    F(
      [
        [-D, v - 1, 0],
        [-D + 2, v - 1, 0],
        [-D + 2, v - 1, 6],
        [-D, v - 1, 6]
      ],
      C_([20, 20, 22], 1)
    ); // speaker stacks
  // performers and the light show after dark
  // the band: singer at the mic, guitar, bass, drums on a riser, keys
  const band = (CONCERT.band || []).slice().sort((a, b) => {
    const pa = P(a.u, a.v, 0),
      pb = P(b.u, b.v, 0);
    return pa[1] - pb[1];
  });
  const pp = Math.max(1, Math.round(k / 3.7));
  for (const m of band) {
    const riser = m.role === 'drums' ? 0.6 : 0;
    const bounce = m.role === 'drums' ? 0 : Math.sin(time * 8 + m.u * 3) > 0.5 ? 1 : 0;
    const s0 = P(m.u, m.v, 1.6 + riser);
    const X = Math.round(s0[0]),
      Y = Math.round(s0[1]) - bounce * pp;
    const R2 = (gx, gy, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(X + gx * pp, Y - (gy + h) * pp, w * pp, h * pp);
    };
    if (m.role === 'drums') {
      const rs = P(m.u, m.v, 1.6);
      ctx.fillStyle = C_([40, 40, 44], 1);
      ctx.fillRect(Math.round(rs[0]) - 5 * pp, Math.round(rs[1]) - 2 * pp, 10 * pp, 2 * pp);
      R2(-5, 0, 4, 3, C_([200, 40, 40], 1));
      R2(1, 0, 4, 3, C_([200, 40, 40], 1));
      R2(-2, 0, 4, 4, C_([230, 230, 226], 1));
      R2(-6, 5, 3, 1, C_([230, 200, 90], 1));
      R2(3, 6, 3, 1, C_([230, 200, 90], 1));
    }
    if (m.role === 'keys') {
      R2(-4, 4, 8, 1, C_([30, 30, 32], 1));
      R2(-4, 5, 8, 1, C_([240, 240, 236], 1));
      R2(-3, 0, 1, 4, C_([60, 60, 64], 1));
      R2(2, 0, 1, 4, C_([60, 60, 64], 1));
    }
    const front = faces(-ca, -sa) > 0; // audience side toward us: we see their faces
    R2(-1, 0, 1, 4, C_([40, 40, 50], 1));
    R2(1, 0, 1, 4, C_([40, 40, 50], 1));
    R2(-1, 4, 3, 5, C_(m.col, 1));
    R2(-1, 9, 3, 2, C_(front ? [226, 190, 160] : m.role === 'sing' ? [240, 200, 80] : [60, 40, 30], 1));
    R2(-1, 11, 3, 1, C_(m.role === 'sing' ? [240, 200, 80] : [60, 40, 30], 1));
    if (front && k >= 2) {
      R2(-1, 10, 1, 1, C_([30, 30, 30], 1));
      R2(1, 10, 1, 1, C_([30, 30, 30], 1));
    }
    const arm = Math.sin(time * (m.role === 'drums' ? 14 : 6) + m.v) > 0 ? 1 : 0;
    if (m.role === 'gtr' || m.role === 'bass') {
      R2(-2, 5, 6, 2, C_(m.role === 'gtr' ? [180, 50, 40] : [230, 230, 226], 1));
      R2(4, 6 + arm, 3, 1, C_([90, 60, 40], 1));
    }
    if (m.role === 'sing') {
      R2(3, 0, 1, 9, C_([90, 90, 96], 1));
      R2(3, 9, 1, 1, C_([30, 30, 30], 1));
      R2(2, 7 + arm, 1, 2, C_([226, 190, 160], 1));
    }
    if (m.role === 'drums') {
      R2(-3, 8 + arm, 1, 2, C_([226, 190, 160], 1));
      R2(3, 8 + (1 - arm), 1, 2, C_([226, 190, 160], 1));
    }
  }
  if (nightK > 0.2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const s0 = P(-D, (i - 2.5) * 4, 11),
        a2 = time * 0.8 + i * 1.3;
      const tx = -D - 40 + Math.cos(a2) * 10,
        tv = (i - 2.5) * 9 + Math.sin(a2) * 14;
      const s1 = P(tx, tv, 0);
      const c = [
        [255, 60, 90],
        [80, 140, 255],
        [120, 255, 160],
        [255, 220, 80],
        [200, 90, 255],
        [90, 230, 255]
      ][i];
      const g = ctx.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);
      g.addColorStop(0, 'rgba(' + c + ',' + 0.5 * nightK + ')');
      g.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(s0[0], s0[1]);
      ctx.lineTo(s1[0] - k * 6, s1[1]);
      ctx.lineTo(s1[0] + k * 6, s1[1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
/* flags, balloons and things people carry */

function carried(a) {
  const k = K,
    z = hAt(a.x, a.y) + (a.dz || 0),
    s = sp_(a.x, a.y, z),
    H = 3.8 * k * (a.scale || 1);
  if (s[0] < -30 || s[0] > VW + 30 || s[1] < -60 || s[1] > VH + 30) return;
  const fl = (top, kind, fw, fh) => {
    const p = { seed: (a.id * 0.37) % 1, ang: 0 };
    const F = (pts, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      pts.forEach((q, i) => {
        const t = sp_(a.x + q[0], a.y + q[1], z + q[2]);
        i ? ctx.lineTo(t[0], t[1]) : ctx.moveTo(t[0], t[1]);
      });
      ctx.closePath();
      ctx.fill();
    };
    wavingFlag(F, p, top, kind, fw, fh);
  };
  if (a.float) {
    const b = sp_(a.x, a.y, z + 3),
      t = sp_(a.x, a.y, z + 7);
    ctx.strokeStyle = C_([230, 230, 230], 1);
    ctx.lineWidth = Math.max(1, k * 0.15);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(t[0], t[1]);
    ctx.stroke();
    fl(7, 'rb', 1.8, 1.2);
    for (let i = 0; i < 6; i++) {
      const q = sp_(a.x + (i - 2.5) * 0.6, a.y, z + 3.2);
      ctx.fillStyle = C_(RAINBOW[i], 1);
      ctx.fillRect(
        Math.round(q[0]),
        Math.round(q[1]),
        Math.max(1, (k * 0.6) | 0),
        Math.max(1, (k * 0.4) | 0)
      );
    }
    return;
  }
  if (a.balloon) {
    const bx = s[0] + k * 0.6 * (1 + Math.sin(time * 1.3 + a.id) * 0.3),
      by = s[1] - H * 1.6;
    ctx.strokeStyle = 'rgba(240,240,240,.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s[0] + k * 0.4, s[1] - H * 0.55);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.fillStyle = C_(a.balloon, 1);
    ctx.beginPath();
    ctx.ellipse(bx, by - k * 0.55, Math.max(1.5, k * 0.5), Math.max(2, k * 0.65), 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(
      Math.round(bx - k * 0.2),
      Math.round(by - k * 0.9),
      Math.max(1, (k * 0.15) | 0),
      Math.max(1, (k * 0.15) | 0)
    );
  }
  if (a.carry) {
    const st = 1.8 * (a.scale || 1);
    const b = sp_(a.x, a.y, z + 0.9 * (a.scale || 1)),
      t = sp_(a.x, a.y, z + st + 0.9);
    ctx.strokeStyle = C_([120, 100, 80], 1);
    ctx.lineWidth = Math.max(1, k * 0.12);
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(t[0], t[1]);
    ctx.stroke();
    fl(st + 0.9, a.carry, 0.75, 0.54);
  }
  if (a.horn) {
    ctx.fillStyle = C_([230, 190, 70], 1);
    ctx.fillRect(
      Math.round(s[0] + k * 0.4),
      Math.round(s[1] - H * 0.75),
      Math.max(1, (k * 0.6) | 0),
      Math.max(1, (k * 0.3) | 0)
    );
  }
}
let EVFLAGKEY = '';
function drawEventFlags() {
  const doy = curDOY();
  const kinds = [];
  if (doy === 167) kinds.push(['jun17', 61]);
  if (doy >= 213 && doy <= 226) kinds.push(['pride', 62]);
  const key = kinds.map(k => k[0]).join(',');
  if (key === EVFLAGKEY || !PROPS_OK) return;
  EVFLAGKEY = key;
  // take down last event's flags, put up today's
  PTS = PTS.filter(p => !p.evf);
  for (const l of PG2.values()) for (let i = l.length - 1; i >= 0; i--) if (l[i].evf) l.splice(i, 1);
  for (const [e, c] of kinds) {
    paradeRoute(e);
    const P = PARADE[e];
    let list = P.flags;
    if (e === 'jun17') {
      const ex = [];
      const cA = LL(64.14685, -21.94035);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.283;
        ex.push([cA[0] + Math.cos(a) * 42, cA[1] + Math.sin(a) * 30, a]);
      }
      const ah = LL(64.14812, -21.9333);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283;
        ex.push([ah[0] + Math.cos(a) * 38, ah[1] + Math.sin(a) * 30, a]);
      }
      list = list.concat(ex);
    }
    for (const f of list) if (!inBld(f[0], f[1])) addPt(c, f[0], f[1], f[2], '', { evf: 1, ph: 8 });
  }
}
function evCrowd(e, vr) {
  const s = EVSPOT[e];
  const c = LL(s[0], s[1]),
    r = s[2];
  if (c[0] < vr[0] - r || c[0] > vr[2] + r || c[1] < vr[1] - r || c[1] > vr[3] + r || K < 0.4) return;
  let n = 0;
  for (const a of agents) if (!a.dead && a.event === e) n++;
  const want = Math.min(160, Math.round(80 + K * 20));
  for (let q = 0; q < 10 && n < want; q++) {
    const x = c[0] + (R() - 0.5) * r * 2,
      y = c[1] + (R() - 0.5) * r * 2;
    const s0 = nearestNode(x, y, GW, 40);
    if (s0 < 0 || onScr(NX[s0], NY[s0], 20)) continue;
    const t = nearestNode(c[0] + (R() - 0.5) * r * 1.6, c[1] + (R() - 0.5) * r * 1.6, GW, 60);
    const pth = astar(GW, s0, t, 3000);
    if (!pth || pth.length < 2) continue;
    const a = mkAgent('walk', NX[s0], NY[s0]);
    a.path = pth;
    a.pi = 0;
    a.event = e;
    a.act =
      e === 'jun17'
        ? 'Celebrating 17. júní'
        : e === 'pride'
          ? 'Marching in the Pride parade'
          : 'Out on Culture Night';
    if (e === 'pride')
      a.shirt = pickA([
        [228, 40, 40],
        [255, 140, 0],
        [255, 237, 0],
        [0, 128, 38],
        [36, 64, 142],
        [115, 41, 130]
      ]);
    if (e === 'jun17' && R() < 0.5) {
      a.shirt = pickA([
        [2, 82, 156],
        [220, 30, 53],
        [255, 255, 255]
      ]);
      a.flag = 1;
    }
    agents.push(a);
    n++;
  }
}
function drawEvents() {
  if (EVX.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const k = K;
    for (const p of EVX) {
      const sx = PXw(p.x, p.y) * k - cx0,
        sy = (PYw(p.x, p.y) - p.z) * k - cy0;
      if (sx < -10 || sy < -10 || sx > VW + 10 || sy > VH + 10) continue;
      const f = Math.max(0, p.life / p.max);
      ctx.fillStyle =
        'rgba(' +
        p.c[0] +
        ',' +
        p.c[1] +
        ',' +
        p.c[2] +
        ',' +
        (p.rk ? 1 : p.trail ? f * 0.6 : Math.min(1, f * 1.6)) +
        ')';
      const s = p.rk ? 2 : Math.max(1, Math.round(Math.min(3, k * 0.5 + 1)));
      ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
    }
    ctx.restore();
  }
  if (evNow().includes('xmas') && nightK > 0.2) drawXmas();
}
/* Christmas: strings of lights along the eaves at night, and the big tree on Austurvöllur */
const XCOL = [
  [255, 214, 140],
  [255, 70, 60],
  [80, 210, 100],
  [80, 150, 255],
  [255, 200, 40],
  [255, 110, 200],
  [255, 70, 60],
  [80, 210, 100]
];
function drawXmas() {
  const k = K;
  if (k < 0.6) return;
  const vr = viewRect(10);
  let nb = 0;
  eachB(BBUCK, vr[0], vr[1], vr[2], vr[3], b => {
    if (nb > 600 || b.state > 1 || b.kind > 3 || b.base > 0 || h32(b.id, 3, 71) > 0.6) return;
    nb++;
    const P = b.poly,
      n = b.n,
      z = b.z + b.h;
    const col = h32(b.id, 4, 72) < 0.2 ? 0 : 1;
    for (let j = 0; j < n; j++) {
      const q = (j + 1) % n;
      const ex = P[2 * q] - P[2 * j],
        ey = P[2 * q + 1] - P[2 * j + 1],
        L = Math.hypot(ex, ey);
      if (faces(ey, -ex) <= 0) continue;
      const m = Math.min(30, Math.floor(L / 1.4));
      for (let i = 0; i < m; i++) {
        const t = (i + 0.5) / m,
          x = P[2 * j] + ex * t,
          y = P[2 * j + 1] + ey * t;
        const sx = PXw(x, y) * k - cx0,
          sy = (PYw(x, y) - z) * k - cy0 + Math.sin(t * Math.PI * m * 0.5) * k * 0.15;
        const c = col ? XCOL[(i + j) % XCOL.length] : XCOL[0];
        const tw = 0.75 + 0.25 * Math.sin(time * 3 + i * 1.7 + b.id);
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + nightK * tw + ')';
        const ds = Math.max(2, Math.round(k * 0.55));
        ctx.fillRect(Math.round(sx - ds / 2), Math.round(sy - ds / 2), ds, ds);
      }
    }
  });
  // Oslóartréð on Austurvöllur
  const T = LL(64.14695, -21.94035);
  if (T[0] > vr[0] && T[0] < vr[2] && T[1] > vr[1] && T[1] < vr[3]) {
    const z = hAt(T[0], T[1]);
    const s0 = sp_(T[0], T[1], z);
    ctx.fillStyle = C_([24, 70, 40], 1);
    ctx.beginPath();
    ctx.moveTo(s0[0], s0[1] - 12 * k);
    ctx.lineTo(s0[0] - 4 * k, s0[1]);
    ctx.lineTo(s0[0] + 4 * k, s0[1]);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 40; i++) {
      const t = h32(i, 1, 73),
        u = h32(i, 2, 74) - 0.5;
      const yy = s0[1] - 12 * k * t,
        xx = s0[0] + u * 8 * k * (1 - t);
      ctx.fillStyle = 'rgba(255,222,150,' + (0.6 + 0.4 * Math.sin(time * 2 + i)) + ')';
      ctx.fillRect(Math.round(xx), Math.round(yy), Math.max(1, (k * 0.4) | 0), Math.max(1, (k * 0.4) | 0));
    }
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(
      Math.round(s0[0] - k * 0.5),
      Math.round(s0[1] - 12.6 * k),
      Math.max(2, k | 0),
      Math.max(2, k | 0)
    );
  }
}
/* jump the clock to an event */
function gotoEvent(e) {
  SEASON_MODE = 'auto';
  const ss = $('#season');
  if (ss) ss.value = 'auto';
  const W = {
    jun17: [167, 167, 13.5],
    pride: [219, 225, 14, 6],
    menning: [229, 235, 22.95, 6],
    xmas: [355, 355, 18],
    nye: [364, 364, 23.7],
    thirteenth: [5, 5, 18.5]
  }[e];
  if (!W) return;
  let n = Math.floor(gameMin / 1440) + 1;
  for (let i = 0; i < 365 * 8; i++, n++) {
    const doy = (DOY0 + n) % 365;
    if (doy < W[0] || doy > W[1]) continue;
    if (W[3] !== undefined && (DAY0 + n) % 7 !== W[3]) continue;
    break;
  }
  gameMin = n * 1440 + W[2] * 60;
  applySeason(true);
  lighting();
  snowAcc = 0;
  EVSTATE.toast = '';
  const go = {
    jun17: [64.1468, -21.9375, 1.6],
    pride: [64.1459, -21.9365, 1.6],
    menning: [64.15, -21.933, 1],
    xmas: [64.1466, -21.9405, 2.2],
    nye: [64.14, -21.93, 0.7],
    thirteenth: [64.1408, -21.9655, 1.4]
  }[e];
  if (go) __goLL(go[0], go[1], go[2]);
}
