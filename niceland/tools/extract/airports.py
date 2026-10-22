"""Runways, aprons and airport outlines.
In: iceland.osm.pbf   Out: data/air.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, sys

R = []
A = []
D = []


class H(osmium.SimpleHandler):
    def way(self, w):
        t = w.tags
        if t.get('aeroway') == 'runway':
            try:
                pts = [(n.lat, n.lon) for n in w.nodes]
            except Exception:
                return
            wd = t.get('width', '')
            try:
                wd = float(wd.replace('m', ''))
            except:
                wd = 0
            R.append([pts[0], pts[-1], wd, t.get('surface', ''), t.get('ref', '')])
        if t.get('aeroway') == 'taxiway':
            pass

    def area(self, a):
        t = a.tags
        ae = t.get('aeroway')
        if ae in ('apron', 'aerodrome'):
            try:
                for ring in a.outer_rings():
                    pts = [(round(n.lat, 6), round(n.lon, 6)) for n in ring]
                    (A if ae == 'apron' else D).append(
                        [pts, t.get('name', ''), t.get('iata', ''), t.get('icao', '')]
                    )
                    break
            except Exception:
                pass


H().apply_file(paths.PBF, locations=True)
json.dump({'r': R, 'a': A, 'd': [[d[1], d[2], d[3], d[0][0]] for d in D]}, open(paths.data('air.json'), 'w'))
print(len(R), len(A), len(D))
for r in R[:50]:
    print(r[2], r[3], r[4])
