/**
 * Animals
 *
 * Species, habitats, spawning and behaviour of animals and birds.
 *
 * Functions: seaNear, habitat, landNear, habTable, habTable0, pickW, okMedium, mkAnimal, spawnAnimals,
 *     stepAnimals, stepFlyer, takeOff, behaveAnimals, anDot, anMainCol, drawAnimal, sel, animalCard
 * State and constants: animals, ANID, anSpawnT, NAMES_A, SPC, ACOL, EAST, WESTF, anN
 */

let animals = [],
  ANID = 1,
  anSpawnT = 0;
const NAMES_A = {
  goat: ['Kolla', 'Hneta', 'Geitla', 'Snotra', 'Mjallhvít'],
  pig: ['Grísla', 'Baldur', 'Bolla', 'Gríslingur'],
  rabbit: ['Snúður', 'Hopp', 'Dúlla'],
  horse: [
    'Sleipnir',
    'Skjóni',
    'Blesi',
    'Gráni',
    'Brúnka',
    'Perla',
    'Hrímfaxi',
    'Glófaxi',
    'Stjarna',
    'Sóti',
    'Toppur',
    'Freyja'
  ],
  sheep: ['Golsa', 'Botna', 'Flekka', 'Hosa', 'Kolla', 'Mókolla', 'Gibba', 'Lukka'],
  cat: ['Brandur', 'Snúlla', 'Kisi', 'Mjása', 'Grettir', 'Lóa'],
  cow: ['Búkolla', 'Huppa', 'Skrauta', 'Rósa', 'Dimma', 'Branda'],
  dog: ['Snati', 'Kátur', 'Lubbi']
};
/* species: is = Icelandic, en = English, mv = movement class, sp = walk speed m/s, sz = drawn size, fact */
const SPC = {
  sheep: {
    is: 'Kind',
    en: 'Icelandic sheep',
    mv: 'graze',
    sp: 0.55,
    fact: 'Short-tailed Nordic breed, here since the settlement. About 400 000 roam free in summer and are rounded up in the September réttir.'
  },
  horse: {
    is: 'Íslenski hesturinn',
    en: 'Icelandic horse',
    mv: 'graze',
    sp: 0.9,
    run: 5.5,
    fact: 'Small but never called a pony. Has the extra gaits tölt and skeið. No horse that leaves Iceland may ever return.'
  },
  cow: {
    is: 'Kýr',
    en: 'Icelandic cattle',
    mv: 'graze',
    sp: 0.45,
    fact: 'A native dairy breed kept pure for over 1 000 years, in every colour from red to brindle.'
  },
  reindeer: {
    is: 'Hreindýr',
    en: 'Reindeer',
    mv: 'graze',
    sp: 0.9,
    run: 7,
    fact: 'Brought from Norway in the 1770s. Today they live wild only in the East.'
  },
  fox: {
    is: 'Melrakki',
    en: 'Arctic fox',
    mv: 'prowl',
    sp: 1.4,
    run: 6,
    fact: "Iceland's only native land mammal. It walked here over the sea ice at the end of the last Ice Age."
  },
  cat: {
    is: 'Köttur',
    en: 'House cat',
    mv: 'prowl',
    sp: 0.8,
    run: 4,
    fact: "Reykjavík's cats roam freely, and many have their own social media fans."
  },
  ptarmigan: {
    is: 'Rjúpa',
    en: 'Rock ptarmigan',
    mv: 'graze',
    sp: 0.35,
    run: 3,
    fact: 'Turns white for winter. A traditional Christmas dinner in many Icelandic homes.'
  },
  plover: {
    is: 'Heiðlóa',
    en: 'Golden plover',
    mv: 'graze',
    sp: 0.6,
    run: 3,
    fact: 'Its arrival in spring is front-page news: "Lóan er komin!"'
  },
  oyster: {
    is: 'Tjaldur',
    en: 'Oystercatcher',
    mv: 'graze',
    sp: 0.5,
    run: 3,
    fact: 'Loud black-and-white shorebird with an orange bill.'
  },
  thrush: {
    is: 'Skógarþröstur',
    en: 'Redwing',
    mv: 'graze',
    sp: 0.5,
    run: 3,
    fact: "The most common songbird in Reykjavík's gardens."
  },
  goose: {
    is: 'Grágæs',
    en: 'Greylag goose',
    mv: 'graze',
    sp: 0.4,
    run: 2,
    swim: true,
    fact: 'Grazes hayfields in big flocks before flying south to Scotland.'
  },
  duck: {
    is: 'Stokkönd',
    en: 'Mallard',
    mv: 'swim',
    sp: 0.35,
    fact: 'Tjörnin in Reykjavík has been fed bread by generations of children.'
  },
  swan: {
    is: 'Álft',
    en: 'Whooper swan',
    mv: 'swim',
    sp: 0.3,
    fact: "Iceland's largest bird. Most spend the winter in Britain and Ireland."
  },
  eider: {
    is: 'Æðarfugl',
    en: 'Common eider',
    mv: 'swim',
    sp: 0.3,
    fact: 'Farmers collect its down from nests — the finest duvet filling in the world.'
  },
  gull: {
    is: 'Mávur',
    en: 'Herring gull',
    mv: 'fly',
    sp: 7,
    fact: 'Bold scavengers of every harbour and pond.'
  },
  raven: {
    is: 'Hrafn',
    en: 'Common raven',
    mv: 'fly',
    sp: 6,
    fact: "Óðinn's birds Huginn and Muninn were ravens. They stay through the winter."
  },
  puffin: {
    is: 'Lundi',
    en: 'Atlantic puffin',
    mv: 'fly',
    sp: 10,
    fact: "Around half of the world's puffins nest in Iceland's sea cliffs."
  },
  fulmar: {
    is: 'Fýll',
    en: 'Northern fulmar',
    mv: 'fly',
    sp: 8,
    fact: 'Glides along the cliffs on stiff wings and spits stomach oil at intruders.'
  },
  goat: {
    is: 'Geit',
    en: 'Icelandic goat',
    mv: 'graze',
    sp: 0.55,
    run: 3.5,
    fact: 'The settlement goat (landnámsgeit) came with the Vikings and is now rare: only a small herd of a couple of thousand survives, most of it on a few farms.'
  },
  pig: {
    is: 'Svín',
    en: 'Pig',
    mv: 'graze',
    sp: 0.4,
    run: 2.5,
    fact: 'The settlers kept pigs, and many place names still remember them, like Svínadalur and Galtafell.'
  },
  hen: {
    is: 'Landnámshæna',
    en: 'Icelandic hen',
    mv: 'graze',
    sp: 0.45,
    run: 2.5,
    fact: 'The settlement hen has lived here for over 1 000 years. No two look the same, with every colour and pattern of feathers.'
  },
  rabbit: {
    is: 'Kanína',
    en: 'Rabbit',
    mv: 'graze',
    sp: 0.5,
    run: 4,
    fact: 'Pet rabbits set free in Elliðaárdalur and Öskjuhlíð now live wild in Reykjavík.'
  },
  mink: {
    is: 'Minkur',
    en: 'American mink',
    mv: 'prowl',
    sp: 1.1,
    run: 4,
    fact: 'Brought for fur farming in the 1930s. Escaped mink now live wild along rivers and coasts all over the country.'
  },
  seal: {
    is: 'Selur',
    en: 'Harbour seal',
    mv: 'seal',
    sp: 0.8,
    fact: 'Hauls out on black-sand beaches and skerries to rest.'
  },
  whale: {
    is: 'Hrefna',
    en: 'Minke whale',
    mv: 'whale',
    sp: 2.2,
    fact: 'The whale you are most likely to see on a trip out of Reykjavík or Húsavík.'
  }
};
const ACOL = {
  sheep: [
    [236, 232, 220],
    [236, 232, 220],
    [236, 232, 220],
    [48, 44, 44],
    [120, 84, 58],
    [150, 148, 144]
  ],
  horse: [
    [150, 82, 40],
    [104, 62, 40],
    [44, 38, 36],
    [196, 194, 186],
    [214, 176, 108],
    [150, 82, 40]
  ],
  cow: [
    [150, 70, 40],
    [90, 58, 44],
    [40, 36, 34],
    [180, 110, 70]
  ],
  goat: [
    [236, 232, 222],
    [120, 84, 58],
    [44, 40, 38],
    [170, 150, 120],
    [200, 190, 170]
  ],
  pig: [
    [236, 180, 170],
    [226, 170, 160],
    [120, 96, 84]
  ],
  hen: [
    [180, 110, 60],
    [236, 232, 220],
    [60, 50, 44],
    [150, 140, 120],
    [200, 150, 80]
  ],
  rabbit: [
    [240, 238, 232],
    [150, 120, 90],
    [100, 96, 92],
    [60, 52, 48]
  ],
  mink: [
    [58, 40, 32],
    [70, 50, 40]
  ],
  cat: [
    [120, 120, 120],
    [210, 130, 60],
    [36, 34, 36],
    [230, 226, 220]
  ],
  fox: [
    [234, 232, 226],
    [96, 86, 78]
  ]
};
function seaNear(x, y, r) {
  for (let q = 0; q < 8; q++) {
    const a = (q * Math.PI) / 4;
    const c = cellAt(x + Math.cos(a) * r, y + Math.sin(a) * r);
    if (c >= 0 && gTfast(c) === SEA) return true;
  }
  return false;
}
function habitat(x, y) {
  const c = cellAt(x, y);
  if (c < 0) return null;
  const t = gTfast(c);
  if (t === SEA) return landNear(x, y, 120) ? 'shore' : 'sea';
  if (t === LAKE || t === RIVER) return 'fresh';
  if (t === GLACIER || t === LAVA || t === RUBBLE || t === RUNWAY) return null;
  let n150 = 0,
    n700 = 0,
    n40 = 0;
  nearB(x, y, 700, b => {
    if (b.state > 1) return;
    const d = Math.hypot(b.cx - x, b.cy - y);
    n700++;
    if (d < 150) n150++;
    if (d < 40 + b.r) n40++;
  });
  if (n150 >= 5 || t === PAVED || t === PIER || t === URBAN) return n40 ? null : 'town';
  if (n40) return null;
  const z = hAt(x, y);
  if (t === SAND && seaNear(x, y, 70)) return 'beach';
  if (z > 18 && seaNear(x, y, 70)) return 'cliff';
  if (z >= 330 || t === HIGH) return 'high';
  if (t === PARK || t === CEM || t === GOLF || t === PITCH) return n700 > 3 ? 'town' : 'farm';
  if (t === HAY) return 'farm';
  if (n700 >= 1 && n700 < 40 && (t === GRASS || t === SCRUB || t === WET || t === WOOD)) return 'farm';
  return 'wild';
}
function landNear(x, y, r) {
  for (let q = 0; q < 8; q++) {
    const a = (q * Math.PI) / 4;
    const c = cellAt(x + Math.cos(a) * r, y + Math.sin(a) * r);
    if (c >= 0 && !isWaterT(gTfast(c))) return true;
  }
  return false;
}
const EAST = (x, y) => x > 290000 && y > -170000 && y < -40000,
  WESTF = (x, y) => x < -40000 && y < -150000;
