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
