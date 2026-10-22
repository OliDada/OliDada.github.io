/**
 * Traffic and movement
 *
 * Traffic volumes by hour, spawning cars, lanes and speed limits, and stepAgents(), which moves every
 * person and car.
 *
 * Functions: isWeekend, trafficFactor, initCounts, wayDens, surveyRoads, pickSeg, pickTrip, vtForTrip,
 *     onScr, spawnTraffic, nearBld, placeLabel, personName, fillCarStory, carCard, spawnCar, setPos,
 *     carOff, pedOff, offFor, say, stepAgents, closeRoute, carDetour, repath, arrive, behave, flee
 * State and constants: ADTC, ADT_DEF, VKMH, roadKmW, roadSegs, roadSegW, TRIPS, CARG, PBLK, AGRID, behN,
 *     PANIC
 */

function isWeekend() {
  const d = dayOfWeek();
  return d === 0 || d === 6;
}
function trafficFactor() {
  const h = (gameMin % 1440) / 60,
    d = dayOfWeek();
  let f;
  if (d === 0 || d === 6) {
    f =
      h < 7
        ? 0.08
        : h < 10
          ? 0.2 + (h - 7) * 0.08
          : h < 17.5
            ? d === 6
              ? 0.6
              : 0.45
            : h < 20
              ? 0.4
              : h < 23.5
                ? 0.25
                : 0.12;
    if (h < 4) f = 0.14;
  } else {
    f =
      h < 5
        ? 0.05
        : h < 6.5
          ? 0.05 + (h - 5) * 0.2
          : h < 7.3
            ? 0.75
            : h < 9
              ? 1
              : h < 11.5
                ? 0.5
                : h < 13.5
                  ? 0.65
                  : h < 15.5
                    ? 0.55
                    : h < 18.5
                      ? 1
                      : h < 20
                        ? 0.55
                        : h < 23
                          ? 0.3
                          : 0.12;
    if (d === 5 && h >= 15 && h < 18.5) f = 1.08;
  }
  return f * (rainT > 0 ? 1.08 : 1) * (1 - 0.3 * wxW('storm'));
}
// fallback: cars per km of road per direction at the busiest time
/* Reykjavík city traffic counts, vehicles per day both directions (sniðtalningar 2025, presented to the city's environment and planning council 26.11.2025).
   Each count is pinned where the street crosses the count line; streets with several counts are blended by distance. */
const ADTC = [
  ['Geirsgata', 64.1489, -21.9405, 20274],
  ['Hringbraut', 64.1407, -21.944, 38761],
  ['Njarðargata', 64.1394, -21.938, 12787],
  ['Vonarstræti', 64.1459, -21.9413, 4336],
  ['Skothúsvegur', 64.144, -21.9435, 3997],
  ['Tryggvagata', 64.1484, -21.941, 1272],
  ['Skólabrú', 64.1468, -21.9392, 1258],
  ['Sæbraut', 64.1468, -21.902, 24516],
  ['Borgartún', 64.1442, -21.901, 16670],
  ['Laugavegur', 64.1418, -21.901, 16166],
  ['Háaleitisbraut', 64.134, -21.893, 13230],
  ['Miklabraut', 64.1325, -21.899, 42133],
  ['Hamrahlíð', 64.1295, -21.9035, 7082],
  ['Bústaðavegur', 64.127, -21.901, 47660],
  ['Vesturlandsvegur', 64.1215, -21.836, 128963],
  ['Bíldshöfði', 64.124, -21.83, 4520],
  ['Höfðabakki', 64.1165, -21.829, 24373],
  ['Breiðholtsbraut', 64.1075, -21.832, 21567],
  ['Kringlumýrarbraut', 64.1205, -21.896, 79341],
  ['Reykjanesbraut', 64.111, -21.849, 81484],
  ['Vesturlandsvegur', 64.144, -21.757, 38664],
  ['Gullinbrú', 64.133, -21.821, 32395],
  ['Víkurvegur', 64.144, -21.79, 18683],
  ['Korpúlfsstaðavegur', 64.149, -21.77, 6276]
];
const ADT_DEF = [0, 22000, 14000, 7000, 3500, 700, 150];
const VKMH = [1, 65, 45, 40, 35, 30, 20];
function initCounts() {
  const lat0 = 64.124,
    lon0 = -21.89,
    KX = 111320 * Math.cos((lat0 * Math.PI) / 180),
    KY = 110574;
  const C = ADTC.map(c => ({ n: c[0].toLowerCase(), x: (c[2] - lon0) * KX, y: (lat0 - c[1]) * KY, v: c[3] }));
  let m = 0;
  for (const wy of WAYS) {
    if (wy.cl > 6) continue;
    const nm = (wy.name || '').toLowerCase();
    const L = C.filter(c => c.n === nm);
    if (!L.length) continue;
    const a = wy.nodes[0],
      b = wy.nodes[wy.nodes.length - 1],
      x = (NX[a] + NX[b]) / 2,
      y = (NY[a] + NY[b]) / 2;
    let ws = 0,
      vs = 0,
      dmin = 1e9;
    for (const c of L) {
      const d = Math.hypot(c.x - x, c.y - y);
      dmin = Math.min(dmin, d);
      const w = 1 / Math.max(100, d) ** 2;
      ws += w;
      vs += w * c.v;
    }
    if (dmin > 4000) continue;
    wy.adt = vs / ws;
    m++;
  }
  console.log('traffic counts on', m, 'ways');
}
// cars per km in one direction at the busiest hour: about 5.5 % of the day's traffic goes each way in the peak hour
function wayDens(wy) {
  const adt = wy.adt || ADT_DEF[wy.cl] || 0;
  return ((adt * 0.055) / VKMH[wy.cl]) * 0.7;
}
let roadKmW = 0,
  roadSegs = [],
  roadSegW = [];