function habTable(h, x, y) {
  const T = habTable0(h, x, y);
  const S = SEAS;
  return T.filter(
    e =>
      !(e[1] === 'puffin' && (S === 'winter' || S === 'autumn')) &&
      !(e[1] === 'sheep' && h === 'high' && S !== 'summer') &&
      !(e[1] === 'plover' && S === 'winter') &&
      !(e[1] === 'goose' && S === 'winter' && R() < 0.7) &&
      !(e[1] === 'oyster' && S === 'winter')
  );
}
function habTable0(h, x, y) {
  switch (h) {
    case 'sea':
      return [
        [0.35, 'gull', 1, 3],
        [0.2, 'eider', 3, 7],
        [0.25, 'whale', 1, 1],
        [0.1, 'puffin', 2, 5],
        [0.1, 'fulmar', 1, 3]
      ];
    case 'shore':
      return [
        [0.4, 'eider', 3, 9],
        [0.3, 'gull', 2, 5],
        [0.15, 'seal', 1, 3],
        [0.08, 'duck', 2, 4],
        [0.07, 'puffin', 2, 5]
      ];
    case 'fresh':
      return [
        [0.35, 'duck', 2, 6],
        [0.3, 'swan', 2, 4],
        [0.25, 'goose', 4, 10],
        [0.1, 'gull', 1, 3]
      ];
    case 'town':
      return [
        [0.32, 'cat', 1, 1],
        [0.28, 'gull', 2, 4],
        [0.15, 'raven', 1, 2],
        [0.25, 'thrush', 1, 3]
      ];
    case 'beach':
      return [
        [0.45, 'seal', 2, 6],
        [0.2, 'eider', 3, 6],
        [0.2, 'gull', 2, 4],
        [0.15, 'oyster', 2, 4]
      ];
    case 'cliff':
      return [
        [0.45, 'puffin', 5, 12],
        [0.35, 'fulmar', 2, 5],
        [0.1, 'raven', 1, 2],
        [0.1, 'gull', 2, 4]
      ];
    case 'farm':
      return [
        [0.36, 'sheep', 5, 14],
        [0.3, 'horse', 4, 10],
        [0.12, 'cow', 3, 8],
        [0.1, 'goose', 6, 16],
        [0.05, 'raven', 1, 2],
        [0.07, 'plover', 2, 4]
      ];
    case 'high':
      return EAST(x, y)
        ? [
            [0.45, 'reindeer', 5, 14],
            [0.2, 'sheep', 2, 5],
            [0.1, 'fox', 1, 1],
            [0.1, 'raven', 1, 2],
            [0.15, 'ptarmigan', 2, 6]
          ]
        : [
            [0.35, 'sheep', 2, 5],
            [0.15, 'fox', 1, 1],
            [0.2, 'raven', 1, 2],
            [0.2, 'ptarmigan', 2, 6],
            [0.1, 'plover', 2, 4]
          ];
    default:
      return [
        [0.24, 'sheep', 3, 8],
        [0.2, 'horse', 4, 12],
        [0.12, 'ptarmigan', 2, 5],
        [WESTF(x, y) ? 0.3 : 0.07, 'fox', 1, 1],
        [0.12, 'raven', 1, 2],
        [0.12, 'plover', 2, 5],
        [0.1, 'goose', 5, 12]
      ].concat(EAST(x, y) ? [[0.3, 'reindeer', 4, 10]] : []);
  }
}
function pickW(tab) {
  let s = 0;
  for (const e of tab) s += e[0];
  let r = R() * s;
  for (const e of tab) {
    r -= e[0];
    if (r <= 0) return e;
  }
  return tab[0];
}
function okMedium(a, x, y) {
  if (a.pen)
    return a.water
      ? inPool(a.pen, x, y, 0)
      : inPen(a.pen, x, y, 0.5) && (a.sp === 'seal' || !inPool(a.pen, x, y, -0.3));
  const c = cellAt(x, y);
  if (c < 0) return false;
  const t = gTfast(c);
  if (t === LAVA || t === GLACIER) return false;
  if (a.water) return t === SEA || ((t === LAKE || t === RIVER) && a.sp !== 'whale');
  if (isWaterT(t)) return false;
  if (a.sp === 'cat' || a.sp === 'thrush') return true;
  return !bldAtCell(c);
}
function mkAnimal(sp, x, y, water, lead) {
  const S = SPC[sp];
  const a = {
    animal: true,
    id: ANID++,
    sp,
    x,
    y,
    vx: 0,
    vy: 0,
    hx: x,
    hy: y,
    water,
    state: 'rest',
    t: R() * 4,
    lead,
    offx: 0,
    offy: 0,
    phase: R() * 6,
    face: R() < 0.5 ? 1 : -1,
    z: 0,
    fly: false
  };
  const pal = ACOL[sp];
  if (pal) {
    a.col = pickA(pal);
    if (sp === 'horse') {
      a.mane = a.col[0] > 190 ? [236, 230, 214] : a.col[0] < 60 ? a.col : [40, 32, 30];
      a.spot = R() < 0.15;
    }
    if (sp === 'sheep') {
      a.face2 = a.col[0] > 200 && R() < 0.4 ? [50, 44, 42] : a.col;
      a.horns = R() < 0.3;
    }
    if (sp === 'cow') a.spot = R() < 0.45;
    if (sp === 'fox')
      a.col =
        SEAS === 'winter'
          ? R() < 0.85
            ? ACOL.fox[0]
            : ACOL.fox[1]
          : SEAS === 'summer'
            ? R() < 0.8
              ? [120, 98, 72]
              : ACOL.fox[1]
            : R() < 0.5
              ? ACOL.fox[0]
              : ACOL.fox[1];
  }
  if (sp === 'duck' || sp === 'eider') a.male = R() < 0.5;
  if (sp === 'reindeer') a.ant = R() < 0.7;
  if (sp === 'sheep') a.lamb = R() < 0.25;
  const nm = NAMES_A[sp];
  a.name = nm ? pickA(nm) : S.is;
  if (sp === 'cow' && lead) a.name = pickA(nm);
  if (S.mv === 'fly') {
    a.fly = (!water && R() < 0.6) || (sp !== 'raven' && R() < 0.5);
    a.z = a.fly ? 14 + R() * 30 : 0;
    a.r = 20 + R() * 60;
    a.ang = R() * 6.3;
    a.state = a.fly ? 'fly' : 'stand';
    a.t = 4 + R() * 12;
  }
  if (sp === 'whale') {
    a.state = 'under';
    a.t = 3 + R() * 8;
    a.hd = R() * 6.3;
  }
  if (sp === 'seal') {
    a.state = water ? 'swim' : 'rest';
    a.t = 5 + R() * 20;
  }
  return a;
}
function spawnAnimals(vr) {
  if (time < anSpawnT) return;
  anSpawnT = time + 0.5;
  zooSpawn(vr);
  for (const a of animals) {
    if (a.dead || a === follow) continue;
    if (a.keepA) {
      if (a.x < vr[0] - 3000 || a.x > vr[2] + 3000 || a.y < vr[1] - 3000 || a.y > vr[3] + 3000) a.dead = true;
      continue;
    }
    if (a.pen) {
      if (a.x < vr[0] - 1200 || a.x > vr[2] + 1200 || a.y < vr[1] - 1200 || a.y > vr[3] + 1200) {
        a.dead = true;
        a.pen.live = false;
      }
      continue;
    }
    if (a.x < vr[0] - 250 || a.x > vr[2] + 250 || a.y < vr[1] - 250 || a.y > vr[3] + 250) a.dead = true;
  }
  const area = ((vr[2] - vr[0]) * (vr[3] - vr[1])) / 1e6;
  const want = Math.min(240, Math.round(30 + area * 26));
  let n = 0;
  for (const a of animals) if (!a.dead) n++;
  const budget = performance.now() + 4;
  for (let q = 0; q < 10 && n < want && performance.now() < budget; q++) {
    const x = vr[0] + R() * (vr[2] - vr[0]),
      y = vr[1] + R() * (vr[3] - vr[1]);
    let near = false;
    for (const a of animals)
      if (!a.dead && Math.abs(a.hx - x) < 90 && Math.abs(a.hy - y) < 90) {
        near = true;
        break;
      }
    if (near) continue;
    const h = habitat(x, y);
    if (!h) continue;
    if (R() > (h === 'town' ? 0.5 : h === 'sea' ? 0.35 : 1)) continue;
    const e = pickW(habTable(h, x, y));
    const sp = e[1];
    const water = h === 'sea' || h === 'shore' || h === 'fresh';
    if (sp === 'whale' && (depthAt(x, y) > -15 || landNear(x, y, 300))) continue;
    const cnt = e[2] + Math.floor(R() * (e[3] - e[2] + 1));
    let lead = null;
    const spread = sp === 'horse' || sp === 'reindeer' ? 14 : sp === 'puffin' ? 18 : 8;
    for (let i = 0; i < cnt; i++) {
      const ax = x + (i ? (R() - 0.5) * spread * 2 : 0),
        ay = y + (i ? (R() - 0.5) * spread * 2 : 0);
      const a = mkAnimal(sp, ax, ay, water, lead);
      if (!okMedium(a, ax, ay) && !a.fly) {
        if (!i) break;
        continue;
      }
      if (lead) {
        a.offx = ax - x;
        a.offy = ay - y;
        if (sp === 'sheep' && R() < 0.4) a.lamb = true;
      } else lead = a;
      animals.push(a);
      n++;
    }
  }
}

