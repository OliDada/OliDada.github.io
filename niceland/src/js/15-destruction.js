/**
 * Destruction, fire and lava
 *
 * Destroying and rebuilding buildings, fire spread and fire engines, lava flows and volcanoes.
 *
 * Functions: groupOf, destroyB, destroyOne, wipeB, clearCells, ignite, igniteTree, killTree, killA,
 *     killNear, setCell, cellsIn, explode, lavaSplash, stepLava, volcano, stepVolc, areaCalm, workHours,
 *     stepRebuild, requestTruck, dispatchTruck
 * State and constants: rbAcc, CREWS, STATIONS, trucksBusy
 */

function groupOf(b) {
  if (!b.group) return [b];
  const out = [];
  nearB(b.cx, b.cy, 120, o => {
    if (o.group === b.group && o.state !== 9) out.push(o);
  });
  return out;
}
function destroyB(b, boom, silent) {
  for (const o of groupOf(b)) destroyOne(o, boom);
  if (!silent && b.name) toast(b.name + (boom ? ' destroyed' : ' has collapsed'));
}
function destroyOne(b, boom) {
  if (b.state === 2 || b.state === 9) return;
  const top = b.z + b.base + b.h;
  const n = Math.min(50, 8 + b.area / 20);
  for (let i = 0; i < n; i++) {
    const c = R() < 0.5 ? b.wallC : b.roofC;
    addP({
      t: 2,
      g: 1,
      x: b.minx + R() * (b.maxx - b.minx),
      y: b.miny + R() * (b.maxy - b.miny),
      z: b.z + R() * (top - b.z),
      vx: (R() - 0.5) * (boom ? 30 : 6),
      vy: (R() - 0.5) * (boom ? 30 : 6),
      vz: R() * (boom ? 30 : 6),
      life: 1.6 + R(),
      max: 2.6,
      c,
      s: 1.6
    });
  }
  dust(b.cx, b.cy, b.z, Math.min(24, 6 + b.area / 40), b.r * 1.5);
  b.state = 2;
  b.fire = 0;
  burning.delete(b);
  b.hp = 0;
  b.prog = 1;
  rubbleList.push({ b, t: 25 + R() * 35 });
  dirtyB(b);
  statsDirty = true;
  for (const a of agents) if (!a.dead && Math.hypot(a.x - b.cx, a.y - b.cy) < b.r + 4) killA(a);
}
function wipeB(b) {
  if (b.state < 9) {
    destroyB(b, false, true);
    b.state = 9;
    if (inF(b.cx, b.cy)) clearCells(b);
    dirtyB(b);
  }
}
function clearCells(b) {
  for (let j = Math.floor((b.miny - F.OY) / F.CS); j <= Math.floor((b.maxy - F.OY) / F.CS); j++)
    for (let i = Math.floor((b.minx - F.OX) / F.CS); i <= Math.floor((b.maxx - F.OX) / F.CS); i++) {
      if (i < 0 || j < 0 || i >= F.W || j >= F.H) continue;
      const c = i + j * F.W;
      if (F.CBLD[c] === b.id) F.CBLD[c] = -1;
    }
}
/* gen: 0 for a fire that was started (by you, lightning, an explosion…), 1 for one that caught from a neighbour.
   Only a fire that was started spreads, and only to the buildings and trees touching it, so a house fire can take
   the house next door but does not run on down the street. */
