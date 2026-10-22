/**
 * People
 *
 * Names, clothes and jobs, creating agents (mkAgent) and spawning people near the view.
 *
 * Functions: mkAgent, district, placeName, randB, bEntry, actFactor, wxStay, wxDrive, dayOfWeek, spawnTick
 * State and constants: MALE, FEMALE, FATHER, TOUR, PH, SHIRT, PANTS, HAIR, HATS, SKINS, CARC, JOBS, AGID,
 *     DAYS, region, regionPop, regionT
 */

const MALE = [
  'Jón',
  'Sigurður',
  'Guðmundur',
  'Gunnar',
  'Ólafur',
  'Einar',
  'Kristján',
  'Magnús',
  'Stefán',
  'Jóhann',
  'Björn',
  'Árni',
  'Helgi',
  'Páll',
  'Þór',
  'Bjarki',
  'Aron',
  'Alexander',
  'Viktor',
  'Kári',
  'Egill',
  'Haraldur',
  'Ragnar',
  'Davíð',
  'Atli',
  'Óskar',
  'Hannes',
  'Baldur',
  'Ari',
  'Snorri'
];
const FEMALE = [
  'Guðrún',
  'Anna',
  'Sigríður',
  'Kristín',
  'Margrét',
  'Helga',
  'Sigrún',
  'Ingibjörg',
  'María',
  'Jóhanna',
  'Katrín',
  'Elín',
  'Hildur',
  'Birna',
  'Lilja',
  'Sara',
  'Embla',
  'Freyja',
  'Ásdís',
  'Þórunn',
  'Hrafnhildur',
  'Saga',
  'Eva',
  'Edda',
  'Sólveig',
  'Bryndís',
  'Rakel',
  'Unnur',
  'Vigdís',
  'Arna'
];
const FATHER = [
  'Jóns',
  'Sigurðar',
  'Guðmunds',
  'Gunnars',
  'Ólafs',
  'Einars',
  'Kristjáns',
  'Magnúsar',
  'Stefáns',
  'Jóhanns',
  'Björns',
  'Árna',
  'Helga',
  'Páls',
  'Þórs',
  'Haralds',
  'Ragnars',
  'Davíðs',
  'Snorra',
  'Baldurs',
  'Hannesar',
  'Karls',
  'Péturs',
  'Halldórs'
];
const TOUR = [
  ['Lena', 'Germany'],
  ['Tom', 'USA'],
  ['Chloé', 'France'],
  ['Yuki', 'Japan'],
  ['Marco', 'Italy'],
  ['Ava', 'Canada'],
  ['Sven', 'Sweden'],
  ['Priya', 'India'],
  ['Liam', 'UK'],
  ['Sofia', 'Spain'],
  ['Jia', 'China'],
  ['Ola', 'Poland']
];
const PH = {
  hi: [
    'Hæ!',
    'Sæll!',
    'Sæl!',
    'Góðan daginn',
    'Jæja',
    'Hvað segirðu?',
    'Allt gott!',
    'Bless bless',
    'Takk fyrir síðast',
    'Kalt í dag',
    'Er ekki allt gott?',
    'Nei, sko!',
    'Gaman að sjá þig'
  ],
  night: ['Skál!', 'Einn í viðbót?', 'Pylsa?', 'Bæjarins beztu!', 'Hvar er partýið?', 'Rúntur!'],
  panic: ['Hjálp!', 'Eldur!', 'Hlaupið!', 'Guð minn góður!', 'Úff!', 'Nei nei nei', 'Forðið ykkur!'],
  watch: ['Vá!', 'Sjáðu!', 'Ótrúlegt', 'Er þetta gos?', 'Ég tek mynd', 'Hringdu í 112!'],
  tour: ['Wow!', 'So pretty!', 'Selfie!', 'Ach, schön!', 'Magnifique', 'Look up!', 'Takk!'],
  rain: ['Típískt', 'Æ, rigning', 'Hvar er regnhlífin?'],
  jog: ['Hff…', 'Hff…', 'Áfram!'],
  kid: ['Bíddu!', 'Ég vinn!', 'Mamma!', 'Sjáðu!']
};
const SHIRT = [
  [200, 60, 60],
  [60, 100, 180],
  [230, 200, 80],
  [60, 150, 110],
  [230, 230, 230],
  [40, 40, 48],
  [180, 90, 170],
  [90, 80, 70],
  [220, 120, 60],
  [50, 70, 90],
  [120, 40, 50],
  [80, 120, 150]
];
const PANTS = [
  [40, 44, 60],
  [60, 60, 64],
  [30, 30, 34],
  [90, 80, 70],
  [50, 70, 110],
  [110, 100, 90]
];
const HAIR = [
  [40, 30, 24],
  [90, 60, 30],
  [200, 170, 100],
  [230, 210, 160],
  [150, 80, 40],
  [20, 20, 20],
  [170, 170, 170],
  [240, 236, 220]
];
const HATS = [
  [200, 40, 40],
  [40, 60, 120],
  [230, 230, 230],
  [40, 40, 44],
  [230, 180, 40],
  [70, 120, 80],
  [180, 90, 140]
];
const SKINS = [
  [240, 206, 178],
  [226, 190, 160],
  [200, 150, 110],
  [160, 110, 80],
  [110, 74, 52]
];
const CARC = [
  [200, 40, 40],
  [232, 232, 232],
  [40, 40, 48],
  [60, 110, 190],
  [150, 150, 156],
  [220, 180, 60],
  [90, 120, 90],
  [110, 40, 40],
  [180, 190, 200]
];
const JOBS = {
  4: [
    'Shop assistant',
    'Accountant',
    'Barista',
    'Software developer',
    'Designer',
    'Hotel receptionist',
    'Bank clerk'
  ],
  5: ['Electrician', 'Warehouse worker', 'Mechanic', 'Fish processor'],
  6: ['Teacher', 'Nurse', 'Librarian', 'Civil servant', 'Preschool teacher'],
  8: ['Tour guide', 'Musician', 'Priest']
};
let AGID = 1;
function mkAgent(kind, x, y) {
  const a = {
    id: AGID++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    path: null,
    pi: 0,
    t: 0,
    sp: 1.4,
    side: R() < 0.5 ? 1 : -1,
    phase: R() * 6,
    state: 'walk',
    idle: 0,
    bubble: null,
    bt: 0,
    dead: false,
    face: 1
  };
  if (kind === 'car' || kind === 'bus' || kind === 'truck') {
    a.car = 1;
    a.lane = (R() * 4) | 0;
    a.wi = -1;
    a.c = kind === 'bus' ? [240, 196, 40] : kind === 'truck' ? [200, 30, 30] : pickA(CARC);
    a.len = kind === 'bus' ? 12 : kind === 'truck' ? 9 : 4.4;
    a.wid = kind === 'bus' ? 2.5 : kind === 'truck' ? 2.5 : 1.8;
    a.hgt = kind === 'bus' ? 3.2 : kind === 'truck' ? 3 : 1.5;
    a.sp = kind === 'bus' ? 11 : kind === 'truck' ? 20 : 12 + R() * 5;
    a.side = 1;
    if (kind === 'bus') {
      setVT(a, 'bus');
      a.sp = 11;
    }
    if (kind === 'truck') {
      setVT(a, 'fire');
      a.sp = 20;
    }
    return a;
  }
  const f = R() < 0.5;
  a.female = f;
  a.skin = pickA(SKINS);
  a.hair =
    f && R() < 0.25
      ? pickA([
          [200, 170, 100],
          [230, 210, 160],
          [150, 80, 40]
        ])
      : pickA(HAIR);
  a.long = f ? R() < 0.7 : R() < 0.1;
  a.shirt = pickA(SHIRT);
  a.pants = pickA(PANTS);
  a.hat = R() < 0.4 ? pickA(HATS) : null;
  a.lopi = R() < 0.18;
  a.age = 18 + ((R() * 62) | 0);
  a.scale = 1;
  a.name = (f ? pickA(FEMALE) : pickA(MALE)) + ' ' + pickA(FATHER) + (f ? 'dóttir' : 'son');
  a.sp = 1.1 + R() * 0.5;
  if (kind === 'kid') {
    a.scale = 0.7;
    a.age = 6 + ((R() * 9) | 0);
    a.bag = pickA([
      [200, 60, 60],
      [60, 100, 180],
      [230, 200, 80]
    ]);
    a.sp = 1.3;
    a.job = 'Pupil';
  }
  if (kind === 'tourist') {
    const t = pickA(TOUR);
    a.name = t[0];
    a.from = t[1];
    a.shirt = pickA([
      [230, 80, 40],
      [40, 170, 200],
      [240, 210, 40],
      [200, 40, 120],
      [90, 190, 90]
    ]);
    a.bag = [60, 70, 80];
    a.cam = 1;
    a.hat = R() < 0.5 ? [230, 230, 230] : null;
    a.lopi = R() < 0.35;
    a.age = 20 + ((R() * 50) | 0);
    a.sp = 1;
  }
  if (kind === 'jogger') {
    a.shirt = pickA([
      [240, 80, 120],
      [80, 220, 140],
      [250, 220, 60],
      [60, 160, 240]
    ]);
    a.pants = [30, 30, 34];
    a.hat = null;
    a.sp = 3.2;
    a.lopi = false;
  }
  if (kind === 'dog')
    a.dog = pickA([
      [60, 44, 30],
      [200, 170, 120],
      [30, 30, 30],
      [230, 226, 214]
    ]);
  if (kind === 'fire') {
    a.shirt = [40, 40, 44];
    a.pants = [40, 40, 44];
    a.hat = [230, 200, 40];
    a.helmet = 1;
    a.lopi = false;
    a.sp = 2.4;
    a.job = 'Firefighter, Slökkvilið';
  }
  if (kind === 'worker') {
    a.shirt = [240, 200, 30];
    a.vest = 1;
    a.hat = [240, 240, 240];
    a.helmet = 1;
    a.lopi = false;
    a.job = 'Construction worker';
  }
  if (kind === 'party') {
    a.sp = 1;
    a.wobble = 1;
  }
  return a;
}
function district(x, y) {
  if (inF(x, y)) {
    let b = null,
      bd = 1e18;
    for (const d of DIST) {
      const q = (d.x - x) ** 2 + (d.y - y) ** 2;
      if (q < bd) {
        bd = q;
        b = d;
      }
    }
    return b ? b.n : '';
  }
  return placeName(x, y);
}
function placeName(x, y) {
  let b = null,
    bd = 1e18;
  for (const p of PLACES) {
    if (p[3] !== 'town' && p[3] !== 'city' && p[3] !== 'village') continue;
    const q = (p[0] * 0.5 - x) ** 2 + (p[1] * 0.5 - y) ** 2;
    if (q < bd) {
      bd = q;
      b = p;
    }
  }
  if (inF(x, y)) return district(x, y);
  if (!b) return 'Ísland';
  const d = Math.sqrt(bd);
  return d < 3000 ? b[2] : d < 25000 ? 'near ' + b[2] : 'the highlands';
}
function randB(x, y, r, test) {
  const cands = [];
  nearB(x, y, r, b => {
    if (b.state === 0 && test(b)) cands.push(b);
  });
  return cands.length ? pickA(cands) : null;
}
function bEntry(b, G) {
  return nearestNode(b.cx, b.cy, G, Math.max(60, b.r + 50));
}
function actFactor() {
  const h = (gameMin % 1440) / 60,
    dow = dayOfWeek(),
    wk = dow === 5 || dow === 6;
  const base =
    h < 5
      ? 0.06
      : h < 7
        ? 0.15 + (h - 5) * 0.2
        : h < 9
          ? 0.85
          : h < 11.5
            ? 0.55
            : h < 13.5
              ? 0.8
              : h < 16
                ? 0.55
                : h < 18.5
                  ? 0.9
                  : h < 21
                    ? 0.5
                    : h < 23
                      ? 0.28
                      : 0.12;
  return base * (rainT > 0 ? 0.6 : 1) * (wk && (h > 22 || h < 3) ? 1.8 : 1) * wxStay();
}
/* bad weather keeps people at home and makes drivers careful */
function wxStay() {
  return Math.max(
    0.25,
    1 - 0.6 * wxW('storm') - 0.3 * wxW('snow') * (windS > 10 ? 1 : 0.5) - 0.15 * wxW('rain')
  );
}
function wxDrive() {
  return Math.max(
    0.55,
    1 -
      0.35 * wxW('storm') -
      0.25 * Math.max(wxW('snow'), Math.min(1, snowAcc * 3)) -
      0.08 * wxW('rain') -
      0.1 * wxW('fog')
  );
}
function dayOfWeek() {
  return (((DAY0 + Math.floor(gameMin / 1440)) % 7) + 7) % 7;
}
const DAYS = [
  'Sunnudagur',
  'Mánudagur',
  'Þriðjudagur',
  'Miðvikudagur',
  'Fimmtudagur',
  'Föstudagur',
  'Laugardagur'
];
let region = null,
  regionPop = 0,
  regionT = 0;
