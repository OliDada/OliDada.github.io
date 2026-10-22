"""Branded places and zoos -> poi.txt.
In: data/poi.json, data/zoo.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, gzip, base64, math

d = json.load(open(paths.data('poi.json')))
lat0, lon0 = 64.124, -21.89
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
out = []
for lo, la, k, br, nm, op, ar in d:
    x, y = (lo - lon0) * KX, (lat0 - la) * KY
    out.append([round(x, 1), round(y, 1), k, br or '', nm or '', op or ''])
Z = json.load(open(paths.data('zoo.json')))
for t, pp in Z:
    if t.get('tourism') != 'zoo':
        continue
    xy = [v for lo, la in pp for v in (round((lo - lon0) * KX, 1), round((lat0 - la) * KY, 1))]
    out.append(
        [
            round(sum(xy[0::2]) / len(pp), 1),
            round(sum(xy[1::2]) / len(pp), 1),
            'zoo',
            t.get('zoo', ''),
            t.get('name', 'Fjölskyldu- og húsdýragarðurinn'),
            xy,
        ]
    )
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode()
open(paths.out('poi.txt'), 'w').write(base64.b64encode(gzip.compress(s, 9)).decode())
print(len(out), len(s))
