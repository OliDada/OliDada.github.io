"""Buildings, house numbers, land cover, water, rivers, glaciers and place names for all of Iceland.
In: iceland.osm.pbf   Out: data/iceland-osm.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, math

lat0, lon0 = 64.124, -21.89
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574


def P(coords):
    a = []
    for lon, lat in coords:
        a += [round((lon - lon0) * KX * 2), round((lat0 - lat) * KY * 2)]
    return a


def incap(lat, lon):
    return 64.085 < lat < 64.163 and -22.035 < lon < -21.74


HW = set(
    'motorway trunk primary secondary tertiary motorway_link trunk_link primary_link secondary_link tertiary_link unclassified residential living_street pedestrian track'.split()
)
out = {
    'origin': [lat0, lon0],
    'unit': 0.5,
    'b': [],
    'h': [],
    'glacier': [],
    'water': [],
    'river': [],
    'land': [],
    'place': [],
}


class Hd(osmium.SimpleHandler):
    def node(self, n):
        t = n.tags
        pl = t.get('place')
        nat = t.get('natural')
        if pl in ('city', 'town', 'village') or (nat in ('volcano', 'peak') and 'ele' in t):
            nm = t.get('name')
            if not nm:
                return
            if nat == 'peak':
                try:
                    if float(t.get('ele', '0').replace(',', '.')) < 900:
                        return
                except:
                    return
            x = round((n.location.lon - lon0) * KX * 2)
            y = round((lat0 - n.location.lat) * KY * 2)
            out['place'].append([x, y, nm, pl or nat, t.get('population') or t.get('ele') or ''])

    def way(self, w):
        t = w.tags
        b = t.get('building')
        hw = t.get('highway')
        ww = t.get('waterway')
        if not (b or hw in HW or ww == 'river'):
            return
        try:
            coords = [(nd.lon, nd.lat) for nd in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) < 2:
            return
        if b:
            if len(coords) < 3:
                return
            la = sum(c[1] for c in coords) / len(coords)
            lo = sum(c[0] for c in coords) / len(coords)
            if incap(la, lo):
                return
            out['b'].append(
                [
                    P(coords),
                    b,
                    t.get('building:levels', ''),
                    t.get('height', ''),
                    t.get('name', ''),
                    t.get('addr:street', ''),
                    t.get('addr:housenumber', ''),
                    t.get('amenity')
                    or t.get('shop')
                    or t.get('tourism')
                    or t.get('office')
                    or t.get('leisure')
                    or '',
                    t.get('roof:shape', ''),
                ]
            )
        elif hw:
            if all(incap(c[1], c[0]) for c in coords):
                return
            if hw == 'track' and not t.get('ref') and not t.get('name'):
                return
            out['h'].append(
                [
                    P(coords),
                    hw,
                    t.get('name') or t.get('ref') or '',
                    1 if t.get('bridge') else 0,
                    1 if t.get('tunnel') else 0,
                    t.get('ref', ''),
                ]
            )
        else:
            out['river'].append([P(coords), t.get('name', '')])

    def area(self, a):
        t = a.tags
        nat = t.get('natural')
        lu = t.get('landuse')
        kind = None
        if nat == 'glacier':
            kind = 'glacier'
        elif nat == 'water' and (t.get('name') or True):
            kind = 'water'
        elif nat in ('sand', 'wood', 'bare_rock', 'scree') or lu == 'forest':
            kind = 'land'
        if not kind:
            return
        for ring in a.outer_rings():
            try:
                coords = [(nd.lon, nd.lat) for nd in ring]
            except osmium.InvalidLocationError:
                continue
            if len(coords) < 4:
                continue
            if kind == 'land':
                out['land'].append([P(coords), nat or lu, t.get('name', '')])
            elif kind == 'glacier':
                out['glacier'].append([P(coords), t.get('name', '')])
            else:
                # skip tiny ponds
                xs = [c[0] for c in coords]
                ys = [c[1] for c in coords]
                if (max(xs) - min(xs)) * KX < 150 and (max(ys) - min(ys)) * KY < 150:
                    continue
                out['water'].append([P(coords), t.get('name', '')])


h = Hd()
h.apply_file(paths.PBF, locations=True, idx='flex_mem')
print({k: len(v) for k, v in out.items() if isinstance(v, list)})
json.dump(out, open(paths.data('iceland-osm.json'), 'w'))
