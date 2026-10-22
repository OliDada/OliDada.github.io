/**
 * Main loop and start-up
 *
 * The animation frame loop and the start-up sequence that loads all data.
 *
 * Functions: frame, placeInsp
 * State and constants: last, uiAcc, behAcc, spawnAcc, READY
 */

let last = performance.now(),
  uiAcc = 0,
  behAcc = 0,
  spawnAcc = 0,
  READY = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  if (READY) perfStep(now - last);
  last = now;
  time += dt;
  if (CTRL) stepPlay(dt);
  stepCrime(dt);
  const ps = CTRL ? 0 : (420 * dt) / PX;
  if (keys.has('arrowleft') || keys.has('a')) camX -= ps;
  if (keys.has('arrowright') || keys.has('d')) camX += ps;
  if (keys.has('arrowup') || keys.has('w')) camY -= ps;
  if (keys.has('arrowdown') || keys.has('s')) camY += ps;
  if (keys.size) {
    camX = Math.round(camX);
    camY = Math.round(camY);
    clampCam();
  }
  if (follow && !follow.dead) {
    const z = follow.fly ? follow.z : hAt(follow.x, follow.y);
    const tx = PXw(follow.x, follow.y) * K - VW / 2,
      ty = (PYw(follow.x, follow.y) - z) * K - VH / 2;
    camX = Math.round(camX + (tx - camX) * Math.min(1, dt * 4));
    camY = Math.round(camY + (ty - camY) * Math.min(1, dt * 4));
  }
  simAcc += dt * speed;
  let n = 0;
  while (simAcc >= 0.1 && n < 8) {
    tick(0.1);
    simAcc -= 0.1;
    n++;
  }
  if (n >= 8) simAcc = 0;
  if (speed > 0) {
    stepAgents(dt * Math.min(speed, 2));
    stepAnimals(dt * Math.min(speed, 2));
    behAcc += dt * speed;
    if (behAcc > 0.25) {
      behAcc = 0;
      behave();
    }
    spawnAcc += dt;
    if (spawnAcc > 0.4) {
      spawnAcc = 0;
      spawnTick();
    }
  }
  stepParts(dt * (speed ? Math.min(2, speed) : 1));
  shake = Math.max(0, shake - dt * 1.2);
  zoomStep(dt);
  stepAreaFX(dt);
  stepEnts(dt * Math.min(speed, 2));
  stepPlanes(dt * Math.max(speed, 0.0001) * (speed ? 1 : 0));
  try {
    stepBoats(dt * (speed ? Math.min(speed, 2) : 0));
    stepGeo(dt * (speed ? Math.min(speed, 2) : 0));
    stepEvents(dt * (speed ? Math.min(speed, 2) : 0));
  } catch (e) {
    console.warn(e);
  }
  lighting();
  if (!ZM || ZM.dirty || LEVELS[ZM.tgt] <= K) {
    const _t = performance.now(),
      _e = window.__ens || 0,
      _f = window.__tfb || 0;
    draw();
    const _d = performance.now() - _t;
    if (_d > 45)
      (window.__slow = window.__slow || []).push([
        _d | 0,
        ((window.__ens || 0) - _e) | 0,
        ((window.__tfb || 0) - _f) | 0,
        K,
        !!ZM
      ]);
    if (ZM) ZM.dirty = false;
  } else if (LEVELS[ZM.tgt] > K) prefetchLevel(ZM.tgt, 11);
  {
    const used = performance.now() - now;
    if (used < 9) prefetchPan(Math.min(6, 11 - used));
  }
  applyCSS();
  uiAcc += dt;
  if (uiAcc > 0.25) {
    uiAcc = 0;
    updUI();
  }
  requestAnimationFrame(frame);
}
function placeInsp() {
  if (innerWidth <= 760) $('#ctrl').style.top = $('#hud').getBoundingClientRect().bottom + 8 + 'px';
  else $('#ctrl').style.top = '';
  const r = $('#ctrl').getBoundingClientRect();
  $('#insp').style.top = r.bottom + 8 + 'px';
}
addEventListener('resize', () => {
  resize();
  clampCam();
  placeInsp();
});
resize();
buildDock();
placeInsp();
updRotBtn();
window.__gow = (x, y, kk) => {
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
  return K;
};
window.__go = (lat, lon, kk) => {
  resetZoom();
  const w = ll(lat, lon);
  snapValid = false;
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
  centerOn(w[0], w[1]);
  clampCam();
  follow = null;
  return K;
};
window.__ev = src => eval(src);
window.__smv = () => ({
  gt: (x0, y0, n) => {
    let s = '';
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const c = cellAt(x0 + i * 10, y0 + j * 10);
        const t = c < 0 ? -1 : gT(c);
        s += t < 0 ? ' ' : 'SLGPWsdwRpr'[t] || String.fromCharCode(65 + t);
      }
      s += '\n';
    }
    return s;
  },
  apply: (x, y, t) => {
    tool = t;
    apply(x, y, true);
  },
  zs: () => [li, K, ZS.s.toFixed(3), ZS.tx | 0, ZS.ty | 0, ZM ? ZM.tgt : -1, cv.style.transform],
  PTS: () => PTS,
  AIRPORTS: () => AIRPORTS,
  PLANES: () => PLANES,
  searchQ,
  AREAS: () => AREAS,
  cls: (x, y) => {
    const gi = Math.floor((x - C.OX) / 10),
      gj = Math.floor((y - C.OY) / 10);
    return [clsFast(gi, gj), inF(x, y) ? F.GT[cellAt(x, y)] : -1];
  },
  dbg: {
    destroyB,
    stepRebuild,
    rl: () => rubbleList,
    bl: () => building,
    pop: () => {
      recalc();
      return pop;
    }
  },
  setHour: h => {
    gameMin = Math.floor(gameMin / 1440) * 1440 + h * 60;
    lighting();
  },
  volc: volcano,
  animals,
  agents,
  burning,
  lavaTiles,
  trucksBusy,
  B,
  F,
  C,
  K,
  ROT,
  follow: a => {
    follow = a;
    selected = a;
  }
});
load()
  .then(() => {
    setTimeout(async () => {
      try {
        const h = decodeURIComponent(location.hash || '');
        if (h.includes('NICE1.') || h.includes('SMAEY1.')) {
          applySnap(await decodeSnap(h));
          toast('Shared scene opened');
        }
      } catch (e) {}
    }, 2500);
    ALLOWGEN = true;
    BASE_N = B.length;
    BASE_T = NT;
    initAstar();
    buildGoto();
    initPop();
    initWild();
    window.__propsP.then(d => {
      if (d) {
        initProps(d);
        try {
          initAir(d);
        } catch (e) {
          console.warn(e);
        }
        SIDX = null;
        CACHE.clear();
        cachePx = 0;
      }
    });
    initSearch();
    initSeasonUI();
    applySeason(true);
    const p = ll(64.1428, -21.9262);
    centerOn(p[0] + 40, p[1] + 60);
    clampCam();
    lighting();
    recalc();
    READY = true;
    setTimeout(() => {
      $('#loading').hidden = true;
    }, 200);
    requestAnimationFrame(frame);
  })
  .catch(e => {
    console.error(e);
    $('#ldtxt').textContent = 'Could not load the map data: ' + e.message;
  });
