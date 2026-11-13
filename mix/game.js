// Mix — a daily game. Match the colour by adding drops of paint. A drop can't come back out.
// No backend: the date picks the day's colours, so everyone gets the same set.
(() => {
const INK = '#1E1B24', $ = id => document.getElementById(id);
const PER_DAY = 5;
const LAUNCH = [2026, 10, 12];             // same numbering as the other daily games (month is 0-based)
const PAINTS = {
  pink:   { name: 'Pink',   hex: '#E8247C' },
  yellow: { name: 'Yellow', hex: '#FFD91A' },
  cyan:   { name: 'Cyan',   hex: '#00A3E0' },
  white:  { name: 'White',  hex: '#FFFFFF' },
  black:  { name: 'Black',  hex: '#26222E' }
};
// what each round hands you, and how many drops the pot holds
const LEVELS = [
  { sets: [['pink', 'white'], ['cyan', 'white'], ['pink', 'yellow'], ['yellow', 'cyan'], ['cyan', 'pink']], cap: 8 },
  { sets: [['pink', 'yellow', 'white'], ['cyan', 'yellow', 'white'], ['pink', 'cyan', 'white'], ['pink', 'yellow', 'cyan']], cap: 10 },
  { sets: [['pink', 'yellow', 'white'], ['cyan', 'yellow', 'white'], ['pink', 'cyan', 'white'], ['pink', 'yellow', 'black'], ['cyan', 'yellow', 'black']], cap: 10 },
  { sets: [['pink', 'yellow', 'cyan', 'white'], ['pink', 'cyan', 'white', 'black'], ['pink', 'yellow', 'white', 'black']], cap: 12 },
  { sets: [['pink', 'yellow', 'cyan', 'white'], ['pink', 'yellow', 'cyan', 'black'], ['yellow', 'cyan', 'white', 'black']], cap: 12 }
];

/* ---------- day + seeded randomness ---------- */
const localDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5;
const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
const qDay = parseInt(new URLSearchParams(location.search).get('day'), 10);
const DAY = Number.isFinite(qDay) && qDay > 0 ? qDay : todayNo;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- colour ---------- */
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toLin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
const toSrgb = l => Math.round(255 * Math.max(0, Math.min(1, l <= .0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - .055)));
// Paint mixing. Coloured paints mix like pigments (Kubelka–Munk, per channel), so cyan + yellow makes green, not grey.
// White and black then tint and shade that colour, the way you'd expect from a pot of paint.
// (reflectance is squeezed a little first, so pigments don't swamp each other: cyan + pink can still make purple)
const SQ0 = .08, LIN = {}, KS = {};
for (const k in PAINTS) { LIN[k] = hex2rgb(PAINTS[k].hex).map(toLin); KS[k] = LIN[k].map(r => { r = SQ0 + (1 - 2 * SQ0) * r; return (1 - r) ** 2 / (2 * r); }); }
function mix(counts) {
  let tot = 0, nPig = 0; const acc = [0, 0, 0];
  for (const k in counts) { const n = counts[k]; if (!n) continue; tot += n; if (k === 'white' || k === 'black') continue; nPig += n; for (let c = 0; c < 3; c++) acc[c] += n * KS[k][c]; }
  if (!tot) return null;
  const pig = nPig ? acc.map(v => { const ks = v / nPig; return Math.max(0, (1 + ks - Math.sqrt(ks * ks + 2 * ks) - SQ0) / (1 - 2 * SQ0)); }) : null;
  const fw = (counts.white || 0) / tot, fk = (counts.black || 0) / tot, fp = nPig / tot;
  return [0, 1, 2].map(c => toSrgb((pig ? pig[c] * fp : 0) + LIN.white[c] * fw + LIN.black[c] * fk * 1));
}
const css = rgb => rgb ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` : 'transparent';
function lab(rgb) {
  const [r, g, b] = rgb.map(toLin);
  let x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIEDE2000 colour difference
function dE(c1, c2) {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2), rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = .5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (a, b) => { if (!a && !b) return 0; const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1 = h(a1p, b1), h2 = h(a2p, b2), dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh / 2 * rad), Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1 + h2; if (C1p * C2p) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - .17 * Math.cos((hm - 30) * rad) + .24 * Math.cos(2 * hm * rad) + .32 * Math.cos((3 * hm + 6) * rad) - .2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + .015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + .045 * Cmp, SH = 1 + .015 * Cmp * T;
  const RT = -2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
function hsl(rgb) {
  const [r, g, b] = rgb.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hh *= 60; if (hh < 0) hh += 360; return [hh, s, l];
}
const NOUNS = [
  [15, ['Tomato', 'Brick', 'Cherry', 'Ruby']], [35, ['Coral', 'Rust', 'Terracotta', 'Paprika']], [48, ['Tangerine', 'Apricot', 'Pumpkin', 'Caramel']],
  [62, ['Mustard', 'Honey', 'Marigold', 'Butterscotch']], [80, ['Lemon', 'Banana', 'Custard', 'Canary']], [100, ['Olive', 'Pear', 'Pistachio', 'Lime']],
  [150, ['Moss', 'Fern', 'Basil', 'Clover']], [185, ['Mint', 'Jade', 'Sage', 'Seafoam']], [215, ['Teal', 'Lagoon', 'Peacock', 'Glacier']],
  [245, ['Denim', 'Cornflower', 'Sapphire', 'Ink']], [280, ['Violet', 'Lavender', 'Iris', 'Indigo']], [320, ['Plum', 'Mauve', 'Grape', 'Orchid']],
  [345, ['Raspberry', 'Rose', 'Fuchsia', 'Peony']], [361, ['Tomato', 'Brick', 'Cherry', 'Ruby']]
];
function colourName(rgb, r) {
  const [hh, s, l] = hsl(rgb), pick = a => a[Math.floor(r() * a.length)];
  if (s < .12) return pick(l > .8 ? ['Cloud', 'Chalk', 'Fog'] : l > .45 ? ['Pebble', 'Ash', 'Concrete'] : ['Charcoal', 'Slate', 'Storm']);
  const noun = pick(NOUNS.find(([h]) => hh < h)[1]);
  const adj = l > .78 ? pick(['Pale', 'Soft', 'Misty', 'Baby']) : l < .3 ? pick(['Deep', 'Dark', 'Midnight', 'Smoky']) : s < .35 ? pick(['Dusty', 'Muddy', 'Faded', 'Old']) : s > .75 ? pick(['Bright', 'Electric', 'Loud', 'Hot']) : '';
  return (adj ? adj + ' ' : '') + noun;
}

/* ---------- the day's colours ---------- */
const gcd = (a, b) => b ? gcd(b, a % b) : a;
// Each day walks through different colour families, so it isn't five greens.
const FAMILIES = [[350, 15], [15, 42], [42, 68], [68, 165], [165, 255], [255, 310], [310, 350]];
const inFamily = (h, [a, b]) => a < b ? h >= a && h < b : h >= a || h < b;
function familiesForDay(day) { const r = mulberry(day * 31 + 5), a = FAMILIES.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }
function makeRound(day, i) {
  const L = LEVELS[i], r = mulberry(day * 6151 + i * 97 + 3), fam = familiesForDay(day)[i];
  for (let attempt = 0; attempt < 4000; attempt++) {
    const set = L.sets[Math.floor(r() * L.sets.length)], counts = {};
    // every paint is used at least once (in the last round one paint may be a decoy)
    set.forEach(k => counts[k] = 1 + Math.floor(r() * 4));
    if (i === PER_DAY - 1 && r() < .5) counts[set[Math.floor(r() * set.length)]] = 0;
    let g = 0; for (const k of set) g = gcd(g, counts[k]); for (const k of set) counts[k] /= g;
    const tot = set.reduce((s, k) => s + counts[k], 0);
    if (tot < (i ? 3 : 2) || tot > L.cap - (i < 2 ? 2 : 1)) continue;
    const rgb = mix(counts);
    // not just a tube colour, and not mud
    if (set.some(k => dE(rgb, hex2rgb(PAINTS[k].hex)) < 12)) continue;
    const [h, s, l] = hsl(rgb); if (s < .25 || l < .22 || l > .9) continue;
    if (attempt < 3500 && !inFamily(h, fam)) continue;
    return { set, cap: L.cap, counts, rgb, name: colourName(rgb, r) };
  }
}

/* ---------- saved progress ---------- */
const KEY = 'mix:v1';
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
const store = load();
const today = store.days[DAY] || (store.days[DAY] = { res: [], pot: null });

/* ---------- audio ---------- */
let ac = null, muted = false;
const MUTE_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>', MUTE_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function setMuteIcon() { const m = $('mute'); m.innerHTML = muted ? MUTE_OFF : MUTE_ON; m.setAttribute('aria-pressed', muted ? 'true' : 'false'); m.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on'); }
try { muted = localStorage.getItem('mix:muted') === '1'; } catch (e) {}
setMuteIcon();
function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function blip(f, dur = .07, vol = .06, type = 'triangle', delay = 0, slide) {
  if (!ac || muted) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
const plop = () => { blip(900, .09, .07, 'sine', 0, 260); blip(180, .12, .05, 'sine', .05); };
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
$('mute').onclick = () => { muted = !muted; setMuteIcon(); try { localStorage.setItem('mix:muted', muted ? '1' : '0'); } catch (e) {} };

/* ---------- canvas ---------- */
const cv = $('cv'), cx = cv.getContext('2d');
let W = 0, DPR = 1;
function resize() { DPR = Math.min(3, devicePixelRatio || 1); W = cv.getBoundingClientRect().width; cv.width = cv.height = Math.round(W * DPR); }
addEventListener('resize', resize);

/* ---------- state ---------- */
const rounds = Array.from({ length: PER_DAY }, (_, i) => makeRound(DAY, i));
let I = 0, R, pot = {}, drops = [], mode = 'mix', shown = null, from = null, blendT = 1, falling = [], swirls = [], reveal = 0;
$('dayNo').textContent = '#' + DAY;
const nDrops = () => drops.length;

function start(i, resume) {
  I = i; R = rounds[i]; mode = 'mix'; reveal = 0; falling = []; swirls = [];
  drops = resume && today.pot && today.pot.i === i ? today.pot.drops.slice() : [];
  pot = {}; R.set.forEach(k => pot[k] = 0); drops.forEach(k => pot[k]++);
  shown = mix(pot); from = shown; blendT = 1;
  const s = document.documentElement.style, [hh] = hsl(R.rgb);
  s.setProperty('--bg', `hsl(${hh} 70% 94%)`); s.setProperty('--accent', css(R.rgb));
  $('name').textContent = R.name; $('count').textContent = `${i + 1} / ${PER_DAY}`;
  $('paints').innerHTML = R.set.map(k => `<button class="paint" data-k="${k}" aria-label="Add a drop of ${PAINTS[k].name}"><span class="blob" style="background:${PAINTS[k].hex}"></span><span class="n"></span>${PAINTS[k].name}</button>`).join('');
  $('paints').querySelectorAll('.paint').forEach(b => b.onclick = () => addDrop(b.dataset.k, b));
  $('paints').classList.remove('hide'); $('controls').classList.remove('hide'); $('result').classList.remove('show');
  hint(drops.length ? '' : 'Tap the paints to add drops. They can’t come back out!');
  updateUI(); renderDots();
}
function hint(s) { $('hint').textContent = s; $('hint').style.opacity = s ? 1 : 0; }
function updateUI() {
  $('paints').querySelectorAll('.paint').forEach(b => { const n = pot[b.dataset.k], e = b.querySelector('.n'); e.textContent = '×' + n; e.classList.toggle('on', n > 0); b.disabled = mode !== 'mix' || nDrops() >= R.cap; });
  $('done').disabled = !nDrops() || mode !== 'mix';
  $('done').textContent = nDrops() >= R.cap ? 'Pot’s full! Done' : 'Done mixing';
}
function renderDots() { $('dots').innerHTML = rounds.map((_, i) => { const r = today.res[i]; return `<div class="dot ${r ? r.c : ''} ${i === I && !r ? 'on' : ''}"></div>`; }).join(''); }

function addDrop(k, btn) {
  if (mode !== 'mix' || nDrops() >= R.cap) return; audio();
  drops.push(k); today.pot = { i: I, drops: drops.slice() }; save();
  btn.classList.remove('squish'); void btn.offsetWidth; btn.classList.add('squish');
  // the drop falls from above the paint's button into the pot
  const br = btn.getBoundingClientRect(), cr = cv.getBoundingClientRect();
  falling.push({ k, x0: (br.left + br.width / 2 - cr.left) / cr.width, t0: performance.now() });
  hint(''); updateUI(); buzz(8);
}
function land(k) {
  pot[k]++; from = current(); shown = mix(pot); blendT = 0;
  swirls.push({ k, t0: performance.now(), a: Math.random() * 6.28 });
  plop(); updateUI();
}
function current() { if (!from || !shown) return shown; const e = ease(blendT); return from.map((v, c) => Math.round(v + (shown[c] - v) * e)); }
const ease = t => 1 - Math.pow(1 - Math.min(1, t), 3);

/* ---------- judging ---------- */
const exact = (a, b) => { const sa = Object.values(a).reduce((s, v) => s + v, 0), sb = Object.values(b).reduce((s, v) => s + v, 0); return R.set.every(k => (a[k] || 0) * sb === (b[k] || 0) * sa); };
function grade(d, ex) { if (ex || d < 1) return ['g', 'Perfect!']; if (d < 4) return ['y', 'So close']; if (d < 10) return ['o', 'Nearly']; return ['r', 'Different colour']; }
const matchPct = d => Math.max(0, Math.min(99, Math.round(100 - d * 3)));
const pointsFor = (d, ex) => ex || d < 1 ? 100 : Math.max(0, Math.round(95 - d * 4));
$('done').onclick = () => {
  if (mode !== 'mix' || !nDrops()) return; audio();
  // wait for any drops still in the air
  const go = () => { if (falling.length) return setTimeout(go, 60); judge(); };
  mode = 'judging'; updateUI(); go();
};
function judge() {
  const rgb = mix(pot), d = dE(rgb, R.rgb), ex = exact(pot, R.counts), [c, label] = grade(d, ex);
  today.res[I] = { c, d, ex, pts: pointsFor(d, ex), rgb, counts: { ...pot } }; today.pot = null; save();
  mode = 'done'; reveal = performance.now();
  $('paints').classList.add('hide'); $('controls').classList.add('hide'); $('result').classList.add('show');
  $('pill').className = 'pill ' + c; $('pill').textContent = label;
  $('vtxt').innerHTML = ex ? `Exactly the same recipe.<small>+100 points</small>` : `${matchPct(d)}% match.<small>+${today.res[I].pts} points</small>`;
  const row = (lab, counts, rgb) => `<div class="rr"><span>${lab}</span><div class="sw" style="background:${css(rgb)}"></div><div class="dl">${R.set.flatMap(k => Array(counts[k] || 0).fill(`<i style="background:${PAINTS[k].hex}"></i>`)).join('')}</div></div>`;
  $('recipe').innerHTML = row('Target', R.counts, R.rgb) + row('Yours', pot, rgb);
  $('next').textContent = I < PER_DAY - 1 ? 'Next colour' : 'See results';
  if (c === 'g') { [523, 659, 784, 1047].forEach((f, i) => blip(f, .22, .08, 'triangle', i * .07)); buzz([20, 40, 20]); }
  else if (c === 'y') [523, 659, 784].forEach((f, i) => blip(f, .18, .07, 'triangle', i * .08));
  else if (c === 'o') [440, 494].forEach((f, i) => blip(f, .2, .07, 'triangle', i * .1));
  else [262, 196].forEach((f, i) => blip(f, .25, .08, 'sine', i * .13));
  renderDots();
}
$('next').onclick = () => { audio(); blip(600, .06, .05); const n = today.res.length; if (n < PER_DAY) start(n); else finish(true); };
addEventListener('keydown', e => {
  if (e.key === 'Enter') { if (mode === 'done') $('next').click(); else $('done').click(); return; }
  const n = parseInt(e.key, 10); if (n >= 1 && R && n <= R.set.length && mode === 'mix') { const b = $('paints').children[n - 1]; addDrop(b.dataset.k, b); }
});

/* ---------- drawing ---------- */
function frame(now) {
  requestAnimationFrame(frame);
  if (!R || !W) return;
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, W, W);
  const ccx = W / 2, ccy = W * .47, rad = W * .34;
  if (blendT < 1) blendT = Math.min(1, blendT + 1 / 30);
  const yours = current();
  // labels
  cx.font = `700 ${Math.round(W * .03)}px Rubik, sans-serif`; cx.fillStyle = '#857F75'; cx.textAlign = 'center';
  cx.fillText('TARGET', ccx - rad * .5, ccy - rad - W * .03); cx.fillText('YOURS', ccx + rad * .5, ccy - rad - W * .03);
  // shadow + the two halves
  cx.beginPath(); cx.arc(ccx, ccy + 6, rad, 0, 7); cx.fillStyle = INK; cx.fill();
  cx.save(); cx.beginPath(); cx.arc(ccx, ccy, rad, 0, 7); cx.clip();
  cx.fillStyle = css(R.rgb); cx.fillRect(ccx - rad, ccy - rad, rad, rad * 2);
  if (yours) { cx.fillStyle = css(yours); cx.fillRect(ccx, ccy - rad, rad, rad * 2); }
  else { // an empty pot: hatched
    cx.fillStyle = '#FFFBF5'; cx.fillRect(ccx, ccy - rad, rad, rad * 2);
    cx.strokeStyle = 'rgba(30,27,36,.10)'; cx.lineWidth = 3; for (let x = -rad * 2; x < rad * 2; x += 14) { cx.beginPath(); cx.moveTo(ccx + x, ccy - rad); cx.lineTo(ccx + x + rad * 2, ccy + rad); cx.stroke(); }
  }
  // fresh drops swirl into your half
  swirls = swirls.filter(s => now - s.t0 < 900);
  for (const s of swirls) {
    const p = (now - s.t0) / 900;
    cx.save(); cx.beginPath(); cx.rect(ccx, ccy - rad, rad, rad * 2); cx.clip();
    cx.strokeStyle = PAINTS[s.k].hex; cx.globalAlpha = (1 - p) * .9; cx.lineCap = 'round';
    for (let j = 0; j < 3; j++) {
      const rr = rad * (.18 + j * .17 + p * .25), a0 = s.a + p * 5 + j * 2.1;
      cx.lineWidth = rad * .09 * (1 - p * .6); cx.beginPath(); cx.arc(ccx + rad * .5, ccy, rr, a0, a0 + 1.6 + p); cx.stroke();
    }
    cx.restore();
  }
  // the reveal: the line between the halves melts away if you nailed it
  cx.restore();
  cx.beginPath(); cx.arc(ccx, ccy, rad, 0, 7); cx.lineWidth = 3; cx.strokeStyle = INK; cx.stroke();
  const res = today.res[I], perfect = mode === 'done' && res && res.c === 'g';
  const lineA = perfect ? Math.max(0, 1 - (now - reveal) / 700) : 1;
  if (lineA > 0) { cx.globalAlpha = lineA; cx.beginPath(); cx.moveTo(ccx, ccy - rad); cx.lineTo(ccx, ccy + rad); cx.lineWidth = 3; cx.stroke(); cx.globalAlpha = 1; }
  // shine
  cx.beginPath(); cx.ellipse(ccx - rad * .45, ccy - rad * .55, rad * .2, rad * .11, -.6, 0, 7); cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fill();
  // falling drops
  falling = falling.filter(f => {
    const p = (now - f.t0) / 380; if (p >= 1) { land(f.k); return false; }
    const x = W * f.x0 + (ccx + rad * .5 - W * f.x0) * ease(p), y = W * 1.02 + (ccy - W * 1.02) * p - Math.sin(p * Math.PI) * W * .35, s = W * .035;
    cx.beginPath(); cx.moveTo(x, y - s * 1.6); cx.bezierCurveTo(x + s, y - s * .3, x + s, y + s, x, y + s); cx.bezierCurveTo(x - s, y + s, x - s, y - s * .3, x, y - s * 1.6);
    cx.fillStyle = PAINTS[f.k].hex; cx.fill(); cx.lineWidth = 2.5; cx.strokeStyle = INK; cx.stroke(); return true;
  });
  // the pot's drops, as a row of little dots (how full it is)
  const n = R.cap, gap = W * .045, y = ccy + rad + W * .075, x0 = ccx - (n - 1) * gap / 2;
  for (let k = 0; k < n; k++) {
    const key = drops[k], landed = k < Object.values(pot).reduce((s, v) => s + v, 0);
    cx.beginPath(); cx.arc(x0 + k * gap, y, W * .014, 0, 7);
    cx.fillStyle = key && landed ? PAINTS[key].hex : 'rgba(30,27,36,.08)'; cx.fill();
    if (key && landed) { cx.lineWidth = 1.5; cx.strokeStyle = INK; cx.stroke(); }
  }
  if (mode === 'done' && res) {
    const p = ease((now - reveal) / 500), txt = res.ex ? '100%' : matchPct(res.d) + '%';
    cx.save(); cx.translate(ccx, ccy); cx.scale(p, p);
    cx.font = `900 ${Math.round(W * .085)}px Rubik, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const tw = cx.measureText(txt).width + W * .06, th = W * .11;
    cx.fillStyle = INK; cx.beginPath(); cx.roundRect(-tw / 2, -th / 2 + 4, tw, th, th / 2); cx.fill();
    cx.fillStyle = '#FFFBF5'; cx.beginPath(); cx.roundRect(-tw / 2, -th / 2, tw, th, th / 2); cx.fill(); cx.lineWidth = 2.5; cx.strokeStyle = INK; cx.stroke();
    cx.fillStyle = INK; cx.fillText(txt, 0, 2); cx.restore();
  }
}

