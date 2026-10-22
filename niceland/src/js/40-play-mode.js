/**
 * Play mode
 *
 * Walking as a person, driving a car or flying a plane.
 *
 * Functions: scrDir, blockedAt, playAs, stopPlay, flyPlane, playKey, stepPlay
 * State and constants: CTRL
 */

let CTRL = null; // {mode:'walk'|'car'|'plane', a: entity}
function scrDir(a, b) {
  // screen direction (a right, b down) -> unit world vector
  let x = SYy * a - SXy * b,
    y = -SYx * a + SXx * b;
  const L = Math.hypot(x, y) || 1;
  return [x / L, y / L];
}
function blockedAt(x, y, water) {
  const c = cellAt(x, y);
  if (c < 0) return true;
  const t = gT(c);
  if (!water && isWaterT(t)) return true;
  if (t === GLACIER && !water) return false;
  let hit = false;
  nearB(x, y, 30, b => {
    if (hit || b.state >= 2 || b.fly) return;
    if (x < b.minx || x > b.maxx || y < b.miny || y > b.maxy) return;
    if (pip(b.poly, x, y)) hit = true;
  });
  return hit;
}
function playAs(a) {
  if (!a || a.dead) return;
  if (a.plane) {
    if (a.parked) return flyPlane(a);
    return;
  }
  if (a.car) {
    CTRL = { mode: 'car', a, sp: a.sp * 0.5 || 0 };
    a.path = null;
    a.keep = 1;
    a.ctrl = 1;
    a.siren = 0;
  } else {
    CTRL = { mode: 'walk', a };
    a.ctrl = 1;
    a.keep = 1;
    a.path = null;
    a.leader = null;
    a.zone = null;
    a.zk = null;
    a.state = 'walk';
    a.entering = 0;
  }
  follow = a;
  selected = a;
  setTimeout(updPlayBtn, 0);
  toast(
    CTRL.mode === 'car'
      ? tipK('Driving: W/S speed, A/D steer, F to get out', 'Driving: push the stick up to go, down to brake, sideways to steer')
      : 'Playing as ' +
          a.name.split(' ')[0] +
          tipK(': WASD to walk, Shift to run, F to get in a car or plane', ': use the stick to walk, Get in for a car or plane')
  );
}
function stopPlay() {
  if (!CTRL) return;
  setTimeout(() => {
    HEAT = 0;
    releaseCops(true);
    updPlayBtn();
    const h = $('#wanted');
    if (h) h.hidden = true;
  }, 0);
  const a = CTRL.a;
  if (a) {
    a.ctrl = 0;
    if (CTRL.mode === 'plane') {
      a.dead = true;
    } else if (a.car) {
      a.dead = true;
    } else {
      a.dead = true;
    }
  }
  CTRL = null;
  follow = null;
  selected = null;
}
function flyPlane(s) {
  const ap = AIRPORTS.find(A => A.stands.includes(s));
  if (ap) ap.stands.splice(ap.stands.indexOf(s), 1);
  const p = {
    plane: 1,
    t: s.t,
    liv: s.liv,
    x: s.x,
    y: s.y,
    hd: s.hd,
    alt: 0,
    v: 0,
    st: 'ctrl',
    ap,
    name: 'Your flight',
    dest: 'wherever you like',
    ctrl: 1,
    thr: 0
  };
  p.z = hAt(p.x, p.y) + PTYPE[p.t].gear;
  PLANES.push(p);
  if (CTRL && CTRL.mode === 'walk') {
    CTRL.a.dead = true;
  }
  CTRL = { mode: 'plane', a: p, pilot: CTRL && CTRL.a };
  follow = p;
  selected = p;
  toast(
    tipK(
      'Flying: W/S throttle, A/D turn, Space climb, X descend, F to get out on the ground',
      'Flying: stick up/down for throttle, sideways to turn, hold Climb or Descend'
    )
  );
}
function playKey(kk) {
  if (!CTRL) return false;
  if (kk === 'f') {
    const a = CTRL.a;
    if (CTRL.mode === 'walk') {
      let best = null,
        bd = 9;
      for (const c of agents) {
        if (c.dead || !c.car || c.kind === 'truck' || c.burnt || c.knock > 0 || c.kind === 'bus') continue;
        const d = Math.hypot(c.x - a.x, c.y - a.y);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        carjack(a, best);
        best.path = null;
        best.wait = 0;
        best.state = 'walk';
        CTRL.pilot = a;
        a.hidden = 1;
        const pil = a;
        CTRL = { mode: 'car', a: best, sp: 0, pilot: pil };
        best.ctrl = 1;
        best.keep = 1;
        best.path = null;
        follow = best;
        selected = best;
        toast(
          'You get into the ' +
            (best.vname ? best.vname.split(' · ')[1] : 'car') +
            tipK('. W/S speed, A/D steer, F to get out', '. Use the stick to drive')
        );
        return true;
      }
      let st = null;
      bd = 40;
      for (const ap of AIRPORTS)
        for (const s of ap.stands) {
          const d = Math.hypot(s.x - a.x, s.y - a.y);
          if (d < bd) {
            bd = d;
            st = s;
          }
        }
      if (st) {
        flyPlane(st);
        return true;
      }
      // no car around: a parked car from the nearest car park
      const A = PROPS_OK ? nearArea(a.x, a.y, 40, [AK.PARKING]) : null;
      const rn = roadNear(a.x, a.y) || nearestNode(a.x, a.y, GD, 25) >= 0;
      if (A || rn) {
        const c = mkAgent('car', a.x, a.y);
        setVT(c, pickVT(a.x, a.y));
        c.keep = 1;
        c.parkedCar = 1;
        agents.push(c);
        a.hidden = 1;
        CTRL = { mode: 'car', a: c, sp: 0, pilot: a };
        c.ctrl = 1;
        follow = c;
        selected = c;
        toast(A ? 'You take a car from the car park' : 'You flag down a car and take the wheel');
        return true;
      }
      toast('No car or plane close by');
      return true;
    }
    if (CTRL.mode === 'car') {
      const car = CTRL.a,
        p = CTRL.pilot;
      if (Math.abs(CTRL.sp) > 6) {
        toast('Slow down first');
        return true;
      }
      let px = car.x + (-car.ldy || 0) * 2.5,
        py = car.y + (car.ldx || 1) * 2.5;
      if (blockedAt(px, py)) (px = car.x), (py = car.y);
      const w = p || mkAgent('walk', px, py);
      w.hidden = 0;
      w.dead = false;
      w.x = px;
      w.y = py;
      if (!p) {
        applyLook(w, mkPersona({ cx: px, cy: py, kind: 0, seed: 0.5, area: 150 }, 30));
        agents.push(w);
      }
      car.ctrl = 0;
      car.dead = true;
      CTRL = { mode: 'walk', a: w };
      w.ctrl = 1;
      follow = w;
      selected = w;
      toast('You get out');
      return true;
    }
    if (CTRL.mode === 'plane') {
      const pl = CTRL.a;
      if (pl.alt > 1 || pl.v > 4) {
        toast(pl.alt > 1 ? 'Land first!' : 'Stop first');
        return true;
      }
      const w = mkAgent('walk', pl.x + 8, pl.y + 8);
      applyLook(w, mkPersona({ cx: pl.x, cy: pl.y, kind: 0, seed: 0.5, area: 150 }, 38));
      w.job = 'Pilot';
      agents.push(w);
      pl.parked = 1;
      pl.ctrl = 0;
      pl.st = 'parked';
      pl.name = 'Parked aircraft';
      PLANES.splice(PLANES.indexOf(pl), 1);
      if (pl.ap) pl.ap.stands.push(pl);
      pl.z = hAt(pl.x, pl.y) + PTYPE[pl.t].gear;
      CTRL = { mode: 'walk', a: w };
      w.ctrl = 1;
      follow = w;
      selected = w;
      toast('You climb down from the plane');
      return true;
    }
  }
  return false;
}
function stepPlay(dt) {
  if (!CTRL) return;
  const a = CTRL.a;
  if (!a || (a.dead && CTRL.mode !== 'plane')) {
    toast('Game over');
    CTRL = null;
    follow = null;
    return;
  }
  const ks = keys,
    up = ks.has('w') || ks.has('arrowup'),
    dn = ks.has('s') || ks.has('arrowdown'),
    lf = ks.has('a') || ks.has('arrowleft'),
    rt = ks.has('d') || ks.has('arrowright');
  if (CTRL.mode === 'walk') {
    let run = ks.has('shift');
    let sx = (rt ? 1 : 0) - (lf ? 1 : 0),
      sy = (dn ? 1 : 0) - (up ? 1 : 0),
      amt = 1;
    // the touch joystick walks in any direction, slower near the middle
    const jm = typeof TOUCH !== 'undefined' && TOUCH.on ? Math.hypot(TOUCH.jx, TOUCH.jy) : 0;
    if (jm > 0.15) {
      sx = TOUCH.jx;
      sy = TOUCH.jy;
      amt = Math.min(1, 0.35 + jm);
    }
    if (sx || sy) {
      const d = scrDir(sx, sy),
        sp = (run ? 6.5 : 2.6) * amt * (a.scale < 0.8 ? 0.85 : 1);
      const nx = a.x + d[0] * sp * dt,
        ny = a.y + d[1] * sp * dt;
      if (a.dz > 2.5 || !blockedAt(nx, ny)) {
        a.x = nx;
        a.y = ny;
      } else if (!blockedAt(nx, a.y)) a.x = nx;
      else if (!blockedAt(a.x, ny)) a.y = ny;
      {
        const nz = deckAt(a.x, a.y, a.dz || 0, 9);
        a.dz = nz < (a.dz || 0) - 0.5 && (a.dz || 0) > 1 ? Math.max(nz, (a.dz || 0) - dt * 9) : nz;
      }
      a.vx = d[0] * sp;
      a.vy = d[1] * sp;
      a.state = 'walk';
      a.phase += dt * sp * 5;
      a.act = run ? 'Running' : 'Walking';
    } else {
      a.vx = a.vy = 0;
      a.state = 'idle';
      a.idle = 1;
      a.act = 'Standing';
    }
  } else if (CTRL.mode === 'car') {
    const V = VT[a.vt] || VT.car,
      max = (V.sp ? V.sp[1] : 16) * 1.6;
    let s = CTRL.sp;
    if (up) s += dt * (s < 0 ? 14 : 6);
    else if (dn) {
      if (s > 0) s = Math.max(0, s - dt * 14);
      else {
        CTRL.rev = (CTRL.rev || 0) + dt;
        if (CTRL.rev > 0.5) s -= dt * 5;
      }
    }
    if (!dn) CTRL.rev = 0;
    else s *= 1 - dt * 0.6;
    s = Math.max(-5, Math.min(max, s));
    if (Math.abs(s) < 0.05 && !up && !dn) s = 0;
    let hd = Math.atan2(a.ldy || 0, a.ldx || 1);
    const steer = (rt ? 1 : 0) - (lf ? 1 : 0); // screen-relative steering: turn clockwise on screen
    if (steer && Math.abs(s) > 0.3) {
      const turn = steer * dt * Math.min(1.8, 1.2 + Math.abs(s) * 0.03) * Math.sign(s);
      const f1 = [Math.cos(hd), Math.sin(hd)];
      const sc1 = [f1[0] * SXx + f1[1] * SXy, f1[0] * SYx + f1[1] * SYy];
      const ang = Math.atan2(sc1[1], sc1[0]) + turn;
      const w = scrDir(Math.cos(ang), Math.sin(ang));
      hd = Math.atan2(w[1], w[0]);
    }
    const c = cellAt(a.x, a.y),
      off = c >= 0 && !roadNear(a.x, a.y) && !(a.dz > 1) ? 0.55 : 1;
    const nx = a.x + Math.cos(hd) * s * off * dt,
      ny = a.y + Math.sin(hd) * s * off * dt;
    {
      const nz = deckAt(nx, ny, a.dz || 0, 6);
      a.dz = nz < (a.dz || 0) - 0.5 && (a.dz || 0) > 1 ? Math.max(nz, (a.dz || 0) - dt * 9) : nz;
      a.intun = 0;
    }
    if (
      !(a.dz > 2.5) &&
      blockedAt(
        nx + Math.cos(hd) * a.len * 0.5 * Math.sign(s || 1),
        ny + Math.sin(hd) * a.len * 0.5 * Math.sign(s || 1)
      )
    ) {
      if (Math.abs(s) > 8) {
        shake = Math.max(shake, 0.6);
        dust(a.x, a.y, hAt(a.x, a.y), 8, 4);
        toast('Crash!');
      }
      s = 0;
    } else {
      a.x = nx;
      a.y = ny;
    }
    {
      const ch = Math.cos(hd),
        shd = Math.sin(hd),
        pvx = ch * s,
        pvy = shd * s;
      for (const o of agents) {
        if (o === a || o.dead || o.hidden || o.ctrl) continue;
        const dx = o.x - a.x,
          dy = o.y - a.y;
        if (dx * dx + dy * dy > 144) continue;
        if (!o.car) {
          const al = dx * ch + dy * shd,
            sd = -dx * shd + dy * ch;
          if (Math.abs(al) > a.len * 0.5 + 0.35 || Math.abs(sd) > a.wid * 0.5 + 0.35 || o.down > 0) continue;
          if (Math.abs(s) > 5.5) {
            if (knockDown(o, a.x - ch * 2, a.y - shd * 2, Math.abs(s))) {
              addHeat(o.officer ? 1.2 : 0.8, o.officer ? 'ran over a police officer' : 'ran someone over');
              witnesses(o.x, o.y, 40);
              a.dmg = (a.dmg || 0) + 2;
              s *= 0.85;
            }
          } else {
            o.flee = true;
            say(o, ['Hey!', 'Varúð!', 'Hægðu á þér!'], 1.5);
            const d = Math.hypot(dx, dy) || 1;
            o.x += (dx / d) * 1.2;
            o.y += (dy / d) * 1.2;
          }
          continue;
        }
        const d = Math.hypot(dx, dy) || 0.01,
          rr = (Math.max(a.len, a.wid * 1.6) + Math.max(o.len, o.wid * 1.6)) * 0.34;
        if (d >= rr) continue;
        const osp = o.cop ? o.csp || 0 : o.wait > 0 || o.wreck || !o.path ? 0 : o.sp,
          ovx = (o.vx || 0) * osp,
          ovy = (o.vy || 0) * osp,
          rel = Math.hypot(pvx - ovx, pvy - ovy);
        const nx = dx / d,
          ny = dy / d;
        a.x -= nx * (rr - d) * 0.5;
        a.y -= ny * (rr - d) * 0.5;
        if (o.wreck || o.cop) {
          o.x += nx * (rr - d) * 0.5;
          o.y += ny * (rr - d) * 0.5;
        }
        if (rel > 2.5) {
          a._push = pvx * nx + pvy * ny;
          crashCars(a, o, rel, nx, ny, true);
          s *= -0.22;
          toast(rel > 14 ? 'Massive crash!' : 'Crash!');
        }
      }
      if ((a.dmg || 0) > 80 && R() < dt * 3) smoke(a.x, a.y, hAt(a.x, a.y) + 1.2, true, 1, 2.2);
      if (a.boom) {
        const p = CTRL.pilot;
        const w = p || mkAgent('walk', a.x, a.y);
        w.hidden = 0;
        w.dead = false;
        w.x = a.x + (-a.ldy || 0) * 3;
        w.y = a.y + (a.ldx || 1) * 3;
        if (blockedAt(w.x, w.y)) {
          w.x = a.x;
          w.y = a.y;
        }
        if (!p) {
          applyLook(w, mkPersona({ cx: a.x, cy: a.y, kind: 0, seed: 0.5, area: 150 }, 30));
          agents.push(w);
        }
        a.ctrl = 0;
        a.keep = 1;
        a.path = null;
        a.wrT = 80;
        w.down = 2.5;
        CTRL = { mode: 'walk', a: w };
        w.ctrl = 1;
        follow = w;
        selected = w;
        banner('BÍLLINN SPRAKK', 'Your car blew up · you crawl out of the wreck');
        return;
      }
    }
    CTRL.sp = s;
    a.sp = Math.abs(s);
    a.vx = Math.cos(hd) * s;
    a.vy = Math.sin(hd) * s;
    a.ldx = Math.cos(hd);
    a.ldy = Math.sin(hd);
    if (s < 0) {
      a.vx = -a.vx;
      a.vy = -a.vy;
    }
    if (Math.abs(s) < 0.05) {
      a.vx = a.vy = 0;
    }
    a.act = Math.round(Math.abs(s) * 3.6) + ' km/h';
  } else if (CTRL.mode === 'plane') {
    const p = a,
      T = PTYPE[p.t];
    if (up) p.thr = Math.min(1, p.thr + dt * 0.5);
    if (dn) p.thr = Math.max(0, p.thr - dt * 0.6);
    const vmax = T.sp * 1.6;
    p.v += (p.thr * vmax - p.v) * dt * (p.alt > 1 ? 0.25 : 0.18) - (p.alt <= 1 && dn ? p.v * dt * 0.6 : 0);
    p.v = Math.max(0, p.v);
    const steer = (rt ? 1 : 0) - (lf ? 1 : 0);
    if (steer) {
      const turn = steer * dt * (p.alt > 1 ? 0.45 : p.v < 25 ? 0.9 : 0.25);
      const f1 = [Math.cos(p.hd), Math.sin(p.hd)];
      const ang = Math.atan2(f1[0] * SYx + f1[1] * SYy, f1[0] * SXx + f1[1] * SXy) + turn;
      const w = scrDir(Math.cos(ang), Math.sin(ang));
      p.hd = Math.atan2(w[1], w[0]);
    }
    const ground = hAt(p.x, p.y);
    let climb = 0;
    if (ks.has(' ')) climb = 1;
    if (ks.has('x')) climb = -1;
    if (p.zAbs === undefined) p.zAbs = ground;
    const air = p.zAbs > ground + 1;
    if (!air && p.v < T.vr) climb = Math.max(0, Math.min(0, climb));
    if (!air && p.v >= T.vr && climb === 0 && p.thr > 0.7) climb = 0.4;
    let vz = climb * p.v * 0.18;
    if (air && p.v < T.vr * 0.7) vz -= 6;
    p.x += Math.cos(p.hd) * p.v * dt;
    p.y += Math.sin(p.hd) * p.v * dt;
    p.ux = Math.cos(p.hd);
    p.uy = Math.sin(p.hd);
    p.sx = p.x;
    p.sy = p.y;
    p.d = 0;
    const g2 = hAt(p.x, p.y);
    p.zAbs += vz * dt;
    const die = msg => {
      explode(p.x, p.y, 30, 2);
      toast(msg);
      PLANES.splice(PLANES.indexOf(p), 1);
      CTRL = null;
      follow = null;
    };
    if (p.zAbs < g2) {
      if (air && (vz < -7 || g2 - p.zAbs > 3)) {
        die('Crash! The plane went down');
        return;
      }
      p.zAbs = g2;
    }
    p.alt = p.zAbs - g2;
    p.rz = g2;
    if (p.alt <= 0.5 && p.v > 8) {
      const c = cellAt(p.x, p.y);
      if (c >= 0 && isWaterT(gT(c))) {
        toast('Splash! Ditched in the water');
        PLANES.splice(PLANES.indexOf(p), 1);
        CTRL = null;
        follow = null;
        return;
      }
    }
    {
      let bh = false;
      nearB(p.x, p.y, 60, b => {
        if (
          !bh &&
          b.state < 2 &&
          Math.hypot(b.cx - p.x, b.cy - p.y) < b.r * 0.6 + T.span * 0.2 &&
          b.z + b.base + b.h > p.zAbs + 1
        )
          bh = true;
      });
      if (bh && p.v > 6) {
        die('Crash! You flew into a building');
        return;
      }
    }
    p.z = p.zAbs + T.gear;
    p.fly = p.alt > 3;
    p.st = 'ctrl';
  }
}
