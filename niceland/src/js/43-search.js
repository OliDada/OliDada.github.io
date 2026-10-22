/**
 * Search
 *
 * The search box and jumping to places.
 *
 * Functions: fold, buildSearch, searchQ, goTo, nearestLevel, drawHilite, initSearch
 * State and constants: FOLD, SIDX, hilite
 */

const FOLD = { 'þ': 'th', 'ð': 'd', 'æ': 'ae', 'ö': 'o', 'ø': 'o', 'å': 'a' };
function fold(s) {
  return s
    .toLowerCase()
    .replace(/[þðæöøå]/g, c => FOLD[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
let SIDX = null;
function buildSearch() {
  SIDX = [];
  const seen = new Set();
  const add = (label, kind, x, y, k, rank, extra) => {
    SIDX.push({ label, f: fold(label), kind, x, y, k, rank, extra });
  };
  for (const p of PLACES) {
    const kind = p[3],
      pop = +p[4] || 0;
    const kd =
      {
        city: 'City',
        town: 'Town',
        village: 'Village',
        hamlet: 'Hamlet',
        suburb: 'Neighbourhood',
        neighbourhood: 'Neighbourhood',
        peak: 'Mountain',
        volcano: 'Volcano',
        locality: 'Place',
        island: 'Island',
        farm: 'Farm',
        isolated_dwelling: 'Farm'
      }[kind] || 'Place';
    add(
      p[2],
      kd,
      p[0] * 0.5,
      p[1] * 0.5,
      kind === 'peak' || kind === 'volcano' ? 0.078 : kind === 'city' ? 0.12 : kind === 'town' ? 0.27 : 0.4,
      kind === 'city'
        ? 100
        : kind === 'town'
          ? 80 + Math.min(15, pop / 2000)
          : kind === 'volcano'
            ? 70
            : kind === 'village'
              ? 60
              : kind === 'peak'
                ? 40 + Math.min(20, pop / 100)
                : 50
    );
  }
  for (const d of DIST) add(d.n, 'Neighbourhood in Reykjavík', d.x, d.y, 0.4, 75);
  for (const g of GOTO) {
    const w = ll(g[1], g[2]);
    add(g[0], 'Sight', w[0], w[1], g[3], 90);
  }
  // streets: one entry per street name per ~4 km, at its middle
  const st = new Map();
  for (const w of WAYS) {
    if (!w.name || w.cl > 7 || w.cl === 10) continue;
    const n = w.nodes;
    if (!n.length) continue;
    const m = n[(n.length / 2) | 0];
    const x = NX[m],
      y = NY[m];
    const key = w.name + '|' + Math.round(x / 4000) + ',' + Math.round(y / 4000);
    const e = st.get(key);
    if (!e) st.set(key, { name: w.name, x, y, len: n.length });
    else if (n.length > e.len) {
      e.x = x;
      e.y = y;
      e.len = n.length;
    }
  }
  for (const e of st.values()) add(e.name, 'Street', e.x, e.y, 0.9, 30);
  // named buildings and addresses
  for (const b of B) {
    if (b.state === 9) continue;
    if (b.name && !seen.has(b.name + '@' + Math.round(b.cx / 200) + ',' + Math.round(b.cy / 200))) {
      seen.add(b.name + '@' + Math.round(b.cx / 200) + ',' + Math.round(b.cy / 200));
      add(b.name, 'Building', b.cx, b.cy, b.h > 20 ? 0.9 : 1.35, b.sp ? 95 : b.kind >= 6 ? 45 : 35, b);
    }
    if (b.addr && !b.addr.startsWith('við ')) {
      add(b.addr, 'Address', b.cx, b.cy, 2, 20, b);
    }
  }
  if (PROPS_OK)
    for (const A of AREAS) {
      if (!A.name || A.c === AK.PARKING) continue;
      const inf = AREA_INFO[A.c];
      add(
        A.name,
        inf ? inf[1] : 'Place',
        A.cx,
        A.cy,
        A.area > 40000 ? 0.6 : A.area > 5000 ? 1.35 : 2,
        A.c === AK.POOL ? 70 : A.c === AK.PARK ? 60 : 50
      );
    }
}
function searchQ(q) {
  if (!SIDX) buildSearch();
  const f = fold(q);
  if (!f) return [];
  const out = [];
  const m = f.match(/^([^\d]*?)\s*(\d+)\s*([a-z]?)$/);
  const sNum = m ? +m[2] : null,
    sSt = m ? m[1].trim() : null;
  for (const e of SIDX) {
    let s = -1;
    if (e.f === f) s = 300;
    else if (e.f.startsWith(f)) s = 200 - Math.min(50, (e.f.length - f.length) * 2);
    else {
      const i = e.f.indexOf(' ' + f);
      if (i >= 0) s = 120;
      else if (f.length >= 3 && e.f.includes(f)) s = 50;
    }
    if (s < 0 && sNum !== null && sSt) {
      if (e.kind === 'Address') {
        const mm = e.f.match(/^([^\d]*?)\s*(\d+)[a-z]?(?:\s+(\d+))?/);
        if (mm && mm[1].trim() === sSt) {
          const a = +mm[2],
            b2 = mm[3] ? +mm[3] : a;
          if (sNum >= a && sNum <= b2) s = 420;
          else if (Math.abs(sNum - a) <= 6) s = 150 - Math.abs(sNum - a) * 5;
        }
      } else if (e.kind === 'Street' && e.f === sSt) s = 230;
    }
    if (s < 0) continue;
    out.push([s + e.rank * 2, e]);
  }
  out.sort((a, b) => b[0] - a[0]);
  const res = [],
    dd = new Set();
  for (const [, e] of out) {
    const key = e.f + '|' + e.kind + '|' + Math.round(e.x / 300) + ',' + Math.round(e.y / 300);
    if (dd.has(key)) continue;
    dd.add(key);
    res.push(e);
    if (res.length >= 8) break;
  }
  return res;
}
function goTo(e) {
  resetZoom();
  const ki = nearestLevel(e.k);
  startTR('fade');
  snapValid = false;
  li = ki;
  K = LEVELS[li];
  centerOn(e.x, e.y);
  clampCam();
  follow = null;
  if (e.extra && e.extra.cx !== undefined) {
    selB = e.extra;
  }
  hilite = { x: e.x, y: e.y, t: 4 };
  toast(e.label);
}
function nearestLevel(k) {
  let n = 0,
    bd = 1e9;
  LEVELS.forEach((v, i) => {
    const d = Math.abs(Math.log(v / k));
    if (d < bd) {
      bd = d;
      n = i;
    }
  });
  return n;
}
let hilite = null;
function drawHilite() {
  if (!hilite) return;
  hilite.t -= 1 / 60;
  if (hilite.t <= 0) {
    hilite = null;
    return;
  }
  const s = sp_(hilite.x, hilite.y, hAt(hilite.x, hilite.y));
  const a = Math.min(1, hilite.t);
  const r = 6 + ((4 - hilite.t) % 1) * 14;
  ctx.strokeStyle = 'rgba(240,199,94,' + a + ')';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(Math.round(s[0]) + 0.5, Math.round(s[1]) + 0.5, r, r / 2, 0, 0, 7);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,199,94,' + a + ')';
  ctx.fillRect(Math.round(s[0]) - 1, Math.round(s[1]) - 14, 3, 10);
}
function initSearch() {
  const q = $('#q'),
    box = $('#qres');
  let cur = [],
    sel = 0;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const render = () => {
    if (!cur.length) {
      box.hidden = !q.value.trim();
      box.innerHTML = q.value.trim() ? '<div class="qe">No matches</div>' : '';
      return;
    }
    box.hidden = false;
    box.innerHTML = cur
      .map(
        (e, i) =>
          '<button class="qi' +
          (i === sel ? ' on' : '') +
          '" data-i="' +
          i +
          '"><b>' +
          esc(e.label) +
          '</b><span>' +
          esc(
            e.kind +
              (e.kind === 'Address' || e.kind === 'Building' || e.kind === 'Street'
                ? ' · ' + district(e.x, e.y)
                : '')
          ) +
          '</span></button>'
      )
      .join('');
    box.querySelectorAll('.qi').forEach(
      bt =>
        (bt.onmousedown = ev => {
          ev.preventDefault();
          pick(+bt.dataset.i);
        })
    );
  };
  const pick = i => {
    const e = cur[i];
    if (!e) return;
    goTo(e);
    q.blur();
    box.hidden = true;
  };
  let tm = 0;
  q.addEventListener('input', () => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      cur = searchQ(q.value);
      sel = 0;
      render();
    }, 60);
  });
  q.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'ArrowDown') {
      sel = Math.min(cur.length - 1, sel + 1);
      render();
      ev.preventDefault();
    } else if (ev.key === 'ArrowUp') {
      sel = Math.max(0, sel - 1);
      render();
      ev.preventDefault();
    } else if (ev.key === 'Enter') {
      pick(sel);
    } else if (ev.key === 'Escape') {
      q.value = '';
      cur = [];
      render();
      q.blur();
    }
  });
  q.addEventListener('keyup', ev => ev.stopPropagation());
  q.addEventListener('focus', () => {
    if (!SIDX) setTimeout(buildSearch, 0);
    if (cur.length) box.hidden = false;
  });
  q.addEventListener('blur', () => setTimeout(() => (box.hidden = true), 120));
  addEventListener('keydown', ev => {
    if (ev.key === '/' && document.activeElement !== q && document.activeElement.tagName !== 'INPUT') {
      ev.preventDefault();
      q.focus();
    }
  });
}
