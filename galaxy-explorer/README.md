# Elsewhere — procedural worlds

A standalone procedural 3D exploration prototype for olid.is. New code and procedural assets; no Solar System game code is reused.

## Run

From the website repository: `python3 -m http.server 8765`, then open `http://localhost:8765/galaxy-explorer/`. Static HTML and modules; no build step. Three.js 0.161.0 is vendored with its MIT license. Fonts have system fallbacks.

## Explore

- **M** opens the star map on your current system; **G** opens it on your stellar neighbourhood. It is one full-screen map: zoom (scroll, pinch, or +/−) from the whole spiral galaxy down through arms and neighbourhoods to a single system's planets and moons. Tap to select, double-tap a star or world to fly to it. The side panel (a bottom sheet on phones) shows the selection, the selected system's worlds, and stars in jump range.
- From the map, **Cruise** to a world in your system, or **Jump** to a star within 12 light years. Jumping needs free space (above 600 m); if a star is isolated in a gap, the drive overcharges just enough to reach the nearest neighbour. Systems you have not visited show only orbits until you jump there.
- **T** engages cruise to the selected destination or disengages an ongoing cruise into manual flight.
- Every star in the sky is a real star you can fly to. Fly past the outer orbits and the star drive engages: **W/S** set the throttle, **A/D** and **↑/↓** steer, **Shift** boosts. Choose a star on the galaxy map and **Set course**; **T** then toggles the autopilot. Nearing a star builds its system in the background, and you fly straight in at its edge.
- Click the view for mouse look (Esc releases).
- **Targets:** tap or click a world, moon or star in the view (or press **Tab** to cycle, nearest the middle of the view first). Its name and distance show on the waypoint, and in space the ship keeps its nose on it whenever you are not steering; steering takes over until you let go. Tab starts with the nearest world, then cycles through what is in view. Tapping empty space, the **Clear target** button or **C** clears it, leaving no destination at all. Stars can be picked from inside a system too: the marker then points the way to that star with its distance in light years, the ship turns toward it, and **T** engages an autopilot that flies you out of the system and on to the star. Setting a course always replaces a world you had in focus. In deep space, picking a star sets your course; picking a world of the system ahead sets your course to that world, which becomes your target on arrival.
- **W/S** thrust, **A/D** turn, **↑/↓** pitch, **R/F** vertical thrusters, **Shift** boost, **X** brake.
- Climb above **600 m** to leave local orbit. Lift gets stronger the higher you are, so the climb takes seconds, and the view eases from looking down at the ground to looking ahead. In free space, movement is unrestricted; entering a world's vicinity restores surface flight. The star has an exclusion zone; well before it the hull heats up, the view glows at the edges and warnings appear.
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
   **Life on other chemistry** (`exoticChemistry` in `physics.mjs`): worlds without liquid water can still host life built on something else. Cold worlds with thick air get **ammonia** seas (about −80 to −20 °C), very cold ones **methane** lakes like Titan (around −175 °C) with an orange haze, hot volcanic worlds **sulfur** life (and molten-sulfur pools), and very hot worlds **silicon** life. Each has its own habitability score, scaled down because these are long shots, and needs an older star to reach complex life. It is drawn from the same random numbers as before, so no other world changed. About a fifth of worlds with animals run on exotic chemistry. Exotic life has its own plants, animal palettes and slower metabolism (methane life is very slow), shows a violet ring and an EXOTIC tag on the star map, and is labelled as, for example, "complex life (methane-based)".
4. **Biome and look** (`biomes.mjs`): Volcanic, Toxic, Desert, Verdant, Oceanic, Frozen, Amethyst or Barren, chosen from the physics. Each world gets a seeded hue shift; vegetation is tinted by the star (dark red-purple under red dwarfs, pale under hot stars); lower gravity raises relief. Descriptions and map facts are written from the actual numbers. Sunlight takes the star's colour.

Randomness is hash-based (`rng.mjs`): every object draws from its own key path, such as `rng(seed, 'planet', 3)`, so any object can be generated alone and new traits don't reshuffle existing worlds. Real units live in `body.physics`; game distances and sizes are compressed.