function ignite(b, gen) {
  if (!b || b.state === 2 || b.state === 9 || b.fire > 0 || b.sp === 5) return;
  b.fire = 0.01;
  b.fgen = gen || 0;
  burning.add(b);
  dirtyB(b);
  hazards.push({ x: b.cx, y: b.cy, r: 60, t: 4, kind: 'fire' });
  requestTruck(b);
}
const TFGEN = new Map(); // tree index -> generation of its fire (as for buildings)
function igniteTree(i, gen) {
  if (TREES.s[i] === 0) {
    TFGEN.set(i, gen || 0);
    TREES.s[i] = 1;
    TREES.f[i] = 0;
    burningT.add(i);
    dirtyWorld(TREES.x[i], TREES.y[i], false, true);
  }
}
function killTree(t) {
  TREES.s[t] = 3;
  dirtyWorld(TREES.x[t], TREES.y[t], false, true);
}
function killA(a) {
  if (a.dead) return;
  a.dead = true;
  ghost(a.x, a.y, hAt(a.x, a.y));
  if (a === follow) {
    toast(a.name + ' did not make it');
    follow = null;
  }
}
function killNear(x, y, r) {
  for (const a of agents) if (!a.dead && (a.x - x) ** 2 + (a.y - y) ** 2 < r * r) killA(a);
  for (const a of animals) if (!a.dead && (a.x - x) ** 2 + (a.y - y) ** 2 < r * r) killA(a);
}
function setCell(c, t, h, cover) {
  if (c < 0) return;
  const H_ = h === undefined ? undefined : Math.max(-500, Math.min(3000, Math.round(h)));
  if (c < FN) {
    F.GT[c] = t;
    if (H_ !== undefined) F.HT[c] = H_;
    if (cover !== undefined) F.COVER[c] = cover;
  } else if (c >= DB) {
    const r = dRef(c, true);
    if (!r) return;
    const tl = r[0],
      i = r[1];
    tl.GT[i] = t;
    if (H_ !== undefined) tl.HT[i] = H_;
    if (cover !== undefined) tl.COVER[i] = cover;
    tl.mod = true;
  } else return;
  MOD_CELLS.add(c);
  dirtyCell(c, true, false);
}
function cellsIn(x, y, r, fn) {
  const rr = Math.max(r, 6);
  const i0 = Math.floor((x - rr) / 10),
    i1 = Math.floor((x + rr) / 10),
    j0 = Math.floor((y - rr) / 10),
    j1 = Math.floor((y + rr) / 10);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const cx = i * 10 + 5,
        cy = j * 10 + 5,
        d = Math.hypot(cx - x, cy - y);
      if (d > rr) continue;
      const c = cellAt(cx, cy);
      if (c >= 0) fn(c, d);
    }
}
function explode(x, y, r, crater) {
  shake = Math.min(2, shake + r / 40);
  const z = hAt(x, y);
  sparks(x, y, z + 2, Math.min(160, r * 3), r * 0.9);
  smoke(x, y, z + 3, true, Math.min(60, r), Math.max(3, r / 8));
  nearB(x, y, r * 2.2 + 40, b => {
    const d = Math.hypot(b.cx - x, b.cy - y);
    if (d < r + b.r * 0.4) destroyB(b, true, d > r * 0.5);
    else if (d < r * 2 + b.r && R() < 0.7) ignite(b);
  });
  nearT(x, y, r * 2, t => {
    const d = Math.hypot(TREES.x[t] - x, TREES.y[t] - y);
    if (d < r) killTree(t);
    else if (d < r * 1.8 && R() < 0.5) igniteTree(t);
  });
  cellsIn(x, y, r, (c, d) => {
    if (isWaterT(gT(c))) return;
    let nh = gH(c);
    if (crater && d < r * 0.8) nh = gH(c) - crater * (1 - d / (r * 0.8));
    if (nh <= 0) setCell(c, SEA, 0, 1);
    else setCell(c, d < r * 0.85 ? RUBBLE : gT(c), nh, d < r * 0.85 ? 1 : gCov(c));
  });
  killNear(x, y, r * 1.25);
  hazards.push({ x, y, r: r * 4 + 60, t: 6, kind: 'boom' });
  statsDirty = true;
}
function lavaSplash(x, y) {
  const c = cellAt(x, y);
  if (c < 0) return;
  const b = bldAtCell(c);
  if (b && b.state < 2) ignite(b);
  else if (!isWaterT(gT(c)) && gT(c) !== GLACIER && R() < 0.5) {
    sT(c, LAVA);
    sLH(c, 8);
    lavaTiles.add(c);
  }
}
function stepLava(dt) {
  const act = lavaActive;
  lavaActive = [];
  for (const c of act) {
    if (gT(c) !== LAVA || gLV(c) < 1) continue;
    if (R() > 0.45) {
      lavaActive.push(c);
      continue;
    }
    const src = srcSet.has(c),
      hc = gH(c),
      lv = gLV(c);
    for (const n of nb4(c)) {
      if (n < 0) continue;
      const tn = gT(n);
      if (isWaterT(tn)) {
        if (lv >= 2 && R() < 0.4) {
          setCell(n, ROCK, Math.max(1, gH(n)), 1);
          const [x, y] = cellCenter(n);
          for (let q = 0; q < 4; q++)
            addP({
              t: 1,
              x: x + (R() - 0.5) * 10,
              y: y + (R() - 0.5) * 10,
              z: hAt(x, y) + 1,
              vx: (R() - 0.5) * 2,
              vy: (R() - 0.5) * 2,
              vz: 6 + R() * 5,
              life: 2 + R(),
              max: 3,
              c: [236, 240, 244],
              s: 4,
              a: 0.75
            });
        }
        continue;
      }
      if (tn === GLACIER) {
        if (R() < 0.25) {
          setCell(n, LAKE, gH(n), 1);
          const [x, y] = cellCenter(n);
          addP({
            t: 1,
            x,
            y,
            z: hAt(x, y) + 1,
            vx: 0,
            vy: 0,
            vz: 8,
            life: 3,
            max: 3,
            c: [236, 240, 244],
            s: 6,
            a: 0.8
          });
        }
        continue;
      }
      const dh = gH(n) - hc;
      if (dh > (src ? 8 : 0)) continue;
      const nv = lv - (dh < 0 ? 0.15 : dh === 0 ? 1 : 0.5);
      if (nv < 0.6) continue;
      if (tn === LAVA && gLV(n) >= nv - 0.3) continue;
      eachBldInCell(n, b => {
        if (b.state < 9) {
          sparks(b.cx, b.cy, b.z + b.h, 10, 8);
          wipeB(b);
        }
      });
      const [x, y] = cellCenter(n);
      nearT(x, y, 8, t => {
        if (TREES.s[t] !== 3 && cellAt(TREES.x[t], TREES.y[t]) === n) killTree(t);
      });
      if (tn !== LAVA) {
        sT(n, LAVA);
        sLH(n, 16 + R() * 12);
        lavaTiles.add(n);
        sCov(n, 1);
        MOD_CELLS.add(n);
      } else sLH(n, Math.max(gLH(n), 16));
      sLV(n, nv);
      if (nv >= 1) lavaActive.push(n);
    }
    if (!src) sLV(c, 0);
  }
  for (const c of lavaTiles) {
    if (srcSet.has(c)) continue;
    const h = gLH(c) - dt * (rainT > 0 ? 2.5 : 1);
    sLH(c, h);
    if (h <= 0) {
      sT(c, ROCK);
      sLV(c, 0);
      lavaTiles.delete(c);
      dirtyCell(c, true, false);
    } else if (R() < 0.002) {
      const [x, y] = cellCenter(c);
      addP({
        t: 1,
        x,
        y,
        z: hAt(x, y) + 1,
        vx: 2,
        vy: -1,
        vz: 3,
        life: 3,
        max: 3,
        c: [90, 86, 84],
        s: 3,
        a: 0.5
      });
    }
  }
}
function volcano(x, y) {
  const fine = inF(x, y),
    R0 = fine ? 130 : 420,
    PK = fine ? 60 : 230,
    base = hAt(x, y);
  cellsIn(x, y, R0, (c, d) => {
    const nh = Math.min(3000, base + Math.max(0, PK * (1 - d / R0) ** 1.3));
    if (nh > gH(c) || isWaterT(gT(c)) || gT(c) === GLACIER) {
      setCell(c, ROCK, Math.max(nh, 1), 1);
    }
  });
  nearT(x, y, R0, killTree);
  nearB(x, y, R0 + 40, b => {
    if (b.state < 9 && Math.hypot(b.cx - x, b.cy - y) < R0 * 0.92) wipeB(b);
    else if (b.state < 9) {
      b.z = hAt(b.cx, b.cy);
      dirtyB(b);
    }
  });
  for (const a of animals) if (Math.hypot(a.x - x, a.y - y) < R0) a.dead = true;
  const c = cellAt(x, y);
  srcSet.add(c);
  volcanoes.push({ c, x, y, t: 34, pulse: 0, big: !fine });
  shake = Math.min(2, shake + 1);
  hazards.push({ x, y, r: fine ? 700 : 1800, t: 40, kind: 'volcano' });
  toast('Eldgos! Eruption near ' + placeName(x, y));
}
function stepVolc(dt) {
  for (let i = volcanoes.length - 1; i >= 0; i--) {
    const v = volcanoes[i];
    v.t -= dt;
    v.pulse -= dt;
    const big = v.big,
      z = hAt(v.x, v.y);
    if (v.pulse <= 0) {
      v.pulse = 0.5;
      sT(v.c, LAVA);
      sLV(v.c, big ? 34 : 24);
      sLH(v.c, 30);
      lavaTiles.add(v.c);
      lavaActive.push(v.c);
      smoke(v.x, v.y, z + 6, true, 6, big ? 20 : 8);
      for (let q = 0; q < 4; q++)
        addP({
          t: 4,
          g: 1,
          x: v.x,
          y: v.y,
          z: z + 4,
          vx: (R() - 0.5) * (big ? 90 : 40),
          vy: (R() - 0.5) * (big ? 90 : 40),
          vz: (30 + R() * 30) * (big ? 1.6 : 1),
          life: big ? 7 : 5,
          max: 5,
          c: q % 3,
          s: big ? 4 : 2.4
        });
      if (R() < 0.3) shake = Math.max(shake, 0.4);
    }
    if (v.t <= 0) {
      srcSet.delete(v.c);
      sLH(v.c, 20);
      volcanoes.splice(i, 1);
    }
  }
}
/* rebuilding: rubble waits until the area is calm (no fire, lava, quake or flood nearby), the dust has settled for a while,
   and a crew is free; crews work in daylight hours; clearing, foundations, then walls going up */
