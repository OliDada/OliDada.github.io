// Prints a generated system so you can tune the physics without opening the game.
// Usage: node galaxy-explorer/inspect.mjs [seed ...]     or  --stats 2000
import { generateSystem } from "./system.mjs";
const args = process.argv.slice(2);
if (args[0] === "--stats") {
    const n = Number(args[1] || 1000),
        biomes = {},
        life = {},
        stars = {};
    let bodies = 0,
        withLife = 0,
        withComplex = 0;
    for (let s = 0; s < n; s++) {
        const sys = generateSystem(s);
        stars[sys.star.physics.spectralClass[0]] =
            (stars[sys.star.physics.spectralClass[0]] || 0) + 1;
        if (sys.bodies.some((b) => b.physics.life !== "none")) withLife++;
        if (sys.bodies.some((b) => b.physics.life === "complex")) withComplex++;
        for (const b of sys.bodies) {
            bodies++;
            biomes[b.biome] = (biomes[b.biome] || 0) + 1;
            life[b.physics.life] = (life[b.physics.life] || 0) + 1;
        }
    }
    const pct = (o, total) =>
        Object.fromEntries(
            Object.entries(o)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => [k, ((100 * v) / total).toFixed(1) + "%"]),
        );
    console.log(
        `${n} systems, ${bodies} worlds (${(bodies / n).toFixed(1)} per system)`,
    );
    console.log("stars ", pct(stars, n));
    console.log("biomes", pct(biomes, bodies));
    console.log("life  ", pct(life, bodies));
    console.log(
        `systems with any life ${((100 * withLife) / n).toFixed(1)}%, with complex life ${((100 * withComplex) / n).toFixed(1)}%`,
    );
} else {
    for (const seed of args.length ? args : ["1408"]) {
        const s = generateSystem(seed),
            st = s.star.physics;
        console.log(
            `\n${s.name} (seed ${s.seed}) — ${st.spectralClass} star, ${st.mass.toFixed(2)} M☉, ${st.temperature} K, ${st.luminosity.toFixed(3)} L☉, age ${st.age.toFixed(1)} Gyr, habitable zone ${st.habitableZone.map((v) => v.toFixed(2)).join("–")} AU`,
        );
        const ordered = s.bodies
            .filter((b) => !b.parent)
            .flatMap((p) => [p, ...s.bodies.filter((m) => m.parent === p.id)]);
        for (const b of ordered)
            console.log(
                `${b.id === s.startId ? "★" : " "} ${(b.parent ? "  ↳ " : "") + b.name.padEnd(10)} ${b.type.padEnd(15)} ${b.physics.au.toFixed(2).padStart(6)} AU  ${b.physics.mass.toFixed(2).padStart(5)} M⊕  ${b.facts}`,
            );
    }
}
