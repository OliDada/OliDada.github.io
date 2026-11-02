import sys
root = sys.argv[1]

def patch(name, pairs):
    p = f"{root}/{name}"
    s = open(p).read()
    for old, new, count in pairs:
        n = s.count(old)
        assert n == count, f"{name}: {n} matches for {old[:70]!r}"
        s = s.replace(old, new)
    open(p, "w").write(s)
    print("ok", name)

patch("starmap.js", [
    ("let { range, targets } = jumpTargets(here);", "let { range, targets } = jumpTargets(here, o.jumpRange?.());", 1),
    ("      ({ range, targets } = jumpTargets(here));", "      ({ range, targets } = jumpTargets(here, o.jumpRange?.()));", 1),
    ("radio = list.map(e => ({ ...e, star: starById(e.id) })).filter(e => e.star); radioDone = true;",
     "radio = list.map(e => ({ ...e, star: starById(e.id) })).filter(e => e.star); radioDone = true;\n      o.onRadio?.(list); // heard sources go into the codex (upgrades)", 1),
    ("    // After flying into another system: it becomes \"here\" for jumps and the panel.\n",
     "    // A jump drive upgrade changes the range (upgrades.mjs).\n"
     "    setRange(r) {\n"
     "      ({ range, targets } = jumpTargets(here, r));\n"
     "      inRange = new Set(targets.map(t => t.star.id));\n"
     "      if (dialog.open) { updatePanel(); requestDraw(); }\n"
     "    },\n"
     "    // After flying into another system: it becomes \"here\" for jumps and the panel.\n", 1),
])

patch("input.js", [
    ('        if (e.code === "KeyH") return on.help();\n',
     '        if (e.code === "KeyH") return on.help();\n        if (e.code === "KeyU") return on.upgrades?.();\n', 1),
    ("//   on.pick(x, y) (a tap or click on the view: select what is there), on.cycle() (Tab: next target)\n",
     "//   on.pick(x, y) (a tap or click on the view: select what is there), on.cycle() (Tab: next target),\n//   on.upgrades() (U: the upgrade screen)\n", 1),
])

patch("index.html", [
    ('                <p id="worldType">A world waiting to be explored.</p>\n',
     '                <p id="worldType">A world waiting to be explored.</p>\n                <p id="worldTally" hidden></p>\n', 1),
    ("                <dt>G</dt>\n                <dd>Star map, opened on nearby stars</dd>\n",
     "                <dt>G</dt>\n                <dd>Star map, opened on nearby stars</dd>\n"
     "                <dt>U</dt>\n                <dd>Upgrades: what you document builds the ship</dd>\n", 1),
    ("                <dt>Walk near</dt>\n                <dd>Catalogue a plant species</dd>\n",
     "                <dt>Walk near</dt>\n                <dd>Record a plant, animal or rock formation. Records count toward upgrades (U).</dd>\n", 1),
])
