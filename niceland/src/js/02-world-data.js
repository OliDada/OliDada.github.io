/**
 * World data
 *
 * Land classes, their colours and names, and decoding of world.txt (terrain grids, buildings, road nodes)
 * into memory.
 *
 * Functions: mkGrid, load
 * State and constants: SEA, LAKE, GRASS, PARK, WOOD, SCRUB, SAND, WET, ROCK, PAVED, RUNWAY, PITCH, GOLF,
 *     CEM, PIER, RIVER, LAVA, RUBBLE, GLACIER, HIGH, URBAN, HAY, GCOL, GNAME, GEN, isWaterT, F, C, FN,
 *     STR, KX, KY, LAT0, LON0, PLACES, B, NX, NY, NODE_N, WAYS, TREES, NT, ll, DISTRICTS, DIST, GOTO,
 *     WALLS, ROOFS, APTW, COMW, INDW, PUBW, FLATR, AUT, CONC
 */

const SEA = 0,
  LAKE = 1,
  GRASS = 2,
  PARK = 3,
  WOOD = 4,
  SCRUB = 5,
  SAND = 6,
  WET = 7,
  ROCK = 8,
  PAVED = 9,
  RUNWAY = 10,
  PITCH = 11,
  GOLF = 12,
  CEM = 13,
  PIER = 14,
  RIVER = 15,
  LAVA = 16,
  RUBBLE = 17,
  GLACIER = 18,
  HIGH = 19,
  URBAN = 20,
  HAY = 21;
const GCOL = [
  [38, 86, 120],
  [64, 118, 146],
  [112, 140, 78],
  [88, 128, 70],
  [72, 104, 62],
  [120, 112, 78],
  [72, 70, 70],
  [98, 114, 86],
  [64, 62, 64],
  [122, 124, 130],
  [70, 72, 78],
  [72, 142, 78],
  [106, 152, 84],
  [92, 120, 78],
  [156, 152, 146],
  [70, 130, 160],
  [255, 100, 30],
  [128, 116, 104],
  [226, 236, 242],
  [124, 116, 92],
  [150, 146, 136],
  [122, 158, 70]
];
const GNAME = [
  'Sjór',
  'Vatn',
  'Gras',
  'Garður',
  'Skógur',
  'Kjarr og lúpína',
  'Svartur sandur',
  'Mýri',
  'Hraun',
  'Malbik',
  'Flugbraut',
  'Íþróttavöllur',
  'Golfvöllur',
  'Kirkjugarður',
  'Bryggja',
  'Á',
  'Glóandi hraun',
  'Rústir',
  'Jökull',
  'Hálendi',
  'Þéttbýli',
  'Tún'
];
const GEN = [
  'Sea',
  'Lake',
  'Grass',
  'Park',
  'Woodland',
  'Scrub and lupine',
  'Black sand',
  'Wetland',
  'Lava field',
  'Paved ground',
  'Runway',
  'Sports pitch',
  'Golf course',
  'Cemetery',
  'Pier',
  'River',
  'Molten lava',
  'Rubble',
  'Glacier',
  'Highland gravel and moss',
  'Town',
  'Hayfield'
];
const isWaterT = t => t === SEA || t === LAKE || t === RIVER;
let F,
  C,
  FN,
  STR,
  KX,
  KY,
  LAT0,
  LON0,
  PLACES = [];
let B = [],
  NX,
  NY,
  NODE_N,
  WAYS = [],
  TREES,
  NT;
