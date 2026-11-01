import test from "node:test";
import assert from "node:assert/strict";
import { makeStar, makeWorld, makeGiant, giantChance } from "./physics.mjs";
import { generateSystem } from "./system.mjs";
import { BIOMES } from "./biomes.mjs";
import { rng } from "./rng.mjs";

test("hash-based randomness is stable and independent per key", () => {
    assert.equal(rng(5, "planet", 2)(), rng(5, "planet", 2)());
    assert.notEqual(rng(5, "planet", 2)(), rng(5, "planet", 3)());
    for (let i = 0; i < 1000; i++) {
        const v = rng(i)();
        assert.ok(v >= 0 && v < 1);
    }
});

test("stars follow the mass-luminosity relation and a Sun-like star is Sun-like", () => {
    for (let s = 0; s < 500; s++) {
        const star = makeStar(s);
        assert.ok(star.mass >= 0.1 && star.mass <= 2.1);
        assert.ok(
            star.temperature > 2500 && star.temperature < 10500,
            `${star.temperature}`,
        );
        assert.ok(
            star.habitableZone[0] < star.habitableZone[1] &&
                star.habitableZone[1] < star.frostLine,
        );
        assert.ok(star.age < star.lifespan);
    }
    const sunlike = Array.from({ length: 2000 }, (_, s) => makeStar(s)).find(
        (s) => Math.abs(s.mass - 1) < 0.01,
    );
    assert.ok(
        Math.abs(sunlike.luminosity - 1) < 0.05 &&
            Math.abs(sunlike.temperature - 5778) < 100,
    );
});

test("an Earth-like setup gives Earth-like temperatures and liquid water", () => {
    const sun = {
        mass: 1,
        luminosity: 1,
        radius: 1,
        temperature: 5778,
        age: 4.6,
        flareActivity: 0,
        habitableZone: [0.95, 1.37],
        frostLine: 4.85,
    };
    let liquid = 0;
    for (let i = 0; i < 200; i++) {
        const w = makeWorld(sun, 1, rng("earth", i), null, { candidate: true });
        if (w.waterState === "liquid") liquid++;
    }
    assert.ok(
        liquid > 60,
        `only ${liquid}/200 candidate worlds at 1 AU have liquid water`,
    );
});

test("worlds get colder further from the star, and physics stays consistent", () => {
    for (let s = 0; s < 400; s++) {
        const { bodies } = generateSystem(s);
        const planets = bodies.filter((b) => !b.parent).map((b) => b.physics);
        for (let i = 1; i < planets.length; i++)
            assert.ok(planets[i].au > planets[i - 1].au);
        // Starlight alone (before albedo and greenhouse) always drops with distance.
        for (let i = 1; i < planets.length; i++)
            assert.ok(
                planets[i].equilibrium / (1 - planets[i].albedo) ** 0.25 <
                    planets[i - 1].equilibrium /
                        (1 - planets[i - 1].albedo) ** 0.25,
            );
        for (const b of bodies) {
            const p = b.physics;
            for (const v of [
                p.mass,
                p.radius,
                p.gravity,
                p.temperature,
                p.pressure,
            ])
                assert.ok(Number.isFinite(v) && v >= 0);
            if (p.waterState === "liquid")
                assert.ok(p.temperature >= 273 && p.pressure > 0.006);
            if (p.waterState === "ice") assert.ok(p.temperature < 273);
            if (p.life !== "none")
                assert.ok(
                    p.waterState === "liquid" || p.subsurfaceOcean,
                    `${b.name} has life without water`,
                );
            if (b.biome === "Frozen") assert.ok(p.temperature < 273);
            if (b.biome === "Oceanic") assert.equal(p.waterState, "liquid");
        }
    }
});

test("the galaxy is varied: every biome appears and a good share of systems hold life", () => {
    const biomes = new Set();
    let withLife = 0,
        withComplex = 0;
    const n = 1500;
    for (let s = 0; s < n; s++) {
        const { bodies } = generateSystem(s);
        for (const b of bodies) biomes.add(b.biome);
        if (bodies.some((b) => b.physics.life !== "none")) withLife++;
        if (bodies.some((b) => b.physics.life === "complex")) withComplex++;
    }
    assert.equal(biomes.size, Object.keys(BIOMES).length, [...biomes].join()); // every rocky biome plus gas and ice giants
    assert.ok(
        withLife / n > 0.3 && withLife / n < 0.7,
        `life in ${withLife}/${n}`,
    );
    assert.ok(withComplex / n > 0.05, `complex life in ${withComplex}/${n}`);
});

test("giants follow their own physics: Jupiter-like at 5 AU, and cloud colour tracks temperature", () => {
    const sun = { mass: 1, luminosity: 1, radius: 1, temperature: 5778, age: 4.6, flareActivity: 0, habitableZone: [0.95, 1.37], frostLine: 4.85 };
    for (let i = 0; i < 300; i++) {
        const g = makeGiant(sun, 5.2, rng("jupiter", i));
        assert.ok(g.giant && g.mass >= 12 && g.mass <= 3000);
        if (g.kind === "gas") assert.ok(g.radius > 4 && g.radius < 13, `radius ${g.radius}`);
        else assert.ok(g.radius > 3 && g.radius < 5, `radius ${g.radius}`);
        assert.ok(g.temperature > 90 && g.temperature < 260, `${g.temperature} K at 5.2 AU`);
        assert.equal(g.life, "none");
    }
    const hot = makeGiant(sun, 0.04, rng("hot", 1)), cold = makeGiant(sun, 30, rng("cold", 1));
    assert.ok(hot.temperature > 900 && ["alkali", "silicate"].includes(hot.clouds), hot.clouds);
    assert.ok(cold.temperature < 150 && ["ammonia", "methane"].includes(cold.clouds));
    assert.ok(hot.radius > makeGiant(sun, 5.2, rng("hot", 1)).radius, "hot giants are puffed up");
    // Giants are far likelier beyond the frost line, and around heavier stars.
    assert.ok(giantChance(sun, 6) > giantChance(sun, 1) * 5);
    assert.ok(giantChance(sun, 6) > giantChance({ ...sun, mass: 0.2 }, 6));
});
