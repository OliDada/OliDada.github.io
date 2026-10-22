"""Lakes, ponds, reservoirs and river areas, assembled as proper areas (outer rings and islands).
In: iceland.osm.pbf   Out: data/water3.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.out = []

    def area(s, a):
        t = a.tags
        w = (
            t.get('natural') == 'water'
            or t.get('waterway') == 'riverbank'
            or t.get('landuse') in ('reservoir', 'basin')
        )
        if not w or t.get('water') in ('wastewater',):
            return
        if t.get('intermittent') == 'yes' or t.get('seasonal') == 'yes':
            return
        try:
            for o in a.outer_rings():
                outer = [(round(n.lon, 6), round(n.lat, 6)) for n in o]
                inners = [[(round(n.lon, 6), round(n.lat, 6)) for n in i] for i in a.inner_rings(o)]
                s.out.append([outer, inners, t.get('name', ''), t.get('water', '')])
        except Exception:
            pass


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(h.out, open(paths.data('water3.json'), 'w'), separators=(',', ':'))
print('water areas', len(h.out))
