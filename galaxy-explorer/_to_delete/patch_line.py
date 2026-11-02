import sys
root = sys.argv[1]
def load(n): return open(f"{root}/{n}").read()
def save(n, s): open(f"{root}/{n}", "w").write(s)
def rep(s, a, b, count=1):
    assert s.count(a) == count, f"{s.count(a)} matches: {a[:80]!r}"
    return s.replace(a, b)

# ---------------- codex.mjs: research state ----------------
c = load("codex.mjs")
c = rep(c, "  let data = { v: 1, entries: [], unlocked: [], tracked: null, backfilled: false };",
           "  // research.side: the side upgrade being researched (the main line researches itself).\n  let data = { v: 1, entries: [], unlocked: [], research: { side: null }, backfilled: false };")
c = rep(c, "    get tracked() { return data.tracked; },\n", "    get research() { return data.research || { side: null }; },\n")
c = rep(c, "    unlock(id) { if (!data.unlocked.includes(id)) { data.unlocked.push(id); if (data.tracked === id) data.tracked = null; save(); } },\n    track(id) { data.tracked = data.tracked === id ? null : id; save(); },\n",
           "    unlock(id) {\n      if (data.unlocked.includes(id)) return;\n      data.unlocked.push(id);\n      if (data.research?.side === id) data.research = { ...data.research, side: null };\n      save();\n    },\n    setSide(id) { data.research = { ...(data.research || {}), side: id }; save(); },\n")
c = rep(c, "    reset() { data = { v: 1, entries: [], unlocked: [], tracked: null, backfilled: true }; index.clear(); save(); },",
           "    reset() { data = { v: 1, entries: [], unlocked: [], research: { side: null }, backfilled: true }; index.clear(); save(); },")
save("codex.mjs", c)

# ---------------- starmap.js: focus a star or world ("Show on map") ----------------
m = load("starmap.js")
m = rep(m, "    // A jump drive upgrade changes the range (upgrades.mjs).\n",
           """    // Opens the map on a star, or one of its worlds, selected ("Show on map" in the upgrade screen).
    focus(star, bodyId) {
      scanRadio();
      if (!dialog.open) dialog.showModal();
      resize();
      const body = systemOf(star).bodies.find((b) => b.id === bodyId) || null;
      selected = { star, body };
      Object.assign(view, focusView(star.x, star.y, body ? systemScale() : LOCAL_SCALE));
      updatePanel(); draw();
    },
    // A jump drive upgrade changes the range (upgrades.mjs).
""")
save("starmap.js", m)

# ---------------- game.js ----------------
g = load("game.js")
g = rep(g, 'import { UPGRADES, progress, advanced, recordedOn,', 'import { UPGRADES, MAIN, activeResearch, progress, advanced, recordedOn,')
g = rep(g, 'import { createUpgradeScreen } from "./upgrades-ui.js";\n',
           'import { createUpgradeScreen } from "./upgrades-ui.js";\nimport { nearestPlace, placeless } from "./objectives.mjs";\n')
g = rep(g, "    onUnlock: (id) => applyUpgrade(id),\n    touch: coarsePointer,\n});",
           """    onUnlock: (id) => applyUpgrade(id),
    touch: coarsePointer,
    places: (id, done) => setTimeout(() => findPlaces(id, done), 30),
    showOnMap: (place) => {
        const star = starById(place.starId);
        if (star) starMap.focus(star, place.bodyId);
    },
});
// The nearest place for each unfinished task of an upgrade being researched (objectives.mjs):
// this world, this system, then one or two jumps out. Shown in the upgrade screen and the HUD.
function findPlaces(id, done) {
    const u = UPGRADES[id], star = loadedId ? starById(loadedId) : null;
    const now = progress(codex.entries, codex.unlocked, codex.research)[id];
    const where = { star, system, bodyId: activeBody.id, range: rangeFor(codex.unlocked) };
    const list = u.needs.map((n, i) => {
        if (now.needs[i].done || placeless(n)) return null;
        const p = nearestPlace(n, codex.entries, where);
        if (!p) return null;
        const name = p.body.name;
        if (p.here) return { text: `here on ${name}`, mappable: false };
        if (!p.jumps) return { text: `${name}, in this system`, mappable: !!star, starId: star?.id, bodyId: p.body.id };
        return { text: `${name} in the ${starName(p.star)} system, ${p.jumps} jump${p.jumps > 1 ? "s" : ""} away`, mappable: true, starId: p.star.id, bodyId: p.body.id };
    });
    upgradeScreen.setPlaces(id, list);
    done();
}""")
g = rep(g, "    const before = progress(codex.entries, codex.unlocked);\n    if (!codex.add(entry)) return { added: false, text: \"\" };\n    const moved = advanced(before, progress(codex.entries, codex.unlocked));",
           "    const before = progress(codex.entries, codex.unlocked, codex.research);\n    if (!codex.add(entry)) return { added: false, text: \"\" };\n    const moved = advanced(before, progress(codex.entries, codex.unlocked, codex.research));")
g = rep(g, "    const m = moved.find((x) => x.id === codex.tracked) || moved.find((x) => x.have < x.count) || moved[0];",
           "    const main = activeResearch(codex.unlocked, codex.research).main;\n    const m = moved.find((x) => x.id === main && x.have <= x.count) || moved[0];")
g = rep(g, "    const text = ready ? ` Upgrade ready: ${ready.name}. Open Upgrades (U).` :", "    const text = ready ? ` ${ready.name} is ready to install. Press U.` :")
g = rep(g, """    toast(u.status === "planned" ? `${u.name} unlocked. Its effect is not built yet (see PROGRESSION.md).` : `${u.name} installed. ${u.effect}`, 6);""",
           """    const next = MAIN.find((x) => !codex.unlocked.has(x.id));
    const nextText = u.line === "main" && next ? ` Now researching: ${next.name}.` : "";
    toast(u.status === "planned" ? `${u.name} installed (its effect is not built yet).${nextText}` : `${u.name} installed. ${u.effect}${nextText}`, 7);""")
g = rep(g, "? { text: `Upgrade ready: ${info.ready.name}. Press U to install it.`, ready: true }", "? { text: `${info.ready.name} is ready to install. Press U.`, ready: true }")
save("game.js", g)
print("ok")
