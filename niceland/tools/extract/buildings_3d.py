"""OSM building:part pieces and 3D tags on whole buildings (roof shape and colour, heights, levels).
In: iceland.osm.pbf   Out: data/osm3d.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json

KEYS = (
    'building:part',
    'height',
    'min_height',
    'building:levels',
    'building:min_level',
    'roof:shape',
    'roof:height',
    'roof:levels',
    'roof:colour',
    'building:colour',
    'colour',
    'roof:material',
    'building:material',
    'roof:orientation',
)


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.parts = []
        s.tagged = []

    def area(s, a):
        t = a.tags
        ip = 'building:part' in t and t['building:part'] != 'no'
        ib = 'building' in t and t['building'] != 'no'
        if not (ip or ib):
            return
        d = {k: t[k] for k in KEYS if k in t}
        if (
            ib
            and not ip
            and not any(
                k in d
                for k in (
                    'roof:shape',
                    'roof:colour',
                    'building:colour',
                    'colour',
                    'roof:levels',
                    'building:material',
                    'roof:height',
                )
            )
        ):
            return
        try:
            rings = [[(round(n.lon, 7), round(n.lat, 7)) for n in r] for r in a.outer_rings()]
        except Exception:
            return
        for r in rings:
            (s.parts if ip else s.tagged).append([d, r])


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump({'parts': h.parts, 'tagged': h.tagged}, open(paths.data('osm3d.json'), 'w'), separators=(',', ':'))
print('parts', len(h.parts), 'tagged', len(h.tagged))