const ll = (lat, lon) => [(lon - LON0) * KX, (LAT0 - lat) * KY];
const DISTRICTS = [
  ['Grandi', 64.153, -21.95],
  ['Miðborg', 64.1466, -21.9333],
  ['Vesturbær', 64.144, -21.962],
  ['Skerjafjörður', 64.129, -21.95],
  ['Seltjarnarnes', 64.153, -21.998],
  ['Hlíðar', 64.133, -21.911],
  ['Öskjuhlíð', 64.129, -21.92],
  ['Vatnsmýri', 64.131, -21.94],
  ['Norðurmýri', 64.14, -21.915],
  ['Borgartún', 64.144, -21.895],
  ['Laugarnes', 64.15, -21.885],
  ['Laugardalur', 64.141, -21.873],
  ['Heimar', 64.133, -21.865],
  ['Vogar', 64.139, -21.85],
  ['Háaleiti', 64.128, -21.88],
  ['Fossvogur', 64.121, -21.865],
  ['Smáíbúðahverfi', 64.127, -21.85],
  ['Kársnes', 64.113, -21.93],
  ['Hamraborg', 64.112, -21.905],
  ['Digranes', 64.106, -21.88],
  ['Smárinn', 64.1, -21.88],
  ['Neðra-Breiðholt', 64.105, -21.845],
  ['Fell og Hólar', 64.102, -21.815],
  ['Seljahverfi', 64.096, -21.835],
  ['Árbær', 64.117, -21.795],
  ['Ártúnsholt', 64.124, -21.805],
  ['Grafarvogur', 64.135, -21.79],
  ['Grafarholt', 64.12, -21.76],
  ['Garðabær', 64.09, -21.92],
  ['Elliðaárdalur', 64.118, -21.825],
  ['Álftanes', 64.105, -22.0],
  ['Viðey', 64.164, -21.854],
  ['Bryggjuhverfi', 64.13, -21.815]
];
let DIST = [];
const GOTO = [
  ['Hallgrímskirkja', 64.14197, -21.92659, 1.35],
  ['Harpa', 64.1503, -21.9327, 1.35],
  ['Laugavegur', 64.1437, -21.925, 2],
  ['Tjörnin', 64.144, -21.942, 0.9],
  ['Perlan', 64.129, -21.919, 0.9],
  ['Breiðholt', 64.102, -21.83, 0.6],
  ['Kópavogur', 64.112, -21.905, 0.6],
  ['Akureyri', 65.6835, -18.1105, 0.6],
  ['Ísafjörður', 66.0749, -23.135, 0.6],
  ['Egilsstaðir', 65.2669, -14.3948, 0.6],
  ['Húsavík', 66.0449, -17.3389, 0.6],
  ['Höfn', 64.2539, -15.2082, 0.6],
  ['Vík í Mýrdal', 63.4186, -19.006, 0.6],
  ['Selfoss', 63.9331, -20.9971, 0.6],
  ['Keflavík', 64.0049, -22.5624, 0.6],
  ['Vestmannaeyjar', 63.4427, -20.2734, 0.6],
  ['Siglufjörður', 66.1527, -18.9087, 0.6],
  ['Stykkishólmur', 65.075, -22.727, 0.6],
  ['Þingvellir', 64.2559, -21.1299, 0.052],
  ['Geysir', 64.3104, -20.3024, 0.4],
  ['Gullfoss', 64.3271, -20.1199, 0.4],
  ['Jökulsárlón', 64.0784, -16.2306, 0.035],
  ['Landmannalaugar', 63.991, -19.0605, 0.052],
  ['Hekla', 63.992, -19.6656, 0.078],
  ['Eyjafjallajökull', 63.6314, -19.6083, 0.078],
  ['Askja', 65.0333, -16.75, 0.078],
  ['Mývatn', 65.6039, -16.9961, 0.12],
  ['Dettifoss', 65.8147, -16.3846, 0.27],
  ['Snæfellsjökull', 64.808, -23.776, 0.078],
  ['Vatnajökull', 64.4, -16.8, 0.0045],
  ['Fagradalsfjall', 63.9036, -22.2731, 0.12],
  ['Bláa lónið', 63.8804, -22.4495, 0.4],
  ['All of Iceland', 64.85, -18.7, 0.0009]
];
const WALLS = [
  [236, 232, 222],
  [226, 190, 84],
  [126, 170, 204],
  [198, 68, 58],
  [150, 178, 140],
  [190, 196, 200],
  [226, 150, 128],
  [90, 120, 150],
  [240, 214, 170],
  [176, 92, 70],
  [110, 150, 120]
];
const ROOFS = [
  [178, 52, 44],
  [52, 96, 78],
  [70, 86, 104],
  [40, 42, 48],
  [46, 128, 130],
  [150, 60, 40],
  [96, 98, 104]
];
const APTW = [
  [230, 230, 224],
  [204, 208, 210],
  [218, 204, 184],
  [184, 194, 200],
  [226, 222, 206],
  [196, 186, 170]
];
const COMW = [
  [176, 182, 188],
  [150, 160, 170],
  [206, 200, 190],
  [120, 134, 150],
  [188, 170, 150]
];
const INDW = [
  [150, 160, 168],
  [110, 130, 150],
  [130, 150, 128],
  [180, 180, 176],
  [160, 120, 100]
];
const PUBW = [
  [220, 212, 196],
  [200, 196, 188],
  [232, 226, 214],
  [190, 176, 160]
];
const FLATR = [
  [110, 112, 116],
  [92, 96, 102],
  [126, 124, 120],
  [80, 84, 90]
];
const AUT = [
  [214, 160, 48],
  [196, 108, 40],
  [124, 150, 60],
  [230, 196, 72],
  [176, 86, 40]
];
const CONC = [218, 214, 206];

