/**
 * User interface
 *
 * Buttons, toasts, Go-to menu, saving and share codes, and the inspector panel.
 *
 * Functions: setSpeed, toggleNight, updRotBtn, toast, __goLL, buildGoto, saveSnapshot, applySnap,
 *     encodeSnap, decodeSnap, shareBox, resetWorld, infoHTML, depthAt, segD, updUI
 * State and constants: toastT, GOTO_NAT, GOTO_EV, KEY, OLD_KEY, BASE_N, BASE_T, lastHTML
 */

function setSpeed(s) {
  speed = s;
  for (const b of document.querySelectorAll('#ctrl [data-s]')) b.classList.toggle('on', +b.dataset.s === s);
}
for (const b of document.querySelectorAll('#ctrl [data-s]')) b.onclick = () => setSpeed(+b.dataset.s);
function toggleNight() {
  const d = Math.floor(gameMin / 1440) * 1440;
  gameMin = dayL > 0.5 ? d + 22 * 60 : d + 1440 + 11 * 60;
}
$('#bNight').onclick = toggleNight;
$('#bPlayer').onclick = () => {
  startPlayer();
  updPlayBtn();
};
$('#rotL').onclick = () => rotate(-1);
$('#rotR').onclick = () => rotate(1);
$('#rotN').onclick = () => {
  if (ROT !== 7) rotate(7 - ROT);
};
function updRotBtn() {
  const ang = Math.atan2(-SYx, SYy);
  const i = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  $('#rotN').textContent = ['N', 'NA', 'A', 'SA', 'S', 'SV', 'V', 'NV'][i] + '↑';
  $('#rotN').classList.toggle('on', ROT === 7);
  $('#rotN').title = ROT === 7 ? 'North is up' : 'Turn north up';
}
$('#bRebuild').onclick = () => {
  rebuild = !rebuild;
  $('#bRebuild').classList.toggle('on', rebuild);
  $('#bRebuild').setAttribute('aria-pressed', rebuild);
  toast(rebuild ? 'Builders will rebuild on rubble' : 'Rubble stays where it falls');
};
let toastT = 0;
function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.hidden = false;
  t.style.opacity = 1;
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    t.style.opacity = 0;
    setTimeout(() => (t.hidden = true), 260);
  }, 2800);
}
function __goLL(la, lo, kk) {
  resetZoom();
  const w = ll(la, lo);
  startTR('fade');
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
}
const GOTO_NAT = [
  ['Geysir & Strokkur', 64.313, -20.3005, 1.6],
  ['Gullfoss', 64.3266, -20.1205, 1],
  ['Seljalandsfoss', 63.6155, -19.988, 1.4],
  ['Skógafoss', 63.5321, -19.5114, 1.2],
  ['Dettifoss', 65.8147, -16.3846, 0.9],
  ['Goðafoss', 65.6828, -17.5503, 1.2],
  ['Hellisheiðarvirkjun', 64.0368, -21.4, 0.35],
  ['Bláfjöll ski area', 63.981, -21.643, 0.9],
  ['Herjólfur · Landeyjahöfn', 63.53, -20.12, 0.35],
  ['Baldur · Stykkishólmur', 65.077, -22.727, 0.6],
  ['Gullfoss (tour coaches)', 64.3262, -20.12, 1],
  ['Hlíðarfjall ski area', 65.6605, -18.228, 0.9]
];
const GOTO_EV = [
  ['jun17', '17. júní (National Day)'],
  ['pride', 'Pride parade'],
  ['menning', 'Menningarnótt fireworks'],
  ['xmas', 'Christmas lights'],
  ['nye', "New Year's Eve"],
  ['thirteenth', 'Þrettándinn bonfires']
];
function buildGoto() {
  const gs = $('#goto');
  gs.innerHTML =
    '<option value="">Go to…</option><optgroup label="Places">' +
    GOTO.map((p, i) => '<option value="' + i + '">' + p[0] + '</option>').join('') +
    '</optgroup><optgroup label="Nature">' +
    GOTO_NAT.map((p, i) => '<option value="n' + i + '">' + p[0] + '</option>').join('') +
    '</optgroup><optgroup label="Events (jumps the calendar)">' +
    GOTO_EV.map(e => '<option value="ev:' + e[0] + '">' + e[1] + '</option>').join('') +
    '</optgroup>';
  gs.onchange = () => {
    const v = gs.value;
    if (v.startsWith('ev:')) {
      gotoEvent(v.slice(3));
      gs.value = '';
      return;
    }
    if (v[0] === 'n') {
      const q = GOTO_NAT[+v.slice(1)];
      if (q) __goLL(q[1], q[2], q[3]);
      gs.value = '';
      return;
    }
    const p = GOTO[+gs.value];
    if (!p) return;
    resetZoom();
    const w = ll(p[1], p[2]);
    startTR('fade');
    snapValid = false;
    let n = 0,
      bd = 1e9;
    LEVELS.forEach((v, i) => {
      const d = Math.abs(Math.log(v / p[3]));
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
    gs.value = '';
  };
}
const KEY = 'niceland-save-v2',
  OLD_KEY = 'smavik-save-v2';
/* ---- save / load / share: one compact snapshot of everything that differs from the real world ---- */
// Saves before v4 started the calendar on Saturday 17 October (day 289) instead of 15 June
const OLD_EPOCH_SHIFT = (289 - DOY0) * 1440;
function saveSnapshot() {
  const cells = [...MOD_CELLS];
  const bs = [],
    tr = [];
  for (let i = 0; i < BASE_N; i++) {
    const st = B[i].state === 3 ? 0 : B[i].state;
    if (st) bs.push(i, st);
  }
  for (let i = 0; i < BASE_T; i++) {
    const st = TREES.s[i] === 1 ? 0 : TREES.s[i];
    if (st) tr.push(i, st);
  }
  const g = pickGround(VW / 2, VH / 2);
  return {
    v: 4,
    m: Math.round(gameMin),
    sm: SEASON_MODE,
    wm: WEATHER_MODE,
    wx: WX,
    rot: ROT,
    cam: [Math.round(g[0]), Math.round(g[1]), +K.toFixed(3)],
    c: cells,
    t: cells.map(c => (gT(c) === LAVA ? ROCK : gT(c))),
    h: cells.map(c => gH(c)),
    cv: cells.map(c => gCov(c)),
    bs,
    tr,
    add: ADDED,
    an: animals.filter(a => a.keepA && !a.dead).map(a => [a.sp, Math.round(a.x), Math.round(a.y)]),
    geo: GEO.slice(GEO_BASE).map(g => [g.k, Math.round(g.x), Math.round(g.y), g.dx || 0, g.dy || 0])
  };
}
function applySnap(d) {
  resetWorld();
  for (let i = 0; i < d.c.length; i++) setCell(d.c[i], d.t[i], d.h[i], d.cv[i]);
  for (const a of d.add || []) addBuilding(new Float32Array(a.poly), a.o);
  if (d.v >= 3) {
    for (let i = 0; i + 1 < d.bs.length; i += 2) {
      const b = B[d.bs[i]],
        st = d.bs[i + 1];
      if (!b) continue;
      if (st === 2) {
        b.state = 2;
        rubbleList.push({ b, t: 20 });
      } else if (st === 9) {
        b.state = 9;
        if (inF(b.cx, b.cy)) clearCells(b);
      }
    }
    for (let i = 0; i + 1 < d.tr.length; i += 2) TREES.s[d.tr[i]] = d.tr[i + 1];
  } else {
    for (let i = 0; i < Math.min(BASE_N, d.bs.length); i++) {
      const s = +d.bs[i];
      if (s === 2) {
        B[i].state = 2;
        rubbleList.push({ b: B[i], t: 20 });
      } else if (s === 9) {
        B[i].state = 9;
        if (inF(B[i].cx, B[i].cy)) clearCells(B[i]);
      }
    }
    for (let i = 0; i < Math.min(BASE_T, d.tr.length); i++) TREES.s[i] = +d.tr[i];
  }
  for (const b of B)
    if (b.state === 3) {
      b.state = 0;
      b.prog = 1;
    }
  building.clear();
  for (const b of B) b.z = hAt(b.cx, b.cy);
  // saves before v4 counted days from 17 October; shift them so they keep their date and weekday
  gameMin = d.v >= 4 ? d.m : d.m + OLD_EPOCH_SHIFT;
  if (d.v >= 3) {
    GEO.length = GEO_BASE;
    for (const [k, x, y, dx, dy] of d.geo || []) {
      if (k === 'fall') {
        const g = { x, y, k: 'fall', name: '', geo: 1, id: GEO.length, H: 25, W: 12, dx, dy, z: null };
        GEO.push(g);
        fallGeom(g);
      } else
        GEO.push({
          x,
          y,
          k,
          name: '',
          geo: 1,
          id: GEO.length,
          pool: k === 'geyser' ? 6 : 3,
          blue: true,
          next: 3,
          z: null
        });
    }
    for (const [sp, x, y] of d.an || []) {
      const c = cellAt(x, y),
        w = c >= 0 && isWaterT(gT(c));
      const a = mkAnimal(
        sp,
        x,
        y,
        w && ['whale', 'swan', 'eider', 'seal', 'duck', 'goose'].includes(sp),
        null
      );
      a.keepA = 1;
      if (sp === 'whale' && !w) {
        a.state = 'surf';
        a.t = 1e9;
      }
      animals.push(a);
    }
    SEASON_MODE = d.sm || 'auto';
    WEATHER_MODE = d.wm || 'auto';
    const ss = $('#season'),
      ws = $('#weather');
    if (ss) ss.value = SEASON_MODE;
    if (ws) ws.value = WEATHER_MODE;
    applySeason(true);
    if (d.wx) setWeather(d.wx, true);
    if (d.rot !== undefined && d.rot !== ROT) setRot(d.rot);
    if (d.cam) window.__gow(d.cam[0], d.cam[1], d.cam[2]);
  }
  lighting();
  CACHE.clear();
  cachePx = 0;
  statsDirty = true;
}
async function encodeSnap(d) {
  const bytes = new TextEncoder().encode(JSON.stringify(d));
  const z = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();
  let bin = '';
  const u = new Uint8Array(z);
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
  return 'NICE1.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function decodeSnap(code) {
  code = (code || '').trim().replace(/^.*?(?:NICE|SMAEY)1\./, '');
  const b = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return JSON.parse(
    await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
  );
}
$('#bSave').onclick = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(saveSnapshot()));
    toast('Saved in this browser');
  } catch (e) {
    toast('Saving is blocked in this browser');
  }
};
$('#bLoad').onclick = () => {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || 'null');
  } catch (e) {
    d = null;
  }
  if (!d) {
    toast('No saved game yet. Press Save first');
    return;
  }
  applySnap(d);
  toast('Saved game loaded');
};
function shareBox(code) {
  let el = $('#sharebox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sharebox';
    el.className = 'panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Share this scene');
    el.innerHTML =
      '<h3 style="margin:0 0 4px;font-size:16px">Share this scene</h3><p style="margin:0 0 8px;color:var(--mist);font-size:12px">The code holds the time, season, weather, view and everything you have built, broken or placed. Send it to someone; they paste it here and press Open.</p><textarea id="sharecode" spellcheck="false" rows="5"></textarea><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn" id="shcopy">Copy code</button><button class="btn" id="shopen">Open pasted code</button><button class="btn" id="shclose">Close</button></div><div id="shmsg" style="font-size:12px;color:var(--mist);margin-top:6px"></div>';
    document.body.appendChild(el);
    el.addEventListener('keydown', e => e.stopPropagation());
    $('#shclose').onclick = () => {
      el.hidden = true;
    };
    $('#shcopy').onclick = async () => {
      const t = $('#sharecode');
      t.select();
      try {
        await navigator.clipboard.writeText(t.value);
        $('#shmsg').textContent = 'Copied.';
      } catch (e) {
        try {
          document.execCommand('copy');
          $('#shmsg').textContent = 'Copied.';
        } catch (e2) {
          $('#shmsg').textContent = 'Select the code and copy it.';
        }
      }
    };
    $('#shopen').onclick = async () => {
      try {
        const d = await decodeSnap($('#sharecode').value);
        applySnap(d);
        el.hidden = true;
        toast('Shared scene opened');
      } catch (e) {
        $('#shmsg').textContent = 'That code could not be read. Check that all of it was pasted.';
      }
    };
  }
  el.hidden = false;
  $('#sharecode').value = code || '';
  $('#shmsg').textContent = code
    ? Math.round((code.length / 1024) * 10) / 10 + ' KB code. Anyone with Niceland can open it.'
    : 'Paste a code someone sent you, then press Open.';
}
$('#bShare').onclick = async () => {
  try {
    const code = await encodeSnap(saveSnapshot());
    shareBox(code);
  } catch (e) {
    console.warn(e);
    toast('Could not make a share code in this browser');
  }
};
function resetWorld() {
  TILES.clear();
  animals = [];
  for (const g of [F, C]) {
    g.GT.set(g.OGT);
    g.HT.set(g.OHT);
    g.COVER.fill(0);
    g.LV.fill(0);
    g.LH.fill(0);
  }
  lavaTiles.clear();
  srcSet.clear();
  lavaActive = [];
  volcanoes = [];
  MOD_CELLS.clear();
  for (const b of B) {
    if (b.isNew) {
      b.state = 9;
      continue;
    }
    b.state = 0;
    b.hp = 100;
    b.fire = 0;
    b.prog = 1;
    b.rb = 0;
    b.fly = 0;
    b.z = hAtFast(b.cx, b.cy);
  }
  ENTS.length = 0;
  ZONES.clear();
  for (let i = AREAS.length - 1; i >= 0; i--) if (AREAS[i].custom) AREAS[i].until = 0;
  hazards.length = 0;
  bolts.length = 0;
  if (typeof CTRL !== 'undefined') CTRL = null;
  snowAcc = 0;
  lastHTML = '';
  {
    const g = B.filter(b => b.group === 'hall');
    if (g.length) {
      const z = Math.min(...g.map(b => b.z));
      for (const b of g) b.z = z;
    }
  }
  {
    const G = new Map();
    for (const b of B)
      if ((b.lm || b.po) && b.group) {
        if (!G.has(b.group)) G.set(b.group, []);
        G.get(b.group).push(b);
      }
    for (const g of G.values()) {
      const z = Math.min(...g.map(b => b.z));
      for (const b of g) b.z = z;
    }
  }
  burning.clear();
  burningT.clear();
  building.clear();
  rubbleList = [];
  TREES.s.fill(0);
  for (let i = BASE_T; i < NT; i++) TREES.s[i] = 3;
  agents = [];
  parts = [];
  flood = 0;
  floodT = 0;
  quake = null;
  rainT = 0;
  follow = null;
  selected = null;
  F.CBLD.fill(-1);
  for (const b of B) if (b.state !== 9 && inF(b.cx, b.cy)) rasterB(b);
  CACHE.clear();
  cachePx = 0;
  statsDirty = true;
}
$('#bReset').onclick = () => {
  resetWorld();
  toast('Iceland restored');
};
let BASE_N = 0,
  BASE_T = 0;
