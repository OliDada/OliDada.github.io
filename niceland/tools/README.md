# The data pipeline

These scripts turn the raw sources into the map files that `index.html` loads (`world.txt`, `roadx.txt`, … in the
folder above). You only need them to change or refresh the map; the game itself just needs the finished `*.txt` files.

```
pip install osmium numpy scipy pillow shapely matplotlib pyproj
python3 tools/run_all.py              # everything, about 45 minutes
python3 tools/run_all.py world pack   # rebuild from data/ that is already extracted
```

`paths.py` says where things go: inputs and intermediate files in `tools/data/` (or `$NICELAND_DATA`), finished map
files next to `index.html` (or `$NICELAND_OUT`). `tools/data/` is large (about 450 MB) and is not kept in git.

## Order

1. **`extract/`** – each script reads the OpenStreetMap extract once and writes one JSON file into `data/`.
2. **`world/build_world.py`** – builds the terrain grids, every building and the road network, and writes `world.txt`,
   `detail.txt`, `bldx.txt` and `roadx.txt`. It runs the scripts in `world/steps/` inside its own namespace
   (`step(name)`), so the steps read and change its variables (`bl` the buildings, `g`/`hgt` the 10 m grid,
   `cg`/`ch` the 300 m grid, `nlist`/`ways` the roads…). Read it top to bottom; each step is marked where it runs.
3. **`pack/`** – compresses the smaller JSON files into `bus.txt`, `geo.txt`, `poi.txt`, `props.txt`, `infra.txt`
   and `extra.txt`.

| Script | Reads | Writes |
| --- | --- | --- |
| `extract/land.py` | `iceland.osm.pbf` | `iceland-osm.json` (buildings, land cover, water, rivers, glaciers, places) |
| `extract/coast.py` | `iceland.osm.pbf` | `coast.json` |
| `extract/water.py` | `iceland.osm.pbf` | `water3.json` |
| `extract/roads.py` | `iceland.osm.pbf` | `roads3.json` |
| `extract/buildings_3d.py` | `iceland.osm.pbf` | `osm3d.json` |
| `extract/addresses.py`, `building_addresses.py` | `iceland.osm.pbf` | `addr.json`, `baddr.json` |
| `extract/places.py`, `airports.py` | `iceland.osm.pbf` | `props.json`, `air.json` |
| `extract/municipalities.py` | `iceland.osm.pbf` | `muni.json` |
| `extract/shops.py`, `zoos.py` | `iceland.osm.pbf` | `poi.json`, `zoo.json` |
| `extract/bus_routes.py` | `iceland.osm.pbf` | `bus.json` |
| `extract/geothermal.py` | `iceland.osm.pbf` | `geo.json` |
| `extract/infrastructure.py` | `iceland.osm.pbf` | `infra.json` |
| `extract/extras.py` | `iceland.osm.pbf` | `extra.json` |
| `world/build_world.py` | all of the above, the elevation grids, `reykjavik-osm.json`, `rvk/` | `world.txt`, `detail.txt`, `bldx.txt`, `roadx.txt` |
| `pack/*.py` | the JSON files | the remaining `*.txt` |
| `sample/aerial_roofs.py` | aerial photo bundles, `rvk/bl_isn93.json` | `rvk/osm_roof.json` |

## Inputs to put in `data/`

| File | What it is |
| --- | --- |
| `iceland.osm.pbf` | The OpenStreetMap extract for Iceland (Geofabrik's `iceland-latest.osm.pbf`). |
| `iceland-dem.bin` | Elevation for all of Iceland on the 300 m grid, little-endian int16 metres (1830 × 1235), from the Terrarium elevation tiles. |
| `capital-dem.bin` | Elevation for the capital area on the 10 m grid, same format, from the same tiles. |
| `reykjavik-osm.json` | The capital-area OSM extract on the 10 m grid's origin (buildings, house numbers, coast, water, land cover, rivers). |
| `rvk/reykjavik-byggingar.json` | Reykjavík's open building register: year built, floors, use, residents. |
| `rvk/reykjavik-thok.json` | Reykjavík's roof outlines from the same open data. |
| `rvk/osm_roof.json` | Roof colours and shapes measured from the 2025 aerial photo (made by `sample/aerial_roofs.py`; optional — without it `build_world.py` writes `rvk/bl_isn93.json` for the sampler instead). |

The scripts that made the two elevation grids and `reykjavik-osm.json` were not kept; the files are inputs as they stand.
