"""Builds the map files from the extracted data:
  world.txt   terrain grids (10 m capital, 300 m Iceland), buildings with their records, road nodes and ways
  detail.txt  10 m land/sea/lake/glacier masks for coarse cells on a shoreline (steps/detail_mask.py)
  bldx.txt    extra per-building detail (OSM 3D parts, register data)
  roadx.txt   bridges, tunnels, one-way streets, lanes, speed limits, surfaces, fords, signals, signs, barriers
Run it after the extract scripts (see tools/README.md). It takes about ten minutes.
The steps in steps/ are run inside this script's namespace with step(name): they read and change its variables.
"""

import os, sys

if os.environ.get('PYTHONHASHSEED') != '0':  # same output every run (see run_all.py)
    os.environ['PYTHONHASHSEED'] = '0'
    os.execv(sys.executable, [sys.executable] + sys.argv)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402

STEPS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'steps')


def step(name):
    """Run steps/<name>.py here, sharing this script's variables."""
    exec(open(os.path.join(STEPS, name + '.py'), encoding='utf-8').read(), globals())


import json, math, random, struct, gzip, base64, collections
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

random.seed(1016)
np.random.seed(
    1016
)  # the forest trees use numpy's generator; without this every build placed them differently
D = paths.data()
cap = json.load(open(D + 'reykjavik-osm.json'))
ice = json.load(open(D + 'iceland-osm.json'))
lat0, lon0 = cap['origin']
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
GEOID = 66.0


def ll(lat, lon):
    return ((lon - lon0) * KX, (lat0 - lat) * KY)


import os as _os0

W3 = json.load(open(D + 'water3.json')) if _os0.path.exists(D + 'water3.json') else None
if W3:  # rings assembled by osmium: no chord-closed river banks, islands kept

    def _flat(r):
        return [int(round(v * 2)) for lo, la in r for v in ll(la, lo)]

    ice['water'] = [(_flat(o), nm) for o, inn, nm, w in W3 if len(o) >= 4]


def pts(flat):
    return [(flat[i] / 2.0, flat[i + 1] / 2.0) for i in range(0, len(flat), 2)]


def parea(p):
    a = 0
    for i in range(len(p)):
        x1, y1 = p[i]
        x2, y2 = p[(i + 1) % len(p)]
        a += x1 * y2 - x2 * y1
    return a / 2


def dp(p, eps):
    if len(p) < 3:
        return p
    a, b = p[0], p[-1]
    dmax, idx = 0, 0
    ax, ay = a
    bx, by = b
    L = math.hypot(bx - ax, by - ay) or 1e-9
    for i in range(1, len(p) - 1):
        px, py = p[i]
        dd = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L
        if dd > dmax:
            dmax, idx = dd, i
    if dmax > eps:
        l = dp(p[: idx + 1], eps)
        r = dp(p[idx:], eps)
        return l[:-1] + r
    return [a, b]


strings = ['']
sidx = {'': 0}


def S(s):
    if not s:
        return 0
    if s not in sidx:
        sidx[s] = len(strings)
        strings.append(s)
    return sidx[s]


SEA, LAKE, GRASS, PARK, WOOD, SCRUB, SAND, WET, ROCK, PAVED, RUNWAY, PITCH, GOLF, CEMETERY, PIER, RIVER = (
    range(16)
)
GLACIER, HIGH, URBAN = 18, 19, 20

# ======================= fine grid (capital, 10 m) =======================
CS = 10.0
OX, OY = -7070.0, -4330.0
W, H = 1442, 868


def cellpts(p, ox=OX, oy=OY, cs=CS):
    return [((x - ox) / cs, (y - oy) / cs) for x, y in p]


