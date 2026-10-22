/**
 * Player mode
 *
 * Crime, police chases and getting caught.
 *
 * Functions: stars, addHeat, playerEnt, zoomTo, startPlayer, updPlayBtn, carjack, witnesses, carBoom,
 *     knockDown, crashCars, spawnCop, releaseCops, lineClear, steerTo, stepCop, stepOfficer, busted,
 *     banner, stepCrime, stepCrime0, drawLying, roadNear, playCard
 * State and constants: HEAT, LOSTT, BUSTT, COPSPAWN, BANNER_T, COPS, PANIC_CRIME
 */

let HEAT = 0,
  LOSTT = 0,
  BUSTT = 0,
  COPSPAWN = 0,
  BANNER_T = 0;
const COPS = [];
const PANIC_CRIME = [
  'Þjófur!',
  'Hringið í lögregluna!',
  'Hann keyrði á manninn!',
  'Brjálæðingur!',
  'Passaðu þig!',
  '112!',
  'Hvað er að þér?!'
];
PANIC.crime = PANIC_CRIME;
function stars() {
  return Math.max(0, Math.min(5, Math.floor(HEAT)));
}
function addHeat(v, why) {
  const s0 = stars();
  HEAT = Math.min(5.99, HEAT + v);
  LOSTT = 0;
  if (s0 === 0 && stars() > 0) COPSPAWN = 4;
  if (stars() > s0)
    toast(
      [
        '',
        'Lögreglan veit af þér',
        'Lögreglan er á eftir þér',
        'Fleiri lögreglubílar!',
        'Sérsveitin er kölluð út',
        'Öll lögreglan í landinu!'
      ][stars()] + (why ? ' · ' + why : '')
    );
}
function playerEnt() {
  return CTRL && CTRL.mode !== 'plane' ? CTRL.a : null;
}
function zoomTo(kk, x, y) {
  resetZoom();
  let n = 0,
    bd = 1e9;
  LEVELS.forEach((v, i) => {
    const d = Math.abs(Math.log(v / kk));
    if (d < bd) {
      bd = d;
      n = i;
    }
  });
  li = n;
  K = LEVELS[li];
  snapValid = false;
  centerOn(x, y);
  clampCam();
}
function startPlayer() {
  if (CTRL) {
    stopPlay();
    return;
  }
  const p = pickGround(VW / 2, VH / 2);
  let x = p[0],
    y = p[1];
  const n = nearestNode(x, y, GW, 400);
  if (n >= 0) {
    x = NX[n];
    y = NY[n];
  }
  const w = mkAgent('walk', x, y);
  applyLook(w, mkPersona({ cx: x, cy: y, kind: 0, seed: R(), area: 150 }, 24 + ((R() * 20) | 0)));
  w.keep = 1;
  w.player = 1;
  agents.push(w);
  HEAT = 0;
  LOSTT = 0;
  releaseCops(true);
  playAs(w);
  if (K < 2) zoomTo(3, x, y);
  toast(
    'You are ' +
      w.name.split(' ')[0] +
      tipK(' · WASD walk, Shift run, F steal the nearest car, Esc stop', ' · use the stick to walk, Get in to take a car, ✕ to stop')
  );
  updPlayBtn();
}
function updPlayBtn() {
  const b = $('#bPlayer');
  if (b) {
    b.textContent = CTRL ? 'Stop playing' : 'Play';
    b.classList.toggle('on', !!CTRL);
  }
}
/* ---- carjacking: called from playKey when walking ---- */
function carjack(a, car) {
  if (car.cop) {
    addHeat(1.5, 'stole a police car');
  } else if (!car.wreck && !car.parkedCar) {
    addHeat(0.7, 'carjacking');
  }
  if (!car.wreck && !car.parkedCar) {
    const s = car.wid * 0.5 + 1.2,
      px = car.x + -(car.ldy || car.vy || 0) * s,
      py = car.y + (car.ldx || car.vx || 1) * s;
    const d = mkAgent('walk', blockedAt(px, py) ? car.x : px, blockedAt(px, py) ? car.y : py);
    applyLook(d, mkPersona({ cx: car.x, cy: car.y, kind: 0, seed: R(), area: 150 }, 25 + ((R() * 45) | 0)));
    d.keep = 1;
    agents.push(d);
    if (car.cop) {
      d.officer = 1;
      d.shirt = [34, 44, 74];
      d.pants = [30, 34, 48];
      d.hat = [30, 36, 60];
    }
    d.down = 1.2;
    say(d, ['Hey! Bíllinn minn!', 'Þjófur!', 'Stoppaðu!', 'Lögregla!', 'Hvað ertu að gera?!'], 3);
    setTimeout(() => {
      if (!d.dead) {
        d.down = 0;
        flee(d, { x: car.x, y: car.y, r: 20, kind: 'crime' });
      }
    }, 1300);
    witnesses(car.x, car.y, 35);
  }
  car.cop = 0;
  car.siren = 0;
  car.wreck = 0;
  car.knock = 0;
  car.wait = 0;
  const ci = COPS.indexOf(car);
  if (ci >= 0) COPS.splice(ci, 1);
}
function witnesses(x, y, r) {
  for (const o of agents) {
    if (o.dead || o.car || o.ctrl || o.officer || o.down > 0) continue;
    if (Math.hypot(o.x - x, o.y - y) < r && R() < 0.8) {
      flee(o, { x, y, r: r + 10, kind: 'crime' });
    }
  }
}
/* ---- crashes ---- */
function carBoom(x, y) {
  const z = hAt(x, y);
  sparks(x, y, z + 1, 40, 8);
  smoke(x, y, z + 1.5, true, 18, 4);
  shake = Math.min(2, shake + 0.8);
  for (const o of agents) {
    if (o.dead || o.car || o.ctrl) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < 4) knockDown(o, x, y, 6);
    else if (d < 30) flee(o, { x, y, r: 40, kind: 'boom' });
  }
}
function knockDown(o, fx, fy, sp) {
  if (o.down > 0 || o.ctrl) return false;
  const dx = o.x - fx,
    dy = o.y - fy,
    d = Math.hypot(dx, dy) || 1;
  o.down = 4 + R() * 3;
  o.kvx = (dx / d) * Math.min(8, sp * 0.5);
  o.kvy = (dy / d) * Math.min(8, sp * 0.5);
  o.path = null;
  o.keep = 1;
  o.leader = null;
  o.zone = null;
  o.state = 'idle';
  o.act = 'Lying on the ground';
  say(o, ['Ái!', 'Ááá!', 'Úff!', 'Hjálp!'], 2);
  return true;
}
function crashCars(a, o, rel, nx, ny, isPlayer) {
  const z = hAt(o.x, o.y);
  sparks((a.x + o.x) / 2, (a.y + o.y) / 2, z + 0.8, Math.min(40, rel * 2), rel * 0.4);
  if (rel > 9) dust(o.x, o.y, z, 4, 3);
  shake = Math.max(shake, Math.min(1.2, rel / 18));
  o.dmg = (o.dmg || 0) + rel * 5;
  a.dmg = (a.dmg || 0) + rel * (isPlayer ? 2.2 : 5);
  if (o.cop) {
    if (rel > 6) o.stun = Math.min(3, 0.5 + rel * 0.12);
    o.cvx = nx * rel * 0.5;
    o.cvy = ny * rel * 0.5;
  } else {
    o.knock = Math.min(1.6, 0.4 + rel * 0.07);
    o.kvx = nx * rel * 0.55;
    o.kvy = ny * rel * 0.55;
    o.path = null;
    o.keep = 1;
    o.wreck = 1;
    o.wait = 1e9;
    o.state = 'parked';
    o.wrT = 90;
    o.act = 'Crashed';
    if (!o.vx && !o.vy) {
      o.vx = 1;
    }
  }
  if (isPlayer && rel > 5 && (a._push || 0) > 3) addHeat(o.cop ? 1 : 0.3, o.cop ? 'rammed a police car' : '');
  for (const c of [a, o]) {
    if (c.dmg > (c.ctrl ? 300 : 220) && !c.boom) {
      c.boom = 1;
      carBoom(c.x, c.y);
      c.wreck = 1;
      c.burnt = 1;
      c.c = [48, 46, 44];
      c.siren = 0;
      if (c.cop) {
        c.cop = 0;
      }
    }
  }
}
/* ---- police ---- */
function spawnCop(T) {
  for (let tries = 0; tries < 6; tries++) {
    const ang = R() * 6.283,
      d = 320 + R() * 160;
    const n = nearestNode(T.x + Math.cos(ang) * d, T.y + Math.sin(ang) * d, GD, 200);
    if (n < 0) continue;
    const c = mkAgent('car', NX[n], NY[n]);
    setVT(c, stars() >= 4 && R() < 0.4 ? 'suv' : 'police');
    if (c.vt === 'suv') {
      c.c = [30, 34, 40];
      c.siren = 1;
    }
    c.siren = 1;
    c.cop = 1;
    c.keep = 1;
    c.path = null;
    c.vx = T.x - c.x;
    c.vy = T.y - c.y;
    const L = Math.hypot(c.vx, c.vy) || 1;
    c.vx /= L;
    c.vy /= L;
    c.ldx = c.vx;
    c.ldy = c.vy;
    c.csp = 0;
    c.act = 'Chasing you';
    c.vname = 'Lögreglubíll · police car';
    agents.push(c);
    COPS.push(c);
    return c;
  }
  return null;
}
function releaseCops(all) {
  for (const c of COPS) {
    c.cop = 0;
    c.siren = 0;
    c.act = 'Back on patrol';
    if (all || R() < 1) {
      const s = nearestNode(c.x, c.y, GD, 100),
        t = nearestNode(c.x + (R() - 0.5) * 2000, c.y + (R() - 0.5) * 2000, GD, 400);
      const p = s >= 0 && t >= 0 ? astar(GD, s, t, 12000) : null;
      if (p && p.length > 1) {
        c.path = p;
        c.pi = 0;
        c.t = 0;
        c.keep = 0;
        c.wait = 0;
      } else c.dead = true;
    }
  }
  COPS.length = 0;
  for (const o of agents)
    if (o.officer && !o.ctrl) {
      o.officer = 0;
      o.dead = true;
    }
}
function lineClear(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blockedAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}
function steerTo(c, tx, ty, want, dt, road) {
  const dx = tx - c.x,
    dy = ty - c.y;
  let hd = Math.atan2(c.ldy || 0, c.ldx || 1);
  const tg = Math.atan2(dy, dx);
  let da = tg - hd;
  while (da > Math.PI) da -= 6.283;
  while (da < -Math.PI) da += 6.283;
  const tr = Math.min(Math.abs(da), dt * (c.csp < 4 ? 2.8 : 2.1));
  hd += Math.sign(da) * tr;
  const sharp = Math.abs(da) > 1.2;
  const vmax = (VT[c.vt].sp ? VT[c.vt].sp[1] : 18) * (1.05 + stars() * 0.08);
  const target = Math.min(vmax, want) * (sharp ? 0.22 : Math.abs(da) > 0.6 ? 0.6 : 1);
  c.csp += (target - c.csp) * Math.min(1, dt * (target > c.csp ? 1.1 : 2.5));
  const nx = c.x + Math.cos(hd) * c.csp * dt,
    ny = c.y + Math.sin(hd) * c.csp * dt;
  if (!road && blockedAt(nx + Math.cos(hd) * c.len * 0.5, ny + Math.sin(hd) * c.len * 0.5)) {
    c.csp *= 0.3;
    c.stuck = (c.stuck || 0) + dt;
  } else {
    c.x = nx;
    c.y = ny;
    c.stuck = 0;
  }
  c.ldx = Math.cos(hd);
  c.ldy = Math.sin(hd);
  c.vx = c.ldx;
  c.vy = c.ldy;
  c.sp = c.csp;
}
function stepCop(c, T, dt) {
  if (c.stun > 0) {
    c.stun -= dt;
    c.x += (c.cvx || 0) * dt;
    c.y += (c.cvy || 0) * dt;
    c.cvx *= 1 - dt * 3;
    c.cvy *= 1 - dt * 3;
    c.csp *= 1 - dt * 4;
    return;
  }
  const d = Math.hypot(T.x - c.x, T.y - c.y),
    walking = CTRL.mode === 'walk';
  if (walking && d < 18) {
    // pull over and send the officers out
    c.csp *= 1 - dt * 4;
    if (!c.out && c.csp < 3) {
      c.out = 1;
      for (let i = 0; i < 2; i++) {
        const o = mkAgent('walk', c.x + (i ? 1.5 : -1.5) * -c.ldy, c.y + (i ? 1.5 : -1.5) * c.ldx);
        applyLook(o, mkPersona({ cx: c.x, cy: c.y, kind: 0, seed: R(), area: 150 }, 30 + ((R() * 15) | 0)));
        o.officer = 1;
        o.keep = 1;
        o.lopi = false;
        o.shirt = [34, 44, 74];
        o.pants = [30, 34, 48];
        o.hat = [30, 36, 60];
        o.act = 'Police officer';
        o.name = 'Lögreglan';
        agents.push(o);
        say(o, ['Stopp! Lögreglan!', 'Stansaðu!', 'Hendur upp!'], 2.5);
      }
    }
    c.x += c.ldx * c.csp * dt;
    c.y += c.ldy * c.csp * dt;
    return;
  }
  if (!walking) c.out = 0;
  if (d < 90 && lineClear(c.x, c.y, T.x, T.y)) {
    const lead = walking ? 0 : Math.min(1.2, d / 20);
    const tsp = walking ? 0 : Math.abs(CTRL.sp || 0);
    steerTo(
      c,
      T.x + (T.vx || 0) * lead,
      T.y + (T.vy || 0) * lead,
      d < 9 && tsp < 3 ? 0 : d < 16 ? tsp * 0.95 : d * 0.6 + tsp + 2,
      dt
    );
    c.path = null;
    return;
  }
  c.rp = (c.rp || 0) - dt;
  if (!c.path || c.rp <= 0 || c.stuck > 2) {
    c.rp = 3;
    const s = nearestNode(c.x + c.ldx * 12, c.y + c.ldy * 12, GD, 80),
      t = nearestNode(T.x, T.y, GD, 160);
    if (s >= 0 && t >= 0) {
      const p = astar(GD, s, t, 7000);
      if (p && p.length > 1) {
        c.path = p;
        c.pi = 0;
        while (c.pi < p.length - 1) {
          const a0 = p[c.pi],
            a1 = p[c.pi + 1];
          if (Math.hypot(NX[a1] - c.x, NY[a1] - c.y) < Math.hypot(NX[a1] - NX[a0], NY[a1] - NY[a0]) + 2)
            c.pi++;
          else break;
        }
      }
    }
    if (c.stuck > 2) {
      c.stuck = 0;
      const n = nearestNode(c.x, c.y, GD, 60);
      if (n >= 0) {
        c.x = NX[n];
        c.y = NY[n];
      }
    }
  }
  if (c.path) {
    let n = c.path[c.pi];
    while (c.pi < c.path.length - 1 && Math.hypot(NX[n] - c.x, NY[n] - c.y) < Math.max(6, c.csp * 0.45)) {
      c.pi++;
      n = c.path[c.pi];
    }
    if (c.pi >= c.path.length - 1 && Math.hypot(NX[n] - c.x, NY[n] - c.y) < 9)
      steerTo(c, T.x, T.y, Math.min(22, d), dt);
    else steerTo(c, NX[n], NY[n], 40, dt, 1);
  } else steerTo(c, T.x, T.y, 20, dt);
}
function stepOfficer(o, T, dt) {
  if (o.down > 0) return;
  const dx = T.x - o.x,
    dy = T.y - o.y,
    d = Math.hypot(dx, dy) || 1;
  const sp = 5.6;
  const nx = o.x + (dx / d) * sp * dt,
    ny = o.y + (dy / d) * sp * dt;
  if (!blockedAt(nx, ny)) {
    o.x = nx;
    o.y = ny;
  } else if (!blockedAt(nx, o.y)) o.x = nx;
  else if (!blockedAt(o.x, ny)) o.y = ny;
  o.vx = dx / d;
  o.vy = dy / d;
  o.state = 'walk';
  o.phase += dt * sp * 5;
  if (CTRL.mode === 'walk' && d < 1.1) busted();
  else if (CTRL.mode !== 'walk' && d > 60) o.dead = true;
}
function busted() {
  const T = playerEnt();
  if (!T) return;
  banner('HANDTEKINN', 'Busted · you spent the night at Hverfisgata');
  const hq = ll(64.143, -21.9152);
  let w = CTRL.mode === 'walk' ? T : CTRL.pilot || mkAgent('walk', hq[0], hq[1]);
  if (CTRL.mode === 'car') {
    T.ctrl = 0;
    T.wreck = 1;
    T.keep = 1;
    T.path = null;
    T.wrT = 60;
    T.sp = 0;
    if (!CTRL.pilot) {
      applyLook(w, mkPersona({ cx: hq[0], cy: hq[1], kind: 0, seed: 0.5, area: 150 }, 30));
      agents.push(w);
    }
  }
  const n = nearestNode(hq[0], hq[1], GW, 200);
  w.x = n >= 0 ? NX[n] : hq[0];
  w.y = n >= 0 ? NY[n] : hq[1];
  w.hidden = 0;
  w.dead = false;
  w.down = 0;
  CTRL = { mode: 'walk', a: w };
  w.ctrl = 1;
  follow = w;
  selected = w;
  HEAT = 0;
  LOSTT = 0;
  BUSTT = 0;
  releaseCops(true);
  gameMin += 8 * 60;
  centerOn(w.x, w.y);
  clampCam();
}
function banner(big, small) {
  let el = $('#banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'banner';
    document.body.appendChild(el);
  }
  el.innerHTML = '<b>' + big + '</b><span>' + small + '</span>';
  el.hidden = false;
  el.style.opacity = 1;
  BANNER_T = 3.2;
}
/* ---- every frame ---- */
function stepCrime(dt) {
  try {
    stepCrime0(dt);
  } catch (e) {
    console.warn('crime', e);
  }
}
function stepCrime0(dt) {
  if (BANNER_T > 0) {
    BANNER_T -= dt;
    if (BANNER_T <= 0) {
      const el = $('#banner');
      if (el) {
        el.style.opacity = 0;
        setTimeout(() => (el.hidden = true), 400);
      }
    }
  }
  const T = playerEnt();
  const hud = $('#wanted');
  if (!T) {
    if (COPS.length) releaseCops(true);
    HEAT = 0;
    if (hud) hud.hidden = true;
    return;
  }
  // wrecks clear away after a while; knocked people get back up
  const st = stars();
  if (hud) {
    hud.hidden = st === 0 && HEAT < 0.3;
    hud.innerHTML =
      '<span class="st">' +
      '★'.repeat(st) +
      '<i>' +
      '★'.repeat(5 - st) +
      '</i></span><span class="lb">Eftirlýst · wanted</span>';
  }
  for (let i = COPS.length - 1; i >= 0; i--) {
    const c = COPS[i];
    if (c.dead || !c.cop) {
      COPS.splice(i, 1);
      continue;
    }
    stepCop(c, T, dt);
  }
  for (const o of agents) if (o.officer && !o.dead && !o.ctrl && !o.car) stepOfficer(o, T, dt);
  if (st >= 1) {
    COPSPAWN -= dt;
    const want = Math.min(6, st + (st >= 4 ? 1 : 0));
    if (COPS.length < want && COPSPAWN <= 0) {
      COPSPAWN = 7 + R() * 4;
      spawnCop(T);
    }
    let seen = false;
    for (const c of COPS) if (Math.hypot(c.x - T.x, c.y - T.y) < (c.stun > 0 ? 0 : 120)) seen = true;
    if (!seen) {
      LOSTT += dt;
      if (LOSTT > 10) {
        LOSTT = 0;
        HEAT = Math.max(0, Math.floor(HEAT) - 1 + 0.5);
        if (stars() === 0) {
          HEAT = 0;
          releaseCops(true);
          toast('You lost the police');
        } else toast('The police are losing your trail…');
      }
    } else LOSTT = Math.max(0, LOSTT - dt * 2);
    if (CTRL.mode === 'car') {
      let near = false;
      for (const c of COPS) if (Math.hypot(c.x - T.x, c.y - T.y) < 8.5) near = true;
      if (near && Math.abs(CTRL.sp) < 1.6) {
        BUSTT += dt;
        if (BUSTT > 2.2) busted();
      } else BUSTT = 0;
    }
  } else if (HEAT > 0) {
    HEAT = Math.max(0, HEAT - dt * 0.01);
  }
}
/* ---- drawing a person who has been knocked over ---- */
function drawLying(a, X, Y, Hh) {
  const p = Math.max(1, Math.round(Hh / 14)),
    L = Math.max(3, Math.round(Hh * 0.75)),
    T = Math.max(1, Math.round(Hh * 0.2));
  const dir = a.id & 1 ? 1 : -1;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(X - L / 2 - 1, Y - 1, L + 2, 2);
  ctx.fillStyle = C_(a.pants || [50, 60, 80], 1);
  ctx.fillRect(Math.round(X - dir * L * 0.5), Y - T, Math.round(L * 0.45) * dir || 1, T);
  ctx.fillStyle = C_(a.shirt || [120, 120, 120], 1);
  ctx.fillRect(Math.round(X), Y - T - p, Math.round(L * 0.35) * dir || 1, T + p);
  ctx.fillStyle = C_(a.skin || [230, 190, 160], 1);
  const hx = Math.round(X + dir * L * 0.42);
  ctx.fillRect(hx - (dir < 0 ? 2 * p : 0), Y - T - p, 2 * p, 2 * p);
}

