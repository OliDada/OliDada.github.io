// Trace — a daily drawing-from-memory game. See a shape for three seconds, then draw it.
// Scored by overlap once your drawing is moved and resized onto the real one, so only the shape counts.
// No backend: the date picks the day's shapes from shapes.js, so everyone gets the same set.
(() => {
const $ = id => document.getElementById(id);
const S = window.TRACE_SHAPES;
const ROUNDS = 5, LOOK_MS = 3000;
const LAUNCH = [2026, 10, 13];                // #1 = 13 Nov 2026 (month is 0-based)
const PLAN = ['things', 'animals', 'countries', 'things', 'blob'];
const KIND = { things: 'Thing', animals: 'Animal', countries: 'Country', blob: 'Blob' };
const PALETTE = [
  { bg: '#FFF0D6', accent: '#F06449', soft: '#FFD9CE' },
  { bg: '#E8F0FA', accent: '#3D6BFF', soft: '#D6E0FF' },
  { bg: '#E9F3E6', accent: '#2FA05A', soft: '#CDEBD3' },
  { bg: '#F4ECF8', accent: '#8B5CF6', soft: '#E4D8FB' },
  { bg: '#FFF4D9', accent: '#E0A100', soft: '#FBE7B0' }
];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : Math.max(1, todayNo);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const parse = s => s.split(' ').map(p => p.split(',').map(Number));

// Each pool is walked in a shuffled order, a fresh shuffle every time round, so nothing repeats until the pool runs out.
function pick(pool, day, j, per, salt) {
  const P = S[pool], idx = (day - 1) * per + j, cyc = Math.floor(idx / P.length);
  const order = shuffle([...P.keys()], mulberry(cyc * 7919 + salt));
  return P[order[idx % P.length]];
}
// The last round is a made-up blob: no way to know it beforehand, pure memory.
function blob(day) {
  const r = mulberry(day * 7331 + 5), n = 6 + Math.floor(r() * 3), ctl = [];
  for (let i = 0; i < n; i++) { const a = (i + (r() - .5) * .6) / n * Math.PI * 2, rad = .38 + r() * .62; ctl.push([Math.cos(a) * rad, Math.sin(a) * rad]); }
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctl[(i - 1 + n) % n], p1 = ctl[i], p2 = ctl[(i + 1) % n], p3 = ctl[(i + 2) % n];
    for (let k = 0; k < 10; k++) { const t = k / 10, t2 = t * t, t3 = t2 * t;
      pts.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); }
  }
  return pts;
}
function puzzleFor(day) {
  const used = {};
  return PLAN.map((pool, i) => {
    if (pool === 'blob') return { name: 'Blob', kind: KIND.blob, pts: fit(blob(day)) };
    const j = used[pool] = (used[pool] ?? -1) + 1, per = PLAN.filter(p => p === pool).length;
    const [name, s] = pick(pool, day, j, per, 101 + i * 17);
    return { name, kind: KIND[pool], pts: fit(parse(s)) };
  });
}
// Shape into board units (0–1), centred, its longer side 72% of the board.
function fit(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, k = .72 / Math.max(w, h);
  return pts.map(([x, y]) => [.5 + (x - x0 - w / 2) * k, .5 + (y - y0 - h / 2) * k]);
}