LANDMAP = {
    'u_grass': PARK,
    'u_village_green': PARK,
    'u_recreation_ground': PARK,
    'l_park': PARK,
    'l_garden': PARK,
    'l_playground': PARK,
    'l_dog_park': PARK,
    'l_nature_reserve': None,
    'n_wood': WOOD,
    'u_forest': WOOD,
    'n_scrub': SCRUB,
    'n_heath': SCRUB,
    'n_grassland': GRASS,
    'u_meadow': GRASS,
    'u_farmland': GRASS,
    'n_wetland': WET,
    'n_sand': SAND,
    'n_beach': SAND,
    'n_bare_rock': ROCK,
    'n_scree': ROCK,
    'mm_clearcut': GRASS,
    'parking': PAVED,
    'u_retail': PAVED,
    'u_commercial': PAVED,
    'u_industrial': PAVED,
    'u_construction': PAVED,
    'u_brownfield': ROCK,
    'u_railway': PAVED,
    'l_pitch': PITCH,
    'l_track': PITCH,
    'l_sports_centre': PITCH,
    'l_golf_course': GOLF,
    'l_disc_golf_course': PARK,
    'u_cemetery': CEMETERY,
    'aero_apron': RUNWAY,
    'aero_taxiway': RUNWAY,
    'aero_runway': RUNWAY,
    'mm_pier': PIER,
    'mm_breakwater': PIER,
    'mm_groyne': PIER,
}
img = Image.new('L', (W, H), GRASS)
dr = ImageDraw.Draw(img)
names = Image.new('I', (W, H), 0)
drn = ImageDraw.Draw(names)
lands = []
for c, cls, nm in cap['land']:
    t = LANDMAP.get(cls)
    p = pts(c)
    closed = len(p) > 2 and p[0] == p[-1]
    lands.append((abs(parea(p)) if closed else 0, t, p, closed, cls, nm))
lands.sort(key=lambda r: -r[0])
for a, t, p, closed, cls, nm in lands:
    cp = cellpts(p)
    if closed and len(cp) >= 3:
        if t is not None:
            dr.polygon(cp, fill=t)
        if nm:
            drn.polygon(cp, fill=S(nm))
    elif t is not None:
        dr.line(cp, fill=t, width=max(1, int({'aero_runway': 45, 'aero_taxiway': 18}.get(cls, 6) / CS)))
# water areas that swallow whole neighbourhoods are mapping errors (old Árbæjarlón / Elliðaár riverbank rings): skip them
from matplotlib.path import Path as _WP

_BC = np.array(
    [(sum(e[0][0::2]) / len(e[0][0::2]) / 2.0, sum(e[0][1::2]) / len(e[0][1::2]) / 2.0) for e in cap['b']]
)


def _swallows(p):
    xs = [q[0] for q in p]
    ys = [q[1] for q in p]
    m = (_BC[:, 0] > min(xs)) & (_BC[:, 0] < max(xs)) & (_BC[:, 1] > min(ys)) & (_BC[:, 1] < max(ys))
    if len(p) > 30 and not W3:
        # a curvy outline closed by one long straight edge is a river bank whose other side went missing
        ed = [math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) for i in range(len(p))]
        if max(ed) > 100 and max(ed) > 0.2 * sum(ed):
            return True
    return m.sum() >= 15 and _WP(p).contains_points(_BC[m]).sum() >= 15


_wskip = 0
if W3:
    _wm = Image.new('1', (W, H), 0)
    _dwm = ImageDraw.Draw(_wm)
    for o, inn, nm, w in W3:
        lo0 = sum(q[0] for q in o) / len(o)
        la0 = sum(q[1] for q in o) / len(o)
        x0, y0 = ll(la0, lo0)
        if not (OX - 3000 < x0 < OX + W * CS + 3000 and OY - 3000 < y0 < OY + H * CS + 3000):
            continue
        cp = cellpts([ll(la, lo) for lo, la in o])
        if len(cp) < 3:
            continue
        _dwm.polygon(cp, fill=1)
        for r in inn:
            ci = cellpts([ll(la, lo) for lo, la in r])
            if len(ci) >= 3:
                _dwm.polygon(ci, fill=0)
    _wa = np.array(_wm, dtype=bool)
    _ga = np.array(img, dtype=np.uint8)
    _ga[_wa] = LAKE
    img = Image.fromarray(_ga)
    dr = ImageDraw.Draw(img)
else:
    for c in cap['water']:
        _p = pts(c)
        if len(_p) >= 3 and _swallows(_p):
            _wskip += 1
            continue
        cp = cellpts(_p)
        if len(cp) >= 3:
            dr.polygon(cp, fill=LAKE)
print('water polygons skipped', _wskip)
for c, kind in cap['river']:
    dr.line(cellpts(pts(c)), fill=RIVER, width=2 if kind == 'river' else 1)
