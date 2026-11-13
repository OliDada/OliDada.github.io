// Peek — a daily game. A picture hides under a cover. Each tap pokes a hole. Name it in as few peeks as you can.
// You choose where to look, so where you poke is the skill. No backend: the date picks the pictures.
(() => {
const INK = '#1E1B24', $ = id => document.getElementById(id);
const PER_DAY = 3, MAX_PEEKS = 12;
const LAUNCH = [2026, 10, 12];                 // same numbering as the other daily games (month is 0-based)
const HOLE = [.085, .072, .062];               // hole radius (share of the card) per round: it gets harder
const POOL = window.PEEK_POOL;                 // [photo file, [accepted names], credit index]
const PALETTE = [
  { bg: '#FFE9E3', accent: '#F06449', back: '#FFF4D6' },
  { bg: '#E3ECFF', accent: '#3D6BFF', back: '#E9F8EE' },
  { bg: '#EFE6FB', accent: '#8B5CF6', back: '#FFF0F5' }
];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Every picture appears once per cycle, so nothing repeats for months.
function picturesForDay(day) {
  const perCycle = Math.floor(POOL.length / PER_DAY), cycle = Math.floor((day - 1) / perCycle), slot = (day - 1) % perCycle;
  const order = shuffle(POOL.map((_, i) => i), mulberry(cycle * 4231 + 77)), r = mulberry(day * 3571 + 11);
  return order.slice(slot * PER_DAY, slot * PER_DAY + PER_DAY).map(i => ({ file: POOL[i][0], names: POOL[i][1] }));
}
const NAMES = [...new Set(POOL.flatMap(p => p[1]))].sort();
const article = n => /^[aeiou]/.test(n) ? 'an' : 'a';
const label = n => /s$/.test(n) && !/ss$/.test(n) ? n : `${article(n)} ${n}`;

/* ---------- saved progress ---------- */
const KEY = 'peek:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [], cur: null });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('peek:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0, slide) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('peek:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- pictures ---------- */
const imgs = {};
function img(file) { if (!imgs[file]) { const im = new Image(); im.src = `img/${file}.jpg`; imgs[file] = im; } return imgs[file]; }
// Draw a round's photo into a square of size n.
function paintPicture(g, P, n, back) {
  g.fillStyle = back; g.fillRect(0, 0, n, n);
  const im = img(P.file); if (!im.complete || !im.naturalWidth) return false;
  g.drawImage(im, 0, 0, n, n);
  return true;
}

/* ---------- canvas ---------- */
const cv = $('cv'), cx = cv.getContext('2d'), stage = $('stage');
let W = 0, DPR = 1;
const pic = document.createElement('canvas'), pg = pic.getContext('2d');
const rim = document.createElement('canvas'), rg = rim.getContext('2d');
function resize() { DPR = Math.min(3, devicePixelRatio || 1); W = cv.getBoundingClientRect().width; [cv, pic, rim].forEach(c => c.width = c.height = Math.round(W * DPR)); picDirty = true; }
addEventListener('resize', resize);
let picDirty = true;

/* ---------- state ---------- */
const items = picturesForDay(DAY);
items.forEach(P => img(P.file).onload = () => picDirty = true);
let I = 0, P, holes = [], wrong = [], mode = 'play', revealT = 0;
$('dayNo').textContent = '#' + DAY;
const pal = () => PALETTE[I % PALETTE.length];

function start(i) {
  I = i; P = items[i]; mode = 'play'; revealT = 0; picDirty = true;
  const c = today.cur && today.cur.i === i ? today.cur : null;
  holes = c ? c.holes.map(h => ({ ...h, t0: 0 })) : []; wrong = c ? c.wrong.slice() : [];
  const s = document.documentElement.style; s.setProperty('--bg', pal().bg); s.setProperty('--accent', pal().accent);
  $('count').textContent = `${i + 1} / ${PER_DAY}`; $('name').textContent = 'What is it?';
  $('result').classList.remove('show'); $('guessBox').classList.remove('hide');
  $('guess').value = ''; renderSugs(); renderWrong(); updatePeeks(); renderDots();
  hint(holes.length ? '' : i ? 'Smaller holes this time' : 'Tap to peek. Fewer peeks, more points');
}
function hint(s) { $('hint').textContent = s; $('hint').style.opacity = s ? 1 : 0; }
const cost = () => holes.length + wrong.length;
function updatePeeks() { $('peeks').textContent = `${holes.length} / ${MAX_PEEKS} peeks`; }
function renderDots() { $('dots').innerHTML = items.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }
function renderWrong() { $('wrong').innerHTML = wrong.map(w => `<span>${w}</span>`).join(''); }
function saveCur() { today.cur = { i: I, holes: holes.map(({ x, y }) => ({ x, y })), wrong: wrong.slice() }; save(); }

/* ---------- peeking ---------- */
stage.addEventListener('pointerdown', e => {
  if (mode !== 'play') return; audio();
  if (holes.length >= MAX_PEEKS) { hint('No peeks left. Make a guess!'); return; }
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  holes.push({ x, y, t0: performance.now() }); saveCur(); hint(''); updatePeeks();
  blip(520 + holes.length * 40, .09, .07, 'sine', 0, 180); buzz(8);
  if (holes.length >= MAX_PEEKS) hint('Last peek! Make a guess');
});

/* ---------- guessing ---------- */
let sugList = [];
function renderSugs() {
  const q = $('guess').value.trim().toLowerCase();
  sugList = !q ? [] : NAMES.filter(n => n.startsWith(q)).concat(NAMES.filter(n => !n.startsWith(q) && n.includes(q))).filter(n => !wrong.includes(n)).slice(0, 6);
  $('sugs').innerHTML = sugList.map((n, k) => `<button class="sug ${k ? '' : 'top'}" data-n="${n}">${n}</button>`).join('');
  $('sugs').querySelectorAll('.sug').forEach(b => b.onclick = () => guess(b.dataset.n));
}
$('guess').addEventListener('input', renderSugs);
$('guess').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('go').click(); } });
$('go').onclick = () => { const v = $('guess').value.trim().toLowerCase(); if (!v) return; guess(NAMES.includes(v) ? v : sugList[0]); };
function guess(n) {
  if (mode !== 'play' || !n) { if (!n) { shake(); hint('Pick one of the suggestions'); } return; }
  audio(); $('guess').value = ''; renderSugs();
  if (!holes.length) { hint('Peek first!'); return; }
  if (P.names.includes(n)) return win(n);
  wrong.push(n); saveCur(); renderWrong(); shake(); blip(200, .2, .08, 'sine', 0, 140); buzz([30, 30, 30]);
  if (wrong.length >= 3) lose();
}
function shake() { const g = $('guessBox'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); }

