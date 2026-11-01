# Elsewhere — procedural worlds

A standalone procedural 3D exploration prototype for olid.is. New code and procedural assets; no Solar System game code is reused.

## Run

From the website repository: `python3 -m http.server 8765`, then open `http://localhost:8765/galaxy-explorer/`. Static HTML and modules; no build step. Three.js 0.161.0 is vendored with its MIT license. Fonts have system fallbacks.

## Explore

- **M** opens the star map on your current system; **G** opens it on your stellar neighbourhood. It is one full-screen map: zoom (scroll, pinch, or +/−) from the whole spiral galaxy down through arms and neighbourhoods to a single system's planets and moons. Tap to select, double-tap a star or world to fly to it. The side panel (a bottom sheet on phones) shows the selection, the selected system's worlds, and stars in jump range.
- From the map, **Cruise** to a world in your system, or **Jump** to a star within 12 light years. Jumping needs free space (above 600 m); if a star is isolated in a gap, the drive overcharges just enough to reach the nearest neighbour. Systems you have not visited show only orbits until you jump there.
- **T** engages cruise to the selected destination or disengages an ongoing cruise into manual flight.
- Click the view for mouse look (Esc releases).
- **W/S** thrust, **A/D** turn, **↑/↓** pitch, **R/F** vertical thrusters, **Shift** boost, **X** brake.
- Climb above **600 m** to leave local orbit. In free space, movement is unrestricted; entering a world's vicinity restores surface flight. The star has an exclusion zone.
- **L** begins a 3.8-second landing below 32 m and 18 m/s forward speed. On the ground it begins a 3.6-second powered liftoff to 22 m. Both use gear, lift jets, and dust.
- **E** disembarks, investigates within 9 m of a signal, or boards within 9 m of the ship.
- On foot: **WASD** walk, mouse or arrow keys look, **Space** jump, **Shift** walk faster.
- **H** opens the manual and pauses. Sound is opt-in. Touch movement and contextual action buttons are included.

## Generation and persistence

Worlds are generated from physics, not from a fixed list. Each step only reads the one before it:

1. **Star** (`physics.mjs`): spectral class drawn by real-ish frequency (half are red dwarfs). Mass gives luminosity, temperature, colour, lifespan, flare activity, habitable zone and frost line.
2. **Planets and moons**: 4–7 planets on roughly geometric orbits, plus 0–2 moons per planet (9 bodies max). Orbit distance and luminosity give temperature; mass gives radius, gravity and escape velocity; gravity, heat and flares decide how much atmosphere survives; greenhouse warming, water state (liquid, ice, steam, subsurface ocean), tidal locking and volcanism follow. About two-thirds of systems get a gameplay nudge that places one Earth-sized planet in the habitable zone.
   **Giants**: each planet may instead be a gas or ice giant. They are most likely beyond the frost line (more so around heavier stars), less likely just inside it, and rare close in (hot giants). Mass (12–3000 Earth masses) sets the kind: ice giants below ~50, gas giants above, all about Jupiter's size and puffed up by strong starlight. Starlight plus leftover internal heat give the cloud-top temperature, which picks the clouds: ammonia (tan bands), methane (blue-green), water (white), clear (deep blue), alkali (dark) or silicate (glowing red). Giants always have 1–4 moons, often tidally heated, and often rings. About 43% of systems have at least one.
3. **Habitability and life**: liquid water, mild temperature, workable pressure and gravity, star age and calm all multiply into a score; the score decides the chance and level of life (none, microbial, simple, complex).
4. **Biome and look** (`biomes.mjs`): Volcanic, Toxic, Desert, Verdant, Oceanic, Frozen, Amethyst or Barren, chosen from the physics. Each world gets a seeded hue shift; vegetation is tinted by the star (dark red-purple under red dwarfs, pale under hot stars); lower gravity raises relief. Descriptions and map facts are written from the actual numbers. Sunlight takes the star's colour.