g = np.array(img, dtype=np.uint8)
NMR = np.array(names, dtype=np.int64)
wall = Image.new('1', (W, H), 0)
dw = ImageDraw.Draw(wall)
for c in cap['coast']:
    dw.line(cellpts(pts(c)), fill=1, width=2)
wall = np.array(wall, dtype=bool)
lbl, n = ndimage.label(~wall)
sea_l = set()
for x, y in [(-3000, -4300), (-6500, -500)]:
    cx, cy = int((x - OX) / CS), int((y - OY) / CS)
    if lbl[cy, cx]:
        sea_l.add(lbl[cy, cx])
# every region the coastlines cut the capital grid into is sea or land by the coastline's own direction
# (OpenStreetMap draws coastlines with land on the left), so pockets of sea at the grid edges are not mistaken for land
_sv = np.zeros(n + 1)
_lv = np.zeros(n + 1)
for c in cap['coast']:
    cp = cellpts(pts(c))
    for (x1, y1), (x2, y2) in zip(cp, cp[1:]):
        dx, dy = x2 - x1, y2 - y1
        L = (dx * dx + dy * dy) ** 0.5
        if L < 0.5:
            continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        nx, ny = dy / L, -dx / L  # land side in grid coordinates (y points south)
        for sgn, acc in ((1, _lv), (-1, _sv)):
            for off in (2.5, 4.0):
                px, py = int(mx + nx * off * sgn), int(my + ny * off * sgn)
                if 0 <= px < W and 0 <= py < H and lbl[py, px]:
                    acc[lbl[py, px]] += 1
_known = set(sea_l)
for r in range(1, n + 1):
    if _sv[r] > _lv[r] * 1.5 and _sv[r] >= 3:
        sea_l.add(r)
print(
    'sea regions by coastline direction',
    len(sea_l) - len(_known),
    'added; seeds agree',
    all(_sv[r] >= _lv[r] for r in _known),
)
sea = np.isin(lbl, list(sea_l))
near = ndimage.uniform_filter(sea.astype(float), 3)
sea |= wall & (near > 0.45)
g[sea & (g != PIER)] = SEA
shore = ndimage.binary_dilation(sea, iterations=1) & ~sea
g[shore & (g == GRASS)] = SAND
# real heights: Terrarium is a surface model on the ellipsoid; drop the geoid, remove buildings, smooth
dem = np.fromfile(D + 'capital-dem.bin', dtype='<i2').reshape(H, W).astype(np.float32)
dem = np.where(dem > -50, dem, 0)
land_h = dem - GEOID
land_h = ndimage.grey_opening(land_h, size=(9, 9))  # buildings and trees are narrower than 90 m
land_h = ndimage.median_filter(land_h, size=5)
land_h = ndimage.gaussian_filter(land_h, 1.6)
hgt = np.clip(np.round(land_h), 1, 400).astype(np.int16)
hgt[sea] = 0
print('fine heights', np.percentile(hgt[~sea], [5, 50, 95, 100]))

# ======================= coarse grid (Iceland, 300 m) =======================
CCS = 300.0
COX, COY = -132000.0, -274000.0
CW, CH = 1830, 1235
cdem = np.fromfile(D + 'iceland-dem.bin', dtype='<i2').reshape(CH, CW).astype(np.float32)
csea = cdem <= 2
# remove tiny inland 'sea' blobs (they are lakes or noise): keep the component(s) touching the border
lab, nl = ndimage.label(csea)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
csea = np.isin(lab, list(edge))
# Land and sea from the coastlines themselves, at 100 m: every region the coastlines cut Iceland into is sea or land
# by the side of the coastline it lies on (OpenStreetMap draws coastlines with land on the left). The elevation test
# above called low-lying land sea (the Landeyjar and Ölfus flats are about 2 m above the sea, and the elevation
# model's 300 m cells round them down); it now only decides regions that no coastline touches.
_coast = json.load(open(D + 'coast.json'))
_R = 100.0
_W, _H = int(CW * CCS / _R), int(CH * CCS / _R)
_wim = Image.new('1', (_W, _H), 0)
_wd = ImageDraw.Draw(_wim)
_lines = []
for _c in _coast:
    _p = [((_c[i] / 2 - COX) / _R, (_c[i + 1] / 2 - COY) / _R) for i in range(0, len(_c), 2)]
    _lines.append(_p)
    _wd.line(_p, fill=1, width=1)