/* ---------- scoring ---------- */
const pointsFor = (peeks, w) => Math.max(10, 110 - 10 * peeks - 15 * w);
function gradeOf(r) { if (!r.ok) return 'r'; if (r.peeks <= 2) return 'g'; if (r.peeks <= 5) return 'y'; return 'o'; }
function win(n) {
  const r = { ok: true, peeks: holes.length, wrong: wrong.length, holes: holes.map(({ x, y }) => ({ x, y })) };
  r.pts = pointsFor(r.peeks, r.wrong); r.c = gradeOf(r); settle(r);
  $('pill').className = 'pill ' + r.c; $('pill').textContent = r.peeks === 1 ? 'One peek!' : r.peeks <= 3 ? 'Sharp eyes' : r.peeks <= 6 ? 'Got it' : 'Phew';
  $('vtxt').innerHTML = `It's ${label(P.names[0])}.<small>${r.peeks} ${r.peeks === 1 ? 'peek' : 'peeks'}${r.wrong ? ` · ${r.wrong} wrong` : ''} · +${r.pts} points</small>`;
  [523, 659, 784, 1047].forEach((f, k) => blip(f, .22, .08, 'triangle', k * .07)); buzz([20, 40, 20]);
}
function lose() {
  const r = { ok: false, peeks: holes.length, wrong: wrong.length, holes: holes.map(({ x, y }) => ({ x, y })), pts: 0, c: 'r' }; settle(r);
  $('pill').className = 'pill r'; $('pill').textContent = 'Three strikes';
  $('vtxt').innerHTML = `It was ${label(P.names[0])}.<small>+0 points</small>`;
  [262, 196].forEach((f, k) => blip(f, .25, .08, 'sine', k * .13));
}
function settle(r) {
  today.res[I] = r; today.cur = null; save();
  mode = 'done'; revealT = performance.now(); hint('');
  $('guessBox').classList.add('hide'); $('result').classList.add('show'); $('guess').blur();
  $('name').textContent = P.names[0][0].toUpperCase() + P.names[0].slice(1);
  $('next').textContent = I < PER_DAY - 1 ? 'Next picture' : 'See results';
  renderDots();
}
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) start(n); else finish(true); };

