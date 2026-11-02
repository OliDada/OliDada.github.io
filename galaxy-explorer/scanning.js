// Scanning on foot: what you are aiming at, and the card that describes it.
// game.js asks findScanTarget() several times a second with the camera's position
// and direction. The result is whatever recordable thing (plant, animal, rock or
// landform) sits nearest the crosshair within reach, recorded or not. Holding E
// scans something new; pressing E on something recorded shows its card again.
// Works on the landing site built by surface.js.
import * as THREE from "./vendor/three.module.js";

const v = new THREE.Vector3();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const firstSentence = (s = "") => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s);
const names = (list) => (list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);

const AIM = 0.12; // radians off the crosshair that still count, plus the object's apparent size
// How far away each kind can be scanned from, in metres.
const reachOf = {
    // Fliers and drifters keep to the sky (up to about 28 m up), so they can be scanned from farther.
    fauna: (sp) => (sp.altitude[1] > 0 ? 34 : 12) + sp.size * 6,
    flora: (s) => 6 + s.height * 0.6,
    formation: (foot, scale) => foot * scale + 7,
};

// findScanTarget({ site, here, eye, forward, known, keep, holding }) -> target | null
//   known: { fauna: [ids], flora: [ids], formation: [ids] } recorded on this world
//   keep: the current target; holding: a scan is under way, so keep it with a looser aim
//   target: { kind, id, ref, point, reach, known }
export function findScanTarget({ site, here, eye, forward, known, keep, holding = false }) {
    const options = [];
    const consider = (kind, id, ref, point, reach, size) => {
        const d = point.distanceTo(here);
        if (d > reach) return;
        v.copy(point).sub(eye);
        const dist = Math.max(v.length(), 0.01);
        const angle = Math.acos(Math.max(-1, Math.min(1, v.divideScalar(dist).dot(forward))));
        const allow = AIM + Math.atan2(size, dist); // bigger and closer things are easier to aim at
        if (angle > allow * (holding ? 2.2 : 1)) return;
        const isKnown = known[kind].includes(id);
        options.push({ kind, id, ref, point, reach, known: isKnown, s: (angle / allow + (d / reach) * 0.3) * (isKnown ? 1.15 : 1) });
    };
    const lift = (p, h) => p.clone().addScaledVector(p.clone().normalize(), h);
    const { fauna, flora, geology } = site;
    if (fauna?.species.length)
        for (const sp of fauna.species)
            for (const p of fauna.positionsOf(sp))
                consider("fauna", sp.id, sp, lift(p, sp.altitude[1] > 0 ? 0 : sp.size * 0.5 + 0.2), reachOf.fauna(sp), Math.max(0.6, sp.size * 0.8));
    if (geology?.placed.length)
        for (const p of geology.placed)
            for (let i = 0; i < p.scales.length; i++) {
                if (!p.scales[i]) continue;
                const base = new THREE.Vector3(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]);
                if (base.distanceTo(here) > reachOf.formation(p.foot, p.scales[i]) + 2) continue;
                consider("formation", p.formation.id, p.formation, lift(base, p.height * p.scales[i] * 0.45), reachOf.formation(p.foot, p.scales[i]), p.foot * p.scales[i] * 0.8);
            }
    if (flora?.placed.length)
        for (const { species, positions } of flora.placed) {
            const reach = reachOf.flora(species);
            for (let i = 0; i < positions.length; i += 3) {
                const dx = positions[i] - here.x, dy = positions[i + 1] - here.y, dz = positions[i + 2] - here.z;
                if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
                const base = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                consider("flora", species.id, species, lift(base, Math.max(0.4, species.height * 0.5)), reach, Math.max(0.5, species.height * 0.35));
            }
        }
    if (keep && holding) {
        // Mid-scan: stay on the same thing (the nearest of its kind to where it was), or lose it.
        const same = options.filter((o) => o.kind === keep.kind && o.id === keep.id);
        return same.length ? same.reduce((a, b) => (b.point.distanceTo(keep.point) < a.point.distanceTo(keep.point) ? b : a)) : null;
    }
    return options.length ? options.reduce((a, b) => (b.s < a.s ? b : a)) : null;
}

// Where a moving animal is now (the nearest of its kind to where it was).
export function followTarget(site, t) {
    if (t.kind !== "fauna") return t.point;
    const list = site.fauna?.positionsOf(t.ref) || [];
    if (!list.length) return t.point;
    const p = list.reduce((a, b) => (b.distanceTo(t.point) < a.distanceTo(t.point) ? b : a));
    return p.clone().addScaledVector(p.clone().normalize(), t.ref.altitude[1] > 0 ? 0 : t.ref.size * 0.5 + 0.2);
}

// What to call a target: rock types and landforms are both codex kind 'formation'.
export const wordFor = (t) => (t.kind === "fauna" ? "animal" : t.kind === "flora" ? "plant" : t.kind === "settlement" ? "settlement" : t.ref?.type === "rock" ? "rock" : "landform");