_wall = np.array(_wim, dtype=bool)
_lab, _n = ndimage.label(~_wall)
_lv = np.zeros(_n + 1)
_sv = np.zeros(_n + 1)
for _p in _lines:
    for (x1, y1), (x2, y2) in zip(_p, _p[1:]):
        dx, dy = x2 - x1, y2 - y1
        L = (dx * dx + dy * dy) ** 0.5
        if L < 0.3:
            continue
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        nx, ny = dy / L, -dx / L  # land side (y points south)
        for sgn, acc in ((1, _lv), (-1, _sv)):
            for off in (1.5, 3.0):
                px, py = int(mx + nx * off * sgn), int(my + ny * off * sgn)
                if 0 <= px < _W and 0 <= py < _H and _lab[py, px]:
                    acc[_lab[py, px]] += 1
_dsea = np.kron(csea, np.ones((3, 3), bool))[:_H, :_W]
_rs = ndimage.mean(_dsea, _lab, index=np.arange(_n + 1)) > 0.5  # elevation vote for regions no coastline touches
_rs = np.where((_sv > _lv * 1.5) & (_sv >= 3), True, np.where((_lv > _sv * 1.5) & (_lv >= 3), False, _rs))
_rs[0] = False
_fsea = _rs[_lab]
_fsea = np.where(_wall, ndimage.uniform_filter(_fsea.astype(np.float32), 3) > 0.5, _fsea)
_csea2 = _fsea[: CH * 3, : CW * 3].reshape(CH, 3, CW, 3).mean(axis=(1, 3)) > 0.5
# the capital has its own 10 m land/sea from its coastlines: leave the coarse cells under it as they were
_gj, _gi = np.mgrid[0:CH, 0:CW]
_ccx, _ccy = COX + (_gi + 0.5) * CCS, COY + (_gj + 0.5) * CCS
_incap = (_ccx > OX) & (_ccx < OX + W * CS) & (_ccy > OY) & (_ccy < OY + H * CS)
_csea2[_incap] = csea[_incap]
print('coast-direction land/sea: cells changed', int((_csea2 != csea).sum()), 'to land', int((csea & ~_csea2).sum()))
csea = _csea2
ch = np.where(
    csea, np.minimum(cdem, -1), np.maximum(1, cdem)
)  # the national DEM is already relative to sea level (unlike the capital DSM)
CHGT = ch
cg = np.full((CH, CW), GRASS, np.uint8)
cg[csea] = SEA
cimg = Image.fromarray(cg)
cdr = ImageDraw.Draw(cimg)
cnames = Image.new('I', (CW, CH), 0)
cdn = ImageDraw.Draw(cnames)


def ccp(p):
    return [((x - COX) / CCS, (y - COY) / CCS) for x, y in p]


nat = ice


def big(p):
    return len(p) > 2 and abs(parea(p)) > 3e5


for c, cls, nm in sorted(nat['land'], key=lambda r: -abs(parea(pts(r[0])))):
    p = pts(c)
    if len(p) < 3:
        continue
    t = {'sand': SAND, 'wood': WOOD, 'forest': WOOD, 'bare_rock': HIGH, 'scree': HIGH}.get(cls)
    if t is not None and abs(parea(p)) > 2e4:
        cdr.polygon(ccp(p), fill=t)
for c, nm in nat['glacier']:
    p = pts(c)
    if len(p) >= 3:
        cdr.polygon(ccp(p), fill=GLACIER)
        cdn.polygon(ccp(p), fill=S(nm)) if nm else None
for c, nm in nat['water']:
    p = pts(c)
    if len(p) >= 3 and abs(parea(p)) > 6e4 and not _swallows(p):
        cdr.polygon(ccp(p), fill=LAKE)
        if nm:
            cdn.polygon(ccp(p), fill=S(nm))
cg = np.array(cimg)
cg[csea] = SEA
CNM = np.array(cnames, dtype=np.int64)
# lakes are flat: use the minimum surrounding height
lk = cg == LAKE
lab, nl = ndimage.label(lk)
if nl:
    mins = ndimage.minimum(ch, lab, index=np.arange(1, nl + 1))
    ch[lk] = np.array(mins)[lab[lk] - 1]