/* ---------- drawing ---------- */
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function coverPattern(g, n, color) {
  g.fillStyle = color; g.fillRect(0, 0, n, n);
  g.fillStyle = 'rgba(255,255,255,.13)'; const step = n / 18;
  for (let y = 0; y < n + step; y += step) for (let x = (Math.round(y / step) % 2) * step / 2; x < n + step; x += step) { g.beginPath(); g.arc(x, y, step * .13, 0, 7); g.fill(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!P || !W) return;
  const n = cv.width, R = HOLE[I] * n;
  if (picDirty) picDirty = !paintPicture(pg, P, n, pal().back);
  cx.setTransform(1, 0, 0, 1, 0, 0);
  const open = mode === 'done' ? ease((now - revealT) / 700) : 0;
  coverPattern(cx, n, pal().accent);
  // holes: the picture shows through, each pops open
  const radii = holes.map(h => { if (!h.t0) return R; const t = Math.min(1, Math.max(0, (now - h.t0) / 220)); return Math.max(.5, R * (1 - Math.pow(1 - t, 3)) * (1 + .12 * Math.sin(t * Math.PI))); });
  cx.save(); cx.beginPath();
  holes.forEach((h, k) => { cx.moveTo(h.x * n + radii[k], h.y * n); cx.arc(h.x * n, h.y * n, radii[k], 0, 7); });
  if (open > 0) { cx.moveTo(n / 2 + open * n, n / 2); cx.arc(n / 2, n / 2, open * n * .75, 0, 7); }
  cx.clip(); cx.drawImage(pic, 0, 0); cx.restore();
  // ink rims, only where they're not inside another hole
  rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, n, n); rg.globalCompositeOperation = 'source-over';
  rg.strokeStyle = INK; rg.lineWidth = Math.max(3, n * .009);
  holes.forEach((h, k) => { rg.beginPath(); rg.arc(h.x * n, h.y * n, radii[k], 0, 7); rg.stroke(); });
  rg.globalCompositeOperation = 'destination-out'; rg.fillStyle = '#000';
  holes.forEach((h, k) => { rg.beginPath(); rg.arc(h.x * n, h.y * n, Math.max(0, radii[k] - 1), 0, 7); rg.fill(); });
  if (open > 0) { rg.beginPath(); rg.arc(n / 2, n / 2, open * n * .75, 0, 7); rg.fill(); }
  rg.globalCompositeOperation = 'source-over';
  cx.drawImage(rim, 0, 0);
  // after the round: faint rings show where you looked
  if (mode === 'done' && open >= 1) {
    cx.setLineDash([n * .012, n * .012]); cx.lineWidth = Math.max(2, n * .006); cx.strokeStyle = 'rgba(30,27,36,.45)';
    holes.forEach(h => { cx.beginPath(); cx.arc(h.x * n, h.y * n, R, 0, 7); cx.stroke(); }); cx.setLineDash([]);
  }
}

/* ---------- end + stats ---------- */
const total = res => res.reduce((s, r) => s + r.pts, 0);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.res && x.res.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() {
  const lines = today.res.map(r => r.ok ? `${r.peeks} ${r.peeks === 1 ? 'peek' : 'peeks'}${r.wrong ? `, ${r.wrong} wrong` : ''}` : 'missed');
  return `Peek #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${lines.join('\n')}\nolid.is/peek`;
}
// a small card: the picture, with the holes you poked drawn on top
function card(i) {
  const c = document.createElement('canvas'), n = 240; c.width = c.height = n; const g = c.getContext('2d'), Pi = items[i], r = today.res[i];
  const draw = () => {
    paintPicture(g, Pi, n, PALETTE[i % PALETTE.length].back);
    g.fillStyle = 'rgba(30,27,36,.28)'; g.fillRect(0, 0, n, n);
    g.save(); g.beginPath(); r.holes.forEach(h => { g.moveTo(h.x * n + HOLE[i] * n, h.y * n); g.arc(h.x * n, h.y * n, HOLE[i] * n, 0, 7); }); g.clip(); paintPicture(g, Pi, n, PALETTE[i % PALETTE.length].back); g.restore();
    g.strokeStyle = '#fff'; g.lineWidth = 3; r.holes.forEach(h => { g.beginPath(); g.arc(h.x * n, h.y * n, HOLE[i] * n, 0, 7); g.stroke(); });
  };
  draw(); img(Pi.file).addEventListener('load', draw);
  return c;
}
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', INK);
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('cards').innerHTML = '';
  items.forEach((Pi, i) => {
    const r = today.res[i], el = document.createElement('div'); el.className = 'card'; el.appendChild(card(i));
    el.insertAdjacentHTML('beforeend', `<b>${Pi.names[0]}</b><span>${r.ok ? `${r.peeks} ${r.peeks === 1 ? 'peek' : 'peeks'}${r.wrong ? ` · ${r.wrong} wrong` : ''}` : 'missed'}</span>`);
    $('cards').appendChild(el);
  });
  const done = Object.values(store.days).filter(d => d.res && d.res.length === PER_DAY);
  const avg = Math.round(done.reduce((s, d) => s + total(d.res), 0) / done.length);
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${avg}</b><span>average</span></div>`;
  if (fresh) [392, 494, 587, 784].forEach((f, k) => blip(f, .25, .07, 'triangle', k * .09));
  tick();
}
function tick() {
  const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1), s = Math.max(0, Math.floor((mid - n) / 1000));
  $('countdown').textContent = [s / 3600, s / 60 % 60, s % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
  if (DAY === todayNo && s === 0) location.reload();
}
setInterval(() => { if ($('end').classList.contains('show')) tick(); }, 1000);
$('share').onclick = async () => {
  const txt = shareStr();
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ text: txt }); return; } await navigator.clipboard.writeText(txt); $('share').textContent = 'Copied!'; }
  catch (e) { $('share').textContent = 'Couldn’t copy'; }
  setTimeout(() => $('share').textContent = 'Share result', 1400);
};

window.PEEK_DEBUG = { items, picturesForDay, NAMES };
resize(); requestAnimationFrame(frame);
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
})();
