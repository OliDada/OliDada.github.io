/**
 * Tools
 *
 * The tool palette (build, destroy, terrain, disasters, people, animals) and applying a tool.
 *
 * Functions: buildDock, selCat, selTool, rectPoly, roadAngle, free, addBuilding, apply, addAnimals,
 *     reBase, addTree, finishRoad, addNode
 * State and constants: BRUSH, CATS, AN_N, AN_ORDER, TOOL, tool, cat, brush, lastCat, ADDED, dragFrom,
 *     flatH
 */

const BRUSH = { 1: 8, 2: 20, 3: 45 };
const CATS = [
  {
    id: 'inspect',
    label: 'Inspect',
    tools: [
      {
        id: 'inspect',
        label: 'Inspect & pan',
        sw: '#9db1c0',
        desc: 'Hover or tap a house, tree or person. Click a person to follow them. Drag to pan, Q and E to rotate.'
      }
    ]
  },
  {
    id: 'build',
    label: 'Build',
    tools: [
      {
        id: 'house',
        label: 'House',
        sw: '#c6443a',
        r: 6,
        desc: 'A 2-storey corrugated-iron house, 10 × 8 m.'
      },
      {
        id: 'apt',
        label: 'Apartments',
        sw: '#e2e2dc',
        r: 16,
        desc: 'A 5-storey apartment block, 30 × 12 m.'
      },
      { id: 'tower', label: 'Office tower', sw: '#6082a0', r: 12, desc: 'A 12-storey glass office tower.' },
      { id: 'tree', label: 'Trees', sw: '#d9a531', drag: 1, brush: 1, desc: 'Plant birch and spruce.' },
      {
        id: 'road',
        label: 'Road',
        sw: '#5c6068',
        r: 4,
        desc: 'Drag from one point to another to lay a street. Cars and people will use it.'
      },
      {
        id: 'park',
        label: 'Park',
        sw: '#567e46',
        drag: 1,
        brush: 1,
        desc: 'Turn ground into park. Works inside the capital area.'
      },
      {
        id: 'hallgrims',
        label: 'Hallgrímskirkja',
        sw: '#d8d4cc',
        r: 30,
        desc: 'Place another Hallgrímskirkja, 74.5 m tall.'
      },
      {
        id: 'harpa',
        label: 'Harpa',
        sw: '#6ec8dc',
        r: 40,
        desc: 'A glass concert hall. Its facade glows after dark.'
      },
      {
        id: 'perlan',
        label: 'Perlan',
        sw: '#84b2cc',
        r: 30,
        desc: 'Hot-water tanks with a glass dome on top.'
      },
      {
        id: 'cabin',
        label: 'Summer cabin',
        sw: '#6a4a36',
        r: 5,
        desc: 'Sumarbústaður: a small wooden cabin with a deck.'
      },
      {
        id: 'turf',
        label: 'Turf house',
        sw: '#6a8a44',
        r: 10,
        desc: 'Torfbær: three gabled turf houses with grass roofs.'
      },
      {
        id: 'church',
        label: 'Village church',
        sw: '#f2f0ea',
        r: 12,
        desc: 'A white country church with a steeple.'
      },
      { id: 'hotel', label: 'Hotel', sw: '#3c3e42', r: 22, desc: 'A 6-storey hotel. Tourists stay nearby.' },
      {
        id: 'green',
        label: 'Greenhouse',
        sw: '#bfe2dc',
        r: 15,
        desc: 'Gróðurhús: geothermal greenhouses where tomatoes and bananas grow.'
      },
      {
        id: 'lighthouse',
        label: 'Lighthouse',
        sw: '#dc4632',
        r: 4,
        desc: 'Viti: a lighthouse whose beam sweeps the night.'
      },
      {
        id: 'plant',
        label: 'Geothermal plant',
        sw: '#c8ccd0',
        r: 30,
        desc: 'Jarðvarmavirkjun: a power station with steaming towers.'
      },
      {
        id: 'pool',
        label: 'Swimming pool',
        sw: '#46b2d4',
        r: 14,
        desc: 'An outdoor geothermal pool with a hot tub. Swimmers come.'
      },
      { id: 'tub', label: 'Hot tub', sw: '#7cccd6', r: 3, desc: 'Heitur pottur: a small hot tub.' },
      {
        id: 'play',
        label: 'Playground',
        sw: '#aa5c46',
        r: 12,
        desc: 'Swings, slides and a sandpit. Children come to play.'
      },
      {
        id: 'pitch',
        label: 'Football pitch',
        sw: '#46944a',
        r: 32,
        desc: 'A 64 × 40 m artificial-turf pitch with goals.'
      },
      { id: 'flag', label: 'Flag', sw: '#02529c', r: 2, desc: 'Íslenski fáninn on a flagpole.' }
    ]
  },
  {
    id: 'destroy',
    label: 'Destroy',
    tools: [
      {
        id: 'demolish',
        label: 'Demolish',
        sw: '#b0a090',
        drag: 1,
        brush: 1,
        danger: 1,
        desc: 'Knock buildings down to rubble.'
      },
      {
        id: 'bomb',
        label: 'Explosion',
        sw: '#ff7a3d',
        danger: 1,
        r: 25,
        desc: 'A 25 m blast. Sets the edges on fire.'
      },
      {
        id: 'ignite',
        label: 'Set fire',
        sw: '#f0c75e',
        drag: 1,
        brush: 1,
        danger: 1,
        desc: 'Fire spreads between touching buildings and trees. Fire trucks will come.'
      },
      {
        id: 'bulldoze',
        label: 'Bulldoze',
        sw: '#76964e',
        drag: 1,
        brush: 1,
        danger: 1,
        desc: 'Clear buildings and trees for good.'
      },
      {
        id: 'bigbomb',
        label: 'Huge blast',
        sw: '#ff3d1f',
        danger: 1,
        r: 80,
        desc: 'An 80 m blast that leaves a crater.'
      },
      {
        id: 'sinkhole',
        label: 'Sinkhole',
        sw: '#5a4a3e',
        danger: 1,
        r: 30,
        desc: 'Jarðfall: the ground collapses 14 m.'
      },
      {
        id: 'troll',
        label: 'Troll',
        sw: '#76805e',
        danger: 1,
        r: 20,
        desc: 'A troll stomps through town. In daylight it turns to stone, as trolls do.'
      },
      {
        id: 'ufo',
        label: 'UFO',
        sw: '#a0ffbe',
        danger: 1,
        r: 10,
        desc: 'Beams buildings and people up into the sky.'
      },
      {
        id: 'tornado',
        label: 'Tornado',
        sw: '#8c8882',
        danger: 1,
        r: 20,
        desc: 'Skýstrókur: a twister that tears up everything in its path.'
      }
    ]
  },
  {
    id: 'terrain',
    label: 'Terrain',
    tools: [
      {
        id: 'raise',
        label: 'Raise',
        sw: '#a08a70',
        drag: 1,
        brush: 1,
        desc: 'Raise the ground. Outside the capital this moves whole 300 m tiles.'
      },
      {
        id: 'lower',
        label: 'Lower',
        sw: '#5e4e40',
        drag: 1,
        brush: 1,
        desc: 'Lower the ground. Below sea level the sea comes in.'
      },
      {
        id: 'flatten',
        label: 'Flatten',
        sw: '#8c9c74',
        drag: 1,
        brush: 1,
        desc: 'Level the ground to where you started.'
      },
      { id: 'water', label: 'Pond', sw: '#4a86a6', drag: 1, brush: 1, desc: 'Dig a pond.' },
      {
        id: 'grass',
        label: 'Grass',
        sw: '#76944e',
        drag: 1,
        brush: 1,
        desc: 'Paint grass. Works on water too.'
      },
      {
        id: 'sand',
        label: 'Black sand',
        sw: '#4e4c4c',
        drag: 1,
        brush: 1,
        desc: 'Paint volcanic black sand.'
      },
      {
        id: 'rock',
        label: 'Lava field',
        sw: '#3e3c3f',
        drag: 1,
        brush: 1,
        desc: 'Paint mossy hraun, cooled lava rock.'
      },
      { id: 'moss', label: 'Moss', sw: '#62704e', drag: 1, brush: 1, desc: 'Thick moss over old lava.' },
      {
        id: 'scrub',
        label: 'Scrub & lupine',
        sw: '#7a6c8c',
        drag: 1,
        brush: 1,
        desc: 'Birch scrub and lupine (purple in summer).'
      },
      {
        id: 'hay',
        label: 'Hayfield',
        sw: '#94b046',
        drag: 1,
        brush: 1,
        desc: 'Tún: mown hayfields with bales.'
      },
      {
        id: 'forest',
        label: 'Forest',
        sw: '#2e5a3a',
        drag: 1,
        brush: 1,
        desc: 'Plant a forest of spruce and birch.'
      },
      { id: 'ice', label: 'Glacier', sw: '#e2ecf2', drag: 1, brush: 1, desc: 'Paint glacier ice.' },
      {
        id: 'mountain',
        label: 'Mountain',
        sw: '#8c7c6a',
        drag: 1,
        brush: 1,
        desc: 'Push up a mountain, snow-capped once it is high.'
      },
      {
        id: 'geyser',
        label: 'Geyser',
        sw: '#bde6f6',
        r: 12,
        desc: 'Goshver: a geyser like Strokkur. The water bulges up in a blue dome, then bursts 15–20 m into the air every half minute or so.'
      },
      { id: 'spring', label: 'Hot spring', sw: '#5ab4c4', r: 8, desc: 'Hver: a steaming hot spring.' },
      {
        id: 'waterfall',
        label: 'Waterfall',
        sw: '#cfe6f0',
        r: 20,
        desc: 'Foss: a 25 m waterfall cut into the land, falling downhill. Outside the capital area.'
      }
    ]
  },
  {
    id: 'disaster',
    label: 'Disasters',
    tools: [
      {
        id: 'volcano',
        label: 'Volcano',
        sw: '#ff5a1f',
        danger: 1,
        r: 130,
        desc: 'Pushes up a cone that erupts for about 30 s. In the countryside it is 400 m tall and lava runs for kilometres.'
      },
      {
        id: 'meteor',
        label: 'Meteor',
        sw: '#fff1b8',
        danger: 1,
        r: 70,
        desc: 'A meteor with a 70 m blast radius.'
      },
      {
        id: 'quake',
        label: 'Earthquake',
        sw: '#b07a50',
        danger: 1,
        r: 900,
        desc: 'Six seconds of shaking within about 1 km.'
      },
      {
        id: 'flood',
        label: 'Storm surge',
        sw: '#3a7aa8',
        danger: 1,
        r: 20,
        desc: 'The sea rises 7 m for a few seconds, then recedes.'
      },
      {
        id: 'rain',
        label: 'Rain',
        sw: '#9cc0de',
        r: 20,
        desc: 'Fifteen seconds of rain. Umbrellas come out, fires go out.'
      },
      {
        id: 'lstorm',
        label: 'Thunderstorm',
        sw: '#e8e070',
        danger: 1,
        r: 20,
        desc: 'Þrumuveður: lightning strikes all around for 20 s.'
      },
      { id: 'blizzard', label: 'Blizzard', sw: '#f0f4f8', r: 20, desc: 'Stórhríð: snow, wind and drifts.' },
      {
        id: 'avalanche',
        label: 'Avalanche',
        sw: '#dfe8ee',
        danger: 1,
        r: 160,
        desc: 'Snjóflóð: snow sweeps away everything within 160 m.'
      },
      {
        id: 'jokulhlaup',
        label: 'Glacial flood',
        sw: '#7a6e60',
        danger: 1,
        r: 30,
        desc: 'Jökulhlaup: a flood bursts out and spreads, leaving black sand.'
      },
      {
        id: 'ash',
        label: 'Ash cloud',
        sw: '#5a5654',
        r: 20,
        desc: 'Öskuský: volcanic ash darkens the sky and grounds all flights.'
      }
    ]
  },
  {
    id: 'people',
    label: 'People',
    tools: [
      {
        id: 'spawn',
        label: 'Citizens',
        sw: '#e6c84a',
        r: 15,
        desc: 'A dozen people come out here and go about their day.'
      },
      {
        id: 'tourists',
        label: 'Tour group',
        sw: '#e85a30',
        r: 15,
        desc: 'A tour group heads for the nearest landmark.'
      },
      { id: 'cars', label: 'Cars', sw: '#c83030', r: 15, desc: 'Add cars to the nearest streets.' },
      {
        id: 'smite',
        label: 'Smite',
        sw: '#e8eeff',
        danger: 1,
        r: 4,
        desc: 'Lightning. Sets the target on fire.'
      },
      {
        id: 'concert',
        label: 'Concert',
        sw: '#c04ae8',
        r: 36,
        desc: 'Tónleikar: a stage with a live band, a light show after dark, and a big crowd — like Menningarnótt on Arnarhóll.'
      },
      {
        id: 'protest',
        label: 'Protest',
        sw: '#f0dc3c',
        r: 22,
        desc: 'Mótmæli: a crowd with signs, as on Austurvöllur.'
      },
      {
        id: 'party',
        label: 'Street party',
        sw: '#ff5aa0',
        r: 14,
        desc: 'Djamm: a party spills into the street.'
      },
      { id: 'wedding', label: 'Wedding', sw: '#f6f4ee', r: 14, desc: 'A bride, a groom and their guests.' },
      { id: 'marathon', label: 'Marathon', sw: '#50dc8c', r: 20, desc: 'Thirty runners set off from here.' },
      { id: 'yule', label: 'Yule Lads', sw: '#be1e24', r: 14, desc: 'The 13 jólasveinar come to town.' },
      {
        id: 'police',
        label: 'Emergency',
        sw: '#1e46aa',
        r: 20,
        desc: 'Police cars and an ambulance with sirens.'
      },
      {
        id: 'fireworks',
        label: 'Fireworks',
        sw: '#ff5ad2',
        r: 60,
        desc: 'Flugeldar: half a minute of fireworks, Icelandic New Year style.'
      },
      {
        id: 'bonfire',
        label: 'Bonfire',
        sw: '#ff8a3c',
        r: 8,
        desc: "Brenna: a big bonfire, as on New Year's Eve and Þrettándinn."
      },
      { id: 'evacuate', label: 'Evacuate', sw: '#ff9a3c', r: 400, desc: 'Everyone within 400 m runs away.' }
    ]
  },
  { id: 'animals', label: 'Animals', tools: [] }
];
/* every species in the game, one tool each */
const AN_N = {
  sheep: 12,
  horse: 8,
  cow: 6,
  reindeer: 10,
  fox: 2,
  cat: 1,
  ptarmigan: 5,
  plover: 4,
  oyster: 4,
  thrush: 4,
  goose: 10,
  duck: 6,
  swan: 4,
  eider: 8,
  gull: 6,
  raven: 2,
  puffin: 10,
  fulmar: 6,
  seal: 4,
  whale: 1,
  goat: 6,
  pig: 4,
  hen: 8,
  rabbit: 5,
  mink: 2
};
const AN_ORDER = [
  'sheep',
  'horse',
  'cow',
  'goat',
  'pig',
  'hen',
  'rabbit',
  'cat',
  'reindeer',
  'fox',
  'mink',
  'ptarmigan',
  'plover',
  'oyster',
  'thrush',
  'raven',
  'goose',
  'duck',
  'swan',
  'eider',
  'gull',
  'fulmar',
  'puffin',
  'seal',
  'whale'
];
{
  const cat = CATS.find(c => c.id === 'animals');
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  for (const sp of AN_ORDER) {
    const S = SPC[sp];
    if (!S) continue;
    const col = (ACOL[sp] && ACOL[sp][0]) || anMainCol({ sp, male: true });
    cat.tools.push({
      id: 'an_' + sp,
      label: (l => l[0].toUpperCase() + l.slice(1))(
        S.en.replace(
          /^(Icelandic|Common|Atlantic|Northern|Rock|Golden|Herring|Harbour|Minke|American|Arctic|Whooper|Greylag) /,
          ''
        )
      ),
      sw: hex(col),
      r: 12,
      desc: S.is + ' · ' + S.en + '. ' + S.fact
    });
  }
}
const TOOL = {};
for (const c of CATS)
  for (const t of c.tools) {
    t.cat = c.id;
    TOOL[t.id] = t;
  }