function spawnTick() {
  spawnZones(viewRect(Math.max(140, 240 / K)));
  if (K < 0.27) {
    for (const a of agents) if (!a.keep && !a.dead) a.dead = true;
    for (const a of animals) if (a !== follow) a.dead = true;
    return;
  }
  const vr = viewRect(Math.max(140, 240 / K));
  spawnAnimals(vr);
  if (time - regionT > 2 || !region) {
    region = vr;
    regionT = time;
    regionPop = 0;
    surveyRoads(vr);
    eachB(BBUCK, vr[0], vr[1], vr[2], vr[3], b => {
      if (b.state === 0) regionPop += b.res + b.jobs * 0.6 + (b.sp ? 150 : 0);
    });
  }
  for (const a of agents) {
    if (a.dead || a.keep || a === follow) continue;
    if (a.x < vr[0] - 150 || a.x > vr[2] + 150 || a.y < vr[1] - 150 || a.y > vr[3] + 150) a.dead = true;
  }
  const f = actFactor(),
    area = ((vr[2] - vr[0]) * (vr[3] - vr[1])) / 1e6;
  const town = Math.min(1, regionPop / 400);
  const wantP = Math.min(650 * PERF, Math.round((regionPop * 0.05 * f + area * 40 * f * town) * PERF)),
    wantC = Math.min(140, Math.round(regionPop * 0.008 * f + area * 14 * Math.max(0.15, f) * town));
  let np = 0,
    nc = 0;
  for (const a of agents) {
    if (a.dead) continue;
    if (a.car) nc++;
    else np++;
  }
  const budget = performance.now() + 6;
  for (let q = 0; q < 24 && np < wantP && performance.now() < budget; q++) if (spawnPed(vr)) np++;
  const tf = trafficFactor(),
    wantT = Math.min(
      340 * PERF,
      Math.round((roadKmW * tf * (K < 0.6 ? 0.5 : 1) + wantC * 0.25) * Math.max(0.6, PERF))
    );
  const budC = performance.now() + (nc < wantT * 0.5 ? 9 : 5);
  if (nc > wantT * 1.4 + 6) {
    let kill = Math.min(4, nc - wantT);
    for (const a of agents) {
      if (kill <= 0) break;
      if (
        a.car &&
        !a.dead &&
        !a.keep &&
        !a.route &&
        a !== follow &&
        a !== selected &&
        a.kind !== 'truck' &&
        !onScr(a.x, a.y, 30)
      ) {
        a.dead = true;
        kill--;
      }
    }
  }
  for (let q = 0; q < 16 && nc < wantT && performance.now() < budC; q++)
    if (R() < 0.12 ? spawnCar(vr) : spawnTraffic(vr)) nc++;
  busSpawn(vr);
}
