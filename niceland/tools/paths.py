"""Where the data pipeline reads and writes.

DATA  inputs and intermediate files (the OSM extract, elevation grids, city register, extracted JSON).
      Defaults to tools/data/; set NICELAND_DATA to put it elsewhere. It is large and not kept in git.
OUT   where the finished map files (*.txt) go: next to index.html. Set NICELAND_OUT to change it.
"""

import os

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
DATA = os.environ.get('NICELAND_DATA', os.path.join(TOOLS, 'data'))
OUT = os.environ.get('NICELAND_OUT', ROOT)
PBF = os.path.join(DATA, 'iceland.osm.pbf')

# the map's origin: world x is metres east, world y metres south of this point (half-metre units in the files)
LAT0, LON0 = 64.124, -21.89


def data(name=''):
    return os.path.join(DATA, name)


def out(name):
    return os.path.join(OUT, name)
