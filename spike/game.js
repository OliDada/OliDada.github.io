// Spike — a daily game. Ten years of weekly views for a mystery Wikipedia page. Name the page from the shape of its graph.
// Stuck? Take a clue (busiest week, then what kind of thing it is, then its letters). Fewer clues, more points.
// No backend: the date picks the pages; the graphs come from tools/build-data.js.
(() => {
const INK = '#1E1B24', $ = id => document.getElementById(id);
const PER_DAY = 3, LAUNCH = [2026, 10, 13];       // same numbering as the other daily games (month is 0-based)
const POINTS = [100, 75, 50, 25];                  // by number of clues shown when you get it
const MAX_WRONG = 4, WRONG_COST = 10;              // wrong guesses cost points, not clues
const START = Date.parse(window.SPIKE_START), DATA = window.SPIKE_DATA.map(([title, name, cat, aka, b64, peak, max, total]) => {
  const bin = atob(b64), v = Array.from(bin, c => c.charCodeAt(0) / 255);
  const s = v.slice().sort((a, b) => a - b), spiky = 1 / Math.max(.004, s[s.length >> 1]);   // how much the peak stands out
  return { title, name, cat, names: [name.toLowerCase(), ...aka], v, peak, max, total, spiky };
});
const PALETTE = [{ bg: '#E3ECFF', accent: '#3D6BFF' }, { bg: '#FFE9E3', accent: '#F06449' }, { bg: '#E6F4EA', accent: '#2FA05A' }];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Split the pages into thirds by how spiky they are; each day gets one sharp, one medium and one gentle graph.
function pagesForDay(day) {
  const byS = DATA.map((_, i) => i).sort((a, b) => DATA[b].spiky - DATA[a].spiky), third = Math.floor(byS.length / 3);
  const tiers = [byS.slice(0, third), byS.slice(third, 2 * third), byS.slice(2 * third)];
  return tiers.map((tier, t) => { const cycle = Math.floor((day - 1) / tier.length), order = shuffle(tier, mulberry(cycle * 811 + t * 97 + 5)); return DATA[order[(day - 1) % tier.length]]; });
}
const NAMES = [...new Set(DATA.flatMap(d => d.names))].sort();
const weekDate = i => new Date(START + i * 7 * 864e5);
const dateOf = i => weekDate(i).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = i => weekDate(i).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const Y0 = new Date(START).getUTCFullYear(), WEEKS = DATA[0].v.length, Y1 = weekDate(WEEKS - 1).getUTCFullYear(), SPAN = `${Y0}–${Y1}`;
const letters = n => n.split(' ').map(w => { let first = true; return w.split('').map(c => /[\p{L}\p{N}]/u.test(c) ? (first ? (first = false, c.toUpperCase()) : '_') : c).join(''); }).join('   ');
// The category goes in the question: "A TV series" -> "Which TV series is this?"
const question = cat => /^something/i.test(cat) ? `${cat}: what is it?` : `Which ${cat.replace(/^an? /i, '')} is this?`;
const big = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' million' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);

/* ---------- saved progress ---------- */
const KEY = 'spike:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [], cur: null });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('spike:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0, slide) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('spike:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- canvas ---------- */
const cv = $('cv'), cx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(3, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
addEventListener('resize', resize);

/* ---------- state ---------- */
const items = pagesForDay(DAY);
let I = 0, D, clues = 0, wrong = [], mode = 'play', drawT = 0, revealT = 0;
$('dayNo').textContent = '#' + DAY;
const pal = () => PALETTE[I % PALETTE.length];

function start(i) {
  I = i; D = items[i]; mode = 'play'; drawT = performance.now(); revealT = 0;
  const c = today.cur && today.cur.i === i ? today.cur : null;
  clues = c ? c.clues : 0; wrong = c ? c.wrong.slice() : [];
  const s = document.documentElement.style; s.setProperty('--bg', pal().bg); s.setProperty('--accent', pal().accent);
  $('name').textContent = question(D.cat); $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('cap').textContent = `Weekly Wikipedia views, ${SPAN}`;
  $('result').classList.remove('show'); $('guessBox').classList.remove('hide');
  $('guess').value = ''; renderSugs(); renderWrong(); renderClues(); renderDots();
  hint('');
  blip(330, .5, .03, 'sine', 0, 660);
}
function hint(s) { $('hint').textContent = s; $('hint').style.opacity = s ? 1 : 0; }
function renderDots() { $('dots').innerHTML = items.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }
function renderWrong() { $('wrong').innerHTML = wrong.map(w => `<span>${(DATA.find(d => d.names.includes(w)) || { name: w }).name}</span>`).join(''); }
function renderClues() {
  const all = mode !== 'play';
  const C = [['Busiest week', dateOf(D.peak)], ['Letters', letters(D.name)], ['Pick one', 'From these 4']];
  $('clues').innerHTML = C.map(([k, v], n) => n < clues || all ? `<div class="clue on ${n === 1 ? 'letters' : ''}"><small>${k}</small><b>${v}</b></div>` : `<div class="clue"><small>Clue ${n + 1}</small>${n === clues ? `−${POINTS[n] - POINTS[n + 1]} pts` : ''}</div>`).join('')
    + (clues >= 3 && mode === 'play' ? `<div class="choices">${choices().map(d => `<button class="sug" data-n="${d.names[0]}" ${wrong.includes(d.names[0]) ? 'disabled' : ''}>${d.name}</button>`).join('')}</div>` : '');
  $('clues').querySelectorAll('.choices .sug').forEach(b => b.onclick = () => guess(b.dataset.n));
  $('clueBtn').disabled = clues >= 3 || mode !== 'play';
}
// The last clue: the answer and three others, the same kind of thing where possible.
function choices() {
  const r = mulberry(DAY * 7919 + I * 31), same = shuffle(DATA.filter(d => d !== D && d.cat === D.cat), r), rest = shuffle(DATA.filter(d => d !== D && d.cat !== D.cat), r);
  return shuffle([D, ...same.concat(rest).slice(0, 3)], r);
}
function saveCur() { today.cur = { i: I, clues, wrong: wrong.slice() }; save(); }
function addClue() { if (clues >= 3 || mode !== 'play') return false; clues++; saveCur(); renderClues(); blip(700, .08, .05); return true; }
$('clueBtn').onclick = () => { audio(); hint(''); addClue(); };

/* ---------- guessing ---------- */
let sugList = [];
function renderSugs() {
  const q = $('guess').value.trim().toLowerCase();
  // one button per page, under its proper name; the same kind of thing first, and within that names that start with what you typed
  const rank = d => (d.cat === D.cat ? 0 : 2) + (d.names.some(n => n.startsWith(q)) ? 0 : 1);
  const hits = !q ? [] : DATA.filter(d => d.names.some(n => n.includes(q)) && !wrong.includes(d.names[0])).sort((a, b) => rank(a) - rank(b)).slice(0, 6);
  sugList = hits.map(d => d.names[0]);
  $('sugs').innerHTML = hits.map((d, k) => `<button class="sug ${k ? '' : 'top'}" data-n="${d.names[0]}">${d.name}</button>`).join('');
  $('sugs').querySelectorAll('.sug').forEach(b => b.onclick = () => guess(b.dataset.n));
}
$('guess').addEventListener('input', renderSugs);
$('guess').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('go').click(); } });
$('go').onclick = () => { const v = $('guess').value.trim().toLowerCase(); if (!v) return; guess(NAMES.includes(v) ? v : sugList[0]); };
function guess(n) {
  if (mode !== 'play') return;
  if (!n) { shake(); hint('Pick one of the suggestions'); return; }
  audio(); $('guess').value = ''; renderSugs(); hint('');
  if (D.names.includes(n)) return settle(true);
  wrong.push(n); renderWrong(); shake(); blip(200, .2, .08, 'sine', 0, 140); buzz([30, 30, 30]);
  if (wrong.length >= MAX_WRONG) return settle(false);
  saveCur(); renderClues();
  hint(MAX_WRONG - wrong.length === 1 ? 'Last guess!' : `Not that one. ${MAX_WRONG - wrong.length} guesses left`);
}
function shake() { const g = $('guessBox'); g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake'); }

/* ---------- a finished page ---------- */
const gradeOf = r => !r.ok ? 'r' : r.clues === 0 ? 'g' : r.clues === 1 ? 'y' : 'o';
function settle(ok) {
  const r = { ok, clues, wrong: wrong.length, pts: ok ? Math.max(10, POINTS[clues] - WRONG_COST * wrong.length) : 0 }; r.c = gradeOf(r);
  today.res[I] = r; today.cur = null; save();
  mode = 'done'; revealT = performance.now();
  $('guessBox').classList.add('hide'); $('result').classList.add('show'); $('guess').blur();
  $('name').textContent = D.name; renderClues();
  $('pill').className = 'pill ' + r.c; $('pill').textContent = !ok ? 'Missed' : clues === 0 ? 'Graph only!' : clues === 1 ? 'One clue' : clues + ' clues';
  $('vtxt').innerHTML = `${big(D.total)} views, ${SPAN}.<small>Busiest week: ${dateOf(D.peak)}, ${big(D.max)} views${ok ? ` · +${r.pts} points` : ''}</small>`;
  $('next').textContent = I < PER_DAY - 1 ? 'Next graph' : 'See results';
  if (ok) { [523, 659, 784, 1047].forEach((f, k) => blip(f, .22, .08, 'triangle', k * .07)); buzz([20, 40, 20]); }
  else [262, 196].forEach((f, k) => blip(f, .25, .08, 'sine', k * .13));
  renderDots();
}
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) start(n); else finish(true); };

