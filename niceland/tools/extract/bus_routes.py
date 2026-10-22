"""Strætó bus routes from OSM route=bus relations: ordered way geometry and stops.
In: iceland.osm.pbf   Out: data/bus.json
"""

import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import paths  # noqa: E402
import osmium, json, collections

F = paths.PBF


class R(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.rel = []

    def relation(s, r):
        t = r.tags
        if t.get('type') != 'route' or t.get('route') != 'bus':
            return
        s.rel.append(
            dict(
                id=r.id,
                ref=t.get('ref', ''),
                name=t.get('name', ''),
                frm=t.get('from', ''),
                to=t.get('to', ''),
                op=t.get('operator', ''),
                net=t.get('network', ''),
                col=t.get('colour', ''),
                m=[(m.type, m.ref, m.role) for m in r.members],
            )
        )


r = R()
r.apply_file(F)
print(len(r.rel), collections.Counter(x['op'] or x['net'] for x in r.rel).most_common(10))
W = set()
N = set()
for x in r.rel:
    for t, i, ro in x['m']:
        if t == 'w':
            W.add(i)
        elif t == 'n':
            N.add(i)


class G(osmium.SimpleHandler):
    def __init__(s):
        super().__init__()
        s.w = {}
        s.n = {}

    def node(s, n):
        if n.id in N:
            s.n[n.id] = (
                round(n.location.lon, 6),
                round(n.location.lat, 6),
                n.tags.get('name', ''),
                n.tags.get('shelter', ''),
                n.tags.get('bench', ''),
            )

    def way(s, w):
        if w.id in W:
            try:
                s.w[w.id] = [(nd.ref, round(nd.lon, 6), round(nd.lat, 6)) for nd in w.nodes]
            except Exception:
                pass


g = G()
g.apply_file(F, locations=True)
out = []
for x in r.rel:
    ways = [g.w[i] for t, i, ro in x['m'] if t == 'w' and i in g.w and ro in ('', 'forward', 'backward')]
    # chain ways in order, flipping as needed
    pts = []
    for w in ways:
        if not pts:
            pts = list(w)
            continue
        if pts[-1][0] == w[0][0]:
            pts += w[1:]
        elif pts[-1][0] == w[-1][0]:
            pts += w[::-1][1:]
        elif len(pts) == len(ways[0]) and pts[0][0] == w[0][0]:
            pts = pts[::-1] + w[1:]
        elif len(pts) == len(ways[0]) and pts[0][0] == w[-1][0]:
            pts = pts[::-1] + w[::-1][1:]
        else:
            pts += w  # gap
    stops = [g.n[i] for t, i, ro in x['m'] if t == 'n' and i in g.n and ro.startswith(('stop', 'platform'))]
    out.append(
        dict(
            ref=x['ref'],
            name=x['name'],
            frm=x['frm'],
            to=x['to'],
            op=x['op'],
            net=x['net'],
            col=x['col'],
            line=[(p[1], p[2]) for p in pts],
            stops=stops,
        )
    )
json.dump(out, open(paths.data('bus.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
for o in out[:200]:
    if 'Str' in (o['op'] + o['net']):
        print(o['ref'], o['name'][:50], len(o['line']), len(o['stops']), o['col'])