Enter a seed in the map or use **Discover a new system**. The seed is in the URL (`?seed=1408`), so links reproduce a system. Generating restarts flight; visits and recorded signals are stored separately per seed. Reloading returns you to your current star, above its most habitable world. The log button opens the current world's recorded note.

`node galaxy-explorer/inspect.mjs 1408 42` prints systems as tables; `node galaxy-explorer/inspect.mjs --stats 3000` prints star, biome and life frequencies for tuning.

## Galaxy

`galaxy.mjs` defines a two-to-four-armed spiral galaxy 60,000 light years across (seed `GALAXY_SEED`). Nothing is stored: space is cut into 10-light-year cells and each cell's stars come from `hash(galaxySeed, cell)`. A density field (exponential disc, logarithmic spiral arms, central bulge, thin vertical profile) sets each cell's expected star count, so arms, sparse gaps and a crowded core emerge on their own. A star's system is `generateSystem(star.seed)`; star ids encode their cell (`?star=-917_1262_0_0`), so any star can be rebuilt from a link. `starmap.js` draws one continuous map, generating detail for the current zoom so nothing is ever a stretched image: a soft haze of the whole galaxy, then procedural light points from a quadtree of tiles (`visualTile`, one level finer each time the view halves), then real stars from the cells in view, then each star's orbits, planets and moons. Systems are drawn compressed (outer orbit ≈ 0.3 ly) so you can zoom straight into them. Nothing is redrawn unless the view changes, the 3D scene pauses while the map is open, and the map avoids CSS backdrop blur, which made each frame several times slower. Stars are thinned to roughly a fifth of real density near home so the local chart stays readable. The chart is seen from above, but jump range is measured in 3D: stars far above or below you are drawn smaller and fainter (unless in range), and labels, the jump list and the side panel give each star's height, such as "6 ly below".

## Interstellar flight

The sky is the galaxy's real stars (`deep-space.js`): every star within 60 light years is drawn in its true direction, sized and brightened by its luminosity over distance squared, over a faint backdrop of unresolved stars. Inside a system you see them from its star; in deep space, from wherever you are, so they shift as you travel.

A system's edge sits just beyond its outermost orbit. Systems are compressed, so each edge counts as 0.002 light years from its star. Past it, the ship's position is kept in light years and the scene stays centred on it. The star drive covers the distance to the nearest star in about 5 seconds at full throttle (2 with boost), so speed grows far from stars and falls near them: a 5-light-year trip takes about a minute, and arrivals are gentle. Light comes from the nearest star, the star ahead grows into a sphere sized to match what you will see from its edge, and streaks show the drive at work.

Within 0.4 light years of a star its system is built in the background and its real worlds are drawn as a miniature: scaled down around the camera so it fits within view range, yet looking exactly like the full-size system from where you are. Worlds still under two pixels across show as dots so the system is visible from afar. This covers the system you are leaving as well as the one ahead. The system is built, one world per frame and giant cloud maps in slices, so arriving never stalls the game. At the edge you enter it on the side you came from, still heading the same way; your galaxy position, the URL and the map switch to the new star. The autopilot flies past stars that are not its destination; flying in by hand enters any system. Off-chart test systems (`?seed=`) have no place in the galaxy, so their edge is closed.

Your current star, visited stars and jump count are saved in `localStorage` (`elsewhere-galaxy-v1`). Jumps play a warp effect and reload into the destination system; after a jump you start in open space a couple of kilometres from a world, on its sunlit side, facing it. `?seed=` still opens a standalone off-chart system for testing; jumps from one are measured from your last charted star.

## Terrain

`terrain.mjs` builds each world's surface from seeded 3D simplex noise sampled on the sphere, so there are no seams or poles. Each biome has its own shape: continents with mountain ridges, wind-aligned dunes on deserts, cracked plains on frozen worlds, sharp crystal ridges on amethyst worlds, cones and calderas on volcanic worlds, and impact craters on airless bodies.