/* ---------- drawing ---------- */
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function plot(g, v, w, h, pad, upto, color, fill) {
  const x = i => pad.l + (w - pad.l - pad.r) * i / (v.length - 1), y = val => pad.t + (h - pad.t - pad.b) * (1 - val);
  const n = Math.max(2, Math.floor(v.length * upto));
  g.beginPath(); g.moveTo(x(0), y(v[0])); for (let i = 1; i < n; i++) g.lineTo(x(i), y(v[i]));
  if (fill) { g.save(); g.lineTo(x(n - 1), h - pad.b); g.lineTo(x(0), h - pad.b); g.closePath(); g.fillStyle = fill; g.fill(); g.restore(); g.beginPath(); g.moveTo(x(0), y(v[0])); for (let i = 1; i < n; i++) g.lineTo(x(i), y(v[i])); }
  g.strokeStyle = color; g.stroke();
  return { x, y };
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!D || !W) return;
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, W, H);
  const pad = { l: 16, r: 16, t: 44, b: 34 }, acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  // year grid: alternate years shaded, labelled underneath
  cx.font = `700 ${Math.round(Math.max(10, W * .026))}px Rubik, sans-serif`; cx.textAlign = 'center';
  const xw = w => pad.l + (W - pad.l - pad.r) * w / (WEEKS - 1);
  for (let y = Y0; y <= Y1; y++) {
    const a = Math.max(0, (Date.UTC(y, 0, 1) - START) / 6048e5), b = Math.min(WEEKS - 1, (Date.UTC(y + 1, 0, 1) - START) / 6048e5), xa = xw(a), xb = xw(b);
    if ((y - Y0) % 2 === 0) { cx.fillStyle = 'rgba(30,27,36,.035)'; cx.fillRect(xa, pad.t - 8, xb - xa, H - pad.t - pad.b + 8); }
    cx.fillStyle = '#857F75'; cx.fillText(W < 560 ? `’${String(y).slice(2)}` : String(y), (xa + xb) / 2, H - pad.b + 20);
  }
  cx.strokeStyle = 'rgba(30,27,36,.25)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(pad.l, H - pad.b); cx.lineTo(W - pad.r, H - pad.b); cx.stroke();
  // the line draws itself in, left to right
  const p = ease((now - drawT) / 1400);
  cx.lineJoin = cx.lineCap = 'round'; cx.lineWidth = Math.max(2, W * .006);
  const { x, y } = plot(cx, D.v, W, H, pad, p, INK, acc + '33');
  // clue 1 (or the end): the busiest day, pinned
  if ((clues >= 1 || mode !== 'play') && p >= 1) {
    const px = x(D.peak), py = y(1), lab = shortDate(D.peak);
    cx.fillStyle = acc; cx.beginPath(); cx.arc(px, py, 6, 0, 7); cx.fill(); cx.lineWidth = 2.5; cx.strokeStyle = INK; cx.stroke();
    cx.font = `900 ${Math.round(Math.max(11, W * .032))}px Rubik, sans-serif`; const tw = cx.measureText(lab).width + 16, th = 24;
    const right = px + 14 + tw < W - pad.r, bx = right ? px + 12 : px - 12 - tw, by = py - th / 2;
    { cx.fillStyle = INK; cx.beginPath(); cx.roundRect(bx, by, tw, th, 8); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.fillText(lab, bx + tw / 2, by + 17); }
  }
}