print('coarse land fraction', 1 - csea.mean(), 'glacier cells', (cg == GLACIER).sum(), 'max h', ch.max())

FSEA = sea.copy()
step('detail_mask')

# ======================= buildings =======================
TYPE = {
    'house': 0,
    'detached': 0,
    'semidetached_house': 0,
    'cabin': 0,
    'farm': 0,
    'bungalow': 0,
    'terrace': 1,
    'residential': 2,
    'apartments': 3,
    'dormitory': 3,
    'garage': 4,
    'garages': 4,
    'shed': 4,
    'roof': 4,
    'carport': 4,
    'greenhouse': 4,
    'hut': 4,
    'kiosk': 4,
    'stable': 4,
    'toilets': 4,
    'container': 4,
    'bunker': 4,
    'commercial': 5,
    'retail': 5,
    'office': 5,
    'supermarket': 5,
    'hotel': 5,
    'industrial': 6,
    'warehouse': 6,
    'service': 6,
    'hangar': 6,
    'manufacture': 6,
    'transportation': 6,
    'barn': 6,
    'cowshed': 6,
    'farm_auxiliary': 6,
    'sty': 6,
    'storage_tank': 6,
    'school': 7,
    'kindergarten': 7,
    'university': 7,
    'college': 7,
    'public': 7,
    'civic': 7,
    'government': 7,
    'hospital': 7,
    'sports_hall': 7,
    'sports_centre': 7,
    'library': 7,
    'museum': 7,
    'church': 8,
    'chapel': 8,
    'cathedral': 8,
    'yes': 9,
    'construction': 9,
}
hall = ll(64.14197, -21.92659)
bl = []


def add_building(e, capital):
    p = pts(e[0])
    if len(p) > 3 and p[0] == p[-1]:
        p = p[:-1]
    if len(p) < 3:
        return
    a = parea(p)
    if a < 0:
        p = p[::-1]
        a = -a
    if a < 8:
        return
    cx = sum(q[0] for q in p) / len(p)
    cy = sum(q[1] for q in p) / len(p)
    if math.hypot(cx - hall[0], cy - hall[1]) < 45:
        return
    q = dp(p + [p[0]], 0.45)[:-1]
    if len(q) >= 3:
        p = q
    t = TYPE.get(e[1], 9)
    lev = None
    try:
        lev = float(str(e[2]).split(';')[0].replace(',', '.'))
    except:
        pass
    hh = None
    try:
        hh = float(str(e[3]).replace('m', '').replace(',', '.').strip())
    except:
        pass
    rnd = random.random()
    if t == 9:
        if a < 45:
            t = 4
        elif a < 260:
            t = 0
        elif a < 900:
            t = 2 if capital else 6
        else:
            t = 5 if capital else 6
    if t == 2:
        t = 0 if a < 230 else 3
    kind = {0: 0, 1: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7}.get(t, 0)
    if lev is None:
        lev = {
            0: 1 + (rnd < (0.55 if capital else 0.3)) + (rnd < 0.12 and capital),
            1: 2,
            2: 3 + int(rnd * 3) + (a > 900) * 2,
            3: 1,
            4: 2 + int(rnd * 3),
            5: 1.3 + rnd * 0.6,
            6: 2 + int(rnd * 2),
            7: 2,
        }[kind]
    if hh is None:
        fh = 3.6 if kind in (4, 5, 6) else 3.0
        hh = lev * fh + (0.3 if kind == 3 else 0.6)
        if kind == 3:
            hh = 2.8
    nm = e[4]
    special = 0
    if capital and nm == 'Harpa':
        special = 2
        hh = 43
        kind = 8
    elif capital and nm == 'Perlan':
        special = 3
        kind = 8
    elif capital and nm == 'Höfði':
        special = 4
    if kind == 7 and hh > 16:
        hh = 14
    hh = min(hh, 90)
    roof = 0
    if kind in (0, 1, 7) and len(p) == 4 and special == 0:
        roof = 1
    elif kind == 5 and len(p) == 4 and not capital and a < 900:
        roof = 1
    elif kind == 0 and len(p) <= 8 and special == 0 and rnd < 0.5:
        roof = 2
    addr = (e[5] + ' ' + e[6]).strip() if e[5] else ''
    if kind == 0:
        res = 2 + int(rnd * 3)
    elif kind == 1:
        res = 3
    elif kind == 2:
        res = max(4, int(a * max(1, lev) / 85 * 2.2))
    else:
        res = 0
    jobs = int(a * lev / 25) if kind in (4, 5, 6) else 0
    bl.append(
        dict(
            p=p,
            kind=kind,
            h=hh,
            roof=roof,
            sp=special,
            name=nm,
            addr=addr,
            use=e[7],
            res=min(res, 65000),
            jobs=min(jobs, 65000),
        )
    )


