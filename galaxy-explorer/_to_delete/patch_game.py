import sys
p = sys.argv[1]
s = open(p).read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f"{n} matches for: {old[:70]!r}"
    s = s.replace(old, new)

# 1. Imports
rep('import { createStarMap } from "./starmap.js";\n',
    'import { createStarMap } from "./starmap.js";\n'
    'import { createCodex, backfill, floraEntry, faunaEntry, formationEntry, settlementEntry, fieldNoteEntry, worldEntry, signalEntry } from "./codex.mjs";\n'
    'import { progress, advanced, recordedOn, jumpRange as rangeFor, suitDamageScale, suitRecoveryScale, heatScale } from "./upgrades.mjs";\n'
    'import { createUpgradeScreen } from "./upgrades-ui.js";\n'
    'import { civilizationOf } from "./civilizations.mjs";\n')

# 2. The codex and the upgrade screen, right after the starting world is known
rep('let RADIUS = activeBody.radius;\n',
    'let RADIUS = activeBody.radius;\n'
    '// The codex: everything documented in every system, and the upgrades it unlocks\n'
    '// (codex.mjs, upgrades.mjs, upgrades-ui.js; plan in PROGRESSION.md).\n'
    'const codex = createCodex();\n'
    'if (!codex.backfilled) backfill(codex);\n'
    'codex.add(worldEntry(system, activeBody));\n'
    'const upgradeScreen = createUpgradeScreen({\n'
    '    codex,\n'
    '    onOpen: () => { keys.clear(); if (starMap?.isOpen) starMap.close(); },\n'
    '    onUnlock: (id) => applyUpgrade(id),\n'
    '});\n'
    '// Records a codex entry. Returns a sentence for the toast saying what it counted\n'
    '// toward ("" if it was already recorded or counts toward nothing).\n'
    'function record(entry) {\n'
    '    const before = progress(codex.entries, codex.unlocked);\n'
    '    if (!codex.add(entry)) return "";\n'
    '    const moved = advanced(before, progress(codex.entries, codex.unlocked));\n'
    '    upgradeScreen.refresh();\n'
    '    updateTally(true);\n'
    '    const ready = moved.find((m) => m.ready);\n'
    '    if (ready) return ` Upgrade ready: ${ready.name}. Open Upgrades (U).`;\n'
    '    const m = moved.find((x) => x.id === codex.tracked) || moved.find((x) => x.have < x.count) || moved[0];\n'
    '    if (!m) return "";\n'
    '    const s = m.have >= m.count && m.spread.find((x) => x.have < x.need);\n'
    '    return ` Counts toward ${m.name} (${s ? `${s.have} of ${s.need} ${s.label}` : `${m.have} / ${m.count}`}).`;\n'
    '}\n'
    'function applyUpgrade(id) {\n'
    '    const name = { suitPlating: "Suit plating", jumpDrive2: "Jump drive II", jumpDrive3: "Jump drive III" }[id];\n'
    '    if (id.startsWith("jumpDrive")) starMap?.setRange?.(rangeFor(codex.unlocked));\n'
    '    updateTally(true);\n'
    '    toast(name ? `${name} installed.` : "Upgrade unlocked. Its effect is on the roadmap (PROGRESSION.md).", 5);\n'
    '}\n')

# 3. Field scanner: what is left to record on this world
rep('function animateSite(dt) {\n',
    '// Field scanner (upgrade): the HUD counts what is left to record on this world.\n'
    'let tallyTimer = 0;\n'
    'function updateTally(now = false) {\n'
    '    if (!now && (tallyTimer += 1 / 60) < 0.5) return;\n'
    '    tallyTimer = 0;\n'
    '    const el = $("worldTally");\n'
    '    if (!el) return;\n'
    '    const totals = site && !activeBody.giant ? siteTotals() : null;\n'
    '    const on = codex.unlocked.has("fieldScanner") && totals && ["walk", "landed", "flight", "landing", "takeoff"].includes(mode);\n'
    '    el.hidden = !on;\n'
    '    if (!on) return;\n'
    '    const got = recordedOn(codex.entries, system.seed, activeBody.id);\n'
    '    const parts = [["PLANTS", got.flora, totals.flora], ["ANIMALS", got.fauna, totals.fauna], ["FORMATIONS", got.formation, totals.formations]]\n'
    '        .filter(([, , t]) => t > 0).map(([w, g, t]) => `${w} ${Math.min(g, t)}/${t}`);\n'
    '    const left = (totals.flora + totals.fauna + totals.formations) - Math.min(got.flora, totals.flora) - Math.min(got.fauna, totals.fauna) - Math.min(got.formation, totals.formations);\n'
    '    el.textContent = `${parts.join(" · ")}${left ? "" : " · ALL RECORDED"}`;\n'
    '}\n'
    '// What the landing site actually holds (a species that found no room is not counted).\n'
    'function siteTotals() {\n'
    '    return {\n'
    '        flora: site.flora?.placed?.filter((p) => p.positions.length).length ?? 0,\n'
    '        fauna: site.fauna?.species?.length ?? 0,\n'
    '        formations: site.geology?.placed?.filter((p) => p.scales.some((x) => x > 0)).length ?? 0,\n'
    '    };\n'
    '}\n'
    'function animateSite(dt) {\n    updateTally();\n')

