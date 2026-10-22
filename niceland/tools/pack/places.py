"""Places and airports -> props.txt.
In: data/props.json, data/air.json, data/reykjavik-osm.json (for the origin)
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, gzip, base64, math

lat0, lon0 = json.load(open(paths.data('reykjavik-osm.json')))['origin']
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
ll = lambda la, lo: ((lo - lon0) * KX, (lat0 - la) * KY)
d = json.load(open(paths.data('props.json')))
S = ['']
SI = {'': 0}


def s(n):
    if n not in SI:
        SI[n] = len(S)
        S.append(n)
    return SI[n]


A = []
P = []
for c, sub, nm, pts in d['a']:
    flat = []
    for la, lo in pts:
        x, y = ll(la, lo)
        flat += [round(x * 2), round(y * 2)]
    A.append([c, sub, s(nm)] + flat)
for c, la, lo, nm in d['p']:
    x, y = ll(la, lo)
    P.append([c, round(x * 2), round(y * 2), s(nm)])
ad = json.load(open(paths.data('air.json')))
RW = []
for a, b, wd, sf, ref in ad['r']:
    x1, y1 = ll(*a)
    x2, y2 = ll(*b)
    RW.append(
        [
            round(x1, 1),
            round(y1, 1),
            round(x2, 1),
            round(y2, 1),
            wd,
            1 if sf in ('asphalt', 'paved', 'concrete') else 0,
        ]
    )
AP = []
for pts, nm, ia, ic in ad['a']:
    fl = []
    for la, lo in pts[:-1]:
        x, y = ll(la, lo)
        fl += [round(x, 1), round(y, 1)]
    AP.append(fl)
raw = json.dumps({'s': S, 'a': A, 'p': P, 'rw': RW, 'ap': AP}, separators=(',', ':')).encode()
gz = gzip.compress(raw, 9)
open(paths.out('props.txt'), 'w').write(base64.b64encode(gz).decode())
print(len(raw), len(gz))