for e in cap['b']:
    add_building(e, True)
nc = len(bl)
for e in ice['b']:
    add_building(e, False)
print('buildings capital', nc, 'rest', len(bl) - nc)
step('addresses')
step('city_register')
step('population')
import os as _os

if _os.path.exists(paths.data('rvk/osm_roof.json')):
    step('aerial_roofs')
else:
    import pyproj as _pp

    _tr = _pp.Transformer.from_crs(4326, 3057, always_xy=True)
    _d = []
    for _i, _b in enumerate(bl):
        _ps = []
        for x, y in _b['p']:
            lo = x / KX + lon0
            la = lat0 - y / KY
            X, Y = _tr.transform(lo, la)
            _ps += [round(X, 1), round(Y, 1)]
        if 353000 < _ps[0] < 384200 and 395900 < _ps[1] < 427100 and not _b['sp']:
            _d.append([_i] + _ps)
    json.dump(_d, open(paths.data('rvk/bl_isn93.json'), 'w'), separators=(',', ':'))
    print('dumped', len(_d))
step('osm_3d')


def rect(cx, cy, ang, u0, u1, v0, v1):
    ca, sa = math.cos(ang), math.sin(ang)
    out = []
    for u, v in [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]:
        out.append((cx + u * ca - v * sa, cy + u * sa + v * ca))
    if parea(out) < 0:
        out = out[::-1]
    return out


