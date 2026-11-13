// Pinpoint — a daily game. Pin each shape where it would hang perfectly still (its centre of gravity).
// Shapes come from the Slice library (../slice/shapes.js). No backend: the date picks the set.
(() => {
const INK = '#1E1B24', $ = id => document.getElementById(id);
const S = 420, PER_DAY = 5;
const LAUNCH = [2026, 10, 12];       // same numbering as the other daily games (month is 0-based)
const SHAPES = window.SLICE_SHAPES;

/* ---------- day + seeded randomness ---------- */
function localDay(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; }
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Different order and seeds from Slice, so the two games don't show the same shapes on the same day.
function shapesForDay(day) {
  const perCycle = Math.floor(SHAPES.length / PER_DAY), cycle = Math.floor((day - 1) / perCycle), slot = (day - 1) % perCycle;
  const order = shuffle(SHAPES.map((_, i) => i), mulberry(cycle * 6271 + 911));
  const r = mulberry(day * 92821 + 41);
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
    // closed smooth outline through points (Catmull-Rom)
    blob(pts) { c.beginPath(); const n = pts.length;
      for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        if (!i) c.moveTo(p1[0], p1[1]);
        c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
      c.closePath(); c.fill(); return h; },
    // smooth tube along points, width w0 -> w1 with optional bulge in the middle
    tube(pts, w0, w1 = w0, bulge = 0) { let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const sp = spline(pts, Math.max(8, Math.ceil(len / (pts.length - 1) / 1.5))), n = sp.length;
      for (let i = 0; i < n; i++) { const t = i / (n - 1), w = w0 + (w1 - w0) * t + bulge * Math.sin(Math.PI * t); c.beginPath(); c.arc(sp[i][0], sp[i][1], Math.max(.5, w / 2), 0, 7); c.fill(); }
      return h; },
    // smooth open stroke (paint)
    sl(pts, w) { const sp = spline(pts, 10); return h.l(sp, w); },
    // remove area (bites, holes). Paint pass skips it: nothing is painted there anyway.
    cut(fn) { if (deco) return h; c.save(); c.globalCompositeOperation = 'destination-out'; fn(h); c.restore(); return h; },
    spiral(x, y, R, w) { c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); for (let t = 0; t < 12.5; t += .1) { const rr = R * t / 12.5; const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr; t ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); return h; }
  };
  return h;
}
function spline(pts, seg) { const out = [], n = pts.length; if (n < 2) return pts.slice();
  for (let i = 0; i < n - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < seg; k++) { const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(a => .5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))); } }
  out.push(pts[n - 1]); return out; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mix(hex, t) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; const m = v => Math.round(v + (255 - v) * t); return `rgb(${m(r)},${m(g)},${m(b)})`; }

function build(item) {
  const sh = item.shape, r = mulberry(item.seed);
  const j = Array.from({ length: 64 }, () => r() * 2 - 1);
  const v = Object.assign({ j }, sh.p ? sh.p(r) : {});
  const tilt = (r() * 2 - 1) * (sh.tilt ?? .18), flip = r() < .5;
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
  c.globalCompositeOperation = 'source-atop'; draw(c, k, -cx * k, -cy * k, true); c.globalCompositeOperation = 'source-over';
  // soft light from the top-left: a bright rim and a darker lower-right edge
  const band = (dx, dy, fill, blur) => { const b = mk(S, S), bc = b.getContext('2d'); bc.drawImage(mask, 0, 0);
    bc.globalCompositeOperation = 'destination-out'; bc.drawImage(mask, dx, dy); bc.globalCompositeOperation = 'source-in'; bc.fillStyle = fill; bc.fillRect(0, 0, S, S);
    c.save(); c.filter = `blur(${blur}px)`; c.drawImage(b, 0, 0); c.restore(); };
  band(7, 9, 'rgba(255,255,255,.38)', 2.5); band(-8, -12, 'rgba(30,27,36,.16)', 3);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over';
  const P = 16, spr = mk(S + P * 2, S + P * 2), s = spr.getContext('2d');
  const ink = mk(S, S), ic = ink.getContext('2d'); ic.drawImage(mask, 0, 0); ic.globalCompositeOperation = 'source-in'; ic.fillStyle = INK; ic.fillRect(0, 0, S, S);
  for (let a = 0; a < 24; a++) s.drawImage(ink, P + Math.cos(a / 24 * 6.283) * 6, P + Math.sin(a / 24 * 6.283) * 6);
  s.drawImage(col, P, P);
  d = m.getImageData(0, 0, S, S).data; let total = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 127) total++;
  return { sh, mask, spr, P, data: d, total, bg: mix(sh.color === '#FFFFFF' || sh.color === '#F4F1EA' ? '#9AA3B2' : sh.color, .86) };
}