function surveyRoads(vr) {
  roadSegs = [];
  roadSegW = [];
  let tot = 0;
  const seen = new Set();
  eachB2(SBUCK, vr[0], vr[1], vr[2], vr[3], (w, j) => {
    const key = w * 65536 + j;
    if (seen.has(key)) return;
    seen.add(key);
    const wy = WAYS[w];
    if (wy.cl > 6 || wy.tu || (SHUT && wy.fl & 1)) return;
    const a = wy.nodes[j],
      b = wy.nodes[j + 1];
    const L = Math.hypot(NX[b] - NX[a], NY[b] - NY[a]);
    const wt = ((wayDens(wy) * L) / 1000) * (wy.ow ? 1 : 2);
    if (wt <= 0) return;
    roadSegs.push(w, j);
    tot += wt;
    roadSegW.push(tot);
  });
  roadKmW = tot;
}
function pickSeg() {
  const r = R() * roadKmW;
  let lo = 0,
    hi = roadSegW.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (roadSegW[m] < r) lo = m + 1;
    else hi = m;
  }
  return [roadSegs[2 * lo], roadSegs[2 * lo + 1]];
}
/* why this car is on the road right now */
const TRIPS = {
  am: [
    ['commute', 0.62],
    ['school', 0.16],
    ['delivery', 0.08],
    ['errand', 0.06],
    ['taxi', 0.04],
    ['trade', 0.04]
  ],
  mid: [
    ['errand', 0.3],
    ['delivery', 0.18],
    ['trade', 0.14],
    ['meeting', 0.1],
    ['taxi', 0.08],
    ['visit', 0.08],
    ['doctor', 0.06],
    ['lunch', 0.06]
  ],
  pm: [
    ['home', 0.55],
    ['pickup', 0.14],
    ['gym', 0.08],
    ['errand', 0.1],
    ['delivery', 0.05],
    ['taxi', 0.04],
    ['visit', 0.04]
  ],
  eve: [
    ['home', 0.25],
    ['visit', 0.25],
    ['out', 0.2],
    ['taxi', 0.12],
    ['gym', 0.08],
    ['errand', 0.1]
  ],
  night: [
    ['home', 0.35],
    ['taxi', 0.35],
    ['shift', 0.2],
    ['out', 0.1]
  ],
  wkd: [
    ['shop', 0.28],
    ['family', 0.18],
    ['visit', 0.18],
    ['pool', 0.1],
    ['cabin', 0.08],
    ['taxi', 0.08],
    ['sport', 0.1]
  ]
};
function pickTrip() {
  const h = (gameMin % 1440) / 60;
  let L;
  if (h < 5 || h >= 23) L = TRIPS.night;
  else if (isWeekend()) L = h < 20 ? TRIPS.wkd : TRIPS.eve;
  else L = h < 9.5 ? TRIPS.am : h < 15.5 ? TRIPS.mid : h < 18.5 ? TRIPS.pm : TRIPS.eve;
  let r = R();
  for (const [t, p] of L) {
    r -= p;
    if (r <= 0) return t;
  }
  return L[0][0];
}
function vtForTrip(t, x, y) {
  if (t === 'taxi') return 'taxi';
  if (t === 'delivery') return R() < 0.6 ? 'van' : 'lorry';
  if (t === 'trade') return R() < 0.6 ? 'pickup' : 'van';
  if (t === 'cabin') return R() < 0.5 ? 'suv' : 'jeep';
  let v = pickVT(x, y);
  if (/coach|lorry|tractor|camper|bus/.test(v) && t !== 'family' && t !== 'cabin')
    v = R() < 0.6 ? 'car' : R() < 0.5 ? 'suv' : 'small';
  return v;
}
function onScr(x, y, pad) {
  const s = sp_(x, y, hAt(x, y));
  return s[0] > -pad && s[0] < VW + pad && s[1] > -pad * 1.5 && s[1] < VH + pad;
}
function spawnTraffic(vr) {
  if (!roadKmW) return false;
  const [w, j] = pickSeg();
  const wy = WAYS[w];
  let a = wy.nodes[j],
    b = wy.nodes[j + 1];
  if (onScr(NX[a], NY[a], 40)) return false;
  if (PBLK && (PBLK[a] || PBLK[b])) return false;
  if (!wy.ow && R() < 0.5) {
    const t = a;
    a = b;
    b = t;
  }
  const trip = pickTrip();
  const dx = NX[b] - NX[a],
    dy = NY[b] - NY[a],
    L = Math.hypot(dx, dy) || 1;
  // carry on along the road for a good while: destinations mostly ahead, longer on main roads
  const far = wy.cl <= 2 ? 1800 + R() * 3500 : wy.cl <= 4 ? 900 + R() * 2200 : 300 + R() * 900;
  const ang = Math.atan2(dy, dx) + (R() - 0.5) * 1.1;
  const t = nearestNode(NX[a] + Math.cos(ang) * far, NY[a] + Math.sin(ang) * far, GD, 500);
  if (t < 0) return false;
  const path = astar(GD, b, t, wy.cl <= 2 ? 40000 : 20000);
  if (!path || path.length < 2) return false;
  path.unshift(a);
  const c = mkAgent('car', NX[a], NY[a]);
  setVT(c, vtForTrip(trip, NX[a], NY[a]));
  c.trip = trip;
  c.from = [NX[a], NY[a]];
  c.path = path;
  c.pi = 0;
  c.t = R() * 0.8;
  if (
    (snowAcc > 0.12 || wxW('snow') > 0.5 || (wxW('storm') > 0.5 && SEAS === 'winter')) &&
    wy.cl <= 5 &&
    R() < 0.14
  ) {
    setVT(c, 'lorry');
    c.c = [236, 128, 24];
    c.plough = 1;
    c.trip = 'plough';
    c.vname = 'Snjóruðningstæki · Snowplough';
    c.sp = 9;
  }
  c.vx = dx / L;
  c.vy = dy / L;
  c.ldx = c.vx;
  c.ldy = c.vy;
  agents.push(c);
  return true;
}
/* who is in the car, and what they are doing (filled in the first time someone looks) */
function nearBld(x, y, r, test) {
  let best = null,
    bd = 1e9;
  nearB(x, y, r, b => {
    if (b.state >= 2 || !test(b)) return;
    const d = Math.hypot(b.cx - x, b.cy - y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  });
  return best;
}
function placeLabel(b) {
  return b ? b.name || b.addr || district(b.cx, b.cy) : '—';
}
function personName(f) {
  return (f ? pickA(FEMALE) : pickA(MALE)) + ' ' + pickA(FATHER) + (f ? 'dóttir' : 'son');
}
function fillCarStory(c) {
  if (c.story) return c.story;
  const p = c.path,
    end = p && p.length ? p[p.length - 1] : -1,
    ex = end >= 0 ? NX[end] : c.x,
    ey = end >= 0 ? NY[end] : c.y;
  const fx = c.from ? c.from[0] : c.x,
    fy = c.from ? c.from[1] : c.y;
  const home =
    nearBld(fx, fy, 300, b => b.kind <= 2 && b.res > 0) ||
    nearBld(ex, ey, 300, b => b.kind <= 2 && b.res > 0);
  const per = home ? mkPersona(home, 24 + ((R() * 48) | 0)) : null;
  const work = per && workOf(per);
  const dHome = nearBld(ex, ey, 250, b => b.kind <= 2 && b.res > 0);
  const job = nearBld(ex, ey, 350, b => b.jobs > 0),
    shop = nearBld(ex, ey, 600, b =>
      /supermarket|shop|retail|mall|Bónus|Krónan|Hagkaup|Kringlan|Smáralind/i.test(
        (b.use || '') + ' ' + (b.name || '')
      )
    ),
    school = nearBld(ex, ey, 600, b =>
      /school|kindergarten|skóli/i.test((b.use || '') + ' ' + (b.name || ''))
    );
  const pool = nearBld(ex, ey, 1500, b => /swimming|laug/i.test((b.use || '') + ' ' + (b.name || ''))),
    gym = nearBld(ex, ey, 1200, b => /fitness|gym|sports/i.test((b.use || '') + ' ' + (b.name || '')));
  const drv = {
    name: c.name || personName(c.female),
    age: per ? per.age : c.age,
    job: per ? per.job : 'Driver',
    f: c.female
  };
  const kids = n =>
    Array.from({ length: n }, () => ({
      name: personName(R() < 0.5).split(' ')[0],
      age: 4 + ((R() * 10) | 0)
    }));
  let doing,
    to,
    pax = [];
  const T = c.trip || 'errand';
  switch (T) {
    case 'commute':
      doing = 'Driving to work';
      to = work ? placeLabel(work) : placeLabel(job);
      if (R() < 0.15)
        pax.push({ name: personName(R() < 0.5), age: drv.age + ((R() * 10 - 5) | 0), note: 'carpooling' });
      break;
    case 'school':
      doing = 'School run';
      to = placeLabel(school);
      pax = kids(1 + ((R() * 2) | 0));
      break;
    case 'home':
      doing = R() < 0.7 ? 'Heading home from work' : 'Driving home';
      to = placeLabel(dHome || home);
      break;
    case 'pickup':
      doing = 'Picking the kids up from leikskóli';
      to = placeLabel(school);
      break;
    case 'delivery':
      doing = pickA([
        'Delivering parcels for Pósturinn',
        'Delivering groceries',
        'Restocking shops',
        'Delivering building supplies'
      ]);
      to = placeLabel(job || shop);
      drv.job = 'Delivery driver';
      break;
    case 'trade':
      doing = pickA([
        'On the way to a plumbing job',
        'Off to fix a roof',
        'Electrician on a call-out',
        'Carpenter heading to a site'
      ]);
      to = placeLabel(dHome || job);
      drv.job = pickA(['Plumber', 'Roofer', 'Electrician', 'Carpenter']);
      break;
    case 'errand':
      doing = pickA([
        'Going to Bónus',
        'Off to the bank',
        'Returning a parcel',
        'Getting the tyres changed',
        'Picking up a prescription',
        'Going to Krónan'
      ]);
      to = placeLabel(shop || job);
      break;
    case 'meeting':
      doing = 'On the way to a meeting';
      to = placeLabel(job);
      break;
    case 'doctor':
      doing = "Going to a doctor's appointment";
      to = placeLabel(
        nearBld(ex, ey, 1500, b =>
          /hospital|clinic|doctors|heilsug/i.test((b.use || '') + ' ' + (b.name || ''))
        ) || job
      );
      break;
    case 'lunch':
      doing = 'Out for lunch';
      to = placeLabel(nearBld(ex, ey, 800, b => /restaurant|cafe|fast_food/i.test(b.use || '')) || job);
      break;
    case 'gym':
      doing = 'Going to the gym';
      to = placeLabel(gym || pool);
      break;
    case 'visit':
      doing = pickA([
        'Visiting grandma',
        'Going to see friends',
        'Visiting family',
        'Dropping off a birthday present'
      ]);
      to = placeLabel(dHome);
      if (R() < 0.5)
        pax.push({ name: personName(!drv.f), age: drv.age + ((R() * 8 - 4) | 0), note: 'partner' });
      break;
    case 'out':
      doing = pickA([
        'Off to the cinema',
        'Going out for dinner',
        'To a concert at Harpa',
        'To a football match'
      ]);
      to = placeLabel(job);
      pax.push({ name: personName(!drv.f), age: drv.age + ((R() * 8 - 4) | 0), note: 'partner' });
      break;
    case 'shift':
      doing = 'Driving to a night shift';
      to = placeLabel(
        nearBld(ex, ey, 2500, b => /hospital/i.test((b.use || '') + ' ' + (b.name || ''))) || job
      );
      drv.job = pickA(['Nurse', 'Security guard', 'Baker', 'Airport worker']);
      break;
    case 'taxi': {
      doing = pickA([
        'Taking a fare home',
        'Airport run to Keflavík',
        'Picking up a customer',
        'Driving tourists to their hotel'
      ]);
      to = placeLabel(dHome || job);
      drv.job = 'Leigubílstjóri · taxi driver';
      const n = 1 + ((R() * 3) | 0);
      for (let i = 0; i < n; i++)
        pax.push({
          name: R() < 0.4 ? pickA(TOUR)[0] : personName(R() < 0.5),
          age: 20 + ((R() * 50) | 0),
          note: 'passenger'
        });
      break;
    }
    case 'shop':
      doing = pickA([
        'Weekend shopping at Kringlan',
        'Off to Smáralind',
        'IKEA trip',
        'Getting groceries for the week'
      ]);
      to = placeLabel(shop);
      pax.push({ name: personName(!drv.f), age: drv.age + ((R() * 8 - 4) | 0), note: 'partner' });
      if (R() < 0.5) pax.push(...kids(1 + ((R() * 2) | 0)));
      break;
    case 'family':
      doing = pickA([
        'Sunday drive',
        'Taking the family to Þingvellir',
        'Going to see the volcano',
        'Family day out'
      ]);
      to = placeLabel(dHome || job);
      pax.push(
        { name: personName(!drv.f), age: drv.age + ((R() * 8 - 4) | 0), note: 'partner' },
        ...kids(1 + ((R() * 3) | 0))
      );
      break;
    case 'pool':
      doing = 'Going to the swimming pool';
      to = placeLabel(pool);
      pax = kids(1 + ((R() * 2) | 0));
      break;
    case 'sport':
      doing = pickA(['Taking the kids to football practice', 'Handball tournament', 'Off to a golf round']);
      to = placeLabel(gym);
      pax = kids(1 + ((R() * 2) | 0));
      break;
    case 'cabin':
      doing = 'Heading to the summer house for the weekend';
      to = 'Out of town';
      pax.push({ name: personName(!drv.f), age: drv.age + ((R() * 8 - 4) | 0), note: 'partner' });
      if (R() < 0.6) pax.push(...kids(1 + ((R() * 2) | 0)));
      break;
    default:
      doing = 'Driving';
      to = placeLabel(job);
  }
  if (c.vt === 'police') {
    doing = c.siren ? 'Responding to a call' : 'On patrol';
    drv.job = 'Lögregluþjónn · police officer';
    pax = [{ name: personName(R() < 0.5), age: 25 + ((R() * 25) | 0), note: 'partner' }];
    to = c.siren ? 'Emergency' : '—';
  }
  if (c.kind === 'bus') {
    const f = trafficFactor();
    drv.job = 'Strætó driver';
    const rn = c.route ? c.route.name.replace(/^Strætó( bs\.?)?\s*\w*\s*/, '') : '';
    doing = c.route ? 'Leið ' + c.route.ref + (rn ? ' · ' + rn : '') : 'Running the route';
    to = c.route
      ? c.route.to || rn.split(/\s*[-–]\s*/).pop() || 'End of the line'
      : placeLabel(job) || 'End of the line';
    pax = [];
    if (c.nPax === undefined) c.nPax = Math.round(3 + f * 40 * R());
  }
  if (c.vt === 'amb') {
    doing = c.siren ? 'Rushing to Landspítali' : 'Returning to station';
    drv.job = 'Sjúkraflutningamaður · paramedic';
  }
  return (c.story = { drv, pax, doing, to, from: placeLabel(home) });
}
function carCard(a) {
  const st = fillCarStory(a),
    vn = a.vname
      ? a.vname.split(' · ')
      : [a.kind === 'bus' ? 'Strætó' : 'Bíll', a.kind === 'bus' ? 'City bus' : 'Car'];
  const px =
    a.kind === 'bus' || a.coach
      ? (a.nPax || 0) + ' passengers'
      : st.pax.length
        ? st.pax
            .map(p => p.name.split(' ')[0] + ' (' + p.age + (p.note ? ', ' + p.note : '') + ')')
            .join(', ')
        : 'Alone';
  return {
    h:
      '<h3>' +
      vn[0] +
      '</h3><div class="sub">' +
      vn[1] +
      '</div><div class="act">' +
      st.doing +
      (st.to && st.to !== '—' ? ' → ' + st.to : '') +
      '</div>' +
      '<div class="row"><span>Driver</span><span>' +
      st.drv.name +
      ' · ' +
      st.drv.age +
      '</span></div><div class="row"><span>Job</span><span>' +
      st.drv.job +
      '</span></div>' +
      '<div class="row"><span>Passengers</span><span>' +
      px +
      '</span></div>' +
      (a.route
        ? (() => {
            const ns = busNextStop(a);
            return (
              (ns && ns.name
                ? '<div class="row"><span>Next stop</span><span>' + ns.name + '</span></div>'
                : '') +
              '<div class="row"><span>Left the terminus</span><span>' +
              String(Math.floor(a.dep / 60) % 24).padStart(2, '0') +
              ':' +
              String(a.dep % 60).padStart(2, '0') +
              '</span></div>'
            );
          })()
        : '') +
      (st.from && st.from !== '—'
        ? '<div class="row"><span>Set off from</span><span>' + st.from + '</span></div>'
        : '') +
      '<div class="row"><span>Speed</span><span>' +
      Math.round((a.wait > 0 ? 0 : a.sp) * 3.6) +
      ' km/h</span></div><div class="row"><span>Area</span><span>' +
      district(a.x, a.y) +
      '</span></div>' +
      (a.kind !== 'truck' ? '<button class="btn" id="doplay">Drive</button>' : ''),
    m: vn[0] + ' · ' + st.doing
  };
}

function spawnCar(vr) {
  const x = vr[0] + R() * (vr[2] - vr[0]),
    y = vr[1] + R() * (vr[3] - vr[1]);
  const s = nearestNode(x, y, GD, 200);
  if (s < 0 || (PBLK && PBLK[s])) return false;
  const bus = false;
  const ang = R() * 6.28,
    dd = bus ? 1500 : 400 + R() * 1400;
  const t = nearestNode(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd, GD, 400);
  if (t < 0) return false;
  const path = astar(GD, s, t, bus ? 30000 : 16000);
  if (!path || path.length < 2) return false;
  if (bus) {
    let ok = 0;
    for (let i = 0; i + 1 < path.length; i += 3) if (edgeClass(GD, path[i], path[i + 1]) <= 4) ok++;
    if (ok < path.length / 6) return false;
  }
  if (onScr(NX[s], NY[s], 40)) return false;
  const a = mkAgent(bus ? 'bus' : 'car', NX[s], NY[s]);
  if (!bus) setVT(a, pickVT(x, y));
  a.path = path;
  a.pi = 0;
  a.act = bus ? 'Strætó route' : '';
  setPos(a);
  agents.push(a);
  return true;
}
function setPos(a) {
  const n = a.path[a.pi];
  a.x = NX[n];
  a.y = NY[n];
}
/* which lane: multi-lane roads (OSM lanes=*) spread cars over every lane in their direction; buses keep to the kerb lane */
function carOff(a) {
  const wy = a.wi >= 0 ? WAYS[a.wi] : null;
  if (!wy) return offFor(a.cl || 5, 1, 1);
  const w = RWW(wy),
    ow = wy.ow;
  let tot = wy.ln || (ow ? (wy.cl <= 2 ? 2 : 1) : wy.cl === 1 ? 4 : 2);
  if (!ow && tot < 2) tot = 2;
  const nd = ow ? tot : Math.max(1, Math.floor(tot / 2)),
    lw = w / tot;
  let l = a.kind === 'bus' || a.vt === 'lorry' || a.vt === 'tractor' ? nd - 1 : (a.lane | 0) % nd;
  return ow ? -w / 2 + (l + 0.5) * lw : (tot % 2 ? lw / 2 : 0) + (l + 0.5) * lw;
}
function pedOff(a) {
  const wy = a.wi >= 0 ? WAYS[a.wi] : null;
  if (wy && wy.ln && wy.cl <= 6) return a.side * (RWW(wy) / 2 + 2);
  return offFor(a.cl || 5, 0, a.side);
}
function offFor(cl, car, side) {
  if (car) return cl <= 2 ? 3.2 : 1.9;
  return side * (cl <= 2 ? 9.5 : cl <= 4 ? 6.5 : cl <= 6 ? 4.2 : 0.7);
}
function say(a, list, t) {
  if (a.car) return;
  a.bubble = pickA(list);
  a.bt = t || 2.6;
}
const CARG = new Map();
function stepAgents(dt) {
  CARG.clear();
  for (const a of agents) {
    if (a.dead || !a.car) continue;
    const k = Math.floor(a.x / 12) * 100003 + Math.floor(a.y / 12);
    let l = CARG.get(k);
    if (!l) CARG.set(k, (l = []));
    l.push(a);
  }
  for (const a of agents) {
    if (a.dead) continue;
    if (a.car && a.path && !a.ctrl && !a.siren && !(a.wait > 0)) {
      // keep a gap to the car in front (queues at lights and junctions)
      const hx = a.vx,
        hy = a.vy,
        hl = Math.hypot(hx, hy) || 1,
        ux = hx / hl,
        uy = hy / hl,
        gx = Math.floor(a.x / 12),
        gy = Math.floor(a.y / 12);
      let blk = false;
      for (let dj = -1; dj <= 1 && !blk; dj++)
        for (let di = -1; di <= 1 && !blk; di++) {
          const l = CARG.get((gx + di) * 100003 + gy + dj);
          if (!l) continue;
          for (const o of l) {
            if (o === a) continue;
            const dx = o.x - a.x,
              dy = o.y - a.y,
              al = dx * ux + dy * uy;
            if (al <= 0 || al > a.len * 0.5 + o.len * 0.5 + 2.5) continue;
            if (Math.abs(-dx * uy + dy * ux) > 1.6) continue;
            if (Math.abs((o.dz || 0) - (a.dz || 0)) > 2) continue;
            const ol = Math.hypot(o.vx, o.vy) || 1;
            if ((o.vx * ux + o.vy * uy) / ol < 0.3) continue;
            blk = true;
            break;
          }
        }
      if (blk) {
        a.wait = 0.25;
        if (!a.act || /lights|way/.test(a.act)) a.act = 'In traffic';
      }
    }
    if (a.bt > 0) {
      a.bt -= dt;
      if (a.bt <= 0) a.bubble = null;
    }
    if (a.inside) {
      if (a !== follow && a !== selected) {
        a.dead = true;
        continue;
      }
      if (gameMin >= a.insideUntil) emerge(a);
      continue;
    }
    if (a.ctrl || a.hidden) continue;
    if (a.cop || (a.officer && CTRL)) continue;
    if (a.down > 0) {
      a.down -= dt;
      if (a.kvx) {
        a.x += a.kvx * dt;
        a.y += a.kvy * dt;
        a.kvx *= 1 - Math.min(1, dt * 4);
        a.kvy *= 1 - Math.min(1, dt * 4);
      }
      if (a.down <= 0) {
        a.kvx = a.kvy = 0;
        a.state = 'walk';
        a.act = 'Shaken';
        flee(a, { x: a.x + R() - 0.5, y: a.y + R() - 0.5, r: 30, kind: 'crime' });
      }
      continue;
    }
    if (a.knock > 0) {
      a.knock -= dt;
      const nx = a.x + a.kvx * dt,
        ny = a.y + a.kvy * dt;
      if (!blockedAt(nx, ny)) {
        a.x = nx;
        a.y = ny;
      }
      a.kvx *= 1 - Math.min(1, dt * 2.5);
      a.kvy *= 1 - Math.min(1, dt * 2.5);
      continue;
    }
    if (a.wreck) {
      a.wrT = (a.wrT || 60) - dt;
      if ((a.burnt || a.dmg > 80) && R() < dt * 2.5) smoke(a.x, a.y, hAt(a.x, a.y) + 1.2, true, 1, 2.4);
      if (a.wrT <= 0 && a !== follow) a.dead = true;
      continue;
    }
    if (a.zone) {
      stepZoneAgent(a, dt);
      continue;
    }
    if (a.state === 'idle') {
      a.idle -= dt;
      if (a.photo && R() < dt * 0.6) a.flash = 0.12;
      if (a.flash > 0) a.flash -= dt;
      if (a.idle <= 0) {
        a.state = 'walk';
        if (a.after) {
          const f = a.after;
          a.after = null;
          f();
        }
      }
      continue;
    }
    if (a.state === 'spray') {
      a.idle -= dt;
      const b = a.target;
      if (b && b.fire > 0) {
        b.fire = Math.max(0, b.fire - dt * 0.05);
        for (let q = 0; q < 2; q++) {
          const z = hAt(a.x, a.y) + 1.5,
            tz = b.z + b.h * 0.7;
          const dx = b.cx - a.x,
            dy = b.cy - a.y,
            d = Math.hypot(dx, dy) || 1;
          addP({
            t: 6,
            x: a.x,
            y: a.y,
            z,
            vx: (dx / d) * 14 + (R() - 0.5) * 2,
            vy: (dy / d) * 14 + (R() - 0.5) * 2,
            vz: (tz - z) / Math.max(0.6, d / 14) + 5,
            life: Math.min(1.6, d / 14),
            max: 1.6,
            c: [150, 200, 240],
            s: 1.2
          });
        }
        if (b.fire < 0.05) {
          b.fire = 0;
          burning.delete(b);
          dirtyB(b);
        }
      } else {
        a.state = 'walk';
        a.target = null;
        a.path = null;
      }
      if (a.idle <= 0) a.state = 'walk';
      continue;
    }
    if (a.leader) {
      const L = a.leader;
      if (L.dead) a.leader = null;
      else {
        const tx = L.x + (a.offx || 0),
          ty = L.y + (a.offy || 0),
          dx = tx - a.x,
          dy = ty - a.y,
          d = Math.hypot(dx, dy);
        if (L.state === 'idle') {
          a.state = 'idle';
          a.idle = Math.max(0.3, L.idle);
          a.face = L.face;
        }
        if (d > 0.05) {
          const sp = Math.min(d, a.sp * 1.6 * dt * (d > 4 ? 1.6 : 1));
          a.x += (dx / d) * sp;
          a.y += (dy / d) * sp;
          a.vx = dx / d;
          a.vy = dy / d;
          a.phase += dt * a.sp * 6;
        }
        if (L.entering) a.entering = L.entering;
        if (a.entering) {
          a.entering -= dt;
          if (a.entering <= 0) a.dead = true;
        }
        continue;
      }
    }
    if (a.entering) {
      a.entering -= dt;
      if (a.entering <= 0) {
        if (a === follow && a.persona && !a.event && !a.car && goInside(a)) continue;
        a.dead = true;
        if (a === follow) {
          toast(a.name + ' went inside ' + ((a.dest && (a.dest.addr || a.dest.name)) || ''));
          follow = null;
        }
      }
      continue;
    }
    if (a.wp) {
      stepWp(a, dt);
      continue;
    }
    if (!a.path) {
      a.dead = !a.keep;
      continue;
    }
    if (a.car && a.path && a.pi < a.path.length - 1 && !a.siren && !a.parade && !(a.wait > 0)) {
      const q0 = a.path[a.pi],
        q1 = a.path[a.pi + 1],
        L = Math.hypot(NX[q1] - NX[q0], NY[q1] - NY[q0]) || 1,
        left = (1 - a.t) * L;
      const sg = SIGN.size ? SIGN.get(q1) : null;
      if (sg && left < 11 && left > 2 && sigPhase(sg, (NX[q1] - NX[q0]) / L, (NY[q1] - NY[q0]) / L) !== 'g') {
        a.wait = 0.3;
        a.act = 'Waiting at the lights';
      } else if (NRB && NRB[q1] && !NRB[q0] && left < 9) {
        for (const o of agents) {
          if (o === a || o.dead || !o.car || !o.path || o.wait > 0) continue;
          const r0 = o.path[o.pi],
            r1 = o.path[Math.min(o.path.length - 1, o.pi + 1)];
          if (!NRB[r0] || !NRB[r1]) continue;
          if (Math.hypot(o.x - NX[q1], o.y - NY[q1]) < 14) {
            a.wait = 0.35;
            a.act = 'Giving way at the roundabout';
            break;
          }
        }
      }
    }
    let rem =
      a.sp *
      (a.car && !a.siren ? (a.msf || 1) * (a.fordT > 0 ? 0.3 : 1) : 1) *
      (a.flee ? 2.4 : 1) *
      (rainT > 0 && !a.car ? 1.15 : 1) *
      dt *
      (a.car ? (a.siren || a.plough ? 1 : wxDrive()) : 2.2);
    if (a.car && a.wait > 0) {
      a.wait -= dt;
      continue;
    }
    while (rem > 0 && a.pi < a.path.length - 1) {
      const p0 = a.path[a.pi],
        p1 = a.path[a.pi + 1];
      const ex = NX[p1] - NX[p0],
        ey = NY[p1] - NY[p0],
        L = Math.hypot(ex, ey) || 0.01;
      if (a.clAt !== a.pi) {
        const G_ = a.car ? GD : GW;
        a.cl = edgeClass(G_, p0, p1);
        a.wi = edgeWay(G_, p0, p1);
        a.clAt = a.pi;
        const wy = WAYS[a.wi];
        a.msf = a.car && wy && wy.ms ? Math.max(0.45, Math.min(2, wy.ms / 3.6 / 14)) : 1;
        if (a.car && wy && wy.sf === 2 && !wy.ms) a.msf = 0.75;
      }
      const step = Math.min(rem, L * (1 - a.t));
      a.t += step / L;
      rem -= step;
      if (a.t >= 0.999) {
        a.t = 0;
        a.pi++;
        if (a.car && NFORD && NFORD[a.path[a.pi]]) a.fordT = 1.6;
        if (blockedNode(a.path[Math.min(a.path.length - 1, a.pi + 1)])) {
          repath(a);
          break;
        }
        if (a.car && !a.parade && PBLK && PBLK[a.path[Math.min(a.path.length - 1, a.pi + 1)]]) {
          carDetour(a);
          break;
        }
        if (a.car && !a.parade && NDEG[a.path[a.pi]] >= 3 && R() < 0.25 && a.kind !== 'truck') {
          a.wait = 0.6 + R() * 1.4;
          break;
        }
        if (a.route && a.route.stopAt && a.route.stopAt.has(a.pi + (a.poff || 0))) {
          busAtStop(a);
          break;
        }
        if (a.kind === 'bus' && !a.route && a.pi % 14 === 0) {
          a.wait = 3;
          if (R() < 0.6) {
            const p = mkAgent('walk', a.x, a.y);
            const t = nearestNode(a.x + (R() - 0.5) * 400, a.y + (R() - 0.5) * 400, GW, 200),
              s = nearestNode(a.x, a.y, GW, 60);
            const pth = astar(GW, s, t, 4000);
            if (pth && pth.length > 1) {
              p.path = pth;
              p.act = 'Got off the bus';
              p.job = pickA(JOBS[4]);
              p.homeAddr = district(a.x, a.y);
              setPos(p);
              agents.push(p);
            }
          }
          break;
        }
        if (!a.car && !a.flee && !a.parade && a.pi < a.path.length - 1) {
          const ce = edgeClass(GW, a.path[a.pi], a.path[a.pi + 1]);
          if (ce <= 4 && a.cl > 6 && R() < 0.5) {
            a.state = 'idle';
            a.idle = 0.8 + R() * 1.6;
            break;
          }
        }
      }
    }
    if (!a.path) continue;
    const p0 = a.path[Math.min(a.pi, a.path.length - 1)],
      p1 = a.path[Math.min(a.pi + 1, a.path.length - 1)];
    const ex = NX[p1] - NX[p0],
      ey = NY[p1] - NY[p0],
      L = Math.hypot(ex, ey) || 1;
    const off =
      (a.parade && !a.car ? a.wob : a.car ? carOff(a) : pedOff(a)) +
      (a.wobble ? Math.sin(time * 2 + a.id) * 0.8 : 0);
    const nx = NX[p0] + ex * a.t - (ey / L) * off,
      ny = NY[p0] + ey * a.t + (ex / L) * off;
    const mx = nx - a.x,
      my = ny - a.y,
      md = Math.hypot(mx, my);
    if (md > 0.001) {
      a.vx = mx / md;
      a.vy = my / md;
    }
    if (md > 8) {
      a.x = nx;
      a.y = ny;
    } else {
      const f = Math.min(1, dt * 6);
      a.x += mx * f;
      a.y += my * f;
    }
    if (NDZ) {
      a.dz = NDZ[p0] + (NDZ[p1] - NDZ[p0]) * a.t;
      a.intun = NTUN[p0] && NTUN[p1] ? 1 : (NTUN[p0] && a.t < 0.5) || (NTUN[p1] && a.t > 0.5) ? 1 : 0;
    }
    a.phase += dt * a.sp * (a.car ? 0 : 5) * (a.flee ? 2 : 1);
    if (a.car) carSurface(a, dt);
    if (a.pi >= a.path.length - 1) arrive(a);
  }
}
/* streets closed for a parade: drivers turn off and find a way round; if there is none they wait (or quietly vanish off-screen) */
let PBLK = null;
function closeRoute(route, on) {
  if (!PBLK) PBLK = new Uint8Array(NODE_N);
  for (const n of route) PBLK[n] = on ? 1 : 0;
  if (on)
    for (const a of agents) {
      if (a.dead || !a.car || a.parade || !a.path) continue;
      const n0 = a.path[a.pi],
        n1 = a.path[Math.min(a.path.length - 1, a.pi + 1)];
      if ((PBLK[n0] || PBLK[n1]) && !onScr(a.x, a.y, 40)) a.dead = true;
    }
}
function carDetour(a) {
  const P = a.path;
  let j = a.pi + 1;
  while (j < P.length && PBLK[P[j]]) j++;
  if (j >= P.length - 1) {
    if (onScr(a.x, a.y, 40)) {
      a.wait = 2;
    } else a.dead = true;
    return;
  }
  const d = astar(GD, P[a.pi], P[j], 12000);
  if (!d || d.length < 2) {
    if (onScr(a.x, a.y, 40)) a.wait = 2;
    else a.dead = true;
    return;
  }
  a.poff = (a.poff || 0) + (j - d.length + 1);
  a.path = d.concat(P.slice(j + 1));
  a.pi = 0;
  a.t = 0;
  if (a.route) a.act = 'Diverted round the parade';
}
function repath(a) {
  const s = a.path[a.pi];
  let t = a.path[a.path.length - 1];
  if (blockedNode(t)) t = nearestNode(a.x + (R() - 0.5) * 600, a.y + (R() - 0.5) * 600, a.car ? GD : GW, 300);
  const p = astar(a.car ? GD : GW, s, t, 8000);
  if (p && p.length > 1) {
    a.path = p;
    a.pi = 0;
    a.t = 0;
  } else {
    a.path = null;
    if (!a.car) {
      a.state = 'idle';
      a.idle = 3;
      a.flee = true;
    } else a.dead = true;
  }
}
function arrive(a) {
  if (a.toStall) {
    lotCarIn(a);
    return;
  }
  if (a.ferryIn) {
    a.dead = true;
    return;
  }
  if (a.coachR) {
    const R0 = a.coachR,
      i = a.coachI + a.path.length - 1;
    if (i < R0.length - 2) {
      a.path = Array.from(R0.slice(i, i + 800));
      a.coachI = i;
      a.pi = 0;
      a.t = 0;
      return;
    }
    a.dead = true;
    return;
  }
  if (a.kind === 'truck') {
    const b = a.target;
    if (b && b.fire > 0) {
      a.path = null;
      a.keep = 1;
      a.state = 'parked';
      a.wait = 1e9;
      for (let i = 0; i < 3; i++) {
        const f = mkAgent('fire', a.x, a.y);
        const d = Math.hypot(b.cx - a.x, b.cy - a.y),
          q = Math.min(1, (b.r + 10) / Math.max(1, d));
        f.target = b;
        f.state = 'spray';
        f.idle = 40;
        f.act = 'Fighting the fire at ' + (b.addr || b.name || 'a building');
        f.homeAddr = 'Slökkvistöðin';
        f.keep = 1;
        f.truck = a;
        f.x = b.cx + (a.x - b.cx) * q + (R() - 0.5) * 8;
        f.y = b.cy + (a.y - b.cy) * q + (R() - 0.5) * 8;
        f.vx = b.cx - f.x;
        f.vy = b.cy - f.y;
        agents.push(f);
      }
      a.crewT = 40;
      a.siren = 1;
    } else {
      trucksBusy.delete(b);
      const nb2 = nextFire(a.x, a.y, a);
      if (nb2) {
        a.target = nb2;
        trucksBusy.add(nb2);
        const s = a.path && a.path.length ? a.path[a.path.length - 1] : nearestNode(a.x, a.y, GD, 100),
          t = nearestNode(nb2.cx, nb2.cy, GD, 250),
          p = s >= 0 && t >= 0 ? astar(GD, s, t, 8000) : null;
        if (p && p.length > 1) {
          a.path = p;
          a.pi = 0;
          a.t = 0;
          return;
        }
      }
      a.dead = true;
    }
    return;
  }
  if (a.car) {
    if (!a.keep && onScr(a.x, a.y, 30) && (a.ext || 0) < 4) {
      const s = a.path[a.path.length - 1],
        dx = a.vx,
        dy = a.vy;
      const t = nearestNode(a.x + dx * 900 + (R() - 0.5) * 600, a.y + dy * 900 + (R() - 0.5) * 600, GD, 400);
      const p = t >= 0 ? astar(GD, s, t, 12000) : null;
      if (p && p.length > 1) {
        a.path = p;
        a.pi = 0;
        a.t = 0;
        a.ext = (a.ext || 0) + 1;
        return;
      }
    }
    a.dead = true;
    return;
  }
  if (a.flee) {
    a.flee = false;
    a.state = 'idle';
    a.idle = 4 + R() * 4;
    a.after = () => {
      a.entering = 1;
    };
    say(a, ['Úff…', 'Þetta var tæpt', 'Við erum örugg'], 2.5);
    a.path = null;
    return;
  }
  if (a.toArea && joinZone(a, a.toArea)) return;
  if (a.loop || a.kind === 'jogger' || a.kind === 'dog' || a.act === 'Taking a stroll') {
    a.loops = (a.loops || 0) + 1;
    if (a.loops < 3) {
      const n = nearestNode(a.x + (R() - 0.5) * 700, a.y + (R() - 0.5) * 700, GW, 250);
      const p = astar(GW, a.path[a.path.length - 1], n, 8000);
      if (p && p.length > 1) {
        a.path = p;
        a.pi = 0;
        a.t = 0;
        return;
      }
    }
    const hn = bEntry(a.home, GW);
    const p = astar(GW, a.path[a.path.length - 1], hn, 9000);
    if (p && p.length > 1 && a.loops < 9) {
      a.path = p;
      a.pi = 0;
      a.t = 0;
      a.act = 'Heading home';
      a.dest = a.home;
      a.loops = 9;
      return;
    }
  }
  if (a.photo && !a.shot) {
    a.shot = 1;
    a.state = 'idle';
    a.idle = 8 + R() * 10;
    say(a, PH.tour, 3);
    a.face = 1;
    a.after = () => {
      a.entering = 0.6;
    };
    return;
  }
  a.entering = 0.6;
}
const AGRID = new Map();
let behN = 0;
function behave() {
  AGRID.clear();
  for (const a of agents) {
    if (a.dead || a.car) continue;
    const k = Math.floor(a.x / 6) * 1000003 + Math.floor(a.y / 6);
    let l = AGRID.get(k);
    if (!l) AGRID.set(k, (l = []));
    l.push(a);
  }
  for (let i = hazards.length - 1; i >= 0; i--) {
    hazards[i].t -= 0.25;
    if (hazards[i].t <= 0) hazards.splice(i, 1);
  }
  for (const b of burning) if (R() < 0.2) hazards.push({ x: b.cx, y: b.cy, r: 70 + b.r, t: 1, kind: 'fire' });
  for (const a of agents) {
    if (a.dead || a.car || a.kind === 'fire' || a.kind === 'worker') continue;
    if (a.state === 'walk' || a.state === 'idle') {
      for (const hz of hazards) {
        const d = Math.hypot(a.x - hz.x, a.y - hz.y);
        if (d > hz.r) continue;
        if (hz.kind === 'fire' && d > 35 && !a.flee && !a.watch && R() < 0.35 && a.kind !== 'kid') {
          a.watch = 1;
          a.leader = null;
          a.state = 'idle';
          a.idle = 10 + R() * 15;
          a.photo = R() < 0.6;
          a.face = Math.sign(PXw(hz.x, hz.y) - PXw(a.x, a.y)) || 1;
          say(a, PH.watch, 3);
          a.act = 'Watching the fire';
          a.after = () => {
            a.watch = 0;
            a.photo = false;
          };
          break;
        }
        if (!a.flee && (d < hz.r * 0.7 || hz.kind !== 'fire')) {
          flee(a, hz);
          break;
        }
      }
    }
    if (a.state === 'walk' && !a.flee && !a.leader && !a.bubble && R() < 0.05) {
      const k = Math.floor(a.x / 6) * 1000003 + Math.floor(a.y / 6);
      const l = AGRID.get(k);
      if (l)
        for (const o of l) {
          if (
            o === a ||
            o.state !== 'walk' ||
            o.leader ||
            o.flee ||
            o.kind === 'jogger' ||
            a.kind === 'jogger'
          )
            continue;
          if (Math.hypot(o.x - a.x, o.y - a.y) < 3.2) {
            const t = 3 + R() * 5;
            a.state = o.state = 'idle';
            a.idle = o.idle = t;
            const s = Math.sign(PXw(o.x, o.y) - PXw(a.x, a.y)) || 1;
            a.face = s;
            o.face = -s;
            const list = night
              ? PH.night.concat(PH.hi)
              : rainT > 0
                ? PH.rain.concat(PH.hi)
                : a.kind === 'kid'
                  ? PH.kid
                  : a.kind === 'tourist'
                    ? PH.tour
                    : PH.hi;
            say(a, list, 2.4);
            setTimeout(() => say(o, list, 2.4), 900);
            a.chat = o;
            o.chat = a;
            break;
          }
        }
    }
    if (a.kind === 'jogger' && R() < 0.02) say(a, PH.jog, 1.2);
    if (a.kind === 'kid' && R() < 0.01) say(a, PH.kid, 1.5);
    if (a.kind === 'party' && R() < 0.02) say(a, PH.night, 2);
    if (a.flee && R() < 0.06) say(a, PANIC[a.fleeKind] || PH.panic, 1.6);
  }
  for (const a of agents) {
    if (a.kind !== 'truck' || a.dead || a.state !== 'parked') continue;
    const b = a.target;
    a.crewT -= 0.25;
    if (a.crewT <= 0 && b && b.fire > 0 && b.state !== 2) {
      // still burning: the crew stays on it rather than driving off
      a.crewT = 40;
      for (const f of agents) if (f.truck === a && !f.dead) f.idle = 40;
      continue;
    }
    if (!b || b.fire <= 0 || b.state === 2) {
      // this building is out (or down): the crew moves on to the next one burning nearby, if there is one
      const nb2 = nextFire(a.x, a.y, a);
      if (nb2) {
        trucksBusy.delete(b);
        trucksBusy.add(nb2);
        a.target = nb2;
        a.crewT = 40;
        const d = Math.hypot(nb2.cx - a.x, nb2.cy - a.y),
          q = Math.min(1, (nb2.r + 10) / Math.max(1, d));
        for (const f of agents)
          if (f.truck === a && !f.dead) {
            f.target = nb2;
            f.state = 'spray';
            f.idle = 40;
            f.act = 'Fighting the fire at ' + (nb2.addr || nb2.name || 'a building');
            f.x = nb2.cx + (a.x - nb2.cx) * q + (R() - 0.5) * 8;
            f.y = nb2.cy + (a.y - nb2.cy) * q + (R() - 0.5) * 8;
            f.vx = nb2.cx - f.x;
            f.vy = nb2.cy - f.y;
          }
        continue;
      }
    }
    if (!b || b.fire <= 0 || a.crewT <= 0 || b.state === 2) {
      for (const f of agents) if (f.truck === a) f.dead = true;
      trucksBusy.delete(b);
      a.state = 'walk';
      a.keep = 0;
      a.siren = 0;
      const s = nearestNode(a.x, a.y, GD, 100),
        t = nearestNode(a.x + (R() - 0.5) * 1500, a.y + (R() - 0.5) * 1500, GD, 300);
      const p = astar(GD, s, t, 20000);
      if (p && p.length > 1) {
        a.path = p;
        a.pi = 0;
        a.t = 0;
        a.wait = 0;
      } else a.dead = true;
    }
  }
  for (const b of building) {
    if (K < 0.85) break;
    if (!b.crew) {
      b.crew = 1;
      for (let i = 0; i < Math.min(4, 1 + b.area / 120); i++) {
        const w = mkAgent('worker', b.cx + (R() - 0.5) * b.r * 2.4, b.cy + (R() - 0.5) * b.r * 2.4);
        w.state = 'idle';
        w.idle = 9999;
        w.keep = 1;
        w.site = b;
        w.act = 'Rebuilding ' + (b.addr || 'a house');
        w.homeAddr = district(b.cx, b.cy);
        agents.push(w);
      }
    }
  }
  for (const a of agents) if (a.kind === 'worker' && a.site && a.site.state !== 3) a.dead = true;
  behaveAnimals();
  routineCheck();
  if (++behN % 10 === 0) agents = agents.filter(a => !a.dead || a === follow);
}
const PANIC = {
  fire: ['Eldur!', 'Það er kviknað í!', 'Hringið í slökkviliðið!', 'Reykurinn!', '112!', 'Allir út!'],
  boom: ['Hvað var þetta?!', 'Sprenging!', 'Leggist niður!', 'Ég heyri ekkert!', 'Guð minn góður!'],
  volcano: [
    'Eldgos!',
    'Hraunið kemur!',
    'Ekki aftur!',
    'Öskufall!',
    'Forðið ykkur, það gýs!',
    'Þetta er eins og í Eyjum ´73!'
  ],
  quake: ['Jarðskjálfti!', 'Farið undir borð!', 'Allt hristist!', 'Burt frá húsunum!', 'Þessi var stór!'],
  flood: ['Sjórinn kemur!', 'Flóð!', 'Upp á hæðina!', 'Bjargið bílunum!', 'Allt á floti!'],
  troll: ['Tröll!', 'Grýla er komin!', 'Hlaupið, það er tröll!', 'Bíðið eftir sólinni!', 'Það sest á okkur!'],
  tornado: ['Skýstrókur!', 'Haldið ykkur!', 'Hann tekur allt!', 'Inn í kjallara!', 'Vindurinn!'],
  snow: ['Snjóflóð!', 'Grafið ykkur út!', 'Ég sé ekkert!', 'Snjórinn kemur!'],
  evac: ['Rýming!', 'Allir út!', 'Hvert eigum við að fara?', 'Taktu kisuna!', 'Ekki hlaupa, labbið!'],
  ufo: ['Geimverur!', 'Sástu þetta?!', 'Þetta er ekki flugvél!', 'Þeir tóku húsið!', 'Ég trúi þessu ekki!']
};
function flee(a, hz) {
  a.fleeKind = hz.kind;
  const dx = a.x - hz.x,
    dy = a.y - hz.y,
    d = Math.hypot(dx, dy) || 1;
  const tx = hz.x + (dx / d) * (hz.r + 250),
    ty = hz.y + (dy / d) * (hz.r + 250);
  const s = nearestNode(a.x, a.y, GW, 80),
    t = nearestNode(tx, ty, GW, 300);
  const p = astar(GW, s, t, 6000);
  a.leader = null;
  a.state = 'walk';
  a.flee = true;
  a.chat = null;
  say(a, PANIC[hz.kind] || PH.panic, 2);
  a.act =
    {
      fire: 'Running from the fire',
      boom: 'Running from the blast',
      volcano: 'Fleeing the eruption',
      quake: 'Getting away from buildings',
      flood: 'Heading for higher ground',
      troll: 'Running from a troll',
      tornado: 'Escaping the tornado',
      snow: 'Escaping the avalanche',
      evac: 'Evacuating',
      ufo: 'Running from the UFO'
    }[hz.kind] || 'Running for safety!';
  if (p && p.length > 1) {
    a.path = p;
    a.pi = 0;
    a.t = 0;
  }
}