let tool = 'inspect',
  cat = 'inspect',
  brush = 2,
  lastCat = {};
function buildDock() {
  const cats = $('#cats');
  cats.innerHTML = '';
  CATS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'cat';
    b.setAttribute('role', 'tab');
    b.id = 'cat-' + c.id;
    b.innerHTML = c.label + '<kbd>' + (i + 1) + '</kbd>';
    b.setAttribute('aria-selected', c.id === cat);
    b.onclick = () => selCat(c.id);
    cats.appendChild(b);
  });
  const tl = $('#tools');
  tl.innerHTML = '';
  for (const t of CATS.find(c => c.id === cat).tools) {
    const b = document.createElement('button');
    b.className = 'tool' + (t.id === tool ? ' on' : '');
    b.id = 't-' + t.id;
    b.innerHTML = '<span class="sw" style="background:' + t.sw + '"></span>' + t.label;
    b.onclick = () => selTool(t.id);
    tl.appendChild(b);
  }
  const def = TOOL[tool];
  $('#desc').textContent = def.desc;
  $('#brush').hidden = !def.brush;
  cv.style.cursor = tool === 'inspect' ? 'grab' : 'crosshair';
}
function selCat(id) {
  cat = id;
  tool = lastCat[id] || CATS.find(c => c.id === id).tools[0].id;
  buildDock();
}
function selTool(id) {
  tool = id;
  lastCat[cat] = id;
  buildDock();
}
for (const b of document.querySelectorAll('#brush button'))
  b.onclick = () => {
    brush = +b.dataset.b;
    for (const q of document.querySelectorAll('#brush button')) q.classList.toggle('on', q === b);
  };
