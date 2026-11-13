// Slice — a daily game. Cut each shape exactly in half with one swipe.
// No backend: the date picks the day's shapes, so everyone gets the same set.
(() => {
const INK = '#1E1B24', $ = id => document.getElementById(id);
const S = 420;                       // mask resolution
const PER_DAY = 5;
const LAUNCH = [2026, 10, 12];       // Slice #1 = 12 Nov 2026 (month is 0-based)
const SHAPES = window.SLICE_SHAPES;

/* ---------- day + seeded randomness ---------- */
function localDay(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; }
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Every shape appears once per cycle; each appearance gets new proportions, tilt and flip.
function shapesForDay(day) {
  const perCycle = Math.floor(SHAPES.length / PER_DAY), cycle = Math.floor((day - 1) / perCycle), slot = (day - 1) % perCycle;
  const order = shuffle(SHAPES.map((_, i) => i), mulberry(cycle * 7919 + 17));
  const r = mulberry(day * 104729 + 3);
  return order.slice(slot * PER_DAY, slot * PER_DAY + PER_DAY).map(i => ({ shape: SHAPES[i], seed: Math.floor(r() * 1e9) }));
}

/* ---------- drawing helper handed to the shapes ---------- */
function helper(c, deco) {
  const h = {
    col(x) { if (deco) { c.fillStyle = x; c.strokeStyle = x; } return h; },
    e(x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, 7); c.fill(); return h; },
    o(x, y, r) { return h.e(x, y, r, r); },
    rr(x, y, w, hh, r = 0) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); c.fill(); return h; },
    p(pts) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); return h; },
    l(pts, w) { c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); return h; },
    q(x0, y0, cx, cy, x1, y1, w) { c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); return h; },
    ring(x, y, rx, ry, w, rot = 0) { c.lineWidth = w; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.stroke(); return h; },
    path(fn) { c.beginPath(); fn(c); c.fill(); return h; },
    spiral(x, y, R, w) { c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); for (let t = 0; t < 12.5; t += .1) { const rr = R * t / 12.5; const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr; t ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); return h; }
  };
  return h;
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mix(hex, t) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; const m = v => Math.round(v + (255 - v) * t); return `rgb(${m(r)},${m(g)},${m(b)})`; }

function build(item) {
  const sh = item.shape, r = mulberry(item.seed), v = sh.p(r);
  const tilt = (r() - .5) * .9, flip = r() < .5;
  const draw = (c, k, dx, dy, deco) => {
    c.save(); c.translate(S / 2 + dx, S / 2 + dy); c.rotate(tilt); c.scale(flip ? -k : k, k); c.translate(-100, -100);
    c.fillStyle = '#000'; c.strokeStyle = '#000';
    const h = helper(c, deco); deco ? sh.deco(h, v) : sh.draw(h, v); c.restore();
  };
  // pass 1: find bounds, pass 2: fit to frame
  const probe = mk(S, S), pc = probe.getContext('2d'); draw(pc, 1, 0, 0, false);
  let d = pc.getImageData(0, 0, S, S).data, x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const k = .86 * S / Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2 - S / 2, cy = (y0 + y1) / 2 - S / 2;
  const mask = mk(S, S), m = mask.getContext('2d'); draw(m, k, -cx * k, -cy * k, false);
  const col = mk(S, S), c = col.getContext('2d'); c.drawImage(mask, 0, 0);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = sh.color; c.fillRect(0, 0, S, S);
  c.globalCompositeOperation = 'source-atop'; draw(c, k, -cx * k, -cy * k, true);
  const shade = mk(S, S), sc = shade.getContext('2d'); sc.fillStyle = 'rgba(30,27,36,.10)'; sc.fillRect(0, 0, S, S);
  sc.globalCompositeOperation = 'destination-out'; sc.drawImage(mask, 0, -10); c.drawImage(shade, 0, 0);
  const P = 16, spr = mk(S + P * 2, S + P * 2), s = spr.getContext('2d');
  const ink = mk(S, S), ic = ink.getContext('2d'); ic.drawImage(mask, 0, 0); ic.globalCompositeOperation = 'source-in'; ic.fillStyle = INK; ic.fillRect(0, 0, S, S);
  for (let a = 0; a < 24; a++) s.drawImage(ink, P + Math.cos(a / 24 * 6.283) * 6, P + Math.sin(a / 24 * 6.283) * 6);
  s.drawImage(col, P, P);
  d = m.getImageData(0, 0, S, S).data; let total = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) total++;
  return { sh, mask, spr, P, data: d, total, bg: mix(sh.color === '#FFFFFF' || sh.color === '#F4F1EA' ? '#9AA3B2' : sh.color, .86) };
}

