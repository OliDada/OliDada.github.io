import re, sys
root = sys.argv[1]

def load(n): return open(f"{root}/{n}").read()
def save(n, s): open(f"{root}/{n}", "w").write(s)
def rep(s, a, b, count=1):
    assert s.count(a) == count, f"{s.count(a)} matches: {a[:70]!r}"
    return s.replace(a, b)

# ---------------- game.js ----------------
s = load("game.js")
s = rep(s, 'import { createUpgradeScreen } from "./upgrades-ui.js";\n',
        'import { createUpgradeScreen } from "./upgrades-ui.js";\n'
        'import { findScanTarget, followTarget, cardFor, KIND_WORDS } from "./scanning.js";\n'
        'import { createScanUI } from "./scan-ui.js";\n')
s = rep(s, "    onUnlock: (id) => applyUpgrade(id),\n});", "    onUnlock: (id) => applyUpgrade(id),\n    touch: coarsePointer,\n});")

# record() -> recordInfo() + record()
start = s.index("// Records a codex entry. Returns a sentence")
end = s.index("function applyUpgrade(id) {")
s = s[:start] + '''// Records a codex entry and works out what it moved forward:
// { added, ready (an upgrade that just became ready), moved, progressText, text }.
// text is a sentence to append to a toast ("" if nothing to say).
function recordInfo(entry) {
    const before = progress(codex.entries, codex.unlocked);
    if (!codex.add(entry)) return { added: false, text: "" };
    const moved = advanced(before, progress(codex.entries, codex.unlocked));
    upgradeScreen.refresh();
    updateTally(true);
    const ready = moved.find((m) => m.ready);
    const m = moved.find((x) => x.id === codex.tracked) || moved.find((x) => x.have < x.count) || moved[0];
    const s = m && m.have >= m.count && m.spread.find((x) => x.have < x.need);
    const progressText = m ? (s ? `${s.have} of ${s.need} ${s.label}` : `${m.label} · ${m.have}/${m.count}`) : "";
    const text = ready ? ` Upgrade ready: ${ready.name}. Open Upgrades (U).` : m ? ` Counts toward ${m.name} (${s ? progressText : `${m.have} / ${m.count}`}).` : "";
    return { added: true, ready, moved: m, progressText, text };
}
const record = (entry) => recordInfo(entry).text;
''' + s[end:]

# The world tally is part of the ship from the start; the guide follows the mode.
s = rep(s, "    const on = codex.unlocked.has(\"fieldScanner\") && totals && ", "    const on = totals && ")
s = rep(s, "    tallyTimer = 0;\n    const el = $(\"worldTally\");", "    tallyTimer = 0;\n    upgradeScreen.setMode(mode);\n    const el = $(\"worldTally\");")

# The expedition objective panel now shows the next upgrade (upgrades-ui.js).
s = rep(s, '''    $("objective").textContent = entries[stage][0];
    $("objectiveDetail").textContent = entries[stage][1];
    $("stepCount").textContent = `0${stage + 1} / 04`;
    $("progress").style.width = `${(stage + 1) * 25}%`;
''', '''    // The objective panel now shows the next upgrade (upgrades-ui.js); the signal
    // still guides you through the waypoint and the action button.
    void entries;
''')

# Replace automatic recording on proximity with deliberate scanning.
start = s.index("// Walking close to a plant catalogues its species.")
end = s.index("function updateCamera(dt) {")
s = s[:start] + '''// --- Scanning ----------------------------------------------------------------
// On foot, anything you have not recorded shows a ◎ marker once you are close enough
// (scanning.js). E, or the Scan button, runs a short scan; then a card says what you
// found and what it counts toward (scan-ui.js).
const scanUI = createScanUI({ touch: coarsePointer });
const SCAN_TIME = 1.1; // seconds
let scanTarget = null,
    scanProgress = null, // 0..1 while scanning
    scanSearch = 0;
const scannedHere = () => ({
    fauna: (bestiary[activeBody.id] ||= []),
    flora: (catalogue[activeBody.id] ||= []),
    formation: (strata[activeBody.id] ||= []),
});
function updateScan(dt) {
    if (scanTarget) scanTarget.point = followTarget(site, scanTarget);
    if ((scanSearch += dt) >= 0.2 && scanProgress == null) {
        scanSearch = 0;
        scanTarget = findScanTarget({
            site,
            here: surfacePoint(playerNormal),
            eye: camera.position,
            forward: camera.getWorldDirection(vec()),
            known: scannedHere(),
            keep: scanTarget,
        });
    }
    if (scanProgress == null) return;
    if (!scanTarget || scanTarget.point.distanceTo(surfacePoint(playerNormal)) > scanTarget.reach * 1.5) {
        scanProgress = null;
        toast("Scan interrupted: you moved out of range.", 3);
        return;
    }
    scanProgress += dt / SCAN_TIME;
    if (scanProgress >= 1) completeScan();
}
function startScan() {
    if (scanTarget && scanProgress == null) scanProgress = 0;
}
function completeScan() {
    const t = scanTarget, list = scannedHere()[t.kind];
    scanProgress = null;
    scanTarget = null;
    scanSearch = 0.2; // look for the next thing right away
    if (list.includes(t.id)) return;
    list.push(t.id);
    saveSurvey();
    scanUI.flash();
    const entry = t.kind === "fauna" ? faunaEntry(system, activeBody, t.ref) : t.kind === "flora" ? floraEntry(system, activeBody, t.ref) : formationEntry(system, activeBody, t.ref);
    showScanCard(t, recordInfo(entry), list.length);
}
function showScanCard(t, info, n) {
    const totals = siteTotals(),
        total = { fauna: totals.fauna, flora: totals.flora, formation: totals.formations }[t.kind] || 0,
        world = activeBody.name.toUpperCase();
    scanUI.card({
        ...cardFor(t, site, activeBody),
        eyebrow: `NEW ${KIND_WORDS[t.kind].toUpperCase()} · ${total ? `${Math.min(n, total)} OF ${total} ON ${world}` : world}`,
        footer: info.ready
            ? { text: `Upgrade ready: ${info.ready.name}. Press U to install it.`, ready: true }
            : info.moved
              ? { text: `Counts toward ${info.moved.name}: ${info.progressText}` }
              : { text: "Recorded in your codex." },
    });
}
// The marker follows what you would scan, every frame.
function drawScanMarker() {
    if (mode !== "walk" || !scanTarget || modalOpen()) return scanUI.marker(null);
    const p = scanTarget.point.clone().project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) return scanUI.marker(null);
    scanUI.marker(
        { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight, label: `SCAN · ${KIND_WORDS[scanTarget.kind].toUpperCase()}` },
        scanProgress,
    );
}
''' + s[end:]
s = rep(s, "    checkFlora(dt);\n", "    updateScan(dt);\n")

