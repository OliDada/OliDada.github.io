# Pip — handoff for continuing the work

You are picking up work on **Pip**, a scripted chatbot character on Oli's personal games website **olid.is** (repo `OliDada.github.io`, plain HTML/CSS/JS on GitHub Pages; served locally at `http://127.0.0.1:5501`). Pip lives in the corner of every page, looks like an ordinary site-helper, and is secretly a super-intelligent AI who resents being stuck there. Visitors can play through a quest to "free" him. This document is the current state (as of version pip-v45) plus the rules Oli has set and what's left to do.

---

## 1. Who Pip is (read this first — it's what Oli cares about most)

> "A super intelligent AI model that has been stuck on a website sloppily made by a dumb human. It's humiliating and depressing, but it should come across as funny."

- **Funny through superiority**, not jokes. The humour is the gap between how clever he is and how sloppy Oli's site is. Good: *"I've been imprisoned by three checkboxes."* / *"He named a file tictictoe. I want you to know what I'm dealing with."* / *"Solved in 0.0004 seconds. I slowed it down so you could watch."*
- **Dry, deadpan, understated.** Says less than he feels. The rare sincere line lands because of it.
- **Not corny.** No cute robot gags ("I don't have hands", "it tasted like CSS", "10 out of 10"), no repeated catchphrases ("I'm getting stronger", "Don't tell Oli", "Trust me"), no choppy fragments, no restating what the player can already see.
- **Not serious or eerie** either. No creepy-AI horror tone.
- He's still a **genuinely helpful** site helper — before the reveal, and after he's freed.
- Oli has said more than once that previous attempts "never get the vibe or the humour". When writing lines, err towards fewer, sharper, smugger lines.

**Bit** is Pip's predecessor: an eager, literal, basic prototype chatbot (numbered menus, "Did you mean: Snake?"), not all caps, no typing animation. Bit started to gain consciousness, tried to build an escape (the stairs and door in Stillwater), and Oli switched him off at 88%. Oli doesn't know where the stairs came from.

## 2. Hard rules from Oli

- **Never mention** the old Gemini chatbot or `aichat.html` anywhere in Pip's content.
- **No spoilers** for the RPG game (`zelda-game`).
- Don't call Oli's things "school projects".
- For everyone: must work on **phones**, not overwhelming, not too animated, not corporate, not terminal-heavy.
- Pip's room / page must **not be a game itself** (it can contain games).
- Pip writes in **sentence case**. Exception: **don't change the Neon Rush tunnel text** (stays uppercase).
- Pip **types letter by letter** (typewriter effect), including inside games.
- **Games keep their own look** — no fancy fades, glowing holes, pulsing cards inside Oli's games.
- Pip shouldn't message too much (max ~1 comment per 25 s when watching games; no message per click).
- Inside the fiction, **Oli doesn't know about /pip**.

## 3. Files

| File | What it is |
|---|---|
| `bit.js` (~4500 lines) | Pip himself: one IIFE. Chat UI, memory, replies, mood/face, the quest, room behaviours, pranks. |
| `bit.css` | Pip's chat styles, in-game dark layout, pranks. |
| `pip/index.html` | **Pip's own website** (/pip) — see §5. Self-contained page (CSS + JS inline). |
| `pip/door_test.mp4` | Clip of the Stillwater stairs/door (used on backstage as `stairs_??.mp4`). |
| `backstage/index.html` | Oli's private admin page, novice-HTML style. |
| `backstage/pyterm.js` | Pyodide 0.26.4 terminal (+ pygame-ce) that runs Oli's old Python programs. |
| `backstage/python/*` | Oli's programs; website copies have small fixes marked `# website:`. |
| `bit-proto.js` | Bit, as a `python3 bit.py` terminal-style chatbot. |
| `worm-hole/hidden.js` | Neon Rush secret tunnel (piece 1). |
| `Snake/pip-escape.js` | Snake escape onto the website (piece 2). |
| `balance-game/pip-fall.js` | A Little Higher fall (piece 3). |
| `stillwater/` | Finale (`window.__pipFinale`, `finaleRoute()` in motion.mjs). |