Randomness is hash-based (`rng.mjs`): every object draws from its own key path, such as `rng(seed, 'planet', 3)`, so any object can be generated alone and new traits don't reshuffle existing worlds. Real units live in `body.physics`; game distances and sizes are compressed.

Enter a seed in the map or use **Discover a new system**. The seed is in the URL (`?seed=1408`), so links reproduce a system. Generating restarts flight; visits and recorded signals are stored separately per seed. Reloading returns you to your current star, above its most habitable world. The log button opens the current world's recorded note.

`node galaxy-explorer/inspect.mjs 1408 42` prints systems as tables; `node galaxy-explorer/inspect.mjs --stats 3000` prints star, biome and life frequencies for tuning.

## Galaxy

`galaxy.mjs` defines a two-to-four-armed spiral galaxy 60,000 light years across (seed `GALAXY_SEED`). Nothing is stored: space is cut into 10-light-year cells and each cell's stars come from `hash(galaxySeed, cell)`. A density field (exponential disc, logarithmic spiral arms, central bulge, thin vertical profile) sets each cell's expected star count, so arms, sparse gaps and a crowded core emerge on their own. A star's system is `generateSystem(star.seed)`; star ids encode their cell (`?star=-917_1262_0_0`), so any star can be rebuilt from a link. `starmap.js` draws one continuous map, generating detail for the current zoom so nothing is ever a stretched image: a soft haze of the whole galaxy, then procedural light points from a quadtree of tiles (`visualTile`, one level finer each time the view halves), then real stars from the cells in view, then each star's orbits, planets and moons. Systems are drawn compressed (outer orbit ≈ 0.3 ly) so you can zoom straight into them. Nothing is redrawn unless the view changes, the 3D scene pauses while the map is open, and the map avoids CSS backdrop blur, which made each frame several times slower. Stars are thinned to roughly a fifth of real density near home so the local chart stays readable.

Your current star, visited stars and jump count are saved in `localStorage` (`elsewhere-galaxy-v1`). Jumps play a warp effect and reload into the destination system. `?seed=` still opens a standalone off-chart system for testing; jumps from one are measured from your last charted star.

## Terrain

`terrain.mjs` builds each world's surface from seeded 3D simplex noise sampled on the sphere, so there are no seams or poles. Each biome has its own shape: continents with mountain ridges, wind-aligned dunes on deserts, cracked plains on frozen worlds, sharp crystal ridges on amethyst worlds, cones and calderas on volcanic worlds, and impact craters on airless bodies.

Sea level comes from the physics. Ocean coverage (for example 65%) is turned into a height, by sampling the whole world and picking the level that floods that share. Liquid-water worlds get transparent oceans with visible shallows, volcanic worlds get glowing lava seas, and frozen worlds get flat ice sheets you can land and walk on. Colour is chosen per point from altitude, latitude, local temperature (colder toward poles and peaks) and a moisture field: beaches along coasts, vegetation tinted by the star where there is plant-like life, darker forests where it is wet, microbial mats near shore, snow caps, lava-crust shores. Rocks take a darker shade of the ground they sit on.

The signal site is always a flat, dry plateau, raised above the sea if needed. Kestrel cannot land in water or lava, and you cannot walk into them. Add `&world=planet-1` (or `moon-0`, etc.) to a URL to start above a specific world.

## Plant life

Living worlds get their own species (`flora.mjs`): 1–2 microbial forms (mats, layered mounds) on microbial worlds, 3–5 species with simple life, 5–8 with complex life. Each world's environment decides which forms thrive: broad-canopied trees, tiered spires, fronds, bushes, grasses, water-hoarding pillars, stalked caps or pod-stalks. Temperature and water favour some forms over others. Gravity sets height (low gravity grows tall, thin plants; high gravity keeps them squat). The star's light sets leaf colour, from green under Sun-like stars to near-black and magenta under red dwarfs. Dim light makes bioluminescence common. Every species has a generated name, colours, shape and a preferred habitat (temperature, moisture, shoreline or highland), and is described from those traits.

