"""Real 3D detail from OSM: building:part pieces (towers, wings, stacked volumes) and roof/colour tags.
Run by world/build_world.py (not on its own).
"""

import json as _j, re as _re, math as _m, collections as _c
from matplotlib.path import Path as _Path

_O = _j.load(open(paths.data('osm3d.json')))
_NAMED = {
    'white': (240, 240, 236),
    'grey': (150, 150, 148),
    'gray': (150, 150, 148),
    'silver': (190, 192, 194),
    'red': (170, 52, 44),
    'green': (70, 120, 80),
    'black': (46, 46, 48),
    'brown': (120, 84, 60),
    'yellow': (226, 200, 96),
    'beige': (222, 208, 176),
    'blue': (70, 100, 150),
    'lightgrey': (204, 204, 200),
    'lightgray': (204, 204, 200),
    'darkgrey': (90, 90, 92),
    'darkgray': (90, 90, 92),
    'orange': (210, 120, 60),
    'rautt': (170, 52, 44),
    'hvítt': (240, 240, 236),
    'grátt': (150, 150, 148),
    'svart': (46, 46, 48),
    'cream': (236, 226, 196),
    'maroon': (110, 40, 36),
    'darkgreen': (50, 90, 60),
    'teal': (60, 120, 120),
    'navy': (40, 50, 90),
    'pink': (220, 160, 160),
    'purple': (110, 70, 120),
}


def _col(v):
    if not v:
        return None
    v = v.strip().lower().split(';')[0]
    if v in _NAMED:
        return _NAMED[v]
    h = v.lstrip('#')
    if _re.fullmatch(r'[0-9a-f]{6}', h):
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
    if _re.fullmatch(r'[0-9a-f]{3}', h):
        return tuple(int(c * 2, 16) for c in h)
    return None


def _num(v):
    try:
        return float(str(v).split(';')[0].replace(',', '.').replace('m', '').strip())
    except Exception:
        return None


