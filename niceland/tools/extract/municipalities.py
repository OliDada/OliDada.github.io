"""Municipality boundaries (admin_level 6) as WKT, for the population figures.
In: iceland.osm.pbf   Out: data/muni.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json
from shapely import wkb

F = osmium.geom.WKBFactory()


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.o = []

    def area(s, a):
        t = a.tags
        if t.get('boundary') != 'administrative' or t.get('admin_level') != '6':
            return
        try:
            g = wkb.loads(F.create_multipolygon(a), hex=True)
        except Exception as e:
            return
        s.o.append((t.get('name', ''), g.simplify(0.0005).wkt))


h = H()
h.apply_file(paths.PBF, locations=True, idx='flex_mem')
json.dump(h.o, open(paths.data('muni.json'), 'w'), ensure_ascii=False)
print(len(h.o), [n for n, _ in h.o])