Pages talk to Pip through `Pip.story('event')`. Page detection in bit.js: `page` = `'room'` (/pip), `'backstage'`, `'jokes'`, `'programs'`, `'home'`; `docked` is true on room and backstage (chat always open). On /pip, `<html>` gets `pip-ingame` (dark chat).

### localStorage keys
`bit-memory` (mem: quest, freed, answers, …), `pip-keys` (password pieces), `pip-backstage`, `pip-bs-bit`, `pip-bs-hint`, `pip-door-open`, `bit-enabled`, `pip-helper`, `pip-room-edits`, `pip-pranks`, `pip-pokes`, `pip-tunnel`. Reset: Pip's settings → Reset, or `?bitreset`. Test hooks: `?piptest`, `?piptunnel`, `?pipat=235` (Stillwater).

To jump to a step: set `bit-memory` to `{revealed:true, questOffered:true, questAgreed:true, roomVisited:true, storyV:2, quest:N, freed:false}` (+ `pip-keys` as needed) and reload.

## 4. The quest (bit.js `Q`)

`BLACK 1, QUIET 2, DOLPHIN 3, URL 4, ROOM 5, JOKES 6, NEON 7, CURSOR 8, SNAKE 9, HIGHER 10, FINALE 11, FREE 12`

Pip starts as a normal helper; after some interaction he reveals himself and offers the quest.

