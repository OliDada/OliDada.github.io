"""Power lines with their pylons, overground pipelines, real street lamps, ski lifts and ski runs.
In: iceland.osm.pbf   Out: data/infra.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, collections, math

C = math.cos(math.radians(64.124))


def LL(la, lo):
    return (round((lo + 21.89) * 111320 * C * 2), round((64.124 - la) * 110574 * 2))


def num(v):
    try:
        return float(str(v).split(';')[0].split()[0].replace(',', '.'))
    except Exception:
        return 0


class H(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.pw = {}
        s.lamps = []
        s.lines = []
        s.pipes = []
        s.lifts = []
        s.pistes = []
        s.st = collections.Counter()

    def node(s, n):
        t = n.tags
        p = t.get('power')
        if p in ('tower', 'pole', 'portal', 'terminal'):
            s.pw[n.id] = (1 if p in ('tower', 'portal') else 2, num(t.get('height')))
        if t.get('highway') == 'street_lamp':
            s.lamps.extend(LL(n.location.lat, n.location.lon))

    def way(s, w):
        t = w.tags
        try:
            c = [(n.ref,) + LL(n.lat, n.lon) for n in w.nodes]
        except Exception:
            return
        if len(c) < 2:
            return
        p = t.get('power')
        if p in ('line', 'minor_line'):
            v = num(t.get('voltage')) / 1000 if t.get('voltage') else (0 if p == 'minor_line' else 132)
            pts = []
            for ref, x, y in c:
                k = s.pw.get(ref, (0, 0))
                pts += [x, y, k[0], int(k[1] * 2)]
            s.lines.append(
                [
                    1 if p == 'minor_line' else 0,
                    int(v),
                    num(t.get('cables')) and int(num(t.get('cables'))) or 0,
                    pts,
                ]
            )
            s.st['line_' + p] += 1
        if t.get('aerialway') in (
            'chair_lift',
            'drag_lift',
            't-bar',
            'j-bar',
            'platter',
            'rope_tow',
            'magic_carpet',
            'gondola',
            'mixed_lift',
            'zip_line',
        ):
            s.lifts.append([t.get('aerialway'), t.get('name', ''), [v for _, x, y in c for v in (x, y)]])
            s.st['lift'] += 1
        if t.get('piste:type') in ('downhill', 'nordic', 'sled'):
            area = (
                1
                if c[0][0] == c[-1][0]
                and (t.get('area') == 'yes' or t.get('piste:type') == 'downhill' and len(c) > 3)
                else 0
            )
            s.pistes.append(
                [
                    t.get('piste:type'),
                    t.get('piste:difficulty', ''),
                    t.get('piste:name') or t.get('name', ''),
                    area,
                    [v for _, x, y in c for v in (x, y)],
                ]
            )
            s.st['piste_' + t.get('piste:type')] += 1
        elif t.get('man_made') == 'pipeline':
            loc = t.get('location', '')
            sub = t.get('substance', '')
            s.st[(loc, sub)] += 1
            if loc in ('underground', 'underwater', 'sub_glacial') or t.get('layer', '0').startswith('-'):
                return
            s.pipes.append(
                [
                    {'hot_water': 1, 'water': 2, 'steam': 3, 'heat': 1, 'gas': 4, 'oil': 4, 'sewage': 5}.get(
                        sub, 0
                    ),
                    1 if loc in ('overground', 'overhead') else 0,
                    num(t.get('diameter')),
                    [v for _, x, y in c for v in (x, y)],
                ]
            )


h = H()
h.apply_file(paths.PBF, locations=True)
json.dump(
    {'lines': h.lines, 'pipes': h.pipes, 'lamps': h.lamps, 'lifts': h.lifts, 'pistes': h.pistes},
    open(paths.data('infra.json'), 'w'),
    separators=(',', ':'),
)
print('lines', len(h.lines), 'pipes', len(h.pipes), 'lamps', len(h.lamps) // 2)
print(h.st.most_common(40))