function stepAnimals(dt) {
  const night2 = night;
  for (const a of animals) {
    if (a.dead) continue;
    const S = SPC[a.sp];
    a.phase += dt * (a.run ? 14 : 6);
    if (a.fleeT > 0) a.fleeT -= dt;
    else a.run = false;
    if (S.mv === 'fly') {
      stepFlyer(a, dt, S);
      continue;
    }
    if (S.mv === 'whale') {
      a.t -= dt;
      const sp = a.state === 'surf' ? 1.2 : S.sp * (a.run ? 3 : 1);
      const nx = a.x + Math.cos(a.hd) * sp * dt,
        ny = a.y + Math.sin(a.hd) * sp * dt;
      if (okMedium(a, nx, ny) && depthAt(nx, ny) < -8) {
        a.vx = Math.cos(a.hd) * sp;
        a.vy = Math.sin(a.hd) * sp;
        a.x = nx;
        a.y = ny;
      } else a.hd += 1.4 + R();
      a.hd += (R() - 0.5) * dt * 0.2;
      if (a.t <= 0) {
        if (a.state === 'under') {
          a.state = 'surf';
          a.t = 4 + R() * 3;
          a.spout = 1;
          for (let q = 0; q < 16; q++)
            addP({
              t: 6,
              x: a.x,
              y: a.y,
              z: 1,
              vx: (R() - 0.5) * 1.5,
              vy: (R() - 0.5) * 1.5,
              vz: 7 + R() * 4,
              life: 1.3,
              max: 1.6,
              c: [230, 240, 250],
              s: 1
            });
        } else {
          a.state = 'under';
          a.t = 8 + R() * 25;
        }
      }
      continue;
    }
    if (S.mv === 'seal' && a.state === 'rest' && !a.pen) {
      a.t -= dt;
      if (a.t <= 0) {
        a.t = 4 + R() * 20;
        a.flip = 1;
      }
      if (a.flip > 0) a.flip -= dt;
      if (!a.run) continue;
    }
    // grazers, prowlers, swimmers
    const L = a.lead && !a.lead.dead ? a.lead : null;
    if (a.state === 'rest' || a.state === 'graze') {
      a.t -= dt;
      if (L && !a.run) {
        const d = Math.hypot(L.x + a.offx - a.x, L.y + a.offy - a.y);
        if (d > (S.mv === 'swim' ? 4 : 6) + Math.hypot(a.offx, a.offy) * 0.25) {
          a.state = 'walk';
          a.tx = L.x + a.offx + (R() - 0.5) * 3;
          a.ty = L.y + a.offy + (R() - 0.5) * 3;
        }
      } else if (a.t <= 0) {
        const far = L
          ? 4
          : a.sp === 'horse' || a.sp === 'reindeer'
            ? 40
            : a.sp === 'cat'
              ? 25
              : a.water
                ? 30
                : 20;
        const ang = R() * 6.3,
          d = far * (0.3 + R());
        let tx = a.x + Math.cos(ang) * d,
          ty = a.y + Math.sin(ang) * d;
        if (Math.hypot(tx - a.hx, ty - a.hy) > far * 3) {
          tx = a.hx + (R() - 0.5) * far;
          ty = a.hy + (R() - 0.5) * far;
        }
        if (a.pen) {
          const q = penPt(a.pen, a.water);
          tx = q[0];
          ty = q[1];
        }
        a.tx = tx;
        a.ty = ty;
        a.state = 'walk';
        if (a.sp === 'horse' && !L && R() < 0.12 && !night2) {
          a.gallop = 6;
        }
      }
      a.vx *= 0.8;
      a.vy *= 0.8;
      continue;
    }
    if (a.state === 'walk') {
      let sp =
        S.sp *
        (a.run ? (S.run || 2.5) / S.sp : 1) *
        (L && !a.run && Math.hypot(L.x - a.x, L.y - a.y) > 12 ? 1.8 : 1);
      if (a.gallop > 0) {
        a.gallop -= dt;
        sp = S.run || sp;
      }
      if (L && L.gallop > 0 && !a.run) {
        sp = S.run || sp;
        a.tx = L.x + a.offx;
        a.ty = L.y + a.offy;
      }
      const dx = a.tx - a.x,
        dy = a.ty - a.y,
        d = Math.hypot(dx, dy);
      if (d < 0.4) {
        a.state = a.water ? 'rest' : (a.mvc = R()) < 0.75 ? 'graze' : 'rest';
        a.t = night2 && !a.water ? 8 + R() * 20 : 2 + R() * (a.sp === 'sheep' || a.sp === 'cow' ? 14 : 8);
        continue;
      }
      const nx = a.x + (dx / d) * sp * dt,
        ny = a.y + (dy / d) * sp * dt;
      if (okMedium(a, nx, ny)) {
        a.x = nx;
        a.y = ny;
        a.vx = (dx / d) * sp;
        a.vy = (dy / d) * sp;
      } else {
        a.state = 'rest';
        a.t = 0.5 + R() * 2;
        a.vx = a.vy = 0;
        if (a.run) {
          const an = Math.atan2(dy, dx) + (R() < 0.5 ? 1.6 : -1.6);
          a.tx = a.x + Math.cos(an) * 20;
          a.ty = a.y + Math.sin(an) * 20;
          a.state = 'walk';
        }
      }
    }
  }
  if (++anN % 40 === 0) animals = animals.filter(a => !a.dead || a === follow);
}
let anN = 0;
function stepFlyer(a, dt, S) {
  a.t -= dt;
  if (a.state === 'fly') {
    const L = a.lead && !a.lead.dead && a.lead.state === 'fly' ? a.lead : null;
    if (L && a.sp !== 'raven') {
      const tx = L.x + a.offx * 0.6,
        ty = L.y + a.offy * 0.6;
      const dx = tx - a.x,
        dy = ty - a.y,
        d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(S.sp * 1.4, d * 1.5 + S.sp * 0.6);
      a.vx += ((dx / d) * sp - a.vx) * Math.min(1, dt * 2);
      a.vy += ((dy / d) * sp - a.vy) * Math.min(1, dt * 2);
      a.z += (L.z + a.offy * 0.1 - a.z) * dt;
    } else {
      const w = (S.sp / a.r) * (a.id % 2 ? 1 : -1);
      a.ang += w * dt;
      if (a.run) {
        a.hx += a.fx * dt * S.sp;
        a.hy += a.fy * dt * S.sp;
      }
      const tx = a.hx + Math.cos(a.ang) * a.r,
        ty = a.hy + Math.sin(a.ang) * a.r;
      const dx = tx - a.x,
        dy = ty - a.y;
      a.vx += (dx * 1.2 - a.vx) * Math.min(1, dt * 2);
      a.vy += (dy * 1.2 - a.vy) * Math.min(1, dt * 2);
      const g = hAt(a.x, a.y);
      a.z += ((a.tz || 24) + g - a.z) * dt * 0.4;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    const g = hAt(a.x, a.y);
    if (a.z < g + 6) a.z = g + 6;
    if (a.t <= 0 && !a.run && !(L && a.sp !== 'raven')) {
      if (night || R() < 0.5) {
        // land
        const c = cellAt(a.x, a.y);
        if (c >= 0) {
          const t = gTfast(c);
          if (!bldAtCell(c) && t !== LAVA && t !== GLACIER) {
            a.state = 'land';
            a.t = 6;
          } else a.t = 3;
        }
      } else {
        a.t = 6 + R() * 12;
        a.tz = 14 + R() * 40;
      }
    }
    return;
  }
  if (a.state === 'land') {
    a.vx *= 0.96;
    a.vy *= 0.96;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    const g = hAt(a.x, a.y);
    a.z -= Math.max(2, (a.z - g) * 0.9) * dt;
    if (a.z <= g + 0.05) {
      a.z = g;
      a.state = 'stand';
      a.fly = false;
      a.t = 6 + R() * 20;
      const c = cellAt(a.x, a.y);
      a.water = c >= 0 && isWaterT(gTfast(c));
      for (const o of animals)
        if (o.lead === a && o.state === 'fly') {
          o.state = 'land';
        }
    }
    return;
  }
  // standing / swimming
  a.vx = a.vy = 0;
  const g = hAt(a.x, a.y);
  a.z = g;
  if (a.water && R() < dt * 0.3) {
    a.x += (R() - 0.5) * 0.6;
    a.y += (R() - 0.5) * 0.6;
  } else if (!a.water && R() < dt * 0.25) {
    const nx = a.x + (R() - 0.5) * 1.6,
      ny = a.y + (R() - 0.5) * 1.6;
    const c = cellAt(nx, ny);
    if (c >= 0 && !isWaterT(gTfast(c))) {
      a.vx = nx - a.x;
      a.vy = ny - a.y;
      a.x = nx;
      a.y = ny;
      a.hop = 0.25;
    }
  }
  if (a.hop > 0) a.hop -= dt;
  if ((a.t <= 0 && !night) || a.run) {
    takeOff(a);
    for (const o of animals) if (o.lead === a && !o.fly) takeOff(o, true);
  }
}
function takeOff(a, late) {
  a.state = 'fly';
  a.fly = true;
  a.water = false;
  a.t = 8 + R() * 14;
  a.tz = 16 + R() * 30;
  a.hx = a.x + (R() - 0.5) * 80;
  a.hy = a.y + (R() - 0.5) * 80;
  a.ang = R() * 6.3;
  a.z = hAt(a.x, a.y) + 0.5;
  if (late) a.t += R() * 2;
}
function behaveAnimals() {
  if (!animals.length) return;
  for (const a of animals) {
    if (a.dead) continue;
    const c = cellAt(a.x, a.y);
    if (c >= 0 && !a.fly) {
      const t = gTfast(c);
      if (t === LAVA) {
        killA(a);
        continue;
      }
    }
    if (!a.fly && flood > 0 && !a.water && hAt(a.x, a.y) < flood - 0.5 && SPC[a.sp].mv !== 'swim') {
      if (SPC[a.sp].mv === 'fly') takeOff(a);
    }
    for (const hz of hazards) {
      const d = Math.hypot(a.x - hz.x, a.y - hz.y);
      if (d > hz.r * 1.3 + 40) continue;
      const S = SPC[a.sp];
      a.run = true;
      a.fleeT = 6 + R() * 4;
      const dx = a.x - hz.x,
        dy = a.y - hz.y,
        L = Math.hypot(dx, dy) || 1;
      if (S.mv === 'fly') {
        if (!a.fly) takeOff(a);
        a.fx = dx / L;
        a.fy = dy / L;
        a.tz = 40;
      } else if (S.mv === 'whale') {
        a.state = 'under';
        a.t = 20;
        a.hd = Math.atan2(dy, dx);
      } else {
        if (a.sp === 'seal' && !a.water) {
          a.state = 'walk';
        }
        a.state = 'walk';
        a.tx = a.x + (dx / L) * (hz.r + 80);
        a.ty = a.y + (dy / L) * (hz.r + 80);
        a.hx = a.tx;
        a.hy = a.ty;
      }
      break;
    }
  }
}

/* ---- drawing ---- */
function anDot(a) {
  const s = sp_(a.x, a.y, a.z || hAt(a.x, a.y));
  if (SPC[a.sp].mv === 'whale' && a.state !== 'surf') return;
  ctx.fillStyle = C_(anMainCol(a), 1);
  ctx.fillRect(Math.round(s[0]), Math.round(s[1]) - 1, 1, 1);
}
function anMainCol(a) {
  switch (a.sp) {
    case 'gull':
    case 'swan':
    case 'fulmar':
      return [240, 240, 236];
    case 'raven':
      return [24, 22, 26];
    case 'puffin':
      return [30, 30, 34];
    case 'eider':
      return a.male ? [236, 236, 226] : [120, 90, 60];
    case 'duck':
      return [110, 96, 70];
    case 'goose':
      return [130, 124, 112];
    case 'seal':
      return [110, 108, 100];
    case 'whale':
      return [40, 44, 52];
    case 'pig':
    case 'goat':
    case 'hen':
    case 'rabbit':
    case 'mink':
      return a.col || [200, 200, 200];
    case 'ptarmigan':
      return SEAS === 'winter' || snowAcc > 0.2 ? [244, 244, 240] : [150, 128, 96];
    case 'plover':
      return [150, 130, 70];
    case 'oyster':
      return [30, 30, 30];
    case 'thrush':
      return [110, 90, 60];
    case 'reindeer':
      return [120, 104, 86];
    default:
      return a.col || [200, 200, 200];
  }
}
function drawAnimal(a) {
  const k = K;
  const g = a.fly ? hAt(a.x, a.y) : 0;
  const z = a.fly ? a.z : hAt(a.x, a.y);
  const sx = PXw(a.x, a.y) * k - cx0,
    sy = (PYw(a.x, a.y) - z) * k - cy0;
  if (sx < -60 || sx > VW + 60 || sy < -60 || sy > VH + 60) return;
  const Hh = k * 3.8;
  if (Hh < 3.2) {
    anDot(a);
    return;
  }
  const p = Hh >= 11 ? Math.max(1, Math.round(Hh / 14)) : Hh / 14;
  let svx = a.vx * SXx + a.vy * SXy;
  if (Math.abs(svx) > 0.05) a.face = svx > 0 ? 1 : -1;
  const fr = a.face || 1;
  const X = Math.round(sx),
    Y = Math.round(sy);
  const r = (gx, gy, w, h, c) => {
    ctx.fillStyle = c;
    const cx = fr > 0 ? gx : -(gx + w - 1);
    const x0 = Math.round(cx * p),
      x1 = Math.round((cx + w) * p),
      y0 = Math.round(gy * p),
      y1 = Math.round((gy + h) * p);
    ctx.fillRect(X + x0, Y - y1, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  };
  const C1 = (c, m) => C_(c, m || 1);
  const moving = Math.hypot(a.vx, a.vy) > 0.15,
    fA = moving ? (Math.sin(a.phase) > 0 ? 1 : 0) : 2;
  const shadow = w => {
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    const ww = Math.max(2, Math.round(w * p));
    ctx.fillRect(X - (ww >> 1), Y - Math.max(1, Math.round(p)), ww, Math.max(1, Math.round(p)));
  };
  if (a.fly) {
    // shadow on ground, then bird in the air
    const gs = sp_(a.x, a.y, g);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(
      Math.round(gs[0]) - Math.round(2 * p),
      Math.round(gs[1]),
      Math.max(1, Math.round(4 * p)),
      Math.max(1, Math.round(p))
    );
    const flap = Math.sin(a.phase * (a.sp === 'puffin' ? 3 : a.sp === 'fulmar' ? 0.5 : 1.4));
    const up = flap > 0.3 ? 1 : flap < -0.3 ? -1 : 0;
    const body = anMainCol(a),
      wing = a.sp === 'gull' ? [160, 170, 180] : a.sp === 'fulmar' ? [170, 174, 180] : body,
      tip = a.sp === 'gull' ? [30, 30, 30] : wing;
    r(-2, 0, 5, 1, C1(body));
    r(3, 0, 1, 1, C1(a.sp === 'puffin' ? [230, 110, 40] : a.sp === 'raven' ? [24, 22, 26] : [230, 190, 60]));
    if (a.sp === 'puffin') r(-1, 0, 3, 1, C1([236, 236, 230]));
    r(-1, 1 + up, 1, 1, C1(wing));
    r(0, 1 + up * 2, 1, 1, C1(wing));
    r(-2, 1 + up * 2, 1, 1, C1(tip));
    if (up === 0) {
      r(-4, 1, 3, 1, C1(wing));
      r(1, 1, 3, 1, C1(wing));
      r(-5, 1, 1, 1, C1(tip));
      r(4, 1, 1, 1, C1(tip));
    } else {
      r(1, 1 + up, 1, 1, C1(wing));
      r(2, 1 + up * 2, 1, 1, C1(tip));
    }
    sel(a, X, Y, p, 6, 4);
    return;
  }
  const water = a.water,
    wl = water ? C1([200, 220, 236], 0.9) : null;
  switch (a.sp) {
    case 'sheep': {
      const w = C1(a.col),
        wd = C1(a.col, 0.8),
        f = C1(a.face2 || a.col, a.face2 && a.face2 !== a.col ? 1 : 0.7),
        leg = C1([60, 52, 48]);
      const s = a.lamb ? 0.65 : 1;
      const q = (gx, gy, w2, h2, c) =>
        r(
          Math.round(gx * s),
          Math.round(gy * s),
          Math.max(1, Math.round(w2 * s)),
          Math.max(1, Math.round(h2 * s)),
          c
        );
      shadow(9 * s);
      const gz = a.state === 'graze';
      if (fA === 1) {
        q(-3, 0, 1, 3, leg);
        q(3, 0, 1, 3, leg);
        q(-2, 1, 1, 2, leg);
        q(2, 1, 1, 2, leg);
      } else if (fA === 0) {
        q(-2, 0, 1, 3, leg);
        q(2, 0, 1, 3, leg);
        q(-3, 1, 1, 2, leg);
        q(3, 1, 1, 2, leg);
      } else {
        q(-3, 0, 1, 3, leg);
        q(-2, 0, 1, 3, leg);
        q(2, 0, 1, 3, leg);
        q(3, 0, 1, 3, leg);
      }
      q(-4, 3, 8, 4, w);
      q(-4, 3, 8, 1, wd);
      q(-5, 5, 1, 1, wd);
      if (gz) {
        q(4, 2, 2, 3, f);
        q(5, 1, 1, 1, f);
      } else {
        q(4, 5, 2, 3, f);
        q(6, 6, 1, 1, f);
        q(4, 8, 1, 1, f);
        if (!water) q(5, 6, 1, 1, C1([24, 22, 22]));
      }
      if (a.horns && !a.lamb) q(3, 7, 1, 2, C1([200, 186, 150]));
      break;
    }
    case 'horse': {
      const c = C1(a.col),
        cd = C1(a.col, 0.78),
        m = C1(a.mane),
        leg = C1(a.col, 0.7),
        hoof = C1([34, 30, 28]);
      shadow(15);
      const gz = a.state === 'graze',
        run = moving && (a.run || a.gallop > 0 || Math.hypot(a.vx, a.vy) > 2.5);
      const lg = (gx, ph) => {
        const o = fA === 2 ? 0 : (fA === ph ? 1 : -1) * (run ? 2 : 1);
        r(gx + o, 0, 1, 1, hoof);
        r(gx + (o > 0 ? 1 : 0) * Math.sign(o), 1, 1, 2, leg);
        r(gx, 3, 2, 4, leg);
      };
      lg(-6, 0);
      lg(-4, 1);
      lg(3, 0);
      lg(5, 1);
      r(-7, 7, 13, 5, c);
      r(-7, 7, 13, 1, cd);
      if (a.spot) {
        r(-4, 8, 4, 3, C1([236, 232, 226]));
        r(2, 9, 2, 2, C1([236, 232, 226]));
      }
      r(-9, 5, 2, 6, m);
      r(-8, 10, 1, 2, m);
      if (gz) {
        r(6, 4, 2, 7, c);
        r(7, 1, 3, 4, c);
        r(9, 1, 1, 1, C1([30, 26, 26]));
        r(6, 6, 1, 5, m);
      } else {
        r(6, 10, 2, 5, c);
        r(7, 14, 3, 3, c);
        r(10, 14, 1, 2, c);
        r(6, 12, 1, 5, m);
        r(7, 17, 2, 1, m);
        r(8, 16, 1, 1, C1([24, 22, 22]));
        r(7, 17, 1, 1, c);
      }
      break;
    }
    case 'cow': {
      const c = C1(a.col),
        cd = C1(a.col, 0.78),
        wh = C1([234, 230, 222]),
        leg = C1(a.col, 0.7);
      shadow(14);
      const gz = a.state === 'graze';
      const o = fA === 2 ? 0 : fA ? 1 : -1;
      r(-5, 0, 1, 5, leg);
      r(-3 + o, 0, 1, 5, leg);
      r(3, 0, 1, 5, leg);
      r(5 - o, 0, 1, 5, leg);
      r(-6, 5, 12, 5, c);
      r(-6, 5, 12, 1, cd);
      if (a.spot) {
        r(-3, 6, 4, 3, wh);
        r(3, 8, 2, 2, wh);
      }
      r(-1, 4, 3, 1, C1([226, 170, 160]));
      r(-7, 7, 1, 3, cd);
      if (gz) {
        r(6, 3, 3, 4, c);
        r(8, 3, 1, 1, wh);
      } else {
        r(6, 7, 3, 4, c);
        r(6, 11, 1, 1, C1([220, 210, 180]));
        r(8, 7, 1, 2, wh);
        r(8, 9, 1, 1, C1([20, 18, 18]));
      }
      break;
    }
    case 'reindeer': {
      const c = C1([122, 106, 88]),
        cl = C1([214, 204, 190]),
        leg = C1([110, 96, 80]),
        an = C1([180, 160, 120]);
      shadow(11);
      const gz = a.state === 'graze';
      const o = fA === 2 ? 0 : fA ? 1 : -1;
      r(-4, 0, 1, 5, leg);
      r(-3 - o, 0, 1, 5, leg);
      r(2, 0, 1, 5, leg);
      r(3 + o, 0, 1, 5, leg);
      r(-5, 5, 9, 4, c);
      r(-5, 5, 9, 1, cl);
      r(-6, 7, 1, 2, cl);
      if (gz) {
        r(4, 3, 2, 4, c);
        r(5, 1, 2, 3, c);
        if (a.ant) {
          r(4, 4, 1, 3, an);
          r(3, 6, 1, 2, an);
        }
      } else {
        r(4, 8, 2, 3, cl);
        r(5, 10, 3, 2, c);
        if (a.ant) {
          r(5, 12, 1, 4, an);
          r(4, 15, 1, 2, an);
          r(6, 14, 2, 1, an);
          r(7, 15, 1, 2, an);
          r(3, 13, 1, 1, an);
        }
      }
      break;
    }
    case 'fox': {
      const c = C1(a.col),
        cd = C1(a.col, 0.8),
        leg = C1(a.col, 0.75);
      shadow(7);
      const o = fA === 2 ? 0 : fA ? 1 : -1;
      r(-2 + o, 0, 1, 2, leg);
      r(2 - o, 0, 1, 2, leg);
      r(-3, 2, 6, 2, c);
      r(-6, 2, 3, 2, c);
      r(-7, 3, 1, 1, cd);
      r(3, 3, 2, 2, c);
      r(5, 3, 1, 1, C1([30, 26, 26]));
      r(3, 5, 1, 1, c);
      r(4, 5, 1, 1, cd);
      break;
    }
    case 'cat': {
      const c = C1(a.col),
        cd = C1(a.col, 0.75);
      shadow(5);
      const sit = !moving;
      if (sit) {
        r(-1, 0, 3, 3, c);
        r(-2, 0, 1, 1, cd);
        r(1, 3, 2, 2, c);
        r(1, 5, 1, 1, c);
        r(2, 5, 1, 1, cd);
        r(-3, 0, 1, 1, cd);
      } else {
        const o = fA ? 1 : 0;
        r(-2 + o, 0, 1, 1, cd);
        r(1 - o, 0, 1, 1, cd);
        r(-2, 1, 4, 2, c);
        r(2, 2, 2, 2, c);
        r(2, 4, 1, 1, c);
        r(-3, 2, 1, 2, cd);
        r(-4, 3, 1, 1, cd);
      }
      if (night) r(3, 3, 1, 1, '#d8f070');
      break;
    }
    case 'ptarmigan':
    case 'plover':
    case 'oyster':
    case 'thrush': {
      const b = C1(anMainCol(a)),
        belly = C1(
          a.sp === 'oyster'
            ? [236, 236, 230]
            : a.sp === 'plover'
              ? [30, 30, 30]
              : a.sp === 'thrush'
                ? [200, 190, 170]
                : [240, 236, 230]
        ),
        bill = C1(a.sp === 'oyster' ? [236, 110, 40] : [40, 36, 36]);
      const hop = a.hop > 0 ? 1 : 0;
      r(0, hop, 1, 1, C1([120, 90, 70]));
      r(-1, 1 + hop, 3, 2, b);
      r(-1, 1 + hop, 3, 1, belly);
      r(-2, 2 + hop, 1, 1, b);
      r(1, 3 + hop, 1, 1, b);
      r(2, 3 + hop, 1, 1, bill);
      break;
    }
    case 'duck':
    case 'eider':
    case 'goose':
    case 'swan': {
      const bc =
        a.sp === 'swan'
          ? [244, 244, 240]
          : a.sp === 'goose'
            ? [132, 126, 114]
            : a.sp === 'eider'
              ? a.male
                ? [240, 240, 232]
                : [124, 92, 60]
              : a.male
                ? [150, 140, 130]
                : [124, 98, 66];
      const hc = a.sp === 'duck' && a.male ? [30, 100, 60] : a.sp === 'eider' && a.male ? [30, 30, 30] : bc;
      const bill =
        a.sp === 'swan'
          ? [236, 200, 40]
          : a.sp === 'goose'
            ? [230, 130, 60]
            : a.sp === 'duck' && a.male
              ? [230, 200, 60]
              : [90, 80, 60];
      const b = C1(bc),
        bd = C1(bc, 0.8);
      if (!water) {
        r(0, 0, 1, 1, C1(bill, 0.8));
      }
      const y0 = water ? 0 : 1;
      r(-3, y0, 6, 2, b);
      r(-3, y0, 6, 1, bd);
      r(-4, y0 + 1, 1, 1, bd);
      if (a.sp === 'eider' && a.male) r(-3, y0, 6, 1, C1([30, 30, 30]));
      const nh = a.sp === 'swan' ? 4 : a.sp === 'goose' ? 2 : 1;
      r(2, y0 + 2, 1, nh, C1(a.sp === 'swan' ? bc : hc));
      r(2, y0 + 2 + nh, 2, 1, C1(hc));
      r(4, y0 + 2 + nh, 1, 1, C1(bill));
      if (water && moving && (a.phase | 0) % 3 === 0) r(-5, 0, 1, 1, wl);
      break;
    }
    case 'gull':
    case 'fulmar':
    case 'raven':
    case 'puffin': {
      const y0 = water ? 0 : 1,
        hop = a.hop > 0 ? 1 : 0;
      const B = anMainCol(a);
      if (!water)
        r(
          0,
          hop,
          1,
          1,
          C1(a.sp === 'raven' ? [30, 28, 30] : a.sp === 'puffin' ? [236, 120, 40] : [220, 190, 90])
        );
      if (a.sp === 'raven') {
        const k2 = C1(B),
          k3 = C1([50, 48, 60]);
        r(-2, y0 + hop, 5, 3, k2);
        r(-3, y0 + hop, 1, 2, k2);
        r(-2, y0 + 2 + hop, 4, 1, k3);
        r(3, y0 + 2 + hop, 1, 2, k2);
        r(4, y0 + 2 + hop, 1, 1, k2);
      } else if (a.sp === 'puffin') {
        r(-1, y0 + hop, 3, 3, C1([28, 28, 32]));
        r(1, y0 + hop, 1, 2, C1([238, 238, 232]));
        r(0, y0 + 3 + hop, 2, 2, C1([28, 28, 32]));
        r(1, y0 + 4 + hop, 1, 1, C1([226, 226, 220]));
        r(2, y0 + 3 + hop, 1, 2, C1([236, 120, 40]));
      } else {
        const wg = C1(a.sp === 'gull' ? [160, 170, 180] : [170, 174, 180]);
        r(-2, y0 + hop, 4, 2, C1(B));
        r(-3, y0 + 1 + hop, 4, 1, wg);
        r(-4, y0 + 1 + hop, 1, 1, C1(a.sp === 'gull' ? [30, 30, 30] : [150, 154, 160]));
        r(1, y0 + 2 + hop, 2, 1, C1(B));
        r(3, y0 + 2 + hop, 1, 1, C1([230, 190, 60]));
      }
      if (water && moving) r(-4, 0, 1, 1, wl);
      break;
    }
    case 'goat': {
      const c = C1(a.col),
        cd = C1(a.col, 0.78),
        leg = C1(a.col, 0.7),
        hn = C1([150, 130, 100]);
      shadow(9);
      const gz = a.state === 'graze';
      const o = fA === 2 ? 0 : fA ? 1 : -1;
      r(-3, 0, 1, 4, leg);
      r(-2 - o, 0, 1, 4, leg);
      r(2, 0, 1, 4, leg);
      r(3 + o, 0, 1, 4, leg);
      r(-4, 4, 8, 3, c);
      r(-4, 4, 8, 1, cd);
      r(-5, 6, 1, 2, cd);
      if (gz) {
        r(4, 2, 2, 3, c);
        r(5, 1, 1, 1, cd);
      } else {
        r(4, 6, 2, 3, c);
        r(5, 8, 2, 2, c);
        r(6, 7, 1, 1, C1([30, 26, 24]));
        r(5, 6, 1, 1, cd);
        r(4, 10, 1, 2, hn);
        r(3, 11, 1, 1, hn);
      }
      break;
    }
    case 'pig': {
      const c = C1(a.col),
        cd = C1(a.col, 0.82),
        sn = C1([214, 140, 140]);
      shadow(9);
      const o = fA === 2 ? 0 : fA ? 1 : -1;
      r(-3, 0, 1, 2, cd);
      r(-2 - o, 0, 1, 2, cd);
      r(2, 0, 1, 2, cd);
      r(3 + o, 0, 1, 2, cd);
      r(-4, 2, 9, 4, c);
      r(-4, 2, 9, 1, cd);
      r(-5, 4, 1, 1, cd);
      r(5, 2, 2, 3, c);
      r(7, 2, 1, 2, sn);
      r(5, 5, 1, 1, cd);
      r(6, 4, 1, 1, C1([40, 30, 30]));
      break;
    }
    case 'hen': {
      const b = C1(a.col),
        bd = C1(a.col, 0.78),
        cb = C1([214, 40, 36]);
      const hop = a.hop > 0 || (moving && fA === 1) ? 1 : 0;
      r(0, 0, 1, 1 + hop, C1([210, 170, 70]));
      r(-2, 1 + hop, 4, 2, b);
      r(-3, 2 + hop, 1, 2, bd);
      r(1, 3 + hop, 1, 2, b);
      r(2, 3 + hop, 1, 1, C1([226, 180, 60]));
      r(1, 5 + hop, 1, 1, cb);
      break;
    }
    case 'rabbit': {
      const c = C1(a.col),
        cd = C1(a.col, 0.8);
      shadow(4);
      const hop = moving && fA === 1 ? 1 : 0;
      r(-2, hop, 4, 2, c);
      r(-3, hop + 1, 1, 1, C1([240, 240, 236]));
      r(1, hop + 2, 2, 1, c);
      r(1, hop + 3, 1, 2, cd);
      r(2, hop + 3, 1, 2, c);
      r(2, hop + 2, 1, 1, C1([200, 80, 90]));
      break;
    }
    case 'mink': {
      const c = C1(a.col),
        cd = C1(a.col, 0.75);
      const o = moving && fA === 1 ? 1 : 0;
      r(-4, o, 8, 1, c);
      r(-4, 1, 8, 1, cd);
      r(-6, 1, 2, 1, cd);
      r(4, 1, 2, 2, c);
      r(5, 2, 1, 1, C1([20, 16, 16]));
      break;
    }
    case 'seal': {
      const c = C1([112, 110, 102]),
        cd = C1([84, 82, 78]);
      if (water) {
        r(0, 0, 2, 2, c);
        r(2, 0, 1, 1, cd);
        if (moving) r(-2, 0, 1, 1, wl);
      } else {
        shadow(10);
        const up = a.flip > 0 ? 1 : 0;
        r(-5, 0, 10, 2, c);
        r(-5, 2, 7, 1, c);
        r(-6, 0, 1, 1, cd);
        r(-7, 1 + up, 1, 1, cd);
        r(4, 1 + up, 2, 2, c);
        r(5, 2 + up, 1, 1, C1([20, 20, 20]));
        r(-2, 1, 1, 1, cd);
        r(1, 1, 1, 1, cd);
      }
      break;
    }
    case 'whale': {
      if (!a.water) {
        shadow(26);
        const c = C1([52, 56, 64]),
          cb = C1([196, 200, 204]),
          cd = C1([38, 40, 46]);
        r(-12, 0, 22, 3, c);
        r(-11, 3, 19, 2, c);
        r(-9, 5, 14, 1, c);
        r(-10, 0, 18, 1, cb);
        r(10, 1, 3, 2, c);
        r(13, 2, 1, 1, cd);
        r(-15, 1, 3, 1, cd);
        r(-17, 2, 2, 2, cd);
        r(-17, 0, 2, 1, cd);
        r(-3, 5, 3, 2, cd);
        r(7, 3, 1, 1, C1([20, 20, 24]));
        break;
      }
      if (a.state !== 'surf') {
        if (Hh >= 6) {
          ctx.fillStyle = 'rgba(20,40,60,.25)';
          ctx.fillRect(X - Math.round(6 * p), Y, Math.round(12 * p), Math.max(1, Math.round(p)));
        }
        break;
      }
      const c = C1([42, 46, 54]),
        u = Math.min(1, (4 - Math.abs(a.t - 3.5)) / 1.5);
      r(-12, 0, 24, 1, c);
      if (u > 0.3) {
        r(-8, 1, 14, 1, c);
        r(-1, 2, 2, 1, c);
        r(-1, 3, 1, 1, c);
      }
      r(-14, 0, 2, 1, wl);
      r(12, 0, 2, 1, wl);
      break;
    }
  }
  sel(a, X, Y, p, 8, a.sp === 'horse' ? 18 : 10);
}
function sel(a, X, Y, p, w, h) {
  if (a === follow || a === selected) {
    ctx.strokeStyle = '#c6b3ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      X - Math.round(w * p) - 0.5,
      Y - Math.round(h * p) - 0.5,
      Math.round(w * 2 * p) + 1,
      Math.round(h * p) + 1
    );
  }
}
function animalCard(a) {
  const S = SPC[a.sp];
  const act = a.run
    ? a.fly
      ? 'Flying away from danger'
      : 'Running from danger'
    : a.state === 'fly'
      ? 'Circling overhead'
      : a.state === 'land'
        ? 'Coming in to land'
        : a.sp === 'whale'
          ? a.state === 'surf'
            ? 'Surfacing to breathe'
            : 'Diving'
          : a.sp === 'seal'
            ? a.water
              ? 'Swimming'
              : 'Resting on the beach'
            : a.state === 'graze'
              ? a.sp === 'cat'
                ? 'Stalking something'
                : 'Grazing'
              : a.state === 'walk'
                ? a.water
                  ? 'Paddling'
                  : a.gallop > 0
                    ? 'Galloping'
                    : a.sp === 'horse' && a.lead
                      ? 'Following the herd'
                      : 'Wandering'
                : a.water
                  ? 'Floating'
                  : night
                    ? 'Sleeping'
                    : 'Resting';
  const nm = a.name !== S.is ? a.name : S.is;
  return {
    h:
      '<h3>' +
      nm +
      '</h3><div class="sub">' +
      (a.name !== S.is ? S.is + ' · ' : '') +
      S.en +
      '</div><div class="act">' +
      act +
      '</div><div class="row"><span>' +
      (a.pen ? 'Lives at' : 'Area') +
      '</span><span>' +
      (a.pen ? a.pen.zoo : district(a.x, a.y)) +
      '</span></div>' +
      (a.lead || animals.some(o => o.lead === a && !o.dead)
        ? '<div class="row"><span>Group</span><span>' +
          (1 + animals.filter(o => !o.dead && o.lead === (a.lead || a)).length) +
          ' together</span></div>'
        : '') +
      '<p class="fact" style="margin:.5em 0 0;font-size:12px;opacity:.85">' +
      S.fact +
      '</p>' +
      (follow === a
        ? '<button class="btn" id="unfollow">Stop following</button>'
        : '<button class="btn" id="dofollow">Follow</button>'),
    m: nm + ' · ' + S.en
  };
}