/* ---------- end + stats ---------- */
const SQ = { g: '🟩', y: '🟨', o: '🟧', r: '🟥' };
const total = res => res.reduce((s, r) => s + r.pts, 0);
function streak() { let s = 0; for (let d = todayNo; d > 0; d--) { const x = store.days[d]; if (x && x.res && x.res.length === PER_DAY) s++; else if (d === todayNo) continue; else break; } return s; }
function shareStr() { const p = today.res.filter(r => r.c === 'g').length; return `Mix #${DAY} 🎨 ${total(today.res)}/${PER_DAY * 100}\n${today.res.map(r => SQ[r.c]).join('')}  ${p}/${PER_DAY} perfect\nolid.is/mix`; }
function finish(fresh) {
  $('play').classList.add('hide'); $('end').classList.add('show');
  const s = document.documentElement.style; s.setProperty('--bg', '#F4EFE6'); s.setProperty('--accent', INK);
  $('endDay').textContent = '#' + DAY; $('total').innerHTML = `${total(today.res)}<small> / ${PER_DAY * 100}</small>`;
  $('rcard').innerHTML = rounds.map((Rr, i) => { const r = today.res[i];
    return `<div class="rline"><div class="sw2"><b style="background:${css(Rr.rgb)}"></b><b style="background:${css(r.rgb)}"></b></div><div class="rt">${Rr.name}<div class="rn">${r.ex ? 'Perfect recipe' : matchPct(r.d) + '% match'}</div></div><div class="rp">${r.pts}</div><div>${SQ[r.c]}</div></div>`; }).join('');
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
$('share').onclick = async () => {
  const txt = shareStr();
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ text: txt }); return; } await navigator.clipboard.writeText(txt); $('share').textContent = 'Copied!'; }
  catch (e) { $('share').textContent = 'Couldn’t copy'; }
  setTimeout(() => $('share').textContent = 'Share result', 1400);
};

window.MIX_DEBUG = { rounds, mix, dE, makeRound };
resize(); requestAnimationFrame(frame);
if (today.res.length >= PER_DAY) finish(false); else start(today.res.length, true);
})();