/* ---------- saved progress (per visitor, per day) ---------- */
const KEY = 'slice:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { cuts: [] });

/* ---------- audio ---------- */
let ac = null, muted = false;
try { muted = localStorage.getItem('slice:muted') === '1'; } catch (e) {}
$('mute').textContent = muted ? '🔈' : '🔊';
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .08, vol = .07, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function swish() {
  if (!ac || muted) return; const t = ac.currentTime, len = ac.sampleRate * .25, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(900, t + .2);
  const g = ac.createGain(); g.gain.value = .5; s.connect(f).connect(g).connect(ac.destination); s.start(t);
  const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(160, t + .03); o.frequency.exponentialRampToValueAtTime(60, t + .2);
  og.gain.setValueAtTime(.25, t + .03); og.gain.exponentialRampToValueAtTime(.0001, t + .22); o.connect(og).connect(ac.destination); o.start(t + .03); o.stop(t + .25);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? '🔈' : '🔊'; try { localStorage.setItem('slice:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d'); let W = 0, DPR = 1, scale = 1, ox = 0, oy = 0;
function resize() { DPR = Math.min(3, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = r.width; cv.width = W * DPR; cv.height = W * DPR; scale = W * .8 / S; ox = (W - S * scale) / 2; oy = (W - S * scale) / 2; }
addEventListener('resize', resize);

/* ---------- state ---------- */
const items = shapesForDay(DAY);
const built = items.map(build);
let R = 0, B, mode = 'aim', drag = null, cut = null, cutT = 0, verdictShown = false;
$('dayNo').textContent = '#' + DAY;

function startRound(i) {
  R = i; B = built[i]; mode = 'aim'; drag = null; cut = null; verdictShown = false;
  document.documentElement.style.setProperty('--bg', B.bg);
  $('name').textContent = B.sh.name; $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('result').classList.remove('show'); $('hint').style.opacity = 1;
  $('hint').textContent = i === 0 ? 'Swipe once to cut it exactly in half' : 'One cut. Make it count.';
  renderDots();
}
function renderDots() { $('dots').innerHTML = built.map((_, i) => { const r = today.cuts[i]; return `<div class="dot ${r ? r.c : ''} ${i === R && !r ? 'on' : ''}"></div>`; }).join(''); }

/* ---------- input ---------- */
const stage = $('stage');
function pt(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
stage.addEventListener('pointerdown', e => { if (mode !== 'aim') return; audio(); stage.setPointerCapture(e.pointerId); const p = pt(e); drag = { a: p, b: p }; $('hint').style.opacity = 0; });
stage.addEventListener('pointermove', e => { if (drag) { const p = pt(e); if (Math.hypot(p[0] - drag.b[0], p[1] - drag.b[1]) > 6 && Math.random() < .3) blip(1800 + Math.random() * 600, .02, .012, 'sine'); drag.b = p; } });
stage.addEventListener('pointerup', () => { if (!drag) return; const d = drag; drag = null; if (Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) < 24) return; doCut(d.a, d.b); });
stage.addEventListener('pointercancel', () => drag = null);

/* ---------- the cut ---------- */
function toMask(p) { return [(p[0] - ox) / scale, (p[1] - oy) / scale]; }
function doCut(a, b) {
  const A = toMask(a), Bp = toMask(b); let dx = Bp[0] - A[0], dy = Bp[1] - A[1]; const L = Math.hypot(dx, dy); dx /= L; dy /= L; const nx = -dy, ny = dx;
  let c1 = 0, sx1 = 0, sy1 = 0, sx2 = 0, sy2 = 0; const data = B.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (data[(y * S + x) * 4 + 3] <= 127) continue;
    if ((x + .5 - A[0]) * nx + (y + .5 - A[1]) * ny > 0) { c1++; sx1 += x; sy1 += y; } else { sx2 += x; sy2 += y; }
  }
  const c2 = B.total - c1;
  if (c1 < B.total * .002 || c2 < B.total * .002) {
    $('hint').textContent = 'Missed! Cut through the shape'; $('hint').style.opacity = 1; blip(200, .15, .06, 'sine');
    stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); return;
  }
  const p1 = c1 / B.total * 100, p2 = 100 - p1;
  const mkPiece = sign => {
    const P = B.P, cnv = mk(S + P * 2, S + P * 2), c = cnv.getContext('2d'); c.drawImage(B.spr, 0, 0);
    c.globalCompositeOperation = 'destination-in'; c.beginPath(); const ax = A[0] + P, ay = A[1] + P, BIG = 2000;
    c.moveTo(ax - dx * BIG, ay - dy * BIG); c.lineTo(ax + dx * BIG, ay + dy * BIG); c.lineTo(ax + dx * BIG + nx * BIG * sign, ay + dy * BIG + ny * BIG * sign); c.lineTo(ax - dx * BIG + nx * BIG * sign, ay - dy * BIG + ny * BIG * sign); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-atop'; c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.moveTo(ax - dx * BIG, ay - dy * BIG); c.lineTo(ax + dx * BIG, ay + dy * BIG); c.stroke(); return cnv;
  };
  cut = { nx, ny, p1, p2, s1: mkPiece(1), s2: mkPiece(-1), c1: [sx1 / c1, sy1 / c1], c2: [sx2 / c2, sy2 / c2], line: [a, b] };
  mode = 'cut'; cutT = performance.now();
  const small = Math.min(p1, p2); today.cuts[R] = { small: Math.round(small * 10) / 10, c: grade(small)[0] }; save();
  swish(); buzz(25); $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
  stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
}
function grade(small) { if (small >= 49.5) return ['g', 'Razor sharp']; if (small >= 48) return ['y', 'Nice cut']; if (small >= 45) return ['o', 'Bit wonky']; return ['r', 'Lopsided']; }
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
function showVerdict() {
  verdictShown = true; const small = Math.min(cut.p1, cut.p2), [c, label] = grade(small);
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  $('vtxt').innerHTML = `${f1(small)} / ${f1(100 - small)}<small>${small >= 49.95 ? 'A perfect half.' : 'Off by ' + f1(50 - small) + ' percentage points'}</small>`;
  $('result').classList.add('show'); $('next').textContent = R < PER_DAY - 1 ? 'Next shape' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .09, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  renderDots();
}
$('next').onclick = () => { audio(); blip(600, .06, .06); const n = today.cuts.length; if (n < PER_DAY) startRound(n); else showEnd(true); };

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const acc = cuts => cuts.reduce((a, r) => a + (100 - 2 * (50 - r.small)), 0) / cuts.length;
function streak() {
  let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.cuts.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s;
}
function shareStr() { return `Slice #${DAY} 🔪 ${f1(acc(today.cuts))}%\n${today.cuts.map(r => SQ[r.c]).join('')}\nolid.is/slice`; }
function showEnd(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); document.documentElement.style.setProperty('--bg', '#F4EFE6');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = f1(acc(today.cuts)) + '<small>%</small>';
  $('rcard').innerHTML = built.map((b, i) => `<div class="rline"><canvas width="84" height="84" data-i="${i}"></canvas><div class="rt">${b.sh.name}</div><div class="rn">${f1(today.cuts[i].small)} / ${f1(100 - today.cuts[i].small)}</div><div>${SQ[today.cuts[i].c]}</div></div>`).join('');
  $('rcard').querySelectorAll('canvas').forEach(c => c.getContext('2d').drawImage(built[+c.dataset.i].spr, 0, 0, 84, 84));
  const done = Object.values(store.days).filter(d => d.cuts.length === PER_DAY);
  const best = Math.max(...done.map(d => acc(d.cuts)));
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${f1(best)}%</b><span>best day</span></div>`;
  if (fresh) [392, 494, 587, 784].forEach((f, i) => blip(f, .25, .08, 'triangle', i * .09));
  tick();
}
function tick() {
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), s = Math.max(0, Math.floor((mid - n) / 1000));
  $('countdown').textContent = [s / 3600, s / 60 % 60, s % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
  if (DAY === todayNo && s === 0) location.reload();
}
setInterval(() => { if ($('end').classList.contains('show')) tick(); }, 1000);
$('copy').onclick = async () => {
  const txt = shareStr();
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ text: txt }); return; } await navigator.clipboard.writeText(txt); $('copy').textContent = 'Copied!'; }
  catch (e) { $('copy').textContent = 'Couldn’t copy'; }
  setTimeout(() => $('copy').textContent = 'Share result', 1400);
};

/* ---------- loop ---------- */
const easeBack = t => { t = Math.min(1, Math.max(0, t)); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function lineAcross(a, b) { let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; return [[a[0] - dx * W * 2, a[1] - dy * W * 2], [a[0] + dx * W * 2, a[1] + dy * W * 2]]; }
function frame(now) {
  requestAnimationFrame(frame);
  if (!B || $('play').classList.contains('hide')) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = 'rgba(30,27,36,.07)'; for (let x = 18; x < W; x += 24) for (let y = 18; y < W; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill(); }
  const P = B.P * scale, SZ = (S + B.P * 2) * scale;
  ctx.save(); ctx.globalAlpha = .10; ctx.filter = 'blur(6px)'; ctx.drawImage(B.mask, ox + 6, oy + 12, S * scale, S * scale); ctx.restore();
  if (mode === 'aim') {
    ctx.drawImage(B.spr, ox - P, oy - P + Math.sin(now / 600) * 2, SZ, SZ);
    if (drag && Math.hypot(drag.b[0] - drag.a[0], drag.b[1] - drag.a[1]) > 8) {
      const [p, q] = lineAcross(drag.a, drag.b);
      ctx.save(); ctx.setLineDash([12, 9]); ctx.lineDashOffset = -now / 25; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(drag.a[0], drag.a[1]); ctx.lineTo(drag.b[0], drag.b[1]); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      [drag.a, drag.b].forEach(d => { ctx.beginPath(); ctx.arc(d[0], d[1], 6, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); });
    }
  } else {
    const t = (now - cutT) / 1000, e = easeBack((t - .09) / .5), sep = 22 * e, rot = .06 * e;
    [[cut.s1, 1, cut.c1], [cut.s2, -1, cut.c2]].forEach(([spr, sg, c]) => {
      const cx = ox + c[0] * scale, cy = oy + c[1] * scale;
      ctx.save(); ctx.translate(cx + cut.nx * sep * sg, cy + cut.ny * sep * sg); ctx.rotate(rot * sg); ctx.translate(-cx, -cy);
      ctx.drawImage(spr, ox - P, oy - P, SZ, SZ); ctx.restore();
    });
    if (t < .35) { const [p, q] = lineAcross(cut.line[0], cut.line[1]); ctx.save(); ctx.globalAlpha = 1 - t / .35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 10 * (1 - t / .35) + 2; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.restore(); }
    const nt = Math.min(1, Math.max(0, (t - .45) / .8)), ne = 1 - Math.pow(1 - nt, 3);
    if (t > .45) {
      [[cut.c1, 1, cut.p1], [cut.c2, -1, cut.p2]].forEach(([c, sg, pct]) => {
        let x = ox + c[0] * scale + cut.nx * (sep + 38) * sg, y = oy + c[1] * scale + cut.ny * (sep + 38) * sg;
        x = Math.max(54, Math.min(W - 54, x)); y = Math.max(30, Math.min(W - 30, y));
        const txt = f1(pct * ne) + '%', pop = easeBack(Math.min(1, (t - .45) / .3));
        ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.font = '900 26px Rubik, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(txt).width + 20; ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -20, w, 40, 12) : ctx.rect(-w / 2, -20, w, 40); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 2); ctx.restore();
      });
      if (nt < 1 && Math.floor(nt * 18) !== Math.floor((nt - .016) * 18)) blip(500 + nt * 500, .03, .03);
    }
    if (t > 1.4 && !verdictShown) showVerdict();
  }
}
window.SLICE_DEBUG = { build, shapesForDay };
resize();
if (today.cuts.length >= PER_DAY) showEnd(false); else startRound(today.cuts.length);
requestAnimationFrame(frame);
})();
