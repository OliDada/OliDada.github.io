"""Lighthouses, greenhouses, masts, chargers, hydrants, viewpoints, cliffs, streams, opening hours -> extra.txt.
Stream lines are delta-encoded (each point stored as the step from the one before) because they are most of the file.
In: data/extra.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import json, gzip, base64

d = json.load(open(paths.data('extra.json')))
streams = []
for a in d['wt']:
    o = [a[0], a[1]]
    for i in range(2, len(a)):
        o.append(a[i] - a[i - 2])
    streams.append(o)
d['wt'] = streams
d['wtd'] = 1
raw = json.dumps(d, separators=(',', ':')).encode()
open(paths.out('extra.txt'), 'w').write(base64.b64encode(gzip.compress(raw, 9)).decode())
print('extra.txt', {k: len(v) for k, v in d.items() if isinstance(v, list)})
