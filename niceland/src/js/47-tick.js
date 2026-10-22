/**
 * Simulation tick
 *
 * The fixed-rate simulation step (tick) and population totals.
 *
 * Functions: initWild, initPop, recalc, tick
 * State and constants: statsDirty, pop, nb, tickN, POPF
 */

let statsDirty = true,
  pop = 0,
  nb = 0,
  tickN = 0;
let POPF = 1;
function initWild() {
  // capital cells with no building within ~120 m count as open country
  const W = F.W,
    H = F.H,
    S = new Int32Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) {
    let r = 0;
    for (let i = 0; i < W; i++) {
      const c = i + j * W;
      r += F.CBLD[c] >= 0 || F.GT[c] === PAVED ? 1 : 0;
      S[i + 1 + (j + 1) * (W + 1)] = S[i + 1 + j * (W + 1)] + r;
    }
  }
  const R2 = 12;
  F.WILD = new Uint8Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const a = Math.max(0, i - R2),
        b = Math.max(0, j - R2),
        c2 = Math.min(W, i + R2 + 1),
        d = Math.min(H, j + R2 + 1);
      const n = S[c2 + d * (W + 1)] - S[a + d * (W + 1)] - S[c2 + b * (W + 1)] + S[a + b * (W + 1)];
      F.WILD[i + j * W] = n === 0 ? 1 : 0;
    }
}
function initPop() {
  let s = 0;
  for (const b of B) if (b.state === 0) s += b.res;
  POPF = 1;
} // residents are already scaled to Statistics Iceland 1 Jan 2025 per municipality
function recalc() {
  let p = 0;
  nb = 0;
  for (const b of B) {
    if (b.state !== 0) continue;
    nb++;
    p += b.res;
  }
  pop = Math.round(p * POPF);
  statsDirty = false;
}
function tick(dt) {
  tickN++;
  gameMin += dt * 2;
  if (tickN % 20 === 0)
    try {
      checkShut();
    } catch (e) {}
  try {
    stepSki(dt);
    stepViewpoints(dt);
    stepGC(dt);
    stepFerryCars(dt);
  } catch (e) {
    console.warn(e);
  }
  try {
    stepLots(dt);
  } catch (e) {
    console.warn(e);
  }
  stepWeather(dt, dt * 2);
  for (const b of burning) {
    b.hp -= (dt * 3) / (1 + b.area / 600);
    b.fire += dt;
    if (b.fire > 4 && R() < dt * 0.3 && b.nb)
      for (const o of b.nb) if (o.state === 0 && o.fire <= 0 && R() < 0.12) ignite(o);
    if (R() < dt * 0.6)
      nearT(b.cx, b.cy, b.r + 10, t => {
        if (R() < 0.3) igniteTree(t);
      });
    if (R() < 0.0008 || (rainT > 0 && R() < 0.04) || flood > b.z) b.fire = 0;
    if (R() < dt * 1.6) smoke(b.cx, b.cy, b.z + b.base + b.h, true, 1, Math.min(14, 4 + b.r / 3));
    if (b.fire <= 0) {
      burning.delete(b);
      dirtyB(b);
      trucksBusy.delete(b);
    }
    if (b.hp <= 0) destroyB(b, false);
  }
  for (const t of burningT) {
    TREES.f[t] += dt;
    if (R() < dt * 0.5)
      nearT(TREES.x[t], TREES.y[t], 12, u => {
        if (R() < 0.4) igniteTree(u);
      });
    if (R() < dt * 0.6)
      nearB(TREES.x[t], TREES.y[t], 20, b => {
        if (Math.hypot(b.cx - TREES.x[t], b.cy - TREES.y[t]) < b.r + 6 && R() < 0.2) ignite(b);
      });
    if (R() < dt * 2) smoke(TREES.x[t], TREES.y[t], hAt(TREES.x[t], TREES.y[t]) + 6, true, 1, 2);
    if (TREES.f[t] > 6 + R() * 6 || (rainT > 0 && R() < 0.05)) {
      TREES.s[t] = 2;
      burningT.delete(t);
      dirtyWorld(TREES.x[t], TREES.y[t], false, true);
    }
  }
  if (quake) {
    quake.t -= dt;
    shake = Math.max(shake, 1);
    for (let q = 0; q < 10; q++) {
      const x = quake.x + (R() - 0.5) * 1800,
        y = quake.y + (R() - 0.5) * 1800;
      const c = cellAt(x, y);
      if (c < 0) continue;
      let hit = null;
      nearB(x, y, 40, b => {
        if (!hit && b.state === 0) hit = b;
      });
      if (hit) {
        const b = hit;
        b.hp -= b.sp ? 3 : 12 + R() * 18;
        dust(b.cx, b.cy, b.z, 2, b.r);
        if (b.hp <= 0) destroyB(b, false, !b.name);
        else if (R() < 0.04) ignite(b);
        else if (b.hp < 50) dirtyB(b);
      } else if (!isWaterT(gT(c)) && gT(c) !== LAVA && R() < 0.3)
        setCell(c, ROCK, gH(c) - (R() < 0.5 ? 1 : 0), 1);
    }
    if (quake.t <= 0) quake = null;
  }
  if (floodT > 0) {
    floodT += dt;
    const t = floodT;
    flood = t < 4 ? 7 * (t / 4) : t < 10 ? 7 : t < 15 ? 7 * (1 - (t - 10) / 5) : 0;
    if (t >= 15) {
      floodT = 0;
      flood = 0;
    }
    if (tickN % 5 === 0)
      for (const a of agents)
        if (!a.dead && !a.car && hAt(a.x, a.y) < flood - 0.3 && !a.flee)
          flee(a, { x: a.x - 50, y: a.y - 50, r: 60 });
    if (tickN % 3 === 0) {
      const vr = viewRect(200);
      eachB(BBUCK, vr[0], vr[1], vr[2], vr[3], b => {
        if (b.state === 0 && !b.sp && b.z < flood - 0.5) {
          b.hp -= 6;
          if (b.hp <= 0) destroyB(b, false, true);
        }
      });
    }
  }
  if (rainT > 0) rainT -= dt;
  stepLava(dt);
  stepVolc(dt);
  stepRebuild(dt);
  if (tickN % 5 === 0)
    for (const a of agents) {
      if (a.dead) continue;
      const c = cellAt(a.x, a.y);
      if (c < 0) continue;
      if (gT(c) === LAVA || (flood > hAt(a.x, a.y) + 1 && !a.car)) killA(a);
    }
  if (tickN % 20 === 0) recalc();
}