/* ---------- physics facts about a shape ---------- */
function physics(B) {
  const d = B.data; let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 127) { const X = x + .5, Y = y + .5; n++; sx += X; sy += Y; sxx += X * X; syy += Y * Y; }
  const cx = sx / n, cy = sy / n;
  return { n, cx, cy, Icm: (sxx / n - cx * cx) + (syy / n - cy * cy), size: Math.sqrt(n) }; // Icm per unit mass
}
const inside = (B, x, y) => { const X = Math.floor(x), Y = Math.floor(y); return X >= 0 && Y >= 0 && X < S && Y < S && B.data[(Y * S + X) * 4 + 3] > 127; };

/* ---------- saved progress ---------- */
const KEY = 'pinpoint:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [] });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('pinpoint:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .08, vol = .07, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function thunk() { // the pin going into the board
  if (!ac || muted) return; const t = ac.currentTime, len = ac.sampleRate * .06, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const g = ac.createGain(); g.gain.value = .7;
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
  const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + .12);
  og.gain.setValueAtTime(.3, t); og.gain.exponentialRampToValueAtTime(.0001, t + .14); o.connect(og).connect(ac.destination); o.start(t); o.stop(t + .16);
}
function creak(speed) { if (Math.random() < .5) blip(160 + speed * 90, .05, Math.min(.05, .015 + speed * .02), 'sawtooth'); }
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('pinpoint:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d'); let W = 0, DPR = 1, scale = 1, ox = 0, oy = 0;
function resize() { DPR = Math.min(3, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = r.width; cv.width = W * DPR; cv.height = W * DPR; scale = W * .72 / S; ox = (W - S * scale) / 2; oy = (W - S * scale) / 2 - W * .02; }
addEventListener('resize', resize);
const toMask = p => [(p[0] - ox) / scale, (p[1] - oy) / scale];
const toScreen = p => [ox + p[0] * scale, oy + p[1] * scale];

/* ---------- state ---------- */
const items = shapesForDay(DAY), built = items.map(build), phys = built.map(physics);
let R = 0, B, F, mode = 'aim', pin = null, valid = false, sim = null, verdictShown = false;
$('dayNo').textContent = '#' + DAY;

function start(i) {
  R = i; B = built[i]; F = phys[i]; mode = 'aim'; pin = null; valid = false; sim = null; verdictShown = false;
  document.documentElement.style.setProperty('--bg', B.bg);
  $('name').textContent = B.sh.name; $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('result').classList.remove('show'); $('controls').classList.remove('hide'); $('pinBtn').disabled = true;
  hint(i === 0 ? 'Tap where it would hang perfectly still' : 'Find its centre of gravity');
  renderDots();
}
function hint(t) { $('hint').textContent = t; $('hint').style.opacity = t ? 1 : 0; }
function renderDots() { $('dots').innerHTML = built.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === R && !r ? 'on' : ''}"></div>`; }).join(''); }

/* ---------- input: place and drag the pin, then press "Pin it" ---------- */
const stage = $('stage');
function pt(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
let dragging = false, lastBlip = 0;
function movePin(e) {
  const m = toMask(pt(e)); pin = m; const ok = inside(B, m[0], m[1]);
  if (ok !== valid || !lastBlip) { valid = ok; hint(ok ? '' : 'The pin has to go through the shape'); }
  $('pinBtn').disabled = !valid;
  const now = performance.now(); if (now - lastBlip > 45) { blip(ok ? 900 : 300, .02, .02, 'sine'); lastBlip = now; }
}
stage.addEventListener('pointerdown', e => { if (mode !== 'aim') return; audio(); dragging = true; stage.setPointerCapture(e.pointerId); lastBlip = 0; movePin(e); });
stage.addEventListener('pointermove', e => { if (dragging) movePin(e); });
stage.addEventListener('pointerup', () => { dragging = false; });
stage.addEventListener('pointercancel', () => { dragging = false; });
addEventListener('keydown', e => {
  if (mode === 'aim' && pin) {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (k) { e.preventDefault(); pin = [pin[0] + k[0] * 2, pin[1] + k[1] * 2]; valid = inside(B, pin[0], pin[1]); $('pinBtn').disabled = !valid; }
    if (e.key === 'Enter' && valid) commit();
  } else if (e.key === 'Enter' && mode === 'done') $('next').click();
});
$('pinBtn').onclick = () => commit();

/* ---------- the swing ---------- */
function grade(off) { if (off <= .02) return ['g', 'Dead centre']; if (off <= .05) return ['y', 'Close']; if (off <= .1) return ['o', 'Wobbly']; return ['r', 'Off balance']; }
const pointsFor = off => Math.round(100 * Math.max(0, 1 - off / .25));
function commit() {
  if (mode !== 'aim' || !valid) return; audio(); mode = 'swing';
  const rx = F.cx - pin[0], ry = F.cy - pin[1], d = Math.hypot(rx, ry), off = d / F.size, [c] = grade(off);
  today.res[R] = { off: Math.round(off * 1000) / 1000, c, pts: pointsFor(off) }; save();
  sim = { th: 0, w: (Math.random() < .5 ? -1 : 1) * .35, rx, ry, I: F.Icm + d * d, t0: performance.now(), last: performance.now(), creakT: 0 };
  $('controls').classList.add('hide'); hint('');
  thunk(); buzz(18);
}
function step(dt) {
  const s = sim, G = 3600;
  for (let k = 0; k < 4; k++) {
    const h = dt / 4, c = Math.cos(s.th), sn = Math.sin(s.th);
    const wx = s.rx * c - s.ry * sn;                 // centre of gravity, rotated, relative to the pin
    s.w += (G * wx / s.I) * h; s.w *= Math.exp(-1.1 * h); s.th += s.w * h;
  }
}
function showVerdict() {
  verdictShown = true; mode = 'done';
  const r = today.res[R], [c, label] = grade(r.off);
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  $('vtxt').innerHTML = `${r.off < .005 ? 'Exactly on it.' : `${(r.off * 100).toFixed(1)}% off`}<small>+${r.pts} points · the dot is its true centre of gravity</small>`;
  $('result').classList.add('show'); $('next').textContent = R < PER_DAY - 1 ? 'Next shape' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  renderDots();
}
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) start(n); else finish(true); };

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + r.pts, 0);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.res.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Pinpoint #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${today.res.map(r => SQ[r.c]).join('')}\nolid.is/pinpoint`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); document.documentElement.style.setProperty('--bg', '#F4EFE6');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = built.map((b, i) => { const r = today.res[i];
    return `<div class="rline"><canvas width="84" height="84" data-i="${i}"></canvas><div class="rt">${b.sh.name}</div><div class="rn">${(r.off * 100).toFixed(1)}% off</div><div class="rp">${r.pts}</div><div>${SQ[r.c]}</div></div>`; }).join('');
  $('rcard').querySelectorAll('canvas').forEach(c => c.getContext('2d').drawImage(built[+c.dataset.i].spr, 0, 0, 84, 84));
  const done = Object.values(store.days).filter(d => d.res && d.res.length === PER_DAY);
  const best = Math.max(...done.map(d => total(d.res)));
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${best}</b><span>best day</span></div>`;
  if (fresh) [392, 494, 587, 784].forEach((f, i) => blip(f, .25, .07, 'triangle', i * .09));
  tick();
}
function tick() {
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), s = Math.max(0, Math.floor((mid - n) / 1000));
  $('countdown').textContent = [s / 3600, s / 60 % 60, s % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
  if (DAY === todayNo && s === 0) location.reload();
}
setInterval(() => { if ($('end').classList.contains('show')) tick(); }, 1000);
// Old-school copy for browsers without the async clipboard (plain http, older Safari, in-app browsers).
function copyFallback(txt) {
  const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'; document.body.appendChild(ta);
  ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove(); return ok;
}
$('share').onclick = async () => {
  const txt = shareStr(), btn = $('share');
  const say = t => { btn.textContent = t; clearTimeout(btn._t); btn._t = setTimeout(() => btn.textContent = 'Share result', 1400); };
  if (navigator.share && matchMedia('(pointer:coarse)').matches) {
    try { await navigator.share({ text: txt }); return; }
    catch (e) { if (e.name === 'AbortError') return; }      // closing the share sheet isn't a failure
  }
  try { await navigator.clipboard.writeText(txt); return say('Copied!'); } catch (e) {}
  say(copyFallback(txt) ? 'Copied!' : 'Couldn’t copy');
};

/* ---------- drawing ---------- */
function drawPin(x, y, ok, lift) {
  ctx.save(); ctx.translate(x, y - lift);
  ctx.fillStyle = 'rgba(30,27,36,.22)'; ctx.beginPath(); ctx.ellipse(4 + lift * .4, 6 + lift, 9, 4, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#8A8F99'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10); ctx.stroke();
  ctx.fillStyle = ok ? '#E8443A' : '#9AA3B2'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, -18, 11, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-3.5, -21.5, 3.5, 0, 7); ctx.fill();
  ctx.restore();
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!B || $('play').classList.contains('hide')) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = 'rgba(30,27,36,.07)'; for (let x = 18; x < W; x += 24) for (let y = 18; y < W; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 7); ctx.fill(); }
  const P = B.P * scale, SZ = (S + B.P * 2) * scale;
  let th = 0;
  if (sim) { const dt = Math.min(.033, (now - sim.last) / 1000); sim.last = now; step(dt);
    th = sim.th; sim.creakT -= dt; if (sim.creakT <= 0 && Math.abs(sim.w) > .3) { creak(Math.abs(sim.w)); sim.creakT = .12; } }
  const pv = pin ? toScreen(pin) : null;
  // shape (rotating around the pin once it is pinned)
  ctx.save();
  if (sim) { ctx.translate(pv[0], pv[1]); ctx.rotate(th); ctx.translate(-pv[0], -pv[1]); }
  ctx.save(); ctx.globalAlpha = .1; ctx.filter = 'blur(6px)'; ctx.drawImage(B.mask, ox + 6, oy + 12, S * scale, S * scale); ctx.restore();
  ctx.drawImage(B.spr, ox - P, oy - P + (sim ? 0 : Math.sin(now / 600) * 1.5), SZ, SZ);
  // the true centre of gravity, shown after the swing has had a moment
  if (sim && now - sim.t0 > 1600) {
    const a = Math.min(1, (now - sim.t0 - 1600) / 300), [gx, gy] = toScreen([F.cx, F.cy]);
    ctx.globalAlpha = a; ctx.fillStyle = INK; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(gx, gy, 9, 0, 7); ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx, gy, 3.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.restore();
  // plumb line from the pin, once it has settled a bit
  if (sim && now - sim.t0 > 1600) {
    const a = Math.min(1, (now - sim.t0 - 1600) / 300);
    ctx.save(); ctx.globalAlpha = a * .7; ctx.setLineDash([6, 6]); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pv[0], pv[1]); ctx.lineTo(pv[0], W); ctx.stroke(); ctx.restore();
  }
  if (pv) drawPin(pv[0], pv[1], valid, mode === 'aim' && dragging ? 8 : 0);
  if (sim && now - sim.t0 > 2700 && !verdictShown) showVerdict();
}

window.PINPOINT_DEBUG = { shapesForDay, built, phys };
resize();
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
requestAnimationFrame(frame);
})();
