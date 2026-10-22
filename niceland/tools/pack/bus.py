"""Bus routes and stops -> bus.txt (gzip + base64 JSON, coordinates in half metres from the map origin).
In: data/bus.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, gzip, base64, math

lat0, lon0 = 64.124, -21.89
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
xy = lambda lo, la: (round((lo - lon0) * KX * 2), round((lat0 - la) * KY * 2))
R = json.load(open(paths.data('bus.json')))
out = []
for r in R:
    if len(r['line']) < 5:
        continue
    L = []
    last = None
    for lo, la in r['line']:
        p = xy(lo, la)
        if p != last:
            L += p
            last = p
    S = [[*xy(s[0], s[1]), s[2], 1 if s[3] == 'yes' else 0] for s in r['stops']]
    out.append([r['ref'], r['name'], r['op'] or r['net'], r['frm'], r['to'], L, S])
s = base64.b64encode(
    gzip.compress(json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode())
).decode()
open(paths.out('bus.txt'), 'w').write(s)
print(len(out), len(s))