let rbAcc = 0;
const CREWS = 36;
function areaCalm(b) {
  if (quake) return false;
  for (const hz of hazards) if (Math.hypot(hz.x - b.cx, hz.y - b.cy) < hz.r + 120) return false;
  for (const v of volcanoes) if (Math.hypot(v.x - b.cx, v.y - b.cy) < 2500) return false;
  let hot = false;
  nearB(b.cx, b.cy, 140, o => {
    if (o.fire > 0) hot = true;
  });
  if (hot) return false;
  if (flood > b.z - 0.5) return false;
  for (let q = 0; q < 9; q++) {
    const c = cellAt(b.cx + ((q % 3) - 1) * 30, b.cy + (((q / 3) | 0) - 1) * 30);
    if (c >= 0 && gTfast(c) === LAVA) return false;
  }
  const c = cellAt(b.cx, b.cy);
  if (c >= 0 && (gT(c) === LAVA || isWaterT(gT(c)))) return false;
  return true;
}
function workHours() {
  const m = gameMin % 1440;
  return m >= 7 * 60 && m < 19.5 * 60;
}
function stepRebuild(dt) {
  rbAcc += dt;
  if (rbAcc < 1) return;
  const st = rbAcc;
  rbAcc = 0;
  if (rebuild) {
    let active = 0;
    for (const b of building) if (b.rb) active++;
    for (let i = rubbleList.length - 1; i >= 0; i--) {
      const r = rubbleList[i];
      if (r.b.state !== 2) {
        rubbleList.splice(i, 1);
        continue;
      }
      if (r.calm === undefined) {
        r.calm = 0;
        r.need = 50 + R() * 70;
      }
      if (areaCalm(r.b)) r.calm += st;
      else r.calm = 0;
      if (r.calm >= r.need && active < CREWS && workHours()) {
        for (const b of groupOf(r.b)) {
          if (b.state !== 2) continue;
          b.state = 3;
          b.prog = 0;
          b.hp = 100;
          b.rb = 1;
          if (!b.base) b.z = hAt(b.cx, b.cy);
          building.add(b);
          dirtyB(b);
        }
        rubbleList.splice(i, 1);
        active++;
      }
    }
  }
  for (const b of building) {
    if (b.rb && !workHours()) continue;
    const HH = b.gTop || b.h,
      T = b.rb ? 150 + b.area * 0.5 + HH * 10 : 30 + HH * 1.6;
    b.prog = Math.min(1, b.prog + st / T);
    if (b.prog >= 1) {
      b.prog = 1;
      b.state = 0;
      b.rb = 0;
      building.delete(b);
      statsDirty = true;
      dirtyB(b);
      dust(b.cx, b.cy, b.z, 3, b.r);
      continue;
    }
    if (b.prog < 0.12 && R() < 0.5) dust(b.cx + (R() - 0.5) * b.r, b.cy + (R() - 0.5) * b.r, b.z, 1, 3);
    if (Math.abs(b.prog - (b.lp || 0)) > 0.025) {
      b.lp = b.prog;
      dirtyB(b);
    }
  }
}
const STATIONS = [
  [64.1336, -21.9178],
  [64.118, -21.788],
  [64.149, -21.942],
  [64.104, -21.874],
  [65.683, -18.09],
  [63.933, -20.996],
  [64.005, -22.56],
  [66.074, -23.13],
  [65.264, -14.4]
];
let trucksBusy = new Set();
/* Fire engines respond to an incident, not to every burning building: one engine for a single house, more as the
   fire spreads (Slökkvilið höfuðborgarsvæðisins sends two or three to a house fire with others nearby), at most
   four, and engines already at the scene move on to the next burning building. */