function infoHTML() {
  if (CTRL) {
    const c = playCard();
    if (c) return c;
  }
  const a = follow || selected || hoverA;
  if (a && !a.dead) {
    if (a.geo) return geoCard(a);
    if (a.boat) return boatCard(a);
    if (a.plane) return planeCard(a);
    if (a.animal) return animalCard(a);
    if (a.car && a.kind !== 'truck' && !a.cop) return carCard(a);
    if (a.car)
      return {
        h:
          '<h3>' +
          (a.vname
            ? a.vname.split(' · ')[0]
            : a.kind === 'bus'
              ? 'Strætó'
              : a.kind === 'truck'
                ? 'Slökkvibíll'
                : 'Bíll') +
          '</h3><div class="sub">' +
          (a.vname
            ? a.vname.split(' · ')[1]
            : a.kind === 'bus'
              ? 'City bus'
              : a.kind === 'truck'
                ? 'Fire engine'
                : 'Car') +
          '</div><div class="row"><span>Speed</span><span>' +
          Math.round(a.sp * 3.6) +
          ' km/h</span></div><div class="row"><span>Area</span><span>' +
          district(a.x, a.y) +
          '</span></div>' +
          (a.kind !== 'truck' ? '<button class="btn" id="doplay">Drive</button>' : ''),
        m: a.kind === 'bus' ? 'Strætó' : 'Car'
      };
    const mood = a.flee
      ? 'Panicking'
      : a.watch
        ? 'Curious'
        : a.bubble && a.chat
          ? 'Chatting'
          : a.kind === 'party'
            ? 'Cheerful'
            : rainT > 0
              ? 'Damp'
              : 'Calm';
    return {
      h:
        '<h3>' +
        a.name +
        '</h3><div class="sub">' +
        a.job +
        (a.age ? ' · ' + a.age + ' ára' : '') +
        '</div><div class="act">' +
        (a.flee
          ? 'Running for safety!'
          : a.watch
            ? 'Watching the fire'
            : a.state === 'idle' && a.chat
              ? 'Chatting with ' + a.chat.name.split(' ')[0]
              : a.act || 'Out and about') +
        (a.dest && !a.flee && !a.watch
          ? ' → ' + (a.dest.name || a.dest.addr || district(a.dest.cx, a.dest.cy))
          : '') +
        '</div>' +
        '<div class="row"><span>Lives at</span><span>' +
        (a.homeAddr || '—') +
        '</span></div>' +
        (a.persona && workOf(a.persona) && a.persona.stage !== 'retired'
          ? '<div class="row"><span>Works at</span><span>' +
            (a.persona.work.name || a.persona.work.addr || district(a.persona.work.cx, a.persona.work.cy)) +
            '</span></div>'
          : '') +
        (a.persona && a.home
          ? '<div class="row"><span>Household</span><span>' + wealthWord(bWealth(a.home)) + '</span></div>'
          : '') +
        '<div class="row"><span>Area</span><span>' +
        district(a.x, a.y) +
        '</span></div><div class="row"><span>Mood</span><span>' +
        mood +
        '</span></div>' +
        (a.bubble ? '<div class="row"><span>Says</span><span>“' + a.bubble + '”</span></div>' : '') +
        (follow === a || selected === a ? planHTML(a) : '') +
        (follow === a
          ? '<button class="btn" id="unfollow">Stop following</button>'
          : '<button class="btn" id="dofollow">Follow</button>') +
        ' <button class="btn" id="doplay">Play as</button>',
      m: a.name + ' · ' + (a.act || '')
    };
  }
  const b = selB && selB.state !== 9 ? selB : hoverB;
  if (b) {
    const kn = [
      'House',
      'Terraced house',
      'Apartment block',
      'Garage or shed',
      'Commercial building',
      'Industrial building',
      'Public building',
      'Church',
      'Landmark'
    ][b.kind];
    const ttl =
      b.name ||
      b.addr ||
      [
        'Hús',
        'Raðhús',
        'Fjölbýlishús',
        'Bílskúr',
        'Verslunarhús',
        'Iðnaðarhús',
        'Opinber bygging',
        'Kirkja',
        'Kennileiti'
      ][b.kind];
    const st =
      b.state === 2
        ? 'Rubble'
        : b.state === 3
          ? 'Under construction ' + Math.round(b.prog * 100) + '%'
          : b.fire > 0
            ? 'On fire'
            : b.hp < 60
              ? 'Damaged'
              : 'Standing';
    return {
      h:
        '<h3>' +
        ttl +
        '</h3><div class="sub">' +
        kn +
        (b.name && b.addr ? ' · ' + b.addr : '') +
        '</div><div class="row"><span>Place</span><span>' +
        district(b.cx, b.cy) +
        '</span></div><div class="row"><span>Height</span><span>' +
        (b.group ? '74.5' : b.h.toFixed(1)) +
        ' m</span></div><div class="row"><span>Footprint</span><span>' +
        Math.round(b.area) +
        ' m²</span></div>' +
        (b.res
          ? '<div class="row"><span>Residents</span><span>' +
            Math.max(1, Math.round(b.res * POPF)) +
            '</span></div>'
          : '') +
        (b.jobs ? '<div class="row"><span>Jobs</span><span>' + b.jobs + '</span></div>' : '') +
        (b.oh ? ohRow(b) : '') +
        '<div class="row"><span>Status</span><span>' +
        st +
        '</span></div><div class="bar' +
        (b.hp < 50 ? ' low' : '') +
        '"><i style="width:' +
        Math.max(0, b.hp) +
        '%"></i></div>',
      m: ttl + ' · ' + district(b.cx, b.cy)
    };
  }
  if (hover && K >= 0.2) {
    const sc = skiCard(hover[0], hover[1]);
    if (sc) return sc;
  }
  if (hover && K >= 0.4) {
    const xc = extraCard(hover[0], hover[1]);
    if (xc) return xc;
  }
  if (hover && PROPS_OK) {
    const A = areaAt(hover[0], hover[1]);
    if (A) return areaCard(A);
  }
  if (hover) {
    const [x, y] = hover;
    const c = cellAt(x, y);
    if (c < 0) return null;
    const t = gT(c);
    let nm = gName(c);
    let road = '';
    eachB2(SBUCK, x - 14, y - 14, x + 14, y + 14, (w, j) => {
      const wy = WAYS[w];
      if (!wy.name) return;
      const n0 = wy.nodes[j],
        n1 = wy.nodes[j + 1];
      const d = segD(x, y, NX[n0], NY[n0], NX[n1], NY[n1]);
      if (d < 12 && !road) road = wy.name;
    });
    const h = Math.round(hAt(x, y));
    return {
      h:
        '<h3>' +
        (road || nm || GNAME[t]) +
        '</h3><div class="sub">' +
        GEN[t] +
        (nm && road ? ' · ' + nm : '') +
        '</div><div class="row"><span>Place</span><span>' +
        (t === SEA ? '—' : district(x, y)) +
        '</span></div><div class="row"><span>Elevation</span><span>' +
        (t === SEA ? (depthAt(x, y) < -2 ? 'Depth ' + -depthAt(x, y) + ' m' : 'Sea level') : h + ' m') +
        '</span></div>' +
        (t === LAVA
          ? '<div class="row"><span>Lava</span><span>' + Math.round(gLH(c)) + ' s until it cools</span></div>'
          : ''),
      m: road || nm || GNAME[t]
    };
  }
  return null;
}
function depthAt(x, y) {
  const i = Math.floor((x - C.OX) / C.CS),
    j = Math.floor((y - C.OY) / C.CS);
  if (i < 0 || j < 0 || i >= C.W || j >= C.H) return 0;
  return C.HT[i + j * C.W];
}
function segD(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    L = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / L;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
let lastHTML = '';
function updUI() {
  if (statsDirty) recalc();
  let out = 0;
  for (const a of agents) if (!a.dead && !a.car) out++;
  $('#sPop').textContent = pop.toLocaleString('en-GB');
  $('#sOut').textContent = out;
  $('#sBld').textContent = nb.toLocaleString('en-GB');
  $('#sFire').textContent = burning.size;
  $('#sFireBox').classList.toggle('hot', burning.size > 0);
  const m = Math.floor(gameMin % 1440);
  $('#sClock').textContent =
    String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  $('#sDay').textContent = DAYS[dayOfWeek()].slice(0, 3) + ' · ' + dateStr();
  $('#sWx').textContent = WX_IS[WXN && wxA < 0.5 ? WXN : WX] + ' ' + Math.round(TEMP) + '°';
  $('#sSeas').textContent = SEAS_IS[SEAS] + ' · veður';
  $('#bNight').textContent = dayL > 0.5 ? 'Night' : 'Day';
  if (hoverMove && !panning && tool === 'inspect') {
    const r = pickAt(hoverMove[0], hoverMove[1]);
    hoverB = r.b;
    hoverA = r.a;
  } else if (tool !== 'inspect') {
    hoverB = null;
    hoverA = null;
  }
  const f = infoHTML();
  let html = f
    ? f.h
    : '<h3>Ísland</h3><div class="sub">' +
      B.length.toLocaleString('en-GB') +
      ' buildings from OpenStreetMap, each at its true size and place, on real terrain.</div><div class="row"><span>Pan</span><span>Drag or arrows</span></div><div class="row"><span>Zoom</span><span>Scroll, pinch or + −</span></div><div class="row"><span>Rotate</span><span>Q / E or two-finger twist</span></div><div class="row"><span>People</span><span>Zoom in close</span></div>';
  if (K < 0.27 && !f) html += '<div class="act">Zoom in to see people and traffic.</div>';
  if (html !== lastHTML) {
    $('#insp').innerHTML = html;
    lastHTML = html;
    const fb = $('#dofollow'),
      ub = $('#unfollow');
    if (fb)
      fb.onclick = () => {
        follow = follow || selected || hoverA;
      };
    if (ub)
      ub.onclick = () => {
        follow = null;
        selected = null;
      };
    const pb = $('#doplay'),
      sb = $('#stopplay');
    if (pb)
      pb.onclick = () => {
        playAs(follow || selected || hoverA);
        lastHTML = '';
      };
    if (sb)
      sb.onclick = () => {
        stopPlay();
        lastHTML = '';
      };
  }
  $('#mobinfo').textContent = f ? f.m : '';
}
