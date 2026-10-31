# Elsewhere — seven worlds

A standalone procedural 3D exploration prototype for olid.is. New code and procedural assets; no Solar System game code is reused.

## Run

From the website repository: `python3 -m http.server 8765`, then open `http://localhost:8765/galaxy-explorer/`. Static HTML and modules; no build step. Three.js 0.161.0 is vendored with its MIT license. Fonts have system fallbacks.

## Explore

- **M** opens the system map. Select a world on the chart or in the list and choose **Cruise**. Scroll to zoom; drag to pan.
- **T** engages cruise to the selected destination or disengages an ongoing cruise into manual flight.
- **W/S** thrust, **A/D** turn, **↑/↓** pitch, **R/F** vertical thrusters, **Shift** boost, **X** brake.
- Climb above **600 m** to leave local orbit. In free space, movement is unrestricted; entering a world's vicinity restores surface flight. The star has an exclusion zone.
- **L** begins a 3.8-second landing below 32 m and 18 m/s forward speed. On the ground it begins a 3.6-second powered liftoff to 22 m. Both use gear, lift jets, and dust.
- **E** disembarks, investigates within 9 m of a signal, or boards within 9 m of the ship.
- On foot: **WASD** walk, drag or arrow keys look, **Shift** walk faster.
- **H** opens the manual and pauses. Sound is opt-in. Touch movement and contextual action buttons are included.

## Generation and persistence

Five planets and two moons are generated from a numeric seed. Radius, orbital phase, terrain, signal location, and landmark layout are seeded. Volcanic, desert, verdant, frozen, and amethyst biomes have distinct palettes, relief, and authored discovery text. The outer planet has rings. All seven worlds support landing and walking.

Enter a seed in the map or use **Discover a new system**. The seed is in the URL (`?seed=1408`), so links reproduce a system. Generating restarts flight; visits and recorded signals are stored separately per seed. Reloading starts above Vesper, preserving the current seed's survey records, not the ship position. The log button opens the current world's recorded note.

## Rendering and travel

The nearest world has detailed curved terrain and instanced surface objects. Other destinations use lower-detail terrain meshes. World coordinates are rebased upon arrival, and old surface geometry and materials are disposed. Cruise moves through space on a short route above the orbital plane, with visible departure and arrival; it can be disengaged. Manual flight supports crossing between world regions too.

Distances and planet sizes are intentionally compressed. Orbital positions are a generated static snapshot, not an orbital-mechanics simulation. There is no galaxy, combat, inventory, or full game-state save. Rocks remain decorative rather than collision obstacles. Surface findings use authored text; terrain and placement are generated.

## Check

`node --test galaxy-explorer/flight-math.test.mjs galaxy-explorer/system.test.mjs`

Tests cover motion stability, descent limits, landing easing, seed determinism, body spacing, and cruise paths. The browser playtest covers map selection, travel, landing, and surface interaction.

## Files

- `index.html`, `style.css`: HUD, dialogs, and navigation atlas
- `game.js`: rendering, ship/surface/space states, travel, camera, and interaction
- `system.mjs`: seeded system/terrain generation and cruise paths
- `flight-math.mjs`: damping, descent limits, and maneuver easing
- `vendor/`: pinned Three.js and license

Local prototype; not yet linked from the main game catalog or deployed to olid.is.