/* ---------- saved progress ---------- */
const KEY = 'trace:v3';           // bumped whenever the shape pool changes the day's set (v1, v2 were test sets)
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [], seen: -1 });
const items = puzzleFor(DAY);

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const b = $('mute'); b.innerHTML = muted ? MUTE_OFF : MUTE_ON; b.setAttribute('aria-pressed', muted ? 'true' : 'false'); b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('trace:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('trace:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- scoring ---------- */
// Both shapes are filled on a small grid. Your drawing is moved onto the real one's centre and resized to the
// same area, then scored on overlap (shared pixels / all pixels covered by either).
const G = 128, mc = document.createElement('canvas'); mc.width = mc.height = G;
const mx = mc.getContext('2d', { willReadFrequently: true });
function mask(pts) {
  mx.clearRect(0, 0, G, G); mx.beginPath(); pts.forEach(([x, y], i) => i ? mx.lineTo(x * G, y * G) : mx.moveTo(x * G, y * G)); mx.closePath(); mx.fill(); mx.lineWidth = .03 * G; mx.lineJoin = 'round'; mx.stroke();   // a soft edge, so thin shapes aren't all-or-nothing
  const d = mx.getImageData(0, 0, G, G).data, m = new Uint8Array(G * G); let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < G * G; i++) if (d[i * 4 + 3] > 127) { m[i] = 1; n++; sx += i % G; sy += i / G | 0; }
  return { m, n, cx: n ? (sx / n + .5) / G : .5, cy: n ? (sy / n + .5) / G : .5 };
}
function align(user, target) {
  const u = mask(user), t = mask(target), k = u.n ? Math.min(3, Math.max(.33, Math.sqrt(t.n / u.n))) : 1;
  return { k, dx: t.cx - u.cx * k, dy: t.cy - u.cy * k };
}
const moved = (pts, a, e = 1) => pts.map(([x, y]) => [x + (x * a.k + a.dx - x) * e, y + (y * a.k + a.dy - y) * e]);
function overlap(user, target) {
  const a = align(user, target), u = mask(moved(user, a)), t = mask(target); let both = 0, any = 0;
  for (let i = 0; i < G * G; i++) { if (u.m[i] & t.m[i]) both++; if (u.m[i] | t.m[i]) any++; }
  return { iou: any ? both / any : 0, a };
}
// Points are measured against a lazy oval of the same size: drawing that oval scores near zero,
// a perfect copy scores 100. Round, plain shapes were left out of the pool because an oval is already most of them.
function oval(t) {
  const xs = t.map(p => p[0]), ys = t.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return Array.from({ length: 48 }, (_, i) => [(x0 + x1) / 2 + (x1 - x0) / 2 * Math.cos(i / 48 * Math.PI * 2), (y0 + y1) / 2 + (y1 - y0) / 2 * Math.sin(i / 48 * Math.PI * 2)]);
}
const floorFor = t => Math.max(.3, Math.min(.75, overlap(oval(t), t).iou - .04));
const pointsFor = (iou, lo) => Math.round(100 * Math.min(1, Math.max(0, (iou - lo) / (.94 - lo))));
const grade = p => p >= 80 ? ['g', 'Spot on'] : p >= 60 ? ['y', 'Pretty close'] : p >= 35 ? ['o', 'Getting there'] : ['r', 'Not quite'];

/* ---------- drawing ---------- */
const board = $('board'), cv = $('cv'), cx = cv.getContext('2d');
let W = 0;
function size() { const r = board.getBoundingClientRect(), d = devicePixelRatio || 1; W = r.width; cv.width = cv.height = Math.round(W * d); cx.setTransform(cv.width, 0, 0, cv.height, 0, 0); }
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function path(c, pts, close = true) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); if (close) c.closePath(); }
// px → board units, so lines look the same thickness on any screen
function shape(c, pts, fill, stroke, lw, alpha = 1, s = W) {
  c.save(); c.globalAlpha = alpha; c.lineJoin = c.lineCap = 'round';
  path(c, pts); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw / s; c.stroke(); } c.restore();
}
function clear() { cx.clearRect(0, 0, 1, 1); }

let I = 0, mode = 'ready', stroke = [], drawing = false, lookT = null;
function setBtns(go, goOn, redoOn) { $('go').textContent = go; $('go').disabled = !goOn; $('redo').disabled = !redoOn; }
function cover(html) { $('coverTxt').innerHTML = html; $('cover').classList.toggle('off', !html); }

