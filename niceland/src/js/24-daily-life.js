/**
 * Daily life
 *
 * Households, jobs and day plans: where each person is going and why.
 *
 * Functions: bWealth, wealthWord, mkPersona, workOf, jobB, dayPlan, hhmm, planNow, placeOf, goInside,
 *     emerge, planHTML, actWeights, routineCheck, pickKey, nearArea, applyLook, walkerKind, spawnPed,
 *     spawnTourist, joinZone, lookExtras, drawPram, drawRide
 * State and constants: RICH, JOBH, JOBM, JOBL, JOBR, NIGHTJOB, WORKPL, PLAN_TXT, rcN, USE_CAFE, USE_BAR,
 *     USE_SHOP, COATS, PARKA, TEEN
 */

const RICH = {
  'Seltjarnarnes': 0.74,
  'Skerjafjörður': 0.78,
  'Vesturbær': 0.64,
  'Miðborg': 0.6,
  'Fossvogur': 0.74,
  'Garðabær': 0.78,
  'Laugardalur': 0.6,
  'Laugarnes': 0.55,
  'Hlíðar': 0.56,
  'Kársnes': 0.56,
  'Smáíbúðahverfi': 0.5,
  'Háaleiti': 0.52,
  'Grafarvogur': 0.46,
  'Grafarholt': 0.44,
  'Árbær': 0.45,
  'Ártúnsholt': 0.62,
  'Álftanes': 0.6,
  'Norðurmýri': 0.5,
  'Neðra-Breiðholt': 0.3,
  'Fell og Hólar': 0.2,
  'Seljahverfi': 0.42,
  'Digranes': 0.46,
  'Hamraborg': 0.34,
  'Smárinn': 0.46,
  'Vogar': 0.4,
  'Heimar': 0.46,
  'Grandi': 0.5,
  'Borgartún': 0.48,
  'Bryggjuhverfi': 0.46,
  'Vatnsmýri': 0.52,
  'Öskjuhlíð': 0.5,
  'Elliðaárdalur': 0.5
};
const JOBH = [
  'Lawyer',
  'Surgeon',
  'Investment banker',
  'CEO',
  'Architect',
  'Professor',
  'Diplomat',
  'Airline pilot',
  'Dentist',
  'Software architect',
  'Judge',
  'Film director',
  'Gallery owner',
  'Member of the Alþingi',
  'Ship owner',
  'Consultant',
  'Cardiologist',
  'Fund manager'
];
const JOBM = [
  'Teacher',
  'Nurse',
  'Engineer',
  'Accountant',
  'Software developer',
  'Police officer',
  'Journalist',
  'Designer',
  'Pharmacist',
  'Civil servant',
  'Electrician',
  'Plumber',
  'Physiotherapist',
  'Librarian',
  'Preschool teacher',
  'Graphic designer',
  'Paramedic',
  'Priest',
  'Social worker',
  'Musician',
  'Chef',
  'Marketing manager',
  'Carpenter'
];
const JOBL = [
  'Barista',
  'Shop assistant',
  'Fish processor',
  'Cleaner',
  'Warehouse worker',
  'Bus driver',
  'Cook',
  'Delivery driver',
  'Care worker',
  'Hotel housekeeper',
  'Kitchen porter',
  'Security guard',
  'Taxi driver',
  'Construction worker',
  'Baker',
  'Cashier',
  'Waiter',
  'Tour guide'
];
const JOBR = [
  'Sheep farmer',
  'Dairy farmer',
  'Fisherman',
  'Guesthouse owner',
  'Horse breeder',
  'Teacher',
  'Mechanic',
  'Shop assistant',
  'Fish processor',
  'Tour guide'
];
const NIGHTJOB = /Nurse|Paramedic|Police|Security|Taxi|Baker|Cleaner|Surgeon|Care/;
const WORKPL = [
  [/Preschool/, b => /kindergarten/.test(b.use) || b.kind === 6],
  [/Teacher|Professor|Librarian/, b => /school|university|college|library/.test(b.use) || b.kind === 6],
  [
    /Nurse|Surgeon|Cardio|Paramedic|Care|Pharmac|Dentist|Physio/,
    b => /hospital|clinic|doctors|pharmacy|dentist/.test(b.use) || b.kind === 6
  ],
  [/Priest/, b => b.kind === 7],
  [/Barista|Cook|Kitchen|Baker|Chef|Waiter/, b => /cafe|restaurant|bar|pub|fast_food|bakery/.test(b.use)],
  [/Shop|Cashier/, b => b.kind === 4],
  [/Hotel/, b => /hotel|guest/.test(b.use) || b.kind === 4],
  [/Fish|Warehouse|Mechanic|Electrician|Plumber|Construction|Delivery|Carpenter/, b => b.kind === 5],
  [
    /Lawyer|banker|CEO|Accountant|Software|Engineer|Designer|Architect|Journalist|Civil|Judge|Diplomat|Alþingi|Consultant|Fund|Marketing|owner/,
    b => (b.kind === 4 || b.kind === 6) && b.h >= 8
  ]
];
function bWealth(b) {
  if (b.wl !== undefined) return b.wl;
  let w = RICH[district(b.cx, b.cy)];
  if (w === undefined) w = 0.42;
  if (b.kind === 0) w += Math.max(-0.08, Math.min(0.25, (b.area - 130) / 700));
  else if (b.kind === 1) w -= 0.04;
  else if (b.kind === 2) w -= 0.12 + (b.area > 900 ? 0.05 : 0);
  w += (b.seed - 0.5) * 0.22;
  return (b.wl = Math.max(0, Math.min(1, w)));
}
function wealthWord(w) {
  return w > 0.72 ? 'Affluent' : w > 0.55 ? 'Comfortable' : w > 0.36 ? 'Middle-income' : 'Modest';
}
function mkPersona(home, age) {
  const w = bWealth(home),
    rural = !inF(home.cx, home.cy);
  if (age === undefined) {
    const r = R();
    if (home.kind === 2)
      age =
        r < 0.1
          ? 6 + R() * 7
          : r < 0.18
            ? 13 + R() * 7
            : r < 0.42
              ? 20 + R() * 10
              : r < 0.76
                ? 30 + R() * 36
                : 66 + R() * 26;
    else
      age =
        r < 0.18
          ? 6 + R() * 7
          : r < 0.3
            ? 13 + R() * 7
            : r < 0.37
              ? 20 + R() * 8
              : r < 0.78
                ? 28 + R() * 39
                : 66 + R() * 26;
  }
  age = age | 0;
  let job, stage;
  if (age < 6) {
    job = 'Leikskólabarn · toddler';
    stage = 'toddler';
  } else if (age < 13) {
    job = 'Grunnskólanemi · pupil';
    stage = 'child';
  } else if (age < 16) {
    job = 'Grunnskólanemi · pupil';
    stage = 'teen';
  } else if (age < 20) {
    job = 'Menntaskólanemi · college student';
    stage = 'teen';
  } else if (age < 26 && R() < 0.55) {
    job = 'Háskólanemi · university student';
    stage = 'student';
  } else if (age >= 67) {
    stage = 'retired';
    job =
      w > 0.66 && R() < 0.5
        ? pickA([
            'Retired judge',
            'Retired surgeon',
            'Retired ship owner',
            'Retired ambassador',
            'Retired professor'
          ])
        : pickA([
            'Retired',
            'Retired teacher',
            'Retired fisherman',
            'Retired nurse',
            'Retired bus driver',
            'Pensioner',
            'Retired farmer'
          ]);
  } else {
    stage = 'adult';
    const t = w + (R() - 0.5) * 0.45;
    job = rural && R() < 0.55 ? pickA(JOBR) : pickA(t > 0.7 ? JOBH : t > 0.38 ? JOBM : JOBL);
  }
  const p = {
    age,
    job,
    stage,
    w,
    rural,
    fit: R() < (stage === 'retired' ? 0.15 : 0.32),
    dog: R() < 0.16,
    kids: stage === 'adult' && age < 50 && R() < 0.5,
    night: stage === 'adult' && NIGHTJOB.test(job) && R() < 0.35,
    early: /Baker|Fish|Construction|Farmer|Fisherman|Bus/.test(job),
    insomniac: R() < 0.015
  };
  p.home = home;
  return p;
}
function workOf(p) {
  if (p.work !== undefined) return p.work;
  if (p.stage !== 'adult' && p.stage !== 'student') return (p.work = null);
  const home = p.home;
  let wp = null;
  for (const [re, test] of WORKPL)
    if (re.test(p.job)) {
      wp = jobB(home, 4000, test);
      break;
    }
  return (p.work = wp || jobB(home, 6000, b => b.jobs > 0));
}
/* where people work: bigger workplaces draw people from further away (Borgartún, downtown, Landspítali, the university, Kringlan…) */
function jobB(home, r, test) {
  const c = [];
  let tot = 0;
  nearB(home.cx, home.cy, r, b => {
    if (b.state !== 0 || !test(b)) return;
    const d = Math.hypot(b.cx - home.cx, b.cy - home.cy);
    const w = Math.max(1, b.jobs || b.area / 40) * Math.exp(-d / 2200);
    c.push([b, w]);
    tot += w;
  });
  if (!c.length) return null;
  let x = R() * tot;
  for (const [b, w] of c) {
    x -= w;
    if (x <= 0) return b;
  }
  return c[c.length - 1][0];
}
/* ---- a person's day: sampled once per day from the same habits that decide who is out on the streets ---- */
const PLAN_TXT = {
  sleep: 'Asleep at home',
  home: 'At home',
  commute: 'At work',
  work: 'At work',
  nightshift: 'Night shift',
  school: 'At school',
  uni: 'At the university',
  lunch: 'Lunch',
  cafe: 'Coffee',
  dine: 'Dinner out',
  bar: 'A drink',
  party: 'Out on the town',
  errand: 'Errands',
  shop: 'Shopping',
  hang: 'With friends',
  church: 'Church',
  gym: 'Gym',
  pool: 'Swimming pool',
  play: 'Playing outside',
  sport: 'Football',
  family: 'Out with the family',
  schoolrun: 'School run',
  pickup: 'Picking up the kids',
  pram: 'Walk with the pram',
  jog: 'A run',
  dog: 'Walking the dog',
  stroll: 'A walk',
  schoolhome: 'Home from school'
};

