#!/usr/bin/env python3
"""Run the whole data pipeline in order:

    python3 tools/run_all.py              extract + world + pack   (about 45 minutes)
    python3 tools/run_all.py world pack   only rebuild from data/ that is already extracted

1. extract  read iceland.osm.pbf once per script and write JSON into data/
2. world    world/build_world.py: terrain, buildings and roads -> world.txt, detail.txt, bldx.txt, roadx.txt
3. pack     pack/*.py: the smaller map files -> bus.txt, geo.txt, poi.txt, props.txt, infra.txt, extra.txt
Everything lands next to index.html; then run `python3 build.py` if the code changed too.
"""

import os, subprocess, sys, time

TOOLS = os.path.dirname(os.path.abspath(__file__))
EXTRACT = [
    'land',
    'coast',
    'water',
    'roads',
    'buildings_3d',
    'addresses',
    'building_addresses',
    'places',
    'airports',
    'municipalities',
    'shops',
    'zoos',
    'bus_routes',
    'geothermal',
    'infrastructure',
    'extras',
]
PACK = ['bus', 'geothermal', 'shops', 'places', 'infrastructure', 'extras']


def run(path):
    t = time.time()
    print('==', os.path.relpath(path, TOOLS), flush=True)
    # a fixed hash seed makes iteration over sets of strings the same every run, so builds can be compared
    env = dict(os.environ, PYTHONHASHSEED='0')
    subprocess.run([sys.executable, path], check=True, env=env)
    print('   %.0f s' % (time.time() - t), flush=True)


def main(stages):
    if 'extract' in stages:
        for n in EXTRACT:
            run(os.path.join(TOOLS, 'extract', n + '.py'))
    if 'world' in stages:
        run(os.path.join(TOOLS, 'world', 'build_world.py'))
    if 'pack' in stages:
        for n in PACK:
            run(os.path.join(TOOLS, 'pack', n + '.py'))


if __name__ == '__main__':
    main(sys.argv[1:] or ['extract', 'world', 'pack'])
