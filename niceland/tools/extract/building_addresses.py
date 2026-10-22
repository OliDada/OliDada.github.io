"""Addresses tagged on building outlines.
In: iceland.osm.pbf   Out: data/baddr.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, sys

out = []


class H(osmium.SimpleHandler):
    def way(self, w):
        t = w.tags
        if 'building' not in t:
            return
        hn = t.get('addr:housenumber')
        st = t.get('addr:street')
        nm = t.get('name')
        if not ((hn and st) or nm):
            return
        try:
            la = [n.lat for n in w.nodes]
            lo = [n.lon for n in w.nodes]
        except Exception:
            return
        if not la:
            return
        out.append(
            [round(sum(la) / len(la), 6), round(sum(lo) / len(lo), 6), st or '', hn or '', nm or '', '']
        )


H().apply_file(paths.PBF, locations=True)
json.dump(out, open(paths.data('baddr.json'), 'w'))
print(len(out))
