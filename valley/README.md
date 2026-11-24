# The Valley

Serve the repository root with `python3 -m http.server 8765 --bind 127.0.0.1`, then open `/valley/`.

The opening uses the live forest scene, an embedded pixel font, keyboard-selectable menu choices, and a separate control guide. No Google Fonts request or late font swap is needed. New games start with the sword sheathed. Existing saves preserve their equipment state.

## People

`people-core.js` contains deterministic identity, temperament, relationship lookup, memory, and response rules. `people.js` connects those rules to the world, conversations, movement, and the existing crime system. `game.js` exposes a small `socialAccess` adapter; the existing `GAME.people` NPC array remains intact. The new controller is `GAME.social`.

Each human has a stable identifier derived at spawn time, a name, occupation, interest, and seven continuous personality traits: warmth, courage, temper, honesty, sociability, loyalty, and diligence. Household members have reciprocal family relationships; nearby people acquire reciprocal friendships based on proximity and temperament. People without a local relative acknowledge family beyond the valley.

Press E near a person to talk about work, family, friends, or their interests; share food; apologize; or trade with a merchant. Conversations appear in a compact bottom panel with no fullscreen backdrop. They pause only the speaker; the player can walk away to close the conversation. On desktop, each visible choice has a number shortcut (top row or numpad, without modifiers). Tab/Shift-Tab, Enter, and Escape also work. Touch omits the number labels. The compact, earth-toned panel presents sentence-length questions and only the current follow-ups. Shops retain the existing ownership and bounty rules, with personal distrust also affecting trade.

Work and relationship topics now branch into background, ambitions, personal habits, and named relationship anecdotes. Reserved or distrustful people withhold personal details. Prior subjects and listening are remembered. A food promise can be kept with an actual non-stolen inventory item, withdrawn, or left overdue; outcomes persist, with rewards and penalties applied only once.

People remember direct theft and violence, kindness, trade, and meeting the player. Witnesses react according to personality and their relationship to the victim. Nearby acquaintances can share a witnessed incident. Hearsay retains its source, applies a smaller trust change, and cannot propagate again; no global omniscience. Memories are bounded at twelve per person. Gifts and trade reputation are limited per game day; each incident accepts one apology. Negative trust softens slowly over game days, without wiping memories or legal fines.

Personal schedules vary waking and bedtime, with later hours for the innkeeper and staggered day/night watches. The existing house/door/table/bed routes handle meals and sleep. Mobile daytime workers return to their work positions and sociable people can make short nearby friend visits. Combat, reports, flight, sleep, and conversation take priority. Fixed-height characters and wall sentries keep their posts; road travellers retain their patrol routes. Social movement uses the existing local steering and has a timeout, rather than teleporting through obstacles.

Social state is saved inside the existing `valley.save.1` record under `social`. Old saves acquire it lazily. Identity generation does not consume the world's random sequence. Start over also clears social progress.

## Verification

Run `node tests/valley-people.cjs` from the repository root. Tests cover identity stability, kinship, reactions, bounded memory, knowledge isolation, source-aware gossip, repeated-action limits, save/reload, gradual recovery, night-watch scheduling, and danger priority.

Browser checks: arrival screen, entering the world, conversation and family topics at the pier, recognition after reloading, keyboard dismissal, and returning to movement.

## Scope

This is a deterministic social simulation with contextual authored dialogue, not a generative language model. Relationships are established at world creation; people do not yet form new marriages, change jobs, or invent quests. Fixed-post characters do not yet have fully navigable off-duty routes. Local steering is inherited from the game, not a full navigation mesh. These boundaries are intentional extension points; avoid substituting random dialogue for persistent world state.

## The world file and the map editor

Everything outside the hand-built valley comes from `world.js`, which `editor.html` reads and writes. It holds a height map, forest density and region, each on a 12 m grid, plus the roads, rivers and places of the wider world. Inside the `lock` rectangle (with a feathered edge) the hand-written shapes in `index.html` still decide everything, so the valley looks exactly as built; the world file takes over beyond it. Without `world.js` the game falls back to the hand-built valley alone.

Regions (valley, amber, green, oldwood, rot, ash, blight, north, warm) tint the land and choose which trees grow. Edges blend over about 150 m.