Sea level comes from the physics. Ocean coverage (for example 65%) is turned into a height, by sampling the whole world and picking the level that floods that share. Liquid-water worlds get transparent oceans with visible shallows, volcanic worlds get glowing lava seas, and frozen worlds get flat ice sheets you can land and walk on. Colour is chosen per point from altitude, latitude, local temperature (colder toward poles and peaks) and a moisture field: beaches along coasts, vegetation tinted by the star where there is plant-like life, darker forests where it is wet, microbial mats near shore, snow caps, lava-crust shores. Rocks take a darker shade of the ground they sit on.

The terrain is never flattened: the signal site is simply the nearest dry, fairly level ground to the generated signal point, found by a spiral search, so it is never under water or lava. Kestrel cannot land in water or lava, and you cannot walk into them. Add `&world=planet-1` (or `moon-0`, etc.) to a URL to start above a specific world.

## Plant life

Living worlds get their own species (`flora.mjs`): 1–2 microbial forms (mats, layered mounds) on microbial worlds, 3–5 species with simple life, 5–8 with complex life. Each world's environment decides which forms thrive: broad-canopied trees, tiered spires, fronds, bushes, grasses, water-hoarding pillars, stalked caps or pod-stalks. Temperature and water favour some forms over others. Gravity sets height (low gravity grows tall, thin plants; high gravity keeps them squat). The star's light sets leaf colour, from green under Sun-like stars to near-black and magenta under red dwarfs. Dim light makes bioluminescence common. Exotic worlds grow their own forms instead: glassy crystal clusters and branching glasswood (silicon), mineral chimneys crowned with feeding tubes and feathery plumes (sulfur), waxy bulbs and translucent sails (ammonia), and towering beaded threads and tar-dark crusts (methane). Every species has a generated name, colours, shape and a preferred habitat (temperature, moisture, shoreline or highland), and is described from those traits.

`flora-mesh.js` builds one low-poly model per species and draws every plant of that species as an instance, which keeps it to a couple of draw calls per species (about 1,600 plants on desktop, 900 on touch devices). Plants are placed where the terrain's local climate suits them, mostly around the landing region with the rest across the world, never under water, at the site itself or on the landing pad. They sway in the wind, more in thick air and less in thin. Flat growths (microbial mats, crusts) lie along the slope, in overlapping patches of slightly different thickness that reach into the ground, so they never flicker or float. Walk near a plant to catalogue its species; catalogued species are saved per world and listed on the star map.

## Animal life

Worlds with simple or complex life get animals (`fauna.mjs`): 1–3 small crawlers, skitterers, creepers or coils with simple life, 4–8 species with complex life. Each species is generated in four layers:

