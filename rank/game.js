// Rank — a daily ordering game. Five things, one measure, two tries to put them in order.
// No backend: the date picks the day's measure and items from data.js, so everyone gets the same set.
(() => {
const $ = id => document.getElementById(id);
const { CITIES, COUNTRIES, MOUNTAINS, STRUCTURES, EVENTS, ANIMALS } = window.RANK_DATA;
const SIZE = 7, TRIES = 2;
const LAUNCH = [2026, 10, 13];                // #1 = 13 Nov 2026 (month is 0-based)
const PALETTE = [
  { bg: '#FFF0D6', accent: '#F06449', soft: '#FFD9CE' },
  { bg: '#E8F0FA', accent: '#3D6BFF', soft: '#D6E0FF' },
  { bg: '#E9F3E6', accent: '#2FA05A', soft: '#CDEBD3' },
  { bg: '#F4ECF8', accent: '#8B5CF6', soft: '#E4D8FB' },
  { bg: '#FFF4D9', accent: '#E0A100', soft: '#FBE7B0' }
];

/* ---------- formatting ---------- */
const nf = n => n.toLocaleString('en-US');
const fmtLat = v => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
const fmtLon = v => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'E' : 'W'}`;
const fmtYear = (y, c) => (c ? 'c. ' : '') + (y < 0 ? `${-y} BC` : `${y}`);
const fmtPop = m => m >= 1000 ? `${(m / 1000).toFixed(2)} bn` : m >= 1 ? `${+m.toFixed(1)} m` : `${nf(Math.round(m * 1000))}k`;
const fmtKg = k => k >= 1000 ? `${nf(Math.round(k / 1000))} t` : k >= 1 ? `${+k.toFixed(1)} kg` : `${+(k * 1000).toFixed(k < .01 ? 0 : 0)} g`;

/* ---------- measures ---------- */
// Each measure ranks one list by one number. `apart` keeps neighbours far enough apart that the answer is never a coin flip.
const ratio = r => (a, b) => Math.max(a, b) / Math.min(a, b) >= r;
const diff = d => (a, b) => Math.abs(a - b) >= d;
const MEASURES = [
  { id: 'lat',   set: CITIES,     kind: 'Cities',    get: x => x.lat,  show: x => fmtLat(x.lat), q: 'North to south', top: 'Furthest north', bottom: 'Furthest south', desc: true,  apart: diff(3) },
  { id: 'lon',   set: CITIES,     kind: 'Cities',    get: x => x.lon,  show: x => fmtLon(x.lon), q: 'West to east',   top: 'Furthest west',  bottom: 'Furthest east',  desc: false, apart: diff(6) },
  { id: 'area',  set: COUNTRIES,  kind: 'Countries', get: x => x.area, show: x => `${nf(x.area)} km²`, q: 'Biggest to smallest', top: 'Biggest', bottom: 'Smallest', desc: true, apart: ratio(1.25) },
  { id: 'pop',   set: COUNTRIES,  kind: 'Countries', get: x => x.pop,  show: x => fmtPop(x.pop), q: 'Most people to fewest', top: 'Most people', bottom: 'Fewest people', desc: true, apart: ratio(1.25) },
  { id: 'peak',  set: COUNTRIES,  kind: 'Countries', get: x => x.peak, show: x => `${nf(x.peak)} m`, q: 'Highest peak to lowest', top: 'Highest peak', bottom: 'Lowest peak', desc: true, apart: diff(300), sub: () => 'highest point' },
  { id: 'mtn',   set: MOUNTAINS,  kind: 'Mountains', get: x => x.h,    show: x => `${nf(x.h)} m`, q: 'Tallest to shortest', top: 'Tallest', bottom: 'Shortest', desc: true, apart: diff(250) },
  { id: 'tall',  set: STRUCTURES, kind: 'Landmarks', get: x => x.h,    show: x => `${nf(x.h)} m`, q: 'Tallest to shortest', top: 'Tallest', bottom: 'Shortest', desc: true, apart: ratio(1.12) },
  { id: 'built', set: STRUCTURES, kind: 'Landmarks', get: x => x.year, show: x => fmtYear(x.year, x.circa), q: 'Oldest to newest', top: 'Oldest', bottom: 'Newest', desc: false, apart: diff(4) },
  { id: 'when',  set: EVENTS,     kind: 'History',   get: x => x.year, show: x => fmtYear(x.year, x.circa), q: 'Earliest to latest', top: 'Earliest', bottom: 'Latest', desc: false, apart: diff(4) },
  { id: 'kg',    set: ANIMALS,    kind: 'Animals',   get: x => x.kg,   show: x => fmtKg(x.kg), q: 'Heaviest to lightest', top: 'Heaviest', bottom: 'Lightest', desc: true, apart: ratio(1.5) }
];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : Math.max(1, todayNo);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Measures come round in a shuffled cycle, so every kind shows up once every ten days and never twice in a row.
const cycleOrder = c => shuffle([...MEASURES.keys()], mulberry(c * 7919 + 17));
function measureFor(day) {
  const n = MEASURES.length, c = Math.floor((day - 1) / n), order = cycleOrder(c);
  if (c > 0 && order[0] === cycleOrder(c - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return MEASURES[order[(day - 1) % n]];
}
function puzzleFor(day) {
  const m = measureFor(day), r = mulberry(day * 104729 + 7);
  for (let attempt = 0; attempt < 500; attempt++) {
    const pick = [];
    for (const it of shuffle(m.set, r)) { if (pick.every(p => m.apart(m.get(p), m.get(it)))) pick.push(it); if (pick.length === SIZE) break; }
    if (pick.length < SIZE) continue;
    const answer = pick.slice().sort((a, b) => m.desc ? m.get(b) - m.get(a) : m.get(a) - m.get(b));
    if (pick.every((p, i) => p === answer[i])) continue;      // never start already solved
    return { m, start: pick, answer };
  }
  throw new Error('No puzzle for day ' + day);
}

/* ---------- saved progress ---------- */
const KEY = 'rank:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const { m, start, answer } = puzzleFor(DAY);
const today = store.days[DAY] || (store.days[DAY] = { order: start.map(x => x.name), tries: [] });
const byName = Object.fromEntries(start.map(x => [x.name, x]));

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const b = $('mute'); b.innerHTML = muted ? MUTE_OFF : MUTE_ON; b.setAttribute('aria-pressed', muted ? 'true' : 'false'); b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('rank:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('rank:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- board ---------- */
const UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
const DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const isDone = () => today.tries.length >= TRIES || (today.tries.length && today.tries[today.tries.length - 1].every(Boolean));
const won = () => today.tries.length > 0 && today.tries[today.tries.length - 1].every(Boolean);
let marks = null;    // green/red shown after a try, cleared once the player moves something

function render() {
  const done = isDone(), list = $('list');
  document.body.classList.toggle('done', done);
  list.innerHTML = '';
  today.order.forEach((name, i) => {
    const x = byName[name], li = document.createElement('li'), sub = m.sub ? m.sub(x) : x.sub;
    li.className = 'item' + (done ? (won() ? ' g' : '') : marks ? (marks[i] ? ' g' : ' r') : '');
    li.dataset.name = name;
    li.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${x.name}${sub ? `<small>${sub}</small>` : ''}</span>` +
      (done ? `<span class="val" style="animation-delay:${i * 90}ms">${m.show(x)}</span>`
            : `<span class="grip"><button aria-label="Move ${x.name} up" ${i === 0 ? 'disabled' : ''}>${UP}</button><button aria-label="Move ${x.name} down" ${i === SIZE - 1 ? 'disabled' : ''}>${DOWN}</button></span>`);
    if (!done) {
      const [up, dn] = li.querySelectorAll('button');
      up.onclick = () => move(i, i - 1); dn.onclick = () => move(i, i + 1);
      up.onpointerdown = dn.onpointerdown = e => e.stopPropagation();
      li.addEventListener('pointerdown', drag);
    }
    list.appendChild(li);
  });
  renderDots();
}
function renderDots() {
  $('dots').innerHTML = Array.from({ length: TRIES }, (_, i) => {
    const t = today.tries[i]; const c = t ? (t.every(Boolean) ? 'g' : i === TRIES - 1 ? 'r' : 'y') : '';
    return `<div class="dot ${c} ${!t && i === today.tries.length && !isDone() ? 'on' : ''}"></div>`;
  }).join('');
  const left = TRIES - today.tries.length;
  $('count').textContent = isDone() ? '' : `${left} ${left === 1 ? 'try' : 'tries'} left`;
}
function move(from, to) {
  if (to < 0 || to >= SIZE) return; audio();
  const [x] = today.order.splice(from, 1); today.order.splice(to, 0, x);
  marks = null; save(); render(); blip(420 + to * 60, .05, .05); buzz(8);
}

