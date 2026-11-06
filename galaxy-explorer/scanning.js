// Scanning on foot: what you are aiming at, and the card that describes it.
// game.js asks findScanTarget() several times a second with the camera's position
// and direction. The result is whatever recordable thing (plant, animal, rock or
// landform) sits nearest the crosshair within reach, recorded or not. Holding E
// scans something new; pressing E on something recorded shows its card again.
// An animal you have already scanned that is doing something you have not seen
// it do (grazing, drinking, asleep, hunting…) is a 'behaviour' target instead:
// hold E to watch it until the ring fills. Works on the landing site built by surface.js.
import * as THREE from "./vendor/three.module.js";
import { BEHAVIOURS, behavioursOf, behaviourNow } from "./ecology.mjs";

const v = new THREE.Vector3();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const firstSentence = (s = "") => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s);
const names = (list) => (list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`);

const AIM = 0.12; // radians off the crosshair that still count, plus the object's apparent size
// How far away each kind can be scanned from, in metres.
const reachOf = {
    // Fliers and drifters keep to the sky (up to about 28 m up), so they can be scanned from farther.
    // Sea life is scanned from the shore, so it reaches farther too.
    fauna: (sp) => (sp.altitude[1] > 0 ? 34 : sp.aquatic ? 26 : 12) + sp.size * (sp.aquatic ? 3 : 6),
    flora: (s) => 6 + s.height * 0.6,
    formation: (foot, scale) => foot * scale + 7,
};

// findScanTarget({ site, here, eye, forward, known, keep, holding, reachScale, aimScale, cores }) -> target | null
//   cores: Deep core sampler installed, so a recorded rock or landform with no core sample yet is a 'core' target
//   reachScale: multiplies every reach (field glasses while zoomed); aimScale: shrinks the aim cone with a zoomed view
//   known: { fauna: [ids], flora: [ids], formation: [ids], behaviour?: ['speciesId:behaviour'] } recorded on this world
//   keep: the current target; holding: a scan is under way, so keep it with a looser aim
//   target: { kind, id, ref, point, reach, known, creature?, behaviour? }
export function findScanTarget({ site, here, eye, forward, known, keep, holding = false, reachScale = 1, aimScale = 1, cores = false }) {
    const options = [];
    const consider = (kind, id, ref, point, baseReach, size, extra) => {
        const d = point.distanceTo(here), reach = baseReach * reachScale;
        if (d > reach) return;
        v.copy(point).sub(eye);
        const dist = Math.max(v.length(), 0.01);
        const angle = Math.acos(Math.max(-1, Math.min(1, v.divideScalar(dist).dot(forward))));
        const allow = AIM * aimScale + Math.atan2(size, dist); // bigger and closer things are easier to aim at
        if (angle > allow * (holding ? 2.2 : 1)) return;
        const isKnown = !!known[kind]?.includes(id);
        options.push({ kind, id, ref, point, reach, known: isKnown, s: (angle / allow + (d / reach) * 0.3) * (isKnown ? 1.15 : 1), ...extra });
    };
    const lift = (p, h) => p.clone().addScaledVector(p.clone().normalize(), h);
    const { fauna, flora, geology } = site;
    if (fauna?.species.length)
        for (const sp of fauna.species) {
            const list = fauna.individualsOf ? fauna.individualsOf(sp) : fauna.positionsOf(sp).map((position) => ({ position }));
            const scanned = known.fauna.includes(sp.id), reach = reachOf.fauna(sp), size = Math.max(0.6, sp.size * 0.8);
            for (const { creature, position } of list) {
                const point = lift(position, sp.altitude[1] > 0 || sp.aquatic ? 0 : sp.size * 0.5 + 0.2);
                // Watching works from farther than scanning: you only need to see what it does.
                const b = scanned ? behaviourNow(creature) : null, id = `${sp.id}:${b}`;
                if (b && !known.behaviour?.includes(id)) consider("behaviour", id, sp, point, reach * 1.6, size, { creature, behaviour: b });
                else consider("fauna", sp.id, sp, point, reach, size, { creature });
            }
        }
    if (geology?.placed.length)
        for (const p of geology.placed)
            for (let i = 0; i < p.scales.length; i++) {
                if (!p.scales[i]) continue;
                const base = new THREE.Vector3(p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]);
                if (base.distanceTo(here) > reachOf.formation(p.foot, p.scales[i]) * reachScale + 2) continue;
                const kind = cores && known.formation.includes(p.formation.id) && !known.core?.includes(p.formation.id) ? "core" : "formation";
                consider(kind, p.formation.id, p.formation, lift(base, p.height * p.scales[i] * 0.45), reachOf.formation(p.foot, p.scales[i]), p.foot * p.scales[i] * 0.8);
            }
    if (flora?.placed.length)
        for (const { species, positions } of flora.placed) {
            const reach = reachOf.flora(species), far = reach * reachScale;
            for (let i = 0; i < positions.length; i += 3) {
                const dx = positions[i] - here.x, dy = positions[i + 1] - here.y, dz = positions[i + 2] - here.z;
                if (dx * dx + dy * dy + dz * dz > far * far) continue;
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

// Where a moving animal is now (the one being watched, or the nearest of its kind to where it was).
export function followTarget(site, t) {
    if (t.kind !== "fauna" && t.kind !== "behaviour") return t.point;
    const lifted = (p) => p.clone().addScaledVector(p.clone().normalize(), t.ref.altitude[1] > 0 || t.ref.aquatic ? 0 : t.ref.size * 0.5 + 0.2);
    if (t.creature && site.fauna?.individualsOf) {
        const me = site.fauna.individualsOf(t.ref).find((x) => x.creature === t.creature);
        return me ? lifted(me.position) : t.point;
    }
    const list = site.fauna?.positionsOf(t.ref) || [];
    if (!list.length) return t.point;
    const p = list.reduce((a, b) => (b.distanceTo(t.point) < a.distanceTo(t.point) ? b : a));
    return p.clone().addScaledVector(p.clone().normalize(), t.ref.altitude[1] > 0 || t.ref.aquatic ? 0 : t.ref.size * 0.5 + 0.2);
}

// What to call a target: rock types and landforms are both codex kind 'formation'.
export const wordFor = (t) => (t.kind === "station" ? (t.ark ? "ark" : "station") : t.kind === "core" ? "core sample" : t.kind === "behaviour" ? "behaviour" : t.kind === "phenomenon" ? "sky event" : t.kind === "fauna" ? "animal" : t.kind === "flora" ? "plant" : t.kind === "settlement" ? "settlement" : t.ref?.type === "rock" ? "rock" : "landform");

const PLAN_WORDS = {
    quadruped: "Four-legged", hexapod: "Six-legged", biped: "Two-legged", serpent: "Legless, coiling", flyer: "Winged flier",
    floater: "Gas-filled drifter", arachnid: "Eight-legged", slug: "Soft-bodied, gliding", radial: "Radial, no front or back", roller: "Rolls instead of walking", swimmer: "Swimmer",
};
const ACTIVE_WORDS = { diurnal: "By day", nocturnal: "By night", crepuscular: "At dawn and dusk", any: "At any hour" };
const TEMPER_WORDS = { skittish: "Wary: bolts if you come close", curious: "Bold: comes to size you up", indifferent: "Calm: ignores you" };
const FORM_WORDS = {
    tree: "Tree", conifer: "Spire", palm: "Frond", shrub: "Bush", grass: "Grass", succulent: "Water-hoarding pillar", fungus: "Stalked cap",
    stalk: "Pod-stalk", mat: "Microbial mat", mound: "Microbial mound", crystal: "Crystal shard", glasstree: "Glasswood", chimney: "Mineral chimney",
    plume: "Feathery plume", bulb: "Waxy bulb", sheet: "Translucent sail", filament: "Beaded thread", crust: "Tar-dark crust",
};
const chemistry = (c) => (c && c !== "carbon" && c !== "water" ? `${cap(c)}-based, not water` : null);

// What the scan prompt calls a target.
export function titleFor(t) {
    if (t.kind === "behaviour") return `${t.ref.name} · ${BEHAVIOURS[t.behaviour].name.toLowerCase()}`;
    if (t.kind === "phenomenon") return t.ref.name;
    if (t.kind === "core") return `${t.ref.name} · deep core`;
    return t.known ? t.ref.name : `Unknown ${wordFor(t)}`;
}
// What holding E does to a target: scan it, watch it or record it.
export const verbFor = (t) => (t.kind === "core" ? "sample" : t.kind === "behaviour" ? "observe" : t.kind === "phenomenon" ? "record" : "scan");

// One sentence about an animal doing something, from its traits.
function behaviourLede(sp, b, body, creature, all) {
    const eco = sp.ecology || {}, herd = sp.group > 1;
    const liquid = { methane: "liquid methane", ammonia: "ammonia", sulfur: "molten sulfur" }[body.physics?.solvent] || "water";
    const prey = creature?.prey?.sp?.name || all.find((x) => eco.prey?.includes(x.id))?.name;
    switch (b) {
        case "graze": return `Head down, it crops the ${sp.traits.diet === "omnivore" ? "plants around it, though it will take small prey too" : "plants around it"}.`;
        case "drink": return `It drinks ${liquid} at the shore, ${herd ? "with the herd keeping watch" : "wary of what else comes to the water"}.`;
        case "sleep": return `It sleeps ${eco.activity === "nocturnal" ? "through the day" : eco.activity === "crepuscular" ? "through the middle of the day and night" : "through the night"}, settled low${herd ? " among its herd" : ""}.`;
        case "hunt": return prey ? `It is closing in on a ${prey}: a slow stalk, then a sprint.` : "It is on the hunt: a slow stalk, then a sprint.";
        case "kill": return `It feeds on a fresh catch${herd ? ", sharing it with its pack" : ""}.`;
        case "defend": return "Instead of running, it turns to face the hunter down.";
    }
    return "";
}

// The card for a target: { title, lede, facts: [[label, value]], tags: [{ text, tone }] }.
// seen: behaviours already recorded for an animal's species (a fauna card lists them).
export function cardFor(t, site, body, seen = []) {
    if (t.kind === "behaviour") {
        const sp = t.ref, all = site.fauna?.species || [], options = behavioursOf(sp);
        const got = new Set([...seen, t.behaviour]);
        return {
            title: `${sp.name}: ${BEHAVIOURS[t.behaviour].name.toLowerCase()}`, lede: behaviourLede(sp, t.behaviour, body, t.creature, all),
            facts: [
                ["Species", sp.name],
                ["Active", ACTIVE_WORDS[sp.ecology?.activity] || null],
                ["Watched", `${options.filter((b) => got.has(b)).length} of ${options.length} behaviours`],
                ["Still to see", options.filter((b) => !got.has(b)).map((b) => BEHAVIOURS[b].verb).join(", ") || null],
            ].filter(([, x]) => x),
            tags: [{ text: "Behaviour" }],
        };
    }
    if (t.kind === "core") {
        const f = t.ref, c = t.sample;
        return {
            title: `${f.name}: deep core`, lede: c?.origin ?? f.description,
            facts: [["Age", c ? cap(c.ageText) : null], ["Drilled", c ? `${c.depth} m down` : null], ["Type", f.type === "rock" ? f.rockKind : "Landform"]].filter(([, x]) => x),
            tags: [{ text: "Core sample" }],
        };
    }
    if (t.kind === "phenomenon") {
        const ph = t.ref;
        return { title: ph.name, lede: ph.description, facts: ph.facts || [], tags: [{ text: "Sky event", tone: "gold" }, ph.total && { text: "Total" }].filter(Boolean) };
    }
    if (t.kind === "fauna") {
        const sp = t.ref, eco = sp.ecology || {}, all = site.fauna?.species || [];
        const nameOf = (id) => all.find((x) => x.id === id)?.name;
        const prey = (eco.prey || []).map(nameOf).filter(Boolean), hunters = (eco.predators || []).map(nameOf).filter(Boolean);
        return {
            title: sp.name, lede: firstSentence(sp.description),
            facts: [
                ["Diet", sp.traits.diet === "filter" ? "Filter-feeder" : cap(sp.traits.diet)],
                ["Body", PLAN_WORDS[sp.plan] || cap(sp.plan)],
                ["Build", { giant: "Giant", heavy: "Heavy, barrel-bodied", lanky: "Tall and thin" }[sp.build] || null],
                ["Size", sp.size >= 3 ? `About ${Math.round(sp.size)} m long` : null],
                ["Active", ACTIVE_WORDS[eco.activity] || null],
                ["Lives", sp.group > 1 ? `In groups of up to ${sp.group}` : "Alone"],
                ["Temper", eco.stalksYou ? "Stalks explorers on foot" : TEMPER_WORDS[sp.behavior] || null],
                ["Mind", cap(sp.mind)],
                ["Hunts", prey.length ? names(prey) : null],
                ["Hunted by", hunters.length ? names(hunters) : null],
                ["Chemistry", chemistry(sp.chemistry)],
                ["Watched", behavioursOf(sp).length ? (seen.length ? seen.map((b) => BEHAVIOURS[b]?.verb).filter(Boolean).join(", ") : "Nothing yet: watch what it does") : null],
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
    if (t.kind === "station") {
        const c = t.ref, d = t.deck;
        const STANCE_WORDS = { welcome: "Welcoming: they come to meet you", curious: "Curious: they come to study you", wary: "Wary: they keep their distance", guarded: "Guarded: wardens follow you" };
        return {
            title: t.ark ? cap(t.ark.name) : c.species?.name ? `${c.species.name} station` : "Station",
            lede: t.ark
                ? `${c.spaceborne ? `The ark the ${c.species?.name ?? "builder"}s live on, having left their world` : `An ark of the ${c.species?.name ?? "builder"}s, home to many of them beside their world`}: ${{ cylinders: "two great turning drums on a spine", torus: "a great wheel on spokes", spindle: "a needle of stacked discs", sphere: "a vast lit sphere ringed with farms", bloom: "a cluster of grown pods round a core" }[t.ark.form] || "a vast station"}, with ${d?.layout ?? "a deck"} on top.`
                : `A station in orbit with a landing deck open to space: ${d?.layout ?? "a deck"}.${d?.landmark ? ` On the side facing their world: ${d.landmark}.` : ""}`,
            facts: [["Builders", c.spaceborne ? "Spaceborne" : cap(c.tier)], ["Path", c.path ? cap(c.path) : null], ["Deck", d?.radius ? `About ${Math.round(d.radius * 2)} m across, ${d.pads.length} pads` : null], ["Crew", d?.crewCount ? `${d.crewCount} on deck, in pressure suits` : null], ["Toward you", STANCE_WORDS[d?.stance] || null]].filter(([, x]) => x),
            tags: [{ text: t.ark ? "Ark" : "Station", tone: "gold" }, c.path && { text: cap(c.path) }].filter(Boolean),
        };
    }
    // settlement: t.ref is the civilization drawn at the site (structures-mesh.js)
    const c = t.ref;
    return {
        title: c.species?.name ? `${c.species.name} builders` : "Settlement", lede: c.description,
        facts: [["Builders", cap(c.tier)], ["Culture", c.culture ? cap(c.culture) : null], ["Path", c.path ? cap(c.path) : null], ["Now", c.spaceborne ? `Gone: they live on ${c.arkName}` : null], ["Toward you", c.disposition && !c.spaceborne ? cap(c.disposition) : null], ["Could teach", c.offers ? cap([c.offers.tier, c.offers.path].filter(Boolean).join("; ")) : null]].filter(([, x]) => x),
        tags: [{ text: "Intelligent life", tone: "gold" }, c.spaceborne && { text: "Abandoned", tone: "warn" }, c.path && { text: cap(c.path) }].filter(Boolean),
    };
}