function start(i) {
  I = i; const it = items[i];
  $('count').textContent = `Round ${i + 1} of ${ROUNDS}`; $('kind').textContent = it.kind; $('name').textContent = it.name;
  $('result').classList.remove('show'); $('controls').classList.remove('hide'); $('score').classList.remove('show');
  stroke = []; clear(); renderDots();
  if (today.seen >= i) toDraw(); else { mode = 'ready'; cover('<b>Get ready</b>You get three seconds to look'); setBtns('Show me', true, false); }
}
function look() {
  audio(); mode = 'look'; today.seen = I; save(); cover(''); setBtns('Remember it', false, false);
  clear(); shape(cx, items[I].pts, css('--accent'), css('--ink'), 3);
  blip(520, .08, .06); const bar = $('bar'), t0 = performance.now(); $('timer').classList.add('show');
  const step = now => {
    const p = Math.min(1, (now - t0) / LOOK_MS); bar.style.transform = `scaleX(${1 - p})`;
    if (p < 1) lookT = requestAnimationFrame(step); else { $('timer').classList.remove('show'); blip(330, .1, .06, 'sine'); buzz(10); toDraw(); }
  };
  lookT = requestAnimationFrame(step);
}
function toDraw() {
  mode = 'draw'; clear(); stroke = []; cover('<b>Now draw it</b>One line, from memory');
  setBtns('Lock it in', false, false); board.classList.remove('flash'); void board.offsetWidth; board.classList.add('flash');
}
function paintStroke(closed) {
  clear(); if (stroke.length < 2) return;
  if (closed) shape(cx, stroke, css('--soft'), null, 0, .8);
  cx.save(); cx.lineJoin = cx.lineCap = 'round'; cx.strokeStyle = css('--ink'); cx.lineWidth = 4 / W; path(cx, stroke, closed); cx.stroke(); cx.restore();
}
const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
cv.addEventListener('pointerdown', e => {
  if (mode !== 'draw') return; e.preventDefault(); audio();
  cv.setPointerCapture(e.pointerId); drawing = true; stroke = [at(e)]; cover(''); setBtns('Lock it in', false, false); blip(400, .03, .03);
});
cv.addEventListener('pointermove', e => {
  if (!drawing) return; const p = at(e), q = stroke[stroke.length - 1];
  if (Math.hypot(p[0] - q[0], p[1] - q[1]) * W < 2) return;
  stroke.push(p.map(v => Math.min(1, Math.max(0, v)))); paintStroke(false);
});
const lift = () => {
  if (!drawing) return; drawing = false; paintStroke(true);
  const ok = stroke.length > 8 && mask(stroke).n > 30; setBtns('Lock it in', ok, true);
  if (!ok) { stroke = []; clear(); cover('<b>A bit bigger</b>Draw the whole outline'); }
};
cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
$('redo').onclick = () => { if (mode !== 'draw') return; blip(300, .05, .04); toDraw(); };