def ngon(cx, cy, r, n):
    o = [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    if parea(o) < 0:
        o = o[::-1]
    return o


# Hallgrímskirkja itself now comes from the detailed OpenStreetMap 3D model (addr/osm3d_apply.py);
# here only the statue of Leifur Eiríksson on its granite plinth in front of it
lx, ly = ll(64.14236, -21.92735)
_pi = len(bl)
bl.append(
    dict(
        p=rect(lx, ly, 0.6, -2.4, 2.4, -1.6, 1.6),
        kind=8,
        h=5.6,
        base=0,
        roof=0,
        sp=0,
        name='Leifur Eiríksson',
        addr='Hallgrímstorg',
        use='artwork',
        res=0,
        jobs=0,
        po=_pi + 1,
        wrgb=(132, 118, 108),
        rgb=(140, 126, 116),
        rgbT=1,
        statue=1,
    )
)
bl.append(
    dict(
        p=rect(lx, ly, 0.6, -0.9, 0.9, -0.7, 0.7),
        kind=8,
        h=5.2,
        base=5.6,
        roof=0,
        sp=0,
        name='Leifur Eiríksson',
        addr='Hallgrímstorg',
        use='artwork',
        res=0,
        jobs=0,
        po=_pi + 1,
        wrgb=(64, 82, 72),
        rgb=(70, 90, 78),
        rgbT=1,
        statue=2,
    )
)
vx, vy = ll(64.14760, -21.92230)
bl.append(
    dict(
        p=rect(vx, vy, 0.3, -9, 9, -1.2, 1.2),
        kind=8,
        h=1.2,
        roof=0,
        sp=5,
        name='Sólfar',
        addr='Sæbraut',
        use='artwork',
        res=0,
        jobs=0,
    )
)
# towns on the coarse grid
cnt = np.zeros((CH, CW), np.int32)
for b in bl:
    cx = sum(q[0] for q in b['p']) / len(b['p'])
    cy = sum(q[1] for q in b['p']) / len(b['p'])
    i, j = int((cx - COX) / CCS), int((cy - COY) / CCS)
    if 0 <= i < CW and 0 <= j < CH:
        cnt[j, i] += 1
urban = (cnt >= 6) & (cg != SEA) & (cg != LAKE)
cg[urban] = URBAN

step('roads')

# ======================= trees =======================
trees = []
for y, x in zip(*np.nonzero((g == WOOD) | (g == PARK) | (g == SCRUB) | (g == CEMETERY) | (g == GRASS))):
    t = g[y, x]
    pr = {WOOD: 1.3, PARK: 0.16, SCRUB: 0.35, CEMETERY: 0.5, GRASS: 0.02}[t]
    while pr > 0:
        if random.random() < pr:
            px = OX + (x + random.random()) * CS
            py = OY + (y + random.random()) * CS
            trees.append(
                (px, py, 2 if t == SCRUB else (0 if random.random() < (0.55 if t == WOOD else 0.3) else 1))
            )
        pr -= 1
# garden shrubs along the walls of houses
_ns = 0
for b in bl[:nc]:
    if b['kind'] > 1 or b.get('sp'):
        continue
    p = b['p']
    n = len(p)
    a_ = abs(parea(p))
    if a_ < 50 or a_ > 450:
        continue
    cx = sum(q[0] for q in p) / n
    cy = sum(q[1] for q in p) / n
    for _ in range(2 + (random.random() < 0.5)):
        j = random.randrange(n)
        q0 = p[j]
        q1 = p[(j + 1) % n]
        t = 0.15 + random.random() * 0.7
        mx, my = q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t
        dx, dy = mx - cx, my - cy
        L = math.hypot(dx, dy) or 1
        off = 1.4 + random.random() * 1.8
        trees.append((mx + dx / L * off, my + dy / L * off, 2))
        _ns += 1
print('garden shrubs', _ns)
bmask = Image.new('1', (W * 2, H * 2), 0)
db = ImageDraw.Draw(bmask)
for b in bl[:nc]:
    db.polygon([((x - OX) / 5, (y - OY) / 5) for x, y in b['p']], fill=1)
bmask = np.array(bmask)
keep = []
for x, y, k in trees:
    ix, iy = int((x - OX) / 5), int((y - OY) / 5)
    if 0 <= ix < W * 2 and 0 <= iy < H * 2 and not bmask[iy, ix]:
        keep.append((x, y, k))
trees = keep
# forests in the rest of Iceland, e.g. Hallormsstaðaskógur and Heiðmörk
extra = 0
for c, cls, nm in ice['land']:
    if cls not in ('wood', 'forest'):
        continue
    p = pts(c)
    if len(p) < 3:
        continue
    a = abs(parea(p))
    xs = [q[0] for q in p]
    ys = [q[1] for q in p]
    if min(xs) > OX and max(xs) < OX + W * CS and min(ys) > OY and max(ys) < OY + H * CS:
        continue
    from matplotlib.path import Path

    path = Path(p)
    n = int(min(a / 140, 4000))
    if n < 1:
        continue
    cand = np.column_stack(
        [np.random.uniform(min(xs), max(xs), n * 2), np.random.uniform(min(ys), max(ys), n * 2)]
    )
    inside = cand[path.contains_points(cand)][:n]
    for x, y in inside:
        trees.append((x, y, 0 if random.random() < 0.45 else 1))
        extra += 1
    if extra > 60000:
        break
print('trees', len(trees), 'forest extra', extra)

# ======================= places =======================
places = [[p[0], p[1], p[2], p[3], p[4]] for p in ice['place']]
print('places', len(places))

# ======================= write =======================
buf = bytearray()


def pad():
    while len(buf) % 4:
        buf.append(0)


def arr(a, dt):
    pad()
    b = np.asarray(a, dtype=dt).tobytes()
    buf.extend(struct.pack('<I', len(b)))
    buf.extend(b)


anc = []
starts = [0]
verts = []
for b in bl:
    ax = int(round(b['p'][0][0] * 2))
    ay = int(round(b['p'][0][1] * 2))
    anc += [ax, ay]
    for x, y in b['p']:
        verts += [int(round(x * 2)) - ax, int(round(y * 2)) - ay]
    starts.append(len(verts) // 2)
nmi = [S(b['name']) for b in bl]
adi = [S(b['addr']) for b in bl]
usi = [S(b['use']) for b in bl]
meta = dict(
    v=2,
    fine=dict(W=W, H=H, cs=CS, ox=OX, oy=OY),
    coarse=dict(W=CW, H=CH, cs=CCS, ox=COX, oy=COY),
    origin=[lat0, lon0],
    kx=KX,
    ky=KY,
    strings=strings,
    places=places,
)
mj = json.dumps(meta, ensure_ascii=False).encode('utf8')
buf.extend(b'SMV2')
buf.extend(struct.pack('<I', 0))
buf.extend(mj)
while len(buf) % 4:
    buf.extend(b' ')
buf[4:8] = struct.pack('<I', len(buf) - 8)


def EXAG(h):
    h = np.asarray(h, float)
    return h  # real heights (no exaggeration)   # lift the low hills the city sits on, leave mountains alone


arr(g.ravel(), '<u1')
arr(np.round(EXAG(hgt)).astype(np.int16).ravel(), '<i2')
arr(np.clip(NMR, 0, 2**32 - 1).ravel(), '<u4')
arr(cg.ravel(), '<u1')
arr(np.clip(np.round(EXAG(ch)), -3000, 3000).ravel(), '<i2')
arr(np.clip(CNM, 0, 2**32 - 1).ravel(), '<u4')
arr(anc, '<i4')
arr(starts, '<u4')
arr(verts, '<i2')
arr([int(min(65535, b['h'] * 10)) for b in bl], '<u2')
arr([int(b.get('base', 0) * 10) for b in bl], '<u2')
arr([b['kind'] for b in bl], '<u1')
arr([b['roof'] for b in bl], '<u1')
arr([b['sp'] for b in bl], '<u1')
arr(nmi, '<u4')
arr(adi, '<u4')
arr(usi, '<u4')
arr([b['res'] for b in bl], '<u2')
arr([b['jobs'] for b in bl], '<u2')
arr([v for k in nlist for v in k], '<i4')
ws = [0]
wn = []
for seq, cl, nmw, br in ways:
    wn += seq
    ws.append(len(wn))
arr(ws, '<u4')
arr(wn, '<u4')
arr([w[1] for w in ways], '<u1')
arr([w[2] for w in ways], '<u4')
arr([w[3] for w in ways], '<u1')
arr([int(round(v * 2)) for t in trees for v in t[:2]], '<i4')
arr([t[2] for t in trees], '<u1')
assert json.loads(mj)['strings'] is not None and len(strings) == len(meta['strings'])
# extra per-building info: year, floors, aerial roof colour (in a side file so the world format stays the same)
bx = bytearray(b'SMBX')
bx += struct.pack('<I', len(bl))
bx += np.asarray([b.get('yr', 0) for b in bl], '<u2').tobytes()
bx += np.asarray([b.get('fl', 0) for b in bl], '<u1').tobytes()
bx += np.asarray([c for b in bl for c in (b['rgb'] if 'rgb' in b else (0, 0, 0))], '<u1').tobytes()
bx += np.asarray([1 if 'rgb' in b else 0 for b in bl], '<u1').tobytes()
bx += np.asarray([b.get('rsd', 0) for b in bl], '<u1').tobytes()
bx += np.asarray([b.get('rx', 0) for b in bl], '<u1').tobytes()
bx += np.asarray(
    [
        (1 if b.get('hide') else 0)
        | (2 if 'wrgb' in b else 0)
        | (4 if b.get('rgbT') else 0)
        | (8 if b.get('rtag') else 0)
        | (16 if b.get('statue') == 2 else 0)
        | (64 if b.get('statue') == 1 else 0)
        | (32 if b.get('hk') else 0)
        for b in bl
    ],
    '<u1',
).tobytes()
bx += np.asarray([c for b in bl for c in b.get('wrgb', (0, 0, 0))], '<u1').tobytes()
bx += np.asarray([min(255, int(round(b.get('rh', 0) * 4))) for b in bl], '<u1').tobytes()
bx += np.asarray([b.get('po', 0) for b in bl], '<u4').tobytes()
open(paths.out('bldx.txt'), 'w').write(base64.b64encode(gzip.compress(bytes(bx), 9)).decode())
raw = bytes(buf)
gz = gzip.compress(raw, 9)
open(paths.out('world.txt'), 'w').write(base64.b64encode(gz).decode())
print('raw', len(raw), 'gz', len(gz), 'b64', len(gz) * 4 // 3)
pal = np.zeros((32, 3), np.uint8)
for i, c in enumerate(
    [
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
    ]
):
    pal[i] = c
Image.fromarray(pal[cg]).save(paths.data('coarse.png'))  # preview of the 100 m land classes