function mkGrid(id, m, gt, ht, nm) {
  const n = m.W * m.H;
  return {
    id,
    W: m.W,
    H: m.H,
    CS: m.cs,
    OX: m.ox,
    OY: m.oy,
    GT: gt,
    HT: ht,
    NM: nm,
    COVER: new Uint8Array(n),
    LV: new Float32Array(n),
    LH: new Float32Array(n),
    OGT: gt.slice(),
    OHT: ht.slice(),
    x1: m.ox + m.W * m.cs,
    y1: m.oy + m.H * m.cs
  };
}
async function load() {
  const setP = (f, t) => {
    $('#ldbar').style.width = f * 100 + '%';
    if (t) $('#ldtxt').textContent = t;
  };
  setP(0.06, 'Downloading Iceland…');
  const r = await fetch('world.txt');
  if (!r.ok) throw new Error('world data ' + r.status);
  const b64 = (await r.text()).trim();
  setP(0.3, 'Unpacking the country…');
  await new Promise(r => setTimeout(r, 0));
  const bin = atob(b64);
  let u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  let buf = u.buffer;
  if (u[0] === 0x1f && u[1] === 0x8b)
    buf = await new Response(
      new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer();
  setP(0.45, 'Raising mountains…');
  await new Promise(r => setTimeout(r, 0));
  const dv = new DataView(buf);
  const jl = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jl)));
  let off = 8 + jl;
  const next = T => {
    off = (off + 3) & ~3;
    const n = dv.getUint32(off, true);
    off += 4;
    const a = new T(buf.slice(off, off + n));
    off += n;
    return a;
  };
  STR = meta.strings;
  KX = meta.kx;
  KY = meta.ky;
  LAT0 = meta.origin[0];
  LON0 = meta.origin[1];
  PLACES = meta.places || [];
  F = mkGrid(0, meta.fine, next(Uint8Array), next(Int16Array), next(Uint32Array));
  FN = F.W * F.H;
  C = mkGrid(1, meta.coarse, next(Uint8Array), next(Int16Array), next(Uint32Array));
  F.CBLD = new Int32Array(FN).fill(-1);
  const anc = next(Int32Array),
    st = next(Uint32Array),
    vt = next(Int16Array),
    bH = next(Uint16Array),
    bBase = next(Uint16Array),
    bK = next(Uint8Array),
    bR = next(Uint8Array),
    bS = next(Uint8Array),
    bN = next(Uint32Array),
    bA = next(Uint32Array),
    bU = next(Uint32Array),
    bRes = next(Uint16Array),
    bJ = next(Uint16Array);
  const nd = next(Int32Array),
    ws = next(Uint32Array),
    wn = next(Uint32Array),
    wc = next(Uint8Array),
    wnm = next(Uint32Array),
    wbr = next(Uint8Array);
  const tx = next(Int32Array),
    tk = next(Uint8Array);
  DIST = DISTRICTS.map(d => {
    const p = ll(d[1], d[2]);
    return { n: d[0], x: p[0], y: p[1] };
  });
  setP(0.6, 'Building ' + bK.length.toLocaleString('en-GB') + ' houses…');
  await new Promise(r => setTimeout(r, 0));
  try {
    const r3 = await fetch('bldx.txt');
    if (r3.ok) {
      const b3 = atob((await r3.text()).trim());
      const u3 = new Uint8Array(b3.length);
      for (let i = 0; i < b3.length; i++) u3[i] = b3.charCodeAt(i);
      const bf = await new Response(
        new Blob([u3]).stream().pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer();
      const n3 = new DataView(bf).getUint32(4, true);
      if (n3 === bK.length) {
        let o3 = 8;
        const yr = new Uint16Array(bf.slice(o3, o3 + 2 * n3));
        o3 += 2 * n3;
        const fl = new Uint8Array(bf, o3, n3);
        o3 += n3;
        const rgb = new Uint8Array(bf, o3, 3 * n3);
        o3 += 3 * n3;
        const has = new Uint8Array(bf, o3, n3);
        o3 += n3;
        let rs = null,
          rx = null,
          fg = null,
          wrgb = null,
          rh = null,
          po = null;
        if (bf.byteLength >= o3 + 2 * n3) {
          rs = new Uint8Array(bf, o3, n3);
          o3 += n3;
          rx = new Uint8Array(bf, o3, n3);
          o3 += n3;
        }
        if (bf.byteLength >= o3 + 9 * n3) {
          fg = new Uint8Array(bf, o3, n3);
          o3 += n3;
          wrgb = new Uint8Array(bf, o3, 3 * n3);
          o3 += 3 * n3;
          rh = new Uint8Array(bf, o3, n3);
          o3 += n3;
          po = new Uint32Array(bf.slice(o3, o3 + 4 * n3));
        }
        BX = { yr, fl, rgb, has, rs, rx, fg, wrgb, rh, po };
      }
    }
  } catch (e) {
    console.warn('bldx', e);
  }
  for (let i = 0; i < bK.length; i++) {
    const ax = anc[2 * i] * 0.5,
      ay = anc[2 * i + 1] * 0.5,
      s = st[i],
      e = st[i + 1],
      n = e - s,
      poly = new Float32Array(n * 2);
    for (let j = 0; j < n; j++) {
      poly[2 * j] = ax + vt[2 * (s + j)] * 0.5;
      poly[2 * j + 1] = ay + vt[2 * (s + j) + 1] * 0.5;
    }
    const b = mkB(poly, {
      h: bH[i] / 10,
      base: bBase[i] / 10,
      kind: bK[i],
      roof: bR[i],
      sp: bS[i],
      name: STR[bN[i]],
      addr: STR[bA[i]],
      use: STR[bU[i]],
      res: bRes[i],
      jobs: bJ[i]
    });
    applyEra(b, i);
    applyOSM3D(b, i);
    if (b.sp === 1) b.group = 'hall';
    B.push(b);
  }
  linkParts();
  rebuildHall();
  applyLandmarks();
  captureHall();
  setP(0.78, 'Laying roads…');
  const rxP = fetchRoadX();
  const poiP = fetchPOI();
  const busP = fetchBus();
  const geoP = fetchGeo();
  const infP = fetchInfra();
  const extraP = fetchExtra();
  await new Promise(r => setTimeout(r, 0));
  NODE_N = nd.length / 2;
  NX = new Float32Array(NODE_N);
  NY = new Float32Array(NODE_N);
  for (let i = 0; i < NODE_N; i++) {
    NX[i] = nd[2 * i] * 0.5;
    NY[i] = nd[2 * i + 1] * 0.5;
  }
  for (let w = 0; w < wc.length; w++)
    WAYS.push({ nodes: wn.subarray(ws[w], ws[w + 1]), cl: wc[w], name: STR[wnm[w]], br: wbr[w] });
  await rxP;
  applyRoadX();
  NT = tk.length;
  TREES = {
    x: new Float32Array(NT),
    y: new Float32Array(NT),
    k: tk,
    s: new Uint8Array(NT),
    f: new Float32Array(NT),
    seed: new Float32Array(NT)
  };
  for (let i = 0; i < NT; i++) {
    TREES.x[i] = tx[2 * i] * 0.5;
    TREES.y[i] = tx[2 * i + 1] * 0.5;
    TREES.seed[i] = h32(i, 7, 1);
  }
  setP(0.86, 'Sharpening the coastline…');
  initDetail();
  let propsP = fetch('props.txt')
    .then(r => (r.ok ? r.text() : null))
    .then(async t => {
      if (!t) return null;
      const b = atob(t.trim());
      const u = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      const tx = await new Response(
        new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))
      ).text();
      return JSON.parse(tx);
    })
    .catch(e => {
      console.warn('props', e);
      return null;
    });
  window.__propsP = propsP;
  try {
    const r2 = await fetch('detail.txt');
    if (r2.ok) {
      const b2 = atob((await r2.text()).trim());
      let u2 = new Uint8Array(b2.length);
      for (let i = 0; i < b2.length; i++) u2[i] = b2.charCodeAt(i);
      let bf = u2.buffer;
      if (u2[0] === 0x1f && u2[1] === 0x8b)
        bf = await new Response(
          new Blob([bf]).stream().pipeThrough(new DecompressionStream('gzip'))
        ).arrayBuffer();
      const dv2 = new DataView(bf);
      const n = dv2.getUint32(4, true);
      MASKI = new Uint32Array(bf.slice(12, 12 + 4 * n));
      MASKB = new Uint8Array(bf.slice(12 + 4 * n));
    }
  } catch (e) {
    console.warn('detail masks', e);
  }
  setP(0.9, 'Teaching people to walk…');
  await new Promise(r => setTimeout(r, 0));
  await poiP;
  buildIndices();
  try {
    genZoos();
  } catch (e) {
    console.warn('zoo', e);
  }
  try {
    initBus(await busP);
  } catch (e) {
    console.warn('bus', e);
  }
  try {
    const inf = await infP;
    initInfra(inf);
    initSki(inf);
  } catch (e) {
    console.warn('infra', e);
  }
  extraP.then(d => {
    try {
      initExtra(d);
    } catch (e) {
      console.warn('extra', e);
    }
  });
  try {
    initCounts();
  } catch (e) {
    console.warn('counts', e);
  }
  try {
    initBoats();
  } catch (e) {
    console.warn('boats', e);
  }
  try {
    initGeo(await geoP);
  } catch (e) {
    console.warn('geo', e);
  }
  try {
    applyBrands();
    for (const b of B) {
      if (b.brand && !b.canopy) {
        const L = [];
        for (let j = 0; j < b.n; j++) {
          const q = (j + 1) % b.n;
          L.push([Math.hypot(b.poly[2 * q] - b.poly[2 * j], b.poly[2 * q + 1] - b.poly[2 * j + 1]), j]);
        }
        L.sort((a, c) => c[0] - a[0]);
        b.signW = new Set(L.slice(0, 4).map(x => x[1]));
      }
    }
  } catch (e) {
    console.warn('brands', e);
  }
  setP(1, 'Ready');
}