const INCIDENT_R = 200;
function enginesNear(x, y) {
  let n = 0;
  for (const a of agents)
    if (a.kind === 'truck' && !a.dead && a.siren && a.target && Math.hypot(a.target.cx - x, a.target.cy - y) < INCIDENT_R)
      n++;
  return n;
}
function enginesWanted(x, y) {
  let n = 0;
  for (const o of burning) if (Math.hypot(o.cx - x, o.cy - y) < INCIDENT_R) n++;
  return n <= 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4;
}
let truckPending = 0;
function requestTruck(b) {
  if (trucksBusy.has(b) || K < 0.27) return;
  if (enginesNear(b.cx, b.cy) + truckPending >= enginesWanted(b.cx, b.cy)) return;
  trucksBusy.add(b);
  truckPending++;
  setTimeout(() => {
    truckPending--;
    dispatchTruck(b);
  }, 400);
}
// the next building in the same incident that needs an engine: burning, and with the fewest engines on it
function nextFire(x, y, self) {
  let best = null,
    bs = 1e18;
  for (const o of burning) {
    if (o.fire <= 0 || o.state === 2) continue;
    const d = Math.hypot(o.cx - x, o.cy - y);
    if (d > INCIDENT_R) continue;
    let on = 0;
    for (const a of agents) if (a !== self && a.kind === 'truck' && !a.dead && a.target === o) on++;
    const sc = on * 1e6 + d;
    if (sc < bs) {
      bs = sc;
      best = o;
    }
  }
  return best;
}
function dispatchTruck(b) {
  if (b.fire <= 0) {
    trucksBusy.delete(b);
    return;
  }
  if (enginesNear(b.cx, b.cy) >= enginesWanted(b.cx, b.cy)) {
    trucksBusy.delete(b);
    return;
  }
  let best = null,
    bd = 1e18;
  for (const s of STATIONS) {
    const p = ll(s[0], s[1]);
    const d = Math.hypot(p[0] - b.cx, p[1] - b.cy);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  let sx = best[0],
    sy = best[1];
  if (bd > 450) {
    const f = 380 / bd;
    sx = b.cx + (best[0] - b.cx) * f;
    sy = b.cy + (best[1] - b.cy) * f;
  }
  const s = nearestNode(sx, sy, GD, 400),
    t = nearestNode(b.cx, b.cy, GD, 250);
  const path = astar(GD, s, t, 40000);
  if (!path) {
    trucksBusy.delete(b);
    return;
  }
  const a = mkAgent('truck', NX[s], NY[s]);
  a.path = path;
  a.pi = 0;
  a.target = b;
  a.sp = 24;
  a.siren = 1;
  a.keep = 1;
  a.act = 'Responding to a fire';
  agents.push(a);
  toast('Slökkviliðið is on its way');
}
