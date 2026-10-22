"""Roof colours and measured roof shapes from the 2025 Reykjavík aerial photo (data/rvk/osm_roof.json, made by sample/aerial_roofs.py).
Run by world/build_world.py (not on its own).
"""

import json as _j, numpy as _n, warnings as _w

_w.filterwarnings('ignore')


def _m(p, a, b):
    v = [x for x in p[a:b] if x >= 0]
    return _n.mean(v) if v else 0.0


def _cls(r):
    if r[5] > 245 and r[4] < 6:
        return None
    pa, pl = r[9], r[10]
    sA = abs(_m(pa, 1, 4) - _m(pa, 6, 9))
    sL = abs(_m(pl, 1, 4) - _m(pl, 6, 9))
    sd = r[4]
    if r[5] > 222:
        sA *= 0.75
        sL *= 0.75  # glare on white roofs makes fake steps
    hi, lo = max(sA, sL), min(sA, sL)
    if hi >= 14 and lo >= 12 and hi < 2 * lo:
        return 3, 0
    if hi >= 14 and hi >= 2.5 * max(lo, 3):
        return 2, (1 if sL > sA else 0)
    if hi < 7 and sd < 34:
        return 1, 0
    return 0, 0


_cnt = {0: 0, 1: 0, 2: 0, 3: 0, 'rgb': 0}
for _r in _j.load(open(paths.data('rvk/osm_roof.json'))):
    _b = bl[_r[0]]
    if _b.get('sp'):
        continue
    _c = _cls(_r)
    if _c is None:
        continue
    if 'rgb' not in _b:
        _b['rgb'] = (_r[1], _r[2], _r[3])
        _cnt['rgb'] += 1
    if _c[0]:
        _b['rsd'] = _c[0]
        _b['rx'] = _c[1]
    _cnt[_c[0]] += 1
print('osm_roof', _cnt)
