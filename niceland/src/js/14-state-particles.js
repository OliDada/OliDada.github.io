/**
 * Simulation state and particles
 *
 * Global simulation state (time, speed, hazards, agents) and the particle system (smoke, dust, sparks).
 *
 * Functions: addP, smoke, dust, ghost, sparks, stepParts, drawParts
 * State and constants: time, speed, simAcc, flood, floodT, rainT, quake, shake, rebuild, burning,
 *     burningT, lavaActive, lavaTiles, srcSet, volcanoes, rubbleList, building, parts, bolts, hazards,
 *     agents, follow, selected, MOD_CELLS
 */

let time = 0,
  speed = 1,
  simAcc = 0,
  flood = 0,
  floodT = 0,
  rainT = 0,
  quake = null,
  shake = 0,
  rebuild = true;
let burning = new Set(),
  burningT = new Set(),
  lavaActive = [],
  lavaTiles = new Set(),
  srcSet = new Set(),
  volcanoes = [],
  rubbleList = [],
  building = new Set();
let parts = [],
  bolts = [],
  hazards = [],
  agents = [],
  follow = null,
  selected = null;
const MOD_CELLS = new Set();

/* ================= particles ================= */
function addP(p) {
  if (parts.length < 2600) parts.push(p);
}
function smoke(x, y, z, dark, n, size) {
  for (let i = 0; i < n; i++) {
    const g = dark ? 40 + R() * 30 : 150 + R() * 60;
    addP({
      t: 1,
      x: x + (R() - 0.5) * 6,
      y: y + (R() - 0.5) * 6,
      z,
      vx: WIND[0] * windS * 0.6 + (R() - 0.5) * 2,
      vy: WIND[1] * windS * 0.6 + (R() - 0.5) * 2,
      vz: 5 + R() * 5,
      life: 3 + R() * 3,
      max: 6,
      c: [g, g, g + 6],
      s: size || 3,
      a: 0.7
    });
  }
}
function dust(x, y, z, n, r) {
  for (let i = 0; i < n; i++)
    addP({
      t: 1,
      x: x + (R() - 0.5) * (r || 8),
      y: y + (R() - 0.5) * (r || 8),
      z: z + R() * 2,
      vx: (R() - 0.5) * 3,
      vy: (R() - 0.5) * 3,
      vz: 1.5 + R() * 2,
      life: 1 + R(),
      max: 2,
      c: [168, 150, 130],
      s: 2.4,
      a: 0.7
    });
}
function ghost(x, y, z) {
  addP({ t: 3, x, y, z: z + 2, vx: 0, vy: 0, vz: 3, life: 2, max: 2, c: [255, 255, 255], s: 1.6 });
}
function sparks(x, y, z, n, sp) {
  for (let i = 0; i < n; i++)
    addP({
      t: 2,
      g: 1,
      x,
      y,
      z,
      vx: (R() - 0.5) * sp,
      vy: (R() - 0.5) * sp,
      vz: 4 + R() * sp,
      life: 0.6 + R() * 0.8,
      max: 1.4,
      c: i % 3,
      s: 1.6
    });
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.t === 5) {
      p.u += dt / p.dur;
      const f = Math.min(1, p.u);
      p.x = p.sx + (p.ex - p.sx) * f;
      p.y = p.sy + (p.ey - p.sy) * f;
      p.z = p.sz + (p.ez - p.sz) * f;
      addP({
        t: 2,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: (R() - 0.5) * 4,
        vy: (R() - 0.5) * 4,
        vz: (R() - 0.5) * 4,
        life: 0.5,
        max: 0.5,
        c: (R() * 3) | 0,
        s: 2.4
      });
      addP({
        t: 1,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: 0,
        vy: 0,
        vz: 1,
        life: 1.5,
        max: 1.5,
        c: [70, 64, 62],
        s: 4,
        a: 0.6
      });
      if (f >= 1) {
        explode(p.ex, p.ey, 70, 10);
        p.life = 0;
      }
    }
    if (p.life <= 0) {
      parts[i] = parts[parts.length - 1];
      parts.pop();
      continue;
    }
    if (p.t === 5) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.g) {
      p.vz -= 26 * dt;
      const gz = hAt(p.x, p.y);
      if (p.z < gz) {
        p.z = gz;
        if (p.t === 4) {
          lavaSplash(p.x, p.y);
          p.life = 0;
        }
        p.vz *= -0.25;
        p.vx *= 0.4;
        p.vy *= 0.4;
      }
    } else if (p.t === 6) p.vz -= 9.8 * dt;
    else if (p.t !== 3) {
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    bolts[i].t -= dt;
    if (bolts[i].t <= 0) bolts.splice(i, 1);
  }
}
function drawParts() {
  const k = K;
  for (const p of parts) {
    const sx = PXw(p.x, p.y) * k - cx0,
      sy = (PYw(p.x, p.y) - p.z) * k - cy0;
    if (sx < -20 || sy < -20 || sx > VW + 20 || sy > VH + 20) continue;
    const f = p.life / p.max;
    let s = p.t === 1 ? p.s * k * 0.55 : p.s * Math.max(0.6, k);
    if (p.t === 5) {
      ctx.fillStyle = '#fff6c8';
      const q = Math.max(3, k * 6);
      ctx.fillRect(sx - q / 2, sy - q / 2, q, q);
      continue;
    }
    if (p.t === 1) {
      s *= 1 + (1 - f) * 1.8;
      s = Math.max(2, s);
      ctx.globalAlpha = Math.min(1, f * 1.2) * p.a * 0.6;
      ctx.fillStyle = C_(p.c, 1);
    } else if (p.t === 3) {
      ctx.globalAlpha = f * 0.8;
      ctx.fillStyle = '#fff';
    } else if (p.t === 6) {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = C_([150, 200, 240], 1);
    } else if (p.t === 2 || p.t === 4) ctx.fillStyle = typeof p.c === 'number' ? FIREC[p.c] : C_(p.c, 1);
    else ctx.fillStyle = C_(p.c, 1);
    s = Math.max(1, Math.round(s));
    ctx.fillRect(Math.round(sx - s / 2), Math.round(sy - s / 2), s, s);
    ctx.globalAlpha = 1;
  }
}
