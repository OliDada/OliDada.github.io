"""Geysers, springs, plants and waterfalls -> geo.txt.
In: data/geo.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, gzip, base64, math, re

lat0, lon0 = 64.124, -21.89
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
xy = lambda lo, la: ((lo - lon0) * KX, (lat0 - la) * KY)
G = json.load(open(paths.data('geo.json')))
# known widths (m) of the big falls; heights come from OSM where tagged
FW = {
    'Dettifoss': 100,
    'Gullfoss': 40,
    'Skógafoss': 25,
    'Seljalandsfoss': 8,
    'Goðafoss': 30,
    'Svartifoss': 6,
    'Glymur': 4,
    'Háifoss': 5,
    'Hengifoss': 5,
    'Dynjandi': 40,
    'Selfoss': 90,
    'Hraunfossar': 300,
    'Aldeyjarfoss': 15,
    'Kirkjufellsfoss': 10,
    'Öxarárfoss': 6,
    'Brúarfoss': 8,
    'Barnafoss': 5,
    'Urriðafoss': 100,
    'Faxi': 70,
    'Gljúfrabúi': 3,
    'Hjálparfoss': 10,
    'Kvernufoss': 5,
    'Fagrifoss': 20,
    'Gluggafoss': 5,
    'Litlanesfoss': 4,
}
FH = {
    'Gullfoss': 32,
    'Goðafoss': 12,
    'Dynjandi': 100,
    'Hjálparfoss': 14,
    'Gluggafoss': 44,
    'Litlanesfoss': 30,
}
FAM = {
    'Dettifoss': (65.8147, -16.3846),
    'Gullfoss': (64.3266, -20.1205),
    'Skógafoss': (63.5321, -19.5114),
    'Seljalandsfoss': (63.6155, -19.9882),
    'Goðafoss': (65.6828, -17.5503),
    'Svartifoss': (64.0275, -16.9753),
    'Glymur': (64.3912, -21.2510),
    'Háifoss': (64.2077, -19.6880),
    'Hengifoss': (65.0952, -14.8895),
    'Dynjandi': (65.7328, -23.1992),
    'Selfoss': (65.8048, -16.3865),
    'Hraunfossar': (64.7027, -20.9776),
    'Aldeyjarfoss': (65.3664, -17.3370),
    'Kirkjufellsfoss': (64.9262, -23.3124),
    'Öxarárfoss': (64.2665, -21.1182),
    'Barnafoss': (64.7016, -20.9714),
    'Urriðafoss': (63.9246, -20.6720),
    'Faxi': (64.2259, -20.3376),
    'Gljúfrabúi': (63.6208, -19.9863),
    'Hjálparfoss': (64.1121, -19.8506),
    'Gluggafoss': (63.7965, -19.8000),
    'Kvernufoss': (63.5274, -19.4880),
    'Fagrifoss': (63.8743, -18.2810),
    'Litlanesfoss': (65.1100, -14.8930),
}


def famous(n, la, lo):
    c = FAM.get(n)
    return bool(c) and abs(c[0] - la) < 0.03 and abs(c[1] - lo) < 0.06


num = lambda s: float(re.findall(r'[\d.]+', s)[0]) if s and re.findall(r'[\d.]+', s) else None
out = []
for g in G:
    x, y = xy(g['lo'], g['la'])
    k = g['k']
    n = g['n']
    if k == 'fall':
        fm = famous(n, g['la'], g['lo'])
        h = num(g.get('h', '')) or (FH.get(n) if fm else None) or (10 if g.get('ww') == 'river' else 5)
        w = (FW.get(n) if fm else None) or num(g.get('w', '')) or (16 if g.get('ww') == 'river' else 3.5)
        if n == 'Gullfoss' and fm:
            h = 11 if g['la'] > 64.327 else 21  # Gullfoss drops in two steps, 11 m then 21 m
        dx = dy = 0
        if 'up' in g:
            ux, uy = xy(*g['up'])
            vx, vy = xy(*g['dn'])
            L = math.hypot(vx - ux, vy - uy) or 1
            dx, dy = (vx - ux) / L, (vy - uy) / L
        out.append(
            [round(x, 1), round(y, 1), 'fall', n, round(h, 1), round(w, 1), round(dx, 3), round(dy, 3)]
        )
    else:
        out.append([round(x, 1), round(y, 1), k, n])
s = base64.b64encode(
    gzip.compress(json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode())
).decode()
open(paths.out('geo.txt'), 'w').write(s)
print(len(out), len(s))