const PLAN_WORDS = {
    quadruped: "Four-legged", hexapod: "Six-legged", biped: "Two-legged", serpent: "Legless, coiling", flyer: "Winged flier",
    floater: "Gas-filled drifter", arachnid: "Eight-legged", slug: "Soft-bodied, gliding", radial: "Radial, no front or back", roller: "Rolls instead of walking",
};
const ACTIVE_WORDS = { diurnal: "By day", nocturnal: "By night", crepuscular: "At dawn and dusk", any: "At any hour" };
const TEMPER_WORDS = { skittish: "Wary: bolts if you come close", curious: "Bold: comes to size you up", indifferent: "Calm: ignores you" };
const FORM_WORDS = {
    tree: "Tree", conifer: "Spire", palm: "Frond", shrub: "Bush", grass: "Grass", succulent: "Water-hoarding pillar", fungus: "Stalked cap",
    stalk: "Pod-stalk", mat: "Microbial mat", mound: "Microbial mound", crystal: "Crystal shard", glasstree: "Glasswood", chimney: "Mineral chimney",
    plume: "Feathery plume", bulb: "Waxy bulb", sheet: "Translucent sail", filament: "Beaded thread", crust: "Tar-dark crust",
};
const chemistry = (c) => (c && c !== "carbon" && c !== "water" ? `${cap(c)}-based, not water` : null);

// The card for a target: { title, lede, facts: [[label, value]], tags: [{ text, tone }] }.
export function cardFor(t, site, body) {
    if (t.kind === "fauna") {
        const sp = t.ref, eco = sp.ecology || {}, all = site.fauna?.species || [];
        const nameOf = (id) => all.find((x) => x.id === id)?.name;
        const prey = (eco.prey || []).map(nameOf).filter(Boolean), hunters = (eco.predators || []).map(nameOf).filter(Boolean);
        return {
            title: sp.name, lede: firstSentence(sp.description),
            facts: [
                ["Diet", sp.traits.diet === "filter" ? "Filter-feeder" : cap(sp.traits.diet)],
                ["Body", PLAN_WORDS[sp.plan] || cap(sp.plan)],
                ["Active", ACTIVE_WORDS[eco.activity] || null],
                ["Lives", sp.group > 1 ? `In groups of up to ${sp.group}` : "Alone"],
                ["Temper", eco.stalksYou ? "Stalks explorers on foot" : TEMPER_WORDS[sp.behavior] || null],
                ["Mind", cap(sp.mind)],
                ["Hunts", prey.length ? names(prey) : null],
                ["Hunted by", hunters.length ? names(hunters) : null],
                ["Chemistry", chemistry(sp.chemistry)],
            ].filter(([, x]) => x),
            tags: [eco.stalksYou && { text: "Dangerous", tone: "warn" }, sp.glow > 0.3 && { text: "Glows" }, sp.civilization && { text: "Intelligent", tone: "gold" }].filter(Boolean),
        };
    }
    if (t.kind === "flora") {
        const s = t.ref, h = s.habitat || {};
        return {
            title: s.name, lede: firstSentence(s.description),
            facts: [
                ["Form", FORM_WORDS[s.form] || cap(s.form)],
                ["Height", `${s.height < 2 ? s.height.toFixed(1) : Math.round(s.height)} m`],
                ["Grows", h.shore ? "Along shorelines" : h.highland ? "On high ground" : h.moist > 0.65 ? "In wet lowlands" : h.moist < 0.38 ? "In dry ground" : "Across temperate ground"],
                ["Chemistry", chemistry(body.physics?.biochemistry)],
            ].filter(([, x]) => x),
            tags: [s.glow > 0.45 && { text: "Glows" }].filter(Boolean),
        };
    }
    if (t.kind === "formation") {
        const f = t.ref;
        if (f.type === "rock")
            return { title: f.name, lede: f.description, facts: [["Type", f.rockKind], ["Found", "Here and there across this world"]], tags: [] };
        return {
            title: f.name, lede: f.description,
            facts: [["Made of", f.cold ? "Ice" : "Rock"], ["Found", f.near === "shore" ? "On coasts" : f.near === "high" ? "On high ground" : "Here and there across this world"]],
            tags: [f.rare && { text: "Rare", tone: "gold" }].filter(Boolean),
        };
    }
    // settlement: t.ref is the civilization drawn at the site (structures-mesh.js)
    const c = t.ref;
    return {
        title: c.species?.name ? `${c.species.name} builders` : "Settlement", lede: c.description,
        facts: [["Builders", cap(c.tier)], ["Culture", c.culture ? cap(c.culture) : null]].filter(([, x]) => x),
        tags: [{ text: "Intelligent life", tone: "gold" }],
    };
}
