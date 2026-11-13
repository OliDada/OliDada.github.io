// Whereabouts — a daily geography game. Five places, one pin each on a blank globe, scored by how many km you are off.
// No backend: the date picks the day's places, so everyone gets the same set.
(() => {
const $ = id => document.getElementById(id);
const { geoOrthographic, geoPath, geoDistance, geoInterpolate, geoGraticule10, feature } = window.GEO;
const PER_DAY = 5, TIERS = [1, 1, 2, 2, 3];   // each day ramps from famous to obscure
const LAUNCH = [2026, 10, 13];                // #1 = 13 Nov 2026 (month is 0-based)
const EARTH_KM = 6371, MAX_ZOOM = 12;
const P = window.WHEREABOUTS_PLACES;
const LAND = { lo: feature(WHEREABOUTS_LAND.lo, WHEREABOUTS_LAND.lo.objects.land), hi: feature(WHEREABOUTS_LAND.hi, WHEREABOUTS_LAND.hi.objects.land) };
const GRAT = geoGraticule10();
// The detailed outline is split into separate landmasses, each with a bounding cap (centre + angular radius),
// so a zoomed-in view only has to draw the ones that are actually on screen.
const RAD = Math.PI / 180;
const polysOf = f => (f.features || [f]).flatMap(x => x.geometry.type === 'Polygon' ? [x.geometry.coordinates] : x.geometry.coordinates);
const HI_PARTS = polysOf(LAND.hi).map(poly => {
  let x = 0, y = 0, z = 0; const ring = poly[0];
  for (const [lo, la] of ring) { x += Math.cos(la * RAD) * Math.cos(lo * RAD); y += Math.cos(la * RAD) * Math.sin(lo * RAD); z += Math.sin(la * RAD); }
  const c = [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD]; let r = 0;
  for (let i = 0; i < ring.length; i += 3) r = Math.max(r, geoDistance(c, ring[i]));
  return { c, r: r + .02, poly };
});
function landInView(centre, capR) { return { type: 'MultiPolygon', coordinates: HI_PARTS.filter(p => geoDistance(centre, p.c) < capR + p.r).map(p => p.poly) }; }
const PALETTE = [
  { bg: '#FFF0D6', accent: '#F06449', soft: '#FFD9CE' },
  { bg: '#E8F0FA', accent: '#3D6BFF', soft: '#D6E0FF' },
  { bg: '#E9F3E6', accent: '#2FA05A', soft: '#CDEBD3' },
  { bg: '#F4ECF8', accent: '#8B5CF6', soft: '#E4D8FB' },
  { bg: '#FFF4D9', accent: '#E0A100', soft: '#FBE7B0' }
];
const INK = '#1E1B24', CARD = '#FFFBF5', SEA = '#A9DDF3';

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : Math.max(1, todayNo);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Every place appears once per cycle, so nothing repeats for a month.
function placesForDay(day) {
  const need = {}; TIERS.forEach(t => need[t] = (need[t] || 0) + 1);
  const pools = {}; for (const t in need) pools[t] = P.map((p, i) => i).filter(i => P[i][5] === +t);
  const perCycle = Math.min(...Object.keys(need).map(t => Math.floor(pools[t].length / need[t])));
  const cycle = Math.floor((day - 1) / perCycle), slot = (day - 1) % perCycle, taken = {};
  const r = mulberry(day * 104729 + 7);
  return TIERS.map(t => {
    const order = shuffle(pools[t], mulberry(cycle * 7919 + 101 + t * 13)), k = taken[t] = (taken[t] || 0) + 1;
    const [name, kind, where, lat, lon, tier, emoji, fact] = P[order[slot * need[t] + k - 1]];
    // The globe starts facing a random way each round, so the view gives nothing away.
    return { name, kind, where, at: [lon, lat], tier, emoji, fact, start: [r() * 360 - 180, r() * 40 - 20] };
  });
}

/* ---------- saved progress ---------- */
const KEY = 'whereabouts:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [] });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('whereabouts:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('whereabouts:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- globe ---------- */
const canvas = $('canvas'), ctx = canvas.getContext('2d'), proj = geoOrthographic().clipAngle(90), path = geoPath(proj, ctx);
// Coastlines are dense enough already, so they skip the projection's curve resampling. That is what keeps spinning smooth.
const projFast = geoOrthographic().clipAngle(90).precision(0), pathFast = geoPath(projFast, ctx);
let W = 0, H = 0, dpr = 1, rot = [0, 0], zoom = 1, moving = false, settleT = 0, dirty = true;
let guess = null, answer = null, arcP = 0, accent = PALETTE[0].accent, soft = PALETTE[0].soft;
const baseR = () => Math.min(W, H) / 2 - 14;
function resize() {
  const r = canvas.getBoundingClientRect(); if (!r.width) return;
  dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); dirty = true;
}
new ResizeObserver(resize).observe(canvas);
const visible = pt => geoDistance(pt, [-rot[0], -rot[1]]) < Math.PI / 2 - .02;
function pin(pt, fill, label, dark) {
  if (!visible(pt)) return; const [x, y] = proj(pt);
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 22); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y - 28, 9, 0, 7); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fillStyle = INK; ctx.fill();
  if (!label) return;
  ctx.font = '900 11px Rubik, system-ui, sans-serif'; const w = ctx.measureText(label).width + 14, lx = Math.min(W - w - 4, Math.max(4, x - w / 2)), ly = y - 60;
  ctx.beginPath(); ctx.roundRect(lx, ly, w, 20, 7); ctx.fillStyle = dark ? INK : CARD; ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark ? '#fff' : INK; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + 7, ly + 10.5);
}
function draw() {
  dirty = false; if (!W) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const R = baseR() * zoom, cx = W / 2, cy = H / 2;
  proj.translate([cx, cy]).scale(R).rotate(rot); projFast.translate([cx, cy]).scale(R).rotate(rot);
  // chunky drop shadow under the globe, then sea, grid and land
  ctx.beginPath(); ctx.arc(cx, cy + 6, R, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = SEA; ctx.fill();
  ctx.beginPath(); path(GRAT); ctx.strokeStyle = 'rgba(30,27,36,.10)'; ctx.lineWidth = 1; ctx.stroke();
  const capR = Math.asin(Math.min(1, Math.hypot(W, H) / 2 / R));   // how much of the globe the view can see
  ctx.beginPath(); pathFast(moving && zoom < 3.5 ? LAND.lo : landInView([-rot[0], -rot[1]], capR)); ctx.fillStyle = CARD; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); path({ type: 'Sphere' }); ctx.lineWidth = 2.5; ctx.stroke();
  if (guess && answer && arcP > 0) {
    const end = arcP >= 1 ? answer : geoInterpolate(guess, answer)(arcP);
    ctx.beginPath(); path({ type: 'LineString', coordinates: [guess, end] });
    ctx.setLineDash([7, 6]); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.setLineDash([]);
  }
  if (guess) pin(guess, accent, answer ? 'you' : '', false);
  if (answer && arcP >= 1) pin(answer, INK, 'real', true);
}
function frame() { if (dirty) draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
// While the globe is moving it draws the lighter outline; once it rests, the detailed one.
function touch() { moving = true; dirty = true; clearTimeout(settleT); settleT = setTimeout(() => { moving = false; dirty = true; }, 140); }
function setZoom(z) { zoom = Math.min(MAX_ZOOM, Math.max(1, z)); touch(); }

/* ---------- input ---------- */
const pts = new Map(); let moved = 0, pinched = false, pinch0 = 0, zoom0 = 1, mode = 'aim';
const xy = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
canvas.addEventListener('pointerdown', e => {
  audio(); canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, xy(e));
  if (pts.size === 1) { moved = 0; pinched = false; }
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom0 = zoom; pinched = true; }
});
canvas.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return; const old = pts.get(e.pointerId), now = xy(e); pts.set(e.pointerId, now);
  if (pts.size === 1) {
    const dx = now[0] - old[0], dy = now[1] - old[1], k = 180 / Math.PI / (baseR() * zoom);
    moved += Math.abs(dx) + Math.abs(dy); if (moved < 6) return;
    rot = [rot[0] + dx * k, Math.max(-88, Math.min(88, rot[1] - dy * k))]; touch();
  } else if (pts.size === 2) { const [a, b] = [...pts.values()]; setZoom(zoom0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / (pinch0 || 1)); }
});
const up = e => {
  if (!pts.has(e.pointerId)) return; const at = pts.get(e.pointerId); pts.delete(e.pointerId);
  if (e.type === 'pointerup' && pts.size === 0 && !pinched && moved < 10 && mode === 'aim') drop(at);
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY * .0015)); }, { passive: false });
$('zin').onclick = () => { audio(); glide(rot, zoom * 1.7, 220); }; $('zout').onclick = () => { audio(); glide(rot, zoom / 1.7, 220); };
function drop(at) {
  const R = baseR() * zoom; if (Math.hypot(at[0] - W / 2, at[1] - H / 2) > R) return;
  proj.translate([W / 2, H / 2]).scale(R).rotate(rot);
  const g = proj.invert(at); if (!g || !isFinite(g[0])) return;
  guess = g; dirty = true; blip(520, .08, .08); buzz(10);
  $('tip').classList.add('off'); const b = $('lock'); b.disabled = false; b.textContent = 'Lock it in';
}
addEventListener('keydown', e => { if (e.key !== 'Enter' || $('end').classList.contains('show')) return; if (mode === 'aim' && guess) lock(); else if (mode === 'done') $('next').click(); });