function roadNear(x, y) {
  let near = false;
  eachB2(SBUCK, x - 6, y - 6, x + 6, y + 6, (w, j) => {
    if (near) return;
    const wy = WAYS[w];
    if (wy.cl > 7) return;
    const n0 = wy.nodes[j],
      n1 = wy.nodes[j + 1];
    if (segD(x, y, NX[n0], NY[n0], NX[n1], NY[n1]) < 5) near = true;
  });
  return near;
}
function playCard() {
  if (!CTRL) return null;
  const a = CTRL.a;
  if (CTRL.mode === 'plane') {
    const T = PTYPE[a.t];
    return {
      h:
        '<h3>Flying · ' +
        T.name +
        '</h3><div class="act">' +
        (a.alt > 1 ? 'Airborne' : a.v > 2 ? 'Rolling' : 'On the ground') +
        '</div><div class="row"><span>Speed</span><span>' +
        Math.round(a.v * 1.944) +
        ' kn</span></div><div class="row"><span>Altitude</span><span>' +
        Math.round(a.alt * 3.28) +
        ' ft</span></div><div class="row"><span>Throttle</span><span>' +
        Math.round(a.thr * 100) +
        '%</span></div><div class="row"><span>Over</span><span>' +
        placeName(a.x, a.y) +
        '</span></div><div class="sub" style="margin-top:6px">W/S throttle · A/D turn · Space climb · X descend · F exit (on the ground) · Esc stop</div><button class="btn" id="stopplay">Stop playing</button>',
      m: 'Flying'
    };
  }
  if (CTRL.mode === 'car')
    return {
      h:
        '<h3>Driving · ' +
        (a.vname ? a.vname.split(' · ')[1] : 'car') +
        '</h3><div class="row"><span>Speed</span><span>' +
        Math.round(Math.abs(CTRL.sp) * 3.6) +
        ' km/h</span></div><div class="row"><span>Area</span><span>' +
        district(a.x, a.y) +
        '</span></div><div class="row"><span>Damage</span><span>' +
        Math.min(100, Math.round((a.dmg || 0) / 3)) +
        '%</span></div><div class="sub" style="margin-top:6px">W/S speed · A/D steer · F get out · Esc stop</div><button class="btn" id="stopplay">Stop playing</button>',
      m: 'Driving'
    };
  return {
    h:
      '<h3>' +
      a.name +
      '</h3><div class="sub">You · ' +
      (a.job || '') +
      '</div><div class="row"><span>Area</span><span>' +
      district(a.x, a.y) +
      '</span></div><div class="sub" style="margin-top:6px">WASD walk · Shift run · F steal the nearest car (or a plane, or a car from a car park) · Esc stop</div><button class="btn" id="stopplay">Stop playing</button>',
    m: a.name
  };
}