# E on foot: investigate the signal, else scan, else board, else a hint.
s = rep(s, '''        if (shipDistance < 9) {
            mode = "landed";''', '''        if (distanceToSignal() < 9 && !discovered) {
            discover();
        } else if (scanTarget) {
            startScan();
        } else if (shipDistance < 9) {
            mode = "landed";''')
s = rep(s, '''                stage === 2
                    ? "Follow the Kestrel marker to return to your ship."
                    : "Follow the signal. Get closer to investigate.",''', '''                stage === 2
                    ? "Follow the Kestrel marker to return to your ship."
                    : "Nothing to scan here. Walk up to plants, animals and rock formations, or follow the signal.",''')

# Settlements: still recorded when you come near, now with a card.
s = rep(s, "    toast(`Signs of intelligence. ${built.civ.description}${record(settlementEntry(system, activeBody, civilizationOf(activeBody), built.civ.tier))}`, 9);",
        "    showScanCard({ kind: \"settlement\", ref: built.civ }, recordInfo(settlementEntry(system, activeBody, civilizationOf(activeBody), built.civ.tier)), 1);")

s = rep(s, "    get target() { return target; },\n", '''    get target() { return target; },
    get scanLabel() { return mode === "walk" && scanTarget ? (scanProgress != null ? "Scanning…" : `Scan ${KIND_WORDS[scanTarget.kind]}`) : null; },
''')
s = rep(s, "        if (started) updateWaypoint(hudState);\n", "        if (started) updateWaypoint(hudState);\n        if (started) drawScanMarker();\n")
save("game.js", s)

# ---------------- hud.js ----------------
h = load("hud.js")
h = rep(h, '''        label = nearShip
            ? "Board Kestrel <kbd>E</kbd>"
            : distanceToSignal() < 9
              ? "Investigate <kbd>E</kbd>"
              : "Follow the marker <kbd>E</kbd>";''', '''        label = distanceToSignal() < 9 && !g.discovered
            ? "Investigate <kbd>E</kbd>"
            : g.scanLabel
              ? `${g.scanLabel} <kbd>E</kbd>`
              : nearShip
                ? "Board Kestrel <kbd>E</kbd>"
                : distanceToSignal() < 9
                  ? "Investigate <kbd>E</kbd>"
                  : "Follow the marker <kbd>E</kbd>";''')
h = rep(h, '"<kbd>W A S D</kbd> walk <kbd>SPACE</kbd> jump <kbd>E</kbd> interact', '"<kbd>W A S D</kbd> walk <kbd>SPACE</kbd> jump <kbd>E</kbd> scan / interact')
save("hud.js", h)

# ---------------- index.html ----------------
x = load("index.html")
start = x.index('            <section class="mission">')
end = x.index("</section>", start) + len("</section>")
x = x[:start] + '''            <!-- The next upgrade, or first steps (filled by upgrades-ui.js). -->
            <section class="mission" id="guide" aria-live="polite"></section>''' + x[end:]
x = rep(x, "                <dt>Walk near</dt>\n                <dd>Record a plant, animal or rock formation. Records count toward upgrades (U).</dd>\n",
        "                <dt>E</dt>\n                <dd>Scan the plant, animal or rock formation under the ◎ marker. Scans count toward upgrades (U).</dd>\n")
save("index.html", x)
print("ok")
