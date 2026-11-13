// Tick — a daily timing game. Five rounds: the clock starts, then goes blank, and you stop it on the target by counting in your head.
// No backend: the date picks the day's targets, so everyone gets the same set.
(() => {
const $ = id => document.getElementById(id);
const PER_DAY = 5;
const LAUNCH = [2026, 10, 13];            // #1 = 13 Nov 2026 (month is 0-based)
// Each day runs through these five kinds in order. lo/hi = target range in seconds, show = how long the clock stays visible.
const ROUNDS = [
  { kind: 'Warm-up',    lo: 3,  hi: 5.9,  show: 2,   note: 'The clock goes blank after 2 seconds.' },
  { kind: 'Longer',     lo: 6,  hi: 9.9,  show: 2,   note: 'The clock goes blank after 2 seconds.' },
  { kind: 'Long haul',  lo: 10, hi: 14.9, show: 1.5, note: 'Blank after 1.5 seconds. Keep counting.' },
  { kind: 'Blind',      lo: 4,  hi: 8.9,  show: 0,   note: 'No clock at all this time.' },
  { kind: 'Liar clock', lo: 8,  hi: 13.9, show: Infinity, liar: true, note: 'This clock lies. Trust your own count.' }
];
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
function roundsForDay(day) {
  const r = mulberry(day * 104729 + 7);
  return ROUNDS.map(R => {
    let target = Math.round((R.lo + r() * (R.hi - R.lo)) * 10) / 10;
    if (Number.isInteger(target)) target = Math.round((target + .3) * 10) / 10;   // whole seconds are too easy to count
    const fast = r() < .5, speed = R.liar ? (fast ? 1.14 + r() * .16 : .86 - r() * .14) : 1;
    return { ...R, target, speed };
  });
}

/* ---------- saved progress ---------- */
const KEY = 'tick:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [] });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('tick:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('tick:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- dial ---------- */
// One lap of the hand is 10 seconds, so each mark on the face is one second.
$('ticks').innerHTML = Array.from({ length: 10 }, (_, i) => `<line class="tk ${i % 5 ? '' : 'big'}" x1="100" y1="${i % 5 ? 17 : 14}" x2="100" y2="${i % 5 ? 24 : 27}" transform="rotate(${i * 36} 100 100)"/>`).join('');
const fmt1 = s => s.toFixed(1), fmt2 = s => s.toFixed(2);
function showClock(sec, blind) {
  $('hand').setAttribute('transform', `rotate(${sec * 36} 100 100)`);
  $('dial').classList.toggle('blind', !!blind);
  $('digits').innerHTML = blind ? '?.?<small>s</small>' : `${fmt1(Math.floor(sec * 10) / 10)}<small>s</small>`;
}

/* ---------- rounds ---------- */
const items = roundsForDay(DAY);
let I = 0, cur, mode = 'ready', t0 = 0, raf = 0, lastWhole = -1;
$('dayNo').textContent = '#' + DAY;
function start(i) {
  I = i; cur = items[i]; mode = 'ready'; cancelAnimationFrame(raf);
  const pal = PALETTE[i % PALETTE.length], s = document.documentElement.style;
  s.setProperty('--bg', pal.bg); s.setProperty('--accent', pal.accent); s.setProperty('--soft', pal.soft);
  const qc = document.querySelector('.qcard'); qc.style.animation = 'none'; void qc.offsetWidth; qc.style.animation = '';
  $('kind').textContent = cur.kind; $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('question').textContent = `Stop at ${fmt1(cur.target)} seconds`;
  $('note').textContent = cur.note; $('cmp').classList.remove('show'); $('result').classList.remove('show');
  showClock(0, false);
  const b = $('go'); b.classList.remove('hide', 'stop'); b.textContent = 'Start the clock';
  renderDots();
}
function renderDots() { $('dots').innerHTML = items.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }

function run() {
  audio(); mode = 'run'; t0 = performance.now(); lastWhole = -1;
  const b = $('go'); b.classList.add('stop'); b.textContent = 'STOP';
  blip(660, .09, .08); buzz(10);
  const giveUp = cur.target * 2 + 5;
  const loop = now => {
    if (mode !== 'run') return; const real = (now - t0) / 1000, blind = real >= cur.show;
    showClock(real * cur.speed, blind);
    // a soft tick each second while the clock is visible (the liar ticks at its own wrong pace)
    const whole = Math.floor(real * cur.speed); if (!blind && whole !== lastWhole) { if (lastWhole >= 0) blip(880, .03, .035); lastWhole = whole; }
    if (real >= giveUp) return stop(now);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

/* ---------- stop + reveal ---------- */
const tau = target => .25 + .06 * target;          // longer targets forgive a little more
const pointsFor = (err, target) => Math.round(100 * Math.exp(-Math.abs(err) / tau(target)));
function grade(pts) { if (pts >= 88) return ['g', 'Spot on']; if (pts >= 65) return ['y', 'Close']; if (pts >= 35) return ['o', 'Roughly']; return ['r', 'Way off']; }
function stop(now) {
  if (mode !== 'run') return; const t = (now - t0) / 1000; if (t < .4) return;      // ignore an accidental double tap
  mode = 'done'; cancelAnimationFrame(raf);
  const err = t - cur.target, pts = pointsFor(err, cur.target), [c, label] = grade(pts);
  today.res[I] = { t: +t.toFixed(3), err: +err.toFixed(3), c, pts }; save();
  blip(240, .12, .1, 'sine'); buzz(15);
  showClock(t, false); $('digits').innerHTML = `${fmt2(t)}<small>s</small>`;
  $('go').classList.add('hide');
  $('cTarget').textContent = fmt2(cur.target); $('cYou').textContent = fmt2(t); $('cmp').classList.add('show');
  $('note').textContent = cur.liar ? `The clock was running ${Math.round(Math.abs(cur.speed - 1) * 100)}% too ${cur.speed > 1 ? 'fast' : 'slow'}.` : '';
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  const a = Math.abs(err);
  $('vtxt').innerHTML = `${a < .02 ? 'Dead on.' : `${fmt2(a)} s too ${err > 0 ? 'late' : 'early'}`}<small>+${pts} points</small>`;
  $('result').classList.add('show');
  $('next').textContent = I < PER_DAY - 1 ? 'Next round' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', .15 + i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', .15 + i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', .15 + i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', .15 + i * .13));
  renderDots();
  $('next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// pointerdown, not click, so the stop lands the moment the finger does
$('go').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'ready') run(); else if (mode === 'run') stop(performance.now()); });
$('go').addEventListener('click', e => e.preventDefault());
addEventListener('keydown', e => {
  if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || $('end').classList.contains('show')) return; e.preventDefault();
  if (mode === 'ready') run(); else if (mode === 'run') stop(performance.now()); else if (mode === 'done' && e.key === 'Enter') $('next').click();
});
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) { start(n); scrollTo({ top: 0, behavior: 'smooth' }); } else finish(true); };

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + r.pts, 0);
const complete = d => d && d.res && d.res.length === PER_DAY;
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { if (complete(store.days[d])) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { return `Tick #${DAY} ${total(today.res)}/${PER_DAY * 100}\n${today.res.map(r => SQ[r.c]).join('')}\nolid.is/tick`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); scrollTo(0, 0);
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', '#1E1B24');
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = items.map((it, i) => { const r = today.res[i], a = Math.abs(r.err);
    return `<div class="rline"><div class="re">${i + 1}</div><div class="rt"><b>${it.kind}: ${fmt1(it.target)} s</b>you ${fmt2(r.t)} s · ${fmt2(a)} ${r.err > 0 ? 'late' : 'early'}</div><div class="rp">${r.pts}</div><div>${SQ[r.c]}</div></div>`; }).join('');
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
$('share').onclick = async () => {
  const txt = shareStr();
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ text: txt }); return; } await navigator.clipboard.writeText(txt); $('share').textContent = 'Copied!'; }
  catch (e) { $('share').textContent = 'Couldn’t copy'; }
  setTimeout(() => $('share').textContent = 'Share result', 1400);
};

window.TICK_DEBUG = { roundsForDay, pointsFor };
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length);
})();