`flora-mesh.js` builds one low-poly model per species and draws every plant of that species as an instance, which keeps it to a couple of draw calls per species (about 1,600 plants on desktop, 900 on touch devices). Plants are placed where the terrain's local climate suits them, mostly around the landing region with the rest across the world, never under water, on the monument or on the landing pad. They sway in the wind, more in thick air and less in thin. Walk near a plant to catalogue its species; catalogued species are saved per world and listed on the star map.

## Animal life

Worlds with simple or complex life get animals (`fauna.mjs`): 1–2 small crawlers or coils with simple life, 3–6 species with complex life. Body plans (four-legged grazers, six-legged crawlers, two-legged striders, legless coils, winged gliders, gas-filled drifters) are chosen by the environment. Strong gravity gives short, thick legs and squat bodies; weak gravity gives stilt-like legs and favours fliers and floaters. Nothing flies in near-vacuum, and thick air keeps drifters aloft. Colours mostly borrow from the local vegetation and rock, so animals blend into their world; eyes glow where light is dim. Each species has a name, proportions (body, neck, head, tail, wingspan, eye count), a diet that sets its behaviour, a herd size and a preferred habitat, and is described from those traits.

`fauna-mesh.js` builds one low-poly model per species and draws every animal of that species with instancing. Legs swing in alternating gaits (diagonal pairs, or tripods for six legs), wings flap, tails and tentacles sway and coils ripple, all in the vertex shader from a per-animal gait cycle, so a whole species is one draw call. A small behaviour model moves each animal over the sphere: grazers wander and graze in herds and bolt when you come close, predators come to look at you, foragers wander, fliers and drifters circle overhead. Ground animals turn back at the water's edge, and everything stays within about 230 m of the site. Get close enough to observe an animal and its species is recorded; observed species are saved per world and listed on the star map.

## Rendering and travel

Every planet and moon, including the one you are on, is drawn by one level-of-detail system (`planet-lod.js`). Each world is a cube projected onto a sphere, and each face is a quadtree of tiles. A tile splits into four finer tiles when the camera is closer than about twice its width, and merges back as you leave. Detail therefore rises smoothly as you approach anything, so a nearby moon sharpens too and there is no jump when entering orbit. Close up, triangles are about 0.6 m across. Changes between detail levels are smoothed (geomorphing): every vertex also stores where it sits in the next coarser level, and the shader blends toward that by distance, so a tile already looks exactly like its parent when the two are swapped, and tile edges meet coarser neighbours without gaps. Skirts are lit with the ground's own normals, so any remaining hairline gap is invisible. Tiles beyond the horizon are not drawn, and the coarser tile stays visible until its four children are ready, so detail never leaves holes. Skirts along tile edges, on land and water, hide seams between tiles of different detail. Tiles are built in background threads (`terrain-worker.js`, falling back to the main thread if workers are unavailable), and the coarsest level of every world is built at load so nothing pops in empty. Water and lava are tiles too, matching the terrain's detail. A logarithmic depth buffer keeps distant seas and coastlines from flickering.

Worlds are compressed but cover a wide range: planets are roughly 105–540 m in radius and moons 100–190 m. Site features (the plateau, landing pad, rock and plant regions) are measured in metres, so they look the same on any size of world. World coordinates are rebased on arrival. Cruise moves through space above the orbital plane and can be disengaged; manual flight crosses between worlds too.

On foot you collide with rocks, crystals, the monument, plant trunks and bushes, and the parked ship (grasses and microbial mats are walked through), sliding along them rather than stopping dead. Space jumps; jump height follows the world's gravity, so low-gravity moons give long, floaty leaps over low obstacles. Click the view to capture the mouse: moving it then looks around, on foot and in flight, without holding a button (Esc frees the cursor). On touch devices a joystick moves you, dragging the view looks around, and the HUD collapses to the essentials.