Outside the hand-built grid the land loads in 192 m tiles around the player: fine terrain within 1150 m, trees and ground cover within 720 m. Beyond that, one coarse mesh of the whole world sinks out of sight under the tiles, a sparse forest stands in from afar, and the old mountains continue past the world's edge.

Open `/valley/editor.html` from the local server. Brushes raise, lower, smooth and level the land, thicken or clear forest, and paint regions. Roads, rivers and places are drawn as lines and points. **Try it in the game** opens the game with the unsaved map (`index.html?draft=1`); **Save world.js** writes the file (in Chrome it can save straight over `valley/world.js`).

`tools/bake.cjs` and `tools/genworld.py` made the first world file from the hand-built valley and the sketch. Running them again replaces anything painted in the editor.

## The story

`story.js` holds the first act of the main story, The Blight. Refugees from Ashford camp beside the village; Maud Fletcher sends you to King Aldric; the king sends you east; in burnt Ashford, Father Aldous asks you to find what became of Captain Ranulf's patrol (three clues glint among the ruins and the dead woods); he names the Blight; the king sends you to Old Wenna, and the act ends at her door. Progress is saved under `story` in the save. Story lines appear first, in gold, in the people they belong to, and the journal, compass (✦) and map follow the current step. Blight hounds hunt round Ashford and the Blight's heart.

## The opening (intro.js)

A new game opens with a ~40-second in-engine cutscene of the night Ashford burned: dusk over the roofs, Blight roots racing in from the east, fire spreading house by house, hounds and people in the lanes, the church bell that stops when the tower catches, and you getting Maud and her boy out along the west road. It is skippable (Skip button, Esc, Enter or Space) and plays only for a new game; Continue goes straight in. Add `?nointro` to the URL to start without it.

The town is drawn "before" by whole houses built over the ruins in landmarks (`window.__ashNight`), shown only during the cutscene. After it, the game starts at dawn on the road west in the Old Wood, story stage `road`, with Maud, Hob, Wat and a few others walking beside you to the camp east of the village; they keep pace with you and catch up if you run ahead. Reaching the camp moves the story to `start` (speak to Maud).

## Music

Both songs are Studio songs (olid-song format) in `/music/songs/`, so they open and remix in the Studio like every other game's music:

- `valley-the-valley.json` ("The Valley"): slot `valley`, plays through the game and loops.
- `valley-ashford-night.json` ("The Night Ashford Burned"): slot `valley-intro`, plays once under the opening; the cutscene keeps time with it so the drums and the hush land on their pictures.

`valley-music.js` loads them through `loadGameSong`, so a visitor's own version from the Studio ("Use in a game…") replaces either one, and it talks to the site's Music button the same way `/music/game-music.js` does. The bell, fire and wind in the opening are sound effects in `intro.js`, not music. The songs are generated by `tools/valley_songs.py`; once you edit them in the Studio, the Studio's file is the one to keep.

## Roads in the ground

Roads and paths are painted into the terrain, not laid on it as strips. `RMASK` in `index.html` draws every road line into a mask about 1.5 km across around the player (2048 px at 0.75 m on desktop, 1024 px at 1.25 m on phones), redrawn as you move; the hand-built valley's ground and the world's ground tiles read it in their shader and paint road earth there, with a worn verge. Bridge decks still carry their own path strip. Beyond the mask, roads show as the browner ground the terrain colouring already gives them.

## On the road (encounters.js)

Six hand-placed moments, each with something you can see from the road: Jory the carter with a wheel off on the south road; a gallows at a fork with a notice that points to the reeve's stash under a milestone; bandits charging a toll on a bridge between Oakhurst and the monastery; a hermit with a riddle by a wayside shrine on the north-west lane; a dead knight with crows over him and a blood trail to the great wolf that killed him; and smoke from a bandit camp off the Ashford–Oakhurst lane, with a strongbox for whoever reaches it unseen. Every minute or two on a world road, something may turn up: a traveller who wants company, a pedlar, deer bolting across, or (in the east) a wounded Blight hound. Old Wenna brews a healing draught from 3 herbs and 2 mushrooms. Progress is saved under `enc`.
