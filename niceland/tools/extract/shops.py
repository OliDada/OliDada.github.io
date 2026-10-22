"""Branded places: fuel stations, supermarkets, malls, DIY and other chain stores.
In: iceland.osm.pbf   Out: data/poi.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json

SHOP = {
    'supermarket',
    'convenience',
    'mall',
    'department_store',
    'doityourself',
    'hardware',
    'furniture',
    'electronics',
    'alcohol',
    'variety_store',
    'wholesale',
    'general',
    'car',
    'sports',
    'clothes',
    'garden_centre',
    'pharmacy',
    'bakery',
}
AM = {'fuel', 'fast_food', 'car_wash', 'charging_station', 'bank', 'cinema', 'pharmacy', 'post_office'}


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.out = []

    def add(s, t, lon, lat, area):
        sh = t.get('shop')
        am = t.get('amenity')
        if not ((sh in SHOP) or (am in AM)):
            return
        if am == 'charging_station' and not t.get('brand'):
            return
        s.out.append(
            [
                round(lon, 6),
                round(lat, 6),
                sh or am,
                t.get('brand', ''),
                t.get('name', ''),
                t.get('operator', ''),
                round(area, 1),
            ]
        )

    def node(s, n):
        if n.tags:
            s.add(n.tags, n.location.lon, n.location.lat, 0)

    def area(s, a):
        t = a.tags
        if not (t.get('shop') or t.get('amenity')):
            return
        try:
            r = next(iter(a.outer_rings()))
            pts = [(n.lon, n.lat) for n in r]
        except Exception:
            return
        lo = sum(p[0] for p in pts) / len(pts)
        la = sum(p[1] for p in pts) / len(pts)
        s.add(t, lo, la, len(pts))


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(h.out, open(paths.data('poi.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
import collections

print(len(h.out))
print(
    collections.Counter(
        (p[3] or p[4])
        for p in h.out
        if p[2] in ('fuel', 'supermarket', 'mall', 'doityourself', 'department_store')
    ).most_common(60)
)
