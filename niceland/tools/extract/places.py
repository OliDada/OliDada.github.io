"""Places people use: pools, playgrounds, schools, pitches, parks, car parks, cemeteries, and small things
in them (benches, statues, flagpoles…).
In: iceland.osm.pbf   Out: data/props.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, sys

A = []
P = []


def code_area(t):
    l = t.get('leisure')
    am = t.get('amenity')
    lu = t.get('landuse')
    if l == 'swimming_pool':
        if t.get('indoor') == 'yes' or t.get('location') == 'indoor' or t.get('covered') == 'yes':
            return None
        sub = (
            1
            if (
                t.get('swimming_pool') in ('hot_tub', 'whirlpool', 'hot_pool')
                or 'pott' in (t.get('name', '').lower())
            )
            else 0
        )
        return (1, sub)
    if l == 'playground':
        return (2, 0)
    if am == 'school' or lu == 'education':
        return (3, 0)
    if am in ('kindergarten', 'childcare'):
        return (4, 0)
    if l == 'pitch':
        s = t.get('sport', '')
        sub = {
            'soccer': 1,
            'football': 1,
            'basketball': 2,
            'tennis': 3,
            'handball': 4,
            'golf': 5,
            'volleyball': 6,
            'beachvolleyball': 6,
            'multi': 7,
            'padel': 3,
        }.get(s.split(';')[0], 0)
        sub += 16 if t.get('surface') in ('artificial_turf', 'grass') and sub == 1 else 0
        return (5, sub)
    if l in ('park', 'garden') and t.get('garden:type') != 'residential':
        return (6, 0)
    if (
        am == 'parking'
        and t.get('parking', 'surface') == 'surface'
        and t.get('access', 'yes') not in ('private',)
    ):
        return (7, 0)
    if l in ('sports_centre', 'stadium'):
        return (8, 0)
    if lu == 'cemetery' or am == 'grave_yard':
        return (9, 0)
    if l == 'dog_park':
        return (10, 0)
    if l == 'track':
        return (11, 0)
    if l == 'water_park':
        return (12, 0)
    if am in ('university', 'college'):
        return (13, 0)
    return None


PT = {
    'bench': 1,
    'picnic_table': 2,
    'fountain': 5,
    'statue': 6,
    'flagpole': 7,
    'waste_basket': 8,
    'bicycle_parking': 9,
    'fitness_station': 10,
    'bbq': 11,
    'drinking_water': 12,
}


def code_pt(t):
    l = t.get('leisure')
    am = t.get('amenity')
    pg = t.get('playground')
    if pg:
        return {
            'swing': 20,
            'slide': 21,
            'climbingframe': 22,
            'seesaw': 23,
            'sandpit': 24,
            'springy': 25,
            'roundabout': 26,
            'playhouse': 27,
        }.get(pg, 22)
    if l == 'playground':
        return 3
    if l == 'swimming_pool':
        return 4
    if am in PT:
        return PT[am]
    if l in PT:
        return PT[l]
    if t.get('man_made') == 'flagpole':
        return 7
    if (
        t.get('tourism') == 'artwork'
        or t.get('historic') in ('memorial', 'monument')
        or t.get('memorial') == 'statue'
    ):
        return 6
    if t.get('tourism') == 'picnic_site':
        return 2
    return None


class H(osmium.SimpleHandler):
    def area(self, a):
        c = code_area(a.tags)
        if not c:
            return
        try:
            for ring in a.outer_rings():
                pts = [(n.lat, n.lon) for n in ring]
                if len(pts) < 4:
                    continue
                A.append(
                    [
                        c[0],
                        c[1],
                        a.tags.get('name', ''),
                        [[round(la, 6), round(lo, 6)] for la, lo in pts[:-1]],
                    ]
                )
                break
        except Exception:
            pass

    def node(self, n):
        c = code_pt(n.tags)
        if c:
            P.append([c, round(n.location.lat, 6), round(n.location.lon, 6), n.tags.get('name', '')])


H().apply_file(paths.PBF, locations=True)
json.dump({'a': A, 'p': P}, open(paths.data('props.json'), 'w'))
from collections import Counter

print(len(A), len(P), Counter(x[0] for x in A), Counter(x[0] for x in P))
