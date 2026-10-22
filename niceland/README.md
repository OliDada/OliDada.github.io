# Niceland

An isometric pixel-art god sandbox of Iceland. Every building in OpenStreetMap is in it at its true size and place,
on real terrain, with roads, buses, ferries, flights, people with daily routines, animals, weather, seasons and the
events of the Reykjavík year. You can build, destroy, cause disasters, or walk, drive and fly around yourself.

Play it by opening `index.html` through a web server (the page loads its map files with `fetch`, which browsers
block for `file://`):

```
python3 -m http.server 8000      # then open http://localhost:8000/
```

## What is where

| Path | What it is |
| --- | --- |
| `index.html` | The built game: one page with all the code inlined. Made by `build.py`; do not edit by hand. |
| `*.txt` | The map files the page loads (see *Map files* below). Made by `tools/`. |
| `src/js/` | The game code, in 53 modules (below). |
| `src/ui/` | `body.html` (the page's controls), `style.css`, and `phone-menu.js` (the ☰ menu on phones). |
| `build.py` | Joins `src/` into `index.html` (and `dist/artifact.html`). |
| `tools/` | The data pipeline that turns OpenStreetMap and other sources into the map files. See `tools/README.md`. |
| `tests/` | Browser tests (Playwright). `sh tests/run.sh` runs them all. |

## Building

```
python3 build.py
```

The modules in `src/js/` are joined **in file-name order inside one function scope**, as if they were one file. So a
module can use anything an earlier module defines, and functions can be used anywhere (they are hoisted). Constants
and variables are set up in order when the page starts, so keep the numeric prefixes when you add or rename a module.
Each module starts with a short header saying what it is for and what it defines.

Code style: [Prettier](https://prettier.io) with `.prettierrc.json` (`npx prettier --write "src/**/*.js"`).

## The modules

| File | What it does |
| --- | --- |
| `00-core.js` | The canvas, the random helpers and the hash used for every deterministic "random" choice (h32). |
| `01-view.js` | The eight view directions and the isometric projection: PXw/PYw turn world metres into screen x and depth. |
| `02-world-data.js` | Land classes, their colours and names, and decoding of world.txt (terrain grids, buildings, road nodes) into memory. |
| `03-building-styles.js` | Era styles from the Reykjavík building register, roof colours from aerial photos, OSM 3D parts. |
| `04-landmarks.js` | Hand-set heights and materials for landmarks such as Hallgrímskirkja, Harpa and Perlan. |
| `05-brands.js` | Chain stores, malls, petrol stations and churches recognised from OSM points (poi.txt). |
| `06-storefronts-roofs.js` | Store-front details, roof shapes on any footprint, and mkB() which creates a building record. |
| `07-terrain-grids.js` | The 10 m capital grid (F), the 100 m Iceland grid (C) and generated 10 m detail tiles for the rest of the country. |
| `08-spatial-index.js` | Hashed buckets for buildings, trees, lamps, road nodes and road segments, so lookups near a point are fast. |
| `09-graphs.js` | Driving (GD) and walking (GW) graphs built from the roads, and A* path finding. |
| `10-camera.js` | Zoom levels, the camera, screen↔world conversion, the visible world rectangle and smooth zooming. |
| `11-buildings-draw.js` | Light colour for the time of day (LR/LG/LB) and drawing buildings, including the per-building sprite cache. |
| `12-terrain-render.js` | Ground colours and the terrain renderer that bakes the ground into cached chunks. |
| `13-roads.js` | Bridges, tunnels, lanes, traffic lights, signs and barriers; road drawing and building chunks. |
| `14-state-particles.js` | Global simulation state (time, speed, hazards, agents) and the particle system (smoke, dust, sparks). |
| `15-destruction.js` | Destroying and rebuilding buildings, fire spread and fire engines, lava flows and volcanoes. |
| `16-people.js` | Names, clothes and jobs, creating agents (mkAgent) and spawning people near the view. |
| `17-buses.js` | Strætó routes and stops from OSM, timetables and buses on their routes. |
| `18-traffic.js` | Traffic volumes by hour, spawning cars, lanes and speed limits, and stepAgents(), which moves every person and car. |
| `19-animals.js` | Species, habitats, spawning and behaviour of animals and birds. |
| `20-zoos.js` | Pens, pools and animals in the zoos mapped in OSM. |
| `21-places.js` | Pools, playgrounds, schools, pitches, parks and cemeteries from props.txt and how they are drawn. |
| `22-car-parks.js` | Parking stalls along the kerbs, how full each car park is through the day, and cars and drivers coming and going. |
| `23-props-layer.js` | The baked layer of parked cars and lamp posts, and people using places (swimming, playing). |
| `24-daily-life.js` | Households, jobs and day plans: where each person is going and why. |
| `25-trees.js` | Cached tree sprites for each kind, season and size. |
| `26-house-styles.js` | Colours and styles for houses, apartments and farms. |
| `27-vehicles.js` | Vehicle types (cars, vans, buses, lorries) and how they are drawn. |
| `28-harbour.js` | Whale-watching boats, trawlers and ferries; sea routes found with A* over the water. |
| `29-infrastructure.js` | Pylons and wires, geothermal pipelines and real street lamps (infra.txt). |
| `30-ski.js` | Lifts, runs and skiers in the ski season. |
| `31-road-surfaces.js` | Gravel roads, fords, and highland roads closed in winter. |
| `32-osm-extras.js` | Lighthouses and sea lights, greenhouses, masts, EV chargers, hydrants, viewpoints, cliffs, streams and opening hours (extra.txt). |
| `33-ferries.js` | Herjólfur, Baldur, Sævar and Sæfari on their timetables, with cars on and off. |
| `34-flights.js` | Flights from Reykjavík crossing the country at cruise height. |
| `35-golden-circle.js` | Tour coaches to Þingvellir, Geysir and Gullfoss, and tourists at the stops. |
| `36-geothermal.js` | Geysers, hot springs, steam plumes and waterfalls carved into the terrain (geo.txt). |
| `37-events.js` | 17. júní, Pride, Menningarnótt, Christmas lights, New Year fireworks and bonfires, parades and concerts. |
| `38-aircraft.js` | Airports from OSM runways, parked planes, take-offs, landings and the Reykjavík timetable. |
| `39-god-tools.js` | Placing buildings and features, disasters, trolls, UFOs and tornadoes. |
| `40-play-mode.js` | Walking as a person, driving a car or flying a plane. |
| `41-player-mode.js` | Crime, police chases and getting caught. |
| `42-draw-agents.js` | How people, cars, ploughs and speech bubbles are drawn. |
| `43-search.js` | The search box and jumping to places. |
| `44-seasons-weather.js` | Seasons, snow cover, the real sun height over Reykjavík, light colour and weather. |
| `45-transitions.js` | Cross-fades when rotating the view or jumping to a place. |
| `46-frame.js` | Which chunks are visible, prefetching, the chunk cache and draw(), which paints one frame. |
| `47-tick.js` | The fixed-rate simulation step (tick) and population totals. |
| `48-tools.js` | The tool palette (build, destroy, terrain, disasters, people, animals) and applying a tool. |
| `49-input.js` | Mouse, touch and keyboard: panning, pinching, rotating and hovering. |
| `50-ui.js` | Buttons, toasts, Go-to menu, saving and share codes, and the inspector panel. |
| `51-main.js` | The animation frame loop and the start-up sequence that loads all data. |
| `52-touch-controls.js` | On phones and tablets, a joystick and buttons for walking, driving and flying in play mode. |

## How it works

**Coordinates.** The world is in metres: `x` east and `y` south of 64.124° N, 21.89° W (`LL(lat, lon)` converts).
The map files store half metres. The view can face eight directions (`ROT`); `PXw(x, y)` and `PYw(x, y)` give screen
x and depth for the current direction, and `sp_(x, y, z)` gives the screen position of a world point.

**Zoom and the camera.** `LEVELS` is the list of zoom levels in canvas pixels per metre; `K` is the current one and
`li` its index. The canvas has half the CSS resolution (`PX = 2`), so `VW` × `VH` is half the window size. Zooming
between levels is smooth: the canvas is scaled with CSS and the next level is rendered underneath (`10-camera.js`).

**Drawing.** Most of the world is baked into cached image *chunks* per zoom level (`CACHE`, `46-frame.js`):
ground from the 10 m capital grid (type 0), the 300 m Iceland grid (type 3) or 10 m detail tiles (type 4); buildings
(type 1) and their lit windows (type 2); and the props layer of parked cars and lamp posts (type 5). Chunks are lit
afterwards by multiplying with the light colour (`litLayer`). Zoomed in past `DIRECT`, buildings, trees, people,
animals, pylons and so on are instead drawn every frame, sorted by depth, so moving things pass behind buildings.

**The terrain.** `F` is the 10 m grid for the capital area, `C` the 300 m grid for all of Iceland, and `TILES` are 10 m
tiles generated on demand for the rest of the country from `C`, the 10 m shore masks (`detail.txt`) and noise. Each
cell has a land class (`SEA`, `LAKE`, `GRASS`, … `HAY`, in `02-world-data.js`) and a height.

**Things in the world.**

| Name | What it holds |
| --- | --- |
| `B` | Buildings. `b.poly` outline, `b.z` ground height, `b.h` height, `b.kind` (0–2 homes, 3 sheds and service buildings, 4 shops and offices, 5 industrial, 6 public, 7 churches, 8 custom), `b.state` (0 standing, 2 rubble, 3 being built, 9 gone). |
| `WAYS`, `NX`, `NY` | Roads, paths and rivers, and their node coordinates. `way.cl`: 1 motorway … 6 service road, 7 pedestrian street, 8–9 paths, 10 river. |
| `GD`, `GW` | The driving and walking graphs for A* (`09-graphs.js`). |
| `agents` | People and vehicles. Each moves along `a.path` (graph nodes) or `a.wp` (free waypoints), stepped in `stepAgents()`. |
| `animals`, `PLANES`, `CRUISE`, `BOATS`, `ENTS` | Animals, aircraft at airports, aircraft crossing the country, boats and ferries, and creatures/disasters. |
| `AREAS`, `PTS` | Places (pools, parks, car parks, cemeteries…) and small things in them (benches, statues…). |

**Time.** `gameMin` counts game minutes (a day is 1440). One real second is two game minutes at normal speed, so an
hour takes 30 seconds; people and cars still move at real speeds. `tick()` advances the simulation at a fixed rate.
Daylight follows the real sun height over Reykjavík for the date (`44-seasons-weather.js`): `dayL` is daylight 0–1,
`nightK` how dark it is, and `LR`, `LG`, `LB` the light colour. `SEAS` and `SP` are the season and its settings,
`WX` the weather.

**Debugging.** In the browser console, `__go(lat, lon, zoom)` jumps somewhere, `__smv().setHour(h)` sets the time,
and `__ev("...")` runs code inside the game's scope (the tests use these).

## Map files

| File | Contents | Made by |
| --- | --- | --- |
| `world.txt` | Terrain grids, buildings, road nodes and ways | `tools/world/build_world.py` |
| `detail.txt` | 10 m land/sea/lake/glacier masks along shores | `tools/world/steps/detail_mask.py` |
| `bldx.txt` | Extra per-building detail | `tools/world/build_world.py` |
| `roadx.txt` | Bridges, tunnels, lanes, speed limits, surfaces, fords, signals, signs, barriers | `tools/world/steps/roads.py` |
| `props.txt` | Places and the things in them; airports | `tools/pack/places.py` |
| `poi.txt` | Shops and brands; zoos | `tools/pack/shops.py` |
| `bus.txt` | Bus routes and stops | `tools/pack/bus.py` |
| `geo.txt` | Geysers, hot springs, power plants, waterfalls | `tools/pack/geothermal.py` |
| `infra.txt` | Power lines, pipelines, street lamps, ski lifts and runs | `tools/pack/infrastructure.py` |
| `extra.txt` | Lighthouses, greenhouses, masts, chargers, hydrants, viewpoints, cliffs, streams, opening hours | `tools/pack/extras.py` |

All are gzip-compressed and base64-encoded (`world.txt`, `detail.txt`, `bldx.txt` and `roadx.txt` hold binary data;
the others JSON).

## Sources

Map data © OpenStreetMap contributors (ODbL). Terrain from the Terrarium elevation tiles. Building years, floors and
uses from Reykjavík's open building register, roof colours from the city's 2025 aerial photo, and population per
municipality from Statistics Iceland (1 January 2025). Timetables for buses and ferries follow the published patterns;
flight times of day are spread out rather than the real timetable.