/* ---------- camera glide ---------- */
let glideId = 0;
function glide(toRot, toZoom, dur, done) {
  const id = ++glideId, r0 = rot.slice(), z0 = zoom, t0 = performance.now(); toZoom = Math.min(MAX_ZOOM, Math.max(1, toZoom));
  const dLon = ((toRot[0] - r0[0]) % 360 + 540) % 360 - 180;
  const step = now => {
    if (id !== glideId) return; const p = Math.min(1, (now - t0) / dur), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    rot = [r0[0] + dLon * e, r0[1] + (toRot[1] - r0[1]) * e]; zoom = Math.exp(Math.log(z0) + (Math.log(toZoom) - Math.log(z0)) * e); touch();
    if (p < 1) requestAnimationFrame(step); else if (done) done();
  };
  requestAnimationFrame(step);
}

/* ---------- rounds ---------- */
const items = placesForDay(DAY);
let I = 0, cur;
$('dayNo').textContent = '#' + DAY;
function start(i) {
  I = i; cur = items[i]; mode = 'aim'; guess = null; answer = null; arcP = 0; glideId++;
  const pal = PALETTE[i % PALETTE.length], s = document.documentElement.style;
  s.setProperty('--bg', pal.bg); s.setProperty('--accent', pal.accent); s.setProperty('--soft', pal.soft); accent = pal.accent; soft = pal.soft;
  const qc = document.querySelector('.qcard'); qc.style.animation = 'none'; void qc.offsetWidth; qc.style.animation = '';
  $('kind').textContent = cur.kind; $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('question').textContent = `Where is ${cur.name}?`;
  $('result').classList.remove('show'); $('km').classList.remove('show'); $('globe').classList.remove('locked');
  const b = $('lock'); b.classList.remove('hide'); b.disabled = true; b.textContent = 'Tap the globe';
  $('tip').classList.toggle('off', Object.keys(store.days).some(d => store.days[d].res.length) );
  rot = [-cur.start[0], -cur.start[1]]; zoom = 1; touch(); renderDots();
}
function renderDots() { $('dots').innerHTML = items.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }

