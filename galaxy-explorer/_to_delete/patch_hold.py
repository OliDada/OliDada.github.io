import re, sys
root = sys.argv[1]
def load(n): return open(f"{root}/{n}").read()
def save(n, s): open(f"{root}/{n}", "w").write(s)
def rep(s, a, b, count=1):
    assert s.count(a) == count, f"{s.count(a)} matches: {a[:80]!r}"
    return s.replace(a, b)

# ---------------- game.js ----------------
s = load("game.js")
s = rep(s, 'import { findScanTarget, followTarget, cardFor, KIND_WORDS } from "./scanning.js";',
           'import { findScanTarget, followTarget, cardFor, wordFor } from "./scanning.js";')
start = s.index("// --- Scanning ----------------------------------------------------------------")
end = s.index("function updateCamera(dt) {")
s = s[:start] + '''// --- Scanning ----------------------------------------------------------------
// On foot, the recordable thing nearest the crosshair within reach gets a prompt
// (scanning.js, scan-ui.js). Hold E, or the Scan button, until the ring fills to scan
// something new; press E on something already recorded to see its card again.
const scanUI = createScanUI({ touch: coarsePointer });
const SCAN_TIME = 1.3; // seconds of holding
let scanTarget = null, // { kind, id, ref, point, reach, known }
    scanProgress = 0, // 0..1 while holding
    scanSearch = 0,
    scanNeedsRelease = false, // after a scan, let go before the next one starts
    touchScanHeld = false;
const scanHeld = () => keys.has("KeyE") || touchScanHeld;
$("actionBtn").addEventListener("pointerdown", () => {
    if (mode === "walk" && scanTarget && !scanTarget.known) touchScanHeld = true;
});
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("actionBtn").addEventListener(ev, () => (touchScanHeld = false));
const scannedHere = () => ({
    fauna: (bestiary[activeBody.id] ||= []),
    flora: (catalogue[activeBody.id] ||= []),
    formation: (strata[activeBody.id] ||= []),
});
function updateScan(dt) {
    const held = scanHeld();
    if (!held) scanNeedsRelease = false;
    const scanning = held && !scanNeedsRelease && scanTarget && !scanTarget.known;
    if (scanTarget) scanTarget.point = followTarget(site, scanTarget);
    if ((scanSearch += dt) >= 0.1) {
        scanSearch = 0;
        const next = findScanTarget({
            site,
            here: surfacePoint(playerNormal),
            eye: camera.position,
            forward: camera.getWorldDirection(vec()),
            known: scannedHere(),
            keep: scanTarget,
            holding: !!scanning && scanProgress > 0,
        });
        if (scanProgress > 0 && (!next || next.kind !== scanTarget?.kind || next.id !== scanTarget?.id)) scanProgress = 0;
        scanTarget = next;
    }
    if (scanning && scanTarget && !scanTarget.known) {
        scanProgress += dt / SCAN_TIME;
        if (scanProgress >= 1) completeScan();
    } else scanProgress = Math.max(0, scanProgress - dt * 2.5);
}
function completeScan() {
    const t = scanTarget, list = scannedHere()[t.kind];
    scanProgress = 0;
    scanNeedsRelease = true;
    t.known = true;
    if (list.includes(t.id)) return;
    list.push(t.id);
    saveSurvey();
    scanUI.flash();
    const entry = t.kind === "fauna" ? faunaEntry(system, activeBody, t.ref) : t.kind === "flora" ? floraEntry(system, activeBody, t.ref) : formationEntry(system, activeBody, t.ref);
    showScanCard(t, recordInfo(entry));
}
// info: what recording it moved forward (recordInfo), or null to show a recorded thing again.
function showScanCard(t, info) {
    const where = `${wordFor(t).toUpperCase()} · ${activeBody.name.toUpperCase()}`;
    scanUI.card({
        ...cardFor(t, site, activeBody),
        eyebrow: info ? `NEW ${where}` : `RECORDED ${where}`,
        footer: !info
            ? null
            : info.ready
              ? { text: `Upgrade ready: ${info.ready.name}. Press U to install it.`, ready: true }
              : info.moved
                ? { text: `Counts toward ${info.moved.name}: ${info.progressText}` }
                : { text: "Recorded in your codex." },
    });
}
// The prompt at the crosshair, every frame.
function drawScanMarker() {
    if (mode !== "walk" || !scanTarget || modalOpen()) return scanUI.prompt(null);
    scanUI.prompt({ title: scanTarget.known ? scanTarget.ref.name : `Unknown ${wordFor(scanTarget)}`, known: scanTarget.known }, scanProgress);
}
''' + s[end:]

