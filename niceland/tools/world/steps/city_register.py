"""Joins Reykjavík city building records (year built, floors, use, residents) onto the OSM footprints.
Run by world/build_world.py (not on its own).
"""

import json as _j, math as _m

_R = _j.load(open(paths.data('rvk/reykjavik-byggingar.json')))
_T = _j.load(open(paths.data('rvk/reykjavik-thok.json')))
_G = {}
_GS = 60
for i, b in enumerate(bl):
    p = b['p']
    xs = [q[0] for q in p]
    ys = [q[1] for q in p]
    b['bb'] = (min(xs), min(ys), max(xs), max(ys))
    for gx in range(int(min(xs) // _GS), int(max(xs) // _GS) + 1):
        for gy in range(int(min(ys) // _GS), int(max(ys) // _GS) + 1):
            _G.setdefault((gx, gy), []).append(i)


def _pip(p, x, y):
    ins = False
    n = len(p)
    j = n - 1
    for i in range(n):
        xi, yi = p[i]
        xj, yj = p[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            ins = not ins
        j = i
    return ins


KIND = {
    'Einbýlishús': 0,
    'Einbýli': 0,
    'Sérbýlishús': 0,
    'Tvíbýlishús': 0,
    'Raðhús': 1,
    'Parhús': 1,
    'Raðhús/Parhús': 1,
    'Sambýlishús': 2,
    'Fjölbýli': 2,
    'Fjölbýlishús': 2,
    'Bílskúr/skúr': 3,
    'Bílskúr': 3,
    'Bílsk': 3,
    'Geymsla': 3,
    'Bílgeymsla': 3,
    'Spennistöð': 3,
    'Versl/skrifstofuhús': 4,
    'Verslun/skrifstofur': 4,
    'Iðnaðarhús': 5,
    'Iðnaður': 5,
    'Vörugeymsla': 5,
    'Hesthús': 5,
    'Leikskóli': 6,
}
hit = 0
agg = {}
for k, (la, lo, yr, fl, notk, gerd, ibuar, ibud, flm, heiti, hnr) in enumerate(_R):
    x, y = ll(la, lo)
    best = None
    ba = 1e18
    for i in _G.get((int(x // _GS), int(y // _GS)), ()):
        b = bl[i]
        x0, y0, x1, y1 = b['bb']
        if x0 <= x <= x1 and y0 <= y <= y1 and _pip(b['p'], x, y):
            a = (x1 - x0) * (y1 - y0)
            if a < ba:
                ba = a
                best = i
    if best is None:
        bd = 12.0
        for i in _G.get((int(x // _GS), int(y // _GS)), ()):
            b = bl[i]
            cx = sum(q[0] for q in b['p']) / len(b['p'])
            cy = sum(q[1] for q in b['p']) / len(b['p'])
            d = _m.hypot(cx - x, cy - y)
            if d < bd:
                bd = d
                best = i
    if best is None:
        continue
    hit += 1
    a = agg.setdefault(best, {'yr': [], 'fl': 0, 'res': 0, 'k': {}, 'rgb': [], 'flm': 0})
    if yr:
        a['yr'].append(yr)
    if fl:
        a['fl'] = max(a['fl'], fl)
    a['res'] += ibuar or 0
    a['flm'] += flm or 0
    kk = KIND.get(notk)
    kk = KIND.get(gerd, kk) if kk is None else kk
    if gerd == 'Sambýlishús' and kk is None:
        kk = 2
    if kk is not None:
        a['k'][kk] = a['k'].get(kk, 0) + (flm or 1)
    t = _T[k]
    if len(t) >= 5:
        a['rgb'].append((t[2], t[3], t[4], flm or 1))
for i, a in agg.items():
    b = bl[i]
    if b['sp']:
        continue
    if a['yr']:
        b['yr'] = int(sorted(a['yr'])[len(a['yr']) // 2])
    if a['k']:
        k = max(a['k'], key=a['k'].get)
        if b['kind'] not in (6, 7, 8) or k in (0, 1, 2):
            b['kind'] = k
    if a['fl']:
        fh = 3.6 if b['kind'] in (4, 5, 6) else 2.9
        b['h'] = a['fl'] * fh + (0.4 if b['kind'] == 3 else 0.8)
        b['fl'] = a['fl']
    if a['res']:
        b['res'] = min(65000, a['res'])
    elif b['kind'] in (3, 4, 5):
        b['res'] = 0
    if a['rgb']:
        w = sum(c[3] for c in a['rgb'])
        b['rgb'] = tuple(int(sum(c[q] * c[3] for c in a['rgb']) / w) for q in range(3))
print('city records joined', hit, 'of', len(_R), '-> buildings', len(agg))
