// Ballpark (formerly Magnitude) — a daily estimation game. Five questions, one guess each, scored on a log scale.
// No backend: the date picks the day's questions, so everyone gets the same set.
(() => {
const $ = id => document.getElementById(id);
const PER_DAY = 5;
const LAUNCH = [2026, 10, 12];            // #1 = 12 Nov 2026 (month is 0-based)
const Q = window.MAGNITUDE_QUESTIONS;
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
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Every question appears once per cycle, so nothing repeats for weeks.
function questionsForDay(day) {
  const perCycle = Math.floor(Q.length / PER_DAY), cycle = Math.floor((day - 1) / perCycle), slot = (day - 1) % perCycle;
  const order = shuffle(Q.map((_, i) => i), mulberry(cycle * 7919 + 101));
  const r = mulberry(day * 104729 + 7);
  return order.slice(slot * PER_DAY, slot * PER_DAY + PER_DAY).map(i => {
    const [q, hint, a, unit, emoji, fact] = Q[i], L = Math.log10(a);
    // The slider range is offset randomly around the answer, so its middle gives nothing away.
    let lo = L - (1.3 + r() * 1.5), hi = L + (1.3 + r() * 1.5);
    if (a >= 1 && Number.isInteger(a)) { lo = Math.max(lo, 0); if (hi - lo < 3.2) hi = lo + 3.2; }
    return { q, hint, a, unit, emoji, fact, lo, hi, int: Number.isInteger(a) };
  });
}

/* ---------- numbers ---------- */
const SCALES = [[1e27, 'octillion'], [1e24, 'septillion'], [1e21, 'sextillion'], [1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
function sig(v, n) { if (v === 0) return 0; const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - n + 1); return Math.round(v / p) * p; }
function parts(n) {
  for (const [s, w] of SCALES) if (n >= s * .9995) return { num: trim(sig(n / s, 3)), word: w };
  if (n >= 100) return { num: Math.round(n).toLocaleString('en-US'), word: '' };
  return { num: trim(sig(n, 3)), word: '' };
}
function trim(x) { return String(+x.toPrecision(3)).replace(/^0\./, '0.'); }
const show = (n, unit) => { const p = parts(n); return `${p.num}${p.word ? ' ' + p.word : ''} ${unit}`; };
function nice(v, cur) { if (cur.int && v < 10) return Math.max(1, Math.round(v)); return sig(v, 2); }
function tickLabel(k) {
  if (k < 0) return String(+Math.pow(10, k).toFixed(-k));
  const lab = ['1', '10', '100', '1k', '10k', '100k', '1M', '10M', '100M', '1B', '10B', '100B', '1T', '10T', '100T'];
  if (k < lab.length) return lab[k];
  return '10' + String(k).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('');
}

/* ---------- saved progress ---------- */
const KEY = 'magnitude:v3';           // old name kept so streaks and scores carry over
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [] });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('magnitude:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('magnitude:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- odometer ---------- */
const odo = $('odo');
function setOdo(str) {
  if (odo.dataset.s === undefined || odo.dataset.s.length !== str.length || odo.dataset.s.replace(/\d/g, '') !== str.replace(/\d/g, '')) {
    odo.innerHTML = '';
    for (const ch of str) {
      if (!/\d/.test(ch)) { const s = document.createElement('span'); s.className = 'c'; s.textContent = ch; odo.appendChild(s); continue; }
      const d = document.createElement('span'); d.className = 'd new'; const strip = document.createElement('span'); strip.className = 's';
      for (let i = 0; i < 10; i++) { const e = document.createElement('span'); e.textContent = i; strip.appendChild(e); }
      d.appendChild(strip); odo.appendChild(d);
    }
  }
  const strips = odo.querySelectorAll('.s'); let j = 0;
  for (const ch of str) if (/\d/.test(ch)) strips[j++].style.transform = `translateY(${-ch * 1.2}em)`;
  odo.dataset.s = str;
}
function display(n, cur) { const p = parts(n); setOdo(p.num); $('unit').textContent = (p.word ? p.word + ' ' : '') + cur.unit; }

/* ---------- state ---------- */
const items = questionsForDay(DAY);
let I = 0, cur, t = .5, guess = 0, mode = 'aim', lastTick = 0, lastDecade = 0;
$('dayNo').textContent = '#' + DAY;
const scale = $('scale');
const tOf = v => Math.min(1, Math.max(0, (Math.log10(v) - cur.lo) / (cur.hi - cur.lo)));
const vOf = tt => Math.pow(10, cur.lo + tt * (cur.hi - cur.lo));
const place = (el, tt) => el.style.left = `calc(18px + (100% - 36px) * ${tt})`;

function start(i) {
  I = i; cur = items[i]; mode = 'aim';
  const pal = PALETTE[i % PALETTE.length], s = document.documentElement.style;
  s.setProperty('--bg', pal.bg); s.setProperty('--accent', pal.accent); s.setProperty('--soft', pal.soft);
  const qc = document.querySelector('.qcard'); qc.style.animation = 'none'; void qc.offsetWidth; qc.style.animation = '';
  $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('question').textContent = cur.q; $('hint').textContent = cur.hint;
  $('ticks').innerHTML = '';
  for (let k = Math.ceil(cur.lo); k <= Math.floor(cur.hi); k++) { const sp = document.createElement('span'); sp.textContent = tickLabel(k); sp.style.left = ((k - cur.lo) / (cur.hi - cur.lo) * 100) + '%'; $('ticks').appendChild(sp); }
  ['you', 'real'].forEach(id => $(id).classList.remove('show'));
  $('gap').style.opacity = 0; scale.classList.remove('locked');
  $('result').classList.remove('show'); $('controls').classList.remove('hide');
  odo.dataset.s = undefined; setT(.5, true); renderDots();
}
function renderDots() { $('dots').innerHTML = items.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }

function setT(tt, silent) {
  t = Math.min(1, Math.max(0, tt)); const v = nice(vOf(t), cur);
  place($('thumb'), t); $('fill').style.width = (t * 100) + '%';
  $('thumb').setAttribute('aria-valuetext', show(v, cur.unit));
  if (v === guess && !silent) return;
  guess = v; display(v, cur);
  const dec = Math.floor(Math.log10(v)), now = performance.now();
  if (!silent) {
    if (dec !== lastDecade) { blip(dec > lastDecade ? 190 : 150, .12, .1, 'sine'); buzz(10); }
    else if (now - lastTick > 30) { blip(330 + t * 700, .04, .045); lastTick = now; }
  }
  lastDecade = dec;
}
function setValue(v) { t = tOf(v); place($('thumb'), t); $('fill').style.width = (t * 100) + '%'; const old = guess; guess = v; display(v, cur); if (v !== old) blip(330 + t * 700, .04, .045); }

/* ---------- input ---------- */
const tFromX = x => { const r = scale.getBoundingClientRect(); return (x - r.left - 18) / (r.width - 36); };
let dragging = false;
scale.addEventListener('pointerdown', e => { if (mode !== 'aim') return; audio(); dragging = true; scale.classList.add('drag'); scale.setPointerCapture(e.pointerId); setT(tFromX(e.clientX)); });
scale.addEventListener('pointermove', e => { if (dragging) setT(tFromX(e.clientX)); });
const end = () => { dragging = false; scale.classList.remove('drag'); };
scale.addEventListener('pointerup', end); scale.addEventListener('pointercancel', end);
function nudge(dir) {
  if (mode !== 'aim') return; audio();
  let v = guess; const step = cur.int && v < 10 ? 1 : Math.pow(10, Math.floor(Math.log10(v)) - 1);
  v = nice(v + dir * step, cur); if (dir < 0 && v === guess) v = nice(guess - step / 10, cur);
  if (v <= 0 || tOf(v) <= 0 && dir < 0 || tOf(v) >= 1 && dir > 0) return; setValue(v);
}
$('minus').onclick = () => nudge(-1); $('plus').onclick = () => nudge(1);
addEventListener('keydown', e => {
  if (mode !== 'aim' || $('end').classList.contains('show')) { if (e.key === 'Enter' && mode === 'done') $('next').click(); return; }
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { audio(); e.shiftKey ? nudge(1) : setT(t + .01); e.preventDefault(); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { audio(); e.shiftKey ? nudge(-1) : setT(t - .01); e.preventDefault(); }
  if (e.key === 'Enter') lock();
});

/* ---------- lock + reveal ---------- */
function grade(ratio) { if (ratio <= 1.1) return ['g', 'Spot on']; if (ratio <= 1.5) return ['y', 'Close']; if (ratio <= 3) return ['o', 'Roughly']; return ['r', 'Way off']; }
const pointsFor = ratio => Math.round(100 * Math.max(0, 1 - Math.log10(ratio)));
function lock() {
  if (mode !== 'aim') return; audio(); mode = 'reveal';
  const g = guess, a = cur.a, ratio = Math.max(g / a, a / g), [c] = grade(ratio);
  today.res[I] = { g, c, pts: pointsFor(ratio), ratio, dir: g > a ? 'high' : 'low' }; save();
  $('controls').classList.add('hide'); scale.classList.add('locked');
  blip(240, .12, .1, 'sine'); buzz(15);
  const tg = tOf(g), ta = tOf(a);
  place($('you'), tg); place($('real'), ta); $('you').classList.add('show');
  // keep the two labels apart when the guess is close to the answer
  const close = Math.abs(tg - ta) < .14, youLeft = tg <= ta;
  $('you').querySelector('span').style.transform = close ? `translateX(${youLeft ? -45 : 45}%)` : '';
  $('real').querySelector('span').style.transform = close ? `translateX(${youLeft ? 45 : -45}%)` : '';
  const gap = $('gap'); gap.style.left = (Math.min(tg, ta) * 100) + '%'; gap.style.width = (Math.abs(tg - ta) * 100) + '%';
  const t0 = performance.now() + 350, dur = 1100;
  const roll = now => {
    const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
    const v = Math.pow(10, Math.log10(g) + (Math.log10(a) - Math.log10(g)) * e);
    if (p > 0) { display(p < 1 ? sig(v, 2) : a, cur); if (Math.random() < .5 && p < 1) blip(300 + e * 500, .03, .03); }
    if (p < 1) requestAnimationFrame(roll); else verdict();
  };
  requestAnimationFrame(roll);
}
function verdict() {
  mode = 'done'; const r = today.res[I], [c, label] = grade(r.ratio);
  $('real').classList.add('show'); $('gap').style.opacity = .25;
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  const off = r.ratio < 1.02 ? 'Right on the number.' : `${r.ratio < 10 ? r.ratio.toFixed(1) : parts(r.ratio).num + (parts(r.ratio).word ? ' ' + parts(r.ratio).word : '')}× too ${r.dir}`;
  $('vtxt').innerHTML = `${off}<small>You said ${show(r.g, cur.unit)} · +${r.pts} points</small>`;
  $('fact').textContent = cur.fact; $('result').classList.add('show');
  $('next').textContent = I < PER_DAY - 1 ? 'Next question' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  renderDots();
}
$('lock').onclick = lock;
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) start(n); else finish(true); };

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + r.pts, 0);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.res.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Ballpark #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${today.res.map(r => SQ[r.c]).join('')}\nolid.is/ballpark`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', '#1E1B24');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = items.map((it, i) => { const r = today.res[i];
    return `<div class="rline"><div class="re">${i + 1}</div><div class="rt"><b>${it.q}</b>you ${show(r.g, it.unit)} · real ${show(it.a, it.unit)}</div><div class="rp">${r.pts}</div><div>${SQ[r.c]}</div></div>`; }).join('');
  const done = Object.values(store.days).filter(d => d.res && d.res.length === PER_DAY);
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

window.MAGNITUDE_DEBUG = { questionsForDay, parts };
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
})();