Giants (`giant-mesh.js`) are a smooth sphere with a generated cloud map (bands bent by turbulence, streaks, sometimes a storm), a haze at the limb and, if ringed, rings with gaps. The map is sampled on the sphere, so it has no seam, and the planet turns slowly. Giants are 700–1700 m in radius and get extra orbital room so their moons stay clear of neighbours. They have no surface: cruising to one stops in space on the day side, and you cannot fly closer than 250 m to the cloud tops. Their moons are landed on as usual.

## Moving orbits

Every planet and moon moves along a circular orbit (`orbits.mjs`). Time is the real clock, so positions match between visits, survive a reload, and the star map shows where everything is now. Planets follow Kepler's third law: the innermost slot takes 10 minutes per orbit and periods grow with distance to the power 1.5, so outer worlds take hours. Moons of a rocky planet share one 3-minute period, so neighbouring moons never pass through each other; giants' moons orbit outside the rings and follow Kepler's law from an 8-minute innermost period. Nothing moves faster than about 50 m/s, well below cruising speed.

Coordinates in the scene are relative to the world you are at. Near a world (flying, landed, on foot) you travel with it, so nothing local changes; the star, sunlight and the other worlds move around you, and the day side turns as a world circles its star. In free space and on cruise the ship holds its course through the system, and cruises follow their destination along its orbit.

Distances and planet sizes are intentionally compressed. There is no combat, inventory, or full game-state save.

## Check

`node --test galaxy-explorer/*.test.mjs`

Tests cover motion stability, descent limits, landing easing, seed determinism, body spacing, cruise paths, stellar physics, an Earth-like sanity check, physical consistency (water state vs temperature, no life without water), galaxy-wide variety, giant physics and placement (moons clear of the cloud tops, nothing crowding a giant's moon system), seamless giant cloud maps and ring gaps, and orbits over time (radii and heights kept, outer planets slower, speeds capped, no collisions or crowding at any time). The browser playtest covers map selection, travel, landing, and surface interaction.

## Files

- `index.html`, `style.css`: HUD, dialogs, and navigation atlas
- `game.js`: the game state machine: flight, landing, walking, space, cruise, camera, discovery and saving; wires the modules below together
- `surface.js`: the landing site (atmosphere glow, rocks, crystals, monument, plants, animals) and what you collide with on foot
- `kestrel.js`: the ship model, shadow, landing dust, gear, lift jets and engine glow
- `system-view.js`: every world, the star and background stars in the 3D scene, placed along their orbits
- `orbits.mjs`: where every body is at a given time
- `input.js`: keyboard, mouse look, touch joystick and hold buttons
- `hud.js`: flight/foot HUD readouts, buttons and waypoint
- `audio.js`: the optional engine sound
- `system.mjs`: assembles a system from physics into game data; terrain and cruise paths
- `physics.mjs`: stars and worlds in real units
- `biomes.mjs`: biome classification, colours and generated descriptions
- `rng.mjs`: hash-based deterministic randomness
- `terrain.mjs`: simplex noise, per-biome terrain shapes, sea level, surface colour
- `flora.mjs`: plant species generated from each world's environment
- `flora-mesh.js`: plant models, placement and wind sway
- `giant-mesh.js`: gas and ice giants: cloud map, haze and rings
- `planet-lod.js`: quadtree level of detail for every world, and the tile streamer
- `chunk-build.mjs`, `terrain-worker.js`: building terrain and water tiles, on a background thread
- `fauna.mjs`: animal species generated from each world's environment
- `fauna-mesh.js`: animal models, shader animation and behaviour
- `inspect.mjs`: command-line system viewer and statistics
- `galaxy.mjs`: spiral density field, on-demand star cells, jump targets
- `starmap.js`: the unified full-screen star map (galaxy → neighbourhood → system → moons)
- `galaxy-ui.js`: saved galaxy position, jump and arrival effects
- `flight-math.mjs`: damping, descent limits, and maneuver easing
- `vendor/`: pinned Three.js and license

Local prototype; not yet linked from the main game catalog or deployed to olid.is.
