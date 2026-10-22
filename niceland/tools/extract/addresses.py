"""Address points (addr:street + addr:housenumber nodes).
In: iceland.osm.pbf   Out: data/addr.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, sys

out = []


class H(osmium.SimpleHandler):
    def node(self, n):
        t = n.tags
        hn = t.get('addr:housenumber')
        st = t.get('addr:street')
        nm = t.get('name')
        if (hn and st) or (
            nm
            and (
                t.get('amenity') or t.get('shop') or t.get('tourism') or t.get('office') or t.get('building')
            )
        ):
            out.append(
                [
                    round(n.location.lat, 6),
                    round(n.location.lon, 6),
                    st or '',
                    hn or '',
                    nm or '',
                    t.get('amenity') or t.get('shop') or t.get('tourism') or t.get('office') or '',
                ]
            )


H().apply_file(paths.PBF)
json.dump(out, open(paths.data('addr.json'), 'w'))
print(len(out))