function rectPoly(cx, cy, ang, w, d) {
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  const p = [];
  for (const [u, v] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2]
  ])
    p.push(cx + u * ca - v * sa, cy + u * sa + v * ca);
  if (area2(p) < 0) return new Float32Array([p[6], p[7], p[4], p[5], p[2], p[3], p[0], p[1]]);
  return new Float32Array(p);
}
function roadAngle(x, y) {
  let best = 0,
    bd = 1e9;
  eachB2(SBUCK, x - 30, y - 30, x + 30, y + 30, (w, j) => {
    const wy = WAYS[w];
    if (wy.cl > 6) return;
    const n0 = wy.nodes[j],
      n1 = wy.nodes[j + 1];
    const d = segD(x, y, NX[n0], NY[n0], NX[n1], NY[n1]);
    if (d < bd) {
      bd = d;
      best = Math.atan2(NY[n1] - NY[n0], NX[n1] - NX[n0]);
    }
  });
  return best;
}
function free(poly) {
  let mnx = 1e12,
    mxx = -1e12,
    mny = 1e12,
    mxy = -1e12;
  const n = poly.length / 2;
  for (let j = 0; j < n; j++) {
    mnx = Math.min(mnx, poly[2 * j]);
    mxx = Math.max(mxx, poly[2 * j]);
    mny = Math.min(mny, poly[2 * j + 1]);
    mxy = Math.max(mxy, poly[2 * j + 1]);
  }
  for (let x = mnx; x <= mxx; x += 5)
    for (let y = mny; y <= mxy; y += 5) {
      if (!pip(poly, x, y)) continue;
      const c = cellAt(x, y);
      if (c < 0) return false;
      const t = gT(c);
      if (isWaterT(t) || t === LAVA || t === GLACIER) return false;
    }
  let ok = true;
  nearB((mnx + mxx) / 2, (mny + mxy) / 2, Math.max(mxx - mnx, mxy - mny) + 40, b => {
    if (!ok || b.state >= 2) return;
    if (pip(poly, b.cx, b.cy) || pip(b.poly, (mnx + mxx) / 2, (mny + mxy) / 2)) ok = false;
  });
  return ok;
}
const ADDED = [];
function addBuilding(poly, o) {
  const b = mkB(poly, o);
  b.id = B.length;
  b.isNew = 1;
  B.push(b);
  addB(b);
  if (inF(b.cx, b.cy)) rasterB(b);
  linkB(b);
  nearT(b.cx, b.cy, b.r + 3, t => {
    if (pip(poly, TREES.x[t], TREES.y[t])) TREES.s[t] = 3;
  });
  b.state = 3;
  b.prog = 0.05;
  building.add(b);
  dirtyB(b);
  dust(b.cx, b.cy, b.z, 10, b.r);
  statsDirty = true;
  ADDED.push({ poly: Array.from(poly), o });
  return b;
}
let dragFrom = null,
  flatH = 0;
