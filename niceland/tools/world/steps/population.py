"""Scales residents per municipality to Statistics Iceland figures for 1 January 2025.
Run by world/build_world.py (not on its own).
"""

import json as _j
from shapely import wkt as _wkt
from shapely.strtree import STRtree as _ST
from shapely.geometry import Point as _Pt

_POP = {
    'Reykjavík': 138772,
    'Kópavogur': 40040,
    'Hafnarfjörður': 31525,
    'Garðabær': 20116,
    'Mosfellsbær': 13715,
    'Seltjarnarnes': 4585,
    'Kjósarhreppur': 301,
    'Reykjanesbær': 22499,
    'Suðurnesjabær': 4091,
    'Grindavíkurbær': 1246,
    'Vogar': 1741,
    'Akranes': 8285,
    'Borgarbyggð': 4102,
    'Snæfellsbær': 1669,
    'Stykkishólmur': 1285,
    'Grundarfjarðarbær': 826,
    'Hvalfjarðarsveit': 760,
    'Dalabyggð': 645,
    'Eyja- og Miklaholtshreppur': 124,
    'Ísafjarðarbær': 3832,
    'Vesturbyggð': 1314,
    'Bolungarvík': 995,
    'Strandabyggð': 405,
    'Reykhólahreppur': 246,
    'Súðavíkurhreppur': 209,
    'Kaldrananeshreppur': 115,
    'Skagafjörður': 4316,
    'Húnabyggð': 1374,
    'Húnaþing vestra': 1203,
    'Skagaströnd': 462,
    'Akureyri': 20050,
    'Norðurþing': 3114,
    'Fjallabyggð': 1966,
    'Dalvíkurbyggð': 1906,
    'Þingeyjarsveit': 1453,
    'Eyjafjarðarsveit': 1184,
    'Hörgársveit': 847,
    'Langanesbyggð': 560,
    'Svalbarðsstrandarhreppur': 504,
    'Grýtubakkahreppur': 389,
    'Múlaþing': 5232,
    'Fjarðabyggð': 5247,
    'Vopnafjarðarhreppur': 648,
    'Fljótsdalshreppur': 90,
    'Árborg': 12064,
    'Vestmannaeyjar': 4470,
    'Hveragerði': 3300,
    'Ölfus': 2757,
    'Hornafjörður': 2589,
    'Rangárþing eystra': 2073,
    'Rangárþing ytra': 1940,
    'Bláskógabyggð': 1362,
    'Mýrdalshreppur': 965,
    'Hrunamannahreppur': 914,
    'Flóahreppur': 726,
    'Skaftárhreppur': 627,
    'Skeiða- og Gnúpverjahreppur': 617,
    'Grímsnes- og Grafningshreppur': 575,
    'Ásahreppur': 299,
}
_M = _j.load(open(paths.data('muni.json')))


def _norm(s):
    return s.replace('Sveitarfélagið ', '').lower()


def _match(osm):
    o = _norm(osm)
    best = None
    bl_ = 0
    for k in _POP:
        kk = _norm(k)
        if kk == o:
            return k
        n = 0
        while n < min(len(kk), len(o)) and kk[n] == o[n]:
            n += 1
        if n >= 6 and n > bl_ and (n == len(kk) or n >= 7):
            bl_ = n
            best = k
    return best


_G = []
_T = []
for n, w in _M:
    k = _match(n)
    if k:
        _G.append(_wkt.loads(w))
        _T.append(k)
_tree = _ST(_G)
_by = {}
_sum = {}
for _i, _b in enumerate(bl):
    if not _b.get('res'):
        continue
    xs = [p[0] for p in _b['p']]
    ys = [p[1] for p in _b['p']]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    pt = _Pt(cx / KX + lon0, lat0 - cy / KY)
    hit = None
    for gi in _tree.query(pt):
        if _G[gi].contains(pt):
            hit = _T[gi]
            break
    if hit:
        _by.setdefault(hit, []).append(_i)
        _sum[hit] = _sum.get(hit, 0) + _b['res']
_tot0 = 0
_tot1 = 0
for k, ids in _by.items():
    f = _POP[k] / max(1, _sum[k])
    acc = 0.0
    for i in ids:
        acc += bl[i]['res'] * f
        v = int(round(acc))
        acc -= v
        bl[i]['res'] = max(0, min(65000, v))
    _tot0 += _sum[k]
    _tot1 += sum(bl[i]['res'] for i in ids)
print('residents by municipality', len(_by), 'of', len(_POP), 'before', _tot0, 'after', _tot1)
for k in ['Reykjavík', 'Kópavogur', 'Hafnarfjörður', 'Akureyri', 'Reykjanesbær']:
    print(' ', k, _sum.get(k), '->', _POP[k])
