## The upgrade line

**Decided:** upgrades are one main line plus optional side upgrades, not a set of parallel branches. Research is always deliberate, so nothing unlocks by accident, and the next step is always clear. Built in `upgrades.mjs`, `objectives.mjs` and `upgrades-ui.js`.

- **One main line**, step by step, in three chapters named after the ship you fly (Kestrel, Petrel, Albatross). A new ship ends each chapter. The next main step is always being researched.
- **Side upgrades** hang off the line, each opening at a main step. They are optional gear. You can research **one side upgrade at a time** alongside the main line.
- **Only research can be installed.** Scans made earlier still count, so a step you have already done ticks off as soon as it becomes your research.
- **Every upgrade has a gear:** ship (where you can go), suit (what you can do on foot), scanner, vehicle or knowledge. The line alternates ship and suit steps.
- **Tasks you can act on.** Each task is a sentence ("Scan a plant on a Desert world"). For each task the game finds the **nearest place** that would move it forward (`objectives.mjs`): the world you are on, the rest of the system, then systems one and two jumps away. **Show on map** opens the star map there. Systems you have not visited are named by their star, because the map does not show their worlds yet.
- **The screen** (U) is a picture of the line: chapters, the main line down the middle, side upgrades to the left, and icons for each kind of gear. Circles show the state: filled for installed, gold for researching, pulsing when ready, violet for side upgrades you can research, and dashed for locked. Tap one for its card: what it does, its tasks with places, and *Hold to install* once research is done.
- **The HUD panel** (top right) shows the main research, its tasks, the nearest place for the next task, and a one-line summary of the side research.

### Chapter: Kestrel

Your first ship. Learn to scan, then reach farther.

| Step | Upgrade | Gear | Effect | Tasks | Effect status |
|---|---|---|---|---|---|
| 1 | **Suit plating** | Suit | Your suit takes 30% less damage and recovers twice as fast. | Scan 3 things on one world | Works |
| 2 | **Orbital survey** | Ship | See a world's biome, chemistry and life before landing. | Scan 5 things, on 2 different worlds | Partly built |
| 3 | **Jump drive II** | Ship | Jump range 12 → 16 light years. | Scan 3 plants · Scan things on 3 kinds of world | Works |
| 4 | **Thermal lining** | Suit | Stay out longer on very hot and very cold worlds. | Scan something on a world colder than −80 °C · Scan something on a world hotter than 80 °C | To build |
| 5 | **Heat plating** | Ship | The hull heats up more slowly near stars, and you can land right beside lava. | Scan volcanic rock or a volcanic landform · Scan 2 animals | Partly built |
| 6 | **Petrel** | Ship | A new ship for seas and storms. Opens the Petrel chapter. | Fully document 2 worlds with life: every plant, animal and rock | To build |

### Chapter: Petrel

A sea and storm ship: under water, and the first contact with other minds.

| Step | Upgrade | Gear | Effect | Tasks | Effect status |
|---|---|---|---|---|---|
| 7 | **Pressure hull I** | Ship | Dive into liquid seas, down to the shallows. | Scan 3 animals on worlds with seas · Scan a coil or a creeper · Scan sea stacks or a shoreline plant | To build |
| 8 | **Xenolinguistics** | Knowledge | Settlements give longer field notes; attempt contact with tool users and village builders. | Find a settlement | To build |
| 9 | **Pressure hull II** | Ship | Deep dives, and the oceans hidden under the ice of frozen moons. | Scan a drifter · Scan water ice, pingos or a cryovolcano | To build |
| 10 | **Jump drive III** | Ship | Jump range 16 → 24 light years. | Scan animals of 4 different body plans | Works |
| 11 | **Signal decoder** | Knowledge | Radio sources on the map say who they are and what they want. | Find a settlement of village builders or higher | To build |
| 12 | **Albatross** | Ship | The deep-range ship. Opens the Albatross chapter. | Scan life built on 3 different chemistries · Befriend a spacefaring civilization | To build |

### Chapter: Albatross

The deep-range ship: into giants and across the galaxy.

| Step | Upgrade | Gear | Effect | Tasks | Effect status |
|---|---|---|---|---|---|
| 13 | **Cryo seals** | Ship | Dive into seas of liquid methane and ammonia. | Scan life on a methane world · Scan life on an ammonia world | To build |
| 14 | **Cloud diver** | Ship | Descend below 250 m into the clouds of gas and ice giants. | Visit 3 giants with different clouds · Scan 2 drifters | To build |
| 15 | **Diplomatic protocols** | Knowledge | Attempt contact with city builders and above. | Earn the trust of a civilization | To build |
| 16 | **Signal drive** | Ship | Jump straight to any radio source you can hear, up to 150 light years. | Find a settlement of city builders or higher | To build |

### Side upgrades

| Upgrade | Gear | Opens at | Effect | Tasks | Effect status |
|---|---|---|---|---|---|
| **Life sonar** | Scanner | Orbital survey | A HUD arrow points to the nearest species you have not recorded. | Scan 4 animals · Scan a nocturnal animal | To build |
| **Survey drone** | Vehicle | Jump drive II | Scan from a distance: cliffs, skittish herds, high nests, stalkers you would rather not approach. | Scan 2 fliers | To build |
| **Night filter** | Suit | Thermal lining | See clearly at night; glowing species stand out. | Scan 2 glowing species | To build |
| **Deep core sampler** | Scanner | Heat plating | Rocks and landforms give a second, deeper entry: their age and origin. | Scan 6 kinds of rock or landform | To build |
| **Return beacons** | Ship | Heat plating | Fast-travel to any system you have fully documented. | Fully document a world: every plant, animal and rock | To build |
| **Rover** | Vehicle | Petrel | Fast surface travel without taking off; a refuge on wheels from stalkers. | Scan 4 walking animals on 2 kinds of world | To build |
| **Behaviour logger** | Scanner | Petrel | Record behaviour: a hunt, a herd drinking, an animal asleep. | Scan a hunter and an animal it hunts, on one world | To build |
| **Decoy beacon** | Suit | Pressure hull I | Distracts a stalker for a while. Never a weapon. | Scan 2 species that stalk explorers | To build |
| **Jump jets** | Suit | Pressure hull II | Much higher jumps on foot: climb ridges and cross gullies. | Scan 3 things on worlds with gravity under 0.5 g | To build |
| **Atmospheric probe** | Vehicle | Jump drive III | Scan the cloud layers of giants from orbit. | Scan a drifter · Visit a gas or ice giant | To build |

Thermal lining and Jump jets are new suit upgrades. The Contact upgrades now sit on the main line in the Petrel and Albatross chapters. The Albatross waits on *Befriend a spacefaring civilization*, which arrives with Contact.

