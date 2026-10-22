"""Zoos, petting farms, animal paddocks and animal enclosures (tourism=zoo, landuse=animal_keeping, attraction=animal)
with their tags.
In: iceland.osm.pbf   Out: data/zoo.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json


class H(osmium.SimpleHandler):
    """osmium assembles areas from closed ways and multipolygon relations alike."""

    def __init__(s):
        super().__init__()
        s.out = []

    def area(s, a):
        t = a.tags
        if (
            t.get('tourism') != 'zoo'
            and t.get('landuse') != 'animal_keeping'
            and t.get('attraction') != 'animal'
        ):
            return
        for ring in a.outer_rings():
            s.out.append([{t.k: t.v for t in a.tags}, [[round(n.lon, 6), round(n.lat, 6)] for n in ring]])
            break


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(h.out, open(paths.data('zoo.json'), 'w'))
print(len(h.out), 'zoos')
