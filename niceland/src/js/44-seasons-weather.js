/**
 * Seasons, daylight and weather
 *
 * Seasons, snow cover, the real sun height over Reykjavík, light colour and weather.
 *
 * Functions: gameDOY, curDOY, seasonOf, dateStr, leafCol, snowCov, applySeason, sunElev, lighting, wxW,
 *     wxDim, pickWx, wxReady, setWeather, stepWeather, mkClouds, drawWeather, cloudFill, auroraLevel,
 *     drawAurora, drawOceanBG, initSeasonUI
 * State and constants: SEASON_MODE, WEATHER_MODE, SEAS, WX, WXN, wxA, wxTimer, snowAcc, WIND,
 *     windS, TEMP, seasonKey, SEAS_DOY, SEAS_IS, WX_IS, WX_EN, MON, SPS, SP, LEAVES, SUNE, WXP, wxRamp,
 *     FLAKES, cloudTex, cloudPat, AUR_TOAST
 */

let SEASON_MODE = 'auto',
  WEATHER_MODE = 'auto',
  SEAS = 'summer',
  WX = 'clear', // start on a sunny day
  WXN = null,
  wxA = 1,
  wxTimer = 360, // keep the opening sunshine for a few minutes before the weather starts to change
  snowAcc = 0,
  WIND = [0.8, 0.35],
  windS = 4,
  TEMP = 6,
  seasonKey = '';
const SEAS_DOY = { winter: 20, spring: 120, summer: 182, autumn: 280 };
const SEAS_IS = { winter: 'Vetur', spring: 'Vor', summer: 'Sumar', autumn: 'Haust' };
const WX_IS = {
  clear: 'Heiðskírt',
  cloudy: 'Skýjað',
  rain: 'Rigning',
  snow: 'Snjókoma',
  storm: 'Óveður',
  fog: 'Þoka'
};
const WX_EN = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', storm: 'Storm', fog: 'Fog' };
const MON = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
function gameDOY() {
  return (DOY0 + Math.floor(gameMin / 1440)) % 365;
}
function curDOY() {
  return SEASON_MODE === 'auto' ? gameDOY() : SEAS_DOY[SEASON_MODE];
}
function seasonOf(d) {
  return d >= 319 || d < 90 ? 'winter' : d < 151 ? 'spring' : d < 243 ? 'summer' : 'autumn';
}
function dateStr() {
  const d = curDOY();
  const ml = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let m = 0,
    r = d;
  while (r >= ml[m]) {
    r -= ml[m];
    m = (m + 1) % 12;
  }
  return r + 1 + '. ' + MON[m];
}
// season parameters used by the ground colours, trees and roofs
const SPS = {
  winter: { cover: 0.62, line: 0, g: [1.08, 0.9, 0.78], ice: 1, leaf: 0, lup: 0 },
  spring: { cover: 0, line: 430, g: [1.12, 0.97, 0.8], ice: 0, leaf: 1, lup: 0 },
  summer: { cover: 0, line: 980, g: [0.88, 1.1, 0.9], ice: 0, leaf: 2, lup: 1 },
  autumn: { cover: 0, line: 760, g: [1, 1, 1], ice: 0, leaf: 3, lup: 0 }
};
let SP = SPS.autumn;
const LEAVES = [
  null,
  [
    [150, 186, 92],
    [132, 176, 80],
    [168, 196, 104],
    [120, 166, 74],
    [156, 190, 96]
  ],
  [
    [78, 134, 58],
    [64, 120, 50],
    [92, 146, 62],
    [70, 128, 56],
    [84, 140, 54]
  ],
  null
];
function leafCol(sd) {
  const L = SP.leaf === 3 ? AUT : LEAVES[SP.leaf];
  return L ? L[((sd * 5) | 0) % 5] : null;
}
// snow cover at a point (0..1); used by the ground renderer
function snowCov(z, x, y, smooth) {
  const acc = snowAcc;
  let c = SP.line ? (z - SP.line) / 240 : -1;
  if (SP.cover || acc > 0) {
    c = Math.max(c, SP.cover + acc + z / 350 - 0.05);
  }
  if (c <= 0) return 0;
  if (c >= 1.3) return 1;
  if (smooth) return Math.min(1, c);
  const n = vn(x / 18 + 3, y / 18 + 7) * 0.65 + vn(x / 5.5, y / 5.5 + 2) * 0.35;
  return n < c - 0.15 ? 1 : n < c ? (c - n) / 0.15 : 0;
}
function applySeason(force) {
  const s = SEASON_MODE === 'auto' ? seasonOf(gameDOY()) : SEASON_MODE;
  const q = Math.round(snowAcc * 5);
  const key = s + '|' + q;
  if (key === seasonKey && !force) return;
  const first = seasonKey === '';
  seasonKey = key;
  SEAS = s;
  SP = SPS[s];
  if (!first) {
    if (READY) snapScreen();
    CACHE.clear();
    cachePx = 0;
  }
}
/* daylight from the sun's path over Reykjavík (64.1° N); solar noon ≈ 13:28 */