// The card follows the finger; its neighbours jump past it as it crosses them.
function drag(e) {
  if (isDone() || e.button > 0) return; audio();
  const li = e.currentTarget, list = $('list'), cards = [...list.children], from = cards.indexOf(li);
  const step = cards[1].offsetTop - cards[0].offsetTop, y0 = e.clientY;
  let idx = from, moved = false;
  const onMove = ev => {
    const dy = ev.clientY - y0;
    if (!moved && Math.abs(dy) < 4) return;
    if (!moved) { moved = true; li.classList.add('drag'); blip(360, .04, .04); }
    const to = Math.max(0, Math.min(SIZE - 1, from + Math.round(dy / step)));
    if (to !== idx) { list.insertBefore(li, [...list.children].filter(c => c !== li)[to] || null); idx = to; blip(440 + to * 60, .035, .04); buzz(5); }
    li.style.transform = `translateY(${dy - (idx - from) * step}px)`;
  };
  const onUp = () => {
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    li.classList.remove('drag'); li.style.transform = '';
    if (!moved) return;
    const order = [...list.children].map(c => c.dataset.name);
    if (order.join() !== today.order.join()) { today.order = order; marks = null; save(); }
    render();
  };
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
}

/* ---------- lock + reveal ---------- */
function lock() {
  if (isDone()) return; audio();
  const t = today.order.map((name, i) => name === answer[i].name);
  today.tries.push(t); marks = t;
  const n = t.filter(Boolean).length;
  if (isDone()) {
    today.order = answer.map(x => x.name); save(); render(); verdict(true);
  } else {
    save(); render();
    [...$('list').children].forEach((li, i) => { if (!t[i]) { li.classList.remove('shake'); void li.offsetWidth; li.classList.add('shake'); } });
    blip(330, .12, .08, 'sine'); n >= 3 ? blip(494, .15, .06, 'triangle', .1) : blip(262, .18, .07, 'sine', .12); buzz(15);
    $('pill').className = 'pill y'; $('pill').textContent = `${n} of ${SIZE}`;
    $('vtxt').innerHTML = `in the right place<small>Green ones are right. One more try.</small>`;
    $('result').classList.add('show'); $('next').classList.add('hide');
  }
}
function verdict(fresh) {
  $('lock').classList.add('hide'); $('next').classList.remove('hide'); $('result').classList.add('show');
  const w = won(), first = w && today.tries.length === 1;
  $('pill').className = 'pill ' + (w ? 'g' : 'r'); $('pill').textContent = first ? 'Perfect' : w ? 'Got it' : 'Not quite';
  $('vtxt').innerHTML = first ? 'First try!<small>Every one in the right place.</small>' : w ? 'On the second try<small>Here are the real numbers.</small>' : 'Here’s the right order<small>with the real numbers.</small>';
  if (!fresh) return;
  if (first) { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (w) [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  $('next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
$('lock').onclick = lock;
$('next').onclick = () => { audio(); blip(600, .06, .05); finish(true); };
addEventListener('keydown', e => { if (e.key !== 'Enter' || $('end').classList.contains('show')) return; if (!isDone()) lock(); else $('next').click(); });

/* ---------- end + stats ---------- */
const SQ = b => b ? '🟩' : '⬜';
const complete = d => d && d.tries && (d.tries.length >= TRIES || (d.tries.length && d.tries[d.tries.length - 1].every(Boolean)));
const wonDay = d => complete(d) && d.tries[d.tries.length - 1].every(Boolean);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { if (complete(store.days[d])) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() {
  return `Rank #${DAY} ${won() ? today.tries.length : 'X'}/${TRIES}\n${m.q}\n${today.tries.map(t => t.map(SQ).join('')).join('\n')}\nolid.is/rank`;
}
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show'); scrollTo(0, 0);
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', '#1E1B24');
  $('endDay').textContent = '#' + DAY; $('endPrompt').textContent = m.q.toLowerCase();
  $('total').innerHTML = `${won() ? today.tries.length : 'X'}<small> / ${TRIES} ${won() ? (today.tries.length === 1 ? 'try' : 'tries') : ''}</small>`;
  $('rcard').innerHTML = answer.map((x, i) => {
    const sub = m.sub ? m.sub(x) : x.sub;
    return `<div class="rline"><div class="re">${i + 1}</div><div class="rt"><b>${x.name}</b>${sub || ''}</div><div class="rp">${m.show(x)}</div><div class="tries">${today.tries.map(t => SQ(t[i])).join('')}</div></div>`;
  }).join('');
  const done = Object.values(store.days).filter(complete), wins = done.filter(wonDay).length;
  $('stats').innerHTML = `<div class="stat"><b>${done.length}</b><span>played</span></div><div class="stat"><b>${streak()}</b><span>streak</span></div><div class="stat"><b>${done.length ? Math.round(100 * wins / done.length) : 0}%</b><span>solved</span></div>`;
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
$('kind').textContent = m.kind; $('question').textContent = m.q;
$('top').textContent = '↑ ' + m.top; $('bottom').textContent = '↓ ' + m.bottom;
window.RANK_DEBUG = { puzzleFor, measureFor, MEASURES };
render();
if (isDone()) { verdict(false); if (today.seen) finish(false); }
$('next').addEventListener('click', () => { today.seen = true; save(); });
})();