_RS = {
    'flat': 1,
    'gabled': 2,
    'gabled_height_moved': 2,
    'saltbox': 2,
    'round': 2,
    'hipped': 3,
    'half-hipped': 3,
    'side_half-hipped': 3,
    'mansard': 3,
    'gambrel': 3,
    'skillion': 4,
    'pyramidal': 5,
    'cone': 5,
    'dome': 6,
    'onion': 6,
}
# grid index of all building outlines
_G = _c.defaultdict(list)
_CS = 60.0
for _i, _b in enumerate(bl):
    xs = [q[0] for q in _b['p']]
    ys = [q[1] for q in _b['p']]
    for gx in range(int(min(xs) // _CS), int(max(xs) // _CS) + 1):
        for gy in range(int(min(ys) // _CS), int(max(ys) // _CS) + 1):
            _G[(gx, gy)].append(_i)
_PC = {}


def _find(x, y):
    best = None
    ba = 1e18
    for i in _G.get((int(x // _CS), int(y // _CS)), ()):
        if i not in _PC:
            _PC[i] = _Path(bl[i]['p'])
        if _PC[i].contains_point((x, y)):
            a = abs(parea(bl[i]['p']))
            if a < ba:
                ba = a
                best = i
    return best


def _proj(r):
    p = [ll(la, lo) for lo, la in r]
    if len(p) > 3 and p[0] == p[-1]:
        p = p[:-1]
    if parea(p) < 0:
        p = p[::-1]
    q = dp(p + [p[0]], 0.35)[:-1]
    return q if len(q) >= 3 else p


def _tags(b, d):
    rs = _RS.get(d.get('roof:shape'))
    if rs:
        b['rsd'] = rs
        b['rtag'] = 1
    if d.get('roof:orientation') == 'across':
        b['rx'] = 1
    rh = _num(d.get('roof:height'))
    if rh is None and _num(d.get('roof:levels')):
        rh = _num(d.get('roof:levels')) * 2.6
    if rh:
        b['rh'] = max(0.5, min(60, rh))
    wc = _col(d.get('building:colour') or d.get('colour'))
    if wc:
        b['wrgb'] = wc
    rc = _col(d.get('roof:colour'))
    if rc and 'rgb' not in b:
        b['rgb'] = rc
        b['rgbT'] = 1


_nt = 0
for d, r in _O['tagged']:
    p = _proj(r)
    cx = sum(q[0] for q in p) / len(p)
    cy = sum(q[1] for q in p) / len(p)
    i = _find(cx, cy)
    if i is None or bl[i].get('sp'):
        continue
    _tags(bl[i], d)
    _nt += 1
# parts
_byo = _c.defaultdict(list)
_HK = [None]
for d, r in _O['parts']:
    p = _proj(r)
    a = abs(parea(p))
    if a < 4:
        p = [ll(la, lo) for lo, la in r][:-1] if r[0] == r[-1] else [ll(la, lo) for lo, la in r]
        if parea(p) < 0:
            p = p[::-1]
        a = abs(parea(p))
        if a < 0.3:
            continue
    cx = sum(q[0] for q in p) / len(p)
    cy = sum(q[1] for q in p) / len(p)
    i = _find(cx, cy)
    if _m.hypot(cx - hall[0], cy - hall[1]) < 80 and i is None:
        # Hallgrímskirkja's parts have no plain outline in the extract: give them a hidden stand-in
        if _HK[0] is None:
            _HK[0] = len(bl)
            bl.append(
                dict(
                    p=p,
                    kind=8,
                    h=1,
                    base=0,
                    roof=0,
                    sp=0,
                    name='Hallgrímskirkja',
                    addr='Hallgrímstorg 1',
                    use='place_of_worship',
                    res=0,
                    jobs=12,
                    hide=1,
                    hk=1,
                )
            )
        i = _HK[0]
    if i is None or bl[i].get('sp'):
        continue
    _byo[i].append((d, p, a))
_np = 0
_hid = 0
for i, L in _byo.items():
    o = bl[i]
    oa = abs(parea(o['p']))
    cov = sum(a for _, _, a in L) / max(1, oa)
    # parts that give no height at all add nothing over the outline
    if not any(
        _num(d.get('height'))
        or _num(d.get('building:levels'))
        or _num(d.get('min_height'))
        or _num(d.get('building:min_level'))
        for d, _, _ in L
    ):
        continue
    hide = cov >= 0.55 or o.get('hk')
    _new = []
    if hide:
        o['hide'] = 1
        _hid += 1
    for d, p, a in L:
        top = _num(d.get('height'))
        lv = _num(d.get('building:levels'))
        rh = _num(d.get('roof:height'))
        if rh is None and _num(d.get('roof:levels')):
            rh = _num(d.get('roof:levels')) * 2.6
        base = _num(d.get('min_height'))
        if base is None and _num(d.get('building:min_level')) is not None:
            base = _num(d.get('building:min_level')) * 3.0
        base = base or 0.0
        if top is None:
            top = lv * 3.0 + (rh or 0) if lv else o['h'] + o.get('base', 0)
        wall = max(0.5, top - base - (rh or 0) if _RS.get(d.get('roof:shape'), 1) != 1 else top - base)
        nb = dict(
            hk=o.get('hk', 0),
            p=p,
            kind=o['kind'],
            h=min(wall, 200),
            base=min(base, 200),
            roof=0,
            sp=0,
            name=o['name'],
            addr=o['addr'],
            use=o['use'],
            res=0,
            jobs=0,
            po=i + 1,
        )
        for k2 in ('yr', 'fl'):
            if k2 in o:
                nb[k2] = o[k2]
        if not d.get('roof:colour') and 'rgb' in o:
            nb['rgb'] = o['rgb']
        _tags(nb, d)
        if 'wrgb' not in nb and 'wrgb' in o:
            nb['wrgb'] = o['wrgb']
        _new.append(nb)
        _np += 1
    # pieces stacked inside one another that all start at the same height: start each one on top of the piece that contains it
    for _b in _new:
        _pp = _Path(_b['p'])
        for _a in _new:
            if _a is _b:
                continue
            at = _a['base'] + _a['h']
            if (
                _a['base'] <= _b['base'] + 0.01
                and at < _b['base'] + _b['h'] - 0.01
                and at > _b['base']
                and _Path(_a['p']).contains_points(_b['p'], radius=0.4).all()
            ):
                _b['nb'] = max(_b.get('nb', 0), at)
    for _b in _new:
        if 'nb' in _b:
            _t = _b['base'] + _b['h']
            _b['base'] = _b.pop('nb')
            _b['h'] = max(0.3, _t - _b['base'])
    bl.extend(_new)
print('osm3d tagged', _nt, 'parts', _np, 'outlines hidden', _hid, 'of', len(_byo))
