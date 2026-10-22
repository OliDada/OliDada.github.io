"""The road network with OSM node ids (so junctions really connect): bridges, tunnels, layers, one-way
streets, roundabouts, lanes, speed limits, surfaces, fords and seasonal closures; traffic signals, crossings,
stop/give-way signs; and barrier lines.
In: iceland.osm.pbf   Out: data/roads3.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, collections

HW = {
    'motorway',
    'trunk',
    'motorway_link',
    'trunk_link',
    'primary',
    'primary_link',
    'secondary',
    'secondary_link',
    'tertiary',
    'tertiary_link',
    'unclassified',
    'residential',
    'living_street',
    'service',
    'track',
    'pedestrian',
    'footway',
    'path',
    'steps',
    'cycleway',
    'bridleway',
}


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.ways = []
        s.pts = []
        s.bar = []
        s.nodes = {}
        s.fords = []

    def node(s, n):
        t = n.tags
        h = t.get('highway')
        c = t.get('crossing')
        if t.get('ford') not in (None, 'no'):
            s.fords.append(n.id)
        if (
            h in ('traffic_signals', 'crossing', 'stop', 'give_way', 'mini_roundabout', 'speed_camera')
            or t.get('railway') == 'level_crossing'
        ):
            s.pts.append(
                [
                    round(n.location.lon, 7),
                    round(n.location.lat, 7),
                    h or 'level_crossing',
                    c or t.get('crossing_ref') or '',
                    n.id,
                ]
            )

    def way(s, w):
        t = w.tags
        h = t.get('highway')
        if h in HW:
            try:
                nd = [(n.ref, round(n.lon, 7), round(n.lat, 7)) for n in w.nodes]
            except Exception:
                return
            if t.get('area') == 'yes':
                return
            ow = t.get('oneway')
            jn = t.get('junction')
            s.ways.append(
                {
                    'h': h,
                    'n': [a for a, _, _ in nd],
                    'c': [[x, y] for _, x, y in nd],
                    'nm': t.get('name', ''),
                    'br': 1 if t.get('bridge') not in (None, 'no') else 0,
                    'tu': (
                        1
                        if t.get('tunnel') not in (None, 'no', 'building_passage')
                        else (2 if t.get('tunnel') == 'building_passage' or t.get('covered') == 'yes' else 0)
                    ),
                    'ly': t.get('layer', '0'),
                    'ow': (
                        1
                        if ow in ('yes', '1', 'true')
                        or jn in ('roundabout', 'circular')
                        or h in ('motorway',)
                        and ow != 'no'
                        else (-1 if ow == '-1' else 0)
                    ),
                    'rb': 1 if jn in ('roundabout', 'circular') else 0,
                    'ln': t.get('lanes', ''),
                    'ms': t.get('maxspeed', ''),
                    'sf': t.get('surface', ''),
                    'tt': t.get('tracktype', ''),
                    'fd': 1 if t.get('ford') not in (None, 'no') else 0,
                    'se': t.get('seasonal', ''),
                    'ref': t.get('ref', ''),
                    'ac': t.get('access:conditional', '') + t.get('motor_vehicle:conditional', ''),
                }
            )
        elif (
            t.get('barrier') in ('guard_rail', 'jersey_barrier', 'fence', 'wall', 'handrail', 'kerb', 'hedge')
            and t.get('area') != 'yes'
        ):
            try:
                s.bar.append([t.get('barrier'), [[round(n.lon, 7), round(n.lat, 7)] for n in w.nodes]])
            except Exception:
                pass


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(
    {'ways': h.ways, 'pts': h.pts, 'bar': h.bar, 'fords': h.fords},
    open(paths.data('roads3.json'), 'w'),
    separators=(',', ':'),
)
c = collections.Counter(w['h'] for w in h.ways)
print(len(h.ways), 'ways', len(h.pts), 'points', len(h.bar), 'barriers')
print(
    'bridges',
    sum(w['br'] for w in h.ways),
    'tunnels',
    sum(1 for w in h.ways if w['tu'] == 1),
    'oneway',
    sum(1 for w in h.ways if w['ow']),
    'roundabouts',
    sum(w['rb'] for w in h.ways),
)
print(
    collections.Counter(p[2] for p in h.pts).most_common(),
    collections.Counter(b[0] for b in h.bar).most_common(),
)