let SUNE = 0;
function sunElev(doy, h) {
  const lat = (64.13 * Math.PI) / 180,
    dec = ((-23.44 * Math.PI) / 180) * Math.cos((2 * Math.PI * (doy + 10)) / 365),
    H = ((h - 13.47) * 15 * Math.PI) / 180;
  return (
    (Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) * 180) / Math.PI
  );
}
function lighting() {
  const m = gameMin % 1440,
    ss = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
  // light follows the true height of the sun: low and golden all day in December, bright twilight all night in June
  const e = sunElev(curDOY(), m / 60);
  SUNE = e;
  // one smooth ramp from nautical twilight to well above the horizon (no step at civil twilight)
  let d = ss(-12, 6, e);
  dayL = d;
  const tw = Math.max(4 * dayL * (1 - dayL) * 0.6, ss(-7, -2, e) * (1 - ss(3, 13, e)));
  LR = 0.27 + 0.73 * dayL + tw * 0.09;
  LG = 0.33 + 0.67 * dayL - tw * 0.02;
  LB = 0.55 + 0.45 * dayL - tw * 0.1;
  const w = wxDim();
  LR *= w[0];
  LG *= w[1];
  LB *= w[2];
  night = dayL < 0.5;
  nightK = Math.max(0, Math.min(1, (0.62 - dayL) / 0.56));
}
function wxW(t) {
  return t === WX ? (WXN ? wxA : 1) : t === WXN ? 1 - wxA : 0;
}
function wxDim() {
  const D = {
    clear: [1, 1, 1],
    cloudy: [0.9, 0.91, 0.93],
    rain: [0.8, 0.82, 0.86],
    snow: [0.88, 0.9, 0.95],
    storm: [0.68, 0.7, 0.75],
    fog: [0.92, 0.93, 0.95]
  };
  let r = 0,
    g = 0,
    b = 0,
    s = 0;
  for (const t in D) {
    const w = wxW(t);
    if (!w) continue;
    r += D[t][0] * w;
    g += D[t][1] * w;
    b += D[t][2] * w;
    s += w;
  }
  return s ? [r / s, g / s, b / s] : [1, 1, 1];
}
const WXP = {
  winter: { clear: 0.25, cloudy: 0.25, snow: 0.3, storm: 0.12, fog: 0.03, rain: 0.05 },
  spring: { clear: 0.3, cloudy: 0.3, rain: 0.2, snow: 0.08, fog: 0.07, storm: 0.05 },
  summer: { clear: 0.38, cloudy: 0.3, rain: 0.2, fog: 0.08, storm: 0.04 },
  autumn: { clear: 0.22, cloudy: 0.3, rain: 0.28, storm: 0.12, fog: 0.05, snow: 0.03 }
};
function pickWx() {
  const P = WXP[SEAS];
  let s = 0;
  for (const k in P) s += P[k];
  let r = R() * s;
  for (const k in P) {
    r -= P[k];
    if (r <= 0) return k;
  }
  return 'cloudy';
}
function wxReady() {
  try {
    return READY;
  } catch (e) {
    return false;
  }
}
let wxRamp = 14;
function setWeather(w, fast) {
  wxRamp = fast ? 2.5 : 14;
  if (w === WX && !WXN) return;
  if (wxReady() && w === 'storm')
    toast('Veðurstofan: appelsínugul viðvörun · orange storm warning. Stay indoors, roads are slow');
  else if (wxReady() && w === 'snow' && SEAS === 'winter')
    toast('Veðurstofan: gul viðvörun · yellow warning for snow. Snowploughs are out');
  if (WXN && wxA < 0.5) {
    WX = WXN;
  }
  WXN = WX;
  WX = w;
  wxA = 0;
  const a = Math.random() * 6.3;
  WIND = [Math.cos(a), Math.sin(a)];
  windS = w === 'storm' ? 18 : w === 'clear' ? 2 + R() * 3 : 4 + R() * 6;
}
function stepWeather(dt, gdt) {
  if (WXN) {
    wxA = Math.min(1, wxA + dt / wxRamp);
    if (wxA >= 1) WXN = null;
  }
  if (WEATHER_MODE === 'auto') {
    wxTimer -= gdt;
    if (wxTimer <= 0) {
      wxTimer = 180 + R() * 360;
      setWeather(pickWx());
    }
  }
  const snowing = wxW('snow') + wxW('storm') * (SEAS === 'winter' ? 1 : 0),
    raining = wxW('rain') + wxW('storm') * (SEAS === 'winter' ? 0 : 1);
  if (raining > 0.3) rainT = Math.max(rainT, 0.5);
  const warm = SEAS === 'summer' ? 3 : SEAS === 'spring' || SEAS === 'autumn' ? 1.2 : 0.15;
  if (snowing > 0.3) snowAcc = Math.min(SEAS === 'winter' ? 0.5 : 0.38, snowAcc + gdt * 0.0016 * snowing);
  else
    snowAcc = Math.max(
      0,
      snowAcc - gdt * 0.0007 * warm * (wxW('clear') + 0.4) - (raining > 0.3 ? gdt * 0.002 : 0)
    );
  const base = { winter: -2, spring: 4, summer: 12, autumn: 6 }[SEAS],
    dayAmp = { winter: 1.5, spring: 4, summer: 5, autumn: 3 }[SEAS];
  TEMP =
    base +
    dayAmp * (dayL - 0.5) * 2 -
    wxW('storm') * 3 -
    wxW('snow') * 2 +
    wxW('clear') * (dayL > 0.5 ? 2 : -2);
  applySeason(false);
}
/* ---------- weather drawing ---------- */
const FLAKES = Array.from({ length: 700 }, () => [R(), R(), R()]);
let cloudTex = null;
function mkClouds() {
  const S = 128,
    c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const x = c.getContext('2d'),
    im = x.createImageData(S, S);
  const tv = (a, b, sc) => {
    const f = (i, j) => h32(((i % sc) + sc) % sc, ((j % sc) + sc) % sc, 91);
    const ai = Math.floor(a),
      bj = Math.floor(b),
      u = a - ai,
      v = b - bj,
      uu = u * u * (3 - 2 * u),
      vv = v * v * (3 - 2 * v);
    return (
      f(ai, bj) * (1 - uu) * (1 - vv) +
      f(ai + 1, bj) * uu * (1 - vv) +
      f(ai, bj + 1) * (1 - uu) * vv +
      f(ai + 1, bj + 1) * uu * vv
    );
  };
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const n =
        0.55 * tv(i / 32, j / 32, 4) + 0.3 * tv(i / 16 + 3, j / 16, 8) + 0.15 * tv(i / 8, j / 8 + 5, 16);
      const a = Math.max(0, Math.min(1, (n - 0.5) * 3.2));
      const p = (i + j * S) * 4;
      im.data[p] = 20;
      im.data[p + 1] = 26;
      im.data[p + 2] = 36;
      im.data[p + 3] = a * 255;
    }
  x.putImageData(im, 0, 0);
  cloudTex = c;
}
function drawWeather() {
  const cw = wxW('cloudy') * 0.8 + wxW('rain') + wxW('storm') + wxW('snow') * 0.7;
  if (cw > 0.02) {
    if (!cloudTex) mkClouds();
    const T = Math.max(220, Math.min(2600, K * 2600));
    const ox = -(((camX + time * WIND[0] * windS * K * 3) % T) + T) % T,
      oy = -(((camY + time * WIND[1] * windS * K * 1.5) % T) + T) % T;
    ctx.save();
    ctx.globalAlpha = Math.min(0.42, cw * 0.3);
    ctx.imageSmoothingEnabled = true;
    cloudFill(ox, oy, T);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  }
  const rain =
    wxW('rain') +
    (SEAS === 'winter' ? 0 : wxW('storm') * 1.6) +
    (rainT > 0 && !(wxW('rain') || wxW('storm')) ? 1 : 0);
  if (rain > 0.02) {
    const n = ((VW * VH) / 1500) * rain,
      wx = WIND[0] * windS * 0.25;
    ctx.fillStyle = 'rgba(180,205,235,' + (0.38 + 0.1 * Math.min(1, rain)) + ')';
    for (let q = 0; q < n; q++) {
      const x = (R() * VW) | 0,
        y = (R() * VH) | 0;
      ctx.fillRect(x, y, 1, 3);
      if (windS > 10) ctx.fillRect(x + Math.sign(wx), y + 3, 1, 2);
    }
    ctx.fillStyle = 'rgba(30,40,60,' + 0.1 * Math.min(1.5, rain) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
  const snow = wxW('snow') + (SEAS === 'winter' ? wxW('storm') * 1.6 : 0);
  if (snow > 0.02) {
    const n = Math.min(FLAKES.length, (FLAKES.length * 0.5 * snow) | 0),
      sp = windS * (1 + snow);
    ctx.fillStyle = 'rgba(245,248,252,.9)';
    for (let i = 0; i < n; i++) {
      const f = FLAKES[i];
      const x = (((f[0] * VW + time * (WIND[0] * sp * 3 + Math.sin(time + f[2] * 9) * 4)) % VW) + VW) % VW,
        y = (((f[1] * VH + time * (14 + f[2] * 16 + WIND[1] * sp)) % VH) + VH) % VH;
      const s = f[2] > 0.7 ? 2 : 1;
      ctx.fillRect(x | 0, y | 0, s, s);
    }
  }
  const fog = wxW('fog');
  if (fog > 0.02) {
    const a = fog * (0.5 + 0.1 * Math.sin(time * 0.2));
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    const c = night ? '40,48,58' : '214,222,228';
    g.addColorStop(0, 'rgba(' + c + ',' + a * 1.25 + ')');
    g.addColorStop(1, 'rgba(' + c + ',' + a * 0.8 + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    if (!cloudTex) mkClouds();
    const T = Math.max(300, K * 1200),
      ox = -(((camX + time * 8) % T) + T) % T;
    ctx.save();
    ctx.globalAlpha = fog * 0.25;
    ctx.globalCompositeOperation = 'screen';
    ctx.imageSmoothingEnabled = true;
    cloudFill(ox, -((camY % T) + T) % T, T);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  }
}
let cloudPat = null;
function cloudFill(ox, oy, T) {
  if (!cloudPat) cloudPat = ctx.createPattern(cloudTex, 'repeat');
  cloudPat.setTransform(new DOMMatrix().translate(ox, oy).scale(T / 128));
  ctx.fillStyle = cloudPat;
  ctx.fillRect(0, 0, VW, VH);
}
/* norðurljós: how strong they are changes from night to night; they are best around midnight, and only when the sky is dark and clear */
let AUR_TOAST = -1;
function auroraLevel() {
  const e = SUNE;
  if (e > -9) return 0;
  const dark = Math.min(1, (-9 - e) / 5);
  const clear = wxW('clear') + wxW('cloudy') * 0.3;
  if (clear < 0.05) return 0;
  const night = Math.floor((gameMin - 720) / 1440);
  const kp = h32(night, 17, 3);
  if (kp < 0.3) return 0;
  const act = Math.pow((kp - 0.3) / 0.7, 0.8);
  const h = (gameMin % 1440) / 60,
    dh = ((h - 23.5 + 36) % 24) - 12;
  const tod = 0.35 + 0.65 * Math.exp((-dh * dh) / 8);
  const burst =
    0.75 + 0.25 * Math.sin(time * 0.05 + night) + 0.15 * Math.max(0, Math.sin(time * 0.013 + night * 2));
  return Math.min(1.2, dark * clear * act * tod * burst);
}
function drawAurora() {
  const A = auroraLevel();
  if (A <= 0.02) return;
  const night = Math.floor((gameMin - 720) / 1440);
  if (A > 0.35 && AUR_TOAST !== night) {
    AUR_TOAST = night;
    toast('Norðurljós · the northern lights are out');
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(40,200,120,' + 0.05 * A + ')';
  ctx.fillRect(0, 0, VW, VH); // green light on the snow, sea and roofs
  const cur = [
    [0.2, 1, 0],
    [0.32, 0.8, 2.1],
    [0.46, 0.55, 4.3]
  ];
  const st = 3,
    ph = ROT * 1.3;
  for (const [by, str, o] of cur) {
    const H = VH * (0.08 + 0.16 * A) * str,
      a0 = A * str;
    if (a0 < 0.04) continue;
    for (let x = 0; x < VW; x += st) {
      const u = x / VW;
      const y =
        VH * by +
        Math.sin(u * 5.1 + time * 0.05 + o + ph) * VH * 0.06 +
        Math.sin(u * 13.7 - time * 0.11 + o * 1.3) * VH * 0.018 +
        Math.sin(u * 31 - time * 0.3 + o) * 4;
      const fold = 0.55 + 0.45 * Math.sin(u * 9.3 + time * 0.07 + o * 2);
      const ray = 0.6 + 0.4 * Math.sin(x * 0.35 + time * 1.6 + o) * Math.sin(x * 0.11 - time * 0.9);
      const I =
        a0 * fold * ray * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u + 0.15) * 1.1))));
      if (I < 0.02) continue;
      const h = H * (0.7 + 0.5 * Math.sin(u * 7 + time * 0.04 + o));
      ctx.fillStyle = 'rgba(110,255,170,' + Math.min(0.8, 0.7 * I) + ')';
      ctx.fillRect(x, y - 2, st, 4);
      ctx.fillStyle = 'rgba(60,240,140,' + 0.38 * I + ')';
      ctx.fillRect(x, y - h * 0.35, st, h * 0.35);
      ctx.fillStyle = 'rgba(50,200,140,' + 0.2 * I + ')';
      ctx.fillRect(x, y - h * 0.75, st, h * 0.4);
      if (A > 0.6) {
        ctx.fillStyle = 'rgba(200,80,200,' + 0.25 * I * (A - 0.5) + ')';
        ctx.fillRect(x, y - h, st, h * 0.3);
        ctx.fillStyle = 'rgba(255,90,150,' + 0.3 * I * (A - 0.5) + ')';
        ctx.fillRect(x, y + 2, st, 3);
      }
    }
  }
  ctx.restore();
}
function drawOceanBG() {
  ctx.fillStyle = C_([24, 56, 90], 1);
  ctx.fillRect(0, 0, VW, VH);
}
function initSeasonUI() {
  const ss = $('#season'),
    ws = $('#weather');
  ss.innerHTML =
    '<option value="auto">Season: by date</option>' +
    ['winter', 'spring', 'summer', 'autumn']
      .map(
        s => '<option value="' + s + '">' + SEAS_IS[s] + ' · ' + s[0].toUpperCase() + s.slice(1) + '</option>'
      )
      .join('');
  ws.innerHTML =
    '<option value="auto">Weather: changing</option>' +
    Object.keys(WX_IS)
      .map(w => '<option value="' + w + '">' + WX_IS[w] + ' · ' + WX_EN[w] + '</option>')
      .join('');
  ss.onchange = () => {
    SEASON_MODE = ss.value;
    snowAcc = 0;
    applySeason(true);
    lighting();
    toast(
      SEASON_MODE === 'auto' ? 'Seasons follow the calendar' : SEAS_IS[SEASON_MODE] + ' · ' + SEASON_MODE
    );
    ss.blur();
  };
  ws.onchange = () => {
    WEATHER_MODE = ws.value;
    if (ws.value !== 'auto') setWeather(ws.value, true);
    else wxTimer = 0;
    ws.blur();
  };
  ss.addEventListener('keydown', e => e.stopPropagation());
  ws.addEventListener('keydown', e => e.stopPropagation());
  const place = () => {
    const mob = innerWidth <= 760;
    if (mob) {
      const s = $('#stats').getBoundingClientRect();
      $('#ctrl').style.top = s.bottom + 8 + 'px';
    } else $('#ctrl').style.top = '';
    const r = $('#ctrl').getBoundingClientRect();
    $('#insp').style.top = r.bottom + 8 + 'px';
  };
  place();
  addEventListener('resize', place);
}