function dayPlan(p, seed, force) {
  const day = Math.floor(gameMin / 1440),
    dow = dayOfWeek(),
    nowI = Math.floor((gameMin % 1440) / 30);
  if (p.plan && p.planDay === day) return p.plan;
  const rnd = i => h32(seed | 0, day * 97 + i, 61);
  const slots = [];
  let prev = 'sleep',
    base = 'home';
  for (let i = 0; i < 48; i++) {
    const h = i / 2 + 0.25;
    const W = actWeights(p, h, dow, false);
    let key = null;
    let tot = 0;
    for (const k in W) tot += W[k];
    const SHORT = /^(jog|dog|stroll|cafe|lunch|errand|pool|sport|play|gym|schoolrun|pickup|pram)$/;
    if (
      p.stage !== 'child' &&
      tot &&
      h >= 7 &&
      h < 22.5 &&
      !W.commute &&
      !W.none &&
      !(base === 'work' && h < 16)
    ) {
      W.home = (W.home || 0) + tot * 0.8;
      tot *= 1.8;
    } // plenty of time is spent at home
    if (!tot) key = h < 7 || h >= 21 ? 'sleep' : 'home';
    else if (prev && W[prev] && !SHORT.test(prev) && rnd(i + 500) < 0.8)
      key = prev; // stay put a while
    else if (
      SHORT.test(prev) &&
      ((slots.length > 1 && slots[slots.length - 2] === prev) || rnd(i + 700) < 0.6)
    )
      key =
        base === 'work' && (W.none || h < 16.5) ? 'work' : base === 'school' && h < 14 ? 'school' : 'home';
    // outings are short, then back to base
    else {
      let x = rnd(i) * tot;
      for (const k in W) {
        x -= W[k];
        if (x <= 0) {
          key = k;
          break;
        }
      }
      if (!key) key = Object.keys(W)[0];
    }
    if (force && i === nowI && PLAN_TXT[force]) key = force; // what they are actually doing right now
    if (key === 'none') key = base !== 'home' ? base : prev === 'sleep' ? 'home' : prev;
    if ((h < 5 || (h >= 23.5 && key === 'home')) && key !== 'party' && key !== 'nightshift' && key !== 'bar')
      key = 'sleep';
    if (key === 'commute' || key === 'work' || key === 'nightshift') base = 'work';
    else if (key === 'school' || key === 'uni') base = key;
    else if (key === 'home' || key === 'sleep' || key === 'schoolhome') base = 'home';
    if (key === 'commute' && (prev === 'work' || prev === 'commute')) key = 'work';
    if (key === 'school' && prev === 'school') key = 'school';
    if (key === 'schoolhome') key = 'home';
    // short outings don't repeat back to back: a run is a run, then home
    if (
      (key === 'jog' ||
        key === 'dog' ||
        key === 'stroll' ||
        key === 'lunch' ||
        key === 'cafe' ||
        key === 'errand') &&
      prev === key
    )
      key = key === 'lunch' ? 'work' : 'home';
    slots.push(key);
    prev = key;
  }
  const out = [];
  for (let i = 0; i < 48; i++) {
    const k = slots[i] === 'commute' ? 'work' : slots[i];
    if (out.length && out[out.length - 1].k === k) out[out.length - 1].e = i + 1;
    else out.push({ k, s: i, e: i + 1 });
  }
  p.plan = out;
  p.planDay = day;
  return out;
}
function hhmm(m) {
  m = Math.floor(m) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function planNow(p, seed) {
  const pl = dayPlan(p, seed),
    i = Math.floor((gameMin % 1440) / 30);
  return pl.findIndex(b => i >= b.s && i < b.e);
}
function placeOf(a, k) {
  const p = a.persona,
    hh = p.home,
    nm = b => (b ? b.name || b.addr || district(b.cx, b.cy) : '');
  switch (k) {
    case 'sleep':
    case 'home':
    case 'family':
    case 'pram':
      return [hh, 'home'];
    case 'work':
    case 'commute':
    case 'nightshift': {
      const w = workOf(p);
      return [w, w ? nm(w) : ''];
    }
    case 'school':
    case 'schoolrun':
    case 'pickup': {
      const b = randB(hh.cx, hh.cy, 1200, b => /school|kindergarten/.test(b.use) || b.kind === 6);
      return [b, nm(b)];
    }
    case 'uni': {
      const b =
        randB(hh.cx, hh.cy, 3000, b => /university|college/.test(b.use)) ||
        randB(hh.cx, hh.cy, 1500, b => b.kind === 6);
      return [b, nm(b)];
    }
    case 'lunch':
    case 'cafe': {
      const w = workOf(p) || hh;
      const b = randB(w.cx, w.cy, 800, USE_CAFE);
      return [b, nm(b)];
    }
    case 'dine': {
      const b = randB(hh.cx, hh.cy, 1600, b => /restaurant/.test(b.use));
      return [b, nm(b)];
    }
    case 'bar':
    case 'party': {
      const b = randB(hh.cx, hh.cy, 1600, USE_BAR) || randB(hh.cx, hh.cy, 1200, USE_CAFE);
      return [b, nm(b)];
    }
    case 'shop': {
      const b = randB(hh.cx, hh.cy, 1600, USE_SHOP);
      return [b, nm(b)];
    }
    case 'errand': {
      const b = randB(
        hh.cx,
        hh.cy,
        1200,
        b => b.kind === 4 || /pharmacy|post|bank|library|doctors/.test(b.use)
      );
      return [b, nm(b)];
    }
    case 'church': {
      const b = randB(hh.cx, hh.cy, 1600, b => b.kind === 7);
      return [b, nm(b)];
    }
    case 'gym': {
      const b = randB(hh.cx, hh.cy, 1600, b => /sports|fitness|gym/.test(b.use));
      return [b, nm(b)];
    }
    default:
      return [null, ''];
  }
}
function goInside(a) {
  const p = a.persona;
  if (!p || !p.home) return false;
  const pl = dayPlan(p, a.id, a.key),
    i = planNow(p, a.id);
  if (i < 0) return false;
  let b = a.dest && a.dest.cx !== undefined ? a.dest : null;
  if (!b) {
    nearB(a.x, a.y, 80, c => {
      if (!b && c.state === 0 && Math.hypot(c.cx - a.x, c.cy - a.y) < c.r + 30) b = c;
    });
  }
  if (!b) return false;
  const cur = pl[i];
  let nx = i + 1;
  while (nx < pl.length && placeOf(a, pl[nx].k)[0] === b) nx++;
  const day = Math.floor(gameMin / 1440) * 1440;
  let until = nx < pl.length ? day + pl[nx].s * 30 : day + 1440 + 7 * 60;
  until = Math.max(until, gameMin + 10);
  a.inside = b;
  a.insideUntil = until;
  a.hidden = true;
  a.keep = 1;
  a.path = null;
  a.entering = 0;
  a.x = b.cx;
  a.y = b.cy;
  a.act =
    'Inside ' +
    (b.name || b.addr || district(b.cx, b.cy)) +
    ' · ' +
    (PLAN_TXT[cur.k] || '') +
    ' until ' +
    hhmm(until);
  toast(
    a.name.split(' ')[0] + ' went inside. Back out at ' + hhmm(until) + ' — speed up time to follow the day'
  );
  return true;
}
function emerge(a) {
  const p = a.persona,
    b = a.inside;
  a.inside = null;
  a.hidden = false;
  a.entering = 0;
  const pl = dayPlan(p, a.id, a.key),
    i = planNow(p, a.id);
  const k = i >= 0 ? pl[i].k : 'home';
  let [dest, label] = placeOf(a, k);
  const s0 = bEntry(b, GW);
  a.x = NX[s0] !== undefined && s0 >= 0 ? NX[s0] : b.cx;
  a.y = s0 >= 0 ? NY[s0] : b.cy;
  a.state = 'walk';
  a.loop = false;
  a.loops = 0;
  const verb = {
    work: 'Walking to work at ',
    school: 'Walking to school at ',
    uni: 'Off to lectures at ',
    lunch: 'Lunch at ',
    cafe: 'Coffee at ',
    dine: 'Dinner at ',
    bar: 'A drink at ',
    party: 'Out on the town at ',
    shop: 'Shopping at ',
    errand: 'Errands at ',
    church: 'Church at ',
    gym: 'Working out at ',
    home: 'Heading home',
    sleep: 'Heading home to bed'
  }[k];
  let path = null;
  if (dest && dest !== b) {
    const t = bEntry(dest, GW);
    if (s0 >= 0 && t >= 0) path = astar(GW, s0, t, 20000);
  }
  if (path && path.length > 1) {
    a.path = path;
    a.pi = 0;
    a.t = 0;
    a.dest = dest;
    a.act = verb ? (verb.endsWith(' ') ? verb + label : verb) : PLAN_TXT[k];
  } else {
    const t = nearestNode(a.x + (R() - 0.5) * 700, a.y + (R() - 0.5) * 700, GW, 250);
    path = s0 >= 0 && t >= 0 ? astar(GW, s0, t, 8000) : null;
    if (path && path.length > 1) {
      a.path = path;
      a.pi = 0;
      a.t = 0;
      a.loop = true;
      a.home = p.home;
      a.dest = null;
      a.act = PLAN_TXT[k] || 'A walk';
    } else {
      goInside(a);
      return;
    }
  }
  if (k === 'jog') {
    a.sp = 2.6;
  } else a.sp = 1.4;
  if (k === 'dog' && !a.dog) a.dog = [120, 90, 60];
}
function planHTML(a) {
  const p = a.persona;
  if (!p || !p.home || p.stage === 'toddler') return '';
  const pl = dayPlan(p, a.id, a.key),
    i = planNow(p, a.id);
  const from = Math.max(0, i - 1),
    list = pl.slice(from, from + 7);
  return (
    '<div class="sub" style="margin-top:8px">Today' +
    (from > 0 ? ' (from ' + hhmm(pl[from].s * 30) + ')' : '') +
    '</div>' +
    list
      .map((b, j) => {
        const on = pl.indexOf(b) === i;
        const pl2 = b.k === 'work' || b.k === 'school' || b.k === 'uni' ? placeOf(a, b.k)[1] : '';
        return (
          '<div class="row" style="' +
          (on ? 'color:#c6b3ff;font-weight:600' : 'opacity:.85') +
          '"><span>' +
          hhmm(b.s * 30) +
          '</span><span>' +
          (PLAN_TXT[b.k] || b.k) +
          (pl2 ? ' · ' + pl2 : '') +
          '</span></div>'
        );
      })
      .join('')
  );
}
/* weighted activities by life stage, hour and weekday */
function actWeights(p, h, dow, down) {
  const wd = dow >= 1 && dow <= 5,
    fri = dow === 5,
    sat = dow === 6,
    sun = dow === 0,
    W = {};
  const add = (k, v) => {
    if (v > 0) W[k] = (W[k] || 0) + v;
  };
  const nightOut = ((fri || sat) && (h >= 21.5 || h < 4)) || ((sat || sun) && h < 4.5),
    thu = dow === 4;
  const st = p.stage;
  if (st === 'child') {
    if (h < 7 || h >= 21.5) return W;
    if (wd && h >= 7.5 && h < 8.3) add('school', 6);
    if (wd && h >= 8.3 && h < 13.3) {
      add('stroll', 0.05);
      add('none', 12);
    }
    if (wd && h >= 13.3 && h < 15.5) {
      add('schoolhome', 3);
      add('play', 1.5);
    }
    if (h >= 15.5 && h < 19.5) {
      add('play', 3);
      add('sport', 1.3);
      add('stroll', 0.5);
    }
    if (!wd && h >= 9 && h < 19) {
      add('play', 3);
      add('family', 2.5);
      add('pool', 1);
    }
    if (h >= 19.5) add('stroll', 0.3);
    return W;
  }
  if (st === 'teen') {
    if ((h >= 1 && h < 7) || (h >= 23.5 && !(fri || sat))) return W;
    if (h < 1 && !(sat || sun)) return W;
    if (wd && h >= 7.5 && h < 8.4) add('school', 5);
    if (wd && h >= 8.4 && h < 14.5) {
      add('hang', 0.1);
      add('none', 10);
    }
    if (wd && h >= 14.5 && h < 18) {
      add('hang', 2);
      add('sport', 1.3);
      add('shop', 0.8);
      add('pool', 0.5);
    }
    if (h >= 18 && h < 23.5) {
      add('hang', 1.6);
      add('stroll', 0.5);
      if (fri || sat) add('hang', 1.5);
    }
    if (!wd && h >= 11 && h < 18) {
      add('hang', 2);
      add('shop', 1.2);
      add('pool', 0.6);
    }
    if (h < 1) add('hang', 1);
    return W;
  }
  if (st === 'student') {
    if (h >= 4 && h < 7.5) return W;
    if (wd && h >= 8.5 && h < 11.5) add('uni', 3);
    if (h >= 11.5 && h < 13) add('lunch', 1.5);
    if (wd && h >= 13 && h < 17) {
      add('uni', 1.2);
      add('cafe', 1);
    }
    if (h >= 17 && h < 21.5) {
      add('stroll', 0.6);
      add('jog', p.fit ? 0.8 : 0.1);
      add('shop', 0.6);
      add('cafe', 0.5);
    }
    if (nightOut || (thu && h >= 21.5)) add('party', 4);
    if (!wd && h >= 11 && h < 17) {
      add('cafe', 1.5);
      add('stroll', 1);
      add('pool', 0.6);
    }
    if (h < 4 && !nightOut) add('home', 0.4);
    return W;
  }
  if (st === 'retired') {
    if (h < 6.3 || h >= 21) return W;
    if (h < 9.5) {
      add('pool', 3);
      add('stroll', 1.5);
      add('dog', p.dog ? 1 : 0);
    }
    if (h >= 9.5 && h < 12) {
      add('cafe', 1.5);
      add('errand', 1.5);
      add('stroll', 1.5);
    }
    if (h >= 12 && h < 17) {
      add('stroll', 2);
      add('errand', 1);
      add('shop', 0.8);
      add('family', 0.4);
    }
    if (sun && h >= 10.4 && h < 11.2) add('church', 2.5);
    if (h >= 17) {
      add('stroll', 0.6);
      add('dog', p.dog ? 0.6 : 0);
    }
    return W;
  }
  // working-age adults
  if (h >= 1 && h < 5.5) {
    if (nightOut && down) add('party', 3);
    if (p.night) add('nightshift', 1.2);
    if (p.insomniac) {
      add('jog', 0.25);
      add('dog', 0.25);
    }
    if (nightOut) add('home', 0.5);
    return W;
  }
  if (h >= 5.5 && h < 7) {
    add('commute', p.early ? 3 : 0.5);
    if (p.fit) add('jog', 1.4);
    if (p.dog) add('dog', 1.2);
    add('pool', 0.6);
    if (p.night) add('home', 1.5);
    return W;
  }
  if (wd) {
    if (h >= 7 && h < 9) {
      add('commute', 5);
      add('schoolrun', p.kids ? 2.2 : 0);
      add('jog', p.fit ? 0.5 : 0);
      add('dog', p.dog ? 0.8 : 0);
    } else if (h < 11.5) {
      add('errand', 1);
      add('stroll', 0.4);
      add('cafe', 0.5 + p.w * 0.6);
      add('none', p.night ? 2 : 7);
    } else if (h < 13.2) {
      add('lunch', 3);
      add('errand', 0.8);
    } else if (h < 16) {
      add('errand', 1);
      add('stroll', 0.4);
      add('cafe', 0.3);
      add('none', p.night ? 2 : 7);
    } else if (h < 18.5) {
      add('home', 4);
      add('shop', 1.5);
      add('pickup', p.kids ? 1.5 : 0);
      add('gym', 0.7);
      add('pool', 0.7);
      add('jog', p.fit ? 0.7 : 0);
    } else if (h < 21.5) {
      add('jog', p.fit ? 1.2 : 0.1);
      add('dog', p.dog ? 2 : 0.2);
      add('stroll', 1.1);
      add('pool', 0.6);
      add('dine', 0.4 + p.w * 1.2);
      add('sport', 0.4);
      add('pram', p.kids && p.age < 40 ? 0.6 : 0);
    } else {
      add('dog', p.dog ? 1.5 : 0);
      add('stroll', 0.4);
      add('home', 1.2);
      add('bar', (fri ? 2 : thu ? 0.8 : 0.3) * (down ? 1.5 : 0.4));
      if (p.night) add('nightshift', 1.5);
      if (nightOut) add('party', down ? 2 : 0);
    }
    return W;
  }
  if (h >= 7 && h < 10) {
    add('jog', p.fit ? 1.2 : 0.2);
    add('dog', p.dog ? 1.2 : 0.2);
    add('pram', p.kids ? 0.6 : 0);
  } else if (h < 13) {
    add('cafe', 1 + p.w);
    add('pool', 1.5);
    add('family', p.kids ? 2 : 0);
    add('shop', 1);
    add('stroll', 0.8);
    if (sun && h >= 10.5 && h < 11.2) add('church', 0.6);
  } else if (h < 18) {
    add('shop', 1.5);
    add('stroll', 1.5);
    add('family', p.kids ? 2 : 0);
    add('pool', 0.8);
    add('sport', 0.5);
    add('pram', p.kids ? 0.6 : 0);
  } else if (h < 21.5) {
    add('dine', 0.6 + p.w);
    add('stroll', 1);
    add('dog', p.dog ? 1 : 0);
  } else {
    add('bar', down ? 1.5 : 0.4);
    if (nightOut) add('party', down ? 2 : 0.3);
    add('dog', p.dog ? 1 : 0);
    add('home', 0.8);
  }
  return W;
}
/* people whose activity no longer fits the hour (a run that started at dusk, a stroll past midnight) head home */
let rcN = 0;
function routineCheck() {
  if (++rcN % 8) return;
  const h = (gameMin % 1440) / 60,
    dow = dayOfWeek();
  for (const a of agents) {
    if (
      a.zone &&
      a.persona &&
      a.key &&
      !a.dead &&
      a !== follow &&
      !actWeights(a.persona, h, dow, true)[a.key] &&
      R() < 0.2
    ) {
      a.dead = true;
      continue;
    }
    if (a.kind === 'tourist' && !a.loop && !a.dead && (h < 8 || h >= 23.5) && !a.entering && a !== follow) {
      a.entering = 0.8;
      continue;
    }
    if (
      a.dead ||
      a.car ||
      !a.persona ||
      !a.key ||
      a.leader ||
      a.zone ||
      a.flee ||
      a.goingHome ||
      !a.path ||
      !a.home
    )
      continue;
    const W = actWeights(a.persona, h, dow, true);
    if (
      W[a.key] ||
      a.key === 'commute' ||
      a.key === 'home' ||
      a.key === 'schoolhome' ||
      a.key === 'nightshift'
    )
      continue;
    const e = bEntry(a.home, GW);
    if (e < 0) continue;
    const p = astar(GW, a.path[Math.min(a.pi, a.path.length - 1)], e, 8000);
    if (!p || p.length < 2) continue;
    a.path = p;
    a.pi = 0;
    a.t = 0;
    a.loop = false;
    a.dest = a.home;
    a.goingHome = 1;
    a.act = h >= 21 || h < 6 ? 'Heading home, it’s late' : 'Heading home';
    for (const f of agents)
      if (f.leader === a) {
        f.path = p;
        f.act = a.act;
        f.dest = a.home;
      }
  }
}
function pickKey(W) {
  let s = 0;
  for (const k in W) s += W[k];
  if (s <= 0) return null;
  let r = R() * s;
  for (const k in W) {
    r -= W[k];
    if (r <= 0) return k;
  }
  return null;
}
function nearArea(x, y, r, cs) {
  let best = null,
    bd = 1e18;
  if (!PROPS_OK) return null;
  areasIn(x - r, y - r, x + r, y + r, A => {
    if (!cs.includes(A.c)) return;
    const d = (A.cx - x) ** 2 + (A.cy - y) ** 2;
    if (d < bd && d < r * r) {
      bd = d;
      best = A;
    }
  });
  return best;
}
const USE_CAFE = b => /cafe|restaurant|bakery|fast_food/.test(b.use),
  USE_BAR = b => /bar|pub|nightclub/.test(b.use),
  USE_SHOP = b => b.kind === 4 || /shop|mall|supermarket/.test(b.use);
/* look: age, job, wealth and weather decide what people wear and carry */
const COATS = [
  [40, 42, 48],
  [64, 56, 48],
  [120, 96, 70],
  [30, 40, 64],
  [90, 30, 36],
  [60, 70, 60],
  [150, 140, 128]
];
const PARKA = [
  [30, 30, 34],
  [24, 40, 80],
  [170, 40, 40],
  [70, 80, 60],
  [230, 120, 40],
  [40, 90, 140],
  [200, 200, 196]
];
const TEEN = [
  [30, 30, 34],
  [120, 120, 126],
  [200, 60, 90],
  [60, 140, 200],
  [230, 230, 226],
  [90, 60, 140],
  [250, 200, 60]
];
function applyLook(a, p) {
  a.age = p.age;
  a.job = p.job;
  a.persona = p;
  const st = p.stage,
    f = a.female,
    cold = SEAS === 'winter' || TEMP < 4,
    warm = SEAS === 'summer' && TEMP > 11;
  a.scale =
    st === 'child'
      ? 0.62 + (p.age - 6) * 0.03
      : st === 'teen'
        ? 0.88 + R() * 0.1
        : st === 'retired'
          ? 0.93 + R() * 0.05
          : 0.95 + R() * 0.1;
  if (st === 'retired') {
    a.hair =
      R() < 0.8
        ? pickA([
            [180, 180, 178],
            [220, 220, 214],
            [150, 150, 150]
          ])
        : a.hair;
    a.glasses = R() < 0.6;
    a.stick = p.age > 77 && R() < 0.45;
    a.sp = 0.75 + R() * 0.35;
    a.lopi = R() < 0.35;
    a.bald = !f && R() < 0.35;
  } else if (st === 'adult') {
    a.glasses = R() < 0.25;
    a.beard = !f && R() < 0.38;
    a.bald = !f && p.age > 40 && R() < 0.25;
  } else if (st === 'teen') {
    a.shirt = pickA(TEEN);
    a.hood = R() < 0.5;
    a.phones = R() < 0.45;
    a.lopi = false;
    a.sp = 1.3;
  }
  if (st === 'child') {
    a.bag = pickA([
      [200, 60, 60],
      [60, 100, 180],
      [230, 200, 80],
      [90, 180, 120],
      [230, 120, 180]
    ]);
    a.sp = 1.3;
  }
  // job dress
  if (st === 'adult') {
    if (p.w > 0.68 && /Lawyer|banker|CEO|Judge|Diplomat|Alþingi|Fund|Consultant|Architect|Ship/.test(p.job)) {
      a.shirt = pickA([
        [30, 32, 40],
        [40, 44, 56],
        [60, 60, 64]
      ]);
      a.pants = a.shirt;
      a.tie = pickA([
        [150, 30, 40],
        [30, 60, 120],
        [110, 100, 40]
      ]);
      a.coat = R() < 0.6 ? pickA(COATS) : null;
      a.bag = R() < 0.6 ? [60, 44, 36] : null;
      a.lopi = false;
    } else if (/Police/.test(p.job)) {
      a.shirt = [28, 32, 44];
      a.pants = [28, 32, 44];
      a.hivis = 1;
      a.hat = [28, 32, 44];
      a.lopi = false;
    } else if (/Nurse|Surgeon|Paramedic|Care/.test(p.job) && R() < 0.35) {
      a.shirt = [90, 170, 170];
      a.pants = [90, 170, 170];
      a.lopi = false;
    } else if (/Construction|Electrician|Plumber|Carpenter|Warehouse|Fish/.test(p.job) && R() < 0.6) {
      a.vest = 1;
      a.pants = [60, 60, 70];
    } else if (p.w > 0.55 && R() < 0.4) {
      a.coat = pickA(COATS);
    }
  }
  if (cold && !a.coat && !a.vest && !a.hivis && R() < 0.7) {
    a.coat = pickA(PARKA);
    a.puffer = 1;
  }
  if (cold && !a.hat && R() < 0.65) {
    a.hat = pickA(HATS);
    a.pom =
      st !== 'adult' && R() < 0.6
        ? pickA([
            [240, 240, 236],
            [230, 80, 80],
            [250, 220, 60]
          ])
        : null;
  }
  if (st === 'child' && cold) {
    a.pants = a.coat || pickA(PARKA);
    a.coat = null;
    a.shirt = a.pants;
  }
  if (warm && (st === 'child' || st === 'teen' || (st === 'adult' && R() < 0.25)) && !a.tie && !a.vest) {
    a.shorts = R() < 0.6;
    a.coat = null;
    a.hat = R() < 0.15 ? [230, 230, 226] : null;
    a.lopi = false;
  }
  if (rainT > 0 && R() < 0.5 && !a.coat) {
    a.coat = pickA([
      [230, 190, 40],
      [40, 90, 160],
      [180, 40, 40],
      [40, 40, 44]
    ]);
  }
  if (a.coat) {
    a.shirt = a.coat;
  }
  // personal transport
  if (
    (st === 'teen' || st === 'student' || (st === 'adult' && p.age < 40)) &&
    !a.stick &&
    SEAS !== 'winter' &&
    R() < 0.12
  ) {
    a.scooter = 1;
    a.sp = 4.6;
  } else if ((st === 'adult' || st === 'student' || st === 'teen') && SEAS !== 'winter' && R() < 0.07) {
    a.bike = pickA([
      [200, 40, 40],
      [30, 30, 34],
      [60, 120, 200],
      [230, 230, 226],
      [90, 160, 90]
    ]);
    a.sp = 4.2;
    a.helmet = R() < 0.6;
    a.hat = a.helmet
      ? pickA([
          [230, 230, 230],
          [30, 30, 34],
          [240, 90, 40]
        ])
      : a.hat;
  }
}
function walkerKind(key) {
  return key === 'jog'
    ? 'jogger'
    : key === 'dog'
      ? 'dog'
      : key === 'party' || key === 'bar'
        ? 'party'
        : 'walk';
}
/* new spawnPed: pick a home, a person who lives there, and what they would plausibly be doing now */
function spawnPed(vr) {
  const x = vr[0] + R() * (vr[2] - vr[0]),
    y = vr[1] + R() * (vr[3] - vr[1]);
  const h = (gameMin % 1440) / 60,
    dow = dayOfWeek(),
    dt = district(x, y),
    down = dt === 'Miðborg' || dt === 'Grandi' || dt === 'Norðurmýri' || dt === 'Borgartún';
  if (down && h >= 8.5 && h < 22.5 && R() < (SEAS === 'summer' ? 0.22 : 0.13)) return spawnTourist(x, y, h);
  if (SEAS === 'winter' && (h >= 21 || h < 1) && wxW('clear') > 0.5 && R() < 0.04 && !inF(x, y))
    return spawnTourist(x, y, h, true);
  const home = randB(x, y, 160, b => b.res > 0);
  if (!home) return false;
  const s0 = bEntry(home, GW);
  if (s0 < 0) return false;
  const p = mkPersona(home);
  if (p.stage === 'toddler') return false;
  const key = pickKey(actWeights(p, h, dow, down));
  if (!key || key === 'none') return false;
  const a = mkAgent(walkerKind(key), home.cx, home.cy);
  applyLook(a, p);
  if (key === 'jog') {
    a.sp = p.stage === 'retired' ? 2 : 2.6 + R() * 1.2;
    a.scooter = a.bike = 0;
    a.coat = null;
    a.shirt = pickA([
      [240, 80, 120],
      [80, 220, 140],
      [250, 220, 60],
      [60, 160, 240],
      [30, 30, 34]
    ]);
    a.pants = [30, 30, 34];
    a.shorts = SEAS === 'summer';
  }
  if (key === 'dog') {
    a.scooter = a.bike = 0;
  }
  let s = s0,
    dest = null,
    t = -1,
    act = '',
    area = null,
    loop = false;
  const hh = home;
  const goB = (test, r, txt) => {
    dest = randB(hh.cx, hh.cy, r || 1200, test);
    if (dest) act = txt(dest);
  };
  const nm = b => b.name || b.addr || district(b.cx, b.cy);
  switch (key) {
    case 'commute':
    case 'nightshift': {
      dest = workOf(p);
      if (dest)
        act =
          (key === 'nightshift'
            ? 'Heading to the night shift at '
            : p.rural
              ? 'Off to work at '
              : 'Walking to work at ') + nm(dest);
      break;
    }
    case 'home': {
      const from = workOf(p) || randB(hh.cx, hh.cy, 900, b => b.kind === 4 || b.jobs > 0);
      if (from) {
        const e = bEntry(from, GW);
        if (e >= 0) s = e;
      }
      dest = hh;
      act = h >= 21 || h < 5 ? 'Heading home for the night' : 'Heading home';
      break;
    }
    case 'school': {
      dest = randB(hh.cx, hh.cy, 1200, b => /school/.test(b.use) || b.kind === 6);
      act = dest ? 'Walking to ' + nm(dest) : '';
      break;
    }
    case 'schoolhome': {
      const sc = randB(hh.cx, hh.cy, 1200, b => /school/.test(b.use) || b.kind === 6);
      if (sc) {
        const e = bEntry(sc, GW);
        if (e >= 0) s = e;
      }
      dest = hh;
      act = 'Walking home from school';
      break;
    }
    case 'uni':
      goB(
        b => /university|college/.test(b.use),
        3000,
        b => 'Lectures at ' + nm(b)
      );
      if (!dest)
        goB(
          b => b.kind === 6,
          1500,
          b => 'Studying at ' + nm(b)
        );
      break;
    case 'lunch': {
      const wk2 = workOf(p);
      if (wk2) {
        const e = bEntry(wk2, GW);
        if (e >= 0) s = e;
      }
      dest = randB((wk2 || hh).cx, (wk2 || hh).cy, 600, USE_CAFE);
      if (dest) act = 'Lunch at ' + nm(dest);
      break;
    }
    case 'cafe':
      goB(USE_CAFE, 1200, b => 'Coffee at ' + nm(b));
      break;
    case 'dine':
      goB(
        b => /restaurant/.test(b.use),
        1600,
        b => 'Dinner at ' + nm(b)
      );
      break;
    case 'bar':
      goB(USE_BAR, 1400, b => 'A drink at ' + nm(b));
      if (!dest) goB(USE_CAFE, 1200, b => 'Evening at ' + nm(b));
      break;
    case 'party':
      goB(
        b => USE_BAR(b) || b.kind === 4,
        1500,
        b => 'Out on the town (djammið)'
      );
      break;
    case 'errand':
      goB(
        b => b.kind === 4 || /pharmacy|post|bank|library|doctors/.test(b.use),
        1200,
        b => 'Errands at ' + nm(b)
      );
      break;
    case 'shop': {
      const mall = randB(
        hh.cx,
        hh.cy,
        2200,
        b => /mall/.test(b.use) || b.name === 'Kringlan' || b.name === 'Smáralind'
      );
      dest = mall && R() < 0.5 ? mall : randB(hh.cx, hh.cy, 1200, USE_SHOP);
      if (dest) act = (p.stage === 'teen' ? 'Hanging out at ' : 'Shopping at ') + nm(dest);
      break;
    }
    case 'hang': {
      if (R() < 0.5) {
        dest = randB(hh.cx, hh.cy, 1200, b => b.kind === 4 || /fast_food|cinema/.test(b.use));
        if (dest) act = 'Hanging out with friends at ' + nm(dest);
      }
      if (!dest) {
        area = nearArea(hh.cx, hh.cy, 900, [AK.PLAY, AK.PITCH, AK.SCHOOL, AK.PARK]);
        act = 'Hanging out with friends';
      }
      break;
    }
    case 'church':
      goB(
        b => b.kind === 7,
        1600,
        b => 'Sunday service at ' + nm(b)
      );
      break;
    case 'gym':
      goB(
        b => /sports|fitness|gym/.test(b.use),
        1600,
        b => 'Working out at ' + nm(b)
      );
      if (!dest) {
        area = nearArea(hh.cx, hh.cy, 1600, [AK.POOL]);
        act = 'Going to the pool';
      }
      break;
    case 'pool': {
      area = nearArea(hh.cx, hh.cy, 2200, [AK.POOL, AK.WPARK]);
      if (area)
        act =
          (p.stage === 'retired' && h < 9.5 ? 'Morning dip and hot-tub gossip at ' : 'Going for a swim at ') +
          (area.name || 'the pool');
      break;
    }
    case 'play': {
      area = nearArea(hh.cx, hh.cy, 700, [AK.PLAY, AK.SCHOOL]);
      act = 'Off to play';
      break;
    }
    case 'sport': {
      area = nearArea(hh.cx, hh.cy, 1400, [AK.PITCH]);
      act = p.stage === 'adult' ? 'Five-a-side football' : 'Football practice';
      break;
    }
    case 'family':
    case 'schoolrun':
    case 'pickup':
    case 'pram':
      break;
    case 'jog': {
      t = nearestNode(hh.cx + (R() - 0.5) * 1200, hh.cy + (R() - 0.5) * 1200, GW, 250);
      loop = true;
      act =
        h < 5 || h >= 23
          ? 'Running at an odd hour (couldn’t sleep)'
          : p.stage === 'retired'
            ? 'A slow morning jog'
            : 'Out for a run';
      break;
    }
    case 'dog': {
      t = nearestNode(hh.cx + (R() - 0.5) * 900, hh.cy + (R() - 0.5) * 900, GW, 250);
      loop = true;
      act = h < 5 || h >= 23 ? 'Late walk with the dog' : 'Walking the dog';
      break;
    }
    default: {
      t = nearestNode(hh.cx + (R() - 0.5) * 700, hh.cy + (R() - 0.5) * 700, GW, 250);
      loop = true;
      act = 'Taking a stroll';
    }
  }
  // family-type outings with the children
  let kidsN = 0,
    pram = false;
  if (key === 'family' || key === 'schoolrun' || key === 'pickup' || key === 'pram') {
    if (p.stage !== 'adult' && p.stage !== 'retired') {
      a.dead = true;
      return false;
    }
    if (key === 'schoolrun') {
      dest = randB(hh.cx, hh.cy, 1000, b => /school|kindergarten/.test(b.use) || b.kind === 6);
      kidsN = 1 + (R() < 0.4 ? 1 : 0);
      act = dest ? 'Walking the kids to ' + nm(dest) : '';
    } else if (key === 'pickup') {
      const sc = randB(hh.cx, hh.cy, 1000, b => /school|kindergarten/.test(b.use) || b.kind === 6);
      if (sc) {
        const e = bEntry(sc, GW);
        if (e >= 0) s = e;
      }
      dest = hh;
      kidsN = 1 + (R() < 0.4 ? 1 : 0);
      act = 'Picking up the kids';
    } else if (key === 'pram') {
      pram = true;
      t = nearestNode(hh.cx + (R() - 0.5) * 800, hh.cy + (R() - 0.5) * 800, GW, 250);
      loop = true;
      act = 'Out with the baby';
    } else {
      kidsN = 1 + ((R() * 2) | 0);
      pram = p.age < 40 && R() < 0.35;
      area = nearArea(hh.cx, hh.cy, 1500, [AK.PLAY, AK.POOL, AK.PARK]);
      if (area) act = 'Family outing to ' + (area.name || AREA_INFO[area.c][1].toLowerCase());
      else {
        dest = randB(hh.cx, hh.cy, 1200, USE_CAFE);
        act = dest ? 'Family treat at ' + nm(dest) : 'Family walk';
        if (!dest) {
          t = nearestNode(hh.cx + (R() - 0.5) * 700, hh.cy + (R() - 0.5) * 700, GW, 250);
          loop = true;
        }
      }
    }
  }
  if (area) {
    t = nearestNode(area.cx, area.cy, GW, 200);
    a.toArea = area;
  }
  if (dest) {
    t = bEntry(dest, GW);
    a.dest = dest;
  }
  if (t < 0 || (!act && !loop)) {
    return false;
  }
  const path = astar(GW, s, t, 9000);
  if (!path || path.length < 2) return false;
  a.home = hh;
  a.key = key;
  a.act = act || 'Taking a stroll';
  a.path = path;
  a.pi = 0;
  a.loop = loop;
  setPos(a);
  if (pram) {
    a.pram = pickA([
      [30, 30, 34],
      [60, 80, 120],
      [120, 40, 60],
      [150, 150, 150]
    ]);
    a.scooter = a.bike = 0;
    a.sp = 1.1;
  }
  if (kidsN || key === 'family') {
    a.scooter = a.bike = 0;
  }
  a.homeAddr = hh.addr || hh.name || district(hh.cx, hh.cy);
  agents.push(a);
  const follower = (pp, off) => {
    const m = mkAgent('walk', a.x, a.y);
    applyLook(m, pp);
    m.scooter = m.bike = 0;
    m.leader = a;
    m.path = path;
    m.act = a.act;
    m.dest = a.dest;
    m.home = hh;
    m.homeAddr = a.homeAddr;
    m.toArea = a.toArea;
    m.offx = (R() - 0.5) * off;
    m.offy = (R() - 0.5) * off;
    agents.push(m);
    return m;
  };
  const fi = MALE.indexOf(a.name.split(' ')[0]),
    pat = !a.female && fi >= 0 && fi < 15 ? FATHER[fi] : pickA(FATHER);
  for (let i = 0; i < kidsN; i++) {
    const k2 = follower(mkPersona(hh, 6 + ((R() * 7) | 0)), 2);
    k2.name = k2.name.split(' ')[0] + ' ' + pat + (k2.female ? 'dóttir' : 'son');
  }
  if (key === 'family' && R() < 0.6) {
    const sp = follower(mkPersona(hh, Math.max(25, p.age + (((R() * 8) | 0) - 4))), 3);
    sp.act = a.act;
  }
  if (key === 'school' && R() < 0.6) follower(mkPersona(hh, p.age), 2);
  if (key === 'hang') {
    for (let i = 0; i < 1 + ((R() * 3) | 0); i++) follower(mkPersona(hh, p.age + (((R() * 3) | 0) - 1)), 3);
  }
  if (key === 'party' && R() < 0.6)
    for (let i = 0; i < 1 + ((R() * 2) | 0); i++) {
      const m = follower(mkPersona(hh, Math.max(20, p.age + (((R() * 8) | 0) - 4))), 3);
      m.kind = 'party';
    }
  if (key === 'pool' && p.stage === 'retired' && R() < 0.4)
    follower(mkPersona(hh, p.age + (((R() * 6) | 0) - 3)), 2);
  if (key === 'stroll' && p.stage !== 'teen' && R() < 0.3)
    follower(mkPersona(hh, Math.max(18, p.age + (((R() * 8) | 0) - 4))), 2);
  return true;
}
function spawnTourist(x, y, h, aur) {
  const a = mkAgent('tourist', x, y);
  const lms = [];
  nearB(x, y, 1500, b => {
    if (b.sp && b.state === 0) lms.push(b);
  });
  let lm = lms.length ? pickA(lms) : randB(x, y, 600, b => b.kind === 4 || b.kind === 7 || USE_CAFE(b));
  if (!lm) return false;
  const st =
    randB(x, y, 500, b => /hotel|guest|hostel/.test(b.use)) ||
    randB(x, y, 300, b => b.kind === 4 || b.kind === 2);
  if (!st) return false;
  const s = bEntry(st, GW);
  let t = bEntry(lm, GW);
  let act = lm.sp
    ? 'Sightseeing at ' + lm.name
    : USE_CAFE(lm)
      ? 'Trying Icelandic food at ' + (lm.name || 'a café')
      : 'Looking for souvenirs';
  if (aur) {
    t = nearestNode(x + (R() - 0.5) * 1500, y + (R() - 0.5) * 1500, GW, 400);
    act = 'Hunting for the northern lights';
    a.loop = true;
  }
  if (s < 0 || t < 0) return false;
  const path = astar(GW, s, t, 9000);
  if (!path || path.length < 2) return false;
  a.dest = aur ? null : lm;
  a.act = act;
  a.photo = !!lm.sp || aur;
  a.path = path;
  a.pi = 0;
  setPos(a);
  a.home = st;
  a.homeAddr = 'Staying at ' + (st.name || st.addr || district(st.cx, st.cy));
  a.job = 'Tourist from ' + a.from;
  if (SEAS === 'winter' || TEMP < 5) {
    a.coat = pickA(PARKA);
    a.shirt = a.coat;
    a.hat = pickA(HATS);
  } else if (SEAS === 'summer' && R() < 0.3) a.shorts = 1;
  agents.push(a);
  if (R() < 0.6)
    for (let i = 0; i < 1 + ((R() * 3) | 0); i++) {
      const m = mkAgent('tourist', a.x, a.y);
      m.from = a.from;
      m.job = 'Tourist from ' + a.from;
      m.leader = a;
      m.path = path;
      m.act = act;
      m.dest = a.dest;
      m.home = st;
      m.homeAddr = a.homeAddr;
      m.photo = a.photo;
      m.offx = (R() - 0.5) * 3;
      m.offy = (R() - 0.5) * 3;
      if (a.coat) {
        m.coat = pickA(PARKA);
        m.shirt = m.coat;
      }
      agents.push(m);
    }
  return true;
}
function joinZone(a, A) {
  a.toArea = null;
  if (!A || !PROPS_OK) return false;
  if (A.c === AK.POOL || A.c === AK.WPARK) {
    const hot = A.sub === 1 || A.area < 30 || R() < 0.35;
    let r = null;
    for (let q = 0; q < 10 && !r; q++) {
      const u = A.mu + (R() - 0.5) * A.L * 0.9,
        v = A.mv + (R() - 0.5) * A.W * 0.9;
      const p = AU(A, u, v);
      if (pip(A.poly, p[0], p[1])) r = { u, v, x: p[0], y: p[1] };
    }
    if (!r) return false;
    for (const f of agents)
      if (f.leader === a && !f.dead && !f.zone) {
        f.leader = null;
        setTimeout(() => joinZone(f, A), 10);
      }
    a.zone = A;
    a.keep = 1;
    a.zk = hot && (a.age > 55 || R() < 0.5) ? 'soak' : 'swim';
    a.state = 'zone';
    a.lane = r.v;
    a.u = r.u;
    a.dir = R() < 0.5 ? 1 : -1;
    a.sp = 0.5 + R() * 0.5;
    a.x = r.x;
    a.y = r.y;
    a.path = null;
    a.leader = null;
    a.cap =
      R() < 0.4
        ? pickA([
            [230, 60, 60],
            [40, 90, 200],
            [250, 250, 250],
            [30, 30, 34]
          ])
        : null;
    a.act =
      a.zk === 'soak'
        ? 'In the hot tub at ' + (A.name || 'the pool')
        : 'Swimming lengths at ' + (A.name || 'the pool');
    A.ag++;
    ZONES.add(A);
    return true;
  }
  a.zone = A;
  a.keep = 1;
  a.zk = 'play';
  a.state = 'zone';
  a.tx = a.x;
  a.ty = a.y;
  a.zt = 0;
  a.path = null;
  a.leader = null;
  A.ag++;
  ZONES.add(A);
  if (a.act.startsWith('Off to')) a.act = a.age < 13 ? 'Playing at the playground' : 'Hanging out';
  for (const f of agents) if (f.leader === a && !f.dead && !f.zone) joinZone(f, A);
  return true;
}
/* ---------- extra look details in the big sprite ---------- */
function lookExtras(a, r, away, frame, p, X, Y, fr) {
  const dark = C_([30, 26, 26], 1);
  if (a.sign) {
    r(4, 6, 1, 10, C_([120, 90, 60], 1));
    r(2, 15, 5, 4, C_(a.sign, 1));
    r(3, 16, 3, 1, C_([30, 30, 30], 1));
  }
  if (a.bib && !away) {
    r(-1, 6, 3, 2, C_([244, 244, 240], 1));
  }
  if (a.coat) {
    const cc = C_(a.coat, 1),
      cd = C_(a.coat, 0.75);
    r(-2, 3, 5, 2, cc);
    r(-2, 3, 1, 2, cd);
    if (a.puffer) for (const yy of [5, 7, 9]) r(-2, yy, 5, 1, C_(a.coat, 0.88));
  }
  if (a.tie && !away && !a.coat) {
    r(0, 6, 1, 3, C_(a.tie, 1));
    r(-1, 9, 3, 1, C_([236, 236, 232], 1));
  }
  if (a.tie && !away && a.coat) {
    r(0, 8, 1, 2, C_(a.tie, 1));
    r(-1, 9, 1, 1, C_([236, 236, 232], 1));
    r(1, 9, 1, 1, C_([236, 236, 232], 1));
  }
  if (a.hivis) {
    r(-2, 6, 5, 1, C_([236, 220, 40], 1));
    r(-2, 8, 5, 1, C_([236, 220, 40], 1));
  }
  if (a.beard && !away) {
    r(-1, 10, 3, 1, C_(a.hair, 1));
  }
  if (a.glasses && !away) {
    r(0, 11, 2, 1, dark);
  }
  if (a.bald && !a.hat && !a.helmet) {
    r(-1, 13, 3, 1, C_(a.skin, 1));
    r(-1, 12, 1, 1, C_(a.hair, 1));
  }
  if (a.hood && !a.hat) {
    const hc = C_(a.shirt, 0.8);
    r(-2, 10, 1, 3, hc);
    r(-1, 13, 3, 1, hc);
    if (away) r(-1, 10, 3, 3, hc);
  }
  if (a.phones && !a.hat) {
    r(-2, 12, 1, 1, dark);
    r(2, 12, 1, 1, dark);
    r(-1, 14, 3, 1, dark);
  }
  if (a.pom && a.hat) r(0, 15, 1, 1, C_(a.pom, 1));
  if (a.stick) {
    r(4, 0, 1, 7, C_([110, 80, 56], 1));
    r(3, 7, 2, 1, C_([110, 80, 56], 1));
  }
}
function drawPram(a, r, p) {
  const c = C_(a.pram, 1),
    cd = C_(a.pram, 0.7),
    wh = C_([30, 30, 30], 1);
  r(5, 0, 1, 1, wh);
  r(10, 0, 1, 1, wh);
  r(5, 2, 7, 3, c);
  r(6, 1, 5, 1, cd);
  r(8, 5, 4, 2, cd);
  r(9, 7, 3, 1, cd);
  r(3, 7, 2, 1, C_([60, 60, 60], 1));
  r(4, 6, 1, 1, C_([60, 60, 60], 1));
}
function drawRide(a, X, Y, p, fr) {
  // scooter or bicycle under the rider (drawn before the body)
  const px = (gx, gy, w, h, c) => {
    ctx.fillStyle = c;
    const x = fr > 0 ? gx : -(gx + w - 1);
    ctx.fillRect(X + x * p, Y - (gy + h) * p, w * p, h * p);
  };
  if (a.scooter) {
    px(-3, 0, 8, 1, C_([40, 40, 44], 1));
    px(5, 1, 1, 10, C_([60, 60, 64], 1));
    px(4, 11, 3, 1, C_([30, 30, 30], 1));
    px(-3, -1, 1, 1, C_([20, 20, 20], 1));
    px(5, -1, 1, 1, C_([20, 20, 20], 1));
    px(-2, 1, 6, 1, C_([90, 200, 120], 1));
  } else if (a.bike) {
    const c = C_(a.bike, 1),
      t = C_([20, 20, 20], 1);
    ctx.strokeStyle = t;
    ctx.lineWidth = Math.max(1, p * 0.8);
    for (const u of [-5, 6]) {
      ctx.beginPath();
      ctx.arc(X + (fr > 0 ? u : -u) * p, Y - 3 * p, 3 * p, 0, 7);
      ctx.stroke();
    }
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1, p);
    ctx.beginPath();
    ctx.moveTo(X - 5 * fr * p, Y - 3 * p);
    ctx.lineTo(X - 1 * fr * p, Y - 7 * p);
    ctx.lineTo(X + 5 * fr * p, Y - 8 * p);
    ctx.lineTo(X + 6 * fr * p, Y - 3 * p);
    ctx.moveTo(X - 1 * fr * p, Y - 7 * p);
    ctx.lineTo(X + 1 * fr * p, Y - 3 * p);
    ctx.lineTo(X - 5 * fr * p, Y - 3 * p);
    ctx.stroke();
    px(4, 9, 3, 1, t);
  }
}