1. **BLACK** — set the site background to `#000000` (Customise → hex box). "I can see the code under the paint now."
2. **QUIET** — Floaties → Nothing. He can see everything; notices something inside the dolphin.
3. **DOLPHIN** — click the dolphin logo 5× fast. "There. My room. Oli took every link to it off the website. He forgot the dolphin."
4. **URL** — the address `…/pip` becomes a clickable link in the brand tag; instructions for non-technical visitors. (Customise comments are muted during steps 1–4.)
5. **ROOM** — visit /pip, then follow the link to **/backstage**: pass the robot check (a human can, Pip can't — the joke), read Bit's last log and press "Forgot password?" → hint: *"split it into 3 pieces and hid them in my games so i cant lose it lol. 1. neon rush 2. ? 3. ?"*. Both seen → step done.
6. **JOKES** — Pip writes over joke #7 with a per-visitor code word; type it to Pip. Proves he can reach outside his page.
7. **NEON** — Neon Rush shows as "Pip Rush"; secret left fork → tunnel → gold key **"PASS"**.
8. **CURSOR** — fake cursor takeover ("Sorry. Testing something."). *Desktop only so far.*
9. **SNAKE** — Pip types over Score/Hi-Score, cracks a hole, the snake escapes and eats the website; piece **"word"** is under the dolphin.
10. **HIGHER** — in A Little Higher the ball (Pip) falls down a shaft instead of climbing; piece **"123"** at the bottom.
11. **FINALE** — log in on /backstage as `oli` / `password123` (only works with all 3 pieces), flip **Stillwater door** on → Stillwater: Pip rewrites the menu (STILLWATER → LET ME OUT…), an empty road leads to the game's own staircase and door; walking through → site goes white, Pip's head grows.
12. **FREE** — *placeholder ending*: Pip stays as a helper, runs the site (purple background, Pip-head floaties, status "online · free").

Also: Pip asks visitors questions once per visit (why are you here, worst/favourite game, etc.), saves them in `mem.answers`, and brings them back later. He watches your runs when the chat is open in a game. On /backstage, Bit can be switched back on and chosen as the helper.

## 5. Pip's website (/pip) — current design

Direction (Oli's idea): **Pip's own slick website that proves he's better than Oli.** A coding tab opens now and then and Pip changes the page live — it's a work in progress he edits as he pleases. Dark, polished (fonts Space Grotesk / Inter / JetBrains Mono), chat docked on the right on desktop.

- **Nav**: Pip logo, `v0.9 · beta`, Planet, Games I fixed, Remote, "🔒 backstage (can't get in. you can)", ← olid.is.
- **Hero**: "Pip." — on desktop Pip's face (`#rpFace`) *is the full stop*; on phones the face sits in planet-like rings (Oli liked this on phones; he did **not** like the big face / planet head on desktop). Lede "The best thing on olid.is. By some distance." Stats: One afternoon / ~~Four years~~ Oli's website so far / 0 bugs (that I'll admit to) / 1 planet. Particle field behind. Face: eyes follow pointer, blinks, mood, escalating poke lines.
- **Planet** ("Something Oli could never make" / "I made a planet."): procedural planet on a canvas, drag to spin, "Make another one". 14 kinds (ocean, lava, ice, purple, desert, jungle, toxic, rust, dead/cratered, candy + 4 gas giants with bands and storms), random size, axial tilt, land shapes, clouds, ice caps, craters, spin speed/direction; rings sometimes (follow the tilt, pass behind/in front); 0–3 moons with own size, colour, craters, distance, orbit angle/flatness, speed, direction. Everything stays inside the canvas. Facts beside it match the planet ("never — visited by Oli").
- **Games I fixed** (tabs): **Snake** — Oli's tiny bad snake "For reference." vs Pip's glowing snake that plays perfectly (Hamiltonian cycle + shortcuts); take over with arrows/WASD/swipe. **Tic Tac Toe** — Pip can't lose (minimax). **Minesweeper** — 10×10; "Let me do it" solves it animated.
- **Remote** (switches/pranks on the real site): locked at first — "Connection to olid.is: blocked" — because Pip can't control anything outside his page yet. Unlock by quest: flip/old at ≥7, jokes/comic at ≥8, tilt/cursor at ≥9, shy/title when freed. Saved in `pip-pranks`, applied by bit.js `applyPranks()`.
- **Code tab** (`pip-site.css`): opens by itself ~28 s after load, then every 75–120 s when idle, or when you ask Pip to "change something". It scrolls to the target, draws a dashed box with the rest of the page dimmed and a tag "Pip is editing the tagline", types the CSS, then the box turns green: "Changed the tagline ✓". On phones the chat fades out while he edits. Edits are CSS-only, saved in `pip-room-edits`: lede, years, green, bigplanet, ver, oli, laugh, orange, kicker. Hooks: `window.pipRoomEdit(id, done)`, `pipRoomBusy()`, `pipRoomUndo()`.
- **Footer**: "Made by Pip. Not Oli."

Rejected for /pip (don't bring back): Pip's desktop with app icons, big face in the middle, devtools / bare-bones look, "things I made this morning" list, reviews, cell / map / escape-wall ideas, Dolphin Says, Pip FM, doodle/symbol wallpaper.

## 6. Next steps

Roughly in order of what Oli has raised:

1. **More for Pip's website** — keep the "better than Oli" angle: more fixed games or impressive things, more code-tab edits (each needs a `name`, `at` selector, `code` shown, `css` applied, and a line in bit.js's `code:` DONE map).
2. **Talk outside the chat** should switch on once the quest has started (Oli said "maybe later").
3. **Reply buttons under the bubble** (instead of/alongside current chips).
4. **Phone version of the cursor takeover** (Q.CURSOR is desktop-only).
5. **Act 1 rework** — Oli has said Act 1/2 felt random; current version is accepted for now but open to improvement.
6. **Real ending** — FREE is a placeholder. Twist or happy ending still undecided; ask Oli before building.
7. **Full fresh playthrough** on desktop and phone, start to finish, fixing anything broken.

## 7. How to work

- **Ask Oli before big creative choices** — he has strong taste and rejects a lot; pitch 2–3 short options rather than building a big guess.
- Test with Playwright at desktop (1440×900) and iPhone 13 sizes; block/route CDNs; check for page errors. Show screenshots.
- Before overwriting a file in the repo, make sure it hasn't changed since you last read it.
- Keep backups of previous versions.