# 4. A world's real totals once its landing site is built
rep('    scene.add(site.group);\n}\n',
    '    scene.add(site.group);\n'
    '    if (!activeBody.giant) codex.add(worldEntry(system, activeBody, siteTotals()));\n'
    '}\n')

# 5. Scans: each toast says what the new entry counted toward
rep('${sp.name}. ${sp.description}`,',
    '${sp.name}. ${sp.description}${record(faunaEntry(system, activeBody, sp))}`,')
rep('${p.formation.name}. ${p.formation.description}`, 7);',
    '${p.formation.name}. ${p.formation.description}${record(formationEntry(system, activeBody, p.formation))}`, 7);')
rep('${species.name}. ${species.description}`,',
    '${species.name}. ${species.description}${record(floraEntry(system, activeBody, species))}`,')
rep('toast(`Signs of intelligence. ${built.civ.description}`, 9);',
    'toast(`Signs of intelligence. ${built.civ.description}${record(settlementEntry(system, activeBody, civilizationOf(activeBody), built.civ.tier))}`, 9);')
rep('    records.add(activeBody.id);\n    saveSurvey();\n',
    '    records.add(activeBody.id);\n    saveSurvey();\n'
    '    const noteText = record(fieldNoteEntry(system, activeBody));\n'
    '    if (noteText) toast(noteText.trim(), 8);\n')

# 6. Worlds you arrive at (giants included)
rep('    visited.add(body.id);\n', '    visited.add(body.id);\n    const worldNote = record(worldEntry(system, body));\n', 2)
rep('Fly down, or use Approach signal to find a landing site.`,',
    'Fly down, or use Approach signal to find a landing site.${worldNote}`,')
rep('.join(" or ")}` : ""}.`,', '.join(" or ")}` : ""}.${worldNote}`,')

# 7. Effects
rep('suit = Math.max(0, suit - e.damage);', 'suit = Math.max(0, suit - e.damage * suitDamageScale(codex.unlocked));')
rep('suit = Math.min(1, suit + dt * 0.05);', 'suit = Math.min(1, suit + dt * 0.05 * suitRecoveryScale(codex.unlocked));')
rep('heat = clamp(1 - (global.length() - system.star.radius - 140) / (system.star.radius * 4), 0, 1);',
    'heat = clamp(1 - (global.length() - system.star.radius - 140) / (system.star.radius * 4), 0, 1) * heatScale(codex.unlocked);')

# 8. Star map: jump range from upgrades, and radio sources heard go into the codex
rep('const starMap = createStarMap({\n',
    'const starMap = createStarMap({\n'
    '    jumpRange: () => rangeFor(codex.unlocked),\n'
    '    onRadio: (sources) => {\n'
    '        const notes = sources.map((s) => record(signalEntry(s))).filter(Boolean);\n'
    '        if (notes.length) toast(`Radio sources logged.${notes.at(-1)}`, 6);\n'
    '    },\n')

# 9. Input and modals
rep('    return $("help").open || $("discovery").open || $("starMap").open;',
    '    return $("help").open || $("discovery").open || $("starMap").open || upgradeScreen.isOpen;')
rep('        cycle: () => cycleTarget(),\n',
    '        cycle: () => cycleTarget(),\n'
    '        upgrades: () => { if (!$("help").open && !$("discovery").open) upgradeScreen.toggle(); },\n')

open(p, 'w').write(s)
print("ok")
