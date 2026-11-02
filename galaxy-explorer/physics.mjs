// Physical model. Simplified real astrophysics in real units; system.mjs converts
// to compressed game distances. Every derived value follows from earlier ones:
// star mass -> luminosity -> planet temperature -> atmosphere/water -> life.
import { rng } from "./rng.mjs";

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const bell = (v, center, width) => Math.exp(-(((v - center) / width) ** 2));

// Small red dwarfs are by far the most common stars; bright A stars are rare.
const SPECTRAL = [
    { cls: "M", weight: 0.5, min: 0.1, max: 0.45 },
    { cls: "K", weight: 0.22, min: 0.45, max: 0.8 },
    { cls: "G", weight: 0.15, min: 0.8, max: 1.04 },
    { cls: "F", weight: 0.09, min: 1.04, max: 1.4 },
    { cls: "A", weight: 0.04, min: 1.4, max: 2.1 },
];

// Approximate blackbody colour (Tanner Helland's fit).
export function blackbodyColor(kelvin) {
    const t = kelvin / 100;
    let r, g, b;
    if (t <= 66) {
        r = 255;
        g = 99.47 * Math.log(t) - 161.12;
        b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    } else {
        r = 329.7 * Math.pow(t - 60, -0.1332);
        g = 288.12 * Math.pow(t - 60, -0.0755);
        b = 255;
    }
    return (
        "#" +
        [r, g, b]
            .map((v) =>
                Math.round(clamp(v, 0, 255))
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
}

export function makeStar(seed) {
    const r = rng(seed, "star");
    let roll = r(),
        type = SPECTRAL[0];
    for (const s of SPECTRAL) {
        if (roll < s.weight) {
            type = s;
            break;
        }
        roll -= s.weight;
    }
    const mass = r.range(type.min, type.max); // solar masses
    const luminosity = mass < 0.43 ? 0.23 * mass ** 2.3 : mass ** 4; // solar luminosities
    const radius = mass ** 0.8; // solar radii
    const temperature = Math.round(5778 * (luminosity / radius ** 2) ** 0.25);
    const lifespan = 10 * mass ** -2.5; // billions of years
    const age = r.range(0.4, Math.min(lifespan * 0.9, 12));
    const flareActivity =
        type.cls === "M"
            ? r.range(0.35, 1)
            : type.cls === "K"
              ? r.range(0, 0.3)
              : r.range(0, 0.08);
    return {
        spectralClass: type.cls + Math.floor(r() * 10),
        mass,
        luminosity,
        radius,
        temperature,
        age,
        lifespan,
        flareActivity,
        color: blackbodyColor(temperature),
        habitableZone: [
            Math.sqrt(luminosity / 1.1),
            Math.sqrt(luminosity / 0.53),
        ], // AU
        frostLine: 4.85 * Math.sqrt(luminosity), // AU
    };
}

// Builds one rocky or icy world. `parent` is the planet's physics when this is a moon.
export function makeWorld(
    star,
    au,
    r,
    parent = null,
    { candidate = false } = {},
) {
    // Draw every random number up front so the sequence never depends on branches.
    const roll = {
        mass: r(),
        albedo: r(),
        volatiles: r(),
        atmosphere: r(),
        greenhouse: r(),
        volcanism: r(),
        tidal: r(),
        life: r(),
    };
    const icy = au > star.frostLine;
    const mass = parent
        ? 0.01 * 30 ** roll.mass
        : candidate
          ? 0.5 * 6 ** roll.mass
          : icy
            ? 0.05 * 50 ** roll.mass
            : 0.08 * 50 ** roll.mass; // Earth masses
    const radius = (icy ? 1.12 : 1) * mass ** 0.28; // Earth radii
    const gravity = mass / radius ** 2; // g
    const escapeVelocity = 11.2 * Math.sqrt(mass / radius); // km/s

    // Heat from the star alone, before albedo and greenhouse.
    const irradiance = (278 * star.luminosity ** 0.25) / Math.sqrt(au);
    const insideHZ = au < star.habitableZone[1] * 1.3;

    // Atmosphere: needs enough gravity to hold gas; heat and stellar flares strip it.
    const retention =
        clamp((escapeVelocity - 2.5) / 7, 0, 1) *
        clamp(1 - (irradiance - 420) / 800, 0, 1) *
        (1 - star.flareActivity * (insideHZ ? 0.4 : 0.1));
    const pressure =
        retention < 0.08
            ? 0
            : (candidate
                  ? 0.4 * 12 ** roll.atmosphere
                  : 0.02 * 1000 ** roll.atmosphere) *
              retention ** (candidate ? 0.5 : 1.5); // bar

    // Water and other volatiles: plentiful beyond the frost line.
    const volatiles = icy
        ? 0.45 + 0.55 * roll.volatiles
        : roll.volatiles ** 1.6;
    let albedo = 0.08 + 0.32 * roll.albedo;
    const greenhouseFactor = 0.3 * 13 ** roll.greenhouse; // 0.3–3.9× Earth-like
    if (irradiance * (1 - albedo) ** 0.25 < 240 && volatiles > 0.3)
        albedo = Math.max(albedo, 0.5); // ice is bright
    const equilibrium = irradiance * (1 - albedo) ** 0.25;
    // Greenhouse gases freeze out on cold worlds, so warming fades below ~150 K.
    const greenhouse =
        pressure > 0
            ? 33 *
              pressure ** 0.55 *
              greenhouseFactor *
              clamp((equilibrium - 140) / 110, 0, 1)
            : 0;
    const temperature = equilibrium + greenhouse; // K, surface average

    const lockRadius =
        0.27 * star.mass ** (1 / 3) * (star.age / 4.5) ** (1 / 6);
    const tidallyLocked = parent ? true : au < lockRadius;
    const tidalHeating = parent
        ? roll.tidal * clamp(parent.mass / 50, 0.1, 1)
        : 0;
    const volcanism = clamp(
        roll.volcanism ** 1.5 * 0.85 +
            tidalHeating * 0.7 +
            (mass > 2 ? 0.12 : 0),
        0,
        1,
    );

    // Water state from temperature and pressure (boiling point rises with pressure).
    const boiling = pressure > 0.006 ? 373 + 28 * Math.log(pressure) : 0;
    let waterState = "none",
        waterCoverage = 0;
    if (volatiles > 0.06) {
        if (temperature < 273) {
            waterState = "ice";
            waterCoverage = clamp(volatiles * 1.1, 0, 1);
        } else if (temperature < boiling) {
            waterState = "liquid";
            waterCoverage = clamp(volatiles * 1.15, 0.05, 0.97);
        } else if (pressure > 0.5) waterState = "vapor"; // in thin air it simply escapes
    }
    const subsurfaceOcean =
        waterState === "ice" &&
        (tidalHeating > 0.35 || (mass > 1.5 && temperature > 200));

    // Habitability: liquid water, mild temperature, workable air and gravity, a calm, old star.
    let habitability = 0;
    if (waterState === "liquid")
        habitability =
            bell(temperature, 290, 45) *
            clamp(pressure / 0.2, 0, 1) *
            bell(Math.log10(pressure), 0, 1.3);
    else if (subsurfaceOcean) habitability = 0.35;
    habitability *=
        bell(gravity, 1, 1.4) *
        clamp(star.age / 1.2, 0, 1) *
        (1 - star.flareActivity * 0.45) *
        (tidallyLocked && !parent ? 0.75 : 1);
    let life = "none",
        biochemistry = null;
    if (roll.life < habitability ** 0.6) {
        biochemistry = "carbon";
        life = "microbial";
        if (!subsurfaceOcean && habitability > 0.3 && star.age > 1.5)
            life = "simple";
        if (!subsurfaceOcean && habitability > 0.5 && star.age > 3)
            life = "complex";
    }

    // Seas of something other than water, and life built on other chemistry.
    const exotic = exoticChemistry(
        { temperature, pressure, volatiles, volcanism, waterState, gravity },
        star,
        tidallyLocked && !parent,
    );
    const solvent =
        waterState === "liquid" ? "water" : exotic.seas ? exotic.solvent : null;
    const solventCoverage =
        waterState === "liquid" ? waterCoverage : exotic.seas;
    if (life === "none" && exotic.habitability > 0 && roll.life < exotic.habitability ** 0.6) {
        // Exotic chemistry is slower than carbon in water, so it needs more time to get going.
        biochemistry = exotic.solvent === "rock" ? "silicon" : exotic.chemistry;
        life = "microbial";
        if (exotic.habitability > 0.28 && star.age > 2.5) life = "simple";
        if (exotic.habitability > 0.42 && star.age > 4) life = "complex";
    }
    return {
        au,
        icy,
        mass,
        radius,
        gravity,
        escapeVelocity,
        pressure,
        albedo,
        temperature,
        equilibrium,
        greenhouse,
        volatiles,
        waterState,
        waterCoverage,
        subsurfaceOcean,
        tidallyLocked,
        tidalHeating,
        volcanism,
        habitability,
        life,
        biochemistry,
        solvent,
        solventCoverage,
    };
}

// Life without liquid water. Carbon in water is the best chemistry we know, but
// not the only one people take seriously:
//   ammonia  - liquid ammonia (about -78 to -33 °C at 1 bar) on cold worlds with thick air
//   methane  - lakes of liquid methane and ethane on very cold worlds, like Titan (-180 °C)
//   sulfur   - hot volcanic worlds where sulfur compounds do the work water does
//   silicon  - very hot worlds where carbon chemistry falls apart but silicon chains hold
// Each gets a habitability score like water worlds, scaled down: these are long shots.
// No random numbers are drawn here, so worlds without exotic chemistry are unchanged.
export function exoticChemistry(w, star, locked = false) {
    const { temperature: T, pressure: P, volatiles: V, volcanism: Vo, waterState, gravity } = w;
    const none = { chemistry: null, solvent: null, seas: 0, habitability: 0 };
    if (waterState === "liquid") return none;
    const common =
        bell(gravity, 1, 1.6) *
        clamp(star.age / 2, 0, 1) *
        (1 - star.flareActivity * 0.45) *
        (locked ? 0.75 : 1);
    let pick = none;
    if (T > 85 && T < 125 && P > 0.3 && V > 0.3)
        pick = { chemistry: "methane", solvent: "methane", seas: clamp(V * 0.5, 0.08, 0.45),
            habitability: 0.5 * bell(T, 100, 14) * clamp(P / 0.8, 0, 1) };
    else if (T > 190 && T < 250 && P > 0.3 && V > 0.3)
        pick = { chemistry: "ammonia", solvent: "ammonia", seas: clamp(V * 0.6, 0.1, 0.6),
            habitability: 0.65 * bell(T, 218, 18) * clamp(P / 0.6, 0, 1) };
    else if (T > 330 && T < 560 && Vo > 0.4 && P > 0.05)
        pick = { chemistry: "sulfur", solvent: "sulfur", seas: T > 390 ? clamp(Vo * 0.15, 0.04, 0.14) : 0,
            habitability: 0.55 * bell(T, 430, 70) * clamp((Vo - 0.35) / 0.35, 0, 1) * clamp(P / 0.3, 0, 1) };
    else if (T > 560 && T < 1150 && P > 0.1)
        pick = { chemistry: "silicon", solvent: "rock", seas: 0,
            habitability: 0.62 * bell(T, 820, 170) * clamp(P / 0.6, 0, 1) };
    return { ...pick, habitability: pick.habitability * common };
}

// Gas and ice giants. Beyond the frost line ice lets planetary cores grow big
// enough to pull in hydrogen; heavier stars have bigger discs, so more giants.
// Some drift inward after forming; a few end up as hot giants close to their star.
export function giantChance(star, au) {
    const outer = clamp(0.3 + 0.35 * star.mass, 0, 0.75);
    if (au >= star.frostLine) return outer;
    if (au >= star.frostLine * 0.6) return outer * 0.5;
    return 0.015;
}

export function makeGiant(star, au, r) {
    const roll = { mass: r(), radius: r(), albedo: r() };
    // 12–3000 Earth masses (Neptune ≈ 17, Saturn ≈ 95, Jupiter ≈ 318); smaller giants are more common.
    const mass = 12 * 250 ** (roll.mass ** 1.3);
    const kind = mass < 50 ? "ice" : "gas";
    const irradiance = (278 * star.luminosity ** 0.25) / Math.sqrt(au);
    // Ice giants grow slowly with mass. Gas giants are all about Jupiter's size:
    // above a Jupiter mass, extra weight compresses them. Strong starlight puffs them up.
    const inflation = 1 + clamp((irradiance - 700) / 1500, 0, 0.5);
    const radius =
        (kind === "ice"
            ? 3.2 * (mass / 12) ** 0.26
            : mass < 318
              ? 4.6 +
                6.6 *
                    clamp(Math.log(mass / 50) / Math.log(318 / 50), 0, 1) **
                        0.6
              : 11.2 * (mass / 318) ** -0.05) *
        inflation *
        (0.95 + 0.1 * roll.radius); // Earth radii
    const gravity = mass / radius ** 2; // g, at the cloud tops
    const escapeVelocity = 11.2 * Math.sqrt(mass / radius); // km/s
    const albedo = kind === "ice" ? 0.25 + 0.1 * roll.albedo : 0.3 + 0.22 * roll.albedo;
    const equilibrium = irradiance * (1 - albedo) ** 0.25;
    // Gas giants still glow with heat left from their formation; it fades with age.
    const internalHeat =
        kind === "gas"
            ? 100 * (mass / 318) ** 0.3 * (4.5 / Math.max(star.age, 0.5)) ** 0.3
            : 45;
    const temperature = (equilibrium ** 4 + internalHeat ** 4) ** 0.25; // K, cloud tops
    // What the top clouds are made of depends on temperature (Sudarsky's classes).
    const clouds =
        temperature < 150
            ? kind === "ice"
                ? "methane"
                : "ammonia"
            : temperature < 350
              ? "water"
              : temperature < 900
                ? "clear"
                : temperature < 1400
                  ? "alkali"
                  : "silicate";
    const lockRadius =
        0.27 * star.mass ** (1 / 3) * (star.age / 4.5) ** (1 / 6);
    return {
        au,
        giant: true,
        kind,
        clouds,
        icy: au > star.frostLine,
        mass,
        radius,
        gravity,
        escapeVelocity,
        albedo,
        temperature,
        equilibrium,
        internalHeat,
        // No surface: the air just gets denser with depth. These keep the
        // rocky-world fields meaningful for code that reads every body.
        pressure: 1000,
        greenhouse: 0,
        volatiles: 1,
        waterState: "none",
        waterCoverage: 0,
        subsurfaceOcean: false,
        tidallyLocked: au < lockRadius,
        tidalHeating: 0,
        volcanism: 0,
        habitability: 0,
        life: "none",
        biochemistry: null,
        solvent: null,
        solventCoverage: 0,
    };
}
