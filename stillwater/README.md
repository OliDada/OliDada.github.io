# The Stillwater

Serve the repository root and open `/stillwater/`. `node tests/stillwater.mjs` runs the route, collision and clearance checks.

A copy of `/harbor-study/` that sits between its green look and two-colour 1-bit art. It uses four shades taken from 1-bit pixel art (ink #0b1a1d, deep teal #2a483e, sage #709678, mint #cce8c8), dithered only between neighbouring shades, Game Boy style. Water carries drifting pale horizontal strokes where the light catches it. The clouds are dithered and the moon is large and cratered; the frame is ~288 × 180. Gameplay, generation and dream events are identical; the two copies are independent files.

## Readability, texture and the deepening run

- **Readable hazards**: crates and low beams use a bright self-lit material that ignores fog, so they always show in the lightest shade. Every gap and hazard has a lit warning lamp about 5–6 m before it, and gaps have pale painted lips.
- **Hand-drawn surfaces**: hatched materials draw world-locked marks that fade out beyond ~30 m. Wood gets grain dashes, roofs and rock get diagonal (then cross-) hatching in shade, stone gets stipple, and dark timber and foliage get pale flecks.
- **The run gets stranger**: `strangeness(index)` rises from 0 at the quay to 1 after ~45 stretches. As it rises, oddities, the upside-down pier and melting houses become more common. Background bending gets stronger, dream events come up to 60% more often, and the moon swells. A second moon appears, and late on the palette flashes to negative for an instant.

## Pixel UI

There are no HTML menus. `ui.js` draws everything into a canvas at the game's own resolution with a 3×5 bitmap font in the same colours. The title screen shows STILLWATER and a blinking PRESS SPACE (or TAP). In play, the score is top-left (with ×N when multiplied) and three diamonds for lives are top-right. Area names type themselves in as you enter a district. A single word of advice (JUMP, DUCK, DODGE, TURN >, < FORK >) appears only near trouble and blinks when it's close. The game-over screen shows score, distance and best; SPACE or a tap starts a new route.

Touch uses invisible zones: the left or right edge moves, holding the lower middle ducks, and anywhere else jumps.

## Districts

After the four-stretch opening harbor, districts last 7–10 stretches each. They never repeat back to back, and every kind appears before any repeats. Each district has its own play profile (how often the walk narrows, climbs or is covered, by what, and how many hazards and gaps), plus its own air (fog, light, wave height) and scenery:

- **Stillwater Quay** (harbor): warehouses, wide decks, cargo.
- **The Drowned Woods** (swamp): reeds, lily pads, moss; many narrow beams.
- **The Stilt Village**: four stilt houses per stretch, frequent passages through houses, lots of climbing.
- **The Outer Reach** (exposed): standing stones, wrecks, bigger waves, wide-open views.
- **The Deep Woods** (forest): giant trunks, a closed canopy, moss curtains, spores.
- **The Narrow Canals**: tall terraced houses wall to wall with stepped gables and a few lit windows, washing lines strung overhead, and stone bridges crossing high over the walk. The water is still.
- **The Cliff Road**: a sheer rock wall on one side and sea stacks in heavy surf far below on the other. The walk climbs high and stays there.
- **The Reed Sea**: walls of reeds taller than you, a few dead trees, mostly single beams, pale low fog.
- **The Ship Graveyard**: hulls lying on their sides, ribs, leaning masts with yards, and many gaps.

Place names no longer misspell themselves.

## Fork planning, stumbles and readable barriers

- **Forks plan both futures**: when a fork is generated, ten stretches of each branch are planned. Scenery keeps clear of both, so taking either branch never leads into rocks or houses that were placed for the other.
- **Overhanging cliff rock** sits much higher and leans in from the wall side, so it never blocks the view ahead.
- **Hitting an obstacle** is a jolt and a crouch on the boards. Only gaps and missed turns drop you into the water.
- **The harbor's low barrier** is a striped two-rail barrier instead of a rope of floats, so it reads clearly as something to jump.

## Fixes and crumbling

- **Nothing vanishes in view**: the dream bend moves geometry away from its original bounds, so frustum culling is off for scenery. Shore rocks now belong to their stretch instead of being re-laid every time you advance.
- **Forks never change what you can see**: both branches exist from the moment the fork is generated, and scenery is keyed to each stretch rather than its index. Choosing a branch swaps in the pre-built one. Nothing up to the fork is rebuilt, the abandoned branch stays until you've turned away from it, and nothing past either branch is built until you choose.
- **Gap edges**: ragged board ends of uneven length lie flat in the deck plane, no more tilted logs.
- **Arches**: drawn as one solid ring of overlapping voussoirs, and only in the harbor and outer reach. Other districts have their own covers: ship's ribs in the ship graveyard, gnarled roots in the woods and swamp, a hanging rock overhang on the cliff road, bridges and houses in the canals, and nothing in the reed sea.
- **The deep woods stand on mud**: a lumpy floor over the water that dips into dark puddles.
- **Crumbling houses** (`crumble.js`) replace melting. A house comes apart cell by cell from the roof down, about 2.6 cells per metre, and the crumbled cells are discarded in every material, shadows included. Each cell is thrown off as a pixel that pours away from the walk, hits the water and splashes up briefly, like the spray off the quay. Houses ahead crumble during the crumble dream event, and on their own now and then once the run is deep.

## Readability pass

- **Trees**: tiered spruces, round broadleaves and flat-crowned swamp cypresses with moss, all kept clear of the walk by their widest crown.
- **Reed sea**: clumps of reeds with open water between them, short near the walk and taller further out, in mixed pale and dark stems. Dead trees have branches that actually grow out of their trunks.
- **Nothing floats**: rocks, trees, reeds and floating timber all sit at the district's real water level.
- **Nothing covers the walk**: clearance uses each object's true size (rocks, cliff boulders, wrecks, stairs, trunks). The distant dream drift and lean move things only along your line of sight, never sideways across the path. During the wave event, the curling houses stop at the edge of the walk.
- **Respawning**: you always come back standing. Inputs pressed while falling are dropped, and jumping is ignored for a moment after you respawn.
- **Area names**: normal-size letters on a dark band.

## Obstacles and forks

- **Obstacles** are a shade lighter than the timber around them instead of glaring white. Each carries its own light: a lantern hangs from the middle of a low beam, and a small lamp burns on top of each crate. In dark districts (woods, swamp, reed sea) they glow a little more. The warning lamps before each obstacle remain.
- **Forks no longer flicker**: the extra crossboards are gone, and every stretch's boards start where the previous corner's landing ends. The two branches leaving a fork no longer draw planks (or mud) on top of each other.

## Trees, the world above, the breakers, lantern light

- **Trees**: eight kinds, mixed per district. They are firs (tiers of drooping, saw-toothed branch blades), Scots pines (bare trunk with an umbrella crown), birches (pale twin stems), willows (long strands to the water), dead snags, shrubs, broadleaves and swamp cypresses. Trees on the exposed reach and the cliffs lean with the wind.
- **The world above** replaces the screen-space sky flip and the random overhead pier. During the sky event, each stretch's own scenery (houses, trees, rocks, boards) is drawn a second time upside down about 50 m overhead, sinking slowly into view and then rising away. It never happens in the deep woods, where the canopy would hide it.
- **The Breakers** (new district): the walk crosses a field of black rocks in heavy surf. Rubble is heaped around the stilts and a navigation beacon stands on an outcrop. Up to 16 nearby rocks are passed to the ocean, so the swell foams around them and a third of the spray bursts off their faces.
- **Obstacle lanterns give real light**: crate lamps, beam lanterns and warning lamps light the boards and scenery around them with a flicker. The 16 nearest are used, through a shared uniform in every Lambert material. Beam lanterns now sit on top of the beam's ends, out of the space you duck through.

## Three more districts, and rocks off the path

- **The Mirror Shallows**: dead-level, almost motionless water. The stretch is drawn again upside down under the surface, and the surface is dithered thin, so the world really reflects. Rows of mooring poles run away in straight lines, with a moored rowing boat and a lone stilt hut with a lit window.
- **The Sunken Town**: a flooded square. Houses stand in the water up to their eaves, some windows still lit, and lampposts still burn (they light the scene). Roof ridges run beneath the boards, so you are running over drowned houses, and a church tower and spire rise out of the water.
- **The Lighthouse Isle**: bare rock outcrops with wiry grass, and the walk climbs high. A huge striped lighthouse with a keeper's cottage stands offshore, and its dithered beam sweeps around.
- **Rocks off the path**: the route is generated nine stretches ahead before scenery is placed, so far-out rocks avoid legs that are not on screen yet. Fork reservations now also cover the northward leg after each branch. Rock clearance accounts for each rock's widest axis, tilts are small enough that tall rocks can't lean over the walk, and fallen logs are cleared by their full length.

## More obstacles, better trees and stairs

- **Five obstacle kinds**, each drawn in the district's own materials and lit by its own lamps:
  - **Low beam** (duck): a timber beam in most places, a fallen trunk in the woods and swamp, and washing on a line in the canals and village.
  - **Cargo** (dodge or jump): crates, barrel stacks on the quays and in the graveyard, stumps in the woods, boulders on the rocky coasts.
  - **Log** (jump): something low right across the walk, such as a fallen log, a rope of floats or a broken fence. The boards after a log stay clear for the landing.
  - **Wall** (dodge): two lanes blocked by stacked crates or boulders, one lane open.
  - **Swing** (duck, or time it): a weight swinging across the walk from a gantry. It uses the same clock as the collision test.

  Narrow beams only get beams, logs and swings.
- **Trees**: every leaf mass now hangs off a limb that joins the trunk. Birches, pines, broadleaves and snags are built from real limbs, and the forest crowns sit on their trunks.
- **Stairs to nowhere**: rebuilt as a proper timber staircase with stringers, treads, handrails and posts. It climbs out of the water to a landing on tall legs, with a door frame (sometimes a door ajar) at its far edge.
- **Mirror shallows corners**: mooring poles that would fall on, or be pushed beside, another leg are left out instead.
- Debug: `?seg=N&at=M` starts on stretch N, M metres in (negative counts from its end).

## Controls (current)

- **Keyboard**: Space / ↑ jump · ↓ / S hold to duck · ← → / A D dodge, or turn at corners and forks · P / Esc pause · R new route. Dragging with the mouse looks around (drag right looks right, drag up looks up).
- **Touch**: swipe left or right to dodge or turn, swipe up to jump (a tap also jumps), and swipe down to duck. The duck is held while your finger stays down, or for at least about half a second on a quick flick.

## Original notes

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

`?seed=N` · `?area=shallows|sunken|lighthouse|breakers|forest|swamp|village|exposed|fork|narrow|house|arches|ramp` (jump to the first such stretch) · `?event=wave|skyflip|searise|crumble` (trigger that event 3 s in) · `?t=12.3` (freeze the clock) · `?look=yaw,pitch` · `?still` (park the player) · `?maxdt=0.2` (let slow renderers advance time faster).