/* ---------- lock + reveal ---------- */
function grade(km) { if (km <= 250) return ['g', 'Spot on']; if (km <= 1000) return ['y', 'Close']; if (km <= 2500) return ['o', 'Right region']; return ['r', 'Way off']; }
const pointsFor = km => Math.round(100 * Math.exp(-km / 1500));
const fmtKm = km => Math.round(km).toLocaleString('en-US') + ' km';
function lock() {
  if (mode !== 'aim' || !guess) return; audio(); mode = 'reveal';
  const rad = geoDistance(guess, cur.at), km = rad * EARTH_KM, [c] = grade(km);
  today.res[I] = { g: guess.map(v => +v.toFixed(3)), km: Math.round(km), c, pts: pointsFor(km) }; save();
  $('lock').classList.add('hide'); $('globe').classList.add('locked'); $('tip').classList.add('off');
  blip(240, .12, .1, 'sine'); buzz(15);
  answer = cur.at;
  // turn to the midpoint and zoom so both pins fit, then draw the line between them
  const mid = geoInterpolate(guess, answer)(.5), fit = Math.max(1, Math.min(MAX_ZOOM, .62 / Math.max(.02, Math.sin(Math.min(rad, Math.PI) / 2))));
  glide([-mid[0], -mid[1]], rad > 2.6 ? 1 : fit, 900, () => {
    const t0 = performance.now(), dur = 500 + Math.min(900, km / 6); $('km').classList.add('show');
    const roll = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); arcP = Math.max(.001, e); dirty = true;
      $('km').textContent = fmtKm(km * e); if (Math.random() < .4 && p < 1) blip(300 + e * 500, .03, .03);
      if (p < 1) requestAnimationFrame(roll); else verdict();
    };
    requestAnimationFrame(roll);
  });
}
function verdict() {
  mode = 'done'; arcP = 1; dirty = true; const r = today.res[I], [c, label] = grade(r.km);
  $('question').textContent = `${cur.name}, ${cur.where}`;
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  $('vtxt').innerHTML = `${r.km < 15 ? 'Right on the spot.' : fmtKm(r.km) + ' off'}<small>+${r.pts} points</small>`;
  $('fact').textContent = cur.fact; $('result').classList.add('show');
  $('next').textContent = I < PER_DAY - 1 ? 'Next place' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  renderDots();
  $('next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
$('lock').onclick = lock;
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) { start(n); scrollTo({ top: 0, behavior: 'smooth' }); } else finish(true); };

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + r.pts, 0);
const complete = d => d && d.res && d.res.length === PER_DAY;
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { if (complete(store.days[d])) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Whereabouts #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${today.res.map(r => SQ[r.c]).join('')}\nolid.is/whereabouts`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); scrollTo(0, 0);
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', '#1E1B24');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = items.map((it, i) => { const r = today.res[i];
    return `<div class="rline"><div class="re">${i + 1}</div><div class="rt"><b>${it.name}</b>${it.where} · ${fmtKm(r.km)} off</div><div class="rp">${r.pts}</div><div>${SQ[r.c]}</div></div>`; }).join('');
  const done = Object.values(store.days).filter(complete);
  const avg = Math.round(done.reduce((s, d) => s + total(d.res), 0) / done.length);
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${avg}</b><span>average</span></div>`;
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

window.WHEREABOUTS_DEBUG = { placesForDay, pointsFor, drawMs: (m, z) => { if (z) zoom = z; const t = performance.now(); moving = !!m; for (let i = 0; i < 20; i++) draw(); return (performance.now() - t) / 20; } };
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
})();