1. **Body plan and form**, chosen by the environment: four-legged (runner, tank, browser, prowler, hopper), two-legged (strider, raptor, waddler, upright), six-legged (beetle, mantis, ant, roach), eight-legged (spider, harvestman, scorpion), legless coil (worm, eel, segmented), slug or snail, winged glider (bat, insect, bird), or gas-filled drifter (jellyfish bell, ribbed balloon, manta, bladder cluster). Weak gravity favours fliers, drifters and long legs; nothing flies in near-vacuum.
2. **Traits** (the species' stats, all 0–1 except diet): diet (herbivore, omnivore, carnivore, filter-feeder), intelligence, sociality, aggression, caution, metabolism, perception. Intelligence is rare and grows with the biosphere's age.
3. **Everything else derives from plan + traits + environment.** Hunters get forward-facing eyes and long snouts; grazers get side eyes and longer necks; defensive grazers grow horns; bigger brains mean bigger heads; clever bipeds stand upright and get arms with hands. Herd size follows sociality, speed follows legs and metabolism, and reactions to you follow caution, aggression and intelligence (bolting, sizing you up, curiosity). A **civilization level** (none, tool users, village builders, city builders, planet-shapers, spacefarers) comes from intelligence, sociality, how well the body can shape things, and the star's age (see Intelligence).

   Two body plans have no counterpart among Earth's land animals: **radial** walkers (a three-legged tripod with its body slung high and an eye stalk on top, a five-armed starwalker that sees from its arm tips, an octopus-like tentacle walker), which have no head and no front, and **rollers** (a living wheel rolling on a muscular rim around an upright, eyed hub, and an armoured ball that rolls with eyes at the ends of its axle).
4. **Look**, mixed and matched per species so no two worlds share an animal: colour scheme (camouflage matched to the biome, warning colours, iridescent, display), pattern (bands, stripes, rings, spots, mottled, dapple, saddle, gradient), head shape (round, long, wedge, flat, domed, beaked), jaws and teeth, brows, ears, antennae, mandibles, neck frills, back (shell, spines, plates, hump, sail, ridge), tail (whip, fan, club, spiked, scorpion stinger), feet (claws, hooves, pads), eye count, and on dark worlds glowing markings. Chemistry sets the palette on exotic worlds: glassy, faceted (flat-shaded) silicon animals that glow from inner heat, sulfur yellows and ambers, waxy ammonia pastels and tar-dark methane reds.

Future systems should read the traits, not the derived values. Ecology (below) does.

`fauna-mesh.js` builds one model per species. The body, neck, head and tail are one smooth tube swept along a spine (tail, hips, belly or insect waist, shoulders, neck, skull, snout) with countershading and stripes, spots or a saddle on the back. Limbs are jointed tubes (hip, knee, ankle, toe) rooted inside the body, so everything connects. Eyes are eyeballs with pupils set into the head. Each species is drawn with instancing in one draw call, and animated in the vertex shader from a per-animal gait cycle: legs swing at the hip and fold at the knee on the forward swing, arms swing opposite the legs, wings flap, tails and tentacles curl toward the tip, coils ripple, and normals rotate with the limbs so lighting follows. A small behaviour model moves each animal over the sphere: grazers wander and graze in herds and bolt, hunters and curious species approach, fliers and drifters circle overhead; ground animals turn back at water, and everything stays within about 230 m of the site. Get close enough to observe an animal and its species is recorded; observed species are saved per world and listed on the star map.

## Ecology

Animals now live off each other and their world (`ecology.mjs`, acted on in `fauna-mesh.js`). Everything comes from the traits above, drawn from its own key path so no existing species changed:

- **Day and night.** Each species is diurnal, nocturnal, crepuscular (dawn and dusk) or active at any hour. Dim stars, glowing markings, keen senses and a hunter's diet favour the night. Outside its hours an animal walks back to its herd and sleeps there, settled low on folded legs, and wakes when its time comes. Worlds that always show their star one face have no day cycle, so everything on them is active at any hour. Every world with days keeps at least one ground species awake in daylight, since that is when you usually land.
- **The food web.** Carnivores hunt ground animals smaller than themselves (fliers take only small prey, and other hunters only if much smaller, so no two species hunt each other). Omnivores eat plants and now and then take small non-hunters. Fliers and drifters are never prey. Descriptions name what a species hunts and what hunts it.
- **Hunting.** A hungry hunter that sees prey (perception sets the range) stalks at a walk, then sprints, and gives up when its stamina (metabolism, aggression) runs out or the prey outruns it. Fliers swoop down. Prey that spot a hunter bolt, and the alarm spreads through their herd. Big or aggressive grazers turn and face the hunter instead, and hunters soon give up on them. A caught animal disappears and comes back later at its herd, out of your sight. Pack-mates share a kill, and hunters eat big meals seldom. If a catch happens near you, a message tells you what you saw.
- **Eating and drinking.** Hunger and thirst build at a rate set by metabolism. Grazers walk to an actual plant and eat it with their heads lowered (where there are no plants they graze the ground cover). On worlds with seas, animals walk to the shore and drink. Trips are limited to what an animal can walk in about a minute and a half.
- Sleeping animals notice less: skittish ones let you come closer, and hunters find them easier prey.

## Intelligence

**Minds.** Every animal has a mind level, shown in its description when you observe it ("Mind: city builders (intelligence high, shapes things with tentacles)") and next to each observed species on the star map. Below culture it is instinctive, simple, cunning, or clever without culture. Above that comes the civilization ladder: **tool users, village builders, city builders, planet-shapers, spacefarers**. Climbing needs intelligence most, then cooperation (sociality), then a body that can shape things (`manipulatorsOf` in `fauna.mjs`): hands are best, then tentacles, raptorial forelegs, pincers and pedipalps, mandibles, beaks and feet, fins and coils, and rollers barely at all. Older biospheres gate the higher steps. In the galaxy as a whole, the most advanced species in a system reaches tool use in about 1 system in 17, villages in 1 in 39, cities in 1 in 96, planet-shaping in 1 in 211 and spaceflight in 1 in 471. Cities are built by bipeds, radial walkers, drifters, spiders and insects.

**Architecture follows the body** (`structures.mjs`). Each body family has its own building cultures, picked per species from its traits and world, so two species of the same shape can build very differently. Only species with hands build houses, halls and rockets:

| Builders | Cultures |
|---|---|
| bipeds with hands | timber roundhouses, longhouses and tiered towers · flat-roofed pueblos and stepped pyramids (deserts) · hide tents, yurts and many-peaked pavilions (wandering kinds) · stilt houses on walkways (wet worlds) |
| octopus and star walkers | grown, coral-like branches, lumps and great fans · secreted spiral shells |
| three-legged walkers | pods raised high on three legs · ringed enclosures around carved pillars |
| gas-filled drifters | platforms tethered in the air under gas-bags · frond-stalks hung with bulb dwellings · masts hung with pods |
| six-legged | honeycomb towers of hexagonal wax cells · banded earth spires and tunnelled mounds |
| eight-legged | silk tents, canopies and funnel webs on poles · trapdoor burrows with lids and chimneys |
| coils, slugs, snails | domed burrows with ramps and glowing skylights, terraced amphitheatre pits · spiral shell towers |
| fliers | nest perches and perch-trees · rookery stacks full of ledges · woven nests hanging from arches |
| four-legged, handless bipeds | turf barrows inside earth banks and henges · domes of living trees woven together · domes |
| rollers | wheel-shaped houses and banked loop tracks · domes |

Grown cultures build from their own bodies' products (shell, silk, wax, living wood, membrane); the rest use the world's own materials: timber where forests grow, ice on frozen worlds, clay in deserts, glass on silicon worlds, otherwise stone. Accents use the species' own colours, buildings scale with the builders' size, and weak gravity builds taller.

**What each step looks like** (`structures-mesh.js`), around the builders' herds' homes near the site. Each home moves to open, dry, fairly level ground well clear of the signal and the pad, and the herd moves with it, so the builders live there.

- **Tool users**: cairns, trails of marked stones between homes, simple shelters in their own style, and hearths where there is air to burn.
- **Village builders**: a village of dwellings around a gathering place, small hamlets at their other homes, and tended fields if they eat plants.
- **City builders**: dense cities in three rings of larger dwellings around a great structure (pagoda, stepped pyramid, pavilion, great comb, funnel web, giant spiral, amphitheatre, henge, perch-tree, great loop…), with avenues for species that walk and towns at their other homes.
- **Planet-shapers**: bigger cities with street lights, roads running to the horizon, and towns all over the world, lit at night and visible from orbit. Their radio signals reach the next star.
- **Spacefarers**: a launch site in their own idiom: rockets on gantries (hands), grown launch towers (tentacled walkers), a giant tripod cradle, a tether climbing out of sight into orbit (drifters), launch silos (hives, spiders, burrowers), a rail up a towering perch (fliers) or a long launch ramp (grazers and rollers). Satellites and a ring station circle the world.

Builders clear their ground, so most plants inside a settlement are gone. Everything is merged into two meshes (one lit, one glowing), whatever the size: two draw calls. Vertices are capped (far-off towns stop at the budget), so the biggest world builds in under 0.1 s. Footings reach into the ground, so nothing floats on a slope. Buildings are solid on foot, while fields, roads and hearths can be walked over. Walking within about 45 m of a settlement, or flying low over it, records it: a message describes the builders, and the star map lists the world with their tier. Builders also clear rocks and most plants from their ground.

**Radio signals** (`signals.mjs`). Planet-shapers and spacefarers broadcast, and their signals carry much farther than the jump drive: planet-shapers are heard out to 80 light years, spacefarers out to 150. Every system within 150 light years of your star is checked in a background thread (`signals-worker.js`, or in small slices if workers are unavailable), taking well under a second on a laptop, and the result is cached per star. On the map, each source is a gold signal mark at every zoom, out to the galaxy view, and you can tap it. The side panel lists them nearest first (**RADIO SIGNALS · N HEARD**). Selecting one says who lives there, how far it is, and that you can set a course and fly there, or jump closer star by star. Within jump range they also get a gold ring and a SIGNALS tag. Ocean worlds with no dry land near the landing site have nowhere to build.

**Life on the map.** In the system view, surveyed worlds with life carry the same rings as stars on the galaxy chart (dashed for microbes, bolder for animals, violet for exotic chemistry), and the world list tags them FAINT LIFE, LIFE or RICH LIFE, plus EXOTIC. A selected world says how rare its life is galaxy-wide, for example "Complex life with animals: very rare, about 1 world in 76". The odds are listed separately for water-based and exotic life, and `starmap.test.mjs` checks them against the generator.

The star map's **long-range scan** senses biosignatures at stars within jump range before you visit: green rings on the chart (dashed for faint), and the panel and jump list say whether life is faint (microbial), clear (plants) or strong (complex life with animals).

## Skies

Worlds with air have a sky (about 0.03 bar and up; thicker air gives a stronger, brighter sky). Its colour is the world's atmosphere tint, lightly tinted by its star: bright by day, shifting warm at sunrise and sunset, and dark at night, from where the star sits in your sky. It fades back to black as you climb toward orbit, the stars fade out in daylight, and haze softens distant land. Airless worlds keep the black sky of space. Seas are lit as smooth spheres, not with the ground's facets.

## Rendering and travel

Every planet and moon, including the one you are on, is drawn by one level-of-detail system (`planet-lod.js`). Each world is a cube projected onto a sphere, and each face is a quadtree of tiles. A tile splits into four finer tiles when the camera is closer than about twice its width, and merges back as you leave. Detail therefore rises smoothly as you approach anything, so a nearby moon sharpens too and there is no jump when entering orbit. Close up, triangles are about 0.6 m across. Changes between detail levels are smoothed (geomorphing): every vertex also stores where it sits in the next coarser level, and the shader blends toward that by distance, so a tile already looks exactly like its parent when the two are swapped, and tile edges meet coarser neighbours without gaps. Skirts are lit with the ground's own normals, so any remaining hairline gap is invisible. Tiles beyond the horizon are not drawn, and the coarser tile stays visible until its four children are ready, so detail never leaves holes. Skirts along tile edges, on land and water, hide seams between tiles of different detail. Tiles are built in background threads (`terrain-worker.js`, falling back to the main thread if workers are unavailable), and the coarsest level of every world is built at load so nothing pops in empty. Water and lava are tiles too, matching the terrain's detail. A logarithmic depth buffer keeps distant seas and coastlines from flickering.

Worlds are compressed but cover a wide range: planets are roughly 105–540 m in radius and moons 100–190 m. Site features (the landing pad, rock and plant regions) are measured in metres, so they look the same on any size of world. World coordinates are rebased on arrival. Cruise moves through space above the orbital plane and can be disengaged; manual flight crosses between worlds too.

On foot you collide with rocks, plant trunks and bushes, and the parked ship (grasses and microbial mats are walked through), sliding along them rather than stopping dead. Space jumps; jump height follows the world's gravity, so low-gravity moons give long, floaty leaps over low obstacles. Click the view to capture the mouse: moving it then looks around, on foot and in flight, without holding a button (Esc frees the cursor). On touch devices a joystick moves you, dragging the view looks around, and the HUD collapses to the essentials.

Giants (`giant-mesh.js`) are a smooth sphere with a generated cloud map (bands bent by turbulence, streaks, sometimes a storm), a haze at the limb and, if ringed, rings with gaps. The map is sampled on the sphere, so it has no seam, and the planet turns slowly. Giants are 700–1700 m in radius and get extra orbital room so their moons stay clear of neighbours. They have no surface: cruising to one stops in space on the day side, and you cannot fly closer than 250 m to the cloud tops. Their moons are landed on as usual.

## Moving orbits

Every planet and moon moves along a circular orbit (`orbits.mjs`). Time is the real clock, so positions match between visits, survive a reload, and the star map shows where everything is now. Planets follow Kepler's third law: the innermost slot takes 10 minutes per orbit and periods grow with distance to the power 1.5, so outer worlds take hours. Moons of a rocky planet share one 3-minute period, so neighbouring moons never pass through each other; giants' moons orbit outside the rings and follow Kepler's law from an 8-minute innermost period. Nothing moves faster than about 50 m/s, well below cruising speed.

Coordinates in the scene are relative to the world you are at. Near a world (flying, landed, on foot) you travel with it, so nothing local changes; the star, sunlight and the other worlds move around you, and the day side turns as a world circles its star. In free space and on cruise the ship holds its course through the system, and cruises follow their destination along its orbit.

Distances and planet sizes are intentionally compressed. There is no combat, inventory, or full game-state save.

Planned gameplay (documenting life to upgrade the ship) is described in `PROGRESSION.md`.

## Check

`node --test galaxy-explorer/*.test.mjs`

Tests cover motion stability, descent limits, landing easing, seed determinism, body spacing, cruise paths, stellar physics, an Earth-like sanity check, physical consistency (water state vs temperature, no life without water), galaxy-wide variety, giant physics and placement (moons clear of the cloud tops, nothing crowding a giant's moon system), seamless giant cloud maps and ring gaps, and orbits over time (radii and heights kept, outer planets slower, speeds capped, no collisions or crowding at any time), and interstellar frames (axes match the map, worlds stay inside the system edge, stars look the same size from both sides of the edge), and ecology (food webs follow diet and size, dim worlds favour the night, hunters catch prey that later return, grazers eat plants and animals drink without walking into the sea, animals sleep outside their hours and wake, and the ecosystem costs under 2 ms a frame), intelligence (the most advanced species builds in its body family's cultures, and only species with hands build houses and rockets; settlements stand on dry ground clear of the site and within walking range, grow with level and house their builders; planet-shapers spread across the world within the vertex budget; satellites stay in orbit), and life rarity on the map. The browser playtest covers map selection, travel, landing, and surface interaction.

## Files

- `PROGRESSION.md`: the plan for gameplay: documenting life unlocks ship upgrades; the upgrade tree and its to-do list
- `index.html`, `style.css`: HUD, dialogs, and navigation atlas
- `game.js`: the game state machine: flight, landing, walking, space, cruise, camera, discovery and saving; wires the modules below together
- `surface.js`: the landing site (atmosphere glow, rocks, plants, animals) and what you collide with on foot
- `kestrel.js`: the ship model, shadow, landing dust, gear, lift jets and engine glow
- `system-view.js`: every world and the star of a system in the 3D scene, placed along their orbits; built at once or gradually
- `deep-space.js`: the real-star sky, interstellar frames and scale, the approaching star and drive streaks
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
- `star-mesh.js`: stars up close: churning, limb-darkened surface with sunspots, corona and glow
- `planet-lod.js`: quadtree level of detail for every world, and the tile streamer
- `chunk-build.mjs`, `terrain-worker.js`: building terrain and water tiles, on a background thread
- `fauna.mjs`: animal species generated from each world's environment
- `fauna-mesh.js`: animal models, shader animation and behaviour
- `ecology.mjs`: each species' activity cycle, food web, hunger, thirst, sight and stamina
- `structures.mjs`: which species builds, its body family, culture and material, and how it is described
- `signals.mjs`, `signals-worker.js`: which civilizations can be heard from your star, scanned in the background
- `structures-mesh.js`: every culture's buildings, layouts for each step of the ladder, roads, launch sites, satellites and station
- `inspect.mjs`: command-line system viewer and statistics
- `galaxy.mjs`: spiral density field, on-demand star cells, jump targets
- `starmap.js`: the unified full-screen star map (galaxy → neighbourhood → system → moons)
- `galaxy-ui.js`: saved galaxy position, jump and arrival effects
- `flight-math.mjs`: damping, descent limits, and maneuver easing
- `vendor/`: pinned Three.js and license

Local prototype; not yet linked from the main game catalog or deployed to olid.is.
