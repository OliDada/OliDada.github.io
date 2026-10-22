"""Coastline ways (natural=coastline), used to cut land from sea at 10 m.
In: iceland.osm.pbf   Out: data/coast.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, math

lat0, lon0 = 64.124, -21.89
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
out = []


class H(osmium.SimpleHandler):
    def way(self, w):
        if w.tags.get('natural') != 'coastline':
            return
        try:
            c = [(round((n.lon - lon0) * KX * 2), round((lat0 - n.lat) * KY * 2)) for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(c) > 1:
            out.append([v for p in c for v in p])


h = H()
h.apply_file(paths.PBF, locations=True, idx='flex_mem')
print(len(out), sum(len(c) // 2 for c in out))
json.dump(out, open(paths.data('coast.json'), 'w'))