/* ---------- end + stats ---------- */
const total = res => res.reduce((s, r) => s + r.pts, 0);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.res && x.res.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() {
  const lines = today.res.map(r => !r.ok ? 'missed' : r.clues === 0 ? 'graph only' : r.clues + (r.clues === 1 ? ' clue' : ' clues'));
  return `Spike #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${lines.join('\n')}\nolid.is/spike`;
}
function spark(d) { const c = document.createElement('canvas'); c.width = 144; c.height = 80; const g = c.getContext('2d'); g.lineWidth = 2.5; g.lineJoin = 'round'; plot(g, d.v, 144, 80, { l: 2, r: 2, t: 6, b: 6 }, 1, INK, 'rgba(30,27,36,.08)'); return c; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', INK);
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = '';
  items.forEach((d, i) => {
    const r = today.res[i], line = document.createElement('div'); line.className = 'rline'; line.appendChild(spark(d));
    line.insertAdjacentHTML('beforeend', `<div class="rt">${d.name}<div class="rn">${!r.ok ? 'missed' : r.clues === 0 ? 'graph only' : r.clues + (r.clues === 1 ? ' clue' : ' clues')}</div></div><div class="rp">${r.pts}</div>`);
    $('rcard').appendChild(line);
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

window.SPIKE_DEBUG = { items, pagesForDay, NAMES };
resize(); requestAnimationFrame(frame);
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
})();