s = rep(s, '''        } else if (scanTarget) {
            startScan();
        } else if (shipDistance < 9) {''', '''        } else if (scanTarget?.known) {
            showScanCard(scanTarget, null);
        } else if (scanTarget) {
            // Something new: holding E scans it (updateScan).
        } else if (shipDistance < 9) {''')
s, n = re.subn(r'''\} else\n\s*toast\(\n\s*stage === 2\n\s*\? "Follow the Kestrel marker to return to your ship\."\n\s*: "Nothing to scan here\.[^"]*",\n\s*\);''', "}", s)
assert n == 1, n
s, n = re.subn(r'''\n\s*toast\(\n\s*coarsePointer\n\s*\? "On foot\. Drag to look[^"]*"\n\s*: "On foot\. Click the view[^"]*",\n\s*\);''', "", s)
assert n == 1, n
s = rep(s, "showScanCard({ kind: \"settlement\", ref: built.civ }, recordInfo(settlementEntry(system, activeBody, civilizationOf(activeBody), built.civ.tier)), 1);",
           "showScanCard({ kind: \"settlement\", ref: built.civ }, recordInfo(settlementEntry(system, activeBody, civilizationOf(activeBody), built.civ.tier)));")
s = rep(s, '''    get scanLabel() { return mode === "walk" && scanTarget ? (scanProgress != null ? "Scanning…" : `Scan ${KIND_WORDS[scanTarget.kind]}`) : null; },''',
           '''    get scanLabel() { return mode !== "walk" || !scanTarget ? null : scanTarget.known ? "Details" : scanProgress > 0 ? "Scanning…" : "Hold to scan"; },''')

# The world tally: one row per kind, with a bar.
i = s.index("    const parts = [[\"PLANTS\"")
j = s.index("\n", s.index("el.textContent = `${parts.join", i)) + 1
s = s[:i] + '''    const rows = [["Plants", got.flora, totals.flora], ["Animals", got.fauna, totals.fauna], ["Geology", got.formation, totals.formations]].filter(([, , t]) => t > 0);
    const html = rows.map(([w, g, t]) => `<div class="tally-row${g >= t ? " done" : ""}"><span>${w}</span><b>${Math.min(g, t)} / ${t}</b><i style="--f:${Math.min(1, g / t).toFixed(3)}"></i></div>`).join("");
    if (el.innerHTML !== html) el.innerHTML = html;
''' + s[j:]
save("game.js", s)

# ---------------- index.html ----------------
x = load("index.html")
x = rep(x, '<p id="worldTally" hidden></p>', '<div id="worldTally" hidden></div>')
x = rep(x, "<dd>Scan the plant, animal or rock formation under the ◎ marker. Scans count toward upgrades (U).</dd>",
           "<dd>Aim at a plant, animal or rock and hold E until the ring fills to scan it. On something already scanned, press E to see what you recorded. Scans count toward upgrades (U).</dd>")
save("index.html", x)

# ---------------- codex.mjs: rocks and landforms are both 'formation' entries ----------------
c = load("codex.mjs")
c = rep(c, "  name: f.name, formation: f.key, rare: !!f.rare,\n", "  name: f.name, formation: f.key, type: f.type ?? 'formation', rare: !!f.rare,\n")
save("codex.mjs", c)

# ---------------- upgrades.mjs ----------------
u = load("upgrades.mjs")
u = rep(u, "{ label: 'A volcanic formation (basalt columns, obsidian or fumaroles)', ...FORMATION(['columns', 'obsidian', 'fumaroles']) },",
           "{ label: 'Volcanic rock or a volcanic landform (basalt, obsidian, basalt columns or fumaroles)', ...FORMATION(['basalt', 'obsidian', 'columns', 'fumaroles']) },")
u = rep(u, "{ label: 'Pingos or a cryovolcano', ...FORMATION(['pingo', 'cryovolcano']) },",
           "{ label: 'Water ice, pingos or a cryovolcano', ...FORMATION(['ice', 'pingo', 'cryovolcano']) },")
u = rep(u, "{ label: '6 kinds of formation', kind: 'formation', distinct: 'traits.formation', count: 6 }",
           "{ label: '6 kinds of rock or landform', kind: 'formation', distinct: 'traits.formation', count: 6 }")
u = rep(u, "effect: 'Formations give a second, deeper entry: their age and origin.',", "effect: 'Rocks and landforms give a second, deeper entry: their age and origin.',")
u = rep(u, "  columns: 'Volcanic worlds', obsidian: 'Volcanic worlds',",
           "  basalt: 'Volcanic worlds, and most rocky worlds', obsidian: 'Volcanic worlds', ice: 'Frozen worlds and icy moons',\n  columns: 'Volcanic worlds (a landform: only some worlds have one)',")
u = rep(u, "formation: 'every world with a surface',", "formation: 'every world with a surface (rocks); landforms on some worlds',")
save("upgrades.mjs", u)
print("ok")
