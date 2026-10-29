# The Stillwater

A separate pixel-rendered harbor runner; it does not replace Gravity Dash.
Serve the repository root and open `/harbor-study/`. Three.js 0.161.0 loads from jsDelivr.

## Controls

- Space / up arrow: jump
- Left / right or A / D: dodge sideways; within 11 meters of a junction, queue a turn or choose a fork
- Hold down / S: duck beneath fallen beams
- Drag the first-person view to look around
- P / Escape: pause
- R: restart with a **new** route
- Touch: jump, hold-to-duck, and left/right controls

## Score

Distance scores continuously. Clearing a gap is worth 20, passing a hazard 15 and making a turn 10. Each of these raises the combo, and every 10 combo adds ×1 to the multiplier (up to ×7), which also boosts distance points. A fall resets the combo and costs one of three lives. At zero lives the run ends with your score; the best score is kept in the browser.

## Every run is different

`motion.mjs` draws each route from a fresh seed (`newRoute()`): the first corner's direction, every stretch's length and east/west choice, district order, gaps, hazards (number, type, lane), forks and the features below. Only the opening quay's scenery is fixed. `?seed=123` replays a particular run.

Stretch features:

- **Elevation**: smooth 8 m ramps raise or lower the walk by 1.7 m (0–3.4 m above the water), on stilts with cross-bracing. Climbing slows you slightly.
- **Narrow beams**: a single 0.5 m board, no sidestepping; may carry gaps and low beams, never cargo.
- **Through a house**: a covered passage with plank walls, light slits and a pitched roof; its ceiling sags once you are inside.
- **The deep woods**: long dark forest districts with huge leaning trunks and buttress roots, a canopy closing overhead, swaying moss curtains (always above jump height over the walk), cypress knees, fallen logs, black still water, drifting spores and dense fog. You enter between two trunks leaning together. Other districts gained wrecks, standing stones and reed beds.
- **Archways**: rows of stone arches over the deck, or standing in the water around a narrow beam.

A missed jump, hazard or turn respawns a few metres back on clear boards.

## Look

The game is first person only. The camera bobs with your stride, sways, dips on landing, leans into dodges and corners, and widens its field of view as you speed up.

Everything renders into a ~288 × 180 framebuffer. A single green ramp of six shades, like an old monochrome arcade monitor, is ordered-dithered between steps; water uses the same ramp. The ocean writes alpha 0 so the post pass treats water separately: its scanlines wobble and its dither crawls.

The sea sums seven Gerstner swells. Their crests are bent by a slow phase warp, and their heights are modulated by drifting group envelopes, so waves come in irregular sets. Harbor impacts are timed to the dominant swell and scale with the set. Each one throws up to 52,000 single-pixel droplets (climbing sheet, spray, mist) and leaves a foam web that drains outward.

## The dream

The world is calm most of the time, and strange in a quiet, familiar way. Stairs climb out of the water and end in the air, some with a door at the top. Doors stand in the sea. A house hangs upside down from the sky. A boardwalk branches off and climbs into the clouds. Sometimes a second pier runs overhead, upside down, with its lamps hanging.

Every 30–60 seconds a dream event takes over for about 12 seconds, then settles. Events are visual only; the boards under you never move.

- **Wave of houses**: a crest travels ahead of you. Everything beside the route curls over the walk like a breaking swell, then crumples and pours toward the water before slowly standing up again. A clear space is always kept over the walk.
- **Sky flip**: an upside-down copy of the world dissolves into the dark above the horizon, pixel by pixel, with the sea overhead and the boardwalk hanging from it.
- **The sea rises**: the horizon climbs into a wall of water around you and the view slowly rolls.
- **Melt**: houses ahead slump, drip and spread into the water like wax.

A `dreamLevel` uniform keeps the background warping, frame shear and slipping columns faint between events and raises them during one.

`dream.js` patches every built-in material. Geometry beyond ~9 m sways, leans and curves upward toward the horizon. Melt zones (12 slots) make some houses slump, bulge, drip and spread into the water as you approach, and covered passages sag. The post pass also shears the frame by whole pixels and lets thin columns slip.

## Validation

`node tests/harbor-study.mjs` checks that 12 seeds give 12 different routes, then autopilots 25 seeds × 100 stretches (all must stay traversable, with continuous elevation, right-angle joins and no southward legs). It also checks gaps, jumps, missed turns, ducking, cargo dodging, no sidestepping on beams, both fork branches, scenery clearance and rails.

## Debug parameters

`?seed=N` · `?area=forest|swamp|village|exposed|fork|narrow|house|arches|ramp` (jump to the first such stretch) · `?event=wave|skyflip|searise|melt` (trigger that event 3 s in) · `?t=12.3` (freeze the clock) · `?look=yaw,pitch` · `?still` (park the player) · `?maxdt=0.2` (let slow renderers advance time faster).
