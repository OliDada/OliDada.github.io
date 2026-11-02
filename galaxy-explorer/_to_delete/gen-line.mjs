import { MAIN, SIDE, CHAPTERS, GEAR, UPGRADES } from '../upgrades.mjs';
const st = { live: 'Works', partial: 'Partly built', planned: 'To build' };
let out = `## The upgrade line

**Decided:** upgrades are one main line plus optional side upgrades, not a set of parallel branches. Research is always deliberate, so nothing unlocks by accident, and the next step is always clear. Built in \`upgrades.mjs\`, \`objectives.mjs\` and \`upgrades-ui.js\`.

- **One main line**, step by step, in three chapters named after the ship you fly (Kestrel, Petrel, Albatross). A new ship ends each chapter. The next main step is always being researched.
- **Side upgrades** hang off the line, each opening at a main step. They are optional gear. You can research **one side upgrade at a time** alongside the main line.
- **Only research can be installed.** Scans made earlier still count, so a step you have already done ticks off as soon as it becomes your research.
- **Every upgrade has a gear:** ship (where you can go), suit (what you can do on foot), scanner, vehicle or knowledge. The line alternates ship and suit steps.
- **Tasks you can act on.** Each task is a sentence ("Scan a plant on a Desert world"). For each task the game finds the **nearest place** that would move it forward (\`objectives.mjs\`): the world you are on, the rest of the system, then systems one and two jumps away. **Show on map** opens the star map there. Systems you have not visited are named by their star, because the map does not show their worlds yet.
- **The screen** (U) is a picture of the line: chapters, the main line down the middle, side upgrades to the left, and icons for each kind of gear. Circles show the state: filled for installed, gold for researching, pulsing when ready, violet for side upgrades you can research, and dashed for locked. Tap one for its card: what it does, its tasks with places, and *Hold to install* once research is done.
- **The HUD panel** (top right) shows the main research, its tasks, the nearest place for the next task, and a one-line summary of the side research.

`;
for (const ch of CHAPTERS) {
  out += `### Chapter: ${ch.name}\n\n${ch.blurb}\n\n| Step | Upgrade | Gear | Effect | Tasks | Effect status |\n|---|---|---|---|---|---|\n`;
  for (const u of MAIN.filter((x) => x.chapter === ch.id)) out += `| ${u.order} | **${u.name}** | ${GEAR[u.gear].name} | ${u.effect} | ${u.needs.map((n) => n.label).join(' · ')} | ${st[u.status]} |\n`;
  out += '\n';
}
out += `### Side upgrades\n\n| Upgrade | Gear | Opens at | Effect | Tasks | Effect status |\n|---|---|---|---|---|---|\n`;
for (const u of SIDE) out += `| **${u.name}** | ${GEAR[u.gear].name} | ${UPGRADES[u.opensAt].name} | ${u.effect} | ${u.needs.map((n) => n.label).join(' · ')} | ${st[u.status]} |\n`;
out += `\nThermal lining and Jump jets are new suit upgrades. The Contact upgrades now sit on the main line in the Petrel and Albatross chapters. The Albatross waits on *Befriend a spacefaring civilization*, which arrives with Contact.\n\n`;
process.stdout.write(out);