function lock() {
  if (mode !== 'draw' || stroke.length < 9) return; audio(); mode = 'reveal';
  const it = items[I], { iou, a } = overlap(stroke, it.pts), pts = pointsFor(iou, floorFor(it.pts)), [c] = grade(pts);
  today.res[I] = { c, pts, iou: Math.round(iou * 1000) / 1000, d: stroke.map(p => p.map(v => Math.round(v * 1000))).flat() }; save();
  $('controls').classList.add('hide'); blip(240, .12, .1, 'sine'); buzz(15);
  const t0 = performance.now(), from = stroke;
  const frame = now => {
    const p = Math.min(1, (now - t0) / 1100), e1 = ease(Math.min(1, p / .55)), e2 = ease(Math.max(0, (p - .35) / .65));
    clear();
    shape(cx, it.pts, css('--accent'), null, 0, .3 * e2);
    shape(cx, it.pts, null, css('--accent'), 3, e2);
    cx.save(); cx.lineJoin = cx.lineCap = 'round'; cx.strokeStyle = css('--ink'); cx.lineWidth = 4 / W; path(cx, moved(from, a, e1)); cx.stroke(); cx.restore();
    if (p < 1) requestAnimationFrame(frame); else verdict();
  };
  requestAnimationFrame(frame);
}
const ease = t => 1 - Math.pow(1 - t, 3);
function verdict() {
  mode = 'done'; const r = today.res[I], [c, label] = grade(r.pts);
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  $('vtxt').innerHTML = `${Math.round(r.iou * 100)}% overlap<small>+${r.pts} points</small>`;
  $('score').textContent = '+' + r.pts; $('score').classList.add('show');
  $('result').classList.add('show'); $('next').textContent = I < ROUNDS - 1 ? 'Next shape' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  renderDots();
}
function renderDots() {
  $('dots').innerHTML = Array.from({ length: ROUNDS }, (_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${!r && i === I ? 'on' : ''}"></div>`; }).join('');
}
$('go').onclick = () => { if (mode === 'ready') look(); else if (mode === 'draw') lock(); };
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < ROUNDS) start(n); else finish(true); };
addEventListener('keydown', e => {
  if (e.key !== 'Enter' || $('end').classList.contains('show')) return;
  if (mode === 'done') $('next').click(); else if (!$('go').disabled) $('go').click();
});

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + r.pts, 0);
const doneDay = d => d && d.res && d.res.length === ROUNDS;
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { if (doneDay(store.days[d])) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Trace #${DAY} ${total(today.res)}/${ROUNDS * 100}\n${today.res.map(r => SQ[r.c]).join('')}\nolid.is/trace`; }
const unpack = d => { const p = []; for (let i = 0; i < d.length; i += 2) p.push([d[i] / 1000, d[i + 1] / 1000]); return p; };
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); scrollTo(0, 0);
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', '#1E1B24');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${ROUNDS * 100}</small>`;
  const tiles = $('tiles'); tiles.innerHTML = '';
  items.forEach((it, i) => {
    const r = today.res[i], el = document.createElement('div'); el.className = 'tile'; el.style.animationDelay = i * 70 + 'ms';
    el.innerHTML = `<canvas width="240" height="240"></canvas><b>${it.name}</b><span><i class="${r.c}"></i>${r.pts}</span>`;
    tiles.appendChild(el);
    const c = el.querySelector('canvas').getContext('2d'); c.setTransform(240, 0, 0, 240, 0, 0);
    const user = unpack(r.d), a = align(user, it.pts);
    shape(c, it.pts, pal.accent, null, 0, .35, 240); shape(c, it.pts, null, pal.accent, 4, 1, 240);
    c.save(); c.lineJoin = c.lineCap = 'round'; c.strokeStyle = '#1E1B24'; c.lineWidth = 5 / 240; path(c, moved(user, a)); c.stroke(); c.restore();
  });
  const t = document.createElement('div'); t.className = 'tile total';
  t.innerHTML = `<b style="font-size:26px;font-weight:900">${Math.round(total(today.res) / ROUNDS)}</b><span>average</span>`; tiles.appendChild(t);
  const done = Object.values(store.days).filter(doneDay);
  const best = Math.max(...done.map(d => total(d.res))), avg = Math.round(done.reduce((a, d) => a + total(d.res), 0) / done.length);
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${avg}</b><span>average</span></div><div class="stat"><b>${best}</b><span>best</span></div>`;
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

/* ---------- start ---------- */
const pal = PALETTE[(DAY - 1) % PALETTE.length], st = document.documentElement.style;
st.setProperty('--bg', pal.bg); st.setProperty('--accent', pal.accent); st.setProperty('--soft', pal.soft);
$('dayNo').textContent = '#' + DAY;
size(); addEventListener('resize', () => { size(); if (mode === 'draw') paintStroke(!drawing); });
window.TRACE_DEBUG = { puzzleFor, overlap, pointsFor, floorFor, oval, items };
if (today.res.length >= ROUNDS) finish(false);
else { start(today.res.length); }
})();