function apply(x, y, first) {
  const def = TOOL[tool];
  if (!def) return;
  if (!first && !def.drag) return;
  const z = hAt(x, y),
    r = def.brush ? BRUSH[brush] : def.r;
  const fine = inF(x, y);
  switch (tool) {
    case 'house': {
      const p = rectPoly(x, y, roadAngle(x, y), 10, 8);
      if (!free(p)) {
        toast('No room there');
        return;
      }
      addBuilding(p, {
        h: 6.6,
        base: 0,
        kind: 0,
        roof: 1,
        sp: 0,
        name: '',
        addr: 'Nýbygging',
        use: '',
        res: 3,
        jobs: 0
      });
      break;
    }
    case 'apt': {
      const p = rectPoly(x, y, roadAngle(x, y), 30, 12);
      if (!free(p)) {
        toast('No room there');
        return;
      }
      addBuilding(p, {
        h: 15.6,
        base: 0,
        kind: 2,
        roof: 0,
        sp: 0,
        name: '',
        addr: 'Nýbygging',
        use: '',
        res: 40,
        jobs: 0
      });
      break;
    }
    case 'tower': {
      const p = rectPoly(x, y, roadAngle(x, y), 20, 20);
      if (!free(p)) {
        toast('No room there');
        return;
      }
      const b = addBuilding(p, {
        h: 44,
        base: 0,
        kind: 4,
        roof: 0,
        sp: 0,
        name: '',
        addr: 'Nýbygging',
        use: 'office',
        res: 0,
        jobs: 300
      });
      b.glass = true;
      b.wallC = [96, 130, 150];
      break;
    }
    case 'hallgrims': {
      if (!HKT) {
        toast('No church model loaded');
        return;
      }
      const bx = HKT.box,
        fp = new Float32Array([
          x + bx[0] * 0.8,
          y + bx[1] * 0.8,
          x + bx[2] * 0.8,
          y + bx[1] * 0.8,
          x + bx[2] * 0.8,
          y + bx[3] * 0.8,
          x + bx[0] * 0.8,
          y + bx[3] * 0.8
        ]);
      if (
        !free(area2(fp) < 0 ? new Float32Array([fp[6], fp[7], fp[4], fp[5], fp[2], fp[3], fp[0], fp[1]]) : fp)
      ) {
        toast('Not enough flat dry land');
        return;
      }
      const grp = 'hall' + B.length,
        parts = [];
      for (const t of HKT.parts) {
        const poly = new Float32Array(t.p.length);
        for (let q = 0; q < t.p.length; q += 2) {
          poly[q] = x + t.p[q];
          poly[q + 1] = y + t.p[q + 1];
        }
        const b = addBuilding(poly, {
          h: t.h,
          base: t.base,
          kind: 8,
          roof: t.roof,
          sp: 0,
          name: 'Hallgrímskirkja',
          addr: 'Nýbygging',
          use: 'place_of_worship',
          res: 0,
          jobs: 0
        });
        Object.assign(b, {
          hk: 1,
          rs: t.rs,
          rp: t.rp,
          rhT: t.rhT,
          rx: t.rx,
          spire: t.spire,
          wallC: t.wallC.slice(),
          roofC: t.roofC.slice(),
          wtag: 1,
          group: grp
        });
        b.obb = null;
        parts.push(b);
      }
      parts[0].jobs = 12;
      linkGroup(parts);
      const z0 = Math.min(...parts.map(b => b.z));
      for (const b of parts) {
        b.z = z0;
        if (b.sup) rotB(b);
        dirtyB(b);
      }
      groupTop(parts);
      toast('Hallgrímskirkja · 119 pieces, rising from the ground');
      break;
    }
    case 'harpa': {
      const p = rectPoly(x, y, 0.4, 70, 50);
      if (!free(p)) {
        toast('Not enough dry land');
        return;
      }
      const b = addBuilding(p, {
        h: 43,
        base: 0,
        kind: 8,
        roof: 0,
        sp: 2,
        name: 'Harpa',
        addr: 'Nýbygging',
        use: 'theatre',
        res: 0,
        jobs: 80
      });
      b.wallC = [40, 58, 78];
      b.roofC = [34, 44, 58];
      break;
    }
    case 'perlan': {
      const p = new Float32Array(ngon(x, y, 30, 12));
      if (!free(p)) {
        toast('Not enough dry land');
        return;
      }
      addBuilding(p, {
        h: 26,
        base: 0,
        kind: 8,
        roof: 0,
        sp: 3,
        name: 'Perlan',
        addr: 'Nýbygging',
        use: 'museum',
        res: 0,
        jobs: 40
      });
      break;
    }
    case 'tree':
      for (let q = 0; q < Math.max(1, (r * r) / 40); q++) {
        const tx = x + (R() - 0.5) * 2 * r,
          ty = y + (R() - 0.5) * 2 * r;
        if (Math.hypot(tx - x, ty - y) > r) continue;
        const c = cellAt(tx, ty);
        if (c < 0) continue;
        const t = gT(c);
        if (isWaterT(t) || t === LAVA || t === GLACIER) continue;
        const bb = bldAtCell(c);
        if (bb && bb.state < 2 && c < FN) continue;
        addTree(tx, ty, R() < 0.4 ? 0 : 1);
      }
      break;
    case 'park':
      cellsIn(x, y, r, c => {
        if (!isWaterT(gT(c)) && gT(c) !== LAVA) setCell(c, PARK, undefined, gCov(c));
      });
      break;
    case 'road':
      if (first) dragFrom = [x, y];
      break;
    case 'demolish':
      nearB(x, y, r + 40, b => {
        if (b.state < 2 && Math.hypot(b.cx - x, b.cy - y) < r + b.r * 0.5) destroyB(b, false, false);
      });
      break;
    case 'bomb':
      explode(x, y, 25, 3);
      break;
    case 'ignite':
      nearB(x, y, r + 40, b => {
        if (Math.hypot(b.cx - x, b.cy - y) < r + b.r * 0.5) ignite(b);
      });
      nearT(x, y, r, t => {
        if (Math.hypot(TREES.x[t] - x, TREES.y[t] - y) < r) igniteTree(t);
      });
      break;
    case 'bulldoze':
      nearB(x, y, r + 40, b => {
        if (b.state !== 9 && Math.hypot(b.cx - x, b.cy - y) < r + b.r * 0.5) wipeB(b);
      });
      nearT(x, y, r, t => {
        if (Math.hypot(TREES.x[t] - x, TREES.y[t] - y) < r) killTree(t);
      });
      cellsIn(x, y, r, c => {
        if (!isWaterT(gT(c))) {
          if (gT(c) === LAVA) {
            lavaTiles.delete(c);
            srcSet.delete(c);
          }
          setCell(c, GRASS, undefined, 1);
        }
      });
      dust(x, y, z, 6, r);
      break;
    case 'raise':
      cellsIn(x, y, r, (c, d) => {
        const t = gT(c);
        if (t === SEA) setCell(c, SAND, Math.max(2, gH(c) + 2), 1);
        else if (isWaterT(t)) setCell(c, GRASS, gH(c), 1);
        else setCell(c, t, gH(c) + 2 * (1 - d / (r + 10)), gCov(c));
      });
      reBase(x, y, r);
      break;
    case 'lower':
      cellsIn(x, y, r, (c, d) => {
        const t = gT(c);
        if (t === SEA) return;
        const nh = gH(c) - 2 * (1 - d / (r + 10));
        if (nh <= 0.5) {
          eachBldInCell(c, wipeB);
          setCell(c, SEA, 0, 1);
          lavaTiles.delete(c);
        } else setCell(c, t, nh, gCov(c));
      });
      reBase(x, y, r);
      break;
    case 'flatten':
      if (first) flatH = Math.max(1, z);
      cellsIn(x, y, r, c => {
        if (!isWaterT(gT(c))) setCell(c, gT(c), flatH, gCov(c));
      });
      reBase(x, y, r);
      break;
    case 'water':
      cellsIn(x, y, r, c => {
        if (gT(c) === SEA) return;
        eachBldInCell(c, wipeB);
        setCell(c, LAKE, gH(c), 1);
        lavaTiles.delete(c);
      });
      nearT(x, y, r, t => {
        const c = cellAt(TREES.x[t], TREES.y[t]);
        if (c >= 0 && isWaterT(gT(c))) killTree(t);
      });
      break;
    case 'grass':
    case 'sand':
    case 'rock':
      cellsIn(x, y, r, c => {
        const t = tool === 'grass' ? GRASS : tool === 'sand' ? SAND : ROCK;
        if (gT(c) === LAVA) {
          lavaTiles.delete(c);
          srcSet.delete(c);
        }
        setCell(c, t, isWaterT(gT(c)) ? Math.max(2, gH(c)) : gH(c), 1);
      });
      break;
    case 'volcano':
      volcano(x, y);
      break;
    case 'meteor':
      addP({
        t: 5,
        sx: x + 400,
        sy: y - 400,
        sz: z + 900,
        ex: x,
        ey: y,
        ez: z,
        x: x + 400,
        y: y - 400,
        z: z + 900,
        u: 0,
        dur: 1.3,
        life: 6,
        max: 6,
        c: [255, 255, 255],
        s: 3
      });
      break;
    case 'quake':
      quake = { x, y, t: 6 };
      hazards.push({ x, y, r: 1000, t: 6, kind: 'quake' });
      toast('Jarðskjálfti! Earthquake near ' + placeName(x, y));
      break;
    case 'flood':
      if (floodT <= 0) {
        floodT = 0.001;
        toast('Storm surge');
      }
      break;
    case 'rain':
      rainT = 15;
      toast('Rigning. It is raining, as usual');
      break;
    case 'spawn': {
      let n = 0;
      for (let q = 0; q < 40 && n < 12; q++) if (spawnPed([x - 60, y - 60, x + 60, y + 60])) n++;
      if (!n) toast('Nobody lives near here');
      break;
    }
    case 'tourists': {
      const s = nearestNode(x, y, GW, 120);
      let lm = null,
        bd = 1e18;
      for (const b of B) {
        if (!b.sp || b.state !== 0) continue;
        const d = Math.hypot(b.cx - x, b.cy - y);
        if (d < bd) {
          bd = d;
          lm = b;
        }
      }
      if (!lm || s < 0 || bd > 8000) {
        toast('No landmark nearby');
        return;
      }
      const p = astar(GW, s, bEntry(lm, GW), 40000);
      if (!p) {
        toast('No path to ' + lm.name);
        return;
      }
      const lead = mkAgent('tourist', NX[s], NY[s]);
      lead.path = p;
      lead.act = 'Guided tour to ' + lm.name;
      lead.dest = lm;
      lead.photo = 1;
      lead.job = 'Tour guide';
      lead.name = pickA(FEMALE) + ' ' + pickA(FATHER) + 'dóttir';
      lead.shirt = [240, 200, 30];
      lead.homeAddr = 'Ferðaþjónusta';
      agents.push(lead);
      for (let i = 0; i < 8; i++) {
        const m = mkAgent('tourist', lead.x, lead.y);
        m.leader = lead;
        m.offx = (R() - 0.5) * 7;
        m.offy = (R() - 0.5) * 7;
        m.act = lead.act;
        m.dest = lm;
        m.photo = 1;
        m.job = 'Tourist from ' + m.from;
        m.homeAddr = 'Hótel';
        agents.push(m);
      }
      toast('A tour group sets off for ' + lm.name);
      break;
    }
    case 'cars':
      for (let q = 0; q < 6; q++) spawnCar([x - 150, y - 150, x + 150, y + 150]);
      break;
    case 'cabin':
    case 'turf':
    case 'church':
    case 'hotel':
    case 'green':
    case 'lighthouse':
    case 'plant':
    case 'pool':
    case 'play':
    case 'pitch':
    case 'tub':
    case 'flag':
      buildThing(tool, x, y);
      break;
    case 'troll':
    case 'ufo':
    case 'tornado':
      spawnEnt(tool, x, y);
      break;
    case 'bigbomb':
    case 'sinkhole':
    case 'avalanche':
    case 'jokulhlaup':
    case 'blizzard':
    case 'lstorm':
    case 'ash':
      disasterTool(tool, x, y);
      break;
    case 'hay':
    case 'forest':
    case 'ice':
    case 'moss':
    case 'scrub':
    case 'mountain':
    case 'geyser':
    case 'spring':
      terrainTool(tool, x, y, r, first);
      break;
    case 'waterfall':
      placeFall(x, y);
      break;
    case 'concert':
      concertTool(x, y);
      break;
    case 'fireworks':
      EVSTATE.shows.push({ x, y, until: time + 30, kind: 'fw' });
      toast('Flugeldar!');
      break;
    case 'bonfire':
      EVSTATE.shows.push({ x, y, until: time + 90, kind: 'fire' });
      toast('Brenna · a bonfire');
      break;
    case 'protest':
    case 'party':
    case 'wedding':
    case 'marathon':
    case 'yule':
    case 'police':
    case 'evacuate':
      peopleTool(tool, x, y);
      break;
    case 'an_sheep':
    case 'an_horse':
    case 'an_cow':
    case 'an_goat':
    case 'an_pig':
    case 'an_hen':
    case 'an_rabbit':
    case 'an_cat':
    case 'an_reindeer':
    case 'an_fox':
    case 'an_mink':
    case 'an_ptarmigan':
    case 'an_plover':
    case 'an_oyster':
    case 'an_thrush':
    case 'an_raven':
    case 'an_goose':
    case 'an_duck':
    case 'an_swan':
    case 'an_eider':
    case 'an_gull':
    case 'an_fulmar':
    case 'an_puffin':
    case 'an_seal':
    case 'an_whale':
      addAnimals(tool.slice(3), x, y);
      break;
    case 'smite': {
      bolts.push({ x, y, z, t: 0.25 });
      const c = cellAt(x, y);
      const bb = c >= 0 ? bldAtCell(c) : null;
      if (bb) ignite(bb);
      nearT(x, y, 6, t => igniteTree(t));
      killNear(x, y, 4);
      shake = Math.max(shake, 0.4);
      if (!bb && c >= 0 && !isWaterT(gT(c))) setCell(c, ROCK, gH(c), 1);
      break;
    }
  }
}
function addAnimals(sp, x, y) {
  const S = SPC[sp],
    c = cellAt(x, y);
  if (c < 0) return;
  const n = AN_N[sp] || 4;
  let lead = null,
    made = 0;
  for (let i = 0; i < n; i++) {
    const ax = x + (i ? (R() - 0.5) * 16 : 0),
      ay = y + (i ? (R() - 0.5) * 16 : 0);
    const cc = cellAt(ax, ay);
    const w2 = cc >= 0 && isWaterT(gT(cc));
    const a = mkAnimal(
      sp,
      ax,
      ay,
      w2 && (S.mv === 'swim' || S.mv === 'whale' || sp === 'seal' || sp === 'goose' || sp === 'eider'),
      lead
    );
    if (!okMedium(a, ax, ay) && !a.fly && !['whale', 'swan', 'eider', 'seal', 'duck', 'goose'].includes(sp))
      continue;
    a.keepA = 1;
    if (sp === 'whale' && !w2) {
      a.state = 'surf';
      a.t = 1e9;
    }
    if (lead) {
      a.offx = ax - x;
      a.offy = ay - y;
    } else lead = a;
    animals.push(a);
    made++;
  }
  toast(made ? (made > 1 ? made + ' × ' : '') + S.is + ' · ' + S.en : "They can't live here");
}
function reBase(x, y, r) {
  nearB(x, y, r + 60, b => {
    const nz = hAt(b.cx, b.cy);
    if (nz !== b.z) {
      b.z = nz;
      dirtyB(b);
    }
  });
  nearT(x, y, r + 10, t => dirtyWorld(TREES.x[t], TREES.y[t], false, true));
}
function addTree(x, y, k) {
  const i = NT;
  NT++;
  for (const key of ['x', 'y', 'f', 'seed']) {
    const o = TREES[key];
    const n = new Float32Array(NT);
    n.set(o);
    TREES[key] = n;
  }
  for (const key of ['k', 's']) {
    const o = TREES[key];
    const n = new Uint8Array(NT);
    n.set(o);
    TREES[key] = n;
  }
  TREES.x[i] = x;
  TREES.y[i] = y;
  TREES.k[i] = k;
  TREES.seed[i] = R();
  badd(TBUCK, bkey(x, y), i);
  dirtyWorld(x, y, false, true);
}
function finishRoad(x, y) {
  if (!dragFrom) return;
  const [x0, y0] = dragFrom;
  dragFrom = null;
  const L = Math.hypot(x - x0, y - y0);
  if (L < 8) return;
  const steps = Math.ceil(L / 12);
  const ids = [];
  const a = nearestNode(x0, y0, GD, 25),
    b = nearestNode(x, y, GD, 25);
  if (a >= 0) ids.push(a);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    ids.push(addNode(x0 + (x - x0) * t, y0 + (y - y0) * t));
  }
  if (b >= 0) ids.push(b);
  const w = { nodes: Uint32Array.from(ids), cl: 5, name: 'Nýja gatan', br: 0 };
  WAYS.push(w);
  const wi = WAYS.length - 1;
  for (let j = 0; j + 1 < ids.length; j++) {
    segBucket(wi, j, ids[j], ids[j + 1]);
    dirtyWorld(NX[ids[j]], NY[ids[j]], true, false);
  }
  for (const n of ids) {
    const c = cellAt(NX[n], NY[n]);
    if (c >= 0 && c < FN && isWaterT(gT(c))) setCell(c, PIER, Math.max(2, gH(c)), 0);
  }
  GW = buildGraph(false);
  GD = buildGraph(true);
  toast('New street laid: ' + Math.round(L) + ' m');
}
function addNode(x, y) {
  const n = NODE_N;
  NODE_N++;
  const grow = (A, T) => {
    const z = new T(NODE_N);
    z.set(A);
    return z;
  };
  NX = grow(NX, Float32Array);
  NX[n] = x;
  NY = grow(NY, Float32Array);
  NY[n] = y;
  NODE_WATER = grow(NODE_WATER, Uint8Array);
  NDEG = grow(NDEG, Uint8Array);
  NDEG[n] = 2;
  badd(NBUCK, bkey(x, y), n);
  AS_g = new Float32Array(NODE_N);
  AS_p = new Int32Array(NODE_N);
  AS_s = new Uint32Array(NODE_N);
  return n;
}
